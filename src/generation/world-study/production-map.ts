/** Production terrain adapter: exact 8px support, existing 32px content/Host rules. */
import { GAME_CONSTANTS } from '@/config/constants';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '@/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { CONTAMINATION_DIALECT_DATA } from '@/generated/contamination-family-data';
import { rollPaintHostCount } from '@/generation/contamination-draw';
import { rollFragmentAxes } from '@/generation/fragment-roll';
import { measureOutline } from '@/generation/outline-mask';
import { deployRiftContents } from '@/generation/rift-layout';
import { mix32 } from '@/generation/seed-fork';
import { isStaticFloorBody } from '@/generation/static-body-access';
import type { GeneratedRiftLayout, RuinedMask } from '@/generation/types';
import { bodyDisplacementFraction, bodyHasSupport } from '@/systems/ai/physical-grid';
import { colonyNucleusSeatsInFloors, resolveStopLoss } from '@/systems/contamination-host-live';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type TileCoord, type Vector2 } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import { generateWorldSample } from './layout';
import { worldProfileById } from './profiles';
import { SPACE_PROFILES, validateSpaceProfile, type SpaceProfile } from './space-profile';
import { getWorldSupportGrid } from './support';
import type { WorldProfile, WorldSample } from './types';

const HOST_TILE = GAME_CONSTANTS.TILE_SIZE;
const HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
const STATIC_CLEARANCE = HALF_BODY + GAME_CONSTANTS.AI.BODY_SIZE / 2;
const MAX_ATTEMPTS = 8;
const RETRY_STRIDE = 104729;
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

export interface WorldProductionOptions {
  /** Explicit CSV encounter dialect, independent from the world's visual identity. */
  readonly contentFragmentTypeId: string;
}

export interface WorldProductionMap {
  readonly sample: WorldSample;
  readonly layout: GeneratedRiftLayout;
  /** Host pins/paint footprints retain their established 32px coordinate contract. */
  readonly hostTileMap: TileMapData;
  readonly metadata: {
    readonly world: string;
    readonly space: string;
    readonly contentFragmentTypeId: string;
    readonly requestedSeed: number;
    readonly effectiveSeed: number;
    readonly attempt: number;
    readonly rejected: readonly { seed: number; reason: string }[];
    readonly signature: string;
    readonly bodySize: number;
    readonly supportTileSize: number;
    readonly hostTileSize: number;
    readonly reachableBodySeats: number;
    readonly extractionRoutePx: number;
  };
}

function center(grid: TileGrid, cell: number): Vector2 {
  return { x: (cell % grid.cols + .5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + .5) * grid.tileSize };
}

function tileMapOf(bits: Uint8Array, cols: number, rows: number, tileSize: number): TileMapData {
  return { cols, rows, tileSize, tiles: Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => bits[row * cols + col] ? TileType.FLOOR : TileType.VOID)) };
}

/** A logical seat grants the whole 32px cell; no partial floor may host paint. */
function hostFloorOf(sample: WorldSample): { floor: Uint8Array; tileMap: TileMapData } {
  const fine = getWorldSupportGrid(sample), scale = HOST_TILE / fine.tileSize;
  const cols = fine.cols / scale, rows = fine.rows / scale;
  if (!Number.isInteger(scale) || !Number.isInteger(cols) || !Number.isInteger(rows))
    throw new Error('World support must align with the 32px Host grid');
  const floor = new Uint8Array(cols * rows);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    let supported = true;
    for (let y = 0; y < scale && supported; y++) for (let x = 0; x < scale; x++)
      if (!fine.walkable[(row * scale + y) * fine.cols + col * scale + x]) { supported = false; break; }
    floor[row * cols + col] = supported ? 1 : 0;
  }
  // Conservatively seat content only in the largest logical component. Physics
  // and rendering still retain every original 8px supported surface verbatim.
  const seen = new Uint8Array(floor.length);
  let largest: number[] = [];
  for (let first = 0; first < floor.length; first++) {
    if (!floor[first] || seen[first]) continue;
    const queue = [first]; seen[first] = 1;
    for (let at = 0; at < queue.length; at++) {
      const cell = queue[at]!, col = cell % cols, row = Math.floor(cell / cols);
      for (const [dx, dy] of DIRECTIONS) {
        const x = col + dx, y = row + dy, next = y * cols + x;
        if (x < 0 || y < 0 || x >= cols || y >= rows || !floor[next] || seen[next]) continue;
        seen[next] = 1; queue.push(next);
      }
    }
    if (queue.length > largest.length) largest = queue;
  }
  floor.fill(0);
  for (const cell of largest) floor[cell] = 1;
  return { floor, tileMap: tileMapOf(floor, cols, rows, HOST_TILE) };
}

