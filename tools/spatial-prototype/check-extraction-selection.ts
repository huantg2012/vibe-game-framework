/** Bounded regression for COH-F011's DEV exploration contract, not a
 * statistical proof of unpredictability or a production gameplay admission. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { createSpatialPrototype } from '../../src/dev/rift-spatial-prototype-world';
import {
  buildSpatialExtractionField, getSpatialExtractionPath, selectSpatialExtraction,
  type SpatialExtractionPolicy,
} from '../../src/dev/spatial-extraction-selection';
import { SPATIAL_PROTOTYPE_ANCHORS, SPATIAL_PROTOTYPE_CONFIG as CONFIG } from '../../src/generated/rift-spatial-prototype-data';
import { mix32 } from '../../src/generation/seed-fork';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { TileGrid } from '../../src/systems/tile-grid';
import type { Vector2 } from '../../src/types/game-types';

const OUTPUT = process.argv[2] ?? 'docs/qa/artifacts/cinder-extraction-fix-2026-10-10/selection-check.json';
const GEOMETRY_SEED = 20261010, HALF_BODY = 10, TRIGGER_RADIUS = 48;
const DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
const SECTOR_NAMES = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];
const POLICY: SpatialExtractionPolicy = {
  minPathDistancePx: CONFIG.extraction_min_path_distance,
  minEuclideanDistancePx: CONFIG.extraction_min_euclidean_distance,
  minPathFraction: CONFIG.extraction_min_path_fraction,
  maxPathFraction: CONFIG.extraction_max_path_fraction,
  clearanceHalfSize: CONFIG.extraction_clearance_half_size,
  regionCols: CONFIG.extraction_region_cols,
  regionRows: CONFIG.extraction_region_rows,
  distanceBands: CONFIG.extraction_distance_bands,
};
assert.equal(GAME_CONSTANTS.PLAYER.BODY_SIZE, 20);
assert.equal(GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS, TRIGGER_RADIUS);
assert.ok(POLICY.minPathDistancePx >= 920);
assert.ok(POLICY.minEuclideanDistancePx >= 560);

// Build real geometry only once. No textures, renderer, or repeated 4M raster
// builds are needed when only the selected extraction seed changes.
const prototype = createSpatialPrototype(GEOMETRY_SEED, 'medium');
const grid = new TileGrid(prototype.world.layout.tileMap);
assert.equal(grid.tileSize, 8);
const count = grid.cols * grid.rows;
const center = (cell: number): Vector2 => ({ x: (cell % grid.cols + .5) * grid.tileSize, y: (Math.floor(cell / grid.cols) + .5) * grid.tileSize });
const supported = new Uint8Array(count), edges = new Uint8Array(count);
for (let cell = 0; cell < count; cell++) supported[cell] = Number(bodyHasSupport(grid, center(cell), HALF_BODY, HALF_BODY));
// Independently precompute the eight-way swept graph, rather than accepting
// the selector's parent chain, reachability flags, or reported distances.
for (let cell = 0; cell < count; cell++) {
  if (!supported[cell]) continue;
  const a = center(cell), col = cell % grid.cols, row = Math.floor(cell / grid.cols);
  for (let direction = 0; direction < DIRECTIONS.length; direction++) {
    const [dx, dy] = DIRECTIONS[direction]!, x = col + dx, y = row + dy, next = y * grid.cols + x;
    if (x < 0 || y < 0 || x >= grid.cols || y >= grid.rows || !supported[next]) continue;
    if (bodyDisplacementFraction(grid, a, HALF_BODY, HALF_BODY, dx * grid.tileSize, dy * grid.tileSize) === 1) edges[cell] |= 1 << direction;
  }
}

/** Simple duplicate-entry min heap, deliberately separate from the selector's
 * indexed decrease-key implementation. */
