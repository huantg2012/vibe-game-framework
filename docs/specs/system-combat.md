---
status: ACTIVE
created-by: design agent
created-date: 2026-07-27
last-modified-by: design agent（迭代 2 第二轮 R2-D1）
last-modified-date: 2026-08-22
interface-changed: true
slice: 1
interfaces-with:
  - system-movement-vision         # T1：共享 Player 实体（本 spec 只拥有 HP/攻击/受击/死亡触发）；复用 utils/grid-raycast 做隔墙判定；用 setSpeedModifier('attack') 做出手僵直
  - system-enemy-ai                # T2：消费 isEngaged()/getPosition()/getFacingAngle()/getEnemies()；经场景层调用 reportDamage/reportNoise/despawn，不改 FSM
  - system-contamination-lexicon   # 迭代 1：乙邻格抽打 / 打核 / 丙丁不打血；核 HP 50。出击已接（DEC-077）。迭代 2 第二轮：接触词素对照表由 R2-D1 写入句法 spec；gym 先读词素，出击默认仍按宿主 kind
  - system-chaos-scavenge-extract  # T3：emit ENEMY_DAMAGED/PLAYER_DIED/PLAYER_HEALTH_CHANGED 供其消费；本 spec 不自行修改混乱值
  - tilemap-renderer               # T6：提供 OccluderGrid（攻击不穿墙判定）
exposes:
  - PlayerCombat.getHealth() / getMaxHealth() / isDead() / isInvulnerable() / getAttackState()
  - CombatSystem.requestPlayerAttack()   # 由场景层在按下攻击键时调用（按键读取归 RiftScene）
  - CombatSystem.update(dt) / setEnabled(b) / getEnemyHealth(id) / isEnemyAlive(id) / reset() / destroy()
  - CombatHooks.onNoise(pos, radius, level)   # 注入式回调：场景层转调 AISystem.reportNoise
  - 事件 PLAYER_DAMAGED { amount, source }（既有；本 spec 是拥有者，定义 source = enemyId）
  - 事件 PLAYER_HEALTH_CHANGED { current, max }（既有）
  - 事件 PLAYER_DIED { cause }（既有；Slice 1 唯一取值 'enemy_attack'）
  - 事件 ENEMY_DAMAGED { enemyId, amount }（既有；建议新增可选 source 字段）
  - 事件 ENEMY_KILLED { enemyId, position }（既有）
---

# 系统设计：简化战斗

> **TL;DR**: 定义"可选、有代价、可控"的最小近战——玩家按键挥击（锁定朝向的前向扇形、25 伤害、500 ms 冷却、出手期间自身减速），渗透体 75 HP（三刀）、有 350 ms 前摇可被躲开的反击；战斗的代价通过 emit `ENEMY_DAMAGED`（T3 加混乱值）与经场景层 `reportNoise` 惊动附近敌人两条路径落地。本 spec 拥有 Player 与敌人的 HP/攻击/受击/死亡，是五个战斗/玩家事件的拥有者，不改 FSM、不改混乱值。

## 概述

`vision.md` 把战斗定位为**"可选手段，有代价但可控。不是主要交互方式，是决策选项之一"**。这句话对本系统提出的要求不是"做一套爽快战斗"，而是**做一个价目表**：让玩家在每次遭遇时都能大致算出"砍它要花多少钱"，并且这个价格在绝大多数情况下高于"等它走过去"。

因此本系统的成功标准是反直觉的：**如果试玩者开始享受战斗，本系统就失败了。** 想要的反应是"我本来可以绕过去的"。

三条设计纪律：

1. **代价必须可归因、可计算、当场可见**。伤害无随机、无暴击、无浮动；敌人 75 HP ÷ 玩家 25 伤害 = **恰好三刀**。玩家第一次打完就能学到"一次遭遇 = 三刀 = 15 点混乱值 + 一格血"，此后每次遭遇都是一次算术题而不是一次赌博。这与 T3「可计算的压力才能产生纠结」是同一条纪律。
2. **代价必须落在两个不可互换的维度上**。混乱值（时间）由 T3 通过 `ENEMY_DAMAGED` 收取；暴露（空间/路线）由 `reportNoise` 惊动附近敌人收取。只收其中一种，玩家总能找到一种资源来支付；两种同时收，"砍一刀"才真的比"悄悄绕过去"更贵。
3. **可控 = 可躲，不是 = 无伤**。敌人出手有 350 ms 前摇，前摇结束的瞬间才结算——**站位正确就不会挨打**。恐惧应当来自"我判断错了"，而不是"我被随机数打了"。

服务体验支柱 1（绝望边缘的紧绷）与支柱 2（贪婪与撤退的博弈）。世界观上它也成立：`world.md` 规定污染体是"按另一套规则正常运作的东西"，渗透体不是狂暴怪物，它接敌、出手、有节拍——可被学习。

### 为什么潜行仍然更划算（本 spec 的核心论证）

以"通过一个巡逻的渗透体"为单位，两条路线的账（按 T3 `BASE_RATE = 0.8` 点/秒计）：

| | 绕行 / 等巡逻窗口 | 砍死它 |
| -- | ---------------- | ------ |
| 时间成本 | 15–20 s = **12–16 混乱值** | 三刀约 1.1 s，可忽略 |
| 命中脉冲（T3 `COMBAT_BONUS` 5 × 3 刀） | 0 | **+15** |
| 该敌人必然 CHASE（`reportDamage`）→ `ENEMY_ALERT{chase}` → T3 `DETECTION_BONUS` | 0（`suspicious` 不计） | **+3** |
| 追击期间 T3 速率 ×2（约 1.5 s） | 0 | **+1.2** |
| 命中噪声惊动一个邻近敌人（→ `ENEMY_ALERT{alert}`） | 0 | **+3**（若有邻居） |
| 生命值 | 0 | **15–30 HP，本次出击内不可恢复** |
| 路线状态 | 不变 | 半径内敌人进入 ALERT 搜索 5 s，**路线被临时封锁** |
| **混乱值小计** | **12–16** | **19–22（无邻居）／22–25（有邻居）** |

砍死一个敌人比等它走开贵约 **1.5–2 倍混乱值**，额外扣掉一份本局不可再生的生命值，并把周围变成搜索状态（T2 的 8.4 秒降级链）。

**但战斗不能永远是错的选择，否则它不是"选项"而是"陷阱"。** 本系统刻意保留了三个战斗真正划算的场景：

- **需要反复经过同一段**（deep 节点往返）：清掉守卫的收益会被走第二遍时收回。
- **已经被追上、跑不掉**：`AI_CHASE_SPEED`(130) 与 `MOVE_SPEED`(160) 的差值意味着甩脱需要时间，而混乱值在 ×2 速率下走；此时三刀可能比跑三十秒便宜。
- **混乱值已进入溢出段**（>100，视野与移速被削）：绕行的时间成本被惩罚放大，战斗的相对价格下降。

这三个场景都是"局势已经变糟"的场景。**战斗是止损工具，不是推进工具**——这就是"可选、有代价、可控"在数值上的完整含义。

---

## 所有权边界（Player 与敌人实体被多个 spec 共享，划清避免冲突）

### Player 实体

| 归本 spec 拥有 | 归其他 spec 拥有 |
| -------------- | ---------------- |
| `health` / `maxHealth` / `isDead` / 无敌帧计时 | 位置 / 速度 / 朝向 / 碰撞体 / 输入开关（`system-movement-vision`） |
| 攻击状态机（idle / windup / active / recovery / cooldown）与攻击朝向锁 | `getPosition()` / `getFacingAngle()` 的**实现**（T1；本 spec 只读） |
| 受击白闪、死亡表现的触发时机 | 移速调制栈的**实现**（T1；本 spec 只以 `'attack'` 为 key 写入一项） |
| `PLAYER_DAMAGED` / `PLAYER_HEALTH_CHANGED` / `PLAYER_DIED` 的发出 | 死亡后的输入冻结与结算流程（`system-chaos-scavenge-extract` 的 `RunController`） |

**本 spec 不得改动 T1 拥有的任何移动字段的语义。** 与 T1 的唯一写入接触点是 `Player.setSpeedModifier('attack', m)` / `clearSpeedModifier('attack')`——这是 T1 已 `exposes` 的公开 API，且 key 与 T3 的 `'chaos'` 不冲突（乘法叠加）。

### 敌人实体（渗透体）

| 归本 spec 拥有 | 归其他 spec 拥有 |
| -------------- | ---------------- |
| 敌人的 HP、受击、死亡判定、受击白闪 | 敌人的位置 / 速度 / 朝向 / 碰撞体 / 移动（`system-enemy-ai`） |
| 敌人的攻击判定、伤害值、前摇、冷却、出手时机 | FSM 状态与全部转换条件（`system-enemy-ai`） |
| "是否可以出手"的决策（读 `isEngaged()` 后自行判断） | 接敌站位与保持面向玩家（`system-enemy-ai` 的 B4） |
| 死亡时 emit `ENEMY_KILLED` | 收到 `ENEMY_KILLED` 后的注销（场景层调用 T2 的 `despawn`） |
| 攻击前摇的占位期表现 | 感知状态指示物的占位期表现（`system-enemy-ai` R2） |

**本 spec 绝不直接修改 FSM 状态。** 对 AI 的全部影响只经两个刺激入口（`reportDamage` / `reportNoise`），且由场景层转发。

