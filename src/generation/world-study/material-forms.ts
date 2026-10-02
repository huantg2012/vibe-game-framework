/** Connected, walkable material relief. Every mark is seated on supported land. */
import { Raster } from './raster';
import { worldSupportAt } from './support';
import type { WorldMaterial, WorldSample } from './types';
import { sampleSurfaceField } from './surface-field';
import { compositionOf } from './region-field';
import { materialHash, materialMix } from './material-noise';
import { registerFormHighlight } from './material-response';

type Point = readonly [number, number];
type FormField = ReturnType<typeof sampleSurfaceField>;
interface FormColors { readonly dark: number; readonly mid: number; readonly light: number; readonly edge: number; readonly exposed: number }
interface FormSeat {
  readonly x: number; readonly y: number;
  readonly nx: number; readonly ny: number;
  readonly length: number; readonly breadth: number;
  readonly seed: number; readonly fragment: number;
  readonly field: FormField; readonly colors: FormColors;
}

function hash(value: number): number {
  let output = Math.imul(value ^ value >>> 16, 0x21f0aaad);
  output = Math.imul(output ^ output >>> 15, 0x735a2d97);
  return (output ^ output >>> 15) >>> 0;
}

/** u/v are fractions of the group's ground-plane footprint, not sprite height. */
function point(seat: FormSeat, u: number, v: number): Point {
  const bend = ((seat.seed >>> 16) % 101 - 50) / 700;
  const across = v * (.92 + ((seat.seed >>> 7) % 17) / 100 + u * bend) * (seat.seed & 2 ? -1 : 1);
  const along = u + bend * v * v * 3;
  return [seat.x + seat.nx * along * seat.length - seat.ny * across * seat.breadth,
    seat.y + seat.ny * along * seat.length + seat.nx * across * seat.breadth];
}

function polygon(raster: Raster, seat: FormSeat, points: readonly Point[], color: number): void {
  raster.polygon(points.map(([u, v]) => point(seat, u, v)), color);
}

function line(raster: Raster, seat: FormSeat, a: Point, b: Point, color: number, width = 1): void {
  const start = point(seat, a[0], a[1]), end = point(seat, b[0], b[1]);
  raster.line(start[0], start[1], end[0], end[1], color, width);
}

function formColors(sample: WorldSample, coated: boolean, accent: number): FormColors {
  const p = sample.profile.palette;
  // Keep each material's hue family even in strongly complementary recipes.
  const dark = coated ? p.materialDark : p.floorDeep;
  const mid = coated ? p.materialMid : p.floor;
  const light = coated ? p.materialLight : p.floorLight;
  return { dark, mid, light, edge: materialMix(light, p.peak, .06 + accent * .20),
    exposed: materialMix(p.floor, p.floorDeep, .22) };
}

/** Register only after the owning face is complete; later overpaint retires it. */
function highlight(sample: WorldSample, seat: FormSeat, u: number, v: number, turn: number, strength: number, sharpness: number): void {
  const at = point(seat, u, v);
  registerFormHighlight(sample, { x: at[0], y: at[1], width: 2, height: 2,
    normal: Math.atan2(seat.ny, seat.nx) + turn, color: seat.colors.edge, strength, sharpness });
}

/** Detached pieces share their parent's material, direction and broken end. */
function paintFragments(raster: Raster, sample: WorldSample, seat: FormSeat, material: WorldMaterial): void {
  const count = Math.floor(seat.fragment * (1 + seat.field.deposit * 6));
  const p = seat.colors;
  for (let i = 0; i < count; i++) {
    const value = hash(seat.seed ^ Math.imul(i + 1, 683));
    const u = .39 + (value % 100) / 550, v = ((value >>> 8) % 101 - 50) / 140;
    const half = .024 + (value >>> 16) % 9 / 420;
    const center = point(seat, u, v);
    if (!worldSupportAt(sample, center[0], center[1])) continue;
    const shape: readonly Point[] = material === 'crystal'
      ? [[u - half, v - half], [u + half * 1.8, v], [u + half * .25, v + half], [u - half, v + half * .4]]
      : [[u - half * 1.4, v - half], [u + half, v - half * .8], [u + half * 1.7, v + half * .4], [u - half, v + half]];
    polygon(raster, seat, shape, i % 2 ? p.mid : p.light);
    if (i < 2) line(raster, seat, shape[0]!, shape[1]!, p.edge);
  }
}

