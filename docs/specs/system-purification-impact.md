---
status: ACTIVE
slice: 2 (extended in 4.5, 5, 5.5, 7)
last-modified-by: code（迭代20完整供奉与有限收益）
last-modified-date: 2026-09-18
interface-changed: true
interfaces-with:
  - system-field-inventory         # 统一物件供奉、实例归属、使用与装配
  - system-chaos-scavenge-extract   # consumes RIFT_EXITED; feeds chaosRateModifier + kindlingValueModifier
                                    # + startingChaos (Slice 7 净化器完整度写入出击初值)
  - system-movement-vision          # purification scene reuses Player + VisibilitySystem (DEC-ARCH-008)
  - system-growth-tide              # tide intensity/phase drives impact intensity + boundary shape; contaminant
                                    # defense slots feed the defense phase (slot count is growth-owned, not fixed);
                                    # growth_forecast_clarity sharpens the forecast; SaveManager persists both sides;
                                    # 加厚不进 upgrades.csv；并进蜕变面板第七张（DEC-117）
exposes:
  - GameState.getModuleEffect(type) / getSortieModifiers()
  - GameState.getStartingChaos()
  - GameState.getModuleMaxHpTier() / canRaiseModuleMaxHp() / raiseModuleMaxHp()
  - GameState.getKindlingReserve() / healModule(id, amount)
  - GameState.getRepairBonusHp() / grantRepairBonus(hp) / getMaxUsefulRepairKindling(hp,maxHp) / previewModuleRepair(hp,maxHp,kindling)
  - SaveManager.allocateToModule(id, amount) -> number（保存失败完整回滚）
  - GameState.isModuleSwapActive() / setModuleSwapActive(active)
  - ImpactSystem.run(defenseSlots, offeringIds?) -> ImpactResult （含 defenseResult；Slice 5.5 增 primaryModuleId / trueSeverity / baseDamagePerModule）
  - ImpactSystem.generateForecast(nextIntensity, forecastReliabilityBonus, nextNextIntensity) / getForecastDisplay() / getForecastLookahead() -> ForecastDisplay
  - ImpactSystem.getForecastState() / loadForecastState(state?) / resetForecastState()
  - applyDefenseEffects(baseDamage, slots, context, offeringIds?) -> DefenseResult
    （Slice 5 新增出口 healOut / bonusCharges / toolUseGrants / moduleSwapTriggered；
     Slice 5.5 新增 slotDisclosures 供结算面板逐槽归因）
  - getDefenseRuntimeState() / loadDefenseRuntimeState(state) / ContaminantRuntimeState
  - AllocationPanel.open(moduleId)
  - BoundaryShape.radiusAt(angle) / normalizedDist(x,y) / isInside(x,y)
  - BoundaryShape.pressureDirection / pressureAt(angle) / tideScale
  - BoundaryBreath.create() / update() （纯视觉叠加层，无玩法输出）
---

# 系统设计：净化点 + 冲击

> **TL;DR**: 定义裂隙出击之外的"基地环"——净化点场景（可步行、潮汐驱动的动态力场边界、六个交互点）、GameState（内存 + `SaveManager` 持久化）、薪柴分配（修复模块 hp）、冲击结算（返回净化点时按潮汐强度扣模块 hp，经防御槽污染物修正）、非空间冲击预告（目标模块 + 强度档位）、三模块效果反馈到出击参数（核心减混乱增速、储藏加薪柴价值、净化器写起始混乱）、蜕变面板内加厚全局抬模块 maxHp。边界形状由 BoundaryShape 统一提供，被地表纹理、碰撞、可见性、氛围与呼吸层共用。

**迭代11 R6呈现更新（2026-09-07）**：冲击结果在现有场景右侧无框展开，16px同族标题、12px正文、全屏渐隐暗场；最大损伤先读，模块前后完整度/供奉作用/转化/预告事实保留。取消独立窗口抖动，使用淡入。Enter/Esc及点击合上沿用原关闭回调；不改冲击计算、归来顺序或存档协议。详细样式只定义于当前UI Kit。

> **Slice 5 变更摘要**（细则见 D/V 组）：预告去掉方向、只报目标+档位（DEC-034）；防御侧 6 处未接线机制全部落地（DEC-029~033）；污染物运行时状态进存档（DEC-032）；模块受损三态视觉阈值登记（DEC-035）；防御槽位数不再固定 3。

> **Slice 7 变更摘要**（DEC-064）：第三模块 = 净化器（完整度 → 出击起始混乱；满完整度起始 0；不改出击起始生命）。加厚：花薪柴全局抬全部模块 `maxHp`，3 档每档 +15（100→115→130→145），效果公式分母仍是基准 100。三模块均参与当前防御合同。**DEC-117：** 加厚并进蜕变面板第七张，不再是世界桩。

## 迭代27：教学首归、稳定度事实与购买持久性

- cycle在出发时递增：出生0，第一趟归来1；仅这两个值跳过冲击，第二趟起恢复正常。跳过不充供奉计数，潮汐仍按归来推进。
- `ImpactSystem.run(slots, offeringIds, random, stabilityProgress)`接收场景查询的当前稳定度供防御上下文；返回`newlyZeroModules`，只统计本次由正生命扣至0的模块，既有0不重复扣。场景在账本的一次归来事务中统一结算稳定度与供奉，不以重复读取面板为事件。
- 成长/加厚统一使用`purchaseGrowth`持久购买事务；加厚拒写时薪柴、档位、所有模块上限还原，成功后才发GROWTH_PURCHASED。维持12/20/32费用和不回血规则。

## 迭代12：世界内前后遮挡（DEC-120）

核心、储藏、净化器、供奉台、培养藏和玩家按地面接触点y升序绘制，y较大者在前；同y按稳定身份排序。五台装置使用现有脚底锚点，玩家使用Player.getGroundY()，不以图像包围框或动画最低像素排序。

GroundDepthSorter把实体名次映射至[20,38)层段，每组本地偏移保持[0,1)。附属实体光效、转身剪影、灯尘和修复闪光跟随所属对象；地面光池固定5，裂隙贴花固定1，模块生命读数固定40（填充40.1），视野遮罩50。不能直接把世界y当depth，也不能只移动玩家主体而遗留灯光穿透。供奉环的透明孔正常透出后方对象，不增加透视轮廓。

