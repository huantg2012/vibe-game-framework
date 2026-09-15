// AUTO-GENERATED from data/living-landmass-*.csv — DO NOT EDIT
export const LIVING_LANDMASS_SCENES = [
  {
    "id": "living-borne-fin",
    "name": "彼此托举的生命大陆",
    "worldId": "living-landmass",
    "recipeVersion": 1,
    "cols": 43,
    "rows": 35,
    "floors": "14:27:10:5|12:25:17:4|9:12:5:16|12:10:20:6|25:15:5:12",
    "walls": "",
    "voids": "14:16:11:9",
    "spawn": "18:29",
    "extract": "18:29",
    "entryDurationMs": 1200
  }
] as const;
export const LIVING_LANDMASS_SUPPORTS = [
  {
    "sceneId": "living-borne-fin",
    "id": "stable-ridge",
    "kind": "stable",
    "x": 656,
    "y": 688,
    "radiusX": 656,
    "radiusY": 688,
    "angle": 0,
    "height": 0,
    "flexHeight": 0
  },
  {
    "sceneId": "living-borne-fin",
    "id": "borne-fin",
    "kind": "fin",
    "x": 880,
    "y": 656,
    "radiusX": 128,
    "radiusY": 160,
    "angle": 0,
    "height": 0,
    "flexHeight": 32
  }
] as const;
export const LIVING_LANDMASS_TENSION = [
  {
    "sceneId": "living-borne-fin",
    "id": "strained-connection",
    "x": 880,
    "y": 656,
    "hitX": 880,
    "hitY": 788,
    "quietMs": 5200,
    "warningMs": 2400,
    "activeMs": 2200,
    "releaseMs": 2200,
    "transmissionMs": 350,
    "reliefMs": 1200,
    "dangerThreshold": 0.75,
    "damage": 10,
    "hitIntervalMs": 1000,
    "outline": "-64:-48|48:-48|64:-16|52:48|-48:48|-64:16"
  }
] as const;
export const LIVING_LANDMASS_PLACEMENTS = [
  {
    "sceneId": "living-borne-fin",
    "id": "far-listener",
    "kind": "enemy",
    "col": 23,
    "row": 12,
    "tier": "",
    "lootPoolId": "",
    "allowWeapon": null,
    "substrate": "insect_remnant",
    "coverage": "infiltrate",
    "motion": "motion_patrol",
    "sense": "sense_hear",
    "rhythm": "rhythm_open",
    "contact": "contact_melee_three",
    "facing": 0,
    "patrol": "23:12|29:12|29:10"
  },
  {
    "sceneId": "living-borne-fin",
    "id": "entrance-kindling",
    "kind": "kindling",
    "col": 17,
    "row": 27,
    "tier": "safe",
    "lootPoolId": "",
    "allowWeapon": false,
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
    "sceneId": "living-borne-fin",
    "id": "far-kindling",
    "kind": "kindling",
    "col": 28,
    "row": 11,
    "tier": "contested",
    "lootPoolId": "",
    "allowWeapon": true,
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
    "sceneId": "living-borne-fin",
    "id": "fin-remnant",
    "kind": "contaminant",
    "col": 27,
    "row": 17,
    "tier": "contested",
    "lootPoolId": "rift-debris",
    "allowWeapon": null,
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
    "sceneId": "living-borne-fin",
    "id": "ridge-remnant",
    "kind": "contaminant",
    "col": 12,
    "row": 19,
    "tier": "safe",
    "lootPoolId": "rift-debris",
    "allowWeapon": null,
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
export type LivingLandmassSceneId = typeof LIVING_LANDMASS_SCENES[number]["id"];
