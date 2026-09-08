// Generated from contamination-families.csv, contamination-dialects.csv and contamination-encounters.csv. Do not edit.
import type { PortfolioId, LexemeSlot } from './contamination-lexicon-data';
export interface FamilyCapability extends Readonly<Record<LexemeSlot, readonly string[]>> { readonly id: string; readonly substrate: string; readonly portfolio: PortfolioId; readonly infiltrateMotion: string; }
export interface ContaminationDialect { readonly substrates: readonly (readonly [string, number])[]; readonly wallHostWeight: number; readonly volumeHostWeight: number; }
export interface ContaminationEncounter { readonly hearingWallWeight: number; readonly hearingFloorWeight: number; }
export const CONTAMINATION_ENCOUNTER_DATA: Readonly<Record<string, ContaminationEncounter>> = {
  "frag-outdoor": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 4
  },
  "frag-clinic": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  },
  "frag-metro": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  },
  "frag-library": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  },
  "frag-residential": {
    "hearingWallWeight": 0,
    "hearingFloorWeight": 3
  }
};
export const FAMILY_CAPABILITY_DATA: readonly FamilyCapability[] = [
  {
    "id": "organic_remnant_jia",
    "substrate": "organic_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "lamp_pillar_jia",
    "substrate": "lamp_pillar",
    "portfolio": "jia",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "doorframe_yi",
    "substrate": "doorframe",
    "portfolio": "yi",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_touch",
      "sense_narrow",
      "sense_hear"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_adjacent_strike"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "wall_rust_yi",
    "substrate": "wall_rust",
    "portfolio": "yi",
    "motion": [
      "motion_wall",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_touch",
      "sense_narrow",
      "sense_hear"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_adjacent_strike"
    ],
    "infiltrateMotion": "motion_wall"
  },
  {
    "id": "fungal_mat_bing",
    "substrate": "fungal_mat",
    "portfolio": "bing",
    "motion": [
      "motion_cluster"
    ],
    "sense": [
      "sense_touch"
    ],
    "rhythm": [
      "rhythm_cluster"
    ],
    "contact": [
      "contact_step_chaos"
    ],
    "infiltrateMotion": "motion_cluster"
  },
  {
    "id": "oil_film_bing",
    "substrate": "oil_film",
    "portfolio": "bing",
    "motion": [
      "motion_cluster"
    ],
    "sense": [
      "sense_touch"
    ],
    "rhythm": [
      "rhythm_cluster"
    ],
    "contact": [
      "contact_step_chaos"
    ],
    "infiltrateMotion": "motion_cluster"
  },
  {
    "id": "stalk_clump_jia",
    "substrate": "stalk_clump",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_turn"
  },
  {
    "id": "railing_post_jia",
    "substrate": "railing_post",
    "portfolio": "jia",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "ash_veil_bing",
    "substrate": "ash_veil",
    "portfolio": "bing",
    "motion": [
      "motion_cluster"
    ],
    "sense": [
      "sense_touch"
    ],
    "rhythm": [
      "rhythm_cluster"
    ],
    "contact": [
      "contact_step_chaos"
    ],
    "infiltrateMotion": "motion_cluster"
  },
  {
    "id": "sound_echo_ding",
    "substrate": "sound_echo",
    "portfolio": "ding",
    "motion": [
      "motion_anchor",
      "motion_wind",
      "motion_trail"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "light_scatter_ding",
    "substrate": "light_scatter",
    "portfolio": "ding",
    "motion": [
      "motion_anchor",
      "motion_wind",
      "motion_trail"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_trail"
  },
  {
    "id": "space_interval_ding",
    "substrate": "space_interval",
    "portfolio": "ding",
    "motion": [
      "motion_anchor",
      "motion_wind",
      "motion_trail"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "street_wreckage_jia",
    "substrate": "street_wreckage",
    "portfolio": "jia",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "insect_remnant_jia",
    "substrate": "insect_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "mammal_remnant_jia",
    "substrate": "mammal_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "worm_remnant_jia",
    "substrate": "worm_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_turn"
  },
  {
    "id": "human_remnant_jia",
    "substrate": "human_remnant",
    "portfolio": "jia",
    "motion": [
      "motion_patrol",
      "motion_turn",
      "motion_anchor"
    ],
    "sense": [
      "sense_cone",
      "sense_hear",
      "sense_narrow"
    ],
    "rhythm": [
      "rhythm_open",
      "rhythm_sleep",
      "rhythm_pulse"
    ],
    "contact": [
      "contact_melee_three"
    ],
    "infiltrateMotion": "motion_patrol"
  },
  {
    "id": "gas_mass_ding",
    "substrate": "gas_mass",
    "portfolio": "ding",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "mist_bank_ding",
    "substrate": "mist_bank",
    "portfolio": "ding",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  },
  {
    "id": "dust_swarm_ding",
    "substrate": "dust_swarm",
    "portfolio": "ding",
    "motion": [
      "motion_anchor"
    ],
    "sense": [
      "sense_domain",
      "sense_reverse"
    ],
    "rhythm": [
      "rhythm_open"
    ],
    "contact": [
      "contact_volume_chaos"
    ],
    "infiltrateMotion": "motion_anchor"
  }
];
export const CONTAMINATION_DIALECT_DATA: Readonly<Record<string, ContaminationDialect>> = {
  "frag-outdoor": {
    "substrates": [
      [
        "fungal_mat",
        3
      ],
      [
        "ash_veil",
        3
      ],
      [
        "oil_film",
        3
      ],
      [
        "organic_remnant",
        2
      ],
      [
        "stalk_clump",
        2
      ],
      [
        "sound_echo",
        2
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "gas_mass",
        2
      ],
      [
        "mist_bank",
        3
      ],
      [
        "dust_swarm",
        3
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-clinic": {
    "substrates": [
      [
        "organic_remnant",
        1
      ],
      [
        "stalk_clump",
        1
      ],
      [
        "ash_veil",
        1
      ],
      [
        "sound_echo",
        1
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "fungal_mat",
        0
      ],
      [
        "oil_film",
        0
      ],
      [
        "gas_mass",
        3
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        1
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-metro": {
    "substrates": [
      [
        "oil_film",
        2
      ],
      [
        "ash_veil",
        2
      ],
      [
        "sound_echo",
        2
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "organic_remnant",
        0
      ],
      [
        "fungal_mat",
        0
      ],
      [
        "stalk_clump",
        0
      ],
      [
        "gas_mass",
        3
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        3
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-library": {
    "substrates": [
      [
        "organic_remnant",
        2
      ],
      [
        "sound_echo",
        2
      ],
      [
        "stalk_clump",
        1
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "fungal_mat",
        1
      ],
      [
        "oil_film",
        1
      ],
      [
        "ash_veil",
        1
      ],
      [
        "gas_mass",
        1
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        4
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  },
  "frag-residential": {
    "substrates": [
      [
        "organic_remnant",
        3
      ],
      [
        "stalk_clump",
        3
      ],
      [
        "oil_film",
        2
      ],
      [
        "ash_veil",
        1
      ],
      [
        "sound_echo",
        1
      ],
      [
        "insect_remnant",
        1
      ],
      [
        "human_remnant",
        1
      ],
      [
        "mammal_remnant",
        1
      ],
      [
        "worm_remnant",
        1
      ],
      [
        "fungal_mat",
        0
      ],
      [
        "gas_mass",
        2
      ],
      [
        "mist_bank",
        2
      ],
      [
        "dust_swarm",
        2
      ]
    ],
    "wallHostWeight": 0,
    "volumeHostWeight": 1
  }
};
