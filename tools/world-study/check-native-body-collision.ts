/** Native player geometry is exact; generation, AI and Host grids stay frozen. */
import assert from 'node:assert/strict';
import { NativeBodyCollision, type NativeBodyMotion } from '../../src/generation/world-study/native-body-collision';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { collectToolRevealSnapshot, findSingleWallLanding, findSoundLureLanding, sweepGroundDash } from '../../src/systems/tool-targeting';
import { TileType } from '../../src/types/game-types';
import type { R100NativeWorldData } from '../../src/generation/world-study/r100-native-data';
import type { TileMapData } from '../../src/types/map-types';

const recipe = createR100ProductionRecipe('ash-strata', 20261004, 'severe');
const world = createR100ProductionMap(recipe), native = world.native!;
const unchanged = JSON.stringify({ map: world.layout.tileMap, meshes: native.meshes, recipe });
const start = performance.now(), collision = new NativeBodyCollision(native, world.layout.tileMap);
const prepareMs = performance.now() - start;
const cases = [
  { id: '008-up', point: { x: 580.5722793894035, y: 306 }, dx: 0, dy: -20, expected: 4.96 },
  { id: '013-left', point: { x: 538, y: 334 }, dx: -20, dy: 0, expected: 7.66 },
  { id: '016-up', point: { x: 341.60328455516486, y: 354 }, dx: 0, dy: -20, expected: 2.16 },
  { id: '018-up', point: { x: 264.9192628084076, y: 330 }, dx: 0, dy: -20, expected: 4.99 },
];
const results = cases.map(test => {
  assert(collision.supports(test.point, 10, 10), test.id + ' original contact must remain supported');
  const fraction = collision.displacementFraction(test.point, 10, 10, test.dx, test.dy), travel = fraction * 20;
  assert(Math.abs(travel - test.expected) < .025, test.id + ': exact geometry distance, not an arbitrary margin');
  const at = { x: test.point.x + test.dx * fraction, y: test.point.y + test.dy * fraction };
  assert(collision.supports(at, 10, 10));
  assert(!collision.supports({ x: at.x + test.dx * .001, y: at.y + test.dy * .001 }, 10, 10));
  assert.deepEqual(sweepGroundDash({ origin: test.point, destination: { x: test.point.x + test.dx, y: test.point.y + test.dy }, grid: new TileGrid(world.layout.tileMap), bodyQueries: collision }), at);
  return { id: test.id, travel, at };
});
const motion: NativeBodyMotion = { x: 0, y: 0, velocityX: 0, velocityY: 0, collided: false };
// Deterministic long sweeps exercise corners, multiple triangles and missing floor.
let random = 987654321;
const next = (): number => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
let sweeps = 0, oldPositions = 0;
const grid = new TileGrid(world.layout.tileMap), sweepStart = performance.now();
for (let i = 0; i < 12000; i++) {
  const point = { x: 10 + next() * (grid.widthPx - 20), y: 10 + next() * (grid.heightPx - 20) };
  if (bodyHasSupport(grid, point, 10, 10)) { assert(collision.supports(point, 10, 10), 'conservative historical support is a subset'); oldPositions++; }
  if (!collision.supports(point, 10, 10)) continue;
  const dx = (next() - .5) * 900, dy = (next() - .5) * 700;
  collision.resolveMotion(point, 10, 10, dx, dy, { x: dx, y: dy }, motion);
  assert(collision.supports(motion, 10, 10), `sweep must end supported ${JSON.stringify({ point, dx, dy, motion })}`);
  assert(Math.hypot(motion.x - point.x, motion.y - point.y) <= Math.hypot(dx, dy) + 1e-5);
  assert(Math.hypot(motion.velocityX, motion.velocityY) <= Math.hypot(dx, dy) + 1e-5);
  sweeps++;
}
const sweepMs = performance.now() - sweepStart;
assert(oldPositions > 1000 && sweeps > 1000);
assert.equal(JSON.stringify({ map: world.layout.tileMap, meshes: native.meshes, recipe }), unchanged);

