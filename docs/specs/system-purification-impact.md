---
status: ACTIVE
slice: 2 (extended in 4.5, 5, 5.5, 7)
last-modified-by: code / art（迭代30 R8观察、装置活动与固定100效能语义）
last-modified-date: 2026-09-23
interface-changed: true
interfaces-with:
  - system-field-inventory         # 统一物件供奉、实例归属、使用与装配
  - system-chaos-scavenge-extract   # consumes RIFT_EXITED; feeds chaosRateModifier + kindlingValueModifier
                                    # + startingChaos (Slice 7 净化器完整度写入出击初值)
  - system-movement-vision          # 正式净化点共享Player；R8观察射线独立于Rift VisibilitySystem
  - system-growth-tide              # tide intensity/phase drives impact intensity + boundary shape; contaminant
                                    # defense slots feed the defense phase (slot count is growth-owned, not fixed);
                                    # growth_forecast_clarity sharpens the forecast; SaveManager persists both sides;
                                    # 全部成长含thicken的费用唯一来自growth-route.csv.cost（迭代29 R3）
exposes:
  - GameState.getModuleEffect(type) / getSortieModifiers()
  - GameState.getStartingChaos() / computeStartingChaos(hp, maxHp)（固定100基准的共享纯函数）
  - GameState.getModuleMaxHpTier() / getNextModuleMaxHpCost() / canRaiseModuleMaxHp() / raiseModuleMaxHp()（状态/费用；UI购买经purchaseGrowth与路线资格）
  - GameState.getKindlingReserve() / healModule(id, amount)
  - GameState.getRepairBonusHp() / grantRepairBonus(hp) / getMaxUsefulRepairKindling(hp,maxHp) / previewModuleRepair(hp,maxHp,kindling)
  - SaveManager.allocateToModule(id, amount) -> number（保存失败完整回滚）
  - GameState.isModuleSwapActive() / setModuleSwapActive(active)
  - ImpactSystem.run(defenseSlots, offeringIds?) -> ImpactResult （含 defenseResult；Slice 5.5 增 primaryModuleId / trueSeverity / baseDamagePerModule）
  - ImpactSystem.generateForecast(nextIntensity, _forecastReliabilityBonus, nextNextIntensity) / getForecastReading(level) / getForecastLookahead()（第二入参仅兼容；正式UI读ForecastReading）
  - ImpactSystem.getForecastState() / loadForecastState(state?) / resetForecastState()
  - applyDefenseEffects(baseDamage, slots, context, offeringIds?) -> DefenseResult
    （Slice 5 新增出口 healOut / bonusCharges / toolUseGrants / moduleSwapTriggered；
     Slice 5.5 新增 slotDisclosures 供结算面板逐槽归因）
  - getDefenseRuntimeState() / loadDefenseRuntimeState(state) / ContaminantRuntimeState
  - AllocationPanel.open(moduleId)
  - PurificationChamberLocomotion.update(delta) / getRoute() / canInteract(device)
  - PurificationChamberVisual.update(time,delta,state) / pulse(kind,target) / destroy()
  - getChamberObservation(feet,moduleId) / isChamberObservationRayClear(eye,target)（只读可观察资格）
  - ChamberIntegritySelection / ChamberIntegrityLifecycle（单一读数与world/focused交接）
---


## 迭代28 · 独立供奉反应与鉴定

新目录的供奉反应由`contaminant-offerings.csv`独立抽取，不从隐藏真身份推导。三种减伤25/35/45%按各槽乘剩余伤害叠加；加速反应只使自身积累×2；沉默反应无供奉增益但仍可鉴定。普通冲击+1、高潮+3、阈值3；首归免冲击不积累。一般不能把积累点称作实经历的冲击次数。

场景以实际run ID派生`impactId`，槽位快照参加本轮防御后，InventoryStore原子完成积累、转化、回库、清槽、发现记录与幂等回执。供奉结算报告显示原外壳→真名/图/一句主效果；无能力结果明确说明，无强度赞词。旧13族自身反应继续由原CSV解释，不能被新目录的五反应偷偷重映射。

# 系统设计：净化点 + 冲击

## 迭代30 R8 · 封闭错层场所与观察（承接DEC-180）

净化点是具有少许俯视进深的封闭像素室内：不规则的主地面与后退夹层、两条可横移的宽坡道，厚墙回转面和基础形成边界。镜头省略面向观察者的遮蔽构件，不代表世界内露天。外部近侧支承/接触、中层连续错位残构、远层暗影分层呈现，内侧约束件与修补材料形成抵抗关系。后墙承重肩、东墙整段剪切、前基础向下展开，不能仅在原整圈墙缘加齿缺。

`purification-chamber-layout.ts`拥有唯一脚底几何、设备底座和独立操作点；`purification-chamber-locomotion.ts`连续求解面内八向移动；`purification-chamber-visual.ts`接入同源作者面场所、独立排序的六设备壳与局部活动图集。核心仍在下层(253,299)，最高91px，操作点/底座不变；上移方案因路线成本回退。R1灰钢双层轨道版`c3b1d9f`已被用户否决，不能作为审美基准。历史圆形地表、Boundary系统与旧等距绘制仍供gym，不参与正式净化点。Rift保持俯视移动/视野/碰撞。

