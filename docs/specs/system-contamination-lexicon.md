---
status: DRAFT
created-by: design conversation（迭代 1）
created-when: 2026-08-20
last-modified-by: code（I16：生产行为事实对齐）
last-modified-date: 2026-09-07
interface-changed: true
interfaces-with:
  - system-enemy-ai                 # 一份五态仍由本接口的消费方拥有；句法只决定孔谱与填词，禁止第二份 FSM。出击甲 spawn 带 form
  - system-combat                   # HP / 近战扇形 / 死亡事件仍归战斗；接触词素改价目表与伤害通道；止损查表决定能不能扣核。不改「绕应更划算」
  - system-map-generation           # 出生钉层 + 一份 contaminationDraw（SortieDraw）；菌落与场不得加墙
  - system-movement-vision          # 占空体积低于视野蒙层；反视读玩家视野扫核；平衡不变量来源
  - system-chaos-scavenge-extract   # 踩踏 / 场内加速混乱走既有混乱通道，不另造一条隐蔽伤害
  - ui-encounter-narration          # 本体系的识别表面（载体 / 视觉 / U1–U12）；不是独立玩法。逻辑在本文
exposes:
  - 底材（基体 × 覆盖深度）、孔谱（连续性 × 占位）、词素四槽、成句配方
  - 止损衍生表（连续性 × 覆盖深度 → family / core_policy；不是第五词素槽）
  - 六件套合同（外观 / 生命期 / 移动 / 感知 / 攻击 / 死亡）——合法个体必须一次写完；攻击通道必须非空
  - 第一版四张主孔谱（甲占地 / 乙占墙 / 丙占漆 / 丁占空）
  - 抽卡配额与非法组合丢弃规则（出击甲条数跟地图巡逻，不得用 2–3 砍路点）
  - 遭遇识别旁白：身份键、触发、限频、观察句选行、成句短标记映射
  - 事件 `encounter:identified`（载荷见实现规格；旁白消费、不回写 AI）
  - CSV：substrates / portfolios / lexemes / stop-loss / utterances / display-tokens / **observe-lines（I8-N 新建）** → `src/generated/contamination-lexicon-data.ts`
  - CSV `enabled_scope`（sortie / gym）；出击白名单 = 全部 sortie 行，含残茎 / 街具残骸 / 三种生物 / 灰幕 + 概念三类。**I5-J：** `street_wreckage` 进 `SORTIE_SUBSTRATE_IDS`；`lamp_pillar` / `railing_post` 收回 gym。**I5-T：** `insect_remnant` / `mammal_remnant` / `worm_remnant` 进 `SORTIE_SUBSTRATE_IDS`（灯柱 / 栏柱仍 gym）。
  - 接触词素对照表（打血 / 混乱 / 视野）；出击与练习场同一套读取 contact + resolveStopLoss
  - 钉层：墙缘折线 / 占漆地板格（贪婪薪柴路径） / 走廊包围盒；布局另交一份 SortieDraw
  - 出击视觉（方案 D）消费字段（与 I3-C 对齐，不复制像素配方）
  - supportsRuntimeForm(form) / floorMotionFor(form)：生产能力过滤与占地运动共用解释（I16）
note: |
  迭代 1 设计锁（DEC-073）。正式名「污染句法」（DEC-078；旧称「污染词法」）。遭遇识别旁白 DEC-074 仍有效。DEC-075：叙述并入设计正文。
  DEC-076：实现规格锁（字母表、CSV、钉层、乙丙丁数字、听觉主轴）。
  DEC-083：接触槽提纯为「它怎么伤你」；打核驱散退出接触字母表；止损从连续性 × 覆盖深度查表。
  DEC-084：方案 D 接入出击。本文是接线后的目标合同；落地分批见「出击视觉」节与 docs/tasks/iteration-3.md。
  叙述家是 docs/design-notes/contamination-lexicon.md；本文是规则合同；
  docs/specs/ui-encounter-narration.md 是识别表面，不是独立玩法。
  外观 HOW：docs/art/contamination-forms.md（I3-C 生产规格；迭代 5 甲待改写；配色按 DEC-088 协同但不提亮；地面 L1/L2 迭代 6）。出击逻辑已接（体验未验证）。
  迭代 2 练习场探索 COMPLETE。迭代 3（DEC-084）合同 docs/tasks/iteration-3.md。
  迭代 5（DEC-087 / DEC-088 / DEC-098）合同 docs/tasks/iteration-5.md：甲外形基因谱；I5-J 已把出击 `d-mixed` 占地升为 `attachJiaGenomeD`，街具残骸翻列出击。I5-T：三种生物已翻出击。I5-N：基因谱甲必须消费朝向与信号相。
  迭代 6（DEC-088）合同 docs/tasks/iteration-6.md：碎片配色 / 世界美术。
  I8-R（2026-08-28，DEC-104）：氛围簇下线。占漆配额按 contaminationAge。钉贪婪薪柴路径。旁白改观察句，否决会走/在缝/贴地/在路。I8-D 旧阶梯禁止落地。
  I8-R2：旁白改角色低语、去掉「识别。」；占漆每档改区间（新生 3–5 / 标准 6–8 / 古老 9–12）。CSV 由 I8-N 落地。限频数字不改。
---

# 系统设计：污染句法

> **TL;DR**: 用底材 + 孔谱 + 词素生成海量可落地的污染体形态；成句是少数具名遭遇。接触词素只表达「它怎么伤你」；止损从连续性 × 覆盖深度查表，不是第五骰子。叙述家是设计正文 `contamination-lexicon.md`；本文是规则合同；`ui-encounter-narration.md` 是识别表面。出击视觉走方案 D（DEC-084）。接触与止损：出击与练习场同一套读取。生产抽样只允许已兑现行为（见「生产行为能力边界」）；`corridor_watching` 暂留练习场。新基体（残茎 / 栏柱 / 灰幕 + 余响 / 散光 / 间距）已翻成 `sortie`；油膜出击视图只占漆。落地分批：I3-A 一份抽卡+甲 form；I3-F 活机制；I3-E 画面。未落地的实现事实标在对应节，不是过期 FATAL。体验未验证。

## 概述

裂隙已经按锚 + 种子生成。敌人若仍是两种人形剖面，程序关卡的丰富对不上。污染句法把「形态」收成可学习的语法，而不是图鉴里的 324 个名字。

服务体验支柱 2（贪婪与撤退：绕 / 冲 / 杀都要算得清）与支柱 1（持续低频压力，不是随机怪物）。世界观：污染是改写不是破坏；同一时空差异来自基体，污染方言来自风格锚。`world.md` 的渗透 / 改写 / 覆盖仍是覆盖深度，不是三种职业。

**出击已接（体验未验证）。** 甲的五态仍归 `system-enemy-ai.md`。乙丙丁无第二份状态机。视觉走方案 D（DEC-084）；像素 HOW 在 `docs/art/contamination-forms.md`，本文只锁消费哪些字段。叙述家见 `docs/design-notes/contamination-lexicon.md`。识别表面见 `docs/specs/ui-encounter-narration.md`。

渗透体 / 改写体 = 孔谱甲的两种填法。覆盖体不以第三种人形出场。遭遇识别旁白是本体系的识别面，不是独立玩法。

## 状态模型

实现后生成器应对每个出生者物化下面这份描述（字段名可在 CSV / codegen 时改，语义不许空）：

```typescript
interface ContaminationForm {
  substrate: string; // CSV id；合法集合以 SUBSTRATE_DATA 为准，禁止在代码里再写一份封闭联合
  coverage: 'infiltrate' | 'rewrite' | 'overwrite'; // 渗透 / 改写 / 覆盖
  continuity: 'monolith' | 'shards' | 'colony' | 'field';
  occupancy: 'floor' | 'wall' | 'paint' | 'volume' | 'sound';
  lexemes: {
    motion: string;
    sense: string;
    rhythm: string;
    contact: string;
  };
  utteranceId?: string; // 成句 id；无名变体为空
}
```

止损不进本接口。运行时用 `resolveStopLoss(form)` 查表。禁止给 form 加 `stopLoss` 字段再当第五槽抽。

运行时生命期、察觉度、HP 仍分别由 AI / 战斗系统拥有。句法不另开一套状态机。

## 规则

