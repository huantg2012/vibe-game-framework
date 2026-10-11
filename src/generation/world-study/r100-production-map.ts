import { createR100ProductionMap as createRevision6Map } from '../legacy-r100-v6/executor-recovery.js';
import { createR100ProductionMap as createRevision7Map } from '../legacy-r100-v7/executor-recovery.js';
import { createR100ProductionMap as createRevision5Map } from '../legacy-r100-v5/executor-recovery.js';
import { createR100ProductionMap as createRevision4Map } from '../legacy-r100-v4/executor.js';
import { createR100ProductionMap as createRevision3Map } from '../legacy-r100-v3/executor.js';
import { mix32 } from '@/generation/seed-fork';
/** V3 generation. A failed seed fails that exact frozen trip; it never changes grade. */
import { checkpointChecksum } from '@/types/rift-checkpoint';
import { createR100SpatialWorld } from './r100-spatial-world';
import { deployR100Expedition } from './r100-expedition';
import { createR100ProductionMap as createFrozenR100ProductionMap } from '../legacy-r100-v2/executor.js';
import { serializeR100MasterWorld } from './r100-native-data';
import { validR100ProductionRecipe } from './r100-package';
import type { WorldProductionRecipeV3 } from './production-recipe';
import type { WorldProductionMap } from './production-map';

export function createR100ProductionMap(recipe: WorldProductionRecipeV3): WorldProductionMap {
  if (recipe.package?.algorithmRevision === 1 || recipe.package?.algorithmRevision === 2) return createFrozenR100ProductionMap(recipe);
  if (recipe.package?.algorithmRevision === 3) return createRevision3Map(recipe);
  if (recipe.package?.algorithmRevision === 4) return createRevision4Map(recipe);
  if (recipe.package?.algorithmRevision === 5) return createRevision5Map(recipe);
  if (recipe.package?.algorithmRevision === 6) return createRevision6Map(recipe);
  if (recipe.package?.algorithmRevision === 7) return createRevision7Map(recipe);
  if (!validR100ProductionRecipe(recipe)) throw new Error('Invalid or unavailable native world package');
  const rejected: { seed: number; reason: string }[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
  const seed = attempt === 0 ? recipe.requestedSeed : mix32(recipe.requestedSeed, `r100-native-v3-attempt-${attempt}`);
  try {
  const master = createR100SpatialWorld(recipe.nativeDefinition, recipe.spatialPolicy!, seed,
    { grade: recipe.gradeDefinition, profile: recipe.profile });
  const deployed = deployR100Expedition(master, recipe.contentDefinition), layout = deployed.layout;
  const native = serializeR100MasterWorld({ ...master, algorithmRevision: 8, appearance: recipe.appearance, layout, diagnostics: { ...master.diagnostics,
    qualification: 'v3-production-candidate', expedition: deployed.diagnostics } }, recipe.gradeDefinition, recipe.package.dependencyHash);
  return { sample: master.sample, layout, hostTileMap: master.hostTileMap, native,
    metadata: { world: recipe.package.id, space: recipe.nativeDefinition.id, contentFragmentTypeId: recipe.contentFragmentTypeId,
      requestedSeed: recipe.requestedSeed, effectiveSeed: layout.seed, attempt, rejected,
      signature: checkpointChecksum({ recipe, geometry: master.diagnostics.geometryFingerprint, content: deployed.diagnostics }),
      bodySize: 20, supportTileSize: 8, hostTileSize: 32,
      reachableBodySeats: Number(deployed.diagnostics.reachableBodySeats), extractionRoutePx: Number(deployed.diagnostics.extractionRoutePx) } };
  } catch (error) { rejected.push({ seed, reason: error instanceof Error ? error.message : String(error) }); }
  }
  throw new Error(`Native v3 world could not admit its complete ${recipe.nativeDefinition.grade} contents after 8 attempts: ${rejected.map(item => item.reason).join('; ')}`);
}
