---
status: DRAFT
created-by: art agent
created-when: 2026-08-16
last-modified: 2026-08-20
slice: 6
note: |
  Slice 6 收工（DEC-064）。残片身份走表维度。走法骨架与身份分开。色值只引用 art-direction §2.2 已锁名与 palette.json。
  每一次踏入必须抽 contaminationAge × ruinSeverity；禁止永远 standard+broken。两轴是收工交付，不是「可先不抽」。
  尘点是漆，出击中沿 AtmosphereField 的 windX/Y 随 phase 漂。无新色、无新 HUD。
  DEC-069：裂隙可走地面污染成品 = 崩坏簇（改写体身上那种青绿团落到地板）。生产画法 cluster。
  配色从该岛 RIFT_FRAGMENT_DATA 地板/墙 bias 推导 HSV，往青绿轴拉，按 contaminationAge 偏蓝/偏绿，再量化到已锁色板。
  禁止写死一组 CONTAM_* 当所有岛的污染色。禁止给 palette.json 加色。四档互不相同且离开该岛地板色。
  DEC-070：练习场活层已锁整团胀缩（人眼 PASS）。内核烤死；中间层与外层同一相位、几乎不透明，沿簇不规则外沿胀缩，幅度为休息大小的 5–20%。出击烤完整团，暂不挂活层。禁止沿圆周走鼓包、描轮廓星形、只长 1–2 像素、整团透明度、每帧重画整张地面 ImageData。
  晶结 / 溶蚀 / 平涂仅练习场对照。审美由人看。本文件不验收好看。
---

# 裂隙碎片地表（表驱动）

## TL;DR

每一次踏入抽一种「曾经是什么」。地面底色走已锁 L1，墙用不同形状语法。可走地面的环境污染成品是崩坏簇（与改写体同源的青绿团落到地板），不是矩形平涂错误块。接缝漏光可以仍在，簇是主签名（DEC-069）。虚空三种地方同一套 void-black。加第四种 = CSV 新行，不新开着色器。

本批只接通三行：`frag-outdoor` / `frag-clinic` / `frag-metro`。图书馆、居民区只留加行空位。无新 HUD、不重做小地图、不写撤离多样性、不碰音乐。每一次踏入必须抽 `contaminationAge` × `ruinSeverity`（DEC-064）；尘点是漆，不是碰撞。

---

## 具名参考

禁止套用这些游戏的色或皮。色只走本项目已锁 L1 / L2（量化终点仍是 `palette.json`）。

| 游戏 | 学什么动作 | 不学什么皮 |
| ---- | ---------- | ---------- |
| **Darkwood** | 有限视野下靠大型残块认路：一段脊、一截墙，不是胡椒粒 | 他们的森林绿、手摆独特建筑、昼夜 |
| **Signalis** | 地点有语法：诊所隔断、工业柱列；同一套故障盖在不同基体上 | 他们的像素色、线性手摆关、完整可逛的大楼 |
| **Rain World** | 有限种区域靠色温 + 材质 + 空间语法分清，不是无限群系 | 生态系统、手摆房间网；不要抄他们的区域色 |

---

## 全表共用（不许按种类分叉）

这些不是三种地方的差异轴。写进共享常量，不要做成每行一套。

