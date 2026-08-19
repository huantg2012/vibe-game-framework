/**
 * Headless paint of a ruined mask. Gallery cards are samples of this painter.
 * Live sorties call the same functions on a freshly generated island.
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { moteSlide, shadeAt } from '@/generation/atmosphere';
import { isContaminationAge, isRuinSeverity } from '@/generation/fragment-roll';
import { mix32 } from '@/generation/seed-fork';
import type {
  AtmosphereField,
  ContaminationAge,
  OverlayStamp,
  RuinPaintRole,
  RuinSeverity,
  RuinedMask,
} from '@/generation/types';
import { SeededRandom } from '@/utils/random';

const ROLE_RANK: Record<RuinPaintRole, number> = {
  glitch: 5,
  stump: 4,
  root: 4,
  wreck: 4,
  organic: 3,
  vegetation: 3,
  debris: 2,
  interior: 1,
};

const PALETTE_HEX = [
  '#080a0c', '#0a0b0d', '#0d1114', '#151a1e', '#2a2420', '#1e2228', '#2a2018', '#24221e',
  '#1a1e18', '#2c2e33', '#3a3d42', '#4a4e55', '#5a5f66', '#8a5c2a', '#c4873a', '#1a7a9a',
  '#0e4a3f', '#1a6b5c', '#1aad96', '#2ae6c8', '#3cffd4', '#7fffee', '#4adf8a', '#b0fff5',
  '#e0a848', '#2e2d30', '#2a2a2e', '#3a3838', '#1a1c1f', '#2a1f1c', '#8a8f96', '#c8cdd4',
  '#cc3333', '#b89040', '#2a2d32', '#0f1114',
];
const PALETTE: ReadonlyArray<readonly [number, number, number]> = PALETTE_HEX.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >> 13), 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, freq: number, seed: number): number {
  const gx = x * freq;
  const gy = y * freq;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const fx = gx - x0;
  const fy = gy - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
}

function fractal(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1 / 36;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    sum += amp * vnoise(x, y, freq, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.15;
  }
  return sum / norm;
}

function clamp255(n: number): number {
  return n < 0 ? 0 : n > 255 ? 255 : n | 0;
}

function nearestPalette(r: number, g: number, b: number): readonly [number, number, number] {
  let best = PALETTE[0]!;
  let bestD = Infinity;
  for (const p of PALETTE) {
    const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/** 5-bit RGB cube. Live static bake uses this; gallery stills stay exact. */
const LUT_RES = 32;
let paletteLut: Uint8Array | null = null;

function ensurePaletteLut(): Uint8Array {
  if (paletteLut) return paletteLut;
  const lut = new Uint8Array(LUT_RES * LUT_RES * LUT_RES * 3);
  for (let r = 0; r < LUT_RES; r++) {
    for (let g = 0; g < LUT_RES; g++) {
      for (let b = 0; b < LUT_RES; b++) {
        const q = nearestPalette((r << 3) + 4, (g << 3) + 4, (b << 3) + 4);
        const i = ((r << 10) | (g << 5) | b) * 3;
        lut[i] = q[0];
        lut[i + 1] = q[1];
        lut[i + 2] = q[2];
      }
    }
  }
  paletteLut = lut;
  return lut;
}

function writeQuantizedRgba(
  work: Float32Array,
  rgba: Uint8Array,
  W: number,
  H: number,
  mode: 'exact' | 'lut',
): void {
  const lut = mode === 'lut' ? ensurePaletteLut() : null;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 3;
      const d = (hash2(x, y, 31337) - 0.5) * 12;
      const r = clamp255(work[s]! + d);
      const g = clamp255(work[s + 1]! + d);
      const b = clamp255(work[s + 2]! + d);
      const o = (y * W + x) * 4;
      if (lut) {
        const i = (((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)) * 3;
        rgba[o] = lut[i]!;
        rgba[o + 1] = lut[i + 1]!;
        rgba[o + 2] = lut[i + 2]!;
      } else {
        const q = nearestPalette(r, g, b);
        rgba[o] = q[0];
        rgba[o + 1] = q[1];
        rgba[o + 2] = q[2];
      }
      rgba[o + 3] = 255;
    }
  }
}

function stainRgb(key: string): readonly [number, number, number] {
  if (key === 'shadow-grey') return [0x15, 0x1a, 0x1e];
  if (key === 'brick-dark') return [0x2a, 0x1f, 0x1c];
  if (key === 'frag-library') return [0x2a, 0x24, 0x20];
  return [0x1a, 0x1e, 0x18];
}

function cellAt(
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  col: number,
  row: number,
): 'void' | 'wall' | 'floor' {
  if (col < 0 || row < 0 || col >= cols || row >= rows) return 'void';
  const i = row * cols + col;
  if (!land[i]) return 'void';
  if (walls[i]) return 'wall';
  return 'floor';
}

function isBoleAt(
  roles: Array<RuinPaintRole | ''>,
  cols: number,
  rows: number,
  col: number,
  row: number,
): boolean {
  if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
  return roles[row * cols + col] === 'stump';
}

