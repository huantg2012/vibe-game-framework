---
status: ACTIVE
created-by: code agent
created-when: Foundation 阶段
note: Append-only. Do not modify historical entries.
---

# Decisions Log

<!-- Entries in reverse chronological order (newest first) -->

## DEC-019: VisibilitySystem gains a forward flashlight beam (illuminates the cone, not just reveals it)
- Date: 2026-07-31
- Phase: Slice 1 (A-G3 in-engine landing / Part C)
- Type: Technical choice (rendering feature; extends DEC-016)
- Decision: `VisibilitySystem` now draws a **forward flashlight beam** — a warm additive radial pool pushed forward along the facing direction and sized to the forward range — **under** the darkness mask, so the cone-shaped hole in the mask clips the round pool into a beam. The forward cone reads as *lit* (brightened), not merely *revealed*. Parameters live in `GAME_CONSTANTS.VISIBILITY.FLASHLIGHT_*` (`COLOR` pale-warm `#a8906a`, `ALPHA` 0.42, `FORWARD_FRAC` 0.34, `RADIUS_FRAC` 0.85). Disabled in `omni` (purification) mode, which already lights the whole room. The beam follows radius modulation, so a chaos-shrunk view dims its own light.
- Alternatives: (a) brighten the whole surface uniformly — kills the darkness/contrast that is the entire point; (b) a cone-clipped gradient texture rotated to facing — more code, and the mask already provides the cone clip, so a forward-offset radial pool + existing mask is equivalent and simpler; (c) leave it reveal-only.
- Reason: The vision mask (DEC-016) defines *what* is visible (visibility 1.00/0.60/0.20) but adds no light; a real flashlight both reveals and illuminates. In-engine iteration confirmed reveal-only leaves the cone too dark to read the procedural surface (`docs/art/demos/rift-synth/engine/rift-engine-c1.png`). A forward-offset additive pool clipped by the existing cone mask reproduces the A-G3 harness beam-gain (DEC-018) with minimal new code and zero change to the mask/erase pipeline (`...c2.png` too warm at alpha 0.55; `...c3.png` = shipped pale-warm at 0.42).
- Impact: The rift reads as flashlight-in-darkness in-engine. Part C also landed DEC-018: the procedural surface generator now lives in `src/systems/procedural-surface.ts` and `RiftScene` renders it at depth 0 with the tilemap layer kept for collision but set invisible. `FLASHLIGHT_*` are tunable in one place. `createPurificationVisionConfig` sets `flashlightEnabled: false`.

## DEC-018: Rift surfaces (floor + walls) rendered procedurally from world coordinates, not from discrete AI tiles
- Date: 2026-07-31
- Phase: Slice 1 (A-G3 composition test)
- Type: Direction change + Art/Technical choice (revises the "discrete AI floor tiles" assumption baked into the original A-G3 plan; aligns DEC-007 + DEC-005)
- Decision: The rift's continuous surfaces — floor and walls — are produced by **procedural texture generation keyed to world coordinates**, not by placing a set of discrete AI-generated 32px tiles. Floor = multi-octave value-noise grime + a low-frequency macro layer (dark pools / worn paths) + signed scratches & flecks (dark wear + light scuffs) + sparse wandering teal seepage cracks + flat teal "data-error" blocks, everything quantized to `docs/art/palette.json`. Walls = pixel-continuous edge shading (north top-rim highlight / south drop-shadow / side AO) computed from a pixel wall bitmap, so a wall run reads as one solid mass with height, with no 32px segmentation. AI image generation stays reserved for **discrete sprites/props** where per-instance identity matters (enemies, kindling, extraction marker), not for the ground/wall field.
- Alternatives considered: (a) the original A-G3 plan — N discrete AI-generated 32px floor variant tiles + random rotation + overlay decals; (b) one large AI-generated floor texture region-sampled per cell; (c) procedural continuous generation (chosen).
- Reason: A-G3 ran (a) across five tuning loops. Even after per-variant brightness normalization (which does kill the light/dark checkerboard), random tile rotation, and reweighting toward a featureless base, the AI variant tiles' distinctive features — especially warm-olive "crack/worn" marks that violate the cold-only environment rule — read as an obvious repeating motif. The mosaic problem merely moved from "brightness checkerboard" to "feature repetition". The on-hand generator (`GenerateImage`) also cannot author subtle dark-on-dark variation or seamless edges. (c) then succeeded on the first pass: a surface computed per world pixel is continuous by construction — zero seams, zero repetition — and its richness (grime, wear, contamination seepage) is fully controllable, deterministic, zero-cost, and palette-conformant. It fits the project's two load-bearing bets better than AI tiles do: the procedural-map bet (DEC-005) and the AI-vibe-pixel bet (DEC-007, "pixel hides inconsistency"). Validated on a harness that faithfully replicates the real vision model (DEC-016): forward cone + ambient ring + three compounding bands + warm player lamp + void grain + wall occlusion, plus a warm-center / teal-edge beam that expresses the human-warmth-vs-contamination tension through the vision system itself.
- Impact: **A-G3 PASSES** — the pure top-down pixel route (DEC-007) is validated, and the mosaic risk is retired by procedural continuity rather than by modular AI-tile variety. `TilemapRenderer`'s floor/wall fill is to be produced by a procedural generator keyed to world coordinates (Part C ports the harness logic in `docs/art/demos/rift-synth/{floor,scene,darkwood}.mjs` into `src/`, driven off the real 64×44 map from DEC-017). The art-pipeline (`tools/art-pipeline` postprocess/verify) remains the path for **discrete sprites/decals**, not for surfaces. A-G1 (32px readability) and A-G2 (top-down enemy sprite) still stand — they concern sprites, which are still AI-generated. Winning parameters and side-by-side evidence live in `docs/art/demos/rift-synth/` (loops 1-5 = the AI-tile attempt; `floor.f3` / `scene.s3` = the procedural result).

