---
status: ACTIVE
created-by: code agent
created-when: Foundation 阶段
note: Append-only. Do not modify historical entries.
---

## DEC-082: 出击油膜占空覆盖 — 概念基体未开放前裂隙抽卡不得变
- Date: 2026-08-22
- Phase: Iterative Development（迭代 2 第二轮）
- Type: Implementation
- Context: R2-D1 / DEC-081 把油膜 CSV 收回只占漆，并接受「出击丁改抽乙、户外乙/丁比例会变」。人的 FATAL 是变更先到练习场、不要进裂隙。油膜是出击唯一合法占空基体，收回后 `drawSortie` 抽到丁会没有合法基体。
- Decision:
  1. CSV / 练习场视图：油膜只占漆；丁下拉是概念三类。
  2. 出击视图：codegen 派生 `oil_film.sortieLegalOccupancies`。概念基体仍为 `gym` 时油膜仍占 `paint|volume`，丁继续抽油膜占空。
  3. 配对不变量由 `check:lexicon` 断言：概念基体任一行 `scope=sortie` ⟺ 油膜出击视图不占 volume。翻开关必须同一次提交。
  4. 修正 DEC-081 第 4 条的「本轮接受乙/丁比例变化」：在概念基体接入出击之前，该副作用不成立。钉层空的乙↔丁回退仍在。
- Impact: `tools/csv-codegen/generate.mjs`；`contamination-draw.ts` 出击过滤；`check:lexicon`；句法 spec Schema 合同 9。不出击画面、不改 `RiftScene`。

## DEC-081: R2-D1 基底表落地 — 范围列、概念三类 id、成句改绑
- Date: 2026-08-22
- Phase: Iterative Development（迭代 2 第二轮）
- Type: Design
- Context: DEC-080 已拍板启用概念基体并废止油膜占空。R2-D1 要写出能喂 codegen 的行，并在「CSV 加 enabled_scope 列」与「代码白名单六 id」之间选一条出击安全阀。
- Decision:
  1. 出击范围用 CSV 列 `enabled_scope`（`sortie` / `gym`）。旧六种 `sortie`，本轮新行 `gym`。codegen 写入 `SubstrateDef.enabledScope`；出击过滤读这一列。
  2. 新基体 id 锁死：`stalk_clump`（残茎，有机占地）、`railing_post`（栏柱，无机占地）、`ash_veil`（灰幕，占漆）、`sound_echo`（余响）、`light_scatter`（散光）、`space_interval`（间距）。后三类仅 `volume`。
  3. 成句 `corridor_watching` 改绑 `space_interval`（这段路本身在工作）。出击路径该成句本轮不命中。
  4. 油膜不再占空后，出击抽丁若无 `sortie` 合法基体则改抽乙。禁止把油膜占空留作出击例外。
- Impact: `data/contamination-substrates.csv`；`data/contamination-utterances.csv`；句法 spec Schema / 方言 / 接触对照表；战斗 spec 指针。R2-C-data 必须 codegen + 改 checker + 过滤 `drawSortie`。出击乙/丁比例会变（户外原先偏丁），等人在接线前看是否接受。

## DEC-080: 迭代 2 第二轮 — 方案 D 混装；概念基体进 MVP；出击画面仍零改动
- Date: 2026-08-22
- Phase: Iterative Development（迭代 2 第二轮：形态系统，仍不另立迭代）
- Type: Design / Process
- Context: 人在 gym 试完三方案并逐条差评后拍板：混装成方案 D；甲基底两头加；危险区跟着视觉动；启用概念基体（声音 / 光线 / 空间关系）给丁。范围已溢出纯渲染（CSV、宿主机制、共享钉接口），但工作单元仍是迭代 2。FATAL：变更先到污染句法课，不进 `RiftScene`。
- Decision:
  1. **不另立迭代。** 登记表仍是迭代 2；对人说话用「迭代 2 第二轮」。收尾合法态改为：方案 D 可在 `gym.html?lesson=lexicon` 浏览并覆盖人点名的四孔谱差评；**不要标 COMPLETE**；**不要接到出击**。
  2. **方案 D 混装**：甲走第一轮方案 A 的程序像素词法；丙走方案 B 的地表方言活体；乙、丁在 B 的方向上重做（乙贴墙面游荡；丁是缓慢形变的云，基底不是油膜）。A/B/C 源码冻结为对照，本轮禁止再改；下拉保留「对照（已冻结）」，默认方案 D。
  3. **概念基体纳入 MVP**（翻转 `world.md` 开放问题）。三类新基体只合法占空，给丁。不是无占位的「概念生物」（设计正文 §2 仍成立）。**占声不升为第五张主孔谱。** 油膜合法占位退回只占漆（废止 DEC-076 第 8 条「否则丁无基体」的占空扩权；丁改走概念基体）。
  4. **新基体走 CSV → codegen**。出击 `drawSortie` 在人选并接线之前仍只抽旧六种（白名单）；练习场句法课读全表。禁止代码手写基底再反向导出。
  5. **甲基底两头都加**：新种类 = 新 CSV 行（占地合法）；同一种类内部形态变体 = 渲染种子 / 覆盖深度，不每变体一行。
  6. **危险区跟着视觉**：机制拥有世界位置（乙核沿有序墙面路径走；丁盒飘并形变）；渲染器只画钉点。禁止再用画布内 `seamSlidePx` 假装在动。乙可抽打地板格、丁减视野+加混乱的范围必须跟钉走。
  7. **共享接口加法线（T0 签名作废，仅允许加可选字段）**：`FormAttachContext.pin` 增加墙附着（朝向可走地板的面、法线、缝世界坐标）。A/B/C 不消费。有序墙面路径是新纯函数，**禁止改** `collectWallEdges` 的产出集合；出击钉层集合不变。
  8. **接触词素驱动攻击**只在练习场句法课打开（宿主 `gymLiveMotion` 一类开关，出击默认关）。战斗成功标准仍是「如果试玩者开始享受战斗，本系统就失败了」。不推翻战斗 spec V3（无震屏、无命中停顿、无伤害数字）。攻击发生时的表现 = 危险区可见 + 敌人出手相 + 玩家既有白闪；练习场可关无敌才能看见掉血。
  9. **配色跟碎片**：练习场观察院子必须有 `fragmentTypeId`；敌人像素从该碎片 `wallBias*` / `floorBias*` 推到青绿轴再量化。禁止改 `bakeGround` / `preview-paint.ts` 出击地面管线；可抄 `deriveContamRamp` 语义进 `form-renderers/d/`。
- Impact: `docs/tasks/iteration-2.md` 第二轮；`world.md`；设计正文 §2 / §3.1；句法 spec；战斗 spec 指针；`gym.md` / `gym.mdc`；`architecture.md` gym 渲染器行。出击画面本轮零改动。

## DEC-079: 迭代 2 污染体渲染探索（gym 抽卡，出击不接）
- Date: 2026-08-21
- Phase: Iterative Development（迭代 2：污染体渲染）
- Type: Process / Rendering exploration
- Context: 迭代 1 把污染句法接到出击（逻辑 / AI / 旁白）。渲染层只消费 `portfolio`（练习场另用 `sense` 二选一刷渗透体或改写体）；甲外观只跟 `role` 走；乙丙丁是 `Graphics.fillRect`。生成空间 1053+4，像素 2 人形 + 3 几何块。人点名抽卡三个能覆盖整个生成空间的渲染方案，放练习场可浏览。
- Decision:
  1. 开 **迭代 2（污染体渲染）**，不重开迭代 1。迭代 1 句法逻辑仍为「实现完成，体验未验证」。甲「外观已完成」的隐含前提作废，缺口归本迭代。
  2. 收尾合法态：三个方案可在 `gym.html?lesson=lexicon` 下拉切换，等人选。不要标 COMPLETE。不要接到 `RiftScene`。
  3. 共享合同：`src/gym/form-renderers/` 一接口三实现；侧栏 `#gym-lex-renderer` 照抄地图课污染画法下拉。T0 脚手架先于三方案。任务书 `docs/tasks/iteration-2.md`。
  4. 三方案必须是不同解题思路（程序像素词法 / 地表方言活体 / 词素层叠），不是同一想法的三个色调。
  5. 默认敌人课、玩家课、地图课、出击仍走现行像素。污染句法课可临时另画候选外形——这是对「练习场必须与出击同一套外形」的**有期限例外**，人选后收回。
- Impact: `current-iteration.md`；`docs/dev/gym.md`；`.cursor/rules/gym.mdc`；`architecture.md` gym 注册；句法 spec 加探索指针。字段→像素映射等人选后再锁进外观 HOW。

## DEC-078: 正式名由「污染词法」改为「污染句法」
- Date: 2026-08-21
- Phase: Iterative Development（迭代 1：敌人系统）
- Type: Terminology
- Context: 人要求给敌人形态组合制度一个更响亮、也更准确的名字。词法指构词；这套制度管的是组合规则（孔谱 + 词素 → 成句），对应句法。
- Decision:
  1. 对人说话的正式全称改为「污染句法」。需要时可写「下面称：句法」。
  2. DEC-073 锁定的制度本身不变（底材 / 孔谱 / 词素 / 成句）。旧称「污染词法」仍指向同一套体系，不再当正式名。
  3. 英文文件名、代码标识与练习场 URL（`contamination-lexicon`、`?lesson=lexicon`）不改，避免断链。
- Impact: 活文档与练习场可见文案。本日志历史条目不改写。

## DEC-077: 污染词法接到出击（实现完成，体验未验证）
- Date: 2026-08-21
- Phase: Iterative Development（迭代 1：敌人系统）
- Type: Implementation
- Context: DEC-076 已锁实现规格。人点名实施完整方案。不得标迭代 COMPLETE。审美 / 读作游戏 / 迷雾下亮度仍人终审。
- Decision:
  1. 出击接上 CSV 抽卡、地图钉层、甲两种填法、乙缝核 / 丙簇核 / 丁体积、遭遇识别旁白。
  2. 乙丙丁不进五态、不占走廊碰撞。丙外观 = 已有崩坏簇。练习场旁白默认关；地图课不刷宿主。
  3. 过渡期听觉主轴仍由恰好 1 个改写体占名额；乙丙丁抽卡 `hearingAxisTaken: true`，禁止再抽听噪。乙听缝不另占该名额。
  4. 簇核钉层用与烤地相同种子的格心，不是活簇像素中心；丙可能与最显眼活簇差一格。
  5. 活状态写「实现完成，体验未验证」。不要标迭代 COMPLETE。
- Impact: `current-iteration.md`；`ContaminationHostSystem` / `EncounterNarration` 登记 `architecture.md`。词法 / 旁白 / 战斗 / 地图 / 敌人 AI spec 的 `interface-changed` 复位为 false。

## DEC-076: 污染词法实现规格锁（字母表、CSV、钉层、乙丙丁数字、听觉主轴）
- Date: 2026-08-21
- Phase: Iterative Development（迭代 1：敌人系统）
- Type: Design / Implementation spec
- Context: DEC-073/074/075 已锁方向与识别面。人点名补全实现规格并放权最佳方案，避免 code 猜 CSV、字母表、方言、乙丙丁数字、地图钉层。孔谱丁在原基体表里没有合法占空基体。
- Decision:
  1. 实现合同只写在 `docs/specs/system-contamination-lexicon.md`「实现规格」。设计正文不复制数字表。
  2. 五张 CSV：`contamination-substrates/portfolios/lexemes/utterances/display-tokens.csv` → codegen。`enemies.csv` 只保留可追击剖面数值。
  3. 每孔每槽 3 个合法词素；自动改写与抽卡顺序见 spec。广播不进第一版。
  4. 方言按 `fragmentTypeId` 加权，同一趟一种方言。
  5. 乙/丙/丁核 HP 50（两刀）。丙踩踏休息 +2 / 胀满 +4。丁体积内额外混乱 +1.0/秒、视野×0.7。甲三刀账与 I1–I6 不变。
  6. 地图必须交出墙缘折线、簇核、走廊包围盒。钉失败少生该只，禁止用占地小人顶替。
  7. 活断言「恰好 1 个 rewriter」实现时改为「恰好 1 个听觉主轴」。撤离门仍是甲+视锥。
  8. 油膜合法占位扩为占漆或占空（否则丁无基体）。
  9. 事件 `encounter:identified` 载荷锁在 spec。丙丁第一版不接屏缘干涉。
  10. 外观 HOW 归 `docs/art/contamination-forms.md`。审美仍人终审。
- Impact: 词法 spec；设计正文 §3.1 油膜与 §10；`system-enemy-ai` / `system-combat` / `system-map-generation` 接口段。代码未接。

## DEC-075: 遭遇识别旁白并入污染词法体系；设计正文为叙述家
- Date: 2026-08-20
- Phase: Iterative Development（迭代 1：敌人系统）
- Type: Documentation structure
- Context: DEC-074 已锁遭遇识别旁白的规则与表面。文档入口上旁白曾像独立 UI 产品漂着。人要求把形态生成与认出遭遇当作同一套体系处理。
- Decision:
  1. 污染词法与遭遇识别旁白是同一套形态体系的生成面与识别面。正式名仍用全称。DEC-074 仍有效，历史正文不改。
  2. 叙述家 = `docs/design-notes/contamination-lexicon.md`（§7）。唯一逻辑 spec = `docs/specs/system-contamination-lexicon.md`（身份键、触发、限频、上屏节点、成句标记映射）。`docs/specs/ui-encounter-narration.md` 保留为识别表面合同（载体 / 参考锚点 / 视觉 / U1–U12），不是独立玩法系统。
  3. 体系入口顺序：设计正文 → 规则 spec → UI 表面。
- Impact: 设计正文 §7；词法 spec「遭遇识别旁白（逻辑）」节；UI spec 归属声明。入口：AGENTS.md、CLAUDE.md 层 B 进度句、gdd-core、architecture、world、current-iteration、roadmap。未实现。

## DEC-074: 遭遇识别用随身罩旁白，禁止头上名字
- Date: 2026-08-20
- Phase: Iterative Development（迭代 1：敌人系统）
- Type: Display / UX
- Context: 污染词法（DEC-073）会生成海量形态。人要求强化「遭遇了什么」的感知，但不要在每个个体头上挂怪物名 HUD。提出旁白：遭遇后用文字报名字（关键组合项合理拼接；成句可用特别颜色或字体）。文案与呈现须契世界观。短时间遭遇相同形态不得连刷。
- Decision:
  1. 新表面「遭遇识别旁白」，载体 **A 世界内装置**（裂隙随身罩现场记录行）。挂 `#dom-ui-root`，贴底栏上方。不钉敌人世界坐标。
  2. 禁止：头上名字、图鉴弹窗、OS toast 壳、抄混乱阈值全屏居中文学旁白。Darkest Dungeon 叙事旁白框明确不学。
  3. 上屏结构：无人称骨架「识别。」+ 覆盖深度 / 基体 / 占位分节点（占地加主感知）。成句另加短行为标记（开合 / 缝视 / 呼吸 / 反视），用已锁污染侧 teal + 同一 12px + 1px 错位。内部配方名不上屏。
  4. 限频：身份键见 ui spec。同键本趟 60s；行间隔 ≥2.5s；同时 1 行；与混乱阈值重叠则阈值优先且不补打。
  5. 世界可读仍是第一课。旁白是强化不是替代。HOW 已走 in-game UX 闸门。审美待人终审。
- Impact: `docs/specs/ui-encounter-narration.md`（新）。`system-contamination-lexicon.md` 玩家交互 / 规则 19–21。设计正文 §6 / §9。未实现。设计叙述并入 `contamination-lexicon.md`（见 DEC-075）；本条历史正文不改。

## DEC-073: 锁定污染词法作为敌人形态组合制度（未实现）
- Date: 2026-08-20
- Phase: Iterative Development（迭代 1：敌人系统）
- Type: Design
- Context: 两种敌人、每种一个形态，与程序生成裂隙不相称。人要求用有限维度组合海量形态，并以《暗黑破坏神 2》符文之语为启发（不是抄装备词缀）。爆炸思考后，人点名保留：基体/覆盖深度；连续性/占位（底层逻辑）；运动/感知/节律/接触作为衍生槽。硬约束：每个合法个体必须有外观、生命期、移动、感知、攻击、死亡。人要求先落文档并提交。
- Decision:
  1. 正式名「污染词法」。底材 = 基体 × 覆盖深度；孔谱 = 连续性 × 占位；词素四槽从孔谱字母表抽取；成句 = 少数具名遭遇。
  2. 渗透体 / 改写体解释为孔谱甲（单核 × 占地）的两种填法。一份五态，禁止按填法复制 AI。
  3. 覆盖体不以第三种人形出场；第一版成句以非人形孔谱（占墙 / 占漆 / 占空）出现。
  4. 第一版四张主孔谱：甲占地、乙占墙、丙占漆、丁占空。占声不进主课。占相位并入节律。诱饵体不是自由连续性。
  5. 菌落与场不得加墙（连通 FATAL）。战斗成功标准不变：绕应通常更划算。
  6. 设计正文 `docs/design-notes/contamination-lexicon.md`（含背景）。规则合同 `docs/specs/system-contamination-lexicon.md`（DRAFT）。**代码未接。**
- Impact: 迭代 1 范围从「对话收范围」推进为「词法已锁、未实现」。实现须另点名。CSV 形态表实现时再加，禁止现在手写进代码。

## DEC-072: 本游戏工作单元改为按需「游戏迭代」，不再开新 Slice
- Date: 2026-08-20
- Phase: Iterative Development
- Type: Process
- Context: Slice 1–9 已 COMPLETE。Slice 10（NPC）仍不做（DEC-064）。人宣布之后层 B 的完善按点名的模块任务走，脱离 Slice 编号。本次只宣布制度，尚未点名第一个模块。不要把整盘标成 Polish / Launch。不要开 Slice 11。不要把 Slice 9 之后表现收口（DEC-066～071）事后改编号成迭代 1。
- Decision:
  1. **工作单元**：按需「游戏迭代」（对人说话用这个全称；需要时可写「下面称：迭代」）。不是新 Slice。一次迭代 = 人这一次点名的那包工作；禁止把多个无关模块塞进同一迭代。
  2. **触发**：人点名模块并说开始（或 `/director` 带具体任务）→ Director 登记一次迭代（序号、模块、范围一句话、派谁）。无人点名则当前无进行中的迭代。
  3. **编号**：显示名 `迭代 1`、`迭代 2`…（阿拉伯数字，从 1 起算）。从**下一手人点名的任务**开始。Slice 9 之后表现收口仍用原 DEC，放在「Slice 9 之后表现收口」账上，不改成迭代序号。
  4. **登记字段最少**：序号、日期、模块名（人的叫法）、一句话范围、状态（进行中 / 已交）、相关 DEC（若有）。活状态只写在 `docs/progress/current-iteration.md`。
  5. **已完成 Slice 历史不动**。Slice 10 仍不做。不规划 Slice 11。阶段仍是 Iterative Development，不升 Polish / Launch。
  6. **打磨 / 表现**：仍走轻量路径收尾四项（架构登记 / spec 判断 / 交付范围 / UI 清单若适用）。单批上下文预算仍有效。
  7. **审美 / 「读作游戏」**仍人终审。Agent 不代写好看、不代勾 PASS。
  8. **不要和层 A「框架迭代协议」混名**（`guides/98-field-notes.md` / `CLAUDE.md` 框架段）。框架那套仍叫框架迭代。本决策不改 `.claude/agents/*`、`.cursor/agents/*`。Slice 生命周期仍是框架能力；本游戏当前不用它开新 Slice。
