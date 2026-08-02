---
status: ACTIVE
created-by: director agent
created-when: 每个 Slice 开始时
last-modified: 2026-08-02
note: Slice 1 范围已由人拍板锁定（2026-07-24）。三项设计取舍已决：固定地图 / 纳入简化战斗 / 只做裂隙出击环。设计阶段（T1-T4）已收口，2026-07-29 进入实现阶段。2026-08-02：T5/T6/T7/T8 均 Done 且已过整体 review（含清理临时脚手架），待人试玩验证；下一个是 T9（搜刮 + 混乱值 + 撤离 + HUD）。任务 Brief 见 docs/tasks/slice-1.md。
---

# Slice 1: 裂隙潜行核心手感 【ACTIVE — 已锁定 2026-07-24】

类型：系统
日期：2026-07-24 启动
验证问题：**裂隙出击环**（进入裂隙 → 有限视野潜行 → 遭遇一种敌人（可潜行绕过或简化战斗）→ 搜刮薪柴 → 混乱值压力上升 → 玩家自行决定撤离）的**紧绷决策手感是否成立**？"还敢不敢再多拿一点"（贪婪 vs 撤退）的博弈是否让人上头？

> ✅ **范围已锁定（2026-07-24）。** 三项设计取舍由人拍板：① 地图 = code agent 写死的固定地图；② 纳入简化战斗；③ 本 Slice 只做裂隙出击环，净化点环留 Slice 2。任务 Brief 见 `docs/tasks/slice-1.md`。

---

## Slice 1 范围推导（依据 guides/10-slice-model.md）

规则："Slice 1 = 核心循环的最小可交互版本"，问"最少需要什么才能让一个人体验到这个循环一次"。

vision 的完整核心循环 = **裂隙出击环** + **净化点环**。完整闭环对单个 Slice 过大（预估 >7 天），因此**循环拆为两个 Slice**（取舍③已决：拆分）：
- **Slice 1（本 Slice）= 裂隙出击环**：验证 moment-to-moment 的潜行 + 资源博弈手感（体验支柱 1「绝望边缘的紧绷」+ 支柱 2「贪婪与撤退的博弈」）。这是全游戏最核心、风险最高、最该早验证的部分——若这一层不成立，后面的元循环无意义。
- **Slice 2 = 净化点环**：撤离 → 薪柴分配 → 冲击结算 → 受损后果反馈（见 roadmap）。

### 锁定的 Slice 1 最小范围（来自 vision MVP · 裂隙层）

1. 俯视角移动 + 有限视野（Raycasting 视野遮罩，视野外黑暗）— 核心体验支撑，不可省
2. **一张 code agent 写死的固定裂隙地图**（含障碍布局 + 多路线 + 搜刮点 + 撤离点 + 敌人位）— 取舍①：固定地图，不上程序生成
3. 一种基础敌人（巡逻路径 + 感知范围 + FSM：巡逻/警觉/追击）
4. **简化战斗**（玩家可攻击敌人 + 敌人可伤害玩家 + 受伤/死亡处理）— 取舍②：纳入简化版
5. 薪柴搜刮（地图散布，部分安全 / 部分被敌人看守 → 制造博弈）
6. 混乱值系统（匀速上涨 + UI 显示 + 至少一种超阈值惩罚，如视野缩小）
7. 撤离机制（地图上有撤离点，进入触发半径后按 E 确认结束本次出击 — DEC-011）
8. 占位资产（按 art-direction.md §12 占位策略：色块 + 代码绘制的视野/光照，不等正式 AI 资产）

### 暂不纳入（推迟到后续 Slice，保持 Slice 1 可验证且够小）

- 净化点 / 冲击结算（→ Slice 2）
- 程序化地图生成 Voronoi+CA（→ 后续 Slice；本 Slice 用固定地图）
- 第二种敌人、功能物品、音频资产、跨 session 存档、多语言接入（→ backlog / 后续 Slice）

---

## 设计取舍（已由人拍板，2026-07-24）

