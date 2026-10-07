import type { NativeVolumeMesh } from '/Users/yilungao/coh/src/generation/world-study/native-volume-geometry';
/** Material-specific construction 4 forms. A compact fibre mass and a broken
 * porous core have different load-bearing bodies, not just different paint.
 * Small cavities have closed bottoms; neither form introduces a floor layer. */
import type { Builder, Point, UV } from '/Users/yilungao/coh/src/generation/world-study/native-volume-expansion';

const uv = (p: Point): UV => [p[0], p[1]];
const mix = (a: Point, c: Point, t: number): Point =>
  [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];

/** Monotone subdivision rounds a loaded shoulder without moving its authored
 * ends or overshooting into a gap. Shared boundary samples use this same rule. */
function curved(points: readonly Point[], at: number): Point {
  const i = Math.min(points.length - 2, Math.floor(at)), t = at - i;
  const a = points[i]!, c = points[i + 1]!, before = points[Math.max(0, i - 1)]!, after = points[Math.min(points.length - 1, i + 2)]!;
  const tangent = (u: number, v: number): number => u * v <= 0 ? 0 : 2 / (1 / u + 1 / v);
  return [0, 1, 2].map(axis => {
    const d = c[axis]! - a[axis]!, start = i === 0 ? d : tangent(a[axis]! - before[axis]!, d);
    const end = i === points.length - 2 ? d : tangent(d, after[axis]! - c[axis]!);
    return (2 * t ** 3 - 3 * t * t + 1) * a[axis]! + (t ** 3 - 2 * t * t + t) * start
      + (-2 * t ** 3 + 3 * t * t) * c[axis]! + (t ** 3 - t * t) * end;
  }) as unknown as Point;
}

function pressureFracture(b: Builder, a: Point, c: Point, d: Point): void {
  if (b.spec.blocking !== 1) return;
  const sample = (u: number, v: number): Point => [a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v, a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + .04];
  const p = sample(.16, .16), q = sample(.45, .16), r = sample(.39, .28), t = sample(.16, .28);
  b.quad(p, q, r, t, 3, [uv(p), uv(q), uv(r), uv(t)], [0, 0, 1], 3);
  b.joint(sample(.28, .21));
}

/** The intact compressed back turns down into thick shoulders. Only the torn
 * end exposes short, unequal layers. All layers remain attached to one body;
 * the lobed end is not a repeated row of free-standing comb teeth. */
export function buildCompressedWedge(b: Builder): void {
  const s = b.spec;
  const along = [-.50, -.34, -.03, .19, .32, .43];
  const breadth = [.57, .94, 1, .89, .75, .63];
  const rise = [.51, .90, 1, .77, .52, .30];
  const across = [-1, -.73, -.36, .02, .41, .76, 1];
  const crown = [.23, .68, .94, 1, .88, .62, .19];
  const tear = [-.04, .01, -.045, .075, -.005, -.075, -.11];
  const rows: Point[][] = [], feet: Point[][] = [];
  for (let i = 0; i < along.length; i++) {
    const u = i / (along.length - 1), centre = s.width * (-.06 + .08 * u + .025 * Math.sin(u * Math.PI));
    const radius = s.width * .48 * breadth[i]!;
    const top = s.height * rise[i]!, foot = s.blocking === 1 ? Math.min(4, s.height * .12) : 0;
    const row = across.map((v, j): Point => {
      const shift = s.length * (tear[j]! * u ** 5 + v * (.025 - u * .04));
      const z = foot + (top - foot) * crown[j]!;
      return [s.length * along[i]! + shift, centre + radius * v, z];
    });
    rows.push(row);
    // A sloping section has real top-down area, including the short end. It
    // keeps the 20px body silhouette legible from below as well as from above.
    const spread = Math.min(6, s.width * .04);
    feet.push(row.map((p, j): Point => [p[0] + (i === 0 ? -spread : i === along.length - 1 ? spread : 0),
      p[1] + (j === 0 ? -spread : j === across.length - 1 ? spread : 0), 0]));
  }
  const sample = (u: number, v: number): Point => curved(rows.map(row => curved(row, v)), u);
  for (let i = 0; i < (rows.length - 1) * 2; i++) for (let j = 0; j < (across.length - 1) * 2; j++) {
    const a = sample(i / 2, j / 2), c = sample((i + 1) / 2, j / 2), d = sample((i + 1) / 2, (j + 1) / 2), e = sample(i / 2, (j + 1) / 2);
    // Two short stretched scraps are continuous with the end, not bright
    // bands running across every intact surface of the compressed mass.
    const cut = i >= (rows.length - 2) * 2 && (j === 2 || j === 3 || j === 8 || j === 9);
    b.quad(a, c, d, e, cut ? 1 : 0, [uv(a), uv(c), uv(d), uv(e)], [0, 0, 1], cut ? 3 : 1);
    if (i === 3 && j === 4) pressureFracture(b, a, c, d);
  }
  for (const side of [0, across.length - 1]) for (let i = 0; i < (rows.length - 1) * 2; i++) {
    const a = sample(i / 2, side), c = sample((i + 1) / 2, side),
      af = curved(feet.map(row => row[side]!), i / 2), cf = curved(feet.map(row => row[side]!), (i + 1) / 2);
    b.quad(af, cf, c, a, 0, [uv(af), uv(cf), uv(c), uv(a)], [0, side ? 1 : -1, 0], 1);
  }
  for (const i of [0, rows.length - 1]) for (let j = 0; j < (across.length - 1) * 2; j++) {
    const a = sample(i, j / 2), c = sample(i, (j + 1) / 2), af = curved(feet[i]!, j / 2), cf = curved(feet[i]!, (j + 1) / 2);
    // The fracture wall itself changes direction and depth, while its source
    // coordinates follow the section rather than collapsing a vertical face.
    const cut = i !== 0, sectionUV = (p: Point): UV => [p[1], p[2]];
    b.quad(af, cf, c, a, cut ? 1 : 0,
      [sectionUV(af), sectionUV(cf), sectionUV(c), sectionUV(a)], [cut ? 1 : -1, 0, 0], cut ? 3 : 1);
  }
}

