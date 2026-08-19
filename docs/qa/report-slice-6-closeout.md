---
status: REVIEW
created-by: qa agent
created-when: 2026-08-19
slice: 6
task: DEC-064 closeout
note: |
  Slice 6 收工三件（换路硬保证 / 尘点沿风 / 年龄×残破）。对照 spec 机械验收。
  本收工无新 HUD。小地图 DEC-063 机械层已交，不重验审美。
  人终审 / 审美不作为本报告门禁。不标 Slice COMPLETE。
---

# QA Report: Slice 6 收工三件（DEC-064）

日期：2026-08-19  
Spec 版本：`docs/specs/system-map-generation.md` 规则 21 / 24a / 5 / 8 / 16a / 16b（`last-modified-date: 2026-08-19`）；`docs/specs/system-chaos-scavenge-extract.md` 规则 21 换路归属句；`docs/art/rift-fragment-surfaces.md` 组合轴 + 尘点五条；`.cursor/rules/map-generation-connectivity.mdc`；`.cursor/rules/map-generation-strategy.mdc`  
代码版本：`262da2a`（`feat(slice-6): 换路硬保证、尘点沿风、年龄×残破接入生成器`）  
范围：DEC-064 三件。不是全 Slice 体验验收。不是小地图审美复验。

本收工无新 HUD。不走完整 U1–U12 当新表面。

机器闸门（QA 本会话自跑）：

| 命令 | 退出码 | 原文摘要 |
| ---- | ------ | -------- |
| `npx tsc --noEmit` | **0** | 无输出 |
| `npm run check:layout` | **0** | 8 种子均 `ok`；`age`/`ruin` 有组合变化；每种子有 `dual main/alt`；`info sky-overlay 64x42 5.3ms`；`check:layout passed (8 seeds)` |
| `npm run check:recipes` | **0** | 10 锚墙后连通、剪影、掩护闸门过；`sight` 只打印不 FATAL；`check-recipe-drafts: 10 recipes, seed 101, connected, silhouette, cover-reach` |

仓库无 `test` 脚本，未跑单元测试。未做浏览器实机 / 人试玩。

### 总判

**PASS。** 三件与锁死规则机械对齐。闸门全过。墙后地板四连通分量检查仍为恰好 1。无换路是 FATAL。无阻断项。不标 Slice COMPLETE。

---

### 发现的问题

| ID | 类型 | 严重度 | 描述 | 位置 | Spec 依据 |
| -- | ---- | ------ | ---- | ---- | --------- |
| — | — | — | 无阻断项 | — | — |

### 非阻断观察

| ID | 描述 | 位置 | 为何不挡 |
| -- | ---- | ---- | -------- |
| O1 | 换路失败时先在**同一座岛**上重试布点（`MAX_PLACE_ATTEMPTS = 20`），仍失败才换岛种子。规则 21 第 6 步字面是「丢弃本岛，重试整岛」。实现没有为此加细墙、拆形状闸门、或切开地板连通。 | `src/generation/rift-layout.ts` `generateRiftLayout` 岛循环内的布点循环 | 成品图仍必须过规则 21 的 1–6；同岛只换出生/撤离端点，不改墙 |
| O2 | `check:layout` 固定 8 种子未抽到 `ancient`（出现 `new`/`standard` × `intact`/`broken`/`eaten`）。`rollFragmentAxes` 三值均匀、`nextInt` 含端点，生产路径每次踏入都抽。 | `tools/map-preview/check-layout.ts` 样本；`src/generation/fragment-roll.ts` | 样本碰巧未盖满 3×3，不是写死回退 |
| O3 | `generateRecipeDraft` 不写两轴。缺字段时烤图回退 `standard`+`broken`。出击走 `generateRiftLayout`，会把抽取写进 `GeneratedRiftLayout` 与 `ruins`。 | `src/generation/draft-pipeline.ts` 返回值；`preview-paint.ts` `resolveAge` / `resolveRuin` | 规格允许调试入口缺字段回退；生产路径有抽 |

人终审 / 审美 / 「短暴露长隐蔽好不好读」不作为本报告门禁（规格待验证假设仍开）。

---

## 换路（规则 21 + 归属句 + 连通/形状）

机器判定 1–6 与 `evaluateDualPath` 逐步对照：

