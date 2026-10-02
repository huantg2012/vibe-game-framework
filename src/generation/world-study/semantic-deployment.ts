/** Route, encounter and reward composition for compiled worlds. No live-game state. */
import { GAME_CONSTANTS } from '@/config/constants';
import { ENEMY_DATA } from '@/generated/enemy-data';
import { BEHAVIOR_PROFILE_DATA } from '@/generated/contamination-capability-data';
import { floorMotionFor, INFILTRATOR_FORM, REWRITER_FORM } from '@/generation/contamination-draw';
import { isStaticFloorBody } from '@/generation/static-body-access';
import type { GeneratedRiftLayout } from '@/generation/types';
import { TileGrid } from '@/systems/tile-grid';
import { bodyHasSupport } from '@/systems/ai/physical-grid';
import type { EnemySpawnData, KindlingTier, LandmarkDef, TileMapData } from '@/types/map-types';
import { TileType, type Vector2 } from '@/types/game-types';
import { hasLineOfSight } from '@/utils/grid-raycast';
import { WORLD_CONTESTED_MIN_THREAT } from './world-conditions';

/** Structural subset allows the compiler to add unrelated frozen conditions. */
export interface SemanticDeploymentConditions {
  readonly semantic: {
    readonly minimumDeepDetourPx: number;
    readonly safeMaxThreat: number;
    readonly routeThreatPenalty: number;
  };
}
export interface SemanticDeploymentTerrain {
  readonly tileMap: TileMapData;
  readonly coordinateOffset: Vector2;
}
export interface SemanticRoute {
  readonly points: readonly Vector2[];
  readonly lengthPx: number;
  /** Integral of potential perception exposure over distance, not a hit probability. */
  readonly exposurePx: number;
}
export interface SemanticNodeDiagnostic {
  readonly id: string;
  readonly tier: KindlingTier;
  readonly threat: number;
  readonly approachThreat: number;
  readonly extraTravelPx: number;
  readonly costBasis: 'interaction-area' | 'conservative-node-center';
  readonly interactionSeats?: number;
}
export interface SemanticDeploymentDiagnostics {
  readonly version: 1;
  readonly encounterAdjustments: readonly { id: string; from: Vector2; to: Vector2 }[];
  readonly shortRoute: SemanticRoute;
  readonly lowExposureRoute: SemanticRoute;
  readonly exposureReduction: number;
  readonly extraRoutePx: number;
  readonly nodes: readonly SemanticNodeDiagnostic[];
  readonly landmarks: readonly { id: string; purpose: 'turn' | 'deep-approach' | 'exit-approach' }[];
  readonly threatSources: readonly { id: string; motion: string; samples: number; sightRange: number; hearingRange: number }[];
}
export class SemanticDeploymentError extends Error {
  constructor(reason: string) { super(`Semantic deployment: ${reason}`); this.name = 'SemanticDeploymentError'; }
}
const MIN_ROUTE_DETOUR = 64;
const MIN_EXPOSURE_REDUCTION = .2;
const CONTESTED_THREAT = WORLD_CONTESTED_MIN_THREAT;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

