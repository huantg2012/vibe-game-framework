import { Model, add, cross, mul, sub, unit, type Material, type Station, type V3 } from './model';

/** Six independent, full-depth study models. Nothing here samples a reference
 * bitmap: seams, lips, braces, bores and pipe connections are physical meshes. */
function rod(m: Model, a: V3, b: V3, radius: number, material: Material,
  segments = 12, endRadius = radius, tint = 1, cap = true): void {
  const axis = unit(sub(b, a));
  const u = unit(cross(axis, Math.abs(axis[1]) > .95 ? [1, 0, 0] : [0, 1, 0]));
  const v = unit(cross(axis, u));
  const point = (p: V3, radiusAt: number, i: number): V3 => {
    const angle = i / segments * Math.PI * 2;
    return add(p, add(mul(u, Math.cos(angle) * radiusAt), mul(v, Math.sin(angle) * radiusAt)));
  };
  for (let i = 0; i < segments; i++) {
    const p = point(a, radius, i), q = point(a, radius, i + 1);
    const r = point(b, endRadius, i + 1), s = point(b, endRadius, i);
    m.quad(p, q, r, s, material, tint);
    if (cap) { m.triangle(a, q, p, material, tint * .85); m.triangle(b, s, r, material, tint); }
  }
}

function pipe(m: Model, points: readonly V3[], radius: number, tint = .9): void {
  for (let i = 1; i < points.length; i++) rod(m, points[i - 1]!, points[i]!, radius, 'iron', 10, radius, tint);
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]!, b = points[i]!, c = points[i + 1]!;
    const before = add(b, mul(unit(sub(a, b)), radius * 1.7));
    const after = add(b, mul(unit(sub(c, b)), radius * 1.7));
    rod(m, before, after, radius * 1.27, 'iron', 10, radius * 1.27, tint * .8);
  }
}

/** Bolt head lives inside an annular countersink, never on a floating sticker. */
function frontBolt(m: Model, x: number, y: number, z: number, size = .052): void {
  m.ring([x, y, z], size * 1.8, size * .38, size * .25, 'iron', 10, .63);
  rod(m, [x, y, z - .022], [x, y, z + .017], size, 'steel', 6, size, .88);
  m.box([x, y, z + .02], [size * 1.25, .012, .01], 'black');
}

function topBolt(m: Model, x: number, y: number, z: number, size = .042): void {
  m.cylinder([x, y, z], size * 1.8, .021, 'iron', 10, size * 1.8, .58);
  m.cylinder([x, y + .017, z], size, .03, 'steel', 6, size, .83);
}

function plinth(m: Model, width: number, depth: number,
  construction: 'cast-feet' | 'timber-skids' | 'rails' | 'ring-anchors'): void {
  // Each assembly is installed into the surviving floor. Four identical stone
  // exhibition pedestals falsely made these workstations look like collectibles.
  if (construction === 'cast-feet') {
    for (const x of [-width * .33, width * .33]) {
      m.box([x, .085, -.035], [.69, .17, depth * .93], 'cutstone', .038, .71);
      m.box([x, .235, -.065], [.47, .2, depth * .82], 'iron', .042, .8);
    }
    m.beam([-width * .42, .265, -.35], [width * .42, .265, -.35], .1, .16, 'iron', .75);
  } else if (construction === 'timber-skids') {
    for (const z of [-depth * .3, depth * .3]) {
      m.box([-.015, .11, z], [width, .22, .29], 'wood', .036, .79);
      m.box([0, .235, z], [width * .92, .047, .31], 'iron', .012, .78);
    }
  } else if (construction === 'rails') {
    for (const z of [-depth * .35, depth * .35]) {
      m.box([.025, .065, z], [width, .08, .25], 'iron', .018, .71);
      m.box([.025, .173, z], [width * .94, .17, .08], 'iron', .015, .79);
      m.box([.025, .275, z], [width * .95, .045, .22], 'steel', .01, .64);
    }
  } else {
    for (const x of [-.65, .65]) {
      m.box([x, .09, -.04], [.58, .18, depth], 'iron', .034, .71);
      m.box([x, .24, -.04], [.39, .19, depth * .75], 'iron', .032, .84);
    }
  }
  for (const x of [-width * .37, width * .37]) for (const z of [-depth * .34, depth * .34]) {
    m.box([x, .27, z], [.29, .075, .25], 'iron', .025, 1.03);
    topBolt(m, x, .325, z, .056);
  }
}

