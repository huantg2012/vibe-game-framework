---
status: ACTIVE
slice: 2 (extended in 4.5)
last-modified-by: design agent
last-modified-date: 2026-08-12
interface-changed: false
interfaces-with:
  - system-chaos-scavenge-extract   # consumes RIFT_EXITED; feeds chaosRateModifier + kindlingValueModifier back
  - system-movement-vision          # purification scene reuses Player + VisibilitySystem (DEC-ARCH-008)
  - system-growth-tide              # tide intensity/phase drives boundary shape; defense/growth interaction points
exposes:
  - GameState.getModuleEffect(type)
  - GameState.getKindlingReserve()
  - ImpactSystem.run()
  - AllocationPanel.open(moduleId)
  - BoundaryShape.radiusAt(angle) / normalizedDist(x,y) / isInside(x,y)
  - BoundaryShape.pressureDirection / pressureAt(angle) / tideScale
  - BoundaryBreath.create() / update() （纯视觉叠加层，无玩法输出）
---

# 系统设计：净化点 + 冲击

> **TL;DR**: 定义裂隙出击之外的"基地环"——净化点场景（可步行、潮汐驱动的动态力场边界、边界氛围粒子、模块交互）、GameState（session-only 内存）、薪柴分配（修复模块 hp）、冲击系统（每次出击前扣模块 hp）、模块效果反馈到出击参数。边界形状由 BoundaryShape 统一提供，被地表纹理、碰撞、可见性、氛围与呼吸层共用。

## 概述

净化点是玩家在裂隙出击之间的唯一安全空间。它是一个被强行维持的稳定气泡——不大，不舒适，但足以让玩家喘息、分配资源、承受来自外界的冲击。

气泡不是圆的，也不是固定的。外界污染不均匀地挤压它：潮汐强度决定整体被压缩多少，方向性压力决定哪一侧被压得更狠。唯一的硬保证是它挤不到交互点上——否则净化点会先于玩家失效。

核心循环：出击获得薪柴 → 返回净化点 → 分配薪柴修复模块 → 冲击来临损伤模块 → 模块状态影响下次出击条件 → 再次出击。

---

## 状态模型

```typescript
interface GameState {
  kindlingReserve: number;
  modules: ModuleState[];
  cycle: number;
  impactIntensity: number;
}

interface ModuleState {
  id: string;
  type: 'CORE' | 'STORAGE';
  hp: number;
  maxHp: number;
}

interface ImpactResult {
  damages: { moduleId: string; damage: number; newHp: number }[];
  intensity: number;
}

interface SortieModifiers {
  chaosRateModifier: number;
  kindlingValueModifier: number;
}
```

---

## 规则

### P — 净化点场景

1. **空间**：椭圆形安全区，基础半径 5.2 × 5.0 tile，置于 14x12 的场景网格中心。实际可行走范围随潮汐强度收缩、随压力方向变形（见 B 组）。玩家可自由行走（复用 Player + VisibilitySystem omni 模式）。
2. **模块实体**：2 个可交互物体放在场景中——CORE（中央）和 STORAGE（右侧）。玩家走近（32px 内）时显示交互提示"按 E 分配薪柴"。
3. **裂隙入口**：场景中央偏上，一个脉冲的 teal 标记。走近显示"按 E 进入裂隙"。按 E 触发冲击→切换场景。
4. **边界**：安全区外是虚空，但边界本身不是硬边——从内向外依次是变暗带、teal 膜带、虚空（梯度带定义见 B 组）。边界处有粒子系统：微粒在当前边界外 10-40px 处生成，缓慢向内漂移，越过该角度半径的 50% 或寿命耗尽后重新生成，常驻 `PARTICLE_COUNT` 个。颜色以暗 teal 为主（60%），亮 teal 与灰各占 20%。生成与消亡半径跟随当前边界形状，不是固定圆。
5. **Apparition**：每 8-15 秒（随机），在当前边界外 40-80px 处出现一个模糊人形轮廓（alpha 0→0.3 淡入 0.5s → 持续 2s → 0.3→0 淡出 0.5s）。不移动，角度随机，生成距离以该角度的边界半径为基准，最多同时 3 个，颜色为暗青灰。纯氛围，无游戏功能。
6. **视觉基调**：地面为冷蓝灰的程序化石板（中心略暖、向边缘转冷并逐级压暗），ambient 使用 omni 模式；玩家的肩灯是场景中唯一的暖色。
7. **冲击预告**：进入裂隙前，边界粒子在预告方向的密度升高约 1.5 倍（其他方向的粒子有 30% 概率改在预告方向 ±54° 内生成）。这是一个不完全可靠的信号（准确率见规则 25），帮助玩家判断"哪个模块可能被打"。预告方向与边界的压力主方向相互独立，二者可以指向不同侧。

