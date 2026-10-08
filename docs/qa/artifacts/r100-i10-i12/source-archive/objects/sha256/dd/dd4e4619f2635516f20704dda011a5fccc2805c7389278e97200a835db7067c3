/** Construction 4: ground divisions and grounded middle-scale material.
 * These surfaces share the ordinary native raster/body path. None is a bridge,
 * a walkable upper floor, or a source of pollution/visibility semantics. */
import type { Builder, Point, UV } from './native-volume-expansion';
import { buildCompressedWedge, buildPorousBreak } from './native-volume-organization';
import { buildSettledSheet, buildSettledFan } from './native-volume-settled-sheet';

export const NATIVE_VOLUME_V4_PROFILES = ['fracture-fan', 'fallen-bundle', 'clamp-bank', 'torn-sheet', 'compressed-wedge', 'porous-break', 'settled-sheet', 'settled-fan'] as const;
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
  // One continuous bed owns the exterior footprint. The rear and left arm
  // remain one mother plane; only the short right shoulder is pressed down.
  // Shared crown vertices never get a ground-reaching internal cut wall.
  const outline: readonly UV[] = [[-.50, -.30], [-.32, -.49], [.24, -.40], [.43, -.18],
    [.51, .17], [.29, .39], [.16, .21], [.09, -.04], [-.02, .36], [-.30, .50], [-.46, .17], [-.30, -.10]];
  const feet = outline.map(([x, y]): UV => [x * l, y * w]);
  const depths = [.16, .10, .18, .48, .94, .30, .78, .42, .70, 1, .26, .12];
  const breadth = Math.min(s.blocking === 1 ? 11 : 6, Math.min(l, w) * .065);
  const inward = (a: UV, c: UV): UV => {
    const dx = c[0] - a[0], dy = c[1] - a[1], size = Math.hypot(dx, dy);
    return [-dy / size, dx / size];
  };
  const crown = feet.map((p, i): UV => {
    const before = inward(feet[(i + feet.length - 1) % feet.length]!, p), after = inward(p, feet[(i + 1) % feet.length]!);
    const dx = before[0] + after[0], dy = before[1] + after[1], size = Math.hypot(dx, dy);
    return [p[0] + dx / size * breadth * depths[i]!, p[1] + dy / size * breadth * depths[i]!];
  });
  type Rim = { readonly foot: UV; readonly top: UV };
  const rims: Rim[][] = feet.map((a, i) => {
    const next = (i + 1) % feet.length, c = feet[next]!, p = crown[i]!, q = crown[next]!, normal = inward(a, c);
    // Two large broken ends, each tapering into intact skin. A single chipped
    // lip interrupts the nearer end; no repeating scallops or jitter ring.
    const samples = i === 4 ? [0, .24, .61, .76, 1] : i === 8 ? [0, .32, .79, 1] : [0, 1];
    return samples.map(t => {
      const chip = i === 4 ? (t === .61 ? .83 : t === .76 ? .12 : 0) : i === 8 && t === .32 ? .38 : 0;
      return { foot: [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t],
        top: [p[0] + (q[0] - p[0]) * t + normal[0] * breadth * chip,
          p[1] + (q[1] - p[1]) * t + normal[1] * breadth * chip] };
    });
  });
  const parts = [[0, 1, 2, 3, 7, 11], [11, 7, 8, 9, 10], [7, 3, 4, 5, 6]];
  const alongShoulder = ([x, y]: UV): number => ((y / w + .04) * .34 + (x / l - .09) * .14) / Math.hypot(.34, .14);
  const bands = [-1, .055, .14, 1], drops = [0, 0, .27, .45];
  const height = (p: UV, part: number): number => {
    let drop = 0;
    if (part === 2) {
      const v = alongShoulder(p), band = Math.max(0, Math.min(2, bands.findIndex(at => at > v) - 1));
      const t = (v - bands[band]!) / (bands[band + 1]! - bands[band]!);
      drop = drops[band]! + (drops[band + 1]! - drops[band]!) * t;
    }
    return surfaceHeight(b, s.height * (.78 + p[0] / l * (.08 + s.fold * .08) - p[1] / w * .13 - drop));
  };
  const clip = (polygon: readonly UV[], boundary: number, greater: boolean): UV[] => {
    const result: UV[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j]!, c = polygon[(j + 1) % polygon.length]!, av = alongShoulder(a), cv = alongShoulder(c);
      const ai = greater ? av >= boundary : av <= boundary, ci = greater ? cv >= boundary : cv <= boundary;
      if (ai) result.push(a);
      if (ai !== ci) { const t = (boundary - av) / (cv - av); result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
    }
    return result;
  };
  for (const [part, indices] of parts.entries()) {
    const polygon: UV[] = [];
    for (let i = 0; i < indices.length; i++) {
      const at = indices[i]!, next = indices[(i + 1) % indices.length]!;
      if ((at + 1) % feet.length === next) polygon.push(...rims[at]!.slice(0, -1).map(p => p.top));
      else polygon.push(crown[at]!);
    }
    for (let band = 0; band < (part === 2 ? 3 : 1); band++) {
      const face = part === 2 ? clip(clip(polygon, bands[band]!, true), bands[band + 1]!, false) : polygon;
      if (face.length < 3) continue;
      const centre: UV = [face.reduce((sum, p) => sum + p[0], 0) / face.length, face.reduce((sum, p) => sum + p[1], 0) / face.length];
      const mid: Point = [...centre, height(centre, part)];
      for (let i = 0; i < face.length; i++) {
        const p = face[i]!, q = face[(i + 1) % face.length]!, a: Point = [...p, height(p, part)], c: Point = [...q, height(q, part)];
        b.quad(a, c, mid, mid, 0, [uv(a), uv(c), uv(mid), uv(mid)], [0, 0, 1]);
        if (part === 0 && i === 1) fracturedFace(b, a, c, mid);
      }
    }
  }
  for (let edge = 0; edge < feet.length; edge++) {
    const row = rims[edge]!, part = edge >= 3 && edge <= 6 ? 2 : 0;
    for (let j = 0; j < row.length - 1; j++) {
      const p = row[j]!, q = row[j + 1]!, av = alongShoulder(p.top), cv = alongShoulder(q.top);
      const cuts = part === 2 ? [0, ...bands.map(v => (v - av) / (cv - av)).filter(t => t > 0 && t < 1), 1].sort((a, c) => a - c) : [0, 1];
      for (let k = 0; k < cuts.length - 1; k++) {
        const lerp = (a: UV, c: UV, t: number): UV => [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t];
        const a = lerp(p.top, q.top, cuts[k]!), c = lerp(p.top, q.top, cuts[k + 1]!);
        const af: Point = [...lerp(p.foot, q.foot, cuts[k]!), 0], cf: Point = [...lerp(p.foot, q.foot, cuts[k + 1]!), 0];
        const at: Point = [...a, height(a, part)], ct: Point = [...c, height(c, part)];
        // Intact outer skin turns down on the back and tapering ends. Only the
        // broken shoulder and its short inner return expose the pale section.
        const material = edge === 4 || edge === 5 || edge === 8 || edge === 7 && j === 0 ? 1 : 0;
        b.quad(af, cf, ct, at, material, [uv(af), uv(cf), uv(ct), uv(at)], [0, 0, 1], material === 1 ? 3 : 0);
      }
    }
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
  const s = b.spec, rows: Point[][] = [], textureRows: UV[][] = [];
  const along = [-.50, -.36, -.13, .12, .34, .49];
  const breadths = [.62, 1, 1.14, .91, .72, .35];
  // The two original ground feet remain exact. More samples describe the
  // shell's continuous bend inside them; they do not add collision teeth.
  const stations = along.map((t, i) => ({ x: t * s.length,
    bend: s.width * (.10 * Math.sin(i * .65) - .03), width: s.width * breadths[i]!,
    peak: s.height * (.70 + .30 * Math.sin((i + .6) / (along.length + .2) * Math.PI)) }));
  const across = [-.50, -.46, -.34, -.13 - s.fold * .045, .05, .20 + s.opening * .035, .40, .47, .50];
  const samples = across.flatMap((a, i) => i === across.length - 1 ? [a]
    : [a, a + (across[i + 1]! - a) / 3, a + (across[i + 1]! - a) * 2 / 3]);
  const smoothHeight = (v: number, values: readonly number[]): number => {
    const slopes = across.slice(0, -1).map((a, i) => (values[i + 1]! - values[i]!) / (across[i + 1]! - a));
    const tangents = values.map((_value, i) => i === 0 ? slopes[0]! : i === values.length - 1 ? slopes[i - 1]!
      : slopes[i - 1]! * slopes[i]! <= 0 ? 0 : 2 / (1 / slopes[i - 1]! + 1 / slopes[i]!));
    const index = Math.min(across.length - 2, Math.max(0, across.findIndex(a => a > v) - 1));
    const span = across[index + 1]! - across[index]!, t = (v - across[index]!) / span;
    return (2 * t ** 3 - 3 * t * t + 1) * values[index]!
      + (t ** 3 - 2 * t * t + t) * span * tangents[index]!
      + (-2 * t ** 3 + 3 * t * t) * values[index + 1]!
      + (t ** 3 - t * t) * span * tangents[index + 1]!;
  };
  const subdivisions = 2;
  for (let at = 0; at <= (stations.length - 1) * subdivisions; at++) {
    const segment = Math.min(stations.length - 2, Math.floor(at / subdivisions)), t = at / subdivisions - segment;
    const a = stations[segment]!, c = stations[segment + 1]!, u = at / ((stations.length - 1) * subdivisions);
    const lerp = (p: number, q: number): number => p + (q - p) * t;
    const x = lerp(a.x, c.x), width = lerp(a.width, c.width), bend = lerp(a.bend, c.bend);
    const peak = lerp(a.peak, c.peak), foot = s.blocking === 1 ? Math.min(8, peak * .32) : 0;
    // The inner lip turns from broad glazed skin to a pressed, hollowed face.
    // Its loading changes along the bank, rather than forming parallel ramps.
    const pressure = Math.sin(Math.PI * u) ** 2, shoulder = .5 + .5 * Math.cos(u * Math.PI * 1.7 + .4);
    const profile = [0, foot / peak, .54 + shoulder * .08, 1, .84 + pressure * .09,
      .31 + shoulder * .16, .13 + pressure * .09, foot / peak, 0];
    const row = samples.map((v, j): Point => {
      const isFoot = j === 0 || j === samples.length - 1;
      // Unequal short torn ends expose an actual section. The skin retreats
      // into its existing base, so the mouth and outer route stay unchanged.
      const end = Math.min(9, s.length * .038) * ((1 - u) ** 12 - u ** 12);
      const tear = .42 + .58 * Math.max(0, 1 - Math.abs((v - .10) / .35));
      return [x + s.length * .028 * v + (isFoot ? 0 : end * tear), bend + width * v,
        isFoot ? 0 : Math.max(foot * .6, peak * smoothHeight(v, profile))];
    });
    let arc = 0;
    const texels = row.map((point, j): UV => {
      if (j) { const previous = row[j - 1]!; arc += Math.hypot(point[1] - previous[1], point[2] - previous[2]); }
      return [x, arc];
    });
    rows.push(row); textureRows.push(texels);
  }
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < samples.length - 1; j++) {
    const a = rows[i]![j]!, c = rows[i + 1]![j]!, d = rows[i + 1]![j + 1]!, e = rows[i]![j + 1]!;
    const edge = j === 0 || j === samples.length - 2, inner = samples[j]! >= .05;
    const slot = edge ? 1 : inner ? 2 : 0;
    b.quad(a, c, d, e, slot, [textureRows[i]![j]!, textureRows[i + 1]![j]!,
      textureRows[i + 1]![j + 1]!, textureRows[i]![j + 1]!], [0, 0, 1], edge ? 3 : inner ? 1 : 0);
    if (i === Math.floor((rows.length - 1) * .34) && j === 10) fracturedFace(b, a, c, d);
  }
  for (const index of [0, rows.length - 1]) {
    const row = rows[index]!, station = stations[index === 0 ? 0 : stations.length - 1]!;
    for (let j = 0; j < row.length - 1; j++) {
      const a = row[j]!, c = row[j + 1]!, af: Point = [station.x + s.length * .028 * samples[j]!, a[1], 0],
        cf: Point = [station.x + s.length * .028 * samples[j + 1]!, c[1], 0];
      b.quad(af, cf, c, a, 1, [[0, a[1]], [0, c[1]], [c[2], c[1]], [a[2], a[1]]], [0, 0, 1], 3);
    }
  }
}