interface CastSection { y: number; x: number; z: number; width: number; depth: number }
function casting(m: Model, sections: readonly CastSection[], material: Material, tint = 1): void {
  const ring = (s: CastSection): V3[] => {
    const w = s.width / 2, d = s.depth / 2, b = Math.min(w, d) * .3;
    return [[s.x - w + b, s.y, s.z - d], [s.x + w - b, s.y, s.z - d],
      [s.x + w, s.y, s.z - d + b], [s.x + w, s.y, s.z + d - b],
      [s.x + w - b, s.y, s.z + d], [s.x - w + b, s.y, s.z + d],
      [s.x - w, s.y, s.z + d - b], [s.x - w, s.y, s.z - d + b]];
  };
  for (let k = 1; k < sections.length; k++) {
    const a = ring(sections[k - 1]!), b = ring(sections[k]!);
    for (let i = 0; i < 8; i++) m.quad(a[i]!, b[i]!, b[(i + 1) % 8]!, a[(i + 1) % 8]!, material, tint);
  }
  for (const [s, reverse] of [[sections[0]!, false], [sections[sections.length - 1]!, true]] as const) {
    const vertices = ring(s), center: V3 = [s.x, s.y, s.z];
    for (let i = 0; i < 8; i++) m.triangle(center, vertices[reverse ? (i + 1) % 8 : i]!, vertices[reverse ? i : (i + 1) % 8]!, material, tint);
  }
}

/** Turned rim around a genuinely open circular bore, with rounded outer and
 * inner returns. Inner axis can be eccentric without adding fake front lines. */
function castRing(m: Model, center: V3, radius: number, hole: number, depth: number,
  material: Material, offset: readonly [number, number] = [0, 0], tint = 1): void {
  const bevel = Math.min((radius - hole) * .2, .07);
  const profile = [[radius - bevel, -depth / 2, 0], [radius, -depth / 2 + bevel, 0],
    [radius, depth / 2 - bevel, 0], [radius - bevel, depth / 2, 0],
    [hole + bevel, depth / 2, 1], [hole, depth / 2 - bevel, 1],
    [hole, -depth / 2 + bevel, 1], [hole + bevel, -depth / 2, 1]] as const;
  const n = 36;
  for (let i = 0; i < n; i++) for (let k = 0; k < profile.length; k++) {
    const a = profile[k]!, b = profile[(k + 1) % profile.length]!;
    const point = (p: typeof profile[number], step: number): V3 => {
      const angle = step / n * Math.PI * 2;
      return [center[0] + Math.cos(angle) * p[0] + offset[0] * p[2],
        center[1] + Math.sin(angle) * p[0] + offset[1] * p[2], center[2] + p[1]];
    };
    m.quad(point(a, i), point(b, i), point(b, i + 1), point(a, i + 1), material, tint);
  }
}

/** A horizontal annulus, including its inner wall. No disc seals the center. */
function collar(m: Model, y: number, outer: number, inner: number, height: number,
  material: Material, tint = 1, center: readonly [number, number] = [0, 0]): void {
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, b = (i + 1) / 28 * Math.PI * 2;
    const p = (angle: number, radius: number, yy: number): V3 => [center[0] + Math.cos(angle) * radius, yy, center[1] + Math.sin(angle) * radius];
    m.quad(p(a, outer, y - height / 2), p(a, outer, y + height / 2), p(b, outer, y + height / 2), p(b, outer, y - height / 2), material, tint);
    m.quad(p(a, inner, y + height / 2), p(a, inner, y - height / 2), p(b, inner, y - height / 2), p(b, inner, y + height / 2), material, tint * .85);
    m.quad(p(a, outer, y + height / 2), p(a, inner, y + height / 2), p(b, inner, y + height / 2), p(b, outer, y + height / 2), material, tint);
  }
}

type FoldKnot = readonly [x: number, y: number, z: number, width: number, thickness: number, roll: number];

/** A bent, creased body of matter, not a painted line. The asymmetric closed
 * cross-section turns through the curved path and has both a deep return and
 * an indented front fold. Separate bodies can occlude one another naturally. */
