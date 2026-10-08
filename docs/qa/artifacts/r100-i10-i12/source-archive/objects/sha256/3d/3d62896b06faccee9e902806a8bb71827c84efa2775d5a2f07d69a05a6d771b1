import { findR100PatrolWindows } from './r100-patrol-windows';
import { hasLineOfSight } from '@/utils/grid-raycast';
/** Complete v3 route/content deployment on the approved native geometry. */
import { GAME_CONSTANTS } from '@/config/constants';
import { INFILTRATOR_FORM, REWRITER_FORM } from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import type { GeneratedRiftLayout } from '@/generation/types';
import { bodyDisplacementFraction, bodyHasSupport } from '@/systems/ai/physical-grid';
import { TileGrid } from '@/systems/tile-grid';
import type { Vector2, TileCoord } from '@/types/game-types';
import type { ContaminantNodeDef, EnemySpawnData, KindlingNodeDef, KindlingTier } from '@/types/map-types';
import type { PollutionGrade } from './pollution-grade';
import type { MasterWorld } from './r100-master-world';

export interface R100ExpeditionDefinition {
  readonly grade_id: PollutionGrade;
  readonly version: 1 | 2;
  readonly status: string;
  readonly label: string;
  readonly public_risk: string;
  readonly public_preparation: string;
  readonly public_reward: string;
  readonly enemy_count: number;
  readonly kindling_safe_count: number;
  readonly kindling_contested_count: number;
  readonly kindling_deep_count: number;
  readonly kindling_safe_value: number;
  readonly kindling_contested_value: number;
  readonly kindling_deep_value: number;
  readonly contaminant_safe_count: number;
  readonly contaminant_contested_count: number;
  readonly contaminant_deep_count: number;
}
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;
const HALF = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
const TIERS = ['safe', 'contested', 'deep'] as const;
interface RouteField { readonly distance: Float64Array; readonly parent: Int32Array; readonly seats: Uint8Array }
interface Seat { readonly cell: number; readonly position: Vector2; readonly distance: number; readonly approachDistance: number; readonly interactionSeats: number; readonly pollutionDistance: number }
function center(grid: TileGrid, cell: number): Vector2 {
  return { x: (cell % grid.cols + .5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + .5) * grid.tileSize };
}
function cellOf(grid: TileGrid, point: Readonly<Vector2>): number {
  return Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
}
function routes(grid: TileGrid, starts: number | readonly number[]): RouteField {
  const size = grid.cols * grid.rows, seats = new Uint8Array(size);
  for (let cell = 0; cell < size; cell++) seats[cell] = bodyHasSupport(grid, center(grid, cell), HALF, HALF) ? 1 : 0;
  const distance = new Float64Array(size).fill(Infinity), parent = new Int32Array(size).fill(-1);
  const heap: { cell: number; distance: number }[] = [];
  const push = (cell: number, cost: number): void => {
    let index = heap.length; heap.push({ cell, distance: cost });
    while (index > 0) { const above = (index - 1) >> 1; if (heap[above]!.distance <= cost) break; heap[index] = heap[above]!; index = above; }
    heap[index] = { cell, distance: cost };
  };
  const pop = (): { cell: number; distance: number } => {
    const first = heap[0]!, last = heap.pop()!;
    if (heap.length) { let index = 0;
      while (index * 2 + 1 < heap.length) { let next = index * 2 + 1;
        if (next + 1 < heap.length && heap[next + 1]!.distance < heap[next]!.distance) next++;
        if (heap[next]!.distance >= last.distance) break; heap[index] = heap[next]!; index = next;
      } heap[index] = last;
    } return first;
  };
  for (const start of typeof starts === 'number' ? [starts] : starts) {
    if (!seats[start]) throw new Error('Native production entrance lacks full body support');
    distance[start] = 0; parent[start] = start; push(start, 0);
  }
  while (heap.length) {
    const entry = pop(), cell = entry.cell;
    if (entry.distance !== distance[cell]) continue;
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols), position = center(grid, cell);
    for (const [dx, dy] of DIRECTIONS) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      const cost = entry.distance + Math.hypot(dx, dy) * grid.tileSize;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || cost >= distance[next]!
        || bodyDisplacementFraction(grid, position, HALF, HALF, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
      distance[next] = cost; parent[next] = cell; push(next, cost);
    }
  }
  return { seats, distance, parent };
}
function pathTo(grid: TileGrid, parent: Int32Array, cell: number): TileCoord[] {
  const cells = [cell];
  if (parent[cell]! < 0) throw new Error('Native production patrol target unreachable');
  while (parent[cells[cells.length - 1]!] !== cells[cells.length - 1]) cells.push(parent[cells[cells.length - 1]!]!);
  cells.reverse();
  return cells.filter((value, index) => index === 0 || index === cells.length - 1
    || value - cells[index - 1]! !== cells[index + 1]! - value)
    .map(value => ({ col: value % grid.cols, row: Math.floor(value / grid.cols) }));
}

