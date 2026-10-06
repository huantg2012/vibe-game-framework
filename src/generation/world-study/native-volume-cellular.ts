/** Unequal burst cavities: the hollow and outer wall have separate contours.
 * Surface strips join those contours; no triangle spans a hollow or its mouth. */
import type { Builder, Point, UV } from './native-volume-expansion';

const TAU = Math.PI * 2;
const uv = (point: Point): UV => [point[0], point[1]];
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
function variation(seed: number, salt: number): number {
  let value = Math.imul(seed ^ salt, 0x45d9f3b);
  value = Math.imul(value ^ value >>> 16, 0x45d9f3b);
  return ((value ^ value >>> 16) >>> 0) / 0x100000000;
}

export function buildCellularShell(builder: Builder): void {
  const spec = builder.spec, count = Math.min(4, Math.max(2, spec.branches));
  for (let cell = 0; cell < count; cell++) {
    const scale = cell % 3 === 0 ? 1.25 : cell % 3 === 1 ? .91 : .90;
    const rx = spec.length / count * .45 * scale;
    const ry = spec.width * (cell % 3 === 0 ? .38 : cell % 3 === 1 ? .23 : .29);
    const ox = ((cell + .5) / count - .5) * spec.length;
    const oy = (cell % 2 ? -.15 : .10) * spec.width;
    const opening = (cell % 2 ? -.50 : .50) * Math.PI + (variation(spec.seed, 2700 + cell) - .5) * .27;
    // One inflated cavity, one largely collapsed crescent and a smaller split
    // shell. Their breaks are not three copies of the same horseshoe mouth.
    const gap = 1.20 + spec.opening * 1.38 + (cell % 3 === 1 ? .90 : cell % 3 === 0 ? -.26 : -.43);
    const mouthBias = cell % 3 === 0 ? .32 : cell % 3 === 1 ? .62 : .38;
    const start = opening + gap * mouthBias, end = opening + TAU - gap * (1 - mouthBias);
    const steps = 48, rows: Point[][] = [];
    const phase = variation(spec.seed, 2730 + cell) * .6 + cell * 1.9;
    for (let index = 0; index <= steps; index++) {
      const t = index / steps, angle = lerp(start, end, t);
      const ca = Math.cos(angle), sa = Math.sin(angle);
      // A broad shoulder is on one side of the cavity, not a uniform pipe.
      const shoulder = Math.pow(.5 + .5 * Math.cos(angle - phase), 3);
      const outerRadius = .94 + shoulder * (.31 + spec.distortion * .13)
        + Math.sin(angle * 2 + phase) * .085 + Math.sin(angle * 3 - phase) * .045;
      const outerX = ox + rx * ca * outerRadius;
      const outerY = oy + ry * sa * outerRadius;
      // The inner contour is offset and elongated independently. The cavity
      // remains wider than a body at canonical dimensions; walls vary in width.
      const hollowRadius = .62 + .08 * Math.sin(angle + phase + .65)
        + .06 * Math.sin(angle * 2 - phase) + .025 * Math.sin(angle * 3 - phase);
      const innerX = ox + rx * .045 * Math.cos(phase) + rx * ca * hollowRadius;
      const innerY = oy - ry * .055 * Math.sin(phase) + ry * sa * (hollowRadius + .08);
      const seam = Math.pow(Math.abs(Math.sin(t * Math.PI)), .48);
      // A long broken lip rises into the intact shoulder; the opposite end is
      // still thick. This changes the real silhouette instead of adding chips.
      const tornLip = .29 + .71 * Math.min(1, t / (cell % 3 === 1 ? .43 : .29));
      const height = spec.height * (cell % 3 === 1 ? .48 : cell % 3 === 2 ? .79 : 1)
        * (.39 + shoulder * .36 + seam * .22 + .10 * Math.sin(angle + phase)) * tornLip;
      const foot = spec.blocking === 1 ? Math.min(8, height * .35) : 0;
      const point = (across: number, z: number): Point => [lerp(outerX, innerX, across), lerp(outerY, innerY, across), z];
      // The large shoulder retains skin. Only the exposed end caps use cut
      // material; an all-around coloured cut ring would read as a striped tube.
      rows.push([point(0, 0), point(.035, foot), point(.16, height * .63),
        point(.42 + shoulder * .08, height), point(.79, height * (.81 + shoulder * .08)),
        point(.96, Math.max(foot, height * .22)), point(1, 0)]);
    }
    for (let index = 0; index < steps; index++) {
      for (let across = 0; across < rows[index]!.length - 1; across++) {
        const a = rows[index]![across]!, b = rows[index + 1]![across]!;
        const c = rows[index + 1]![across + 1]!, d = rows[index]![across + 1]!;
        builder.quad(a, b, c, d, across < 4 ? 0 : 2, [uv(a), uv(b), uv(c), uv(d)], [0, 0, 1], across < 2 ? 1 : across < 4 ? 0 : 5);
        if (cell === 0 && index === Math.floor(steps * .47) && across === 3) {
          const onFace = (u: number, v: number): Point => [a[0] + (b[0] - a[0]) * u + (c[0] - a[0]) * v,
            a[1] + (b[1] - a[1]) * u + (c[1] - a[1]) * v,
            a[2] + (b[2] - a[2]) * u + (c[2] - a[2]) * v + .08];
          const p = onFace(.08, .12), q = onFace(.57, .12), r = onFace(.40, .40), s = onFace(.08, .40);
          builder.quad(p, q, r, s, 3, [uv(p), uv(q), uv(r), uv(s)], [0, 0, 1], 3);
          builder.joint(onFace(.28, .27));
        }
      }
    }
    // Each torn mouth exposes its own cross section. Unequal short facets at
    // the two ends avoid matching sawn ends without painting fake chips.
    for (const at of [0, steps]) {
      const row = rows[at]!, angle = at === 0 ? start : end, sign = at === 0 ? -1 : 1;
      for (let across = 0; across < row.length - 1; across++) {
        const a = row[across]!, b = row[across + 1]!;
        const run = Math.min(6, spec.thickness * .42) * (at === 0 ? .72 : 1.12);
        const dx = -Math.sin(angle) * run * sign, dy = Math.cos(angle) * run * sign;
        const c: Point = [b[0] + dx, b[1] + dy, 0], d: Point = [a[0] + dx, a[1] + dy, 0];
        builder.quad(a, b, c, d, 1, [uv(a), uv(b), uv(c), uv(d)], [0, 0, 1], 3);
      }
    }
  }
}
