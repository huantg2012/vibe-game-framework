import { validR100ProductionRecipe } from './world-study/r100-package';
import { createR100ProductionMap } from './world-study/r100-production-map';
/** Pure worker executor: frozen algorithms only, no Phaser/session/localStorage imports. */
import { restoreLegacyProceduralLayout, restoreLegacyProductionWorld, validLegacyWorldRecipe } from './legacy-rift-generation';
import { assertMatchingRiftIdentity, generatedRiftIdentity } from './rift-generation-identity';
import { serializeRiftGeneration, type RiftGenerationInput, type RiftGenerationWire } from './rift-generation-protocol';

export function executeRiftGeneration(input: RiftGenerationInput): RiftGenerationWire {
  const started = performance.now();
  if (input.kind !== 'departure' && input.kind !== 'recovery') throw new Error('Unknown generation operation');
  const generation = input.kind === 'departure' ? input.generation : input.identity.generation;
  if (input.kind === 'recovery' && (input.identity.worldId !== 'procedural-rift'
    || input.identity.layoutId !== 'procedural-rift' || !Number.isSafeInteger(input.identity.seed)
    || input.identity.seed < 0 || input.identity.seed > 0xffffffff)) throw new Error('Unsupported procedural world');
  if ((input.kind === 'departure' || generation !== undefined) && !(validLegacyWorldRecipe(generation) || validR100ProductionRecipe(generation)))
    throw new Error('Invalid historical world recipe');
  const world = generation ? generation.version === 3 ? createR100ProductionMap(generation) : restoreLegacyProductionWorld(generation) : null;
  const layout = world?.layout ?? restoreLegacyProceduralLayout(input.kind === 'recovery' ? input.identity.seed : -1);
  const identity = generatedRiftIdentity(layout, generation, world);
  if (input.kind === 'recovery') assertMatchingRiftIdentity(identity, input.identity);
  return serializeRiftGeneration(layout, world, identity, performance.now() - started);
}
