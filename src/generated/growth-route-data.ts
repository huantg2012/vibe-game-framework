// AUTO-GENERATED from data/growth-route.csv — DO NOT EDIT
import type { GrowthUpgradeId } from '@/types/game-types';
import type { GrowthUnlockRequirement } from '@/generated/upgrade-data';

export type GrowthRouteUnit = GrowthUpgradeId | 'thicken';
export interface GrowthRouteStep {
  readonly order: number;
  readonly unit: GrowthRouteUnit;
  readonly level: number;
  readonly requirement: GrowthUnlockRequirement;
  readonly requirementText: string;
  readonly phase: string;
  readonly cost: number;
}

export const GROWTH_ROUTE_DATA: readonly GrowthRouteStep[] = [
  {
    "order": 1,
    "unit": "growth_vitality",
    "level": 1,
    "requirement": "none",
    "requirementText": "",
    "phase": "立足",
    "cost": 8
  },
  {
    "order": 2,
    "unit": "growth_kindling_affinity",
    "level": 1,
    "requirement": "none",
    "requirementText": "",
    "phase": "立足",
    "cost": 9
  },
  {
    "order": 3,
    "unit": "growth_defense_slot",
    "level": 1,
    "requirement": "none",
    "requirementText": "",
    "phase": "立足",
    "cost": 9
  },
  {
    "order": 4,
    "unit": "growth_chaos_resist",
    "level": 1,
    "requirement": "none",
    "requirementText": "",
    "phase": "立足",
    "cost": 10
  },
  {
    "order": 5,
    "unit": "growth_forecast_clarity",
    "level": 1,
    "requirement": "impactExperienced",
    "requirementText": "承受冲击",
    "phase": "立足",
    "cost": 11
  },
  {
    "order": 6,
    "unit": "growth_vitality",
    "level": 2,
    "requirement": "none",
    "requirementText": "",
    "phase": "立足",
    "cost": 12
  },
  {
    "order": 7,
    "unit": "thicken",
    "level": 1,
    "requirement": "none",
    "requirementText": "",
    "phase": "立足",
    "cost": 12
  },
  {
    "order": 8,
    "unit": "growth_kindling_affinity",
    "level": 2,
    "requirement": "none",
    "requirementText": "",
    "phase": "整备",
    "cost": 13
  },
  {
    "order": 9,
    "unit": "growth_forecast_clarity",
    "level": 2,
    "requirement": "none",
    "requirementText": "",
    "phase": "整备",
    "cost": 14
  },
  {
    "order": 10,
    "unit": "growth_defense_slot",
    "level": 2,
    "requirement": "none",
    "requirementText": "",
    "phase": "整备",
    "cost": 16
  },
  {
    "order": 11,
    "unit": "growth_chaos_resist",
    "level": 2,
    "requirement": "none",
    "requirementText": "",
    "phase": "整备",
    "cost": 17
  },
  {
    "order": 12,
    "unit": "growth_sortie_slot",
    "level": 1,
    "requirement": "none",
    "requirementText": "",
    "phase": "整备",
    "cost": 18
  },
  {
    "order": 13,
    "unit": "growth_vitality",
    "level": 3,
    "requirement": "none",
    "requirementText": "",
    "phase": "整备",
    "cost": 19
  },
  {
    "order": 14,
    "unit": "thicken",
    "level": 2,
    "requirement": "none",
    "requirementText": "",
    "phase": "整备",
    "cost": 21
  },
  {
    "order": 15,
    "unit": "growth_chaos_resist",
    "level": 3,
    "requirement": "none",
    "requirementText": "",
    "phase": "承压",
    "cost": 23
  },
  {
    "order": 16,
    "unit": "growth_kindling_affinity",
    "level": 3,
    "requirement": "none",
    "requirementText": "",
    "phase": "承压",
    "cost": 24
  },
  {
    "order": 17,
    "unit": "growth_forecast_clarity",
    "level": 3,
    "requirement": "crestExperienced",
    "requirementText": "抵达退潮",
    "phase": "承压",
    "cost": 26
  },
  {
    "order": 18,
    "unit": "growth_defense_slot",
    "level": 3,
    "requirement": "none",
    "requirementText": "",
    "phase": "承压",
    "cost": 28
  },
  {
    "order": 19,
    "unit": "growth_vitality",
    "level": 4,
    "requirement": "none",
    "requirementText": "",
    "phase": "承压",
    "cost": 30
  },
  {
    "order": 20,
    "unit": "growth_chaos_resist",
    "level": 4,
    "requirement": "none",
    "requirementText": "",
    "phase": "承压",
    "cost": 33
  },
  {
    "order": 21,
    "unit": "thicken",
    "level": 3,
    "requirement": "none",
    "requirementText": "",
    "phase": "承压",
    "cost": 35
  },
  {
    "order": 22,
    "unit": "growth_chaos_resist",
    "level": 5,
    "requirement": "none",
    "requirementText": "",
    "phase": "承压",
    "cost": 38
  }
];
