// IMMUTABLE R100 native generation through revision 2. Source: a089bf787b80349533e850485419e3c157b879f4.
// Reproduce with tools/recovery/freeze-native-r100-revision2.mjs; do not regenerate from current sources.
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

// src/utils/random.ts
var SeededRandom = class {
  constructor(seed) {
    __publicField(this, "state");
    this.state = seed;
  }
  /**
   * Get next random float in [0, 1).
   */
  next() {
    this.state |= 0;
    this.state = this.state + 1831565813 | 0;
    let t = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /**
   * Standard normal N(0, 1) via Box-Muller. Consumes two next() samples.
   */
  nextGaussian() {
    const u1 = Math.max(1e-12, this.next());
    const u2 = this.next();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(Math.PI * 2 * u2);
  }
  /**
   * Get random integer in [min, max] (inclusive).
   */
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  /**
   * Get random float in [min, max).
   */
  nextFloat(min, max) {
    return this.next() * (max - min) + min;
  }
  /**
   * Pick a random element from an array.
   */
  pick(array) {
    return array[Math.floor(this.next() * array.length)];
  }
  /**
   * Shuffle an array in place (Fisher-Yates).
   */
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
};

// src/generation/seed-fork.ts
function mix32(seed, label) {
  let h = seed >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = Math.imul(h ^ label.charCodeAt(i), 2654435769);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 2146121005);
  h ^= h >>> 15;
  return h >>> 0;
}

// src/generated/r100-package-manifest.ts
var R100_MATERIAL_DEPENDENCIES = {
  "folded-slab": {
    "definition": "cff866a51ffb73b54f28f80b01bd1d4cf2d18d91cf7da55908d520c34614e781",
    "surface": "88bda7c04ecd21f8954fa7076dc73ce332ff0bb8935d39752b9923778fe01f4a",
    "solid": "4b2082c1be77d27f0ba57aef104204e3c10bb59c88078df8f741b9bd6ce38454"
  },
  "fibre-knot": {
    "definition": "07c4626ba229e38d6cb11f6000b93bd0cea55899fc28c0781bb1f005bcf67634",
    "surface": "b94630043fdc4418673337daa5eb3121dc5238b62b94f5b0fb2ef8fc461df002",
    "solid": "015e854e49a0b48f5554f725341564817a0a267ad0c6b84708925a7231306089"
  },
  "broken-shell": {
    "definition": "b8e69dc639ee9d3254ea4e31d2985a9fe72d9222b546981738083bf0fa456835",
    "surface": "0f3a10c683852461fc38543f508953ed058799dc7922c87c98bfb705f0b62f8d",
    "solid": "784e95d608ea573f99bd99ff8f345e601504d3ebd24b18918dc78179cf4a4220"
  },
  "granular-ridge": {
    "definition": "dadfc46797b6df7d4868b89fb6ca6a759b880598b2ee698d97db40d33c6b8030",
    "surface": "7261eb6dc1eecc662ba9f3b4c907752e3324de5319adc72a6306be737535222b",
    "solid": "4217d2d52cb80e412cc704c494c27db37439e5ca5aba279353fd50da3eecee5d"
  },
  "membrane-rim": {
    "definition": "0d780b412e533356e5cff9eadd1b7a35a7709aabc070833b37ede3ec3024db5b",
    "surface": "9faf60060f8b9e6a41bc89c8fc1a8c393ff3b821a7a822735d063f5f2ff732cf",
    "solid": "3d11b9161c969fd35cb77a8d77b161b98105122b00b772b58ebb43ee61921d23"
  },
  "gel-flow": {
    "definition": "0ce794cb484749b4d4ba54007c2de6e4f01089fccb2ef7d420b06c105dd40dc9",
    "surface": "7bbcfaa18563ef08395152454a7007eb71a573b0d83171e959dfa6b58ec805bd",
    "solid": "c4b7797bd83d18746d027b9cd4e556f77109fcbfa9dacacd2bb7b30083444612"
  }
};

// src/generated/r100-native-worlds.ts
var R100_NATIVE_WORLDS = [
  {
    "id": "ash-strata",
    "label": "\u65E0\u5F69\u5C42\u539F",
    "iteration": 3,
    "enabled": true,
    "profile": {
      "id": "ash-strata",
      "label": "\u65E0\u5F69\u5C42\u539F",
      "description": "\u6C89\u79EF\u5C42\u7247\u4E0E\u5931\u8272\u65AD\u9762",
      "material": "strata",
      "surface": {
        "substrate": "strata",
        "coating": "strata",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    "definitions": [
      {
        "id": "folded-slab-low",
        "family": "folded-slab",
        "grade": "low",
        "label": "\u9006\u6298\xB7\u521D\u5165",
        "profile": "ash-strata",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 548,
        "search_y": 424,
        "enemy_x": 708,
        "enemy_y": 180,
        "axis": -0.22,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 19,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "relief",
            "x": 448,
            "y": 276,
            "rotation": -0.22,
            "length": 286,
            "width": 120,
            "height": 6,
            "thickness": 2,
            "fold": 0.46,
            "branches": 3,
            "opening": 0.22,
            "distortion": 0.16
          },
          {
            "id": 2,
            "role": "solid",
            "x": 618,
            "y": 281,
            "rotation": 0.31,
            "length": 188,
            "width": 88,
            "height": 24,
            "thickness": 9,
            "fold": 0.34,
            "branches": 3,
            "opening": 0.25,
            "distortion": 0.12
          }
        ],
        "erosion": [
          [
            {
              "x": 620,
              "y": 352
            },
            {
              "x": 656,
              "y": 344
            },
            {
              "x": 704,
              "y": 368
            },
            {
              "x": 696,
              "y": 392
            },
            {
              "x": 644,
              "y": 382
            }
          ]
        ]
      },
      {
        "id": "folded-slab-medium",
        "family": "folded-slab",
        "grade": "medium",
        "label": "\u9006\u6298\xB7\u7A7F\u5C42",
        "profile": "ash-strata",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 570,
        "search_y": 440,
        "enemy_x": 716,
        "enemy_y": 180,
        "axis": -0.22,
        "light_radius": 132,
        "emission": 0.55,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "solid",
            "x": 448,
            "y": 276,
            "rotation": -0.22,
            "length": 350,
            "width": 146,
            "height": 126,
            "thickness": 14,
            "fold": 0.66,
            "branches": 4,
            "opening": 0.18,
            "distortion": 0.28
          },
          {
            "id": 2,
            "role": "relief",
            "x": 633,
            "y": 294,
            "rotation": 0.67,
            "length": 238,
            "width": 100,
            "height": 6,
            "thickness": 2,
            "fold": 0.55,
            "branches": 3,
            "opening": 0.18,
            "distortion": 0.22
          },
          {
            "id": 3,
            "role": "relief",
            "x": 442,
            "y": 156,
            "rotation": 2.79,
            "length": 252,
            "width": 94,
            "height": 6,
            "thickness": 2,
            "fold": 0.47,
            "branches": 3,
            "opening": 0.18,
            "distortion": 0.22
          }
        ],
        "erosion": [
          [
            {
              "x": 584,
              "y": 352
            },
            {
              "x": 648,
              "y": 328
            },
            {
              "x": 728,
              "y": 352
            },
            {
              "x": 756,
              "y": 392
            },
            {
              "x": 716,
              "y": 416
            },
            {
              "x": 652,
              "y": 388
            },
            {
              "x": 608,
              "y": 392
            }
          ],
          [
            {
              "x": 168,
              "y": 128
            },
            {
              "x": 240,
              "y": 104
            },
            {
              "x": 284,
              "y": 128
            },
            {
              "x": 268,
              "y": 160
            },
            {
              "x": 200,
              "y": 168
            }
          ]
        ]
      },
      {
        "id": "folded-slab-severe",
        "family": "folded-slab",
        "grade": "severe",
        "label": "\u9006\u6298\xB7\u627F\u538B",
        "profile": "ash-strata",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 622,
        "search_y": 454,
        "enemy_x": 756,
        "enemy_y": 168,
        "axis": -0.22,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 14,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "solid",
            "x": 448,
            "y": 243,
            "rotation": -0.22,
            "length": 528,
            "width": 186,
            "height": 194,
            "thickness": 18,
            "fold": 0.9,
            "branches": 6,
            "opening": 0.15,
            "distortion": 0.4
          },
          {
            "id": 2,
            "role": "solid",
            "x": 674,
            "y": 304,
            "rotation": 0.81,
            "length": 280,
            "width": 114,
            "height": 138,
            "thickness": 15,
            "fold": 0.79,
            "branches": 4,
            "opening": 0.14,
            "distortion": 0.35
          },
          {
            "id": 3,
            "role": "relief",
            "x": 418,
            "y": 130,
            "rotation": 2.95,
            "length": 338,
            "width": 124,
            "height": 6,
            "thickness": 2,
            "fold": 0.74,
            "branches": 4,
            "opening": 0.12,
            "distortion": 0.33
          }
        ],
        "erosion": [
          [
            {
              "x": 584,
              "y": 352
            },
            {
              "x": 664,
              "y": 320
            },
            {
              "x": 776,
              "y": 352
            },
            {
              "x": 816,
              "y": 408
            },
            {
              "x": 752,
              "y": 448
            },
            {
              "x": 664,
              "y": 408
            },
            {
              "x": 616,
              "y": 432
            },
            {
              "x": 568,
              "y": 400
            }
          ],
          [
            {
              "x": 128,
              "y": 104
            },
            {
              "x": 208,
              "y": 80
            },
            {
              "x": 296,
              "y": 112
            },
            {
              "x": 304,
              "y": 152
            },
            {
              "x": 240,
              "y": 176
            },
            {
              "x": 176,
              "y": 160
            },
            {
              "x": 112,
              "y": 144
            }
          ],
          [
            {
              "x": 336,
              "y": 488
            },
            {
              "x": 408,
              "y": 472
            },
            {
              "x": 480,
              "y": 504
            },
            {
              "x": 472,
              "y": 540
            },
            {
              "x": 400,
              "y": 548
            },
            {
              "x": 344,
              "y": 520
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "crystal-fibre",
    "label": "\u6676\u5316\u6797\u5E8A",
    "iteration": 3,
    "enabled": true,
    "profile": {
      "id": "crystal-fibre",
      "label": "\u6676\u5316\u6797\u5E8A",
      "description": "\u7EA4\u7EF4\u5E8A\u6CBF\u7EDF\u4E00\u65B9\u5411\u6676\u5316",
      "material": "crystal",
      "surface": {
        "substrate": "strata",
        "coating": "crystal",
        "organization": "clusters",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    "definitions": [
      {
        "id": "fibre-knot-low",
        "family": "fibre-knot",
        "grade": "low",
        "label": "\u7EA4\u7EF4\xB7\u672A\u7ED3",
        "profile": "crystal-fibre",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 538,
        "search_y": 420,
        "enemy_x": 712,
        "enemy_y": 180,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 22,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "relief",
            "x": 471,
            "y": 270,
            "rotation": -0.28,
            "length": 310,
            "width": 100,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 3,
            "opening": 0.3,
            "distortion": 0.18
          },
          {
            "id": 2,
            "role": "solid",
            "x": 641,
            "y": 310,
            "rotation": 0.52,
            "length": 182,
            "width": 70,
            "height": 43,
            "thickness": 7,
            "fold": 0.28,
            "branches": 2,
            "opening": 0.36,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 620,
              "y": 352
            },
            {
              "x": 656,
              "y": 344
            },
            {
              "x": 704,
              "y": 368
            },
            {
              "x": 696,
              "y": 392
            },
            {
              "x": 644,
              "y": 382
            }
          ]
        ]
      },
      {
        "id": "fibre-knot-medium",
        "family": "fibre-knot",
        "grade": "medium",
        "label": "\u7EA4\u7EF4\xB7\u5F3A\u8D2F",
        "profile": "crystal-fibre",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 594,
        "search_y": 442,
        "enemy_x": 720,
        "enemy_y": 176,
        "axis": -0.28,
        "light_radius": 136,
        "emission": 0.55,
        "motion_period": 18,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "solid",
            "x": 471,
            "y": 270,
            "rotation": -0.28,
            "length": 370,
            "width": 136,
            "height": 116,
            "thickness": 9,
            "fold": 0.59,
            "branches": 4,
            "opening": 0.25,
            "distortion": 0.35
          },
          {
            "id": 2,
            "role": "relief",
            "x": 636,
            "y": 287,
            "rotation": 0.77,
            "length": 263,
            "width": 92,
            "height": 6,
            "thickness": 2,
            "fold": 0.52,
            "branches": 3,
            "opening": 0.24,
            "distortion": 0.25
          },
          {
            "id": 3,
            "role": "relief",
            "x": 430,
            "y": 155,
            "rotation": 2.88,
            "length": 228,
            "width": 78,
            "height": 6,
            "thickness": 2,
            "fold": 0.46,
            "branches": 3,
            "opening": 0.25,
            "distortion": 0.24
          }
        ],
        "erosion": [
          [
            {
              "x": 584,
              "y": 352
            },
            {
              "x": 648,
              "y": 328
            },
            {
              "x": 728,
              "y": 352
            },
            {
              "x": 756,
              "y": 392
            },
            {
              "x": 716,
              "y": 416
            },
            {
              "x": 652,
              "y": 388
            },
            {
              "x": 608,
              "y": 392
            }
          ],
          [
            {
              "x": 168,
              "y": 128
            },
            {
              "x": 240,
              "y": 104
            },
            {
              "x": 284,
              "y": 128
            },
            {
              "x": 268,
              "y": 160
            },
            {
              "x": 200,
              "y": 168
            }
          ]
        ]
      },
      {
        "id": "fibre-knot-severe",
        "family": "fibre-knot",
        "grade": "severe",
        "label": "\u7EA4\u7EF4\xB7\u7EDE\u7D27",
        "profile": "crystal-fibre",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 610,
        "search_y": 452,
        "enemy_x": 756,
        "enemy_y": 170,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "solid",
            "x": 471,
            "y": 251,
            "rotation": -0.28,
            "length": 538,
            "width": 184,
            "height": 172,
            "thickness": 12,
            "fold": 0.85,
            "branches": 6,
            "opening": 0.18,
            "distortion": 0.47
          },
          {
            "id": 2,
            "role": "solid",
            "x": 677,
            "y": 298,
            "rotation": 0.89,
            "length": 299,
            "width": 110,
            "height": 132,
            "thickness": 10,
            "fold": 0.72,
            "branches": 4,
            "opening": 0.18,
            "distortion": 0.38
          },
          {
            "id": 3,
            "role": "relief",
            "x": 417,
            "y": 136,
            "rotation": 2.98,
            "length": 329,
            "width": 112,
            "height": 6,
            "thickness": 2,
            "fold": 0.7,
            "branches": 4,
            "opening": 0.17,
            "distortion": 0.36
          }
        ],
        "erosion": [
          [
            {
              "x": 584,
              "y": 352
            },
            {
              "x": 664,
              "y": 320
            },
            {
              "x": 776,
              "y": 352
            },
            {
              "x": 816,
              "y": 408
            },
            {
              "x": 752,
              "y": 448
            },
            {
              "x": 664,
              "y": 408
            },
            {
              "x": 616,
              "y": 432
            },
            {
              "x": 568,
              "y": 400
            }
          ],
          [
            {
              "x": 128,
              "y": 104
            },
            {
              "x": 208,
              "y": 80
            },
            {
              "x": 296,
              "y": 112
            },
            {
              "x": 304,
              "y": 152
            },
            {
              "x": 240,
              "y": 176
            },
            {
              "x": 176,
              "y": 160
            },
            {
              "x": 112,
              "y": 144
            }
          ],
          [
            {
              "x": 336,
              "y": 488
            },
            {
              "x": 408,
              "y": 472
            },
            {
              "x": 480,
              "y": 504
            },
            {
              "x": 472,
              "y": 540
            },
            {
              "x": 400,
              "y": 548
            },
            {
              "x": 344,
              "y": 520
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "ivory-basin",
    "label": "\u5438\u5149\u91C9\u539F",
    "iteration": 3,
    "enabled": true,
    "profile": {
      "id": "ivory-basin",
      "label": "\u5438\u5149\u91C9\u539F",
      "description": "\u539A\u91C9\u6C89\u79EF\u4E0E\u5438\u5149\u7ED3\u8282",
      "material": "glaze",
      "surface": {
        "substrate": "strata",
        "coating": "glaze",
        "organization": "patches",
        "coverage": 0.54,
        "wear": 0.57,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.72,
        "regionScale": 1.4,
        "quietness": 0.55,
        "formScale": 1.6,
        "fragmentation": 0.42,
        "accentCoverage": 0.11
      },
      "palette": {
        "void": 1448997,
        "shadow": 2699322,
        "floorDeep": 7367527,
        "floor": 11182476,
        "floorLight": 12564125,
        "materialDark": 4868945,
        "materialMid": 7695973,
        "materialLight": 9799795,
        "faceLight": 13813675,
        "accentDim": 6443617,
        "accent": 8809848,
        "accentLight": 11639443,
        "peak": 15590084,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 11182476,
        "groundLight": 12564125,
        "groundDark": 7367527,
        "wall": 7695973,
        "wallLight": 13813675,
        "wallDark": 4868945
      }
    },
    "definitions": [
      {
        "id": "broken-shell-low",
        "family": "broken-shell",
        "grade": "low",
        "label": "\u58F3\u8154\xB7\u521D\u88C2",
        "profile": "ivory-basin",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 538,
        "search_y": 428,
        "enemy_x": 708,
        "enemy_y": 182,
        "axis": -0.18,
        "light_radius": 108,
        "emission": 0.35,
        "motion_period": 24,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "relief",
            "x": 471,
            "y": 266,
            "rotation": 1.25,
            "length": 224,
            "width": 172,
            "height": 6,
            "thickness": 2,
            "fold": 0.32,
            "branches": 3,
            "opening": 0.34,
            "distortion": 0.18
          },
          {
            "id": 2,
            "role": "solid",
            "x": 656,
            "y": 277,
            "rotation": 0.38,
            "length": 132,
            "width": 114,
            "height": 48,
            "thickness": 17,
            "fold": 0.25,
            "branches": 2,
            "opening": 0.46,
            "distortion": 0.14
          }
        ],
        "erosion": [
          [
            {
              "x": 620,
              "y": 352
            },
            {
              "x": 656,
              "y": 344
            },
            {
              "x": 704,
              "y": 368
            },
            {
              "x": 696,
              "y": 392
            },
            {
              "x": 644,
              "y": 382
            }
          ]
        ]
      },
      {
        "id": "broken-shell-medium",
        "family": "broken-shell",
        "grade": "medium",
        "label": "\u58F3\u8154\xB7\u5185\u7FFB",
        "profile": "ivory-basin",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 582,
        "search_y": 450,
        "enemy_x": 716,
        "enemy_y": 176,
        "axis": -0.18,
        "light_radius": 134,
        "emission": 0.55,
        "motion_period": 20,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "solid",
            "x": 471,
            "y": 266,
            "rotation": 1.25,
            "length": 278,
            "width": 206,
            "height": 131,
            "thickness": 31,
            "fold": 0.57,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.3
          },
          {
            "id": 2,
            "role": "relief",
            "x": 637,
            "y": 260,
            "rotation": 0.41,
            "length": 192,
            "width": 153,
            "height": 6,
            "thickness": 2,
            "fold": 0.45,
            "branches": 3,
            "opening": 0.38,
            "distortion": 0.25
          },
          {
            "id": 3,
            "role": "relief",
            "x": 459,
            "y": 125,
            "rotation": 2.62,
            "length": 161,
            "width": 116,
            "height": 6,
            "thickness": 2,
            "fold": 0.4,
            "branches": 3,
            "opening": 0.4,
            "distortion": 0.24
          }
        ],
        "erosion": [
          [
            {
              "x": 584,
              "y": 352
            },
            {
              "x": 648,
              "y": 328
            },
            {
              "x": 728,
              "y": 352
            },
            {
              "x": 756,
              "y": 392
            },
            {
              "x": 716,
              "y": 416
            },
            {
              "x": 652,
              "y": 388
            },
            {
              "x": 608,
              "y": 392
            }
          ],
          [
            {
              "x": 168,
              "y": 128
            },
            {
              "x": 240,
              "y": 104
            },
            {
              "x": 284,
              "y": 128
            },
            {
              "x": 268,
              "y": 160
            },
            {
              "x": 200,
              "y": 168
            }
          ]
        ]
      },
      {
        "id": "broken-shell-severe",
        "family": "broken-shell",
        "grade": "severe",
        "label": "\u58F3\u8154\xB7\u91CD\u5C01",
        "profile": "ivory-basin",
        "cols": 28,
        "rows": 20,
        "seed": 20261002,
        "spawn_x": 260,
        "spawn_y": 380,
        "exit_x": 196,
        "exit_y": 460,
        "search_x": 613,
        "search_y": 466,
        "enemy_x": 762,
        "enemy_y": 172,
        "axis": -0.18,
        "light_radius": 155,
        "emission": 0.72,
        "motion_period": 17,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "role": "solid",
            "x": 471,
            "y": 224,
            "rotation": 1.25,
            "length": 405,
            "width": 292,
            "height": 190,
            "thickness": 38,
            "fold": 0.83,
            "branches": 5,
            "opening": 0.25,
            "distortion": 0.41
          },
          {
            "id": 2,
            "role": "solid",
            "x": 691,
            "y": 276,
            "rotation": 0.34,
            "length": 247,
            "width": 187,
            "height": 139,
            "thickness": 31,
            "fold": 0.72,
            "branches": 4,
            "opening": 0.29,
            "distortion": 0.36
          },
          {
            "id": 3,
            "role": "relief",
            "x": 428,
            "y": 89,
            "rotation": 2.79,
            "length": 244,
            "width": 168,
            "height": 6,
            "thickness": 2,
            "fold": 0.69,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.33
          }
        ],
        "erosion": [
          [
            {
              "x": 584,
              "y": 352
            },
            {
              "x": 664,
              "y": 320
            },
            {
              "x": 776,
              "y": 352
            },
            {
              "x": 816,
              "y": 408
            },
            {
              "x": 752,
              "y": 448
            },
            {
              "x": 664,
              "y": 408
            },
            {
              "x": 616,
              "y": 432
            },
            {
              "x": 568,
              "y": 400
            }
          ],
          [
            {
              "x": 128,
              "y": 104
            },
            {
              "x": 208,
              "y": 80
            },
            {
              "x": 296,
              "y": 112
            },
            {
              "x": 304,
              "y": 152
            },
            {
              "x": 240,
              "y": 176
            },
            {
              "x": 176,
              "y": 160
            },
            {
              "x": 112,
              "y": 144
            }
          ],
          [
            {
              "x": 336,
              "y": 488
            },
            {
              "x": 408,
              "y": 472
            },
            {
              "x": 480,
              "y": 504
            },
            {
              "x": 472,
              "y": 540
            },
            {
              "x": 400,
              "y": 548
            },
            {
              "x": 344,
              "y": 520
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "cinder-ridge",
    "label": "\u4F59\u70EC\u810A",
    "iteration": 4,
    "enabled": true,
    "profile": {
      "id": "cinder-ridge",
      "label": "\u4F59\u70EC\u810A",
      "description": "\u4F59\u70EC\u810A\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "granular",
      "surface": {
        "substrate": "granular",
        "coating": "granular",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    "definitions": [
      {
        "id": "cinder-ridge-low",
        "family": "granular-ridge",
        "grade": "low",
        "label": "\u4F59\u70EC\u810A",
        "profile": "cinder-ridge",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 19,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 470,
            "y": 400,
            "rotation": -0.25,
            "length": 370,
            "width": 165,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "granular-ridge",
            "role": "solid",
            "x": 450,
            "y": 250,
            "rotation": -0.3,
            "length": 290,
            "width": 95,
            "height": 35,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 724,
            "y": 478,
            "rotation": 0.45,
            "length": 240,
            "width": 112,
            "height": 31,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "cinder-ridge-medium",
        "family": "granular-ridge",
        "grade": "medium",
        "label": "\u4F59\u70EC\u810A",
        "profile": "cinder-ridge",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 132,
        "emission": 0.55,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 470,
            "y": 400,
            "rotation": -0.25,
            "length": 370,
            "width": 165,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "granular-ridge",
            "role": "solid",
            "x": 450,
            "y": 250,
            "rotation": -0.3,
            "length": 290,
            "width": 95,
            "height": 35,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 724,
            "y": 478,
            "rotation": 0.45,
            "length": 240,
            "width": 112,
            "height": 31,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "cinder-ridge-severe",
        "family": "granular-ridge",
        "grade": "severe",
        "label": "\u4F59\u70EC\u810A",
        "profile": "cinder-ridge",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 14,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 470,
            "y": 400,
            "rotation": -0.25,
            "length": 370,
            "width": 165,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "granular-ridge",
            "role": "solid",
            "x": 450,
            "y": 250,
            "rotation": -0.3,
            "length": 290,
            "width": 95,
            "height": 35,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 724,
            "y": 478,
            "rotation": 0.45,
            "length": 240,
            "width": 112,
            "height": 31,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "pallid-membrane",
    "label": "\u82CD\u819C\u6D3C",
    "iteration": 4,
    "enabled": true,
    "profile": {
      "id": "pallid-membrane",
      "label": "\u82CD\u819C\u6D3C",
      "description": "\u82CD\u819C\u6D3C\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "membrane",
      "surface": {
        "substrate": "membrane",
        "coating": "membrane",
        "organization": "patches",
        "coverage": 0.54,
        "wear": 0.57,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.72,
        "regionScale": 1.4,
        "quietness": 0.55,
        "formScale": 1.6,
        "fragmentation": 0.42,
        "accentCoverage": 0.11
      },
      "palette": {
        "void": 1448997,
        "shadow": 2699322,
        "floorDeep": 7367527,
        "floor": 11182476,
        "floorLight": 12564125,
        "materialDark": 4868945,
        "materialMid": 7695973,
        "materialLight": 9799795,
        "faceLight": 13813675,
        "accentDim": 6443617,
        "accent": 8809848,
        "accentLight": 11639443,
        "peak": 15590084,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 11182476,
        "groundLight": 12564125,
        "groundDark": 7367527,
        "wall": 7695973,
        "wallLight": 13813675,
        "wallDark": 4868945
      }
    },
    "definitions": [
      {
        "id": "pallid-membrane-low",
        "family": "membrane-rim",
        "grade": "low",
        "label": "\u82CD\u819C\u6D3C",
        "profile": "pallid-membrane",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 108,
        "emission": 0.35,
        "motion_period": 24,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 504,
            "y": 392,
            "rotation": 0.22,
            "length": 328,
            "width": 244,
            "height": 6,
            "thickness": 2,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.52,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "membrane-rim",
            "role": "solid",
            "x": 678,
            "y": 290,
            "rotation": -0.4,
            "length": 245,
            "width": 175,
            "height": 32,
            "thickness": 9,
            "fold": 0.5456,
            "branches": 4,
            "opening": 0.66,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 364,
            "y": 516,
            "rotation": 0.65,
            "length": 175,
            "width": 145,
            "height": 29,
            "thickness": 9,
            "fold": 0.2816,
            "branches": 4,
            "opening": 0.72,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "pallid-membrane-medium",
        "family": "membrane-rim",
        "grade": "medium",
        "label": "\u82CD\u819C\u6D3C",
        "profile": "pallid-membrane",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 134,
        "emission": 0.55,
        "motion_period": 20,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 504,
            "y": 392,
            "rotation": 0.22,
            "length": 328,
            "width": 244,
            "height": 6,
            "thickness": 2,
            "fold": 0.4,
            "branches": 4,
            "opening": 0.52,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "membrane-rim",
            "role": "solid",
            "x": 678,
            "y": 290,
            "rotation": -0.4,
            "length": 245,
            "width": 175,
            "height": 32,
            "thickness": 9,
            "fold": 0.62,
            "branches": 4,
            "opening": 0.66,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 364,
            "y": 516,
            "rotation": 0.65,
            "length": 175,
            "width": 145,
            "height": 29,
            "thickness": 9,
            "fold": 0.32,
            "branches": 4,
            "opening": 0.72,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "pallid-membrane-severe",
        "family": "membrane-rim",
        "grade": "severe",
        "label": "\u82CD\u819C\u6D3C",
        "profile": "pallid-membrane",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 155,
        "emission": 0.72,
        "motion_period": 17,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 504,
            "y": 392,
            "rotation": 0.22,
            "length": 328,
            "width": 244,
            "height": 6,
            "thickness": 2,
            "fold": 0.44000000000000006,
            "branches": 4,
            "opening": 0.52,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "membrane-rim",
            "role": "solid",
            "x": 678,
            "y": 290,
            "rotation": -0.4,
            "length": 245,
            "width": 175,
            "height": 32,
            "thickness": 9,
            "fold": 0.682,
            "branches": 4,
            "opening": 0.66,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 364,
            "y": 516,
            "rotation": 0.65,
            "length": 175,
            "width": 145,
            "height": 29,
            "thickness": 9,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.72,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "silt-gel",
    "label": "\u6DE4\u6D41\u524D\u6CBF",
    "iteration": 4,
    "enabled": true,
    "profile": {
      "id": "silt-gel",
      "label": "\u6DE4\u6D41\u524D\u6CBF",
      "description": "\u6DE4\u6D41\u524D\u6CBF\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "gel",
      "surface": {
        "substrate": "gel",
        "coating": "gel",
        "organization": "bands",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    "definitions": [
      {
        "id": "silt-gel-low",
        "family": "gel-flow",
        "grade": "low",
        "label": "\u6DE4\u6D41\u524D\u6CBF",
        "profile": "silt-gel",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 22,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 468,
            "y": 460,
            "rotation": -0.38,
            "length": 398,
            "width": 166,
            "height": 6,
            "thickness": 2,
            "fold": 0.2816,
            "branches": 4,
            "opening": 0.28,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "gel-flow",
            "role": "solid",
            "x": 664,
            "y": 262,
            "rotation": -0.24,
            "length": 298,
            "width": 162,
            "height": 36,
            "thickness": 9,
            "fold": 0.4576,
            "branches": 4,
            "opening": 0.32,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 740,
            "y": 508,
            "rotation": 0.56,
            "length": 180,
            "width": 154,
            "height": 31,
            "thickness": 9,
            "fold": 0.4224,
            "branches": 4,
            "opening": 0.42,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "silt-gel-medium",
        "family": "gel-flow",
        "grade": "medium",
        "label": "\u6DE4\u6D41\u524D\u6CBF",
        "profile": "silt-gel",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 136,
        "emission": 0.55,
        "motion_period": 18,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 468,
            "y": 460,
            "rotation": -0.38,
            "length": 398,
            "width": 166,
            "height": 6,
            "thickness": 2,
            "fold": 0.32,
            "branches": 4,
            "opening": 0.28,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "gel-flow",
            "role": "solid",
            "x": 664,
            "y": 262,
            "rotation": -0.24,
            "length": 298,
            "width": 162,
            "height": 36,
            "thickness": 9,
            "fold": 0.52,
            "branches": 4,
            "opening": 0.32,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 740,
            "y": 508,
            "rotation": 0.56,
            "length": 180,
            "width": 154,
            "height": 31,
            "thickness": 9,
            "fold": 0.48,
            "branches": 4,
            "opening": 0.42,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "silt-gel-severe",
        "family": "gel-flow",
        "grade": "severe",
        "label": "\u6DE4\u6D41\u524D\u6CBF",
        "profile": "silt-gel",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 468,
            "y": 460,
            "rotation": -0.38,
            "length": 398,
            "width": 166,
            "height": 6,
            "thickness": 2,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.28,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "gel-flow",
            "role": "solid",
            "x": 664,
            "y": 262,
            "rotation": -0.24,
            "length": 298,
            "width": 162,
            "height": 36,
            "thickness": 9,
            "fold": 0.5720000000000001,
            "branches": 4,
            "opening": 0.32,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 740,
            "y": 508,
            "rotation": 0.56,
            "length": 180,
            "width": 154,
            "height": 31,
            "thickness": 9,
            "fold": 0.528,
            "branches": 4,
            "opening": 0.42,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "schist-shear",
    "label": "\u5C42\u7247\u526A\u5207\u5E26",
    "iteration": 5,
    "enabled": true,
    "profile": {
      "id": "schist-shear",
      "label": "\u5C42\u7247\u526A\u5207\u5E26",
      "description": "\u5C42\u7247\u526A\u5207\u5E26\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "strata",
      "surface": {
        "substrate": "strata",
        "coating": "strata",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    "definitions": [
      {
        "id": "schist-shear-low",
        "family": "folded-slab",
        "grade": "low",
        "label": "\u5C42\u7247\u526A\u5207\u5E26",
        "profile": "schist-shear",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 19,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 430,
            "y": 390,
            "rotation": 0.4,
            "length": 470,
            "width": 95,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 358,
            "y": 230,
            "rotation": -0.6,
            "length": 236,
            "width": 80,
            "height": 29,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "folded-slab",
            "role": "solid",
            "x": 596,
            "y": 362,
            "rotation": -0.6,
            "length": 226,
            "width": 87,
            "height": 33,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 794,
            "y": 496,
            "rotation": -0.6,
            "length": 218,
            "width": 80,
            "height": 29,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "schist-shear-medium",
        "family": "folded-slab",
        "grade": "medium",
        "label": "\u5C42\u7247\u526A\u5207\u5E26",
        "profile": "schist-shear",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 132,
        "emission": 0.55,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 430,
            "y": 390,
            "rotation": 0.4,
            "length": 470,
            "width": 95,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 358,
            "y": 230,
            "rotation": -0.6,
            "length": 236,
            "width": 80,
            "height": 29,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "folded-slab",
            "role": "solid",
            "x": 596,
            "y": 362,
            "rotation": -0.6,
            "length": 226,
            "width": 87,
            "height": 33,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 794,
            "y": 496,
            "rotation": -0.6,
            "length": 218,
            "width": 80,
            "height": 29,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "schist-shear-severe",
        "family": "folded-slab",
        "grade": "severe",
        "label": "\u5C42\u7247\u526A\u5207\u5E26",
        "profile": "schist-shear",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 14,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 430,
            "y": 390,
            "rotation": 0.4,
            "length": 470,
            "width": 95,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 358,
            "y": 230,
            "rotation": -0.6,
            "length": 236,
            "width": 80,
            "height": 29,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "folded-slab",
            "role": "solid",
            "x": 596,
            "y": 362,
            "rotation": -0.6,
            "length": 226,
            "width": 87,
            "height": 33,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 794,
            "y": 496,
            "rotation": -0.6,
            "length": 218,
            "width": 80,
            "height": 29,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "splayed-fibres",
    "label": "\u7EA4\u7EF4\u6247\u6D41",
    "iteration": 5,
    "enabled": true,
    "profile": {
      "id": "splayed-fibres",
      "label": "\u7EA4\u7EF4\u6247\u6D41",
      "description": "\u7EA4\u7EF4\u6247\u6D41\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "crystal",
      "surface": {
        "substrate": "crystal",
        "coating": "crystal",
        "organization": "clusters",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    "definitions": [
      {
        "id": "splayed-fibres-low",
        "family": "fibre-knot",
        "grade": "low",
        "label": "\u7EA4\u7EF4\u6247\u6D41",
        "profile": "splayed-fibres",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 22,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "fibre-knot",
            "role": "relief",
            "x": 422,
            "y": 428,
            "rotation": -0.32,
            "length": 340,
            "width": 240,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 412,
            "y": 226,
            "rotation": -0.72,
            "length": 230,
            "width": 136,
            "height": 38,
            "thickness": 9,
            "fold": 0.4576,
            "branches": 4,
            "opening": 0.64,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "fibre-knot",
            "role": "solid",
            "x": 657,
            "y": 337,
            "rotation": 0.08,
            "length": 238,
            "width": 141,
            "height": 38,
            "thickness": 9,
            "fold": 0.2992,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 738,
            "y": 548,
            "rotation": 0.72,
            "length": 214,
            "width": 125,
            "height": 30,
            "thickness": 9,
            "fold": 0.22,
            "branches": 4,
            "opening": 0.56,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "splayed-fibres-medium",
        "family": "fibre-knot",
        "grade": "medium",
        "label": "\u7EA4\u7EF4\u6247\u6D41",
        "profile": "splayed-fibres",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 136,
        "emission": 0.55,
        "motion_period": 18,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "fibre-knot",
            "role": "relief",
            "x": 422,
            "y": 428,
            "rotation": -0.32,
            "length": 340,
            "width": 240,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 412,
            "y": 226,
            "rotation": -0.72,
            "length": 230,
            "width": 136,
            "height": 38,
            "thickness": 9,
            "fold": 0.52,
            "branches": 4,
            "opening": 0.64,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "fibre-knot",
            "role": "solid",
            "x": 657,
            "y": 337,
            "rotation": 0.08,
            "length": 238,
            "width": 141,
            "height": 38,
            "thickness": 9,
            "fold": 0.34,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 738,
            "y": 548,
            "rotation": 0.72,
            "length": 214,
            "width": 125,
            "height": 30,
            "thickness": 9,
            "fold": 0.25,
            "branches": 4,
            "opening": 0.56,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "splayed-fibres-severe",
        "family": "fibre-knot",
        "grade": "severe",
        "label": "\u7EA4\u7EF4\u6247\u6D41",
        "profile": "splayed-fibres",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "fibre-knot",
            "role": "relief",
            "x": 422,
            "y": 428,
            "rotation": -0.32,
            "length": 340,
            "width": 240,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 412,
            "y": 226,
            "rotation": -0.72,
            "length": 230,
            "width": 136,
            "height": 38,
            "thickness": 9,
            "fold": 0.5720000000000001,
            "branches": 4,
            "opening": 0.64,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "fibre-knot",
            "role": "solid",
            "x": 657,
            "y": 337,
            "rotation": 0.08,
            "length": 238,
            "width": 141,
            "height": 38,
            "thickness": 9,
            "fold": 0.37400000000000005,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 738,
            "y": 548,
            "rotation": 0.72,
            "length": 214,
            "width": 125,
            "height": 30,
            "thickness": 9,
            "fold": 0.275,
            "branches": 4,
            "opening": 0.56,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "shell-chain",
    "label": "\u58F3\u7F18\u9636\u4E32",
    "iteration": 5,
    "enabled": true,
    "profile": {
      "id": "shell-chain",
      "label": "\u58F3\u7F18\u9636\u4E32",
      "description": "\u58F3\u7F18\u9636\u4E32\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "glaze",
      "surface": {
        "substrate": "glaze",
        "coating": "glaze",
        "organization": "patches",
        "coverage": 0.54,
        "wear": 0.57,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.72,
        "regionScale": 1.4,
        "quietness": 0.55,
        "formScale": 1.6,
        "fragmentation": 0.42,
        "accentCoverage": 0.11
      },
      "palette": {
        "void": 1448997,
        "shadow": 2699322,
        "floorDeep": 7367527,
        "floor": 11182476,
        "floorLight": 12564125,
        "materialDark": 4868945,
        "materialMid": 7695973,
        "materialLight": 9799795,
        "faceLight": 13813675,
        "accentDim": 6443617,
        "accent": 8809848,
        "accentLight": 11639443,
        "peak": 15590084,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 11182476,
        "groundLight": 12564125,
        "groundDark": 7367527,
        "wall": 7695973,
        "wallLight": 13813675,
        "wallDark": 4868945
      }
    },
    "definitions": [
      {
        "id": "shell-chain-low",
        "family": "broken-shell",
        "grade": "low",
        "label": "\u58F3\u7F18\u9636\u4E32",
        "profile": "shell-chain",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 108,
        "emission": 0.35,
        "motion_period": 24,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "broken-shell",
            "role": "relief",
            "x": 438,
            "y": 400,
            "rotation": -0.3,
            "length": 348,
            "width": 214,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 344,
            "y": 208,
            "rotation": -0.3,
            "length": 174,
            "width": 144,
            "height": 30,
            "thickness": 9,
            "fold": 0.396,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "broken-shell",
            "role": "solid",
            "x": 590,
            "y": 367,
            "rotation": 1.4,
            "length": 208,
            "width": 158,
            "height": 38,
            "thickness": 9,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.7,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "broken-shell",
            "role": "solid",
            "x": 818,
            "y": 552,
            "rotation": -0.5,
            "length": 172,
            "width": 143,
            "height": 29,
            "thickness": 9,
            "fold": 0.396,
            "branches": 4,
            "opening": 0.7,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "shell-chain-medium",
        "family": "broken-shell",
        "grade": "medium",
        "label": "\u58F3\u7F18\u9636\u4E32",
        "profile": "shell-chain",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 134,
        "emission": 0.55,
        "motion_period": 20,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "broken-shell",
            "role": "relief",
            "x": 438,
            "y": 400,
            "rotation": -0.3,
            "length": 348,
            "width": 214,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 344,
            "y": 208,
            "rotation": -0.3,
            "length": 174,
            "width": 144,
            "height": 30,
            "thickness": 9,
            "fold": 0.45,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "broken-shell",
            "role": "solid",
            "x": 590,
            "y": 367,
            "rotation": 1.4,
            "length": 208,
            "width": 158,
            "height": 38,
            "thickness": 9,
            "fold": 0.4,
            "branches": 4,
            "opening": 0.7,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "broken-shell",
            "role": "solid",
            "x": 818,
            "y": 552,
            "rotation": -0.5,
            "length": 172,
            "width": 143,
            "height": 29,
            "thickness": 9,
            "fold": 0.45,
            "branches": 4,
            "opening": 0.7,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "shell-chain-severe",
        "family": "broken-shell",
        "grade": "severe",
        "label": "\u58F3\u7F18\u9636\u4E32",
        "profile": "shell-chain",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 155,
        "emission": 0.72,
        "motion_period": 17,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "broken-shell",
            "role": "relief",
            "x": 438,
            "y": 400,
            "rotation": -0.3,
            "length": 348,
            "width": 214,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 344,
            "y": 208,
            "rotation": -0.3,
            "length": 174,
            "width": 144,
            "height": 30,
            "thickness": 9,
            "fold": 0.49500000000000005,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "broken-shell",
            "role": "solid",
            "x": 590,
            "y": 367,
            "rotation": 1.4,
            "length": 208,
            "width": 158,
            "height": 38,
            "thickness": 9,
            "fold": 0.44000000000000006,
            "branches": 4,
            "opening": 0.7,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "broken-shell",
            "role": "solid",
            "x": 818,
            "y": 552,
            "rotation": -0.5,
            "length": 172,
            "width": 143,
            "height": 29,
            "thickness": 9,
            "fold": 0.49500000000000005,
            "branches": 4,
            "opening": 0.7,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "grain-laminate",
    "label": "\u9897\u7C92\u5C42\u7247\u51B2\u79EF",
    "iteration": 5,
    "enabled": true,
    "profile": {
      "id": "grain-laminate",
      "label": "\u9897\u7C92\u5C42\u7247\u51B2\u79EF",
      "description": "\u9897\u7C92\u5C42\u7247\u51B2\u79EF\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "granular",
      "surface": {
        "substrate": "granular",
        "coating": "granular",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    "definitions": [
      {
        "id": "grain-laminate-low",
        "family": "granular-ridge",
        "grade": "low",
        "label": "\u9897\u7C92\u5C42\u7247\u51B2\u79EF",
        "profile": "grain-laminate",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 19,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 510,
            "y": 459,
            "rotation": 0.15,
            "length": 362,
            "width": 190,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 438,
            "y": 239,
            "rotation": -0.48,
            "length": 305,
            "width": 108,
            "height": 34,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 554,
            "y": 296,
            "rotation": -0.35,
            "length": 245,
            "width": 111,
            "height": 32,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 750,
            "y": 505,
            "rotation": 0.5,
            "length": 192,
            "width": 100,
            "height": 27,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "grain-laminate-medium",
        "family": "granular-ridge",
        "grade": "medium",
        "label": "\u9897\u7C92\u5C42\u7247\u51B2\u79EF",
        "profile": "grain-laminate",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 132,
        "emission": 0.55,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 510,
            "y": 459,
            "rotation": 0.15,
            "length": 362,
            "width": 190,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 438,
            "y": 239,
            "rotation": -0.48,
            "length": 305,
            "width": 108,
            "height": 34,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 554,
            "y": 296,
            "rotation": -0.35,
            "length": 245,
            "width": 111,
            "height": 32,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 750,
            "y": 505,
            "rotation": 0.5,
            "length": 192,
            "width": 100,
            "height": 27,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "grain-laminate-severe",
        "family": "granular-ridge",
        "grade": "severe",
        "label": "\u9897\u7C92\u5C42\u7247\u51B2\u79EF",
        "profile": "grain-laminate",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 14,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 510,
            "y": 459,
            "rotation": 0.15,
            "length": 362,
            "width": 190,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 438,
            "y": 239,
            "rotation": -0.48,
            "length": 305,
            "width": 108,
            "height": 34,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 554,
            "y": 296,
            "rotation": -0.35,
            "length": 245,
            "width": 111,
            "height": 32,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 750,
            "y": 505,
            "rotation": 0.5,
            "length": 192,
            "width": 100,
            "height": 27,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "tension-membrane",
    "label": "\u7EA4\u7EF4\u7275\u819C",
    "iteration": 5,
    "enabled": true,
    "profile": {
      "id": "tension-membrane",
      "label": "\u7EA4\u7EF4\u7275\u819C",
      "description": "\u7EA4\u7EF4\u7275\u819C\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "membrane",
      "surface": {
        "substrate": "membrane",
        "coating": "membrane",
        "organization": "clusters",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    "definitions": [
      {
        "id": "tension-membrane-low",
        "family": "membrane-rim",
        "grade": "low",
        "label": "\u7EA4\u7EF4\u7275\u819C",
        "profile": "tension-membrane",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 108,
        "emission": 0.35,
        "motion_period": 24,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 499,
            "y": 428,
            "rotation": -0.14,
            "length": 412,
            "width": 203,
            "height": 6,
            "thickness": 2,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 381,
            "y": 252,
            "rotation": 0.63,
            "length": 231,
            "width": 102,
            "height": 33,
            "thickness": 9,
            "fold": 0.46640000000000004,
            "branches": 4,
            "opening": 0.4,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 580,
            "y": 286,
            "rotation": 0,
            "length": 253,
            "width": 158,
            "height": 28,
            "thickness": 9,
            "fold": 0.616,
            "branches": 4,
            "opening": 0.71,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 783,
            "y": 463,
            "rotation": -0.5,
            "length": 226,
            "width": 114,
            "height": 34,
            "thickness": 9,
            "fold": 0.22,
            "branches": 4,
            "opening": 0.48,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "tension-membrane-medium",
        "family": "membrane-rim",
        "grade": "medium",
        "label": "\u7EA4\u7EF4\u7275\u819C",
        "profile": "tension-membrane",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 134,
        "emission": 0.55,
        "motion_period": 20,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 499,
            "y": 428,
            "rotation": -0.14,
            "length": 412,
            "width": 203,
            "height": 6,
            "thickness": 2,
            "fold": 0.4,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 381,
            "y": 252,
            "rotation": 0.63,
            "length": 231,
            "width": 102,
            "height": 33,
            "thickness": 9,
            "fold": 0.53,
            "branches": 4,
            "opening": 0.4,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 580,
            "y": 286,
            "rotation": 0,
            "length": 253,
            "width": 158,
            "height": 28,
            "thickness": 9,
            "fold": 0.7,
            "branches": 4,
            "opening": 0.71,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 783,
            "y": 463,
            "rotation": -0.5,
            "length": 226,
            "width": 114,
            "height": 34,
            "thickness": 9,
            "fold": 0.25,
            "branches": 4,
            "opening": 0.48,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "tension-membrane-severe",
        "family": "membrane-rim",
        "grade": "severe",
        "label": "\u7EA4\u7EF4\u7275\u819C",
        "profile": "tension-membrane",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 155,
        "emission": 0.72,
        "motion_period": 17,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 499,
            "y": 428,
            "rotation": -0.14,
            "length": 412,
            "width": 203,
            "height": 6,
            "thickness": 2,
            "fold": 0.44000000000000006,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 381,
            "y": 252,
            "rotation": 0.63,
            "length": 231,
            "width": 102,
            "height": 33,
            "thickness": 9,
            "fold": 0.5830000000000001,
            "branches": 4,
            "opening": 0.4,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 580,
            "y": 286,
            "rotation": 0,
            "length": 253,
            "width": 158,
            "height": 28,
            "thickness": 9,
            "fold": 0.77,
            "branches": 4,
            "opening": 0.71,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 783,
            "y": 463,
            "rotation": -0.5,
            "length": 226,
            "width": 114,
            "height": 34,
            "thickness": 9,
            "fold": 0.275,
            "branches": 4,
            "opening": 0.48,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "shell-gel-delta",
    "label": "\u58F3\u6321\u51DD\u80F6",
    "iteration": 5,
    "enabled": true,
    "profile": {
      "id": "shell-gel-delta",
      "label": "\u58F3\u6321\u51DD\u80F6",
      "description": "\u58F3\u6321\u51DD\u80F6\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "gel",
      "surface": {
        "substrate": "gel",
        "coating": "gel",
        "organization": "bands",
        "coverage": 0.54,
        "wear": 0.57,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.72,
        "regionScale": 1.4,
        "quietness": 0.55,
        "formScale": 1.6,
        "fragmentation": 0.42,
        "accentCoverage": 0.11
      },
      "palette": {
        "void": 1448997,
        "shadow": 2699322,
        "floorDeep": 7367527,
        "floor": 11182476,
        "floorLight": 12564125,
        "materialDark": 4868945,
        "materialMid": 7695973,
        "materialLight": 9799795,
        "faceLight": 13813675,
        "accentDim": 6443617,
        "accent": 8809848,
        "accentLight": 11639443,
        "peak": 15590084,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 11182476,
        "groundLight": 12564125,
        "groundDark": 7367527,
        "wall": 7695973,
        "wallLight": 13813675,
        "wallDark": 4868945
      }
    },
    "definitions": [
      {
        "id": "shell-gel-delta-low",
        "family": "gel-flow",
        "grade": "low",
        "label": "\u58F3\u6321\u51DD\u80F6",
        "profile": "shell-gel-delta",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 22,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 426,
            "y": 394,
            "rotation": 0.3,
            "length": 344,
            "width": 202,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 610,
            "y": 307,
            "rotation": -0.66,
            "length": 242,
            "width": 167,
            "height": 37,
            "thickness": 9,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 706,
            "y": 267,
            "rotation": -0.63,
            "length": 211,
            "width": 92,
            "height": 31,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "gel-flow",
            "role": "solid",
            "x": 761,
            "y": 456,
            "rotation": 0.41,
            "length": 259,
            "width": 99,
            "height": 29,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "shell-gel-delta-medium",
        "family": "gel-flow",
        "grade": "medium",
        "label": "\u58F3\u6321\u51DD\u80F6",
        "profile": "shell-gel-delta",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 136,
        "emission": 0.55,
        "motion_period": 18,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 426,
            "y": 394,
            "rotation": 0.3,
            "length": 344,
            "width": 202,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 610,
            "y": 307,
            "rotation": -0.66,
            "length": 242,
            "width": 167,
            "height": 37,
            "thickness": 9,
            "fold": 0.4,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 706,
            "y": 267,
            "rotation": -0.63,
            "length": 211,
            "width": 92,
            "height": 31,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "gel-flow",
            "role": "solid",
            "x": 761,
            "y": 456,
            "rotation": 0.41,
            "length": 259,
            "width": 99,
            "height": 29,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "shell-gel-delta-severe",
        "family": "gel-flow",
        "grade": "severe",
        "label": "\u58F3\u6321\u51DD\u80F6",
        "profile": "shell-gel-delta",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 426,
            "y": 394,
            "rotation": 0.3,
            "length": 344,
            "width": 202,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 610,
            "y": 307,
            "rotation": -0.66,
            "length": 242,
            "width": 167,
            "height": 37,
            "thickness": 9,
            "fold": 0.44000000000000006,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 706,
            "y": 267,
            "rotation": -0.63,
            "length": 211,
            "width": 92,
            "height": 31,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "gel-flow",
            "role": "solid",
            "x": 761,
            "y": 456,
            "rotation": 0.41,
            "length": 259,
            "width": 99,
            "height": 29,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "pressed-dunes",
    "label": "\u538B\u5B9E\u810A\u5ECA",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "pressed-dunes",
      "label": "\u538B\u5B9E\u810A\u5ECA",
      "description": "\u538B\u5B9E\u810A\u5ECA\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "granular",
      "surface": {
        "substrate": "granular",
        "coating": "granular",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    "definitions": [
      {
        "id": "pressed-dunes-low",
        "family": "granular-ridge",
        "grade": "low",
        "label": "\u538B\u5B9E\u810A\u5ECA",
        "profile": "pressed-dunes",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 19,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 472,
            "y": 430,
            "rotation": 0.4,
            "length": 383,
            "width": 201,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "granular-ridge",
            "role": "solid",
            "x": 363,
            "y": 223,
            "rotation": 0.27,
            "length": 360,
            "width": 82,
            "height": 33,
            "thickness": 9,
            "fold": 0.3872,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 690,
            "y": 335,
            "rotation": -0.45,
            "length": 345,
            "width": 88,
            "height": 38,
            "thickness": 9,
            "fold": 0.2728,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "granular-ridge",
            "role": "solid",
            "x": 645,
            "y": 565,
            "rotation": 0.29,
            "length": 281,
            "width": 98,
            "height": 30,
            "thickness": 9,
            "fold": 0.44,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "pressed-dunes-medium",
        "family": "granular-ridge",
        "grade": "medium",
        "label": "\u538B\u5B9E\u810A\u5ECA",
        "profile": "pressed-dunes",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 132,
        "emission": 0.55,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 472,
            "y": 430,
            "rotation": 0.4,
            "length": 383,
            "width": 201,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "granular-ridge",
            "role": "solid",
            "x": 363,
            "y": 223,
            "rotation": 0.27,
            "length": 360,
            "width": 82,
            "height": 33,
            "thickness": 9,
            "fold": 0.44,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 690,
            "y": 335,
            "rotation": -0.45,
            "length": 345,
            "width": 88,
            "height": 38,
            "thickness": 9,
            "fold": 0.31,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "granular-ridge",
            "role": "solid",
            "x": 645,
            "y": 565,
            "rotation": 0.29,
            "length": 281,
            "width": 98,
            "height": 30,
            "thickness": 9,
            "fold": 0.5,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "pressed-dunes-severe",
        "family": "granular-ridge",
        "grade": "severe",
        "label": "\u538B\u5B9E\u810A\u5ECA",
        "profile": "pressed-dunes",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 14,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "granular-ridge",
            "role": "relief",
            "x": 472,
            "y": 430,
            "rotation": 0.4,
            "length": 383,
            "width": 201,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "granular-ridge",
            "role": "solid",
            "x": 363,
            "y": 223,
            "rotation": 0.27,
            "length": 360,
            "width": 82,
            "height": 33,
            "thickness": 9,
            "fold": 0.48400000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 690,
            "y": 335,
            "rotation": -0.45,
            "length": 345,
            "width": 88,
            "height": 38,
            "thickness": 9,
            "fold": 0.341,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "granular-ridge",
            "role": "solid",
            "x": 645,
            "y": 565,
            "rotation": 0.29,
            "length": 281,
            "width": 98,
            "height": 30,
            "thickness": 9,
            "fold": 0.55,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "ruptured-film",
    "label": "\u7834\u819C\u76C6\u5730",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "ruptured-film",
      "label": "\u7834\u819C\u76C6\u5730",
      "description": "\u7834\u819C\u76C6\u5730\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "membrane",
      "surface": {
        "substrate": "membrane",
        "coating": "membrane",
        "organization": "patches",
        "coverage": 0.54,
        "wear": 0.57,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.72,
        "regionScale": 1.4,
        "quietness": 0.55,
        "formScale": 1.6,
        "fragmentation": 0.42,
        "accentCoverage": 0.11
      },
      "palette": {
        "void": 1448997,
        "shadow": 2699322,
        "floorDeep": 7367527,
        "floor": 11182476,
        "floorLight": 12564125,
        "materialDark": 4868945,
        "materialMid": 7695973,
        "materialLight": 9799795,
        "faceLight": 13813675,
        "accentDim": 6443617,
        "accent": 8809848,
        "accentLight": 11639443,
        "peak": 15590084,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 11182476,
        "groundLight": 12564125,
        "groundDark": 7367527,
        "wall": 7695973,
        "wallLight": 13813675,
        "wallDark": 4868945
      }
    },
    "definitions": [
      {
        "id": "ruptured-film-low",
        "family": "membrane-rim",
        "grade": "low",
        "label": "\u7834\u819C\u76C6\u5730",
        "profile": "ruptured-film",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 108,
        "emission": 0.35,
        "motion_period": 24,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 475,
            "y": 368,
            "rotation": 0.05,
            "length": 365,
            "width": 276,
            "height": 6,
            "thickness": 2,
            "fold": 0.44,
            "branches": 4,
            "opening": 0.88,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "membrane-rim",
            "role": "solid",
            "x": 332,
            "y": 210,
            "rotation": 0.25,
            "length": 186,
            "width": 151,
            "height": 30,
            "thickness": 9,
            "fold": 0.31679999999999997,
            "branches": 4,
            "opening": 0.85,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 801,
            "y": 366,
            "rotation": -0.75,
            "length": 207,
            "width": 177,
            "height": 39,
            "thickness": 9,
            "fold": 0.2816,
            "branches": 4,
            "opening": 0.88,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "membrane-rim",
            "role": "solid",
            "x": 555,
            "y": 574,
            "rotation": 0.9,
            "length": 174,
            "width": 138,
            "height": 30,
            "thickness": 9,
            "fold": 0.3696,
            "branches": 4,
            "opening": 0.76,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "ruptured-film-medium",
        "family": "membrane-rim",
        "grade": "medium",
        "label": "\u7834\u819C\u76C6\u5730",
        "profile": "ruptured-film",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 134,
        "emission": 0.55,
        "motion_period": 20,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 475,
            "y": 368,
            "rotation": 0.05,
            "length": 365,
            "width": 276,
            "height": 6,
            "thickness": 2,
            "fold": 0.5,
            "branches": 4,
            "opening": 0.88,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "membrane-rim",
            "role": "solid",
            "x": 332,
            "y": 210,
            "rotation": 0.25,
            "length": 186,
            "width": 151,
            "height": 30,
            "thickness": 9,
            "fold": 0.36,
            "branches": 4,
            "opening": 0.85,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 801,
            "y": 366,
            "rotation": -0.75,
            "length": 207,
            "width": 177,
            "height": 39,
            "thickness": 9,
            "fold": 0.32,
            "branches": 4,
            "opening": 0.88,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "membrane-rim",
            "role": "solid",
            "x": 555,
            "y": 574,
            "rotation": 0.9,
            "length": 174,
            "width": 138,
            "height": 30,
            "thickness": 9,
            "fold": 0.42,
            "branches": 4,
            "opening": 0.76,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "ruptured-film-severe",
        "family": "membrane-rim",
        "grade": "severe",
        "label": "\u7834\u819C\u76C6\u5730",
        "profile": "ruptured-film",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 155,
        "emission": 0.72,
        "motion_period": 17,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "membrane-rim",
            "role": "relief",
            "x": 475,
            "y": 368,
            "rotation": 0.05,
            "length": 365,
            "width": 276,
            "height": 6,
            "thickness": 2,
            "fold": 0.55,
            "branches": 4,
            "opening": 0.88,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "membrane-rim",
            "role": "solid",
            "x": 332,
            "y": 210,
            "rotation": 0.25,
            "length": 186,
            "width": 151,
            "height": 30,
            "thickness": 9,
            "fold": 0.396,
            "branches": 4,
            "opening": 0.85,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "solid",
            "x": 801,
            "y": 366,
            "rotation": -0.75,
            "length": 207,
            "width": 177,
            "height": 39,
            "thickness": 9,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.88,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "membrane-rim",
            "role": "solid",
            "x": 555,
            "y": 574,
            "rotation": 0.9,
            "length": 174,
            "width": 138,
            "height": 30,
            "thickness": 9,
            "fold": 0.462,
            "branches": 4,
            "opening": 0.76,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "reversed-flow",
    "label": "\u51DD\u80F6\u9006\u5377",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "reversed-flow",
      "label": "\u51DD\u80F6\u9006\u5377",
      "description": "\u51DD\u80F6\u9006\u5377\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "gel",
      "surface": {
        "substrate": "gel",
        "coating": "gel",
        "organization": "bands",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    "definitions": [
      {
        "id": "reversed-flow-low",
        "family": "gel-flow",
        "grade": "low",
        "label": "\u51DD\u80F6\u9006\u5377",
        "profile": "reversed-flow",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 22,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 495,
            "y": 462,
            "rotation": 0.1,
            "length": 390,
            "width": 220,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "gel-flow",
            "role": "solid",
            "x": 412,
            "y": 266,
            "rotation": 0.08,
            "length": 260,
            "width": 123,
            "height": 33,
            "thickness": 9,
            "fold": 0.6335999999999999,
            "branches": 4,
            "opening": 0.34,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 709,
            "y": 275,
            "rotation": 3.28,
            "length": 260,
            "width": 141,
            "height": 37,
            "thickness": 9,
            "fold": 0.7040000000000001,
            "branches": 4,
            "opening": 0.38,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "gel-flow",
            "role": "solid",
            "x": 709,
            "y": 535,
            "rotation": -1.4,
            "length": 196,
            "width": 119,
            "height": 32,
            "thickness": 9,
            "fold": 0.49280000000000007,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "reversed-flow-medium",
        "family": "gel-flow",
        "grade": "medium",
        "label": "\u51DD\u80F6\u9006\u5377",
        "profile": "reversed-flow",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 136,
        "emission": 0.55,
        "motion_period": 18,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 495,
            "y": 462,
            "rotation": 0.1,
            "length": 390,
            "width": 220,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "gel-flow",
            "role": "solid",
            "x": 412,
            "y": 266,
            "rotation": 0.08,
            "length": 260,
            "width": 123,
            "height": 33,
            "thickness": 9,
            "fold": 0.72,
            "branches": 4,
            "opening": 0.34,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 709,
            "y": 275,
            "rotation": 3.28,
            "length": 260,
            "width": 141,
            "height": 37,
            "thickness": 9,
            "fold": 0.8,
            "branches": 4,
            "opening": 0.38,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "gel-flow",
            "role": "solid",
            "x": 709,
            "y": 535,
            "rotation": -1.4,
            "length": 196,
            "width": 119,
            "height": 32,
            "thickness": 9,
            "fold": 0.56,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "reversed-flow-severe",
        "family": "gel-flow",
        "grade": "severe",
        "label": "\u51DD\u80F6\u9006\u5377",
        "profile": "reversed-flow",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 495,
            "y": 462,
            "rotation": 0.1,
            "length": 390,
            "width": 220,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "gel-flow",
            "role": "solid",
            "x": 412,
            "y": 266,
            "rotation": 0.08,
            "length": 260,
            "width": 123,
            "height": 33,
            "thickness": 9,
            "fold": 0.792,
            "branches": 4,
            "opening": 0.34,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 709,
            "y": 275,
            "rotation": 3.28,
            "length": 260,
            "width": 141,
            "height": 37,
            "thickness": 9,
            "fold": 0.88,
            "branches": 4,
            "opening": 0.38,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "gel-flow",
            "role": "solid",
            "x": 709,
            "y": 535,
            "rotation": -1.4,
            "length": 196,
            "width": 119,
            "height": 32,
            "thickness": 9,
            "fold": 0.6160000000000001,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "laminate-shell",
    "label": "\u5C42\u7247\u5305\u58F3",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "laminate-shell",
      "label": "\u5C42\u7247\u5305\u58F3",
      "description": "\u5C42\u7247\u5305\u58F3\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "strata",
      "surface": {
        "substrate": "strata",
        "coating": "strata",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    "definitions": [
      {
        "id": "laminate-shell-low",
        "family": "folded-slab",
        "grade": "low",
        "label": "\u5C42\u7247\u5305\u58F3",
        "profile": "laminate-shell",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 19,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 515,
            "y": 429,
            "rotation": 0.23,
            "length": 419,
            "width": 160,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 395,
            "y": 223,
            "rotation": -0.55,
            "length": 327,
            "width": 107,
            "height": 31,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "broken-shell",
            "role": "solid",
            "x": 684,
            "y": 331,
            "rotation": 1.2,
            "length": 221,
            "width": 181,
            "height": 40,
            "thickness": 9,
            "fold": 0.44,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 649,
            "y": 546,
            "rotation": 0.36,
            "length": 282,
            "width": 100,
            "height": 31,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "laminate-shell-medium",
        "family": "folded-slab",
        "grade": "medium",
        "label": "\u5C42\u7247\u5305\u58F3",
        "profile": "laminate-shell",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 132,
        "emission": 0.55,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 515,
            "y": 429,
            "rotation": 0.23,
            "length": 419,
            "width": 160,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 395,
            "y": 223,
            "rotation": -0.55,
            "length": 327,
            "width": 107,
            "height": 31,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "broken-shell",
            "role": "solid",
            "x": 684,
            "y": 331,
            "rotation": 1.2,
            "length": 221,
            "width": 181,
            "height": 40,
            "thickness": 9,
            "fold": 0.5,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 649,
            "y": 546,
            "rotation": 0.36,
            "length": 282,
            "width": 100,
            "height": 31,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "laminate-shell-severe",
        "family": "folded-slab",
        "grade": "severe",
        "label": "\u5C42\u7247\u5305\u58F3",
        "profile": "laminate-shell",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 14,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 515,
            "y": 429,
            "rotation": 0.23,
            "length": 419,
            "width": 160,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 395,
            "y": 223,
            "rotation": -0.55,
            "length": 327,
            "width": 107,
            "height": 31,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "broken-shell",
            "role": "solid",
            "x": 684,
            "y": 331,
            "rotation": 1.2,
            "length": 221,
            "width": 181,
            "height": 40,
            "thickness": 9,
            "fold": 0.55,
            "branches": 4,
            "opening": 0.6,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "folded-slab",
            "role": "solid",
            "x": 649,
            "y": 546,
            "rotation": 0.36,
            "length": 282,
            "width": 100,
            "height": 31,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "fibre-silt",
    "label": "\u7EA4\u7EF4\u79EF\u6C99\u69FD",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "fibre-silt",
      "label": "\u7EA4\u7EF4\u79EF\u6C99\u69FD",
      "description": "\u7EA4\u7EF4\u79EF\u6C99\u69FD\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "crystal",
      "surface": {
        "substrate": "crystal",
        "coating": "crystal",
        "organization": "clusters",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    "definitions": [
      {
        "id": "fibre-silt-low",
        "family": "fibre-knot",
        "grade": "low",
        "label": "\u7EA4\u7EF4\u79EF\u6C99\u69FD",
        "profile": "fibre-silt",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 22,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "fibre-knot",
            "role": "relief",
            "x": 490,
            "y": 384,
            "rotation": -0.52,
            "length": 374,
            "width": 269,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 365,
            "y": 235,
            "rotation": -0.22,
            "length": 249,
            "width": 123,
            "height": 34,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 572,
            "y": 354,
            "rotation": 0.38,
            "length": 244,
            "width": 113,
            "height": 34,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 797,
            "y": 436,
            "rotation": -0.75,
            "length": 200,
            "width": 130,
            "height": 31,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 5,
            "family": "granular-ridge",
            "role": "relief",
            "x": 678,
            "y": 552,
            "rotation": -0.44,
            "length": 273,
            "width": 106,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "fibre-silt-medium",
        "family": "fibre-knot",
        "grade": "medium",
        "label": "\u7EA4\u7EF4\u79EF\u6C99\u69FD",
        "profile": "fibre-silt",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 136,
        "emission": 0.55,
        "motion_period": 18,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "fibre-knot",
            "role": "relief",
            "x": 490,
            "y": 384,
            "rotation": -0.52,
            "length": 374,
            "width": 269,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 365,
            "y": 235,
            "rotation": -0.22,
            "length": 249,
            "width": 123,
            "height": 34,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 572,
            "y": 354,
            "rotation": 0.38,
            "length": 244,
            "width": 113,
            "height": 34,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 797,
            "y": 436,
            "rotation": -0.75,
            "length": 200,
            "width": 130,
            "height": 31,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 5,
            "family": "granular-ridge",
            "role": "relief",
            "x": 678,
            "y": 552,
            "rotation": -0.44,
            "length": 273,
            "width": 106,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "fibre-silt-severe",
        "family": "fibre-knot",
        "grade": "severe",
        "label": "\u7EA4\u7EF4\u79EF\u6C99\u69FD",
        "profile": "fibre-silt",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.42,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "fibre-knot",
            "role": "relief",
            "x": 490,
            "y": 384,
            "rotation": -0.52,
            "length": 374,
            "width": 269,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 365,
            "y": 235,
            "rotation": -0.22,
            "length": 249,
            "width": 123,
            "height": 34,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 572,
            "y": 354,
            "rotation": 0.38,
            "length": 244,
            "width": 113,
            "height": 34,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 797,
            "y": 436,
            "rotation": -0.75,
            "length": 200,
            "width": 130,
            "height": 31,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 5,
            "family": "granular-ridge",
            "role": "relief",
            "x": 678,
            "y": 552,
            "rotation": -0.44,
            "length": 273,
            "width": 106,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "film-laminate",
    "label": "\u819C\u8986\u5C42\u7247",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "film-laminate",
      "label": "\u819C\u8986\u5C42\u7247",
      "description": "\u819C\u8986\u5C42\u7247\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "strata",
      "surface": {
        "substrate": "strata",
        "coating": "strata",
        "organization": "bands",
        "coverage": 0.46,
        "wear": 0.52,
        "deposits": 0.52,
        "scale": 1.1,
        "relief": 0.52,
        "contrast": 0.75,
        "regionScale": 1.15,
        "quietness": 0.48,
        "formScale": 1.3,
        "fragmentation": 0.65,
        "accentCoverage": 0.02
      },
      "palette": {
        "void": 592137,
        "shadow": 1381653,
        "floorDeep": 2302755,
        "floor": 3421236,
        "floorLight": 4539717,
        "materialDark": 3158064,
        "materialMid": 5855577,
        "materialLight": 7895160,
        "faceLight": 10066329,
        "accentDim": 5395026,
        "accent": 11184810,
        "accentLight": 13421772,
        "peak": 15658734,
        "actorDark": 1842204,
        "actorMid": 12237498,
        "actorLight": 16777215,
        "ground": 3421236,
        "groundLight": 4539717,
        "groundDark": 2302755,
        "wall": 5855577,
        "wallLight": 10066329,
        "wallDark": 3158064
      }
    },
    "definitions": [
      {
        "id": "film-laminate-low",
        "family": "folded-slab",
        "grade": "low",
        "label": "\u819C\u8986\u5C42\u7247",
        "profile": "film-laminate",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 19,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 482,
            "y": 392,
            "rotation": 0.1,
            "length": 409,
            "width": 208,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 488,
            "y": 252,
            "rotation": -0.17,
            "length": 351,
            "width": 169,
            "height": 35,
            "thickness": 9,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "relief",
            "x": 522,
            "y": 250,
            "rotation": -0.17,
            "length": 255,
            "width": 185,
            "height": 7,
            "thickness": 2,
            "fold": 0.44,
            "branches": 4,
            "opening": 0.75,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "membrane-rim",
            "role": "solid",
            "x": 770,
            "y": 494,
            "rotation": 0.5,
            "length": 217,
            "width": 145,
            "height": 28,
            "thickness": 9,
            "fold": 0.44880000000000003,
            "branches": 4,
            "opening": 0.76,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "film-laminate-medium",
        "family": "folded-slab",
        "grade": "medium",
        "label": "\u819C\u8986\u5C42\u7247",
        "profile": "film-laminate",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 132,
        "emission": 0.55,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 482,
            "y": 392,
            "rotation": 0.1,
            "length": 409,
            "width": 208,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 488,
            "y": 252,
            "rotation": -0.17,
            "length": 351,
            "width": 169,
            "height": 35,
            "thickness": 9,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "relief",
            "x": 522,
            "y": 250,
            "rotation": -0.17,
            "length": 255,
            "width": 185,
            "height": 7,
            "thickness": 2,
            "fold": 0.5,
            "branches": 4,
            "opening": 0.75,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "membrane-rim",
            "role": "solid",
            "x": 770,
            "y": 494,
            "rotation": 0.5,
            "length": 217,
            "width": 145,
            "height": 28,
            "thickness": 9,
            "fold": 0.51,
            "branches": 4,
            "opening": 0.76,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "film-laminate-severe",
        "family": "folded-slab",
        "grade": "severe",
        "label": "\u819C\u8986\u5C42\u7247",
        "profile": "film-laminate",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 14,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "folded-slab",
            "role": "relief",
            "x": 482,
            "y": 392,
            "rotation": 0.1,
            "length": 409,
            "width": 208,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "folded-slab",
            "role": "solid",
            "x": 488,
            "y": 252,
            "rotation": -0.17,
            "length": 351,
            "width": 169,
            "height": 35,
            "thickness": 9,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "membrane-rim",
            "role": "relief",
            "x": 522,
            "y": 250,
            "rotation": -0.17,
            "length": 255,
            "width": 185,
            "height": 7,
            "thickness": 2,
            "fold": 0.55,
            "branches": 4,
            "opening": 0.75,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "membrane-rim",
            "role": "solid",
            "x": 770,
            "y": 494,
            "rotation": 0.5,
            "length": 217,
            "width": 145,
            "height": 28,
            "thickness": 9,
            "fold": 0.561,
            "branches": 4,
            "opening": 0.76,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "gel-fibre",
    "label": "\u51DD\u80F6\u88F9\u7EA4\u7EF4",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "gel-fibre",
      "label": "\u51DD\u80F6\u88F9\u7EA4\u7EF4",
      "description": "\u51DD\u80F6\u88F9\u7EA4\u7EF4\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "gel",
      "surface": {
        "substrate": "gel",
        "coating": "gel",
        "organization": "bands",
        "coverage": 0.66,
        "wear": 0.43,
        "deposits": 0.42,
        "scale": 0.95,
        "relief": 0.58,
        "contrast": 0.85,
        "regionScale": 1.1,
        "quietness": 0.5,
        "formScale": 1.5,
        "fragmentation": 0.32,
        "accentCoverage": 0.18
      },
      "palette": {
        "void": 856090,
        "shadow": 1449e3,
        "floorDeep": 2303798,
        "floor": 3158599,
        "floorLight": 4472919,
        "materialDark": 3488592,
        "materialMid": 5001839,
        "materialLight": 7173782,
        "faceLight": 10136256,
        "accentDim": 5326174,
        "accent": 7956100,
        "accentLight": 11444401,
        "peak": 14476773,
        "actorDark": 2433318,
        "actorMid": 11702376,
        "actorLight": 15584925,
        "ground": 3158599,
        "groundLight": 4472919,
        "groundDark": 2303798,
        "wall": 5001839,
        "wallLight": 10136256,
        "wallDark": 3488592
      }
    },
    "definitions": [
      {
        "id": "gel-fibre-low",
        "family": "gel-flow",
        "grade": "low",
        "label": "\u51DD\u80F6\u88F9\u7EA4\u7EF4",
        "profile": "gel-fibre",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 112,
        "emission": 0.35,
        "motion_period": 22,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 484,
            "y": 442,
            "rotation": 0.2,
            "length": 418,
            "width": 162,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 500,
            "y": 252,
            "rotation": -0.56,
            "length": 310,
            "width": 108,
            "height": 36,
            "thickness": 9,
            "fold": 0.2728,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 659,
            "y": 378,
            "rotation": 0.28,
            "length": 275,
            "width": 150,
            "height": 34,
            "thickness": 9,
            "fold": 0.5808,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 803,
            "y": 564,
            "rotation": -0.48,
            "length": 179,
            "width": 104,
            "height": 28,
            "thickness": 9,
            "fold": 0.4576,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "gel-fibre-medium",
        "family": "gel-flow",
        "grade": "medium",
        "label": "\u51DD\u80F6\u88F9\u7EA4\u7EF4",
        "profile": "gel-fibre",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 136,
        "emission": 0.55,
        "motion_period": 18,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 484,
            "y": 442,
            "rotation": 0.2,
            "length": 418,
            "width": 162,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 500,
            "y": 252,
            "rotation": -0.56,
            "length": 310,
            "width": 108,
            "height": 36,
            "thickness": 9,
            "fold": 0.31,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 659,
            "y": 378,
            "rotation": 0.28,
            "length": 275,
            "width": 150,
            "height": 34,
            "thickness": 9,
            "fold": 0.66,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 803,
            "y": 564,
            "rotation": -0.48,
            "length": 179,
            "width": 104,
            "height": 28,
            "thickness": 9,
            "fold": 0.52,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "gel-fibre-severe",
        "family": "gel-flow",
        "grade": "severe",
        "label": "\u51DD\u80F6\u88F9\u7EA4\u7EF4",
        "profile": "gel-fibre",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": -0.28,
        "light_radius": 154,
        "emission": 0.72,
        "motion_period": 16,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "gel-flow",
            "role": "relief",
            "x": 484,
            "y": 442,
            "rotation": 0.2,
            "length": 418,
            "width": 162,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "fibre-knot",
            "role": "solid",
            "x": 500,
            "y": 252,
            "rotation": -0.56,
            "length": 310,
            "width": 108,
            "height": 36,
            "thickness": 9,
            "fold": 0.341,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "gel-flow",
            "role": "solid",
            "x": 659,
            "y": 378,
            "rotation": 0.28,
            "length": 275,
            "width": 150,
            "height": 34,
            "thickness": 9,
            "fold": 0.7260000000000001,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "fibre-knot",
            "role": "solid",
            "x": 803,
            "y": 564,
            "rotation": -0.48,
            "length": 179,
            "width": 104,
            "height": 28,
            "thickness": 9,
            "fold": 0.5720000000000001,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  },
  {
    "id": "shell-grit",
    "label": "\u65AD\u58F3\u9897\u7C92\u5824",
    "iteration": 6,
    "enabled": true,
    "profile": {
      "id": "shell-grit",
      "label": "\u65AD\u58F3\u9897\u7C92\u5824",
      "description": "\u65AD\u58F3\u9897\u7C92\u5824\u7684\u539F\u751F\u6750\u6599\u4E0E\u5B8C\u6574\u641C\u64A4\u5730\u6BB5",
      "material": "glaze",
      "surface": {
        "substrate": "glaze",
        "coating": "glaze",
        "organization": "patches",
        "coverage": 0.54,
        "wear": 0.57,
        "deposits": 0.55,
        "scale": 1.2,
        "relief": 0.5,
        "contrast": 0.72,
        "regionScale": 1.4,
        "quietness": 0.55,
        "formScale": 1.6,
        "fragmentation": 0.42,
        "accentCoverage": 0.11
      },
      "palette": {
        "void": 1448997,
        "shadow": 2699322,
        "floorDeep": 7367527,
        "floor": 11182476,
        "floorLight": 12564125,
        "materialDark": 4868945,
        "materialMid": 7695973,
        "materialLight": 9799795,
        "faceLight": 13813675,
        "accentDim": 6443617,
        "accent": 8809848,
        "accentLight": 11639443,
        "peak": 15590084,
        "actorDark": 2369326,
        "actorMid": 4936539,
        "actorLight": 12750939,
        "ground": 11182476,
        "groundLight": 12564125,
        "groundDark": 7367527,
        "wall": 7695973,
        "wallLight": 13813675,
        "wallDark": 4868945
      }
    },
    "definitions": [
      {
        "id": "shell-grit-low",
        "family": "broken-shell",
        "grade": "low",
        "label": "\u65AD\u58F3\u9897\u7C92\u5824",
        "profile": "shell-grit",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 108,
        "emission": 0.35,
        "motion_period": 24,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "broken-shell",
            "role": "relief",
            "x": 452,
            "y": 406,
            "rotation": 0.35,
            "length": 341,
            "width": 239,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 341,
            "y": 224,
            "rotation": 0.28,
            "length": 188,
            "width": 151,
            "height": 31,
            "thickness": 9,
            "fold": 0.4224,
            "branches": 4,
            "opening": 0.64,
            "distortion": 0.1408
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 543,
            "y": 303,
            "rotation": 0.4,
            "length": 251,
            "width": 102,
            "height": 31,
            "thickness": 9,
            "fold": 0.35200000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          },
          {
            "id": 4,
            "family": "broken-shell",
            "role": "solid",
            "x": 786,
            "y": 452,
            "rotation": -0.55,
            "length": 226,
            "width": 162,
            "height": 36,
            "thickness": 9,
            "fold": 0.4048,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.1408
          },
          {
            "id": 5,
            "family": "granular-ridge",
            "role": "relief",
            "x": 716,
            "y": 569,
            "rotation": -0.12,
            "length": 292,
            "width": 117,
            "height": 6,
            "thickness": 2,
            "fold": 0.33440000000000003,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.1408
          }
        ],
        "erosion": [
          [
            {
              "x": 668,
              "y": 424
            },
            {
              "x": 704,
              "y": 416
            },
            {
              "x": 752,
              "y": 440
            },
            {
              "x": 744,
              "y": 464
            },
            {
              "x": 692,
              "y": 454
            }
          ]
        ]
      },
      {
        "id": "shell-grit-medium",
        "family": "broken-shell",
        "grade": "medium",
        "label": "\u65AD\u58F3\u9897\u7C92\u5824",
        "profile": "shell-grit",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 134,
        "emission": 0.55,
        "motion_period": 20,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "broken-shell",
            "role": "relief",
            "x": 452,
            "y": 406,
            "rotation": 0.35,
            "length": 341,
            "width": 239,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 341,
            "y": 224,
            "rotation": 0.28,
            "length": 188,
            "width": 151,
            "height": 31,
            "thickness": 9,
            "fold": 0.48,
            "branches": 4,
            "opening": 0.64,
            "distortion": 0.16
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 543,
            "y": 303,
            "rotation": 0.4,
            "length": 251,
            "width": 102,
            "height": 31,
            "thickness": 9,
            "fold": 0.4,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          },
          {
            "id": 4,
            "family": "broken-shell",
            "role": "solid",
            "x": 786,
            "y": 452,
            "rotation": -0.55,
            "length": 226,
            "width": 162,
            "height": 36,
            "thickness": 9,
            "fold": 0.46,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.16
          },
          {
            "id": 5,
            "family": "granular-ridge",
            "role": "relief",
            "x": 716,
            "y": 569,
            "rotation": -0.12,
            "length": 292,
            "width": 117,
            "height": 6,
            "thickness": 2,
            "fold": 0.38,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.16
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 696,
              "y": 400
            },
            {
              "x": 776,
              "y": 424
            },
            {
              "x": 804,
              "y": 464
            },
            {
              "x": 764,
              "y": 488
            },
            {
              "x": 700,
              "y": 460
            },
            {
              "x": 656,
              "y": 464
            }
          ],
          [
            {
              "x": 216,
              "y": 200
            },
            {
              "x": 288,
              "y": 176
            },
            {
              "x": 332,
              "y": 200
            },
            {
              "x": 316,
              "y": 232
            },
            {
              "x": 248,
              "y": 240
            }
          ]
        ]
      },
      {
        "id": "shell-grit-severe",
        "family": "broken-shell",
        "grade": "severe",
        "label": "\u65AD\u58F3\u9897\u7C92\u5824",
        "profile": "shell-grit",
        "cols": 32,
        "rows": 24,
        "seed": 20261002,
        "spawn_x": 196,
        "spawn_y": 588,
        "exit_x": 148,
        "exit_y": 664,
        "search_x": 516,
        "search_y": 580,
        "enemy_x": 840,
        "enemy_y": 172,
        "axis": 0.1,
        "light_radius": 155,
        "emission": 0.72,
        "motion_period": 17,
        "ground_quietness": 0.84,
        "ground_contrast": 0.5,
        "ground_coverage": 0.26,
        "ground_material_blend": 0.32,
        "instances": [
          {
            "id": 1,
            "family": "broken-shell",
            "role": "relief",
            "x": 452,
            "y": 406,
            "rotation": 0.35,
            "length": 341,
            "width": 239,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 2,
            "family": "broken-shell",
            "role": "solid",
            "x": 341,
            "y": 224,
            "rotation": 0.28,
            "length": 188,
            "width": 151,
            "height": 31,
            "thickness": 9,
            "fold": 0.528,
            "branches": 4,
            "opening": 0.64,
            "distortion": 0.17600000000000002
          },
          {
            "id": 3,
            "family": "granular-ridge",
            "role": "solid",
            "x": 543,
            "y": 303,
            "rotation": 0.4,
            "length": 251,
            "width": 102,
            "height": 31,
            "thickness": 9,
            "fold": 0.44000000000000006,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          },
          {
            "id": 4,
            "family": "broken-shell",
            "role": "solid",
            "x": 786,
            "y": 452,
            "rotation": -0.55,
            "length": 226,
            "width": 162,
            "height": 36,
            "thickness": 9,
            "fold": 0.5060000000000001,
            "branches": 4,
            "opening": 0.65,
            "distortion": 0.17600000000000002
          },
          {
            "id": 5,
            "family": "granular-ridge",
            "role": "relief",
            "x": 716,
            "y": 569,
            "rotation": -0.12,
            "length": 292,
            "width": 117,
            "height": 6,
            "thickness": 2,
            "fold": 0.41800000000000004,
            "branches": 4,
            "opening": 0.3,
            "distortion": 0.17600000000000002
          }
        ],
        "erosion": [
          [
            {
              "x": 632,
              "y": 424
            },
            {
              "x": 712,
              "y": 392
            },
            {
              "x": 824,
              "y": 424
            },
            {
              "x": 864,
              "y": 480
            },
            {
              "x": 800,
              "y": 520
            },
            {
              "x": 712,
              "y": 480
            },
            {
              "x": 664,
              "y": 504
            },
            {
              "x": 616,
              "y": 472
            }
          ],
          [
            {
              "x": 176,
              "y": 176
            },
            {
              "x": 256,
              "y": 152
            },
            {
              "x": 344,
              "y": 184
            },
            {
              "x": 352,
              "y": 224
            },
            {
              "x": 288,
              "y": 248
            },
            {
              "x": 224,
              "y": 232
            },
            {
              "x": 160,
              "y": 216
            }
          ],
          [
            {
              "x": 384,
              "y": 560
            },
            {
              "x": 456,
              "y": 544
            },
            {
              "x": 528,
              "y": 576
            },
            {
              "x": 520,
              "y": 612
            },
            {
              "x": 448,
              "y": 620
            },
            {
              "x": 392,
              "y": 592
            }
          ]
        ]
      }
    ]
  }
];

// src/generated/rift-pollution-grade-data.ts
var POLLUTION_GRADE_DEFINITIONS = [
  {
    "id": "low",
    "version": 1,
    "label": "\u4F4E\u6C61\u67D3",
    "status": "dev-masters",
    "intent": "\u6C61\u67D3\u5C40\u90E8\u4FB5\u5165\uFF1B\u5141\u8BB8\u505C\u7559\u89C2\u5BDF\u548C\u4F4E\u635F\u8017\u641C\u53D6",
    "paintCount": 2,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "infiltrate",
    "volumeCount": 1,
    "volumeSubstrate": "gas_mass",
    "volumeCoverage": "infiltrate",
    "volumeCols": 3,
    "volumeRows": 3,
    "chaosStartRate": 0.24,
    "chaosEndRate": 0.34,
    "chaosRampStartSeconds": 90,
    "chaosRampEndSeconds": 210
  },
  {
    "id": "medium",
    "version": 1,
    "label": "\u4E2D\u6C61\u67D3",
    "status": "dev-masters",
    "intent": "\u6C61\u67D3\u5206\u5E03\u5728\u591A\u5904\u8DEF\u5F84\u8FB9\uFF1B\u89C2\u5BDF\u98CE\u9669\u540E\u9009\u62E9\u7ED5\u884C\u6216\u627F\u53D7\u6C61\u67D3",
    "paintCount": 4,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "rewrite",
    "volumeCount": 2,
    "volumeSubstrate": "gas_mass",
    "volumeCoverage": "rewrite",
    "volumeCols": 4,
    "volumeRows": 3,
    "chaosStartRate": 0.42,
    "chaosEndRate": 0.6,
    "chaosRampStartSeconds": 60,
    "chaosRampEndSeconds": 180
  },
  {
    "id": "severe",
    "version": 1,
    "label": "\u91CD\u5EA6\u6C61\u67D3",
    "status": "dev-masters",
    "intent": "\u5927\u7247\u5730\u9762\u548C\u7A7A\u6C14\u5DF2\u88AB\u4FB5\u5360\uFF1B\u5145\u5206\u51C6\u5907\u540E\u77ED\u65F6\u6DF1\u5165\u5E76\u5C3D\u65E9\u64A4\u79BB",
    "paintCount": 6,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "overwrite",
    "volumeCount": 3,
    "volumeSubstrate": "gas_mass",
    "volumeCoverage": "overwrite",
    "volumeCols": 5,
    "volumeRows": 3,
    "chaosStartRate": 0.64,
    "chaosEndRate": 0.96,
    "chaosRampStartSeconds": 40,
    "chaosRampEndSeconds": 130
  }
];

// src/generation/world-study/pollution-grade.ts
var POLLUTION_GRADES = ["low", "medium", "severe"];
function isPollutionGrade(value) {
  return typeof value === "string" && POLLUTION_GRADES.some((grade) => grade === value);
}
function isPollutionGradeDefinition(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value;
  const coverage = ["infiltrate", "rewrite", "overwrite"];
  const keys = "chaosEndRate,chaosRampEndSeconds,chaosRampStartSeconds,chaosStartRate,id,intent,label,paintContinuity,paintCount,paintCoverage,paintSubstrate,status,version,volumeCols,volumeCount,volumeCoverage,volumeRows,volumeSubstrate";
  return !(!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join(",") !== keys || !isPollutionGrade(row.id) || row.version !== 1 || row.status !== "dev-masters" || typeof row.label !== "string" || !row.label.trim() || row.label.length > 40 || typeof row.intent !== "string" || !row.intent.trim() || row.intent.length > 500 || row.paintSubstrate !== "oil_film" || row.paintContinuity !== "monolith" || row.volumeSubstrate !== "gas_mass" || !coverage.includes(String(row.paintCoverage)) || !coverage.includes(String(row.volumeCoverage)) || !["paintCount", "volumeCount", "volumeCols", "volumeRows"].every((key) => typeof row[key] === "number" && Number.isInteger(row[key]) && row[key] > 0 && row[key] <= 16) || !["chaosStartRate", "chaosEndRate", "chaosRampStartSeconds", "chaosRampEndSeconds"].every((key) => typeof row[key] === "number" && Number.isFinite(row[key]) && row[key] >= 0) || row.chaosStartRate <= 0 || row.chaosEndRate < row.chaosStartRate || row.chaosEndRate > 2 || row.chaosRampEndSeconds <= row.chaosRampStartSeconds);
}

// src/generation/world-study/r100-package.ts
var equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function fingerprint(value) {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
function materialDependencies(definition) {
  const names = [.../* @__PURE__ */ new Set([definition.family, ...definition.instances.map((instance) => instance.family ?? definition.family)])].sort();
  return Object.fromEntries(names.map((name) => {
    const dependency = R100_MATERIAL_DEPENDENCIES[name];
    if (!dependency) throw new Error(`Missing native material ${name}`);
    return [name, dependency];
  }));
}
function dependencyHash(recipe, materials, revision = 2) {
  return fingerprint({
    algorithm: `r100-native@3.${revision}`,
    native: recipe.nativeDefinition,
    profile: recipe.profile,
    space: recipe.space,
    contentFragmentTypeId: recipe.contentFragmentTypeId,
    grade: recipe.gradeDefinition,
    contents: recipe.contentDefinition,
    materials
  });
}
function validR100ProductionRecipe(value) {
  try {
    if (!value || typeof value !== "object") return false;
    const recipe = value, native = recipe.nativeDefinition, pack = recipe.package;
    if (recipe.version !== 3 || recipe.paintGeometryVersion !== 2 || !Number.isSafeInteger(recipe.requestedSeed) || recipe.requestedSeed < 0 || recipe.requestedSeed > 4294967295 || !native || !isPollutionGrade(native.grade) || recipe.contentFragmentTypeId !== "frag-outdoor" || !pack || pack.algorithm !== "r100-native" || pack.version !== 3 || pack.algorithmRevision !== 1 && pack.algorithmRevision !== 2 || pack.grade !== native.grade || !/^r100-[a-z][a-z0-9-]+$/.test(pack.id) || !R100_NATIVE_WORLDS.some((world) => `r100-${world.id}` === pack.id) || !Array.isArray(native.instances) || native.instances.length < 1 || native.instances.length > 32 || !Number.isSafeInteger(native.cols) || !Number.isSafeInteger(native.rows) || native.cols < 24 || native.cols > 40 || native.rows < 18 || native.rows > 32 || !isPollutionGradeDefinition(recipe.gradeDefinition) || recipe.gradeDefinition.id !== native.grade || recipe.contentDefinition?.grade_id !== native.grade || recipe.contentDefinition.version !== 1 || recipe.profile?.id !== native.profile || JSON.stringify(recipe).length > 6e4) return false;
    const materials = materialDependencies(native), { package: _package, ...frozen } = recipe;
    return equal(pack.materials, materials) && pack.dependencyHash === dependencyHash(frozen, materials, pack.algorithmRevision);
  } catch {
    return false;
  }
}

// src/generation/legacy-rift-v2/executor.js
var __defProp2 = Object.defineProperty;
var __defNormalProp2 = (obj, key, value) => key in obj ? __defProp2(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField2 = (obj, key, value) => __defNormalProp2(obj, typeof key !== "symbol" ? key + "" : key, value);
var GAME_CONSTANTS = {
  /** Tile size in pixels */
  TILE_SIZE: 32,
  /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
  CAMERA: {
    ZOOM: 1.5
  },
  /** Player movement (docs/specs/system-movement-vision.md, section M) */
  PLAYER: {
    SPEED: 80,
    // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
    MOVE_ACCEL_TIME: 0.08,
    // s from standstill to full speed
    MOVE_DECEL_TIME: 0.1,
    // s from full speed to standstill
    FACING_TURN_RATE: 1080,
    // deg/s the vision cone swings toward the input direction
    FACING_QUANT_HYSTERESIS: 5,
    // deg of dead zone around the 45 degree facing4 boundaries
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 sprite
    SPEED_MOD_MIN: 0.5
    // floor on the multiplied speed modifier stack
  },
  /**
   * Presentation-only gait (art-direction §3.3). Does not change facingAngle,
   * facing4 snap timing, speeds, or colliders.
   */
  ACTOR_MOTION: {
    FRAME_COUNT: 4,
    TURN_MS: 180,
    LAG_PX: 3,
    LAG_ALPHA: 0.38,
    MOVE_SPEED_FLOOR: 6,
    // px/s; below this the idle cycle plays
    PLAYER_IDLE_FPS: 4,
    PLAYER_WALK_FPS: 8,
    INFILTRATOR_IDLE_FPS: 4,
    INFILTRATOR_WALK_FPS: 4,
    // puppet hitch supplies the step; keep the sheet slow
    REWRITER_IDLE_FPS: 4,
    REWRITER_WALK_FPS: 6
  },
  /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
  CHAOS: {
    START_VALUE: 0,
    MAX_VALUE: 100,
    // HUD gauge max (value CAN exceed this)
    HARD_CAP: 150,
    BASE_RATE: 0.5,
    // points per second (DEC-024: calibrated for 80 px/s travel)
    THRESHOLD_1: 50,
    THRESHOLD_2: 75,
    THRESHOLD_3: 100,
    COMBAT_BONUS: 5,
    DETECTION_BONUS: 3,
    DETECTION_BONUS_COOLDOWN: 1e4,
    // ms per-enemy cooldown on detection chaos
    CHASE_RATE_MULT: 2,
    EMIT_STEP: 1,
    // minimum delta before emitting CHAOS_CHANGED
    MODULATOR_STEP: 1
    // minimum delta before calling onModulate callback
  },
  /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
  LOOT: {
    /** 迭代 10 起退役，见 spec 规则 14。名义参数，代码无引用；由 SEARCH_RADIUS 取代。 */
    PICKUP_RADIUS: 16,
    NODE_COUNT: 8,
    VALUE_SAFE: 1,
    VALUE_CONTESTED: 2,
    VALUE_DEEP: 4,
    SEARCH_CHANNEL_MS: 1200,
    SEARCH_RADIUS: 48,
    SEARCH_NOISE_RADIUS: 96,
    SEARCH_NOISE_LEVEL: "suspicious"
  },
  /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
  EXTRACTION: {
    TRIGGER_RADIUS: 48,
    KEY: "E",
    SETTLE_DELAY_MS: 600,
    RESTART_KEY: "R"
  },
  /**
   * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
   * Models a forward cone unioned with an ambient ring, with three fixed-width edge
   * bands. The older single-radius + edge-softness model was replaced rather than
   * extended, so the two parameter sets never coexist.
   */
  VISIBILITY: {
    RADIUS_FORWARD: 224,
    // px straight ahead (7 tiles); must exceed every profile sightRange (I1)
    RADIUS_AMBIENT: 80,
    // px all around (2.5 tiles) = the lamp the player carries
    CONE_HALF_ANGLE: 50,
    // deg half-angle of the full-range sector
    CONE_FALLOFF_ANGLE: 30,
    // deg of transition from forward range down to ambient
    MIN_SOLID_RADIUS: 48,
    // px that stay fully lit no matter what
    EDGE_BAND_WIDTH: 32,
    // px per gradient band (1 tile, art-direction 4.3)
    BAND_ALPHAS: [1, 0.6, 0.2],
    // visibility of core / middle / outer band
    ERASE_ALPHAS: [1, 0.5, 0.2],
    // per-layer erase strength producing those alphas
    RAY_COUNT: 60,
    // architecture ceiling
    RAY_SPLIT_FORWARD: 40,
    // rays inside the cone sector
    RAY_SPLIT_AMBIENT: 20,
    // rays across the remaining angles
    RAY_COUNT_DEGRADED: 40,
    // first degradation step
    RAY_SPLIT_FORWARD_DEGRADED: 28,
    RAY_SPLIT_AMBIENT_DEGRADED: 12,
    MIN_RADIUS_SCALE: 0.4,
    // hard floor for the chaos radius modulator
    CACHE_POS_EPSILON: 0.5,
    // px of movement tolerated before the cache is dropped
    CACHE_ANGLE_EPSILON: 0.5,
    // deg of rotation tolerated before the cache is dropped
    BUDGET_MS: 2,
    // per-frame raycasting budget
    DEGRADE_SAMPLE_FRAMES: 30,
    // consecutive frames over budget before degrading
    /** Void outside the field of view */
    VOID_COLOR: 526860,
    VOID_NOISE_ALPHA: 0.04,
    VOID_NOISE_TILE: 64,
    // px noise texture size
    VOID_NOISE_SCROLL: 2,
    // px/s drift
    /** Warm lamp the player carries - the only warm light inside a rift */
    PLAYER_LAMP_COLOR: 9067562,
    PLAYER_LAMP_ALPHA: 0.12,
    /**
     * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
     * the vision cone by the darkness mask. This is what makes the forward cone read as
     * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
     */
    FLASHLIGHT_COLOR: 11047018,
    // pale warm; a saturated brown would wash the cold floor out
    FLASHLIGHT_ALPHA: 0.16,
    // low enough that fragment L1 (clinic/metro/soil) still reads under the cone
    FLASHLIGHT_FORWARD_FRAC: 0.34,
    // push the pool centre this fraction of forward range ahead
    FLASHLIGHT_RADIUS_FRAC: 0.85,
    // pool radius as a fraction of forward range
    /** Glow bleeding through the darkness (Slice 1: extraction point only) */
    GLOW_LEAK_ALPHA: 0.25,
    GLOW_LEAK_RADIUS: 48,
    /** Chaos corruption of the vision edge */
    CORRUPTION_COLOR: 1748374,
    CORRUPTION_MAX_MIX: 0.6,
    // alpha of the teal band at corruption 1.0
    CORRUPTION_MAX_DEPTH: 0.35,
    // fraction of the range teal can eat at corruption 1.0
    CORRUPTION_JITTER_PX: 4,
    CORRUPTION_JITTER_HZ: 6,
    /**
     * Overflow (chaos > 100) full-screen teal wash. Persistent base stays well below the
     * old 0.08 epilepsy cap; the jump is a discrete ~2 s pulse (not a strobe), so its
     * peak can read as a "skip" without a rapid flash train.
     */
    FLICKER_BASE_ALPHA: 0.05,
    FLICKER_JUMP_ALPHA: 0.16,
    FLICKER_JUMP_PERIOD_MS: 2200,
    FLICKER_JUMP_WIDTH_MS: 140,
    /** Extra teal bite / edge jitter scale at screenFlicker = 1.0 */
    OVERFLOW_CORRUPTION_DEPTH_BOOST: 0.4,
    OVERFLOW_JITTER_BOOST: 1,
    /** Purification point overrides (omni mode) */
    PURIFY_RADIUS: 400,
    PURIFY_RAY_COUNT: 90
  },
  /**
   * Enemy AI (docs/specs/system-enemy-ai.md, "数值结构"). Every AI number lives here;
   * none are inlined in the systems.
   *
   * Six of these values are load-bearing relations rather than free parameters - the
   * balance invariants I1-I6 that make stealth playable at all. `config/invariants.ts`
   * asserts them at boot so tuning cannot silently break one.
   *
   * The old `SIGHT_ANGLE: 90 // cone half-angle` key was removed rather than kept: its
   * meaning split into a core cone and a peripheral band, and three overlapping angle
   * parameters would have been three ways to be wrong.
   */
  AI: {
    // --- movement and body (shared; per-role speeds live in data/enemies.csv) ---
    TURN_RATE: 360,
    // deg/s; a third of the player's, which is what makes flanking work (I6)
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 infiltrator sprite
    SEPARATION_RADIUS: 24,
    // px; soft repulsion instead of enemy-vs-enemy physics
    SEPARATION_WEIGHT: 0.35,
    // how strongly separation bends the movement direction
    STANDOFF_DISTANCE: 30,
    // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
    STANDOFF_BAND: 4,
    // px of tolerance around it (26..34)
    STANDOFF_ADJUST_SPEED: 60,
    // px/s used to back off when the player crowds it
    // --- perception (shared; cone / hearing radii / weights live in data/enemies.csv) ---
    DETECT_FILL_TIME: 0.45,
    // s of clear sight to go from 0 to certain; then × visionWeight
    HEAR_FILL_TIME: 2,
    // s of hearing fill baseline; then × hearingWeight × moveMult
    HEARING_STILL_CAP: 0.2,
    // still-hearing cannot push detection past this (below 0.35)
    HEAR_ALERT_THRESHOLD: 0.7,
    // rewriter T0-4b: hearing can push to ALERT, never CHASE
    DETECT_DIST_FACTOR_NEAR: 1.6,
    // detection rate multiplier at point blank
    DETECT_DIST_FACTOR_FAR: 0.5,
    // ...and at the edge of sight range
    DETECT_ZONE_FACTOR_PERIPH: 0.45,
    // peripheral vision fills far slower than the core cone
    SUSPICION_THRESHOLD: 0.35,
    // detection at which it stops and turns - the player's warning
    REACQUIRE_THRESHOLD: 0.5,
    // lower bar to re-lock while already searching
    DETECT_DECAY_RATE: 0.67,
    // per s; ~1.5 s to clear after breaking sight
    DETECT_DECAY_ALERT_SCALE: 0.5,
    // decays half as fast while searching: it is holding a grudge
    HEARING_JITTER: 32,
    // px of positional fuzz, so hearing is not a wall-hack locator
    PERCEPTION_TICK_MS: 100,
    // 10 Hz perception; one raycast per enemy per tick
    PERCEPTION_TICK_MS_FAR: 200,
    // 5 Hz beyond ACTIVE_RANGE (rule N8)
    // --- timers (section "计时器") ---
    LOS_GRACE_MS: 400,
    // how long a chase survives with no line of sight
    LOST_PLAYER_DURATION: 5e3,
    // ms of ALERT searching
    ALERT_DURATION: 3e3,
    // ms a SUSPICIOUS enemy stays wary with no new stimulus
    CHASE_ABANDON_RANGE: 320,
    // px past which an unseen chase is given up
    WAYPOINT_PAUSE_MS: 1200,
    // dwell at a patrol waypoint - the player's window to slip past
    SCAN_HOLD_MS: 600,
    // dwell on each scan heading
    SEARCH_HOLD_MS: 800,
    // dwell at each ALERT search point
    EXTRAPOLATE_SEC: 0.6,
    // how far ahead of the last sighting to guess - punishes running straight
    SEARCH_SPREAD: 96,
    // px radius of the random third search point
    ALERT_EMIT_COOLDOWN_MS: 1e3,
    // suppression window for repeated same-level ENEMY_ALERT
    SUSPICIOUS_TURN_HOLD_MS: 200,
    // minimum standstill when turning to look (rule B2, ">= 0.2 s")
    SCAN_SWEEP_ANGLE: 45,
    // deg to each side when scanning in place
    SCAN_SWEEP_PERIOD_MS: 1500,
    // full left-right-left sweep period
    FACING_ARRIVE_EPSILON: 6,
    // deg within which a turn counts as completed
    // --- pathfinding and performance (section "寻路与性能") ---
    MAX_PATHS_PER_FRAME: 1,
    // architecture hard rule
    REPATH_INTERVAL_MS: 500,
    REPATH_INTERVAL_MS_FAR: 1e3,
    // for requests past SIMPLE_PATH_RANGE (rule N5)
    REPATH_MOVE_THRESHOLD: 48,
    // px of target movement that earns an early chase repath
    SIMPLE_PATH_RANGE: 384,
    // px past which a request drops to the lowest priority
    ASTAR_MAX_NODES: 3e3,
    // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
    PATH_FAIL_LIMIT: 3,
    // consecutive failures before giving up on the goal
    ACTIVE_RANGE: 640,
    // px; beyond this the FSM runs at 5 Hz and never asks for a path
    ARRIVE_EPSILON: 8,
    // px within which a path point counts as reached
    MAX_ACTIVE_ENEMIES: 8,
    // Slice 1 uses 4; more than this means the map data is wrong
    MAX_PATH_POINTS: 64,
    // capacity of a per-enemy dynamic path buffer
    DT_CLAMP_MS: 100,
    // stops a backgrounded tab from teleporting enemies on return
    /**
     * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
     * clear sight line does not prove a 20 px body fits through the diagonal seam it
     * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
     * symptom (wanting to move but not moving) and fall back to a real path.
     */
    STUCK_REPATH_MS: 400,
    STUCK_PATH_PREFERENCE_MS: 2e3,
    // how long a stuck enemy keeps preferring A* over straight lines
    STUCK_PROGRESS_FRACTION: 0.25,
    // actual/desired speed below which we count as stuck
    // --- placeholder presentation (section "占位期表现", art-direction 12) ---
    BODY_COLOR: 13386820,
    // "low tier enemy"; encodes tier, never state
    INDICATOR_COLOR: 2811592,
    // contamination teal; state lives here
    SUSPICIOUS_BREATH_HZ_MIN: 1.5,
    // breathing rate at the suspicion threshold...
    SUSPICIOUS_BREATH_HZ_MAX: 3,
    // ...and at full certainty (rule R3)
    ALERT_BLINK_HZ: 3,
    // blinking = searching
    AFTERIMAGE_INTERVAL_MS: 100,
    AFTERIMAGE_LIFETIME_MS: 300,
    AFTERIMAGE_ALPHA: 0.3,
    AFTERIMAGE_SLOTS: 4,
    // ring buffer per enemy; lifetime/interval + 1
    /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
    DEBUG_SHOW_VISION_CONE: false
  },
  /** Map generation */
  MAP: {
    WIDTH: 80,
    // tiles (larger to accommodate multiple fragments)
    HEIGHT: 80,
    // tiles
    /** Voronoi partitioning */
    FRAGMENT_COUNT_MIN: 4,
    FRAGMENT_COUNT_MAX: 6,
    FRAGMENT_MIN_AREA: 150,
    // minimum tiles per fragment
    /** Cellular automata */
    CA_ITERATIONS: 5,
    // smoothing passes
    CA_WALL_THRESHOLD: 4,
    // cells with >= N wall neighbors become wall
    CA_INITIAL_FILL: 0.45,
    // initial random fill ratio (lower = more open)
    /** Fracture connections between fragments */
    FRACTURE_WIDTH: 2,
    // tiles (narrow passage width)
    FRACTURE_MAX_PER_EDGE: 2
    // max connections between two adjacent fragments
  },
  /**
   * Slice 6 C1 land outline. Rectangular tile buffer; walkable land must not fill it.
   * 80×80 MAP.* numbers stay architecture placeholders — do not use them for this generator.
   */
  GENERATION: {
    BUFFER_COLS: 64,
    BUFFER_ROWS: 42,
    MAX_OUTLINE_ATTEMPTS: 28,
    LAND_FILL_MIN: 0.24,
    LAND_FILL_MAX: 0.48,
    BORDER_RING: 2,
    /** Fraction of the outer ring that may be land. Higher = island hugging the rectangle. */
    BORDER_OCCUPANCY_MAX: 0.12,
    /** Land / axis-aligned bbox. Circles sit near 0.78; filled rectangles sit near 1. */
    BBOX_FILL_MAX: 0.8,
    /**
     * Share of land cells that touch void. Large blobs naturally sit lower;
     * this only rejects near-solid blocks (a 1-cell frame around a filled rect).
     */
    ROUGHNESS_MIN: 0.08,
    /** bbox must leave at least this many leftover cells on width+height combined. */
    MIN_BBOX_SLACK: 8,
    MAX_EDGES_TOUCHING: 3,
    MAX_RUIN_ATTEMPTS: 40,
    MIN_FEATURE_SEPARATION: 7,
    WALL_RATIO_MIN: 0.018,
    WALL_RATIO_MAX: 0.22,
    /** Largest leftover open rectangle (tiles). Bigger than this reads as an empty plaza. */
    YARD_AREA_MAX: 64
  },
  /** Purification point (docs/specs/system-purification-impact.md) */
  PURIFICATION: {
    /** Spatial layout */
    MAP_COLS: 14,
    // tiles
    MAP_ROWS: 12,
    // tiles
    INTERACTION_RADIUS: 32,
    // pixels for module/rift-entrance interaction
    /** Module state */
    MODULE_INITIAL_HP: 70,
    /** Tier-0 repair cap / effect denominator baseline (DEC-064). */
    MODULE_BASE_MAX_HP: 100,
    /** Alias of MODULE_BASE_MAX_HP so older call sites still compile. */
    MODULE_MAX_HP: 100,
    /** Each thicken tier adds this many maxHp to every module. */
    MODULE_MAX_HP_PER_TIER: 15,
    /** Highest purchasable thicken tier (maxHp = 100 + 15*3 = 145). */
    MODULE_MAX_HP_TIERS: 3,
    // Thickening purchase costs are authored alongside all other growth steps
    // in data/growth-route.csv, not a separate system-constant price ladder.
    /** All three module effects use this HP reference; thickening does not raise it. */
    MODULE_EFFECT_HP_REF: 100,
    /** Starting chaos when purifier hp = 0 (full integrity → 0). */
    CHAOS_HARD_START: 50,
    REPAIR_PER_KINDLING: 4,
    // 1 kindling = this many hp (tuned for scarcity)
    /** Impact system (intensity now driven by TideSystem, see TIDE constants) */
    BASE_IMPACT_DAMAGE: 30,
    THREAT_FOCUS_RATIO: 0.65,
    // primary target gets this fraction of total damage
    FORECAST_ACCURACY: 0.8,
    // particle prediction accuracy
    /** combust defense mechanic (DEC-030): fixed threshold, not derived from
     * BASE_IMPACT_DAMAGE, so tide-driven damage swings don't shift the trigger point.
     * Value chosen to equal ~2x BASE_IMPACT_DAMAGE(30) per the CSV's "约等于2次满额冲击". */
    COMBUST_BURN_THRESHOLD: 60,
    /** Module effects */
    MAX_CORE_REDUCTION: 0.3,
    // chaosRate reduction at full hp
    MAX_STORAGE_BONUS: 0.5,
    // kindling value bonus at full hp
    /** resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%".
     * A flat bump to both caps above while at least one resonate sits in a defense slot -
     * not a multiplier, so it reads the same way the CSV states it ("+10%" alongside two
     * numbers already expressed as flat percentages). "不叠加" is enforced by storing this
     * as a single on/off flag (`GameState.isResonateBonusActive()`), not a per-item count. */
    RESONATE_MODULE_CAP_BONUS: 0.1,
    /** siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍(1薪柴=8hp)" - same
     * "装备期间" derivation pattern as RESONATE_MODULE_CAP_BONUS above (owned by
     * `ContaminantSystem.syncRepairEfficiencyMult()` + `GameState`, not a per-impact
     * defense-engine effect), since the CSV names it a standing equip-state bonus rather
     * than a one-impact trigger. 4 (REPAIR_PER_KINDLING) * 2.0 = 8, matching the CSV. */
    SIPHON_REPAIR_EFFICIENCY_MULT: 2,
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 50,
      // active boundary particles
      PARTICLE_ALPHA_MIN: 0.06,
      PARTICLE_ALPHA_MAX: 0.25,
      PARTICLE_SPEED: 8,
      // px/s slow inward drift
      APPARITION_INTERVAL_MIN: 8e3,
      // ms
      APPARITION_INTERVAL_MAX: 15e3,
      APPARITION_DURATION: 3e3,
      // ms (0.5s fade in + 2s hold + 0.5s fade out)
      APPARITION_MAX_SIMULTANEOUS: 3
    },
    /** Dynamic boundary shape (polar pressure blob) */
    BOUNDARY: {
      SHRINK_AT_MAX_INTENSITY: 0.72,
      // tideScale at intensity 3.0 (boundary loses up to 28%)
      PRESSURE_PRIMARY_AMP: 0.2,
      // max inward push fraction (primary Gaussian lobe)
      PRESSURE_SECONDARY_AMP: 0.1,
      // secondary lobe amplitude
      PRESSURE_LOBE_SIGMA: 0.7,
      // radians; width of each Gaussian lobe
      PRESSURE_CREST_BONUS: 0.4,
      // +40% amplitude during crest phase
      PRESSURE_EBB_FACTOR: 0.6,
      // amplitude multiplier during ebb phase
      SAFE_MARGIN_TILES: 1,
      // minimum distance from any interaction point to boundary
      GRADIENT_INNER_START: 0.8,
      // fraction of R where darkening begins
      GRADIENT_MEMBRANE_START: 0.95,
      // fraction where "membrane" teal band begins
      GRADIENT_OUTER_END: 1.15,
      // fraction where full void begins
      /**
       * B4 (Slice 5): the old BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT
       * keys described a single global sinusoidal pulse from a "whole-boundary breathing"
       * design that DEC-028 (Slice 4.5) replaced with localized pressure impacts
       * (`src/systems/boundary-breath.ts`). Those 5 keys had zero consumers and were
       * removed; this nested object holds boundary-breath.ts's real tuning knobs
       * (previously inlined as top-of-file `const`s there) instead. Values unchanged.
       */
      BREATH: {
        SAMPLE_COUNT: 72,
        // angular resolution of the membrane/impact draw
        MAX_IMPACTS: 5,
        // max simultaneous localized impacts
        ARC_HALF_MIN: 0.4,
        // rad; narrowest impact arc half-width
        ARC_HALF_MAX: 0.8,
        // rad; widest impact arc half-width
        SPAWN_DIST_MIN: 14,
        // px; closest impact spawn distance outside the membrane
        SPAWN_DIST_MAX: 30,
        // px; farthest impact spawn distance
        IMPACT_DURATION_MIN: 1800,
        // ms; shortest single-impact lifetime
        IMPACT_DURATION_MAX: 3500,
        // ms; longest single-impact lifetime
        SPAWN_INTERVAL_MIN: 400,
        // ms; shortest gap between new impacts
        SPAWN_INTERVAL_MAX: 1200,
        // ms; longest gap between new impacts (x0.6 during crest)
        WAVE_COLOR: 936511,
        // dark desaturated teal, the inbound wave arcs
        MEMBRANE_COLOR: 1735274,
        // the boundary membrane line itself
        DEFORM_MAX_PX: 8
        // px; max inward push of the membrane at impact center
      }
    },
    /** Scene transition timing */
    IMPACT_RESULT_DISPLAY_MS: 2e3,
    SCENE_TRANSITION_DELAY_MS: 600
  },
  /**
   * Combat (docs/specs/system-combat.md, "数值结构"). Every combat number lives here.
   *
   * The system is a price list, not a fight: the point is that the player can work out
   * what swinging costs before swinging. Three of these relations carry that promise and
   * are asserted at boot by `config/invariants.ts` (K1/K2/K3/K5) - notably
   * `ENEMY_MAX_HEALTH` being an exact multiple of `PLAYER_DAMAGE`, which is what makes
   * "three hits" a fact rather than an average.
   *
   * When combat turns out too cheap in playtesting, the spec's tuning order is
   * `CHAOS.COMBAT_BONUS` and `NOISE_HIT_RADIUS` first, `ENEMY_MAX_HEALTH` second, and
   * `PLAYER_DAMAGE` never (weakening it makes combat expensive *and* unpleasant).
   */
  COMBAT: {
    // --- player attack (section "玩家攻击") ---
    PLAYER_DAMAGE: 25,
    ATTACK_COOLDOWN: 500,
    // ms, counted from the input instant, parallel to the phases
    ATTACK_RANGE: 40,
    // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
    ATTACK_HALF_ANGLE: 60,
    // deg -> a 120 deg forward sector
    ATTACK_WINDUP_MS: 100,
    // the player's side of the commitment
    ATTACK_ACTIVE_MS: 50,
    // ~3 frames; exists to tolerate frame jitter, not to widen the hit
    ATTACK_RECOVERY_MS: 70,
    ATTACK_SLOW_MS: 220,
    // derived: windup + active + recovery (asserted, not free)
    ATTACK_SELF_SLOW: 0.35,
    // move speed while swinging - the "cost" that lands on feel
    ATTACK_MIN_ANGLE_BYPASS: 16,
    // px within which the angle test is meaningless and skipped
    /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
    ATTACK_KEY: "SPACE",
    // --- infiltrator (section "敌人（渗透体）") ---
    ENEMY_MAX_HEALTH: 75,
    // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
    ENEMY_DAMAGE_BASE: 15,
    ENEMY_ATTACK_RANGE: 38,
    // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
    ENEMY_ATTACK_HALF_ANGLE: 60,
    // deg; symmetric with the player's
    ENEMY_ATTACK_WINDUP_MS: 350,
    // the player's dodge window - the whole of "controllable" (K3)
    ENEMY_ATTACK_COOLDOWN_MS: 1200,
    ENEMY_FIRST_ATTACK_DELAY_MS: 300,
    // "caught up with you" and "hit you" stay two events
    ENEMY_ATTACK_TOKENS: 2,
    // enemies allowed in windup at once; caps unavoidable damage
    ENEMY_HIT_FLASH_MS: 80,
    ENEMY_DEATH_FX_MS: 180,
    // presentation only; the enemy is gone from logic at 0 ms
    // --- player health and hits (section "玩家生命值与受击") ---
    PLAYER_IFRAME_MS: 400,
    // stops two enemies resolving on one frame for 30 damage
    PLAYER_HIT_FLASH_MS: 100,
    // --- noise: the exposure half of the price (section "噪声") ---
    NOISE_SWING_RADIUS: 96,
    // px (3 tiles), 'suspicious' - a whiff is heard, not billed
    NOISE_HIT_RADIUS: 160,
    // px (5 tiles), 'alert' - the main reason a fight is loud
    NOISE_KILL_RADIUS: 192,
    // px (6 tiles), 'alert'
    /**
     * Placeholder presentation (spec V2). White is on loan here: it currently means
     * "player / extraction point" in art-direction 12, and using thin white lines and
     * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
     * Treat these as stand-ins, not as the visual language.
     */
    FX_COLOR: 16777215,
    ATTACK_FAN_FX_MS: 60,
    // how long the swing outline stays up (spec V2)
    PLAYER_FLASH_PAD: 6,
    // px the hit flash overshoots the body; see report on white-on-white
    FX_POOL_SIZE: 12
    // preallocated flash/death sprites: 8 enemies + headroom
  },
  /**
   * Contamination lexicon (DEC-076). Morph tables stay in CSV.
   * These are system constants: core HP, chaos prices, draw retry, encounter timing.
   */
  CONTAMINATION: {
    CORE_MAX_HEALTH: 50,
    ADJACENT_STRIKE_DAMAGE: 15,
    ADJACENT_STRIKE_WINDUP_MS: 350,
    PAINT_STEP_CHAOS_REST: 2,
    PAINT_STEP_CHAOS_INFLATED: 4,
    VOLUME_CHAOS_PER_SEC: 1,
    VOLUME_SIGHT_MULT: 0.7,
    DRAW_RETRY_LIMIT: 12,
    ENCOUNTER_COOLDOWN_MS: 6e4,
    ENCOUNTER_GAP_MS: 2500,
    ENCOUNTER_HOLD_MS: 2500,
    VOLUME_DEPTH: 40,
    COLONY_NUCLEUS_COUNT_MIN: 2,
    COLONY_NUCLEUS_COUNT_MAX: 3,
    COLONY_NUCLEUS_MIN_TILE_GAP: 3
  },
  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5
  },
  /** Tide system (docs/specs/system-growth-tide.md, section T) */
  TIDE: {
    TIDES: [
      { floor: 1, peak: 1.6, riseCycles: 3, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.2 },
      { floor: 1.2, peak: 2, riseCycles: 4, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.5 },
      { floor: 1.5, peak: 2.4, riseCycles: 4, crestCycles: 2, ebbCycles: 2, ebbTarget: 1.8 },
      { floor: 1.8, peak: 2.8, riseCycles: 4, crestCycles: 2, ebbCycles: 3, ebbTarget: 2 },
      { floor: 2, peak: 3, riseCycles: 5, crestCycles: Infinity, ebbCycles: 0, ebbTarget: 2 }
    ],
    CREST_CHARGE_COST: 3,
    // impact charge cost during Crest phase
    NORMAL_CHARGE_COST: 1,
    // impact charge cost during Rise/Ebb phases
    TRANSFORM_THRESHOLD: 3
    // charges needed to transform defense -> tool
  },
  // Growth / permanent upgrades (docs/specs/system-growth-tide.md, section G):
  // Definitions come from data/upgrades.csv; all step costs come from
  // data/growth-route.csv (including thickening). Both generate upgrade-data.ts
  // under the CSV source rule — no constants block here
  // by design; growth-system.ts reads UPGRADE_DATA directly.
  /** Contaminant system (docs/specs/system-growth-tide.md, section CN) */
  CONTAMINANT: {
    NODES_PER_MAP: 3,
    // contaminant pickup nodes per rift map
    RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
    DEFENSE_SLOTS: 1,
    // base slot; each growth_defense_slot level adds +1
    SORTIE_SLOTS: 3,
    // base slots (2 active + 1 passive); growth_sortie_slot adds +1 active
    MAX_DEFENSE_SLOTS: 4,
    // DEFENSE_SLOTS + max growth_defense_slot bonus (maxLevel 3)
    MAX_SORTIE_SLOTS: 4,
    // SORTIE_SLOTS + max growth_sortie_slot bonus (maxLevel 1)
    USES: { common: 5, fine: 3, rare: 2 },
    // uses remaining after transformation
    /** echo defense mechanic: "单件因此最多+2" — per-tool cap on echo bonus grants. */
    ECHO_MAX_TOOL_USE_BONUS: 2,
    /**
     * Hotkeys for the active sortie slots, in slot order. The passive slot (always the
     * last unlocked slot, see `contaminantSystem.getSortiePassiveSlotIndex()`) never gets
     * an entry here - it has no hotkey by design. G was picked for the 3rd slot
     * (growth_sortie_slot, Slice 5 T5) because it sits directly beside F on the keyboard,
     * the same "one key past the movement cluster" reach as Q/F already use, and every
     * other neighbour (E/R/T) is already taken by extraction/restart/nothing-reserved-but-
     * awkward. Single source of truth for both the RiftScene binding and any UI that needs
     * to render the real key label.
     */
    SORTIE_ACTIVE_KEYS: ["Q", "F", "G"]
  },
  /** Purification stability (docs/specs/system-growth-tide.md, section S) */
  STABILITY: {
    MAX: 100,
    GAIN_EXTRACT: 1,
    // successful extraction (calibrated: ~35 cycles to cap)
    GAIN_GROWTH: 1,
    // purchased an upgrade
    GAIN_CREST_SURVIVED: 3,
    // survived a full Crest with no module at zero
    GAIN_TIDE_ADVANCE: 5,
    // tide advanced to next number
    LOSS_MODULE_ZERO: -1
    // a module reached 0 hp
  },
  /**
   * Fine/Rare active+passive tool numbers not already carried by
   * `src/generated/contaminant-data.ts` (radius/duration/uses read straight from the CSV
   * at the point of use instead of being re-hardcoded here - see `docs/design-notes/
   * slice3-sortie-tools.md`). Everything below is either a multiplier/amount the CSV
   * description states in prose (`data/contaminants.csv`, `description_tool` column) or,
   * where flagged, a placeholder-tier number the CSV leaves unspecified (Slice 5 T1).
   */
  TOOLS: {
    /** compress: "半径2格内敌人移速-60%" */
    COMPRESS_SPEED_MULT: 0.4,
    /** resonate: "弹回3格并眩晕2秒" */
    RESONATE_KNOCKBACK_PX: 96,
    RESONATE_STUN_MS: 2e3,
    /** overwrite: "感知范围缩小50%" */
    OVERWRITE_PERCEPTION_MULT: 0.5,
    /** combust: "感知范围-50%"(烈焰遮蔽视线) */
    COMBUST_PERCEPTION_MULT: 0.5,
    /** combust: "每秒受到持续伤害" - CSV gives no amount; placeholder tuned so an enemy
     * that stays the full 8s duration dies (75 hp / 15 = 5 ticks), matching the tool's
     * rare-tier power level. Flagged for design confirmation (see delivery report). */
    COMBUST_DAMAGE_PER_TICK: 15,
    COMBUST_TICK_MS: 1e3,
    /** mirror: "被敌人接触后碎裂消失" - CSV gives no contact radius; placeholder tuned to
     * roughly one enemy body width. Flagged for design confirmation. */
    MIRROR_CONTACT_RADIUS: 20,
    /** abyss: "使用后5秒内混乱增速+50%" - a second timing value the CSV's single
     * `tool_duration_ms` column cannot carry (that field holds the 10s reveal instead). */
    ABYSS_CHAOS_BOOST_MULT: 1.5,
    ABYSS_CHAOS_BOOST_MS: 5e3,
    /** siphon: "吸取2点薪柴且...混乱值增速减半" */
    SIPHON_KINDLING_GAIN: 2,
    SIPHON_CHAOS_REDUCTION_MULT: 0.5
  },
  /** Persistent save (docs/specs/system-growth-tide.md, section P) */
  SAVE: {
    KEY: "coh-save-v1",
    VERSION: 2
  }
};
var RIFT_FRAGMENT_DATA = {
  "frag-outdoor": {
    id: "frag-outdoor",
    displayName: "\u6237\u5916\u571F\u58E4",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 4,
    jogAmp: 1,
    gapCount: 0,
    gapPlacement: "",
    turnCount: 0,
    turnCorner: "",
    capKind: "stub",
    facingPolicy: "random",
    join: "single",
    surfaceMaterial: "soil",
    enabled: true,
    floorBv: 26,
    floorBiasR: 0.88,
    floorBiasG: 1.02,
    floorBiasB: 0.82,
    stainKey: "frag-outdoor",
    stainThreshold: 0.72,
    stainStrength: 0.4,
    grimeAmp: 0.5,
    macroAmp: 0.32,
    scratchPer1000px2: 0.55,
    fleckPer1000px2: 1.25,
    scratchAngle: "free",
    scratchDispersion: 0,
    wallBv: 24,
    wallBiasR: 1,
    wallBiasG: 0.88,
    wallBiasB: 0.75,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 12,
    featureCountMax: 24
  },
  "frag-clinic": {
    id: "frag-clinic",
    displayName: "\u533B\u9662\u5B9E\u9A8C\u5BA4",
    coverage: "remnant",
    massGrammar: "enclosure",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "end",
    turnCount: 2,
    turnCorner: "right",
    capKind: "none",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "tile",
    enabled: true,
    floorBv: 28,
    floorBiasR: 0.86,
    floorBiasG: 0.92,
    floorBiasB: 1.08,
    stainKey: "shadow-grey",
    stainThreshold: 0.78,
    stainStrength: 0.25,
    grimeAmp: 0.28,
    macroAmp: 0.18,
    scratchPer1000px2: 0.7,
    fleckPer1000px2: 0.55,
    scratchAngle: "orthogonal",
    scratchDispersion: 0,
    wallBv: 30,
    wallBiasR: 0.82,
    wallBiasG: 0.9,
    wallBiasB: 1.05,
    featureWidthTiles: 1,
    featureLengthTiles: 5,
    featureCountMin: 14,
    featureCountMax: 22
  },
  "frag-metro": {
    id: "frag-metro",
    displayName: "\u5730\u94C1\u5DE5\u4E1A",
    coverage: "remnant",
    massGrammar: "slab",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "center",
    turnCount: 0,
    turnCorner: "",
    capKind: "pier",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "metal",
    enabled: true,
    floorBv: 24,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "brick-dark",
    stainThreshold: 0.68,
    stainStrength: 0.35,
    grimeAmp: 0.42,
    macroAmp: 0.28,
    scratchPer1000px2: 0.45,
    fleckPer1000px2: 0.9,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.15,
    wallBv: 26,
    wallBiasR: 1.1,
    wallBiasG: 0.82,
    wallBiasB: 0.68,
    featureWidthTiles: 2,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-library": {
    id: "frag-library",
    displayName: "\u65E7\u56FE\u4E66\u9986",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 6,
    jogAmp: 1,
    gapCount: 2,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "none",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "wood",
    enabled: true,
    floorBv: 26,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-library",
    stainThreshold: 0.6,
    stainStrength: 0.3,
    grimeAmp: 0.34,
    macroAmp: 0.2,
    scratchPer1000px2: 0.8,
    fleckPer1000px2: 0.7,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.35,
    wallBv: 24,
    wallBiasR: 1.02,
    wallBiasG: 0.93,
    wallBiasB: 0.68,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-residential": {
    id: "frag-residential",
    displayName: "\u5C45\u6C11\u533A\u516C\u5BD3",
    coverage: "remnant",
    massGrammar: "cluster",
    jogPeriod: 2,
    jogAmp: 1,
    gapCount: 3,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "widen",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "plaster",
    enabled: false,
    floorBv: 28,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-residential",
    stainThreshold: 0.7,
    stainStrength: 0.3,
    grimeAmp: 0.38,
    macroAmp: 0.24,
    scratchPer1000px2: 0.4,
    fleckPer1000px2: 0.4,
    scratchAngle: "orthogonal",
    scratchDispersion: 0.6,
    wallBv: 30,
    wallBiasR: 1.02,
    wallBiasG: 0.96,
    wallBiasB: 0.79,
    featureWidthTiles: 2,
    featureLengthTiles: 5,
    featureCountMin: 18,
    featureCountMax: 24
  }
};
var ENABLED_RIFT_FRAGMENTS = Object.values(RIFT_FRAGMENT_DATA).filter((row) => row.enabled);
var PALETTE_HEX = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE = PALETTE_HEX.map(hexToRgb);
var TEAL_FAMILY_HEX = [
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#b0fff5",
  "#4adf8a",
  "#1a7a9a"
];
var TEAL_FAMILY = TEAL_FAMILY_HEX.map(hexToRgb);
var TEAL_FAMILY_SET = new Set(TEAL_FAMILY_HEX);
var TEAL_SUBSET_DEEP_MID_HEX = ["#0e4a3f", "#1a6b5c", "#1a7a9a"];
var TEAL_SUBSET_CORE_HEX = ["#1aad96"];
var TEAL_SUBSET_GLOW_HEX = ["#2ae6c8"];
var TEAL_SUBSET_DEEP_MID = TEAL_SUBSET_DEEP_MID_HEX.map(hexToRgb);
var TEAL_SUBSET_CORE = TEAL_SUBSET_CORE_HEX.map(hexToRgb);
var TEAL_SUBSET_GLOW = TEAL_SUBSET_GLOW_HEX.map(hexToRgb);
var L3_WARM_HEX = ["#8a5c2a", "#c4873a"];
var L4_GLOW_HEX = ["#e0a848"];
var UI_HEX = ["#8a8f96", "#c8cdd4", "#2a2d32", "#0f1114"];
var DANGER_HEX = ["#cc3333"];
var WARNING_HEX = ["#b89040"];
var DEBRIS_HEX = ["#50463c", "#5d483e", "#4f4835"];
var DEBRIS_HEX_SET = new Set(DEBRIS_HEX);
var L1_EXCLUDED_HEX = /* @__PURE__ */ new Set([
  ...TEAL_FAMILY_HEX,
  ...L3_WARM_HEX,
  ...L4_GLOW_HEX,
  ...UI_HEX,
  ...DANGER_HEX,
  ...WARNING_HEX
]);
var L1_MEAN_MAX = 55;
function hexToRgb(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function meanRgb(rgb) {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}
function temperatureGroup(r, g, b) {
  if (r - b >= 6) return "WARM";
  if (b - r >= 6) return "COOL";
  if (g >= r + 2 && g >= b + 2) return "OLIVE";
  return "NEUTRAL";
}
function buildL1Pools() {
  const pools = {
    WARM: [],
    COOL: [],
    OLIVE: [],
    NEUTRAL: []
  };
  for (let i = 0; i < PALETTE_HEX.length; i++) {
    const hex = PALETTE_HEX[i];
    if (L1_EXCLUDED_HEX.has(hex)) continue;
    const rgb = PALETTE[i];
    if (meanRgb(rgb) > L1_MEAN_MAX) continue;
    pools[temperatureGroup(rgb[0], rgb[1], rgb[2])].push(rgb);
  }
  return pools;
}
var L1_POOL_MUTABLE = buildL1Pools();
var L1_POOL = {
  WARM: L1_POOL_MUTABLE.WARM,
  COOL: L1_POOL_MUTABLE.COOL,
  OLIVE: L1_POOL_MUTABLE.OLIVE,
  NEUTRAL: L1_POOL_MUTABLE.NEUTRAL
};
var PALETTE_HEX2 = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE2 = PALETTE_HEX2.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
]);
var PALETTE_WITHOUT_DEBRIS = PALETTE2.filter(
  (_rgb, i) => !DEBRIS_HEX_SET.has(PALETTE_HEX2[i])
);
var PALETTE_HEX_SET = new Set(PALETTE_HEX2.map((h) => h.toLowerCase()));
var CLUSTER_TEAL_RGB = [
  ...TEAL_SUBSET_DEEP_MID,
  ...TEAL_SUBSET_CORE,
  ...TEAL_SUBSET_GLOW
];
var RETRY = GAME_CONSTANTS.CONTAMINATION.DRAW_RETRY_LIMIT;
var ENEMY_DATA = {
  infiltrator: {
    role: "infiltrator",
    displayName: "\u6E17\u900F\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 55,
    sightRangePeriph: 90,
    sightHalfAnglePeriph: 90,
    chaseSightRange: 210,
    hearingRange: 100,
    hearingMoveMult: 1,
    hearingStillRange: 0,
    hearingWallFactor: 0.6,
    visionWeight: 1,
    hearingWeight: 0,
    hearingMaxPush: "suspicious",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  },
  rewriter: {
    role: "rewriter",
    displayName: "\u6539\u5199\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 32,
    sightRangePeriph: 56,
    sightHalfAnglePeriph: 50,
    chaseSightRange: 210,
    hearingRange: 150,
    hearingMoveMult: 2,
    hearingStillRange: 40,
    hearingWallFactor: 0.6,
    visionWeight: 0.45,
    hearingWeight: 1,
    hearingMaxPush: "alert",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  }
};
var BODY_PROFILE_DATA = {
  "insect_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "human_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "mammal_remnant": {
    "moveScale": 1.1,
    "windupMs": 550,
    "cooldownMs": 1400,
    "rangePx": 38,
    "halfAngleDeg": 35
  },
  "worm_remnant": {
    "moveScale": 0.6,
    "windupMs": 650,
    "cooldownMs": 1500,
    "rangePx": 38,
    "halfAngleDeg": 25
  },
  "organic_remnant": {
    "moveScale": 0.7,
    "windupMs": 700,
    "cooldownMs": 1600,
    "rangePx": 36,
    "halfAngleDeg": 75
  },
  "stalk_clump": {
    "moveScale": 0.5,
    "windupMs": 750,
    "cooldownMs": 1750,
    "rangePx": 36,
    "halfAngleDeg": 80
  },
  "street_wreckage": {
    "moveScale": 0,
    "windupMs": 800,
    "cooldownMs": 1800,
    "rangePx": 38,
    "halfAngleDeg": 80
  }
};
var PLAYER_HALF = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
var BODY_CLEARANCE = PLAYER_HALF + GAME_CONSTANTS.AI.BODY_SIZE / 2;
var STATIC_SUBSTRATES = Object.keys(BODY_PROFILE_DATA).filter((id) => BODY_PROFILE_DATA[id].moveScale === 0);
var TileGrid = class {
  constructor(map) {
    __publicField2(this, "cols");
    __publicField2(this, "rows");
    __publicField2(this, "tileSize");
    __publicField2(this, "widthPx");
    __publicField2(this, "heightPx");
    __publicField2(this, "data");
    __publicField2(this, "_version", 0);
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.cols * map.tileSize;
    this.heightPx = map.rows * map.tileSize;
    this.data = new Uint8Array(map.cols * map.rows);
    for (let row = 0; row < map.rows; row++) {
      const sourceRow = map.tiles[row];
      if (!sourceRow || sourceRow.length !== map.cols) {
        throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
      }
      for (let col = 0; col < map.cols; col++) {
        this.data[row * map.cols + col] = sourceRow[col];
      }
    }
  }
  get version() {
    return this._version;
  }
  /**
   * Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks.
   * In-bounds VOID stays VOID (unwalkable; opaque via `isOpaque`).
   */
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    return this.data[row * this.cols + col];
  }
  isOpaque(col, row) {
    const tile = this.getTile(col, row);
    return tile === 0 || tile === 3;
  }
  isWalkable(col, row) {
    const tile = this.getTile(col, row);
    return tile === 1 || tile === 2;
  }
  /** True when the world position falls inside a walkable tile. */
  isWalkableAt(x, y) {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }
  /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
  setTile(col, row, tile) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (this.data[index] === tile) return;
    this.data[index] = tile;
    this._version++;
  }
  /** Writes the centre of a tile into `out` (no allocation). */
  tileToWorld(col, row, out) {
    out.x = col * this.tileSize + this.tileSize / 2;
    out.y = row * this.tileSize + this.tileSize / 2;
    return out;
  }
  /** Writes the tile containing a world position into `out` (no allocation). */
  worldToTile(x, y, out) {
    out.col = Math.floor(x / this.tileSize);
    out.row = Math.floor(y / this.tileSize);
    return out;
  }
};
var RIFT_MAP_ASCII = [
  "################################################",
  "#..............................................#",
  "#.....##..............X.........###............#",
  "#.....###.........##..............##..P..##....#",
  "#..........##...............##.................#",
  "#.......J....##.......................K...##...#",
  "#.....##...........###........##...............#",
  "#.........##.............##............##......#",
  "#..7........###........##..........###.........#",
  "#...####..........######.........##............#",
  "#...###..........##....##...........6..........#",
  "#.Q......##.........##...........##............#",
  "#.........##.............###...................#",
  "#.....C...##........5....###..........D........#",
  "#...####..........##.....##....................#",
  "#..##.........##..........##..........###......#",
  "#......###............##.......###.............#",
  "#.....E...##.....##...................##.......#",
  "#......####..........##............4.....##....#",
  "#..............####.........##...........##....#",
  "#..##..........###..........##....R...###......#",
  "#.............##...............##...F.....8....#",
  "#...........##............##...................#",
  "#.......##........##........##.................#",
  "#.....H.......##...................G...##......#",
  "#...........3........##...........##...........#",
  "#....##.....A.................2......B.........#",
  "#........##...........1............##..........#",
  "#.....................S..........##............#",
  "#....##....................##..................#",
  "#..............................................#",
  "################################################"
];
var KINDLING_TIERS = {
  "1": "safe",
  "2": "safe",
  "3": "safe",
  "4": "contested",
  "5": "contested",
  "6": "contested",
  "7": "deep",
  "8": "deep"
};
var CONTAMINANT_MARKER_CHARS = ["P", "Q", "R"];
var PATROL_UNITS = [
  {
    id: "ENM_INF_01",
    waypointChars: "AB",
    mode: "pingpong",
    facing: 0,
    role: "spawn area sweep; east-west patrol covering the open ground between safe kindling and the transition zone"
  },
  {
    id: "ENM_INF_02",
    waypointChars: "CD",
    mode: "pingpong",
    facing: 0,
    role: "upper contested area; sweeps east-west through the debris field, guards KDL_05 and approach to deep zone"
  },
  {
    id: "ENM_INF_03",
    waypointChars: "EFGH",
    mode: "loop",
    facing: 0,
    role: "rectangular loop in the transition zone; covers the C-shape ruin and cliff ridge areas, guards KDL_04 and KDL_08 approaches"
  },
  {
    id: "ENM_INF_04",
    waypointChars: "JK",
    mode: "pingpong",
    facing: 0,
    scanAngles: [180, 0],
    role: "top zone gate; sweeps east-west in the extraction approach \u2014 the last obstacle before exit"
  }
];
var LANDMARKS = [
  { id: "LMK_POOL", col: 28, row: 6, style: "pool" },
  { id: "LMK_SCRATCHES", col: 20, row: 26, style: "scratches" },
  { id: "LMK_RUBBLE", col: 8, row: 15, style: "rubble" },
  { id: "LMK_CRACK", col: 40, row: 18, style: "crack" },
  { id: "LMK_SCORCH", col: 30, row: 4, style: "scorch" },
  { id: "LMK_CRYSTALS", col: 41, row: 9, style: "crystals" },
  { id: "LMK_BLOODTRAIL", col: 22, row: 22, style: "bloodtrail" },
  { id: "LMK_RUNE", col: 6, row: 19, style: "rune" }
];
function parseRiftMap() {
  const tileSize = GAME_CONSTANTS.TILE_SIZE;
  const rows = RIFT_MAP_ASCII.length;
  const cols = RIFT_MAP_ASCII[0].length;
  const tiles = [];
  const markers = /* @__PURE__ */ new Map();
  for (let row = 0; row < rows; row++) {
    const line = RIFT_MAP_ASCII[row];
    if (line.length !== cols) {
      throw new Error(`rift-map-data: row ${row} has ${line.length} chars, expected ${cols}`);
    }
    const tileRow = new Array(cols);
    for (let col = 0; col < cols; col++) {
      const char = line[col];
      tileRow[col] = char === "#" ? 0 : 1;
      if (char !== "#" && char !== ".") {
        if (markers.has(char)) {
          throw new Error(`rift-map-data: marker '${char}' appears more than once`);
        }
        markers.set(char, {
          x: col * tileSize + tileSize / 2,
          y: row * tileSize + tileSize / 2
        });
      }
    }
    tiles.push(tileRow);
  }
  const requireMarker = (char) => {
    const position = markers.get(char);
    if (!position) throw new Error(`rift-map-data: missing marker '${char}'`);
    return position;
  };
  const kindlingNodes = Object.keys(KINDLING_TIERS).sort().map((char) => ({
    id: `KDL_0${char}`,
    tier: KINDLING_TIERS[char],
    position: requireMarker(char)
  }));
  const contaminantNodes = CONTAMINANT_MARKER_CHARS.map((char, idx) => ({
    id: `CTM_NODE_0${idx + 1}`,
    position: requireMarker(char)
  }));
  const enemySpawns = PATROL_UNITS.map((unit) => {
    const waypoints = unit.waypointChars.split("").map((char) => {
      const position = requireMarker(char);
      return {
        col: Math.floor(position.x / tileSize),
        row: Math.floor(position.y / tileSize)
      };
    });
    return {
      id: unit.id,
      type: "infiltrator",
      spawn: waypoints[0],
      facing: unit.facing,
      patrol: {
        waypoints,
        mode: unit.mode,
        pauseMs: unit.pauseMs,
        scanAngles: unit.scanAngles
      }
    };
  });
  const tileMap = { cols, rows, tileSize, tiles };
  return {
    tileMap,
    grid: new TileGrid(tileMap),
    layout: {
      spawnPoint: requireMarker("S"),
      extractionPoint: {
        id: "EXIT_01",
        position: requireMarker("X"),
        triggerRadius: GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS
      },
      kindlingNodes,
      contaminantNodes,
      enemySpawns,
      landmarks: LANDMARKS
    }
  };
}
var RIFT_MAP = parseRiftMap();
function createRayHit() {
  return { x: 0, y: 0, dist: 0, hit: false };
}
var losScratch = createRayHit();
var SIGHT_PX = ENEMY_DATA.infiltrator.sightRange;
var TILE = GAME_CONSTANTS.TILE_SIZE;
var forbiddenExtract = RIFT_MAP.layout.extractionPoint.position;
var HOST_TILE = GAME_CONSTANTS.TILE_SIZE;
var HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
var STATIC_CLEARANCE = HALF_BODY + GAME_CONSTANTS.AI.BODY_SIZE / 2;

// src/types/rift-checkpoint.ts
function checkpointChecksum(value) {
  const bytes = JSON.stringify(value);
  if (bytes === void 0) throw new Error("Checkpoint is not serializable");
  let hash = 2166136261;
  for (let index = 0; index < bytes.length; index++) {
    hash ^= bytes.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

// src/config/constants.ts
var GAME_CONSTANTS2 = {
  /** Tile size in pixels */
  TILE_SIZE: 32,
  /** Camera. Zoom 1.5 on a 960x640 canvas gives a ~640x427 logical viewport = ~20x13 tiles (DEC-009). */
  CAMERA: {
    ZOOM: 1.5
  },
  /** Player movement (docs/specs/system-movement-vision.md, section M) */
  PLAYER: {
    SPEED: 80,
    // px/s base speed = 2.5 tiles/s (tuned down for deliberate stealth feel)
    MAX_HEALTH: 100,
    INVENTORY_SLOTS: 4,
    MOVE_ACCEL_TIME: 0.08,
    // s from standstill to full speed
    MOVE_DECEL_TIME: 0.1,
    // s from full speed to standstill
    FACING_TURN_RATE: 1080,
    // deg/s the vision cone swings toward the input direction
    FACING_QUANT_HYSTERESIS: 5,
    // deg of dead zone around the 45 degree facing4 boundaries
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 sprite
    SPEED_MOD_MIN: 0.5
    // floor on the multiplied speed modifier stack
  },
  /**
   * Presentation-only gait (art-direction §3.3). Does not change facingAngle,
   * facing4 snap timing, speeds, or colliders.
   */
  ACTOR_MOTION: {
    FRAME_COUNT: 4,
    TURN_MS: 180,
    LAG_PX: 3,
    LAG_ALPHA: 0.38,
    MOVE_SPEED_FLOOR: 6,
    // px/s; below this the idle cycle plays
    PLAYER_IDLE_FPS: 4,
    PLAYER_WALK_FPS: 8,
    INFILTRATOR_IDLE_FPS: 4,
    INFILTRATOR_WALK_FPS: 4,
    // puppet hitch supplies the step; keep the sheet slow
    REWRITER_IDLE_FPS: 4,
    REWRITER_WALK_FPS: 6
  },
  /** Chaos system (docs/specs/system-chaos-scavenge-extract.md) */
  CHAOS: {
    START_VALUE: 0,
    MAX_VALUE: 100,
    // HUD gauge max (value CAN exceed this)
    HARD_CAP: 150,
    BASE_RATE: 0.5,
    // points per second (DEC-024: calibrated for 80 px/s travel)
    THRESHOLD_1: 50,
    THRESHOLD_2: 75,
    THRESHOLD_3: 100,
    COMBAT_BONUS: 5,
    DETECTION_BONUS: 3,
    DETECTION_BONUS_COOLDOWN: 1e4,
    // ms per-enemy cooldown on detection chaos
    CHASE_RATE_MULT: 2,
    EMIT_STEP: 1,
    // minimum delta before emitting CHAOS_CHANGED
    MODULATOR_STEP: 1
    // minimum delta before calling onModulate callback
  },
  /** Loot / kindling nodes (docs/specs/system-chaos-scavenge-extract.md) */
  LOOT: {
    /** 迭代 10 起退役，见 spec 规则 14。名义参数，代码无引用；由 SEARCH_RADIUS 取代。 */
    PICKUP_RADIUS: 16,
    NODE_COUNT: 8,
    VALUE_SAFE: 1,
    VALUE_CONTESTED: 2,
    VALUE_DEEP: 4,
    SEARCH_CHANNEL_MS: 1200,
    SEARCH_RADIUS: 48,
    SEARCH_NOISE_RADIUS: 96,
    SEARCH_NOISE_LEVEL: "suspicious"
  },
  /** Extraction point (docs/specs/system-chaos-scavenge-extract.md) */
  EXTRACTION: {
    TRIGGER_RADIUS: 48,
    KEY: "E",
    SETTLE_DELAY_MS: 600,
    RESTART_KEY: "R"
  },
  /**
   * Visibility / FOV (docs/specs/system-movement-vision.md, section V).
   * Models a forward cone unioned with an ambient ring, with three fixed-width edge
   * bands. The older single-radius + edge-softness model was replaced rather than
   * extended, so the two parameter sets never coexist.
   */
  VISIBILITY: {
    RADIUS_FORWARD: 224,
    // px straight ahead (7 tiles); must exceed every profile sightRange (I1)
    RADIUS_AMBIENT: 80,
    // px all around (2.5 tiles) = the lamp the player carries
    CONE_HALF_ANGLE: 50,
    // deg half-angle of the full-range sector
    CONE_FALLOFF_ANGLE: 30,
    // deg of transition from forward range down to ambient
    MIN_SOLID_RADIUS: 48,
    // px that stay fully lit no matter what
    EDGE_BAND_WIDTH: 32,
    // px per gradient band (1 tile, art-direction 4.3)
    BAND_ALPHAS: [1, 0.6, 0.2],
    // visibility of core / middle / outer band
    ERASE_ALPHAS: [1, 0.5, 0.2],
    // per-layer erase strength producing those alphas
    RAY_COUNT: 60,
    // architecture ceiling
    RAY_SPLIT_FORWARD: 40,
    // rays inside the cone sector
    RAY_SPLIT_AMBIENT: 20,
    // rays across the remaining angles
    RAY_COUNT_DEGRADED: 40,
    // first degradation step
    RAY_SPLIT_FORWARD_DEGRADED: 28,
    RAY_SPLIT_AMBIENT_DEGRADED: 12,
    MIN_RADIUS_SCALE: 0.4,
    // hard floor for the chaos radius modulator
    CACHE_POS_EPSILON: 0.5,
    // px of movement tolerated before the cache is dropped
    CACHE_ANGLE_EPSILON: 0.5,
    // deg of rotation tolerated before the cache is dropped
    BUDGET_MS: 2,
    // per-frame raycasting budget
    DEGRADE_SAMPLE_FRAMES: 30,
    // consecutive frames over budget before degrading
    /** Void outside the field of view */
    VOID_COLOR: 526860,
    VOID_NOISE_ALPHA: 0.04,
    VOID_NOISE_TILE: 64,
    // px noise texture size
    VOID_NOISE_SCROLL: 2,
    // px/s drift
    /** Warm lamp the player carries - the only warm light inside a rift */
    PLAYER_LAMP_COLOR: 9067562,
    PLAYER_LAMP_ALPHA: 0.12,
    /**
     * Flashlight beam: an additive warm pool pushed forward along facing and clipped to
     * the vision cone by the darkness mask. This is what makes the forward cone read as
     * "lit by a flashlight" rather than merely "revealed" (A-G3 / DEC-018 beam gain).
     */
    FLASHLIGHT_COLOR: 11047018,
    // pale warm; a saturated brown would wash the cold floor out
    FLASHLIGHT_ALPHA: 0.16,
    // low enough that fragment L1 (clinic/metro/soil) still reads under the cone
    FLASHLIGHT_FORWARD_FRAC: 0.34,
    // push the pool centre this fraction of forward range ahead
    FLASHLIGHT_RADIUS_FRAC: 0.85,
    // pool radius as a fraction of forward range
    /** Glow bleeding through the darkness (Slice 1: extraction point only) */
    GLOW_LEAK_ALPHA: 0.25,
    GLOW_LEAK_RADIUS: 48,
    /** Chaos corruption of the vision edge */
    CORRUPTION_COLOR: 1748374,
    CORRUPTION_MAX_MIX: 0.6,
    // alpha of the teal band at corruption 1.0
    CORRUPTION_MAX_DEPTH: 0.35,
    // fraction of the range teal can eat at corruption 1.0
    CORRUPTION_JITTER_PX: 4,
    CORRUPTION_JITTER_HZ: 6,
    /**
     * Overflow (chaos > 100) full-screen teal wash. Persistent base stays well below the
     * old 0.08 epilepsy cap; the jump is a discrete ~2 s pulse (not a strobe), so its
     * peak can read as a "skip" without a rapid flash train.
     */
    FLICKER_BASE_ALPHA: 0.05,
    FLICKER_JUMP_ALPHA: 0.16,
    FLICKER_JUMP_PERIOD_MS: 2200,
    FLICKER_JUMP_WIDTH_MS: 140,
    /** Extra teal bite / edge jitter scale at screenFlicker = 1.0 */
    OVERFLOW_CORRUPTION_DEPTH_BOOST: 0.4,
    OVERFLOW_JITTER_BOOST: 1,
    /** Purification point overrides (omni mode) */
    PURIFY_RADIUS: 400,
    PURIFY_RAY_COUNT: 90
  },
  /**
   * Enemy AI (docs/specs/system-enemy-ai.md, "数值结构"). Every AI number lives here;
   * none are inlined in the systems.
   *
   * Six of these values are load-bearing relations rather than free parameters - the
   * balance invariants I1-I6 that make stealth playable at all. `config/invariants.ts`
   * asserts them at boot so tuning cannot silently break one.
   *
   * The old `SIGHT_ANGLE: 90 // cone half-angle` key was removed rather than kept: its
   * meaning split into a core cone and a peripheral band, and three overlapping angle
   * parameters would have been three ways to be wrong.
   */
  AI: {
    // --- movement and body (shared; per-role speeds live in data/enemies.csv) ---
    TURN_RATE: 360,
    // deg/s; a third of the player's, which is what makes flanking work (I6)
    BODY_SIZE: 20,
    // px collider edge; < TILE_SIZE so 1-tile gaps stay passable
    BODY_OFFSET: { x: 6, y: 6 },
    // centres the collider inside the 32x32 infiltrator sprite
    SEPARATION_RADIUS: 24,
    // px; soft repulsion instead of enemy-vs-enemy physics
    SEPARATION_WEIGHT: 0.35,
    // how strongly separation bends the movement direction
    STANDOFF_DISTANCE: 30,
    // px; where a chaser stops. Must stay under COMBAT.ATTACK_RANGE
    STANDOFF_BAND: 4,
    // px of tolerance around it (26..34)
    STANDOFF_ADJUST_SPEED: 60,
    // px/s used to back off when the player crowds it
    // --- perception (shared; cone / hearing radii / weights live in data/enemies.csv) ---
    DETECT_FILL_TIME: 0.45,
    // s of clear sight to go from 0 to certain; then × visionWeight
    HEAR_FILL_TIME: 2,
    // s of hearing fill baseline; then × hearingWeight × moveMult
    HEARING_STILL_CAP: 0.2,
    // still-hearing cannot push detection past this (below 0.35)
    HEAR_ALERT_THRESHOLD: 0.7,
    // rewriter T0-4b: hearing can push to ALERT, never CHASE
    DETECT_DIST_FACTOR_NEAR: 1.6,
    // detection rate multiplier at point blank
    DETECT_DIST_FACTOR_FAR: 0.5,
    // ...and at the edge of sight range
    DETECT_ZONE_FACTOR_PERIPH: 0.45,
    // peripheral vision fills far slower than the core cone
    SUSPICION_THRESHOLD: 0.35,
    // detection at which it stops and turns - the player's warning
    REACQUIRE_THRESHOLD: 0.5,
    // lower bar to re-lock while already searching
    DETECT_DECAY_RATE: 0.67,
    // per s; ~1.5 s to clear after breaking sight
    DETECT_DECAY_ALERT_SCALE: 0.5,
    // decays half as fast while searching: it is holding a grudge
    HEARING_JITTER: 32,
    // px of positional fuzz, so hearing is not a wall-hack locator
    PERCEPTION_TICK_MS: 100,
    // 10 Hz perception; one raycast per enemy per tick
    PERCEPTION_TICK_MS_FAR: 200,
    // 5 Hz beyond ACTIVE_RANGE (rule N8)
    // --- timers (section "计时器") ---
    LOS_GRACE_MS: 400,
    // how long a chase survives with no line of sight
    LOST_PLAYER_DURATION: 5e3,
    // ms of ALERT searching
    ALERT_DURATION: 3e3,
    // ms a SUSPICIOUS enemy stays wary with no new stimulus
    CHASE_ABANDON_RANGE: 320,
    // px past which an unseen chase is given up
    WAYPOINT_PAUSE_MS: 1200,
    // dwell at a patrol waypoint - the player's window to slip past
    SCAN_HOLD_MS: 600,
    // dwell on each scan heading
    SEARCH_HOLD_MS: 800,
    // dwell at each ALERT search point
    EXTRAPOLATE_SEC: 0.6,
    // how far ahead of the last sighting to guess - punishes running straight
    SEARCH_SPREAD: 96,
    // px radius of the random third search point
    ALERT_EMIT_COOLDOWN_MS: 1e3,
    // suppression window for repeated same-level ENEMY_ALERT
    SUSPICIOUS_TURN_HOLD_MS: 200,
    // minimum standstill when turning to look (rule B2, ">= 0.2 s")
    SCAN_SWEEP_ANGLE: 45,
    // deg to each side when scanning in place
    SCAN_SWEEP_PERIOD_MS: 1500,
    // full left-right-left sweep period
    FACING_ARRIVE_EPSILON: 6,
    // deg within which a turn counts as completed
    // --- pathfinding and performance (section "寻路与性能") ---
    MAX_PATHS_PER_FRAME: 1,
    // architecture hard rule
    REPATH_INTERVAL_MS: 500,
    REPATH_INTERVAL_MS_FAR: 1e3,
    // for requests past SIMPLE_PATH_RANGE (rule N5)
    REPATH_MOVE_THRESHOLD: 48,
    // px of target movement that earns an early chase repath
    SIMPLE_PATH_RANGE: 384,
    // px past which a request drops to the lowest priority
    ASTAR_MAX_NODES: 3e3,
    // expansion ceiling; real cap is the 5ms budget, not node count. Worst cross-map search measured 1050 nodes / 0.31ms, so 3000 stays well under 5ms and leaves RETURN headroom (DEC-022)
    PATH_FAIL_LIMIT: 3,
    // consecutive failures before giving up on the goal
    ACTIVE_RANGE: 640,
    // px; beyond this the FSM runs at 5 Hz and never asks for a path
    ARRIVE_EPSILON: 8,
    // px within which a path point counts as reached
    MAX_ACTIVE_ENEMIES: 8,
    // Slice 1 uses 4; more than this means the map data is wrong
    MAX_PATH_POINTS: 64,
    // capacity of a per-enemy dynamic path buffer
    DT_CLAMP_MS: 100,
    // stops a backgrounded tab from teleporting enemies on return
    /**
     * Stuck watchdog. Rule N4 skips A* whenever the target is in line of sight, but a
     * clear sight line does not prove a 20 px body fits through the diagonal seam it
     * crosses. Instead of pre-emptively restricting N4 to 3 tiles, we detect the
     * symptom (wanting to move but not moving) and fall back to a real path.
     */
    STUCK_REPATH_MS: 400,
    STUCK_PATH_PREFERENCE_MS: 2e3,
    // how long a stuck enemy keeps preferring A* over straight lines
    STUCK_PROGRESS_FRACTION: 0.25,
    // actual/desired speed below which we count as stuck
    // --- placeholder presentation (section "占位期表现", art-direction 12) ---
    BODY_COLOR: 13386820,
    // "low tier enemy"; encodes tier, never state
    INDICATOR_COLOR: 2811592,
    // contamination teal; state lives here
    SUSPICIOUS_BREATH_HZ_MIN: 1.5,
    // breathing rate at the suspicion threshold...
    SUSPICIOUS_BREATH_HZ_MAX: 3,
    // ...and at full certainty (rule R3)
    ALERT_BLINK_HZ: 3,
    // blinking = searching
    AFTERIMAGE_INTERVAL_MS: 100,
    AFTERIMAGE_LIFETIME_MS: 300,
    AFTERIMAGE_ALPHA: 0.3,
    AFTERIMAGE_SLOTS: 4,
    // ring buffer per enemy; lifetime/interval + 1
    /** Rule R5's fallback visualisation. The cone drawing itself is not implemented yet. */
    DEBUG_SHOW_VISION_CONE: false
  },
  /** Map generation */
  MAP: {
    WIDTH: 80,
    // tiles (larger to accommodate multiple fragments)
    HEIGHT: 80,
    // tiles
    /** Voronoi partitioning */
    FRAGMENT_COUNT_MIN: 4,
    FRAGMENT_COUNT_MAX: 6,
    FRAGMENT_MIN_AREA: 150,
    // minimum tiles per fragment
    /** Cellular automata */
    CA_ITERATIONS: 5,
    // smoothing passes
    CA_WALL_THRESHOLD: 4,
    // cells with >= N wall neighbors become wall
    CA_INITIAL_FILL: 0.45,
    // initial random fill ratio (lower = more open)
    /** Fracture connections between fragments */
    FRACTURE_WIDTH: 2,
    // tiles (narrow passage width)
    FRACTURE_MAX_PER_EDGE: 2
    // max connections between two adjacent fragments
  },
  /**
   * Slice 6 C1 land outline. Rectangular tile buffer; walkable land must not fill it.
   * 80×80 MAP.* numbers stay architecture placeholders — do not use them for this generator.
   */
  GENERATION: {
    BUFFER_COLS: 64,
    BUFFER_ROWS: 42,
    MAX_OUTLINE_ATTEMPTS: 28,
    LAND_FILL_MIN: 0.24,
    LAND_FILL_MAX: 0.48,
    BORDER_RING: 2,
    /** Fraction of the outer ring that may be land. Higher = island hugging the rectangle. */
    BORDER_OCCUPANCY_MAX: 0.12,
    /** Land / axis-aligned bbox. Circles sit near 0.78; filled rectangles sit near 1. */
    BBOX_FILL_MAX: 0.8,
    /**
     * Share of land cells that touch void. Large blobs naturally sit lower;
     * this only rejects near-solid blocks (a 1-cell frame around a filled rect).
     */
    ROUGHNESS_MIN: 0.08,
    /** bbox must leave at least this many leftover cells on width+height combined. */
    MIN_BBOX_SLACK: 8,
    MAX_EDGES_TOUCHING: 3,
    MAX_RUIN_ATTEMPTS: 40,
    MIN_FEATURE_SEPARATION: 7,
    WALL_RATIO_MIN: 0.018,
    WALL_RATIO_MAX: 0.22,
    /** Largest leftover open rectangle (tiles). Bigger than this reads as an empty plaza. */
    YARD_AREA_MAX: 64
  },
  /** Purification point (docs/specs/system-purification-impact.md) */
  PURIFICATION: {
    /** Spatial layout */
    MAP_COLS: 14,
    // tiles
    MAP_ROWS: 12,
    // tiles
    INTERACTION_RADIUS: 32,
    // pixels for module/rift-entrance interaction
    /** Module state */
    MODULE_INITIAL_HP: 70,
    /** Tier-0 repair cap / effect denominator baseline (DEC-064). */
    MODULE_BASE_MAX_HP: 100,
    /** Alias of MODULE_BASE_MAX_HP so older call sites still compile. */
    MODULE_MAX_HP: 100,
    /** Each thicken tier adds this many maxHp to every module. */
    MODULE_MAX_HP_PER_TIER: 15,
    /** Highest purchasable thicken tier (maxHp = 100 + 15*3 = 145). */
    MODULE_MAX_HP_TIERS: 3,
    // Thickening purchase costs are authored alongside all other growth steps
    // in data/growth-route.csv, not a separate system-constant price ladder.
    /** All three module effects use this HP reference; thickening does not raise it. */
    MODULE_EFFECT_HP_REF: 100,
    /** Starting chaos when purifier hp = 0 (full integrity → 0). */
    CHAOS_HARD_START: 50,
    REPAIR_PER_KINDLING: 4,
    // 1 kindling = this many hp (tuned for scarcity)
    /** Impact system (intensity now driven by TideSystem, see TIDE constants) */
    BASE_IMPACT_DAMAGE: 30,
    THREAT_FOCUS_RATIO: 0.65,
    // primary target gets this fraction of total damage
    FORECAST_ACCURACY: 0.8,
    // particle prediction accuracy
    /** combust defense mechanic (DEC-030): fixed threshold, not derived from
     * BASE_IMPACT_DAMAGE, so tide-driven damage swings don't shift the trigger point.
     * Value chosen to equal ~2x BASE_IMPACT_DAMAGE(30) per the CSV's "约等于2次满额冲击". */
    COMBUST_BURN_THRESHOLD: 60,
    /** Module effects */
    MAX_CORE_REDUCTION: 0.3,
    // chaosRate reduction at full hp
    MAX_STORAGE_BONUS: 0.5,
    // kindling value bonus at full hp
    /** resonate (Slice 5 gap-fill, DEC-039): "装备期间CORE和STORAGE模块效果上限各提升10%".
     * A flat bump to both caps above while at least one resonate sits in a defense slot -
     * not a multiplier, so it reads the same way the CSV states it ("+10%" alongside two
     * numbers already expressed as flat percentages). "不叠加" is enforced by storing this
     * as a single on/off flag (`GameState.isResonateBonusActive()`), not a per-item count. */
    RESONATE_MODULE_CAP_BONUS: 0.1,
    /** siphon (Slice 5 gap-fill): "装备期间所有薪柴修复模块的效率翻倍(1薪柴=8hp)" - same
     * "装备期间" derivation pattern as RESONATE_MODULE_CAP_BONUS above (owned by
     * `ContaminantSystem.syncRepairEfficiencyMult()` + `GameState`, not a per-impact
     * defense-engine effect), since the CSV names it a standing equip-state bonus rather
     * than a one-impact trigger. 4 (REPAIR_PER_KINDLING) * 2.0 = 8, matching the CSV. */
    SIPHON_REPAIR_EFFICIENCY_MULT: 2,
    /** Boundary atmosphere */
    ATMOSPHERE: {
      PARTICLE_COUNT: 50,
      // active boundary particles
      PARTICLE_ALPHA_MIN: 0.06,
      PARTICLE_ALPHA_MAX: 0.25,
      PARTICLE_SPEED: 8,
      // px/s slow inward drift
      APPARITION_INTERVAL_MIN: 8e3,
      // ms
      APPARITION_INTERVAL_MAX: 15e3,
      APPARITION_DURATION: 3e3,
      // ms (0.5s fade in + 2s hold + 0.5s fade out)
      APPARITION_MAX_SIMULTANEOUS: 3
    },
    /** Dynamic boundary shape (polar pressure blob) */
    BOUNDARY: {
      SHRINK_AT_MAX_INTENSITY: 0.72,
      // tideScale at intensity 3.0 (boundary loses up to 28%)
      PRESSURE_PRIMARY_AMP: 0.2,
      // max inward push fraction (primary Gaussian lobe)
      PRESSURE_SECONDARY_AMP: 0.1,
      // secondary lobe amplitude
      PRESSURE_LOBE_SIGMA: 0.7,
      // radians; width of each Gaussian lobe
      PRESSURE_CREST_BONUS: 0.4,
      // +40% amplitude during crest phase
      PRESSURE_EBB_FACTOR: 0.6,
      // amplitude multiplier during ebb phase
      SAFE_MARGIN_TILES: 1,
      // minimum distance from any interaction point to boundary
      GRADIENT_INNER_START: 0.8,
      // fraction of R where darkening begins
      GRADIENT_MEMBRANE_START: 0.95,
      // fraction where "membrane" teal band begins
      GRADIENT_OUTER_END: 1.15,
      // fraction where full void begins
      /**
       * B4 (Slice 5): the old BREATH_BASE_ALPHA/AMP/FREQ/CREST_FREQ_MULT/EBB_AMP_MULT
       * keys described a single global sinusoidal pulse from a "whole-boundary breathing"
       * design that DEC-028 (Slice 4.5) replaced with localized pressure impacts
       * (`src/systems/boundary-breath.ts`). Those 5 keys had zero consumers and were
       * removed; this nested object holds boundary-breath.ts's real tuning knobs
       * (previously inlined as top-of-file `const`s there) instead. Values unchanged.
       */
      BREATH: {
        SAMPLE_COUNT: 72,
        // angular resolution of the membrane/impact draw
        MAX_IMPACTS: 5,
        // max simultaneous localized impacts
        ARC_HALF_MIN: 0.4,
        // rad; narrowest impact arc half-width
        ARC_HALF_MAX: 0.8,
        // rad; widest impact arc half-width
        SPAWN_DIST_MIN: 14,
        // px; closest impact spawn distance outside the membrane
        SPAWN_DIST_MAX: 30,
        // px; farthest impact spawn distance
        IMPACT_DURATION_MIN: 1800,
        // ms; shortest single-impact lifetime
        IMPACT_DURATION_MAX: 3500,
        // ms; longest single-impact lifetime
        SPAWN_INTERVAL_MIN: 400,
        // ms; shortest gap between new impacts
        SPAWN_INTERVAL_MAX: 1200,
        // ms; longest gap between new impacts (x0.6 during crest)
        WAVE_COLOR: 936511,
        // dark desaturated teal, the inbound wave arcs
        MEMBRANE_COLOR: 1735274,
        // the boundary membrane line itself
        DEFORM_MAX_PX: 8
        // px; max inward push of the membrane at impact center
      }
    },
    /** Scene transition timing */
    IMPACT_RESULT_DISPLAY_MS: 2e3,
    SCENE_TRANSITION_DELAY_MS: 600
  },
  /**
   * Combat (docs/specs/system-combat.md, "数值结构"). Every combat number lives here.
   *
   * The system is a price list, not a fight: the point is that the player can work out
   * what swinging costs before swinging. Three of these relations carry that promise and
   * are asserted at boot by `config/invariants.ts` (K1/K2/K3/K5) - notably
   * `ENEMY_MAX_HEALTH` being an exact multiple of `PLAYER_DAMAGE`, which is what makes
   * "three hits" a fact rather than an average.
   *
   * When combat turns out too cheap in playtesting, the spec's tuning order is
   * `CHAOS.COMBAT_BONUS` and `NOISE_HIT_RADIUS` first, `ENEMY_MAX_HEALTH` second, and
   * `PLAYER_DAMAGE` never (weakening it makes combat expensive *and* unpleasant).
   */
  COMBAT: {
    // --- player attack (section "玩家攻击") ---
    PLAYER_DAMAGE: 25,
    ATTACK_COOLDOWN: 500,
    // ms, counted from the input instant, parallel to the phases
    ATTACK_RANGE: 40,
    // px centre-to-centre; must exceed ENEMY_ATTACK_RANGE (K2)
    ATTACK_HALF_ANGLE: 60,
    // deg -> a 120 deg forward sector
    ATTACK_WINDUP_MS: 100,
    // the player's side of the commitment
    ATTACK_ACTIVE_MS: 50,
    // ~3 frames; exists to tolerate frame jitter, not to widen the hit
    ATTACK_RECOVERY_MS: 70,
    ATTACK_SLOW_MS: 220,
    // derived: windup + active + recovery (asserted, not free)
    ATTACK_SELF_SLOW: 0.35,
    // move speed while swinging - the "cost" that lands on feel
    ATTACK_MIN_ANGLE_BYPASS: 16,
    // px within which the angle test is meaningless and skipped
    /** Key name in `Phaser.Input.Keyboard.KeyCodes`. Read by RiftScene, which owns input. */
    ATTACK_KEY: "SPACE",
    // --- infiltrator (section "敌人（渗透体）") ---
    ENEMY_MAX_HEALTH: 75,
    // = 3 x PLAYER_DAMAGE exactly (K1, DEC-012)
    ENEMY_DAMAGE_BASE: 15,
    ENEMY_ATTACK_RANGE: 38,
    // px; between AI.STANDOFF_DISTANCE and ATTACK_RANGE (K2)
    ENEMY_ATTACK_HALF_ANGLE: 60,
    // deg; symmetric with the player's
    ENEMY_ATTACK_WINDUP_MS: 350,
    // the player's dodge window - the whole of "controllable" (K3)
    ENEMY_ATTACK_COOLDOWN_MS: 1200,
    ENEMY_FIRST_ATTACK_DELAY_MS: 300,
    // "caught up with you" and "hit you" stay two events
    ENEMY_ATTACK_TOKENS: 2,
    // enemies allowed in windup at once; caps unavoidable damage
    ENEMY_HIT_FLASH_MS: 80,
    ENEMY_DEATH_FX_MS: 180,
    // presentation only; the enemy is gone from logic at 0 ms
    // --- player health and hits (section "玩家生命值与受击") ---
    PLAYER_IFRAME_MS: 400,
    // stops two enemies resolving on one frame for 30 damage
    PLAYER_HIT_FLASH_MS: 100,
    // --- noise: the exposure half of the price (section "噪声") ---
    NOISE_SWING_RADIUS: 96,
    // px (3 tiles), 'suspicious' - a whiff is heard, not billed
    NOISE_HIT_RADIUS: 160,
    // px (5 tiles), 'alert' - the main reason a fight is loud
    NOISE_KILL_RADIUS: 192,
    // px (6 tiles), 'alert'
    /**
     * Placeholder presentation (spec V2). White is on loan here: it currently means
     * "player / extraction point" in art-direction 12, and using thin white lines and
     * flashes for combat actions is still awaiting art sign-off (spec escalate 1 and 2).
     * Treat these as stand-ins, not as the visual language.
     */
    FX_COLOR: 16777215,
    ATTACK_FAN_FX_MS: 60,
    // how long the swing outline stays up (spec V2)
    PLAYER_FLASH_PAD: 6,
    // px the hit flash overshoots the body; see report on white-on-white
    FX_POOL_SIZE: 12
    // preallocated flash/death sprites: 8 enemies + headroom
  },
  /**
   * Contamination lexicon (DEC-076). Morph tables stay in CSV.
   * These are system constants: core HP, chaos prices, draw retry, encounter timing.
   */
  CONTAMINATION: {
    CORE_MAX_HEALTH: 50,
    ADJACENT_STRIKE_DAMAGE: 15,
    ADJACENT_STRIKE_WINDUP_MS: 350,
    PAINT_STEP_CHAOS_REST: 2,
    PAINT_STEP_CHAOS_INFLATED: 4,
    VOLUME_CHAOS_PER_SEC: 1,
    VOLUME_SIGHT_MULT: 0.7,
    DRAW_RETRY_LIMIT: 12,
    ENCOUNTER_COOLDOWN_MS: 6e4,
    ENCOUNTER_GAP_MS: 2500,
    ENCOUNTER_HOLD_MS: 2500,
    VOLUME_DEPTH: 40,
    COLONY_NUCLEUS_COUNT_MIN: 2,
    COLONY_NUCLEUS_COUNT_MAX: 3,
    COLONY_NUCLEUS_MIN_TILE_GAP: 3
  },
  /** Audio */
  AUDIO: {
    MAX_SIMULTANEOUS_SFX: 8,
    DEFAULT_SFX_VOLUME: 0.7,
    DEFAULT_BGM_VOLUME: 0.4,
    DEFAULT_AMBIENT_VOLUME: 0.5
  },
  /** Tide system (docs/specs/system-growth-tide.md, section T) */
  TIDE: {
    TIDES: [
      { floor: 1, peak: 1.6, riseCycles: 3, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.2 },
      { floor: 1.2, peak: 2, riseCycles: 4, crestCycles: 1, ebbCycles: 2, ebbTarget: 1.5 },
      { floor: 1.5, peak: 2.4, riseCycles: 4, crestCycles: 2, ebbCycles: 2, ebbTarget: 1.8 },
      { floor: 1.8, peak: 2.8, riseCycles: 4, crestCycles: 2, ebbCycles: 3, ebbTarget: 2 },
      { floor: 2, peak: 3, riseCycles: 5, crestCycles: Infinity, ebbCycles: 0, ebbTarget: 2 }
    ],
    CREST_CHARGE_COST: 3,
    // impact charge cost during Crest phase
    NORMAL_CHARGE_COST: 1,
    // impact charge cost during Rise/Ebb phases
    TRANSFORM_THRESHOLD: 3
    // charges needed to transform defense -> tool
  },
  // Growth / permanent upgrades (docs/specs/system-growth-tide.md, section G):
  // Definitions come from data/upgrades.csv; all step costs come from
  // data/growth-route.csv (including thickening). Both generate upgrade-data.ts
  // under the CSV source rule — no constants block here
  // by design; growth-system.ts reads UPGRADE_DATA directly.
  /** Contaminant system (docs/specs/system-growth-tide.md, section CN) */
  CONTAMINANT: {
    NODES_PER_MAP: 3,
    // contaminant pickup nodes per rift map
    RARITY_WEIGHTS: { common: 60, fine: 30, rare: 10 },
    DEFENSE_SLOTS: 1,
    // base slot; each growth_defense_slot level adds +1
    SORTIE_SLOTS: 3,
    // base slots (2 active + 1 passive); growth_sortie_slot adds +1 active
    MAX_DEFENSE_SLOTS: 4,
    // DEFENSE_SLOTS + max growth_defense_slot bonus (maxLevel 3)
    MAX_SORTIE_SLOTS: 4,
    // SORTIE_SLOTS + max growth_sortie_slot bonus (maxLevel 1)
    USES: { common: 5, fine: 3, rare: 2 },
    // uses remaining after transformation
    /** echo defense mechanic: "单件因此最多+2" — per-tool cap on echo bonus grants. */
    ECHO_MAX_TOOL_USE_BONUS: 2,
    /**
     * Hotkeys for the active sortie slots, in slot order. The passive slot (always the
     * last unlocked slot, see `contaminantSystem.getSortiePassiveSlotIndex()`) never gets
     * an entry here - it has no hotkey by design. G was picked for the 3rd slot
     * (growth_sortie_slot, Slice 5 T5) because it sits directly beside F on the keyboard,
     * the same "one key past the movement cluster" reach as Q/F already use, and every
     * other neighbour (E/R/T) is already taken by extraction/restart/nothing-reserved-but-
     * awkward. Single source of truth for both the RiftScene binding and any UI that needs
     * to render the real key label.
     */
    SORTIE_ACTIVE_KEYS: ["Q", "F", "G"]
  },
  /** Purification stability (docs/specs/system-growth-tide.md, section S) */
  STABILITY: {
    MAX: 100,
    GAIN_EXTRACT: 1,
    // successful extraction (calibrated: ~35 cycles to cap)
    GAIN_GROWTH: 1,
    // purchased an upgrade
    GAIN_CREST_SURVIVED: 3,
    // survived a full Crest with no module at zero
    GAIN_TIDE_ADVANCE: 5,
    // tide advanced to next number
    LOSS_MODULE_ZERO: -1
    // a module reached 0 hp
  },
  /**
   * Fine/Rare active+passive tool numbers not already carried by
   * `src/generated/contaminant-data.ts` (radius/duration/uses read straight from the CSV
   * at the point of use instead of being re-hardcoded here - see `docs/design-notes/
   * slice3-sortie-tools.md`). Everything below is either a multiplier/amount the CSV
   * description states in prose (`data/contaminants.csv`, `description_tool` column) or,
   * where flagged, a placeholder-tier number the CSV leaves unspecified (Slice 5 T1).
   */
  TOOLS: {
    /** compress: "半径2格内敌人移速-60%" */
    COMPRESS_SPEED_MULT: 0.4,
    /** resonate: "弹回3格并眩晕2秒" */
    RESONATE_KNOCKBACK_PX: 96,
    RESONATE_STUN_MS: 2e3,
    /** overwrite: "感知范围缩小50%" */
    OVERWRITE_PERCEPTION_MULT: 0.5,
    /** combust: "感知范围-50%"(烈焰遮蔽视线) */
    COMBUST_PERCEPTION_MULT: 0.5,
    /** combust: "每秒受到持续伤害" - CSV gives no amount; placeholder tuned so an enemy
     * that stays the full 8s duration dies (75 hp / 15 = 5 ticks), matching the tool's
     * rare-tier power level. Flagged for design confirmation (see delivery report). */
    COMBUST_DAMAGE_PER_TICK: 15,
    COMBUST_TICK_MS: 1e3,
    /** mirror: "被敌人接触后碎裂消失" - CSV gives no contact radius; placeholder tuned to
     * roughly one enemy body width. Flagged for design confirmation. */
    MIRROR_CONTACT_RADIUS: 20,
    /** abyss: "使用后5秒内混乱增速+50%" - a second timing value the CSV's single
     * `tool_duration_ms` column cannot carry (that field holds the 10s reveal instead). */
    ABYSS_CHAOS_BOOST_MULT: 1.5,
    ABYSS_CHAOS_BOOST_MS: 5e3,
    /** siphon: "吸取2点薪柴且...混乱值增速减半" */
    SIPHON_KINDLING_GAIN: 2,
    SIPHON_CHAOS_REDUCTION_MULT: 0.5
  },
  /** Persistent save (docs/specs/system-growth-tide.md, section P) */
  SAVE: {
    KEY: "coh-save-v1",
    VERSION: 2
  }
};

// src/generated/build-lab-data.ts
var BUILD_LAB_PLACEMENTS = [
  {
    "scene": "watched",
    "id": "safe",
    "kind": "kindling",
    "col": 8,
    "row": 18,
    "tier": "safe",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "prize",
    "kind": "contaminant",
    "col": 29,
    "row": 12,
    "tier": "contested",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "deep",
    "kind": "kindling",
    "col": 30,
    "row": 6,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "extra",
    "kind": "contaminant",
    "col": 30,
    "row": 18,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "watcher",
    "kind": "enemy",
    "col": 23,
    "row": 12,
    "tier": "",
    "substrate": "human_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_cone",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "21:12|27:12",
    "box": ""
  },
  {
    "scene": "watched",
    "id": "listener",
    "kind": "enemy",
    "col": 28,
    "row": 19,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 270,
    "patrol": "28:19|32:19",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "safe",
    "kind": "kindling",
    "col": 9,
    "row": 12,
    "tier": "safe",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "prize",
    "kind": "contaminant",
    "col": 29,
    "row": 12,
    "tier": "contested",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "deep",
    "kind": "kindling",
    "col": 29,
    "row": 6,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "extra",
    "kind": "contaminant",
    "col": 31,
    "row": 18,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "listener",
    "kind": "enemy",
    "col": 30,
    "row": 20,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "28:20|32:20",
    "box": ""
  },
  {
    "scene": "periodic",
    "id": "field",
    "kind": "volume",
    "col": 18,
    "row": 12,
    "tier": "",
    "substrate": "gas_mass",
    "coverage": "infiltrate",
    "motion": "motion_anchor",
    "sense": "sense_domain",
    "rhythm": "rhythm_open",
    "contact": "contact_volume_chaos",
    "facing": 0,
    "patrol": "",
    "box": "16:10:21:15"
  },
  {
    "scene": "contested",
    "id": "safe",
    "kind": "kindling",
    "col": 10,
    "row": 18,
    "tier": "safe",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "prize",
    "kind": "contaminant",
    "col": 25,
    "row": 13,
    "tier": "contested",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "deep",
    "kind": "kindling",
    "col": 31,
    "row": 7,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "extra",
    "kind": "contaminant",
    "col": 31,
    "row": 18,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": "",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "watcher",
    "kind": "enemy",
    "col": 24,
    "row": 12,
    "tier": "",
    "substrate": "human_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_cone",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "21:10|25:10|25:15|21:15",
    "box": ""
  },
  {
    "scene": "contested",
    "id": "listener",
    "kind": "enemy",
    "col": 31,
    "row": 13,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 270,
    "patrol": "31:10|31:17",
    "box": ""
  }
];

// src/entities/form-renderers/d/environment-pixels.ts
var ENV_INK = {
  seam: [20, 28, 28],
  shadow: [36, 46, 44],
  body: [64, 79, 73],
  ridge: [100, 117, 103],
  ash: [112, 113, 102],
  ashShadow: [59, 65, 62],
  oil: [29, 39, 39],
  oilRidge: [69, 94, 86],
  metal: [88, 91, 83],
  rust: [92, 75, 60],
  teal: [54, 154, 132],
  lit: [128, 198, 168]
};
function stageOf(c) {
  return c === "infiltrate" ? 0 : c === "rewrite" ? 1 : 2;
}
function activityOf(p) {
  return p?.activity?.phase === "rest" ? 0 : p?.activity?.phase === "waking" ? p.activity.progress : 1;
}
function putPixel(out, w, h, x, y, ink, alpha = 255) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const i = (y * w + x) * 4;
  out[i] = ink[0];
  out[i + 1] = ink[1];
  out[i + 2] = ink[2];
  out[i + 3] = alpha;
}
function cluster(x, y, seed) {
  let n = Math.imul(Math.floor(x / 3) + seed, 374761393) ^ Math.imul(Math.floor(y / 2) + 11, 668265263);
  n = Math.imul(n ^ n >>> 13, 1274126177);
  return (n >>> 0) % 11;
}

// src/entities/form-renderers/d/paint-genome/material.ts
function paintSurfaceMaterial(out, field, w, h, substrate, coverage, seed, elapsedMs = 0, pose) {
  out.fill(0);
  const stage = stageOf(coverage), activity = activityOf(pose);
  const phase2 = elapsedMs * Math.PI * 2 / 2400;
  const inflated = pose?.signal === "inflated";
  const lift = activity * (inflated ? 1 : 0.45);
  const cx = w * 0.5, cy = h * 0.5;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, v = field[i];
    if (v < 0.1) continue;
    const r = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
    const north = field[i - w] < 0.1, south = field[i + w] < 0.1;
    const edge = north || south || field[i - 1] < 0.1 || field[i + 1] < 0.1;
    let ink = ENV_INK.shadow, alpha = 255;
    if (substrate === "fungal_mat") {
      const fold = (Math.floor(y * 0.65 + Math.sin(x * 0.16 + stage * 0.3) * (3 + stage) + Math.sin(y * 0.09) * 2 + Math.sin(phase2 - y * 0.08) * lift * 1.8) % 7 + 7) % 7;
      ink = fold <= 1 ? ENV_INK.seam : fold === 2 ? ENV_INK.ridge : fold < 5 ? ENV_INK.body : ENV_INK.shadow;
      if (north) ink = ENV_INK.ridge;
      if (south) ink = ENV_INK.seam;
      if (cluster(x, y, seed) === 3 && fold > 2 && fold < 5) ink = ENV_INK.shadow;
      if (stage > 0 && Math.abs(Math.sin(a * (3 + stage) + r * 0.08)) < 0.1 && fold === 2) ink = ENV_INK.teal;
    } else if (substrate === "oil_film") {
      const ribbon = Math.floor(y + Math.sin(x * 0.11 + stage * 0.4) * (2 + stage) + Math.sin(phase2) * lift * 2) % 12;
      ink = ENV_INK.oil;
      if (north) ink = ENV_INK.oilRidge;
      else if (south) ink = ENV_INK.seam;
      else if (ribbon === 2 && cluster(x, y, seed) < 7) ink = ENV_INK.oilRidge;
      else if (ribbon === 3 && cluster(x, y, seed) < 4) ink = ENV_INK.body;
      if (stage > 0 && ribbon === 8 && Math.floor(x / 5) % 3 === 1) ink = ENV_INK.shadow;
      if (stage === 2 && ribbon === 9 && Math.floor(x / 4) % 5 === 0) ink = ENV_INK.teal;
    } else {
      const shear = Math.round(Math.sin(phase2 + y * 0.12) * lift * (1 + stage));
      const fold = (y + Math.floor(x / 8) * (stage + 1) + shear + 1e3) % 8;
      ink = fold === 0 ? ENV_INK.seam : fold < 3 ? ENV_INK.ash : fold < 5 ? ENV_INK.ashShadow : ENV_INK.shadow;
      if (north) ink = ENV_INK.ash;
      if (south) ink = ENV_INK.seam;
      if (cluster(x, y, seed) === 5 && fold > 2) ink = ENV_INK.ashShadow;
      if (stage > 0 && fold === 1 && Math.floor(x / 4) % 7 === 0) ink = ENV_INK.teal;
    }
    if (edge && cluster(x, y, seed) < 2) ink = ENV_INK.shadow;
    if (v >= 0.78) ink = activity > 0.35 ? ENV_INK.teal : ENV_INK.body;
    if (activity < 0.3 && ink === ENV_INK.teal) ink = ENV_INK.body;
    if (ink === ENV_INK.teal && inflated) ink = ENV_INK.lit;
    putPixel(out, w, h, x, y, ink, alpha);
  }
}

// src/generated/rift-fragment-data.ts
var RIFT_FRAGMENT_DATA2 = {
  "frag-outdoor": {
    id: "frag-outdoor",
    displayName: "\u6237\u5916\u571F\u58E4",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 4,
    jogAmp: 1,
    gapCount: 0,
    gapPlacement: "",
    turnCount: 0,
    turnCorner: "",
    capKind: "stub",
    facingPolicy: "random",
    join: "single",
    surfaceMaterial: "soil",
    enabled: true,
    floorBv: 26,
    floorBiasR: 0.88,
    floorBiasG: 1.02,
    floorBiasB: 0.82,
    stainKey: "frag-outdoor",
    stainThreshold: 0.72,
    stainStrength: 0.4,
    grimeAmp: 0.5,
    macroAmp: 0.32,
    scratchPer1000px2: 0.55,
    fleckPer1000px2: 1.25,
    scratchAngle: "free",
    scratchDispersion: 0,
    wallBv: 24,
    wallBiasR: 1,
    wallBiasG: 0.88,
    wallBiasB: 0.75,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 12,
    featureCountMax: 24
  },
  "frag-clinic": {
    id: "frag-clinic",
    displayName: "\u533B\u9662\u5B9E\u9A8C\u5BA4",
    coverage: "remnant",
    massGrammar: "enclosure",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "end",
    turnCount: 2,
    turnCorner: "right",
    capKind: "none",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "tile",
    enabled: true,
    floorBv: 28,
    floorBiasR: 0.86,
    floorBiasG: 0.92,
    floorBiasB: 1.08,
    stainKey: "shadow-grey",
    stainThreshold: 0.78,
    stainStrength: 0.25,
    grimeAmp: 0.28,
    macroAmp: 0.18,
    scratchPer1000px2: 0.7,
    fleckPer1000px2: 0.55,
    scratchAngle: "orthogonal",
    scratchDispersion: 0,
    wallBv: 30,
    wallBiasR: 0.82,
    wallBiasG: 0.9,
    wallBiasB: 1.05,
    featureWidthTiles: 1,
    featureLengthTiles: 5,
    featureCountMin: 14,
    featureCountMax: 22
  },
  "frag-metro": {
    id: "frag-metro",
    displayName: "\u5730\u94C1\u5DE5\u4E1A",
    coverage: "remnant",
    massGrammar: "slab",
    jogPeriod: 0,
    jogAmp: 0,
    gapCount: 1,
    gapPlacement: "center",
    turnCount: 0,
    turnCorner: "",
    capKind: "pier",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "metal",
    enabled: true,
    floorBv: 24,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "brick-dark",
    stainThreshold: 0.68,
    stainStrength: 0.35,
    grimeAmp: 0.42,
    macroAmp: 0.28,
    scratchPer1000px2: 0.45,
    fleckPer1000px2: 0.9,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.15,
    wallBv: 26,
    wallBiasR: 1.1,
    wallBiasG: 0.82,
    wallBiasB: 0.68,
    featureWidthTiles: 2,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-library": {
    id: "frag-library",
    displayName: "\u65E7\u56FE\u4E66\u9986",
    coverage: "remnant",
    massGrammar: "ridge",
    jogPeriod: 6,
    jogAmp: 1,
    gapCount: 2,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "none",
    facingPolicy: "axis",
    join: "single",
    surfaceMaterial: "wood",
    enabled: true,
    floorBv: 26,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-library",
    stainThreshold: 0.6,
    stainStrength: 0.3,
    grimeAmp: 0.34,
    macroAmp: 0.2,
    scratchPer1000px2: 0.8,
    fleckPer1000px2: 0.7,
    scratchAngle: "longitudinal",
    scratchDispersion: 0.35,
    wallBv: 24,
    wallBiasR: 1.02,
    wallBiasG: 0.93,
    wallBiasB: 0.68,
    featureWidthTiles: 1,
    featureLengthTiles: 6,
    featureCountMin: 10,
    featureCountMax: 16
  },
  "frag-residential": {
    id: "frag-residential",
    displayName: "\u5C45\u6C11\u533A\u516C\u5BD3",
    coverage: "remnant",
    massGrammar: "cluster",
    jogPeriod: 2,
    jogAmp: 1,
    gapCount: 3,
    gapPlacement: "random",
    turnCount: 0,
    turnCorner: "",
    capKind: "widen",
    facingPolicy: "alternate",
    join: "single",
    surfaceMaterial: "plaster",
    enabled: false,
    floorBv: 28,
    floorBiasR: 1.08,
    floorBiasG: 0.86,
    floorBiasB: 0.72,
    stainKey: "frag-residential",
    stainThreshold: 0.7,
    stainStrength: 0.3,
    grimeAmp: 0.38,
    macroAmp: 0.24,
    scratchPer1000px2: 0.4,
    fleckPer1000px2: 0.4,
    scratchAngle: "orthogonal",
    scratchDispersion: 0.6,
    wallBv: 30,
    wallBiasR: 1.02,
    wallBiasG: 0.96,
    wallBiasB: 0.79,
    featureWidthTiles: 2,
    featureLengthTiles: 5,
    featureCountMin: 18,
    featureCountMax: 24
  }
};
var ENABLED_RIFT_FRAGMENTS2 = Object.values(RIFT_FRAGMENT_DATA2).filter((row) => row.enabled);

// src/generation/palette-quantize.ts
var PALETTE_HEX3 = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE3 = PALETTE_HEX3.map(hexToRgb2);
var TEAL_FAMILY_HEX2 = [
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#b0fff5",
  "#4adf8a",
  "#1a7a9a"
];
var TEAL_FAMILY2 = TEAL_FAMILY_HEX2.map(hexToRgb2);
var TEAL_FAMILY_SET2 = new Set(TEAL_FAMILY_HEX2);
var TEAL_SUBSET_DEEP_MID_HEX2 = ["#0e4a3f", "#1a6b5c", "#1a7a9a"];
var TEAL_SUBSET_CORE_HEX2 = ["#1aad96"];
var TEAL_SUBSET_GLOW_HEX2 = ["#2ae6c8"];
var TEAL_SUBSET_DEEP_MID2 = TEAL_SUBSET_DEEP_MID_HEX2.map(hexToRgb2);
var TEAL_SUBSET_CORE2 = TEAL_SUBSET_CORE_HEX2.map(hexToRgb2);
var TEAL_SUBSET_GLOW2 = TEAL_SUBSET_GLOW_HEX2.map(hexToRgb2);
var L3_WARM_HEX2 = ["#8a5c2a", "#c4873a"];
var L4_GLOW_HEX2 = ["#e0a848"];
var UI_HEX2 = ["#8a8f96", "#c8cdd4", "#2a2d32", "#0f1114"];
var DANGER_HEX2 = ["#cc3333"];
var WARNING_HEX2 = ["#b89040"];
var DEBRIS_HEX2 = ["#50463c", "#5d483e", "#4f4835"];
var DEBRIS_HEX_SET2 = new Set(DEBRIS_HEX2);
var L1_EXCLUDED_HEX2 = /* @__PURE__ */ new Set([
  ...TEAL_FAMILY_HEX2,
  ...L3_WARM_HEX2,
  ...L4_GLOW_HEX2,
  ...UI_HEX2,
  ...DANGER_HEX2,
  ...WARNING_HEX2
]);
var L1_MEAN_MAX2 = 55;
var CHROMA_TIE_EPS = 1e-9;
function hexToRgb2(hex) {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function meanRgb2(rgb) {
  return (rgb[0] + rgb[1] + rgb[2]) / 3;
}
function sameRgb(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}
function rgbDist2(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}
function chromaDir(rgb) {
  const m = Math.max(1e-6, meanRgb2(rgb));
  return [rgb[0] / m, rgb[1] / m, rgb[2] / m];
}
function chromaDist2(a, b) {
  const da = chromaDir(a);
  const db = chromaDir(b);
  return (da[0] - db[0]) ** 2 + (da[1] - db[1]) ** 2 + (da[2] - db[2]) ** 2;
}
function temperatureGroup2(r, g, b) {
  if (r - b >= 6) return "WARM";
  if (b - r >= 6) return "COOL";
  if (g >= r + 2 && g >= b + 2) return "OLIVE";
  return "NEUTRAL";
}
function buildL1Pools2() {
  const pools = {
    WARM: [],
    COOL: [],
    OLIVE: [],
    NEUTRAL: []
  };
  for (let i = 0; i < PALETTE_HEX3.length; i++) {
    const hex = PALETTE_HEX3[i];
    if (L1_EXCLUDED_HEX2.has(hex)) continue;
    const rgb = PALETTE3[i];
    if (meanRgb2(rgb) > L1_MEAN_MAX2) continue;
    pools[temperatureGroup2(rgb[0], rgb[1], rgb[2])].push(rgb);
  }
  return pools;
}
var L1_POOL_MUTABLE2 = buildL1Pools2();
var L1_POOL2 = {
  WARM: L1_POOL_MUTABLE2.WARM,
  COOL: L1_POOL_MUTABLE2.COOL,
  OLIVE: L1_POOL_MUTABLE2.OLIVE,
  NEUTRAL: L1_POOL_MUTABLE2.NEUTRAL
};
function pickByChroma(target, candidates) {
  let best = candidates[0];
  let bestChroma = Infinity;
  let bestRgb = Infinity;
  for (const c of candidates) {
    const chroma = chromaDist2(c, target);
    const rgbD = rgbDist2(c, target);
    if (chroma < bestChroma - CHROMA_TIE_EPS) {
      best = c;
      bestChroma = chroma;
      bestRgb = rgbD;
    } else if (Math.abs(chroma - bestChroma) <= CHROMA_TIE_EPS && rgbD < bestRgb) {
      best = c;
      bestRgb = rgbD;
    }
  }
  return best;
}
function unused(candidates, used) {
  return candidates.filter((c) => !used.some((u) => sameRgb(u, c)));
}
function quantizeInGroup(targetRgb, subset, used = []) {
  const remaining = unused(subset, used);
  if (remaining.length > 0) {
    return pickByChroma(targetRgb, remaining);
  }
  console.warn(
    "[palette-quantize] candidate pool empty after used-filter; falling back to NEUTRAL L1 pool"
  );
  const neutralFree = unused(L1_POOL2.NEUTRAL, used);
  if (neutralFree.length > 0) {
    return pickByChroma(targetRgb, neutralFree);
  }
  console.warn(
    "[palette-quantize] NEUTRAL L1 pool also exhausted; returning a NEUTRAL cell, not full-palette nearest"
  );
  const neutral = L1_POOL2.NEUTRAL;
  if (neutral.length > 0) {
    return pickByChroma(targetRgb, neutral);
  }
  return PALETTE3[0];
}

// src/generation/preview-paint.ts
var PALETTE_HEX4 = [
  "#080a0c",
  "#0a0b0d",
  "#0d1114",
  "#151a1e",
  "#2a2420",
  "#1e2228",
  "#2a2018",
  "#24221e",
  "#1a1e18",
  "#2c2e33",
  "#3a3d42",
  "#4a4e55",
  "#5a5f66",
  "#8a5c2a",
  "#c4873a",
  "#1a7a9a",
  "#0e4a3f",
  "#1a6b5c",
  "#1aad96",
  "#2ae6c8",
  "#3cffd4",
  "#7fffee",
  "#4adf8a",
  "#b0fff5",
  "#e0a848",
  "#2e2d30",
  "#2a2a2e",
  "#3a3838",
  "#1a1c1f",
  "#2a1f1c",
  "#50463c",
  "#5d483e",
  "#4f4835",
  "#8a8f96",
  "#c8cdd4",
  "#cc3333",
  "#b89040",
  "#2a2d32",
  "#0f1114"
];
var PALETTE4 = PALETTE_HEX4.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
]);
var PALETTE_WITHOUT_DEBRIS2 = PALETTE4.filter(
  (_rgb, i) => !DEBRIS_HEX_SET2.has(PALETTE_HEX4[i])
);
var PALETTE_HEX_SET2 = new Set(PALETTE_HEX4.map((h) => h.toLowerCase()));
function clamp255(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}
var CLUSTER_TEAL_RGB2 = [
  ...TEAL_SUBSET_DEEP_MID2,
  ...TEAL_SUBSET_CORE2,
  ...TEAL_SUBSET_GLOW2
];
function clamp01(n) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
function rgbToHsv(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === rn) h = (gn - bn) / d % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max < 1e-6 ? 0 : d / max, v: max };
}
function hsvToRgb(h, s, v) {
  const hh = (h % 1 + 1) % 1;
  const c = v * s;
  const x = c * (1 - Math.abs(hh * 6 % 2 - 1));
  const m = v - c;
  const i = hh * 6 | 0;
  let r = 0;
  let g = 0;
  let b = 0;
  if (i === 0) {
    r = c;
    g = x;
  } else if (i === 1) {
    r = x;
    g = c;
  } else if (i === 2) {
    g = c;
    b = x;
  } else if (i === 3) {
    g = x;
    b = c;
  } else if (i === 4) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
function toRgb(t) {
  return [clamp255(t[0]), clamp255(t[1]), clamp255(t[2])];
}
function clampHueWindow(h) {
  return h < 0.42 ? 0.42 : h > 0.56 ? 0.56 : h;
}
function deriveContamRamp(def, age, seed) {
  const floorRgb = [
    clamp255(def.floorBv * def.floorBiasR),
    clamp255(def.floorBv * def.floorBiasG),
    clamp255(def.floorBv * def.floorBiasB)
  ];
  const fh = rgbToHsv(floorRgb[0], floorRgb[1], floorRgb[2]);
  const wh = rgbToHsv(def.wallBv * def.wallBiasR, def.wallBv * def.wallBiasG, def.wallBv * def.wallBiasB);
  const mapHue = fh.s < 0.06 && wh.s < 0.06 ? 0.48 : fh.s >= wh.s ? fh.h : wh.h;
  const mapV = fh.v * 0.6 + wh.v * 0.4;
  const mapS = fh.s > wh.s ? fh.s : wh.s;
  const rng = new SeededRandom(mix32(seed, "contam-ramp"));
  const ageShift = age === "new" ? -0.07 : age === "ancient" ? 0.08 : 0;
  const hue = clampHueWindow(0.48 + (mapHue - 0.48) * 0.52 + ageShift + (rng.next() - 0.5) * 0.05);
  const sat = clamp01(0.5 + mapS * 0.38 + (age === "ancient" ? 0.08 : 0) + (rng.next() - 0.5) * 0.05);
  const val = clamp01(Math.max(0.36, mapV + 0.18) + (rng.next() - 0.5) * 0.04);
  const deepRgb = toRgb(hsvToRgb(hue, sat * 0.82, val * 0.68));
  const midRgb = toRgb(hsvToRgb(hue, sat, val * 0.95));
  const coreRgb = toRgb(hsvToRgb(hue, sat * 0.78, clamp01(val * 1.2)));
  const glowRgb = toRgb(hsvToRgb(hue, sat * 0.46, clamp01(val * 1.42)));
  const deep = quantizeInGroup(deepRgb, TEAL_SUBSET_DEEP_MID2, []);
  const mid = quantizeInGroup(midRgb, TEAL_SUBSET_DEEP_MID2, [deep]);
  const core = quantizeInGroup(coreRgb, TEAL_SUBSET_CORE2, [deep, mid]);
  const glow = quantizeInGroup(glowRgb, TEAL_SUBSET_GLOW2, [deep, mid, core]);
  return { deep, mid, core, glow };
}

// src/entities/form-renderers/d/fragment-ramp.ts
var LEXICON_DEFAULT_FRAGMENT = "frag-clinic";
function fragmentDef(fragmentTypeId) {
  return RIFT_FRAGMENT_DATA2[fragmentTypeId] ?? RIFT_FRAGMENT_DATA2[LEXICON_DEFAULT_FRAGMENT];
}
function deriveFragmentContamRamp(fragmentTypeId) {
  const def = fragmentDef(fragmentTypeId);
  const seed = mix32(0, `gym-frag-ramp:${def.id}`);
  return deriveContamRamp(def, "standard", seed);
}

// src/entities/form-renderers/d/paint-genome/topology.ts
var OIL_FILM_ID = "oil_film";
function oilFilmProductionVeinVariant(seed) {
  return mix32(seed, "oil_film_variant") % 3 + 3;
}
function resolvePaintVeinVariant(substrate, seed, explicit) {
  if (explicit !== void 0) return explicit;
  if (substrate === OIL_FILM_ID) return oilFilmProductionVeinVariant(seed);
  return void 0;
}
var STAGE = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2
};
var PaintRng = class {
  constructor(seed, label) {
    __publicField(this, "s");
    this.s = mix32(seed, label) | 1;
  }
  next() {
    let x = this.s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s / 4294967296;
  }
  int(lo, hi) {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
};
function topologyOf(substrate) {
  if (substrate === "oil_film") return "vein_tree";
  if (substrate === "ash_veil") return "holed_veil";
  return "lobe_mass";
}
function makePaintField(w, h, logicalSpan) {
  return { v: new Float32Array(w * h), w, h, ...logicalSpan === void 0 ? {} : { logicalSpan } };
}
function authoredSpan(field) {
  return field.logicalSpan ?? Math.min(field.w, field.h);
}
function add(f, x, y, amt) {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= f.w || iy >= f.h) return;
  const i = iy * f.w + ix;
  if (amt > f.v[i]) f.v[i] = amt;
}
function disc(f, cx, cy, r, amt) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2;
      if (d2 > r2) continue;
      add(f, x, y, amt * (1 - Math.sqrt(d2) / (r + 1e-3)) + amt * 0.2);
    }
  }
}
function dot(f, cx, cy, r, amt) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r2) continue;
      add(f, x, y, amt);
    }
  }
}
function dotFlat(f, cx, cy, ang, radAlong, radPerp, amt) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = Math.max(radAlong, radPerp) + 1;
  const a2 = radAlong * radAlong;
  const p2 = radPerp * radPerp;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if (along * along / a2 + perp * perp / p2 > 1) continue;
      add(f, x, y, amt);
    }
  }
}
function carveDisc(f, cx, cy, r) {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) f.v[y * f.w + x] = 0;
    }
  }
}
function radialCrack(f, cx, cy, ang, r0, r1, halfW) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const pad = r1 + halfW + 1;
  for (let y = Math.floor(cy - pad); y <= cy + pad; y++) {
    for (let x = Math.floor(cx - pad); x <= cx + pad; x++) {
      if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
      const dx = x - cx;
      const dy = y - cy;
      const along = dx * c + dy * s;
      const perp = -dx * s + dy * c;
      if (along < r0 || along > r1) continue;
      if (Math.abs(perp) > halfW) continue;
      f.v[y * f.w + x] = 0;
    }
  }
}
function stroke(f, x0, y0, x1, y1, r, amt) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    dot(f, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, amt);
  }
}
function senseAngleOf(sense) {
  if (sense === "sense_scent") return Math.PI * 2 / 3;
  if (sense === "sense_domain") return Math.PI * 4 / 3;
  if (sense === "sense_hear") return Math.PI / 2;
  if (sense === "sense_narrow") return 0.18;
  if (sense === "sense_reverse") return Math.PI;
  if (sense === "sense_cone") return -Math.PI / 2;
  return 0;
}
function rhythmKnobsOf(rhythm) {
  if (rhythm === "rhythm_pulse") {
    return { lobeExtra: 3, lobeAmp: 0.4, branchMul: 1.35, zigzag: 0.78, veilHoles: 2, veilWarp: 0.3 };
  }
  if (rhythm === "rhythm_sleep") {
    return { lobeExtra: -1, lobeAmp: 0.14, branchMul: 0.62, zigzag: 0.16, veilHoles: 0, veilWarp: 0.08 };
  }
  if (rhythm === "rhythm_cluster") {
    return { lobeExtra: 1, lobeAmp: 0.28, branchMul: 1.08, zigzag: 0.42, veilHoles: 1, veilWarp: 0.2 };
  }
  return { lobeExtra: 0, lobeAmp: 0.22, branchMul: 1, zigzag: 0.3, veilHoles: 0, veilWarp: 0.14 };
}
function placementsOf(f, continuity, topo, senseAng, rng) {
  const cx = f.w / 2;
  const cy = f.h / 2;
  const span = authoredSpan(f);
  const tree = topo === "vein_tree";
  if (continuity === "monolith") {
    return [{ cx, cy, scale: 1 }];
  }
  if (continuity === "shards") {
    const n = 3 + rng.int(0, 1);
    const out2 = [];
    for (let i = 0; i < n; i++) {
      const a = senseAng + i / n * Math.PI * 2 + (rng.next() - 0.5) * 0.35;
      const d = span * (0.3 + rng.next() * 0.06);
      out2.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.3 + rng.next() * 0.05
      });
    }
    return out2;
  }
  if (continuity === "field") {
    const out2 = [{ cx, cy, scale: 1.18 }];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = senseAng + i / n * Math.PI * 2 + rng.next() * 0.25;
      const d = span * (0.4 + rng.next() * 0.05);
      out2.push({
        cx: cx + Math.cos(a) * d,
        cy: cy + Math.sin(a) * d,
        scale: 0.4 + rng.next() * 0.05
      });
    }
    return out2;
  }
  const nSat = 3;
  const out = [{ cx, cy, scale: tree ? 0.5 : 0.8 }];
  const satScale = tree ? 0.48 : 0.36;
  for (let i = 0; i < nSat; i++) {
    const a = senseAng + (i + 1) / (nSat + 1) * Math.PI * 2 + (rng.next() - 0.5) * 0.1;
    const d = span * 0.46;
    out.push({
      cx: cx + Math.cos(a) * d,
      cy: cy + Math.sin(a) * d,
      scale: satScale
    });
  }
  return out;
}
function lobeMass(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const R = Math.max(7, authoredSpan(f) * 0.33 * scale);
  const lobes = Math.max(3, 4 + knobs.lobeExtra);
  const amp = knobs.lobeAmp;
  const phi = senseAng;
  for (let y = 0; y < f.h; y++) {
    for (let x = 0; x < f.w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const bound = R * (1 + amp * Math.cos(lobes * a + phi));
      if (d > bound) continue;
      add(f, x, y, 1 - d / bound * 0.45);
    }
  }
  if (stage < 1) return;
  const kids = stage === 1 ? 5 : 6;
  for (let i = 0; i < kids; i++) {
    const a = senseAng + i / kids * Math.PI * 2 + rng.next() * 0.18;
    const push = 1.34 + rng.next() * 0.28;
    disc(f, cx + Math.cos(a) * R * push, cy + Math.sin(a) * R * push, R * (0.3 + rng.next() * 0.1), 0.96);
  }
  const notchA = senseAng + Math.PI * 0.55;
  carveDisc(f, cx + Math.cos(notchA) * R * 1.02, cy + Math.sin(notchA) * R * 1.02, R * 0.42);
  if (stage < 2) return;
  radialCrack(f, cx, cy, senseAng + 0.4, R * 0.48, R * 1.4, Math.max(3.2, 3.8 * scale));
  radialCrack(f, cx, cy, senseAng + 1.85, R * 0.48, R * 1.35, Math.max(2.8, 3.4 * scale));
  radialCrack(f, cx, cy, senseAng + 3.3, R * 0.55, R * 1.25, Math.max(2.4, 3 * scale));
}
function veinTree(f, rng, stage, cx, cy, scale, senseAng, knobs, variant) {
  if (variant === 0) {
    veinTreeFlat(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 2) {
    veinTreeConverge(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 3) {
    oilFilmBeads(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 4) {
    oilFilmSmear(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  if (variant === 5) {
    oilFilmRimPool(f, rng, stage, cx, cy, scale, senseAng, knobs);
    return;
  }
  const thick = Math.max(0.85, 1.2 * scale);
  const loopR = Math.max(1.9, 2.15 * scale);
  const baseLen = authoredSpan(f) * 0.34 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag;
  const ends = [];
  const walk = (x, y, ang, len, t, depth) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(5, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.65, t * (1 - s / (steps * 1.9)));
      dot(f, px, py, rad, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? stage >= 1 ? 4 : 2 : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.95 + stage * 0.4;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.28;
      walk(px, py, fork, len * (0.55 + rng.next() * 0.18), t * 0.74, depth + 1);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 1.25 : -1.25);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.28,
      cy + Math.sin(senseAng) * baseLen * 0.28,
      side,
      baseLen * 0.85,
      thick * 0.82,
      0
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
      if (d < 8 || d > 26) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const used = /* @__PURE__ */ new Set();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 2) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    stroke(f, ends[p.i].x, ends[p.i].y, ends[p.j].x, ends[p.j].y, loopR, 0.9);
    loops += 1;
  }
}
function veinTreeFlat(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const thick = Math.max(0.95, 1.15 * scale);
  const loopR = Math.max(1.1, 1.25 * scale);
  const baseLen = authoredSpan(f) * 0.36 * scale;
  const maxDepth = 2 + stage;
  const zigzag = knobs.zigzag * 0.18;
  const ends = [];
  const walk = (x, y, ang, len, t, depth) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const fade = 1 - s / (steps * 1.55);
      const radAlong = Math.max(1.2, t * 1.9 * fade);
      const radPerp = Math.max(0.28, t * 0.36 * fade);
      dotFlat(f, px, py, a, radAlong, radPerp, 0.9);
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    let kids = depth === 0 ? stage >= 1 ? 3 : 2 : stage >= 1 ? 2 : 1;
    kids = Math.max(1, Math.round(kids * knobs.branchMul * 0.85));
    if (knobs.branchMul < 0.8 && depth > 0) kids = 1;
    const spread = 0.7 + stage * 0.28;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.12;
      walk(px, py, fork, len * (0.58 + rng.next() * 0.12), t * 0.7, depth + 1);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0);
  if (stage >= 1) {
    const side = senseAng + (rng.next() < 0.5 ? 0.85 : -0.85);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.22,
      cy + Math.sin(senseAng) * baseLen * 0.22,
      side,
      baseLen * 0.72,
      thick * 0.7,
      0
    );
  }
  if (stage < 2 || ends.length < 2) return;
  const pairs = [];
  for (let i = 0; i < ends.length; i++) {
    for (let j = i + 1; j < ends.length; j++) {
      const d = Math.hypot(ends[j].x - ends[i].x, ends[j].y - ends[i].y);
      if (d < 10 || d > 22) continue;
      pairs.push({ i, j, d });
    }
  }
  pairs.sort((left, right) => left.d - right.d);
  const used = /* @__PURE__ */ new Set();
  let loops = 0;
  for (const p of pairs) {
    if (loops >= 1) break;
    if (used.has(p.i) || used.has(p.j)) continue;
    used.add(p.i);
    used.add(p.j);
    const ang = Math.atan2(ends[p.j].y - ends[p.i].y, ends[p.j].x - ends[p.i].x);
    const steps = Math.max(1, Math.ceil(p.d));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      dotFlat(
        f,
        ends[p.i].x + (ends[p.j].x - ends[p.i].x) * t,
        ends[p.i].y + (ends[p.j].y - ends[p.i].y) * t,
        ang,
        loopR * 1.4,
        loopR * 0.35,
        0.88
      );
    }
    loops += 1;
  }
}
function veinTreeConverge(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const thick = Math.max(1.05, 1.4 * scale);
  const baseLen = authoredSpan(f) * 0.38 * scale;
  const maxDepth = 1 + (stage >= 1 ? 1 : 0);
  const zigzag = knobs.zigzag * 0.28;
  const trunk = [];
  const ends = [];
  const walk = (x, y, ang, len, t, depth, recordTrunk) => {
    let px = x;
    let py = y;
    let a = ang;
    const steps = Math.max(6, Math.round(len));
    for (let s = 0; s < steps; s++) {
      a += (rng.next() - 0.5) * zigzag;
      px += Math.cos(a);
      py += Math.sin(a);
      const rad = Math.max(0.75, t * (1 - s / (steps * 2.6)));
      dot(f, px, py, rad, 0.9);
      if (recordTrunk) trunk.push({ x: px, y: py });
    }
    ends.push({ x: px, y: py });
    if (depth >= maxDepth) return;
    const kids = depth === 0 ? 2 : 1;
    const spread = 0.48 + stage * 0.12;
    for (let k = 0; k < kids; k++) {
      const fork = a + (k - (kids - 1) / 2) * spread + (rng.next() - 0.5) * 0.1;
      walk(px, py, fork, len * (0.6 + rng.next() * 0.08), t * 0.58, depth + 1, false);
    }
  };
  walk(cx, cy, senseAng, baseLen, thick, 0, true);
  if (stage >= 2 && knobs.branchMul > 0.9) {
    const side = senseAng + (rng.next() < 0.5 ? 0.55 : -0.55);
    walk(
      cx + Math.cos(senseAng) * baseLen * 0.18,
      cy + Math.sin(senseAng) * baseLen * 0.18,
      side,
      baseLen * 0.55,
      thick * 0.62,
      1,
      false
    );
  }
  for (const end of ends) {
    let bestX = trunk[0]?.x ?? cx;
    let bestY = trunk[0]?.y ?? cy;
    let bestD = Infinity;
    for (const p of trunk) {
      const d = Math.hypot(end.x - p.x, end.y - p.y);
      if (d < bestD) {
        bestD = d;
        bestX = p.x;
        bestY = p.y;
      }
    }
    if (bestD > 5 && bestD < 30) {
      stroke(f, end.x, end.y, bestX, bestY, Math.max(0.65, thick * 0.42), 0.86);
    }
  }
}
function oilFilmBeads(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.35;
  const merge = stage >= 2 ? 1.32 : 1;
  const beads = [];
  const rMain = Math.max(5.5, span * 0.16 * s) * merge;
  beads.push({ x: cx, y: cy, r: rMain, fine: false });
  const rMed = Math.max(2.4, span * 0.055 * s) * merge;
  for (let i = 0; i < 2; i++) {
    const side = i === 0 ? 1 : -1;
    const a = senseAng + side * (0.65 + rng.next() * 0.45) + (rng.next() - 0.5) * 0.28 * (0.6 + knobs.zigzag);
    const d = rMain * (0.95 + rng.next() * 0.2);
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: rMed,
      fine: false
    });
  }
  const nFine = 4 + stage;
  const dFineMin = rMain * 1.3;
  const dFineMax = span * 0.34 * s;
  for (let i = 0; i < nFine; i++) {
    const a = senseAng + ((i + 0.5) / nFine - 0.5) * 2.1 + (rng.next() - 0.5) * 0.55;
    const spanD = Math.max(0, dFineMax - dFineMin);
    const d = dFineMin + rng.next() * spanD;
    if (d < rMain) continue;
    beads.push({
      x: cx + Math.cos(a) * d,
      y: cy + Math.sin(a) * d,
      r: Math.max(1.05, span * 0.018 * s) * merge,
      fine: true
    });
  }
  const sum = new Float32Array(f.w * f.h);
  for (const b of beads) {
    const reach = b.r * 2.2;
    const pad = reach + 1;
    for (let y = Math.floor(b.y - pad); y <= b.y + pad; y++) {
      for (let x = Math.floor(b.x - pad); x <= b.x + pad; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const t = 1 - Math.hypot(x - b.x, y - b.y) / reach;
        if (t <= 0) continue;
        sum[y * f.w + x] = sum[y * f.w + x] + t * t;
      }
    }
  }
  for (let i = 0; i < sum.length; i++) {
    const field = sum[i];
    const x = i % f.w;
    const y = i / f.w | 0;
    if (field >= 0.62) add(f, x, y, 0.9);
    else if (field >= 0.4) add(f, x, y, 0.66);
    else if (field >= 0.26) add(f, x, y, 0.3);
  }
  for (const b of beads) {
    if (b.fine) {
      dot(f, b.x, b.y, b.r, 1.38);
    } else if (b.r >= 2.2) {
      disc(f, b.x, b.y, b.r * 0.35, 1.45);
    }
  }
  if (stage < 2 || beads.length < 3) return;
  const pool = beads[0];
  const far = beads.slice(1).map((b, i) => ({ b, i, d: Math.hypot(b.x - pool.x, b.y - pool.y) })).sort((left, right) => right.d - left.d).slice(0, 2);
  for (const g of far) {
    if (g.d < 6 || g.d > 30) continue;
    stroke(f, pool.x, pool.y, g.b.x, g.b.y, Math.max(0.9, 1.1 * s), 0.66);
  }
}
function oilFilmSmear(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.6;
  const strokes = 1 + stage;
  for (let i = 0; i < strokes; i++) {
    const side = i > 0;
    const baseA = senseAng + (i - (strokes - 1) / 2) * (0.5 + knobs.zigzag * 0.4) + (rng.next() - 0.5) * 0.2;
    const len = span * (0.5 + rng.next() * 0.08) * s * (side ? 0.72 : 1);
    const curl = (rng.next() - 0.5) * 0.9;
    const wHead = Math.max(4.4, 6.8 * s) * (side ? 0.48 : 1);
    const wTail = Math.max(0.55, 0.8 * s);
    const amtMul = side ? 0.55 : 1;
    let px = cx - Math.cos(baseA) * len * 0.42;
    let py = cy - Math.sin(baseA) * len * 0.42;
    const steps = Math.max(8, Math.round(len));
    for (let step = 0; step < steps; step++) {
      const t = step / steps;
      const a = baseA + curl * t;
      px += Math.cos(a);
      py += Math.sin(a);
      const w = wHead + (wTail - wHead) * t;
      const amt = 1.42 * (1 - t * 0.62) * amtMul;
      disc(f, px, py, w * 2.6, 0.4);
      disc(f, px, py, w, amt);
    }
  }
}
function oilFilmRimPool(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const s = scale * 1.35;
  const blobs = 1 + (stage >= 2 ? 1 : 0);
  const at2 = (x, y) => x < 0 || y < 0 || x >= f.w || y >= f.h ? 0 : f.v[y * f.w + x];
  for (let b = 0; b < blobs; b++) {
    const ba = senseAng + b * 1.9 + (rng.next() - 0.5) * 0.4;
    const bd = b === 0 ? 0 : span * 0.2 * scale;
    const bx = cx + Math.cos(ba) * bd;
    const by = cy + Math.sin(ba) * bd;
    const R = Math.max(8, span * (0.28 + stage * 0.03) * s);
    const h1 = rng.next() * Math.PI * 2;
    const h2 = rng.next() * Math.PI * 2;
    const a1 = 0.08 + knobs.veilWarp * 0.4 + rng.next() * 0.04;
    const a2 = 0.05 + rng.next() * 0.05;
    const pad = R * 1.35 + 1;
    const x0 = Math.floor(bx - pad);
    const x1 = Math.ceil(bx + pad);
    const y0 = Math.floor(by - pad);
    const y1 = Math.ceil(by + pad);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (d > bound - 2.2 && d <= bound - 1) add(f, x, y, 0.48);
        else add(f, x, y, 0.34);
      }
    }
    const gathers = 1 + stage;
    for (let g = 0; g < gathers; g++) {
      const ga = rng.next() * Math.PI * 2;
      const gd = rng.next() * R * 0.45;
      disc(f, bx + Math.cos(ga) * gd, by + Math.sin(ga) * gd, Math.max(1.1, R * 0.12), 0.38);
    }
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
        const d = Math.hypot(x - bx, y - by);
        const ang = Math.atan2(y - by, x - bx);
        const bound = R * (1 + a1 * Math.cos(2 * ang + h1) + a2 * Math.cos(3 * ang + h2));
        if (d > bound) continue;
        if (!(at2(x + 1, y) < 0.1 || at2(x - 1, y) < 0.1 || at2(x, y + 1) < 0.1 || at2(x, y - 1) < 0.1)) {
          continue;
        }
        const amt = 1.52 * (0.62 + 0.38 * (0.5 + 0.5 * Math.cos(ang - senseAng)));
        add(f, x, y, amt);
      }
    }
  }
}
function addEllipseRing(f, cx, cy, rx, ry, irx, iry, warp, k, phi, rot, amt, gapCount = 0, gapFrac = 0) {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const pad = Math.max(rx, ry) + 2;
  const x0 = Math.max(0, Math.floor(cx - pad));
  const x1 = Math.min(f.w - 1, Math.ceil(cx + pad));
  const y0 = Math.max(0, Math.floor(cy - pad));
  const y1 = Math.min(f.h - 1, Math.ceil(cy + pad));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * c + dy * s;
      const ly = -dx * s + dy * c;
      const a = Math.atan2(ly, lx);
      if (gapCount > 0 && gapFrac > 0) {
        const t = ((a - phi) / (Math.PI * 2) + 8) % 1;
        const u = t * gapCount % 1;
        if (u < gapFrac) continue;
      }
      const bound = 1 + warp * Math.cos(k * a + phi);
      const outerD = Math.hypot(lx / rx, ly / ry);
      if (outerD > bound) continue;
      const innerD = Math.hypot(lx / Math.max(0.5, irx), ly / Math.max(0.5, iry));
      if (innerD < bound) continue;
      add(f, x, y, amt);
    }
  }
}
function holedVeil(f, rng, stage, cx, cy, scale, senseAng, knobs) {
  const span = authoredSpan(f);
  const grow = stage === 1 ? 1.28 : 1;
  const rx = Math.max(10, span * 0.42 * scale * grow);
  const ry = Math.max(8, span * (stage === 1 ? 0.24 : 0.3) * scale * (stage === 1 ? 1.08 : 1));
  const ringW = stage === 0 ? Math.max(3.8, 4.8 * scale) : Math.max(3.4, 3.9 * scale);
  const irx = Math.max(3, rx - ringW);
  const iry = Math.max(3, ry - ringW);
  const k = 3 + (knobs.lobeExtra > 1 ? 2 : 0);
  const gaps = stage === 1 ? 5 : 0;
  const gapFrac = stage === 1 ? 0.42 : 0;
  addEllipseRing(f, cx, cy, rx, ry, irx, iry, knobs.veilWarp, k, senseAng, senseAng, 0.9, gaps, gapFrac);
  if (stage >= 2 && scale >= 0.4) {
    const holes = 4 + knobs.veilHoles;
    const midRx = (rx + irx) * 0.5;
    const midRy = (ry + iry) * 0.5;
    for (let i = 0; i < holes; i++) {
      const a = senseAng + i / holes * Math.PI * 2 + rng.next() * 0.08;
      carveDisc(f, cx + Math.cos(a) * midRx, cy + Math.sin(a) * midRy, ringW * 1.35);
    }
  }
  if (stage < 2) return;
  const nrx = rx * 0.68;
  const nry = ry * 0.68;
  const nestedW = Math.max(3.2, 3.6 * scale);
  addEllipseRing(
    f,
    cx,
    cy,
    nrx,
    nry,
    Math.max(2, nrx - nestedW),
    Math.max(2, nry - nestedW),
    knobs.veilWarp * 0.55,
    k,
    senseAng + 0.5,
    senseAng,
    0.94
  );
}
function drawUnit(f, topo, rng, stage, p, senseAng, knobs, variant) {
  if (topo === "lobe_mass") lobeMass(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
  else if (topo === "vein_tree") veinTree(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs, variant);
  else holedVeil(f, rng, stage, p.cx, p.cy, p.scale, senseAng, knobs);
}
function materialColony(f, p, seed, stage, ash) {
  const span = authoredSpan(f) * p.scale;
  const count = ash ? 4 + stage : 5 + stage * 2;
  const rng = new PaintRng(seed, ash ? "ash-lamina" : "fungal-shelves");
  for (let k = 0; k < count; k++) {
    const angle = rng.next() * Math.PI * 2;
    const cx = p.cx + Math.cos(angle) * span * 0.16, cy = p.cy + Math.sin(angle) * span * 0.12;
    const rx = span * (ash ? 0.25 : 0.17) * (1 + rng.next() * 0.3), ry = span * (ash ? 0.055 : 0.12) * (1 + rng.next() * 0.3);
    for (let y = Math.floor(cy - ry * 1.5); y <= cy + ry * 1.5; y++) for (let x = Math.floor(cx - rx * 1.3); x <= cx + rx * 1.3; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const warp = Math.sin(dx * 7 + k) * (0.08 + stage * 0.05) + Math.sin(dy * 5 + k) * 0.05;
      if (dx * dx + dy * dy > 1 + warp) continue;
      if (stage > 0 && Math.sin(dx * 5 + dy * 2 + k) > 0.91 && Math.abs(dx) > 0.4) continue;
      add(f, x, y, 0.55 + Math.max(0, 1 - dx * dx - dy * dy) * 0.4);
    }
  }
}
function fillPaintTopology(field, opts) {
  const topo = topologyOf(opts.substrate);
  const coverage = opts.coverage;
  const continuity = opts.continuity ?? "colony";
  const sense = opts.sense ?? "sense_touch";
  const rhythm = opts.rhythm ?? "rhythm_open";
  const veinTag = opts.veinVariant === void 0 ? "" : `:v${opts.veinVariant}`;
  const rng = new PaintRng(opts.seed, `paint:${topo}:${coverage}:${continuity}:${sense}:${rhythm}${veinTag}`);
  const senseAng = senseAngleOf(sense);
  const knobs = rhythmKnobsOf(rhythm);
  const stage = STAGE[coverage];
  const placements = placementsOf(field, continuity, topo, senseAng, rng);
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    const unitRng = new PaintRng(
      mix32(opts.seed, `u:${i}`),
      `paint-unit:${topo}:${coverage}:${sense}:${rhythm}${veinTag}`
    );
    if (opts.substrate === "fungal_mat" || opts.substrate === "ash_veil")
      materialColony(field, p, mix32(opts.seed, `material:${i}`), stage, opts.substrate === "ash_veil");
    else drawUnit(field, topo, unitRng, stage, p, senseAng, knobs, opts.veinVariant);
  }
  return topo;
}

// src/entities/form-renderers/d/paint-genome/bake.ts
var PAINT_GROWTH_UNIT_CAP = 12;
var PAINT_INFLATED_AMP = 0.18;
function paintGenomeCanvasOf(continuity = "colony") {
  const field = continuity === "field";
  return { w: field ? 144 : 88, h: field ? 144 : 88 };
}
function collectPaintGenomeFloorTiles(field, w, h, originX, originY, tileSize) {
  const left = originX - w * 0.5;
  const top = originY - h * 0.5;
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (field[y * w + x] < 0.1) continue;
      const col = Math.floor((left + x + 0.5) / tileSize);
      const row = Math.floor((top + y + 0.5) / tileSize);
      const key = `${col},${row}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ col, row });
    }
  }
  return out;
}
function reserveBreathingFootprint(field, w, h, radius) {
  const horizontal = new Uint8Array(field.length);
  const result = new Float32Array(field.length);
  for (let y = 0; y < h; y++) {
    let count = 0;
    for (let x = -radius; x < w; x++) {
      const incoming = x + radius;
      if (incoming < w && field[y * w + incoming] >= 0.1) count++;
      const outgoing = x - radius - 1;
      if (outgoing >= 0 && field[y * w + outgoing] >= 0.1) count--;
      if (x >= 0) horizontal[y * w + x] = count > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < w; x++) {
    let count = 0;
    for (let y = -radius; y < h; y++) {
      const incoming = y + radius;
      if (incoming < h) count += horizontal[incoming * w + x];
      const outgoing = y - radius - 1;
      if (outgoing >= 0) count -= horizontal[outgoing * w + x];
      if (y >= 0 && count > 0) result[y * w + x] = 1;
    }
  }
  return result;
}
function topologyCanvas(req) {
  const continuity = req.continuity ?? "colony";
  const authored = paintGenomeCanvasOf(continuity);
  const options = {
    substrate: req.substrate,
    coverage: req.coverage,
    seed: req.seed,
    continuity,
    sense: req.sense ?? "sense_touch",
    rhythm: req.rhythm ?? "rhythm_open",
    veinVariant: req.veinVariant
  };
  if (req.geometryVersion === 1) {
    const field = makePaintField(authored.w, authored.h);
    return { field, topology: fillPaintTopology(field, options) };
  }
  let padding = Math.max(authored.w, authored.h);
  for (let attempt = 0; attempt < 4; attempt++, padding *= 2) {
    const field = makePaintField(
      authored.w + padding * 2,
      authored.h + padding * 2,
      Math.min(authored.w, authored.h)
    );
    const topology = fillPaintTopology(field, options);
    let minX = field.w, minY = field.h, maxX = -1, maxY = -1;
    for (let y = 0; y < field.h; y++) for (let x = 0; x < field.w; x++) {
      if (field.v[y * field.w + x] < 0.1) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const clearance = Math.ceil(Math.hypot(maxX - minX + 1, maxY - minY + 1) * PAINT_INFLATED_AMP) + 4;
    if (maxX < 0 || Math.min(minX, minY, field.w - 1 - maxX, field.h - 1 - maxY) >= clearance)
      return { field, topology };
  }
  throw new Error(`[paint-genome] complete geometry exceeds bounded canvas: ${req.substrate}/${continuity}/${req.seed}`);
}
var CORE_TEALS = [
  [26, 173, 150],
  [42, 230, 200],
  [60, 255, 212]
];
function snapBright(rgb) {
  let best = CORE_TEALS[0];
  let bestD = Infinity;
  for (const p of CORE_TEALS) {
    const d = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}
function fragmentRamp(fragmentTypeId) {
  const ramp = deriveFragmentContamRamp(fragmentTypeId);
  return {
    deep: ramp.deep,
    mid: ramp.mid,
    core: snapBright(ramp.core),
    glow: snapBright(ramp.glow)
  };
}
var STAGE2 = {
  infiltrate: 0,
  rewrite: 1,
  overwrite: 2
};
function applyFilmSheen(field) {
  const { v, w, h } = field;
  const next = new Float32Array(v);
  const at2 = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return v[y * w + x];
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const cur = v[i];
      const n = at2(x, y - 1);
      const s = at2(x, y + 1);
      const e = at2(x + 1, y);
      const west = at2(x - 1, y);
      const emptyN = (n < 0.1 ? 1 : 0) + (s < 0.1 ? 1 : 0) + (e < 0.1 ? 1 : 0) + (west < 0.1 ? 1 : 0);
      if (cur >= 0.1) {
        if (emptyN >= 3) next[i] = 1;
        else if (emptyN >= 1) next[i] = Math.max(cur, 0.86);
      } else if (n >= 0.1 || s >= 0.1 || e >= 0.1 || west >= 0.1) {
        next[i] = 0.26;
      }
    }
  }
  v.set(next);
}
function lobeCountOf(rhythm) {
  if (rhythm === "rhythm_pulse") return 7;
  if (rhythm === "rhythm_sleep") return 3;
  if (rhythm === "rhythm_cluster") return 5;
  return 4;
}
function pickGrowthUnit(x, y, topology, unitCount, ox, oy, innerR, outerR) {
  if (unitCount <= 1) return 0;
  let nearest = 0;
  let nearestD = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dx = x - ox[i];
    const dy = y - oy[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < nearestD) {
      nearestD = d2;
      nearest = i;
    }
  }
  if (topology !== "holed_veil") return nearest;
  const originX = ox[nearest];
  const originY = oy[nearest];
  const r = Math.hypot(x - originX, y - originY);
  let band = nearest;
  let bestErr = Infinity;
  for (let i = 0; i < unitCount; i++) {
    const dOx = ox[i] - originX;
    const dOy = oy[i] - originY;
    if (dOx * dOx + dOy * dOy > 144) continue;
    const mid = 0.5 * (innerR[i] + outerR[i]);
    const err = Math.abs(r - mid);
    if (err < bestErr) {
      bestErr = err;
      band = i;
    }
  }
  return band;
}
function collectBeadPeaks(field, w, h) {
  const raw = [];
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      const i = y * w + x;
      const v = field[i];
      if (v < 0.42) continue;
      let higher = 0;
      for (let oyOff = -2; oyOff <= 2; oyOff++) {
        for (let oxOff = -2; oxOff <= 2; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          if (field[(y + oyOff) * w + (x + oxOff)] > v + 1e-6) higher += 1;
        }
      }
      if (higher > 0) continue;
      raw.push({ x: x + 0.5, y: y + 0.5, v });
    }
  }
  raw.sort((a, b) => b.v - a.v || a.y - b.y || a.x - b.x);
  const kept = [];
  const minD2 = 49;
  const floor = raw[0] !== void 0 ? raw[0].v * 0.72 : 1;
  for (const p of raw) {
    if (p.v < floor) break;
    if (kept.some((q) => (p.x - q.x) ** 2 + (p.y - q.y) ** 2 < minD2)) continue;
    kept.push(p);
    if (kept.length >= PAINT_GROWTH_UNIT_CAP) break;
  }
  return kept;
}
function assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR) {
  const unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      unitIndex[y * w + x] = pickGrowthUnit(
        x + 0.5,
        y + 0.5,
        topology,
        unitCount,
        ox,
        oy,
        innerR,
        outerR
      );
    }
  }
  return unitIndex;
}
function buildBeadGrowthGuide(field, w, h, topology, sense, rhythm) {
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const peaks = collectBeadPeaks(field, w, h);
  let unitCount = 0;
  for (const p of peaks) {
    ox[unitCount] = p.x;
    oy[unitCount] = p.y;
    unitCount += 1;
  }
  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.2;
    outerR[0] = span[0];
    unitCount = 1;
  }
  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);
  if (peaks.length > 0) {
    const maxR = new Float32Array(unitCount);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (field[i] < 0.1) continue;
        const u = unitIndex[i];
        const r = Math.hypot(x + 0.5 - ox[u], y + 0.5 - oy[u]);
        if (r > maxR[u]) maxR[u] = r;
      }
    }
    for (let u = 0; u < unitCount; u++) {
      span[u] = Math.max(1.5, maxR[u]);
      outerR[u] = span[u];
    }
  }
  return {
    topology,
    veinVariant: 3,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex
  };
}
function buildPaintGrowthGuide(field, w, h, topology, sense, rhythm, veinVariant) {
  if (veinVariant === 3) return buildBeadGrowthGuide(field, w, h, topology, sense, rhythm);
  const senseAngle = senseAngleOf(sense);
  const lobeCount = lobeCountOf(rhythm);
  const cs = Math.cos(senseAngle);
  const sn = Math.sin(senseAngle);
  const ox = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const oy = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const span = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const innerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const outerR = new Float32Array(PAINT_GROWTH_UNIT_CAP);
  const visited = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const comp = new Int32Array(w * h);
  let unitCount = 0;
  const rimPool = veinVariant === 5;
  for (let start = 0; start < w * h; start++) {
    if (visited[start] || field[start] < 0.1) continue;
    let top = 0;
    let n = 0;
    stack[top++] = start;
    visited[start] = 1;
    let sumX = 0;
    let sumY = 0;
    let minAlong = Infinity;
    let rootX = 0;
    let rootY = 0;
    let minX = w;
    let minY = h;
    let maxX = 0;
    let maxY = 0;
    while (top > 0) {
      const p = stack[--top];
      comp[n++] = p;
      const x = p % w;
      const y = p / w | 0;
      sumX += x;
      sumY += y;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      const along = x * cs + y * sn;
      if (along < minAlong) {
        minAlong = along;
        rootX = x;
        rootY = y;
      }
      for (let oyOff = -1; oyOff <= 1; oyOff++) {
        for (let oxOff = -1; oxOff <= 1; oxOff++) {
          if (oxOff === 0 && oyOff === 0) continue;
          const nx = x + oxOff;
          const ny = y + oyOff;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (visited[q] || field[q] < 0.1) continue;
          visited[q] = 1;
          stack[top++] = q;
        }
      }
    }
    if (n < 8 || unitCount >= PAINT_GROWTH_UNIT_CAP) continue;
    let ux;
    let uy;
    if (topology === "vein_tree" && !rimPool) {
      ux = rootX + 0.5;
      uy = rootY + 0.5;
    } else if (topology === "holed_veil") {
      ux = (minX + maxX) * 0.5 + 0.5;
      uy = (minY + maxY) * 0.5 + 0.5;
    } else {
      ux = sumX / n + 0.5;
      uy = sumY / n + 0.5;
    }
    let minR = Infinity;
    let maxR = 0;
    let maxAlongRel = 0;
    for (let k = 0; k < n; k++) {
      const p = comp[k];
      const px = p % w + 0.5;
      const py = (p / w | 0) + 0.5;
      const r = Math.hypot(px - ux, py - uy);
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
      const alongRel = (px - ux) * cs + (py - uy) * sn;
      if (alongRel > maxAlongRel) maxAlongRel = alongRel;
    }
    if (maxR < 2) continue;
    ox[unitCount] = ux;
    oy[unitCount] = uy;
    span[unitCount] = topology === "vein_tree" && !rimPool ? Math.max(1, maxAlongRel) : maxR;
    innerR[unitCount] = topology === "holed_veil" ? minR : 0;
    outerR[unitCount] = maxR;
    unitCount += 1;
  }
  if (unitCount === 0) {
    ox[0] = w * 0.5;
    oy[0] = h * 0.5;
    span[0] = Math.min(w, h) * 0.33;
    innerR[0] = span[0] * 0.5;
    outerR[0] = span[0];
    unitCount = 1;
  }
  const unitIndex = assignGrowthUnits(w, h, topology, unitCount, ox, oy, innerR, outerR);
  return {
    topology,
    veinVariant,
    senseAngle,
    lobeCount,
    unitCount,
    ox,
    oy,
    span,
    innerR,
    outerR,
    unitIndex
  };
}
function compactPaintCanvas(field, growth, continuity) {
  const clearance = Math.ceil(Math.max(...growth.span, ...growth.outerR) * PAINT_INFLATED_AMP) + 2;
  const minimum = paintGenomeCanvasOf(continuity);
  let reachX = 0, reachY = 0;
  for (let y = 0; y < field.h; y++) for (let x = 0; x < field.w; x++) {
    if (field.v[y * field.w + x] < 0.1) continue;
    reachX = Math.max(reachX, Math.abs(x - field.w / 2), Math.abs(x + 1 - field.w / 2));
    reachY = Math.max(reachY, Math.abs(y - field.h / 2), Math.abs(y + 1 - field.h / 2));
  }
  const w = Math.min(field.w, Math.max(minimum.w, 2 * Math.ceil(reachX + clearance + 2)));
  const h = Math.min(field.h, Math.max(minimum.h, 2 * Math.ceil(reachY + clearance + 2)));
  if (w === field.w && h === field.h) return { field, growth, clearance };
  const shiftX = (field.w - w) / 2, shiftY = (field.h - h) / 2;
  const cropped = makePaintField(w, h, field.logicalSpan);
  const unitIndex = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const begin = (y + shiftY) * field.w + shiftX;
    cropped.v.set(field.v.subarray(begin, begin + w), y * w);
    unitIndex.set(growth.unitIndex.subarray(begin, begin + w), y * w);
  }
  const ox = new Float32Array(growth.ox), oy = new Float32Array(growth.oy);
  for (let i = 0; i < growth.unitCount; i++) {
    ox[i] = ox[i] - shiftX;
    oy[i] = oy[i] - shiftY;
  }
  return { field: cropped, growth: { ...growth, ox, oy, unitIndex }, clearance };
}
function bakePaintGenome(req) {
  const sense = req.sense ?? "sense_touch";
  const rhythm = req.rhythm ?? "rhythm_open";
  const geometryVersion = req.geometryVersion ?? 2;
  const { field, topology } = topologyCanvas(req);
  const { w, h } = field;
  const stage = STAGE2[req.coverage];
  const ramp = fragmentRamp(req.fragmentTypeId ?? LEXICON_DEFAULT_FRAGMENT);
  const veinTag = req.veinVariant === void 0 ? "" : `:v${req.veinVariant}`;
  const rngLabel = `paint-core:${topology}:${req.coverage}:${sense}:${rhythm}${veinTag}`;
  let s = mix32(req.seed, rngLabel) | 1;
  const next = () => {
    let x = s;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    s = x >>> 0;
    return s / 4294967296;
  };
  const pickInt = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  for (let i = 0; i < field.v.length; i++) field.v[i] = field.v[i] * 0.58;
  if (req.veinVariant === 1 && topology === "vein_tree") applyFilmSheen(field);
  const beadGrowth = req.veinVariant === 3 ? buildPaintGrowthGuide(field.v, w, h, topology, sense, rhythm, 3) : void 0;
  const lit = [];
  for (let i = 0; i < field.v.length; i++) if (field.v[i] > 0.3) lit.push(i);
  const cores = 3 + stage * 4;
  for (let n = 0; n < cores && lit.length > 0; n++) {
    const i = lit[pickInt(0, lit.length - 1)];
    field.v[i] = 1;
    const x = i % w;
    const y = i / w | 0;
    if (n % 2 === 0 && x + 1 < w) field.v[i + 1] = 0.82;
    if (n % 3 === 0 && y + 1 < h) field.v[i + w] = 0.82;
  }
  const rawGrowth = beadGrowth ?? buildPaintGrowthGuide(field.v, w, h, topology, sense, rhythm, req.veinVariant);
  const compact = geometryVersion === 1 ? { field, growth: rawGrowth, clearance: 0 } : compactPaintCanvas(field, rawGrowth, req.continuity ?? "colony");
  const body = compact.field, growth = compact.growth;
  const out = new Uint8ClampedArray(body.w * body.h * 4);
  paintSurfaceMaterial(out, body.v, body.w, body.h, req.substrate, req.coverage, req.seed);
  const terrainFootprintField = geometryVersion === 1 ? body.v : reserveBreathingFootprint(body.v, body.w, body.h, compact.clearance);
  return {
    buf: { data: out, w: body.w, h: body.h },
    field: body.v,
    terrainFootprintField,
    geometryVersion,
    ramp,
    topology,
    growth,
    canvasW: body.w,
    canvasH: body.h
  };
}

// src/generation/world-study/r100-pollution.ts
var TILE2 = 32;
function createMasterPollution(grade, seed, grid, reachable, start, targets) {
  const cols = grid.cols * grid.tileSize / TILE2, rows = grid.rows * grid.tileSize / TILE2;
  const scale = TILE2 / grid.tileSize;
  const tiles = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_2, col) => {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++)
      if (!grid.isWalkable(col * scale + x, row * scale + y)) return 3 /* VOID */;
    return 1 /* FLOOR */;
  }));
  const hostTileMap = { cols, rows, tileSize: TILE2, tiles };
  const isFloor = (col, row) => tiles[row]?.[col] === 1 /* FLOOR */;
  const fineCell = (p) => Math.floor(p.y / grid.tileSize) * grid.cols + Math.floor(p.x / grid.tileSize);
  const fineCenter = (cell) => ({ x: (cell % grid.cols + 0.5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + 0.5) * grid.tileSize });
  const parents = new Int32Array(reachable.length).fill(-1), queue = [start];
  parents[start] = start;
  for (let at2 = 0; at2 < queue.length; at2++) {
    const cell = queue[at2];
    for (const next of [cell - 1, cell + 1, cell - grid.cols, cell + grid.cols]) {
      if (!reachable[next] || parents[next] !== -1 || Math.abs(next - cell) === 1 && Math.floor(next / grid.cols) !== Math.floor(cell / grid.cols)) continue;
      parents[next] = cell;
      queue.push(next);
    }
  }
  const protectedCells = /* @__PURE__ */ new Set();
  for (const target of targets) {
    let cell = fineCell(target);
    if (parents[cell] === -1) throw new Error("A protected R100 pollution route is unreachable");
    while (cell !== start) {
      protectedCells.add(cell);
      cell = parents[cell];
    }
  }
  protectedCells.add(start);
  const safeRoute = [...protectedCells].map(fineCenter);
  const forbidden = /* @__PURE__ */ new Set();
  for (const point of safeRoute) {
    for (let row = Math.floor((point.y - 18) / TILE2); row <= Math.floor((point.y + 18) / TILE2); row++)
      for (let col = Math.floor((point.x - 18) / TILE2); col <= Math.floor((point.x + 18) / TILE2); col++) forbidden.add(row * cols + col);
  }
  const spawn = fineCenter(start), anchors = [spawn, ...targets];
  const blocked = (col, row) => forbidden.has(row * cols + col) || anchors.some((anchor, index) => Math.hypot((col + 0.5) * TILE2 - anchor.x, (row + 0.5) * TILE2 - anchor.y) < (index === 0 ? 80 : 40));
  const candidates = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (isFloor(col, row) && reachable[fineCell({ x: (col + 0.5) * TILE2, y: (row + 0.5) * TILE2 })]) candidates.push({ col, row });
  const forms = [], paintFloors = [];
  const occupiedPaint = /* @__PURE__ */ new Set();
  const paintRequests = [];
  for (let slot = 0; slot < grade.paintCount; slot++) {
    const form = {
      substrate: grade.paintSubstrate,
      coverage: grade.paintCoverage,
      continuity: grade.paintContinuity,
      occupancy: "paint",
      portfolio: "bing",
      lexemes: { motion: "motion_anchor", sense: "sense_domain", rhythm: "rhythm_open", contact: "contact_step_chaos" }
    };
    const hostSeed = mix32(seed, `ENM_BING_${String(slot + 1).padStart(2, "0")}`);
    const baked = bakePaintGenome({
      ...form,
      seed: hostSeed,
      sense: form.lexemes.sense,
      rhythm: form.lexemes.rhythm,
      fragmentTypeId: "frag-outdoor",
      veinVariant: resolvePaintVeinVariant(form.substrate, hostSeed),
      geometryVersion: 2
    });
    const cells = (field) => collectPaintGenomeFloorTiles(field, baked.canvasW, baked.canvasH, TILE2 / 2, TILE2 / 2, TILE2);
    const support = cells(baked.terrainFootprintField), danger = cells(baked.field);
    const seats = candidates.filter((seat) => support.every((offset) => isFloor(seat.col + offset.col, seat.row + offset.row)) && danger.every((offset) => !blocked(seat.col + offset.col, seat.row + offset.row))).map((seat) => ({ ...seat, danger: danger.map((offset) => (seat.row + offset.row) * cols + seat.col + offset.col) }));
    if (!seats.length) throw new Error(`${grade.id}: no complete native paint footprint for Host ${slot + 1}`);
    paintRequests.push({ form, seats });
  }
  const chosen = Array.from({ length: grade.paintCount }, () => null);
  let attempts = 0;
  function placePaint(remaining) {
    if (remaining === 0) return true;
    if (++attempts > 2e4) return false;
    let slot = -1, allowed = [];
    for (let index = 0; index < chosen.length; index++) {
      if (chosen[index]) continue;
      const seats = paintRequests[index].seats.filter((seat) => seat.danger.every((cell) => !occupiedPaint.has(cell)));
      if (!seats.length) return false;
      if (slot === -1 || seats.length < allowed.length) {
        slot = index;
        allowed = seats;
      }
    }
    const score = (seat) => {
      const x = (seat.col + 0.5) * TILE2, y = (seat.row + 0.5) * TILE2;
      const placed = chosen.filter((p) => p !== null);
      if (!placed.length) return -Math.abs(Math.hypot(x - spawn.x, y - spawn.y) - 160);
      return Math.min(...placed.map((p) => Math.hypot(seat.col - p.col, seat.row - p.row))) * TILE2 - Math.abs(Math.hypot(x - spawn.x, y - spawn.y) - 250) * 0.14;
    };
    allowed.sort((a, b) => score(b) - score(a) || a.row - b.row || a.col - b.col);
    for (const seat of allowed) {
      chosen[slot] = seat;
      for (const cell of seat.danger) occupiedPaint.add(cell);
      if (placePaint(remaining - 1)) return true;
      for (const cell of seat.danger) occupiedPaint.delete(cell);
      chosen[slot] = null;
    }
    return false;
  }
  if (!placePaint(grade.paintCount)) throw new Error(`${grade.id}: complete native paint quota cannot fit without blocking the safe route`);
  for (let slot = 0; slot < chosen.length; slot++) {
    const seat = chosen[slot];
    paintFloors.push({ floorCol: seat.col, floorRow: seat.row, onGreedy: false, throatScore: 0 });
    forms.push(paintRequests[slot].form);
  }
  const volumes = [], volumeCells = /* @__PURE__ */ new Set();
  for (let slot = 0; slot < grade.volumeCount; slot++) {
    const allowed = candidates.filter((seat2) => {
      for (let row = seat2.row; row < seat2.row + grade.volumeRows; row++) for (let col = seat2.col; col < seat2.col + grade.volumeCols; col++)
        if (!isFloor(col, row) || blocked(col, row) || volumeCells.has(row * cols + col)) return false;
      return true;
    });
    const score = (seat2) => {
      const x = (seat2.col + grade.volumeCols / 2) * TILE2, y = (seat2.row + grade.volumeRows / 2) * TILE2;
      const distance = Math.hypot(x - spawn.x, y - spawn.y);
      const spread = volumes.length ? Math.min(...volumes.map((box2) => Math.hypot(x - (box2.coreCol + 0.5) * TILE2, y - (box2.coreRow + 0.5) * TILE2))) : 0;
      return spread - Math.abs(distance - 210) * 0.6;
    };
    allowed.sort((a, b) => score(b) - score(a) || a.row - b.row || a.col - b.col);
    const seat = allowed[0];
    if (!seat) throw new Error(`${grade.id}: no complete native volume footprint for Host ${slot + 1}`);
    const box = {
      minCol: seat.col,
      minRow: seat.row,
      maxCol: seat.col + grade.volumeCols - 1,
      maxRow: seat.row + grade.volumeRows - 1,
      coreCol: seat.col + Math.floor((grade.volumeCols - 1) / 2),
      coreRow: seat.row + Math.floor((grade.volumeRows - 1) / 2)
    };
    for (let row = box.minRow; row <= box.maxRow; row++) for (let col = box.minCol; col <= box.maxCol; col++) volumeCells.add(row * cols + col);
    volumes.push(box);
    forms.push({
      substrate: grade.volumeSubstrate,
      coverage: grade.volumeCoverage,
      continuity: "field",
      occupancy: "volume",
      portfolio: "ding",
      lexemes: { motion: "motion_anchor", sense: "sense_domain", rhythm: "rhythm_open", contact: "contact_volume_chaos" }
    });
  }
  return {
    hostTileMap,
    forms,
    pins: { wallEdges: [], paintFloors, corridorAabbs: volumes },
    paintCells: [...occupiedPaint].map((cell) => ({ x: (cell % cols + 0.5) * TILE2, y: (Math.floor(cell / cols) + 0.5) * TILE2 })),
    volumes,
    safeRoute,
    paintAreaPx: occupiedPaint.size * TILE2 * TILE2,
    volumeAreaPx: volumeCells.size * TILE2 * TILE2
  };
}

// src/generation/outline-mask.ts
var DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1]
];
function at(cols, col, row) {
  return row * cols + col;
}
function inBounds(cols, rows, col, row) {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}
function measureOutline(land, cols, rows) {
  const ring = GAME_CONSTANTS2.GENERATION.BORDER_RING;
  let landCount = 0;
  let minCol = cols;
  let minRow = rows;
  let maxCol = -1;
  let maxRow = -1;
  let ringLand = 0;
  let roughCells = 0;
  const edgeHas = [false, false, false, false];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!land[at(cols, col, row)]) continue;
      landCount++;
      if (col < minCol) minCol = col;
      if (row < minRow) minRow = row;
      if (col > maxCol) maxCol = col;
      if (row > maxRow) maxRow = row;
      if (col < ring || row < ring || col >= cols - ring || row >= rows - ring) {
        ringLand++;
      }
      if (col === 0) edgeHas[0] = true;
      if (col === cols - 1) edgeHas[1] = true;
      if (row === 0) edgeHas[2] = true;
      if (row === rows - 1) edgeHas[3] = true;
      let touchesVoid = false;
      for (const [dx, dy] of DIRS4) {
        const nx = col + dx;
        const ny = row + dy;
        if (!inBounds(cols, rows, nx, ny) || !land[at(cols, nx, ny)]) {
          touchesVoid = true;
          break;
        }
      }
      if (touchesVoid) roughCells++;
    }
  }
  const width = landCount === 0 ? 0 : maxCol - minCol + 1;
  const height = landCount === 0 ? 0 : maxRow - minRow + 1;
  const bboxArea = Math.max(1, width * height);
  const innerW = Math.max(0, cols - ring * 2);
  const innerH = Math.max(0, rows - ring * 2);
  const ringCells = cols * rows - innerW * innerH;
  return {
    landCount,
    fillRatio: landCount / (cols * rows),
    bbox: {
      minCol: landCount === 0 ? 0 : minCol,
      minRow: landCount === 0 ? 0 : minRow,
      maxCol: landCount === 0 ? 0 : maxCol,
      maxRow: landCount === 0 ? 0 : maxRow,
      width,
      height
    },
    bboxFill: landCount / bboxArea,
    borderOccupancy: ringCells === 0 ? 0 : ringLand / ringCells,
    edgesTouching: edgeHas.filter(Boolean).length,
    roughness: landCount === 0 ? 0 : roughCells / landCount
  };
}

// src/generation/world-study/native-volume-geometry.ts
var NATIVE_VOLUME_REGIONS = { intact: 0, compressed: 1, peeled: 2, fractured: 3, tension: 4, glazed: 5 };
var TAU = Math.PI * 2;
var clamp = (v, low, high) => Math.max(low, Math.min(high, v));
function phase(seed, salt) {
  let a = Math.imul((seed | 0) ^ salt, 73244475);
  a = Math.imul(a ^ a >>> 16, 73244475);
  return ((a ^ a >>> 16) >>> 0) / 4294967296;
}
function validateSpec(spec) {
  for (const [key, value] of Object.entries(spec)) {
    if (key !== "family" && !(key === "blocking" && value === void 0) && (typeof value !== "number" || !Number.isFinite(value))) {
      throw new Error(`Native volume ${key} must be finite`);
    }
  }
  if (!["folded-slab", "fibre-knot", "broken-shell", "granular-ridge", "membrane-rim", "gel-flow"].includes(spec.family)) throw new Error("Unknown native volume family");
  if (!Number.isInteger(spec.id) || spec.id < 1 || spec.id > 2147483647) throw new Error("Volume id must be a positive Int32");
  if (!Number.isInteger(spec.seed)) throw new Error("Volume seed must be an integer");
  if (spec.blocking !== void 0 && spec.blocking !== 0 && spec.blocking !== 1) throw new Error("Native volume blocking must be 0 or 1");
  if (spec.length < 16 || spec.width < 12 || spec.height < 2 || spec.thickness < 1 || spec.length > 2048 || spec.width > 2048 || spec.height > 512 || spec.thickness > Math.min(spec.length, spec.width) * 0.45) throw new Error("Native volume dimensions outside bounded construction range");
  for (const key of ["fold", "opening", "distortion"]) {
    if (spec[key] < 0 || spec[key] > 1) throw new Error(`Native volume ${key} must be in [0, 1]`);
  }
  if (!Number.isInteger(spec.branches) || spec.branches < 2 || spec.branches > 8) throw new Error("Native volume branches must be an integer in [2, 8]");
}
var MeshBuilder = class {
  constructor(spec) {
    this.spec = spec;
    __publicField(this, "points", []);
    __publicField(this, "normalData", []);
    __publicField(this, "texels", []);
    __publicField(this, "triangles", []);
    __publicField(this, "slots", []);
    __publicField(this, "regions", []);
    __publicField(this, "joints", []);
    __publicField(this, "bounds", { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: 0 });
    __publicField(this, "cosine");
    __publicField(this, "sine");
    this.cosine = Math.cos(spec.rotation);
    this.sine = Math.sin(spec.rotation);
  }
  vertex(p, uv, n) {
    const x = this.spec.x + p[0] * this.cosine - p[1] * this.sine;
    const y = this.spec.y + p[0] * this.sine + p[1] * this.cosine;
    const z = Math.max(0, p[2]);
    this.bounds.minX = Math.min(this.bounds.minX, x);
    this.bounds.maxX = Math.max(this.bounds.maxX, x);
    this.bounds.minY = Math.min(this.bounds.minY, y);
    this.bounds.maxY = Math.max(this.bounds.maxY, y);
    this.bounds.maxZ = Math.max(this.bounds.maxZ, z);
    const index = this.points.length / 3;
    this.points.push(x, y, z);
    this.normalData.push(n[0] * this.cosine - n[1] * this.sine, n[0] * this.sine + n[1] * this.cosine, n[2]);
    this.texels.push(uv[0], uv[1]);
    return index;
  }
  quad(a, b, c, d, material, uvs, wanted, region = 0) {
    const triangle = (p, q, r, up, uq, ur) => {
      const ux = q[0] - p[0], uy = q[1] - p[1], uz = q[2] - p[2], vx = r[0] - p[0], vy = r[1] - p[1], vz = r[2] - p[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const size = Math.hypot(nx, ny, nz);
      if (size < 1e-6) return;
      nx /= size;
      ny /= size;
      nz /= size;
      if (wanted && nx * wanted[0] + ny * wanted[1] + nz * wanted[2] < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
      }
      const normal = [nx, ny, nz];
      this.triangles.push(this.vertex(p, up, normal), this.vertex(q, uq, normal), this.vertex(r, ur, normal));
      this.slots.push(material);
      this.regions.push(region);
    };
    triangle(a, b, c, uvs[0], uvs[1], uvs[2]);
    triangle(a, c, d, uvs[0], uvs[2], uvs[3]);
  }
  joint(p) {
    this.joints.push({
      index: this.joints.length,
      x: this.spec.x + p[0] * this.cosine - p[1] * this.sine,
      y: this.spec.y + p[0] * this.sine + p[1] * this.cosine,
      z: p[2]
    });
  }
  finish() {
    const heightScale = this.spec.height / Math.max(1, this.bounds.maxZ);
    for (let i = 0; i < this.points.length; i += 3) {
      this.points[i + 2] = this.points[i + 2] * heightScale;
      const nx = this.normalData[i], ny = this.normalData[i + 1], nz = this.normalData[i + 2] / heightScale;
      const length = Math.hypot(nx, ny, nz) || 1;
      this.normalData[i] = nx / length;
      this.normalData[i + 1] = ny / length;
      this.normalData[i + 2] = nz / length;
    }
    for (const joint of this.joints) joint.z *= heightScale;
    this.bounds.maxZ = this.spec.height;
    return {
      spec: Object.freeze({ ...this.spec }),
      positions: new Float32Array(this.points),
      normals: new Float32Array(this.normalData),
      uv: new Float32Array(this.texels),
      indices: new Uint32Array(this.triangles),
      materials: new Uint8Array(this.slots),
      regions: new Uint8Array(this.regions),
      vertexCount: this.points.length / 3,
      triangleCount: this.slots.length,
      bounds: Object.freeze(this.bounds),
      joints: this.joints
    };
  }
};
function foldedSlab(b) {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const shift = (phase(s.seed, 101) - 0.5) * 0.05;
  const thrust = (s.fold - 0.5) * 0.075;
  const px = (x) => (x + shift) * l;
  const py = (y) => y * w;
  const near = (ratio) => Math.min(h * ratio, 19 + s.thickness * 0.22);
  const a = [
    [-l * 0.51, py(-0.14), 0],
    [-l * 0.37, py(-0.37), h * 0.33],
    [px(-0.15), py(-0.43), h * 0.6424],
    [px(0.025), py(-0.2), h * 0.486],
    [px(-0.014), py(0.058 + thrust), near(0.31056 - thrust * 0.68)],
    [px(-0.19), py(0.235), near(0.1902)],
    [-l * 0.42, py(0.135), h * 0.025]
  ];
  const c = [
    [px(0.035), py(-0.3), h * 0.7028],
    [px(0.22), py(-0.49), h * 0.9836],
    [l * 0.49, py(-0.27), h * 0.16],
    [l * 0.46, py(-5e-3), h * 0.025],
    [px(0.24), py(0.095), near(0.1662)],
    [px(0.085), py(-0.025), near(0.3218)]
  ];
  const outlet = [
    [px(-0.26), py(0.3), near(0.11)],
    [px(-0.075), py(0.135 + thrust), near(0.21)],
    [px(0.09), py(0.13 + thrust), near(0.19)],
    [px(0.265), py(0.35), near(0.08)],
    [px(0.095), py(0.535), 0],
    [px(-0.15), py(0.49), h * 0.018]
  ];
  const plane = (outline, peak, dx, dy) => {
    const depth = outline.map((p) => p[0] * dx + p[1] * dy), min = Math.min(...depth), span = Math.max(...depth) - min;
    for (let i = 0; i < outline.length; i++) outline[i] = [outline[i][0], outline[i][1], (depth[i] - min) / span * peak];
    const x = outline.reduce((n, p) => n + p[0], 0) / outline.length, y = outline.reduce((n, p) => n + p[1], 0) / outline.length;
    return [x, y, (x * dx + y * dy - min) / span * peak];
  };
  const aCentre = plane(a, h * 0.73, 0.16, -1);
  const cCentre = plane(c, h, -0.35, -1);
  const outletCentre = plane(outlet, near(0.25), 0.13, -1);
  bedMass(b, a, aCentre, 0, [3, 4], Math.min(24, Math.max(9, w * 0.12)));
  bedMass(b, c, cCentre, 1, [4, 5], Math.min(21, Math.max(8, w * 0.105)));
  bedMass(b, outlet, outletCentre, 2, [0, 1], Math.min(17, Math.max(7, w * 0.085)));
}
function bedMass(b, top, centre, salt, faultEdges, cutWidth) {
  const n = top.length, s = b.spec;
  const lerp = (a, c, t) => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];
  const footHeight = s.blocking === 1 ? Math.min(s.height * 0.42, 8.5 + salt * 0.9 + phase(s.seed, 810 + salt) * 1.2) : 0;
  const lift = (p) => footHeight > 0 ? [p[0], p[1], footHeight + p[2] * (1 - footHeight / s.height)] : p;
  const surfaceCentre = lift(centre);
  const rim = [];
  let distance = 0;
  const mouthPeak = 0.43 + phase(s.seed, 700 + salt) * 0.16;
  for (let i = 0; i < n; i++) {
    const p = top[i], q = top[(i + 1) % n], rank = faultEdges.indexOf(i), fault = rank >= 0;
    const subdivisions = fault ? 5 : 1;
    const edgeLength = Math.hypot(q[0] - p[0], q[1] - p[1]);
    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions, at2 = lerp(p, q, t), along = (rank + t) / faultEdges.length;
      const lobe = fault ? clamp(along < mouthPeak ? along / mouthPeak : (1 - along) / (1 - mouthPeak), 0, 1) : 0;
      const mouth = lobe * lobe * (3 - 2 * lobe);
      const radius = Math.hypot(at2[0] - centre[0], at2[1] - centre[1]) || 1;
      const nx = (at2[0] - centre[0]) / radius, ny = (at2[1] - centre[1]) / radius;
      const inset = cutWidth * mouth * (salt === 2 ? 0.52 : 0.78);
      let lip = lerp(at2, centre, Math.min(0.26, inset / radius));
      const burial = clamp(at2[2] / Math.max(3, s.height * 0.16), 0, 1);
      const spread = cutWidth * burial * (fault ? 0.13 + mouth * 1.8 : 0.26);
      const foot = [at2[0] + nx * spread, at2[1] + ny * spread, 0];
      if (footHeight > 0) {
        const sectionWidth = 6.5 + phase(s.seed, 830 + salt) * 1.5 + (at2[0] / s.length + 0.5) * 1.1 + mouth * 0.8;
        const run = Math.hypot(lip[0] - foot[0], lip[1] - foot[1]);
        const lowEnd = 1 - clamp(at2[2] / (footHeight * 2), 0, 1);
        const toCentre = Math.hypot(lip[0] - centre[0], lip[1] - centre[1]) || 1;
        lip = lerp(lip, centre, clamp((sectionWidth - run) * lowEnd / toCentre, 0, 0.34));
      }
      const shoulder = lift(lerp(lip, centre, Math.min(0.34, (5 + cutWidth * 0.7) * mouth / radius)));
      lip = lift(lip);
      rim.push({ top: lip, foot, shoulder, mouth, distance: distance + edgeLength * t, fault });
    }
    distance += edgeLength;
  }
  let contactPlaced = false;
  for (let i = 0; i < rim.length; i++) {
    const next = (i + 1) % rim.length, a = rim[i], c = rim[next];
    const region = salt === 2 ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.intact;
    const topUv = (p) => [p[0], p[1]];
    b.quad(
      surfaceCentre,
      a.shoulder,
      c.shoulder,
      surfaceCentre,
      0,
      [topUv(surfaceCentre), topUv(a.shoulder), topUv(c.shoulder), topUv(surfaceCentre)],
      [0, 0, 1],
      region
    );
    b.quad(
      a.shoulder,
      a.top,
      c.top,
      c.shoulder,
      0,
      [topUv(a.shoulder), topUv(a.top), topUv(c.top), topUv(c.shoulder)],
      [0, 0, 1],
      NATIVE_VOLUME_REGIONS.peeled
    );
    const endDistance = next === 0 ? distance : c.distance;
    const sideUv = (p, d) => [d, p[2]];
    const open = a.fault && Math.max(a.mouth, c.mouth) > 0.08;
    b.quad(
      a.top,
      a.foot,
      c.foot,
      c.top,
      open ? 1 : 0,
      [sideUv(a.top, a.distance), sideUv(a.foot, a.distance), sideUv(c.foot, endDistance), sideUv(c.top, endDistance)],
      [0, 0, 1],
      open ? NATIVE_VOLUME_REGIONS.fractured : region
    );
    b.quad(
      [centre[0], centre[1], 0],
      c.foot,
      a.foot,
      [centre[0], centre[1], 0],
      2,
      [topUv(centre), topUv(c.foot), topUv(a.foot), topUv(centre)],
      [0, 0, -1],
      NATIVE_VOLUME_REGIONS.intact
    );
    if (salt === 0 && !contactPlaced && a.fault && a.mouth > 0.5 && c.mouth > a.mouth) {
      const point = (t, v) => [
        a.top[0] + t * (c.foot[0] - a.top[0]) + v * (a.foot[0] - a.top[0]),
        a.top[1] + t * (c.foot[1] - a.top[1]) + v * (a.foot[1] - a.top[1]),
        a.top[2] + t * (c.foot[2] - a.top[2]) + v * (a.foot[2] - a.top[2]) + 0.055
      ];
      const p0 = point(0.08, 0.08), p1 = point(0.46, 0.08), p2 = point(0.46, 0.42), p3 = point(0.08, 0.42);
      b.quad(p0, p3, p2, p1, 3, [[0, 0], [0, 6], [12, 6], [12, 0]], [0, 0, 1], NATIVE_VOLUME_REGIONS.compressed);
      b.joint([(p0[0] + p1[0] + p2[0] + p3[0]) * 0.25, (p0[1] + p1[1] + p2[1] + p3[1]) * 0.25, (p0[2] + p1[2] + p2[2] + p3[2]) * 0.25]);
      contactPlaced = true;
    }
  }
}
function fibreKnot(b) {
  const s = b.spec, l = s.length, w = s.width, h = s.height;
  const knotX = l * (-0.08 + (phase(s.seed, 211) - 0.5) * 0.045), knotY = w * (0.05 + 0.12 * s.distortion + (phase(s.seed, 213) - 0.5) * 0.035);
  const main = [
    [-l * 0.51, -w * 0.16, s.thickness * 0.6],
    [-l * 0.3, -w * 0.08, h * 0.27],
    [knotX, knotY, h * 0.57],
    [l * 0.18, w * 0.02, h * 0.38],
    [l * 0.5, w * 0.19, s.thickness * 0.63]
  ];
  sweptBundle(b, main, w * 0.145, 0);
  const cross = [
    [-l * 0.24, w * 0.48, s.thickness * 0.44],
    [-l * 0.18, w * 0.28, h * 0.29],
    [knotX + w * 0.07, knotY, h * 0.82],
    [l * 0.04, -w * 0.15, h * 0.45],
    [l * 0.15, -w * 0.46, s.thickness * 0.51]
  ];
  sweptBundle(b, cross, w * 0.08, 1);
  if (s.branches >= 3) {
    const subordinate = [
      [l * 0.41, -w * 0.38, s.thickness * 0.36],
      [l * 0.2, -w * 0.16, h * 0.25],
      [knotX + w * 0.06, knotY - w * 0.045, h * 0.69],
      [-l * 0.13, w * 0.26, h * 0.35]
    ];
    sweptBundle(b, subordinate, w * 0.047, 2);
  }
  b.joint([knotX + w * 0.04, knotY, h * 0.84]);
}
function sweptBundle(b, spine, radius, salt) {
  const s = b.spec, cross = 18, steps = (spine.length - 1) * 8;
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const whole = i / steps * (spine.length - 1), segment = Math.min(spine.length - 2, Math.floor(whole));
    const t = i === steps ? 1 : whole - segment;
    const a = spine[segment], c = spine[segment + 1];
    const before = spine[Math.max(0, segment - 1)], after = spine[Math.min(spine.length - 1, segment + 2)];
    const curve = (channel, q) => 0.5 * (2 * a[channel] + (-before[channel] + c[channel]) * q + (2 * before[channel] - 5 * a[channel] + 4 * c[channel] - after[channel]) * q * q + (-before[channel] + 3 * a[channel] - 3 * c[channel] + after[channel]) * q * q * q);
    const tangent = (channel) => 0.5 * (-before[channel] + c[channel] + 2 * (2 * before[channel] - 5 * a[channel] + 4 * c[channel] - after[channel]) * t + 3 * (-before[channel] + 3 * a[channel] - 3 * c[channel] + after[channel]) * t * t);
    const dx = tangent(0), dy = tangent(1), len = Math.hypot(dx, dy) || 1;
    const vx = -dy / len, vy = dx / len, along = i / steps;
    const clampWidth = 1 - Math.exp(-Math.pow((along - 0.5) / 0.16, 2)) * (salt === 0 ? 0.3 : 0.12);
    const rootTaper = 0.28 + Math.pow(Math.sin(along * Math.PI), 0.7) * 0.75;
    const r = radius * rootTaper * clampWidth;
    const cx = curve(0, t), cy = curve(1, t), cz = Math.max(r * 0.62, curve(2, t));
    const ring = [];
    for (let j = 0; j < cross; j++) {
      const angle = j / cross * TAU;
      const root = Math.pow(Math.abs(along - 0.5) * 2, 5);
      const flute = 1 + Math.cos(angle * 5 + salt + along * 3) * (0.045 + 0.07 * root);
      ring.push([
        cx + vx * Math.cos(angle) * r * flute,
        cy + vy * Math.cos(angle) * r * flute,
        cz + Math.sin(angle) * r * (0.57 + 0.19 * Math.sin(along * Math.PI))
      ]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < cross; j++) {
    const a = rings[i], c = rings[i + 1], k = (j + 1) % cross;
    const slot = salt > 0 && i > steps * 0.45 && i < steps * 0.54 && j > 2 && j < 5 ? 3 : 0;
    b.quad(
      a[j],
      c[j],
      c[k],
      a[k],
      slot,
      [
        [i * s.length / steps, j * radius * TAU / cross],
        [(i + 1) * s.length / steps, j * radius * TAU / cross],
        [(i + 1) * s.length / steps, (j + 1) * radius * TAU / cross],
        [i * s.length / steps, (j + 1) * radius * TAU / cross]
      ]
    );
  }
  for (const end of [0, steps]) {
    const r = rings[end];
    const middle = [
      r.reduce((sum, p) => sum + p[0], 0) / cross,
      r.reduce((sum, p) => sum + p[1], 0) / cross,
      r.reduce((sum, p) => sum + p[2], 0) / cross
    ];
    for (let j = 0; j < cross; j++) {
      const k = (j + 1) % cross;
      b.quad(middle, r[j], r[k], middle, end === 0 ? 1 : 2, [[0, 0], [j, radius], [j + 1, radius], [0, 0]]);
    }
  }
}
function brokenShell(b) {
  const s = b.spec;
  const gap = 0.82 + s.opening * 1.35;
  shellPetal(b, -s.length * 0.06, -s.width * 0.045, s.length * 0.49, s.width * 0.47, gap * 0.5, TAU - gap, 1, 0);
  shellPetal(
    b,
    s.length * 0.22,
    s.width * 0.16,
    s.length * 0.25,
    s.width * 0.31,
    Math.PI * 1.1,
    Math.PI * (1.08 + s.fold * 0.13),
    0.68,
    1
  );
  b.joint([s.length * 0.22, s.width * 0.02, s.height * 0.34]);
}
function shellPetal(b, ox, oy, rx, ry, begin, sweep, heightScale, salt) {
  const s = b.spec, around = 54, radial = 16, seedPhase = phase(s.seed, 53 + salt) * TAU;
  const rings = [];
  for (let i = 0; i <= around; i++) {
    const angle = begin + i / around * sweep, ca = Math.cos(angle), sa = Math.sin(angle);
    const jointCompression = Math.exp(-Math.pow((i / around - 0.78) / 0.2, 2));
    const lip = 1 + 0.12 * s.distortion * Math.sin(angle * 2 + seedPhase) - jointCompression * 0.1 + 0.045 * Math.sin(angle * 9 + salt);
    const rimZ = s.height * heightScale * (0.6 + 0.26 * Math.sin(angle - 0.5) + 0.12 * Math.cos(angle * 2 + seedPhase));
    const thickness = clamp(s.thickness / Math.min(rx, ry), 0.1, 0.42);
    const rimInner = 0.69 - thickness * 0.43;
    const profile = [
      [1, 0],
      [0.96, rimZ * 0.22],
      [0.84 * lip, rimZ * 0.68],
      [0.73 * lip, rimZ],
      [rimInner, rimZ * 0.94],
      [rimInner - 0.09, rimZ * 0.6],
      [0.31, rimZ * 0.14],
      [0.15, s.thickness * 0.17],
      [0, s.thickness * 0.13]
    ];
    const ring = [];
    for (let j = 0; j <= radial; j++) {
      const f = j / radial * (profile.length - 1), a = Math.floor(f), t = f - a;
      const p = profile[a], q = profile[Math.min(a + 1, profile.length - 1)];
      const r = p[0] + (q[0] - p[0]) * t, z = p[1] + (q[1] - p[1]) * t;
      const inner = 1 - r;
      const flare = Math.exp(-Math.pow((angle - (begin + 0.32)) / 0.35, 2)) * s.fold;
      ring.push([
        ox + ca * rx * r + inner * rx * (0.24 + s.distortion * 0.17) + flare * rx * 0.1 * r,
        oy + sa * ry * r - inner * ry * (0.13 + s.distortion * 0.08),
        z * (1 - flare * 0.34) * (1 + 0.07 * Math.sin(angle * 7 + seedPhase) * r)
      ]);
    }
    rings.push(ring);
  }
  for (let i = 0; i < around; i++) for (let j = 0; j < radial; j++) {
    const a = rings[i], c = rings[i + 1];
    const slot = j < 6 ? 0 : j < 8 ? 1 : j < 13 ? 2 : 0;
    b.quad(
      a[j],
      c[j],
      c[j + 1],
      a[j + 1],
      salt === 1 && i < 4 && j >= 7 && j < 12 ? 3 : slot,
      [
        [i / around * sweep * (rx + ry) * 0.5, j / radial * s.width],
        [(i + 1) / around * sweep * (rx + ry) * 0.5, j / radial * s.width],
        [(i + 1) / around * sweep * (rx + ry) * 0.5, (j + 1) / radial * s.width],
        [i / around * sweep * (rx + ry) * 0.5, (j + 1) / radial * s.width]
      ],
      [0, 0, 1]
    );
  }
  for (const end of [0, around]) {
    const ring = rings[end];
    for (let j = 0; j < radial; j++) {
      const a = ring[j], c = ring[j + 1];
      const sign = end === 0 ? -1 : 1, angle = begin + end / around * sweep;
      const dx = -Math.sin(angle) * s.thickness * 0.72 * sign, dy = Math.cos(angle) * s.thickness * 0.72 * sign;
      b.quad(
        a,
        c,
        [c[0] + dx, c[1] + dy, 0],
        [a[0] + dx, a[1] + dy, 0],
        1,
        [[j * s.width / radial, a[2]], [(j + 1) * s.width / radial, c[2]], [(j + 1) * s.width / radial, 0], [j * s.width / radial, 0]],
        [0, 0, 1]
      );
    }
  }
}
function granularRidge(b) {
  const s = b.spec, along = 30, across = 14, rows = [];
  const clusters = Array.from({ length: s.branches + 3 }, (_, i) => ({
    x: (i + 0.25 + phase(s.seed, 910 + i) * 0.5) / (s.branches + 3),
    y: 0.24 + phase(s.seed, 950 + i) * 0.5,
    span: 0.09 + phase(s.seed, 980 + i) * 0.08,
    rise: 0.1 + phase(s.seed, 1010 + i) * 0.2
  }));
  for (let i = 0; i <= along; i++) {
    const u = i / along, taper = 0.25 + 0.75 * Math.pow(Math.sin(Math.PI * u), 0.48), row = [];
    const spine = Math.sin(u * 4.5 + phase(s.seed, 897) * 2) * s.width * 0.11;
    for (let j = 0; j <= across; j++) {
      const v = j / across, edge = Math.min(u * along, (1 - u) * along, v * across, (1 - v) * across);
      const foot = Math.min(1, edge), peak = 0.43 + 0.08 * Math.sin(u * 5.4);
      const side = v < peak ? v / peak : (1 - v) / (1 - peak);
      let rise = Math.pow(Math.max(0, side), 0.86) * (0.51 + 0.16 * Math.sin(u * 4 + 1));
      for (const c of clusters) {
        const distance = Math.abs(u - c.x) / c.span + Math.abs(v - c.y) / 0.26;
        rise += Math.max(0, 1 - distance) * c.rise;
      }
      const z = (s.blocking === 1 ? Math.min(8, s.height * 0.26) * foot : 0) + s.height * rise * foot * Math.pow(Math.sin(Math.PI * u), 0.34);
      row.push([(u - 0.5) * s.length, (v - 0.5) * s.width * taper + spine, z]);
    }
    rows.push(row);
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
    const cut = j === 0 || j === across - 1 || i === 0 || i === along - 1;
    const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
    b.quad(
      a,
      c,
      d,
      e,
      cut ? 1 : j > 8 ? 2 : 0,
      [
        [i * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, (j + 1) * s.width / across],
        [i * s.length / along, (j + 1) * s.width / across]
      ],
      [0, 0, 1],
      cut ? NATIVE_VOLUME_REGIONS.fractured : j < 6 ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.intact
    );
  }
  surfaceFracture(b, rows, [[10.1, 5.9], [11.8, 6.1], [12.5, 5.6], [14.2, 5.8], [15.1, 6.4], [17.4, 6.2]], 0.085);
}
function membraneRim(b) {
  const s = b.spec, around = 46, radial = 12, rows = [];
  const begin = 0.2 + s.opening * 0.3, sweep = TAU - (1.35 + s.opening * 1.15), offset = phase(s.seed, 1131) * 1.4;
  for (let i = 0; i <= around; i++) {
    const angle = begin + i / around * sweep, ca = Math.cos(angle), sa = Math.sin(angle);
    const uneven = 1 + 0.13 * Math.sin(angle * 3 + offset) + 0.06 * Math.cos(angle * 5 - 0.3);
    const crown = s.height * (0.64 + 0.24 * Math.sin(angle + 0.8) + 0.09 * Math.cos(angle * 2 + offset));
    const profile = [
      [1, 0],
      [0.955, s.blocking === 1 ? Math.min(crown * 0.35, 9) : crown * 0.05],
      [0.875, crown * 0.82],
      [0.78, crown],
      [0.69, crown * 0.62],
      [0.54, crown * 0.15],
      [0, crown * 0.075]
    ];
    const row = [];
    for (let j = 0; j <= radial; j++) {
      const q = j / radial * (profile.length - 1), n = Math.floor(q), f = q - n;
      const p = profile[n], next = profile[Math.min(n + 1, profile.length - 1)];
      const r = p[0] + (next[0] - p[0]) * f, z = p[1] + (next[1] - p[1]) * f;
      const tension = j > 8 ? Math.sin(angle * 11 + r * 5) * s.thickness * 0.12 * r : 0;
      row.push([ca * s.length * 0.5 * r * uneven + (1 - r) * s.length * 0.1, sa * s.width * 0.49 * r * uneven - (1 - r) * s.width * 0.17, z + tension]);
    }
    rows.push(row);
  }
  for (let i = 0; i < around; i++) for (let j = 0; j < radial; j++) {
    const a = rows[i], c = rows[i + 1];
    const slot = j < 2 ? 1 : j < 8 ? 0 : 2;
    b.quad(
      a[j],
      c[j],
      c[j + 1],
      a[j + 1],
      slot,
      [
        [i * s.length / around, j * s.width / radial],
        [(i + 1) * s.length / around, j * s.width / radial],
        [(i + 1) * s.length / around, (j + 1) * s.width / radial],
        [i * s.length / around, (j + 1) * s.width / radial]
      ],
      [0, 0, 1],
      j > 7 ? NATIVE_VOLUME_REGIONS.tension : NATIVE_VOLUME_REGIONS.intact
    );
  }
  surfaceFracture(b, rows, [[12.2, 2.8], [13.5, 3.3], [13.2, 4.4], [14.1, 5], [13.7, 6.3], [14.6, 7.6], [14.4, 8.7]], 0.095);
  for (const i of [0, around]) for (let j = 0; j < radial; j++) {
    const a = rows[i][j], c = rows[i][j + 1], angle = begin + i / around * sweep, sign = i === 0 ? -1 : 1;
    const dx = -Math.sin(angle) * s.thickness * 0.3 * sign, dy = Math.cos(angle) * s.thickness * 0.3 * sign;
    b.quad(
      a,
      c,
      [c[0] + dx, c[1] + dy, 0],
      [a[0] + dx, a[1] + dy, 0],
      1,
      [[j * s.width / radial, a[2]], [(j + 1) * s.width / radial, c[2]], [(j + 1) * s.width / radial, 0], [j * s.width / radial, 0]],
      [0, 0, 1],
      NATIVE_VOLUME_REGIONS.fractured
    );
  }
}
function gelFlow(b) {
  const s = b.spec, along = 32, across = 20, rows = [];
  const profile = [[0, 0], [0.08, 0.11], [0.33, 0.19], [0.58, 0.38], [0.78, 0.78], [0.88, 1], [0.95, 0.52], [1, 0]];
  for (let i = 0; i <= along; i++) {
    const u = i / along, side = Math.pow(Math.sin(Math.PI * u), 0.35), lobes = 0.12 * Math.sin(u * 13 + phase(s.seed, 1207) * 2) + 0.055 * Math.sin(u * 27 + 0.5);
    const row = [];
    for (let j = 0; j <= across; j++) {
      const v = j / across;
      let p = 0;
      while (p + 1 < profile.length && profile[p + 1][0] < v) p++;
      const a = profile[p], c = profile[Math.min(p + 1, profile.length - 1)], f = (v - a[0]) / Math.max(1e-3, c[0] - a[0]);
      const ridge = a[1] + (c[1] - a[1]) * f, edge = Math.min(u * along, (1 - u) * along, v * across, (1 - v) * across);
      const foot = s.blocking === 1 ? Math.min(s.height * 0.22, 7) * Math.min(1, edge) : 0;
      row.push([
        (u - 0.5) * s.length + (v - 0.5) * s.length * 0.08,
        (v - 0.5) * s.width * (0.3 + side * 0.7) + Math.pow(v, 3) * lobes * s.width,
        foot + ridge * s.height * side * (0.75 + 0.19 * Math.sin(u * 8 + 0.2))
      ]);
    }
    rows.push(row);
  }
  for (let i = 0; i < along; i++) for (let j = 0; j < across; j++) {
    const front = j >= 18, thin = j <= 6;
    const a = rows[i][j], c = rows[i + 1][j], d = rows[i + 1][j + 1], e = rows[i][j + 1];
    b.quad(
      a,
      c,
      d,
      e,
      front ? 1 : thin ? 2 : 0,
      [
        [i * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, j * s.width / across],
        [(i + 1) * s.length / along, (j + 1) * s.width / across],
        [i * s.length / along, (j + 1) * s.width / across]
      ],
      [0, 0, 1],
      thin ? NATIVE_VOLUME_REGIONS.peeled : front ? NATIVE_VOLUME_REGIONS.compressed : NATIVE_VOLUME_REGIONS.glazed
    );
  }
  surfaceFracture(b, rows, [[10.2, 17.4], [11.5, 17.1], [12.1, 17.7], [13.8, 17.8], [14.4, 18.3], [16.5, 18.1]], 0.09);
}
function surfaceFracture(b, rows, path, halfWidth) {
  const sample = (u, v) => {
    const i = clamp(Math.floor(u), 0, rows.length - 2), j = clamp(Math.floor(v), 0, rows[0].length - 2), a = u - i, t = v - j;
    const p = rows[i][j], q = rows[i + 1][j], r = rows[i + 1][j + 1], s = rows[i][j + 1];
    const weights = t <= a ? [1 - a, a - t, t, 0] : [1 - t, 0, a, t - a];
    return [
      p[0] * weights[0] + q[0] * weights[1] + r[0] * weights[2] + s[0] * weights[3],
      p[1] * weights[0] + q[1] * weights[1] + r[1] * weights[2] + s[1] * weights[3],
      p[2] * weights[0] + q[2] * weights[1] + r[2] * weights[2] + s[2] * weights[3] + 0.12
    ];
  };
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], c = path[i], dx = c[0] - a[0], dy = c[1] - a[1], length = Math.hypot(dx, dy), px = -dy / length * halfWidth, py = dx / length * halfWidth;
    const uv = [[a[0] + px, a[1] + py], [c[0] + px, c[1] + py], [c[0] - px, c[1] - py], [a[0] - px, a[1] - py]];
    b.quad(sample(...uv[0]), sample(...uv[1]), sample(...uv[2]), sample(...uv[3]), 3, uv, [0, 0, 1], NATIVE_VOLUME_REGIONS.fractured);
  }
  const centre = path[Math.floor(path.length / 2)];
  b.joint(sample(...centre));
}
function buildNativeVolume(spec) {
  validateSpec(spec);
  const builder = new MeshBuilder(spec);
  if (spec.family === "folded-slab") foldedSlab(builder);
  else if (spec.family === "fibre-knot") fibreKnot(builder);
  else if (spec.family === "broken-shell") brokenShell(builder);
  else if (spec.family === "granular-ridge") granularRidge(builder);
  else if (spec.family === "membrane-rim") membraneRim(builder);
  else gelFlow(builder);
  return builder.finish();
}

// src/generation/world-study/native-volume-raster.ts
var FAMILY_ID = { "folded-slab": 1, "fibre-knot": 2, "broken-shell": 3, "granular-ridge": 4, "membrane-rim": 5, "gel-flow": 6 };
function compileNativeVolumeRaster(meshes, config) {
  const pixelSize = config.pixelSize ?? 1, cellSize = config.supportCellSize ?? 8;
  if (![config.x, config.y, config.width, config.height, pixelSize, cellSize, config.opticalHeight].every(Number.isFinite) || config.width <= 0 || config.height <= 0 || pixelSize < 1 || cellSize < pixelSize || config.opticalHeight < 0 || !Number.isInteger(pixelSize) || !Number.isInteger(cellSize)) throw new Error("Invalid native volume raster bounds");
  const width = Math.ceil(config.width / pixelSize), height = Math.ceil(config.height / pixelSize);
  if (width * height > 4194304) throw new Error("Native volume raster exceeds its bounded 4M pixel allocation");
  const size = width * height, columns = Math.ceil(config.width / cellSize), rows = Math.ceil(config.height / cellSize);
  const matter = new Uint8Array(size), objectId = new Int32Array(size), material = new Uint8Array(size), family = new Uint8Array(size), region = new Uint8Array(size);
  const heightField = new Float32Array(size), normals = new Float32Array(size * 3), uv = new Float32Array(size * 2);
  heightField.fill(-Infinity);
  const usedIds = /* @__PURE__ */ new Set();
  for (const mesh of meshes) {
    if (usedIds.has(mesh.spec.id)) throw new Error(`Duplicate native volume id ${mesh.spec.id}`);
    usedIds.add(mesh.spec.id);
    const p = mesh.positions, n = mesh.normals, tex = mesh.uv;
    for (let f = 0; f < mesh.triangleCount; f++) {
      const ia = mesh.indices[f * 3], ib = mesh.indices[f * 3 + 1], ic = mesh.indices[f * 3 + 2];
      const a = ia * 3, b = ib * 3, c = ic * 3;
      const ax = (p[a] - config.x) / pixelSize, ay = (p[a + 1] - config.y) / pixelSize;
      const bx = (p[b] - config.x) / pixelSize, by = (p[b + 1] - config.y) / pixelSize;
      const cx = (p[c] - config.x) / pixelSize, cy = (p[c + 1] - config.y) / pixelSize;
      const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
      if (Math.abs(area) < 1e-7) continue;
      const x0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx) - 0.5)), x1 = Math.min(width - 1, Math.floor(Math.max(ax, bx, cx) - 0.5));
      const y0 = Math.max(0, Math.ceil(Math.min(ay, by, cy) - 0.5)), y1 = Math.min(height - 1, Math.floor(Math.max(ay, by, cy) - 0.5));
      const inv = 1 / area, waX = (by - cy) * inv, waY = (cx - bx) * inv, wbX = (cy - ay) * inv, wbY = (ax - cx) * inv;
      const startX = x0 + 0.5, startY = y0 + 0.5;
      let rowA = ((bx - startX) * (cy - startY) - (by - startY) * (cx - startX)) * inv;
      let rowB = ((cx - startX) * (ay - startY) - (cy - startY) * (ax - startX)) * inv;
      for (let y = y0; y <= y1; y++, rowA += waY, rowB += wbY) {
        let wa = rowA, wb = rowB, index = y * width + x0;
        for (let x = x0; x <= x1; x++, index++, wa += waX, wb += wbX) {
          const wc = 1 - wa - wb;
          if (wa < -1e-6 || wb < -1e-6 || wc < -1e-6) continue;
          const z = wa * p[a + 2] + wb * p[b + 2] + wc * p[c + 2];
          if (z < heightField[index] - 1e-5 || Math.abs(z - heightField[index]) < 1e-5 && mesh.spec.id > objectId[index]) continue;
          matter[index] = 1;
          objectId[index] = mesh.spec.id;
          material[index] = mesh.materials[f];
          region[index] = mesh.regions[f];
          family[index] = FAMILY_ID[mesh.spec.family];
          heightField[index] = z;
          let nx = n[a] * wa + n[b] * wb + n[c] * wc;
          let ny = n[a + 1] * wa + n[b + 1] * wb + n[c + 1] * wc;
          let nz = n[a + 2] * wa + n[b + 2] * wb + n[c + 2] * wc;
          if (nz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
          const norm = Math.hypot(nx, ny, nz) || 1, q = index * 3;
          normals[q] = nx / norm;
          normals[q + 1] = ny / norm;
          normals[q + 2] = nz / norm;
          uv[index * 2] = tex[ia * 2] * wa + tex[ib * 2] * wb + tex[ic * 2] * wc;
          uv[index * 2 + 1] = tex[ia * 2 + 1] * wa + tex[ib * 2 + 1] * wb + tex[ic * 2 + 1] * wc;
        }
      }
    }
  }
  const occupancy = new Uint8Array(columns * rows), optical = new Uint8Array(columns * rows), cellHeight = new Float32Array(columns * rows);
  const occupied = [], ambientOcclusion = new Float32Array(size);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (!matter[i]) continue;
    occupied.push(i);
    const cell = Math.floor((y + 0.5) * pixelSize / cellSize) * columns + Math.floor((x + 0.5) * pixelSize / cellSize);
    occupancy[cell] = 1;
    cellHeight[cell] = Math.max(cellHeight[cell], heightField[i]);
    if (heightField[i] >= config.opticalHeight) optical[cell] = 1;
    let occlusion = 0;
    for (let direction = 0; direction < 8; direction++) {
      const angle = direction / 8 * Math.PI * 2;
      let horizon = 0;
      for (const distance of [3, 7, 14]) {
        const sx = Math.round(x + Math.cos(angle) * distance), sy = Math.round(y + Math.sin(angle) * distance);
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const h = heightField[sy * width + sx] - heightField[i];
        horizon = Math.max(horizon, Math.atan2(Math.max(0, h - 0.6), distance * pixelSize));
      }
      occlusion += horizon / (Math.PI * 0.5);
    }
    ambientOcclusion[i] = 1 - Math.min(0.67, occlusion / 8 * 0.9);
  }
  return {
    config: Object.freeze({ ...config }),
    width,
    height,
    pixelSize,
    cellSize,
    columns,
    rows,
    occupancy,
    optical,
    cellHeight,
    matter,
    objectId,
    material,
    region,
    family,
    heightField,
    normals,
    uv,
    occupiedPixels: new Uint32Array(occupied),
    ambientOcclusion
  };
}

// src/generated/rift-world-profile-data.ts
var WORLD_PROFILE_DATA = [
  {
    "id": "ash-strata",
    "label": "\u65E0\u5F69\u5C42\u539F",
    "description": "\u6C89\u79EF\u5C42\u7247\u4E0E\u5931\u8272\u65AD\u9762",
    "material": "strata",
    "surface": {
      "substrate": "strata",
      "coating": "strata",
      "organization": "bands",
      "coverage": 0.46,
      "wear": 0.52,
      "deposits": 0.52,
      "scale": 1.1,
      "relief": 0.52,
      "contrast": 0.75,
      "regionScale": 1.15,
      "quietness": 0.48,
      "formScale": 1.3,
      "fragmentation": 0.65,
      "accentCoverage": 0.02
    },
    "palette": {
      "void": 592137,
      "shadow": 1381653,
      "floorDeep": 2302755,
      "floor": 3421236,
      "floorLight": 4539717,
      "materialDark": 3158064,
      "materialMid": 5855577,
      "materialLight": 7895160,
      "faceLight": 10066329,
      "accentDim": 5395026,
      "accent": 11184810,
      "accentLight": 13421772,
      "peak": 15658734,
      "actorDark": 1842204,
      "actorMid": 12237498,
      "actorLight": 16777215,
      "ground": 3421236,
      "groundLight": 4539717,
      "groundDark": 2302755,
      "wall": 5855577,
      "wallLight": 10066329,
      "wallDark": 3158064
    }
  },
  {
    "id": "crystal-fibre",
    "label": "\u6676\u5316\u6797\u5E8A",
    "description": "\u7EA4\u7EF4\u5E8A\u6CBF\u7EDF\u4E00\u65B9\u5411\u6676\u5316",
    "material": "crystal",
    "surface": {
      "substrate": "strata",
      "coating": "crystal",
      "organization": "clusters",
      "coverage": 0.66,
      "wear": 0.43,
      "deposits": 0.42,
      "scale": 0.95,
      "relief": 0.58,
      "contrast": 0.85,
      "regionScale": 1.1,
      "quietness": 0.5,
      "formScale": 1.5,
      "fragmentation": 0.32,
      "accentCoverage": 0.18
    },
    "palette": {
      "void": 856090,
      "shadow": 1449e3,
      "floorDeep": 2303798,
      "floor": 3158599,
      "floorLight": 4472919,
      "materialDark": 3488592,
      "materialMid": 5001839,
      "materialLight": 7173782,
      "faceLight": 10136256,
      "accentDim": 5326174,
      "accent": 7956100,
      "accentLight": 11444401,
      "peak": 14476773,
      "actorDark": 2433318,
      "actorMid": 11702376,
      "actorLight": 15584925,
      "ground": 3158599,
      "groundLight": 4472919,
      "groundDark": 2303798,
      "wall": 5001839,
      "wallLight": 10136256,
      "wallDark": 3488592
    }
  },
  {
    "id": "ivory-basin",
    "label": "\u5438\u5149\u91C9\u539F",
    "description": "\u539A\u91C9\u6C89\u79EF\u4E0E\u5438\u5149\u7ED3\u8282",
    "material": "glaze",
    "surface": {
      "substrate": "strata",
      "coating": "glaze",
      "organization": "patches",
      "coverage": 0.54,
      "wear": 0.57,
      "deposits": 0.55,
      "scale": 1.2,
      "relief": 0.5,
      "contrast": 0.72,
      "regionScale": 1.4,
      "quietness": 0.55,
      "formScale": 1.6,
      "fragmentation": 0.42,
      "accentCoverage": 0.11
    },
    "palette": {
      "void": 1448997,
      "shadow": 2699322,
      "floorDeep": 7367527,
      "floor": 11182476,
      "floorLight": 12564125,
      "materialDark": 4868945,
      "materialMid": 7695973,
      "materialLight": 9799795,
      "faceLight": 13813675,
      "accentDim": 6443617,
      "accent": 8809848,
      "accentLight": 11639443,
      "peak": 15590084,
      "actorDark": 2369326,
      "actorMid": 4936539,
      "actorLight": 12750939,
      "ground": 11182476,
      "groundLight": 12564125,
      "groundDark": 7367527,
      "wall": 7695973,
      "wallLight": 13813675,
      "wallDark": 4868945
    }
  },
  {
    "id": "carmine-lacquer",
    "label": "\u7329\u91C9\u5C42\u539F",
    "description": "\u9971\u548C\u7EDB\u91C9\u4E0E\u9752\u84DD\u88F8\u5E8A",
    "material": "glaze",
    "surface": {
      "substrate": "strata",
      "coating": "glaze",
      "organization": "patches",
      "coverage": 0.68,
      "wear": 0.28,
      "deposits": 0.55,
      "scale": 1.2,
      "relief": 0.5,
      "contrast": 0.65,
      "regionScale": 1.4,
      "quietness": 0.46,
      "formScale": 1.45,
      "fragmentation": 0.42,
      "accentCoverage": 0.14
    },
    "palette": {
      "void": 1448997,
      "shadow": 1512231,
      "floorDeep": 1320759,
      "floor": 2315112,
      "floorLight": 4361364,
      "materialDark": 5247786,
      "materialMid": 9774917,
      "materialLight": 13980262,
      "faceLight": 15963525,
      "accentDim": 2441094,
      "accent": 3571652,
      "accentLight": 7522780,
      "peak": 16764589,
      "actorDark": 2369326,
      "actorMid": 4936539,
      "actorLight": 12750939,
      "ground": 2315112,
      "groundLight": 4361364,
      "groundDark": 1320759,
      "wall": 9774917,
      "wallLight": 15963525,
      "wallDark": 5247786
    }
  },
  {
    "id": "cobalt-gold",
    "label": "\u94B4\u84DD\u91D1\u8109",
    "description": "\u94B4\u84DD\u6676\u5C42\u4E0E\u91D1\u8272\u5171\u751F\u6C89\u79EF",
    "material": "crystal",
    "surface": {
      "substrate": "strata",
      "coating": "crystal",
      "organization": "bands",
      "coverage": 0.62,
      "wear": 0.34,
      "deposits": 0.58,
      "scale": 0.95,
      "relief": 0.58,
      "contrast": 0.85,
      "regionScale": 1.2,
      "quietness": 0.42,
      "formScale": 1.4,
      "fragmentation": 0.35,
      "accentCoverage": 0.44
    },
    "palette": {
      "void": 856090,
      "shadow": 1449e3,
      "floorDeep": 1056331,
      "floor": 2309512,
      "floorLight": 4221904,
      "materialDark": 6961177,
      "materialMid": 11889444,
      "materialLight": 14131528,
      "faceLight": 15781518,
      "accentDim": 1785949,
      "accent": 3052190,
      "accentLight": 8112572,
      "peak": 16773308,
      "actorDark": 2433318,
      "actorMid": 11702376,
      "actorLight": 15584925,
      "ground": 2309512,
      "groundLight": 4221904,
      "groundDark": 1056331,
      "wall": 11889444,
      "wallLight": 15781518,
      "wallDark": 6961177
    }
  }
];

// src/generation/world-study/profiles.ts
var WORLD_PROFILES = WORLD_PROFILE_DATA;
function worldProfileById(id) {
  const profile = WORLD_PROFILES.find((value) => value.id === id);
  if (!profile) throw new Error(`Unknown world profile: ${id}`);
  return profile;
}

// src/systems/ai/physical-grid.ts
var BODY_CLEARANCE_EPSILON = 1e-6;
function bodyHasSupport(walk, center3, halfWidth, halfHeight) {
  if (![center3.x, center3.y, halfWidth, halfHeight].every(Number.isFinite) || halfWidth < 0 || halfHeight < 0 || center3.x - halfWidth < 0 || center3.y - halfHeight < 0 || center3.x + halfWidth > walk.cols * walk.tileSize || center3.y + halfHeight > walk.rows * walk.tileSize) return false;
  const insetX = Math.min(halfWidth, BODY_CLEARANCE_EPSILON), insetY = Math.min(halfHeight, BODY_CLEARANCE_EPSILON);
  const firstCol = Math.floor((center3.x - halfWidth + insetX) / walk.tileSize);
  const lastCol = Math.floor((center3.x + halfWidth - insetX) / walk.tileSize);
  const firstRow = Math.floor((center3.y - halfHeight + insetY) / walk.tileSize);
  const lastRow = Math.floor((center3.y + halfHeight - insetY) / walk.tileSize);
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) if (!walk.isWalkable(col, row)) return false;
  }
  return true;
}
function bodyDisplacementFraction(walk, center3, halfWidth, halfHeight, dx, dy) {
  if (!Number.isFinite(center3.x) || !Number.isFinite(center3.y) || !Number.isFinite(halfWidth) || !Number.isFinite(halfHeight) || !Number.isFinite(dx) || !Number.isFinite(dy) || halfWidth < 0 || halfHeight < 0) return 0;
  if (dx === 0 && dy === 0) return 0;
  const size = walk.tileSize, epsilon = BODY_CLEARANCE_EPSILON;
  const firstCol = Math.max(-1, Math.floor((Math.min(center3.x, center3.x + dx) - halfWidth) / size));
  const lastCol = Math.min(walk.cols, Math.floor((Math.max(center3.x, center3.x + dx) + halfWidth) / size));
  const firstRow = Math.max(-1, Math.floor((Math.min(center3.y, center3.y + dy) - halfHeight) / size));
  const lastRow = Math.min(walk.rows, Math.floor((Math.max(center3.y, center3.y + dy) + halfHeight) / size));
  let fraction = 1;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      if (col >= 0 && row >= 0 && col < walk.cols && row < walk.rows && walk.isWalkable(col, row)) continue;
      const minX = col * size - halfWidth + epsilon, maxX = (col + 1) * size + halfWidth - epsilon;
      const minY = row * size - halfHeight + epsilon, maxY = (row + 1) * size + halfHeight - epsilon;
      let entry = 0, exit = fraction;
      if (dx === 0) {
        if (center3.x <= minX || center3.x >= maxX) continue;
      } else {
        const a = (minX - center3.x) / dx, b = (maxX - center3.x) / dx;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
      if (dy === 0) {
        if (center3.y <= minY || center3.y >= maxY) continue;
      } else {
        const a = (minY - center3.y) / dy, b = (maxY - center3.y) / dy;
        entry = Math.max(entry, Math.min(a, b));
        exit = Math.min(exit, Math.max(a, b));
      }
      if (entry < exit && exit > 0) fraction = Math.min(fraction, entry);
    }
  }
  return fraction < 1 ? Math.max(0, fraction - 1e-4 / Math.max(Math.abs(dx), Math.abs(dy))) : 1;
}

// src/systems/tile-grid.ts
var TileGrid2 = class {
  constructor(map) {
    __publicField(this, "cols");
    __publicField(this, "rows");
    __publicField(this, "tileSize");
    __publicField(this, "widthPx");
    __publicField(this, "heightPx");
    __publicField(this, "data");
    __publicField(this, "_version", 0);
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.cols * map.tileSize;
    this.heightPx = map.rows * map.tileSize;
    this.data = new Uint8Array(map.cols * map.rows);
    for (let row = 0; row < map.rows; row++) {
      const sourceRow = map.tiles[row];
      if (!sourceRow || sourceRow.length !== map.cols) {
        throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
      }
      for (let col = 0; col < map.cols; col++) {
        this.data[row * map.cols + col] = sourceRow[col];
      }
    }
  }
  get version() {
    return this._version;
  }
  /**
   * Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks.
   * In-bounds VOID stays VOID (unwalkable; opaque via `isOpaque`).
   */
  getTile(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0 /* WALL */;
    return this.data[row * this.cols + col];
  }
  isOpaque(col, row) {
    const tile = this.getTile(col, row);
    return tile === 0 /* WALL */ || tile === 3 /* VOID */;
  }
  isWalkable(col, row) {
    const tile = this.getTile(col, row);
    return tile === 1 /* FLOOR */ || tile === 2 /* FRACTURE */;
  }
  /** True when the world position falls inside a walkable tile. */
  isWalkableAt(x, y) {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }
  /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
  setTile(col, row, tile) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (this.data[index] === tile) return;
    this.data[index] = tile;
    this._version++;
  }
  /** Writes the centre of a tile into `out` (no allocation). */
  tileToWorld(col, row, out) {
    out.x = col * this.tileSize + this.tileSize / 2;
    out.y = row * this.tileSize + this.tileSize / 2;
    return out;
  }
  /** Writes the tile containing a world position into `out` (no allocation). */
  worldToTile(x, y, out) {
    out.col = Math.floor(x / this.tileSize);
    out.row = Math.floor(y / this.tileSize);
    return out;
  }
};

// src/generation/world-study/r100-generated-scenes.ts
var MASTER_SCENES_SOURCE_HASH = "6bf6dbcd959875f08124d628c3c08807dd7d85faaa4e2465a7cd839d7c98cb57";

// src/generation/world-study/r100-master-world.ts
var TILE3 = 32;
var SUPPORT = 8;
var HALF_BODY2 = GAME_CONSTANTS2.PLAYER.BODY_SIZE / 2;
var DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if (a.y > y !== b.y > y && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function solidCoverage(meshes, cols, rows) {
  const coverage = new Uint8Array(cols * rows), half = SUPPORT / 2;
  for (const mesh of meshes) for (let face = 0; face < mesh.triangleCount; face++) {
    const p = mesh.positions, a = mesh.indices[face * 3] * 3, b = mesh.indices[face * 3 + 1] * 3, c = mesh.indices[face * 3 + 2] * 3;
    const xs = [p[a], p[b], p[c]], ys = [p[a + 1], p[b + 1], p[c + 1]];
    if (Math.abs((xs[1] - xs[0]) * (ys[2] - ys[0]) - (ys[1] - ys[0]) * (xs[2] - xs[0])) < 1e-7) continue;
    const minCol = Math.max(0, Math.floor(Math.min(...xs) / SUPPORT)), maxCol = Math.min(cols - 1, Math.floor(Math.max(...xs) / SUPPORT));
    const minRow = Math.max(0, Math.floor(Math.min(...ys) / SUPPORT)), maxRow = Math.min(rows - 1, Math.floor(Math.max(...ys) / SUPPORT));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const index = row * cols + col;
      if (coverage[index]) continue;
      const x = (col + 0.5) * SUPPORT, y = (row + 0.5) * SUPPORT;
      let overlaps = true;
      for (let edge = 0; edge < 3; edge++) {
        const next = (edge + 1) % 3, nx = ys[next] - ys[edge], ny = xs[edge] - xs[next];
        const pa = xs[0] * nx + ys[0] * ny, pb = xs[1] * nx + ys[1] * ny, pc = xs[2] * nx + ys[2] * ny;
        const center3 = x * nx + y * ny, radius = half * (Math.abs(nx) + Math.abs(ny));
        if (Math.max(pa, pb, pc) <= center3 - radius + 1e-7 || Math.min(pa, pb, pc) >= center3 + radius - 1e-7) {
          overlaps = false;
          break;
        }
      }
      if (overlaps) coverage[index] = 1;
    }
  }
  return coverage;
}
function createMasterWorld(definition, seed, frozen) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 4294967295) throw new Error("\u79CD\u5B50\u5FC5\u987B\u662F 0\u20134294967295 \u7684\u6574\u6570");
  const width = definition.cols * TILE3, height = definition.rows * TILE3;
  const roles = /* @__PURE__ */ new Map();
  const meshes = definition.instances.map((instance) => {
    const { role, ...geometry } = instance;
    roles.set(instance.id, role);
    return buildNativeVolume({ ...geometry, blocking: role === "solid" ? 1 : 0, family: instance.family ?? definition.family, seed: seed ^ Math.imul(instance.id, 104729) });
  });
  const raster = compileNativeVolumeRaster(meshes, { x: 0, y: 0, width, height, pixelSize: 1, supportCellSize: SUPPORT, opticalHeight: 24 });
  const land = new Uint8Array(definition.cols * definition.rows), walls = new Uint8Array(land.length);
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  for (let row = 0; row < definition.rows; row++) for (let col = 0; col < definition.cols; col++) {
    const i = row * definition.cols + col;
    land[i] = col >= 1 && row >= 1 && col < definition.cols - 1 && row < definition.rows - 1 && !(col < 3 && row < 3) && !(col > definition.cols - 4 && row > definition.rows - 4) ? 1 : 0;
    flowAngle[i] = definition.axis + Math.sin(row * 0.34) * 0.06;
    deposition[i] = 0.48 + Math.sin(col * 0.23 + row * 0.1) * 0.15;
  }
  const cols = width / SUPPORT, rows = height / SUPPORT;
  const matter = new Uint8Array(cols * rows), erosion = new Uint8Array(matter.length);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = (col + 0.5) * SUPPORT, y = (row + 0.5) * SUPPORT, index = row * cols + col;
    const floor = land[Math.floor(y / TILE3) * definition.cols + Math.floor(x / TILE3)] === 1;
    erosion[index] = floor && definition.erosion.some((polygon) => insidePolygon(polygon, x, y)) ? 1 : 0;
    matter[index] = floor && !erosion[index] ? 1 : 0;
  }
  const matterAt = (x, y) => x >= 0 && y >= 0 && x < width && y < height && matter[Math.floor(y / SUPPORT) * cols + Math.floor(x / SUPPORT)] === 1;
  const roleAt = (x, y) => {
    if (!matterAt(x, y)) return null;
    return roles.get(raster.objectId[Math.floor(y) * raster.width + Math.floor(x)]) ?? null;
  };
  const solids = solidCoverage(meshes.filter((mesh) => roles.get(mesh.spec.id) === "solid"), cols, rows);
  const tiles = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_2, col) => !matter[row * cols + col] ? 3 /* VOID */ : solids[row * cols + col] ? 0 /* WALL */ : 1 /* FLOOR */));
  const tileMap = { cols, rows, tileSize: SUPPORT, tiles }, grid = new TileGrid2(tileMap);
  const center3 = (cell) => ({ x: (cell % cols + 0.5) * SUPPORT, y: (Math.floor(cell / cols) + 0.5) * SUPPORT });
  const seats = new Uint8Array(cols * rows);
  for (let i = 0; i < seats.length; i++) seats[i] = grid.isWalkable(i % cols, Math.floor(i / cols)) && bodyHasSupport(grid, center3(i), HALF_BODY2, HALF_BODY2) ? 1 : 0;
  function nearest(target, available) {
    let best = -1, distance = Infinity;
    for (let i = 0; i < available.length; i++) {
      if (!available[i]) continue;
      const p = center3(i), d = (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
      if (d < distance) {
        best = i;
        distance = d;
      }
    }
    if (best < 0) throw new Error("\u6784\u9020\u6CA1\u6709\u7559\u4E0B\u539F\u751F20px\u8EAB\u4F53\u7684\u5B89\u5168\u7AD9\u4F4D");
    return best;
  }
  const start = nearest({ x: definition.spawn_x, y: definition.spawn_y }, seats), reachable = new Uint8Array(seats.length), queue = [start];
  reachable[start] = 1;
  for (let at2 = 0; at2 < queue.length; at2++) {
    const cell = queue[at2], c = cell % cols, r = Math.floor(cell / cols), p = center3(cell);
    for (const [dx, dy] of DIRECTIONS) {
      const x = c + dx, y = r + dy, next = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows || !seats[next] || reachable[next]) continue;
      if (bodyDisplacementFraction(grid, p, HALF_BODY2, HALF_BODY2, dx * SUPPORT, dy * SUPPORT) < 1) continue;
      reachable[next] = 1;
      queue.push(next);
    }
  }
  const spawnPoint = center3(start), exitPoint = center3(nearest({ x: definition.exit_x, y: definition.exit_y }, reachable));
  const searchPoint = center3(nearest({ x: definition.search_x, y: definition.search_y }, reachable));
  const enemyPoint = center3(nearest({ x: definition.enemy_x, y: definition.enemy_y }, reachable));
  if (Math.hypot(spawnPoint.x - definition.spawn_x, spawnPoint.y - definition.spawn_y) > 64) throw new Error("\u6BCD\u7248\u5165\u53E3\u88AB\u5DE8\u6784\u6324\u51FA\u540C\u4E00\u89C2\u5BDF\u533A");
  const source = BUILD_LAB_PLACEMENTS.find((row) => row.scene === "watched" && row.kind === "enemy" && row.sense === "sense_hear");
  const form = { substrate: source.substrate, coverage: source.coverage, continuity: "monolith", portfolio: "jia", occupancy: "floor", lexemes: { motion: source.motion, sense: source.sense, rhythm: source.rhythm, contact: source.contact } };
  const physicalLand = Uint8Array.from(tiles.flat(), (v) => v === 3 /* VOID */ ? 0 : 1), physicalWalls = Uint8Array.from(tiles.flat(), (v) => v === 0 /* WALL */ ? 1 : 0);
  const fragmentTypeId = "frag-outdoor";
  const grade = frozen?.grade ?? POLLUTION_GRADE_DEFINITIONS.find((item) => item.id === definition.grade);
  const pollution = createMasterPollution(grade, seed, grid, reachable, start, [exitPoint, searchPoint]);
  const outline = { seed, attempt: 0, cols, rows, tileSize: SUPPORT, land: physicalLand, tileMap, metrics: measureOutline(physicalLand, cols, rows) };
  const enemyCell = { col: Math.floor(enemyPoint.x / SUPPORT), row: Math.floor(enemyPoint.y / SUPPORT) };
  const layout = {
    seed,
    paintGeometryVersion: 2,
    fragmentTypeId,
    recipeId: `r100-art-lab:${definition.id}`,
    contaminationAge: "new",
    ruinSeverity: "broken",
    tileMap,
    ruins: { seed, attempt: 0, fragmentTypeId, outline, walls: physicalWalls, features: [], tileMap, metrics: { wallCount: physicalWalls.reduce((a, b) => a + b, 0), wallRatio: physicalWalls.reduce((a, b) => a + b, 0) / physicalLand.length, featureCount: meshes.length, leftoverConnected: true } },
    walkableMask: grid,
    spawnPoint,
    extractionPoint: { id: "master-exit", position: exitPoint, triggerRadius: GAME_CONSTANTS2.EXTRACTION.TRIGGER_RADIUS },
    kindlingNodes: [{ id: "master-search", position: searchPoint, tier: "safe", allowWeapon: false }],
    contaminantNodes: [],
    enemySpawns: [{ id: "master-listener", type: "rewriter", spawn: enemyCell, facing: source.facing, patrol: { mode: "static", waypoints: [enemyCell] }, form }],
    landmarks: [],
    contaminationPins: pollution.pins,
    contaminationDraw: { forms: [form, ...pollution.forms], warnings: [] }
  };
  const baseProfile = frozen?.profile ?? worldProfileById(definition.profile);
  const sample = { profile: { ...baseProfile, surface: { ...baseProfile.surface, quietness: definition.ground_quietness, contrast: definition.ground_contrast, coverage: definition.ground_coverage } }, topologyId: "loops", seed, cols: definition.cols, rows: definition.rows, tileSize: TILE3, land, walls, spawn: spawnPoint, exit: exitPoint, formations: [], flowAngle, deposition };
  const sight = { cols, rows, tileSize: SUPPORT, version: 0, isOpaque: (col, row) => col < 0 || row < 0 || col >= cols || row >= rows || !matter[row * cols + col] };
  let hash = 2166136261;
  for (const mesh of meshes) for (const v of mesh.positions) {
    hash = Math.imul(hash ^ Math.round(v * 100), 16777619);
  }
  for (const v of physicalWalls) hash = Math.imul(hash ^ v, 16777619);
  for (const v of matter) hash = Math.imul(hash ^ v, 16777619);
  return { definition, meshes, raster, sample, layout, hostTileMap: pollution.hostTileMap, pollution, sight, combat: grid, matterAt, roleAt, diagnostics: {
    identity: definition.id,
    family: definition.family,
    grade: definition.grade,
    seed,
    sourceHash: MASTER_SCENES_SOURCE_HASH,
    geometryFingerprint: (hash >>> 0).toString(16).padStart(8, "0"),
    qualification: "author-local-art-lab; not a production-world admission",
    projection: "native XY topdown; height projection 0",
    nativeCanvas: [960, 640],
    cameraZoom: 1.5,
    actorBody: HALF_BODY2 * 2,
    movementPxPerSecond: 80,
    supportCell: SUPPORT,
    triangles: meshes.reduce((n, m) => n + m.triangleCount, 0),
    reachableBodySeats: queue.length,
    spawnPoint,
    exitPoint,
    searchPoint,
    enemyPoint,
    sightPolicy: "only missing terrain and authored light erosion; ordinary relief/solid scenery is transparent",
    erosionCells: erosion.reduce((count, value) => count + value, 0),
    solidCells: physicalWalls.reduce((count, value) => count + value, 0),
    physicalRoles: definition.instances.map(({ id, role }) => ({ id, role })),
    geometryBeforeDeployment: true,
    dynamicTopology: false,
    gradeMechanics: true,
    paintHosts: grade.paintCount,
    volumeHosts: grade.volumeCount,
    paintContactAreaPx: pollution.paintAreaPx,
    volumeBoundsAreaPx: pollution.volumeAreaPx,
    chaosRateStart: grade.chaosStartRate,
    chaosRateEnd: grade.chaosEndRate,
    materialSounds: "registered material sources consume the same visible pressure clock; two low-priority voices, distance falloff; perceptual review recorded separately"
  } };
}

// src/generated/enemy-data.ts
var ENEMY_DATA2 = {
  infiltrator: {
    role: "infiltrator",
    displayName: "\u6E17\u900F\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 55,
    sightRangePeriph: 90,
    sightHalfAnglePeriph: 90,
    chaseSightRange: 210,
    hearingRange: 100,
    hearingMoveMult: 1,
    hearingStillRange: 0,
    hearingWallFactor: 0.6,
    visionWeight: 1,
    hearingWeight: 0,
    hearingMaxPush: "suspicious",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  },
  rewriter: {
    role: "rewriter",
    displayName: "\u6539\u5199\u4F53",
    sightRange: 180,
    sightHalfAngleCore: 32,
    sightRangePeriph: 56,
    sightHalfAnglePeriph: 50,
    chaseSightRange: 210,
    hearingRange: 150,
    hearingMoveMult: 2,
    hearingStillRange: 40,
    hearingWallFactor: 0.6,
    visionWeight: 0.45,
    hearingWeight: 1,
    hearingMaxPush: "alert",
    patrolSpeed: 30,
    chaseSpeed: 65,
    suspiciousSpeed: 22,
    alertSpeed: 45,
    returnSpeed: 38
  }
};

// src/generated/contamination-body-data.ts
var BODY_PROFILE_DATA2 = {
  "insect_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "human_remnant": {
    "moveScale": 1,
    "windupMs": 350,
    "cooldownMs": 1200,
    "rangePx": 38,
    "halfAngleDeg": 60
  },
  "mammal_remnant": {
    "moveScale": 1.1,
    "windupMs": 550,
    "cooldownMs": 1400,
    "rangePx": 38,
    "halfAngleDeg": 35
  },
  "worm_remnant": {
    "moveScale": 0.6,
    "windupMs": 650,
    "cooldownMs": 1500,
    "rangePx": 38,
    "halfAngleDeg": 25
  },
  "organic_remnant": {
    "moveScale": 0.7,
    "windupMs": 700,
    "cooldownMs": 1600,
    "rangePx": 36,
    "halfAngleDeg": 75
  },
  "stalk_clump": {
    "moveScale": 0.5,
    "windupMs": 750,
    "cooldownMs": 1750,
    "rangePx": 36,
    "halfAngleDeg": 80
  },
  "street_wreckage": {
    "moveScale": 0,
    "windupMs": 800,
    "cooldownMs": 1800,
    "rangePx": 38,
    "halfAngleDeg": 80
  }
};

// src/generation/contamination-draw.ts
var RETRY2 = GAME_CONSTANTS2.CONTAMINATION.DRAW_RETRY_LIMIT;
var INFILTRATOR_FORM = {
  substrate: "organic_remnant",
  coverage: "infiltrate",
  continuity: "monolith",
  occupancy: "floor",
  portfolio: "jia",
  lexemes: {
    motion: "motion_patrol",
    sense: "sense_cone",
    rhythm: "rhythm_open",
    contact: "contact_melee_three"
  }
};
var REWRITER_FORM = {
  substrate: "organic_remnant",
  coverage: "rewrite",
  continuity: "monolith",
  occupancy: "floor",
  portfolio: "jia",
  lexemes: {
    motion: "motion_patrol",
    sense: "sense_hear",
    rhythm: "rhythm_open",
    contact: "contact_melee_three"
  }
};

// src/utils/grid-raycast.ts
function createRayHit2() {
  return { x: 0, y: 0, dist: 0, hit: false };
}
var CORNER_MARGIN = 1;
var losScratch2 = createRayHit2();
function castRayDirection(grid, originX, originY, dirX, dirY, maxDist, out) {
  const tileSize = grid.tileSize;
  let col = Math.floor(originX / tileSize);
  let row = Math.floor(originY / tileSize);
  if (grid.isOpaque(col, row)) {
    out.x = originX;
    out.y = originY;
    out.dist = 0;
    out.hit = true;
    return out;
  }
  const stepCol = dirX > 0 ? 1 : dirX < 0 ? -1 : 0;
  const stepRow = dirY > 0 ? 1 : dirY < 0 ? -1 : 0;
  const invX = stepCol !== 0 ? 1 / Math.abs(dirX) : Infinity;
  const invY = stepRow !== 0 ? 1 / Math.abs(dirY) : Infinity;
  const deltaX = tileSize * invX;
  const deltaY = tileSize * invY;
  let nextX = stepCol > 0 ? ((col + 1) * tileSize - originX) * invX : stepCol < 0 ? (originX - col * tileSize) * invX : Infinity;
  let nextY = stepRow > 0 ? ((row + 1) * tileSize - originY) * invY : stepRow < 0 ? (originY - row * tileSize) * invY : Infinity;
  const maxSteps = grid.cols + grid.rows + 2;
  for (let step = 0; step < maxSteps; step++) {
    const throughVertex = stepCol !== 0 && stepRow !== 0 && Math.abs(nextX - nextY) <= CORNER_MARGIN;
    if (throughVertex) {
      const dist2 = nextX < nextY ? nextX : nextY;
      if (dist2 > maxDist) break;
      if (grid.isOpaque(col + stepCol, row) && grid.isOpaque(col, row + stepRow)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      col += stepCol;
      row += stepRow;
      nextX += deltaX;
      nextY += deltaY;
      if (grid.isOpaque(col, row)) {
        return writeHit(out, originX, originY, dirX, dirY, dist2, true);
      }
      continue;
    }
    let dist;
    if (nextX < nextY) {
      dist = nextX;
      if (dist > maxDist) break;
      col += stepCol;
      nextX += deltaX;
    } else {
      dist = nextY;
      if (dist > maxDist) break;
      row += stepRow;
      nextY += deltaY;
    }
    if (grid.isOpaque(col, row)) {
      return writeHit(out, originX, originY, dirX, dirY, dist, true);
    }
  }
  return writeHit(out, originX, originY, dirX, dirY, maxDist, false);
}
function hasLineOfSight(grid, from, to, maxDist) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (length < 1e-6) {
    return !grid.isOpaque(Math.floor(from.x / grid.tileSize), Math.floor(from.y / grid.tileSize));
  }
  if (maxDist !== void 0 && length > maxDist) return false;
  castRayDirection(grid, from.x, from.y, deltaX / length, deltaY / length, length, losScratch2);
  return !losScratch2.hit || losScratch2.dist >= length - 1e-3;
}
function writeHit(out, originX, originY, dirX, dirY, dist, hit) {
  out.x = originX + dirX * dist;
  out.y = originY + dirY * dist;
  out.dist = dist;
  out.hit = hit;
  return out;
}

// src/utils/math.ts
var TAU2 = Math.PI * 2;
var FACING4_ANGLES = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2
};
function shortestArc(delta) {
  let result = delta % TAU2;
  if (result > Math.PI) result -= TAU2;
  if (result < -Math.PI) result += TAU2;
  return result;
}
function stepAngleToward(current, target, maxStep) {
  const diff = shortestArc(target - current);
  if (Math.abs(diff) <= maxStep) return shortestArc(target);
  return shortestArc(current + Math.sign(diff) * maxStep);
}
function degToRad(degrees) {
  return degrees * (Math.PI / 180);
}

// src/systems/ai/behaviors.ts
function resolveNextWaypoint(mode, count, index, direction) {
  if (mode === "static" || count <= 1) return { index, direction };
  if (mode === "loop") return { index: (index + 1) % count, direction };
  let nextDirection = direction;
  let next = index + direction;
  if (next >= count) {
    nextDirection = -1;
    next = index - 1;
  } else if (next < 0) {
    nextDirection = 1;
    next = index + 1;
  }
  return { index: Math.max(0, Math.min(count - 1, next)), direction: nextDirection };
}

// src/generation/world-study/r100-patrol-windows.ts
var STEP_MS = 100;
var OBSERVATION_MS = 6e4;
var WINDOW_MS = 2400;
function advance(track) {
  if (track.pause > 0) {
    track.pause -= STEP_MS;
    if (track.pause <= 0) {
      const next = resolveNextWaypoint(track.spawn.patrol.mode, track.points.length, track.index, track.direction);
      track.index = next.index;
      track.direction = next.direction;
    }
    return;
  }
  const point = track.points[track.index], dx = point.x - track.position.x, dy = point.y - track.position.y, distance = Math.hypot(dx, dy);
  if (distance <= GAME_CONSTANTS2.AI.ARRIVE_EPSILON) {
    track.pause = track.spawn.patrol.pauseMs ?? GAME_CONSTANTS2.AI.WAYPOINT_PAUSE_MS;
    return;
  }
  track.facing = stepAngleToward(track.facing, Math.atan2(dy, dx), degToRad(GAME_CONSTANTS2.AI.TURN_RATE) * STEP_MS / 1e3);
  const move = Math.min(distance, track.speed * STEP_MS / 1e3);
  track.position.x += dx / distance * move;
  track.position.y += dy / distance * move;
}
function sees(world, track, point) {
  const data = ENEMY_DATA2[track.spawn.type], dx = point.x - track.position.x, dy = point.y - track.position.y, distance = Math.hypot(dx, dy);
  if (distance < GAME_CONSTANTS2.AI.STANDOFF_DISTANCE + 8) return true;
  if (distance > data.sightRange + 8 || !hasLineOfSight(world.sight, track.position, point, data.sightRange + 8)) return false;
  const angle = Math.abs(shortestArc(Math.atan2(dy, dx) - track.facing));
  return angle <= degToRad(data.sightHalfAngleCore + 12) || distance <= data.sightRangePeriph + 8 && angle <= degToRad(data.sightHalfAnglePeriph + 12);
}
function findR100PatrolWindows(world, enemies, nodes) {
  if (enemies.some((enemy) => enemy.patrol.mode === "static" || enemy.patrol.waypoints.length < 2)) return [];
  const tracks = enemies.map((spawn) => ({
    spawn,
    position: { x: (spawn.spawn.col + 0.5) * 8, y: (spawn.spawn.row + 0.5) * 8 },
    facing: degToRad(spawn.facing),
    index: 1,
    direction: 1,
    pause: 0,
    points: spawn.patrol.waypoints.map((cell) => ({ x: (cell.col + 0.5) * 8, y: (cell.row + 0.5) * 8 })),
    speed: ENEMY_DATA2[spawn.type].patrolSpeed * (BODY_PROFILE_DATA2[spawn.form.substrate]?.moveScale ?? 1)
  }));
  const radius = GAME_CONSTANTS2.LOOT.SEARCH_RADIUS, grid = new TileGrid2(world.layout.tileMap);
  const paint = new Set(world.pollution.paintCells.map((p) => `${Math.floor(p.x / 32)},${Math.floor(p.y / 32)}`));
  const pending = nodes.map((node) => {
    const seats = [];
    for (let dy = -radius; dy <= radius; dy += 8) for (let dx = -radius; dx <= radius; dx += 8) {
      const position = { x: node.position.x + dx, y: node.position.y + dy };
      if (Math.hypot(dx, dy) > radius || !bodyHasSupport(grid, position, 10, 10) || !hasLineOfSight(world.sight, position, node.position, radius + 1e-3)) continue;
      const col = Math.floor(position.x / 32), row = Math.floor(position.y / 32);
      if (paint.has(`${col},${row}`) || world.pollution.volumes.some((box) => col >= box.minCol && col <= box.maxCol && row >= box.minRow && row <= box.maxRow)) continue;
      seats.push({ position, elapsed: 0 });
    }
    return { node, seats, done: false };
  });
  const windows = [];
  for (let elapsed = STEP_MS; elapsed <= OBSERVATION_MS && windows.length < nodes.length; elapsed += STEP_MS) {
    for (const track of tracks) advance(track);
    for (const item of pending) {
      if (item.done) continue;
      for (const seat of item.seats) {
        seat.elapsed = tracks.some((track) => sees(world, track, seat.position)) ? 0 : seat.elapsed + STEP_MS;
        if (seat.elapsed < WINDOW_MS) continue;
        windows.push({ id: item.node.id, seat: seat.position, startMs: elapsed - seat.elapsed, durationMs: seat.elapsed });
        item.done = true;
        break;
      }
    }
  }
  return windows;
}

// src/generation/world-study/r100-expedition.ts
var DIRECTIONS2 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
var HALF = GAME_CONSTANTS2.PLAYER.BODY_SIZE / 2;
var TIERS = ["safe", "contested", "deep"];
function center(grid, cell) {
  return { x: (cell % grid.cols + 0.5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + 0.5) * grid.tileSize };
}
function cellOf(grid, point) {
  return Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
}
function routes(grid, starts) {
  const size = grid.cols * grid.rows, seats = new Uint8Array(size);
  for (let cell = 0; cell < size; cell++) seats[cell] = bodyHasSupport(grid, center(grid, cell), HALF, HALF) ? 1 : 0;
  const distance = new Float64Array(size).fill(Infinity), parent = new Int32Array(size).fill(-1);
  const heap = [];
  const push = (cell, cost) => {
    let index = heap.length;
    heap.push({ cell, distance: cost });
    while (index > 0) {
      const above = index - 1 >> 1;
      if (heap[above].distance <= cost) break;
      heap[index] = heap[above];
      index = above;
    }
    heap[index] = { cell, distance: cost };
  };
  const pop = () => {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let next = index * 2 + 1;
        if (next + 1 < heap.length && heap[next + 1].distance < heap[next].distance) next++;
        if (heap[next].distance >= last.distance) break;
        heap[index] = heap[next];
        index = next;
      }
      heap[index] = last;
    }
    return first;
  };
  for (const start of typeof starts === "number" ? [starts] : starts) {
    if (!seats[start]) throw new Error("Native production entrance lacks full body support");
    distance[start] = 0;
    parent[start] = start;
    push(start, 0);
  }
  while (heap.length) {
    const entry = pop(), cell = entry.cell;
    if (entry.distance !== distance[cell]) continue;
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols), position = center(grid, cell);
    for (const [dx, dy] of DIRECTIONS2) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      const cost = entry.distance + Math.hypot(dx, dy) * grid.tileSize;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || cost >= distance[next] || bodyDisplacementFraction(grid, position, HALF, HALF, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
      distance[next] = cost;
      parent[next] = cell;
      push(next, cost);
    }
  }
  return { seats, distance, parent };
}
function pathTo(grid, parent, cell) {
  const cells = [cell];
  if (parent[cell] < 0) throw new Error("Native production patrol target unreachable");
  while (parent[cells[cells.length - 1]] !== cells[cells.length - 1]) cells.push(parent[cells[cells.length - 1]]);
  cells.reverse();
  return cells.filter((value, index) => index === 0 || index === cells.length - 1 || value - cells[index - 1] !== cells[index + 1] - value).map((value) => ({ col: value % grid.cols, row: Math.floor(value / grid.cols) }));
}
function deployR100Expedition(world, definition) {
  const base = world.layout, grid = new TileGrid2(base.tileMap), start = cellOf(grid, base.spawnPoint), field = routes(grid, start);
  const safePoints = world.pollution.safeRoute;
  const exitSeats = [];
  for (let cell = 0; cell < field.seats.length; cell++) if (field.seats[cell]) {
    const point = center(grid, cell);
    if (Math.hypot(point.x - base.extractionPoint.position.x, point.y - base.extractionPoint.position.y) <= base.extractionPoint.triggerRadius) exitSeats.push(cell);
  }
  const toExit = routes(grid, exitSeats), directReturn = toExit.distance[start];
  if (!Number.isFinite(directReturn)) throw new Error("Native production cannot reach its extraction area");
  const pollutionDistance = (point) => {
    let distance = Infinity;
    for (const painted of world.pollution.paintCells) distance = Math.min(distance, Math.max(0, Math.hypot(point.x - painted.x, point.y - painted.y) - 24));
    for (const box of world.pollution.volumes) {
      const dx = Math.max(box.minCol * 32 - point.x, 0, point.x - (box.maxCol + 1) * 32);
      const dy = Math.max(box.minRow * 32 - point.y, 0, point.y - (box.maxRow + 1) * 32);
      distance = Math.min(distance, Math.hypot(dx, dy));
    }
    return distance;
  };
  const candidates = [];
  for (let cell = 0; cell < field.distance.length; cell++) {
    if (!Number.isFinite(field.distance[cell])) continue;
    const position = center(grid, cell);
    if (cell % grid.cols % 2 || Math.floor(cell / grid.cols) % 2) continue;
    if (Math.hypot(position.x - base.spawnPoint.x, position.y - base.spawnPoint.y) < 64 || Math.hypot(position.x - base.extractionPoint.position.x, position.y - base.extractionPoint.position.y) < 48) continue;
    let interactionDistance = Infinity, approachDistance = Infinity, interactionSeats = 0;
    const radius = GAME_CONSTANTS2.LOOT.SEARCH_RADIUS, steps = Math.ceil(radius / grid.tileSize);
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    for (let dy = -steps; dy <= steps; dy++) for (let dx = -steps; dx <= steps; dx++) {
      if (Math.hypot(dx, dy) * grid.tileSize > radius || col + dx < 0 || row + dy < 0 || col + dx >= grid.cols || row + dy >= grid.rows) continue;
      const seat = (row + dy) * grid.cols + col + dx, seatPoint = center(grid, seat);
      if (!Number.isFinite(field.distance[seat]) || !Number.isFinite(toExit.distance[seat]) || !hasLineOfSight(world.sight, seatPoint, position, radius + 1e-3)) continue;
      interactionSeats++;
      interactionDistance = Math.min(interactionDistance, field.distance[seat] + toExit.distance[seat] - directReturn);
      approachDistance = Math.min(approachDistance, field.distance[seat]);
    }
    candidates.push({ cell, position, distance: interactionDistance, approachDistance, interactionSeats, pollutionDistance: pollutionDistance(position) });
  }
  const maxDistance = Math.max(...candidates.map((seat) => seat.distance));
  const chosen = [];
  const kindlingNodes = [], contaminantNodes = [];
  for (const tier of TIERS) for (const kind of ["kindling", "contaminant"]) {
    const count = definition[`${kind}_${tier}_count`];
    for (let slot = 0; slot < count; slot++) {
      const minDepth = tier === "safe" ? 0 : tier === "contested" ? 0.32 : 0.65;
      const maxDepth = tier === "safe" ? 0.4 : tier === "contested" ? 0.8 : 1;
      const allowed = candidates.filter((seat2) => seat2.distance >= maxDistance * minDepth && seat2.distance <= maxDistance * maxDepth && seat2.pollutionDistance >= (tier === "safe" ? 34 : 16) && (tier !== "safe" || safePoints.some((point) => Math.hypot(point.x - seat2.position.x, point.y - seat2.position.y) < 30)) && chosen.every((other) => Math.hypot(other.seat.position.x - seat2.position.x, other.seat.position.y - seat2.position.y) >= 52));
      const goal = maxDistance * (tier === "safe" ? 0.2 : tier === "contested" ? 0.57 : 0.85);
      const score = (seat2) => -Math.abs(seat2.distance - goal) + (tier === "safe" ? Math.min(100, seat2.pollutionDistance) * 0.5 : -Math.min(180, seat2.pollutionDistance) * 0.45) + mix32(base.seed, `r100-content-${kind}-${tier}-${slot}-${seat2.cell}`) / 4294967296 * 64;
      allowed.sort((a, b) => score(b) - score(a) || a.cell - b.cell);
      const seat = allowed[0];
      if (!seat) throw new Error(`Cannot admit ${kind}/${tier}/${slot} with a full native route`);
      chosen.push({ seat, tier, kind });
      const id = `r100-${kind}-${tier}-${slot + 1}`;
      if (kind === "kindling") kindlingNodes.push({ id, tier, position: seat.position, value: definition[`kindling_${tier}_value`] });
      else contaminantNodes.push({ id, tier, position: seat.position });
    }
  }
  const threats = chosen.filter((item) => item.tier !== "safe").sort((a, b) => b.seat.distance - a.seat.distance);
  const enemies = [];
  for (let slot = 0; slot < definition.enemy_count; slot++) {
    const target = threats[Math.floor(slot * threats.length / definition.enemy_count)].seat;
    const allowed = candidates.filter((seat2) => seat2.distance >= maxDistance * 0.38 && seat2.pollutionDistance >= 14 && Math.hypot(seat2.position.x - base.spawnPoint.x, seat2.position.y - base.spawnPoint.y) >= 170 && chosen.filter((item) => item.tier === "safe").every((item) => Math.hypot(seat2.position.x - item.seat.position.x, seat2.position.y - item.seat.position.y) >= 112) && chosen.every((item) => Math.hypot(seat2.position.x - item.seat.position.x, seat2.position.y - item.seat.position.y) >= 40) && enemies.every((enemy) => Math.hypot(seat2.position.x - (enemy.spawn.col + 0.5) * 8, seat2.position.y - (enemy.spawn.row + 0.5) * 8) >= 96));
    allowed.sort((a, b) => Math.abs(Math.hypot(a.position.x - target.position.x, a.position.y - target.position.y) - 78) - Math.abs(Math.hypot(b.position.x - target.position.x, b.position.y - target.position.y) - 78) || a.cell - b.cell);
    let seat, local, end;
    const endpoints = candidates.filter((point) => point.pollutionDistance >= 14 && Math.hypot(point.position.x - base.spawnPoint.x, point.position.y - base.spawnPoint.y) >= 144 && chosen.filter((item) => item.tier === "safe").every((item) => Math.hypot(point.position.x - item.seat.position.x, point.position.y - item.seat.position.y) >= 96) && chosen.every((item) => Math.hypot(point.position.x - item.seat.position.x, point.position.y - item.seat.position.y) >= 40));
    for (const candidate of allowed) {
      const route = routes(grid, candidate.cell);
      const patrolTargets = endpoints.filter((point) => route.distance[point.cell] >= 88 && route.distance[point.cell] <= 200);
      patrolTargets.sort((a, b) => mix32(base.seed, `patrol-${slot}-${a.cell}`) - mix32(base.seed, `patrol-${slot}-${b.cell}`));
      if (!patrolTargets.length) continue;
      seat = candidate;
      local = route;
      end = patrolTargets[0];
      break;
    }
    if (!seat || !local || !end) throw new Error("Native patrol has no observable moving route; static fallback is forbidden");
    const waypoints = pathTo(grid, local.parent, end.cell), hearing = slot === definition.enemy_count - 1;
    enemies.push({
      id: hearing ? "ENM_RWR_01" : `ENM_INF_${String(slot + 1).padStart(2, "0")}`,
      type: hearing ? "rewriter" : "infiltrator",
      spawn: { col: seat.cell % grid.cols, row: Math.floor(seat.cell / grid.cols) },
      facing: Math.round(Math.atan2(target.position.y - seat.position.y, target.position.x - seat.position.x) * 180 / Math.PI * 1e6) / 1e6,
      patrol: { mode: waypoints.length > 1 ? "pingpong" : "static", waypoints },
      form: hearing ? REWRITER_FORM : INFILTRATOR_FORM
    });
  }
  for (const item of chosen.filter((item2) => item2.tier === "deep")) {
    const hostile = enemies.some((enemy) => enemy.patrol.waypoints.some((point) => Math.hypot((point.col + 0.5) * 8 - item.seat.position.x, (point.row + 0.5) * 8 - item.seat.position.y) <= 180 && hasLineOfSight(world.sight, { x: (point.col + 0.5) * 8, y: (point.row + 0.5) * 8 }, item.seat.position, 180)));
    if (!hostile && item.seat.pollutionDistance > 100) throw new Error("Deep prize has no actual hostile approach");
  }
  const searchable = [...kindlingNodes, ...contaminantNodes].filter((node) => node.tier !== "safe");
  const patrolWindows = findR100PatrolWindows(world, enemies, searchable);
  if (patrolWindows.length !== searchable.length) throw new Error(`No complete search window: ${searchable.filter((node) => !patrolWindows.some((window) => window.id === node.id)).map((node) => node.id).join(",")}`);
  const layout = {
    ...base,
    recipeId: `r100-native-v3:${world.definition.id}`,
    kindlingNodes,
    contaminantNodes,
    enemySpawns: enemies,
    contaminationDraw: { forms: [...enemies.map((enemy) => enemy.form), ...world.pollution.forms], warnings: [] }
  };
  return { layout, diagnostics: {
    reachableBodySeats: field.distance.reduce((sum, distance) => sum + Number(Number.isFinite(distance)), 0),
    extractionRoutePx: field.distance[cellOf(grid, base.extractionPoint.position)],
    maximumExtraTravelPx: maxDistance,
    directReturnRoutePx: directReturn,
    nodes: chosen.map((item) => ({ id: `${item.kind}/${item.tier}`, minimumExtraTravelPx: item.seat.distance, approachRoutePx: item.seat.approachDistance, interactionSeats: item.seat.interactionSeats, pollutionDistancePx: item.seat.pollutionDistance })),
    patrolWindows,
    patrolWindowContract: "2400ms unalerted-route model, dry full-body station; live approach/pursuit verified separately",
    costBasis: "all-body-safe-48px-interaction-seats",
    guaranteedSafeReturn: true,
    enemyCount: enemies.length,
    kindlingCount: kindlingNodes.length,
    contaminantCount: contaminantNodes.length
  } };
}

// src/generation/world-study/r100-expedition-v1.ts
var DIRECTIONS3 = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
var HALF2 = GAME_CONSTANTS2.PLAYER.BODY_SIZE / 2;
var TIERS2 = ["safe", "contested", "deep"];
function center2(grid, cell) {
  return { x: (cell % grid.cols + 0.5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + 0.5) * grid.tileSize };
}
function cellOf2(grid, point) {
  return Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
}
function routes2(grid, starts) {
  const size = grid.cols * grid.rows, seats = new Uint8Array(size);
  for (let cell = 0; cell < size; cell++) seats[cell] = bodyHasSupport(grid, center2(grid, cell), HALF2, HALF2) ? 1 : 0;
  const distance = new Float64Array(size).fill(Infinity), parent = new Int32Array(size).fill(-1);
  const heap = [];
  const push = (cell, cost) => {
    let index = heap.length;
    heap.push({ cell, distance: cost });
    while (index > 0) {
      const above = index - 1 >> 1;
      if (heap[above].distance <= cost) break;
      heap[index] = heap[above];
      index = above;
    }
    heap[index] = { cell, distance: cost };
  };
  const pop = () => {
    const first = heap[0], last = heap.pop();
    if (heap.length) {
      let index = 0;
      while (index * 2 + 1 < heap.length) {
        let next = index * 2 + 1;
        if (next + 1 < heap.length && heap[next + 1].distance < heap[next].distance) next++;
        if (heap[next].distance >= last.distance) break;
        heap[index] = heap[next];
        index = next;
      }
      heap[index] = last;
    }
    return first;
  };
  for (const start of typeof starts === "number" ? [starts] : starts) {
    if (!seats[start]) throw new Error("Native production entrance lacks full body support");
    distance[start] = 0;
    parent[start] = start;
    push(start, 0);
  }
  while (heap.length) {
    const entry = pop(), cell = entry.cell;
    if (entry.distance !== distance[cell]) continue;
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols), position = center2(grid, cell);
    for (const [dx, dy] of DIRECTIONS3) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      const cost = entry.distance + Math.hypot(dx, dy) * grid.tileSize;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || cost >= distance[next] || bodyDisplacementFraction(grid, position, HALF2, HALF2, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
      distance[next] = cost;
      parent[next] = cell;
      push(next, cost);
    }
  }
  return { seats, distance, parent };
}
function pathTo2(grid, parent, cell) {
  const cells = [cell];
  if (parent[cell] < 0) throw new Error("Native production patrol target unreachable");
  while (parent[cells[cells.length - 1]] !== cells[cells.length - 1]) cells.push(parent[cells[cells.length - 1]]);
  cells.reverse();
  return cells.filter((value, index) => index === 0 || index === cells.length - 1 || value - cells[index - 1] !== cells[index + 1] - value).map((value) => ({ col: value % grid.cols, row: Math.floor(value / grid.cols) }));
}
function deployR100ExpeditionV1(world, definition) {
  const base = world.layout, grid = new TileGrid2(base.tileMap), start = cellOf2(grid, base.spawnPoint), field = routes2(grid, start);
  const safePoints = world.pollution.safeRoute;
  const exitSeats = [];
  for (let cell = 0; cell < field.seats.length; cell++) if (field.seats[cell]) {
    const point = center2(grid, cell);
    if (Math.hypot(point.x - base.extractionPoint.position.x, point.y - base.extractionPoint.position.y) <= base.extractionPoint.triggerRadius) exitSeats.push(cell);
  }
  const toExit = routes2(grid, exitSeats), directReturn = toExit.distance[start];
  if (!Number.isFinite(directReturn)) throw new Error("Native production cannot reach its extraction area");
  const pollutionDistance = (point) => {
    let distance = Infinity;
    for (const painted of world.pollution.paintCells) distance = Math.min(distance, Math.max(0, Math.hypot(point.x - painted.x, point.y - painted.y) - 24));
    for (const box of world.pollution.volumes) {
      const dx = Math.max(box.minCol * 32 - point.x, 0, point.x - (box.maxCol + 1) * 32);
      const dy = Math.max(box.minRow * 32 - point.y, 0, point.y - (box.maxRow + 1) * 32);
      distance = Math.min(distance, Math.hypot(dx, dy));
    }
    return distance;
  };
  const candidates = [];
  for (let cell = 0; cell < field.distance.length; cell++) {
    if (!Number.isFinite(field.distance[cell])) continue;
    const position = center2(grid, cell);
    if (cell % grid.cols % 2 || Math.floor(cell / grid.cols) % 2) continue;
    if (Math.hypot(position.x - base.spawnPoint.x, position.y - base.spawnPoint.y) < 64 || Math.hypot(position.x - base.extractionPoint.position.x, position.y - base.extractionPoint.position.y) < 48) continue;
    let interactionDistance = Infinity, approachDistance = Infinity, interactionSeats = 0;
    const radius = GAME_CONSTANTS2.LOOT.SEARCH_RADIUS, steps = Math.ceil(radius / grid.tileSize);
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    for (let dy = -steps; dy <= steps; dy++) for (let dx = -steps; dx <= steps; dx++) {
      if (Math.hypot(dx, dy) * grid.tileSize > radius || col + dx < 0 || row + dy < 0 || col + dx >= grid.cols || row + dy >= grid.rows) continue;
      const seat = (row + dy) * grid.cols + col + dx, seatPoint = center2(grid, seat);
      if (!Number.isFinite(field.distance[seat]) || !Number.isFinite(toExit.distance[seat]) || !hasLineOfSight(world.sight, seatPoint, position, radius + 1e-3)) continue;
      interactionSeats++;
      interactionDistance = Math.min(interactionDistance, field.distance[seat] + toExit.distance[seat] - directReturn);
      approachDistance = Math.min(approachDistance, field.distance[seat]);
    }
    candidates.push({ cell, position, distance: interactionDistance, approachDistance, interactionSeats, pollutionDistance: pollutionDistance(position) });
  }
  const maxDistance = Math.max(...candidates.map((seat) => seat.distance));
  const chosen = [];
  const kindlingNodes = [], contaminantNodes = [];
  for (const tier of TIERS2) for (const kind of ["kindling", "contaminant"]) {
    const count = definition[`${kind}_${tier}_count`];
    for (let slot = 0; slot < count; slot++) {
      const minDepth = tier === "safe" ? 0 : tier === "contested" ? 0.32 : 0.65;
      const maxDepth = tier === "safe" ? 0.4 : tier === "contested" ? 0.8 : 1;
      const allowed = candidates.filter((seat2) => seat2.distance >= maxDistance * minDepth && seat2.distance <= maxDistance * maxDepth && seat2.pollutionDistance >= (tier === "safe" ? 34 : 16) && (tier !== "safe" || safePoints.some((point) => Math.hypot(point.x - seat2.position.x, point.y - seat2.position.y) < 30)) && chosen.every((other) => Math.hypot(other.seat.position.x - seat2.position.x, other.seat.position.y - seat2.position.y) >= 52));
      const goal = maxDistance * (tier === "safe" ? 0.2 : tier === "contested" ? 0.57 : 0.85);
      const score = (seat2) => -Math.abs(seat2.distance - goal) + (tier === "safe" ? Math.min(100, seat2.pollutionDistance) * 0.5 : -Math.min(180, seat2.pollutionDistance) * 0.45) + mix32(base.seed, `r100-content-${kind}-${tier}-${slot}-${seat2.cell}`) / 4294967296 * 64;
      allowed.sort((a, b) => score(b) - score(a) || a.cell - b.cell);
      const seat = allowed[0];
      if (!seat) throw new Error(`Cannot admit ${kind}/${tier}/${slot} with a full native route`);
      chosen.push({ seat, tier, kind });
      const id = `r100-${kind}-${tier}-${slot + 1}`;
      if (kind === "kindling") kindlingNodes.push({ id, tier, position: seat.position, value: definition[`kindling_${tier}_value`] });
      else contaminantNodes.push({ id, tier, position: seat.position });
    }
  }
  const threats = chosen.filter((item) => item.tier !== "safe").sort((a, b) => b.seat.distance - a.seat.distance);
  const enemies = [];
  for (let slot = 0; slot < definition.enemy_count; slot++) {
    const target = threats[Math.floor(slot * threats.length / definition.enemy_count)].seat;
    const allowed = candidates.filter((seat2) => seat2.distance >= maxDistance * 0.38 && seat2.pollutionDistance >= 14 && Math.hypot(seat2.position.x - base.spawnPoint.x, seat2.position.y - base.spawnPoint.y) >= 170 && chosen.filter((item) => item.tier === "safe").every((item) => Math.hypot(seat2.position.x - item.seat.position.x, seat2.position.y - item.seat.position.y) >= 112) && chosen.every((item) => Math.hypot(seat2.position.x - item.seat.position.x, seat2.position.y - item.seat.position.y) >= 40) && enemies.every((enemy) => Math.hypot(seat2.position.x - (enemy.spawn.col + 0.5) * 8, seat2.position.y - (enemy.spawn.row + 0.5) * 8) >= 96));
    allowed.sort((a, b) => Math.abs(Math.hypot(a.position.x - target.position.x, a.position.y - target.position.y) - 78) - Math.abs(Math.hypot(b.position.x - target.position.x, b.position.y - target.position.y) - 78) || a.cell - b.cell);
    const seat = allowed[0];
    if (!seat) throw new Error("Cannot place a native patrol without ambushing the safe entry");
    const local = routes2(grid, seat.cell);
    const patrolTargets = allowed.filter((point) => local.distance[point.cell] >= 80 && local.distance[point.cell] <= 160 && Math.hypot(point.position.x - target.position.x, point.position.y - target.position.y) <= 112);
    patrolTargets.sort((a, b) => mix32(base.seed, `patrol-${slot}-${a.cell}`) - mix32(base.seed, `patrol-${slot}-${b.cell}`));
    const end = patrolTargets[0] ?? seat;
    const waypoints = pathTo2(grid, local.parent, end.cell), hearing = slot === definition.enemy_count - 1;
    enemies.push({
      id: hearing ? "ENM_RWR_01" : `ENM_INF_${String(slot + 1).padStart(2, "0")}`,
      type: hearing ? "rewriter" : "infiltrator",
      spawn: { col: seat.cell % grid.cols, row: Math.floor(seat.cell / grid.cols) },
      facing: Math.atan2(target.position.y - seat.position.y, target.position.x - seat.position.x) * 180 / Math.PI,
      patrol: { mode: waypoints.length > 1 ? "pingpong" : "static", waypoints },
      form: hearing ? REWRITER_FORM : INFILTRATOR_FORM
    });
  }
  for (const item of chosen.filter((item2) => item2.tier === "deep")) {
    const hostile = enemies.some((enemy) => enemy.patrol.waypoints.some((point) => Math.hypot((point.col + 0.5) * 8 - item.seat.position.x, (point.row + 0.5) * 8 - item.seat.position.y) <= 180 && hasLineOfSight(world.sight, { x: (point.col + 0.5) * 8, y: (point.row + 0.5) * 8 }, item.seat.position, 180)));
    if (!hostile && item.seat.pollutionDistance > 100) throw new Error("Deep prize has no actual hostile approach");
  }
  const layout = {
    ...base,
    recipeId: `r100-native-v3:${world.definition.id}`,
    kindlingNodes,
    contaminantNodes,
    enemySpawns: enemies,
    contaminationDraw: { forms: [...enemies.map((enemy) => enemy.form), ...world.pollution.forms], warnings: [] }
  };
  return { layout, diagnostics: {
    reachableBodySeats: field.distance.reduce((sum, distance) => sum + Number(Number.isFinite(distance)), 0),
    extractionRoutePx: field.distance[cellOf2(grid, base.extractionPoint.position)],
    maximumExtraTravelPx: maxDistance,
    directReturnRoutePx: directReturn,
    nodes: chosen.map((item) => ({ id: `${item.kind}/${item.tier}`, minimumExtraTravelPx: item.seat.distance, approachRoutePx: item.seat.approachDistance, interactionSeats: item.seat.interactionSeats, pollutionDistancePx: item.seat.pollutionDistance })),
    costBasis: "all-body-safe-48px-interaction-seats",
    guaranteedSafeReturn: true,
    enemyCount: enemies.length,
    kindlingCount: kindlingNodes.length,
    contaminantCount: contaminantNodes.length
  } };
}

// src/generation/world-study/r100-native-data.ts
function serializeR100MasterWorld(world, gradeDefinition, packageHash) {
  const { layout: _layout, sight: _sight, combat: _combat, matterAt: _matterAt, roleAt: _roleAt, ...data } = world;
  return { ...data, gradeDefinition, packageHash };
}

// src/generation/world-study/r100-production-map.ts
function createR100ProductionMap(recipe) {
  if (!validR100ProductionRecipe(recipe)) throw new Error("Invalid or unavailable native world package");
  const rejected = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const seed = attempt === 0 ? recipe.requestedSeed : mix32(recipe.requestedSeed, `r100-native-v3-attempt-${attempt}`);
    try {
      const master = createMasterWorld(
        recipe.nativeDefinition,
        seed,
        { grade: recipe.gradeDefinition, profile: recipe.profile }
      );
      const deployed = (recipe.package.algorithmRevision === 1 ? deployR100ExpeditionV1 : deployR100Expedition)(master, recipe.contentDefinition), layout = deployed.layout;
      const native = serializeR100MasterWorld({ ...master, layout, diagnostics: {
        ...master.diagnostics,
        qualification: "v3-production-candidate",
        expedition: deployed.diagnostics
      } }, recipe.gradeDefinition, recipe.package.dependencyHash);
      return {
        sample: master.sample,
        layout,
        hostTileMap: master.hostTileMap,
        native,
        metadata: {
          world: recipe.package.id,
          space: recipe.nativeDefinition.id,
          contentFragmentTypeId: recipe.contentFragmentTypeId,
          requestedSeed: recipe.requestedSeed,
          effectiveSeed: layout.seed,
          attempt,
          rejected,
          signature: checkpointChecksum({ recipe, geometry: master.diagnostics.geometryFingerprint, content: deployed.diagnostics }),
          bodySize: 20,
          supportTileSize: 8,
          hostTileSize: 32,
          reachableBodySeats: Number(deployed.diagnostics.reachableBodySeats),
          extractionRoutePx: Number(deployed.diagnostics.extractionRoutePx)
        }
      };
    } catch (error) {
      rejected.push({ seed, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  throw new Error(`Native v3 world could not admit its complete ${recipe.nativeDefinition.grade} contents after 8 attempts: ${rejected.map((item) => item.reason).join("; ")}`);
}
export {
  createR100ProductionMap,
  validR100ProductionRecipe
};
