import {lastLightBasis, type LastLightCamera} from './last-light-spatial';

export interface LastLightFacingPlane {
  /** Local ground height is y = dx * x + dz * z + constant. */
  readonly dx: number;
  readonly dz: number;
}

/** Screen keys in clockwise order, starting with D/right. Sprite direction
 * indices are authoring identities; they must not be treated as world yaw / 45°. */
export const LAST_LIGHT_SCREEN_DIRECTIONS = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
] as const;

/** Invert the actual camera projection on the walking plane. Equal screen
 * angles are not equal world angles under this oblique camera; the ramp also
 * changes the inverse. This must be shared by the actor bake and its checks. */
export function lastLightScreenFacingYaws(
  camera: LastLightCamera,
  plane: LastLightFacingPlane = {dx: 0, dz: 0},
): number[] {
  const {right, up} = lastLightBasis(camera);
  const a = right[0], c = right[2];
  const d = -(up[0] + up[1] * plane.dx), e = -(up[2] + up[1] * plane.dz);
  const determinant = a * e - c * d;
  if (![plane.dx, plane.dz, determinant].every(Number.isFinite) || Math.abs(determinant) < 1e-9) {
    throw new RangeError('Last Light facing requires a finite, visible walking plane.');
  }
  return LAST_LIGHT_SCREEN_DIRECTIONS.map(([sx, sy]) => {
    const x = (sx * e - c * sy) / determinant;
    const z = (a * sy - sx * d) / determinant;
    return Math.atan2(x, z);
  });
}

/** Keep stable flat-ground indices and append only genuinely different slope
 * facings. The same orientation has one atlas column, including ±π wrapping. */
export function mergeLastLightFacingYaws(...groups: readonly (readonly number[])[]): number[] {
  const result: number[] = [];
  for (const yaw of groups.flat()) {
    if (!Number.isFinite(yaw)) throw new RangeError('Last Light facing yaw must be finite.');
    const normalized = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    if (!result.some(existing => Math.abs(Math.atan2(Math.sin(existing - normalized), Math.cos(existing - normalized))) < 1e-6)) {
      result.push(normalized);
    }
  }
  return result;
}
