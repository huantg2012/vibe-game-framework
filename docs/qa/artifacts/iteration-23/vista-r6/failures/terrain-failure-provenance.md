# R6 terrain failures retained by code

## First quality segment: visual rejection

Source: `../2026-09-15T14-50-26-483Z/` actual QA frames, especially `quality-west.png` and `quality-crown.png`. ROOT and art rejected the large closed wedges, nearly uniform deposition and plain cliff faces. Geometry passing did not certify those images. The subsequent terrain batch removes the large closed entrance/west/east wedges and authors their relief in the actual top mesh.

## New route-band gate: first failed run

`route-grade-first-failure.log` is an unedited copy of `/tmp/coh-r6-terrain-batch2-first.log`, produced by `node tools/living-landmass/check-vista-terrain.mjs`. The newly added real triangle-normal sampling within the full body-width route band found slope 0.36269343499124373 on spawn → west-rise before reaching the worst point. A separate diagnostic located that route's maximum at 0.43487204300335347 near (431.21,1432.15). Moving the high entrance and west crests farther out preserved their side relief while restoring the route band below 0.3. The second run passed with route max 0.25415545023357616 and overall max 0.5432573357977823. The overall side-slope ceiling of 0.6 and route ceiling of 0.3 were explicitly approved by ROOT for R6; this was not deletion of an inconvenient assertion.

## Second quality segment: UV folding and overlapping cliff skins

Source: `../2026-09-15T14-59-34-091Z/quality-upper-west.png` and `quality-crown.png`, directly reviewed by art and ROOT. The hard-shell/deposit boundary and central exposed bed showed zigzag/fan stretching. Terrain vertex UVs selected a dominant stratum; neighbouring triangles could interpolate across different charts. Fix: continuous world-plane hard-shell coordinates, independently scaled/oriented from sediment, rocks and sections. `check-vista-terrain.mjs` now bounds the UV gradient on every actual top triangle edge.

The crown's forward section also showed thin bright grid lines. Separate section skins intersected the base cliff and used different coordinates. Fix: author the three local section offsets into the single closed cliff mesh; remove the extra coincident mesh. The exact shared Float32 rim, closed internal side seams and monotonic cliff columns remain checked.

## Existing machine-gate gap

`npm run lint` was attempted and returned `Missing script: "lint"`. The repository provides no lint script/configuration. No passing lint result is claimed. TypeScript, actual geometry/support tests, existing living-landmass tests and the local Vite/Chrome smoke were executed separately.

These records concern implementation failures and technical checks. They do not establish user visual approval, audio listening approval, or player return-route memory.
