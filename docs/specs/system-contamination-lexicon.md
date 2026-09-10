---
status: DRAFT
created-by: design conversation（迭代 1）
created-when: 2026-08-20
last-modified-by: code（I18 R4-C：实体占空共享场与合法局部宿主）
last-modified-date: 2026-09-10
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
  - CSV `enabled_scope`（sortie / gym）；I18 R4生产10基底：6占地、3漆、1空；门框/墙锈/散光/间距/街具/灯柱/栏柱仅gym。
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

## 迭代20 A：环境工具目标合同

`ContaminationHostSystem.getToolTargets()`提供活Host、位置、类别、已释放/支持状态、来源剩余时间与恢复预兆；仅基础接口已交，正式余烬核/迟落砂的道具选择、扣次和新反馈留给后续完整样板，不把接口存在当成新道具上线。

`suppressReleasedHazard(id,sourceId,durationMs)`支持持续占漆与已释放气团/雾团/尘絮；保留实体、漂移与可打的核心，不杀敌、不永久净化。`delayNextHazard`仅支持尚未释放的这三类占空，暂停危险相位时钟，形体流动时钟继续。余响与历史墙不属于这两类干预，返回false。

来源独立计时，重叠期间按最长剩余时间保护；不叠加永久延时。压制到期若处于释放中，等自然下一次完整预兆再恢复危险；持续占漆等完整低伏→膨胀，避免到期中途骤伤。volume-presence和dust-flow的phaseElapsedMs仅决定危险相位及相关动作，不冻掉独立漂移。


迭代20 B：余烬核已在RiftScene与CombatLabScene接入真实Host查询/压制。选择可见无遮挡128px内已释放且未压制的最近危险，压制5秒，核心/实体/流动保留；环境恢复须重新自然预兆。Tool销毁时以实例source清理，不移除其他来源。下一次危险推迟接口供后续迟落砂使用，本批尚无对应成品，不声称已上线该能力。声音诱饵仅给地面AI，Host.reportNoise只是活动感应，不可冒充朝声源调查。

## R4-C 当前实体占空合同

用户已批准 `gas_mass` 气团、`mist_bank` 雾团、`dust_swarm` 尘絮群进入敌人检视室和正式裂隙；余响保留原行为及画法。当前生产13基底（6地面、3漆、4空），所有占墙、散光、间距及街具继续仅历史gym。每图占空仍1名额；听觉主轴仍恰好1个占地巡游。

128正式种子当前结果：197个去别名形态行为组合、27个行为键、460个理论候选、382个职责可分配组合。占空实抽气团40、雾团27、尘絮群44、余响17；全量局部宿主审计7680个相位样本无空部署。计数不等于独立物种，美术品质由人审。

三实体的家族能力与地图权重由CSV生成；`contamination-volume-profiles.csv` → `contamination-volume-data.ts`拥有休整/聚合/释放/散开时长、半径、扫动范围、通行间隙及危险阈值。气团向内压缩后短促外胀；雾团以不同长短与漂移频率的非镜像薄层分流重聚，保留24px穿行通道；尘絮群旋聚、短扫、散开。R4-D将其六等大圆瓣公转改为5个宽厚、异尺寸/朝向、独立连续噪声漂移的小絮簇，各自迟滞响应主周期；局部破碎边缘、核位置、接触均来自同一密度采样。危险阶段保持原CSV时长，不按新材质改变计费。新三者固定空间宿主并由自有周期变形，不叠加旧`dingLiveRect`微变形；余响沿旧路径。

`src/generation/terrain-safe-volume-seat.ts`在候选走廊内部求完整可走的轴对齐矩形，至少2×2格，优先面积大、同行列稳定决胜。可尝试所有走廊；没有合法座位则生成器重试该图，不能静默丢弃占空名额。Host/实际关卡/检视复用同一个纯选座函数；新presence的局部矩形全周期固定。尘絮的各絮簇轨迹在固定矩形内部平滑有界，不在失败帧瞬移到上一位置。

`src/systems/volume-presence.ts`提供预分配`VolumePresenceFrame`、`createVolumePresenceFrame`、`updateVolumePresenceFrame`、`sampleVolumeDensity`和`isVolumeDangerousAt`。纯场包含世界坐标分量、相位/进度、活动门、危险门、实际可走核心位置；低/中/高覆盖仅影响材质和内部运动，不改变命中几何，不依赖另一个随机种子。所有实体密度先裁去墙/VOID；伤害、视野惩罚和脚下污染反馈读取同一危险采样，不能以外接AABB整盒收费。气/雾/尘只有release相位且实际节律/反视门打开时启用原`volume_field`混乱与视野通道；其他相位提供清晰安全节奏，不新增HP伤害或第二套计费。

Host `getVolumePresenceFrame(id)`返回新三者权威帧；余响返回undefined、保持旧合同。反视在实体外沿视线采样实际密度，在实体内部保留看向实际核心的角度条件；空隙和背墙不触发唤醒，转头可以休眠。可打核只能在可走且有实体密度处，雾层通行空隙中不凭空放核。

检视 `setVolumePreviewTime(id,timeMs,activeOverride?)`仅用于演示定格，null恢复正式时钟；`volumeTimeAtPhase`与`getVolumeProfile`提供同一周期的绝对时刻。离线renderer使用`FormVisualPose.volumeTimeMs`，真实Host存在时始终以权威帧为准。context可显式演示活动形体，arena和正式裂隙不传override。模型形态和污染三档仍待用户审美判断，机器检查不代替美术PASS。