function constrainedFold(m: Model, knots: readonly FoldKnot[], tint: number): void {
  const samples: FoldKnot[] = [];
  const interpolate = (a: number, b: number, c: number, d: number, t: number): number =>
    .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  for (let segment = 0; segment < knots.length - 1; segment++) {
    const a = knots[Math.max(0, segment - 1)]!, b = knots[segment]!,
      c = knots[segment + 1]!, d = knots[Math.min(knots.length - 1, segment + 2)]!;
    for (let step = 0; step < 4; step++) {
      const t = step / 4;
      samples.push(a.map((value, k) => interpolate(value, b[k]!, c[k]!, d[k]!, t)) as unknown as FoldKnot);
    }
  }
  samples.push(knots[knots.length - 1]!);
  const profile: readonly (readonly [number, number])[] = [
    [-1, 0], [-.94, .55], [-.67, .94], [-.25, 1], [.03, .73],
    [.3, .85], [.73, .59], [1, .02], [.73, -.61], [.05, -.9], [-.66, -.58],
  ];
  const rings = samples.map((s, i): V3[] => {
    const before = samples[Math.max(0, i - 1)]!, after = samples[Math.min(samples.length - 1, i + 1)]!;
    const axis = unit([after[0] - before[0], after[1] - before[1], after[2] - before[2]]);
    const across = unit(cross(axis, [0, 0, 1])), front = unit(cross(across, axis));
    const widthAxis = add(mul(across, Math.cos(s[5])), mul(front, Math.sin(s[5])));
    const deepAxis = add(mul(front, Math.cos(s[5])), mul(across, -Math.sin(s[5])));
    return profile.map(([w, d]) => add([s[0], s[1], s[2]], add(mul(widthAxis, w * s[3]), mul(deepAxis, d * s[4]))));
  });
  for (let k = 1; k < rings.length; k++) for (let i = 0; i < profile.length; i++) {
    const next = (i + 1) % profile.length;
    const convex = Math.max(0, (profile[i]![1] + profile[next]![1]) * .5);
    const localTint = tint * (.64 + convex * .33);
    m.quad(rings[k - 1]![i]!, rings[k]![i]!, rings[k]![next]!, rings[k - 1]![next]!, 'pollutant', localTint);
  }
  for (const index of [0, rings.length - 1]) {
    const s = samples[index]!, center: V3 = [s[0], s[1], s[2]];
    for (let i = 0; i < profile.length; i++) {
      const next = (i + 1) % profile.length;
      m.triangle(center, rings[index]![i]!, rings[index]![next]!, 'pollutant', tint * .52);
    }
  }
}

