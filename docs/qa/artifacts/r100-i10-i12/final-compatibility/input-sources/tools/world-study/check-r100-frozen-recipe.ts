/** Saved v3 data stays authoritative when unrelated catalog content is added or
 * current authoring rows change. This mutates only this test process's imports. */
import assert from 'node:assert/strict';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { R100_EXPEDITION_GRADES } from '../../src/generated/rift-expedition-grade-data';
import { POLLUTION_GRADE_DEFINITIONS } from '../../src/generated/rift-pollution-grade-data';
import { R100_MATERIAL_DEPENDENCIES } from '../../src/generated/r100-package-manifest';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';

const world = R100_NATIVE_WORLDS[0]!;
const frozen = (['low', 'medium', 'severe'] as const).map(grade => {
  const recipe = createR100ProductionRecipe(world.id, 20261003, grade), value = createR100ProductionMap(recipe);
  return { recipe, identity: generatedRiftIdentity(value.layout, recipe, value), checksum: checkpointChecksum(value.native) };
});
const catalog = R100_NATIVE_WORLDS as unknown as any[];
const contents = R100_EXPEDITION_GRADES as unknown as Record<string, any>[];
const grades = POLLUTION_GRADE_DEFINITIONS as unknown as Record<string, any>[];
const materials = R100_MATERIAL_DEPENDENCIES as Record<string, unknown>;
const previous = structuredClone({ world, contents, grades });
try {
  catalog.push({ ...structuredClone(world), id: 'future-unrelated-world', enabled: true });
  for (const definition of (world as any).definitions) definition.instances[0].height += 13;
  (world as any).profile.label = 'future edited label';
  for (const row of contents) { row.enemy_count += 1; row.kindling_deep_value += 7; }
  for (const row of grades) { row.chaosStartRate += .2; row.chaosEndRate += .4; row.paintCount += 1; }
  materials['future-material'] = { definition: 'a'.repeat(64), surface: 'b'.repeat(64), solid: 'c'.repeat(64) };
  for (const saved of frozen) {
    assert(validR100ProductionRecipe(saved.recipe), 'new catalog rows cannot invalidate an existing frozen package');
    const value = createR100ProductionMap(structuredClone(saved.recipe));
    assert.deepEqual(generatedRiftIdentity(value.layout, saved.recipe, value), saved.identity);
    assert.equal(checkpointChecksum(value.native), saved.checksum, 'geometry, material fields, Host and content use saved data');
  }
} finally {
  catalog.pop(); Object.assign(world, previous.world);
  contents.splice(0, contents.length, ...previous.contents); grades.splice(0, grades.length, ...previous.grades);
  delete materials['future-material'];
}
console.log('PASS 3 frozen v3 grades retain identical complete native payloads after authoring/catalog/material additions');
