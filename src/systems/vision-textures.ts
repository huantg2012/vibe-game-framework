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

/** 2×2 punch tile: white on checker-off cells so erase() punches the ring into dither. */
export function fillDitherPunch(pixels: Uint8ClampedArray, size = 2): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const on = ((x + y) & 1) === 0;
      const i = (y * size + x) * 4;
      const v = on ? 0 : 255;
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
      pixels[i + 3] = on ? 0 : 255;
    }
  }
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
// Smooth-mask spike candidates (gym lesson `vision-lab`, I9 review follow-up).
// None of these are on the production default path (`bands`).
// ---------------------------------------------------------------------------

/** Subdiv mode: how many nested polygons replace the 3 stepped bands. */
export const SUBDIV_BAND_COUNT = 8;

/**
 * Subdiv mode: visibility across the band zone; t = 0 at the core edge, 1 at the
 * range. A continuous curve anchored near the stepped 1.0 / 0.6 / 0.2 feel.
 */
export const SUBDIV_PROFILE_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.3, 0.7],
  [0.6, 0.35],
  [0.85, 0.12],
  [1, 0],
];

/**
 * Per-polygon erase strengths for `count` nested polygons stepping across the band
 * zone. Erase compounds multiplicatively, so polygon j erases 1 - S_j/S_{j+1} where
 * S_j is the target residual darkness just inside polygon j and S_count = 1 (full
 * darkness outside). With the stepped profile at count 3 this reproduces
 * ERASE_ALPHAS [1.0, 0.5, 0.2] exactly.
 */
export function computeNestedEraseAlphas(
  count: number,
  stops: ReadonlyArray<readonly [number, number]>
): Float32Array {
  const residuals = new Float64Array(count + 1);
  residuals[count] = 1;
  for (let j = 0; j < count; j++) {
    const t = Math.max(0, (j - 0.5) / (count - 1));
    residuals[j] = 1 - sampleStopAlpha(t, stops);
  }
  const alphas = new Float32Array(count);
  for (let j = 0; j < count; j++) {
    const next = residuals[j + 1]!;
    const current = residuals[j]!;
    alphas[j] = next > 0 ? clamp(1 - current / next, 0, 1) : 1;
  }
  return alphas;
}

/** 4×4 Bayer threshold ranks, row-major. */
const BAYER4_RANKS = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Bayer spike: temporal phase count — the rank matrix rotates 90° per phase. */
export const BAYER_PHASE_COUNT = 4;
/** Bayer spike: ms per phase step. ~8 Hz reads as living grain, not a strobe. */
export const BAYER_PHASE_MS = 120;

/**
 * 4×4 ordered-dither punch tile keeping `keepSixteenths`/16 of the cells: kept
 * cells stay transparent, the rest turn opaque white so erase() punches them out
 * of whatever was drawn into the scratch first. Phase-pin to world coordinates
 * with `tilePosition = maskOrigin & 3`, same trick as the 2×2 checker.
 *
 * `phase` rotates the rank matrix 90° per step: rotation preserves the rank
 * multiset, so the duty cycle (and thus the slope density) is identical while
 * different cells twinkle — the dither stays alive when the player stands still.
 */
export function fillBayerPunch(pixels: Uint8ClampedArray, keepSixteenths: number, phase = 0): void {
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      let sx = x;
      let sy = y;
      for (let p = phase % BAYER_PHASE_COUNT; p > 0; p--) {
        const tx = sx;
        sx = 3 - sy;
        sy = tx;
      }
      const keep = BAYER4_RANKS[sy * 4 + sx]! < keepSixteenths;
      const i = (y * 4 + x) * 4;
      const v = keep ? 0 : 255;
      pixels[i] = v;
      pixels[i + 1] = v;
      pixels[i + 2] = v;
      pixels[i + 3] = keep ? 0 : 255;
    }
  }
}

/** Bayer mode: ring densities from inner (next to the solid fill) to outer. */
export const BAYER_SLOPE_KEEPS: readonly number[] = [12, 8, 4];
/** Bayer mode: px the solid fill is pulled in so the slope straddles the contour. */
export const BAYER_SLOPE_INSET = 4;
/** Bayer mode: ring stroke width; centres sit at -2.7 / -0.1 / +2.5 from the contour. */
export const BAYER_SLOPE_RING_WIDTH = 2.6;

