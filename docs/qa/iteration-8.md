---
status: DRAFT
created-by: qa agent（迭代 8 I8-QA）
created-when: 2026-08-28
note: 占漆压力与识别面机械对照（当时快照）。人终审已于 2026-08-28 15:28 PASS，迭代 8 COMPLETE。本报告不改写机械结论。I8-V 后交。`interface-changed` 已由 Director 收口为 false。
---

# QA：迭代 8（占漆压力与识别面，机械层）

日期：2026-08-28  
合同：`docs/tasks/iteration-8.md` Task I8-QA（DEC-104）  
对照口径：`docs/design-notes/contamination-lexicon.md` §4.4 / §4.5 / §7 / §8  
规则：`docs/specs/system-contamination-lexicon.md`（当时 `interface-changed: true`；**Director 收口已改回 false**）  
识别表面：`docs/specs/ui-encounter-narration.md`（当时 `interface-changed: true`；**Director 收口已改回 false**）  
地表 HOW：`docs/art/rift-fragment-surfaces.md`（青绿上限）  
代码：HEAD `8e2bdec` + 工作区 I8-G / I8-Q / I8-N 产物。本报告核工作区磁盘。

**收口（Director，2026-08-28 15:28）：** 人终审 **PASS**。试玩四问全过：地面像不像裂隙 / 占漆够不够压 / 低语像不像人话 / 核读不读得出可以杀。I8-V 在本报告之后交、人已过核可读。迭代 8 COMPLETE。下文仍是机械层快照，不改写。

**已交对照对象：** I8-G、I8-Q、I8-N。  
**当时未交：** I8-V（合同已开：菌落核可见性接线）。本报告不把它当本批 FAIL，单列现状。  
**不许代勾（当时）：** 好看、读作游戏、漆够不够压、地面会不会空、低语像不像人话。

---

## 闸门实测（工作区，2026-08-28）

| 命令 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | 绿 |
| `npm run check:lexicon` | 绿 `check:lexicon ok` |
| `npm run check:observe-lines` | 绿 `check:observe-lines ok` |
| `npm run check:paint-quota` | 绿。掷样新生 3–5 / 标准 6–8 / 古老 9–12 均落闭区间；短走廊 `need 12, max placed 2` 走重试串不钳 N；12 张布局钉点 = 掷出的 N，全在贪婪路上 |
| `npm run check:layout` | 绿。8 种子墙后可走仍过；含 `frag-library` |
| `npm run check:contrast`（`check:contam-floor-contrast`） | 绿。CIE76 ≥ 18；地面青绿四张三年龄均为 **0.00%**（上限 0.20 / 0.35 / 0.50）；虚空青绿 0%；连通 = 1；`|{shape[id]}| == 4`；修前夹具会红 |
| `npm run check:paint-genome-topology` | 绿 |
| `npm run check:gallery-catalog` | 绿。`default total=1974` |
| `node tools/agent-parity/check.mjs` | 绿。6 个 agent 正文一致 |

---

## 1. §4.4 牵连查单（I8-G）

