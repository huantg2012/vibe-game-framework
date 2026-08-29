---
status: DRAFT
created-by: qa agent（迭代 9 I9-QA）
created-when: 2026-08-28
note: rift 视野表现打磨机械对照。好看 / 读作游戏 / 人终审四问不代勾。画面等波 4。
---

# QA：迭代 9（rift 视野表现打磨，机械层）

日期：2026-08-28  
合同：`docs/tasks/iteration-9.md` Task I9-QA（DEC-105）  
规格：`docs/art/rift-vision-presentation.md`（I9-A 处方）  
规则：`docs/specs/system-movement-vision.md`（数值表不动；读法措辞收口归 Director）  
代码：HEAD `8e2bdec` + 工作区 I9-G（`src/systems/visibility-system.ts`、`src/systems/vision-textures.ts`、`tools/vision/check-vision-energy.ts`）。本报告核工作区磁盘。

**已交对照对象：** I9-A（规格）、I9-G（code）。  
**不许代勾：** 审美、读作游戏、迷雾读法、色带感、手电方向感、亮度不回退。画面等波 4 人终审。

本包非 UI 表面，U1–U12 不作闸门（合同收尾四项第 4 条）。

---

## 闸门实测（工作区，2026-08-28）

| 命令 | 结果 |
| ---- | ---- |
| `npx tsc --noEmit` | 绿 |
| `npm run check:vision-energy` | 绿。噪点 0.931×（带 0.90–1.10）、暖光 0.870× / 手电 0.872×（带 0.85–1.05）；孤立亮点 0 |
| `npm run check:lexicon` | 绿 |
| `npm run check:observe-lines` | 绿 |
| `npm run check:paint-quota` | 绿 |
| `npm run check:layout` | 绿。8 种子墙后可走仍过 |
| `npm run check:contam-floor-contrast` | 绿 |
| `npm run check:paint-genome-topology` | 绿 |
| `npm run check:gallery-catalog` | 绿。`default total=1974` |
| `npm run check:contam-distinct` | 绿 |
| `npm run check:jia-genome-weld` / `operators` / `street-wreckage` / `doorframe` / `genome-pose` / `stalk-clump` / `organic-remnant` / `insect-remnant` / `mammal-remnant` / `worm-remnant` | 全绿 |
| `node tools/agent-parity/check.mjs` | **既有红**（见偏差清单 #1）。六个 agent 的 frontmatter `description` 不一致。与 I9 文件无关 |

---

## 1. constants 零 diff + 现值对照

合同红线：不调射程 / 锥角 / 三档 / 混乱缩放 / 相机 zoom。规格「constants 判断」：本批不需要动任何 constants。

| # | 规格/合同引用 | 证据 | 结论 |
| - | ------------- | ---- | ---- |
| 1.1 | `git diff src/config/constants.ts` 必须为空 | 工作区对该文件 diff 长度为 0。`src/systems/chaos-system.ts` 同样无 diff | **PASS** |
| 1.2 | 射程 224 / 80 | `constants.ts:89–90` `RADIUS_FORWARD: 224`、`RADIUS_AMBIENT: 80` | **PASS** |
| 1.3 | 锥角 50° + 30° | `constants.ts:91–92` `CONE_HALF_ANGLE: 50`、`CONE_FALLOFF_ANGLE: 30` | **PASS** |
| 1.4 | 三档 1.0 / 0.6 / 0.2；`ERASE_ALPHAS`；带宽 32 | `constants.ts:94–96` `EDGE_BAND_WIDTH: 32`、`BAND_ALPHAS: [1.0, 0.6, 0.2]`、`ERASE_ALPHAS: [1.0, 0.5, 0.2]` | **PASS** |
| 1.5 | 相机 zoom 1.5（DEC-009） | `constants.ts:13` `CAMERA.ZOOM: 1.5` | **PASS** |
| 1.6 | 噪点 / 光池 **数值**不动（只动纹理内部） | `VOID_NOISE_ALPHA: 0.04`、`VOID_NOISE_TILE: 64`、`VOID_NOISE_SCROLL: 2`（110–112）；`PLAYER_LAMP_ALPHA: 0.12`、`FLASHLIGHT_ALPHA: 0.16`、`FLASHLIGHT_FORWARD_FRAC: 0.34`、`FLASHLIGHT_RADIUS_FRAC: 0.85`（115–124）；色值 `#8a5c2a` / `#a8906a` 仍在 | **PASS** |
| 1.7 | 混乱缩放取值映射不动 | `getChaosModulators`（`chaos-system.ts:37–64`）工作区无 diff。`≤75 → 1.0`、`75–100 → 1.0–0.90`、溢出到 130 落到 0.40 地板；`edgeCorruption` / `screenFlicker` 分段未改 | **PASS** |
| 1.8 | 射线预算 2ms；60→40 降级 | `BUDGET_MS: 2`（106）；`RAY_SPLIT_FORWARD: 40` + `AMBIENT: 20` = 60；降级 `28+12=40`（98–102） | **PASS** |

