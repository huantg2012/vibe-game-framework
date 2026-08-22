---
status: DRAFT
created-by: design conversation（迭代 1）
created-when: 2026-08-20
last-modified-by: design agent（DEC-083 接触提纯 / 止损衍生）
last-modified-date: 2026-08-22
interface-changed: true
interfaces-with:
  - system-enemy-ai                 # 一份五态仍由本接口的消费方拥有；句法只决定孔谱与填词，禁止第二份 FSM
  - system-combat                   # HP / 近战扇形 / 死亡事件仍归战斗；接触词素改价目表与伤害通道；止损查表决定能不能扣核。不改「绕应更划算」
  - system-map-generation           # 出生钉层：路点 / 墙缘 / 簇核 / 走廊包围盒；菌落与场不得加墙
  - system-movement-vision          # 占空体积低于视野蒙层；反视读玩家视野扫核；平衡不变量来源
  - system-chaos-scavenge-extract   # 踩踏 / 场内加速混乱走既有混乱通道，不另造一条隐蔽伤害
  - ui-encounter-narration          # 本体系的识别表面（载体 / 视觉 / U1–U12）；不是独立玩法。逻辑在本文
exposes:
  - 底材（基体 × 覆盖深度）、孔谱（连续性 × 占位）、词素四槽、成句配方
  - 止损衍生表（连续性 × 覆盖深度 → family / core_policy；不是第五词素槽）
  - 六件套合同（外观 / 生命期 / 移动 / 感知 / 攻击 / 死亡）——合法个体必须一次写完；攻击通道必须非空
  - 第一版四张主孔谱（甲占地 / 乙占墙 / 丙占漆 / 丁占空）
  - 抽卡配额与非法组合丢弃规则
  - 遭遇识别旁白：身份键、触发、限频、上屏节点、成句短标记映射
  - 事件 `encounter:identified`（载荷见实现规格；旁白消费、不回写 AI）
  - CSV：substrates / portfolios / lexemes / stop-loss / utterances / display-tokens → `src/generated/contamination-lexicon-data.ts`
  - CSV `enabled_scope`（sortie / gym）；出击白名单 = sortie 行（本轮旧六种）
  - 接触词素对照表（打血 / 混乱 / 视野）；gym 读词素，出击本轮按宿主 kind
  - 钉层：墙缘折线 / 簇核 / 走廊包围盒（由地图生成交出）
note: |
  迭代 1 设计锁（DEC-073）。正式名「污染句法」（DEC-078；旧称「污染词法」）。遭遇识别旁白 DEC-074 仍有效。DEC-075：叙述并入设计正文。
  DEC-076：实现规格锁（字母表、CSV、钉层、乙丙丁数字、听觉主轴）。
  DEC-083：接触槽提纯为「它怎么伤你」；打核驱散退出接触字母表；止损从连续性 × 覆盖深度查表。
  叙述家是 docs/design-notes/contamination-lexicon.md；本文是规则合同；
  docs/specs/ui-encounter-narration.md 是识别表面，不是独立玩法。
  外观 HOW：docs/art/contamination-forms.md。出击已接（体验未验证）。
  迭代 2（DEC-079 / DEC-080）：第一轮 gym 三方案已交。第二轮方案 D 混装；R2-D1 已写入概念基体 CSV、接触对照表、enabled_scope。出击画面仍为占位。字段→像素映射未锁进出击。
---

# 系统设计：污染句法

> **TL;DR**: 用底材 + 孔谱 + 词素生成海量可落地的污染体形态；成句是少数具名遭遇。接触词素只表达「它怎么伤你」；止损（怎么终结这次遭遇）从连续性 × 覆盖深度查表，不是第五骰子。叙述家是设计正文 `contamination-lexicon.md`；本文是规则合同（含遭遇识别旁白的身份键、触发、限频、上屏节点、成句标记映射，以及 DEC-076 / R2-D1 / DEC-083 实现规格：CSV、字母表、方言、钉层、乙丙丁数字、接触通道、止损表、出击范围列）；`ui-encounter-narration.md` 是识别表面（载体 / U1–U12），不是独立玩法。出击已接甲填法 + 乙丙丁宿主 + 旁白；体验未验证。迭代 2 第二轮：方案 D 在 gym 混装；概念基体 CSV 已写入，出击抽卡仍只抽 `enabled_scope=sortie` 的旧六种。止损与接触提纯先在 gym 兑现，出击本轮仍按宿主 kind 硬编码。

## 概述

裂隙已经按锚 + 种子生成。敌人若仍是两种人形剖面，程序关卡的丰富对不上。污染句法把「形态」收成可学习的语法，而不是图鉴里的 324 个名字。

服务体验支柱 2（贪婪与撤退：绕 / 冲 / 杀都要算得清）与支柱 1（持续低频压力，不是随机怪物）。世界观：污染是改写不是破坏；同一时空差异来自基体，污染方言来自风格锚。`world.md` 的渗透 / 改写 / 覆盖仍是覆盖深度，不是三种职业。