| 项 | 锁 |
| -- | -- |
| 污染签名 | `art-direction.md` §4.2：崩坏簇为主签名。大小方差拉开；形状/边界随机（椭圆、缺角、噪声轮廓、条状抹痕、卫星瓣）。禁止统一圆球。不是液体，不是有机藤蔓，不是表面染色，不是网格对齐的矩形平涂 |
| 生产画法 | `cluster`。出击与练习场地图课同一套 painter。晶结 / 溶蚀 / 平涂仅练习场对照，**不得进出击** |
| 污染色 | 从该岛 `RIFT_FRAGMENT_DATA` 的 `floorBv`/`floorBias*` 与 `wallBv`/`wallBias*` 推导 HSV，往青绿轴拉，再按 `contaminationAge` 偏蓝或偏绿，最后 `nearestPalette` 量化到 `docs/art/palette.json`。公式随地图 L1 bias 走；年龄仍滑动蓝/绿。四档互不相同且离开该岛地板色。禁止写死一组 `CONTAM_*` 当所有岛的污染色。禁止给色板加新色 |
| 浓度表 | 只用已验证的轻度 / 标准 / 重度三行。递进靠簇的尺度与密度，不新开第四档表达 |
| 虚空 | `void-black` `#080a0c` 填实；远处暗示用 `deep-black` `#0a0b0d`。三种地方同一句：「外面没有世界」 |
| 虚空 ≠ 墙 | 虚空不画墙皮、不画顶沿高光、不挡视线（生成规格默认）。陆地轮廓靠可走掩膜，不靠一圈外框墙 |
| 量化 | 最终像素必须落在 `docs/art/palette.json`。中间运算可以有通道权重，禁止把非色板 hex 写成合同色 |
| 连续表面 | 仍走 DEC-018：世界坐标程序化，不换回离散 AI tile |
| 共享旋钮 | `ditherAmp = 12`，`shadowLen = 12`。墙的顶沿 / 南落影 / 侧 AO **结构**共用，只换 `wallBias*` 与 `wallBodyKey` |
| 渗缝 | 允许与簇并存，不是主签名，也不是种类差异轴。`tealPer100kPx2 = 1.6` 只约束练习场平涂对照若仍画缝时的标准浓度密度。种类行**不准**用不同渗缝密度来互相区分 |
| 连通 | 簇只经 `putFloorRgb` 漆在已连通的可走地板上。不改墙、不改碰撞。装饰不得拆连通 |
| 呼吸 | 练习场（DEC-070，人眼 PASS）：内核烤死；中间层与外层同一相位、几乎不透明，沿簇自己的不规则外沿整团胀缩，幅度为该团休息大小的 5–20%。钳可走地板。禁止沿圆周走鼓包（会读成旋转的花）。禁止描轮廓星形、只长 1–2 像素、整团透明度、每帧重画整张地面。出击烤完整团，暂不挂活层。 |

现实现把非墙格都画成户外地面。虚空格必须改走虚空填色，禁止把 L1 地铺出岛外。

---

## 表结构（加第四种 = 新行）

源：`data/rift-fragments.csv` → 构建期 `src/generated/`。身份字段对齐 `FragmentTypeDef`；视觉列按本表追加。禁止在 `procedural-surface.ts` 再手写第二套主题表。

```text
id, displayName, l1Key, sourceDomain, coverage, massGrammar, join, surfaceMaterial, enabled,
floorBv, floorBiasR, floorBiasG, floorBiasB,
stainKey, stainThreshold, stainStrength,
grimeAmp, macroAmp, scratchPer1000px2, fleckPer1000px2, scratchAngle,
wallBodyKey, wallRimKey, wallBv, wallBiasR, wallBiasG, wallBiasB,
featureWidthTiles, featureLengthTiles, featureCountMin, featureCountMax
```

| 列 | 替换现实现的什么 |
| -- | ---------------- |
| `l1Key` / `floorBias*` / `floorBv` | 地面 `bv * (0.88, 1.02, 0.82)` 写死户外橄榄 |
| `stainKey` / `stainThreshold` / `stainStrength` | 苔藓 lerp 到 `(0x12, 0x2a, 0x14)`（该 hex **不在**色板，必须废掉） |
| `grimeAmp` `macroAmp` `scratch*` `fleck*` | `const SURFACE = { ... }` 单例 |
| `scratchAngle` | 划痕全向随机 |
| `wallBodyKey` / `wallBias*` / `wallBv` | 墙 `bv * (1.0, 0.88, 0.75)` 写死暖石 |
| `massGrammar` + `feature*` | 体量怎么长。着色器只涂墙 bitmap，不在着色器里分叉墙算法 |
| `sourceDomain` / `coverage` / `join` | 残片身份。本 Slice 三行都是 mundane × remnant × single |
| `enabled` | 本 Slice 谁参与抽取 |

`scratchAngle` 只约束已有划痕线段的角度，不换基元：

