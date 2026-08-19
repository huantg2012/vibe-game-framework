---
status: ACTIVE
slice: 2 (extended in 4.5, 5, 5.5, 7)
last-modified-by: art agent
last-modified-date: 2026-08-19
interface-changed: true
interfaces-with:
  - system-chaos-scavenge-extract   # consumes RIFT_EXITED; feeds chaosRateModifier + kindlingValueModifier
                                    # + startingChaos (Slice 7 净化器完整度写入出击初值)
  - system-movement-vision          # purification scene reuses Player + VisibilitySystem (DEC-ARCH-008)
  - system-growth-tide              # tide intensity/phase drives impact intensity + boundary shape; contaminant
                                    # defense slots feed the defense phase (slot count is growth-owned, not fixed);
                                    # growth_forecast_clarity sharpens the forecast; SaveManager persists both sides;
                                    # 加厚不是蜕变项（不进 upgrades.csv / 蜕变六卡）
exposes:
  - GameState.getModuleEffect(type) / getSortieModifiers()
  - GameState.getStartingChaos()
  - GameState.getModuleMaxHpTier() / canRaiseModuleMaxHp() / raiseModuleMaxHp()
  - GameState.getKindlingReserve() / healModule(id, amount)
  - GameState.isModuleSwapActive() / setModuleSwapActive(active)
  - ImpactSystem.run(defenseSlots) -> ImpactResult （含 defenseResult；Slice 5.5 增 primaryModuleId / trueSeverity / baseDamagePerModule）
  - ImpactSystem.generateForecast(nextIntensity, forecastReliabilityBonus) / getForecastDisplay() / getForecastLookahead() -> ForecastDisplay
  - applyDefenseEffects(baseDamage, slots, context) -> DefenseResult
    （Slice 5 新增出口 healOut / bonusCharges / toolUseGrants / moduleSwapTriggered；
     Slice 5.5 新增 slotDisclosures 供结算面板逐槽归因）
  - getDefenseRuntimeState() / loadDefenseRuntimeState(state) / ContaminantRuntimeState
  - AllocationPanel.open(moduleId)
  - BoundaryShape.radiusAt(angle) / normalizedDist(x,y) / isInside(x,y)
  - BoundaryShape.pressureDirection / pressureAt(angle) / tideScale
  - BoundaryBreath.create() / update() （纯视觉叠加层，无玩法输出）
---

# 系统设计：净化点 + 冲击

> **TL;DR**: 定义裂隙出击之外的"基地环"——净化点场景（可步行、潮汐驱动的动态力场边界、七个交互点）、GameState（内存 + `SaveManager` 持久化）、薪柴分配（修复模块 hp）、冲击结算（返回净化点时按潮汐强度扣模块 hp，经防御槽污染物修正）、非空间冲击预告（目标模块 + 强度档位）、三模块效果反馈到出击参数（核心减混乱增速、储藏加薪柴价值、净化器写起始混乱）、祭坛旁加厚全局抬模块 maxHp。边界形状由 BoundaryShape 统一提供，被地表纹理、碰撞、可见性、氛围与呼吸层共用。

> **Slice 5 变更摘要**（细则见 D/V 组）：预告去掉方向、只报目标+档位（DEC-034）；防御侧 6 处未接线机制全部落地（DEC-029~033）；污染物运行时状态进存档（DEC-032）；模块受损三态视觉阈值登记（DEC-035）；防御槽位数不再固定 3。

> **Slice 7 变更摘要**（DEC-064）：第三模块 = 净化器（完整度 → 出击起始混乱；满完整度起始 0；不改出击起始生命）。祭坛旁加厚：花薪柴全局抬全部模块 `maxHp`，3 档每档 +15（100→115→130→145），效果公式分母仍是基准 100。`abyss` 65% 与 `stitch` 三模块文案随第三承血模块落地成立。

## 概述

净化点是玩家在裂隙出击之间的唯一安全空间。它是一个被强行维持的稳定气泡——不大，不舒适，但足以让玩家喘息、分配资源、承受来自外界的冲击。

气泡不是圆的，也不是固定的。外界污染不均匀地挤压它：潮汐强度决定整体被压缩多少，方向性压力决定哪一侧被压得更狠。唯一的硬保证是它挤不到交互点上——否则净化点会先于玩家失效。

核心循环：出击获得薪柴 → 返回净化点，冲击立刻结算（防御槽的污染物在此吃下伤害并被推向转化）→ 看着受损的模块分配薪柴、调整防御槽与出击装配 → 模块状态影响下次出击条件 → 再次出击。

玩家是**带着已经发生的损失**开始每一轮决策的，不是先决策再挨打——这让"该修哪个模块"变成对已知损失的应对，而不是对未知威胁的下注。对未知的下注由冲击预告承担（规则 7）。

---

## 状态模型

```typescript
interface GameState {
  kindlingReserve: number;
  modules: ModuleState[];
  moduleMaxHpTier: 0 | 1 | 2 | 3; // 已买加厚档数；存档必记（规则 64）
  cycle: number;
  impactIntensity: number;        // 由 TideSystem 同步写入，不自增（规则 12）
  pendingSideEffects: PendingSideEffect[];  // 防御副作用，出击开局消费
  repairEfficiencyMult: number;   // siphon 的修复倍率（⚠ 见规则 15 的未接线标注）
  upgradeDiscount: number;        // retrograde / overwrite 的改造折扣
  moduleSwapActive: boolean;      // overwrite 的模块功能互换是否生效（规则 55）
}

interface ModuleState {
  id: string;
  type: 'CORE' | 'STORAGE' | 'PURIFIER';
  hp: number;
  maxHp: number;
}

interface ImpactResult {
  damages: { moduleId: string; damage: number; newHp: number }[];
  intensity: number;
  skipped: boolean;               // cycle=0 的首次豁免
  defenseResult?: DefenseResult;  // 无防御槽占用时缺省
  // Slice 5.5 C5：结算面板披露用（预告 vs 实际对照）
  primaryModuleId?: string;
  trueSeverity?: 'light' | 'moderate' | 'heavy' | 'extreme';
  baseDamagePerModule?: Record<string, number>;
}

/** 冲击预告的玩家可见值（DEC-034）。可能与 ground truth 不同——见规则 7 / 25。 */
interface ForecastDisplay {
  targetId: string;
  severity: 'light' | 'moderate' | 'heavy' | 'extreme';
}

/** 防御结算的输出。Slice 5 新增后四项（DEC-037）；Slice 5.5 新增 slotDisclosures（DEC-045 D5）。 */
interface DefenseResult {
  finalDamagePerModule: Record<string, number>;
  sideEffects: PendingSideEffect[];
  kindlingGain: number;
  stabilityChange: number;
  scatterRedistributed: boolean;
  stitchEqualization: Record<string, number>;
  forecastCorrect: boolean;       // 用 ground truth 判定，不用显示值（规则 25）
  upgradeDiscount: number;
  repairEfficiencyMult: number;
  healOut: Record<string, number>;        // combust 焚尽返还
  bonusCharges: Record<string, number>;   // erode / resonate 跨槽冲击计数
  toolUseGrants: number;                  // echo 的工具次数 +1
  moduleSwapTriggered: boolean;           // overwrite 的模块功能互换
  /** Slice 5.5：逐槽归因，供冲击结算面板披露「谁挡了多少 / 谁触发了什么」 */
  slotDisclosures: SlotDisclosure[];
}

/** 单槽在一次冲击中的可披露贡献（Slice 5.5）。减伤链用精确 telescoping 分解，非估算。 */
interface SlotDisclosure {
  contaminantId: string;
  type: ContaminantType;
  damageReductionPct: number;
  damageBlocked: number;
  // 以下字段按类型选填：副作用文案键、薪柴返还、稳定度变化、治疗量/目标、
  // 是否无效化、是否均衡、是否给工具次数、是否触发模块互换、改造折扣增量等
}

/** 跨冲击持久的污染物运行时状态，按 contaminant id 索引（DEC-032）。 */
interface ContaminantRuntimeState {
  solidifyCounter?: number;       // solidify 距上次碎裂的冲击数
  combustAccumulator?: number;    // combust 的焚尽累加值
  echoBonusGranted?: number;      // echo 已给该工具的次数（上限 2）
}

interface SortieModifiers {
  chaosRateModifier: number;
  kindlingValueModifier: number;
  startingChaos: number;          // Slice 7：净化器完整度写入；踏入时一次性交给 ChaosSystem
}
```

---

## 规则

### P — 净化点场景

1. **空间**：椭圆形安全区，基础半径 5.2 × 5.0 tile，置于 14x12 的场景网格中心。实际可行走范围随潮汐强度收缩、随压力方向变形（见 B 组）。玩家可自由行走（复用 Player + VisibilitySystem omni 模式）。
2. **七个交互点**：场景中有七个交互点，都以 `INTERACTION_RADIUS`（32px）判定走近，走近后按 E 触发：

    | 交互点 | 位置（相对中心） | 载体 | 按 E 的结果 |
    | ------ | ---------------- | ---- | ----------- |
    | CORE | 正中心 | `PurificationModuleEntity`（带 hp 与三态视觉，V 组） | 打开分配面板（A 组） |
    | STORAGE | 右 3.5 tile | 同上 | 打开分配面板 |
    | PURIFIER | 下 3.5 tile | 同上（第三模块；几何/色由 art 只引用已锁板） | 打开分配面板 |
    | 裂隙入口 | 上 3.5 tile | 程序化呼吸圆点 | 打开出击装配面板，确认后出击（F 组） |
    | 防御点 | 左 3 tile / 下 2.5 tile | 程序化呼吸圆点 | 打开防御槽面板（`system-growth-tide` CN 组） |
    | 改造祭坛 | 左 3.5 tile | 程序化呼吸圆点 | 打开改造面板（`system-growth-tide` G 组） |
    | 加厚 | 改造祭坛北 2.2 tile（同西轴，祭坛旁） | 世界内装置读数桩（**不是**第四个模块实体，不套蜕变墙机） | 花薪柴把**全部**模块 `maxHp` 抬一档（U 组） |

   同一时刻只对**最近的**可交互点显示提示条；优先级顺序为 CORE → STORAGE → PURIFIER → 防御点 → 改造祭坛 → 加厚 → 裂隙入口。任一面板打开期间提示条隐藏且 E 不再响应。七点同时是边界安全区钳制的约束源（规则 40）。加厚与祭坛的间距必须大于 `2 × INTERACTION_RADIUS`，避免两套 E 抢占。
