/** DEV spatial study: extraction is discovered across the reachable world,
 * independently of authored spawn anchors or a presumed opposite shore. */
import { GAME_CONSTANTS } from '@/config/constants';
import { mix32 } from '@/generation/seed-fork';
import { bodyDisplacementFraction, bodyHasSupport } from '@/systems/ai/physical-grid';
import type { TileGrid } from '@/systems/tile-grid';
import type { Vector2 } from '@/types/game-types';
import { SeededRandom } from '@/utils/random';

export interface SpatialExtractionPolicy {
  readonly minPathDistancePx: number;
  readonly minEuclideanDistancePx: number;
  readonly minPathFraction: number;
  readonly maxPathFraction: number;
  readonly clearanceHalfSize: number;
  readonly regionCols: number;
  readonly regionRows: number;
  readonly distanceBands: number;
}
export interface SpatialExtractionCandidate {
  readonly point: Readonly<Vector2>;
  readonly cell: number;
  /** Eight-way shortest route to the marker centre, in world pixels. */
  readonly pathDistancePx: number;
  /** Earliest reachable body seat inside the real extraction trigger circle. */
  readonly interactionPathDistancePx: number;
  readonly euclideanDistancePx: number;
  readonly pathFraction: number;
  readonly regionId: number;
  readonly distanceBand: number;
}
export interface SpatialExtractionSummary {
  readonly reachableCount: number;
  readonly maxPathDistancePx: number;
  readonly minCandidatePathDistancePx: number;
  readonly maxCandidatePathDistancePx: number;
  readonly candidateCount: number;
  readonly regionCount: number;
  readonly distanceBandCount: number;
  readonly regionCounts: Readonly<Record<number, number>>;
  readonly distanceBandCounts: Readonly<Record<number, number>>;
}
export interface SpatialExtractionField {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly spawn: Readonly<Vector2>;
  readonly policy: SpatialExtractionPolicy;
  readonly distances: Float64Array;
  readonly parents: Int32Array;
  readonly candidates: readonly SpatialExtractionCandidate[];
  readonly summary: SpatialExtractionSummary;
}
export interface SpatialExtractionSelection extends SpatialExtractionCandidate {
  readonly candidateCount: number;
  readonly regionCount: number;
}

const HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/** Indexed heap: each body seat has at most one pending entry. */
class DistanceHeap {
  private readonly cells: Int32Array;
  private readonly positions: Int32Array;
  private size = 0;
  constructor(private readonly distances: Float64Array) {
    this.cells = new Int32Array(distances.length);
    this.positions = new Int32Array(distances.length).fill(-1);
  }
  addOrDecrease(cell: number): void {
    let at = this.positions[cell]!;
    if (at === -1) { at = this.size++; this.cells[at] = cell; }
    while (at > 0) {
      const parent = (at - 1) >> 1, parentCell = this.cells[parent]!;
      if (this.distances[parentCell]! <= this.distances[cell]!) break;
      this.cells[at] = parentCell; this.positions[parentCell] = at; at = parent;
    }
    this.cells[at] = cell; this.positions[cell] = at;
  }
  pop(): number | undefined {
    if (this.size === 0) return undefined;
    const first = this.cells[0]!, last = this.cells[--this.size]!;
    this.positions[first] = -1;
    if (this.size === 0) return first;
    let at = 0;
    while (at * 2 + 1 < this.size) {
      let child = at * 2 + 1;
      if (child + 1 < this.size && this.distances[this.cells[child + 1]!]! < this.distances[this.cells[child]!]!) child++;
      const childCell = this.cells[child]!;
      if (this.distances[last]! <= this.distances[childCell]!) break;
      this.cells[at] = childCell; this.positions[childCell] = at; at = child;
    }
    this.cells[at] = last; this.positions[last] = at;
    return first;
  }
}

function validatePolicy(policy: SpatialExtractionPolicy): void {
  if (![policy.minPathDistancePx, policy.minEuclideanDistancePx, policy.minPathFraction,
    policy.maxPathFraction, policy.clearanceHalfSize, policy.regionCols, policy.regionRows,
    policy.distanceBands].every(Number.isFinite)
    || policy.minPathDistancePx <= 0 || policy.minEuclideanDistancePx <= 0
    || policy.minPathFraction < 0 || policy.maxPathFraction > 1 || policy.minPathFraction >= policy.maxPathFraction
    || policy.clearanceHalfSize < HALF_BODY
    || ![policy.regionCols, policy.regionRows, policy.distanceBands].every(value => Number.isInteger(value) && value > 0)) {
    throw new Error('Invalid spatial extraction policy');
  }
}

