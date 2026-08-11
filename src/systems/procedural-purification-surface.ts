/**
 * ProceduralPurificationSurface - generates the purification point's floor as one
 * world-resolution texture, computed per pixel rather than tiled from discrete art.
 *
 * Visual language: "a defended safe bubble" - industrial concrete/stone that is worn but
 * not corroded. Cold blue-grey base, subtle warmth near center (human presence), cold+dark
 * at edges (proximity to the rift). Irregular stone slab joints instead of grid lines.
 * A soft vignette replaces the hard wall/floor boundary.
 *
 * Deterministic: all variation from hashed value-noise. Runs once at scene create.
 *
 * Layer stack (bottom to top):
 *   1. Stone slab noise base (3 octave, finer grain than rift)
 *   2. Radial temperature gradient (warm center, cold edge)
 *   3. Worn path traces (low-freq directional noise toward interaction points)
 *   4. Irregular stone joint lines (replace grid strokes)
 *   5. Warm debris specks (human activity / kindling residue, inner 60%)
 *   6. Edge void vignette (soft fade to black outside ellipse)
 *   7. Teal seep points (contamination probing the boundary)
 */

import type Phaser from 'phaser';
import { TileType } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';

// --- Palette (subset from docs/art/palette.json relevant to purification) ---

const PALETTE_HEX = [
  '#080a0c', '#0a0a0c', '#0a0b0d', '#0d1114', '#151a1e', '#1a1c1f', '#1e2228',
  '#2a2a2e', '#2c2e33', '#2e2d30', '#3a3d42', '#4a4e55', '#5a5f66',
  '#8a6020', '#1aad96', '#0e4a3f', '#1a7a9a',
];
const PALETTE: ReadonlyArray<readonly [number, number, number]> = PALETTE_HEX.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

// --- Tunable parameters ---

const SURFACE = {
  /** Base brightness for concrete-dark (#2c2e33 ~ luminance 45) */
  baseBrightness: 45,
  /** Noise amplitude: brightness offset range +/- */
  noiseAmp: 8,
  /** Warm shift at ellipse center */
  warmR: 3, warmG: 1, warmB: -2,
  /** Cold shift at ellipse edge */
  coldR: -3, coldG: -1, coldB: 3,
  /** Worn path brightness bonus */
  pathBrightness: 5,
  /** Path width in pixels (half-width for falloff) */
  pathHalfWidth: 1.5,
  /** Joint line interval range (px) */
  jointMinSpacing: 28,
  jointMaxSpacing: 36,
  /** Joint line darkening */
  jointDarken: 12,
  /** Warm debris density (per 100 px^2 inside the inner 60%) */
  debrisPer100: 0.01,
  /** Vignette band width in px (ellipse edge to full black) */
  vignetteWidth: 20,
  /** Teal seep point count (entire map) */
  tealCount: 12,
  /** Teal seep distance from ellipse edge (px, inward) */
  tealBandInner: 8,
  /** Dither amplitude to prevent banding */
  ditherAmp: 10,
} as const;

// --- Deterministic value noise (mirrors procedural-surface.ts) ---

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

/** 3-octave fractal noise with finer base frequency than rift (1/32 vs 1/48). */
function fractal3(x: number, y: number, seed: number): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1 / 32;
  let norm = 0;
  for (let o = 0; o < 3; o++) {
    sum += amp * vnoise(x, y, freq, seed + o * 31);
    norm += amp;
    amp *= 0.5;
    freq *= 2.2;
  }
  return sum / norm;
}

/** Mulberry32 PRNG for deterministic placement of sparse features. */
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

// --- Joint line precomputation ---

interface JointLines {
  horizontals: number[]; // y-coordinates of horizontal joints
  verticals: number[];   // x-coordinates of vertical joints
}

