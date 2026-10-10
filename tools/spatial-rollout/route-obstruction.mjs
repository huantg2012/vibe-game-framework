/** Independent complete-map route evidence. No generation, process environment,
 * persistence or terrain mutation. Half-plane restrictions exist only in QA search. */
import assert from 'node:assert/strict';
import { TileGrid } from '../../src/systems/tile-grid.ts';
import { bodyHasSupport, bodyDisplacementFraction } from '../../src/systems/ai/physical-grid.ts';
import { TileType } from '../../src/types/game-types.ts';

export const ROUTE_OBSTRUCTION_POLICY = { bodySize: 20, gridSize: 8, minimumGroups: 2, shortestRatio: 1.25, shortestExtraPx: 120,
  probeMarginPx: [32, 64], groupSeparationPx: 300, maximumGroupsExamined: 32,
  scanFractions: [.5, .35, .65, .2, .8], minimumGroupCells: 24 };
const POLICY = ROUTE_OBSTRUCTION_POLICY;
const DIRECTIONS = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const REVERSE = [2, 3, 0, 1, 7, 6, 5, 4];
const COST = DIRECTIONS.map(([x, y]) => Math.hypot(x, y) * 8);

class Heap {
  items = [];
  push(cell, distance, score) {
    const item = { cell, distance, score }; let index = this.items.length; this.items.push(item);
    while (index > 0) { const above = (index - 1) >> 1; if (this.items[above].score <= score) break; this.items[index] = this.items[above]; index = above; }
    this.items[index] = item;
  }
  pop() {
    const first = this.items[0], last = this.items.pop();
    if (this.items.length) { let index = 0;
      while (index * 2 + 1 < this.items.length) { let next = index * 2 + 1;
        if (next + 1 < this.items.length && this.items[next + 1].score < this.items[next].score) next++;
        if (this.items[next].score >= last.score) break; this.items[index] = this.items[next]; index = next;
      } this.items[index] = last;
    } return first;
  }
}

function makeGraph(layout) {
  const grid = new TileGrid(layout.tileMap), { cols, rows } = grid, size = cols * rows;
  assert.equal(grid.tileSize, 8);
  const center = cell => ({ x: (cell % cols + .5) * 8, y: (Math.floor(cell / cols) + .5) * 8 });
  const cellOf = point => Math.floor(point.y / 8) * cols + Math.floor(point.x / 8);
  const seats = new Uint8Array(size), edges = new Uint8Array(size);
  for (let cell = 0; cell < size; cell++) seats[cell] = Number(bodyHasSupport(grid, center(cell), 10, 10));
  for (let cell = 0; cell < size; cell++) {
    if (!seats[cell]) continue;
    const x = cell % cols, y = Math.floor(cell / cols), point = center(cell);
    for (const d of [0, 1, 4, 5]) {
      const [dx, dy] = DIRECTIONS[d], col = x + dx, row = y + dy, next = row * cols + col;
      if (col < 0 || row < 0 || col >= cols || row >= rows || !seats[next]) continue;
      if (bodyDisplacementFraction(grid, point, 10, 10, dx * 8, dy * 8) !== 1) continue;
      edges[cell] |= 1 << d; edges[next] |= 1 << REVERSE[d];
    }
  }
  const reachable = new Uint8Array(size), queue = [cellOf(layout.spawnPoint)];
  assert(seats[queue[0]], 'production spawn must have full-body support'); reachable[queue[0]] = 1;
  for (let i = 0; i < queue.length; i++) { const cell = queue[i];
    for (let d = 0; d < DIRECTIONS.length; d++) if (edges[cell] & 1 << d) {
      const [dx, dy] = DIRECTIONS[d], next = cell + dx + dy * cols;
      if (!reachable[next]) { reachable[next] = 1; queue.push(next); }
    }
  }
  const supported = seats.reduce((sum, value) => sum + value, 0);
  assert(queue.length / supported >= .97, 'independent full-body reachability must retain 97%');
  return { grid, cols, rows, size, center, cellOf, seats, edges, reachable, reachableCount: queue.length, supported };
}

