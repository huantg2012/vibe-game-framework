/** Offline measurements of unchanged production geometry, with explicit sampling limits. */
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision';
import type {WorldProductionMap} from '../../src/generation/world-study/production-map';
import {TileType, type Vector2} from '../../src/types/game-types';

export interface RegionRequest {readonly id: string; readonly bounds: readonly [number, number, number, number]}
export interface RouteRequest {readonly id: string; readonly from: Readonly<Vector2>; readonly to: Readonly<Vector2>; readonly via?: readonly Readonly<Vector2>[]}
export interface DetourRequest {
  readonly id: string; readonly objectId: number; readonly from: Readonly<Vector2>; readonly to: Readonly<Vector2>;
  readonly sideA: Readonly<Vector2>; readonly sideB: Readonly<Vector2>;
}
export interface DiagnosticRequests {readonly regions?: readonly RegionRequest[]; readonly routes?: readonly RouteRequest[]; readonly detours?: readonly DetourRequest[]}
export interface DistanceSample {readonly x: number; readonly y: number; readonly solidDistancePx: number; readonly voidDistancePx: number; readonly clearRadiusPx: number}
export interface DistanceSummary {
  readonly samples: number; readonly solidP50Px: number | null; readonly solidP90Px: number | null;
  readonly maxSolidDistancePx: number | null; readonly farFromSolidRatio224: number | null;
  readonly voidP50Px: number | null; readonly voidP90Px: number | null; readonly maxVoidDistancePx: number | null;
  readonly farFromVoidRatio224: number | null; readonly clearRadiusP90Px: number | null; readonly maxClearRadiusPx: number | null;
}
export interface RouteWitness {
  readonly id: string; readonly passed: boolean; readonly reason?: string; readonly requestedPoints: readonly Readonly<Vector2>[];
  readonly snappedPoints: readonly Readonly<Vector2>[]; readonly bodySizePx: 20; readonly sampleStepPx: 8;
  readonly path: readonly Readonly<Vector2>[]; readonly lengthPx: number; readonly minSolidDistancePx: number | null;
  readonly minVoidDistancePx: number | null; readonly minClearRadiusPx: number | null; readonly sweptSegments: number;
  readonly minContinuousClearRadiusLowerBoundPx: number | null;
}
export interface DetourWitness {
  readonly id: string; readonly objectId: number; readonly passed: boolean; readonly oppositeSideWaypoints: boolean;
  readonly straightLineHitsSolid: boolean; readonly solidInteriorAnchor: Readonly<Vector2> | null;
  readonly sideAAngleRadians: number | null; readonly sideBAngleRadians: number | null; readonly closedLoopWinding: number | null;
  readonly sideA: RouteWitness; readonly sideB: RouteWitness; readonly limitation: string;
}
export interface DiagnosticResult {
  readonly report: {
    readonly schemaVersion: number; readonly sampleStepPx: number; readonly bodySizePx: number; readonly width: number; readonly height: number;
    readonly solidTriangles: number; readonly solidObjects: readonly number[]; readonly voidBoundarySegments: number;
    readonly supportedCenters: number; readonly reachableCenters: number; readonly metrics: DistanceSummary;
    readonly regions: readonly (RegionRequest & {readonly metrics: DistanceSummary})[];
    readonly clearPeaks: readonly DistanceSample[]; readonly solidDistancePeaks: readonly DistanceSample[]; readonly voidDistancePeaks: readonly DistanceSample[];
    readonly openComponents: readonly {readonly clearRadiusThresholdPx: number; readonly componentCount: number; readonly largestSampleCount: number;
      readonly largestSampleCellAreaPx2: number; readonly representativePoint: Readonly<Vector2> | null}[];
    readonly routes: readonly RouteWitness[]; readonly detours: readonly DetourWitness[]; readonly definitions: Readonly<Record<string, string>>;
  };
  readonly field: {readonly cols: number; readonly rows: number; readonly step: number; readonly supported: Uint8Array;
    readonly reachable: Uint8Array; readonly solidDistance: Float64Array; readonly voidDistance: Float64Array};
}
interface Primitive {readonly points: readonly number[]; readonly objectId: number; readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number}
interface Bvh {readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly left?: Bvh; readonly right?: Bvh; readonly items?: readonly Primitive[]}
const step = 8, halfBody = 10;
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
function primitive(points: readonly number[], objectId: number): Primitive {
  const xs = points.filter((_, index) => index % 2 === 0), ys = points.filter((_, index) => index % 2 === 1);
  return {points, objectId, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys)};
}
function tree(items: readonly Primitive[]): Bvh {
  const bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
  for (const item of items) {bounds.minX = Math.min(bounds.minX, item.minX); bounds.minY = Math.min(bounds.minY, item.minY); bounds.maxX = Math.max(bounds.maxX, item.maxX); bounds.maxY = Math.max(bounds.maxY, item.maxY);}
  if (items.length <= 8) return {...bounds, items};
  const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
  const sorted = [...items].sort((a, b) => horizontal ? a.minX + a.maxX - b.minX - b.maxX : a.minY + a.maxY - b.minY - b.maxY);
  const middle = Math.floor(sorted.length / 2);
  return {...bounds, left: tree(sorted.slice(0, middle)), right: tree(sorted.slice(middle))};
}
function segmentDistanceSq(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, size = dx * dx + dy * dy;
  const t = size === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / size));
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}
function distanceSq(x: number, y: number, p: Primitive): number {
  const a = p.points;
  if (a.length === 4) return segmentDistanceSq(x, y, a[0]!, a[1]!, a[2]!, a[3]!);
  const cross = (i: number, j: number): number => (a[j]! - a[i]!) * (y - a[i + 1]!) - (a[j + 1]! - a[i + 1]!) * (x - a[i]!);
  const e0 = cross(0, 2), e1 = cross(2, 4), e2 = cross(4, 0);
  if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) return 0;
  return Math.min(segmentDistanceSq(x, y, a[0]!, a[1]!, a[2]!, a[3]!), segmentDistanceSq(x, y, a[2]!, a[3]!, a[4]!, a[5]!), segmentDistanceSq(x, y, a[4]!, a[5]!, a[0]!, a[1]!));
}
/** Strict interior of one actual projected solid triangle on the endpoint segment. */
function interiorAnchor(triangles: readonly Primitive[], from: Readonly<Vector2>, to: Readonly<Vector2>): Vector2 | null {
  for (const triangle of triangles) {
    const p = triangle.points;
    const orientation = Math.sign((p[2]! - p[0]!) * (p[5]! - p[1]!) - (p[3]! - p[1]!) * (p[4]! - p[0]!));
    let enter = 0, leave = 1, valid = true;
    for (let corner = 0; corner < 3; corner++) {
      const a = corner * 2, b = (corner + 1) % 3 * 2, dx = p[b]! - p[a]!, dy = p[b + 1]! - p[a + 1]!;
      const start = orientation * (dx * (from.y - p[a + 1]!) - dy * (from.x - p[a]!));
      const slope = orientation * (dx * (to.y - from.y) - dy * (to.x - from.x));
      if (Math.abs(slope) < 1e-9) {if (start <= 1e-7) valid = false;}
      else if (slope > 0) enter = Math.max(enter, -start / slope);
      else leave = Math.min(leave, -start / slope);
    }
    if (valid && leave - enter > 1e-7 && leave > 0 && enter < 1) {
      const t = (enter + leave) / 2; return {x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t};
    }
  }
  return null;
}
function boundsDistanceSq(x: number, y: number, p: Bvh): number {return Math.max(p.minX - x, 0, x - p.maxX) ** 2 + Math.max(p.minY - y, 0, y - p.maxY) ** 2;}
function nearest(root: Bvh, x: number, y: number): number {
  let best = Infinity;
  function visit(node: Bvh): void {
    if (boundsDistanceSq(x, y, node) >= best) return;
    if (node.items) {for (const item of node.items) best = Math.min(best, distanceSq(x, y, item)); return;}
    const left = node.left!, right = node.right!;
    if (boundsDistanceSq(x, y, left) <= boundsDistanceSq(x, y, right)) {visit(left); visit(right);} else {visit(right); visit(left);}
  }
  visit(root); return Math.sqrt(best);
}
function solidPrimitives(map: WorldProductionMap): Primitive[] {
  if (!map.native) throw new Error('A native production map is required');
  const ids = new Set(map.native.definition.instances.filter(item => item.role === 'solid').map(item => item.id)), result: Primitive[] = [];
  for (const mesh of map.native.meshes) {
    if (!ids.has(mesh.spec.id)) continue;
    for (let face = 0; face < (mesh.groundEdgeStart?.triangle ?? mesh.triangleCount); face++) {
      const points: number[] = [];
      for (let corner = 0; corner < 3; corner++) {const at = mesh.indices[face * 3 + corner]! * 3; points.push(mesh.positions[at]!, mesh.positions[at + 1]!);}
      const area = (points[2]! - points[0]!) * (points[5]! - points[1]!) - (points[3]! - points[1]!) * (points[4]! - points[0]!);
      if (Math.abs(area) > 1e-7) result.push(primitive(points, mesh.spec.id));
    }
  }
  return result;
}
function voidPrimitives(map: WorldProductionMap): Primitive[] {
  const grid = map.layout.tileMap, result: Primitive[] = [];
  const matter = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.tiles[y]![x] !== TileType.VOID;
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
    if (!matter(x, y)) continue;
    const left = x * step, top = y * step, right = left + step, bottom = top + step;
    if (!matter(x - 1, y)) result.push(primitive([left, top, left, bottom], -1));
    if (!matter(x + 1, y)) result.push(primitive([right, top, right, bottom], -1));
    if (!matter(x, y - 1)) result.push(primitive([left, top, right, top], -1));
    if (!matter(x, y + 1)) result.push(primitive([left, bottom, right, bottom], -1));
  }
  return result;
}
function summarize(samples: readonly DistanceSample[]): DistanceSummary {
  const sorted = (key: keyof DistanceSample): number[] => samples.map(row => row[key]).sort((a, b) => a - b);
  const s = sorted('solidDistancePx'), v = sorted('voidDistancePx'), c = sorted('clearRadiusPx');
  const percentile = (a: readonly number[], fraction: number): number | null => a.length ? a[Math.min(a.length - 1, Math.ceil(a.length * fraction) - 1)]! : null;
  return {samples: samples.length, solidP50Px: percentile(s, .5), solidP90Px: percentile(s, .9), maxSolidDistancePx: s[s.length - 1] ?? null,
    farFromSolidRatio224: s.length ? s.filter(n => n > 224).length / s.length : null,
    voidP50Px: percentile(v, .5), voidP90Px: percentile(v, .9), maxVoidDistancePx: v[v.length - 1] ?? null,
    farFromVoidRatio224: v.length ? v.filter(n => n > 224).length / v.length : null,
    clearRadiusP90Px: percentile(c, .9), maxClearRadiusPx: c[c.length - 1] ?? null};
}