| # | 决策点 | **人的决定** | 说明 |
| - | ------ | ------------ | ---- |
| 1 | 地图生成：程序 Voronoi+CA 还是固定地图？ | **固定地图**（code agent 写死 tile 数据） | 潜行/战斗手感验证不依赖随机性；避开程序生成 6-10h + 调参风险。Voronoi+CA 留后续 Slice。 |
| 2 | 战斗是否纳入？ | **纳入简化战斗** | 人判断"没有战斗无法判断敢不敢拿"。范围略增（+1 战斗 spec + 实现），已接受。 |
| 3 | Slice 边界：拆分还是合并？ | **拆分**（Slice 1=裂隙出击环，Slice 2=净化点环） | 每个 Slice 3-7 天可完成、可独立验证。 |

---

## 任务（已锁定；详细 Brief 见 docs/tasks/slice-1.md）

> 派发列：🟢 Director 可直接派发 / 🔴 人主导（人拍板 + 驱动对应 agent 执行，**非人肉手工**——见 director.md）。

| ID | 任务 | Agent | 派发 | 状态 | 依赖 | 备注 |
| -- | ---- | ----- | ---- | ---- | ---- | ---- |
| T1 | 设计 spec：移动 + 有限视野系统（含 schema/接口） | design | 🔴 | Done | - | docs/specs/system-movement-vision.md；7 项 escalate 已全部闭合（见该 spec 的决策落定块） |
| T2 | 设计 spec：敌人 AI（FSM + 感知） | design | 🔴 | Done | - | docs/specs/system-enemy-ai.md |
| T3 | 设计 spec：混乱值 + 搜刮 + 撤离 | design | 🔴 | Done | - | docs/specs/system-chaos-scavenge-extract.md |
| T4 | 设计 spec：简化战斗 | design | 🔴 | Done | - | 取舍②新增；docs/specs/system-combat.md |
| T5 | 实现：移动 + 视野（占位资产） | code | 🔴 | **Done**（2026-07-29） | T1 | `src/entities/player.ts` + `src/systems/visibility-system.ts` + `src/utils/grid-raycast.ts`；constants `VISIBILITY` 段已整段替换；`setRadiusScale()` 缓存失效已补并回填 T1 规则 20。**待人做键盘手感试玩**（见下方"T6/T5 完成记录"） |
| T6 | 实现：固定裂隙地图（写死 tile 数据 + TilemapRenderer 渲染） | code | 🔴 | **Done**（2026-07-29） | T1 | `src/scenes/rift-map-data.ts`（ASCII 固定地图 + 布点）+ `src/systems/tile-grid.ts` + `src/systems/tilemap-renderer.ts`；T7/T9 的消费数据（8 个薪柴点 / 撤离点 / 4 个巡逻单位路点）已就绪 |
| T7 | 实现：敌人 AI + 感知 | code | 🔴 | **Done**（2026-07-31） | T2,T5,T6 | `src/systems/ai/`（ai-system/state-machine/behaviors/context/index）+ `src/systems/pathfinding.ts` + `src/entities/enemy-factory.ts` + `src/types/ai-types.ts` + `src/config/invariants.ts`；rift-scene 已接线。**核实证据见下方"T7 完成记录"**：六条不变量成立且有 dev 启动断言；运行时 A\* 调用 0（巡逻腿全预计算）；N2 不许切角实测；4 个渗透体持续巡逻、AI 0.00–0.10ms/帧。实现期修掉两个 bug（卡墙 / 看门狗测错时机，见 DEC-021）。**遗留**：状态可读性与五态降级链需真人试玩确认（浏览器无法模拟按住方向键）；`ASTAR_MAX_NODES` 余量建议 Director 复核 |
| T8 | 实现：简化战斗（玩家攻击 + 敌人伤害 + 受伤/死亡） | code | 🔴 | **Done**（2026-08-01） | T4,T5,T7 | 取舍②新增；`src/systems/combat-system.ts`；constants `COMBAT` 段补全 20 键、`events.ts` 加 `ENEMY_DAMAGED.source?` + 三条语义注释（零新增事件）、`invariants.ts` 加 K1/K2/K3/K5、rift-scene 接线（`combat.update` 在 `ai.update` 之后）。**核实证据见下方"T8 完成记录"**：实机三刀击杀 / 被打死全流程实测，事件序列逐条核对。新增 **DEC-023**。**遗留**：美术口径（白闪毫秒 + 白色=攻击语义）仍挂起；数值校准与手感需真人试玩 |
| T9 | 实现：薪柴搜刮 + 混乱值 + 撤离 + HUD | code | 🔴 | Todo | T3,T5,T6 | - |
| T10 | QA 验收（对照 spec） | qa | 🟢 | Todo | T5-T9 | 门禁前 |
| **美术门禁（并行验证，依据 art-direction.md §14）** |||||||
| A-G1 | 32px 尺度可读性实测：把关键 tile/sprite 缩到 32px + 视野遮罩下确认细节是否幸存 | art | 🔴 | Todo | - | 验证 art-direction §14.2 |
| A-G2 | 俯视角敌人验证：将正面立绘概念转为俯视角 sprite，确认轮廓/朝向/威胁可读 | art | 🔴 | Todo | - | 验证 art-direction §14.1 |
| A-G3 | **合成测试（表现力验证）** | art/code | 🔴 | **✅ PASS（2026-07-31）** | - | 验证 art-direction §14.3。**结论（DEC-018）**：纯俯视像素路线成立；破马赛克正解＝**程序化连续表面**（地面 + 墙），非离散 AI tile。产物 `docs/art/demos/rift-synth/`（`scene.s3`）。实机化转 Part C |

