---
status: ACTIVE
created-by: design agent
created-date: 2026-07-26
last-modified-by: design agent
last-modified-date: 2026-08-19
slice: 1 (extended in 5.5, 6, 7)
interface-changed: true
interfaces-with:
  - system-movement-vision     # T1：经场景层消费其三个视野调制器 + Player.setSpeedModifier('chaos')；撤离点注册为 glow source
  - system-enemy-ai            # T2：消费 ENEMY_ALERT / ENEMY_LOST_PLAYER / ENEMY_KILLED 判定"被侦测"与"被追击"
  - system-combat              # T4：消费 ENEMY_DAMAGED（战斗代价）与 PLAYER_DIED（出击失败路径）
  - system-map-generation      # Slice 6：出生 / 撤离 / 薪柴坐标由生成器给出，不再读手写固定图
  - system-purification-impact # Slice 7：出击起始混乱由 GameState.getStartingChaos() / SortieModifiers.startingChaos 写入
exposes:
  - ChaosSystem.getValue() / getRate() / getStage() / addChaos(source, amount) / setPaused(b)
  - getChaosModulators(value)  # 纯函数：混乱值 → { radiusScale, edgeCorruption, screenFlicker, speedMult }
  - LootSystem.getCarriedKindling() / getRemainingNodes()
  - ExtractionSystem.canExtract() / requestExtract()
  - RunController.endRun(reason)  # 出击结束的唯一出口（撤离 / 死亡）
  - 事件 CHAOS_CHANGED { value, delta, max, rate? }（`rate` 为建议新增字段）
  - 事件 CHAOS_THRESHOLD_REACHED { level: 1 | 2 | 3 }
  - 事件 KINDLING_COLLECTED { amount, total }
  - 事件 RIFT_EXIT_REACHED {}
  - 事件 RIFT_EXITED { kindlingGained, survived }
  - 数据契约 KindlingNode / ExtractionPoint / RunResult（供 T6 固定地图与 HUD 消费）
  - 地图布局约束（薪柴分布原则 / 撤离点位置原则，供 T6 消费）
---

# 系统设计：混乱值 + 搜刮 + 撤离

> **TL;DR**: 定义驱动"贪婪 vs 撤退"的三件套——混乱值（随时间单调上涨、可溢出 100 的压力钟，惩罚经 T1 的三个视野调制器 + 移速调制表达）、薪柴搜刮（按"离撤离点的路程 × 巡逻覆盖度"分档定价的固定地图散布物）、撤离（按 E 确认，结算带出薪柴）；对外暴露混乱值/薪柴/出击结束的事件与查询，以及供 T6 消费的地图布局约束。

## 概述

本系统是 Slice 1 验证问题的引擎。它自己不制造任何"内容"，只制造**一种货币和一组价目表**。

核心博弈公式：

> **混乱值让"时间"变成货币。薪柴让"绕路和等待"变成消费。撤离让"停止消费"变成一个随时可按的按钮。**

玩家在裂隙里的每一个安全选择——等巡逻走开、绕远路、蹲在墙后观察——都用**混乱值**付费；每一个冒险选择——贴着敌人视野边缘穿过、出手把它砍掉——都用**暴露和血量**付费。两种货币不可互换，而撤离按钮永远亮着。"还敢不敢再多拿一点"就是这两种货币之间的反复选择。

这决定了本系统的三条设计纪律：

1. **压力必须单调、可预测、不可逆**。混乱值只涨不跌（`world.md`：裂隙内无任何降低手段），玩家因此能够**计算**风险，而不是**赌**运气。可计算的压力才能产生纠结；不可计算的压力只产生烦躁。
2. **压力必须持续加码到最后一秒**。见"混乱值溢出决策"——如果压力在某个点封顶，那个点之后贪婪就不再有代价，博弈直接失效。
3. **惩罚必须先夺信息、后夺能力**。前半程只让玩家"看到时钟在走"（视野边缘的 teal 渗透），后半程才真正削弱视野与移速。反过来做会让整个后半程变成一场沉闷的拖行。

服务体验支柱 1（绝望边缘的紧绷）与支柱 2（贪婪与撤退的博弈）。

**本 spec 的所有权边界**：

| 归本 spec 拥有 | 归其他 spec 拥有 |
| -------------- | ---------------- |
| 混乱值的状态、速率、阈值、惩罚**取值** | 视野调制器的**实现与硬边界**（`system-movement-vision`） |
| 薪柴节点的数据契约、价值分档、分布**原则** | 固定地图上每个节点的**具体坐标**（T6 地图数据） |
| 撤离的触发规则与结算规则 | 敌人的感知判定与状态机（`system-enemy-ai`） |
| "出击结束"的两条路径与统一出口 | 玩家死亡的**触发条件**与受击表现（`system-combat`） |
| HUD 的信息架构与更新时机 | HUD 的视觉精细度（art agent） |

---

## 状态模型

```typescript
/** 混乱值阶段（对齐 art-direction §7.2 四档） */
type ChaosStage = 'safe' | 'warning' | 'danger' | 'overflow';

/** 混乱值增量的来源，用于调试面板归因与去抖 */
type ChaosSource = 'time' | 'detection' | 'combat' | 'debug';

interface ChaosState {
  value: number;              // 当前混乱值，0 → HARD_CAP，单调不减
  gaugeMax: number;           // HUD 满格刻度 = 100。注意：value 可以超过它
  hardCap: number;            // 硬上限 150，到达后停止增长（惩罚同时封顶）
  baseRate: number;           // 点/秒，基础上涨速率
  rateMultiplier: number;     // 当前速率倍率（被追击时 > 1）
  chasingEnemies: Set<string>;// 处于 chase 状态的敌人 id 集合，非空则倍率生效
  stage: ChaosStage;
  thresholdsFired: [boolean, boolean, boolean];  // level 1/2/3 是否已触发（单调，各触发一次）
  lastEmittedValue: number;   // 上次 emit CHAOS_CHANGED 时的值，用于按步长节流
  lastModulatedValue: number; // 上次向场景层下发调制值时的值，用于保护视野静止缓存
  detectionCooldowns: Map<string, number>;  // enemyId → 剩余冷却 ms，防止侦测脉冲被刷
  paused: boolean;            // 出击结束/结算面板期间冻结
  peakValue: number;          // 本次出击峰值，结算面板显示
}

/** 混乱值 → T1 调制器的映射结果（纯函数产物，不持有状态） */
interface ChaosModulators {
  radiusScale: number;        // → VisibilitySystem.setRadiusScale
  edgeCorruption: number;     // → VisibilitySystem.setEdgeCorruption
  screenFlicker: number;      // → VisibilitySystem.setScreenFlicker
  speedMult: number;          // → Player.setSpeedModifier('chaos', m)
}

/** 薪柴节点（地图静态数据 + 运行时状态） */
interface KindlingNode {
  id: string;                 // 格式 KDL_01 ...
  tier: 'safe' | 'contested' | 'deep';
  value: number;              // 拾取获得的薪柴点数
  position: Vector2;          // 世界坐标（px）。Slice 6 起由地图生成器给出，禁止钉死手写图格子
  collected: boolean;         // 运行时；拾取后置 true 并禁用碰撞体
}

interface LootState {
  carried: number;            // 当前携带薪柴总数（无上限，见"边界情况"）
  nodes: KindlingNode[];      // 本次出击的全部节点
  collectedCount: number;
}

/** 撤离点（地图静态数据） */
interface ExtractionPoint {
  id: string;                 // 固定为 EXIT_01（Slice 1 只有一个）
  position: Vector2;
  triggerRadius: number;      // px，进入即显示交互提示
}

/** 出击结果（结算面板 + 后续 Slice 的净化点结算消费） */
interface RunResult {
  survived: boolean;          // true = 主动撤离；false = 死亡
  kindlingGained: number;     // 死亡时恒为 0
  kindlingLeftBehind: number; // 死亡时 = 死亡瞬间携带量；撤离时 = 地图上未拾取的总价值
  peakChaos: number;
  durationMs: number;
  cause: string;              // 'extract' | 死亡原因（来自 PLAYER_DIED.cause）
}
```

---

## 规则

### C — 混乱值

