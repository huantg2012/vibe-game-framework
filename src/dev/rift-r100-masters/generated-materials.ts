// GENERATED from data/rift-master-materials.csv; edit the CSV, not this file.
export const PAINTED_MATERIALS_SOURCE_HASH = '5168963e24c0ff91a157441495e14df0303a6a9ee0f00e8b9888b13712bd849e';
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
    }
  }
] as const;
export type PaintedMaterialFamily = typeof PAINTED_MATERIALS[number]['family'];