> 说明：美术门禁（A-G1~3）是验证 art-direction.md 第 14 节遗留假设的任务，可与游戏系统实现并行；Slice 1 玩法本身用占位资产推进，不被美术门禁阻塞。**其中 A-G3（合成测试）验证并调优纯俯视像素路线的表现力**（视角/风格已按 DEC-007 锁定为 Darkwood 路线，**不再是回炉门禁**）：证明够用则锁定，不够则在同一路线内加强 tile 多样性/过渡 tile/覆盖层 decal/光照，建议尽早做、让证据说话。

### A-G3 合成测试步骤分解（agent 驱动，人只碰生图+审美）

| 步 | 做什么 | 谁做 |
| - | ------ | ---- |
| 1 | 列出合成测试所需 tile/decal 清单（地面变体×N、墙、数据错误块、裂缝 decal） | art agent |
| 2 | 为每块 tile/decal 写生成 prompt（固定前缀 + 本块描述） | art agent |
| 3 | 用 prompt 在外部模型生成单块原图 | 🙋 人（唯一：外部生图） |
| 4 | 逐块过 `npm run art:postprocess` + `art:verify` 处理为合规资产 | code agent |
| 5 | 搭最小合成场景：真实 tilemap 渲染 + 覆盖层 decal + 有限视野光照，输出截图 | code agent |
| 6 | 结构性自检（重复感 / 边界马赛克 / 色板合规）+ 截图与参考图并排 | code/art agent |
| 7 | 看合成效果做最终审美判断（够用则锁定；不够则在同路线内加强，**不回炉**——见 DEC-007） | 🙋 人（唯一：最终审美） |

> 人肉参与仅第 3、7 步；其余全部 agent 执行、Director 编排（对应 director.md 的"人肉手工唯二例外"）。第 5 步的合成场景不是一次性玩具——它就是 Slice 1 真实渲染路径（TilemapRenderer + VisibilitySystem）的提早落地，因此 A-G3 天然是 Slice 1 实现的**第一段**，而非独立于 Slice 之外的前置工序。

> ⚠️ **上表流程已被 DEC-018 取代（2026-07-31）**：第 1-3 步（AI 生离散 tile）实测会产生特征重复，已废弃。地面/墙改为**程序化连续生成**（无需外部生图）；AI 生图只保留给离散 sprite。A-G3 已 PASS，实机化见 Part C。保留上表仅作历史记录。

## 实现阶段开工记录（2026-07-29）

设计阶段（T1-T4，四份 spec）已收口，实现阶段以**双线并行**开工：

- **代码线**：code agent 连做 **T6 → T5**。先 T6 的理由是 VisibilitySystem 的 raycasting 遮挡必须有真实墙体网格才能验证，墙体网格是 T6 的产出；反过来做会返工。两者都写 `src/scenes/rift-scene.ts`，因此归同一个 agent 一次性做完，避免撞车。
- **美术线**：art agent 做 A-G3 的第 1、2 步（tile/decal 清单 + 逐块生成 prompt），与代码线零依赖。第 3 步（外部生图）需要人；第 4-6 步（过管线 + 搭合成场景 + 自检）在 T5/T6 落地后由 code agent 接手。