| # | spec 引用 | 代码证据 | 结论 |
| - | --------- | -------- | ---- |
| 1.1 | `bakeGround` 簇烤层 **删**生产路径。缺省 `contaminationDraw` 不再铺无主漆。晶结 / 溶蚀 / 平涂只练习场对照 | `preview-paint.ts` `bakeGround`：未传 `contaminationDraw` 时不进 `stampContamination`（2039–2055）。出击 `rift-scene.ts:165` `riftSurface.mount(...)` 不传画法。地图课默认 `<option value="" selected>生产：无氛围簇</option>`（`gym.html:436`）→ `readDrawStyle` 返回 `undefined`（`gym-map-scene.ts:442–445`）。`stampClusterContamination` 仍在，仅 `style === 'cluster'` 对照下调用（1705–1723） | **PASS**（对照下拉仍能铺簇，标签写明已下线） |
| 1.2 | `ClusterOrganism` 不再当配额输入 | `contamination-draw.ts` 无 `hasClusters`；配额读 `contaminationAge`（58–72）。`src/**` 无 `clusterCores` | **PASS** |
| 1.3 | 整图 `liveClusterBreath` **关**。出击 / 地图课停传。文件暂留旧皮 | `src/**` 无 `liveClusterBreath`。`check-lexicon.ts:479,501` 断言裂隙与地图课源码不含该名。`cluster-pulse.ts` 仍被 `d/bing-paint.ts:1` import（菌毯 / 灰幕旧皮） | **PASS** |
| 1.4 | 活层技术 **留，改应用** = 占漆宿主呼吸 | `d/paint-genome/live.ts` `PAINT_BREATH` / `PAINT_IDLE_AMP` / `PAINT_INFLATED_AMP`。`contamination-host-system.ts:40,368,672` 读 `isPaintInflated`。拓扑闸门仍测 rest→peak | **PASS** |
| 1.5 | `deriveContamRamp` **留**，不再喂地面簇 | `fragment-ramp.ts:9,91` 仍调同一函数。地面缺省不 stamp 簇 | **PASS** |
| 1.6 | L1 渍 / 纹理 / 划痕 / 接缝漏光 **留** | `bakeGround` 仍走 `stampWear`、渍阈、近虚空压暗（1993–2024, 2024） | **PASS**（画面空不空不代勾） |
| 1.7 | `contaminationAge` × `ruinSeverity`：**留，改旋钮**。年龄改调占漆只数 | `rollPaintHostCount(seed, age)`（`contamination-draw.ts:66–72`）；残破轴仍 `ruinKnobs`。不乘面积 / 路径长 | **PASS** |
| 1.8 | 尘点 / 换路 / 天空巨影 **留** | `procedural-surface.ts` 仍叠天空；`check:layout` 仍过换路 | **PASS** |
| 1.9 | 对比度闸门改**上限**：新生 ≤0.20% / 标准 ≤0.35% / 古老 ≤0.50% | `check-contam-floor-contrast.ts:55–59` `TEAL_MAX`。实测四张三年龄 **0.00%**。CIE76 / 指纹 / 虚空 / 亮格 / 连通保留 | **PASS** |
| 1.10 | 占漆钉点改贪婪薪柴路径，偏咽喉 | 见 §2 | **PASS** |
| 1.11 | 胀满相改锚：`sin(host.phase) > 0.35`；禁止读整图 `clusterPulse` | `PAINT_INFLATED_SIN = 0.35`（`live.ts:17`）；`isPaintInflated`（20–22）；`tickBingLive` / `getVisualSignal` 走该函数（`contamination-host-system.ts:368,672`）。`check-lexicon.ts:531` 断言宿主源码无 `clusterPulse` | **PASS** |
| 1.12 | 菌落核落该宿主漆格包围盒；2–3 核；间距 ≥3（不够 ≥2）；必须可走 | `colonyNucleusSeatsInFloors`（`contamination-host-live.ts:409–428`）。出击 `attachSchemeD` 后 `setStepFloors` → `relocateBingColonyNuclei`（`rift-scene.ts:1150`；`contamination-host-system.ts:321–327,815–847`）滤 `walkableFloors`。初始 `spawnBingNuclei` 仍按钉点偏移占位（792–812），随 `setStepFloors` 改座 | **PASS**（出击路径在 attach 后改座。核**看得见**是 I8-V，见末） |
| 1.13 | 丙旁白触发：视野扫到该宿主任一计费漆格，或踩上。场无核不得再要求扫簇核 | `isIdentifiable` 丙支：`bingPaintVisible \|\| bingOnPaint`（405–411）。`bingPaintVisible` 扫 `paintFloors` 各格中心 `getVisibilityAt > 0`（702–715）；无行才回退 `host.core`。`bingOnPaint` 菌落走活核旁 3×3，场走登记漆格（722–731） | **PASS** |
| 1.14 | 地图课与出击同一套：不再铺氛围簇；`liveMotion` 仍关 | 默认不传画法；`gym-map-scene.ts:219` `setSkipPaint(true)`；`check-lexicon.ts:500–501` 断言地图课无 `liveMotion` / `liveClusterBreath` | **PASS** |
| 1.15 | 出击停整图呼吸；占漆活层保留 | `rift-scene.ts:221` `{ liveMotion: true }`；无 `liveClusterBreath` | **PASS** |
| 1.16 | 句法课 / 陈列馆不得再垫氛围簇底 | `gym-lexicon-scene.ts` / `gym-lexicon-gallery-scene.ts` 均不 `bakeGround` / 不传簇画法。句法课院子自绘墙地板（199–209） | **PASS** |
| 1.17 | 架构登记氛围簇应用已下线 | `architecture.md` DEC-ARCH-016（367–372）；模块表 ProceduralSurface / ClusterPulse 已改口 | **PASS** |
| 1.18 | 旧占漆皮留呼吸、不升出击 | `d/bing-paint.ts` 仍 `paintClusterBreath`。出击油膜走 `attachBingPaintGenome`（DEC-ARCH-015） | **PASS** |
| 1.19 | 净化点 / 加厚三档 / 净化器起始混乱 **不改** | 本工作区 `git diff` 未触及 `purification-scene.ts` / `procedural-purification-surface.ts` / `game-state.ts` / `system-purification-impact.md` / `constants.ts`。`MODULE_MAX_HP_COST: [12, 20, 32]`（`constants.ts:308`）仍在 | **PASS** |

