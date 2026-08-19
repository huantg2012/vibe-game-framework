---
status: ACTIVE
created-by: design agent
created-date: 2026-07-26
last-modified-by: design agent
last-modified-date: 2026-08-19
interface-changed: true
slice: 8
interfaces-with:
  - system-movement-vision         # 复用 utils/grid-raycast 做视线遮挡；敌人渲染可见性由 VisibilitySystem 决定；平衡不变量来源（玩家视距/移速）
  - system-chaos-scavenge-extract  # ENEMY_ALERT 经场景层驱动混乱值累加；被看守的薪柴点位依赖巡逻路线
  - system-combat                  # 敌人 HP/受击/攻击归 T4，本 spec 只提供接敌站位与朝向
  - system-map-generation          # 每张裂隙 3–4 巡逻，恰好 1 个改写体；路点可走且从出生可达
  - ui-detection-pulse             # 屏缘干涉读 getDetection / getState / getPosition / getRole；无新事件
exposes:
  - AIState 枚举（patrol | suspicious | alert | chase | return，沿用 src/types/game-types.ts 既有定义）
  - EnemyRole（infiltrator | rewriter）与 PerceptionProfile（感知剖面，禁止复制第二份 FSM）
  - EnemyView.getId() / getRole() / getPosition() / getFacingAngle() / getFacing4() / getState() / isEngaged() / getDetection()
  - AISystem.update(dt, playerPos, playerIsMoving) / getEnemies() / getEnemyById(id)
  - AISystem.reportNoise(pos, radius, level)
  - AISystem.reportDamage(enemyId, sourcePos)
  - AISystem.despawn(enemyId) / onPlayerLost()
  - Pathfinding.findPath(from, to) 的使用契约与调度策略
  - EnemySpawnData / PatrolRouteData（type = CSV id；生成器契约见「生成器」）
  - data/enemies.csv → codegen 契约（渗透体策划字段迁出 constants）
  - 事件：ENEMY_ALERT、ENEMY_LOST_PLAYER。本 spec 仍不新增事件
---

# 系统设计：敌人 AI（五态 FSM · 两种感知剖面）

> **TL;DR**: 渗透体与改写体共用同一套五态 FSM（巡逻 / 警觉 / 警戒 / 追击 / 归位）。差异全部写在感知剖面与刺激权重上，禁止复制一份 FSM 只改数字。改写体听觉为主、视锥更窄、对移动噪声敏感，停步几乎听不见。每张裂隙恰好 1 个改写体。屏缘被发现指示读察觉度 0–1，规则在 `ui-detection-pulse`。HP/受击/攻击仍归 `system-combat`。

## 概述

裂隙里的污染体只做一件事：**让「再多拿一点」变成赌注**。Slice 8 起这张赌注有两条可学习的判断，而不是两种怪物 AI：

1. **渗透体（低度覆盖）**：绕视锥。视觉填充察觉度；听觉只是一次警觉点名。
2. **改写体（中度覆盖）**：停步、贴墙消声。听觉是主通道，视锥更窄；移动噪声权重大。视觉仍能锁定追击，但不是这条判断的主轴。

两条判断走**同一套五态**。玩家读懂的是「它在巡逻 / 怀疑 / 搜索 / 追我」，不是「这个类型另有一套状态名」。`world.md` 写改写体「新旧模式混合」——机制上落实为**感官权重混合**，不是随机切态。覆盖体（高度）本 Slice 不做。

设计目标仍是可读、可预测、可被学习。概念图：`docs/art/demos/entity-rewriter/VERDICT.md`（不对称、teal 成簇；视觉归 Art A1）。

### 所有权边界（敌人实体被多个 spec 共享，划清避免冲突）

| 归本 spec 拥有 | 归其他 spec 拥有 |
| -------------- | ---------------- |
| 敌人的位置 / 速度 / 朝向 / 碰撞体 / 移动 | 敌人的 HP、受击、死亡、尸体清理（`system-combat`） |
| FSM 状态、全部转换条件与计时器 | 敌人的攻击判定、伤害值、攻击冷却、出手时机（`system-combat`） |
| 感知（视觉锥、听觉、察觉度累积、视线遮挡的调用方） | 视线遮挡**规则本身**与射线实现（`utils/grid-raycast`，T1 拥有） |
| 巡逻路点数据契约、寻路调度策略、生成器对 `EnemySpawnData.type` 的约束 | 路点/出生点的**具体坐标**（`system-map-generation`） |
| 状态的可读性：行为 + 本体指示物 + 屏缘干涉的**数据**（察觉度/状态/方位） | 改写体 sprite（Art A1）；屏缘干涉的视觉（`ui-detection-pulse`）；受击白闪（`system-combat`） |
| `ENEMY_ALERT` / `ENEMY_LOST_PLAYER` 的发出时机 | 混乱值对这些事件的**响应权重**（`system-chaos-scavenge-extract`） |

**接壤处的明确约定**：追击到贴身后，**本 spec 负责把敌人停在攻击距离上并保持面向玩家**（`isEngaged() === true`），**是否出手、出多重的手、冷却多久由 `system-combat` 决定**。本 spec 不写任何伤害逻辑；`system-combat` 不改任何 FSM 状态（它只通过 `reportDamage()` 施加刺激）。

---

## 平衡不变量（硬约束，QA 应作为断言检查）

这六条比任何单个数值都重要。调参时可以动剖面数字，但不能破坏这些关系——玩家的视距优势和移速优势必须仍在（DEC-064）。

现值对齐 `src/config/constants.ts` 与 `data/enemies.csv`（玩家 `SPEED` 80、`VISION.RADIUS_FORWARD` 224）。旧 spec 里的 60/130/160 已作废，不得当验收基准。

| # | 不变量 | 现值 | 为什么 |
| - | ------ | ---- | ------ |
| I1 | 任一剖面 `sightRange` < `VISION_RADIUS_FORWARD` | 180 < 224（两种都是） | 玩家**先**看到敌人。否则「观察→决策」断掉 |
| I2 | 任一剖面 `chaseSightRange` < `VISION_RADIUS_FORWARD` | 210 < 224 | 锁定后加长视距也不得越过 I1 |
| I3 | 任一剖面 `chaseSpeed` < `PLAYER.SPEED` | 65 < 80 | **撤退永远可行**。追击是压力不是死刑 |
| I4 | 任一剖面 `patrolSpeed` << `PLAYER.SPEED` | 30 << 80 | 「等它走过去」是可执行战术 |
| I5 | 剖面内：听觉不能替代「看见才追击」；停步必须明显比移动更安全 | 渗透体 `hearingRange` 100 < `sightRange` 180，停步听觉半径 0；改写体移动听觉 150 < 180，**停步听力半径 40**，且停步通道把察觉度封顶在 0.20（低于警觉阈 0.35） | 渗透体：藏在视锥外仍有意义。改写体：听觉是主通道（权重），但停步/贴墙消声成立；**锁定追击仍要视线** |
| I6 | `AI_TURN_RATE` < `FACING_TURN_RATE` | 360 < 1080 °/s（共享，不进 CSV） | 绕到背后可执行，不是运气 |

**感知不对称是有意的**：敌人的感知**不受玩家视野限制**——玩家可能被自己看不见的敌人发现（改写体尤其如此）。紧张感由 I1/I3 和屏缘干涉（`ui-detection-pulse`）平衡。不要为了「公平」给敌人加视野遮罩。

**禁止的扩展**：不要为改写体另写一套状态机、不要把 I5 理解成「听觉半径必须大于视距」。听觉为主 = 刺激权重 + 窄视锥 + 移动倍率，不是把视距改短再复制 FSM。

---

## 状态模型

