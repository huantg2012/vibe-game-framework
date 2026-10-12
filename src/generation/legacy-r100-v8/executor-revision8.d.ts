/** Typed boundary; revision 8 generation, data and surface bake are immutable. */
import type { WorldProductionRecipeV3 } from '../world-study/production-recipe';
import type { WorldProductionMap } from '../world-study/production-map';
import type { MasterWorld } from '../world-study/r100-master-world';
import type { PollutionGrade } from '../world-study/pollution-grade';
import type { PaintedMaterial } from '../../systems/r100-world/painted-material';
import type { MasterSurfaceBake } from '../../systems/r100-world/surface-bake';
export declare function createR100ProductionMap(recipe: WorldProductionRecipeV3): WorldProductionMap;
export declare function createR100ProductionRecipe(worldId: string, seed: number, grade: PollutionGrade): WorldProductionRecipeV3;
export declare function validR100ProductionRecipe(value: unknown): value is WorldProductionRecipeV3;
export declare function bakeMasterWorldSurface(world: MasterWorld, painting?: PaintedMaterial): MasterSurfaceBake;
