/** Construction 4: ground divisions and grounded middle-scale material.
 * These surfaces share the ordinary native raster/body path. None is a bridge,
 * a walkable upper floor, or a source of pollution/visibility semantics. */
import type { Builder, Point, UV } from './native-volume-expansion';

export const NATIVE_VOLUME_V4_PROFILES = ['fracture-fan', 'fallen-bundle', 'clamp-bank', 'torn-sheet'] as const;
export type NativeVolumeV4Profile = typeof NATIVE_VOLUME_V4_PROFILES[number];
const uv = (p: Point): UV => [p[0], p[1]];

/** A bounded opening in one real face, shared by infection and its source.
 * Barycentric placement keeps both the green area and light joint on material. */
function fracturedFace(b: Builder, a: Point, c: Point, d: Point): void {
  if (b.spec.blocking !== 1) return;
  const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
  const perpendicular = Math.abs((c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0])) / Math.max(.001, length);
  const du = Math.min(.34, 24 / Math.max(1, length)), dv = Math.min(.23, 6 / Math.max(1, perpendicular));
  const sample = (u: number, v: number): Point => [a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v, a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + .06];
  const p = sample(.17, .14), q = sample(.17 + du, .14), r = sample(.17 + du * .78, .14 + dv), t = sample(.17, .14 + dv);
  b.quad(p, q, r, t, 3, [uv(p), uv(q), uv(r), uv(t)], [0, 0, 1], 3);
  b.joint(sample(.17 + du * .43, .14 + dv * .43));
}

/** A convex material section. All top points lie on one authored plane; the
 * fan triangulation therefore cannot invent a mound at its centre. */
function insetOutline(b: Builder, outline: readonly UV[]): UV[] {
  const cx = outline.reduce((sum, p) => sum + p[0], 0) / outline.length, cy = outline.reduce((sum, p) => sum + p[1], 0) / outline.length;
  return outline.map(([x, y]): UV => {
    const factor = b.spec.blocking === 1 ? Math.min(.25, 6.5 / Math.max(1, Math.hypot(x - cx, y - cy))) : 0;
    return [x + (cx - x) * factor, y + (cy - y) * factor];
  });
}
function surfaceHeight(b: Builder, height: number): number {
  const foot = b.spec.blocking === 1 ? Math.min(6, b.spec.height * .30) : 0;
  return foot + height * (1 - foot / b.spec.height);
}
function section(b: Builder, outline: readonly UV[], height: (x: number, y: number) => number, scar = false, closed = true): void {
  const crown = closed ? insetOutline(b, outline) : outline;
  const top = crown.map(([x, y]): Point => [x, y, surfaceHeight(b, height(x, y))]);
  const cx = crown.reduce((sum, p) => sum + p[0], 0) / crown.length;
  const cy = crown.reduce((sum, p) => sum + p[1], 0) / crown.length;
  const centre: Point = [cx, cy, surfaceHeight(b, height(cx, cy))];
  for (let i = 0; i < top.length; i++) {
    const a = top[i]!, c = top[(i + 1) % top.length]!;
    b.quad(a, c, centre, centre, 0, [uv(a), uv(c), uv(centre), uv(centre)], [0, 0, 1]);
    if (closed) {
      const footA = outline[i]!, footC = outline[(i + 1) % outline.length]!, af: Point = [...footA, 0], cf: Point = [...footC, 0];
      b.quad(af, cf, c, a, 1, [[a[0], 0], [c[0], 0], [c[0], c[2]], [a[0], a[2]]],
        [a[0] + c[0] - 2 * cx, a[1] + c[1] - 2 * cy, 0], 3);
    }
    if (scar && i === 1) fracturedFace(b, a, c, centre);
  }
}

/** A tensor strip is an actual broad surface, with changing cross-sections.
 * Each row begins/ends on the ground. End sections are real torn faces. */
function strip(b: Builder, rows: readonly (readonly Point[])[], innerFrom = Infinity): void {
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!, c = rows[i + 1]!;
    for (let j = 0; j < a.length - 1; j++) {
      const edge = j === 0 || j === a.length - 2;
      b.quad(a[j]!, c[j]!, c[j + 1]!, a[j + 1]!, edge ? 1 : j >= innerFrom ? 2 : 0,
        [uv(a[j]!), uv(c[j]!), uv(c[j + 1]!), uv(a[j + 1]!)], [0, 0, 1], edge ? 3 : 0);
      if (i === 1 && j === 3) fracturedFace(b, a[j]!, c[j]!, c[j + 1]!);
    }
  }
  for (const index of [0, rows.length - 1]) {
    const row = rows[index]!, direction = index === 0 ? -1 : 1;
    for (let j = 0; j < row.length - 1; j++) {
      const a = row[j]!, c = row[j + 1]!, af: Point = [a[0], a[1], 0], cf: Point = [c[0], c[1], 0];
      b.quad(af, a, c, cf, 1, [uv(af), uv(a), uv(c), uv(cf)], [direction, 0, 0], 3);
    }
  }
}