身体成长确认落在原人物，加厚才在模块留下永久承载补件；当前HP影响自身与相应壳体接触处，不改变通行。主体活动与投光效能取min(1,hp/100)，100/100→100/115不变暗；条长仍取hp/maxHp。供奉公开占用不是充能：成功库存提交的新入槽物触发锁合，已持久化、结果报告结束后的实际转化事件才触发释放；不能显示未鉴定身份或未来冲击目标。材料与模型合同见`art/purification-renewal.md`；实施接入不表示用户认可。

### 当前成长路线与供奉容量

`data/growth-route.csv`是22步（六轴19次＋加厚3次）的顺序、目标级、两处经历门槛和`cost`唯一来源。R3以`round(8 * 1.077^(order - 1))`逐项独立取整，费用总426；第2–3步和第6–7步允许短平台，全程不下降、同类等级递增。运行时读CSV，不重算曲线；`upgrades.csv`只拥有六轴效果定义等内容，生成的`UPGRADE_DATA.costs`按路线节点派生，不保留`cost_N`或加厚费用常量。培养藏只给当前下一项，已获能力只读，等级/总级及完成数/22独立展示；不能绕过路线购买加厚。第5步预兆1级缺经历时显示“承受冲击”，第17步预兆3级显示“抵达退潮”；已满足条件收起，薪柴支出独立。供奉完成与工具揭晓不再控制购买。

新档1格供奉，扩容3级在第3/10/18步花9/16/28薪柴变为2/3/4格，不改每件物的防御/成熟速率。第12步出击扩容花18薪柴增加第三主动位，被动仍1。成长schemaVersion=2区分新规则；缺版本旧0/1级迁新2/3级，原3/4格、槽内物与进度保留。R3旧已购不自动补扣、不追溯退款，下一未购项按对应原路线`unit/level`节点现价，不按累计已购数重排。容量唯一查询为`contaminantSystem.getDefenseSlotCount()`。无就绪武器仍走基地白板替补，空工具/空供奉不阻止出击；完整线性与旧档规则归成长/库存spec。

### 预告信息层（取代旧概率成长段）

新预告状态version2在建立时按原80%命中分布冻结真实重点 `actualPrimaryId`，模糊播报与真值分开。读取、购买、装卸供奉、重复菜单和重载不重抽，真实冲击消费同一目标。首归免冲击仍消费该趟预告，随后用推进后的潮汐建立下一份，避免残留出生强度。

`getForecastReading(level)`是正式UI公开入口：0层为模糊目标/强度；1层准确强度档；2层增加准确重点；3层增加三个装置的防御前压力（与真实分配同一纯函数），首趟免伤压力为0。低层不返回高层数字；不调用防御执行器，不预演隐藏物件，不把原始压力叫实际损伤。常驻HUD的问号与报告的“推测/已辨明”区分不确定字段，压力数字按需在报告潮汐页读取。

R3入口近身提示与上述各表面统一读取该公开投影，沿相同字段标明不确定性；不能在入口另用`getCurrentIntensity()`显示真实倍率，使0级绕过预兆投资。潮位/潮相粗信息保持既有公开边界。`generateForecast`的第二入参`_forecastReliabilityBonus`仅兼容旧调用，不再用成长改变80%生成分布；成长只改变读取。

既有挣得的准确预告/排队目标保持承诺。version1未消费的旧预告维持原规则直至真实消费；高等级也不把未冻结事实伪装确定，界面说明下一份预告生效。已承诺旧预告保留其确定性；不能免费得到3层压力。预告保存/拒写回滚与成长购买同笔，不先发布未保存真值。

### 加厚的完整代价

加厚只在路线第7/14/21步轮到时可花12/21/35薪柴投入；仍只提高上限，不免费回血。购买前逐模块显示当前hp/max→原hp/新max，下次起始混乱前后，以及补满全部模块额外至少需要的薪柴。合计用纯函数求一次修复额度分配的最小总费：额度只用在一台的一次有效注入，不能各台重复扣减；实际维修不自动发生。R3净化器与核心/储藏统一以`MODULE_EFFECT_HP_REF=100`为功效基准并封顶：100/100变100/115后起始混乱仍为0；同样hp=70时，四档上限下都为15。无额外修复额度时三台从100补至115另需12，这是填充额外缓冲容量的可选支出，不是恢复被加厚削弱功效的费用。预览和新出击共用`computeStartingChaos`；已冻结的旧出击/检查点不重算。

> **TL;DR**：双层封闭基地承载修复、供奉、蜕变和备行；返回时结算实际冲击，薪柴维持模块，模块实际完整度影响出击。上下层通过两端楼梯连接，外墙和外部改写分别呈现；物理壳体不新增抗侵蚀数值。

**迭代11 R6呈现更新（2026-09-07）**：冲击结果在现有场景右侧无框展开，16px同族标题、12px正文、全屏渐隐暗场；最大损伤先读，模块前后完整度/供奉作用/转化/预告事实保留。取消独立窗口抖动，使用淡入。Enter/Esc及点击合上沿用原关闭回调；不改冲击计算、归来顺序或存档协议。详细样式只定义于当前UI Kit。

> **Slice 5 变更摘要**（细则见 D/V 组）：预告去掉方向、只报目标+档位（DEC-034）；防御侧 6 处未接线机制全部落地（DEC-029~033）；污染物运行时状态进存档（DEC-032）；模块受损三态视觉阈值登记（DEC-035）；防御槽位数不再固定 3。

> **Slice 7 变更摘要**（DEC-064）：引入净化器（完整度 → 出击起始混乱，不改出击起始生命）与全局加厚，3档每档+15（100→115→130→145）；核心/储藏效果以基准100封顶。**R3当前合同**将净化器功效也统一到100基准，hp≥100时起始混乱为0，见规则27b；保留旧已冻结出击。三模块均参与当前防御合同。**DEC-117：** 加厚并进蜕变面板内加厚项，不再是世界桩。

