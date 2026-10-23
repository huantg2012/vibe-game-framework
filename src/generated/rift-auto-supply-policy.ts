// GENERATED from data/rift-auto-supply-policy.csv; edit CSV, not this file.
export const AUTOMATIC_SUPPLY_POLICIES = [
  {
    "version": 1,
    "algorithm": "body-geodesic-cover-v1",
    "sourceHash": "a56cd7155359ea04f084744973bf7178dce317238fb62bf01ceac7a2e6eba659",
    "grade": "low",
    "bodyAreaPerNodePx2": 100000,
    "routePerNodePx": 320,
    "maxCoveragePx": 480,
    "p95CoveragePx": 320,
    "maxNodes": 32,
    "earlyFuelNodes": 2,
    "maxBodyCells": 131072,
    "maxWorkEdges": 64000000,
    "contestedApproachMinPx": 480,
    "deepApproachMinPx": 960
  },
  {
    "version": 1,
    "algorithm": "body-geodesic-cover-v1",
    "sourceHash": "a56cd7155359ea04f084744973bf7178dce317238fb62bf01ceac7a2e6eba659",
    "grade": "medium",
    "bodyAreaPerNodePx2": 140000,
    "routePerNodePx": 400,
    "maxCoveragePx": 640,
    "p95CoveragePx": 448,
    "maxNodes": 32,
    "earlyFuelNodes": 1,
    "maxBodyCells": 131072,
    "maxWorkEdges": 64000000,
    "contestedApproachMinPx": 480,
    "deepApproachMinPx": 960
  },
  {
    "version": 1,
    "algorithm": "body-geodesic-cover-v1",
    "sourceHash": "a56cd7155359ea04f084744973bf7178dce317238fb62bf01ceac7a2e6eba659",
    "grade": "severe",
    "bodyAreaPerNodePx2": 180000,
    "routePerNodePx": 480,
    "maxCoveragePx": 768,
    "p95CoveragePx": 512,
    "maxNodes": 32,
    "earlyFuelNodes": 1,
    "maxBodyCells": 131072,
    "maxWorkEdges": 64000000,
    "contestedApproachMinPx": 480,
    "deepApproachMinPx": 960
  }
] as const;