1. **组合制度**：底材 = 基体 × 覆盖深度。孔谱 = 连续性 × 占位。词素四槽从该孔谱字母表 ∩ 本图方言 ∩ 覆盖深度开孔中抽取。禁止把运动 / 感知 / 节律 / 接触当作与占位无关的独立骰子。止损不是第五槽，见规则 30。
2. **六件套**：合法个体必须一次写完外观、生命期、移动、感知、攻击、死亡。攻击通道必须非空（禁止无害敌人）。禁止输出「待美术决定」或没有外观的纯过程。
3. **一份五态**：禁止为孔谱或填法复制 FSM。不可达状态（例如占漆无地板追击）是孔谱把某些转换关掉，不是新状态名。
4. **连通 FATAL**：菌落与场不得增加碰撞墙。只有单核、裂片可以占地且挡走。装饰层 / 漆 / 体积不得切开墙后可走地板。打不死（止损族 `unkillable`）禁止落在 `block_walk: true` 的孔谱上。
5. **基体亲和**：基体只允许 CSV 表内占位与连续性。非法组合丢弃重抽。行数以 `data/contamination-substrates.csv` 为准，不再封闭六种。概念基体（余响 / 散光 / 间距）仅 `volume`，禁止给甲。残余动词在渗透深度必须可读。
6. **覆盖开孔**：渗透 = 一条主感知通道 + 运动被残余动词锁一半。改写 = 可双通道，运动可偏离残余。覆盖 = 残余关闭，成句主要发生在这里。覆盖同时写入止损的 `core_policy`（更脆 / 默认 / 更硬），不改核 HP、不改刀数。
7. **占相位并入节律**。诱饵体不是自由连续性，只作成句。
8. **合法孔谱矩阵**以设计正文 §4.2 为准。场 × 占地、菌落挡走、菌落/场 × 满图占空或占声 = 非法。
9. **第一版只教四张主孔谱**：甲单核占地、乙单核占墙、丙菌落或场占漆、丁场或单核占空。占声不进主课。裂片占地可延后（因此「更硬-多段」延后，第一版「更硬」只走覆盖深度的 obscured）。
10. **孔谱甲**保留现有对照：地板寻路、视或听写入察觉度、看见才锁定追击、贴身扇形默认三刀。I1–I6 适用于可追击剖面。止损族永远是打核（尸体清理，不是驱散）。
11. **孔谱乙**禁止穿开阔地追击。攻击默认邻格抽打。挥击必须打到缝核。不占走廊碰撞。止损族永远是打核。
12. **孔谱丙**钉可走地板上有主的漆（生产外观 = 油膜三变体）；主感知是触地；无追击锁定；踩踏或该宿主胀满相位收混乱；漆不改碰撞。氛围崩坏簇已下线（DEC-104）。活层技术（DEC-070 / DEC-071）跟该宿主自己走。不另做小人精灵当默认外观。菌落 = 打散重组；场 = 打不死。接触槽只有踩踏混乱。
13. **孔谱丁**体积深度必须低于视野黑暗蒙层。可反视或领域察觉。攻击通道永远是体积场（混乱 + 视野）。不默认同款近战。禁止精神攻击空包，禁止给丁开打血。单核 = 止损族打核（核 HP 50）；场 = 打不死（挥击不扣核、不发 `ENEMY_DAMAGED`）。打不死时反视读「视野扫进体积 / 扫到相点」，相点不是可打核。
14. **自动改写**：三刀 + 占墙 → 邻格抽打。三刀 + 占漆 → 踩踏混乱。三刀 + 占空 → 场内加速混乱。巡路 + 占墙 → 巡墙图。视锥 + 占漆 → 触地主通道。禁止改写成打核驱散。
15. **词素必须改六件套至少一件**，否则逐出字母表。接触词素必须改攻击件，禁止再改死亡。交为空则重抽，禁止用最近非法值凑。止损不是词素，不走本条；死亡件由规则 30 的查表填写。
16. **抽卡配额**（每图）：乙或丁 1。占漆按本图 `contaminationAge` 掷闭区间整数：**新生 3–5 / 标准 6–8 / 古老 9–12**（`N = lo + floor(rng × (hi − lo + 1))`，种子 `mix32(layout.seed, 'paint-count')`）。最小 3。档间不重叠。N 不乘图面积、不乘薪柴路径长度。禁止再读 `ClusterOrganism` 只数 C，禁止再掷 0–1 硬币，禁止落地 I8-D 的 0/1/2/3，禁止落地 I8-R 钉死的 3/5/8。抽一份 form，复制 N 只（同基体 / 覆盖 / 连续性 / 词素 / 成句）。油膜三变体按个体种子采样。钉点：贪婪薪柴路径上的可走地板，偏咽喉（四邻可走格数为 2 优先），依次取。宿主钉点 Chebyshev ≥ 6；**N ≥ 9 时第一步从 ≥ 5 起**；不够 ≥ 4，再不够 ≥ 3。禁止钉墙 / 虚空 / 出生与撤离 Chebyshev ≤ 3 / 薪柴所在格。禁止 N 只都钉同一格。放不下先降间距、再扩到路径 Chebyshev 2、再扩到出生可达可走地板；**仍不足掷出的 N** 则本图重试，禁止交出击图，禁止把 N 钳小交差。出击甲条数由地图巡逻给出（3–4），**每条** `enemySpawns` 配一个占地 form；禁止用历史数字「甲 2–3」砍掉一条巡逻。练习场句法课甲数量由侧栏观察，不进出击配额。每图恰好一个听觉主轴；I16 生产限定甲的听觉填法，乙听缝待行为实现后再开放。
17. **出生钉层**：占地 → 现有路点契约；占墙 → 墙缘折线；占漆 → `paintFloors`（贪婪路径可走格）；占空 → 走廊包围盒。不再交出 `clusterCores` 当生产钉点。
18. **战斗成功标准不变**：绕应通常比杀便宜。接触词素改代价种类，禁止做成词缀 DPS。打不死正面支撑本条。更脆禁止变成「杀了更划算」（不得减刀数、不得降核 HP）。
19. **成句第一版四句**：门还想关、缝里的眼、簇的肺、走廊在看你。配方见设计正文 §6。内部配方名禁止印上屏。游戏内名称走遭遇识别旁白的观察句，成句另加短行为标记。禁止传奇口吻、禁止头上名字。双占位成句第二批。标记映射见下文「遭遇识别旁白」。簇的肺与走廊在看你都是场，止损 = 打不死。
20. **策划数据**实现时走 CSV → codegen。禁止在代码里手写形态表再反向导出。系统常量除外。止损查表是闭表（9 行），仍走 CSV → codegen，禁止在代码里另写一份 family 映射。
21. **世界可读仍是第一课**（缝的核、占漆外沿与该宿主呼吸、体积的相、可打核的有无与个数）。遭遇识别旁白是强化识别的 P1，不是替代、不是图鉴、不是后台配装板。逻辑以本文「遭遇识别旁白」节为准；载体 / 视觉 / U1–U12 见 `docs/specs/ui-encounter-narration.md`；叙述见设计正文 §7。
22. **遭遇身份键**（限频用，不上屏）：成句用 `utteranceId`。无名变体用 `coverage + substrate + occupancy + continuity`；占地再加主感知词素。不把运动 / 节律 / 接触四槽编进键。止损不另进键：它已由 `continuity × coverage` 决定；再加一层会让限频几乎永不命中。旁白不上屏止损术语。
23. **遭遇触发**：甲占地 / 乙占墙 = 看见该个体身体（`getVisibilityAt` > 0）。丙占漆 = 踩该漆，或视野扫到该宿主的任一计费漆格（场无核时不得再要求扫簇核）。丁占空 = 进入体积或视野扫到核（打不死时「核」读相点，不是可打核）。持续留在可识别里 = 同一次遭遇，不重复触发。
24. **遭遇限频**：同身份键本趟 60s；任意身份行间隔 ≥ 2.5s；同时 1 行；与混乱阈值重叠则阈值优先、这次作废不补打；出击结束清空冷却表。同图多只占漆若身份键相同，共享 60s（I8-D 特性，禁止为此拆键或改秒数）。
25. **事件**：通过限频的一次识别发出 `encounter:identified`。载荷见下文「实现规格 · 事件」。遭遇识别旁白消费此事件，不回写 AI。
26. **听觉主轴**：每图恰好一个主感知为听噪的个体；I16 当前生产为甲的听噪填法（`rewriter === 1`）。乙的听缝尚未兑现，暂不开放。撤离门仍必须是甲 + 视锥，不得担任听觉主轴。0 个或 ≥2 个 = 坏图，重试；禁止把全部甲改成视锥糊过去。
27. **油膜只占漆**：`oil_film.legal_occupancies` 仅为 `paint`。废止 DEC-076 第 8 条「否则丁无基体」的占空扩权。孔谱丁的合法基体是概念三类：`sound_echo` / `light_scatter` / `space_interval`（仅 `volume`）。出击视图见规则 29：油膜出击只占漆。
28. **出击范围**：CSV 列 `enabled_scope` 为 `sortie` 或 `gym`。出击 `drawSortie` 只抽 `sortie` 行。练习场句法课读全表，并按当前孔谱过滤 `legal_occupancies`。禁止把 `gym` 行抽进裂隙。sortie 集合见 Schema（旧六种 + 残茎 / 栏柱 / 灰幕 + 概念三类）。
29. **配对不变量**：概念基体任一行 `enabled_scope=sortie` ⟺ 油膜出击视图不占 `volume`。翻其中一半开关必须同一次提交翻另一半。禁止只收回油膜占空、却让概念基体仍停在 `gym`（裂隙丁会改抽乙）。**开放后：** 概念三类均为 `sortie` **且** `oil_film.sortieLegalOccupancies === ['paint']`。丁抽概念三类之一，禁止再抽油膜占空，禁止因无基体改抽乙（钉层空的乙↔丁回退仍在）。
30. **止损衍生（DEC-083）**：止损不是词素、不抽卡、不进身份键。查 `data/contamination-stop-loss.csv`：键 = `continuity + coverage`，得到 `family`（`core_strike` / `scatter_rejoin` / `unkillable`）与 `core_policy`（`exposed` / `standard` / `obscured` / `none`）。occupancy 必须落在该行 `legal_occupancies`。`block_walk === true` 禁止 `unkillable`。裂片行不进本表（延后）。接触槽不得再表达止损。
31. **无害禁止**：任意合法个体 `resolveContactChannel` 不得为 `'none'`。丙即使 `family=unkillable` 仍走踩踏混乱；丁即使 `family=unkillable` 仍走体积混乱 + 视野。gym 侧栏不得再提供 `contact_disperse_core`。
32. **打不死连通**：`unkillable` 只允许占漆或占空。禁止占地挡走、禁止占墙整面当打不死。门框占地固着挡门洞：仍必须可打核，若以后开放脉冲则必须有开相；不得把唯一通道永久封死。墙后可走格四连通分量必须仍为 1。

## 玩家交互

- 输入：不新增键位。玩家仍用走位、停步、挥击、工具做绕 / 冲 / 杀。遭遇识别旁白无「知道了」、无关闭键。
- 世界反馈：孔谱必须在世界上可读（路点身体、缝核、占漆外沿与该宿主呼吸、体积的相）。察觉度仍可走既有屏缘干涉（仅对仍有察觉度的个体）。
- **遭遇识别旁白**：强化「面对此类要注意什么」，禁止每个个体头上挂名。打开方式不是按键——满足遭遇条件且通过限频即出现。载体、画面占用、视觉、U1–U12 见 `docs/specs/ui-encounter-narration.md`。身份键、触发、限频、观察句选行、成句标记映射以本节下「遭遇识别旁白」为准。
- 审美人终审。

## 遭遇识别旁白（逻辑）

叙述见设计正文 §7。本节约规则。表面合同见 `docs/specs/ui-encounter-narration.md`（不要把视觉 HOW 当规则真相）。

### 身份键

限频用，不上屏。

- 有成句：`utteranceId`
- 无名变体：`coverage + substrate + occupancy + continuity`；占地时再加上主感知词素（否则渗透体与改写体撞键）。不把运动 / 节律 / 接触四槽全编进键，否则几乎永不「相同」。止损不另进键（已由连续性 × 覆盖深度决定）。旁白不上屏止损术语。

### 遭遇触发

第一次进入可识别，且通过限频，才算一次遭遇。

| 孔谱 | 可识别 |
| ---- | ------ |
| 甲占地 / 乙占墙 | 对该个体 `getVisibilityAt` > 0（与身体显隐同一套） |
| 丙占漆 | 玩家所在格踩在该漆上，或视野扫到该宿主的任一计费漆格 |
| 丁占空 | 玩家进入体积，或视野扫到核 |

