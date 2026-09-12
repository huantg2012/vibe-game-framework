// AUTO-GENERATED from data/stage-gameplay-*.csv — DO NOT EDIT
export const STAGE_GAMEPLAY_SCENES = [
  {
    "id": "suspended-sea-traverse",
    "name": "悬海的两岸",
    "cols": 57,
    "rows": 35,
    "floors": "4:5:49:26|6:3:18:2|33:3:18:2|3:10:1:16|6:31:19:2|53:9:1:17",
    "walls": "39:26:1:1",
    "voids": "12:11:13:11|15:9:7:2|11:14:1:5|25:13:3:5|14:22:9:3|33:10:13:12|36:8:7:2|31:13:2:7|46:13:2:5|36:22:8:2",
    "spawn": "7:29",
    "extract": "7:29",
    "loadout": "bare",
    "seaFrontY": 1010,
    "seaBottomHeight": 138,
    "seaTopHeight": 244,
    "reefCol": 39,
    "reefRow": 26,
    "reefHeight": 208
  }
] as const;
export const STAGE_GAMEPLAY_PLACEMENTS = [
  {
    "id": "listener",
    "kind": "enemy",
    "col": 20,
    "row": 6,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "17:6|23:6"
  },
  {
    "id": "watcher",
    "kind": "enemy",
    "col": 49,
    "row": 18,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_cone",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 270,
    "patrol": "49:14|49:21"
  },
  {
    "id": "west-pile",
    "kind": "kindling",
    "col": 8,
    "row": 8,
    "tier": "safe",
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
    "id": "far-pile",
    "kind": "contaminant",
    "col": 50,
    "row": 6,
    "tier": "deep",
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
    "id": "return-pile",
    "kind": "kindling",
    "col": 50,
    "row": 28,
    "tier": "contested",
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
export const STAGE_GAMEPLAY_WATER = [
  {
    "id": "split-water-tongue",
    "x": 1392,
    "y": 848,
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
export const STAGE_GAMEPLAY_OPENINGS = [
  {
    "id": "west-shoulder",
    "x": 261,
    "y": 601,
    "radiusX": 82,
    "radiusY": 174,
    "driftX": 28,
    "driftY": 19,
    "phase": 0.2,
    "angle": 18
  },
  {
    "id": "north-cut",
    "x": 595,
    "y": 214,
    "radiusX": 150,
    "radiusY": 57,
    "driftX": 39,
    "driftY": 17,
    "phase": 1.8,
    "angle": -12
  },
  {
    "id": "middle-breath",
    "x": 942,
    "y": 538,
    "radiusX": 118,
    "radiusY": 154,
    "driftX": 21,
    "driftY": 26,
    "phase": 3.1,
    "angle": -18
  },
  {
    "id": "east-shoulder",
    "x": 1605,
    "y": 570,
    "radiusX": 67,
    "radiusY": 136,
    "driftX": 21,
    "driftY": 26,
    "phase": 3.9,
    "angle": 11
  },
  {
    "id": "southern-breath",
    "x": 770,
    "y": 927,
    "radiusX": 147,
    "radiusY": 53,
    "driftX": 18,
    "driftY": 17,
    "phase": 4.7,
    "angle": -24
  },
  {
    "id": "far-window",
    "x": 1484,
    "y": 229,
    "radiusX": 160,
    "radiusY": 75,
    "driftX": 8,
    "driftY": 9,
    "phase": 2.2,
    "angle": 8
  },
  {
    "id": "west-chasm-window",
    "x": 557,
    "y": 549,
    "radiusX": 122,
    "radiusY": 89,
    "driftX": 17,
    "driftY": 12,
    "phase": 5.1,
    "angle": -9
  }
] as const;

export const STAGE_GAMEPLAY_GROUND = [
  {
    "id": "southwestern-drift",
    "kind": "ridge",
    "x": 360,
    "y": 968,
    "radiusX": 275,
    "radiusY": 156,
    "angle": 9,
    "height": 12
  },
  {
    "id": "western-shoulder",
    "kind": "ridge",
    "x": 248,
    "y": 594,
    "radiusX": 282,
    "radiusY": 145,
    "angle": 82,
    "height": 24
  },
  {
    "id": "northern-deposit",
    "kind": "shelf",
    "x": 636,
    "y": 203,
    "radiusX": 322,
    "radiusY": 139,
    "angle": -7,
    "height": 22
  },
  {
    "id": "middle-saddle",
    "kind": "scour",
    "x": 947,
    "y": 550,
    "radiusX": 290,
    "radiusY": 170,
    "angle": 86,
    "height": -12
  },
  {
    "id": "far-shoulder",
    "kind": "ridge",
    "x": 1612,
    "y": 370,
    "radiusX": 270,
    "radiusY": 152,
    "angle": 79,
    "height": 26
  },
  {
    "id": "scoured-return",
    "kind": "scour",
    "x": 1400,
    "y": 844,
    "radiusX": 339,
    "radiusY": 129,
    "angle": -17,
    "height": -15
  }
] as const;