- Impact: `docs/progress/current-iteration.md`（当前迭代：无）。`current-slice.md` / `roadmap.md` / `CLAUDE.md` 层 B 当前阶段 / `gdd-core.md` / `AGENTS.md` 对齐。下次 `/director` 先看 `current-iteration.md`。

## DEC-071: 练习场已锁的崩坏簇胀缩接到出击
- Date: 2026-08-20
- Phase: Iterative Development（Slice 9 之后的表现收口，不是新 Slice）
- Type: Art
- Context: DEC-070 把整团胀缩锁在练习场，出击暂不挂活层。人已确认练习场效果很好，并明确要求接到正式裂隙关卡后提交。DEC-069 / DEC-070 旧正文不改写。
- Decision:
  1. 出击 `RiftScene` 与练习场地图课同一套活层：`liveClusterBreath: true`。污染画法缺省已是崩坏簇。
  2. `bakeGround(..., clusterLive=true)` 只烤内核；中间层与外层由 `paintClusterBreath` 画。禁止完整团再叠一层。
  3. 呼吸精灵深度为地表 `DEPTH.surface + 0.05`。裂隙视野是 `DEPTH.visionMask`（约 50）的黑暗蒙层挖洞。活层必须仍在蒙层之下；禁止抬到迷雾之上。
  4. 只漆可走地板（`isClusterFloor` / `putFloorRgb`）。不改墙、不改碰撞。
  5. 无新 HUD。迷雾下亮度等人终审，不把审美勾成通过。
- Impact: `src/scenes/rift-scene.ts` `mount(..., { liveClusterBreath: true })`。活文档去掉「出击暂不挂」。画面锁仍是 DEC-070。

## DEC-070: 崩坏簇呼吸锁定为练习场整团胀缩，出击暂不挂活层
- Date: 2026-08-20
- Phase: Iterative Development（Slice 9 之后的表现收口，不是新 Slice）
- Type: Art
- Context: DEC-069 把可走地面污染成品锁为崩坏簇并接到出击烤漆。其第 4 条当时写「覆盖场着色器每帧扩收缩」——那是当时的决策原文，本条不改写那份历史。后续练习场验证否决了多条呼吸路径。2026-08-20 人在 `gym.html?lesson=map` 确认整团胀缩「非常棒」「呼吸的效果有了」，本轮三处优化后整体很好。人未说接到出击。失败路径（不要再做）：(1) CPU 整张 ImageData 改加法亮度；(2) 覆盖场片元着色器整团阈值/透明度（演示文稿味）；(3) 极坐标 Graphics 折线（灰尖刺星，盖住烤死像素）；(4) 已烤轮廓外长 1–2 像素（冻住的团 + 跳点）；(5) 沿圆周走鼓包抄裂隙视野边缘（读成旋转的花）。
- Decision:
  1. **成品**：可走地面污染 = 崩坏簇（DEC-069 画面锁仍有效）。生产默认 `cluster`。晶结 / 溶蚀 / 平涂仅练习场对照。
  2. **练习场活层**（`liveClusterBreath`）：内核烤死；中间层与外层同一呼吸相位、几乎不透明，沿簇自己的不规则外沿**整团胀缩**。幅度 = 该团休息大小的 **5–20%**（每团随机 `breathAmp`）。中间层向内核叠一点，禁止核心与外层之间漏地板。
  3. **禁止**：整团透明度；统一圆球缩放当唯一手段；沿圆周走鼓包；描轮廓星形；只长 1–2 像素；每帧重画整张地面 `compositePaint`。
  4. **配色**：从该岛地板 / 墙 bias 推 HSV，往青绿轴拉，按年龄偏蓝 / 绿，量化到已锁色板；四档互不相同且离开地板色。禁止给 `palette.json` 加色。禁止一组 `CONTAM_*` 冒充所有岛。
  5. **连通**：只 `putFloorRgb` 可走地板。
  6. **出击**：烤完整团，暂不挂活层。下一步若人要接裂隙，另开一小刀（迷雾下亮度待看）。
- Impact: 活合同 `docs/art/rift-fragment-surfaces.md`；`art-direction.md` 污染脉动 / 簇活膜；`architecture.md` ClusterPulse；`system-map-generation.md` 规则 27。代码：`src/generation/preview-paint.ts`（`bakeGround(..., clusterLive)`、`ClusterOrganism.breathAmp`、`deriveContamRamp` 四档互异 + 离地板）；`src/systems/cluster-pulse.ts` `paintClusterBreath`；`src/systems/procedural-surface.ts` `opts.liveClusterBreath`（练习场传 true，出击不传）；`src/gym/gym-map-scene.ts` 崩坏簇时 `liveClusterBreath: true`。禁止自行接到 `RiftScene`。

## DEC-069: 裂隙地面污染锁定为崩坏簇，接到出击烤漆
- Date: 2026-08-20
- Phase: Iterative Development（Slice 9 之后的表现收口，不是新 Slice）
- Type: Art
- Context: 练习场地图课对照了三种新烤漆 + 现行矩形平涂。人判定方案一「崩坏簇」整体更好（大小 / 形状 / 配色通过）。呼吸第一版（CPU 每隔约 140ms 改加法亮度）不合格；人选方向二：覆盖场片元着色器每帧扩收缩，并在练习场确认「很好」。指令：记录方案并接到出击裂隙，不只留在练习场。
- Decision:
  1. **成品画面**：裂隙可走地面的环境污染 = 崩坏簇（改写体身上那种青绿团落到地板），不是矩形平涂错误块。签名仍是「渲染规则崩坏 / 与实体同一种现象」；环境不再要求网格对齐的矩形平涂。接缝漏光可以仍在，簇是主签名。
  2. **形状**：大小方差拉开（`powerRadius`）；边界随机（椭圆、缺角、噪声轮廓、条状抹痕、卫星瓣）。禁止统一圆球。
  3. **配色**：从该岛 `RIFT_FRAGMENT_DATA` 地板 / 墙 bias 推导 HSV，往青绿轴拉，再按 `contaminationAge` 偏蓝或偏绿，最后 `nearestPalette` 量化到 `docs/art/palette.json`。禁止再写死一组 `CONTAM_*` 当所有岛的污染色。禁止给色板加新色。
  4. **呼吸**：覆盖场着色器每帧扩收缩轮廓；纹理只烤一次（R=覆盖、G=相位）。禁止回到 CPU 整张 ImageData 重画。无 WebGL 则不加呼吸叠层。
  5. **接线**：出击与练习场地图课走同一套 `generateRiftLayout` + `bakeGround` cluster + `RiftSurfacePainter`。生产默认是 `cluster`。练习场可保留晶结 / 溶蚀 / 平涂作对照，**不得进出击**。
  6. **连通**：簇是 `putFloorRgb` 漆，只画在已连通的可走地板上。不改墙、不改碰撞。装饰层不得拆连通（已有 FATAL 规则）。
- Impact: `art-direction.md` §4.2；`docs/art/rift-fragment-surfaces.md`；`bakeGround` / `RiftSurfacePainter` 默认；`contam-breath-pipeline.ts`；练习场对照仍在。出击请人看一眼迷雾下呼吸是否过亮。

## DEC-068: 玩家加厚像素 + 灯尘接到出击 Player
- Date: 2026-08-20
- Phase: Iterative Development（Slice 9 之后的表现收口，不是新 Slice）
- Type: Art
- Context: DEC-067 把外形锁在练习场。人要求放进关卡。
- Decision:
  1. 裂隙 / 净化点的 `Player` 使用 `player-sprite-dense.ts` + `player-lamp-aura.ts`（与 `gym.html?lesson=player` 同一套）。
  2. 碰撞仍 `BODY_SIZE` 20、`BODY_OFFSET` `{6,6}`。不改移速、朝向、视野。
  3. `player-sprite.ts` 旧方块人不再驱动 `Player`；boot 仍可画别名贴图。AI 精灵表路径仍不关闭，除非人改口。
- Impact: `player.ts`；`art-direction.md` §5.1；`docs/art/actor-pixels.md`；架构登记表。

## DEC-067: 玩家外形锁定为加厚程序像素 + 灯尘，未接出击 Player
- Date: 2026-08-20
- Phase: Iterative Development（Slice 9 之后的表现收口，不是新 Slice）
- Type: Art
- Context: 旧方块人并排已加厚的敌人显得太简单。人在练习场方案 1（加厚程序像素）与方案 3（方块人 + 灯尘）里选了 1，并收下 3 的灯尘。明确不接到出击，直到另说。
- Decision:
  1. 练习场玩家外形 = 方案 1 加厚工业像素（侧影加厚、混凝土灰略暖、灯是唯一高亮）+ 方案 3 的灯尘。不要青绿、不要把身体裂开当签名。
  2. **出击 `Player` 仍用 `src/entities/player-sprite.ts`。** 禁止 agent 自行把 `player-sprite-dense.ts` / `player-lamp-aura.ts` 接到 `Player`。
  3. 本决策不宣布「玩家精灵表已死」。DEC-066 仍不含玩家；生产路径等人说接线时再定。
- Impact: `art-direction.md` §5.1；`docs/art/actor-pixels.md`；练习场玩家课；架构登记表。出击碰撞与手感不变。

## DEC-066: 渗透体 / 改写体画面锁定为程序像素，不再走精灵表管线
- Date: 2026-08-20
- Phase: Iterative Development（Slice 9 之后的表现锁定，不是新 Slice）
- Type: Art
- Context: 人在练习场确认程序绘制的敌人（含步态伸缩、改写体行走时身体裂开）已经够好，不需要再为这两种敌人做 Midjourney / `art:postprocess` / `spr-rift-enemy-*` 精灵表。
- Decision:
  1. **渗透体与改写体的成品画面**是启动时用像素缓冲 / Graphics 画出来的角色（四向直立、待机/行走帧、转向滞后剪影）。运行时 Phaser 纹理只是把这些像素送上屏幕，不是「占位、等正式贴图替换」。
  2. 禁止为这两种敌人再开外部生图、再喂 `tools/art-pipeline/`、再做水平精灵条。概念图（`docs/art/demos/entity-*`）只作方向档案，不进游戏。
  3. 本决策**不含玩家**（玩家仍可以走精灵表）。**不含覆盖体**（未做；若做再另议来源）。
  4. 现有纹理名（`placeholder-enemy-*` / `placeholder-rewriter-*`）可保留，以免无意义大改名；语义上它们就是成品。
- Impact: `art-direction.md` §5.2 / §8；`docs/art/rewriter-sprite.md`；`docs/art/asset-specs.md`；`system-enemy-ai` R2/R6；架构登记表。

## DEC-065: 独立 HTML 开发练习场（敌人移动课）
- Date: 2026-08-20
- Phase: Iterative Development（Slice 9 之后的开发工具，不是新 Slice）
- Type: Technical + Process
- Context: 人要一个游戏开发里常见的 gym：可单独打开的 HTML，先用来看所有敌人的寻路移动（含斜向），渲染/动画/移动必须与出击一致，并且写进仓库让后续 agent 能立刻捡起来。
- Decision:
  1. 练习场是 `gym.html` + `src/gym/`，不进主菜单、不用 `#gym` 深链挂在正式 Boot 上。
  2. 敌人必须走 `AISystem` + `Enemy` + `GridPathfinder`；贴图走与 `BootScene` 共用的 `generatePlaceholderTextures`；Phaser 视图配置走 `gameConfigWithScenes`。禁止另写一套移动或 Canvas 假巡逻。
  3. 当前课：封闭院子 + 每种现行角色一只 + 八向路点环。视野恒亮、玩家诱饵在场外，只为看清巡逻，不改出击规则。
  4. Agent 入口：`docs/dev/gym.md`。新角色必须补 `GYM_LOOPS`。侧栏是开发说明，不是游戏内界面。
- Impact: `architecture.md` 登记 Gym；`CLAUDE.md` / `AGENTS.md` 加入口。

## Slice 9 C1：AudioManager + 占位音进仓库（code，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 9
- Type: Technical
- Context: DEC-064 / D1 / A1。本机 Homebrew 因 macOS 26 无法运行，未装上 sox；用静态 ffmpeg（libvorbis / libmp3lame + lavfi sine/anoisesrc）按 A1 合成非空 OGG+MP3。
- Decision:
  1. 资产写到 `assets/audio/` 并复制到 `public/assets/audio/`，Boot 用 `/assets/audio/...` 预加载。不引入 Howler。
  2. `AudioManager` 走 Phaser Sound；场景/main/pause-menu 的 pause/resume 只调 AudioManager。冲击音频吃 `ImpactResult` 返回值。
  3. 架构注册表 AudioManager 改为已实现，API 对齐 spec B。
- Impact: `src/managers/audio-manager.ts`、39×2 占位文件、场景接线。听感仍待人终审。

## Slice 9 A1：占位合成配方（art，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 9
- Type: Art
- Context: DEC-064 / D1 已锁 39 key。A1 只锁 ffmpeg/sox 占位怎么响；文件仍待 C1 生成。不改 audio-direction「未生成」列。无新色、无新 UI。
- Decision:
  1. 床 = 多层失谐低频 + 轻棕噪；循环只 crossfade 噪声层。净化点 BGM 用 55/57/62 Hz，环境循环用 60+120 Hz 工频，禁止合成同一条嗡。
  2. UI 全走带通噪声金属微动。警告/警戒/阈值/冲击/边界淡入 ≥ 40 ms，低频压迫渐起，禁止纯正弦警报与 8-bit beep。
  3. 改写体 hum 基频 ≤ 42 Hz、无颤、窄频谱；渗透体 idle ≥ 72 Hz、带 1.2 Hz 微颤。敌人非动物、非惨叫。
- Impact: `docs/art/audio-placeholders.md`。C1 按表生成非空 OGG+MP3。状态仍待生成。

## Slice 9 D1：音频可实现契约（design，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 9
- Type: Design
- Context: DEC-064 / D1 已锁几乎全表。禁止再问人。把方向文档收成现行接线，不留待定。
- Decision:
  1. 裂隙高混乱不是切主床：`bgm-rift-high-chaos` = Tension 层。Base 始终是 `bgm-rift-base-drone`。
  2. `sfx-rift-enemy-overwriter-hum` 现行 = 改写体，衰减 10–15 tile。渗透体只用 idle。禁止第三种敌人。
  3. Proximity 层按最近污染物节点距离，不绑改写体（hum 已占远距）。Tension 抬起时停掉 `amb-rift-alien-atmosphere`，避免第五条循环床打满 8 轨。
  4. 冲击音频吃 `ImpactResult` 返回值，不依赖 create 期已发出的 `IMPACT_*` 事件。
  5. `main.ts` / `pause-menu.ts` 的 pauseAll/resumeAll 改走 AudioManager。AI / 战斗 cue 由 `RiftScene` 翻译。
  6. §3 偶发环境不另开 key，编进两条环境循环床。不做 >90% 侧链吞噬、不做动作回声、不做音量面板、§9 振荡器占位作废。
- Impact: 新建 `docs/specs/system-audio.md`（`interface-changed: true`）。39 个 key，每 key 非空 OGG+MP3。

## Slice 8 C1：剖面读表 + 一份 FSM + 屏缘 DTO（code，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 8
- Type: Technical
- Context: DEC-064 / D1 已锁。C1 落地时不复制 FSM，不新开 HUD 根。
- Decision:
  1. `data/enemies.csv` → `src/generated/enemy-data.ts`。渗透体策划字段从 `GAME_CONSTANTS.AI` 删迁；感知节拍、I 不变量用的玩家视距、停步封顶等共享量留 constants。
  2. 同一套 `state-machine.ts` / `ai-system.ts` 读 `PerceptionProfile`。改写体听觉连续填充与 T0-4b 是刺激路由，不是第二份状态表。非法 spawn（改写体 ≠ 1）开发期抛错，不默默全当渗透体。
  3. 屏缘脉冲是独立 DOM 模块。场景层把 `EnemyView` 折成 threat DTO；AI 与 UI 互不 import。挂 `#rift-detection-rim` → `#dom-ui-root`。
- Impact: `architecture.md` `changed-this-slice: true`。`check:layout` 断言 rewriter 恰好 1。不标 Slice COMPLETE。

## Slice 8 A1：屏缘刻痕 + 改写体程序化占位（art，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 8
- Type: Art
- Context: DEC-064 / D1 已锁载体 A、无数字条、改写体 VERDICT。A1 写像素死约束，人全托管程序化占位，不新 hex。
- Decision:
  1. 屏缘干涉是随身罩边缘矩形齿（`veil-bite`），挂 `#rift-detection-rim` → `#dom-ui-root`。16 px 边带。留意 3 齿 `#1aad96` 呼吸；搜寻 5 齿 `#2ae6c8` 3 Hz；锁定 7 齿近常亮。强度只调 alpha 与齿长。禁止雷达细框、进度条、血条式察觉条。
  2. 改写体占位 32×48 四向独立缓冲，崩坏锁在身体右侧，teal 簇 17 px，保留爪/前倾。禁止旋转单图、禁止眼睛、禁止紫粉史莱姆。
  3. 搜寻 = 崩坏侧加亮；追击 = 加亮 + 残影 55 ms + 8 帧 1 px 抖动。无新色。
- Impact: `ui-detection-pulse` 视觉规格；`docs/art/rewriter-sprite.md`；Kit A0 #19 / A4 / A5-2b / B2。

## Slice 8 D1：两种感知剖面 + 屏缘干涉（design，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 8
- Type: Design
- Context: DEC-064 已锁改写体听觉为主、每图 1 个、屏缘脉冲无数字条、CSV 迁出。D1 把可实现数字与 UI 结构写死，不再问人。
- Decision:
  1. 渗透体 / 改写体共用一份五态 FSM。差异只在 `data/enemies.csv` 感知剖面与刺激权重。禁止复制 FSM。
  2. 改写体现行数字：视锥半角 32°、移动听觉 150、`hearing_move_mult` 2.0、停步听力半径 40、停步察觉封顶 0.20、`hearing_max_push = alert`。锁定追击仍要视线。渗透体从现行 constants 迁出，不改手感。
  3. 屏缘干涉：载体 A，挂 `#dom-ui-root`。强度 = 察觉度 0–1。形态 留意 / 搜寻 / 锁定。最多 2 个方位（夹角 < 28° 合并）。无数字、无「察觉 73%」。
  4. 每张裂隙 3–4 巡逻、恰好 1 改写体；撤离最后一道关必须是渗透体。
- Impact: `system-enemy-ai` `interface-changed: true`；`system-map-generation` 规则 19/22；`ui-detection-pulse` 新建；`data/enemies.csv` 两行。

## Slice 7 A1：净化器三棱锥台 + 加厚桩换色相（art，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 7
- Type: Art
- Context: DEC-064 第三模块落地。要一眼不同于核心六边形 / 储藏方块；色只引用已锁板；加厚不是第四模块也不是墙机。
- Decision:
  1. 净化器形体锁 **竖立三棱锥台**（俯视朝下等边外三角半径 18 + 内三角半径 8）。身份填/描走 `contam-mid` / `contam-core`；健康灯 `#1aad96`，禁止新绿。三态复用现模块裂缝/渗入/500ms 灯，不新图集。
  2. 加厚桩复用 `drawInteractionPoint`，中心 `#5a5f66`、环 `#c8cdd4`、半径 7/12。读数只走底栏，禁止中心 ±120×80，无第二条确认。
  3. 分配 / 出击装配复用既有 680×468 CRT 行式；净化器数字与起始混乱用 `#1aad96`。不新开 ui spec、不重画核心/储藏世界实体。
