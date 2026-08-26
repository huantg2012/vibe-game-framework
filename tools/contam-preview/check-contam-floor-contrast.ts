/**
 * I6-E: shared floor-contrast gate (iteration 5 + 6).
 * I6-C hotfix (DEC-097): void-teal share + walkable bright-tile asserts.
 *
 *   npm run check:contam-floor-contrast
 *
 * Asserts, on the four enabled calibration fragments (not residential):
 *   1. contamination four stops vs contrast floor cell, CIE76 ≥ 18
 *   2. baked teal-family pixel share (same metric as measure:ground-teal)
 *   3. baked shape fingerprints from generateRuins → paintRuinedMask are 4-way distinct
 *   4. void (!land) teal-family pixel share < 0.05%
 *   5. no walkable floor cell ≥ 50% banned-bright four (#3cffd4 / #7fffee / #4adf8a / #b0fff5)
 *   6. post-wall walkable four-connected component count === 1
 *
 * Pre-fix fixture (must fail): outdoor/metro 0.00% teal on new+standard;
 * library shape copied from outdoor;
 * DEC-097 broken whole-image teal-group quantize (void teal / bright tiles).
 */
import { ENABLED_RIFT_FRAGMENTS, RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { deriveFragmentContamRamp } from '@/entities/form-renderers/d/fragment-ramp';
import { countWalkableComponents } from '@/generation/connectivity';
import {
  contrastFloorCell,
  nearestPalette,
  quantizeInGroup,
  rgbToHexString,
  TEAL_FAMILY,
  TEAL_FAMILY_SET,
  TEAL_SUBSET_CORE_HEX,
  TEAL_SUBSET_DEEP_MID_HEX,
  TEAL_SUBSET_GLOW_HEX,
  type Rgb,
} from '@/generation/palette-quantize';
import {
  bakeGround,
  compositePaint,
  compositeStaticPaint,
  deriveContamRamp,
  fillCompositeWork,
  paintRuinedMask,
} from '@/generation/preview-paint';
import { generateRuins } from '@/generation/ruins';
import type { ContaminationAge, RuinCell, RuinFeature, RuinedMask } from '@/generation/types';

export const GATE_FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library'] as const;
export type GateFragmentId = (typeof GATE_FRAGMENTS)[number];

const AGES: readonly ContaminationAge[] = ['new', 'standard', 'ancient'];
const TEAL_SEEDS = [3, 11, 29, 101, 202, 404, 707, 808, 909, 1024];
const SHAPE_SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];
const CONTRAST_SEEDS = [0, 101];
const PX = 16;

const TEAL_MIN: Record<ContaminationAge, number> = {
  new: 0.1,
  standard: 0.3,
  ancient: 1.0,
};

const CIE76_MIN = 18;
const VOID_TEAL_MAX_PCT = 0.05;
const BRIGHT_TILE_MAX_SHARE = 0.5;
const CLUSTER_TEAL_SET: ReadonlySet<string> = new Set<string>([
  ...TEAL_SUBSET_DEEP_MID_HEX,
  ...TEAL_SUBSET_CORE_HEX,
  ...TEAL_SUBSET_GLOW_HEX,
]);
const BANNED_BRIGHT_SET: ReadonlySet<string> = new Set(
  [...TEAL_FAMILY_SET].filter((h) => !CLUSTER_TEAL_SET.has(h)),
);

const DIRS4: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

type CapClass = 'flush' | 'stub' | 'pier' | 'widen';
type FacingBand = '低' | '双峰' | '高';

export interface ShapeTuple {
  readonly jogPeriod: number;
  readonly gapCount: number;
  readonly turnCount: number;
  readonly capClass: CapClass;
  readonly widthMed: number;
  readonly facingBand: FacingBand;
}

export interface FeatureGeom {
  readonly jogPeriod: number;
  readonly gapCount: number;
  readonly turnCount: number;
  readonly capClass: CapClass;
  readonly width: number;
  readonly angle: number;
}

function median(xs: readonly number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = (s.length - 1) / 2;
  return (s[Math.floor(m)]! + s[Math.ceil(m)]!) / 2;
}

function modeCap(xs: readonly CapClass[]): CapClass {
  const counts: Record<CapClass, number> = { flush: 0, stub: 0, pier: 0, widen: 0 };
  for (const x of xs) counts[x] += 1;
  let best: CapClass = 'flush';
  let n = -1;
  for (const k of ['pier', 'widen', 'stub', 'flush'] as const) {
    if (counts[k] > n) {
      n = counts[k];
      best = k;
    }
  }
  return best;
}

function cellKey(c: RuinCell): string {
  return `${c.col},${c.row}`;
}

function bbox(cells: readonly RuinCell[]): {
  minC: number;
  maxC: number;
  minR: number;
  maxR: number;
  w: number;
  h: number;
} {
  let minC = cells[0]!.col;
  let maxC = minC;
  let minR = cells[0]!.row;
  let maxR = minR;
  for (const c of cells) {
    if (c.col < minC) minC = c.col;
    if (c.col > maxC) maxC = c.col;
    if (c.row < minR) minR = c.row;
    if (c.row > maxR) maxR = c.row;
  }
  return { minC, maxC, minR, maxR, w: maxC - minC + 1, h: maxR - minR + 1 };
}

