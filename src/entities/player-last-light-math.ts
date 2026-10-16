import { lastLightBasis, projectLastLight, type LastLightCamera, type LightVector } from '@/art/last-light-spatial';

/** The accepted A export camera. These are presentation units, never collision units. */
export const LAST_LIGHT_PLAYER_CAMERA: LastLightCamera = {
  width: 64, height: 80, origin: [32, 66], scale: 26.5,
  target: [0, 0, 0], direction: [19, 24, 30],
};
export const LAST_LIGHT_PLAYER_BASIS = lastLightBasis(LAST_LIGHT_PLAYER_CAMERA);
const horizontalBackLength = Math.hypot(LAST_LIGHT_PLAYER_BASIS.back[0], LAST_LIGHT_PLAYER_BASIS.back[2]);
/** Rotate Y-up source coordinates to the native world's Z-up ground axes. */
export function lastLightToNative(point: LightVector): [number, number, number] {
  const { right, back } = LAST_LIGHT_PLAYER_BASIS;
  return [point[0] * right[0] + point[2] * right[2],
    (point[0] * back[0] + point[2] * back[2]) / horizontalBackLength, point[1]];
}
export function lastLightScreenHeading(yaw: number): number {
  const p = projectLastLight([Math.sin(yaw), 0, Math.cos(yaw)], LAST_LIGHT_PLAYER_CAMERA, LAST_LIGHT_PLAYER_BASIS);
  return Math.atan2(p[1] - 66, p[0] - 32);
}
export function nearestLastLightYaw(heading: number, projectedHeadings: readonly number[]): number {
  let best = 0, score = -Infinity;
  for (let i = 0; i < projectedHeadings.length; i++) {
    const candidate = Math.cos(heading - projectedHeadings[i]!);
    if (candidate > score) { score = candidate; best = i; }
  }
  return best;
}
