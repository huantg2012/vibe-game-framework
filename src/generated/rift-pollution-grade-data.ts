// Generated from data/rift-pollution-grades.csv; native DEV master grading only, no graded production departures enabled.
import type { PollutionGradeDefinition } from '../generation/world-study/pollution-grade';
export const POLLUTION_GRADE_SOURCE_HASH = '97ab3d72c2a2c9c4f1499606c2ed1fd6e17665789ad35edfe3a05ce8ecd60c07';
export const POLLUTION_GRADE_DEFINITIONS: readonly PollutionGradeDefinition[] = [
  {
    "id": "low",
    "version": 2,
    "label": "低污染",
    "status": "dev-masters",
    "intent": "污染局部侵入；允许停留观察和低损耗搜取",
    "paintCount": 2,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "infiltrate",
    "volumePool": [
      "gas_mass",
      "mist_bank",
      "dust_swarm",
      "sound_echo"
    ],
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
    "version": 2,
    "label": "中污染",
    "status": "dev-masters",
    "intent": "污染分布在多处路径边；观察风险后选择绕行或承受污染",
    "paintCount": 4,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "rewrite",
    "volumePool": [
      "gas_mass",
      "mist_bank",
      "dust_swarm",
      "sound_echo"
    ],
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
    "version": 2,
    "label": "重度污染",
    "status": "dev-masters",
    "intent": "大片地面和空气已被侵占；充分准备后短时深入并尽早撤离",
    "paintCount": 6,
    "paintSubstrate": "oil_film",
    "paintContinuity": "monolith",
    "paintCoverage": "overwrite",
    "volumePool": [
      "gas_mass",
      "mist_bank",
      "dust_swarm",
      "sound_echo"
    ],
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