## 迭代27：教学首归、稳定度事实与购买持久性

- cycle在出发时递增：出生0，第一趟归来1；仅这两个值跳过冲击，第二趟起恢复正常。跳过不充供奉计数，潮汐仍按归来推进。真实首归仍显示免冲击的归来报告，详见规则20。
- `ImpactSystem.run(slots, offeringIds, random, stabilityProgress)`接收场景查询的当前稳定度供防御上下文；返回`newlyZeroModules`，只统计本次由正生命扣至0的模块，既有0不重复扣。场景在账本的一次归来事务中统一结算稳定度与供奉，不以重复读取面板为事件。
- 成长/加厚统一使用`purchaseGrowth`持久购买事务；加厚拒写时薪柴、档位、所有模块上限还原，成功后才发GROWTH_PURCHASED。不回血合同保留；当前费用已由R3路线CSV统一为12/21/35。

## 世界内层次与通行

地面、背墙、接地阴影置于人物后；设备按底座脚底、人物/武器/随身灯按人物脚底排序。底座参与碰撞，不能穿机身；人物从后侧走到前侧时遮挡次序随实际位置改变。前缘遮蔽物分段，不能用整张前景吞没人物。观察锚在机体上，交互锚在可走地面上，二者不可混用。

共享Player显式constrained模式消费同一键盘与冻结，保留原四向角色。两层互不重叠，只有宽坡道连接；高差侧边不可跨越，坡道上可自由横移、停止和反向。无新跳跃/坠落/升降机规则；输入与碰撞细节归`system-movement-vision.md`。

## 概述

净化点是玩家在裂隙出击之间的唯一安全空间。一座残留的封闭设施为维护提供可辨的结构；外部现实仍在侵蚀它。厚墙不自动抵御改写，既有薪柴/模块/冲击规则承担存续压力。设施原用途和幸存原因不作新增正史。

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
  skipped: boolean;               // cycle<=1 跳过冲击；真实首归仍有结算报告
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

1. **空间**：640×400世界像素，960×640逻辑画面，常态相机中心(320,200)、zoom1.5。两层与坡道是有面积的多边形，所有形状归layout单源；高差不允许在坡道之外跨越。出生足点(366,299)，角色中心在足点上10px。
2. **六处交互**：主层储藏/核心/净化器/裂隙，上层蜕变/供奉。底座和操作位置分开，详见layout与空间设计；相同层、操作点24px内且直线无实体阻挡才能E，坡道禁交互。最近合法目标优先，仅等距用原核心/储藏/净化器/供奉/蜕变/裂隙顺序。
3. **通行**：WASD或方向键始终对应屏幕八方向，按原80px/s、斜向归一。圆足连续碰撞与贴边滑动，宽坡道不吸附中线、不换按键模式；可停/反向。大帧最多消费100ms，面板/入场/重试/结算冻结。
4. **边界与外部**：不规则厚混凝土/灰泥壳体、承载基座、可见进深和外部残構共同表现封闭；边界外不可通行。外部改写在接触处受约束，不用整圈膜、不新增建筑防御机制。裂隙仍是地面空间伤口。
5. **场景内界面**：保留DOM根、成本/资格、E/Esc/Tab流程；镜头聚焦本体而不是操作点，退出恢复常态。闲置提示WASD移动。已认可成长UI保持。
6. **状态表现**：实际损伤、已购加厚及公开供奉占用驱动表现；修复/成长反馈局部发生，不延长强制停留。恢复六种功能剪影，使用相容的投影与有区别的材质，不替换角色。
7. **冲击预告是非空间的**（DEC-034，改写自旧的"粒子密度指向预告方向"）：预告只播报两件事——**下次冲击的重点目标模块** 与 **强度档位**（light / moderate / heavy / extreme 四档）。它不给方向。
    - **HUD 展示**（Slice 5.5 DEC-048 贴顶横槽，只改展示、不改结算/数值）：净化点常驻 HUD 用文字写明，三个独立可见节点——时机 `下次归来`、目标全称 `核心` / `储藏` / `净化器`（对应 CORE / STORAGE / PURIFIER；与底栏 / 结算已上屏用词一致）、档位中文读 `ImpactSystem` 导出的 `SEVERITY_LABEL`（light→轻微 / moderate→中等 / heavy→剧烈 / extreme→极端）。HUD **必须 import 这一份标签**，禁止另造「轻/中/重」平行表。常驻 HUD 不画 ◈/▣ 与 4 格 pip。
    - **旧档已承诺的第二轮预告**（仅 `getForecastLookahead()` 非空）：同样三节点，但时机词必须是 `再下一轮`（不得再用 `下次归来`，以免读成第二份现在）。目标名与档位名同一套。可更淡、无临界脉动，文字节点不得省略。
    - **为什么不给方向**：旧实现把 CORE 映射为"左"、STORAGE 映射为"右"，而 CORE 就在场地正中心——"左"是任选的，玩家无法据此做任何决策；同时它与边界压力主方向（规则 37/42/47）叠成两个互不相关的方向暗示。
    - 舱外结构与接缝动效没有冲击方向含义，不读取隐藏预告；不得将位置/亮度编码为未来重点。
    - 预告仅在首次建立或实际归来消费（含教学免冲击）后生成，用潮汐推进后的真实下一轮强度；同轮菜单/读档/重复进入只恢复原读数，不重抽。
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