持续留在可识别里（一直看着同一只）= **同一次遭遇**，不重复触发。必须先掉出可识别（看不见 / 离开体积 / 离开漆），再进来，才可能是下一次遭遇，且仍吃冷却。

### 限频

1. 同一身份键：本趟出击冷却 **60s**（从该行开始显示起算）。冷却内静默。同图多只占漆若身份键相同（同份 form 复制），**共享这条冷却**——第一口报完，其余静默。这是特性：教「这张图一种有主的漆」，不是漏报。禁止为加量拆身份键或改本条秒数。
2. 任意身份：两条记录之间至少空 **2.5s**（含上一条淡出）。
3. 同时只允许 **1 行**。
4. 与混乱阈值全屏层重叠：阈值优先；阈值结束后若仍在冷却窗内则**作废这次**，不补打。
5. 出击结束清空冷却表。不进存档。

### 上屏（观察句）

骨架（I8-R2）：`[观察句]`。不上「识别。」。成句命中时观察句换成该成句专用句，并可加短标记节点。观察句一个 span，禁止再拆成覆盖 / 基体 / 占位三个分类标签（DEC-104 否决精确分类）。整行按详细描述计不超过 40 字。本表面允许第一人称自语（「我」或零主语）与「他 / 它」；禁止「我们」、禁止「你」、感叹号、软件词、说明书词（危险 / 敌人 / 注意）。禁止电报缩写。覆盖深度不上屏，化进选哪个句池（渗透走残余、话说到一半；改写与覆盖走关死、更发麻）。排版与成品行见 `ui-encounter-narration.md`。CSV 由 I8-N 落地。

选行（code 不得另猜；I8-N 按此建表；同一条件一个句池，按宿主种子抽 1 行）：

| 条件 | 行 id | 观察句 |
| ---- | ----- | ------ |
| 占地 + 视锥或窄视 | observe_jia_look_1 | 慢一点，慢一点，别被他看见。 |
| 同上 | observe_jia_look_2 | 别动……他就在那儿看着路。 |
| 占地 + 听噪 | observe_jia_hear_1 | 轻一点，轻一点，别让他听见。 |
| 同上 | observe_jia_hear_2 | 别出声……他那边醒着。 |
| 占墙 + 渗透 | observe_yi_infiltrate_1 | 那道缝还在张着，贴过去会…… |
| 同上 | observe_yi_infiltrate_2 | 别靠墙，别靠墙，那道缝还开着。 |
| 占墙 + 改写或覆盖 | observe_yi_overwrite_1 | 缝里那点亮令人发麻，我走中间。 |
| 同上 | observe_yi_overwrite_2 | 别贴墙，别贴墙，那里已经不是墙了。 |
| 占漆 + 渗透 | observe_bing_infiltrate_1 | 这层膜令人发麻，我还是不要…… |
| 同上 | observe_bing_infiltrate_2 | 地是潮的，绕着走吧。 |
| 占漆 + 改写或覆盖 | observe_bing_overwrite_1 | 那滩在涨，我还是不要从那儿过…… |
| 同上 | observe_bing_overwrite_2 | 别过去，别过去，它在呼吸。 |
| 占空 + 渗透 | observe_ding_infiltrate_1 | 这段路窄得不对，换一条吧。 |
| 同上 | observe_ding_infiltrate_2 | 别走进去……边上那条还通着。 |
| 占空 + 改写或覆盖 | observe_ding_overwrite_1 | 那段雾令人发麻，我还是绕开…… |
| 同上 | observe_ding_overwrite_2 | 别穿过去，别穿过去，那已经不是路了。 |
| 成句门还想关 | observe_utt_door | 门还在自己关，别站在当中。 |
| 成句缝里的眼 | observe_utt_eye | 别贴边，别贴边，缝里有东西在看。 |
| 成句簇的肺 | observe_utt_lung | 这滩令人发麻，等一等，等一等。 |
| 成句走廊在看你 | observe_utt_corridor | 别往里走，别往里走，走廊看着我。 |

成句命中优先于无名行。narrow 与 cone 同走甲·看句池。

### 成句标记映射

| 内部配方（禁止上屏） | 上屏短标记 |
| -------------------- | ---------- |
| 门还想关 | 开合 |
| 缝里的眼 | 缝亮 |
| 簇的肺 | 在涨 |
| 走廊在看你 | 回头 |

### 事件

通过限频的一次识别发出 `encounter:identified`。遭遇识别旁白消费此事件，不回写 AI（看旁白不会被发现）。载荷见「实现规格 · 事件」。

练习场 / 净化点不创建本表面。

## 数值结构

甲的可追击剖面继续服从 `system-enemy-ai` 的 I1–I6 与 `data/enemies.csv`（75 HP = 三刀）。乙 / 丙 / 丁的核与混乱价如下；绕开通常为 0 价。数字实现进 `GAME_CONSTANTS.CONTAMINATION`（系统常量，不是策划形态表）。形态组合仍走 CSV。

| 参数 | 值 | 调节目的 |
| ---- | -- | -------- |
| 每图甲 | 地图巡逻 3–4（每条一个 form） | 占地压力（含巡路、转面与固着）；禁止用句法 2–3 砍路点 |
| 每图乙或丁 | 恰好 1（互斥） | 改一条路的走法；太多则看不懂 |
| 每图丙 | 新生 3–5 / 标准 6–8 / 古老 9–12（读 `contaminationAge` 掷闭区间；最小 3；不乘面积/路径长） | 有主的漆够形成绕/冲；污染度跨度可感且每趟有抖动；档间不重叠；不砍甲；不读簇只数 |
| 乙/丙/丁核 HP | 50（= 两刀，K1：25 的整数倍） | 清核比绕贵，但不是甲那种三刀交手 |
| 乙邻格抽打伤害 | 15（与甲同刀） | 贴墙才付血；走廊中央 0 |
| 乙邻格抽打前摇 | 350 ms | 与甲同一躲避窗 |
| 丙踩踏混乱（休息相） | +2 / 步 | 低于侦测 +3；冲斑有价、仍通常不如绕 |
| 丙踩踏混乱（胀满相） | +4 / 步 | 仍低于清核账单（战斗 +5 + 噪声 + 两刀） |
| 丁体积内额外混乱 | +1.0 / 秒 | 叠在 `CHAOS.BASE_RATE` 0.5 上；绕开整段 = 0 |
| 丁体积内视野距离乘 | 0.7 | 只在体积内；冲 = 盲穿 |
| 遭遇识别旁白同身份冷却 | 60 s / 趟 | 太短会刷，太长会忘 |
| 行间隔 | ≥ 2.5 s | 含上一条淡出 |
| 抽卡重试上限 | 12 次 / 只 | 上限内失败则本图少生该只并打日志 |

清核仍走既有 `CHAOS.COMBAT_BONUS`(5) 与挥击噪声。接触词素禁止变成 DPS 词缀。通道见下文「接触词素对照表」；止损见「止损衍生表」。数字只锁在本表，战斗 spec 只指针不复制。打不死的挥击不发 `ENEMY_DAMAGED`（不收战斗混乱），只走挥击噪声。丙踩踏计费区见实现规格「丙踩踏计费区」：数字仍是本表 +2/+4；无核场按实际漆格，菌落按活核旁 3×3。

## Schema（CSV 合同）

禁止把 324 填法手写进 `enemies.csv`。`enemies.csv` 只描述可追击剖面数值（渗透体 / 改写体）。形态是生成结果。成句是具名配方行，不是随机种子碰巧撞上。

源：`data/contamination-*.csv` → `src/generated/contamination-lexicon-data.ts`（扩展 `tools/csv-codegen/generate.mjs`）。字段内禁止 ASCII 逗号（与现有 codegen 一致）；多值用 `|`。止损表是闭表，仍走这条管线。

### `data/contamination-substrates.csv`

| 列 | 含义 |
| -- | ---- |
| id | 稳定英文蛇形。现有 + 本轮新行见下表 |
| display_token | 上屏短名。禁止 ASCII 逗号 |
| residual_verb | 渗透深度必须可读的短残余动词 |
| legal_occupancies | `floor\|wall\|paint\|volume` 子集。字段内禁止逗号 |
| legal_continuities | `monolith\|shards\|colony\|field` 子集 |
| enabled_scope | **必填。** 仅 `sortie` 或 `gym`。`sortie` = 出击 `drawSortie` 可抽（练习场也可选）；`gym` = 仅练习场句法课 |

**check:lexicon / codegen 合同：** 不再断言「恰好六行」。改为：

1. CSV 与 `src/generated/contamination-lexicon-data.ts` 的 id 集合一致（只许 codegen 生成，禁止手写 generated）。
2. 缺列、缺必填、`enabled_scope` 不是 `sortie`/`gym`、字段内 ASCII 逗号 → codegen 失败。
3. 出击白名单 `SORTIE_SUBSTRATE_IDS` = 全部 `enabledScope==='sortie'` 的 id，必须等于该列派生，禁止另维护一份与 CSV 脱节的封闭六 id 当唯一真相。
4. sortie 集合 = 旧六种 **去掉** `lamp_pillar` **加上** `stalk_clump` / `street_wreckage` / `insect_remnant` / `mammal_remnant` / `worm_remnant` / `ash_veil` / `sound_echo` / `light_scatter` / `space_interval`。`railing_post` / `lamp_pillar` 已收回 gym。`drawSortie` 不得含 `enabledScope==='gym'` 的行。废止「恰好旧六种」。
5. `oil_film.legalOccupancies`（CSV / 练习场视图）深等于 `['paint']`。废止「CSV 油膜必须能占空」。
6. `sound_echo` / `light_scatter` / `space_interval`：仅 `volume`，连续性只含 `monolith` 与/或 `field`。禁止给甲。`enabled_scope=sortie`。
7. `stalk_clump`（有机）与 `street_wreckage`（无机）合法占位含 `floor`、不含 `volume`，`enabled_scope=sortie`。三种生物（`insect_remnant` / `mammal_remnant` / `worm_remnant`）合法占位含 `floor`、不含 `volume`，`enabled_scope=sortie`（I5-T）。`railing_post` / `lamp_pillar` 合法占位仍是 `floor`、不含 `volume`，`enabled_scope=gym`。`ash_veil` 合法占位含 `paint`、不含 `volume`，`enabled_scope=sortie`。
8. `UTTERANCE_DATA.corridor_watching.substrate === 'space_interval'`。该成句保留于 CSV / 练习场，反视与天空相未兑现前不得进生产；其固定配方为 `substrate === 'space_interval'` 且 `occupancy === 'volume'`。废止「用油膜占空影子占住抽卡」。
9. **配对不变量（`check:lexicon` 必断言，保留双条件）：** 概念三类任一行 `enabled_scope=sortie` ⟺ `oil_film.sortieLegalOccupancies` 不含 `volume`。开放后两边都真：三类均为 `sortie` **且** `oil_film.sortieLegalOccupancies === ['paint']`。禁止只翻一半。

