---
status: ACTIVE
created-by: director agent
created-when: Foundation 整合时
last-modified: 2026-08-20
last-closed-slice: 9
note: 无进行中 Slice。按需游戏迭代（DEC-072）。当前：迭代 1 敌人系统（污染词法 DEC-073 已锁文档、未实现；遭遇识别旁白并入同一套体系，DEC-074 / DEC-075；实现规格 DEC-076）。活指针 current-iteration.md。Slice 10 不做。不规划 Slice 11。Slice 9 之后表现收口仍用 DEC-066～071。迷雾下亮度仍等人终审。
---

# Roadmap

> Foundation 已完成（2026-07-24）。Foundation 不是 Slice，故"已完成的 Slices"从 Slice 1 开始。
> 自 DEC-072 起：本游戏不再规划下一个 Slice。完善按需走「游戏迭代」（活状态 `docs/progress/current-iteration.md`）。已完成 Slices 表不动。

## 已完成的 Slices

| 序号 | 名称 | 完成日期 | 验证结论 |
| ---- | ---- | -------- | -------- |
| Slice 1 | 裂隙潜行核心手感 | 2026-08-07 | PASS — 紧绷决策手感成立，"还敢不敢再多拿一点"的博弈让人上头。试玩中调校了速度/混乱值/地图/导航辅助。 |
| Slice 2 | 净化点闭环 | 2026-08-08 | PASS — 资源分配纠结感成立。经济数值调校（修复成本降低+冲击伤害提高+模块初始HP降低）后，分配纠结从第一轮起存在。 |
| Slice 3 | 角色成长 + 潮汐经济 | 2026-08-10 | PASS — 潮汐节奏+污染物循环+永久改造打破了必然下行螺旋。动态平衡让人想继续。试玩中修复净化点HUD/冲击时机/薪柴显示+6项game-feel。 |
| Slice 3.5 | UX 打磨 | 2026-08-11 | PASS — 12 项 game-feel 改善全部完成（信息架构/反馈动效/场景过渡/里程碑）。 |
| Slice 4 | Data Pipeline + Defense Engine + Common Tier | 2026-08-11 | PASS — CSV 管线正确区分 18 种类型；防御引擎 7 种 Common 特殊机制+副作用让 slot 选择有意义；被动工具创造独特玩法。试玩后修复 9 项 backlog + 净化点 UX 重构。 |
| Slice 4.5 | 视觉与界面翻修 + 动态力场边界 | 2026-08-12 | PASS — 表现层脱离原型状态：UI Kit 统一 + 面板改右侧抽屉、4 向角色贴图、程序化净化点地表、潮汐驱动的动态力场边界。七轮迭代逐轮人工确认。同步完成 BARRIER→CORE 重命名。 |
| Slice 5 | 工具库深度（Fine/Rare 补完 + 工具 VFX + 改造深度） | 2026-08-12 | **实现完成，体验未验证** — 锁定 12 项全交付 + 计划外 2 项。装配决策纠结感转到 5.5 观察（机制上不是二选一；若要真实犹豫回 design）。 |
| Slice 5.5 | UX 重构 | 2026-08-16 | **人要求收尾** — 打磨 Slice。界面从「不像游戏、不成体系」收敛到墙机/裂隙读数/主菜单/底栏按键可玩。审美由人终审（指令完成 = 收尾信号）。收尾四项已登记（DEC-054）。被发现指示留给 Slice 8。 |
| Slice 6 | 程序化地图 | 2026-08-19 | **COMPLETE** — 每一次踏入抽锚+种子+邻域抖动生成并烤图；一个撤离点；外轮廓不规则 + 情景障碍 + 有限种碎片氛围。收工三件：换路硬保证、尘点沿风、年龄×残破（DEC-064）。小地图圆形窗口机械层已交（DEC-063）。撤离多样性不做。机器闸门 PASS。 |
| Slice 7 | 净化点扩张 | 2026-08-19 | **COMPLETE** — 第三模块净化器写入出击起始混乱（满完整度 0 / 空血 50）；祭坛旁加厚 12/20/32 抬全部模块 maxHp 至 145；效果分母锁基准 100；abyss 65% / stitch 三模块列入。机器闸门 PASS。 |
| Slice 8 | 第二敌人（潜行轴） | 2026-08-19 | **COMPLETE** — 改写体听觉为主、视锥更窄；每图恰好 1 个；屏缘被发现脉冲无数字条；`data/enemies.csv` + 一份五态。机器闸门 PASS。审美待人终审。 |
| Slice 9 | 音乐 / 音效 | 2026-08-19 | **COMPLETE** — AudioManager 已实现；39 个 key 非空 OGG+MP3 占位；五条氛围 + 裂隙四层；同时 8 轨；无 jump scare 契约。听感待人终审。 |

