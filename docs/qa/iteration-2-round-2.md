---
status: DRAFT
created-by: qa agent（迭代 2 第二轮 R2-QA）
created-when: 2026-08-22
note: 机械对照 spec / 任务书 / DEC-080–082。不代勾审美 / 读作游戏 / PASS。
---

# QA：迭代 2 第二轮（方案 D，机械层）

日期：2026-08-22  
Spec：`docs/specs/system-contamination-lexicon.md`、`docs/specs/system-combat.md`、`docs/art/contamination-forms.md`「练习场方案 D」、`docs/tasks/iteration-2.md`「第二轮」+ Task R2-QA、DEC-080 / DEC-081 / DEC-082  
代码：第二轮提交 `470c4c3..5e696d3`（父提交 `e4783cf`；第一轮 T0 为 `ce0b379`）。HEAD = `5e696d3`

对照范围按任务书 7 问 + 人的 FATAL（出击是否真的没被改，含间接）。**审美与「读作游戏」标等人终审，禁止 PASS。**

闸门实测（本机工作区，2026-08-22）：`npx tsc --noEmit` 绿；`npm run check:lexicon` 绿；`npm run check:layout` 绿（8 种子 + `wall-edge-path` 集合相等）。干净第二轮 HEAD 上 `check:lexicon` **会红**（见问题 1）。

---

## 结论表（R2-QA 7 问 + 追加）

