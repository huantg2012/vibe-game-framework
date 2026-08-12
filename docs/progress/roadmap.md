---
status: ACTIVE
created-by: director agent
created-when: Foundation 整合时
last-modified: 2026-08-12
last-closed-slice: 5
note: 2026-08-12 人拍板——撤离点多样性→Slice 8；音乐/音效→Slice 9；NPC→Slice 10（该 Slice 内再具体设计）。同日 Slice 5 收尾并插入 Slice 5.5「UX 重构」（打磨 Slice，6-10 编号不变）
---

# Roadmap

> Foundation 已完成（2026-07-24）。Foundation 不是 Slice，故"已完成的 Slices"从 Slice 1 开始。
> 只有当前 Slice 与下一个 Slice 是明确的；其余为粗略方向，随每次 Slice 回顾调整。

## 已完成的 Slices

| 序号 | 名称 | 完成日期 | 验证结论 |
| ---- | ---- | -------- | -------- |
| Slice 1 | 裂隙潜行核心手感 | 2026-08-07 | PASS — 紧绷决策手感成立，"还敢不敢再多拿一点"的博弈让人上头。试玩中调校了速度/混乱值/地图/导航辅助。 |
| Slice 2 | 净化点闭环 | 2026-08-08 | PASS — 资源分配纠结感成立。经济数值调校（修复成本降低+冲击伤害提高+模块初始HP降低）后，分配纠结从第一轮起存在。 |
| Slice 3 | 角色成长 + 潮汐经济 | 2026-08-10 | PASS — 潮汐节奏+污染物循环+永久改造打破了必然下行螺旋。动态平衡让人想继续。试玩中修复净化点HUD/冲击时机/薪柴显示+6项game-feel。 |
| Slice 3.5 | UX 打磨 | 2026-08-11 | PASS — 12 项 game-feel 改善全部完成（信息架构/反馈动效/场景过渡/里程碑）。 |
| Slice 4 | Data Pipeline + Defense Engine + Common Tier | 2026-08-11 | PASS — CSV 管线正确区分 18 种类型；防御引擎 7 种 Common 特殊机制+副作用让 slot 选择有意义；被动工具创造独特玩法。试玩后修复 9 项 backlog + 净化点 UX 重构。 |
| Slice 4.5 | 视觉与界面翻修 + 动态力场边界 | 2026-08-12 | PASS — 表现层脱离原型状态：UI Kit 统一 + 面板改右侧抽屉、4 向角色贴图、程序化净化点地表、潮汐驱动的动态力场边界。七轮迭代逐轮人工确认。同步完成 BARRIER→CORE 重命名。 |
| Slice 5 | 工具库深度（Fine/Rare 补完 + 工具 VFX + 改造深度） | 2026-08-12 | **实现完成，体验未验证** — 锁定 12 项全交付 + 计划外 2 项（失效的工具 debuff 管线 / 四处 CSV 承诺无代码的机制）。机器闸门全绿，但**人未逐项回签试玩清单与 U1-U12**，直接决定收尾转入 Slice 5.5 UX 重构。本 Slice 的验证问题（装配决策是否纠结）**留到 5.5 观察**。 |

## 当前 Slice

**Slice 5.5: UX 重构** — **PLANNING**（2026-08-12 立项）。类型：打磨 Slice（走 FV-02 轻量路径，免完整 Task Brief）。
起因：Slice 5 把工具/污染物/槽位的**数量**推到了新量级（主动工具 15 + 被动 3 + 污染物 18 + 工具槽 4 + 防御槽 4），信息量增速超过了界面承载能力；同时 Slice 5 的试玩验证与 U1-U12 均未回签。人决定不先补签字，而是先做一轮 in-game UX 收敛，再回头看装配决策是否成立。
验证问题（草稿，待人确认）：**玩家不看任何文档，能否说清"我带了什么、它刚刚做了什么、这次分配的后果是什么"？**
范围：**待人 / design / art 锁定**（候选方向见下方「Slice 5.5 范围草案」）。
强制约束：触碰 in-game UI → **必经 art 路径**（载体决策 + 2-3 个具名游戏参考）+ 收尾逐条过 `docs/specs/_template-ui.md` 的 U1-U12。收尾四项登记义务照 director Step 3 轻量路径执行。
逐轮迭代记录：`docs/progress/current-slice.md`。