function fractureFan(b: Builder): void {
  const s = b.spec, l = s.length, w = s.width;
  // Three convex planes join along their full rear seam. Their unequal front
  // ends leave two true retreats. Never cap across either concave notch.
  const parts: readonly (readonly UV[])[] = [
    [[-.50, -.30], [-.32, -.49], [.24, -.40], [.43, -.18], [.09, -.04], [-.30, -.10]],
    [[-.30, -.10], [.09, -.04], [-.02, .36], [-.30, .50], [-.46, .17]],
    [[.09, -.04], [.43, -.18], [.51, .17], [.29, .39], [.16, .21]],
  ];
  for (let i = 0; i < parts.length; i++) {
    const points = parts[i]!.map(([x, y]): UV => [x * l, y * w]);
    const foot = s.blocking === 1 ? .38 : .08;
    section(b, points, (x, y) => s.height * (foot + .34 + x / l * (.12 + s.fold * .18) - y / w * .17 + i * .045), i === 0);
  }
}

function fallenBundle(b: Builder): void {
  const s = b.spec, rows: Point[][] = [];
  const bend = (((Math.imul(s.seed, 1103515245) >>> 0) / 0x100000000) - .5) * s.distortion * .06;
  const widths = [1, 1.16, 1.02, .77, .64, .38];
  const xs = [-.50, -.34, -.10, .15, .34, .50];
  for (let i = 0; i < xs.length; i++) {
    const t = i / (xs.length - 1), x = xs[i]! * s.length;
    const centre = s.width * (Math.sin(t * 2.2) * (.12 + s.fold * .06 + bend) - .06);
    const radius = s.width * .40 * widths[i]!;
    const peak = s.height * (.93 - t * .48 + Math.sin(t * Math.PI) * .10);
    const foot = s.blocking === 1 ? Math.min(7, peak * .30) : 0;
    const profile: readonly UV[] = [[-1, 0], [-.93, foot / peak], [-.63, .69], [-.16, 1], [.32, .85], [.77, .41], [.96, foot / peak], [1, 0]];
    rows.push(profile.map(([across, rise], at): Point => [x + s.length * .022 * across * (i === 0 ? 1 : i === xs.length - 1 ? -1 : 0),
      centre + radius * across * (across > 0 ? .84 + .10 * t : 1), at === 0 || at === profile.length - 1 ? 0 : Math.max(foot, peak * rise)]));
  }
  strip(b, rows);
  // The last torn shoulder splits into unequal flat splinters, attached at
  // their roots. This is a fallen broken end, not a new upright comb spine.
  const count = Math.min(4, s.branches);
  for (let i = 0; i < count; i++) {
    const y = s.width * (.02 + (i / (count - 1) - .5) * .22), x = s.length * (.38 + i % 2 * .022);
    section(b, [[x, y - s.width * .065], [s.length * (.56 + .035 * i), y - s.width * .026],
      [s.length * (.53 + .032 * i), y + s.width * .019], [x, y + s.width * .039]],
    (px) => s.height * (.26 - (px / s.length - .38) * .63));
  }
}

function clampBank(b: Builder): void {
  const s = b.spec, rows: Point[][] = [];
  const along = [-.50, -.36, -.13, .12, .34, .49];
  const breadths = [.62, 1, 1.14, .91, .72, .35];
  for (let i = 0; i < along.length; i++) {
    const x = along[i]! * s.length, bend = s.width * (.10 * Math.sin(i * .65) - .03);
    const width = s.width * breadths[i]!, peak = s.height * (.70 + .30 * Math.sin((i + .6) / (along.length + .2) * Math.PI));
    const foot = s.blocking === 1 ? Math.min(8, peak * .32) : 0;
    // Wide outer back, a single crest and a long concave inner slope. The
    // squeezed material is a separate relief instance meeting this inner foot.
    const profile: readonly UV[] = [[-.50, 0], [-.46, foot / peak], [-.34, .58], [-.13 - s.fold * .045, 1], [.05, .91], [.20 + s.opening * .035, .43], [.40, .19], [.47, foot / peak], [.50, 0]];
    rows.push(profile.map(([across, rise], at): Point => [x + s.length * .028 * across,
      bend + width * across, at === 0 || at === profile.length - 1 ? 0 : Math.max(foot, peak * rise)]));
  }
  strip(b, rows, 4);
}

