/**
 * Math utility functions.
 * Pre-allocated temporary vectors to avoid GC in game loop.
 */

import type { Facing4, Position, Vector2 } from '@/types/game-types';

/** Pre-allocated temp vectors for calculations (do NOT store references to these) */
const _tempVec: Vector2 = { x: 0, y: 0 };

const TAU = Math.PI * 2;

/** Canonical angle of each four-way facing, in screen space (y grows downward). */
export const FACING4_ANGLES: Readonly<Record<Facing4, number>> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

const FACING4_ORDER: readonly Facing4[] = ['right', 'down', 'left', 'up'];

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

/** Wraps an angle difference into [-PI, PI] - the signed shortest way round. */
export function shortestArc(delta: number): number {
  let result = delta % TAU;
  if (result > Math.PI) result -= TAU;
  if (result < -Math.PI) result += TAU;
  return result;
}

/**
 * Rotates `current` toward `target` by at most `maxStep` radians along the shortest arc.
 * The returned angle is wrapped into [-PI, PI].
 *
 * Shared by the player and the enemies: turn *rate* is a per-entity balance value
 * (invariant I6 hangs on the ratio between them), but the turning rule is one rule.
 */
export function stepAngleToward(current: number, target: number, maxStep: number): number {
  const diff = shortestArc(target - current);
  if (Math.abs(diff) <= maxStep) return shortestArc(target);
  return shortestArc(current + Math.sign(diff) * maxStep);
}

/**
 * Quantises a continuous angle to four directions, keeping `current` until the angle is
 * more than 45 degrees + `hysteresis` (radians) away from it. The dead zone is what stops
 * a diagonal heading from flickering between two sprite frames.
 */
export function quantizeFacing4(angle: number, current: Facing4, hysteresis: number): Facing4 {
  if (Math.abs(shortestArc(angle - FACING4_ANGLES[current])) <= Math.PI / 4 + hysteresis) {
    return current;
  }

  let best = current;
  let bestDiff = Infinity;
  for (const candidate of FACING4_ORDER) {
    const diff = Math.abs(shortestArc(angle - FACING4_ANGLES[candidate]));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
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
