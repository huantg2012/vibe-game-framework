/**
 * Shared sample count / breath clock for scheme D 丙.
 * `paintClusterBreath` still owns the DEC-070 silhouette scale; these numbers
 * must stay in lockstep with that painter (48 samples, ~3.1s cycle).
 */

export const BING_PULSE_SAMPLES = 48;

/** Same coefficient as `cluster-pulse.ts` BREATH. */
export const CLUSTER_BREATH = 0.002;

export function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >> 13), 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}