```typescript
/** FSM 状态。沿用 src/types/game-types.ts 中已存在的 AIState 枚举，不新增值 */
enum AIState {
  PATROL     = 'patrol',      // 沿固定路点巡逻
  SUSPICIOUS = 'suspicious',  // 有疑点，停下 → 转向 → 慢速查看
  ALERT      = 'alert',       // 确认有东西但看不到，主动搜索最后已知位置
  CHASE      = 'chase',       // 当前看得见玩家，直奔目标
  RETURN     = 'return',      // 归位过渡态：走回最近路点。玩家读作"巡逻"
}

/** 单个敌人的运行时状态（本 spec 拥有；HP 等字段由 system-combat 追加） */
interface EnemyAIState {
  id: string;                    // 'ENM_INF_01' 等，来自地图数据
  state: AIState;
  position: Vector2;             // 世界坐标（px）
  velocity: Vector2;
  facingAngle: number;           // 弧度，连续值。感知锥使用它
  facing4: Facing4;              // 量化四方向，sprite 使用它（与 T1 同一套量化规则）

  // —— 感知 ——
  detection: number;             // 察觉度 0..1。1.0 = 确信「那是玩家」
  lastSeenPlayerPos: Vector2 | null;
  lastSeenPlayerVel: Vector2 | null;
  losGraceMs: number;
  role: EnemyRole;               // 出生时从 CSV 行冻结，运行时不变

  // —— 计时器（毫秒，只在对应状态下推进）——
  suspicionTimerMs: number;      // SUSPICIOUS 无新刺激的持续时间
  searchTimerMs: number;         // ALERT 搜索的持续时间
  waypointPauseMs: number;       // PATROL 在路点的停留剩余

  // —— 目标与路径 ——
  investigatePos: Vector2 | null;      // SUSPICIOUS 的疑点位置（听觉给出的是抖动后的模糊位置）
  searchPoints: Vector2[];             // ALERT 的搜索点队列（预分配，最多 3）
  searchIndex: number;
  patrolIndex: number;                 // 当前目标路点下标
  patrolDir: 1 | -1;                   // pingpong 模式的方向
  path: Vector2[];                     // 当前跟随的路径点（预分配数组 + length 游标，不在循环内 new）
  pathCursor: number;
  repathCooldownMs: number;
  pathRequestPending: boolean;

  // —— 对外可读的派生量 ——
  engaged: boolean;              // CHASE 态且已到达接敌距离；由 system-combat 消费
  peakAlertLevelThisEpisode?: 'none' | 'suspicious' | 'alert' | 'chase';  // 事件去重用（可选：T7 实现改用 lastEmittedLevel + 1000ms 冷却完整覆盖去重，本字段未使用 — DEC-022 ④）
  alertEmitCooldownMs: number;
}

/** CSV id。与 data/enemies.csv 的 id 列一致 */
type EnemyRole = 'infiltrator' | 'rewriter';

/** 听觉连续填充能把 FSM 推到的最高态。追击仍要视线（T0 优先级 2） */
type HearingMaxPush = 'suspicious' | 'alert';

/**
 * 感知剖面。两种敌人各一行，从 data/enemies.csv 注入。
 * FSM 转换表、寻路、计时器**不**出现在这里。
 */
interface PerceptionProfile {
  role: EnemyRole;
  displayName: string;           // 渗透体 / 改写体。上屏仅内容/debug，屏缘干涉无字
  sightRange: number;
  sightHalfAngleCore: number;    // 度，半角
  sightRangePeriph: number;
  sightHalfAnglePeriph: number;
  chaseSightRange: number;
  hearingRange: number;          // 移动时的有效听觉半径（再乘隔墙系数）
  hearingMoveMult: number;       // 移动噪声倍率。停步通道不乘这个
  hearingStillRange: number;     // 停步听力半径。0 = 停步完全不听（渗透体）
  hearingWallFactor: number;
  visionWeight: number;          // 视觉填充乘数
  hearingWeight: number;         // 0 = 听觉不填充、只做二元点名（渗透体）
  hearingMaxPush: HearingMaxPush;
  patrolSpeed: number;
  chaseSpeed: number;
  suspiciousSpeed: number;
  alertSpeed: number;
  returnSpeed: number;
}

/** 运行时配置 = 剖面 + 共享的体型/转向（constants，非策划表） */
interface EnemyTypeConfig {
  role: EnemyRole;
  profile: PerceptionProfile;
  bodySize: number;              // AI_BODY_SIZE，两种相同；碰撞不进 CSV
}

/** 地图生成器必须提供 —— 本 spec 定义契约，system-map-generation 填值 */
interface EnemySpawnData {
  id: string;                    // 'ENM_INF_01' / 'ENM_RWR_01'，本趟唯一
  type: EnemyRole;               // CSV id。每趟恰好一个 'rewriter'
  spawn: TileCoord;
  facing: number;
  patrol: PatrolRouteData;
}

interface PatrolRouteData {
  waypoints: TileCoord[];        // ≥ 1 个；全部必须可通行
  mode: 'loop' | 'pingpong' | 'static';
  pauseMs?: number;              // 每个路点的停留时长，缺省用 AI_WAYPOINT_PAUSE_MS
  /** 停留时的扫视朝向序列（度）。缺省 = 保持到达时的朝向。static 模式强烈建议提供 */
  scanAngles?: number[];
}

/** 寻路网格契约：与 T1 的 OccluderGrid 并列，由地图侧同时提供 */
interface WalkGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** 该 tile 是否可通行。越界一律 false */
  isWalkable(col: number, row: number): boolean;
  readonly version: number;      // 数据变更计数，用于失效路径缓存
}
```

**`OccluderGrid` 与 `WalkGrid` 的关系**：Slice 1 中两者由同一份 tile 数据派生，且**墙体 = 既不可通行也不透视**。本 spec 不假设两者永远等价（后续可能出现"矮墙：可挡视线不挡路"或"深渊：可透视不可走"），所以接口分开。

---

## 规则

### P — 感知（Perception）

**P1｜感知节拍**：感知不是每帧算的。每个敌人以 `AI_PERCEPTION_TICK_MS`（100 ms，10 Hz）执行一次感知计算，多个敌人的 tick 相位**错开**（第 i 个敌人的初始相位 = `i × TICK / N`），避免所有敌人在同一帧一起做射线。计时与察觉度累积用真实经过的 dt，不受节拍影响。

**P2｜单次射线服务两个感官**：当 `d = |player - enemy| ≤ profile.sightRange` 时，投**一次** `hasLineOfSight(occluders, enemyPos, playerPos)`，结果同时用于视觉判定与听觉的隔墙衰减。`d > sightRange` 且 `d > 当前有效听觉半径` 时完全跳过射线。**每个敌人每个感知 tick 最多 1 次射线。**

**P3｜视线遮挡不重写**：视线一律走 `utils/grid-raycast.hasLineOfSight()`，包括「对角缝隙不可穿透」。**禁止在 AI 里另写任何遮挡判定。** 玩家和敌人被同一套规则约束。

**P4｜视觉分区**：以敌人朝向为轴，`θ` = 敌人朝向与「敌人→玩家」方向的夹角。角度与半径**读该敌人的剖面**，不是全局一份。

| 区 | 条件 | 渗透体现值 | 改写体现值 |
| -- | ---- | ---------- | ---------- |
| 核心锥 | `θ ≤ sightHalfAngleCore` 且 `d ≤ sightRange` | 55°（张角 110°）/ 180 px | **32°**（张角 64°）/ 180 px |
| 余光带 | `θ ≤ sightHalfAnglePeriph` 且 `d ≤ sightRangePeriph` | 90° / 90 px | 50° / 56 px |
| 盲区 | 其余 | 视觉不生效（听觉仍可能生效） | 同左；锥更窄所以盲区更大 |

**P5｜察觉度 · 视觉通道**：`detection ∈ [0,1]`。有视线且非盲区时：

```
rateVision = (1 / AI_DETECT_FILL_TIME) × distFactor × zoneFactor × profile.visionWeight
distFactor = lerp(1.6, 0.5, clamp01(d / profile.sightRange))
zoneFactor = 1.0（核心锥） | DETECT_ZONE_FACTOR_PERIPH（余光带，0.45）
```