function ruinsOf(seed: number, fragmentTypeId: string, tileMap: TileMapData, land: Uint8Array): RuinedMask {
  const { cols, rows, tileSize } = tileMap;
  return { seed, attempt: 0, fragmentTypeId, tileMap,
    outline: { seed, attempt: 0, cols, rows, tileSize, land, tileMap, metrics: measureOutline(land, cols, rows) },
    walls: new Uint8Array(land.length), features: [],
    metrics: { wallCount: 0, wallRatio: 0, featureCount: 0, leftoverConnected: true } };
}

/** Keep coarse-route bends explicit; an 8px point path must not cut a 20px corner. */
function patrolRoute(grid: TileGrid, waypoints: readonly TileCoord[]): TileCoord[] {
  if (waypoints.length < 2) return [...waypoints];
  const result: number[] = [];
  for (let leg = 1; leg < waypoints.length; leg++) {
    const from = waypoints[leg - 1]!, to = waypoints[leg]!;
    const start = from.row * grid.cols + from.col, goal = to.row * grid.cols + to.col;
    const parent = new Int32Array(grid.cols * grid.rows).fill(-1), queue = [start]; parent[start] = start;
    for (let at = 0; at < queue.length && parent[goal] === -1; at++) {
      const cell = queue[at]!, col = cell % grid.cols, row = Math.floor(cell / grid.cols);
      for (const [dx, dy] of DIRECTIONS) {
        const x = col + dx, y = row + dy, next = y * grid.cols + x;
        if (!grid.isWalkable(x, y) || parent[next] !== -1) continue;
        parent[next] = cell; queue.push(next);
      }
    }
    if (parent[goal] === -1) throw new Error('No conservative body-safe patrol route');
    const path = [goal];
    while (path[path.length - 1] !== start) path.push(parent[path[path.length - 1]!]!);
    path.reverse(); result.push(...(leg === 1 ? path : path.slice(1)));
  }
  return result.filter((cell, i) => i === 0 || i === result.length - 1 || cell - result[i - 1]! !== result[i + 1]! - cell)
    .map(cell => ({ col: cell % grid.cols, row: Math.floor(cell / grid.cols) }));
}

/** Run the actual production crop/nucleus selection so no Host quota evaporates. */
function admitPaintHosts(layout: GeneratedRiftLayout, hostGrid: TileGrid): void {
  const forms = layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing');
  const config = GAME_CONSTANTS.CONTAMINATION;
  for (const [slot, form] of forms.entries()) {
    const pin = layout.contaminationPins.paintFloors[slot]!;
    const seed = mix32(layout.seed, `ENM_BING_${String(slot + 1).padStart(2, '0')}`);
    const baked = bakePaintGenome({ substrate: form.substrate, coverage: form.coverage, seed,
      continuity: form.continuity, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
      fragmentTypeId: layout.fragmentTypeId, veinVariant: resolvePaintVeinVariant(form.substrate, seed) });
    const floors = collectPaintGenomeFloorTiles(baked.field, baked.canvasW, baked.canvasH,
      (pin.floorCol + .5) * HOST_TILE, (pin.floorRow + .5) * HOST_TILE, HOST_TILE)
      .filter(point => hostGrid.isWalkable(point.col, point.row));
    const stop = resolveStopLoss(form);
    if (stop === 'illegal' || floors.length === 0) throw new Error('Paint Host has no legal production surface');
    if (stop.family === 'scatter_rejoin' && colonyNucleusSeatsInFloors(floors,
      config.COLONY_NUCLEUS_COUNT_MIN, config.COLONY_NUCLEUS_COUNT_MAX,
      config.COLONY_NUCLEUS_MIN_TILE_GAP, 2).length < config.COLONY_NUCLEUS_COUNT_MIN)
      throw new Error('Paint Host lost its production nucleus quota');
  }
}

