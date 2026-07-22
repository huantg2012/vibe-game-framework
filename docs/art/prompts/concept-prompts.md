---
status: ACTIVE
created-by: art agent
created-date: 2026-07-22
purpose: Foundation concept exploration - establish visual direction before locking art-direction.md
tool: nano banana2 (or any general AI image generator)
note: These are direction-finding concepts. Results will inform the formal art-direction.md color/style definitions.
---

# Core Concept Prompts

## Usage Notes

- Generate each prompt 3-4 times and select the result that best captures the intended atmosphere.
- After all 7 concepts are generated, compare them as a set -- they should feel like they belong to the same game.
- Use results to lock color palette and style parameters in `docs/art-direction.md`.
- These are reference/mood images, not final game assets.

## Validated Style Baseline (from Purification Point evaluation)

以下经验来自净化点概念图评审（见 `demos/home/VERDICT.md`），适用于所有后续概念图生成：

**确认偏好：**
- 高细节像素渲染风格（有机光照渐变、柔和边界）优于传统硬边像素画
- 整体极暗，发光/光源面积占画面 < 30%
- 色彩极度克制——大面积冷灰/近黑，仅功能性光源或污染发光提供色彩

**拒绝标准（任何概念图出现以下情况应重新生成）：**
- 整体偏暖或亮度过高（像正常游戏房间而非末日场景）
- 墙壁/边界过于清晰硬实（应该是渐变融入黑暗，或有机形态）
- 看起来像传统 16-bit RPG 地图（过于"干净"和"可爱"）
- 像素格过于明显导致丢失氛围感（我们要的是"用像素画表达的氛围"而非"强调像素感的画"）

**追加到所有 prompt 的建议后缀：**
```
high-detail pixel art rendering, organic lighting gradients, extremely dark atmosphere, soft edge falloff into darkness, NOT retro-cute pixel art, NOT bright color palette
```

---

## 1. Purification Point Overview

**Purpose:** Establish the visual identity of the player's base. Informs tileset direction, lighting approach, and the "safe zone" feeling (not truly safe -- barely maintained).

**Decision this informs:** What does "functional industrial space with faint warmth" look like in pixel/low-fi style? How dark is "dark but not black"?

### Prompt

```
Top-down view of a small industrial outpost surrounded by absolute darkness, pixel art style, low-fi aesthetic, 32-bit color depth. The outpost is made of worn concrete and rusted metal plates, functional machinery, pipes, and sparse furniture. A few dim warm light sources -- a single overhead lamp, faint orange indicator lights on equipment -- cast small pools of light against the cold grey surroundings. The space is sparse, utilitarian, empty, clearly maintained by one person. The edges of the outpost fade into oppressive blackness where no light reaches. Extremely desaturated cold palette for the structures, with only the tiny light sources providing warmth. Atmosphere of isolation, silence, barely-holding-together maintenance. The outpost feels like the last lit room in an infinite dark building. No decorative elements, everything is functional. Bird's eye perspective, dark ambient lighting, heavy shadows, muted tones.
```

