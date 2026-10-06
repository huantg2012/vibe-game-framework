// AUTO-GENERATED from data/spatial-study-*.csv — DO NOT EDIT
export const SPATIAL_STUDY_SCENES = [
  {
    "id": "suspended-sea",
    "name": "悬海下的干床",
    "cols": 37,
    "rows": 31,
    "floors": "2:2:33:27",
    "walls": "25:16:1:1",
    "spawn": "18:27",
    "extract": "18:27",
    "loadout": "bare",
    "seaFrontY": 680,
    "seaBottomHeight": 150,
    "seaTopHeight": 300,
    "reefCol": 25,
    "reefRow": 16,
    "reefHeight": 310
  }
] as const;
export const SPATIAL_STUDY_PLACEMENTS = [
  {
    "id": "listener",
    "kind": "enemy",
    "col": 20,
    "row": 10,
    "tier": "",
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 180,
    "patrol": "17:10|23:10"
  },
  {
    "id": "near-pile",
    "kind": "kindling",
    "col": 25,
    "row": 10,
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
    "col": 16,
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
  }
] as const;
export const SPATIAL_STUDY_WATER = [
  {
    "id": "sea-curtain",
    "x": 592,
    "y": 544,
    "width": 144,
    "depth": 88,
    "footprint": "ellipse",
    "quietMs": 4200,
    "warningMs": 1800,
    "activeMs": 2600,
    "retractMs": 1400,
    "damage": 12,
    "hitIntervalMs": 800,
    "contactExtension": 0.96
  }
] as const;
