/** Actual native bodies use the union of solid XY geometry. The 8px layout stays
 * conservative for generation/navigation; relief cannot erase an underlying
 * solid and neither visual height nor material brightness grants support. */
import type { GeneratedRiftLayout } from '@/generation/types';
import type { Vector2 } from '@/types/game-types';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import type { PhysicalBodyQueries, PhysicalSolidExemption } from '@/systems/ai/physical-grid';
import type { R100NativeWorldData } from './r100-native-data';

type Point = Readonly<Vector2>;
interface Axis { x: number; y: number; min: number; max: number }
interface Polygon { points: readonly Point[]; axes: readonly Axis[]; minX: number; minY: number; maxX: number; maxY: number }
interface Hit { fraction: number; normalX: number; normalY: number }
export interface NativeBodyMotion { x: number; y: number; velocityX: number; velocityY: number; collided: boolean }
const EPSILON = 1e-7;
const SEPARATION = 1e-4;
const SOLID_BUCKET_SIZE = 64;

function polygon(points: readonly Point[]): Polygon | null {
  if (points.length < 3) return null;
  let area = 0;
  for (let i = 0; i < points.length; i++) { const a = points[i]!, b = points[(i + 1) % points.length]!; area += a.x * b.y - b.x * a.y; }
  if (Math.abs(area) < EPSILON) return null;
  const normals: Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!, x = b.y - a.y, y = a.x - b.x, length = Math.hypot(x, y);
    if (length > EPSILON) normals.push({ x: x / length, y: y / length });
  }
  const axes = normals.map(({ x, y }) => {
    let min = Infinity, max = -Infinity;
    for (const point of points) { const value = point.x * x + point.y * y; min = Math.min(min, value); max = Math.max(max, value); }
    return { x, y, min, max };
  });
  return { points, axes, minX: axes[0]!.min, maxX: axes[0]!.max, minY: axes[1]!.min, maxY: axes[1]!.max };
}

/** Sutherland–Hodgman clipping is used only on ability activation. */
function clip(points: readonly Point[], axis: 'x' | 'y', limit: number, greater: boolean): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const insideA = greater ? a[axis] >= limit : a[axis] <= limit;
    const insideB = greater ? b[axis] >= limit : b[axis] <= limit;
    if (insideA) result.push(a);
    if (insideA !== insideB) {
      const t = (limit - a[axis]) / (b[axis] - a[axis]);
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return result;
}

function outsideExemption(p: Polygon, box: Readonly<PhysicalSolidExemption>): Polygon[] {
  if (p.maxX <= box.left || p.minX >= box.right || p.maxY <= box.top || p.minY >= box.bottom) return [p];
  const horizontal = clip(clip(p.points, 'x', box.left, true), 'x', box.right, false);
  return [clip(p.points, 'x', box.left, false), clip(p.points, 'x', box.right, true),
    clip(horizontal, 'y', box.top, false), clip(horizontal, 'y', box.bottom, true)]
    .map(polygon).filter((value): value is Polygon => value !== null);
}

function overlap(p: Polygon, center: Point, halfW: number, halfH: number): boolean {
  if (center.x + halfW <= p.minX + EPSILON || center.x - halfW >= p.maxX - EPSILON
    || center.y + halfH <= p.minY + EPSILON || center.y - halfH >= p.maxY - EPSILON) return false;
  for (const axis of p.axes) {
    const at = center.x * axis.x + center.y * axis.y, radius = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    if (at + radius <= axis.min + EPSILON || at - radius >= axis.max - EPSILON) return false;
  }
  return true;
}