**出击已接（体验未验证）。** 甲的五态仍归 `system-enemy-ai.md`。乙丙丁无第二份状态机。叙述家（问题、符文之语启发、维度爆炸、人点名的轴、遭遇识别旁白为什么存在）见 `docs/design-notes/contamination-lexicon.md`，本文不重复聊天记录。识别表面（载体 / 参考锚点 / 视觉 / U1–U12）见 `docs/specs/ui-encounter-narration.md`。

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
12. **孔谱丙**钉崩坏簇；主感知是触地；无追击锁定；踩踏或胀满相位收混乱；漆不改碰撞。与 DEC-069/070/071 的簇烤漆、整团胀缩咬合，不另做小人精灵当默认外观。菌落 = 打散重组；场 = 打不死。接触槽只有踩踏混乱。
13. **孔谱丁**体积深度必须低于视野黑暗蒙层。可反视或领域察觉。攻击通道永远是体积场（混乱 + 视野）。不默认同款近战。禁止精神攻击空包，禁止给丁开打血。单核 = 止损族打核（核 HP 50）；场 = 打不死（挥击不扣核、不发 `ENEMY_DAMAGED`）。打不死时反视读「视野扫进体积 / 扫到相点」，相点不是可打核。
14. **自动改写**：三刀 + 占墙 → 邻格抽打。三刀 + 占漆 → 踩踏混乱。三刀 + 占空 → 场内加速混乱。巡路 + 占墙 → 巡墙图。视锥 + 占漆 → 触地主通道。禁止改写成打核驱散。
15. **词素必须改六件套至少一件**，否则逐出字母表。接触词素必须改攻击件，禁止再改死亡。交为空则重抽，禁止用最近非法值凑。止损不是词素，不走本条；死亡件由规则 30 的查表填写。
16. **抽卡配额**（每图）：甲 2–3；乙或丁 1；丙 0–1（无簇则抽空）。每图恰好一个听觉主轴（甲的听觉填法或乙的听缝），不是两种 AI。
17. **出生钉层**：占地 → 现有路点契约；占墙 → 墙缘折线；占漆 → 簇核且可走地板；占空 → 走廊包围盒。
18. **战斗成功标准不变**：绕应通常比杀便宜。接触词素改代价种类，禁止做成词缀 DPS。打不死正面支撑本条。更脆禁止变成「杀了更划算」（不得减刀数、不得降核 HP）。
19. **成句第一版四句**：门还想关、缝里的眼、簇的肺、走廊在看你。配方见设计正文 §6。内部配方名禁止印上屏。游戏内名称走遭遇识别旁白的分节点拼接（覆盖 + 基体 + 占位），成句另加短行为标记。禁止传奇口吻、禁止头上名字。双占位成句第二批。标记映射见下文「遭遇识别旁白」。簇的肺与走廊在看你都是场，止损 = 打不死。
20. **策划数据**实现时走 CSV → codegen。禁止在代码里手写形态表再反向导出。系统常量除外。止损查表是闭表（9 行），仍走 CSV → codegen，禁止在代码里另写一份 family 映射。
21. **世界可读仍是第一课**（缝的核、簇的胀缩、体积的相、可打核的有无与个数）。遭遇识别旁白是强化识别的 P1，不是替代、不是图鉴、不是后台配装板。逻辑以本文「遭遇识别旁白」节为准；载体 / 视觉 / U1–U12 见 `docs/specs/ui-encounter-narration.md`；叙述见设计正文 §7。
22. **遭遇身份键**（限频用，不上屏）：成句用 `utteranceId`。无名变体用 `coverage + substrate + occupancy + continuity`；占地再加主感知词素。不把运动 / 节律 / 接触四槽编进键。止损不另进键：它已由 `continuity × coverage` 决定；再加一层会让限频几乎永不命中。旁白不上屏止损术语。
23. **遭遇触发**：甲占地 / 乙占墙 = 看见该个体身体（`getVisibilityAt` > 0）。丙占漆 = 踩该漆或视野扫到该簇核。丁占空 = 进入体积或视野扫到核（打不死时「核」读相点，不是可打核）。持续留在可识别里 = 同一次遭遇，不重复触发。
24. **遭遇限频**：同身份键本趟 60s；任意身份行间隔 ≥ 2.5s；同时 1 行；与混乱阈值重叠则阈值优先、这次作废不补打；出击结束清空冷却表。
25. **事件**：通过限频的一次识别发出 `encounter:identified`。载荷见下文「实现规格 · 事件」。遭遇识别旁白消费此事件，不回写 AI。
26. **听觉主轴**：实现后每图恰好一个主感知为听噪的个体（甲的听噪填法，或乙的听缝）。取代活代码「恰好 1 个 `rewriter`」。撤离门仍必须是甲 + 视锥，不得担任听觉主轴。0 个或 ≥2 个 = 坏图，重试；禁止把全部甲改成视锥糊过去。
27. **油膜只占漆（练习场 / CSV）**：`oil_film.legal_occupancies` 仅为 `paint`。废止 DEC-076 第 8 条「否则丁无基体」的占空扩权。孔谱丁在练习场的合法基体是概念三类：`sound_echo` / `light_scatter` / `space_interval`（仅 `volume`）。出击视图另见配对不变量：概念基体未对出击开放时，油膜仍占 `paint|volume`，丁继续抽油膜占空。
28. **出击范围**：CSV 列 `enabled_scope` 为 `sortie` 或 `gym`。出击 `drawSortie` 只抽 `sortie` 行。练习场句法课读全表，并按当前孔谱过滤 `legal_occupancies`。禁止把 `gym` 行抽进裂隙。
29. **配对不变量**：概念基体任一行 `enabled_scope=sortie` ⟺ 油膜出击视图不占 `volume`。翻其中一半开关必须同一次提交翻另一半。禁止只收回油膜占空、却让概念基体仍停在 `gym`（裂隙丁会改抽乙）。
30. **止损衍生（DEC-083）**：止损不是词素、不抽卡、不进身份键。查 `data/contamination-stop-loss.csv`：键 = `continuity + coverage`，得到 `family`（`core_strike` / `scatter_rejoin` / `unkillable`）与 `core_policy`（`exposed` / `standard` / `obscured` / `none`）。occupancy 必须落在该行 `legal_occupancies`。`block_walk === true` 禁止 `unkillable`。裂片行不进本表（延后）。接触槽不得再表达止损。
31. **无害禁止**：任意合法个体 `resolveContactChannel` 不得为 `'none'`。丙即使 `family=unkillable` 仍走踩踏混乱；丁即使 `family=unkillable` 仍走体积混乱 + 视野。gym 侧栏不得再提供 `contact_disperse_core`。
32. **打不死连通**：`unkillable` 只允许占漆或占空。禁止占地挡走、禁止占墙整面当打不死。门框占地固着挡门洞：仍必须可打核，且脉冲必须有开相；不得把唯一通道永久封死。墙后可走格四连通分量必须仍为 1。

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
- 无名变体：`coverage + substrate + occupancy + continuity`；占地时再加上主感知词素（否则渗透体与改写体撞键）。不把运动 / 节律 / 接触四槽全编进键，否则几乎永不「相同」。止损不另进键（已由连续性 × 覆盖深度决定）。旁白不上屏止损术语。

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