3. **交互点的呼吸节奏**：四个非模块交互点（裂隙入口 / 防御点 / 改造祭坛 / 加厚）用同一个绘制函数（同心圆 + 呼吸缩放），只有色相不同。呼吸速度有三档：常态 / 玩家靠近 / **待处理高亮**（如有未装配的新工具、可刻入的改造、下一档加厚费用不超过当前薪柴）。高亮是"这里有事要做"的提示，不是装饰。裂隙入口永不高亮——它始终可用，高亮会变成噪音。加厚在「下一档费用 ≤ 当前薪柴」时高亮；三档加尽后不再高亮。
4. **边界**：安全区外是虚空，但边界本身不是硬边——从内向外依次是变暗带、teal 膜带、虚空（梯度带定义见 B 组）。边界处有粒子系统：微粒在当前边界外 10-40px 处生成，缓慢向内漂移，越过该角度半径的 50% 或寿命耗尽后重新生成，常驻 `PARTICLE_COUNT` 个。颜色以暗 teal 为主（60%），亮 teal 与灰各占 20%。生成与消亡半径跟随当前边界形状，不是固定圆。
5. **Apparition**：每 8-15 秒（随机），在当前边界外 40-80px 处出现一个模糊人形轮廓（alpha 0→0.3 淡入 0.5s → 持续 2s → 0.3→0 淡出 0.5s）。不移动，角度随机，生成距离以该角度的边界半径为基准，最多同时 3 个，颜色为暗青灰。纯氛围，无游戏功能。
6. **视觉基调**：地面为冷蓝灰的程序化石板（中心略暖、向边缘转冷并逐级压暗），ambient 使用 omni 模式；玩家的肩灯是场景中唯一的暖色。
7. **冲击预告是非空间的**（DEC-034，改写自旧的"粒子密度指向预告方向"）：预告只播报两件事——**下次冲击的重点目标模块** 与 **强度档位**（light / moderate / heavy / extreme 四档）。它不给方向。
    - **HUD 展示**（Slice 5.5 DEC-048 贴顶横槽，只改展示、不改结算/数值）：净化点常驻 HUD 用文字写明，三个独立可见节点——时机 `下次归来`、目标全称 `核心` / `储藏` / `净化器`（对应 CORE / STORAGE / PURIFIER；与底栏 / 结算已上屏用词一致）、档位中文读 `ImpactSystem` 导出的 `SEVERITY_LABEL`（light→轻微 / moderate→中等 / heavy→剧烈 / extreme→极端）。HUD **必须 import 这一份标签**，禁止另造「轻/中/重」平行表。常驻 HUD 不画 ◈/▣ 与 4 格 pip。
    - **消声淡预告**（仅 `getForecastLookahead()` 非空）：同样三节点，但时机词必须是 `再下一轮`（不得再用 `下次归来`，以免读成第二份现在）。目标名与档位名同一套。可更淡、无临界脉动，文字节点不得省略。
    - **为什么不给方向**：旧实现把 CORE 映射为"左"、STORAGE 映射为"右"，而 CORE 就在场地正中心——"左"是任选的，玩家无法据此做任何决策；同时它与边界压力主方向（规则 37/42/47）叠成两个互不相关的方向暗示。
    - **方向暗示的唯一合法来源是 BoundaryShape 的压力可视化**。那是全系统唯一有真实空间语义的方向源。预告不再与它争夺同一维度。
    - 预告在**每次进入净化点时**（无论是从裂隙返回还是从菜单/读档进入）重算一次，用的是"下次冲击将要使用的强度"（即当前潮汐强度，在本次访问的 `advanceCycle()` 之后读取）。
    - 档位分界按潮汐强度区间 [1.0, 3.0] 四等分：< 1.5 light / < 2.0 moderate / < 2.5 heavy / 其余 extreme。extreme 档的临界脉动（300ms）可留作第二编码，不能代替可见词「极端」。边界粒子恢复各角度均匀生成，不再做方向暗示。

### G — GameState

8. **初始状态**：`kindlingReserve = 0`，`cycle = 0`，`impactIntensity = 1.0`，`moduleMaxHpTier = 0`，三个模块（CORE / STORAGE / PURIFIER）各自 `hp = MODULE_INITIAL_HP = 70`，`maxHp = MODULE_BASE_MAX_HP = 100`。老存档缺 PURIFIER 或缺 `moduleMaxHpTier` 时：补第三个模块为 `70 / 当前档位 maxHp`，档位缺省 0；不得把老档判损坏。
9. **内存单例 + 持久化**：GameState 是模块级单例（DEC-ARCH-002），跨场景存活。它同时被 `SaveManager` 持久化到 localStorage——存档写入点为「进入净化点时」与「出击前」两处，读档由主菜单驱动。落存档的字段见状态模型；污染物运行时状态走同一通道（规则 60）。
10. **薪柴入账**：从裂隙返回时（`RIFT_EXITED.survived === true`），`kindlingReserve += kindlingGained`。死亡时 `kindlingGained = 0`，不入账。
11. **周期计数**：每次进入裂隙时 `cycle++`。
12. **冲击强度由潮汐驱动，不自增**：`impactIntensity` 不再逐周期 +0.15。每次从裂隙返回、结算冲击之前，由场景层把 `tideSystem.getCurrentIntensity()` 同步写入 GameState，冲击读这个值。强度的涨退规则归 `system-growth-tide` 的 T 组（`INTENSITY_STEP` / `MAX_INTENSITY` 两个旧常量已从 `constants.ts` 移除）。
    - ⚠ 代码残留：`GameState.incrementIntensity()` 仍带着旧的 +0.15/上限 3.0 逻辑，并仍在每次冲击末尾被调用。它的结果总会在下次返回时被潮汐同步覆盖，所以对玩法无影响；但两次访问之间 `getImpactIntensity()` 会返回一个偏高的过期值。属待清理项，不构成设计规则。

### A — 分配系统

13. **触发**：玩家走到模块交互点按 E → 打开 DOM overlay 分配面板。
14. **面板内容**：显示当前 `kindlingReserve`、目标模块 `hp/maxHp`、滑块或 +/- 按钮选择分配数量。效果预览按模块类型分开展示表名与数值：核心 = 表名 `混乱增速` + 减免百分数；储藏 = 表名 `薪柴价值` + 倍率；净化器 = 表名 `起始混乱` + 整数（当前 → 注入后）。机会成本列出**其余两个**模块的完整度（各带模块名限定），禁止再写成「另一模块」。
15. **修复公式**：每 1 薪柴 = `REPAIR_PER_KINDLING` hp（= 4，为稀缺感调低）。不能超过 maxHp；面板提前 clamp 可分配量为 `ceil((maxHp - hp) / REPAIR_PER_KINDLING)`。
    - ⚠ 未接线：`siphon` 的防御主效果"装备期间修复效率翻倍（1 薪柴 = 8hp）"通过 `GameState.setRepairEfficiencyMult(2.0)` 写入，但 `allocateToModule()` 从未读取它。该效果目前不发生。属需要接线的缺口，不是设计变更。
16. **确认**：点击确认 → 扣除 reserve → 增加 hp → emit `ALLOCATION_CONFIRMED { allocations: { [moduleId]: kindlingSpent } }` → 关闭面板。
17. **取消**：点击取消或按 ESC → 关闭面板，不扣资源。
18. **非强制**：玩家可以选择不分配任何薪柴就直接进入裂隙（风险策略）。

### I — 冲击系统

19. **触发时机是"返回净化点的那一刻"**，不是"按 E 出击之前"。玩家从裂隙回来、净化点场景 `create()` 时按序执行：潮汐强度同步 → 污染物冲击计数（可能触发转化）→ 冲击结算 → 潮汐推进 → 预告重算 → 存档。从菜单/读档进入净化点不触发冲击。
    - 设计后果：玩家是**带着冲击的结果**开始这一轮的分配与装配决策，而不是分配完再挨打。整个驻留期间看到的模块 hp 就是出击时的 hp。
20. **首次豁免**：`cycle === 0` 时跳过冲击（返回 `skipped: true`）。第一次出击是"教学局"。
21. **基础伤害**：`BASE_IMPACT_DAMAGE`（= 30）× `impactIntensity`。
22. **威胁分布**：一个模块为"重点目标"，承受 `THREAT_FOCUS_RATIO`（65%）伤害；**其余伤害在其他全部承血模块之间均分**（两模块时另一个拿 35%；三模块时另外两个各 17.5%，四舍五入后用最后一个模块吃残差，保证总和等于本次总伤害）。预告从**全部**承血模块中均匀抽 ground-truth 目标。冲击结算时以 `FORECAST_ACCURACY`（0.8）的概率让实际重点目标等于它，0.2 概率在**其余模块**中均匀抽一个（见规则 25）。禁止再写死 `modules[0]` / `modules[1]`。
23. **冲击演出**（在净化点场景 create 阶段，玩家输入被禁用）：
    - emit `IMPACT_STARTED { intensity }`
    - 计算并应用伤害（防御结算见 D 组）
    - 每个受损模块 emit `MODULE_DAMAGED { moduleId, newHealth }`
    - emit `IMPACT_RESOLVED { moduleDamage: { [id]: damage } }`
    - 画面震动 300ms + 结果面板：逐模块伤害、强度、**逐槽防御归因**（规则 23a）
    - 结果面板**由玩家关闭**（不自动 2 秒消失；Enter / Esc 合上）→ 恢复玩家输入。潮汐/稳定度里程碑并入本面板（规则 23b），不另开阻断窗。新工具可用走通道 B toast。
