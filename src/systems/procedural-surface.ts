/**
 * ProceduralSurface - generates the rift's floor and walls as one world-resolution
 * texture, computed per world pixel rather than tiled from discrete art (DEC-018).
 *
 * Why a texture and not a tileset: a surface computed from world coordinates is
 * continuous by construction - no seams, no repetition - which is the whole reason
 * A-G3 chose procedural generation over placing discrete AI-generated tiles. The
 * `TilemapRenderer` layer still exists for physics/collision; it is just made invisible
 * and this texture is what the player actually sees, revealed by the VisibilitySystem
 * mask on top of it.
 *
 * Deterministic: all variation comes from a hashed value-noise field, so the same map
 * always produces the same surface (no Math.random). Runs once at scene create.
 *
 * Color palette: outdoor rift feel using `frag-outdoor` (deep olive-grey) for floor
 * and warm brownish-grey for wall obstacles (rock/debris). Moss patches replace the
 * original rust for organic ground staining. Teal seepage (rift contamination) retained.
 *
 * Art recipe and validated parameters: docs/art-direction.md 14.3 and the harness in
 * docs/art/demos/rift-synth/ (floor.mjs / scene.mjs).
 */

import type Phaser from 'phaser';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';

/** Mirror of docs/art/palette.json (source of truth). Surfaces are quantized to it. */
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

/** Tunable surface look. Values validated in the A-G3 harness (scene.s3). */
const SURFACE = {
  grimeAmp: 0.5, // mid-frequency dirt
  macroAmp: 0.32, // low-frequency pools / worn paths
  ditherAmp: 12, // blue-noise dither before quantize, kills gradient banding
  scratchPer1000px2: 0.55, // scratch segments per 1000 px^2 of floor
  fleckPer1000px2: 1.25, // debris flecks per 1000 px^2
  tealPer100kPx2: 1.6, // teal seepage cracks per 100k px^2
  shadowLen: 12, // px a wall casts its drop shadow onto the floor to its south
} as const;

const CONTAM_TEAL: readonly [number, number, number] = [0x1a, 0x7a, 0x9a];

