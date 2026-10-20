/** Shared, pure physiology projections. Rules: system-assimilation-healing.md. */
import type { PollutionGrade } from '@/generation/world-study/pollution-grade';
import { ASSIMILATION_RULES as RULES } from '@/generated/assimilation-data';

export const ASSIMILATION_MAX = RULES.maximum;
export const POLLUTION_SATURATION = RULES.pollution_saturation;
export const HEALING_PER_CYCLE = RULES.healing_per_cycle;
export const HEALING_PURIFIER_MIN_HP = RULES.healing_purifier_min_hp;

/** Appearance provenance in assimilation points, never a second gameplay value.
 * Unknown historical exposure stays neutral rather than inventing a visited world.
 */
export interface AssimilationSources {
  readonly version: 1;
  readonly worlds: Readonly<Record<string, number>>;
  readonly unattributed: number;
}

const SOURCE_SUM_EPSILON = 1e-8;
export function validAssimilationWorldId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,95}$/.test(value);
}

export function validAssimilationSources(value: unknown, assimilation: number): value is AssimilationSources {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const source = value as Partial<AssimilationSources>;
  if (source.version !== 1 || typeof source.unattributed !== 'number' || !Number.isFinite(source.unattributed)
    || source.unattributed < 0 || typeof source.worlds !== 'object' || source.worlds === null
    || Array.isArray(source.worlds)) return false;
  const entries = Object.entries(source.worlds);
  if (entries.length > 128) return false;
  let sum = source.unattributed;
  for (const [worldId, points] of entries) {
    if (!validAssimilationWorldId(worldId) || typeof points !== 'number' || !Number.isFinite(points) || points <= 0) return false;
    sum += points;
  }
  return Number.isFinite(assimilation) && assimilation >= 0 && assimilation <= ASSIMILATION_MAX
    && sum <= assimilation + SOURCE_SUM_EPSILON;
}

/** Canonicalize only rounding/gaps; an overdrawn or malformed supplied spectrum rejects. */
export function normalizeAssimilationSources(assimilation: number, sources?: AssimilationSources): AssimilationSources {
  const amount = bounded(assimilation);
  if (sources !== undefined && !validAssimilationSources(sources, amount)) throw new Error('Invalid assimilation sources');
  if (!sources || amount === 0) return { version: 1, worlds: {}, unattributed: amount };
  const worlds: Record<string, number> = { ...sources.worlds };
  let attributed = Object.values(worlds).reduce((sum, points) => sum + points, 0);
  // Only floating-point excess can reach here; preserve its ratios at the bound.
  if (attributed > amount) {
    const factor = amount / attributed;
    for (const id of Object.keys(worlds)) worlds[id] = worlds[id]! * factor;
    attributed = amount;
  }
  return { version: 1, worlds, unattributed: Math.max(0, amount - attributed) };
}

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