**本 spec 绝不直接修改混乱值。** 不调用 `ChaosSystem.addChaos()`，只 emit 正确的事件（T3 规则 6 已把 `ENEMY_DAMAGED` 接到 `COMBAT_BONUS`）。

---

## 平衡不变量（硬约束，QA 应作为断言检查）

| # | 不变量 | 现值 | 为什么 |
| - | ------ | ---- | ------ |
| K1 | `ENEMY_MAX_HEALTH` 是 `PLAYER_DAMAGE` 的整数倍 | 75 = 25 × 3 | 击杀刀数必须是确定的整数。"差一点没死"是随机性，破坏纪律 1 的可计算性 |
| K2 | `AI_STANDOFF_DISTANCE` < `ENEMY_ATTACK_RANGE` < `ATTACK_RANGE` | 30 < 38 < 40 | 敌人站定后**能**打到你（否则接敌无意义）；玩家的够得着范围略大（否则出手必然互换伤害，战斗从"权衡"退化为"血量兑换"） |
| K3 | `ENEMY_ATTACK_WINDUP_MS` > 玩家脱出所需时间 | 350 ms @ 160 px/s = 56 px > (38 − 30) | 前摇必须长到"看到它抬手就能退出去"。这是"可控"的物理保证 |
| K4 | 单次遭遇的混乱值成本 > 等待一个巡逻窗口的成本 | ≈19–25 > 12–16 | 潜行优先的数值保证（见"为什么潜行仍然更划算"） |
| K5 | 玩家满血能承受的敌人攻击次数 ≥ 6 | 100 ÷ 15 = 6.67 | 一次误判不致死。死亡必须是"连续犯错"的结果，否则玩家会因恐惧而完全放弃战斗选项，"可选"落空 |
| K6 | 战斗不新增任何混乱值写入路径 | — | 混乱值的单一真相在 T3。本 spec 只 emit 事件 |

---

## 状态模型

```typescript
/** 玩家攻击阶段。冷却从挥击输入的那一刻起算，与 recovery 并行 */
type AttackPhase = 'idle' | 'windup' | 'active' | 'recovery';

/** 玩家战斗状态（本 spec 拥有；移动字段见 T1 的 PlayerMovementState） */
interface PlayerCombatState {
  health: number;              // 0..maxHealth
  maxHealth: number;           // 100
  isDead: boolean;

  phase: AttackPhase;
  phaseTimerMs: number;        // 当前阶段已经过的时间
  attackAngle: number;         // 弧度。**按下攻击键的瞬间锁定**，整次挥击不再改变
  attackOrigin: Vector2;       // 判定原点，每帧跟随玩家（预分配，不在循环内 new）
  cooldownRemainingMs: number; // 0 时才允许下一次挥击
  /** 本次挥击已命中的敌人 id（预分配 Set，挥击结束时 clear，不重建） */
  hitSet: Set<string>;

  invulnRemainingMs: number;   // 受击无敌帧
  flashRemainingMs: number;    // 白闪剩余
}

/** 单个敌人的战斗状态（本 spec 拥有；位姿/FSM 见 T2 的 EnemyAIState） */
interface EnemyCombatState {
  id: string;                  // 与 T2 的 EnemySpawnData.id 同源
  health: number;
  maxHealth: number;           // 75
  alive: boolean;

  attackPhase: 'idle' | 'windup' | 'cooldown';
  attackTimerMs: number;
  attackAngle: number;         // 前摇开始瞬间锁定的出手方向
  cooldownRemainingMs: number;
  engagedSinceMs: number;      // 进入 engaged 后经过的时间，用于首次出手延迟
  flashRemainingMs: number;    // 受击白闪
}

/** 战斗系统全局状态 */
interface CombatSystemState {
  enabled: boolean;            // 出击结束 / 玩家死亡后置 false，忽略一切输入与伤害
  attackTokensInUse: number;   // 当前处于 windup 的敌人数，上限 ENEMY_ATTACK_TOKENS
  enemies: Map<string, EnemyCombatState>;
}

/** 场景层注入的钩子。战斗系统不 import AISystem，噪声经此回调转发 */
interface CombatHooks {
  /** 场景层实现为一行：ai.reportNoise(pos, radius, level) */
  onNoise(pos: Readonly<Vector2>, radius: number, level: 'suspicious' | 'alert'): void;
}
```

---

## 规则

### A — 玩家攻击

**A1｜输入**：按 `ATTACK_KEY`（**空格**）挥击一次。**按键读取归 RiftScene**（与 T3 的 `E` / `R` 一致），场景层调用 `CombatSystem.requestPlayerAttack()`。Player 的输入只负责移动（T1 所有权边界）。
- **不绑定鼠标**。DEC-008 已裁定朝向是键盘驱动的；若把攻击绑到鼠标左键，玩家会立刻形成"鼠标能决定攻击方向"的预期，然后发现不能——这比不给鼠标更糟。
- 按键为**边沿触发**（按下的那一帧算一次），长按不连击。

**A2｜挥击时序**：一次挥击由三段构成，冷却从**输入瞬间**起算并与三段并行。

```
t=0            按下 → phase=windup，锁定 attackAngle，冷却开始计时（500 ms）
t=100 ms       phase=active，开始命中判定
t=150 ms       phase=recovery，判定结束
t=220 ms       phase=idle，自身减速解除
t=500 ms       冷却结束，可再次挥击
```

**A3｜朝向锁定**：`attackAngle` 在按下瞬间采样 `Player.getFacingAngle()` 并**锁死**。挥击过程中玩家改变朝向不改变这一刀的方向。
- 理由：挥击必须是一次**承诺**。允许中途转向会让"面向错误"这个操作失误消失，玩家不再需要在出手前决定站位，而站位决策正是战斗"可控"的全部内容。

**A4｜命中判定（前向扇形）**：在 `active` 窗口内每帧对所有存活敌人求值，命中条件为三条同时成立：

```
① d = |enemyPos − attackOrigin| ≤ ATTACK_RANGE(40)
② |angleDiff(atan2(enemy − origin), attackAngle)| ≤ ATTACK_HALF_ANGLE(60°)   // 张角 120°
③ hasLineOfSight(occluders, attackOrigin, enemyPos) === true
```

- **为什么用扇形而不是前方矩形**：矩形在最大距离上的横向宽度与贴身处相同，会出现"贴着我侧面站着却打不到"（近处太苛刻）和"斜前方 40 px 外还能被扫到"（远处太宽松）两种同时存在的别扭。扇形的宽容度随距离自然收敛，且与 T1 的视野锥、T2 的感知锥用的是同一种几何语言——玩家已经在用"锥形"理解这个游戏的空间。
- **距离按中心点算**，不做 body 半径展开。`ATTACK_RANGE = 40` 对 20 px 的碰撞体意味着实际可及边缘约 1.5 tile，读起来是"一臂距离"。
- **③ 是硬性的**：不允许隔墙砍。玩家和敌人被同一套遮挡规则约束（T2 的 P3 已为感知确立这条纪律，战斗必须一致），否则玩家会发现"墙后能砍到它但它看不到我"这种支配性策略。
- 单次挥击每帧最多 `MAX_ACTIVE_ENEMIES`(8) 次距离比较 + 至多几次射线，且只在 `active` 的 50 ms 内发生（约 3 帧），开销可忽略。**先做距离与角度筛选，通过后才投射线**。

**A5｜可命中多个敌人**：扇形内所有敌人**同时被命中**，各自独立结算并各自 emit 一次 `ENEMY_DAMAGED`。`hitSet` 保证同一敌人在同一次挥击中最多被结算一次（防止 active 窗口跨多帧重复命中）。
- 后果要说清楚：命中两个敌人 = **两份** `COMBAT_BONUS`（T3 收 10 点）+ 两个敌人立即 CHASE。同时打两个不是效率，是双倍账单。这是刻意的——它让"被围住时乱挥"变成最贵的选择。

**A6｜出手僵直（战斗代价的第三条腿，落在手感而非数值上）**：从 `windup` 开始到 `recovery` 结束（共 `ATTACK_SLOW_MS = 220 ms`），调用 `Player.setSpeedModifier('attack', ATTACK_SELF_SLOW = 0.35)`；结束时 `clearSpeedModifier('attack')`。
- 这 220 ms 是玩家在 30–40 px 距离上**站着不能跑**的时间，也是敌人 350 ms 前摇能否被躲开的实际约束条件。它让"打完就跑"不是免费的。
- 死亡 / `setEnabled(false)` / 场景 shutdown 时必须 `clearSpeedModifier('attack')`，否则玩家会被永久减速（**最容易漏的 bug，QA 专项检查**）。

**A7｜空挥不计混乱值代价**：未命中任何敌人的挥击**不 emit `ENEMY_DAMAGED`**，因此 T3 不加任何混乱值。代价挂在"制造了真实冲突"上，不惩罚误操作（与 T3 规则 6 一致）。
- 但空挥**仍然有声音**（见 A8）。"不计代价"的准确含义是"不计混乱值代价"，不是"世界对此毫无反应"。挥空一刀把附近的敌人惊得停下转身，是合理且可学习的后果，也让"试探性乱挥"自然地不划算。

**A8｜噪声（战斗代价的第二条腿）**：每次挥击结算完毕后，按下表调用注入的 `hooks.onNoise(...)`，由场景层转调 `AISystem.reportNoise(pos, radius, level)`。

