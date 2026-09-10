---
status: ACTIVE
slice: 3 (extended in 5, 5.5)
last-modified-date: 2026-09-10
last-modified-by: director / code（DEC-142）
interface-changed: true
interfaces-with:
  - system-field-inventory         # 统一物件供奉、实例归属、使用与装配
  - system-purification-impact   # 潮汐模型替代线性递增；污染物防御 slot 扩展净化点
  - system-chaos-scavenge-extract # 出击工具 + 永久改造修正出击参数；新增污染物拾取节点
  - system-movement-vision       # 永久改造修正移速/视野；出击工具修正感知/移动
  - system-enemy-ai              # 出击工具影响敌人状态（冻结/覆写/削弱）
exposes:
  - contaminantSystem.finishOfferingImpact(isHighTide, bonusCharges, snapshotIds?)
  - tideSystem.getState() (含 phase / tideNumber / currentIntensity) / getCurrentIntensity() / isHighTide()
  - contaminantSystem.getDefenseSlotted() / getSortieLoadout()
  - growthSystem.getLevel(id) / getModifiers()
  - stabilityTracker.getProgress()
  - saveManager.save() / load() / hasSave()
---

# 系统设计：成长 + 潮汐经济

## 迭代20：十三族异物（DEC-143）

生产目录为13个固定能力身份，各有普通／优良／精良／卓越四品质，共52组合。供奉、工具、文字定义归`data/contaminants.csv`，品质与满次数归`data/contaminant-qualities.csv`；旧rarity只参与兼容，不决定新掉落的能力种类。active=false的五个旧身份只用于读取旧档。

### 身份与品质

冷结块、重影片、返刻片、缄口布、缺口石、留影玻璃、复声壳、余烬核、迟落砂、附生壳、错结线、坠手石、背光珠在供奉前后保留同一名称与实例。品质不改变职责、目标、供奉阈值或重量，只改变可用次数及物件的侵蚀结构。四品质次数：前四件5/6/7/8，缺口石与余烬核3/4/5/6，留影玻璃4/5/6/7，复声壳和附生壳5/6/7/8；迟落砂、错结线、坠手石4/5/6/7；背光珠3/4/5/6。经济概率、供奉吞吐与迁移回归已验证；长期平衡与手感仍以最终体验审查为准。

旧实例品质由common→普通、fine→优良、rare→精良投影。首8族保持原余次；本轮重做的后5族和归并旧族按迁移表折算剩余比例，明确quality后不会重复换算。实例、位置、供奉进度和引用保留，不因开界面补满；完整规则归库存spec。四档原生图标24px、世界实物32px，库存/供奉/备行/实际带回/拾获读数统一实例品质；已揭晓后才显示物件本身。

### 裂隙实际能力

- 冷结块：视野内无遮挡的最近存活地面实体停滞4秒；禁止移动、感知、攻击，取消旧前摇。受到真实正伤害解除；恢复后攻击重做完整前摇。无目标不扣次。
- 重影片：被动，新一次针对玩家的怀疑事件使该敌人的感知填充速度×0.7；同事件一次，退回巡逻/返回后新事件可再触发。诱饵引发的怀疑不消费。
- 返刻片：被动，在针对玩家的新追击中失去视线时，保留最后可见位置6秒。同次追击一次；残影固定，不给视野外实时追踪。旧存档主动槽引用不擅自移动：新出击要求改放被动位；已经在途的旧实例按被动逻辑工作。
- 缄口布：被动，连续有效听觉遭遇消费一次；同一遭遇多个敌人不重复扣次，连续1500ms没有有效听觉发现信号后结束。末次仍完成整个事件；不屏蔽视线、接触、场域。
- 缺口石：沿面向在96px内越过恰好一格薄实墙，完整身体安全落地后实体化1秒。厚墙、虚空、边界、贴角第二堵墙、不净空落点均失败免费；不关闭物理body。
- 留影玻璃：脚下留下8秒视觉诱饵；敌人需要确实看见它，已确认玩家的追击不被强行洗掉。多次投放独立计时；针对诱饵的警觉不计玩家发现压力或被发现边缘提示。
- 复声壳：沿面向最多投96px，落在无遮挡地面，靠墙时落在墙前，空间不足免费；6秒内每1000ms向96px内能听见的地面实体发出一次调查声源。敌人朝实际落点调查；不制造眩晕/伤害，不把Host场域的玩家感应误当声源调查。
- 余烬核：选择128px内可见、无遮挡、已经释放且未被压制的最近环境危险，压制5秒；适用于占漆和气团/雾团/尘絮群。只压制危险，核心仍可命中、实体仍流动。未释放/已压制/不可见目标失败免费；结束后等待自然蓄势预兆再恢复危险。