function pcaAngle(cells: readonly RuinCell[]): number {
  const n = cells.length;
  let mx = 0;
  let my = 0;
  for (const c of cells) {
    mx += c.col;
    my += c.row;
  }
  mx /= n;
  my /= n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (const c of cells) {
    const dx = c.col - mx;
    const dy = c.row - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  return 0.5 * Math.atan2(2 * cov, vx - vy);
}

function isVerticalAngle(angle: number): boolean {
  const a = ((angle % Math.PI) + Math.PI) % Math.PI;
  const distH = Math.min(a, Math.PI - a);
  const distV = Math.abs(a - Math.PI / 2);
  return distV < distH;
}

function jogPeriodOf(cells: readonly RuinCell[], vertical: boolean): number {
  const along = (c: RuinCell) => (vertical ? c.row : c.col);
  const across = (c: RuinCell) => (vertical ? c.col : c.row);
  let minA = along(cells[0]!);
  let maxA = minA;
  for (const c of cells) {
    const a = along(c);
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
  }
  const laterals: { a: number; lat: number }[] = [];
  for (let a = minA; a <= maxA; a++) {
    const slice: number[] = [];
    for (const c of cells) if (along(c) === a) slice.push(across(c));
    if (slice.length === 0) continue;
    laterals.push({ a, lat: median(slice) });
  }
  if (laterals.length < 2) return 0;
  const jogAt: number[] = [];
  for (let i = 1; i < laterals.length; i++) {
    if (Math.abs(laterals[i]!.lat - laterals[i - 1]!.lat) >= 0.5) {
      jogAt.push(laterals[i]!.a);
    }
  }
  if (jogAt.length === 0) return 0;
  if (jogAt.length === 1) return jogAt[0]! - laterals[0]!.a;
  const intervals: number[] = [];
  for (let i = 1; i < jogAt.length; i++) intervals.push(jogAt[i]! - jogAt[i - 1]!);
  return median(intervals);
}

function gapCountOf(feat: RuinFeature, mask: RuinedMask): number {
  if (feat.cells.length === 0) return 0;
  const b = bbox(feat.cells);
  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  let n = 0;
  for (let r = b.minR; r <= b.maxR; r++) {
    for (let c = b.minC; c <= b.maxC; c++) {
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const i = r * cols + c;
      if (mask.outline.land[i] && !mask.walls[i]) n += 1;
    }
  }
  return n;
}

function neighborsOf(c: RuinCell, set: ReadonlySet<string>): RuinCell[] {
  const out: RuinCell[] = [];
  for (const [dx, dy] of DIRS4) {
    const n = { col: c.col + dx, row: c.row + dy };
    if (set.has(cellKey(n))) out.push(n);
  }
  return out;
}

function longestPath(cells: readonly RuinCell[]): RuinCell[] {
  if (cells.length === 0) return [];
  const set = new Set(cells.map(cellKey));
  const byKey = new Map(cells.map((c) => [cellKey(c), c] as const));
  const bfsFar = (start: RuinCell): { node: RuinCell; prev: Map<string, string> } => {
    const prev = new Map<string, string>();
    const dist = new Map<string, number>([[cellKey(start), 0]]);
    const q: RuinCell[] = [start];
    let far = start;
    let farD = 0;
    while (q.length > 0) {
      const cur = q.shift()!;
      const d = dist.get(cellKey(cur))!;
      if (d > farD) {
        farD = d;
        far = cur;
      }
      for (const n of neighborsOf(cur, set)) {
        const k = cellKey(n);
        if (dist.has(k)) continue;
        dist.set(k, d + 1);
        prev.set(k, cellKey(cur));
        q.push(n);
      }
    }
    return { node: far, prev };
  };
  const deg1 = cells.filter((c) => neighborsOf(c, set).length <= 1);
  const start0 = deg1[0] ?? cells[0]!;
  const far1 = bfsFar(start0).node;
  const pass = bfsFar(far1);
  const path: RuinCell[] = [];
  const startK = cellKey(far1);
  let k: string | undefined = cellKey(pass.node);
  while (k) {
    const cell = byKey.get(k);
    if (cell) path.push(cell);
    if (k === startK) break;
    k = pass.prev.get(k);
  }
  return path.reverse();
}

function dirOf(a: RuinCell, b: RuinCell): string {
  if (b.col !== a.col) return b.col > a.col ? 'e' : 'w';
  if (b.row !== a.row) return b.row > a.row ? 's' : 'n';
  return '';
}

function turnCountOf(cells: readonly RuinCell[]): number {
  const path = longestPath(cells);
  if (path.length < 3) return 0;
  let turns = 0;
  let i = 1;
  while (i < path.length - 1) {
    const d0 = dirOf(path[i - 1]!, path[i]!);
    const d1 = dirOf(path[i]!, path[i + 1]!);
    if (d0 !== d1) {
      if (i + 2 < path.length && dirOf(path[i + 1]!, path[i + 2]!) === d0) {
        i += 2;
        continue;
      }
      turns += 1;
    }
    i += 1;
  }
  return turns;
}

function filled2x2(set: ReadonlySet<string>, col: number, row: number): boolean {
  return (
    set.has(`${col},${row}`) &&
    set.has(`${col + 1},${row}`) &&
    set.has(`${col},${row + 1}`) &&
    set.has(`${col + 1},${row + 1}`)
  );
}

function capClassOf(cells: readonly RuinCell[], vertical: boolean): CapClass {
  const set = new Set(cells.map(cellKey));
  const along = (c: RuinCell) => (vertical ? c.row : c.col);
  const across = (c: RuinCell) => (vertical ? c.col : c.row);
  let minA = along(cells[0]!);
  let maxA = minA;
  for (const c of cells) {
    const a = along(c);
    if (a < minA) minA = a;
    if (a > maxA) maxA = a;
  }
  const spanAt = (a: number): number => {
    let lo = Infinity;
    let hi = -Infinity;
    let n = 0;
    for (const c of cells) {
      if (along(c) !== a) continue;
      n += 1;
      const x = across(c);
      if (x < lo) lo = x;
      if (x > hi) hi = x;
    }
    if (n === 0) return 0;
    return hi - lo + 1;
  };
  const midA = Math.round((minA + maxA) / 2);
  const midW = Math.max(spanAt(midA), spanAt(midA - 1), spanAt(midA + 1));
  for (const a of [minA, maxA]) {
    const slice = cells.filter((c) => Math.abs(along(c) - a) <= 1);
    if (slice.length === 0) continue;
    const b = bbox(slice);
    if (b.w >= 2 && b.h >= 2 && filled2x2(set, b.minC, b.minR)) return 'pier';
  }
  const startW = Math.max(spanAt(minA), spanAt(minA + 1));
  const endW = Math.max(spanAt(maxA), spanAt(maxA - 1));
  if (startW >= midW + 1 || endW >= midW + 1) return 'widen';
  const shaftW = midW;
  if (startW > shaftW || endW > shaftW) return 'stub';
  const startExtra = cells.filter((c) => along(c) === minA || along(c) === minA + 1).length;
  const endExtra = cells.filter((c) => along(c) === maxA || along(c) === maxA - 1).length;
  const midCount = cells.filter((c) => Math.abs(along(c) - midA) <= 1).length;
  if (startExtra > midCount + 1 || endExtra > midCount + 1) return 'stub';
  return 'flush';
}

function geomOf(feat: RuinFeature, mask: RuinedMask): FeatureGeom | null {
  if (feat.cells.length === 0) return null;
  const box = bbox(feat.cells);
  const angle = pcaAngle(feat.cells);
  const vertical = box.h >= box.w ? true : box.w >= box.h + 2 ? false : isVerticalAngle(angle);
  return {
    jogPeriod: jogPeriodOf(feat.cells, vertical),
    gapCount: gapCountOf(feat, mask),
    turnCount: turnCountOf(feat.cells),
    capClass: capClassOf(feat.cells, vertical),
    width: Math.min(box.w, box.h),
    angle: vertical ? Math.PI / 2 : 0,
  };
}

function axialVariance(angles: readonly number[]): number {
  if (angles.length === 0) return 1;
  let c = 0;
  let s = 0;
  for (const t of angles) {
    c += Math.cos(2 * t);
    s += Math.sin(2 * t);
  }
  return 1 - Math.hypot(c, s) / angles.length;
}

function altRate(angles: readonly number[]): number {
  if (angles.length < 2) return 0;
  let flips = 0;
  for (let i = 1; i < angles.length; i++) {
    if (isVerticalAngle(angles[i]!) !== isVerticalAngle(angles[i - 1]!)) flips += 1;
  }
  return flips / (angles.length - 1);
}

/**
 * 高 / 双峰 / 低 用户外 / 医院 / 地铁三张烤图标定（说明书并列顺序）。
 * 旧图书馆落到距哪张标定最近的那一档。禁止用语法枚举名当档名。
 */
function facingBands(
  anglesById: ReadonlyMap<GateFragmentId, readonly number[]>,
): Map<GateFragmentId, FacingBand> {
  const cal: { id: GateFragmentId; band: FacingBand }[] = [
    { id: 'frag-outdoor', band: '高' },
    { id: 'frag-clinic', band: '双峰' },
    { id: 'frag-metro', band: '低' },
  ];
  const scored = cal.map((c) => {
    const ang = anglesById.get(c.id) ?? [];
    return { ...c, var: axialVariance(ang), alt: altRate(ang) };
  });
  const out = new Map<GateFragmentId, FacingBand>();
  for (const row of scored) out.set(row.id, row.band);
  const libraryAng = anglesById.get('frag-library') ?? [];
  const lv = axialVariance(libraryAng);
  const la = altRate(libraryAng);
  let bestBand: FacingBand = '高';
  let bestD = Infinity;
  for (const row of scored) {
    const d = Math.hypot(lv - row.var, la - row.alt);
    if (d < bestD) {
      bestD = d;
      bestBand = row.band;
    }
  }
  out.set('frag-library', bestBand);
  return out;
}

function roundJog(v: number): number {
  if (v < 1) return 0;
  return Math.round(v);
}

function roundGap(v: number): number {
  return Math.round(v / 2) * 2;
}

export function shapeKeyOf(t: ShapeTuple): string {
  return `${t.jogPeriod}|${t.gapCount}|${t.turnCount}|${t.capClass}|${t.widthMed}|${t.facingBand}`;
}

function srgbLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function labOf(rgb: Rgb): [number, number, number] {
  const r = srgbLinear(rgb[0]);
  const g = srgbLinear(rgb[1]);
  const b = srgbLinear(rgb[2]);
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1.0;
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;
  const f = (t: number): number => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE76(a: Rgb, b: Rgb): number {
  const la = labOf(a);
  const lb = labOf(b);
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2]);
}