19. **触发时机是"返回净化点的那一刻"**，不是"按 E 出击之前"。玩家从裂隙回来、净化点场景 `create()` 时按序执行：潮汐强度同步 → 快照供奉槽实例ID → 冲击/防御完整结算 → 非跳过冲击增加供奉计数并完成转化 → 潮汐推进 → 预告重算 → 同笔世界存档。无待结算归来的菜单/读档入场不触发冲击；若账本为 `settled && !baseSettled`，仍须完成该次归来，即使入口来自菜单恢复或明确放弃本趟。
    - 设计后果：玩家是**带着冲击的结果**开始这一轮的分配与装配决策，而不是分配完再挨打。整个驻留期间看到的模块 hp 就是出击时的 hp。
20. **首次豁免**：`cycle <= 1` 时跳过冲击（返回 `skipped: true`）。第一次出击是"教学局"。
    - **豁免伤害不省略归来报告**：实际首次归来（撤离、空手、阵亡或放弃本趟）仍显示一次「归来之后」。主读数为「装置 · 本次损伤」与独立数值 `0`，说明「首次归来，本次免受冲击；供奉积累不增加。」；三模块按实际完整度显示同值前后对照。不得伪造冲击强度、重点目标、预告命中、减伤收益或供奉积累；不播放冲击音效与震屏。
    - 报告沿用当前场景无框结果布局及 `#dom-ui-root`，潮汐/稳定度通知仍并入同一报告。结算保存成功后才发布；保存失败锁输入，重试只保存已结算快照，不重放冲击、收益或潮汐。出生、已 `baseSettled` 的重复归来及普通菜单/读档不再弹出。
    - Enter、Esc、点击「合上」共用一次关闭回调；忽略按键自动重复，清除关闭键边缘输入后交还控制，不能同时打开暂停。销毁报告清除监听及旧回调。机制与首次免伤数值不变。
21. **基础伤害**：`BASE_IMPACT_DAMAGE`（= 30）× `impactIntensity`。
22. **威胁分布**：一个模块为"重点目标"，承受 `THREAT_FOCUS_RATIO`（65%）伤害；**其余伤害在其他全部承血模块之间均分**（两模块时另一个拿 35%；三模块时另外两个各 17.5%，四舍五入后用最后一个模块吃残差，保证总和等于本次总伤害）。预告从**全部**承血模块中均匀抽 ground-truth 目标。version2在生成预告时以 `FORECAST_ACCURACY`（0.8）概率匹配播报，否则在其余模块均匀抽选，并冻结实际重点；结算不再重抽。version1未消费旧档保留原结算时抽签，已承诺目标必定兑现（规则25）。禁止再写死 `modules[0]` / `modules[1]`。
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
    - **普通预告**：生成时随机挑一个模块作为预测目标（`forecastTargetId`）。没有可信承诺时，同次生成以 `FORECAST_ACCURACY`（0.8）概率把它冻结为实际重点，否则冻结另一个模块。强度可能有基线模糊；高层读取投影真值（规则52），不改变伤害对象。
    - **记忆碎片承诺**：记忆碎片实际在供奉槽承受一次非跳过冲击后，为下一轮生成准确目标与强度。单纯放入/查看/取出不升级当前预告、不获取免费前瞻；最后成熟的那次冲击同样记下一轮。已承诺内容即使物件撤下或成熟也必须兑现。
    - 普通目标命中率与强度模糊分别判断；可信承诺的目标和强度均准确。

### M — 模块效果

26. **CORE 效果**：提供混乱值 BASE_RATE 减免。公式：`chaosRateModifier = 1.0 - (min(coreHp, MODULE_EFFECT_HP_REF) / MODULE_EFFECT_HP_REF) * MAX_CORE_REDUCTION`。`MODULE_EFFECT_HP_REF = 100`，`MAX_CORE_REDUCTION = 0.3`（hp≥100 时 -30% 混乱值增速，再高的 hp 不额外减）。hp=0 时无减免。
27. **STORAGE 效果**：提供薪柴拾取价值加成。公式：`kindlingValueModifier = 1.0 + (min(storageHp, MODULE_EFFECT_HP_REF) / MODULE_EFFECT_HP_REF) * MAX_STORAGE_BONUS`。`MAX_STORAGE_BONUS = 0.5`（hp≥100 时 +50% 每次拾取价值，再高的 hp 不额外加）。hp=0 时无加成。
27a. **效果分母固定基准100**：Slice 7（DEC-064）的CORE/STORAGE功效基准保留；R3将PURIFIER也统一到`MODULE_EFFECT_HP_REF = 100`。加厚只抬`maxHp`血池，不抬效果上限、不降低相同hp下的功效；hp≥100封顶。模块可修复容量、损伤外观及既有按当前血池判断的防御条件仍各按原规则，不把功效公式扩写成全局完整度比例变更。
27b. **PURIFIER效果（R3）**：不改混乱增速、不改薪柴价值。只写入新出击起始混乱：

    ```
    integrity = clamp(purifier.hp / MODULE_EFFECT_HP_REF, 0, 1)
    startingChaos = round(CHAOS_HARD_START * (1 - integrity))
    ```

    `CHAOS_HARD_START = 50`，`MODULE_EFFECT_HP_REF = 100`。hp≥100→起始混乱0；hp=0→50；hp=70→15，在maxHp为100/115/130/145时均相同。100/115仍为0，填充100以上容量只增加未来承伤缓冲。购买加厚不回血。
    `computeStartingChaos(hp,maxHp)`是预览与实际出击共用的纯函数，`GameState.getStartingChaos()`查询当前净化器并调用它；`maxHp`只保留输入防护，非有限数或≤0时返回50，不作为功效分母。`overwrite`互换（规则55）只改CORE↔STORAGE的效果源hp，不抽换净化器。防御残留`initial_chaos`在该值之上加算（规则31a），不改本公式。
