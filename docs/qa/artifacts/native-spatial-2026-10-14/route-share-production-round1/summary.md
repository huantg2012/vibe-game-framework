# Short-route H:S phase calibration: production integration

The approved count-only calibration is connected in `native-spatial-routes.ts`. Its pure classifier consumes the frozen policy's `holeToSolidRatio`, `minRouteHoleShare` and `maxRouteHoleShare`; it does not hardcode 2:1 or special-case seven encounters. The integer cycle guard rejects invalid counts, unsafe arithmetic and noninteger/invalid cycle inputs rather than silently rounding them. The currently frozen CSV ratio is 2.

An already eligible complete route passes the share item if either the unchanged continuous band or the ideal-cycle phase count accepts it. `holeShare` remains the measured fraction. `holeShareAdmission` records the two predicates and the selected basis. Noneligible routes receive `null` and retain their original qualification. The six-encounter window is still checked independently. No CSV, routes, encounter identity/LOS, region, global H:S or transverse rule changed.

Validation passed:

- The production classifier matches the independent Design oracle for 540 integer counts and 81 phase words. The only additional admitted count is N=7 / H=4. Significant imbalance negatives, the same-count six-window counterexample and the old .75 nonperiodic positive remain correct.
- Thirteen invalid count/policy cases throw. An alternate integer ratio fixture confirms that the classifier reads the supplied frozen ratio instead of embedding 2.
- The official G4 function was run over the saved rejected runtime snapshot. This restores collision/distance query objects from the actual saved meshes, masks and body graph; it does not compile geometry, sample a layout, deploy content or invoke the full candidate chain.
- All 20 routes' cells, smoothed points, events, eligibility, six-windows, transverse sections, leg diagnostics and regional fields are exactly equal to the prior G4 receipt. Only two 4H/7 share failures disappear: `node:r100-contaminant-deep-1:hole-share` and `node:r100-kindling-contested-1:hole-share`.
- Five reasons remain: contested contaminant share, contested kindling #2 share, explore region 3 share, deep contaminant transverse opening, explore region 11 transverse opening. The candidate remains rejected.
- `npx tsc --noEmit` passed. The existing independent calibration script was rerun into a separate evidence file and passed. New tool syntax and scoped diff whitespace checks passed. `npm run dev` started in 94ms; `/` and the transformed routes module returned HTTP 200. The temporary server was then stopped.

There is no registered general `lint` or unified `test` script in this repository; those are not claimed as passes. No new map, G5, complete-map replay, Art or user acceptance was tested. Source fingerprints for the measured modules and saved input were stable. The old seven-reason failure receipts were not rewritten.
