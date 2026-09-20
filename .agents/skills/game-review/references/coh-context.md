# 《那天之后》/ coh：按需接入

仅协调者或C/D阶段读取。此文件提供入口与用户已明确的评审原则，不替代项目活文档，也不作为首次接触者的讲解稿。路径相对于当前仓库根，典型位置为`/Users/yilungao/coh`；路径失效时先在项目查找，不假定内容已删除或机制不再存在。

## 当前事实从哪里核实

- 执行规则先读`CLAUDE.md`，活状态核对`docs/progress/current-iteration.md`、`docs/progress/roadmap.md`与相关任务合同；历史阶段文字可能滞后，不能据旧状态替当前作判断。
- 创作意图：`docs/vision.md`、`docs/world.md`、`docs/art-direction.md`；UI当前方向：`docs/design-notes/ui-art-overhaul.md`。world用于C阶段世界逻辑核对，不在A阶段替玩家解释对象。
- 专项机制以对应`docs/specs/system-*.md`、正式`data/*.csv`及实际生产消费链核对。历史目录数量、通过记录与旧草案不作为本次事实。
- 游戏内UI或像素模型的制作合规复核分别使用项目`in-game-ux`/`pixel-models` skill；只在对应范围读取。HOW合规不能代替独立品质判断。仅审查不自行重画。

## 模块路由

- **裂隙与地图**：`docs/specs/system-map-generation.md`、`system-movement-vision.md`、`system-chaos-scavenge-extract.md`；新世界设计`docs/design-notes/rift-world-space.md`。核实正式入口实际使用的地图/配方/版本，开发样板不能代表正式随机池。
- **净化点**：`docs/specs/system-purification-impact.md`，包括行走、装置、分配、供奉、归来和出发。
- **物件与武器**：`docs/design-notes/contaminant-ability-design.md`、`docs/specs/system-player-weapons.md`、`system-field-inventory.md`、`system-survival-attributes.md`，再按设计引用查实际能力/供奉/装备数据。
- **敌人和战斗**：`docs/specs/system-enemy-ai.md`、`system-combat.md`、`system-contamination-lexicon.md`。区分携带的污染异物与污染威胁，不用审敌人外形替代审物件能力。
- **成长和循环**：`docs/specs/system-growth-tide.md`、库存/净化点/搜撤规则共同看；追同一存档的投入与下趟变化。
- **视听与可靠性**：`docs/specs/system-audio.md`、`docs/architecture.md`、UI活方向及实际场景。声音、转场、恢复要取动态证据。

## 用户已明确的方向：使用时核对最新指令

- 以品类、玩法和首次理解来提出独立问题，不只围着用户列的缺陷或实现现状验收。
- 美术提高关注度，必须归类且独立判断品质；“低饱和”不是全游戏或新地图生成器的输出要求。
- 原角色与俯视2D路线是已采用方向；历史3D关卡探索不是当前默认方案。不要借审查重开已终止路线。
- Rift的视野遮蔽有玩法价值，空间空洞不可被角色灯照亮。改进公平性需与这些规则自洽，不默认全图照亮。
- 物品操作和效果应简单直接，深度来自情境、时机、装备层级和组合；名称、图标、来源、供奉/鉴定及低价值生态也属于完整系统设计，不能等用户逐项提醒。具体比例和目录读活数据，不固化历史48件或12族为目标。
- 地图表现的打磨须形成共享系统能力，覆盖生成产物的适用范围。颜色、材质、形状与异常世界保留可能性，不能退回逐case修图。
- 已挂起的长期采样、平衡或审美验收，只有相应授权才恢复。专项修复/审查不冒充整游戏、人审或长期验证完成。

## 方法来源与旧结果的使用

原方法正文在`docs/qa/rift-world-review-standard.md`，后续覆盖补充在`docs/qa/game-wide-review-plan.md`。它们提供本skill的六领域、分阶段披露、六轴美术与完整循环方法来源。这里提炼方法，不保存第二份项目机制规范。

C/D阶段需要历史比较时，再读`docs/qa/rift-world-review-2026-09-18.md`、`game-wide-review-2026-09-18.md`和后续迭代QA。旧问题可能已修复，旧样板可能已接入生产；先定位当前代码/版本，不把旧报告当现状。

前期经验的通用化：地图审查不能覆盖基地/物件/成长；能力触发不能代表战术收益；静态目录通过不能代表动态与长期生态；新入口通过不能代表旧局；正常终帧不能排除转场闪帧。把这些用于选择证据，不能把每个旧故障都变成每次评审必跑的整套回归。