27c. **不改出击起始生命**：玩家那条完整度（`growth_vitality` 等）的出击初值本 Slice 不动。净化器不读写玩家完整度。
28. **效果计算时机**：在场景切换到裂隙前计算一次，作为 `SortieModifiers` 传递给 RiftScene。`GameState.getModuleEffect(type)` 仍是 CORE/STORAGE 效果的**唯一入口**——`overwrite` 的互换（规则 55）与 `resonate` 的上限提升（规则 59）都必须改在这里，不允许在消费方各自修正。PURIFIER 不走 `getModuleEffect`；走 `getStartingChaos()`。`getSortieModifiers()` 必须带上 `startingChaos`。
    已保存的出发意图或完整检查点按原冻结修正与当前运行态恢复，不调用新公式重算。例如旧趟保存的起始混乱7仍保留7，不能在R3续局时自动降为0；下一趟新出发才按当前基地hp读取100基准。
29. **裂隙侧应用**：
    - 自然时间混乱rate先按`BASE_RATE * chaosRateModifier * (1 - growthMods.chaosResist)`，再沿既有速率修正及武器/工具污染抗性处理。GR04成长渗透抗性仍只减缓自然增长，每级4%、上限20%；不减离散污染、不改起始混乱、不加入统一污染抗性。广谱减免改造未授权实施。
    - LootSearchSystem（迭代10前为LootSystem）的实际拾取价值为`max(1,floor((nodeValue + growthMods.kindlingAffinity) * kindlingValueModifier))`，翻找完成结算时应用。
    - ChaosSystem 开局 `value` = `SortieModifiers.startingChaos` 再叠加防御残留（规则 31a）。**不改**基础上涨曲线、阈值、惩罚映射。

### F — 场景切换

30. **裂隙→净化点**：`RIFT_EXITED` → RunController 延迟 600ms → `scene.start('PurificationScene', { kindlingGained, survived })`。进入后立即结算冲击（规则 19）。
31. **净化点→裂隙**：玩家在裂隙入口按 E → 打开出击装配面板 → 确认 → `cycle++` → 读取 `getSortieModifiers()`（此时 `moduleSwapActive` 已生效，规则 55；`startingChaos` 已按规则 27b 算好）→ 存档 → emit `RIFT_ENTERED { cycle }` → 0.3s 边缘内收辉光 + 0.5s 文字过场 → `scene.start('RiftScene', { modifiers, cycle, loadout })`。取消装配面板则留在净化点。
    - 上述计算只用于新出发。中断后恢复同一已保存出击意图/检查点，不再扣出发次数、不按当前模块或成长重建起始条件；完整事务归`system-field-inventory`。
    - 文字过场结束时，必须先立即停止旧净化点的绘制，再移除过渡层和卸载资源。`scene.start`进入下一帧队列，不能让当前帧显示已拆除角色/装置的旧地面；交接帧使用既有近黑画布底色。再次进入净化点由场景正常启动恢复可见，不延长过场或改变出击事务。
31a. **出击初值合成**：RiftScene 创建 ChaosSystem 时一次写入

    ```
    value0 = clamp(modifiers.startingChaos + Σ initial_chaos, 0, CHAOS.HARD_CAP)
    ```

    `initial_chaos` 仍走既有防御残留（ruminate +5、erode 概率 +8 等；首批八件不再附带旧残留），用 `addImmediate` 之前先把净化器部分写进初值，或把两笔合成后再 set——**禁止**开局拆成两次「穿越阈值」闪白。若 `value0` 已越过某阈，该阈视为已触发（不播跨阈演出），只对之后继续涨过的更高阈闪。增长曲线本 Slice 不改。
32. **RiftScene 接收 modifiers**：在 `create()` 中读取 `this.scene.settings.data`，应用 `chaosRateModifier`、`kindlingValueModifier`、`startingChaos` 到对应系统。
33. **死亡时**：`RIFT_EXITED { survived: false }` → 同样切换到净化点，但 kindlingGained=0（已在 Slice 1 RunController 中实现）。

### B — 封闭壳体与外部空间（迭代30）

