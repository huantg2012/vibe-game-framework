---
status: ACTIVE
created-by: art agent
created-date: 2026-07-29
slice: 1
gate: A-G3
purpose: 合成测试所需 tile/decal 的生成 prompt（步骤 1+2）。步骤 3（外部生图）须由人执行。
pipeline-config-env: docs/art/pipeline.env.config.json
pipeline-config-sprite: docs/art/pipeline.sprite.config.json
palette: docs/art/palette.json
---

# A-G3 合成测试：裂隙 Tile / Decal Prompt 文件

> **⚠️ 第 3 步（外部模型生图）需要人执行**
> 本文件完成了 A-G3 的步骤 1（清单）和步骤 2（prompt）。
> 步骤 3 由人在外部工具（SD / Flux / Midjourney）完成，详见文末"**操作指南（人执行）**"。

---

## 合成测试的目标与这份清单的逻辑

**命题**："模块化多样性能否压住网格马赛克？"

用 10 块 tile/decal 拼出一段真实 tilemap 场景（20×13 tile 视口截图），与参考图（`docs/art/demos/rift/2026-07-22_192829_gpt-image-2.png`）并排，由人判定俯视像素路线的表现力是否"够用"。

**清单设计原则：**
- 地面变体是抗马赛克的核心弹药，N=4（理由见下）
- 数据错误块是裂隙"渲染崩坏"视觉语言的直接验证项，不可省
- Decal 是最高性价比的抗马赛克补充：1 块 decal 随机旋转可产生 4 个方向变体，且不占 tile 槽位
- 每新增 1 块 = 人的真实生图工时；无法说清"它对抗马赛克贡献了什么"的块不列入

---

## 资产清单（10 块）

| # | 文件名 | 类型 | 尺寸 | 可无缝平铺 | 用途一句话 |
|---|--------|------|------|-----------|-----------|
| F1 | `tile-rift-floor-metro-base.png` | 地面 tile | 32×32 | ✅ | 基础工业地面，高频底色，无附加特征 |
| F2 | `tile-rift-floor-metro-crack.png` | 地面 tile | 32×32 | ✅ | 带细裂纹的地面，注入方向性纹路打断重复感 |
| F3 | `tile-rift-floor-metro-worn.png` | 地面 tile | 32×32 | ✅ | 磨损/斑驳地面，明度微变体，消除"塑料感" |
| F4 | `tile-rift-floor-metro-seam.png` | 地面 tile | 32×32 | ✅ | 含 teal 渗出缝隙，把污染语言织入地面层本身 |
| W1 | `tile-rift-wall-metro-straight.png` | 墙体 tile | 32×32 | ❌ | 直墙段，定义可通行/不可通行边界 |
| W2 | `tile-rift-wall-metro-corner.png` | 墙体 tile | 32×32 | ❌ | 内拐角，防止直墙相交处出现硬接缝 |
| E1 | `tile-rift-error-small.png` | 数据错误 tile | 32×32 | ❌ | 小 teal 数据块（标准浓度），验证"加载失败"视觉语言可读性 |
| E2 | `tile-rift-error-large.png` | 数据错误 tile | 32×32 | ❌ | 大 teal 数据块簇（重度浓度），标定重度污染区视觉 |
| D1 | `decal-rift-teal-crack.png` | 覆盖层 decal | 32×32 | — | 线状 teal 缝隙 overlay，随机旋转可获 4 方向，直接打断网格对齐感 |
| D2 | `decal-rift-debris.png` | 覆盖层 decal | 32×32 | — | 暗色碎屑残骸 overlay，增加视觉密度，不引入额外颜色 |

**关于 N=4 的理由（地面变体数量说明）：**
4 种地面变体在加权随机分配（权重建议 F1:40%、F2:25%、F3:25%、F4:10%）后，在任意 3×3 tile 区域内相邻重复概率约为 22%，叠加 2 种随机旋转 decal 后主观重复感降至可接受水平。5-6 种变体可进一步改善，但本次合成测试的目标是验证路线可行性，不是交付最终密度；边际效益递减且每块都是人的真实工时。若合成结果仍感觉重复，在同路线内增补第 5 种变体（建议：F5 = 含碎屑镶嵌的重度磨损地面），不回炉视角。

---

