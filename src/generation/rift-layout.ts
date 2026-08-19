/**
 * C3: place spawn, one extract, kindling, contaminants and patrols on a
 * recipe-stack island. Does not switch generators. Does not punch walls to
 * invent a second path. Spec 21 dual-path is a hard gate: fail and retry
 * the island.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { ENEMY_DATA } from '@/generated/enemy-data';
import { ENABLED_RIFT_FRAGMENTS } from '@/generated/rift-fragment-data';
import { generateRecipeDraft } from '@/generation/draft-pipeline';
import { evaluateDualPath } from '@/generation/dual-path';
import { rollFragmentAxes } from '@/generation/fragment-roll';
import { PREVIEW_RECIPES, jitterRecipe, type MapRecipe } from '@/generation/recipes';
import { mix32 } from '@/generation/seed-fork';
import type { GeneratedRiftLayout, WalkableMask } from '@/generation/types';
import { RIFT_MAP } from '@/scenes/rift-map-data';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type Vector2 } from '@/types/game-types';
import type {
  ContaminantNodeDef,
  EnemySpawnData,
  KindlingNodeDef,
  KindlingTier,
  LandmarkDef,
} from '@/types/map-types';
import { hasLineOfSight } from '@/utils/grid-raycast';
import { SeededRandom } from '@/utils/random';

const MAX_ISLAND_ATTEMPTS = 32;
const MAX_PLACE_ATTEMPTS = 20;
const SIGHT_PX = ENEMY_DATA.infiltrator.sightRange;
const TILE = GAME_CONSTANTS.TILE_SIZE;
const EXTRACT_EPS = 1;
const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const LANDMARK_STYLES: readonly LandmarkDef['style'][] = [
  'pool',
  'scratches',
  'rubble',
  'crack',
  'scorch',
  'crystals',
  'bloodtrail',
  'rune',
];

const forbiddenExtract = RIFT_MAP.layout.extractionPoint.position;

function at(cols: number, col: number, row: number): number {
  return row * cols + col;
}

function inBounds(cols: number, rows: number, col: number, row: number): boolean {
  return col >= 0 && row >= 0 && col < cols && row < rows;
}

function worldOf(col: number, row: number): Vector2 {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function sameWorld(a: Vector2, b: Vector2): boolean {
  return Math.abs(a.x - b.x) < EXTRACT_EPS && Math.abs(a.y - b.y) < EXTRACT_EPS;
}

function colOf(cols: number, i: number): number {
  return i % cols;
}

function rowOf(cols: number, i: number): number {
  return (i / cols) | 0;
}

function pickRecipe(seed: number, islandAttempt: number): MapRecipe {
  const enabledIds = new Set(ENABLED_RIFT_FRAGMENTS.map((row) => row.id));
  const live = PREVIEW_RECIPES.filter((recipe) => enabledIds.has(recipe.fragmentTypeId));
  if (live.length === 0) throw new Error('pickRecipe: no enabled fragment recipes');

  const types: string[] = [];
  for (const recipe of live) {
    if (!types.includes(recipe.fragmentTypeId)) types.push(recipe.fragmentTypeId);
  }
  const typeId = types[new SeededRandom(mix32(seed, 'fragment-type')).nextInt(0, types.length - 1)]!;
  const ofType = live.filter((recipe) => recipe.fragmentTypeId === typeId);
  const pool = islandAttempt < 6 && ofType.length > 0 ? ofType : live;
  const anchor = pool[new SeededRandom(mix32(seed, `recipe:${islandAttempt}`)).nextInt(0, pool.length - 1)]!;
  return jitterRecipe(anchor, islandSeed(seed, islandAttempt));
}

function islandSeed(seed: number, islandAttempt: number): number {
  if (islandAttempt === 0) return seed >>> 0;
  return mix32(seed, `island:${islandAttempt}`);
}

function walkBits(grid: TileGrid): Uint8Array {
  const bits = new Uint8Array(grid.cols * grid.rows);
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.isWalkable(col, row)) bits[at(grid.cols, col, row)] = 1;
    }
  }
  return bits;
}

function wallBits(grid: TileGrid): Uint8Array {
  const bits = new Uint8Array(grid.cols * grid.rows);
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      if (grid.getTile(col, row) === TileType.WALL) bits[at(grid.cols, col, row)] = 1;
    }
  }
  return bits;
}

function bfs(
  walk: Uint8Array,
  cols: number,
  rows: number,
  start: number,
): { dist: Int32Array; parent: Int32Array } {
  const dist = new Int32Array(walk.length).fill(-1);
  const parent = new Int32Array(walk.length).fill(-1);
  if (start < 0 || start >= walk.length || !walk[start]) return { dist, parent };
  const queue = [start];
  dist[start] = 0;
  let q = 0;
  while (q < queue.length) {
    const cur = queue[q++]!;
    const col = colOf(cols, cur);
    const row = rowOf(cols, cur);
    const d = dist[cur]!;
    for (const [dx, dy] of DIRS4) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds(cols, rows, nx, ny)) continue;
      const ni = at(cols, nx, ny);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      parent[ni] = cur;
      queue.push(ni);
    }
  }
  return { dist, parent };
}

function farthest(dist: Int32Array): number {
  let best = -1;
  let bestD = -1;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]!;
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

function reconstruct(parent: Int32Array, start: number, goal: number): number[] {
  if (goal < 0 || parent[goal] === undefined) return [];
  const path: number[] = [];
  let cur = goal;
  const guard = parent.length + 2;
  let n = 0;
  while (cur !== start && cur >= 0 && n++ < guard) {
    path.push(cur);
    cur = parent[cur]!;
  }
  if (cur !== start) return [];
  path.push(start);
  path.reverse();
  return path;
}

function pathDistField(
  walk: Uint8Array,
  cols: number,
  rows: number,
  path: readonly number[],
): Int32Array {
  const dist = new Int32Array(walk.length).fill(-1);
  const queue: number[] = [];
  for (const i of path) {
    if (!walk[i]) continue;
    dist[i] = 0;
    queue.push(i);
  }
  let q = 0;
  while (q < queue.length) {
    const cur = queue[q++]!;
    const col = colOf(cols, cur);
    const row = rowOf(cols, cur);
    const d = dist[cur]!;
    for (const [dx, dy] of DIRS4) {
      const nx = col + dx;
      const ny = row + dy;
      if (!inBounds(cols, rows, nx, ny)) continue;
      const ni = at(cols, nx, ny);
      if (!walk[ni] || dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }
  return dist;
}

function manhattan(cols: number, a: number, b: number): number {
  return Math.abs(colOf(cols, a) - colOf(cols, b)) + Math.abs(rowOf(cols, a) - rowOf(cols, b));
}

/** Side-route extra closest to contested/deep kindling. Never the extract gate. */
function pickRewriterExtraIndex(
  extraWps: readonly number[][],
  contested: readonly number[],
  deep: readonly number[],
  cols: number,
): number {
  if (extraWps.length === 0) return -1;
  const greedy = [...contested, ...deep];
  let best = 0;
  let bestDist = Infinity;
  extraWps.forEach((wps, idx) => {
    let d = Infinity;
    for (const wp of wps) {
      if (greedy.length === 0) {
        d = 0;
        break;
      }
      for (const cell of greedy) d = Math.min(d, manhattan(cols, wp, cell));
    }
    if (d < bestDist) {
      bestDist = d;
      best = idx;
    }
  });
  return best;
}

