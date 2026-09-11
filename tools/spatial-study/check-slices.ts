import assert from 'node:assert/strict';
import { SpatialSliceWorld, SLICE_SCENE, SLICE_WATER, pointInPolygon } from '../../src/dev/spatial-study/slice-world';
import { createSpatialStudyLayout } from '../../src/dev/spatial-study/fixture';
import { SPATIAL_SLICE_PLACEMENTS } from '../../src/generated/spatial-slice-data';
import { TileType } from '../../src/types/game-types';

let passed = 0, failed = 0;
function check(name: string, run: () => void): void {
  try { run(); passed++; console.log(`PASS ${name}`); }
  catch (error) { failed++; console.error(`FAIL ${name}\n${String(error)}`); }
}
type Cell = { col: number; row: number };
const key = (p: Cell) => `${p.col}:${p.row}`;
function route(world: SpatialSliceWorld, from: Cell, to: Cell, allowed: (p: Cell) => boolean = () => true): Cell[] | null {
  const queue = [from], visited = new Map<string, Cell | null>([[key(from), null]]);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!;
    if (key(p) === key(to)) {
      const result: Cell[] = []; let cursor: Cell | null = p;
      while (cursor) { result.push(cursor); cursor = visited.get(key(cursor))!; }
      return result.reverse();
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const next = { col: p.col + dx!, row: p.row + dy! };
      if (!visited.has(key(next)) && allowed(next) && world.isFloor((next.col + .5) * 32, (next.row + .5) * 32)) {
        visited.set(key(next), p); queue.push(next);
      }
    }
  }
  return null;
}
const at = (p: { x: number; y: number }): Cell => ({ col: Math.floor(p.x / 32), row: Math.floor(p.y / 32) });
function floorPoints(world: SpatialSliceWorld): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  // Domain is every real FLOOR cell center, not the enclosing map rectangle or sea texture.
  for (let row = 0; row < world.layout.tileMap.rows; row++) for (let col = 0; col < world.layout.tileMap.cols; col++) {
    const p = { x: (col + .5) * 32, y: (row + .5) * 32 };
    if (world.isFloor(p.x, p.y)) points.push(p);
  }
  return points;
}

check('two consumers of the same seed receive equal mechanics and independent mutable map/clock state', () => {
  for (const seed of [0, 7, 0xffffffff]) {
    const stage = new SpatialSliceWorld(seed), vista = new SpatialSliceWorld(seed);
    assert.equal(stage.signature(), vista.signature());
    assert.deepEqual(stage.layout.tileMap, vista.layout.tileMap);
    assert.deepEqual(stage.layout.enemySpawns, vista.layout.enemySpawns);
    assert.deepEqual(stage.layout.kindlingNodes, vista.layout.kindlingNodes);
    assert.deepEqual(stage.layout.contaminantNodes, vista.layout.contaminantNodes);
    stage.advance(7000, { x: 100, y: 100 }, true, () => false);
    assert.equal(vista.elapsedMs, 0);
    stage.layout.tileMap.tiles[5]![5] = TileType.VOID;
    assert.equal(vista.layout.tileMap.tiles[5]![5], TileType.FLOOR);
    assert.equal(stage.signature(), vista.signature());
  }
  assert.notEqual(new SpatialSliceWorld(7).signature(), new SpatialSliceWorld(8).signature());
  for (const seed of [-1, .25, NaN, Infinity, 0x100000000]) assert.throws(() => new SpatialSliceWorld(seed));
});

check('central authored holes are real VOID in floor, outline and collision, with every actual target reachable', () => {
  const world = new SpatialSliceWorld(7), layout = world.layout, spawn = at(layout.spawnPoint);
  let voidCells = 0;
  for (const rect of SLICE_SCENE.voids.split('|')) {
    const [left, top, width, height] = rect.split(':').map(Number) as [number, number, number, number];
    for (let row = top; row < top + height; row++) for (let col = left; col < left + width; col++) {
      assert.equal(layout.tileMap.tiles[row]![col], TileType.VOID);
      assert.equal(layout.walkableMask.isWalkable(col, row), false);
      assert.equal(layout.ruins.outline.land[row * layout.tileMap.cols + col], 0);
      voidCells++;
    }
  }
  assert(voidCells >= 32, 'Central void must remain a meaningful space, not a decorative pixel');
  assert.equal(world.isFloor(16.5 * 32, 13.5 * 32), false);
  for (const point of [layout.extractionPoint.position, ...layout.kindlingNodes.map(n => n.position), ...layout.contaminantNodes.map(n => n.position)]) {
    assert(route(world, spawn, at(point)), `No route to ${JSON.stringify(point)}`);
  }
  for (const enemy of layout.enemySpawns) for (const target of [enemy.spawn, ...enemy.patrol.waypoints]) assert(route(world, spawn, target));
  for (const p of floorPoints(world)) assert(route(world, spawn, at(p)), 'Disconnected real floor island');
});

