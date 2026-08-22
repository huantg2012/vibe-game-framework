---
status: DRAFT
created-by: qa agent（迭代 3 I3-QA）
created-when: 2026-08-22
note: 机械对照任务书断言反转协议 + DEC-084 红线。不代勾审美 / 迷雾下亮度 / 读作游戏 / PASS。任务书曾写报告路径 docs/qa/iteration-3-sortie.md；本次派发指定本文件。
---

# QA：迭代 3（方案 D 接入出击，机械层）

日期：2026-08-22  
Spec：`docs/specs/system-contamination-lexicon.md`、`system-combat.md`、`system-enemy-ai.md`、`system-map-generation.md`、`ui-encounter-narration.md`、`docs/art/contamination-forms.md`  
合同：`docs/tasks/iteration-3.md`「新红线 / 断言反转协议 / Task I3-QA」；DEC-079～084  
代码：HEAD `c8efe14`。七批（旧→新）：`ac540cc` C → `a0336cb` B → `bbf40cd` A → `ef38bed` D → `34a258b` G → `79f5b27` F → `c8efe14` E。派发写的 `ef38bed..HEAD` 只覆盖 D 之后；本报告核了全部七批。

闸门实测（工作区，2026-08-22）：`npx tsc --noEmit` 绿；`npm run check:lexicon` 绿；`npm run check:layout` 绿（8 种子；巡逻 3–4；`rewriter === 1`；每条甲带 form；墙缘集合自检）。

工作区另有未提交的 `src/gym/gym-map-scene.ts`（给地图课挂静帧宿主）。checker 读磁盘，当前工作区该文件**不含** `liveMotion`。HEAD 地图课则还没有宿主。

**审美 / 迷雾下亮度 / 读作游戏 / 旁白是否读成复合名词：一律等人终审。本报告不勾 PASS。不要标迭代 3 COMPLETE。**

---

## 断言反转逐条结论

对照任务书 L51–L77。方法：看 `git show` 里谁删了负向、谁在同一提交补了正向，再读 HEAD `tools/contamination-lexicon/check-lexicon.ts`。