codegen 必须把 `enabled_scope` 写进 `SubstrateDef.enabledScope`，并写出派生字段 `sortieLegalOccupancies`（配对不变量；禁止手写 generated）。出击过滤读 `enabledScope` 列。

**行表（与 CSV 同步；类不进 CSV，只供阅读）：**

> **I5-J / I5-T 已翻列（DEC-088 / 迭代 5）：** `street_wreckage`（街具残骸）为 `sortie`，进 `SORTIE_SUBSTRATE_IDS`。`lamp_pillar` / `railing_post` 收回 `gym`，不进出击抽卡。三种生物基底（`insect_remnant` / `mammal_remnant` / `worm_remnant`）为 `sortie`（I5-T；进甲现有 3–4 巡逻加权池，不另给名额）。四行字段以 I5-P 定值为准（已进 CSV）。

**I5-P 定值（街具残骸与三种生物均 sortie。）I8-R：裂隙不再上屏基体短名。下表短名仅作内部 / 练习场标签，CSV 仍由 I8-N 决定是否改列：**

| id | 上屏短名（I8-D；CSV 待 I8-N） | 残余动词 | 合法占位 | 合法连续性 |
| -- | ---- | -------- | -------- | ---------- |
| `street_wreckage` | 街具 | 立 | floor | monolith |
| `insect_remnant` | 虫 | 爬 | floor | monolith |
| `mammal_remnant` | 兽骸 | 走 | floor | monolith |
| `worm_remnant` | 长虫 | 拱 | floor | monolith |

残余动词理由（原物残余还在做的事，不是污染的动作）：

- `street_wreckage` **立**：灯柱「亮」、栏柱「拦」都只覆盖变体的一种功能；竖杆 + 底座这条语法（灯柱 / 栏柱 / 标牌杆）全体还在做的事是立在街上。不沿用「亮」（栏柱与标牌杆不发光），不沿用「拦」（灯柱与标牌杆的原职不是拦路）。
- `insect_remnant` **爬**：多足、横向对称的原物残余还在爬。不是黏液蠕动。
- `mammal_remnant` **走**：四足、纵向的原物残余还在走。与 `organic_remnant` 同动词、不同基体节点；有机残影是无定形残余在走，本行是四足骸在走。
- `worm_remnant` **拱**：无足、分节长条的原物残余还在拱着前进。不用「蠕」（旁白会读成「蠕虫蠕」；也太像污染自己在扭）。

合法占位：四行都是 `floor`。街具残骸与三种生物都是孔谱甲的占地身体；不发明第三种占位。现行唯一例外仍是门框 `wall\|floor`，本批不扩。

合法连续性：四行都是 `monolith`。菌落 × 占地、场 × 占地仍非法（会挡走、切开连通）。裂片 × 占地矩阵合法但第一版延后；分节是一条身体的骨架语法，不是多核共享注意。有机残影 / 残茎已有的裂片不自动传给三种生物。

对抽卡与陈列馆展区数：多一个合法连续性，该厅会按覆盖 × 感知 × 运动 × 种子再乘一倍。本批不给裂片 / 菌落 / 场，连续性轴不膨胀。出击：街具残骸已替换灯柱 + 栏柱，出击甲仍只抽单核。三种生物进同一加权池（权重各 1），不另加巡逻名额。陈列馆格子变多只来自 I5-H 甲基体厅 5→7（灯柱厅与栏柱厅合成街具残骸一厅，加三个生物厅），不来自本批连续性。

旁白读感检查（I8-R：裂隙上屏已改观察句，基体短名不再上屏。本表只锁残余动词设计理由，防止以后又把「渗透街具会走」拼回去。三种生物走现有甲看 / 甲听句池，不按基体短名。审美待人终审）：

| 行 | 裂隙上屏（I8-R） | 残余动词（不上本行） |
| -- | ---------------- | -------------------- |
| `street_wreckage` | 走甲·看或甲·听观察句 | 立 |
| `insect_remnant` | 走甲·看或甲·听观察句 | 爬 |
| `mammal_remnant` | 走甲·看或甲·听观察句 | 走 |
| `worm_remnant` | 走甲·看或甲·听观察句 | 拱 |

| id | 上屏 | 类 | 残余动词 | 合法占位 | 合法连续性 | enabled_scope |
| -- | ---- | -- | -------- | -------- | ---------- | ------------- |
| organic_remnant | 残影 | 有机 | 走 | floor | monolith, shards | sortie |
| lamp_pillar | 灯柱 | 无机 | 亮 | floor | monolith | gym（I5-J 已退出出击） |
| doorframe | 门框 | 无机 | 开合 | wall, floor | monolith | sortie |
| wall_rust | 墙锈 | 无机 | 渗 | wall | monolith, colony | sortie |
| fungal_mat | 菌毯 | 有机 | 铺 | paint | colony, field | sortie |
| oil_film | 油膜 | 无机 | 沾 | paint | monolith, colony, field | sortie（出击视图只占漆） |
| stalk_clump | 残茎 | 有机 | 摇 | floor | monolith, shards | sortie |
| railing_post | 栏柱 | 无机 | 拦 | floor | monolith | gym（I5-J 已退出出击） |
| ash_veil | 灰幕 | 无机 | 覆 | paint | monolith, colony, field | sortie |
| sound_echo | 余响 | 概念（声音） | 响 | volume | monolith, field | sortie |
| light_scatter | 散光 | 概念（光线） | 折 | volume | monolith, field | sortie |
| space_interval | 间距 | 概念（空间关系） | 挤 | volume | monolith, field | sortie |
| street_wreckage | 街具 | 无机 | 立 | floor | monolith | sortie（I5-J 已翻列，替换灯柱 / 栏柱） |
| insect_remnant | 虫 | 有机 | 爬 | floor | monolith | sortie（I5-T 已翻列） |
| mammal_remnant | 兽骸 | 有机 | 走 | floor | monolith | sortie（I5-T 已翻列） |
| worm_remnant | 长虫 | 有机 | 拱 | floor | monolith | sortie（I5-T 已翻列） |

门框占地时运动必须固着，且不得永久封死出生→撤离的唯一通道。街具残骸占地所有覆盖度固着。禁止把概念基体给甲。

**出击丁与油膜占空：** 练习场 / CSV 油膜只占漆。丁必须能抽到概念三类之一，**禁止**再抽油膜占空，**禁止**因无基体改抽乙。钉层空的乙↔丁回退仍在（乙空则丁、丁空则乙；两者都失败才本图只有甲并打日志）。练习场句法课下拉直接抽概念三类，看不到油膜占空。

**可玩窗口：** I3-E 与 I3-G 都落地之前，不要请人试玩裂隙里的丁（DEC-084）。甲 form 管线（I3-A）可以先让旁白报抽到的旧六种基体，那不是丁油膜问题。

### `data/contamination-portfolios.csv`

| 列 | 含义 |
| -- | ---- |
| id | `jia` / `yi` / `bing` / `ding` |
| display_token | 内部孔谱名仍是占地 / 占墙 / 占漆 / 占空。I8-R 起不上屏；裂隙走观察句 |
| continuity | 默认连续性 |
| occupancy | floor / wall / paint / volume |
| legal_continuities | 该主课允许的连续性 |
| pin_layer | waypoints / wall_edge / paint_floor / corridor_aabb（`cluster_core` 退役） |
| can_chase | true 仅甲 |
| block_walk | true 仅甲（单核占地） |
| default_contact | 接触词素 id |
| detection_pulse | true = 甲、乙可接屏缘干涉；丙、丁第一版 false |

### `data/contamination-lexemes.csv`

| 列 | 含义 |
| -- | ---- |
| id | 稳定英文键 |
| slot | motion / sense / rhythm / contact |
| display_token | 上屏短词 |
| legal_portfolios | `jia\|yi\|bing\|ding` |
| rewrite_to | 可空。格式 `yi:contact_adjacent_strike;bing:contact_step_chaos;ding:contact_volume_chaos`。目标必须是仍存在的接触词素，禁止指向已删除的 `contact_disperse_core` |

广播不进第一版字母表。`contact_disperse_core` 已删除，禁止再出现。

### `data/contamination-stop-loss.csv`

闭表，不是抽卡字母表。code 不得把本表当第五槽来抽。恰好 9 行 = `{monolith,colony,field} × {infiltrate,rewrite,overwrite}`。禁止 `shards` 行。

| 列 | 含义 |
| -- | ---- |
| id | `${continuity}_${coverage}`，稳定英文蛇形 |
| continuity | `monolith` / `colony` / `field` |
| coverage | `infiltrate` / `rewrite` / `overwrite` |
| family | `core_strike`（打核）/ `scatter_rejoin`（打散重组）/ `unkillable`（打不死） |
| core_policy | `exposed`（更脆）/ `standard` / `obscured`（更硬）/ `none`（仅 `unkillable`） |
| legal_occupancies | 该行允许的占位。`unkillable` 只许 `paint\|volume`。字段内禁止逗号 |

**check:lexicon / codegen 合同（DEC-083）：**

1. 恰好 9 行；id 集合必须等于上表笛卡尔积。
2. 不得出现 `shards`、不得出现第四个 family。
3. 每条 `unkillable` 的 `core_policy` 必须是 `none`，`legal_occupancies` 深等于 `paint|volume`（顺序可按 CSV）。
4. 每条 `core_strike` / `scatter_rejoin` 的 `core_policy` 不得为 `none`。
5. `scatter_rejoin` 的 `legal_occupancies` 不得含 `floor`。
6. codegen 写出 `STOP_LOSS_DATA` 与类型 `StopLossFamily` / `StopLossCorePolicy`。禁止手写 generated。
7. 任意 `drawOne` / `drawSortie` / gym `formFromConfig` 的合法个体：`resolveContactChannel !== 'none'`，且 `resolveStopLoss` 命中本表、occupancy 合法、`block_walk` 个体不得 `unkillable`。

### `data/contamination-utterances.csv`

四行，id 稳定英文；`internal_label` 禁止上屏。