| 触发 | 位置 | 半径 | 等级 | 语义 |
| ---- | ---- | ---- | ---- | ---- |
| 挥击（无论是否命中） | 玩家位置 | `NOISE_SWING_RADIUS` = 96 px（3 tile） | `suspicious` | 附近敌人停下、转过来查看 |
| 命中（本次挥击至少命中 1 个） | **被命中敌人的位置** | `NOISE_HIT_RADIUS` = 160 px（5 tile） | `alert` | 附近敌人进入搜索，路线被封 |
| 击杀 | 死亡敌人的位置 | `NOISE_KILL_RADIUS` = 192 px（6 tile） | `alert` | 同上，范围更大 |

- **同一次挥击最多产生一次挥击噪声 + 一次命中噪声 + 每个击杀一次击杀噪声**。命中噪声只发一次（取第一个被命中敌人的位置），不按命中数叠加——`reportNoise` 是范围广播，重复调用只是重复遍历。
- **命中噪声用 `alert` 而不是 `suspicious` 是有意的**：这是让战斗"更吵"的主要机制。`alert` 会让半径内的敌人经 T2 的 E1 发出 `ENEMY_ALERT{alert}`，T3 据此每个敌人加一次 `DETECTION_BONUS`(3)。在敌人密集处开打的账单会显著高于孤立处——这正是希望玩家学到的地理知识。
- 三个半径都是 **`待校准`**。若试玩显示"在任何地方开打都会滚雪球成全图警报"，第一个要调的是 `NOISE_HIT_RADIUS`（降到 96–128），而不是削弱玩家伤害。

**A9｜敌人受击结算**：命中一个敌人时，按顺序执行：

```
① enemy.health −= PLAYER_DAMAGE(25)（无随机、无暴击、无浮动 —— 纪律 1）
② 触发敌人受击白闪（ENEMY_HIT_FLASH_MS = 80 ms）
③ emit ENEMY_DAMAGED { enemyId, amount: 25 }
④ 若 health ≤ 0 → 走 A10 死亡流程；否则场景层监听 ③ 后调用 ai.reportDamage(enemyId, playerPos)
```

- ③ 的两个消费方：T3（加 `COMBAT_BONUS`）与场景层（转调 `reportDamage`，使该敌人立即 CHASE，`detection = 1.0`）。**被打了不需要"确信"**（T2 的 T0 优先级 1）。
- **死亡的敌人不再 `reportDamage`**（它马上就要被 despawn，把它推进 CHASE 只会产生一次无意义的状态转换与事件）。

**A10｜敌人死亡**：

```
① enemy.alive = false，立即从战斗判定中移除（同帧内不再能被命中，也不再能出手）
② 若该敌人正处于 windup，释放它占用的 attack token（A13）
③ emit ENEMY_KILLED { enemyId, position }
④ hooks.onNoise(deathPos, NOISE_KILL_RADIUS, 'alert')
⑤ 场景层监听 ③ → 调用 ai.despawn(enemyId)（T2 负责取消其寻路请求、清残影、按需补发 ENEMY_LOST_PLAYER）
⑥ 播放死亡表现（ENEMY_DEATH_FX_MS = 180 ms），走对象池，与实体注销解耦
```

- **逻辑上的移除是立即的，视觉上的消散是异步的**。绝不允许"尸体还能挡刀"或"死了还在追我"。
- `ENEMY_KILLED` 的第三个关键消费方是 T3：它必须把该 id 从 `chasingEnemies` 移出，否则速率倍率会永久卡在 2.0（T3 已把这条标为"最容易漏的 bug"）。
- **Slice 1 无尸体、无掉落**。渗透体不掉薪柴——薪柴是"两种污染模式冲突的残渣"（`world.md`），不是战利品；让敌人掉薪柴会立刻把战斗从"止损工具"变成"收益来源"，直接推翻本 spec 的全部定位。

### E — 敌人攻击

**E1｜出手的唯一前提是本 spec 自己的判断**。T2 只负责把敌人停在 `AI_STANDOFF_DISTANCE`(30 px) 上并保持面向玩家，然后置 `isEngaged() = true`。本系统每帧对每个存活敌人求值：

```
可以起手 ⟺ enabled
        && enemy.alive && !player.isDead
        && ai.getEnemyById(id).isEngaged() === true
        && d ≤ ENEMY_ATTACK_RANGE(38)
        && |angleDiff(敌人朝向, 敌人→玩家)| ≤ ENEMY_ATTACK_HALF_ANGLE(60°)
        && hasLineOfSight(occluders, enemyPos, playerPos)
        && cooldownRemainingMs ≤ 0
        && engagedSinceMs ≥ ENEMY_FIRST_ATTACK_DELAY_MS(300)
        && attackTokensInUse < ENEMY_ATTACK_TOKENS(2)
```

- **查询式，不是事件式**（回应 T2 escalate 项 2b：本 spec **接受** `isEngaged()` 作为查询接口）。攻击时机是每帧连续判断的，走事件总线只会制造无意义的 emit 流量。
- **首次出手延迟 300 ms**：敌人刚贴上来的那一瞬间不出手。没有这条，"被追上"和"被打中"是同一件事，玩家失去最后的反应机会。

**E2｜前摇是"可控"的物理保证**：起手后进入 `windup`，持续 `ENEMY_ATTACK_WINDUP_MS`(350 ms)，锁定 `attackAngle`（朝向玩家当时的方位）。**伤害在前摇结束的那一瞬间结算一次**，条件重新求值：

```
命中 ⟺ d ≤ ENEMY_ATTACK_RANGE(38)
     && |angleDiff(锁定的 attackAngle, 敌人→玩家)| ≤ ENEMY_ATTACK_HALF_ANGLE(60°)
     && hasLineOfSight(occluders, enemyPos, playerPos)
     && !player.isInvulnerable()
```

- 前摇期间玩家退到 38 px 之外、绕到锁定角之外、或退到墙后 → **落空**。落空不扣血、不发任何事件、照常进入冷却。
- 350 ms 在玩家满速 160 px/s 下可移动 56 px，远大于 38 − 30 = 8 px 的脱出需求（不变量 K3）。但 A6 的出手僵直（220 ms × 0.35 倍速）会吃掉这个窗口的大部分——**这就是"打完这一刀"和"退出去"之间的取舍**，是战斗中唯一需要即时操作的决策点。
- 前摇**不可被打断**。玩家在敌人前摇期间砍它，不会取消它的攻击（除非砍死）。没有打断机制是刻意的：加入打断会让"抢攻"成为支配性策略，战斗从"要不要打"变成"怎么打得好"，与定位不符。

**E3｜冷却**：一次出手（无论命中与否）结束后进入 `cooldown`，持续 `ENEMY_ATTACK_COOLDOWN_MS`(1200 ms)，期间不再起手。冷却与 FSM 无关，敌人在冷却中照常由 T2 保持站位。

**E4｜玩家受击结算**：

```
① player.health −= ENEMY_DAMAGE_BASE(15)（同样无随机）
② player.invulnRemainingMs = PLAYER_IFRAME_MS(400)
③ 触发白闪（PLAYER_HIT_FLASH_MS）
④ emit PLAYER_DAMAGED { amount: 15, source: enemyId }
⑤ emit PLAYER_HEALTH_CHANGED { current, max: 100 }
⑥ 若 health ≤ 0 → 走 E6 死亡流程
```

- **④ 与 ⑤ 都要发，顺序固定**。`PLAYER_DAMAGED` 是"发生了一次伤害事件"（音频/受击特效/未来的护甲系统消费），`PLAYER_HEALTH_CHANGED` 是"当前血量变成了多少"（HUD 消费，T3 规则 30 已声明依赖）。两者不可互相替代——前者不含总量，后者不含单次伤害归因。
- **`PLAYER_DAMAGED.source` 定义为 `enemyId`**（如 `'ENM_INF_01'`）。events.ts 里 `source: string` 没有语义说明，本 spec 作为该事件的拥有者在此定为 enemyId 而非 `'enemy'` 这类分类字符串——归因信息一旦丢失就补不回来。

**E5｜无敌帧**：受击后 400 ms 内免疫一切伤害。
- 目的是防止多敌人同帧叠伤（两个敌人的前摇恰好同时结束 = 30 点伤害，玩家无从归因也无从躲避）。
- 400 ms 略短于敌人冷却 1200 ms 的三分之一，不会让单敌人战斗变得免伤。
- 无敌帧**不提供视觉提示**（不做闪烁）。白闪已经占据了这个信息位；再加一层"我现在无敌"的提示会诱导玩家主动去吃伤害换突进，那是动作游戏的语法，不是本游戏的。

**E6｜玩家死亡**：

```
① health 钳制为 0，isDead = true
② emit PLAYER_HEALTH_CHANGED { current: 0, max: 100 }   ← 必须先发，HUD 要显示空条
③ emit PLAYER_DIED { cause: 'enemy_attack' }
④ setEnabled(false)：清空所有敌人的 windup、释放 attack token、clearSpeedModifier('attack')
⑤ 后续一切伤害被忽略；PLAYER_DIED 一次出击内只发一次（isDead 守卫）
```

- **本 spec 到此为止**。输入冻结、结算面板、薪柴清零、混乱值冻结全部归 T3 的 `RunController`（它监听 `PLAYER_DIED` 走死亡结束路径），本系统不碰。
- 场景层同时监听 `PLAYER_DIED` → 调用 `ai.onPlayerLost()`（T2 契约）。
- `cause` 的取值在 Slice 1 只有 `'enemy_attack'`。未来的取值（环境伤害、混乱值致死等）应在此处扩充枚举而不是自由字符串。

