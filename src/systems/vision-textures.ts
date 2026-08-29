/**
 * Presentation-layer texture fills for VisibilitySystem (I9-G / DEC-105).
 * Phaser-free so the energy gate can import the same path the runtime uses.
 */

import { clamp } from '@/utils/math';

/** Octave-A cell size: minimum grain is 2×2, never an isolated pixel. */
export const VOID_NOISE_CELL_PX = 2;
/** Octave-B clump size. */
export const VOID_NOISE_CLUMP_PX = 8;
/**
 * Lit-cell probability. Spec start is 0.55; cold tint (0.90/0.95/1) pulls
 * luma below the 0.55×100 = 55.0 estimate, so coverage is raised to keep
 * mean((r+g+b)/3 × alpha/255) inside 0.90–1.10× of the 59.3 baseline.
 * Not a GAME_CONSTANTS value — texture-internal, not VOID_NOISE_ALPHA.
 */
export const VOID_NOISE_COVERAGE = 0.58;
const VOID_NOISE_VALUE_MIN = 70;
const VOID_NOISE_VALUE_MAX = 130;
const VOID_NOISE_PIXEL_JITTER = 12;
const VOID_NOISE_CLUMP_OFFSET = 18;
const VOID_NOISE_VALUE_CLAMP = 160;
const VOID_NOISE_TINT_R = 0.9;
const VOID_NOISE_TINT_G = 0.95;
const VOID_NOISE_TINT_B = 1;

/** Spec-published baselines (legacy mean luma × alpha). */
export const NOISE_ENERGY_BASELINE = 59.3;
export const NOISE_ENERGY_RATIO_MIN = 0.9;
export const NOISE_ENERGY_RATIO_MAX = 1.1;
export const LIGHT_ENERGY_RATIO_MIN = 0.85;
export const LIGHT_ENERGY_RATIO_MAX = 1.05;
export const LAMP_DISC_ENERGY_BASELINE = 0.36;
export const FLASHLIGHT_DISC_ENERGY_BASELINE = 0.333;

export const LAMP_ALPHA_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.25, 0.9],
  [0.5, 0.45],
  [0.75, 0.18],
  [1, 0],
];

export const FLASHLIGHT_ALPHA_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.18, 0.82],
  [0.42, 0.5],
  [0.7, 0.24],
  [1, 0],
];

export const LEGACY_LAMP_ALPHA_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.6, 0.45],
  [1, 0],
];

export const LEGACY_FLASHLIGHT_ALPHA_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.45, 0.55],
  [1, 0],
];

/** Display-size stretch (not a constant): long axis along facing. */
export const FLASHLIGHT_POOL_STRETCH_ALONG = 1.15;
export const FLASHLIGHT_POOL_STRETCH_ACROSS = 0.87;
/** Y scroll as a fraction of the accelerated X speed. */
export const VOID_NOISE_SCROLL_Y_RATIO = 0.6;

export function fillLegacyVoidNoise(
  pixels: Uint8ClampedArray,
  size: number,
  random: () => number
): void {
  const end = size * size * 4;
  for (let i = 0; i < end; i += 4) {
    const on = random() < 0.3;
    const value = on ? 140 + Math.floor(random() * 115) : 0;
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
    pixels[i + 3] = on ? 255 : 0;
  }
}

/**
 * Dual-octave grain: 2×2 cells (coverage × [70,130] ±12) plus 8×8 clump ±18,
 * cold-tinted toward void-black. Alpha is the octave-A lit flag (255 or 0).
 */