interface Graph {
  cols: number; rows: number; tile: number; walk: Uint8Array;
}
function adjacent(g: Graph, cell: number): number[] {
  const x = cell % g.cols, y = Math.floor(cell / g.cols), out: number[] = [];
  for (const [dx, dy] of DIRS) {
    const xx = x + dx, yy = y + dy, next = yy * g.cols + xx;
    if (xx >= 0 && yy >= 0 && xx < g.cols && yy < g.rows && g.walk[next]) out.push(next);
  }
  return out;
}
function center(g: Graph, cell: number): Vector2 {
  return { x: (cell % g.cols + .5) * g.tile, y: (Math.floor(cell / g.cols) + .5) * g.tile };
}
function cellAt(g: Graph, p: Vector2): number { return Math.floor(p.y / g.tile) * g.cols + Math.floor(p.x / g.tile); }
function gridDistance(g: Graph, a: number, b: number): number {
  return Math.abs(a % g.cols - b % g.cols) + Math.abs(Math.floor(a / g.cols) - Math.floor(b / g.cols));
}
function flood(g: Graph, starts: readonly number[]): { distance: Int32Array; parent: Int32Array } {
  const distance = new Int32Array(g.walk.length).fill(-1), parent = new Int32Array(g.walk.length).fill(-1);
  const queue: number[] = [];
  for (const cell of starts) if (g.walk[cell] && distance[cell]! < 0) { distance[cell] = 0; queue.push(cell); }
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head]!;
    for (const next of adjacent(g, cell)) if (distance[next]! < 0) {
      distance[next] = distance[cell]! + 1; parent[next] = cell; queue.push(next);
    }
  }
  return { distance, parent };
}
function reconstruct(parent: Int32Array, start: number, goal: number): number[] {
  const out = [goal];
  while (out[out.length - 1] !== start) {
    const next = parent[out[out.length - 1]!]!;
    if (next < 0 || out.length > parent.length) return [];
    out.push(next);
  }
  return out.reverse();
}
/** Stable binary heap; only used during level compilation. */
function shortestPaths(g: Graph, start: number | readonly number[], threat?: Float32Array, penalty = 0): { distance: Float64Array; parent: Int32Array } {
  const distance = new Float64Array(g.walk.length).fill(Infinity), parent = new Int32Array(g.walk.length).fill(-1);
  const heap: { cell: number; cost: number }[] = [];
  const push = (cell: number, cost: number): void => {
    let i = heap.length; heap.push({ cell, cost });
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p]!.cost <= cost) break; heap[i] = heap[p]!; i = p; }
    heap[i] = { cell, cost };
  };
  const pop = (): { cell: number; cost: number } => {
    const first = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      while (i * 2 + 1 < heap.length) {
        let child = i * 2 + 1;
        if (child + 1 < heap.length && heap[child + 1]!.cost < heap[child]!.cost) child++;
        if (last.cost <= heap[child]!.cost) break;
        heap[i] = heap[child]!; i = child;
      }
      heap[i] = last;
    }
    return first;
  };
  for (const cell of typeof start === 'number' ? [start] : start) { distance[cell] = 0; push(cell, 0); }
  while (heap.length) {
    const item = pop(); if (item.cost !== distance[item.cell]) continue;
    for (const next of diagonalAdjacent(g, item.cell)) {
      const a = center(g, item.cell), b = center(g, next);
      const edge = Math.hypot(a.x - b.x, a.y - b.y);
      const cost = item.cost + edge * (1 + penalty * (threat ? (threat[item.cell]! + threat[next]!) / 2 : 0));
      if (cost + 1e-7 >= distance[next]!) continue;
      distance[next] = cost; parent[next] = item.cell; push(next, cost);
    }
  }
  return { distance, parent };
}
function diagonalAdjacent(g: Graph, cell: number): number[] {
  const out = adjacent(g, cell), x = cell % g.cols, y = Math.floor(cell / g.cols);
  for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
    const xx = x + dx, yy = y + dy, next = yy * g.cols + xx;
    if (xx >= 0 && yy >= 0 && xx < g.cols && yy < g.rows && g.walk[next]
      && g.walk[y * g.cols + xx] && g.walk[yy * g.cols + x]) out.push(next);
  }
  return out;
}
function routeMetrics(g: Graph, path: readonly number[], threat: Float32Array): SemanticRoute {
  let exposure = 0, length = 0;
  for (let i = 1; i < path.length; i++) {
    const a = center(g, path[i - 1]!), b = center(g, path[i]!);
    const edge = Math.hypot(a.x - b.x, a.y - b.y); length += edge;
    exposure += edge * (threat[path[i - 1]!]! + threat[path[i]!]!) / 2;
  }
  return { points: path.map(cell => center(g, cell)), lengthPx: length, exposurePx: exposure };
}
interface ThreatSample { cell: number; heading: number; turns: boolean }
function patrolSamples(g: Graph, enemy: EnemySpawnData): ThreatSample[] {
  const form = enemy.form ?? (enemy.type === 'rewriter' ? REWRITER_FORM : INFILTRATOR_FORM);
  const motion = floorMotionFor(form), spawn = enemy.spawn.row * g.cols + enemy.spawn.col;
  if (motion !== 'motion_patrol' || enemy.patrol.mode === 'static' || enemy.patrol.waypoints.length < 2)
    return [{ cell: spawn, heading: enemy.facing * Math.PI / 180, turns: motion === 'motion_turn' }];
  const result: ThreatSample[] = [];
  const wp = enemy.patrol.waypoints.map(p => p.row * g.cols + p.col);
  const legs = enemy.patrol.mode === 'loop' ? wp.length : wp.length - 1;
  for (let i = 0; i < legs; i++) {
    const from = wp[i]!, to = wp[(i + 1) % wp.length]!;
    const path = reconstruct(flood(g, [from]).parent, from, to);
    if (!path.length) throw new SemanticDeploymentError(`${enemy.id} has no patrol route`);
    for (let j = 0; j < path.length; j++) {
      const cell = path[j]!, a = center(g, path[Math.max(0, j - 1)]!), b = center(g, path[Math.min(path.length - 1, j + 1)]!);
      const heading = Math.atan2(b.y - a.y, b.x - a.x);
      result.push({ cell, heading, turns: false });
      if (enemy.patrol.mode === 'pingpong') result.push({ cell, heading: heading + Math.PI, turns: false });
    }
  }
  return result;
}
/** Time-independent potential danger from the final floor roster. Paint is reseated later. */
function buildThreat(g: Graph, grid: TileGrid, enemies: readonly EnemySpawnData[]): {
  field: Float32Array; sources: SemanticDeploymentDiagnostics['threatSources'];
} {
  const field = new Float32Array(g.walk.length), sources: SemanticDeploymentDiagnostics['threatSources'][number][] = [];
  for (const enemy of enemies) {
    const form = enemy.form ?? (enemy.type === 'rewriter' ? REWRITER_FORM : INFILTRATOR_FORM);
    const profile = ENEMY_DATA[enemy.type], narrow = form.lexemes.sense === 'sense_narrow' ? BEHAVIOR_PROFILE_DATA.sense_narrow : undefined;
    const range = profile.sightRange * (narrow?.rangeScale ?? 1), halfAngle = (narrow ? narrow.coneDeg / 2 : profile.sightHalfAngleCore) * Math.PI / 180;
    const hearing = profile.hearingRange, samples = patrolSamples(g, enemy), local = new Float32Array(field.length);
    sources.push({ id: enemy.id, motion: floorMotionFor(form), samples: samples.length, sightRange: range, hearingRange: hearing });
    const radius = Math.ceil(Math.max(range, hearing) / g.tile);
    for (const sample of samples) {
      const from = center(g, sample.cell), sx = sample.cell % g.cols, sy = Math.floor(sample.cell / g.cols);
      for (let y = Math.max(0, sy - radius); y <= Math.min(g.rows - 1, sy + radius); y++) for (let x = Math.max(0, sx - radius); x <= Math.min(g.cols - 1, sx + radius); x++) {
        const cell = y * g.cols + x; if (!g.walk[cell]) continue;
        const point = center(g, cell), distance = Math.hypot(point.x - from.x, point.y - from.y);
        if (distance > Math.max(range, hearing)) continue;
        const los = hasLineOfSight(grid, from, point, Math.max(range, hearing));
        const bearing = Math.atan2(point.y - from.y, point.x - from.x);
        const offset = Math.abs(Math.atan2(Math.sin(bearing - sample.heading), Math.cos(bearing - sample.heading)));
        const sweep = sample.turns ? GAME_CONSTANTS.AI.SCAN_SWEEP_ANGLE * Math.PI / 180 : 0;
        const inCone = offset <= halfAngle + sweep;
        const peripheral = !narrow && distance <= profile.sightRangePeriph && offset <= profile.sightHalfAnglePeriph * Math.PI / 180 + sweep;
        const visual = los && distance <= range && (inCone || peripheral) ? (.25 + .75 * (1 - distance / range)) * (inCone ? 1 : .5) : 0;
        const heardRange = hearing * (los ? 1 : profile.hearingWallFactor);
        // Visual forms hear footsteps as suspicion; hearing forms can escalate.
        const heard = distance <= heardRange ? (profile.hearingWeight > 0 ? .28 : .08) * (1 - distance / heardRange) : 0;
        local[cell] = Math.max(local[cell]!, visual, heard);
      }
    }
    for (let i = 0; i < field.length; i++) field[i] = 1 - (1 - field[i]!) * (1 - local[i]!);
  }
  return { field, sources };
}

