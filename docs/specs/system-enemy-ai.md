---
status: ACTIVE
created-by: design agent
created-date: 2026-07-26
last-modified-by: director agent (T7 escalate resolution, DEC-022)
last-modified-date: 2026-08-01
interface-changed: false
slice: 1
interfaces-with:
  - system-movement-vision         # T1：复用 utils/grid-raycast 做视线遮挡；敌人渲染可见性由 VisibilitySystem 决定；平衡不变量来源
  - system-chaos-scavenge-extract  # T3：ENEMY_ALERT 经场景层驱动混乱值累加；被看守的薪柴点位依赖巡逻路线
  - system-combat                  # T4：敌人 HP/受击/攻击归 T4，本 spec 只提供接敌站位与朝向
  - tilemap-renderer               # T6：提供 OccluderGrid（视线遮挡）+ WalkGrid（寻路可通行）+ 敌人出生/路点数据
exposes:
  - AIState 枚举（patrol | suspicious | alert | chase | return，沿用 src/types/game-types.ts 既有定义）
  - EnemyView.getId() / getPosition() / getFacingAngle() / getFacing4() / getState() / isEngaged()
  - AISystem.update(dt, playerPos, playerIsMoving) / getEnemies() / getEnemyById(id)
  - AISystem.reportNoise(pos, radius, level)      # 战斗噪声等外部刺激入口（场景层调用）
  - AISystem.reportDamage(enemyId, sourcePos)     # 敌人被击中 → 立即追击（场景层调用）
  - AISystem.despawn(enemyId) / onPlayerLost()    # 敌人死亡 / 玩家死亡时的收尾
  - Pathfinding.findPath(from, to) 的使用契约与调度策略（网格代价 / no-corner-cut / 分帧队列）
  - EnemySpawnData / PatrolRouteData 数据契约（由地图侧 T6 实现）
  - 事件：ENEMY_ALERT（既有）、ENEMY_LOST_PLAYER（既有）。本 spec 不新增任何事件
---

# 系统设计：敌人 AI（渗透体 · FSM + 感知）

> **TL;DR**: 定义渗透体的五态 FSM（巡逻 / 警觉 / 警报 / 追击 + 归位过渡态）、基于"察觉度累积"的视觉+听觉感知（视线遮挡复用 `utils/grid-raycast`）、固定路点巡逻与分帧 grid A* 寻路；对外暴露敌人位姿/状态查询、噪声与受击刺激入口，事件只用既有的 `ENEMY_ALERT` / `ENEMY_LOST_PLAYER`。敌人的移动/感知/FSM 归本 spec，HP/受击/攻击归 `system-combat`。

## 概述

渗透体是裂隙里唯一的威胁源，它的存在只为一件事：**让"再多拿一点"变成一个赌注而不是一个动作**。玩家看见它、判断它在看哪里、估算绕过去要多久、决定是绕还是冲——这条判断链就是体验支柱 2「贪婪与撤退的博弈」的最小可玩形态。

因此本系统的设计目标不是"聪明的 AI"，而是**可读、可预测、可被玩家学习**的 AI。`world.md` 给了这件事叙事上的许可：污染是改写不是破坏，被覆盖的存在"按另一套规则正常运作"——渗透体有稳定的行为模式，不是随机疯狂的怪物。玩家读懂它的规律，是世界观允许并鼓励的玩法。

本 slice 只设计**一种**敌人（渗透体，低度覆盖，有机基体，32×32，人形轮廓）。改写体/覆盖体属于后续 Slice。

### 所有权边界（敌人实体被多个 spec 共享，划清避免冲突）

| 归本 spec 拥有 | 归其他 spec 拥有 |
| -------------- | ---------------- |
| 敌人的位置 / 速度 / 朝向 / 碰撞体 / 移动 | 敌人的 HP、受击、死亡、尸体清理（`system-combat`） |
| FSM 状态、全部转换条件与计时器 | 敌人的攻击判定、伤害值、攻击冷却、出手时机（`system-combat`） |
| 感知（视觉锥、听觉、察觉度累积、视线遮挡的调用方） | 视线遮挡**规则本身**与射线实现（`utils/grid-raycast`，T1 拥有） |
| 巡逻路点数据契约、寻路调度策略 | 路点/出生点的**具体坐标**（T6 固定地图数据） |
| 状态的可读性表现（占位期与正式期的"它在干什么"信号） | 敌人 sprite 的视觉设计、受击白闪（art / `system-combat`） |
| `ENEMY_ALERT` / `ENEMY_LOST_PLAYER` 的发出时机 | 混乱值对这些事件的**响应权重**（`system-chaos-scavenge-extract`） |

**接壤处的明确约定**：追击到贴身后，**本 spec 负责把敌人停在攻击距离上并保持面向玩家**（`isEngaged() === true`），**是否出手、出多重的手、冷却多久由 `system-combat` 决定**。本 spec 不写任何伤害逻辑；`system-combat` 不改任何 FSM 状态（它只通过 `reportDamage()` 施加刺激）。

---

## 平衡不变量（硬约束，QA 应作为断言检查）

这六条比任何单个数值都重要。调参时可以动数值，但不能破坏这些关系——它们成立，潜行博弈才成立。

