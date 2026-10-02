/**
 * Append-only executor dispatch for worlds admitted before R100.
 * A recipe version identifies its algorithms as well as its frozen data. Never
 * recover these records through the latest generator and merely reject drift.
 */
import {
  createWorldProductionMap, generateRiftLayout, validWorldProductionRecipe,
} from './legacy-rift-v2/executor.js';
import type { WorldProductionRecipe } from './world-study/production-recipe';
import type { WorldProductionMap } from './world-study/production-map';
import type { GeneratedRiftLayout } from './types';

export function validLegacyWorldRecipe(value: unknown): value is WorldProductionRecipe {
  return validWorldProductionRecipe(value);
}

export function restoreLegacyProductionWorld(recipe: WorldProductionRecipe): WorldProductionMap {
  if (!validLegacyWorldRecipe(recipe)) throw new Error('Invalid historical world recipe');
  return createWorldProductionMap(recipe.profile, recipe.space, recipe.requestedSeed, {
    contentFragmentTypeId: recipe.contentFragmentTypeId,
    paintGeometryVersion: recipe.paintGeometryVersion ?? 1,
    ...(recipe.version === 2 ? { generationVersion: 2, conditions: recipe.conditions,
      fallbackSeeds: recipe.conditions.fallbackSeeds } : {}),
  });
}

export function restoreLegacyProceduralLayout(seed: number): GeneratedRiftLayout {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Invalid historical layout seed');
  return generateRiftLayout(seed);
}