## 计划中的 Slices（近期方向，未锁定）

| 序号 | 方向 | 说明 |
| ---- | ---- | ---- |
| Slice 6 | 第二敌人（潜行轴） | 改写体：不同感知/行为模式 + AI 类型泛化 + `data/enemies.csv`（CSV 数据源规则的欠账）+ 敌人视觉。概念图已 APPROVED。**验证「裂隙内临场潜行判断」的多样性** |
| Slice 7 | 净化点扩张 | 第三模块、模块升级 maxHp，扩展分配纬度（原 Slice 6，顺移） |
| Slice 8 | 程序化地图 + 撤离点多样性 | Voronoi+CA 生成，替代固定地图（原 Slice 7，顺移）；多个撤离位置 / 不同条件（原 vision Nice-to-have，2026-08-12 人拍板并入本 Slice） |
| Slice 9 | 音乐 / 音效 | 环境音 + 关键交互反馈音 + 音乐/音景接入（原 backlog「音效接入」+ vision Out-of-scope「完整音乐」合并排期；具体范围启动时定） |
| Slice 10 | NPC | NPC 互动（原 vision Out-of-scope）；**本 Slice 启动时再做具体设计**，当前只占位排期 |

> **编号顺移**（人拍板，2026-08-12）：原 Slice 5 计划把工具、第二敌人、新改造放进一个 Slice。两块验证的是不同的轴，混在一起试玩反馈无法归因；且第二敌人有独立前置债（敌人属性在 `constants.ts` 而非 CSV，与 CLAUDE.md 策划数据源规则冲突）。**第二敌人独立为 Slice 6，其后所有 Slice 整体顺移**。
> **数字订正**：原写「9 种 Fine/Rare 工具」，`contaminants.csv` 实际为 Fine 6 + Rare 5 = **11 种**，本 Slice 全量落地。
> **撤离点多样性**（人拍板，2026-08-12）：从 backlog Nice-to-have 并入 Slice 8——程序化地图生成时天然要决定撤离点放置，同 Slice 落地比事后往固定/生成地图上补更干净。
> **Slice 9 / 10**（人拍板，2026-08-12）：音乐与音效建立为 Slice 9；NPC 建立为 Slice 10（范围与机制在该 Slice 启动时再设计，现在不定细则）。
> **插入 Slice 5.5**（人拍板，2026-08-12）：Slice 5 收尾后插入打磨 Slice 5.5「UX 重构」，**Slice 6-10 编号不变**。用小数编号（同 Slice 3.5 / 4.5 惯例）表示"不推进玩法轴、只收敛已有交付"。

### Slice 3.5 UX 打磨清单（已完成 2026-08-11）

来源：`docs/design-notes/game-feel-audit.md` — 12 项全部完成。

### Slice 4 完成总结

CSV 构建期管线 + 防御效果引擎（7 种 Common 副作用）+ 被动工具架构 + 净化点 UX 重构。
从 backlog 消费 2 项：混乱值里程碑视觉 + 裂隙坍缩过渡。

### Slice 4.5 完成总结（已完成 2026-08-12）

表现层翻修，无新玩法系统。规格见 `docs/design-notes/ui-art-overhaul.md`，逐 commit 范围见 commit `ad14cf5` 版本的 `docs/progress/current-slice.md`（该文件每 Slice 覆写）。
遗留两项需人拍板：动态力场边界缺 spec（BoundaryShape / BoundaryBreath）、architecture.md 未登记三块新系统。**已于 Slice 5 闭合**（spec 就地扩写进 `system-purification-impact.md`；架构注册表 T0 全量补核）。

### Slice 5 完成总结（收尾 2026-08-12）

