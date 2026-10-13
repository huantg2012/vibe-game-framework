# Shared spatial completion diagnostics

Production code is `src/generation/world-study/spatial-augmentation-{types,measure,candidates,selection}.ts`. The tool directory contains CSV compilation and small independent regression/batch consumers; it does not implement an alternate layout algorithm.

```sh
node --import tsx tools/spatial-augmentation/codegen.mjs
node --import tsx tools/spatial-augmentation/codegen.mjs --check
node --import tsx tools/spatial-augmentation/verify-profile-capability.mjs /tmp/spatial-profile-capability.json
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/spatial-augmentation/check-independent-contracts.mjs /tmp/spatial-augmentation-check.json
```

Use a fresh report path on each QA run; existing evidence is never overwritten.

All live authored-fragment augmentation templates require construction 4. Codegen and frozen-policy validation reject construction 3 before spatial search. The capability fixture builds both size endpoints of each template and checks the actual authored-erosion contract; its negative control distinguishes a valid standalone v3 mesh from an incompatible authored-terrain instance.

The policy and material profiles originate in the two `data/rift-spatial-augmentation-*.csv` files. Generated values freeze the complete policy and profiles plus source SHA256. Recovery validates those saved values, not equality with today's CSV. Package dependencies must be regenerated with `node tools/world-study/codegen-r100-packages.mjs` after production source changes.

Pure APIs:

- `buildSpatialGeometry(definition, seed)` compiles actual geometry/support/VOID without a pixel material raster or content deployment.
- `createSpatialBaseline(geometry, parameters)` fixes supported probes, visibility endpoint pairs, original denominators and wide-core relationships.
- `measureSpatialCandidate(baseline, geometry)` evaluates the same original samples. Deleted/disconnected samples retain baseline costs. No-original-core ratios are `null`.
- `evaluateSpatialCandidate(baseline, current, candidate, policy, seed)` returns a small receipt and only retains a candidate state when all guards pass. It does not mutate arguments.
- `augmentSpatialTerrain({definition,fragmentShape,policy,seed,candidateSeed})` returns at most two small geometry plans with their actual updated fragment snapshots and explicit traces. Production lazily performs final raster/content generation, at most two finalists per existing seed attempt.
- `createR100SpatialBaselineTerrain(nativeDefinition, spatialPolicy, effectiveSeed)` returns the exact production base definition and fragment snapshot used for before/after comparisons.

Production derives `candidateSeed` from the requested seed, world ID, frozen algorithm/version/source hash and effective geometry seed. Geometry uses the same effective seed for proposal measurements and final construction. Two finalists within an attempt share a plan; the next existing geometry attempt may remeasure. Fixtures may omit `candidateSeed` to use `seed`.

Trace lives at `map.native.diagnostics.spatialAugmentation`; actual final fragment authoring is `spatialAugmentationFragmentShape`. Final preparation/deployment rejections are separate receipts. Traces contain no clocks; timings belong only in external evidence. They record `disabled`, `policy-targets-met`, `no-feasible-improvement`, or `budget-exhausted`, explicit remaining physical/optical burdens, chosen additions, and limited reveal witnesses. `policy-targets-met` is not gameplay acceptance. A baseline with both burdens zero is explicitly `no-deficit`.

Physical distance uses the union of projected solid triangles and actual 8px missing-ground boundaries separately. Ground-edge triangles are excluded from solid footprint. The solid area guard is a conservative union of 8px cells intersecting true triangles; it is not bbox area or exact continuous area. Visibility uses the shared VOID-only ray: ordinary solids cannot improve optical occlusion. Original solid and non-ground-owner relief keep their supported footprint; the ground-edge owner substrate is instead constrained by original-ground loss, wide cores and connectivity.

The planner checks finite probes and discrete continuous-sweep paths, not every possible player/AI encounter. Source worlds, distinct primary forms, spawn/extraction, content quotas and legacy capacity guards remain authoritative. New VOID recompiles the unchanged shared fragment v1, which can change earlier shore details; the original r10 recipe is handled by its immutable executor.

Run at most five worlds per qualification batch, using the fixed requested seed on failure. Keep small JSON hashes/receipts and a few full images. Existing r10 baselines in `docs/qa/artifacts/spatial-augmentation-2026-10-13/qa/` reference prior immutable artifacts; do not duplicate map/surface megabytes.

Render already-tested cached maps without another complete production run:

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx tools/spatial-augmentation/render-batch.mjs COMPLETED_REPORT.json NEW_OUTPUT_DIRECTORY
```

This renderer refuses unfinished/failed reports and checks each cached map hash. Structure views use the real 8px support/collision grid at the tested effective seed; the final view marks the actual spawn and extraction. The material view uses production surface baking and intact search patches, without gameplay fog/lighting. It is a topology/material review aid, not normal-camera play or an all-world verdict. Temporary full maps remain outside the repository.


Local reveal correction regression:

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx tools/spatial-augmentation/replay-focus.mjs <completed-medium-report.json> <completed-low-severe-report.json> <completed-seed0-report.json>
```

This consumes the exact frozen recipes and verified temporary maps named by completed reports. It does not regenerate authoring inputs or bake material images. Its report separates full-map/trace, geometry, layout and presentation-input hashes; final temporary maps and recipes use a new cache directory (`QA_MAP_CACHE`), preserving prior evidence. `QA_REPORT` selects a fresh output file. The resulting `-render-medium.json` is the five-case input for `render-batch.mjs`.

Production reveal witnesses require the initial observer inside the candidate hotspot radius. The initial pair remains within 208px; the reveal endpoint must be within the 224px reference sight range, with the same shared LOS and complete 20px-body movement checks. This is one local witness; it does not establish narrow-neck counts, narrow-region travel lengths or every joint-reachability summary.