本轮同时闭合的遗留项：

- `CHAOS.BASE_RATE` 1.5 → 0.8 已由人拍板，记为 **DEC-014**。spec 已改为决定值；`src/config/constants.ts` 仍是 1.5，**由 code agent 在 T9 落地**。
- T1 的 7 项 escalate 全部闭合（见 `system-movement-vision.md` 的决策落定块），上方 T1 行的旧备注已更正。
- T3 escalate 第 8 项（与 T2 事件语义交叉核对）已由 Director 核对完毕并关闭：`ENEMY_ALERT.alertLevel` 三级语义与 `ENEMY_LOST_PLAYER` 时机两侧一致，"suspicious 档不计混乱值"也吻合，无需回改任何 spec。
- ⏰ **待 Slice 1 整合时处理**：`docs/architecture.md` 与 `docs/art-direction.md` 的 frontmatter `changed-this-slice: true` 本轮**故意不动**，留到 Step 7 整合时与其他文档的变更标记一起统一重置为 `false`。

## T6/T5 完成记录（2026-07-29，code agent）

**新增代码**：`src/types/map-types.ts`、`src/systems/tile-grid.ts`、`src/systems/tilemap-renderer.ts`、`src/scenes/rift-map-data.ts`、`src/utils/grid-raycast.ts`、`src/entities/player.ts`、`src/systems/visibility-system.ts`。**改动**：`src/config/constants.ts`（`VISIBILITY` 整段替换 + 移动参数 + `CAMERA.ZOOM`，**`CHAOS` 段未动**）、`src/scenes/rift-scene.ts`（占位 → 真实场景）、`src/scenes/boot-scene.ts`（占位资产按 art §12 更新 + tileset）、`src/types/game-types.ts`（`Facing4`）、`src/scenes/main-menu-scene.ts`（ENTER/SPACE 开局）。已登记 `architecture.md` 模块注册表；新增 DEC-015/016/017。

**实测结论**：
- 取景：`camera.setZoom(1.5)` 已设，调试覆盖层读数 `viewport 640x427px = 20.0x13.3 tiles`，与 DEC-009 目标一致。
- 遮挡：对 T6 真实墙体网格实测通过（射线在手工编排的 col-12 挡板处停住、在挡板留出的缺口行穿过、走廊之间互不透视；对角缝隙规则生效）。
- 性能：60 条射线一次全视野扫描 mean 0.008 ms / p99 0.016 ms（Node，1098 个地面格采样）；浏览器内 `avg 0.10ms`，预算 2 ms。玩家静止时命中缓存、射线开销为 0。
- 地图行走成本（纯步行，160 px/s）：短路线 177 格 ≈35 s，长路线 228 格 ≈46 s，全清 ≈297 格 ≈59 s。

**遗留（需 Director/人处理）**：
1. **键盘手感未经人试玩**：Cursor 浏览器视图无法模拟"按住不放"，移动/加减速/沿墙滑动/朝向转动只经代码与静态渲染验证，未做真人手感确认。请人在 `npm run dev` 下用 WASD 跑一遍（`#rift` 可直达裂隙）。
2. **`BASE_RATE = 0.8` 的时长前提与本地图实测不符**：T3 推算假定全清 ≈220 s，本地图纯步行仅 ≈59 s。差额必须靠"等巡逻窗口"补足。**T9 落地 0.8 后、T10 必须实测重算**（校准目标：全清时间 ≈ 到达 HARD_CAP 时间 × 1.15）。若实测差距仍大，是调 `BASE_RATE` 还是加大地图，需人拍板。
3. **无自动化测试基础设施**：本次的遮挡/性能验证是一次性脚本，未留在仓库（项目没有测试框架）。是否引入（如 Vitest）是架构决策，留给 Director。

## T7 完成记录（2026-07-31，code agent）

**新增代码**：`src/systems/ai/ai-system.ts`（编排器：感知 tick / 寻路预算 / 刺激入口 / 生命周期）、`src/systems/ai/state-machine.ts`（FSM + 察觉度 + 事件契约）、`src/systems/ai/behaviors.ts`（五态行为 + 转向/分离/路径跟随）、`src/systems/ai/context.ts`、`src/systems/ai/index.ts`（公共出口）、`src/systems/pathfinding.ts`（grid A*）、`src/entities/enemy-factory.ts`、`src/types/ai-types.ts`、`src/config/invariants.ts`。

