/** DEV-only, CSV-authored spatial study. The normal world catalog is untouched. */
import { GAME_CONSTANTS } from '@/config/constants';
import { SPATIAL_PROTOTYPE_CONFIG as CONFIG, SPATIAL_PROTOTYPE_EROSION, SPATIAL_PROTOTYPE_VOLUMES, SPATIAL_PROTOTYPE_ANCHORS, SPATIAL_PROTOTYPE_SOURCE_HASH } from '@/generated/rift-spatial-prototype-data';
import { mix32 } from '@/generation/seed-fork';
import { createMasterWorld, type MasterWorld, type MasterGrade, type MasterDefinition } from '@/generation/world-study/r100-master-world';
import { createR100ProductionRecipe } from '@/generation/world-study/r100-package';
import type { R100WorldAppearance } from '@/generation/world-study/r100-world-appearance';
import type { WorldProfile } from '@/generation/world-study/types';
import { bodyHasSupport, bodyDisplacementFraction } from '@/systems/ai/physical-grid';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type Vector2 } from '@/types/game-types';

export interface SpatialPrototypeAnchor {
  readonly id: string;
  readonly label: string;
  readonly role: 'spawn' | 'extraction' | 'region' | 'branch' | 'route';
  readonly point: Readonly<Vector2>;
}
export interface SpatialPrototypeRoute {
  readonly id: string;
  readonly label: string;
  readonly points: readonly Readonly<Vector2>[];
  readonly lengthPx: number;
}
export interface SpatialPrototype {
  readonly world: MasterWorld;
  readonly profile: WorldProfile;
  readonly appearance: R100WorldAppearance;
  readonly metrics: Readonly<Record<string, unknown>>;
  readonly anchors: readonly SpatialPrototypeAnchor[];
  readonly routes: readonly SpatialPrototypeRoute[];
}
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
const HALF = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
interface BodyField { grid: TileGrid; seats: Uint8Array; reachable: Uint8Array; count: number; center: (cell: number) => Vector2; cell: (point: Readonly<Vector2>) => number }
function bodyField(world: MasterWorld): BodyField {
  const grid = new TileGrid(world.layout.tileMap), seats = new Uint8Array(grid.cols * grid.rows);
  const center = (cell: number): Vector2 => ({ x: (cell % grid.cols + .5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + .5) * grid.tileSize });
  const cell = (point: Readonly<Vector2>): number => Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
  for (let i = 0; i < seats.length; i++) seats[i] = Number(bodyHasSupport(grid, center(i), HALF, HALF));
  const start = cell(world.layout.spawnPoint), queue = [start], reachable = new Uint8Array(seats.length); reachable[start] = 1;
  for (let at = 0; at < queue.length; at++) {
    const current = queue[at]!, col = current % grid.cols, row = Math.floor(current / grid.cols);
    for (const [dx, dy] of DIRECTIONS) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || reachable[next]) continue;
      if (bodyDisplacementFraction(grid, center(current), HALF, HALF, dx * grid.tileSize, dy * grid.tileSize) !== 1) continue;
      reachable[next] = 1; queue.push(next);
    }
  }
  return { grid, seats, reachable, count: queue.length, center, cell };
}
function closest(field: BodyField, point: Readonly<Vector2>): Vector2 {
  let best = -1, distance = Infinity;
  for (let cell = 0; cell < field.reachable.length; cell++) {
    if (!field.reachable[cell]) continue;
    const candidate = field.center(cell), value = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2;
    if (value < distance) { distance = value; best = cell; }
  }
  if (best < 0) throw new Error('Spatial prototype has no body-supported anchor');
  return field.center(best);
}
function path(field: BodyField, from: Readonly<Vector2>, to: Readonly<Vector2>): Vector2[] {
  const start = field.cell(from), target = field.cell(to), queue = [start], parents = new Int32Array(field.seats.length).fill(-1);
  parents[start] = start;
  for (let at = 0; at < queue.length && parents[target] === -1; at++) {
    const cell = queue[at]!, col = cell % field.grid.cols, row = Math.floor(cell / field.grid.cols);
    for (const [dx, dy] of DIRECTIONS) {
      const x = col + dx, y = row + dy, next = y * field.grid.cols + x;
      if (x < 0 || y < 0 || x >= field.grid.cols || y >= field.grid.rows || !field.seats[next] || parents[next] !== -1) continue;
      if (bodyDisplacementFraction(field.grid, field.center(cell), HALF, HALF, dx * field.grid.tileSize, dy * field.grid.tileSize) !== 1) continue;
      parents[next] = cell; queue.push(next);
    }
  }
  if (parents[target] === -1) throw new Error('Spatial prototype route is not body reachable');
  const cells = [target];
  while (cells[cells.length - 1] !== start) cells.push(parents[cells[cells.length - 1]!]!);
  return cells.reverse().map(field.center);
}
function simplify(points: readonly Readonly<Vector2>[]): readonly Readonly<Vector2>[] {
  return points.filter((point, index) => {
    if (index === 0 || index === points.length - 1) return true;
    const before = points[index - 1]!, after = points[index + 1]!;
    return (point.x - before.x) * (after.y - point.y) !== (point.y - before.y) * (after.x - point.x);
  });
}

