import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STAGE_GAMEPLAY_GROUND, STAGE_GAMEPLAY_OPENINGS, STAGE_GAMEPLAY_PLACEMENTS,
  STAGE_GAMEPLAY_SCENES, STAGE_GAMEPLAY_WATER } from '../../src/generated/stage-gameplay-data';
import { assertStageVisualSupport, createStageGameplayWorld, resolveSpatialSliceOptions } from '../../src/dev/spatial-study/stage-gameplay-fixture';
import { LOCAL_SLICE_DATA, SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { VoidRegions } from '../../src/dev/spatial-study/void-regions';
import { bodyDisplacementFraction } from '../../src/systems/ai/physical-grid';
import { TileType } from '../../src/types/game-types';
import { StageSea } from '../../src/dev/spatial-study/stage/sea';
import { StageFollowCamera } from '../../src/dev/spatial-study/stage/camera';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';

let passed = 0;
function check(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
type Cell = { col: number; row: number };
const key = (p: Cell) => `${p.col}:${p.row}`;
const position = (p: Cell) => ({ x: (p.col + .5) * 32, y: (p.row + .5) * 32 });
const cell = (p: { x: number; y: number }): Cell => ({ col: Math.floor(p.x / 32), row: Math.floor(p.y / 32) });
function traverse(world: SpatialSliceWorld, from: Cell, allowed: (p: Cell) => boolean = () => true): Map<string, Cell | null> {
  const queue = [from], visited = new Map<string, Cell | null>([[key(from), null]]);
  for (let at = 0; at < queue.length; at++) {
    const p = queue[at]!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { col: p.col + dx!, row: p.row + dy! };
      if (!world.layout.walkableMask.isWalkable(next.col, next.row) || !allowed(next) || visited.has(key(next))) continue;
      assert.equal(bodyDisplacementFraction(world.layout.walkableMask, position(p), 10, 10, dx! * 32, dy! * 32), 1);
      visited.set(key(next), p); queue.push(next);
    }
  }
  return visited;
}

check('all authored scene, placement, water, opening and ground values originate in their CSV rows', () => {
  const tables = { scenes: STAGE_GAMEPLAY_SCENES, placements: STAGE_GAMEPLAY_PLACEMENTS, water: STAGE_GAMEPLAY_WATER,
    openings: STAGE_GAMEPLAY_OPENINGS, ground: STAGE_GAMEPLAY_GROUND };
  for (const [name, data] of Object.entries(tables)) {
    const lines = readFileSync(resolve('data', `stage-gameplay-${name}.csv`), 'utf8').trim().split(/\r?\n/);
    const header = lines.shift()!.split(',').map(name => name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()));
    assert.equal(lines.length, data.length);
    lines.forEach((line, index) => {
      const fields = line.split(','), source: Record<string, unknown> = {}, expected = data[index]!;
      assert.equal(fields.length, header.length);
      header.forEach((field, column) => { source[field] = typeof Reflect.get(expected, field) === 'number' ? Number(fields[column]) : fields[column]; });
      assert.deepEqual(source, expected);
    });
  }
});

check('default local bundle retains its frozen seed-7 signature and does not share mutable long-route state', () => {
  const original = new SpatialSliceWorld(7), explicit = new SpatialSliceWorld(7, LOCAL_SLICE_DATA), long = createStageGameplayWorld(7);
  assert.equal(original.signature(), 'aa970f9f'); assert.equal(explicit.signature(), original.signature());
  const before = JSON.stringify(original.layout);
  long.advance(8000, long.layout.spawnPoint, true, () => false);
  long.layout.tileMap.tiles[5]![5] = TileType.VOID;
  assert.equal(original.elapsedMs, 0); assert.equal(JSON.stringify(original.layout), before);
  assert.equal(new SpatialSliceWorld(7).signature(), 'aa970f9f');
});

check('configuration admission rejects unknown values and preserves frozen Vista without implicit long-route fallback', () => {
  assert.deepEqual(resolveSpatialSliceOptions({}), { view: 'stage', route: 'long', loadout: 'bare', seed: 7 });
  assert.deepEqual(resolveSpatialSliceOptions({ view: 'vista' }), { view: 'vista', route: 'local', loadout: 'bare', seed: 7 });
  for (const loadout of ['bare', 'melee', 'light']) assert.equal(resolveSpatialSliceOptions({ loadout }).loadout, loadout);
  for (const values of [{ view: 'other' }, { route: 'other' }, { loadout: 'quiet' }, { seed: '' }, { seed: '-1' },
    { seed: 'NaN' }, { seed: '2.2' }, { view: 'vista', route: 'long' }, { view: 'vista', loadout: 'melee' }]) {
    assert.throws(() => resolveSpatialSliceOptions(values));
  }
});

