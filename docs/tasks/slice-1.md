---
status: ACTIVE
created-by: director agent
created-when: Slice 1 锁定时（2026-07-24）
last-modified: 2026-07-24
note: Slice 1 全部任务 Brief。范围三取舍已由人拍板：固定地图 / 纳入简化战斗 / 只做裂隙出击环。
---

# Tasks: Slice 1 — 裂隙潜行核心手感

Slice 类型：系统
验证问题：**裂隙出击环**（进入裂隙 → 有限视野潜行 → 遭遇一种敌人（可潜行绕过或简化战斗）→ 搜刮薪柴 → 混乱值压力上升 → 玩家自行决定撤离）的**紧绷决策手感是否成立**？"还敢不敢再多拿一点"（贪婪 vs 撤退）的博弈是否让人上头？

**锁定的范围取舍（DEC 记录见 decisions-log / current-slice）：**
- ① 地图 = **code agent 写死的固定地图**（非程序生成；Voronoi+CA 留后续 Slice）
- ② **纳入简化战斗**
- ③ 只做**裂隙出击环**（净化点环 → Slice 2）

**派发说明：** 🟢 Director 可直接派发 / 🔴 人主导（人拍板 + 驱动对应 agent 执行，**非人肉手工**）。真正的人肉触点全项目只有两个：外部生图、最终审美/体验判断（见 director.md）。

**执行顺序建议：** T1-T4（设计 spec）先行 → T5/T6（移动+视野、固定地图，即真实渲染路径）作为实现第一段，A-G3 合成测试搭在这一段上 → T7/T8/T9（AI/战斗/搜刮混乱撤离）→ T10 QA。美术门禁 A-G1~3 与实现并行，不阻塞玩法（玩法用占位资产）。

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

Title: 实现 — 移动 + 有限视野（占位资产） | Priority: P0 | Dispatch: 🔴

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

Title: 实现 — 固定裂隙地图（写死 tile 数据 + 渲染） | Priority: P0 | Dispatch: 🔴

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

Title: 实现 — 敌人 AI + 感知 | Priority: P0 | Dispatch: 🔴

### 目标
按 T2 spec 实现渗透体的 FSM + 感知 + 巡逻/追击。

### 具体要求
- [ ] FSM（巡逻/警觉/警报/追击）+ 转换；感知（视野范围/角度 + 视线遮挡）
- [ ] 沿固定路点巡逻；发现玩家→追击；失去目标→降级
- [ ] grid A* 寻路，分帧计算（每帧最多 1 次 A*）
- [ ] 占位：敌人=暗红多边形（art-direction §12）；发出 `ENEMY_ALERT`
- [ ] 占位期可读性：让玩家能从占位表现看出当前状态（如颜色/闪烁区分警觉/追击）

### 约束
- 只做渗透体一种；遵守 architecture 性能规则

### 验收标准
- 敌人巡逻、被视线遮挡时看不到玩家、发现后追击、跟丢后回巡逻
- 状态对玩家可读（占位期即可判断"它是否发现了我"）

### 相关文件
- `src/systems/ai/state-machine.ts`、`src/systems/ai/behaviors.ts`、`src/systems/pathfinding.ts`、`src/entities/enemy-factory.ts`

---

## Task: T8 | assignee: code

Title: 实现 — 简化战斗 | Priority: P1 | Dispatch: 🔴

### 目标
按 T4 spec 实现玩家攻击、敌人伤害玩家、受伤/死亡，含"战斗有代价"。

### 具体要求
- [ ] 玩家攻击判定 + 敌人 HP/死亡；敌人攻击 + 玩家 HP/死亡（死亡=出击失败）
- [ ] "代价"钩子：攻击/被追击提升混乱值上涨（与 T9 混乱值对接）
- [ ] 受伤视觉：sprite 白闪 1-2 帧；发 `PLAYER_DAMAGED`
- [ ] 与 T7 敌人状态联动（战斗噪声可惊动/升级敌人警觉）

### 约束
- 最简实现，Arcade 判定；保持"潜行仍更划算"

### 验收标准
- 可打死渗透体、可被打死并正确结束出击；试玩能感到"打是有代价的"

### 相关文件
- `src/systems/combat-system.ts`、`src/entities/player.ts`、`src/entities/enemy-factory.ts`

---

## Task: T9 | assignee: code

Title: 实现 — 薪柴搜刮 + 混乱值 + 撤离 + HUD | Priority: P0 | Dispatch: 🔴

### 目标
按 T3 spec 实现博弈三件套 + 最小 HUD，让裂隙出击环闭合可玩。

### 具体要求
- [ ] 薪柴：地图散布拾取（部分安全/部分被守）；`KINDLING_COLLECTED`
- [ ] 混乱值：匀速上涨 + 至少一级超阈值惩罚（视野缩小/teal 噪点，接 T5 视野）；`CHAOS_CHANGED` / `CHAOS_THRESHOLD_REACHED`
- [ ] 撤离：到达撤离点结束出击、结算带出薪柴；`RIFT_EXIT_REACHED`
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

Title: 合成测试（纯俯视像素路线表现力验证 + 调优） | Priority: P0 | Dispatch: 🔴（人只碰生图+审美）

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