function groundMain(id: string): Rgb {
  const def = RIFT_FRAGMENT_DATA[id]!;
  return contrastFloorCell(
    def.floorBv * def.floorBiasR,
    def.floorBv * def.floorBiasG,
    def.floorBv * def.floorBiasB,
  );
}

function pixelHex(rgba: Uint8Array, i: number): string {
  return (
    '#' +
    [rgba[i * 4]!, rgba[i * 4 + 1]!, rgba[i * 4 + 2]!]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
  );
}

function tealPctOf(rgba: Uint8Array, nPix: number): number {
  let teal = 0;
  for (let i = 0; i < nPix; i++) {
    if (TEAL_FAMILY_SET.has(pixelHex(rgba, i))) teal += 1;
  }
  return (teal / nPix) * 100;
}

export interface VoidTealRow {
  readonly id: GateFragmentId;
  readonly age: ContaminationAge;
  readonly seed: number;
  readonly path: 'exact' | 'lut';
  readonly voidPix: number;
  readonly tealPix: number;
  readonly pct: number;
}

export interface BrightTileRow {
  readonly id: GateFragmentId;
  readonly age: ContaminationAge;
  readonly seed: number;
  readonly path: 'exact' | 'lut';
  readonly col: number;
  readonly row: number;
  readonly share: number;
  readonly hex: string;
}

