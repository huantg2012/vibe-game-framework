/**
 * BoundaryShape -- computes the dynamic purification point boundary as a polar pressure blob.
 *
 * The boundary is an ellipse modulated by:
 * 1. Tide intensity scaling (shrinks at higher intensity, re-expands during ebb)
 * 2. Directional pressure lobes (Gaussian bumps that push inward asymmetrically)
 * 3. Safe-zone clamping (ensures all interaction points stay inside with margin)
 *
 * World model: the purification point is a residual force-field bubble being squeezed
 * by external contamination pressure. The pressure is uneven (directional lobes) and
 * intensifies with the tide cycle. The bubble never ruptures past interaction objects.
 *
 * Created once per scene-create and shared by: tilemap builder, procedural surface,
 * atmosphere system, and breathing overlay.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { PURIFICATION_PLAYER_BODY } from '@/systems/purification-collision';
import type { TidePhase } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoundaryShapeConfig {
  /** Ellipse semi-major axis in tiles */
  ellipseRx: number;
  /** Ellipse semi-minor axis in tiles */
  ellipseRy: number;
  /** Current tide intensity (1.0-3.0) */
  tideIntensity: number;
  /** Current tide phase */
  tidePhase: TidePhase;
  /** Deterministic seed for pressure direction generation */
  pressureSeed: number;
  /** World-pixel positions of interaction points (for safe zone clamping) */
  interactionPoints: ReadonlyArray<{ x: number; y: number }>;
  /** Map center in world pixels */
  centerX: number;
  /** Map center in world pixels */
  centerY: number;
}

export interface BoundaryShape {
  /**
   * Radius of the boundary at the given angle (radians from center), in pixels.
   * Angle 0 = right (+x), PI/2 = down (+y).
   */
  radiusAt(angle: number): number;

  /**
   * Normalized distance from center relative to boundary.
   * 0 = at center, 1.0 = on boundary, >1 = outside.
   */
  normalizedDist(worldX: number, worldY: number): number;

  /** Returns true if the world point is inside (or on) the boundary. */
  isInside(worldX: number, worldY: number): boolean;

  /** Primary pressure direction in radians (where the strongest compression comes from). */
  pressureDirection: number;

  /** Pressure intensity at a given angle (0 to ~0.3, how much the boundary is pushed inward). */
  pressureAt(angle: number): number;

  /** The tide scale factor applied (1.0 = full size, 0.72 = max compression). */
  tideScale: number;

  /** Center X in world pixels. */
  centerX: number;
  /** Center Y in world pixels. */
  centerY: number;
}

// ---------------------------------------------------------------------------
// Helpers (local)
// ---------------------------------------------------------------------------