- Impact: `system-purification-impact.md` UX 视觉规格；`ui-art-overhaul.md` A0 #17/#18、B3 净化器小节。

## Slice 7 D1：净化器公式与加厚费用（design，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 7
- Type: Design
- Context: DEC-064 已锁第三模块=净化器、maxHp 三档 +15、不抬效果上限。D1 把可实现数值写成现行，不再问人。
- Decision:
  1. 起始混乱：`startingChaos = round(CHAOS_HARD_START * (1 - hp/maxHp))`，`CHAOS_HARD_START = 50`。满完整度 0；hp=0 为 50。防御残留 `initial_chaos` 一次叠加上去。不改出击起始生命。
  2. CORE/STORAGE 效果分母锁死基准 100：`min(hp, 100) / 100`。加厚只抬血池。净化器起始混乱用 hp/maxHp 比例。
  3. 加厚费用 12 / 20 / 32 薪柴（档 1/2/3）。存档记 `moduleMaxHpTier`。不是蜕变项，不进 `upgrades.csv`。
  4. `abyss` 公式不改；三模块列入 context 后 65% 可触到。`stitch` 防御均衡覆盖三模块。不改 CSV、不改工具机制。
- Impact: `system-purification-impact` / `system-chaos-scavenge-extract` `interface-changed: true`。

## Slice 6 收工余项实现取舍（code，2026-08-19）
- Date: 2026-08-19
- Phase: Slice 6 收工
- Type: Technical
- Context: DEC-064 三件落地。换路从软偏好改硬保证后，单岛失败率升高；尘点不能每帧整图复合。
- Decision:
  1. `evaluateDualPath` 单文件，生成器与 `check:layout` 共用。换路失败返回 `no dual-path`，重试整岛，不换生成器、不加细墙。`MAX_ISLAND_ATTEMPTS` 从 10 提到 **32**（上限内的技术判断）。
  2. 尘点不烤进出击地面。`paintSkyShade` 把 mote stamp 画进已有 additive rim 缓冲，位移 `(phase - field.phase) * slideSpan` 沿 `windX/Y`。雾仍烤死。
  3. `rollFragmentAxes(seed)` 均匀抽 3×3，写进 `GeneratedRiftLayout` 与 `RuinedMask`。缺字段才回退 `standard`+`broken`。矩形错误块按年龄真画，不把年龄写进 CSV 当新碎片种类。
- Impact: `npm run check:layout` 无换路 = FAIL。不标 Slice COMPLETE。

## DEC-064: Slice 6 收工条件 + Slice 7/8/9 一次拍板（人锁）
- Date: 2026-08-19
- Phase: Slice 6 收工 → 接着做 7 / 8 / 9
- Type: Design + Process
- Context: 人要求全托管收 Slice 6，再一口气做完 Slice 7、8、9。设计/实施前一次性问完；之后禁止再问。中途只在游戏打不开或地图连通 FATAL 时停。不做人中途审美否决等待。Slice 10（NPC）不做。撤离多样性不塞回 6。Slice 5「体验未验证」不挡 7/8/9。
- Decision:
  1. **Slice 6 收工必须三件都做完才标 COMPLETE（覆盖 DEC-062 第 5 条「仍待」）：**
     1. **换路硬保证（规格 21）：** 每张成品图从出生到唯一撤离点必须有两条可走的路——一条更短更暴露、一条更长更隐蔽。不是两个撤离点，不是捷径口。生成失败则重试，禁止为了挤路而破坏形状闸门或连通 FATAL。`check:layout` 无换路 = 坏图。
     2. **尘点沿风位移：** 氛围场已有的尘点不再只烤死在地上；出击中沿本趟风向随 `phase` 漂移。与天空巨影同一根风轴。雾池仍烤死。
     3. **污染年龄 × 残破度乘进生成器：** 每一次踏入抽 `contaminationAge`（new / standard / ancient）与 `ruinSeverity`（intact / broken / eaten），旋钮按 `docs/art/rift-fragment-surfaces.md` 组合轴落地。禁止所有碎片永远 `standard` + `broken`。禁止新色。
     4. **小地图（DEC-063）：** 机械层已交。本收工不等人终审；中途只停 FATAL。
  2. **Slice 7 净化点扩张：**
     1. 第三模块 = **净化器**。完整度越高，出击**起始混乱越低**（满血约从 0 起；残血带入部分混乱）。不改出击起始生命。
     2. 模块升级：改造祭坛旁新交互，花薪柴永久提高**全部模块** `maxHp`，3 档每档 +15（100→115→130→145）。不按模块分别升级，本 Slice 不抬效果上限公式。
     3. `abyss` 65% 上限与 `stitch` 三模块文案在第三模块落地后复核。
  3. **Slice 8 第二敌人：**
     1. 改写体 = **听觉为主、视锥更窄**；对移动噪声敏感。与渗透体「绕视锥」形成第二条判断。
     2. 每张裂隙 **渗透体为主 + 恰好 1 个改写体**。
     3. 「被发现」= 屏缘方向脉冲，强度跟察觉度；警戒时形态变。**没有数字条。**
     4. 敌人属性进 `data/enemies.csv` 再 codegen；渗透体一并迁出 `constants.ts` 的策划向字段。
  4. **Slice 9 音乐/音效：** 按 `docs/audio-direction.md` **几乎全表**落地（5 条场景氛围循环 + 裂隙分层混音 + 清单内 SFX）。仓库无现成音频：本 Slice **生成占位音进仓库**（OGG+MP3），接线可播，不等人投外部音色。
  5. **关键节点：** 每个 Slice 收工提交一次；spec 落地、大功能接线再各提交一次。进度写入本文件与 `current-slice.md`。
  6. **不做：** Slice 10；撤离多样性；框架层 A 改动。
- Impact: Slice 6 在三件落地前不得标 COMPLETE。7/8/9 范围以此条为准，不再问人。

## DEC-063: 裂隙小地图改为跟随玩家的圆形局部窗口（人锁）
- Date: 2026-08-19
- Phase: Slice 6（检查点后热修，不是新 Slice）
- Type: Design + Art + Process
- Context: 程序化地图把生成器整块矩形格子缓冲（64×42）画进右下小地图后，陆地是黑底剪影，矩形缓冲边界可读。人不要这个。人已点名改版并要求规范实施（design 就地扩写 → art 合规核对 → code → qa）。
- Decision:
  1. **窗口：** 小地图是圆形。圆是跟随玩家的局部窗口，不是把整张 64×42 压进一个圆。直径（以格子计）必须小于缓冲，即使站在岛中央也看不全整张缓冲。
  2. **迷雾：** 覆盖范围内同时显示已探索部分与未探索迷雾。
  3. **边界皮：** 圆边界必须像裂隙随身罩（`.device-plate`、项目色板）。禁止通用雷达细框 / 灰金属线。人否过 1 像素 `#2a2d32` 框。
  4. **禁止读出缓冲：** 玩家不能以任何方式从小地图读出 64×42 矩形边界。不要硬切边、不要缩放到刚好塞进整张缓冲。走到岛边时，虚空与雾不能暴露矩形缓冲的直角。
  5. **揭示 = 真实视野：** 与裂隙主画面同一套遮挡 / 视锥真相（`VisibilitySystem`）。已探索集合来自实际见过的格子，不是脚边约 2.5 格的灯半径近似圆。玩家标记带朝向。
  6. **深渊之眼：** 保留现有工具语义（时限、衰减、闪、敌方、节点形状），接到新圆形窗口上，不另起一层界面。
  7. **撤离：** 仍只标一个撤离点；标记形状不新造第二种符号（竖缝可保留，除非 art 核时必须微调像素尺寸）。
  8. **挂载：** 屏幕空间仍挂 `#dom-ui-root`。禁止 `document.body` + `position:fixed`。禁止 Phaser `scrollFactor(0)` 角锚。
  9. **范围：** 不改净化点、不做撤离多样性、不改生成器缓冲尺寸来「藏」边界。不标 Slice COMPLETE。
- Impact: 规则 30 就地扩写；视野规格最少补句；视觉通行证第 4 节就地更新；`src/ui/minimap.ts` + 裂隙场景接线。已见格子经场景层翻译，系统互不直接 import。

## DEC-062: 裂隙程序化地图检查点（人 ok；不收工）
- Date: 2026-08-19
- Phase: Slice 6
- Type: Design + Process
- Context: 人试玩后说「ok了」，要求记录当下这个关键节点。这是检查点，不是 Slice 收工。不要标 COMPLETE，不要开下一 Slice。
- Decision:
  1. **活策略锁死：** 每一次踏入裂隙 = 抽一个风格锚 + 新种子 + 邻域抖动，再生成并烤图。十张 PNG 是样例，不是地图库。禁止两种骨架插值。禁止把画廊静帧接进游戏当地图。
  2. **合同入口：** `docs/design-notes/slice-6-layered-generation.md`「Agent 入口」。代码：`src/generation/recipes.ts`（`PREVIEW_RECIPES` / `jitterRecipe`）、`src/generation/rift-layout.ts`（`pickRecipe` / `generateRiftLayout`）。找/扩钩子：CLAUDE.md 当前阶段、AGENTS.md、`.cursor/rules/map-generation-strategy.mdc`（alwaysApply）。
  3. **人认此节点：** C3+C4 已接（RiftScene 吃 `generateRiftLayout`；手写图只当夹具；阵亡/撤离回净化点，DEC-056）。C5 已接：地表读碎片表；正式抽取只开 CSV `enabled` 的三行（`frag-outdoor` / `frag-clinic` / `frag-metro`）；library / residential 锚在配方表，CSV 仍 `false`。
  4. **天空必须循环，且不得整图 CPU 重烤：** 同一份场只改 `phase`；雾烤死。曾对 2048×1344 整图 CPU `compositePaint` ~5s/帧，角色几乎无法移动。生产约束：地面（含雾）出击烤一次；天空 64×42 低分辨率叠层循环。人已 ok。
  5. Slice 6 仍 **ACTIVE**。仍待：规格 21 双路径软目标；尘点沿风位移；污染年龄 × 残破度轴还没乘进生成器。
- Impact: 进度文档登记检查点。不标 COMPLETE。不发明下一手范围。

## DEC-061: C2 密度人锁；开 C3/C4 接到裂隙
- Date: 2026-08-18
- Phase: Slice 6
- Type: Design + Process
- Context: 人看过五案结合后再收约 20% 空地的十锚，效果认可，指令「落地到游戏里吧」。覆盖 DEC-060 / current-slice「下一手是人看收紧后的十锚」。不要再问人确认密度。
- Decision:
  1. 预览密度视为人锁。种子 101：墙约 18%（顶）、空矩形 72–99、掩护 P90 5–7。`sight≤14` / 空矩形 48 **禁止**当生产循环。形状仍走 DEC-058 厚短残块 + 正交 B；密度仍走 DEC-060 结合层。
  2. 本批开 **C3 布点 + C4 裂隙接线**。活路径是配方栈 `generateRecipeDraft`，禁止把 `masses.ts` 围院语言接进 RiftScene。
  3. 规格 21「至少两条换路」本批为软目标：C3 先做出生→撤离可达 + 两端分列。不要为双路径破坏形状闸门。缺口记进 current-slice。
  4. C5（`procedural-surface` 读 `fragmentTypeId`）本批不做。A1 合同已写，但实现是改写着色参数，和 C3+C4 同会话会爆。踏入后本批仍可能是写死户外灰绿（规格规则 24），下一批补。
- Impact: C3/C4 开工。Slice 6 不标 COMPLETE。阵亡/撤离按 R 回净化点（DEC-056）必须在 C4 改 `RunController.restart()`。

## DEC-060: 五案结合进预览密度（待人看十锚）
- Date: 2026-08-18
- Phase: Slice 6
- Type: Design (preview trial)
- Context: 人看完 A/B/C/D/E 对照后说有一点意思，授权大胆把方案合理结合起来试。禁止把 `sight≤14` / 空矩形 48 请回生产循环。
- Decision:
  1. 预览栈在身份墙（骨架 + 1b）之后加一层结合密度 `stealth-density.ts`，仍不接裂隙。
  2. 结合方式：D 当尺（可藏距离 P90≤8、距掩护 >7 的最大块 ≤48；薄墙/雾/2×2 胡椒不计分）；A 的落点（新件进当前最大空地，同家族厚短件）；B 的缝宽与停手（邻件约 4–6 格，下一坨进入 7 格锥且院不太大就停，留一块 6×6 院）；C 只给褶脊 / L / 双梁 / 宅基加尽端开口的 2 厚隔断；E 从已有大件长 2 厚短刺，不织网；`rim-soil` 只沿缘向内长牙，岛心空。
  3. 形状闸门与连通仍 FATAL。墙占比 18% 仍是顶。十锚身份句不改。
- Impact: C2 试结合，等人看 `spatial-drafts/index.html`。机器闸门已含掩护距离。未接 RiftScene。C3 仍等密度被人认。

## DEC-059: 方向 1 落地成操场；中等空地待拍
- Date: 2026-08-18
- Phase: Slice 6
- Type: Design
- Context: DEC-058 方向 1 原文是「地上几块厚东西、空地中等、穿越要算」。形状闸门替换 `sight≤14` 后十锚墙约 2–8%、最大空矩形 187–336、掩护距离 P90 21–26。7 格视野下没有下一处可藏体量。迷宫（路比墙细）和操场（墙少到灯里没有下一坨）是两头。
- Decision:
  1. 承认当前十锚不合格于潜行探索，不是「方向 1 就该空」。
  2. 五案对照入库（预览、不接裂隙）：A 同家族加件；B 按锥距补洞；C 链式院子；D 可藏距离场（尺，不改墙）；E 大件长法兰。看图：`docs/art/demos/slice-6-outline/spatial-drafts/probes/index.html`。
  3. **密度补丁待人拍**后再改生成器。禁止把 `sight≤14` / 48/10 请回生产循环。
- Impact: C2 未完；C3 等密度锁。形状闸门与正交 B 仍有效。

## DEC-058: 细长条墙读成迷宫；改形状不改色
- Date: 2026-08-18
- Phase: Slice 6
- Type: Design
- Context: 人看十锚预览，第一反应是迷宫。设计 + 美术独立看图后再互批。实机前向视野 7 格、敌锥约 5.6 格；预览却用 `sight≤14` 当生产目标去加 1 格宽墙。
- Decision:
  1. 诊断锁定：迷宫是墙与路宽度反了（1 格墙夹 1–2 格槽），不是墙格百分比。层 1 贯穿细骨架 + 层 1b 劈院工厂 + 视线闸门三件事叠在一起。真实长墙可以有，不能用很多根同样细的条拼接。换色救不了。
  2. 只改掩护层、或只把 `sight` 放到 18–22，不够。潜行目标 48/10 当硬闸门会更迷宫。
  3. 下一手无论密度选哪条，都必须：停掉「切到看不见」；拆 `bisectYard` / extra 细条；层 1 贯穿 1 格骨架一起改；形状闸门见 `docs/design-notes/slice-6-layered-generation.md`「墙剪影 / 反迷宫」。
  4. **已锁（2026-08-18 人拍）**：密度 = 方向 1 厚短残块铺开；正交 = B（诊所/地铁也收成短板/坨，全图最多一把 L）。
- Impact: 规格规则 O 16a。生成器按合同「已锁：密度方向 1 + 正交 B」改形状闸门；`sight≤14` 不再当 FATAL。连通 / 不封房间 / 不换算法不动。

## DEC-057: 裂隙地表按碎片类型表驱动（三种先接通）
- Date: 2026-08-16
- Phase: Slice 6
- Type: Art
- Context: 人认体验方案并说继续。A1 要给户外 / 医院 / 地铁写世界层视觉合同，成品靠扩展+组合，不发明新色。
- Decision:
  1. 种类差异 = 已锁 L1 + 材质残影 + 墙形状语法（土脊 / 隔断 / 柱列）。禁止只换底色同一堆石头。
  2. 污染仍是 §4.2 数据错误。`contaminationAge` / `ruinSeverity` 只调已有浓度表与 `SURFACE` 旋钮。
  3. 虚空三种地方共用 `void-black`。加第四种 = CSV 新行。
  4. 合同：`docs/art/rift-fragment-surfaces.md`。`procedural-surface.ts` 写死的 `frag-outdoor` 必须改读表。
- Impact: art-direction §4.2 / §14.3 各回写一句指针。图书馆 / 居民区本批不写完整参数。

## DEC-056: 阵亡回净化点；撤离坐标改由生成器给出
- Date: 2026-08-16
- Phase: Slice 6
- Type: Rules
- Context: 人明确阵亡=失败、回净化点，最好带轻微惩罚。现状阵亡结算按 R 是原地重新出击，可以不回净化点。人同时要求旧撤离规格补「位置从生成器来」。
- Decision:
  1. 阵亡与撤离成功同一去向：结算后回净化点。禁止原地按 R 再打这一次。
  2. 薪柴仍为 0。这次出击仍走归来/冲击。不另扣稳定度——相对「死了按 R 逃课」，必须回去就是惩罚。
  3. 出生/撤离/薪柴坐标由地图生成器给出。`system-chaos-scavenge-extract.md` 已就地补句。
- Impact: 结算底栏阵亡也写「返回净化点」。`RunController.restart()` 阵亡分支待实现时删掉原地重开。

## DEC-055: Slice 6 开工范围（程序化地图；撤离多样性延后）
- Date: 2026-08-16
- Phase: Slice 6 开工
- Type: Scope
- Context: 人接受「程序化替换裂隙固定图」，但明确不要捷径口、本 Slice 不考虑撤离多样性。另点名三条体验约束：可走区外轮廓必须不规则；障碍必须有情景；不同出击禁止同一套配色/氛围。相交矩形并集只是外轮廓参考之一。
- Decision:
  1. Slice 6 名称按交付收为「程序化地图」。vision Nice-to-have「撤离点多样性」**不**在本 Slice；DEC-041「与生成同 Slice」对多样性这条暂缓，生成器仍要放**一个**撤离点（位置不固定）。
  2. 每一次从净化点踏入裂隙时生成完整布局；出击未结束前不变。尺度：主干走路约 40–60 秒。
  3. 三条体验约束写入 `current-slice.md`，规格必须每条给多解，禁止唯一算法先写死。
  4. 新建 `docs/specs/system-map-generation.md`。撤离规格默认不扩。
  5. 「多种裂隙环境」在 vision 为明确不做、world 写过 MVP 一套主题——**本 Slice 以人的指令为准**，做有限种碎片氛围（优先用已锁 L1 记忆色），不是无限生物群落。
- Impact: `current-slice.md` ACTIVE；`docs/tasks/slice-6.md`；roadmap 当前行。多样性仍留待后续 Slice。