| id | 内部名（禁上屏） | on_screen_mark | 底材 / 孔谱 / 词素 |
| -- | ---------------- | -------------- | ------------------ |
| door_still_closing | 门还想关 | 开合 | 渗透 · 门框 · yi 单核占墙 · 固着 · 触地 · 脉冲 · 邻格抽打 |
| eye_in_the_seam | 缝里的眼 | 缝亮 | 覆盖 · 墙锈 · yi 单核占墙 · 固着 · 窄视 · 常开 · 邻格抽打 |
| cluster_lung | 簇的肺 | 在涨 | 改写 · 菌毯 · bing 场占漆 · 簇栖 · 触地 · 随漆呼吸 · 踩踏混乱 |
| corridor_watching | 走廊在看你 | 回头 | 覆盖 · 间距 · ding 场占空 · 固着 · 反视 · 随天空相 · 场内加速混乱 |

成句命中优先于无名抽卡：本图若抽中该孔谱，按配额与方言先检查成句配方是否可钉；不能钉则走无名变体。

### `data/contamination-display-tokens.csv`

覆盖深度、占位、设备骨架。I8-R 起覆盖 / 占位 token **不再上屏**（化进观察句选行）。I8-R2 起 `device_prefix` **不再上屏**（去掉「识别。」）。基体与词素的 `display_token` 列可留作内部，裂隙不读。

| id | kind | display_token | I8-R2 上屏 |
| -- | ---- | ------------- | ---------- |
| coverage_infiltrate | coverage | 渗透 | 否 |
| coverage_rewrite | coverage | 改写 | 否 |
| coverage_overwrite | coverage | 覆盖 | 否 |
| occupancy_floor | occupancy | 会走 | 否（否决精确分类） |
| occupancy_wall | occupancy | 在缝 | 否 |
| occupancy_paint | occupancy | 贴地 | 否 |
| occupancy_volume | occupancy | 在路 | 否 |
| device_prefix | device | 识别。 | **否**（I8-R2 去掉分类头；行可留、裂隙不读） |

### `data/contamination-observe-lines.csv`（I8-N 新建；本批不改 CSV）

裂隙上屏观察句。code 禁止在 `encounter-narration.ts` 写死整句中文。同一选行条件可多行（句池）；按宿主种子抽 1。

| 列 | 含义 |
| -- | ---- |
| id | 稳定英文，见上文选行表 |
| occupancy | floor / wall / paint / volume；成句行可空 |
| sense | cone / hear / narrow / 空。仅占地用；narrow 与 cone 同走甲·看句池 |
| coverage_bucket | infiltrate / overwrite；改写视同 overwrite。占地行可空 |
| utterance_id | 成句 id 或空 |
| display_token | 整行低语；≤ 40 字。无「识别。」前缀 |

代码禁止写死整句中文。不再从 `device_prefix` 拼骨架。

## 实现规格（DEC-076，code 不得再猜）

数字只锁在本文「数值结构」与将落地的 `GAME_CONSTANTS.CONTAMINATION`。设计正文只指向本文，禁止第二份数字表。外观 HOW：`docs/art/contamination-forms.md`。

### 生产行为能力边界（I16）

CSV 是合法字母表；生产还须与当前运行时能力求交。`supportsRuntimeForm` 校验整张配方，`floorMotionFor` 是 AI / 生产表现共用的占地运动解释。这里记录已兑现范围，不把展示课的词素排列宣称为不同玩法。四类占据方式、甲 3–4 只、乙或丁恰好 1 只、年龄占漆配额和恰好一个听觉主轴不变。

- 甲：巡路 / 转面 / 固着 × 视锥或听噪 × 常开 × 三刀近战。凝聚、窄视、睡眠、脉冲均未有独立行为，退出生产池。门框、街具（以及练习场灯柱、栏柱）所有覆盖度都固着，优先于旧 form 中的错误运动值。转面原地扫描；固着平时守住当前朝向。两者受刺激会转向、保持同一五态感知与退警流程，近身且未丢失视线时仍可反击；镜像被选为视线目标时朝向镜像，不授予对真人的反击许可，巡逻 / 怀疑 / 搜索 / 追击 / 返回均不产生位移，不加入寻路与分离。固着免疫位移击退；转面仍允许既有工具击退后在新位置驻留。虫渗透档锁巡路，兑现爬行；蠕虫与残茎渗透档继续锁转面。
- 乙：保留已实现的沿壁 / 转面 / 固着；感知只抽触地，节律只抽常开，接触仍为邻格前摇后抽打。听缝 / 窄视 / 睡眠 / 脉冲尚未兑现，暂不进生产。听觉主轴明确分配给甲，不声称墙面听觉变体已交付。
- 丙：只抽簇栖 × 触地 × 随漆呼吸 × 踩踏混乱。原有宿主呼吸相驱动 +2 / +4 步价，不存在额外睡眠安全窗。固着 / 随风运动、嗅混乱 / 领域感知、常开 / 脉冲节律没有独立实现，暂不用于生产配方；基体、覆盖、连续性和几何种子仍可变化。
- 丁：保留实际活动盒的固着形变 / 随风 / 拖尾；只抽领域 × 常开，玩家在当前活动盒内持续支付原有混乱与视野价。反视 / 嗅混乱 / 天空相 / 脉冲无危险开关实现，暂不进生产。

成句按完整配方原样验能力：只有 `cluster_lung` 当前可进生产。`door_still_closing`、`eye_in_the_seam`、`corridor_watching` 保留 CSV / 练习场配方供检视，禁止静默替换词素后仍沿用成句身份或专用低语。`scope: gym` 可显示全字母表，不能作为这些行为已兑现的证据。

机器验证：`tools/contamination-lexicon/check-runtime-behavior.ts` 运行真实 `updateBehavior` / 五态刺激、抽卡与正式布局；覆盖全状态固着、原地转面、近身反击许可、失去视线解除、虫巡路、四占据与配额 / 听轴。视觉和实战节奏仍需人终审。

### 完整字母表（CSV / 练习场；生产须再过上述能力边界）

孔谱甲 `jia`（占地）：
- 运动：`motion_patrol` 巡路、`motion_turn` 转面、`motion_anchor` 固着、`motion_coalesce` 凝聚
- 感知：`sense_cone` 在看、`sense_hear` 在听、`sense_narrow` 细看（上屏仅占地；内部仍按视锥 / 听噪 / 窄视填词）
- 节律：`rhythm_open` 常开、`rhythm_sleep` 睡眠、`rhythm_pulse` 脉冲
- 接触：`contact_melee_three` 三刀近战

孔谱乙 `yi`（占墙）：
- 运动：`motion_wall` 沿壁、`motion_anchor` 固着、`motion_turn` 转面
- 感知：`sense_narrow` 窄视、`sense_hear` 听噪、`sense_touch` 触地
- 节律：`rhythm_open` 常开、`rhythm_pulse` 脉冲、`rhythm_sleep` 睡眠
- 接触：`contact_adjacent_strike` 邻格抽打（抽到三刀则改写为此）

孔谱丙 `bing`（占漆）：
- 运动：`motion_cluster` 簇栖、`motion_anchor` 固着、`motion_wind` 随风
- 感知：`sense_touch` 触地、`sense_scent` 嗅混乱、`sense_domain` 领域
- 节律：`rhythm_cluster` 随漆呼吸（内部 id 不改）、`rhythm_open` 常开、`rhythm_pulse` 脉冲
- 接触：`contact_step_chaos` 踩踏混乱（抽到三刀改写为此）

孔谱丁 `ding`（占空）：
- 运动：`motion_anchor` 固着、`motion_wind` 随风、`motion_trail` 拖尾
- 感知：`sense_reverse` 反视、`sense_domain` 领域、`sense_scent` 嗅混乱
- 节律：`rhythm_sky` 随天空相、`rhythm_pulse` 脉冲、`rhythm_open` 常开
- 接触：`contact_volume_chaos` 场内加速混乱（抽到三刀改写为此）

现有对照必须能被生成器表示（测试夹具，不是手写第二套表）：
- 渗透体 = 有机残影 × 渗透 × 甲 × 视锥 × 常开 × 三刀
- 改写体 = 有机残影 × 改写 × 甲 × 听噪 × 常开 × 三刀

覆盖深度开孔：渗透 = 一条主感知，运动被残余动词锁一半。改写 = 可双通道。覆盖 = 残余关闭。实现：渗透时若基体有残余运动锁，覆盖运动槽：

| substrate | 渗透时运动锁（须在该孔谱字母表内才生效） |
| --------- | ---------------------------------------- |
| doorframe | motion_anchor |
| lamp_pillar | motion_anchor |
| railing_post | motion_anchor |
| street_wreckage | motion_anchor（与灯柱 / 栏柱同类：立着的街具） |
| organic_remnant | motion_patrol |
| mammal_remnant | motion_patrol（走；与有机残影同锁、不同基体） |
| stalk_clump | motion_turn |
| insect_remnant | motion_patrol（爬行，I16 完整移动样本） |
| worm_remnant | motion_turn（拱 / 分节；禁止新开词素） |
| wall_rust | motion_wall |
| fungal_mat | motion_cluster |
| oil_film | motion_wind |
| ash_veil | motion_cluster |
| sound_echo | motion_anchor |
| light_scatter | motion_trail |
| space_interval | motion_anchor |

无锁或缺席当前抽样池则不覆盖运动槽。生产池先与运行时能力求交；无机占地固着锁不受覆盖度限制。

### 接触词素对照表（code 不得另猜）

现有四词。通道种类：打血 / 混乱 / 视野。**没有「仅驱散核」通道。** 打核是止损，见下一节。数字只锁在上文「数值结构」，本表不复制第二份价目。禁止 DPS 词缀。禁止给丁发明精神攻击空包，禁止给丁开打血。

**兑现范围：** 出击与练习场**同一套读取**。宿主活路径（`liveMotion === true`）必须读 `lexemes.contact` 并按本表走通道，且必须再读 `resolveStopLoss` 决定能不能扣核。`hittable === false` 不扣核、不白闪、不发 `ENEMY_DAMAGED`；不关丙踩踏 / 丁体积场。非法组合走既有 `rewrite_to`。废止「出击本轮按宿主 kind 硬编码」。

`RiftScene` 传 `{ liveMotion: true }`。练习场句法课同样传（公有开关名 `liveMotion`；gym 调用方内部可留旧字段别名，禁止 `RiftScene` 出现标识符 `gymLiveMotion`）。地图课不得打开 `liveMotion`，静帧 tick 仍在。