1. **初值与起点**：进入裂隙时 `value` **不是恒为 0**。初值由净化器完整度写入（`system-purification-impact` 规则 27b / 31a）：`GameState.getStartingChaos()` → `SortieModifiers.startingChaos`，满完整度时为 0，残血线性带入，hp=0 时为 `CHAOS_HARD_START`（50）。防御残留 `initial_chaos` 叠在该值之上，一次写入，钳制到 `HARD_CAP`。混乱值只在 `RIFT_ENTERED` 之后、出击结束之前累积（`paused = false` 期间）。**本 Slice 不改**基础上涨、阈值、惩罚映射。`CHAOS.START_VALUE = 0` 仅表示「净化器满完整度且无残留」时的初值。
2. **基础上涨**：每帧 `value += baseRate × rateMultiplier × dt`。**匀速为主**——不随深度、不随位置、不随已拾取薪柴数变化。理由：玩家必须能在脑内做"我还剩多少秒"的估算，估算成立，纠结才成立。
3. **单调不减**：裂隙内没有任何降低混乱值的手段（`world.md` 机制约束）。因此阈值只会被向上穿越一次，无需处理降级/回滚。
4. **硬上限**：`value` 钳制在 `HARD_CAP`（建议 150）。到达后停止增长，**不强制死亡、不强制传送**——`vision.md` 明确混乱值是软限制而非硬截止。此时惩罚同时封顶（见规则 9），玩家仍可自行爬回撤离点。
5. **加速来源 ①：被侦测（脉冲）**。收到 `ENEMY_ALERT` 且 `alertLevel` 为 `'alert'` 或 `'chase'` 时，`value += DETECTION_BONUS`。同一 `enemyId` 在 `DETECTION_BONUS_COOLDOWN`（建议 10 s）内最多计一次——否则一个在 suspicious/alert 之间反复横跳的敌人会把玩家刷死。`'suspicious'` 不计（它是"敌人在怀疑"，不是"玩家被抓到"）。
6. **加速来源 ②：战斗（脉冲）**。收到 `ENEMY_DAMAGED` 时 `value += COMBAT_BONUS`。**只有命中才计，空挥不计**——代价挂在"制造了真实冲突"上，而不是惩罚误操作。这条是 T4「战斗有代价」的混乱值侧钩子。
7. **加速来源 ③：被追击（持续倍率）**。当 `chasingEnemies` 非空时 `rateMultiplier = CHASE_RATE_MULT`（建议 2.0），否则 1.0。集合由 `ENEMY_ALERT{alertLevel:'chase'}` 加入、`ENEMY_LOST_PLAYER` 与 `ENEMY_KILLED` 移出。**倍率不随追击者数量叠加**（两个敌人追你不比一个更费时间，只更危险）。
   - 为什么脉冲与倍率都要有：脉冲教玩家"刚才那下花了钱"（归因清晰），倍率制造"现在必须摆脱这个状态"（持续压力）。只有脉冲，被追击就变成一次性罚款；只有倍率，出手攻击就没有可感知的即时代价。
8. **阈值事件**：`value` 首次达到或越过 `THRESHOLD_1 / 2 / 3`（50 / 75 / 100）时，各 emit 一次 `CHAOS_THRESHOLD_REACHED { level: 1 | 2 | 3 }`。一次出击内每个 level 最多触发一次。
9. **阈值惩罚 = 连续曲线，不是阶梯**。惩罚由纯函数 `getChaosModulators(value)` 给出（见"混乱值 → 调制器映射"），在阈值之间**线性插值**。玩家应当感到"压力在持续拧紧"，而不是"每隔一会儿被扣一次血"。
   - 唯一的例外是 `edgeCorruption` 在 50 处的小台阶（0 → 0.20），它是"你越线了"的世界侧提示。跨阈的**离散提示由 HUD 承担**（混乱值条闪烁 + 刻度线亮起），世界侧只负责连续变化。这个分工让"HUD 在报警"和"世界在恶化"读作两件事。
10. **惩罚的施加路径**：ChaosSystem **不直接调用** VisibilitySystem 或 Player（架构禁止系统间直接调用）。路径固定为：

    ```
    ChaosSystem.emit(CHAOS_CHANGED)
        → RiftScene 监听
        → const m = getChaosModulators(value)          // 从 chaos-system.ts import 的纯函数
        → visibility.setRadiusScale(m.radiusScale)
          visibility.setEdgeCorruption(m.edgeCorruption)
          visibility.setScreenFlicker(m.screenFlicker)
          player.setSpeedModifier('chaos', m.speedMult)
    ```

    `getChaosModulators` 是无状态纯函数（与 `utils/grid-raycast` 同样的解耦先例：import 纯函数 ≠ 调用另一个系统实例）。数值住在混乱值系统里保证单一真相，接线住在场景层保证不违反架构。
11. **节流（两条，必须都做）**：
    - `CHAOS_CHANGED` 仅在 `|value − lastEmittedValue| ≥ EMIT_STEP`（建议 1.0 点）时 emit，而非每帧。基础速率下约 0.8 次/秒。
    - 调制器 setter 仅在 `|value − lastModulatedValue| ≥ MODULATOR_STEP`（建议 1.0 点）时调用。**理由是性能而不是美观**：`setRadiusScale` 会让 T1 的视野静止缓存失效，若每帧下发，玩家站着不动时视野也会每帧全量重算，直接吃掉 T1 的缓存优化。1 点步长下缓存最多约每 1.25 s 失效一次，而 1% 的半径变化在视觉上不可分辨。
12. **阶段判定**：`stage` 由 `value` 决定——`< 50` safe，`< 75` warning，`< 100` danger，`≥ 100` overflow。仅用于 HUD 与调试显示，不参与惩罚计算（惩罚走连续曲线）。
13. **结束即冻结**：出击结束（撤离或死亡）时 `setPaused(true)`，混乱值停止累积，调制器保持结算瞬间的值（不做归零动画——画面应当停在"最糟糕的那一刻"）。

### 混乱值溢出决策（T1 escalate 项 5 的裁定）

**决定：允许混乱值超过 100。`MAX_VALUE = 100` 的语义从"硬上限"改为"HUD 满格刻度与第三阈值"，新增 `HARD_CAP = 150` 作为真正的上限。**

理由：

- 如果混乱值在 100 封顶，那么**一旦封顶，多待一秒就不再有额外代价**。玩家的最优策略从"权衡"退化为"顶到 100 然后从容清图"——本 Slice 的验证问题在最该紧绷的那一段被自己关掉了。压力钟必须走到最后一秒。
- `vision.md` 写明"超过阈值不强制撤离，而是惩罚逐步加码（软限制，不是硬截止）"。"逐步加码"要求阈值之上还有可加码的空间；100 硬顶使这句话无处落地。
- art §7.2 已经为 ">100%" 设计了完整的第四档表现（持续缩视野 + teal 噪点渗入 + 全屏微闪）。把"超阈值"重定义为"达到 100"能救活这段死代码，但会把第四档压成一个**没有厚度的瞬间状态**——它设计的是一段渐强过程，不是一个点。
- 副作用可控：溢出区间 100→150 有 62.5 s（建议速率下），惩罚在此区间内从 −10% 视野 / −10% 移速加码到 −60% 视野 / −50% 移速。这段"知道自己撑不住了但还想再拿一个"正是本 Slice 最想要的体验。到 150 封顶（而不是无限）是为了保证玩家永远保留爬回撤离点的可能——`world.md` 的定位是"渗透"而不是"处决"。

**对 `constants.ts` 的影响（由 code agent 在 T9 执行）：**

| 字段 | 变更 | 说明 |
| ---- | ---- | ---- |
| `CHAOS.MAX_VALUE: 100` | **保留数值，改变语义** | 不再作为 `value` 的钳制上限，而是 HUD 满格刻度 + 第三阈值基准。建议在注释里写清（可选改名为 `GAUGE_MAX`，但 `CHAOS_CHANGED.max` 字段仍应传 100，见下） |
| `CHAOS.HARD_CAP: 150` | **新增** | `value` 的真实钳制上限 |
| `CHAOS.THRESHOLD_3: 100` | **新增** | 第三阈值 = 溢出起点 |
| `CHAOS.CHASE_RATE_MULT: 2.0` | **新增** | 被追击时的速率倍率 |
| `CHAOS.DETECTION_BONUS_COOLDOWN: 10000` | **新增** | ms，同一敌人的侦测脉冲去抖 |
| `CHAOS.EMIT_STEP: 1.0` / `CHAOS.MODULATOR_STEP: 1.0` | **新增** | 节流步长 |
| `CHAOS.BASE_RATE: 1.5` | **改为 0.8（已决定，DEC-014）** | 依据见"可调参数表"的时长推算。constants 现值仍是 1.5，**待 T9 落地为 0.8**；落地后仍是首要试玩校准旋钮 |
| `CHAOS.PENALTIES.*` | **替换为锚点表** | 现有的两档离散惩罚被本 spec 的四锚点连续曲线取代，不允许两套并存 |

**`CHAOS_CHANGED` payload 的 `max` 字段**：继续传 `100`（= 满格闸门 / 第三阈值），**不传 `HARD_CAP`**。`value > max` 是合法状态。HUD **不再**用 `max` 做条的分母——条按 `HARD_CAP`(150) 定长，刻度落在 50 / 75 / 100 的绝对值位置，100 刻度为加粗闸门；100 以上走单独的溢出段（见 HUD 规则 H5）。`max` 仍传 100 是为了非 HUD 消费者（以及"闸门=100"的语义），events.ts 必须注明 `value` 可以大于 `max`。

### 混乱值 → 调制器映射（art §7.2 四档的最终裁定）

T1 给出的四档参考表在本 spec 中被展开为**分段线性曲线**。锚点：