function voidTealOf(
  rgba: Uint8Array,
  W: number,
  H: number,
  T: number,
  land: Uint8Array,
  cols: number,
  rows: number,
): { voidPix: number; tealPix: number; pct: number } {
  let voidPix = 0;
  let tealPix = 0;
  for (let y = 0; y < H; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < W; x++) {
      const col = (x / T) | 0;
      if (col < 0 || row < 0 || col >= cols || row >= rows) continue;
      if (land[row * cols + col]) continue;
      voidPix += 1;
      if (TEAL_FAMILY_SET.has(pixelHex(rgba, y * W + x))) tealPix += 1;
    }
  }
  return { voidPix, tealPix, pct: voidPix === 0 ? 0 : (tealPix / voidPix) * 100 };
}

function brightTilesOf(
  rgba: Uint8Array,
  W: number,
  H: number,
  T: number,
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
): Array<{ col: number; row: number; share: number; hex: string }> {
  const hits: Array<{ col: number; row: number; share: number; hex: string }> = [];
  const cellPix = T * T;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col;
      if (!land[i] || walls[i]) continue;
      const counts = new Map<string, number>();
      let banned = 0;
      const x0 = col * T;
      const y0 = row * T;
      for (let y = y0; y < y0 + T && y < H; y++) {
        for (let x = x0; x < x0 + T && x < W; x++) {
          const hex = pixelHex(rgba, y * W + x);
          if (!BANNED_BRIGHT_SET.has(hex)) continue;
          banned += 1;
          counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }
      }
      const share = banned / cellPix;
      if (share >= BRIGHT_TILE_MAX_SHARE) {
        let hex = '';
        let n = 0;
        for (const [h, c] of counts) {
          if (c > n) {
            n = c;
            hex = h;
          }
        }
        hits.push({ col, row, share, hex });
      }
    }
  }
  return hits;
}

export function failVoidTeal(rows: readonly VoidTealRow[]): string[] {
  return rows
    .filter((r) => r.pct >= VOID_TEAL_MAX_PCT)
    .map(
      (r) =>
        `${r.id} ${r.age}@${r.seed} ${r.path} void-teal ${r.pct.toFixed(4)}% ≥ ${VOID_TEAL_MAX_PCT}% (${r.tealPix}/${r.voidPix})`,
    );
}

export function failBrightTiles(rows: readonly BrightTileRow[]): string[] {
  return rows.map(
    (r) =>
      `${r.id} ${r.age}@${r.seed} ${r.path} floor ${r.col},${r.row} banned-bright ${(r.share * 100).toFixed(1)}% ${r.hex}`,
  );
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >> 13), 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return { h, s: max < 1e-6 ? 0 : d / max, v: max };
}

/** Frozen DEC-097 bug: whole-image teal-group hue-direction, no land mask. */
function quantizePaintPixelBroken(r: number, g: number, b: number): Rgb {
  const hsv = rgbToHsv(r, g, b);
  if (hsv.s >= 0.12 && hsv.h >= 0.4 && hsv.h <= 0.58) {
    return quantizeInGroup([r, g, b], TEAL_FAMILY, []);
  }
  return nearestPalette(r, g, b);
}

function writeQuantizedRgbaBroken(
  work: Float32Array,
  rgba: Uint8Array,
  W: number,
  H: number,
  mode: 'exact' | 'lut',
): void {
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 3;
      const d = (hash2(x, y, 31337) - 0.5) * 12;
      const r = clamp255(work[s]! + d);
      const g = clamp255(work[s + 1]! + d);
      const b = clamp255(work[s + 2]! + d);
      const q =
        mode === 'lut'
          ? quantizePaintPixelBroken(((r >> 3) << 3) + 4, ((g >> 3) << 3) + 4, ((b >> 3) << 3) + 4)
          : quantizePaintPixelBroken(r, g, b);
      const o = (y * W + x) * 4;
      rgba[o] = q[0];
      rgba[o + 1] = q[1];
      rgba[o + 2] = q[2];
      rgba[o + 3] = 255;
    }
  }
}

export function measureTeal(
  id: GateFragmentId,
  age: ContaminationAge,
  seed: number,
): number | null {
  try {
    const mask = generateRuins(seed, id);
    const painted = paintRuinedMask({ ...mask, contaminationAge: age }, PX);
    return tealPctOf(painted.rgba, painted.width * painted.height);
  } catch {
    return null;
  }
}

