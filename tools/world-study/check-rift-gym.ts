/** DEV catalogue, exact production generation, and worker transport contracts. */
import assert from 'node:assert/strict';
import { WORLD_PRODUCTION_POOL } from '../../src/generated/rift-world-pool-data';
import { WORLD_CONDITION_PROGRAMS } from '../../src/generated/rift-world-conditions-data';
import { worldProfileById } from '../../src/generation/world-study/profiles';
import { SPACE_PROFILES } from '../../src/generation/world-study/space-profile';
import { createWorldProductionMap } from '../../src/generation/world-study/production-map';
import { compileWorldConditions, worldCapabilities, worldConditionCompatibility } from '../../src/generation/world-study/world-conditions';
import { renderWorldSurface } from '../../src/generation/world-study/surface';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { RIFT_GYM_COMBINATIONS, readRiftGymSelection, riftGymCombination, riftGymQuery,
  createRiftGymMap, hydrateRiftGymMap, serializeRiftGymMap } from '../../src/dev/rift-gym-model';
import type { RiftGymWorkerResult } from '../../src/dev/rift-gym-worker';

const expected = new Set<string>();
for (const row of WORLD_PRODUCTION_POOL) {
  if (!row.enabled) continue;
  const profile = worldProfileById(row.profileId);
  const space = SPACE_PROFILES.find(value => value.id === row.spaceId)!;
  const capabilities = worldCapabilities(profile, space);
  for (const program of WORLD_CONDITION_PROGRAMS) if (program.enabled
    && worldConditionCompatibility(program, capabilities).compatible)
    expected.add(`${profile.id}:${space.id}:${program.id}`);
}
assert.deepEqual(new Set(RIFT_GYM_COMBINATIONS.map(row => row.key)), expected);
assert.equal(RIFT_GYM_COMBINATIONS.length, expected.size, 'Every enabled compatible combination appears exactly once');
assert.equal(readRiftGymSelection(new URLSearchParams()).seed, 20261002);

for (const row of RIFT_GYM_COMBINATIONS) {
  for (const seed of [0, 20261002, 0xffffffff]) {
    const selection = { world: row.world, space: row.space, program: row.program, seed };
    assert.equal(riftGymCombination(selection), row);
    assert.deepEqual(readRiftGymSelection(new URLSearchParams(riftGymQuery(selection))), selection);
  }
  for (const key of ['world', 'space', 'program'] as const)
    assert.equal(readRiftGymSelection(new URLSearchParams({ [key]: row[key] }))[key], row[key]);
}
for (const query of ['world=missing', 'space=missing', 'program=missing', 'world=', 'space=', 'program=',
  'seed=', 'seed=-1', 'seed=0.5', 'seed=NaN', 'seed=Infinity', 'seed=4294967296',
  'seed=1e3', 'seed=0xFF', 'seed=+1', 'seed=%201', 'seed=1&seed=1',
  'world=ash-strata&world=ash-strata']) {
  assert.throws(() => readRiftGymSelection(new URLSearchParams(query)), query);
}
const defaultSelection = readRiftGymSelection(new URLSearchParams());
for (const seed of [-1, .5, NaN, Infinity, 0x100000000]) {
  assert.throws(() => createRiftGymMap({ ...defaultSelection, seed }));
  assert.throws(() => riftGymQuery({ ...defaultSelection, seed }));
}
assert.throws(() => createRiftGymMap({ ...defaultSelection, program: 'missing' }));

const records = [];
const enabledPrograms = WORLD_CONDITION_PROGRAMS.filter(program => program.enabled);
for (const [index, program] of enabledPrograms.entries()) {
  const candidates = RIFT_GYM_COMBINATIONS.filter(row => row.program === program.id);
  // Different worlds/spaces and both uint32 endpoints, without rerunning the full qualification library.
  const row = candidates[Math.min(index * 3, candidates.length - 1)]!;
  const seed = [0, 20261002, 0xffffffff][index % 3]!;
  const selection = { world: row.world, space: row.space, program: row.program, seed };
  const map = createRiftGymMap(selection);
  assert.equal(map.metadata.world, row.world);
  assert.equal(map.metadata.space, row.space);
  assert.equal(map.metadata.requestedSeed, seed);
  assert.equal(map.metadata.conditions!.programId, program.id);
  assert.equal(map.metadata.conditions!.seed, seed);
  assert(map.metadata.semantic);
  assert.equal(map.layout.tileMap.tileSize, 8);
  assert.equal(map.hostTileMap.tileSize, 32);
  assert.equal(map.layout.kindlingNodes.length, 8);
  assert.equal(map.layout.contaminantNodes.length, 3);
  assert(map.layout.enemySpawns.length >= 3);
  assert.equal(map.sample.scenery!.length, 3);

  const profile = worldProfileById(row.world);
  const space = SPACE_PROFILES.find(value => value.id === row.space)!;
  const conditions = compileWorldConditions(seed, profile, space, { programId: program.id });
  const production = createWorldProductionMap(profile, space, seed, {
    contentFragmentTypeId: row.contentFragmentTypeId, paintGeometryVersion: 2,
    generationVersion: 2, conditions, fallbackSeeds: conditions.fallbackSeeds,
  });
  assert.deepEqual(serializeRiftGymMap(map), serializeRiftGymMap(production),
    'Gym content and deterministic replay must exactly equal the selected production pipeline');

  const wire = structuredClone(serializeRiftGymMap(map));
  assert(!('walkableMask' in wire.layout), 'Do not transfer runtime class instances');
  const hydrated = hydrateRiftGymMap(wire);
  const grid = new TileGrid(map.layout.tileMap);
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++)
    assert.equal(hydrated.layout.walkableMask.isWalkable(x, y), map.layout.walkableMask.isWalkable(x, y));
  assert(!hydrated.layout.walkableMask.isWalkable(-1, 0));
  assert(!hydrated.layout.walkableMask.isWalkable(grid.cols, grid.rows));
  for (const point of [map.layout.spawnPoint, map.layout.extractionPoint.position,
    ...map.layout.kindlingNodes.map(node => node.position), ...map.layout.contaminantNodes.map(node => node.position)])
    assert(bodyHasSupport(grid, point, 10, 10));
  assert.deepEqual(serializeRiftGymMap(hydrated), serializeRiftGymMap(map));

  if (index === 0) {
    const pixels = renderWorldSurface(map.sample);
    const sourceLength = pixels.rgba.length;
    const message: RiftGymWorkerResult = { id: 7, selection, map: serializeRiftGymMap(map), pixels };
    const received = structuredClone(message, { transfer: [pixels.rgba.buffer] });
    assert.equal(pixels.rgba.byteLength, 0, 'Pixels transfer ownership rather than duplicate the full bake');
    assert(!('error' in received));
    assert.equal(received.pixels.rgba.length, sourceLength);
    assert.equal(sourceLength, received.pixels.width * received.pixels.height * 4);
    assert.equal(hydrateRiftGymMap(received.map).metadata.signature, map.metadata.signature);
    assert.deepEqual(received.selection, selection);
  }
  records.push({ ...selection, effectiveSeed: map.metadata.effectiveSeed,
    signature: map.metadata.signature, fallbackUsed: map.metadata.fallbackUsed });
}
console.log(JSON.stringify({ passed: true, combinations: expected.size,
  checks: ['CSV coverage', 'query validation and roundtrip', 'production equivalence',
    'complete deployment', 'fine support and Host grids', 'structured-clone hydration', 'pixel transfer'], records }, null, 2));