function worldDistCells(cols: number, a: number, b: number): number {
  const dx = (colOf(cols, a) - colOf(cols, b)) * TILE;
  const dy = (rowOf(cols, a) - rowOf(cols, b)) * TILE;
  return Math.hypot(dx, dy);
}

const losFrom: Vector2 = { x: 0, y: 0 };
const losTo: Vector2 = { x: 0, y: 0 };

function cellSees(grid: TileGrid, from: number, to: number, maxPx: number): boolean {
  const cols = grid.cols;
  if (worldDistCells(cols, from, to) > maxPx) return false;
  const a = worldOf(colOf(cols, from), rowOf(cols, from));
  const b = worldOf(colOf(cols, to), rowOf(cols, to));
  losFrom.x = a.x;
  losFrom.y = a.y;
  losTo.x = b.x;
  losTo.y = b.y;
  return hasLineOfSight(grid, losFrom, losTo, maxPx);
}

function nearAny(cols: number, cell: number, taken: ReadonlySet<number>, minSep: number): boolean {
  for (const t of taken) {
    if (manhattan(cols, cell, t) < minSep) return true;
  }
  return false;
}

function pickSeparated(
  rng: SeededRandom,
  cols: number,
  pool: readonly number[],
  taken: Set<number>,
  count: number,
  minSep: number,
): number[] | null {
  const order = pool.slice();
  rng.shuffle(order);
  const picked: number[] = [];
  const mine = new Set<number>();
  for (const cell of order) {
    if (taken.has(cell) || mine.has(cell)) continue;
    if (nearAny(cols, cell, taken, minSep) || nearAny(cols, cell, mine, minSep)) continue;
    picked.push(cell);
    mine.add(cell);
    if (picked.length === count) return picked;
  }
  return null;
}

