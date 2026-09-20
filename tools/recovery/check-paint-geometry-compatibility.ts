/** Fixed, real pre-upgrade saves + new geometry departures. Graphics are inert;
 * generation, footprint baking, Host nucleus placement and recovery are real. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type Phaser from 'phaser';
import type { SaveDataV2 } from '../../src/types/game-types';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';
import type { InventoryState } from '../../src/types/inventory-types';
import type { GeneratedRiftLayout } from '../../src/generation/types';
import type { TileMapData } from '../../src/types/map-types';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';
import { selectWorldProductionRecipe, validWorldProductionRecipe } from '../../src/generation/world-study/production-recipe';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { mix32 } from '../../src/generation/seed-fork';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { TileGrid } from '../../src/systems/tile-grid';
import { ContaminationHostSystem, type HostRuntimeState } from '../../src/systems/contamination-host-system';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { createProceduralDeparture, proceduralRiftIdentity, restoreProceduralLayout,
  restoreProceduralWorld, validateProceduralRiftAdmission } = await import('../../src/managers/rift-recovery');

type RecordedState = {
  world: { hosts: HostRuntimeState };
  combat: { externalTargetIds: string[] };
};
type RecordedRun = { checkpoint: RiftCheckpoint<RecordedState>; inventory: InventoryState };
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function graphics(): Phaser.GameObjects.Graphics {
  const chain: unknown = new Proxy({}, { get: () => () => chain });
  return chain as Phaser.GameObjects.Graphics;
}
const scene = { add: { graphics } } as unknown as Phaser.Scene;

/** Follow the production adapter: 32px Host grid and the chosen geometry's
 * visible footprint, then let the real Host owner place colony nuclei. */
function makeHosts(layout: GeneratedRiftLayout, hostTileMap: TileMapData): ContaminationHostSystem {
  const hosts = new ContaminationHostSystem(), grid = new TileGrid(hostTileMap);
  hosts.create(scene, { ...layout, tileMap: hostTileMap }, null, null, () => 1,
    { liveMotion: true, occluders: grid, sightGrid: new TileGrid(layout.tileMap) });
  hosts.setSkipPaint(true);
  const tile = GAME_CONSTANTS.TILE_SIZE;
  let paintIndex = 0;
  for (const form of layout.contaminationDraw.forms) {
    if (form.portfolio !== 'bing') continue;
    const id = `ENM_BING_${String(paintIndex + 1).padStart(2, '0')}`;
    const pin = layout.contaminationPins.paintFloors[paintIndex++]!;
    const seed = mix32(layout.seed, id);
    const baked = bakePaintGenome({ substrate: form.substrate, coverage: form.coverage, seed,
      continuity: form.continuity, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
      fragmentTypeId: layout.fragmentTypeId, veinVariant: resolvePaintVeinVariant(form.substrate, seed),
      geometryVersion: layout.paintGeometryVersion ?? 1 });
    const floors = collectPaintGenomeFloorTiles(baked.field, baked.canvasW, baked.canvasH,
      (pin.floorCol + .5) * tile, (pin.floorRow + .5) * tile, tile)
      .filter(floor => grid.isWalkable(floor.col, floor.row));
    hosts.setStepFloors(id, floors);
  }
  return hosts;
}

function readBrowserRecord(path: string): RecordedRun {
  const storage = JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
  const save = JSON.parse(storage['coh-save-v1']!) as SaveDataV2;
  assert(save.riftCheckpoint, `${path}: fixture is a real active frame`);
  assert(save.riftCheckpoint.identity.generation, `${path}: fixture uses the world-space generator`);
  assert.equal(save.riftCheckpoint.identity.generation.paintGeometryVersion, undefined,
    `${path}: fixture predates geometry versioning`);
  return { checkpoint: save.riftCheckpoint as RiftCheckpoint<RecordedState>, inventory: save.inventory };
}

