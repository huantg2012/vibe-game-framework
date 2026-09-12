import assert from 'node:assert/strict';
import { SpatialSliceWorld } from '../../src/dev/spatial-study/slice-world';
import { createStageSightGrid } from '../../src/dev/spatial-study/stage/sight-grid';
import { TileGrid } from '../../src/systems/tile-grid';
import { AIState, TileType, type Vector2 } from '../../src/types/game-types';
import type { TileMapData } from '../../src/types/map-types';
import { castRay, createRayHit, hasClearPath, hasLineOfSight } from '../../src/utils/grid-raycast';
import { GridPathfinder } from '../../src/systems/pathfinding';
import { bodyDisplacementFraction, createMovementOccluders } from '../../src/systems/ai/physical-grid';
import { updateBehavior } from '../../src/systems/ai/behaviors';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw';
import type { AIContext } from '../../src/systems/ai/context';
import type { Enemy } from '../../src/entities/enemy-factory';

let passed = 0;
function check(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
const world = new SpatialSliceWorld(7);
function fixture(rows: string[]): { grid: TileGrid; map: TileMapData } {
  const map = { cols: rows[0]!.length, rows: rows.length, tileSize: 32,
    tiles: rows.map(row => [...row].map(tile => tile === '#' ? TileType.WALL : tile === ' ' ? TileType.VOID : TileType.FLOOR)) };
  return { grid: new TileGrid(map), map };
}
const grid = new TileGrid(world.layout.tileMap), sight = createStageSightGrid(world.layout, grid);
const movement = createMovementOccluders(grid);
const west = { x: 432, y: 336 }, east = { x: 592, y: 336 }, air = { x: 496, y: 336 };

check('Stage optical grid exposes only an OccluderGrid and leaves every physical tile unchanged', () => {
  assert.equal(sight.cols, grid.cols); assert.equal(sight.rows, grid.rows); assert.equal(sight.tileSize, grid.tileSize);
  assert.equal(sight.version, grid.version); assert.equal('isWalkable' in sight, false);
  assert.equal('getTile' in sight, false);
  assert.equal(grid.isWalkableAt(air.x, air.y), false);
  assert.equal(grid.isOpaque(Math.floor(air.x / 32), Math.floor(air.y / 32)), true);
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) {
    assert.equal(grid.getTile(c, r), world.layout.tileMap.tiles[r]![c]);
    assert.equal(movement.isOpaque(c, r), !grid.isWalkable(c, r));
  }
});

check('real seed-7 narrow gap admits reciprocal sight and air queries but no physical corridor', () => {
  assert.ok(hasLineOfSight(sight, west, east)); assert.ok(hasLineOfSight(sight, east, west));
  assert.ok(hasLineOfSight(sight, west, air)); assert.ok(hasLineOfSight(sight, air, west));
  assert.ok(!hasLineOfSight(grid, west, east)); assert.ok(!hasClearPath(movement, west, east, 20));
  assert.ok(!hasLineOfSight(sight, west, east, 159), 'sight transparency cannot extend range');
  const hit = castRay(sight, west, 0, 100, createRayHit());
  assert.equal(hit.hit, false); assert.equal(hit.dist, 100);
});

check('real walls, exterior void, map edges and diagonal wall seams stay opaque', () => {
  const f = fixture(['       ', ' ..... ', ' .#... ', ' .. .. ', ' ..... ', ' ..... ', '       ']);
  const optical = createStageSightGrid({ ...world.layout, tileMap: f.map }, f.grid);
  assert.equal(optical.isOpaque(3, 3), false); assert.equal(optical.isOpaque(2, 2), true);
  for (const [c, r] of [[0, 3], [3, 0], [-1, 3], [7, 2]]) assert.equal(optical.isOpaque(c!, r!), true);
  assert.equal(hasLineOfSight(optical, { x: 48, y: 80 }, { x: 112, y: 80 }), false);
  f.grid.setTile(3, 1, TileType.WALL);
  assert.equal(hasLineOfSight(optical, { x: 80, y: 48 }, { x: 112, y: 80 }), false);
});

check('live physical edits invalidate internal/exterior classification and all grid versions agree', () => {
  const f = fixture(['       ', ' ..... ', ' ..... ', ' .. .. ', ' ..... ', ' ..... ', '       ']);
  const optical = createStageSightGrid({ ...world.layout, tileMap: f.map }, f.grid);
  const physical = createMovementOccluders(f.grid);
  assert.equal(optical.isOpaque(3, 3), false);
  for (const row of [2, 1]) f.grid.setTile(3, row, TileType.VOID);
  assert.equal(optical.version, 2); assert.equal(optical.version, physical.version);
  assert.equal(optical.isOpaque(3, 3), true, 'an opening to the outer void is no longer an internal air pocket');
  f.grid.setTile(3, 1, TileType.FLOOR);
  assert.equal(optical.isOpaque(3, 3), false); assert.equal(optical.version, 3);
  f.grid.setTile(3, 3, TileType.WALL); assert.equal(optical.isOpaque(3, 3), true);
  f.grid.setTile(3, 3, TileType.FLOOR); assert.equal(optical.isOpaque(3, 3), false);
  assert.equal(f.map.tiles[3]![3], TileType.VOID, 'neither view mutates the generated layout');
});

