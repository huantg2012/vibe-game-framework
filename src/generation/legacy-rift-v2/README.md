# Pre-R100 generation executor

This is the immutable, dependency-closed executor for unversioned procedural
worlds and world-production recipes 1 and 2. It was built from
`ac9ddd7fab04202d629a97293ffeeb19f71acaec`, before R100 implementation. It preserves
actual generation and placement, not only a signature that rejects old saves.

`executor.js` contains 61 historical source/data dependencies and has no runtime
imports. `manifest.json` records their original hashes, the executor hash and the
compiler version. `executor.d.ts` is the typed boundary, not another implementation.
CSV-generated definitions inside the archive preserve that revision's CSV → code
outputs; do not edit them as new content.

## Dispatch contract

- `src/generation/legacy-rift-generation.ts` owns the legacy boundary.
- Both new version-2 departures and restoration use this same executor. Current
  selection still reads the live production pool and freezes its selected data.
- The live generator remains available to the Gym and development tools.
- A changed production algorithm requires a new explicitly routed version. It
  must not silently replace this executor or produce new version-2 records with
  results the historical executor cannot reproduce.
- Save admission validates historical recipes with the archived validator; a
  future CSV removal or live validator change cannot reject an otherwise valid
  legacy recipe before the historical executor runs.
- The saved identity/signature and original bytes retain their old format.

## Verification

`node tools/recovery/freeze-legacy-generation.mjs` rebuilds from the historical
Git tree and compares the complete bytes and dependency manifest. It never uses
the working tree as historical source. `--write` refuses to overwrite an existing
archive. The original revision and recorded esbuild version must remain available
for source reproduction; ordinary runtime recovery has no Git/tool dependency.

`npm run check:rift-recovery` includes independent-process reconstruction of four
preexisting version-1 gold identities and five new immutable baseline records
(three version-2, two unversioned). The latter compare complete layout, terrain,
Host grid, sample fields, scenery and generation diagnostics with SHA-256. Tests
also poison the mutable validator in an isolated test bundle, validate rejection
of bad contracts/signatures, and ensure new v2 departures match restoration.
The new gold records are generation evidence, **not complete runtime saves**;
the existing recovery suite separately checks real saved frames and owners.

The one-time dispatch migration comparison is:

```
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/recovery/check-legacy-generation-selection.ts
```

It compares the unchanged live baseline with frozen execution for 18 natural
selector seeds spanning all five existing worlds, including successes/failures
and all generated fields. It is a version-migration baseline, not a requirement
that future version-3 development stay identical to version 2.

## Scope limit

This freezes world generation, not the entire game runtime. AI/combat, Host
runtime state, material rendering, audio and scene owners retain their own
version/admission responsibilities. In particular, future changes to shared
support/render interpretation or paint runtime contracts must preserve the old
version's semantics and rerun actual-frame/scene recovery tests. Generation
hash equivalence alone cannot prove visual fidelity or complete runtime
compatibility after those systems change.
