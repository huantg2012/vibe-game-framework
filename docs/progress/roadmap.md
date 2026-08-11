---
status: ACTIVE
created-by: director agent
created-when: Foundation 整合时
last-modified: 2026-08-12
last-closed-slice: 4.5
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

## 当前 Slice

**Slice 5: 工具库深度（Fine/Rare 补完 + 工具视觉 + 改造深度）** — ACTIVE，范围已于 2026-08-12 锁定。Task Brief 见 `docs/tasks/slice-5.md`，逐项状态见 `docs/progress/current-slice.md`。
范围：Fine/Rare **11 种全量**补完（7 主动工具 + `siphon` 被动 + 防御侧全部未接线机制）+ 工具使用 VFX + 永久改造深度（含三项新改造）+ 模块受损三态视觉 + 四项文档清账。
阻塞项：T3（防御接线）与 T5（改造深度）等设计议题 D1-D6 拍板。

## 计划中的 Slices（近期方向，未锁定）

| 序号 | 方向 | 说明 |
| ---- | ---- | ---- |
| Slice 6 | 第二敌人（潜行轴） | 改写体：不同感知/行为模式 + AI 类型泛化 + `data/enemies.csv`（CSV 数据源规则的欠账）+ 敌人视觉。概念图已 APPROVED。**验证「裂隙内临场潜行判断」的多样性** |
| Slice 7 | 净化点扩张 | 第三模块、模块升级 maxHp，扩展分配纬度（原 Slice 6，顺移） |
| Slice 8 | 程序化地图 | Voronoi+CA 生成，替代固定地图（原 Slice 7，顺移） |

> **编号顺移**（人拍板，2026-08-12）：原 Slice 5 计划把工具、第二敌人、新改造放进一个 Slice。两块验证的是不同的轴，混在一起试玩反馈无法归因；且第二敌人有独立前置债（敌人属性在 `constants.ts` 而非 CSV，与 CLAUDE.md 策划数据源规则冲突）。**第二敌人独立为 Slice 6，其后所有 Slice 整体顺移**。
> **数字订正**：原写「9 种 Fine/Rare 工具」，`contaminants.csv` 实际为 Fine 6 + Rare 5 = **11 种**，本 Slice 全量落地。

### Slice 3.5 UX 打磨清单（已完成 2026-08-11）

来源：`docs/design-notes/game-feel-audit.md` — 12 项全部完成。

### Slice 4 完成总结

CSV 构建期管线 + 防御效果引擎（7 种 Common 副作用）+ 被动工具架构 + 净化点 UX 重构。
从 backlog 消费 2 项：混乱值里程碑视觉 + 裂隙坍缩过渡。

### Slice 4.5 完成总结（已完成 2026-08-12）

表现层翻修，无新玩法系统。规格见 `docs/design-notes/ui-art-overhaul.md`，逐 commit 范围见 commit `ad14cf5` 版本的 `docs/progress/current-slice.md`（该文件每 Slice 覆写）。
遗留两项需人拍板：动态力场边界缺 spec（BoundaryShape / BoundaryBreath）、architecture.md 未登记三块新系统。

> Slice 1/2 的拆分（裂隙出击环 vs 净化点环）已由人拍板：拆分（见 decisions-log 取舍3）。

## Backlog（未排序，随时增减）

来自 `vision.md` 的 Nice-to-have 与明确不做/后续项：

**近期候选（vision Nice-to-have）：**
- 撤离点多样性（多个位置 / 不同条件）
- 混乱值多级阶梯惩罚

**中期（MVP 补全，vision Must-have 中较独立的项）：**
- 程序化地图生成（Voronoi+CA，DEC-005）
- 第二种敌人类型（不同感知/行为模式）
- 1-2 种功能物品（干扰物 / 回复品）
- 音效接入（环境音 + 关键交互反馈音）
- 多语言支持接入（i18n 骨架已就位）
- 净化点视觉状态变化（模块健康/受损画面反馈）

**远期 / 明确当前不做（vision Out-of-scope）：**
- 叙事碎片 / 世界观文本 / B 线内容
- "虚假希望"终局设计
- 丰富物品系统（3 种以上）
- 多种裂隙环境 / 生物群落
- NPC 互动
- 教程 / 新手引导
- 完整音乐 / 音景设计
- 手机端适配
- 多存档
- 成就系统
