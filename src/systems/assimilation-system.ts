/** Shared, pure physiology projections. Rules: system-assimilation-healing.md. */
import type { PollutionGrade } from '@/generation/world-study/pollution-grade';
import { ASSIMILATION_RULES as RULES } from '@/generated/assimilation-data';

export const ASSIMILATION_MAX = RULES.maximum;
export const POLLUTION_SATURATION = RULES.pollution_saturation;
export const HEALING_PER_CYCLE = RULES.healing_per_cycle;
export const HEALING_PURIFIER_MIN_HP = RULES.healing_purifier_min_hp;

function bounded(value: number, maximum: number = RULES.maximum): number {
  if (!Number.isFinite(value)) throw new Error('Non-finite physiology value');
  return Math.max(0, Math.min(maximum, value));
}

/** Points per minute after saturation. Equipment and growth each apply once. */
export function assimilationPerMinute(grade: PollutionGrade | undefined, resistance = 0, growthResistance = 0): number {
  const base = grade === 'severe' ? RULES.rate_severe : grade === 'medium' ? RULES.rate_medium : RULES.rate_low;
  return base * (1 - bounded(resistance, RULES.equipment_resistance_cap)) * (1 - bounded(growthResistance, RULES.growth_resistance_cap));
}

/** Pollution and assimilation stay visually distinct: adaptation restores range,
 * not the world's corruption, an intact body or visibility through VOID.
 */
export function getAssimilationModulators(pollution: number, assimilation: number): {
  radiusScale: number; edgeCorruption: number; screenFlicker: number; speedMult: number;
} {
  const p = bounded(pollution) / 100;
  const a = bounded(assimilation) / 100;
  return {
    radiusScale: 1 - RULES.vision_loss * p + RULES.vision_recovery * a * p,
    edgeCorruption: RULES.corruption_base + RULES.corruption_gain * p,
    screenFlicker: RULES.flicker_max * p * p,
    speedMult: 1 - RULES.speed_loss * p,
  };
}

/** Apply once to unprovoked recognition; it is not damage immunity. */
export function assimilationHostilityMultiplier(assimilation: number): number {
  return 1 - RULES.hostility_reduction * bounded(assimilation) / RULES.maximum;
}

export function healingAfter(assimilation: number): number {
  return Math.max(0, bounded(assimilation) - HEALING_PER_CYCLE);
}

export function healingCyclesToClear(assimilation: number): number {
  return Math.ceil(bounded(assimilation) / HEALING_PER_CYCLE);
}
