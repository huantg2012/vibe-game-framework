# I26-D implementation worklog

Owner: `/root/blind_play_review`, now code (the earlier blind review is complete).

## Authorized scope

- Independent `rift-world-play.html` → original `RiftScene` DEV fixture, memory storage.
- Same 1792×1216 world, root-owned 8px support, original centered 20×20 Player.
- Original visibility/AI/combat/search/inventory/extraction; no open-void sight override.
- Adapter and Phaser 2D surface runtime; no production random-pool changes.
- Root owns package/docs integration. Other agents own shared world generation/rendering.

## Read / decisions

- Explicitly read `.cursor/agents/code.md`, `CLAUDE.md`, architecture/current map and movement contracts, current inventory and relevant AI/search/extract rules. Parent confirmed changed interfaces.
- Explicitly read in-game-ux. Art's shortest check permits existing build-lab meta sidebar plus original HUD; must verify overlay alignment and bright-material legibility in real scenes. VOID must remain black and unlit.
- Root interface `getWorldSupportGrid` is available. The adapter will take it verbatim, not rewrite terrain to force admission.
- Procedural seats use body-safe graph; reject/retry explicitly with requested/effective seed and rejection history.
- Reuse CSV-authored watched encounter forms/loot tiers and build-lab loadouts, not enemy/item numeric copies.
- Empty environment-host pins: initial scope is two real native ground enemies, four real search nodes, one real extraction.
- Borrow existing native outdoor pile **appearance only** through the DEV visual factory. Actual item source remains `world-study:<profile>`; metadata discloses borrowed appearance.
- Read-only QA API planned: `__worldPlay.getState()`, `getRecord()`, `getRoutes()` (actual positions and body-safe graph paths; no state mutators).

## Checks planned at implementation start

- Adapter, runtime, page/controller, grid-size fixes, admission checks and actual-input probe are implemented below.
- Typecheck, relevant existing checks, real keyboard search/extraction/death, storage isolation and art screenshot checks are recorded below.
- No lint command exists in package scripts; do not claim lint ran. `git diff --check` passed for owned files.

## Implementation / checks so far

- Added independent entry, body-safe layout adapter and native Phaser 2D surface. Four RiftScene tile-coordinate conversions now use actual tile size. Original Player untouched.
- First typecheck exposed one implicit-context annotation; fixed by typing the entire fixture with `satisfies RiftDevFixture`; typecheck passed. This also caught/prevented using the wrong visual-factory argument contract.
- Dedicated 30-case admission matrix (5 worlds × 2 spaces × 3 seeds) passed exact support/VOID opacity, 20px routes, native forms/patrol sweeps and determinism. The first test version miscalled TileGrid's output-parameter method; corrected the check, not the implementation.
- Original field-loot and physics-runtime tests passed using `TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx ...`; the npm/tsx launcher was blocked by sandbox IPC (`listen EPERM`).
- 3011 accessible in authorized local browser. Initial scene startup produced no pageerror. Real footprint is centered 20×20, safe-search route reached by keys, release interrupts channel, sustained E reduces remaining 4→3 and kindling 0→1.
- Browser check run 1 stopped on an incorrect **test** expectation that safe kindling guarantees a first weapon; formal loot rules do not. Corrected assertion to actual kindling collection.
- Browser check run 2 was interrupted by Vite reload while reading `__worldPlay` (parallel source edit). Browser closed. Per code-role two-failure escape rule, parent notified and repetition paused pending scheduling instruction. This is a QA scheduling failure, not evidence of gameplay failure.
- Parent required live material response. Added a fixed 520px native CanvasTexture for shared `paintMaterialLight`, at 15Hz, cropped by actual support and native visibility, under the original mask.
- Parent rejected high-depth inverse-VOID overlay because it could reveal unknown hole outlines. Removed it. Added parent-authorized narrow DEV `suppressVoidNoise` switch to RiftScene; this page alone disables fog noise and sets its void color black. Default fixture still receives unchanged `createRiftVisionConfig`. The visual difference is explicit in metadata.
- Art shortest check allows native HUD plus scoped build-lab meta sidebar. Actual art/saturation and overlay screenshots remain pending.

## Completed native input evidence

