---
status: ACTIVE
created-by: code agent
created-when: Foundation 阶段
note: Append-only. Do not modify historical entries.
---

# Decisions Log

<!-- Entries in reverse chronological order (newest first) -->

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
