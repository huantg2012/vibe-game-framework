/** Prepared I11 geometry, not registered in a construction or author world.
 * Pores are sealed depressions in material. They never create floor/VOID paths. */
import type { Builder, Point, UV } from './native-volume-expansion';
const uv = (p: Point): UV => [p[0], p[1]];
const triangle = (b: Builder, a: Point, c: Point, d: Point, slot: number): void =>
  b.quad(a, c, d, d, slot, [uv(a), uv(c), uv(d), uv(d)], [0, 0, 1], slot === 1 ? 3 : 0);
function pressureFracture(b: Builder, a: Point, c: Point, d: Point): void {
  if (b.spec.blocking !== 1) return;
  const sample = (u: number, v: number): Point => [a[0] + (c[0] - a[0]) * u + (d[0] - a[0]) * v,
    a[1] + (c[1] - a[1]) * u + (d[1] - a[1]) * v, a[2] + (c[2] - a[2]) * u + (d[2] - a[2]) * v + .04];
  const p = sample(.18, .20), q = sample(.48, .20), r = sample(.42, .31), t = sample(.18, .31);
  b.quad(p, q, r, t, 3, [uv(p), uv(q), uv(r), uv(t)], [0, 0, 1], 3);
  b.joint(sample(.29, .25));
}

/** Broad compressed head gives way to two short, unequal shear mouths.
 * Adjacent layers share edges; only the actual steep breaks expose the cut. */
export function buildCompressedWedge(b: Builder): void {
  const s = b.spec;
  const stations = [-.50, -.29, .11, .19, .235, .37, .415, .50];
  const rises = [.53, 1, .81, .77, .44, .40, .21, .14];
  const widths = [.54, 1, .90, .78, .81, .63, .57, .36];
  const rows: Point[][] = [], feet: Point[][] = [];
  for (let i = 0; i < stations.length; i++) {
    const radius = s.width * .47 * widths[i]!, shear = i < 3 ? -.035 : i < 5 ? .075 : -.045;
    const x = stations[i]! * s.length, centre = s.width * (i < 3 ? -.045 : .012 * (i - 2));
    const foot = s.blocking === 1 ? Math.min(5, s.height * .2) : 0;
    const top = Math.max(foot, s.height * rises[i]!);
    rows.push([-1, -.68, .48, 1].map((u): Point => [x + s.length * shear * u, centre + radius * u, top * (1 - .04 * u)]));
    const spread = Math.min(4, s.width * .025);
    feet.push([[-1, -spread], [1, spread]].map(([u, edge]): Point => [x + s.length * shear * u!, centre + radius * u! + edge!, 0]));
  }
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < 3; j++) {
    const a = rows[i]![j]!, c = rows[i + 1]![j]!, d = rows[i + 1]![j + 1]!, e = rows[i]![j + 1]!;
    const cut = i === 3 || i === 5;
    b.quad(a, c, d, e, cut ? 1 : 0, [uv(a), uv(c), uv(d), uv(e)], [0, 0, 1], cut ? 3 : 4);
    if (i === 1 && j === 1) pressureFracture(b, a, c, d);
  }
  for (let side = 0; side < 2; side++) for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i]![side ? 3 : 0]!, c = rows[i + 1]![side ? 3 : 0]!, af = feet[i]![side]!, cf = feet[i + 1]![side]!;
    b.quad(af, cf, c, a, i > 3 && side === 1 ? 1 : 0, [uv(af), uv(cf), uv(c), uv(a)], [0, 0, 1]);
  }
  for (const i of [0, rows.length - 1]) {
    const row = rows[i]!, a = feet[i]![0]!, c = feet[i]![1]!;
    for (let j = 0; j < row.length - 1; j++) {
      const p = row[j]!, q = row[j + 1]!, u = j / 3, v = (j + 1) / 3;
      const af: Point = [a[0] + (c[0] - a[0]) * u, a[1] + (c[1] - a[1]) * u, 0], cf: Point = [a[0] + (c[0] - a[0]) * v, a[1] + (c[1] - a[1]) * v, 0];
      b.quad(af, cf, q, p, i === 0 ? 0 : 1, [uv(af), uv(cf), uv(q), uv(p)], [0, 0, 1]);
    }
  }
}

/** Most of the bank remains intact skin. Only its forward cut contains an
 * uneven cluster of cavities, with real inclined walls and opaque bottoms. */
