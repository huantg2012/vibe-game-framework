---
status: ACTIVE
created-by: director agent
created-when: Slice 1 锁定时（2026-07-24）
last-modified: 2026-07-31
note: Slice 1 全部任务 Brief。范围三取舍已由人拍板：固定地图 / 纳入简化战斗 / 只做裂隙出击环。2026-07-29 进入实现阶段（T6→T5 与 A-G3 前两步并行开工）。2026-08-01：T7/T8 均收口 Done，下一个是 T9。
---

# Tasks: Slice 1 — 裂隙潜行核心手感

Slice 类型：系统
验证问题：**裂隙出击环**（进入裂隙 → 有限视野潜行 → 遭遇一种敌人（可潜行绕过或简化战斗）→ 搜刮薪柴 → 混乱值压力上升 → 玩家自行决定撤离）的**紧绷决策手感是否成立**？"还敢不敢再多拿一点"（贪婪 vs 撤退）的博弈是否让人上头？

**锁定的范围取舍（DEC 记录见 decisions-log / current-slice）：**
- ① 地图 = **code agent 写死的固定地图**（非程序生成；Voronoi+CA 留后续 Slice）
- ② **纳入简化战斗**
- ③ 只做**裂隙出击环**（净化点环 → Slice 2）

**派发说明：** 🟢 Director 可直接派发 / 🔴 人主导（人拍板 + 驱动对应 agent 执行，**非人肉手工**）。真正的人肉触点全项目只有两个：外部生图、最终审美/体验判断（见 director.md）。

**执行顺序建议：** T1-T4（设计 spec）先行 → **T6 → T5**（固定地图、移动+视野，即真实渲染路径）作为实现第一段，A-G3 合成测试搭在这一段上 → T7/T8/T9（AI/战斗/搜刮混乱撤离）→ T10 QA。美术门禁 A-G1~3 与实现并行，不阻塞玩法（玩法用占位资产）。

**为什么是 T6 先于 T5（2026-07-29 Director 定）：** VisibilitySystem 的 raycasting 遮挡只有对着真实墙体网格才能验证，而墙体网格是 T6 的产出——反过来做等于先写一个无法验证的视野系统，必然返工。两者都写 `src/scenes/rift-scene.ts`，因此归同一个 code agent 一次任务连续完成，避免并行改同一文件。

**本 Slice 已定的数值变更：** `CHAOS.BASE_RATE` 1.5 → **0.8**（DEC-014）。`src/config/constants.ts` 现值仍是 1.5，由 code agent 在 **T9** 落地。

---

## Task: T1 | assignee: design

Title: 设计 spec — 移动 + 有限视野系统 | Priority: P0 | Dispatch: 🔴

### 目标
定义俯视角移动手感与 Raycasting 有限视野的规则、数值与对外接口。

### 上下文
有限视野是三根体验支柱的直接支撑（"绝望边缘的紧绷"），也是 T5 实现与 A-G3 合成测试的地基。视野/移动是 RiftScene 与 PurificationScene 共享管线（architecture DEC-ARCH-008），本 spec 定义共享部分。

### 具体要求
- [ ] 移动：速度、加速/惯性（若有）、四方向朝向、与墙体的 Arcade AABB 碰撞规则
- [ ] 视野：形状（锥形为默认，面朝方向更远）、半径、边缘 3 级 alpha 渐变（art-direction §7.1）、视野外表现（void-black + 微噪点）
- [ ] 混乱值超阈值对视野的影响钩子（视野半径缩小 / teal 噪点渗入——数值留 T3 spec 定，本 spec 定接口）
- [ ] frontmatter 含 `interfaces-with` / `exposes`；正文首行 TL;DR

### 约束
- 遵守 architecture：VisibilitySystem 自实现 Raycasting（DEC-ARCH-004），性能预算 < 2ms/帧（≤60 光线），静止时缓存
- 术语用 world.md 定义（如"裂隙"）

### 验收标准
- spec 能让 code agent 无歧义实现 T5；数值可调项集中列出
- 明确视野系统对外事件/接口（供混乱值系统挂钩）

### 相关文件
- 创建 `docs/specs/system-movement-vision.md`
- 参考 `docs/architecture.md`（VisibilitySystem / Player / 共享管线）、`docs/art-direction.md` §7

---

## Task: T2 | assignee: design

Title: 设计 spec — 敌人 AI（FSM + 感知） | Priority: P0 | Dispatch: 🔴