排序在玩家物理位置/显示更新后、视野更新前同步；顺序未变时不重复写depth，场景退出释放排序器引用。对象数量超出预留18组上限必须重新规划层段，不能越过遮罩。用户追加授权底座碰撞（I12-C），交互距离保持32px；实体排序规则保持不变。

### 净化点底座碰撞（I12-C，用户试玩后授权）

玩家在净化点以12×8脚底AABB移动，贴图内offset(10,22)；中心与groundY一致。装置静态AABB以各自世界锚点加偏移生成：核心22×10、(0,-1)；储藏24×12、(0,-2)；净化器24×10、(0,-2)；供奉18×8、(0,-1)；培养藏26×12、(1,-3)。数值为物理系统常量，不随动效帧或完整度改变。

正面持续移动会停在底座前，斜向接触保留Arcade分轴滑动。不得弹开、吸附或擅自寻路；不得用高贴图整框、光池或投影扩碰撞。排序线位于不可穿越的占地范围内，角色需绕过侧面才能从前方走到后方。供奉环为竖直结构，孔不构成地面通道；裂隙入口地面贴花不碰撞。装置碰撞不加入视野遮挡。

边界通行护栏：原角向余弦约束只保护交互点所在射线，加入底座后可在净化器两侧形成死角。保留该约束，并对每个交互点增加32px脚底中心可走圆盘的真实极射线远交点下限；圆盘半径补上脚底半对角线约7.21px与8px边界方块半对角线约5.66px，求交后除以0.98抵消边界内缩。查表取每1°区间内的最大下限并加0.001px浮点余量。只在旧形状不足处局部托住边缘，不改变全场基础椭圆/压力值；地表、视野、碰撞共用修正后的BoundaryShape。

现有32px交互半径足以覆盖各侧接触点，保持按E规则；默认出生/归来在底座外。净化点场地边界亦使用此脚底体。裂隙/练习场的玩家默认20×20中心体不变。场景退出清理底座静态组和collider，重入重新创建。

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
  repairBonusHp: number;          // 已挣得、未消费的一次修复额度；旧档默认0
  upgradeDiscount: number;        // overwrite 的改造折扣
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
  repairBonusHp: number;          // 本次承伤挣得的一次额度，取最高值不叠加
  healOut: Record<string, number>;        // combust 焚尽返还
  bonusCharges: Record<string, number>;   // 兼容字段，当前13族为空
  toolUseGrants: number;                  // 兼容字段，当前13族为0
  moduleSwapTriggered: boolean;           // 兼容字段，当前13族为false
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
  solidifyCounter?: number;       // 旧存档兼容字段；凝滞的石块不再累计碎裂
  combustAccumulator?: number;    // 旧存档兼容字段；冷却的余烬不再累计焚尽
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
2. **六个交互点**：场景中有六个交互点，都以 `INTERACTION_RADIUS`（32px）判定走近，走近后按 E 触发：

    | 交互点 | 位置（相对中心） | 载体 | 按 E 的结果 |
    | ------ | ---------------- | ---- | ----------- |
    | CORE | 正中心 | `PurificationModuleEntity`（带 hp 与三态视觉，V 组） | 打开分配面板（A 组） |
    | STORAGE | 右 3.5 tile | 同上 | 打开分配面板 |
    | PURIFIER | 下 3.5 tile | 同上（第三模块；几何/色由 art 只引用已锁板） | 打开分配面板 |
    | 裂隙入口 | 上 4.0 tile（钳制半径等于椭圆北沿，不把膜顶出一包） | **地面裂缝贴花**（40×56 × 8 帧、6fps；生产默认卡 5 击裂，DEC-114）。画在地面平面内，锚点取中心，层压在地板之上玩家之下，玩家能踩过去。贴图缺失才回落呼吸圆点 | 打开出击装配面板，确认后出击（F 组） |
    | 防御点 | 左 3 tile / 下 2.5 tile | **供奉台卡 I 环**（32×32 × 32 帧、6fps；生产默认 DEC-115）。立着、45° 等距，锚点脚底，层与读数桩同层。装填光点三档 = 槽里 1 / 2 / 3+ 个残渣（空档不亮；第 4 槽不另开一档）。贴图缺失才回落呼吸圆点 | 打开防御槽面板（`system-growth-tide` CN 组） |
    | 改造祭坛 | 左 3.5 tile | **培养藏卡 A 立缸**（40×42 × 8 帧、6fps；生产默认 DEC-116）。立着、45° 等距，锚点脚底，层与读数桩同层。贴图缺失才回落呼吸圆点 | 打开蜕变面板（`system-growth-tide` G 组）。加厚是该面板第七张（U 组 / DEC-117），不是场上另一处 |

   同一时刻只对**最近的**可交互点显示提示条；优先级顺序为 CORE → STORAGE → PURIFIER → 防御点 → 改造祭坛 → 裂隙入口。任一面板打开期间提示条隐藏且 E 不再响应。六点同时是边界安全区钳制的约束源（规则 40）。