function collectBoleOrigins(
  roles: Array<RuinPaintRole | ''>,
  cols: number,
  rows: number,
): Array<{ col: number; row: number }> {
  const out: Array<{ col: number; row: number }> = [];
  const seen = new Set<string>();
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < cols - 1; col++) {
      const key = `${col},${row}`;
      if (seen.has(key)) continue;
      if (!isBoleAt(roles, cols, rows, col, row)) continue;
      if (
        isBoleAt(roles, cols, rows, col + 1, row) &&
        isBoleAt(roles, cols, rows, col, row + 1) &&
        isBoleAt(roles, cols, rows, col + 1, row + 1)
      ) {
        seen.add(key);
        out.push({ col, row });
      }
    }
  }
  return out;
}

function rootArms(
  roles: Array<RuinPaintRole | ''>,
  cols: number,
  rows: number,
  bole: { col: number; row: number },
): Array<Array<{ col: number; row: number }>> {
  const boleSet = new Set([
    `${bole.col},${bole.row}`,
    `${bole.col + 1},${bole.row}`,
    `${bole.col},${bole.row + 1}`,
    `${bole.col + 1},${bole.row + 1}`,
  ]);
  const isRoot = (col: number, row: number): boolean => {
    if (col < 0 || row < 0 || col >= cols || row >= rows) return false;
    return roles[row * cols + col] === 'root';
  };
  const starts: Array<{ col: number; row: number }> = [];
  for (const key of boleSet) {
    const [c, r] = key.split(',').map(Number) as [number, number];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const col = c + dx;
      const row = r + dy;
      if (!isRoot(col, row)) continue;
      if (starts.some((s) => s.col === col && s.row === row)) continue;
      starts.push({ col, row });
    }
  }
  const arms: Array<Array<{ col: number; row: number }>> = [];
  for (const start of starts) {
    const arm = [start];
    const used = new Set([`${start.col},${start.row}`, ...boleSet]);
    let cur = start;
    for (let step = 0; step < 8; step++) {
      let next: { col: number; row: number } | null = null;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const col = cur.col + dx;
        const row = cur.row + dy;
        const key = `${col},${row}`;
        if (used.has(key) || !isRoot(col, row)) continue;
        next = { col, row };
        break;
      }
      if (!next) break;
      used.add(`${next.col},${next.row}`);
      arm.push(next);
      cur = next;
    }
    arms.push(arm);
  }
  return arms;
}

function stampStumps(
  raw: Float32Array,
  roles: Array<RuinPaintRole | ''>,
  land: Uint8Array,
  cols: number,
  rows: number,
  W: number,
  H: number,
  T: number,
): void {
  const put = (x: number, y: number, r: number, g: number, b: number, k: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const col = (x / T) | 0;
    const row = (y / T) | 0;
    if (col < 0 || row < 0 || col >= cols || row >= rows) return;
    if (!land[row * cols + col]) return;
    const o = (y * W + x) * 3;
    raw[o] = raw[o]! * (1 - k) + r * k;
    raw[o + 1] = raw[o + 1]! * (1 - k) + g * k;
    raw[o + 2] = raw[o + 2]! * (1 - k) + b * k;
  };

  for (const bole of collectBoleOrigins(roles, cols, rows)) {
    const cx = (bole.col + 1) * T;
    const cy = (bole.row + 1) * T;
    const rad = T * 0.92;
    const halo = rad + T * 0.28;
    const x0 = Math.max(0, (cx - halo - 2) | 0);
    const y0 = Math.max(0, (cy - halo - 2) | 0);
    const x1 = Math.min(W - 1, (cx + halo + 3) | 0);
    const y1 = Math.min(H - 1, (cy + halo + 4) | 0);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const d = Math.hypot(dx, dy);
        if (d > halo) continue;
        if (d > rad) {
          const k = Math.max(0, 1 - (d - rad) / (halo - rad));
          put(x, y, 0x08, 0x0a, 0x0c, 0.55 * k);
          continue;
        }
        const n = fractal(x, y, 811);
        let r = 0x2a;
        let g = 0x1f;
        let b = 0x1c;
        const t = d / rad;
        if (t < 0.28) {
          r = 0x1a;
          g = 0x1e;
          b = 0x18;
        } else if (t < 0.72) {
          r = n > 0.55 ? 0x2a : 0x1a;
          g = n > 0.55 ? 0x20 : 0x1e;
          b = n > 0.55 ? 0x18 : 0x18;
          const ring = Math.abs(((t * 4.2) % 1) - 0.5);
          if (ring < 0.1) {
            r = 0x1a;
            g = 0x1e;
            b = 0x18;
          }
        } else if (t < 0.88) {
          r = 0x2a;
          g = 0x1f;
          b = 0x1c;
        } else {
          r = 0x0a;
          g = 0x0b;
          b = 0x0d;
        }
        if (dy > 0 && d > rad * 0.5) {
          r *= 0.72;
          g *= 0.74;
          b *= 0.74;
        } else if (dy < -rad * 0.15 && t > 0.35 && t < 0.88) {
          r = Math.min(0x2a, r + 8);
          g = Math.min(0x24, g + 6);
          b = Math.min(0x1c, b + 4);
        }
        put(x, y, r, g, b, 1);
      }
    }

    for (const arm of rootArms(roles, cols, rows, bole)) {
      const pts = [{ x: cx, y: cy }, ...arm.map((c) => ({ x: (c.col + 0.5) * T, y: (c.row + 0.5) * T }))];
      const half = T * 0.22;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const bpt = pts[i]!;
        const len = Math.hypot(bpt.x - a.x, bpt.y - a.y);
        const steps = Math.max(1, (len + 1) | 0);
        for (let s = 0; s <= steps; s++) {
          const u = s / steps;
          const px = a.x + (bpt.x - a.x) * u;
          const py = a.y + (bpt.y - a.y) * u;
          const taper = i === pts.length - 1 ? 0.45 + 0.55 * (1 - u) : 1;
          const hw = half * taper;
          const x0r = Math.max(0, (px - hw - 1) | 0);
          const y0r = Math.max(0, (py - hw - 1) | 0);
          const x1r = Math.min(W - 1, (px + hw + 1) | 0);
          const y1r = Math.min(H - 1, (py + hw + 2) | 0);
          for (let y = y0r; y <= y1r; y++) {
            for (let x = x0r; x <= x1r; x++) {
              const d = Math.hypot(x + 0.5 - px, y + 0.5 - py);
              if (d > hw) continue;
              const n = fractal(x, y, 404);
              let r = n > 0.5 ? 0x2a : 0x1a;
              let g = n > 0.5 ? 0x20 : 0x1e;
              let b = n > 0.5 ? 0x18 : 0x18;
              if (y + 0.5 > py) {
                r *= 0.78;
                g *= 0.8;
                b *= 0.8;
              }
              const k = 1 - d / hw;
              put(x, y, r, g, b, 0.65 + 0.35 * k);
            }
          }
        }
      }
    }
  }
}