function sweepPolygon(p: Polygon, center: Point, halfW: number, halfH: number, dx: number, dy: number, hit: Hit): void {
  if (Math.max(center.x, center.x + dx) + halfW <= p.minX + EPSILON || Math.min(center.x, center.x + dx) - halfW >= p.maxX - EPSILON
    || Math.max(center.y, center.y + dy) + halfH <= p.minY + EPSILON || Math.min(center.y, center.y + dy) - halfH >= p.maxY - EPSILON) return;
  let enter = -Infinity, exit = Infinity, normalX = 0, normalY = 0;
  for (const axis of p.axes) {
    const at = center.x * axis.x + center.y * axis.y, velocity = dx * axis.x + dy * axis.y;
    const radius = halfW * Math.abs(axis.x) + halfH * Math.abs(axis.y);
    const min = axis.min - radius + EPSILON, max = axis.max + radius - EPSILON;
    if (Math.abs(velocity) < 1e-12) { if (at <= min || at >= max) return; continue; }
    const a = (min - at) / velocity, b = (max - at) / velocity, start = Math.min(a, b);
    if (start > enter) { enter = start; const sign = velocity > 0 ? -1 : 1; normalX = axis.x * sign; normalY = axis.y * sign; }
    exit = Math.min(exit, Math.max(a, b));
    if (enter >= exit) return;
  }
  if (exit <= 0 || enter >= hit.fraction || enter > 1) return;
  hit.fraction = Math.max(0, enter); hit.normalX = normalX; hit.normalY = normalY;
}

/** Geometry planning uses the very same SAT overlap/sweep as live bodies.
 * Floor-cell rectangles and solid triangles can both be measured in local
 * coordinates; translating a placed object never substitutes cell adjacency
 * for the continuous 20px body sweep. */
export function createNativeBodyPrimitiveProbe(points: readonly (readonly Point[])[]) {
  const polygons = points.map(polygon).filter((value): value is Polygon => value !== null);
  const hit: Hit = { fraction: 1, normalX: 0, normalY: 0 };
  return {
    supports(center: Point,halfW=10,halfH=10): boolean { return !polygons.some(value => overlap(value, center, halfW, halfH)); },
    displacementFraction(center: Point, dx: number, dy: number): number {
      hit.fraction = 1; hit.normalX = 0; hit.normalY = 0;
      for (const value of polygons) sweepPolygon(value, center, 10, 10, dx, dy, hit);
      return hit.fraction;
    },
  };
}

/** Prepares only triangle coefficients, never a full image. Runtime sweeps are
 * allocation-free except the rare phase-ability clipping request. */
