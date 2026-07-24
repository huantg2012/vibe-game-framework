import type { RGB } from './types';
export const rgbDistance = (a: RGB, b: RGB): number =>
  Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
export const rgbToLuma = ([r,g,b]: RGB): number => 0.299*r + 0.587*g + 0.114*b;
export function nearestColor(px: RGB, palette: RGB[]): RGB {
  if (palette.length === 0) throw new Error('nearestColor: empty palette');
  let best = palette[0], bestD = Infinity;
  for (const c of palette){ const d = rgbDistance(px,c); if (d<bestD){ bestD=d; best=c; } }
  return best;
}
