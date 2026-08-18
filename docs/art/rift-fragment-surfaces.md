---
status: DRAFT
created-by: art agent
created-when: 2026-08-16
last-modified: 2026-08-17
slice: 6
note: |
  Slice 6 A1。残片身份走表维度。走法骨架与身份分开。色值只引用 art-direction §2.2 已锁名与 palette.json。
  审美由人看。本文件不验收好看。
---

# 裂隙碎片地表（表驱动）

## TL;DR

每一次踏入抽一种「曾经是什么」。地面底色走已锁 L1，墙用不同形状语法，污染仍是同一套 tilemap 数据错误（矩形 teal 块 + 接缝漏光）。虚空三种地方同一套 void-black。加第四种 = CSV 新行，不新开着色器。

本批只接通三行：`frag-outdoor` / `frag-clinic` / `frag-metro`。图书馆、居民区只留加行空位。本批不写 overlay、不写 HUD / 小地图新皮、不写撤离多样性、不碰音乐。

---

## 具名参考

禁止套用这些游戏的色或皮。色只走本项目已锁 L1 / L2。

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
| 污染签名 | `art-direction.md` §4.2：矩形、网格对齐、数据错误。不是液体，不是有机藤蔓，不是表面染色 |
| 污染色 | 只引用 L2 名（`contam-*`）。色相由 `contaminationAge` 选行，不由碎片种类选行 |
| 浓度表 | 只用已验证的轻度 / 标准 / 重度三行。不新开第四档表达 |
| 虚空 | `void-black` `#080a0c` 填实；远处暗示用 `deep-black` `#0a0b0d`。三种地方同一句：「外面没有世界」 |
| 虚空 ≠ 墙 | 虚空不画墙皮、不画顶沿高光、不挡视线（生成规格默认）。陆地轮廓靠可走掩膜，不靠一圈外框墙 |
| 量化 | 最终像素必须落在 `docs/art/palette.json`。中间运算可以有通道权重，禁止把非色板 hex 写成合同色 |
| 连续表面 | 仍走 DEC-018：世界坐标程序化，不换回离散 AI tile |
| 共享旋钮 | `ditherAmp = 12`，`shadowLen = 12`。墙的顶沿 / 南落影 / 侧 AO **结构**共用，只换 `wallBias*` 与 `wallBodyKey` |
| 渗缝基准 | `tealPer100kPx2 = 1.6` 对应浓度「标准」。种类行**不准**用不同渗缝密度来互相区分 |

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

加行纪律：新 `id` + 已论证的 `l1Key` + 本列填满。新色必须先论证进 art-direction / `palette.json`——本任务禁止论证新色。着色器循环（噪声、划痕图、渗缝、墙沿、抖动、量化）加行时不准加新 pass。

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
| 污染渗法 | 与另外两种相同：L2 矩形块 + 接缝折线。本行**不**用蜿蜒裂缝冒充植物根 |
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
| 污染渗法 | 同 L2。块仍是矩形贴图失败，不是沿着瓷砖缝「长出来」的液体 |
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
| 污染渗法 | 同 L2。锈是 L1/渍，teal 仍是数据错误，不要把锈画成第二套污染 |
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

`FragmentRoll = typeId × contaminationAge × ruinSeverity`。两轴只乘已有旋钮，不换表达。种类行决定「曾是什么」；组合轴决定「覆盖多深 / 残块多破」。本 Slice 可先只抽 `contaminationAge`，`ruinSeverity` 默认 `broken`。

### `contaminationAge` → 浓度表 + L2 色相

| `contaminationAge` | 浓度行 | 渗缝 / 块主体 | 块高亮 | `tealPer100kPx2` 乘数 | 矩形块 | 缝宽 |
| ------------------ | ------ | ------------- | ------ | --------------------- | ------ | ---- |
| `new` | 轻度 | `contam-cold` `#1a7a9a` | 无 | `0.35` | 无块；仅单像素异常 | 极细 / 可省 |
| `standard` | 标准 | `contam-mid` `#1a6b5c` | `contam-core` `#1aad96` | `1.00` | **1×1，3–5** | 细线（1px 折线） |
| `ancient` | 重度 | `contam-ancient` `#4adf8a`（按 §14.4 **压饱和**，禁止原色铺开） | `contam-core` | `2.20` | **2×2 / 3×3 簇，15–20+** | 粗（折线可 2px，仍是折线不是液体） |

乱码（仅 `ancient` / 重度）：在量化后打 1px 错点，色取色板内非本行 L1 的暗色（`shadow-grey` 或 `bone-grey`）。不是新纹理，不是另一块碎片的底色铺上来。

现实现把所有渗色写成 `CONTAM_TEAL = contam-cold`，且**只有折线、没有矩形块**。默认档若是 `standard`，渗色应改读 `contam-mid` / `contam-core`；块按上表补。不要用加粗折线冒充数据错误块。

`tealPer100kPx2` 不进种类行。医院新生和户外新生可以分清，靠的是隔断 vs 土脊，不是 teal 多少。

### `ruinSeverity` → 材质残影（浓度表「暗色地面 / 可辨」侧）

不改 L2 色相，不加藤蔓，不换墙语法。