function validateRequests(requests: DiagnosticRequests): void {
  const ids = new Set(['spawn-to-extraction']);
  function id(value: string): void {if (!value || ids.has(value)) throw new Error(`Duplicate or empty request id: ${value}`); ids.add(value);}
  function point(value: Readonly<Vector2>): void {if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) throw new Error('Finite request coordinates required');}
  for (const region of requests.regions ?? []) {
    id(region.id); const [x0, y0, x1, y1] = region.bounds;
    if (!region.bounds.every(Number.isFinite) || !(x1 > x0 && y1 > y0)) throw new Error(`Invalid region bounds: ${region.id}`);
  }
  for (const route of requests.routes ?? []) {id(route.id); [route.from, route.to, ...(route.via ?? [])].forEach(point);}
  for (const detour of requests.detours ?? []) {
    id(detour.id); [detour.from, detour.to, detour.sideA, detour.sideB].forEach(point);
    if (detour.from.x === detour.to.x && detour.from.y === detour.to.y) throw new Error(`Distinct detour endpoints required: ${detour.id}`);
  }
}

/** Four-neighbour samples, exact 20x20 continuous sweeps on every used edge.
 * Distances are exact at each sample; coverage/area/maxima retain the 8px sampling resolution. */
export function diagnoseWorld(map: WorldProductionMap, requests: DiagnosticRequests = {}): DiagnosticResult {
  validateRequests(requests);
  if (!map.native || map.layout.tileMap.tileSize !== step) throw new Error('8px native map required');
  const grid = map.layout.tileMap, cols = grid.cols, rows = grid.rows, count = cols * rows;
  const collision = new NativeBodyCollision(map.native, grid), solids = solidPrimitives(map), voidEdges = voidPrimitives(map);
  if (!solids.length || !voidEdges.length) throw new Error('Solid and actual terrain-boundary geometry required');
  const solidTree = tree(solids), voidTree = tree(voidEdges), supported = new Uint8Array(count), links = new Uint8Array(count), reachable = new Uint8Array(count);
  const point = (cell: number): Vector2 => ({x: (cell % cols + .5) * step, y: (Math.floor(cell / cols) + .5) * step});
  const cellOf = (p: Readonly<Vector2>): number => Math.floor(p.y / step) * cols + Math.floor(p.x / step);
  for (let i = 0; i < count; i++) supported[i] = Number(collision.supports(point(i), halfBody, halfBody));
  for (let i = 0; i < count; i++) if (supported[i]) for (let d = 0; d < 2; d++) {
    const [dx, dy] = directions[d]!, x = i % cols + dx, y = Math.floor(i / cols) + dy, next = y * cols + x;
    if (x >= cols || y >= rows || !supported[next]) continue;
    if (collision.displacementFraction(point(i), halfBody, halfBody, dx * step, dy * step) >= 1 - 1e-9) {
      links[i] = links[i]! | (1 << d); links[next] = links[next]! | (1 << (d + 2));
    }
  }
  const start = cellOf(map.layout.spawnPoint), queue = new Int32Array(count);
  if (!supported[start]) throw new Error('Production spawn is unsupported');
  let head = 0, tail = 1; queue[0] = start; reachable[start] = 1;
  while (head < tail) {const cell = queue[head++]!; for (let d = 0; d < 4; d++) if (links[cell]! & (1 << d)) {
    const next = cell + directions[d]![0] + directions[d]![1] * cols;
    if (!reachable[next]) {reachable[next] = 1; queue[tail++] = next;}
  }}
  const solidDistance = new Float64Array(count).fill(NaN), voidDistance = new Float64Array(count).fill(NaN), samples: DistanceSample[] = [];
  for (let i = 0; i < count; i++) if (reachable[i]) {
    const p = point(i), s = nearest(solidTree, p.x, p.y), v = nearest(voidTree, p.x, p.y);
    solidDistance[i] = s; voidDistance[i] = v; samples.push({...p, solidDistancePx: s, voidDistancePx: v, clearRadiusPx: Math.min(s, v)});
  }
  const peaks = (key: 'clearRadiusPx' | 'solidDistancePx' | 'voidDistancePx'): DistanceSample[] => {
    const result: DistanceSample[] = [];
    for (const sample of [...samples].sort((a, b) => b[key] - a[key] || a.y - b.y || a.x - b.x)) {
      if (result.every(other => Math.hypot(sample.x - other.x, sample.y - other.y) >= 224)) result.push(sample);
      if (result.length === 12) break;
    }
    return result;
  };
  const components = [112, 224].map(threshold => {
    const seen = new Uint8Array(count); let largest = 0, componentCount = 0, largestStart = -1;
    for (let cell = 0; cell < count; cell++) {
      if (seen[cell] || !reachable[cell] || Math.min(solidDistance[cell]!, voidDistance[cell]!) <= threshold) continue;
      head = 0; tail = 1; queue[0] = cell; seen[cell] = 1; componentCount++;
      while (head < tail) {const current = queue[head++]!; for (let d = 0; d < 4; d++) if (links[current]! & (1 << d)) {
        const next = current + directions[d]![0] + directions[d]![1] * cols;
        if (!seen[next] && Math.min(solidDistance[next]!, voidDistance[next]!) > threshold) {seen[next] = 1; queue[tail++] = next;}
      }}
      if (tail > largest) {largest = tail; largestStart = cell;}
    }
    return {clearRadiusThresholdPx: threshold, componentCount, largestSampleCount: largest, largestSampleCellAreaPx2: largest * step * step,
      representativePoint: largestStart < 0 ? null : point(largestStart)};
  });
  const findNearest = (p: Readonly<Vector2>): number => {
    let best = -1, distance = step * Math.SQRT2 + 1e-6;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = Math.floor(p.x / step) + dx, y = Math.floor(p.y / step) + dy, at = y * cols + x;
      if (x < 0 || y < 0 || x >= cols || y >= rows || !reachable[at]) continue;
      const q = point(at), gap = Math.hypot(q.x - p.x, q.y - p.y);
      if (gap < distance && collision.supports(p, halfBody, halfBody)
        && collision.displacementFraction(p, halfBody, halfBody, q.x - p.x, q.y - p.y) >= 1 - 1e-9) {best = at; distance = gap;}
    }
    return best;
  };
  const route = (request: RouteRequest, edgeAllowed: (from: Readonly<Vector2>, to: Readonly<Vector2>) => boolean = () => true): RouteWitness => {
    const requestedPoints = [request.from, ...(request.via ?? []), request.to], cells = requestedPoints.map(findNearest), path: Vector2[] = [];
    const base = {id: request.id, requestedPoints, snappedPoints: cells.filter(c => c >= 0).map(point), bodySizePx: 20 as const, sampleStepPx: 8 as const};
    const failure = (reason: string): RouteWitness => ({...base, passed: false, reason, path: [], lengthPx: 0, minSolidDistancePx: null, minVoidDistancePx: null, minClearRadiusPx: null, minContinuousClearRadiusLowerBoundPx: null, sweptSegments: 0});
    if (cells.some(c => c < 0)) return failure('Requested endpoint/via lacks a supported connection to the sampled component within 8√2px');
    for (let leg = 0; leg < cells.length - 1; leg++) {
      const source = cells[leg]!, target = cells[leg + 1]!, previous = new Int32Array(count).fill(-1);
      head = 0; tail = 1; queue[0] = source; previous[source] = source;
      while (head < tail && previous[target] === -1) {
        const cell = queue[head++]!;
        for (let d = 0; d < 4; d++) if (links[cell]! & (1 << d)) {const next = cell + directions[d]![0] + directions[d]![1] * cols;
          if (previous[next] === -1 && edgeAllowed(point(cell), point(next))) {previous[next] = cell; queue[tail++] = next;}}
      }
      if (previous[target] === -1) return failure('No full-body route in the sampled four-neighbour graph');
      const reversed = [target]; for (let cell = target; cell !== source;) {cell = previous[cell]!; reversed.push(cell);}
      const legPath = [requestedPoints[leg]!, ...reversed.reverse().map(point), requestedPoints[leg + 1]!];
      for (const p of legPath) if (!path.length || p.x !== path[path.length - 1]!.x || p.y !== path[path.length - 1]!.y) path.push({...p});
    }
    let lengthPx = 0, minS = Infinity, minV = Infinity, maxSegmentLength = 0;
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!; minS = Math.min(minS, nearest(solidTree, p.x, p.y)); minV = Math.min(minV, nearest(voidTree, p.x, p.y));
      if (i) {const before = path[i - 1]!, dx = p.x - before.x, dy = p.y - before.y;
        if (!edgeAllowed(before, p)) return failure('A route segment violates the requested side or forward-only projection');
        if (collision.displacementFraction(before, halfBody, halfBody, dx, dy) < 1 - 1e-9) return failure('Exact continuous sweep rejected a route segment');
        const length = Math.hypot(dx, dy); lengthPx += length; maxSegmentLength = Math.max(maxSegmentLength, length);
      }
    }
    return {...base, passed: true, path, lengthPx, minSolidDistancePx: minS, minVoidDistancePx: minV, minClearRadiusPx: Math.min(minS, minV),
      minContinuousClearRadiusLowerBoundPx: Math.max(0, Math.min(minS, minV) - maxSegmentLength / 2), sweptSegments: Math.max(0, path.length - 1)};
  };
  const routes = [{id: 'spawn-to-extraction', from: map.layout.spawnPoint, to: map.layout.extractionPoint.position}, ...(requests.routes ?? [])].map(request => route(request));
  const detours = (requests.detours ?? []).map(request => {
    const object = map.native!.definition.instances.find(instance => instance.id === request.objectId && instance.role === 'solid');
    if (!object) throw new Error(`Unknown solid for detour ${request.id}`);
    const axisX = request.to.x - request.from.x, axisY = request.to.y - request.from.y;
    const cross = (p: Readonly<Vector2>): number => axisX * (p.y - request.from.y) - axisY * (p.x - request.from.x);
    const oppositeSideWaypoints = cross(request.sideA) * cross(request.sideB) < 0;
    const solidInteriorAnchor = interiorAnchor(solids.filter(p => p.objectId === request.objectId), request.from, request.to);
    const sideConstraint = (side: Readonly<Vector2>) => {
      const sign = Math.sign(cross(side));
      return (from: Readonly<Vector2>, to: Readonly<Vector2>): boolean => sign !== 0
        && (to.x - from.x) * axisX + (to.y - from.y) * axisY >= -1e-7
        && cross(from) * sign >= -1e-7 && cross(to) * sign >= -1e-7;
    };
    const a = route({id: `${request.id}:a`, from: request.from, to: request.to, via: [request.sideA]}, sideConstraint(request.sideA));
    const b = route({id: `${request.id}:b`, from: request.from, to: request.to, via: [request.sideB]}, sideConstraint(request.sideB));
    const angle = (witness: RouteWitness): number | null => {
      if (!witness.passed || !solidInteriorAnchor) return null;
      let sum = 0;
      for (let i = 1; i < witness.path.length; i++) {
        const previous = witness.path[i - 1]!, next = witness.path[i]!;
        const ax = previous.x - solidInteriorAnchor.x, ay = previous.y - solidInteriorAnchor.y;
        const bx = next.x - solidInteriorAnchor.x, by = next.y - solidInteriorAnchor.y;
        sum += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
      }
      return sum;
    };
    const sideAAngleRadians = angle(a), sideBAngleRadians = angle(b);
    const closedLoopWinding = sideAAngleRadians === null || sideBAngleRadians === null ? null : (sideAAngleRadians - sideBAngleRadians) / (2 * Math.PI);
    const windsAroundActualSolid = closedLoopWinding !== null && Math.abs(Math.abs(closedLoopWinding) - 1) < 1e-6;
    return {id: request.id, objectId: request.objectId, passed: a.passed && b.passed && oppositeSideWaypoints && windsAroundActualSolid,
      oppositeSideWaypoints, straightLineHitsSolid: solidInteriorAnchor !== null, solidInteriorAnchor, sideAAngleRadians, sideBAngleRadians,
      closedLoopWinding, sideA: a, sideB: b,
      limitation: 'Conservative two-sided witness: exact 20x20 sweeps, opposite half-planes through an actual triangle interior, forward-only axis projection, and closed-loop winding ±1. A failed witness is not a proof no alternative bypass exists; no player-preference claim.'};
  });
  return {report: {schemaVersion: 1, sampleStepPx: step, bodySizePx: 20, width: cols * step, height: rows * step,
    solidTriangles: solids.length, solidObjects: [...new Set(solids.map(p => p.objectId))], voidBoundarySegments: voidEdges.length,
    supportedCenters: supported.reduce((a, b) => a + b, 0), reachableCenters: samples.length,
    metrics: summarize(samples), regions: (requests.regions ?? []).map(region => ({...region, metrics: summarize(samples.filter(p => p.x >= region.bounds[0] && p.y >= region.bounds[1] && p.x <= region.bounds[2] && p.y <= region.bounds[3]))})),
    clearPeaks: peaks('clearRadiusPx'), solidDistancePeaks: peaks('solidDistancePx'), voidDistancePeaks: peaks('voidDistancePx'), openComponents: components, routes, detours,
    definitions: {solidDistance: 'Euclidean distance to union of original nondegenerate solid XY triangles; relief/VOID/groundEdge excluded; BVH bounds only accelerate exact triangle distance.',
      voidDistance: 'Euclidean distance to actual authoritative 8px matter/VOID boundary segments; solid cells retain their terrain.',
      clearRadius: 'min(solidDistance, voidDistance), maximum over spawn-reachable full 20x20-body centres at 8px spacing. Empty-area diagnosis, never LOS or stealth coverage.',
      openComponents: 'Four-connected centre samples whose clearRadius exceeds the explicit threshold; sampled cell area is not exact continuous polygon area.',
      routes: 'Four-neighbour routes with exact continuous 20x20 sweeps. min*Distance/Radius are vertex samples; continuous-radius lower bound subtracts half the longest segment using the distance-field Lipschitz bound. No continuous shortest-path claim.'}},
    field: {cols, rows, step, supported, reachable, solidDistance, voidDistance}};
}