### 目标
定义一种基础敌人（渗透体）的有限状态机与感知规则。

### 上下文
"一种敌人"是裂隙出击环制造潜行博弈的最小威胁源。玩家要能读懂它的巡逻/警觉/追击，才能做"绕行 vs 冒险搜刮"的决策。

### 具体要求
- [ ] FSM 状态：巡逻 / 警觉（suspicious）/ 警报（alert）/ 追击（chase）及转换条件
- [ ] 感知：视野范围/角度、察觉阈值、失去目标后的降级计时
- [ ] 巡逻路径定义方式（固定路点，配合 T6 固定地图）
- [ ] 与视线遮挡的交互（被墙挡住看不到玩家）
- [ ] 对外事件：`ENEMY_ALERT`（payload: enemyId, alertLevel）等，与 architecture events 对齐

### 约束
- 寻路用自实现 grid A*（DEC-ARCH-002/架构），AI 分帧计算（每帧最多 1 次 A*）
- 只设计渗透体一种；不设计改写体/覆盖体（后续 Slice）

### 验收标准
- 状态转换表完整、无歧义死角；感知数值集中可调
- 明确"玩家如何靠观察读懂敌人当前状态"（服务于占位期可读性）

### 相关文件
- 创建 `docs/specs/system-enemy-ai.md`
- 参考 `docs/architecture.md`（AISystem / Pathfinding）、`docs/world.md`（渗透体设定）

---

## Task: T3 | assignee: design

Title: 设计 spec — 混乱值 + 搜刮 + 撤离 | Priority: P0 | Dispatch: 🔴

### 目标
定义驱动"贪婪 vs 撤退"博弈的三件套：混乱值累积/惩罚、薪柴搜刮、撤离结束。

### 上下文
这是本 Slice 验证问题的核心数值系统——混乱值是持续升高的压力钟，薪柴是诱惑，撤离是解脱。三者共同制造"还敢不敢再多拿一点"。

### 具体要求
- [ ] 混乱值：初值、上涨速率（匀速为主）、是否有加速来源（如战斗/被追击）、上限
- [ ] 阈值惩罚：至少一级超阈值惩罚（视野缩小 / teal 噪点），与 T1 视野接口对接；`CHAOS_THRESHOLD_REACHED`
- [ ] 搜刮：薪柴在固定地图上的分布原则（部分安全 / 部分被敌人看守）、拾取规则、`KINDLING_COLLECTED`
- [ ] 撤离：进入触发半径后**按 E 确认**结束本次出击（DEC-011，非到达即撤离）、结算带出的薪柴、`RIFT_EXIT_REACHED`
- [ ] HUD 需要显示什么（混乱值条顶部中央、薪柴计数、生命值——见 art-direction §6.3）

### 约束
- 事件契约以 `src/types/events.ts` 为准（架构已列 CHAOS_CHANGED / KINDLING_COLLECTED / RIFT_EXIT_REACHED 等）
- 数值以"能制造纠结"为目标，具体值可在实现后由人试玩调参

### 验收标准
- 三系统的规则与数值可被 T9 无歧义实现
- 明确"死亡/被抓"与"主动撤离"两种出击结束路径的区别（死亡处理与战斗 spec T4 对接）

### 相关文件
- 创建 `docs/specs/system-chaos-scavenge-extract.md`
- 参考 `docs/architecture.md`（ChaosSystem / LootSystem / events）、`docs/art-direction.md` §6/§7.2

---

## Task: T4 | assignee: design

Title: 设计 spec — 简化战斗 | Priority: P1 | Dispatch: 🔴

### 目标
定义"可选、有代价、可控"的最小战斗：玩家能攻击敌人、敌人能伤害玩家、受伤/死亡处理。

### 上下文
取舍②新增。vision 将战斗定位为决策选项而非主要交互；本 spec 要保住"有代价"这一叙事定位——战斗不是无脑清场，而是有风险的选择（如：出手会拉高混乱值 / 惊动附近敌人）。

### 具体要求
- [ ] 玩家攻击：方式（近战挥击 / 简单判定）、伤害、冷却
- [ ] 敌人受击与死亡；玩家受击、生命值、死亡=出击失败（丢失未撤离的薪柴）
- [ ] 战斗的"代价"：至少一条（例：攻击/被追击提升混乱值上涨，与 T3 挂钩），保证"能打但不划算白打"
- [ ] 事件：`PLAYER_DAMAGED` 等，对齐 architecture events
- [ ] 受伤视觉钩子：sprite 白闪 1-2 帧（art-direction §5.1，不加红色）