渗透体 `visionWeight = 1.0`：贴身 ≈ 0.33 s 满格，与现行一致。改写体 `visionWeight = 0.45`：同一几何下视觉更慢，窄锥才是主差异，权重防止「擦到 32° 就和渗透体一样快锁」。

**P5b｜察觉度 · 听觉通道（剖面分流，不是第二份 FSM）**：

有效听觉半径：

```
baseRange = playerIsMoving ? profile.hearingRange : profile.hearingStillRange
有效半径 = baseRange × (有视线 ? 1.0 : profile.hearingWallFactor)
```

`hearingStillRange === 0`（渗透体）且未移动 → 本通道本 tick 为 0。

- **渗透体**（`hearingWeight = 0`）：听觉**不填充**察觉度。命中条件 = `playerIsMoving && d ≤ 有效半径`。命中则走 T0 优先级 5 的二元点名（最高 `hearingMaxPush = suspicious`），`investigatePos` 带 jitter。这是现行 P7，不改语义。
- **改写体**（`hearingWeight = 1.0`）：听觉**连续填充**：

```
loudness = playerIsMoving ? profile.hearingMoveMult : 1.0
rateHear = (1 / AI_HEAR_FILL_TIME) × distFactorHear × profile.hearingWeight × loudness
distFactorHear = lerp(1.6, 0.5, clamp01(d / 有效半径))
```

`AI_HEAR_FILL_TIME = 2.0 s`（共享常量，不进 CSV）。移动倍率 2.0 只乘改写体的移动通道。

停步：半径 ≤ 40；本通道把察觉度**封顶**在 `AI_HEARING_STILL_CAP = 0.20`（低于 `AI_SUSPICION_THRESHOLD` 0.35）。停步几乎听不见：不会只靠站着就把改写体推进警觉。

听觉给出的位置仍是**模糊的**（`AI_HEARING_JITTER` 32 px，一次警觉周期只采样一次）。听见 ≠ 精确定位。

**P5c｜通道合成**：

```
detection += (rateVision + rateHear) × dt
detection = clamp(detection, 0, 1)
```

无视觉增益的 tick 仍按 P6 衰减。停步封顶只约束「听觉通道在停步时能把 detection 顶到哪」：若视觉同时在填，视觉不受 0.20 封顶。

### 刺激权重表（现行数字）

| 刺激 | 渗透体 | 改写体 | 对 FSM 的最高推动 |
| ---- | ------ | ------ | ---------------- |
| 视觉核心锥 | 权重 1.0，半角 55°，半径 180 | 权重 0.45，半角 **32°**，半径 180 | 察觉度 ≥ 1.0 且有视线且非盲区 → **追击**（两种相同） |
| 视觉余光 | 区系数 0.45，半角 90°，半径 90 | 区系数 0.45 × 权重 0.45，半角 50°，半径 56 | 同上，更慢 |
| 移动听觉 | 不填充；半径 100；命中 = 警觉点名 | 填充；半径 **150**；`hearingMoveMult` **2.0** | 渗透体 → 仅 suspicious。改写体 → 可升到 **alert**（`hearingMaxPush`），**不能直接追击** |
| 停步听觉 | 半径 0，不命中 | 半径 **≤ 40**；不乘 2.0；察觉度封顶 0.20 | 几乎不进警觉 |
| `reportNoise` | 半径内升 suspicious 或 alert | 相同 | 与现行 P8 相同 |
| `reportDamage` | 立即追击，detection = 1.0 | 相同 | 被打了不需要确信 |

博弈：绕渗透体 = 看锥、等它走。过改写体 = 停步/隔墙，移动会把自己「写」进它的搜索。

**P6｜察觉度衰减**：无视觉增益且（改写体）无听觉增益的 tick 内 `detection -= AI_DETECT_DECAY_RATE × dt`。改写体若本 tick `rateHear > 0`，本 tick **不衰减**（它正在听）。ALERT 态下衰减速率减半。CHASE 态下**不衰减**（`losGraceMs` 接管）。

**P7｜听觉通则**（两种都遵守）：360°；穿墙但隔墙打折；位置 jitter；`playerIsMoving` 取 `Player.isMoving()`。半径不随速度连续变化——只有「移动 / 停步」二元，外加改写体的固定倍率 2.0。这不是潜行/疾跑双速。

**P8｜外部刺激**：两个推送入口，由**场景层**在收到对应事件后调用：

| 入口 | 触发源 | 效果 |
| ---- | ------ | ---- |
| `reportNoise(pos, radius, level)` | T4 战斗噪声（玩家挥击 / 命中 / 敌人死亡） | 半径内所有敌人升到 `level`（`'suspicious'` 或 `'alert'`），`investigatePos` / `lastSeenPlayerPos` = `pos`（同样施加 jitter）。不穿墙判定（噪声是全向的），但半径内需 `d ≤ radius` |
| `reportDamage(enemyId, sourcePos)` | T4 敌人被击中（`ENEMY_DAMAGED`） | 该敌人**立即** CHASE，`detection = 1.0`，`lastSeenPlayerPos = sourcePos`。被打了不需要"确信" |

**P9｜本 Slice 不做敌人间警报传播**：敌人各自独立感知，不会互相喊话。理由：固定地图空间小、敌人只有 3–5 个，链式警报极易演变成"全图围攻"这种不可恢复的失败态，而本 slice 要验证的是**决策**不是**逃生**。"一处开打惊动一片"的效果已经由 `reportNoise` 的半径提供，且它的范围是显式可调的。

### T — 状态转换（FSM）

**T0｜转换求值顺序**：每个感知 tick 结束后按下表**从上到下**求值，**命中一条即停止**（同一 tick 内最多发生一次状态转换）。这是消除歧义死角的关键：任何时刻的转换结果都是确定的。

| 优先级 | 条件 | 从任意态 → | 附带动作 |
| ------ | ---- | ---------- | -------- |
| 1 | `reportDamage` 本 tick 到达 | **CHASE** | `detection = 1.0`；重置 `losGraceMs` |
| 2 | `detection ≥ 1.0` 且有视线且非盲区 | **CHASE** | 记录 `lastSeenPlayerPos/Vel` |
| 3 | 当前是 ALERT 且 `detection ≥ AI_REACQUIRE_THRESHOLD`（0.5）且有视线**且非盲区** | **CHASE** | 重新锁定的阈值更低。「非盲区」：玩家绕到 ALERT 敌人背后不会因残留察觉度被无视线锁定 |
| 4 | `reportNoise(level='alert')` 命中 | **ALERT** | `searchTimerMs = 0`，搜索点以噪声位置重建 |
| 4b | 本 tick 听觉通道活跃，且 `profile.hearingMaxPush === 'alert'`，且 `detection ≥ AI_HEAR_ALERT_THRESHOLD`（0.70），且**无**可锁定视线 | 若当前为 PATROL/RETURN/SUSPICIOUS → **ALERT**；若已是 ALERT/CHASE → 不换态，重置搜索计时并刷新模糊 `investigatePos`（周期内仍只 jitter 一次） | 搜索点以模糊听点重建。**这不是追击**——改写体听见了并开始搜，锁定仍走优先级 2 |
| 5 | `detection ≥ AI_SUSPICION_THRESHOLD`（0.35）／渗透体听觉点名／`reportNoise(level='suspicious')` | 若当前为 PATROL/RETURN → **SUSPICIOUS**；若已是 SUSPICIOUS/ALERT/CHASE → **不换态，只重置该态计时器** | 设 `investigatePos` |
| 6 | 计时器/距离型降级（见下） | 见下 | — |
| 7 | 以上都不命中 | 保持当前态 | 计时器继续推进 |

**降级规则（优先级 6 的展开）**：

