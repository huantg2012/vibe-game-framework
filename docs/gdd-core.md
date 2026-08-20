---
status: ACTIVE
created-by: director agent
created-when: Foundation 整合时（初版），随 Slice 增量生长
last-modified: 2026-08-20
role: 设计索引（保持简短，详情住在各自 spec 中）
---

# 游戏设计文档（GDD Core）

> 本文件是设计**索引**，不是设计百科。每个系统的完整设计只住在自己的 spec 中。
> Director 整合时只追加索引级摘要（1-2 句/系统），不搬运 spec 详情。

## 概述

后克苏鲁世界的单机搜打撤（俯视角 2D，Web 平台）。玩家守着唯一未被污染完全覆盖的据点"净化点"，穿越不稳定的"裂隙"进入其他被污染的时空，搜刮"薪柴"（异源污染残渣）带回加固据点边界。核心体验不是"变强翻盘"，而是"维持崩溃边缘的紧绷"——资源永远不够，威胁与成长同步升级。详见 `docs/vision.md`（体验支柱）与 `docs/world.md`（世界观约束）。

## 系统列表

> **现状说明**：Slice 1+2+3+3.5+4+4.5+5+5.5+6+7+8+9 已完成。自 DEC-072 起按需游戏迭代。**当前：迭代 1（敌人系统）** — 污染词法已落文档、未实现（DEC-073 / DEC-074 / DEC-075）。遭遇识别旁白是同一套体系的识别面，不是独立玩法。`docs/specs/` 含系统 spec + `ui-detection-pulse` + 污染词法草案；`src/` 含裂隙出击环 + 两种敌人剖面 + 净化点三模块 + 成长潮汐 + 数据管线 + 防御引擎 + 18 型污染物 + 程序化裂隙 + AudioManager。下表标注各系统当前状态。

