// AUTO-GENERATED from data/spatial-slice-*.csv — DO NOT EDIT
export const SPATIAL_SLICE_SCENES = [
  {
    "id": "suspended-sea-slice",
    "name": "悬海的断床",
    "cols": 31,
    "rows": 27,
    "floors": "4:5:24:18|6:3:18:2|3:8:1:12|5:23:21:2|28:9:1:9",
    "walls": "21:18:1:1",
    "voids": "12:11:8:4|14:10:4:1|13:15:6:2|11:12:1:2|20:12:1:2",
    "spawn": "15:23",
    "extract": "15:23",
    "loadout": "bare",
    "seaFrontY": 762,
    "seaBottomHeight": 138,
    "seaTopHeight": 244,
    "reefCol": 21,
    "reefRow": 18,
    "reefHeight": 208
  }
] as const;
export const SPATIAL_SLICE_PLACEMENTS = [
  {
    "id": "listener",
    "kind": "enemy",
    "col": 23,
    "row": 9,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "21:9|25:9"
  },
  {
    "id": "near-pile",
    "kind": "kindling",
    "col": 24,
    "row": 14,
    "tier": "contested",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": ""
  },
  {
    "id": "deep-pile",
    "kind": "contaminant",
    "col": 8,
    "row": 8,
    "tier": "deep",
    "substrate": "",
    "coverage": "",
    "motion": "",
    "sense": "",
    "rhythm": "",
    "contact": "",
    "facing": 0,
    "patrol": ""
  }
] as const;
export const SPATIAL_SLICE_WATER = [
  {
    "id": "split-water-tongue",
    "x": 784,
    "y": 592,
    "width": 160,
    "depth": 88,
    "outline": "-72:-18|-38:-35|-14:-26|8:-42|29:-26|57:-17|74:4|36:18|25:34|4:24|-14:32|-27:17|-54:19|-47:1",
    "quietMs": 4400,
    "warningMs": 1900,
    "activeMs": 2500,
    "retractMs": 1700,
    "damage": 12,
    "hitIntervalMs": 800,
    "contactExtension": 0.96,
    "fallTravelMs": 780
  }
] as const;
export const SPATIAL_SLICE_OPENINGS = [
  {
    "id": "west-long",
    "x": 247,
    "y": 343,
    "radiusX": 66,
    "radiusY": 146,
    "driftX": 28,
    "driftY": 19,
    "phase": 0.2,
    "angle": 18
  },
  {
    "id": "upper-break",
    "x": 539,
    "y": 207,
    "radiusX": 124,
    "radiusY": 46,
    "driftX": 39,
    "driftY": 17,
    "phase": 1.8,
    "angle": -12
  },
  {
    "id": "east-cleft",
    "x": 805,
    "y": 416,
    "radiusX": 49,
    "radiusY": 118,
    "driftX": 21,
    "driftY": 26,
    "phase": 3.1,
    "angle": -18
  },
  {
    "id": "lower-breath",
    "x": 575,
    "y": 649,
    "radiusX": 116,
    "radiusY": 51,
    "driftX": 18,
    "driftY": 17,
    "phase": 4.7,
    "angle": -34
  },
  {
    "id": "middle-window",
    "x": 514,
    "y": 442,
    "radiusX": 132,
    "radiusY": 86,
    "driftX": 8,
    "driftY": 9,
    "phase": 2.2,
    "angle": 8
  }
] as const;

export const SPATIAL_SLICE_GROUND = [
  {
    "id": "southern-drift",
    "kind": "ridge",
    "x": 506,
    "y": 764,
    "radiusX": 248,
    "radiusY": 136,
    "angle": 9,
    "height": 10
  },
  {
    "id": "western-shell-ridge",
    "kind": "ridge",
    "x": 251,
    "y": 538,
    "radiusX": 197,
    "radiusY": 103,
    "angle": -28,
    "height": 28
  },
  {
    "id": "northern-sediment",
    "kind": "shelf",
    "x": 458,
    "y": 192,
    "radiusX": 252,
    "radiusY": 137,
    "angle": -9,
    "height": 24
  },
  {
    "id": "eastern-shoulder",
    "kind": "ridge",
    "x": 805,
    "y": 380,
    "radiusX": 254,
    "radiusY": 139,
    "angle": 84,
    "height": 30
  },
  {
    "id": "scoured-return",
    "kind": "scour",
    "x": 677,
    "y": 623,
    "radiusX": 275,
    "radiusY": 105,
    "angle": -23,
    "height": -20
  }
] as const;
