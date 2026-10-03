// GENERATED from data/rift-master-materials.csv; edit the CSV, not this file.
export const PAINTED_MATERIALS_SOURCE_HASH = 'f3ed064b3f614cc129af9fb10e24a04ea7cf451d144866d38a16a1b1e586adb7';
export const PAINTED_MATERIALS = [
  {
    "family": "folded-slab",
    "source": "/assets/r100-materials/ash-strata-source.png",
    "logical_pixels": 512,
    "world_size": 512,
    "regions": {
      "skin": {
        "x": 0.08,
        "y": 0.58,
        "width": 0.24,
        "height": 0.18
      },
      "cleaved": {
        "x": 0.38,
        "y": 0.36,
        "width": 0.28,
        "height": 0.18
      },
      "loose": {
        "x": 0.12,
        "y": 0.09,
        "width": 0.08,
        "height": 0.21
      }
    },
    "solid": {
      "source": "/assets/r100-materials/slab-solid-source.png",
      "logical_pixels": 512,
      "world_size": 512,
      "regions": {
        "skin": {
          "x": 0.025,
          "y": 0.025,
          "width": 0.6,
          "height": 0.95
        },
        "cleaved": {
          "x": 0.69,
          "y": 0.025,
          "width": 0.28,
          "height": 0.95
        },
        "loose": {
          "x": 0.69,
          "y": 0.025,
          "width": 0.28,
          "height": 0.95
        }
      },
      "skinRoughness": 0.43,
      "cutRoughness": 0.83,
      "gain": 1.03,
      "cutGain": 0.96
    }
  },
  {
    "family": "fibre-knot",
    "source": "/assets/r100-materials/crystal-fibre-source.png",
    "logical_pixels": 512,
    "world_size": 512,
    "regions": {
      "skin": {
        "x": 0.71,
        "y": 0.29,
        "width": 0.23,
        "height": 0.17
      },
      "cleaved": {
        "x": 0.31,
        "y": 0.27,
        "width": 0.26,
        "height": 0.14
      },
      "loose": {
        "x": 0.44,
        "y": 0.08,
        "width": 0.12,
        "height": 0.18
      }
    },
    "solid": {
      "source": "/assets/r100-materials/fibre-solid-source.png",
      "logical_pixels": 512,
      "world_size": 512,
      "regions": {
        "skin": {
          "x": 0.025,
          "y": 0.025,
          "width": 0.6,
          "height": 0.95
        },
        "cleaved": {
          "x": 0.69,
          "y": 0.025,
          "width": 0.28,
          "height": 0.95
        },
        "loose": {
          "x": 0.69,
          "y": 0.025,
          "width": 0.28,
          "height": 0.95
        }
      },
      "skinRoughness": 0.49,
      "cutRoughness": 0.87,
      "gain": 0.88,
      "cutGain": 1.05
    }
  },
  {
    "family": "broken-shell",
    "source": "/assets/r100-materials/ivory-basin-source.png",
    "logical_pixels": 512,
    "world_size": 512,
    "regions": {
      "skin": {
        "x": 0.54,
        "y": 0.22,
        "width": 0.2,
        "height": 0.21
      },
      "cleaved": {
        "x": 0.2,
        "y": 0.1,
        "width": 0.17,
        "height": 0.14
      },
      "loose": {
        "x": 0.19,
        "y": 0.45,
        "width": 0.19,
        "height": 0.19
      }
    },
    "solid": {
      "source": "/assets/r100-materials/shell-solid-source.png",
      "logical_pixels": 512,
      "world_size": 512,
      "regions": {
        "skin": {
          "x": 0.025,
          "y": 0.025,
          "width": 0.6,
          "height": 0.95
        },
        "cleaved": {
          "x": 0.69,
          "y": 0.025,
          "width": 0.28,
          "height": 0.95
        },
        "loose": {
          "x": 0.69,
          "y": 0.025,
          "width": 0.28,
          "height": 0.95
        }
      },
      "skinRoughness": 0.34,
      "cutRoughness": 0.9,
      "gain": 0.67,
      "cutGain": 1.15
    }
  }
] as const;
export type PaintedMaterialFamily = typeof PAINTED_MATERIALS[number]['family'];
