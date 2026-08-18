/**
 * Headless paint of a ruined mask. Preview / tools only — the live rift still
 * uses procedural-surface.ts until C5. Same layer ideas: noise, wall rim,
 * south drop shadow, edge fade into void.
 */

import { RIFT_FRAGMENT_DATA } from '@/generated/rift-fragment-data';
import { shadeAt } from '@/generation/atmosphere';
import type { AtmosphereField, OverlayStamp, RuinPaintRole, RuinedMask } from '@/generation/types';

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
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const fx = (x + 0.5) / T;
      const fy = (y + 0.5) / T;
      const shade = shadeAt(field, fx, fy, phase, travelScale);
      const shadeFore = shadeAt(field, fx + field.windX * 1.15, fy + field.windY * 1.15, phase, travelScale);
      const rim = shadeFore > shade ? shadeFore - shade : 0;
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

function applyOverlays(
  raw: Float32Array,
  W: number,
  H: number,
  T: number,
  overlays: readonly OverlayStamp[],
): void {
  for (const stamp of overlays) {
    const cx = stamp.col * T;
    const cy = stamp.row * T;
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

export function paintRuinedMask(
  mask: RuinedMask,
  pxPerTile = 16,
  opts?: { phase?: number; travelScale?: number },
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
        r += 28 * topRim;
        g += 24 * topRim;
        b += 18 * topRim;
        const sf = 1 - 0.55 * botShad;
        r *= sf;
        g *= sf;
        b *= sf;
        let dW = 1;
        while (dW <= 3 && x - dW >= 0 && stonePix[y * W + x - dW]) dW++;
        let dE = 1;
        while (dE <= 3 && x + dE < W && stonePix[y * W + x + dE]) dE++;
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
          if (stonePix[yy * W + x] || woodPix[yy * W + x]) {
            sh = 1 - (s - 1) / 10;
            break;
          }
        }
        bv *= 1 - sh * 0.45;
        r = bv * def.floorBiasR;
        g = bv * def.floorBiasG;
        b = bv * def.floorBiasB;

        if (role === 'glitch') {
          const lx = x % T;
          const ly = y % T;
          const inset = lx > 1 && lx < T - 2 && ly > 1 && ly < T - 2;
          if (inset) {
            r = 0x1a;
            g = 0xad;
            b = 0x96;
          } else {
            r = 0x1a;
            g = 0x7a;
            b = 0x9a;
          }
        } else if (role === 'organic') {
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
          if (stain > def.stainThreshold) {
            const k =
              ((stain - def.stainThreshold) / Math.max(0.05, 1 - def.stainThreshold)) *
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

  applyAtmosphere(
    raw,
    W,
    H,
    T,
    cols,
    rows,
    mask.atmosphere,
    opts?.phase ?? mask.atmosphere?.phase ?? 0.5,
    opts?.travelScale ?? 1,
  );
  applyOverlays(raw, W, H, T, mask.overlays ?? []);
  stampStumps(raw, roles, land, cols, rows, W, H, T);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 3;
      const d = (hash2(x, y, 31337) - 0.5) * 12;
      const q = nearestPalette(clamp255(raw[s]! + d), clamp255(raw[s + 1]! + d), clamp255(raw[s + 2]! + d));
      const o = (y * W + x) * 4;
      rgba[o] = q[0];
      rgba[o + 1] = q[1];
      rgba[o + 2] = q[2];
      rgba[o + 3] = 255;
    }
  }

  return { rgba, width: W, height: H };
}