39. 壳体由顶盖、侧墙、背墙、上下承载面和基础构成。观察侧以展示约定省略，边缘回转与厚度维持封闭读法。
40. `CHAMBER_FLOORS`/`CHAMBER_STAIRS`是通行唯一真相；不以装饰线、旧膜半径或图像像素决定碰撞。图形跟随同一坐标，楼梯相邻踏步的表现不能制造可走间隙。
41. 舱外先有大体块/重复错位结构，再有近处异物；远层低对比，近层压住壳周但不遮行动区，窥窗保持有厚度的封闭窗洞。
42. 不画户外晴空、云海、防护能量罩或未来目标方向。外部层次表现改写尺度和包围感，不增加环境伤害机制。
43. 动效限定为介质、接缝、微尘或小范围变化，静态承载骨架不呼吸变形。损伤由当前HP决定，加厚由已购档决定，供奉由槽占用决定。
44. 场景退出清理静态缓存纹理与动态物件。正常出击先隐藏旧scene再排队start，保留防止“只剩地面一帧”的修复。

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
    - 普通播报目标命中率80%；普通强度有20%模糊至相邻一档。成长不再降低抽错概率：第1层显示真实强度，第2层追加真实目标，第3层追加供奉作用前压力。可信记录不走这两个模糊分支。version1维持旧承诺直至消费，具体见文首“预告信息层”。
    - 记忆碎片必须实际占槽参加非跳过冲击，产生 `earnedPending`；潮汐推进后创建下一轮读数时将其转换为一个准确目标及强度并清除标志。多件不叠存多轮。最后成熟的一次同样授予。
    - 插槽、刷新HUD、重复生成、菜单重入和出击cycle变化均不制造信息。实际归来消费一次当前读数（包括教学首归免伤）。
    - 已发布承诺不可撤回。旧存档中已发布的双轮承诺按原当前/队列自然兑现；新规则不再生成第二轮前瞻。无新承冲击收入且旧队列耗完后恢复普通预告。
    - `impactForecast`保存目标、显示、可信/消费标志、旧前瞻队列及 `earnedPending`。旧字段缺省兼容；非法快照在加载前拒绝。归来普通拒写保留整帧候选并封锁交互、重试同一候选；不重放冲击或重复授予。成长购买拒写恢复购买前快照，二者事务语义不同。
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

61. **槽数**：新档基础1，`growth_defense_slot`每级+1、共3级，上限4；旧容量权益按成长schema迁移保留。引擎遍历实际传入快照，不写死长度，不先成熟再算效果。

### V — 当前完整度状态与表现（I30 R8覆盖旧Slice 5比例阈值）

62. **状态阈值**（按固定当前HP，maxHp仅用于容量条）：

    | 状态 | 区间 | 含义 |
    | ---- | ---- | ---- |
    | 稳定 | hp ≥ 100 | 运行效能封顶；额外maxHp是缓冲容量 |
    | 受损 | 25 ≤ hp < 100 | 当前公开损伤对应结构/活动衰减 |
    | 危险 | 0 < hp < 25 | 局部活动滞留与泄散，不增强亮度 |
    | 失效 | hp = 0 | 危险端帽与状态字保留，不能读成无信息黑条 |

63. **状态与缓存纪律**：主体静态损伤缓存按固定100/25两档边界区分稳定、受损、危险；0HP在危险外观中保留明确的失效读数，不创造新的效果。活层采用独立局部图集，仅公态跨档/供奉空有变化重建，平时换帧；不逐帧重绘整个模块。
    - 核心、储藏、净化器使用同一HP效能投影；加厚100/100→100/115不改变运行效能、活动档或光强。条长变短只表达新增容量，不能再套旧60%/30%容量比例状态。
    - 核心收束与投光共源，其余装置各有不同待机与真实成功动作；不保留统一500ms闪灯或框架红环。0HP世界规有危险端帽、近景有“失效”；颜色与生命周期归UI Kit的I30 R8节，当前模型/活动归`art/purification-renewal.md`。旧Kit B3/历史gym模型不覆盖此合同。

### U — 模块上限加厚（Slice 7）

64. **全局抬上限**：`thicken`在同一22步路线第7/14/21步出现；当前轮到时，蜕变面板动作「加厚」花薪柴永久提高**全部**承血模块的 `maxHp`，不按模块分别升级。档位与费用：

    | 已买档 `moduleMaxHpTier` | 全部模块 `maxHp` | 下一档费用（薪柴） |
    | ------------------------ | ---------------- | ------------------ |
    | 0 | 100 | **12** |
    | 1 | 115 | **21** |
    | 2 | 130 | **35** |
    | 3 | 145 | 不可再买 |

    每档+15。费用12/21/35唯一来自`data/growth-route.csv`对应`unit=thicken`及目标`level`的`cost`；`getNextModuleMaxHpCost()`从同一路线数据派生，不留系统费用常量，不进`upgrades.csv`也不扩`GrowthUpgradeId`。可负担节奏需按实际搜取、维修与死亡验证，不能从固定地图总价值推断。首屏说明当前hp不变、起始混乱不变与补满额外容量的可选费用；不能作为独立可抢购项绕过前置路线。
65. **存档**：`moduleMaxHpTier` 必须写入存档。`maxHp` 可由档位重算（`MODULE_BASE_MAX_HP + MODULE_MAX_HP_PER_TIER * tier`），存档里的模块 `maxHp` 若与档位不一致，以档位为准并写回。抬档时**当前 hp 不变**（不免费回满）；若出现 hp > 新 maxHp（不应发生）则 clamp。蜕变折扣 `upgradeDiscount` **不**作用于加厚费用。
    R3旧已购档位不自动补扣、不追溯退款，新购买按原路线目标档的当前CSV费用。此基地状态兼容不能改写已冻结的在途`SortieModifiers`或检查点混乱；恢复原出击承诺见规则28。
