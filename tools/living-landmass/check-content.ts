import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LIVING_LANDMASS_SCENES, LIVING_LANDMASS_SUPPORTS, LIVING_LANDMASS_TENSION,
  LIVING_LANDMASS_PLACEMENTS } from '../../src/generated/living-landmass-data';
import { createLivingLandmassWorld, resolveLivingLandmassOptions } from '../../src/dev/living-landmass/world';
import type { LandmassPoint, SupportSample } from '../../src/worlds/living-landmass/types';
import { bodyDisplacementFraction } from '../../src/systems/ai/physical-grid';
import { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { createStageGameplayWorld } from '../../src/dev/spatial-study/stage-gameplay-fixture';
import { createSuspendedSeaWorld } from '../../src/dev/suspended-sea/world';
import { createStageSightGrid } from '../../src/dev/spatial-study/stage/sight-grid';
import { TileGrid } from '../../src/systems/tile-grid';
import { rollContaminantNodeDrop } from '../../src/systems/contaminant-quality';
import { CONTAMINANT_SOURCE_POOLS } from '../../src/generated/contaminant-sources-data';

let checks = 0;
function check(name: string, run: () => void): void { run(); console.log(`PASS ${name}`); checks++; }
const key = (point: LandmassPoint): string => `${point.x}:${point.y}`;
type World = ReturnType<typeof createLivingLandmassWorld>;
function supported(world: World, point: LandmassPoint): boolean {
  return [-10, 10].every(dx => [-10, 10].every(dy => world.isFloor(point.x + dx, point.y + dy)));
}
function reachable(world: World): Set<string> {
  const queue = [world.layout.spawnPoint], visited = new Set([key(queue[0]!)]);
  for (let at = 0; at < queue.length; at++) {
    const point = queue[at]!;
    for (const [dx, dy] of [[16, 0], [-16, 0], [0, 16], [0, -16]]) {
      const next = { x: point.x + dx!, y: point.y + dy! };
      if (visited.has(key(next)) || !supported(world, next)
        || bodyDisplacementFraction(world.layout.walkableMask, point, 10, 10, dx!, dy!) !== 1) continue;
      visited.add(key(next)); queue.push(next);
    }
  }
  return visited;
}
function route(world: World, points: readonly LandmassPoint[], safe: boolean): number {
  let distance = 0;
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1]!, b = points[index]!;
    assert.equal(bodyDisplacementFraction(world.layout.walkableMask, a, 10, 10, b.x - a.x, b.y - a.y), 1);
    const length = Math.hypot(b.x - a.x, b.y - a.y); distance += length;
    for (let offset = 0; offset <= length; offset += 4) {
      const point = { x: a.x + (b.x - a.x) * offset / length, y: a.y + (b.y - a.y) * offset / length };
      assert(supported(world, point), `unsupported body on route ${key(point)}`);
      if (safe) {
        assert(!world.tension.isInsideDanger(point), `unsafe bypass ${key(point)}`);
        assert.equal(world.groundHeightAt(point.x, point.y), 0, `bypass should remain still ${key(point)}`);
      }
    }
  }
  return distance;
}

check('the generated scene, supports, tension and source deployment equal CSV exactly', () => {
  for (const [table, data] of Object.entries({ scenes: LIVING_LANDMASS_SCENES, supports: LIVING_LANDMASS_SUPPORTS,
    tension: LIVING_LANDMASS_TENSION, placements: LIVING_LANDMASS_PLACEMENTS })) {
    const lines = readFileSync(`data/living-landmass-${table}.csv`, 'utf8').trim().split(/\r?\n/);
    const columns = lines.shift()!.split(',').map(name => name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()));
    assert.equal(lines.length, data.length);
    for (const [index, line] of lines.entries()) {
      const values = line.split(','); assert.equal(values.length, columns.length);
      const actual: Record<string, unknown> = {};
      columns.forEach((name, column) => {
        const expected = Reflect.get(data[index]!, name), raw = values[column]!;
        actual[name] = expected === null ? (assert.equal(raw, ''), null)
          : typeof expected === 'number' ? Number(raw) : typeof expected === 'boolean' ? raw === 'true' : raw;
      });
      assert.deepEqual(actual, data[index]);
    }
  }
});

check('explicit native identity rejects unknown options and leaves the accepted M/sea defaults intact', () => {
  for (const options of [{ scene: 'sea-open-channel' }, { scene: '' }, { loadout: 'quiet' }, { seed: '' }, { seed: 'NaN' }, { seed: '-1' }, { seed: '1.5' }, { seed: '4294967296' }]) {
    assert.throws(() => resolveLivingLandmassOptions(options));
  }
  for (const loadout of ['bare', 'melee', 'light', 'shore']) assert.equal(resolveLivingLandmassOptions({ loadout }).loadout, loadout);
  const world = createLivingLandmassWorld(7);
  assert.equal(world.layout.fragmentTypeId, 'living-landmass');
  assert.equal(world.layout.ruins.fragmentTypeId, 'living-landmass');
  assert.equal('water' in world, false); assert.equal('seaField' in world, false);
  assert.deepEqual(world.metadata, createLivingLandmassWorld(7).metadata);
  assert.notEqual(world.signature(), createLivingLandmassWorld(8).signature());
  assert.equal(new SpatialSliceWorld(7).signature(), 'aa970f9f');
  assert.equal(createStageGameplayWorld(7).signature(), 'cdd27cbd');
  for (const id of ['sea-open-channel', 'sea-folded-ridge'] as const) {
    const sea = createSuspendedSeaWorld(7, id);
    assert.equal(sea.base.layout.fragmentTypeId, 'suspended-sea');
    assert.equal(sea.base.layout.enemySpawns.length, 2); assert.equal(sea.base.reef.height, 0);
  }
});