/** Validate the actual 20px player/body routes after changing coordinate grids. */
function physicalAdmission(layout: GeneratedRiftLayout): { reachableBodySeats: number; extractionRoutePx: number } {
  const grid = new TileGrid(layout.tileMap), total = grid.cols * grid.rows;
  const bodies = layout.enemySpawns.filter(isStaticFloorBody).map(enemy =>
    ({ x: (enemy.spawn.col + .5) * grid.tileSize, y: (enemy.spawn.row + .5) * grid.tileSize }));
  const seats = new Uint8Array(total), distances = new Int32Array(total).fill(-1);
  const index = (point: Readonly<Vector2>) => Math.floor(point.y / grid.tileSize) * grid.cols + Math.floor(point.x / grid.tileSize);
  for (let cell = 0; cell < total; cell++) {
    const point = center(grid, cell);
    seats[cell] = bodyHasSupport(grid, point, HALF_BODY, HALF_BODY)
      && !bodies.some(body => Math.abs(point.x - body.x) < STATIC_CLEARANCE - .001
        && Math.abs(point.y - body.y) < STATIC_CLEARANCE - .001) ? 1 : 0;
  }
  const start = index(layout.spawnPoint);
  if (!seats[start]) throw new Error('Production spawn lacks static-body-safe support');
  const queue = [start]; distances[start] = 0;
  for (let at = 0; at < queue.length; at++) {
    const cell = queue[at]!, col = cell % grid.cols, row = Math.floor(cell / grid.cols), from = center(grid, cell);
    for (const [dx, dy] of DIRECTIONS) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || distances[next] !== -1) continue;
      if (bodyDisplacementFraction(grid, from, HALF_BODY, HALF_BODY, dx * grid.tileSize, dy * grid.tileSize) < 1) continue;
      distances[next] = distances[cell]! + 1; queue.push(next);
    }
  }
  const targets = [layout.extractionPoint.position, ...layout.kindlingNodes.map(node => node.position),
    ...layout.contaminantNodes.map(node => node.position)];
  for (const target of targets) if (distances[index(target)]! < 0)
    throw new Error('Production target lacks a complete body route around permanent enemies');
  for (const enemy of layout.enemySpawns) for (const point of [enemy.spawn, ...enemy.patrol.waypoints]) {
    if (!bodyHasSupport(grid, { x: (point.col + .5) * grid.tileSize, y: (point.row + .5) * grid.tileSize }, HALF_BODY, HALF_BODY))
      throw new Error(`Enemy ${enemy.id} lacks complete body support`);
  }
  for (const enemy of layout.enemySpawns) for (let i = 1; i < enemy.patrol.waypoints.length; i++) {
    const a = enemy.patrol.waypoints[i - 1]!, b = enemy.patrol.waypoints[i]!;
    const from = { x: (a.col + .5) * grid.tileSize, y: (a.row + .5) * grid.tileSize };
    if (bodyDisplacementFraction(grid, from, HALF_BODY, HALF_BODY, (b.col - a.col) * grid.tileSize, (b.row - a.row) * grid.tileSize) < 1)
      throw new Error(`Enemy ${enemy.id} patrol crosses unsupported terrain`);
  }
  return { reachableBodySeats: queue.length, extractionRoutePx: distances[index(layout.extractionPoint.position)]! * grid.tileSize };
}