### G — GameState

8. **初始状态**：`kindlingReserve = 0`，`cycle = 0`，`impactIntensity = 1.0`，两个模块 `hp = 80, maxHp = 100`。
9. **Session-only**：所有状态住在内存中，页面刷新即重置。不做 localStorage。
10. **薪柴入账**：从裂隙返回时（`RIFT_EXITED.survived === true`），`kindlingReserve += kindlingGained`。死亡时 `kindlingGained = 0`，不入账。
11. **周期计数**：每次进入裂隙时 `cycle++`。
12. **冲击强度递增**：每次冲击后 `impactIntensity += INTENSITY_STEP`（0.15），上限 `MAX_INTENSITY`（2.5）。代表"裂隙在持续恶化"。

### A — 分配系统

13. **触发**：玩家走到模块交互点按 E → 打开 DOM overlay 分配面板。
14. **面板内容**：显示当前 `kindlingReserve`、目标模块 `hp/maxHp`、滑块或 +/- 按钮选择分配数量。
15. **修复公式**：每 1 薪柴 = `REPAIR_PER_KINDLING` hp（建议 10）。不能超过 maxHp。
16. **确认**：点击确认 → 扣除 reserve → 增加 hp → emit `ALLOCATION_CONFIRMED { allocations: { [moduleId]: kindlingSpent } }` → 关闭面板。
17. **取消**：点击取消或按 ESC → 关闭面板，不扣资源。
18. **非强制**：玩家可以选择不分配任何薪柴就直接进入裂隙（风险策略）。

### I — 冲击系统

19. **触发时机**：玩家在裂隙入口按 E 确认出击时，在场景切换前执行。
20. **首次豁免**：`cycle === 0`（第一次出击）跳过冲击。从第二次出击开始每次都有冲击。
21. **基础伤害**：`BASE_IMPACT_DAMAGE`（建议 25）× `impactIntensity`。
22. **威胁分布**：随机选一个模块为"重点目标"，承受 65% 伤害，另一个 35%。
23. **冲击演出**：
    - emit `IMPACT_STARTED { intensity }`
    - 画面短暂震动（0.3s）+ 边界粒子向内涌入（0.5s）
    - 计算并应用伤害
    - 每个受损模块 emit `MODULE_DAMAGED { moduleId, newHealth }`（事件类型已存在）
    - emit `IMPACT_RESOLVED { moduleDamage: { [id]: damage } }`
    - 显示结果面板 2 秒（"冲击！CORE -18 hp / STORAGE -9 hp"）
    - 结果面板关闭后切换到裂隙场景
24. **hp 下限**：模块 hp 最低为 0，不进负数。
25. **冲击预告准确率**：粒子密集方向与实际重点目标相符的概率 = `FORECAST_ACCURACY`（0.8）。20% 的时候会"骗人"。

### M — 模块效果

26. **CORE 效果**：提供混乱值 BASE_RATE 减免。公式：`chaosRateModifier = 1.0 - (coreHp / 100) * MAX_CORE_REDUCTION`。`MAX_CORE_REDUCTION = 0.3`（满血 hp=100 时 -30% 混乱值增速）。hp=0 时无减免。
27. **STORAGE 效果**：提供薪柴拾取价值加成。公式：`kindlingValueModifier = 1.0 + (storageHp / 100) * MAX_STORAGE_BONUS`。`MAX_STORAGE_BONUS = 0.5`（满血 hp=100 时 +50% 每次拾取价值）。hp=0 时无加成。
28. **效果计算时机**：在场景切换到裂隙前计算一次，作为 `SortieModifiers` 传递给 RiftScene。
29. **裂隙侧应用**：
    - ChaosSystem 的实际 rate = `BASE_RATE * chaosRateModifier`（在现有 rateMultiplier 之前相乘）
    - LootSystem 的实际 pickup value = `nodeValue * kindlingValueModifier`（向下取整，最低 1）