清核仍走既有 `CHAOS.COMBAT_BONUS`(5) 与挥击噪声。接触词素禁止变成 DPS 词缀。通道见下文「接触词素对照表」；止损见「止损衍生表」。数字只锁在本表，战斗 spec 只指针不复制。打不死的挥击不发 `ENEMY_DAMAGED`（不收战斗混乱），只走挥击噪声。

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

**check:lexicon / codegen 合同（R2-D1）：** 不再断言「恰好六行」。改为：

1. CSV 与 `src/generated/contamination-lexicon-data.ts` 的 id 集合一致（只许 codegen 生成，禁止手写 generated）。
2. 缺列、缺必填、`enabled_scope` 不是 `sortie`/`gym`、字段内 ASCII 逗号 → codegen 失败。
3. 出击白名单 = 所有 `enabled_scope=sortie` 的 id。本轮必须恰好是旧六种：`organic_remnant` / `lamp_pillar` / `doorframe` / `wall_rust` / `fungal_mat` / `oil_film`。
4. `oil_film.legalOccupancies`（CSV / 练习场视图）深等于 `['paint']`。废止「CSV 油膜必须能占空」。
5. `sound_echo` / `light_scatter` / `space_interval`：仅 `volume`，`enabled_scope=gym`，连续性只含 `monolith` 与/或 `field`。
6. `stalk_clump`（有机）与 `railing_post`（无机）合法占位含 `floor`、不含 `volume`；`ash_veil` 合法占位含 `paint`、不含 `volume`；三者 `enabled_scope=gym`。
7. `drawSortie` 产出不得含 `enabled_scope=gym` 的基体。丁在概念基体仍为 `gym` 时必须仍能抽到，且基体为油膜、占位为 `volume`。
8. `UTTERANCE_DATA.corridor_watching.substrate === 'space_interval'`。出击路径该成句不命中（不带 `utteranceId`）。为不打乱后续甲/丙的随机数，同一次抽卡用油膜占空的无名体占住（覆盖 / 词素与旧成句体相同）。
9. **配对不变量（`check:lexicon` 必断言）：** 概念三类任一行 `enabled_scope=sortie` ⟺ `oil_film.sortieLegalOccupancies` 不含 `volume`。当前概念三类均为 `gym`，codegen 派生 `oil_film.sortieLegalOccupancies = ['paint','volume']`。概念基体一旦对出击开放，必须在同一次提交里让油膜出击视图收回只占漆。