| 混乱值 | art §7.2 档 | radiusScale | edgeCorruption | screenFlicker | speedMult |
| ------ | ----------- | ----------- | -------------- | ------------- | --------- |
| 0 | 安全 | 1.00 | 0.00 | 0.00 | 1.00 |
| 50⁻ | 安全 | 1.00 | 0.00 | 0.00 | 1.00 |
| 50 | 警告（起） | 1.00 | **0.20**（台阶） | 0.00 | 1.00 |
| 75 | 危险（起） | 1.00 | 0.42 | 0.00 | 1.00 |
| 100 | 超阈值（起） | 0.90 | 0.65 | 0.00 | 0.90 |
| 130 | 超阈值（能力封顶） | 0.40 | 0.91 | 0.60 | 0.50 |
| 150 | 超阈值（感知封顶） | 0.40 | 1.00 | 1.00 | 0.50 |

分段公式（`t` = 当前混乱值）：

```
radiusScale(t)    = 1.00                                   , t ≤ 75
                  = 1.00 − 0.10 × (t − 75) / 25            , 75 < t ≤ 100
                  = 0.90 − 0.50 × min(1, (t − 100) / 30)   , 100 < t ≤ 150   // 130 触达 0.40 下限

edgeCorruption(t) = 0.00                                   , t < 50
                  = 0.20 + 0.45 × (t − 50) / 50            , 50 ≤ t ≤ 100
                  = 0.65 + 0.35 × min(1, (t − 100) / 40)   , 100 < t ≤ 150   // 140 触达 1.00

screenFlicker(t)  = 0.00                                   , t ≤ 100
                  = min(1, (t − 100) / 50)                 , 100 < t ≤ 150   // 驱动蒙层/跳变/噪点强度

speedMult(t)      = 1.00                                   , t ≤ 75
                  = 1.00 − 0.10 × (t − 75) / 25            , 75 < t ≤ 100
                  = 0.90 − 0.40 × min(1, (t − 100) / 30)   , 100 < t ≤ 150   // 130 触达 0.50 下限
```

全部输出在 `t > 150` 时取 150 处的值。所有输出均落在 T1 声明的硬边界内（`radiusScale ≥ MIN_RADIUS_SCALE = 0.4`；`speedMult ≥ SPEED_MOD_MIN = 0.5`；两个 corruption 量 ≤ 1.0），即便如此，**实现时仍应在 setter 侧再钳一次**——纯函数与硬边界分属两个 spec，不能靠约定保证。

溢出档的世界层（100→150）不只靠调制器数字：HUD 叠一层随 `screenFlicker` 加厚的 teal 蒙层 + 颗粒噪点，并以约 2.2 s 一次的低频跳变（非高频闪烁）编码"过闸"。视野缩小与移速在 130 封顶，蒙层/跳变/噪点继续加到 150，避免"条还在涨但世界已经不再变糟"。

对 T1 参考表与既有 constants 的偏离，及理由：

| 偏离 | T1 / constants 原值 | 本 spec | 理由 |
| ---- | ------------------- | ------- | ---- |
| 视野缩小的起点 | T1 表：危险档恒为 0.90 | 75→100 从 1.00 线性降到 0.90 | 阶梯会在 75 处产生一次可见的"视野猛地缩一圈"。改成斜坡后，"危险档结束时正好缩了 10%"仍然满足 art §7.2 的描述，但过程连续，且导数在 100 之后变陡——读作"越来越快地收紧"，正是想要的加码感 |
| 移速惩罚的起点 | constants：50 处 0.85 | 50 处不变，75 起才开始降 | 见设计纪律 3：前半程只夺信息不夺能力。在 50% 就砍 15% 移速是一笔昂贵且几乎不可见的税——玩家感到"变钝了"却不知道为什么，还会让 75 那一档失去辨识度。等价地说，既有 constants 的两档惩罚被整体**后移一档**，与 T1 对视野惩罚做的处理一致 |
| 溢出档的能力封顶 | 原：150 才触达视野/移速下限 | **130** 触达下限 | Slice 5.5 试玩：满格 100 与上限 150 冲突时，100 之后必须立刻读作新档，而不是再花 50 点才把惩罚拧满 |
| 溢出档的 flicker | T1 表：0.5；旧式 0.08 alpha / 4 s 余弦微闪 | `screenFlicker` 斜到 1.0；世界层改为常驻蒙层 + ~2.2 s 跳变 + 颗粒噪点 | 旧微闪在 0.08 硬顶下几乎看不见。低频跳变不是闪光训练，峰值可以更高；癫痫约束仍禁止高频频闪 |

### L — 搜刮

14. **拾取方式：走上去即自动拾取，无需按键**。玩家碰撞体与节点距离 ≤ `LOOT.PICKUP_RADIUS`（建议 16 px）时立即拾取。
    - 为什么不加确认键：**决策发生在"要不要走过去"，不在"要不要弯腰"**。在决策已经完成的地方加一次按键只是操作噪音。与撤离形成刻意对比——撤离是不可逆的，所以要按键；拾取是纯收益的，所以不要。
15. **拾取即结算**：`carried += node.value`，节点 `collected = true`、禁用碰撞体、隐藏 sprite，emit `KINDLING_COLLECTED { amount: node.value, total: carried }`。节点不重生。
16. **拾取不依赖可见性**：即使节点当前不在视野内（例如玩家从黑暗中撞上它），仍然拾取。逻辑与渲染分离——"我明明踩上去了却没捡到"是纯粹的挫败，没有任何设计价值。
17. **薪柴不是发光泄露源**（T1 规则 19）。节点 sprite 的 alpha = `VisibilitySystem.getVisibilityAt(node.position)`，视野外即完全不可见。搜刮必须靠视野推进，否则退化为"看着光点跑过去"。
18. **没有记忆标记（只约束薪柴节点）**：离开当前视野的已发现薪柴节点，不在主画面或 HUD 上留独立方位标记。玩家自己记「那个节点在哪」仍是信息不足的一部分。本条**不**禁止小地图记住已探索格子——战争迷雾是规则 30 的另一条规则。深渊之眼时限内画在小地图上的节点菱形是工具揭示，不是本条所说的记忆标记。→ 列为待验证假设；若试玩证明这造成的是烦躁而非紧张，最小补丁是给**已被看见过**的节点加极弱 glow，而不是给全部节点加。
19. **无携带上限**（`carried` 无上限）。`vision.md` 的储藏模块容量属于净化点元循环（Slice 2+）。本 Slice 只验证"时间压力 vs 贪婪"这一条轴；加入容量上限会引入第二条约束轴，两者的信号会互相污染，人将无法判断纠结感来自哪一个。
20. **价值分档与分布原则**（这是本系统真正的关卡设计工具，供 T6 消费）：

    | 档 | 数量 | 单价 | 位置原则 | 玩家付出的成本 |
    | -- | ---- | ---- | -------- | -------------- |
    | `safe` | 3 | 1 | 主干路线沿途或 ≤3 tile 的顺手绕行；不在任何巡逻单位的常驻视野内 | 几乎为 0（教学档：让玩家学会"薪柴长这样"） |
    | `contested` | 3 | 2 | 位于某巡逻单位路径的**扫视范围内**，存在周期性安全窗口 | 观察 + 等待窗口（≈15–30 s）→ **直接用混乱值买安全**，或冒险硬穿 |
    | `deep` | 2 | 4 | 远支线尽头，往返需离开主干 ≥15 tile；途中至少经过一个巡逻覆盖段 | 一大段路程 + 一次穿越（≈40–60 s） |

    地图总价值 = 3×1 + 3×2 + 2×4 = **17**。
    - 单价随成本**超线性**增长（1 / 2 / 4 对应约 0 / 20 s / 50 s）是刻意的：如果单价与成本线性，理性玩家会算出"全拿"和"只拿安全的"收益率相同，于是不存在纠结。超线性让深处的诱惑真实存在，而混乱值让它真实危险。
    - `contested` 档是本系统的核心：它把"等待"变成一笔**明码标价的支出**（等 20 s = 16 点混乱值 = 约 1/6 条命）。这是整个 Slice 里最纯粹的博弈时刻。
21. **地图布局约束**（供 T6，与薪柴分布同为一体）：
    - **出生点（裂隙入口）与撤离点分列可走陆地两端**，主干走路 ≈ 40–60 s。坐标由 `system-map-generation` 生成，禁止落在 Slice 1 手写图那个撤离格上。撤离是"继续前进抵达终点"，不是"原路折返"。
    - 至少两条从出生点到撤离点的路线：一条短而暴露，一条长而隐蔽。这让"混乱值高了怎么办"有一个可执行的战术答案（换路），而不只是"跑快点"。**机器判定归属 `system-map-generation` 规则 21。** 无换路 = 坏图。仍是一个撤离点，不是两个撤离点，不是捷径口。
    - `contested` 与 `deep` 节点必须挂在主干**侧枝**上，使"多拿一个"= 一次明确的离线绕行。
    - 通往撤离点的最后一段走廊由 1 个巡逻单位覆盖——**最后一道关**。但撤离点触发格本身不在任何巡逻路径的常驻视野内：最后一关应当可以靠等待/绕行/战斗解决，而不是靠运气。
    - 需要 3–4 个巡逻单位才能支撑上述覆盖（具体数量与路点归 T2/T6）。

### E — 撤离

