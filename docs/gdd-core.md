---
status: ACTIVE
created-by: director agent
created-when: Foundation 整合时（初版），随 Slice 增量生长
last-modified: 2026-08-07
role: 设计索引（保持简短，详情住在各自 spec 中）
---

# 游戏设计文档（GDD Core）

> 本文件是设计**索引**，不是设计百科。每个系统的完整设计只住在自己的 spec 中。
> Director 整合时只追加索引级摘要（1-2 句/系统），不搬运 spec 详情。

## 概述

后克苏鲁世界的单机搜打撤（俯视角 2D，Web 平台）。玩家守着唯一未被污染完全覆盖的据点"净化点"，穿越不稳定的"裂隙"进入其他被污染的时空，搜刮"薪柴"（异源污染残渣）带回加固据点边界。核心体验不是"变强翻盘"，而是"维持崩溃边缘的紧绷"——资源永远不够，威胁与成长同步升级。详见 `docs/vision.md`（体验支柱）与 `docs/world.md`（世界观约束）。

## 系统列表

> **现状说明**：Slice 1 已完成。`docs/specs/` 含 4 份已实现的系统 spec；`src/` 包含裂隙出击环全部系统实现（移动+视野、敌人AI、战斗、混乱值+搜刮+撤离、trail导航、minimap、HUD）。下表标注各系统当前状态。

| 系统 | 状态 | Spec 路径 | 一句话摘要 |
| ---- | ---- | --------- | ---------- |
| 移动 + 有限视野 | **已实现** (Slice 1) | `docs/specs/system-movement-vision.md` | 俯视角 WASD 移动 + 60 射线 Raycasting 视野遮罩；速度 80px/s，视野半径 180px |
| 敌人 AI | **已实现** (Slice 1) | `docs/specs/system-enemy-ai.md` | 五态 FSM（巡逻/可疑/警觉/追击/返回）+ 锥形视觉感知 + A* 寻路 |
| 战斗系统 | **已实现** (Slice 1) | `docs/specs/system-combat.md` | 前向扇形挥击、三刀击杀、敌人反击 token 机制；定位为止损工具非主要手段 |
| 混乱值 + 搜刮 + 撤离 | **已实现** (Slice 1) | `docs/specs/system-chaos-scavenge-extract.md` | 混乱值匀速上涨(0.5/s) + 阈值惩罚；薪柴搜刮点散布；撤离点按 E 确认 |
| Trail 导航 | **已实现** (Slice 1) | - (无独立 spec) | 面包屑路径标记，辅助玩家在有限视野下找回撤离点 |
| Minimap | **已实现** (Slice 1) | - (无独立 spec) | 角落小地图显示已探索区域与关键点位 |
| HUD | **已实现** (Slice 1) | - (无独立 spec) | 血量/混乱值/薪柴数量实时显示 |
| 程序化地图生成 | 计划中 | 待创建 | Voronoi 碎片切分 + Cellular Automata 有机地形 + 裂口连接（DEC-005） |
| 净化点分区防御 + 冲击结算 | 计划中 | 待创建 | 2 模块薪柴分配 + 不均匀攻击分布结算；冲击强度递增 |
| 边界氛围（BoundaryAtmosphere） | 计划中 | 待创建 | 净化点边界外黑暗 + 周期性模糊幽影（粒子 + 定时 sprite）（DEC-006） |
| 交互触发（InteractionTrigger） | 计划中 | 待创建 | 接近触发交互（overlap 检测 + 提示 + DOM 面板生命周期）（DEC-006） |
| 游戏状态 + 存档 | 计划中（类型骨架已在 src/types） | 待创建 | session 内数据持续 + LocalStorage 跨 session 存档 |
| 音频（AudioManager） | 计划中 | 待创建 | BGM/环境/SFX 播放 + 动态分层混音 + 距离衰减（方向见 audio-direction.md） |
| i18n | 已实现（骨架） | 自实现（src/i18n/，DEC-004） | 简体中文 + 英文，TypeScript locale + 类型安全 key |

## 核心循环

进入裂隙（推进冲击计数器）→ 潜行/观察/选择性交战 → 收集薪柴 + 物品（混乱值匀速上升）→ 超阈值后惩罚逐步加码 → 玩家自行决定撤离时机（越晚代价越大）→ 撤离后将薪柴分配到净化点各模块 / 自身强化 → 每 N 次出击净化点遭受污染冲击（分区结算）→ 受损模块影响下次出击条件 → 资源缺口驱动下一次出击。详见 `docs/vision.md`。

## 系统间关系

（Foundation 结束时的粗略依赖，spec 创建后细化）

- 移动 + 视野 → 所有裂隙内交互的基础（敌人 AI、搜刮、撤离都依赖视野）
- 地图生成 → 提供 tilemap 数据给移动/视野/敌人放置/薪柴放置/撤离点放置
- 混乱值 ← 时间 + 行为事件（被发现/战斗/接触高污染区）→ 触发惩罚（影响视野/移速）
- 搜刮 → 薪柴 → 净化点分区防御 + 自身强化
- 净化点冲击结算 → 模块受损 → 影响下次出击条件（闭环回到裂隙）
- 边界氛围 + 交互触发 → 净化点场景（与视野系统共用渲染管线）

## 内容概要

| 内容类型 | 数量 | 详情路径 |
| -------- | ---- | -------- |
| 进度曲线 | 1（框架文档） | docs/content/progression.md |
| 敌人 / 物品 / 关卡 | 0（未创建） | 待内容 Slice 创建 |

## 设计历史（仅决策，不含详情）

- Foundation: 确立世界观（world.md）、技术架构（architecture.md，Phaser 3 + TS + Vite）、美术方向（art-direction.md，APPROVED，7/7 概念验证）、音频方向（audio-direction.md，APPROVED 方向但未做小样）。关键技术决策见 decisions-log DEC-001~006（Phaser / Event Bus / Voronoi+CA 地图 / 自实现 i18n / 净化点为可行走空间）。
- Slice 1「裂隙潜行核心手感」(2026-07-24 ~ 2026-08-07, COMPLETE): 实现裂隙出击环全系统（移动+视野、敌人AI五态FSM、简化战斗、混乱值+搜刮+撤离、trail+minimap导航辅助、HUD）。固定地图 48x32 室外布局。验证结论：紧绷决策手感成立。试玩迭代关键调校：速度 160->80、混乱值 0.8->0.5、地图重做为室外、新增导航辅助。决策 DEC-007~023。