3. **交互点的呼吸节奏**：**裂隙入口自 DEC-113 起不再走同心圆呼吸函数**——它是地面裂缝贴花；圆点只作贴图缺失时的回落。**防御点自 DEC-115 起也不再走这个函数**——它是立着的供奉台（卡 I 环）；圈心里那团装填光点是它的活层；圆点只作贴图缺失时的回落。**改造祭坛自 DEC-116 起也不再走这个函数**——它是立着的培养藏（卡 A 立缸）；圆点只作贴图缺失时的回落。呼吸速度有三档：常态 / 玩家靠近 / **待处理高亮**（如有未装配的残渣、可刻入的改造、或下一档加厚费用不超过当前薪柴）。高亮是"这里有事要做"的提示，不是装饰。裂隙入口永不高亮——它始终可用，高亮会变成噪音；改成贴花之后这条仍成立（贴花不做靠近强调）。防御点 / 改造祭坛贴图在时，待处理高亮走提示条，不在装置外再画圈。培养藏在「有可刻入的改造，或下一档加厚费用 ≤ 当前薪柴」时高亮；六卡与三档加厚都加尽后不再因它们高亮。
4. **边界**：安全区外是虚空，但边界本身不是硬边——从内向外依次是变暗带、teal 膜带、虚空（梯度带定义见 B 组）。边界处有粒子系统：微粒在当前边界外 10-40px 处生成，缓慢向内漂移，越过该角度半径的 50% 或寿命耗尽后重新生成，常驻 `PARTICLE_COUNT` 个。颜色以暗 teal 为主（60%），亮 teal 与灰各占 20%。生成与消亡半径跟随当前边界形状，不是固定圆。
5. **Apparition**：每 8-15 秒（随机），在当前边界外 40-80px 处出现一个模糊人形轮廓（alpha 0→0.3 淡入 0.5s → 持续 2s → 0.3→0 淡出 0.5s）。不移动，角度随机，生成距离以该角度的边界半径为基准，最多同时 3 个，颜色为暗青灰。纯氛围，无游戏功能。
6. **视觉基调**：地面为冷蓝灰的程序化石板（中心略暖、向边缘转冷并逐级压暗），ambient 使用 omni 模式；玩家的肩灯是场景中唯一的暖色。
7. **冲击预告是非空间的**（DEC-034，改写自旧的"粒子密度指向预告方向"）：预告只播报两件事——**下次冲击的重点目标模块** 与 **强度档位**（light / moderate / heavy / extreme 四档）。它不给方向。
    - **HUD 展示**（Slice 5.5 DEC-048 贴顶横槽，只改展示、不改结算/数值）：净化点常驻 HUD 用文字写明，三个独立可见节点——时机 `下次归来`、目标全称 `核心` / `储藏` / `净化器`（对应 CORE / STORAGE / PURIFIER；与底栏 / 结算已上屏用词一致）、档位中文读 `ImpactSystem` 导出的 `SEVERITY_LABEL`（light→轻微 / moderate→中等 / heavy→剧烈 / extreme→极端）。HUD **必须 import 这一份标签**，禁止另造「轻/中/重」平行表。常驻 HUD 不画 ◈/▣ 与 4 格 pip。
    - **旧档已承诺的第二轮预告**（仅 `getForecastLookahead()` 非空）：同样三节点，但时机词必须是 `再下一轮`（不得再用 `下次归来`，以免读成第二份现在）。目标名与档位名同一套。可更淡、无临界脉动，文字节点不得省略。
    - **为什么不给方向**：旧实现把 CORE 映射为"左"、STORAGE 映射为"右"，而 CORE 就在场地正中心——"左"是任选的，玩家无法据此做任何决策；同时它与边界压力主方向（规则 37/42/47）叠成两个互不相关的方向暗示。
    - **方向暗示的唯一合法来源是 BoundaryShape 的压力可视化**。那是全系统唯一有真实空间语义的方向源。预告不再与它争夺同一维度。
    - 预告仅在首次建立或实际冲击消费后生成，用潮汐推进后的真实下一轮强度；同轮菜单/读档/重复进入只恢复原读数，不重抽。
    - 档位分界按潮汐强度区间 [1.0, 3.0] 四等分：< 1.5 light / < 2.0 moderate / < 2.5 heavy / 其余 extreme。extreme 档的临界脉动（300ms）可留作第二编码，不能代替可见词「极端」。边界粒子恢复各角度均匀生成，不再做方向暗示。

### G — GameState

8. **初始状态**：`kindlingReserve = 0`，`cycle = 0`，`impactIntensity = 1.0`，`moduleMaxHpTier = 0`，三个模块（CORE / STORAGE / PURIFIER）各自 `hp = MODULE_INITIAL_HP = 70`，`maxHp = MODULE_BASE_MAX_HP = 100`。老存档缺 PURIFIER 或缺 `moduleMaxHpTier` 时：补第三个模块为 `70 / 当前档位 maxHp`，档位缺省 0；不得把老档判损坏。
9. **内存单例 + 持久化**：GameState 是模块级单例（DEC-ARCH-002），跨场景存活。它同时被 `SaveManager` 持久化到 localStorage——存档写入点包括归来世界结算、有效注入、库存操作与出击前，读档由主菜单驱动。落存档的字段见状态模型；污染物运行时状态走同一通道（规则 60）。
10. **薪柴入账**：从裂隙返回时（`RIFT_EXITED.survived === true`），`kindlingReserve += kindlingGained`。死亡时 `kindlingGained = 0`，不入账。
11. **周期计数**：每次进入裂隙时 `cycle++`。
12. **冲击强度由潮汐驱动，不自增**：`impactIntensity` 不再逐周期 +0.15。每次从裂隙返回、结算冲击之前，由场景层把 `tideSystem.getCurrentIntensity()` 同步写入 GameState，冲击读这个值。强度的涨退规则归 `system-growth-tide` 的 T 组（`INTENSITY_STEP` / `MAX_INTENSITY` 两个旧常量已从 `constants.ts` 移除）。`incrementIntensity()` 已删除。

### A — 分配系统

13. **触发**：玩家走到模块交互点按 E → 打开 DOM overlay 分配面板。
14. **面板内容**：显示当前 `kindlingReserve`、目标模块 `hp/maxHp`、滑块或 +/- 按钮选择分配数量。效果预览按模块类型分开展示表名与数值：核心 = 表名 `混乱增速` + 减免百分数；储藏 = 表名 `薪柴价值` + 倍率；净化器 = 表名 `起始混乱` + 整数（当前 → 注入后）。当前操作只展示该装置的修复与出击效果，其他装置现状保留在报告。
15. **修复公式与有限额度**：每1薪柴修复 `REPAIR_PER_KINDLING` 完整度（4）。附着的空壳在实际承伤后令 `repairBonusHp = max(已有额度, defense_repair_bonus_hp)`（6），下一次有效薪柴注入额外修复至多此额度；一笔注入后归零，多余修复不返还、不分次囤积，不能超过maxHp。未受伤、0薪柴、无库存或无效模块不消费额度，直接 `healModule` 不消费。放入/取下供奉本身不授予或撤回额度，没有常驻修复倍率。
    - 当缺血时，最大有用薪柴为 `max(1, ceil((maxHp-hp-repairBonusHp)/4))`，再受库存限制；满血为0。预览和实算读同一GameState方法。
    - `repairBonusHp`写入同一存档，旧档缺省0；非法负数或非整数拒绝整体加载。出击不凭空清除已挣得额度。
