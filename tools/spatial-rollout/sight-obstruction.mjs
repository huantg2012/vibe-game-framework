/** QA-only measurement of actual production VOID sight barriers. No mutations,
 * generation overrides, fog writes or production imports of this module. */
import assert from 'node:assert/strict';
import { TileGrid } from '../../src/systems/tile-grid.ts';
import { TileType } from '../../src/types/game-types.ts';
import { bodyHasSupport, bodyDisplacementFraction } from '../../src/systems/ai/physical-grid.ts';
import { NativeBodyCollision } from '../../src/generation/world-study/native-body-collision.ts';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data.ts';
import { hasLineOfSight } from '../../src/utils/grid-raycast.ts';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';

export const SIGHT_OBSTRUCTION_POLICY = Object.freeze({ gridPx: 8, bodyPx: 20,
  minimumWitnesses: 3, witnessSeparationPx: 300, maximumTargetDistancePx: 208,
  minimumRevealDisplacementPx: 80, maximumRevealRoutePx: 720,
  observerStridePx: 24, diagnosticStridePx: 64, maximumProbesPerGroup: 72 });
const P = SIGHT_OBSTRUCTION_POLICY;
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const REVERSE = [2, 3, 0, 1, 7, 6, 5, 4];
const COSTS = DIRS.map(([x, y]) => Math.hypot(x, y) * P.gridPx);
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

class Heap {
  items = [];
  push(cell, distance) {
    const item = { cell, distance }; let i = this.items.length; this.items.push(item);
    while (i > 0) { const parent = (i - 1) >> 1; if (this.items[parent].distance <= distance) break; this.items[i] = this.items[parent]; i = parent; }
    this.items[i] = item;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (this.items.length) { let i = 0;
      while (i * 2 + 1 < this.items.length) { let next = i * 2 + 1;
        if (next + 1 < this.items.length && this.items[next + 1].distance < this.items[next].distance) next++;
        if (this.items[next].distance >= last.distance) break; this.items[i] = this.items[next]; i = next;
      } this.items[i] = last;
    } return first;
  }
}

function makeGraph(map) {
  const grid = new TileGrid(map.layout.tileMap), { cols, rows } = grid, size = cols * rows;
  assert.equal(grid.tileSize, P.gridPx); assert.equal(GAME_CONSTANTS.PLAYER.BODY_SIZE, P.bodyPx);
  const center = cell => ({ x: (cell % cols + .5) * 8, y: (Math.floor(cell / cols) + .5) * 8 });
  const cellOf = p => Math.floor(p.y / 8) * cols + Math.floor(p.x / 8);
  const seats = new Uint8Array(size), edges = new Uint8Array(size);
  for (let c = 0; c < size; c++) seats[c] = Number(bodyHasSupport(grid, center(c), 10, 10));
  for (let cell = 0; cell < size; cell++) if (seats[cell]) {
    const x = cell % cols, y = Math.floor(cell / cols), from = center(cell);
    for (const d of [0, 1, 4, 5]) {
      const [dx, dy] = DIRS[d], col = x + dx, row = y + dy, next = row * cols + col;
      if (col < 0 || row < 0 || col >= cols || row >= rows || !seats[next]) continue;
      if (bodyDisplacementFraction(grid, from, 10, 10, dx * 8, dy * 8) !== 1) continue;
      edges[cell] |= 1 << d; edges[next] |= 1 << REVERSE[d];
    }
  }
  const reachable = new Uint8Array(size), spawn = cellOf(map.layout.spawnPoint), queue = [spawn];
  const spawnParents = new Int32Array(size).fill(-1); assert(seats[spawn]); reachable[spawn] = 1;
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    for (let d = 0; d < DIRS.length; d++) if (edges[cell] & 1 << d) {
      const [dx, dy] = DIRS[d], next = cell + dx + dy * cols;
      if (!reachable[next]) { reachable[next] = 1; spawnParents[next] = cell; queue.push(next); }
    }
  }
  return { grid, cols, rows, size, center, cellOf, seats, edges, reachable, spawn, spawnParents,
    reachableCount: queue.length, supportedCount: seats.reduce((s, n) => s + n, 0),
    physical: new NativeBodyCollision(map.native, map.layout.tileMap) };
}