| 步 | 规格 | 实现 | 判定 |
| -- | ---- | ---- | ---- |
| 1 | 主路 = 出生→唯一撤离的四连通最短路；长度 = BFS 格子步数（路径格数 − 1） | `bfs` + `dist[extract]` | **符合** |
| 2 | 主路内部格（除出生、撤离）临时当墙后，出生仍须走到撤离 | 拷贝 `walk`，内部格置 0 再 BFS；临时墙不写回成品 | **符合** |
| 3 | 第二路步数 ≥ 1.15 × 主路 | `DUAL_PATH_MIN_LENGTH_RATIO = 1.15` | **符合**（本闸门最低 59/69 ≈ 1.169） |
| 4 | 开阔 = 四邻墙数 ≤ 1（规格写明与「距墙 ≥ 2」的 OR 等价） | `wallNeighborCount <= 1`；墙 = 墙格，不含虚空 | **符合** |
| 5 | 较短者开阔占比严格更高；步数并列视主路为较短 | `mainSteps <= altSteps` 时主路当较短；`shortOpen > longOpen` | **符合** |
| 6 | 任一步失败 = 坏图，重试；禁止加细墙 / 拆 16a/16b / 切开连通 | 失败原因一律 `no dual-path`；岛重试上限 32；形状闸门仍在草案栈 | **符合**（同岛先换端点见 O1） |

其余机械项：

| 项 | 判定 | 证据 |
| -- | ---- | ---- |
| `check:layout` 与生成器同一函数 | **符合** | 双方 `import { evaluateDualPath } from .../dual-path`。全库无第二份换路判定 |
| 无换路是 FATAL | **符合** | `check-layout.ts`：`assert(dual.ok, ...)`，`failed > 0` 则 `process.exit(1)`。不是 `info` |
| 仍一个撤离点 | **符合** | `extractionPoint` 单对象，`id: 'EXIT_01'`。禁止钉手写图旧格。本 Slice 无第二出口 / 捷径口 |
| 未为挤路加细墙 | **符合** | `placeOnIsland` 只布点，不改 `walls`。文件头写明不凿墙造第二路 |
| 未拆形状闸门 16a/16b | **符合** | `draft-pipeline.ts` 仍 `silhouetteFails` + `coverReachFails`。`check:recipes` 仍打这两闸。`sight` 只日志（16a 禁止把空直线 ≤14 当 FATAL） |
| 墙后地板连通 = 1 | **符合** | 草案每层 `openSealedFloors` 后 `countWalkableComponents !== 1` 则丢；交岛前 `assertSingleWalkable`。`check:layout` / `check:recipes` 均断言分量 = 1 |
| 出生能走到撤离 | **符合** | 规则 5：生成器 BFS；闸门 `floodFrom` 覆盖撤离、薪柴、污染物、巡逻路点 |
| 坏图重试不换算法 | **符合** | 仍 `pickRecipe` → `jitterRecipe` → `generateRecipeDraft`。到顶抛错。未见发行期强制挖通（规则 8 只救连通、不救换路；本路径也没有用挖通绕过换路） |
| 换路归属句 | **符合** | `system-chaos-scavenge-extract` 规则 21：机器判定归属地图生成规格 21。实现住在 `dual-path.ts`，撤离规格未另开软口径 |

`check:layout` 8 种子换路步数（均 ≥ 1.15）：3: 70/104；11: 65/89；29: 61/87；47: 59/73；73: 59/69；101: 81/103；211: 51/65；409: 50/68。

---

## 尘点（五条）

| # | 锁 | 判定 | 证据 |
| - | -- | ---- | ---- |
| 1 | 尘点是漆；不占 tile、不写 `walls[]`、不挡路 | **符合** | `OverlayStamp` 合同：「Never a wall」。`buildAtmosphere` 只在地板上采样 stamp。`paintSkyShade` 只加到低分辨率 additive `rim`。无粒子实体碰撞 |
| 2 | 同一份 `AtmosphereField` 只改 `phase`；沿本趟 `windX/Y` 漂；与天空同一根风轴 | **符合** | `moteSlide`：`(phase - field.phase) * slideSpan` × `windX/Y`。天空胶囊 `shadeAt` 用同一 `windX/Y` 与同一传入 `phase`。出击循环 `RiftSurfacePainter.update` 只推进 `phase` 再 `paintSky` |
| 3 | 禁止每帧整张 2048×1344 `compositePaint` | **符合** | 出击：`mount` 一次 `bakeGround` + `compositeStaticPaint`；`update` 只 `paintSkyShade`（本闸门 64×42、5.3ms）。`compositePaint` / `paintRuinedMask` 只在预览工具，注释写明不要进 live loop |
| 4 | 雾池烤死 | **符合** | `compositeStaticPaint` → `applyFog` 一次。`paintSkyShade` 不重算雾场 |
| 5 | 无新色、无新 HUD | **符合** | 尘点是 rim 上的通道加权，无新合同 hex。无新 overlay 读数 / 标记 |