16. **确认与持久化**：`SaveManager.allocateToModule`快照薪柴/模块/额度 → 计算注入 → 同步保存 → 成功后才发 `ALLOCATION_CONFIRMED`。保存失败完整恢复三个字段，面板显示失败可重试，不能播成功反馈。成功展示650ms已生效读数后退出；期间禁止重复投入。
17. **取消**：点击取消或按 ESC → 关闭面板，不扣资源。
18. **非强制**：玩家可以选择不分配任何薪柴就直接进入裂隙（风险策略）。

### I — 冲击系统

19. **触发时机是"返回净化点的那一刻"**，不是"按 E 出击之前"。玩家从裂隙回来、净化点场景 `create()` 时按序执行：潮汐强度同步 → 快照供奉槽实例ID → 冲击/防御完整结算 → 非跳过冲击增加供奉计数并完成转化 → 潮汐推进 → 预告重算 → 同笔世界存档。从菜单/读档进入净化点不触发冲击。
    - 设计后果：玩家是**带着冲击的结果**开始这一轮的分配与装配决策，而不是分配完再挨打。整个驻留期间看到的模块 hp 就是出击时的 hp。
20. **首次豁免**：`cycle <= 1` 时跳过冲击（返回 `skipped: true`）。第一次出击是"教学局"。
21. **基础伤害**：`BASE_IMPACT_DAMAGE`（= 30）× `impactIntensity`。
22. **威胁分布**：一个模块为"重点目标"，承受 `THREAT_FOCUS_RATIO`（65%）伤害；**其余伤害在其他全部承血模块之间均分**（两模块时另一个拿 35%；三模块时另外两个各 17.5%，四舍五入后用最后一个模块吃残差，保证总和等于本次总伤害）。预告从**全部**承血模块中均匀抽 ground-truth 目标。无可信承诺的冲击结算以 `FORECAST_ACCURACY`（0.8）的概率匹配预告，否则在其余模块均匀抽选；记忆碎片已承诺的目标必定兑现（规则25）。禁止再写死 `modules[0]` / `modules[1]`。
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
25. **普通预告与可信承诺**：
    - **普通预告**：生成时随机挑一个模块作为预测目标（`forecastTargetId`）。没有可信承诺时，实际重点目标有 `FORECAST_ACCURACY`（0.8）的概率等于它。目标显示不额外谎报，强度可能有基线模糊（规则52）。
    - **记忆碎片承诺**：记忆碎片实际在供奉槽承受一次非跳过冲击后，为下一轮生成准确目标与强度。单纯放入/查看/取出不升级当前预告、不获取免费前瞻；最后成熟的那次冲击同样记下一轮。已承诺内容即使物件撤下或成熟也必须兑现。
    - 普通目标命中率与强度模糊分别判断；可信承诺的目标和强度均准确。

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
    - LootSearchSystem（迭代 10 前为 LootSystem）的实际拾取价值 = `nodeValue * kindlingValueModifier`（向下取整，最低 1；翻找完成结算时应用）
    - ChaosSystem 开局 `value` = `SortieModifiers.startingChaos` 再叠加防御残留（规则 31a）。**不改**基础上涨曲线、阈值、惩罚映射。

### F — 场景切换

30. **裂隙→净化点**：`RIFT_EXITED` → RunController 延迟 600ms → `scene.start('PurificationScene', { kindlingGained, survived })`。进入后立即结算冲击（规则 19）。
31. **净化点→裂隙**：玩家在裂隙入口按 E → 打开出击装配面板 → 确认 → `cycle++` → 读取 `getSortieModifiers()`（此时 `moduleSwapActive` 已生效，规则 55；`startingChaos` 已按规则 27b 算好）→ 存档 → emit `RIFT_ENTERED { cycle }` → 0.3s 边缘内收辉光 + 0.5s 文字过场 → `scene.start('RiftScene', { modifiers, cycle, loadout })`。取消装配面板则留在净化点。
31a. **出击初值合成**：RiftScene 创建 ChaosSystem 时一次写入

    ```
    value0 = clamp(modifiers.startingChaos + Σ initial_chaos, 0, CHAOS.HARD_CAP)
    ```

    `initial_chaos` 仍走既有防御残留（ruminate +5、erode 概率 +8 等；首批八件不再附带旧残留），用 `addImmediate` 之前先把净化器部分写进初值，或把两笔合成后再 set——**禁止**开局拆成两次「穿越阈值」闪白。若 `value0` 已越过某阈，该阈视为已触发（不播跨阈演出），只对之后继续涨过的更高阈闪。增长曲线本 Slice 不改。
32. **RiftScene 接收 modifiers**：在 `create()` 中读取 `this.scene.settings.data`，应用 `chaosRateModifier`、`kindlingValueModifier`、`startingChaos` 到对应系统。
33. **死亡时**：`RIFT_EXITED { survived: false }` → 同样切换到净化点，但 kindlingGained=0（已在 Slice 1 RunController 中实现）。

### B — 边界形态与呼吸（Slice 4.5）