| contact id | 甲 | 乙 | 丙 | 丁 |
| ---------- | -- | -- | -- | -- |
| contact_melee_three | 通道：打血（贴身扇形）。合法本槽。 | 非法；`rewrite_to` → `contact_adjacent_strike` | 非法；`rewrite_to` → `contact_step_chaos` | 非法；`rewrite_to` → `contact_volume_chaos` |
| contact_adjacent_strike | 非法；无 rewrite_to；丢弃重抽 | 通道：打血（邻格抽打）。危险区跟核走。 | 非法；无 rewrite_to；丢弃重抽 | 非法；无 rewrite_to；丢弃重抽 |
| contact_step_chaos | 非法；丢弃重抽 | 非法；丢弃重抽 | 通道：混乱（踩踏）。不打血。场打不死时仍走本通道。 | 非法；丢弃重抽 |
| contact_volume_chaos | 非法；丢弃重抽 | 非法；丢弃重抽 | 非法；丢弃重抽 | 通道：混乱 + 视野（体积场）。余响 / 散光 / 间距三类同通道。场打不死时仍走本通道。禁止改打血。 |

`contact_disperse_core` 已删除。广播不进第一版字母表。打散重组不进接触字母表（走止损族 `scatter_rejoin`）。

`resolveContactChannel` 必须删除 `'disperse_core'` 取值。改写之后丙三刀 → `'step_chaos'`，丁三刀 → `'volume_chaos_sight'`。任何合法活宿主不得返回 `'none'`。

### 丙踩踏计费区（2026-08-28 实现真相）

数字仍锁上文「数值结构」：休息相 +2 / 步、胀满相 +4 / 步。不打血。按「步」计，站着不动不叠加。只认丙敌人钉住的那片漆。胀满相锚到**该宿主自己的活层相位**（`sin(host.phase) > 0.35`）；禁止再读整图崩坏簇活层。反馈 = 混乱条变长 + 短促提亮，禁止飘字。

- **菌落：** 每个活核 Chebyshev 距离 ≤ 1（3×3）；死核停收该核旁 3×3（见止损「打散重组」）。
- **无核场：** 按实际漆格计费，不是钉点旁 3×3。实现：`collectPaintGenomeFloorTiles` 把场值 ≥0.1 的像素映射到世界地板格（不写碰撞）；宿主 `setStepFloors`；裂隙 / 句法课 / 地图课同一套。无 `stepFloors` 行时回退钉点 Chebyshev ≤ 1。

### 止损衍生表（code 不得另猜）

查 `STOP_LOSS_DATA[continuity + '_' + coverage]`。不要把 family 存进 `ContaminationForm`（会变成第五骰子）。

| continuity | coverage | family | core_policy | 合法占位 | 玩家读成 |
| ---------- | -------- | ------ | ----------- | -------- | -------- |
| monolith | infiltrate | core_strike | exposed | floor wall paint volume | 打核；核好认；结束干净 |
| monolith | rewrite | core_strike | standard | 同上 | 打核；现在这套核 |
| monolith | overwrite | core_strike | obscured | 同上 | 打核；核难看（更硬）；痕迹多留一会儿仍不挡路 |
| colony | infiltrate | scatter_rejoin | exposed | paint wall | 打散重组；核好认 |
| colony | rewrite | scatter_rejoin | standard | paint wall | 打散重组 |
| colony | overwrite | scatter_rejoin | obscured | paint wall | 打散重组；核难看 |
| field | infiltrate | unkillable | none | paint volume | 打不死；残余仍可读 |
| field | rewrite | unkillable | none | paint volume | 打不死 |
| field | overwrite | unkillable | none | paint volume | 打不死；覆盖把原形关死 |

第一版主课实际用到的格：甲乙只有 monolith×占地/占墙；丙 colony|field × 占漆；丁 field|monolith × 占空。墙斑菌落合法占位留给矩阵，乙主课 `legal_continuities` 仍是 monolith，不必本轮实现墙菌落。

**核 HP 与刀数（禁止改）：** 甲 75 = 三刀。乙丙丁每个可打核 50 = 两刀。`core_policy` 不得改这些数。

**打散重组（第一版，干净落地的那一截）：**

- 一个 form，2–3 个可打核，各 50 HP。
- 优先钉在该宿主自己的漆格包围盒内不同位置；练习场只有一团漆时，在该团可走格上放 2 个核，间距优先 ≥ 3 格，空间不够则 ≥ 2 格。禁止钉到另一只宿主的漆上。禁止再读相邻 `ClusterOrganism`。
- 打灭一个核：该核 Chebyshev 距离 ≤ 1 的漆不再收踩踏；其余核的漆仍收。form 仍活。发 `ENEMY_DAMAGED`，不发 `ENEMY_KILLED`。
- 最后一个核归零才 `ENEMY_KILLED`，整只回收。
- **本趟死核不回来。** 「重组」读作「整体还在（别的团还在）」，不是死核原地复活。

**打不死：**

- 不画可打核（2×2 亮青绿打击点）。场可以有相点 / 整团体积变亮，供反视与节律，但挥击扫到不白闪、不扣 HP、不发 `ENEMY_DAMAGED`。挥击噪声仍按战斗 spec A8（空挥 `suspicious`）。
- 丙场：无核场按实际漆格踩踏（不是钉点旁 3×3）。丁场：进体积仍混乱 + 视野 ×0.7。
- 节律可以把场暂时关掉（相没了就不是实体）；相回来它还在。这是绕，不是杀。

**残骸（不进 CSV，code 按本表派生，不要再猜）：**

| occupancy | family | leftover |
| --------- | ------ | -------- |
| floor | core_strike | 渗透 = 干净轮廓一闪；改写/覆盖 = 标准淡出。永不挡路尸体 |
| wall | core_strike | 核灭留不挡走廊的墙锈 |
| paint | core_strike | 该团漆留无害纹样，不再呼吸 |
| paint | scatter_rejoin | 死核那一团无害；其余团仍有价 |
| paint | unkillable | 威胁不消失 |
| volume | core_strike | 体积散 |
| volume | unkillable | 威胁不消失 |

覆盖深度的 obscured 只让残骸在该层**多留一会儿**，仍不挡路、不再伤人。禁止用「杀掉后还伤人」冒充更硬（那会与打不死撞车）。

**可读性（设计要求，像素归 art，禁止本 spec 发明新色）：**

- 可打核：稳定的小亮核，打中走既有受击（甲白闪 / 丙丁板内最亮青绿 1–2 帧）。`exposed` 更大更露，`obscured` 更小更埋进覆盖里，`standard` 维持现行尺寸。
- 打散重组：同一只身上同时能数出 ≥2 颗可打核。
- 打不死：遭遇当下看不到可打核。禁止画一颗看起来能打的核却打不动（教学谎言）。
- 旁白不上屏止损词。具体像素：`docs/art/contamination-forms.md`（方案 D 生产 HOW，I3-C）；本 spec 不发明新色。审美待人终审。

### 方言（按 `fragmentTypeId`，同一趟一种方言）

风格锚先抽碎片类型，再给字母表权重。禁止一图动物园。未启用的碎片类型仍写权重，启用后直接用。权重是抽卡偏置，不是禁令（除基体亲和非法交仍丢弃）。覆盖深度不按碎片改写「覆盖体变第三种人形」。碎片 bias 不是新时空。

出击抽卡：按本表取加权行，**加权前**丢掉 `enabled_scope !== sortie` 的行（出击视图）。禁止先加权再丢掉——会多消耗随机数并改变出击抽卡。练习场句法课配表下拉读全表（仍按孔谱过滤占位）；若练习场走方言抽卡，不过滤 `gym` 行。新六行已进出击池。

R2-C-data 必须按下面数字改 `contamination-draw.ts` 的 `DIALECT`（禁止出现未写入本表的 id）。未列出的旧基体对该碎片视为降权（不进加权表）。

| fragmentTypeId | substrates 加权（id × 权重） | preferYiDing | 词素侧 |
| -------------- | ---------------------------- | ------------ | ------ |
| frag-outdoor | fungal_mat 3, ash_veil 3, oil_film 3, space_interval 3, organic_remnant 2, stalk_clump 2, sound_echo 2, light_scatter 2, wall_rust 1, street_wreckage 1, insect_remnant 1, mammal_remnant 1, worm_remnant 1 | ding | 门框不进表（原栏柱 1 并入街具残骸；I5-T 三种生物各 1） |
| frag-clinic | street_wreckage 5, doorframe 3, wall_rust 2, light_scatter 2, organic_remnant 1, stalk_clump 1, ash_veil 1, space_interval 1, sound_echo 1, insect_remnant 1, mammal_remnant 1, worm_remnant 1 | yi | 菌毯不进表；随风降权（原灯柱 3 + 栏柱 2 并入街具残骸；I5-T 三种生物各 1） |
| frag-metro | wall_rust 3, oil_film 2, street_wreckage 4, doorframe 2, ash_veil 2, sound_echo 2, space_interval 2, light_scatter 1, insect_remnant 1, mammal_remnant 1, worm_remnant 1 | either | 菌毯中权（不进表=中低）；簇栖中权（原灯柱 2 + 栏柱 2 并入街具残骸；I5-T 地铁首次出现有机家族占地，街具+门框仍 6 对生物 3） |
| frag-library | doorframe 3, wall_rust 2, organic_remnant 2, street_wreckage 2, sound_echo 2, stalk_clump 1, light_scatter 1, space_interval 1, insect_remnant 1, mammal_remnant 1, worm_remnant 1 | yi | 随风降权（**DEC-090 / I6-G：** 已启用，生产路径；原栏柱 2 并入街具残骸；I5-T 三种生物各 1） |
| frag-residential | organic_remnant 3, stalk_clump 3, doorframe 2, oil_film 2, street_wreckage 1, ash_veil 1, space_interval 1, sound_echo 1, light_scatter 1, insect_remnant 1, mammal_remnant 1, worm_remnant 1 | yi | 本迭代不启用（DEC-090 抽卡四张；DEC-094：簇是参数点，不再当未实现生成器）。启用前禁止当生产路径（原栏柱 1 并入街具残骸；I5-T 三种生物各 1） |

### 抽卡顺序