## 当前工作单元（DEC-072）

**无进行中 Slice。当前：迭代 1（敌人系统）。** 污染词法已锁文档、未实现（DEC-073 / DEC-074 / DEC-075 / DEC-076）。活指针：`docs/progress/current-iteration.md`。体系入口：`docs/design-notes/contamination-lexicon.md` → `docs/specs/system-contamination-lexicon.md` → `docs/specs/ui-encounter-narration.md`。外观 HOW：`docs/art/contamination-forms.md`。Slice 9 COMPLETE 档案：`docs/progress/current-slice.md`。

DEC-064 锁死的 7 / 8 / 9 均 COMPLETE。Slice 10（NPC）不做。不规划 Slice 11。不把整盘标成 Polish / Launch。撤离多样性不做。

Slice 9 之后表现收口（不是迭代、不改编号）：DEC-069 把裂隙地面污染从矩形平涂改成崩坏簇，并接到出击烤漆。DEC-070：练习场已锁整团胀缩呼吸（人眼 PASS）。DEC-071：出击已挂同一套活层。迷雾下亮度仍等人终审。

## 已锁死、不再开新编号的 Slice（DEC-064）

| 序号 | 方向 | 说明 |
| ---- | ---- | ---- |
| Slice 8 | 第二敌人（潜行轴） | **COMPLETE**（2026-08-19）。 |
| Slice 9 | 音乐 / 音效 | **COMPLETE**（2026-08-19）。 |
| Slice 10 | NPC | **不做**（DEC-064）。不因此改成一次游戏迭代，除非人另行点名。 |

> **编号顺移**（人拍板，2026-08-12）：原 Slice 5 计划把工具、第二敌人、新改造放进一个 Slice。两块验证的是不同的轴，混在一起试玩反馈无法归因。第二敌人独立成 Slice，其后整体顺移。**当时第二敌人编号为 6；DEC-053 后为 8。**
> **数字订正**：原写「9 种 Fine/Rare 工具」，`contaminants.csv` 实际为 Fine 6 + Rare 5 = **11 种**，本 Slice 全量落地。
> **撤离点多样性**（人拍板，2026-08-12）：与程序化地图同 Slice 交付。编号原为 8，**DEC-053 改为 Slice 6**。
> **Slice 9 / 10**（人拍板，2026-08-12）：音乐与音效建立为 Slice 9；NPC 建立为 Slice 10（范围与机制在该 Slice 启动时再设计，现在不定细则）。
> **插入 Slice 5.5**（人拍板，2026-08-12）：Slice 5 收尾后插入打磨 Slice 5.5「UX 重构」。用小数编号表示"不推进玩法轴、只收敛已有交付"。**2026-08-16 COMPLETE（DEC-054）。**
> **Slice 6/8 对调**（人拍板，2026-08-16，DEC-053）：地图+撤离点提到 6；第二敌人（含被发现指示）挪到 8。7/9/10 不变。
> **Slice 6 开工收窄**（人拍板，2026-08-16，DEC-055）：本 Slice 只做程序化地图 + 一个位置不固定的撤离点。撤离多样性（多口/不同条件）延后。
> **Slice 6 收工 + 7/8/9 锁范围**（人拍板，2026-08-19，DEC-064）：换路硬保证 / 尘点沿风 / 年龄×残破做完才 COMPLETE。7=净化器+maxHp 三档；8=改写体听觉为主；9=几乎全表占位音。不做 Slice 10，不做撤离多样性。

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
主 commit `e9f611d`；逐项完成报告 + 收尾章节见 commit `d0bd785` 版本的 `docs/progress/current-slice.md`（该文件每 Slice 覆写）。
**验证状态：实现完成、体验未验证。** 机器闸门全绿，人未逐项回签试玩清单与 U1-U12，直接要求收尾转入 5.5。装配决策纠结感是否成立 → Slice 5.5 期间观察；若不成立，回退路径是回 design 重审工具/防御收益结构（结构性问题，不得靠改 constants 掩盖）。
遗留 7 项全部在 `backlog-issues.md` 追踪，其中 `purification-hud` 是否套 `.game-panel` 划归 Slice 5.5。