| 值 | 含义 |
| -- | ---- |
| `free` | 现实现：0–2π |
| `orthogonal` | 吸附 0° / 90°（瓷砖缝） |
| `longitudinal` | 吸附本趟最长残块轴线；没有则吸附缓冲长边（站台走向） |

加行纪律：新 `id` + 已论证的 `l1Key` + 本列填满。新色必须先论证进 art-direction / `palette.json`——本任务禁止论证新色。着色器循环（噪声、划痕图、崩坏簇漆、可选接缝漏光、墙沿、抖动、量化）加行时不准加新 pass。

---

## 三种地方

通道权重不是色值。算完必须 `nearestPalette`。墙的体量由**生成器**按走法骨架 + `massGrammar` 落格；着色器按本行材质涂。

### `frag-outdoor` — 户外 / 土壤 / 公园

现 `procedural-surface.ts` 写死的就是这一行。接通表之后，本行数字应复现当前基线，不是重做一张户外。

| 项 | 值 |
| -- | -- |
| `l1Key` | `frag-outdoor` `#1a1e18` |
| 色温 | 深橄榄灰，被吞没的自然 |
| `surfaceMaterial` | `soil` |
| 地面材质残影 | 土：低频起伏当踩实/洼地；碎屑当砂石。渍是苔斑，不是锈、不是砖缝 |
| `floorBv` | `26` |
| `floorBiasR/G/B` | `0.88 / 1.02 / 0.82` |
| `stainKey` | `frag-outdoor`（废掉 `#122a14`） |
| `stainThreshold` / `stainStrength` | `0.72` / `0.40` |
| `grimeAmp` / `macroAmp` | `0.50` / `0.32` |
| `scratchPer1000px2` / `fleckPer1000px2` | `0.55` / `1.25` |
| `scratchAngle` | `free` |
| `massGrammar` | `ridge` |
| 墙的可读物 | **土脊 / 石**。田埂或园缘一样的长脊；脊上可粘 2×2～3×3 石团。禁止画成直隔断或等距柱 |
| 墙典型尺度 | 宽 **1** 格；长 **5–6** 格；每张图 **12–24** 段，铺开切开空地。禁止 1–2 格孤岛 |
| `wallBodyKey` / `wallRimKey` | `earth-dark` `#1a1c1f` / `brick-dark` `#2a1f1c` |
| `wallBv` | `24` |
| `wallBiasR/G/B` | `1.00 / 0.88 / 0.75` |
| 污染渗法 | 与另外两种相同：崩坏簇落到可走地板，色走该岛 bias 公式。本行**不**用蜿蜒裂缝冒充植物根 |
| 并排靠什么分清 | 橄榄底 + **弯的长脊**。禁止只把同一堆石头改成橄榄绿 |

### `frag-clinic` — 医院 / 实验室

| 项 | 值 |
| -- | -- |
| `l1Key` | `frag-clinic` `#1e2228` |
| 色温 | 冷蓝白灰，无菌不安 |
| `surfaceMaterial` | `tile` |
| 地面材质残影 | 瓷：划痕吸附正交，读成砖缝/勾缝，不是有机刮痕。渍是缝里脏灰，不是苔 |
| `floorBv` | `28` |
| `floorBiasR/G/B` | `0.86 / 0.92 / 1.08` |
| `stainKey` | `shadow-grey` `#151a1e` |
| `stainThreshold` / `stainStrength` | `0.78` / `0.25` |
| `grimeAmp` / `macroAmp` | `0.28` / `0.18` |
| `scratchPer1000px2` / `fleckPer1000px2` | `0.70` / `0.55` |
| `scratchAngle` | `orthogonal` |
| `massGrammar` | `enclosure` |
| 墙的可读物 | **隔断 / 瓷砖残**。1 格薄直墙；L；或缺一边的院子（三边、开口）。禁止封成房间+门廊。禁止土脊弧线，禁止等距柱列 |
| 墙典型尺度 | 宽 **1** 格；长臂 **5–6** 格；短臂 **3–4** 格；每张图 **12–24** 段。禁止大量 1–2 格残粒 |
| `wallBodyKey` / `wallRimKey` | `concrete-dark` `#2c2e33` / `bone-grey` `#3a3838` |
| `wallBv` | `30` |
| `wallBiasR/G/B` | `0.82 / 0.90 / 1.05` |
| 污染渗法 | 同崩坏簇。不是沿着瓷砖缝「长出来」的液体，也不是矩形贴图失败块 |
| 并排靠什么分清 | 冷底 + **细直角隔断**。禁止只把暖石改成冷灰 |