66. **稳定度**：加厚虽计入路线22步，仍**不计**成长稳定度奖励；六轴刻入维持每次成功持久化后+1，不借排序改积分。
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
- 交互只暂停玩家输入，场景持续运行。观察世界规与聚焦DOM读数共享生命周期，至多一个载体可见；打开/关闭时按同一退场—入场过程交接，镜头恢复不强制重启或硬闪世界规。
- **I30 R8侧置完整度：**观察取脚底到实际底座轮廓距离（44px进入、58px退出、120ms候选稳定），且机体至少一处在同源建筑/前沿作者面的视线检测中可见。当前操作优先，其次保持原可观察对象，再取最近候选；同一时刻只有一个主要读数。坡口可见不被同层E资格否决，E仍保持原同层/24px操作锚与直达要求。读数淡入160ms，离开保留250ms后淡出180ms；换侧60ms退场/140ms入场、不穿越人物；实际遮人或不透明墙立即掩去，无安全位置暂隐。world/DOM共用生命周期，前者在POST_UPDATE后避让真实人物/武器/灯，后者game PRE_RENDER按本帧camera投影并避让设备名/其他装置/投入列/视口，销毁解绑。状态按固定HP：≥100稳定、25–99受损、1–24危险、0失效；长度才按hp/maxHp，100/115稳定，0HP端帽与近景状态字保留。唯一尺寸、排字、颜色与余量见UI Kit的I30 R8节。观察范围拓宽不改变修复资格、碰撞、隐藏信息与出击机制。
- 确认复用原allocateToModule及ALLOCATION_CONFIRMED，即时扣资源/修复；只有正数实际修复成功才触发对应装置动作：核心闭合—聚集—归稳1.68秒，储藏封口归位、净化器分相回流；主体与局部投光共源，不再把三物统一画成暖色呼吸。650ms展示已生效结果，阻止重复确认，再用180ms镜头恢复原视角，恢复完成才启用玩家输入。Esc可提前离开，已结算资源不会回滚。
- 退出期间E/Tab/暂停不抢开；开发切屏即时恢复镜头；scene shutdown只丢弃焦点状态，因为CameraManager先销毁相机，不再触碰main。DOM跟踪/提交计时器清理。入口确认不先恢复镜头，直接出击；转场300/500ms计时器归场景Clock并在shutdown移除，防止旧回调拉走新场景。
- 开发直达 `ui-review.html?sample=world`，六点切换保留资源，独立重置85薪柴/零库存；原sample=core仍可用。示例不读写正式存档。复用生产交互，不加入生产HTML构建。

#### 供奉、蜕变、踏入准备

- 供奉与装配用槽位/可用库存为主区、选中详情为从区。长库存只在内容区滚动，底部动作保留。槽位数量与工具类别读取运行时系统，不写死槽数。
- 供奉库存同时包含未供奉武器与技能污染物；区分尚无物件和物件已全部投入。武器明确只积累供奉进度，技能保留现有防御说明；槽位、充能与完成后的余次均读取同一实例。世界供奉环的装填档同样统计两类物件。
- 装配无工具时解释供奉充能后转化；工具全部已装时显示“工具已全部装填”。始终明确空槽不阻止踏入，指向底部实际踏入动作，不在错误焦点承诺 Enter 立即出击。
- 踏入准备固定底栏始终显示可点击“踏入裂隙”及全区有效的 `Shift+Enter`。普通 Enter 继续执行当前焦点的装填/取下/动作；三条踏入路径共用一次执行函数，不要求先切到动作区。
- `Tab`/`Shift+Tab` 切槽位、库存与动作区；方向键浏览；`Enter`/空格执行当前区域动作；鼠标保留已装填槽点击取下、库存点击自动放入首个兼容空槽。槽满显示原因，不改变装备规则。
- 蜕变只呈现当前下一项，已有能力作为只读摘要，不再并列六轴/加厚选购。当前名称、等级/总级、效果变化、薪柴支出/余量与完成数/22分开；缺经历至多一行且满足后收起。纯薪柴不足写实际缺口；全部完成显示完成态。后续项名称、未来条件和旧“尚待经历”总入口不展开。
- 蜕变以Enter/当前动作点击执行同一`purchaseGrowth`，Esc离开；没有切换轴的方向键提示。一次按下只完成一项，长按/键重复不连买；成功保存后接下一项，拒写保留原项。加厚仍在同一面板，不开新确认窗，费用与不回血/不奖稳定度保持。

本节只约束 UI 表达与已有交互路径，不更改世界装置外观、冲击结算或玩法。完整回归覆盖零资源/可投入、空库存/已装备、满槽、成长不足/满级，以及键鼠切换后的选中详情一致性。

---

## 数值表

