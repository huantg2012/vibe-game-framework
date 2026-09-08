import type { AnimatedModel } from './model-visual';
import { bakeHumanModel, HUMAN_WALK_CYCLE_MS } from './human-model';
import { bakeInsectModel } from './insect-model';
import { bakeBeastModel, BEAST_WALK_CYCLE_MS } from './beast-model';
import { bakeWormModel, WORM_WALK_CYCLE_MS } from './worm-model';
import { bakeRemnantModel, REMNANT_WALK_CYCLE_MS } from './remnant-model';
import { bakeGrowthModel, GROWTH_WALK_CYCLE_MS } from './growth-model';

/** Art registration and gait distances, shared by production and preview bakers. */
const models: Readonly<Record<string, AnimatedModel>> = {
  human_remnant: { id: 'human17', walkCycleMs: HUMAN_WALK_CYCLE_MS, stridePixels: 28, bake: bakeHumanModel },
  insect_remnant: { id: 'insect16', walkCycleMs: 720, stridePixels: 22, bake: bakeInsectModel },
  mammal_remnant: { id: 'beast18', walkCycleMs: BEAST_WALK_CYCLE_MS, stridePixels: 32, bake: bakeBeastModel },
  worm_remnant: { id: 'worm18', walkCycleMs: WORM_WALK_CYCLE_MS, stridePixels: 18, bake: bakeWormModel },
  organic_remnant: { id: 'remnant18', walkCycleMs: REMNANT_WALK_CYCLE_MS, stridePixels: 20, bake: bakeRemnantModel },
  stalk_clump: { id: 'growth18', walkCycleMs: GROWTH_WALK_CYCLE_MS, stridePixels: 16, bake: bakeGrowthModel },
};
export function productionModelFor(substrate: string): AnimatedModel | undefined { return models[substrate]; }
