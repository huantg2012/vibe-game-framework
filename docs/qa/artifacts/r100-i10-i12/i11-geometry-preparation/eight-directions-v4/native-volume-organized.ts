/** Material-specific construction 4 forms. A compact fibre mass and a broken
 * porous core have different load-bearing bodies, not just different paint.
 * Small cavities have closed bottoms; neither form introduces a floor layer. */
import type { Builder, Point, UV } from './native-volume-expansion';

const uv = (p: Point): UV => [p[0], p[1]];
const mix = (a: Point, c: Point, t: number): Point =>
  [a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t, a[2] + (c[2] - a[2]) * t];

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
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < across.length - 1; j++) {
    const a = rows[i]![j]!, c = rows[i + 1]![j]!, d = rows[i + 1]![j + 1]!, e = rows[i]![j + 1]!;
    // Two short stretched scraps are continuous with the end, not bright
    // bands running across every intact surface of the compressed mass.
    const cut = i === rows.length - 2 && (j === 1 || j === 4);
    b.quad(a, c, d, e, cut ? 1 : 0, [uv(a), uv(c), uv(d), uv(e)], [0, 0, 1], cut ? 3 : 1);
    if (i === 1 && j === 2) pressureFracture(b, a, c, d);
  }
  for (const side of [0, across.length - 1]) for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]![side]!, c = rows[i + 1]![side]!, af = feet[i]![side]!, cf = feet[i + 1]![side]!;
    b.quad(af, cf, c, a, 0, [uv(af), uv(cf), uv(c), uv(a)], [0, side ? 1 : -1, 0], 1);
  }
  for (const i of [0, rows.length - 1]) for (let j = 0; j < across.length - 1; j++) {
    const a = rows[i]![j]!, c = rows[i]![j + 1]!, af = feet[i]![j]!, cf = feet[i]![j + 1]!;
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
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]!, c = rows[i + 1]!;
    for (const [from, to] of [['foot', 'shoulder'], ['shoulder', 'crown'], ['crown', 'lip']] as const) {
      b.quad(a[from], c[from], c[to], a[to], 0,
        [uv(a[from]), uv(c[from]), uv(c[to]), uv(a[to])], [0, 0, 1], 0);
      if (i === 2 && from === 'crown') pressureFracture(b, a[from], c[from], c[to]);
    }
    const sample = (u: number, v: number): Point => mix(mix(a.lip, c.lip, u), mix(a.toe, c.toe, u), v);
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
    const row = rows[i]!, face = [row.foot, row.shoulder, row.crown, row.lip, row.toe];
    for (let j = 1; j < face.length - 1; j++) {
      const a = face[0]!, c = face[j]!, d = face[j + 1]!;
      b.quad(a, c, d, d, 0, [uv(a), uv(c), uv(d), uv(d)], [i ? 1 : -1, 0, 0], 0);
    }
  }
}