// --- deterministic value noise -------------------------------------------------

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = (Math.imul(h ^ (h >> 13), 1274126177)) | 0;
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
  let freq = 1 / 48;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * vnoise(x, y, freq, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Mulberry32 PRNG for the one-time placement of scratches/flecks/teal seams. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nearestPalette(r: number, g: number, b: number): readonly [number, number, number] {
  let best = PALETTE[0]!;
  let bestDist = Infinity;
  for (let i = 0; i < PALETTE.length; i++) {
    const p = PALETTE[i]!;
    const dr = r - p[0];
    const dg = g - p[1];
    const db = b - p[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : v);

/**
 * Builds the surface texture and registers it under `key`. Returns `key` so the caller
 * can `scene.add.image(0, 0, key)`. Idempotent: if the texture already exists it is reused.
 */
export function createRiftSurfaceTexture(
  scene: Phaser.Scene,
  map: TileMapData,
  key: string
): string {
  if (scene.textures.exists(key)) return key;

  const T = map.tileSize;
  const W = map.cols * T;
  const H = map.rows * T;

  const canvas = scene.textures.createCanvas(key, W, H);
  if (!canvas) throw new Error(`ProceduralSurface: could not create canvas texture '${key}'`);
  const ctx = canvas.getContext();
  const image = ctx.createImageData(W, H);
  const px = image.data;

  // pixel-level wall bitmap (wall === TileType.WALL); out-of-cell counts as non-wall
  const isWallCell = (col: number, row: number): boolean =>
    row >= 0 && row < map.rows && col >= 0 && col < map.cols && map.tiles[row]![col] === TileType.WALL;
  const wallPix = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const row = (y / T) | 0;
    for (let x = 0; x < W; x++) {
      wallPix[y * W + x] = isWallCell((x / T) | 0, row) ? 1 : 0;
    }
  }

  // signed scratch/fleck brightness map (|abs| wins on overlap)
  const floorArea = W * H; // upper bound; scratches on walls are simply overwritten later
  const scratchMap = new Float32Array(W * H);
  const put = (x: number, y: number, d: number): void => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    if (Math.abs(d) > Math.abs(scratchMap[i]!)) scratchMap[i] = d;
  };
  const srng = mulberry32(9001);
  const scratchCount = Math.round((floorArea / 1000) * SURFACE.scratchPer1000px2);
  for (let i = 0; i < scratchCount; i++) {
    const x0 = srng() * W;
    const y0 = srng() * H;
    const ang = srng() * Math.PI * 2;
    const len = 6 + srng() * 26;
    const delta = (srng() < 0.35 ? 1 : -1) * (5 + srng() * 12);
    const x1 = x0 + Math.cos(ang) * len;
    const y1 = y0 + Math.sin(ang) * len;
    const steps = Math.max(2, Math.hypot(x1 - x0, y1 - y0));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      put(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), delta);
    }
  }
  const frng = mulberry32(24601);
  const fleckCount = Math.round((floorArea / 1000) * SURFACE.fleckPer1000px2);
  for (let i = 0; i < fleckCount; i++) {
    const x = Math.floor(frng() * W);
    const y = Math.floor(frng() * H);
    const delta = (frng() < 0.5 ? 1 : -1) * (5 + frng() * 12);
    put(x, y, delta);
    if (frng() < 0.3) {
      put(x + 1, y, delta);
      put(x, y + 1, delta);
    }
  }

  // teal seepage cracks (floor only)
  const tealPix = new Uint8Array(W * H);
  const trng = mulberry32(1717);
  const tealCount = Math.round((floorArea / 100000) * SURFACE.tealPer100kPx2);
  for (let i = 0; i < tealCount; i++) {
    let x = trng() * W;
    let y = trng() * H;
    let ang = trng() * Math.PI * 2;
    const seg = 8 + Math.floor(trng() * 12);
    for (let s = 0; s < seg; s++) {
      ang += (trng() - 0.5) * 1.1;
      x += Math.cos(ang) * 4;
      y += Math.sin(ang) * 4;
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi >= 0 && yi >= 0 && xi < W && yi < H && wallPix[yi * W + xi] === 0) tealPix[yi * W + xi] = 1;
    }
  }

  // drop shadow + contact AO for a floor pixel, from the pixel wall bitmap
  const shadowAt = (x: number, y: number): number => {
    let sh = 0;
    for (let s = 1; s <= SURFACE.shadowLen; s++) {
      const yy = y - s;
      if (yy < 0) break;
      if (wallPix[yy * W + x]) {
        sh = 1 - (s - 1) / SURFACE.shadowLen;
        break;
      }
    }
    let ao = 0;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      for (let s = 1; s <= 4; s++) {
        const xx = x + dx * s;
        const yy = y + dy * s;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) break;
        if (wallPix[yy * W + xx]) {
          if (1 - (s - 1) / 4 > ao) ao = 1 - (s - 1) / 4;
          break;
        }
      }
    }
    return Math.min(1, sh * 0.7 + ao * 0.5);
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;
      let r: number;
      let g: number;
      let b: number;

      if (wallPix[y * W + x]) {
        // wall: warm rock/debris material; continuous top-rim highlight / bottom drop-shadow / side AO
        const n = (fractal(x, y, 555) - 0.5) * 10;
        let bv = 24 + n;
        r = bv * 1.0;
        g = bv * 0.88;
        b = bv * 0.75;
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
      } else if (tealPix[y * W + x]) {
        r = CONTAM_TEAL[0];
        g = CONTAM_TEAL[1];
        b = CONTAM_TEAL[2];
      } else {
        // floor: deep olive-grey base (outdoor ground) + macro pools + mid grime + scratches - wall drop shadow
        const grime = (fractal(x, y, 1) - 0.5) * 2 * SURFACE.grimeAmp;
        const macro = (vnoise(x, y, 1 / 210, 99) - 0.5) * 2 * SURFACE.macroAmp;
        let bv = 26 * (1 + grime + macro);
        bv += scratchMap[y * W + x]!;
        bv *= 1 - shadowAt(x, y) * 0.6;
        r = bv * 0.88;
        g = bv * 1.02;
        b = bv * 0.82;
        // moss patches (organic ground staining; replaces rust for outdoor feel)
        const moss = fractal(x + 1000, y - 500, 7);
        if (moss > 0.72) {
          const k = ((moss - 0.72) / 0.28) * 0.4;
          r = r + (0x12 - r) * k;
          g = g + (0x2a - g) * k;
          b = b + (0x14 - b) * k;
        }
      }

      if (SURFACE.ditherAmp > 0) {
        const d = (hash2(x, y, 31337) - 0.5) * SURFACE.ditherAmp;
        r += d;
        g += d;
        b += d;
      }
      const q = nearestPalette(clamp255(r), clamp255(g), clamp255(b));
      px[idx] = q[0];
      px[idx + 1] = q[1];
      px[idx + 2] = q[2];
      px[idx + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  canvas.refresh();
  return key;
}