## 历史 R4-A 移除阶段（DEC-129）

R4-A移除阶段当时只保留10个生产基底：6占地（虫、人形、兽、蠕虫、有机残影、残茎）、3占漆（菌毯、油膜、灰幕）、1占空（余响）。占墙整体退出生产；门框、墙锈、散光、间距与街具均仅保留历史gym兼容，敌人检视室不得展示。该阶段未实现新增项；当前已按上节R4-C批准新增三种实体占空。

R4-A移除阶段128正式种子结果：181个去别名形态行为组合、28行为键、424候选、346职责可分配；听觉全在地面（128图/128只），无墙宿主，当时所有占空皆余响。6地面家族/14主形/42覆盖配置不变。组合数不是物种数。

生产抽样先检查enabledScope、地图正权重与实际可用孔谱。墙权重为0、无生产墙基底；无走廊也不得回退到墙。成句同样不能复活退休基底。地图仍保持3–4只占地、至少一只低档常开巡游体，以及恰好一只巡路听觉体。历史gallery可检视旧字母表，但不代表生产名单；检视室目录由当前scope派生，退休URL回退到虫。

后文R3建筑座位、墙战斗与三种占空外观段落保留为历史实现说明，已由本节退生产决定覆盖；不会据此重新上线。


> **TL;DR**: 用底材 + 孔谱 + 词素生成海量可落地的污染体形态；成句是少数具名遭遇。接触词素只表达「它怎么伤你」；止损从连续性 × 覆盖深度查表，不是第五骰子。叙述家是设计正文 `contamination-lexicon.md`；本文是规则合同；`ui-encounter-narration.md` 是识别表面。出击视觉走方案 D（DEC-084）。接触与止损：出击与练习场同一套读取。生产抽样只允许已兑现行为（见「生产行为能力边界」）；反视成句按当前能力过滤。当前13基底及退生产项见R4-C活合同；油膜出击视图只占漆。落地分批：I3-A 一份抽卡+甲 form；I3-F 活机制；I3-E 画面。未落地的实现事实标在对应节，不是过期 FATAL。体验未验证。

## 历史I18 R3范围与保留机制（生产集合已由R4取代）

本节记录R3当时范围；当前生产名单以R4节为准，仍保留未被R4改变的动作、裁切和核选座合同。下文明确标为I3–I17的上线记录、旧抽样和视觉语法只保留历史解释；不能据其恢复地面门框、街具生产或旧环境外观，也不能据旧PASS替代本轮验收。美术验收仍待用户，不声称发行就绪。

R3当时14个生产基底：占地虫、人形、兽、蠕虫、有机残影、残茎；占墙门框、墙锈；占漆菌毯、油膜、灰幕；占空余响、散光、间距。占地共14种主形（虫/人各1，其余四家族各3），每种有渗透/改写/覆盖三档，共42种主形×覆盖配置，不含朝向、动作帧或seed充数。`doorframe`仅wall、所有档`motion_anchor`；`street_wreckage`仅gym，生产无权重、无地面模型注册。保留街具body行只供历史gym和阻路回归；门框地面body行已删。

128真实种子采样：232个去别名的形态行为组合、47个行为键；当前候选570、职责可分配492。去别名键包含基底/孔谱/占位/覆盖/连续性/四词素，不含seed、主形种子与utterance别名；行为键不含基底、覆盖、连续性。这些均不是独立物种数量。证据由`check:generation-contract`写入`docs/qa/iteration-18-evidence/generation-after.json`。