1. 读本图 `fragmentTypeId` 与 `contaminationAge`。不读 `ClusterOrganism[]`。
2. 掷乙或丁（1 只）。户外偏丁，临床偏乙，地铁按种子。丁有概念基体，禁止因无合法基体改抽乙。钉层空才乙↔丁回退。
3. 掷甲，条数 = 本趟 `enemySpawns.length`（3 或 4）。撤离门那条必须是甲 + `sense_cone`（有机残影 + 渗透 + 视锥可走强制参数，结果必须写进 `spawn.form`）。禁止先抽 2–3 再丢掉一条路点。
4. 掷丙：按 `contaminationAge` 在闭区间内均匀取整（`new` → 3–5，`standard` → 6–8，`ancient` → 9–12）。抽一份占漆 form（`preferUtterance` 仍每图最多 1 次成句），复制 N 只。钉 `paintFloors`：贪婪薪柴路径，偏咽喉。Chebyshev ≥ 6；N ≥ 9 时第一步从 ≥ 5 起；不够 ≥ 4、再不够 ≥ 3。禁止全部钉同一格。不足掷出的 N 则本图重试，`console.warn`。N 不乘面积、不乘路径长。
5. 听觉主轴：I16 生产乙不抽听噪；甲里恰好一只听噪（改写体对照），其余甲不得听噪。墙面听觉替换待行为实现与验证后再开放。
6. 每只：底材 ∩ 孔谱 ∩ 方言 ∩ 覆盖开孔 ∩ 本路径允许的 `enabled_scope` → 四槽。交空重抽，上限 12。失败则少生该只并 `console.warn`，禁止用占地小人顶替漆/缝/体积。出击路径的 `enabled_scope` 必须是 `sortie`。
7. 成句：本图孔谱匹配时，若钉层允许，优先用配方行替换无名抽卡（每句每图最多 1 次）。I16 仅允许整套行为已兑现的 `cluster_lung` 命中；`corridor_watching` 暂留练习场，基体仍必须是间距、占位必须是占空。废止「用油膜占空影子占住抽卡」。

一次出击**一份**抽卡：`GeneratedRiftLayout.contaminationDraw`（类型 `SortieDraw`）。种子独立 fork（`mix32(layout.seed, 'lexicon')`），禁止吃 `placeOnIsland` 的 rng。`ContaminationHostSystem.create` **禁止再调** `drawSortie`；乙丙丁只物化该份里的非甲 form。落地：I3-A。

### 钉层（地图生成必须交出）

实现后扩 `GeneratedRiftLayout`（由同一 `generateRiftLayout` 返回）。墙后可走格四连通分量必须仍为 1。钉层几何仍是 `contaminationPins`。**另交** `contaminationDraw: SortieDraw`：本趟唯一一份句法抽卡，同时喂甲 `enemySpawns[].form` 与乙丙丁宿主。此字段**不是**地表烤漆风格枚举（`RiftSurfacePainter` 的同名参数是另一件事，禁止合成联合类型）。

```typescript
interface WallEdgePolyline {
  readonly tiles: readonly { col: number; row: number }[]; // 墙格且四邻有地板
  readonly strikeFloors: readonly { col: number; row: number }[]; // 抽打只进这些地板
}

interface PaintFloorPin {
  readonly floorCol: number;
  readonly floorRow: number; // 必须可走；禁墙/虚空
  readonly onGreedy: boolean;
  readonly throatScore: number; // 四邻可走格越少越高
}

interface CorridorAabb {
  readonly minCol: number;
  readonly minRow: number;
  readonly maxCol: number;
  readonly maxRow: number;
  readonly coreCol: number;
  readonly coreRow: number; // 单核 = 可打核且可走；场 = 相点（不可打），仍须可走
}
```

- 占地：现有巡逻路点（可走、出生可达）。甲挡走，碰撞约 20。
- 占墙：墙缘折线。抽打只进 `strikeFloors`。核画在墙格，不占走廊碰撞。
- 占漆：`paintFloors`。出生走到争夺档与深档薪柴的最短可走链上的地板格，偏咽喉。无合法格则本图重试，禁止改画到墙上。
- 占空：一段窄可走带的包围盒（宽度 ≤ 4 格的通道优先）。体积深度必须 `< DEPTH.visionMask`（约 50）；建议世界层 depth 40。

钉失败：本图少生该只并打日志。

### 五态可达性（禁止新 FSM）

| 孔谱 | PATROL | SUSPICIOUS / ALERT | CHASE | RETURN |
| ---- | ------ | ------------------ | ----- | ------ |
| 甲 | 路点 | 现有 | 地板寻路；看见才锁定 | 现有 |
| 乙 | 沿墙折线或固着 | 邻格刺激可升 | 禁止穿开阔地。所谓追 = 沿墙滑到最近邻接缝 | 沿墙回钉点 |
| 丙 | 无路点 | 无 | 无追击锁定 | 无 |
| 丁 | 无 | 反视：玩家视野扫进体积或扫到相点才从睡眠/固着进入警觉类。打不死时相点 ≠ 可打核 | 无地板追击 | 失视则休眠 |

屏缘干涉：仅 `detection_pulse === true`（甲、乙）。丙、丁第一版不接屏缘，避免读成「地上也有一只人」。

甲仍守 I1–I6。乙/丙/丁不追击，不把 I3 理解成「核必须比玩家慢走路」——它们多数固着。

### 事件载荷

```typescript
// GameEvent.ENCOUNTER_IDENTIFIED = 'encounter:identified'
{
  identityKey: string;
  nodes: readonly {
    kind: 'observe' | 'utterance_mark';
    tokenId: string; // CSV id；上屏用 display_token
  }[];
  utteranceId?: string;
}
```

身份键：成句 = `utteranceId`；无名 = `coverage|substrate|occupancy|continuity`，占地再拼 `|sense`。不再发 coverage / substrate / occupancy 分节点。

### 系统常量形状

```typescript
CONTAMINATION: {
  CORE_MAX_HEALTH: 50,
  ADJACENT_STRIKE_DAMAGE: 15,
  ADJACENT_STRIKE_WINDUP_MS: 350,
  PAINT_STEP_CHAOS_REST: 2,
  PAINT_STEP_CHAOS_INFLATED: 4,
  VOLUME_CHAOS_PER_SEC: 1.0,
  VOLUME_SIGHT_MULT: 0.7,
  DRAW_RETRY_LIMIT: 12,
  ENCOUNTER_COOLDOWN_MS: 60_000,
  ENCOUNTER_GAP_MS: 2_500,
  ENCOUNTER_HOLD_MS: 2_500,
  VOLUME_DEPTH: 40, // < visionMask 50
  COLONY_NUCLEUS_COUNT_MIN: 2,
  COLONY_NUCLEUS_COUNT_MAX: 3,
  COLONY_NUCLEUS_MIN_TILE_GAP: 3, // fallback 2 if paint AABB too small
}
```

`COLONY_*` 是系统常量，不是策划形态表。核 HP / 乙抽打 / 丁体积价目不得改。

### 练习场

练习场污染句法课是固定观察院子：玩家在场；侧栏按维度配表后点生成。甲 / 乙 / 丙 / 丁走出击同一套实体、AI、战斗与宿主；击杀后按当前配置再刷。遭遇识别旁白默认不创建。地图课仍可不开会走的敌人，**不得**传 `liveMotion`。禁止为句法另写一套移动。句法课可挂方案 D（与出击生产同一份语法；A/B/C 冻结对照）。基体下拉读 CSV 全表，按当前孔谱过滤 `legal_occupancies`（甲看不到仅占空的概念基体）。接触词素与止损在 `liveMotion` 为真时按对照表兑现。接触下拉不得再出现打核驱散。默认仍无敌；「感受伤害」打开后才能看见乙抽打掉血。打不死个体不会被击杀，因此不会走「击杀后 0.8s 再刷」——玩家点生成才换。`RiftScene` 禁止 import `src/gym/**`。

## 边界情况

- 抽到非法基体×占位：丢弃重抽，上限 12，失败则本图少生该只并打日志，禁止用占地小人顶替「本该是漆 / 缝 / 体积」。
- 占漆放不下第 N 只：先降间距再扩候选；仍不足掷出的 N 则本图重试，禁止交不足额的出击图，禁止改画到墙上凑数，禁止把 N 钳小交差。
- 占空与迷雾：体积不得抬到视野蒙层之上。亮度不在本文终审。
- 打散重组：接触字母表不含「打散重组」。连续性 `colony` 走止损族 `scatter_rejoin`。本趟死核不回来。重组体不得改碰撞、不得封死出生→撤离。死核原地无限复活延后。
- 打不死：只允许占漆 / 占空。挥击不扣核。禁止占地挡走的打不死。门框占地固着挡门洞：不得把唯一通道永久封死；未来开放脉冲时必须有开相。
- 无害敌人：`resolveContactChannel === 'none'` 的活宿主 = 坏个体，不得刷出。
- 钉层为空（无墙缘 / 无够窄走廊）：该孔谱本图抽空，改抽另一张允许的（乙空则改丁，丁空则改乙；仍空则本图只有甲，并打日志）。I3-G 前概念基体仍为 `gym` 时，出击丁不算「无合法基体」（油膜出击占空过渡）。I3-G 后丁无概念基体可抽才算钉失败，禁止改抽乙来凑。听觉主轴仍必须恰好 1。
- 乙或丁与甲路点重叠：乙/丁让路，改钉下一候选。甲路点契约优先。

## 与已有系统的接口

- 从地图生成接收：可走路点、`WallEdgePolyline[]`、`PaintFloorPin[]`、`CorridorAabb[]`、`fragmentTypeId`（方言）、`contaminationAge`（占漆配额）、一份 `contaminationDraw`（SortieDraw）。
- 从占漆宿主接收：该宿主自己的活层相位（孔谱丙踩踏胀满相）。禁止再从地表 `clusterPulse` 读相位。
- 向 AI 发送：孔谱决定哪些五态转换可达、感知刺激钉在哪、能否 chase。甲的 `EnemySpawnData` 出击必带 `form`；`type` 在过渡期仍用 infiltrator/rewriter 表示视锥/听噪，由该 form 的感知词素派生。
- 向战斗发送：接触通道（扇形 / 邻格 / 混乱价）与止损剖面（能不能扣核、几个核）。通道以本文对照表为准；止损以查表为准。HP 事件仍归战斗。乙丙丁核 HP = 50。出击与练习场同一套读取（`liveMotion === true`）。地图课不传该开关。
- 向混乱值发送：踩踏与场内加速走既有 `addChaos`，source 建议 `'paint_step'` / `'volume_field'`，不另开隐蔽条。入账后走既有混乱条（填充长度随新 `value` 立刻更新 + 本批条上一次短促强调，见混乱 spec 规则 32a），不另开来源提示、不按 `source` 分色分词。
- 向遭遇识别旁白发送：`encounter:identified`。旁白消费此事件，不回写 AI。表面合同见 `ui-encounter-narration`。
- 向方案 D 渲染器发送：见「出击视觉」消费字段。不向 gym 路径发送。