function tornSheet(b: Builder): void {
  const s = b.spec;
  // The three convex domains triangulate one torn sheet. Their shared edges
  // belong to the same curved skin; they are never separate closed blocks.
  const outline: readonly UV[] = [[-.50, -.23], [-.29, -.48], [.13, -.37], [.40, -.26], [.51, -.03],
    [.34, .29], [.23, .13], [.04, -.02], [.13, .23], [-.10, .49], [-.37, .34], [-.28, .13], [-.46, .02]];
  const feet = outline.map(([x, y]): UV => [x * s.length, y * s.width]);
  const depths = [.18, .10, .16, .30, .52, .94, .62, .28, .72, 1, .47, .23, .14];
  const breadth = Math.min(s.blocking === 1 ? 4 : 1.2, Math.min(s.length, s.width) * .035);
  const inward = (a: UV, c: UV): UV => {
    const dx = c[0] - a[0], dy = c[1] - a[1], size = Math.hypot(dx, dy);
    return [-dy / size, dx / size];
  };
  const crown = feet.map((p, i): UV => {
    const a = inward(feet[(i + feet.length - 1) % feet.length]!, p), c = inward(p, feet[(i + 1) % feet.length]!);
    const dx = a[0] + c[0], dy = a[1] + c[1], size = Math.hypot(dx, dy);
    return [p[0] + dx / size * breadth * depths[i]!, p[1] + dy / size * breadth * depths[i]!];
  });
  const parts = [[0, 1, 2, 7, 11, 12], [11, 7, 8, 9, 10], [2, 3, 4, 5, 6, 7]];
  // A broad rear stays low; the front rolls up continuously and returns into
  // an exposed inner lip. Its left corner is taller than the torn right one.
  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  const smooth = (value: number): number => { const t = clamp(value); return t * t * (3 - 2 * t); };
  const phase = ([x, y]: UV): number => y / s.width + (.18 + s.fold * .10) * x / s.length;
  const height = (point: UV): number => {
    const v = phase(point), x = point[0] / s.length;
    const lift = v < -.25 ? .035 : v < .17 ? .035 + .965 * smooth((v + .25) / .42)
      : 1 - .71 * smooth((v - .17) / .25);
    const amplitude = .56 + .44 * smooth((.38 - x) / .86);
    const foot = s.blocking === 1 ? Math.min(3.5, s.height * .16) : 0;
    return foot + (s.height - foot) * (.025 + amplitude * lift);
  };
  const clip = (polygon: readonly UV[], axis: 0 | 1, boundary: number, greater: boolean): UV[] => {
    const result: UV[] = [];
    for (let j = 0; j < polygon.length; j++) {
      const a = polygon[j]!, c = polygon[(j + 1) % polygon.length]!, av = a[axis], cv = c[axis];
      const ai = greater ? av >= boundary : av <= boundary, ci = greater ? cv >= boundary : cv <= boundary;
      if (ai) result.push(a);
      if (ai !== ci) { const t = (boundary - av) / (cv - av); result.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); }
    }
    return result;
  };
  const xs = [-.52, -.36, -.18, .10, .27, .40, .53].map(x => x * s.length);
  const ys = [-.52, -.35, -.25, -.16, -.05, .035, .10, .16, .22, .28, .35, .43, .55].map(y => y * s.width);
  // Global grid lines split every shared edge at identical positions. Sampling
  // the actual curve gives broad changing normals, not a triangle-fan mound.
  for (const [part, indices] of parts.entries()) for (let x = 0; x < xs.length - 1; x++) for (let y = 0; y < ys.length - 1; y++) {
    const polygon = clip(clip(clip(clip(indices.map(i => crown[i]!), 0, xs[x]!, true), 0, xs[x + 1]!, false), 1, ys[y]!, true), 1, ys[y + 1]!, false);
    if (polygon.length < 3) continue;
    const points = polygon.map((p): Point => [...p, height(p)]);
    const centre: UV = [polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length, polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length];
    const material = phase(centre) > .17 ? 2 : 0;
    for (let i = 1; i < points.length - 1; i++) {
      const a = points[0]!, c = points[i]!, d = points[i + 1]!;
      b.quad(a, c, d, d, material, [uv(a), uv(c), uv(d), uv(d)], [0, 0, 1], 4);
      if (part === 0 && x === 2 && y === 3 && i === 1) fracturedFace(b, a, c, d);
    }
  }
  for (let edge = 0; edge < feet.length; edge++) {
    const next = (edge + 1) % feet.length, a = crown[edge]!, c = crown[next]!, af = feet[edge]!, cf = feet[next]!;
    const cuts = [0, ...xs.map(v => (v - a[0]) / (c[0] - a[0])), ...ys.map(v => (v - a[1]) / (c[1] - a[1])), 1]
      .filter(t => t >= 0 && t <= 1).sort((x, y) => x - y);
    const at = (u: UV, v: UV, t: number): UV => [u[0] + (v[0] - u[0]) * t, u[1] + (v[1] - u[1]) * t];
    for (let i = 0; i < cuts.length - 1; i++) {
      if (cuts[i + 1]! - cuts[i]! < 1e-9) continue;
      const p = at(a, c, cuts[i]!), q = at(a, c, cuts[i + 1]!);
      const pFoot: Point = [...at(af, cf, cuts[i]!), 0], qFoot: Point = [...at(af, cf, cuts[i + 1]!), 0];
      const pTop: Point = [...p, height(p)], qTop: Point = [...q, height(q)];
      // Short exposed ends distinguish the thin sheet from a full ring of
      // bright bevel. Intact skin wraps the back and the continuous curl root.
      const material = edge === 5 || edge === 6 || edge === 8 || edge === 9 ? 1 : 0;
      b.quad(pFoot, qFoot, qTop, pTop, material, [uv(pFoot), uv(qFoot), uv(qTop), uv(pTop)], [0, 0, 1], material === 1 ? 3 : 4);
    }
  }
}

export function buildGroundNativeVolume(builder: Builder): void {
  switch (builder.spec.shapeProfile) {
    case 'fracture-fan': fractureFan(builder); return;
    case 'fallen-bundle': fallenBundle(builder); return;
    case 'clamp-bank': clampBank(builder); return;
    case 'torn-sheet': tornSheet(builder); return;
    case 'compressed-wedge': buildCompressedWedge(builder); return;
    case 'porous-break': buildPorousBreak(builder); return;
    case 'settled-sheet': buildSettledSheet(builder); return;
    case 'settled-fan': buildSettledFan(builder); return;
    default: throw new Error('Unknown construction 4 native shape profile');
  }
}