34. **边界是一条极坐标曲线**：净化点边界为一条闭合的极坐标曲线（力场气泡）。基础形状是椭圆（`ELLIPSE_RX` × `ELLIPSE_RY`）。任意角度上的最终半径由三层修正依次得到：潮汐缩放 → 方向性压力 → 安全区钳制。
35. **每次场景构建计算一次**：边界形状在进入净化点时依当前潮汐状态与周期数计算一次，此后是无状态的廉价查询对象，不随帧变化。形态的变化发生在两次出击之间，不发生在一次驻留之内。
36. **潮汐缩放**：设 `t = clamp01((intensity - 1.0) / 2.0)`，整体半径乘以 `1 - t * (1 - SHRINK_AT_MAX_INTENSITY)`。intensity=1.0 时为基础尺寸，intensity=3.0 时整体收缩 28%。intensity 的定义与推进归 `system-growth-tide` 的 T 组。
37. **方向性压力叶**：两个高斯叶沿角度分布，把半径按比例向内压——半径乘以 `1 - pressure(angle)`。主叶振幅 `PRESSURE_PRIMARY_AMP`，次叶 `PRESSURE_SECONDARY_AMP`，角宽均为 `PRESSURE_LOBE_SIGMA`。压力不均匀：外界污染不从各个方向等量推进。
38. **压力方向按周期确定性变化**：主叶方向由 `cycle` 派生的种子决定——同一周期内反复进出净化点得到同一形状，跨周期改变。次叶方向 = 主叶 + 0.6π + 0～0.4π 随机量，即两叶至少相隔 108°，不会重合成单一深凹。
39. **相位调制压力**：`crest` 相位两叶振幅 ×(1 + `PRESSURE_CREST_BONUS`)，`ebb` 相位 ×`PRESSURE_EBB_FACTOR`，`rise` 相位不调制。高潮期气泡被挤得更扁，退潮期回弹。
40. **安全区钳制（硬保证）**：六个交互点（CORE / STORAGE / PURIFIER / 裂隙入口 / 防御点 / 改造祭坛。防御点与改造祭坛由 `system-growth-tide` 引入；加厚已并进蜕变面板，不再是约束源，DEC-117）各自要求其所在角度上的半径不低于「该点到中心的距离 + `SAFE_MARGIN_TILES`」。约束以 ±30° 的余弦衰减摊进一张 360 格（每度一格）的最小半径查表，最终半径取「原始半径」与「该角度最小半径」的较大者。I12-C追加精确局部圆盘护栏（见本文「净化点底座碰撞」）：最终半径还须不小于圆盘远交点下限，补偿脚底体、边界方块、0.98内缩与角查表误差。SAFE_MARGIN_TILES现保证脚底中心可行区，不能只保护一条射线。气泡可以被挤瘪，但不能夹住交互点周边绕行通道。
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

### D — 防御结算（迭代20当前合同）

供奉槽位与成熟由统一库存拥有。下述只定义冲击时的完整效果。策划数值唯一来源 `data/contaminants.csv`；同族品质不改变供奉规则或阈值。

51. **顺序与叠加**：只处理本次快照中 `stage === defense` 的物件；武器无额外减伤。
    1. 各件基础减伤以 `(1-r)` 乘算。
    2. 有重影碎片则将减伤后的总伤害四舍五入、均分至全部模块，余数按模块稳定顺序补齐；否则各模块保留浮点至局部减伤完毕。
    3. 留影玻璃削弱非主要目标余波；沉重的石块只削弱主要目标；映出别处的珠子逐模块判定冲击前完整度并替换本件减伤倍率。局部倍率逐件乘算后四舍五入。逐槽挡下的整数总和必须等于基础总伤害减最终总伤害，最后一个有效减伤槽吸收舍入差，不能产生负贡献；伤害转移不算挡下。
    4. 打结的细线从主要模块转移至多4点伤害，接收方为模拟扣血后余血最多的另一模块；不能将接收方降至0或以下。多件按槽顺序计算，后件看到前件转移后的伤害。总伤害守恒，不是事后均摊完整度。
    5. 依据各模块实际可承受伤害的总和计算冷却的余烬修复与附着的空壳有限修复额度。
    6. 所有物件完整参与后才由同一供奉快照推进成熟。末轮效果有效；正常供奉不再产生退休族的随机跨槽计数或工具补次。

51a. **八族延续**：凝滞的石块35%；重影碎片只均摊；记忆碎片15%并在本轮承冲击后记下一轮；消声的旧布30%；带缺口的石头40%；留影玻璃25%并额外削弱余波25%；回声空壳20%；冷却的余烬25%并返还本轮承伤20%为局部修复。无旧碎裂、初始混乱、改造折扣、视野惩罚。

52. **预告与信息成本**：
    - 普通目标命中率80%；普通强度有20%模糊至相邻一档，成长每级降低5个百分点、最低5%。可信记录不走这两个随机分支。
    - 记忆碎片必须实际占槽参加非跳过冲击，产生 `earnedPending`；潮汐推进后创建下一轮读数时将其转换为一个准确目标及强度并清除标志。多件不叠存多轮。最后成熟的一次同样授予。
    - 插槽、刷新HUD、重复生成、菜单重入和出击cycle变化均不制造信息。仅真实冲击消费一次当前读数。
    - 已发布承诺不可撤回。旧存档中已发布的双轮承诺按原当前/队列自然兑现；新规则不再生成第二轮前瞻。无新承冲击收入且旧队列耗完后恢复普通预告。
    - `impactForecast`保存目标、显示、可信/消费标志、旧前瞻队列及 `earnedPending`。旧字段缺省兼容；非法快照在加载前拒绝。保存失败恢复生成前状态，重试只保存一次，不能重放冲击或重复授予。
    - 这不定义裂隙刷新/退出/崩溃的恢复政策。

53. **映出别处的珠子（abyss）**：基础减伤20%；每个模块分别用冲击前 `hp/maxHp <= defense_low_hp_threshold`（40%）判断，符合者本件改为50%减伤，其他模块仍20%。不能因别的模块残血给全场额外防御；本次被打至阈值以下不追溯触发。无随机暗伤。

53a. **打结的细线（stitch）**：基础减伤20%，按规则51转移至多 `defense_transfer_cap`（4）点主要伤害。接收方扣血后至少留1点；没有安全接收方时不转移。`SlotDisclosure.transferredDamage/transferModuleId`披露实际转移，旧 `stitchEqualization`仅兼容为空。

54. **冷却的余烬（combust）**：基础25%；实际承伤总量乘20%向下取整，修复扣血后余血最低模块，考虑前件已修复量、上限缺血量。0承伤不产生修复，无阈值累积或副作用。

55. **附着的空壳（siphon）**：基础15%；仅实际总承伤>0时授予一次最多6点修复额度，取已有/本次的最高值而非相加。兑现、保存、失败回滚见规则15/16。末轮照常，插入不授予。

56. **不落的砂砾（delay）**：稳定减伤30%。不转化为后续混乱，也无隐藏偿还。