## DEC-054: Slice 5.5「UX 重构」COMPLETE
- Date: 2026-08-16
- Phase: Slice 5.5 轻量路径收尾
- Type: Process
- Context: 人指令「完成当前 slice」。此前多轮当场看过墙机/裂隙 HUD/主菜单/底栏按键，并说过改了的看上去 ok。轻量路径收尾四项此前未记完，不得标 COMPLETE。
- Decision:
  1. Slice 5.5 标 COMPLETE。验证方式是打磨 Slice 的「改一版→人看→再改」，以人要求收尾为终审信号。审美与「读作游戏」由人拍，agent 不代写好看/PASS。
  2. 收尾四项：架构注册表已含检视层 / 裂隙 HUD / toast / 小地图挂载根；spec 就地扩写 growth-tide / chaos-scavenge-extract / purification-impact；Kit §A0/A1 回写（裂隙 HUD 已是 DOM，废 Phaser ×1.5）；本文件 + current-slice + roadmap 记交付范围；U1–U12 机械层登记，审美以人收尾指令为准。
  3. Slice 5 遗留「装配是否纠结」：机制上装防御不是放弃工具。5.5 只讲清事实。若要真实犹豫，回 design 重审收益结构，不在本 Slice 改公式。
  4. 「被发现指示」仍不做；按 DEC-053 留给 Slice 8。
- Impact: `docs/progress/current-slice.md` COMPLETE；`roadmap.md`；`CLAUDE.md` 当前阶段。下一 Slice = 6 程序化地图 + 撤离点。

## DEC-053: Slice 6 与 Slice 8 对调
- Date: 2026-08-16
- Phase: Iterative Development（5.5 收尾时人拍板）
- Type: Process / 编号
- Context: 人要求「slice 6/8 对调」。此前（2026-08-12）第二敌人是 Slice 6、程序化地图+撤离点是 Slice 8（DEC-041 把撤离点并入当时的 Slice 8）。
- Decision:
  1. **Slice 6** = 程序化地图 + 撤离点多样性（Voronoi+CA；多个撤离位置/条件）。DEC-041 的「撤离点与程序化地图同 Slice」内容保留，编号改为 6。
  2. **Slice 8** = 第二敌人（潜行轴：改写体、感知/行为、AI 类型泛化、敌人 CSV 拍板、敌人视觉、「被发现」指示）。
  3. Slice 7 净化点扩张、9 音乐/音效、10 NPC **不变**。
- Impact: `roadmap.md`、`CLAUDE.md` 编号段、`gdd-core.md`、`backlog-issues.md`、活文档里「第二敌人→6 / 地图→8」的指向。历史 DEC 正文不改写。

## DEC-052: 主菜单三组身份 / 纪录读数 / 动作；游标只属动作行
- Date: 2026-08-15
- Phase: Slice 5.5 轻量路径（人主菜单截图：关系/主次不清）
- Type: Display / UX（结构澄清，不改玩法、不改 DEC-050 文案词）
- Context: 摘要与选项几乎同字号、同列、组间距不够，读数和可点项分不清。未选项 `>` 与已选项 `▸` 同时出现，像两种按钮。载体仍 C；不要改成 DEC-049 墙机。
- Decision:
  1. 标题屏永远三组：身份（`存续` + 副题）/ 纪录读数（有纪录才画潮汐·出击·稳定度；覆盖确认改留警告句）/ 动作（无纪录仅「进入净化点」；有纪录「沿旧路返回」默认 + 「新的纪录」）。
  2. 摘要贴动作组正上方，属读数，不是第三种按钮。组间空隙必须明显大于组内行距。
  3. 游标只属动作行。未选中动作行无可见前缀（本屏列表静默不再用 `>`）；已选中 `▸`。读数 / 警告 / 身份禁止 `>` / `▸`。净化点底栏单行 `>` 本轮不改。
- Impact: `docs/design-notes/ux-menu-structure-slice-55.md`；Kit §A5-1；`src/scenes/main-menu-scene.ts`。审美待人终审。本 Slice **不标 COMPLETE**。

## DEC-051: Slice 5.5 四处缺口合同（CRT 分区 + L2 摘要 + toast 队列 + 工具剩余秒）
- Date: 2026-08-15
- Phase: Slice 5.5 轻量路径（人选择先补四处小缺口再走第二种敌人）
- Type: Display / UX（只锁结构与文案；CSV 策划源可改；不改玩法公式）
- Context: 人点名四件事：净化点大屏重要信息与库存同卷滚动；物品说明是长文截断；提示叠在一起；裂隙看不到工具还剩几秒。上一轮文案合同（DEC-050）已声明这四项「不在本轮」。
- Decision:
  1. S3–S8 按 `menu-crt-_layout.md` 分区落地：决策区 `.panel-fixed` 永不滚；只有库存（蜕变六卡装不下才滚卡区）是 `.scroll-area`；检视 `min-height` 110px 不被挤掉。不重做机身、不删 P1。S3/S8 无滚动区。
  2. `data/contaminants.csv` 扩 `summary_defense` / `summary_tool`（分列在对应 description 后）。硬上限 15 字（标点计入、空格不计）。IA 四条标杆原样。其余 14 型本轮批量写入。L2 不再截断长描述。
  3. `showToastInline` 通道 B：同时最多 2 条可见，后来排队，不重叠同一像素，默认 2s。拾取 `+N` 仍 800ms 不入队。不要新通道、不要居中弹窗。
  4. 裂隙生效中：每条进行中限时工具 = `displayNameTool` + 剩余整数秒（分节点）。防御残留限时行保持。`tool_duration_ms === 0` 不上。tool-system 只读暴露列表，不改效果。
- Impact: `docs/design-notes/ux-gap-lock-slice-55.md`；`data/contaminants.csv`。code 未改。codegen 需把新列打进 `ContaminantDef`。审美待人终审。本 Slice **不标 COMPLETE**。

## DEC-050: Slice 5.5 文案合同（完整度 + 主菜单 + 上屏错名）
- Date: 2026-08-15
- Phase: Slice 5.5 轻量路径（写错的必须修 + 主菜单内容）
- Type: Display / UX（只锁可见字符串与信息结构，不改玩法）
- Context: 人问「生命值？在本游戏里不叫完整度吗？」净化点已上屏完整度，裂隙 HUD 写 HP、结算写 HP 均摊、蜕变卡名生命强化、i18n 写「状态」。主菜单是「新存档/读取存档」、无摘要。人授权 design 定文案、code 去改。
- Decision:
  1. 玩家那条量一律「完整度」。禁止 HP / 生命值 / 状态。「生命强化」保留为仪式卡名，效果行「完整度 +N」。stitch「HP 均摊」→ 表名「均摊」+ 数值。模块保持「核心完整度 / 储藏完整度」。HUD 不加「躯壳」。
  2. 主菜单：无纪录唯一「进入净化点」；有纪录默认「沿旧路返回」+ 潮汐/出击/稳定度分节点摘要；第二项「新的纪录」。覆盖警告保留。暂停三项「新的纪录 / 沿旧路返回 / 合上」。禁止存档/读取/确认/OK/Continue。
  3. 拾取=残渣名；计数/空态=残渣；蜕变底栏=刻入；失焦=按任意键；开机=载入；薪柴有表名无 ◇；混乱增速一种写法。
- Impact: `docs/design-notes/ux-copy-lock-slice-55.md`；`docs/world.md` 术语表。code 未改。审美待人终审。本 Slice **不标 COMPLETE**。

## DEC-049: 净化点交互面板锁定 CRT 磷光屏（680×468，无金属/无外框）
- Date: 2026-08-14
- Phase: Slice 5.5 轻量路径（S3–S8）
- Type: Display / UX
- Context: 人锁方案 1 CRT。样张审美「风格不错」；否决全屏太大、几乎纯黑白、灰色金属底色框。后取消 1px 外框——靠扫描线与发暗边缘从场景分开。授权把锁定稿写入 `src/**`。
- Decision:
  1. S3–S8 共用 `.game-panel` 默认机身：`680×468`，`top:52px; left:140px`（960×640），挂 `#dom-ui-root`。不盖 DEC-048 贴顶三槽 HUD。
  2. 无金属面壳、无 1px 外框、无圆角、无 box-shadow、无 HTML 主按钮排。玻璃 `rgba(15,17,20,0.88)`；teal 扫描线；backdrop 透明。键印屏底。
  3. Kit A2 语义色：薪柴/储藏/费用 `#c4873a`；潮汐/混乱/工具防御/转化 `#1aad96`（★★★ `#3cffd4`）；冲击 `#cc3333`；中等/临界 `#b89040`。表名/数值/档位分节点。
  4. Esc 记录菜单与裂隙结算保持居中小读出（内联覆盖 CRT 占位），本批不铺满磷光屏。
  5. 原「右侧 440px 全高抽屉」作废。
- Impact: `panel-styles.ts` + S3–S8 六个面板；Kit §A5-5～A5-12；`art-direction.md` §6.4；`architecture.md` PanelStyles。审美 / U1–U12 仍等人终审。本 Slice **不标 COMPLETE**。

## DEC-048: 净化点 HUD 布局锁定 Alt B 贴顶横槽
- Date: 2026-08-14
- Phase: Slice 5.5 轻量路径（S2）
- Type: Display / UX
- Context: 人否决竖表/三列对齐（丑、主次不分、散）。四套互斥方案后人口授「就 B」。
- Decision:
  1. `#purif-hud` 改为贴顶靠右横排三槽：`薪柴 11` / `潮汐 第 N 潮 涨潮` / `下次归来 核心 中等`。槽内 gap 4px，槽间 gap 32px。
  2. DEC-047 文案节点仍有效。取消常驻 HUD 上的 ◇/◈/▣、波形、pip、间隔号 `·`。消声为可选第四槽（三槽左侧），opacity 0.85。
  3. 轻微/中等档位不上薪柴橙；剧烈/极端用 `#cc3333`。不套 `.game-panel`。
- Impact: `purification-hud.ts`；Kit §A5-3；IA §S2。底栏不改。

## DEC-047: 净化点 HUD 右上四行写明；冲击档位中文沿用 SEVERITY_LABEL
- Date: 2026-08-13
- Phase: Slice 5.5 轻量路径（S2 右上读数）
- Type: Display / UX
- Context: 人要求右上不要隐晦符号（不要学 ◈=核心、▮ 格数=档位）。档位中文当时有三套说法：人口授「轻/中/重/极端」、IA 例句「中」、S8 已上屏 `SEVERITY_LABEL`（轻微/中等/剧烈/极端）。相位必须对照已有 TidePhase，不得发明满潮/落潮。
- Decision:
  1. `#purif-hud` 四行结构锁为独立节点：薪柴＝表名「薪柴」+ 数字；潮汐＝「潮汐」+「第 N 潮」+ 涨潮/潮峰/退潮；预告＝「下次归来」+ 核心/储藏 + SEVERITY_LABEL；消声淡预告＝「再下一轮」+ 同一套目标/档位（仅 `getForecastLookahead()` 非空）。
  2. 全项目冲击档位中文沿用已上屏 `SEVERITY_LABEL`，HUD 必须读同一份，不另造短档名。U5：预告不得写「中」而结算写「中等」。
  3. 符号（◇/◈/▣/波形/pip）最多前缀或第二编码，不能代替字。不套 `.game-panel`，仍挂 `#dom-ui-root`。稳定度不加回 HUD。DEC-034 仍不报方向。
- Impact: `docs/design-notes/ux-information-architecture.md` §S2；`system-growth-tide.md` 规则 22；`system-purification-impact.md` 规则 7；`docs/world.md` 术语表补核心/储藏/潮汐三态/四档中文。art 只核视觉；code 改 `purification-hud.ts`。S8 本批不改。

## DEC-046: Slice 5.5 C3 键盘游标导航 + 检视层落地的实现取舍
- Date: 2026-08-12
- Phase: Slice 5.5 实现（C3）
- Type: Technical choice
- Context: `loadout-panel.ts` / `defense-panel.ts` 此前完全没有键盘游标导航（`onKeyDown` 只处理 Escape），检视层要落地必须先补这层。以下四点是施工中做的、影响后续批次（C4/C5/C6）该怎么复用这套基础设施的取舍：
- Decision:
  1. **游标模型用"一维环绕移动"而非真正的二维空间寻址**：四个方向键统一映射为"当前区内 prev/next"（↓/→ = next，↑/← = prev，越界环绕），不按屏幕上的实际行列坐标做二维寻址。理由：槽位区最多 4 格、库存区是 flex-wrap 网格，视觉换行位置随窗口宽度变化，做真二维寻址需要在渲染后读取实际 DOM 几何——收益（更符合"上下"字面语义）不足以抵消复杂度和脆弱性。IA §0.4 原文本身也只要求"移动焦点"，未强制二维。
  2. **新增第三个焦点区 `actions`（确认/取消/离开按钮），扫描任务原文只点名了"槽位格与物品格"**：若不做，`loadout-panel` 的"踏入"确认操作将完全没有键盘路径（Escape 只能取消，不能确认），造成一个新的键盘陷阱，直接违反 U7。三个面板的 Tab 循环顺序固定为 `slots → inventory → actions → slots`。
  3. **L2 摘要走"取现有长描述第一分句 + 40 字上限截断"的降级方案**，不是真正的 ≤15 字摘要。`summaryDefense`/`summaryTool` 两列尚未加入 `data/contaminants.csv`（IA §S13 已给 4 条标杆但未获人确认批量语感），本批不擅自扩列 CSV schema。降级函数集中在 `inspect-dock.ts` 一处，CSV 列到位后只需替换这一处即可全量生效。
  4. **`getRarityStars`/`sortContaminants` 收进 `contaminant-names.ts`**（而非新开文件），随手带上把 C2 遗留的 `contaminant-names.ts` 补登记进 `architecture.md`（该模块 C2 引入但当时未登记）。
  5. **`status-panel.ts` 一并接上检视层**（任务原文允许"改动成本低则一并接上"）：判断为低成本，因为该面板已有 Tab/Escape 关闭约定不变，只需新增一维游标 + 移除 3 处 `title`，不需要 `actions` 区（面板本身只读，无装填/卸下动作）。
- Impact:
  - C4（供奉/踏入裂隙的整面板视觉重排）继承这套 `slots/inventory/actions` 三区游标模型，若要改用真二维寻址需要重新设计移动函数，非本批遗留债务。
  - `data/contaminants.csv` 扩列 `summaryDefense`/`summaryTool` 仍是 open item，登记见本批交付报告；扩列后只需替换 `inspect-dock.ts` 的 `degradeSummary()` 调用点。
  - `docs/specs/system-growth-tide.md` 规则 22 及 IA §4.1 列出的"污染物命名权威规则 / 检视层五层契约 / 库存排序规则"仍未落笔到 spec 正文——按 `code.md` 的文档权限范围，spec 正文由 design/director 在 Slice 收尾时处理，本批只登记不越权代写。

## DEC-045: Slice 5.5 方向确认通过，九项裁决落定，进入 C0–C6 实现
- Date: 2026-08-12
- Phase: Slice 5.5 实现开始
- Type: Process / scope
- Context: 第一波规格齐备（`ux-references.md` + `ui-art-overhaul.md` v2 + `ux-information-architecture.md`），Director 向人提交 D1–D9 九项方向确认清单。人回「开搞吧」——批准全部默认建议并要求立刻进第三波。
- Decision（D1–D9 全部按 Director 建议默认落定）:
  1. **D1 参考五选通过**：Signalis（世界内终端物理感）/ FTL（资源分配 HUD 语言）/ Darkest Dungeon（密集词条三层独立编码）/ Into the Breach（预告的诚实）/ Barotrauma（设备读数即状态）。
  2. **D2 可读性硬规则通过**：DOM 标题≥16px / 正文≥13px / 标签≥12px；Phaser HUD ≥8（等效 12px）；换算 `Phaser × 1.5 = 等效 DOM px` 且 DOM 根节点跟随 `Scale.FIT` 同步缩放；对比度 ≥4.5:1；`#5a5f66` 禁作文字色；关键数值须有除颜色外的第二重编码。**该节即为本 Slice 的 U9 项目内实例化，验收以它为准。**
  3. **D3 通过**：`purification-hud` 不套 `.game-panel`，与裂隙 HUD 同走「无边框装置读数」语言（A 类世界内装置）。要修的是内容完整度，不是载体。
  4. **D4 通过**：污染物中文名的唯一权威是 CSV，代码不得维护本地名表；同一效果的四种表达（`混乱增速 -18%` / `混乱率 x0.70` / `混乱抗 30%` / `-12%`）收敛为一种。
  5. **D5 通过**：冲击结算必须披露防御十项结果（`DefenseResult` 已算出但只传了 damages/intensity）；一次归来只保留**一个**需按键消解的通知——潮汐相位与稳定度里程碑并入冲击结算面板。
  6. **D6 通过**：检视层走「选中即检视」，五层（身份 / ≤15 字摘要 / 数值 / 与我的关系 / **转化去向**）；L2 摘要走 CSV 新增列 `summaryDefense` / `summaryTool`，先做 4 条标杆再批量补。
  7. **D7 通过（降级）**：稳定度从净化点 HUD 降到存续报告。理由：净化点每秒不变、不影响任何即时决策，且 100% 无终局内容（R6），进度条隐喻是空头承诺。**这需要改写 `system-growth-tide.md` 规则 22**——属展示层变更、不改数值，可回退。
  8. **D8 推迟到 Slice 6**：不在 5.5 做「被发现指示」。它不改数值，但会把潜行从"猜"变成"看"，是手感层的实质改动；Slice 6 潜行轴本来就要重做，同批做更干净。**裂隙 HUD 的 P1 信息集因此去掉这一项。**
  9. **D9 通过**：接受结构性风险 R1 的判定——当前机制下防御与工具**不构成二选一**（装进防御槽 = 先吃减伤，积满 3 点仍自动转化为工具，严格优于放着不动；稀缺的是 4 个槽位而非物品）。5.5 只负责把这个事实讲清楚（检视层 L5 转化去向），**不在本 Slice 改机制**。若人要真实的犹豫，另开 design 重审收益结构。
- 附带裁决（Director，实现期）:
  - **「术语单一来源」从 C6 提前到 C2**：裂隙 HUD 要显示工具中文名，而全项目没有权威名称源（五个面板五套名、同一工具两个名字），先建入口再接 HUD 比事后统一便宜。各面板本地名表的清理仍留在 C4/C5/C6。
- Impact:
  - 实现按 C0（共享基元层 + 可读性硬规则）→ C1（主菜单）→ C2（裂隙真 HUD + 调试面板降级）→ C3（检视层）→ C4（装配/供奉）→ C5（其余净化点面板）→ C6（反馈层 + 术语收口）推进，每批独立可看、独立 commit。
  - D5 涉及 `system-purification-impact.md` 的 `interface-changed: true`；D6 涉及 CSV schema 扩列；D7 涉及 `system-growth-tide.md` 规则 22 改写——三项均在收尾登记时统一处理（轻量路径收尾四项之「spec 判断」）。
  - D8 的推迟需在 Slice 6 规划时接住：`AISystem` 暴露 detection 值与来源方向的接口要求已由 design 登记。

