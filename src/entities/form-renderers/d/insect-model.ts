import type { CoverageId } from '@/generated/contamination-lexicon-data';
import { makeBuf, type PaintBuf } from './genome/buffer';
import type { GenomeCanvas } from './genome/types';

export type InsectPhase = 'idle' | 'walk' | 'alert' | 'windup' | 'strike' | 'recover';

export interface InsectModelRequest {
  seed: number;
  coverage: CoverageId;
  facing4: 'up' | 'down' | 'left' | 'right';
  phase: InsectPhase;
  phase01: number;
}

type V = readonly [number, number, number];
type RGB = readonly [number, number, number];
const TAU = Math.PI * 2;
const OUTLINE: RGB = [19, 23, 23];
const SHELL: RGB = [112, 111, 91];
const LIMB: RGB = [98, 92, 72];
const FOREIGN: RGB = [63, 114, 107];
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const ease = (n: number): number => n * n * (3 - 2 * n);

/** Insect substrate progressively replaced by a folded, inhabited solid.
 * All geometry is rebuilt in the facing's ground plane;
 * height and the light source stay in screen/world space. No Phaser or image rotation. */
export function bakeInsectModel(request: InsectModelRequest): { buf: PaintBuf; canvas: GenomeCanvas } {
  const buf = makeBuf(48, 48);
  const depth = new Float32Array(48 * 48).fill(-Infinity);
  const canvas: GenomeCanvas = {
    w: 48, h: 48, originX: 24, originY: 24, offsetX: 0, offsetY: 0,
    collision: 20, coverage: request.coverage,
  };
  const seed = request.seed >>> 0;
  const noise = (salt: number): number => {
    let x = seed ^ Math.imul(salt + 19, 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  };
  const tier = request.coverage === 'infiltrate' ? 0 : request.coverage === 'rewrite' ? 1 : 2;
  const p = clamp01(Number.isFinite(request.phase01) ? request.phase01 : 0);
  const walking = request.phase === 'walk';
  const winding = request.phase === 'windup' ? ease(p) : 0;
  const striking = request.phase === 'strike' ? 1 - .2 * ease(p) : request.phase === 'recover' ? .8 * (1 - ease(p)) : 0;
  const alert = request.phase === 'alert' ? .65 + .35 * Math.sin(p * Math.PI) : 0;
  const brace = winding;
  const bodyY = brace * 1.8 - striking * 3.2;
  const breath = Math.sin(p * TAU) * (walking ? .26 : .34);
  const bodyZ = 2.8 + breath - winding * 1.1 + striking * .3;
  const width = .96 + noise(1) * .09;
  const length = .97 + noise(2) * .07;
  const abnormalSide = noise(3) < .5 ? -1 : 1;
  const facing = request.facing4;
  const rotate = (v: V): V => {
    const [x, y, z] = v;
    if (facing === 'down') return [-x, -y, z];
    if (facing === 'left') return [y, -x, z];
    if (facing === 'right') return [-y, x, z];
    return v;
  };
  const project = (v: V): V => {
    const [x, y, z] = rotate(v);
    return [24 + x, 25 + y * .82 - z, y + z * .82];
  };
  const pixel = (x: number, y: number, d: number, color: RGB): void => {
    if (x < 0 || y < 0 || x >= 48 || y >= 48) return;
    const i = y * 48 + x;
    if (d < depth[i]!) return;
    depth[i] = d;
    buf.data.set([color[0], color[1], color[2], 255], i * 4);
  };
  const shade = (color: RGB, factor: number): RGB => color.map(v => Math.round(v * factor)) as unknown as RGB;
  const triangle = (a: V, b: V, c: V, color: RGB): void => {
    const pa = project(a), pb = project(b), pc = project(c);
    const area = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]);
    if (Math.abs(area) < .0001) return;
    for (let y = Math.max(0, Math.floor(Math.min(pa[1], pb[1], pc[1]))); y <= Math.min(47, Math.ceil(Math.max(pa[1], pb[1], pc[1]))); y++) {
      for (let x = Math.max(0, Math.floor(Math.min(pa[0], pb[0], pc[0]))); x <= Math.min(47, Math.ceil(Math.max(pa[0], pb[0], pc[0]))); x++) {
        const u = ((pb[0] - x) * (pc[1] - y) - (pb[1] - y) * (pc[0] - x)) / area;
        const v = ((pc[0] - x) * (pa[1] - y) - (pc[1] - y) * (pa[0] - x)) / area;
        const w = 1 - u - v;
        if (u >= -.001 && v >= -.001 && w >= -.001) pixel(x, y, u * pa[2] + v * pb[2] + w * pc[2], color);
      }
    }
  };
  const line = (a: V, b: V, thickness: number, color: RGB): void => {
    const pa = project(a), pb = project(b);
    const dx = pb[0] - pa[0], dy = pb[1] - pa[1];
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n, cx = Math.round(pa[0] + dx * t), cy = Math.round(pa[1] + dy * t);
      const r = (thickness - 1) / 2;
      for (let y = Math.ceil(-r); y <= Math.ceil(r); y++) for (let x = Math.ceil(-r); x <= Math.ceil(r); x++) {
        if (x * x + y * y <= (r + .45) ** 2) pixel(cx + x, cy + y, pa[2] + (pb[2] - pa[2]) * t + .05, color);
      }
    }
  };
    const lit = (a: V, b: V, c: V, color: RGB): RGB => {
      const aa = rotate(a), bb = rotate(b), cc = rotate(c);
      const ab = bb.map((v, i) => v - aa[i]!), ac = cc.map((v, i) => v - aa[i]!);
      let nx = ab[1]! * ac[2]! - ab[2]! * ac[1]!;
      let ny = ab[2]! * ac[0]! - ab[0]! * ac[2]!;
      let nz = ab[0]! * ac[1]! - ab[1]! * ac[0]!;
      if (nz < 0) { nx *= -1; ny *= -1; nz *= -1; }
      const len = Math.hypot(nx, ny, nz) || 1;
      const light = Math.max(0, (-nx * .42 - ny * .46 + nz * .78) / len);
      return shade(color, .50 + Math.round(light * 4) * .145);
    };
  const ellipsoid = (center: V, radii: V, color: RGB, lean = 0): void => {
    const point = (latitude: number, longitude: number): V => {
      const ring = Math.cos(latitude);
      return [center[0] + Math.cos(longitude) * ring * radii[0] + Math.sin(latitude) * lean,
        center[1] + Math.sin(longitude) * ring * radii[1], center[2] + Math.sin(latitude) * radii[2]];
    };
    const lats = [-Math.PI / 2, -.42, .28, .82, Math.PI / 2];
    for (let ring = 0; ring < lats.length - 1; ring++) for (let s = 0; s < 12; s++) {
      const a = point(lats[ring]!, s / 12 * TAU), b = point(lats[ring]!, (s + 1) / 12 * TAU);
      const c = point(lats[ring + 1]!, (s + 1) / 12 * TAU), d = point(lats[ring + 1]!, s / 12 * TAU);
      const colorFace = lit(a, b, c, color);
      triangle(a, b, c, colorFace); triangle(a, c, d, colorFace);
    }
  };
  // Alternating tripod: each foot has a long planted stroke and short lifted return.
  for (const side of [-1, 1]) for (let leg = 0; leg < 3; leg++) {
    if (tier === 1 && side === abnormalSide && leg === 1) continue;
    if (tier === 2 && !((side === abnormalSide && leg === 1) || (side !== abnormalSide && leg !== 1))) continue;
    const cycle = (p + ((leg + (side === 1 ? 1 : 0)) % 2) * .5) % 1;
    const stance = cycle < .66;
    const swingT = clamp01((cycle - .66) / .34);
    const stride = walking ? (stance ? -2 + cycle / .66 * 4 : 2 - ease(swingT) * 4) : 0;
    const lift = walking && !stance ? Math.sin(swingT * Math.PI) * 2.3 : 0;
    const jointY = [-5, 0, 5][leg]!;
    const footY = [-11, 1, 12][leg]! + stride + (leg === 0 ? brace * 3 - striking * 4 : brace * (leg - 1));
    const hip: V = [side * (tier === 2 ? 7.3 : 3.5), jointY + bodyY, bodyZ];
    const knee: V = [side * (10.3 + (leg === 1 ? 1.2 : 0) + brace * 1.4), jointY - 2 + stride * .35 - (leg === 0 ? striking * 2 : 0), 3.5 + lift * .3 + (leg === 0 ? brace * 1.5 : 0)];
    const foot: V = [side * (leg === 1 ? 15.3 : 13.5), footY, .3 + lift];
    if (tier === 2 && leg !== 2) {
      // Two old leg chains are consumed into load-bearing folds; only the rear articulated leg survives.
      const upper: V = [hip[0] - side * 1.9, hip[1] - 1.4, hip[2] + 2.8];
      const elbow: V = [knee[0], knee[1] - 1.2, knee[2] + 1.2];
      const heel: V = [foot[0] - side * 2.4, foot[1] + 1.3, foot[2]];
      triangle(upper, elbow, heel, lit(upper, elbow, heel, [99, 110, 92]));
      triangle(upper, heel, hip, lit(upper, heel, hip, [67, 91, 77]));
      triangle(elbow, foot, heel, lit(elbow, foot, heel, [77, 92, 75]));
      continue;
    }
    const legColor = tier > 0 && side === abnormalSide ? [74, 99, 87] as const : LIMB;
    line(hip, knee, tier === 2 && leg === 1 ? 5 : 3, shade(legColor, .70)); line(knee, foot, 2, shade(LIMB, .72));
    line([hip[0], hip[1], hip[2] + .35], [knee[0], knee[1], knee[2] + .35], 2, legColor);
    line([knee[0], knee[1], knee[2] + .4], [foot[0], foot[1], foot[2] + .4], 1, shade(LIMB, .95));
    ellipsoid(knee, [1.5, 1.4, 1.1], shade(LIMB, .92));
    line(foot, [foot[0] - side * 1.6, foot[1] - 1.5, foot[2]], 1, [116, 115, 91]);
  }
  if (tier === 0) {
  // A full dark abdomen remains underneath two weighty elytra; the seam is a recess.
  ellipsoid([0, 5.1 + bodyY, bodyZ], [6.9 * width, 9.4 * length, 3.2], [51, 52, 45]);
  for (const side of [-1, 1]) {
    const rewritten = side === abnormalSide;
    ellipsoid([side * (rewritten ? 3.2 : 2.65), 4.6 + bodyY - (rewritten ? 1.2 : 0), bodyZ + (rewritten ? 1.5 : .9)],
      [3.75 * width, 8.5 * length, 3.4], SHELL, side * .2);
  }
  // Shoulder collar and head are distinct masses, joined by a dark narrow neck.
  ellipsoid([abnormalSide * 1.1, -4.1 + bodyY, bodyZ + .1], [5.4, 3.8, 2.8], [89, 93, 77]);
  ellipsoid([0, -8.1 + bodyY, bodyZ - .1], [2.8, 2.4, 1.9], [43, 48, 43]);
  ellipsoid([0, -10 + bodyY, bodyZ + .15], [3.8, 2.7, 1.9], [108, 111, 90]);
  for (const side of [-1, 1]) {
    const spread = 2.8 + winding * 1.7 - striking * 1.3;
    const jaw: V = [side * 2.2, -11.5 + bodyY, bodyZ];
    const hook: V = [side * spread, -14 + bodyY - striking, bodyZ - .3];
    line(jaw, hook, 2, [77, 81, 67]);
    line(hook, [side * .9, -14.7 + bodyY - striking, bodyZ - .4], 1, [147, 147, 117]);
    // Antennae sweep independently of the planted legs.
    const twitch = Math.sin(p * TAU + side * 1.5) * .65;
    const root: V = [side * 2.8, -10.7 + bodyY, bodyZ + 1.1];
    const bend: V = [side * (5.5 + alert), -14.8 + bodyY, bodyZ + .2];
    const tip: V = [side * (6.6 + alert + twitch), -18 + bodyY + winding * 2, .9];
    line(root, bend, 1, [96, 104, 84]); line(bend, tip, 1, [114, 126, 104]);
    ellipsoid([side * 2.8, -10.1 + bodyY, bodyZ + 1.6], [.75, .9, .5], [80, 145, 126]);
  }
  // The foreign structure follows one shell's growth direction but repeats at the wrong spacing.
  const facetCount = 1;
  for (let i = 0; i < facetCount; i++) {
    const s = abnormalSide;
    const y = 1.4 + i * 3.6 + bodyY;
    const x = s * (3.0 + i * .7);
    const z = bodyZ + 5.5 - i * .22;
    const a: V = [x - s * 1.6, y - 2.5, z];
    const b: V = [x + s * 2.5, y - 1.6, z - 1.0];
    const c: V = [x + s * 2.1, y + 2.6, z - .4];
    const d: V = [x - s * 1.3, y + 1.4, z + .7];
    triangle(a, b, c, shade(FOREIGN, .70)); triangle(a, c, d, FOREIGN);
    line(a, d, 1, [89, 151, 133]);
  }
  // A split down the carapace resolves the paired shell at native size.
  line([0, -1 + bodyY, bodyZ + 4.2], [0, 10.1 + bodyY, bodyZ + 3.3], 1, [33, 48, 43]);
  // Sparse anatomical etching is deliberately deterministic, never speckle noise.
  for (const side of [-1, 1]) {
    line([side * 4.5, 3 + bodyY, bodyZ + 3.45], [side * 4.7, 6.4 + bodyY, bodyZ + 3.1], 1, [75, 80, 65]);
  }
  } else {
    // Rewrite retains a connected organism; replacement first takes one flank and shoulder.
    if (tier === 1) {
      ellipsoid([-abnormalSide * .8, 4.9 + bodyY, bodyZ], [5.7 * width, 8.5 * length, 2.8], [51, 52, 45]);
      ellipsoid([-abnormalSide * 3.1, 5.3 + bodyY, bodyZ + .8], [4.1 * width, 8 * length, 3.1], SHELL);
      // The second elytron survives only at the rear, displaced from the intact half.
      ellipsoid([abnormalSide * 2.6, 7.3 + bodyY, bodyZ + 1.1], [2.7 * width, 5.3 * length, 2.5], [99, 105, 86]);
      ellipsoid([-abnormalSide * 1.1, -3.4 + bodyY, bodyZ + .1], [4.2, 3.7, 2.5], [89, 93, 77]);
      ellipsoid([-abnormalSide * 1.4, -7.5 + bodyY, bodyZ - .1], [2.1, 2.2, 1.5], [43, 48, 43]);
      ellipsoid([-abnormalSide * 1.6, -9.8 + bodyY, bodyZ], [3.2, 2.5, 1.8], [108, 111, 90]);
      for (const side of [-1, 1]) {
        const damaged = side === abnormalSide;
        const root: V = [side * 2 - abnormalSide * 1.6, -10.4 + bodyY, bodyZ + .9];
        const bend: V = [side * (4.6 + alert) - abnormalSide * 1.6, -13.9 + bodyY, bodyZ + .2];
        line(root, bend, 1, [96, 104, 84]);
        if (!damaged) {
          const twitch = Math.sin(p * TAU + side * 1.5) * .65;
          line(bend, [side * (6 + alert + twitch) - abnormalSide * 1.6, -17 + bodyY + winding * 2, .9], 1, [114, 126, 104]);
        }
        const jaw: V = [side * 1.7 - abnormalSide * 1.6, -11.3 + bodyY, bodyZ];
        line(jaw, [side * (2.5 + winding - striking) - abnormalSide * 1.6, -13.4 + bodyY - striking, bodyZ - .3], 1, [115, 119, 95]);
      }
      line([-abnormalSide * 5.7, 5 + bodyY, bodyZ + 3.3], [-abnormalSide * 5.3, 10 + bodyY, bodyZ + 2.3], 1, [68, 74, 59]);
    }
    // A thick folded ribbon encloses real air. Cross-sections carry weight, bevel and an inner wall.
    const path: readonly V[] = tier === 1 ? [
      [0, 11, 3.6], [4, 8, 4.5], [6, 3, 5.8], [6, -3, 6.6],
      [3, -6, 6.7], [-.7, -6.8, 5.2],
    ] : [
      [-1, -12, 5], [5, -10, 6], [9, -5, 7], [8, 4, 6.3],
      [3, 9, 4.2], [-4, 9, 3.7], [-9, 4, 4.8], [-8, -2, 6.2], [-6, -5.5, 4.7],
    ];
    const halfWidths = tier === 1 ? [1.1, 1.6, 2.3, 2.5, 2, .9] : [1.1, 2.5, 3.8, 3.1, 2.3, 3.8, 2.5, 1.8, .8];
    const sections: V[][] = [];
    for (let i = 0; i < path.length; i++) {
      const prev = path[Math.max(0, i - 1)]!, point = path[i]!, next = path[Math.min(path.length - 1, i + 1)]!;
      const dx = next[0] - prev[0], dy = next[1] - prev[1], span = Math.hypot(dx, dy);
      const nx = -dy / span, ny = dx / span;
      const hw = halfWidths[i]! * width;
      const bank = tier === 2 ? [0, .1, .8, 1.05, .55, -.35, -.65, -.3, .6][i]! : 0;
      // The forward fold tucks during windup and opens into the committed strike.
      const front = Math.max(0, -point[1] / 12);
      const localY = point[1] + bodyY + front * (brace * 1.2 - striking * 1.5);
      const z = point[2] + bodyZ - 2.8;
      sections.push([[-1, -.7], [-.68, 1], [0, 1.6], [.72, .5], [1, -1.2]].map(([offset, rise]) => [
        abnormalSide * (point[0] + nx * hw * offset! * Math.cos(bank)), localY + ny * hw * offset! * Math.cos(bank), z + rise! + hw * offset! * Math.sin(bank),
      ] as V));
    }
    const mineral: RGB = [106, 116, 103];
    const inner: RGB = [64, 95, 85];
    for (let i = 0; i < sections.length - 1; i++) {
      const a = sections[i]!, b = sections[i + 1]!;
      for (let band = 0; band < 4; band++) {
        const base = band === 3 ? inner : mineral;
        triangle(a[band]!, b[band]!, b[band + 1]!, lit(a[band]!, b[band]!, b[band + 1]!, base));
        triangle(a[band]!, b[band + 1]!, a[band + 1]!, lit(a[band]!, b[band + 1]!, a[band + 1]!, base));
      }
      // Repeat on only three long folds: an ordered seam, not luminous all-over trim.
      if (i === 1 || i === 4 || i === 6) line(a[3]!, b[3]!, 1, [96, 147, 127]);
    }
    for (const end of [sections[0]!, sections[sections.length - 1]!]) {
      triangle(end[0]!, end[2]!, end[4]!, [44, 65, 58]);
    }
    if (tier === 2) {
      // The surface folds inward once more: a suspended tapered return, not an organ or eye.
      const fold = (x: number, y: number, z: number): V => [abnormalSide * x, y + bodyY, z + bodyZ - 2.8];
      const a = fold(-4.8, 6.9, 4.4), b = fold(.4, 5.2, 6.2), c = fold(2.2, -.6, 5.4);
      const d = fold(-.9, 4.8, 5), e = fold(-4.9, 5.4, 3.5);
      triangle(a, b, c, lit(a, b, c, [98, 113, 96]));
      triangle(a, c, d, lit(a, c, d, [69, 89, 75]));
      triangle(a, d, e, [51, 72, 62]);
    }
    // One wrong remnant survives: a short backward palp under the lower return.
    const remnant: V = [-abnormalSide * 4, 10 + bodyY, 1.9];
    line(remnant, [-abnormalSide * 2, 13 + bodyY, .9], 2, [94, 95, 73]);
    line([-abnormalSide * 2, 13 + bodyY, .9], [-abnormalSide * 4, 14 + bodyY, .4], 1, [112, 115, 89]);
  }
  // One-pixel contour around exposed anatomy, preserving inter-leg negative space.
  const original = new Uint8ClampedArray(buf.data);
  for (let y = 1; y < 47; y++) for (let x = 1; x < 47; x++) {
    const i = (y * 48 + x) * 4;
    if (original[i + 3]) continue;
    if (original[i - 4 + 3] || original[i + 4 + 3] || original[i - 192 + 3] || original[i + 192 + 3]) buf.data.set([...OUTLINE, 255], i);
  }
  return { buf, canvas };
}