22. **触发**：玩家进入 `ExtractionPoint.triggerRadius`（建议 48 px = 1.5 tile，与 architecture 的 `PURIFICATION.INTERACTION_RADIUS` 取同值）→ HUD 显示交互提示 → 玩家按 **E** 确认 → 撤离。
    - **对 Brief / vision "到达即撤离" 措辞的偏离，已决定并说明**：撤离点同时是 Slice 1 唯一的发光泄露源（T1 规则 19），也就是玩家全程的导航锚点——他们会反复朝它移动、在它附近路过。"到达即撤离"意味着一次误触就终结整局出击，且这次误触**恰好发生在玩家正在权衡是否再多拿一个的时刻**。这不是紧张，是事故。加一次按键确认把"不可逆"和"可逆"分开，同时复用了 architecture 已定义的 InteractionTrigger 交互习语（净化点模块的"按 E 管理"）。→ 请 Director 记入 decisions-log。
23. **确认即结束，不可打断**：按下 E 的瞬间出击结束，即使正被追击、即使下一帧会被击杀。最后一秒逃出生天是这个循环的高光时刻，不应该被剥夺。
24. **结算序列**（撤离路径）：
    ```
    按 E
      → emit RIFT_EXIT_REACHED {}
      → RunController.endRun('extract')
         ① runEnded = true（守卫标志，见边界情况）
         ② chaos.setPaused(true)；player.setInputEnabled(false)
         ③ 等待 EXTRACT_SETTLE_DELAY（建议 0.6 s，让玩家看清自己站在撤离点上）
         ④ emit RIFT_EXITED { kindlingGained: carried, survived: true }
         ⑤ 显示结算面板
    ```
25. **死亡路径**：`RunController` 监听 `PLAYER_DIED`（由 T4 发出）→ `endRun(cause)`，同样的 ①②③⑤ 序列，但 ④ 为 `RIFT_EXITED { kindlingGained: 0, survived: false }`。**未撤离的薪柴全部丢失**。
26. **两条路径的差异**（这是"贪婪的代价"在数值上的最终落点）：

    | | 主动撤离 | 死亡 |
    | -- | -------- | ---- |
    | 触发 | 在撤离点按 E | `PLAYER_DIED` |
    | 带出薪柴 | `carried` 全额 | **0** |
    | `RIFT_EXITED.survived` | `true` | `false` |
    | 结算面板标题 | `出击结束` | `出击失败` |
    | 混乱值 | 冻结在当前值 | 冻结在当前值 |

    死亡不另扣装备。**丢掉全部薪柴**仍是主惩罚。Slice 6 起阵亡与撤离成功同一去向：结算后面回净化点，**禁止原地按 R 再打这一次**（现状「阵亡 → 重新出击」作废）。这次出击仍计入归来/冲击——以前按 R 可以逃掉回净化点，那才是空惩罚。不另扣稳定度，除非人以后要求加码。
27. **撤离点注册为 glow source**：场景创建时调用 `VisibilitySystem.registerGlowSource('EXIT_01', pos, GLOW_LEAK_RADIUS)`，出击结束时 `unregisterGlowSource`。这是 Slice 1 唯一的 glow source（T1 规则 19）。
28. **允许空手撤离**：`carried = 0` 时也能撤离。侦察一圈就跑是合法策略，系统不做评判（`world.md` 叙事语调：陈述事实，不渲染情绪）。
29. **重开**：结算面板上按 **R** 重新开始出击（重置混乱值、薪柴、节点、敌人、玩家位置）。Slice 1 没有净化点场景，这是让人反复试玩、回答验证问题的唯一途径，不是可选项。

### H — HUD

> 本节是 UI spec 的**结构层**。视觉规格（精确尺寸、字距、动效曲线）由 art agent 补充；art-direction §6.2/§6.3 已给出的色彩与布局在此直接引用为约束。若 Slice 2 HUD 元素继续增加，本节应拆出为 `docs/specs/ui-hud.md`。