---

## 2. 处方逐条（I9-A）

### 件 1：迷雾噪点

| # | 规格引用 | 证据 | 结论 |
| - | -------- | ---- | ---- |
| 2.1 | 画布 64×64 可平铺 | `ensureNoiseTexture` 用 `VOID_NOISE_TILE`（`visibility-system.ts:950`） | **PASS** |
| 2.2 | 八度 A：2×2 细胞、覆盖 0.58、基值 [70, 130]、像素 ±12 | `VOID_NOISE_CELL_PX = 2`、`VOID_NOISE_COVERAGE = 0.58`、`VALUE_MIN/MAX = 70/130`、`PIXEL_JITTER = 12`（`vision-textures.ts:9,18–21`）。规格起点写 ≈0.55，允许出带只调覆盖率；任务书核的就是 0.58 | **PASS** |
| 2.3 | 禁止孤立单像素亮点 | 同一细胞 4 像素共享 `cellLit`（104–120）；闸门 `isolated=0` | **PASS** |
| 2.4 | 八度 B：8×8 团块 ±18，钳 [0, 160] | `CLUMP_PX = 8`、`CLUMP_OFFSET = 18`、`VALUE_CLAMP = 160`（11, 22–23, 123–134）。只加在已点亮像素上；未点亮 alpha=0，与规格 alpha 通道一致 | **PASS** |
| 2.5 | 冷偏 `r=v×0.90, g=v×0.95, b=v`；点亮 alpha 255 / 未点亮 0 | `TINT_R/G/B`（24–26, 147–150） | **PASS** |
| 2.6 | Y 滚动 = 加速后 X 速度的 0.6×；X 与近撤离加速语义不动 | `VOID_NOISE_SCROLL_Y_RATIO = 0.6`（69）；`drawMask`（766–779）`tilePositionY = scroll * 0.6`。近撤离仍 ≤5 tile 全效、≥40 tile 无效（768–775） | **PASS** |

### 件 2：带边界 dither

| # | 规格引用 | 证据 | 结论 |
| - | -------- | ---- | ---- |
| 2.7 | 实擦收缩 1px（钳 ≥ 0），原 erase alpha | `shrunkPolygons`：射程边射线半径 −1（728–742）；`fillPoints(shrunkPolygons)` 再 `mask.erase`（786–791） | **PASS**（收缩只作用在射程边射线；墙截断射线 `rangeEdge=0` 不缩，见 2.9） |
| 2.8 | 三条边界 2px 棋盘环，同一 erase alpha | `eraseDitherRing`：`lineStyle(2, …, eraseAlpha)`（808）；三层循环 `band = 2..0`（786–793）。棋盘 2×2、50% 占空（`fillDitherPunch`，186–198） | **PASS** |
| 2.9 | 墙截断硬边不抖：两端 `hitDist ≥ r_k − 1` 才画该段 | `rangeEdge[i] = hitDist >= core/middle/outer - 1`（721–723）；环段两端都为 1 才 `lineBetween`（811–816） | **PASS** |
| 2.10 | 棋盘相位钉 `maskOriginX/Y & 1` | `punch.tilePositionX/Y = this.maskOriginX/Y & 1`（821–822） | **PASS** |
| 2.11 | 路线一或路线二自选 | 走路线二：scratch RT 一次性 `create`（250–256）；注释写明路线一 `RT.erase` 跳过 GameObject mask（796–799）。规格允许 | **PASS** |