| # | 删了什么（或声明要删的负向） | 补了什么 | 强度是否等价 | 有没有漏 |
| - | ------------------------------ | -------- | ------------ | -------- |
| 1 | `RiftScene must not mention gymLiveMotion` | **没有删。** 仍在 `:335`。另补出击 `hosts.create(..., { liveMotion: true })`（`:340–344`，I3-F） | **等价且加强**（旧名继续禁，新名强制开） | 无 |
| 2 | `RiftScene hosts.create stays 5-arg` | 同一条正则改成六参且字面 `{ liveMotion: true }`（I3-F） | **等价**（同样是整句调用的正则，不是只查标识符） | 无 |
| 3 | `tickYiSortie must not read contact` | `tickYiLive` 切片必须含 `resolveContactChannel` 与 `host.form.lexemes.contact`（`:382–384`） | **活路径等价**（都是源码包含检查）。静帧 `tickYiSortie` 的负向**未保留** | 无真空（活路径有牙）；静帧若被粘上活逻辑，闸门抓不到——残留风险，见问题 2 |
| 4 | `tickYiSortie must not walk` | `tickYiLive` 必须含 `stepYiWalk`（`:385`） | 同上 | 同上 |
| 5 | `tickYiSortie must not read stop-loss` | `tickYiLive` 必须含 `resolveStopLoss`（`:386`）；另有 `hitCore` / spawn 丢弃非法（`:407–419`） | 活路径等价；扣核路径比旧负向更具体（见 #15） | 无 |
| 6 | `tickBingSortie must not read contact / stop-loss` | `tickBingLive` 读接触与止损，且必须 `addChaos`，且切片**不得**出现 `hittable`（`:390–395`） | **加强**（补上上一轮「打不死关掉踩踏」的漏洞网） | 无 |
| 7 | `tickDingSortie must not morph / contact / stop-loss` | `tickDingLive` 必须含 `dingLiveRect`、接触、止损、`host.live`、价目两常量，且切片不得 `hittable`（`:397–405`） | **加强** | 无 |
| 8 | `sortie whitelist` 恰好旧六种 | `SORTIE_SUBSTRATE_IDS` 对 `enabledScope==='sortie'` 做 `sameSet`（`:116–129`）；显式 `includes` 残茎/栏柱/灰幕+概念三类（`:131–133`）；`drawSortie` 抽卡不得漏 gym 行（`:222`）；丁必须概念三类且不得油膜占空（`:227–233`） | **协议语义等价，机械强度略弱**：`SORTIE_SUBSTRATE_IDS` 由 codegen 从同一列生成，`:119–129` 的 sameSet 对生成物几乎恒真。真牙在抽卡循环 + 新六种 `includes` + 丁不得油膜。旧六种仍为 `sortie` **没有**闭表锁死 | 没有顺手删白名单而不补。若有人把「有机残影」翻回 `gym`，本闸门不会因为「少了旧六种」而红（问题 1） |
| 9 | `pairing: conceptual scope=sortie iff oil_film … no volume` | **保留**（`:143–146`）。G 另补：概念三类均为 `sortie`（`:147–150`）**且** `oil_film.sortieLegalOccupancies` 恰好 `['paint']`（`:151–154`） | **加强**（双条件仍在；开放后两边都钉死） | 无。iff 用的 `conceptualSubstratesOnSortie()` 是 `.some()`，但紧跟 `.every()` 三条都得是 `sortie`，不会出现「只翻一类」过闸 |
| 10 | `sortie must not hit corridor_watching` | 抽到则 `substrate === 'space_interval'` 且 `occupancy === 'volume'`（`:235–238`）；10×3 种子未命中再探 80 种子；`watchingHits > 0`（`:264–281`）；并禁 `shadowGymUtteranceForSortie`（`:196`） | **加强**（从禁止命中改为允许命中 + 行为约束） | 无 |
| 11 | （I3-B 新增）`rift-scene.ts` 不得 `from '@/gym/` / `from '../gym/` | `:336–338`，I3-B 加入，后续未删 | 新网，不是反转 | 只挡这两种前缀。当前 `rift-scene.ts` 全部 import 已核过，无 gym |
| 12 | （I3-A 新增）出击甲 `getForm()` 不是 role 三元 | 工厂必须有 `spawnData.form ??`，且不得出现无 `??` 的 role 三元赋值（`:423–431`） | **出击生成路径等价**（`check:layout` 另要求每条 spawn 有 form，且 `type` 与听噪一致）。工厂缺 form 时仍静默回退三元——任务书允许给默认课；spec `system-enemy-ai.md` 写「出击缺 form = 坏 spawn，禁止静默三元」，见问题 3 | 无漏删 |
| 13 | （I3-A 新增）一份 `contaminationDraw`；`create` 不得再调 `drawSortie` | `create` 体不含 `drawSortie`、必须读 `layout.contaminationDraw`、不得 `mix32(..., 'lexicon-hosts')`（`:441–450`）；布局种子 `mix32(inputSeed, 'lexicon')`（`:436–439`） | 等价（行为级：禁止二次抽卡） | 无 |
| 14 | （I3-E 新增）丁视觉 depth < 50；`ready === true` 时藏甲默认身体与乙丙丁几何漆 | `VOLUME_DEPTH === 40` 且 `< 50`（`:356–359`）；`rift-scene` 含 `d-mixed` / `setVisualSuppressed(true)` / `setSkipPaint(true)` / `ready !== true` / `VOLUME_DEPTH` / `visionMask: 50`（`:346–351`） | 深度是数字断言，**等价**。藏身体是标识符存在，不断言调用顺序；对照 `attachSchemeD`（`rift-scene.ts:1122–1131`）实际是先 `ready !== true` 才 suppress，强度够用 | 无。迷雾可读性按合同**未**写成机器 PASS |
| 15 | （I3-F 新增）出击路径对每个 host form 调 `resolveStopLoss`；`blockWalk && unkillable` 不得出现在 `drawSortie` 结果 | 抽卡循环：`stop !== 'illegal'` 且不得 `blockWalk && unkillable`（`:251–256`）；spawn 源码含 `resolveStopLoss(form) === 'illegal'`（`:419`）；活 tick 切片均含 `resolveStopLoss` | **抽卡结果有牙**。`contamination-draw.ts` 抽卡函数本身不调用 `resolveStopLoss`（靠孔谱矩阵 + 事后闸门 + spawn 丢弃）。当前甲 `legalContinuities` 只有 `monolith`，打不死只在 `field`，结构上甲挡走×打不死进不了抽卡 | 无漏删 |
| 16 | `gym map lesson must not enable gymLiveMotion` | 改名后两条负向：地图课不得出现 `gymLiveMotion`，也不得出现 `liveMotion`（`:367–369`） | **等价**（禁止标识符，与旧条同一手法） | 无。HEAD 地图课根本没有宿主，负向真空成立；工作区静帧 `hosts.create` 五参，仍不含该标识符 |