- 迟落砂：128px内可见、无遮挡、尚未释放且未被推迟的最近环境实体，其下一次危险释放推迟5秒；已经铺开的危险不受影响，无合格目标不扣次。
- 附生壳：被动，玩家实际承受正伤害后获得8秒污染抗性+20，与装备抗性相加并沿用总上限；不回血、不倒改已受伤害。效果期间再次受伤不额外扣次，最后一次维持完整8秒。
- 错结线：面前32px处一次放下垂直于面向的64px结线，持续10秒；每个地面敌人首次真正跨线时停步1.5秒，保留感知和攻击。连续路径穿越也检测；整线必须落在合法可达地面。
- 坠手石：脚下64px半径迟重区，持续6秒，只将地面敌人的移动速度乘0.5；出区恢复，不降低转向、感知或攻击。
- 背光珠：记录沿可达地面路径192px以内敌人、环境危险核心与未翻找堆的位置，显示6秒。一次位置快照，不追踪移动，不揭晓内容物、不穿封闭墙显示远处；已有快照时不能重复扣次覆盖。

### 跨能力合同

控制按独立来源叠加，退出一片区域只移除其自身效果；减速/感知倍率相乘，攻击禁用取并集。眩晕不因伤害自动解除。延缓感知同样挡住满条直接升级；受伤警觉另算。消费必须持久化成功后才能改变世界；失败不位移、不控制、不发资源；末次消费完成效果再清理。退休的反刍等五族不再生成或执行旧能力；读档即归并到替代身份。旧在途多件归并同被动时逐实例消费，全部余次可用，末次效果完整。

> **TL;DR**: 打破必然下行螺旋——引入潮汐冲击节奏（压力有涨有退）、污染物生命周期（裂隙获取→防御→转化→出击工具→破碎）、永久改造（薪柴投资角色属性）、净化稳定度（长期进度目标）。单一货币（薪柴）三向分配：模块修复 / 永久改造 / 经济自然循环。

---

## 状态模型

```typescript
/** 潮汐系统 */
interface TideState {
  tideNumber: number;         // 当前第几个潮汐（1-5，5=Final）
  phase: 'rise' | 'crest' | 'ebb';
  cycleInPhase: number;       // 当前阶段内的第几个 cycle
  currentIntensity: number;   // 当前冲击强度
}

/** 污染物 */
interface Contaminant {
  id: string;
  type: ContaminantType;      // 13个生产身份，另5个仅旧档兼容
  rarity: 'common' | 'fine' | 'rare';
  stage: 'defense' | 'tool' | 'broken';
  impactCharges: number;      // 防御阶段已承受的冲击点（到 3 转化）
  usesRemaining: number;      // 出击工具阶段的剩余使用次数
}

type ContaminantType =
  | 'solidify' | 'ruminate' | 'scatter' | 'retrograde'   // 普通
  | 'delay' | 'siphon' | 'expand'                        // 精良
  | 'resonate' | 'overwrite' | 'erode';                  // 稀有

/** 永久改造 */
interface GrowthState {
  upgrades: Record<string, number>;  // upgradeId → 当前等级（0=未购买）
}

/** 净化稳定度 */
interface StabilityState {
  progress: number;           // 0-100
}

/** 持久存档 */
interface SaveData {
  version: number;
  gameState: {
    kindlingReserve: number;
    modules: ModuleState[];
    cycle: number;
  };
  tide: TideState;
  contaminants: Contaminant[];
  defenseSlots: (string | null)[];   // 基础 3 slot（growth_defense_slot 解锁第 4），存 contaminant id 或 null
  sortieLoadout: (string | null)[];  // 基础 3 slot（growth_sortie_slot 解锁第 4），存 contaminant id 或 null
  growth: GrowthState;
  stability: StabilityState;
}
```

---

## 规则

### T — 潮汐冲击模型

1. **替代线性递增**：`impactIntensity` 不再逐 cycle +0.15。改为潮汐状态机驱动。
2. **Tide 结构**：每个 Tide 由 Rise→Crest→Ebb 三阶段组成。每阶段持续若干 cycle（=出击次数）。

3. **数值定义**：