/** Computes once per actual geometry + spawn. Seed sampling can then be audited
 * without repeatedly rebuilding or rendering the same multi-megapixel world. */
export function buildSpatialExtractionField(
  grid: TileGrid,
  spawn: Readonly<Vector2>,
  policy: SpatialExtractionPolicy,
): SpatialExtractionField {
  validatePolicy(policy);
  if (!bodyHasSupport(grid, spawn, HALF_BODY, HALF_BODY)) throw new Error('Spatial extraction spawn lacks complete body support');
  const count = grid.cols * grid.rows, size = grid.tileSize;
  const seats = new Uint8Array(count), settled = new Uint8Array(count);
  const distances = new Float64Array(count).fill(Infinity), parents = new Int32Array(count).fill(-1);
  const centre = (cell: number): Vector2 => ({ x: (cell % grid.cols + .5) * size, y: (Math.floor(cell / grid.cols) + .5) * size });
  for (let cell = 0; cell < count; cell++) seats[cell] = Number(bodyHasSupport(grid, centre(cell), HALF_BODY, HALF_BODY));
  const heap = new DistanceHeap(distances);
  const spawnCol = Math.floor(spawn.x / size), spawnRow = Math.floor(spawn.y / size);
  // Connect the exact spawn to nearby body seats with the same continuous sweep;
  // do not teleport a blocked or off-grid start into the reachable component.
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const col = spawnCol + dx, row = spawnRow + dy, cell = row * grid.cols + col;
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows || !seats[cell]) continue;
    const point = centre(cell), moveX = point.x - spawn.x, moveY = point.y - spawn.y;
    if ((moveX !== 0 || moveY !== 0) && bodyDisplacementFraction(grid, spawn, HALF_BODY, HALF_BODY, moveX, moveY) !== 1) continue;
    distances[cell] = Math.hypot(moveX, moveY); heap.addOrDecrease(cell);
  }
  let reachableCount = 0, maxPathDistancePx = 0;
  for (let current = heap.pop(); current !== undefined; current = heap.pop()) {
    settled[current] = 1; reachableCount++;
    const distance = distances[current]!, point = centre(current);
    maxPathDistancePx = Math.max(maxPathDistancePx, distance);
    const col = current % grid.cols, row = Math.floor(current / grid.cols);
    for (const [dx, dy] of DIRECTIONS) {
      const x = col + dx, y = row + dy, next = y * grid.cols + x;
      if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !seats[next] || settled[next]) continue;
      const candidateDistance = distance + size * Math.hypot(dx, dy);
      if (candidateDistance >= distances[next]!) continue;
      if (bodyDisplacementFraction(grid, point, HALF_BODY, HALF_BODY, dx * size, dy * size) !== 1) continue;
      distances[next] = candidateDistance; parents[next] = current; heap.addOrDecrease(next);
    }
  }
  const minPath = Math.max(policy.minPathDistancePx, maxPathDistancePx * policy.minPathFraction);
  const maxPath = maxPathDistancePx * policy.maxPathFraction;
  const candidates: SpatialExtractionCandidate[] = [], regionCounts: Record<number, number> = {}, distanceBandCounts: Record<number, number> = {};
  let minCandidatePathDistancePx = Infinity, maxCandidatePathDistancePx = 0;
  const triggerRadius = GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS, triggerOffsets: { dx: number; dy: number }[] = [];
  for (let dy = -Math.floor(triggerRadius / size); dy <= Math.floor(triggerRadius / size); dy++) {
    for (let dx = -Math.floor(triggerRadius / size); dx <= Math.floor(triggerRadius / size); dx++) {
      if (Math.hypot(dx * size, dy * size) <= triggerRadius) triggerOffsets.push({ dx, dy });
    }
  }
  for (let cell = 0; cell < count; cell++) {
    const pathDistancePx = distances[cell]!;
    if (!Number.isFinite(pathDistancePx) || pathDistancePx < minPath || pathDistancePx > maxPath) continue;
    const point = centre(cell), euclideanDistancePx = Math.hypot(point.x - spawn.x, point.y - spawn.y);
    if (euclideanDistancePx < policy.minEuclideanDistancePx || !bodyHasSupport(grid, point, policy.clearanceHalfSize, policy.clearanceHalfSize)) continue;
    // Extraction currently checks radius, not line of sight. Include every
    // reachable trigger seat, including one separated from the centre by a wall.
    let interactionPathDistancePx = pathDistancePx;
    const col = cell % grid.cols, row = Math.floor(cell / grid.cols);
    for (const offset of triggerOffsets) {
      const x = col + offset.dx, y = row + offset.dy;
      if (x >= 0 && y >= 0 && x < grid.cols && y < grid.rows) interactionPathDistancePx = Math.min(interactionPathDistancePx, distances[y * grid.cols + x]!);
    }
    if (interactionPathDistancePx < minPath) continue;
    const regionCol = Math.min(policy.regionCols - 1, Math.floor(point.x / grid.widthPx * policy.regionCols));
    const regionRow = Math.min(policy.regionRows - 1, Math.floor(point.y / grid.heightPx * policy.regionRows));
    const regionId = regionRow * policy.regionCols + regionCol;
    const distanceBand = Math.min(policy.distanceBands - 1, Math.floor((pathDistancePx - minPath) / Math.max(size, maxPath - minPath) * policy.distanceBands));
    candidates.push({ point, cell, pathDistancePx, interactionPathDistancePx, euclideanDistancePx, pathFraction: pathDistancePx / maxPathDistancePx, regionId, distanceBand });
    minCandidatePathDistancePx = Math.min(minCandidatePathDistancePx, pathDistancePx);
    maxCandidatePathDistancePx = Math.max(maxCandidatePathDistancePx, pathDistancePx);
    regionCounts[regionId] = (regionCounts[regionId] ?? 0) + 1;
    distanceBandCounts[distanceBand] = (distanceBandCounts[distanceBand] ?? 0) + 1;
  }
  if (candidates.length === 0) throw new Error(`Spatial extraction has no legal exploration candidate (reachable=${reachableCount}, maxPath=${Math.round(maxPathDistancePx)})`);
  const summary: SpatialExtractionSummary = { reachableCount, maxPathDistancePx,
    minCandidatePathDistancePx, maxCandidatePathDistancePx,
    candidateCount: candidates.length, regionCount: Object.keys(regionCounts).length,
    distanceBandCount: Object.keys(distanceBandCounts).length, regionCounts, distanceBandCounts };
  return { cols: grid.cols, rows: grid.rows, tileSize: size, spawn: { ...spawn }, policy: { ...policy }, distances, parents, candidates, summary };
}

