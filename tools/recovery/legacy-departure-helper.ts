/** Historical v2 compatibility fixture, explicitly separate from current departures. */
import { selectWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';
import { restoreLegacyProductionWorld } from '../../src/generation/legacy-rift-generation';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';
export function createLegacyV2Departure(): RiftCheckpoint['identity'] {
  const seeds = new Uint32Array(1); crypto.getRandomValues(seeds);
  const generation = selectWorldProductionRecipe(seeds[0]!);
  const world = restoreLegacyProductionWorld(generation);
  return { ...generatedRiftIdentity(world.layout, generation, world), catalogVersion: 'contaminant-v1',
    lootAlgorithmVersion: 1, combatRulesVersion: 2 };
}
