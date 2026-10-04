/** Actual generation, transfer and cold recovery; no art approval is inferred. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { selectR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { executeRiftGeneration } from '../../src/generation/rift-generation-execute';
import { hydrateRiftGeneration } from '../../src/generation/rift-generation-protocol';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { checkpointChecksum, validRiftDeparture } from '../../src/types/rift-checkpoint';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import { POLLUTION_GRADES } from '../../src/generation/world-study/pollution-grade';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { R100_EXPEDITION_GRADES } from '../../src/generated/rift-expedition-grade-data';
import { legacyGenerationGold } from '../recovery/legacy-generation-gold';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const recovery = await import('../../src/managers/rift-recovery');
const families = new Set<string>(), records: { identity: RiftCheckpoint['identity']; geometry: string; host: string }[] = [];
const runs: unknown[] = [];
for (let seed = 0; seed < 30; seed++) for (const grade of POLLUTION_GRADES) {
  const recipe = selectR100ProductionRecipe(seed, grade), before = JSON.stringify(recipe), started = performance.now();
  assert(validR100ProductionRecipe(recipe));
  const world = createR100ProductionMap(recipe), layout = world.layout, grid = new TileGrid(layout.tileMap);
  const budget = R100_EXPEDITION_GRADES.find(row => row.grade_id === grade)!;
  families.add(recipe.nativeDefinition.family);
  assert.equal(layout.enemySpawns.length, budget.enemy_count);
  assert.equal(layout.enemySpawns.filter(enemy => enemy.type === 'rewriter').length, 1);
  assert.equal(layout.kindlingNodes.length, grade === 'low' ? 4 : grade === 'medium' ? 5 : 6);
  assert.equal(layout.kindlingNodes.reduce((sum, node) => sum + node.value!, 0), grade === 'low' ? 9 : grade === 'medium' ? 13 : 17);
  assert.equal(layout.contaminantNodes.length, grade === 'low' ? 2 : grade === 'medium' ? 3 : 4);
  assert.equal(layout.contaminationPins.corridorAabbs.length, recipe.gradeDefinition.volumeCount);
  assert.equal(layout.contaminationPins.paintFloors.length, recipe.gradeDefinition.paintCount);
  assert.equal(grid.tileSize, 8); assert.equal(world.hostTileMap.tileSize, 32);
  for (const point of [layout.spawnPoint, layout.extractionPoint.position, ...layout.kindlingNodes.map(node => node.position), ...layout.contaminantNodes.map(node => node.position)])
    assert(bodyHasSupport(grid, point, 10, 10));
  for (const enemy of layout.enemySpawns) for (let index = 1; index < enemy.patrol.waypoints.length; index++) {
    const a = enemy.patrol.waypoints[index - 1]!, b = enemy.patrol.waypoints[index]!;
    const from = { x: (a.col + .5) * 8, y: (a.row + .5) * 8 }, dx = (b.col - a.col) * 8, dy = (b.row - a.row) * 8;
    assert.equal(bodyDisplacementFraction(grid, from, 10, 10, dx, dy), 1, 'compressed patrol segments preserve full body support');
  }
  assert.equal(JSON.stringify(recipe), before, 'generation may not mutate the frozen contract');
  const identity = generatedRiftIdentity(layout, recipe, world);
  if (seed < 3 || seed === 28) {
    const wire = executeRiftGeneration({ kind: 'departure', generation: recipe });
    const hydrated = hydrateRiftGeneration(structuredClone(wire));
    assert.equal(generatedRiftIdentity(hydrated.layout, recipe, hydrated.world).signature, identity.signature);
    const native = hydrateR100MasterWorld(hydrated.world!.native!, hydrated.layout);
    assert.equal(native.matterAt(-1, 0), false);
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
      const x = (col + .5) * 8, y = (row + .5) * 8;
      assert.equal(native.sight.isOpaque(col, row), !native.matterAt(x, y));
      assert.equal(native.combat.isOpaque(col, row), grid.isOpaque(col, row));
    }
    records.push({ identity: structuredClone(identity), geometry: checkpointChecksum(layout.tileMap), host: checkpointChecksum(world.hostTileMap) });
  }
  runs.push({ seed, grade, world: recipe.package.id, effectiveSeed: layout.seed, attempts: world.metadata.attempt + 1, generationMs: performance.now() - started });
}
assert.equal(families.size, new Set(R100_NATIVE_WORLDS.filter(world => world.enabled).map(world => world.definitions[0]!.family)).size);
for (const saved of records) {
  const world = recovery.restoreProceduralWorld(JSON.parse(JSON.stringify(saved.identity)))!;
  assert.equal(checkpointChecksum(world.layout.tileMap), saved.geometry);
  assert.equal(checkpointChecksum(world.hostTileMap), saved.host);
  assert.equal(recovery.proceduralRiftIdentity(world.layout).signature, saved.identity.signature);
}
for (const grade of POLLUTION_GRADES) {
  const departure = recovery.createProceduralDeparture(grade);
  assert.equal(departure.generation!.version, 3);
  assert(departure.generation?.version === 3 && departure.generation.gradeDefinition.id === grade);
  assert(validRiftDeparture({ version: 1, runId: 'v3-test', identity: departure, conditions: { cycle: 1,
    modifiers: { chaosRateModifier: 1, kindlingValueModifier: 1, startingChaos: 0 } } }));
}
const original = records[0]!.identity;
for (const mutate of [
  (value: any) => { value.generation.gradeDefinition.id = 'severe'; },
  (value: any) => { value.generation.package.dependencyHash = 'missing'; },
  (value: any) => { value.generation.nativeDefinition.instances[0].height += 1; },
  (value: any) => { value.generation.contentDefinition.kindling_deep_value += 1; },
]) {
  const bad = structuredClone(original); mutate(bad);
  assert(!validR100ProductionRecipe(bad.generation));
  assert.throws(() => recovery.restoreProceduralWorld(bad));
}
const old = JSON.parse(readFileSync('tools/recovery/fixtures/legacy-generation-gold.json', 'utf8'));
for (const record of old.records) {
  const { id: _id, identity, ...expected } = record;
  const world = recovery.restoreProceduralWorld(identity), layout = recovery.restoreProceduralLayout(identity);
  assert.deepEqual(legacyGenerationGold(layout, world), expected);
}
const report = { scope: '90 v3 seed/grade admissions; 12 cloned/cold identities; old immutable gold; not visual/play balance approval', status: 'pass', runs };
const reportAt = process.argv.indexOf('--report');
if (reportAt >= 0) writeFileSync(process.argv[reportAt + 1]!, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS R100 production: 90 seed/grade admissions, ${records.length} transfers/cold restorations, 3 explicit grade departures, 4 corrupt contracts, ${old.records.length} exact legacy worlds.`);