function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  } return inside;
}

/** Internal missing terrain is measured independently of the huge exterior.
 * Exterior is one connected component, so distinct bays require distinct source
 * erosion polygons, never arbitrary subdivisions of that component. */
function voidGroups(graph, native) {
  const labels = new Int32Array(graph.size).fill(-1), components = [];
  for (let first = 0; first < graph.size; first++) {
    if (labels[first] >= 0 || !native.sight.isOpaque(first % graph.cols, Math.floor(first / graph.cols))) continue;
    const id = components.length, cells = [first]; labels[first] = id; let external = false;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i], x = cell % graph.cols, y = Math.floor(cell / graph.cols);
      external ||= x === 0 || y === 0 || x === graph.cols - 1 || y === graph.rows - 1;
      for (const [dx, dy] of DIRS.slice(0, 4)) {
        const col = x + dx, row = y + dy, next = row * graph.cols + col;
        if (col < 0 || row < 0 || col >= graph.cols || row >= graph.rows || labels[next] >= 0
          || !native.sight.isOpaque(col, row)) continue;
        labels[next] = id; cells.push(next);
      }
    } components.push({ id, cells, external });
  }
  const groupByCell = new Int32Array(graph.size).fill(-1), groups = [], keys = new Map();
  for (const component of components) for (const cell of component.cells) {
    const p = graph.center(cell);
    const sourcePolygon = native.definition.erosion.findIndex(poly => insidePolygon(poly, p.x, p.y));
    const key = component.external ? `external-${component.id}-erosion-${sourcePolygon}` : `interior-${component.id}`;
    let id = keys.get(key);
    if (id === undefined) { id = groups.length; keys.set(key, id); groups.push({ id, key, kind: component.external ? 'external-cut' : 'interior-void', component: component.id, sourcePolygons: new Set(), cells: [], centroid: { x: 0, y: 0 } }); }
    const group = groups[id]; groupByCell[cell] = id; group.cells.push(cell); group.centroid.x += p.x; group.centroid.y += p.y;
    if (sourcePolygon >= 0) group.sourcePolygons.add(sourcePolygon);
  }
  for (const group of groups) { group.centroid.x /= group.cells.length; group.centroid.y /= group.cells.length; }
  return { groups, groupByCell, components, labels };
}

function reconstruct(parents, start, end) {
  const path = [end];
  while (path.at(-1) !== start) { const previous = parents[path.at(-1)]; assert(previous >= 0); path.push(previous); }
  return path.reverse();
}

function verifiedRoute(graph, cells) {
  const compact = cells.filter((cell, i) => i === 0 || i === cells.length - 1 || cell - cells[i - 1] !== cells[i + 1] - cell);
  const route = compact.map(graph.center); let routeLength = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], dx = b.x - a.x, dy = b.y - a.y;
    assert.equal(bodyDisplacementFraction(graph.grid, a, 10, 10, dx, dy), 1);
    assert.equal(graph.physical.displacementFraction(a, 10, 10, dx, dy), 1, 'compressed path must sweep clear against actual native triangles + VOID');
    routeLength += distance(a, b);
  }
  return { route, routeLength, fullGridSteps: cells.length - 1 };
}

function revealPath(graph, sight, observerCell, target, maximumTargetDistancePx) {
  const distances = new Float64Array(graph.size).fill(Infinity), parents = new Int32Array(graph.size).fill(-1), heap = new Heap();
  const observer = graph.center(observerCell); distances[observerCell] = 0; heap.push(observerCell, 0);
  while (heap.items.length) {
    const { cell, distance: length } = heap.pop(); if (length !== distances[cell]) continue;
    if (length > P.maximumRevealRoutePx) break;
    const point = graph.center(cell);
    if (hasLineOfSight(sight, point, target, maximumTargetDistancePx)) {
      // The earliest reachable reveal is tested; walking another 80px AFTER an
      // immediate peek cannot manufacture a meaningful exploration witness.
      const displacement = distance(point, observer);
      if (displacement < P.minimumRevealDisplacementPx) return { passed: false, reason: 'earliest-reveal-too-near', displacement, earliestRevealRoutePx: length };
      return { passed: true, reveal: point, displacement, ...verifiedRoute(graph, reconstruct(parents, observerCell, cell)) };
    }
    for (let d = 0; d < DIRS.length; d++) if (graph.edges[cell] & 1 << d) {
      const [dx, dy] = DIRS[d], next = cell + dx + dy * graph.cols, cost = length + COSTS[d];
      if (cost >= distances[next] - 1e-8 || cost > P.maximumRevealRoutePx) continue;
      distances[next] = cost; parents[next] = cell; heap.push(next, cost);
    }
  } return { passed: false, reason: 'no-reveal-within-route-budget' };
}