§4.5 视觉重估（地面空不空、核读不读成打击点）归 I8-A2 + 人；机械不代勾。I8-A2 已书面开 I8-V。

---

## 2. 配额与钉点（§8 / 句法 spec 规则 16；I8-Q）

| # | spec 引用 | 代码证据 | 结论 |
| - | --------- | -------- | ---- |
| 2.1 | 新生 3–5 / 标准 6–8 / 古老 9–12 闭区间；`N = lo + floor(rng × (hi − lo + 1))`；种子 `mix32(layout.seed, 'paint-count')` | `PAINT_HOST_COUNT_RANGE` + `rollPaintHostCount`（`contamination-draw.ts:58–72`）。闸门 20 种子三年龄均整数且落区间；古老样里出现 9 与 12 | **PASS** |
| 2.2 | N 不乘面积、不乘路径长；禁止 I8-D 的 0/1/2/3、禁止钉死 3/5/8、禁止读簇只数 C、禁止 70% 硬币 | 掷函数只吃 seed+age。`bing-host-seat` 已从钉点源码删除（`check-paint-quota.ts:62`）。`drawSortie` 连续性 0.7 硬币是孔谱连续性偏好（362），不是占漆只数 | **PASS** |
| 2.3 | 抽**一份** form，复制 N 只；油膜三变体按**个体**种子 | `for (let i = 0; i < pins.paintCount; i++) forms.push(bing)`（562–569）。挂载 `mix32(seedRoot, subject.id)`（`rift-scene.ts:1144`）→ `oilFilmProductionVeinVariant` = `mix32(seed, 'oil_film_variant') % 3 + 3`（`topology.ts:54–56`） | **PASS** |
| 2.4 | 钉贪婪薪柴路径（出生→争夺档/深档薪柴最短可走链，并上撤离主干）；偏咽喉（四邻可走 = 2 优先） | `greedyKindlingCells`（292–311）；`rankSeats` 先 `neighbors === 2`（367–370）。闸门 12 张 `greedy=N/N` | **PASS** |
| 2.5 | 间距：N&lt;9 从 ≥6；N≥9 从 ≥5；再 4、再 3 | `paintHostSpacingLadder`（209–210）：`>=9 ? [5,4,3] : [6,4,3]` | **PASS** |
| 2.6 | 禁墙 / 虚空 / 出生与撤离 Chebyshev ≤3 / 薪柴所在格；禁止叠同一钉点 | `walkBits` 只可走；`isBannedPaintSeat`（314–327）；`pickSpaced` 互距。闸门逐钉断言 | **PASS** |
| 2.7 | 放不下：降间距 → 路径 Chebyshev 2 → 出生可达全部可走；**仍不足 N 则本图重试**，禁止钳 N | `placePaintFloorPins` 三阶段 × 间距梯（457–476）；失败返回 `paint pins short`。`rift-layout.ts:846–849` `continue` 重试放置/岛。短走廊夹具 `need 12, max placed 2` | **PASS** |
| 2.8 | 出击甲条数仍跟巡逻 3–4，不砍 | `check:layout` 8 种子 `patrols=3` 或 `4` | **PASS** |
| 2.9 | 架构 DEC-ARCH-017 | `architecture.md:374–379` | **PASS** |

---

## 3. 旁白（§7 / 句法 spec 观察句；I8-N）