| # | 不变量 | 现值 | 为什么 |
| - | ------ | ---- | ------ |
| I1 | `AI_SIGHT_RANGE` < `VISION_RADIUS_FORWARD` | 180 < 224 | 玩家**先**看到敌人。否则玩家永远后手，"观察→决策"这条链断掉（T1 决策②） |
| I2 | `AI_CHASE_SIGHT_RANGE` < `VISION_RADIUS_FORWARD` | 210 < 224 | 锁定态的加长视距也不得越过 I1 的边界 |
| I3 | `AI_CHASE_SPEED` < `MOVE_SPEED` | 130 < 160 | **撤退永远是可行选项**。追击是压力，不是死刑。玩家跑 1 秒拉开 30px |
| I4 | `AI_PATROL_SPEED` << `MOVE_SPEED` | 60 < 160 | 绕行有足够的时间窗，"等它走过去"是可执行的战术 |
| I5 | `AI_HEARING_RANGE` < `AI_SIGHT_RANGE` | 100 < 180 | 视觉是主感知、听觉是补充。反过来会让"藏在视锥外"失去意义 |
| I6 | `AI_TURN_RATE` < `FACING_TURN_RATE` | 360 < 1080 °/s | 玩家转身快于敌人 → **绕到背后**是可执行操作，而不是运气 |

**感知不对称是有意的**：敌人的感知**不受玩家视野限制**——玩家可能被自己看不见的敌人发现。这是紧张感的来源，由 I1/I3 平衡（玩家有更远的视距和更快的腿）。不要为了"公平"给敌人也加视野遮罩。

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
  detection: number;             // 察觉度 0..1。1.0 = 确信"那是玩家"
  lastSeenPlayerPos: Vector2 | null;   // 最后一次有视线时的玩家位置
  lastSeenPlayerVel: Vector2 | null;   // 用于外推搜索点
  losGraceMs: number;            // CHASE 态下连续无视线的累计毫秒

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

/** 渗透体的静态配置（Slice 1 只有一种，值来自"可调参数表"） */
interface InfiltratorConfig {
  type: 'infiltrator';
  bodySize: number;
  speeds: Record<AIState, number>;
  sight: { rangeCore: number; halfAngleCore: number;
           rangePeripheral: number; halfAnglePeripheral: number;
           chaseRange: number };
  hearing: { range: number; wallFactor: number; posJitter: number };
}