23a. **必须披露（Slice 5.5）**：每槽减伤实绩、副作用来源、经济返还、稳定度变化、转化事件、预告命中与否。接口：`ImpactResult` 含 `defenseResult.slotDisclosures`、`primaryModuleId` / `trueSeverity` / `baseDamagePerModule`。缺一项即结算不合格。
23b. **一次归来一条阻断**：潮汐相位与稳定度里程碑并入冲击结算。进行中同时只 1 条需按键消解的确认。
24. **hp 下限**：模块 hp 最低为 0，不进负数；`applyDamage()` 返回实际造成的伤害（用于 D 组的承伤类结算）。
25. **两个"准确率"必须分开看**（DEC-034）：
    - **ground truth 层**：预告在生成时先随机挑一个模块作为预测目标（`forecastTargetId`）。冲击结算时以 `FORECAST_ACCURACY`（0.8）的概率让实际重点目标等于它。`retrograde` 的"预判命中"（`forecastCorrect`）判定用的是**这个 ground-truth 值**与实际重点目标的比较，**不是玩家看到的显示值**——所以 `mirror` 谎报不会影响 `retrograde` 的收益。
    - **显示层**：玩家看到的 `ForecastDisplay` 可能与 ground truth 不同，有两条独立的失真通道：`mirror` 谎报目标模块与基线档位模糊，二者都在规则 52。
    - 玩家实际感知到的"预告说对了吗"= 0.8 × (1 − 谎报概率)，再叠加档位是否被模糊。

### M — 模块效果

26. **CORE 效果**：提供混乱值 BASE_RATE 减免。公式：`chaosRateModifier = 1.0 - (min(coreHp, MODULE_EFFECT_HP_REF) / MODULE_EFFECT_HP_REF) * MAX_CORE_REDUCTION`。`MODULE_EFFECT_HP_REF = 100`，`MAX_CORE_REDUCTION = 0.3`（hp≥100 时 -30% 混乱值增速，再高的 hp 不额外减）。hp=0 时无减免。
27. **STORAGE 效果**：提供薪柴拾取价值加成。公式：`kindlingValueModifier = 1.0 + (min(storageHp, MODULE_EFFECT_HP_REF) / MODULE_EFFECT_HP_REF) * MAX_STORAGE_BONUS`。`MAX_STORAGE_BONUS = 0.5`（hp≥100 时 +50% 每次拾取价值，再高的 hp 不额外加）。hp=0 时无加成。
27a. **效果分母锁死基准 100（Slice 7，DEC-064）**：加厚只抬 `maxHp` 血池，**不抬效果上限**。分母永远是 `MODULE_EFFECT_HP_REF = 100`，分子 `min(hp, 100)`。若现实现是 `hp/100` 且未封顶，加厚后必须改成这条，禁止变成 `hp/maxHp`（那会在没灌满时偷偷削弱效果），也禁止把分母改成新 maxHp 或让 hp>100 继续加效果。
27b. **PURIFIER 效果（Slice 7）**：不改混乱增速、不改薪柴价值。只写入出击起始混乱：

    ```
    integrity = clamp(purifier.hp / purifier.maxHp, 0, 1)
    startingChaos = round(CHAOS_HARD_START * (1 - integrity))
    ```

    `CHAOS_HARD_START = 50`。满完整度（hp = maxHp）→ 起始混乱 = 0。hp = 0 → 起始混乱 = 50。开局 70/100 → 15。这是**比例**（对当前 maxHp），不是对基准 100——加厚后必须灌满血池，起始混乱才会回到 0。
    `GameState.getStartingChaos()` 是该值的**唯一入口**。`overwrite` 互换（规则 55）只改 CORE↔STORAGE 的效果源 hp，**不**抽换净化器。防御残留 `initial_chaos` 在该值之上加算（规则 31a），不改本公式。
27c. **不改出击起始生命**：玩家那条完整度（`growth_vitality` 等）的出击初值本 Slice 不动。净化器不读写玩家完整度。
28. **效果计算时机**：在场景切换到裂隙前计算一次，作为 `SortieModifiers` 传递给 RiftScene。`GameState.getModuleEffect(type)` 仍是 CORE/STORAGE 效果的**唯一入口**——`overwrite` 的互换（规则 55）与 `resonate` 的上限提升（规则 59）都必须改在这里，不允许在消费方各自修正。PURIFIER 不走 `getModuleEffect`；走 `getStartingChaos()`。`getSortieModifiers()` 必须带上 `startingChaos`。
29. **裂隙侧应用**：
    - ChaosSystem 的实际 rate = `BASE_RATE * chaosRateModifier`（在现有 rateMultiplier 之前相乘）
    - LootSystem 的实际 pickup value = `nodeValue * kindlingValueModifier`（向下取整，最低 1）
    - ChaosSystem 开局 `value` = `SortieModifiers.startingChaos` 再叠加防御残留（规则 31a）。**不改**基础上涨曲线、阈值、惩罚映射。

### F — 场景切换

30. **裂隙→净化点**：`RIFT_EXITED` → RunController 延迟 600ms → `scene.start('PurificationScene', { kindlingGained, survived })`。进入后立即结算冲击（规则 19）。
31. **净化点→裂隙**：玩家在裂隙入口按 E → 打开出击装配面板 → 确认 → `cycle++` → 读取 `getSortieModifiers()`（此时 `moduleSwapActive` 已生效，规则 55；`startingChaos` 已按规则 27b 算好）→ 存档 → emit `RIFT_ENTERED { cycle }` → 0.3s 边缘内收辉光 + 0.5s 文字过场 → `scene.start('RiftScene', { modifiers, cycle, loadout })`。取消装配面板则留在净化点。
31a. **出击初值合成**：RiftScene 创建 ChaosSystem 时一次写入

    ```
    value0 = clamp(modifiers.startingChaos + Σ initial_chaos, 0, CHAOS.HARD_CAP)
    ```

    `initial_chaos` 仍走既有防御残留（combust +10、scatter +3 等），用 `addImmediate` 之前先把净化器部分写进初值，或把两笔合成后再 set——**禁止**开局拆成两次「穿越阈值」闪白。若 `value0` 已越过某阈，该阈视为已触发（不播跨阈演出），只对之后继续涨过的更高阈闪。增长曲线本 Slice 不改。
32. **RiftScene 接收 modifiers**：在 `create()` 中读取 `this.scene.settings.data`，应用 `chaosRateModifier`、`kindlingValueModifier`、`startingChaos` 到对应系统。
33. **死亡时**：`RIFT_EXITED { survived: false }` → 同样切换到净化点，但 kindlingGained=0（已在 Slice 1 RunController 中实现）。

### B — 边界形态与呼吸（Slice 4.5）

34. **边界是一条极坐标曲线**：净化点边界为一条闭合的极坐标曲线（力场气泡）。基础形状是椭圆（`ELLIPSE_RX` × `ELLIPSE_RY`）。任意角度上的最终半径由三层修正依次得到：潮汐缩放 → 方向性压力 → 安全区钳制。
35. **每次场景构建计算一次**：边界形状在进入净化点时依当前潮汐状态与周期数计算一次，此后是无状态的廉价查询对象，不随帧变化。形态的变化发生在两次出击之间，不发生在一次驻留之内。
36. **潮汐缩放**：设 `t = clamp01((intensity - 1.0) / 2.0)`，整体半径乘以 `1 - t * (1 - SHRINK_AT_MAX_INTENSITY)`。intensity=1.0 时为基础尺寸，intensity=3.0 时整体收缩 28%。intensity 的定义与推进归 `system-growth-tide` 的 T 组。
37. **方向性压力叶**：两个高斯叶沿角度分布，把半径按比例向内压——半径乘以 `1 - pressure(angle)`。主叶振幅 `PRESSURE_PRIMARY_AMP`，次叶 `PRESSURE_SECONDARY_AMP`，角宽均为 `PRESSURE_LOBE_SIGMA`。压力不均匀：外界污染不从各个方向等量推进。
38. **压力方向按周期确定性变化**：主叶方向由 `cycle` 派生的种子决定——同一周期内反复进出净化点得到同一形状，跨周期改变。次叶方向 = 主叶 + 0.6π + 0～0.4π 随机量，即两叶至少相隔 108°，不会重合成单一深凹。
39. **相位调制压力**：`crest` 相位两叶振幅 ×(1 + `PRESSURE_CREST_BONUS`)，`ebb` 相位 ×`PRESSURE_EBB_FACTOR`，`rise` 相位不调制。高潮期气泡被挤得更扁，退潮期回弹。
40. **安全区钳制（硬保证）**：七个交互点（CORE / STORAGE / PURIFIER / 裂隙入口 / 防御点 / 改造祭坛 / 加厚。防御点与改造祭坛由 `system-growth-tide` 引入，加厚归本 spec U 组）各自要求其所在角度上的半径不低于「该点到中心的距离 + `SAFE_MARGIN_TILES`」。约束以 ±30° 的余弦衰减摊进一张 360 格（每度一格）的最小半径查表，最终半径取「原始半径」与「该角度最小半径」的较大者。气泡可以被挤瘪，但挤不到任何交互点上。
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

### D — 防御结算（Slice 5）

防御槽里的污染物在冲击结算时修正伤害并产生额外出口。槽位内容与生命周期归 `system-growth-tide` 的 CN 组；下列规则只管"冲击这一刻发生了什么"。每种污染物的文案与基础减伤值来自 `data/contaminants.csv`（策划数据源，规则见 CLAUDE.md）。

51. **减伤叠加与结算顺序**：所有 `stage === 'defense'` 的槽位各自给出一个减伤比例，按**乘法**叠加（`totalReductionMult *= (1 - r)`），不是加法。之后按以下顺序落地，顺序不可交换：
    1. `expand` 完全无效化命中 → 所有模块伤害归 0（跳过后续减伤）
    2. 否则 `scatter` 生效 → 总伤害 × `totalReductionMult` 后在所有模块间均分
    3. 否则 → 每个模块各自的伤害 × `totalReductionMult`（四舍五入）
    4. `abyss` 的额外伤害（规则 53）叠加在上面，**不吃减伤**
    5. `stitch` 均衡量以"模拟扣血后的 hp"算出（向均值转移差值的 20%），在伤害真正应用之后执行
    6. `combust` 累积（规则 54）与 `mirror` 返还（规则 58）都用**本次实际承伤**，因此排在伤害确定之后