| Tide | 底线 | 峰值 | Rise | Crest | Ebb | 退到 | 总 cycle |
| ---- | ---- | ---- | ---- | ----- | --- | ---- | -------- |
| 1 | 1.0 | 1.6 | 3 | 1 | 2 | 1.2 | 6 |
| 2 | 1.2 | 2.0 | 4 | 1 | 2 | 1.5 | 7 |
| 3 | 1.5 | 2.4 | 4 | 2 | 2 | 1.8 | 8 |
| 4 | 1.8 | 2.8 | 4 | 2 | 3 | 2.0 | 9 |
| Final | 2.0 | 3.0 | 5 | ∞ | — | — | 无限 |

4. **Intensity 计算**：
   - Rise 阶段：每 cycle `intensity += (peak - floor) / riseCycles`
   - Crest 阶段：`intensity = peak`（保持）
   - Ebb 阶段：每 cycle `intensity -= (peak - ebbTarget) / ebbCycles`
   - Final Tide 的 Crest 无限持续（游戏不主动结束）

5. **高潮冲击**：Crest 阶段的冲击为"高潮冲击"，对污染物的冲击计数为 3 点（一次即转化）。Rise/Ebb 阶段为一般冲击，计 1 点。

6. **第一次出击豁免**：cycle=0 不触发冲击（保留，与 Slice 2 一致）。

7. **潮汐切换**：当 Ebb 阶段的最后一个 cycle 结束后，自动进入下一个 Tide 的 Rise 阶段。intensity 从上一 Tide 的 ebbTarget 开始（= 下一 Tide 的 floor）。

### CN — 污染物系统

8. **获取方式**：裂隙地图中新增"污染物节点"（区别于薪柴节点）。每张地图固定 2-3 个。**迭代 10 起（DEC-108）**：污染物节点与薪柴节点统一为**可翻找对象**——外观不泄露内容物，走近按住 E 读条（`LOOT.SEARCH_CHANNEL_MS`，建议 1200 ms）完成才结算；读条规则、打断、发声、可见性门槛与上下文优先级全部归 `system-chaos-scavenge-extract` 规则 14/14a/14b/15/16。读条完成后揭晓物件。13个生产族等概率选族；节点由地形生成器标记safe/contested/deep，对应四品质权重60/25/12/3、40/35/20/5、20/35/32/13（`data/contaminant-loot.csv`）。风险来自部署路径/巡逻区域，非玩家当前混乱值。runSeed+节点ID决定稳定结果，各节点独立抽样，翻找顺序和重试不重抽。
9. **污染物节点视觉（迭代 10 改口）**：不再是深紫色脉冲方块，也不再「走过即拾取」。与薪柴节点统一为可翻找对象：同一套外观，玩家不能通过外观区分内容物（薪柴 / 残渣）；对象不是 glow source，alpha 乘可见性（规则归 `system-chaos-scavenge-extract` 规则 16/17）。内容物在翻找完成时揭晓。全部13族使用中性材质揭晓与品质文字，不以旧rarity制造错误等级；世界实物按实例品质绘制。机制论述见 `docs/design-notes/loot-search.md`。
10. **库存（DEC-142）**：净化点统一物件库无负重上限，武器与技能污染物都由 `InventoryStore` 单一持有；`ContaminantSystem` 是技能效果适配器，不再拥有第二份可写 `contaminants[]`。裂隙装备和拾获共同计重，但拾获页只管理战利品，完整合同见 `system-field-inventory.md`。

11. **防御阶段**：
    - 净化点有 3 个防御 slot（等价，不分方向）。**Slice 5 起槽位数可变**：改造 `growth_defense_slot` 解锁第 4 槽，唯一真相是 `contaminantSystem.getDefenseSlotCount()`，任何地方都不得假定固定为 3
    - 玩家在净化点将库中 `stage === 'defense'` 的武器或技能污染物装入同一供奉 slot。武器占槽积累进度但不提供虚构的防御效果
    - 已装备的污染物在每次冲击时：(a) 执行其防御效果，(b) `impactCharges += chargeCost`（一般 1，高潮 3）
    - 本次冲击先完整结算防御效果，再应用一般/高潮及技能附加计数；达到定义阈值时 `stage = 'tool'`，设定定义余次、清槽回库。武器阈值3、余次60/75/90/110，技能沿原定义。跳过的冲击不充能

12. **防御效果**：具体效果由CSV定义，结算合同见`system-purification-impact.md`。Spec 层面的规则：
    - 效果在冲击计算阶段应用（伤害计算后、HP 扣除前）
    - 多个 slot 的效果依次应用（顺序无关——各自独立计算对各模块的修正）
    - 空 slot 无防御效果

