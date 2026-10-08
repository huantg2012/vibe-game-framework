/** An explicit pleated-skin variant cuts a short recess into the existing
 * folded surface. The skin, recess walls and closed bottom tile the same XY
 * footprint; neither its dark interior nor its light can create a passage. */
import type { Builder, Point, UV } from './native-volume-expansion';

interface Plane { axis: 0 | 1; limit: number; greater: boolean }
export interface PleatedTear {
  triangle(a: Point, b: Point, c: Point): void;
}
const uv = (p: Point): UV => [p[0], p[1]];
const EPSILON = 1e-7;

/** The caller places this on the right piece's actual folded ridge. Native
 * lengths remain readable when the surrounding sheet is unusually small. */
export function createPleatedTear(builder: Builder, centre: Point, tangent: UV): PleatedTear {
  const magnitude = Math.hypot(...tangent);
  if (magnitude < EPSILON) throw new Error('Pleated tear needs a real surface direction');
  const direction: UV = [tangent[0] / magnitude, tangent[1] / magnitude];
  const normal: UV = [-direction[1], direction[0]];
  const length = Math.min(12, builder.spec.length * .15, builder.spec.width * .15);
  const halfWidth = Math.min(1.3, length * .11), depth = Math.min(1.4, builder.spec.height * .06);
  const local = (p: Point, axis: 0 | 1): number => {
    const basis = axis === 0 ? direction : normal;
    return (p[0] - centre[0]) * basis[0] + (p[1] - centre[1]) * basis[1];
  };
  const planes: readonly Plane[] = [
    { axis: 0, limit: -length / 2, greater: true }, { axis: 0, limit: length / 2, greater: false },
    { axis: 1, limit: -halfWidth, greater: true }, { axis: 1, limit: halfWidth, greater: false },
  ];
  const clip = (polygon: readonly Point[], plane: Plane): Point[] => {
    const output: Point[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
      const av = local(a, plane.axis), bv = local(b, plane.axis);
      const ai = plane.greater ? av >= plane.limit : av <= plane.limit;
      const bi = plane.greater ? bv >= plane.limit : bv <= plane.limit;
      if (ai) output.push(a);
      if (ai !== bi) {
        const t = (plane.limit - av) / (bv - av);
        output.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return output;
  };
  const draw = (polygon: readonly Point[], material: number, region: number): void => {
    for (let i = 1; i + 1 < polygon.length; i++) {
      const a = polygon[0]!, b = polygon[i]!, c = polygon[i + 1]!;
      builder.quad(a, b, c, c, material, [uv(a), uv(b), uv(c), uv(c)], [0, 0, 1], region);
    }
  };
  const bottom = (p: Point, lift = 0): Point => {
    const along = local(p, 0) * .94, across = local(p, 1) * .72;
    return [centre[0] + direction[0] * along + normal[0] * across,
      centre[1] + direction[1] * along + normal[1] * across, p[2] - depth + lift];
  };
  const glowPlanes: readonly Plane[] = [
    { axis: 0, limit: -length * .35, greater: true }, { axis: 0, limit: length * .35, greater: false },
    { axis: 1, limit: -halfWidth * .55, greater: true }, { axis: 1, limit: halfWidth * .75, greater: false },
  ];
  let jointWritten = false;
  return {
    triangle(a, b, c): void {
      let inside: Point[] = [a, b, c];
      // Partition, rather than overlay, the intact top. Every part removed
      // from it is replaced by the same recess's sloping wall and solid floor.
      for (const plane of planes) {
        draw(clip(inside, { ...plane, greater: !plane.greater }), 0, 4);
        inside = clip(inside, plane);
        if (inside.length < 3) return;
      }
      const floor = inside.map(p => bottom(p));
      draw(floor, 2, 3);
      for (let i = 0; i < inside.length; i++) {
        const next = (i + 1) % inside.length, p = inside[i]!, q = inside[next]!;
        // Shared original-triangle edges are not internal walls. Only the
        // real boundary of the short tear closes its shallow volume.
        if (!planes.some(plane => Math.abs(local(p, plane.axis) - plane.limit) < EPSILON
          && Math.abs(local(q, plane.axis) - plane.limit) < EPSILON)) continue;
        builder.quad(p, q, floor[next]!, floor[i]!, 2, [uv(p), uv(q), uv(floor[next]!), uv(floor[i]!)], [0, 0, 1], 3);
      }
      if (builder.spec.blocking !== 1) return;
      let glow = inside;
      for (const plane of glowPlanes) glow = clip(glow, plane);
      if (glow.length < 3) return;
      const lit = glow.map(p => bottom(p, .04));
      draw(lit, 3, 3);
      if (!jointWritten) {
        // A convex-polygon centroid is on this exact luminous face. No guessed
        // instance-centre light remains when the old subpixel marker is absent.
        builder.joint([lit.reduce((sum, p) => sum + p[0], 0) / lit.length,
          lit.reduce((sum, p) => sum + p[1], 0) / lit.length,
          lit.reduce((sum, p) => sum + p[2], 0) / lit.length]);
        jointWritten = true;
      }
    },
  };
}
