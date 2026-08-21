---
status: DRAFT
created-by: design conversation（迭代 1）
created-when: 2026-08-20
last-modified-by: director agent（迭代 1 T9）
last-modified-date: 2026-08-21
interface-changed: false
interfaces-with:
  - system-enemy-ai                 # 一份五态仍由本接口的消费方拥有；词法只决定孔谱与填词，禁止第二份 FSM
  - system-combat                   # HP / 近战扇形 / 死亡事件仍归战斗；接触词素改价目表与伤害通道，不改「绕应更划算」
  - system-map-generation           # 出生钉层：路点 / 墙缘 / 簇核 / 走廊包围盒；菌落与场不得加墙
  - system-movement-vision          # 占空体积低于视野蒙层；反视读玩家视野扫核；平衡不变量来源
  - system-chaos-scavenge-extract   # 踩踏 / 场内加速混乱走既有混乱通道，不另造一条隐蔽伤害
  - ui-encounter-narration          # 本体系的识别表面（载体 / 视觉 / U1–U12）；不是独立玩法。逻辑在本文
exposes:
  - 底材（基体 × 覆盖深度）、孔谱（连续性 × 占位）、词素四槽、成句配方
  - 六件套合同（外观 / 生命期 / 移动 / 感知 / 攻击 / 死亡）——合法个体必须一次写完
  - 第一版四张主孔谱（甲占地 / 乙占墙 / 丙占漆 / 丁占空）
  - 抽卡配额与非法组合丢弃规则
  - 遭遇识别旁白：身份键、触发、限频、上屏节点、成句短标记映射
  - 事件 `encounter:identified`（载荷见实现规格；旁白消费、不回写 AI）
  - CSV：substrates / portfolios / lexemes / utterances / display-tokens → `src/generated/contamination-lexicon-data.ts`
  - 钉层：墙缘折线 / 簇核 / 走廊包围盒（由地图生成交出）
note: |
  迭代 1 设计锁（DEC-073）。遭遇识别旁白 DEC-074 仍有效。DEC-075：叙述并入设计正文。
  DEC-076：实现规格锁（字母表、CSV、钉层、乙丙丁数字、听觉主轴）。
  叙述家是 docs/design-notes/contamination-lexicon.md；本文是规则合同；
  docs/specs/ui-encounter-narration.md 是识别表面，不是独立玩法。
  外观 HOW：docs/art/contamination-forms.md。出击已接（体验未验证）。
---

# 系统设计：污染词法

> **TL;DR**: 用底材 + 孔谱 + 词素生成海量可落地的污染体形态；成句是少数具名遭遇。叙述家是设计正文 `contamination-lexicon.md`；本文是规则合同（含遭遇识别旁白的身份键、触发、限频、上屏节点、成句标记映射，以及 DEC-076 实现规格：CSV、字母表、方言、钉层、乙丙丁数字）；`ui-encounter-narration.md` 是识别表面（载体 / U1–U12），不是独立玩法。出击已接甲填法 + 乙丙丁宿主 + 旁白；体验未验证。

## 概述

裂隙已经按锚 + 种子生成。敌人若仍是两种人形剖面，程序关卡的丰富对不上。污染词法把「形态」收成可学习的语法，而不是图鉴里的 324 个名字。

服务体验支柱 2（贪婪与撤退：绕 / 冲 / 杀都要算得清）与支柱 1（持续低频压力，不是随机怪物）。世界观：污染是改写不是破坏；同一时空差异来自基体，污染方言来自风格锚。`world.md` 的渗透 / 改写 / 覆盖仍是覆盖深度，不是三种职业。

**出击已接（体验未验证）。** 甲的五态仍归 `system-enemy-ai.md`。乙丙丁无第二份状态机。叙述家（问题、符文之语启发、维度爆炸、人点名的轴、遭遇识别旁白为什么存在）见 `docs/design-notes/contamination-lexicon.md`，本文不重复聊天记录。识别表面（载体 / 参考锚点 / 视觉 / U1–U12）见 `docs/specs/ui-encounter-narration.md`。

渗透体 / 改写体 = 孔谱甲的两种填法。覆盖体不以第三种人形出场。遭遇识别旁白是本体系的识别面，不是独立玩法。

## 状态模型