function core(m: Model): void {
  plinth(m, 2.46, 1.92, 'cast-feet');
  m.box([0, .39, -.12], [1.88, .28, 1.37], 'iron', .075, .76);
  // Recessed back and cheeks hold the foreign body; the open front is deep.
  m.box([0, 1.78, -.51], [1.4, 2.44, .19], 'black', .035, .9);
  m.box([0, 1.7, -.64], [1.85, 2.37, .17], 'iron', .045, .6);
  casting(m, [{ y: .43, x: -.84, z: -.02, width: .55, depth: 1.13 },
    { y: .71, x: -.91, z: -.04, width: .47, depth: .97 },
    { y: 2.63, x: -.81, z: -.16, width: .42, depth: .77 },
    { y: 3.31, x: -.56, z: -.23, width: .42, depth: .6 },
    { y: 3.56, x: -.32, z: -.22, width: .33, depth: .52 }], 'iron', .98);
  casting(m, [{ y: .43, x: .8, z: -.04, width: .65, depth: 1.05 },
    { y: .88, x: .79, z: -.04, width: .48, depth: .89 },
    { y: 2.57, x: .62, z: -.2, width: .47, depth: .67 },
    { y: 3.1, x: .41, z: -.25, width: .37, depth: .56 }], 'iron', .83);
  // Narrow inner liners and recessed assembly channels continue around the turn.
  m.beam([-.62, .67, .34], [-.59, 2.59, .12], .087, .055, 'steel', .66);
  m.beam([-.59, 2.59, .12], [-.34, 3.24, .025], .08, .048, 'steel', .66);
  m.beam([.54, .62, .31], [.41, 2.6, .075], .069, .056, 'steel', .61);
  for (const [x, y, z] of [[-.93, .68, .48], [-.9, 1.4, .405], [-.82, 2.32, .26], [.88, .7, .44], [.77, 1.49, .34], [.63, 2.42, .2]]) frontBolt(m, x!, y!, z!, .052);
  // A narrow dark spine recedes behind five unequal, mutually compressed folds.
  // The three long negative spaces are actual gaps between the bodies, not
  // isolated black patches on one oval front surface.
  casting(m, [{ y: .76, x: .03, z: -.26, width: .2, depth: .19 },
    { y: 1.37, x: -.09, z: -.27, width: .27, depth: .23 },
    { y: 2.09, x: .025, z: -.3, width: .22, depth: .2 },
    { y: 2.95, x: -.1, z: -.27, width: .17, depth: .16 }], 'black', .85);
  constrainedFold(m, [
    [-.3, 2.98, -.1, .095, .09, -.25], [-.4, 2.76, .06, .22, .125, -.17],
    [-.27, 2.54, .22, .21, .15, .14], [.02, 2.51, .25, .2, .15, .31],
    [.3, 2.34, .13, .14, .13, .08], [.27, 2.17, -.05, .055, .08, -.25],
  ], .99);
  constrainedFold(m, [
    [.14, 2.94, -.09, .12, .09, .34], [.23, 2.69, .09, .2, .125, .11],
    [.17, 2.47, .255, .18, .12, -.3], [-.035, 2.32, .35, .155, .11, -.39],
    [-.27, 2.27, .17, .17, .105, -.1], [-.35, 2.07, -.09, .08, .08, .28],
  ], .84);
  constrainedFold(m, [
    [.27, 2.3, -.12, .08, .09, .2], [.4, 2.12, .06, .19, .13, .21],
    [.27, 1.95, .22, .245, .16, -.17], [.02, 1.79, .31, .205, .14, -.31],
    [-.23, 1.6, .15, .17, .11, -.11], [-.38, 1.43, -.06, .1, .085, .19],
  ], 1.04);
  constrainedFold(m, [
    [-.38, 2.15, -.09, .09, .08, -.28], [-.33, 1.99, .13, .2, .13, -.1],
    [-.16, 1.8, .35, .19, .12, .24], [.045, 1.59, .3, .23, .15, .4],
    [.3, 1.37, .09, .18, .125, .15], [.23, 1.21, -.06, .07, .075, -.17],
  ], .88);
  constrainedFold(m, [
    [-.28, 1.53, -.11, .1, .07, .06], [-.25, 1.3, .12, .24, .14, -.21],
    [-.12, 1.13, .27, .2, .15, -.3], [.1, 1.02, .24, .2, .12, .27],
    [.2, .81, .02, .07, .06, .14],
  ], .95);
  // The small strained contact edges belong to the folds and clamps. They do
  // not trace all five silhouettes or reintroduce a uniformly lit green mass.
  m.cable([[-.235, 2.38, .36], [-.17, 2.365, .405]], .014, 'pollutant', 1.41);
  m.cable([[.19, 1.34, .21], [.14, 1.3, .28]], .014, 'pollutant', 1.35);
  // Opposed clamps have a carriage, threaded shaft, shoe and replaceable pads.
  for (const [side, y] of [[-1, 2.36], [1, 1.2]] as const) {
    const x = side * .73;
    m.box([x, y, .4], [.61, .31, .47], 'iron', .045, .73);
    m.box([side * .43, y - .03, .47], [.34, .19, .28], 'steel', .025, .8);
    m.box([side * .24, y - .04, .46], [.13, .3, .37], 'iron', .025, .8);
    rod(m, [side * 1.01, y + .015, .4], [side * .3, y + .015, .4], .073, 'steel', 10, .073, .72);
    for (let i = 0; i < 5; i++) rod(m, [side * (.87 - i * .061), y + .015, .4], [side * (.85 - i * .061), y + .015, .4], .086, 'iron', 10, .086, .82);
    frontBolt(m, side * .87, y, .65, .06);
  }
  pipe(m, [[-.96, .54, -.57], [-1.04, 1.29, -.54], [-1.01, 2.22, -.46], [-.7, 2.71, -.4]], .043, .8);
  pipe(m, [[.99, .51, -.51], [1.09, .61, -.45], [1.08, .9, -.3], [.9, 1.03, -.24]], .071, .72);
  m.box([-.67, .75, .72], [.39, .4, .2], 'iron', .026, .92);
  m.ring([-.67, .81, .833], .108, .03, .025, 'bronze', 16, .58);
  rod(m, [-.67, .81, .8], [-.67, .81, .828], .08, 'black', 16);
  m.beam([-.67, .81, .838], [-.715, .86, .838], .012, .015, 'steel');
  m.light([0, 1.7, .4], [.48, .61, .54], .8, 4);
}