/** Irregular connected core under a wrapping skin. The broken face broadens
 * at its centre and dies into the intact ends. Its six small cavities have
 * sloping walls and opaque bottoms, so they cannot read as body-sized doors. */
export function buildPorousBreak(b: Builder): void {
  const s = b.spec;
  const along = [-.49, -.34, -.19, -.025, .19, .35, .48];
  const widths = [.43, .82, 1, .91, .94, .66, .29];
  const heights = [.43, .76, 1, .93, .74, .62, .27];
  const split = [.77, .55, .19, .13, .28, .52, .81];
  const rows = along.map((x, i) => {
    const radius = s.width * .48 * widths[i]!, centre = s.width * (.045 * Math.sin(i * .7) - .035);
    const z = s.height * heights[i]!, t = split[i]!;
    const foot: Point = [x * s.length, centre - radius, 0];
    const shoulder: Point = [x * s.length + s.length * .012, centre - radius * .77, z * .59];
    const crown: Point = [x * s.length, centre - radius * .17, z];
    const lip: Point = [x * s.length + s.length * .022 * Math.sin(i * 1.3), centre + radius * t, z * (1 - .25 * t - .65 * t * t)];
    const toe: Point = [x * s.length + Math.min(5, s.length * .02), centre + radius, 0];
    return { foot, shoulder, crown, lip, toe };
  });
  const sizes = [5, 12, 7, 14, 6, 4], offsets = [.56, .35, .65, .47, .37, .48], depths = [.44, .61, .38, .50, .63, .43];
  const rowAt = (u: number): readonly Point[] => (['foot', 'shoulder', 'crown', 'lip', 'toe'] as const)
    .map(key => curved(rows.map(row => row[key]), u));
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!, c = rows[i + 1]!;
    for (let along = 0; along < 2; along++) for (let across = 0; across < 6; across++) {
      const start = rowAt(i + along / 2), end = rowAt(i + (along + 1) / 2);
      const p = curved(start, across / 2), q = curved(end, across / 2), r = curved(end, (across + 1) / 2), t = curved(start, (across + 1) / 2);
      b.quad(p, q, r, t, 0, [uv(p), uv(q), uv(r), uv(t)], [0, 0, 1], 0);
      if (i === 2 && along === 1 && across === 4) pressureFracture(b, p, q, r);
    }
    const sample = (u: number, v: number): Point => { const row = rowAt(i + u); return mix(row[3]!, row[4]!, v); };
    const centreU = offsets[i]!, centreV = depths[i]!, centre = sample(centreU, centreV);
    const width = c.lip[0] - a.lip[0], depth = ((a.toe[1] - a.lip[1]) + (c.toe[1] - c.lip[1])) / 2;
    const radius = Math.min(sizes[i]! / 2, width * .23, depth * .23);
    const outer: readonly UV[] = [[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5]];
    const ring = outer.map(([u, v]) => sample(u, v)), mouth: Point[] = [], bottom: Point[] = [];
    const recess = Math.min(5, centre[2] * .32, radius * .74);
    for (let j = 0; j < 8; j++) {
      const angle = -Math.PI * .75 + j * Math.PI / 4;
      const dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius * (.68 + i % 2 * .12);
      mouth.push(sample(centreU + dx / width, centreV + dy / depth));
      const p = sample(centreU + dx * .63 / width, centreV + dy * .63 / depth);
      bottom.push([p[0], p[1], p[2] - recess]);
    }
    const centreBottom: Point = [centre[0], centre[1], centre[2] - recess];
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8, p = mouth[j]!, q = mouth[k]!, af = bottom[j]!, cf = bottom[k]!;
      b.quad(ring[j]!, ring[k]!, q, p, 1, [uv(ring[j]!), uv(ring[k]!), uv(q), uv(p)], [0, 0, 1], 3);
      b.quad(p, q, cf, af, 2, [uv(p), uv(q), uv(cf), uv(af)], [0, 0, 1], 2);
      b.quad(af, cf, centreBottom, centreBottom, 2,
        [uv(af), uv(cf), uv(centreBottom), uv(centreBottom)], [0, 0, 1], 0);
    }
  }
  for (const i of [0, rows.length - 1]) {
    const row = rowAt(i), face = [0, .5, 1, 1.5, 2, 2.5, 3, 4].map(at => curved(row, at));
    for (let j = 1; j < face.length - 1; j++) {
      const a = face[0]!, c = face[j]!, d = face[j + 1]!;
      b.quad(a, c, d, d, 0, [uv(a), uv(c), uv(d), uv(d)], [i ? 1 : -1, 0, 0], 0);
    }
  }
}