**总判：没有发现「负向被顺手删掉、正向完全没补」的真空。** 最需要知情的弱化是 #8 白名单从「闭表六 id」变成「跟 CSV 的 `enabled_scope` 走」（协议要求如此），以及 #3–#7 静帧 Sortie tick 不再被负向锁死。

各批是否只改自己那几条：I3-A/B 只**加**正向、没动出击 tick / 旧六种白名单；I3-G 才反转白名单与成句；I3-F 才反转 tick / 五参。符合「禁止顺手清别人的」。

---

## 15 项结论

| # | 项 | 结果 |
| - | -- | ---- |
| 1 | `src/scenes/rift-scene.ts` 是否 **不** import `src/gym/**` | **通过。** 生产 import 是 `@/entities/form-renderers/registry`（`:19`）。无 `@/gym/`、`../gym/`。闸门 `:336–338` |
| 2 | 地图课是否仍 **不** 打开 `liveMotion`（静帧宿主） | **通过（出击合同）+ 需注意（练习场地图课未入库）。** 出击：`rift-scene.ts:223` 传 `{ liveMotion: true }`。地图课 HEAD **没有** `ContaminationHostSystem`，故也不传该开关。工作区未提交的 `gym-map-scene.ts:206` 是五参 `hosts.create(..., gymFullVisibility)`，默认 `liveMotion === false`（`contamination-host-system.ts:182`） |
| 3 | 默认敌人课（无 `form` 的 spawn）是否仍能刷两种老像素 | **通过。** `src/gym/arena.ts:75–90` 的 `spawnFor` 不带 `form`。工厂 `:146–147` 缺省才 `role` 三元夹具，纹理仍走 `infiltrator-sprite` / `rewriter-sprite`（`:153–155`） |
| 4 | A/B/C 是否仍在 `src/gym/form-renderers/` 且未被改动 | **通过。** `a/**` `b/**` `c/**` 与 scheme-a/b/c 仍在。I3-B 仅把 `import type` 改指向 `entities` 接口（每文件约 2 行）；`a0336cb` 之后对这些路径 **零提交**。未删、未搬进 entities |
| 5 | 出击丁是否不再是油膜；配对不变量两边都成立 | **通过。** CSV 概念三类 + 残茎/栏柱/灰幕均为 `sortie`；油膜 `sortieLegalOccupancies: ['paint']`（`contamination-lexicon-data.ts:128–135、169–189`）。闸门保留 iff，并钉开放后两边。抽卡丁必须概念三类、不得油膜（`check-lexicon.ts:227–233`）。`shadowGymUtteranceForSortie` 已删除 |
| 6 | 打不死是否不扣核但仍伤人（丙踩踏 / 丁体积场没被 `hittable` 关掉） | **通过。** `hitCore` 活分支：`!stop.hittable` 则 `return`，在 `ENEMY_DAMAGED` 之前（`contamination-host-system.ts:823–826`）。`tickBingLive` `:649–666` 踩踏只看 `channel === 'step_chaos'`，不看 `hittable`。`tickDingLive` `:723–728` 体积场只看 `channel === 'volume_chaos_sight'`，不看 `hittable`。闸门 `:394–395`、`:405` 锁切片不得出现 `hittable` |
| 7 | `block_walk` 孔谱是否不可能 unkillable | **通过（结构 + 闸门）。** 甲 `blockWalk: true` 且 `legalContinuities: ['monolith']`（`contamination-lexicon-data.ts:194–205`）；打不死只在 field 行。乙丙丁 `blockWalk: false`。抽卡事后断言 `:253–256`；spawn `:437` 丢弃 `illegal`。`check:layout` 墙后连通仍过 |
| 8 | 听觉主轴是否仍恰好 1（过渡期 `rewriter === 1`） | **通过。** `check:layout` 每种子 `rewriter count === 1`，且 rewriter 的 form 为听噪、撤离门为视锥（`check-layout.ts:157–182`）。本跑 8 种子全过。布局放置失败会丢岛（`rift-layout.ts:642–643`） |
| 9 | 战斗价目未涨；`combat-system.ts` 无震屏 / 命中停顿 / 伤害数字（V3） | **通过。** I3 范围 `combat-system.ts` / `constants.ts` **空 diff**。乙 `ADJACENT_STRIKE_DAMAGE: 15` / `WINDUP_MS: 350`；丁 `VOLUME_CHAOS_PER_SEC: 1.0`、`VOLUME_SIGHT_MULT: 0.7`（`constants.ts:456–461`）。甲 `ENEMY_MAX_HEALTH: 75` = 三刀（`:404、418`）；核 `CORE_MAX_HEALTH: 50`（`:455`）。`combat-system.ts:805` 仍写明无震屏 / 命中停顿 / 伤害数字；文件内无 `shake` / `hitStop` / 伤害数字实现 |
| 10 | 丁视觉 depth 是否 40 且低于视野蒙层（约 50） | **通过。** `VOLUME_DEPTH: 40`（`constants.ts:466`）。`DEPTH.ding` 用该常量，`visionMask: 50`（`rift-scene.ts:69–73`）。宿主 attach 走 `depthForHostPin` → volume 用 `DEPTH.ding`（`:1147、1196–1199`） |
| 11 | 有无新精灵表 / 新色（亮核仅三色）/ 第三种人形覆盖体 / 头上字 | **通过（机械）。** I3 无新 PNG/精灵表。`CORE_TEALS` 仍是 `#1aad96` / `#2ae6c8` / `#3cffd4`（`jia-recipe.ts:26–30`）；乙丁丙亮核钳回这三色。`fragment-ramp.ts` 的板色是碎片量化用的既有裂隙板，不是新亮核。覆盖走剪影/簇/云，不是第三套走的人。`rift-scene` / `entities/form-renderers` 无 `add.text`。旁白是 DOM span，不是头上字。**好不好看等人终审** |
| 12 | `infiltrator-sprite.ts` / `rewriter-sprite.ts` 是否未被改动 | **通过。** `ac540cc^..HEAD` 对这两文件空 diff、无提交 |
| 13 | 迷雾：出击是否没有 `Math.max(0.2, visibility)` 打穿下限 | **通过（出击生产路径）。** 甲/乙改 `applyFormVisibility`：`visibility <= 0` 隐藏，否则原值 alpha（`form-renderer.ts:33–45`；`d/jia.ts:100`；`d/yi.ts:124`）。丙/丁 `visibility <= 0` 隐藏，否则 `setAlpha(pose.visibility)`（`d/bing.ts:71–93`；`d/ding.ts:207–218`）。`rift-scene` 采样 `getVisibilityAt` 原值（`:1167、1202–1212`）。闸门禁 `Math.max(0.2`（`:354、362–364`）。**冻结对照方案 A** 仍有 `Math.max(0.2, pose.visibility)`（`gym/form-renderers/a/jia-visual.ts:55`、`a/yi-visual.ts:142`）——句法课恒可见度 1，不出击。迷雾下亮度数人终审 |
| 14 | 三道闸门是否绿 | **通过。** 见文首 |
| 15 | 每批是否可独立回退（未把三层揉进一次提交） | **通过（切分）+ 回退注意事项。** 机制 `79f5b27`、内容 `34a258b`、视觉 `c8efe14` 三次提交。A/B/C/D 也各一批。I3-E 改了 `d/*.ts`，但是迷雾/钉点/纹理复用接线（去掉 `Math.max(0.2, visibility)`、丁跟宿主当前盒而不是观察院子），不是重画剪影族。**人若只回退 G 而留下 E：** 丁 form 会回到油膜占空，但方案 D 配方把未知基体画成余响云——正是合同要避免的可玩窗口，回退时必须两层一起动或先不要试玩丁 |