/** Equal draws across occupied distance bands, then occupied spatial regions.
 * Large open basins cannot win solely by containing more candidate pixels. */
export function selectSpatialExtraction(field: SpatialExtractionField, seed: number): SpatialExtractionSelection {
  const rng = new SeededRandom(mix32(seed, 'spatial-extraction-exploration-v1'));
  const band = rng.pick(Object.keys(field.summary.distanceBandCounts).map(Number));
  const bandCandidates = field.candidates.filter(candidate => candidate.distanceBand === band);
  const region = rng.pick([...new Set(bandCandidates.map(candidate => candidate.regionId))]);
  const candidate = rng.pick(bandCandidates.filter(candidate => candidate.regionId === region));
  if (!candidate) throw new Error('Spatial extraction field has no selectable candidate');
  return { ...candidate, candidateCount: field.summary.candidateCount, regionCount: field.summary.regionCount };
}

export function getSpatialExtractionPath(field: SpatialExtractionField, cell: number): readonly Readonly<Vector2>[] {
  if (!Number.isInteger(cell) || cell < 0 || cell >= field.distances.length || !Number.isFinite(field.distances[cell])) throw new Error('Spatial extraction path target is not reachable');
  const points: Readonly<Vector2>[] = [];
  for (let current = cell; current !== -1; current = field.parents[current]!) {
    points.push({ x: (current % field.cols + .5) * field.tileSize, y: (Math.floor(current / field.cols) + .5) * field.tileSize });
  }
  points.reverse();
  if (points[0]!.x !== field.spawn.x || points[0]!.y !== field.spawn.y) points.unshift(field.spawn);
  return points;
}
