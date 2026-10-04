/**
 * Append-only executor dispatch for worlds admitted before R100.
 * A recipe version identifies its algorithms as well as its frozen data. Never
 * recover these records through the latest generator and merely reject drift.
 */
import { createHistoricalArithmeticExecutor } from './legacy-rift-v2/arithmetic-executor.js';
import { v8Arm64Atan2, v8FdlibmAtan2 } from './legacy-rift-v2/fdlibm-atan2';
import { generatedRiftIdentity, assertMatchingRiftIdentity } from './rift-generation-identity';
import type { RiftCheckpoint } from '@/types/rift-checkpoint';
import {
  createWorldProductionMap, generateRiftLayout, validWorldProductionRecipe,
} from './legacy-rift-v2/executor.js';
import type { WorldProductionRecipe } from './world-study/production-recipe';
import type { WorldProductionMap } from './world-study/production-map';
import type { GeneratedRiftLayout } from './types';

export function validLegacyWorldRecipe(value: unknown): value is WorldProductionRecipe {
  return validWorldProductionRecipe(value);
}

const arithmeticExecutors = [v8FdlibmAtan2, v8Arm64Atan2].map(createHistoricalArithmeticExecutor);

export function restoreLegacyProductionWorld(recipe: WorldProductionRecipe, expected?: RiftCheckpoint['identity']): WorldProductionMap {
  if (!validLegacyWorldRecipe(recipe)) throw new Error('Invalid historical world recipe');
  const options: import('./world-study/production-map').WorldProductionOptions = {
    contentFragmentTypeId: recipe.contentFragmentTypeId,
    paintGeometryVersion: recipe.paintGeometryVersion ?? 1,
    ...(recipe.version === 2 ? { generationVersion: 2, conditions: recipe.conditions,
      fallbackSeeds: recipe.conditions.fallbackSeeds } : {}),
  };
  if (!expected) return createWorldProductionMap(recipe.profile, recipe.space, recipe.requestedSeed, options);
  const matches = (candidate: WorldProductionMap): boolean => {
    try { assertMatchingRiftIdentity(generatedRiftIdentity(candidate.layout, recipe, candidate), expected); return true; }
    catch { return false; }
  };
  try {
    const world = createWorldProductionMap(recipe.profile, recipe.space, recipe.requestedSeed, options);
    if (matches(world)) return world;
  } catch (reason) {
    // A historical arithmetic profile can also change admission near a strict
    // geometric boundary. Only v2 may try the bounded complete executors below.
    if (recipe.version !== 2) throw reason;
  }
  // Only v2 had the demonstrated cross-V8 atan2 identity defect. Each candidate
  // runs the complete sealed algorithm; no field rounding or hash alias exists.
  if (recipe.version === 2) for (const executor of arithmeticExecutors) {
    try {
      const candidate = executor.createWorldProductionMap(recipe.profile, recipe.space, recipe.requestedSeed, options);
      if (matches(candidate)) return candidate;
    } catch { /* This complete historical profile did not admit the saved world. */ }
  }
  throw new Error('Saved world does not match any supported historical arithmetic contract');
}

export function restoreLegacyProceduralLayout(seed: number): GeneratedRiftLayout {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Invalid historical layout seed');
  return generateRiftLayout(seed);
}