function gatherProbes(graph, native, grouping, maximumTargetDistancePx) {
  const probes = new Map(), stride = P.observerStridePx / 8;
  const noVoid = { ...native.sight, isOpaque: (col, row) => col < 0 || row < 0 || col >= graph.cols || row >= graph.rows };
  // Short, long and diagonal chords all use the exact production DDA.
  const offsets = [];
  for (const radius of [1, 176 / 208, 144 / 208, 112 / 208].map(f => f * maximumTargetDistancePx)) for (let i = 0; i < 24; i++) {
    const angle = i * Math.PI / 12, dx = Math.round(Math.cos(angle) * radius / 8), dy = Math.round(Math.sin(angle) * radius / 8);
    if (Math.hypot(dx, dy) * 8 <= maximumTargetDistancePx) offsets.push([dx, dy]);
  }
  for (let y = 1; y < graph.rows - 1; y += stride) for (let x = 1; x < graph.cols - 1; x += stride) {
    const cell = y * graph.cols + x; if (!graph.reachable[cell]) continue;
    const observer = graph.center(cell);
    for (const [dx, dy] of offsets) {
      const col = x + dx, row = y + dy, targetCell = row * graph.cols + col;
      if (col < 0 || row < 0 || col >= graph.cols || row >= graph.rows || !graph.reachable[targetCell]
        || native.sight.isOpaque(col, row)) continue;
      const target = graph.center(targetCell), hitGroups = new Set();
      const trace = { ...native.sight, isOpaque: (xx, yy) => {
        const opaque = native.sight.isOpaque(xx, yy);
        if (opaque && xx >= 0 && yy >= 0 && xx < graph.cols && yy < graph.rows) hitGroups.add(grouping.groupByCell[yy * graph.cols + xx]);
        return opaque;
      } };
      if (hasLineOfSight(trace, observer, target, maximumTargetDistancePx)) continue;
      assert(hasLineOfSight(noVoid, observer, target, maximumTargetDistancePx), 'same-distance no-VOID control must be visible');
      for (const groupId of hitGroups) {
        if (groupId < 0) continue;
        const group = grouping.groups[groupId];
        if (group.kind === 'external-cut' && !group.sourcePolygons.size) continue;
        const onlyThisVoidRemoved = { ...native.sight, isOpaque: (xx, yy) => xx >= 0 && yy >= 0 && xx < graph.cols && yy < graph.rows
          && grouping.groupByCell[yy * graph.cols + xx] === groupId ? false : native.sight.isOpaque(xx, yy) };
        if (!hasLineOfSight(onlyThisVoidRemoved, observer, target, maximumTargetDistancePx)) continue;
        if (!probes.has(groupId)) probes.set(groupId, []);
        probes.get(groupId).push({ cell, observer, target, distance: distance(observer, target),
          center: { x: (observer.x + target.x) / 2, y: (observer.y + target.y) / 2 } });
      }
    }
  }
  // Cover spatially different boundary segments before trying near-duplicates.
  for (const [id, rows] of probes) {
    const retained = [], bins = new Set();
    for (const row of rows) { const key = `${Math.floor(row.center.x / 48)}/${Math.floor(row.center.y / 48)}`;
      if (bins.has(key)) continue; bins.add(key); retained.push(row);
    }
    probes.set(id, retained.slice(0, P.maximumProbesPerGroup));
  }
  return probes;
}

