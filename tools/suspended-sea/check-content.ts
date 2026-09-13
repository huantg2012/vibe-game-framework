import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUSPENDED_SEA_SCENES, SUSPENDED_SEA_GROUND, SUSPENDED_SEA_OPENINGS,
  SUSPENDED_SEA_WATER, SUSPENDED_SEA_PLACEMENTS } from '../../src/generated/suspended-sea-data';
import { CONTAMINANT_SOURCE_POOLS } from '../../src/generated/contaminant-sources-data';
import { CONTAMINANT_LOOT_PROFILES } from '../../src/generated/contaminant-economy-data';
import { BUILD_LAB_LOADOUTS } from '../../src/generated/build-lab-data';
import { createSuspendedSeaWorld, resolveSuspendedSeaOptions, type SuspendedSeaWorld } from '../../src/dev/suspended-sea/world';
import { SpatialSliceWorld, pointInPolygon } from '../../src/dev/spatial-study/slice-world';
import { createStageGameplayWorld } from '../../src/dev/spatial-study/stage-gameplay-fixture';
import { bodyDisplacementFraction } from '../../src/systems/ai/physical-grid';
import { rollContaminantNodeDrop, rollContaminantDrop } from '../../src/systems/contaminant-quality';
import { rollWeaponDrop } from '../../src/systems/weapon-loot';
import { mix32 } from '../../src/generation/seed-fork';
import { VoidRegions } from '../../src/dev/spatial-study/void-regions';
import { SEA_ROUTE_GUIDES } from './route-guides';
import type { SeaPoint } from '../../src/worlds/suspended-sea/types';

let passed = 0;
function check(name: string, run: () => void): void { run(); console.log(`PASS ${name}`); passed++; }
const pointKey = (p: SeaPoint) => `${p.x}:${p.y}`;
function clear(world: SuspendedSeaWorld, p: SeaPoint): boolean {
  return [-10, 10].every(dx => [-10, 10].every(dy => world.base.isFloor(p.x + dx, p.y + dy)));
}
function distanceToPolygon(p: SeaPoint, polygon: readonly SeaPoint[]): number {
  if (pointInPolygon(p, polygon)) return 0;
  let nearest = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length));
    nearest = Math.min(nearest, Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t));
  }
  return nearest;
}
function hazardEnvelope(world: SuspendedSeaWorld): readonly (readonly SeaPoint[])[] {
  const polygons: (readonly SeaPoint[])[] = [world.shellDefinition.spillOutline];
  for (let elapsed = 0; elapsed <= 150000; elapsed += 150) {
    world.base.prepare(elapsed);
    if (world.base.water.active) polygons.push(world.base.waterOutline.map(p => ({ ...p })));
  }
  return polygons;
}
function safeAt(p: SeaPoint, polygons: readonly (readonly SeaPoint[])[], margin = 14.2): boolean {
  return polygons.every(polygon => distanceToPolygon(p, polygon) > margin);
}
function traverse(world: SuspendedSeaWorld, polygons: readonly (readonly SeaPoint[])[] = []): Set<string> {
  const spawn = world.base.layout.spawnPoint, queue: SeaPoint[] = [spawn], visited = new Set([pointKey(spawn)]);
  const safeCache = new Map<string, boolean>();
  for (let at = 0; at < queue.length; at++) {
    const p = queue[at]!;
    for (const [dx, dy] of [[16, 0], [-16, 0], [0, 16], [0, -16]]) {
      const next = { x: p.x + dx!, y: p.y + dy! }, key = pointKey(next);
      if (visited.has(key) || !clear(world, next)) continue;
      let allowed = safeCache.get(key);
      if (allowed === undefined) { allowed = safeAt(next, polygons, 22.2); safeCache.set(key, allowed); }
      if (!allowed || bodyDisplacementFraction(world.base.layout.walkableMask, p, 10, 10, dx!, dy!) < 1) continue;
      visited.add(key); queue.push(next);
    }
  }
  return visited;
}
function follow(world: SuspendedSeaWorld, points: readonly SeaPoint[], polygons: readonly (readonly SeaPoint[])[]): number {
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!;
    assert.equal(bodyDisplacementFraction(world.base.layout.walkableMask, a, 10, 10, b.x - a.x, b.y - a.y), 1);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let offset = 0; offset <= length; offset += 4) {
      const t = offset / length, point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      assert(clear(world, point)); assert(safeAt(point, polygons), `Unsafe planned bypass at ${pointKey(point)}`);
    }
    distance += length;
  }
  return distance;
}