任务书 I3-QA 另 11 问（与上表重叠的不重复展开）：

| 问 | 结果 |
| -- | ---- |
| 甲 `getForm()` 是否来自布局抽卡，不是 role 三元 | **通过。** `attachLexiconForms` 给每条巡逻配 form，再 `jiaRoleFromForm`（`rift-layout.ts:761–763`）。`AISystem.spawnEnemy` 把带 form 的 spawn 交给工厂（`ai-system.ts:861`）。抽卡池甲是 2–3，巡逻 3–4 时用 `drawOne` 补，不是砍路点；`check:layout` 要求 `contaminationDraw` 甲条数 = 巡逻数 |
| 宿主是否二次 `drawSortie` | **通过。** `create` 只物化 `layout.contaminationDraw` 的非甲（`contamination-host-system.ts:184–194`） |
| `liveMotion` 出击 true、地图课 false | **通过**（见上表 #2） |
| 接触词素与止损是否在出击 `src/systems/` 被读取 | **通过。** 活 tick 与 `hitCore` / spawn 均在 `contamination-host-system.ts` |
| `corridor_watching` 若命中，基体是否间距 | **通过。** 闸门行为断言；成句表 `substrate: 'space_interval'`（generated `:459–463`） |
| 旁白节点是否仍分 span | **通过（机械 DOM）。** `encounter-narration.ts:113–127`：前缀一个 span，每个 `encounterNodes` 再一个 span。`displayTokenFor` 基体走 `SUBSTRATE_DATA.displayToken`（残茎/栏柱/灰幕/余响/散光/间距）。**是否读成一句复合名词等人终审（U9）** |

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec / 任务书依据 |
| -- | ---- | ------ | ---- | ---- | ----------------- |
| 1 | 闸门强度 | Low | 出击白名单 sameSet 对 codegen 派生的 `SORTIE_SUBSTRATE_IDS` 几乎恒真。新六种有 `includes`；旧六种仍为 `sortie` 没有闭表。抽卡循环仍能抓住 gym 行泄漏 | `check-lexicon.ts:116–133`；`generate.mjs:613` | 断言反转协议「SORTIE_SUBSTRATE_IDS 等于全部 sortie 行」——语义对，机械比旧「恰好六 id」弱 |
| 2 | 闸门缺口 | Low | 删掉 `tick*Sortie must not …` 后，静帧函数不再被负向锁。地图课（工作区）走 `else this.tickYiSortie`。若有人把活逻辑粘进 Sortie 函数，不传 `liveMotion` 也会游荡 | `contamination-host-system.ts:567–570、572–592`；旧负向删于 `79f5b27` | 协议要求补的是出击**活**路径正向，不是必须保留静帧负向。残留回归网 |
| 3 | 偏差 | Low | 工厂出击缺 `form` 时仍静默 `role` 三元夹具。生成器 + `check:layout` 目前保证裂隙 spawn 有 form | `enemy-factory.ts:146–147` vs `system-enemy-ai.md:177` | 任务书 I3-A 允许默认课回退；spec 对出击路径更严 |
| 4 | 风险 | Medium（仅练习场地图课） | 地图课挂静帧宿主仍未提交。HEAD 打开 `gym.html?lesson=map` **没有**乙丙丁宿主。工作区有宿主、不传 `liveMotion`。与迭代 2 QA 未入库地图课同类 | 工作区 `src/gym/gym-map-scene.ts`（HEAD 无 `ContaminationHostSystem`） | 红线 11 / gym 合同：地图课可画宿主，禁止打开活机制 |
| 5 | 过程 | Medium（回退时） | 内容层与视觉层按要求分提交，因此 `git revert 34a258b` 而留下 `c8efe14` 会重新出现「丁 form 是油膜、画面是概念云」 | `ding-recipe.ts` 未知基体回落 `sound_echo`；油膜占空只在 G 收回 | 红线 1 可独立回退 × 红线 8 禁止可玩窗口里丁仍是油膜 |
| 6 | Spec Issue | Low | `ui-encounter-narration.md` `interface-changed: false`，但新基体短名将第一次上屏。不阻塞机械对照 | 该 spec frontmatter | I3-D 合同；交给 design，本报告不改 spec |