### 约束
- 最简实现，不引入连招/装备/多武器；Arcade 物理判定
- 不破坏潜行仍是首选：战斗应比成功潜行"更吵、更贵"

### 验收标准
- 玩家可攻击并杀死渗透体；敌人可击伤并杀死玩家；死亡正确结束出击
- "战斗有代价"这条规则可被 T8 实现并可被试玩感知

### 相关文件
- 创建 `docs/specs/system-combat.md`
- 参考 `docs/architecture.md`（CombatSystem / events）、`docs/vision.md`（战斗定位）

---

## Task: T5 | assignee: code

Title: 实现 — 移动 + 有限视野（占位资产） | Priority: P0 | Dispatch: 🔴 | Status: **Done**（2026-07-29）。产出 `src/entities/player.ts` + `src/systems/visibility-system.ts` + `src/utils/grid-raycast.ts`；`camera.setZoom(1.5)` 实测视口 20.0×13.3 tile（DEC-009 达标）；raycasting 60 线实测均值 0.1ms（预算 2ms）；`setRadiusScale()` 缓存失效已补并回填 T1 规则 20。**遗留：键盘手感需人试玩**（浏览器无法模拟按住键）。

### 目标
按 T1 spec 实现玩家移动与 Raycasting 视野，占位资产先行。

### 上下文
这是裂隙出击环能"动起来"的第一步，也是 A-G3 合成测试所需的真实渲染/光照路径的一部分。

### 具体要求
- [ ] 建立共享 `Player` 实体（移动 + 输入 + 朝向 + Arcade 碰撞）
- [ ] 建立 `VisibilitySystem`（raycasting 视野遮罩 + 边缘渐变 + 视野外黑暗）
- [ ] 占位：玩家=白色矩形+朝向三角形；视野/光照用代码绘制（art-direction §12）
- [ ] 新增/更新模块登记到 `architecture.md` 模块注册表

### 约束
- 生产质量、`npm run dev` 可运行；游戏循环不 new 对象（对象池/预分配）
- 视野性能预算 < 2ms/帧；静止缓存

### 验收标准
- 玩家可移动、被墙阻挡；视野随朝向变化、视野外为黑暗；帧率达标
- 模块可被 PurificationScene 后续复用（不硬编码进 RiftScene）

### 相关文件
- `src/entities/player.ts`、`src/systems/visibility-system.ts`、`src/scenes/rift-scene.ts`

---

## Task: T6 | assignee: code

Title: 实现 — 固定裂隙地图（写死 tile 数据 + 渲染） | Priority: P0 | Dispatch: 🔴 | Status: **Done**（2026-07-29）。产出 `src/scenes/rift-map-data.ts`（64×44 ASCII 固定地图 + 布点 + `validateRiftMap()`）+ `src/systems/tile-grid.ts` + `src/systems/tilemap-renderer.ts`；两条路线 + 8 薪柴点 + 撤离点 + 4 巡逻路点就绪供 T7/T9 消费。**遗留：纯步行全清约 59s，低于 DEC-014 的 0.8 速率所假设的 220s 前提——见下方"待拍板"**。

### 目标
用 code agent 写死一张固定裂隙地图的 tile 数据，并通过 TilemapRenderer 渲染出来。

### 上下文
取舍①：本 Slice 不上程序生成。固定地图要含障碍 + 多路线 + 搜刮点 + 撤离点 + 敌人巡逻路点，足以支撑潜行/战斗/博弈的验证。这条实现建立的 `TilemapRenderer` 也是 A-G3 合成测试的渲染路径。

### 具体要求
- [ ] 手工编排一张 tile 索引地图（含可通行/墙体，制造视线遮挡与至少两条路线）
- [ ] 标注搜刮点位（部分安全、部分在敌人巡逻视野内）、撤离点位、敌人出生/路点
- [ ] 建立 `TilemapRenderer`（tile 数据 → Phaser Tilemap 图层，依赖 Phaser 视锥裁剪）
- [ ] 占位 tile：可通行 #1a1a1a、墙体 #000000（art-direction §12 占位色）
- [ ] 数据与渲染分离（数据写死在数据文件/常量，渲染在 TilemapRenderer）