| 参数 | 值 | 范围 | 说明 |
| ---- | -- | ---- | ---- |
| `MODULE_INITIAL_HP` | 70 | 60-100 | 开局不满，暗示已有损伤 |
| `MODULE_BASE_MAX_HP` | 100 | -- | 档位 0 的修复上限；取代旧名 `MODULE_MAX_HP` 作为**基准**血池 |
| `MODULE_MAX_HP_PER_TIER` | 15 | -- | 每档加厚 +15 |
| `MODULE_MAX_HP_TIERS` | 3 | -- | 最高档 3 → maxHp 145 |
| `growth-route.csv`的`thicken.cost` | 12 / 21 / 35 | -- | 第7/14/21步，第1/2/3档费用；不再有费用常量 |
| `MODULE_EFFECT_HP_REF` | 100 | -- | CORE/STORAGE/PURIFIER功效分母；hp≥100封顶，加厚后仍用它 |
| `CHAOS_HARD_START` | 50 | 40-60 | 净化器 hp=0 时的出击起始混乱 |
| `REPAIR_PER_KINDLING` | 4 | 3-10 | 1 薪柴=多少 hp（为稀缺感调低） |
| `BASE_IMPACT_DAMAGE` | 30 | 15-40 | 每次冲击的基础总伤害 |
| `THREAT_FOCUS_RATIO` | 0.65 | 0.55-0.75 | 重点目标承受的伤害比例 |
| `FORECAST_ACCURACY` | 0.80 | 0.7-0.9 | ground-truth 预告与实际重点目标相符的概率 |
| `MAX_CORE_REDUCTION` | 0.30 | 0.2-0.4 | CORE在hp≥100时的自然混乱增速减缓（效果封顶，与maxHp无关） |
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
| 档位模糊概率（0层） | 0.20 | -- | impact-system 内联 | v2强度1层起公开真档位；不再按百分比成长 |
| 档位分界 | 1.5 / 2.0 / 2.5 | -- | impact-system 内联 | 潮汐强度 [1.0, 3.0] 四等分 |
| `growth_forecast_clarity` | 3层信息 | -- | `upgrades.csv` | 强度→重点→防御前压力；原已挣得准确承诺保持 |
| 供奉槽位数 | 1（新档基础）/ 4（上限） | -- | `contaminantSystem.getDefenseSlotCount()` | 扩容3级；旧档容量按成长schema迁移保留 |
| 当前装置状态阈值 | 固定HP 100 / 25 / 0 | -- | `chamber-integrity-placement.ts`及当前场景状态投影 | R8取代旧DEC-035的容量60%/30%；maxHp只影响条长 |

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
| 加厚后未注入、净化器100/115 | 起始混乱=round(50 × (1 − clamp(100/100,0,1)))=0；三模块相同hp的功效均不降低，当前hp不变 |
| 净化器hp=70，上限从100加厚至145 | 各档新出击起始混乱均为15；加厚后额外可修复容量不是免费回血 |
| R3加载旧已冻结出发意图或检查点 | 继续原修正/运行态；即使旧起始混乱保存为7也不重算，新出击才读新公式 |
| R3改价时已有成长/加厚等级 | 不自动补扣、不追溯退款；下一未购原路线节点按当前CSV费用 |
| 当前路线项是加厚但薪柴不足 | 不扣、不抬档；当前项写 `还差 N` |
| 加厚已至第3档 | 后续不再出现加厚购买项，只读已有能力保留3/3；路线继续最早未完成项 |
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
| LootSearchSystem（迭代10前为LootSystem） | `kindlingValueModifier` | 节点基值先加成长亲和，再乘储藏修正，向下取整且最低1 |
| HUD / 结果面板 | `GameState.getKindlingReserve()` / `getModules()` / `getStartingChaos()` | 查询 |
| GrowthPanel | `growthSystem.getNextStep/getRouteProgress()` / `purchaseGrowth(id)`；加厚读`getModuleMaxHpTier/getNextModuleMaxHpCost()`，预览共用`computeStartingChaos(hp,maxHp)` | 仅当前路线项可刻入/加厚；费用同源、原子保存与完整预览 |
| PurificationScene | `ImpactSystem.run(defenseSlots): ImpactResult` | 方法调用（槽位由场景传入，避免系统互相 import） |
| 净化点HUD、入口提示及报告 | `ImpactSystem.getForecastReading(growthForecastLevel)`；既有挣得前瞻沿`getForecastLookahead()` | 同一公开投影与不确定字段；不能绕过层级显示原始倍率或高层压力 |
| PurificationScene | `ImpactSystem.generateForecast(nextIntensity, _forecastReliabilityBonus, nextNextIntensity)` | 建立一次；第二入参仅兼容，成长不改变生成分布/重抽事实 |
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
| `src/ui/dom/growth-panel.ts` | 当前路线项（含轮到的加厚）＋只读已有能力，等级/总级与22步进度 |
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
- [ ] **`growth_forecast_clarity` 三级投资是否可感知？** 三层信息是否在不同资源局势中支持不同准备；第1层费用价值和自然展开节奏仍需玩家验证。
- [ ] **三个模块都到 0 后是否真的"不可能但能继续"？** 还是玩家会觉得该重开了？
- [ ] **intensity 3.0 时的 28% 收缩是否可感知？** 玩家是在两次出击之间对比时才发现，还是根本注意不到？若注意不到，收缩就没有传达"压力在增加"。
- [ ] **高 intensity 下形状是否退化为花瓣状？** 安全区钳制以 ±30° 余弦摊开；当原始半径远小于交互点要求时，边界由七个钳制凸起主导，可能出现可见的尖角与凹谷。需要目视确认在 intensity 2.5-3.0 时形状是否仍像"被挤压的气泡"。
- [ ] **膜的局部变形（≤8px、alpha ≤0.22）是否被注意到？** 如果完全无感，选择是删掉还是提高权重——而不是留着当摆设。
- [ ] **压力主方向现在是否成为唯一被读取的方向信号？** DEC-034 之后预告不再给方向，边界压力可视化独占这一维度——玩家是否真的会去看它，还是方向暗示就此变成无人消费的表现层。
- [ ] **`abyss` 的"逆风守护"在三模块下是否成立？** 各模块冲击前40%及以下时该模块应读到50%；玩家是否感受到"越危急防御越强"。
- [ ] **净化器是否被读作"在干活"？** 修满后起始混乱 0、残血带入部分混乱——连续两趟能否不看文档感到差别。
- [ ] **线性第7/14/21步的加厚12/21/35是否合理？** 相同hp功效不降的前提下，记录额外缓冲实际吸收的冲击、后续可选维修支出与路线等待；不能按自由选购优先级判断，也不能将未测长线视作确定经济失效。
- [ ] **冷却的余烬的承伤修复是否读得清？** 结算是否能解释本轮受损与随后回补，0承伤不会虚构收益。