### F — 场景切换

30. **裂隙→净化点**：`RIFT_EXITED` → RunController 延迟 600ms → `scene.start('PurificationScene', { kindlingGained, survived })`。不再是按 R 重启同一场景。
31. **净化点→裂隙**：玩家在裂隙入口按 E → 执行冲击 → 冲击结束后 → 计算 SortieModifiers → `scene.start('RiftScene', { modifiers, cycle })`。
32. **RiftScene 接收 modifiers**：在 `create()` 中读取 `this.scene.settings.data`，应用 `chaosRateModifier` 和 `kindlingValueModifier` 到对应系统。
33. **死亡时**：`RIFT_EXITED { survived: false }` → 同样切换到净化点，但 kindlingGained=0（已在 Slice 1 RunController 中实现）。

### B — 边界形态与呼吸（Slice 4.5）

34. **边界是一条极坐标曲线**：净化点边界为一条闭合的极坐标曲线（力场气泡）。基础形状是椭圆（`ELLIPSE_RX` × `ELLIPSE_RY`）。任意角度上的最终半径由三层修正依次得到：潮汐缩放 → 方向性压力 → 安全区钳制。
35. **每次场景构建计算一次**：边界形状在进入净化点时依当前潮汐状态与周期数计算一次，此后是无状态的廉价查询对象，不随帧变化。形态的变化发生在两次出击之间，不发生在一次驻留之内。
36. **潮汐缩放**：设 `t = clamp01((intensity - 1.0) / 2.0)`，整体半径乘以 `1 - t * (1 - SHRINK_AT_MAX_INTENSITY)`。intensity=1.0 时为基础尺寸，intensity=3.0 时整体收缩 28%。intensity 的定义与推进归 `system-growth-tide` 的 T 组。
37. **方向性压力叶**：两个高斯叶沿角度分布，把半径按比例向内压——半径乘以 `1 - pressure(angle)`。主叶振幅 `PRESSURE_PRIMARY_AMP`，次叶 `PRESSURE_SECONDARY_AMP`，角宽均为 `PRESSURE_LOBE_SIGMA`。压力不均匀：外界污染不从各个方向等量推进。
38. **压力方向按周期确定性变化**：主叶方向由 `cycle` 派生的种子决定——同一周期内反复进出净化点得到同一形状，跨周期改变。次叶方向 = 主叶 + 0.6π + 0～0.4π 随机量，即两叶至少相隔 108°，不会重合成单一深凹。
39. **相位调制压力**：`crest` 相位两叶振幅 ×(1 + `PRESSURE_CREST_BONUS`)，`ebb` 相位 ×`PRESSURE_EBB_FACTOR`，`rise` 相位不调制。高潮期气泡被挤得更扁，退潮期回弹。
40. **安全区钳制（硬保证）**：五个交互点（CORE / STORAGE / 裂隙入口 / 防御点 / 改造祭坛，后两者由 `system-growth-tide` 引入）各自要求其所在角度上的半径不低于「该点到中心的距离 + `SAFE_MARGIN_TILES`」。约束以 ±30° 的余弦衰减摊进一张 360 格（每度一格）的最小半径查表，最终半径取「原始半径」与「该角度最小半径」的较大者。气泡可以被挤瘪，但挤不到任何交互点上。
41. **梯度带**：以归一化距离（1.0 = 恰在边界）划分三个带——`GRADIENT_INNER_START` 起开始压暗，`GRADIENT_MEMBRANE_START` 起进入膜（teal 能量带，亮度随该角度的压力升高），到 `GRADIENT_OUTER_END` 完全没入虚空。边界是一段渐变，不是一堵墙。
42. **地表纹理承担边界视觉**：程序化地表贴图按梯度带绘制暗角、膜带与压力染色；用于遮挡计算的 tile 图层设为不可见。玩家看到的边界是纹理，不是网格。
43. **碰撞是平滑环**：物理阻挡由沿 98% 半径采样 90 个角度、每处 2 层 8px 静态块构成的环提供，取代 tile 碰撞。曲线边界因此不产生方块状卡边。
44. **可见性沿气泡截断**：净化点的视野射线行进到归一化距离达 `GRADIENT_OUTER_END` 处截断（8px 步进后二分细化），而不是命中不透明 tile。视野遮罩只在纹理已经淡入虚空之后接管。
45. **呼吸是局部挤压，不是整体脉动**：边界呼吸表现为若干独立的短弧冲击，各自在不同角度、不同相位向内扫入，同时最多 5 个。世界模型是「外界污染在随机点试探力场」，不是气泡整体起伏。
46. **单次冲击的生命周期**：在膜外 14-30px 处生成，弧半宽 0.4-0.8 rad，在 1800-3500ms 内推进至膜面；透明度包络为前 15% 淡入、中段保持、后 30% 淡出。生成间隔 400-1200ms，`crest` 相位间隔 ×0.6。
47. **冲击角度分布**：按黄金角（约 137.5°）递推以避免聚簇；其中 30% 改落在压力主方向附近。压力主方向因此可被观察——那一侧被试探得更频繁。
48. **三层绘制**：(a) 向内推进的弧线（暗 teal，alpha 0.06-0.15）；(b) 进度 40% 后出现的虚空侵入暗楔形（alpha 0.25-0.60），表现为外部黑暗被压进受光区；(c) 膜线（alpha ≤ 0.22），受冲击处以余弦衰减向内变形最多 `DEFORM_MAX_PX`，最后 30% 进度附加接触辉光。
49. **呼吸层无玩法影响**：变形只作用于绘制，不改变半径查询的返回值，因此不影响碰撞、可见性、粒子生成与安全区保证。它是氛围，不是规则。
50. **视觉权重下限**：呼吸层与粒子层的 alpha 上限刻意压低（膜线 ≤ 0.22，粒子 ≤ 0.25）。边界应在余光中被察觉，不与交互点争夺注意力。