### `frag-metro` — 地铁 / 工业

| 项 | 值 |
| -- | -- |
| `l1Key` | `frag-metro` `#2a2018` |
| 色温 | 暖锈橙灰，机械衰败 |
| `surfaceMaterial` | `metal` |
| 地面材质残影 | 金属/站台：宏观起伏沿长轴（踩亮的一条）；渍是锈斑。划痕沿站台走向，不是乱刮，不是砖缝网 |
| `floorBv` | `24` |
| `floorBiasR/G/B` | `1.08 / 0.86 / 0.72` |
| `stainKey` | `brick-dark` `#2a1f1c` |
| `stainThreshold` / `stainStrength` | `0.68` / `0.35` |
| `grimeAmp` / `macroAmp` | `0.42` / `0.28` |
| `scratchPer1000px2` / `fleckPer1000px2` | `0.45` / `0.90` |
| `scratchAngle` | `longitudinal` |
| `massGrammar` | `slab` |
| 墙的可读物 | **嵌进岛的板片**：1–2 格厚的混凝土/锈板残段，缺口能穿，可贴 2×2 墩。禁止整节车厢、禁止浅灰月台带、禁止双轨图解 |
| 墙典型尺度 | 每段 **4–6** 格；每张图 **12–24** 段，铺开切开空地 |
| `wallBodyKey` / `wallRimKey` | `brick-dark` `#2a1f1c` / `metal-grey` `#4a4e55` |
| `wallBv` | `26` |
| `wallBiasR/G/B` | `1.10 / 0.82 / 0.68` |
| 污染渗法 | 同崩坏簇。锈是 L1/渍，不要把锈画成第二套污染 |
| 并排靠什么分清 | 锈底 + **板片残段**。禁止只把石头改成锈色，禁止再摆一节车 |

---

## 并排怎么分清（色温 + 形状，禁止只靠色）

L1 色值差只有 5–10。32px + 视野遮罩下，只换雾/亮度/底色标为不够（`system-map-generation.md` A28）。

| | 户外 | 医院 | 地铁 |
| - | ---- | ---- | ---- |
| 色温 | 橄榄 | 冷蓝灰 | 暖锈 |
| 地面残影 | 土 + 乱向刮痕 + 苔斑 | 正交砖缝 + 缝脏 | 长轴磨亮 + 锈斑 |
| 墙形状 | 弯/厚的脊 | 细直角围合残 | 锈板/混凝土板片 |
| 禁止的偷懒 | 直墙刷成土色 | 石堆刷成冷灰 | 石堆刷成锈色 |

验收问的是：多坨更小的体量铺在岛上，空地被切成能绕能穿的小院子/巷；三种碎片墙形不同。覆盖浅时可能还认得残影；指不出名字不算失败。

---

## 组合轴

`FragmentRoll = typeId × contaminationAge × ruinSeverity`。两轴只乘已有旋钮，不换表达。种类行决定「曾是什么」；组合轴决定「覆盖多深 / 残块多破」。污染主签名始终是崩坏簇，不随种类换成矩形块。

**DEC-064 收工交付（两轴都抽）：** 每一次踏入必须抽 `contaminationAge` ∈ {`new`, `standard`, `ancient`} 与 `ruinSeverity` ∈ {`intact`, `broken`, `eaten`}。禁止所有出击永远 `standard` + `broken`。禁止只抽年龄、残破永远停在 `broken`。

生成器抽失败、或调试入口未带组合轴时，**回退**仍是 `standard` + `broken`。回退只用于缺字段，不是生产路径。生产路径必须抽，不能永远走回退。