环境三类已进入本轮重制：墙的门梃/锈壳沿真实建筑缝附着，动作读350ms实际前摇；菌毯/油膜/灰幕全部由同一paint-genome表面与危险格管线提供独立材质和动画；余响/散光/间距分别表达声音、光线、空间异常，生产不再使用同云换色。当前视觉不引用旧HOW作本轮验收依据。

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
12. **孔谱丙**钉可走地板上有主的漆（生产外观 = 菌毯/油膜/灰幕，共用paint-genome危险面）；主感知是触地；无追击锁定；踩踏或该宿主胀满相位收混乱；漆不改碰撞。氛围崩坏簇已下线（DEC-104）。活层技术（DEC-070 / DEC-071）跟该宿主自己走。不另做小人精灵当默认外观。菌落 = 打散重组；场 = 打不死。接触槽只有踩踏混乱。
13. **孔谱丁**体积深度必须低于视野黑暗蒙层。可反视或领域察觉。攻击通道永远是体积场（混乱 + 视野）。不默认同款近战。禁止精神攻击空包，禁止给丁开打血。单核 = 止损族打核（核 HP 50）；场 = 打不死（挥击不扣核、不发 `ENEMY_DAMAGED`）。打不死时反视读「视野扫进体积 / 扫到相点」，相点不是可打核。
14. **自动改写**：三刀 + 占墙 → 邻格抽打。三刀 + 占漆 → 踩踏混乱。三刀 + 占空 → 场内加速混乱。巡路 + 占墙 → 巡墙图。视锥 + 占漆 → 触地主通道。禁止改写成打核驱散。
15. **词素必须改六件套至少一件**，否则逐出字母表。接触词素必须改攻击件，禁止再改死亡。交为空则重抽，禁止用最近非法值凑。止损不是词素，不走本条；死亡件由规则 30 的查表填写。
16. **抽卡配额**（每图）：丁1（余响/气团/雾团/尘絮群）；无合法占空宿主时不回退占墙。占漆按本图 `contaminationAge` 掷闭区间整数：**新生 3–5 / 标准 6–8 / 古老 9–12**（`N = lo + floor(rng × (hi − lo + 1))`，种子 `mix32(layout.seed, 'paint-count')`）。最小 3。档间不重叠。N 不乘图面积、不乘薪柴路径长度。禁止再读 `ClusterOrganism` 只数 C，禁止再掷 0–1 硬币，禁止落地 I8-D 的 0/1/2/3，禁止落地 I8-R 钉死的 3/5/8。抽一份 form，复制 N 只（同基体 / 覆盖 / 连续性 / 词素 / 成句）。油膜三变体按个体种子采样。钉点：贪婪薪柴路径上的可走地板，偏咽喉（四邻可走格数为 2 优先），依次取。宿主钉点 Chebyshev ≥ 6；**N ≥ 9 时第一步从 ≥ 5 起**；不够 ≥ 4，再不够 ≥ 3。禁止钉墙 / 虚空 / 出生与撤离 Chebyshev ≤ 3 / 薪柴所在格。禁止 N 只都钉同一格。放不下先降间距、再扩到路径 Chebyshev 2、再扩到出生可达可走地板；**仍不足掷出的 N** 则本图重试，禁止交出击图，禁止把 N 钳小交差。出击甲条数由地图巡逻给出（3–4），**每条** `enemySpawns` 配一个占地 form；禁止用历史数字「甲 2–3」砍掉一条巡逻。练习场句法课甲数量由侧栏观察，不进出击配额。每图恰好一个听觉主轴；I18由`contamination-encounters.csv`分配给占地；R4墙听觉权重为0。
17. **出生钉层**：占地 → 现有路点契约；占墙 → 墙缘折线；占漆 → `paintFloors`（贪婪路径可走格）；占空 → 走廊包围盒。不再交出 `clusterCores` 当生产钉点。
18. **战斗成功标准不变**：绕应通常比杀便宜。接触词素改代价种类，禁止做成词缀 DPS。打不死正面支撑本条。更脆禁止变成「杀了更划算」（不得减刀数、不得降核 HP）。
19. **成句第一版四句**：门还想关、缝里的眼、簇的肺、走廊在看你。配方见设计正文 §6。内部配方名禁止印上屏。游戏内名称走遭遇识别旁白的观察句，成句另加短行为标记。禁止传奇口吻、禁止头上名字。双占位成句第二批。标记映射见下文「遭遇识别旁白」。簇的肺与走廊在看你都是场，止损 = 打不死。
20. **策划数据**实现时走 CSV → codegen。禁止在代码里手写形态表再反向导出。系统常量除外。止损查表是闭表（9 行），仍走 CSV → codegen，禁止在代码里另写一份 family 映射。
21. **世界可读仍是第一课**（缝的核、占漆外沿与该宿主呼吸、体积的相、可打核的有无与个数）。遭遇识别旁白是强化识别的 P1，不是替代、不是图鉴、不是后台配装板。逻辑以本文「遭遇识别旁白」节为准；载体 / 视觉 / U1–U12 见 `docs/specs/ui-encounter-narration.md`；叙述见设计正文 §7。
22. **遭遇身份键**（限频用，不上屏）：成句用 `utteranceId`。无名变体用 `coverage + substrate + occupancy + continuity`；占地再加主感知词素。不把运动 / 节律 / 接触四槽编进键。止损不另进键：它已由 `continuity × coverage` 决定；再加一层会让限频几乎永不命中。旁白不上屏止损术语。
23. **遭遇触发**：甲占地 / 乙占墙 = 看见该个体身体（`getVisibilityAt` > 0）。丙占漆 = 踩该漆，或视野扫到该宿主的任一计费漆格（场无核时不得再要求扫簇核）。丁占空 = 进入体积或视野扫到核（打不死时「核」读相点，不是可打核）。持续留在可识别里 = 同一次遭遇，不重复触发。
24. **遭遇限频**：同身份键本趟 60s；任意身份行间隔 ≥ 2.5s；同时 1 行；与混乱阈值重叠则阈值优先、这次作废不补打；出击结束清空冷却表。同图多只占漆若身份键相同，共享 60s（I8-D 特性，禁止为此拆键或改秒数）。
25. **事件**：通过限频的一次识别发出 `encounter:identified`。载荷见下文「实现规格 · 事件」。遭遇识别旁白消费此事件，不回写 AI。
26. **听觉主轴**：每图恰好一个主感知为听噪的个体；I18当前生产仅由地面承担，`rewriter === 1`。撤离门仍必须是甲 + 视锥，不得担任听觉主轴。0 个或 ≥2 个 = 坏图，重试；禁止把全部甲改成视锥糊过去。
27. **油膜只占漆**：`oil_film.legal_occupancies` 仅为 `paint`。废止 DEC-076 第 8 条「否则丁无基体」的占空扩权。孔谱丁当前生产基体为 `sound_echo` / `gas_mass` / `mist_bank` / `dust_swarm`（仅 `volume`）；散光与间距只保留历史gym。出击视图见规则 29：油膜出击只占漆。
28. **出击范围**：CSV 列 `enabled_scope` 为 `sortie` 或 `gym`。出击 `drawSortie` 只抽 `sortie` 行。练习场句法课读全表，并按当前孔谱过滤 `legal_occupancies`。禁止把 `gym` 行抽进裂隙。sortie集合见R4活合同与CSV，当前13基底；所有占墙及散光/间距不在生产集合。
29. **占空配额不变量**：油膜生产只占漆；丁只抽当前scope与地图权重允许的四类占空。缺合法走廊时重试地图，禁止回退已退休占墙，也禁止用油膜临时代替占空。
30. **止损衍生（DEC-083）**：止损不是词素、不抽卡、不进身份键。查 `data/contamination-stop-loss.csv`：键 = `continuity + coverage`，得到 `family`（`core_strike` / `scatter_rejoin` / `unkillable`）与 `core_policy`（`exposed` / `standard` / `obscured` / `none`）。occupancy 必须落在该行 `legal_occupancies`。`block_walk === true` 禁止 `unkillable`。裂片行不进本表（延后）。接触槽不得再表达止损。
31. **无害禁止**：任意合法个体 `resolveContactChannel` 不得为 `'none'`。丙即使 `family=unkillable` 仍走踩踏混乱；丁即使 `family=unkillable` 仍走体积混乱 + 视野。gym 侧栏不得再提供 `contact_disperse_core`。
32. **打不死连通**：`unkillable` 只允许占漆或占空。禁止占地挡走、禁止占墙整面当打不死。历史门框附墙能力不新增走廊碰撞；R4门框所有占位均已退出生产。墙后可走格四连通分量必须仍为 1。

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
| 每图丁（4种生产基底共享名额） | 合法通道宿主 1；无宿主不回退占墙 | 改一条路的走法；太多则看不懂 |
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
4. sortie集合按`enabled_scope=sortie`生成，当前13基底；`railing_post` / `lamp_pillar` / `street_wreckage` / `doorframe` / `wall_rust` / `light_scatter` / `space_interval`为gym。门框只有wall合法占位。`drawSortie`不得含gym行。
5. `oil_film.legalOccupancies`（CSV / 练习场视图）深等于 `['paint']`。废止「CSV 油膜必须能占空」。
6. `sound_echo` / `gas_mass` / `mist_bank` / `dust_swarm`：仅 `volume`，连续性只含 `monolith` 与/或 `field`，`enabled_scope=sortie`。`light_scatter` / `space_interval` 保留相同孔谱约束但 `enabled_scope=gym`。禁止给甲。
7. `stalk_clump`（有机）与 `street_wreckage`（无机）合法占位含 `floor`、不含 `volume`；前者 `enabled_scope=sortie`，后者已退为 `gym`。三种生物（`insect_remnant` / `mammal_remnant` / `worm_remnant`）合法占位含 `floor`、不含 `volume`，`enabled_scope=sortie`（I5-T）。`railing_post` / `lamp_pillar` 合法占位仍是 `floor`、不含 `volume`，`enabled_scope=gym`。`ash_veil` 合法占位含 `paint`、不含 `volume`，`enabled_scope=sortie`。
8. `UTTERANCE_DATA.corridor_watching.substrate === 'space_interval'`。该成句保留于 CSV / 练习场，反视与天空相未兑现前不得进生产；其固定配方为 `substrate === 'space_interval'` 且 `occupancy === 'volume'`。废止「用油膜占空影子占住抽卡」。
9. **配对不变量（`check:lexicon` 必断言，保留双条件）：** 概念三类任一行 `enabled_scope=sortie` ⟺ `oil_film.sortieLegalOccupancies` 不含 `volume`。开放后两边都真：三类均为 `sortie` **且** `oil_film.sortieLegalOccupancies === ['paint']`。禁止只翻一半。