codegen 必须把 `enabled_scope` 写进 `SubstrateDef.enabledScope`，并写出派生字段 `sortieLegalOccupancies`（配对不变量；禁止手写 generated）。出击过滤读 `enabledScope` 列，不要另维护一份与 CSV 脱节的六 id 常量当唯一真相（可以派生 `SORTIE_SUBSTRATE_IDS`，但必须等于该列）。

**本轮行（与 CSV 同步；类不进 CSV，只供阅读）：**

| id | 上屏 | 类 | 残余动词 | 合法占位 | 合法连续性 | enabled_scope |
| -- | ---- | -- | -------- | -------- | ---------- | ------------- |
| organic_remnant | 有机残影 | 有机 | 走 | floor | monolith, shards | sortie |
| lamp_pillar | 灯柱 | 无机 | 亮 | floor | monolith | sortie |
| doorframe | 门框 | 无机 | 开合 | wall, floor | monolith | sortie |
| wall_rust | 墙锈 | 无机 | 渗 | wall | monolith, colony | sortie |
| fungal_mat | 菌毯 | 有机 | 铺 | paint | colony, field | sortie |
| oil_film | 油膜 | 无机 | 沾 | paint | monolith, colony, field | sortie |
| stalk_clump | 残茎 | 有机 | 摇 | floor | monolith, shards | gym |
| railing_post | 栏柱 | 无机 | 拦 | floor | monolith | gym |
| ash_veil | 灰幕 | 无机 | 覆 | paint | monolith, colony, field | gym |
| sound_echo | 余响 | 概念（声音） | 响 | volume | monolith, field | gym |
| light_scatter | 散光 | 概念（光线） | 折 | volume | monolith, field | gym |
| space_interval | 间距 | 概念（空间关系） | 挤 | volume | monolith, field | gym |

门框占地时运动必须固着，且不得永久封死出生→撤离的唯一通道。灯柱 / 栏柱占地默认固着。禁止把概念基体给甲。

**出击丁与油膜占空：** 练习场 / CSV 油膜只占漆。出击视图在配对不变量下仍让油膜占空，因此 `drawSortie` 抽到丁时基体仍是油膜——与概念基体写入 CSV 之前一致。禁止在概念基体仍为 `gym` 时把丁改抽乙（户外原先偏丁，比例一变就是变更进了裂隙）。钉层空的乙↔丁回退仍在（乙空则丁、丁空则乙；两者都失败才本图只有甲并打日志）。练习场句法课下拉直接抽概念三类，看不到油膜占空。

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
| eye_in_the_seam | 缝里的眼 | 缝视 | 覆盖 · 墙锈 · yi 单核占墙 · 固着 · 窄视 · 常开 · 邻格抽打 |
| cluster_lung | 簇的肺 | 呼吸 | 改写 · 菌毯 · bing 场占漆 · 簇栖 · 触地 · 随簇呼吸 · 踩踏混乱 |
| corridor_watching | 走廊在看你 | 反视 | 覆盖 · 间距 · ding 场占空 · 固着 · 反视 · 随天空相 · 场内加速混乱 |

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
| organic_remnant | motion_patrol |
| stalk_clump | motion_turn |
| wall_rust | motion_wall |
| fungal_mat | motion_cluster |
| oil_film | motion_wind |
| ash_veil | motion_cluster |
| sound_echo | motion_anchor |
| light_scatter | motion_trail |
| space_interval | motion_anchor |

无锁或缺席该孔谱字母表则不覆盖运动槽。

### 接触词素对照表（code 不得另猜）

现有四词。通道种类：打血 / 混乱 / 视野。**没有「仅驱散核」通道。** 打核是止损，见下一节。数字只锁在上文「数值结构」，本表不复制第二份价目。禁止 DPS 词缀。禁止给丁发明精神攻击空包，禁止给丁开打血。

**兑现范围：** `gymLiveMotion === true` 时宿主必须读 `lexemes.contact` 并按本表走通道，且必须再读 `resolveStopLoss` 决定能不能扣核。出击本轮仍按宿主 kind 硬编码（甲扇形打血 / 乙邻格打血 / 丙踩踏混乱 / 丁体积混乱+视野；乙丙丁核仍按现行 50 HP 可打），**不因本 DEC 改出击价目或可杀性**。出击何时接止损 = 另一次任务。

| contact id | 甲 | 乙 | 丙 | 丁 |
| ---------- | -- | -- | -- | -- |
| contact_melee_three | 通道：打血（贴身扇形）。合法本槽。 | 非法；`rewrite_to` → `contact_adjacent_strike` | 非法；`rewrite_to` → `contact_step_chaos` | 非法；`rewrite_to` → `contact_volume_chaos` |
| contact_adjacent_strike | 非法；无 rewrite_to；丢弃重抽 | 通道：打血（邻格抽打）。危险区跟核走。 | 非法；无 rewrite_to；丢弃重抽 | 非法；无 rewrite_to；丢弃重抽 |
| contact_step_chaos | 非法；丢弃重抽 | 非法；丢弃重抽 | 通道：混乱（踩踏）。不打血。场打不死时仍走本通道。 | 非法；丢弃重抽 |
| contact_volume_chaos | 非法；丢弃重抽 | 非法；丢弃重抽 | 非法；丢弃重抽 | 通道：混乱 + 视野（体积场）。余响 / 散光 / 间距三类同通道。场打不死时仍走本通道。禁止改打血。 |