function firstWalkable(walk: Uint8Array): number {
  for (let i = 0; i < walk.length; i++) if (walk[i]) return i;
  return -1;
}

function collectBand(dist: Int32Array, lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i]!;
    if (d >= lo && d <= hi) out.push(i);
  }
  return out;
}

function samplesAlong(
  walk: Uint8Array,
  cols: number,
  rows: number,
  waypoints: readonly number[],
  loop: boolean,
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  const add = (i: number): void => {
    if (seen.has(i)) return;
    seen.add(i);
    out.push(i);
  };
  for (const wp of waypoints) add(wp);
  const hops = loop ? waypoints.length : Math.max(0, waypoints.length - 1);
  for (let h = 0; h < hops; h++) {
    const a = waypoints[h]!;
    const b = waypoints[(h + 1) % waypoints.length]!;
    const { parent, dist } = bfs(walk, cols, rows, a);
    if (dist[b]! < 0) continue;
    const path = reconstruct(parent, a, b);
    for (const i of path) add(i);
  }
  return out;
}

function anySees(
  grid: TileGrid,
  samples: readonly number[],
  cell: number,
  maxPx: number,
): boolean {
  for (const s of samples) {
    if (cellSees(grid, s, cell, maxPx)) return true;
  }
  return false;
}

function coveredFraction(
  grid: TileGrid,
  samples: readonly number[],
  cells: readonly number[],
  maxPx: number,
): number {
  if (cells.length === 0) return 0;
  let n = 0;
  for (const c of cells) if (anySees(grid, samples, c, maxPx)) n++;
  return n / cells.length;
}