function generateJointLines(W: number, H: number, seed: number): JointLines {
  const rng = mulberry32(seed);
  const horizontals: number[] = [];
  const verticals: number[] = [];

  let y = SURFACE.jointMinSpacing + Math.floor(rng() * (SURFACE.jointMaxSpacing - SURFACE.jointMinSpacing));
  while (y < H - SURFACE.jointMinSpacing) {
    horizontals.push(y);
    y += SURFACE.jointMinSpacing + Math.floor(rng() * (SURFACE.jointMaxSpacing - SURFACE.jointMinSpacing));
  }

  let x = SURFACE.jointMinSpacing + Math.floor(rng() * (SURFACE.jointMaxSpacing - SURFACE.jointMinSpacing));
  while (x < W - SURFACE.jointMinSpacing) {
    verticals.push(x);
    x += SURFACE.jointMinSpacing + Math.floor(rng() * (SURFACE.jointMaxSpacing - SURFACE.jointMinSpacing));
  }

  return { horizontals, verticals };
}

// --- Worn path computation ---

/** Compute a smooth path influence value (0..1) from a point toward target directions. */
function pathInfluence(
  px: number, py: number,
  cx: number, cy: number,
  targets: ReadonlyArray<{ x: number; y: number }>,
  seed: number,
): number {
  let maxInfluence = 0;

  for (const target of targets) {
    // Direction from center to target
    const dirX = target.x - cx;
    const dirY = target.y - cy;
    const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
    if (dirLen < 1) continue;

    // Normalize direction
    const ndx = dirX / dirLen;
    const ndy = dirY / dirLen;

    // Project pixel onto the line from center to target
    const relX = px - cx;
    const relY = py - cy;
    const proj = relX * ndx + relY * ndy;

    // Only consider positive projections (from center outward)
    if (proj < 0) continue;

    // Perpendicular distance from the line
    const perpX = relX - proj * ndx;
    const perpY = relY - proj * ndy;
    let perpDist = Math.sqrt(perpX * perpX + perpY * perpY);

    // Add noise to the perpendicular distance (wobbly path)
    const wobble = (vnoise(px, py, 1 / 18, seed + 77) - 0.5) * 4;
    perpDist += wobble;

    // Falloff based on perpendicular distance
    const halfW = SURFACE.pathHalfWidth;
    if (Math.abs(perpDist) < halfW * 2) {
      const t = 1 - Math.abs(perpDist) / (halfW * 2);
      // Also fade by projection distance (stronger near center, fade at edges)
      const projT = Math.min(proj / dirLen, 1);
      const fade = projT < 0.1 ? projT / 0.1 : (projT > 0.85 ? (1 - projT) / 0.15 : 1);
      const influence = t * t * fade;
      if (influence > maxInfluence) maxInfluence = influence;
    }
  }

  return maxInfluence;
}

// --- Main export ---

/**
 * Builds the purification point surface texture and registers it. Returns the key.
 * Idempotent: if the texture already exists it is reused.
 *
 * @param ellipseRx - ellipse semi-major axis in tiles
 * @param ellipseRy - ellipse semi-minor axis in tiles
 * @param interactionPoints - world-px positions of interaction targets (for worn paths)
 */