---

## 数值表

| 参数 | 值 | 范围 | 说明 |
| ---- | -- | ---- | ---- |
| `MODULE_INITIAL_HP` | 80 | 60-100 | 开局不满，暗示已有损伤 |
| `MODULE_MAX_HP` | 100 | -- | 修复上限 |
| `REPAIR_PER_KINDLING` | 10 | 5-15 | 1 薪柴=多少 hp |
| `BASE_IMPACT_DAMAGE` | 25 | 15-40 | 每次冲击的基础总伤害 |
| `INTENSITY_STEP` | 0.15 | 0.1-0.25 | 每次冲击后强度递增 |
| `MAX_INTENSITY` | 2.5 | 2.0-3.0 | 强度上限 |
| `THREAT_FOCUS_RATIO` | 0.65 | 0.55-0.75 | 重点目标承受的伤害比例 |
| `FORECAST_ACCURACY` | 0.80 | 0.7-0.9 | 粒子预告的准确率 |
| `MAX_CORE_REDUCTION` | 0.30 | 0.2-0.4 | CORE 满血时的混乱值减免 |
| `MAX_STORAGE_BONUS` | 0.50 | 0.3-0.7 | STORAGE 满血时的薪柴加成 |
| `APPARITION_INTERVAL_MIN` | 8000 | ms | 最短间隔 |
| `APPARITION_INTERVAL_MAX` | 15000 | ms | 最长间隔 |
| `APPARITION_DURATION` | 3000 | ms | 0.5s 淡入 + 2s 保持 + 0.5s 淡出 |
| `APPARITION_MAX_SIMULTANEOUS` | 3 | 1-4 | 同时存在的轮廓上限 |
| `PARTICLE_COUNT` | 50 | 30-70 | 边界常驻粒子数 |
| `PARTICLE_ALPHA_MIN/MAX` | 0.06 / 0.25 | -- | 粒子透明度区间（上限即视觉权重上限） |
| `PARTICLE_SPEED` | 8 | 5-15 | px/s，向内漂移基准速度（每颗 ×0.7-1.3） |

