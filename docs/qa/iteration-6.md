---
status: DRAFT
created-by: qa agent（迭代 6 I6-QA）
created-when: 2026-08-24
note: 碎片配色机械对照。不代勾「色温好不好看 / 簇好不好看 / 四张画面上是否可分 / PASS」。不要标迭代 6 COMPLETE。波 5 人终审本轮不开。
---

# QA：迭代 6（碎片配色 / 世界美术，机械层）

日期：2026-08-24  
合同：`docs/tasks/iteration-6.md` Task I6-QA（11 问）  
地表口径：`docs/art/rift-fragment-surfaces.md`「身份指纹闸门」  
DEC：088 / 089 / 090 / 093 / 094 / 095 / 096  
代码：HEAD `7008e45` + 工作区未提交的 I6-C/D/E/F 产物（`preview-paint.ts`、`fragment-ramp.ts`、`data/rift-fragments.csv`、`check-contam-floor-contrast.ts` 等）。本报告核工作区磁盘。

闸门实测（工作区，2026-08-24）：

| 命令 | 结果 |
| ---- | ---- |
| `npm run check:contam-floor-contrast` | 绿。四张 CIE76 最小 25.1–39.3；青绿新生 0.12–0.18%、标准 0.39–0.43%、古老 1.70–1.76%；`|{shape[id]}| == 4`；修前夹具会红；敌人样本四档最小 CIE76 25.1–39.3 |
| `npm run check:ruins` | 绿。`ruin checks passed (24/24 random seeds usable)`。枚举四张（含旧图书馆、不含居民区公寓）；段数上下限读各行 `featureCountMin` / `featureCountMax` |
| `npm run check:layout` | 绿。8 种子，含 `frag-library` 两次；墙后可走仍过 |

**「色温好不好看 / 簇好不好看 / 四张在画面上是否可分」一律等人终审（波 5）。本报告不勾 PASS。不要标迭代 6 COMPLETE。**

I6-C art 最短核（已核，不挡、不问人、不改烤漆）：四条合规过。观察记于第 4 问。

界面：本迭代不是面板，**不过** U1–U12。

---

## I6-QA 11 条

| # | 项 | 结果 |
| - | -- | ---- |
| 1 | 四张烤图身份指纹是否按 art 口径可分；是否仍用「第一层落格互不相同」当成功；旧图书馆身份列是否仍与户外逐字相同 | **是 / 否 / 否。** 见下 |
| 2 | 户外 / 地铁新生、标准地面青绿是否仍 0.00%；旧图书馆是否零着色交差 | **否 / 否。** 见下 |
| 3 | 是否存在共用对比度命令；迭代 5 文档是否指向同一命令；命令是否覆盖四张 | **是 / 是 / 是。** 见下 |
| 4 | 地面烤漆与敌人渐变是否仍各写一份无约束量化 | **否（L2 已共用）。** 非青绿再量化仍 `nearestPalette`，机械发现，不拍板 |
| 5 | 是否改了连通 / 墙 / 每帧重烤地面 | **否（连通算法与活层协议未改）。** 残墟段数/宽度随 I6-F 身份列变，墙后连通仍过 |
| 6 | 是否改了 `palette.json` 或整体提高地板亮度；偏置平均是否被抬出 0.887 ± 5% | **否 / 否。** 本迭代未改色板、未抬 `floor_bv`、未改四张 `floor_bias` |
| 7 | 是否让污染色承担碎片身份 | **否。** |
| 8 | 旧图书馆是否已启用且残墟检查覆盖四张；居民区公寓是否仍未启用；是否另开独立簇生成器或抽卡权重列 | **是 / 是 / 否。** |
| 9 | 迭代 5 默认甲绘制路径是否被本迭代顺手改掉 | **否。** |
| 10 | 四列死数据是否已删；`surface_material` 是否仍只接脚步、未发明绘制路径 | **已删 / 是。** |
| 11 | I6-P 快照是否仍在；是否在未过等价闸门时加了新参数点 | **快照文件仍在；未在 I6-P 之前加新点。** 医院/地铁夹具漂是 I6-F 填列，不是拆档破坏三个预设 |

---

### 1. 身份指纹 / 落格 / 身份列

**四张烤图身份指纹按 art 口径可分：是。**

`npm run check:contam-floor-contrast`（2026-08-24）取样 `generateRuins` → `paintRuinedMask`，断言 `|{shape[id]}| == 4`：