## 固定 Prompt 前缀（定义一次，各块复用）

### Prefix-T：Tile（实心地面/墙体）

```
Top-down 32x32 pixel art tile, pure overhead orthographic view (absolutely no perspective, no vanishing point, no isometric angle, no three-quarter view), extremely dark atmosphere, heavily desaturated color palette dominated by cold dark greys in range #080a0c to #2a2018, only saturated accent color is cyan-teal (#1aad96 or #2ae6c8) used exclusively for contamination, high-detail pixel art rendering with organic lighting gradients and soft edge falloff, visible individual pixels, heavy shadows, flat 2D top-down surface rendering, seamless tileable (left-right and top-bottom edges match perfectly for tiling), dark solid background in range #080a0c, source image 256x256 pixels (will be downscaled to 32x32 by pipeline),
```

### Prefix-D：Decal/Overlay（透明背景覆盖层）

```
Top-down 32x32 pixel art overlay decal sprite, pure overhead orthographic view (no perspective, no isometric angle), near-black background color exactly #080a0c for chroma-key removal, only the decal element itself is non-background, decal element is extremely dark and desaturated (range #080a0c to #2a2018), only accent allowed is cyan-teal (#1aad96 or #2ae6c8) for contamination glow, high-detail pixel art rendering, organic lighting gradients, soft edges, visible pixels, rest of image must be exact background color #080a0c, source image 256x256 pixels (will be downscaled to 32x32 by pipeline),
```

---

## 通用反向 Prompt（SD / Flux 用）

```
bright lighting, warm colors, orange, amber, yellow, red dominant, high saturation, colorful, isometric perspective, 3/4 view, side view, vanishing point, perspective distortion, organic tentacles, slime, blood, gore, insects, mushroom, plant growth, anti-aliasing, smooth 3D shading, photorealistic, 3D render, cartoon outline, chibi, cute, white background, plain white background, gradient background, watermark, text, signature, wide angle lens, bloom, lens flare, neon cyberpunk
```

---

## 工具参数建议（通用）

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| 工具 | Stable Diffusion (SDXL / Flux) | 像素风 tile 一致性最佳选择 |
| 分辨率 | 256×256 px | 管线 8× 降采样到 32×32，nearest-neighbor 出像素感 |
| 批量 | 每块生成 4-6 张 | 筛选风格最一致的 1 张；seed 不锁定（多样性优先） |
| 采样步数 | 25-35 步（DPM++ 2M Karras） | 稳定质量 |
| CFG Scale | 7-9 | 不要太高（避免过度锐化） |
| ControlNet | Tile 模式（若可用）| 增强无缝平铺质量，仅对 F1-F4 使用 |
| 首批 Style Anchor | 第一张通过的 F1 图 | 后续 F2/F3/F4 以 F1 作为 --sref（MJ）或 IP-Adapter 风格注入（SD），保持色温一致 |

> **一致性优先原则**：先生成并确认 F1（基础地面），再生成其余块。F1 的整体色温、暗度、像素风格是后续所有块的视觉锚点。

---

## 逐块 Prompt

---

### F1｜tile-rift-floor-metro-base — 基础工业地面