codegen 必须把 `enabled_scope` 写进 `SubstrateDef.enabledScope`，并写出派生字段 `sortieLegalOccupancies`（配对不变量；禁止手写 generated）。出击过滤读 `enabledScope` 列。

**行表（与 CSV 同步；类不进 CSV，只供阅读）：**

> **历史I5-J / I5-T 翻列记录（街具上线已被I18 R3退生产取代）：** `street_wreckage`（街具残骸）为 `sortie`，进 `SORTIE_SUBSTRATE_IDS`。`lamp_pillar` / `railing_post` 收回 `gym`，不进出击抽卡。三种生物基底（`insect_remnant` / `mammal_remnant` / `worm_remnant`）为 `sortie`（I5-T；进甲现有 3–4 巡逻加权池，不另给名额）。四行字段以 I5-P 定值为准（已进 CSV）。

**历史I5-P定值（当时均sortie；R3街具已改gym。）I8-R：裂隙不再上屏基体短名。下表短名仅作内部 / 练习场标签，CSV 仍由 I8-N 决定是否改列：**

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
| doorframe | 门框 | 无机 | 开合 | wall | monolith | gym（R4占墙整体退生产） |
| wall_rust | 墙锈 | 无机 | 渗 | wall | monolith, colony | gym（R4退生产） |
| fungal_mat | 菌毯 | 有机 | 铺 | paint | colony, field | sortie |
| oil_film | 油膜 | 无机 | 沾 | paint | monolith, colony, field | sortie（出击视图只占漆） |
| stalk_clump | 残茎 | 有机 | 摇 | floor | monolith, shards | sortie |
| railing_post | 栏柱 | 无机 | 拦 | floor | monolith | gym（I5-J 已退出出击） |
| ash_veil | 灰幕 | 无机 | 覆 | paint | monolith, colony, field | sortie |
| sound_echo | 余响 | 概念（声音） | 响 | volume | monolith, field | sortie |
| gas_mass | 气团 | 实体 | 涌 | volume | monolith / field | sortie（R4-C） |
| mist_bank | 雾团 | 实体 | 漫 | volume | monolith / field | sortie（R4-C） |
| dust_swarm | 尘絮群 | 实体 | 旋 | volume | monolith / field | sortie（R4-C） |
| light_scatter | 散光 | 概念（光线） | 折 | volume | monolith, field | gym（R4退生产） |
| space_interval | 间距 | 概念（空间关系） | 挤 | volume | monolith, field | gym（R4退生产） |
| street_wreckage | 街具 | 无机 | 立 | floor | monolith | gym（I18 R3退生产） |
| insect_remnant | 虫 | 有机 | 爬 | floor | monolith | sortie（I5-T 已翻列） |
| human_remnant | 人形残余 | 有机 | 走 | floor | monolith | sortie（I17 独立基底） |
| mammal_remnant | 兽骸 | 有机 | 走 | floor | monolith | sortie（I5-T 已翻列） |
| worm_remnant | 长虫 | 有机 | 拱 | floor | monolith | sortie（I5-T 已翻列） |

