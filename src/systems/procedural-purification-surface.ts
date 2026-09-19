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
import { GAME_CONSTANTS } from '@/config/constants';
import type { BoundaryShape } from '@/systems/boundary-shape';
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
  warmR: 12, warmG: 6, warmB: -8,
  /** Cold shift at ellipse edge */
  coldR: -8, coldG: -3, coldB: 10,
  /** Worn path brightness bonus */
  pathBrightness: 4,
  /** Path width in pixels (half-width for falloff) */
  pathHalfWidth: 9,
  /** Joint line interval range (px) */
  jointMinSpacing: 48,
  jointMaxSpacing: 82,
  /** Joint line darkening */
  jointDarken: 9,
  /** Warm debris density (per 100 px^2 inside the inner 60%) */
  debrisPer100: 0.01,
  /** Vignette band width in px (ellipse edge to full black) */
  vignetteWidth: 38,
  /** Teal seep point count (entire map) */
  tealCount: 12,
  /** Teal seep distance from ellipse edge (px, inward) */
  tealBandInner: 8,
  /** Dither amplitude to prevent banding */
  ditherAmp: 5,
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
 * Now uses a BoundaryShape (polar pressure blob) instead of a static ellipse
 * for all distance-based rendering: vignette, edge darkening, teal membrane, seeps.
 *
 * @param shape - the dynamic boundary shape for this scene instance
 * @param interactionPoints - world-px positions of interaction targets (for worn paths)
 */
