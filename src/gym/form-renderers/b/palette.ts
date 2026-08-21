/**
 * Locked-palette copy for scheme B. Do not add hex.
 * Bright cores snap to the three allowed teals; everything else nearest-neighbour.
 */

export type Rgb = readonly [number, number, number];

export const PALETTE_HEX = [
  '#080a0c', '#0a0b0d', '#0d1114', '#151a1e', '#2a2420', '#1e2228', '#2a2018', '#24221e',
  '#1a1e18', '#2c2e33', '#3a3d42', '#4a4e55', '#5a5f66', '#8a5c2a', '#c4873a', '#1a7a9a',
  '#0e4a3f', '#1a6b5c', '#1aad96', '#2ae6c8', '#3cffd4', '#7fffee', '#4adf8a', '#b0fff5',
  '#e0a848', '#2e2d30', '#2a2a2e', '#3a3838', '#1a1c1f', '#2a1f1c', '#8a8f96', '#c8cdd4',
  '#cc3333', '#b89040', '#2a2d32', '#0f1114',
] as const;

const PALETTE: readonly Rgb[] = PALETTE_HEX.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

/** Allowed bright cores (iteration-2 contract). */
export const CORE_TEAL = {
  core: [0x1a, 0xad, 0x96] as Rgb,
  glow: [0x2a, 0xe6, 0xc8] as Rgb,
  bright: [0x3c, 0xff, 0xd4] as Rgb,
};

const CORE_CHOICES: readonly Rgb[] = [CORE_TEAL.core, CORE_TEAL.glow, CORE_TEAL.bright];

export function nearestPalette(r: number, g: number, b: number): Rgb {
  let best = PALETTE[0]!;
  let bestD = Infinity;
  for (const p of PALETTE) {
    const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function snapCoreTeal(r: number, g: number, b: number): Rgb {
  let best = CORE_CHOICES[0]!;
  let bestD = Infinity;
  for (const p of CORE_CHOICES) {
    const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2;
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

export function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >> 13), 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export const GREY_FLOOR = nearestPalette(0x1a, 0x1e, 0x18);
export const GREY_SHADOW = nearestPalette(0x15, 0x1a, 0x1e);
export const GREY_WALL = nearestPalette(0x2c, 0x2e, 0x33);
export const GREY_BONE = nearestPalette(0x3a, 0x38, 0x38);
export const GREY_EARTH = nearestPalette(0x1a, 0x1c, 0x1f);
export const TEAL_COLD = nearestPalette(0x1a, 0x7a, 0x9a);
export const TEAL_DEEP = nearestPalette(0x0e, 0x4a, 0x3f);
export const TEAL_MID = nearestPalette(0x1a, 0x6b, 0x5c);