门框不再合法占地；街具仅保留历史gym身份。门框必须附着真实墙端、开口或1–3格宽通道侧边，固定面对可走地面。`doorwayWallSeats`先筛合法座位；无座位时排除门框，改抽墙锈，不改墙格、不封路。禁止把概念基体给甲。

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

### 能力与完整身体合同（R3机制保留，生产范围读R4）

CSV字母表仅定义语法。实际生产还须通过 `contamination-families.csv` 的基底×孔谱能力、低档运动锁、`contamination-dialects.csv` 的地图正权重，以及占位/连续性/止损规则。`familyCapabilityFor` / `motionChoicesFor` / `supportsRuntimeForm` 是抽样和AI共同入口。先筛符合指定/排除词素的完整候选，再按权重抽取；不许抽完硬换一个非法词素来保住名字。

- 占地：巡路/转面/固着，视锥/听噪/窄视，常开/睡眠/脉冲，近战通道。当前仅六个生物家族，渗透运动锁由家族CSV给出；凝聚尚未实现，不入池。固着与转面不被接触分离推走，移动体绕开其完整身体；转面仍保留原工具击退许可。
- 历史占墙（R4已全部退生产）：门框仅固着，墙锈可沿壁/转面/固着；触地/窄视/听噪，常开/睡眠/脉冲，邻格预备后抽打。窄视需墙面方向与视线成立；听噪需实际噪声成立，不用动画假装听觉。
- 占漆：本轮仍为簇栖×触地×随漆呼吸×踩踏混乱，同图配方保留；菌毯、油膜、灰幕均有生产表面，油膜保留三个拓扑入口。宿主原有呼吸相驱动步价，不宣称有额外安全相。没有实际消费者的随风/嗅混乱/天空相等不因表里存在便进入生产。
- 余响（其余三种实体占空读R4-C共享场合同）：固着形变/随风/拖尾，领域或反视，常开，场内混乱通道。反视读取真实玩家朝向与遮挡：盒外视线进入其范围；盒内朝向核心±60°；300ms激活，移开视线600ms退相，完全退去后不施加该场影响。相位同时控制云体与脚下污染迹的显隐。

节律数字的唯一策划源是 `data/contamination-behavior-profiles.csv`。睡眠体平静时不巡游，近距移动噪声/挥击/受伤唤醒，完整600ms醒转后才允许感知升级、自主移动和新攻击；本次遭遇保活，完整退警再复睡。脉冲周期为2400ms休止、600ms醒转、3600ms活动，每个实体错相；休止不能新开攻击，但已承诺的攻击完整完成。窄视总角70°、距离为原视锥的1.15（207px，小于玩家224px视距），关闭额外宽周边视野。

身体动作/攻击参数源是 `data/contamination-body-profiles.csv`。六个生产生物家族按承重方式调整五态移动速度，窄直扑咬与宽摆攻击使用各自蓄势、扇角、距离、冷却；起手、命中、地面预告、`FormAttackPose`读取同一参数。虫与人形原有攻击参数保留。伤害值、玩家射程、两枚并发攻击名额不变；最小敌人攻击距离36px仍覆盖30±4px停距。

成句必须以整张配方通过当前能力表；不许替换掉未实现词素后仍沿用其成句身份。练习场可显示完整字母表，但展示不等于该行为已兑现。

### 地图职责与内容数量

占地名额仍3–4，环境宿主为丁1个（4种生产基底共享名额），占漆仍按地图年龄配额。撤离守卫固定低污染、常开、视锥、巡路，身体按地图抽；原听觉槽及其他巡路职责选能巡路的身体，余位最多一个静止哨点。保留地图原出生格、朝向、路径与资源位置。地图方言weight=0是明确禁配，正值才是权重，不再把缺项称作“仅偏好”。

全场（占地+占墙）恰好一个听觉主轴。有墙宿主时按 `contamination-encounters.csv` 决定听觉归墙还是占地；没有合法听墙则归占地。墙听觉时原占地听觉名额换非听觉可巡路体，数量与位置不变。AI创建根据实际占地听觉数处理0/1，生成结果仍检查全场唯一。

计量分为主要体形配置、有效行为配方、真实地图实遇分布；不以随机seed/色差/理论笛卡尔积代替敌人数量。原128图基线见I18证据，职责修复会改变实际移动压力；名额不变不代表难度不变。