export function deployR100Expedition(world: MasterWorld, definition: R100ExpeditionDefinition): {
  readonly layout: GeneratedRiftLayout; readonly diagnostics: Readonly<Record<string, unknown>>;
} {
  const base = world.layout, grid = new TileGrid(base.tileMap), start = cellOf(grid, base.spawnPoint), field = routes(grid, start);
  const safePoints = world.pollution.safeRoute;
  const exitSeats: number[] = [];
  for (let cell = 0; cell < field.seats.length; cell++) if (field.seats[cell]) {
    const point = center(grid, cell);
    if (Math.hypot(point.x - base.extractionPoint.position.x, point.y - base.extractionPoint.position.y) <= base.extractionPoint.triggerRadius) exitSeats.push(cell);
  }
  const toExit = routes(grid, exitSeats), directReturn = toExit.distance[start]!;
  if (!Number.isFinite(directReturn)) throw new Error('Native production cannot reach its extraction area');
  const pollutionDistance = (point: Readonly<Vector2>): number => {
    let distance = Infinity;
    for (const painted of world.pollution.paintCells) distance = Math.min(distance, Math.max(0, Math.hypot(point.x - painted.x, point.y - painted.y) - 24));
    for (const box of world.pollution.volumes) {
      const dx = Math.max(box.minCol * 32 - point.x, 0, point.x - (box.maxCol + 1) * 32);
      const dy = Math.max(box.minRow * 32 - point.y, 0, point.y - (box.maxRow + 1) * 32);
      distance = Math.min(distance, Math.hypot(dx, dy));
    }
    return distance;
  };
  const candidates: Seat[] = [];
  for (let cell = 0; cell < field.distance.length; cell++) {
    if (!Number.isFinite(field.distance[cell])) continue;
    const position = center(grid, cell);
    // One 16px candidate lattice, but all navigation/interaction remains native 8px.
    if ((cell % grid.cols) % 2 || Math.floor(cell / grid.cols) % 2) continue;
    if (Math.hypot(position.x - base.spawnPoint.x, position.y - base.spawnPoint.y) < 64
      || Math.hypot(position.x - base.extractionPoint.position.x, position.y - base.extractionPoint.position.y) < 48) continue;
    let interactionDistance = Infinity, approachDistance = Infinity, interactionSeats = 0;
    const radius = GAME_CONSTANTS.LOOT.SEARCH_RADIUS, steps = Math.ceil(radius / grid.tileSize);
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    for (let dy = -steps; dy <= steps; dy++) for (let dx = -steps; dx <= steps; dx++) {
      if (Math.hypot(dx, dy) * grid.tileSize > radius || col + dx < 0 || row + dy < 0 || col + dx >= grid.cols || row + dy >= grid.rows) continue;
      const seat = (row + dy) * grid.cols + col + dx, seatPoint = center(grid, seat);
      if (!Number.isFinite(field.distance[seat]) || !Number.isFinite(toExit.distance[seat])
        || !hasLineOfSight(world.sight, seatPoint, position, radius + .001)) continue;
      interactionSeats++;
      interactionDistance = Math.min(interactionDistance, field.distance[seat]! + toExit.distance[seat]! - directReturn);
      approachDistance = Math.min(approachDistance, field.distance[seat]!);
    }
    candidates.push({ cell, position, distance: interactionDistance, approachDistance, interactionSeats, pollutionDistance: pollutionDistance(position) });
  }
  const maxDistance = Math.max(...candidates.map(seat => seat.distance));
  const chosen: { seat: Seat; tier: KindlingTier; kind: 'kindling' | 'contaminant' }[] = [];
  const kindlingNodes: KindlingNodeDef[] = [], contaminantNodes: ContaminantNodeDef[] = [];
  for (const tier of TIERS) for (const kind of ['kindling', 'contaminant'] as const) {
    const count = definition[`${kind}_${tier}_count`];
    for (let slot = 0; slot < count; slot++) {
      const minDepth = tier === 'safe' ? 0 : tier === 'contested' ? .32 : .65;
      const maxDepth = tier === 'safe' ? .4 : tier === 'contested' ? .8 : 1;
      const allowed = candidates.filter(seat => seat.distance >= maxDistance * minDepth && seat.distance <= maxDistance * maxDepth
        && seat.pollutionDistance >= (tier === 'safe' ? 34 : 16)
        && (tier !== 'safe' || safePoints.some(point => Math.hypot(point.x - seat.position.x, point.y - seat.position.y) < 30))
        && chosen.every(other => Math.hypot(other.seat.position.x - seat.position.x, other.seat.position.y - seat.position.y) >= 52));
      const goal = maxDistance * (tier === 'safe' ? .2 : tier === 'contested' ? .57 : .85);
      const score = (seat: Seat): number => -Math.abs(seat.distance - goal)
        + (tier === 'safe' ? Math.min(100, seat.pollutionDistance) * .5 : -Math.min(180, seat.pollutionDistance) * .45)
        + mix32(base.seed, `r100-content-${kind}-${tier}-${slot}-${seat.cell}`) / 0x100000000 * 64;
      allowed.sort((a, b) => score(b) - score(a) || a.cell - b.cell);
      const seat = allowed[0];
      if (!seat) throw new Error(`Cannot admit ${kind}/${tier}/${slot} with a full native route`);
      chosen.push({ seat, tier, kind });
      const id = `r100-${kind}-${tier}-${slot + 1}`;
      if (kind === 'kindling') kindlingNodes.push({ id, tier, position: seat.position, value: definition[`kindling_${tier}_value`] });
      else contaminantNodes.push({ id, tier, position: seat.position });
    }
  }
  const threats = chosen.filter(item => item.tier !== 'safe').sort((a, b) => b.seat.distance - a.seat.distance);
  const enemies: EnemySpawnData[] = [];
  for (let slot = 0; slot < definition.enemy_count; slot++) {
    const target = threats[Math.floor(slot * threats.length / definition.enemy_count)]!.seat;
    const allowed = candidates.filter(seat => seat.distance >= maxDistance * .38 && seat.pollutionDistance >= 14
      && Math.hypot(seat.position.x - base.spawnPoint.x, seat.position.y - base.spawnPoint.y) >= 170
      && chosen.filter(item => item.tier === 'safe').every(item => Math.hypot(seat.position.x - item.seat.position.x, seat.position.y - item.seat.position.y) >= 112)
      && chosen.every(item => Math.hypot(seat.position.x - item.seat.position.x, seat.position.y - item.seat.position.y) >= 40)
      && enemies.every(enemy => Math.hypot(seat.position.x - (enemy.spawn.col + .5) * 8, seat.position.y - (enemy.spawn.row + .5) * 8) >= 96));
    allowed.sort((a, b) => Math.abs(Math.hypot(a.position.x - target.position.x, a.position.y - target.position.y) - 78)
      - Math.abs(Math.hypot(b.position.x - target.position.x, b.position.y - target.position.y) - 78) || a.cell - b.cell);
    // A legal spawn is not enough: narrow pockets can have no full patrol leg.
    // Test the ranked spawn candidates before committing an enemy to one of them.
    let seat: Seat | undefined, local: RouteField | undefined, end: Seat | undefined;
    const endpoints = candidates.filter(point => point.pollutionDistance >= 14
      && Math.hypot(point.position.x - base.spawnPoint.x, point.position.y - base.spawnPoint.y) >= 144
      && chosen.filter(item => item.tier === 'safe').every(item => Math.hypot(point.position.x - item.seat.position.x, point.position.y - item.seat.position.y) >= 96)
      && chosen.every(item => Math.hypot(point.position.x - item.seat.position.x, point.position.y - item.seat.position.y) >= 40));
    for (const candidate of allowed) {
      const route = routes(grid, candidate.cell);
      const patrolTargets = endpoints.filter(point => route.distance[point.cell]! >= 88 && route.distance[point.cell]! <= 200);
      patrolTargets.sort((a, b) => mix32(base.seed, `patrol-${slot}-${a.cell}`) - mix32(base.seed, `patrol-${slot}-${b.cell}`));
      if (!patrolTargets.length) continue;
      seat = candidate; local = route; end = patrolTargets[0]; break;
    }
    if (!seat || !local || !end) throw new Error('Native patrol has no observable moving route; static fallback is forbidden');
    const waypoints = pathTo(grid, local.parent, end.cell), hearing = slot === definition.enemy_count - 1;
    enemies.push({ id: hearing ? 'ENM_RWR_01' : `ENM_INF_${String(slot + 1).padStart(2, '0')}`,
      type: hearing ? 'rewriter' : 'infiltrator', spawn: { col: seat.cell % grid.cols, row: Math.floor(seat.cell / grid.cols) },
      facing: Math.round(Math.atan2(target.position.y - seat.position.y, target.position.x - seat.position.x) * 180 / Math.PI * 1e6) / 1e6,
      patrol: { mode: waypoints.length > 1 ? 'pingpong' : 'static', waypoints },
      form: hearing ? REWRITER_FORM : INFILTRATOR_FORM });
  }
  // A deep label must correspond to real distance AND existing hostile coverage.
  for (const item of chosen.filter(item => item.tier === 'deep')) {
    const hostile = enemies.some(enemy => enemy.patrol.waypoints.some(point =>
      Math.hypot((point.col + .5) * 8 - item.seat.position.x, (point.row + .5) * 8 - item.seat.position.y) <= 180
      && hasLineOfSight(world.sight, {x: (point.col + .5) * 8, y: (point.row + .5) * 8}, item.seat.position, 180)));
    if (!hostile && item.seat.pollutionDistance > 100) throw new Error('Deep prize has no actual hostile approach');
  }
  const searchable = [...kindlingNodes, ...contaminantNodes].filter(node => node.tier !== 'safe');
  const patrolWindows = findR100PatrolWindows(world, enemies, searchable);
  if (patrolWindows.length !== searchable.length) throw new Error(`No complete search window: ${searchable.filter(node => !patrolWindows.some(window => window.id === node.id)).map(node => node.id).join(',')}`);
  const layout: GeneratedRiftLayout = { ...base, recipeId: `r100-native-v3:${world.definition.id}`,
    kindlingNodes, contaminantNodes, enemySpawns: enemies,
    contaminationDraw: { forms: [...enemies.map(enemy => enemy.form!), ...world.pollution.forms], warnings: [] } };
  return { layout, diagnostics: { reachableBodySeats: field.distance.reduce((sum, distance) => sum + Number(Number.isFinite(distance)), 0),
    extractionRoutePx: field.distance[cellOf(grid, base.extractionPoint.position)], maximumExtraTravelPx: maxDistance, directReturnRoutePx: directReturn,
    nodes: chosen.map(item => ({ id: `${item.kind}/${item.tier}`, minimumExtraTravelPx: item.seat.distance, approachRoutePx: item.seat.approachDistance, interactionSeats: item.seat.interactionSeats, pollutionDistancePx: item.seat.pollutionDistance })),
    patrolWindows, patrolWindowContract: '2400ms unalerted-route model, dry full-body station; live approach/pursuit verified separately',
    costBasis: 'all-body-safe-48px-interaction-seats', guaranteedSafeReturn: true, enemyCount: enemies.length, kindlingCount: kindlingNodes.length, contaminantCount: contaminantNodes.length } };
}