const oldRecords: RecordedRun[] = [
  readBrowserRecord('docs/qa/artifacts/iteration-28/production-browser/entry.storage.json'),
  readBrowserRecord('docs/qa/artifacts/iteration-28/production-browser/attempt-2/entry.storage.json'),
  // Both world-space records have non-colony paint. This real older-generator
  // frame adds six colonies, including a three-nucleus colony and a Ding first.
  JSON.parse(readFileSync('tools/recovery/fixtures/formal-host-core-order.json', 'utf8')) as RecordedRun,
];
let oldColonies = 0;
for (const record of oldRecords) {
  const before = JSON.stringify(record), checkpoint = record.checkpoint;
  assert(validateProceduralRiftAdmission(checkpoint, record.inventory), 'the original active frame remains admissible');
  const layout = restoreProceduralLayout(json(checkpoint.identity));
  const world = restoreProceduralWorld(checkpoint.identity);
  assert.equal(layout.paintGeometryVersion ?? 1, 1, 'missing recipe version must retain original geometry');
  assert.equal(proceduralRiftIdentity(layout).signature, checkpoint.identity.signature, 'recorded world hash stays unchanged');
  assert.deepEqual(proceduralRiftIdentity(layout).generation, checkpoint.identity.generation,
    'restore must not add a new recipe field to an old identity');
  const hosts = makeHosts(layout, world?.hostTileMap ?? layout.tileMap);
  assert.deepEqual(hosts.getRecoveryTargetIds(), checkpoint.state.combat.externalTargetIds,
    'authored Host/core traversal still matches the saved combat manifest');
  const freshHosts = hosts.exportRuntimeState();
  for (const saved of checkpoint.state.world.hosts.hosts) {
    if (saved.kind !== 'bing') continue;
    const fresh = freshHosts.hosts.find(host => host.id === saved.id)!;
    assert.deepEqual(fresh.state.core, saved.state.core, `${saved.id}: original core position`);
    assert.deepEqual(fresh.state.nuclei, saved.state.nuclei, `${saved.id}: original nucleus seats/count/order`);
    if ((saved.state.nuclei as unknown[]).length > 0) oldColonies++;
  }
  assert(hosts.validateRuntimeState(checkpoint.state.world.hosts), 'real Host owner accepts the recorded runtime');
  hosts.restoreRuntimeState(json(checkpoint.state.world.hosts));
  assert.deepEqual(hosts.exportRuntimeState(), checkpoint.state.world.hosts,
    'timers, active/dead state and nuclei hydrate without mutation or replay');
  hosts.destroy();
  assert.equal(JSON.stringify(record), before, 'restoration and admission are read-only');
  if (checkpoint.identity.generation) {
    const replaced = json(checkpoint.identity);
    replaced.generation = { ...replaced.generation!, paintGeometryVersion: 2 };
    assert.throws(() => restoreProceduralLayout(replaced), 'a v1 world cannot silently switch to v2 under its saved hash');
  }
}
assert(oldColonies >= 6, 'compatibility coverage includes real saved colony nuclei');

for (const seed of [0, 1, 2147483647, 4294967295]) {
  const recipe = selectWorldProductionRecipe(seed);
  assert(validWorldProductionRecipe(recipe));
  assert.equal(recipe.paintGeometryVersion, 2, 'all newly selected recipes freeze the complete geometry contract');
  for (const version of [0, 3, '2', null]) {
    assert(!validWorldProductionRecipe({ ...recipe, paintGeometryVersion: version }), 'unknown geometry contract rejects');
  }
}

const newRecords = [];
for (let index = 0; index < 2; index++) {
  const identity = createProceduralDeparture(), world = restoreProceduralWorld(identity)!;
  assert.equal(identity.generation!.paintGeometryVersion, 2);
  assert.equal(world.layout.paintGeometryVersion, 2);
  const hosts = makeHosts(world.layout, world.hostTileMap);
  newRecords.push({ identity: json(identity), layoutHash: checkpointChecksum(world.layout),
    hostFloorHash: checkpointChecksum(world.hostTileMap), runtime: json(hosts.exportRuntimeState()),
    targetIds: hosts.getRecoveryTargetIds() });
  hosts.destroy();
}
// The second departure evicts the first. Restore from serialized contracts;
// cache residency cannot hide a generation-version mismatch.
for (const saved of newRecords) {
  const world = restoreProceduralWorld(saved.identity)!;
  assert.equal(checkpointChecksum(world.layout), saved.layoutHash, 'new geometry layout survives reconstruction');
  assert.equal(checkpointChecksum(world.hostTileMap), saved.hostFloorHash, 'terrain support remains identical');
  assert.equal(proceduralRiftIdentity(world.layout).signature, saved.identity.signature);
  const hosts = makeHosts(world.layout, world.hostTileMap);
  assert.deepEqual(hosts.getRecoveryTargetIds(), saved.targetIds, 'v2 target order survives reconstruction');
  assert(hosts.validateRuntimeState(saved.runtime));
  hosts.restoreRuntimeState(saved.runtime);
  assert.deepEqual(hosts.exportRuntimeState(), saved.runtime, 'v2 Host runtime survives JSON round trip');
  hosts.destroy();
  const downgraded = json(saved.identity);
  downgraded.generation = { ...downgraded.generation!, paintGeometryVersion: 1 };
  assert.throws(() => restoreProceduralLayout(downgraded), 'v2 worlds cannot downgrade under an unchanged signature');
}
console.log(`PASS paint geometry recovery: two actual world-space saves + ${oldColonies} old colonies retain hashes, nuclei and runtime; v2 recipe/layout/Host JSON restoration; version tampering rejects.`);