52. **预告失真的两条通道**（DEC-034）。两者都只作用于**显示值**，ground truth 永不被污染（规则 25）：
    - **`mirror` 谎报目标模块**：仅当 `mirror` 当前占着防御槽时生效，概率 10%，命中则把显示的目标模块换成**其余承血模块中均匀抽一个**（三模块时不是只在核心/储藏之间跳）。这是 `mirror` 的"误导"副作用在 DEC-034 之后的新形态——旧形态是"预告方向镜像反转"，随方向一起废除。
    - **基线档位模糊**：与 `mirror` 无关，永远存在。概率 20%，命中则把显示档位沿 light→extreme 序列上下移一格（各 50%），到两端则钳制。
    - **`growth_forecast_clarity`**（改造，3 级，每级 +5%）：同一个可靠度加成同时从上面两个概率里减去。谎报概率可减到 0；档位模糊概率有 5% 的地板——预告永远不会变成完全精确的仪表。

53. **`abyss` 动态减伤**（DEC-029）：基础减伤 20%，**每有一个模块 hp 低于其 maxHp 的 50%** 则额外 +15%，上限 65%。低血判定用**本次伤害结算前**的 hp——把模块打到半血以下的那一击本身不吃这个加成（避免"减伤影响伤害、伤害又反过来影响减伤"的自我指涉）。
    - 副作用：5% 概率对一个**满 hp** 模块造成其 maxHp 10% 的伤害，不吃任何减伤（规则 51 第 4 步）。
    - **Slice 7 复核（闭合原张力）**：公式仍是 `min(0.65, 0.20 + n × 0.15)`，n = 结算前 hp/maxHp < 0.5 的承血模块数。三个模块都低于半血时 n=3 → **65% 可触到**。`DefenseContext.moduleHps` / `moduleMaxHps` 必须列入全部三个模块，禁止仍只传 CORE/STORAGE。CSV 文案「最高 65% 当 3 模块均低于半血」对照通过，**不改** `data/contaminants.csv`，**不改**深渊之眼工具机制。加厚后「半血」按新 maxHp 计（145 的一半是 72.5）。
53a. **`stitch` 三模块复核（Slice 7）**：防御结算已按 `context.moduleHps` 的全部键做均值均衡（差值的 20%）。第三模块列入 context 后，均衡自然覆盖 3 个承血模块，与 CSV「3 个模块」一致。**不改**缝合线工具（两点感知屏障）机制，**不改** CSV。玩家可见摘要仍用「模块完整度均摊」；CSV 长文里的「HP」本 Slice 不动（术语债，不是本任务）。

54. **`combust` 累积焚尽**（DEC-030）：减伤 25%，同时把每次冲击的**实际承伤**累加进一个焚尽值。累加值达到 `COMBUST_BURN_THRESHOLD` 时立即释放：把累积值的 **50%** 以修复形式返还给扣血后 hp **最低**的模块，累加值归零，并给下次出击挂上「初始混乱 +10」。
    - 阈值是**固定常量**（60，约等于两次基准冲击伤害），不按 `BASE_IMPACT_DAMAGE × 2` 动态推导——潮汐会让伤害浮动，浮动的触发点会摧毁"我快攒满了"的预期感。潮汐高峰期攒得更快是符合直觉的，但阈值本身恒定。
    - 累加值按 contaminant id 存储并进存档（规则 60）。多件 `combust` 同时在槽内时只处理一件。

55. **`overwrite` 模块功能互换**（DEC-031）：减伤 40% + 无条件 30% 改造折扣；另有 **25% 概率**触发"模块功能互换"，持续**恰好一次出击**。
    - 实现形式：`GameState.getModuleEffect(type)` 在互换生效期间改读**另一个模块的 hp**，但保留 `type` 自己的公式。（不是把两个输出值直接对调——那样必定对玩家不利，因为 `kindlingValueModifier` 恒 ≥ 1.0 而 `chaosRateModifier` 恒 ≤ 1.0，互相插进对方的消费方永远是净损失。）因此互换的实际后果取决于当时哪个模块更健康：**有相当概率反而帮到玩家**。
    - 窗口边界：互换标记在**下一次冲击结算开始时**清除，即"本次冲击 → 下次出击"这一段。互换在冲击结算当时就写入 GameState，不能延后到出击开局消费副作用时才应用——因为场景层在裂隙场景启动之前就读了 `getSortieModifiers()`。
    - **toast 播报是硬要求**：出击开局必须提示"模块功能已互换"。缺了这个提示，这个机制就不成立（玩家无从察觉）。互换范围仍是核心↔储藏，不含净化器。
    - **确立的跨表原则：污染物的副作用不要求永远负面。** 后续污染物允许有随机有利面，不必逐个论证。可读性由 toast 承担。

56. **`erode` / `resonate` 的跨槽冲击计数**（DEC-033）：两者都返回一张"给谁 +几点冲击计数"的加成表，由污染物系统消费（加成是平的 +N，不吃 `defenseChargeMult`）。
    - `erode`：**每次冲击无条件**给"其他所有槽位"各 +1。语义是"其他所有"，不是写死的 2 个——`growth_defense_slot` 解锁第 4 槽后自动覆盖 3 个。四槽下 `erode` 变强属预期；若试玩过强走数值调参，不回退语义。
    - `resonate`：30% 概率给**全部槽位**（含自己）各 +1。
    - 平衡备注：这两项加速的是污染物"防御 → 工具"的转化，所以它们的强度上限由槽位数决定。槽位数不得再被任何地方写死（规则 61）。

57. **`echo` 工具次数 +1**：减伤 20%，每次冲击无条件从工具池里随机挑一件已转化的工具，使用次数 +1。**同一件工具最多因此 +2**（`ECHO_MAX_TOOL_USE_BONUS`）。工具池里没有可加的目标时静默无效。计数按 contaminant id 存储并进存档（规则 60）。

58. **`mirror` 按承伤返还薪柴**：减伤 25%，冲击结算后按**本次实际承伤总量的 10%** 返还薪柴，向下取整，**最低 1**。必须在伤害确定之后结算（受创越重回报越高，所以不能用减伤前的数）。多件同时在槽内时只结算一件。

59. ⚠ **`resonate` 的装备期被动尚未实现**：CSV 定义它"装备在防御槽期间 CORE 和 STORAGE 的效果上限各提升 10%，多件不叠加"——即 `MAX_CORE_REDUCTION` 0.30→0.33、`MAX_STORAGE_BONUS` 0.50→0.55。这是一条"装备期持续修正"，与 `muffle` 的"预告提前 1 轮"同属一类，两者目前都**没有任何代码路径**。规则登记在此以固定语义（多件不叠加、只改上限不改公式），实现待排期。

60. **污染物运行时状态进存档**（DEC-032）：`solidify` 的碎裂计数、`combust` 的焚尽累加值、`echo` 的单件上限计数统一按 contaminant id 归入一张 `ContaminantRuntimeState` 表，纳入存档。
    - 老存档缺该字段时以**空态**兜底（等价于新游戏重置后的状态），不会出现"读进来又被清掉"。
    - 此后新增带持久状态的污染物走同一通道，不再逐个决策要不要存。
    - 设计理由：`solidify` 丢计数玩家无感；但 `combust` 攒到九成时退出、回来归零会被当成 bug；`echo` 的上限计数丢失方向相反——会让玩家超出设计上限反复获益。

61. **防御槽位数是变量，不是 3**：基础 3 个，`growth_defense_slot` 改造（最高 1 级）解锁第 4 个，上限 4。槽位数由 `system-growth-tide` 拥有（`contaminantSystem.getDefenseSlotCount()`）。冲击结算遍历传入的槽位数组，不假设长度；任何"其他 2 个槽位"式的写死表述都是缺陷（见规则 56）。

### V — 模块受损三态（Slice 5）

62. **三态阈值**（按 hp / maxHp 比值）：

    | 状态 | 区间 | 含义 |
    | ---- | ---- | ---- |
    | 健康 | > 60% | 装置正常运转 |
    | 受损 | 30% ~ 60%（含两端） | 结构出现裂缝，但仍在工作 |
    | 严重受损 | < 30% | 濒临失效，力场开始渗入 |

63. **状态机与重绘纪律**：三态只在跨越阈值时切换并重绘模块主体，不逐帧重绘。指示灯用独立图层 + 500ms 定时器闪烁。
    - 三态裂缝 / 灯座 / 渗入点的**共享纪律**在 `docs/design-notes/ui-art-overhaul.md` B3。净化器复用同一套阈值与重绘；几何与身份色的像素死约束在本文件 UX「视觉规格」，与 Kit B3 净化器小节同一份，不新造色。
    - 旧的"hp < 25% 时框架红环闪烁"已移除（DEC-035）：它从未写入任何 spec，且与三态是两套并存的低血警告语言，多重告警色叠加是典型的后台管理系统味。hp 数值条本身在 < 25% 时仍变红，这一条保留。

### U — 模块上限加厚（Slice 7）

64. **全局抬上限**：改造祭坛旁的加厚装置花薪柴永久提高**全部**承血模块的 `maxHp`，不按模块分别升级。档位与费用：

    | 已买档 `moduleMaxHpTier` | 全部模块 `maxHp` | 下一档费用（薪柴） |
    | ------------------------ | ---------------- | ------------------ |
    | 0 | 100 | **12** |
    | 1 | 115 | **20** |
    | 2 | 130 | **32** |
    | 3 | 145 | 不可再买 |

    每档 +15。费用对照 `upgrades.csv`：单轴 3 级约 8/12/18、预告可靠度 10/20/30、第 4 槽一次性 35/40。加厚是三模块同涨的血池，略高于单轴蜕变、低于第 4 槽。一趟地图总价值 17（储藏满加成后约 25）；第 1 档 12 ≈ 大半趟保守搜刮，可负担、不白送。费用是系统常量，**不**进 `upgrades.csv`，**不**出现在蜕变六卡。
65. **存档**：`moduleMaxHpTier` 必须写入存档。`maxHp` 可由档位重算（`MODULE_BASE_MAX_HP + MODULE_MAX_HP_PER_TIER * tier`），存档里的模块 `maxHp` 若与档位不一致，以档位为准并写回。抬档时**当前 hp 不变**（不免费回满）；若出现 hp > 新 maxHp（不应发生）则 clamp。蜕变折扣 `upgradeDiscount` **不**作用于加厚费用。
66. **稳定度**：加厚不是蜕变刻入，本 Slice **不计**「购买任意改造升级 +3」。
67. **玩家可见名**：装置与动作都叫 **加厚**。禁止「升级」「购买」「确认」「MAX」。提示条用词见 UX 组。

### UX — 结构层（Slice 7） + 视觉规格

