/** Lock-palette copy for scheme C. Do not import preview-paint. */

const PALETTE_HEX = [
  '#080a0c', '#0a0b0d', '#0d1114', '#151a1e', '#2a2420', '#1e2228', '#2a2018', '#24221e',
  '#1a1e18', '#2c2e33', '#3a3d42', '#4a4e55', '#5a5f66', '#8a5c2a', '#c4873a', '#1a7a9a',
  '#0e4a3f', '#1a6b5c', '#1aad96', '#2ae6c8', '#3cffd4', '#7fffee', '#4adf8a', '#b0fff5',
  '#e0a848', '#2e2d30', '#2a2a2e', '#3a3838', '#1a1c1f', '#2a1f1c', '#8a8f96', '#c8cdd4',
  '#cc3333', '#b89040', '#2a2d32', '#0f1114',
] as const;

const PALETTE: ReadonlyArray<readonly [number, number, number]> = PALETTE_HEX.map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]);

export function nearestPalette(r: number, g: number, b: number): readonly [number, number, number] {
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

export function rgbFromHex(hex: string): readonly [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return nearestPalette(r, g, b);
}

/** Named lock-palette inks used by C stamps. Glow cores stay on the three allowed teals. */
export const INK = {
  void: '#080a0c',
  ambient: '#0d1114',
  shadow: '#151a1e',
  concrete: '#2c2e33',
  metalMid: '#3a3d42',
  metal: '#4a4e55',
  flesh: '#2e2d30',
  cloth: '#2a2a2e',
  bone: '#3a3838',
  earth: '#1a1c1f',
  brick: '#2a1f1c',
  deep: '#0e4a3f',
  mid: '#1a6b5c',
  core: '#1aad96',
  glow: '#2ae6c8',
  bright: '#3cffd4',
} as const;