## DEC-044: Slice 5.5 范围锁定为 ALL UI 表面，走参考驱动的体系设计（跳过 UX audit）
- Date: 2026-08-12
- Phase: Slice 5.5 ACTIVE
- Type: Process / scope
- Context: DEC-043 立项 5.5 时留了两条路——人给痛点清单，或先派 art+design 做一次 UX audit 让人从清单上挑。人直接给了诊断：**「不像游戏、不成体系」**，并把范围亲口定为 **ALL**（所有菜单、所有交互面板、所有 HUD、所有物品信息展示）。同时点名两处：裂隙场景**缺少真正的玩家 HUD**（显眼的是 dev 调试面板）；**文字信息必须能看清**。方法论上明确要求"不要闭门造车"，先梳理参考游戏的 UX 方法论与审美。
- Decision:
  1. **跳过 audit 路径**。audit 的价值是帮人从模糊摩擦里挑优先级；人已给出根因判断且范围是全量，audit 只会重复产出一份人已经说完的结论。
  2. **范围写死为 S1-S15 十五个表面**（Director 扫描 `src/` 全部 UI 表面产出，逐项附已核实病灶），不允许缩减。清单在 `current-slice.md`。
  3. **体系设计先于代码**。第一波只出规格：art 产出具名游戏参考研究 + 方法论（`ux-references.md`）并**就地升级** `ui-art-overhaul.md` 为 UX Design Kit v2；design 产出全表面信息架构（`ux-information-architecture.md`）。第三波 code 分 C0-C6 批落地，C0 先落共享基元库。
  4. **不新建 v2 视觉基线文件**。视觉真相优先级链是 `ui spec > ui-art-overhaul.md > art-direction §6 > world.md`；新建并行基线必然打架，故 v2 走就地升级（B 节角色美术不动）。
  5. **可读性升为硬门槛**，优先级高于装饰。具体数字（最小字号 / 最小对比度 / 第二重编码）由 art 在 v2 §A1 给出并经人确认，确认后即为本 Slice 验收基准，等同 U9 的项目内实例化。
  6. **裂隙 HUD 与 dev 调试面板分离**：交付真正的玩家 HUD；调试面板可作为开发开关保留，但不得默认显示、不得冒充游戏 UI（现状 `debugVisible = true`）。
- Alternatives:
  - 先做 audit 再挑 → 否，见上
  - 只修人点名的两处（裂隙 HUD + 可读性）→ 否，人明确说 ALL；且"不成体系"这个病本质上修不了局部（改一个面板只会让它和其余面板更不像同一台设备）
  - 新建 `ux-system-v2.md` 作为新基线 → 否，双基线打架
- Impact:
  - 这是本项目第二次表现层翻修（Slice 4.5 是第一次，七轮返工，根因记 FV-01）。本次前置了 FV-01 的全部对策：art 必经、载体决策、具名参考锚点、U1-U12 收尾。**若仍需大量返工，说明 FV-01 的对策不足，届时必须进 retro 而不是继续加轮次。**
  - 两套 UI 技术栈（Phaser Text/Graphics vs DOM overlay）的字号不对齐问题被正式认定为"不成体系"的技术性根因，必须在体系里解决，不再各自为政。
  - 物品信息展示从浏览器原生 `title` tooltip 迁移到世界内检视信息层——预期新增 `src/` 模块，收尾需登记 architecture.md。
  - Slice 5 的验证问题（装配决策是否纠结）继续挂在 5.5 观察；若 UX 收敛后仍不纠结，回 design 重审收益结构，不得改 constants 掩盖。

## DEC-043: Slice 5 在未回签试玩验证的情况下收尾，插入打磨 Slice 5.5「UX 重构」
- Date: 2026-08-12
- Phase: Slice 5 收尾 / Slice 5.5 立项
- Type: Process / sequencing
- Context: Slice 5 锁定范围 12 项全交付（另计划外 2 项），机器闸门（codegen/typecheck/build）全绿。人拿到了验收清单与 U1-U12，但未逐项回签，直接指示"收尾 5，增加 5.5，做 UX 重构"。同时 Slice 5 把界面承载的信息量推到新量级：主动工具 15 + 被动 3 + 污染物 18 + 工具槽 4 + 防御槽 4。
- Decision:
  1. **Slice 5 标 COMPLETE**，验证结论如实记为「实现完成、体验未验证」——不虚构 PASS，也不记 FAIL。其验证问题（装配决策是否纠结）**转入 Slice 5.5 期间观察**。
  2. **插入 Slice 5.5「UX 重构」**（打磨 Slice，走 FV-02 轻量路径，免完整 Task Brief），**Slice 6-10 编号不变**。
  3. Slice 5 未回签的 **U1-U12 并入 5.5 的强制验收范围**（5.5 必然触碰 in-game UI，一次过完比补签两次便宜）。
  4. 5.5 状态先记 **PLANNING**：范围由人指名痛点、或授权 art+design 做一次 in-game UX 审计后再锁定。Director 只出候选方向清单，不擅自开工大改。
- Alternatives: (a) 先补完 Slice 5 的试玩签字再开 5.5（拒绝：人已判断当前界面状态会污染试玩信号——玩家分不清 15 件工具做什么，装配决策的纠结感无从测量，先测等于测噪声）；(b) 把 UX 工作并进 Slice 6（拒绝：6 是第二敌人，验证潜行轴，混轴则反馈无法归因，与 DEC 拆分 Slice 5/6 的理由同源）；(c) 记 Slice 5 为 PASS 走完形式（拒绝：没有证据的 PASS 会让后续 Slice 建立在假前提上，恰是本项目反复付过代价的失败模式）。
- Reason: 装配决策的"纠结感"是**通过界面被感知的**——信息读不出来，机制再对玩家也感受不到。先收敛 UX 再验证装配决策，是把验证放在能产生有效信号的时点，而不是补一次注定不可归因的试玩。
- Impact: `roadmap.md`（Slice 5 入已完成表 + 完成总结 + 当前 Slice 改 5.5 + 范围草案 + `last-closed-slice: 5`）、`current-slice.md`（Slice 5 收尾章节，随后由 5.5 覆写）、`CLAUDE.md` 阶段行、`gdd-core.md`（系统列表 4 行 + 内容计数 3 行 + 设计历史 1 条）、`backlog-issues.md`（Slice 5 遗留归属，`purification-hud` 划归 5.5）、`system-purification-impact.md` 与 `art-direction.md` 变更标记重置为 false。

## DEC-042: 建立 Slice 9（音乐/音效）与 Slice 10（NPC）
- Date: 2026-08-12
- Phase: Roadmap 规划（Slice 5 验收前）
- Type: Scope / sequencing
- Context: vision 将「音效接入」放在中期候选、「完整音乐/音景」「NPC 互动」放在 Out-of-scope；人要求正式占位排期。
- Decision:
  1. **Slice 9 = 音乐 / 音效**（环境音 + 关键交互反馈 + 音乐/音景；启动时再锁 P0/P1）。
  2. **Slice 10 = NPC**（占位排期；**具体设计在该 Slice 启动时再做**，现在不定机制与范围细则）。
- Alternatives: 继续留在 backlog/Out-of-scope 不占号（拒绝：人要可见的后续槽位）；把 NPC 提前到玩法系统 Slice 之间（拒绝：人指定 9=音频、10=NPC）。
- Reason: 音频与 NPC 都依赖玩法闭环稳定后再做；占号避免遗忘，细则留到启动时设计以免现在空转。
- Impact: `roadmap.md` 计划表新增 9/10；原 Out-of-scope / 中期对应条目迁入「已排入计划 Slice」；CLAUDE.md / `slice-5.md` 不做列表已同步。

## DEC-041: 撤离点多样性并入 Slice 8（与程序化地图同 Slice）
- Date: 2026-08-12
- Phase: Roadmap 规划（Slice 5 验收前）
- Type: Scope / sequencing
- Context: vision Nice-to-have「撤离点多样性（多个位置 / 不同条件）」原在 roadmap backlog 近期候选；Slice 8 已定为程序化地图（Voronoi+CA）。
- Decision: 撤离点多样性从 backlog 迁出，并入 **Slice 8**，与程序化地图同 Slice 交付。
- Alternatives: (a) 独立成 Slice 9（拒绝：生成地图时天然要决定撤离点放置，拆开会二次改布局约束）；(b) 提前到固定地图阶段做（拒绝：固定地图上补多撤离点，生成器上还要再做一遍）。
- Reason: 程序化生成与多撤离点/不同条件是同一套放置与可达性约束，同 Slice 更干净。
- Impact: `docs/progress/roadmap.md` Slice 8 行与 backlog 分区已更新；CLAUDE.md 顺移说明追加一句。

## DEC-040: `muffle` 的"提前一轮"实现为第二层预告（预支承诺，非二次猜测）
- Date: 2026-08-12
- Phase: Slice 5（收口）
- Type: Rule clarification + implementation
- Context: `muffle` 的防御副作用"冲击预告提前 1 轮显示——比正常多 1 轮准备时间"从 Slice 4 起从未实现（`applyMuffle()` 只留了一句"由净化点场景处理"的注释，而场景里没有对应代码）。DEC-034 把预告改为非空间后，"方向预告提前"这个措辞也失效了。
- Decision: 在新语义下"提前一轮"= 装备 muffle 时，HUD 除第一层预告外**额外显示下下次冲击的目标模块与强度**。实现用"预支承诺"：装备时提前掷定目标存入队列，下一轮生成第一层预告时消费该队列值作为 ground truth——所以第二层展示的目标**保证**会原样成为下一轮的第一层，而不是两次独立猜测偶然吻合。强度取 `tideSystem.peekNextIntensity()`（潮汐推进无随机数，是精确预测而非估计）。
- Alternatives: (a) 判定该效果在非空间预告下已废弃、改 CSV 换一个收益（拒绝：这是降级，人已明确否决"觉得难就改设计"）；(b) 第二层只显示模块不显示强度（未采用：`peekNextIntensity()` 使强度可精确预测，没有必要隐藏）。
- Reason: "多一轮准备时间"的字面收益就是多看一层。预支承诺保证了这个收益是真的，而不是概率巧合。
- Impact: `retrograde` 依赖的 ground-truth 判定链未改动（`forecastTargetId === actualPrimaryId` 一行原样保留）。第二层预告**不叠加** `mirror` 谎报与基线档位模糊——即它是字面意义的"预知"。若试玩觉得过强，加失真是数值层调整，不回退本决策。CSV 文案已同步。

## DEC-039: Slice 5 收口期的四项局部实现选择
- Date: 2026-08-12
- Phase: Slice 5（收口）
- Type: Implementation choices（由 code agent 在执行中做出，Director 补记）
- Decision:
  - **第 3 个主动工具快捷键选 G**。Q/F 已占用，E/R 分别是交互与重启；G 紧邻 F，与 Q/F 同属"移动区外扩一格"的手感，不需要移动手部位置。键位序列收敛为 `GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS`，HUD 与装备面板都从该常量读，杜绝"面板写一个键、实际绑另一个"。
  - **`resonate` 装备期被动用布尔开关而非计数器**。CSV 要求"多件不叠加"，布尔开关从结构上保证了这一点（1 件或 5 件都只置 true 一次），比计数器再夹逼更不容易写错。
  - **`siphon` 的修复效率改为"装备期间"实时同步**，与 `resonate` 走同一组防御槽变更点（`slotDefense`/`unslotDefense`/两处冲击转化/`reset`/`loadState`）。原先那条"每次冲击结算时一次性赋值、且卸下后从不复位"的旧管线已删除，避免两套逻辑并存。该状态不进存档（纯派生态，加载后从防御槽重算）。
  - **听觉范围倍率是全局字段而非逐敌人字段**。`proximity_sense_boost`（muffle 作为防御残渣的副作用）影响的是本次出击所有敌人，与 `setHearingSuppressed()`（muffle 作为工具时屏蔽听觉）是两套独立机制，刻意分开命名以免后来者混淆。
- Reason: 四项都是实现层选择，不改变已拍板的设计语义，但都属于"下一个人必须知道才不会改坏"的约束，故留痕。

## DEC-038: 工具使用 VFX 规格 — "世界痕迹"而非"施法动作"；网格块集群替代圆形；受影响敌人复用坏像素亮度联动

- Date: 2026-08-12
- Phase: Slice 5（T4 工具使用 VFX 规格 + B3 art-direction §6 复核 + T5 第 4 槽位视觉判断）
- Type: Visual design decision
- Context: 15 种主动工具（`tool-system.ts`）已全部实现游戏效果（T1/T2），但表现层是 Slice 4 起的占位手法：`fillCircle`/`strokeCircle` 画圆形范围，色值大量不在 `palette.json` 锁定色内（白色/蓝灰/橙黄/暗红/紫色），且 15 件工具彼此没有共享视觉语言。
- Decision:
  1. **载体 = 世界被改写的痕迹，不是角色施放的动作**（`expand` 因效果发生在玩家自身而作为唯一例外，仍不做"施法手势"）。理由：玩家 sprite 规格锁定"无个性无姿态"，工具是残渣转化物不是玩家超能力，效果主体应落在目标位置/敌人身上而不是玩家身体。
  2. **禁用圆形填充/描边**，范围/领域效果改为网格对齐的矩形块集群（`echo` 的扩散环例外，用分段折线近似圆）。理由：`world.md` §4.2 明确污染签名是"矩形的、网格对齐的、数据错误式的"，圆形渐变是当前实现对世界观的偏离，不是刻意设计。
  3. **15 件工具按机制形状归纳为 8 个视觉族群**（定点凝滞/单体标记/领域覆写/连线贯穿/即时脉冲/分身诱饵/自身相变/资源情报），族群内共享三阶段时序模板和渲染基元，差异只来自 `narrative_origin` 决定的色相（`contam-*` 谱系内取值）与运动方向（内收/外扩/振荡/静止），不换形状语言（Degree not Kind）。
  4. **受影响敌人的主标示 = 复用已有的坏像素/感知点亮度**，直接绑定该敌人当前的感知倍率（倍率降到 0 熄灭、部分降低按比例调暗），零新增视觉基元；只有纯行为类效果（无感知分量）才追加一个共用的方括号标记作为副标示。
  5. **第 4 槽位面板判断（T5）**：440px 宽面板下单行 4 列槽位（≈95px/格）仍在可读范围内，判定**复用即可**，只需把 `grid-template-columns: repeat(3, 1fr)` 参数化为按实际槽位数生成，不需要新视觉规格或分组布局。
  6. **art-direction.md §6.2/§6.4 措辞复核（B3）**：§6.2 补齐 `_template-ui.md` 五态里缺的"临界"态；§6.4 补充与 `ui-art-overhaul.md` 的权威关系说明（后者是实操基线，§6 是其上位规范）。均为措辞细化，不改变已锁定的视觉方向。
- Alternatives: 圆形范围改用"柔和光晕渐变"以贴近其他动作游戏的技能特效审美（拒绝：违反 §1.1 视觉统一性原则，会让工具效果读作"另一款游戏的截图"，且渐变填充与像素风的硬边纪律冲突）；受影响敌人标示用独立图标/buff 气泡（拒绝：违反 U2"无通用图标"约束，且会遮挡敌人轮廓破坏"威胁识别"这一既有 gameplay 信号系统，参见 §5.2 覆盖体的面积光池预警逻辑）。
- Reason: 15 件工具是本 Slice 里工程量最大的表现层缺口，且此前从未有统一规格约束——不趁这次一次性建立底层语法，后续每加一件工具都会再长出一套自己的特效风格。
- Impact: 规格文档 `docs/art/tool-vfx-spec.md`（新建）。`art-direction.md` §6.2/§6.4 措辞更新，`changed-this-slice` 置 `true`。code agent 实现时需要替换当前 8 个占位工具里全部不合规色值，并把连续 alpha tween 渐隐改为离散跳变消散（规格 A3-5）。第 4 槽位的键位标签分配（`SLOT_LABELS` 扩到 4 项）留给 code agent 决定，art 只约束"必须与实际绑定一致"。

## DEC-037: Slice 5 T3 defense-engine wiring — direct system-to-system calls for the cross-slot/tool-grant outputs, unified per-contaminant runtime-state schema for D3

- Date: 2026-08-12
- Phase: Slice 5（T3 防御侧未接线机制全量补齐 + D3 存档 + B4 死常量清理）
- Type: Technical choice (implements DEC-029/030/031/032/033 literally; two new small deviations flagged below)
- Context: Implemented all 6 previously-`handled externally`/`future iteration` mechanics in `applyGenericDefense()`: `abyss` dynamic reduction (DEC-029), `combust` accumulate+burst heal (DEC-030), `overwrite` module swap (DEC-031), `resonate`/`erode` cross-slot charge bonuses (DEC-033), `echo` tool-use grants, `mirror` post-damage kindling return. Also closed two CSV-documented but previously entirely-unstubbed side effects while at it (not in the Brief's enumerated 6, flagged for awareness, not scope creep beyond what "18 种污染物防御行为均与 CSV 描述一致" requires): `abyss`'s 5% chance to hit a full-HP module for 10% of its max HP (unmitigated, applied after normal reduction), and `erode`'s 20% chance next-sortie initial chaos +8 (identical pattern to `kindle`/`echo`'s existing chaos-bonus side effects).
- Decision:
  1. **`resonate`/`erode`'s bonusCharges and `echo`'s toolUseGrants are consumed by `impact-system.ts` calling `contaminantSystem.applyBonusCharges()`/`grantRandomToolUse()` directly**, not routed through the scene layer (`purification-scene.ts`) even though that scene is the established "translator" between systems (DEC-036's rationale). Reason: `impact-system.ts` already directly imports `defense-engine.ts` (Slice 4 precedent), and `purification-scene.ts` is out of this task's owned-file set — adding a second system import to an already-not-pure module was lower risk than editing a file outside the assigned boundary.
  2. **`overwrite`'s module swap is applied immediately to `GameState` at impact-resolution time** (inside `impactSystem.run()`), not deferred to the rift-scene's `consumePendingSideEffects()` toast-application step. Reason: `purification-scene.ts` reads `gameState.getSortieModifiers()` to build the rift scene's transition data *before* the rift scene itself starts and consumes pending side effects — deferring the swap to that step would make it always one sortie too late. A `PendingSideEffect{type:'module_swap'}` is still pushed and still flows through the existing toast channel (DEC-031's hard requirement), it just no longer *applies* anything when consumed there (documented no-op in `rift-scene.ts`).
  3. **Unified `ContaminantRuntimeState` schema (D3)** lives as an interface in `defense-engine.ts` (`solidifyCounter` / `combustAccumulator` / `echoBonusGranted`), even though `echoBonusGranted` is tracked and written by `contaminant-system.ts` (it caps bonus grants per *tool*, not per defense-slotted contaminant — a different id-space than solidify/combust, but no collision is possible since a contaminant is never simultaneously in `defense` and `tool` stage). `SaveManager` merges both modules' snapshots into one flat save section via a local `mergeRuntimeState()` helper; each module's own loader only reads the fields it recognizes.
  4. **`resetDefenseEngine()` was never called anywhere in the codebase before this task** (verified by grep) — a latent gap that would have let `solidifyCounters` leak across "New Expedition" resets even before D3 existed. Added the call to `main-menu-scene.ts`'s `startNewExpedition()`, outside this task's owned-file set but necessary for D3's "reset vs. load must not fight" requirement to hold.