function storage(m: Model): void {
  plinth(m, 2.16, 1.78, 'timber-skids');
  // Cast receiver with separate thick cheeks; the glass observation slot is sunk
  // below its lip rather than pasted on a solid box.
  m.box([0, .41, 0], [1.86, .24, 1.5], 'iron', .045, .83);
  m.box([-.83, 1.02, 0], [.22, 1.11, 1.35], 'iron', .06, .88);
  m.box([.8, 1.02, 0], [.28, 1.11, 1.35], 'iron', .065, .72);
  m.box([0, 1.02, -.6], [1.5, 1.03, .16], 'iron', .04, .67);
  m.box([0, .99, .61], [1.5, .98, .19], 'iron', .045, .82);
  m.box([0, 1.15, 0], [1.25, .46, 1.03], 'black', .02, .85);
  m.rock([-.05, 1.41, -.05], [.88, .19, .65], 'pollutant', 702, .76);
  // Two partly retracted pressure lids leave a restrained, narrow viewing well.
  m.box([-.55, 1.6, -.045], [.67, .16, 1.36], 'steel', .055, .83);
  m.box([.48, 1.62, .01], [.57, .2, 1.34], 'iron', .057, .93);
  m.box([-.055, 1.5, -.44], [.4, .045, .27], 'glass', .016, .48);
  m.box([-.065, 1.5, .37], [.4, .045, .16], 'glass', .013, .58);
  for (const z of [-.46, .42]) {
    m.beam([-1.03, 1.75, z], [1.01, 1.75, z], .094, .087, 'iron', .85);
    for (const x of [-.87, .82]) {
      m.box([x, 1.66, z], [.18, .26, .25], 'iron', .024, .8);
      topBolt(m, x, 1.82, z, .052);
    }
  }
  for (const x of [-.66, .62]) {
    m.box([x, .98, .735], [.14, 1, .058], 'iron', .015, 1.02);
    frontBolt(m, x, 1.34, .783, .045); frontBolt(m, x, .65, .783, .045);
  }
  m.box([-.2, .82, .752], [.73, .42, .022], 'black', .003, .5);
  m.box([-.2, .84, .778], [.66, .34, .04], 'iron', .021, .89);
  for (const x of [-.46, .06]) frontBolt(m, x, .84, .804, .026);
  rod(m, [.72, 1.15, .79], [.72, 1.15, .89], .12, 'iron', 12, .1, .85);
  m.beam([.72, .95, .91], [.72, 1.35, .91], .05, .05, 'steel', .72);
  pipe(m, [[-.76, .55, -.7], [-.97, .63, -.7], [-1.015, 1.09, -.62], [-.9, 1.33, -.54]], .045);
  m.box([.49, .59, .743], [.11, .084, .048], 'bronze', .01, .55);
  // Operation is from the safe west side; no actor needs to stand beyond the
  // narrow upper slab's front edge or inside the machine's footprint.
  m.box([-1.065, 1.03, -.3], [.18, .29, .31], 'iron', .026, .85);
  rod(m, [-1.18, .88, -.3], [-1.18, 1.28, -.3], .032, 'steel', 10, .032, .8);
  rod(m, [-1.18, 1.03, -.3], [-.97, 1.03, -.3], .045, 'iron', 10);
}