未列为问题（已核过、成立）：

- `RiftScene` 不出现 `gymLiveMotion`；公有开关名 `liveMotion`。
- 方案 D `ready: true`；`attachSchemeD` 在 `create` 末尾调用（`rift-scene.ts:347`）。
- 乙活路径 `getVisualPin` 带 `wallAttachForTile` → `attach.seam*`（`contamination-host-system.ts:298–301`）；姿态用 `seamX/Y`（`rift-scene.ts:1177–1178`）。
- 甲人数跟地图 3–4，不用句法 2–3 砍巡逻。
- I3-B 对 D 使用 `git mv`（rename），A/B/C 留 gym。
- `infiltrator-sprite` / `rewriter-sprite` 未改；方案 D 甲走 `d/jia-*`。
- `setVisualSuppressed` 藏 Image / 残影 / 脱落尘 / 脚下污斑，保留 Arcade 与 AI 态指示物（`enemy-factory.ts:245–253、499–508`）。出击不用练习场调试核：`skipPaint` 时 `paintMarks` 隐藏（宿主 `:781–787`）。

---

## 游戏内 UI（机械层；不代勾）

本轮主体是世界实体（方案 D）+ 既有裂隙随身罩旁白。未新造面板。HOW 已读 `.cursor/skills/in-game-ux/SKILL.md`。权威清单 U1–U12 **不勾 PASS**。