export function buildPorousBreak(b: Builder): void {
  const s = b.spec, xs = [-.50, -.33, -.20, -.045, .22, .34, .50];
  const sizes = [14, 5, 8, 12, 4, 6], offsets = [.39, .64, .43, .57, .36, .58];
  const yOffset = [.42, .64, .37, .46, .65, .38];
  const rows = xs.map((x): { back: Point; crown: Point; front: Point } => {
    const width = s.width * (.40 + .08 * Math.cos((x + .12) * 4));
    const height = s.height * (.77 + .21 * Math.cos((x + .14) * 3));
    return { back: [x * s.length, -width, height * .91], crown: [x * s.length, width * .18, height], front: [x * s.length, width, 0] };
  });
  for (let i = 0; i < rows.length - 1; i++) {
    const left = rows[i]!, right = rows[i + 1]!;
    b.quad(left.back, right.back, right.crown, left.crown, 0,
      [uv(left.back), uv(right.back), uv(right.crown), uv(left.crown)], [0, 0, 1], 4);
    if (i === 2) pressureFracture(b, left.back, right.back, right.crown);
    const sample = (u: number, v: number): Point => {
      const a: Point = [left.crown[0] + (right.crown[0] - left.crown[0]) * u,
        left.crown[1] + (right.crown[1] - left.crown[1]) * u, left.crown[2] + (right.crown[2] - left.crown[2]) * u];
      const c: Point = [left.front[0] + (right.front[0] - left.front[0]) * u,
        left.front[1] + (right.front[1] - left.front[1]) * u, 0];
      return [a[0] + (c[0] - a[0]) * v, a[1] + (c[1] - a[1]) * v, a[2] * (1 - v)];
    };
    // The exterior ring stays on the same real cut. Unequal pore radii and
    // off-centre placement leave broad dense walls rather than a honeycomb.
    const centreU = offsets[i]!, centreV = yOffset[i]!, centre = sample(centreU, centreV);
    const cellWidth = right.crown[0] - left.crown[0], cellDepth = (left.front[1] - left.crown[1] + right.front[1] - right.crown[1]) / 2;
    const radius = Math.min(sizes[i]! / 2, cellWidth * .26, cellDepth * .24);
    const outerUV: readonly UV[] = [[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5]];
    const ring = outerUV.map(([u, v]) => sample(u, v));
    const mouth: Point[] = [], bottom: Point[] = [];
    const depth = Math.min(5, centre[2] * .35, radius * .70);
    for (let j = 0; j < 8; j++) {
      const angle = -Math.PI * .75 + j * Math.PI / 4, dx = Math.cos(angle) * radius, dy = Math.sin(angle) * radius * (.66 + i % 2 * .10);
      const p = sample(centreU + dx / cellWidth, centreV + dy / cellDepth); mouth.push(p);
      const q = sample(centreU + dx * .64 / cellWidth, centreV + dy * .64 / cellDepth); bottom.push([q[0], q[1], q[2] - depth]);
    }
    for (let j = 0; j < 8; j++) {
      const k = (j + 1) % 8, a = ring[j]!, c = ring[k]!, p = mouth[j]!, q = mouth[k]!, af = bottom[j]!, cf = bottom[k]!;
      b.quad(a, c, q, p, 1, [uv(a), uv(c), uv(q), uv(p)], [0, 0, 1], 3);
      b.quad(p, q, cf, af, 2, [uv(p), uv(q), uv(cf), uv(af)], [0, 0, 1], 2);
      triangle(b, af, cf, [centre[0], centre[1], centre[2] - depth], 2);
    }
    const backA: Point = [left.back[0], left.back[1] - Math.min(4, s.width * .025), 0];
    const backC: Point = [right.back[0], right.back[1] - Math.min(4, s.width * .025), 0];
    b.quad(backA, backC, right.back, left.back, 0, [uv(backA), uv(backC), uv(right.back), uv(left.back)], [0, 0, 1]);
  }
  for (const i of [0, rows.length - 1]) {
    const row = rows[i]!, foot: Point = [row.back[0], row.back[1] - Math.min(4, s.width * .025), 0];
    b.quad(foot, row.back, row.crown, row.front, 1, [uv(foot), uv(row.back), uv(row.crown), uv(row.front)], [i ? 1 : -1, 0, 0], 3);
  }
}