出击地面：`compositeStaticPaint` 对 overlay `skipMotes: true`，`bakeGround` 也不画 mote。尘点不烤进地面。

---

## 年龄 × 残破（规则 24a + 组合轴）

| 项 | 判定 | 证据 |
| -- | ---- | ---- |
| 每次踏入抽两轴 | **符合** | `generateRiftLayout` 用输入种子调用 `rollFragmentAxes`；写入 layout 与 `ruins`。`RiftScene.create` 走这条生产路径 |
| 禁止永远 `standard`+`broken` | **符合** | 均匀 3×3。本闸门 8 种子已见 `new`/`standard` 与 `intact`/`broken`/`eaten`，不是单一回退 |
| 同种子可复现 | **符合** | `mix32(seed, 'fragment-roll')` + `SeededRandom`。`check:layout` 对每种子再生成一次，断言年龄/残破/出生/撤离/墙数不漂 |
| 渗色未写死 `contam-cold` 冒充所有年龄 | **符合** | `agePaint`：`new` → `contam-cold`；`standard` → `contam-mid` / `contam-core`；`ancient` → 压饱和 `contam-ancient` + `contam-core`。全库无 `CONTAM_TEAL` |
| `standard`/`ancient` 真画矩形块 | **符合** | `fillFloorRect`：`standard` 1×1、3–5 块；`ancient` 2×2 / 3×3、15–22 块。`new` 仅单像素异常、`seamW = 0`。折线只作渗缝，不加粗折线冒充块 |
| 残破乘数打在 scratch / fleck / stainThreshold / 墙沿 | **符合** | `intact` 0.70/0.70/+0.06；`broken` 1/1/0；`eaten` 1.40/1.50/−0.10。墙沿 `topMul`/`sideMul`（`eaten` 顶沿 0.35、侧 AO 1.85） |
| 无新 hex | **符合** | 渗色六元组均在 `docs/art/palette.json`（`#1a7a9a` `#1a6b5c` `#1aad96` `#4adf8a` `#151a1e` `#3a3838`）。ancient 压饱和是中间运算后量化 |
| 无新碎片种类 | **符合** | `data/rift-fragments.csv` 仍五列：三行 `enabled`（户外/医院/地铁），图书馆/居民区仍 `false`。两轴不是 CSV 新行 |

---

## 连通 / 策略规则（机器层）

| 规则 | 判定 |
| ---- | ---- |
| 陆地一块；墙后地板一块；出生到撤离；装饰不挡路 | **符合**（闸门 + 尘点不写墙） |
| 预览与正式同一条连通闸门 | **符合**（`countWalkableComponents`） |
| 新图 = 锚 + 新种子 + 邻域抖动；画廊不是地图库 | **符合**（`pickRecipe` / `jitterRecipe` / `generateRiftLayout`） |
| 天空同一场只改 `phase`；雾烤死 | **符合** |
| 未换第二套生成器来「碰巧连通」 | **符合** |

`check:recipes` 剪影/密度未拆：墙占比 ≤18%、1 宽直行 ≤6、非木墙厚比 ≥50%、平行窄槽 0、无三向 1 宽巷、有 6×6 边有厚掩护的空地、夹墙巷 ≤8。空直线长度只打印。

---

## 游戏内 UI

本收工无新 HUD。小地图 DEC-063 机械层已交，本报告不重验审美、不代勾 U2 / 「像游戏」。

---

## 通过的检查

- 规则 21 六步与共用函数、无换路 FATAL、一个撤离、不拆 16a/16b、墙后连通 = 1
- 尘点五条：不烤进地面、沿风随 `phase` 漂、出击循环不整图 `compositePaint`、雾烤死、不写墙
- 规则 24a：生产路径抽两轴、渗色按年龄选 L2、矩形块真画、残破乘数落地、无新 hex / 无新种类、同种子可复现
- 撤离规格换路归属句与实现一致
- `tsc` / `check:layout` / `check:recipes` 退出码 0

---

## 建议

无阻断。Director 可按本报告收 Slice 6（人标 COMPLETE）。O1–O3 不必挡 COMPLETE。审美与「人是否读得出短暴露 / 长隐蔽」仍归人，不在本门禁。