13. **出击工具阶段**：
    - 出击前从 `stage === 'tool'` 的库存中选件装入出击 slot
    - 基础2主动+1被动，成长后3主动+1被动；主动键 `Q / F / G`。唯一真相为 `getSortieActiveSlotCount()` / `getSortiePassiveSlotIndex()`。DEC-142另有1个武器槽，不占技能槽；唯一装配入口为裂隙入口的备行
    - 出击中使用主动工具：按对应键位触发
    - 每次使用 `usesRemaining--`
    - `usesRemaining === 0` 时 `stage = 'broken'`，从库存中移除

14. **出击工具效果**：13族能力见本节，全部具体定义见CSV；历史brainstorm不作为现行数值真相。

15. **被动工具**：装了即生效，不占主动键位。触发次数计为 `usesRemaining`（每次触发消耗 1 次）。**每次触发必须有可见反馈**（贴源短闪 + 通道 B 事件条，见 Kit 反馈通道；不得静默扣次数）。

15a. **名称权威（Slice 5.5）**：上屏中文名的唯一真相是 `data/contaminants.csv` 的 `display_name_defense` / `display_name_tool`。代码禁止维护第二套本地名表。入口：`getDefenseName` / `getToolName`。

15b. **摘要列（Slice 5.5）**：CSV `summary_defense` / `summary_tool`（硬上限 15 个汉字，标点计入、空格不计）。检视 L2 与踏入槽摘要读这两列，禁止再截断长描述。

15c. **检视五层（Slice 5.5）**：选中即填充，无第二层打开。L1 身份 / L2 摘要 / L3 数值 / L4 与我的关系 / L5 转化去向。转化去向必须在防御槽第一屏可见（不得只藏在滚动区）。

15d. **库存排序**：按当前库存页所选排序稳定排序；同名物件优先高品质，余次与成熟状态独立展示，不在每帧重排。

### G — 永久改造

16. **改造交互**：净化点中"改造祭坛"交互点（走近按 E 打开蜕变面板）。**加厚**（全局抬模块 `maxHp`）并进该面板第七张，规则归 `system-purification-impact` U 组（DEC-117）。加厚不是蜕变刻入项：不进 `upgrades.csv`、不吃改造折扣、不计稳定度 +3。
17. **改造项**：

**Slice 3 实现（3 个，每轴 1 个）**：

| ID | 名称 | 轴线 | 效果 | 上限 |
| -- | ---- | ---- | ---- | ---- |
| `growth_chaos_resist` | 渗透抗性 | 出击效率 | 混乱值 BASE_RATE 额外减免 -4%/级 | 5 级（-20%） |
| `growth_kindling_affinity` | 薪柴亲和 | 资源效率 | 每次拾取薪柴额外 +1 | 3 级（+3） |
| `growth_vitality` | 生命强化 | 生存韧性 | 最大生命值 +15/级 | 4 级（+60） |

**Slice 4+ 扩展（设计已有，分批实现）**：行动效率、抗性缓冲、深度感知、模块协同、创伤适应、净化共振。

18. **费用曲线**（统一所有改造项）：

| 级别 | 费用（薪柴） |
| ---- | ------------ |
| 1 | 8 |
| 2 | 12 |
| 3 | 18 |
| 4 | 25 |
| 5 | 35 |

19. **永久性**：改造一旦购买不可撤销、不可降级。效果在所有后续出击中生效。
20. **效果应用**：改造效果通过 `GrowthState.getModifiers()` 返回，场景切换时与模块效果合并为 `SortieModifiers`。

### S — 净化稳定度

21. **积分规则**：

| 行为 | 积分 |
| ---- | ---- |
| 成功撤离 | +2 |
| 购买任意改造升级 | +3 |
| 完整度过一次 Crest（无模块归零） | +5 |
| 潮汐切换（进入新 Tide） | +8 |
| 模块归零 | -1 |

22. **显示**（Slice 5.5 DEC-045 D7 + 2026-08-13 右上写明）：稳定度**不**在净化点常驻 HUD 以进度条呈现——它不影响净化点即时决策，且 100% 尚无终局内容（规则 23），进度条隐喻是空头承诺。改为存续报告（P2）内的**状态陈述**（如 `42%` / `已完成`）。潮汐由净化点 HUD 潮汐行承载，**三个独立可见节点**（不得粘成一句）：
    - 表名：`潮汐`
    - 值：`第 N 潮`（N = `tideNumber`）
    - 相位：`涨潮` / `潮峰` / `退潮`，对照 TidePhase `rise` / `crest` / `ebb`（与存续报告已上屏 `phaseLabels` 同一套）。禁止发明「满潮」「落潮」等机制里没有的词。
    常驻 HUD 不画波形与 `◇`。薪柴槽必须有独立表名「薪柴」+ 独立数字。稳定度不加回常驻 HUD。