export function fillVoidNoise(
  pixels: Uint8ClampedArray,
  size: number,
  random: () => number,
  coverage = VOID_NOISE_COVERAGE
): void {
  const count = size * size;
  const values = new Float32Array(count);
  const lit = new Uint8Array(count);
  const valueSpan = VOID_NOISE_VALUE_MAX - VOID_NOISE_VALUE_MIN + 1;
  const jitterSpan = VOID_NOISE_PIXEL_JITTER * 2 + 1;
  const clumpSpan = VOID_NOISE_CLUMP_OFFSET * 2 + 1;

  for (let cellY = 0; cellY < size; cellY += VOID_NOISE_CELL_PX) {
    for (let cellX = 0; cellX < size; cellX += VOID_NOISE_CELL_PX) {
      const cellLit = random() < coverage;
      const base = cellLit ? VOID_NOISE_VALUE_MIN + Math.floor(random() * valueSpan) : 0;
      for (let oy = 0; oy < VOID_NOISE_CELL_PX; oy++) {
        for (let ox = 0; ox < VOID_NOISE_CELL_PX; ox++) {
          const idx = (cellY + oy) * size + (cellX + ox);
          if (!cellLit) {
            values[idx] = 0;
            lit[idx] = 0;
          } else {
            values[idx] = base + (Math.floor(random() * jitterSpan) - VOID_NOISE_PIXEL_JITTER);
            lit[idx] = 1;
          }
        }
      }
    }
  }

  for (let cellY = 0; cellY < size; cellY += VOID_NOISE_CLUMP_PX) {
    for (let cellX = 0; cellX < size; cellX += VOID_NOISE_CLUMP_PX) {
      const offset = Math.floor(random() * clumpSpan) - VOID_NOISE_CLUMP_OFFSET;
      for (let oy = 0; oy < VOID_NOISE_CLUMP_PX; oy++) {
        for (let ox = 0; ox < VOID_NOISE_CLUMP_PX; ox++) {
          const idx = (cellY + oy) * size + (cellX + ox);
          if (lit[idx]) {
            values[idx] = clamp(values[idx]! + offset, 0, VOID_NOISE_VALUE_CLAMP);
          }
        }
      }
    }
  }

  for (let i = 0; i < count; i++) {
    const p = i * 4;
    if (!lit[i]) {
      pixels[p] = 0;
      pixels[p + 1] = 0;
      pixels[p + 2] = 0;
      pixels[p + 3] = 0;
      continue;
    }
    const v = values[i]!;
    pixels[p] = Math.round(v * VOID_NOISE_TINT_R);
    pixels[p + 1] = Math.round(v * VOID_NOISE_TINT_G);
    pixels[p + 2] = Math.round(v * VOID_NOISE_TINT_B);
    pixels[p + 3] = 255;
  }
}

/** mean((r+g+b)/3 × alpha/255) over the whole texture. */
export function noiseLumaEnergy(pixels: Uint8ClampedArray): number {
  let sum = 0;
  const n = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = (pixels[i]! + pixels[i + 1]! + pixels[i + 2]!) / 3;
    sum += luma * (pixels[i + 3]! / 255);
  }
  return n > 0 ? sum / n : 0;
}

/** Lit pixels whose 2×2 cell is not uniformly lit — must be 0. */
export function countIsolatedLitPixels(pixels: Uint8ClampedArray, size: number): number {
  let isolated = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const a = pixels[(y * size + x) * 4 + 3]!;
      if (a === 0) continue;
      const cx = x - (x % VOID_NOISE_CELL_PX);
      const cy = y - (y % VOID_NOISE_CELL_PX);
      let cellLit = 0;
      for (let oy = 0; oy < VOID_NOISE_CELL_PX; oy++) {
        for (let ox = 0; ox < VOID_NOISE_CELL_PX; ox++) {
          if (pixels[((cy + oy) * size + (cx + ox)) * 4 + 3]! > 0) cellLit++;
        }
      }
      if (cellLit !== VOID_NOISE_CELL_PX * VOID_NOISE_CELL_PX) isolated++;
    }
  }
  return isolated;
}

export function sampleStopAlpha(t: number, stops: ReadonlyArray<readonly [number, number]>): number {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return 0;
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]!;
    const b = stops[i + 1]!;
    if (t <= b[0]) {
      const span = b[0] - a[0];
      const u = span > 0 ? (t - a[0]) / span : 0;
      return a[1] + (b[1] - a[1]) * u;
    }
  }
  return last[1];
}

/**
 * Pixel-mean alpha of a radial disc (t = dist / half). `discOnly` skips corners
 * so the number matches the spec's 2∫ a(r) r dr gate (0.360 / 0.333).
 */
export function radialMeanAlpha(
  size: number,
  stops: ReadonlyArray<readonly [number, number]>,
  discOnly: boolean
): number {
  const half = size / 2;
  let sum = 0;
  let n = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - half;
      const dy = y + 0.5 - half;
      const t = Math.hypot(dx, dy) / half;
      if (discOnly && t > 1) continue;
      sum += t > 1 ? 0 : sampleStopAlpha(t, stops);
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}