check('all native authored values equal their CSV sources, including null and Boolean schema', () => {
  for (const [table, data] of Object.entries({ scenes: SUSPENDED_SEA_SCENES, ground: SUSPENDED_SEA_GROUND,
    openings: SUSPENDED_SEA_OPENINGS, water: SUSPENDED_SEA_WATER, placements: SUSPENDED_SEA_PLACEMENTS })) {
    const lines = readFileSync(`data/suspended-sea-${table}.csv`, 'utf8').trim().split(/\r?\n/);
    const headers = lines.shift()!.split(',').map(s => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()));
    assert.equal(lines.length, data.length);
    lines.forEach((line, index) => {
      const fields = line.split(','); assert.equal(fields.length, headers.length);
      const source: Record<string, unknown> = {};
      headers.forEach((key, column) => {
        const expected = Reflect.get(data[index]!, key), raw = fields[column]!;
        source[key] = expected === null ? (assert.equal(raw, ''), null)
          : typeof expected === 'number' ? Number(raw) : typeof expected === 'boolean' ? raw === 'true' : raw;
      });
      assert.deepEqual(source, data[index]);
    });
  }
});

check('unknown explicit worlds, loadouts, sources and malformed seeds fail; legacy M/local remain intact', () => {
  for (const values of [{ scene: 'frag-library' }, { loadout: 'quiet' }, { seed: '' }, { seed: '-1' }, { seed: '1.5' }]) {
    assert.throws(() => resolveSuspendedSeaOptions(values));
  }
  for (const loadout of ['bare','melee','light','shore']) assert.equal(resolveSuspendedSeaOptions({ loadout }).loadout, loadout);
  assert.throws(() => rollContaminantNodeDrop(7, 'x', 'safe', 'missing'));
  assert.equal(new SpatialSliceWorld(7).signature(), 'aa970f9f');
  assert.equal(createStageGameplayWorld(7).signature(), 'cdd27cbd');
  const shore = BUILD_LAB_LOADOUTS.find(row => row.id === 'shore')!;
  assert.deepEqual([shore.weapon, shore.activeA, shore.activeB, shore.passive, shore.pair], ['crowbar_plain','kindle','stitch','muffle','light']);
});

check('every atomic placement variant has two supported real insects, seven native-source piles and distinct deployments', () => {
  const topologies = new Set<string>();
  for (const scene of SUSPENDED_SEA_SCENES) {
    const seen = new Map<number, string>();
    for (let seed = 0; seed < 12; seed++) {
      const world = createSuspendedSeaWorld(seed, scene.id), layout = world.base.layout;
      assert.equal(layout.fragmentTypeId, 'suspended-sea'); assert.equal(layout.ruins.fragmentTypeId, 'suspended-sea');
      assert.equal(layout.kindlingNodes.length, 3); assert.equal(layout.contaminantNodes.length, 4);
      assert.equal(layout.enemySpawns.length, 2); assert.equal(layout.enemySpawns.filter(e => e.type === 'rewriter').length, 1);
      assert.deepEqual(layout.enemySpawns.map(e => e.form!.lexemes.sense).sort(), ['sense_cone','sense_hear']);
      assert.equal(layout.kindlingNodes.filter(n => n.allowWeapon === false).length, 1);
      assert(layout.contaminantNodes.every(n => n.lootPoolId && Object.prototype.hasOwnProperty.call(CONTAMINANT_SOURCE_POOLS, n.lootPoolId)));
      assert.equal(world.base.reef.height, 0);
      const variant = world.metadata.variants['listener-deposit']!;
      const deployment = JSON.stringify({ enemies: layout.enemySpawns, piles: layout.contaminantNodes });
      if (seen.has(variant)) assert.equal(seen.get(variant), deployment); else seen.set(variant, deployment);
      assert.deepEqual(createSuspendedSeaWorld(seed, scene.id).metadata, world.metadata);
      topologies.add(JSON.stringify(layout.tileMap.tiles));
    }
    assert.equal(seen.size, 2); assert.equal(new Set(seen.values()).size, 2, 'Seed must alter content, not only sea texture');
  }
  assert.equal(topologies.size, 2);
});