/** Offline diagnostics use the same final-roster threat contract as deployment. */
export function measureSemanticThreat(layout: GeneratedRiftLayout): {
  field: Float32Array; sources: SemanticDeploymentDiagnostics['threatSources'];
} {
  const grid = new TileGrid(layout.tileMap);
  const g: Graph = { cols: grid.cols, rows: grid.rows, tile: grid.tileSize, walk: new Uint8Array(grid.cols * grid.rows) };
  for (let i = 0; i < g.walk.length; i++) g.walk[i] = grid.isWalkable(i % g.cols, Math.floor(i / g.cols)) ? 1 : 0;
  return buildThreat(g, grid, layout.enemySpawns);
}

function evaluateDeployment(layout: GeneratedRiftLayout, conditions: SemanticDeploymentConditions, terrain?: SemanticDeploymentTerrain): {
  layout: GeneratedRiftLayout; diagnostics: SemanticDeploymentDiagnostics;
} {
  const contract = conditions.semantic, grid = new TileGrid(layout.tileMap);
  if (grid.tileSize !== 32) throw new SemanticDeploymentError('requires the conservative 32px deployment grid');
  if (layout.kindlingNodes.length !== 8 || layout.contaminantNodes.length !== 3)
    throw new SemanticDeploymentError('requires exactly eight kindling and three contaminant identities');
  if (!Number.isFinite(contract.minimumDeepDetourPx) || contract.minimumDeepDetourPx <= 0
    || !Number.isFinite(contract.safeMaxThreat) || contract.safeMaxThreat < 0 || contract.safeMaxThreat >= CONTESTED_THREAT
    || !Number.isFinite(contract.routeThreatPenalty) || contract.routeThreatPenalty <= 0)
    throw new SemanticDeploymentError('invalid frozen semantic contract');
  const g: Graph = { cols: grid.cols, rows: grid.rows, tile: grid.tileSize, walk: new Uint8Array(grid.cols * grid.rows) };
  for (let i = 0; i < g.walk.length; i++) g.walk[i] = grid.isWalkable(i % g.cols, Math.floor(i / g.cols)) ? 1 : 0;
  // Permanent bodies must not be treated as shortcuts or resource seats.
  const routeGraph: Graph = { ...g, walk: g.walk.slice() };
  for (const enemy of layout.enemySpawns.filter(isStaticFloorBody)) routeGraph.walk[enemy.spawn.row * g.cols + enemy.spawn.col] = 0;
  const spawn = cellAt(g, layout.spawnPoint), exit = cellAt(g, layout.extractionPoint.position);
  const fromSpawn = shortestPaths(routeGraph, spawn), fromExit = shortestPaths(routeGraph, exit);
  const shortPath = reconstruct(fromSpawn.parent, spawn, exit);
  if (!shortPath.length) throw new SemanticDeploymentError('static roster disconnects exit');
  const { field: threat, sources } = buildThreat(g, grid, layout.enemySpawns);
  const shortRoute = routeMetrics(g, shortPath, threat);
  let safePath: number[] = [], lowExposureRoute: SemanticRoute | undefined;
  // Higher aversion may reveal a real detour; it never changes topology or enemies.
  for (const multiplier of [1, 2, 4]) {
    const path = reconstruct(shortestPaths(routeGraph, spawn, threat, contract.routeThreatPenalty * multiplier).parent, spawn, exit);
    const route = routeMetrics(g, path, threat);
    if (route.lengthPx >= shortRoute.lengthPx + MIN_ROUTE_DETOUR
      && route.exposurePx <= shortRoute.exposurePx * (1 - MIN_EXPOSURE_REDUCTION)) {
      safePath = path; lowExposureRoute = route; break;
    }
  }
  if (!lowExposureRoute) throw new SemanticDeploymentError('no longer, materially lower-exposure route');
  const toSafe = flood(routeGraph, safePath).distance;
  const approach = new Float32Array(threat.length);
  for (let i = 0; i < approach.length; i++) if (routeGraph.walk[i]) {
    // Actual shortest approach legs, not a nearby enemy across an unvisited wall.
    const legThreat = (parents: Int32Array): number => {
      let cell = i, distance = 0, peak = threat[i]!;
      while (parents[cell]! >= 0 && distance < 3 * g.tile) {
        const next = parents[cell]!, a = center(g, cell), b = center(g, next);
        distance += Math.hypot(a.x - b.x, a.y - b.y); peak = Math.max(peak, threat[next]!); cell = next;
      }
      return peak;
    };
    approach[i] = Math.min(legThreat(fromSpawn.parent), legThreat(fromExit.parent));
  }
  const occupied: number[] = [spawn, exit, ...layout.enemySpawns.map(e => e.spawn.row * g.cols + e.spawn.col)];
  const extra = (cell: number): number => fromSpawn.distance[cell]! + fromExit.distance[cell]! - fromSpawn.distance[exit]!;
  const candidates: number[] = [];
  for (let i = 0; i < g.walk.length; i++) if (routeGraph.walk[i] && Number.isFinite(fromSpawn.distance[i]!) && fromSpawn.distance[i]! >= 4 * g.tile && fromExit.distance[i]! >= 5 * g.tile) candidates.push(i);
  const coarseDeep = candidates.filter(cell => extra(cell) >= contract.minimumDeepDetourPx && approach[cell]! >= CONTESTED_THREAT);
  const interaction = terrain && coarseDeep.length >= 3 ? measureInteractionAreas(layout, terrain) : undefined;
  const deepChecks = new Map<number, InteractionCheck>();
  const deep = coarseDeep.filter(cell => {
    if (!terrain) return true;
    const check = interaction?.at(center(g, cell));
    if (check) deepChecks.set(cell, check);
    return check !== undefined && check.minimumExtraPx >= contract.minimumDeepDetourPx
      && check.minimumApproachThreat >= CONTESTED_THREAT;
  });
  const contested = candidates.filter(cell => threat[cell]! >= CONTESTED_THREAT && fromSpawn.distance[cell]! >= 7 * g.tile && fromExit.distance[cell]! >= 8 * g.tile
    && extra(cell) < contract.minimumDeepDetourPx * .85);
  const safe = candidates.filter(cell => threat[cell]! <= contract.safeMaxThreat && toSafe[cell]! <= 2);
  const select = (pool: readonly number[], count: number, score: (cell: number) => number, name: string): number[] => {
    const selected: number[] = [];
    for (let i = 0; i < count; i++) {
      const available = pool.filter(cell => occupied.every(other => gridDistance(g, cell, other) >= 3)
        && (name !== 'deep' || selected.every(other => gridDistance(g, cell, other) >= 6)));
      available.sort((a, b) => {
        const spacing = (cell: number): number => selected.length ? Math.min(...selected.map(other => gridDistance(g, cell, other))) * 3 : 0;
        return score(b) + spacing(b) - score(a) - spacing(a) || a - b;
      });
      if (!available.length) throw new SemanticDeploymentError(`insufficient separated ${name} seats (${pool.length})`);
      const cell = available[0]!; selected.push(cell); occupied.push(cell);
    }
    return selected;
  };
  const deepCells = select(deep, 3, cell => Math.min(extra(cell), contract.minimumDeepDetourPx * 2) / g.tile + approach[cell]! * 12, 'deep');
  const contestedCells = select(contested, 4, cell => 18 - Math.abs(threat[cell]! - .45) * 20, 'contested');
  const safeCells = select(safe, 4, cell => -toSafe[cell]! * 3 - threat[cell]! * 30 + Math.min(fromSpawn.distance[cell]! / g.tile, 18) * .15, 'safe');
  const assigned = [safeCells.slice(0, 3), contestedCells.slice(0, 3), deepCells.slice(0, 2)];
  const tiers = ['safe', 'contested', 'deep'] as const;
  const nodeDiagnostics: SemanticNodeDiagnostic[] = [];
  const record = (id: string, tier: KindlingTier, cell: number): void => {
    const checked = tier === 'deep' ? deepChecks.get(cell) : undefined;
    nodeDiagnostics.push({ id, tier, threat: threat[cell]!, approachThreat: checked?.minimumApproachThreat ?? approach[cell]!,
      extraTravelPx: checked?.minimumExtraPx ?? extra(cell), costBasis: checked ? 'interaction-area' : 'conservative-node-center',
      ...(checked ? { interactionSeats: checked.seats } : {}) });
  };
  let index = 0;
  const kindlingNodes = assigned.flatMap((cells, t) => cells.map(cell => {
    const previous = layout.kindlingNodes[index++]!;
    if (!previous) throw new SemanticDeploymentError('expected eight kindling identities');
    record(previous.id, tiers[t]!, cell);
    return { ...previous, tier: tiers[t]!, position: center(g, cell) };
  }));
  const itemCells = [safeCells[3]!, contestedCells[3]!, deepCells[2]!];
  const contaminantNodes = layout.contaminantNodes.map((node, i) => {
    const cell = itemCells[i]; if (cell === undefined) throw new SemanticDeploymentError('expected three contaminant identities');
    record(node.id, tiers[i]!, cell); return { ...node, tier: tiers[i]!, position: center(g, cell) };
  });
  const landmarkSeats: { cell: number; purpose: SemanticDeploymentDiagnostics['landmarks'][number]['purpose']; style: LandmarkDef['style'] }[] = [];
  const addLandmark = (anchor: number, purpose: SemanticDeploymentDiagnostics['landmarks'][number]['purpose'], style: LandmarkDef['style']): void => {
    const cells = floodRadius(routeGraph, anchor, 3).filter(cell => occupied.every(other => gridDistance(g, cell, other) >= 3)
      && landmarkSeats.every(other => gridDistance(g, cell, other.cell) >= 5));
    cells.sort((a, b) => gridDistance(g, a, anchor) - gridDistance(g, b, anchor) || a - b);
    if (!cells.length) throw new SemanticDeploymentError(`no readable ${purpose} landmark seat`);
    landmarkSeats.push({ cell: cells[0]!, purpose, style });
  };
  const turns = safePath.filter((cell, i) => i > 2 && i < safePath.length - 3
    && cell - safePath[i - 1]! !== safePath[i + 1]! - cell);
  const mainTurn = turns[Math.floor(turns.length / 2)] ?? safePath[Math.floor(safePath.length / 2)]!;
  addLandmark(mainTurn, 'turn', 'scratches');
  const deepEntryPath = reconstruct(fromSpawn.parent, spawn, deepCells[0]!);
  addLandmark(deepEntryPath[Math.max(0, deepEntryPath.length - 5)]!, 'deep-approach', 'crystals');
  addLandmark(safePath[Math.max(0, safePath.length - 5)]!, 'exit-approach', 'rubble');
  const landmarks = landmarkSeats.map((seat, i): LandmarkDef => ({ id: `LMK_${i + 1}`, col: seat.cell % g.cols,
    row: Math.floor(seat.cell / g.cols), style: seat.style }));
  return { layout: { ...layout, kindlingNodes, contaminantNodes, landmarks }, diagnostics: {
    version: 1, encounterAdjustments: [], shortRoute, lowExposureRoute, exposureReduction: 1 - lowExposureRoute.exposurePx / shortRoute.exposurePx,
    extraRoutePx: lowExposureRoute.lengthPx - shortRoute.lengthPx, nodes: nodeDiagnostics,
    landmarks: landmarkSeats.map((seat, i) => ({ id: landmarks[i]!.id, purpose: seat.purpose })), threatSources: sources,
  } };
}
function floodRadius(g: Graph, start: number, radius: number): number[] {
  const seen = new Set([start]), queue = [{ cell: start, distance: 0 }];
  for (let i = 0; i < queue.length; i++) {
    const { cell, distance } = queue[i]!; if (distance >= radius) continue;
    for (const next of adjacent(g, cell)) if (!seen.has(next)) { seen.add(next); queue.push({ cell: next, distance: distance + 1 }); }
  }
  return [...seen];
}


