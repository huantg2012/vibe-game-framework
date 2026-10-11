# Immutable native revision 7

Source: `b2d737901ebe6e7ea61c4ea37be3470370d981a4` (Git archive, never the current working tree).

The public live dispatcher must route revision 7 packages and native surfaces to `executor-recovery.js`. Its synchronous API is:

- `validR100ProductionRecipe(value)`
- `createR100ProductionMap(recipe)`
- `bakeMasterWorldSurface(world, painting?)`

`executor.js` is the full historical oracle through revision 7; it additionally exposes `createR100ProductionRecipe(worldId, seed, grade)` for reproducible saved-package fixtures. `executor-revision7.js` removes only exact AST-matched routes/imports for revisions 1–6 and guards surface preparation against other revisions. `executor-recovery.js` drops the factory export and projects the historical world catalog to its 108 IDs only after proving the remaining sole consumer is the original ID-membership predicate. Use neither larger oracle as the live recovery entry.

All three artifacts have zero external imports. Their manifests record source/dependency hashes and the exact derivations. `assets.json` protects the original material PNG paths. Missing `terrainOutline` and present positive-outline r7 policies retain their historical behavior and validation budgets. New rectangle-fragment geometry belongs to a later revision; this archive must not be regenerated from new source or data.

Reproduce without writing:

```sh
node tools/recovery/freeze-native-r100-revision7.mjs
node tools/recovery/derive-native-r100-revision7.mjs
node tools/recovery/project-native-r100-revision7.mjs
node --expose-gc --import tsx tools/recovery/check-native-r100-revision7.mjs --report /tmp/r100-revision7-check.json
```

The report path must not already exist. The check covers all 324 historical recipes and four complete representative maps: cinder-ridge in all three grades (positive outline), and quiet-spur medium (legacy outline absence). It compares complete serialized values/raw typed-array bytes and four surface RGBA buffers across the original, revision-only and recovery artifacts. It does not qualify revision 8, browser cold recovery, image-decoder equality or new gameplay.

After the live revision dispatcher changes, compare its old-package route with the completed oracle report (four extra live maps, no repeated oracle baking):

```sh
QA_REFERENCE=docs/qa/artifacts/r100-fragment-rollout-2026-10-11/revision7-freeze.json node --expose-gc --import tsx tools/recovery/check-native-r100-revision7-live.mjs --report /tmp/r100-revision7-live-check.json
```

This also checks all 324 historical packages through the current public validator and records the live route source hashes. Browser persistence and cold continuation remain separate checks.