**E7｜攻击与感知无关**：敌人出手不改变自己的 FSM 状态、不改变 `detection`、不发 `ENEMY_ALERT`。它已经在 CHASE 里了，攻击只是 CHASE 的一个子行为的结果。

### H — 生命值

**H1｜出击内不可恢复**。Slice 1 没有治疗物品、没有回血机制、没有随时间再生。`world.md` 的机制约束支持这一点（玩家在异时空只有有限抗性，没有"异时空内的恢复手段"这种东西）。
- 这是本系统最强的约束力来源：生命值是**跨整局累积的**唯一资源，每一次挨打都会永久缩小后半局的战斗预算。

**H2｜每次出击开始回满**。进入裂隙（`RIFT_ENTERED`）或按 R 重开时 `health = maxHealth = 100`，并**立即 emit 一次 `PLAYER_HEALTH_CHANGED { 100, 100 }`** 让 HUD 初始化。
- 血量不跨局继承。Slice 1 没有净化点场景，跨局血量会让"上一局运气不好"污染下一局的验证数据。

**H3｜死亡阈值是 `health ≤ 0`**，不是 `< 0`。

### V — 受伤与命中的视觉（占位期即必须成立）

**V0｜为什么这节是规则**：如果玩家分不清"我打中了"和"我挥空了"，或者感觉不到自己在掉血，那么 K4 那张价目表对玩家而言就不存在——他无法把代价和自己的操作联系起来，于是既学不会潜行更划算，也学不会怎么躲。**反馈是本系统代价机制的传导线，不是装饰。**

**V1｜受伤 = 整体白闪，不加红色**（art §5.1）。玩家与敌人使用同一套表现：sprite 整体以纯白覆盖 `HIT_FLASH_MS`，然后恢复。**不改变颜色、不叠红、不做血液**——保持 art §13.1 的色温纪律（暖色 = 人类侧 / 冷色 = 污染侧，红色不属于任何一侧，一旦引入就会污染整套色彩语言）。

**V2｜占位期表现清单**（art §12 的色彩编码协议内）：

| 事件 | 占位表现 | 时长 |
| ---- | -------- | ---- |
| 玩家挥击 | 以玩家为心、`attackAngle` 为轴、`ATTACK_RANGE` 为半径的 **1px 白色扇形描边**（不填充） | 与 `active` 同步，60 ms |
| 玩家命中敌人 | 该敌人整体白闪 | 80 ms |
| 敌人死亡 | 白闪一次后本体 alpha 180 ms 内降到 0（不做碎裂粒子） | 180 ms |
| 敌人攻击前摇 | 从敌人中心沿其 `attackAngle` 画一条 **1px 白色短线**，长度 = `ENEMY_ATTACK_RANGE`，alpha 随前摇进度 0.2 → 0.8 | 350 ms |
| 敌人出手瞬间 | 短线闪至 alpha 1.0 后一帧内消失 | 1 帧 |
| 玩家受伤 | 玩家 sprite 整体白闪 | `HIT_FLASH_MS` |

- **白色在占位期被赋予"攻击/受击"语义**，与 T2 的 teal 指示物（感知状态）正交：**teal = 它在想什么，白 = 它在做什么**。玩家不需要记颜色梯度，只需要记这两个通道。
- art §12 现有编码里白色 = 玩家 / 撤离点。这里的扩展是"白色**细线/闪光**表示攻击动作"，与"白色**实心块**表示玩家"在形状上可区分，但仍需 art agent 确认（见 escalate ①）。

**V3｜不做屏幕震动、不做命中停顿（hitstop）、不做伤害数字**。三者都是"让战斗更爽"的工具，与本系统"让战斗读起来昂贵"的目标相反。屏幕震动还会与 T1 的视野遮罩、混乱值的全屏微闪叠加成一团糊。留给后续 Slice 的打磨阶段重新评估。

**V4｜不做击退**。敌人的位置归 T2，击退需要本 spec 写敌人位移，会与 T2 的 B4 接敌站位维持逻辑打架（它每帧都在把距离拉回 26–34 px），结果是敌人被打退后立刻弹回来的橡皮筋抖动。

**V5｜敌人在视野外仍可攻击你，但看不见**（T2 的 R4：敌人在视野外完全不渲染）。这意味着玩家可能被一个看不见的敌人打中——白闪 + `PLAYER_DAMAGED` 的音频钩子是此时唯一的信息源。这是有意的恐怖体验，与 T2 escalate 项 3 是同一个待验证赌注；若人判定过于挫败，修正应在 T2 侧（给 CHASE 态敌人视野外泄露），不在本 spec 加提示。

**V6｜音频钩子**：本 spec 向场景层提供 cue id（`combat.cue.swing` / `combat.cue.hit` / `combat.cue.enemyDeath` / `combat.cue.enemyWindup` / `combat.cue.playerHurt`），**不设计音频内容**（归 audio-direction）。`combat.cue.enemyWindup` 优先级最高——它是 V5 场景下玩家唯一的预警。

---

## 玩家交互

- **输入**：

  | 操作 | 键位 | 效果 |
  | ---- | ---- | ---- |
  | 挥击 | `空格` | 朝当前朝向挥一刀（锁定方向）；冷却 500 ms；出手期间自身减速 |
  | 躲避 | 无专用键 | 用移动躲。看到敌人前摇的白线就往后退 / 绕到线的侧面 |

  没有格挡键、没有翻滚键、没有武器切换。玩家在战斗中能做的决策只有三个：**打不打、站在哪、什么时候退**。这正好是"可选、有代价、可控"三个词各对应一个。

- **反馈**：

  | 玩家状态 | 系统响应 |
  | -------- | -------- |
  | 挥空 | 白色扇形一闪，什么也没发生；附近敌人停下转身（挥击噪声） |
  | 命中 | 敌人白闪；混乱值条可见跳 +5；该敌人立刻转为追击（T2 的 teal 三角常亮） |
  | 第三刀 | 敌人白闪后消散；混乱值条再跳一次；周围敌人开始搜索（击杀噪声） |
  | 敌人抬手 | 一条白线从它身上指向你，越来越亮——**0.35 秒的撤退窗口** |
  | 被打中 | 全屏内玩家 sprite 白闪；左上生命值条掉一格；400 ms 内不会再挨打 |
  | 血量见底 | 生命值条空 → 结算面板「出击失败」，带出薪柴 0（T3 规则 26） |

---

## 数值结构（可调参数表）

> **状态列**：`既有constants` = 沿用 `src/config/constants.ts` 现值，未改动；`建议值` = 本 spec 给出的有依据初值，**需人试玩校准**；`技术定` = 技术/结构性取值，无需人拍板；`art定` = 来自 `art-direction.md`；`架构定` = 来自 `architecture.md`。
> 实现时全部集中进 `src/config/constants.ts` 的 `COMBAT` 段（表中 `X` 即 `GAME_CONSTANTS.COMBAT.X`），不散落在系统内部。

### 玩家攻击

| 参数 | 含义 | 初值 | 合理范围 | 对手感/博弈的影响 | 状态 |
| ---- | ---- | ---- | -------- | ----------------- | ---- |
| `PLAYER_DAMAGE` | 单次挥击伤害 | 25 | — | 与敌人 HP 联动决定刀数。**调平衡时优先调敌人 HP 而不是这个数**，以保持"整数刀"（不变量 K1） | 既有constants |
| `ATTACK_COOLDOWN` | 挥击冷却（从输入起算） | 500 ms | 400–800 | 决定三刀击杀的总时长（约 1.1 s）。调高会让战斗更像"承诺"，但超过 800 ms 会读作卡顿 | 既有constants |
| `ATTACK_RANGE` | 挥击半径（中心到中心） | 40 px | 32–56 | **必须 > `ENEMY_ATTACK_RANGE`**（不变量 K2）。调大让 poke 打法可行，战斗变便宜 | 既有constants |
| `ATTACK_HALF_ANGLE` | 扇形半角 | 60°（张角 120°） | 45–90 | 越大越宽容、越容易一刀扫俩（= 双倍账单）；<45° 会让"面向"变成需要精确操作的负担 | 建议值（待校准） |
| `ATTACK_WINDUP_MS` | 前摇 | 100 ms | 50–200 | 玩家侧的承诺成本。>200 ms 会读作输入延迟 | 建议值 |
| `ATTACK_ACTIVE_MS` | 判定窗口 | 50 ms | 33–100 | 约 3 帧。窗口存在只是为了容忍帧率抖动，不是为了扩大判定 | 技术定 |
| `ATTACK_RECOVERY_MS` | 后摇 | 70 ms | 0–150 | 与前摇共同构成僵直总长 | 建议值 |
| `ATTACK_SLOW_MS` | 自身减速总时长 | 220 ms（= 100+50+70） | — | 派生值，不独立调 | 技术定 |
| `ATTACK_SELF_SLOW` | 出手期间移速倍率 | 0.35 | 0.2–0.7 | **战斗"有代价"落在手感上的那条腿**。=1.0 则打完就能跑，战斗变得几乎免费；<0.2 则读作被定身 | 建议值（待校准） |
| `ATTACK_MIN_ANGLE_BYPASS` | 忽略角度判定的贴身距离 | 16 px | 8–24 | 玩家与敌人几乎重叠时 `θ` 无意义，直接判命中 | 技术定 |
| `ATTACK_KEY` | 攻击键 | `空格` | — | 与 T3 的 `E`（撤离）/ `R`（重开）无冲突 | 建议值 |