| # | spec 引用 | 代码证据 | 结论 |
| - | --------- | -------- | ---- |
| 3.1 | 20 行与 CSV / spec 逐字一致（含标点 / 省略号） | `data/contamination-observe-lines.csv` 20 行；`src/generated/contamination-lexicon-data.ts` `OBSERVE_LINE_DATA` 20 条与 CSV **零差**。最长 18 字，均 ≤40 | **PASS** |
| 3.2 | 不上「识别。」；载荷 kind 仅 `observe` / `utterance_mark` | `encounterNodes`（228–235）。`encounter-narration.ts` 无中文、无 `devicePrefix`、无 `识别。`。`DISPLAY_TOKEN_DATA.device_prefix` 仍为「识别。」（生成数据 558–561）但裂隙不读 | **PASS**（CSV 保留给陈列馆 / 开发标签，符合合同） |
| 3.3 | 选行键 8 类句池 + 成句整句替换；成句优先；narrow 与 cone 同走甲·看 | `observePoolFor`（207–219）：成句先滤 `utteranceId`；占地按 `floorSenseBucket`（hear / 其余→cone）；非占地按 `coverageBucketOf`（infiltrate vs rewrite/overwrite→overwrite）。`check:observe-lines` 覆盖 8 类 + 4 成句 | **PASS** |
| 3.4 | 同一次遭遇按宿主种子抽 1 行；限频按身份键不按句子 | `pickObserveLine`：`mix32(hostSeed, 'observe-line')`（222–225）。`tryIdentify` 用 `mix32(0, hostId)`（`encounter-narration.ts:101`） | **PASS** |
| 3.5 | 限频未改：同身份 60s / 行间隔 ≥2.5s / 同时 1 行；阈值优先作废不补打 | `GAME_CONSTANTS.CONTAMINATION`：`ENCOUNTER_COOLDOWN_MS: 60_000`、`ENCOUNTER_GAP_MS: 2_500`、`ENCOUNTER_HOLD_MS: 2_500`（`constants.ts:463–465`）。本工作区未改 `constants.ts`。`tryIdentify`：`thresholdActive` 直接 return（94）；`visibleUntil` / `lastLineAt` / `cooldownUntil`（95–99） | **PASS** |
| 3.6 | 成句替换时短标记仍上屏 | `encounterNodes` 成句时 push `utterance_mark`（232–234）。`displayTokenFor` 读 `UTTERANCE_DATA.onScreenMark`（243）：开合 / 缝亮 / 在涨 / 回头。CSS `.encounter-mark` teal + 1px 错位（`panel-styles.ts:678–682`） | **PASS** |
| 3.7 | 文案只住 CSV；禁止 `encounter-narration.ts` 手写整句 | `encounter-narration.ts` 无汉字。`displayTokenFor` 只查生成表 | **PASS** |
| 3.8 | `src/generated/` 未被手改 | 文件头 `AUTO-GENERATED by tools/csv-codegen/generate.mjs`。观察句与 CSV 逐字相同 | **PASS** |
| 3.9 | 否决会走 / 在缝 / 贴地 / 在路 | 裂隙旁白源码与 20 行均无这些短名 | **PASS** |
| 3.10 | `contamination-display-tokens.csv` 保留；陈列馆 / 句法课仍读 | 句法课 `DISPLAY_TOKEN_DATA`（`gym-lexicon-scene.ts:17,791`）；陈列馆 `PORTFOLIO_DATA.displayToken` / `tokenOf`（`gym-lexicon-gallery-scene.ts:874,999`） | **PASS** |

### 渗透 vs 改写覆盖：选池真的分开（触发路径）

| 路径 | 触发 | 选池 |
| ---- | ---- | ---- |
| 渗透体（甲·看） | `rift-scene.ts:382–385`：甲 `getVisibilityAt(enemy.getPosition()) > 0`；`INFILTRATOR_FORM` 占地 + `sense_cone` + `infiltrate`（`contamination-draw.ts:163–175`） | `observePoolFor` → `observe_jia_look_1/2`。`check:observe-lines` 断言 `encounterNodes(INFILTRATOR_FORM)` |
| 改写体（甲·听） | 同一 `getVisibilityAt`；`REWRITER_FORM` 占地 + `sense_hear` + `rewrite`（177–189） | `observe_jia_hear_1/2`。占地身份键再拼 `sense`（`identityKey` 191–196），两只不撞冷却 |
| 乙/丙/丁渗透 vs 改写覆盖 | 乙：`isIdentifiable` → `getVisibilityAt(host.core)`（408–409）。丙：扫漆格或踩上（410–411）。丁：体积或扫核（413–423）。选池不看甲的感知，看 `coverageBucketOf` | 渗透 → `*_infiltrate_*`；`rewrite` 与 `overwrite` 同进 `*_overwrite_*` |