### `contaminationAge` → 浓度表 + 色相滑动

簇色**不**按年龄去色板里选死一行 `contam-*` 套所有岛。先走该岛地板/墙 bias 公式（见下「配色公式」），再按年龄把色相往蓝或往绿推。量化终点仍是已锁色板里的 L2 邻近色。`ancient` 若落到 `contam-ancient`，按 art-direction §14.4 **压饱和**，禁止原色铺开。

| `contaminationAge` | 浓度行 | 簇尺度 | 簇密度 | 色相滑动 | 可选接缝 |
| ------------------ | ------ | ------ | ------ | -------- | -------- |
| `new` | 轻度 | 小团 + 散点 | 稀疏 | 往蓝拉 | 可省 |
| `standard` | 标准 | 标准团 | 中等 | 青绿轴中位（仍随该岛 bias） | 可并存细线 |
| `ancient` | 重度 | 大团 + 卫星瓣 | 密 | 往绿拉 | 可并存 |

乱码（仅 `ancient` / 重度）：在量化后打 1px 错点，色取色板内非本行 L1 的暗色（`shadow-grey` 或 `bone-grey`）。不是新纹理，不是另一块碎片的底色铺上来。

禁止 `CONTAM_TEAL = contam-cold`（或任何一组写死的 `CONTAM_*`）冒充所有岛、所有年龄。医院新生和户外新生可以分清，靠的是隔断 vs 土脊，以及 bias 公式给出的不同青绿，不是「医院少 teal、地铁多 teal」，也不是网格矩形块的个数。

生产不得再用平涂矩形错误块当地面主签名。平涂仅练习场对照。不要用加粗折线冒充簇。

### 配色公式（别人改坏会出事）

输入：本趟 `RIFT_FRAGMENT_DATA[fragmentTypeId]` 的地板 `floorBv * floorBiasRGB`、墙 `wallBv * wallBiasRGB`，以及 `contaminationAge` 与本趟种子。

1. 两路 RGB 转 HSV。
2. 地图色相：若两路饱和都极低，落到青绿轴；否则取饱和更高的那路色相。
3. 往青绿轴拉（保留一部分地图色相，不要拉成与地板无关的霓虹）。
4. `contaminationAge`：`new` 往蓝、`ancient` 往绿、`standard` 不额外推。允许很小的种子抖动。
5. 饱和与明度随该岛 bias 缩放：暗橄榄岛不得与冷诊所岛共用同一套霓虹青绿。
6. 由该色相生成深 / 中 / 核 / 呼吸高光四档，**每一档** `nearestPalette`，且四档互不相同、并与该岛地板保持距离。禁止把中间 HSV 的 hex 写成合同色。禁止给 `docs/art/palette.json` 加色。

年龄仍滑动蓝/绿；色相会随碎片 L1 bias 走。旧句「色相只由年龄选行、不由碎片种类」作废。

### `ruinSeverity` → 材质残影（浓度表「暗色地面 / 可辨」侧）

不改污染主签名，不加藤蔓，不换墙语法。不把残破轴拿去改簇的形状语言。

| `ruinSeverity` | 对应浓度表哪一侧 | scratch 乘数 | fleck 乘数 | stainThreshold 偏移 | 墙沿 |
| -------------- | ---------------- | ------------ | ---------- | ------------------- | ---- |
| `intact` | 轻度：材质仍可辨，暗地约 90% | `0.70` | `0.70` | `+0.06`（渍更少） | 顶沿高光保留 |
| `broken` | 标准：仍可辨 | `1.00` | `1.00` | `0` | 现有顶沿 / 落影 / 侧 AO |
| `eaten` | 重度：几乎不可辨，暗地约 50–55% | `1.40` | `1.50` | `−0.10`（渍更多） | 顶沿减弱，侧 AO 加重 |

`ancient` + `eaten` = 大团更密 + 材质更糊。仍是崩坏簇 + 同一套噪声，不是第二种污染。

---

## 呼吸（三层活体，不是描边）

给 code 的死约束：

