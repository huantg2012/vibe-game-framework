import type { Builder, Point, UV } from './native-volume-expansion';
import type { NativeErosionPoint, NativeErosionPolygons } from './native-volume-erosion';

export interface NativeGroundEdgeContext {
  readonly polygons: NativeErosionPolygons;
  readonly width: number;
  readonly height: number;
  /** The master's authoritative 8px terrain-presence function. */
  readonly matterAt: (x: number, y: number) => boolean;
}
function distance(p: NativeErosionPoint, a: NativeErosionPoint, b: NativeErosionPoint): number {
  const x = b.x - a.x, y = b.y - a.y, length = x * x + y * y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * x + (p.y - a.y) * y) / length));
  return Math.hypot(p.x - a.x - x * t, p.y - a.y - y * t);
}

/** Ground-side material at an authored cut. The mesh occupies only the exact
 * present 8px cells used by the master; it never bridges a VOID cell. */
export function appendNativeGroundEdges(b: Builder, context: NativeGroundEdgeContext): void {
  const width = b.spec.groundEdgeWidth;
  if (width === undefined) return;
  if (!context || !context.polygons.length || typeof context.matterAt !== 'function'
    || !Number.isInteger(context.width / 8) || !Number.isInteger(context.height / 8)) throw new Error('Ground edge requires the complete authoritative terrain context');
  const cosine = Math.cos(b.spec.rotation), sine = Math.sin(b.spec.rotation);
  const local = (x: number, y: number, z: number): Point => {
    const dx = x - b.spec.x, dy = y - b.spec.y;
    return [dx * cosine + dy * sine, -dx * sine + dy * cosine, z];
  };
  const nearest = (x: number, y: number): number => {
    let result = Infinity;
    for (const polygon of context.polygons) for (let i = 0; i < polygon.length; i++) result = Math.min(result, distance({ x, y }, polygon[i]!, polygon[(i + 1) % polygon.length]!));
    return result;
  };
  const heightAt = (x: number, y: number): number => {
    const t = Math.min(1, nearest(x, y) / width);
    // A steep short section rises from the cut into a long, shallow material
    // shoulder and terminates in the same ground. It is not a painted outline.
    return b.spec.height * (t < .30 ? t / .30 : (1 - t) / .70);
  };
  const normalRunsAcrossX = (x: number, y: number): boolean => {
    let nearestSquared = Infinity, acrossX = true;
    for (const polygon of context.polygons) for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, c = polygon[(i + 1) % polygon.length]!, dx = c.x - a.x, dy = c.y - a.y;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)));
      const nx = x - a.x - dx * t, ny = y - a.y - dy * t, squared = nx * nx + ny * ny;
      if (squared < nearestSquared) {
        nearestSquared = squared;
        acrossX = squared < 1e-12 ? Math.abs(dy) >= Math.abs(dx) : Math.abs(nx) >= Math.abs(ny);
      }
    }
    return acrossX;
  };
  let previousPeak = 0;
  const cells = new Map<number, { col: number; row: number; acrossX: boolean }>();
  // Each split reaches both ends of the cell. A shared-edge midpoint is also
  // included by its neighbour, even where the nearest shore turns a corner.
  // This preserves one height along the seam instead of isolated centre peaks.
  const horizontalMidpoints = new Set<number>(), verticalMidpoints = new Set<number>();
  const stride = context.width / 8 + 1;
  for (const polygon of context.polygons) {
    const minX = Math.max(0, Math.floor((Math.min(...polygon.map(p => p.x)) - width) / 8));
    const maxX = Math.min(context.width / 8 - 1, Math.floor((Math.max(...polygon.map(p => p.x)) + width) / 8));
    const minY = Math.max(0, Math.floor((Math.min(...polygon.map(p => p.y)) - width) / 8));
    const maxY = Math.min(context.height / 8 - 1, Math.floor((Math.max(...polygon.map(p => p.y)) + width) / 8));
    for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
      const key = row * (context.width / 8) + col, x = col * 8, y = row * 8;
      if (cells.has(key) || !context.matterAt(x + 4, y + 4) || nearest(x + 4, y + 4) > width + 6) continue;
      // MeshBuilder normalizes the complete object by its highest vertex. Keep
      // the previous bank sample maximum so changing bank tessellation cannot
      // rescale the unrelated shallow formation that owns this ground edge.
      previousPeak = Math.max(previousPeak, heightAt(x, y), heightAt(x + 8, y),
        heightAt(x + 8, y + 8), heightAt(x, y + 8), heightAt(x + 4, y + 4));
      const acrossX = normalRunsAcrossX(x + 4, y + 4);
      const samples: readonly UV[] = [[x, y], [x + 8, y], [x + 8, y + 8], [x, y + 8],
        [x + 4, y], [x + 4, y + 8], [x, y + 4], [x + 8, y + 4]];
      if (samples.every(p => heightAt(p[0], p[1]) === 0)) continue;
      cells.set(key, { col, row, acrossX });
      if (acrossX) {
        horizontalMidpoints.add(row * stride + col); horizontalMidpoints.add((row + 1) * stride + col);
      } else {
        verticalMidpoints.add(row * stride + col); verticalMidpoints.add(row * stride + col + 1);
      }
    }
  }
  let triangles = 0, nextPeak = 0;
  const faces: (readonly UV[])[] = [];
  const face = (polygon: readonly UV[]): void => {
    triangles += polygon.length - 2;
    if (triangles > 2048) throw new Error('Authored ground cut exceeds the 2048-triangle edge budget');
    faces.push(polygon);
    for (const p of polygon) nextPeak = Math.max(nextPeak, heightAt(p[0], p[1]));
  };
  for (const { col, row, acrossX } of cells.values()) {
    const x = col * 8, y = row * 8;
    const a: UV = [x, y], c: UV = [x + 8, y], d: UV = [x + 8, y + 8], e: UV = [x, y + 8];
    const top: UV = [x + 4, y], right: UV = [x + 8, y + 4], bottom: UV = [x + 4, y + 8], left: UV = [x, y + 4];
    if (acrossX) {
      face([top, bottom, e, ...(verticalMidpoints.has(row * stride + col) ? [left] : []), a]);
      face([top, c, ...(verticalMidpoints.has(row * stride + col + 1) ? [right] : []), d, bottom]);
    } else {
      face([left, a, ...(horizontalMidpoints.has(row * stride + col) ? [top] : []), c, right]);
      face([left, right, d, ...(horizontalMidpoints.has((row + 1) * stride + col) ? [bottom] : []), e]);
    }
  }
  if (triangles === 0 || nextPeak === 0) throw new Error('Authored ground edge produced no present material');
  const heightScale = previousPeak > 0 ? previousPeak / nextPeak : 1;
  for (const polygon of faces) {
    const points = polygon.map(p => local(p[0], p[1], heightAt(p[0], p[1]) * heightScale));
    for (let i = 1; i < polygon.length - 1; i++) b.quad(points[0]!, points[i]!, points[i + 1]!, points[i + 1]!, 1,
      [polygon[0]!, polygon[i]!, polygon[i + 1]!, polygon[i + 1]!], [0, 0, 1], 3);
  }
}