| 碎片 | shape 键 | jog | gap | turn | cap | w | face |
| ---- | -------- | --- | --- | ---- | --- | - | ---- |
| `frag-outdoor` | `3\|6\|1\|widen\|2\|高` | 3 | 6 | 1 | widen | 2 | 高 |
| `frag-clinic` | `1\|14\|1\|widen\|4\|双峰` | 1 | 14 | 1 | widen | 4 | 双峰 |
| `frag-metro` | `2\|10\|1\|pier\|4\|低` | 2 | 10 | 1 | pier | 4 | 低 |
| `frag-library` | `3\|8\|1\|widen\|3\|双峰` | 3 | 8 | 1 | widen | 3 | 双峰 |

修前夹具把图书馆 shape 拷成户外后，闸门红：`|{shape[id]}| = 3 want 4`。口径与说明书「身份指纹闸门」一致：先验烤图 `shape`，禁止地板众数 / 语法枚举名 / 交并比。

**是否仍用「第一层落格互不相同」当成功：否。**

闸门 `failShapes` 只比 shape 六元组。对比度表里地铁与旧图书馆地面主色都是 `#2a1f1c`，闸门仍绿。`check-contam-floor-contrast.ts:653` 写明禁止地板众数。`probe-bias-baked.ts` 是诊断探针，不是本迭代验收命令。

**旧图书馆身份列是否仍与户外逐字相同：否。**

`data/rift-fragments.csv` 现表（工作区）：户外 `ridge / jog 4/1 / gap 0 / stub / random / stain frag-outdoor 0.72/0.40 / grime 0.50/0.32 / scratch 0.55/1.25 free/0 / 段数 12–24`；旧图书馆 `ridge / jog 6/1 / gap 2 random / none / axis / stain frag-library 0.60/0.30 / grime 0.34/0.20 / scratch 0.80/0.70 longitudinal/0.35 / 段数 10–16 / 墙偏置 1.02/0.93/0.68`。不是复制粘贴。

机械发现（不升级给人、不挡第 1 问）：`buildMass` 仍 `resolveMassGrammar(def.massGrammar)` 走名称预设（`masses.ts:331,486`），不读 CSV 的 `jogPeriod` / `gapCount` / `capKind` / `facingPolicy`。图书馆 `mass_grammar=ridge`，与户外同走脊预设 `{turns:0, jogPeriod:4, gaps:0, cap:stub}`。烤图 shape 仍四套互异（段数 10–16 vs 12–24 等）。`scratchDispersion` 已落表，但 `csvScratchToMuSigma` 把 `sigma` 写死为 0（`preview-paint.ts:119–131`），划痕主角度枚举已接。

画面上四张是否读成四个世界：**等人波 5。禁止通过。**

---

### 2. 地面青绿占比

**户外 / 地铁新生、标准仍为 0.00%：否。旧图书馆零着色交差：否。**

`check:contam-floor-contrast` 青绿表（烘焙图全部像素、青绿家族集合，与 `measure:ground-teal` 同口径）：

| 碎片 | 新生 | 标准 | 古老 |
| ---- | ---- | ---- | ---- |
| `frag-outdoor` | 0.18% | 0.43% | 1.70% |
| `frag-clinic` | 0.12% | 0.41% | 1.76% |
| `frag-metro` | 0.12% | 0.40% | 1.72% |
| `frag-library` | 0.12% | 0.39% | 1.70% |

门限：新生 ≥ 0.10%、标准 ≥ 0.30%、古老 ≥ 1.00%（I6-C 已按簇覆盖下调）。四张全过。修前夹具把户外/地铁新生+标准写成 0.00% 后闸门红。

簇好不好看：**等人波 5。禁止通过。**

---

### 3. 共用对比度命令

**存在共用命令：是。** `package.json` `"check:contam-floor-contrast"` → `tools/contam-preview/check-contam-floor-contrast.ts`。`measure:ground-teal` 是同文件 `--teal-only` 包装。

**迭代 5 文档指向同一命令：是。** `docs/tasks/iteration-5.md` 第 69、313、416、418 行点名 `npm run check:contam-floor-contrast`，禁止另写一套阈值。

**命令覆盖四张：是。** `GATE_FRAGMENTS = ['frag-outdoor','frag-clinic','frag-metro','frag-library']`。静态合同禁止居民区公寓进闸门。本跑四张 CIE76 / 青绿 / shape 均过。

---

### 4. 无约束量化是否仍各写一份

**地面 L2 与敌人渐变仍各写一份无约束量化：否。**

