/** Generated from data/rift-native-spatial-*.csv. Do not edit. */
import type {NativeSpatialPolicy,NativeSpatialWorldIntent,NativeSpatialHoleProfile,NativeSpatialBayProfile,NativeSpatialAssembly,NativeSpatialSubordinateProfile} from '@/generation/world-study/native-spatial-types';
export const NATIVE_SPATIAL_POLICY:NativeSpatialPolicy={
  "algorithm": "native-joint-layout-v1",
  "version": 2,
  "enabled": true,
  "planningCellFactor": 0.866,
  "holeToSolidRatio": 2,
  "holeCountAbsTolerance": 1,
  "holeCountRelTolerance": 0.2,
  "minSolidCount": 1,
  "requireMoreHoles": true,
  "regionHoleShareMin": 0.64,
  "regionHoleShareMax": 0.7,
  "comparisonSpacingsPx": [
    288,
    352
  ],
  "spacingPx": 320,
  "countToleranceRatio": 0.2,
  "areaToleranceRatio": 0.1,
  "maxEmptyRadiusPx": 160,
  "deepEmptyThresholdPx": 112,
  "maxDeepEmptySpanPx": 448,
  "minHoleCoreRadiusPx": 32,
  "minSolidAreaPx2": 1600,
  "minSolidSpanPx": 80,
  "probeStepPx": 32,
  "referenceSightPx": 224,
  "revealRouteMinPx": 80,
  "revealRouteMaxPx": 240,
  "maxCoverRoutePx": 320,
  "wideRadiusPx": 48,
  "minWideRatio": 0.55,
  "minLargestWideRatio": 0.8,
  "narrowWidthPx": 160,
  "maxNarrowRatio": 0.2,
  "maxNarrowRunPx": 224,
  "encounterRadiusPx": 112,
  "minRouteLengthPx": 224,
  "minRouteEncounters": 6,
  "minRouteHoleShare": 0.6,
  "maxRouteHoleShare": 0.75,
  "windowSize": 6,
  "minWindowHoles": 3,
  "maxGeometryEvaluations": 72,
  "maxFullCandidates": 2,
  "sourceHash": "eb9bb3c189409643d6f1056ab4cc14935717e31c4117b26cf8cdf7fc6ea9285b"
};
export const NATIVE_SPATIAL_WORLDS:readonly NativeSpatialWorldIntent[]=[
  {
    "worldId": "split-rib-causeway",
    "enabled": true,
    "annotationStatus": "reviewed",
    "targetWalkAreaPx2": 1575616,
    "frameWidthPx": 2304,
    "frameHeightPx": 1792,
    "materialAxisRad": 0.42,
    "landGrammar": "offset-overlap-v1",
    "landRectMinCount": 4,
    "landRectMaxCount": 7,
    "landRectMinSpanPx": 800,
    "landRectMaxSpanPx": 1440,
    "landRectMinThicknessPx": 544,
    "landRectMaxThicknessPx": 960,
    "landRectMinOverlapPx": 320,
    "bayGrammar": "shore-rect-cut-v1",
    "bayProfileIds": [
      "shore-bay-default"
    ],
    "bayCountOptions": [
      0,
      1,
      2
    ],
    "landCoreMinCount": 3,
    "landCoreMaxCount": 5,
    "landShoulderMinCount": 1,
    "landShoulderMaxCount": 2,
    "landShoulderMinSpanPx": 576,
    "landShoulderMaxSpanPx": 768,
    "landShoulderMinThicknessPx": 384,
    "landShoulderMaxThicknessPx": 448,
    "landShoulderMinExtensionPx": 192,
    "landShoulderMaxExtensionPx": 320,
    "landShoulderAttachment": "core-outward-normal-v1"
  },
  {
    "worldId": "gel-rafts",
    "enabled": true,
    "annotationStatus": "reviewed",
    "targetWalkAreaPx2": 1241088,
    "frameWidthPx": 2304,
    "frameHeightPx": 1792,
    "materialAxisRad": 0.1,
    "landGrammar": "offset-overlap-v1",
    "landRectMinCount": 4,
    "landRectMaxCount": 7,
    "landRectMinSpanPx": 720,
    "landRectMaxSpanPx": 1328,
    "landRectMinThicknessPx": 512,
    "landRectMaxThicknessPx": 896,
    "landRectMinOverlapPx": 320,
    "bayGrammar": "shore-rect-cut-v1",
    "bayProfileIds": [
      "shore-bay-default"
    ],
    "bayCountOptions": [
      0,
      1,
      2
    ],
    "landCoreMinCount": 3,
    "landCoreMaxCount": 5,
    "landShoulderMinCount": 1,
    "landShoulderMaxCount": 2,
    "landShoulderMinSpanPx": 576,
    "landShoulderMaxSpanPx": 768,
    "landShoulderMinThicknessPx": 384,
    "landShoulderMaxThicknessPx": 448,
    "landShoulderMinExtensionPx": 192,
    "landShoulderMaxExtensionPx": 320,
    "landShoulderAttachment": "core-outward-normal-v1"
  },
  {
    "worldId": "sloughed-court",
    "enabled": true,
    "annotationStatus": "reviewed",
    "targetWalkAreaPx2": 1310016,
    "frameWidthPx": 2304,
    "frameHeightPx": 1792,
    "materialAxisRad": 0.1,
    "landGrammar": "offset-overlap-v1",
    "landRectMinCount": 4,
    "landRectMaxCount": 7,
    "landRectMinSpanPx": 752,
    "landRectMaxSpanPx": 1360,
    "landRectMinThicknessPx": 512,
    "landRectMaxThicknessPx": 928,
    "landRectMinOverlapPx": 320,
    "bayGrammar": "shore-rect-cut-v1",
    "bayProfileIds": [
      "shore-bay-default"
    ],
    "bayCountOptions": [
      0,
      1,
      2
    ],
    "landCoreMinCount": 3,
    "landCoreMaxCount": 5,
    "landShoulderMinCount": 1,
    "landShoulderMaxCount": 2,
    "landShoulderMinSpanPx": 576,
    "landShoulderMaxSpanPx": 768,
    "landShoulderMinThicknessPx": 384,
    "landShoulderMaxThicknessPx": 448,
    "landShoulderMinExtensionPx": 192,
    "landShoulderMaxExtensionPx": 320,
    "landShoulderAttachment": "core-outward-normal-v1"
  },
  {
    "worldId": "ash-strata",
    "enabled": true,
    "annotationStatus": "reviewed",
    "targetWalkAreaPx2": 1324992,
    "frameWidthPx": 2304,
    "frameHeightPx": 1792,
    "materialAxisRad": -0.22,
    "landGrammar": "offset-overlap-v1",
    "landRectMinCount": 4,
    "landRectMaxCount": 7,
    "landRectMinSpanPx": 752,
    "landRectMaxSpanPx": 1360,
    "landRectMinThicknessPx": 512,
    "landRectMaxThicknessPx": 928,
    "landRectMinOverlapPx": 320,
    "bayGrammar": "shore-rect-cut-v1",
    "bayProfileIds": [
      "shore-bay-default"
    ],
    "bayCountOptions": [
      0,
      1,
      2
    ],
    "landCoreMinCount": 3,
    "landCoreMaxCount": 5,
    "landShoulderMinCount": 1,
    "landShoulderMaxCount": 2,
    "landShoulderMinSpanPx": 576,
    "landShoulderMaxSpanPx": 768,
    "landShoulderMinThicknessPx": 384,
    "landShoulderMaxThicknessPx": 448,
    "landShoulderMinExtensionPx": 192,
    "landShoulderMaxExtensionPx": 320,
    "landShoulderAttachment": "core-outward-normal-v1"
  },
  {
    "worldId": "black-lacuna",
    "enabled": true,
    "annotationStatus": "reviewed",
    "targetWalkAreaPx2": 1630848,
    "frameWidthPx": 2304,
    "frameHeightPx": 1792,
    "materialAxisRad": 0.1,
    "landGrammar": "offset-overlap-v1",
    "landRectMinCount": 4,
    "landRectMaxCount": 7,
    "landRectMinSpanPx": 832,
    "landRectMaxSpanPx": 1472,
    "landRectMinThicknessPx": 576,
    "landRectMaxThicknessPx": 992,
    "landRectMinOverlapPx": 320,
    "bayGrammar": "shore-rect-cut-v1",
    "bayProfileIds": [
      "shore-bay-default"
    ],
    "bayCountOptions": [
      0,
      1,
      2
    ],
    "landCoreMinCount": 3,
    "landCoreMaxCount": 5,
    "landShoulderMinCount": 1,
    "landShoulderMaxCount": 2,
    "landShoulderMinSpanPx": 576,
    "landShoulderMaxSpanPx": 768,
    "landShoulderMinThicknessPx": 384,
    "landShoulderMaxThicknessPx": 448,
    "landShoulderMinExtensionPx": 192,
    "landShoulderMaxExtensionPx": 320,
    "landShoulderAttachment": "core-outward-normal-v1"
  }
];
export const NATIVE_SPATIAL_HOLE_PROFILES:readonly NativeSpatialHoleProfile[]=[
  {
    "id": "offset-cut-small",
    "sizeClass": "small",
    "weight": 35,
    "minSpanPx": 112,
    "maxSpanPx": 144,
    "minThicknessPx": 80,
    "maxThicknessPx": 104,
    "minRectCount": 2,
    "maxRectCount": 3,
    "minOverlapRatio": 0.3,
    "maxOverlapRatio": 0.65,
    "minOffsetRatio": 0.18,
    "maxOffsetRatio": 0.5,
    "maxAreaPx2": 14000
  },
  {
    "id": "offset-cut-medium",
    "sizeClass": "medium",
    "weight": 50,
    "minSpanPx": 152,
    "maxSpanPx": 192,
    "minThicknessPx": 88,
    "maxThicknessPx": 120,
    "minRectCount": 2,
    "maxRectCount": 3,
    "minOverlapRatio": 0.3,
    "maxOverlapRatio": 0.65,
    "minOffsetRatio": 0.18,
    "maxOffsetRatio": 0.5,
    "maxAreaPx2": 22000
  },
  {
    "id": "offset-cut-large",
    "sizeClass": "large",
    "weight": 15,
    "minSpanPx": 200,
    "maxSpanPx": 240,
    "minThicknessPx": 96,
    "maxThicknessPx": 136,
    "minRectCount": 3,
    "maxRectCount": 4,
    "minOverlapRatio": 0.3,
    "maxOverlapRatio": 0.65,
    "minOffsetRatio": 0.18,
    "maxOffsetRatio": 0.5,
    "maxAreaPx2": 30000
  }
];
export const NATIVE_SPATIAL_BAY_PROFILES:readonly NativeSpatialBayProfile[]=[
  {
    "id": "shore-bay-default",
    "minRectCount": 1,
    "maxRectCount": 3,
    "minDepthPx": 128,
    "maxDepthPx": 480,
    "minMouthPx": 96,
    "maxMouthPx": 192,
    "minOffsetRatio": 0.15,
    "maxOffsetRatio": 0.45,
    "minOverlapRatio": 0.35,
    "maxOverlapRatio": 0.8,
    "maxUnionSpanPx": 576,
    "minRemovedLandAreaPx2": 8192,
    "maxRemovedLandAreaPx2": 61440,
    "minFinalThroatPx": 64,
    "minBacklandPx": 320
  }
];
export const NATIVE_SPATIAL_ASSEMBLIES:readonly NativeSpatialAssembly[]=[
  {
    "worldId": "split-rib-causeway",
    "grade": "all",
    "id": "split-rib-paired-vault",
    "sourceInstanceIds": [
      1,
      2
    ],
    "attachedReliefIds": [],
    "sourceScale": 1.16,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 1120,
    "mode": "unique-once"
  },
  {
    "worldId": "gel-rafts",
    "grade": "all",
    "id": "gel-rafts-upper-clamp",
    "sourceInstanceIds": [
      3
    ],
    "attachedReliefIds": [
      1,
      2
    ],
    "sourceScale": 1.25,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 288,
    "mode": "unique-once"
  },
  {
    "worldId": "gel-rafts",
    "grade": "all",
    "id": "gel-rafts-lower-clamp",
    "sourceInstanceIds": [
      6
    ],
    "attachedReliefIds": [
      4,
      5
    ],
    "sourceScale": 1.25,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 256,
    "mode": "unique-once"
  },
  {
    "worldId": "sloughed-court",
    "grade": "all",
    "id": "sloughed-court-standing-fold",
    "sourceInstanceIds": [
      3
    ],
    "attachedReliefIds": [
      1,
      2
    ],
    "sourceScale": 1.32,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 432,
    "mode": "unique-once"
  },
  {
    "worldId": "ash-strata",
    "grade": "low",
    "id": "ash-low-fold",
    "sourceInstanceIds": [
      2
    ],
    "attachedReliefIds": [
      1
    ],
    "sourceScale": 1.25,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 304,
    "mode": "unique-once"
  },
  {
    "worldId": "ash-strata",
    "grade": "medium",
    "id": "ash-medium-fold",
    "sourceInstanceIds": [
      1
    ],
    "attachedReliefIds": [
      2,
      3
    ],
    "sourceScale": 1.25,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 560,
    "mode": "unique-once"
  },
  {
    "worldId": "ash-strata",
    "grade": "severe",
    "id": "ash-severe-paired-fold",
    "sourceInstanceIds": [
      1,
      2
    ],
    "attachedReliefIds": [
      3
    ],
    "sourceScale": 1.25,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 1024,
    "mode": "unique-once"
  },
  {
    "worldId": "black-lacuna",
    "grade": "all",
    "id": "black-lacuna-standing-bank",
    "sourceInstanceIds": [
      2
    ],
    "attachedReliefIds": [
      1,
      3,
      4
    ],
    "sourceScale": 1.29,
    "minScale": 0.95,
    "maxScale": 1.05,
    "rotationOffsetsRad": [
      -0.18,
      0,
      0.18,
      3.14159265359
    ],
    "maxSpanPx": 432,
    "mode": "unique-once"
  }
];
export const NATIVE_SPATIAL_SUBORDINATE_PROFILES:readonly NativeSpatialSubordinateProfile[]=[
  {
    "id": "native-slab-curled-ledge",
    "family": "folded-slab",
    "constructionVersion": 4,
    "shapeProfile": "clamp-bank",
    "minLengthPx": 112,
    "maxLengthPx": 184,
    "minWidthPx": 64,
    "maxWidthPx": 104,
    "minHeightPx": 26,
    "maxHeightPx": 40,
    "thicknessPx": 8,
    "fold": 0.36,
    "branches": 2,
    "opening": 0.82,
    "distortion": 0.46,
    "rotationOffsetRad": -0.18
  },
  {
    "id": "native-slab-broken-shoulder",
    "family": "folded-slab",
    "constructionVersion": 4,
    "shapeProfile": "fracture-fan",
    "minLengthPx": 144,
    "maxLengthPx": 216,
    "minWidthPx": 72,
    "maxWidthPx": 120,
    "minHeightPx": 20,
    "maxHeightPx": 32,
    "thicknessPx": 7,
    "fold": 0.28,
    "branches": 2,
    "opening": 0.72,
    "distortion": 0.54,
    "rotationOffsetRad": 0.24
  },
  {
    "id": "native-fibre-fallen-end",
    "family": "fibre-knot",
    "constructionVersion": 4,
    "shapeProfile": "fallen-bundle",
    "minLengthPx": 136,
    "maxLengthPx": 208,
    "minWidthPx": 52,
    "maxWidthPx": 84,
    "minHeightPx": 22,
    "maxHeightPx": 36,
    "thicknessPx": 7,
    "fold": 0.42,
    "branches": 3,
    "opening": 0.74,
    "distortion": 0.62,
    "rotationOffsetRad": 0.14
  },
  {
    "id": "native-fibre-pressed-knot",
    "family": "fibre-knot",
    "constructionVersion": 4,
    "shapeProfile": "compressed-wedge",
    "minLengthPx": 104,
    "maxLengthPx": 160,
    "minWidthPx": 72,
    "maxWidthPx": 108,
    "minHeightPx": 28,
    "maxHeightPx": 44,
    "thicknessPx": 9,
    "fold": 0.58,
    "branches": 2,
    "opening": 0.62,
    "distortion": 0.52,
    "rotationOffsetRad": -0.32
  },
  {
    "id": "native-membrane-curled-remnant",
    "family": "membrane-rim",
    "constructionVersion": 4,
    "shapeProfile": "clamp-bank",
    "minLengthPx": 160,
    "maxLengthPx": 220,
    "minWidthPx": 56,
    "maxWidthPx": 88,
    "minHeightPx": 24,
    "maxHeightPx": 38,
    "thicknessPx": 5,
    "fold": 0.52,
    "branches": 2,
    "opening": 0.76,
    "distortion": 0.58,
    "rotationOffsetRad": 0.18
  },
  {
    "id": "native-gel-peeled-front",
    "family": "gel-flow",
    "constructionVersion": 4,
    "shapeProfile": "torn-sheet",
    "minLengthPx": 144,
    "maxLengthPx": 216,
    "minWidthPx": 96,
    "maxWidthPx": 128,
    "minHeightPx": 28,
    "maxHeightPx": 42,
    "thicknessPx": 7,
    "fold": 0.62,
    "branches": 3,
    "opening": 0.82,
    "distortion": 0.66,
    "rotationOffsetRad": 0.12
  }
];