### 约束
- 不实现 Voronoi/CA/连接器（`src/generation/` 本 Slice 不动）
- TilemapRenderer 是共享管线（Rift 用固定数据，净化点后续用手工静态数据）

### 验收标准
- 地图可渲染、可行走、有明确的可通行/不可通行区分与多条路线
- 搜刮/撤离/敌人位就绪，供 T7/T8/T9 消费

### 相关文件
- `src/systems/tilemap-renderer.ts`、固定地图数据（如 `src/scenes/rift-map-data.ts`）、`src/scenes/rift-scene.ts`

---

## Task: T7 | assignee: code

Title: 实现 — 敌人 AI + 感知 | Priority: P0 | Dispatch: 🔴 | Status: **Done**（2026-07-31）。产出 `src/systems/ai/`（ai-system 编排器 + state-machine FSM + behaviors + context + index）、`src/systems/pathfinding.ts`（grid A*）、`src/entities/enemy-factory.ts`、`src/types/ai-types.ts`、`src/config/invariants.ts`；`rift-scene.ts` 已接线（生成 + 每帧 update + `setVisibilityProvider` + `addWallCollider` + `bindAIStimuli`）。**核实证据**（详见 `current-slice.md` 的"T7 完成记录"）：typecheck 干净（仅 T8 并行文件报错）；六条平衡不变量成立并加了 dev 启动断言（DEC-020）；巡逻腿 create 时全预计算、**运行时 A\* 调用 0**；跨图最坏 A\* 1050 节点/0.31 ms、追击距离内 avg 0.02 ms（预算 5 ms）；N2 不许切角用合成网格实测通过且与 `hasLineOfSight` 一致；4 个渗透体持续沿路点巡逻（pingpong 掉头 / loop 绕行均实测）、AI 0.00–0.10 ms/帧、视野锥外不渲染。**实现期修掉两个 bug**：路径平滑/直线优先用点大小视线判定导致 20 px 身体卡挡板（改为宽度感知 `hasClearPath()`，DEC-021，就地回答了 spec 的 N4 待验证假设）；卡死看门狗在 `Scene.update()` 测位移恒为 0（Arcade 在 POST_UPDATE 才写回 sprite）导致误判并清掉巡逻路径。**fps 33 更正**：是浏览器标签未聚焦的节流，非 AI 开销。**遗留（人）**：状态可读性（R1–R3）与五态降级链需真人试玩确认（浏览器无法模拟按住方向键，同 T5 限制）。**T7 实现期 5 项 escalate 已由 Director 收口（DEC-022）**：① `ASTAR_MAX_NODES` 1200→3000（已应用 constants+spec）；② ALERT 重锁补「非盲区」；③ N6 补 ALERT/SUSPICIOUS 失败兜底；④ 弃用 `peakAlertLevelThisEpisode` 字段；⑤ N8 限定巡逻态、RETURN 保留最低优先级 A\*。均无接口变更、不阻塞 T8。

### 目标
按 T2 spec 实现渗透体的 FSM + 感知 + 巡逻/追击。

### 开工核实（Director，2026-07-31）
依赖 T2/T5/T6 全部满足，无阻塞：
- `docs/specs/system-enemy-ai.md` = ACTIVE，含五态 FSM、察觉度累积、6 条平衡不变量、`AISystemAPI`/`EnemyView` 契约。
- `src/utils/grid-raycast.ts` 导出 `hasLineOfSight(grid, from, to, maxDist?)`，含对角缝隙规则 —— DEC-015 指定的唯一遮挡来源。
- `src/types/map-types.ts` 已定义 `OccluderGrid` / `WalkGrid`；`src/systems/tile-grid.ts` 的 `TileGrid` 同时实现两者（`isOpaque` / `isWalkable` / `version`）。
- `RIFT_MAP.layout.enemySpawns` 已产出 4 个 `EnemySpawnData`（ENM_INF_01..04，含 spawn/facing/waypoints/mode/pauseMs/scanAngles），`validateRiftMap()` 已校验路点可通行且互相可达。
- `Player` 已暴露 `getPosition()` / `isMoving()`；`VisibilitySystem.getVisibilityAt()` 可用于 R4 的渲染门槛；占位纹理 `placeholder-enemy` 已在 boot-scene 生成。