**改动**：`src/scenes/rift-scene.ts`（接线 + 调试面板加 AI 读数）、`src/config/constants.ts`（`AI` 段按 spec 参数表整段重写；旧键 `SIGHT_ANGLE: 90` 已删除，替换为 `SIGHT_HALF_ANGLE_CORE` 55 / `SIGHT_HALF_ANGLE_PERIPH` 90 —— escalate ⑥ 落地）、`src/utils/grid-raycast.ts`（新增 `hasClearPath()`，DEC-021）、`src/utils/math.ts`（新增 `shortestArc` / `stepAngleToward` / `quantizeFacing4` / `FACING4_ANGLES`）、`src/entities/player.ts`（改用上述共享转向/量化助手，使敌人与玩家的朝向量化是**同一份实现**而非副本；数学等价，手感不变）、`src/scenes/boot-scene.ts`（敌人占位改为可读朝向的五边形 + teal 指示物纹理）、`src/main.ts`（dev 启动断言）。

**核实证据**（2026-07-31）：
- typecheck 干净（仅剩 T8 并行在写的 `combat-system.ts` 报错，非本任务文件）。项目未配置 eslint，`ReadLints` 对 `src/` 无告警。
- 六条平衡不变量实测成立：I1 180<224 / I2 210<224 / I3 130<160 / I4 60≤80 / I5 100<180 / I6 360<1080。已加 dev 启动断言（DEC-020），破坏任一条则启动即抛错。
- 寻路预算实测（headless，真实 64×44 地图）：巡逻腿全部 create 时预计算（4 个单位共 8 条腿，合计 ~1.3 ms），**运行时 A\* 调用数为 0**（实机调试面板 `A* calls 0`）；跨图最坏 A\*（spawn→exit）1050 节点 / 0.31 ms 均值 / 2.39 ms 首次（含 JIT），400 次追击距离内（≤320 px）搜索 worst 0.34 ms / avg 0.02 ms，均远低于 5 ms 预算。
- 规则 N2「不许切角」用合成网格实测：对角缝隙两侧皆墙时 A\* 判无路，`hasLineOfSight` 同样为 false —— 寻路与视线的几何纪律一致。
- 实机：无 console 错误；4 个渗透体全部生成并**持续沿路点巡逻**（pingpong 端点掉头、loop 绕行均实测），`want 60 / got 64` px/s，`stuck 0`；敌人在视野锥外正确不渲染。AI 每帧 0.00–0.10 ms（5 敌人预算 1.5 ms）。

**实现期修掉的两个 bug（首次冒烟截图之后才发现，早期截图里的 "patrol" 是静止的假象）**：
1. **卡墙**：路径平滑（N7）与直线优先（N4）用的是点大小的视线判定，产出了 20 px 身体过不去的捷径，敌人在 col-19 挡板处停住。改为宽度感知的 `hasClearPath()`（**DEC-021**），从成因上修掉，也就地回答了 spec 的待验证假设「N4 会不会斜穿窄缝卡墙」。
2. **卡死看门狗测错时机**：Arcade 在场景 UPDATE 积分物理、但只在 POST_UPDATE 把结果写回 sprite，所以在 `Scene.update()` 里测位移恒为 0 —— 看门狗每 400 ms 误判一次"卡住"，把预计算的巡逻路径清掉且无法恢复。位移测量已移到 `postUpdate()`；巡逻腿现在会被记住并可就近续接。

**fps 观察更正**：调试面板的 33 fps 是**浏览器标签未聚焦时的节流**，与 AI 开销无关（AI 0.00–0.10 ms/帧、视野系统命中缓存 0.00 ms）。T5 在聚焦下实测 60。仍建议 post-T8 review 时在聚焦窗口复测一次确认。