function sampleField(field: Float32Array, cols: number, rows: number, fx: number, fy: number): number {
  const x = fx - 0.5;
  const y = fy - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const g = (c: number, r: number): number => {
    if (c < 0 || r < 0 || c >= cols || r >= rows) return 0;
    return field[r * cols + c]!;
  };
  return (
    g(x0, y0) * (1 - tx) * (1 - ty) +
    g(x0 + 1, y0) * tx * (1 - ty) +
    g(x0, y0 + 1) * (1 - tx) * ty +
    g(x0 + 1, y0 + 1) * tx * ty
  );
}

function sampleGrid(
  map: Float32Array,
  gw: number,
  gh: number,
  px: number,
  py: number,
  step: number,
): number {
  const u = (px + 0.5) / step - 0.5;
  const v = (py + 0.5) / step - 0.5;
  const x0 = Math.floor(u);
  const y0 = Math.floor(v);
  const tx = u - x0;
  const ty = v - y0;
  const g = (c: number, r: number): number => {
    const cc = c < 0 ? 0 : c >= gw ? gw - 1 : c;
    const rr = r < 0 ? 0 : r >= gh ? gh - 1 : r;
    return map[rr * gw + cc]!;
  };
  return (
    g(x0, y0) * (1 - tx) * (1 - ty) +
    g(x0 + 1, y0) * tx * (1 - ty) +
    g(x0, y0 + 1) * (1 - tx) * ty +
    g(x0 + 1, y0 + 1) * tx * ty
  );
}

/** Fog only (shade = 0). Live sky is a separate low-res overlay. */
function applyFog(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  cols: number,
  rows: number,
  field: AtmosphereField | undefined,
): void {
  if (!field) return;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fogV = sampleField(field.fog, cols, rows, (x + 0.5) / T, (y + 0.5) / T);
      const haze = fogV * 0.5;
      const o = (y * W + x) * 3;
      raw[o] = raw[o]! + (0x2c - raw[o]!) * haze;
      raw[o + 1] = raw[o + 1]! + (0x2e - raw[o + 1]!) * haze;
      raw[o + 2] = raw[o + 2]! + (0x33 - raw[o + 2]!) * haze;
    }
  }
}

function applyAtmosphere(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  cols: number,
  rows: number,
  field: AtmosphereField | undefined,
  phase: number,
  travelScale: number,
): void {
  if (!field) return;
  const step = Math.max(1, (T / 8) | 0);
  const gw = Math.ceil(W / step) + 1;
  const gh = Math.ceil(H / step) + 1;
  const shadeMap = new Float32Array(gw * gh);
  const rimMap = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const fx = (gx * step + 0.5) / T;
      const fy = (gy * step + 0.5) / T;
      const shade = shadeAt(field, fx, fy, phase, travelScale);
      const shadeFore = shadeAt(field, fx + field.windX * 1.15, fy + field.windY * 1.15, phase, travelScale);
      shadeMap[gy * gw + gx] = shade;
      rimMap[gy * gw + gx] = shadeFore > shade ? shadeFore - shade : 0;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) / T;
      const fy = (y + 0.5) / T;
      const shade = sampleGrid(shadeMap, gw, gh, x, y, step);
      const rim = sampleGrid(rimMap, gw, gh, x, y, step);
      const fogV = sampleField(field.fog, cols, rows, fx, fy);
      const o = (y * W + x) * 3;
      let r = raw[o]!;
      let g = raw[o + 1]!;
      let b = raw[o + 2]!;
      const dim = 1 - shade * 0.7;
      r *= dim * (1 - shade * 0.08);
      g *= dim;
      b *= dim * (1 + shade * 0.04);
      r += 3 * rim;
      g += 5 * rim;
      b += 7 * rim;
      const haze = fogV * (0.28 + 0.22 * (1 - shade));
      r += (0x2c - r) * haze;
      g += (0x2e - g) * haze;
      b += (0x33 - b) * haze;
      const mist = 1 - fogV * shade * 0.18;
      raw[o] = r * mist;
      raw[o + 1] = g * mist;
      raw[o + 2] = b * mist;
    }
  }
}