/** Finds true tile components, not rendered silhouettes. All visible pieces
 * owned by one solid instance count as the same group when admitting two groups. */
function obstacleGroups(graph, native) {
  const { grid, cols, rows } = graph, marked = new Uint8Array(graph.size), groups = [];
  const solids = native.definition.instances.filter(instance => instance.role === 'solid');
  const solidIds = new Set(solids.map(instance => instance.id));
  for (let first = 0; first < graph.size; first++) {
    const type = grid.getTile(first % cols, Math.floor(first / cols));
    if (marked[first] || ![TileType.WALL, TileType.VOID].includes(type)) continue;
    const cells = [first], owners = new Set(); marked[first] = 1;
    let minCol = cols, maxCol = 0, minRow = rows, maxRow = 0, touchesFrame = false;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i], x = cell % cols, y = Math.floor(cell / cols);
      minCol = Math.min(minCol, x); maxCol = Math.max(maxCol, x); minRow = Math.min(minRow, y); maxRow = Math.max(maxRow, y);
      touchesFrame ||= x === 0 || y === 0 || x === cols - 1 || y === rows - 1;
      if (type === TileType.WALL) {
        // Physical coverage can be partial inside an 8px tile. Read all native
        // pixels instead of inferring ownership from the centre alone.
        for (let py = y * 8; py < y * 8 + 8; py++) for (let px = x * 8; px < x * 8 + 8; px++) {
          const id = native.raster.objectId[py * native.raster.width + px]; if (solidIds.has(id)) owners.add(id);
        }
      }
      for (const [dx, dy] of DIRECTIONS) {
        const col = x + dx, row = y + dy, next = row * cols + col;
        if (col < 0 || row < 0 || col >= cols || row >= rows || marked[next] || grid.getTile(col, row) !== type) continue;
        marked[next] = 1; cells.push(next);
      }
    }
    if (cells.length < POLICY.minimumGroupCells || type === TileType.VOID && touchesFrame) continue;
    if (type === TileType.WALL && solids.length === 1) owners.add(solids[0].id);
    if (type === TileType.WALL && owners.size === 0) continue; // Unattributed pieces cannot establish distinct source groups.
    groups.push({ id: `${type === TileType.WALL ? 'solid' : 'void'}-${first}`, kind: type === TileType.WALL ? 'solid' : 'void',
      cells, set: new Set(cells), owners: [...owners].sort((a, b) => a - b), minCol, maxCol, minRow, maxRow,
      center: { x: (minCol + maxCol + 1) * 4, y: (minRow + maxRow + 1) * 4 } });
  }
  return groups.sort((a, b) => b.cells.length - a.cells.length);
}

/** A* uses an admissible octile heuristic; recorded result is the complete
 * shortest 8-way path, not a smoothed path or endpoint-only collision check. */
function shortestPath(graph, start, end, constraint) {
  const { cols, size, edges } = graph, endX = end % cols, endY = Math.floor(end / cols);
  const distances = new Float64Array(size).fill(Infinity), parents = new Int32Array(size).fill(-1), heap = new Heap();
  const heuristic = cell => { const dx = Math.abs(cell % cols - endX), dy = Math.abs(Math.floor(cell / cols) - endY); return (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)) * 8; };
  distances[start] = 0; heap.push(start, 0, heuristic(start));
  while (heap.items.length) {
    const { cell, distance } = heap.pop(); if (distance !== distances[cell]) continue;
    if (cell === end) {
      const cells = [end]; while (cells.at(-1) !== start) { const before = parents[cells.at(-1)]; assert(before >= 0); cells.push(before); }
      cells.reverse(); return { distancePx: distance, cells };
    }
    for (let d = 0; d < DIRECTIONS.length; d++) if (edges[cell] & 1 << d) {
      const [dx, dy] = DIRECTIONS[d], next = cell + dx + dy * cols;
      if (constraint) { const coordinate = constraint.axis === 'horizontal' ? Math.floor(next / cols) : next % cols;
        if ((coordinate - constraint.line) * constraint.side < 0) continue;
      }
      const cost = distance + COST[d]; if (cost >= distances[next] - 1e-8) continue;
      distances[next] = cost; parents[next] = cell; heap.push(next, cost, cost + heuristic(next));
    }
  }
  return null;
}