function admit(sample: WorldSample, space: SpaceProfile, options: WorldProductionOptions,
  requestedSeed: number, attempt: number, rejected: readonly { seed: number; reason: string }[]): WorldProductionMap {
  const support = getWorldSupportGrid(sample), host = hostFloorOf(sample), axes = rollFragmentAxes(sample.seed);
  const hostGrid = new TileGrid(host.tileMap);
  const deployed = deployRiftContents(sample.seed, ruinsOf(sample.seed, options.contentFragmentTypeId, host.tileMap, host.floor), {
    recipeId: `world-space:${space.id}`, ...axes,
    routePolicy: 'open-world',
    // Void is an occluder in the accepted terrain. This mask changes only route
    // exposure measurements; no WALL is invented for rendering, physics or pins.
    routeObstructions: Uint8Array.from(host.floor, floor => floor ? 0 : 1),
  });
  if (typeof deployed === 'string') throw new Error(deployed);
  const fragmentTypeId = `world-study:${sample.profile.id}`;
  const tileMap = tileMapOf(support.walkable, support.cols, support.rows, support.tileSize);
  const scale = HOST_TILE / support.tileSize;
  const fineCell = (point: TileCoord): TileCoord => ({ col: point.col * scale + Math.floor(scale / 2), row: point.row * scale + Math.floor(scale / 2) });
  // A common 4px translation keeps all native actors/nodes on integer 8px cells.
  // Every admitted 32px cell is entirely supported, including the 20px body.
  const finePoint = (point: Readonly<Vector2>): Vector2 => ({ x: point.x + support.tileSize / 2, y: point.y + support.tileSize / 2 });
  const layout: GeneratedRiftLayout = { ...deployed, fragmentTypeId, tileMap, walkableMask: new TileGrid(tileMap),
    ruins: { ...ruinsOf(sample.seed, fragmentTypeId, tileMap, support.walkable.slice()), ...axes },
    spawnPoint: finePoint(deployed.spawnPoint), extractionPoint: { ...deployed.extractionPoint, position: finePoint(deployed.extractionPoint.position) },
    kindlingNodes: deployed.kindlingNodes.map(node => ({ ...node, position: finePoint(node.position) })),
    contaminantNodes: deployed.contaminantNodes.map(node => ({ ...node, position: finePoint(node.position) })),
    enemySpawns: deployed.enemySpawns.map(enemy => ({ ...enemy, spawn: fineCell(enemy.spawn),
      patrol: { ...enemy.patrol, waypoints: patrolRoute(hostGrid, enemy.patrol.waypoints).map(fineCell) } })),
    landmarks: deployed.landmarks.map(landmark => ({ ...landmark, ...fineCell(landmark) })),
  };
  const expectedPaint = rollPaintHostCount(sample.seed, axes.contaminationAge);
  if (layout.kindlingNodes.length !== 8 || layout.contaminantNodes.length !== 3
    || layout.enemySpawns.length < 3 || layout.enemySpawns.length > 4
    || layout.contaminationPins.paintFloors.length !== expectedPaint
    || layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing').length !== expectedPaint
    || layout.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length !== 1)
    throw new Error('Production content quota or hearing budget was lost');
  const access = physicalAdmission(layout);
  admitPaintHosts(layout, hostGrid);
  let hash = 2166136261;
  for (const floor of support.walkable) hash = Math.imul(hash ^ floor, 16777619);
  for (const floor of host.floor) hash = Math.imul(hash ^ floor, 16777619);
  const definition = JSON.stringify({ profile: sample.profile, space, contentFragmentTypeId: options.contentFragmentTypeId,
    seed: sample.seed, ...axes, spawnPoint: layout.spawnPoint, extraction: layout.extractionPoint,
    kindling: layout.kindlingNodes, contaminants: layout.contaminantNodes, enemies: layout.enemySpawns,
    landmarks: layout.landmarks, pins: layout.contaminationPins, draw: layout.contaminationDraw });
  for (let i = 0; i < definition.length; i++) hash = Math.imul(hash ^ definition.charCodeAt(i), 16777619);
  return { sample, layout, hostTileMap: host.tileMap, metadata: {
    world: sample.profile.id, space: space.id, contentFragmentTypeId: options.contentFragmentTypeId,
    requestedSeed, effectiveSeed: sample.seed, attempt, rejected: [...rejected],
    signature: (hash >>> 0).toString(16).padStart(8, '0'), bodySize: HALF_BODY * 2,
    supportTileSize: support.tileSize, hostTileSize: HOST_TILE, ...access,
  } };
}

/** Snapshots are accepted directly so checkpoint replay never reselects CSV rows. */
export function createWorldProductionMap(world: string | WorldProfile, spaceInput: string | SpaceProfile,
  requestedSeed: number, options: WorldProductionOptions): WorldProductionMap {
  if (!Number.isSafeInteger(requestedSeed) || requestedSeed < 0 || requestedSeed > 0xffffffff)
    throw new Error('Production world seed must be an unsigned 32-bit integer');
  const profile = typeof world === 'string' ? worldProfileById(world) : world;
  const space = typeof spaceInput === 'string' ? SPACE_PROFILES.find(value => value.id === spaceInput) : spaceInput;
  if (!space) throw new Error(`Unknown space ${String(spaceInput)}`);
  validateSpaceProfile(space);
  if (!CONTAMINATION_DIALECT_DATA[options.contentFragmentTypeId])
    throw new Error(`Unregistered production content dialect: ${options.contentFragmentTypeId}`);
  const rejected: { seed: number; reason: string }[] = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const seed = (requestedSeed + attempt * RETRY_STRIDE) >>> 0;
    try { return admit(generateWorldSample(profile, 'loops', seed, space), space, options, requestedSeed, attempt, rejected); }
    catch (reason) { rejected.push({ seed, reason: reason instanceof Error ? reason.message : String(reason) }); }
  }
  throw new Error(`Production world admission failed after ${MAX_ATTEMPTS} bounded candidates: ${JSON.stringify(rejected)}`);
}
