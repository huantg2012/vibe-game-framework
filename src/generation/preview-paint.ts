/**
 * Headless paint of a ruined mask. Preview / tools only — the live rift still
 * uses procedural-surface.ts until C5. Same layer ideas: noise, wall rim,
 * south drop shadow, edge fade into void.
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import type { RuinPaintRole, RuinedMask } from '@/generation/types';

const ROLE_RANK: Record<RuinPaintRole, number> = {
  debris: 2,
  interior: 1,
};

const PALETTE_HEX = [
  '#080a0c', '#0a0b0d', '#0d1114', '#151a1e', '#2a2420', '#1e2228', '#2a2018', '#24221e',
  '#1a1e18', '#2c2e33', '#3a3d42', '#4a4e55', '#5a5f66', '#8a5c2a', '#c4873a', '#1a7a9a',
  '#0e4a3f', '#1a6b5c', '#1aad96', '#2e2d30', '#2a2a2e', '#3a3838', '#1a1c1f', '#2a1f1c',
  '#8a8f96', '#c8cdd4',
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

export function paintRuinedMask(
  mask: RuinedMask,
  pxPerTile = 16,
): { rgba: Uint8Array; width: number; height: number } {
  const def = RIFT_FRAGMENT_DATA[mask.fragmentTypeId];
  if (!def) throw new Error(`paintRuinedMask: unknown type ${mask.fragmentTypeId}`);

  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  const land = mask.outline.land;
  const walls = mask.walls;
  const W = cols * pxPerTile;
  const H = rows * pxPerTile;
  const rgba = new Uint8Array(W * H * 4);
  const T = pxPerTile;

  const wallPix = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < W; x++) {
      const col = (x / T) | 0;
      if (cellAt(land, walls, cols, rows, col, row) === 'wall') wallPix[y * W + x] = 1;
    }
  }

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
      const kind = cellAt(land, walls, cols, rows, col, row);
      let r: number;
      let g: number;
      let b: number;

      if (kind === 'void') {
        const n = (fractal(x, y, 19) - 0.5) * 4;
        r = 8 + n;
        g = 10 + n;
        b = 12 + n;
      } else if (kind === 'wall') {
        const n = (fractal(x, y, 555) - 0.5) * 10;
        let bv = def.wallBv + n;
        r = bv * def.wallBiasR;
        g = bv * def.wallBiasG;
        b = bv * def.wallBiasB;
        let dN = 1;
        while (dN <= 4 && y - dN >= 0 && wallPix[(y - dN) * W + x]) dN++;
        let dS = 1;
        while (dS <= 4 && y + dS < H && wallPix[(y + dS) * W + x]) dS++;
        const topRim = dN <= 3 ? (4 - dN) / 3 : 0;
        const botShad = dS <= 3 ? (4 - dS) / 3 : 0;
        r += 28 * topRim;
        g += 24 * topRim;
        b += 18 * topRim;
        const sf = 1 - 0.55 * botShad;
        r *= sf;
        g *= sf;
        b *= sf;
        let dW = 1;
        while (dW <= 3 && x - dW >= 0 && wallPix[y * W + x - dW]) dW++;
        let dE = 1;
        while (dE <= 3 && x + dE < W && wallPix[y * W + x + dE]) dE++;
        const sideAO = Math.max(dW <= 2 ? (3 - dW) / 2 : 0, dE <= 2 ? (3 - dE) / 2 : 0);
        const af = 1 - 0.22 * sideAO;
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
          if (wallPix[yy * W + x]) {
            sh = 1 - (s - 1) / 10;
            break;
          }
        }
        bv *= 1 - sh * 0.45;
        if (role === 'interior' || role === 'debris') {
          bv *= 0.78;
          r = bv * def.floorBiasR;
          g = bv * def.floorBiasG;
          b = bv * def.floorBiasB;
        } else {
          r = bv * def.floorBiasR;
          g = bv * def.floorBiasG;
          b = bv * def.floorBiasB;
          const stain = fractal(x + 800, y - 400, 7);
          if (stain > def.stainThreshold) {
            const k =
              ((stain - def.stainThreshold) / Math.max(0.05, 1 - def.stainThreshold)) *
              def.stainStrength;
            const stainRgb =
              def.stainKey === 'shadow-grey'
                ? [0x15, 0x1a, 0x1e]
                : def.stainKey === 'brick-dark'
                  ? [0x2a, 0x1f, 0x1c]
                  : [0x1a, 0x1e, 0x18];
            r += (stainRgb[0]! - r) * k;
            g += (stainRgb[1]! - g) * k;
            b += (stainRgb[2]! - b) * k;
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

      const d = (hash2(x, y, 31337) - 0.5) * 12;
      const q = nearestPalette(clamp255(r + d), clamp255(g + d), clamp255(b + d));
      const o = (y * W + x) * 4;
      rgba[o] = q[0];
      rgba[o + 1] = q[1];
      rgba[o + 2] = q[2];
      rgba[o + 3] = 255;
    }
  }

  return { rgba, width: W, height: H };
}