| 系统 | 状态 | Spec 路径 | 一句话摘要 |
| ---- | ---- | --------- | ---------- |
| 移动 + 有限视野 | **已实现** (Slice 1) | `docs/specs/system-movement-vision.md` | 俯视角 WASD 移动 + 60 射线 Raycasting 视野遮罩；速度 80px/s，视野半径 180px |
| 敌人 AI | **已实现** (Slice 1；8 扩) | `docs/specs/system-enemy-ai.md` | 一份五态 FSM + 两种感知剖面（渗透体视锥 / 改写体听觉为主）；每图恰好 1 改写体 |
| 污染词法 | **设计锁，未实现** (迭代 1 / DEC-073 / DEC-075) | `docs/specs/system-contamination-lexicon.md` | 底材 + 孔谱 + 词素生成可落地形态；成句少数具名。叙述家 `docs/design-notes/contamination-lexicon.md`；遭遇识别旁白是本体系识别面 |
| 遭遇识别旁白 | **设计锁，未实现** (迭代 1 / DEC-074；归属污染词法) | `docs/specs/ui-encounter-narration.md` | 污染词法的识别表面合同（不是独立玩法）：随身罩一行记录；成句短标记；同身份限频；无头上名字 |
| 战斗系统 | **已实现** (Slice 1) | `docs/specs/system-combat.md` | 前向扇形挥击、三刀击杀、敌人反击 token 机制；定位为止损工具非主要手段 |
| 混乱值 + 搜刮 + 撤离 | **已实现** (Slice 1) | `docs/specs/system-chaos-scavenge-extract.md` | 混乱值匀速上涨(0.5/s) + 阈值惩罚；薪柴搜刮点散布；撤离点按 E 确认 |
| 净化点 + 冲击系统 | **已实现** (Slice 2；7 扩) | `docs/specs/system-purification-impact.md` | 三模块（核心/储藏/净化器）+ 加厚抬血池 + 冲击结算；净化器写入出击起始混乱 |
| 潮汐系统 (TideSystem) | **已实现** (Slice 3) | `docs/specs/system-growth-tide.md` | 5 Tide x 3 Phase 状态机，替代线性递增；低谷期给玩家积攒资源的窗口 |
| 污染物系统 (ContaminantSystem) | **已实现** (Slice 3) | `docs/specs/system-growth-tide.md` | 污染物库存+防御slot+生命周期；3种污染物（固化/延时/侵蚀）覆盖三档rarity |
| 出击工具系统 (ToolSystem) | **已实现** (Slice 3) | `docs/specs/system-growth-tide.md` | 污染物转化为主动出击工具（凝锁/时裂/侵蚀领域），Q/F键位触发 |
| 永久改造系统 (GrowthSystem) | **已实现** (Slice 3) | `docs/specs/system-growth-tide.md` | 3个永久改造项（每轴1个）+ 费用曲线，薪柴的第三去处 |
| 稳定度追踪 (StabilityTracker) | **已实现** (Slice 3) | `docs/specs/system-growth-tide.md` | 长期进度条 0-100%，所有正向行为积分推向终点 |
| 存档管理 (SaveManager) | **已实现** (Slice 3) | - (无独立 spec) | localStorage 持久存档，自动保存于返回净化点时 |
| 裂隙污染物节点 | **已实现** (Slice 3) | `docs/specs/system-growth-tide.md` | 裂隙中新拾取物类型，提供污染物来源 |
| 防御slot管理面板 | **已实现** (Slice 3) | - (无独立 spec) | DOM面板：装备污染物到防御slot减伤 |
| Loadout选择面板 | **已实现** (Slice 3) | - (无独立 spec) | 出击前选择携带的工具 |
| 改造祭坛面板 (GrowthPanel) | **已实现** (Slice 3) | - (无独立 spec) | DOM面板：永久改造购买界面 |
| 潮汐+稳定度 HUD | **已实现** (Slice 3；5.5 改展示) | `docs/specs/system-growth-tide.md` | 净化点贴顶：薪柴 / 潮汐 / 冲击预告。稳定度改存续报告陈述，不在常驻 HUD |
| GameState 管理器 | **已实现** (Slice 2) | - (无独立 spec) | session-only 内存状态管理，跨场景持久（薪柴/模块HP/冲击强度/sortie计数） |
| 场景流转 | **已实现** (Slice 2) | - (无独立 spec) | Menu → PurificationScene ↔ RiftScene 双向切换 + 状态传递 |
| 边界氛围（BoundaryAtmosphere） | **已实现** (Slice 2) | `docs/specs/system-purification-impact.md`（净化点场景规则组） | 净化点边界外黑暗 + 周期性模糊幽影（粒子 + apparition）；Slice 4.5 起半径跟随 BoundaryShape |
| 分配面板 + 冲击结果面板 | **已实现** (Slice 2) | - (无独立 spec) | DOM overlay：薪柴分配到模块（修复/防御）+ 冲击结算结果展示 |
| Trail 导航 | **已实现** (Slice 1) | - (无独立 spec) | 面包屑路径标记，辅助玩家在有限视野下找回撤离点 |
| Minimap | **已实现** (Slice 1) | - (无独立 spec) | 角落小地图显示已探索区域与关键点位 |
| HUD | **已实现** (Slice 1；5.5 迁 DOM) | `docs/specs/system-chaos-scavenge-extract.md` | 裂隙完整度 / 混乱 / 薪柴 / 工具槽 / 生效中；挂 `#dom-ui-root` |
| 被发现屏缘干涉 | **已实现** (Slice 8) | `docs/specs/ui-detection-pulse.md` | 屏缘方向齿带，强度跟察觉度；无数字条；最多 2 方位 |
| 程序化地图生成 | **已实现** (Slice 6；DEC-069 / DEC-070 / DEC-071 污染画法) | `docs/specs/system-map-generation.md` | 每一次踏入抽锚+种子+邻域抖动生成并烤图；地面污染成品是崩坏簇（非矩形平涂）；出击与练习场同一套整团胀缩活层；一个撤离点；换路硬保证；尘点沿风；年龄×残破。撤离多样性延后（DEC-055） |
| 角色属性/能力成长 | **已实现** (Slice 3) | `docs/specs/system-growth-tide.md` | 永久改造+污染物循环+潮汐经济，出击正向积累 |
| 音频（AudioManager） | **已实现** (Slice 9) | `docs/specs/system-audio.md` | 5 条氛围床 + 裂隙四层混音 + §4.2 短音；39 key 非空 OGG+MP3；同时 8 轨 |
| CSV 数据管线 | **已实现** (Slice 4) | - (构建期工具) | 构建期将 data/*.csv 编译为 src/generated/*.ts，类型安全、tree-shakeable |
| 防御效果引擎 (DefenseEffectSystem) | **已实现** (Slice 4) | `docs/specs/system-growth-tide.md` | 冲击时按污染物类型施加不同减伤+副作用，5 种防御分类逻辑 |
| Common 档防御效果 (7种) | **已实现** (Slice 4) | `docs/specs/system-growth-tide.md` | solidify/delay/erode/scatter/muffle/ruminate/retrograde/kindle/stitch 中 7 种防御行为+副作用 |
| 被动工具架构 | **已实现** (Slice 4) | `docs/specs/system-growth-tide.md` | 事件驱动被动工具框架：无需按键、事件触发、使用次数消耗、HUD 区分 |
| Common 主动工具 (ruminate/retrograde/kindle/stitch) | **已实现** (Slice 4) | `docs/specs/system-growth-tide.md` | 4 种新主动工具扩展出击策略 |
| Common 被动工具 (scatter/muffle) | **已实现** (Slice 4) | `docs/specs/system-growth-tide.md` | 碎影(受攻击分裂残影)+消声步(移动静音) |
| Fine/Rare 主动工具 (7种) | **已实现** (Slice 5) | `docs/specs/system-growth-tide.md` | resonate/overwrite/compress/mirror/echo/abyss/combust——主动工具补齐至 15/15 |
| Fine/Rare 被动工具 (siphon) | **已实现** (Slice 5) | `docs/specs/system-growth-tide.md` | 击杀吸薪柴 + 混乱增速减半 + 修复效率翻倍；被动工具补齐至 3/3 |
| Fine/Rare 防御效果 | **已实现** (Slice 5) | `docs/specs/system-purification-impact.md`（D 组规则） | 跨 slot 冲击计数、动态低血减伤、累积焚尽治疗、模块功能互换、承伤返还薪柴等——18 型全部接线，无 `handled externally` 残留 |
| 工具使用 VFX (ToolVfx) | **已实现** (Slice 5) | 规格见 `docs/art/tool-vfx-spec.md` | 8 视觉族群，"世界被改写的痕迹"而非施法动作；网格块集群替代圆形（DEC-038） |
| 净化点 UX 重构 | **已实现** (Slice 4) | - (无独立 spec) | 世界内零文字交互 + 底部提示条 + HUD 面板化 |
| 动态力场边界 (BoundaryShape) | **已实现** (Slice 4.5) | `docs/specs/system-purification-impact.md`（边界规则组，2026-08-12 补写） | 极坐标压力 blob 定义净化点边界，随潮汐缩放；平滑碰撞体 + ray-blob 可见性替代 tile 判定。架构侧见 `architecture.md` DEC-ARCH-009 |
| 边界压力反馈 (BoundaryBreath) | **已实现** (Slice 4.5) | `docs/specs/system-purification-impact.md`（边界规则组，2026-08-12 补写） | 局部压力冲击造成膜变形，把"外界在挤压力场"变成可见事件 |
| 程序化净化点地表 | **已实现** (Slice 4.5) | - (无独立 spec；架构登记于 `architecture.md`) | 7 层逐像素生成（石噪底/冷暖径向渐变/踩踏路径/石缝/暖色碎屑/边缘暗角/teal 渗点），tilemap 仅留碰撞 |
| UI Kit + 共享面板样式层 | **已实现** (Slice 4.5) | 规格见 `docs/design-notes/ui-art-overhaul.md` | `src/ui/dom/panel-styles.ts`：工业终端风格、右侧全高抽屉、行式交互、语义色与字号层级 |
| 角色/敌人/节点程序化贴图 | **已实现** (Slice 4.5) | 规格见 `docs/design-notes/ui-art-overhaul.md` | boot 期生成缓存贴图：玩家 4 向 3/4 视角（暖色）、敌人不对称剪影（冷色+坏像素）、薪柴/污染物形状区分 |
| i18n | 已实现（骨架） | 自实现（src/i18n/，DEC-004） | 简体中文 + 英文，TypeScript locale + 类型安全 key |

## 核心循环

进入裂隙（推进冲击计数器）→ 潜行/观察/选择性交战 → 收集薪柴 + 物品（混乱值匀速上升）→ 超阈值后惩罚逐步加码 → 玩家自行决定撤离时机（越晚代价越大）→ 撤离后将薪柴分配到净化点各模块 / 自身强化 → 每 N 次出击净化点遭受污染冲击（分区结算）→ 受损模块影响下次出击条件 → 资源缺口驱动下一次出击。详见 `docs/vision.md`。

## 系统间关系

（Slice 3 后更新——裂隙环+净化点环+成长经济已闭合）

- 移动 + 视野 → 所有场景内交互的基础（两场景复用，净化点用 omni 模式）
- 地图生成 → 每一次踏入提供 tilemap / 出生 / 一个撤离 / 薪柴 / 巡逻（`generateRiftLayout`；手写图仅夹具）
- 混乱值 ← 时间 + 行为事件（被发现/战斗/接触高污染区）→ 触发惩罚（影响视野/移速）
- 搜刮 → 薪柴 → GameState 持有 → 净化点分配面板消费
- 分配面板 → 模块修复/防御/改造投资 → 三向纠结
- 冲击系统 ← TideSystem 驱动强度（Phase 决定伤害倍率）→ 模块受损 → 模块效果联动
- 污染物节点(裂隙) → 拾取 → ContaminantSystem 库存 → 防御slot(减伤) / 转化为出击工具
- 出击工具 → 裂隙内使用（凝锁敌人/时裂减速/侵蚀领域伤害）→ 提升出击效率
- GrowthSystem → 永久改造（视野+/移速+/拾取+）→ 改变基础出击参数
- StabilityTracker ← 正向行为积分 → 长期进度目标(0-100%)
- SaveManager → localStorage 持久化全部进度（跨session）
- 边界氛围 + 交互触发 → 净化点场景（与视野系统共用渲染管线）
- 场景流转 → Menu→PurificationScene↔RiftScene，GameState 跨场景传递数据

## 内容概要

| 内容类型 | 数量 | 详情路径 |
| -------- | ---- | -------- |
| 进度曲线 | 1（框架文档） | docs/content/progression.md |
| 污染物类型 | 18（CSV 数据驱动，Common 7 + Fine 6 + Rare 5） | data/contaminants.csv → src/generated/contaminant-data.ts |
| 出击工具 | 18 全部实现（主动 15 + 被动 3：scatter/muffle/siphon） | data/contaminants.csv 工具列 |
| 防御效果 | 18 型全部接线（含副作用），Slice 5 起无未接线机制 | src/systems/defense-engine.ts |
| 永久改造 | 6（出击效率/资源效率/生存韧性/出击扩展/防御扩展/信息优势） | data/upgrades.csv → src/generated/upgrade-data.ts |
| 敌人 / 关卡 | 2 种剖面共用一份五态（渗透体 + 改写体）；每图恰好 1 改写体。污染词法已锁未实现 | `data/enemies.csv` → `src/generated/enemy-data.ts`；词法见 `docs/specs/system-contamination-lexicon.md` |

## 设计历史（仅决策，不含详情）

- Foundation: 确立世界观（world.md）、技术架构（architecture.md，Phaser 3 + TS + Vite）、美术方向（art-direction.md，APPROVED，7/7 概念验证）、音频方向（audio-direction.md，APPROVED 方向但未做小样）。关键技术决策见 decisions-log DEC-001~006（Phaser / Event Bus / Voronoi+CA 地图 / 自实现 i18n / 净化点为可行走空间）。
- Slice 1「裂隙潜行核心手感」(2026-07-24 ~ 2026-08-07, COMPLETE): 实现裂隙出击环全系统（移动+视野、敌人AI五态FSM、简化战斗、混乱值+搜刮+撤离、trail+minimap导航辅助、HUD）。固定地图 48x32 室外布局。验证结论：紧绷决策手感成立。试玩迭代关键调校：速度 160->80、混乱值 0.8->0.5、地图重做为室外、新增导航辅助。决策 DEC-007~023。
- Slice 2「净化点闭环」(2026-08-07 ~ 2026-08-08, COMPLETE): 实现净化点环全系统（GameState管理器、场景流转、净化点步行空间14x12椭圆、边界氛围粒子+apparition、2模块实体+交互触发、薪柴分配面板DOM、冲击系统+结果面板、模块效果→出击参数联动）。验证结论：资源分配纠结感成立。关键调校：REPAIR_PER_KINDLING 10->4、BASE_IMPACT_DAMAGE 25->30、MODULE_INITIAL_HP 80->70。遗留：长期经济翻盘机制归后续。
- Slice 3「角色成长+潮汐经济」(2026-08-09 ~ 2026-08-10, COMPLETE): 实现成长经济全系统（TideSystem 5潮x3相状态机、ContaminantSystem库存+防御slot+生命周期、3种污染物完整实现、GrowthSystem 3项永久改造、StabilityTracker进度条、SaveManager localStorage持久存档、裂隙污染物节点、出击工具系统3种主动工具、防御slot/Loadout/改造祭坛/潮汐稳定度 UI面板）。验证结论：动态平衡体验成立，潮汐涨退+污染物循环+永久改造打破了必然下行螺旋。试玩修复：净化点HUD可见性、冲击触发时机、薪柴显示+6项game-feel改善。
- Slice 3.5「UX 打磨」(2026-08-11, COMPLETE): 12 项 game-feel 改善（信息架构/反馈动效/场景过渡/里程碑），来自 `docs/design-notes/game-feel-audit.md` 审计清单全部完成。
- Slice 4「Data Pipeline + Defense Engine + Common Tier」(2026-08-11, COMPLETE): 构建期 CSV 数据管线（contaminants.csv + upgrades.csv -> src/generated/*.ts，18 种污染物类型安全编译）；防御效果引擎（5 种防御分类 + 7 种 Common 副作用）；被动工具架构（事件驱动、无按键触发、scatter/muffle 两种实现）；4 种新主动工具（ruminate/retrograde/kindle/stitch）；净化点 UX 重构（世界内零文字交互 + 底部提示条 + HUD 面板化）。验证结论：数据驱动管线正确区分逐类行为，防御效果让 slot 选择有意义，被动工具创造独特玩法。试玩后修复 9 项 backlog issue。遗留：永久改造深度扩展归 Slice 5。
- Slice 4.5「视觉与界面翻修 + 动态力场边界」(2026-08-11 ~ 2026-08-12, COMPLETE): 表现层脱离原型状态，无新玩法系统。UI Kit 统一 7 个 DOM 面板并改为右侧全高抽屉；裂隙 HUD 符号化；角色/敌人/节点改 boot 期缓存贴图（玩家 4 向 3/4 视角 + 冷暖色分离）；净化点地表改 7 层程序化逐像素生成；净化点边界从 tile 判定改为潮汐驱动的动态力场 blob（BoundaryShape + BoundaryBreath）。同步完成 BARRIER→CORE 术语重命名（15 源文件 / 13 文档 / 1 CSV，见 DEC-027）。验证方式为七轮"改一版→人当场看→指名下一版问题"，非一次性试玩签字。**收尾补记（2026-08-12）**：两项遗留已闭合——边界规则组补写进 `system-purification-impact.md`，三块新系统登记进 `architecture.md`（含 DEC-ARCH-009）。本 Slice 同时暴露了框架在 in-game UI 上的系统性弱点，对策见 `guides/99-review.md` FV-01 / FV-02。
- Slice 5「工具库深度」(2026-08-12, COMPLETE): 污染物 18 型在工具侧与防御侧全部落地——Fine/Rare 主动工具 7 种（主动 15/15）、`siphon` 被动（3/3）、防御侧 6 处 `handled externally` 全部接线；工具使用 VFX（8 视觉族群，DEC-038）；永久改造从 3 项扩到 6 项（第 4 工具槽 / 第 4 防御槽 / 预告可靠度）+ 成长系统泛化；模块受损三态视觉；文档清账四项 + 架构注册表全量补核。关键设计决策 DEC-029~040：`abyss` 用伤害结算前 HP 判定、`combust` 阈值定为固定常量、`overwrite` 忠于原设计（副作用允许偶尔有利于玩家）、跨 slot 效果作用于"其他所有槽位"、**冲击预告改为非空间（目标+强度，不给方向）**、污染物运行时状态进存档。计划外补两项：Slice 4 的 8 个工具此前对敌人零效果（`ToolDebuffs` 无消费方，直接架空本 Slice 验证问题）、四处 CSV 承诺但无代码的机制。**验证状态：实现完成、体验未验证**——机器闸门全绿但人未回签试玩清单与 U1-U12，直接决定收尾并转入 Slice 5.5 UX 重构；装配决策纠结感留到 5.5 观察。
- Slice 5.5「UX 重构」(2026-08-12 ~ 2026-08-16, COMPLETE)：打磨 Slice，无新玩法系统。墙机磷光屏、裂隙 HUD 迁 DOM、检视五层、toast 队列、完整度文案、主菜单三组、底栏按键对齐。装配纠结：机制上不是二选一，界面只讲清事实。被发现指示留给 Slice 8。收尾四项见 `current-slice.md` 与 DEC-054。下一手 Slice 6 程序化地图 + 撤离点（DEC-053）。
- Slice 6「程序化地图」(2026-08-16 ~ 2026-08-19, COMPLETE)：每一次踏入抽风格锚 + 新种子 + 邻域抖动生成并烤图；一个撤离点；外轮廓不规则 + 情景障碍 + 有限种碎片氛围。收工三件（DEC-064）：换路硬保证、尘点沿风、污染年龄×残破。小地图圆形窗口机械层已交（DEC-063）。撤离多样性不做。下一手 Slice 7 净化点扩张。
- Slice 7「净化点扩张」(2026-08-19, COMPLETE)：第三模块净化器写入出击起始混乱（满完整度 0）；祭坛旁加厚三档抬全部模块 maxHp；效果仍按对基准 100。下一手 Slice 8 第二敌人。
- Slice 8「第二敌人」(2026-08-19, COMPLETE)：改写体听觉为主、视锥更窄；每图恰好 1 个；屏缘被发现脉冲无数字条；`data/enemies.csv` + 一份五态。审美待人终审。下一手 Slice 9 音乐/音效。
- Slice 9「音乐 / 音效」(2026-08-19, COMPLETE)：AudioManager 落地；39 个占位 key 双格式进仓库；裂隙分层混音；同时 8 轨。听感待人终审。Slice 10 不做（DEC-064）。
- 表现收口（2026-08-20，非 Slice、非游戏迭代）：渗透体 / 改写体密像素已接出击（DEC-066）。玩家方案 1 加厚像素 + 灯尘已接出击 `Player`（DEC-068）。裂隙地面污染锁定为崩坏簇并接到出击烤漆（DEC-069）；整团胀缩呼吸已锁（DEC-070）并接到出击（DEC-071）。迷雾下亮度等人终审。角色 HOW：`docs/art/actor-pixels.md`。地表合同：`docs/art/rift-fragment-surfaces.md`。
- 按需游戏迭代制度（DEC-072，2026-08-20）：Slice 1–9 已完，不规划 Slice 11，不标 Polish / Launch。工作单元改为人点名模块后的「游戏迭代」。活指针：`docs/progress/current-iteration.md`。
- 迭代 1「敌人系统」（2026-08-20，进行中）：污染词法设计锁（DEC-073），未实现。遭遇识别旁白并入同一套体系（DEC-074 / DEC-075）。体系入口：设计正文 `docs/design-notes/contamination-lexicon.md` → 规则 spec → 识别表面合同。覆盖体不以第三种人形出场。出击仍是两种剖面。
