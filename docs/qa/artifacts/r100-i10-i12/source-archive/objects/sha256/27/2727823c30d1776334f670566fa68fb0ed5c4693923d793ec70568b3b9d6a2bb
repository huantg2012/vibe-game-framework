/** Stable per pile: combat/preview/input order never advances this random stream. */
import { WEAPON_DATA, WEAPON_FIRST_DISCOVERY, WEAPON_LOOT_PROFILES } from '@/generated/weapon-data';
import { mix32 } from '@/generation/seed-fork';
import type { KindlingTier } from '@/types/map-types';

export interface WeaponLootRequest {
  readonly runSeed: number;
  readonly nodeId: string;
  readonly tier: KindlingTier;
  readonly firstWeaponDiscovered: boolean;
  readonly allowWeapon?: boolean;
}
const tiers: readonly KindlingTier[] = ['safe', 'contested', 'deep'];
const qualities = ['ordinary', 'good', 'fine', 'excellent'] as const;
const variants = ['standard', 'light', 'resistant'] as const;

function weighted(weights: readonly number[], seed: number): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let value = (seed >>> 0) / 4294967296 * total;
  for (let i = 0; i < weights.length; i++) {
    value -= weights[i]!;
    if (value < 0) return i;
  }
  return weights.length - 1;
}

export function rollWeaponDrop(request: WeaponLootRequest): string | null {
  if (request.allowWeapon === false) return null;
  if (!request.firstWeaponDiscovered && tiers.indexOf(request.tier) >= tiers.indexOf(WEAPON_FIRST_DISCOVERY.minimumTier)) {
    return WEAPON_FIRST_DISCOVERY.definitionId;
  }
  const profile = WEAPON_LOOT_PROFILES[request.tier];
  const seed = mix32(request.runSeed, 'weapon-pile:' + request.nodeId);
  if ((seed >>> 0) / 4294967296 * 100 >= profile.chancePercent) return null;
  const quality = qualities[weighted(profile.qualityWeights, mix32(seed, 'quality'))]!;
  const variant = variants[weighted(profile.variantWeights, mix32(seed, 'variant'))]!;
  const id = quality === 'ordinary' ? 'crowbar_plain' : 'crowbar_' + quality + '_' + variant;
  if (!WEAPON_DATA[id]) throw new Error('Weapon drop references missing definition: ' + id);
  return id;
}

export { createWeaponInstance } from '@/systems/equipment-lifecycle';
