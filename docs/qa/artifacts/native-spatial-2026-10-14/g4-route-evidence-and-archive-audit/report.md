# Saved G4 evidence and archive audit

Existing receipts only. No geometry or full-candidate execution.

G4 detour evidence: **insufficient**. Only 1726 distinct route cells / 18631 reachable cells (9.26%) are recorded. There is no complete body graph, VOID mask, solid triangle list or exact clearance field.

A failed shortest route does not establish that no wide detour exists. A 48px clearance-domain path is also not equivalent to the 160px transverse route gate. The JSON records the minimum same-layout observer capture required.

## Duplicate geometry in the eight formal receipts

- **production-gel-code-resume-1.json**: 60.603s; 34 charged geometry work / 34 final evaluations; hashes absent, duplicates unknown.
- **production-gel-code-resume-2.json**: 60.243s; 73 charged geometry work / 73 final evaluations; hashes absent, duplicates unknown.
- **production-gel-global-plan-round1.json**: 60.440s; 35 charged geometry work / 35 final evaluations; hashes absent, duplicates unknown.
- **production-gel-core-shoulder-round1.json**: 60.054s; 61 charged geometry work / 61 final evaluations; 7 repeat evaluations (11.48% of charged work; 11.48% of final evaluations).
  - seed 20261012, hash `5d8c9996c44508de`: candidates 25, 26, 28; 2 repeats beyond first.
  - seed 20261012, hash `a9070563f7ecf8c7`: candidates 32, 33, 34, 35; 3 repeats beyond first.
  - seed 20261012, hash `885e83a83aa63e60`: candidates 38, 40; 1 repeats beyond first.
  - seed 20261012, hash `4ddbbc2cb58624bc`: candidates 51, 53; 1 repeats beyond first.
- **production-gel-feedback-round1.json**: 60.381s; 63 charged geometry work / 63 final evaluations; 10 repeat evaluations (15.87% of charged work; 15.87% of final evaluations).
  - seed 20261012, hash `114888dc56484a38`: candidates 22, 23; 1 repeats beyond first.
  - seed 20261012, hash `9a4b8cad12210d19`: candidates 32, 34, 35; 2 repeats beyond first.
  - seed 20261012, hash `21947b122ae4848e`: candidates 42, 43; 1 repeats beyond first.
  - seed 20261012, hash `809f2eb15882ae25`: candidates 48, 50; 1 repeats beyond first.
  - seed 20261012, hash `79b3a718035f81ec`: candidates 58, 59; 1 repeats beyond first.
  - seed 20261012, hash `f3f1c0feeac38f6a`: candidates 66, 67, 68, 69, 70; 4 repeats beyond first.
- **production-gel-actual-void-round1.json**: 60.193s; 71 charged geometry work / 71 final evaluations; 20 repeat evaluations (28.17% of charged work; 28.17% of final evaluations).
  - seed 20261012, hash `17f39bc9195058b5`: candidates 21, 23; 1 repeats beyond first.
  - seed 20261012, hash `93b78fa238b41516`: candidates 25, 26; 1 repeats beyond first.
  - seed 20261012, hash `0a702a04cd6850a4`: candidates 29, 31; 1 repeats beyond first.
  - seed 20261012, hash `618a555390c4afcf`: candidates 40, 41, 43; 2 repeats beyond first.
  - seed 20261012, hash `37e5e6cb4d006eff`: candidates 49, 50, 51; 2 repeats beyond first.
  - seed 20261012, hash `376fb49506e13c21`: candidates 52, 53, 54, 55, 60, 62, 63; 6 repeats beyond first.
  - seed 20261012, hash `b1951bbfc7c6e263`: candidates 56, 57, 58, 59, 64, 66; 5 repeats beyond first.
  - seed 20261012, hash `57795e2a9cfec9d2`: candidates 69, 70, 71; 2 repeats beyond first.
- **production-gel-qualified-layout-round1.json**: 60.199s; 112 charged geometry work / 68 final evaluations; 11 repeat evaluations (9.82% of charged work; 16.18% of final evaluations).
  - seed 20261012, hash `cb7756fee198dace`: candidates 23, 24, 25, 26, 28; 4 repeats beyond first.
  - seed 20261012, hash `f01c0405cdbd33f9`: candidates 27, 29, 32; 2 repeats beyond first.
  - seed 20261012, hash `38a4df26cfda54ca`: candidates 33, 34; 1 repeats beyond first.
  - seed 20261012, hash `4796d0477841360f`: candidates 42, 44, 45, 46; 3 repeats beyond first.
  - seed 3991160799, hash `6e62d6c734a84467`: candidates 16, 18; 1 repeats beyond first.
  - Repeated final-stage wall time 10.123s (16.82% of request); nested qualification records are not summed again.
- **production-gel-incumbent-round1.json**: 60.008s; 87 charged geometry work / 53 final evaluations; 12 repeat evaluations (13.79% of charged work; 22.64% of final evaluations).
  - seed 20261012, hash `36fedb74454d4828`: candidates 20, 22; 1 repeats beyond first.
  - seed 20261012, hash `e35a4adee5d9b9c6`: candidates 21, 23; 1 repeats beyond first.
  - seed 20261012, hash `3c89a497613a16c7`: candidates 25, 27; 1 repeats beyond first.
  - seed 20261012, hash `4282e0be09cff9a2`: candidates 26, 28, 29; 2 repeats beyond first.
  - seed 20261012, hash `4490704a0706b366`: candidates 34, 36, 37; 2 repeats beyond first.
  - seed 20261012, hash `f0b635dfc3977437`: candidates 41, 43; 1 repeats beyond first.
  - seed 20261012, hash `18075bb13e9898b9`: candidates 42, 44, 45, 47; 3 repeats beyond first.
  - seed 20261012, hash `da34f4b15113e9f1`: candidates 46, 48; 1 repeats beyond first.
  - Repeated final-stage wall time 13.175s (21.96% of request); nested qualification records are not summed again.

## Archive finding

No current-source repeated-descendant reset defect was found. Duplicate canonical is not inserted under the new candidate ID, so the exact current result cannot satisfy the retained-new-ID progress check. Repeated computations are real, bounded waste; they do not by themselves prove that the entire 60s deadline was spent on repeats.

Across recorded repeat rows, 0 are better than their selected base under the current max/sum ranking; 0 retain their new candidate ID. Historical source revisions differ and are not replayed.

The detailed JSON retains every repeated hash, candidate and base, per-attempt budget denominator, final base histories, and source fingerprints. Older reports without hashes or stage timings remain explicitly unknown.