甲的覆盖深度不上屏，化进视/听句池——与 spec「占地再加主感知」一致，不是乙丙丁那套覆盖句池。

---

## 4. 边界条件

| # | 项 | 证据 | 结论 |
| - | -- | ---- | ---- |
| 4.1 | 古老档 12 只在短路径图走重试、不钳 N | 闸门走廊图 `paintCount: 12` → `paint pins short (need 12, max placed 2)`。`generateRiftLayout` 收到字符串则 `continue`（846–849），用尽则 throw，不交不足额图 | **PASS**（机器夹具。真图 4 种子未掷到 12，但掷样含 12） |
| 4.2 | 同身份多只互踩 60s | 复制的是**同一份** form 引用（569），`identityKey` 不含宿主 id。`cooldownUntil.set(key, now+60s)`（103）。同图 N 只丙共享键 — spec 写明是特性 | **PASS**（静态）。趟内手感等人试 |
| 4.3 | 成句替换短标记仍上屏 | 见 3.6。闸门断言 `nodes.length === 2` 且 mark 文本为开合/缝亮/在涨/回头 | **PASS** |
| 4.4 | 渗透 vs 改写选池分开 | 见上表 | **PASS** |

---

## 5. 回归面

| # | 项 | 证据 | 结论 |
| - | -- | ---- | ---- |
| 5.1 | 净化点 / 加厚三档未碰 | 见 1.19。`system-purification-impact.md` 费用表仍 12/20/32 | **PASS** |
| 5.2 | 陈列馆与句法课标签仍读 display-tokens | 见 3.10。开发标签仍用覆盖/占位短名，符合「不上裂隙、练习场可用内部名」 | **PASS** |
| 5.3 | 地图课默认无氛围簇 | `gym.html:436` 默认空值；`docs/dev/gym.md` 生产行写无氛围簇 | **PASS** |
| 5.4 | 连通 FATAL | `check:layout` 8/8；对比度闸门连通 = 1 | **PASS** |
| 5.5 | 练习场默认不创建遭遇旁白 | `gym-lexicon-scene.ts` 无 `EncounterNarration` | **PASS** |

---

## 6. U1–U12（只勾结构层；视觉 / 「读作游戏」留人）

权威清单：`docs/specs/_template-ui.md`。本表面合同：`ui-encounter-narration.md`。HOW 已读 `.agents/skills/in-game-ux/SKILL.md`。

| 项 | 结构层 | 结论 |
| -- | ------ | ---- |
| **U1** 载体 A；挂 architecture overlay 根；无头上名 | `EncounterNarration.create` → `getDomUiRoot()`（`encounter-narration.ts:48`）；根 id `dom-ui-root`（`panel-styles.ts:814,822–828`）。不钉敌人世界坐标。练习场不创建本表面 | **结构 PASS**。载体感等人 |
| **U2** 无后台管理气味 | 结构：无打开键、无确认、无 `.game-panel`。圆角/投影气味等人 | **结构已扫；视觉留人** |
| **U3** 色 | 结构：字 `#c8cdd4`、成句 `#2ae6c8`（`panel-styles.ts:655,679`），落 Kit + 污染侧 teal。新色有无等人眼 | **结构 PASS；色感留人** |
| **U4** 12px Courier；无 14px | `#rift-encounter-log { font: 12px 'Courier New' }`（654） | **结构 PASS** |
| **U5** 术语；无「识别。」/「我们」/说明书词 | 20 行无「你 / 我们 / 危险 / 敌人 / 注意 / 识别。」。裂隙不读 `device_prefix` | **结构 PASS**。像不像人话留人 |
| **U6** 不占中心 | `bottom: 56px; left: 50%; width: 480px`（646–651） | **结构 PASS** |
| **U7** 无打开键；无 hover-only | 无按键绑定；`pointer-events: none` | **结构 PASS** |
| **U8** 冷却 = 静默 | 冷却中 `tryIdentify` return，不画灰态 | **结构 PASS** |
| **U9** 观察句一个 span；不成分类串 | 无名 1 个 `observe` span；成句 + 1 个 mark。无覆盖/基体/占位三标签 | **结构 PASS**。电报腔/文学性留人 |
| **U10** 400ms 内有行 | 淡入 200ms（22, 131） | **结构 PASS** |
| **U11** 复用 `panel-styles.ts` | `#rift-encounter-log` 在共享样式层。残留选择器 `.encounter-prefix` 仍在（670），JS 不再挂该类 | **结构 PASS**，见偏差 D1 |
| **U12** 参考 Signalis / Barotrauma / Dead Space | spec 仍钉三款。画面贴合度等人 | **结构：spec 仍在；贴合度留人** |

