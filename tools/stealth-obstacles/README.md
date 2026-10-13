# Authored obstacle evidence tools

These offline tools read production recipes and maps. They never add, move, resize, or repair map content. Associated features: COH-F011/F012/F019/F044; authoring inputs remain CSV. Run from the repository root with Node, `tsx`, and the existing Phaser stub alias configuration.

## Capture and compatibility

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx tools/stealth-obstacles/baseline.mjs capture NEW_BASELINE_DIR
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx tools/stealth-obstacles/baseline.mjs replay BASELINE_DIR NEW_REPLAY_REPORT.json
```

Defaults are the three representative worlds `split-rib-causeway,gel-rafts,sloughed-court`, seed `20261012`, and `low,medium,severe`. `QA_WORLDS` may narrow or replace the explicit list, up to five unique worlds. `QA_GRADES=medium` captures only the medium-grade after-state. A replay always reads all saved recipe rows, irrespective of these environment variables. No replacement seed is drawn; admitted generator retries and effective seeds are retained in each receipt.

Capture freezes every recipe before generation. Every grade receives a recursive full-map hash preserving typed-array types and bytes. Medium also stores the complete map, four RGBA surface channels in both `intact` and `searched` states, search-patch data, and real material PNGs. Replay regenerates those exact old recipes with current production code and compares complete maps, medium surface channels, and patches. It does not recreate old recipes from today's CSV. Generation/data source hashes must remain stable during the run. Material source bytes are recorded and checked at replay.

Output paths must be new. Failed runs and their first error remain available; successful work never overwrites an earlier attempt. V8 gzip files are local diagnostic snapshots, not the game's save format.

## Clearance and route measurements

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx tools/stealth-obstacles/diagnose.mjs BASELINE_DIR NEW_DIAGNOSTICS_DIR REQUESTS.json
```

The optional request JSON is keyed by world ID:

```json
{
  "split-rib-causeway": {
    "regions": [{"id":"northeast","bounds":[1195,280,1930,650]}],
    "routes": [{"id":"named-crossing","from":{"x":400,"y":1190},"to":{"x":1010,"y":1510}}],
    "detours": [{"id":"named-obstacle","objectId":3,"from":{"x":1300,"y":444},"to":{"x":1660,"y":444},"sideA":{"x":1476,"y":300},"sideB":{"x":1476,"y":588}}]
  }
}
```

Example coordinates only illustrate the schema; they are not accepted route evidence. An unsafe endpoint fails explicitly. Every run additionally checks spawn-to-extraction.

Measurement domain: spawn-reachable centers for the actual 20×20 player body, sampled every 8px, connected by continuous production body sweeps. Solid distance is exact at each center to the union of nondegenerate solid XY triangles, excluding relief and groundEdge. BVH boxes only accelerate triangle-distance queries; they never stand in for occupied geometry. VOID distance is independently measured to actual 8px terrain/VOID boundary segments. Solid WALL cells remain terrain for that boundary. Neither value is a line-of-sight or stealth-coverage metric: ordinary solid does not block AI sight in this production version.

`clearRadius = min(solidDistance, voidDistance)` describes empty space. Maxima and percentages retain 8px sampling uncertainty. Open-component areas count four-connected qualifying sample cells at explicit radius thresholds (112/224px); this is not exact continuous polygon area. Route minimum distances are at path vertices. A separate continuous-radius lower bound subtracts half the longest segment, using the distance-field Lipschitz property. Exact body sweeps independently prove the 20×20 body fits all used segments.

A successful detour uses two continuously swept routes on opposite sides of an **interior point of a real triangle of the named solid**, without backward projection on the endpoint axis. Their closed loop must wind once around that point. This rejects the counterexample where both opposite-side waypoints eventually use the same south passage beside a north-boundary wall. The test is conservative: failure does not prove another curved or backtracking bypass is impossible. Passing a group representative never passes every object in the group.

Requested route/detour failure makes the diagnostic summary `failed` and exits 1. The annotated PNG overlays actual material output with clear-radius maxima, region bounds, ordinary routes (green), and accepted detour sides (cyan/pink). Full coordinates and sweep results remain in JSON.

## Search for conservative local witnesses

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --expose-gc --import tsx tools/stealth-obstacles/witnesses.mjs BASELINE_DIR DIAGNOSTICS_DIR AUTHORED_REGIONS.json NEW_SEARCH_DIR
```

The authored-region file names new placement IDs and optional route endpoints. A finite grid of horizontal/vertical candidate endpoints around each actual mesh is tested; all rejected candidates are reported. Candidate bounds only guide the search. Acceptance uses triangle interiors, full-body sweeps, and winding. `completed-search` means the finite search completed, not all objects passed. It emits `selected-requests.json`; run `diagnose.mjs` against that file to produce strict acceptance receipts and marked images. Keep missing object IDs and unsupported author-suggested endpoints in the final report.

## Compare before and after

```sh
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/stealth-obstacles/compare.mjs BEFORE_MAPS AFTER_MAPS BEFORE_DIAGNOSTICS AFTER_DIAGNOSTICS NEW_REPORT.json
```

This checks that every original instance and mesh remains identical, the actual VOID mask remains identical, and VOID distances on common reachable centers remain identical. It reports both current-domain distributions and common-domain solid/VOID distributions; adding obstacles removes supported centers, so current-domain VOID percentiles may change even with unchanged shores and holes.

## Tool checks

```sh
npm run typecheck
npx tsc --noEmit -p tools/stealth-obstacles/tsconfig.json
TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/stealth-obstacles/check-diagnostics.mjs
```

The synthetic controls cover disjoint triangles inside one bbox, relief and groundEdge exclusions, independently measured VOID, exact positive two-sided routes, the north-boundary false-positive counterexample, invalid via points, and invalid input. They generate no production worlds. Repository `npm lint`/`npm test` scripts are absent; use strict TypeScript/noUnused checks, `node --check` for entrypoints, and the relevant existing native-body checks. Build or snapshot equality does not establish aesthetic quality, natural play, enemy LOS concealment, or library-wide coverage.