### 环境危险面与视觉合同（R3）

门框座位由`generation/wall-host-placement.ts`计算，生成与`ContaminationHostSystem`共用；`SortiePinAvailability.hasWallOpenings === false`在抽样前排除门框，不能生出来再临时换身份。Host固定核心于可达墙缝，`getStrikeFloors`、`getAttackVisualState`、`getActivityVisualState`供生产墙动画；从可走面挥击核时LOS终点向该面偏0.5px，避免自己的墙格遮住暴露核。

`FormAttachContext.isWalkableFloor?(col,row)`是显式可选地形接口，由RiftScene、EnemyInspectorArena及EnemyInspectorContext传入。菌毯/油膜/灰幕绘制像素、危险沉积与`stepFloors`都受同一地形裁切，不能覆盖墙或VOID。Host登记再独立校验：有`isWalkable`时优先读取，否则读取`!isOpaque`，同时拒绝越界；没有网格的外部历史gym调用保持兼容。核只在过滤后的footprint上重座；菌落核按确定性完整二点/三点搜索选座，先争取Chebyshev间距≥3格，再退≥2格；裁切后的紧凑patch若确实放不下，允许最后使用两个不同的相邻合法格（≥1格，即32px），仍保持独立核心、命中和计费，不降成单核或重叠同格。若仅余1合法格则禁用部署；128正式种子审计必须证明没有此类配额蒸发。全非法/空表面禁用该Host并清活核，不发玩家击杀、奖励或噪声事件。`bingOnPaint`也检查地形，不能靠旧登记绕过不可走格。

漆面的世界原点固定为出生地表锚`host.pin.cx/cy`，`getVisualPin(bing)`始终返回该锚。菌落第一核重定位可以改变`host.core`与可打目标，不能平移整张材质、改变烤图原点或让注册的危险格脱离实际图像。三个场景更新cluster位置使用visual pin；renderer保持相同ctx.pin作裁切与世界格映射。

菌毯/油膜/灰幕均从`bake.field`生成`stepFloors`。`setStepFloors`登记模型实际表面；菌落危险是登记表面与存活核各3×3范围的交集；无核场直接使用登记表面。空表面是无危险，不删除登记后偷偷回退旧核邻域。仅从未登记表面的历史调用者允许旧fallback。`isPaintFloorActive(hostId,col,row)`供材质层显示同一危险面，死核区域衰暗；真实步价仍随Host呼吸相，不伪造呼吸安全相。重建、清空、死亡purge释放登记。

丁的形体沿当前`getVisualPin` AABB布置，分别以余响断续回返、散光偏折、间距挤合呈现；活动状态与反视蓄势/释放仍来自Host。伤害使用同一实时AABB与活动门，视觉不能单独计时开启危险。

### 动作、接触与验证

生产与练习场共用 `productionModelFor` / `attachAnimatedModel`，家族独立baker；待机、步行、警觉、预备、命中、收势均有定义。步态按物理实际位移推进，被墙挡住时不原地跑腿；战斗时钟优先于装饰动画。休止通过 `restAmount` 收拢离地承重结构，接地点固定；非休止原图不变。

R3已移除地面门框/街具，当前生产没有不可移动底座；移动敌人不新增硬碰撞以免夹杀。以下静态碰撞能力仅保留给历史gym及防御性回归：生成接受前将静态底座与墙/虚空一起按玩家半宽扩张，在4px导航上验证撤离/拾取可达性。失败仅在原槽预先排除静态底材后重抽合法组合，不挪地图或巡逻；无候选则拒绝布局。物理速度按Arcade worldstep时间测量，无物理步的渲染帧保持最近速度；接触纠正仍不算走路。

每实体一张动态GPU纹理，CPU最多64帧缓存；隐藏时更新时钟但不烤图/上传，销毁清空；受击/死亡复制当前身体图后再销毁。宿主表现通过稳定subjectId绑定真实危险实体，禁止靠相邻核心距离误绑定。

接触分离包含静止及完全同心移动体，固定体不被推；每一步检查完整身体与沿途可走格，不能穿墙/虚空或越过速度预算。Host/AI/Combat统一限制单步delta，墙体新危险格至少显示一帧预备才计时；核挥击必须满足实际LOS，不可打核不吞掉可打目标的命中机会。

验证入口：`check-generation-contract`（真实128图职责/配额/空间/CSV合同）、`check:contact-runtime`（真实AI/Combat/Host规则）、`check:model-animation`（实际位移/相位/缓存与生命周期）、模型烤图帧扫描、正式 `pollution-review.html`。自动检查不代替用户审美与实战终审。

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
| doorframe | 不属于甲；乙仅motion_anchor |
| lamp_pillar | motion_anchor |
| railing_post | motion_anchor |
| street_wreckage | gym历史motion_anchor；生产不可抽 |
| organic_remnant | motion_patrol |
| mammal_remnant | motion_patrol（走；与有机残影同锁、不同基体） |
| stalk_clump | motion_turn |
| insect_remnant | motion_patrol（爬行，I16 完整移动样本） |
| human_remnant | motion_patrol（人的步行残余，I17） |
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
- 优先钉在该宿主自己的漆格包围盒内不同位置；练习场只有一团漆时，在该团可走格上放 2 个核，间距优先≥3格，再退≥2格；R3紧凑例外允许两个不同相邻合法格（≥1格/32px），仍为独立核。禁止钉到另一只宿主的漆上。禁止再读相邻 `ClusterOrganism`。
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