机械层已扫。**不许写好看 / 审美过关 / 像游戏 / PASS。**

---

## 7. I8-V（合同已开，本批未交）

I8-A2：现行 3 像素方点读不成打击点 → 开 I8-V。最小强化 = 核在油膜之上、座落该宿主漆格、场不画方点，不是加亮。

现状（事实，不是本批 FAIL）：

- 出击 `attachSchemeD` 调 `setSkipPaint(true)`（`rift-scene.ts:1124`）。
- `paintMarks` 在 `skipPaint` 时直接 `setVisible(false)` 返回（`contamination-host-system.ts:879–881`）。方案 D 就绪后，菌落核点被连同默认方点藏掉。
- 场（`!hittable`）同样不画 mark（884–886），这项已满足「场不画方点」。
- 核座落漆格已由 I8-G `setStepFloors` 落地。

**不代勾核好不好认。** 交人 / Director：I8-V 仍待派。

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| D1 | 偏差 | Low | 前缀已下屏，共享样式仍留 `#rift-encounter-log .encounter-prefix`。不上屏，不挡机械验收 | `panel-styles.ts:670` | UI 合同：不上「识别。」；骨架不再发 `device` 节点 |
| D2 | 风险 | — | I8-V 未交。出击 `skipPaint` 把菌落核 mark 一并藏掉；核座落已对，可见性接线没有 | `contamination-host-system.ts:879–881`；`rift-scene.ts:1124` | I8-A2 / 合同 I8-V；§4.5 候 2 |

无 High/Critical 机械 FAIL。I8-D 旧阶梯与「会走/在缝/贴地/在路」未落地。

---

## 偏差点清单

1. **D1** 残留 `.encounter-prefix` CSS（不上屏）。
2. **D2** I8-V 未交：核点在生产路径上被 `skipPaint` 藏掉。不挡 I8-G/Q/N 机械对照。

---

## 交人终审的问题清单

合同验证问题（`docs/tasks/iteration-8.md`；**尚未派人终审**）。agent 不代答：

1. **看得见的漆是不是都有主？** 还会不会觉得满地氛围在骗你？
2. **占漆是否够形成绕 / 冲的压力？** 不同污染度的图，只数跨度是否感觉得到？（机器：新生 3–5 / 标准 6–8 / 古老 9–12，档间不重叠。）
3. **识别行是否文学、隐晦、有用？** 能不能感到「面对这类东西该小心什么」？观察句是否仍是一个 span？去掉「识别。」之后还像不像装置面上的字？
4. **没有氛围簇的地面还像不像裂隙？** 会不会太干净？（尤其新生 × 完好。）

另请人知道、不挡本报告：

5. **I8-V 未交。** 菌落核座落已在宿主漆格；出击画面上核点仍被默认方点隐藏。要不要按 I8-A2 开可见性接线。
6. 同图多只占漆共享 60s 旁白是特性；人若觉得「漏报」需书面改口，禁止 agent 拆身份键。
7. 迷雾下亮度仍等人终审，本包不代勾。

---

## 总结

I8-G / I8-Q / I8-N 相对 I8-R / I8-R2 口径：**机械对照通过**。氛围簇生产路径已下线；配额与钉点与 §8 一致；20 行旁白与 CSV 逐字一致；限频数字未改；净化点加厚三档未碰；闸门 9/9 绿。

**当时不要标迭代 8 COMPLETE。** 体验未验证。审美 / 读作游戏 / 四问归人。I8-V 当时仍开未交。

**收口：** 人 2026-08-28 15:28 终审 PASS；迭代 8 COMPLETE。I8-V 后交。`interface-changed` 已改回 false。
