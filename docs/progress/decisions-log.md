---
status: ACTIVE
created-by: code agent
created-when: Foundation 阶段
note: Append-only. Do not modify historical entries.
---

# Decisions Log

<!-- Entries in reverse chronological order (newest first) -->

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
