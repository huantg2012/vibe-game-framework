/** A departure freezes its selected recipe; CSV edits apply only to future trips. */
import { WORLD_PRODUCTION_POOL } from '@/generated/rift-world-pool-data';
import { CONTAMINATION_DIALECT_DATA } from '@/generated/contamination-family-data';
import { mix32 } from '@/generation/seed-fork';
import { worldProfileById } from './profiles';
import { SPACE_PROFILES, validateSpaceProfile, type SpaceProfile } from './space-profile';
import { validateSurfaceRecipe } from './surface-field';
import type { WorldProfile } from './types';

export interface WorldProductionRecipe {
  readonly version: 1;
  readonly requestedSeed: number;
  readonly profile: WorldProfile;
  readonly space: SpaceProfile;
  readonly contentFragmentTypeId: string;
}
const COLOR_ROLES = ['void','shadow','floorDeep','floor','floorLight','materialDark','materialMid','materialLight','faceLight','accentDim','peak','actorDark','actorMid','actorLight','ground','groundLight','groundDark','wall','wallLight','wallDark','accent','accentLight'] as const;
const named = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
export function validWorldProductionRecipe(value: unknown): value is WorldProductionRecipe {
  try {
    if (!value || typeof value !== 'object') return false;
    const recipe = value as WorldProductionRecipe, profile = recipe.profile;
    if (recipe.version !== 1 || !Number.isSafeInteger(recipe.requestedSeed) || recipe.requestedSeed < 0 || recipe.requestedSeed > 0xffffffff
      || !profile || !named(profile.id) || !named(profile.label) || typeof profile.description !== 'string' || profile.description.length > 2000
      || !['strata','crystal','glaze'].includes(profile.material) || !profile.palette
      || !COLOR_ROLES.every(key => Number.isSafeInteger(profile.palette[key]) && profile.palette[key] >= 0 && profile.palette[key] <= 0xffffff)
      || !recipe.space || !named(recipe.space.id) || !named(recipe.space.label)
      || !named(recipe.contentFragmentTypeId) || !CONTAMINATION_DIALECT_DATA[recipe.contentFragmentTypeId]) return false;
    validateSurfaceRecipe(profile.surface); validateSpaceProfile(recipe.space);
    return true;
  } catch { return false; }
}
export function selectWorldProductionRecipe(requestedSeed: number): WorldProductionRecipe {
  if (!Number.isSafeInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 0xffffffff) throw new Error('Invalid world selection seed');
  const pool = WORLD_PRODUCTION_POOL.filter(row => row.enabled);
  const total = pool.reduce((sum, row) => sum + row.weight, 0);
  let ticket = mix32(requestedSeed, 'production-world-pool-v1') / 0x100000000 * total;
  const chosen = pool.find(row => { ticket -= row.weight; return ticket < 0; });
  if (!chosen) throw new Error('No enabled world production recipe');
  const space = SPACE_PROFILES.find(row => row.id === chosen.spaceId);
  if (!space) throw new Error(`Missing world space ${chosen.spaceId}`);
  // No shared mutable references to generated config enter the save.
  return JSON.parse(JSON.stringify({ version: 1, requestedSeed, profile: worldProfileById(chosen.profileId),
    space, contentFragmentTypeId: chosen.contentFragmentTypeId })) as WorldProductionRecipe;
}
