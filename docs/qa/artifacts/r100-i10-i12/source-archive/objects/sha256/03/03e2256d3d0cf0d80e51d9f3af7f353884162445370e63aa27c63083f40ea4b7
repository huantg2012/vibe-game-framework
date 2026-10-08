/** Large-scale facies: one field drives color placement, material and grouped forms. */
import { materialHash as hash, materialNoise as noise } from './material-noise';
import type { SurfaceRecipe } from './types';

export function compositionOf(recipe: SurfaceRecipe) {
  return { organization: recipe.organization ?? 'patches', regionScale: recipe.regionScale ?? 1,
    quietness: recipe.quietness ?? .42, formScale: recipe.formScale ?? 1,
    fragmentation: recipe.fragmentation ?? .45, accentCoverage: recipe.accentCoverage ?? .10 };
}
export function regionFieldAt(recipe: SurfaceRecipe, seed: number, x: number, y: number, direction: number) {
  const spec = compositionOf(recipe), size = 300 * spec.regionScale;
  const warp = (noise(x / 187, y / 203, seed ^ 0x7211) - .5) * size * .26;
  const u = (x * Math.cos(direction) + y * Math.sin(direction) + warp) / size;
  const v = (-x * Math.sin(direction) + y * Math.cos(direction) - warp) / size;
  let density: number;
  if (spec.organization === 'bands') {
    // Broken broad ribbons; no tile grid or literal map-wide lattice.
    density = .5 + Math.sin(v * 4.1 + noise(u * .72, v * .63, seed ^ 0x19) * 4) * .33
      + (noise(u * 1.7, v * .9, seed ^ 0x31) - .5) * .26;
  } else {
    const gx = Math.floor(x / size), gy = Math.floor(y / size);
    let distance = Infinity, identity = 0;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const col = gx + ox, row = gy + oy;
      const cx = (col + .15 + hash(col, row, seed ^ 0x2121) * .7) * size;
      const cy = (row + .15 + hash(col, row, seed ^ 0x1811) * .7) * size;
      const dx = x - cx + warp, dy = y - cy - warp;
      const a = (dx * Math.cos(direction) + dy * Math.sin(direction)) / size;
      const b = (-dx * Math.sin(direction) + dy * Math.cos(direction)) / size;
      const d = a * a * .65 + b * b * (spec.organization === 'clusters' ? 1.9 : 1.1);
      if (d < distance) { distance = d; identity = hash(col, row, seed ^ 0x7419); }
    }
    density = Math.max(0, 1 - Math.sqrt(distance) * (spec.organization === 'clusters' ? 2.0 : 1.2));
    density *= .72 + identity * .4;
  }
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const quiet = clamp((spec.quietness + .23 - density) * 2.1);
  const activity = clamp((density - .22) * 1.8) * (1 - quiet);
  const accentSignal = noise(x / (size * .73), y / (size * .81), seed ^ 0x7831);
  const accent = spec.accentCoverage === 0 ? 0 : clamp((accentSignal - (1 - Math.sqrt(spec.accentCoverage))) * 3) * (.3 + activity * .7);
  return { density: clamp(density), activity, quiet, accent };
}
