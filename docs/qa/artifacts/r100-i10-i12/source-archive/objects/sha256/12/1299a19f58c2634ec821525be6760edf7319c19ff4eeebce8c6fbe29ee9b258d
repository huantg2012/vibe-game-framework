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
  const cosine = Math.cos(b.spec.rotation), sine = Math.sin(b.spec.rotation), emitted = new Set<number>();
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
  for (const polygon of context.polygons) {
    const minX = Math.max(0, Math.floor((Math.min(...polygon.map(p => p.x)) - width) / 8));
    const maxX = Math.min(context.width / 8 - 1, Math.floor((Math.max(...polygon.map(p => p.x)) + width) / 8));
    const minY = Math.max(0, Math.floor((Math.min(...polygon.map(p => p.y)) - width) / 8));
    const maxY = Math.min(context.height / 8 - 1, Math.floor((Math.max(...polygon.map(p => p.y)) + width) / 8));
    for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
      const key = row * (context.width / 8) + col, x = col * 8, y = row * 8;
      if (emitted.has(key) || !context.matterAt(x + 4, y + 4) || nearest(x + 4, y + 4) > width + 6) continue;
      const points: readonly Point[] = [[x, y, heightAt(x, y)], [x + 8, y, heightAt(x + 8, y)],
        [x + 8, y + 8, heightAt(x + 8, y + 8)], [x, y + 8, heightAt(x, y + 8)]];
      const centre = local(x + 4, y + 4, heightAt(x + 4, y + 4));
      if (points.every(p => p[2] === 0) && centre[2] === 0) continue;
      emitted.add(key);
      if (emitted.size > 512) throw new Error('Authored ground cut exceeds the 2048-triangle edge budget');
      const p = points.map(v => local(v[0], v[1], v[2]));
      const texels: [UV, UV, UV, UV] = [[x, y], [x + 8, y], [x + 8, y + 8], [x, y + 8]];
      // Width8 along an 8px-aligned cut has zero at both cell edges. Include
      // the cell's interior peak without changing the authoritative body grid.
      for (let edge = 0; edge < 4; edge++) b.quad(p[edge]!, p[(edge + 1) % 4]!, centre, centre, 1,
        [texels[edge]!, texels[(edge + 1) % 4]!, [x + 4, y + 4], [x + 4, y + 4]], [0, 0, 1], 3);
    }
  }
  if (emitted.size === 0) throw new Error('Authored ground edge produced no present material');
}