| 当前态 | 降级条件 | 目标态 | 附带动作 |
| ------ | -------- | ------ | -------- |
| CHASE | 连续无视线累计 ≥ `AI_LOS_GRACE_MS`（400 ms） | ALERT | 以 `lastSeenPlayerPos` 重建搜索点；`searchTimerMs = 0` |
| CHASE | `d > AI_CHASE_ABANDON_RANGE`（320 px）且无视线 | ALERT | 同上。防止跨半张图的无限追击 |
| CHASE | 玩家死亡（`onPlayerLost()`） | RETURN | 清空搜索点 |
| ALERT | `searchTimerMs ≥ LOST_PLAYER_DURATION`（5000 ms） | SUSPICIOUS | `suspicionTimerMs = 0`，`investigatePos = null`（原地警惕） |
| SUSPICIOUS | `suspicionTimerMs ≥ ALERT_DURATION`（3000 ms）且 `detection < AI_SUSPICION_THRESHOLD` | RETURN | 发 `ENEMY_LOST_PLAYER`，重置 `peakAlertLevelThisEpisode` |
| RETURN | 到达最近路点（距离 ≤ `AI_ARRIVE_EPSILON`） | PATROL | `patrolIndex` = 该路点 |
| RETURN | 寻路连续失败 ≥ `AI_PATH_FAIL_LIMIT`（3 次） | PATROL | 就地恢复巡逻，目标设为最近路点，下一周期重试 |
| PATROL | — | — | 无自发降级（已是最低态） |

**T-C1｜CHASE 的视线判定被放宽**：一旦锁定，敌人的「看得见」判定改为 **360°（不受视锥限制）+ 射程 `profile.chaseSightRange`（两种都是 210 px）**。210 仍满足 I2。

**T-C2｜完整降级链的总时长**：CHASE →(0.4 s)→ ALERT →(5 s)→ SUSPICIOUS →(3 s)→ RETURN →(走回路点)→ PATROL。从甩掉追兵到它彻底冷静下来约 **8.4 秒 + 归位时间**。两种剖面共用这条链。

**T-C3｜渗透体没有从 SUSPICIOUS 直接跳 ALERT 的「自然升级」路径**（仍只靠视觉确信升 CHASE，或 `reportNoise('alert')`）。**改写体例外仅限 T0-4b**：持续移动噪声把察觉度顶到 0.70 且尚未被看见 → ALERT。这是刺激路由，不是第二张状态表。禁止再加「改写体专用状态」。

### B — 行为（每个状态在做什么）

**B1｜PATROL**：沿 `patrol.waypoints` 依次移动，速度 `profile.patrolSpeed`。到达路点后停留 `pauseMs`；停留期间若定义了 `scanAngles`，按序每 `AI_SCAN_HOLD_MS`（600 ms）转向下一个角度（以 `AI_TURN_RATE` 转，不瞬转）。移动时朝向 = 移动方向。
- `mode: 'loop'` → 到末尾回到 0；`'pingpong'` → 到末尾反向；`'static'`（单路点）→ 永远停留在原地，只按 `scanAngles` 扫视，即"守卫"。
- **巡逻路径在场景 create 时全部预计算并缓存**（固定地图 + 固定路点 = 路径永不变化）。运行时 A\* 只服务 ALERT / CHASE / RETURN。这一条消掉了绝大部分寻路开销。

**B2｜SUSPICIOUS**：① 先**原地停下并转向** `investigatePos`（以 `AI_TURN_RATE` 转，不移动）。② 转到位后以 `profile.suspiciousSpeed` 走向疑点。③ 到达后原地扫视（左右各 ±45°，周期 1.5 s）直到计时结束。
- **"停下并转过来"是本系统最重要的可读信号**。它必须发生在 CHASE 之前，且必须持续足够长（≥ 0.2 s）让玩家看见。这是玩家唯一的预警。

**B3｜ALERT**：依次前往搜索点队列，速度 `profile.alertSpeed`，每点停留 `AI_SEARCH_HOLD_MS`（800 ms）扫视。搜索点构造（最多 3 个，预分配）：
1. `lastSeenPlayerPos`（最后见到的地方）
2. **外推点** = `lastSeenPlayerPos + lastSeenPlayerVel × AI_EXTRAPOLATE_SEC`（0.6 s），若不可通行则取最近的可通行 tile。这一条让"直线逃跑"不安全——它会往你跑的方向找。
3. `lastSeenPlayerPos` 周围半径 `AI_SEARCH_SPREAD`（96 px）内的一个随机可通行 tile
- 队列走完但 `searchTimerMs` 未到 → 在当前位置扫视直到超时。

**B4｜CHASE**：目标 = 有视线时的玩家实时位置，无视线时（`losGraceMs` 宽限期内）= `lastSeenPlayerPos`。速度 `profile.chaseSpeed`。
- **接敌子行为**：当 `d ≤ AI_STANDOFF_DISTANCE`（30 px）时停止推进，`engaged = true`，原地保持面向玩家并把距离维持在 26–34 px（超出则微调）。**出手与否交给 `system-combat`。**
- `d > 34 px` 时 `engaged = false`，恢复推进。

**B5｜RETURN**：以 `profile.returnSpeed` 走向**直线距离最近的路点**，到达即转 PATROL。RETURN 在玩家眼里应当读作巡逻（本体不显示警戒指示物，屏缘对该敌人熄灭），但速度略快。

**B6｜移动与碰撞**：
- 敌人 vs 墙：Arcade `collide`，碰撞体 `AI_BODY_SIZE`（20 px，与玩家同）。
- 敌人 vs 玩家：**`overlap`，不产生物理位移**。敌人不推玩家（会把玩家顶进墙角，且与 T4 的接触伤害判定冲突）。
- 敌人 vs 敌人：**不做物理碰撞**（走廊里会互相堵死并抖动）。改为软排斥：两敌人距离 < `AI_SEPARATION_RADIUS`（24 px）时，各自的移动方向叠加一个远离对方的分量（权重 0.35）。3–5 个敌人的开销可忽略。
- 转向：`AI_TURN_RATE`（360 °/s），走最短弧。朝向决定感知锥，所以**转向速度就是"能不能绕到它背后"的可玩性参数**（不变量 I6）。

### N — 寻路（Pathfinding）

**N1｜算法**：自实现 grid A\*（DEC-ARCH-002），8 邻接，octile 启发式。直线代价 1，对角代价 √2。

**N2｜不许切角（与视线规则对齐）**：对角移动仅当**两个正交邻居都可通行**时才合法。这与 T1 视线规则 14「对角缝隙不可穿透」是同一条几何纪律——敌人不能走玩家看不到的缝，也不能从玩家认为封死的角上钻过来。

**N3｜分帧调度**（架构性能规则：每帧最多 1 次 A\*）：
- 全局单一请求队列，**每帧最多出队并执行 1 次 A\***。
- 优先级：`CHASE > ALERT > SUSPICIOUS > RETURN`。同优先级按请求时间先后。
- 同一敌人的重规划最小间隔 `AI_REPATH_INTERVAL_MS`（500 ms）。CHASE 态下若目标移动超过 `AI_REPATH_MOVE_THRESHOLD`（48 px）则允许提前重规划（仍受队列限制）。
- **等待期间不停摆**：敌人继续跟随旧路径；若无旧路径，则朝目标做直线转向 + 依赖 Arcade 的沿墙滑动（简化 steering fallback）。绝不允许出现"站着等路径"。

**N4｜直线优先（最有效的简化寻路）**：发起 A\* 之前先测 `hasLineOfSight(occluders, enemyPos, target)`。为真则**跳过 A\***，直接 steering 朝目标走。CHASE 态下这条在多数时间成立（能看见你通常就意味着直线可达），实际把追击期间的 A\* 调用压到接近零。
> 注意：视线畅通 ≠ 20 px 宽的身体能通过。`AI_BODY_SIZE`(20) < `TILE_SIZE`(32) 且 N2 已禁止切角，斜穿窄缝的风险可接受；若实测出现卡墙，退化方案是把这条优化限制在 `d ≤ 3 tile` 内。

**N5｜远距离降级**：目标距离 > `AI_SIMPLE_PATH_RANGE`（384 px = 12 tile）的请求降为最低优先级，且该敌人的重规划间隔放宽到 1000 ms。由于 CHASE 有 320 px 的放弃距离，长距离请求只可能来自 RETURN——它不急。