/** 地图侧（T6）必须提供的敌人数据 —— 本 spec 定义契约，T6 填值 */
interface EnemySpawnData {
  id: string;                    // 'ENM_INF_01'，全局唯一
  type: 'infiltrator';
  spawn: TileCoord;              // 出生 tile，必须可通行
  facing: number;                // 初始朝向（度，0 = 右，顺时针）
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

**P2｜单次射线服务两个感官**：当 `d = |player - enemy| ≤ AI_SIGHT_RANGE` 时，投**一次** `hasLineOfSight(occluders, enemyPos, playerPos)`，结果同时用于视觉判定与听觉的隔墙衰减。`d > AI_SIGHT_RANGE` 且 `d > AI_HEARING_RANGE` 时完全跳过射线。**每个敌人每个感知 tick 最多 1 次射线。**

**P3｜视线遮挡不重写**：视线一律走 T1 的 `utils/grid-raycast.hasLineOfSight()`，包括"对角缝隙不可穿透"（T1 规则 14）。**禁止在 AI 里另写任何遮挡判定。** 玩家和敌人被同一套规则约束，玩家才能通过"我看不到它"推断"它也看不到我"——这条推断是潜行的认知基础，两套规则会让它变成谎言。

**P4｜视觉分区**：以敌人朝向为轴，`θ` = 敌人朝向与"敌人→玩家"方向的夹角。

| 区 | 条件 | 说明 |
| -- | ---- | ---- |
| 核心锥 | `θ ≤ AI_SIGHT_HALF_ANGLE_CORE`（55°，张角 110°）且 `d ≤ AI_SIGHT_RANGE`（180） | 正常注视区 |
| 余光带 | `θ ≤ AI_SIGHT_HALF_ANGLE_PERIPH`（90°，张角 180°）且 `d ≤ AI_SIGHT_RANGE_PERIPH`（90） | 只在近处生效，累积速度打折 |
| 盲区 | 其余 | 视觉完全不生效（听觉仍可能生效） |

**P5｜察觉度累积（"看到多久才确信"）**：`detection ∈ [0,1]`，只在有视线时增长：

```
rate = (1 / AI_DETECT_FILL_TIME) × distFactor × zoneFactor
distFactor = lerp(1.6, 0.5, clamp01(d / AI_SIGHT_RANGE))    // 近处快，远处慢
zoneFactor = 1.0（核心锥） | 0.45（余光带）
detection += rate × dt
```

参考耗时（从 0 到 1.0，即"确信"）：贴身 ≈ 0.33 s；中距 ≈ 0.43 s；视距边缘 ≈ 0.85 s；余光带 ≈ 0.90 s。

**这条规则的博弈意义**：从"敌人开始注意到异常"（`detection ≥ 0.35`，敌人停下转向）到"锁定追击"（`detection = 1.0`）之间有 0.2–0.6 秒的窗口。**这个窗口就是玩家的反悔机会**——看到敌人停下转过来时缩回掩体，还来得及。窗口太短会读作"莫名其妙被抓"，太长会读作"敌人是瞎子"。

**P6｜察觉度衰减**：无视觉增益的 tick 内 `detection -= AI_DETECT_DECAY_RATE × dt`。ALERT 态下衰减速率减半（它已经在找你，更"记仇"）。CHASE 态下**不衰减**（改由 `losGraceMs` 计时器接管，见 T-C1）。

**P7｜听觉**：360°，**以距离为准，不看玩家移动速度**（T1 规则 10：本 slice 无潜行/疾跑双速）。

```
有效半径 = AI_HEARING_RANGE × (有视线 ? 1.0 : AI_HEARING_WALL_FACTOR)
命中条件 = playerIsMoving && d ≤ 有效半径
```

- 听觉**能穿墙**，但隔墙半径打折到 60 px。穿墙是听觉存在的理由——否则它只是一个更短的视觉。
- 听觉**最高只能把敌人推到 SUSPICIOUS**，永远不能直接触发 ALERT 或 CHASE。听见 ≠ 看见。
- 听觉给出的位置是**模糊的**：`investigatePos = playerPos + 半径 AI_HEARING_JITTER(32px) 内的随机偏移`，且在一次警觉周期内**只采样一次**（不随玩家移动实时更新）。否则听觉退化成一个穿墙的精确定位器，玩家会觉得"它作弊"。
- `playerIsMoving` 直接取 T1 暴露的 `Player.isMoving()`。**这不是双速潜行**：听觉半径是常量，不随速度变化；"移动/静止"是玩家已有的二元选择，让"停下来别动"成为一个真实可用的应对，而不引入任何速度分档。（见 escalate ①）

**P8｜外部刺激**：两个推送入口，由**场景层**在收到对应事件后调用（遵守架构"系统间不互相直接调用"）：

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
| 3 | 当前是 ALERT 且 `detection ≥ AI_REACQUIRE_THRESHOLD`（0.5）且有视线**且非盲区**（与优先级 2 同口径） | **CHASE** | 重新锁定的阈值更低——它已经在找你。「非盲区」是 DEC-022 ② 补的：否则玩家绕到 ALERT 敌人背后会因残留察觉度被无视线锁定，违反"每次被发现都能回溯"的承诺 |
| 4 | `reportNoise(level='alert')` 命中 | **ALERT** | `searchTimerMs = 0`，搜索点以噪声位置重建 |
| 5 | `detection ≥ AI_SUSPICION_THRESHOLD`（0.35）／听觉命中／`reportNoise(level='suspicious')` | 若当前为 PATROL/RETURN → **SUSPICIOUS**；若已是 SUSPICIOUS/ALERT/CHASE → **不换态，只重置该态计时器** | 设 `investigatePos` |
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

**T-C1｜CHASE 的视线判定被放宽**：一旦锁定，敌人的"看得见"判定改为 **360°（不受视锥限制）+ 射程 `AI_CHASE_SIGHT_RANGE`（210 px）**。理由：它正朝你跑、眼睛盯着你，此时还用 110° 视锥会导致追击中因为拐弯抖动而反复丢失目标，读起来像"它突然失明"。210 仍满足不变量 I2。

**T-C2｜完整降级链的总时长**：CHASE →(0.4 s)→ ALERT →(5 s)→ SUSPICIOUS →(3 s)→ RETURN →(走回路点)→ PATROL。从甩掉追兵到它彻底冷静下来约 **8.4 秒 + 归位时间**。这段时间足够长，让"被发现"是一个真实的代价（混乱值在涨、路线被封）；又足够短，让玩家不至于放弃这张地图。

**T-C3｜没有从 SUSPICIOUS 直接跳 ALERT 的"自然升级"路径**。SUSPICIOUS 只能靠视觉确信升到 CHASE，或被 `reportNoise('alert')` 推到 ALERT。理由：ALERT 的语义是"确认有东西但看不到"，而单纯的疑点查看无法产生这种确认。这避免了"敌人自己把自己吓进搜索状态"的死循环。

### B — 行为（每个状态在做什么）

**B1｜PATROL**：沿 `patrol.waypoints` 依次移动，速度 `AI_PATROL_SPEED`。到达路点后停留 `pauseMs`；停留期间若定义了 `scanAngles`，按序每 `AI_SCAN_HOLD_MS`（600 ms）转向下一个角度（以 `AI_TURN_RATE` 转，不瞬转）。移动时朝向 = 移动方向。
- `mode: 'loop'` → 到末尾回到 0；`'pingpong'` → 到末尾反向；`'static'`（单路点）→ 永远停留在原地，只按 `scanAngles` 扫视，即"守卫"。
- **巡逻路径在场景 create 时全部预计算并缓存**（固定地图 + 固定路点 = 路径永不变化）。运行时 A\* 只服务 ALERT / CHASE / RETURN。这一条消掉了绝大部分寻路开销。

**B2｜SUSPICIOUS**：① 先**原地停下并转向** `investigatePos`（以 `AI_TURN_RATE` 转，不移动）。② 转到位后以 `AI_SUSPICIOUS_SPEED`（45，比巡逻还慢）走向疑点。③ 到达后原地扫视（左右各 ±45°，周期 1.5 s）直到计时结束。
- **"停下并转过来"是本系统最重要的可读信号**。它必须发生在 CHASE 之前，且必须持续足够长（≥ 0.2 s）让玩家看见。这是玩家唯一的预警。

**B3｜ALERT**：依次前往搜索点队列，速度 `AI_ALERT_SPEED`（90），每点停留 `AI_SEARCH_HOLD_MS`（800 ms）扫视。搜索点构造（最多 3 个，预分配）：
1. `lastSeenPlayerPos`（最后见到的地方）
2. **外推点** = `lastSeenPlayerPos + lastSeenPlayerVel × AI_EXTRAPOLATE_SEC`（0.6 s），若不可通行则取最近的可通行 tile。这一条让"直线逃跑"不安全——它会往你跑的方向找。
3. `lastSeenPlayerPos` 周围半径 `AI_SEARCH_SPREAD`（96 px）内的一个随机可通行 tile
- 队列走完但 `searchTimerMs` 未到 → 在当前位置扫视直到超时。

**B4｜CHASE**：目标 = 有视线时的玩家实时位置，无视线时（`losGraceMs` 宽限期内）= `lastSeenPlayerPos`。速度 `AI_CHASE_SPEED`（130）。
- **接敌子行为**：当 `d ≤ AI_STANDOFF_DISTANCE`（30 px）时停止推进，`engaged = true`，原地保持面向玩家并把距离维持在 26–34 px（超出则微调）。**出手与否交给 `system-combat`。**
- `d > 34 px` 时 `engaged = false`，恢复推进。

**B5｜RETURN**：以 `AI_RETURN_SPEED`（75）走向**直线距离最近的路点**，到达即转 PATROL。RETURN 在玩家眼里应当读作巡逻（不显示任何警戒指示物），但速度略快——"它在往回走"本身就是"我暂时安全了"的信号。

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

**R7｜音频钩子**：每次状态转换向场景层提供一个 cue id（`ai.cue.suspicious` / `ai.cue.alert` / `ai.cue.chase` / `ai.cue.lost`）。**本 spec 不设计音频内容**（归 audio-direction）；但需注意：由于 R4，被追击时的听觉可能是玩家唯一的追兵信息源，`ai.cue.chase` 应设计为持续性而非一次性。

---

## 玩家交互

- **输入**：玩家不直接操作敌人。玩家能施加的影响只有四种，全部是间接的：

| 玩家做什么 | 系统响应 |
| ---------- | -------- |
| 走进视锥且无遮挡 | `detection` 开始累积；越近越快 |
| 在 100 px 内移动（隔墙 60 px） | 敌人升到 SUSPICIOUS，去查看一个**模糊**位置 |
| 停止移动 | 听觉不再命中（视觉不受影响——站着不动救不了你，如果它正看着你） |
| 攻击 / 被攻击（T4） | 噪声半径内的敌人升级；被打中的敌人立即 CHASE |

- **反馈**：见"状态可读性"R1–R3。核心承诺是：**玩家每次被发现，都应当能回溯出是哪一步操作导致的。** 任何"不知道为什么被发现"的实例都是 bug 或调参失败，不是难度。

---

## 数值结构（可调参数表）

> **状态列**：`建议值` = 本 spec 给出的有依据初值，**需人试玩校准**；`既有constants` = 沿用 `src/config/constants.ts` 现值，未改动；`技术定` = 技术/结构性取值，无需人拍板；`架构定` = 来自 `architecture.md` 的硬约束；`art定` = 来自 `art-direction.md`。
> 实现时全部集中进 `src/config/constants.ts` 的 `AI` 段，不散落在系统内部。表中写作 `AI_XXX` 的名称，实际键为 `GAME_CONSTANTS.AI.XXX`（`AI_PATROL_SPEED` → `AI.PATROL_SPEED`）；标为 `既有constants` 的即当前已存在的同名键。

### 移动与体型

| 参数 | 含义 | 初值 | 合理范围 | 对博弈手感的影响 | 状态 |
| ---- | ---- | ---- | -------- | ---------------- | ---- |
| `AI_PATROL_SPEED` | 巡逻速度 | 60 px/s | 40–90 | 决定"等它走过去"的等待时长。太慢玩家干等无聊，太快绕行窗口消失（不变量 I4） | 既有constants |
| `AI_CHASE_SPEED` | 追击速度 | 130 px/s | 100–155 | **最敏感的一个数**。与玩家 160 的差值 30 决定甩掉追兵要跑多久；≥160 则撤退不再是选项，游戏从潜行变成逃杀（不变量 I3） | 既有constants |
| `AI_SUSPICIOUS_SPEED` | 查看疑点的速度 | 45 px/s | 30–70 | 比巡逻还慢，制造"它在小心翼翼靠近"的压迫感，同时给玩家撤退时间 | 建议值 |
| `AI_ALERT_SPEED` | 搜索速度 | 90 px/s | 70–120 | 介于巡逻与追击之间。太快会让搜索读起来像追击，模糊状态区分 | 建议值 |
| `AI_RETURN_SPEED` | 归位速度 | 75 px/s | 60–100 | 略快于巡逻，让"它在往回走"可被识别 | 建议值 |
| `AI_TURN_RATE` | 转向角速度 | 360 °/s | 240–720 | **绕背可行性的直接控制器**。玩家是 1080°/s，比值 3:1。调高会让"绕到背后"变成运气（不变量 I6） | 建议值 |
| `AI_BODY_SIZE` | 碰撞体边长 | 20 px | 16–24 | 与玩家同；必须 < 32 以保证 1 tile 通道可通行 | 技术定 |
| `AI_SEPARATION_RADIUS` | 敌人间软排斥半径 | 24 px | 16–32 | 防止多个敌人重叠成一坨；太大会让它们不敢并排走窄道 | 技术定 |
| `AI_STANDOFF_DISTANCE` | 接敌保持距离 | 30 px | 24–38 | 应略小于 `COMBAT.ATTACK_RANGE`(40) 以保证敌人站定后 T4 判定必中；太小会与玩家 sprite 重叠 | 建议值（需与 T4 对齐） |

### 感知

| 参数 | 含义 | 初值 | 合理范围 | 对博弈手感的影响 | 状态 |
| ---- | ---- | ---- | -------- | ---------------- | ---- |
| `AI_SIGHT_RANGE` | 核心锥视距 | 180 px（5.6 tile） | 140–200 | **必须 < 224**（不变量 I1）。这是"玩家先手"的物理保证 | 既有constants |
| `AI_SIGHT_HALF_ANGLE_CORE` | 核心锥半角 | 55°（张角 110°） | 40–75 | 越窄背后越安全、绕行越容易。现有常量 `SIGHT_ANGLE: 90` 语义被拆分（见"对已有系统的影响"） | 建议值 |
| `AI_SIGHT_RANGE_PERIPH` | 余光带视距 | 90 px（2.8 tile） | 60–120 | 防止"贴着它侧面走过去毫无风险"。太大等于视锥变成 180° | 建议值 |
| `AI_SIGHT_HALF_ANGLE_PERIPH` | 余光带半角 | 90°（张角 180°） | 75–110 | 90° 意味着正后方仍是绝对盲区——这是"绕背"这个战术存在的前提 | 建议值 |
| `AI_CHASE_SIGHT_RANGE` | 锁定后的视距（360°） | 210 px | 180–220 | **必须 < 224**（不变量 I2）。太小追击会频繁误丢目标，读作"它突然失明" | 建议值 |
| `AI_DETECT_FILL_TIME` | 察觉度满格基准时长 | 0.45 s | 0.25–0.80 | **玩家反悔窗口的总控**。太短 = 莫名其妙被抓；太长 = 敌人像瞎子，潜行没有紧张感 | 建议值 |
| `AI_SUSPICION_THRESHOLD` | 触发 SUSPICIOUS 的察觉度 | 0.35 | 0.20–0.50 | 决定"预警提前多久出现"。这是玩家能看到的第一个信号 | 建议值 |
| `AI_REACQUIRE_THRESHOLD` | ALERT 态重新锁定阈值 | 0.50 | 0.35–0.75 | 越低越"记仇"，被发现一次后的代价越重 | 建议值 |
| `AI_DETECT_DECAY_RATE` | 察觉度衰减 | 0.67 /s（1.5 s 清零） | 0.4–1.2 | 决定"缩回掩体后多久安全"。ALERT 态下自动减半 | 建议值 |
| `AI_HEARING_RANGE` | 听觉半径（360°） | 100 px（3.1 tile） | 64–140 | **必须 < 视距**（不变量 I5）。太大会让玩家觉得"藏起来没用" | 既有constants |
| `AI_HEARING_WALL_FACTOR` | 隔墙听觉衰减系数 | 0.6（→ 60 px） | 0.4–0.8 | =0 则听觉退化为短视觉，失去存在理由；=1 则墙壁不提供任何安全感 | 建议值 |
| `AI_HEARING_JITTER` | 听觉定位模糊半径 | 32 px（1 tile） | 16–64 | 防止听觉变成穿墙精确定位器。太大则查看行为看起来是随机的 | 建议值 |
| `AI_PERCEPTION_TICK_MS` | 感知节拍 | 100 ms（10 Hz） | 66–150 | 性能与响应的平衡。>150 ms 会出现"擦身而过没被发现"的穿帮 | 技术定 |

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

### 占位期表现（art §12 约束内）

| 参数 | 初值 | 说明 | 状态 |
| ---- | ---- | ---- | ---- |
| 本体色 | `#cc4444` | art §12「敌人（低度）」，**编码等级不编码状态** | art定 |
| 指示物色 | `#2ae6c8` | art §12「污染 teal」，符合 §13.1 色温纪律 | art定 |
| SUSPICIOUS 呼吸频率 | 1.5 → 3.0 Hz（随 detection 线性） | 见 R3 | 建议值 |
| ALERT 闪烁频率 | 3 Hz | 见 R2 | 建议值 |
| CHASE 残影间隔 / 存活 / alpha | 100 ms / 300 ms / 0.3 | 必须走对象池（架构：循环内禁止 new） | 建议值 |
| `DEBUG_SHOW_VISION_CONE` | `false` | QA / A-G2 期间置 true | 技术定 |

---

## Schema（对外接口契约）

```typescript
/** 单个敌人对外的只读视图（渲染层 / T3 / T4 消费） */
interface EnemyView {
  getId(): string;
  getPosition(): Readonly<Vector2>;
  getFacingAngle(): number;
  getFacing4(): Facing4;
  getState(): AIState;
  /** CHASE 态且已到达接敌距离。system-combat 用它决定是否可以出手 */
  isEngaged(): boolean;
  /** 0..1，仅供 debug overlay 与 QA 使用，不用于玩法判断 */
  getDetection(): number;
}

interface AISystemAPI {
  create(
    scene: Phaser.Scene,
    spawns: readonly EnemySpawnData[],
    occluders: OccluderGrid,   // T1 契约，用于 hasLineOfSight
    walk: WalkGrid,            // 本 spec 契约，用于 A*
  ): void;

  /** 每帧调用。playerIsMoving 来自 Player.isMoving() */
  update(deltaMs: number, playerPos: Readonly<Vector2>, playerIsMoving: boolean): void;

  // —— 查询 ——
  getEnemies(): readonly EnemyView[];
  getEnemyById(id: string): EnemyView | undefined;

  // —— 外部刺激（由场景层在收到相应事件后调用）——
  reportNoise(pos: Readonly<Vector2>, radius: number, level: 'suspicious' | 'alert'): void;
  reportDamage(enemyId: string, sourcePos: Readonly<Vector2>): void;

  // —— 生命周期 ——
  /** system-combat 判定死亡后由场景层调用：注销敌人、取消其寻路请求、必要时补发 ENEMY_LOST_PLAYER */
  despawn(enemyId: string): void;
  /** 玩家死亡：全体转 RETURN，停止一切追击 */
  onPlayerLost(): void;
  destroy(): void;
}

/** 寻路（共享服务模块，非"系统"；算法细节归 code agent，网格规则归本 spec 的 N1/N2） */
declare function findPath(
  grid: WalkGrid, from: Vector2, to: Vector2, maxNodes?: number
): Vector2[] | null;
```

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
| 玩家隔一堵墙贴着敌人站定不动 | 听觉不命中（未移动）、视觉被遮挡 → 敌人无反应。**这是有意的**：静止 + 掩体 = 绝对安全，玩家需要一个可靠的"暂停键" |
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
| TilemapRenderer / 固定地图（T6） | `OccluderGrid`、`WalkGrid`、`EnemySpawnData[]`（出生点 + 路点 + 模式） | 场景 create 时注入 |
| `system-combat`（T4，经场景层） | `reportDamage(enemyId, sourcePos)`（监听 `ENEMY_DAMAGED`）、`reportNoise(...)`（玩家挥击/命中）、`despawn(id)`（监听 `ENEMY_KILLED`） | 场景层转发 |
| 场景层 | `onPlayerLost()`（监听 `PLAYER_DIED` / `RIFT_EXIT_REACHED`） | 直接调用 |

### 向其他系统提供

| 消费方 | 提供什么 | 形式 |
| ------ | -------- | ---- |
| 渲染层 | `EnemyView`（位置 / 朝向 / 状态），配合 `VisibilitySystem.getVisibilityAt(enemyPos)` 决定是否绘制及 alpha | 同步查询 |
| `system-chaos-scavenge-extract`（T3，经场景层） | `ENEMY_ALERT` / `ENEMY_LOST_PLAYER` 事件 | 事件总线 |
| `system-combat`（T4） | `isEngaged()`（是否已站定可出手）、`getPosition()` / `getFacingAngle()`（攻击判定的原点与方向）、`getEnemies()`（玩家挥击的命中枚举） | 同步查询 |
| T6 地图设计 | `PatrolRouteData` 契约 + `AI_SIGHT_RANGE`/`AI_SIGHT_HALF_ANGLE_CORE`（用于摆放"被看守的薪柴"——薪柴应落在巡逻视锥的覆盖区内） | 数据契约 |
| HUD / 音频 | 同 T3 的两个事件 + R7 的 cue id | 事件 / 回调 |

### 为什么用这种耦合方式

遵循 T1 已确立、Director 已确认的模式（`system-movement-vision` 的"为什么不用事件总线"一节）：

1. **AI 不 import VisibilitySystem**。共享的射线能力已下沉为无状态纯函数 `utils/grid-raycast`，任何系统可用，不构成系统间耦合。
2. **AI 不 import CombatSystem，CombatSystem 也不 import AI**。两者的交互全部经场景层：战斗事件 → 场景层 → `reportDamage()` / `reportNoise()`；AI 状态 → 场景层查询 → 喂给战斗判定。
3. **AI 每帧位置不进事件总线**。位置是每帧连续量，走事件会制造每帧数十次 emit。对外一律同步查询。
4. **Pathfinding 是共享服务模块**，与 `grid-raycast` 同级，可被直接 import。本 spec 只规定它的网格规则（N1/N2）与调度策略（N3），算法实现归 code agent。

---

## 对已有系统的影响

| 对象 | 影响 |
| ---- | ---- |
| `src/config/constants.ts` 的 `AI` 段 | **需要扩充并改名一处**：现有 `SIGHT_ANGLE: 90 // degrees (cone half-angle)` 的语义被拆成 `SIGHT_HALF_ANGLE_CORE`(55) 与 `SIGHT_HALF_ANGLE_PERIPH`(90)，应删除旧键避免两套语义并存。`PATROL_SPEED` / `CHASE_SPEED` / `SIGHT_RANGE` / `HEARING_RANGE` / `ALERT_DURATION` / `LOST_PLAYER_DURATION` **保持现值**，其余按"可调参数表"新增。由 code agent 在 T7 执行 |
| `src/types/game-types.ts` 的 `AIState` | **无需修改**，本 spec 使用的五个值与现有枚举完全一致 |
| `src/types/events.ts` | **无变更**。`ENEMY_ALERT` / `ENEMY_LOST_PLAYER` 的 payload 与现有定义一致 |
| `architecture.md` 模块注册表 | T7 完成后需登记：`AISystem`（`src/systems/ai/`）与 `Pathfinding`（`src/systems/pathfinding.ts`）状态改为已实现并补全接口列；新增 `EnemyFactory`（`src/entities/enemy-factory.ts`）。**登记由 code agent 执行**（T7 Brief 已含此项），本 spec 不修改 architecture.md |
| `system-movement-vision`（T1） | **无需修改**。本 spec 完全在 T1 已声明的接口内工作（`hasLineOfSight` / `getPosition` / `isMoving` / `getVisibilityAt`），并遵守其平衡不变量。T1 的 `interfaces-with` 已列出本 spec |
| `system-chaos-scavenge-extract`（T3） | 需消费 E1/E2 两个事件并定义等级权重；薪柴布点需参考本 spec 的视锥参数来定义"被看守" |
| `system-combat`（T4） | 需消费 `isEngaged()` 决定出手时机；需通过场景层调用 `reportDamage` / `reportNoise`；**不得直接修改 FSM 状态** |
| 固定地图数据（T6） | 需提供 `EnemySpawnData[]`（含路点与 mode）与 `WalkGrid`；需保证路点可通行且互相可达 |

---

## 验证标准

**本 Slice 结束时能验证：**

- 玩家能否**读懂**敌人——看一眼就知道它在巡逻、在怀疑、在搜索还是在追我。
- "绕行 vs 冒险搜刮"是否是一个**真实的选择**——绕行要有可行路径且要花时间，冒险要有被抓的实际风险。
- 被发现之后是否**有救**——能不能靠跑和拐弯甩掉，甩掉之后要等多久才安全。

**预期正面结果：**

- 玩家会**停下来观察敌人走位再动**——说明巡逻是可预测的、观察是有回报的。
- 玩家看到敌人转身时会**主动缩回掩体**——说明 SUSPICIOUS 的预警窗口（P5/R3）真的能被用上。
- 玩家被追时会**往拐角跑**而不是直线跑——说明视线遮挡与 `LOS_GRACE` 的组合被理解为可利用的机制。
- 玩家在甩掉追兵后会**等一会儿再动**——说明降级链（8.4 s）被感知为一个真实的代价。
- 性能：5 个敌人时 AI 总开销 < 1.5 ms/帧，单次 A\* < 5 ms，帧率 60 稳定。

**如果不 work 的信号：**

| 现象 | 指向的问题 | 调参方向 |
| ---- | ---------- | -------- |
| 玩家说"我不知道为什么被发现" | 预警窗口太短或不可见 | 升 `AI_DETECT_FILL_TIME`、降 `AI_SUSPICION_THRESHOLD`、加强 R3 的呼吸反馈 |
| 玩家从不潜行，一路硬闯 | 追击没有威胁 / 战斗太划算 | 升 `AI_CHASE_SPEED`（但守住 I3）、升 `AI_CHASE_ABANDON_RANGE`；或调 T4 的战斗代价 |
| 玩家一被发现就必死 | 撤退不可行 | 检查 I3 是否被破坏、降 `AI_CHASE_ABANDON_RANGE`、降 `AI_LOS_GRACE_MS` |
| 玩家能贴着敌人走过去毫无风险 | 余光带/听觉太弱 | 升 `AI_SIGHT_RANGE_PERIPH`、升 `AI_HEARING_WALL_FACTOR` |
| 敌人"隔墙看见我" | 没走 `hasLineOfSight` 或另写了遮挡 | 检查 P3；这是 bug 不是调参 |
| 敌人在墙角抖动 / 卡住不动 | 寻路失败未降级 | 检查 N6；等待路径期间必须有 steering fallback（N3） |
| 分不清 ALERT 和 CHASE | 可读性设计未落地 | 检查 R2 的"闪 vs 常亮"是否实现；检查速度差（90 vs 130）是否明显 |
| 被追时完全看不到追兵，感到不公平而非恐怖 | R4 的取舍不成立 | 见 escalate ③ |
| 帧率掉且 profiling 指向 A\* | 分帧或直线优先未生效 | 检查 N3（每帧 1 次）与 N4（直线跳过）、B1 的巡逻路径预计算 |

---

## 待验证假设

- [ ] **0.45 s 的察觉满格时长给出的反悔窗口够用** —— 这是整个系统最需要试玩校准的数。太短玩家会觉得被偷袭，太长敌人会显得愚蠢。
- [ ] **"停下→转身→慢速接近"是足够强的预警信号** —— 若玩家在占位期读不出来，先加强 R3 的指示物反馈，再考虑延长 `AI_SUSPICIOUS_SPEED` 的接近时间，最后才考虑画视锥（R5 备选）。
- [ ] **110° 核心锥 + 90 px 余光带的组合让"绕背"可行但不廉价** —— 与 `AI_TURN_RATE`(360°/s) 联合决定；需与不变量 I6 一起校准。
- [ ] **隔墙听觉（60 px）读作"合理"而非"作弊"** —— 关键在 `AI_HEARING_JITTER` 是否让查看行为显得模糊而非精确。若玩家抱怨，先加大 jitter 再考虑降低半径。
- [ ] **8.4 秒的完整降级链是"有代价"而非"惩罚过重"** —— 需与 T3 的混乱值增速联合评估：被发现一次要多付多少秒的混乱值。
- [ ] **敌人不作为 glow source（R4）不会让追击段变成"看不见的挫败"** —— 若成立则是极好的恐怖体验；若不成立，最小代价的修正是加强 `ai.cue.chase` 的音频而不是让敌人发光。
- [ ] **不做敌人间警报传播（P9）不会让"一处开打"显得迟钝** —— `reportNoise` 的半径应能覆盖这个需求；若不够，先调半径而不是加传播。
- [ ] **N4「直线优先跳过 A\*」不会造成 20 px 身体斜穿窄缝卡墙** —— T7 实测；若卡，限制在 3 tile 内使用。
- [ ] **每帧 1 次 A\* 在 5 敌人 + 巡逻路径预计算的前提下完全够用** —— 预期最坏情况是 5 个敌人同时进入 ALERT，各需 500 ms 重规划一次 = 10 次/秒，远低于 60 次/秒的预算。

---

## ⚠️ 待确认 / escalate（需人或对应 agent 拍板，本 spec 未擅自改动相关文档）

1. **听觉是否可以依赖 `Player.isMoving()`。**
   T1 规则 10 写的是「敌人听觉（若 T2 采用）以距离而非玩家速度为准」。本 spec 的读法是：**禁止的是"噪声半径随移动速度变化"**（因为本 slice 没有潜行/疾跑双速），而"移动/静止"这个二元状态不属于速度分档，且 T1 的 `exposes` 明确列出了 `Player.isMoving()`。本 spec 据此采用「半径恒定 + 仅在移动时命中」。
   → **需 Director 确认这个读法**。若判定违反 T1，退化方案是听觉恒定生效（不看移动状态），代价是"停下来别动"失去任何战术价值，且玩家会频繁在墙后被动触发 SUSPICIOUS。

2. **`AI_STANDOFF_DISTANCE`(30) 与 T4 的 `COMBAT.ATTACK_RANGE`(40) 的配合，以及"谁决定出手"。**
   本 spec 的约定是：T2 把敌人停在 30 px 并置 `isEngaged = true`，**T4 决定是否出手、伤害多少、冷却多久**。
   → **需 T4 确认**：(a) 接受这个分工；(b) 接受 `isEngaged()` 作为查询式接口（而不是由 T2 emit 一个"请求攻击"事件）；(c) 若 T4 想要敌人有"后撤—再突进"的节奏，需要 T2 增加一个由 T4 驱动的 `setStandoffDistance()`——本 spec 目前**没有**这个接口。

3. **敌人不注册为 glow source（R4）—— 被追击时玩家看不到身后的追兵。**
   这是有意的恐怖设计，但风险是读作"不公平"而非"恐怖"。它与 T1 规则 19（Slice 1 的 glow source 只有撤离点）一致，本 spec 未擅自扩展。
   → **需人在试玩后拍板**。若判定过于挫败，修正顺序应为：① 加强追击音频（R7）→ ② 给 CHASE 态敌人极低 alpha 的视野外泄露 → ③ 才考虑其他。

4. **`ENEMY_ALERT` 只在升级时发出（E1），降级不发。**
   代价是消费方无法从事件流里读到"它从 chase 降到 alert 了"这个中间信息。本 spec 认为 `ENEMY_LOST_PLAYER` + 同步查询 `getState()` 足以覆盖所有 Slice 1 需求，因此**不扩展 payload**（扩展会改动 `src/types/events.ts` 的既有契约，超出本 spec 权限）。
   → **需 T3 确认**其混乱值模型不需要"降级"事件。若需要，正确做法是 T3 用 `getEnemies()` 同步查询当前警戒态计数，而不是加事件。

5. **`suspicious` 是否计入混乱值。**
   本 spec 建议**不计入**（理由：贴墙走路会持续触发听觉 → SUSPICIOUS，若计入则玩家承受一个自己无法归因的持续惩罚，学不到因果）。
   → **归 T3 拍板**，本 spec 的事件契约对两种选择都兼容。

6. **`constants.ts` 中 `AI.SIGHT_ANGLE: 90 // (cone half-angle)` 的语义变更。**
   本 spec 把它拆成核心锥 55° 与余光带 90°。若直接保留旧键并新增两个键，会出现三个角度参数语义重叠。
   → **由 code agent 在 T7 执行替换**（删旧键、加新键），此处只是提示不要两套并存。

7. **敌人不受混乱值影响（边界情况表最后一条）。**
   这是本 spec 的设计取舍：压力曲线只从玩家一侧收紧。若 T3 或人希望"混乱值高时敌人更敏锐"来强化后期压力，需要在本 spec 增加一个调制器接口（类似 T1 的 `setRadiusScale`）。
   → **需 T3 / 人确认**当前取舍。本 spec 倾向保持不受影响：玩家侧已有视野缩小 + 移速降低两重惩罚，敌人再同步变强会让超阈值段从"艰难"直接变成"不可能"。