function fixture(points: number[], role: 'solid' | 'relief' = 'solid', voidCol = -1): { collision: NativeBodyCollision; grid: TileGrid } {
  const map: TileMapData = { tileSize: 8, cols: 24, rows: 20, tiles: Array.from({ length: 20 }, () => Array.from({ length: 24 }, (_, col) => col === voidCol ? TileType.VOID : TileType.FLOOR)) };
  const native = { definition: { instances: [{ id: 1, role }] }, meshes: [{ spec: { id: 1 }, positions: points, indices: [0, 1, 2, 0, 2, 3] }] } as unknown as R100NativeWorldData;
  // Mark the whole conservative column, as actual generation does for a thin face.
  if (role === 'solid') for (const row of map.tiles) { row[10] = TileType.WALL; if (points[3]! > 88) row[11] = TileType.WALL; }
  return { collision: new NativeBodyCollision(native, map), grid: new TileGrid(map) };
}
const thin = fixture([80, 0, 0, 88, 0, 0, 88, 160, 0, 80, 160, 0]);
const phase = (c: typeof thin) => findSingleWallLanding({ origin: { x: 60, y: 70 }, direction: { x: 1, y: 0 }, maxDistance: 80, bodyHalfWidth: 10, bodyHalfHeight: 10, grid: c.grid, bodyQueries: c.collision, isPhaseableWall: (x, y) => c.grid.getTile(x, y) === TileType.WALL });
assert(phase(thin), 'one 8px solid plane remains phaseable');
assert.equal(phase(fixture([80, 0, 0, 96, 0, 0, 96, 160, 0, 80, 160, 0])), null, 'two planes cannot be exempted');
assert.equal(phase(fixture([80, 0, 0, 88, 0, 0, 88, 160, 0, 80, 160, 0], 'solid', 11)), null, 'phase cannot cross VOID');
const relief = fixture([80, 0, 0, 88, 0, 0, 88, 160, 0, 80, 160, 0], 'relief');
assert(relief.collision.supports({ x: 84, y: 70 }, 10, 10), 'walkable relief is not solid');
// A sparse conservative corner can contain a complete body. Abilities must start
// there, while still stopping at the actual solid part of that same cell.
const corner = fixture([80, 0, 0, 81, 0, 0, 81, 1, 0, 80, 1, 0]);
const origin = { x: 84, y: 70 };
assert(corner.collision.supports(origin, 10, 10));
assert.equal(phase(corner), null, 'a conservative empty corner is not a physical wall to phase through');
assert(!corner.grid.isWalkableAt(origin.x, origin.y));
assert(findSoundLureLanding(origin, { x: 1, y: 0 }, 50, corner.grid, 20, corner.collision));
assert(collectToolRevealSnapshot(origin, 64, corner.grid, [{ x: 108, y: 68 }], [], undefined, corner.collision).enemyPositions.length === 1);
assert(sweepGroundDash({ origin, destination: { x: 130, y: 70 }, grid: corner.grid, bodyQueries: corner.collision }).x === 130);
assert(!corner.collision.supports({ x: 5, y: 50 }, 10, 10));
assert(!corner.collision.supports({ x: NaN, y: 50 }, 10, 10));
const library = R100_NATIVE_WORLDS.map(entry => {
  const world = createR100ProductionMap(createR100ProductionRecipe(entry.id, 20261004, 'severe'));
  const started = performance.now(), collision = new NativeBodyCollision(world.native!, world.layout.tileMap);
  return { id: entry.id, triangles: collision.triangleCount, prepareMs: performance.now() - started, collision, world };
});
const largest = library.reduce((a, b) => a.triangles >= b.triangles ? a : b);
const timings: number[] = [];
for (let i = 0; i < 10000; i++) {
  const angle = i * .345, point = largest.world.layout.spawnPoint;
  const start = performance.now();
  largest.collision.resolveMotion(point, 10, 10, Math.cos(angle) * 1.4, Math.sin(angle) * 1.4, { x: Math.cos(angle) * 80, y: Math.sin(angle) * 80 }, motion);
  timings.push(performance.now() - start);
  assert(largest.collision.supports(motion, 10, 10));
}
timings.sort((a, b) => a - b);
console.log(JSON.stringify({ ok: true, largest: { id: largest.id, triangles: largest.triangles, stepP50Ms: timings[5000], stepP95Ms: timings[9500], stepMaxMs: timings[9999] }, library: library.map(({ id, triangles, prepareMs }) => ({ id, triangles, prepareMs })), results, triangles: collision.triangleCount, prepareMs, sweeps, oldPositions, sweepMs }, null, 2));
