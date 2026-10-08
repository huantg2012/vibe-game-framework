/**
 * Per-sortie FragmentRoll axes. Not CSV fragment kinds. Same seed → same roll.
 */

import { mix32 } from '@/generation/seed-fork';
import type { ContaminationAge, RuinSeverity } from '@/generation/types';
import { SeededRandom } from '@/utils/random';

export const CONTAMINATION_AGES: readonly ContaminationAge[] = ['new', 'standard', 'ancient'];
export const RUIN_SEVERITIES: readonly RuinSeverity[] = ['intact', 'broken', 'eaten'];

export function isContaminationAge(value: unknown): value is ContaminationAge {
  return value === 'new' || value === 'standard' || value === 'ancient';
}

export function isRuinSeverity(value: unknown): value is RuinSeverity {
  return value === 'intact' || value === 'broken' || value === 'eaten';
}

/** Uniform 3×3. Production path always calls this; missing fields fall back at paint. */
export function rollFragmentAxes(seed: number): {
  contaminationAge: ContaminationAge;
  ruinSeverity: RuinSeverity;
} {
  const rng = new SeededRandom(mix32(seed, 'fragment-roll'));
  return {
    contaminationAge: CONTAMINATION_AGES[rng.nextInt(0, CONTAMINATION_AGES.length - 1)]!,
    ruinSeverity: RUIN_SEVERITIES[rng.nextInt(0, RUIN_SEVERITIES.length - 1)]!,
  };
}