check('full bodies reach every authored point; worst-case active water retains a complete safe return and priced bypass', () => {
  for (const scene of SUSPENDED_SEA_SCENES) for (const seed of [1, 3]) {
    const world = createSuspendedSeaWorld(seed, scene.id), layout = world.base.layout;
    const polygons = hazardEnvelope(world), reachable = traverse(world), safe = traverse(world, polygons);
    const guide = SEA_ROUTE_GUIDES[scene.id];
    for (const point of [layout.spawnPoint, layout.extractionPoint.position, ...layout.kindlingNodes.map(n => n.position), ...layout.contaminantNodes.map(n => n.position)]) {
      assert(reachable.has(pointKey(point)), `${scene.id} unsupported placement ${pointKey(point)}`);
      assert(safe.has(pointKey(point)), `${scene.id} no all-water-safe route to ${pointKey(point)}`);
    }
    for (const enemy of layout.enemySpawns) for (const p of [enemy.spawn, ...enemy.patrol.waypoints]) {
      assert(reachable.has(pointKey({ x: (p.col + .5) * 32, y: (p.row + .5) * 32 })));
    }
    assert(clear(world, guide.hitStand)); assert(clear(world, guide.observation));
    assert(safeAt(guide.hitStand, polygons)); assert(safeAt(guide.observation, polygons, 36));
    const listener = layout.enemySpawns.find(enemy => enemy.type === 'rewriter')!;
    for (let i = 1; i < listener.patrol.waypoints.length; i++) {
      const a = listener.patrol.waypoints[i - 1]!, b = listener.patrol.waypoints[i]!;
      const length = Math.hypot(b.col - a.col, b.row - a.row) * 32;
      for (let step = 0; step <= length; step += 4) {
        const p = { x: (a.col + .5) * 32 + (b.col - a.col) * 32 * step / length,
          y: (a.row + .5) * 32 + (b.row - a.row) * 32 * step / length };
        assert(Math.hypot(p.x - guide.observation.x, p.y - guide.observation.y) > 180,
          'First observation must remain outside the listener sight/hearing envelope');
      }
    }
    const hitDistance = Math.hypot(guide.hitStand.x - world.shellDefinition.position.x, guide.hitStand.y - world.shellDefinition.position.y);
    assert(hitDistance >= 24 && hitDistance <= 32);
    const bypassLength = follow(world, guide.bypass, polygons);
    const directLength = follow(world, guide.shortcut, []);
    const extra = bypassLength - directLength;
    assert(extra >= (scene.id === 'sea-open-channel' ? 240 : 320) && extra <= (scene.id === 'sea-open-channel' ? 400 : 480));
    const regions = new VoidRegions(layout.tileMap), drain = world.shellDefinition.drainPath[world.shellDefinition.drainPath.length - 1]!;
    assert(regions.isInterior(drain.x, drain.y));
    assert(Number(world.base.ground.snapshot().maximumSlope) <= .4);
    console.log(`MEASURE ${scene.id} seed ${seed}: ${safe.size} safe 16px samples; bypass +${extra}px; hit distance ${hitDistance}px.`);
  }
});

check('source families and independent quality streams are deterministic; old global draws are byte-equivalent', () => {
  const encountered = new Set<string>();
  for (const poolId of Object.keys(CONTAMINANT_SOURCE_POOLS) as (keyof typeof CONTAMINANT_SOURCE_POOLS)[]) {
    const permitted = new Set(CONTAMINANT_SOURCE_POOLS[poolId].map(row => row.type));
    for (let seed = 0; seed < 4096; seed++) {
      const drop = rollContaminantNodeDrop(seed, 'test-node', 'deep', poolId);
      assert(permitted.has(drop.type as never)); encountered.add(`${poolId}:${drop.type}`);
      assert.deepEqual(drop, rollContaminantNodeDrop(seed, 'test-node', 'deep', poolId));
      assert.equal(drop.quality, rollContaminantNodeDrop(seed, 'test-node', 'deep').quality);
    }
  }
  assert.equal(encountered.size, 7);
  for (let seed = 0; seed < 128; seed++) {
    const nodeSeed = mix32(seed, 'contaminant-pile:test-node');
    const samples = [mix32(nodeSeed, 'family'), mix32(nodeSeed, 'quality')]; let i = 0;
    const old = rollContaminantDrop(() => (samples[i++]! >>> 0) / 4294967296, CONTAMINANT_LOOT_PROFILES.deep);
    assert.deepEqual(rollContaminantNodeDrop(seed, 'test-node', 'deep'), old);
  }
});

check('source exclusion outranks first-weapon discovery and the old eligible-node algorithm stays unchanged', () => {
  for (const tier of ['safe','contested','deep'] as const) for (const firstWeaponDiscovered of [false, true]) {
    for (let runSeed = 0; runSeed < 256; runSeed++) {
      const request = { runSeed, nodeId: 'pile', tier, firstWeaponDiscovered };
      assert.equal(rollWeaponDrop({ ...request, allowWeapon: false }), null);
      assert.equal(rollWeaponDrop({ ...request, allowWeapon: true }), rollWeaponDrop(request));
    }
  }
  assert(rollWeaponDrop({ runSeed: 7, nodeId: 'foreign', tier: 'contested', firstWeaponDiscovered: false, allowWeapon: true }));
});

console.log(`${passed} suspended-sea content checks passed. Play balance and visual readability still require actual input and frames.`);