1. **地面像素烤一次。** 练习场只烤内核；出击暂烤完整团（活层未挂）。禁止每帧重画整张地面 ImageData，禁止每帧 `compositePaint`。
2. **活层是面积，整团胀缩。** 中间层与外层同一呼吸相位，几乎不透明，沿簇自己的不规则外沿填实。胀缩幅度是该团休息大小的 5–20%（每团随机）。中间层向内核叠一点，禁止核心与外层之间漏出地板。禁止沿圆周走鼓包。禁止描轮廓线。禁止整团透明度呼吸。
3. **甲：内核不动。** 收缩 = 外围收回，烤死的心仍在。膨胀不得进墙或虚空。
4. **出击这层先不挂。** 练习场人眼已过。禁止自行接到裂隙；等人要接时另开一小刀（迷雾下亮度待看）。
5. **无新色、无新 HUD。**

---

## 尘点（漆，不是碰撞）

氛围场合同在 `docs/design-notes/slice-6-layered-generation.md`「7–9 氛围场」。天空已用同一份场只改 `phase`（`src/systems/procedural-surface.ts` `RiftSurfacePainter`）。雾池烤死。DEC-064：尘点必须在出击中沿本趟 `windX/Y` 随 `phase` 漂，不再「以后再做」。无新色、无新 HUD。

给 code 的死约束：

1. **尘点 = 已烤 / 已采样的漆。** 不占 tile、不写 `walls[]`、不挡路、不加新粒子系统实体碰撞。装饰不得拆连通。
2. **动画 = 同一份 `AtmosphereField` 只改 `phase`。** 尘点位置沿本趟 `windX/Y` 平移，与天空胶囊同一根风轴。
3. **禁止每帧对整张 2048×1344 地表 `compositePaint`。** 地面（含雾）出击烤一次；尘点跟天空一样只扫 `phase`。
4. **雾池烤死。** 不要为了带动尘点去重烤雾。
5. **无新色、无新 HUD。** 尘点色只走已锁板；不上屏新读数、不新造标记。

---

## 扩展空位（本批不写完整参数）

策划表可先占行，`enabled = false`。视觉列留空或占位，**不要**抄户外数字改个 `l1Key` 充数。加行时按上面三种的同一组列填：L1、材质残影、墙可读物与尺度、渍键、划痕角度。污染轴复用组合表（崩坏簇 + bias 公式），不新开。

| `id` | `l1Key` | 预留 `surfaceMaterial` | 预留 `massGrammar` | 加行时墙必须读成 | 不要写成 |
| ---- | ------- | ---------------------- | ---------------------- | ---------------- | -------- |
| `frag-library` | `frag-library` `#2a2420` | `wood` | `enclosure` | 多段能穿的木板体量，不是书架道具 | 岛心一排完整架子 |
| `frag-residential` | `frag-residential` `#24221e` | `plaster` | `enclosure` | 多段灰泥围合残，缺边能穿 | 完整户型 / 门廊地牢 |

新色仍禁止。这两行用已锁 L1 即可。

---

## 给 code 的死约束

1. **读表。** 裂隙每次出击吃本次生成的 `fragmentTypeId`（经配方锚）。禁止再写死 `frag-outdoor`。禁止 `if (id === 'frag-outdoor')` 另开绘制 pass。画廊 PNG 是样例，不是要搬进游戏的图。
2. **CSV → generated。** 种类行进 `data/rift-fragments.csv`（或按 id 连接的 surfaces CSV）。禁止在 `procedural-surface.ts` 手写主题表再反向导出。
3. **加行不改着色器结构。** 新种类 = 新行。循环仍是：噪声、划痕/碎屑图、崩坏簇漆、可选接缝漏光、墙沿、抖动、量化。新行不准加液体层、藤蔓层、第三套墙几何。生产不得用平涂矩形错误块当地面主签名。
4. **必须改掉的写死点**（现文件）：
   - 头注释「outdoor rift feel using `frag-outdoor`」
   - `const SURFACE = { ... }` 单例
   - 一组 `CONTAM_*` 冒充所有岛、所有年龄的污染色（含 `CONTAM_TEAL = [0x1a, 0x7a, 0x9a]`）
   - 地面权重 `0.88 / 1.02 / 0.82`
   - 苔藓目标 `(0x12, 0x2a, 0x14)`（非色板）
   - 墙权重 `1.00 / 0.88 / 0.75`（暖石）
   - 签名只有 `(scene, map, key)`，没有碎片参数
   - 非墙格一律当地面（虚空会铺成户外地）
   - 划痕角度全向随机
   - 生产路径仍用平涂矩形错误块当地面主签名（平涂仅练习场对照）