/** Smooth only intact skin within an organization-specific body. Actual torn
 * walls, pore walls, bottoms and sharp creases retain geometric face normals.
 * Angle weighting avoids the diagonal of a quad becoming a lighting stripe.
 * No positions, collision, material IDs, light joints or UVs change. */
export function smoothOrganizedSurface(mesh: NativeVolumeMesh): NativeVolumeMesh {
  const groups = new Map<string, { vertex: number; weight: number }[]>();
  for (let face = 0; face < mesh.triangleCount; face++) {
    if (mesh.materials[face] !== 0) continue;
    for (let corner = 0; corner < 3; corner++) {
      const vertex = mesh.indices[face * 3 + corner]!, at = vertex * 3;
      const previous = mesh.indices[face * 3 + (corner + 1) % 3]! * 3;
      const next = mesh.indices[face * 3 + (corner + 2) % 3]! * 3;
      const ax = mesh.positions[previous]! - mesh.positions[at]!, ay = mesh.positions[previous + 1]! - mesh.positions[at + 1]!, az = mesh.positions[previous + 2]! - mesh.positions[at + 2]!;
      const bx = mesh.positions[next]! - mesh.positions[at]!, by = mesh.positions[next + 1]! - mesh.positions[at + 1]!, bz = mesh.positions[next + 2]! - mesh.positions[at + 2]!;
      const dot = (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz));
      const weight = Math.acos(Math.max(-1, Math.min(1, dot)));
      const key = `${mesh.positions[at]},${mesh.positions[at + 1]},${mesh.positions[at + 2]}:${mesh.regions[face]}`;
      const entries = groups.get(key) ?? []; entries.push({ vertex, weight }); groups.set(key, entries);
    }
  }
  const normals = new Float32Array(mesh.normals), creaseCosine = Math.cos(55 * Math.PI / 180);
  for (const entries of groups.values()) for (const { vertex } of entries) {
    const at = vertex * 3, nx = mesh.normals[at]!, ny = mesh.normals[at + 1]!, nz = mesh.normals[at + 2]!;
    let x = 0, y = 0, z = 0;
    for (const { vertex: other, weight } of entries) {
      const q = other * 3, ox = mesh.normals[q]!, oy = mesh.normals[q + 1]!, oz = mesh.normals[q + 2]!;
      if (nx * ox + ny * oy + nz * oz < creaseCosine) continue;
      x += ox * weight; y += oy * weight; z += oz * weight;
    }
    const length = Math.hypot(x, y, z);
    if (length > 0) { normals[at] = x / length; normals[at + 1] = y / length; normals[at + 2] = z / length; }
  }
  return { ...mesh, normals };
}
