# 环境污染视觉语言探索 — 渲染崩坏版

## 设计目标

环境污染和实体污染应该看起来是**同一种现象**的不同尺度表达：
- 实体 = 单个 sprite 的渲染崩坏
- 环境 = 整个 tilemap 的渲染崩坏

"这个世界的渲染引擎在这片区域出了故障"——而不是"有发光液体在地面蔓延"。

## 综合方向权重

- **主导（50%）**：C — 数据泄漏（teal 从渲染失败的间隙透出，看到世界的"底层"）
- **次要（30%）**：A — Tile 数据错误（个别 tile 显示了错误内容/颜色）
- **点缀（20%）**：D — 叠加覆写（局部区域被"另一组数据"部分覆盖）

B（像素网格失调）在概念图中难以表达，留给实际 tileset 制作时体现。

---

## Prompt 1：标准浓度裂隙场景（渲染崩坏版环境污染）

```
Top-down view of a dark fractured interior space, pixel art style, low-fi aesthetic. The ground is cracked dark concrete and aged tile. The scene shows ENVIRONMENTAL CONTAMINATION -- but NOT as organic veins or glowing liquid. Instead, the contamination manifests as RENDERING ERRORS IN THE WORLD ITSELF: patches where the floor tiles display the WRONG COLOR -- rectangular blocks of flat teal replacing what should be grey concrete, like a texture failed to load and shows raw data underneath. Thin lines of teal light visible in cracks -- but these read as light leaking through GAPS IN REALITY'S RENDERING, as if the world has holes in its surface and you can see the engine's base color beneath. A few tiles are visibly DISPLACED -- shifted 1-2 pixels from their grid alignment, their edges no longer matching neighbors, with teal glow at the misalignment seams. One area has a tile that appears to be rendering at WRONG RESOLUTION -- a blocky 8x8 mosaic where everything else is 32x32. The overall feeling is: this floor is a tilemap, and the tilemap has data corruption. Not organic spread, not flowing liquid -- rectangular errors, grid-aligned glitches, displaced tiles, wrong-data blocks. 75% dark quiet ground that renders correctly, 20% contamination as rendering errors, one small warm amber light. high-detail pixel art rendering, extremely dark atmosphere, NOT organic veins, NOT flowing liquid, NOT bioluminescent, rectangular and grid-aligned errors only, broken tilemap aesthetic
```

## Prompt 2：低浓度新生区域（渲染崩坏刚开始）

```
Top-down view of a dark interior space, pixel art style, low-fi aesthetic. The ground is cracked dark concrete. This area has MINIMAL contamination -- the rendering errors are just beginning here. The corruption is EXTREMELY SUBTLE: a single floor tile has one pixel that is the wrong color (teal instead of grey) -- just ONE pixel clearly out of place. In one corner, a hairline crack in the floor has the faintest teal glow leaking from beneath -- barely visible, like peeking through a scratch in a screen to see the backlight. Two adjacent tiles have a 1-pixel misalignment at their shared edge -- barely noticeable unless you look carefully, but something feels OFF about that seam. That's it. The rest of the floor is completely normal dark concrete. The contamination here is so minor that a player might not be sure if they're seeing things. 90% perfectly normal dark ground, contamination is just 3-4 individual pixel-level anomalies scattered across the scene. One warm amber light. high-detail pixel art rendering, extremely dark atmosphere, EXTREMELY subtle errors, almost invisible, just barely-there single-pixel anomalies, the player should question whether they actually see anything wrong
```

## Prompt 3：高浓度古老区域（渲染崩坏严重）

```
Top-down view of a dark fractured interior space, pixel art style, low-fi aesthetic. This area has SEVERE rendering corruption -- the world's tilemap is heavily damaged here. Large rectangular BLOCKS of tiles have been entirely replaced by wrong data -- flat teal-green fills where rooms should be, as if entire chunks of the level geometry failed to load. The remaining correct tiles are fragmented islands of grey concrete floating in a sea of rendering errors. Some tiles are STACKED -- you can see two different tiles occupying the same space, semi-transparent, overlapping like a double-exposure. The grid alignment is severely broken -- tiles overlap at wrong offsets, creating jagged staircase seams everywhere. Pixel data BLEEDS from corrupted zones into adjacent correct tiles -- the rightmost column of pixels on intact tiles near the corruption shows color contamination (teal tinge). The overall scene reads as: a game level that is 60% corrupted data and 40% still barely holding together. The teal here is warmer/greener than standard (ancient contamination). Despite the chaos, there IS a pattern -- the corruption follows the tile grid, always rectangular, always aligned to pixel boundaries. It is systematic failure, not organic decay. One warm amber light barely visible in the chaos. high-detail pixel art rendering, extremely dark atmosphere, heavy rendering corruption, grid-aligned blocks of wrong data, NOT organic, NOT liquid, NOT veins -- rectangular systematic tilemap failure, warmer green-teal for ancient contamination
```

---

## 评审标准

1. **统一性**：和实体的"渲染崩坏"签名感觉像同一种现象吗？
2. **非有机感**：看起来是"数据/渲染错误"还是"生物蔓延"？
3. **网格/矩形特征**：污染边界是否遵循像素网格/tile 边界（非有机曲线）？
4. **浓度可读**：三张的"轻微 → 标准 → 严重"梯度是否清晰？
5. **teal 作为"底层数据泄漏"而非"表面发光液体"**：光源感觉从下方透出还是在表面流动？

## 文件命名

- `env-corruption-standard.png` — Prompt 1
- `env-corruption-light.png` — Prompt 2
- `env-corruption-heavy.png` — Prompt 3