/** Compose existing identities around an expensive branch when their initial random
 * seats cannot sustain the recipe. The exit guardian and all form draws stay fixed. */
export function applySemanticDeployment(layout: GeneratedRiftLayout, conditions: SemanticDeploymentConditions, terrain?: SemanticDeploymentTerrain): {
  layout: GeneratedRiftLayout; diagnostics: SemanticDeploymentDiagnostics;
} {
  let originalFailure: unknown;
  try { return evaluateDeployment(layout, conditions, terrain); }
  catch (error) { if (!(error instanceof SemanticDeploymentError)) throw error; originalFailure = error; }
  const grid = new TileGrid(layout.tileMap), tile = grid.tileSize;
  if (tile !== 32 || layout.enemySpawns.length < 2) throw originalFailure;
  const g: Graph = { cols: grid.cols, rows: grid.rows, tile, walk: new Uint8Array(grid.cols * grid.rows) };
  for (let i = 0; i < g.walk.length; i++) g.walk[i] = grid.isWalkable(i % g.cols, Math.floor(i / g.cols)) ? 1 : 0;
  const spawn = cellAt(g, layout.spawnPoint), exit = cellAt(g, layout.extractionPoint.position);
  const fromSpawn = shortestPaths(g, spawn), fromExit = shortestPaths(g, exit), direct = fromSpawn.distance[exit]!;
  const path = reconstruct(fromSpawn.parent, spawn, exit);
  if (!path.length || !Number.isFinite(conditions.semantic.minimumDeepDetourPx)) throw originalFailure;
  const extra = (cell: number): number => fromSpawn.distance[cell]! + fromExit.distance[cell]! - direct;
  const deepArea: number[] = [];
  for (let i = 0; i < g.walk.length; i++) if (g.walk[i] && Number.isFinite(fromSpawn.distance[i]!)
    && extra(i) >= conditions.semantic.minimumDeepDetourPx - tile * 2
    && fromSpawn.distance[i]! >= 10 * tile && fromExit.distance[i]! >= 12 * tile) deepArea.push(i);
  const capacity = new Map<number, number>();
  for (const cell of deepArea) capacity.set(cell, floodRadius(g, cell, 4).filter(p => extra(p) >= conditions.semantic.minimumDeepDetourPx).length);
  const ranked = deepArea.filter(cell => (capacity.get(cell) ?? 0) >= 12).sort((a, b) =>
    (capacity.get(b)! - capacity.get(a)!) || extra(a) - extra(b) || a - b);
  const anchors: number[] = [];
  for (const cell of ranked) {
    if (anchors.every(other => gridDistance(g, cell, other) >= 6)) anchors.push(cell);
    if (anchors.length === 6) break;
  }
  const eligible = layout.enemySpawns.slice(1).sort((a, b) =>
    Number(floorMotionFor(a.form ?? INFILTRATOR_FORM) === 'motion_patrol')
    - Number(floorMotionFor(b.form ?? INFILTRATOR_FORM) === 'motion_patrol') || a.id.localeCompare(b.id));
  let attempts = 0, lastFailure = String(originalFailure);
  for (const anchor of anchors) for (const enemy of eligible) {
    if (++attempts > 12) break;
    if (layout.enemySpawns.some(other => other.id !== enemy.id && gridDistance(g, anchor, other.spawn.row * g.cols + other.spawn.col) < 4)) continue;
    const position = center(g, anchor), nearest = [...path].sort((a, b) => gridDistance(g, anchor, a) - gridDistance(g, anchor, b) || a - b)[0]!;
    const inward = center(g, nearest), facing = Math.atan2(position.y - inward.y, position.x - inward.x) * 180 / Math.PI;
    let waypoints = [{ col: anchor % g.cols, row: Math.floor(anchor / g.cols) }];
    const motion = floorMotionFor(enemy.form ?? (enemy.type === 'rewriter' ? REWRITER_FORM : INFILTRATOR_FORM));
    if (motion === 'motion_patrol') {
      const fromAnchor = shortestPaths(g, anchor);
      const end = ranked.filter(cell => fromAnchor.distance[cell]! >= 5 * tile && fromAnchor.distance[cell]! <= 10 * tile
        && layout.enemySpawns.every(other => other.id === enemy.id || gridDistance(g, cell, other.spawn.row * g.cols + other.spawn.col) >= 3))
        .sort((a, b) => (capacity.get(b)! - capacity.get(a)!) || fromAnchor.distance[a]! - fromAnchor.distance[b]! || a - b)[0];
      if (end === undefined) continue;
      // Preserve the same 4-connected coarse path expanded by production-map.
      const corridor = reconstruct(flood(g, [anchor]).parent, anchor, end);
      if (!corridor.length || corridor.some(cell => fromSpawn.distance[cell]! < 8 * tile || fromExit.distance[cell]! < 10 * tile)) continue;
      waypoints = [waypoints[0]!, { col: end % g.cols, row: Math.floor(end / g.cols) }];
    }
    const moved: EnemySpawnData = { ...enemy, spawn: waypoints[0]!, facing,
      patrol: { ...enemy.patrol, mode: motion === 'motion_patrol' ? 'pingpong' : 'static', waypoints } };
    const movedThreat = buildThreat(g, grid, [moved]).field;
    // The final approach remains the responsibility of the unchanged exit guard.
    if (movedThreat[spawn]! > .001 || movedThreat[exit]! > .001
      || path.some(cell => fromExit.distance[cell]! <= 5 * tile && movedThreat[cell]! >= CONTESTED_THREAT)) continue;
    const enemies = layout.enemySpawns.map(value => value.id === enemy.id ? moved : value);
    try {
      const result = evaluateDeployment({ ...layout, enemySpawns: enemies }, conditions, terrain);
      return { ...result, diagnostics: { ...result.diagnostics, encounterAdjustments: [{ id: enemy.id,
        from: center(g, enemy.spawn.row * g.cols + enemy.spawn.col), to: position }] } };
    } catch (error) {
      if (!(error instanceof SemanticDeploymentError)) throw error;
      lastFailure = error.message;
    }
  }
  throw new SemanticDeploymentError(`initial and ${Math.min(attempts, 12)} bounded encounter seats rejected; ${lastFailure}`);
}