可静态看见、仍不代人勾「好看 / 像游戏」：

- 旁白挂 `getDomUiRoot()` → `#dom-ui-root`（`encounter-narration.ts:48`），载体仍是裂隙随身罩。
- 上屏节点分 span（见上）。表名/档位不在本行。
- 世界层无头上字。

U1 载体感、U2 后台气味、U9 是否读成复合名词、U12 与参考贴合、审美：**等人终审**。

---

## 人试玩裂隙前需要知道的

1. **现在可以进裂隙看方案 D。** I3-E 与 I3-G 都已在 HEAD。不要用练习场句法课代替这次终审：句法课不开 `VisibilitySystem`、旁白也不在练习场。
2. **请人回答的仍是** `docs/progress/current-iteration.md` 那五问（迷雾下四孔谱是否可读；新基体旁白是否复合名词；打不死是否让人选择绕；危险区是否跟随且不挡路；首次踏入是否卡顿）。agent 不代勾。
3. **旁白会第一次打出** 残茎 / 栏柱 / 灰幕 / 余响 / 散光 / 间距。成句「走廊在看你」上屏短标记是「反视」，内部名不上屏。甲不再永远是有机残影。
4. **打不死的场仍然伤人**（丙踩踏混乱、丁视野×0.7 + 混乱/秒），挥击不扣核、不发 `ENEMY_DAMAGED`。不要当成免疫气泡。价目未涨。若试玩开始享受战斗，按合同本系统失败——那是体验判断，不是本报告能 PASS 的。
5. **丁 depth 40，在视野蒙层 50 之下。** 可见度 0 应完全隐藏，不应以 20% alpha 打穿迷雾。亮度好不好只问人。
6. **练习场：** 默认敌人课仍是两种老像素（无 form 回退）。句法课仍可并排 A/B/C/D。地图课：干净 HEAD **没有**乙丙丁宿主；若本地有未提交的 `gym-map-scene.ts`，会看到静帧宿主（不应游荡）。不要用地图课评出击活机制或方案 D 迷雾。
7. **不要标迭代 3 COMPLETE**，除非人试玩过出击或明确要求按「实现完成，体验未验证」收尾。