### Slice 5.5 范围（已锁定 2026-08-12，人拍板 ALL）

> 原「候选方向草案」已作废——人直接给出诊断与范围，不需要先做 audit 再挑。草案的 A/B/C/D 四个怀疑点全部被 ALL 覆盖。

权威清单在 `docs/progress/current-slice.md` 的 **S1-S15**（Director 扫描 `src/` 全部 UI 表面产出，含每项已核实病灶）。摘要：

| 组 | 表面 |
| -- | ---- |
| 元界面 | S1 主菜单 |
| 净化点 | S2 常驻 HUD、S3 分配、S4 供奉、S5 踏入裂隙、S6 存续报告、S7 蜕变、S8 冲击结算、S9 共享样式层 |
| 裂隙 | **S10 玩家 HUD**（人点名）、S11 dev 调试面板降级、S12 小地图 |
| 跨场景 | S13 物品/工具/污染物检视信息层（替换浏览器原生 `title` tooltip）、S14 瞬时反馈层、S15 术语收口 |

技术性根因：Phaser Text/Graphics 与 DOM overlay 两套栈并存，DOM 字号是 CSS px 不随 `Scale.FIT` 缩放、Phaser 字号是游戏单位会缩放，两者"视觉字号"不对齐——既是可读性问题也是一致性问题（U11），必须在体系里处理。

派发（第一波已发出 2026-08-12）：**art** → `ux-references.md`（具名参考 + 方法论 + 审美原则）+ 就地升级 `ui-art-overhaul.md` 为 **UX Design Kit v2**（载体决策表 / 可读性硬规则 / 组件基元库 / 逐表面视觉规格 / U1-U12 映射）；**design** → `ux-information-architecture.md`（15 表面信息优先级 + 状态语义 + 交互模式 + 术语偏差清单 + 结构性风险清单）。第三波 code 分 **C0-C6** 批落地，每批独立可看、独立验收。

**明确不做（当时）**：第二敌人、任何新玩法系统、程序化地图；除可读性所必需外不做数值平衡；`abyss`/`stitch` 的 3 模块文案（等 Slice 7）。第二敌人现为 Slice 8，地图为 Slice 6（DEC-053）。

### Slice 5.5 完成总结（收尾 2026-08-16）

打磨 Slice。C0–C6 + 试玩热修（HUD 迁 DOM、墙机磷光屏、完整度文案、四处缺口、主菜单三组、底栏按键对齐）。收尾四项见 `current-slice.md` 文末与 DEC-054。下一手 Slice 6。

> Slice 1/2 的拆分（裂隙出击环 vs 净化点环）已由人拍板：拆分（见 decisions-log 取舍3）。

## Backlog（未排序，随时增减）

来自 `vision.md` 的 Nice-to-have 与明确不做/后续项：

**近期候选（vision Nice-to-have）：**
- 混乱值多级阶梯惩罚（注：连续加压曲线已在 Slice 1 落地；本条若再做，是「更明显档位跳变 / 新惩罚种类」，非从零做混乱系统）

**已排入计划 Slice（从 backlog 迁出）：**
- ~~程序化地图生成~~ → Slice 6 COMPLETE（2026-08-19，DEC-055/064）
- 撤离点多样性 → **延后**（DEC-055；不再塞进 Slice 6）
- ~~第二种敌人类型~~ → Slice 8 COMPLETE（2026-08-19）
- ~~净化点视觉状态变化（模块健康/受损）~~ → Slice 5 T6（已交付 2026-08-12）
- ~~音效接入 / 完整音乐·音景~~ → Slice 9 COMPLETE（2026-08-19）
- ~~NPC 互动~~ → Slice 10 **不做**（DEC-064）。不自动改成游戏迭代。

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

> 原列在 Out-of-scope 的「NPC 互动」「完整音乐 / 音景设计」已于 2026-08-12 升格为 Slice 10 / Slice 9 占位。Slice 9 已 COMPLETE。Slice 10 不做（DEC-064）。后续完善按 DEC-072 游戏迭代，等人点名模块，不规划 Slice 11。