export interface InteractionCheck { minimumExtraPx: number; minimumApproachThreat: number; seats: number }
/** The actual fine terrain is a placement contract, not a resampled Host mask. */
export function measureInteractionAreas(layout: GeneratedRiftLayout, terrain: SemanticDeploymentTerrain): {
  at(node: Vector2): InteractionCheck | undefined;
} {
  const grid = new TileGrid(terrain.tileMap), tile = grid.tileSize, offset = terrain.coordinateOffset;
  if (tile !== 8 || !Number.isFinite(offset.x) || !Number.isFinite(offset.y))
    throw new SemanticDeploymentError('interaction admission requires the actual 8px terrain and coordinate offset');
  const g: Graph = { cols: grid.cols, rows: grid.rows, tile, walk: new Uint8Array(grid.cols * grid.rows) };
  const point = (p: Vector2): Vector2 => ({ x: p.x + offset.x, y: p.y + offset.y });
  const coarse: Graph = { cols: layout.tileMap.cols, rows: layout.tileMap.rows, tile: layout.tileMap.tileSize,
    walk: Uint8Array.from(layout.tileMap.tiles.flat(), value => value === TileType.FLOOR || value === TileType.FRACTURE ? 1 : 0) };
  const fineSeat = (p: { col: number; row: number }): { col: number; row: number } => {
    const world = point({ x: (p.col + .5) * coarse.tile, y: (p.row + .5) * coarse.tile });
    return { col: Math.floor(world.x / tile), row: Math.floor(world.y / tile) };
  };
  const enemies = layout.enemySpawns.map(enemy => {
    const waypoints: { col: number; row: number }[] = [];
    for (let leg = 1; leg < enemy.patrol.waypoints.length; leg++) {
      const a = enemy.patrol.waypoints[leg - 1]!, b = enemy.patrol.waypoints[leg]!;
      const start = a.row * coarse.cols + a.col, goal = b.row * coarse.cols + b.col;
      const route = reconstruct(flood(coarse, [start]).parent, start, goal);
      const bends = route.filter((cell, i) => i === 0 || i === route.length - 1 || cell - route[i - 1]! !== route[i + 1]! - cell);
      for (const cell of bends) {
        const seat = fineSeat({ col: cell % coarse.cols, row: Math.floor(cell / coarse.cols) });
        const last = waypoints[waypoints.length - 1];
        if (!last || last.col !== seat.col || last.row !== seat.row) waypoints.push(seat);
      }
    }
    if (!waypoints.length) waypoints.push(fineSeat(enemy.spawn));
    return { ...enemy, spawn: fineSeat(enemy.spawn), patrol: { ...enemy.patrol, waypoints } };
  });
  const staticBodies = enemies.filter(isStaticFloorBody).map(enemy => center(g, enemy.spawn.row * g.cols + enemy.spawn.col));
  const half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2, clearance = half + GAME_CONSTANTS.AI.BODY_SIZE / 2;
  for (let cell = 0; cell < g.walk.length; cell++) {
    const p = center(g, cell);
    g.walk[cell] = bodyHasSupport(grid, p, half, half) && !staticBodies.some(body =>
      Math.abs(p.x - body.x) < clearance - .001 && Math.abs(p.y - body.y) < clearance - .001) ? 1 : 0;
  }
  const spawn = cellAt(g, point(layout.spawnPoint)), exit = point(layout.extractionPoint.position), exitSeats: number[] = [];
  for (let cell = 0; cell < g.walk.length; cell++) if (g.walk[cell]) {
    const p = center(g, cell);
    if (Math.hypot(p.x - exit.x, p.y - exit.y) <= layout.extractionPoint.triggerRadius) exitSeats.push(cell);
  }
  if (!g.walk[spawn] || !exitSeats.length) throw new SemanticDeploymentError('actual body cannot enter or use extraction area');
  const fromSpawn = shortestPaths(g, spawn), toExit = shortestPaths(g, exitSeats), direct = toExit.distance[spawn]!;
  if (!Number.isFinite(direct)) throw new SemanticDeploymentError('actual body has no extraction route');
  const senseGraph: Graph = { ...g, walk: Uint8Array.from({ length: g.walk.length }, (_, cell) =>
    grid.isWalkable(cell % g.cols, Math.floor(cell / g.cols)) ? 1 : 0) };
  const { field: threat } = buildThreat(senseGraph, grid, enemies);
  const legThreat = (cell: number, parents: Int32Array): number => {
    let travelled = 0, peak = threat[cell]!;
    while (parents[cell]! >= 0 && travelled < 96) {
      const next = parents[cell]!, a = center(g, cell), b = center(g, next);
      travelled += Math.hypot(a.x - b.x, a.y - b.y); peak = Math.max(peak, threat[next]!); cell = next;
    }
    return peak;
  };
  return { at(node): InteractionCheck | undefined {
    const target = point(node), radius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS;
    let minimumExtraPx = Infinity, minimumApproachThreat = Infinity, seats = 0;
    // Every fine-grid standing position inside the real interaction radius is
    // considered. No candidate stride, preferred-facing sample or centre shortcut.
    const left = Math.max(0, Math.ceil((target.x - radius) / tile - .5));
    const right = Math.min(g.cols - 1, Math.floor((target.x + radius) / tile - .5));
    const top = Math.max(0, Math.ceil((target.y - radius) / tile - .5));
    const bottom = Math.min(g.rows - 1, Math.floor((target.y + radius) / tile - .5));
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const cell = row * g.cols + col, p = center(g, cell);
      if (!g.walk[cell] || !Number.isFinite(fromSpawn.distance[cell]!) || !Number.isFinite(toExit.distance[cell]!)
        || Math.hypot(p.x - target.x, p.y - target.y) > radius || !hasLineOfSight(grid, p, target, radius + .001)) continue;
      seats++;
      minimumExtraPx = Math.min(minimumExtraPx, fromSpawn.distance[cell]! + toExit.distance[cell]! - direct);
      minimumApproachThreat = Math.min(minimumApproachThreat, legThreat(cell, fromSpawn.parent), legThreat(cell, toExit.parent));
    }
    return seats ? { minimumExtraPx, minimumApproachThreat, seats } : undefined;
  } };
}