export function createPurificationSurfaceTexture(
  scene: Phaser.Scene,
  tileMap: TileMapData,
  key: string,
  shape: BoundaryShape,
  interactionPoints: ReadonlyArray<{ x: number; y: number }>,
): string {
  if (scene.textures.exists(key)) return key;

  const T = tileMap.tileSize;
  const W = tileMap.cols * T;
  const H = tileMap.rows * T;
  const cx = shape.centerX;
  const cy = shape.centerY;
  const B = GAME_CONSTANTS.PURIFICATION.BOUNDARY;

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
  // Values: 0 = no joint, 1/2/3 = darkness level (varied per pixel)
  const jointMap = new Uint8Array(W * H);
  for (const jy of joints.horizontals) {
    for (let x = 0; x < W; x++) {
      // Skip pixels with ~18% probability for random gaps
      if (vnoise(x, jy, 1 / 13, 6161) < 0.3) continue;
      // Noise offset of +/-3 px vertically (wobbly lines)
      const offset = Math.round((vnoise(x, jy, 1 / 34, 8888) - 0.5) * 6);
      const yy = jy + offset;
      if (yy >= 0 && yy < H) {
        const col = (x / T) | 0;
        const row = (yy / T) | 0;
        if (!isWall(col, row)) {
          // Vary darkness: 1, 2, or 3
          const darkness = 1 + Math.floor(hash2(x, yy, 7272) * 3);
          jointMap[yy * W + x] = darkness as 1 | 2 | 3;
        }
      }
    }
  }
  // Per-slab offset: shift vertical joints by a random amount per horizontal band
  const hBands = [0, ...joints.horizontals, H];
  for (const jx of joints.verticals) {
    for (let y = 0; y < H; y++) {
      // Skip pixels with ~18% probability for random gaps
      if (vnoise(jx, y, 1 / 13, 6262) < 0.3) continue;
      // Determine which horizontal band this y belongs to
      let bandIdx = 0;
      for (let b = 1; b < hBands.length; b++) {
        if (y < hBands[b]!) break;
        bandIdx = b;
      }
      // Per-slab horizontal offset based on band index
      const slabOffset = Math.round((hash2(jx, bandIdx, 5050) - 0.5) * 12);
      // Noise offset of +/-3 px horizontally (wobbly lines)
      const offset = Math.round((vnoise(jx, y, 1 / 34, 9999) - 0.5) * 6);
      const xx = jx + offset + slabOffset;
      if (xx >= 0 && xx < W) {
        const col = (xx / T) | 0;
        const row = (y / T) | 0;
        if (!isWall(col, row)) {
          const darkness = 1 + Math.floor(hash2(xx, y, 7373) * 3);
          jointMap[y * W + xx] = darkness as 1 | 2 | 3;
        }
      }
    }
  }

  // Precompute warm debris positions (inner 60% of boundary)
  const debrisMap = new Uint8Array(W * H);
  const dRng = mulberry32(7070);
  // Approximate area using average blob radius for debris count estimation
  const avgR = (shape.radiusAt(0) + shape.radiusAt(Math.PI / 2) +
    shape.radiusAt(Math.PI) + shape.radiusAt(Math.PI * 1.5)) / 4;
  const innerArea = Math.PI * (avgR * 0.6) * (avgR * 0.6);
  const debrisCount = Math.round(innerArea * SURFACE.debrisPer100 / 100);
  for (let i = 0; i < debrisCount; i++) {
    // Sample uniformly within inner 60% of blob
    const angle = dRng() * Math.PI * 2;
    const blobR = shape.radiusAt(angle);
    const radius = Math.sqrt(dRng()) * 0.6; // sqrt for uniform disk sampling, scaled to 60%
    const dx = Math.round(cx + Math.cos(angle) * radius * blobR);
    const dy = Math.round(cy + Math.sin(angle) * radius * blobR);
    if (dx >= 0 && dx < W && dy >= 0 && dy < H) {
      debrisMap[dy * W + dx] = 1;
    }
  }

  // Precompute teal seep points (near boundary edge, inside the blob)
  const tealMap = new Uint8Array(W * H);
  const tRng = mulberry32(1313);
  let placed = 0;
  let attempts = 0;
  while (placed < SURFACE.tealCount && attempts < SURFACE.tealCount * 20) {
    attempts++;
    const angle = tRng() * Math.PI * 2;
    // Place at 85-100% of blob radius at this angle (near edge, inside)
    const radiusFrac = 0.85 + tRng() * 0.15;
    const blobR = shape.radiusAt(angle);
    const tx = Math.round(cx + Math.cos(angle) * radiusFrac * blobR);
    const ty = Math.round(cy + Math.sin(angle) * radiusFrac * blobR);
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) continue;
    // Verify it's inside the boundary
    if (!shape.isInside(tx, ty)) continue;
    // Place a small cluster (2-4 px)
    tealMap[ty * W + tx] = 1;
    const spread = 1 + Math.floor(tRng() * 3);
    for (let s = 0; s < spread; s++) {
      const sx = tx + Math.round((tRng() - 0.5) * 3);
      const sy = ty + Math.round((tRng() - 0.5) * 3);
      if (sx >= 0 && sx < W && sy >= 0 && sy < H) {
        if (shape.isInside(sx, sy)) tealMap[sy * W + sx] = 1;
      }
    }
    placed++;
  }

  // Maintenance belongs to the actual work sites: a rubbed approach, broad
  // patched concrete and embedded anchor scars. This is baked on the ground,
  // never another prop/collision and never a glowing circle under each machine.
  const maintenance = new Int8Array(W * H);
  interactionPoints.forEach((point, site) => {
    for (let dy = -18; dy <= 24; dy++) for (let dx = -31; dx <= 31; dx++) {
      const x = Math.round(point.x + dx), y = Math.round(point.y + dy);
      if (x < 0 || y < 0 || x >= W || y >= H || !shape.isInside(x, y)) continue;
      const edge = Math.pow(dx / (25 + site % 3 * 3), 2) + Math.pow((dy - 3) / (17 + site % 2 * 3), 2);
      const tear = vnoise(x, y, 1 / 7, 351 + site * 19);
      if (edge > 0.8 + tear * 0.7) continue;
      // Skim repairs and their chipped lower edges form connected masses.
      let value = dy > 5 ? 4 : -3;
      if (edge > 0.96 && tear > 0.55) value = -4;
      if (dy > 5 && dy < 19 && Math.abs(dx + 3) < 13 && tear > 0.52) value = 6;
      if ((dx === -14 || dx === 15) && dy >= -2 && dy <= 3) value = -13;
      maintenance[y * W + x] = value;
    }
  });

  // --- Per-pixel rendering (using BoundaryShape for distance) ---

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 4;

      // Blob distance: normalized (0 = center, 1 = boundary, >1 = outside)
      const blobDist = shape.normalizedDist(x, y);

      // --- Layer 6: Outside boundary = multi-band void transition ---
      if (blobDist > 1.0) {
        // Gradient from boundary (1.0) to full void (GRADIENT_OUTER_END)
        const outerRange = B.GRADIENT_OUTER_END - 1.0;
        const fade = Math.min((blobDist - 1.0) / outerRange, 1.0);
        const edgeBase = SURFACE.baseBrightness * 0.4;
        const brightness = edgeBase * (1 - fade);

        // Teal membrane glow at the boundary (strongest at 1.0, fading outward)
        const membraneGlow = (1 - fade) * 0.15;
        // Pressure-aware: brighter teal where pressure is higher
        const angle = Math.atan2(y - cy, x - cx);
        const pressureBoost = shape.pressureAt(angle) * 0.3;

        let r = brightness * 0.75;
        let g = brightness * 0.85 + (membraneGlow + pressureBoost) * 173;
        let b = brightness * 0.95 + (membraneGlow + pressureBoost) * 150;

        // Dither
        const d = (hash2(x, y, 31337) - 0.5) * SURFACE.ditherAmp * 0.5;
        r += d; g += d; b += d;

        const q = nearestPalette(clamp255(r), clamp255(g), clamp255(b));
        px[idx] = q[0]; px[idx + 1] = q[1]; px[idx + 2] = q[2]; px[idx + 3] = 255;
        continue;
      }

      // --- Layer 1: Stone slab noise base ---
      const noiseVal = (fractal3(x, y, 101) - 0.5) * 2; // range -1..1
      const broad = vnoise(x, y, 1 / 112, 911);
      const slabTone = broad > 0.58 ? 4 : broad < 0.35 ? -5 : 0;
      let brightness = SURFACE.baseBrightness + noiseVal * SURFACE.noiseAmp + slabTone + maintenance[y * W + x]!;

      // --- Layer 2: Radial temperature gradient ---
      // blobDist: 0 at center, 1 at boundary edge
      const warmFrac = 1 - blobDist; // 1 at center, 0 at edge
      const coldFrac = blobDist;      // 0 at center, 1 at edge
      let rShift = SURFACE.warmR * warmFrac + SURFACE.coldR * coldFrac;
      let gShift = SURFACE.warmG * warmFrac + SURFACE.coldG * coldFrac;
      let bShift = SURFACE.warmB * warmFrac + SURFACE.coldB * coldFrac;

      // Brightness gradient: center brighter, edges darker
      brightness += (1 - blobDist) * 5 - blobDist * 5;

      // --- Layer 3: Worn path traces ---
      const pathVal = pathInfluence(x, y, cx, cy, interactionPoints, 202);
      brightness += pathVal * SURFACE.pathBrightness;

      // --- Layer 4: Stone joint lines (variable darkness) ---
      const jointLevel = jointMap[y * W + x];
      if (jointLevel) {
        brightness -= (jointLevel / 3) * SURFACE.jointDarken;
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

      // --- Edge darkening + membrane band (gradient bands from BOUNDARY constants) ---
      if (blobDist > B.GRADIENT_INNER_START) {
        if (blobDist > B.GRADIENT_MEMBRANE_START) {
          // Membrane band (0.95-1.0): strong darkening + teal energy seep
          const memT = (blobDist - B.GRADIENT_MEMBRANE_START) / (1.0 - B.GRADIENT_MEMBRANE_START);
          const darken = 0.35 + memT * 0.25; // 35-60% darkening
          r *= (1 - darken);
          g *= (1 - darken);
          b *= (1 - darken);
          // Teal membrane energy: pressure-aware intensity
          const angle = Math.atan2(y - cy, x - cx);
          const pressureHere = shape.pressureAt(angle);
          const tealStrength = (0.08 + pressureHere * 0.12) * memT;
          r = r * (1 - tealStrength) + 26 * tealStrength;
          g = g * (1 - tealStrength) + 173 * tealStrength;
          b = b * (1 - tealStrength) + 150 * tealStrength;
        } else {
          // Transition inner band (0.80-0.95): progressive darkening only
          const edgeFade = (blobDist - B.GRADIENT_INNER_START) / (B.GRADIENT_MEMBRANE_START - B.GRADIENT_INNER_START);
          const darken = edgeFade * 0.35;
          r *= (1 - darken);
          g *= (1 - darken);
          b *= (1 - darken);
        }
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