function purifier(m: Model): void {
  plinth(m, 2.95, 1.48, 'rails');
  m.box([0, .37, -.05], [2.66, .18, 1.2], 'iron', .042, .85);
  // Two separation chambers differ in width and packing. Deep open windows,
  // a raised sump and an inter-chamber neck are all visible from the front.
  for (const [x, width, height, tint] of [[-.66, .92, 1.08, .9], [.48, 1, .86, .8]] as const) {
    m.box([x - width / 2, .45 + height / 2, -.07], [.12, height, 1.04], 'iron', .034, tint);
    m.box([x + width / 2, .45 + height / 2, -.07], [.12, height, 1.04], 'iron', .034, tint * .83);
    m.box([x, .51, -.04], [width, .18, .96], 'steel', .025, tint * .78);
    m.box([x, .51 + height, -.1], [width + .18, .13, 1.17], 'iron', .041, tint * 1.05);
    m.box([x, .48 + height / 2, -.53], [width, height, .12], 'black', .018, .85);
    // The rear spindle/packing sits well behind the glass lip.
    rod(m, [x - .13, .63, -.07], [x - .13, height + .33, -.07], .14, 'steel', 14, .14, .65);
    for (let i = 0; i < 5; i++) m.cylinder([x - .13, .71 + i * height * .13, -.07], .22, .043, 'iron', 16, .22, .78);
    m.rock([x + .12, .66, .01], [.43, .2, .5], 'pollutant', Math.round(x * 10 + 812), .72);
    m.box([x - width * .31, .65 + height * .3, .475], [.11, height * .55, .038], 'glass', .013, .6);
    for (const xx of [x - width / 2, x + width / 2]) {
      frontBolt(m, xx, .65, .5, .04); frontBolt(m, xx, height + .32, .5, .04);
    }
  }
  // Heavy shared top service pipe with actual union collars.
  pipe(m, [[-.64, 1.47, -.14], [-.64, 1.57, -.31], [.47, 1.57, -.31], [.48, 1.32, -.14]], .067);
  for (const x of [-.42, .25]) rod(m, [x, 1.57, -.31], [x + .1, 1.57, -.31], .1, 'steel', 12, .1, .72);
  pipe(m, [[1.04, .84, -.18], [1.28, .86, -.18], [1.33, .65, -.1], [1.27, .45, .12], [.99, .44, .15]], .095, .78);
  castRing(m, [-1.28, 1.02, .54], .174, .112, .06, 'iron', [0, 0], .9);
  rod(m, [-1.28, 1.02, .43], [-1.28, 1.02, .6], .038, 'steel', 8, .038, .74);
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * Math.PI * 2;
    m.beam([-1.28, 1.02, .57], [-1.28 + Math.cos(a) * .145, 1.02 + Math.sin(a) * .145, .57], .027, .028, 'iron');
  }
  m.box([.04, .63, .51], [.13, .3, .1], 'iron', .018, .85);
  m.box([.04, .7, .573], [.045, .05, .02], 'ember', .005, .23);
}

function offering(m: Model): void {
  plinth(m, 2.07, 1.09, 'ring-anchors');
  m.box([0, .37, -.04], [1.43, .26, .77], 'iron', .067, .86);
  // Offset bore and rear sleeve make a massive reclaimed casting. Its opening
  // stays transparent; it is not a glowing portal disc.
  castRing(m, [0, 1.6, -.035], 1.045, .668, .49, 'iron', [-.08, .085], 1);
  castRing(m, [0, 1.6, -.3], 1.016, .691, .095, 'iron', [-.08, .085], .73);
  for (const x of [-.66, .66]) {
    m.beam([x, .39, -.04], [x * .75, .74, -.08], .22, .3, 'iron', .85);
    m.box([x, .36, .06], [.41, .14, .55], 'iron', .03, .96);
    topBolt(m, x, .45, .19, .055);
  }
  // Two unequal locks bite only the low portion of the opening.
  m.box([-.57, 1.19, .21], [.45, .2, .17], 'steel', .028, .69);
  m.box([-.4, 1.16, .15], [.1, .23, .31], 'iron', .023, .84);
  m.box([.59, 1.43, .23], [.39, .18, .15], 'iron', .026, 1.04);
  m.box([.45, 1.37, .135], [.12, .27, .28], 'steel', .019, .68);
  frontBolt(m, -.73, 1.21, .318, .052); frontBolt(m, .73, 1.43, .321, .052);
  m.rock([-.11, 1.015, .06], [.67, .3, .31], 'black', 913, .88);
  m.rock([-.12, 1.055, .14], [.46, .21, .23], 'pollutant', 917, .47);
  m.beam([-.18, 1.1, .245], [.02, 1.07, .22], .018, .02, 'pollutant', .94);
  for (const a of [.7, 2.17, 3.44, 5.48]) {
    frontBolt(m, Math.cos(a) * .879, 1.6 + Math.sin(a) * .879, .236, .034);
  }
  // A broken rib on the outer casting is a replacement joint, not ornament.
  m.beam([.77, 2.27, -.035], [.89, 2.03, -.035], .12, .57, 'iron', .82);
}