## DEC-017: Fixed rift map authored as ASCII, validated at runtime
- Date: 2026-07-29
- Phase: Slice 1 (T6 implementation)
- Type: Technical choice (content authoring format)
- Decision: The fixed rift map is authored as an ASCII grid (64×44) inside `src/scenes/rift-map-data.ts`, with all content anchors (spawn, extraction, 8 kindling nodes, 4 patrol routes) placed as single-character markers **inside the same grid** and parsed out at module load. Patrol route order is encoded by alphabetical order of the marker letters. `validateRiftMap()` re-checks the invariants (row widths, marker uniqueness, every marker walkable, everything reachable from spawn by an 8-way no-corner-cutting flood fill) and `RiftScene` runs it in dev builds.
- Alternatives: (a) a declarative list of floor/wall rectangles; (b) marker coordinates as separate literals alongside the grid; (c) an external JSON/Tiled file.
- Reason: A hand-authored stealth map lives or dies on its sight lines and route choices, which are visual properties — the ASCII grid is the only representation a human can review by looking at it. Keeping markers *in* the grid removes the entire class of "coordinate drifted out of sync with the geometry" bug that (b) invites; a rectangle list (a) is unreviewable for occlusion; an external file (c) buys nothing while the map is a single fixed level. The safety net for ASCII's weakness (a typo silently ruins a row) is the runtime validation.
- Impact: Editing the map means editing the picture. Anyone changing it must keep rows exactly 64 chars and markers unique — dev-build validation fails loudly otherwise. Measured traversal costs are recorded in the file header and **must be re-measured by T9/T10 to recalibrate `CHAOS.BASE_RATE`** (see DEC-014): the map yields ~35 s (short route) / ~46 s (long route) / ~59 s (full clear) of pure walking, all below the paper assumptions the 0.8 rate was derived from, so the remainder has to come from waiting on patrols and must be verified in real play.

## DEC-016: Vision mask via world-space RenderTexture + three compounding erases
- Date: 2026-07-29
- Phase: Slice 1 (T5 implementation)
- Type: Technical choice (rendering)
- Decision: The darkness mask is a `RenderTexture` sized to the camera view plus two tiles of padding, living in **world space at world resolution** (not screen space). Each frame it is filled with void-black and the three visibility polygons are erased out of it at 1.00 / 0.50 / 0.20, compounding to residual darkness 0 / 0.40 / 0.80 = visibility 1.00 / 0.60 / 0.20.
- Alternatives: (a) three dark layers each carrying an inverted `GeometryMask`; (b) a screen-space RenderTexture; (c) a custom shader.
- Reason: Follows the T1 spec's recommendation, and world resolution is the right call for pixel art — the mask edge lands on whole world pixels and scales up with the camera like every other pixel, instead of being sampled at screen resolution and reading sharper than the art. (a) was considered because inverted geometry masks would sidestep any ERASE-blend portability question, but inverted geometry masks are WebGL-only anyway, so it trades one backend dependency for another while adding three stencil passes. Screen space (b) fights Phaser's zoom handling for scroll-factor-0 objects.
- Impact: Two Phaser gotchas are now load-bearing knowledge: `RenderTexture.draw()` ignores its `alpha` argument for Game Object inputs (strength must be set on the object), and scroll-factor-0 game objects are still transformed by camera zoom — which is why the dev overlay is a DOM element and why T9's HUD will need either a second camera or the DOM. ERASE compositing verified on WebGL only; Canvas backend untested (Phaser.AUTO selects WebGL on all target browsers).