**N6｜搜索上限与失败处理**：`AI_ASTAR_MAX_NODES`（3000，DEC-022 ①）个节点内未找到即判失败。失败处理：
- CHASE 目标不可达（玩家站在敌人到不了的地方）→ 立即转 ALERT，正常走 5 s 搜索后降级。**不允许**敌人在障碍前无限抖动。
- ALERT 目标搜索点不可达 → 跳到搜索点队列的下一个；队列走完仍未到即在当前位置扫视至超时。（DEC-022 ③ 补：原 spec 未定义 ALERT 失败）
- SUSPICIOUS 疑点不可达 → 清空 `investigatePos`，转为原地扫视直到计时结束。（DEC-022 ③ 补：原 spec 未定义 SUSPICIOUS 失败）
- RETURN 失败 3 次 → 就地转 PATROL（见降级表）。
- 记录一次开发模式告警（地图数据问题的早期信号）。

**N7｜路径平滑**：A\* 返回的 tile 路径做一次 string-pulling——用 `hasLineOfSight` 逐点尝试跳过中间点，保留最少的拐点。目的是消除网格锯齿走位，让敌人的移动读起来像"生物"而不是"棋子"。

**N8｜远处敌人降频**：距玩家 > `AI_ACTIVE_RANGE`（640 px）的敌人，FSM 与感知降到 5 Hz。**巡逻态**走预计算路径、不发起任何 A\*；但**远处 RETURN 态**仍可发起 A\*（否则会永久贴墙走不回路点），只是降到队列最低优先级，永不延误近处追击（DEC-022 ⑤，修正原 spec 括号"都在巡逻"的隐含假设）。玩家看不到也听不到的地方，AI 的精度没有观察者。

### R — 状态可读性（占位期即必须成立，A-G2 验证项）

**R0｜为什么这条是规则而不是美术建议**：如果玩家读不出敌人的状态，整个系统对玩家而言就是随机的——"绕行 vs 冒险"的决策无从做起，本 Slice 的验证问题会得到一个假的否定答案。**可读性是玩法需求，不是表现层装饰。**

**R1｜第一可读信号永远是行为本身**，不是特效。玩家应当在不看任何指示物的情况下，只凭移动就能猜出状态：

| 状态 | 行为特征（玩家看到的） | 应当读出 |
| ---- | ---------------------- | -------- |
| PATROL | 匀速慢走，沿固定路线，路点处停下扫视 | 它没注意到我 |
| SUSPICIOUS | **停下 → 转过来 → 很慢地走过来** | 它好像察觉到什么了（**这是撤退窗口**） |
| ALERT | 中速，在一个区域来回移动、走走停停 | 它在找我，但不知道我在哪 |
| CHASE | 全速直线朝我，不停顿 | 它看见我了 |
| RETURN | 中速，背对我往回走 | 我暂时安全了 |

**R2｜占位期的状态指示物**（art §12 占位阶段）。渗透体占位 = **暗红 `#cc4444` 的五边形**，一端为尖角指向 `facingAngle`（朝向必须在占位期就能读——不能用圆形）。状态**不改本体颜色**（`#cc4444` 在 art §12 中编码的是"低度敌人"这一**等级**，后续还有中度 `#ee5555`/高度 `#ff6666`，借用会造成语义冲突），改为在本体上方叠加 teal（`#2ae6c8`，污染侧色，与暗红高对比且符合 §13.1 色温纪律）指示物：

| 状态 | 指示物 | 动效 |
| ---- | ------ | ---- |
| PATROL / RETURN | 无 | — |
| SUSPICIOUS | 1 个 4×4 px teal 方点 | 1.5 Hz 呼吸（alpha 0.5 ↔ 1.0） |
| ALERT | 2 个 4×4 px teal 方点 | 3 Hz 闪烁（**闪 = 它在找**） |
| CHASE | 1 个 8×6 px teal 实心三角 | **常亮不闪**（**不闪且亮 = 它锁定了你**）+ 每 100 ms 留一个 alpha 0.3、存活 300 ms 的残影 |

"闪烁 = 搜索 / 常亮 = 锁定"这组对立比"更亮 = 更危险"更容易被瞬间读出，也不依赖玩家记住颜色梯度。

**R3｜察觉度的过程可见**：SUSPICIOUS 期间，teal 方点的呼吸频率随 `detection` 从 1.5 Hz 线性升到 3 Hz。玩家能看出"它越来越确定了"，从而判断还有没有时间缩回去。这是 P5 那个 0.2–0.6 秒窗口的**外化**——没有这个外化，窗口存在但玩家用不上。

**R4｜敌人不注册为 glow source**：敌人在玩家视野外时**完全不渲染**（含指示物）。`getVisibilityAt(enemyPos)` 返回 0 就不画。理由：让"敌人在哪"始终是需要付出观察成本才能获得的信息，否则潜行博弈退化成看小地图。副作用：被追击时玩家跑在前面，回头才能看到追兵——这是有意的恐怖体验（见 escalate ③）。

**R5｜感知锥默认不可视**：不向玩家绘制敌人视锥。默认关闭 `DEBUG_SHOW_VISION_CONE`（QA / A-G2 期间打开）。理由：画出视锥会把潜行从"读行为、赌判断"变成"看几何、解谜题"，与 vision.md「核心决策是还敢不敢再多拿一点」的赌博定位不符。
> 若试玩证明玩家无法预判敌人视野从而产生挫败，**备选方案**（不是默认方案）：给敌人加一块极低 alpha（≤ 0.06）的 teal 地面光斑表示其感知区。它有叙事合理性——渗透体的感知区在地面留下渲染残留（art §5.2「渲染崩坏」母题）。这条列为待验证假设，不在 T7 首版实现。

**R6｜正式资产期的继承**：换成正式 sprite 后，状态区分仍**必须由动效与行为承载**，不得依赖颜色（art §13.2：渗透体基体色与地面对比度低是设计意图）。指示物可替换为 art §5.2 的"感知区亮点"，但"闪 = 搜索 / 常亮 = 锁定"的语义必须保留。

**R7｜音频钩子**：每次状态转换向场景层提供一个 cue id（`ai.cue.suspicious` / `ai.cue.alert` / `ai.cue.chase` / `ai.cue.lost`）。**本 spec 不设计音频内容**（归 audio-direction；Slice 9）。由于 R4，被追击时的听觉可能是玩家唯一的追兵信息源——Slice 8 的屏缘干涉是视觉补通道，不替代 `ai.cue.chase`。

**R8｜屏缘被发现指示（结构；视觉在 `ui-detection-pulse`）**：`getDetection()` **改为玩法输入**（不再「仅 debug」）。裂隙 HUD 屏缘干涉：方位指向该威胁，强度 = 察觉度 0–1；警戒更密更亮更快，追击为锁定态。最多 2 个方位。无数字、无「察觉 73%」。挂 `#dom-ui-root`。禁止 Phaser 角锚。本 spec 只保证数据；形态与避让贴顶 HUD / 圆窗由 UI spec 写死。

本体上方的 teal 指示物（R2）仍保留：近处读行为 + 头上点；远处/视野外读屏缘。两种编码不互相替代。

---

## 玩家交互

- **输入**：玩家不直接操作敌人。玩家能施加的影响只有四种，全部是间接的：

| 玩家做什么 | 系统响应 |
| ---------- | -------- |
| 走进视锥且无遮挡 | `detection` 按该剖面 `visionWeight` 累积；越近越快。改写体锥更窄，绕侧更容易 |
| 在渗透体听觉半径内移动（100 px，隔墙 60） | 渗透体升到 SUSPICIOUS，去查看一个**模糊**位置 |
| 在改写体移动听觉半径内移动（150 px，隔墙 90） | 察觉度按听觉通道填；持续移动可把它推到警戒并搜索听点。屏缘在该方向亮起 |
| 停止移动 | 渗透体：听觉不命中。改写体：听觉半径降到 ≤40 且察觉度被听觉封顶 0.20——**停步几乎听不见**。视觉不受影响：它正看着你时站着救不了 |
| 攻击 / 被攻击 | 噪声半径内升级；被打中的立即 CHASE |