// ---------------------------------------------------------------------------
// Production isolux bands (DEC-107): 32 nested polygons whose radii are the
// reference light field's isolux contours, clamped to the range curve.
// Phaser-free so the energy gate can import the same path the runtime uses.
// ---------------------------------------------------------------------------

/** Nested isolux band count (production). */
export const SUBDIV2_BAND_COUNT = 32;

/**
 * Subdiv2 mode: zone visibility at each band contour, descending. Band k's
 * radius is where the reference light field (FIELD_FLASH_STOPS x
 * FIELD_LAMP_STOPS via fieldVisibilityAt) falls to levels[k] along that ray -
 * the field's isolux contours, quantized. Dense at the dark end, where the
 * eye is most sensitive to steps. levels[0] = 1: the full-erase core.
 * Production (DEC-107).
 */
export const SUBDIV2_LEVELS: readonly number[] = [
  // 亮端 8 档（等距 0.04，保核心饱满）
  1.0, 0.96, 0.92, 0.88, 0.84, 0.8, 0.76, 0.72,
  // 中段 10 档（主衰减区，0.04 → 0.035）
  0.68, 0.64, 0.6, 0.56, 0.52, 0.485, 0.45, 0.415, 0.38, 0.345,
  // 暗端 14 档（加密：人眼对暗部台阶最敏感，且参考场在暗端半径变化最快、等照线间距最大）
  0.31, 0.28, 0.25, 0.22, 0.19, 0.165, 0.14, 0.12, 0.1, 0.08, 0.06, 0.045, 0.03, 0.015,
];

/**
 * Subdiv2: the isolux walk starts here, so directions where the field never
 * reaches a level collapse to a 4px disc instead of a degenerate polygon.
 * Matches MIN_HIT_DIST in visibility-system.ts.
 */
export const SUBDIV2_BAND_FLOOR_PX = 4;

/**
 * Per-polygon erase strengths for a nested stack whose zone visibility
 * just inside band k must equal levels[k] (descending, levels[0] = 1). Erase
 * compounds multiplicatively (outermost drawn first), so
 * alphas[k] = 1 - (1 - levels[k]) / (1 - levels[k+1]) with levels[N] = 0.
 */
export function computeLevelEraseAlphas(levels: readonly number[]): Float32Array {
  const count = levels.length;
  const alphas = new Float32Array(count);
  for (let k = 0; k < count; k++) {
    const next = k + 1 < count ? levels[k + 1]! : 0;
    const residualHere = 1 - levels[k]!;
    const residualNext = 1 - next;
    alphas[k] = residualNext > 0 ? clamp(1 - residualHere / residualNext, 0, 1) : 1;
  }
  return alphas;
}

/**
 * C¹ landing window - the falloff reaches 0 with zero slope just
 * before the support edge, so no contour line can form where the light ends.
 * Returns 1 up to `start`, then a smoothstep down to 0 at t = 1.
 */
export function smoothLanding(t: number, start: number): number {
  if (t <= start) return 1;
  if (t >= 1) return 0;
  const u = (t - start) / (1 - start);
  return 1 - u * u * (3 - 2 * u);
}

/** Window onset for the flashlight (last 14% of range) and lamp. */
export const FIELD_FLASH_WINDOW_START = 0.86;
export const FIELD_LAMP_WINDOW_START = 0.78;

/**
 * Reference light field: flashlight radial falloff, t = dist / radiusForward.
 * The STRONG light: a bright plateau held out to 0.68×range, then a fast falloff.
 */
export const FIELD_FLASH_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.68, 1],
  [0.82, 0.5],
  [0.93, 0.18],
  [1, 0],
];

/**
 * Reference light field: the lamp is the WEAK light. Peak 0.62 keeps the ring
 * visibly dimmer than the flashlight plateau (1.0), so the overlay reads as
 * "a weak lamp plus a strong flashlight" instead of one fused alien shape.
 */
export const FIELD_LAMP_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.62],
  [0.5, 0.55],
  [0.8, 0.3],
  [1, 0],
];

export interface VisionFieldParams {
  readonly radiusForward: number;
  readonly radiusAmbient: number;
  readonly coneHalfAngleDeg: number;
  readonly coneFalloffAngleDeg: number;
  readonly lampStops?: ReadonlyArray<readonly [number, number]>;
  readonly flashStops?: ReadonlyArray<readonly [number, number]>;
}