`contact_disperse_core` 已删除。广播不进第一版字母表。打散重组不进接触字母表（走止损族 `scatter_rejoin`）。

`resolveContactChannel` 必须删除 `'disperse_core'` 取值。改写之后丙三刀 → `'step_chaos'`，丁三刀 → `'volume_chaos_sight'`。任何合法活宿主不得返回 `'none'`。

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
- 优先钉在相邻的不同 `ClusterOrganism` 核上；练习场只有一团漆时，在该团可走格上放 2 个核，间距优先 ≥ 3 格，空间不够则 ≥ 2 格。
- 打灭一个核：该核 Chebyshev 距离 ≤ 1 的漆不再收踩踏；其余核的漆仍收。form 仍活。发 `ENEMY_DAMAGED`，不发 `ENEMY_KILLED`。
- 最后一个核归零才 `ENEMY_KILLED`，整只回收。
- **本趟死核不回来。** 「重组」读作「整体还在（别的团还在）」，不是死核原地复活。

**打不死：**

- 不画可打核（2×2 亮青绿打击点）。场可以有相点 / 整团体积变亮，供反视与节律，但挥击扫到不白闪、不扣 HP、不发 `ENEMY_DAMAGED`。挥击噪声仍按战斗 spec A8（空挥 `suspicious`）。
- 丙场：整片钉漆仍踩踏。丁场：进体积仍混乱 + 视野 ×0.7。
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
- 旁白不上屏止损词。具体像素：`docs/art/contamination-forms.md`（gym 方案 D 节）；本轮 art 未改 HOW 之前，code 先用核的有无/个数兑现机制，审美待人终审。

### 方言（按 `fragmentTypeId`，同一趟一种方言）

风格锚先抽碎片类型，再给字母表权重。禁止一图动物园。未启用的碎片类型仍写权重，启用后直接用。权重是抽卡偏置，不是禁令（除基体亲和非法交仍丢弃）。覆盖深度不按碎片改写「覆盖体变第三种人形」。碎片 bias 不是新时空。

出击抽卡：按本表取加权行，**加权前**丢掉 `enabled_scope !== sortie` 的行（出击视图）。禁止先加权再丢掉——会多消耗随机数并改变出击抽卡。练习场句法课配表下拉读全表（仍按孔谱过滤占位）；若练习场走方言抽卡，不过滤 `gym` 行。

R2-C-data 必须按下面数字改 `contamination-draw.ts` 的 `DIALECT`（禁止出现未写入本表的 id）。未列出的旧基体对该碎片视为降权（不进加权表）。

| fragmentTypeId | substrates 加权（id × 权重） | preferYiDing | 词素侧 |
| -------------- | ---------------------------- | ------------ | ------ |
| frag-outdoor | fungal_mat 3, ash_veil 3, oil_film 3, space_interval 3, organic_remnant 2, stalk_clump 2, sound_echo 2, light_scatter 2, wall_rust 1, railing_post 1 | ding | 灯柱 / 门框不进表 |
| frag-clinic | lamp_pillar 3, doorframe 3, wall_rust 2, railing_post 2, light_scatter 2, organic_remnant 1, stalk_clump 1, ash_veil 1, space_interval 1, sound_echo 1 | yi | 菌毯不进表；随风降权 |
| frag-metro | wall_rust 3, oil_film 2, lamp_pillar 2, doorframe 2, railing_post 2, ash_veil 2, sound_echo 2, space_interval 2, light_scatter 1 | either | 菌毯中权（不进表=中低）；簇栖中权 |
| frag-library | doorframe 3, wall_rust 2, organic_remnant 2, railing_post 2, sound_echo 2, stalk_clump 1, light_scatter 1, space_interval 1 | yi | 随风降权（未启用） |
| frag-residential | organic_remnant 3, stalk_clump 3, doorframe 2, oil_film 2, railing_post 1, ash_veil 1, space_interval 1, sound_echo 1, light_scatter 1 | yi | 未启用；启用前禁止当生产路径 |

### 抽卡顺序