57. **沉重的石块（compress）**：没有全体基础减伤；仅对本轮主要目标的剩余伤害额外减半。无出击腿软。

58. **留影玻璃（mirror）**：基础25%，各非主要目标额外乘75%；多件乘算并披露，不返薪柴或谎报预告。

59. **退休机制**：反刍/共振/覆写/侵蚀/回响旧族由物件迁移合同映射至当前族，停止新掉落。防御引擎不再产出返薪、换模块、折扣、随机副作用、跨槽充能或工具补次。旧接口返回空值用于兼容，不能被当成仍可获取的效果。

60. **持久化**：旧 `solidifyCounter` / `combustAccumulator` / `echoBonusGranted`仅兼容保留，不驱动当前防御。有限修复额度由GameState拥有，预告由ImpactSystem拥有，统一SaveManager落盘；不将额度绑在已成熟/撤下物件上。

61. **槽数**：基础3、成长解锁第4，上限4。引擎遍历实际传入快照，不写死长度，不先成熟再算效果。

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

64. **全局抬上限**：蜕变面板第七张「加厚」花薪柴永久提高**全部**承血模块的 `maxHp`，不按模块分别升级。档位与费用：

    | 已买档 `moduleMaxHpTier` | 全部模块 `maxHp` | 下一档费用（薪柴） |
    | ------------------------ | ---------------- | ------------------ |
    | 0 | 100 | **12** |
    | 1 | 115 | **20** |
    | 2 | 130 | **32** |
    | 3 | 145 | 不可再买 |

    每档 +15。费用对照 `upgrades.csv`：单轴 3 级约 8/12/18、预告可靠度 10/20/30、第 4 槽一次性 35/40。加厚是三模块同涨的血池，略高于单轴蜕变、低于第 4 槽。一趟地图总价值 17（储藏满加成后约 25）；第 1 档 12 ≈ 大半趟保守搜刮，可负担、不白送。费用是系统常量，**不**进 `upgrades.csv`，**不是** `GrowthUpgradeId`。出现在蜕变面板第七张，哨兵 id `thicken`（DEC-117）。
65. **存档**：`moduleMaxHpTier` 必须写入存档。`maxHp` 可由档位重算（`MODULE_BASE_MAX_HP + MODULE_MAX_HP_PER_TIER * tier`），存档里的模块 `maxHp` 若与档位不一致，以档位为准并写回。抬档时**当前 hp 不变**（不免费回满）；若出现 hp > 新 maxHp（不应发生）则 clamp。蜕变折扣 `upgradeDiscount` **不**作用于加厚费用。
66. **稳定度**：加厚不是蜕变刻入，**不计**「购买任意改造升级 +3」。
67. **玩家可见名**：卡名与动作都叫 **加厚**。禁止「升级」「购买」「确认」「MAX」。世界装置仍是培养藏；走近提示「蜕变」。面板内用词见 UX 组。

### UX — 全游戏界面重构（迭代 11，DEC-119）

本节原地替换 DEC-118 的旧墙机结构与尺寸约束。用户已授权重新编排全部游戏界面；当前共享视觉规范唯一来源是 `docs/design-notes/ui-art-overhaul.md` A 节。玩法、资源公式、CSV、存档接口不变。画面仍待本轮人终审，不能沿用前轮通过记录。

#### 挂载、共享壳与信息归属

屏幕空间仍挂 `#dom-ui-root`，随960×640逻辑画布统一缩放。普通交互沿用当前UI Kit：主面板680×468、分配450×452，正文12px、标题20px，同族无衬线与半透明暗色材质。HUD已获人95分PASS。R4核心样板已获用户接受，R5将其场景构图推广到六个交互点：核心实体位于镜头左侧，读数贴近实体，投入及效果在右侧渐隐暗处展开，没有矩形底板。

装置完整度必须限定核心/储藏/净化器，自身完整度必须写出“自身”。出击条件只读取已有 `getSortieModifiers()` 三项：混乱增速、薪柴价值、起始混乱。不得新增风险分、生存评分或无机制支撑的收益。

#### 存续报告

- `Tab` 打开/关闭，`Esc` 关闭。保留四个分页：装置、物件、潮汐、蜕变；`[` / `]` 切页，鼠标点分页走同一状态。
- 装置页左侧为三模块纵向列表，名称、当前/上限、完整度条共同显示。右侧只解释当前模块的状态和作用；随后紧接“下次踏入”的自身完整度和三项并列出击条件，不把预估吸到底部。`←→` 循环选择模块；点击模块选择同一个详情。功能互换生效时准确说明核心与储藏互用完整度。
- 物件页（DEC-142）嵌入同一实例库，统一列出武器与技能污染物，按种类筛选并检视阶段、余次、固有属性；无基地负重。允许长按丢弃和前往供奉，装备配置仅在备行完成。独立B背包已移除。
- 每种技能污染物独立24px图标，供奉前后共用其物件身份；状态由文字说明。空库说明裂隙翻堆来源与下一步，不承诺本页可直接出击。
- 潮汐页突出下次归来冲击预告的目标与强度，档位沿用 `SEVERITY_LABEL`；潮汐编号与阶段独立显示。长期稳定度另分区呈现百分数及完成状态，仍不暗示未实现终局。
- 蜕变页显示已有加厚档位、模块上限与已刻入列表；选中仅检视。未刻入时说明前往培养藏消耗薪柴，不显示本面板内不能执行的 E 提示。

#### 分配

依次显示装置现状、投入数量、注入后的完整度及效果、剩余薪柴。当前模块名出现在标题，投入数量是调整对象，不使用列表选择刻线。完整度条区分当前段与预估修复段；数量为 0 时仍有清楚数值。

- `←→` ±1、`Shift+←→` ±5、`Home` 归零、`End` 拉满；鼠标减/加采用26×26命中区，共用当前可投入上限。边界按钮禁用。
- `Enter` 或点击注入执行原分配流程；只有投入大于0时可执行；核心样板保留禁用按钮表示当前不可投入。`Esc` 或点击离开取消。
- 不可注入原因按真实状态显示：装置已完整、暂无薪柴、尚未选择数量。无薪柴时解释翻找并撤离的来源；有修复但效果未变化时直说本次不改变该项出击效果。
- 剩余薪柴与兑换效率紧随修复结果。不重复列出其他装置完整度和最便宜蜕变价格，相关信息仍在报告/蜕变页。
- 预览保持 0 投入等于当前 `getSortieModifiers()`；功能互换、共振与净化器比例均沿用已有公式，不改系统接口。