check('complete bodies can reach all four piles, patrol points, both approaches and the original extraction', () => {
  const world = createLivingLandmassWorld(7), seen = reachable(world), layout = world.layout;
  const points = [layout.spawnPoint, layout.extractionPoint.position,
    ...layout.kindlingNodes.map(node => node.position), ...layout.contaminantNodes.map(node => node.position),
    { x: 880, y: 816 }, { x: 496, y: 816 }, { x: 880, y: 464 }];
  for (const point of points) assert(seen.has(key(point)), `unreachable complete body ${key(point)}`);
  for (const enemy of layout.enemySpawns) for (const point of [enemy.spawn, ...enemy.patrol.waypoints]) {
    assert(seen.has(key({ x: (point.col + .5) * 32, y: (point.row + .5) * 32 })));
  }
  assert.equal(layout.enemySpawns.length, 1); assert.equal(layout.enemySpawns[0]!.type, 'rewriter');
  assert.equal(layout.enemySpawns[0]!.form!.substrate, 'insect_remnant');
  assert.equal(layout.kindlingNodes.length, 2); assert.equal(layout.contaminantNodes.length, 2);
  assert.equal(world.groundHeightAt(880, 816), 0);
  assert.equal(Math.hypot(world.tension.definition.position.x - 880, world.tension.definition.position.y - 816), 28);
});

check('a longer stable bypass and a hazardous shorter crossing share the same unchanging XY topology', () => {
  const world = createLivingLandmassWorld(7), topology = JSON.stringify(world.layout.tileMap);
  const bypass = [{ x: 592, y: 848 }, { x: 400, y: 848 }, { x: 400, y: 432 }, { x: 880, y: 432 }];
  const crossing = [{ x: 592, y: 848 }, { x: 880, y: 848 }, { x: 880, y: 432 }];
  world.prepare(7600);
  const long = route(world, bypass, true), short = route(world, crossing, false);
  assert(long > short + 300); assert(world.tension.isInsideDanger({ x: 880, y: 656 }));
  for (const time of [8000, 9800, 10900, 12000, 18000, 23000]) {
    world.prepare(time); route(world, bypass, true); assert.equal(JSON.stringify(world.layout.tileMap), topology);
  }
  console.log(`MEASURE stable bypass ${long}px; crossing ${short}px; extra ${long - short}px.`);
});

check('support is one continuous prepared triangle field; peak motion, normal, slope and edge remain truthful', () => {
  const world = createLivingLandmassWorld(7), out: SupportSample = { height: 0, normal: { x: 0, y: 1, z: 0 }, supportId: null };
  assert(world.maximumSlope <= .4);
  assert.equal(world.groundHeightAt(880, 656), 0);
  world.prepare(6400); assert(Math.abs(world.groundHeightAt(880, 656) - 16) < 1e-6);
  world.prepare(7600); assert.equal(world.groundHeightAt(880, 656), 32);
  assert.equal(world.groundHeightAt(880, 816), 0);
  const bytes = world.readSupportHeights(), revision = world.supportRevision;
  for (let index = 0; index < 50; index++) {
    const x = 789 + index * 3.17, y = 540 + index * 2.39;
    assert.equal(world.sampleSupport(x, y, out), out);
    assert.equal(out.height, world.groundHeightAt(x, y));
    assert(Math.abs(Math.hypot(out.normal.x, out.normal.y, out.normal.z) - 1) < 1e-6);
    const col = Math.floor(x / 8), row = Math.floor(y / 8), at = row * world.supportColumns + col;
    const u = x / 8 - col, v = y / 8 - row;
    const a = bytes[at]!, b = bytes[at + world.supportColumns]!, c = bytes[at + 1]!, d = bytes[at + world.supportColumns + 1]!;
    const expected = u + v <= 1 ? a + (c - a) * u + (b - a) * v : d + (b - d) * (1 - u) + (c - d) * (1 - v);
    assert.equal(out.height, expected);
  }
  assert.equal(world.supportRevision, revision, 'Reading support must never advance it');
  assert.equal(world.readSupportHeights(), bytes, 'The world reuses its height storage');
  world.prepare(7600); assert.equal(world.supportRevision, revision);
  world.sampleSupport(799.99, 656, out); assert.equal(out.supportId, null);
  assert(out.height > 0, 'A descending rim can query a continuous VOID-side height without creating floor');
  world.sampleSupport(800.01, 656, out); assert.equal(out.supportId, 'borne-fin');
  assert(Math.abs(world.groundHeightAt(799.99, 656) - out.height) < .01);
});

check('the central cavity transmits sight without becoming support and foreign debris keeps its legal source family', () => {
  const world = createLivingLandmassWorld(7), physical = new TileGrid(world.layout.tileMap);
  const sight = createStageSightGrid(world.layout, physical);
  assert.equal(physical.isWalkable(19, 20), false); assert.equal(sight.isOpaque(19, 20), false);
  assert.equal(sight.isOpaque(0, 0), true);
  const allowed = new Set(CONTAMINANT_SOURCE_POOLS['rift-debris'].map(row => row.type));
  assert.equal(world.layout.kindlingNodes[0]!.allowWeapon, false);
  assert.equal(world.layout.kindlingNodes[1]!.allowWeapon, true);
  for (const node of world.layout.contaminantNodes) {
    assert.equal(node.lootPoolId, 'rift-debris');
    for (let seed = 0; seed < 512; seed++) {
      assert(allowed.has(rollContaminantNodeDrop(seed, node.id, node.tier!, node.lootPoolId).type as never));
    }
  }
});

console.log(`${checks} living-landmass content checks passed. Visual readability and real play still require the complete local presentation.`);