实现后生成器应对每个出生者物化下面这份描述（字段名可在 CSV / codegen 时改，语义不许空）：

```typescript
interface ContaminationForm {
  substrate: 'organic_remnant' | 'lamp_pillar' | 'doorframe' | 'wall_rust' | 'fungal_mat' | 'oil_film';
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

运行时生命期、察觉度、HP 仍分别由 AI / 战斗系统拥有。词法不另开一套状态机。

## 规则

1. **组合制度**：底材 = 基体 × 覆盖深度。孔谱 = 连续性 × 占位。词素四槽从该孔谱字母表 ∩ 本图方言 ∩ 覆盖深度开孔中抽取。禁止把运动 / 感知 / 节律 / 接触当作与占位无关的独立骰子。
2. **六件套**：合法个体必须一次写完外观、生命期、移动、感知、攻击、死亡。禁止输出「待美术决定」或没有外观的纯过程。
3. **一份五态**：禁止为孔谱或填法复制 FSM。不可达状态（例如占漆无地板追击）是孔谱把某些转换关掉，不是新状态名。
4. **连通 FATAL**：菌落与场不得增加碰撞墙。只有单核、裂片可以占地且挡走。装饰层 / 漆 / 体积不得切开墙后可走地板。
5. **基体亲和**：基体只允许表内占位与连续性。非法组合丢弃重抽。第一版基体封闭为：有机残影、灯柱、门框、墙锈、菌毯、油膜。残余动词在渗透深度必须可读。
6. **覆盖开孔**：渗透 = 一条主感知通道 + 运动被残余动词锁一半。改写 = 可双通道，运动可偏离残余。覆盖 = 残余关闭，成句主要发生在这里。
7. **占相位并入节律**。诱饵体不是自由连续性，只作成句。
8. **合法孔谱矩阵**以设计正文 §4.2 为准。场 × 占地、菌落挡走、菌落/场 × 满图占空或占声 = 非法。
9. **第一版只教四张主孔谱**：甲单核占地、乙单核占墙、丙菌落或场占漆、丁场或单核占空。占声不进主课。裂片占地可延后。
10. **孔谱甲**保留现有对照：地板寻路、视或听写入察觉度、看见才锁定追击、贴身扇形默认三刀。I1–I6 适用于可追击剖面。
11. **孔谱乙**禁止穿开阔地追击。攻击默认邻格抽打。挥击必须打到缝核。不占走廊碰撞。
12. **孔谱丙**钉崩坏簇；主感知是触地；无追击锁定；踩踏或胀满相位收混乱；漆不改碰撞。与 DEC-069/070/071 的簇烤漆、整团胀缩咬合，不另做小人精灵当默认外观。
13. **孔谱丁**体积深度必须低于视野黑暗蒙层。可反视或领域察觉。打 = 驱散核。不默认同款近战。
14. **自动改写**：三刀 + 占墙 → 邻格抽打。三刀 + 占漆/占空 → 打核驱散或降强度。巡路 + 占墙 → 巡墙图。视锥 + 占漆 → 触地主通道。
15. **词素必须改六件套至少一件**，否则逐出字母表。交为空则重抽，禁止用最近非法值凑。
16. **抽卡配额**（每图）：甲 2–3；乙或丁 1；丙 0–1（无簇则抽空）。每图恰好一个听觉主轴（甲的听觉填法或乙的听缝），不是两种 AI。
17. **出生钉层**：占地 → 现有路点契约；占墙 → 墙缘折线；占漆 → 簇核且可走地板；占空 → 走廊包围盒。
18. **战斗成功标准不变**：绕应通常比杀便宜。接触词素改代价种类，禁止做成词缀 DPS。
19. **成句第一版四句**：门还想关、缝里的眼、簇的肺、走廊在看你。配方见设计正文 §6。内部配方名禁止印上屏。游戏内名称走遭遇识别旁白的分节点拼接（覆盖 + 基体 + 占位），成句另加短行为标记。禁止传奇口吻、禁止头上名字。双占位成句第二批。标记映射见下文「遭遇识别旁白」。
20. **策划数据**实现时走 CSV → codegen。禁止在代码里手写形态表再反向导出。系统常量除外。
21. **世界可读仍是第一课**（缝的核、簇的胀缩、体积的相）。遭遇识别旁白是强化识别的 P1，不是替代、不是图鉴、不是后台配装板。逻辑以本文「遭遇识别旁白」节为准；载体 / 视觉 / U1–U12 见 `docs/specs/ui-encounter-narration.md`；叙述见设计正文 §7。
22. **遭遇身份键**（限频用，不上屏）：成句用 `utteranceId`。无名变体用 `coverage + substrate + occupancy + continuity`；占地再加主感知词素。不把运动 / 节律 / 接触四槽编进键。
23. **遭遇触发**：甲占地 / 乙占墙 = 看见该个体身体（`getVisibilityAt` > 0）。丙占漆 = 踩该漆或视野扫到该簇核。丁占空 = 进入体积或视野扫到核。持续留在可识别里 = 同一次遭遇，不重复触发。
24. **遭遇限频**：同身份键本趟 60s；任意身份行间隔 ≥ 2.5s；同时 1 行；与混乱阈值重叠则阈值优先、这次作废不补打；出击结束清空冷却表。
25. **事件**：通过限频的一次识别发出 `encounter:identified`。载荷见下文「实现规格 · 事件」。遭遇识别旁白消费此事件，不回写 AI。
26. **听觉主轴**：实现后每图恰好一个主感知为听噪的个体（甲的听噪填法，或乙的听缝）。取代活代码「恰好 1 个 `rewriter`」。撤离门仍必须是甲 + 视锥，不得担任听觉主轴。0 个或 ≥2 个 = 坏图，重试；禁止把全部甲改成视锥糊过去。
27. **油膜占空**：基体「油膜」合法占位为占漆或占空（否则孔谱丁没有合法基体）。连续性：占漆为菌落或场或单核；占空为场或单核。设计正文 §3.1 同步此扩。

## 玩家交互

- 输入：不新增键位。玩家仍用走位、停步、挥击、工具做绕 / 冲 / 杀。遭遇识别旁白无「知道了」、无关闭键。
- 世界反馈：孔谱必须在世界上可读（路点身体、缝核、簇胀缩、体积的相）。察觉度仍可走既有屏缘干涉（仅对仍有察觉度的个体）。
- **遭遇识别旁白**：强化「遭遇了什么」，禁止每个个体头上挂名。打开方式不是按键——满足遭遇条件且通过限频即出现。载体、画面占用、视觉、U1–U12 见 `docs/specs/ui-encounter-narration.md`。身份键、触发、限频、上屏节点、成句标记映射以本节下「遭遇识别旁白」为准。
- 审美人终审。

## 遭遇识别旁白（逻辑）

叙述见设计正文 §7。本节约规则。表面合同见 `docs/specs/ui-encounter-narration.md`（不要把视觉 HOW 当规则真相）。

### 身份键

限频用，不上屏。

- 有成句：`utteranceId`
- 无名变体：`coverage + substrate + occupancy + continuity`；占地时再加上主感知词素（否则渗透体与改写体撞键）。不把运动 / 节律 / 接触四槽全编进键，否则几乎永不「相同」。

### 遭遇触发

第一次进入可识别，且通过限频，才算一次遭遇。

| 孔谱 | 可识别 |
| ---- | ------ |
| 甲占地 / 乙占墙 | 对该个体 `getVisibilityAt` > 0（与身体显隐同一套） |
| 丙占漆 | 玩家所在格踩在该漆上，或视野扫到该簇核 |
| 丁占空 | 玩家进入体积，或视野扫到核 |

持续留在可识别里（一直看着同一只）= **同一次遭遇**，不重复触发。必须先掉出可识别（看不见 / 离开体积 / 离开漆），再进来，才可能是下一次遭遇，且仍吃冷却。

### 限频

1. 同一身份键：本趟出击冷却 **60s**（从该行开始显示起算）。冷却内静默。
2. 任意身份：两条记录之间至少空 **2.5s**（含上一条淡出）。
3. 同时只允许 **1 行**。
4. 与混乱阈值全屏层重叠：阈值优先；阈值结束后若仍在冷却窗内则**作废这次**，不补打。
5. 出击结束清空冷却表。不进存档。

### 上屏节点

骨架：`识别。[覆盖深度] [基体] [占位]`。占地加主感知节点。节点分开展示，禁止粘成复合传奇名。「识别。」是设备骨架，不是第四个身份词。

| 节点 | 何时出现 | 来源 |
| ---- | -------- | ---- |
| 覆盖深度 | 每次 | `coverage` |
| 基体 | 每次 | `substrate` |
| 占位 | 每次 | `occupancy` |
| 占地主感知 | 仅占地 | 主感知词素 |
| 成句短标记 | 仅成句 | 见下表；内部配方名不上屏 |

整行（含「识别。」）按详细描述计不超过 40 字。无人称。禁止「你」、感叹号、软件词。

### 成句标记映射

| 内部配方（禁止上屏） | 上屏短标记 |
| -------------------- | ---------- |
| 门还想关 | 开合 |
| 缝里的眼 | 缝视 |
| 簇的肺 | 呼吸 |
| 走廊在看你 | 反视 |

### 事件

通过限频的一次识别发出 `encounter:identified`。遭遇识别旁白消费此事件，不回写 AI（看旁白不会被发现）。载荷见「实现规格 · 事件」。

练习场 / 净化点不创建本表面。

## 数值结构

甲的可追击剖面继续服从 `system-enemy-ai` 的 I1–I6 与 `data/enemies.csv`（75 HP = 三刀）。乙 / 丙 / 丁的核与混乱价如下；绕开通常为 0 价。数字实现进 `GAME_CONSTANTS.CONTAMINATION`（系统常量，不是策划形态表）。形态组合仍走 CSV。

| 参数 | 值 | 调节目的 |
| ---- | -- | -------- |
| 每图甲 | 2–3 | 会走路的对照压力；太少则潜行课消失 |
| 每图乙或丁 | 恰好 1（互斥） | 改一条路的走法；太多则看不懂 |
| 每图丙 | 0–1（无簇则 0） | 最显眼的簇变成有价的地 |
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

清核仍走既有 `CHAOS.COMBAT_BONUS`(5) 与挥击噪声。接触词素禁止变成 DPS 词缀。

## Schema（CSV 合同）

禁止把 324 填法手写进 `enemies.csv`。`enemies.csv` 只描述可追击剖面数值（渗透体 / 改写体）。形态是生成结果。成句是具名配方行，不是随机种子碰巧撞上。

源：`data/contamination-*.csv` → `src/generated/contamination-lexicon-data.ts`（扩展 `tools/csv-codegen/generate.mjs`）。字段内禁止 ASCII 逗号（与现有 codegen 一致）；多值用 `|`。

### `data/contamination-substrates.csv`

| 列 | 含义 |
| -- | ---- |
| id | `organic_remnant` / `lamp_pillar` / `doorframe` / `wall_rust` / `fungal_mat` / `oil_film` |
| display_token | 上屏：有机残影 / 灯柱 / 门框 / 墙锈 / 菌毯 / 油膜 |
| residual_verb | 渗透深度必须可读的残余动词 |
| legal_occupancies | `floor\|wall\|paint\|volume` 子集 |
| legal_continuities | `monolith\|shards\|colony\|field` 子集 |

六行必须都在。缺行 = 构建失败。

基体亲和（生成器丢弃非法交）：

| id | 合法占位 | 合法连续性 |
| -- | -------- | ---------- |
| organic_remnant | floor | monolith, shards |
| lamp_pillar | floor | monolith |
| doorframe | wall, floor | monolith |
| wall_rust | wall | monolith, colony |
| fungal_mat | paint | colony, field |
| oil_film | paint, volume | monolith, colony, field |

门框占地时运动必须固着，且不得永久封死出生→撤离的唯一通道。

### `data/contamination-portfolios.csv`

| 列 | 含义 |
| -- | ---- |
| id | `jia` / `yi` / `bing` / `ding` |
| display_token | 占地 / 占墙 / 占漆 / 占空 |
| continuity | 默认连续性 |
| occupancy | floor / wall / paint / volume |
| legal_continuities | 该主课允许的连续性 |
| pin_layer | waypoints / wall_edge / cluster_core / corridor_aabb |
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
| rewrite_to | 可空。格式 `yi:contact_adjacent_strike;bing:contact_disperse_core;ding:contact_disperse_core` |

广播不进第一版字母表。

### `data/contamination-utterances.csv`

四行，id 稳定英文；`internal_label` 禁止上屏。

| id | 内部名（禁上屏） | on_screen_mark | 底材 / 孔谱 / 词素 |
| -- | ---------------- | -------------- | ------------------ |
| door_still_closing | 门还想关 | 开合 | 渗透 · 门框 · yi 单核占墙 · 固着 · 触地 · 脉冲 · 邻格抽打 |
| eye_in_the_seam | 缝里的眼 | 缝视 | 覆盖 · 墙锈 · yi 单核占墙 · 固着 · 窄视 · 常开 · 邻格抽打 |
| cluster_lung | 簇的肺 | 呼吸 | 改写 · 菌毯 · bing 场占漆 · 簇栖 · 触地 · 随簇呼吸 · 踩踏混乱 |
| corridor_watching | 走廊在看你 | 反视 | 覆盖 · 油膜 · ding 场占空 · 固着 · 反视 · 随天空相 · 场内加速混乱 |

成句命中优先于无名抽卡：本图若抽中该孔谱，按配额与方言先检查成句配方是否可钉；不能钉则走无名变体。

### `data/contamination-display-tokens.csv`

覆盖深度、占位、设备骨架。基体与词素的上屏词住在各自表的 `display_token`，本表不重复。

| id | kind | display_token |
| -- | ---- | ------------- |
| coverage_infiltrate | coverage | 渗透 |
| coverage_rewrite | coverage | 改写 |
| coverage_overwrite | coverage | 覆盖 |
| occupancy_floor | occupancy | 占地 |
| occupancy_wall | occupancy | 占墙 |
| occupancy_paint | occupancy | 占漆 |
| occupancy_volume | occupancy | 占空 |
| device_prefix | device | 识别。 |

代码禁止写死整句中文。骨架「识别。」只来自 `device_prefix`。

## 实现规格（DEC-076，code 不得再猜）

数字只锁在本文「数值结构」与将落地的 `GAME_CONSTANTS.CONTAMINATION`。设计正文只指向本文，禁止第二份数字表。外观 HOW：`docs/art/contamination-forms.md`。

### 字母表（每孔每槽 3 个；交空则重抽）

孔谱甲 `jia`（占地）：
- 运动：`motion_patrol` 巡路、`motion_turn` 转面、`motion_coalesce` 凝聚
- 感知：`sense_cone` 视锥、`sense_hear` 听噪、`sense_narrow` 窄视
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
- 节律：`rhythm_cluster` 随簇呼吸、`rhythm_open` 常开、`rhythm_pulse` 脉冲
- 接触：`contact_step_chaos` 踩踏混乱（抽到三刀改写为 `contact_disperse_core`）

孔谱丁 `ding`（占空）：
- 运动：`motion_anchor` 固着、`motion_wind` 随风、`motion_trail` 拖尾
- 感知：`sense_reverse` 反视、`sense_domain` 领域、`sense_scent` 嗅混乱
- 节律：`rhythm_sky` 随天空相、`rhythm_pulse` 脉冲、`rhythm_open` 常开
- 接触：`contact_volume_chaos` 场内加速混乱（抽到三刀改写为 `contact_disperse_core`）

现有对照必须能被生成器表示（测试夹具，不是手写第二套表）：
- 渗透体 = 有机残影 × 渗透 × 甲 × 视锥 × 常开 × 三刀
- 改写体 = 有机残影 × 改写 × 甲 × 听噪 × 常开 × 三刀

覆盖深度开孔：渗透 = 一条主感知，运动被残余动词锁一半。改写 = 可双通道。覆盖 = 残余关闭。实现：渗透时若基体有残余运动锁（门框→固着、灯柱→固着），覆盖运动槽。

### 方言（按 `fragmentTypeId`，同一趟一种方言）

风格锚先抽碎片类型，再给字母表权重。禁止一图动物园。未启用的碎片类型仍写权重，启用后直接用。

| fragmentTypeId | 基体权重（高→低） | 孔谱权重 | 禁用或降权词素 |
| -------------- | ----------------- | -------- | -------------- |
| frag-outdoor | fungal_mat, oil_film, organic_remnant | 丙常见；乙或丁偏丁 | 灯柱 / 门框降权 |
| frag-clinic | lamp_pillar, doorframe, wall_rust | 乙常见；丙较少 | 菌毯降权；随风降权 |
| frag-metro | wall_rust, oil_film, lamp_pillar, doorframe | 乙与丁均可 | 菌毯中权；簇栖中权 |
| frag-library | doorframe, wall_rust, organic_remnant | 乙常见 | 随风降权（未启用） |
| frag-residential | organic_remnant, doorframe, oil_film | 甲对照为主 | 未启用；启用前禁止当生产路径 |

权重是抽卡偏置，不是禁令（除基体亲和非法交仍丢弃）。覆盖深度不按碎片改写「覆盖体变第三种人形」。

### 抽卡顺序

1. 读本图 `fragmentTypeId` 与 `ClusterOrganism[]`（烤地之后）。无簇则丙配额 = 0。
2. 掷乙或丁（1 只）。户外偏丁，临床偏乙，地铁按种子。
3. 掷甲 2–3。撤离门那条必须是甲 + `sense_cone`。
4. 掷丙 0–1，钉最显眼簇（`breathAmp` 最大者；并列取核更靠近贪婪薪柴的）。
5. 听觉主轴：若乙的感知抽中听噪，则所有甲不得再抽听噪。若乙不是听噪（或本图是丁），则甲里恰好一只听噪（改写体对照），其余甲不得听噪。
6. 每只：底材 ∩ 孔谱 ∩ 方言 ∩ 覆盖开孔 → 四槽。交空重抽，上限 12。失败则少生该只并 `console.warn`，禁止用占地小人顶替漆/缝/体积。
7. 成句：本图孔谱匹配时，若钉层允许，优先用配方行替换无名抽卡（每句每图最多 1 次）。

### 钉层（地图生成必须交出）

实现后扩 `GeneratedRiftLayout`（或并列结构由同一 `generateRiftLayout` 返回）。墙后可走格四连通分量必须仍为 1。

```typescript
interface WallEdgePolyline {
  readonly tiles: readonly { col: number; row: number }[]; // 墙格且四邻有地板
  readonly strikeFloors: readonly { col: number; row: number }[]; // 抽打只进这些地板
}

