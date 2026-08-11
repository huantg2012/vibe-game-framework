---
status: ACTIVE
created-by: director agent
created-when: Foundation 整合时
last-modified: 2026-08-12
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

## 当前 Slice

**Slice 5: Fine/Rare Tools + Second Enemy + New Upgrades** — 待启动。详见 `docs/progress/current-slice.md`。

## 计划中的 Slices（近期方向，未锁定）

| 序号 | 方向 | 说明 |
| ---- | ---- | ---- |
| Slice 5 | Fine/Rare 工具 + 第二敌人 + 新改造 | 9 种 Fine/Rare 工具效果 + 第二种敌人类型 + 新永久改造项 + C3 工具视觉效果 + 永久改造深度扩展 |
| Slice 6 | 净化点扩张 | 第三模块、模块升级 maxHp，扩展分配纬度 |
| Slice 7 | 程序化地图 | Voronoi+CA 生成，替代固定地图 |

### Slice 3.5 UX 打磨清单（已完成 2026-08-11）

来源：`docs/design-notes/game-feel-audit.md` — 12 项全部完成。

### Slice 4 完成总结

CSV 构建期管线 + 防御效果引擎（7 种 Common 副作用）+ 被动工具架构 + 净化点 UX 重构。
从 backlog 消费 2 项：混乱值里程碑视觉 + 裂隙坍缩过渡。

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