23. **到达 100%**：本 Slice 仅标记 `reached = true`，不触发终局内容（推迟到后续 Slice）。显示用状态陈述「已完成」，不用进度条拉满动画。

### P — 持久存档

24. **保存时机**：每次返回净化点时自动保存（包括分配/改造操作后）。
25. **存储**：`localStorage` key = `'coh-save-v1'`。
26. **加载**：主菜单"Continue"按钮读取存档恢复全部状态。
27. **版本迁移**：`SaveData.version` 字段。迭代19库存底座当前写入version=2（`SaveDataV2`）；旧version=1经统一库存导入保留污染物ID、阶段、次数、装配和成长，迁移增加普通白板。V2以`inventory`为唯一物品归属，旧污染物数组不重复写入。下文早期SaveData示意属于V1合同；实际字段以`src/types/game-types.ts`为准。正常出击、拾获、死亡/撤离、归来结算已接通；未完成出击的刷新/退出政策仍未定，不得由load自行处罚，详见`system-field-inventory.md`。库存内部版本2保存武器供奉/余次；旧内部版本1无字段武器仅迁移一次，已消费的余次不因重载回满。
28. **重置**："New Expedition" 清除存档重新开始。

### F — 场景流修改

29. **裂隙场景新增**：
    - 2-3 个污染物节点（迭代 10 起：与薪柴统一为可翻找对象，外观不泄露内容物，规则 CN8/CN9）
    - 出击工具的使用键位绑定。**Slice 5 起为动态绑定**：键位序列是 `GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS`（Q / F / G），按 `contaminantSystem.getSortieActiveSlotCount()` 绑定前 N 个；被动工具无键位，其槽位下标由 `getSortiePassiveSlotIndex()` 给出，不得硬编码
    - 改造效果应用到 Player/ChaosSystem/LootSearchSystem（迭代 10 前为 LootSystem）

30. **净化点场景新增**：
    - 防御 slot 管理 UI（走到边界区域按 E 打开）
    - 改造祭坛交互点
    - 潮汐信息显示（当前 Tide + Phase）
    - 稳定度：存续报告内状态陈述（非 HUD 进度条；见规则 22）
    - 出击前装备选择界面（走到裂隙入口按 E 前弹出 loadout 选择）

---

## 数值表

| 参数 | 值 | 说明 |
| ---- | -- | ---- |
| 污染物节点/地图 | 2-3 | 裂隙中每次出击可获得 |
| Rarity 权重 | 60/30/10 | common/fine/rare |
| 防御 slot 数 | 3（改造后 4） | 净化点；`growth_defense_slot` 解锁第 4 槽 |
| 出击 slot 数 | 3（改造后 4） | 出击前选装；`growth_sortie_slot` 解锁第 4 槽（3 主动 + 1 被动） |
| 冲击点转化阈值 | 3 | 一般冲击 1 点，高潮 3 点 |
| 工具使用次数 | 普通 4-5 / 精良 3 / 稀有 2 | 用完破碎 |
| 改造 1 级费用 | 8 薪柴 | 递增到 35 |
| 稳定度满值 | 100 | 到达后标记完成 |
| 主动工具键位 | Q / F | 最多 2 个主动 |

---

## 事件契约

新增事件（需要添加到 `events.ts`）：

| 事件 | Payload | 说明 |
| ---- | ------- | ---- |
| `CONTAMINANT_ACQUIRED` | `{ contaminant: Contaminant }` | 裂隙中拾取 |
| `CONTAMINANT_TRANSFORMED` | `{ contaminantId: string }` | 防御→工具转化 |
| `CONTAMINANT_BROKEN` | `{ contaminantId: string }` | 使用耗尽 |
| `GROWTH_PURCHASED` | `{ upgradeId: string, newLevel: number }` | 购买改造 |
| `TIDE_PHASE_CHANGED` | `{ tide: number, phase: string, intensity: number }` | 潮汐切换 |
| `STABILITY_CHANGED` | `{ progress: number, delta: number }` | 稳定度变化 |
| `TOOL_USED` | `{ contaminantId: string, toolType: string, usesLeft: number }` | 出击中使用工具 |

