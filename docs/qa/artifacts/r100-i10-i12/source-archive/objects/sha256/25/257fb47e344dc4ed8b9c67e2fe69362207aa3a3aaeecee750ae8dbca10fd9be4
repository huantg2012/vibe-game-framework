// Generated from data/rift-world-conditions.csv; do not edit.
import type { WorldConditionProgram } from '../generation/world-study/world-conditions';

export const WORLD_CONDITIONS_SOURCE_HASH = '30b14f6d69d96a41afe6b1f42ccaf22aee43b0c6f4cb4df33f0506b33e32eb6d';
export const WORLD_CONDITION_PROGRAMS: readonly WorldConditionProgram[] = [
  {
    "id": "layered-deposition",
    "version": 1,
    "label": "层叠沉积",
    "rule": "deposition",
    "weight": 1,
    "enabled": true,
    "requiredCapabilities": [
      "surface:strata",
      "field:direction",
      "support:single-plane"
    ],
    "excludedCapabilities": [
      "collision:dynamic",
      "space:multilevel"
    ],
    "ranges": {
      "strength": [
        0.3,
        0.65
      ],
      "coherence": [
        0.45,
        0.82
      ],
      "scale": [
        0.9,
        1.55
      ],
      "minimumDeepDetourPx": [
        320,
        384
      ],
      "safeMaxThreat": [
        0.08,
        0.08
      ],
      "routeThreatPenalty": [
        6,
        6
      ],
      "sceneryRadiusPx": [
        72,
        108
      ],
      "sceneryDensity": [
        0.3,
        0.55
      ],
      "motionAmplitude": [
        0.5,
        1.1
      ],
      "motionPeriodSeconds": [
        9,
        13
      ]
    },
    "fallbackSeeds": [
      70421,
      175150,
      1000
    ]
  },
  {
    "id": "directional-fracture",
    "version": 1,
    "label": "定向断裂",
    "rule": "fracture",
    "weight": 1,
    "enabled": true,
    "requiredCapabilities": [
      "void:opaque",
      "field:direction",
      "support:single-plane"
    ],
    "excludedCapabilities": [
      "collision:dynamic",
      "space:multilevel"
    ],
    "ranges": {
      "strength": [
        0.3,
        0.62
      ],
      "coherence": [
        0.48,
        0.88
      ],
      "scale": [
        0.85,
        1.35
      ],
      "minimumDeepDetourPx": [
        384,
        448
      ],
      "safeMaxThreat": [
        0.08,
        0.08
      ],
      "routeThreatPenalty": [
        6,
        6
      ],
      "sceneryRadiusPx": [
        64,
        100
      ],
      "sceneryDensity": [
        0.22,
        0.45
      ],
      "motionAmplitude": [
        0.5,
        1
      ],
      "motionPeriodSeconds": [
        8,
        12
      ]
    },
    "fallbackSeeds": [
      175150,
      1000,
      70421
    ]
  },
  {
    "id": "coalescent-growth",
    "version": 1,
    "label": "聚簇覆盖",
    "rule": "aggregation",
    "weight": 1,
    "enabled": true,
    "requiredCapabilities": [
      "surface:strata|surface:crystal|surface:glaze",
      "organization:clusters",
      "support:single-plane"
    ],
    "excludedCapabilities": [
      "collision:dynamic",
      "space:multilevel"
    ],
    "ranges": {
      "strength": [
        0.35,
        0.7
      ],
      "coherence": [
        0.35,
        0.75
      ],
      "scale": [
        1.1,
        1.75
      ],
      "minimumDeepDetourPx": [
        320,
        448
      ],
      "safeMaxThreat": [
        0.08,
        0.08
      ],
      "routeThreatPenalty": [
        6,
        6
      ],
      "sceneryRadiusPx": [
        78,
        115
      ],
      "sceneryDensity": [
        0.38,
        0.65
      ],
      "motionAmplitude": [
        0.6,
        1.5
      ],
      "motionPeriodSeconds": [
        7,
        11
      ]
    },
    "fallbackSeeds": [
      1000,
      70421,
      175150
    ]
  }
];