### 敌人（渗透体）

| 参数 | 含义 | 初值 | 合理范围 | 对手感/博弈的影响 | 状态 |
| ---- | ---- | ---- | -------- | ----------------- | ---- |
| `ENEMY_MAX_HEALTH` | 渗透体生命值 | **75（= 三刀）** | 50–125（须为 25 的整数倍） | **本 spec 最需要校准的数**。两刀（50）会让战斗过于便宜、潜行失去优势；四刀（100）会让每次遭遇的账单翻到约 27 混乱值 + 更多挨打，玩家可能彻底放弃战斗选项，"可选"落空。三刀是"一次真正的交手"的最小规模 | **建议值（待校准）** |
| `ENEMY_DAMAGE_BASE` | 敌人单次伤害 | 15 | 10–25 | 满血可承受 6 次（不变量 K5）。调到 25 时只能挨 4 次，误判容错急剧下降 | 既有constants |
| `ENEMY_ATTACK_RANGE` | 敌人出手距离 | 38 px | 30–40 | **必须在 `AI_STANDOFF_DISTANCE`(30) 与 `ATTACK_RANGE`(40) 之间**（K2）。取 38 意味着"能打到它的地方基本就是它能打到你的地方"——这是战斗必须付出血量的几何保证。降到 32 会开放 poke-kite 打法，让战斗变便宜 | 建议值（待校准） |
| `ENEMY_ATTACK_HALF_ANGLE` | 敌人出手扇形半角 | 60° | 45–90 | 与玩家对称。T2 的 B4 保证它面向玩家，所以这个数主要决定"绕到侧面"能不能躲 | 建议值 |
| `ENEMY_ATTACK_WINDUP_MS` | 前摇（**玩家的躲避窗口**） | **350 ms** | 250–600 | **"可控"的总控**。<250 ms 玩家来不及反应（叠加 220 ms 出手僵直后几乎不可能躲）；>600 ms 敌人读作迟钝，战斗失去威胁 | **建议值（待校准）** |
| `ENEMY_ATTACK_COOLDOWN_MS` | 出手间隔 | **1200 ms** | 800–2000 | 决定"站在它面前"每秒的血量支出。1200 ms 下三刀击杀期间（1.1 s）玩家通常只挨 1 下。降到 800 ms 会让三刀击杀必挨 2 下，战斗成本近乎翻倍 | **建议值（待校准）** |
| `ENEMY_FIRST_ATTACK_DELAY_MS` | 接敌后首次出手延迟 | 300 ms | 200–600 | 让"被追上"和"被打中"是两件事。=0 则贴脸瞬间即受击，玩家会觉得被偷袭 | 建议值 |
| `ENEMY_ATTACK_TOKENS` | 允许同时处于前摇的敌人数 | 2 | 1–3 | 防止 3–4 个敌人同帧结算导致的不可躲避秒杀。Slice 1 敌人分散，多数时候不生效；=1 会让围攻明显变软 | 建议值 |
| `ENEMY_HIT_FLASH_MS` | 敌人受击白闪 | 80 ms | 50–150 | "我打中了"的唯一反馈。<50 ms 在 60 Hz 下容易被完全错过 | 建议值 |
| `ENEMY_DEATH_FX_MS` | 死亡消散时长 | 180 ms | 100–400 | 纯表现，逻辑上敌人已在第 0 ms 移除 | 建议值 |

### 污染句法核与非血条接触（DEC-076 / DEC-077）

甲继续用上表。乙 / 丙 / 丁的核与混乱价只锁在句法 spec 数值结构；本 spec 拥有 HP 事件与挥击命中核。`GAME_CONSTANTS.CONTAMINATION` 已接：

- 核 HP 50（两刀，K1 仍成立）。
- 乙邻格抽打：伤害 15、前摇 350 ms；玩家必须站在 `strikeFloors` 才付血；挥击必须打到缝核。
- 丙踩踏、丁体积：不打玩家血，走 `ChaosSystem.addChaos`。清核仍 emit `ENEMY_DAMAGED`（source `'player'`）从而付战斗混乱 5。
- 打核驱散 = 核 HP 到 0，走既有 `ENEMY_KILLED`。漆/体积残骸不挡路。

### 接触词素 → 伤害通道（DEC-080 / R2-D1，指针）

通道定义以句法 spec「接触词素对照表」为准。本 spec **不复制**第二份价目表。乙抽打 15 / 前摇 350 ms、丁 +1.0 混乱/秒与视野 ×0.7、甲三刀账，仍只锁在句法 spec 数值结构与本 spec 甲表。

| 兑现处 | 怎么读接触 |
| ------ | ---------- |
| 练习场句法课，`gymLiveMotion === true` | 读 `lexemes.contact`，按句法对照表走打血 / 混乱 / 视野 / 仅驱散核 |
| 出击（本轮） | 仍按宿主 kind 硬编码：甲扇形打血、乙邻格打血、丙踩踏混乱、丁体积混乱+视野。不因新基体改出击通道 |

概念基体三类在丁上仍走体积场，不发明精神攻击，不给丁开打血。非法词素沿用既有 `rewrite_to`，不加 DPS 词缀。

**成功标准不推翻：** 如果试玩者开始享受战斗，本系统就失败了。绕仍应比打更划算。

**V3 不推翻：** 无震屏、无命中停顿、无伤害数字。攻击发生时可见 = 危险区可见 + 敌人出手相 + 玩家既有白闪。练习场可关无敌才能看见掉血。

### 玩家生命值与受击

| 参数 | 含义 | 初值 | 合理范围 | 对手感的影响 | 状态 |
| ---- | ---- | ---- | -------- | ------------ | ---- |
| `PLAYER.MAX_HEALTH` | 玩家生命上限 | 100 | 75–150 | 6.67 次挨打。这个数与 `ENEMY_DAMAGE_BASE` 的比值（不变量 K5）比它本身更重要 | 既有constants |
| `PLAYER_IFRAME_MS` | 受击无敌帧 | 400 ms | 250–600 | 防多敌人同帧叠伤。>600 ms 会让围攻明显变软，"被围住很危险"这个认知失效 | 建议值 |
| `PLAYER_HIT_FLASH_MS` | 玩家受击白闪 | 100 ms | 33–200 | art §5.1「1-2 帧」按 12 fps 动画帧解读 ≈ 83–166 ms。若按 60 fps 渲染帧解读则为 33 ms，在 60 Hz 显示器上极易被完全错过（见 escalate ①） | art定（口径待确认） |

### 噪声（战斗代价的暴露侧）

| 参数 | 含义 | 初值 | 合理范围 | 对博弈的影响 | 状态 |
| ---- | ---- | ---- | -------- | ------------ | ---- |
| `NOISE_SWING_RADIUS` | 挥击噪声半径（`suspicious`） | 96 px（3 tile） | 64–160 | 让空挥也有后果但不致命。调大会让"试探性挥击"变得极贵 | **建议值（待校准）** |
| `NOISE_HIT_RADIUS` | 命中噪声半径（`alert`） | 160 px（5 tile） | 96–224 | **战斗"更吵"的主要机制**。每个被惊动的敌人经 T3 加 3 点混乱值并封锁路线 5 s。若试玩出现"一开打就全图警报"的雪球，**第一个调这个数** | **建议值（待校准）** |
| `NOISE_KILL_RADIUS` | 击杀噪声半径（`alert`） | 192 px（6 tile） | 128–288 | 击杀比命中更响。让"清场"策略在敌人密集区自我惩罚 | **建议值（待校准）** |

### 由其他 spec 拥有、本 spec 只依赖的数值

| 参数 | 值 | 拥有者 | 本 spec 的依赖点 |
| ---- | -- | ------ | ---------------- |
| `AI_STANDOFF_DISTANCE` | 30 px | T2 | 不变量 K2 的下界；敌人站定后必须落在 `ENEMY_ATTACK_RANGE` 内 |
| `MOVE_SPEED` / `AI_CHASE_SPEED` | 160 / 130 | T1 / T2 | K3 的脱出可行性；"打不过就跑"是否成立 |
| `CHAOS.COMBAT_BONUS` | 5 | T3 | 命中的混乱值单价。**平衡战斗成本时优先调它，而不是削弱玩家伤害**（T3 已明确此优先级） |
| `CHAOS.DETECTION_BONUS` | 3 | T3 | 噪声惊动邻居的连带成本 |
| `MAX_ACTIVE_ENEMIES` | 8 | T2 | 命中枚举与攻击 token 的规模上界 |
| `AI_DT_CLAMP_MS` | 100 ms | T2 | 本 spec 的所有计时器采用同一钳制，避免切标签页后前摇瞬间结算 |

---

## Schema（对外接口契约）