| `ruinSeverity` | 对应浓度表哪一侧 | scratch 乘数 | fleck 乘数 | stainThreshold 偏移 | 墙沿 |
| -------------- | ---------------- | ------------ | ---------- | ------------------- | ---- |
| `intact` | 轻度：材质仍可辨，暗地约 90% | `0.70` | `0.70` | `+0.06`（渍更少） | 顶沿高光保留 |
| `broken` | 标准：仍可辨 | `1.00` | `1.00` | `0` | 现有顶沿 / 落影 / 侧 AO |
| `eaten` | 重度：几乎不可辨，暗地约 50–55% | `1.40` | `1.50` | `−0.10`（渍更多） | 顶沿减弱，侧 AO 加重 |

`ancient` + `eaten` = 重块 + 材质更糊。仍是数据错误 + 同一套噪声，不是第二种污染。

本 Slice 未抽残破度时：`ruinSeverity = broken`。

---

## 扩展空位（本批不写完整参数）

策划表可先占行，`enabled = false`。视觉列留空或占位，**不要**抄户外数字改个 `l1Key` 充数。加行时按上面三种的同一组列填：L1、材质残影、墙可读物与尺度、渍键、划痕角度。污染轴复用组合表，不新开。

| `id` | `l1Key` | 预留 `surfaceMaterial` | 预留 `massGrammar` | 加行时墙必须读成 | 不要写成 |
| ---- | ------- | ---------------------- | ---------------------- | ---------------- | -------- |
| `frag-library` | `frag-library` `#2a2420` | `wood` | `enclosure` | 多段能穿的木板体量，不是书架道具 | 岛心一排完整架子 |
| `frag-residential` | `frag-residential` `#24221e` | `plaster` | `enclosure` | 多段灰泥围合残，缺边能穿 | 完整户型 / 门廊地牢 |

新色仍禁止。这两行用已锁 L1 即可。

---

## 给 code 的死约束

1. **读表。** `createRiftSurfaceTexture` 必须吃本次 `fragmentTypeId` + `FragmentRoll`（或已 join 好的行）。禁止再写死 `frag-outdoor`。禁止 `if (id === 'frag-outdoor')` 另开绘制 pass。
2. **CSV → generated。** 种类行进 `data/rift-fragments.csv`（或按 id 连接的 surfaces CSV）。禁止在 `procedural-surface.ts` 手写主题表再反向导出。
3. **加行不改着色器结构。** 新种类 = 新行。循环仍是：噪声、划痕/碎屑图、渗缝、矩形错误块、墙沿、抖动、量化。新行不准加液体层、藤蔓层、第三套墙几何。
4. **必须改掉的写死点**（现文件）：
   - 头注释「outdoor rift feel using `frag-outdoor`」
   - `const SURFACE = { ... }` 单例
   - `CONTAM_TEAL = [0x1a, 0x7a, 0x9a]`（`contam-cold` 冒充所有年龄）
   - 地面权重 `0.88 / 1.02 / 0.82`
   - 苔藓目标 `(0x12, 0x2a, 0x14)`（非色板）
   - 墙权重 `1.00 / 0.88 / 0.75`（暖石）
   - 签名只有 `(scene, map, key)`，没有碎片参数
   - 非墙格一律当地面（虚空会铺成户外地）
   - 划痕角度全向随机
   - 只有折线渗缝，没有浓度表里的矩形 teal 块
5. **虚空。** 虚空格填 `void-black`。三种 `l1Key` 共用。不要医院白虚空、地铁隧道虚空、户外夜空。
6. **墙形在生成器。** 走法骨架 + `massGrammar` + `feature*` 决定落哪些墙格。着色器不根据种类改 rim 算法，只改 `wallBias*` / 键名。
7. **污染密度不是种类差异。** 禁止「医院少 teal、地铁多 teal」来拉开差异。
8. **默认组合。** 未抽轴时：`contaminationAge = standard`，`ruinSeverity = broken`。
9. **本批不画 overlay。** 不上屏碎片名，不新造撤离/小地图标记。

---

## 机械层自检

- [x] 本文点名的色都在 `docs/art/palette.json` 与 `art-direction.md` §2.2：五套 `frag-*`、`void-black`、`deep-black`、`shadow-grey`、`earth-dark`、`brick-dark`、`concrete-dark`、`bone-grey`、`metal-grey`、`contam-cold` / `contam-mid` / `contam-core` / `contam-ancient`。没有新 hex。
- [x] 现实现苔藓 `(0x12, 0x2a, 0x14)` 已标为非法中间色，改指向 `frag-outdoor`。
- [x] 三种墙形状不同：脊 / 围合残 / 板片。并排栏写了禁止只换底色、禁止岛心完整器物。
- [x] 虚空统一：`void-black` + `deep-black`，三种地方同一句。
- [x] 污染仍是 §4.2 数据错误；组合轴只调浓度表与已有 `SURFACE` 旋钮。
- [x] 图书馆 / 居民区视觉列已填（预览用，`enabled` 仍 false）。
- [x] 无 overlay / HUD / 小地图新皮。预览 PNG 的粒子/波动是生成器烘焙，不是 HUD。
- [ ] 审美：等人看。本文不写结论。