### 边界形态（`PURIFICATION.BOUNDARY`，Slice 4.5）

| 参数 | 值 | 范围 | 说明 |
| ---- | -- | ---- | ---- |
| `ELLIPSE_RX` | 5.2 tile | 4.5-6.0 | 基础椭圆长半轴（场景常量，不在 constants.ts） |
| `ELLIPSE_RY` | 5.0 tile | 4.5-6.0 | 基础椭圆短半轴 |
| `SHRINK_AT_MAX_INTENSITY` | 0.72 | 0.6-0.85 | intensity=3.0 时的整体缩放（收缩 28%） |
| `PRESSURE_PRIMARY_AMP` | 0.20 | 0.1-0.3 | 主压力叶最大向内压入比例 |
| `PRESSURE_SECONDARY_AMP` | 0.10 | 0.05-0.2 | 次叶振幅 |
| `PRESSURE_LOBE_SIGMA` | 0.7 rad | 0.4-1.0 | 每个高斯叶的角宽 |
| `PRESSURE_CREST_BONUS` | 0.4 | 0.2-0.6 | crest 相位的振幅加成 |
| `PRESSURE_EBB_FACTOR` | 0.6 | 0.4-0.8 | ebb 相位的振幅系数 |
| `SAFE_MARGIN_TILES` | 1.0 | 0.75-1.5 | 交互点到边界的最小距离 |
| 钳制摊开半角 | 30° | 20-45 | 安全区约束的余弦衰减范围（每度一格查表） |
| `GRADIENT_INNER_START` | 0.80 | 0.7-0.9 | 归一化距离，开始压暗 |
| `GRADIENT_MEMBRANE_START` | 0.95 | 0.9-0.98 | teal 膜带起点 |
| `GRADIENT_OUTER_END` | 1.15 | 1.05-1.3 | 完全虚空；同时是视野射线的截断阈值 |
| 碰撞环采样 | 90 角度 × 2 层 × 8px | -- | 沿 98% 半径铺设的静态块环 |

> `BOUNDARY.BREATH_BASE_ALPHA / BREATH_AMP / BREATH_FREQ / BREATH_CREST_FREQ_MULT / BREATH_EBB_AMP_MULT` 当前无任何消费方——它们描述的是被局部冲击模型取代的「整体脉动」旧方案，属待清理项，不构成设计规则。

### 边界呼吸（内联于 `boundary-breath.ts`，Slice 4.5）

| 参数 | 值 | 范围 | 说明 |
| ---- | -- | ---- | ---- |
| 并发冲击上限 | 5 | 3-8 | 超出时复用最早的槽位 |
| 弧半宽 | 0.4-0.8 rad | -- | 单次冲击的角度覆盖 |
| 生成距离 | 14-30 px | -- | 膜外起点，向内推进至膜面 |
| 单次时长 | 1800-3500 ms | -- | 越慢越像「持续挤压」 |
| 生成间隔 | 400-1200 ms | -- | crest 相位 ×0.6 |
| `DEFORM_MAX_PX` | 8 | 4-14 | 膜线向内变形峰值（仅绘制） |
| 弧线 alpha | 0.06-0.15 | -- | 暗 teal |
| 侵入楔 alpha | 0.25-0.60 | -- | 近黑色，进度 40% 后出现 |
| 膜线 alpha | 0.04-0.22 | -- | 上限即接触辉光峰值 |
| 环采样数 | 72 | -- | 膜线与弧线的角度分段 |

---

## 事件契约

已在 `events.ts` 中定义：