5. **虚空。** 虚空格填 `void-black`。三种 `l1Key` 共用。不要医院白虚空、地铁隧道虚空、户外夜空。
6. **墙形在生成器。** 走法骨架 + `massGrammar` + `feature*` 决定落哪些墙格。着色器不根据种类改 rim 算法，只改 `wallBias*` / 键名。
7. **污染密度不是种类差异。** 禁止「医院少 teal、地铁多 teal」来拉开差异。
8. **默认组合。** 缺字段时回退：`contaminationAge = standard`，`ruinSeverity = broken`。生产路径每一次踏入必须两轴都抽；禁止永远走回退。
9. **无新 HUD。** 不上屏碎片名，不新造撤离/小地图标记。小地图机械层已交（DEC-063），本收工不重做。
10. **尘点是漆。** 见上文「尘点」五条。不占 tile、不挡路；同一份场只改 `phase`，沿 `windX/Y` 漂；禁止每帧整图 `compositePaint`；雾池烤死；无新色。
11. **生产画法 = cluster。** 出击与练习场地图课同一套 `bakeGround` / `RiftSurfacePainter`。晶结 / 溶蚀 / 平涂不得进出击。
12. **连通。** 只 `putFloorRgb` 可走地板。不改墙、不改碰撞。装饰层不得拆连通。
13. **呼吸。** 练习场三层活体（DEC-070）：内核烤死；中间层与外层同一相位、几乎不透明，沿簇不规则外沿整团胀缩，幅度 5–20%。禁止沿圆周走鼓包、描边星形、只长 1–2 像素、整团透明度。禁止每帧重画整张地面 ImageData。出击烤完整团，暂不挂活层。

---

## 机械层自检

- [x] 本文点名的色都在 `docs/art/palette.json` 与 `art-direction.md` §2.2：五套 `frag-*`、`void-black`、`deep-black`、`shadow-grey`、`earth-dark`、`brick-dark`、`concrete-dark`、`bone-grey`、`metal-grey`、`contam-cold` / `contam-mid` / `contam-core` / `contam-ancient`。没有新 hex。
- [x] 现实现苔藓 `(0x12, 0x2a, 0x14)` 已标为非法中间色，改指向 `frag-outdoor`。
- [x] 三种墙形状不同：脊 / 围合残 / 板片。并排栏写了禁止只换底色、禁止岛心完整器物。
- [x] 虚空统一：`void-black` + `deep-black`，三种地方同一句。
- [x] 生产污染是 §4.2 崩坏簇（DEC-069）；组合轴调簇尺度/密度与已有 `SURFACE` 旋钮。配色走该岛 bias 公式，年龄滑动蓝/绿，量化到已锁色板。
- [x] 每一次踏入必须抽两轴（DEC-064）。回退仍是 `standard` + `broken`，但生成器不能永远回退。
- [x] 图书馆 / 居民区视觉列已填（预留用，`enabled` 仍 false）。
- [x] 无新 HUD / 无 overlay 新皮。小地图不重做。预览 PNG 的粒子/波动是生成器烘焙，不是 HUD。
- [x] 尘点是漆：不占 tile、不挡路；同一份 `AtmosphereField` 只改 `phase`，沿 `windX/Y` 漂；禁止整图 `compositePaint`。
- [x] 呼吸：练习场整团胀缩已锁（DEC-070，人眼 PASS）；地面烤一次；出击活层仍不挂。
- [x] 连通：只 `putFloorRgb` 可走地板。
- [ ] 审美：等人看。本文不写结论。