- **反馈**：见"状态可读性"R1–R3。核心承诺是：**玩家每次被发现，都应当能回溯出是哪一步操作导致的。** 任何"不知道为什么被发现"的实例都是 bug 或调参失败，不是难度。

---

## 数值结构（可调参数表）

> **权威分流**：按敌人变化的策划字段 → `data/enemies.csv`（构建期 codegen）。FSM 共享量（阈值、计时器、寻路、转向、体型）→ `GAME_CONSTANTS.AI`。禁止在系统内存第二份渗透体数字。
>
> 渗透体现值从现行 `constants.ts` **迁出**到 CSV，不借机改手感（速度仍是 30/65，视距仍是 180/55°）。改写体按下表现行锁死（DEC-064 落地，不再问人）。

### 感知剖面（`data/enemies.csv`）

| 列（CSV snake_case） | 渗透体 | 改写体 | 调节目的 |
| ---- | ------ | ------ | -------- |
| `id` | `infiltrator` | `rewriter` | codegen 键；`EnemySpawnData.type` |
| `display_name` | 渗透体 | 改写体 | world.md 术语。屏缘无字 |
| `role` | `infiltrator` | `rewriter` | 与 id 相同；校验用 |
| `sight_range` | 180 | 180 | 必须 < 224（I1）。差异在半角不在半径 |
| `sight_half_angle_core` | 55 | **32** | 改写体张角 64°，绕锥更容易 |
| `sight_range_periph` | 90 | 56 | 改写体几乎没有便宜的侧面余光带 |
| `sight_half_angle_periph` | 90 | 50 | 正后方仍是盲区 |
| `chase_sight_range` | 210 | 210 | 必须 < 224（I2） |
| `hearing_range` | 100 | **150** | 改写体移动听觉主半径 |
| `hearing_move_mult` | 1.0 | **2.0** | 只乘改写体移动填充。渗透体听觉不填充 |
| `hearing_still_range` | 0 | **40** | ≤40。0 = 停步完全不听 |
| `hearing_wall_factor` | 0.6 | 0.6 | 隔墙打折。改写体移动隔墙 → 90 px |
| `vision_weight` | 1.0 | 0.45 | 改写体看见了也填得慢 |
| `hearing_weight` | 0 | 1.0 | 0 = 二元点名（渗透体） |
| `hearing_max_push` | `suspicious` | `alert` | 听觉能否推进警戒 |
| `patrol_speed` | 30 | 30 | I4 |
| `chase_speed` | 65 | 65 | I3。本 Slice 不靠改写体跑得更快制造差异 |
| `suspicious_speed` | 22 | 22 | |
| `alert_speed` | 45 | 45 | |
| `return_speed` | 38 | 38 | |

改写体移动听觉参考耗时（`AI_HEAR_FILL_TIME` 2.0 s × 倍率 2.0 → 中距约 1.0 察觉度/秒）：中距到警觉阈 0.35 ≈ 0.35 s，到听觉警戒阈 0.70 ≈ 0.70 s。贴身更快，视距边缘约一半。

### 共享（留在 `GAME_CONSTANTS.AI`，不进 CSV）

移动与体型：`TURN_RATE` 360、`BODY_SIZE` 20、排斥/接敌带——两种共用。

感知共享：

| 参数 | 初值 | 说明 |
| ---- | ---- | ---- |
| `DETECT_FILL_TIME` | 0.45 s | 视觉满格基准；再乘 `vision_weight` |
| `HEAR_FILL_TIME` | **2.0 s** | 新增。听觉连续填充基准；再乘 `hearing_weight` 与移动倍率 |
| `HEARING_STILL_CAP` | **0.20** | 新增。停步听觉把 detection 封顶于此 |
| `HEAR_ALERT_THRESHOLD` | **0.70** | 新增。改写体 T0-4b |
| `SUSPICION_THRESHOLD` | 0.35 | |
| `REACQUIRE_THRESHOLD` | 0.50 | |
| `DETECT_DECAY_RATE` | 0.67 /s | |
| `HEARING_JITTER` | 32 px | |
| `PERCEPTION_TICK_MS` | 100 | |

从 `AI` 段**删迁**（实现时）：`SIGHT_RANGE` / `SIGHT_HALF_ANGLE_*` / `SIGHT_RANGE_PERIPH` / `CHASE_SIGHT_RANGE` / `HEARING_RANGE` / `HEARING_WALL_FACTOR` / `PATROL_SPEED` / `CHASE_SPEED` / `SUSPICIOUS_SPEED` / `ALERT_SPEED` / `RETURN_SPEED`。代码读 CSV 行。不变量测试改读剖面。

计时器、寻路、占位指示物参数维持现行 `constants.ts`（`LOS_GRACE_MS` 400、`LOST_PLAYER_DURATION` 5000、`ALERT_DURATION` 3000、`CHASE_ABANDON_RANGE` 320 等）。不在本 Slice 重调。

### 占位期 / 正式期表现

| 参数 | 初值 | 说明 |
| ---- | ---- | ---- |
| 渗透体本体 | 现行暗红 + 正式 4 向 | 等级色不编码状态 |
| 改写体本体 | Art A1：不对称、teal 成簇、俯视 4 向；不要紫粉史莱姆 | `VERDICT.md` |
| 头上指示物 | 与 R2 相同语义（闪=搜索 / 常亮=锁定） | 两种共用 |
| 屏缘干涉 | 见 `ui-detection-pulse` | 无数字 |

### 计时器

| 参数 | 含义 | 初值 | 合理范围 | 对博弈手感的影响 | 状态 |
| ---- | ---- | ---- | -------- | ---------------- | ---- |
| `AI_LOS_GRACE_MS` | CHASE 容忍无视线的时长 | 400 ms | 200–800 | 太短则绕个柱子就甩掉，追击毫无压力；太长则"它能透视" | 建议值 |
| `LOST_PLAYER_DURATION` | ALERT 搜索时长 | 5000 ms | 3000–8000 | 被发现一次的**主要代价**。这段时间玩家的路线被封、混乱值在涨 | 既有constants |
| `ALERT_DURATION` | SUSPICIOUS 无刺激保持时长 | 3000 ms | 2000–5000 | 降级链的最后一段"余温"，让敌人不显得健忘 | 既有constants |
| `AI_CHASE_ABANDON_RANGE` | 放弃直追的距离 | 320 px（10 tile） | 240–480 | 与 I3 配合定义"跑多远能脱身"。太小则追击没威胁，太大则一次失误毁掉整局 | 建议值 |
| `AI_WAYPOINT_PAUSE_MS` | 路点停留 | 1200 ms | 600–2500 | 停留创造玩家的通过窗口。太短则巡逻像列车时刻表，太长则等待枯燥 | 建议值 |
| `AI_SCAN_HOLD_MS` | 扫视每个角度的保持时长 | 600 ms | 400–1200 | 决定守卫型敌人的"可预测性"——玩家要能数着节拍通过 | 建议值 |
| `AI_SEARCH_HOLD_MS` | ALERT 每个搜索点停留 | 800 ms | 500–1500 | 影响 5 s 内能搜几个点 | 建议值 |
| `AI_EXTRAPOLATE_SEC` | 逃跑方向外推时长 | 0.6 s | 0.3–1.2 | 让直线逃跑不安全。太大则搜索点会飞出可达区域 | 建议值 |
| `AI_SEARCH_SPREAD` | 随机搜索点散布半径 | 96 px（3 tile） | 64–160 | 太小则搜索看起来是原地打转 | 建议值 |
| `AI_ALERT_EMIT_COOLDOWN_MS` | 同级 `ENEMY_ALERT` 抑制间隔 | 1000 ms | 500–2000 | 防止状态抖动造成混乱值被反复扣（见事件契约 E1） | 技术定 |