### Color Guidance
- Structures: cold grey, blue-grey, concrete tones (#3a3d42, #4a4e55, #2c2e33)
- Light sources: dim warm amber/orange (#c4873a, #8a5c2a) -- very small areas only
- Surrounding darkness: near-black (#0a0b0d, #111214)
- Overall brightness: very low, most of the image is dark

### Composition
- Center: the outpost (occupies ~30-40% of image area)
- Edges: pure darkness encroaching from all sides
- Light falloff is rapid -- warmth exists only immediately around light sources

---

## 2. Rift Interior Environment

**Purpose:** Establish the visual language of the gameplay area (where the player spends most time). Informs tileset generation, environmental storytelling, and the "alien wrongness" aesthetic.

**Decision this informs:** How to render "organic + inorganic forced fusion"? What does a contaminated alternate reality look like in top-down pixel art?

### Prompt

```
Top-down view of a fractured alien landscape, pixel art style, low-fi aesthetic. Multiple fragments of different realities stitched together unnaturally -- a piece of tiled floor merging into organic pulsating terrain, concrete walls growing crystalline geometric protrusions, soil with veins of glowing unnatural color running through it. The dominant contamination color is a sickly cyan-teal that bleeds from cracks and surfaces where it should not exist. Original materials (brick, metal, wood) are still partially recognizable but penetrated by alien geometric patterns -- hexagonal growths, perfectly regular ridges, symmetrical formations that look designed but not by humans. The space does not follow architectural logic -- corridors end in walls of fused matter, rooms connect at wrong angles. Atmosphere of wrongness, suffocation, being watched. Dark base with the contamination color providing most illumination through its own glow. Top-down game perspective, dark ambient, alien geometry, pixel art.
```

### Color Guidance
- Base/darkness: very dark desaturated (#0d1114, #151a1e)
- Contamination theme color: sickly cyan-teal (#2ae6c8, #1aad96) -- oversaturated, unnatural
- Original materials: barely visible dark earth tones, heavily desaturated
- Glow/emission from contaminated surfaces provides the main "lighting"
- The more contaminated an area, the more color it has (color = invasion)

### Composition
- No clear center -- fragmented, disorienting
- Multiple "zones" of different original materials visible, all being overtaken
- Geometric contamination patterns should feel orderly but alien (not chaotic)

---

## 3. Contaminated Entity: Infiltrator (Low Coverage)

**Purpose:** Establish the visual baseline for the weakest enemy type. The original form should still be recognizable -- the horror comes from the subtle wrongness on its surface.

**Decision this informs:** How much contamination detail is visible at game-scale pixel art? Where is the threshold between "normal" and "something is wrong"?

### Prompt

```
Top-down view of a humanoid figure, pixel art style, low-fi aesthetic, dark background. The figure's original form is clearly recognizable -- bipedal, roughly human proportions, wearing remnants of ordinary clothing. But its surface has patches of abnormal texture: geometric patterns growing on the skin like circuits or frost, one arm slightly longer with angular crystalline ridges along the forearm, patches where skin has become semi-translucent revealing something glowing faintly underneath. Movement feels stiff, mechanical, like a puppet with most strings still working. The contamination is subtle -- someone might mistake this for a person at first glance, until they notice the texture irregularities and the too-regular pattern of the growths. Color palette: mostly the dark muted tones of the original form, with small areas of faint cyan-teal glow at the contamination sites. Atmosphere of uncanny valley, wrongness hiding in normality. Pixel art sprite concept, top-down perspective, minimal lighting.
```

### Color Guidance
- Body/original form: very dark, desaturated human/clothing tones (#2a2a2e, #3d3835)
- Contamination patches: faint cyan-teal glow (#1a8a7a at low opacity)
- Key accent: brighter glow at one or two points (joints, eye area) (#3cffd4)
- Overall: mostly dark, contamination is accent not dominant

### Composition
- Single figure, centered
- Clear silhouette readable at small scale
- Contamination visible but not overwhelming (~15-20% of surface)

---

## 4. Contaminated Entity: Rewriter (Medium Coverage)

**Purpose:** Establish the mid-tier enemy visual. Original form and alien structure are in equal proportion -- geometrically unstable, unsettling balance between old and new.

**Decision this informs:** How to convey "behavioral unpredictability" visually? What does 50/50 human/alien look like?

### Prompt

```
Top-down view of a figure caught between two states of being, pixel art style, low-fi aesthetic, dark background. Roughly half of the body retains organic humanoid shape, the other half has been restructured into angular geometric forms -- limbs replaced by jointed crystalline segments, torso partially opened into a lattice of glowing hexagonal cells, head split between a recognizable skull shape and a cluster of perfectly symmetrical sensor-like protrusions. The two halves do not blend smoothly -- there are visible seams where organic tissue meets geometric structure, creating jarring transitions. The geometric half pulses with steady cyan-teal light. The organic half looks dead-grey and rigid. The overall silhouette is asymmetric, unstable-looking, like something that could shift configuration at any moment. Atmosphere of geometric dysphoria, unstable equilibrium, alien architecture growing from flesh. Pixel art sprite concept, top-down perspective, dark ambient lighting.
```

### Color Guidance
- Organic half: dead grey, almost colorless (#2e2d30, #3a3838)
- Geometric half: cyan-teal structural glow (#2ae6c8, #1fe0b8)
- Seam/interface zones: brighter, more intense glow (#5ffff0)
- Background: near-black
- More color overall than the Infiltrator -- contamination is now a major visual element

### Composition
- Single figure, centered, clear asymmetry visible
- Silhouette distinctly different from Infiltrator even at small scale
- The geometric structures extend the silhouette beyond human proportions

---

## 5. Contaminated Entity: Overwriter (High Coverage)

**Purpose:** Establish the top-tier enemy visual. Original form is gone -- what remains is a stable alien structure that happens to move. It has its own logic, its own beauty, and it is completely inhuman.

**Decision this informs:** How far can we push "alien geometry" while keeping it readable as a game entity at pixel scale?

### Prompt

```
Top-down view of a fully reconstructed alien entity, pixel art style, low-fi aesthetic, dark background. No recognizable human or organic form remains. The entity is a stable geometric construction -- a cluster of interlocking polyhedra with perfectly regular facets, connected by thin luminous filaments, hovering or gliding with no visible locomotion mechanism. Its structure follows a clear internal logic: repeating patterns, mathematical symmetry, fractal-like self-similarity at different scales. It glows steadily from within -- not pulsing like the lower forms, but constant, confident, complete. The surface has a material quality between crystal and metal -- hard, reflective, precise. It is beautiful in a deeply alien way -- like a mathematical proof made physical. It does not look damaged or corrupted -- it looks finished. Atmosphere of incomprehensible purpose, serene threat, alien perfection. Pixel art sprite concept, top-down perspective, entity illuminates its immediate surroundings with cold cyan-teal light.
```

### Color Guidance
- Primary structure: deep teal with metallic sheen (#1a6b5c, #0e4a3f)
- Luminous elements: bright cyan-white (#7fffee, #b0fff5)
- Internal glow: steady, not flickering (#3cffd4)
- Cast light on ground: faint teal pool around it
- Almost no "dark" on the entity itself -- it IS the light source
- Background remains near-black, making it stand out starkly

### Composition
- Single entity, centered
- Silhouette completely non-humanoid -- abstract geometric
- Should read as "definitely not the same category" compared to Infiltrator/Rewriter
- Size implication: slightly larger footprint than humanoid entities

---

## 6. Spatial Rift (Fragment Connection)

**Purpose:** Establish the visual language for transitions between map fragments. This is a key environmental landmark players navigate toward/away from.

**Decision this informs:** How to represent "torn spacetime" in top-down pixel art? How visible should rift connections be from a distance?

### Prompt

```
Top-down view of a spatial tear between two different reality fragments, pixel art style, low-fi aesthetic. On the left side: concrete and metal flooring with geometric contamination patterns. On the right side: organic soil-like terrain with different contamination textures. Between them: a jagged vertical tear in space itself -- not a hole but a rip, where the two realities fail to connect properly. The tear emits intense light -- white-hot at the center fading to the contamination color (cyan-teal) at the edges. Around the tear, both sides of reality are warping, bending, being pulled toward the gap. Small fragments of matter float near the opening. The tear is not smooth -- it looks like broken glass or fractured ice, with sharp angular edges. The immediate area around the tear is the brightest point in the image, everything else falls off into darkness rapidly. Atmosphere of structural damage to reality, dangerous passage, unstable threshold. Top-down game perspective, high contrast around the tear, dark everywhere else.
```

### Color Guidance
- Tear center: near-white (#e8fffc, #ffffff)
- Tear edges: intense cyan-teal (#00ffcc, #2ae6c8)
- Distortion zone: warped versions of surrounding colors
- Left terrain: dark industrial tones with teal contamination
- Right terrain: dark organic tones with teal contamination (slightly different hue to suggest different fragment)
- Light falloff from tear is dramatic -- only illuminates ~2 tile radius equivalent

### Composition
- Tear runs roughly vertically through center
- Two distinct terrain types flanking it
- Reality warping visible near the tear (bent lines, displaced pixels)
- Should be readable as "passage/connection" from game distance

---

## 7. The Darkness Beyond (Boundary View)

**Purpose:** Establish the visual treatment of the void/contamination that surrounds the purification point. This is what the player sees at the edges of their safe zone -- oppressive, formless, suggesting presence without showing detail.

**Decision this informs:** How to render "the outside" as a persistent boundary effect? Formless darkness vs. barely-suggested shapes? How much movement/animation to imply?

### Prompt

```
Top-down view from inside a dimly lit industrial space looking outward toward an edge where light ends and absolute darkness begins, pixel art style, low-fi aesthetic. The bottom portion shows the edge of a concrete floor with faint warm light from behind the viewer. The top portion (majority of image) is the Outside -- near-total darkness, but not empty. In the darkness, barely perceptible shapes shift: suggestions of massive geometric forms at impossible scales, faint lines of contamination color appearing and dissolving, the sense that the darkness is not absence but presence -- something is there, filling the space, simply not reflecting light. Occasional very faint cyan-teal geometries emerge from the black only to be swallowed again. The boundary between lit floor and darkness is not sharp -- it is a gradient where the concrete seems to dissolve, become uncertain, lose definition. Atmosphere of agoraphobia, crushing presence, being observed by something vast and patient. The darkness should feel heavy, thick, occupied. Pixel art, heavy use of near-black values with minimal contrast shifts to suggest depth and movement in the void.
```

### Color Guidance
- Interior edge: cold grey concrete with faint warm light (#3a3d42 with #8a5c2a tint)
- Transition zone: concrete losing definition, becoming uncertain (#1a1c1f fading to #0a0b0d)
- The darkness: near-black but NOT uniform (#0a0b0d, #080a0c, #0c0e11 -- subtle variation)
- Faint contamination suggestions: very low opacity cyan-teal (#2ae6c8 at 5-10% visibility)
- Overall: the darkest image in the set -- this IS the darkness

### Composition
- ~20% bottom: lit interior edge (the "here" anchor)
- ~80% top: the void (the "out there")
- Boundary is a gradient, not a line
- Any shapes in the darkness should be ambiguous -- the viewer should be unsure if they see something

---

## Batch Consistency Notes

After generating all 7 concepts, evaluate the set as a whole:

1. **Color coherence:** The cyan-teal contamination color should feel like the same hue across images 2-6. Net purification point (image 1) and the darkness (image 7) should be notably absent of this color.
2. **Pixel art consistency:** All images should feel like the same "resolution" of pixel art. If one comes out looking higher-fidelity, re-generate or request lower detail.
3. **Darkness level:** All images should be predominantly dark. If any result is too bright overall, it breaks the "darkness is the base" principle.
4. **Geometric vs organic:** Contamination should lean geometric/ordered, NOT goopy/biological/chaotic. If results show tentacles, organic growths, or slime -- reject and re-prompt.
5. **Scale feeling:** Images 1, 2, 6, 7 are environment-scale. Images 3, 4, 5 are entity-scale. They should feel different in scope.

## Iteration Guidance

If results are too bright:
- Add: "extremely dark, low-key lighting, most of the image is shadow"

If results look too high-fidelity (not pixel art):
- Add: "16-bit pixel art, limited color palette, visible pixels, retro game aesthetic"

If contamination looks too biological/organic:
- Add: "geometric, crystalline, angular, mathematical patterns, no organic growths, no tentacles, no slime"

If the overall mood is not oppressive enough:
- Add: "claustrophobic, suffocating atmosphere, sense of dread, isolation, no hope"

If results are too colorful:
- Add: "extremely desaturated, monochromatic with single accent color only, near-greyscale"