```typescript
/** Player 的战斗部分。与 T1 的 PlayerMovementAPI 同为 Player 实体的两个切面 */
interface PlayerCombatAPI {
  getHealth(): number;
  getMaxHealth(): number;
  isDead(): boolean;
  isInvulnerable(): boolean;
  getAttackState(): Readonly<{ phase: AttackPhase; cooldownRemainingMs: number }>;
}

interface CombatSystemAPI {
  create(
    scene: Phaser.Scene,
    occluders: OccluderGrid,      // T1 契约，用于 hasLineOfSight
    ai: AISystemReadView,         // 只读视图：getEnemies / getEnemyById（见下）
    hooks: CombatHooks,           // 噪声转发回调，由场景层实现
  ): void;

  /** 每帧调用。推进玩家挥击时序、敌人出手时序、无敌帧、白闪 */
  update(deltaMs: number): void;

  /** 场景层在攻击键按下的那一帧调用。冷却中/已死亡/未启用时无副作用 */
  requestPlayerAttack(): void;

  // —— 查询 ——
  getEnemyHealth(enemyId: string): number | undefined;
  isEnemyAlive(enemyId: string): boolean;

  // —— 生命周期 ——
  /** 出击结束 / 玩家死亡时置 false：忽略输入与伤害、清空敌人前摇、清除 'attack' 移速调制 */
  setEnabled(enabled: boolean): void;
  /** 按 R 重开：玩家回满血、清空全部敌人战斗状态、重建敌人 HP 表 */
  reset(): void;
  destroy(): void;
}

/**
 * 本 spec 只需要 T2 的三个只读能力。
 * 声明为窄接口而不是直接依赖 AISystemAPI，是为了在类型层面固化
 * "战斗不能改 FSM" 这条约束 —— reportDamage / despawn 不在这个视图里。
 */
interface AISystemReadView {
  getEnemies(): readonly EnemyView[];
  getEnemyById(id: string): EnemyView | undefined;
}
```

### 敌人战斗数据（Slice 8：两种敌人共用本切面）

Slice 8 改写体的潜行差异在 `system-enemy-ai` 感知剖面。**HP / 伤害 / 前摇沿用渗透体本表**，本 Slice 不另开战斗数值。

```typescript
/** 渗透体的战斗侧配置。与 T2 的 InfiltratorConfig 并列，同一 type 的两个切面 */
interface InfiltratorCombatConfig {
  type: 'infiltrator';
  maxHealth: number;            // 75
  damage: number;               // 15
  attackRange: number;          // 38
  attackHalfAngle: number;      // 60（度）
  windupMs: number;             // 350
  cooldownMs: number;           // 1200
  firstAttackDelayMs: number;   // 300
}
```

**内容条目**（Slice 1 唯一条目，叙事文本遵守 `world.md` 命名与语调规则）：

| id | name | 描述文本 | HP | 伤害 |
| -- | ---- | -------- | -- | ---- |
| `ENM_INFILTRATOR` | 巡视渗透体 | `有机基体，低度覆盖。接触距离内具备攻击能力。` | 75 | 15 |

（描述文本为陈述式、无人称、19 字，符合 `world.md` 敌人命名规则「[覆盖程度/行为特征] + [基体类型]」与叙事语调。Slice 1 无图鉴 UI，此文本先备着。）

### 事件契约

**结论：本 spec 需要的五个事件在 `src/types/events.ts` 中全部已存在，payload 均可直接使用。本 spec 不需要新增任何事件。** 这对 T2/T3 是好消息——它们假设存在的事件确实存在。

| 事件 | 现状 | payload（现状） | 本 spec 的定义与补充 |
| ---- | ---- | --------------- | -------------------- |
| `PLAYER_DAMAGED` | ✅ 已存在 | `{ amount: number; source: string }` | 玩家每次实际扣血时发一次（落空/无敌帧内不发）。**`source` = 造成伤害的 enemyId**（本 spec 作为拥有者在此定义语义，建议在 events.ts 补一行注释） |
| `PLAYER_HEALTH_CHANGED` | ✅ 已存在 | `{ current: number; max: number }` | 血量**每次变化**都发，含出击开始的初始化（`{100, 100}`）与死亡时的 `{0, 100}`。HUD（T3 规则 30）唯一的血量数据源 |
| `PLAYER_DIED` | ✅ 已存在 | `{ cause: string }` | 一次出击最多一次。Slice 1 `cause` 唯一取值 `'enemy_attack'`。消费方：T3 的 `RunController`（死亡结束路径）、场景层（转调 `ai.onPlayerLost()`） |
| `ENEMY_DAMAGED` | ✅ 已存在 | `{ enemyId: string; amount: number }` | 每个被命中的敌人各发一次（一刀命中两个 = 两次）。消费方：T3（`COMBAT_BONUS`）、场景层（转调 `ai.reportDamage`）。**建议新增可选字段，见下** |
| `ENEMY_KILLED` | ✅ 已存在 | `{ enemyId: string; position: {x,y} }` | 每个敌人最多一次。消费方：T3（移出 `chasingEnemies`，防止速率倍率永久卡死）、场景层（转调 `ai.despawn`） |

**唯一的建议变更（非破坏性，供 code agent 在 T8 落地）：**

| 变更 | 内容 | 理由 |
| ---- | ---- | ---- |
| `ENEMY_DAMAGED` 新增可选字段 `source?: 'player'` | `{ enemyId: string; amount: number; source?: 'player' }` | **解决 T3 escalate 项 4 记录的风险**。T3 把这个事件当作"玩家攻击命中"的唯一信号并据此加混乱值。Slice 1 里这个假设成立（唯一伤害源是玩家近战），但一旦后续引入环境伤害或敌人互伤，混乱值会被静默误加，且这种 bug 极难从表象定位。加一个可选字段的成本是零，现在加、现在写好注释，比将来发现后回改所有消费方便宜得多。**Slice 1 的 CombatSystem 一律填 `'player'`；T3 可先不过滤** |
| `PLAYER_DAMAGED.source` 加注释 | `// = enemyId，不是分类字符串` | 语义澄清，不改类型 |
| `PLAYER_DIED.cause` 加注释 | `// Slice 1: 'enemy_attack'` | 语义澄清，不改类型 |

### 噪声为什么走注入回调而不是事件

`AISystem.reportNoise` 需要三个来源触发（挥击 / 命中 / 击杀），其中**挥空**没有任何对应事件——它不 emit `ENEMY_DAMAGED`。三个可选方案：

| 方案 | 评价 |
| ---- | ---- |
| **A（采纳）**：场景层 `create` 时注入 `CombatHooks.onNoise`，场景层实现为一行 `ai.reportNoise(...)` | 噪声策略（半径/等级）集中在战斗系统内单一真相；不违反"系统 A 不 import 系统 B"（这是场景层编排，与 T3 的 `getChaosModulators` 由场景层转发是同一先例）；零新增事件 |
| B：新增 `COMBAT_NOISE` 事件 | 需要改 `src/types/events.ts` 的枚举，且这个事件只有一个生产者和一个消费者，走总线纯属绕路 |
| C：场景层监听 `ENEMY_DAMAGED` / `ENEMY_KILLED` 自行生成噪声 | 挥空无法覆盖；且噪声半径会散落在场景层，与本 spec 的参数表脱节，调参时要改两处 |

**采纳 A**。约束：场景层**不得**再从 `ENEMY_DAMAGED` / `ENEMY_KILLED` 二次生成噪声，否则重复广播。（若 Director 认为必须严格事件化，见 escalate ③。）

---

## 边界情况

| 情况 | 处理方式 |
| ---- | -------- |
| 挥击时隔着墙 | `hasLineOfSight` 为 false → 不命中。玩家和敌人对称适用（A4③ / E2） |
| 玩家与敌人几乎重叠（d ≈ 0） | `θ` 无定义 → `d ≤ ATTACK_MIN_ANGLE_BYPASS`(16 px) 时跳过角度判定，直接命中 |
| 一刀命中多个敌人 | 各自独立结算、各发一次 `ENEMY_DAMAGED`、各自 `reportDamage`；命中噪声只广播一次（A8） |
| `active` 窗口跨多帧 | `hitSet` 保证每个敌人每次挥击最多结算一次；挥击结束时 `clear()`（不重建 Set，架构禁止循环内 new） |
| 敌人在玩家 `active` 判定的同一帧死亡 | 先死者先结算；已 `alive = false` 的敌人不再参与后续判定 |
| 敌人在自己的 windup 中被砍死 | 取消其攻击、释放 attack token、不结算伤害 |
| 前摇结束瞬间玩家已退出范围/角度/进墙后 | 落空。不扣血、不发事件、正常进入冷却（这是"可控"的核心，必须实现） |
| 前摇结束瞬间玩家处于无敌帧 | 视为落空，不扣血、不发事件、不刷新无敌帧时长 |
| 两个敌人的前摇同帧结束 | 第一次结算扣血并开启 400 ms 无敌帧，第二次因无敌帧落空。**玩家一次最多掉 15**（E5） |
| 三个以上敌人同时接敌 | `ENEMY_ATTACK_TOKENS`(2) 限制同时前摇数，其余敌人保持站位等待 token 释放 |
| 敌人被 `despawn` 后仍有引用 | `setEnabled` / `reset` / 死亡流程必须从 `enemies` Map、attack token 计数、玩家 `hitSet` 中一并清除 |
| 玩家死亡与敌人死亡同帧 | 各自独立结算；`PLAYER_DIED` 有 `isDead` 守卫，只发一次 |
| 玩家在挥击僵直中死亡 | 立即 `clearSpeedModifier('attack')`，否则重开后玩家仍带 0.35 倍速（**QA 专项检查项**） |
| 出击已结束（T3 的 `runEnded`）但敌人仍在 windup | 场景层在 `endRun` 中调用 `combat.setEnabled(false)`，清空全部 windup。与 T3 规则「runEnded 后忽略 `PLAYER_DIED`」形成双重保护 |
| 撤离结算的 0.6 s 延迟期间被攻击 | 同上，`setEnabled(false)` 已阻断。撤离一旦确认不可撤销（T3 规则 23） |
| 玩家血量恰好归零 | `health ≤ 0` 判死（H3）；`health` 钳制为 0，不显示负数 |
| 切标签页后回来（dt 巨大） | 所有计时器的 dt 钳制到 `AI_DT_CLAMP_MS`(100 ms)，与 T2 一致。防止一帧内前摇+冷却全部走完导致连续结算 |
| 冷却中重复按攻击键 | 无副作用，不排队、不缓存输入。输入缓冲是动作游戏的语法，会鼓励连打 |
| 敌人处于 `engaged` 但 T2 把它拉回 34 px 外 | `d > ENEMY_ATTACK_RANGE` → 不起手；已在 windup 的照常走完（可能落空） |
| 场景 shutdown | `destroy()`：清空 `enemies` Map、`hitSet`、attack token、死亡特效对象池、解绑事件监听、`clearSpeedModifier('attack')`（架构风险表：Phaser 场景切换内存泄漏） |
| 按 R 重开 | `reset()`：血量回满并 emit 初始 `PLAYER_HEALTH_CHANGED`、全部敌人 HP 复原、清空一切计时器与 token。**不要复用旧实例的残留状态** |

