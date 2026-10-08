/** DEV admission adapter. Terrain is borrowed verbatim; all actors use native rules. */
import { GAME_CONSTANTS } from '@/config/constants';
import { BUILD_LAB_PLACEMENTS } from '@/generated/build-lab-data';
import { supportsRuntimeForm, type ContaminationForm } from '@/generation/contamination-draw';
import { measureOutline } from '@/generation/outline-mask';
import type { GeneratedRiftLayout } from '@/generation/types';
import { bodyDisplacementFraction, bodyHasSupport } from '@/systems/ai/physical-grid';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type Vector2 } from '@/types/game-types';
import type { ContaminantNodeDef, EnemySpawnData, KindlingNodeDef, KindlingTier } from '@/types/map-types';
import { generateWorldSample } from './layout';
import { SPACE_PROFILES } from './space-profile';
import { getWorldSupportGrid } from './support';
import type { WorldSample } from './types';

const HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
const MAX_ATTEMPTS = 8;
const RETRY_STRIDE = 104729;
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
export interface WorldPlayMap {
  readonly sample: WorldSample;
  readonly layout: GeneratedRiftLayout;
  readonly bodySeats: Uint8Array;
  readonly metadata: {
    readonly world: string; readonly space: string;
    readonly requestedSeed: number; readonly effectiveSeed: number; readonly attempt: number;
    readonly rejected: readonly { seed: number; reason: string }[];
    readonly signature: string; readonly bodySize: number; readonly supportTileSize: number;
    readonly reachableBodySeats: number; readonly extractionRoutePx: number;
    readonly encounterSource: string;
  };
}

function center(grid: TileGrid, cell: number): Vector2 {
  return { x: (cell % grid.cols + .5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + .5) * grid.tileSize };
}
function nearest(grid: TileGrid, seats: Uint8Array, point: Readonly<Vector2>): number {
  let best = -1, distance = Infinity;
  for (let cell = 0; cell < seats.length; cell++) {
    if (!seats[cell]) continue;
    const p = center(grid, cell), d = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
    if (d < distance) { best = cell; distance = d; }
  }
  if (best < 0) throw new Error('No 20px body-supported seat');
  return best;
}
function flood(grid: TileGrid, seats: Uint8Array, start: number, halfBody = HALF_BODY) {
  const parent = new Int32Array(seats.length).fill(-1), distances = new Int32Array(seats.length).fill(-1);
  const queue: number[] = [start]; parent[start] = start; distances[start] = 0;
  for (let at = 0; at < queue.length; at++) {
    const cell = queue[at]!, col = cell % grid.cols, row = Math.floor(cell / grid.cols), p = center(grid, cell);
    for (const [dx, dy] of DIRECTIONS) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || parent[next] !== -1) continue;
      if (bodyDisplacementFraction(grid, p, halfBody, halfBody, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
      parent[next] = cell; distances[next] = distances[cell]! + 1; queue.push(next);
    }
  }
  return { parent, distances, queue };
}
function pathCells(parent: Int32Array, end: number): number[] {
  if (parent[end] === -1) throw new Error('Target has no 20px body route');
  const result = [end];
  while (parent[result[result.length - 1]!] !== result[result.length - 1]) result.push(parent[result[result.length - 1]!]!);
  return result.reverse();
}

/** Read-only QA route, computed with the same native swept body admission. */
export function findWorldPlayRoute(map: WorldPlayMap, from: Readonly<Vector2>, to: Readonly<Vector2>): Vector2[] {
  const grid = new TileGrid(map.layout.tileMap);
  const start = nearest(grid, map.bodySeats, from), end = nearest(grid, map.bodySeats, to);
  const cells = pathCells(flood(grid, map.bodySeats, start).parent, end);
  // Keep bends and endpoints; this does not smooth corners across missing support.
  return cells.filter((cell, i) => i === 0 || i === cells.length - 1 || cell - cells[i - 1]! !== cells[i + 1]! - cell)
    .map(cell => center(grid, cell));
}