function paintStrata(raster: Raster, sample: WorldSample, seat: FormSeat): void {
  const p = seat.colors, split = seat.fragment;
  // Unequal sections share one low bed; their broken ends are cuts, not teeth.
  polygon(raster, seat, [[-.51, -.19], [-.30, -.43], [.08, -.39], [.45, -.25],
    [.51, .04], [.38, .34], [-.05, .42], [-.43, .26]], materialMix(p.mid, p.light, .09));
  const layers = 3 + seat.seed % 3, spacing = .72 / layers;
  for (let layer = 0; layer < layers; layer++) {
    const value = hash(seat.seed + layer * 191);
    const v = -.36 + layer * spacing;
    const side = Math.abs((layer + .5) / layers - .5);
    const left = -.47 + side * .24 + (value % 15) / 150;
    const right = .49 - side * .25 - ((value >>> 8) % 21) / 130;
    const cut = .018 + split * ((value >>> 17) % 15) / 160;
    const dip = ((value >>> 23) % 11 - 5) / 150;
    polygon(raster, seat, [[left, v + .025], [left + .12, v - .018],
      [right - .10, v + dip], [right, v + .04], [right - cut, v + spacing * .54],
      [right - .015, v + spacing], [left + .035, v + spacing + .015]],
    materialMix(p.mid, p.light, .09 + (layer % 3) * .085));
    // Seams cover part of each joint; the uninterrupted plane remains dominant.
    line(raster, seat, [left + .06, v + spacing], [left + .21, v + spacing + .005], materialMix(p.dark, p.mid, .46));
    line(raster, seat, [left + .16, v + .005], [right - .14, v + dip], materialMix(p.light, p.mid, .32));
    if (split + seat.field.wear > .62 && layer % 2 === 0) {
      const crack = -.05 + ((value >>> 16) % 19) / 120;
      line(raster, seat, [crack, v + spacing], [crack - .055, v + spacing * .48], p.mid);
      line(raster, seat, [crack - .055, v + spacing * .48], [crack - .025, v + .035], p.dark);
    }
  }
  if (split > .3) {
    polygon(raster, seat, [[.36, -.12], [.47, -.09], [.40, .025], [.31, -.005]], p.exposed);
    line(raster, seat, [.31, -.005], [.40, .025], p.light);
  }
  paintFragments(raster, sample, seat, 'strata');
}

function paintCrystal(raster: Raster, sample: WorldSample, seat: FormSeat): void {
  const p = seat.colors;
  // A broad common root carries uneven, truncated faces embedded in the floor.
  polygon(raster, seat, [[-.48, -.12], [-.29, -.34], [.08, -.29], [.29, .04],
    [.04, .34], [-.39, .25]], materialMix(p.mid, p.light, .13));
  const count = 2 + seat.seed % 3;
  for (let i = 0; i < count; i++) {
    const value = hash(seat.seed ^ (i + 1) * 7919);
    const main = i === count - 1;
    const start = -.42 + (value % 16) / 170;
    const end = main ? .44 + ((value >>> 6) % 10) / 110 : .12 + ((value >>> 6) % 20) / 110;
    const v = main ? -.02 : (i / Math.max(1, count - 2) - .5) * .39;
    const tip = v + (((value >>> 14) % 13) - 6) / 85;
    const breadth = main ? .19 : .105 + ((value >>> 19) % 7) / 130;
    const broken = (value % 100) / 100 < seat.fragment;
    const cut = broken ? .11 : .035;
    const rootUpper: Point = [start, v - breadth * .36];
    const rootLower: Point = [start + .025, v + breadth * .55];
    const upper: Point = [end - .18, tip - breadth];
    const lower: Point = [end - .14, tip + breadth * .74];
    const tipA: Point = [end, tip - cut];
    const tipB: Point = [end - .025, tip + cut];
    const ridge: Point = [start + .19, v + .015];
    polygon(raster, seat, [rootUpper, [start + .14, v - breadth * .74], upper, tipA,
      tipB, lower, rootLower], materialMix(p.mid, p.light, .10));
    polygon(raster, seat, [rootUpper, upper, tipA, ridge], materialMix(p.light, p.mid, main ? .28 : .46));
    polygon(raster, seat, [ridge, tipA, tipB, lower, rootLower], materialMix(p.mid, p.dark, .08));
    line(raster, seat, [start + .26, v + .014], [end - .08, tip - .02], p.light);
    if (broken) {
      polygon(raster, seat, [tipA, tipB, [tipB[0] - .04, tipB[1] - .006], [tipA[0] - .04, tipA[1] + .01]], materialMix(p.light, p.mid, .20));
    }
    // A short interrupted fault gives the plane a fracture without outlining it.
    if (main && seat.field.wear > .25) {
      line(raster, seat, [end - .22, tip - breadth * .7], [end - .18, tip - .03], p.mid);
      line(raster, seat, [end - .17, tip + .015], [end - .19, tip + breadth * .5], p.dark);
    }
  }
  line(raster, seat, [-.40, .14], [-.24, .19], materialMix(p.dark, p.mid, .45));
  paintFragments(raster, sample, seat, 'crystal');
  highlight(sample, seat, .12, -.11, -.45, .34, 5);
  highlight(sample, seat, -.12, -.15, .70, .21, 4);
}