function growth(m: Model): void {
  m.cylinder([0, .12, 0], .89, .24, 'cutstone', 24, .83, .88);
  m.cylinder([0, .3, 0], .79, .16, 'iron', 24, .76, .78);
  collar(m, .43, .745, .59, .19, 'iron', .98);
  collar(m, 2.36, .748, .6, .16, 'iron', .97);
  m.cylinder([0, 2.55, -.005], .73, .2, 'iron', 24, .62, .85);
  m.cylinder([0, 2.697, -.03], .27, .094, 'iron', 18, .25, .86);
  // Continuous transparent pressure glass has a real round silhouette and a
  // separate liquid boundary behind it. The shader preserves those two layers.
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2, b = (i + 1) / 28 * Math.PI * 2;
    const p = (angle: number, y: number): V3 => [Math.cos(angle) * .665, y, Math.sin(angle) * .665];
    m.quad(p(a, .46), p(a, 2.3), p(b, 2.3), p(b, .46), 'glass', 1.04);
  }
  // Rear spine is narrow enough to leave the vessel recognizably transparent.
  m.box([0, 1.39, -.61], [.22, 1.82, .09], 'iron', .024, .62);
  m.cylinder([0, 1.31, 0], .595, 1.55, 'liquid', 28, .595, 1.03);
  m.cylinder([0, 2.085, 0], .595, .018, 'liquid', 28, .595, 1.32);
  for (const side of [-1, 1]) {
    const x = side * .64;
    rod(m, [x, .38, .055], [x, 2.45, .055], .064, 'iron', 10, .064, .85);
    for (const y of [.55, 2.23]) frontBolt(m, x, y, .15, .036);
  }
  // Hazy anatomy belongs to the material inside, not a second clear character.
  m.rock([-.055, 1.93, -.095], [.35, .39, .31], 'black', 1021, .93);
  m.rock([-.065, 1.42, -.13], [.54, .79, .42], 'pollutant', 1029, .61);
  m.rock([.04, 1.32, .055], [.38, .46, .19], 'black', 1031, .89);
  m.beam([-.19, 1.61, -.055], [-.37, 1.08, .015], .095, .11, 'pollutant', .51);
  m.beam([.16, 1.63, -.11], [.32, 1.1, -.07], .088, .11, 'black', .8);
  m.beam([-.15, 1.03, -.1], [-.21, .56, -.055], .12, .14, 'pollutant', .49);
  m.beam([.11, 1.02, -.13], [.18, .57, -.11], .11, .14, 'black', .8);
  // Low meniscus and a few cloudy flecks do not turn the whole vessel green.
  m.cylinder([0, .51, 0], .565, .028, 'pollutant', 22, .565, .45);
  for (const [x, y, z, r] of [[-.31, 1.9, .31, .065], [.25, 2.02, .27, .048], [-.37, 1.05, .28, .039], [.35, 1.49, .29, .057]]) {
    m.rock([x!, y!, z!], [r! * 2, r! * 2.3, r! * 1.7], 'glass', Math.round(y! * 100), 1.55);
  }
  // Hoop tensioners and a rear service line reinforce the salvaged pressure jar.
  for (const y of [.7, 2.18]) {
    m.box([-.66, y, .17], [.23, .16, .19], 'iron', .026, .76);
    m.box([.65, y, .12], [.24, .18, .18], 'iron', .026, .82);
    frontBolt(m, -.66, y, .278, .048); frontBolt(m, .65, y, .223, .048);
  }
  pipe(m, [[-.65, .38, -.22], [-.83, .55, -.22], [-.8, 2.27, -.25], [-.37, 2.62, -.3]], .035, .77);
  m.box([.71, .7, .18], [.3, .59, .4], 'iron', .03, .84);
  m.ring([.714, .83, .397], .09, .025, .028, 'bronze', 16, .52);
  rod(m, [.714, .83, .37], [.714, .83, .4], .059, 'black', 14);
  m.beam([.714, .83, .414], [.688, .862, .414], .009, .012, 'steel');
  m.light([-.17, 1.52, .22], [.33, .46, .4], .54, 1.2);
}