function tornSheet(b: Builder): void {
  const s = b.spec;
  // A large low skin has broad two-dimensional patches; the open bite lies
  // between them. For solid use, the same patches become grounded rolled lips.
  const parts: readonly (readonly UV[])[] = [
    [[-.50, -.23], [-.29, -.48], [.13, -.37], [.04, -.02], [-.28, .13], [-.46, .02]],
    [[-.28, .13], [.04, -.02], [.13, .23], [-.10, .49], [-.37, .34]],
    [[.13, -.37], [.40, -.26], [.51, -.03], [.34, .29], [.23, .13], [.04, -.02]],
  ];
  // Clip broad convex skin into affine bands before folding. A fan with one
  // raised centre would make three stone-like pyramids, not a continuous roll.
  const tilt = .12 + s.fold * .18;
  const coordinate = ([x, y]: UV): number => y + tilt * x;
  const clip = (polygon: readonly UV[], boundary: number, greater: boolean): UV[] => {
    const result: UV[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j]!, c = polygon[(j + 1) % polygon.length]!, av = coordinate(a), cv = coordinate(c);
      const ai = greater ? av >= boundary : av <= boundary, ci = greater ? cv >= boundary : cv <= boundary;
      if (ai) result.push(a);
      if (ai !== ci) { const t = (boundary - av) / (cv - av); result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
    }
    return result;
  };
  const bands = [-.7, -.30, -.12, .03 + s.opening * .04, .26, .7];
  const rise = [s.blocking === 1 ? .24 : .08, .73, 1, .43, .22, .16];
  for (let i = 0; i < parts.length; i++) {
    const foot = parts[i]!.map(([x, y]): UV => [x * s.length, y * s.width]), crown = insetOutline(b, foot);
    const normalized = crown.map(([x, y]): UV => [x / s.length, y / s.width]);
    const height = (x: number, y: number): number => {
      const v = coordinate([x / s.length, y / s.width]);
      const band = Math.max(0, Math.min(bands.length - 2, bands.findIndex(boundary => boundary > v) - 1));
      const t = (v - bands[band]!) / (bands[band + 1]! - bands[band]!);
      return s.height * (rise[band]! + (rise[band + 1]! - rise[band]!) * t) * (i === 0 ? 1 : i === 1 ? .62 : .83);
    };
    for (let band = 0; band < bands.length - 1; band++) {
      const polygon = clip(clip(normalized, bands[band]!, true), bands[band + 1]!, false);
      if (polygon.length < 3) continue;
      // Internal fold boundaries share their exact top vertices. They have no
      // ground-reaching sidewalls and therefore cannot become striped blocks.
      section(b, polygon.map(([x, y]): UV => [x * s.length, y * s.width]), height, i === 0 && band === 2, false);
    }
    for (let j = 0; j < foot.length; j++) {
      const af = foot[j]!, cf = foot[(j + 1) % foot.length]!, a = crown[j]!, c = crown[(j + 1) % crown.length]!;
      const av = coordinate([a[0] / s.length, a[1] / s.width]), cv = coordinate([c[0] / s.length, c[1] / s.width]);
      const cuts = [0, ...bands.map(boundary => (boundary - av) / (cv - av)).filter(t => t > 0 && t < 1), 1].sort((x, y) => x - y);
      const at = (u: UV, v: UV, t: number): UV => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
      for (let k = 0; k < cuts.length - 1; k++) {
        const p = at(a, c, cuts[k]!), q = at(a, c, cuts[k + 1]!);
        const pFoot: Point = [...at(af, cf, cuts[k]!), 0], qFoot: Point = [...at(af, cf, cuts[k + 1]!), 0];
        const pTop: Point = [...p, surfaceHeight(b, height(...p))], qTop: Point = [...q, surfaceHeight(b, height(...q))];
        b.quad(pFoot, qFoot, qTop, pTop, 1, [uv(pFoot), uv(qFoot), uv(qTop), uv(pTop)], [0, 0, 1], 2);
      }
    }
  }
}

export function buildGroundNativeVolume(builder: Builder): void {
  switch (builder.spec.shapeProfile) {
    case 'fracture-fan': fractureFan(builder); return;
    case 'fallen-bundle': fallenBundle(builder); return;
    case 'clamp-bank': clampBank(builder); return;
    case 'torn-sheet': tornSheet(builder); return;
    default: throw new Error('Unknown construction 4 native shape profile');
  }
}