/** Mulberry32 PRNG for deterministic pressure direction generation. */
function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shortest signed angular distance from a to b, range [-PI, PI]. */
function angleDist(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// ---------------------------------------------------------------------------
// Resolution for the safe-zone clamping lookup table
// ---------------------------------------------------------------------------

/** Number of angular samples for the minimum-radius lookup (1 per degree). */
const CLAMP_SAMPLES = 360;
/** Half-arc in degrees over which a safe-zone constraint is spread with cosine falloff. */
const CLAMP_HALF_ARC_DEG = 30;

/** Shared with the sampled static wall; safety margins include its inward extent. */
export const BOUNDARY_COLLISION_INNER_SCALE = 0.98;
export const BOUNDARY_COLLISION_SEGMENT_SIZE = 8;
export const BOUNDARY_COLLISION_SAMPLES = 90;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a BoundaryShape instance from the current game state.
 * Call once per scene-create; the returned object is stateless and cheap to query.
 */
export function createBoundaryShape(config: BoundaryShapeConfig): BoundaryShape {
  const TILE = GAME_CONSTANTS.TILE_SIZE;
  const B = GAME_CONSTANTS.PURIFICATION.BOUNDARY;

  const { ellipseRx, ellipseRy, tideIntensity, tidePhase, pressureSeed,
    interactionPoints, centerX, centerY } = config;

  // --- 1. Tide scale ---
  const t = clamp01((tideIntensity - 1.0) / 2.0);
  const tideScale = 1.0 - t * (1.0 - B.SHRINK_AT_MAX_INTENSITY);

  // --- 2. Pressure lobes ---
  const rng = mulberry32(pressureSeed);
  const primaryDir = rng() * 2 * Math.PI;
  const secondaryDir = primaryDir + Math.PI * 0.6 + rng() * Math.PI * 0.4;

  let primaryAmp = B.PRESSURE_PRIMARY_AMP;
  let secondaryAmp = B.PRESSURE_SECONDARY_AMP;

  // Phase modifiers
  if (tidePhase === 'crest') {
    primaryAmp *= (1 + B.PRESSURE_CREST_BONUS);
    secondaryAmp *= (1 + B.PRESSURE_CREST_BONUS);
  } else if (tidePhase === 'ebb') {
    primaryAmp *= B.PRESSURE_EBB_FACTOR;
    secondaryAmp *= B.PRESSURE_EBB_FACTOR;
  }

  const sigma = B.PRESSURE_LOBE_SIGMA;
  const twoSigmaSq = 2 * sigma * sigma;

  // --- 3. Pressure function (unclamped) ---
  function pressureAt(angle: number): number {
    const d1 = angleDist(angle, primaryDir);
    const d2 = angleDist(angle, secondaryDir);
    return primaryAmp * Math.exp(-(d1 * d1) / twoSigmaSq)
         + secondaryAmp * Math.exp(-(d2 * d2) / twoSigmaSq);
  }

  // --- 4. Raw radius (before safe-zone clamping) ---
  const rxPx = ellipseRx * TILE;
  const ryPx = ellipseRy * TILE;

  function rawRadiusAt(angle: number): number {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    // Standard polar ellipse radius formula
    const baseR = (rxPx * ryPx) / Math.sqrt((ryPx * cosA) ** 2 + (rxPx * sinA) ** 2);
    return baseR * tideScale * (1 - pressureAt(angle));
  }

  // --- 5. Safe-zone clamping ---
  // Build minimum-radius lookup (one entry per degree)
  const minRadius = new Float32Array(CLAMP_SAMPLES); // initialized to 0

  const safeMarginPx = B.SAFE_MARGIN_TILES * TILE;

  for (const point of interactionPoints) {
    const dx = point.x - centerX;
    const dy = point.y - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const required = dist + safeMarginPx;
    const pointAngleDeg = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;

    // Spread constraint over +/- CLAMP_HALF_ARC_DEG with cosine falloff
    for (let offset = -CLAMP_HALF_ARC_DEG; offset <= CLAMP_HALF_ARC_DEG; offset++) {
      const deg = ((pointAngleDeg + offset) + 360) % 360;
      const idx = Math.round(deg) % CLAMP_SAMPLES;
      // Cosine falloff: full strength at center, zero at edges
      const falloff = Math.cos((offset / CLAMP_HALF_ARC_DEG) * (Math.PI / 2));
      const clampedRequired = required * falloff;
      if (clampedRequired > minRadius[idx]!) {
        minRadius[idx] = clampedRequired;
      }
    }

    // The cosine lobe only protected a spoke, not the disk around an interaction.
    // Preserve it, then protect the actual disk from the inward edge of square
    // boundary bodies. Their half-diagonal is the worst inward reach at any angle.
    // SAFE_MARGIN is traversable space for the feet's center, not just a point
    // visible on the ground. Reserve the full actor before the sampled wall too.
    const feetRadius = Math.hypot(PURIFICATION_PLAYER_BODY.width, PURIFICATION_PLAYER_BODY.height) / 2;
    const protectedRadius = safeMarginPx + feetRadius + BOUNDARY_COLLISION_SEGMENT_SIZE / Math.SQRT2;
    const protectedRadiusSq = protectedRadius * protectedRadius;
    const pointAngle = Math.atan2(dy, dx);
    const halfBin = Math.PI / CLAMP_SAMPLES;
    for (let idx = 0; idx < CLAMP_SAMPLES; idx++) {
      const sampleAngle = idx * Math.PI * 2 / CLAMP_SAMPLES;
      // radiusAt rounds to this bin: take the largest far intersection anywhere
      // within its half-degree extent, rather than under-protecting between samples.
      const delta = Math.max(0, Math.abs(angleDist(sampleAngle, pointAngle)) - halfBin);
      const projection = dist * Math.cos(delta);
      const perpendicular = dist * Math.sin(delta);
      const discriminant = protectedRadiusSq - perpendicular * perpendicular;
      if (discriminant < 0) continue;
      const farIntersection = projection + Math.sqrt(discriminant);
      if (farIntersection <= 0) continue;
      // 0.001px covers Float32 rounding; all consumers still share this one shape.
      const diskRequired = farIntersection / BOUNDARY_COLLISION_INNER_SCALE + 0.001;
      if (diskRequired > minRadius[idx]!) minRadius[idx] = diskRequired;
    }
  }

  // --- 6. Final clamped radius ---
  function radiusAt(angle: number): number {
    const raw = rawRadiusAt(angle);
    // Look up minimum radius at this angle
    const deg = ((angle * 180 / Math.PI) + 360) % 360;
    const idx = Math.round(deg) % CLAMP_SAMPLES;
    const min = minRadius[idx]!;
    return raw > min ? raw : min;
  }

  // --- 7. Distance queries ---
  function normalizedDist(worldX: number, worldY: number): number {
    const dx = worldX - centerX;
    const dy = worldY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.001) return 0;
    const angle = Math.atan2(dy, dx);
    const R = radiusAt(angle);
    return dist / R;
  }

  function isInside(worldX: number, worldY: number): boolean {
    return normalizedDist(worldX, worldY) <= 1.0;
  }

  // --- Return shape object ---
  return {
    radiusAt,
    normalizedDist,
    isInside,
    pressureDirection: primaryDir,
    pressureAt,
    tideScale,
    centerX,
    centerY,
  };
}
