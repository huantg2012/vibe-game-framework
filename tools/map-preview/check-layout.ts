/**
 * Machine gate for C3 generateRiftLayout. No Phaser scene.
 *
 *   npm run check:layout
 *
 * Dual path / sight≤14 / empty-rect 48 are NOT fatal.
 */
import { countWalkableComponents } from '../../src/generation/connectivity.ts';
import {
  LIVE_PAINT_PX_PER_TILE,
  paintSkyShade,
  skyOverlaySize,
} from '../../src/generation/preview-paint.ts';
import { generateRiftLayout } from '../../src/generation/rift-layout.ts';
import { RIFT_MAP } from '../../src/scenes/rift-map-data.ts';
import { TileType } from '../../src/types/game-types.ts';
import type { GeneratedRiftLayout } from '../../src/generation/types.ts';
import type { TileMapData } from '../../src/types/map-types.ts';

const SEEDS = [3, 11, 29, 47, 73, 101, 211, 409] as const;
const EXTRACT_EPS = 1;
const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

let failed = 0;

function assert(cond: unknown, msg: string): void {
  if (cond) return;
  failed++;
  console.error(`FAIL ${msg}`);
}

function landWalls(map: TileMapData): { land: Uint8Array; walls: Uint8Array } {
  const land = new Uint8Array(map.cols * map.rows);
  const walls = new Uint8Array(map.cols * map.rows);
  for (let row = 0; row < map.rows; row++) {
    for (let col = 0; col < map.cols; col++) {
      const t = map.tiles[row]![col]!;
      const i = row * map.cols + col;
      if (t !== TileType.VOID) land[i] = 1;
      if (t === TileType.WALL) walls[i] = 1;
    }
  }
  return { land, walls };
}

function wallCount(map: TileMapData): number {
  let n = 0;
  for (const row of map.tiles) {
    for (const t of row) if (t === TileType.WALL) n++;
  }
  return n;
}

function tileOf(layout: GeneratedRiftLayout, pos: { x: number; y: number }): { col: number; row: number } {
  const tile = layout.tileMap.tileSize;
  return { col: Math.floor(pos.x / tile), row: Math.floor(pos.y / tile) };
}

