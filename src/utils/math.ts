/**
 * Math utility functions.
 * Pre-allocated temporary vectors to avoid GC in game loop.
 */

import type { Position, Vector2 } from '@/types/game-types';

/** Pre-allocated temp vectors for calculations (do NOT store references to these) */
const _tempVec: Vector2 = { x: 0, y: 0 };

/**
 * Calculate distance between two points.
 */
export function distance(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate squared distance (avoids sqrt, use for comparisons).
 */
export function distanceSq(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy;
}

/**
 * Normalize a vector in-place and return it.
 */
export function normalize(v: Vector2): Vector2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len > 0) {
    v.x /= len;
    v.y /= len;
  }
  return v;
}

/**
 * Get direction vector from a to b (uses temp vector - do not store).
 */
export function direction(from: Position, to: Position): Vector2 {
  _tempVec.x = to.x - from.x;
  _tempVec.y = to.y - from.y;
  return normalize(_tempVec);
}

/**
 * Angle between two points in radians.
 */
export function angleBetween(from: Position, to: Position): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Check if angle is within a cone (half-angle in radians).
 */
export function isInCone(facingAngle: number, targetAngle: number, halfAngle: number): boolean {
  let diff = targetAngle - facingAngle;
  // Normalize to [-PI, PI]
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.abs(diff) <= halfAngle;
}

/**
 * Linear interpolation.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp a value between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Convert degrees to radians.
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}