本 Slice 触碰的游戏内界面不新开 `docs/specs/ui-*.md`。机械层已扫；审美待人终审。不许自称好看 / 像游戏 / PASS。

#### 载体决策（U1）

| 表面 | 载体 | 理由 |
| ---- | ---- | ---- |
| 净化器实体（世界里那台装置 + 三态灯） | **A 世界内装置** | 玩家走近就能看见的模块，与核心/储藏同族 |
| 走近净化器后的注入读数 | **B 世界内终端** | **复用既有分配墙机**（S3，`#dom-ui-root` / `.game-panel`），不新开第七块磷光屏 |
| 祭坛旁加厚 | **A 世界内装置** | 站在桩前就地读数、按 E 花薪柴；**不是**蜕变墙机、不是软件商店 |
| 加厚/模块提示条、净化点预告目标名 | **A 世界内装置** | 复用既有底栏提示与贴顶 HUD，挂 `#dom-ui-root` |

屏幕空间一律 `#dom-ui-root`。禁止新 HUD 根、禁止 `document.body` + `position:fixed`、禁止 Phaser `scrollFactor(0)` 角锚。只有元界面允许软件界面感。加厚禁止做成 680×468 确认窗。

#### 参考锚点（U12）

从 `docs/design-notes/ux-references.md` 选，学动作、不学皮。

| 游戏 | 锚的维度（学什么动作） | 明确不学什么 |
| ---- | --------------------- | ------------ |
| Barotrauma | 走到装置前读指示灯/刻度，坏了是灯在说，不是弹「系统错误」 | 拟真阀门轮、精细指针（32px 会糊） |
| FTL: Faster Than Light | 一槽 = 表名 + 数值，贴边或贴装置，决策不必先点开商店 | 科幻全息蓝、圆形供电格、升级树卡墙 |
| Signalis | 检视是设备打出来的字，不是浮动 tooltip | 复古显像管曲面畸变、把整段说明做成设置页 |

本屏不像：后台 Dashboard、设置页升级树、电商「确认购买」对话框链。

#### 玩家必须回答的问题

- 走近净化器：这台装置现在多完整？注入后这次出击的起始混乱是多少？
- 走近加厚：当前全部模块的完整度上限是多少、第几档、下一档要多少薪柴、我能不能加厚？
- 踏入前：起始混乱是多少（与玩家完整度分开）？

#### 信息层级

**净化器实体 + 提示条（走近，P1）**

| 优先级 | 信息 | 展示 |
| ------ | ---- | ---- |
| P0（实体自身，零操作） | 三态灯 / 裂缝（与核心、储藏同一套阈值） | 世界层装置，不靠 HUD 名条 |
| P1（走近） | 提示条：模块名 `净化器` 与 `按 E` 分节点 | 底栏既有提示条 |
| P1 | 分配墙机内：表名 `净化器完整度`、当前/上限数字、表名 `起始混乱`、当前整数、注入后整数 | 表名 / 数值 / 不得拼成「起始混乱15」当一个词；「15」是数，「起始混乱」是表名 |
| P2 | 无 | 不要把起始混乱藏进存续报告才给 |

**加厚装置（走近，P1）**

| 优先级 | 信息 | 展示（分节点，禁止粘句） |
| ------ | ---- | ---------------------- |
| P0 | 无常驻 HUD 槽 | 不加第四条贴顶读数 |
| P1 | 表名 `完整度上限` | 独立标签 |
| P1 | 当前上限数字（100 / 115 / 130 / 145） | 独立数字；若可加厚，下一档数字另起节点，不要写成 `100→115` 一个字符串当标题 |
| P1 | 表名 `档` + 档位词 `第 0 档` … `第 3 档`（第 0 档 = 未加厚） | 档位与数字分开 |
| P1 | 表名 `薪柴` + 下一档费用数字；储备不足时同一位置改写缺口 `还差 N`（N 为整数） | 禁止只变灰 |
| P1 | 键位 `E` 与动作名 `加厚` 分节点 | 提示键 = 绑定键 |
| P2 | 无 | 不要说明书 |

状态只用游戏语义：`可加厚` / `薪柴不足 · 还差 N` / `上限已至`。禁止 hover / disabled。三档买尽：费用节点改档位词 `上限已至`，E 无效果、不扣薪柴。

**踏入墙机（既有 B；只加一个节点）**

出击属性现有三项（玩家完整度 / 混乱增速 / 薪柴价值）旁增加：**表名 `起始混乱` + 整数**。不改玩家完整度那一项的算法。不要把起始混乱拼进混乱增速。

#### 打开方式与打断（步骤 6）

- 净化器注入：走近实体按 E → 既有分配墙机。Esc 离开。进行中不另开居中弹窗。
- 加厚：走近祭坛北侧桩按 E → **当场扣薪柴抬一档**（与蜕变「刻入」同为一次性消耗，**没有**第二条「确认」）。缺薪柴不打开任何窗，提示条改写缺口。不加阻断确认。进行中同时仍只留 1 条需按键消解的冲击结算（规则 23b）。
- 禁止占用区：画面中心 ±120×80 逻辑像素与玩家周围可视区。加厚读数贴装置 / 底栏，不占中。

#### 结构层自检（机械层）

1. 载体：实体 A、注入复用 B、加厚 A；屏幕空间 `#dom-ui-root`。
2. 参考：Barotrauma / FTL / Signalis，各锚动作见上表。本屏不像 Dashboard / 设置页升级树 / 确认购买链。
3. P0≤6；加厚无常驻 P0，决策信息在走近 P1。不操作时实体三态仍可读。
5. 不可用写出缺口 `薪柴不足 · 还差 N` / `上限已至`。
7. 打开=走近 E；加厚无第二条阻断确认。
8. 可见词来自术语表：净化器 / 完整度 / 薪柴 / 加厚 / 起始混乱 / 档。键盘可做完全部操作。

#### 视觉规格（Slice 7 A1；给 code 的像素死约束）

本段是本表面的视觉真相（权威链：本段 > Kit `ui-art-overhaul.md` > `art-direction.md` §6）。色只引用已锁板 / Kit 已映射名。禁止新 hex。禁止新墙机皮。禁止新 HUD 根。机械层已扫；审美待人终审。不许自称好看 / 像游戏 / PASS。

本 Slice **不重画**核心蓝六边形、储藏橙方块的已落地形体。墙机读数里核心仍用结构色 `ui-text-bright` `#c8cdd4`，储藏仍用 `warm-glow` `#c4873a`（Kit A2）。

##### 开工闸门（art：步骤 2 / 4 / 5）

**载体（复核 design）**

| 表面 | 载体 | 哪台机器打出来的字 / 画出来的形 |
| ---- | ---- | -------------------------------- |
| 净化器世界实体 | **A** | 净化点地上焊死的维生装置。形体与灯是装置本身，不是软件图标。 |
| 分配墙机（注入） | **B** | 既有 680×468 磷光屏。等宽字是这块屏打出来的，不新开第七块。 |
| 加厚桩 | **A** | 与裂隙入口 / 防御点 / 祭坛同一套地上读数桩。环的呼吸是装置待机，不是装饰光晕。 |
| 提示条 / 预告目标名 | **A** | 既有底栏 `#purif-prompt` 与贴顶 `#purif-hud`，挂 `#dom-ui-root`。 |

屏幕空间一律 `#dom-ui-root`（`getDomUiRoot()` / `bindDomUiRootToGame()`）。禁止 `document.body` + `position:fixed`。禁止 Phaser `scrollFactor(0)` 角锚。钉世界坐标的只有模块实体、加厚桩、模块脚下完整度条。

**参考锚点**：沿用本文件结构层 U12 表（Barotrauma / FTL / Signalis）。本屏不像：后台 Dashboard、设置页升级树、电商「确认购买」对话框链。

**复用基元，禁止自造**：分配 / 出击装配走既有 `.game-panel` / `.crt-stack` / `.panel-title` / `.pbar-wrap` / `.key-hint-bar`。加厚不套 `.game-panel`。字号只许 12 / 13 / 16。字体 `"Courier New", monospace`。状态只用 `可加厚` / `薪柴不足 · 还差 N` / `上限已至` / 健康 / 受损 / 严重受损。禁止 `hover` / `disabled` / 提交 / 确认 / 升级 / 购买 / MAX。

##### 1. 净化器世界实体（载体 A）

同族：程序化几何装置 + 三态，走 `purification-module.ts` 现有状态机（阈值 >60% 健康 / 30%–60% 受损 / <30% 严重受损；主体只在跨阈值重绘；灯独立层 + 500ms 闪）。**不要新 sprite 图集。** 64×64 量级，与核心（外接圆半径 16）/ 储藏（半边 14）同尺度。

**锁定形体：竖立三棱锥台**（俯视 = 外大内小两层朝下等边三角形。尖朝世界 +Y / 画面下方。一眼不是六边形、不是方块、不是交互点同心圆）。

以装置中心 `(x, y)` 为原点的整数顶点（世界像素）：

| 层 | 顶点（相对中心） | 外接圆半径 |
| -- | ---------------- | ---------- |
| 外三角（底面） | `(0, 18)`、`(-16, -9)`、`(16, -9)` | 18 |
| 内三角（截顶面） | `(0, 8)`、`(-7, -4)`、`(7, -4)` | 8 |

绘制顺序（`Phaser.GameObjects.Graphics`，depth 20，与现模块相同）：

1. 填外三角：`contam-mid` `#1a6b5c`，alpha 随 hp 比走现模块四档（≥0.75 → 0.9；≥0.5 → 0.7；≥0.25 → 0.5；其余 0.3）。
2. 填内三角：`contam-deep` `#0e4a3f`，alpha 与外三角相同。
3. 描外三角：线宽 **2**，`contam-core` `#1aad96`，edge alpha 走现模块四档（0.7 / 0.5 / 0.3 / 0.15）；走近 `HP_SHOW_DISTANCE`（80px）时 edge alpha +0.2，封顶 1.0。
4. 描内三角：线宽 **1**，`metal-grey` `#4a4e55`，alpha 与外描边相同。
5. 三态装饰：`drawDamageDecoration(18)`——裂缝偏移表 `CRACK_LINE_OFFSETS`、裂缝色 `shadow-grey` `#151a1e`、受损线宽 1 / 严重 2；严重时渗入点 `SEEP_SIZE` 3、`SEEP_COLOR` `contam-core` `#1aad96`、`SEEP_ANGLES` 现表（40° / 165° / 280°）。健康不画裂缝/渗入。
6. 灯：独立 Graphics，depth 21。**3×3 方点**，中心 `(x, y)`（落在截顶面上）。灯座 `ui-border` `#2a2d32`。健康常亮 `contam-core` `#1aad96`。受损 500ms 亮灭，亮帧 `ui-warning` `#b89040`。严重常灭（只留灯座）。**禁止** `#44aa66` 或任何未入板绿当「好」。