function verifiedPath(graph, path, constraint) {
  const { cells } = path, compact = cells.filter((cell, i) => i === 0 || i === cells.length - 1 || cell - cells[i - 1] !== cells[i + 1] - cell);
  const points = compact.map(graph.center); let measured = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], dx = b.x - a.x, dy = b.y - a.y;
    assert.equal(bodyDisplacementFraction(graph.grid, a, 10, 10, dx, dy), 1, 'all compressed route segments must sweep clear'); measured += Math.hypot(dx, dy);
  }
  assert(Math.abs(measured - path.distancePx) < 1e-5, 'compression must preserve original octile length');
  if (constraint) for (const cell of cells) {
    const coordinate = constraint.axis === 'horizontal' ? Math.floor(cell / graph.cols) : cell % graph.cols;
    assert((coordinate - constraint.line) * constraint.side >= 0, 'route must remain in its complete half-plane');
  }
  return { distancePx: measured, cellCount: cells.length, segmentCount: points.length - 1, points };
}

function probes(graph, group) {
  const result = [], seen = new Set();
  for (const axis of ['horizontal', 'vertical']) for (const fraction of POLICY.scanFractions) {
    const line = Math.round(axis === 'horizontal' ? group.minRow + (group.maxRow - group.minRow) * fraction : group.minCol + (group.maxCol - group.minCol) * fraction);
    const occupied = group.cells.filter(cell => (axis === 'horizontal' ? Math.floor(cell / graph.cols) : cell % graph.cols) === line)
      .map(cell => axis === 'horizontal' ? cell % graph.cols : Math.floor(cell / graph.cols));
    if (!occupied.length) continue;
    const min = Math.min(...occupied), max = Math.max(...occupied), limit = axis === 'horizontal' ? graph.cols : graph.rows;
    const cellAt = value => axis === 'horizontal' ? line * graph.cols + value : value * graph.cols + line;
    for (const margin of POLICY.probeMarginPx) {
      let a = min - margin / 8, b = max + margin / 8;
      // Probe placement may move only outwards, never into a cavity on the near side.
      while (a >= 0 && !graph.reachable[cellAt(a)]) a--;
      while (b < limit && !graph.reachable[cellAt(b)]) b++;
      if (a < 0 || b >= limit) continue;
      const start = cellAt(a), end = cellAt(b), key = `${start}/${end}`;
      if (seen.has(key)) continue; seen.add(key);
      const from = graph.center(start), to = graph.center(end);
      if (bodyDisplacementFraction(graph.grid, from, 10, 10, to.x - from.x, to.y - from.y) === 1) continue;
      const hitCells = []; for (let value = a; value <= b; value++) if (group.set.has(cellAt(value))) hitCells.push(cellAt(value));
      if (!hitCells.length) continue;
      result.push({ axis, line, start, end, from, to, hitCells, straightPx: (b - a) * 8 });
    }
  }
  return result;
}

