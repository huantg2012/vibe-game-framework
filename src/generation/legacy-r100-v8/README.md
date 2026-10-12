# Frozen revision 8

`executor-revision8.js` is the revision-8-only closure captured from Git `7c744d3dabdee45cafbafe375878f81bae328c1c`, before grounded search deployment. Exact AST-checked imports/returns for revisions 1–7 are removed, and the surface boundary explicitly rejects other revisions. No algorithm, table, numeric constant or source material path is substituted. The manifest records the fixed source, transformations and dependency hashes.

`executor-recovery.js` exports only validation, map reconstruction and material baking. After proving the only remaining world-catalog use is the original exact-ID membership predicate, the 108-row catalog is projected to IDs. The full factory closure stays as the independent tool oracle; runtime imports only the smaller recovery closure. This avoids shipping a second full world catalog solely to restore old trips.

Reproduce both files without overwriting them:

```sh
node tools/recovery/derive-native-r100-revision8.mjs
node tools/recovery/project-native-r100-revision8.mjs
```

Initial six-world fixtures were independently generated from the unmodified fixed Git source before this closure existed. They contain complete maps and four native material-layer hashes at `docs/qa/artifacts/pickup-grounding-implementation-2026-10-12/legacy-r8/`; the replay checks both live historical dispatch and unchanged material output. They are medium-grade finite fixtures, not universal coverage or browser recovery proof. Additional generation checks compare all 306 unaffected new-departure recipes and two unaffected full maps against this fixed factory.

Revision 9 is selected only for registered grounded-search worlds. Revision 8 saved departures do not receive source metadata, new node positions or local material patches. The historical closures and their published asset paths are immutable. Source/control metadata are integrity receipts, not anti-cheat signatures.