- Alternatives considered for (1): routing through `purification-scene.ts` as the architecturally "correct" translator (rejected: file not owned by this task, and the existing precedent already tolerates `impact-system.ts` → `defense-engine.ts` direct calls); for (2): deferring the swap to the toast-consumption step and accepting it lags one sortie (rejected: contradicts DEC-031's "1 次出击" duration — it would actually apply to sortie N+1 while the toast announces it at the start of sortie N+1, meaning the *displayed* sortie and the *affected* sortie would be off by one in the other direction depending on read order); for (3): a second, separate save key for `echoBonusGranted` (rejected: reintroduces exactly the "every new persistent mechanic re-litigates the channel" cost D3 was meant to close).
- Reason: Minimize edits outside the assigned owned-file boundary while keeping every new mechanic's actual effect correct at the moment code reads it (`getModuleEffect()` at scene-transition time; `getSortieModifiers()` before rift-scene creation).
- Impact: `DefenseResult` gained `healOut` / `bonusCharges` / `toolUseGrants` / `moduleSwapTriggered`; `DefenseContext`'s `moduleHps`/`moduleMaxHps` are now read (previously ignored `_context`). `GameState` gained `healModule()`, `isModuleSwapActive()`/`setModuleSwapActive()`, and `getModuleEffect()` now swaps its HP *source* module (not its output value) when active — chosen deliberately because swapping the two output values outright would make the effect strictly bad for the player every time (kindlingValueModifier's range is always ≥1.0, chaosRateModifier's is always ≤1.0, so plugging one into the other's consumer could never be a net win), contradicting DEC-031's own "sometimes favours the player" premise. `SaveDataV1` gained an optional `contaminantRuntimeState` field (old saves load with empty state, matching `resetDefenseEngine()`'s empty state — never "loaded then cleared"). `data/contaminants.csv`: `erode`'s row text changed per DEC-033; `combust`'s row text changed from "约等于2次满额冲击" to the literal "60" per DEC-030's own Impact note ("CSV 描述文案需同步为确切数值"), which the Slice 5 Brief's bullet list didn't call out explicitly but the decision it's implementing does. **Known discrepancy flagged, not fixed**: `abyss`'s CSV text ("最高65%当3模块均低于半血") assumes 3 HP-bearing purification modules; the game only has 2 (CORE/STORAGE), so the 65% cap is unreachable in practice (2 modules low-HP maxes out at 50%). Implemented the formula literally (`min(0.65, 0.20 + count*0.15)`) so it self-corrects if a 3rd module is ever added, but this is a real CSV/design inconsistency, not a code bug — flagged for design, not resolved unilaterally. **Also out of scope, flagged not implemented**: `resonate`'s CSV main effect ("装备期间CORE和STORAGE模块效果上限各提升10%") has no code path at all (not even a stub) — it is a passive while-equipped modifier to `MAX_CORE_REDUCTION`/`MAX_STORAGE_BONUS`, architecturally the same category of "while-equipped passive" that Slice 4 already deferred for `muffle`'s forecast-advance (still un-implemented today). Not in this task's enumerated 6 items and not covered by any D1-D6 ruling; needs its own design decision on whether it's Slice 5 scope or backlog.

## DEC-036: Slice 5 (T1/T2) tool-facing AI/combat/chaos overrides added as small setter APIs, not the Slice 4 debuff-descriptor pattern

- Date: 2026-08-12
- Phase: Slice 5（T1 七种主动工具 + T2 `siphon` 被动）
- Type: Technical choice (interface addition; discovered + flagged a pre-existing gap)
- Context: `tool-system.ts` 的文档注释声称 8 个既有工具通过 `ToolDebuffs` 描述符把效果交给"scene 层在 AI update 后应用"。核实发现**这条消费链从未接线**——`getDebuffs()` 全项目无任何调用方，`notifyEnemySuspicious`/`notifyProximityAvoid` 也无调用方。也就是说 solidify/erode/delay/kindle/stitch/retrograde/scatter/muffle 这 8 个工具对敌人行为目前只有表现层效果，没有实际游戏效果。这不在 T1/T2 范围内，未修复，仅记录并汇报。
- Decision: 新增 7 主动 + `siphon` 不复用这条已失效的管线，改为 `AISystem` 新增一组小方法（`setEnemySpeedMultiplier` / `setEnemyMovementLocked` / `setEnemyPerceptionMultiplier` / `reverseEnemyPatrol` / `forceEnemyReturn` / `setDecoyPosition` / `knockbackEnemy`），`tool-system.ts` 通过 `rift-scene.ts` 注入的可选回调直接调用，和现有 `setPlayerCollision`/`addKindling` 同一形状。`combat-system.ts` 新增 `applyToolDamage()`（combust 的持续伤害出口）、`chaos-system.ts` 新增 `setTemporaryRateReduction()`（siphon 的减速出口——已有的 `setTemporaryRateMult` 是 `Math.max` 语义,只能加速不能减速,语义不够）。`mirror` 的镜像诱饵通过 `AIContext.decoyPos` + `state-machine.ts` 里新增的 `sightTargetPos()` 帮助函数,把"视觉命中"重定向到诱饵位置,不触碰听觉/受伤路径。
- Alternatives: (a) 修复并复用 `ToolDebuffs` 管线（拒绝：范围膨胀到 T1/T2 之外，且旧 8 个工具的效果设计本身可能需要重新核对，属于另一次任务）；(b) 让 `tool-system.ts` 直接 import `AISystem`/`CombatSystem`/`ChaosSystem`（拒绝：违反 `architecture.md` DEC-ARCH-002 的单向数据流,scene 才是翻译层）。
- Reason: 新工具的 Done 标准是"效果真的发生"，而不是"产生一个没人读的描述符"。小方法比修复整条旧管线风险更低、改动面更小。
- Impact: `EnemyAIState` 新增 4 个字段（`externalSpeedMult`/`movementDirLocked`/`lockedDir`/`perceptionRangeMult`，默认值等于"无效果"，对旧 8 个工具和地图其余行为零影响）；`AIContext` 新增 `decoyPos`；`behaviors.ts` 的 `applyVelocity()` 与 `ai-system.ts` 的 `perceive()` 各加一处读取。`rift-scene.ts` 的 `toolSystem.create()` 选项对象新增约 10 个可选回调（纯新增，未改动既有字段）。**待办**：8 个既有工具的敌人向效果未接线一事需要升报给 Director——是否需要一次单独的清账任务。

## DEC-035: Module low-HP red flicker ring removed, replaced by B3 三态视觉

- Date: 2026-08-12
- Phase: Slice 5（T6）
- Type: Technical choice（纯内部实现，非玩法/数值变更）
- Context: `purification-module.ts` 原有一个未在任何 spec 中登记的临时视觉——hp<25% 时框架描边红色闪烁（`DANGER_COLOR`，基于 `scene.time.now` 每帧重绘）。T6 要求实现 `ui-art-overhaul.md` B3 的受损三态（健康/受损/严重受损：裂缝线 + 指示灯 + 严重受损边缘 teal 渗入）。两者在低 HP 区间会同时触发，视觉上互相打架，且旧红环从未写入任何 spec，不是需要保留的约定。
- Decision: 移除旧的红环闪烁，改为完全按 B3 实现三态（阈值 >60% 健康 / 30%-60% 受损 / <30% 严重受损，spec 未定分界故取 Task Brief 给的默认值）。三态改变时才重绘模块主体（cracks），指示灯用独立 Graphics + 500ms `Phaser.Time.TimerEvent` 闪烁，不逐帧重绘整个模块。
- Alternatives: (a) 保留红环与新三态叠加显示（拒绝：两套"低血警告"语言同时出现，且旧红环本身不在任何 spec 中，保留它没有依据）；(b) 只在 hp<25% 时额外叠加红环作为"critical 的强化"（拒绝：B3 已经明确定义了 critical 态的完整视觉，不需要再叠一层未经设计的红色）。
- Reason: B3 是当前唯一权威的模块三态规格；旧红环是无 spec 支撑的历史遗留，两者共存会违反"industrial device 而非后台管理系统"的美术基调（多重告警色叠加是典型 admin-panel 味）。
- Impact: HP 数值条本身在 ratio<0.25 时仍变红填充（`DANGER_COLOR` 保留用于 HP 条，未删除该常量），只移除了模块主体轮廓的红环闪烁。三态阈值（0.6 / 0.3）定义为 `purification-module.ts` 内的局部常量，未写入 `constants.ts`；登记进 `system-purification-impact.md` 由 director/design 在 B1 回填时一并处理。

## DEC-034: Impact forecast becomes non-spatial (target + severity, no direction)
- Date: 2026-08-12
- Phase: Slice 5（设计议题 D6）
- Type: System redesign
- Context: 三件事同时指向预告系统：`mirror` 的副作用要"预告方向镜像反转（误导）"、`growth_forecast_clarity` 改造要"提升预告准确率"、以及 backlog 已记的缺陷——`getForecastAngle()` 把 CORE→左、STORAGE→右，**而 CORE 就在场地正中心**，"左"是任选的；它只认识两个模块（场景实有五个交互点），且与 BoundaryShape 的压力主方向叠成两个互不相关的方向暗示。
- Decision: 预告不再给方向。改为只播报**目标模块**与**强度档位**。空间方向的表达权完全交给 BoundaryShape 的压力可视化（那是唯一有真实空间语义的方向源）。相应地：`mirror` 的误导 = 谎报目标模块；`growth_forecast_clarity` = 降低谎报概率 / 提升强度档位精度。
- Alternatives: (a) 先把方向重做成真有空间意义的（压力主方向或实际受击模块位置），再实现误导与准确率（拒绝：本 Slice 多一块设计工作，且与压力可视化功能重叠）；(b) 按现状接线（拒绝：等于明知故犯地交付两个无意义的功能——反转一个任意方向玩家察觉不到，"准确率"提升的是什么的准确率也说不清）。
- Reason: 一次解掉三个问题且工作量最小。方向暗示已经由压力可视化承担，预告面板重复表达同一维度只会制造矛盾信号。
- Impact: `getForecastAngle()` 移除；预告面板/HUD 改为"目标 + 强度"；`system-purification-impact.md` 的预告规则需重写。backlog 中"冲击预告方向映射无空间意义"一项由此闭合。

## DEC-033: Defense slot cross-slot effects apply to all other slots (not a hardcoded 2)
- Date: 2026-08-12
- Phase: Slice 5（设计议题 D5）
- Type: Rule clarification + CSV 文案同步
- Context: `erode` 的 CSV 描述写死"其他 **2** 个防御 slot"。Slice 5 的 `growth_defense_slot` 改造会解锁第 4 个防御槽，届时"2 个"指谁没有定义。
- Decision: 改为"其他所有槽位"，并同步修改 `data/contaminants.csv` 的 `description_defense` 文案。`resonate` 的"全 slot 同步"本就无歧义，不变。
- Alternatives: 保留固定 2 个并定义选取规则（拒绝：每次扩槽都要回来改一遍，且"选哪 2 个"没有设计理由）。
- Reason: 这是描述与规则对齐，不是机制降级。写死数量会让槽位数变成散落在数据里的隐式耦合。
- Impact: 四槽下 `erode` 变强（影响 3 个而非 2 个）。若试玩发现过强，走数值调参（降低加成值），不回退本决策。

## DEC-032: Contaminant runtime state enters the save file
- Date: 2026-08-12
- Phase: Slice 5（设计议题 D3）
- Type: Architecture
- Context: `defense-engine.ts` 的 `solidifyCounters` 是跨冲击累积的运行时状态，但不进存档，重载即清零。Slice 5 会再加两个同类状态：`combust` 的焚尽累加器、`echo` 的"单件最多 +2"上限计数。
- Decision: 把污染物运行时状态纳入 `SaveManager`。
- Alternatives: (a) 接受重载清零并改设计避免长周期累积（拒绝：等于为了回避存档改动而砍掉 `combust` 的核心玩法——"我快攒满了"的预期感）；(b) 只给 `combust` 单独存档（拒绝：留下不一致，下一件带状态的污染物又要重新决定一次）。
- Reason: `solidify` 丢计数只影响一次减伤档位、玩家无感；但 `combust` 攒到九成时退出游戏、回来归零，玩家会当成 bug。`echo` 的上限计数丢失方向相反——会让玩家超出设计上限反复获益。一次性纳入存档同时解决三个，并顺带修掉 `solidify` 的既有缺陷。
- Impact: 存档结构扩展 + 版本兼容处理。此后新增带持久状态的污染物按同一通道走，不再逐个决策。

## DEC-031: `overwrite` module swap implemented as designed; side effects may occasionally favour the player
- Date: 2026-08-12
- Phase: Slice 5（设计议题 D4）
- Type: Design principle + implementation
- Context: `overwrite` 的副作用是"25% 概率模块功能互换 1 次出击"。Slice 4 的源码注释判定 `too complex for Slice 4, skip`。核实后该判断不成立——`GameState.getModuleEffect(type)` 是模块效果的唯一入口，全项目仅三处消费方，而"模块功能"实际就是两个标量（CORE → `chaosRateModifier`，STORAGE → `kindlingValueModifier`）。互换是单点改造。真正的问题是设计层面：互换两个标量的后果取决于当时哪个模块更强，**有相当概率反而帮到玩家**，而它名义上是惩罚。
- Decision: 忠于原设计实现互换，并在出击开始的 toast 中明确提示"模块功能已互换"（该提示通道 Slice 4 已建，用于防御副作用来源播报）。**确立原则：副作用不要求永远负面。**
- Alternatives: (a) 只在对玩家不利时触发（拒绝：语义清晰但失去混沌感，且与该污染物的世界观相悖）；(b) 换一个语义单一的惩罚（拒绝：承认互换不成立，但它其实成立）。
- Reason: `overwrite` 的世界观是"模式覆盖时空——极快速度重写现实规则"，不可预测本身就是它的性格；且它属 rare 层，玩家已在承担高风险高回报。
- Impact: 这条确立的是跨全表原则——后续污染物的副作用允许有随机有利面，不必逐个论证。可读性由 toast 承担，缺了提示这个机制就不成立。

## DEC-030: `combust` burn threshold is a fixed constant, not derived from impact damage
- Date: 2026-08-12
- Phase: Slice 5（设计议题 D2）
- Type: Tuning rule
- Context: CSV 写"焚尽值达到阈值（约等于 2 次满额冲击）时自动释放"。这不是能写进代码的数，而冲击伤害会随潮汐强度浮动。
- Decision: 定为固定常量（`constants.ts` 中的独立字段，取值约等于两次基准冲击伤害），不按"N 次冲击"推导。
- Alternatives: 按 `BASE_IMPACT_DAMAGE × 2` 动态推导（拒绝：潮汐会让触发时机漂移）。
- Reason: 这个机制的乐趣在于"我快攒满了"的预期感。触发点随潮汐浮动会让玩家无法建立预期，机制就只剩随机性。
- Impact: 潮汐高峰期（伤害高）会更快攒满，这是符合直觉的；但阈值本身恒定可预期。CSV 描述文案需同步为确切数值。

## DEC-029: `abyss` low-HP bonus is evaluated on pre-damage module HP
- Date: 2026-08-12
- Phase: Slice 5（设计议题 D1）
- Type: Rule clarification
- Context: `abyss` 的减伤按"有几个模块 HP 低于 50%"动态叠加（20% 基础 + 每个 15%，上限 65%）。判定时点未定义。
- Decision: 用**本次伤害结算前**的模块 HP。
- Alternatives: 结算后（拒绝：自我指涉——减伤影响伤害、伤害又反过来影响减伤，需要定义迭代或近似）。
- Reason: 避开自我指涉，且更贴合"你已经处于危急才获得守护"的叙事。代价是那记把模块打到半血以下的一击本身不吃加成，这是可接受的。
- Impact: 实现上无需新管道——`DefenseContext` 已携带 `moduleHps` / `moduleMaxHps`，此前被 `applySlotEffect()` 的 `_context` 参数忽略。

## DEC-028: Purification boundary becomes a dynamic force-field blob (not tile-based)
- Date: 2026-08-12
- Phase: Slice 4.5
- Type: Technical + presentation direction
- Context: 净化点边界原本是 tilemap 上的固定椭圆——碰撞按 tile 判定、可见性按 tile DDA 遍历、边界只是"墙"。但世界观里净化点的边界是一层被外界污染持续挤压的力场，静态 tile 边界无法承载这个叙事，也无法表达潮汐压力的涨退。
- Decision: 引入 `BoundaryShape`（极坐标压力 blob，半径随潮汐状态缩放）作为边界的唯一真相源。碰撞改为 8px 分段的平滑 collider，可见性改为 ray-blob 求交（替代 tile DDA），程序化地表按 blob 距离做 5 段渐变，氛围粒子沿 blob 轮廓生成。新增 `BoundaryBreath` 表达局部压力冲击造成的膜变形。tilemap 保留但不可见，仅作为兜底碰撞数据。
- Alternatives: (a) 保留 tile 边界，只加视觉遮罩（拒绝：形状与碰撞不一致，玩家会撞到看不见的角）；(b) Phaser Matter 物理软体（拒绝：为一个边界引入第二套物理引擎，架构代价过高）。
- Reason: 让"边界形状"成为一个可被潮汐系统驱动的运行时状态，压力变化就能同时体现在视觉、碰撞和视野三处，而不需要三套各自为政的表现。
- Impact: 新增 `src/systems/boundary-shape.ts`、`src/systems/boundary-breath.ts`；`visibility-system.ts`、`boundary-atmosphere.ts`、`purification-scene.ts`、`procedural-purification-surface.ts` 均改为消费 blob。**遗留**：这两个系统尚无 spec，`system-purification-impact.md` 仍把边界描述为"安全区外黑暗 + 粒子"；`architecture.md` 未登记。需 design agent 补写。

## DEC-027: BARRIER module renamed to CORE
- Date: 2026-08-12
- Phase: Slice 4.5
- Type: Terminology change (structural — triggers change propagation)
- Context: 两个净化点模块自 Slice 2 起叫 BARRIER 与 STORAGE。但 BARRIER 实际承担的是"中央力场锚点"职责（提供混乱值减免、位于场景中心、是边界力场的来源），而"barrier/屏障"这个词同时被 stitch 工具的"感知屏障"占用，两处含义冲突。
- Decision: BARRIER → CORE。布局同步调整为 CORE 居中、其余模块径向分布。
- Reason: 命名冲突越晚改传播面越大；且 CORE 更准确地表达"边界力场由它产生"这一因果，与 DEC-028 的动态力场边界互为支撑。
- Impact: 跨 15 个源文件 / 13 个文档 / 1 个 CSV 传播完毕（含 `MAX_BARRIER_REDUCTION` → `MAX_CORE_REDUCTION`、i18n key、spec 与 task 正文）。历史 task 文件（slice-3/slice-4）中的旧名保留不改（属历史记录）。残留的 `barrier` 命中均为 stitch 工具的"感知屏障"，与模块无关。

## DEC-026: Slice 3 growth economy — single currency + tidal pressure + 3-axis growth
- Date: 2026-08-08
- Phase: Slice 3 (design proposal)
- Type: Design direction (major system — growth + long-term economy)
- Context: Slice 1+2 validated sortie tension and allocation dilemma, but the current economy is a provable death spiral (fixed income ~12/cycle vs rising expense that hits 19+ by cycle 10). Game needs growth to break the spiral without reaching "safe state."
- Decision (pending user approval): Three interlocking changes proposed —
  1. **Single currency (kindling) funds growth**: Three-way allocation (module repair / module enhancement / self-growth). Maximizes "顾此失彼" per vision.md's explicit "唯一通用货币，三个出口" design.
  2. **Tidal impact model replaces linear ramp**: Intensity cycles through Rise→Crest→Ebb phases across 4-5 Tides. Ebb periods are "hope windows" where reduced repair pressure allows growth investment. Crests remain the survival challenge. Prevents both monotonic despair and stable safety.
  3. **3-axis character growth with hard caps**: Sortie Efficiency (chaos resistance, speed), Resource Efficiency (kindling bonus), Survivability (HP, iframes). Each axis 3-5 levels with escalating cost. Hard ceiling ensures max-growth player still can't cruise through Final Tide crests.