30. **元素清单与布局**（art §6.3）：

    | 元素 | 位置 | 显示内容 | 更新时机 |
    | ---- | ---- | -------- | -------- |
    | 完整度条 | 左上 `.device-plate` | 表名 `完整度` + 条 + 当前/上限分节点 | `PLAYER_HEALTH_CHANGED` |
    | 混乱值条 | 完整度下方 | 表名 `混乱` + 0–150 条（刻度 50/75/**100 闸门**）+ 纯数字 + 档位词另起一行（`稳定`/`渗透`/`侵蚀`/`临界`） | 条几何：`CHAOS_CHANGED`；文本：整数变化时 |
    | 生效中 | 混乱簇下方 | 防御残留限时行 + 每条进行中限时工具：中文名与剩余整数秒分节点。`tool_duration_ms === 0` 与冷却不上此行 | 每帧 `setActiveEffects`（权威 remainingMs，HUD 不自减） |
    | 工具槽 | 左下 | `[Q]/[F]/[G]` + 工具中文名 + 余量 | 使用/装载变化 |
    | 薪柴计数 | 右上 | 表名 `薪柴` + 数字（warm-dim，无条形） | `KINDLING_COLLECTED` |
    | 小地图 | 右下 `#rift-minimap.device-plate` | 跟随玩家的圆形局部窗口：覆盖范围内同时显示已探索与未探索迷雾；玩家标记带朝向；覆盖范围内只标一个撤离竖缝；深渊之眼时限内在同一窗口画敌方方与节点菱形。挂 `#dom-ui-root`。见下方 30a–30k | 每帧（场景层翻译可见性与朝向） |
    | 交互提示 | 屏幕中下 | `[E] 撤离`（仅可撤离时） | 进入/离开撤离点触发半径 |
    | 结算面板 | 居中小读出（宽 360，DEC-049） | 见规则 33 | `RIFT_EXITED` |

    挂载：屏幕空间一律 `#dom-ui-root`。禁止用 Phaser `scrollFactor(0)` 画角锚 HUD。禁止把小地图挂到 `document.body` 再用 `position:fixed`。
    「被发现」指示不在本清单（Slice 8）。

    #### 裂隙小地图（规则 30 扩写，DEC-063）

    本节是 HUD 结构层。像素直径、圆边画法、朝向标记的像素形由 **Art agent 补充**（视觉通行证第 4 节就地更新）。不发明新色、不新造第二种撤离符号、不新开挂载根。

    **载体（U1）**：**A 世界内装置**。这是裂隙随身罩上的一块方位读数（与左上完整度 / 混乱同一族 `.device-plate`），不是游戏外的软件窗口，也不是净化点墙机。屏幕空间挂 `architecture.md` 声明的 overlay 根 `#dom-ui-root`；不钉世界坐标。净化点没有小地图。

    **参考锚点（U12）**：从项目参考研究选取，学动作、不学皮。

    | 游戏 | 锚的维度（学什么动作） | 明确不学什么 |
    | ---- | --------------------- | ------------ |
    | Signalis | 方位读数是随身设备上的一块内容，不是浮在游戏外的软件层 | 复古显像管曲面畸变、把整张区域当可翻页全图 |
    | FTL: Faster Than Light | 决策信息常驻屏幕边缘，出击过程不必停下来点开地图 | 科幻全息蓝、圆形能量格当通用图标、把整艘船压进一块圆 |
    | Darkest Dungeon | 「走过的地方」与「没走过的黑暗」始终可对照，朝向/位置一眼可辨 | 羊皮纸花边、插画式图例、全屏大地图 |

    本屏不像：战术 Dashboard 鹰眼全图、通用雷达细框、设置页缩略图。

    **玩家必须回答的问题**：我在哪、探过哪儿？撤离点在不在这块窗口里、离我哪一侧？（深渊之眼生效时）敌人和薪柴在哪？

    | 优先级 | 信息 | 说明 |
    | ------ | ---- | ---- |
    | P0（始终可见，零操作） | 圆形局部窗口内的已探索地形剪影 | 与未探索迷雾同屏对照 |
    | P0 | 圆形局部窗口内的未探索迷雾 | 覆盖范围内必须同时有雾，不能只画已探索 |
    | P0 | 带朝向的玩家标记 | 与主画面朝向同一真相 |
    | P0 | 覆盖范围内的那一个撤离竖缝 | 仍只标一个撤离点；竖缝可保留 |
    | P1 | （无） | 小地图不另设按键打开或放大 |
    | P2 | 深渊之眼时限内的敌方方、节点菱形 | 接到同一圆形窗口，不另起一层 |

    **打开方式**：踏入裂隙后右下常驻，无需按键。不居中、不阻断。净化点不出现。出击结束随 HUD 卸下。禁止占用区仍是信息架构 S10：画面中心 ±120×80 逻辑像素与玩家朝向前方。

    **已锁规则句（qa 逐条打勾）**：

    30a. **圆形局部窗口，不是整张缓冲压进圆。** 小地图是圆形。圆跟随玩家：窗口中心对准玩家当前所在格，只显示该圆覆盖到的局部。禁止把生成器整块格子缓冲（现状 64×42）缩放到刚好塞进这个圆，也禁止让覆盖范围等于或显示完整 64×42。

    30b. **直径必须小于缓冲。** 以格子计的窗口直径必须严格小于生成器格子缓冲的较短边（现状 42 行），使玩家即使站在可走陆地几何中心，圆形覆盖范围也罩不住整张缓冲。具体像素直径由 art 定。不改生成器缓冲尺寸来「藏」边界。

    30c. **覆盖范围内同时显示已探索与未探索迷雾。** 圆内已见过的陆地 / 墙画已探索；圆内从未见过的格子画未探索迷雾。禁止只画已探索、把未探索留成空白或裁掉。

    30d. **玩家不能从小地图读出 64×42 矩形缓冲。** 禁止靠硬切边露出直线缓冲边。禁止缩放到刚好塞进整张缓冲。走到岛边时，虚空与雾必须仍被圆裁切；二者不能拼出矩形缓冲的直角。窗口伸出缓冲外的像素，用与未探索迷雾 / 岛外虚空同一套语言填，不得出现「数据到此为止」的矩形裁口。

    30e. **揭示 = 真实视野。** 一格被记为已探索，当且仅当该格曾被与裂隙主画面同一套可见性判为当前可见（遮挡 + 前向锥 ∪ 环身圈，查询 `VisibilitySystem.isPointVisible` / `getVisibilityAt`，经场景层翻译）。禁止用环身灯半径近似圆（脚边约 2.5 格、`RADIUS_AMBIENT` 单独画圈）代替视锥与遮挡。当前正被看见的格子与曾经看见过的格子都算已探索；未探索迷雾只覆盖从未被这套查询点亮过的格子。

    30f. **玩家标记带朝向。** 标记朝向与主画面 `Player.getFacingAngle()` / `getFacing4()` 同一真相，由场景层每帧传入。禁止再做成无朝向十字作为终态。像素画法由 art 在既有暖色玩家标记上补朝向，不新造第二种玩家色。

    30g. **深渊之眼接到同一圆形窗口。** 保留现有工具语义：时限、衰减、闪、敌方方、节点菱形。工具仍揭示所有敌人与未拾取薪柴节点的位置（含当前视野外）；小地图只在圆形覆盖范围内画出这些标记。不另起一层界面，不新造符号。

    30h. **仍只标一个撤离点。** 标记形状不新造第二种撤离符号；竖缝可保留。撤离点落在当前圆形窗口外时不画；落在窗口内时画那一条竖缝。

    30i. **挂载根。** 外层仍是 `#rift-minimap.device-plate`，挂 `#dom-ui-root`。禁止 `document.body` + `position:fixed`。禁止 Phaser `scrollFactor(0)` 角锚。

    30j. **圆边界的皮。** 圆的边界必须与裂隙随身罩 `.device-plate`、项目色板同一视觉语言。禁止通用雷达细框、灰金属线。人否过 1 像素 `#2a2d32` 框。像素级画法留给 art。

    30k. **净化点没有小地图。** 本条只约束裂隙。不改生成器缓冲尺寸。不写撤离多样性、不写第二种敌人。

    **结构层自检（机械层；审美待人终审）**：U1 载体 A、挂 `#dom-ui-root`。U5 可见词只用术语表已有项（撤离点 / 薪柴 / 裂隙）；本表面无新句子。U6 右下常驻，不占画面中心。U7 无按键、无悬停才可得的信息。U8 状态用已探索 / 未探索迷雾 / 深渊之眼生效中，不用 hover/disabled。U9 玩家带朝向、撤离用竖缝、深渊敌人用方、节点用菱形，不靠同形只靠色。U12 上表三款参考。

    **视觉规格部分由 Art agent 补充。**

31. **禁止每帧刷新文本**（architecture 约束）：所有 `setText` 只在上述事件回调中执行，且先比对新旧字符串，相同则跳过。混乱值条的**几何**可以每帧插值以保证平滑，但**文本**必须走事件。
32. **混乱值条的状态表现**（art §6.2/§7.2 的 HUD 侧）：

    | 状态 | 表现 |
    | ---- | ---- |
    | safe | contam-core (#1aad96) 填充，静态 |
    | 跨越阈值瞬间 | 整条闪白 2 次（约 0.4 s）+ 对应刻度线亮起并保持——这是"你越线了"的离散提示（规则 9） |
    | warning / danger | 填充色不变，脉动，脉动频率随 `value` 上升 |
    | **overflow（`value` > 100）** | 条按 150 定长，100 处加粗闸门；100 以上为更亮的溢出段并脉动；数字继续涨且改用 ui-danger；档位词 `临界` 同行分离、同为 danger 色。世界层：teal 蒙层 + 颗粒噪点随溢出加深，约 2.2 s 一次低频跳变 |
    | 速率加速中（被追击） | 填充色提亮一档 + 数字旁显示 `▲` |

    溢出态必须在条上"看得出来"，否则规则 4 的溢出设计对玩家不可见——玩家会以为满格就是终点，从而失去继续加码的感知。条的身份（`混乱`）与档位词（`稳定`/`渗透`/`侵蚀`/`临界`）必须分开呈现，禁止拼成 `N 混乱 · 稳定` 这种会被读成复合名词的字符串。
33. **结算面板内容**（冷峻、无人称；拾取用防御名）：
    标题撤离成功/阵亡；薪柴 / 残渣数 / 击杀 / 峰值混乱 / 用时；拾取列出本趟残渣**具体条目**（不得只报计数）；被动触发次数。底栏 `R`：**撤离成功与阵亡都是「返回净化点」**。挂 `#dom-ui-root`，宽 360 居中小读出，不加墙机 680×468。
34. **文本走 i18n**：所有面向玩家的字符串使用 `t()`，key 按 architecture DEC-004 的 `[domain].[context].[item]` 约定（`hud.chaos.label`、`hud.extract.prompt`、`hud.result.title` 等）。占位期只需 zh-CN。
35. **HUD 不参与逻辑**：HUD 只监听事件与读取查询接口，不持有游戏状态、不回写。结算面板的"按 R"通过回调交给 `RunController` 执行。

---

## 玩家交互

- **输入**：

  | 操作 | 键位 | 效果 |
  | ---- | ---- | ---- |
  | 拾取薪柴 | 无（走上去自动） | 立即入账，HUD 右上数字跳动 |
  | 撤离 | `E`（仅在撤离点触发半径内有效） | 结束本次出击 |
  | 返回净化点 | `R`（仅在结算面板显示时有效） | 撤离成功与阵亡都回净化点。阵亡禁止原地重开 |

  `E` / `R` 的按键读取归 RiftScene，不进 Player（Player 的输入只负责移动，见 T1 所有权边界）。

- **反馈**：

  | 玩家状态 | 系统响应 |
  | -------- | -------- |
  | 混乱值持续上涨 | 顶部条缓慢填充；50 起视野最外圈出现 teal 偏移；75 起视野开始收缩、脚步变沉；100 起全屏周期性微闪 |
  | 出手攻击命中 | 混乱值条一次可见跳变（+5 = 条宽的 5%）——"这一刀花了 6 秒" |
  | 被敌人锁定为追击目标 | 混乱值条提亮 + `▲`，填充速度肉眼可见地翻倍 |
  | 拾取薪柴 | 右上数字变化；节点 sprite 消失 |
  | 走近撤离点 | 视野外就能看到它的微弱光点（glow source）；进入触发半径显示 `按 E 撤离` |
  | 撤离 | 输入冻结 0.6 s → 结算面板 |
  | 死亡 | 输入冻结 → 结算面板（标题为失败、带出 0） |

---

## 数值结构（可调参数表）

> **状态列**：`建议值` = 有依据的初值，**需人试玩校准**；`技术定` = 技术/结构性取值，无需人拍板；`既有 constants` = 沿用 `src/config/constants.ts` 现值；`新增` = 需 code agent 在 T9 加入 constants。
> 全部集中在 `src/config/constants.ts` 的 `CHAOS` / 新增 `LOOT` / 新增 `EXTRACTION` 段，不散落在系统内部。

### 混乱值

| 参数 | 含义 | 建议初值 | 合理范围 | 对博弈手感的影响 | 状态 |
| ---- | ---- | -------- | -------- | ---------------- | ---- |
| `CHAOS.START_VALUE` | 净化器满完整度且无防御残留时的初值 | 0 | — | 实际开局读 `getStartingChaos()`，可为 0–50 再加残留。增长曲线不改 | 技术定（Slice 7 改语义） |
| `CHAOS.BASE_RATE` | 基础上涨速率 | **0.8 点/s**（已定，DEC-014；constants 现值 1.5，待 T9 落地） | 0.5–1.5 | **最重要的一个数**。它单独决定一次出击有多长、玩家有多少次决策机会。见下方时长推算 | 已决定 · 待试玩校准 |
| `CHAOS.MAX_VALUE` | HUD 满格刻度 + 第三阈值 | 100 | — | 语义已变更（不再是钳制上限），见"溢出决策" | 既有 constants（语义变更） |
| `CHAOS.HARD_CAP` | 真实上限 | 150 | 120–200 | 决定溢出区间有多厚。太小则加码空间不足；太大则末段惩罚过于缓慢，读作"卡住了" | 建议值（待校准）· 新增 |
| `CHAOS.THRESHOLD_1` | 警告阈值 | 50 | 40–60 | 第一次"越线"的时刻；太晚则前半程毫无提示 | 既有 constants |
| `CHAOS.THRESHOLD_2` | 危险阈值 | 75 | 65–85 | 移速/视野开始真正被夺走的点 | 既有 constants |
| `CHAOS.THRESHOLD_3` | 溢出阈值 | 100 | — | 与 `MAX_VALUE` 绑定，不独立调 | 技术定 · 新增 |
| `CHAOS.DETECTION_BONUS` | 被侦测脉冲 | 3 | 2–8 | ≈3.75 s 的时间损失。太大则一次失误就毁掉整局，玩家转向极端保守；太小则潜行失败没有代价 | 既有 constants |
| `CHAOS.DETECTION_BONUS_COOLDOWN` | 同敌人侦测去抖 | 10000 ms | 5000–15000 | 纯防刷，不影响手感 | 技术定 · 新增 |
| `CHAOS.COMBAT_BONUS` | 攻击命中脉冲 | 5 | 3–12 | ≈6.25 s。T4「战斗有代价」的主要落点。若试玩发现"砍掉敌人永远比等待划算"，**优先调这个数**而不是削弱玩家伤害 | 既有 constants |
| `CHAOS.CHASE_RATE_MULT` | 被追击时的速率倍率 | 2.0 | 1.5–3.0 | 决定"被追上"有多可怕。3.0 时被追 20 s 相当于损失 40 s，可能过于致命 | 建议值（待校准）· 新增 |
| `CHAOS.EMIT_STEP` | 事件节流步长 | 1.0 点 | 0.5–2.0 | 纯性能；>2 会让 HUD 数字跳动可见 | 技术定 · 新增 |
| `CHAOS.MODULATOR_STEP` | 调制器下发步长 | 1.0 点 | 0.5–2.0 | 纯性能（保护 T1 视野静止缓存）；>2 会让视野收缩出现台阶感 | 技术定 · 新增 |

**出击时长推算**（`BASE_RATE` 的校准依据，无追击加速）：

| `BASE_RATE` | 0→50 安全 | →75 警告 | →100 危险 | →150 溢出 | 总时长 |
| ----------- | --------- | -------- | --------- | --------- | ------ |
| 0.6 | 83 s | 42 s | 42 s | 83 s | 4:10 |
| **0.8（已定，DEC-014）** | **62 s** | **31 s** | **31 s** | **62 s** | **3:07** |
| 1.0 | 50 s | 25 s | 25 s | 50 s | 2:30 |
| 1.5（constants 旧值，已被 DEC-014 取代） | 33 s | 17 s | 17 s | 33 s | 1:40 |

选 0.8 的理由：一次"全清"出击的估算成本 ≈ 主干通行 50 s + safe 档 10 s + contested 档 3×20 s + deep 档 2×50 s ≈ **220 s**。在 0.8 的速率下，全清玩家将在混乱值约 **175**（超过硬上限）时才抵达撤离点——即**全拿是够不着的，但差得不多**。这正是想要的校准点：玩家每次都觉得"再放弃一个 deep 就能全身而退"，于是每次都会试。1.5 的现值下全清玩家在拿到第 4 个节点时就已顶到 150，后半局全程处于封顶惩罚下，博弈退化为纯粹的煎熬。

> ⚠️ 这个推算依赖 T6 固定地图的实际尺度。地图定稿后应重算一次；校准目标是"**全清所需时间 ≈ 到达 HARD_CAP 的时间 × 1.15**"。

### 搜刮

| 参数 | 含义 | 建议初值 | 合理范围 | 对博弈手感的影响 | 状态 |
| ---- | ---- | -------- | -------- | ---------------- | ---- |
| `LOOT.PICKUP_RADIUS` | 拾取判定半径 | 16 px | 12–24 | 太小会出现"擦边没捡到" | 技术定 · 新增 |
| `LOOT.NODE_COUNT` | 地图节点总数 | 8 | 6–12 | 决定决策次数。<6 则一局只有两三个抉择，样本不足；>12 则每个决策的分量被稀释 | 建议值（待校准）· 新增 |
| `LOOT.VALUE_SAFE` | safe 档单价 | 1 | 1 | 作为价值单位，固定 | 技术定 · 新增 |
| `LOOT.VALUE_CONTESTED` | contested 档单价 | 2 | 2–3 | 与等待成本的兑换率。调高会鼓励玩家去蹲安全窗口 | 建议值（待校准）· 新增 |
| `LOOT.VALUE_DEEP` | deep 档单价 | 4 | 3–8 | **贪婪的诱饵强度**。若试玩中没人去深处，先调这个数 | 建议值（待校准）· 新增 |
| 档位数量分配 | safe / contested / deep | 3 / 3 / 2 | — | 决定风险曲线的形状；deep 档 >2 会让"全清"变成不可能而非勉强够不着 | 建议值（待校准） |

### 撤离

| 参数 | 含义 | 建议初值 | 合理范围 | 对手感的影响 | 状态 |
| ---- | ---- | -------- | -------- | ------------ | ---- |
| `EXTRACTION.TRIGGER_RADIUS` | 触发提示半径 | 48 px（1.5 tile） | 32–64 | 与 architecture 的 `INTERACTION_RADIUS` 同值，保持全项目交互手感一致 | 技术定 · 新增 |
| `EXTRACTION.KEY` | 确认键 | `E` | — | 与净化点模块交互同键 | 技术定 · 新增 |
| `EXTRACTION.SETTLE_DELAY` | 确认到面板的延迟 | 0.6 s | 0.3–1.2 | 让玩家看清"我做到了"。过长会显得拖沓 | 建议值 · 新增 |
| `GLOW_LEAK_RADIUS` | 撤离点发光泄露半径 | 12 px | 8–24 | T1 已定义，此处只是引用 | 既有（T1） |

---

## Schema（内容条目的数据结构）

```typescript
/** 固定地图提供的搜刮/撤离布点数据（T6 写死，本 spec 定契约） */
interface RiftLayoutData {
  spawnPoint: Vector2;
  extractionPoint: ExtractionPoint;
  kindlingNodes: KindlingNodeDef[];
}

