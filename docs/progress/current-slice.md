---
status: ACTIVE
created-by: director agent
created-when: 每个 Slice 开始时
last-modified: 2026-07-24
note: Slice 1 范围已由人拍板锁定（2026-07-24）。三项设计取舍已决：固定地图 / 纳入简化战斗 / 只做裂隙出击环。任务 Brief 见 docs/tasks/slice-1.md。
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
7. 撤离机制（地图上有撤离点，到达即结束本次出击）
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
| T1 | 设计 spec：移动 + 有限视野系统（含 schema/接口） | design | 🔴 | Todo | - | docs/specs/system-movement-vision.md |
| T2 | 设计 spec：敌人 AI（FSM + 感知） | design | 🔴 | Todo | - | docs/specs/system-enemy-ai.md |
| T3 | 设计 spec：混乱值 + 搜刮 + 撤离 | design | 🔴 | Todo | - | docs/specs/system-chaos-scavenge-extract.md |
| T4 | 设计 spec：简化战斗 | design | 🔴 | Todo | - | 取舍②新增；docs/specs/system-combat.md |
| T5 | 实现：移动 + 视野（占位资产） | code | 🔴 | Todo | T1 | 建立共享 Player + VisibilitySystem |
| T6 | 实现：固定裂隙地图（写死 tile 数据 + TilemapRenderer 渲染） | code | 🔴 | Todo | T1 | 取舍①：固定地图，非程序生成 |
| T7 | 实现：敌人 AI + 感知 | code | 🔴 | Todo | T2,T5,T6 | - |
| T8 | 实现：简化战斗（玩家攻击 + 敌人伤害 + 受伤/死亡） | code | 🔴 | Todo | T4,T5,T7 | 取舍②新增 |
| T9 | 实现：薪柴搜刮 + 混乱值 + 撤离 + HUD | code | 🔴 | Todo | T3,T5,T6 | - |
| T10 | QA 验收（对照 spec） | qa | 🟢 | Todo | T5-T9 | 门禁前 |
| **美术门禁（并行验证，依据 art-direction.md §14）** |||||||
| A-G1 | 32px 尺度可读性实测：把关键 tile/sprite 缩到 32px + 视野遮罩下确认细节是否幸存 | art | 🔴 | Todo | - | 验证 art-direction §14.2 |
| A-G2 | 俯视角敌人验证：将正面立绘概念转为俯视角 sprite，确认轮廓/朝向/威胁可读 | art | 🔴 | Todo | - | 验证 art-direction §14.1 |
| A-G3 | **合成测试（表现力验证）**：做 3-5 块真实 32px tile（地面/墙/数据错误块）+ 覆盖层 decal，经管线处理为合规资产后用 tilemap 渲染 + 有限视野光照拼一小块场景，与参考图并排对比 | art/code | 🔴 | Todo | - | 验证 art-direction §14.3（**最高风险项**）；管线吃单块 tile/sprite 原图而非整场景概念图；美术维护 tile/decal 需求+配置+验收，程序运行 `npm run art:*` 并搭合成场景 |

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

## 设计产出（本 Slice 新增/修改的文档）

- [ ] docs/specs/system-movement-vision.md（移动 + 有限视野）
- [ ] docs/specs/system-enemy-ai.md（敌人 FSM + 感知）
- [ ] docs/specs/system-chaos-scavenge-extract.md（混乱值 + 搜刮 + 撤离）
- [ ] docs/specs/system-combat.md（简化战斗）
- [x] docs/tasks/slice-1.md（Director 已拆解）

## 验收结果（Slice 结束时填写）

- QA 报告：[路径]
- 人验证结论：[通过 / 需迭代 / 失败]
- 备注：[...]

## Slice 回顾

- 完成：[N/M] 任务
- 学到了：[...]
- 下一步调整：[...]
