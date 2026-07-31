---
status: ACTIVE
created-by: director agent
created-when: 每个 Slice 开始时
last-modified: 2026-07-29
note: Slice 1 范围已由人拍板锁定（2026-07-24）。三项设计取舍已决：固定地图 / 纳入简化战斗 / 只做裂隙出击环。设计阶段（T1-T4）已收口，2026-07-29 进入实现阶段。任务 Brief 见 docs/tasks/slice-1.md。
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
| T7 | 实现：敌人 AI + 感知 | code | 🔴 | Todo | T2,T5,T6 | - |
| T8 | 实现：简化战斗（玩家攻击 + 敌人伤害 + 受伤/死亡） | code | 🔴 | Todo | T4,T5,T7 | 取舍②新增 |
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
