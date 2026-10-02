/** One-time fixed-revision gold capture; refuses to overwrite previous evidence. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { selectWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';
import { generateRiftLayout } from '../../src/generation/rift-layout';
import { checkpointChecksum, type RiftCheckpoint } from '../../src/types/rift-checkpoint';
import { legacyGenerationGold } from './legacy-generation-gold';

const revision = 'ac9ddd7fab04202d629a97293ffeeb19f71acaec';
const path = 'tools/recovery/fixtures/legacy-generation-gold.json';
assert(!existsSync(path), 'gold fixtures are never overwritten');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), revision);
const manifest = JSON.parse(readFileSync('src/generation/legacy-rift-v2/manifest.json', 'utf8')) as { dependencies: { path: string }[] };
assert.equal(execFileSync('git', ['diff', revision, '--', ...manifest.dependencies.map(file => file.path)], { encoding: 'utf8' }), '',
  'capture must use the unmodified production implementation');
const records = [];
for (const seed of [0, 5, 70421]) {
  const generation = selectWorldProductionRecipe(seed);
  assert.equal(generation.version, 2);
  if (generation.version !== 2) throw Error('Expected v2 production baseline');
  const world = createWorldProductionMap(generation.profile, generation.space, seed, {
    contentFragmentTypeId: generation.contentFragmentTypeId, paintGeometryVersion: 2,
    generationVersion: 2, conditions: generation.conditions, fallbackSeeds: generation.conditions.fallbackSeeds,
  });
  const layout = world.layout;
  const base = checkpointChecksum({ tileMap: layout.tileMap, spawns: layout.enemySpawns,
    pins: layout.contaminationPins, draw: layout.contaminationDraw, spawn: layout.spawnPoint,
    exit: layout.extractionPoint, fuel: layout.kindlingNodes, items: layout.contaminantNodes });
  const signature = checkpointChecksum({ layout: base, generation, hostTileMap: world.hostTileMap,
    landmarks: layout.landmarks, contaminationAge: layout.contaminationAge, ruinSeverity: layout.ruinSeverity });
  const identity: RiftCheckpoint['identity'] = { worldId: 'procedural-rift', layoutId: 'procedural-rift',
    seed: layout.seed, recipeId: layout.recipeId, signature, generation };
  records.push({ id: `v2-${seed}`, identity, ...legacyGenerationGold(layout, world) });
}
for (const seed of [432889249, 17]) {
  const layout = generateRiftLayout(seed);
  const signature = checkpointChecksum({ tileMap: layout.tileMap, spawns: layout.enemySpawns,
    pins: layout.contaminationPins, draw: layout.contaminationDraw, spawn: layout.spawnPoint,
    exit: layout.extractionPoint, fuel: layout.kindlingNodes, items: layout.contaminantNodes });
  const identity: RiftCheckpoint['identity'] = { worldId: 'procedural-rift', layoutId: 'procedural-rift',
    seed: layout.seed, recipeId: layout.recipeId, signature };
  records.push({ id: `unversioned-${seed}`, identity, ...legacyGenerationGold(layout, null) });
}
writeFileSync(path, `${JSON.stringify({ sourceRevision: revision,
  note: 'Captured once from unmodified pre-R100 production code. Generation-only evidence, not a saved runtime frame.', records }, null, 2)}\n`);
console.log(`Captured ${records.length} pre-R100 generation gold records`);