/** Live overlay: one sample per tile. Gallery stills keep T/8 inside applyAtmosphere. */
export function skyOverlaySize(
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
): { width: number; height: number; step: number } {
  const step = Math.max(1, tileSize);
  return {
    width: Math.ceil(mapWidth / step),
    height: Math.ceil(mapHeight / step),
    step,
  };
}

/**
 * Sky capsules only. `dim` is a multiply layer; `rim` is additive leading-edge light.
 * One overlay pixel = `step` source pixels.
 */
export function paintSkyShade(
  field: AtmosphereField,
  mapWidth: number,
  mapHeight: number,
  tileSize: number,
  phase: number,
  travelScale: number,
  dim: Uint8Array,
  rim: Uint8Array,
): { width: number; height: number } {
  const { width: ow, height: oh, step } = skyOverlaySize(mapWidth, mapHeight, tileSize);
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const fx = (x * step + 0.5) / tileSize;
      const fy = (y * step + 0.5) / tileSize;
      const shade = shadeAt(field, fx, fy, phase, travelScale);
      const shadeFore = shadeAt(
        field,
        fx + field.windX * 1.15,
        fy + field.windY * 1.15,
        phase,
        travelScale,
      );
      const rimV = shadeFore > shade ? shadeFore - shade : 0;
      const dimK = 1 - shade * 0.7;
      const o = (y * ow + x) * 4;
      dim[o] = clamp255(255 * dimK * (1 - shade * 0.08));
      dim[o + 1] = clamp255(255 * dimK);
      dim[o + 2] = clamp255(255 * dimK * (1 + shade * 0.04));
      dim[o + 3] = 255;
      rim[o] = clamp255(3 * rimV);
      rim[o + 1] = clamp255(5 * rimV);
      rim[o + 2] = clamp255(7 * rimV);
      rim[o + 3] = 255;
    }
  }

  const slide = moteSlide(field, phase);
  const scale = tileSize / step;
  for (const stamp of field.motes) {
    if (stamp.kind !== 'mote') continue;
    const cx = (stamp.col + slide.dx) * scale;
    const cy = (stamp.row + slide.dy) * scale;
    const rad = 1.2;
    const x0 = Math.max(0, Math.floor(cx - rad));
    const y0 = Math.max(0, Math.floor(cy - rad));
    const x1 = Math.min(ow - 1, Math.ceil(cx + rad));
    const y1 = Math.min(oh - 1, Math.ceil(cy + rad));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > rad) continue;
        const k = (1 - d / rad) * stamp.strength;
        const o = (y * ow + x) * 4;
        rim[o] = clamp255(rim[o]! + 14 * k);
        rim[o + 1] = clamp255(rim[o + 1]! + 14 * k);
        rim[o + 2] = clamp255(rim[o + 2]! + 16 * k);
      }
    }
  }

  return { width: ow, height: oh };
}

function applyOverlays(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  overlays: readonly OverlayStamp[],
  opts?: { skipMotes?: boolean; phase?: number; field?: AtmosphereField },
): void {
  const slide =
    opts?.field && opts.phase != null ? moteSlide(opts.field, opts.phase) : { dx: 0, dy: 0 };
  for (const stamp of overlays) {
    if (stamp.kind === 'mote' && opts?.skipMotes) continue;
    const cx = (stamp.col + (stamp.kind === 'mote' ? slide.dx : 0)) * T;
    const cy = (stamp.row + (stamp.kind === 'mote' ? slide.dy : 0)) * T;
    const rad = Math.max(1, stamp.radiusTiles * T);
    const x0 = Math.max(0, (cx - rad - 2) | 0);
    const y0 = Math.max(0, (cy - rad - 2) | 0);
    const x1 = Math.min(W - 1, (cx + rad + 2) | 0);
    const y1 = Math.min(H - 1, (cy + rad + 2) | 0);

    if (stamp.kind === 'mote') {
      const x = Math.max(0, Math.min(W - 1, cx | 0));
      const y = Math.max(0, Math.min(H - 1, cy | 0));
      const o = (y * W + x) * 3;
      raw[o] = raw[o]! + 14 * stamp.strength;
      raw[o + 1] = raw[o + 1]! + 14 * stamp.strength;
      raw[o + 2] = raw[o + 2]! + 16 * stamp.strength;
      continue;
    }

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const o = (y * W + x) * 3;
        if (stamp.kind === 'glow') {
          const dx = (x - cx) / rad;
          const dy = (y - cy) / (rad * 0.75);
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          const k = (1 - d) * stamp.strength;
          raw[o] = raw[o]! + 12 * k;
          raw[o + 1] = raw[o + 1]! + 40 * k;
          raw[o + 2] = raw[o + 2]! + 38 * k;
        } else if (stamp.kind === 'ripple') {
          const dx = Math.abs(x - cx);
          const dy = Math.abs(y - cy);
          const cheb = Math.max(dx, dy);
          const ring = Math.abs(cheb - rad * 0.45) < 0.85 || Math.abs(cheb - rad * 0.75) < 0.85;
          if (!ring) continue;
          raw[o] = raw[o]! + 8 * stamp.strength;
          raw[o + 1] = raw[o + 1]! + 28 * stamp.strength;
          raw[o + 2] = raw[o + 2]! + 26 * stamp.strength;
        } else if (stamp.kind === 'band') {
          const along = Math.abs(y - cy) < 0.85 && Math.abs(x - cx) < rad;
          const across = Math.abs(x - cx) < 0.85 && Math.abs(y - cy) < rad * 0.4;
          if (!along && !across) continue;
          raw[o] = raw[o]! + 6 * stamp.strength;
          raw[o + 1] = raw[o + 1]! + 22 * stamp.strength;
          raw[o + 2] = raw[o + 2]! + 24 * stamp.strength;
        }
      }
    }
  }
}