function paintGlaze(raster: Raster, sample: WorldSample, seat: FormSeat): void {
  const p = seat.colors, split = seat.fragment;
  // An irregular sheet, with thickness gathered against only some margins.
  // Open overlapping planes replace nested rings and a repeated central icon.
  polygon(raster, seat, [[-.51, -.13], [-.37, -.39], [-.11, -.34], [.035, -.23],
    [.33, -.35], [.52, -.13], [.43, .19], [.18, .38], [-.12, .29], [-.45, .32]],
  materialMix(p.mid, p.light, .13));
  polygon(raster, seat, [[-.37, -.28], [-.13, -.29], [.025, -.17], [.31, -.29],
    [.40, -.14], [.21, -.07], [-.09, -.16], [-.32, -.11]], materialMix(p.mid, p.light, .25));
  polygon(raster, seat, [[-.34, .16], [-.14, .08], [.10, .17], [.30, .14],
    [.16, .31], [-.10, .24], [-.39, .27]], materialMix(p.mid, p.light, .19));
  line(raster, seat, [-.37, -.37], [-.17, -.33], materialMix(p.light, p.mid, .22));
  line(raster, seat, [-.42, .28], [-.27, .28], materialMix(p.dark, p.mid, .65));
  const choice = (seat.seed >>> 9) % 3;
  const peeled: readonly Point[] = choice === 0
    ? [[.35, -.30], [.50, -.14], [.39, -.07], [.34, -.15]]
    : choice === 1 ? [[.05, .31], [.20, .37], [.35, .25], [.19, .18], [.21, .27]]
      : [[-.49, .09], [-.43, .28], [-.24, .27], [-.31, .13], [-.39, .15]];
  // Peel size responds to fragmentation; a lip touches its parent sheet.
  const center = peeled.reduce<[number, number]>((sum, at) => [sum[0] + at[0] / peeled.length, sum[1] + at[1] / peeled.length], [0, 0]);
  const peelScale = .65 + split * .65;
  const cut = peeled.map(([u, v]) => [center[0] + (u - center[0]) * peelScale, center[1] + (v - center[1]) * peelScale] as const);
  polygon(raster, seat, cut, p.exposed);
  line(raster, seat, cut[2]!, cut[3]!, p.light);
  const cracks = 1 + Math.floor((split + seat.field.wear) * 2);
  for (let i = 0; i < cracks; i++) {
    const value = hash(seat.seed + i * 71);
    const u = -.24 + (value % 45) / 100, v = -.21 + ((value >>> 9) % 38) / 100;
    const end: Point = [u + .055 + split * .05, v + .07];
    line(raster, seat, [u - .08, v - .045], [u, v], p.mid);
    line(raster, seat, [u, v], end, materialMix(p.dark, p.mid, .28));
    if (split > .55) line(raster, seat, end, [end[0] + .04, end[1] - .02], p.mid);
  }
  paintFragments(raster, sample, seat, 'glaze');
  highlight(sample, seat, -.15, -.14, -.25, .085, 2);
  highlight(sample, seat, .10, .13, .30, .065, 2);
}

