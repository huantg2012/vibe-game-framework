/** Typed boundary only. Original r1/r2 algorithms and data are sealed in executor.js. */
import type { WorldProductionRecipeV3 } from '../world-study/production-recipe';
import type { WorldProductionMap } from '../world-study/production-map';
export declare function createR100ProductionMap(recipe: WorldProductionRecipeV3): WorldProductionMap;
export declare function validR100ProductionRecipe(value: unknown): value is WorldProductionRecipeV3;