interface ClusterCorePin {
  readonly organismIndex: number;
  readonly cx: number; // px
  readonly cy: number;
  readonly floorCol: number;
  readonly floorRow: number; // 必须可走；禁墙/虚空
}

interface CorridorAabb {
  readonly minCol: number;
  readonly minRow: number;
  readonly maxCol: number;
  readonly maxRow: number;
  readonly coreCol: number;
  readonly coreRow: number; // 可打核，可走
}
```

- 占地：现有巡逻路点（可走、出生可达）。甲挡走，碰撞约 20。
- 占墙：墙缘折线。抽打只进 `strikeFloors`。核画在墙格，不占走廊碰撞。
- 占漆：`bakeGround` 的 `ClusterOrganism` 核。无核则丙不生。
- 占空：一段窄可走带的包围盒（宽度 ≤ 4 格的通道优先）。体积深度必须 `< DEPTH.visionMask`（约 50）；建议世界层 depth 40。

钉失败：本图少生该只并打日志。

### 五态可达性（禁止新 FSM）

| 孔谱 | PATROL | SUSPICIOUS / ALERT | CHASE | RETURN |
| ---- | ------ | ------------------ | ----- | ------ |
| 甲 | 路点 | 现有 | 地板寻路；看见才锁定 | 现有 |
| 乙 | 沿墙折线或固着 | 邻格刺激可升 | 禁止穿开阔地。所谓追 = 沿墙滑到最近邻接缝 | 沿墙回钉点 |
| 丙 | 无路点 | 无 | 无追击锁定 | 无 |
| 丁 | 无 | 反视：玩家视野扫核才从睡眠/固着进入警觉类 | 无地板追击 | 核失视则休眠 |

屏缘干涉：仅 `detection_pulse === true`（甲、乙）。丙、丁第一版不接屏缘，避免读成「地上也有一只人」。

甲仍守 I1–I6。乙/丙/丁不追击，不把 I3 理解成「核必须比玩家慢走路」——它们多数固着。

### 事件载荷

```typescript
// GameEvent.ENCOUNTER_IDENTIFIED = 'encounter:identified'
{
  identityKey: string;
  nodes: readonly {
    kind: 'coverage' | 'substrate' | 'occupancy' | 'sense' | 'utterance_mark';
    tokenId: string; // CSV id；上屏用 display_token
  }[];
  utteranceId?: string;
}
```

身份键：成句 = `utteranceId`；无名 = `coverage|substrate|occupancy|continuity`，占地再拼 `|sense`。

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
}
```