---

## 与已有系统的接口

### 从其他系统接收

| 来源 | 接收什么 | 形式 |
| ---- | -------- | ---- |
| `Player`（T1） | `getPosition()`（判定原点）、`getFacingAngle()`（挥击方向） | 同步查询 |
| `utils/grid-raycast`（T1 拥有） | `hasLineOfSight(grid, a, b)` —— **唯一**的隔墙判定，不另写 | import 纯函数 |
| TilemapRenderer / 固定地图（T6） | `OccluderGrid` | 场景 create 时注入 |
| `system-enemy-ai`（T2） | `isEngaged()`（能否出手）、`getPosition()` / `getFacingAngle()`（出手判定）、`getEnemies()`（命中枚举） | 同步查询（窄接口 `AISystemReadView`） |
| 场景层（RiftScene） | 攻击键按下 → `requestPlayerAttack()`；出击结束 → `setEnabled(false)`；按 R → `reset()` | 直接调用 |

### 向其他系统提供

| 消费方 | 提供什么 | 形式 |
| ------ | -------- | ---- |
| `system-chaos-scavenge-extract`（T3） | `ENEMY_DAMAGED`（→ `COMBAT_BONUS`）、`ENEMY_KILLED`（→ 移出追击集合）、`PLAYER_DIED`（→ 死亡结束路径）、`PLAYER_HEALTH_CHANGED`（→ HUD 生命值条） | 事件总线 |
| `system-enemy-ai`（T2，**经场景层**） | `ENEMY_DAMAGED` → `reportDamage(enemyId, playerPos)`；`ENEMY_KILLED` → `despawn(enemyId)`；`hooks.onNoise` → `reportNoise(pos, radius, level)` | 场景层转发 |
| 渲染层 | 白闪/扇形/前摇线的触发时机 | 内部渲染 + cue |
| HUD | `PLAYER_HEALTH_CHANGED` | 事件 |
| 音频 | V6 的五个 cue id | 回调 |
| QA / 调试 | `getEnemyHealth()` / `isEnemyAlive()` / `getAttackState()` | 同步查询 |

### 场景层接线清单（给 code agent 的 T8 checklist）

```
RiftScene.create:
  combat.create(scene, occluderGrid, aiReadView, {
    onNoise: (pos, r, lv) => ai.reportNoise(pos, r, lv),
  })
  eventBus.on(ENEMY_DAMAGED, ({ enemyId }) => ai.reportDamage(enemyId, player.getPosition()))
  eventBus.on(ENEMY_KILLED,  ({ enemyId }) => ai.despawn(enemyId))
  eventBus.on(PLAYER_DIED,   () => { ai.onPlayerLost(); combat.setEnabled(false) })
  eventBus.on(RIFT_EXITED,   () => combat.setEnabled(false))

RiftScene.update(dt):
  if (attackKey.justDown) combat.requestPlayerAttack()
  combat.update(dt)          // 在 ai.update 之后调用：出手判定要用本帧最新的 isEngaged()
```

**执行顺序有要求**：`ai.update()` → `combat.update()`。反过来会让敌人的接敌状态滞后一帧，在 30 px 的距离上足以造成"它明明贴上来了却不出手"的抖动。

### 为什么用这种耦合方式

沿用 T1 确立、Director 已确认、T2/T3 已遵循的模式：

1. **CombatSystem 不 import AISystem**。它只接受一个窄的只读视图（`AISystemReadView`）与一个噪声回调。`reportDamage` / `despawn` **刻意不在这个视图里**——在类型层面就让"战斗改 FSM"写不出来。
2. **CombatSystem 不 import ChaosSystem**，不调用 `addChaos()`。战斗代价的**取值**归 T3（`COMBAT_BONUS`），战斗只负责报告"发生了一次命中"。这样调平衡时只有一个地方要改。
3. **隔墙判定不重写**，一律走 `utils/grid-raycast`（与 T2 的 P3 同一条纪律）。
4. **每帧连续量不进事件总线**。血量走事件（离散变化），攻击状态走查询（每帧连续）。

---

## 对已有系统的影响

| 对象 | 影响 |
| ---- | ---- |
| `src/config/constants.ts` 的 `COMBAT` 段 | **纯新增，无需改动现有四个键**。`PLAYER_DAMAGE`(25) / `ATTACK_COOLDOWN`(500) / `ATTACK_RANGE`(40) / `ENEMY_DAMAGE_BASE`(15) 全部保持现值；按"可调参数表"新增其余 16 个键。`PLAYER.MAX_HEALTH`(100) 保持。由 code agent 在 T8 执行 |
| `src/types/events.ts` | **无需新增事件**。建议给 `ENEMY_DAMAGED` 加可选 `source?: 'player'` + 三条语义注释（见事件契约节）。由 code agent 在 T8 执行 |
| `src/entities/player.ts`（T5 建立） | 追加战斗字段与 `PlayerCombatAPI`。**不得改动 T1 拥有的移动字段语义**；唯一写入接触点是 `setSpeedModifier('attack', …)` |
| `src/entities/enemy-factory.ts`（T7 建立） | 敌人实体需承载 HP 与受击白闪。HP 表可由 CombatSystem 独立持有（`enemies: Map`），实体侧只需要一个可被白闪的 sprite 引用——**由 code agent 择一实现，不要两处各存一份 HP** |
| `system-movement-vision`（T1） | **接口无变更**。本 spec 完全在 T1 已 `exposes` 的接口内工作（`getPosition` / `getFacingAngle` / `setSpeedModifier` / `clearSpeedModifier` / `hasLineOfSight`）。T1 的 `interfaces-with` 已列出本 spec，其边界情况表「玩家死亡：视野是否收黑由 T4 死亡表现定义」——**本 spec 的裁定：死亡时不做视野收黑**（T3 规则 13 要求画面停在"最糟糕的那一刻"，收黑会把结算前的最后一眼夺走） |
| `system-enemy-ai`（T2） | **无需修改设计**。本 spec 回应其 escalate 项 2：(a) 接受分工；(b) 接受 `isEngaged()` 查询式接口；(c) **不需要** `setStandoffDistance()`——Slice 1 不做"后撤—再突进"节奏。T2 的 `AI_STANDOFF_DISTANCE`(30) 与本 spec 的 `ENEMY_ATTACK_RANGE`(38) 相容（30 < 38 < 40，不变量 K2） |
| `system-chaos-scavenge-extract`（T3） | **无需修改设计**。本 spec 提供其依赖的全部四个事件，且不自行修改混乱值。回应其 escalate 项 4：本 spec 建议给 `ENEMY_DAMAGED` 加可选 `source` 字段，Slice 1 一律填 `'player'`，T3 可先不过滤 |
| 固定地图数据（T6） | 无新增要求。战斗不需要任何地图侧数据（只用 `OccluderGrid`，T1 已要求） |
| `architecture.md` 模块注册表 | T8 完成后需登记：`CombatSystem`（`src/systems/combat-system.ts`）状态改为已实现并补全接口列（现表中的 `attack(source, target)` 与本 spec 的接口不符，应更新为 `update/requestPlayerAttack/setEnabled/...`）。**登记由 code agent 执行**，本 spec 不修改 architecture.md |
| `docs/progress/decisions-log.md` | 有两条设计取舍建议 Director 记入（见 escalate ④/⑤）。本 spec 不自行追加 |

---

## 验证标准

**本 Slice 结束时能验证：**

- 战斗是否被读作**一个有价格的选项**——玩家在遭遇时会犹豫、会算账，而不是条件反射地砍或条件反射地躲。
- "有代价"是否**可被感知**——打完一场之后，玩家能说出自己付了什么（混乱值条跳了、血少了、周围的敌人都醒了）。
- "可控"是否成立——玩家能否学会看前摇躲攻击。这决定战斗是"紧张"还是"随机挨打"。

**预期正面结果：**

- 玩家第一次遭遇选择绕行；某次被逼到墙角后选择战斗；打完说"早知道就绕了"。**这句话就是本系统的验收通过信号。**
- 玩家在敌人前摇的白线出现时**后退**，而不是继续砍——说明 350 ms 窗口可用。
- 玩家在敌人密集的区域**不敢开打**——说明噪声代价被理解为地理知识。
- 玩家在混乱值溢出段（>100）**改变策略开始清路**——说明战斗作为"止损工具"的定位成立，它在正确的时候变成了正确答案。
- 一局出击内玩家的击杀数中位数 **0–1**。≥3 说明战斗太便宜。
- 性能：战斗判定 < 0.2 ms/帧（8 敌人上限下，仅在 active 窗口投射线）。