check('only the two supported infiltrated insects enter this route; unsupported shapes are refused before a scene starts', () => {
  const world = createStageGameplayWorld(7);
  assert.equal(world.layout.enemySpawns.length, 2);
  assert.deepEqual(world.layout.enemySpawns.map(enemy => enemy.form?.lexemes.sense).sort(), ['sense_cone', 'sense_hear']);
  assert.equal(world.layout.enemySpawns.filter(enemy => enemy.type === 'rewriter').length, 1,
    'The actual AI runtime type must satisfy the exactly-one hearing-body contract');
  for (const enemy of world.layout.enemySpawns) {
    assert.equal(enemy.type, enemy.form?.lexemes.sense === 'sense_hear' ? 'rewriter' : 'infiltrator');
  }
  assert.equal(new SpatialSliceWorld(7).layout.enemySpawns[0]!.type, 'rewriter');
  const layout = structuredClone(world.layout);
  layout.enemySpawns[0]!.form!.substrate = 'human_remnant';
  assert.throws(() => assertStageVisualSupport(layout));
  layout.enemySpawns[0]!.form!.substrate = 'insect_remnant';
  layout.enemySpawns[0]!.form!.coverage = 'engulf';
  assert.throws(() => assertStageVisualSupport(layout));
});

check('all real floor and authored interactions connect through full-body-clear routes around exactly two irregular chasms', () => {
  const world = createStageGameplayWorld(7), map = world.layout.tileMap;
  const reachable = traverse(world, cell(world.layout.spawnPoint));
  let floors = 0;
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) if (map.tiles[row]![col] === TileType.FLOOR) {
    floors++; assert(reachable.has(key({ col, row })));
  }
  assert(floors > 800);
  for (const point of [world.layout.extractionPoint.position, ...world.layout.kindlingNodes.map(p => p.position), ...world.layout.contaminantNodes.map(p => p.position)]) {
    assert(reachable.has(key(cell(point))));
  }
  for (const enemy of world.layout.enemySpawns) for (const p of [enemy.spawn, ...enemy.patrol.waypoints]) assert(reachable.has(key(p)));
  const regions = new VoidRegions(map), visited = new Set<string>();
  let components = 0;
  for (let row = 0; row < map.rows; row++) for (let col = 0; col < map.cols; col++) {
    const start = { col, row }, at = position(start);
    if (!regions.isInterior(at.x, at.y) || visited.has(key(start))) continue;
    components++;
    const queue = [start]; visited.add(key(start));
    for (let i = 0; i < queue.length; i++) for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const p = { col: queue[i]!.col + dx!, row: queue[i]!.row + dy! }, xy = position(p);
      if (!regions.isInterior(xy.x, xy.y) || visited.has(key(p))) continue;
      visited.add(key(p)); queue.push(p);
    }
    const columns = queue.map(p => p.col), rows = queue.map(p => p.row);
    const rectangle = (Math.max(...columns) - Math.min(...columns) + 1) * (Math.max(...rows) - Math.min(...rows) + 1);
    assert(queue.length > 100 && queue.length < rectangle, 'A chasm must be substantial and have a nonrectangular shore');
  }
  assert.equal(components, 2);
  assert(Number(world.ground.snapshot().maximumSlope) <= .4);
});

check('the full water sweep has a body-clear detour and an optional full round trip remains possible during release', () => {
  const world = createStageGameplayWorld(7), danger = new Set<string>(), def = world.waterDefinition;
  const period = def.quietMs + def.warningMs + def.activeMs + def.retractMs;
  for (let ms = 0; ms <= Math.max(period * 2, 150000); ms += 100) {
    world.advance(ms, world.layout.spawnPoint, true, () => false);
    if (!world.water.active) continue;
    for (let row = 23; row <= 29; row++) for (let col = 40; col <= 46; col++) {
      const p = position({ col, row });
      if ([-10, 0, 10].some(dx => [-10, 0, 10].some(dy => world.isInsideWater({ x: p.x + dx, y: p.y + dy })))) danger.add(key({ col, row }));
    }
  }
  assert(danger.size > 0, 'The test must include the actual falling-water footprint');
  const safe = traverse(world, cell(world.layout.spawnPoint), p => !danger.has(key(p)));
  for (const point of [...world.layout.kindlingNodes, ...world.layout.contaminantNodes]) assert(safe.has(key(cell(point.position))));
  for (let col = 38; col <= 49; col++) assert(safe.has(key({ col, row: 29 })));
  console.log(`MEASURE stage route: ${safe.size} safe reachable cells; ${danger.size} cells in the sampled active water/body sweep.`);
});

check('the long sea fits the existing allocation across representative seeds and moments without changing local water', () => {
  const context = {} as RiftDevRuntimeContext;
  let largest = 0;
  for (const seed of [0, 7, 42, 0xffffffff]) {
    const world = createStageGameplayWorld(seed), follow = new StageFollowCamera(world.width, world.height, world.layout.spawnPoint);
    const sea = new StageSea(context, world);
    for (const ms of [0, 6340, 12000, 45000, 90000, 150000]) {
      world.advance(ms, world.layout.spawnPoint, true, () => false);
      sea.update(ms, world.layout.spawnPoint, follow.camera);
      const geometry = sea.copyBodyGeometry();
      assert(geometry.positions.every(Number.isFinite));
      const vertices = geometry.positions.length / 3;
      largest = Math.max(largest, vertices);
      assert(vertices > 50000 && vertices < 230000, `Water vertex budget exceeded: ${vertices}`);
    }
    sea.destroy(); disposeTree(sea.group);
  }
  console.log(`MEASURE largest sampled long-route sea: ${largest} / 230000 vertices; browser frame timings remain required.`);
});

console.log(`${passed} stage-gameplay fixture checks passed. No real play duration or combat result is synthesized here.`);