### 练习场

敌人课必须复用出击实体、AI、词法生成物。遭遇识别旁白默认不创建。地图课仍可不开敌人。禁止为词法另写一套移动或外形。

## 边界情况

- 抽到非法基体×占位：丢弃重抽，上限 12，失败则本图少生该只并打日志，禁止用占地小人顶替「本该是漆 / 缝 / 体积」。
- 本图无簇：丙配额变 0，不把丙改画到墙上凑数。
- 占空与迷雾：体积不得抬到视野蒙层之上。亮度不在本文终审。
- 打散重组：第一版字母表不含「打散重组」接触；若成句外抽到，改写为打核驱散。重组体若日后开放，仍须可走可达，且不得封死出生→撤离。
- 门框占地固着挡门洞：不得把唯一通道永久封死；脉冲必须有开相。
- 钉层为空（无墙缘 / 无够窄走廊）：该孔谱本图抽空，改抽另一张允许的（乙空则改丁，丁空则改乙；仍空则本图只有甲，并打日志）。听觉主轴仍必须恰好 1。
- 乙或丁与甲路点重叠：乙/丁让路，改钉下一候选。甲路点契约优先。

## 与已有系统的接口

- 从地图生成接收：可走路点、`WallEdgePolyline[]`、`ClusterCorePin[]`、`CorridorAabb[]`、`fragmentTypeId`（方言）。
- 从地表接收：崩坏簇活层相位（孔谱丙踩踏胀满相）。
- 向 AI 发送：孔谱决定哪些五态转换可达、感知刺激钉在哪、能否 chase。甲的 `EnemySpawnData.type` 在过渡期仍可用 infiltrator/rewriter 表示视锥/听噪；实现后应带 `form` 描述。
- 向战斗发送：接触通道（扇形 / 邻格 / 混乱价 / 打核）。HP 事件仍归战斗。乙丙丁核 HP = 50。
- 向混乱值发送：踩踏与场内加速走既有 `addChaos`，source 建议 `'paint_step'` / `'volume_field'`，不另开隐蔽条。
- 向遭遇识别旁白发送：`encounter:identified`。旁白消费此事件，不回写 AI。表面合同见 `ui-encounter-narration`。