- Parent authorized continuing after the two test orchestration failures. Built a **DEV QA static** bundle (`NODE_ENV=development vite build --outDir /tmp/coh-i26-play-static`) and kept preview at `http://127.0.0.1:3012/`, server session 27587. No HMR, separate from normal production dist. Root ran ordinary production build separately.
- `play/verified/` contains first complete native outing: 1583px traveled, one kindling, two native suspicious/chase responses, four 15-damage hits, HP40 extraction at38.3s, three clean restarts, zero formal-save writes. This version still used48px extraction display glow.
- `play/final/` contains the8px-glow mechanics baseline: 37.2s real extraction atHP55, five clean restarts across all five worlds, then deliberate native enemy exposure and real death at27.3s. Death cleared weapon and carried items; no forced damage/death or teleport. All storage instrumentation writes empty. Existing native gameplay recorder distinguishes extracted/aborted/death.
- Native body exact footprint is20×20 centered on Player position. World retains1792×1216 and224×152 support cells. Hidden native TilemapLayer handles collision; no per-void static body objects were introduced.
- `play/corner/` walks from spawn to the old corner in crystal-fibre/fracture-fields/175150: arrives(917.401,819.386), W stops at(917.401,818), second W remains there; D600ms continues to(963.956,818), S350ms retreats to(966.179,845.444). Old12px point(917.71,817.27) is illegal for20px body, so it was not used as a spawn/teleport. This proves correct stop/tangent/retreat for this case, not friction elimination at every corner.
- Root approved native extraction glow display radius8 so it remains inside its supported seat. Metadata records that visual difference. Native whole-screen damage/chaos feedback remains unmodified; it is not terrain illumination and must not receive an inverse-geometry mask.
- Root authorized optional result return-label plumbing in `rift-result-panel.ts` + fixture. Default remains“返回净化点”; this page explicitly says“返回配置”. No CSS/layout/input changes. Art shortest check approved the wording.
- `play/cobalt-motion/` uses the final label revision and records a real38.1s cobalt-gold outing: search interruption/completion, two native threats, HP40 extraction, actual R return, zero formal-save writes. It includes moving-threat/moving-damaged PNGs and a full input-run WebM; latest result button text assertion passed. This retest specifically addresses original brown character near dark gold/grey-green terrain, without changing the character.
- `play/final-source.sha256` and `play/static-build.json` record source and served bundle identities. Latest only label/plumbing differs from the full death/restart mechanics pass; cobalt covers that new label and return in a real outcome.

## Current remaining work

- Exclusive10-case frame-timing probe and original no-fixture compatibility check passed; browser closed after the run,3012 preview stays available.
- Art reviewed still frames: carmine player/pile readable; cobalt near-color boundary requires the supplied movement/threat frames/video, not a blanket visual PASS.
- This remains an isolated minimal sortie. It does not validate the base offering loop, persistent recovery, long-term supply/balance, every production enemy portfolio, or full production-layout population quotas.

## Final verification and implementation inventory

- `performance.json`: five worlds×two spaces, each3s stationary+3s real keys,1600×1040 DPR1/headlessChrome/960×640 logic. All20 measured windows≈60.00fps; worstp95/p99/max16.8ms; zero measured frames>33.4ms. Cold first scene ready1039ms; later navigations561–651ms. These are bounded initial-area checks, not all-hardware or long-session certification.
- Native material reflection pixels varied with the data: ash0, crystal12–28, ivory1571–1816, carmine3235–3475, cobalt64–84 at the measured final poses. Every scene retained exactly2 world surface textures. This confirms the material-light path is active where the shared recipe registers reflective faces; it is not a second lighting simulation.
- Original `/#rift=70421` no-fixture runtime retained32px grid, `voidNoiseEnabled:true`, `voidColor:0x080a0c`, original224/80px ranges,50°/30° cone/falloff, lamp/flashlight strengths and normal movement (x560→576.107 under D). Its result-label assertion is explicitly **pure presentation**, not a synthetic outcome credited as gameplay evidence; default text remains“R 返回净化点”.
- Final mechanics checks:30 admission cases; original field-loot and physics-runtime; `npm run typecheck`; parent ordinary production build; our DEV static build. No pageerrors in native outings, corner or performance/default checks.
- Code: `rift-world-play.html`, `src/dev/world-play.ts`, `src/dev/world-play-surface.ts`, `src/generation/world-study/play-map.ts`; narrow RiftScene grid-size/DEV vision/return-label plumbing and optional `RiftResultData.returnLabel`. No original Player edits, production pool edits, new authored gameplay numbers, CSV changes or copied enemy/inventory systems.
- Tests: `tools/world-study/check-play-map.ts`, `probe-play.mjs`, `probe-play-corner.mjs`, `probe-play-performance.mjs`. Browser probes use normal keys; route readback is only for deterministic QA navigation. `__worldPlay` is frozen and read-only (`getState/getRecord/getRoutes/inspectPoint`), with no teleport/damage/force-settlement API.
- Persistent service: `http://127.0.0.1:3012/rift-world-play.html`, isolated static preview session27587. Final served module hashes in`static-build.json`; source hashes in`final-source.sha256`. Normal development remains3011.
