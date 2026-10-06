/** Typed boundary only. Runtime algorithms/data are contained in executor.js. */
import type { WorldProductionOptions, WorldProductionMap } from '../world-study/production-map';
import type { WorldProductionRecipe } from '../world-study/production-recipe';
import type { WorldProfile } from '../world-study/types';
import type { SpaceProfile } from '../world-study/space-profile';
import type { GeneratedRiftLayout } from '../types';

export declare function createWorldProductionMap(world: WorldProfile, space: SpaceProfile,
  seed: number, options: WorldProductionOptions): WorldProductionMap;
export declare function validWorldProductionRecipe(value: unknown): value is WorldProductionRecipe;
export declare function generateRiftLayout(seed: number): GeneratedRiftLayout;