脚下完整度条（世界层，现模块纪律）：条宽 28、高 3、条顶 = `y + 18 + 4`。槽 `contam-deep` `#0e4a3f` @ 0.8。填充 `contam-mid` `#1a6b5c`；hp/maxHp < 0.25 改 `ui-danger` `#cc3333`。距离 >80 且比值 ≥0.5 时整条 alpha 0.15，否则 1.0。世界层不写字。

注入确认闪光：沿用现模块 30×30、白 `#c8cdd4`、300ms 淡出。不换绿闪。

身份色叙事：功能灯与「起始混乱」读数同源（L2 污染色谱），因为这台装置的工作就是在踏入前剥离外来渗透。不是第三种无归属绿，也不是人类侧暖橙。

##### 2. 加厚桩（载体 A）

位置：改造祭坛北 **2.2 tile**（同西轴）。**不是**第四个模块实体（无三角/无完整度条/无三态灯）。**不是** 680×468 确认窗。**不是**蜕变墙机。

画法：调用现有 `drawInteractionPoint`（同心圆 + 呼吸），只换色相。参数写死：

| 项 | 锁 |
| -- | -- |
| 中心圆色 | `metal-light` `#5a5f66` |
| 外环色 | `ui-text-bright` `#c8cdd4` |
| 中心半径 | **7** |
| 环半径 | **12** |
| 走近 | 环半径 +3（函数已有 `inRange`） |
| 呼吸速度 | 与祭坛/防御点同一套：常态 `2π/2500`、靠近 `2π/1200`、待处理高亮 `2π/800`（下一档费用 ≤ 当前薪柴；三档加尽后不高亮） |
| alpha | 函数已有：高亮底 0.55 / 否则 0.4，再加 `sin(pulse)*0.25`；中心再 +0.15 |

色相理由：裂隙入口已占 `contam-core` / `contam-glow`；祭坛已占暖色薪柴族。加厚是把完整度上限加厚，用结构中性灰，避免第三种 teal、避免与祭坛暖点并排分不清。禁止 `#6644aa` / `#aa6622` 等未入板色。禁止新投影、禁止外发光装饰。

走近读数：**只走底栏** `#purif-prompt`（`#dom-ui-root`）。不在桩上挂世界文字，不在装置旁再开浮层。禁止占用逻辑画布中心 ±120×80（即 `480±120, 320±80` 矩形）。无第二条确认。

底栏节点（从左到右，各独立 `<span>`，禁止粘成一句）：

| 节点 | 字号 | 色 |
| ---- | ---- | -- |
| `[E]` | 12 | `ui-text-bright` `#c8cdd4` |
| 动作名 `加厚` | 12 | `ui-text` `#8a8f96` |
| 分隔 `│` | 12 | `metal-light` `#5a5f66`（装饰，不作文字信息） |
| 表名 `完整度上限` | 12 | `#8a8f96` |
| 当前上限整数（100 / 115 / 130 / 145） | 13 | `#c8cdd4` |
| 下一档整数（仅可加厚时另起节点；禁止 `100→115` 当一个字符串） | 13 | `#c8cdd4` |
| 表名 `档` | 12 | `#8a8f96` |
| 档位词 `第 0 档` … `第 3 档` | 12 | `#8a8f96` |
| 表名 `薪柴` | 12 | `#8a8f96` |
| 下一档费用整数 | 13 | `warm-glow` `#c4873a` |
| 状态词：`可加厚` / `薪柴不足 · 还差 N` / `上限已至` | 12 | 可加厚 `#c8cdd4`；不足 `#b89040`；上限已至 `#8a8f96` |
| 然后既有 `│ Tab:存续报告 │ Esc:记录` | 12 | 既有色 |

`上限已至` 时：不画下一档数字、不画费用数字；状态词占费用位置。E 仍画，无效果。缺薪柴：费用位置改写 `还差 N`（N 整数），禁止只变灰。不新造菱形 / 三角符号。

##### 3. 分配墙机第三行（载体 B）

复用既有 `.game-panel` **680×468**，`top:52px; left:140px`。无金属面壳、无 1px 外框、无圆角、无 `box-shadow`、无 HTML 主按钮排。禁止新表单、禁止 Dashboard 卡片。

标题行：模块名 `净化器`，16px，`#1aad96`。预告命中时右侧 `下次冲击目标` 仍用 `#b89040`（既有）。

行式与核心 / 储藏同一套（表名 12px `#8a8f96`、宽 96px；数字 16px bold；`→` 是分隔符不是表名）：

| 行 | 表名节点 | 数字节点 | 数字色 |
| -- | -------- | -------- | ------ |
| 完整度 | `净化器完整度` | `hp`、`/`、`maxHp` 三个节点 | `#1aad96` |
| 效果 | `起始混乱` | 当前整数、`→`、注入后整数（三个节点） | `#1aad96` |

条：既有 `.pbar-wrap` / `.pbar-fill` / `.pbar-preview`，填充 `#1aad96`。禁止把「起始混乱15」写成一个词。投入 / 储备 / 注入后剩余仍走薪柴橙 `#c4873a`，不改。

机会成本：其余**两个**模块各一簇，表名必须是 `核心完整度` / `储藏完整度` / `净化器完整度`（视当前打开的那台而定），数字色按身份（核心 `#c8cdd4`、储藏 `#c4873a`、净化器 `#1aad96`）。禁止再写「另一模块」。

##### 4. 出击装配墙机（既有 B；只加一格）

既有三项旁加第四格，同一 `display:grid`，改 `grid-template-columns:1fr 1fr 1fr 1fr`。不改玩家完整度算法，不把起始混乱拼进混乱增速。

| 格 | 表名 12px `#8a8f96` | 整数 16px bold |
| -- | ------------------- | -------------- |
| 既有 | `完整度` | `#c8cdd4`（算法不动） |
| 既有 | `混乱增速` | `#1aad96` |
| 既有 | `薪柴值`（现用词，本 Slice 不改名） | `#c4873a` |
| **新** | `起始混乱` | `#1aad96`；值为 `getStartingChaos()` 整数，0 也要画出来 |

##### 5. 贴顶预告 / 底栏走近净化器

`#purif-hud` 不加第四条常驻槽。目标全称补 `净化器`，字色 `contam-core` `#1aad96`（核心仍 `#c8cdd4`，储藏仍 `#c4873a`）。档位词继续读 `SEVERITY_LABEL`。

走近净化器底栏：`[E]` 与 `净化器` 分节点。可选再跟 `净化器完整度` + `hp` + `/` + `maxHp` 四个节点。**不**把起始混乱写上底栏（那是墙机 P1）。不新造 ◈ / △ / 六边形符号。

存续报告 / 冲击结算若本 Slice 露出第三模块：同一行式 + 净化器数字 `#1aad96`。不新开皮。

##### 6. 挂载

| 表面 | 挂 |
| ---- | -- |
| `#purif-hud` / `#purif-prompt` / 分配 / 出击装配 | `#dom-ui-root` |
| 净化器形体 / 灯 / 脚下条 / 加厚桩 | Phaser 世界层 |
| 禁止 | 新 HUD 根；`document.body` + `position:fixed`；Phaser 角锚 |

动效：墙机开闭沿用 Kit A6（150ms / 100ms）。加厚成功：底栏数字在 400ms 内换成新上限（人类侧正向可用既有文字 flash `#e0a848`→回落，300ms）。无居中弹窗、无第二条确认。

##### 写完自检（机械层；不许写好看 / 像游戏 / PASS）

1. 载体：实体 A、注入 B、加厚 A；屏幕空间 `#dom-ui-root`；世界几何走世界层。未另起 body / 角锚。
2. 参考：Barotrauma（走到装置看灯）／ FTL（一槽表名+数、贴边）／ Signalis（设备打出来的字）。本屏不像 Dashboard / 设置页升级树 / 确认购买链。
3. P0：净化器三态在实体上，零操作可读；加厚无常驻 P0。贴顶仍是薪柴 / 潮汐 / 下次归来（≤3，消声才 +1）。
4. 哪台机器见上表。呼吸 = 装置待机三档；灯闪 = 受损供电不稳；磷光扫描线 = 既有墙机材质。无新增投影 / 圆角 / 渐变按钮。
5. 不可用写出 `薪柴不足 · 还差 N` / `上限已至`。
6. 灰度后：三角 ≠ 六边 ≠ 方块；加厚桩是同心圆不是模块；表名 / 数字 / 档位分节点；不足靠「还差 N」计数，不单靠色。
7. 打开 = 走近 E。加厚无第二条阻断。同时仍只 1 条冲击结算确认。
8. 可见词：净化器 / 完整度 / 薪柴 / 加厚 / 起始混乱 / 档。键盘可做完全部操作。提示键 = `E`。

##### U1–U12（视觉层相关项；机械扫，不代人终审）

| 项 | 机械扫过 | 缺口 |
| -- | -------- | ---- |
| U1 载体 / 挂载 | 是 | 实现时若把加厚做成 `.game-panel` 或把实体做成 HUD 图标，即偏 |
| U2 反后台套路 | 是 | 本段未引入圆角卡片 / 投影 / 渐变按钮 / 通用图标字体 |
| U3 色彩 | 是 | 净化器与加厚只引用已锁名。核心/储藏**世界实体**仍用未入板蓝/橙（既有债，本 Slice 不重画） |
| U4 排版 | 是 | 只复用 12 / 13 / 16 与 Courier New |
| U5 术语 | 是 | 结构层已锁用词；视觉未加软件词 |
| U6 不遮挡 | 是 | 加厚禁止中心 ±120×80。分配墙机走既有 CRT 占位（四周漏景、不盖贴顶） |
| U7 输入 | 是（结构） | 视觉不依赖 hover 才出读数 |
| U8 状态语义 | 是 | 三词状态 + 灯/裂缝第二编码 |
| U9 表名数值档位 | 是 | code 若把 `起始混乱15` 或 `100→115` 粘成一个节点即偏 |
| U10 反馈 | 是 | 加厚后 400ms 内底栏数字须变；灯/裂缝跨阈值重绘 |
| U11 同族 | 是 | 第三行跟核心/储藏同行式；桩跟入口同函数。不新基元 |
| U12 参考 | 是 | 锚点在结构层。并排是否违和 = 人终审，此处不勾 |

