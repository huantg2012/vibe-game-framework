import { getCatalogMaxUses } from './contaminant-catalog';
/** CSV-owned quality rules. Queries never mutate legacy instances or refill uses. */
import { CONTAMINANT_DATA, ACTIVE_CONTAMINANT_TYPES } from '@/generated/contaminant-data';
import { CONTAMINANT_LOOT_PROFILES } from '@/generated/contaminant-economy-data';
import { CONTAMINANT_SOURCE_POOLS } from '@/generated/contaminant-sources-data';
import { mix32 } from '@/generation/seed-fork';
import type { KindlingTier } from '@/types/map-types';
import { CONTAMINANT_QUALITY_DATA, CONTAMINANT_QUALITY_ORDER } from '@/generated/contaminant-quality-data';
import type { Contaminant, ContaminantQuality, ContaminantRarity, ContaminantType } from '@/types/game-types';

type QualityIdentity = Pick<Contaminant, 'rarity' | 'quality'>;
type QualityItem = Pick<Contaminant, 'type' | 'rarity' | 'quality' | 'catalog'>;
export type ContaminantQualityWeights = Readonly<Record<ContaminantQuality, number>>;

const LEGACY_QUALITY: Readonly<Record<ContaminantRarity, ContaminantQuality>> = {
  common: 'ordinary', fine: 'good', rare: 'fine',
};
const DROP_FAMILIES = ACTIVE_CONTAMINANT_TYPES;

export function isContaminantQuality(value: unknown): value is ContaminantQuality {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CONTAMINANT_QUALITY_DATA, value);
}

export function supportsContaminantQuality(type: ContaminantType): boolean {
  return type === 'catalog' || CONTAMINANT_QUALITY_DATA.ordinary.maxUses[type] !== undefined;
}

export function getContaminantQuality(item: QualityIdentity): ContaminantQuality {
  return item.quality ?? LEGACY_QUALITY[item.rarity];
}

export function getContaminantQualityName(item: QualityIdentity): string {
  return CONTAMINANT_QUALITY_DATA[getContaminantQuality(item)].name;
}

export function getContaminantQualityRank(item: QualityIdentity): number {
  return CONTAMINANT_QUALITY_DATA[getContaminantQuality(item)].rank;
}

export function getContaminantMaxUses(item: QualityItem): number {
  if(item.type === 'catalog') return getCatalogMaxUses(item);
  return CONTAMINANT_QUALITY_DATA[getContaminantQuality(item)].maxUses[item.type]
    ?? CONTAMINANT_DATA[item.type].toolUses;
}

/** Optional source weights are an explicit future source-quality seam, not inferred danger. */
export function rollContaminantQuality(
  random: () => number = Math.random,
  weights?: ContaminantQualityWeights,
): ContaminantQuality {
  let total = 0;
  for (const quality of CONTAMINANT_QUALITY_ORDER) {
    const weight = weights ? weights[quality] : CONTAMINANT_QUALITY_DATA[quality].standardDropWeight;
    if (!Number.isFinite(weight) || weight < 0) throw new Error('Invalid contaminant quality weight');
    total += weight;
  }
  if (!Number.isFinite(total) || total <= 0) throw new Error('Contaminant quality weights require a positive total');
  let remainder = sampleRandom(random) * total;
  for (const quality of CONTAMINANT_QUALITY_ORDER) {
    const weight = weights ? weights[quality] : CONTAMINANT_QUALITY_DATA[quality].standardDropWeight;
    if (remainder < weight) return quality;
    remainder -= weight;
  }
  // Floating-point subtraction at the upper boundary must not turn into a reroll.
  for (let index = CONTAMINANT_QUALITY_ORDER.length - 1; index >= 0; index--) {
    const quality = CONTAMINANT_QUALITY_ORDER[index]!;
    if ((weights ? weights[quality] : CONTAMINANT_QUALITY_DATA[quality].standardDropWeight) > 0) return quality;
  }
  throw new Error('Unreachable contaminant quality selection');
}

export interface ContaminantDrop {
  readonly type: ContaminantType;
  readonly rarity: ContaminantRarity;
  readonly quality?: ContaminantQuality;
}

/** Select the ability family first. Quality cannot restrict which functions can drop. */
export function rollContaminantDrop(
  random: () => number = Math.random,
  weights?: ContaminantQualityWeights,
): ContaminantDrop {
  const type = DROP_FAMILIES[Math.floor(sampleRandom(random) * DROP_FAMILIES.length)]!;
  const rarity = CONTAMINANT_DATA[type].rarity;
  return supportsContaminantQuality(type)
    ? { type, rarity, quality: rollContaminantQuality(random, weights) }
    : { type, rarity };
}

function sampleRandom(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('Random sample must be in [0, 1)');
  return value;
}

/** Per-node streams prevent redraws, combat RNG or failed persistence from rerolling loot. */
export function rollContaminantNodeDrop(runSeed: number, nodeId: string, tier: KindlingTier, poolId?: string): ContaminantDrop {
  const seed = mix32(runSeed, 'contaminant-pile:' + nodeId);
  const samples = [mix32(seed, 'family'), mix32(seed, 'quality')];
  if (poolId !== undefined) {
    const pool = CONTAMINANT_SOURCE_POOLS[poolId as keyof typeof CONTAMINANT_SOURCE_POOLS];
    if (!pool) throw new Error(`Unknown contaminant source pool: ${poolId}`);
    const total = pool.reduce((sum, row) => sum + row.weight, 0);
    let sample = (samples[0]! >>> 0) / 4294967296 * total;
    let type: ContaminantType = pool[pool.length - 1]!.type;
    for (const entry of pool) {
      sample -= entry.weight;
      if (sample < 0) { type = entry.type; break; }
    }
    const rarity = CONTAMINANT_DATA[type].rarity;
    return { type, rarity, quality: rollContaminantQuality(() => (samples[1]! >>> 0) / 4294967296, CONTAMINANT_LOOT_PROFILES[tier]) };
  }
  let index = 0;
  return rollContaminantDrop(() => (samples[index++]! >>> 0) / 4294967296, CONTAMINANT_LOOT_PROFILES[tier]);
}