### 沿用的 escalate 结论（Director 确认）
- escalate ①：听觉取 `Player.isMoving()`，半径恒定、仅移动时命中 —— 采纳 spec 的读法。
- escalate ⑦：敌人行为完全不受混乱值影响，压力只从玩家侧收紧 —— 保持不受影响，本次不加调制器接口。
- escalate ⑥：`AI.SIGHT_ANGLE: 90` 旧键删除，替换为 `SIGHT_HALF_ANGLE_CORE`(55) / `SIGHT_HALF_ANGLE_PERIPH`(90)，避免两套语义并存。

### 具体要求
- [x] FSM（巡逻/警觉/警报/追击 + RETURN）+ 转换；感知（核心锥 + 余光带 + 听觉，视线一律走 `hasLineOfSight`）
- [x] 沿固定路点巡逻；发现玩家→追击；失去目标→降级（转换表逐条实现；端到端时序待真人试玩确认）
- [x] grid A* 寻路，分帧计算（每帧最多 1 次 A*，全局单队列按 CHASE>ALERT>SUSPICIOUS>RETURN 出队）
- [x] 占位：敌人=暗红五边形（朝向可读）；按 E1 契约发出 `ENEMY_ALERT`（升级才发 / 同级 1000 ms 冷却）
- [x] 占位期可读性：teal 指示物三态（SUSPICIOUS 呼吸随 detection 提频 / ALERT 3Hz 闪 / CHASE 常亮+残影）（**待真人确认可读**）

### 约束
- 只做渗透体一种；遵守 architecture 性能规则

### 验收标准
- 敌人巡逻、被视线遮挡时看不到玩家、发现后追击、跟丢后回巡逻
- 状态对玩家可读（占位期即可判断"它是否发现了我"）

### 相关文件
- `src/systems/ai/state-machine.ts`、`src/systems/ai/behaviors.ts`、`src/systems/pathfinding.ts`、`src/entities/enemy-factory.ts`

---

## Task: T8 | assignee: code

Title: 实现 — 简化战斗 | Priority: P1 | Dispatch: 🔴 | Status: **Done**（2026-08-01）。产出 `src/systems/combat-system.ts`；`constants.ts` 的 `COMBAT` 段补全、`events.ts` 加 `ENEMY_DAMAGED.source?` + 语义注释（**零新增事件**）、`invariants.ts` 加 K1/K2/K3/K5、`rift-scene.ts` 接线（`combat.update` 在 `ai.update` 之后）、`enemy-factory.ts` 导出白闪用纹理 key。`player.ts` 未改（**DEC-023**：战斗状态由 CombatSystem 独占，避免两处存血量）。**核实证据**：typecheck + build 干净；实机三刀击杀（`ENEMY_DAMAGED`×3 → `ENEMY_KILLED`）、超距不命中、被打死 7 次全流程（`PLAYER_DAMAGED`/`PLAYER_HEALTH_CHANGED` 成对 → `PLAYER_DIED` 一次）、敌人出手节拍 ~1593 ms、噪声 `suspicious r96` / `alert r160` 实测；白色扇形与前摇细线截图确认。**遗留**：美术口径（白闪毫秒 + 白色=攻击语义 + 玩家占位本身是白色导致白闪需放大 6 px 才可读）仍待 art 裁定；手感与三刀规模需真人试玩；`combat.reset()` 待 T9 的 R 键接线。

### 目标
按 `docs/specs/system-combat.md`（T4）实现玩家攻击、敌人伤害玩家、受伤/死亡，含"战斗有代价"。

### 开工核实（Director，2026-07-31）
依赖 T4/T5/T7 全部满足，无阻塞：
- T4 spec = ACTIVE，规则 A1–A10 / E1–E7 / H1–H3 / V0–V6 齐备，含"场景层接线清单"。
- T5：`Player` 已暴露 `getPosition()` / `getFacingAngle()` / `setSpeedModifier()` / `clearSpeedModifier()`；`utils/grid-raycast` 的 `hasLineOfSight()` 就绪。
- T7：`AISystemAPI` 已暴露 `getEnemies()` / `getEnemyById()` / `reportNoise()` / `reportDamage()` / `despawn()` / `onPlayerLost()`，与 spec 的 `AISystemReadView` + 三个刺激入口完全对齐。
- **五个事件全部已存在**于 `src/types/events.ts`（`PLAYER_DAMAGED` / `PLAYER_HEALTH_CHANGED` / `PLAYER_DIED` / `ENEMY_DAMAGED` / `ENEMY_KILLED`），spec 声称属实，**本任务不新增任何事件**。
- **场景层已预接线**：`rift-scene.ts` 的 `bindAIStimuli()` 已接好 `ENEMY_DAMAGED → reportDamage` / `ENEMY_KILLED → despawn` / `PLAYER_DIED → onPlayerLost`；本任务只需补 `combat.create(..., { onNoise })` 与 `combat.update(dt)`。
- `constants.ts` 的 `COMBAT` 段现有四键与 spec 一致，本任务为纯新增（约 16 键）。

