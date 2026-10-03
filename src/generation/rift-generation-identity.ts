/** Shared by the frozen worker and synchronous recovery. No scene or storage owners. */
import type { GeneratedRiftLayout } from './types';
import type { WorldProductionMap } from './world-study/production-map';
import type { WorldProductionRecipe } from './world-study/production-recipe';
import { checkpointChecksum, type RiftCheckpoint } from '@/types/rift-checkpoint';

export function generatedRiftIdentity(layout: GeneratedRiftLayout, generation?: WorldProductionRecipe,
  world?: WorldProductionMap | null): RiftCheckpoint['identity'] {
  let signature = checkpointChecksum({ tileMap: layout.tileMap, spawns: layout.enemySpawns,
    pins: layout.contaminationPins, draw: layout.contaminationDraw, spawn: layout.spawnPoint,
    exit: layout.extractionPoint, fuel: layout.kindlingNodes, items: layout.contaminantNodes });
  if (generation) {
    if (!world || world.layout !== layout) throw new Error('World and layout identity differ');
    signature = checkpointChecksum({ layout: signature, generation, hostTileMap: world.hostTileMap,
      ...(generation.version === 2 ? { landmarks: layout.landmarks,
        contaminationAge: layout.contaminationAge, ruinSeverity: layout.ruinSeverity } : {}) });
  }
  return { worldId: 'procedural-rift', layoutId: 'procedural-rift', seed: layout.seed,
    recipeId: layout.recipeId, signature, ...(generation ? { generation } : {}) };
}

export function assertMatchingRiftIdentity(actual: RiftCheckpoint['identity'], expected: RiftCheckpoint['identity']): void {
  if (actual.signature !== expected.signature || actual.worldId !== expected.worldId || actual.layoutId !== expected.layoutId
    || (expected.generation && (actual.seed !== expected.seed || actual.recipeId !== expected.recipeId
      || JSON.stringify(actual.generation) !== JSON.stringify(expected.generation))))
    throw new Error('Saved world does not match the current generation contract');
}