function independentDistances(start: number): Float64Array {
  const distances = new Float64Array(count).fill(Infinity);
  const heap: [number, number][] = [];
  const push = (entry: [number, number]): void => {
    let index = heap.length; heap.push(entry);
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent]![0] <= entry[0]) break;
      heap[index] = heap[parent]!; index = parent;
    }
    heap[index] = entry;
  };
  const pop = (): [number, number] => {
    const first = heap[0]!, last = heap.pop()!;
    if (heap.length === 0) return first;
    let index = 0;
    while (index * 2 + 1 < heap.length) {
      let child = index * 2 + 1;
      if (child + 1 < heap.length && heap[child + 1]![0] < heap[child]![0]) child++;
      if (last[0] <= heap[child]![0]) break;
      heap[index] = heap[child]!; index = child;
    }
    heap[index] = last;
    return first;
  };
  distances[start] = 0; push([0, start]);
  while (heap.length) {
    const [distance, cell] = pop();
    if (distance !== distances[cell]) continue;
    for (let direction = 0; direction < DIRECTIONS.length; direction++) {
      if (!(edges[cell]! & (1 << direction))) continue;
      const [dx, dy] = DIRECTIONS[direction]!, next = cell + dy * grid.cols + dx;
      const nextDistance = distance + grid.tileSize * Math.hypot(dx, dy);
      if (nextDistance < distances[next]!) { distances[next] = nextDistance; push([nextDistance, next]); }
    }
  }
  return distances;
}

function closestSupported(point: Readonly<Vector2>): number {
  let best = -1, distance = Infinity;
  for (let cell = 0; cell < count; cell++) {
    if (!supported[cell]) continue;
    const target = center(cell), d = Math.hypot(target.x - point.x, target.y - point.y);
    if (d < distance) { best = cell; distance = d; }
  }
  assert.ok(best >= 0);
  assert.ok(distance <= 64, 'Authored spawn must not be silently moved to another locality');
  return best;
}

function interactionMinimum(distances: Float64Array, target: Readonly<Vector2>): number {
  let minimum = Infinity;
  const x0 = Math.max(0, Math.floor((target.x - TRIGGER_RADIUS) / grid.tileSize));
  const x1 = Math.min(grid.cols - 1, Math.floor((target.x + TRIGGER_RADIUS) / grid.tileSize));
  const y0 = Math.max(0, Math.floor((target.y - TRIGGER_RADIUS) / grid.tileSize));
  const y1 = Math.min(grid.rows - 1, Math.floor((target.y + TRIGGER_RADIUS) / grid.tileSize));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const cell = y * grid.cols + x, seat = center(cell);
    if (Math.hypot(seat.x - target.x, seat.y - target.y) <= TRIGGER_RADIUS) minimum = Math.min(minimum, distances[cell]!);
  }
  return minimum;
}