function rift(m: Model): void {
  // Layered bank strips are painted in the ground plane and taper with each
  // uneven fork. The small hole at their meeting is unlit and bottomless.
  const branches: readonly (readonly (readonly [number, number])[])[] = [
    [[-.14, -.03], [.24, -.16], [.49, -.36], [.8, -.39], [1.31, -.57]],
    [[-.14, -.03], [.25, .24], [.4, .53], [.91, .94]],
    [[-.14, -.03], [-.4, .21], [-.57, .49], [-1.2, .7]],
    [[-.14, -.03], [-.57, -.05], [-.83, -.28], [-1.34, -.36]],
    [[-.14, -.03], [-.21, -.44], [.1, -.83]],
    [[.49, -.36], [.67, -.02], [1.07, .19]],
    [[-.57, .49], [-.25, .67], [-.14, .95]],
    [[-.57, -.05], [-.64, -.58], [-.9, -.79]],
  ];
  for (let branch = 0; branch < branches.length; branch++) {
    const points = branches[branch]!;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!, b = points[i]!;
      const width = (branch < 5 ? .125 : .063) * (1 - (i - 1) / points.length * .81);
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const nx = -dz / length, nz = dx / length;
      const p = (v: readonly [number, number], side: number, factor = 1): V3 => [v[0] + nx * width * side * factor, .012, v[1] + nz * width * side * factor];
      m.quad(p(a, -1), p(a, 1), p(b, 1, .68), p(b, -1, .68), 'black', .72);
      const edgeA = p(a, 1), edgeB = p(b, 1, .68);
      m.quad(edgeA, [edgeA[0] + nx * .033, .057, edgeA[2] + nz * .033],
        [edgeB[0] + nx * .028, .036, edgeB[2] + nz * .028], edgeB, 'stone', .77);
      // Intermittent infiltrated seams, not a neon outline around every branch.
      if ((i + branch) % 3 === 0) {
        const start: V3 = [a[0] + dx * .18, .017, a[1] + dz * .18];
        const end: V3 = [a[0] + dx * .63, .018, a[1] + dz * .63];
        m.beam(start, end, width * .15, .012, 'pollutant', .48);
      }
    }
  }
  m.slab([[-.29, -.08], [-.11, -.18], [.065, -.09], [.11, .08], [-.08, .18], [-.3, .08]], .016, -.09, 'black', .6);
  m.rock([-.69, .055, .34], [.19, .12, .2], 'stone', 1191, .85);
  m.rock([.5, .067, -.57], [.22, .12, .18], 'stone', 1193, .84);
  m.rock([.77, .04, .51], [.11, .077, .13], 'cutstone', 1197, .9);
}

export function buildDevices(m: Model): Station[] {
  const stations: Station[] = [
    { id: 1, key: 'core', name: '核心', position: [4.7, 0, 1], approach: [4.7, 0, 2.92], radius: .85,
      description: '不对称铁肩与对置夹具束住异源污染暗质；受压裂隙仅露出微弱灰绿。注入薪柴修复，降低出击混乱增速。' },
    { id: 2, key: 'storage', name: '储藏', position: [10.5, 2.6, -3.2], approach: [9.02, 2.6, -3.55], radius: .8,
      description: '封闭的顶压观察井，窄缝下可见被关物抵压；承压盖、螺杆与深收容腔构成完整机体。修复提高薪柴价值。' },
    { id: 3, key: 'purifier', name: '净化器', position: [-.8, 0, 2], approach: [-.8, 0, 3.83], radius: .83,
      description: '两只深浅不同的分离腔由管路相接，内部填料、低液面与收集槽可见。修复降低踏入裂隙时的起始混乱。' },
    { id: 4, key: 'offering', name: '供奉', position: [-2.2, 0, -2.1], approach: [-2.2, 0, -.24], radius: .82,
      description: '厚壁回收管环的偏心孔贯通前后，下沿夹件暴露并控制残渣；压力穿孔而过。装入物件供其抵御冲击并转化。' },
    { id: 5, key: 'growth', name: '蜕变', position: [6, 2.6, -5.2], approach: [6, 2.6, -3.33], radius: .83,
      description: '可容人体的旧式立缸，暗色半透明介质中隐约有躯体般的物质与稀少气泡。通过培养藏刻入永久成长和模块加厚。' },
    { id: 6, key: 'rift', name: '裂隙', position: [9.4, 0, 4.2], approach: [9.4, 0, 6.07], radius: .92,
      description: '地面上由内向外分叉的时空伤口，裂口粗细不等，仅断续渗出异源颜色；并非门或机械装置。由此准备出击。' },
  ];
  const builders = [core, storage, purifier, offering, growth, rift] as const;
  for (let i = 0; i < stations.length; i++) {
    const station = stations[i]!;
    m.at(station.position, 0, station.id, () => builders[i]!(m));
  }
  return stations;
}