const TEAL_PER_100K_PX2 = 1.6;
const CONTAM_COLD = [0x1a, 0x7a, 0x9a] as const;
const CONTAM_MID = [0x1a, 0x6b, 0x5c] as const;
const CONTAM_CORE = [0x1a, 0xad, 0x96] as const;
const CONTAM_ANCIENT = [0x4a, 0xdf, 0x8a] as const;
const SHADOW_GREY = [0x15, 0x1a, 0x1e] as const;
const BONE_GREY = [0x3a, 0x38, 0x38] as const;

function resolveAge(mask: RuinedMask): ContaminationAge {
  return isContaminationAge(mask.contaminationAge) ? mask.contaminationAge : 'standard';
}

function resolveRuin(mask: RuinedMask): RuinSeverity {
  return isRuinSeverity(mask.ruinSeverity) ? mask.ruinSeverity : 'broken';
}

function desatAncient(): readonly [number, number, number] {
  const s = 0.42;
  return [
    CONTAM_ANCIENT[0] * s + BONE_GREY[0] * (1 - s),
    CONTAM_ANCIENT[1] * s + BONE_GREY[1] * (1 - s),
    CONTAM_ANCIENT[2] * s + BONE_GREY[2] * (1 - s),
  ];
}

function agePaint(age: ContaminationAge): {
  body: readonly [number, number, number];
  highlight: readonly [number, number, number] | null;
  tealMul: number;
  seamW: number;
} {
  if (age === 'new') {
    return { body: CONTAM_COLD, highlight: null, tealMul: 0.35, seamW: 0 };
  }
  if (age === 'ancient') {
    return { body: desatAncient(), highlight: CONTAM_CORE, tealMul: 2.2, seamW: 2 };
  }
  return { body: CONTAM_MID, highlight: CONTAM_CORE, tealMul: 1, seamW: 1 };
}

function ruinKnobs(ruin: RuinSeverity): {
  scratchMul: number;
  fleckMul: number;
  stainOffset: number;
  topMul: number;
  sideMul: number;
} {
  if (ruin === 'intact') {
    return { scratchMul: 0.7, fleckMul: 0.7, stainOffset: 0.06, topMul: 1, sideMul: 1 };
  }
  if (ruin === 'eaten') {
    return { scratchMul: 1.4, fleckMul: 1.5, stainOffset: -0.1, topMul: 0.35, sideMul: 1.85 };
  }
  return { scratchMul: 1, fleckMul: 1, stainOffset: 0, topMul: 1, sideMul: 1 };
}

function putFloorRgb(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  x: number,
  y: number,
  rgb: readonly [number, number, number],
): boolean {
  if (x < 0 || y < 0 || x >= W || y >= H) return false;
  const col = (x / T) | 0;
  const row = (y / T) | 0;
  if (cellAt(land, walls, cols, rows, col, row) !== 'floor') return false;
  const o = (y * W + x) * 3;
  raw[o] = rgb[0];
  raw[o + 1] = rgb[1];
  raw[o + 2] = rgb[2];
  return true;
}

function fillFloorRect(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  col0: number,
  row0: number,
  col1: number,
  row1: number,
  body: readonly [number, number, number],
  highlight: readonly [number, number, number] | null,
): void {
  const x0 = col0 * T;
  const y0 = row0 * T;
  const x1 = (col1 + 1) * T - 1;
  const y1 = (row1 + 1) * T - 1;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const inset =
        highlight && x > x0 + 1 && x < x1 - 1 && y > y0 + 1 && y < y1 - 1;
      putFloorRgb(raw, W, H, T, land, walls, cols, rows, x, y, inset && highlight ? highlight : body);
    }
  }
}