function diagnostics(graph, native, grouping) {
  const regions = Array.from({ length: 12 }, (_, region) => ({ region, observers: 0, groundPairs: 0, voidBlockedPairs: 0, observersWithVoidLoss: 0 }));
  for (let y = 1; y < graph.rows; y += P.diagnosticStridePx / 8) for (let x = 1; x < graph.cols; x += P.diagnosticStridePx / 8) {
    const cell = y * graph.cols + x; if (!graph.reachable[cell]) continue;
    const observer = graph.center(cell), region = regions[Math.floor(y / graph.rows * 3) * 4 + Math.floor(x / graph.cols * 4)];
    region.observers++; let blocked = false;
    for (const r of [96, 144, 192, 208]) for (let d = 0; d < 16; d++) {
      const col = Math.round(x + Math.cos(d * Math.PI / 8) * r / 8), row = Math.round(y + Math.sin(d * Math.PI / 8) * r / 8);
      if (col < 0 || row < 0 || col >= graph.cols || row >= graph.rows || !graph.reachable[row * graph.cols + col]) continue;
      const target = graph.center(row * graph.cols + col); if (distance(observer, target) > 208) continue;
      region.groundPairs++;
      if (!hasLineOfSight(native.sight, observer, target, 208)) { region.voidBlockedPairs++; blocked = true; }
    }
    if (blocked) region.observersWithVoidLoss++;
  }
  const corridors = [];
  // Conservative body-clear straight corridors in the outer quarter, sampled
  // every 32px. A long open edge remains visible in diagnostics even if 3 good
  // witnesses happen to exist elsewhere; these are not another pass threshold.
  for (const axis of ['horizontal', 'vertical']) {
    const lines = axis === 'horizontal' ? graph.rows : graph.cols, length = axis === 'horizontal' ? graph.cols : graph.rows;
    for (let line = 1; line < lines; line += 4) {
      if (line >= lines * .25 && line <= lines * .75) continue;
      let start = -1;
      for (let n = 0; n <= length; n++) {
        const cell = axis === 'horizontal' ? line * graph.cols + n : n * graph.cols + line;
        if (n < length && graph.reachable[cell]) { if (start < 0) start = n; continue; }
        if (start >= 0 && n - start >= 2) {
          const a = axis === 'horizontal' ? line * graph.cols + start : start * graph.cols + line;
          const b = axis === 'horizontal' ? line * graph.cols + n - 1 : (n - 1) * graph.cols + line;
          corridors.push({ axis, from: graph.center(a), to: graph.center(b), lengthPx: (n - start - 1) * 8 });
        } start = -1;
      }
    }
  }
  const internal = grouping.components.filter(c => !c.external), external = grouping.components.filter(c => c.external);
  const internalCells = internal.reduce((n, c) => n + c.cells.length, 0), externalCells = external.reduce((n, c) => n + c.cells.length, 0);
  const groundPairs = regions.reduce((n, r) => n + r.groundPairs, 0), blocked = regions.reduce((n, r) => n + r.voidBlockedPairs, 0);
  return { scope: 'Geometric, zero-chaos forward-facing LOS diagnostics; no reward placement or human exploration claim. Open-corridor samples are axis-aligned and not exhaustive.',
    internalVoid: { components: internal.length, cells: internalCells, areaPx2: internalCells * 64, fractionOfCanvas: internalCells / graph.size },
    externalVoid: { components: external.length, cells: externalCells, areaPx2: externalCells * 64, fractionOfCanvas: externalCells / graph.size },
    nearbyGroundPairs: groundPairs, voidBlockedPairs: blocked, voidBlockedPairFraction: groundPairs ? blocked / groundPairs : null,
    regions: regions.map(r => ({ ...r, blockedPairFraction: r.groundPairs ? r.voidBlockedPairs / r.groundPairs : null })),
    longestPeripheralOpenCorridors: corridors.sort((a, b) => b.lengthPx - a.lengthPx).slice(0, 12) };
}

/** Pure production-map measurement. Receives already generated data and returns
 * a serializable report. Never relaxes the gate when probes are unavailable. */