交付：Fine/Rare 主动工具 7 种补完（主动 15/15 可用）、`siphon` 被动（3/3）、防御侧 6 处 `handled externally` 全部接线 + 2 处琐碎项、工具使用 VFX（8 视觉族群，规格 `docs/art/tool-vfx-spec.md`）、永久改造深度（第 4 工具槽 / 第 4 防御槽 / 预告准确率）+ 成长系统泛化、模块受损三态视觉、文档清账四项 + 架构注册表全量补核。
计划外补两项：**T7** Slice 4 的 8 个工具对敌人零效果（`ToolDebuffs` 全项目无消费方——按键有反馈但敌人行为不变，直接架空本 Slice 的验证问题）；**T8** 四处 CSV 承诺但代码从未接的机制。
主 commit `e9f611d`；逐项完成报告见该 commit 与收尾 commit 版本的 `docs/progress/current-slice.md`（该文件每 Slice 覆写）。
**验证状态：实现完成、体验未验证。** 机器闸门全绿，人未逐项回签试玩清单与 U1-U12，直接要求收尾转入 5.5。装配决策纠结感是否成立 → Slice 5.5 期间观察；若不成立，回退路径是回 design 重审工具/防御收益结构（结构性问题，不得靠改 constants 掩盖）。
遗留 7 项全部在 `backlog-issues.md` 追踪，其中 `purification-hud` 是否套 `.game-panel` 划归 Slice 5.5。

### Slice 5.5 范围草案（待人锁定，Director 建议，非既定实现）

> 这是**候选清单**，不是已批准范围。5.5 是打磨 Slice，方向由人指名或由 audit 产出，Director 不擅自定死。

输入源：Slice 5 交付后的 in-game UX 摩擦 + `backlog-issues.md` 的 UX 项 + 术语一致性欠账。

| 候选方向 | 具体怀疑点 |
| -------- | ---------- |
| A. 工具库可读性 | 15 主动 + 3 被动工具，玩家能否在 loadout 面板里分辨它们做什么？VFX 落地后 8 个视觉族群是否真的可区分？被动工具触发时有无感知渠道？ |
| B. 面板/HUD 收敛 | 第 4 槽位后的 loadout / 防御面板布局；防御 slot 与工具库的信息重复；非空间化预告（DEC-034）的呈现是否清楚"打谁、多重"；`purification-hud` 是否套 `.game-panel`（Slice 5 遗留判断） |
| C. 术语一致性 | CSV 文案 ↔ 面板文案 ↔ `world.md` 术语表三处是否说同一件事（`abyss` / `stitch` 的"3 模块"文案已知与实现不符） |
| D. 反馈感知 | 工具使用 / 防御副作用 / 改造效果 / 模块功能互换（DEC-031 的 toast）是否真的被玩家看见 |

**明确不做**：Slice 6 第二敌人、任何新玩法系统、程序化地图；除可读性所必需外不做数值平衡。

下一步（二选一，等人指定）：
1. 人提供试玩痛点清单 → Director 直接排轮次；
2. 授权派 **art + design 做一次 in-game UX 审计**（类比 Slice 3.5 的 `docs/design-notes/game-feel-audit.md`），产出带优先级的偏差清单后再开工。

> Slice 1/2 的拆分（裂隙出击环 vs 净化点环）已由人拍板：拆分（见 decisions-log 取舍3）。

## Backlog（未排序，随时增减）

来自 `vision.md` 的 Nice-to-have 与明确不做/后续项：

**近期候选（vision Nice-to-have）：**
- 混乱值多级阶梯惩罚（注：连续加压曲线已在 Slice 1 落地；本条若再做，是「更明显档位跳变 / 新惩罚种类」，非从零做混乱系统）

**已排入计划 Slice（从 backlog 迁出）：**
- ~~撤离点多样性~~ → Slice 8
- ~~程序化地图生成~~ → Slice 8
- ~~第二种敌人类型~~ → Slice 6
- ~~净化点视觉状态变化（模块健康/受损）~~ → Slice 5 T6（已交付 2026-08-12）
- ~~音效接入 / 完整音乐·音景~~ → Slice 9
- ~~NPC 互动~~ → Slice 10（启动时再具体设计）

**中期（MVP 补全，vision Must-have 中较独立的项）：**
- 1-2 种功能物品（干扰物 / 回复品）
- 多语言支持接入（i18n 骨架已就位）

**远期 / 明确当前不做（vision Out-of-scope）：**
- 叙事碎片 / 世界观文本 / B 线内容
- "虚假希望"终局设计
- 丰富物品系统（3 种以上）
- 多种裂隙环境 / 生物群落
- 教程 / 新手引导
- 手机端适配
- 多存档
- 成就系统

> 原列在 Out-of-scope 的「NPC 互动」「完整音乐 / 音景设计」已于 2026-08-12 升格为 Slice 10 / Slice 9 占位；细则仍待对应 Slice 启动时设计，不等于现在开做。