1. 读本图 `fragmentTypeId` 与 `ClusterOrganism[]`（烤地之后）。无簇则丙配额 = 0。
2. 掷乙或丁（1 只）。户外偏丁，临床偏乙，地铁按种子。出击在配对不变量下油膜仍占空，丁有合法基体；禁止因 CSV 油膜只占漆就把丁改抽乙。钉层空才乙↔丁回退。
3. 掷甲 2–3。撤离门那条必须是甲 + `sense_cone`。
4. 掷丙 0–1，钉最显眼簇（`breathAmp` 最大者；并列取核更靠近贪婪薪柴的）。
5. 听觉主轴：若乙的感知抽中听噪，则所有甲不得再抽听噪。若乙不是听噪（或本图是丁），则甲里恰好一只听噪（改写体对照），其余甲不得听噪。
6. 每只：底材 ∩ 孔谱 ∩ 方言 ∩ 覆盖开孔 ∩ 本路径允许的 `enabled_scope` → 四槽。交空重抽，上限 12。失败则少生该只并 `console.warn`，禁止用占地小人顶替漆/缝/体积。出击路径的 `enabled_scope` 必须是 `sortie`。
7. 成句：本图孔谱匹配时，若钉层允许，优先用配方行替换无名抽卡（每句每图最多 1 次）。出击路径若成句基体不在 `sortie` 白名单（如 `corridor_watching` 已改绑 `space_interval`），则该成句本图不命中：用出击合法基体（当前为油膜占空）占住同一次抽卡、去掉 `utteranceId`，禁止因此多消耗随机数把后面的甲/丙打乱。

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
  readonly coreRow: number; // 单核 = 可打核且可走；场 = 相点（不可打），仍须可走
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
| 丁 | 无 | 反视：玩家视野扫进体积或扫到相点才从睡眠/固着进入警觉类。打不死时相点 ≠ 可打核 | 无地板追击 | 失视则休眠 |

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
  COLONY_NUCLEUS_COUNT_MIN: 2,
  COLONY_NUCLEUS_COUNT_MAX: 3,
  COLONY_NUCLEUS_MIN_TILE_GAP: 3, // fallback 2 if paint AABB too small
}
```

`COLONY_*` 是系统常量，不是策划形态表。核 HP / 乙抽打 / 丁体积价目不得改。

### 练习场

练习场污染句法课是固定观察院子：玩家在场；侧栏按维度配表后点生成。甲 / 乙 / 丙 / 丁走出击同一套实体、AI、战斗与宿主；击杀后按当前配置再刷。遭遇识别旁白默认不创建。地图课仍可不开会走的敌人。禁止为句法另写一套移动。**迭代 2 第二轮：** 句法课可挂方案 D；基体下拉读 CSV 全表，按当前孔谱过滤 `legal_occupancies`（甲看不到仅占空的概念基体）。接触词素在 `gymLiveMotion` 为真时按对照表兑现；止损查表也只在这条路径兑现。接触下拉不得再出现打核驱散。默认仍无敌；「感受伤害」打开后才能看见乙抽打掉血。打不死个体不会被击杀，因此不会走「击杀后 0.8s 再刷」——玩家点生成才换。

## 边界情况

- 抽到非法基体×占位：丢弃重抽，上限 12，失败则本图少生该只并打日志，禁止用占地小人顶替「本该是漆 / 缝 / 体积」。
- 本图无簇：丙配额变 0，不把丙改画到墙上凑数。
- 占空与迷雾：体积不得抬到视野蒙层之上。亮度不在本文终审。
- 打散重组：接触字母表不含「打散重组」。连续性 `colony` 走止损族 `scatter_rejoin`。本趟死核不回来。重组体不得改碰撞、不得封死出生→撤离。死核原地无限复活延后。
- 打不死：只允许占漆 / 占空。挥击不扣核。禁止占地挡走的打不死。门框占地固着挡门洞：不得把唯一通道永久封死；脉冲必须有开相。
- 无害敌人：`resolveContactChannel === 'none'` 的活宿主 = 坏个体，不得刷出。
- 钉层为空（无墙缘 / 无够窄走廊）：该孔谱本图抽空，改抽另一张允许的（乙空则改丁，丁空则改乙；仍空则本图只有甲，并打日志）。概念基体仍为 `gym` 时，出击丁不算「无合法基体」。听觉主轴仍必须恰好 1。
- 乙或丁与甲路点重叠：乙/丁让路，改钉下一候选。甲路点契约优先。

## 与已有系统的接口

- 从地图生成接收：可走路点、`WallEdgePolyline[]`、`ClusterCorePin[]`、`CorridorAabb[]`、`fragmentTypeId`（方言）。
- 从地表接收：崩坏簇活层相位（孔谱丙踩踏胀满相）。
- 向 AI 发送：孔谱决定哪些五态转换可达、感知刺激钉在哪、能否 chase。甲的 `EnemySpawnData.type` 在过渡期仍可用 infiltrator/rewriter 表示视锥/听噪；实现后应带 `form` 描述。
- 向战斗发送：接触通道（扇形 / 邻格 / 混乱价）与止损剖面（能不能扣核、几个核）。通道以本文对照表为准；止损以查表为准。HP 事件仍归战斗。乙丙丁核 HP = 50。出击本轮可仍按宿主 kind（全部乙丙丁可打核）；gym `gymLiveMotion` 必须读词素 **和** 止损查表。
- 向混乱值发送：踩踏与场内加速走既有 `addChaos`，source 建议 `'paint_step'` / `'volume_field'`，不另开隐蔽条。
- 向遭遇识别旁白发送：`encounter:identified`。旁白消费此事件，不回写 AI。表面合同见 `ui-encounter-narration`。

## 对已有系统的影响

- `system-enemy-ai`：生成契约目标是「恰好 1 个听觉主轴」。五态本体保留。丙丁关掉追击。过渡期（DEC-077）活断言仍是 rewriter === 1；乙听缝不另占该名额。
- `system-combat`：邻格抽打、踩踏/体积不打血、按止损决定能不能扣核。甲三刀账不变。核 50 HP 仍守 K1。接触对照表与止损表在本文；战斗 spec 只指针。V3 不推翻。
- `system-map-generation`：除路点外交出墙缘 / 簇核 / 走廊盒。规则 22 过渡期仍是恰好 1 个 rewriter。
- 练习场：敌人课必须仍复用出击的实体与 AI。遭遇识别旁白默认不开。**迭代 2：** 仅污染句法课可挂候选视觉层（`src/gym/form-renderers/`）。第一轮 A/B/C 冻结对照。第二轮默认方案 D。不改本 spec 的出击价目数字；人选前出击渲染仍为甲两种程序像素 + 乙丙丁几何占位。

## 渲染探索（迭代 2，DEC-079 / DEC-080）

字段→像素的映射**未锁进出击**。第一轮三份候选冻结在练习场作对照。第二轮唯一可写实现是方案 D（`d-mixed`），合同见 `docs/tasks/iteration-2.md` 第二轮。禁止把方案 D 写进本文当出击现行规则。禁止 `RiftScene` import 候选渲染器。

现行缺口（实现事实，不是新玩法）：出击渲染层仍主要消费 `portfolio`。练习场方案 D 必须把 `substrate` / `coverage` / `continuity` / 词素 / `utteranceId` 送进画面。接触词素在出击 `src/systems/` 仍按宿主 kind 硬编码；gym 第二轮必须读取 `lexemes.contact` **和** 止损查表。基底 CSV 已含概念三类，但 `enabled_scope=gym`，codegen 之后出击不得抽到。`contact_disperse_core` 已从策划表删除；生成代码在 codegen 之后不得再引用该 id。

人选后：就地扩写 `docs/art/contamination-forms.md`（及甲的 `actor-pixels.md` 若胜者仍是程序像素家族），本文只补一句「出击视觉消费哪些字段」——仍不新建 spec 文件。把 `drawSortie` 白名单打开到新基体是另一次任务，不在第二轮。

### 给下一手 code 的交接清单（DEC-083；禁止再做设计判断）

本任务只交文档 + CSV。`src/` 由下一手改。`npm run check:lexicon` 在 codegen 之前变红是预期。

**1. Codegen**

- `tools/csv-codegen/generate.mjs`：读 `data/contamination-stop-loss.csv`；缺列 / 不是恰好 9 行 / 出现 `shards` / `unkillable` 的 `core_policy` 不是 `none` / 字段含 ASCII 逗号 → codegen 失败。
- 若 `contamination-lexemes.csv` 仍含 `contact_disperse_core` → codegen 失败。
- `contact_melee_three.rewrite_to` 必须含 `yi:contact_adjacent_strike`、`bing:contact_step_chaos`、`ding:contact_volume_chaos`；禁止仍指向 `contact_disperse_core`。
- 写出 `STOP_LOSS_DATA`、`StopLossFamily`、`StopLossCorePolicy`。跑 `npm run codegen`。禁止手改 `src/generated/`。

**2. `resolveContactChannel`（`src/systems/contamination-host-live.ts`）**

- 从 `ContactChannel` 删除 `'disperse_core'`。
- 逻辑保持：非法则先 `rewrite_to`，再映射四通道。映射完：
  - `contact_melee_three` → 仅甲 `'melee_hp'`
  - `contact_adjacent_strike` → 仅乙 `'adjacent_hp'`
  - `contact_step_chaos` → 仅丙 `'step_chaos'`
  - `contact_volume_chaos` → 仅丁 `'volume_chaos_sight'`
  - 其余 `'none'`
- 删掉 `if (id === 'contact_disperse_core')` 分支。

**3. 新增 `resolveStopLoss`（同文件，纯函数）**

```typescript
resolveStopLoss(form: {
  continuity: ContinuityId;
  coverage: CoverageId;
  occupancy: OccupancyId;
  portfolio: PortfolioId;
}): StopLossProfile | 'illegal'
```

- 查 `STOP_LOSS_DATA[`${continuity}_${coverage}`]`。没有行 → `'illegal'`。
- occupancy 不在 `legalOccupancies` → `'illegal'`。
- `PORTFOLIO_DATA[portfolio].blockWalk && family === 'unkillable'` → `'illegal'`。
- 返回 `{ family, corePolicy, hittable: family !== 'unkillable' }`。残骸按本文「残骸」表派生，不要再猜。
- **不要**把 family 写进 `ContaminationForm`。

**4. `selfCheckHostLive` 用例必须改成**

```
['jia', 'contact_melee_three', 'melee_hp']
['yi', 'contact_adjacent_strike', 'adjacent_hp']
['yi', 'contact_melee_three', 'adjacent_hp']
['bing', 'contact_step_chaos', 'step_chaos']
['bing', 'contact_melee_three', 'step_chaos']   // 原 disperse_core
['ding', 'contact_volume_chaos', 'volume_chaos_sight']
['ding', 'contact_melee_three', 'volume_chaos_sight']  // 原 disperse_core
['ding', 'contact_adjacent_strike', 'none']
['yi', 'contact_step_chaos', 'none']
```

删除一切 `contact_disperse_core` 用例。另加：`jia`+`monolith`+`infiltrate` → `core_strike` / `exposed` / hittable；`bing`+`colony`+`rewrite` → `scatter_rejoin`；`bing`+`field`+任意覆盖 → `unkillable` / 不 hittable；`ding`+`field` → `unkillable`；`ding`+`monolith` → `core_strike`；`jia` 不得 `unkillable`。

**5. 宿主（仅 `gymLiveMotion`）**

- `tickBingLive` / `tickDingLive`：通道仍按接触表；**不要**因为 `unkillable` 关掉踩踏或体积场。
- `hitCore`：先 `resolveStopLoss`。`hittable === false` → 直接 return（不扣 HP、不白闪、不发 `ENEMY_DAMAGED`）。
- 丙 `colony`：2–3 个核，各 50 HP；打一个不 `ENEMY_KILLED`；最后一个才杀整只。间距常量见上。
- 出击 `tickYiSortie` / `tickBingSortie` / `tickDingSortie`：**禁止** import `resolveStopLoss`。乙丙丁出击仍全部可打核 50 HP。`check:lexicon` 已有「sortie tick 不读 contact」；补一条 sortie tick 源码不含 `resolveStopLoss`。
- `RiftScene` 仍 5 参 `hosts.create`，不传 `gymLiveMotion`。

**6. `check:lexicon` 必加断言**

- `LEXEME_IDS` 不含 `contact_disperse_core`。
- melee 的 rewrite：bing→`contact_step_chaos`，ding→`contact_volume_chaos`。
- `STOP_LOSS_DATA` 恰好 9 个键；无 shards。
- 每个 `drawSortie` form：`resolveContactChannel !== 'none'`；`resolveStopLoss !== 'illegal'`；`blockWalk` 不得 unkillable。
- gym `lexemeOptions('contact', 'bing'|'ding')` 不含打核驱散。
- 既有配对不变量 / 出击白名单 / `RiftScene` 5 参 **保持**。

**7. 渲染器**

- A/B/C 冻结：不要为删 id 去改那些文件，除非 codegen 后它们编不过。死分支可留。
- 方案 D 与 live 宿主：核的有无/个数跟 `resolveStopLoss`，**不要**再 `switch (contact === 'contact_disperse_core')`。
- 练习场侧栏接触选项来自 CSV，删行后下拉自动消失；不要手写白名单再留打核驱散。

**8. 常量**

- `GAME_CONSTANTS.CONTAMINATION` 加三个 `COLONY_*`。乙抽打 15 / 350ms、丁 +1.0 / ×0.7、甲三刀、核 50：**不准改**。

**9. 不要做的**

- 不改 `RiftScene` 可杀性。
- 不启用占声主孔谱。
- 不给丁开打血。
- 不发明精神攻击。
- 不加伤害数字 / 震屏 / 命中停顿。
- 不声称视觉过关。

## 验证标准

- 本设计结束时能验证：人能否从文档读出接触与止损是两面、止损为什么不是第五骰子、四张主孔谱各逼玩家做什么。
- 实现后预期正面结果：gym 里丙丁不再出现无害个体；场只能绕或等相；菌落杀一个其余还在；绕仍比杀便宜；墙后地板连通仍为 1。
- 如果不 work 的信号：新形态只换皮仍是视锥小人；或组合出挡路的场把图切开；或玩家必须背「打不死」这个词才能玩；或渗透深度变成两刀清场。

## 待验证假设

- [ ] 四张孔谱足够匹配程序关卡的丰富感（人终审）
- [ ] 占漆踩踏价能让「冲过去多拿一点」成立且不比绕更蠢
- [ ] 覆盖体以缝 / 体积出场仍能读成威胁，而不是风景
- [ ] 无新 HUD 也能分清甲乙丙丁
- [ ] 遭遇识别旁白能加强识别且不刷屏、不读成头上名字（人终审）
- [ ] 只靠核的有无/个数，玩家能在遭遇当下分清打核 / 打散重组 / 打不死（人终审；失败则考虑旁白加「场 / 菌落」短词，仍不上「打不死」）
- [ ] 丁默认连续性是场（打不死）在 gym 是否读得懂；若人觉得默认该能杀，再把丁默认连续性改成单核（那是另一次设计，本表已支持）