function supportedFootprint(sample: WorldSample, seat: FormSeat): boolean {
  // Support is an 8px grid. A connected center seats the form; a small outer
  // loss is allowed so the same material actually terminates at a void cut.
  const along = Math.max(2, Math.ceil(seat.length * 1.12 / 8));
  const across = Math.max(2, Math.ceil(seat.breadth / 8));
  let lost = 0;
  for (let j = 0; j <= across; j++) for (let i = 0; i <= along; i++) {
    const u = -.56 + i / along * 1.12, v = -.50 + j / across;
    const at = point(seat, u, v);
    if (worldSupportAt(sample, at[0], at[1])) continue;
    if (Math.abs(u) < .30 && Math.abs(v) < .27) return false;
    lost++;
  }
  return lost / ((along + 1) * (across + 1)) <= .12;
}

function paintLandBreaks(raster: Raster, sample: WorldSample, onFloor: (x: number, y: number) => boolean): void {
  const spec = sample.profile.surface, split = compositionOf(spec).fragmentation;
  for (let y = 0; y < raster.height; y++) for (let x = 0; x < raster.width; x++) {
    if (!onFloor(x, y)) continue;
    const atEdge = (radius: number): boolean => !onFloor(x + radius, y) || !onFloor(x - radius, y)
      || !onFloor(x, y + radius) || !onFloor(x, y - radius);
    if (!atEdge(3)) continue;
    const field = sampleSurfaceField(sample, x, y);
    const nx = Math.cos(field.direction), ny = Math.sin(field.direction);
    // Short correlated segments follow the material grain. Most shoreline is
    // left alone; this is a broken upper surface, never a continuous sidewall.
    const patch = materialHash(Math.floor((x * nx + y * ny) / 15),
      Math.floor((-x * ny + y * nx) / 9), (sample.materialSeed ?? sample.seed) ^ 0x3289);
    if (patch > (.15 + split * .24 + field.wear * .10) * (1 - field.quiet * .55)) continue;
    const depth = atEdge(1) ? 1 : atEdge(2) ? 2 : 3;
    const coated = field.coverage > .5, material = coated ? spec.coating : spec.substrate;
    const colors = formColors(sample, coated, 0);
    const index = (y * raster.width + x) * 4;
    const under = raster.rgba[index]! << 16 | raster.rgba[index + 1]! << 8 | raster.rgba[index + 2]!;
    if (depth === 1) {
      // Glaze can lose the skin at its margin; other materials expose a short
      // dark fracture. No peak/white palette entry is used at a missing edge.
      const broken = material === 'glaze' && field.wear + split > .65;
      raster.pixel(x, y, materialMix(under, broken ? colors.exposed : colors.dark, broken ? .44 : .23));
    } else if (depth === 2 || (material === 'glaze' && patch < .09)) {
      const cross = Math.abs(nx * (Number(!onFloor(x + 3, y)) - Number(!onFloor(x - 3, y)))
        + ny * (Number(!onFloor(x, y + 3)) - Number(!onFloor(x, y - 3))));
      if (cross > .25 || material === 'glaze') {
        raster.pixel(x, y, materialMix(under, colors.light, material === 'crystal' ? .22 : .14));
      }
    }
  }
}