/** Field mode: canvas edge; must exceed 2 × RADIUS_FORWARD (224). */
export const VISION_FIELD_SIZE = 512;

/**
 * Field mode v3 (I9-LAB round 3): the stencil is a 360-degree full-range fan whose
 * ONLY job is wall truncation; the baked texture owns the entire shape. Ray count
 * for that fan - at 128 rays the chord sagitta at 224px is ~0.07px, invisible.
 */
export const FIELD_STENCIL_RAY_COUNT = 128;

/**
 * Field mode v3: C¹ landing window - the falloff reaches 0 with zero slope just
 * before the support edge, so no contour line can form where the light ends.
 * Returns 1 up to `start`, then a smoothstep down to 0 at t = 1.
 */
export function smoothLanding(t: number, start: number): number {
  if (t <= start) return 1;
  if (t >= 1) return 0;
  const u = (t - start) / (1 - start);
  return 1 - u * u * (3 - 2 * u);
}

/** Field mode v3: window onset for the flashlight (last 14% of range) and lamp. */
export const FIELD_FLASH_WINDOW_START = 0.86;
export const FIELD_LAMP_WINDOW_START = 0.78;

/**
 * Field mode: flashlight radial falloff, t = dist / radiusForward. The STRONG
 * light: a bright plateau held out to 0.68×range, then a fast falloff.
 */
export const FIELD_FLASH_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [0.68, 1],
  [0.82, 0.5],
  [0.93, 0.18],
  [1, 0],
];

/**
 * Field mode v2 (I9-LAB round 2): the lamp is the WEAK light. Peak 0.62 keeps the
 * ring visibly dimmer than the flashlight plateau (1.0), so the overlay reads as
 * "a weak lamp plus a strong flashlight" instead of one fused alien shape.
 */
export const FIELD_LAMP_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.62],
  [0.5, 0.55],
  [0.8, 0.3],
  [1, 0],
];

/** Field mode v2 dim variant: same shape, lamp one notch weaker (strength draw). */
export const FIELD_LAMP_DIM_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0, 0.45],
  [0.5, 0.4],
  [0.8, 0.22],
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
 * Single-point field visibility: separable angular × radial falloffs, screen-blended.
 * Shared by the texture bake AND the teal-v4 isolux scan, so the corruption front
 * tracks the exact same light the player sees. `thetaFromFacing` is radians off the
 * facing direction; distances are in the same px unit as the params radii.
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
 * Teal v4 (I9-LAB round 4): the corruption front pins to the light field's isolux
 * contour - the radius where visibility first drops below `threshold`. Strong light
 * (flashlight cone) holds the front far out; weak light (lamp side/rear) lets it
 * seep close. If the field never reaches the threshold (dim direction, high chaos)
 * the front sits at `floorRadius` - the corruption has reached the player's feet.
 * The field decreases monotonically along a ray, so the first crossing is unique.
 */
export function fieldIsoluxRadius(
  thetaFromFacing: number,
  threshold: number,
  params: VisionFieldParams,
  floorRadius: number,
  stepPx = 2
): number {
  for (let r = floorRadius; r <= params.radiusForward; r += stepPx) {
    if (fieldVisibilityAt(thetaFromFacing, r, params) < threshold) return r;
  }
  return params.radiusForward;
}

/**
 * Field mode: bake the smooth visibility field - lamp and flashlight as separable
 * angular × radial falloffs, screen-blended so the cone shoulder rounds itself the
 * way two physical light sources would. Texture space faces +x; alpha = visibility.
 *
 * v3: both falloffs carry a smoothLanding window, so the field reaches exactly 0
 * (with zero slope) at radiusForward / radiusAmbient. The 360-degree stencil then
 * only ever cuts darkness outside the walls - the texture alone owns the shape.
 */
export function fillVisionField(
  pixels: Uint8ClampedArray,
  size: number,
  params: VisionFieldParams
): void {
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x + 0.5 - half;
      const dy = y + 0.5 - half;
      const dist = Math.hypot(dx, dy);
      const visibility = fieldVisibilityAt(Math.atan2(dy, dx), dist, params);
      const alpha = Math.round(clamp(visibility, 0, 1) * 255);
      pixels[i] = 255;
      pixels[i + 1] = 255;
      pixels[i + 2] = 255;
      pixels[i + 3] = alpha;
    }
  }
}