### Director 拍板（沿用的 escalate 结论）
- escalate ③：**噪声走注入回调 `CombatHooks.onNoise`，不新增 `COMBAT_NOISE` 事件**（先例 = T3 的 `getChaosModulators` 场景层转发）。
- escalate ④/⑤ → **DEC-012**（75 HP = 三刀、零随机）/ **DEC-013**（代价双轨 + 战斗 = 止损工具），按此实现。
- escalate ①/②（美术口径）**仍挂起**：白闪毫秒数与"白色 = 攻击语义"未获 art agent 确认。**按 spec 建议值实现占位，不得视为美术定案**；若实现中出现新的美术判断需求，列 escalate 交回，不自行定死。
- escalate ⑥：一次命中的混乱值总量归 T10 QA 专项实测，本任务不预调参。

### 具体要求
- [ ] `CombatSystem`：玩家挥击时序（windup 100 / active 50 / recovery 70，冷却 500 从输入起算）、朝向按下瞬间锁定、前向扇形命中（半径 40 / 半角 60° / `hasLineOfSight` 硬性）、`hitSet` 去重、`ATTACK_MIN_ANGLE_BYPASS`(16) 贴身直判
- [ ] 出手僵直：`setSpeedModifier('attack', 0.35)` 220 ms；死亡 / `setEnabled(false)` / `destroy()` / `reset()` 路径**必须** `clearSpeedModifier('attack')`（spec 标注的最易漏 bug）
- [ ] 敌人 75 HP、玩家伤害 25 → **恰好三刀，零随机**（不变量 K1，DEC-012）；`ENEMY_DAMAGED { enemyId, amount, source: 'player' }`（新增可选 `source` 字段）
- [ ] 敌人反击：`isEngaged()` 查询 + 38 px + 60° + 视线 + 冷却 1200 + 接敌延迟 300 + attack token(2)；**前摇 350 ms、前摇结束瞬间重新求值结算**，落空不扣血不发事件
- [ ] 玩家 100 HP、单次受伤 15、无敌帧 400 ms、**局内不可恢复**（H1）、每次出击回满并发初始 `PLAYER_HEALTH_CHANGED {100,100}`
- [ ] 死亡：`PLAYER_HEALTH_CHANGED {0,100}` → `PLAYER_DIED { cause: 'enemy_attack' }` → `setEnabled(false)`；一次出击只发一次；**死亡不做视野收黑**（spec escalate ⑧ 裁定）
- [ ] 噪声三档经 `hooks.onNoise` 转 `ai.reportNoise`：挥击 96px/suspicious（空挥也发）、命中 160px/alert、击杀 192px/alert；场景层**不得**再从事件二次生成噪声
- [ ] 视觉占位（V2）：挥击白色扇形描边、命中/受伤白闪、敌人前摇白色细线渐亮、死亡 180 ms 淡出；**不做**屏震/顿帧/伤害数字/击退（V3/V4）
- [ ] `constants.ts` 的 `COMBAT` 段按 spec 参数表补齐；`architecture.md` 模块注册表登记 `CombatSystem` 并更新其接口列
- [ ] `rift-scene.ts` 接线：`combat.update(dt)` **必须排在 `ai.update()` 之后**（spec 明示，反过来会滞后一帧）

### 约束
- 严格遵循 `docs/specs/system-combat.md`；遵守 architecture 事件总线（DEC-002）与目录约定；生产质量代码
- **不新增事件**；**不 import AISystem**（只收窄只读视图 + 回调）；**不改 FSM**；**不直接改混乱值**（K6）
- 游戏循环不 new 对象（`hitSet` / 判定原点预分配）；dt 钳制 100 ms 与 T2 一致
- 遇到 spec 未覆盖的情况**不要自行改设计**，列 escalate 交回