出击抽卡：按本表取加权行，**加权前**丢掉 `enabled_scope !== sortie` 的行（出击视图）。禁止先加权再丢掉——会多消耗随机数并改变出击抽卡。练习场句法课配表下拉读全表（仍按孔谱过滤占位）；若练习场走方言抽卡，不过滤 `gym` 行。现行白名单按R4活合同，不使用历史新增行数。

R2-C-data 必须按下面数字改 `contamination-draw.ts` 的 `DIALECT`（禁止出现未写入本表的 id）。未列出的旧基体对该碎片视为降权（不进加权表）。

| fragmentTypeId | substrates 加权（id × 权重） | preferYiDing | 词素侧 |
| -------------- | ---------------------------- | ------------ | ------ |
| frag-outdoor | fungal_mat 3, ash_veil 3, oil_film 3, organic_remnant 2, stalk_clump 2, sound_echo 2, insect_remnant 1, human_remnant 1, mammal_remnant 1, worm_remnant 1 | ding | 已启用；仅余响占空，听觉在地面 |
| frag-clinic | organic_remnant 1, stalk_clump 1, ash_veil 1, sound_echo 1, insect_remnant 1, human_remnant 1, mammal_remnant 1, worm_remnant 1 | ding | 已启用；仅余响占空，听觉在地面 |
| frag-metro | oil_film 2, ash_veil 2, sound_echo 2, insect_remnant 1, human_remnant 1, mammal_remnant 1, worm_remnant 1 | ding | 已启用；仅余响占空，听觉在地面 |
| frag-library | organic_remnant 2, sound_echo 2, stalk_clump 1, insect_remnant 1, human_remnant 1, mammal_remnant 1, worm_remnant 1, fungal_mat 1, oil_film 1, ash_veil 1 | ding | 已启用；仅余响占空，听觉在地面 |
| frag-residential | organic_remnant 3, stalk_clump 3, oil_film 2, ash_veil 1, sound_echo 1, insect_remnant 1, human_remnant 1, mammal_remnant 1, worm_remnant 1 | ding | 未启用数据 |

### 抽卡顺序