interface KindlingNodeDef {
  id: string;                              // KDL_01 ... KDL_08
  tier: 'safe' | 'contested' | 'deep';
  position: Vector2;
  /** 省略时按 tier 取 LOOT.VALUE_* 默认值。仅在需要手工微调单点时填写 */
  value?: number;
}
```

### 对外 API 契约

```typescript
interface ChaosSystemAPI {
  update(deltaMs: number): void;            // 每帧；paused 时直接 return
  getValue(): number;                       // 可能 > MAX_VALUE（见溢出决策）
  getRate(): number;                        // baseRate × rateMultiplier，供 HUD 的加速标记
  getStage(): ChaosStage;
  getPeak(): number;
  /** 统一的外部加值入口（调试面板 / 未来的其他代价钩子）。内部脉冲也走它 */
  addChaos(source: ChaosSource, amount: number): void;
  setPaused(paused: boolean): void;
  reset(): void;                            // 按 R 重新出击
  destroy(): void;
}

/** 纯函数，无状态。由场景层 import 并把结果转发给 T1 的调制器 */
declare function getChaosModulators(value: number): ChaosModulators;

interface LootSystemAPI {
  getCarriedKindling(): number;
  getRemainingNodes(): number;              // 未拾取节点数，调试/结算用
  getRemainingValue(): number;              // 未拾取总价值 → RunResult.kindlingLeftBehind
  reset(): void;
  destroy(): void;
}

interface ExtractionSystemAPI {
  /** 玩家是否位于撤离点触发半径内（HUD 用它决定是否显示提示） */
  canExtract(): boolean;
  /** 按 E 时调用；canExtract() 为 false 时无副作用 */
  requestExtract(): void;
  destroy(): void;                          // 内部执行 unregisterGlowSource('EXIT_01')
}