/**
 * Reference light field: production isolux-band curve source. Separable angular ×
 * radial falloffs, screen-blended. `thetaFromFacing` is radians off the facing
 * direction; distances are in the same px unit as the params radii.
 */
export function fieldVisibilityAt(
  thetaFromFacing: number,
  dist: number,
  params: VisionFieldParams
): number {
  if (dist > params.radiusForward) return 0;
  const coneHalf = (params.coneHalfAngleDeg * Math.PI) / 180;
  const coneEdge = coneHalf + (params.coneFalloffAngleDeg * Math.PI) / 180;
  const lampStops = params.lampStops ?? FIELD_LAMP_STOPS;
  const flashStops = params.flashStops ?? FIELD_FLASH_STOPS;
  const theta = Math.abs(thetaFromFacing);
  let angular = 0;
  if (theta <= coneHalf) {
    angular = 1;
  } else if (theta < coneEdge && coneEdge > coneHalf) {
    const t = (theta - coneHalf) / (coneEdge - coneHalf);
    angular = 1 - t * t * (3 - 2 * t);
  }
  const flashT = dist / params.radiusForward;
  const flash =
    angular *
    sampleStopAlpha(flashT, flashStops) *
    smoothLanding(flashT, FIELD_FLASH_WINDOW_START);
  const lampT = dist / params.radiusAmbient;
  const lamp =
    dist <= params.radiusAmbient
      ? sampleStopAlpha(lampT, lampStops) * smoothLanding(lampT, FIELD_LAMP_WINDOW_START)
      : 0;
  return 1 - (1 - flash) * (1 - lamp);
}

/**
 * Per-ray band radii = the reference field's isolux crossings, clamped to the
 * ray's range curve. One outward walk per ray: levels are descending and the
 * field falls monotonically, so crossings come out non-decreasing.
 *
 * Tail rule: crossings beyond the ray's range (the field's shoulder shelf would
 * otherwise stack N bands on the range edge and leave a hard visibility cliff,
 * or worse, leak past it) are replaced by an even spread between the last
 * in-range crossing and the range. The outermost band is ALWAYS exactly the
 * range - the silhouette is the production range curve, point for point.
 *
 * `params` radii must be pre-scaled by radiusScale; `rayRanges` are the cached
 * per-ray effective ranges (same scaling). Writes out[band][ray].
 */
export function computeFieldBandRadii(
  levels: readonly number[],
  rayOffsets: Float32Array,
  rayRanges: Float32Array,
  params: VisionFieldParams,
  floorPx: number,
  out: Float32Array[],
  stepPx = 1
): void {
  const bandCount = levels.length;
  const crossings = new Float64Array(bandCount);
  for (let i = 0; i < rayOffsets.length; i++) {
    const theta = rayOffsets[i]!;
    const range = rayRanges[i]!;
    let band = 0;
    const vis0 = fieldVisibilityAt(theta, floorPx, params);
    while (band < bandCount && vis0 < levels[band]!) {
      crossings[band] = floorPx;
      band++;
    }
    let prevVis = vis0;
    for (let r = floorPx + stepPx; r <= params.radiusForward && band < bandCount; r += stepPx) {
      const vis = fieldVisibilityAt(theta, r, params);
      while (band < bandCount && vis < levels[band]!) {
        const t = clamp((prevVis - levels[band]!) / Math.max(prevVis - vis, 1e-6), 0, 1);
        crossings[band] = r - stepPx + t * stepPx;
        band++;
      }
      prevVis = vis;
    }
    while (band < bandCount) crossings[band++] = params.radiusForward;
    let j = 0;
    while (j < bandCount && crossings[j]! < range) j++;
    const anchor = j > 0 ? crossings[j - 1]! : floorPx;
    for (let k = 0; k < bandCount; k++) {
      let rho: number;
      // Last band is always the range silhouette (red line). Checked first so a
      // fully in-range walk cannot leave the outer contour on an isolux inside
      // the range (the k < j branch would otherwise win when j === bandCount).
      if (k === bandCount - 1) rho = range;
      else if (k < j) rho = Math.max(crossings[k]!, floorPx);
      else rho = anchor + ((range - anchor) * (k - j + 1)) / (bandCount - j);
      out[k]![i] = rho;
    }
  }
}