1. 读本图 `fragmentTypeId` 与 `contaminationAge`。不读 `ClusterOrganism[]`。
2. R4-C掷丁四种生产基底（有合法宿主时1只）；乙生产权重为0且无生产基底，无走廊时记录缺位，不得回退乙。新三者必须拥有完整可走的至少2×2局部矩形，找不到时重试图；128正式图均有合法占空座位。
3. 掷甲，条数 = 本趟 `enemySpawns.length`（3 或 4）。撤离门那条必须是甲 + `sense_cone`（有机残影 + 渗透 + 视锥可走强制参数，结果必须写进 `spawn.form`）。禁止先抽 2–3 再丢掉一条路点。
4. 掷丙：按 `contaminationAge` 在闭区间内均匀取整（`new` → 3–5，`standard` → 6–8，`ancient` → 9–12）。抽一份占漆 form（`preferUtterance` 仍每图最多 1 次成句），复制 N 只。钉 `paintFloors`：贪婪薪柴路径，偏咽喉。Chebyshev ≥ 6；N ≥ 9 时第一步从 ≥ 5 起；不够 ≥ 4、再不够 ≥ 3。禁止全部钉同一格。不足掷出的 N 则本图重试，`console.warn`。N 不乘面积、不乘路径长。
5. 听觉主轴：全场恰好1只。按R4数据分配给地面；该只必须巡路，墙不再生产。
6. 每只：底材 ∩ 孔谱 ∩ 方言 ∩ 覆盖开孔 ∩ 本路径允许的 `enabled_scope` → 四槽。交空重抽，上限 12。失败则少生该只并 `console.warn`，禁止用占地小人顶替漆/缝/体积。出击路径的 `enabled_scope` 必须是 `sortie`。
7. 成句：本图孔谱匹配时，若钉层允许，优先用配方行替换无名抽卡（每句每图最多 1 次）。I18成句须通过当前完整能力过滤；反视`corridor_watching`保留历史活动门实现但因间距退gym不再生产，基体仍必须是间距、占位必须是占空。废止「用油膜占空影子占住抽卡」。

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
  COLONY_NUCLEUS_MIN_TILE_GAP: 3, // fallback 2; R3 compact exception 1 on distinct legal tiles
}
```

`COLONY_*` 是系统常量，不是策划形态表。核 HP / 乙抽打 / 丁体积价目不得改。

### 练习场

历史污染句法课（I18已由enemy-inspector替代，下述侧栏流程仅保留历史解释）是固定观察院子：玩家在场；侧栏按维度配表后点生成。甲 / 乙 / 丙 / 丁走出击同一套实体、AI、战斗与宿主；击杀后按当前配置再刷。遭遇识别旁白默认不创建。地图课仍可不开会走的敌人，**不得**传 `liveMotion`。禁止为句法另写一套移动。句法课可挂方案 D（与出击生产同一份语法；A/B/C 冻结对照）。基体下拉读 CSV 全表，按当前孔谱过滤 `legal_occupancies`（甲看不到仅占空的概念基体）。接触词素与止损在 `liveMotion` 为真时按对照表兑现。接触下拉不得再出现打核驱散。默认仍无敌；「感受伤害」打开后才能看见乙抽打掉血。打不死个体不会被击杀，因此不会走「击杀后 0.8s 再刷」——玩家点生成才换。`RiftScene` 禁止 import `src/gym/**`。

## 边界情况

- 抽到非法基体×占位：丢弃重抽，上限 12，失败则本图少生该只并打日志，禁止用占地小人顶替「本该是漆 / 缝 / 体积」。
- 占漆放不下第 N 只：先降间距再扩候选；仍不足掷出的 N 则本图重试，禁止交不足额的出击图，禁止改画到墙上凑数，禁止把 N 钳小交差。
- 占空与迷雾：体积不得抬到视野蒙层之上。亮度不在本文终审。
- 打散重组：接触字母表不含「打散重组」。连续性 `colony` 走止损族 `scatter_rejoin`。本趟死核不回来。重组体不得改碰撞、不得封死出生→撤离。死核原地无限复活延后。
- 打不死：只允许占漆 / 占空。挥击不扣核。禁止占地挡走的打不死。R4所有占墙及街具已退生产；历史门框能力不占地堵门。
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

- `system-enemy-ai`：生成契约目标是「恰好 1 个听觉主轴」。五态本体保留。丙丁关掉追击。R4活断言是全场sense_hear === 1且地面rewriter === 1，无乙。出击甲 spawn 带 form（I3-A）。
- `system-combat`：邻格抽打、踩踏/体积不打血、按止损决定能不能扣核。甲三刀账不变。核 50 HP 仍守 K1。接触对照表与止损表在本文；战斗 spec 只指针。V3 不推翻。出击与练习场同读（I3-F）。
- `system-map-generation`：除路点外交出墙缘 / 占漆地板格 / 走廊盒，以及一份 `contaminationDraw`。规则 22 过渡期仍是恰好 1 个 rewriter；巡逻 3–4 不砍。氛围簇钉层不再交出。
- 练习场：敌人课必须仍复用出击的实体与 AI。遭遇识别旁白默认不开。句法课可挂对照渲染器 A/B/C；生产 D 住 `src/entities/form-renderers/`（I3-B）。地图课不得打开 `liveMotion`。迭代 3 接线合同 `docs/tasks/iteration-3.md`。

## 出击视觉（方案 D，DEC-084）

人选已拍板方案 D，并批准接入裂隙。合同：`docs/tasks/iteration-3.md`。像素配方住 `docs/art/contamination-forms.md`（I3-C）与甲的 `docs/art/actor-pixels.md`；本文只锁**消费哪些字段**，不复制剪影 / 簇数 / 色值。

生产渲染器住 `src/entities/form-renderers/`（I3-B）。**禁止** `RiftScene` import `src/gym/**`。A/B/C 冻结为句法课对照，不是出击标准。`infiltrator-sprite.ts` / `rewriter-sprite.ts` 是默认敌人课 / placeholder 回退，不是裂隙甲的生产路径。

**历史双路径收口（I5-J / DEC-ARCH-013，已被I18 R3生产注册与材质管线取代）：** 出击 `d-mixed` 占地与句法课 / 陈列馆甲走同一份基因谱模块（`d/genome/`：节点、共享构件、违规算子、`weld`、按覆盖档选画布）。`street_wreckage` 走街具残骸语法骨架；`doorframe` 走门框语法骨架（中空开口，不是单杆+座）；残茎 / 有机残影 / 虫 / 哺乳动物 / 大号蠕虫走各自语法。算子作用在骨架上（预算渗透 1 / 改写 3 / 覆盖 5；放射只在覆盖档），然后 `weld`，然后才刷漆。**陈列馆检视会切四朝向与四个信号相。基因谱甲消费 `FormVisualPose.facing4` / `signal` / `pose.moving`（I5-N / I5-G / DEC-098）。** `attachJiaGenomeD` / `JiaGenomeVisual` 走共用 `bakeJiaGenome`（骨架 → 算子 → weld → 朝向/信号相）；浏览默认朝下 + idle，检视按需烤。画面等人检视，不要写成画面 PASS。旧 `d/jia.ts` / `jia-paint` 只留给 A/B/C 冻结对照，不是出击默认。I5-J **不**升生产 ramp、尽量不改 `RiftScene`。墙皮门框残余仍是乙，不走本条占地语法。I5-T：三种生物已进出击抽卡（灯柱 / 栏柱仍 gym）。

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

### 迭代17：人形残余接入（DEC-125）

`human_remnant`由CSV新增独立行：人形残余 / 走 / floor / monolith / sortie，保留`organic_remnant`。五种碎片方言各加入权重1，与虫等低权重基底同池，不增加敌人名额。渗透档残余运动锁`motion_patrol`；改写/覆盖依既有支持能力池，不新增人形专属感知、伤害或攻击方式。完整目录按CSV扩展独立厅。

覆盖是结构退场程度，不是人类敌人职业。低/中档可保留人体身份，高档由异质承重结构主导。此项不改变其他基底或将所有有机残影画成人。新增权重会改变旧种子的具体抽样结果；I16旧种子截图保留为其提交版本证据。当前seed7/11/9为人形三档，seed26同时含人形与虫。


R3附墙可见投影补充：门框/墙锈主体沿真实面法线向地侧投影10px（渲染仍在迷雾之下），核保持原seam 0–2px、危险格不动。真实单帧strike触发140ms纯表现收势，后续windup即时显示，不延长伤害或延后预告；四向外伸限制在相邻32px格内。
