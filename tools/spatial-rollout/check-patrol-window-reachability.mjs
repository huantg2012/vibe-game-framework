/** Small synthetic counterexample for r7 patrol-window admission. No map batch,
 * scene, player state or saved-game mutation; geometry and BFS are independent. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { findR100PatrolWindows } from '../../src/generation/world-study/r100-patrol-windows.ts';
import { TileGrid } from '../../src/systems/tile-grid.ts';
import { bodyHasSupport, bodyDisplacementFraction } from '../../src/systems/ai/physical-grid.ts';
import { INFILTRATOR_FORM } from '../../src/generation/contamination-draw.ts';
import { TileType } from '../../src/types/game-types.ts';

const reportPath = process.argv[2] ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/patrol-window-reachability.json';
assert(!existsSync(reportPath), 'Preserve previous evidence; choose a new report path');
const cols = 160, rows = 24, tileSize = 8;
const rooms = [[1, 35], [65, 83], [135, 158]];
const tiles = Array.from({ length: rows }, (_, y) => Array.from({ length: cols }, (_, x) =>
  y >= 1 && y <= 22 && rooms.some(([left, right]) => x >= left && x <= right) ? TileType.FLOOR : TileType.VOID));
const tileMap = { cols, rows, tileSize, tiles }, grid = new TileGrid(tileMap);
const spawn = { x: 84, y: 92 };
const cellOf = point => Math.floor(point.y / tileSize) * cols + Math.floor(point.x / tileSize);
const center = cell => ({ x: (cell % cols + .5) * tileSize, y: (Math.floor(cell / cols) + .5) * tileSize });
const queue = [cellOf(spawn)], reachable = new Set(queue);
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
for (let i = 0; i < queue.length; i++) {
  const cell = queue[i], point = center(cell), x = cell % cols, y = Math.floor(cell / cols);
  for (const [dx, dy] of directions) {
    const col = x + dx, row = y + dy, next = row * cols + col;
    if (col < 0 || row < 0 || col >= cols || row >= rows || reachable.has(next)) continue;
    const to = center(next);
    if (!bodyHasSupport(grid, to, 10, 10) || bodyDisplacementFraction(grid, point, 10, 10, to.x - point.x, to.y - point.y) !== 1) continue;
    reachable.add(next); queue.push(next);
  }
}
const nodes = [
  { id: 'reachable-station', position: { x: 140, y: 92 } },
  { id: 'isolated-station', position: { x: 596, y: 92 } },
];
assert(bodyHasSupport(grid, nodes[1].position, 10, 10), 'isolated island has legal full-body support');
assert(!reachable.has(cellOf(nodes[1].position)), 'island must remain disconnected');
const world = {
  layout: { tileMap, spawnPoint: spawn },
  sight: { cols, rows, tileSize, version: 0, isOpaque: (col, row) => tiles[row]?.[col] !== TileType.FLOOR },
  pollution: { paintCells: [], volumes: [] },
};
const enemies = [{ id: 'far-moving-patrol', type: 'infiltrator', spawn: { col: 143, row: 11 }, facing: 0,
  patrol: { mode: 'pingpong', waypoints: [{ col: 143, row: 11 }, { col: 153, row: 11 }] }, form: INFILTRATOR_FORM }];
const previousBehavior = findR100PatrolWindows(world, enemies, nodes);
assert.deepEqual(previousBehavior.map(row => row.id), nodes.map(row => row.id), 'fixture must expose a window on the isolated island without a reachability filter');
const allReachableAdapter = findR100PatrolWindows(world, enemies, nodes, () => true);
assert.deepEqual(allReachableAdapter, previousBehavior, 'optional all-true adapter preserves the original model result exactly');
const noReachableAdapter = findR100PatrolWindows(world, enemies, nodes, () => false);
assert.deepEqual(noReachableAdapter, [], 'no reachable station must produce no windows');
const filtered = findR100PatrolWindows(world, enemies, nodes, point => reachable.has(cellOf(point)));
assert.deepEqual(filtered.map(row => row.id), ['reachable-station']);
assert.deepEqual(filtered[0], previousBehavior[0], 'reachability filtering preserves timing and seat for the reachable node');
for (const window of filtered) assert(reachable.has(cellOf(window.seat)));
const executorPath = 'src/generation/legacy-r100-v6/executor-recovery.js';
const executor = readFileSync(executorPath);
const executorHash = createHash('sha256').update(executor).digest('hex');
const manifest = JSON.parse(readFileSync('src/generation/legacy-r100-v6/manifest-recovery.json', 'utf8'));
assert.equal(executorHash, manifest.executorSha256, 'r6 remains its committed freeze-tool output');
assert.equal(executorHash, 'f4b1b49689381e990825db75f9f64cd4061e31c030669d66002413f3bc0087fe', 'r7 window fix must not edit r6 recovery bytes');
const sourcePaths = ['src/generation/world-study/r100-patrol-windows.ts', 'src/generation/world-study/r100-expedition.ts',
  'src/systems/ai/physical-grid.ts', 'tools/spatial-rollout/check-patrol-window-reachability.mjs', executorPath];
const report = { status: 'passed', finishedAt: new Date().toISOString(), environment: { node: process.version, platform: process.platform },
  scope: 'Synthetic three-island geometry, independent eight-way full-body BFS, optional patrol-window reachability adapter. Not production-map sampling, live pursuit or whole-save compatibility.',
  reachableSeats: reachable.size, previousBehavior, allReachableAdapter, noReachableAdapter, filtered, legacyRevision6Sha256: executorHash,
  sourceHashes: Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])) };
mkdirSync(dirname(reportPath), { recursive: true });
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
console.log('PASS isolated station rejected; reachable station and all-true adapter preserve exact timing/seat; r6 frozen bytes unchanged');