function checkGroup(graph, group) {
  const rejected = [];
  for (const probe of probes(graph, group)) {
    const path = shortestPath(graph, probe.start, probe.end);
    if (!path) { rejected.push({ from: probe.from, to: probe.to, reason: 'disconnected' }); continue; }
    const extra = path.distancePx - probe.straightPx, ratio = path.distancePx / probe.straightPx;
    if (extra < POLICY.shortestExtraPx || ratio < POLICY.shortestRatio) {
      rejected.push({ from: probe.from, to: probe.to, reason: 'shortest-detour-too-small', extraPx: extra, ratio }); continue;
    }
    const negative = { axis: probe.axis, line: probe.line, side: -1 }, positive = { ...negative, side: 1 };
    const a = shortestPath(graph, probe.start, probe.end, negative), b = shortestPath(graph, probe.start, probe.end, positive);
    if (!a || !b) { rejected.push({ from: probe.from, to: probe.to, reason: 'no-route-on-both-sides', negative: Boolean(a), positive: Boolean(b), extraPx: extra, ratio }); continue; }
    const oppositeInteriorEdges = (left, right) => {
      const keys = new Set(left.cells.slice(1).map((cell, i) => [cell, left.cells[i]].sort((x, y) => x - y).join('/')));
      return right.cells.slice(1).filter((cell, i) => keys.has([cell, right.cells[i]].sort((x, y) => x - y).join('/'))).length;
    };
    return { passed: true, group: { id: group.id, kind: group.kind, sourceSolidIds: group.owners, blockedCells: group.cells.length,
      bounds: { x: group.minCol * 8, y: group.minRow * 8, width: (group.maxCol - group.minCol + 1) * 8, height: (group.maxRow - group.minRow + 1) * 8 }, center: group.center },
      probe: { axis: probe.axis, crossingLinePx: (probe.line + .5) * 8, from: probe.from, to: probe.to, straightPx: probe.straightPx,
        directSweepFraction: bodyDisplacementFraction(graph.grid, probe.from, 10, 10, probe.to.x - probe.from.x, probe.to.y - probe.from.y), groupHitCells: probe.hitCells.map(graph.center) },
      shortest: { ...verifiedPath(graph, path), ratio, extraPx: extra },
      negativeHalfPlane: verifiedPath(graph, a, negative), positiveHalfPlane: verifiedPath(graph, b, positive),
      sharedEdgesOnCrossingLine: oppositeInteriorEdges(a, b), rejectedEarlierProbes: rejected.length };
  }
  return { passed: false, group: { id: group.id, kind: group.kind, sourceSolidIds: group.owners, blockedCells: group.cells.length, center: group.center }, rejected };
}

export function measureRouteObstructions(map, recipe) {
  const started = performance.now();
  const graph = makeGraph(map.layout);
  const selection = map.native.diagnostics.spatial.extraction, field = map.native.diagnostics.spatial.extractionCandidateField;
  assert(selection.interactionPathDistancePx >= Math.max(recipe.spatialPolicy.extraction.minPathDistancePx, field.maxPathDistancePx * recipe.spatialPolicy.extraction.minPathFraction));
  assert.deepEqual(selection.point, map.layout.extractionPoint.position);
  const found = [], attempts = [], groups = obstacleGroups(graph, map.native);
  for (const group of groups.slice(0, POLICY.maximumGroupsExamined)) {
    if (found.some(other => group.owners.some(id => other.group.sourceSolidIds.includes(id))
      || Math.hypot(group.center.x - other.group.center.x, group.center.y - other.group.center.y) < POLICY.groupSeparationPx)) continue;
    const result = checkGroup(graph, group); attempts.push(result);
    if (result.passed) found.push(result);
    if (found.length >= POLICY.minimumGroups) break;
  }
  return { world: recipe.package.id.replace(/^r100-/, ''), grade: recipe.package.grade,
    requestedSeed: recipe.requestedSeed, effectiveSeed: map.layout.seed, attempts: map.metadata.attempt + 1,
    organization: recipe.spatialPolicy.organization, spatialSourceHash: recipe.spatialPolicy.sourceHash, width: graph.grid.widthPx, height: graph.grid.heightPx,
    supportedSeats: graph.supported, reachableSeats: graph.reachableCount, reachableFraction: graph.reachableCount / graph.supported,
    solidRatio: map.native.diagnostics.spatial.solidTerrainRatio, extractionInteractionPx: selection.interactionPathDistancePx,
    candidateGroups: groups.length, groupsFound: found.length, status: found.length >= POLICY.minimumGroups ? 'passed' : 'failed',
    groups: found, rejectedGroups: attempts.filter(row => !row.passed), measurementMs: performance.now() - started };
}