审美待人终审。

---

## 数值表

| 参数 | 值 | 范围 | 说明 |
| ---- | -- | ---- | ---- |
| `MODULE_INITIAL_HP` | 70 | 60-100 | 开局不满，暗示已有损伤 |
| `MODULE_BASE_MAX_HP` | 100 | -- | 档位 0 的修复上限；取代旧名 `MODULE_MAX_HP` 作为**基准**血池 |
| `MODULE_MAX_HP_PER_TIER` | 15 | -- | 每档加厚 +15 |
| `MODULE_MAX_HP_TIERS` | 3 | -- | 最高档 3 → maxHp 145 |
| `MODULE_MAX_HP_COST` | 12 / 20 / 32 | -- | 第 1 / 2 / 3 档费用（薪柴） |
| `MODULE_EFFECT_HP_REF` | 100 | -- | CORE/STORAGE 效果分母；加厚后仍用它 |
| `CHAOS_HARD_START` | 50 | 40-60 | 净化器 hp=0 时的出击起始混乱 |
| `REPAIR_PER_KINDLING` | 4 | 3-10 | 1 薪柴=多少 hp（为稀缺感调低） |
| `BASE_IMPACT_DAMAGE` | 30 | 15-40 | 每次冲击的基础总伤害 |
| `THREAT_FOCUS_RATIO` | 0.65 | 0.55-0.75 | 重点目标承受的伤害比例 |
| `FORECAST_ACCURACY` | 0.80 | 0.7-0.9 | ground-truth 预告与实际重点目标相符的概率 |
| `MAX_CORE_REDUCTION` | 0.30 | 0.2-0.4 | CORE 在 hp≥100 时的混乱值减免（效果封顶，与 maxHp 无关） |
| `MAX_STORAGE_BONUS` | 0.50 | 0.3-0.7 | STORAGE 在 hp≥100 时的薪柴加成（效果封顶，与 maxHp 无关） |
| `INTERACTION_RADIUS` | 32 | px | 交互点的走近判定半径 |
| `APPARITION_INTERVAL_MIN` | 8000 | ms | 最短间隔 |
| `APPARITION_INTERVAL_MAX` | 15000 | ms | 最长间隔 |
| `APPARITION_DURATION` | 3000 | ms | 0.5s 淡入 + 2s 保持 + 0.5s 淡出 |
| `APPARITION_MAX_SIMULTANEOUS` | 3 | 1-4 | 同时存在的轮廓上限 |
| `PARTICLE_COUNT` | 50 | 30-70 | 边界常驻粒子数 |
| `PARTICLE_ALPHA_MIN/MAX` | 0.06 / 0.25 | -- | 粒子透明度区间（上限即视觉权重上限） |
| `PARTICLE_SPEED` | 8 | 5-15 | px/s，向内漂移基准速度（每颗 ×0.7-1.3） |

> 强度不再有 `INTENSITY_STEP` / `MAX_INTENSITY`——两个常量已从 `constants.ts` 移除，强度的涨退归 `system-growth-tide` 的 `TIDE` 常量（区间 [1.0, 3.0]）。见规则 12。

### 防御结算与预告（Slice 5）

| 参数 | 值 | 范围 | 位置 | 说明 |
| ---- | -- | ---- | ---- | ---- |
| `COMBUST_BURN_THRESHOLD` | 60 | 40-90 | `PURIFICATION` | 焚尽阈值，固定常量（≈2× 基准冲击伤害） |
| combust 返还比例 | 0.50 | 0.3-0.7 | defense-engine 内联 | 累积值转为修复的比例 |
| `ECHO_MAX_TOOL_USE_BONUS` | 2 | 1-3 | `CONTAMINANT` | 单件工具因 echo 最多 +几次 |
| abyss 基础减伤 / 每档 / 上限 | 0.20 / 0.15 / 0.65 | -- | defense-engine 内联 | 三模块均低于半血时可触到 65%（规则 53） |
| abyss 副作用概率 / 伤害 | 0.05 / maxHp 10% | -- | defense-engine 内联 | 打满血模块，不吃减伤 |
| overwrite 互换概率 | 0.25 | 0.15-0.35 | defense-engine 内联 | 持续一次出击 |
| resonate 跨槽触发概率 | 0.30 | 0.2-0.4 | defense-engine 内联 | 全槽 +1 冲击计数 |
| mirror 返还比例 / 下限 | 0.10 / 1 | -- | defense-engine 内联 | 按实际承伤，向下取整 |
| mirror 谎报概率 | 0.10 | 0.05-0.2 | impact-system 内联 | 仅在 mirror 占防御槽时 |
| 档位模糊概率（基线 / 地板） | 0.20 / 0.05 | -- | impact-system 内联 | 被 forecast_clarity 削减到地板为止 |
| 档位分界 | 1.5 / 2.0 / 2.5 | -- | impact-system 内联 | 潮汐强度 [1.0, 3.0] 四等分 |
| `growth_forecast_clarity` | +5%/级，3 级 | -- | `upgrades.csv` | 同时削减谎报与模糊概率 |
| 防御槽位数 | 3（基础）/ 4（上限） | -- | `CONTAMINANT` | `DEFENSE_SLOTS` / `MAX_DEFENSE_SLOTS` |
| 三态阈值 | 0.60 / 0.30 | 0.5-0.7 / 0.2-0.4 | `purification-module.ts` 局部常量 | 未进 `constants.ts`（DEC-035） |

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
| `IMPACT_STARTED` | `{ intensity }` | ImpactSystem | **当前无消费方** |
| `IMPACT_RESOLVED` | `{ moduleDamage: Record<string, number> }` | ImpactSystem | **当前无消费方** |
| `MODULE_DAMAGED` | `{ moduleId, newHealth }` | ImpactSystem | **当前无消费方** |
| `ALLOCATION_CONFIRMED` | `{ allocations: Record<string, number> }` | AllocationPanel | PurificationScene（模块闪光反馈）；扣 reserve/加 hp 已在面板内直接调 GameState |
| `RIFT_EXITED` | `{ kindlingGained, survived }` | RunController (Slice 1) | PurificationScene（入账，通过 scene data 而非监听） |
| `RIFT_ENTERED` | `{ cycle }` | PurificationScene / RunController | **当前无消费方** |

> ⚠ 冲击的三个事件目前是**只发不收**：净化点场景的震动、结果面板、状态刷新全部由 `ImpactSystem.run()` 的**返回值**直接驱动（同一个 create 流程里同步拿到）。事件保留是为了将来的音频/成就等旁路消费方。任何新增消费方要注意它们在场景 create 期间就已发出，晚于此时注册的监听器收不到。

---

## 边界情况

| 情况 | 处理 |
| ---- | ---- |
| 死亡返回净化点 | kindlingGained=0，但冲击照常结算（规则 19），可分配之前的 reserve |
| reserve=0 且三模块 hp=0 | 不强制 game-over。玩家仍可出击：无核心/储藏加成，起始混乱 = 50（最难模式） |
| 分配面板打开时冲击不会触发 | 冲击只在净化点场景 create 时结算一次，此时任何面板都还没打开 |
| 两个模块低于半血、净化器仍高于半血时的 `abyss` | 减伤 50%（n=2）。三模块都低于半血才到 65% |
| 三模块都低于半血时的 `abyss` | 减伤 65%，与 CSV 一致 |
| 加厚后未注入、净化器 100/115 | 起始混乱 = round(50 × (1 − 100/115)) = 7。CORE/STORAGE 效果仍按 min(hp,100)/100 封顶，不降 |
| 加厚时薪柴不足 | 不扣、不抬档；提示条写 `薪柴不足 · 还差 N` |
| 加厚已至第 3 档 | E 无效果；提示条写 `上限已至` |
| 老存档只有两个模块 | 补 PURIFIER 70 / 当前档位 maxHp，`moduleMaxHpTier` 缺省 0 |
| `combust` 释放时最低 hp 模块已满血 | 修复量按 clamp 到 maxHp 计，多余部分不转移给另一个模块，直接丢弃 |
| `erode` 在只有它一件时 | "其他所有槽位"为空集，无任何加成产出（不给自己） |
| `echo` 时工具池为空 | 静默无效，不消耗、不报错、不改上限计数 |
| 模块互换生效期间某模块 hp=0 | 互换照常，效果读到 0 hp 的那一侧就没有加成。这是互换"有时帮玩家有时害玩家"的正常一面 |
| 老存档没有污染物运行时状态字段 | 以空态载入（规则 60），不视为损坏存档 |
| 同类污染物多件同时在防御槽 | 减伤各自乘算叠加；但 `stitch` / `combust` / `mirror` 的特殊结算只执行一件 |
| 分配超过 reserve | UI 不允许输入超过 reserve 的值 |
| 修复超过 maxHp | 多余部分不退回，clamp 到 maxHp（UI 应提前 clamp 可分配量） |
| cycle=0 跳过冲击 | 第一次出击是"教学局"，让玩家先体验基线难度 |
| 三个模块同时到 0 | 继续运行，不结束游戏。这是"最难但不是不可能"的状态 |
| 潮汐压缩后的原始半径小于交互点要求 | 安全区钳制接管，气泡在该角度被钉住。高 intensity 下形态由钳制主导而非椭圆主导 |
| 同一周期内反复进出净化点 | 形状完全相同（种子取自 cycle），玩家不会看到"边界莫名换了个样子" |
| 玩家试图走进膜带 | 碰撞环位于 98% 半径，玩家最多踩到膜带内侧（0.95-0.98），到不了 1.0 |
| 呼吸层变形与碰撞不一致 | 变形仅绘制。膜线可短暂画到玩家仍能站立的位置，属预期 |
| 冲击结果面板显示期间 | 粒子与呼吸层继续运行（场景 update 未暂停），玩家输入被禁用 |

