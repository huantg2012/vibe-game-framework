---
status: ACTIVE
slice: 2
last-modified-date: 2026-08-07
interface-changed: false
interfaces-with:
  - system-chaos-scavenge-extract   # consumes RIFT_EXITED; feeds chaosRateModifier + kindlingValueModifier back
  - system-movement-vision          # purification scene reuses Player + VisibilitySystem (DEC-ARCH-008)
exposes:
  - GameState.getModuleEffect(type)
  - GameState.getKindlingReserve()
  - ImpactSystem.run()
  - AllocationPanel.open(moduleId)
---

# 系统设计：净化点 + 冲击

> **TL;DR**: 定义裂隙出击之外的"基地环"——净化点场景（可步行、边界氛围粒子、模块交互）、GameState（session-only 内存）、薪柴分配（修复模块 hp）、冲击系统（每次出击前扣模块 hp）、模块效果反馈到出击参数。验证"出击表现→冲击后果→出击条件变化"的连环压力。

## 概述

净化点是玩家在裂隙出击之间的唯一安全空间。它是一个被强行维持的稳定气泡——不大，不舒适，但足以让玩家喘息、分配资源、承受来自外界的冲击。

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
  type: 'BARRIER' | 'STORAGE';
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

1. **空间**：圆形安全区约 12x10 tiles，中心有微弱暖光。玩家可自由行走（复用 Player + VisibilitySystem omni 模式）。
2. **模块实体**：2 个可交互物体放在场景中——BARRIER（左侧）和 STORAGE（右侧）。玩家走近（32px 内）时显示交互提示"按 E 分配薪柴"。
3. **裂隙入口**：场景中央偏上，一个脉冲的 teal 标记。走近显示"按 E 进入裂隙"。按 E 触发冲击→切换场景。
4. **边界**：安全区外是黑暗虚空。边界处有粒子系统——灰色微粒缓慢向内飘动（暗示外界压力），密度约 20-30 个活跃粒子。
5. **Apparition**：每 8-15 秒（随机），边界外 40-80px 处出现一个模糊人形轮廓（alpha 0→0.3 淡入 0.5s → 持续 2s → 0.3→0 淡出 0.5s）。不移动，位置随机，颜色为暗灰。纯氛围，无游戏功能。
6. **视觉基调**：地面为暖灰/米色（对比裂隙的冷橄榄灰），ambient 光比裂隙更亮（RADIUS_AMBIENT 可以更大或使用 omni 模式全亮）。
7. **冲击预告**：进入裂隙前，边界粒子在某个方向（下次冲击重点方向）密度增加 2-3 倍。这是一个不完全可靠的信号（80% 准确率），帮助玩家判断"哪个模块可能被打"。

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
    - 显示结果面板 2 秒（"冲击！BARRIER -18 hp / STORAGE -9 hp"）
    - 结果面板关闭后切换到裂隙场景
24. **hp 下限**：模块 hp 最低为 0，不进负数。
25. **冲击预告准确率**：粒子密集方向与实际重点目标相符的概率 = `FORECAST_ACCURACY`（0.8）。20% 的时候会"骗人"。

### M — 模块效果

26. **BARRIER 效果**：提供混乱值 BASE_RATE 减免。公式：`chaosRateModifier = 1.0 - (barrierHp / 100) * MAX_BARRIER_REDUCTION`。`MAX_BARRIER_REDUCTION = 0.3`（满血 hp=100 时 -30% 混乱值增速）。hp=0 时无减免。
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
| `MAX_BARRIER_REDUCTION` | 0.30 | 0.2-0.4 | BARRIER 满血时的混乱值减免 |
| `MAX_STORAGE_BONUS` | 0.50 | 0.3-0.7 | STORAGE 满血时的薪柴加成 |
| `APPARITION_INTERVAL_MIN` | 8000 | ms | 最短间隔 |
| `APPARITION_INTERVAL_MAX` | 15000 | ms | 最长间隔 |
| `PARTICLE_COUNT` | 25 | 15-40 | 边界活跃粒子数 |

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

---

## 对外接口

| 消费者 | 接口 | 形式 |
| ------ | ---- | ---- |
| RiftScene | `SortieModifiers { chaosRateModifier, kindlingValueModifier }` | scene data 传参 |
| ChaosSystem | `chaosRateModifier` | 乘在 BASE_RATE 上 |
| LootSystem | `kindlingValueModifier` | 乘在 node.value 上 |
| HUD / 结果面板 | `GameState.getKindlingReserve()` / `getModuleStates()` | 查询 |
| PurificationScene | `ImpactSystem.run(): ImpactResult` | 方法调用 |

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

---

## 校准问题（试玩时关注）

- [ ] **BASE_IMPACT_DAMAGE=25 是否让模块 hp 下降得太快/太慢？** 期望：3-4 次出击后如果不修复，至少一个模块到达 0。
- [ ] **REPAIR_PER_KINDLING=10 是否让修复太容易？** 期望：一次出击带回 3-5 薪柴（约 30-50 hp），恰好修复一个模块的一次冲击伤害，但不够修两个。
- [ ] **BARRIER -30% 减免是否可感知？** BASE_RATE=0.5，减免后 0.35。0→100 从 200s 变为 286s——多出 86s 是否足够让人"想保住 BARRIER"？
- [ ] **STORAGE +50% 是否改变决策？** 薪柴 1→1.5（取整=1），2→3，4→6。对 contested/deep 节点影响大，对 safe 节点影响小——是否让人倾向保 STORAGE？
- [ ] **预告准确率 80% 是否造成有趣的纠结？** 还是只是让人觉得被骗了？
- [ ] **两个模块都到 0 后是否真的"不可能但能继续"？** 还是玩家会觉得该重开了？