function floodFrom(
  layout: GeneratedRiftLayout,
  startCol: number,
  startRow: number,
): Uint8Array {
  const { cols, rows } = layout.walkableMask;
  const seen = new Uint8Array(cols * rows);
  if (!layout.walkableMask.isWalkable(startCol, startRow)) return seen;
  const stack = [startRow * cols + startCol];
  seen[stack[0]!] = 1;
  while (stack.length > 0) {
    const cur = stack.pop()!;
    const col = cur % cols;
    const row = (cur / cols) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = col + dx;
      const ny = row + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (seen[ni] || !layout.walkableMask.isWalkable(nx, ny)) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return seen;
}

function hasAltPath(layout: GeneratedRiftLayout): boolean {
  const spawn = tileOf(layout, layout.spawnPoint);
  const extract = tileOf(layout, layout.extractionPoint.position);
  const { cols, rows } = layout.walkableMask;
  const walk = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (layout.walkableMask.isWalkable(col, row)) walk[row * cols + col] = 1;
    }
  }
  const dist = new Int32Array(walk.length).fill(-1);
  const parent = new Int32Array(walk.length).fill(-1);
  const start = spawn.row * cols + spawn.col;
  const goal = extract.row * cols + extract.col;
  dist[start] = 0;
  const queue = [start];
  let q = 0;
  while (q < queue.length) {
    const cur = queue[q++]!;
    const col = cur % cols;
    const row = (cur / cols) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = col + dx;
      const ny = row + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = dist[cur]! + 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }
  if (dist[goal]! < 0) return false;
  const blocked = new Uint8Array(walk);
  let cur = goal;
  while (cur !== start && cur >= 0) {
    if (cur !== start && cur !== goal) blocked[cur] = 0;
    cur = parent[cur]!;
  }
  const seen = new Uint8Array(blocked.length);
  const stack = [start];
  seen[start] = 1;
  while (stack.length > 0) {
    const i = stack.pop()!;
    if (i === goal) return true;
    const col = i % cols;
    const row = (i / cols) | 0;
    for (const [dx, dy] of DIRS4) {
      const nx = col + dx;
      const ny = row + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (!blocked[ni] || seen[ni]) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return false;
}

const forbidden = RIFT_MAP.layout.extractionPoint.position;
let altHits = 0;

for (const seed of SEEDS) {
  const layout = generateRiftLayout(seed);
  const { land, walls } = landWalls(layout.tileMap);
  const components = countWalkableComponents(land, walls, layout.tileMap.cols, layout.tileMap.rows);
  assert(components === 1, `seed ${seed}: walkable components = ${components}`);
  assert(layout.seed === seed, `seed ${seed}: layout.seed ${layout.seed}`);
  assert(layout.extractionPoint && layout.extractionPoint.position, `seed ${seed}: missing extract`);
  assert(
    Math.abs(layout.extractionPoint.position.x - forbidden.x) >= EXTRACT_EPS ||
      Math.abs(layout.extractionPoint.position.y - forbidden.y) >= EXTRACT_EPS,
    `seed ${seed}: extract matches handwritten X`,
  );

  const spawnT = tileOf(layout, layout.spawnPoint);
  const extractT = tileOf(layout, layout.extractionPoint.position);
  assert(layout.walkableMask.isWalkable(spawnT.col, spawnT.row), `seed ${seed}: spawn not walkable`);
  assert(
    layout.walkableMask.isWalkable(extractT.col, extractT.row),
    `seed ${seed}: extract not walkable`,
  );
  const reach = floodFrom(layout, spawnT.col, spawnT.row);
  assert(reach[extractT.row * layout.walkableMask.cols + extractT.col] === 1, `seed ${seed}: spawn cannot reach extract`);

  const byTier = { safe: 0, contested: 0, deep: 0 };
  for (const node of layout.kindlingNodes) byTier[node.tier]++;
  assert(byTier.safe === 3, `seed ${seed}: safe kindling ${byTier.safe}`);
  assert(byTier.contested === 3, `seed ${seed}: contested kindling ${byTier.contested}`);
  assert(byTier.deep === 2, `seed ${seed}: deep kindling ${byTier.deep}`);
  assert(layout.contaminantNodes.length === 3, `seed ${seed}: contaminants ${layout.contaminantNodes.length}`);
  assert(
    layout.enemySpawns.length >= 3 && layout.enemySpawns.length <= 4,
    `seed ${seed}: patrols ${layout.enemySpawns.length}`,
  );

  const checkReach = (label: string, pos: { x: number; y: number }): void => {
    const t = tileOf(layout, pos);
    assert(layout.walkableMask.isWalkable(t.col, t.row), `seed ${seed}: ${label} not walkable`);
    assert(reach[t.row * layout.walkableMask.cols + t.col] === 1, `seed ${seed}: ${label} unreachable from spawn`);
  };
  for (const node of layout.kindlingNodes) checkReach(node.id, node.position);
  for (const node of layout.contaminantNodes) checkReach(node.id, node.position);
  for (const enemy of layout.enemySpawns) {
    for (let i = 0; i < enemy.patrol.waypoints.length; i++) {
      const wp = enemy.patrol.waypoints[i]!;
      assert(layout.walkableMask.isWalkable(wp.col, wp.row), `seed ${seed}: ${enemy.id} wp ${i} not walkable`);
      assert(
        reach[wp.row * layout.walkableMask.cols + wp.col] === 1,
        `seed ${seed}: ${enemy.id} wp ${i} unreachable from spawn`,
      );
    }
  }

  const again = generateRiftLayout(seed);
  assert(again.fragmentTypeId === layout.fragmentTypeId, `seed ${seed}: fragmentTypeId drifted`);
  assert(again.spawnPoint.x === layout.spawnPoint.x && again.spawnPoint.y === layout.spawnPoint.y, `seed ${seed}: spawn drifted`);
  assert(
    again.extractionPoint.position.x === layout.extractionPoint.position.x &&
      again.extractionPoint.position.y === layout.extractionPoint.position.y,
    `seed ${seed}: extract drifted`,
  );
  assert(wallCount(again.tileMap) === wallCount(layout.tileMap), `seed ${seed}: wall count drifted`);

  if (hasAltPath(layout)) altHits++;
  console.log(
    `ok seed ${seed} frag=${layout.fragmentTypeId} recipe=${layout.recipeId} patrols=${layout.enemySpawns.length} walls=${wallCount(layout.tileMap)}`,
  );
}

console.log(`info dual-path ${altHits}/${SEEDS.length} (soft, not fatal)`);

{
  const layout = generateRiftLayout(101);
  const field = layout.ruins.atmosphere;
  assert(field, 'seed 101: missing atmosphere field');
  if (field) {
    const W = layout.ruins.outline.cols * LIVE_PAINT_PX_PER_TILE;
    const H = layout.ruins.outline.rows * LIVE_PAINT_PX_PER_TILE;
    const size = skyOverlaySize(W, H, LIVE_PAINT_PX_PER_TILE);
    const dim = new Uint8Array(size.width * size.height * 4);
    const rim = new Uint8Array(size.width * size.height * 4);
    const t0 = performance.now();
    paintSkyShade(field, W, H, LIVE_PAINT_PX_PER_TILE, 0.5, 0.35, dim, rim);
    const ms = performance.now() - t0;
    assert(
      ms < 80,
      `sky overlay ${ms.toFixed(1)}ms (budget 80ms; live path must not composite the full map)`,
    );
    console.log(`info sky-overlay ${size.width}x${size.height} ${ms.toFixed(1)}ms`);
  }
}

if (failed > 0) {
  console.error(`check:layout failed (${failed})`);
  process.exit(1);
}
console.log(`check:layout passed (${SEEDS.length} seeds)`);