check('new Stage/default/Stage instances cannot leak an optical mode or region cache', () => {
  const second = new TileGrid(world.layout.tileMap), firstVersion = grid.version;
  const secondSight = createStageSightGrid(world.layout, second);
  second.setTile(15, 10, TileType.WALL);
  assert.equal(secondSight.isOpaque(15, 10), true);
  assert.equal(sight.isOpaque(15, 10), false); assert.equal(grid.version, firstVersion);
  const defaultGrid = new TileGrid(world.layout.tileMap);
  assert.equal(hasLineOfSight(defaultGrid, west, east), false);
  const finalGrid = new TileGrid(world.layout.tileMap), finalSight = createStageSightGrid(world.layout, finalGrid);
  assert.equal(hasLineOfSight(finalSight, west, east), true); assert.equal(finalSight.version, 0);
});

const points: Vector2[] = Array.from({ length: 32 }, () => ({ x: 0, y: 0 }));
check('path smoothing follows the shore instead of turning an optical shortcut into a walking route', () => {
  const pathfinder = new GridPathfinder(grid, movement, 20);
  const count = pathfinder.findPath(west, east, points, 2000);
  assert.ok(count >= 3); assert.deepEqual(points.slice(0, count), [{ x: 432, y: 304 }, { x: 592, y: 304 }, east]);
  let anchor = west;
  for (let i = 0; i < count; i++) { assert.ok(hasClearPath(movement, anchor, points[i]!, 20)); anchor = points[i]!; }
});

check('actual chase behavior preserves the physical detour even while seeing the target across air', () => {
  const ai = { state: AIState.CHASE, position: { ...west }, velocity: { x: 0, y: 0 },
    facingAngle: 0, facing4: 'right', losGraceMs: 0, targetingDecoy: false, engaged: false,
    lastSeenPlayerPos: { ...east }, preferPathMs: 0, externalSpeedMult: 1, movementDirLocked: false,
    pathPoints: points, pathLength: 3, pathCursor: 0, pathTargetAtRequest: { ...east }, pathRequestTarget: { ...east } };
  const enemy = { id: 'air-sight-test', ai, getForm: () => INFILTRATOR_FORM,
    config: { speeds: { [AIState.CHASE]: 80 } },
    setVelocity(x: number, y: number) { ai.velocity.x = x; ai.velocity.y = y; } } as unknown as Enemy;
  const ctx = { occluders: sight, movementOccluders: movement, enemies: [enemy],
    playerPos: east, playerVel: { x: 0, y: 0 }, dtMs: 16, decoyPos: null } as unknown as AIContext;
  updateBehavior(enemy, ctx);
  assert.equal(ai.pathPoints, points); assert.equal(ai.pathCursor, 0);
  assert.equal(ai.velocity.x, 0); assert.ok(ai.velocity.y < 0, 'follow the northward first leg, not east through the gap');
});

check('continuous AABB displacement stops before void, wall and map edge, including a legal far endpoint', () => {
  const f = fixture(['#####', '#...#', '#. .#', '#...#', '#####']);
  const from = { x: 48, y: 80 }, dx = 64;
  assert.equal(f.grid.isWalkableAt(from.x + dx, from.y), true);
  const fraction = bodyDisplacementFraction(f.grid, from, 10, 6, dx, 0);
  const finalX = from.x + dx * fraction;
  assert.ok(finalX <= 54 && finalX >= 53.99, 'body edge, not sprite origin, stops at the hole');
  assert.equal(bodyDisplacementFraction(f.grid, { x: 48, y: 48 }, 10, 6, 32, 0), 1);
  assert.ok(bodyDisplacementFraction(f.grid, { x: 48, y: 48 }, 10, 6, -64, 0) < .1);
  assert.ok(bodyDisplacementFraction(f.grid, { x: 48, y: 48 }, 10, 6, 64, 64) < .2,
    'diagonal sweeping cannot clip the corner with a body whose centre ray still fits');
  assert.equal(bodyDisplacementFraction(f.grid, { x: 42, y: 48 }, 10, 6, 10, 0), 1, 'can leave a flush wall');
  assert.equal(bodyDisplacementFraction(f.grid, from, 10, 6, NaN, 1), 0);
  // For a sprite whose body is offset, apply the allowed centre delta to its own
  // origin. Overwriting the sprite with the AABB centre would change its footprint.
  const spriteX = from.x - 3, spriteY = from.y + 5;
  assert.equal((spriteX + dx * fraction) - finalX, -3); assert.equal(spriteY - from.y, 5);
});

console.log(`${passed} Stage sight / physical separation checks passed.`);