### 寻路与性能

| 参数 | 含义 | 初值 | 说明 | 状态 |
| ---- | ---- | ---- | ---- | ---- |
| `AI_MAX_PATHS_PER_FRAME` | 每帧 A\* 上限 | 1 | architecture 性能规则硬性要求 | 架构定 |
| `AI_REPATH_INTERVAL_MS` | 同一敌人重规划最小间隔 | 500 ms | 500–1200 | 建议值 |
| `AI_REPATH_MOVE_THRESHOLD` | CHASE 提前重规划的目标位移阈值 | 48 px | 32–96 | 建议值 |
| `AI_SIMPLE_PATH_RANGE` | 降级为低优先级的距离 | 384 px（12 tile） | 见 N5 | 技术定 |
| `AI_ASTAR_MAX_NODES` | 单次 A\* 节点上限 | 3000（原 1200，DEC-022 ①） | 真实约束是 < 5 ms/次（architecture 性能预算）而非节点数；实测跨图最坏 1050 节点仅 0.31 ms，抬到 3000 仍远低于预算，同时给 RETURN 跨图路径留出余量 | 架构定 |
| `AI_PATH_FAIL_LIMIT` | 连续失败上限 | 3 | 超出即放弃并降级 | 技术定 |
| `AI_ACTIVE_RANGE` | 全速 AI 的作用半径 | 640 px（20 tile） | 超出降到 5 Hz 且不寻路 | 技术定 |
| `AI_ARRIVE_EPSILON` | 到达判定距离 | 8 px | 小于此距离视为到达路径点 | 技术定 |
| `MAX_ACTIVE_ENEMIES` | 同屏敌人上限 | 8（Slice 1 实际 3–5） | 超出则地图数据有问题，开发模式告警 | 技术定 |
| `AI_DT_CLAMP_MS` | 单帧 dt 钳制上限 | 100 ms | 防止切标签页回来后敌人瞬移 | 技术定 |

指示物色与频率仍以现行 `constants.ts` 占位段为准（teal `#2ae6c8`；呼吸 1.5–3 Hz；警戒闪 3 Hz）。改写体本体不借用渗透体暗红当等级色——正式贴图走 Art A1。

---

## Schema（对外接口契约）

```typescript
interface EnemyView {
  getId(): string;
  getRole(): EnemyRole;
  getPosition(): Readonly<Vector2>;
  getFacingAngle(): number;
  getFacing4(): Facing4;
  getState(): AIState;
  isEngaged(): boolean;
  /** 0..1。玩法输入：屏缘干涉强度。debug overlay 也可读 */
  getDetection(): number;
}
```

`AISystemAPI` 不变（`create` 仍吃 `EnemySpawnData[]`；每条 spawn 的 `type` 必须是 CSV `id`）。`findPath` 不变。

**CSV 行 → codegen**（`data/enemies.csv` → `src/generated/enemy-data.ts`，由 code 接 `tools/csv-codegen`）：字段即上表 snake_case 列。两种角色必须都在表里。缺行或 `role` ≠ `id` = 构建失败。

### 生成器契约（每张裂隙恰好 1 个改写体）

由 `system-map-generation` 执行，本 spec 拥有语义：

1. `enemySpawns.length` ∈ {3, 4}（沿用巡逻数量）。
2. 其中 **`type === 'rewriter'` 的条目数恰好为 1**，其余 `'infiltrator'`。0 个或 ≥2 个 = 坏图，重试，禁止用「全换成渗透体」糊过去。
3. 规则 19 的撤离最后一道关必须是渗透体。改写体不站撤离门。
4. 改写体优先落在 contested/deep 薪柴附近或侧路，让第二条判断出现在贪婪路线上。
5. 改写体 id 建议 `ENM_RWR_01`；渗透体保持 `ENM_INF_*`。
6. 路点可走、从出生可达——与现行连通 FATAL 相同。

### 事件契约

本 spec **不新增任何事件**，只使用 `src/types/events.ts` 中已有的两个：

**E1｜`ENEMY_ALERT` — 在"升级"时发出**
`{ enemyId, alertLevel: 'suspicious' | 'alert' | 'chase' }`
- 发出时机：FSM 发生**等级提高**的转换时（none→suspicious、suspicious→chase、alert→chase 等，包括跨级跳跃）。
- **降级不发**（chase→alert 不会发 `alertLevel: 'alert'`）。
- 同一敌人、同一 `alertLevel` 的重复发出，间隔 < `AI_ALERT_EMIT_COOLDOWN_MS`（1000 ms）时**抑制**。这防止状态在阈值边缘抖动导致混乱值被反复扣。
- 消费方：T3 混乱值（经场景层）、HUD、音频。

**E2｜`ENEMY_LOST_PLAYER` — 在"警戒周期结束"时发出**
`{ enemyId }`
- 发出时机：敌人从任意警戒态（suspicious/alert/chase）降级到 RETURN 时，**每个警戒周期恰好发一次**。中间降级（chase→alert→suspicious）不发。
- `despawn()` 时若敌人处于警戒态，**补发一次**——否则消费方会永远停留在"有人在追我"的状态。
- 消费方：T3（停止追击导致的混乱值加速）、HUD、音频。

**这两条合起来给了消费方一个完整且无歧义的图景**：每个警戒周期内，`ENEMY_ALERT` 最多按 suspicious → alert → chase 的顺序各触发若干次（受冷却抑制），周期结束时必有且仅有一次 `ENEMY_LOST_PLAYER`。消费方可以据此维护"当前有几个敌人在警戒"的计数而不会泄漏。

**给 T3 的建议权重**（T3 拥有最终解释权）：`suspicious` 不加混乱值（否则贴墙走路会被持续惩罚，玩家学不到因果）；`alert` 与 `chase` 才计入，其中 `chase` 应对应现有的 `CHAOS.DETECTION_BONUS`(3)。

---

## 边界情况

| 情况 | 处理方式 |
| ---- | -------- |
| 玩家站在敌人 A\* 到不了的位置（地图数据缺陷 / 卡墙） | CHASE 的 A\* 失败 → 立即转 ALERT，5 s 后正常降级。**禁止**在障碍前无限抖动或原地卡住 |
| 路点不可通行 / 相邻路点间无路径 | 场景 create 时校验；失败则该敌人退化为 `mode: 'static'` 并打印一次开发告警。**不崩溃、不静默** |
| 敌人出生点重叠 / 被卡进墙 | 出生时校验 tile 可通行；不可通行则搜索最近的可通行 tile 并告警 |
| 玩家死亡（`PLAYER_DIED`） | 场景层调用 `onPlayerLost()` → 全体 RETURN，处于警戒态的敌人各补发一次 `ENEMY_LOST_PLAYER` |
| 敌人死亡（T4 判定） | 场景层调用 `despawn(id)` → 取消其排队中的 A\* 请求、清理残影对象池、按 E2 补发事件 |
| 玩家已撤离（`RIFT_EXIT_REACHED`） | 同 `onPlayerLost()`；场景随后 shutdown |
| `detection` 恰好卡在阈值上反复抖动 | 由 E1 的发射冷却吸收；且 SUSPICIOUS 的 3000 ms 计时器保证状态本身不会高频翻转 |
| 玩家在视锥内但站在敌人正上方（d ≈ 0） | `θ` 无定义 → `d < AI_ARRIVE_EPSILON` 时直接判为核心锥命中 |
| 玩家隔一堵墙贴着渗透体站定不动 | 听觉不命中、视觉被遮挡 → 无反应。静止 + 掩体 = 对渗透体的暂停键 |
| 玩家隔一堵墙贴着改写体站定不动 | 停步半径 ≤40 × 隔墙 0.6 ≈ 24 px。再远则听不见；在 24 px 内察觉度被听觉封顶 0.20，仍不进警觉。开始走动则 150 px 通道打开 |
| 一趟生成 0 个或 2 个改写体 | 坏图。生成器重试。AI 系统若收到非法 spawn 表：开发期大声失败，不默默全当渗透体 |
| 切标签页后回来（dt 巨大） | dt 钳制到 `AI_DT_CLAMP_MS`(100 ms)，防止敌人瞬移穿墙 |
| 多个敌人同时请求 A\* | 队列按 N3 优先级排序，每帧 1 次；CHASE 永远优先，最坏情况下 RETURN 的敌人多等几帧（无可感知影响） |
| 敌人在玩家视野外 | 逻辑照常运行（它照样能发现你），只是不渲染（R4） |
| 混乱值很高时 | **敌人行为完全不受混乱值影响**。压力曲线只从玩家一侧收紧（视野缩小 / 移速降低），敌人不同步变强——否则难度曲线两头加码，会在阈值处断崖 |
| 场景 shutdown | `destroy()` 清空请求队列、残影对象池、事件监听、预计算路径缓存（架构风险表：Phaser 场景切换内存泄漏） |