**如果不 work 的信号：**

| 现象 | 指向的问题 | 调参方向 |
| ---- | ---------- | -------- |
| 玩家一路清场，把游戏玩成割草 | 战斗太便宜 | **优先升 `CHAOS.COMBAT_BONUS`（T3）与 `NOISE_HIT_RADIUS`**；其次升 `ENEMY_MAX_HEALTH` 到 100。**不要削弱 `PLAYER_DAMAGE`**——那会让战斗又贵又难受，是两个惩罚（T3 已声明此优先级） |
| 玩家从不出手，战斗形同虚设 | 战斗太贵或太危险，"可选"落空 | 降 `ENEMY_MAX_HEALTH` 到 50（两刀）；降 `NOISE_HIT_RADIUS`；检查 K5 是否被破坏 |
| 玩家说"我根本躲不掉" | 前摇太短 / 出手僵直太长 | 升 `ENEMY_ATTACK_WINDUP_MS` 到 450；降 `ATTACK_SLOW_MS` 或 `ATTACK_SELF_SLOW` |
| 玩家说"打它根本不掉血/看不出打中没" | 反馈不足 | 升 `ENEMY_HIT_FLASH_MS`；检查 V2 的占位表现是否落地 |
| 玩家不知道自己为什么死了 | 白闪或血条反馈不足；或 V5 的看不见敌人问题 | 升 `PLAYER_HIT_FLASH_MS`；强化 `combat.cue.playerHurt` 音频；最后才考虑 T2 escalate ③ |
| 一开打就滚雪球成全图警报，局面不可恢复 | 噪声半径过大 | 降 `NOISE_HIT_RADIUS` 到 96–128；降 `NOISE_KILL_RADIUS` |
| 被两三个敌人围住必死且无从操作 | token 机制或无敌帧失效 | 检查 `ENEMY_ATTACK_TOKENS` 与 `PLAYER_IFRAME_MS` 是否真的实现 |
| 玩家发现站在 40 px 外反复 poke 可以无伤击杀 | K2 的间距被玩坏 | 升 `ENEMY_ATTACK_RANGE` 到 40（与玩家相等）；或升 `ATTACK_SELF_SLOW` 的惩罚力度 |
| 玩家隔墙砍到敌人 / 敌人隔墙打到玩家 | 没走 `hasLineOfSight` | 检查 A4③ / E2；这是 bug 不是调参 |
| 重开后玩家一直是慢的 | `'attack'` 移速调制未清除 | 检查 A6 的清理路径；QA 专项 |

---

## 待验证假设

- [ ] **敌人 75 HP（三刀）是"一次真正的交手"的正确规模** —— 本 spec 最需要校准的数。两刀会让战斗过于便宜从而压过潜行；四刀可能让玩家彻底放弃战斗选项。
- [ ] **350 ms 前摇 + 220 ms 出手僵直构成的躲避窗口是"紧张"而非"苛刻"** —— 两个数必须联合校准，单独调任一个都会改变实际窗口。
- [ ] **命中噪声用 `alert` 等级（而非 `suspicious`）不会造成不可恢复的雪球** —— 这是战斗代价最重的一条，也是最可能过头的一条。若过头，先降半径再考虑降等级。
- [ ] **"锁定朝向的挥击"读作有分量，而不是读作操作不跟手** —— 若玩家频繁抱怨"我明明转过去了却砍空"，备选是改为在 `active` 瞬间采样朝向，而不是延长判定角度。
- [ ] **空挥不计混乱值、但仍产生 `suspicious` 噪声，这个区分玩家能理解** —— 若玩家把两者混为一谈（"挥一下就被发现了，那还不如砍中"），说明区分无效，应把挥击噪声半径降到 64 或直接取消。
- [ ] **本局内生命值不可恢复不会导致"第一次受伤后就极端保守"** —— 若出现，最小补丁是撤离时按剩余血量给一点结算反馈（让血量有正向价值），而不是加治疗道具（那会引入第二条资源轴，污染 Slice 1 的验证信号）。
- [ ] **不做击退/顿帧/屏幕震动不会让战斗读作"软绵绵"** —— 若确实缺少打击感，优先加音频与白闪时长，最后才考虑 40 ms 级的极短顿帧。
- [ ] **`ENEMY_ATTACK_TOKENS = 2` 在 Slice 1 的 3–5 敌人下几乎不触发** —— 若频繁触发，说明地图布局把敌人挤在了一起，应先看 T6 的布点而不是调这个数。
- [ ] **战斗判定与 T2 的 `isEngaged()` 在 30/38/40 三个距离上不会互相抖动** —— T2 把距离维持在 26–34 px，本 spec 在 38 px 出手，理论上有 4 px 余量；需 T8 实测确认不会出现"起手瞬间超距落空"的高频空砍。

---

## ⚠️ 待确认 / escalate（需人或对应 agent 拍板，本 spec 未擅自改动相关文档）

1. **【需 art agent 确认】art §5.1「受伤时 sprite 整体闪烁白色 1-2 帧」的帧口径。**
   若指**渲染帧**（60 fps）= 17–33 ms，在 60 Hz 显示器上极易被完全错过，玩家会感觉"掉血但没有任何反馈"；若指**动画帧**（本项目角色动画 4 帧循环，约 8–12 fps）= 83–166 ms。本 spec 按后者取 `PLAYER_HIT_FLASH_MS = 100 ms`、`ENEMY_HIT_FLASH_MS = 80 ms`。
   → **请 art agent 确认口径并在 §5.1 补一个毫秒数**（这类"帧"歧义会在每个受击表现上重复出现）。

2. **【需 art agent 确认】占位期给"白色"新增攻击语义。**
   art §12 的占位编码里白色 = 玩家 / 撤离点。本 spec 在占位期额外用白色表达攻击动作（玩家挥击 = 白色扇形描边；敌人前摇 = 白色细线；受击 = 白色整体闪），依据是"白色细线/闪光"与"白色实心块"在形状上可区分，且与 T2 的 teal 感知指示物构成正交的两个信息通道（**teal = 它在想什么，白 = 它在做什么**）。
   → **请 art agent 确认，或指定另一个占位色**。若否决，备选是敌人前摇用 T2 的 teal 三角短暂拉长（但那会与"锁定"状态指示物混淆，本 spec 不推荐）。

3. **【需 Director 确认】噪声走注入回调（`CombatHooks.onNoise`）而非新增事件。**
   理由见"噪声为什么走注入回调"。这是本 spec 唯一一处非事件的跨系统输出路径，先例是 T3 的 `getChaosModulators` 场景层转发。
   → 若 Director 要求严格事件化，替代方案是在 `src/types/events.ts` 新增 `COMBAT_NOISE { pos, radius, level }`，代价是一个只有单一生产者与单一消费者的事件。

4. **【建议记入 decisions-log】敌人 75 HP = 三刀击杀，且伤害完全无随机。**
   这是"代价可计算"这条设计纪律在战斗侧的具体落点（不变量 K1）：玩家第一次交手就能学到固定价格，此后每次遭遇都是算术而非赌博。副作用是战斗完全没有意外性，这是刻意的取舍。
   → 建议 **DEC-012**。

5. **【建议记入 decisions-log】战斗代价采用"混乱值 + 暴露"双轨，且刻意保留三个战斗划算的场景。**
   见"为什么潜行仍然更划算"。核心取舍是：战斗被定价为**止损工具**而非推进工具；如果试玩显示玩家从不出手，说明定价过高而不是设计成功。
   → 建议 **DEC-013**。

6. **【需 T3 知悉，可能需回头校准】命中噪声（`alert`，160 px）会经 T2 的 `ENEMY_ALERT` 让每个被惊动的敌人在 T3 侧各加一次 `DETECTION_BONUS`(3)。**
   这是本 spec 与 T3 的隐性叠加：一刀命中在敌人密集处的真实账单可达 `COMBAT_BONUS`(5) + `DETECTION_BONUS`(3) × N。本 spec 认为这个叠加是**正确且想要的**（在人多的地方开打就该更贵），但它的量级没有被任何一方单独设计过。
   → **请 Director 在 T10 QA 时把"一次命中造成的混乱值总量"列为专项测量项**；若过重，调节旋钮优先级为 `NOISE_HIT_RADIUS` > `COMBAT_BONUS` > `DETECTION_BONUS`。

7. **【回应 T2 escalate 项 2，无需改动】接敌分工确认。**
   本 spec 明确接受：(a) T2 停位 + `isEngaged()`，T4 决定出手/伤害/冷却；(b) 查询式接口而非事件；(c) **不需要** `setStandoffDistance()`。若后续 Slice 要给渗透体加"后撤—再突进"节奏，届时再由 T2 增加该接口。
   → 仅需 Director 在交叉核对时确认 `AI_STANDOFF_DISTANCE`(30) 保持不变。

8. **【裁定 T1 遗留项，需 T1 知悉】玩家死亡时不做视野收黑。**
   T1 边界情况表写「玩家死亡：视野是否收黑由 T4 死亡表现定义」。本 spec 裁定**不收黑**：T3 规则 13 要求出击结束时画面停在"最糟糕的那一刻"，收黑会夺走玩家看清自己死在哪里的最后一眼，也削弱结算面板前的那一秒沉默。
   → 无需改 T1 spec（它把决定权交给了本 spec），此处仅作记录供 code agent 在 T8 遵循。
