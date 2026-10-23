/** Shared optional material grammar. World identity is data, never a world-ID
 * drawing branch. A caller must opt in through the admitted runtime recipe or
 * an explicit preview; resolving a supported family never enables it alone. */
import { ENEMY_WORLD_MATERIAL_ROUTING, ENEMY_WORLD_MATERIAL_RULES, ENEMY_WORLD_MATERIAL_SOURCE_HASH } from '@/generated/enemy-world-materials';
import { R100_WORLD_APPEARANCES, R100_APPEARANCE_SOURCE_HASH } from '@/generated/r100-world-appearance';

export type EnemyWorldColor = readonly [number, number, number];
export interface EnemyWorldAdaptation {
  readonly key: string;
  readonly worldId: string;
  readonly kind: 'fibre' | 'membrane' | 'slab' | 'shell' | 'granular' | 'gel';
  readonly dark: EnemyWorldColor;
  readonly mid: EnemyWorldColor;
  readonly light: EnemyWorldColor;
  readonly secondary: EnemyWorldColor;
  readonly fibreCount: number;
  readonly membraneSpread: number;
  readonly motionLag: number;
  readonly paintBranching: number;
}
const color = (value: number): EnemyWorldColor => Object.freeze([value >>> 16 & 255, value >>> 8 & 255, value & 255]);
const cache = new Map<string, EnemyWorldAdaptation>();
export function resolveEnemyWorldAdaptation(worldId: string): EnemyWorldAdaptation | undefined {
  const existing = cache.get(worldId);
  if (existing) return existing;
  const route = ENEMY_WORLD_MATERIAL_ROUTING.find(row => row.worldId === worldId);
  const rule = ENEMY_WORLD_MATERIAL_RULES.find(row => row.family === route?.family);
  const appearance = R100_WORLD_APPEARANCES.find(row => row.worldId === worldId);
  if (!rule || !appearance) return undefined;
  const profile: EnemyWorldAdaptation = Object.freeze({
    key: `world-body-v1:${worldId}:${ENEMY_WORLD_MATERIAL_SOURCE_HASH}:${R100_APPEARANCE_SOURCE_HASH}`,
    worldId, kind: rule.kind,
    dark: color(appearance.solid.dark), mid: color(appearance.solid.mid), light: color(appearance.solid.light),
    secondary: color(appearance.secondary.mid),
    fibreCount: rule.fibreCount, membraneSpread: rule.membraneSpread,
    motionLag: rule.motionLag, paintBranching: rule.paintBranching,
  });
  cache.set(worldId, profile);
  return profile;
}