check('the hole has distinct west and east return routes outside the actual active polygon sweep', () => {
  const world = new SpatialSliceWorld(7), south = at(world.layout.spawnPoint), north = { col: 15, row: 8 };
  const hazardCells = new Set<string>(), points = floorPoints(world);
  const period = SLICE_WATER.quietMs + SLICE_WATER.warningMs + SLICE_WATER.activeMs + SLICE_WATER.retractMs;
  for (let ms = 0; ms <= period; ms += 25) {
    world.advance(ms, world.layout.spawnPoint, true, () => false);
    if (!world.water.active) continue;
    for (const p of points) if ([[0,0],[8,0],[-8,0],[0,8],[0,-8]].some(([dx,dy]) => world.isInsideWater({x:p.x+dx!, y:p.y+dy!}))) hazardCells.add(key(at(p)));
  }
  assert(hazardCells.size > 0, 'Do not call an empty hazard sweep a safe-route proof');
  const noHazard = (p: Cell) => !hazardCells.has(key(p));
  const west = (p: Cell) => noHazard(p) && (p.row <= 9 || p.row >= 17 || p.col <= 10);
  const east = (p: Cell) => noHazard(p) && (p.row <= 9 || p.row >= 17 || p.col >= 21);
  for (const allowed of [west, east]) {
    const outward = route(world, south, north, allowed), back = route(world, north, south, allowed);
    assert(outward && back, 'Both sides must form a usable outward/return circuit');
  }
});

check('generic fixture rejects a disconnected extraction or enemy patrol component', () => {
  const definition = { ...SLICE_SCENE, floors: '2:2:8:8|20:20:2:2', walls: '', voids: '', spawn: '3:3', extract: '20:20' };
  const enemy = { ...SPATIAL_SLICE_PLACEMENTS.find(p => p.kind === 'enemy')!, col: 4, row: 3, patrol: '3:3|4:3' };
  assert.throws(() => createSpatialStudyLayout(7, definition, [enemy]), 'Floor-valid but unreachable exit must not be admitted');
  assert.throws(() => createSpatialStudyLayout(7, { ...definition, extract: '3:3' }, [{ ...enemy, patrol: '3:3|20:20' }]), 'Unreachable patrol waypoint must not be admitted');
});