| 事件 | Payload | 生产者 | 消费者 |
| ---- | ------- | ------ | ------ |
| `IMPACT_STARTED` | `{ intensity }` | ImpactSystem | PurificationScene（演出） |
| `IMPACT_RESOLVED` | `{ moduleDamage: Record<string, number> }` | ImpactSystem | PurificationScene（结果面板） |
| `MODULE_DAMAGED` | `{ moduleId, newHealth }` | ImpactSystem | AllocationPanel（如果开着就更新显示） |
| `ALLOCATION_CONFIRMED` | `{ allocations: Record<string, number> }` | AllocationPanel | GameState（扣 reserve、加 hp） |
| `RIFT_EXITED` | `{ kindlingGained, survived }` | RunController (Slice 1) | PurificationScene（入账） |
| `RIFT_ENTERED` | `{ cycle }` | PurificationScene | ChaosSystem (reset) |

---

## 边界情况

| 情况 | 处理 |
| ---- | ---- |
| 死亡返回净化点 | kindlingGained=0，正常进入净化点，可分配之前的 reserve |
| reserve=0 且两模块 hp=0 | 不强制 game-over。玩家仍可出击，只是无任何加成（最难模式） |
| 分配面板打开时冲击不会触发 | 冲击仅在裂隙入口按 E 时触发，分配和冲击不冲突 |
| 分配超过 reserve | UI 不允许输入超过 reserve 的值 |
| 修复超过 maxHp | 多余部分不退回，clamp 到 maxHp（UI 应提前 clamp 可分配量） |
| cycle=0 跳过冲击 | 第一次出击是"教学局"，让玩家先体验基线难度 |
| 两个模块同时到 0 | 继续运行，不结束游戏。这是"最难但不是不可能"的状态 |
| 潮汐压缩后的原始半径小于交互点要求 | 安全区钳制接管，气泡在该角度被钉住。高 intensity 下形态由钳制主导而非椭圆主导 |
| 同一周期内反复进出净化点 | 形状完全相同（种子取自 cycle），玩家不会看到"边界莫名换了个样子" |
| 玩家试图走进膜带 | 碰撞环位于 98% 半径，玩家最多踩到膜带内侧（0.95-0.98），到不了 1.0 |
| 呼吸层变形与碰撞不一致 | 变形仅绘制。膜线可短暂画到玩家仍能站立的位置，属预期 |
| 冲击结果面板显示期间 | 粒子与呼吸层继续运行（场景 update 未暂停），玩家输入被禁用 |

---

## 对外接口

| 消费者 | 接口 | 形式 |
| ------ | ---- | ---- |
| RiftScene | `SortieModifiers { chaosRateModifier, kindlingValueModifier }` | scene data 传参 |
| ChaosSystem | `chaosRateModifier` | 乘在 BASE_RATE 上 |
| LootSystem | `kindlingValueModifier` | 乘在 node.value 上 |
| HUD / 结果面板 | `GameState.getKindlingReserve()` / `getModuleStates()` | 查询 |
| PurificationScene | `ImpactSystem.run(): ImpactResult` | 方法调用 |

### BoundaryShape 查询接口（Slice 4.5）

场景构建时创建一次，之后只读。所有角度以弧度计，0 = 右（+x），π/2 = 下（+y）。

| 接口 | 返回 | 说明 |
| ---- | ---- | ---- |
| `radiusAt(angle)` | px | 该角度上的最终半径（已含潮汐缩放、压力、安全区钳制） |
| `normalizedDist(x, y)` | 0-∞ | 归一化距离；1.0 = 恰在边界 |
| `isInside(x, y)` | bool | `normalizedDist <= 1.0` |
| `pressureDirection` | rad | 主压力叶方向 |
| `pressureAt(angle)` | 0～约 0.3 | 该角度被向内压入的比例 |
| `tideScale` | 0.72-1.0 | 本次潮汐缩放系数 |
| `centerX` / `centerY` | px | 气泡中心 |

### BoundaryShape 的六个消费方

半径语义一旦改动，必须同时检查以下全部六处——这是本 Slice 最容易再次漂移的地方。