export class NativeBodyCollision implements PhysicalBodyQueries {
  private readonly solids: readonly Polygon[];
  private readonly bucketCols: number;
  private readonly bucketRows: number;
  private readonly bucketOffsets: Uint32Array;
  private readonly bucketSolids: Uint32Array;
  private readonly candidateBits: Uint32Array;
  private readonly hit: Hit = { fraction: 1, normalX: 0, normalY: 0 };
  private readonly at: Vector2 = { x: 0, y: 0 };
  private readonly cell: Polygon;
  readonly triangleCount: number;
  constructor(native: {readonly definition: Pick<R100NativeWorldData['definition'], 'instances'>; readonly meshes:R100NativeWorldData['meshes']}, private readonly map: TileMapData) {
    if (map.tileSize !== 8) throw new Error('Native body collision requires the original 8px navigation map');
    const roles = new Map(native.definition.instances.map(instance => [instance.id, instance.role]));
    const solids: Polygon[] = [];
    for (const mesh of native.meshes) {
      if (roles.get(mesh.spec.id) !== 'solid') continue;
      for (let face = 0; face < mesh.indices.length; face += 3) {
        const points: Point[] = [];
        for (let corner = 0; corner < 3; corner++) {
          const index = mesh.indices[face + corner]! * 3;
          points.push({ x: mesh.positions[index]!, y: mesh.positions[index + 1]! });
        }
        const value = polygon(points); if (value) solids.push(value);
      }
    }
    this.solids = solids; this.triangleCount = solids.length;
    this.bucketCols = Math.max(1, Math.ceil(map.cols * map.tileSize / SOLID_BUCKET_SIZE));
    this.bucketRows = Math.max(1, Math.ceil(map.rows * map.tileSize / SOLID_BUCKET_SIZE));
    const counts = new Uint32Array(this.bucketCols * this.bucketRows);
    // Clamping both insertion and query ranges retains out-of-map triangles
    // in the edge buckets. It can add candidates, never discard an overlap.
    const visitBuckets = (solid: Polygon, visit: (bucket: number) => void): void => {
      const left = this.bucketCoordinate(solid.minX, this.bucketCols), right = this.bucketCoordinate(solid.maxX, this.bucketCols);
      const top = this.bucketCoordinate(solid.minY, this.bucketRows), bottom = this.bucketCoordinate(solid.maxY, this.bucketRows);
      for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) visit(row * this.bucketCols + col);
    };
    for (const solid of solids) visitBuckets(solid, bucket => { counts[bucket] = counts[bucket]! + 1; });
    this.bucketOffsets = new Uint32Array(counts.length + 1);
    for (let i = 0; i < counts.length; i++) this.bucketOffsets[i + 1] = this.bucketOffsets[i]! + counts[i]!;
    this.bucketSolids = new Uint32Array(this.bucketOffsets[counts.length]!);
    const writeAt = this.bucketOffsets.slice(0, counts.length);
    for (let i = 0; i < solids.length; i++) visitBuckets(solids[i]!, bucket => {
      const at = writeAt[bucket]!; this.bucketSolids[at] = i; writeAt[bucket] = at + 1;
    });
    this.candidateBits = new Uint32Array(Math.ceil(solids.length / 32));
    // A mutable axis-aligned cell avoids allocations when sweeping missing floor.
    this.cell = { points: [], axes: [{ x: 1, y: 0, min: 0, max: 0 }, { x: 0, y: 1, min: 0, max: 0 }], minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  supports(center: Point, halfW: number, halfH: number): boolean {
    if (!this.validBody(center, halfW, halfH)) return false;
    const size = this.map.tileSize;
    for (let row = Math.floor((center.y - halfH + EPSILON) / size); row <= Math.floor((center.y + halfH - EPSILON) / size); row++)
      for (let col = Math.floor((center.x - halfW + EPSILON) / size); col <= Math.floor((center.x + halfW - EPSILON) / size); col++)
        if (this.map.tiles[row]![col] === TileType.VOID) return false;
    this.collectCandidates(center.x - halfW, center.y - halfH, center.x + halfW, center.y + halfH);
    for (let word = 0; word < this.candidateBits.length; word++) {
      let bits = this.candidateBits[word]!;
      while (bits !== 0) {
        const index = word * 32 + 31 - Math.clz32(bits & -bits);
        if (overlap(this.solids[index]!, center, halfW, halfH)) return false;
        bits &= bits - 1;
      }
    }
    return true;
  }

  displacementFraction(center: Point, halfW: number, halfH: number, dx: number, dy: number, exemption?: Readonly<PhysicalSolidExemption>): number {
    if (!this.supports(center, halfW, halfH) || !Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
    return this.trace(center, halfW, halfH, dx, dy, exemption).fraction;
  }

  resolveMotion(center: Point, halfW: number, halfH: number, dx: number, dy: number, velocity: Point, out: NativeBodyMotion): void {
    out.x = center.x; out.y = center.y; out.velocityX = velocity.x; out.velocityY = velocity.y; out.collided = false;
    if (!this.supports(center, halfW, halfH) || (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(velocity.x) || !Number.isFinite(velocity.y))) {
      out.velocityX = 0; out.velocityY = 0; out.collided = true; return;
    }
    let remainingX = dx, remainingY = dy;
    for (let iteration = 0; iteration < 4 && Math.abs(remainingX) + Math.abs(remainingY) > EPSILON; iteration++) {
      this.at.x = out.x; this.at.y = out.y;
      const hit = this.trace(this.at, halfW, halfH, remainingX, remainingY);
      out.x += remainingX * hit.fraction; out.y += remainingY * hit.fraction;
      if (hit.fraction === 1) break;
      out.collided = true;
      remainingX *= 1 - hit.fraction; remainingY *= 1 - hit.fraction;
      const inward = remainingX * hit.normalX + remainingY * hit.normalY;
      if (inward >= 0) break;
      remainingX -= inward * hit.normalX; remainingY -= inward * hit.normalY;
      const velocityInward = out.velocityX * hit.normalX + out.velocityY * hit.normalY;
      if (velocityInward < 0) { out.velocityX -= velocityInward * hit.normalX; out.velocityY -= velocityInward * hit.normalY; }
    }
  }

  private validBody(center: Point, halfW: number, halfH: number): boolean {
    return Number.isFinite(center.x) && Number.isFinite(center.y) && Number.isFinite(halfW) && Number.isFinite(halfH) && halfW > 0 && halfH > 0
      && center.x - halfW >= 0 && center.y - halfH >= 0
      && center.x + halfW <= this.map.cols * this.map.tileSize && center.y + halfH <= this.map.rows * this.map.tileSize;
  }

  private bucketCoordinate(value: number, extent: number): number {
    return Math.max(0, Math.min(extent - 1, Math.floor(value / SOLID_BUCKET_SIZE)));
  }

  /** Reused bitset deduplicates bucket overlap and enumerates original solid
   * indices in ascending order, preserving equal-time contact normals. */
  private collectCandidates(minX: number, minY: number, maxX: number, maxY: number): void {
    const bits = this.candidateBits; bits.fill(0);
    if (!bits.length) return;
    const left = this.bucketCoordinate(minX, this.bucketCols), right = this.bucketCoordinate(maxX, this.bucketCols);
    const top = this.bucketCoordinate(minY, this.bucketRows), bottom = this.bucketCoordinate(maxY, this.bucketRows);
    for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
      const bucket = row * this.bucketCols + col, end = this.bucketOffsets[bucket + 1]!;
      for (let at = this.bucketOffsets[bucket]!; at < end; at++) {
        const index = this.bucketSolids[at]!, word = index >>> 5;
        bits[word] = bits[word]! | (1 << (index & 31));
      }
    }
  }

  private trace(center: Point, halfW: number, halfH: number, dx: number, dy: number, exemption?: Readonly<PhysicalSolidExemption>): Hit {
    const hit = this.hit; hit.fraction = 1; hit.normalX = 0; hit.normalY = 0;
    const size = this.map.tileSize;
    const minCol = Math.max(-1, Math.floor((Math.min(center.x, center.x + dx) - halfW) / size));
    const maxCol = Math.min(this.map.cols, Math.floor((Math.max(center.x, center.x + dx) + halfW) / size));
    const minRow = Math.max(-1, Math.floor((Math.min(center.y, center.y + dy) - halfH) / size));
    const maxRow = Math.min(this.map.rows, Math.floor((Math.max(center.y, center.y + dy) + halfH) / size));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      if (row >= 0 && col >= 0 && row < this.map.rows && col < this.map.cols && this.map.tiles[row]![col] !== TileType.VOID) continue;
      const cell = this.cell; cell.minX = col * size; cell.maxX = (col + 1) * size; cell.minY = row * size; cell.maxY = (row + 1) * size;
      cell.axes[0]!.min = cell.minX; cell.axes[0]!.max = cell.maxX; cell.axes[1]!.min = cell.minY; cell.axes[1]!.max = cell.maxY;
      sweepPolygon(cell, center, halfW, halfH, dx, dy, hit);
    }
    this.collectCandidates(Math.min(center.x, center.x + dx) - halfW, Math.min(center.y, center.y + dy) - halfH,
      Math.max(center.x, center.x + dx) + halfW, Math.max(center.y, center.y + dy) + halfH);
    for (let word = 0; word < this.candidateBits.length; word++) {
      let bits = this.candidateBits[word]!;
      while (bits !== 0) {
        const solid = this.solids[word * 32 + 31 - Math.clz32(bits & -bits)]!;
        if (exemption) for (const piece of outsideExemption(solid, exemption)) sweepPolygon(piece, center, halfW, halfH, dx, dy, hit);
        else sweepPolygon(solid, center, halfW, halfH, dx, dy, hit);
        bits &= bits - 1;
      }
    }
    if (hit.fraction < 1) hit.fraction = Math.max(0, hit.fraction - SEPARATION / Math.max(Math.abs(dx), Math.abs(dy), SEPARATION));
    return hit;
  }
}

const cache = new WeakMap<GeneratedRiftLayout, { native: R100NativeWorldData; collision: NativeBodyCollision }>();
export function nativeBodyCollision(native: R100NativeWorldData, layout: GeneratedRiftLayout): NativeBodyCollision {
  const existing = cache.get(layout);
  if (existing?.native === native) return existing.collision;
  const collision = new NativeBodyCollision(native, layout.tileMap);
  cache.set(layout, { native, collision }); return collision;
}