export function paintMaterialForms(raster: Raster, sample: WorldSample, floorMask: Uint8Array): void {
  const { width, height } = raster, spec = sample.profile.surface;
  const onFloor = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height && floorMask[y * width + x] === 1;
  raster.setClip(onFloor);
  try {
    const composition = compositionOf(spec), formScale = composition.formScale;
    const stride = 88;
    const selected: FormSeat[] = [];
    for (let row = 0; row < height / stride; row++) for (let col = 0; col < width / stride; col++) {
      const x = (col + materialHash(col, row, (sample.materialSeed ?? sample.seed) ^ 0x6713)) * stride;
      const y = (row + materialHash(col, row, (sample.materialSeed ?? sample.seed) ^ 0x4371)) * stride;
      if (!worldSupportAt(sample, x, y)) continue;
      const field = sampleSurfaceField(sample, x, y);
      const chance = (.16 + spec.relief * .55) * field.activity * (1 - field.quiet * .88) * (1 + field.accent * .6);
      if (materialHash(col, row, (sample.materialSeed ?? sample.seed) ^ 0x9911) > chance) continue;
      const seed = hash((sample.materialSeed ?? sample.seed) ^ Math.imul(col, 8191) ^ Math.imul(row, 131071));
      const coated = field.coverage > .5, material = coated ? spec.coating : spec.substrate;
      let length = (88 + seed % 33) * formScale;
      let breadth = (52 + (seed >>> 9) % 25) * formScale;
      if (composition.organization === 'bands') { length *= 1.22; breadth *= .82; }
      else if (composition.organization === 'clusters') { length *= .94; breadth *= 1.14; }
      let seat: FormSeat = { x, y, nx: Math.cos(field.direction), ny: Math.sin(field.direction),
        length, breadth, seed, fragment: composition.fragmentation, field, colors: formColors(sample, coated, field.accent) };
      let fitted = supportedFootprint(sample, seat);
      for (let fit = 0; !fitted && fit < 2; fit++) {
        length *= .82; breadth *= .82;
        seat = { ...seat, length, breadth };
        fitted = supportedFootprint(sample, seat);
      }
      if (!fitted || selected.some(other => Math.hypot(other.x - x, other.y - y)
        < (Math.max(other.length, other.breadth) + Math.max(length, breadth)) * .34)) continue;
      selected.push(seat);
      if (material === 'strata') paintStrata(raster, sample, seat);
      else if (material === 'crystal') paintCrystal(raster, sample, seat);
      else paintGlaze(raster, sample, seat);
    }
    paintLandBreaks(raster, sample, onFloor);
  } finally {
    raster.setClip(null);
  }
}

/** Larger connected formations use the native face/cleavage/peel painters.
 * No emblem, nested ring or new flat drawing style is pasted onto the terrain. */
export function paintMaterialLandmarks(raster: Raster, sample: WorldSample): void {
  raster.setClip((x, y) => worldSupportAt(sample, x, y));
  try {
    const fragmentation = compositionOf(sample.profile.surface).fragmentation;
    for (const landmark of sample.scenery ?? []) {
      const material: WorldMaterial = landmark.kind === 'crystal-fan' ? 'crystal'
        : landmark.kind === 'glaze-basin' ? 'glaze' : 'strata';
      const nx = Math.cos(landmark.angle), ny = Math.sin(landmark.angle);
      // A dominant broken section and offset continuations; no symmetric wreath.
      const members = [
        {u:-.32,v:-.34,length:1.16,breadth:.65,turn:-.10},
        {u:.28,v:-.20,length:.88,breadth:.64,turn:.13},
        {u:-.12,v:.13,length:1.75,breadth:1.04,turn:0},
        {u:.44,v:.40,length:.60,breadth:.43,turn:-.23},
      ];
      for (const [index, member] of members.entries()) {
        const seed = hash(landmark.seed ^ Math.imul(index + 1, 1297));
        const variance = (seed % 101 - 50) / 700, angle = landmark.angle + member.turn + variance;
        const x = landmark.x + (nx * member.u - ny * member.v) * landmark.radius;
        const y = landmark.y + (ny * member.u + nx * member.v) * landmark.radius;
        if (!worldSupportAt(sample, x, y)) continue;
        const field = sampleSurfaceField(sample, x, y);
        const base = formColors(sample, true, .08);
        const seat: FormSeat = { x, y, nx: Math.cos(angle), ny: Math.sin(angle), seed,
          length: landmark.radius * member.length, breadth: landmark.radius * member.breadth,
          fragment: Math.max(0, Math.min(1, fragmentation + ((seed >>> 9) % 31 - 15) / 100)),
          field: { ...field, wear: Math.max(.35, field.wear), deposit: .4 + landmark.density * .45 },
          colors: { ...base, mid: materialMix(base.mid, base.dark, index === 2 ? .05 : .13),
            light: materialMix(base.light, base.mid, index === 2 ? .06 : .2) } };
        if (material === 'strata') paintStrata(raster, sample, seat);
        else if (material === 'crystal') paintCrystal(raster, sample, seat);
        else paintGlaze(raster, sample, seat);
      }
    }
  } finally { raster.setClip(null); }
}