**遗留（需人试玩 / QA T10 覆盖）**：
1. **状态可读性（R1/R2/R3）未经真人确认**：Cursor 浏览器无法模拟"按住方向键"（与 T5 同一限制），玩家走不到敌人身边，因此 SUSPICIOUS 的「停下→转身→慢速接近」预警窗口、teal 指示物的呼吸/闪烁/常亮三态、追击残影都只经代码与静态渲染验证。
2. **五态降级链未做端到端实机走通**：CHASE →0.4s→ ALERT →5s→ SUSPICIOUS →3s→ RETURN →PATROL 的转换表已逐条实现且计时器集中在 constants，但需要有人真的被追一次才能确认时序读起来对。调试面板已按敌人逐行显示 `state / det / 距离 / engaged`，供 QA 直接读。
3. ~~**`AI.ASTAR_MAX_NODES` = 1200 余量偏薄**~~ → **Director 已裁定抬到 3000（DEC-022 ①）**：跨图最坏 1050 节点仅 0.31 ms，5 ms 预算下抬高不违反架构约束，同时给 RETURN 跨图留余量。`constants.ts` 与 spec 参数表/N6 均已更新。

**Director 裁定（2026-08-01）—— T7 实现期 5 项 escalate 全部收口，见 DEC-022**：① ASTAR 1200→3000（已应用）；② ALERT 重锁补「非盲区」条件（agent 已按此实现，spec 规则 3 已补，理由=不破坏"每次被发现可回溯"承诺）；③ N6 补 ALERT/SUSPICIOUS 寻路失败兜底（纯技术，无可感知行为变化，spec 已补）；④ `peakAlertLevelThisEpisode` 未用字段确认弃用（去重由 `lastEmittedLevel`+冷却覆盖，spec 标为可选）；⑤ N8「远处不寻路」限定为巡逻态、RETURN 仍给最低优先级 A\*（spec 已澄清）。**均为 Director 权限内的技术/口径裁定，无接口变更，不影响 T3/T4，不阻塞已在飞的 T8。**

## T8 开工核实（Director，2026-07-31）

依赖 T4/T5/T7 全部满足，无阻塞：
- `docs/specs/system-combat.md` = ACTIVE（T4 Done），含五个事件的契约、K1–K6 平衡不变量、A/E/H/V 四组规则、场景层接线清单。
- T5：`Player` 已暴露 `getPosition()` / `getFacingAngle()` / `setSpeedModifier(source, m)` / `clearSpeedModifier(source)`，即 spec 要求的全部四个接触点；`utils/grid-raycast` 的 `hasLineOfSight()` 就绪。
- T7：`AISystemAPI` 已暴露 `getEnemies()` / `getEnemyById()` / `reportNoise(pos, radius, level)` / `reportDamage(enemyId, sourcePos)` / `despawn(enemyId)` / `onPlayerLost()`，与 spec 的 `AISystemReadView` + 三个刺激入口完全对齐。
- **事件已就位**：`src/types/events.ts` 中 `PLAYER_DAMAGED` / `PLAYER_HEALTH_CHANGED` / `PLAYER_DIED` / `ENEMY_DAMAGED` / `ENEMY_KILLED` 五个事件及 payload 全部存在，spec 的声称属实，**T8 不需要新增任何事件**。
- **场景层已预接线**：`rift-scene.ts` 的 `bindAIStimuli()` 已把 `ENEMY_DAMAGED → ai.reportDamage`、`ENEMY_KILLED → ai.despawn`、`PLAYER_DIED → ai.onPlayerLost` 接好，T8 只需补 `combat.create(..., { onNoise })` 与 `combat.update(dt)`（**必须排在 `ai.update()` 之后**）。
- `constants.ts` 的 `COMBAT` 段现有四键（`PLAYER_DAMAGE` 25 / `ATTACK_COOLDOWN` 500 / `ATTACK_RANGE` 40 / `ENEMY_DAMAGE_BASE` 15）与 spec 一致，T8 为纯新增。