export function measureSightObstructions(map, recipe, { maximumTargetDistancePx = P.maximumTargetDistancePx } = {}) {
  const started = performance.now(); assert(map.native, 'Actual production native payload required');
  assert(Number.isFinite(maximumTargetDistancePx) && maximumTargetDistancePx > 0
    && maximumTargetDistancePx <= P.maximumTargetDistancePx, 'Only a stricter target distance may be requested');
  // Production transfers data without methods. Rebuild its sight through the
  // same receiver used by RiftScene, never infer opacity from physical WALLs.
  const native = hydrateR100MasterWorld(map.native, map.layout);
  assert(GAME_CONSTANTS.VISIBILITY.RADIUS_FORWARD > P.maximumTargetDistancePx);
  const graph = makeGraph(map), grouping = voidGroups(graph, native), probes = gatherProbes(graph, native, grouping, maximumTargetDistancePx);
  const witnesses = [], rejectedGroups = [];
  // Prefer actual interior holes to source-separated bays of the outer VOID.
  const ordered = [...probes.keys()].sort((a, b) => Number(grouping.groups[a].kind !== 'interior-void') - Number(grouping.groups[b].kind !== 'interior-void') || a - b);
  for (const id of ordered) {
    const group = grouping.groups[id], rejected = []; let found = null;
    for (const probe of probes.get(id)) {
      if (witnesses.some(w => distance(w.center, probe.center) < P.witnessSeparationPx)) continue;
      const result = revealPath(graph, native.sight, probe.cell, probe.target, maximumTargetDistancePx);
      if (!result.passed) { rejected.push({ observer: probe.observer, target: probe.target, ...result }); continue; }
      const revealDistance = distance(result.reveal, probe.target);
      assert(revealDistance <= maximumTargetDistancePx);
      assert(!hasLineOfSight(native.sight, probe.observer, probe.target, maximumTargetDistancePx));
      assert(hasLineOfSight(native.sight, result.reveal, probe.target, maximumTargetDistancePx));
      const approach = verifiedRoute(graph, reconstruct(graph.spawnParents, graph.spawn, probe.cell));
      found = { observer: probe.observer, target: probe.target, reveal: result.reveal, route: result.route,
        distance: probe.distance, revealDistance, routeLength: result.routeLength, revealDisplacement: result.displacement,
        center: probe.center, facingRadians: { observer: Math.atan2(probe.target.y - probe.observer.y, probe.target.x - probe.observer.x), reveal: Math.atan2(probe.target.y - result.reveal.y, probe.target.x - result.reveal.x) },
        group: { id: group.key, kind: group.kind, component: group.component, sourcePolygons: [...group.sourcePolygons], areaPx2: group.cells.length * 64, centroid: group.centroid },
        controls: { actualBlocked: true, allVoidRemovedVisible: true, onlyThisVoidRemovedVisible: true, revealVisible: true, earliestRevealDisplacementPx: result.displacement },
        spawnApproach: approach, candidatesRejectedBefore: rejected.length };
      break;
    }
    if (found) witnesses.push(found);
    else rejectedGroups.push({ group: group.key, candidates: probes.get(id).length, rejected });
    if (witnesses.length >= P.minimumWitnesses) break;
  }
  return { world: recipe.package.id.replace(/^r100-/, ''), grade: recipe.package.grade, requestedSeed: recipe.requestedSeed,
    effectiveSeed: map.layout.seed, attempt: map.metadata.attempt, revision: recipe.package.algorithmRevision,
    spatialSourceHash: recipe.spatialPolicy?.sourceHash, geometryFingerprint: map.native.diagnostics.geometryFingerprint,
    policy: { ...P, maximumTargetDistancePx }, standardMaximumTargetDistancePx: P.maximumTargetDistancePx,
    diagnosticMaximumTargetDistancePx: 208, referenceForwardRadiusPx: GAME_CONSTANTS.VISIBILITY.RADIUS_FORWARD,
    searchScope: 'Bounded deterministic observer/chord samples; failed means the required witnesses were not found in this search, not proof that no such viewpoints exist. Three witnesses establish mechanical examples, not adequate map-wide exploration density.',
    status: witnesses.length >= P.minimumWitnesses ? 'passed' : 'failed', witnessCount: witnesses.length, witnesses, rejectedGroups,
    reachableSeats: graph.reachableCount, supportedSeats: graph.supportedCount, reachableFraction: graph.reachableCount / graph.supportedCount,
    diagnostics: diagnostics(graph, native, grouping), measurementMs: performance.now() - started };
}