### 件 3：光池曲线 + 手电椭圆

| # | 规格引用 | 证据 | 结论 |
| - | -------- | ---- | ---- |
| 2.12 | 暖光 stops 0/0.25/0.5/0.75/1 → 1/0.9/0.45/0.18/0 | `LAMP_ALPHA_STOPS`（`vision-textures.ts:37–43`）；`ensureLampTexture` → `applyRadialStops`（992–1002） | **PASS** |
| 2.13 | 手电 stops 0/0.18/0.42/0.7/1 → 1/0.82/0.5/0.24/0 | `FLASHLIGHT_ALPHA_STOPS`（45–51）；`ensureFlashlightTexture`（1009–1019） | **PASS** |
| 2.14 | 手电椭圆 1.15×0.87 + `rotation = facing`；暖光保持圆 | `FLASHLIGHT_POOL_STRETCH_ALONG/ACROSS`（66–67）；`drawFlashlight` `setDisplaySize(d×1.15, d×0.87)` + `setRotation(facingAngle)`（856–860）。`drawLamp` 仍 `setDisplaySize(diameter, diameter)`（835–837） | **PASS** |
| 2.15 | 色值 / alpha / 前推 / 半径比例 / depth 49 / ADD 不动 | 色与 alpha 见 1.6。前推仍 `FLASHLIGHT_FORWARD_FRAC`（850）。`setDepth(config.depth - 1)` + `BlendModes.ADD`（277–279, 287–291）。`createRiftVisionConfig(depth = 50)`（90） | **PASS** |

---

## 3. 能量平价

规格验收：噪点 mean luma×alpha 落在现状 **0.90–1.10×**（基准 59.3）；光池 disc mean alpha 落在 **0.85–1.05×**（基准 0.360 / 0.333）。

`npm run check:vision-energy` 实测：

| 项 | 新值 | 相对基准 | 带 | 结论 |
| -- | ---- | -------- | -- | ---- |
| 噪点（8 种子均值） | 55.191 | **0.931×** vs 59.3 | 0.90–1.10 | **PASS** |
| 暖光 disc | 0.3134 | **0.870×** vs 实测旧 0.3600 | 0.85–1.05 | **PASS** |
| 手电 disc | 0.2907 | **0.872×** vs 实测旧 0.3334 | 0.85–1.05 | **PASS** |
| 孤立亮点 | 0 | — | 必须 0 | **PASS** |

覆盖率 0.58、孤立检测、新旧 stops 都走 `src/systems/vision-textures.ts` 同一路径（闸门 import 运行时填充函数）。

---

## 4. 规则不破

对照 HEAD `8e2bdec` 同名函数体（花括号匹配，逐字）。

