import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { findR100PatrolWindows } from '../../src/generation/world-study/r100-patrol-windows';

const gold = JSON.parse(readFileSync('tools/recovery/fixtures/r100-revision1-gold.json', 'utf8'));
for (const { identity, nodeSignature } of gold.records) {
  assert.equal(identity.generation.package.algorithmRevision, 1);
  assert(validR100ProductionRecipe(identity.generation));
  const world = createR100ProductionMap(identity.generation);
  const { catalogVersion: _catalog, combatRulesVersion: _combat, lootAlgorithmVersion: _loot, ...generationIdentity } = identity;
  assert.deepEqual(generatedRiftIdentity(world.layout, identity.generation, world), { ...generationIdentity, signature: nodeSignature }, 'revision-1 stays identical to the previously frozen Node executor; original Chrome signatures are tested in Chromium');
}
for (const [worldId, seed] of [['ash-strata', 20261004], ['ash-strata', 20261005], ['crystal-fibre', 20261005]] as const) {
  const recipe = createR100ProductionRecipe(worldId, seed, 'severe');
  assert.equal(recipe.package.algorithmRevision, 5);
  const world = createR100ProductionMap(recipe), layout = world.layout;
  assert(layout.enemySpawns.every(enemy => enemy.patrol.mode === 'pingpong' && enemy.patrol.waypoints.length > 1));
  const native = hydrateR100MasterWorld(world.native!, layout), nodes = [...layout.kindlingNodes, ...layout.contaminantNodes].filter(node => node.tier !== 'safe');
  const windows = findR100PatrolWindows(native, layout.enemySpawns, nodes);
  assert.equal(windows.length, nodes.length);
  assert(windows.every(window => window.durationMs >= 2400));
  const staticRoster = layout.enemySpawns.map(enemy => ({ ...enemy, patrol: { ...enemy.patrol, mode: 'static' as const } }));
  assert.deepEqual(findR100PatrolWindows(native, staticRoster, nodes), [], 'the original permanent guard cannot be admitted');
}
console.log(`PASS ${gold.records.length} real old-v3 exact identities, 3 reported severe cases with dry 2.4s patrol windows, static regression rejection.`);