function stampWear(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  mask: RuinedMask,
  scratchMul: number,
  fleckMul: number,
  scratchAngle: string,
): void {
  const floors: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (land[i] && !walls[i]) floors.push(i);
  }
  if (floors.length === 0) return;
  const rng = new SeededRandom(mix32(mask.seed, 'wear'));
  const area = W * H;
  const def = RIFT_FRAGMENT_DATA[mask.fragmentTypeId];
  if (!def) return;
  const scratchN = Math.round(def.scratchPer1000px2 * scratchMul * (area / 1000));
  const fleckN = Math.round(def.fleckPer1000px2 * fleckMul * (area / 1000));
  const angleOf = (): number => {
    if (scratchAngle === 'orthogonal') return rng.next() < 0.5 ? 0 : Math.PI / 2;
    if (scratchAngle === 'longitudinal') return W >= H ? 0 : Math.PI / 2;
    return rng.next() * Math.PI * 2;
  };
  for (let n = 0; n < scratchN; n++) {
    const cell = floors[rng.nextInt(0, floors.length - 1)]!;
    const col = cell % cols;
    const row = (cell / cols) | 0;
    const x0 = col * T + rng.nextInt(0, Math.max(0, T - 1));
    const y0 = row * T + rng.nextInt(0, Math.max(0, T - 1));
    const ang = angleOf();
    const len = 3 + rng.next() * 6;
    const steps = Math.max(2, len | 0);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    for (let s = 0; s <= steps; s++) {
      const x = (x0 + cos * s) | 0;
      const y = (y0 + sin * s) | 0;
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      if (cellAt(land, walls, cols, rows, (x / T) | 0, (y / T) | 0) !== 'floor') continue;
      const o = (y * W + x) * 3;
      raw[o] = raw[o]! * 0.62;
      raw[o + 1] = raw[o + 1]! * 0.62;
      raw[o + 2] = raw[o + 2]! * 0.64;
    }
  }
  for (let n = 0; n < fleckN; n++) {
    const cell = floors[rng.nextInt(0, floors.length - 1)]!;
    const col = cell % cols;
    const row = (cell / cols) | 0;
    const x = col * T + rng.nextInt(0, Math.max(0, T - 1));
    const y = row * T + rng.nextInt(0, Math.max(0, T - 1));
    if (cellAt(land, walls, cols, rows, (x / T) | 0, (y / T) | 0) !== 'floor') continue;
    const light = rng.next() < 0.45;
    const rgb = light ? BONE_GREY : SHADOW_GREY;
    const o = (y * W + x) * 3;
    const k = 0.55;
    raw[o] = raw[o]! * (1 - k) + rgb[0] * k;
    raw[o + 1] = raw[o + 1]! * (1 - k) + rgb[1] * k;
    raw[o + 2] = raw[o + 2]! * (1 - k) + rgb[2] * k;
  }
}

function stampContamination(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  land: Uint8Array,
  walls: Uint8Array,
  cols: number,
  rows: number,
  roles: Array<RuinPaintRole | ''>,
  mask: RuinedMask,
  age: ContaminationAge,
): void {
  const paint = agePaint(age);
  const rng = new SeededRandom(mix32(mask.seed, 'contam-blocks'));
  const floors: number[] = [];
  const glitches: number[] = [];
  for (let i = 0; i < land.length; i++) {
    if (!land[i] || walls[i]) continue;
    floors.push(i);
    if (roles[i] === 'glitch') glitches.push(i);
  }
  if (floors.length === 0) return;

  const pickFloor = (): number => floors[rng.nextInt(0, floors.length - 1)]!;

  if (age === 'new') {
    const specks = rng.nextInt(6, 14);
    for (let n = 0; n < specks; n++) {
      const cell = pickFloor();
      const col = cell % cols;
      const row = (cell / cols) | 0;
      putFloorRgb(
        raw,
        W,
        H,
        T,
        land,
        walls,
        cols,
        rows,
        col * T + rng.nextInt(0, Math.max(0, T - 1)),
        row * T + rng.nextInt(0, Math.max(0, T - 1)),
        paint.body,
      );
    }
  } else if (age === 'standard') {
    const count = rng.nextInt(3, 5);
    for (let n = 0; n < count; n++) {
      const cell = (n < glitches.length ? glitches[n] : pickFloor())!;
      const col = cell % cols;
      const row = (cell / cols) | 0;
      fillFloorRect(raw, W, H, T, land, walls, cols, rows, col, row, col, row, paint.body, paint.highlight);
    }
  } else {
    const count = rng.nextInt(15, 22);
    for (let n = 0; n < count; n++) {
      const cell = (n < glitches.length ? glitches[n] : pickFloor())!;
      const col = cell % cols;
      const row = (cell / cols) | 0;
      const span = rng.next() < 0.55 ? 1 : 2;
      fillFloorRect(
        raw,
        W,
        H,
        T,
        land,
        walls,
        cols,
        rows,
        col,
        row,
        Math.min(cols - 1, col + span),
        Math.min(rows - 1, row + span),
        paint.body,
        paint.highlight,
      );
    }
  }

  const budget = Math.max(0, Math.round((TEAL_PER_100K_PX2 * paint.tealMul * W * H) / 100000));
  if (budget <= 0 || paint.seamW <= 0) return;
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  let painted = 0;
  let guard = 0;
  while (painted < budget && guard++ < budget * 24) {
    const origin = glitches.length > 0 && rng.next() < 0.7 ? glitches[rng.nextInt(0, glitches.length - 1)]! : pickFloor();
    let x = (origin % cols) * T + (T / 2) | 0;
    let y = ((origin / cols) | 0) * T + (T / 2) | 0;
    let [dx, dy] = dirs[rng.nextInt(0, 3)]!;
    const len = 6 + rng.nextInt(0, 10);
    for (let s = 0; s < len && painted < budget; s++) {
      if (rng.next() < 0.28) [dx, dy] = dirs[rng.nextInt(0, 3)]!;
      x += dx;
      y += dy;
      for (let t = 0; t < paint.seamW; t++) {
        const px = x + (dx === 0 ? t : 0);
        const py = y + (dy === 0 ? t : 0);
        if (putFloorRgb(raw, W, H, T, land, walls, cols, rows, px, py, paint.body)) painted++;
      }
    }
  }
}