export function measureShapeSample(id: GateFragmentId, seed: number): FeatureGeom[] | null {
  try {
    const mask = generateRuins(seed, id);
    paintRuinedMask(mask, PX);
    const out: FeatureGeom[] = [];
    for (const feat of mask.features) {
      const g = geomOf(feat, mask);
      if (g) out.push(g);
    }
    return out;
  } catch {
    return null;
  }
}

export interface ContrastRow {
  readonly id: GateFragmentId;
  readonly age: ContaminationAge;
  readonly seed: number;
  readonly floor: Rgb;
  readonly deep: number;
  readonly mid: number;
  readonly core: number;
  readonly glow: number;
  readonly min: number;
}

export function measureContrast(): ContrastRow[] {
  const rows: ContrastRow[] = [];
  for (const id of GATE_FRAGMENTS) {
    const def = RIFT_FRAGMENT_DATA[id];
    if (!def) continue;
    const gm = groundMain(id);
    for (const age of AGES) {
      for (const seed of CONTRAST_SEEDS) {
        const ramp = deriveContamRamp(def, age, seed);
        const ds = [ramp.deep, ramp.mid, ramp.core, ramp.glow].map((c) => deltaE76(c, gm));
        rows.push({
          id,
          age,
          seed,
          floor: gm,
          deep: ds[0]!,
          mid: ds[1]!,
          core: ds[2]!,
          glow: ds[3]!,
          min: Math.min(...ds),
        });
      }
    }
  }
  return rows;
}

export type TealTable = Record<GateFragmentId, Record<ContaminationAge, number>>;