| # | 消费方 | 用途 |
| - | ------ | ---- |
| 1 | tilemap 构建 | tile 中心落在 98% 半径内即 FLOOR；该图层不可见，仅供遮挡网格 |
| 2 | 程序化地表纹理 | 按梯度带做暗角、膜带与压力染色（软过渡替代硬墙） |
| 3 | blob 碰撞环 | 98% 半径 × 90 角度 × 2 层 8px 静态体 |
| 4 | VisibilitySystem | 射线距离覆写：行进到 `GRADIENT_OUTER_END` 截断，替代 tile DDA |
| 5 | BoundaryAtmosphere | 粒子与 apparition 的生成/消亡半径 |
| 6 | BoundaryBreath | 弧线、侵入楔、膜线的基准半径 |

边界系统不产生任何事件，也不写入 GameState：它是纯查询 + 纯绘制。

---

## 实现清单（对应 slice-2.md 的 T2-T9）

| 优先级 | 文件 | 负责 |
| ------ | ---- | ---- |
| T2 | `src/managers/game-state.ts` | code |
| T3 | `src/scenes/rift-scene.ts` + `purification-scene.ts`（场景切换） | code |
| T4 | `src/scenes/purification-scene.ts`（步行空间+tilemap） | code |
| T5 | `src/systems/boundary-atmosphere.ts`（粒子+apparition） | code |
| T6 | `src/entities/purification-module.ts`（模块实体+交互） | code |
| T7 | `src/ui/dom/allocation-panel.ts` | code |
| T8 | `src/systems/impact-system.ts` + 结果面板 | code |
| T9 | RiftScene 接收 modifiers、ChaosSystem/LootSystem 应用 | code |

### Slice 4.5 追加（动态边界，spec 事后补写）

本组无 Task Brief——Slice 4.5 由对话直接驱动实现，spec 于 2026-08-12 依代码补写。

| 文件 | 内容 |
| ---- | ---- |
| `src/systems/boundary-shape.ts` | 极坐标压力 blob 与全部半径查询 |
| `src/systems/boundary-breath.ts` | 局部冲击呼吸层（纯视觉，depth 10） |
| `src/systems/procedural-purification-surface.ts` | 梯度带地表纹理 |
| `src/systems/boundary-atmosphere.ts` | 粒子/apparition 改为跟随 blob 半径 |
| `src/scenes/purification-scene.ts` | 装配：tilemap、碰撞环、可见性射线覆写 |

---

## 校准问题（试玩时关注）

- [ ] **BASE_IMPACT_DAMAGE=25 是否让模块 hp 下降得太快/太慢？** 期望：3-4 次出击后如果不修复，至少一个模块到达 0。
- [ ] **REPAIR_PER_KINDLING=10 是否让修复太容易？** 期望：一次出击带回 3-5 薪柴（约 30-50 hp），恰好修复一个模块的一次冲击伤害，但不够修两个。
- [ ] **CORE -30% 减免是否可感知？** BASE_RATE=0.5，减免后 0.35。0→100 从 200s 变为 286s——多出 86s 是否足够让人"想保住 CORE"？
- [ ] **STORAGE +50% 是否改变决策？** 薪柴 1→1.5（取整=1），2→3，4→6。对 contested/deep 节点影响大，对 safe 节点影响小——是否让人倾向保 STORAGE？
- [ ] **预告准确率 80% 是否造成有趣的纠结？** 还是只是让人觉得被骗了？
- [ ] **两个模块都到 0 后是否真的"不可能但能继续"？** 还是玩家会觉得该重开了？
- [ ] **intensity 3.0 时的 28% 收缩是否可感知？** 玩家是在两次出击之间对比时才发现，还是根本注意不到？若注意不到，收缩就没有传达"压力在增加"。
- [ ] **高 intensity 下形状是否退化为花瓣状？** 安全区钳制以 ±30° 余弦摊开；当原始半径远小于交互点要求时，边界由五个钳制凸起主导，可能出现可见的尖角与凹谷。需要目视确认在 intensity 2.5-3.0 时形状是否仍像"被挤压的气泡"。
- [ ] **膜的局部变形（≤8px、alpha ≤0.22）是否被注意到？** 如果完全无感，选择是删掉还是提高权重——而不是留着当摆设。
- [ ] **两个方向信号是否互相干扰？** 压力主方向（呼吸偏向）与冲击预告方向（粒子密度）彼此独立、可指向不同侧，玩家是否会把它们混为同一个提示。
