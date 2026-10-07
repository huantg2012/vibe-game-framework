import type { Builder, Point, UV } from './native-volume-expansion';

type Triangle = readonly [Point, Point, Point];
type Edge = { a: UV; b: UV; uses: number };
const cross = (a: UV, b: UV): number => a[0] * b[1] - a[1] * b[0];
const subtract = (a: UV, b: UV): UV => [a[0] - b[0], a[1] - b[1]];
const xy = (p: Point): UV => [p[0], p[1]];

/** Explicit shallow counterpart of an existing construction. The source's
 * complete XY triangles remain the material domain, including broken tips
 * and open mouths. Only its exposed shallow surface settles into that domain.
 * This is not a postprocess for any existing or blocking profile. */
export function buildSettledProjection(b: Builder, construct: (source: Builder) => void, refine: boolean): void {
  if (b.spec.blocking !== 0 || b.spec.height > 6) throw new Error('Settled projection requires shallow nonblocking material');
  const source: Triangle[] = [];
  const add = (a: Point, c: Point, d: Point): void => {
    if (Math.abs(cross(subtract(xy(c), xy(a)), subtract(xy(d), xy(a)))) > 1e-8) source.push([a, c, d]);
  };
  construct({ spec: b.spec, quad(a, c, d, e) { add(a, c, d); add(a, d, e); },
    joint() { throw new Error('Shallow source must not emit a pollution joint'); } });

  const weights = (p: UV, t: Triangle): readonly [number, number, number] | null => {
    const a = xy(t[0]), ab = subtract(xy(t[1]), a), ac = subtract(xy(t[2]), a), ap = subtract(p, a);
    const area = cross(ab, ac), v = cross(ap, ac) / area, w = cross(ab, ap) / area, u = 1 - v - w;
    return u >= -1e-8 && v >= -1e-8 && w >= -1e-8 ? [u, v, w] : null;
  };
  const contains = (p: UV): boolean => source.some(t => weights(p, t) !== null);
  const key = (p: UV): string => `${p[0].toFixed(7)},${p[1].toFixed(7)}`;
  const edges = new Map<string, Edge>();
  for (const t of source) for (let i = 0; i < 3; i++) {
    const a = xy(t[i]!), c = xy(t[(i + 1) % 3]!), ak = key(a), ck = key(c), id = ak < ck ? `${ak}/${ck}` : `${ck}/${ak}`;
    const edge = edges.get(id);
    if (edge) edge.uses++; else edges.set(id, { a, b: c, uses: 1 });
  }
  // Internal triangulation edges cancel. At overlapping attached tips, split
  // the remaining candidates and keep only segments with material on one side.
  // Thus a buried connection cannot become another visible rim.
  const candidates = [...edges.values()].filter(e => e.uses === 1), boundary: Edge[] = [];
  const epsilon = Math.max(b.spec.length, b.spec.width) * 1e-6;
  for (const edge of candidates) {
    const ab = subtract(edge.b, edge.a), length = Math.hypot(...ab), cuts = [0, 1];
    for (const other of candidates) {
      if (other === edge) continue;
      const cd = subtract(other.b, other.a), ac = subtract(other.a, edge.a), denominator = cross(ab, cd);
      if (Math.abs(denominator) > 1e-9) {
        const t = cross(ac, cd) / denominator, u = cross(ac, ab) / denominator;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
      } else if (Math.abs(cross(ac, ab)) < 1e-7) {
        for (const p of [other.a, other.b]) {
          const ap = subtract(p, edge.a), t = (ap[0] * ab[0] + ap[1] * ab[1]) / (length * length);
          if (t > 0 && t < 1) cuts.push(t);
        }
      }
    }
    cuts.sort((a, c) => a - c);
    const at = (t: number): UV => [edge.a[0] + ab[0] * t, edge.a[1] + ab[1] * t];
    for (let i = 0; i < cuts.length - 1; i++) {
      if (cuts[i + 1]! - cuts[i]! < 1e-8) continue;
      const p = at((cuts[i]! + cuts[i + 1]!) / 2), nx = -ab[1] / length * epsilon, ny = ab[0] / length * epsilon;
      if (contains([p[0] + nx, p[1] + ny]) !== contains([p[0] - nx, p[1] - ny]))
        boundary.push({ a: at(cuts[i]!), b: at(cuts[i + 1]!), uses: 1 });
    }
  }
  if (!boundary.length) throw new Error('Settled material has no exterior boundary');
  const cache = new Map<string, Point>();
  const surface = (p: UV): Point => {
    const id = key(p), known = cache.get(id); if (known) return known;
    let distance = Infinity, height = 0;
    for (const edge of boundary) {
      const ab = subtract(edge.b, edge.a), ap = subtract(p, edge.a);
      const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1]) / (ab[0] * ab[0] + ab[1] * ab[1])));
      distance = Math.min(distance, Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t));
    }
    for (const triangle of source) {
      const w = weights(p, triangle);
      if (w) height = Math.max(height, w[0] * triangle[0][2] + w[1] * triangle[1][2] + w[2] * triangle[2][2]);
    }
    // Broad pressure direction changes the settling distance smoothly; there
    // is no raised rim, repeated notch noise, or separate outline material.
    const span = Math.min(34, Math.max(16, b.spec.width * .18)) * (1 + .22 * p[0] / b.spec.length - .12 * p[1] / b.spec.width);
    const t = Math.max(0, Math.min(1, distance / span)), settled = t * t * (3 - 2 * t);
    const point: Point = [p[0], p[1], height * settled]; cache.set(id, point); return point;
  };
  const emit = (a: UV, c: UV, d: UV): void => {
    b.quad(surface(a), surface(c), surface(d), surface(d), 0, [a, c, d, d], [0, 0, 1], 0);
  };
  const midpoint = (a: UV, c: UV): UV => [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
  for (const triangle of source) {
    const [a, c, d] = triangle.map(xy) as [UV, UV, UV];
    if (refine) {
      const ac = midpoint(a, c), cd = midpoint(c, d), da = midpoint(d, a);
      emit(a, ac, da); emit(ac, c, cd); emit(da, cd, d); emit(ac, cd, da);
    } else emit(a, c, d);
  }
}