export function createPurificationSurfaceTexture(
  scene: Phaser.Scene,
  tileMap: TileMapData,
  key: string,
  ellipseRx: number,
  ellipseRy: number,
  interactionPoints: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (scene.textures.exists(key)) return key;

  const T = tileMap.tileSize;
  const W = tileMap.cols * T;
  const H = tileMap.rows * T;
  const cx = W / 2;
  const cy = H / 2;
  const rxPx = ellipseRx * T;
  const ryPx = ellipseRy * T;

  const canvas = scene.textures.createCanvas(key, W, H);
  if (!canvas) throw new Error(`ProceduralPurificationSurface: could not create canvas '${key}'`);
  const ctx = canvas.getContext();
  const image = ctx.createImageData(W, H);
  const px = image.data;

  // Precompute wall bitmap (for joint masking)
  const isWall = (col: number, row: number): boolean =>
    row >= 0 && row < tileMap.rows && col >= 0 && col < tileMap.cols &&
    tileMap.tiles[row]![col] === TileType.WALL;

  // Precompute joint lines
  const joints = generateJointLines(W, H, 4242);

  // Precompute joint pixel map (1px wide, with noise offset)
  const jointMap = new Uint8Array(W * H);
  for (const jy of joints.horizontals) {
    for (let x = 0; x < W; x++) {
      // Noise offset of +/-1 px vertically
      const offset = Math.round((hash2(x, jy, 8888) - 0.5) * 2);
      const yy = jy + offset;
      if (yy >= 0 && yy < H) {
        const col = (x / T) | 0;
        const row = (yy / T) | 0;
        if (!isWall(col, row)) jointMap[yy * W + x] = 1;
      }
    }
  }
  for (const jx of joints.verticals) {
    for (let y = 0; y < H; y++) {
      const offset = Math.round((hash2(jx, y, 9999) - 0.5) * 2);
      const xx = jx + offset;
      if (xx >= 0 && xx < W) {
        const col = (xx / T) | 0;
        const row = (y / T) | 0;
        if (!isWall(col, row)) jointMap[y * W + xx] = 1;
      }
    }
  }

  // Precompute warm debris positions (inner 60% of ellipse)
  const debrisMap = new Uint8Array(W * H);
  const dRng = mulberry32(7070);
  const innerArea = Math.PI * (rxPx * 0.6) * (ryPx * 0.6);
  const debrisCount = Math.round(innerArea * SURFACE.debrisPer100 / 100);
  for (let i = 0; i < debrisCount; i++) {
    // Sample uniformly within inner 60% ellipse
    const angle = dRng() * Math.PI * 2;
    const radius = Math.sqrt(dRng()) * 0.6; // sqrt for uniform disk sampling, scaled to 60%
    const dx = Math.round(cx + Math.cos(angle) * radius * rxPx);
    const dy = Math.round(cy + Math.sin(angle) * radius * ryPx);
    if (dx >= 0 && dx < W && dy >= 0 && dy < H) {
      debrisMap[dy * W + dx] = 1;
    }
  }

  // Precompute teal seep points (near ellipse edge, inside)
  const tealMap = new Uint8Array(W * H);
  const tRng = mulberry32(1313);
  let placed = 0;
  let attempts = 0;
  while (placed < SURFACE.tealCount && attempts < SURFACE.tealCount * 20) {
    attempts++;
    const angle = tRng() * Math.PI * 2;
    // Place at 85-100% of ellipse radius (near edge, inside)
    const radiusFrac = 0.85 + tRng() * 0.15;
    const tx = Math.round(cx + Math.cos(angle) * radiusFrac * rxPx);
    const ty = Math.round(cy + Math.sin(angle) * radiusFrac * ryPx);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
    // Verify it's inside the ellipse
    const edx = (tx - cx) / rxPx;
    const edy = (ty - cy) / ryPx;
    if (edx * edx + edy * edy > 1.0) continue;
    // Place a small cluster (2-4 px)
    tealMap[ty * W + tx] = 1;
    const spread = 1 + Math.floor(tRng() * 3);
    for (let s = 0; s < spread; s++) {
      const sx = tx + Math.round((tRng() - 0.5) * 3);
      const sy = ty + Math.round((tRng() - 0.5) * 3);
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
        const sedx = (sx - cx) / rxPx;
        const sedy = (sy - cy) / ryPx;
        if (sedx * sedx + sedy * sedy <= 1.0) tealMap[sy * W + sx] = 1;
      }
    }
    placed++;
  }

  // --- Per-pixel rendering ---

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      // Ellipse distance: normalized (0 = center, 1 = edge, >1 = outside)
      const edx = (x - cx) / rxPx;
      const edy = (y - cy) / ryPx;
      const ellipseT = edx * edx + edy * edy; // squared normalized distance
      const ellipseDist = Math.sqrt(ellipseT);

      // --- Layer 6: Outside ellipse = void vignette ---
      if (ellipseDist > 1.0) {
        // Distance beyond ellipse edge in pixels (approximate)
        const overDist = (ellipseDist - 1.0) * Math.min(rxPx, ryPx);
        const fade = Math.min(overDist / SURFACE.vignetteWidth, 1.0);
        // Blend from edge color toward full black
        const edgeBase = SURFACE.baseBrightness * 0.45; // dim edge brightness
        const brightness = edgeBase * (1 - fade);
        // Cold tint for edge
        let r = brightness * 0.85;
        let g = brightness * 0.9;
        let b = brightness * 1.1;

        // Dither
        const d = (hash2(x, y, 31337) - 0.5) * SURFACE.ditherAmp * 0.5;
        r += d; g += d; b += d;

        const q = nearestPalette(clamp255(r), clamp255(g), clamp255(b));
        px[idx] = q[0]; px[idx + 1] = q[1]; px[idx + 2] = q[2]; px[idx + 3] = 255;
        continue;
      }

      // --- Layer 1: Stone slab noise base ---
      const noiseVal = (fractal3(x, y, 101) - 0.5) * 2; // range -1..1
      let brightness = SURFACE.baseBrightness + noiseVal * SURFACE.noiseAmp;

      // --- Layer 2: Radial temperature gradient ---
      // ellipseDist: 0 at center, 1 at edge
      const warmFrac = 1 - ellipseDist; // 1 at center, 0 at edge
      const coldFrac = ellipseDist;      // 0 at center, 1 at edge
      let rShift = SURFACE.warmR * warmFrac + SURFACE.coldR * coldFrac;
      let gShift = SURFACE.warmG * warmFrac + SURFACE.coldG * coldFrac;
      let bShift = SURFACE.warmB * warmFrac + SURFACE.coldB * coldFrac;

      // --- Layer 3: Worn path traces ---
      const pathVal = pathInfluence(x, y, cx, cy, interactionPoints, 202);
      brightness += pathVal * SURFACE.pathBrightness;

      // --- Layer 4: Stone joint lines ---
      if (jointMap[y * W + x]) {
        brightness -= SURFACE.jointDarken;
      }

      // --- Compose base color (blue-grey tint: r < g < b slightly) ---
      let r = brightness * 0.92 + rShift;
      let g = brightness * 0.95 + gShift;
      let b = brightness * 1.05 + bShift;

      // --- Layer 5: Warm debris specks ---
      if (debrisMap[y * W + x]) {
        // Dark gold: #8a6020 = (138, 96, 32)
        r = 138 * 0.35 + r * 0.65;
        g = 96 * 0.35 + g * 0.65;
        b = 32 * 0.35 + b * 0.65;
      }

      // --- Layer 7: Teal seep points ---
      if (tealMap[y * W + x]) {
        // #1aad96 = (26, 173, 150), very subtle blend (alpha 0.15-0.3)
        const alpha = 0.15 + hash2(x, y, 5555) * 0.15;
        r = r * (1 - alpha) + 26 * alpha;
        g = g * (1 - alpha) + 173 * alpha;
        b = b * (1 - alpha) + 150 * alpha;
      }

      // --- Edge darkening (inner side of ellipse, last 20% radius) ---
      if (ellipseDist > 0.8) {
        const edgeFade = (ellipseDist - 0.8) / 0.2; // 0..1
        const darken = edgeFade * 0.35;
        r *= (1 - darken);
        g *= (1 - darken);
        b *= (1 - darken);
      }

      // --- Dither ---
      const d = (hash2(x, y, 31337) - 0.5) * SURFACE.ditherAmp;
      r += d; g += d; b += d;

      // --- Quantize to palette ---
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