- 地面 `deriveContamRamp`（`preview-paint.ts:1074–1102`）四档走 `quantizeInGroup` 进青绿子集。
- 敌人 `deriveFragmentContamRamp`（`fragment-ramp.ts:88–92`）调用同一份 `deriveContamRamp(def, 'standard', seed)`。闸门敌人样本四档最小 CIE76 与地面合同同一条 ≥ 18。

**机械发现（I6-C art 观察；不挡、不问人、不改烤漆）：** 非青绿像素的生产再量化仍走无约束 `nearestPalette`（`preview-paint.ts:174–198` `quantizePaintPixel`：青绿走 `quantizeInGroup`，否则全色板最近）。L2 簇选色未走这条。院子 `yardSurfaceColors` 仍 `nearestPalette`（只给观察院子，不是出击烤地）。甲/乙/丙配方里另有 `nearestPalette` 调色，不是四档 ramp 的第二份拷贝。

---

### 5. 连通 / 墙 / 每帧重烤

**是否改了连通算法、加墙当装饰、每帧重烤地面：否。**

- `bakeGround` 仍只在 `RiftSurfacePainter.mount`（`procedural-surface.ts:73`）。`update` 只 `paintPulse`（已烤簇的中间/外层）+ `paintSky`（同场改 `phase`）。`compositePaint` 注释写明不要进活循环。
- `openSealedFloors` / 墙后四连通验收仍在。`check:ruins` 每种子 `leftoverConnected`；`check:layout` 8 种子绿（含旧图书馆）。
- I6-P 改了 `buildMass` / `gridWant`（等价重构，合同允许）。I6-F 按配方改了医院地物长/段数与地铁 `feature_width_tiles=2`（DEC-095，不升级给人）。这不是为修色另写生成算法，也不是每帧重烤。

---

### 6. 色板 / 地板亮度 / 偏置钳

**是否改了 `palette.json`：否。** 工作区对该文件无 diff。最近提交 `6b8a666`（2026-07-24）。

**是否整体提高地板亮度：否。** 四张 `floor_bv` 相对 HEAD 未动：户外 26、医院 28、地铁 24、图书馆 26。

**偏置平均是否被本迭代抬出 0.887 ± 5%：否。** 四张 `floor_bias_*` 相对 HEAD 未动（说明书「地板偏置不动」）。现表平均：户外 0.907、地铁/图书馆 0.887，在 [0.843, 0.931]；医院实验室 0.953 是原表，不是本迭代抬出。不升级给人。

色温好不好看 / 暗地是否仍「极度压暗」：**等人波 5。禁止通过。**

---

### 7. 污染色是否承担碎片身份

**否。**

`deriveContamRamp` 注释写明 fragments 不做色相分工；年龄只在夹窗 `[0.42, 0.56]` 内滑动。四张共用同一四档子集。闸门对比度表：地铁与图书馆地面主色同为 `#2a1f1c`、四档 CIE76 同为 42.5 / 30.4 / 68.6 / 89.1——污染没有给四张世界各一套色相。I6-C art 最短核第 2 条已核「污染不分工」。

---

### 8. 启用范围 / 簇 / 抽卡

**旧图书馆已启用，残墟检查覆盖四张：是。** `RIFT_FRAGMENT_DATA['frag-library'].enabled === true`。`check-ruins.ts:25` 枚举四张；`render-ruins.ts` 同。本跑 24/24。

**居民区公寓仍未启用：是。** CSV `enabled=false`；闸门与残墟检查均断言保持假。

**是否另开独立簇生成器或抽卡权重列：否。** `MASS_GRAMMAR_PRESETS.cluster` 是同一 `buildMass` 上的第四个预设点（`masses.ts:81–104`），没有 `clusterCells` 一类独立生成器。`pickFragmentTypeId` 对已启用行 `seed % rows.length` 等权（`ruins.ts:158–162`），策划表无权重列。

地铁次轴宽度 2（DEC-095）按配方落地，不升级给人。段数闸门读策划表（DEC-096），`check:ruins` 绿，不把表和闸门打架升级给人。

---

### 9. 默认甲绘制路径

**否，未被本迭代顺手改掉。**

出击 `RiftScene.attachSchemeD` 仍 `getFormRenderer('d-mixed')` → `attachJiaD`（`rift-scene.ts:1124–1132`；`scheme-d-mixed.ts:18–19`）。基因谱 `attachJiaGenomeD` / `attachGymFormVisual` 只挂句法课 / 陈列馆（`genome/attach.ts:48–60`）。`d/jia.ts` 本迭代无 diff。乙丙丁拓扑未改，只换配色入口（I6-D）。

---