## DEC-015: Raycasting occlusion is one shared stateless module, not per-system logic
- Date: 2026-07-29
- Phase: Slice 1 (T5 implementation)
- Type: Technical choice (module boundary)
- Decision: Grid DDA raycasting lives in `src/utils/grid-raycast.ts` as stateless pure functions (`castRay`, `castRayDirection`, `hasLineOfSight`) that any system may import, rather than as a method on VisibilitySystem or duplicated inside the AI. Results are written into a caller-owned `RayHit` rather than returned fresh, which deviates from the spec's return-a-value signature.
- Reason: The spec (T1 "为什么不用事件总线" item 1, T2 rule P3) requires the player's vision and the enemies' sight to be answered by the same code — otherwise "I can't see it, so it can't see me" becomes a lie, and that inference is the entire basis of stealth. Importing a pure function is not a system-to-system call, so this does not violate the event-bus rule. The out-parameter is required by the no-allocation-in-the-game-loop rule (60 casts per frame).
- Impact: T7 must use `hasLineOfSight()` for enemy sight and must not write its own occlusion test. The diagonal-seam rule (blocking rays that thread the zero-width gap between two diagonally adjacent walls) is implemented once, here, with a 1px margin.

## DEC-014: CHAOS.BASE_RATE lowered from 1.5 to 0.8
- Date: 2026-07-29
- Phase: Slice 1 (pre-implementation kickoff)
- Type: Tuning decision (existing constant, substantive change)
- Decision: `CHAOS.BASE_RATE` goes from the Foundation value 1.5 to **0.8** points/s. This is now a decided value, not a suggestion — `src/config/constants.ts` still holds 1.5 and is changed by the code agent during T9. Everything downstream (run-length math, penalty curve anchors) assumes 0.8.
- Alternatives: keep 1.5 and shrink the map instead; pick 1.0 as a midpoint.
- Reason: Adopts the T3 design recommendation (`system-chaos-scavenge-extract.md`, "出击时长推算"). At 1.5 a run lasts ~1:40 and a full-clear player hits HARD_CAP by the 4th loot node, so the back half is spent permanently capped — the greed-vs-retreat gamble collapses into pure endurance. At 0.8 a run is ~3:07 and a full-clear player would arrive at extraction around chaos 175, i.e. taking everything is just barely out of reach, which is the calibration target.
- Impact: T9 writes 0.8 into constants. The number is explicitly a playtest knob — recalibrate once T6's fixed map has a final scale (target: full-clear time ≈ time-to-HARD_CAP × 1.15). Resolves T3 escalate item 3.