### 验收标准
- 可打死渗透体（恰好三刀）、可被打死并正确结束出击；不变量 K1–K6 全部成立
- 实机可攻击 / 被攻击 / 死亡；typecheck + lint 干净
- 自检报告须覆盖：五个事件是否全部复用（零新增）、DEC-012/013 是否落地、与 T7 API 对接是否正确、`'attack'` 移速调制的全部清理路径

### 相关文件
- `src/systems/combat-system.ts`、`src/entities/player.ts`、`src/entities/enemy-factory.ts`、`src/scenes/rift-scene.ts`、`src/config/constants.ts`、`src/types/events.ts`

---

## Task: T9 | assignee: code

Title: 实现 — 薪柴搜刮 + 混乱值 + 撤离 + HUD | Priority: P0 | Dispatch: 🔴

### 目标
按 T3 spec 实现博弈三件套 + 最小 HUD，让裂隙出击环闭合可玩。

### 具体要求
- [ ] 薪柴：地图散布拾取（部分安全/部分被守）；`KINDLING_COLLECTED`
- [ ] 混乱值：匀速上涨 + 至少一级超阈值惩罚（视野缩小/teal 噪点，接 T5 视野）；`CHAOS_CHANGED` / `CHAOS_THRESHOLD_REACHED`
- [ ] **`CHAOS.BASE_RATE` 从 constants 现值 1.5 改为 0.8**（DEC-014 已拍板，本任务是唯一落地点）；`CHAOS` 段其余改动按 T3 spec 的 constants 影响表执行
- [ ] 撤离：进入撤离点触发半径后**按 E 确认**结束出击（DEC-011，非到达即撤离）、结算带出薪柴；`RIFT_EXIT_REACHED`
- [ ] HUD：混乱值条（顶部中央）、薪柴计数、生命值（art-direction §6.3），Phaser Text/Graphics 占位
- [ ] 占位：薪柴=teal 小色块、撤离点=白色脉动（art-direction §12；薪柴属污染侧，非暖色）

### 约束
- 事件契约以 `src/types/events.ts` 为准；HUD 频繁更新数值需缓存字符串

### 验收标准
- 一次完整出击可玩：进入→搜刮→压力上升→撤离（或死亡）；HUD 正确反映状态
- "贪婪 vs 撤退"的张力在试玩中可感知（供人回答验证问题）

### 相关文件
- `src/systems/chaos-system.ts`、`src/systems/loot-system.ts`、`src/ui/hud.ts`、`src/scenes/rift-scene.ts`

---

## Task: T10 | assignee: qa

Title: QA 验收（对照 spec） | Priority: P0 | Dispatch: 🟢

### 目标
对照 T1-T4 spec 检查 T5-T9 实现的偏差、边界条件、跨系统交互。

### 具体要求
- [ ] 逐 spec 比对实现；列出偏差（缺失/多做/歧义处理不一致）
- [ ] 边界：混乱值上/下限、视野遮挡边角、敌人跟丢、死亡与撤离并发、搜刮空/满
- [ ] 跨系统：战斗代价是否真的抬升混乱值；超阈值惩罚是否真的改变视野
- [ ] **专项测量：一次命中造成的混乱值总量**（T4 escalate 第 6 项要求）。命中噪声会经 T2 的 `ENEMY_ALERT` 让每个被惊动的敌人在 T3 侧各加一次 `DETECTION_BONUS`(3)，所以真实账单是 `COMBAT_BONUS`(5) + `DETECTION_BONUS`(3) × N（N = 被惊动的敌人数）。这个叠加量级没有被任何一份 spec 单独设计过，必须实测：分别记录敌人密集处与孤立敌人处的单刀总代价。若判定过重，调节旋钮优先级 = `NOISE_HIT_RADIUS` > `COMBAT_BONUS` > `DETECTION_BONUS`
- [ ] 性能抽查（FPS / 视野 raycasting 预算）

### 验收标准
- 产出 `docs/qa/slice-1-report.md`：通过项 / 偏差项 / 阻断项分级

### 相关文件
- 创建 `docs/qa/slice-1-report.md`；对照 `docs/specs/system-*.md`

---

## Art Gate: A-G1 | assignee: art

Title: 32px 尺度可读性实测 | Priority: P1 | Dispatch: 🔴（生 prompt 部分 🟢）