#### 场景交互正式接入（R4核心人PASS；R5六点推广）

- 六点E交互走同一场景聚焦路径；核心、储藏、净化器接地点目标(320,330)，供奉/蜕变/入口为(184,330)。260ms聚焦至zoom3，核心接地点目标(320,330)；实际相机投影每帧提供给DOM，适配固定画布缩放。真实核心贴图、呼吸、场景与玩家仍可见。
- 交互只暂停玩家输入，场景持续运行。所操作模块的世界HP条临时隐藏，场景交互显示唯一完整度/修复预览；关闭镜头恢复后原HP条恢复。
- 确认复用原allocateToModule及ALLOCATION_CONFIRMED，即时扣资源/修复；三装置复用已有柔光纹理呈一次短呼吸，核心/储藏暖色，净化器灰绿。650ms展示已生效结果，阻止重复确认，再用180ms镜头恢复原视角，恢复完成才启用玩家输入。Esc可提前离开，已结算资源不会回滚。
- 退出期间E/Tab/暂停不抢开；开发切屏即时恢复镜头；scene shutdown只丢弃焦点状态，因为CameraManager先销毁相机，不再触碰main。DOM跟踪/提交计时器清理。入口确认不先恢复镜头，直接出击；转场300/500ms计时器归场景Clock并在shutdown移除，防止旧回调拉走新场景。
- 开发直达 `ui-review.html?sample=world`，六点切换保留资源，独立重置85薪柴/零库存；原sample=core仍可用。示例不读写正式存档。复用生产交互，不加入生产HTML构建。

#### 供奉、蜕变、踏入准备

- 供奉与装配用槽位/可用库存为主区、选中详情为从区。长库存只在内容区滚动，底部动作保留。槽位数量与工具类别读取运行时系统，不写死槽数。
- 供奉库存同时包含未供奉武器与技能污染物；区分尚无物件和物件已全部投入。武器明确只积累供奉进度，技能保留现有防御说明；槽位、充能与完成后的余次均读取同一实例。世界供奉环的装填档同样统计两类物件。
- 装配无工具时解释供奉充能后转化；工具全部已装时显示“工具已全部装填”。始终明确空槽不阻止踏入，指向底部实际踏入动作，不在错误焦点承诺 Enter 立即出击。
- 踏入准备固定底栏始终显示可点击“踏入裂隙”及全区有效的 `Shift+Enter`。普通 Enter 继续执行当前焦点的装填/取下/动作；三条踏入路径共用一次执行函数，不要求先切到动作区。
- `Tab`/`Shift+Tab` 切槽位、库存与动作区；方向键浏览；`Enter`/空格执行当前区域动作；鼠标保留已装填槽点击取下、库存点击自动放入首个兼容空槽。槽满显示原因，不改变装备规则。
- 蜕变用六个改造与加厚的列表、单项选中详情组织。列表显示名称、现有等级、费用；详情显示当前/上限、已有升级预览、消耗及完成后剩余。不可用写“薪柴不足，还差 N”或“已至上限”；不把所有卡的说明同权平铺。
- 蜕变保留方向键选择、Enter/空格执行、鼠标点击卡执行，以及关闭动作；加厚仍是同一个面板内的既有动作，不开新确认窗、不改费用/折扣/稳定度机制。

本节只约束 UI 表达与已有交互路径，不更改世界装置外观、冲击结算或玩法。完整回归覆盖零资源/可投入、空库存/已装备、满槽、成长不足/满级，以及键鼠切换后的选中详情一致性。

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
| combust 修复比例 | 0.20 | -- | `contaminants.csv` `defense_heal_ratio` | 本轮实际承伤转为修复 |
| mirror 余波减伤 | 0.25 | -- | `contaminants.csv` `defense_secondary_reduction` | 非主要目标的额外减伤 |
| 档位模糊概率（基线 / 地板） | 0.20 / 0.05 | -- | impact-system 内联 | 被 forecast_clarity 削减到地板为止 |
| 档位分界 | 1.5 / 2.0 / 2.5 | -- | impact-system 内联 | 潮汐强度 [1.0, 3.0] 四等分 |
| `growth_forecast_clarity` | +5%/级，3 级 | -- | `upgrades.csv` | 削减普通预告强度模糊概率；记忆碎片承诺直接准确 |
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
| `SAFE_MARGIN_TILES` | 1.0 | 0.75-1.5 | 交互点周围脚底中心可行区半径；实体/边界离散余量另计（I12-C） |
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
| 加厚后未注入、净化器 100/115 | 起始混乱 = round(50 × (1 − 100/115)) = 7。CORE/STORAGE 效果仍按 min(hp,100)/100 封顶，不降 |
| 加厚时薪柴不足 | 不扣、不抬档；蜕变第七张写 `还差 N` |
| 加厚已至第 3 档 | Enter 无效果；卡上写 `已至上限` |
| 老存档只有两个模块 | 补 PURIFIER 70 / 当前档位 maxHp，`moduleMaxHpTier` 缺省 0 |
| `combust` 释放时最低 hp 模块已满血 | 修复量按 clamp 到 maxHp 计，多余部分不转移给另一个模块，直接丢弃 |
| 老存档没有污染物运行时状态字段 | 以空态载入（规则 60），不视为损坏存档 |
| 同类污染物多件同时在防御槽 | 减伤各自乘算叠加；`stitch` 逐件安全转移；`mirror` 余波逐件乘算；`combust` 逐件分配修复 |
| 分配超过 reserve | UI 不允许输入超过 reserve 的值 |
| 修复超过 maxHp | 多余部分不退回，clamp 到 maxHp（UI 应提前 clamp 可分配量） |
| cycle≤1 跳过冲击 | 第一次出击是"教学局"，让玩家先体验基线难度 |
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
| LootSearchSystem（迭代 10 前为 LootSystem） | `kindlingValueModifier` | 乘在 node.value 上 |
| HUD / 结果面板 | `GameState.getKindlingReserve()` / `getModules()` / `getStartingChaos()` | 查询 |
| GrowthPanel | `GameState.raiseModuleMaxHp()` / `getModuleMaxHpTier()` | 加厚（蜕变第七张） |
| PurificationScene | `ImpactSystem.run(defenseSlots): ImpactResult` | 方法调用（槽位由场景传入，避免系统互相 import） |
| 净化点 HUD | `ImpactSystem.getForecastDisplay()` / `getForecastLookahead()` | 查询（时机词 + 模块全称 + `SEVERITY_LABEL`；图标/pip 最多第二编码） |
| PurificationScene | `ImpactSystem.generateForecast(nextIntensity, forecastReliabilityBonus, nextNextIntensity)` | 方法调用（强度与改造等级由场景读取后传入） |
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
| T9 | RiftScene 接收 modifiers、ChaosSystem/LootSearchSystem（迭代 10 前为 LootSystem）应用 | code |

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
| `src/systems/defense-engine.ts` | context包含三个模块；按当前逐模块低血减伤与安全伤害转移 |
| `src/systems/chaos-system.ts` | 构造/reset 接受出击初值（增长曲线不改） |
| `src/scenes/purification-scene.ts` | 净化器实体；培养藏卡 A；安全区钳制六点 |
| `src/ui/dom/growth-panel.ts` | 蜕变六卡 + 第七张加厚 |
| `src/ui/dom/allocation-panel.ts` | 净化器效果行 `起始混乱`；机会成本其余两模块 |
| `src/ui/dom/loadout-panel.ts` | 出击属性加 `起始混乱` 节点 |
| `src/ui/dom/purification-hud.ts` | 预告目标名含 `净化器` |

