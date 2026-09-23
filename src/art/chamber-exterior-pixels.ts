import type { ChamberPixels } from './purification-chamber-pixels';
import { paintAuthoredEnvironmentLayer } from './chamber-authored-architecture';

export type ChamberExteriorLayer = 'far' | 'middle' | 'near';
/** More distant mass moves less than the room under a real camera translation.
 * No autonomous drifting wallpaper. Fixed pixel art silhouettes remain rigid. */
export const CHAMBER_EXTERIOR_LAYERS = [
  { id: 'far', depth: -60, scrollFactor: .12 },
  { id: 'middle', depth: -55, scrollFactor: .52 },
  { id: 'near', depth: -50, scrollFactor: 1 },
] as const;

export function paintChamberExteriorLayer(p: ChamberPixels, layer: ChamberExteriorLayer): void {
  paintAuthoredEnvironmentLayer(p, layer);
}

/** Compatible still-image compositor. Runtime allocates the three independent plates. */
export function paintChamberExterior(p: ChamberPixels): void {
  for (const layer of CHAMBER_EXTERIOR_LAYERS) paintChamberExteriorLayer(p, layer.id);
}