const seeds = [...new Set([
  ...Array.from({ length: 64 }, (_, index) => GEOMETRY_SEED + index),
  ...Array.from({ length: 64 }, (_, index) => mix32(index, 'extraction-check-hashed-seeds')),
])];
assert.equal(seeds.length, 128);
const rows = SPATIAL_PROTOTYPE_ANCHORS.filter(row => row.role === 'candidate');
assert.equal(rows.length, 8);
const bump = (counts: Record<string, number>, key: string | number): void => { counts[key] = (counts[key] ?? 0) + 1; };
let checkedSegments = 0, checkedDiagonalSegments = 0, distanceComparisons = 0;
const reports = rows.map(row => {
  const start = closestSupported(row), spawn = center(start);
  const independent = independentDistances(start);
  const independentMaximum = independent.reduce((max, distance) => Number.isFinite(distance) ? Math.max(max, distance) : max, 0);
  const field = buildSpatialExtractionField(grid, spawn, POLICY);
  for (let cell = 0; cell < count; cell++) {
    assert.equal(Number.isFinite(field.distances[cell]), Number.isFinite(independent[cell]), `${row.id}: reachability differs at ${cell}`);
    if (Number.isFinite(independent[cell])) {
      assert.ok(Math.abs(field.distances[cell]! - independent[cell]!) < 1e-6, `${row.id}: eight-way route distance differs at ${cell}`);
      distanceComparisons++;
    }
  }
  const sectorCounts: Record<string, number> = {}, spatialThirdCounts: Record<string, number> = {};
  const distanceThirdCounts: Record<string, number> = {}, selectorBandCounts: Record<string, number> = {};
  const locationCounts: Record<string, number> = {};
  let minInteraction = Infinity, minEuclidean = Infinity, maxInteraction = 0, minFraction = 1, maxFraction = 0;
  let offOppositeAxisCount = 0, belowFarthestDecileCount = 0;
  const points = new Set<string>();
  const samples = seeds.map(seed => {
    const selection = selectSpatialExtraction(field, seed);
    assert.deepEqual(selectSpatialExtraction(field, seed), selection, `${row.id}/${seed}: same seed changed selection`);
    const euclidean = Math.hypot(selection.point.x - spawn.x, selection.point.y - spawn.y);
    const earliest = interactionMinimum(independent, selection.point);
    const minimum = Math.max(920, independentMaximum * POLICY.minPathFraction);
    assert.ok(euclidean >= 560, `${row.id}/${seed}: exit too close to spawn`);
    assert.ok(earliest >= minimum, `${row.id}/${seed}: exit trigger reachable before required exploration distance`);
    assert.ok(Math.abs(earliest - selection.interactionPathDistancePx) < 1e-6);
    assert.ok(Math.abs(euclidean - selection.euclideanDistancePx) < 1e-6);
    assert.ok(bodyHasSupport(grid, selection.point, POLICY.clearanceHalfSize, POLICY.clearanceHalfSize));
    const path = getSpatialExtractionPath(field, selection.cell);
    assert.deepEqual(path[0], spawn);
    assert.deepEqual(path[path.length - 1], selection.point);
    let pathLength = 0;
    for (let index = 1; index < path.length; index++) {
      const a = path[index - 1]!, b = path[index]!, dx = b.x - a.x, dy = b.y - a.y;
      assert.ok((dx !== 0 || dy !== 0) && Math.abs(dx) <= 8 && Math.abs(dy) <= 8, 'Path is not an eight-way adjacent-cell route');
      assert.ok(bodyHasSupport(grid, b, HALF_BODY, HALF_BODY));
      assert.equal(bodyDisplacementFraction(grid, a, HALF_BODY, HALF_BODY, dx, dy), 1, 'Path clips solid matter or missing floor');
      pathLength += Math.hypot(dx, dy); checkedSegments++;
      if (dx !== 0 && dy !== 0) checkedDiagonalSegments++;
    }
    assert.ok(Math.abs(pathLength - independent[selection.cell]!) < 1e-6, 'Expanded route is not the independently computed shortest route');
    const angle = Math.atan2(selection.point.y - spawn.y, selection.point.x - spawn.x);
    const sector = SECTOR_NAMES[(Math.round(angle / (Math.PI / 4)) + 8) % 8]!;
    const spatialThird = `${Math.floor(selection.point.x / grid.widthPx * 3)},${Math.floor(selection.point.y / grid.heightPx * 3)}`;
    const fraction = independent[selection.cell]! / field.summary.maxPathDistancePx;
    const distanceThird = Math.min(2, Math.floor(fraction * 3));
    const inner = selection.point.x > grid.widthPx * .25 && selection.point.x < grid.widthPx * .75
      && selection.point.y > grid.heightPx * .25 && selection.point.y < grid.heightPx * .75;
    const towardCenterX = grid.widthPx / 2 - spawn.x, towardCenterY = grid.heightPx / 2 - spawn.y;
    const directionCosine = ((selection.point.x - spawn.x) * towardCenterX + (selection.point.y - spawn.y) * towardCenterY)
      / (euclidean * Math.hypot(towardCenterX, towardCenterY));
    if (directionCosine < Math.SQRT1_2) offOppositeAxisCount++;
    if (fraction < .9) belowFarthestDecileCount++;
    bump(sectorCounts, sector); bump(spatialThirdCounts, spatialThird); bump(distanceThirdCounts, distanceThird);
    bump(selectorBandCounts, selection.distanceBand); bump(locationCounts, inner ? 'inner-half-rectangle' : 'outer-half-rectangle');
    points.add(`${selection.point.x},${selection.point.y}`);
    minInteraction = Math.min(minInteraction, earliest); maxInteraction = Math.max(maxInteraction, earliest);
    minEuclidean = Math.min(minEuclidean, euclidean); minFraction = Math.min(minFraction, fraction); maxFraction = Math.max(maxFraction, fraction);
    return { seed, point: selection.point, interactionDistancePx: earliest, euclideanDistancePx: euclidean, pathFraction: fraction, sector, spatialThird, distanceBand: selection.distanceBand };
  });
  assert.ok(Object.keys(sectorCounts).length >= 3, `${row.id}: selections confined to fewer than three 45-degree directions`);
  assert.ok(Object.keys(spatialThirdCounts).length >= 4, `${row.id}: selections occupy too few independent 3×3 map sectors`);
  assert.ok(Object.keys(selectorBandCounts).length >= 2, `${row.id}: only one path distance band selected`);
  assert.ok(Object.keys(locationCounts).length === 2, `${row.id}: only inner or only perimeter locations selected`);
  assert.ok(offOppositeAxisCount > 0, `${row.id}: every exit stays within 45 degrees of the fixed opposite-center direction`);
  assert.ok(belowFarthestDecileCount > 0, `${row.id}: always chooses the farthest decile`);
  assert.ok(points.size >= 32, `${row.id}: many seeds collapse onto a few fixed exit points`);
  console.log(`${row.id}: ${points.size}/128 distinct exits; sectors=${Object.keys(sectorCounts).length}, regions=${Object.keys(spatialThirdCounts).length}, min trigger=${minInteraction.toFixed(2)}, min straight=${minEuclidean.toFixed(2)}, off opposite axis=${offOppositeAxisCount}`);
  return { spawnAnchor: row.id, requestedSpawn: { x: row.x, y: row.y }, spawn, candidateSummary: field.summary,
    selectedUniquePointCount: points.size, sectorCounts, spatialThirdCounts, distanceThirdCounts, selectorBandCounts, locationCounts,
    minInteractionDistancePx: minInteraction, maxInteractionDistancePx: maxInteraction, minEuclideanDistancePx: minEuclidean,
    minPathFraction: minFraction, maxPathFraction: maxFraction, offOppositeAxisCount, belowFarthestDecileCount, samples };
});