| # | 项 | 结果 |
| - | -- | ---- |
| 1 | `rift-scene.ts` 本轮 diff 是否为空 | **通过。** `e4783cf..HEAD` 与 `ce0b379..HEAD` 对该文件均为空。`RiftScene` 不出现 `gymLiveMotion`，`hosts.create` 仍是五参（`src/scenes/rift-scene.ts:210`） |
| 2 | `gymLiveMotion` 默认是否 false；出击乙核是否仍不移动 | **通过。** 字段默认 `false`（`contamination-host-system.ts:144`）；只在 `options?.gymLiveMotion === true` 时打开（`:163`）。出击走 `tickYiSortie` / `tickDingSortie`：核不移、盒不形变、不读 `lexemes.contact`（`:511–531`、`:609–630`）。句法课才传 `{ gymLiveMotion: true }`（`gym-lexicon-scene.ts:61`） |
| 3 | `collectWallEdges` 墙格集合是否未改 | **通过。** `src/generation/contamination-pins.ts` 本轮 diff 为空。`orderWallEdgeTiles` 在新文件里，且输出集合必须相等否则抛错（`wall-edge-path.ts:211–222`）。`spawnYi` 出生格仍读 `edge.tiles[slot]`，不换成有序路径（`contamination-host-system.ts:397–399`） |
| 4 | 有无新精灵表 / 新色 / 第三种人形覆盖体 / 头上字 | **通过（机械）。** 无新 PNG/精灵表；`palette.json` 本轮未改；亮核有钳回三色；覆盖档仍是族剪影叠簇，不是第三种走的人；世界层无 `add.text` / 名牌。侧栏 `#gym-roster` 的 `describeForm` 是开发说明（`gym-lexicon-scene.ts:431–444`）。**好不好看等人终审** |
| 5 | `lexemes.contact` 是否在 `src/systems/` 被读取（gym 路径） | **通过。** `resolveContactChannel(portfolio, form.lexemes.contact)` 仅 live tick：乙 `:545`、丙 `:590`、丁 `:644`；实现 `contamination-host-live.ts:286–305`。出击三条 Sortie 函数明确不读 |
| 6 | `check:lexicon` / `tsc` / `check:layout` 是否绿 | **不通过（干净提交树）。** 工作区三道全绿，但 `check:lexicon` 依赖未提交的 `gym-map-scene.ts`（问题 1）。`tsc` 与 `check:layout` 在提交树上也成立 |
| 7 | 出击 `drawSortie` 是否仍白名单旧六种 | **通过。** `SORTIE_SUBSTRATE_IDS` 恰好六 id（`contamination-lexicon-data.ts:513`）。`legalSubstrates` 加权前丢掉 `enabledScope !== 'sortie'`（`contamination-draw.ts:279–294`）。checker 对 10 种子 × 3 碎片断言无 gym 行，且丁基体为 `oil_film`、占位 `volume` |
| A | DEC-082：裂隙丁仍能出现且仍用油膜占空 | **通过。** CSV 油膜只 `paint`（`data/contamination-substrates.csv:6`）；codegen 在概念三类仍为 gym 时派生 `oil_film.sortieLegalOccupancies = ['paint','volume']`（generated `:121`；`generate.mjs:607–611`）。`occupanciesForScope(..., 'sortie')` 读派生列（`contamination-draw.ts:219–223`）。**没有**走 DEC-081 第 4 条「无 sortie 合法基体则改抽乙」 |
| B | 出击伤害价目 / 战斗 V3 | **通过。** `combat-system.ts`、`constants.ts` 本轮 diff 为空。乙仍 `ADJACENT_STRIKE_DAMAGE: 15` / `WINDUP_MS: 350`；丁仍 `VOLUME_CHAOS_PER_SEC: 1.0`、`VOLUME_SIGHT_MULT: 0.7`（`constants.ts:456–461`）。出击 Sortie tick 仍用这些常量。`drawVisuals` 仍写明无震屏 / 命中停顿 / 伤害数字（`combat-system.ts:805–807`） |
| C | 四张孔谱 `d/` 存在且 `scheme-d-mixed` 分发；`ready === true` | **通过。** `scheme-d-mixed.ts:12–26`：`ready: true`；`floor→jia` / `wall→yi` / `paint→bing` / `volume→ding`。四套入口 `d/jia.ts` `d/yi.ts` `d/bing.ts` `d/ding.ts` 均存在 |
| D | 文件归属（`a/**` `b/**` `c/**`；各孔谱只改自己的 `d/`） | **通过（硬边界）+ 轻微越界（见问题 3）。** 第二轮 `a/**` `b/**` `c/**` 与方案 A/B/C 入口文件 diff 为空。C4/C5 只动自己的 `d/`。C3/C6 额外改了句法课宿主隐藏与甲数量（gym 侧，不出击） |
| E | 审美 / 读作游戏 | **需人判断。** 禁止代勾 PASS |

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec / 任务书依据 |
| -- | ---- | ------ | ---- | ---- | ----------------- |
| 1 | 闸门自伤 | High | `check:lexicon` 断言地图课已有五参 `hosts.create(..., gymFullVisibility)`。第二轮提交树的 `gym-map-scene.ts` **没有** `ContaminationHostSystem`。干净 HEAD 上该断言失败。当前工作区未提交的地图课改动让闸门变绿——那份改动不在第二轮提交里 | `tools/contamination-lexicon/check-lexicon.ts:263–267`；HEAD `src/gym/gym-map-scene.ts` 无宿主 | R2 机器闸门必须绿；第二轮明确不做「改地图课生产外观」 |
| 2 | 出击识别面（spec 允许） | Low | 成句 `corridor_watching` 已改绑 `space_interval`（gym）。出击抽到该成句时走 `shadowGymUtteranceForSortie`：基体换成油膜、去掉 `utteranceId`。裂隙旁白不再出现「走廊在看你」。抽卡基体与乙/丁比例不变 | `contamination-draw.ts:361–382`；`check-lexicon.ts:199` | DEC-081 第 3 条「出击路径该成句本轮不命中」；人的 FATAL 是画面/关卡不要进裂隙，不是禁止这条识别面收口 |
| 3 | 文件归属偏差 | Low | C3 改了 `gym-lexicon-form.ts` / `gym-lexicon-scene.ts`（甲数量 2/4/5，默认 4）。C6 改了 `gym-lexicon-scene.ts`（方案 D 观察乙/丁时 `setSkipPaint`）。任务书写「只改 `d/jia-*` / `d/ding-*`」。功能需要，未改 A/B/C，未接到出击 | 提交 `db3387e`、`5e696d3` | 第二轮文件归属表 |
| 4 | 工作区脏文件（范围外） | Medium（试玩风险） | 未提交的 `src/gym/gym-map-scene.ts` 给地图课挂上出击同一套宿主（只画、`gymLiveMotion` 未传）。打开 `gym.html?lesson=map` 会看到乙丙丁占位几何，不是方案 D，也不是已提交的第二轮 | 工作区 `src/gym/gym-map-scene.ts` | 第二轮明确不做：不改地图课生产外观；FATAL：先到句法课 |

未列为问题（已核过、成立）：

