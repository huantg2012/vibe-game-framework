/** Author-provided missing-ground polygons. This is the existing static VOID
 * contract, not a light-swallowing Host and not a dark material overlay. */
export interface NativeErosionPoint { readonly x: number; readonly y: number }
export type NativeErosionPolygons = readonly (readonly NativeErosionPoint[])[];
import type { MasterDefinition } from './r100-master-world';
const EPSILON = 1e-7;
const cross = (a: NativeErosionPoint, b: NativeErosionPoint, c: NativeErosionPoint): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function onSegment(a: NativeErosionPoint, b: NativeErosionPoint, p: NativeErosionPoint): boolean {
  return Math.abs(cross(a, b, p)) <= EPSILON && p.x >= Math.min(a.x, b.x) - EPSILON && p.x <= Math.max(a.x, b.x) + EPSILON
    && p.y >= Math.min(a.y, b.y) - EPSILON && p.y <= Math.max(a.y, b.y) + EPSILON;
}
function intersects(a: NativeErosionPoint, b: NativeErosionPoint, c: NativeErosionPoint, d: NativeErosionPoint): boolean {
  const abC = cross(a, b, c), abD = cross(a, b, d), cdA = cross(c, d, a), cdB = cross(c, d, b);
  return (abC * abD < -EPSILON && cdA * cdB < -EPSILON)
    || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}
function contains(polygon: readonly NativeErosionPoint[], point: NativeErosionPoint): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Shared by CSV compilation and current package recovery. Throws on malformed
 * data, including overlapping polygons whose union hides an accidental neck. */
export function validateNativeErosion(value: unknown, width = 1024, height = 768): asserts value is NativeErosionPolygons {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0
    || !Array.isArray(value) || value.length < 1 || value.length > 12) throw new Error('Native erosion must contain 1–12 polygons in a finite world');
  for (const polygon of value) {
    if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > 32) throw new Error('Native erosion polygon requires 3–32 points');
    for (const point of polygon) {
      if (!point || typeof point !== 'object' || Object.keys(point).sort().join(',') !== 'x,y'
        || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > width || point.y < 0 || point.y > height)
        throw new Error('Native erosion point must have only finite in-bounds x/y');
    }
    const points = polygon as NativeErosionPoint[];
    if (new Set(points.map(point => `${point.x}:${point.y}`)).size !== points.length) throw new Error('Native erosion polygon repeats a point');
    const twiceArea = points.reduce((sum, a, i) => { const b = points[(i + 1) % points.length]!; return sum + a.x * b.y - a.y * b.x; }, 0);
    if (Math.abs(twiceArea) < 128) throw new Error('Native erosion polygon area must be at least 64px²');
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!, previous = points[(i + points.length - 1) % points.length]!;
      if (Math.abs(cross(previous, a, b)) <= EPSILON && (previous.x - a.x) * (b.x - a.x) + (previous.y - a.y) * (b.y - a.y) > 0)
        throw new Error('Native erosion adjacent edges overlap');
      for (let j = i + 1; j < points.length; j++) {
        if (j === i + 1 || i === 0 && j === points.length - 1) continue;
        if (intersects(a, b, points[j]!, points[(j + 1) % points.length]!)) throw new Error('Native erosion polygon self-intersects');
      }
    }
  }
  const polygons = value as NativeErosionPoint[][];
  for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++) {
    const a = polygons[i]!, b = polygons[j]!;
    if (contains(a, b[0]!) || contains(b, a[0]!)) throw new Error('Native erosion polygons contain one another');
    for (let x = 0; x < a.length; x++) for (let y = 0; y < b.length; y++) {
      if (intersects(a[x]!, a[(x + 1) % a.length]!, b[y]!, b[(y + 1) % b.length]!)) throw new Error('Native erosion polygons overlap or touch');
    }
  }
}

/** Positive terrain is one bounded simple ring. Its optional absence is the
 * legacy rectangular terrain contract; null/undefined are not valid rings. */
export function validateNativeTerrainOutline(value: unknown, width: number, height: number,
  erosion: NativeErosionPolygons = []): asserts value is readonly NativeErosionPoint[] {
  validateNativeErosion([value], width, height);
  const outline = value as readonly NativeErosionPoint[];
  for (const hole of erosion) {
    if (hole.some(point => !contains(outline, point))) throw new Error('Terrain erosion must remain inside the positive outline');
    for (let i = 0; i < outline.length; i++) for (let j = 0; j < hole.length; j++) {
      if (intersects(outline[i]!, outline[(i + 1) % outline.length]!, hole[j]!, hole[(j + 1) % hole.length]!))
        throw new Error('Terrain erosion must not cross or touch the positive outline');
    }
  }
}

/** Empty CSV cells preserve the historical grade default exactly. */
export function parseNativeErosionCell(text: string, constructionVersion: number): NativeErosionPolygons | undefined {
  if (text === '') return undefined;
  if (constructionVersion !== 4) throw new Error('Explicit native erosion requires construction version 4');
  const polygons = text.split('|').map(polygon => polygon.split(';').map(point => {
    const values = point.split(':');
    if (values.length !== 2 || values.some(value => !/^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value))) throw new Error('Invalid native erosion x:y point');
    return { x: Number(values[0]), y: Number(values[1]) };
  }));
  validateNativeErosion(polygons);
  return polygons;
}

/** Ownership survives serialization; presence of a polygon list alone cannot
 * distinguish the old grade default from an explicitly authored cut. */
export function validateNativeGroundEdgeOwnership(definition: Pick<MasterDefinition, 'instances' | 'family' | 'authoredErosion' | 'erosion' | 'cols' | 'rows'>): void {
  if (definition.authoredErosion !== undefined && definition.authoredErosion !== true) throw new Error('Invalid authored erosion marker');
  if (definition.authoredErosion && definition.instances.some(instance => instance.constructionVersion !== 4)) throw new Error('Authored erosion requires construction 4');
  const holders = definition.instances.filter(instance => instance.groundEdgeWidth !== undefined);
  if (!holders.length) return;
  const primaryRelief = definition.instances.find(instance => instance.role === 'relief' && (instance.family ?? definition.family) === definition.family);
  if (!definition.authoredErosion || holders.length !== 1 || holders[0] !== primaryRelief || holders[0]!.constructionVersion !== 4
    || holders[0]!.height > 6 || holders[0]!.groundEdgeWidth! < 8 || holders[0]!.groundEdgeWidth! > 24)
    throw new Error('Authored ground edge must belong to the unique first v4 low primary relief');
  validateNativeErosion(definition.erosion, definition.cols * 32, definition.rows * 32);
}