interface RunControllerAPI {
  /** 出击结束的唯一出口。runEnded 守卫在此实现 */
  endRun(reason: 'extract' | string): void;
  isRunEnded(): boolean;
  restart(): void;                          // 按 R
}
```

**Slice 1 首批内容条目**（具体坐标由 T6 在地图定稿时填入，本表定档位与配比）：

| id | tier | value | 位置意图 |
| -- | ---- | ----- | -------- |
| KDL_01 | safe | 1 | 出生点附近主干沿线——教玩家"薪柴长这样" |
| KDL_02 | safe | 1 | 主干中段顺手位 |
| KDL_03 | safe | 1 | 隐蔽路线沿线（奖励选长路的玩家） |
| KDL_04 | contested | 2 | 巡逻单位 A 路径扫视范围内，有约 8 s 安全窗口 |
| KDL_05 | contested | 2 | 巡逻单位 B 的折返端点附近，窗口更短 |
| KDL_06 | contested | 2 | 两条路线交汇的开阔处，无遮挡 |
| KDL_07 | deep | 4 | 远支线尽头，往返需穿越巡逻覆盖段 |
| KDL_08 | deep | 4 | 距撤离点最远的角落——"最后一个"的候选 |

叙事语调合规（`world.md`）：薪柴的描述文本沿用世界观已给的标杆——`异源残渣压缩物。燃烧时释放否定性。`（Slice 1 无 tooltip UI，此文本先备着，Slice 2 净化点界面消费）。

---

## 边界情况

| 情况 | 处理方式 |
| ---- | -------- |
| 死亡与撤离在同一帧 | `RunController` 持有 `runEnded` 守卫标志，先到者胜，第二次 `endRun` 直接 return。**必须实现**——玩家在撤离点被打死是高概率事件 |
| 混乱值到达 `HARD_CAP` | 停止增长，调制器封顶，不强制结束出击（软限制，`vision.md`）。HUD 显示 `150%` 并持续脉动 |
| 玩家在阈值边界反复横跳 | 不可能——混乱值单调不减，阈值只会被穿越一次（规则 3） |
| 同一敌人反复 alert→lost→alert | 侦测脉冲受 `DETECTION_BONUS_COOLDOWN` 去抖；速率倍率跟随集合，进出无副作用 |
| 追击中的敌人被杀死 | `ENEMY_KILLED` 必须从 `chasingEnemies` 移除，否则倍率永久卡在 2.0。这是本系统最容易漏的一个 bug，QA 应专项检查 |
| 追击中的敌人在场景销毁时仍在集合内 | `destroy()` 清空集合 |
| 玩家踩到不可见的薪柴节点 | 正常拾取（规则 16） |
| 同一帧踩到两个节点 | 各自独立结算，emit 两次 `KINDLING_COLLECTED` |
| 已拾取节点被再次 overlap | `collected` 标志 + 禁用碰撞体双重保护 |
| 空手撤离 | 允许，结算显示 0（规则 28） |
| 玩家站在撤离点上但未按 E | 什么也不发生。提示常驻显示，直到离开半径 |
| 撤离结算期间敌人仍在攻击 | 结算序列第 ② 步已 `setInputEnabled(false)`；同时 `RunController` 应在 `runEnded` 后忽略 `PLAYER_DIED`。撤离一旦确认就不可撤销（规则 23） |
| `getChaosModulators` 收到 NaN / 负值 / 超界值 | 输入先 `clamp(0, HARD_CAP)`；输出在 setter 侧再钳一次（见映射节说明） |
| 场景切换 / shutdown | ChaosSystem / LootSystem / ExtractionSystem 各自 `destroy()`：解绑全部事件监听、清空集合、`unregisterGlowSource('EXIT_01')`。（架构风险表：Phaser 场景切换内存泄漏） |
| 重新出击（按 R） | Slice 6 起阵亡/撤离都回净化点，不再原地重开。若仍调用 `ChaosSystem.reset()` 再开新裂隙：初值读本次 `startingChaos`，不是写死 0。其余：`carried=0`、节点重置、`thresholdsFired` 按初值已越过的阈记为已触发 |

---

## 与已有系统的接口

### 从其他系统接收

| 来源 | 接收什么 | 形式 | 用途 |
| ---- | -------- | ---- | ---- |
| `system-enemy-ai`（T2/T7） | `ENEMY_ALERT { enemyId, alertLevel }` | 事件 | `alert`/`chase` → 侦测脉冲；`chase` → 加入追击集合 |
| `system-enemy-ai` | `ENEMY_LOST_PLAYER { enemyId }` | 事件 | 移出追击集合 |
| `system-combat`（T4/T8） | `ENEMY_DAMAGED { enemyId, amount }` | 事件 | 玩家攻击命中 → 战斗脉冲 |
| `system-combat` | `ENEMY_KILLED { enemyId, position }` | 事件 | 移出追击集合（关键，见边界情况） |
| `system-combat` | `PLAYER_DIED { cause }` | 事件 | 触发死亡结束路径 |
| `system-combat` | `PLAYER_HEALTH_CHANGED { current, max }` | 事件 | HUD 生命值条 |
| T6 固定地图 | `RiftLayoutData`（出生点 / 撤离点 / 薪柴节点） | 场景创建时注入 | 布点 |
| `system-purification-impact`（Slice 7） | `SortieModifiers.startingChaos` | 场景 data / `getStartingChaos()` | 出击混乱初值。增长曲线不改 |
| `system-movement-vision`（T1/T5） | `Player.getPosition()`、`VisibilitySystem.getVisibilityAt(p)` / `isPointVisible(p)`、`Player.getFacingAngle()` / `getFacing4()` | 同步查询，**经场景层** | 拾取判定、节点 sprite alpha；小地图已探索集合与玩家朝向。小地图不 import VisibilitySystem |

### 向其他系统提供

| 消费方 | 提供什么 | 形式 |
| ------ | -------- | ---- |
| HUD / 裂隙小地图 | `CHAOS_CHANGED` / `CHAOS_THRESHOLD_REACHED` / `KINDLING_COLLECTED` / `RIFT_EXITED`；已见格子与朝向由场景层写入小地图 | 事件 + 场景翻译 |
| RiftScene（转发给 T1） | `getChaosModulators(value)` 纯函数的返回值 | import 纯函数 + 场景层调用 setter |
| `system-movement-vision`（经场景层） | `radiusScale` / `edgeCorruption` / `screenFlicker` / `speedMult` | setter 调用 |
| `system-combat`（T4） | `ChaosSystem.addChaos(source, amount)`——若 T4 需要新增其他"战斗代价"钩子，走这个统一入口而不是直接改 `value` | 经场景层调用 / 或 T4 emit 事件由本系统监听（**优先后者**） |
| Slice 2 净化点 | `RIFT_EXITED { kindlingGained, survived }` | 事件 |
| QA / 调试 | `getValue()` / `getRate()` / `getStage()` / `peakValue` | 同步查询 |

### 事件契约变更

以 `src/types/events.ts` 现状为准。本 spec 需要的全部事件均已存在，**仅一处建议新增字段**：

| 事件 | 变更 | 理由 |
| ---- | ---- | ---- |
| `CHAOS_CHANGED` | **建议新增可选字段** `rate?: number`（当前每秒上涨速率） | HUD 需要显示"加速中 ▲"（规则 32）。替代方案是让 HUD 自己监听 `ENEMY_ALERT`/`ENEMY_LOST_PLAYER`/`ENEMY_KILLED` 并重算追击集合——那是把同一段逻辑写两遍，且两份状态必然会不同步 |
| `CHAOS_CHANGED.max` | 语义澄清（不改类型） | 传 100（满格刻度），`value` **可以大于它**。需在 events.ts 加注释，否则消费方会假设 `value ≤ max` |
| `CHAOS_THRESHOLD_REACHED.level` | 语义澄清（不改类型） | 取值 1 / 2 / 3，一次出击内各触发一次 |
| `ENEMY_DAMAGED` | **暂不改**，但记录风险 | 本系统把它当作"玩家攻击命中"的唯一信号。若 T4 后续引入非玩家伤害源（环境伤害、敌人互伤），必须给 payload 加 `source` 字段，否则混乱值会被误加 |

---

## 对已有系统的影响

| 对象 | 影响 |
| ---- | ---- |
| `src/config/constants.ts` | `CHAOS` 段需按"溢出决策"的变更表改写：`MAX_VALUE` 语义变更 + 新增 6 个字段 + `BASE_RATE` 建议下调 + `PENALTIES` 两档离散值**替换**为四锚点连续曲线（不允许两套并存）。新增 `LOOT` 与 `EXTRACTION` 段。由 code agent 在 T9 执行 |
| `src/types/events.ts` | 建议给 `CHAOS_CHANGED` payload 加可选 `rate` 字段 + 两条语义注释。由 code agent 在 T9 执行 |
| `system-movement-vision`（T1） | **不新增「已见格子」只读接口。** 小地图已探索集合由场景层每帧用既有 `isPointVisible` / `getVisibilityAt` 累积。调制器取值仍由本 spec 填写。实现提醒：`setRadiusScale()` 必须让视野静止缓存失效（T1 规则 20）。见 escalate ⑤ |
| `system-enemy-ai`（T2） | 无需修改设计，但本系统依赖其 `ENEMY_ALERT` 的 `alertLevel` 语义（`suspicious` = 怀疑、`alert` = 已确认发现、`chase` = 正在追击）与 `ENEMY_LOST_PLAYER` 的发出时机。若 T2 的语义与此不同，以 T2 为准并回改本 spec 规则 5/7 |
| `system-combat`（T4） | 需要 emit `ENEMY_DAMAGED`（命中时）与 `PLAYER_DIED`（死亡时）。T4 的"战斗有代价"在混乱值侧已由本 spec 规则 6 落地，T4 无需自行修改混乱值 |
| T6 固定地图 | 必须满足规则 21 的布局约束并提供 `RiftLayoutData`。这是本 spec 对地图提出的**硬要求**，不是建议——分布原则失效则整个博弈失效 |
| `architecture.md` 模块注册表 | T9 完成后需登记 `ChaosSystem` / `LootSystem` 状态与接口，并新增 `ExtractionSystem`（或并入 `InteractionTrigger`）、`RunController`（`src/scenes/` 或 `src/managers/`，路径由 code agent 定）、`HUD`。**登记由 code agent 执行**，本 spec 不修改 architecture.md |
| `docs/progress/decisions-log.md` | 有两条设计取舍待 Director 记入：混乱值溢出（建议 DEC-010）、撤离改为按 E 确认（建议 DEC-011）。本 spec 不自行追加 |

---

## 验证标准

**本 Slice 结束时能验证：**

- "还敢不敢再多拿一点"是否真的成为一个**每局反复出现**的念头，而不是一次性的选择。
- 混乱值是否被读作**可计算的压力**（"我还有大概 40 秒"）而不是**不可控的骚扰**。
- 死亡失去全部薪柴是否制造了张力而非纯粹的挫败。

**预期正面结果：**

- 玩家在撤离点附近**停下来犹豫**，然后转身回去拿最后一个——这是本 Slice 想要的那一秒。
- 玩家会**主动放弃** deep 节点并说出理由（"来不及了"）——说明成本被正确感知。
- 玩家在 `contested` 节点前**等待安全窗口时会看混乱值条**——说明两种货币的兑换关系成立。
- 撤离时的混乱值分布集中在 **85–125**（既没有人早早保守撤离，也不是所有人都顶到 150）。
- 试玩者会**重开**（按 R）而不是关掉游戏。

**不 work 的信号：**

| 现象 | 指向的问题 | 调参方向 |
| ---- | ---------- | -------- |
| 所有人都在混乱值 <60 时撤离 | 薪柴诱惑不足 / 惩罚看起来太吓人 | 提高 `VALUE_DEEP`；确认玩家能否看到"还剩几个没拿" |
| 所有人都能全清且安全撤离 | 压力钟太慢 / 地图太小 | 提高 `BASE_RATE`；按"全清时间 ≈ 到达 HARD_CAP 时间 × 1.15"重算 |
| 所有人都顶到 150 才走 | 溢出档惩罚不够痛 | 加陡 100→150 段的 `radiusScale` / `speedMult` 斜率 |
| 玩家表达的是烦躁而非紧张 | 惩罚夺走了操作能力而非信息 | 检查是否 `speedMult` 降得过早（应在 75 之后）；优先加深 `edgeCorruption` 而非降 `radiusScale` |
| 玩家不知道自己为什么变慢了 | 惩罚与反馈脱节 | 强化跨阈的 HUD 离散提示（规则 32） |
| "砍掉敌人"永远优于"等待窗口" | 战斗代价太便宜 | **优先调 `COMBAT_BONUS`**，而不是削弱玩家伤害（削弱伤害会让战斗变得又贵又难受，那是两个惩罚） |
| 玩家频繁误撤离 / 抱怨撤离太麻烦 | 撤离确认设计失衡 | 前者已由按 E 确认预防；若出现后者，缩短 `SETTLE_DELAY` 而非取消确认 |
| 玩家看不出自己已经溢出 100 | HUD 溢出态表现不足 | 强化规则 32 的 overflow 行 |

---

## 待验证假设

- [ ] **`BASE_RATE = 0.8`（≈3 分钟一局）是让人上头的节奏** —— 依赖 T6 地图实际尺度，地图定稿后必须重算一次。
- [ ] **"全清够不着但差得不多"是正确的校准点** —— 备选是让全清刚好可行（奖励精通）；本 spec 选前者，因为 Slice 1 要验证的是纠结，不是精通。
- [ ] **溢出到 150 的软上限不会退化为"必死"** —— 若试玩发现溢出后基本无法走回撤离点，先放宽 `speedMult` 的下限（`radiusScale` 应保持严厉，夺信息比夺能力更符合设计纪律 3）。
- [ ] **脉冲 + 倍率的双层战斗代价是可感知的** —— 若玩家只感到"莫名其妙变快了"，说明脉冲的 HUD 反馈不足（+5 = 条宽的 5%，可能太小），需要专门的跳变动画。
- [ ] **不给已发现的薪柴留记忆标记，不会造成烦躁** —— 见规则 18 的最小补丁方案。
- [ ] **无携带上限不会让"贪婪"失去边界** —— 本 Slice 的边界由时间而非容量提供；若证明时间压力不足以约束贪婪，容量上限是 Slice 2 的现成工具。
- [ ] **按 E 撤离没有削弱"到达即解脱"的畅快感** —— 若确认键读作官僚流程，备选是缩短 `SETTLE_DELAY` 到 0.3 s，或改为"停留 0.8 s 自动撤离"（仍能防误触，但不需要按键）。

---

## ⚠️ 待确认 / escalate

> 本 spec 未擅自修改任何其他文档。以下需人 / Director / 对应 agent 处理。

1. **【已拍板，请记入 decisions-log】混乱值允许溢出 100**（T1 escalate 项 5 的裁定）。`MAX_VALUE` 语义变更为满格刻度，新增 `HARD_CAP = 150`，惩罚在 100→150 继续加码。理由见"混乱值溢出决策"。→ 建议 **DEC-010**。

2. **【已决定，偏离 Brief 措辞，请 Director 知悉】撤离改为"按 E 确认"**，而非 Brief / `vision.md` 的"到达即撤离"。理由：撤离点是唯一 glow source，玩家全程朝它移动，误触会在最关键的时刻终结整局。→ 建议 **DEC-011**。若 Director 认为必须严格执行"到达即撤离"，最小折中是"进入触发格后停留 0.8 s 自动撤离"（仍可防误触）。

3. ~~**【建议下调既有 constants】`CHAOS.BASE_RATE` 1.5 → 0.8**~~ **【已关闭 2026-07-29 — 人已拍板同意，记为 DEC-014】** 决定值 = 0.8，理由与推算见"出击时长推算"。`src/config/constants.ts` 现值仍为 1.5，**由 code agent 在 T9 落地为 0.8**；落地后仍是首要试玩校准旋钮。

4. **【需 code agent 在 T9 执行】`src/types/events.ts` 建议新增 `CHAOS_CHANGED.rate?: number`**，并为 `max` 字段加注释说明 `value` 可以超过它。这是本 spec 唯一的事件契约变更请求。

5. ~~**【需 code agent 在 T5/T9 注意】T1 规则 20 的视野缓存失效条件未包含调制器变更。**~~ **【已关闭 2026-07-29 — code agent 在 T5 实现时已补上 `setRadiusScale()` 置 `cacheValid = false`，并已回填 T1 规则 20】** 原文保留供追溯： `setRadiusScale()` 改变了射程，必须同时置 `cacheValid = false`，否则玩家静止时视野不会跟随混乱值收缩，会出现"站着不动混乱值涨了但视野没变，一动就突然缩一大截"。本 spec 的 `MODULATOR_STEP` 节流正是为了让这次失效的代价可控。→ 属于 T1 的实现细节遗漏，建议由 code agent 在 T5 实现时直接补上，并回填 T1 spec 规则 20。

6. **【已解决 2026-07-26 — art agent 已定稿：裂隙内薪柴实体 = teal 污染侧，HUD 计数 = warm-dim；art-direction §5.3/§12/§13.1 已统一】薪柴的色彩归属在 art-direction 内部原有三处不一致：**
   - §5.3：薪柴 = "不规则晶体/残渣，微弱 **teal** 余晖"
   - §12 占位色 / §13.1 色温主轴：薪柴归 **amber 暖色侧**
   - §2.3 规则 8：裂隙中暖色**仅来自玩家**，任何多出来的暖色都是叙事事件

   本 spec 的取舍（可被 art agent 推翻）：**裂隙内的薪柴实体用 teal 余晖**（§5.3，也符合 `world.md`"薪柴是异源污染残渣"的设定——它属于污染侧，不属于人类侧）；**HUD 的薪柴计数用 warm-dim 文字**（§6.2，它是玩家的资产读数，属于人类侧）。占位期 §12 规定的 amber 色块建议一并改为 teal，否则占位期就把"暖色 = 玩家"的色彩纪律教错了。

7. **【记录，暂不处理】出击时长与 `vision.md` 的 "Session 15-30 分钟" 不一致。** 本 spec 的一局约 3 分钟。原因是 Slice 1 只有一张固定小地图，不是完整 session。不建议改 `vision.md`。但需要 Director 知悉：**当后续 Slice 换成程序化大地图时，纯时间驱动的混乱值会不成比例地惩罚大地图**，届时可能需要把速率与地图规模解耦（例如按"已探索区域"或"已进入的碎片数"驱动）。这是一个已知的、被推迟的设计债。

8. ~~**【依赖 T2，需回头核对】**~~ **【已关闭 2026-07-29 — Director 已交叉核对，语义一致，本 spec 无需回改】** 核对结论：T2 `system-enemy-ai` 的 `ENEMY_ALERT.alertLevel` 三级语义与 `ENEMY_LOST_PLAYER` 发出时机，与本 spec 规则 5/7 的消费方式吻合；两侧对"suspicious 档不计混乱值"的处理也一致。
