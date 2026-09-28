import { GAME_CONSTANTS } from '@/config/constants';

/** Actual whole-kindling settlement for one searched pile. */
export function calculateKindlingYield(baseValue: number, affinity: number, modifier: number): number {
  return Math.max(1, Math.floor((baseValue + affinity) * modifier));
}

/** Small / medium / large pile examples; these do not disclose any unseen pile. */
export type KindlingYieldExamples = readonly [small: number, medium: number, large: number];

export function calculateKindlingYieldExamples(affinity: number, modifier: number): KindlingYieldExamples {
  const loot = GAME_CONSTANTS.LOOT;
  return [
    calculateKindlingYield(loot.VALUE_SAFE, affinity, modifier),
    calculateKindlingYield(loot.VALUE_CONTESTED, affinity, modifier),
    calculateKindlingYield(loot.VALUE_DEEP, affinity, modifier),
  ];
}