| # | 合同红线 | 证据 | 结论 |
| - | -------- | ---- | ---- |
| 4.1 | `getVisibilityAt` 行为不变（规则 23） | HEAD@356 与工作区@393 **21 行 IDENTICAL**。仍返回 `bandAlphas[0/1/2]`（1.0 / 0.6 / 0.2）或 0 | **PASS** |
| 4.2 | `castRays` 几何不动 | HEAD@542 与工作区@593 **47 行 IDENTICAL** | **PASS** |
| 4.3 | 静止缓存（规则 20） | `update` HEAD@268 与工作区@305 **38 行 IDENTICAL**。位移 / 转角 / 网格 version 未超才 `needsRaycast`；命中则 `lastMs = 0`、`usedCacheLastFrame = true` | **PASS** |
| 4.4 | 2ms 降级（规则 21：60→40 光线、隔帧） | `trackBudget` HEAD@590 与工作区@641 **26 行 IDENTICAL**。超 `BUDGET_MS` → `degradeLevel++` → `setRayCounts(28, 12)`；`degradeLevel >= 2` 时奇数帧跳过射线（322–325） | **PASS** |
| 4.5 | `clipLightsToIsland` 陆地掩膜语义 | HEAD@440 与工作区@477 **26 行 IDENTICAL**。仍按 `TileType.VOID` 以外的陆地 run 填几何掩膜，lamp + flashlight 共用 | **PASS** |
| 4.6 | 无每帧分配（update / render） | dither 棋盘纹理 `ensureDitherPunchTexture` 只在缺 key 时生成（962–973）；scratch RT / ring graphics / punch TileSprite 在 `create()` 一次性分配（241–256）。噪点 / 暖光 / 手电纹理同样 `textures.exists` 短路。`buildPolygons` 写入预分配的 `polygons` / `shrunkPolygons` / `rangeEdge`。`eraseDitherRing` 只 `clear` / `draw` / `erase` 已有对象 | **PASS** |
| 4.7 | 规则 4 朝向 = 最近一次非零键盘输入 | `player.ts:238–240` `resolveFacingTarget`：不在移动则 `null`（保持朝向），否则 `atan2(inputVector)`。出击 `visibility.update(..., player.getFacingAngle(), ...)`（`rift-scene.ts:433`）。手电 `rotation = facingAngle`，无鼠标瞄准 | **PASS** |
| 4.8 | 薪柴不发光；不加迷雾外 glow | `registerGlowSource` 调用点仍只在 `extraction-system.ts:69–70`，经 `rift-scene.ts:282` 注入。无新 glow 注册 | **PASS** |
| 4.9 | glow / corruption / flicker 三层行为 | `drawGlowSources` / `drawCorruption` / `drawFlicker` 不在 I9-G diff 触达范围内（diff 只改遮罩合成、滚动比、光池尺寸/stops、纹理填充） | **PASS** |

规格允许 r3 条带最外 1px 落在射程外、只影响地面遮罩；实体 alpha 仍走 `getVisibilityAt`。查询函数未改，与该条一致。

---

## 5. 回归面

| # | 合同引用 | 证据 | 结论 |
| - | -------- | ---- | ---- |
| 5.1 | 地图课不开视野迷雾 | `gym-map-scene.ts:4`「No VisibilitySystem」；文件无 `VisibilitySystem` / `createRiftVisionConfig` import。`gymFullVisibility`（42–44）恒返回 1，是宿主可见性回调，不是视野系统。文案仍写「无视野迷雾」（130） | **PASS** |
| 5.2 | 句法课不受影响 | `gym-lexicon-scene.ts` 无 VisibilitySystem import。`gymVisible` 恒返回 1（77–79）。INTRO 仍写「不开迷雾」（75） | **PASS** |
| 5.3 | 陈列馆不受影响 | `gym-lexicon-gallery-scene.ts` 无 VisibilitySystem import | **PASS** |
| 5.4 | `RiftScene` 不 import `src/gym/**` | `rift-scene.ts` 无 `@/gym` / `../gym` import | **PASS** |
| 5.5 | 出击仍挂同一套 VisibilitySystem | `rift-scene.ts:40,81,179` `createRiftVisionConfig(DEPTH.visionMask)`；`clipLightsToIsland`（180）；`setExtractionPosition`（181） | **PASS** |
| 5.6 | 净化点共用纹理、不为练习场另做分叉 | `createPurificationVisionConfig` 展开裂隙配置后关噪点、关手电、半强度暖光（118–130）。暖光纹理 key 与裂隙同一份 `ensureLampTexture` | **PASS**（画面顺带看一眼归人） |