## 对已有系统的影响

- `system-enemy-ai`：生成契约目标是「恰好 1 个听觉主轴」。五态本体保留。丙丁关掉追击。过渡期（DEC-077）活断言仍是 rewriter === 1；乙听缝不另占该名额。
- `system-combat`：增加邻格抽打、打核驱散、踩踏/体积不打血。甲三刀账不变。核 50 HP 仍守 K1。
- `system-map-generation`：除路点外交出墙缘 / 簇核 / 走廊盒。规则 22 过渡期仍是恰好 1 个 rewriter。
- 练习场：敌人课必须仍复用出击的实体与 AI。遭遇识别旁白默认不开。

## 验证标准

- 本设计结束时能验证：人能否从文档读出「为什么不是八个独立骰子」以及四张主孔谱各逼玩家做什么。
- 实现后预期正面结果：同一程序岛上出现可学习的非人形占位；玩家仍能用绕 / 冲 / 杀算账；墙后地板连通仍为 1。
- 如果不 work 的信号：新形态只换皮仍是视锥小人；或组合出挡路的场把图切开；或玩家必须背名字才能玩。

## 待验证假设

- [ ] 四张孔谱足够匹配程序关卡的丰富感（人终审）
- [ ] 占漆踩踏价能让「冲过去多拿一点」成立且不比绕更蠢
- [ ] 覆盖体以缝 / 体积出场仍能读成威胁，而不是风景
- [ ] 无新 HUD 也能分清甲乙丙丁
- [ ] 遭遇识别旁白能加强识别且不刷屏、不读成头上名字（人终审）