function stampAncientDots(
  rgba: Uint8Array,
  W: number,
  H: number,
  T: number,
  mask: RuinedMask,
): void {
  if (resolveAge(mask) !== 'ancient') return;
  const land = mask.outline.land;
  const walls = mask.walls;
  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  const rng = new SeededRandom(mix32(mask.seed, 'ancient-dots'));
  const want = Math.max(12, Math.floor((W * H) / 14000));
  let n = 0;
  let guard = 0;
  while (n < want && guard++ < want * 40) {
    const x = rng.nextInt(0, W - 1);
    const y = rng.nextInt(0, H - 1);
    if (cellAt(land, walls, cols, rows, (x / T) | 0, (y / T) | 0) !== 'floor') continue;
    const rgb = rng.next() < 0.5 ? SHADOW_GREY : BONE_GREY;
    const o = (y * W + x) * 4;
    rgba[o] = rgb[0];
    rgba[o + 1] = rgb[1];
    rgba[o + 2] = rgb[2];
    n++;
  }
}

export interface BakedGround {
  readonly raw: Float32Array;
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly mask: RuinedMask;
  readonly roles: Array<RuinPaintRole | ''>;
}

export function bakeGround(mask: RuinedMask, pxPerTile = 16): BakedGround {
  const def = RIFT_FRAGMENT_DATA[mask.fragmentTypeId];
  if (!def) throw new Error(`paintRuinedMask: unknown type ${mask.fragmentTypeId}`);

  const age = resolveAge(mask);
  const ruin = resolveRuin(mask);
  const knobs = ruinKnobs(ruin);

  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  const land = mask.outline.land;
  const walls = mask.walls;
  const W = cols * pxPerTile;
  const H = rows * pxPerTile;
  const raw = new Float32Array(W * H * 3);
  const T = pxPerTile;

  const stonePix = new Uint8Array(W * H);
  const woodPix = new Uint8Array(W * H);

  const roles: Array<RuinPaintRole | ''> = new Array(cols * rows).fill('');
  for (const feat of mask.features) {
    for (const cell of feat.paint ?? []) {
      if (cell.col < 0 || cell.row < 0 || cell.col >= cols || cell.row >= rows) continue;
      const i = cell.row * cols + cell.col;
      const prev = roles[i];
      if (prev && ROLE_RANK[prev] >= ROLE_RANK[cell.role]) continue;
      roles[i] = cell.role;
    }
  }

  for (let y = 0; y < H; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < W; x++) {
      const col = (x / T) | 0;
      if (cellAt(land, walls, cols, rows, col, row) !== 'wall') continue;
      const wood = roles[row * cols + col];
      if (wood === 'stump') woodPix[y * W + x] = 1;
      else if (wood !== 'root') stonePix[y * W + x] = 1;
    }
  }

  for (let y = 0; y < H; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < W; x++) {
      const col = (x / T) | 0;
      const kind = cellAt(land, walls, cols, rows, col, row);
      let r: number;
      let g: number;
      let b: number;

      if (kind === 'void') {
        const n = (fractal(x, y, 19) - 0.5) * 4;
        r = 8 + n;
        g = 10 + n;
        b = 12 + n;
      } else if (kind === 'wall' && (roles[row * cols + col] === 'stump' || roles[row * cols + col] === 'root')) {
        const grime = (fractal(x, y, 1) - 0.5) * 2 * def.grimeAmp;
        const macro = (vnoise(x, y, 1 / 180, 99) - 0.5) * 2 * def.macroAmp;
        let bv = def.floorBv * (1 + grime + macro) + 16;
        let sh = 0;
        for (let s = 1; s <= 10; s++) {
          const yy = y - s;
          if (yy < 0) break;
          if (stonePix[yy * W + x]) {
            sh = 1 - (s - 1) / 10;
            break;
          }
        }
        bv *= 1 - sh * 0.45;
        r = bv * def.floorBiasR;
        g = bv * def.floorBiasG;
        b = bv * def.floorBiasB;
      } else if (kind === 'wall') {
        let dN = 1;
        while (dN <= 4 && y - dN >= 0 && stonePix[(y - dN) * W + x]) dN++;
        let dS = 1;
        while (dS <= 4 && y + dS < H && stonePix[(y + dS) * W + x]) dS++;
        const topRim = dN <= 3 ? (4 - dN) / 3 : 0;
        const botShad = dS <= 3 ? (4 - dS) / 3 : 0;
        const n = (fractal(x, y, 555) - 0.5) * 10;
        let bv = def.wallBv + n;
        r = bv * def.wallBiasR;
        g = bv * def.wallBiasG;
        b = bv * def.wallBiasB;
        r += 28 * topRim * knobs.topMul;
        g += 24 * topRim * knobs.topMul;
        b += 18 * topRim * knobs.topMul;
        const sf = 1 - 0.55 * botShad;
        r *= sf;
        g *= sf;
        b *= sf;
        let dW = 1;
        while (dW <= 3 && x - dW >= 0 && stonePix[y * W + x - dW]) dW++;
        let dE = 1;
        while (dE <= 3 && x + dE < W && stonePix[y * W + x + dE]) dE++;
        const sideAO = Math.max(dW <= 2 ? (3 - dW) / 2 : 0, dE <= 2 ? (3 - dE) / 2 : 0);
        const af = 1 - 0.22 * sideAO * knobs.sideMul;
        r *= af;
        g *= af;
        b *= af;
      } else {
        const grime = (fractal(x, y, 1) - 0.5) * 2 * def.grimeAmp;
        const macro = (vnoise(x, y, 1 / 180, 99) - 0.5) * 2 * def.macroAmp;
        const role = roles[row * cols + col] ?? '';
        let bv = def.floorBv * (1 + grime + macro) + 16;
        let sh = 0;
        for (let s = 1; s <= 10; s++) {
          const yy = y - s;
          if (yy < 0) break;
          if (stonePix[yy * W + x] || woodPix[yy * W + x]) {
            sh = 1 - (s - 1) / 10;
            break;
          }
        }
        bv *= 1 - sh * 0.45;
        r = bv * def.floorBiasR;
        g = bv * def.floorBiasG;
        b = bv * def.floorBiasB;

        if (role === 'organic') {
          const k = 0.62;
          r += (0x1a - r) * k;
          g += (0x6b - g) * k;
          b += (0x5c - b) * k;
          const fx = x % T;
          const fy = y % T;
          if ((fx * 3 + fy * 5) % 7 === 0) {
            r += (0x0e - r) * 0.45;
            g += (0x4a - g) * 0.45;
            b += (0x3f - b) * 0.45;
          }
        } else if (role === 'vegetation') {
          const k = 0.55;
          r += (0x0e - r) * k;
          g += (0x4a - g) * k;
          b += (0x3f - b) * k;
          const fx = x % T;
          const fy = y % T;
          if ((fx + fy) % 5 === 0) {
            r += (0x1a - r) * 0.4;
            g += (0x6b - g) * 0.4;
            b += (0x5c - b) * 0.4;
          }
        } else if (role === 'wreck') {
          const k = 0.5;
          r += (0x2a - r) * k;
          g += (0x1f - g) * k;
          b += (0x1c - b) * k;
        } else if (role === 'interior' || role === 'debris') {
          r *= 0.78;
          g *= 0.78;
          b *= 0.78;
        } else {
          const stain = fractal(x + 800, y - 400, 7);
          const stainTh = def.stainThreshold + knobs.stainOffset;
          if (stain > stainTh) {
            const k =
              ((stain - stainTh) / Math.max(0.05, 1 - stainTh)) *
              def.stainStrength;
            const srgb = stainRgb(def.stainKey);
            r += (srgb[0] - r) * k;
            g += (srgb[1] - g) * k;
            b += (srgb[2] - b) * k;
          }
        }
        const nearVoid =
          cellAt(land, walls, cols, rows, col - 1, row) === 'void' ||
          cellAt(land, walls, cols, rows, col + 1, row) === 'void' ||
          cellAt(land, walls, cols, rows, col, row - 1) === 'void' ||
          cellAt(land, walls, cols, rows, col, row + 1) === 'void';
        if (nearVoid) {
          r *= 0.78;
          g *= 0.78;
          b *= 0.8;
        }
      }

      const o = (y * W + x) * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }

  stampWear(raw, W, H, T, land, walls, cols, rows, mask, knobs.scratchMul, knobs.fleckMul, def.scratchAngle);
  stampContamination(raw, W, H, T, land, walls, cols, rows, roles, mask, age);

  return { raw, width: W, height: H, tileSize: T, mask, roles };
}