check('concave contact includes actual polygon edges but excludes the notch and old ellipse-only ground', () => {
  const concave = [{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 8, y: 8 }, { x: 5, y: 8 }, { x: 5, y: 3 }, { x: 3, y: 3 }, { x: 3, y: 8 }, { x: 0, y: 8 }];
  assert(pointInPolygon({ x: 1, y: 6 }, concave));
  assert(!pointInPolygon({ x: 4, y: 6 }, concave));
  assert(pointInPolygon({ x: 3, y: 6 }, concave));
  assert(!pointInPolygon({ x: 4, y: 6 }, [...concave].reverse()));
  const world = new SpatialSliceWorld(7), center = { x: SLICE_WATER.x, y: SLICE_WATER.y };
  for (const ms of [0, 6300, 8000, 11000]) {
    world.advance(ms, center, true, () => false);
    assert(world.isInsideWater(center));
    for (let i = 0; i < world.waterOutline.length; i++) {
      const a = world.waterOutline[i]!, b = world.waterOutline[(i + 1) % world.waterOutline.length]!;
      assert(world.isInsideWater(a));
      assert(world.isInsideWater({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
    }
    const notch = { x: center.x - 14, y: center.y - 35 };
    assert((14 / (SLICE_WATER.width / 2)) ** 2 + (35 / (SLICE_WATER.depth / 2)) ** 2 < 1);
    assert(!world.isInsideWater(notch), `Authored inward notch filled as ellipse at ${ms}`);
  }
});

check('real callback arguments and committed counts follow active contact, never repeated frames or the final ended state', () => {
  const center = { x: SLICE_WATER.x, y: SLICE_WATER.y }, start = SLICE_WATER.quietMs + SLICE_WATER.warningMs;
  const world = new SpatialSliceWorld(7), calls: { source: string; damage: number }[] = [];
  const hit = (source: string, damage: number) => { calls.push({ source, damage }); return true; };
  world.advance(SLICE_WATER.quietMs - 1, center, false, hit); assert.equal(calls.length, 0);
  world.advance(start, { x: center.x - 14, y: center.y - 35 }, false, hit); assert.equal(calls.length, 0);
  world.advance(start, center, false, hit); world.advance(start, center, false, hit); assert.equal(calls.length, 1);
  world.advance(start + SLICE_WATER.hitIntervalMs - 1, center, false, hit); assert.equal(calls.length, 1);
  world.advance(start + SLICE_WATER.hitIntervalMs, center, false, (source, damage) => { calls.push({ source, damage }); return false; });
  assert.equal(world.attempts, 2); assert.equal(world.hits, 1);
  world.advance(start + SLICE_WATER.hitIntervalMs * 2, center, false, hit);
  assert.equal(world.attempts, 3); assert.equal(world.hits, 2);
  for (const call of calls) assert.deepEqual(call, { source: `environment:${SLICE_WATER.id}`, damage: SLICE_WATER.damage });
  world.advance(start + SLICE_WATER.hitIntervalMs * 3, center, true, hit); assert.equal(calls.length, 3);
  const lethal = new SpatialSliceWorld(7); let ended = false, deaths = 0;
  lethal.advance(start, center, ended, () => { ended = true; deaths++; return true; });
  for (const ms of [start, start + 800, start + 1600, start + 2400]) lethal.advance(ms, center, ended, () => { deaths++; return true; });
  assert.equal(deaths, 1); assert.equal(lethal.hits, 1); assert.equal(lethal.attempts, 1);
});

check('natural holes move with world time, ignore player position, and never carve the authoritative ground', () => {
  const first = new SpatialSliceWorld(7), second = new SpatialSliceWorld(7), before = structuredClone(first.layout.tileMap);
  const points = floorPoints(first);
  const initial = points.map(p => first.seaField(p.x, p.y, 0) > 0);
  first.advance(15000, { x: 150, y: 200 }, true, () => false);
  second.advance(15000, { x: 850, y: 730 }, true, () => false);
  assert.deepEqual(first.waterOutline, second.waterOutline);
  const later = points.map(p => first.seaField(p.x, p.y) > 0);
  for (const p of points) assert.equal(first.seaField(p.x, p.y), second.seaField(p.x, p.y));
  assert(later.filter((value, i) => value !== initial[i]).length >= 8, 'Time must actually move hole boundaries across real ground');
  assert.deepEqual(first.layout.tileMap, before); assert.deepEqual(second.layout.tileMap, before);
  for (const h of first.openings) assert(first.seaField(h.x, h.y) < 0, 'Declared natural opening must remain air near its authored center');
});

check('real floor sampling finds extensive sea coverage and substantial surviving air openings', () => {
  const samples: unknown[] = [];
  for (const seed of [0, 7, 101]) {
    const world = new SpatialSliceWorld(seed), points = floorPoints(world);
    for (const ms of [0, 5000, 15000, 30000]) {
      const covered = points.filter(p => world.seaField(p.x, p.y, ms) > 0).length;
      const ratio = covered / points.length;
      assert(ratio > .50 && ratio < .92, `Coverage ${ratio} at seed=${seed}, ms=${ms} is not broad cover with surviving holes`);
      samples.push({ seed, ms, realFloorCells: points.length, covered, air: points.length - covered, ratio: Number(ratio.toFixed(3)) });
    }
  }
  console.log(`MEASURE real FLOOR cell-center coverage (not aesthetics): ${JSON.stringify(samples)}`);
});

console.log(`${passed} spatial-slice rule checks passed; ${failed} failed. Rendering, real combat adapter and player experience remain separate acceptance.`);
if (failed) process.exitCode = 1;