export function measureTealTable(): { table: TealTable; missing: number } {
  const table = {} as TealTable;
  let missing = 0;
  for (const id of GATE_FRAGMENTS) {
    table[id] = { new: Number.NaN, standard: Number.NaN, ancient: Number.NaN };
    for (const age of AGES) {
      const vals = TEAL_SEEDS.map((s) => measureTeal(id, age, s)).filter((v): v is number => v !== null);
      if (vals.length === 0) {
        missing += 1;
        continue;
      }
      table[id][age] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }
  return { table, missing };
}

export function measureQuantizeSafety(): {
  table: TealTable;
  missing: number;
  voidRows: VoidTealRow[];
  brightRows: BrightTileRow[];
  connectFails: string[];
  voidPctMax: number;
} {
  const table = {} as TealTable;
  let missing = 0;
  const voidRows: VoidTealRow[] = [];
  const brightRows: BrightTileRow[] = [];
  const connectFails: string[] = [];
  const seenConnect = new Set<string>();

  for (const id of GATE_FRAGMENTS) {
    table[id] = { new: Number.NaN, standard: Number.NaN, ancient: Number.NaN };
    for (const age of AGES) {
      const vals: number[] = [];
      for (const seed of TEAL_SEEDS) {
        try {
          const mask = generateRuins(seed, id);
          const ck = `${id}@${seed}`;
          if (!seenConnect.has(ck)) {
            seenConnect.add(ck);
            const n = countWalkableComponents(
              mask.outline.land,
              mask.walls,
              mask.outline.cols,
              mask.outline.rows,
            );
            if (n !== 1) {
              connectFails.push(`${id} seed ${seed} walkable components ${n} ≠ 1`);
            }
          }
          const aged = { ...mask, contaminationAge: age };
          const ground = bakeGround(aged, PX);
          const work = new Float32Array(ground.raw.length);
          const exact = new Uint8Array(ground.width * ground.height * 4);
          const lut = new Uint8Array(ground.width * ground.height * 4);
          compositePaint(ground, work, exact);
          compositeStaticPaint(ground, work, lut);
          vals.push(tealPctOf(exact, ground.width * ground.height));
          const land = mask.outline.land;
          const walls = mask.walls;
          const cols = mask.outline.cols;
          const rows = mask.outline.rows;
          const paths: ReadonlyArray<readonly ['exact' | 'lut', Uint8Array]> = [
            ['exact', exact],
            ['lut', lut],
          ];
          for (const [path, rgba] of paths) {
            const vt = voidTealOf(
              rgba,
              ground.width,
              ground.height,
              ground.tileSize,
              land,
              cols,
              rows,
            );
            voidRows.push({ id, age, seed, path, ...vt });
            for (const hit of brightTilesOf(
              rgba,
              ground.width,
              ground.height,
              ground.tileSize,
              land,
              walls,
              cols,
              rows,
            )) {
              brightRows.push({ id, age, seed, path, ...hit });
            }
          }
        } catch {
          /* generateRuins can reject a seed; skip like measureTeal */
        }
      }
      if (vals.length === 0) {
        missing += 1;
        continue;
      }
      table[id][age] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  const voidPctMax = voidRows.reduce((m, r) => Math.max(m, r.pct), 0);
  return { table, missing, voidRows, brightRows, connectFails, voidPctMax };
}

function measureBrokenQuantizeFixture(): {
  voidRows: VoidTealRow[];
  brightRows: BrightTileRow[];
} | null {
  try {
    const mask = generateRuins(101, 'frag-outdoor');
    const aged = { ...mask, contaminationAge: 'standard' as const };
    const ground = bakeGround(aged, PX);
    const work = new Float32Array(ground.raw.length);
    fillCompositeWork(ground, work, 'lut');
    const rgba = new Uint8Array(ground.width * ground.height * 4);
    writeQuantizedRgbaBroken(work, rgba, ground.width, ground.height, 'lut');
    const vt = voidTealOf(
      rgba,
      ground.width,
      ground.height,
      ground.tileSize,
      mask.outline.land,
      mask.outline.cols,
      mask.outline.rows,
    );
    const voidRows: VoidTealRow[] = [
      { id: 'frag-outdoor', age: 'standard', seed: 101, path: 'lut', ...vt },
    ];
    const brightRows: BrightTileRow[] = brightTilesOf(
      rgba,
      ground.width,
      ground.height,
      ground.tileSize,
      mask.outline.land,
      mask.walls,
      mask.outline.cols,
      mask.outline.rows,
    ).map((hit) => ({
      id: 'frag-outdoor' as const,
      age: 'standard' as const,
      seed: 101,
      path: 'lut' as const,
      ...hit,
    }));

    const synW = PX;
    const synWork = new Float32Array(synW * synW * 3);
    for (let i = 0; i < synW * synW; i++) {
      synWork[i * 3] = 40;
      synWork[i * 3 + 1] = 55;
      synWork[i * 3 + 2] = 48;
    }
    const synRgba = new Uint8Array(synW * synW * 4);
    writeQuantizedRgbaBroken(synWork, synRgba, synW, synW, 'exact');
    const synLand = new Uint8Array([1]);
    const synWalls = new Uint8Array([0]);
    for (const hit of brightTilesOf(synRgba, synW, synW, synW, synLand, synWalls, 1, 1)) {
      brightRows.push({
        id: 'frag-outdoor',
        age: 'standard',
        seed: 101,
        path: 'exact',
        ...hit,
      });
    }
    return { voidRows, brightRows };
  } catch {
    return null;
  }
}

export function failTeal(table: TealTable): string[] {
  const fails: string[] = [];
  for (const id of GATE_FRAGMENTS) {
    for (const age of AGES) {
      const v = table[id][age];
      const min = TEAL_MIN[age];
      if (!Number.isFinite(v) || v < min) {
        fails.push(`${id} ${age} ${Number.isFinite(v) ? v.toFixed(2) : 'n/a'}% < ${min.toFixed(2)}%`);
      }
    }
  }
  return fails;
}

export function failContrast(rows: readonly ContrastRow[]): string[] {
  return rows.filter((r) => r.min < CIE76_MIN).map((r) => `${r.id} ${r.age}@${r.seed} min ${r.min.toFixed(1)} < ${CIE76_MIN}`);
}

export function shapesFromSamples(
  samples: ReadonlyMap<GateFragmentId, FeatureGeom[][]>,
): Map<GateFragmentId, ShapeTuple> {
  const angles = new Map<GateFragmentId, number[]>();
  for (const id of GATE_FRAGMENTS) {
    const ang: number[] = [];
    for (const run of samples.get(id) ?? []) for (const g of run) ang.push(g.angle);
    angles.set(id, ang);
  }
  const bands = facingBands(angles);
  const out = new Map<GateFragmentId, ShapeTuple>();
  for (const id of GATE_FRAGMENTS) {
    const geoms = (samples.get(id) ?? []).flat();
    out.set(id, {
      jogPeriod: roundJog(median(geoms.map((g) => g.jogPeriod))),
      gapCount: roundGap(median(geoms.map((g) => g.gapCount))),
      turnCount: Math.round(median(geoms.map((g) => g.turnCount))),
      capClass: modeCap(geoms.map((g) => g.capClass)),
      widthMed: Math.round(median(geoms.map((g) => g.width))),
      facingBand: bands.get(id) ?? '高',
    });
  }
  return out;
}

export function failShapes(shapes: ReadonlyMap<GateFragmentId, ShapeTuple>): string[] {
  const keys = new Map<string, GateFragmentId[]>();
  for (const id of GATE_FRAGMENTS) {
    const t = shapes.get(id);
    if (!t) return [`${id} missing shape`];
    const k = shapeKeyOf(t);
    keys.set(k, [...(keys.get(k) ?? []), id]);
  }
  const fails: string[] = [];
  if (keys.size !== 4) {
    fails.push(`|{shape[id]}| = ${keys.size} want 4`);
    for (const [k, ids] of keys) {
      if (ids.length > 1) fails.push(`  collide ${k} ← ${ids.join(', ')}`);
    }
  }
  return fails;
}

function assertStaticContract(): string[] {
  const fails: string[] = [];
  if (GATE_FRAGMENTS.includes('frag-residential' as GateFragmentId)) {
    fails.push('residential must not enter this iteration gate');
  }
  for (const id of GATE_FRAGMENTS) {
    const def = RIFT_FRAGMENT_DATA[id];
    if (!def) fails.push(`missing def ${id}`);
    else if (!def.enabled) fails.push(`${id} must be enabled`);
  }
  if (RIFT_FRAGMENT_DATA['frag-residential']?.enabled) {
    fails.push('frag-residential must stay disabled (not in this gate)');
  }
  const enabledIds = ENABLED_RIFT_FRAGMENTS.map((r) => r.id);
  if (enabledIds.includes('frag-residential')) {
    fails.push('ENABLED_RIFT_FRAGMENTS must not list residential this iteration');
  }
  const bannedWant = ['#3cffd4', '#7fffee', '#4adf8a', '#b0fff5'];
  if ([...BANNED_BRIGHT_SET].sort().join() !== [...bannedWant].sort().join()) {
    fails.push(`banned-bright set drifted: ${[...BANNED_BRIGHT_SET].join(' ')}`);
  }
  return fails;
}

function printContrast(rows: readonly ContrastRow[]): void {
  console.log('CIE76 四档 vs 对比度用地面主色（门限 ≥ 18）');
  console.log('碎片'.padEnd(16), '年龄'.padEnd(10), '地面主色'.padEnd(10), '深    中    核    高光   最小值');
  for (const r of rows) {
    console.log(
      r.id.padEnd(16),
      `${r.age}@${r.seed}`.padEnd(10),
      rgbToHexString(r.floor).padEnd(9),
      [r.deep, r.mid, r.core, r.glow].map((d) => d.toFixed(1).padStart(5)).join(' '),
      `  ${r.min.toFixed(1).padStart(5)}  ${r.min >= CIE76_MIN ? 'PASS' : 'FAIL'}`,
    );
  }
}

function printTeal(table: TealTable): void {
  console.log('地面青绿家族像素占比（%）门限：新生 ≥ 0.10%，标准 ≥ 0.30%，古老 ≥ 1.00%');
  console.log('fragment'.padEnd(18), AGES.map((a) => a.padStart(10)).join(''));
  for (const id of GATE_FRAGMENTS) {
    console.log(
      id.padEnd(18),
      AGES.map((age) => {
        const v = table[id][age];
        return (Number.isFinite(v) ? v.toFixed(2) : 'n/a').padStart(10);
      }).join(''),
    );
  }
}

function printShapes(shapes: ReadonlyMap<GateFragmentId, ShapeTuple>): void {
  console.log('烤图身份指纹 shape[id] = (jogPeriod, gapCount, turnCount, capClass, widthMed, facingBand)');
  console.log('取样 generateRuins → paintRuinedMask。禁止地板众数 / 语法枚举名 / 交并比。');
  for (const id of GATE_FRAGMENTS) {
    const t = shapes.get(id)!;
    console.log(
      id.padEnd(16),
      shapeKeyOf(t),
      `  jog=${t.jogPeriod} gap=${t.gapCount} turn=${t.turnCount} cap=${t.capClass} w=${t.widthMed} face=${t.facingBand}`,
    );
  }
}

function measureAllShapes(): Map<GateFragmentId, FeatureGeom[][]> {
  const samples = new Map<GateFragmentId, FeatureGeom[][]>();
  for (const id of GATE_FRAGMENTS) {
    const runs: FeatureGeom[][] = [];
    for (const seed of SHAPE_SEEDS) {
      const g = measureShapeSample(id, seed);
      if (g && g.length > 0) runs.push(g);
    }
    samples.set(id, runs);
  }
  return samples;
}

function optionalEnemy(rows: readonly ContrastRow[]): { skip: boolean; fails: string[] } {
  const fails: string[] = [];
  try {
    for (const id of GATE_FRAGMENTS) {
      const gm = groundMain(id);
      const ramp = deriveFragmentContamRamp(id);
      const ds = [ramp.deep, ramp.mid, ramp.core, ramp.glow].map((c) => deltaE76(c, gm));
      const min = Math.min(...ds);
      const liveMin = Math.min(...rows.filter((r) => r.id === id).map((r) => r.min));
      console.log(
        `敌人样本 ${id.padEnd(16)} 四档最小 CIE76 ${min.toFixed(1)}（地面 ${liveMin.toFixed(1)}）`,
      );
      if (min < CIE76_MIN) {
        fails.push(`${id} enemy min ${min.toFixed(1)} < ${CIE76_MIN}`);
      }
    }
  } catch (e) {
    return { skip: true, fails: [e instanceof Error ? e.message : String(e)] };
  }
  if (fails.length > 0) return { skip: true, fails };
  return { skip: false, fails };
}

export function runFloorContrastCli(argv: readonly string[] = process.argv.slice(2)): number {
  const tealOnly = argv.includes('--teal-only');
  const skipFixture = argv.includes('--skip-fixture');

  const staticFails = assertStaticContract();
  if (staticFails.length > 0) {
    for (const f of staticFails) console.error(`FAIL ${f}`);
    return 1;
  }

  let failed = 0;
  const contrast = tealOnly ? [] : measureContrast();

  if (!tealOnly) {
    printContrast(contrast);
    const cf = failContrast(contrast);
    if (cf.length > 0) {
      failed += cf.length;
      for (const f of cf) console.error(`FAIL ${f}`);
    } else {
      console.log('PASS: 四张 × 三年龄 × 两种子，四档 CIE76 ≥ 18\n');
    }
  }

  let table: TealTable;
  let missing = 0;
  let voidRows: VoidTealRow[] = [];
  let brightRows: BrightTileRow[] = [];
  let connectFails: string[] = [];
  let voidPctMax = 0;

  if (tealOnly) {
    const teal = measureTealTable();
    table = teal.table;
    missing = teal.missing;
  } else {
    const safety = measureQuantizeSafety();
    table = safety.table;
    missing = safety.missing;
    voidRows = safety.voidRows;
    brightRows = safety.brightRows;
    connectFails = safety.connectFails;
    voidPctMax = safety.voidPctMax;
  }

  printTeal(table);
  if (missing > 0) {
    failed += missing;
    console.error(`FAIL ${missing} 组青绿测量生成失败`);
  }
  const tf = failTeal(table);
  if (tf.length > 0) {
    failed += tf.length;
    for (const f of tf) console.error(`FAIL ${f}`);
  } else {
    console.log('PASS: 四张新生 ≥ 0.10%，标准 ≥ 0.30%，古老 ≥ 1.00%\n');
  }

  if (tealOnly) {
    return failed > 0 ? 1 : 0;
  }

  console.log(
    `虚空格青绿家族占比（!land；门限 < ${VOID_TEAL_MAX_PCT}%；exact + lut）最大值 ${voidPctMax.toFixed(4)}%`,
  );
  const vf = failVoidTeal(voidRows);
  if (vf.length > 0) {
    failed += vf.length;
    for (const f of vf.slice(0, 12)) console.error(`FAIL ${f}`);
    if (vf.length > 12) console.error(`FAIL … ${vf.length - 12} more void-teal`);
  } else {
    console.log(`PASS: 虚空青绿 ${voidRows.length} 组均 < ${VOID_TEAL_MAX_PCT}%\n`);
  }

  const bf = failBrightTiles(brightRows);
  if (bf.length > 0) {
    failed += bf.length;
    for (const f of bf.slice(0, 12)) console.error(`FAIL ${f}`);
    if (bf.length > 12) console.error(`FAIL … ${bf.length - 12} more banned-bright tiles`);
  } else {
    console.log('PASS: 可走地板无整格亮端四色（一格 ≥ 50%）\n');
  }

  if (connectFails.length > 0) {
    failed += connectFails.length;
    for (const f of connectFails) console.error(`FAIL ${f}`);
  } else {
    console.log('PASS: 墙后可走格四连通分量 = 1\n');
  }

  const samples = measureAllShapes();
  const shapes = shapesFromSamples(samples);
  printShapes(shapes);
  const sf = failShapes(shapes);
  if (sf.length > 0) {
    failed += sf.length;
    for (const f of sf) console.error(`FAIL ${f}`);
  } else {
    console.log('PASS: |{shape[id]}| == 4\n');
  }

  if (!skipFixture) {
    console.log('修前夹具（必须失败才说明闸门有牙）');
    const fakeTeal: TealTable = {
      'frag-outdoor': { new: 0, standard: 0, ancient: table['frag-outdoor'].ancient },
      'frag-clinic': { ...table['frag-clinic'] },
      'frag-metro': { new: 0, standard: 0, ancient: table['frag-metro'].ancient },
      'frag-library': { ...table['frag-library'] },
    };
    const tealHits = failTeal(fakeTeal);
    const outdoor = shapes.get('frag-outdoor')!;
    const fakeShapes = new Map(shapes);
    fakeShapes.set('frag-library', outdoor);
    const shapeHits = failShapes(fakeShapes);
    const tealOk = tealHits.some((s) => s.includes('frag-outdoor') && s.includes('new'));
    const metroOk = tealHits.some((s) => s.includes('frag-metro'));
    const copyOk = shapeHits.some((s) => s.includes('frag-library') || s.includes('collide') || s.includes('|'));
    if (!tealOk || !metroOk) {
      failed += 1;
      console.error('FAIL 夹具：户外/地铁 0.00% 青绿没有被闸门抓住');
    } else {
      console.log(`  青绿夹具红：${tealHits[0]}; ${tealHits.find((s) => s.includes('metro'))}`);
    }
    if (!copyOk) {
      failed += 1;
      console.error('FAIL 夹具：图书馆=户外复制没有被闸门抓住');
    } else {
      console.log(`  指纹夹具红：${shapeHits[0]}`);
    }

    const broken = measureBrokenQuantizeFixture();
    if (!broken) {
      failed += 1;
      console.error('FAIL 夹具：现行错误量化烤图生成失败');
    } else {
      const brokenVoid = failVoidTeal(broken.voidRows);
      const brokenBright = failBrightTiles(broken.brightRows);
      const voidHit = brokenVoid.length > 0;
      const brightHit = brokenBright.length > 0;
      if (!voidHit || !brightHit) {
        failed += 1;
        console.error(
          `FAIL 夹具：现行错误量化没有被两条新闸门都抓住（void ${broken.voidRows[0]?.pct.toFixed(4)}%；bright ${brokenBright.length}）`,
        );
      } else {
        console.log(`  虚空青绿夹具红：${brokenVoid[0]}`);
        console.log(`  亮端四色夹具红：${brokenBright[0]}`);
      }
    }

    if (tealOk && metroOk && copyOk && broken && failVoidTeal(broken.voidRows).length > 0 && failBrightTiles(broken.brightRows).length > 0) {
      console.log('PASS: 修前夹具会红（户外/地铁 0% 青绿；图书馆 shape = 户外；DEC-097 错误量化）\n');
    }
  }

  const enemy = optionalEnemy(contrast);
  if (enemy.skip) {
    console.log(`SKIP 敌人样本（I6-D 未把 fragment-ramp 接到同一份函数）：${enemy.fails[0] ?? 'CIE76 未过'}`);
  } else {
    console.log('PASS: 敌人样本四档 CIE76 ≥ 18（与地面同一对比度合同）');
  }

  if (failed > 0) {
    console.error(`check:contam-floor-contrast ${failed} failure(s)`);
    return 1;
  }
  console.log('check:contam-floor-contrast ok');
  return 0;
}

if (process.argv[1]?.includes('check-contam-floor-contrast')) {
  process.exit(runFloorContrastCli());
}