### 10. 死列 / `surface_material`

**四列已删：是。** CSV 表头与 `src/generated/rift-fragment-data.ts` 无 `wall_body_key` / `wall_rim_key` / `l1_key` / `source_domain`。`tools/csv-codegen/generate.mjs:261–267` 把这四列列为禁止列，出现即抛错。

**`surface_material` 仍只接脚步、未发明绘制路径：是。** 生产读取仅 `rift-scene.ts:705–709` `stepKey()`（metal / soil|wood / 默认水晶）。`preview-paint.ts` 不读该列。灰泥 `plaster` 仍未进映射（落到水晶），合同本迭代不补。

---

### 11. I6-P 快照 / 新参数点

**快照文件仍在：是。** `tools/map-preview/fixtures/i6-p-mass-grammar.json`（`capturedAt` 2026-08-23T16:28:44Z；18 例；户外 / 医院 / 地铁 × 种子 101–606）。三个旧预设常量仍是 I6-P 合同值（`masses.ts:94–96`）。

现跑 `snapshot-i6-p.ts check`：户外 6/6 仍逐字节；医院 / 地铁 12 例 `walkable mask` 漂。原因是 I6-F 按配方改了医院 `feature_length_tiles` 6→5、段数 12–24→14–22，以及地铁宽度 1→2、段数 12–24→10–16（DEC-095）。这是身份列填完后残墟输出应变，不是 I6-Q 拆档把三个预设漂掉。不升级给人。

**是否在未过等价闸门时加了新参数点：否。** 簇预设点在 I6-Q（I6-P 已交之后）写入 `MASS_GRAMMAR_PRESETS.cluster`。I6-P 快照枚举仍是旧三张，不含居民区公寓。

---

## 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec / 合同依据 |
| -- | ---- | ------ | ---- | ---- | --------------- |
| 1 | 偏差 | Medium | CSV 身份向量列（错位 / 缺口 / 末端 / 朝向）已填且与户外不同，但 `buildMass` 仍按 `mass_grammar` 名称走预设。图书馆与户外同走脊预设。烤图 shape 闸门仍四套互异 | `masses.ts:331,486,565–574`；CSV `frag-library` | I6-F「配方点名的列」进画面；说明书身份指纹先验烤图 `shape`（本跑已绿）。程序自洽，不升级给人 |
| 2 | 偏差 | Low | `scratchDispersion` 已落表，采样把 σ 写死为 0 | `preview-paint.ts:119–131` | I6-Q「划痕内部是 (μ, σ)」。主角度枚举已接。不升级给人 |
| 3 | 观察 | Low | 非青绿生产再量化仍无约束 `nearestPalette`；L2 簇选色未走这条 | `preview-paint.ts:174–198` | I6-C art 最短核观察；合同第 4 条。不挡、不问人 |

未列为问题：DEC-095 地铁宽度 2；DEC-096 闸门读表；医院偏置平均 0.953 为原表未动；I6-P 夹具在 I6-F 填列后对医院/地铁不再逐字节（见第 11 问）。

---

## 通过的检查（摘要）

- 共用闸门绿：CIE76 ≥ 18、青绿占比、烤图 shape 四套、修前夹具有牙、敌人样本同合同
- 户外 / 地铁新生与标准青绿非 0；旧图书馆非零着色
- 身份列图书馆 ≠ 户外；成功标准不是第一层落格
- L2 地面与敌人同一份 `deriveContamRamp`
- 未改 `palette.json`、未抬 `floor_bv`、未改 `floor_bias`；未每帧重烤地面
- 污染无碎片色相分工
- 旧图书馆启用；残墟 / 布局覆盖四张；居民区公寓未启用；无线上独立簇生成器、无抽卡权重列
- 出击默认甲仍 `d-mixed` → `attachJiaD`
- 四列死数据已删；`surface_material` 只接脚步
- I6-P 快照文件与三个旧预设常量仍在；簇点在 I6-Q 之后才加

---

## 好看

**不代勾，等人波 5。**

合同验证问题 1–6（四张画面上是否可分、青绿能否读出、污染是否仍只在青绿里、敌人是否淹没、暗地是否仍压暗、路是否仍通）是人看地图课的题。机械层通过 ≠ 迭代 COMPLETE。禁止用本报告代勾 PASS。不要标迭代 6 COMPLETE。不要开波 5。

建议打开：`http://localhost:3000/gym.html?lesson=map`（无迷雾，看出击同一套生成 + 烤地）。不要用裂隙迷雾代勾本迭代，也不要代勾迭代 3。