---

## 未接线 / 待清理清单（2026-08-12 依代码核对，登记在案不静默）

回填时逐条核对了代码，以下缺口**已确认存在**。它们不是设计变更，而是"规则已定、代码未到"或"代码残留"。写在这里以免下次有人把它们当成新发现重新论证一遍。

| # | 项 | 性质 | 位置 |
| - | -- | ---- | ---- |
| 4 | ~~`GameState.incrementIntensity()` 的 +0.15 残留~~ | **已删**（2026-08-20）。冲击只读潮汐同步值 | 规则 12 |
| 5 | `IMPACT_STARTED` / `IMPACT_RESOLVED` / `MODULE_DAMAGED` / `RIFT_ENTERED` 只发不收 | 事件保留，演出走返回值 | 事件契约段 |
| 6 | `BOUNDARY.BREATH_*` 五个死常量 | 旧方案残留（Slice 5 的 B4 负责清理） | 边界形态数值表下的注 |
| 7 | `DefenseContext.stabilityProgress` | 迭代27已由场景传入当前稳定度；不再恒0 | `impact-system.ts` |

---

## 校准问题（试玩时关注）

- [ ] **BASE_IMPACT_DAMAGE=30 是否让模块 hp 下降得太快/太慢？** 期望：3-4 次出击后如果不修复，至少一个模块到达 0。注意这个值现在还要乘潮汐强度（1.0-3.0），高潮期单次总伤害可达 90。
- [ ] **REPAIR_PER_KINDLING=4 是否让修复过于吃紧？** 一次冲击（强度 1.0）打掉约 30 hp，需要约 8 薪柴才能补回。这是刻意的稀缺感还是让分配变成了无意义的苦工？
- [ ] **CORE -30% 减免是否可感知？** BASE_RATE=0.5，减免后 0.35。0→100 从 200s 变为 286s——多出 86s 是否足够让人"想保住 CORE"？
- [ ] **STORAGE +50% 是否改变决策？** 薪柴 1→1.5（取整=1），2→3，4→6。对 contested/deep 节点影响大，对 safe 节点影响小——是否让人倾向保 STORAGE？
- [ ] **预告去掉方向后信息量是否够用？** "目标模块 + 四档强度"是否足以支撑出击前的分配决策，还是玩家会觉得预告可有可无？
- [ ] **记忆碎片的可信承诺是否可感知？** 供奉承冲击后记录是否帮助安排下一轮供奉与修复，插拔不会免费获取信息？
- [ ] **`growth_forecast_clarity` 三级投资是否可感知？** 普通预告强度模糊 20%→5%，在一局的样本量下玩家是否能察觉差别。
- [ ] **三个模块都到 0 后是否真的"不可能但能继续"？** 还是玩家会觉得该重开了？
- [ ] **intensity 3.0 时的 28% 收缩是否可感知？** 玩家是在两次出击之间对比时才发现，还是根本注意不到？若注意不到，收缩就没有传达"压力在增加"。
- [ ] **高 intensity 下形状是否退化为花瓣状？** 安全区钳制以 ±30° 余弦摊开；当原始半径远小于交互点要求时，边界由七个钳制凸起主导，可能出现可见的尖角与凹谷。需要目视确认在 intensity 2.5-3.0 时形状是否仍像"被挤压的气泡"。
- [ ] **膜的局部变形（≤8px、alpha ≤0.22）是否被注意到？** 如果完全无感，选择是删掉还是提高权重——而不是留着当摆设。
- [ ] **压力主方向现在是否成为唯一被读取的方向信号？** DEC-034 之后预告不再给方向，边界压力可视化独占这一维度——玩家是否真的会去看它，还是方向暗示就此变成无人消费的表现层。
- [ ] **`abyss` 的"逆风守护"在三模块下是否成立？** 各模块冲击前40%及以下时该模块应读到50%；玩家是否感受到"越危急防御越强"。
- [ ] **净化器是否被读作"在干活"？** 修满后起始混乱 0、残血带入部分混乱——连续两趟能否不看文档感到差别。
- [ ] **加厚 12/20/32 是否可负担但不白送？** 若没人买：费用过高或信号不足；若第一档出门就买：可能偏便宜。
- [ ] **冷却的余烬的承伤修复是否读得清？** 结算是否能解释本轮受损与随后回补，0承伤不会虚构收益。
