import { mix32 } from '@/generation/seed-fork';
/** V3 generation. A failed seed fails that exact frozen trip; it never changes grade. */
import { checkpointChecksum } from '@/types/rift-checkpoint';
import { createMasterWorld } from './r100-master-world';
import { deployR100Expedition } from './r100-expedition';
import { deployR100ExpeditionV1 } from './r100-expedition-v1';
import { serializeR100MasterWorld } from './r100-native-data';
import { validR100ProductionRecipe } from './r100-package';
import type { WorldProductionRecipeV3 } from './production-recipe';
import type { WorldProductionMap } from './production-map';

export function createR100ProductionMap(recipe: WorldProductionRecipeV3): WorldProductionMap {
  if (!validR100ProductionRecipe(recipe)) throw new Error('Invalid or unavailable native world package');
  const rejected: { seed: number; reason: string }[] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
  const seed = attempt === 0 ? recipe.requestedSeed : mix32(recipe.requestedSeed, `r100-native-v3-attempt-${attempt}`);
  try {
  const master = createMasterWorld(recipe.nativeDefinition, seed,
    { grade: recipe.gradeDefinition, profile: recipe.profile });
  const deployed = (recipe.package.algorithmRevision === 1 ? deployR100ExpeditionV1 : deployR100Expedition)(master, recipe.contentDefinition), layout = deployed.layout;
  const native = serializeR100MasterWorld({ ...master, layout, diagnostics: { ...master.diagnostics,
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