## 对已有系统的影响

- `system-enemy-ai`：生成契约目标是「恰好 1 个听觉主轴」。五态本体保留。丙丁关掉追击。I16 生产活断言是 rewriter === 1；乙听缝尚未兑现，不进入抽样。出击甲 spawn 带 form（I3-A）。
- `system-combat`：邻格抽打、踩踏/体积不打血、按止损决定能不能扣核。甲三刀账不变。核 50 HP 仍守 K1。接触对照表与止损表在本文；战斗 spec 只指针。V3 不推翻。出击与练习场同读（I3-F）。
- `system-map-generation`：除路点外交出墙缘 / 占漆地板格 / 走廊盒，以及一份 `contaminationDraw`。规则 22 过渡期仍是恰好 1 个 rewriter；巡逻 3–4 不砍。氛围簇钉层不再交出。
- 练习场：敌人课必须仍复用出击的实体与 AI。遭遇识别旁白默认不开。句法课可挂对照渲染器 A/B/C；生产 D 住 `src/entities/form-renderers/`（I3-B）。地图课不得打开 `liveMotion`。迭代 3 接线合同 `docs/tasks/iteration-3.md`。

## 出击视觉（方案 D，DEC-084）

人选已拍板方案 D，并批准接入裂隙。合同：`docs/tasks/iteration-3.md`。像素配方住 `docs/art/contamination-forms.md`（I3-C）与甲的 `docs/art/actor-pixels.md`；本文只锁**消费哪些字段**，不复制剪影 / 簇数 / 色值。

生产渲染器住 `src/entities/form-renderers/`（I3-B）。**禁止** `RiftScene` import `src/gym/**`。A/B/C 冻结为句法课对照，不是出击标准。`infiltrator-sprite.ts` / `rewriter-sprite.ts` 是默认敌人课 / placeholder 回退，不是裂隙甲的生产路径。

**双路径收口（I5-J / DEC-ARCH-013）：** 出击 `d-mixed` 占地与句法课 / 陈列馆甲走同一份基因谱模块（`d/genome/`：节点、共享构件、违规算子、`weld`、按覆盖档选画布）。`street_wreckage` 走街具残骸语法骨架；`doorframe` 走门框语法骨架（中空开口，不是单杆+座）；残茎 / 有机残影 / 虫 / 哺乳动物 / 大号蠕虫走各自语法。算子作用在骨架上（预算渗透 1 / 改写 3 / 覆盖 5；放射只在覆盖档），然后 `weld`，然后才刷漆。**陈列馆检视会切四朝向与四个信号相。基因谱甲消费 `FormVisualPose.facing4` / `signal` / `pose.moving`（I5-N / I5-G / DEC-098）。** `attachJiaGenomeD` / `JiaGenomeVisual` 走共用 `bakeJiaGenome`（骨架 → 算子 → weld → 朝向/信号相）；浏览默认朝下 + idle，检视按需烤。画面等人检视，不要写成画面 PASS。旧 `d/jia.ts` / `jia-paint` 只留给 A/B/C 冻结对照，不是出击默认。I5-J **不**升生产 ramp、尽量不改 `RiftScene`。墙皮门框残余仍是乙，不走本条占地语法。I5-T：三种生物已进出击抽卡（灯柱 / 栏柱仍 gym）。

废止过期 FATAL：「禁止 RiftScene import 候选渲染器」「人选后再接线」「出击画面零改动」。新红线见迭代 3 任务书（每批可回退、连通、听轴恰好 1、战斗 V3、丁 depth < 50、配对不变量、地图课不得打开 `liveMotion`）。

审美人终审。迷雾下亮度人终审 PASS（2026-08-28）。agent 不得自称好看、不得代勾未过的画面。

### 出击视觉消费字段（与 I3-C 对齐）

方案 D `attach` 必须读下列字段。只换 `portfolio` 或只拿 `sense` 二选一刷渗透体/改写体 = 没做本题。头上无字。内部配方名不上屏。

| 字段 | 谁读 | 做什么（语义，不是像素） |
| ---- | ---- | ------------------------ |
| `form.substrate` | 方案 D | 剪影族 / 云种 / 漆种。概念三类禁止给甲 |
| `form.coverage` | 方案 D | 覆盖深度。甲改骨架违规预算（渗透 1 / 改写 3 / 覆盖 5），不换孔谱通道。 |
| `form.continuity` | 方案 D | 单核 / 多核 / 场的尺度。旁白不上屏本字段 |
| `form.occupancy` | 方案 D | 占地走者 / 墙皮 / 已烤簇 / 体积云，四选一 |
| `form.lexemes.motion` | AI + 方案 D + 活宿主 | 占地巡路 / 原地转面 / 固着；沿缝 / 簇栖 / 盒移或只形变。生产范围以上述能力边界为准 |
| `form.lexemes.sense` | 方案 D；旁白仅占地 | 视锥前倾 / 听噪加厚 / 窄视缝亮 / 反视核。旁白占地才上屏主感知节点 |
| `form.lexemes.rhythm` | 活宿主 + 方案 D | 生产仅常开和占漆呼吸；其他节律保留展示数据，不承诺安全窗口 |
| `form.lexemes.contact` | 方案 D 出手相；**机制**走对照表 | 禁止 DPS 词缀。出击与练习场同一套读取（I3-F） |
| `form.utteranceId` | 方案 D 可加一笔；旁白短标记 | 内部名（门还想关 / 缝里的眼 / 簇的肺 / 走廊在看你）禁止印上屏 |
| `layout.fragmentTypeId` | 方案 D 配色 ramp | 与本趟碎片抽卡同一份，禁止另写死 teal |
| 乙 `pin.attach` | 方案 D | `face` / 法线 / `seamX` / `seamY`。核钉缝坐标，禁止墙格几何中心 |
| 丁盒（`pin` volume 世界像素） | 方案 D + 活宿主 | 云跟当前盒；混乱/视野跟盒走 |
| `FormVisualPose.visibility` | 方案 D | 读 `VisibilitySystem.getVisibilityAt`。可见区内核/缝/簇/云须仍能读成「那里有一口」。亮度不在本文终审 |
| `FormVisualPose.facing4` | 方案 D 甲 | 四向直立换贴图，`GameObject.rotation === 0`。出击默认与练习场基因谱甲：`JiaGenomeVisual` 消费；浏览态只烤当前朝向（DEC-086），检视才按需烤。旧 `d/jia.ts` 只留给 A/B/C。画面等人检视。 |
| `FormVisualPose.signal` | 方案 D 甲 | `idle` / `awake` / `strike` / `inflated`。出击默认：基因谱甲已消费；`idle` 与 `strike` 至少要分；禁止四键同一套呼吸且剪影全同。固着基体不巡路滑步。旧 `clusterModeOf` 只留给 A/B/C。画面等人检视。 |

丁视觉 depth 40，必须 `< DEPTH.visionMask`（约 50）。方案 D `ready === true` 时：甲藏默认身体（与句法课候选 ready 同一语义）；宿主 `setSkipPaint`。Arcade 碰撞与 AI 保留。出击不要用练习场那颗调试核。

### 落地分批（实现事实，不是第二份规则）

合同以上文为准。下列是接线进度，关掉一项就删掉对应行，不要把过渡写回 FATAL。

| 批 | 关掉什么实现缺口 |
| -- | ---------------- |
| I3-A | 一份 `contaminationDraw`；甲 `EnemySpawnData.form` 来自抽卡，不是工厂 role 三元；宿主不再二次 `drawSortie` |
| I3-B | 生产 D 住 entities；`RiftScene` 不得 import gym |
| I3-C | 生产 HOW 就位（本文不复制） |

I3-E 已接：`RiftScene` attach 方案 D，消费上表字段；丁 depth 40 `< DEPTH.visionMask`（50）。审美人终审。迷雾下亮度人终审 PASS（2026-08-28），本文不代写细节。

`resolveStopLoss` / `resolveContactChannel` 签名与通道映射已锁在上文对照表与止损表。不要把 family 写进 `ContaminationForm`。`contact_disperse_core` 已删除，生成代码不得再引用。

**禁止（合同，不是过渡）：** 占声第五张主孔谱；给丁开打血；发明精神攻击空包；震屏 / 命中停顿 / 伤害数字；声称视觉过关；改巡逻人数来迁就抽卡配额。

## 验证标准

- 本设计结束时能验证：人能否从文档读出接触与止损是两面、止损为什么不是第五骰子、四张主孔谱各逼玩家做什么、出击视觉消费哪些字段。
- 实现后预期正面结果：出击与练习场同读接触/止损；场只能绕或等相；菌落杀一个其余还在；绕仍比杀便宜；墙后地板连通仍为 1；旁白低语能隐晦提示注意事项，不上成精确分类标签或电报缩写。
- 如果不 work 的信号：新形态只换皮仍是视锥小人；或组合出挡路的场把图切开；或玩家必须背「打不死」这个词才能玩；或渗透深度变成两刀清场；或旁白读成分类标签 / 说明书（「危险」「敌人」「注意」）/ 「识别。」日志头。

## 待验证假设

- [ ] 四张孔谱足够匹配程序关卡的丰富感（人终审）
- [ ] 占漆踩踏价能让「冲过去多拿一点」成立且不比绕更蠢
- [ ] 覆盖体以缝 / 体积出场仍能读成威胁，而不是风景
- [ ] 无新 HUD 也能分清甲乙丙丁
- [ ] 遭遇识别旁白是角色低语、隐晦、不刷屏、不读成头上名字或精确分类或电报缩写（人终审）
- [ ] 只靠核的有无/个数，玩家能在遭遇当下分清打核 / 打散重组 / 打不死（人终审；失败则考虑旁白加「场 / 菌落」短词，仍不上「打不死」）
- [ ] 丁默认连续性是场（打不死）在 gym 是否读得懂；若人觉得默认该能杀，再把丁默认连续性改成单核（那是另一次设计，本表已支持）

**人需要拍板（I8-R2）：** 占漆区间新生 3–5 / 标准 6–8 / 古老 9–12 **已过**，可开 I8-Q。旁白 20 行 **文案已过（我们→自语）**，可开 I8-N。