工作区里 `rift-scene.ts` / `gym-*.ts` 另有 I8 残留 diff（氛围簇下线、`setStepFloors` 等），不是 I9 范围，本包不把它们当 I9 偏差。

---

## 6. 架构 / spec 收口（机械记录，不代 Director 收口）

合同收尾四项第 1–2 条是 Director 收口时核对。机械层现状：

- **架构：** `architecture.md:211` 已写 I9-G 表现层，并登记 `src/systems/vision-textures.ts` 为「闸门共用，不是新运行时系统」。与「若拆出新模块须登记」一致。
- **规则 spec：** `system-movement-vision.md` 数值表未改。待验证假设「三级硬分层带状感」仍写「仍未知」（458 行）——规格说等人终审后回填。读法措辞未改。记收口待办，不升 FAIL。

I9-A 红线对照写「预期无新增模块（全部在 `visibility-system.ts` 内部）」。实现把 Phaser-free 填充函数拆到 `vision-textures.ts`，供 `check:vision-energy` 与运行时共用。architecture 已按合同允许路径登记。见偏差清单 #2。

---

## 偏差清单

| ID | 类型 | 严重度 | 描述 | 位置 | 规格/合同依据 |
| -- | ---- | ------ | ---- | ---- | ------------- |
| 1 | 既有红 | — | `agent-parity`：六个 agent 的 frontmatter `description` 不一致（只允许 `model` 有差异）。与 I9 文件无关 | `.cursor/agents/*.md` vs `.claude/agents/*.md` | 任务书「既有红记录即可」 |
| 2 | 偏差 | Low | I9-A 写「预期无新增模块」；实现拆出 `vision-textures.ts`（Phaser-free 填充 + 能量闸门共用）。architecture 已登记「不是新运行时系统」。不升 FAIL | `src/systems/vision-textures.ts`；`architecture.md:211` | I9-A 红线对照 vs 合同收尾四项第 1 条 |

无 Bug。无 High / Medium 偏差。机械层不挡波 4。

---

## 通过的检查（摘要）

- constants / CHAOS 段 diff 为空；射程、锥角、三档、zoom、混乱映射、2ms 预算现值与合同一致。
- 噪点双八度、覆盖 0.58、无孤立单像素、Y 滚动 0.6×。
- dither 2px 棋盘、射程边收缩 1px、墙截断硬边、世界坐标相位。
- 光池 stops 与椭圆拉伸与规格曲线族一致。
- 能量闸门绿；`getVisibilityAt` / `castRays` / 缓存 / 降级 / `clipLightsToIsland` 相对 HEAD 逐字相同；纹理与 scratch 预生成。
- 地图课 / 句法课 / 陈列馆不挂视野系统；出击不 import gym。
- tsc 与全部现有 `check:*` 绿。

---

## 交人终审四问（合同原样，不代勾）

1. **迷雾是否读作「那里有空间，只是看不见」**，而不是「没加载完」或「电视雪花」？
2. **三档过渡是否不再读成同心圆色带**（或带状感是否已可接受）？
3. **手电是否读作有方向的照亮**，暖光光池是否仍是唯一暖色、且没有把虚空涂亮？
4. **迷雾下亮度是否没有回退**（已 PASS 的亮度保持）？

规格建议终审站位：开阔地站立（迷雾颗粒与环身圈带边界）→ 走廊前行（手电方向感与锥形带边界）→ 高混乱（dither 与边缘抖动 / teal 渗透共存）。

---

## 总结

I9-G 相对 I9-A / 合同红线：**机械对照通过**。constants 零 diff；处方参数落地；能量平价在带内；查询 / 射线 / 缓存 / 降级 / 陆地掩膜相对 HEAD 未改；练习场未误接视野系统。

**不要标迭代 9 COMPLETE。** 画面未验证。四问归人。agent-parity 既有红不挡本包。