---

## 对外接口

| 消费者 | 接口 | 形式 |
| ------ | ---- | ---- |
| RiftScene | `SortieModifiers { chaosRateModifier, kindlingValueModifier, startingChaos }` | scene data 传参 |
| ChaosSystem | `chaosRateModifier`；开局 `value = startingChaos`（再叠加 `initial_chaos`） | 乘在 BASE_RATE 上；初值一次写入 |
| LootSystem | `kindlingValueModifier` | 乘在 node.value 上 |
| HUD / 结果面板 | `GameState.getKindlingReserve()` / `getModules()` / `getStartingChaos()` | 查询 |
| PurificationScene | `GameState.raiseModuleMaxHp()` / `getModuleMaxHpTier()` | 加厚交互 |
| PurificationScene | `ImpactSystem.run(defenseSlots): ImpactResult` | 方法调用（槽位由场景传入，避免系统互相 import） |
| 净化点 HUD | `ImpactSystem.getForecastDisplay()` / `getForecastLookahead()` | 查询（时机词 + 模块全称 + `SEVERITY_LABEL`；图标/pip 最多第二编码） |
| PurificationScene | `ImpactSystem.generateForecast(nextIntensity, forecastReliabilityBonus)` | 方法调用（强度与改造等级由场景读取后传入） |
| ContaminantSystem | `DefenseResult.bonusCharges` / `toolUseGrants` | 由 ImpactSystem 直接调用其 `applyBonusCharges()` / `grantRandomToolUse()` 消费 |
| GameState | `DefenseResult.healOut` / `moduleSwapTriggered` | `healModule()` / `setModuleSwapActive()` |
| 出击开局 toast | `PendingSideEffect{ type: 'module_swap' }` | 沿用 Slice 4 的防御副作用播报通道（规则 55 的硬要求） |
| SaveManager | `getDefenseRuntimeState()` / `loadDefenseRuntimeState()` | 与污染物系统的 echo 计数合并为一段存档（规则 60） |

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

### Slice 5 追加（防御结算全量接线 + 非空间预告 + 三态视觉）

对应 `docs/tasks/slice-5.md` 的 T3 / T6 / B1，决策见 DEC-029 ~ DEC-035、DEC-037。

| 文件 | 内容 |
| ---- | ---- |
| `src/systems/defense-engine.ts` | abyss / combust / overwrite / erode / resonate / echo / mirror 的结算；`ContaminantRuntimeState` 与其快照/载入 |
| `src/systems/impact-system.ts` | 非空间预告（`generateForecast` / `getForecastDisplay`）；消费 DefenseResult 的四个新出口 |
| `src/managers/game-state.ts` | `healModule()`、`isModuleSwapActive()` / `setModuleSwapActive()`、`getModuleEffect()` 的互换分支 |
| `src/managers/save-manager.ts` | 合并两个模块的运行时状态为一段存档；老存档兜底 |
| `src/ui/dom/purification-hud.ts` | 预告槽：下次归来 + 核心/储藏 + SEVERITY_LABEL；extreme 临界脉动 |
| `src/entities/purification-module.ts` | 三态阈值与状态机（视觉规格来自 ui-art-overhaul B3） |
| `src/systems/boundary-atmosphere.ts` | 移除粒子方向偏置，恢复均匀生成 |

### Slice 7 追加（净化器 + 加厚 + 起始混乱）

对应 `docs/tasks/slice-7.md` C1。决策 DEC-064 + 本文件 U 组。

| 文件 | 内容 |
| ---- | ---- |
| `src/managers/game-state.ts` | `PURIFIER` 模块、`moduleMaxHpTier`、`getStartingChaos()`、`raiseModuleMaxHp()`；`getModuleEffect` 分子 `min(hp, 100)` |
| `src/managers/save-manager.ts` | 持久化档位；老存档补第三模块 |
| `src/systems/impact-system.ts` | 预告/重点目标在三个模块中抽；`DefenseContext` 列入三模块 hp |
| `src/systems/defense-engine.ts` | 公式不改；context 有三键后 abyss 65% / stitch 三向均衡自动成立 |
| `src/systems/chaos-system.ts` | 构造/reset 接受出击初值（增长曲线不改） |
| `src/scenes/purification-scene.ts` | 净化器实体 + 加厚点；安全区钳制七点 |
| `src/ui/dom/allocation-panel.ts` | 净化器效果行 `起始混乱`；机会成本其余两模块 |
| `src/ui/dom/loadout-panel.ts` | 出击属性加 `起始混乱` 节点 |
| `src/ui/dom/purification-hud.ts` | 预告目标名含 `净化器` |

---

## 未接线 / 待清理清单（2026-08-12 依代码核对，登记在案不静默）

回填时逐条核对了代码，以下缺口**已确认存在**。它们不是设计变更，而是"规则已定、代码未到"或"代码残留"。写在这里以免下次有人把它们当成新发现重新论证一遍。

| # | 项 | 性质 | 位置 |
| - | -- | ---- | ---- |
| 1 | `resonate` 的装备期被动（CORE/STORAGE 上限各 +10%） | 规则已定，无任何代码路径 | 规则 59 |
| 2 | `muffle` 的"预告提前 1 轮" | 同上（Slice 4 起就没有） | `defense-engine.ts` 注释声称由场景层处理，实际无消费方 |
| 3 | `siphon` 的修复效率翻倍 | 值已写入 GameState，分配时不读 | 规则 15 |
| 4 | `GameState.incrementIntensity()` 的 +0.15 残留 | 代码残留，对玩法无影响 | 规则 12 |
| 5 | `IMPACT_STARTED` / `IMPACT_RESOLVED` / `MODULE_DAMAGED` / `RIFT_ENTERED` 只发不收 | 事件保留，演出走返回值 | 事件契约段 |
| 6 | `BOUNDARY.BREATH_*` 五个死常量 | 旧方案残留（Slice 5 的 B4 负责清理） | 边界形态数值表下的注 |
| 7 | `DefenseContext.stabilityProgress` 恒为 0 | `stabilityTracker` 未接入冲击结算 | `impact-system.ts` 内 TODO |
| 8 | `abyss` / `stitch` 的 CSV 三模块文案 | **Slice 7 设计已闭合**。实现须把 PURIFIER 列入 `DefenseContext`；不改 CSV、不改工具机制 | 规则 53 / 53a |
| 9 | `mirror` 的 CSV 副作用文案仍写"冲击方向预告镜像反转" | DEC-034 之后已改为谎报目标模块，CSV 文案未同步 | 规则 52 |

---

## 校准问题（试玩时关注）

- [ ] **BASE_IMPACT_DAMAGE=30 是否让模块 hp 下降得太快/太慢？** 期望：3-4 次出击后如果不修复，至少一个模块到达 0。注意这个值现在还要乘潮汐强度（1.0-3.0），高潮期单次总伤害可达 90。
- [ ] **REPAIR_PER_KINDLING=4 是否让修复过于吃紧？** 一次冲击（强度 1.0）打掉约 30 hp，需要约 8 薪柴才能补回。这是刻意的稀缺感还是让分配变成了无意义的苦工？
- [ ] **CORE -30% 减免是否可感知？** BASE_RATE=0.5，减免后 0.35。0→100 从 200s 变为 286s——多出 86s 是否足够让人"想保住 CORE"？
- [ ] **STORAGE +50% 是否改变决策？** 薪柴 1→1.5（取整=1），2→3，4→6。对 contested/deep 节点影响大，对 safe 节点影响小——是否让人倾向保 STORAGE？
- [ ] **预告去掉方向后信息量是否够用？** "目标模块 + 四档强度"是否足以支撑出击前的分配决策，还是玩家会觉得预告可有可无？
- [ ] **两层失真是否能被区分？** 玩家能不能分辨"预告本来就只有 80% 准"和"mirror 在骗我"？如果分不清，`mirror` 的误导副作用就等于不存在。
- [ ] **`growth_forecast_clarity` 三级投资是否可感知？** 谎报 10%→0% 与模糊 20%→5%，在一局的样本量下玩家是否能察觉差别。
- [ ] **三个模块都到 0 后是否真的"不可能但能继续"？** 还是玩家会觉得该重开了？
- [ ] **intensity 3.0 时的 28% 收缩是否可感知？** 玩家是在两次出击之间对比时才发现，还是根本注意不到？若注意不到，收缩就没有传达"压力在增加"。
- [ ] **高 intensity 下形状是否退化为花瓣状？** 安全区钳制以 ±30° 余弦摊开；当原始半径远小于交互点要求时，边界由七个钳制凸起主导，可能出现可见的尖角与凹谷。需要目视确认在 intensity 2.5-3.0 时形状是否仍像"被挤压的气泡"。
- [ ] **膜的局部变形（≤8px、alpha ≤0.22）是否被注意到？** 如果完全无感，选择是删掉还是提高权重——而不是留着当摆设。
- [ ] **压力主方向现在是否成为唯一被读取的方向信号？** DEC-034 之后预告不再给方向，边界压力可视化独占这一维度——玩家是否真的会去看它，还是方向暗示就此变成无人消费的表现层。
- [ ] **`abyss` 的"逆风守护"在三模块下是否成立？** 三模块均低于半血时应读到 65%；玩家是否感受到"越危急防御越强"。
- [ ] **净化器是否被读作"在干活"？** 修满后起始混乱 0、残血带入部分混乱——连续两趟能否不看文档感到差别。
- [ ] **加厚 12/20/32 是否可负担但不白送？** 若没人买：费用过高或信号不足；若第一档出门就买：可能偏便宜。
- [ ] **`combust` 的"我快攒满了"预期感是否建立？** 阈值 60 固定，但玩家看不到累加值。是否需要一个可视化出口，否则这个机制在体验上等于随机回血。
- [ ] **`overwrite` 的互换是否被读作"惩罚"？** 它有相当概率对玩家有利（规则 55）。玩家看到 toast 时的第一反应是"糟了"还是"赚了"？如果永远是"糟了"，说明 toast 文案没有传达它的双面性。
- [ ] **四槽解锁后 `erode` 是否过强？** 每次冲击给 3 件污染物各 +1 计数，转化速度接近翻倍。若过强走数值调参（降低加成），不回退"其他所有槽位"的语义。