## DEC-013: Combat is priced as a loss-mitigation tool (dual-track cost)
- Date: 2026-07-27
- Phase: Slice 1 (T4 design)
- Type: Design choice (combat positioning)
- Decision: Combat cost is levied on two non-interchangeable axes — chaos (time, via ENEMY_DAMAGED → COMBAT_BONUS) and exposure (space/routes, via reportNoise alerting nearby enemies) — plus non-recoverable HP loss. Net: killing an enemy costs ~1.5–2× the chaos of waiting for a patrol window. Combat is deliberately kept worthwhile in exactly three situations (repeated traversal of a segment, already-caught-can't-flee, chaos overflow where detour cost is inflated). Combat is a loss-mitigation tool, not a progression tool.
- Reason: vision.md defines combat as "optional, costly, controllable; a decision option, not the main interaction." The success signal is a player saying "I could've just sneaked past." If playtesters start enjoying combat / clearing rooms, the pricing is too low, not a design win.
- Impact: T8 implements the two cost paths (events + noise); no combat-side chaos writes (T3 owns values). Playtest calibration knobs, in priority order: NOISE_HIT_RADIUS > COMBAT_BONUS > ENEMY_MAX_HEALTH; never nerf PLAYER_DAMAGE. Target: median kills/run 0–1.

## DEC-012: Enemy = three-hit kill, zero-random damage
- Date: 2026-07-27
- Phase: Slice 1 (T4 design)
- Type: Design choice (combat feel)
- Decision: Infiltrator HP = 75 = exactly 3 × PLAYER_DAMAGE(25). All combat damage is fixed — no randomness, no crits, no variance. Kill count is always an integer (invariant K1). Enemy attacks have a 350ms telegraph (windup) that resolves once at the end, so correct positioning avoids all damage ("controllable = dodgeable, not = damage-free").
- Reason: "Cost must be computable" — the player learns a fixed price on the first encounter (one fight = 3 hits = ~15 chaos + one health chunk), so every later encounter is arithmetic, not a gamble. Same discipline as T3's "only computable pressure creates real hesitation." The tradeoff is combat has zero surprise, which is intentional.
- Impact: When balancing, adjust ENEMY_MAX_HEALTH in 25-steps (keep integer kills), not PLAYER_DAMAGE. K5 (player survives ≥6 hits) keeps a single misjudgment non-lethal. constants COMBAT section is pure-additive in T8.

## DEC-011: Extraction requires pressing E (not auto-on-touch)
- Date: 2026-07-26
- Phase: Slice 1 (T3 design)
- Type: Design choice (interaction) — deviates from vision/brief wording "到达即撤离"
- Decision: Extraction triggers only when the player presses E while inside the extraction point's trigger radius. Not automatic on touch.
- Alternatives: (a) auto-on-touch (literal vision/brief wording); (b) dwell 0.8s then auto-extract.
- Reason: The extraction point is Slice 1's only glow source and thus the player's constant navigation anchor — they move toward it and pass near it all run. Auto-on-touch would end the run on an accidental brush, precisely during the "should I grab one more?" deliberation — that's an accident, not tension. Press-E separates the irreversible (extract) from the reversible (pickup, which needs no key), and reuses architecture's existing InteractionTrigger "press E" idiom (purification modules).
- Impact: ExtractionSystem.canExtract()/requestExtract(); HUD shows "按 E 撤离" prompt inside the radius. vision.md left unchanged (this is a Slice-level interaction refinement). If playtest shows the key reads as bureaucratic, fallback is dwell-0.8s-auto. Updated wording in current-slice.md scope + slice-1.md T3 brief.

## DEC-010: Chaos may overflow 100 up to a HARD_CAP of 150
- Date: 2026-07-26
- Phase: Slice 1 (T3 design; resolves T1 escalate item 5)
- Type: Design choice (core mechanic)
- Decision: Chaos `value` is allowed to exceed 100 and is clamped at a new `HARD_CAP = 150`. `MAX_VALUE = 100` keeps its number but its meaning changes to "HUD full-gauge mark + third threshold." Penalties keep escalating on the 100→150 band (radius/edge/flicker/speed via T1's modulators). `CHAOS_CHANGED.max` still transmits 100 (so 50/75 tick marks read correctly); `value > max` becomes a legal state the HUD must render as an overflow state.
- Alternatives: (a) hard cap at 100 (original constant); (b) redefine "超阈值" as "reaching 100" (no overflow band).
- Reason: A hard cap at 100 removes any additional cost the moment it's hit — the optimal play degrades to "cap out, then clear the map calmly," switching off the greed-vs-retreat gamble in the exact phase it should be tightest. vision.md states chaos is a "soft limit, not a hard cutoff, with penalties escalating past the threshold," which requires headroom above 100. art §7.2's 4th tier is a ramp, not an instant. Capping at 150 (not infinite) guarantees the player can always crawl back to extraction (world.md is "infiltration," not "execution").
- Impact: constants CHAOS overhaul in T9 (add HARD_CAP/THRESHOLD_3/CHASE_RATE_MULT/etc.; replace 2-tier discrete penalties with the 4-anchor continuous curve). HUD needs an explicit overflow state. Resolves T1 escalate item 5. Delegated to and decided by the T3 design pass.

## DEC-009: Rift viewport via camera zoom (match art framing)
- Date: 2026-07-26
- Phase: Slice 1 (T1 design)
- Type: Technical + feel choice
- Decision: Keep the 960×640 canvas but apply `camera.setZoom(1.5)` in RiftScene so the logical viewport is ~640×427 ≈ 20×13 tiles, matching art-direction §3.1's intended ~20×15 framing (canvas is 3:2 so exact 20×15 is impossible; width lands at 20 tiles, height ~13.3).
- Alternatives: (a) keep 30×20 tiles (no zoom, wider/opener view); (b) change canvas to 4:3 to hit exactly 20×15.
- Reason: A tighter ~20-tile-wide viewport makes a fixed vision radius occupy a larger share of screen, supporting the Darkwood-style claustrophobia (DEC-007 route). Aligns runtime with the framing art assumed when authoring §3/§7 numbers, so vision-radius tuning transfers.
- Impact: code agent implements `camera.setZoom(1.5)` in T5. art agent reconciles §3.1 wording to the real runtime. VisibilitySystem's suggested radii were already given for a ~20-tile viewport, so they stand. Resolves escalate item C in `system-movement-vision.md`.

## DEC-008: Player facing = movement direction (keyboard), reject mouse-aim flashlight
- Date: 2026-07-26
- Phase: Slice 1 (T1 design)
- Type: Design choice (game feel)
- Decision: Player facing (which drives the vision cone) equals the last movement direction, keyboard-only. No mouse-aimed flashlight.
- Alternatives: (b) mouse-aimed vision cone (aim independent of movement); (c) keyboard + optional "hold to lock facing while strafing" (kept as a future extension point, single-entry in Player).
- Reason: Turning to look must cost "changing where you move," which keeps the darkness behind you a real threat (experience pillar 1 "tension at the edge of despair"). Mouse-aim would let players back away while scanning, dissolving the concept of "behind" and deflating the pressure; it would also require 8–16 directional sprites, exceeding art §3.3's four-direction plan.
- Impact: Player exposes a single facing-source entry point (future strafe-lock is a one-line change). Four-direction sprites only. Resolves the facing A/B in `system-movement-vision.md`.

## DEC-007: Art direction confirmed — pure top-down pixel (Darkwood route); reject Hades-style repaint
- Date: 2026-07-24
- Phase: Foundation (post Step 3) / Slice 1 planning
- Type: Direction confirmation (art + design)
- Decision: Keep the locked art direction — pure top-down, 32px pixel art (Darkwood family). Do NOT pivot to Hades-style presentation (3/4 perspective + hand-painted 2D + normal-map lighting + hand-authored rooms).
- Alternatives considered: (a) 2.5D top-down pixel (Gungeon/CrossCode wall-face trick); (b) 3/4 pixel + modular chunks + simple dynamic light ("pixel Diablo"); (c) full Hades (hand-painted 2D, 3/4 perspective, normal-map lit, bespoke rooms).
- Reason: Hades' look is not "more effort" but a different production tier that fights BOTH load-bearing bets of this project: (1) AI-generated art — pixel hides AI inconsistency, painterly exposes it (art-direction §1.3); (2) procedural map generation — Hades uses hand-authored bespoke rooms, incompatible with Voronoi+CA tilemaps (DEC-ARCH-003/005). Darkwood proves pure top-down pixel can carry extreme atmosphere within our AI-vibe budget; user is willing to treat it as a near-reskin reference.
- Impact: art-direction.md (pixel/top-down) and architecture.md (procedural tilemap) stand as-is; no Foundation repaint. The perspective question raised by the isometric reference image is now CLOSED (stay top-down). A-G3 composition test's purpose narrows: prove & tune expressiveness WITHIN the pixel/top-down route, not decide a perspective/repaint pivot.
- Transferable lesson kept (from the Hades analysis): anti-mosaic expressiveness comes from MODULAR variety (tile variety + transition/autotile tiles + overlay decals + prop density + runtime lighting + limited vision), not from uniform 32px grid tiling. Even Hades is modular reuse; the mosaic look comes from uniform-grid tiling, not from modularity itself.

## DEC-006: Purification Point as walkable space with boundary atmosphere
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice + Design alignment
- Decision: PurificationScene is a tiny walkable top-down space (~12x10 tiles) reusing RiftScene's rendering pipeline. Modules are interactable entities triggered by proximity. Boundary darkness features periodic subtle movement (particles + blurry apparitions) to convey external pollution pressure.
- Alternatives: Pure UI/menu screen (no spatial component), separate rendering system
- Reason: (1) Reusing rendering infrastructure reduces code. (2) Walkable space makes "seeing the darkness outside" a continuous visceral experience, not a static image. (3) Boundary atmosphere directly supports "lonely ritual" experience pillar. (4) User explicitly stated "seeing the outside darkness is important for atmosphere and player emotion."
- Impact: VisibilitySystem and Player movement must be extracted as reusable modules (not hardcoded into RiftScene). New BoundaryAtmosphere system (particles + timed sprite apparitions). New InteractionTrigger system (overlap + DOM panel lifecycle). PurificationScene map is hand-designed (not procedural).

## DEC-005: Map generation changed from BSP to Voronoi + CA hybrid
- Date: 2026-07-22
- Phase: Foundation
- Type: Direction change (supersedes DEC-003)
- Decision: Use Voronoi partitioning (macro) + Cellular Automata (micro) + fracture connectors instead of BSP
- Alternatives: BSP (original choice, too architectural), WFC (hard to tune), pure CA (no macro structure)
- Reason: World-building dictates rift interiors are "fragments of alien spacetime" -- they should feel organic, broken, non-architectural. BSP produces rectangular rooms + straight corridors that feel like buildings. Voronoi naturally produces irregular "shard" shapes matching the lore. CA fills fragments with organic cave-like terrain. Narrow fracture connections between fragments serve as natural decision points and stealth chokepoints.
- Impact: Map no longer has "rooms" concept; replaced by "fragments". Pathfinding still grid-based (CA output is tile data). Visual variety comes naturally from organic shapes. Need flood-fill connectivity validation pass.

## DEC-004: Self-implemented i18n (not i18next)
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: Self-implemented i18n with TypeScript locale files + typed key paths, supporting zh-CN and en
- Alternatives: i18next (full-featured library), typesafe-i18n (build step), FormatJS
- Reason: Game text volume is limited (<300 keys). Self-implementation is ~80 lines, zero dependencies, fully type-safe (missing keys caught at compile time). i18next's plugin ecosystem (namespaces, backends, plurals) is unnecessary for this scope. TypeScript files (not JSON) allow compile-time validation that both locales have identical structure.
- Impact: No plural rules, no date formatting, no RTL support. If text volume explodes or languages exceed 3, may need to migrate. Key naming convention: `[domain].[context].[item]`.

## DEC-003: ~~BSP for procedural map generation~~ (SUPERSEDED by DEC-005)
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: ~~Use BSP (Binary Space Partition) algorithm for dungeon generation~~
- Alternatives: WFC (Wave Function Collapse), Cellular Automata, Drunkard's Walk
- Reason: ~~BSP produces predictable room+corridor layouts that match the game's need for route choice and line-of-sight blocking. Simple to implement and debug. WFC produces more natural results but is significantly harder to tune and debug under time pressure.~~
- Impact: ~~Map layouts will tend toward rectangular rooms with straight corridors. Post-processing needed for visual variety.~~
- **Superseded**: BSP too architectural for "alien spacetime fragment" aesthetic. See DEC-005.

## DEC-002: Event Bus architecture (not ECS)
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: Use typed event bus for inter-system communication instead of ECS
- Alternatives: ECS (bitecs/miniplex), direct method calls, Redux-style store
- Reason: Entity count is low (<50 simultaneous). ECS batch-processing advantage irrelevant at this scale. Event bus is more intuitive for AI code generation and matches Phaser's own design patterns. Simpler mental model.
- Impact: Systems are class instances, not pure processors. If entity count grows significantly (>100), will need re-evaluation.

## DEC-001: Phaser 3 as game framework
- Date: 2026-07-22
- Phase: Foundation
- Type: Technical choice
- Decision: Use Phaser 3.80+ as the primary game framework
- Alternatives: PixiJS (render-only), Excalibur.js (smaller community), raw Canvas
- Reason: Most mature and documented Web 2D game framework. Built-in physics, input, audio, camera, scene management reduces ~60% boilerplate. Largest community ensures best AI vibe coding quality (most training data available). TypeScript support is solid.
- Impact: Architecture constrained to Phaser Scene lifecycle. Physics limited to Arcade (AABB). UI limited in Canvas (compensated with DOM overlay for complex screens).