/** Uses exactly the production geometry, material identity and body-grid rules.
 * Content placement remains a marked spatial study, not a production admission. */
export function createSpatialPrototype(seed: number, grade: MasterGrade = 'medium'): SpatialPrototype {
  const source = createR100ProductionRecipe(CONFIG.world_id, seed, grade);
  if (!source.appearance) throw new Error('Spatial prototype requires its existing world material identity');
  const candidateRows = SPATIAL_PROTOTYPE_ANCHORS.filter(row => row.role === 'candidate');
  const candidates = [...candidateRows].sort((a, b) => mix32(seed, `spatial-spawn-${a.id}`) - mix32(seed, `spatial-spawn-${b.id}`));
  const spawn = candidates[0]!;
  const paired = candidateRows.filter(row => {
    const distance = Math.hypot(row.x - spawn.x, row.y - spawn.y);
    return distance >= CONFIG.anchor_pair_min_distance && distance <= CONFIG.anchor_pair_max_distance;
  }).sort((a, b) => mix32(seed, `spatial-exit-${a.id}`) - mix32(seed, `spatial-exit-${b.id}`));
  const exit = paired[0]; if (!exit) throw new Error('Spatial prototype has no near-side retreat pair');
  const branch = SPATIAL_PROTOTYPE_ANCHORS.find(row => row.role === 'branch')!;
  const region = SPATIAL_PROTOTYPE_ANCHORS.find(row => row.role === 'region')!;
  const definition: MasterDefinition = { ...source.nativeDefinition,
    id: `${CONFIG.world_id}-spatial-${grade}`, label: `${source.nativeDefinition.label} · 空间原型`,
    cols: CONFIG.cols, rows: CONFIG.rows, seed,
    spawn_x: spawn.x, spawn_y: spawn.y, exit_x: exit.x, exit_y: exit.y,
    search_x: branch.x, search_y: branch.y, enemy_x: region.x, enemy_y: region.y,
    instances: SPATIAL_PROTOTYPE_VOLUMES, erosion: SPATIAL_PROTOTYPE_EROSION.map(row => row.points),
  };
  const base = createMasterWorld(definition, seed, { grade: source.gradeDefinition, profile: source.profile });
  const actualRetreatDistance = Math.hypot(base.layout.spawnPoint.x - base.layout.extractionPoint.position.x, base.layout.spawnPoint.y - base.layout.extractionPoint.position.y);
  if (actualRetreatDistance < CONFIG.anchor_pair_min_distance || actualRetreatDistance > CONFIG.anchor_pair_max_distance)
    throw new Error('Spatial prototype actual retreat pair escaped its near-side range');
  const world: MasterWorld = { ...base, algorithmRevision: 6, appearance: source.appearance };
  const field = bodyField(world);
  const anchors: SpatialPrototypeAnchor[] = [
    { id: 'spawn', label: '进入', role: 'spawn', point: world.layout.spawnPoint },
    { id: 'extraction', label: '撤离', role: 'extraction', point: world.layout.extractionPoint.position },
    ...SPATIAL_PROTOTYPE_ANCHORS.filter(row => row.role !== 'candidate').map(row => ({ id: row.id, label: row.label,
      role: row.role as 'region' | 'branch' | 'route', point: closest(field, row) })),
  ];
  const anchor = (id: string): Readonly<Vector2> => { const result = anchors.find(row => row.id === id); if (!result) throw new Error(`Unknown spatial anchor ${id}`); return result.point; };
  const routes: SpatialPrototypeRoute[] = [];
  function addRoute(id: string, label: string, via: readonly string[]): void {
    const points: Vector2[] = [];
    for (let index = 1; index < via.length; index++) points.push(...path(field, anchor(via[index - 1]!), anchor(via[index]!)).slice(index === 1 ? 0 : 1));
    // Remove waypoint-induced excursions instead of presenting backtracking
    // as an alternative route. The checker separately verifies route overlap.
    const simple: Vector2[] = [], positions = new Map<number, number>();
    for (const point of points) {
      const cell = field.cell(point), repeated = positions.get(cell);
      if (repeated !== undefined) {
        for (const removed of simple.splice(repeated + 1)) positions.delete(field.cell(removed));
      } else { positions.set(cell, simple.length); simple.push(point); }
    }
    routes.push({ id, label, points: simplify(simple), lengthPx: Math.max(0, simple.length - 1) * field.grid.tileSize });
  }
  addRoute('retreat', '近侧撤离', ['spawn', 'extraction']);
  for (const side of ['west', 'east'] as const) for (const route of ['north', 'south'] as const)
    addRoute(`${side}-${route}`, `${side === 'west' ? '西脊' : '东脊'}${route === 'north' ? '北绕' : '南绕'}`, [`${side}-loop-from`, `${side}-loop-${route}`, `${side}-loop-to`]);
  for (const target of anchors.filter(row => row.role === 'branch')) addRoute(`to-${target.id}`, target.label, ['spawn', target.id]);
  const matter = world.layout.tileMap.tiles.flat().filter(value => value !== TileType.VOID).length;
  const solid = world.layout.tileMap.tiles.flat().filter(value => value === TileType.WALL).length;
  const supported = field.seats.reduce((sum, value) => sum + value, 0);
  const baseline = createMasterWorld(source.nativeDefinition, seed, { grade: source.gradeDefinition, profile: source.profile });
  const baselineCount = baseline.diagnostics.reachableBodySeats as number;
  const relocation = anchors.filter(row => row.role !== 'spawn' && row.role !== 'extraction').map(row => {
    const requested = SPATIAL_PROTOTYPE_ANCHORS.find(item => item.id === row.id)!;
    return { id: row.id, distancePx: Math.hypot(requested.x - row.point.x, requested.y - row.point.y) };
  });
  if (relocation.some(row => row.distancePx > 64)) throw new Error('Spatial review anchor moved outside its intended locality');
  const metrics = {
    seed, grade, sourceHash: SPATIAL_PROTOTYPE_SOURCE_HASH, worldId: CONFIG.world_id,
    sourceMode: 'DEV-only CSV geometry, production renderer and 20px body checks',
    width: world.raster.width, height: world.raster.height, bodySize: CONFIG.body_size,
    baselineReachableBodySeats: baselineCount, reachableBodySeats: field.count,
    reachableBodyAreaPx: field.count * field.grid.tileSize ** 2, areaMultiplier: field.count / baselineCount,
    terrainFillRatio: matter / field.seats.length, solidTerrainRatio: solid / matter,
    bodyReachableRatio: field.count / supported, unreachableBodySeats: supported - field.count,
    solidObjectCount: definition.instances.filter(row => row.role === 'solid').length,
    spawnCandidate: spawn.id, exitCandidate: exit.id, spawn: world.layout.spawnPoint, extraction: world.layout.extractionPoint.position,
    actualRetreatDistancePx: actualRetreatDistance,
    spawnRelocationPx: Math.hypot(spawn.x - world.layout.spawnPoint.x, spawn.y - world.layout.spawnPoint.y),
    extractionRelocationPx: Math.hypot(exit.x - world.layout.extractionPoint.position.x, exit.y - world.layout.extractionPoint.position.y),
    anchorRelocations: relocation, routes: routes.map(({ id, lengthPx }) => ({ id, lengthPx })),
    baselineBounds: { width: baseline.raster.width, height: baseline.raster.height },
    verificationBoundary: 'No live encounter/economy or fogged playtest. Ordinary solids are physical, not a new line-of-sight rule.',
  };
  return { world: { ...world, diagnostics: { ...world.diagnostics, spatialPrototype: metrics } }, profile: source.profile, appearance: source.appearance, metrics, anchors, routes };
}
