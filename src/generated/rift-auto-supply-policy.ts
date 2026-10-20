// GENERATED from data/rift-auto-supply-policy.csv; edit CSV, not this file.
export const AUTOMATIC_SUPPLY_POLICIES = [
  {
    "version": 1,
    "algorithm": "body-geodesic-cover-v1",
    "sourceHash": "85249c6592ebded6558bfe4ffb4af1503bf351d5e5d2446d64f505c212977213",
    "grade": "low",
    "bodyAreaPerNodePx2": 100000,
    "routePerNodePx": 320,
    "maxCoveragePx": 480,
    "p95CoveragePx": 320,
    "maxNodes": 32,
    "earlyFuelNodes": 2,
    "maxBodyCells": 131072,
    "maxWorkEdges": 64000000
  },
  {
    "version": 1,
    "algorithm": "body-geodesic-cover-v1",
    "sourceHash": "85249c6592ebded6558bfe4ffb4af1503bf351d5e5d2446d64f505c212977213",
    "grade": "medium",
    "bodyAreaPerNodePx2": 140000,
    "routePerNodePx": 400,
    "maxCoveragePx": 640,
    "p95CoveragePx": 448,
    "maxNodes": 32,
    "earlyFuelNodes": 1,
    "maxBodyCells": 131072,
    "maxWorkEdges": 64000000
  },
  {
    "version": 1,
    "algorithm": "body-geodesic-cover-v1",
    "sourceHash": "85249c6592ebded6558bfe4ffb4af1503bf351d5e5d2446d64f505c212977213",
    "grade": "severe",
    "bodyAreaPerNodePx2": 180000,
    "routePerNodePx": 480,
    "maxCoveragePx": 768,
    "p95CoveragePx": 512,
    "maxNodes": 32,
    "earlyFuelNodes": 1,
    "maxBodyCells": 131072,
    "maxWorkEdges": 64000000
  }
] as const;