- 方言表加入 gym 行后，出击过滤剩余权重与第二轮前相同（户外菌毯 3 / 油膜 3 / 有机残影 2 / 墙锈 1，其余碎片同理）；`preferYiDing` 未改。不是「先加权再丢掉」。
- 出击丁默认漆：`paintDing` 无 `live` 时用 `aabbPixelRect`，像素矩形与改前 `minCol*TILE … (max-min+1)*TILE` 相同（`contamination-host-live.ts:219–225` vs 改前 `contamination-host-system.ts` 的 `fillRect`）。
- `infiltrator-sprite.ts` / `rewriter-sprite.ts` 本轮未改。`d/jia-paint.ts` 无 `applyCoverageFail`。

---

## 通过的检查（机械）

- **出击场景文件零 diff。** 方案 D 无任何 `src/scenes/rift-scene.ts` import。
- **开关默认关。** 地图课提交树也不传第 6 参。live 函数 `stepYiWalk` / `dingLiveRect` 只在 `gymLiveMotion` 分支。
- **钉层集合。** `collectWallEdges` 未改；`check:layout` 对 8 种子断言 `orderWallEdgeTiles` 集合相等。
- **抽卡白名单 + DEC-082 配对。** 概念三类 `enabled_scope=gym`；油膜 gym 视图只占漆；出击视图仍占 `paint\|volume`；丁抽到仍是油膜占空，不是改抽乙。
- **接触词素。** gym live 读对照表 + `rewrite_to`；非法无 rewrite → `none`；丁 live 通道只有 `volume_chaos_sight` / `disperse_core`，没有打血。
- **价目与 V3。** 战斗系统本轮未加震屏 / 顿帧 / 伤害数字；乙 15/350、丁混乱与视野乘数未涨。
- **方案 D 分发。** 四孔谱实现存在，`ready: true`。下拉默认 `d-mixed`，A/B/C 文案带「对照（已冻结）」（`gym.html:141–145`）。
- **连通。** `d/` 无 `setCollision` / Arcade body。乙核 gym 在缝上，出击仍格心；都不进走廊碰撞体。
- **亮核三色。** `jia-recipe.ts` / `yi-recipe.ts` / `ding-recipe.ts` / `bing-dialect.ts` 的 `clampCoreTeal` / `snapBright` 钳到 `#1aad96` / `#2ae6c8` / `#3cffd4`。

---

## 审美 / U 项

本轮主体是世界内实体 + 句法课开发侧栏。侧栏合同写明不要翻修成墙机。

**U1–U12 与「好看」「像游戏」一律等人终审。本报告不勾 PASS。**

---

## 人试玩前需要知道的

1. **只开污染句法课。** `http://localhost:3000/gym.html?lesson=lexicon`。不要用出击、不要用默认敌人课来验方案 D。工作区若有未提交的地图课宿主，`?lesson=map` 上的乙丙丁是出击占位几何，不是方案 D。
2. **默认方案 D。** 下拉可切回 A/B/C 对照（已冻结）。切碎片身份应改院子 bias 和敌人 ramp；切基体应按孔谱过滤（甲看不到概念三类；丁下拉只有余响 / 散光 / 间距，没有油膜）。
3. **乙会沿墙走、丁盒会飘，只在本课。** 须开「感受伤害」才能看见抽打掉血；默认仍无敌。无敌时仍应能看见出手相与抽打地格点。
4. **出击（若对照）应仍是：** 乙核停在墙格心、丁油膜占空盒不动、甲两种程序像素、无方案 D 云/墙皮。若裂隙里看到游荡或概念基体，记为回归失败。
5. **审美不在本报告范围内。** 人否决外观 = 本轮视觉未过，即使上表机械项全绿。

---

## 建议（给后续 code，本报告不改代码）

1. **先修问题 1：** 要么从 `check-lexicon.ts` 拿掉「地图课必须已有 `hosts.create`」这条（改成「不得出现 `gymLiveMotion`」即可），要么把地图课宿主当作范围外任务单独交，不要绑在第二轮闸门上。
2. 不要把未提交的 `gym-map-scene.ts` 误当成方案 D 交付。
3. 成句「走廊在看你」出击关闭是设计允许的；人若要裂隙旁白仍出现该句，另开任务，不要悄悄改回油膜占空 CSV。