保留现有事件不变：`IMPACT_STARTED/RESOLVED`、`MODULE_DAMAGED`、`ALLOCATION_CONFIRMED`。

---

## 边界情况

| 情况 | 处理 |
| ---- | ---- |
| 防御 slot 为空时冲击 | 该 slot 无减伤，全额打到模块 |
| 库存中无 tool-stage 污染物 | 出击时 slot 可以为空（少于 3 件或 0 件），不阻止出击 |
| 高潮冲击使 impactCharges 从 0 直接到 3 | 一次即转化，正确。该 slot 立刻空出 |
| 转化发生在冲击中 | 本次冲击的防御效果仍然生效（先防御后转化） |
| 改造效果 + 模块效果 + 出击工具叠加 | 乘法叠加：`finalRate = BASE_RATE * moduleCoreMod * growthChaosMod`。加法叠加薪柴：`value = base + growthAffinity`，再乘 `storageModifier` |
| 存档损坏/版本不匹配 | 提示"存档无法读取"，提供"开始新游戏"选项 |
| Final Tide 无限 Crest | 游戏不自动结束。玩家可以无限玩下去（但稳定度可能早已到 100%） |
| 污染物库存膨胀 | 无上限，但每次出击只能带 3 件工具+损耗机制自然控制数量 |

---

## 对外接口

| 消费者 | 接口 | 形式 |
| ------ | ---- | ---- |
| RiftScene | `SortieModifiers`（扩展版：含改造效果+模块效果） | scene data |
| RiftScene | 出击工具效果（冻结/领域/穿墙等） | ToolSystem API |
| PurificationScene | TideState + Contaminant[] 库存 + GrowthState + StabilityState | tideSystem / contaminantSystem / growthSystem / stabilityTracker 查询 |
| 净化点 HUD | `tideSystem.getState()`（`tideNumber` + `phase`） | 查询；潮汐行展示见规则 22 |
| ImpactSystem | 防御 slot 内容 + 各污染物效果 | contaminantSystem 查询（实际效果计算在 defense-engine.ts） |
| HUD | 工具剩余次数 + 冷却状态 | ToolSystem 查询 |

---

## 实现清单（Slice 3 范围）

| 优先级 | 任务 | 说明 |
| ------ | ---- | ---- |
| P0 | TideSystem | 状态机，替代线性 intensity |
| P0 | ContaminantSystem | 库存管理 + 生命周期 |
| P0 | GrowthSystem | 3 个改造项 + 费用扣除 + 效果应用 |
| P0 | StabilityTracker | 积分规则 + 进度值 |
| P0 | SaveManager | localStorage 读写 |
| P0 | 裂隙污染物节点 | 新节点类型 + 拾取逻辑 |
| P0 | 出击工具系统（3 种） | 普通 1 + 精良 1 + 稀有 1 的完整实现 |
| P0 | 防御 slot UI | 净化点面板 |
| P0 | 出击 loadout UI | 出击前选择面板 |
| P1 | 改造祭坛 UI | DOM 面板 |
| P1 | 潮汐信息 HUD | 净化点 + 冲击结果面板扩展 |
| P1 | 稳定度显示 | 存续报告状态陈述（Slice 5.5 起；原「净化点进度条」已废） |

**Slice 3 实现的 3 种污染物**：
- 普通：固化残渣 → 凝锁
- 精良：延时残渣 → 时裂
- 稀有：侵蚀残渣 → 侵蚀领域

选择理由：覆盖三档 + 效果差异大（冻结单体 / 区域感知压制 / 区域属性削弱）+ 实现复杂度可控。

---

## 校准问题

- [ ] 潮汐 Tide 1 的 Ebb 期是否足以让玩家买到第一个改造？（需要 8 薪柴余量 × 2 个 Ebb cycle）
- [ ] 3 个污染物节点/出击是否让防御 slot 维持有续？（每 Tide 约 6-9 cycle = 12-27 个污染物获取机会，3 slot 各需 1 个转化 = 至少 3 个）
- [ ] 高潮冲击一次转化是否让 Crest 期防御 slot 快速清空？（是的——这是设计意图：Crest 期是"裸防"考验）
- [ ] Final Tide 到达时玩家是否有足够工具库存？（取决于前 4 个 Tide 的积累）
- [ ] 渗透抗性 -20%（满级）+ CORE -30% 叠加后 BASE_RATE 降到 0.5 × 0.7 × 0.8 = 0.28 — 是否让 Final Tide 的出击过于轻松？