**Director 拍板的 escalate 结论（沿用，写给 T8）**：
- escalate ③：噪声走注入回调 `CombatHooks.onNoise`，**不新增 `COMBAT_NOISE` 事件**（Director 已确认；先例是 T3 的 `getChaosModulators` 场景层转发）。
- escalate ④/⑤：建议记入 decisions-log 的 **DEC-012**（75 HP = 三刀、伤害零随机）与 **DEC-013**（代价双轨 + 战斗定位为止损工具），T8 按此实现。
- escalate ⑦（T2 侧）：`AI_STANDOFF_DISTANCE` 保持 30，不变量 K2 的 30 < 38 < 40 成立。
- escalate ①/②（art agent 口径确认）**仍挂起**：白闪毫秒口径与"白色=攻击语义"未获美术确认。T8 按 spec 建议值实现占位（`PLAYER_HIT_FLASH_MS` 100 / `ENEMY_HIT_FLASH_MS` 80，白色扇形/细线），**不视为美术规则定案**，留 art agent 后续裁定。
- escalate ⑥：一次命中的混乱值总量已列入 T10 QA 专项测量（见 T10 brief）。

## T8 完成记录（2026-08-01，code agent）

**新增代码**：`src/systems/combat-system.ts`（玩家挥击时序 + 前向扇形命中 + 敌人反击 token 机制 + 生命值/无敌帧/死亡 + 白色占位表现与死亡特效池）。

**改动**：`src/config/constants.ts`（`COMBAT` 段按 spec 参数表补全，现有四键原值未动）、`src/types/events.ts`（`ENEMY_DAMAGED` 加可选 `source?: 'player'` + `PLAYER_DAMAGED.source` / `PLAYER_DIED.cause` 语义注释，**零新增事件枚举**）、`src/config/invariants.ts`（加 K1/K2/K3/K5 + 派生值自检 S1；原 S1「STANDOFF < ATTACK_RANGE」被更强的 K2「30 < 38 < 40」取代，不再重复检查）、`src/scenes/rift-scene.ts`（`combat.create/update/destroy` 接线、空格键边沿触发、噪声回调、`RIFT_EXITED` 也归入 run-ended、调试面板加战斗读数）、`src/entities/enemy-factory.ts`（导出 `ENEMY_BODY_TEXTURE`，供战斗把白闪画成同一轮廓）。`src/entities/player.ts` **未改**（见 DEC-023）。

**实机核实证据**（浏览器无法模拟按键 —— 与 T5/T7 同一限制，故用一次性 DEV 脚本驱动真实引擎，验证后已移除；截图与事件日志见汇报）：
- **三刀击杀，零随机**：`ENEMY_DAMAGED{amount:25,source:'player'}` ×3（敌人 hp 75→50→25）后 `ENEMY_KILLED{enemyId,position}`，敌人同帧从 AI 名册消失（`getEnemyHealth` 返回 undefined / `isEnemyAlive` false）。第 4 刀落在已死目标上无任何事件。
- **超距不命中**：敌人在 52 px 与 70 px 时挥击不产生任何 `ENEMY_DAMAGED`（`ATTACK_RANGE` 40 生效）；`suspicious r96` 挥击噪声照常发出（空挥有声、不计混乱值）。
- **被打死全流程**：`PLAYER_DAMAGED{amount:15,source:'ENM_INF_02'}` → `PLAYER_HEALTH_CHANGED` 成对出现且顺序固定，血量 100→85→70→55→40→25→10→0（**7 次，K5 成立**），末尾 `PLAYER_HEALTH_CHANGED{0,100}` → `PLAYER_DIED{cause:'enemy_attack'}` 仅一次，之后 `tokens 0`、无后续伤害。
- **敌人出手节拍**：连续受击间隔实测 ~1593 ms ≈ 前摇 350 + 冷却 1200（+1 帧），与 spec 一致；无敌帧 400 ms 远短于该间隔，单敌人战斗不会免伤。
- **噪声三档经回调转 `reportNoise`**：实测观察到 `suspicious r96`（挥击/空挥）与 `alert r160`（命中）；`alert r192`（击杀）与击杀事件同函数同调用栈，击杀路径已实测走通。调试面板新增 `noise` 读数，供 T10 做"一次命中的混乱值总量"专项测量。
- **占位视觉**：白色 1px 扇形描边（半径 40 / 张角 120°、不填充）、敌人前摇白色细线（长 38、alpha 0.2→0.8）、受击白闪均已在实机截图确认。
- typecheck 干净；`npm run build` 通过。**项目未配置 eslint**（无 `lint` script、无配置、无依赖），与 T7 记录一致；`ReadLints` 对本次改动文件无告警。