### 目标
验证承载恐怖感的关键细节（坏像素散点、L1 色温差）在缩到 32px + 视野遮罩后是否幸存（art-direction §14.2）。

### 具体要求
- [ ] art agent 出关键 tile/sprite 的生成请求（prompt + 验收标准）
- [ ] 🙋 人外部生图 → code/art 过管线到 32px → 在视野遮罩下并排看
- [ ] 结论回写 art-direction §14.2（幸存/需加强）

### 验收标准
- 明确"哪些细节在 32px 存活、哪些需放大或改用色块表达"

### 相关文件
- `docs/art/prompts/*`、`docs/art-direction.md` §14.2

---

## Art Gate: A-G2 | assignee: art

Title: 俯视角敌人验证 | Priority: P1 | Dispatch: 🔴（生 prompt 部分 🟢）

### 目标
把渗透体正面立绘概念转为**俯视角** sprite，确认轮廓/朝向/威胁在俯视 + 有限视野下可读（art-direction §14.1，DEC-007 已锁俯视角）。

### 具体要求
- [ ] art agent 出俯视角渗透体生成请求 → 🙋 人生图 → 过管线
- [ ] 放进裂隙占位场景实测轮廓/朝向/"是否发现我"的可读性
- [ ] 校准"渲染崩坏"签名（避免"像鬼"而非"像坏掉的 sprite"，§14.5）

### 验收标准
- 俯视角渗透体在 32px + 视野遮罩下轮廓可辨、朝向可读、威胁可感

### 相关文件
- `docs/art/prompts/*`、`docs/art-direction.md` §14.1/§14.5

---

## Art Gate: A-G3 | assignee: art + code

Title: 合成测试（纯俯视像素路线表现力验证 + 调优） | Priority: P0 | Dispatch: 🔴（人只碰生图+审美） | Status: **✅ PASS（2026-07-31）** — 结论见 DEC-018 与 art-direction §14.3。纯俯视像素路线成立；破马赛克的正解是**程序化连续表面**（地面 + 墙），而非离散 AI tile。实测产物：`docs/art/demos/rift-synth/`（loop1-5 = AI-tile 尝试，已被否；`floor.f3` / `scene.s3` = 程序化胜出）。实机化转入 Part C。

### 目标
证明并调优**纯俯视角像素路线**能合成出接近参考图的**氛围**（不追等距纵深，DEC-007）；验证"模块化多样性能压住网格马赛克"。

### 上下文
这是 Slice 1 最高风险的方向性验证，但**不是回炉门禁**（视角/风格已锁）。它的渲染路径就是 T5/T6 的 TilemapRenderer + VisibilitySystem，故 A-G3 天然是实现第一段，非独立前置工序。

### 步骤分解（agent 驱动，人只碰第 3、7 步）
| 步 | 做什么 | 谁做 |
| - | ------ | ---- |
| 1 | 列出 tile/decal 清单（地面变体×N、墙、数据错误块、裂缝 decal） | art agent |
| 2 | 为每块写生成 prompt（固定前缀 + 本块描述） | art agent |
| 3 | 用 prompt 在外部模型生成单块原图 | 🙋 人（唯一：外部生图） |
| 4 | 逐块过 `npm run art:postprocess` + `art:verify` 到合规资产 | code agent |
| 5 | 搭最小合成场景（真实 tilemap 渲染 + 覆盖层 decal + 有限视野光照），输出截图 | code agent |
| 6 | 结构性自检（重复感 / 边界马赛克 / 色板合规）+ 与参考图并排 | code/art agent |
| 7 | 最终审美判断（够用则锁定；不够则在同路线内加强，不回炉） | 🙋 人（唯一：最终审美） |

### 约束
- 管线输入 = **单块 tile/sprite 原图**，绝不喂整场景概念图（art-direction §9.1 铁律）
- 破除马赛克靠模块化多样性（tile 变体 + 过渡 tile + 覆盖层 decal + 道具密度 + 光照），不靠统一网格（DEC-007 留用原则）

### 验收标准
- 合成截图与参考图并排，人判定纯俯视像素路线的氛围"够用/不够用"
- 若不够用，产出"在同路线内加强"的具体清单（加哪些过渡 tile/decal/光照），而非改视角

### 相关文件
- `docs/art/prompts/*`、`docs/art/pipeline.*.config.json`、`docs/art/palette.json`
- `docs/art-direction.md` §14.3、`docs/progress/decisions-log.md` DEC-007