---

## 与已有系统的接口

### 从其他系统接收

| 来源 | 接收什么 | 形式 |
| ---- | -------- | ---- |
| `utils/grid-raycast`（T1 拥有） | `hasLineOfSight(grid, a, b)` —— **唯一**的视线遮挡判定 | import 纯函数 |
| `Player`（T1） | `getPosition()`、`isMoving()` | 场景层每帧传入 `update()` 参数 |
| TilemapRenderer / `system-map-generation` | `OccluderGrid`、`WalkGrid`、`EnemySpawnData[]`（含恰好 1 个 `type: 'rewriter'`） | 场景 create 时注入 |
| `data/enemies.csv`（codegen） | `PerceptionProfile` 两行 | 构建期 |
| `system-combat`（T4，经场景层） | `reportDamage(enemyId, sourcePos)`（监听 `ENEMY_DAMAGED`）、`reportNoise(...)`（玩家挥击/命中）、`despawn(id)`（监听 `ENEMY_KILLED`） | 场景层转发 |
| 场景层 | `onPlayerLost()`（监听 `PLAYER_DIED` / `RIFT_EXIT_REACHED`） | 直接调用 |

### 向其他系统提供

| 消费方 | 提供什么 | 形式 |
| ------ | -------- | ---- |
| 渲染层 | `EnemyView`（位置 / 朝向 / 状态），配合 `VisibilitySystem.getVisibilityAt(enemyPos)` 决定是否绘制及 alpha | 同步查询 |
| `system-chaos-scavenge-extract`（T3，经场景层） | `ENEMY_ALERT` / `ENEMY_LOST_PLAYER` 事件 | 事件总线 |
| `system-combat`（T4） | `isEngaged()`（是否已站定可出手）、`getPosition()` / `getFacingAngle()`（攻击判定的原点与方向）、`getEnemies()`（玩家挥击的命中枚举） | 同步查询 |
| `ui-detection-pulse`（经场景层） | 每帧 `getEnemies()`：`getDetection` / `getState` / `getPosition` / `getRole`。不新增事件 | 同步查询 |
| `system-map-generation` | `EnemySpawnData` + 本 spec「生成器契约」 | 数据契约 |
| HUD / 音频 | 同 T3 的两个事件 + R7 的 cue id。屏缘不走事件 | 事件 / 查询 |

### 为什么用这种耦合方式

遵循 T1 已确立、Director 已确认的模式（`system-movement-vision` 的"为什么不用事件总线"一节）：

1. **AI 不 import VisibilitySystem**。共享的射线能力已下沉为无状态纯函数 `utils/grid-raycast`，任何系统可用，不构成系统间耦合。
2. **AI 不 import CombatSystem，CombatSystem 也不 import AI**。两者的交互全部经场景层：战斗事件 → 场景层 → `reportDamage()` / `reportNoise()`；AI 状态 → 场景层查询 → 喂给战斗判定。
3. **AI 每帧位置不进事件总线**。位置是每帧连续量，走事件会制造每帧数十次 emit。对外一律同步查询。
4. **Pathfinding 是共享服务模块**，与 `grid-raycast` 同级。本 spec 只规定网格规则（N1/N2）与调度策略（N3）。
5. **屏缘干涉不走事件总线。** 察觉度是每帧连续量，与位置相同，同步查询。
6. **禁止** `AISystemRewriter.ts` 或复制 `state-machine.ts` 只改常量。剖面是数据，FSM 是一份代码。

---

## 对已有系统的影响

| 对象 | 影响 |
| ---- | ---- |
| `data/enemies.csv` + codegen | **本 Slice 新增**。渗透体策划字段从 `GAME_CONSTANTS.AI` 迁出 |
| `src/config/constants.ts` 的 `AI` 段 | 删除已迁出的视距/半角/听觉半径/五种速度。新增 `HEAR_FILL_TIME` / `HEARING_STILL_CAP` / `HEAR_ALERT_THRESHOLD`。`TURN_RATE`、计时器、寻路键保留。由 code 执行 |
| `EnemyView` / `InfiltratorConfig` | 泛化为 `getRole()` + `PerceptionProfile`。禁止第二份 FSM 文件 |
| `EnemySpawnData.type` | 从字面量 `'infiltrator'` 扩为 `EnemyRole` |
| `src/types/events.ts` | **无变更** |
| `system-map-generation` | 规则 22：恰好 1 改写体 |
| `ui-detection-pulse` | 新表面。本 spec 提供察觉度/状态/位置 |
| `system-combat` | 本 Slice **不**改 HP/伤害。改写体沿用渗透体战斗切面 |
| `system-movement-vision` | 不变量按剖面断言视距 < 224 |
| `system-chaos-scavenge-extract` | HUD 清单补屏缘干涉；混乱值事件语义不改。改写体听觉进 alert 仍发 `ENEMY_ALERT` `alert` |
| `architecture.md` | code 登记两种角色与 CSV。本 spec 不改 architecture |

---

## 验证标准

**本 Slice 结束时能验证：**

- 同一张裂隙里，玩家不看文档也能感到两条潜行判断：绕渗透体视锥 vs 对改写体停步/贴墙消声。
- 被发现有方向、没有数字条：屏缘脉冲指向威胁，强度跟察觉度，警戒/追击形态变。
- 玩家视距/移速优势仍在（I1–I6）。
- 没有第二份 FSM 实现。

**预期正面结果：**

- 玩家会在改写体附近停步，在渗透体附近看锥。
- 改写体在视野外因走动被推到警戒时，屏缘先亮，玩家能回溯「我在移动」。
- 停在改写体隔墙外不动，它不进警觉。
- 撤退仍跑得过（65 < 80）。

**如果不 work 的信号：**

| 现象 | 指向的问题 |
| ---- | ---------- |
| 两种敌人打起来一样 | 剖面没接上，或只换了贴图 |
| 停步仍被改写体搜到 | 停步半径/封顶没生效，或视觉余光过宽 |
| 走动立刻被锁定追击 | 听觉直接 CHASE，违反 T0-4b |
| 「察觉 73%」或雷达点 | UI 规格被违反 |
| 一趟没有改写体 / 撤离门是改写体 | 生成器契约未落地 |
| 复制了 `state-machine-rewriter.ts` | 架构违规 |

---

## 待验证假设

- [ ] 改写体中距约 0.35 s 到警觉、0.70 s 到听觉警戒：窗口够用，不像瞬抓。
- [ ] 32° 半角 + 听觉 150 能读成「另一种敌人」，而不是「坏掉的渗透体」。
- [ ] 停步封顶 0.20 读作「几乎听不见」。
- [ ] 屏缘最多 2 方位足够。
- [ ] 改写体沿用渗透体 75 HP 三刀不破坏「战斗是止损」。若打起来反而更便宜，回 combat，本 Slice 不先改。

Slice 1 的 escalate（听觉是否看 `isMoving`、接敌分工、R4、事件降级、suspicious 不计混乱值）**已关闭**，本 Slice 不重开、不问人。覆盖体不做。