// If the geometry cannot satisfy exploration, the field must reject. It may
// never fall back to the old nearby retreat pair or a convenient spawn anchor.
assert.throws(() => buildSpatialExtractionField(grid, reports[0]!.spawn, { ...POLICY, minPathDistancePx: 100000 }), /no legal exploration candidate/);
const incompletePolicy: Record<string, number> = { ...POLICY };
delete incompletePolicy.minPathDistancePx;
assert.throws(() => buildSpatialExtractionField(grid, reports[0]!.spawn, incompletePolicy as unknown as SpatialExtractionPolicy), /Invalid spatial extraction policy/);
const sourcePaths = ['src/dev/spatial-extraction-selection.ts', 'src/dev/rift-spatial-prototype-world.ts', 'src/generated/rift-spatial-prototype-data.ts', 'tools/spatial-prototype/check-extraction-selection.ts'];
const evidence = {
  result: 'PASS', feature: 'COH-F011', createdAt: new Date().toISOString(), geometrySeed: GEOMETRY_SEED,
  geometry: { width: grid.widthPx, height: grid.heightPx, supportTilePx: grid.tileSize, bodyPx: 20, triggerRadiusPx: 48 },
  policy: POLICY, samplesPerSpawn: seeds.length, spawnCount: rows.length, selectionCount: rows.length * seeds.length,
  sourceHashes: Object.fromEntries(sourcePaths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  independentDistanceComparisons: distanceComparisons, sweptPathSegmentsChecked: checkedSegments,
  diagonalPathSegmentsChecked: checkedDiagonalSegments, emptyEligiblePoolExplicitlyRejected: true,
  missingRequiredPolicyFieldExplicitlyRejected: true, sameSeedDeterministic: true,
  limitation: 'One fixed representative geometry, eight authored spawn neighborhoods, and 128 seed samples each. Distances use a 20px body on the real 8px graph, including every reachable grid seat in the 48px trigger circle; continuous off-grid optimum, fogged discovery, human unpredictability, encounters and production integration are not claimed.',
  reports,
};
mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`PASS: ${evidence.selectionCount} selections, ${checkedSegments} independently swept path segments; evidence ${OUTPUT}`);