**遗留（需人/art/QA）**：
1. **美术口径仍挂起**（spec escalate ①②）：白闪毫秒数与"白色 = 攻击动作"未获 art agent 确认，当前全部按 spec 建议值实现为占位。**新增一条相关发现**：玩家占位本体就是纯白方块，纯白覆盖在它身上不可见，现用"比本体略大 6 px 的白色方块"来让受击可读 —— 这是占位妥协，需 art 一并裁定。
2. **手感/数值需真人试玩**：锁定朝向是否读作"有分量"、350 ms 前摇 + 220 ms 出手僵直的躲避窗口是否"紧张而非苛刻"、三刀规模是否合适，全部依赖真人操作确认。
3. **`reset()` 未接线**：按 R 重开归 T9 的 `RunController`，`combat.reset()` 已实现待调用；`setEnabled(false)` 已接 `PLAYER_DIED` / `RIFT_EXIT_REACHED` / `RIFT_EXITED`。
4. **初始 `PLAYER_HEALTH_CHANGED{100,100}` 在 `combat.create()` 内发出**：T9 的 HUD 必须在 `combat.create()` 之前订阅，否则收不到开局血量。

## T8 后整体 review（2026-08-02，主控）

T7+T8 落地后做了一次整体 review + 清理，结论：**可以交人验证**。

**静态质量：优秀**
- `npm run typecheck` + `ReadLints` 全过（项目未配 eslint）。
- `src/config/invariants.ts` 把 I1–I6（敌人）+ K1/K2/K3/K5/S1（战斗）做成 dev 开机断言，破坏即抛错；开机未抛错 = 全部通过。K4/K6 不可机检、正确留 review。
- 架构干净：战斗与 AI 互不直接调用，`rift-scene` 转发事件（DEC-ARCH-002）；`combat.update` 严格排在 `ai.update` 之后；DEC-012/013 已入账。

**运行时：健康**（干净 `#rift`，聚焦窗口）
- 无 console 错误；**fps 60**（早先 33 是标签页未聚焦节流，非性能问题；系统总耗时 ~0.2 ms/帧）。
- 4 个渗透体正确生成、HP 75、巡逻；玩家 HP 100/100；空闲 4 s **无位移漂移**。
- 完整威胁闭环实测可用：巡逻→察觉(det 1.00)→追击→接敌→敌人攻击→玩家受伤→无敌帧。
- 证据图：`docs/art/demos/rift-synth/engine/rift-t7-smoke.png`、`rift-t8-review.png`。

**本轮清理（修复/优化）**
- 删除 T8 遗留的临时冒烟脚手架 `src/scenes/_combat-smoke.ts`（文件头自注"Delete after use"；T8 记录称"验证后已移除"实际漏了此文件）+ `rift-scene.ts` 里的 DEV/hash 钩子（`#rift-combat` 动态 import 与 `reportNoise` 内的 smoke 日志）。删后 typecheck+lint 仍干净。
- 清掉 3 个 agent 冒烟测试残留的 dev server（3000/3002/3003），只留一个。

**交人验证前的"手感项"（非 bug，需真人判断）**：① `AI_DETECT_FILL_TIME`（察觉满格 0.45 s）反悔窗口手感；② 追击时敌人身体是否推挤玩家（干净 `#rift` 未复现，被追时留意）；③ 敌人不发光→被追时看不到身后追兵（DEC-007 有意设计，是"恐怖"还是"不公平"）。这三项与各完成记录里的遗留项一致，统一在 T10 QA / 人试玩时判定。

## 设计产出（本 Slice 新增/修改的文档）

- [x] docs/specs/system-movement-vision.md（移动 + 有限视野）
- [x] docs/specs/system-enemy-ai.md（敌人 FSM + 感知）
- [x] docs/specs/system-chaos-scavenge-extract.md（混乱值 + 搜刮 + 撤离）
- [x] docs/specs/system-combat.md（简化战斗）
- [x] docs/tasks/slice-1.md（Director 已拆解）

## 验收结果（Slice 结束时填写）

- QA 报告：[路径]
- 人验证结论：[通过 / 需迭代 / 失败]
- 备注：[...]

## Slice 回顾

- 完成：[N/M] 任务
- 学到了：[...]
- 下一步调整：[...]