function admit(sample: WorldSample, requestedSeed: number, space: string, attempt: number,
  rejected: readonly { seed: number; reason: string }[]): WorldPlayMap {
  const support = getWorldSupportGrid(sample), { cols, rows, tileSize, walkable } = support;
  const tiles = Array.from({ length: rows }, (_, row) => Array.from({ length: cols }, (_, col) =>
    walkable[row * cols + col] ? TileType.FLOOR : TileType.VOID));
  const tileMap = { cols, rows, tileSize, tiles }, grid = new TileGrid(tileMap);
  const bodySeats = Uint8Array.from(walkable, (floor, cell) => floor && bodyHasSupport(grid, center(grid, cell), HALF_BODY, HALF_BODY) ? 1 : 0);
  const spawn = nearest(grid, bodySeats, sample.spawn), exit = nearest(grid, bodySeats, sample.exit);
  const spawnPoint = center(grid, spawn), exitPoint = center(grid, exit);
  if (Math.hypot(spawnPoint.x - sample.spawn.x, spawnPoint.y - sample.spawn.y) > tileSize
    || Math.hypot(exitPoint.x - sample.exit.x, exitPoint.y - sample.exit.y) > tileSize)
    throw new Error('Original spawn/extraction lacks nearby 20px body support');
  const paths = flood(grid, bodySeats, spawn);
  if (paths.parent[exit] === -1) throw new Error('Original extraction disconnected for 20px body');
  const main = pathCells(paths.parent, exit), routePx = (main.length - 1) * tileSize;
  if (routePx < 320) throw new Error('Route too short for the minimal outing');
  const reachable = Uint8Array.from(paths.parent, value => value >= 0 ? 1 : 0);
  const used = [spawnPoint, exitPoint];
  const seatNear = (point: Vector2, spacing: number, minSpawn = 0, minExit = 0): number => {
    let best = -1, score = Infinity;
    for (const cell of paths.queue) {
      const p = center(grid, cell);
      if (Math.hypot(p.x - spawnPoint.x, p.y - spawnPoint.y) < minSpawn
        || Math.hypot(p.x - exitPoint.x, p.y - exitPoint.y) < minExit
        || used.some(value => Math.hypot(value.x - p.x, value.y - p.y) < spacing)) continue;
      const value = (p.x - point.x) ** 2 + (p.y - point.y) ** 2;
      if (value < score) { best = cell; score = value; }
    }
    if (best < 0) throw new Error('Insufficient separated body-safe deployment seats');
    used.push(center(grid, best)); return best;
  };
  const along = (ratio: number): Vector2 => center(grid, main[Math.round((main.length - 1) * ratio)]!);
  const sourceRows = BUILD_LAB_PLACEMENTS.filter(row => row.scene === 'watched');
  const kindlingNodes: KindlingNodeDef[] = [], contaminantNodes: ContaminantNodeDef[] = [];
  const lootPoints: Vector2[] = [];
  let deep = 0;
  for (const row of sourceRows.filter(row => row.kind === 'kindling' || row.kind === 'contaminant')) {
    const ratio = row.tier === 'safe' ? .14 : row.tier === 'contested' ? .46 : .7 + deep++ * .14;
    const anchor = along(ratio), previous = along(Math.max(0, ratio - .04));
    const length = Math.hypot(anchor.x - previous.x, anchor.y - previous.y) || 1;
    const offset = row.tier === 'safe' ? 0 : 80;
    const cell = seatNear({ x: anchor.x - (anchor.y - previous.y) / length * offset,
      y: anchor.y + (anchor.x - previous.x) / length * offset }, 88);
    const position = center(grid, cell); lootPoints.push(position);
    const node = { id: `WP_${row.id}`, tier: row.tier as KindlingTier, position };
    if (row.kind === 'kindling') kindlingNodes.push(node); else contaminantNodes.push(node);
  }
  const forms: ContaminationForm[] = [], enemySpawns: EnemySpawnData[] = [];
  for (const row of sourceRows.filter(row => row.kind === 'enemy')) {
    const form: ContaminationForm = { substrate: row.substrate, coverage: row.coverage as ContaminationForm['coverage'],
      continuity: 'monolith', portfolio: 'jia', occupancy: 'floor',
      lexemes: { motion: row.motion, sense: row.sense, rhythm: row.rhythm, contact: row.contact } };
    if (!supportsRuntimeForm(form)) throw new Error(`Unsupported CSV form ${row.id}`);
    const cell = seatNear(lootPoints[forms.length === 0 ? 1 : 2]!, 64, 300, 224), position = center(grid, cell);
    const patrolFlood = flood(grid, bodySeats, cell);
    const patrolEnd = patrolFlood.queue.filter(value => patrolFlood.distances[value]! >= 12
      && patrolFlood.distances[value]! <= 16 && Math.hypot(center(grid, value).x - exitPoint.x, center(grid, value).y - exitPoint.y) >= 224)
      .sort((a, b) => Math.hypot(center(grid, a).x - position.x, center(grid, a).y - position.y)
        - Math.hypot(center(grid, b).x - position.x, center(grid, b).y - position.y)).pop();
    if (patrolEnd === undefined) throw new Error('Enemy has no body-safe patrol segment');
    // All bends remain explicit waypoints; the native AI still owns traversal.
    const patrol = pathCells(patrolFlood.parent, patrolEnd).filter((value, i, all) =>
      i === 0 || i === all.length - 1 || value - all[i - 1]! !== all[i + 1]! - value);
    enemySpawns.push({ id: `WP_${row.id}`, type: row.sense === 'sense_hear' ? 'rewriter' : 'infiltrator',
      spawn: { col: cell % cols, row: Math.floor(cell / cols) }, facing: row.facing,
      patrol: { mode: 'pingpong', waypoints: patrol.map(value => ({ col: value % cols, row: Math.floor(value / cols) })) }, form });
    forms.push(form);
  }
  if (forms.filter(form => form.lexemes.sense === 'sense_hear').length !== 1) throw new Error('Expected exactly one hearing form');
  const fragmentTypeId = `world-study:${sample.profile.id}`;
  const land = walkable.slice(), walls = new Uint8Array(land.length);
  const outline = { seed: sample.seed, attempt, cols, rows, tileSize, land, tileMap, metrics: measureOutline(land, cols, rows) };
  const layout: GeneratedRiftLayout = { seed: sample.seed, fragmentTypeId, recipeId: `world-study:${space}`,
    contaminationAge: 'new', ruinSeverity: 'broken', tileMap,
    ruins: { seed: sample.seed, attempt, fragmentTypeId, outline, walls, features: [], tileMap,
      metrics: { wallCount: 0, wallRatio: 0, featureCount: 0, leftoverConnected: flood(grid, walkable, spawn, 0).queue.length === outline.metrics.landCount } },
    walkableMask: grid, spawnPoint, extractionPoint: { id: 'WP_exit', position: exitPoint, triggerRadius: GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS },
    kindlingNodes, contaminantNodes, enemySpawns, landmarks: [],
    contaminationPins: { wallEdges: [], paintFloors: [], corridorAabbs: [] }, contaminationDraw: { forms, warnings: [] } };
  let hash = 2166136261;
  for (const value of walkable) hash = Math.imul(hash ^ value, 16777619);
  const definition = JSON.stringify({ profile: sample.profile, space, spawnPoint, exitPoint, kindlingNodes, contaminantNodes, enemySpawns });
  for (let i = 0; i < definition.length; i++) hash = Math.imul(hash ^ definition.charCodeAt(i), 16777619);
  return { sample, layout, bodySeats: reachable, metadata: { world: sample.profile.id, space, requestedSeed,
    effectiveSeed: sample.seed, attempt, rejected: [...rejected], signature: (hash >>> 0).toString(16).padStart(8, '0'),
    bodySize: HALF_BODY * 2, supportTileSize: tileSize, reachableBodySeats: paths.queue.length,
    extractionRoutePx: routePx, encounterSource: 'data/build-lab-placements.csv: watched; procedural body-safe seats' } };
}

export function createWorldPlayMap(world: string, spaceId: string, requestedSeed: number): WorldPlayMap {
  if (!Number.isSafeInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 0xffffffff) throw new Error('Seed must be an unsigned 32-bit integer');
  const space = SPACE_PROFILES.find(value => value.id === spaceId);
  if (!space) throw new Error(`Unknown space ${spaceId}`);
  const rejected: { seed: number; reason: string }[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = (requestedSeed + attempt * RETRY_STRIDE) >>> 0;
    try { return admit(generateWorldSample(world, 'loops', seed, space), requestedSeed, spaceId, attempt, rejected); }
    catch (reason) { rejected.push({ seed, reason: reason instanceof Error ? reason.message : String(reason) }); }
  }
  throw new Error(`World play admission failed after ${MAX_ATTEMPTS} explicit candidates: ${JSON.stringify(rejected)}`);
}