function facingDeg(cols: number, from: number, to: number): number {
  const dx = colOf(cols, to) - colOf(cols, from);
  const dy = rowOf(cols, to) - rowOf(cols, from);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function makeWalkableMask(grid: TileGrid): WalkableMask {
  return {
    cols: grid.cols,
    rows: grid.rows,
    isWalkable: (col, row) => grid.isWalkable(col, row),
  };
}

function offsetBeside(
  walk: Uint8Array,
  cols: number,
  rows: number,
  cell: number,
  rng: SeededRandom,
): number {
  const col = colOf(cols, cell);
  const row = rowOf(cols, cell);
  const order = [0, 1, 2, 3];
  rng.shuffle(order);
  for (const k of order) {
    const [dx, dy] = DIRS4[k]!;
    const nx = col + dx * 2;
    const ny = row + dy * 2;
    if (!inBounds(cols, rows, nx, ny)) continue;
    const ni = at(cols, nx, ny);
    if (walk[ni]) return ni;
  }
  for (const k of order) {
    const [dx, dy] = DIRS4[k]!;
    const nx = col + dx;
    const ny = row + dy;
    if (!inBounds(cols, rows, nx, ny)) continue;
    const ni = at(cols, nx, ny);
    if (walk[ni]) return ni;
  }
  return cell;
}

interface PlaceOk {
  spawn: number;
  extract: number;
  kindling: KindlingNodeDef[];
  contaminants: ContaminantNodeDef[];
  enemies: EnemySpawnData[];
  landmarks: LandmarkDef[];
}

function placeOnIsland(
  grid: TileGrid,
  walk: Uint8Array,
  walls: Uint8Array,
  rng: SeededRandom,
): PlaceOk | string {
  const cols = grid.cols;
  const rows = grid.rows;
  const origin = firstWalkable(walk);
  if (origin < 0) return 'no floor';

  const fromOrigin = bfs(walk, cols, rows, origin);
  const poleA = farthest(fromOrigin.dist);
  if (poleA < 0) return 'no pole A';
  const fromA = bfs(walk, cols, rows, poleA);
  const poleB = farthest(fromA.dist);
  if (poleB < 0) return 'no pole B';
  const diameter = fromA.dist[poleB]!;
  const minPole = Math.max(16, Math.floor(diameter * 0.55));
  if (diameter < minPole) return `poles too close (${diameter})`;

  const farA = collectBand(fromA.dist, Math.floor(diameter * 0.85), diameter);
  const swap = rng.next() < 0.5;
  let spawn = swap ? poleB : poleA;
  let extract = swap ? poleA : poleB;

  const extractPool = farA.length > 0 ? farA : [poleB];
  const tryExtract = extractPool[rng.nextInt(0, extractPool.length - 1)]!;
  const fromTry = bfs(walk, cols, rows, tryExtract);
  const spawnPool = collectBand(fromTry.dist, Math.floor(diameter * 0.85), diameter);
  if (spawnPool.length > 0) {
    extract = tryExtract;
    spawn = spawnPool[rng.nextInt(0, spawnPool.length - 1)]!;
  }

  const fromSpawn = bfs(walk, cols, rows, spawn);
  if (fromSpawn.dist[extract]! < minPole) return 'spawn/extract not far enough';
  const path = reconstruct(fromSpawn.parent, spawn, extract);
  if (path.length < 12) return `path too short (${path.length})`;

  const dual = evaluateDualPath(walk, walls, cols, rows, spawn, extract);
  if (!dual.ok) return dual.reason;

  const extractPos = worldOf(colOf(cols, extract), rowOf(cols, extract));
  if (sameWorld(extractPos, forbiddenExtract)) return 'extract matches handwritten X';

  const distFromExtract = bfs(walk, cols, rows, extract).dist;
  const distFromSpawn = bfs(walk, cols, rows, spawn).dist;
  const toPath = pathDistField(walk, cols, rows, path);

  const lastLen = Math.max(4, Math.min(10, Math.floor(path.length * 0.25)));
  const lastStretch = path.filter((i) => {
    const d = distFromExtract[i]!;
    return d >= 1 && d <= lastLen;
  });
  if (lastStretch.length < 3) return 'last stretch too small';

  const gateBand = path.filter((i) => {
    const d = distFromExtract[i]!;
    return d >= 6 && d <= 14;
  });
  if (gateBand.length < 2) return 'no gate band';

  const gateA = gateBand[Math.floor(gateBand.length * 0.25)]!;
  const gateB = gateBand[Math.floor(gateBand.length * 0.75)]!;
  if (gateA === gateB || manhattan(cols, gateA, gateB) < 3) return 'gate waypoints too close';
  const gateWps = [gateA, gateB];
  if (anySees(grid, gateWps, extract, SIGHT_PX)) return 'gate sees extract';

  const gateSamples = samplesAlong(walk, cols, rows, gateWps, false);
  if (coveredFraction(grid, gateSamples, lastStretch, SIGHT_PX) < 0.45) {
    return 'gate does not cover last stretch';
  }

  const patrolCount = rng.nextInt(3, 4);
  const extraNeeded = patrolCount - 1;
  const extraWps: number[][] = [];
  const midLo = 0.22;
  const midHi = 0.68;
  for (let p = 0; p < extraNeeded; p++) {
    const t0 = midLo + ((midHi - midLo) * p) / Math.max(1, extraNeeded);
    const t1 = t0 + (midHi - midLo) / Math.max(2, extraNeeded * 1.5);
    const i0 = path[Math.max(0, Math.min(path.length - 1, Math.floor(path.length * t0)))]!;
    const i1 = path[Math.max(0, Math.min(path.length - 1, Math.floor(path.length * t1)))]!;
    let a = offsetBeside(walk, cols, rows, i0, rng);
    let b = offsetBeside(walk, cols, rows, i1, rng);
    if (a === b) b = offsetBeside(walk, cols, rows, path[Math.min(path.length - 1, (path.indexOf(i1) + 4) | 0)] ?? i1, rng);
    if (a === b || manhattan(cols, a, b) < 4) return 'mid patrol too short';
    if (distFromSpawn[a]! < 8 || distFromSpawn[b]! < 8) return 'mid patrol too close to spawn';
    if (distFromExtract[a]! < lastLen + 3 || distFromExtract[b]! < lastLen + 3) {
      return 'mid patrol overlaps last stretch';
    }
    extraWps.push([a, b]);
  }

  const allWaypoints = [...gateWps, ...extraWps.flat()];
  if (anySees(grid, allWaypoints, extract, SIGHT_PX)) return 'a patrol sees extract';
  if (anySees(grid, allWaypoints, spawn, SIGHT_PX)) return 'a patrol sees spawn';

  for (const wps of extraWps) {
    const samples = samplesAlong(walk, cols, rows, wps, false);
    if (coveredFraction(grid, samples, lastStretch, SIGHT_PX) > 0.25) {
      return 'second patrol covers last stretch';
    }
  }

  const sweepGroups = [gateSamples, ...extraWps.map((wps) => samplesAlong(walk, cols, rows, wps, false))];
  const allSweep = sweepGroups.flat();
  const inSweep = (cell: number): boolean => anySees(grid, allSweep, cell, SIGHT_PX);

  const occupied = new Set<number>([spawn, extract, ...allWaypoints]);

  const floors: number[] = [];
  for (let i = 0; i < walk.length; i++) if (walk[i]) floors.push(i);

  const safePool = floors.filter(
    (i) =>
      !occupied.has(i) &&
      toPath[i]! >= 0 &&
      toPath[i]! <= 2 &&
      distFromSpawn[i]! >= 3 &&
      distFromExtract[i]! >= 10 &&
      !inSweep(i),
  );
  const contestedPool = floors.filter(
    (i) =>
      !occupied.has(i) &&
      inSweep(i) &&
      distFromExtract[i]! >= 8 &&
      distFromSpawn[i]! >= 8,
  );
  const deepPool = floors.filter(
    (i) =>
      !occupied.has(i) &&
      toPath[i]! >= 5 &&
      distFromExtract[i]! >= 8 &&
      distFromSpawn[i]! >= 8,
  );

  const deep = pickSeparated(rng, cols, deepPool, occupied, 2, 3);
  if (!deep) return `deep kindling short (${deepPool.length})`;
  for (const i of deep) occupied.add(i);
  const contested = pickSeparated(rng, cols, contestedPool, occupied, 3, 3);
  if (!contested) return `contested kindling short (${contestedPool.length})`;
  for (const i of contested) occupied.add(i);
  const safe = pickSeparated(rng, cols, safePool, occupied, 3, 3);
  if (!safe) return `safe kindling short (${safePool.length})`;
  for (const i of safe) occupied.add(i);

  const kindling: KindlingNodeDef[] = [];
  const pushTier = (cells: readonly number[], tier: KindlingTier, startId: number): void => {
    cells.forEach((cell, idx) => {
      const id = startId + idx;
      kindling.push({
        id: `KDL_0${id}`,
        tier,
        position: worldOf(colOf(cols, cell), rowOf(cols, cell)),
      });
    });
  };
  pushTier(safe, 'safe', 1);
  pushTier(contested, 'contested', 4);
  pushTier(deep, 'deep', 7);

  const contaminantPool = floors.filter(
    (i) => !occupied.has(i) && distFromSpawn[i]! >= 4 && distFromExtract[i]! >= 6,
  );
  const contaminantsCells = pickSeparated(rng, cols, contaminantPool, occupied, 3, 4);
  if (!contaminantsCells) return `contaminants short (${contaminantPool.length})`;
  for (const i of contaminantsCells) occupied.add(i);
  const contaminants: ContaminantNodeDef[] = contaminantsCells.map((cell, idx) => ({
    id: `CTM_NODE_0${idx + 1}`,
    position: worldOf(colOf(cols, cell), rowOf(cols, cell)),
  }));

  const enemies: EnemySpawnData[] = [];
  const pushPatrol = (id: string, wps: readonly number[], type: EnemySpawnData['type']): void => {
    enemies.push({
      id,
      type,
      spawn: { col: colOf(cols, wps[0]!), row: rowOf(cols, wps[0]!) },
      facing: facingDeg(cols, wps[0]!, wps[1] ?? wps[0]!),
      patrol: {
        waypoints: wps.map((i) => ({ col: colOf(cols, i), row: rowOf(cols, i) })),
        mode: 'pingpong',
        pauseMs: GAME_CONSTANTS.AI.WAYPOINT_PAUSE_MS,
      },
    });
  };
  // Rule 19: the extract gate stays an infiltrator. Exactly one rewriter among the rest.
  pushPatrol('ENM_INF_01', gateWps, 'infiltrator');
  const rewriterExtra = pickRewriterExtraIndex(extraWps, contested, deep, cols);
  extraWps.forEach((wps, idx) => {
    const rewriter = idx === rewriterExtra;
    pushPatrol(rewriter ? 'ENM_RWR_01' : `ENM_INF_0${idx + 2}`, wps, rewriter ? 'rewriter' : 'infiltrator');
  });
  if (enemies.filter((e) => e.type === 'rewriter').length !== 1) {
    return 'rewriter count not 1';
  }

  const landmarkPool = floors.filter((i) => !occupied.has(i) && toPath[i]! >= 0);
  const landmarkCount = rng.nextInt(2, 4);
  const landmarkCells = pickSeparated(rng, cols, landmarkPool, occupied, landmarkCount, 5) ?? [];
  const landmarks: LandmarkDef[] = landmarkCells.map((cell, idx) => ({
    id: `LMK_${idx + 1}`,
    col: colOf(cols, cell),
    row: rowOf(cols, cell),
    style: LANDMARK_STYLES[idx % LANDMARK_STYLES.length]!,
  }));

  return { spawn, extract, kindling, contaminants, enemies, landmarks };
}

export function generateRiftLayout(seed: number): GeneratedRiftLayout {
  const inputSeed = seed >>> 0;
  const roll = rollFragmentAxes(inputSeed);
  let lastWhy = 'no attempt';

  for (let island = 0; island < MAX_ISLAND_ATTEMPTS; island++) {
    const recipe = pickRecipe(inputSeed, island);
    const draftSeed = islandSeed(inputSeed, island);
    let draft;
    try {
      draft = generateRecipeDraft(draftSeed, recipe);
    } catch (err) {
      lastWhy = err instanceof Error ? err.message : String(err);
      continue;
    }

    const grid = new TileGrid(draft.tileMap);
    const walk = walkBits(grid);
    const walls = wallBits(grid);
    let floorCount = 0;
    for (let i = 0; i < walk.length; i++) if (walk[i]) floorCount++;
    if (floorCount < 80) {
      lastWhy = `too few floors (${floorCount})`;
      continue;
    }

    for (let place = 0; place < MAX_PLACE_ATTEMPTS; place++) {
      const rng = new SeededRandom(mix32(inputSeed, `place:${island}:${place}`));
      const placed = placeOnIsland(grid, walk, walls, rng);
      if (typeof placed === 'string') {
        lastWhy = placed;
        continue;
      }

      const spawnPoint = worldOf(colOf(grid.cols, placed.spawn), rowOf(grid.cols, placed.spawn));
      const extractionPoint = {
        id: 'EXIT_01',
        position: worldOf(colOf(grid.cols, placed.extract), rowOf(grid.cols, placed.extract)),
        triggerRadius: GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS,
      };
      if (sameWorld(extractionPoint.position, forbiddenExtract)) {
        lastWhy = 'extract matches handwritten X';
        continue;
      }

      return {
        seed: inputSeed,
        fragmentTypeId: recipe.fragmentTypeId,
        recipeId: recipe.id,
        contaminationAge: roll.contaminationAge,
        ruinSeverity: roll.ruinSeverity,
        tileMap: draft.tileMap,
        ruins: {
          ...draft,
          contaminationAge: roll.contaminationAge,
          ruinSeverity: roll.ruinSeverity,
        },
        walkableMask: makeWalkableMask(grid),
        spawnPoint,
        extractionPoint,
        kindlingNodes: placed.kindling,
        contaminantNodes: placed.contaminants,
        enemySpawns: placed.enemies,
        landmarks: placed.landmarks,
      };
    }
  }

  throw new Error(
    `generateRiftLayout: seed ${inputSeed} failed after ${MAX_ISLAND_ATTEMPTS} island attempts × ${MAX_PLACE_ATTEMPTS} placements (${lastWhy})`,
  );
}