/** Gallery stills: fog + sky + overlays + exact palette. Do not call from the live update loop. */
export function compositePaint(
  ground: BakedGround,
  work: Float32Array,
  rgba: Uint8Array,
  opts?: { phase?: number; travelScale?: number },
): void {
  const { raw, width: W, height: H, tileSize: T, mask, roles } = ground;
  work.set(raw);
  applyAtmosphere(
    work,
    W,
    H,
    T,
    mask.outline.cols,
    mask.outline.rows,
    mask.atmosphere,
    opts?.phase ?? mask.atmosphere?.phase ?? 0.5,
    opts?.travelScale ?? 1,
  );
  applyOverlays(work, W, H, T, mask.overlays ?? [], {
    phase: opts?.phase ?? mask.atmosphere?.phase ?? 0.5,
    field: mask.atmosphere,
  });
  stampStumps(work, roles, mask.outline.land, mask.outline.cols, mask.outline.rows, W, H, T);
  writeQuantizedRgba(work, rgba, W, H, 'exact');
  stampAncientDots(rgba, W, H, T, mask);
}

/** Live rift: fog + non-mote overlays baked once. Sky and motes are `paintSkyShade`. */
export function compositeStaticPaint(ground: BakedGround, work: Float32Array, rgba: Uint8Array): void {
  const { raw, width: W, height: H, tileSize: T, mask, roles } = ground;
  work.set(raw);
  applyFog(work, W, H, T, mask.outline.cols, mask.outline.rows, mask.atmosphere);
  applyOverlays(work, W, H, T, mask.overlays ?? [], { skipMotes: true });
  stampStumps(work, roles, mask.outline.land, mask.outline.cols, mask.outline.rows, W, H, T);
  writeQuantizedRgba(work, rgba, W, H, 'lut');
  stampAncientDots(rgba, W, H, T, mask);
}

/** Live paint matches gallery card resolution; the sprite scales to world tile size. */
export const LIVE_PAINT_PX_PER_TILE = 16;

export function paintRuinedMask(
  mask: RuinedMask,
  pxPerTile = 16,
  opts?: { phase?: number; travelScale?: number },
): { rgba: Uint8Array; width: number; height: number } {
  const ground = bakeGround(mask, pxPerTile);
  const rgba = new Uint8Array(ground.width * ground.height * 4);
  const work = new Float32Array(ground.raw.length);
  compositePaint(ground, work, rgba, opts);
  return { rgba, width: ground.width, height: ground.height };
}