**用途：** 高频底色 tile，约占地面 40% 的铺设比例，无附加特征，视觉上"退后"不抢戏。  
**尺寸：** 256×256 px（源图）→ 32×32 px（管线输出）  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-floor-metro-base.png`

**Prompt：**
```
[Prefix-T] worn industrial metal plate flooring, flat surface with microscopic texture variation (subtle scuff marks and micro-scratches at pixel level), base color is very dark warm-grey rust (#2a2018 tone), nearly featureless from distance, material is aged steel or weathered concrete with barely-visible surface grain, no cracks, no glow, extremely subtle pattern variation across tile (2-3 brightness steps maximum), represents the default "background" of a degraded industrial transit corridor
```

**验收标准：**
- [ ] 整体亮度极低（视觉上为暗色，管线验收 maxAvgBrightness ≤ 30）
- [ ] 无 teal 色彩（基础地面不含污染）
- [ ] 四条边可无缝拼接（目视检查左右/上下是否有硬边跳变）
- [ ] 与相邻同块并排时不出现明显"格子感"（验证 seamless 质量）
- [ ] 色彩偏向暖灰（#2a2018 色调区间），与 frag-metro 一致

---

### F2｜tile-rift-floor-metro-crack — 裂纹地面

**用途：** 细裂纹变体，约占 25% 铺设比例，提供方向性纹路以打断 F1 的均匀重复。  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-floor-metro-crack.png`

**Prompt：**
```
[Prefix-T] worn industrial floor tile with 2-3 thin hairline cracks, cracks are 1 pixel wide in target scale (approximately 8px wide in source), cracks run diagonally or in irregular paths (not straight horizontal/vertical), crack lines are 5-8 brightness values darker than surrounding floor (#1a1c1f range), crack edges show 1-2 pixel crumbling debris fragments, cracks terminate well before reaching tile edges (no edge-to-edge cracks — cracks are internal features only), no glowing in cracks, same base material as standard industrial floor
```

**验收标准：**
- [ ] 裂纹在 32px 目标尺寸下可见（1px 宽，非消失）
- [ ] 裂纹不延伸至 tile 边缘（避免拼接后出现连续裂线，那会制造新的规律感）
- [ ] 四边无缝（裂纹是内部特征，不干扰 seamless 要求）
- [ ] 与 F1 并排时读为"同一材质的不同老化状态"，不读为"不同游戏的 tile"

---

### F3｜tile-rift-floor-metro-worn — 磨损斑驳地面

**用途：** 明度微变体，约占 25% 铺设比例，提供亮度区分以消除同材质的"塑料均匀感"。  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-floor-metro-worn.png`

**Prompt：**
```
[Prefix-T] heavily worn industrial floor tile showing uneven wear patterns, center area has darker smudge/scuff zones from repeated foot traffic (3-4 brightness values darker than edges), corner and edge areas show slight oxidation or surface hardening making them fractionally lighter, creates subtle brightness gradient variation of approximately 5-8 brightness steps across the tile, 2-3 irregular worn patches as asymmetric pixel clusters of 3-6px each, no cracks, no glowing elements, same industrial material as base floor but clearly aged and used
```

**验收标准：**
- [ ] 存在可见的亮度渐变/斑驳（约 5-8 级亮度差，非平均）
- [ ] 无 teal 色彩
- [ ] 四边无缝
- [ ] 与 F1/F2 并排时读为同材质的不同老化状态

---

### F4｜tile-rift-floor-metro-seam — 含 teal 渗出缝隙的轻污染地面

**用途：** 轻度污染变体，约占 10% 铺设比例（稀疏点缀）。把污染"渲染缝隙"视觉语言直接织入地面层，使场景无需覆盖 decal 也有污染氛围感。  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-floor-metro-seam.png`

**Prompt：**
```
[Prefix-T] industrial floor tile with one thin horizontal seam or joint line crossing the tile from left edge to right edge at approximately y=50% (must be edge-to-edge for seamless tiling), the seam line is 1-2 pixels wide in target scale (8-16px in source), the seam emits extremely faint cyan-teal light (#1a7a9a, very dim, NOT bright), the glow is limited to the seam line itself (1px soft falloff on each side maximum), the seam looks like a gap between two floor plates where contamination data bleeds through — "rendering failure gap" not "glowing paint," rest of floor surface is identical to base metro floor material, contamination glow must be the lowest possible cyan-teal value (barely visible)
```

**验收标准：**
- [ ] 缝隙发光 teal 颜色极弱（仅 `contam-cold` #1a7a9a 级别，非 `contam-glow` #2ae6c8）
- [ ] 缝隙从左边缘到右边缘贯通（edge-to-edge），拼接后形成连续线——这里特意允许连续，代表一道贯通的渗漏缝
- [ ] 缝隙宽度 ≤ 2px（target scale），不扩散成"发光带"
- [ ] 整体 tile 亮度仍极低（管线验收 maxAvgBrightness ≤ 30）

---

### W1｜tile-rift-wall-metro-straight — 直墙段

**用途：** 直墙段（水平走向），定义不可通行区域的视觉边界。  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-wall-metro-straight.png`

**Prompt：**
```
[Prefix-T] top-down view of a solid wall segment, pure overhead perspective showing only the top surface of the wall, wall material is rusted metal plate and rough concrete composite, wall surface occupies approximately the upper 40% of the tile (the wall face visible from above), lower 60% shows the floor-level shadow cast by the wall, the wall top surface is slightly lighter (#3a3d42 range) than the floor to indicate height difference, wall edge at the floor boundary has a 2-3px dark shadow strip indicating the wall's height, wall runs horizontally across the full tile width, no doors, no openings, subtle surface texture (rivets or panel seams at pixel scale), no teal contamination on wall surface
```

**验收标准：**
- [ ] 俯视角下可通行/不可通行区域有明确视觉区分（亮度差显著）
- [ ] 墙体占据 tile 宽度完整（左右 edge-to-edge），与相邻直墙拼接无缝
- [ ] 无 teal 色彩（标准墙段，未被污染）
- [ ] 与 F1 地面 tile 并排时，玩家可以直觉判断"那是墙"

---

### W2｜tile-rift-wall-metro-corner — 内拐角墙段

**用途：** 直墙内拐角（90°），房间角落处理，防止 W1+W1 直接相交时出现视觉硬接缝。  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-wall-metro-corner.png`

**Prompt：**
```
[Prefix-T] top-down view of an inside corner where two wall segments meet at 90 degrees, pure overhead perspective, the corner creates an L-shaped wall region visible from above (top-left quadrant and top-right quadrant of the tile form the two wall arms meeting at the corner), the inside of the corner (bottom-right of the L) is the darkest area (deep shadow accumulation), wall surfaces use same rusted metal/concrete material as straight wall, the meeting point of the two walls shows a slightly lighter highlight to indicate the corner edge, lower-left area of the tile is floor (same color as base metro floor), no contamination, same material and color range as straight wall tile
```

**验收标准：**
- [ ] 拐角形态在 32px 下可辨认（L 形墙体形状清晰）
- [ ] 与 W1 并排时读为同一套墙体系统（色调/材质一致）
- [ ] 内角阴影最深（符合光照逻辑，增加空间感）

---

### E1｜tile-rift-error-small — 小数据错误块（标准浓度）

**用途：** 小 teal 矩形数据错误块，散布于标准污染区地面。视觉语言：贴图槽加载失败，底层数据颜色暴露。  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-error-small.png`

**Prompt：**
```
[Prefix-T] industrial floor tile with a small rectangular block of completely flat solid cyan-teal color (#2ae6c8 tone) embedded in the floor surface, the teal block is exactly 2x3 pixels in target scale (approximately 16x24 pixels in source), the block is perfectly rectangular with sharp pixel-aligned edges (NOT rounded, NOT organic shape), the teal fill is completely uniform flat color with NO gradient and NO glow falloff — it looks like a texture rendering failure where the engine loaded a solid color instead of the floor texture, the rest of the tile shows normal industrial floor material identical to base metro floor, the teal block position is slightly off-center (not perfectly centered — data errors are not symmetrical), subtle 1px darker border around the teal block at the floor junction
```

**验收标准：**
- [ ] Teal 色块为完全平坦填色（#2ae6c8 附近），无渐变无光晕——"加载失败"而非"有东西在发光"
- [ ] 色块形状为矩形，边缘像素对齐（非有机形态）
- [ ] 在 32px 下色块可见（约 2×3 px 区域）
- [ ] 背景地面与 F1 读为同一材质

---

### E2｜tile-rift-error-large — 大数据错误块（重度浓度）

**用途：** 大面积 teal 数据错误块簇，用于重度污染区。多个相邻错误矩形同时"失败"，形成簇状。  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.env.config.json`  
**目标文件名：** `tile-rift-error-large.png`

**Prompt：**
```
[Prefix-T] industrial floor tile where a large area has been replaced by multiple adjacent rectangular data-error blocks, 3-4 flat solid rectangular teal blocks clustered together (NOT one single solid square — they are separate adjacent rectangles of slightly different teal values and slightly different sizes), total cluster area covers approximately 40% of the tile, blocks use slightly different teal shades: central blocks use brighter #2ae6c8 to #3cffd4, outer blocks use darker #1a6b5c to #1aad96, all blocks are perfectly flat solid fill (NO gradient, NO glow beyond the blocks), blocks are pixel-aligned rectangles, small gaps of 1-2 pixels between some blocks (showing floor material in the gaps), remaining floor area shows degraded base metro floor material, total visual impression: "multiple adjacent texture slots failed to load simultaneously"
```

**验收标准：**
- [ ] 多个独立矩形色块清晰可辨（非一个大色块），体现"多槽位同时失败"语言
- [ ] 色块颜色梯度：中心亮（#3cffd4）、边缘暗（#1a6b5c）——自然的数据错误层叠感
- [ ] 所有色块为平坦填色（无光晕）
- [ ] 总覆盖面积约 40-50%（重度污染区标定值）
- [ ] 管线验收 maxAvgBrightness ≤ 30（整体 tile 亮度，不是色块亮度）

---

### D1｜decal-rift-teal-crack — 线状 teal 缝隙 decal

**用途：** 叠加在地面 tile 之上的线状污染缝隙 overlay。随机旋转 0°/90°/180°/270° 可获 4 个方向变体，成本极低但对打断网格对齐感有显著效果。  
**类型：** Decal（透明背景，sprite 管线处理）  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.sprite.config.json`（bgRemove 色键 #080a0c，tolerance 24）  
**目标文件名：** `decal-rift-teal-crack.png`

**Prompt（使用 Prefix-D）：**
```
[Prefix-D] a single thin diagonal crack or seam line element on near-black background, the crack runs diagonally from approximately top-left to bottom-right direction, crack line is 1-2 pixels wide in target scale (8-16 pixels wide in source), the crack emits dim cyan-teal light (#2ae6c8 at low brightness), the glow has extremely soft 1-2px falloff on each side (barely visible), crack length spans approximately 18-22 pixels of target tile (72-88% of tile width), slight angular changes along the crack path (not perfectly straight), one small 1-3px branch crack at a midpoint, background is exactly #080a0c (chroma key color), represents a contamination data leakage seam in the reality layer — "rendering gap" aesthetic, the crack is the ONLY non-background element
```

**验收标准：**
- [ ] 背景为纯 #080a0c（管线色键去背可成功；目视背景无杂色）
- [ ] 线状形态明确，宽度 ≤ 2px（target scale）
- [ ] Teal 发光可见但不强烈（符合轻度污染氛围）
- [ ] 叠放在 F1-F4 上方时，缝隙与地面接缝方向不平行（测试时旋转 45° 叠放以最大化视觉贡献）

---

### D2｜decal-rift-debris — 碎屑残骸 decal

**用途：** 暗色碎屑碎片 overlay，叠加在地面增加视觉密度感，不引入任何颜色，是最"安静"的抗马赛克手段。  
**类型：** Decal（透明背景，sprite 管线处理）  
**尺寸：** 256×256 px → 32×32 px  
**管线配置：** `docs/art/pipeline.sprite.config.json`（bgRemove 色键 #080a0c，tolerance 24）  
**目标文件名：** `decal-rift-debris.png`

**Prompt（使用 Prefix-D）：**
```
[Prefix-D] scattered tiny debris fragments on exactly #080a0c background, 5-7 small irregular fragments asymmetrically distributed across the tile with deliberate empty areas (NOT evenly distributed), fragments are extremely dark near-black (#151a1e to #2a2420 range), fragments have angular pixel-aligned geometry (NOT rounded, each fragment 2-6 pixels in each dimension in source = 0.5-1.5px in target), fragment shapes are irregular polygons or L-shapes, NO warm colors, NO cyan-teal on the debris themselves (debris is inert material, NOT contaminated), fragments represent physical residue and material splinters from the fragmented reality, the background between fragments is exactly #080a0c (chroma key), fragments should be readable as "debris" not as "pattern"
```

**验收标准：**
- [ ] 背景为纯 #080a0c（管线色键去背可成功）
- [ ] 碎片颜色为极暗灰（#151a1e 到 #2a2420），无 teal 色
- [ ] 分布不均匀/不规则（不形成规律图案）
- [ ] 在 32px target 尺度下碎片仍可见（至少 3-4 个可辨认色点）
- [ ] 叠放在 F1 上方时读为"地上有碎屑"，不读为"tile 换颜色了"

---

## 后处理管线说明

### Tile 类（F1-F4、W1-W2、E1-E2）
使用 `docs/art/pipeline.env.config.json`：
- colorGrade → downscale nearest → quantize(palette.json) → cropPad(2)
- 验收：maxAvgBrightness ≤ 30，palette conformance ≥ 90%，exact size 32×32

### Decal 类（D1-D2）
使用 `docs/art/pipeline.sprite.config.json`：
- bgRemove(chroma #080a0c, tolerance 24) → colorGrade → downscale nearest → quantize → cropPad(2)
- 验收：requireTransparentBg: true，maxAvgBrightness ≤ 30，exact size 32×32
- **注意：** 生成 decal 时背景必须是精确的 #080a0c（8,10,12 RGB），偏差超过 tolerance 24 会导致背景残留。

> pipeline 的 sourceDir/outputDir 路径由 code agent 在步骤 4 时配置，指向 `docs/art/demos/rift-synth/`。

---

## 操作指南（人执行 — 第 3 步）

### 目录约定

生成完成后，将**原始源图**（256×256 未处理版本）保存至：

```
docs/art/demos/rift-synth/src/
  ├── tile-rift-floor-metro-base.png
  ├── tile-rift-floor-metro-crack.png
  ├── tile-rift-floor-metro-worn.png
  ├── tile-rift-floor-metro-seam.png
  ├── tile-rift-wall-metro-straight.png
  ├── tile-rift-wall-metro-corner.png
  ├── tile-rift-error-small.png
  ├── tile-rift-error-large.png
  ├── decal-rift-teal-crack.png
  └── decal-rift-debris.png
```

（管线处理后的 32×32 输出由 code agent 放到 `docs/art/demos/rift-synth/out/`，不需要人操作）

### 推荐生成顺序

1. **先生成 F1**（基础地面）——它是后续所有块的视觉锚点
2. 确认 F1 色温、暗度、像素风格满意 → 将 F1 的满意结果设为 Style Anchor（SD: img2img seed 固定 / MJ: `--sref`）
3. 依次生成 **F2 → F3 → F4**（地面变体，每次以 F1 作为风格参照）
4. 生成 **W1 → W2**（墙体，与 F1 色系一致）
5. 生成 **E1 → E2**（数据错误块，重点验证 teal 为平坦填色而非光晕）
6. 生成 **D1 → D2**（decal，重点确认背景为精确 #080a0c）

### 工具选择

| 块 | 推荐工具 | 关键设置 |
|----|----------|---------|
| F1-F4（seamless 地面） | Stable Diffusion (Flux) | ControlNet Tile 模式（若可用）；seed 固定后做变体 |
| W1-W2（墙体） | Stable Diffusion (Flux) | 同上，不需要 seamless 模式 |
| E1-E2（数据错误块） | Stable Diffusion (Flux) | 特别注意：teal 块必须是 flat fill，如结果出现光晕需调低 CFG |
| D1-D2（decal） | Stable Diffusion (Flux) 或 Midjourney | MJ: `--no background` 再手动改背景为 #080a0c；SD: 直接指定背景色 |

### 每块生成数量

每块生成 **4-6 张**，保留视觉上最符合验收标准的 **1 张**。筛选标准：
- 整体最暗（不是最亮）
- 色彩最克制（teal 最少且准确）
- 与 F1 并排时读为同一游戏

---

## 合成测试充分性判断

**这 10 块够不够验证马赛克问题？**

✅ **够用**（以下条件均满足的情况下）：
- 4 种地面变体 + 2 种 decal 的组合，可覆盖大多数"重复感"来源
- 数据错误块 E1/E2 直接验证了裂隙的视觉签名核心（渲染崩坏语言）
- W1/W2 建立了完整的空间边界系统
- 在实际 tilemap 渲染 + 有限视野光照下，地面均匀重复感会被光照遮罩进一步打散

⚠️ **若合成结果仍觉马赛克**（建议在同路线内增补，不换视角）：
- 增补 F5：含碎屑镶嵌的重度磨损地面（F3 的高强度版本）
- 增补 D3：小型数据残留碎块（介于 D2 和 E1 之间的 decal）
- 增补 W3：墙体 T 形交叉节点（多路走廊结构补全）
- 加密 decal 叠放密度（code agent 层面调整，不需新生图）

---

*本文件由 art agent 在 A-G3 步骤 1+2 完成（2026-07-29）。步骤 3 由人执行生图，步骤 4-6 由 code agent 接手。*