- Alternatives considered:
  - Second currency (rejected: dilutes 顾此失彼 tension, vision.md explicitly wants one currency)
  - Auto-accumulating growth (rejected: removes investment decision, which is the new decision layer)
  - Monotonic pressure + pure growth offset (rejected: no rhythm = no hope signal, player can't see relief coming)
- Key risk: If single-currency growth makes early game too punishing (can't afford both repair AND first upgrade), mitigation is lowering 1st-level cost or extending Tide 1's ebb phase.
- Impact: Requires new GrowthSystem + TideSystem + ProgressTracker; modifies GameState (persistence needed), ImpactSystem (tide state machine), ChaosSystem/LootSystem/Player (growth modifiers). Full proposal: `docs/design-notes/slice3-growth-economy-proposal.md`.
- Status: **PROPOSAL — awaiting user review and selection of 4 trade-off options (A.1-A.4).**

## DEC-025: Slice 1 playtest — minimap + navigation + kindling density
- Date: 2026-08-07
- Phase: Slice 1 (playtest validation iteration)
- Type: UX / balance (player-reported)
- Context: First human playtest confirmed atmosphere/combat/speed feel right. Three navigation and pacing issues identified and addressed in-session:
  1. Movement speeds halved (160→80 all, DEC-024 scope)
  2. Chaos BASE_RATE 0.8→0.5 (calibrated for doubled travel times)
  3. Extraction glow radius 12→48 px, alpha 0.15→0.25
  4. Added trail system (afterimage on walked tiles, chaos-coupled decay)
  5. Added 8 landmark decals at key intersections
  6. Added void noise proximity gradient toward extraction
  7. Added fog-of-war minimap (right-bottom corner, reveals explored tiles)
  8. Added pause overlay on window blur (click/key to resume)
- **Known issues requiring future tuning:**
  - **Minimap reveal radius too generous** — currently uses full `RADIUS_FORWARD / tileSize` (~7 tiles), resulting in near-complete map reveal after one traversal. Needs to be reduced to ~2-3 tiles (ambient vision radius) or use a different reveal mechanism (e.g., only reveal tiles the player actually steps on). Parameter: `MINIMAP_SCALE`, reveal radius in `minimap.ts update()`. The entire minimap implementation may be reworked in presentation and parameters.
  - **Kindling density feels low** — 8 nodes across 64x44 map. Distribution is fully configurable: node positions in `rift-map-data.ts` ASCII markers, tiers in `KINDLING_TIERS`, values in `LOOT.VALUE_*` constants. Consider 12-16 nodes or higher per-node value to make "one more" temptation more frequent.
- Decision: Ship current state for continued iteration. Both items are tuning, not structural.
- Impact: No spec changes needed. `minimap.ts` and `rift-map-data.ts` are the two files to touch.

## DEC-024: Slice 1 playtest calibration — chaos rate and extraction navigation
- Date: 2026-08-07
- Phase: Slice 1 (playtest validation)
- Type: Balance + UX
- Context: PLAYER.SPEED halved (160→80) after chaos spec's time budget was calculated, doubling all transit times. Extraction glow (12px) functionally invisible.
- Decision: BASE_RATE 0.8→0.5; GLOW_LEAK_RADIUS 12→48; GLOW_LEAK_ALPHA 0.15→0.25.
- Impact: constants.ts only.

## DEC-023: Combat owns player combat state; the Player entity keeps only movement
- Date: 2026-08-01
- Phase: Slice 1 (T8 implementation)
- Type: Technical choice (ownership boundary; three related implementation decisions)
- Decision:
  1. **Health, invulnerability and the swing state machine live in `CombatSystem`, not as new fields on `Player`.** `system-combat.md`'s impact table suggested adding them to `src/entities/player.ts`; the same spec's enemy row explicitly leaves the equivalent choice to the code agent ("do not keep two copies of HP"), and the same reasoning applies to the player. `CombatSystem` implements the spec's `PlayerCombatAPI` (`getHealth` / `getMaxHealth` / `isDead` / `isInvulnerable` / `getAttackState`), so the published contract is unchanged — only its host differs. `player.ts` is untouched by T8.
  2. **`CombatSystem.create()` takes the player explicitly**, as a four-method view (`PlayerCombatTarget`: position, facing, set/clear speed modifier). The spec's signature omitted it while its own interface table requires reading the player every frame.
  3. **A killing blow still emits `ENEMY_DAMAGED`, and "a dead enemy does not `reportDamage`" is satisfied structurally.** The spec's A9 order (damage → flash → event → death) is kept literally: the event's synchronous listener does call `ai.reportDamage`, but `ENEMY_KILLED` follows in the same call stack, the scene despawns the enemy, and the AI only consumes pending stimuli during its own update — which already ran this frame, because `combat.update()` runs after `ai.update()`.
- Alternatives: (1) health fields on `Player` with a public `setHealth`/`applyDamage`; (2) reach the player through a module singleton or `scene.registry`; (3) suppress `ENEMY_DAMAGED` on the lethal hit, or emit `ENEMY_KILLED` before it.
- Reason: (1) would put the value in one class and every write in another, which means a public mutator that anything can call and two places to look when health is wrong; the spec's own "no two copies" rule is the general form of this. (2) hides a hard dependency and makes the narrowing pointless — the four-method view is what makes "combat cannot move the player" true by construction, the same technique as the `AISystemReadView` the spec asks for. (3) is where it gets subtle: dropping the event would rob the chaos system of the third hit's `COMBAT_BONUS` (the kill would be *cheaper* than the two hits before it), while reordering the emits would publish a kill before its damage. Both were avoidable, because the AI's pending-damage flag on a doomed enemy is provably never read.
- Impact: `player.ts` unchanged, so T1's ownership boundary is intact and the only write into it stays `setSpeedModifier('attack', …)`. The `combat.update()`-after-`ai.update()` ordering the spec already mandates for a different reason (fresh `isEngaged()`) is now also what keeps the killing blow from provoking a chase — noted in the code, and worth QA re-checking if that ordering is ever revisited. Decision 3 also means the run's chaos bill for a kill is exactly three `COMBAT_BONUS` charges plus the noise, which is what T10's chaos-per-hit measurement should expect.

## DEC-022: T7 implementation-time escalations resolved (five Director rulings)
- Date: 2026-08-01
- Phase: Slice 1 (T7 review)
- Type: Coordination rulings (Director adjudication of code-agent escalations; no interface changes)
- Decision: The five open questions the T7 code agent handed back are ruled as follows.
  1. **A\* node ceiling raised 1200 → 3000.** The real architecture constraint is the 5 ms/search time budget, not the node count; the worst measured cross-map search was 1050 nodes at 0.31 ms, so 3000 stays far under budget. 1200 risked a RETURN path across half the map hitting the ceiling and failing spuriously. Applied to `constants.ts` (`AI.ASTAR_MAX_NODES`) + spec param table / N6.
  2. **ALERT re-acquire (transition rule 3) requires sight AND non-blind-zone**, same clause as rule 2 — not "sight" alone. The literal wording would let a player who has circled behind an ALERT enemy be re-locked on residual detection (≥0.5) without ever being looked at, which is exactly the "spotted for a reason I can't trace" the spec's own player-interaction principle forbids. This ratifies the reading that satisfies the spec's stated invariant; it is not a new design choice. Spec rule 3 tightened.
  3. **N6 pathfinding-failure handling extended to ALERT and SUSPICIOUS** (spec only defined CHASE and RETURN). ALERT skips to its next search point; SUSPICIOUS drops the investigate point and scans in place. Pure technical safety nets, no player-visible behaviour change, both avoid a "stuck against a wall" state. Spec N6 filled in.
  4. **`peakAlertLevelThisEpisode` struct field dropped as unused.** The E1 event de-duplication it was meant to serve is fully covered by `lastEmittedLevel` + the 1000 ms emit cooldown; keeping the field would be write-only dead state. Spec struct annotated optional.
  5. **N8 "far enemies never request A\*" scoped to patrol, not RETURN.** A far-away RETURNing enemy genuinely needs a path or it sticks to a wall forever; it gets the lowest queue priority so it can never delay a chase. The spec's parenthetical assumed distant enemies are always patrolling (which walk precomputed legs). Spec N8 clarified.
- Reason: Four of the five are the implementation choosing the reading that matches the spec's own stated intent over its literal text; ruling 1 is a pure performance-budget call. None change any event or API signature, so `interface-changed` stays false and no consumer (T3/T4) is affected.
- Impact: `system-enemy-ai.md` updated in place (rules 3, N6, N8, param table, struct note; `last-modified` bumped) + `constants.ts` `AI.ASTAR_MAX_NODES` = 3000. The originally-dispatched T7 escalations ①(hearing via `isMoving`) / ⑥(`SIGHT_ANGLE` split) / ⑦(enemy immune to chaos) were confirmed at dispatch and are landed. Remaining T7 open items are human-only and are NOT code blockers for the already-in-flight T8: playtest confirmation of state readability (R1–R3) and the five-state downgrade-chain timing, plus `DETECT_FILL_TIME` reprieve-window calibration.

## DEC-021: Navigation asks "does the body fit", sight asks "can it be seen" — one ray primitive, two questions
- Date: 2026-07-31
- Phase: Slice 1 (T7 implementation)
- Type: Technical choice (module boundary; extends DEC-015)
- Decision: Path smoothing (rule N7) and the straight-line shortcut (rule N4) test passability with `hasClearPath(grid, from, to, width)` in `src/utils/grid-raycast.ts`, not with `hasLineOfSight()`. It is implemented as the *same* ray test run down both flanks of the segment (offset by ±width/2), so there is still exactly one piece of code deciding what a tile blocks. Perception keeps using `hasLineOfSight()` untouched. `AISystem` passes `AI.BODY_SIZE` (20) as the clearance.
- Alternatives: (a) the spec's own N4 fallback — restrict the straight-line shortcut to ≤3 tiles; (b) inflate the walk grid by the body radius and path on that; (c) clearance-aware A* successor tests; (d) rely on the stuck watchdog alone.
- Reason: A sight line and a walkable line are different questions, and Slice 1's map is full of the geometry where they diverge: a ray threads the corner between two diagonally offset wall stubs that a 20px collider wedges against. Measured in-engine — enemies stalled mid-patrol against the col-19 baffle, because the smoothed leg contained a segment only a point could take. (a) does not help, because smoothing produces these segments at *any* distance and a 3-tile shortcut can still clip a corner; (b)/(c) change what A* considers reachable and would silently make 1-tile gaps impassable, breaking the map's baffle design (`BODY_SIZE` 20 < `TILE_SIZE` 32 is load-bearing); (d) papers over the symptom every 400ms forever. Rule N2 (no corner cutting) already makes the raw tile path body-safe, so all of the risk lives in the two places that shortcut it — which is exactly where the width-aware test goes.
- Impact: Retires the spec's open question "N4 might wedge a 20px body in a narrow diagonal gap" — measured, reproduced, fixed at the cause; the N4 optimisation stays available at full range. `GridPathfinder` takes clearance as a constructor argument and defaults to 0, so the module stays game-agnostic. `hasClearPath` carries an explicit "not a sight test, never use for perception" warning: using it for sight would break the symmetry DEC-015 exists to protect. The pathfinder also deviates from the spec's declared `findPath(grid, from, to, maxNodes)` free function for the same reason DEC-015 deviates — it is a class with pre-allocated buffers writing into a caller-owned array, because searches are issued from the game loop.

## DEC-020: Balance invariants are asserted at dev boot, not left to review
- Date: 2026-07-31
- Phase: Slice 1 (T7 implementation)
- Type: Process/technical choice (guardrail)
- Decision: The relations between constants that the design depends on live in `src/config/invariants.ts` as executable checks and are asserted in `main.ts` on every dev boot, throwing with a per-violation explanation. Slice 1 covers the six enemy-AI invariants I1–I6 (player sees further than the enemy, the chase-range bonus stays inside that bound, the player outruns a chase, patrol is much slower than the player, hearing is shorter than sight, the player turns faster than the enemy) plus one supplementary cross-spec check (`AI.STANDOFF_DISTANCE` < `COMBAT.ATTACK_RANGE`).
- Alternatives: (a) leave them in the spec table for QA to check by hand; (b) log a console warning instead of throwing; (c) a unit test — the project has no test framework yet (an open Director item from T5).
- Reason: These are not tuning preferences, they are the conditions under which the slice's verification question means anything. Breaking one does not produce an obvious bug; it produces a *plausible wrong answer* — set `AI.CHASE_SPEED` above `PLAYER.SPEED` and playtesters correctly report "being spotted is a death sentence", and the conclusion drawn is about difficulty rather than about a broken constant. Tuning happens by editing numbers in `constants.ts`, so the check has to live next to the numbers and fire without anyone remembering it exists. Throwing rather than warning (b) is deliberate: a dev build that boots with a broken invariant produces playtest data that is worse than no data.
- Impact: Anyone re-tuning the AI numbers gets an immediate, explained boot failure instead of a misleading play session. Production builds are unaffected (`import.meta.env.DEV` only). The pattern is extensible — T8/T9 should add their own spec invariants (`system-combat` K1–K6, the chaos curve anchors) to the same file rather than inventing a second mechanism.

## DEC-019: VisibilitySystem gains a forward flashlight beam (illuminates the cone, not just reveals it)
- Date: 2026-07-31
- Phase: Slice 1 (A-G3 in-engine landing / Part C)
- Type: Technical choice (rendering feature; extends DEC-016)
- Decision: `VisibilitySystem` now draws a **forward flashlight beam** — a warm additive radial pool pushed forward along the facing direction and sized to the forward range — **under** the darkness mask, so the cone-shaped hole in the mask clips the round pool into a beam. The forward cone reads as *lit* (brightened), not merely *revealed*. Parameters live in `GAME_CONSTANTS.VISIBILITY.FLASHLIGHT_*` (`COLOR` pale-warm `#a8906a`, `ALPHA` 0.42, `FORWARD_FRAC` 0.34, `RADIUS_FRAC` 0.85). Disabled in `omni` (purification) mode, which already lights the whole room. The beam follows radius modulation, so a chaos-shrunk view dims its own light.
- Alternatives: (a) brighten the whole surface uniformly — kills the darkness/contrast that is the entire point; (b) a cone-clipped gradient texture rotated to facing — more code, and the mask already provides the cone clip, so a forward-offset radial pool + existing mask is equivalent and simpler; (c) leave it reveal-only.
- Reason: The vision mask (DEC-016) defines *what* is visible (visibility 1.00/0.60/0.20) but adds no light; a real flashlight both reveals and illuminates. In-engine iteration confirmed reveal-only leaves the cone too dark to read the procedural surface (`docs/art/demos/rift-synth/engine/rift-engine-c1.png`). A forward-offset additive pool clipped by the existing cone mask reproduces the A-G3 harness beam-gain (DEC-018) with minimal new code and zero change to the mask/erase pipeline (`...c2.png` too warm at alpha 0.55; `...c3.png` = shipped pale-warm at 0.42).
- Impact: The rift reads as flashlight-in-darkness in-engine. Part C also landed DEC-018: the procedural surface generator now lives in `src/systems/procedural-surface.ts` and `RiftScene` renders it at depth 0 with the tilemap layer kept for collision but set invisible. `FLASHLIGHT_*` are tunable in one place. `createPurificationVisionConfig` sets `flashlightEnabled: false`.

## DEC-018: Rift surfaces (floor + walls) rendered procedurally from world coordinates, not from discrete AI tiles
- Date: 2026-07-31
- Phase: Slice 1 (A-G3 composition test)
- Type: Direction change + Art/Technical choice (revises the "discrete AI floor tiles" assumption baked into the original A-G3 plan; aligns DEC-007 + DEC-005)
- Decision: The rift's continuous surfaces — floor and walls — are produced by **procedural texture generation keyed to world coordinates**, not by placing a set of discrete AI-generated 32px tiles. Floor = multi-octave value-noise grime + a low-frequency macro layer (dark pools / worn paths) + signed scratches & flecks (dark wear + light scuffs) + sparse wandering teal seepage cracks + flat teal "data-error" blocks, everything quantized to `docs/art/palette.json`. Walls = pixel-continuous edge shading (north top-rim highlight / south drop-shadow / side AO) computed from a pixel wall bitmap, so a wall run reads as one solid mass with height, with no 32px segmentation. AI image generation stays reserved for **discrete sprites/props** where per-instance identity matters (enemies, kindling, extraction marker), not for the ground/wall field.
- Alternatives considered: (a) the original A-G3 plan — N discrete AI-generated 32px floor variant tiles + random rotation + overlay decals; (b) one large AI-generated floor texture region-sampled per cell; (c) procedural continuous generation (chosen).
- Reason: A-G3 ran (a) across five tuning loops. Even after per-variant brightness normalization (which does kill the light/dark checkerboard), random tile rotation, and reweighting toward a featureless base, the AI variant tiles' distinctive features — especially warm-olive "crack/worn" marks that violate the cold-only environment rule — read as an obvious repeating motif. The mosaic problem merely moved from "brightness checkerboard" to "feature repetition". The on-hand generator (`GenerateImage`) also cannot author subtle dark-on-dark variation or seamless edges. (c) then succeeded on the first pass: a surface computed per world pixel is continuous by construction — zero seams, zero repetition — and its richness (grime, wear, contamination seepage) is fully controllable, deterministic, zero-cost, and palette-conformant. It fits the project's two load-bearing bets better than AI tiles do: the procedural-map bet (DEC-005) and the AI-vibe-pixel bet (DEC-007, "pixel hides inconsistency"). Validated on a harness that faithfully replicates the real vision model (DEC-016): forward cone + ambient ring + three compounding bands + warm player lamp + void grain + wall occlusion, plus a warm-center / teal-edge beam that expresses the human-warmth-vs-contamination tension through the vision system itself.
- Impact: **A-G3 PASSES** — the pure top-down pixel route (DEC-007) is validated, and the mosaic risk is retired by procedural continuity rather than by modular AI-tile variety. `TilemapRenderer`'s floor/wall fill is to be produced by a procedural generator keyed to world coordinates (Part C ports the harness logic in `docs/art/demos/rift-synth/{floor,scene,darkwood}.mjs` into `src/`, driven off the real 64×44 map from DEC-017). The art-pipeline (`tools/art-pipeline` postprocess/verify) remains the path for **discrete sprites/decals**, not for surfaces. A-G1 (32px readability) and A-G2 (top-down enemy sprite) still stand — they concern sprites, which are still AI-generated. Winning parameters and side-by-side evidence live in `docs/art/demos/rift-synth/` (loops 1-5 = the AI-tile attempt; `floor.f3` / `scene.s3` = the procedural result).

## DEC-017: Fixed rift map authored as ASCII, validated at runtime
- Date: 2026-07-29
- Phase: Slice 1 (T6 implementation)
- Type: Technical choice (content authoring format)
- Decision: The fixed rift map is authored as an ASCII grid (64×44) inside `src/scenes/rift-map-data.ts`, with all content anchors (spawn, extraction, 8 kindling nodes, 4 patrol routes) placed as single-character markers **inside the same grid** and parsed out at module load. Patrol route order is encoded by alphabetical order of the marker letters. `validateRiftMap()` re-checks the invariants (row widths, marker uniqueness, every marker walkable, everything reachable from spawn by an 8-way no-corner-cutting flood fill) and `RiftScene` runs it in dev builds.
- Alternatives: (a) a declarative list of floor/wall rectangles; (b) marker coordinates as separate literals alongside the grid; (c) an external JSON/Tiled file.
- Reason: A hand-authored stealth map lives or dies on its sight lines and route choices, which are visual properties — the ASCII grid is the only representation a human can review by looking at it. Keeping markers *in* the grid removes the entire class of "coordinate drifted out of sync with the geometry" bug that (b) invites; a rectangle list (a) is unreviewable for occlusion; an external file (c) buys nothing while the map is a single fixed level. The safety net for ASCII's weakness (a typo silently ruins a row) is the runtime validation.
- Impact: Editing the map means editing the picture. Anyone changing it must keep rows exactly 64 chars and markers unique — dev-build validation fails loudly otherwise. Measured traversal costs are recorded in the file header and **must be re-measured by T9/T10 to recalibrate `CHAOS.BASE_RATE`** (see DEC-014): the map yields ~35 s (short route) / ~46 s (long route) / ~59 s (full clear) of pure walking, all below the paper assumptions the 0.8 rate was derived from, so the remainder has to come from waiting on patrols and must be verified in real play.

## DEC-016: Vision mask via world-space RenderTexture + three compounding erases
- Date: 2026-07-29
- Phase: Slice 1 (T5 implementation)
- Type: Technical choice (rendering)
- Decision: The darkness mask is a `RenderTexture` sized to the camera view plus two tiles of padding, living in **world space at world resolution** (not screen space). Each frame it is filled with void-black and the three visibility polygons are erased out of it at 1.00 / 0.50 / 0.20, compounding to residual darkness 0 / 0.40 / 0.80 = visibility 1.00 / 0.60 / 0.20.
- Alternatives: (a) three dark layers each carrying an inverted `GeometryMask`; (b) a screen-space RenderTexture; (c) a custom shader.
- Reason: Follows the T1 spec's recommendation, and world resolution is the right call for pixel art — the mask edge lands on whole world pixels and scales up with the camera like every other pixel, instead of being sampled at screen resolution and reading sharper than the art. (a) was considered because inverted geometry masks would sidestep any ERASE-blend portability question, but inverted geometry masks are WebGL-only anyway, so it trades one backend dependency for another while adding three stencil passes. Screen space (b) fights Phaser's zoom handling for scroll-factor-0 objects.
- Impact: Two Phaser gotchas are now load-bearing knowledge: `RenderTexture.draw()` ignores its `alpha` argument for Game Object inputs (strength must be set on the object), and scroll-factor-0 game objects are still transformed by camera zoom — which is why the dev overlay is a DOM element and why T9's HUD will need either a second camera or the DOM. ERASE compositing verified on WebGL only; Canvas backend untested (Phaser.AUTO selects WebGL on all target browsers).

## DEC-015: Raycasting occlusion is one shared stateless module, not per-system logic
- Date: 2026-07-29
- Phase: Slice 1 (T5 implementation)
- Type: Technical choice (module boundary)
- Decision: Grid DDA raycasting lives in `src/utils/grid-raycast.ts` as stateless pure functions (`castRay`, `castRayDirection`, `hasLineOfSight`) that any system may import, rather than as a method on VisibilitySystem or duplicated inside the AI. Results are written into a caller-owned `RayHit` rather than returned fresh, which deviates from the spec's return-a-value signature.
- Reason: The spec (T1 "为什么不用事件总线" item 1, T2 rule P3) requires the player's vision and the enemies' sight to be answered by the same code — otherwise "I can't see it, so it can't see me" becomes a lie, and that inference is the entire basis of stealth. Importing a pure function is not a system-to-system call, so this does not violate the event-bus rule. The out-parameter is required by the no-allocation-in-the-game-loop rule (60 casts per frame).
- Impact: T7 must use `hasLineOfSight()` for enemy sight and must not write its own occlusion test. The diagonal-seam rule (blocking rays that thread the zero-width gap between two diagonally adjacent walls) is implemented once, here, with a 1px margin.

## DEC-014: CHAOS.BASE_RATE lowered from 1.5 to 0.8
- Date: 2026-07-29
- Phase: Slice 1 (pre-implementation kickoff)
- Type: Tuning decision (existing constant, substantive change)
- Decision: `CHAOS.BASE_RATE` goes from the Foundation value 1.5 to **0.8** points/s. This is now a decided value, not a suggestion — `src/config/constants.ts` still holds 1.5 and is changed by the code agent during T9. Everything downstream (run-length math, penalty curve anchors) assumes 0.8.
- Alternatives: keep 1.5 and shrink the map instead; pick 1.0 as a midpoint.
- Reason: Adopts the T3 design recommendation (`system-chaos-scavenge-extract.md`, "出击时长推算"). At 1.5 a run lasts ~1:40 and a full-clear player hits HARD_CAP by the 4th loot node, so the back half is spent permanently capped — the greed-vs-retreat gamble collapses into pure endurance. At 0.8 a run is ~3:07 and a full-clear player would arrive at extraction around chaos 175, i.e. taking everything is just barely out of reach, which is the calibration target.
- Impact: T9 writes 0.8 into constants. The number is explicitly a playtest knob — recalibrate once T6's fixed map has a final scale (target: full-clear time ≈ time-to-HARD_CAP × 1.15). Resolves T3 escalate item 3.

## DEC-013: Combat is priced as a loss-mitigation tool (dual-track cost)
- Date: 2026-07-27
- Phase: Slice 1 (T4 design)
- Type: Design choice (combat positioning)
- Decision: Combat cost is levied on two non-interchangeable axes — chaos (time, via ENEMY_DAMAGED → COMBAT_BONUS) and exposure (space/routes, via reportNoise alerting nearby enemies) — plus non-recoverable HP loss. Net: killing an enemy costs ~1.5–2× the chaos of waiting for a patrol window. Combat is deliberately kept worthwhile in exactly three situations (repeated traversal of a segment, already-caught-can't-flee, chaos overflow where detour cost is inflated). Combat is a loss-mitigation tool, not a progression tool.
- Reason: vision.md defines combat as "optional, costly, controllable; a decision option, not the main interaction." The success signal is a player saying "I could've just sneaked past." If playtesters start enjoying combat / clearing rooms, the pricing is too low, not a design win.
- Impact: T8 implements the two cost paths (events + noise); no combat-side chaos writes (T3 owns values). Playtest calibration knobs, in priority order: NOISE_HIT_RADIUS > COMBAT_BONUS > ENEMY_MAX_HEALTH; never nerf PLAYER_DAMAGE. Target: median kills/run 0–1.

## DEC-012: Enemy = three-hit kill, zero-random damage
- Date: 2026-07-27
- Phase: Slice 1 (T4 design)
- Type: Design choice (combat feel)
- Decision: Infiltrator HP = 75 = exactly 3 × PLAYER_DAMAGE(25). All combat damage is fixed — no randomness, no crits, no variance. Kill count is always an integer (invariant K1). Enemy attacks have a 350ms telegraph (windup) that resolves once at the end, so correct positioning avoids all damage ("controllable = dodgeable, not = damage-free").
- Reason: "Cost must be computable" — the player learns a fixed price on the first encounter (one fight = 3 hits = ~15 chaos + one health chunk), so every later encounter is arithmetic, not a gamble. Same discipline as T3's "only computable pressure creates real hesitation." The tradeoff is combat has zero surprise, which is intentional.
- Impact: When balancing, adjust ENEMY_MAX_HEALTH in 25-steps (keep integer kills), not PLAYER_DAMAGE. K5 (player survives ≥6 hits) keeps a single misjudgment non-lethal. constants COMBAT section is pure-additive in T8.

## DEC-011: Extraction requires pressing E (not auto-on-touch)
- Date: 2026-07-26
- Phase: Slice 1 (T3 design)
- Type: Design choice (interaction) — deviates from vision/brief wording "到达即撤离"
- Decision: Extraction triggers only when the player presses E while inside the extraction point's trigger radius. Not automatic on touch.
- Alternatives: (a) auto-on-touch (literal vision/brief wording); (b) dwell 0.8s then auto-extract.
- Reason: The extraction point is Slice 1's only glow source and thus the player's constant navigation anchor — they move toward it and pass near it all run. Auto-on-touch would end the run on an accidental brush, precisely during the "should I grab one more?" deliberation — that's an accident, not tension. Press-E separates the irreversible (extract) from the reversible (pickup, which needs no key), and reuses architecture's existing InteractionTrigger "press E" idiom (purification modules).
- Impact: ExtractionSystem.canExtract()/requestExtract(); HUD shows "按 E 撤离" prompt inside the radius. vision.md left unchanged (this is a Slice-level interaction refinement). If playtest shows the key reads as bureaucratic, fallback is dwell-0.8s-auto. Updated wording in current-slice.md scope + slice-1.md T3 brief.

## DEC-010: Chaos may overflow 100 up to a HARD_CAP of 150
- Date: 2026-07-26
- Phase: Slice 1 (T3 design; resolves T1 escalate item 5)
- Type: Design choice (core mechanic)
- Decision: Chaos `value` is allowed to exceed 100 and is clamped at a new `HARD_CAP = 150`. `MAX_VALUE = 100` keeps its number but its meaning changes to "HUD full-gauge mark + third threshold." Penalties keep escalating on the 100→150 band (radius/edge/flicker/speed via T1's modulators). `CHAOS_CHANGED.max` still transmits 100 (so 50/75 tick marks read correctly); `value > max` becomes a legal state the HUD must render as an overflow state.
- Alternatives: (a) hard cap at 100 (original constant); (b) redefine "超阈值" as "reaching 100" (no overflow band).
- Reason: A hard cap at 100 removes any additional cost the moment it's hit — the optimal play degrades to "cap out, then clear the map calmly," switching off the greed-vs-retreat gamble in the exact phase it should be tightest. vision.md states chaos is a "soft limit, not a hard cutoff, with penalties escalating past the threshold," which requires headroom above 100. art §7.2's 4th tier is a ramp, not an instant. Capping at 150 (not infinite) guarantees the player can always crawl back to extraction (world.md is "infiltration," not "execution").
- Impact: constants CHAOS overhaul in T9 (add HARD_CAP/THRESHOLD_3/CHASE_RATE_MULT/etc.; replace 2-tier discrete penalties with the 4-anchor continuous curve). HUD needs an explicit overflow state. Resolves T1 escalate item 5. Delegated to and decided by the T3 design pass.
- Playtest amendment (2026-08-13, Slice 5.5): HUD bar denominator is `HARD_CAP` (150), with an emphasized tick at 100 as the overflow gate and a distinct pulsing fill on 100–150. Concatenating the meter name with the stage word is forbidden. Overflow world layer is a persistent teal veil + grain + ~2.2 s jump, and vision/speed hit their floors by 130 so the gate itself feels like a new gear. Does not overturn overflow-to-150.

## DEC-009: Rift viewport via camera zoom (match art framing)
- Date: 2026-07-26
- Phase: Slice 1 (T1 design)
- Type: Technical + feel choice
- Decision: Keep the 960×640 canvas but apply `camera.setZoom(1.5)` in RiftScene so the logical viewport is ~640×427 ≈ 20×13 tiles, matching art-direction §3.1's intended ~20×15 framing (canvas is 3:2 so exact 20×15 is impossible; width lands at 20 tiles, height ~13.3).
- Alternatives: (a) keep 30×20 tiles (no zoom, wider/opener view); (b) change canvas to 4:3 to hit exactly 20×15.
- Reason: A tighter ~20-tile-wide viewport makes a fixed vision radius occupy a larger share of screen, supporting the Darkwood-style claustrophobia (DEC-007 route). Aligns runtime with the framing art assumed when authoring §3/§7 numbers, so vision-radius tuning transfers.
- Impact: code agent implements `camera.setZoom(1.5)` in T5. art agent reconciles §3.1 wording to the real runtime. VisibilitySystem's suggested radii were already given for a ~20-tile viewport, so they stand. Resolves escalate item C in `system-movement-vision.md`.

## DEC-008: Player facing = movement direction (keyboard), reject mouse-aim flashlight
- Date: 2026-07-26
- Phase: Slice 1 (T1 design)
- Type: Design choice (game feel)
- Decision: Player facing (which drives the vision cone) equals the last movement direction, keyboard-only. No mouse-aimed flashlight.
- Alternatives: (b) mouse-aimed vision cone (aim independent of movement); (c) keyboard + optional "hold to lock facing while strafing" (kept as a future extension point, single-entry in Player).
- Reason: Turning to look must cost "changing where you move," which keeps the darkness behind you a real threat (experience pillar 1 "tension at the edge of despair"). Mouse-aim would let players back away while scanning, dissolving the concept of "behind" and deflating the pressure; it would also require 8–16 directional sprites, exceeding art §3.3's four-direction plan.
- Impact: Player exposes a single facing-source entry point (future strafe-lock is a one-line change). Four-direction sprites only. Resolves the facing A/B in `system-movement-vision.md`.

## DEC-007: Art direction confirmed — pure top-down pixel (Darkwood route); reject Hades-style repaint
- Date: 2026-07-24
- Phase: Foundation (post Step 3) / Slice 1 planning
- Type: Direction confirmation (art + design)
- Decision: Keep the locked art direction — pure top-down, 32px pixel art (Darkwood family). Do NOT pivot to Hades-style presentation (3/4 perspective + hand-painted 2D + normal-map lighting + hand-authored rooms).
- Alternatives considered: (a) 2.5D top-down pixel (Gungeon/CrossCode wall-face trick); (b) 3/4 pixel + modular chunks + simple dynamic light ("pixel Diablo"); (c) full Hades (hand-painted 2D, 3/4 perspective, normal-map lit, bespoke rooms).
- Reason: Hades' look is not "more effort" but a different production tier that fights BOTH load-bearing bets of this project: (1) AI-generated art — pixel hides AI inconsistency, painterly exposes it (art-direction §1.3); (2) procedural map generation — Hades uses hand-authored bespoke rooms, incompatible with Voronoi+CA tilemaps (DEC-ARCH-003/005). Darkwood proves pure top-down pixel can carry extreme atmosphere within our AI-vibe budget; user is willing to treat it as a near-reskin reference.
- Impact: art-direction.md (pixel/top-down) and architecture.md (procedural tilemap) stand as-is; no Foundation repaint. The perspective question raised by the isometric reference image is now CLOSED (stay top-down). A-G3 composition test's purpose narrows: prove & tune expressiveness WITHIN the pixel/top-down route, not decide a perspective/repaint pivot.
- Transferable lesson kept (from the Hades analysis): anti-mosaic expressiveness comes from MODULAR variety (tile variety + transition/autotile tiles + overlay decals + prop density + runtime lighting + limited vision), not from uniform 32px grid tiling. Even Hades is modular reuse; the mosaic look comes from uniform-grid tiling, not from modularity itself.

## DEC-006: Purification Point as walkable space with boundary atmosphere
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice + Design alignment
- Decision: PurificationScene is a tiny walkable top-down space (~12x10 tiles) reusing RiftScene's rendering pipeline. Modules are interactable entities triggered by proximity. Boundary darkness features periodic subtle movement (particles + blurry apparitions) to convey external pollution pressure.
- Alternatives: Pure UI/menu screen (no spatial component), separate rendering system
- Reason: (1) Reusing rendering infrastructure reduces code. (2) Walkable space makes "seeing the darkness outside" a continuous visceral experience, not a static image. (3) Boundary atmosphere directly supports "lonely ritual" experience pillar. (4) User explicitly stated "seeing the outside darkness is important for atmosphere and player emotion."
- Impact: VisibilitySystem and Player movement must be extracted as reusable modules (not hardcoded into RiftScene). New BoundaryAtmosphere system (particles + timed sprite apparitions). New InteractionTrigger system (overlap + DOM panel lifecycle). PurificationScene map is hand-designed (not procedural).

## DEC-005: Map generation changed from BSP to Voronoi + CA hybrid
- Date: 2026-07-22
- Phase: Foundation
- Type: Direction change (supersedes DEC-003)
- Decision: Use Voronoi partitioning (macro) + Cellular Automata (micro) + fracture connectors instead of BSP
- Alternatives: BSP (original choice, too architectural), WFC (hard to tune), pure CA (no macro structure)
- Reason: World-building dictates rift interiors are "fragments of alien spacetime" -- they should feel organic, broken, non-architectural. BSP produces rectangular rooms + straight corridors that feel like buildings. Voronoi naturally produces irregular "shard" shapes matching the lore. CA fills fragments with organic cave-like terrain. Narrow fracture connections between fragments serve as natural decision points and stealth chokepoints.
- Impact: Map no longer has "rooms" concept; replaced by "fragments". Pathfinding still grid-based (CA output is tile data). Visual variety comes naturally from organic shapes. Need flood-fill connectivity validation pass.

## DEC-004: Self-implemented i18n (not i18next)
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: Self-implemented i18n with TypeScript locale files + typed key paths, supporting zh-CN and en
- Alternatives: i18next (full-featured library), typesafe-i18n (build step), FormatJS
- Reason: Game text volume is limited (<300 keys). Self-implementation is ~80 lines, zero dependencies, fully type-safe (missing keys caught at compile time). i18next's plugin ecosystem (namespaces, backends, plurals) is unnecessary for this scope. TypeScript files (not JSON) allow compile-time validation that both locales have identical structure.
- Impact: No plural rules, no date formatting, no RTL support. If text volume explodes or languages exceed 3, may need to migrate. Key naming convention: `[domain].[context].[item]`.

## DEC-003: ~~BSP for procedural map generation~~ (SUPERSEDED by DEC-005)
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: ~~Use BSP (Binary Space Partition) algorithm for dungeon generation~~
- Alternatives: WFC (Wave Function Collapse), Cellular Automata, Drunkard's Walk
- Reason: ~~BSP produces predictable room+corridor layouts that match the game's need for route choice and line-of-sight blocking. Simple to implement and debug. WFC produces more natural results but is significantly harder to tune and debug under time pressure.~~
- Impact: ~~Map layouts will tend toward rectangular rooms with straight corridors. Post-processing needed for visual variety.~~
- **Superseded**: BSP too architectural for "alien spacetime fragment" aesthetic. See DEC-005.

## DEC-002: Event Bus architecture (not ECS)
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: Use typed event bus for inter-system communication instead of ECS
- Alternatives: ECS (bitecs/miniplex), direct method calls, Redux-style store
- Reason: Entity count is low (<50 simultaneous). ECS batch-processing advantage irrelevant at this scale. Event bus is more intuitive for AI code generation and matches Phaser's own design patterns. Simpler mental model.
- Impact: Systems are class instances, not pure processors. If entity count grows significantly (>100), will need re-evaluation.

## DEC-001: Phaser 3 as game framework
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: Use Phaser 3.80+ as the primary game framework
- Alternatives: PixiJS (render-only), Excalibur.js (smaller community), raw Canvas
- Reason: Most mature and documented Web 2D game framework. Built-in physics, input, audio, camera, scene management reduces ~60% boilerplate. Largest community ensures best AI vibe coding quality (most training data available). TypeScript support is solid.
- Impact: Architecture constrained to Phaser Scene lifecycle. Physics limited to Arcade (AABB). UI limited in Canvas (compensated with DOM overlay for complex screens).
