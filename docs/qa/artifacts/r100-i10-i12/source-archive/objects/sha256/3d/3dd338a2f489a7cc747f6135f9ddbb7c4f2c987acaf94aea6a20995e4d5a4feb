import type { ChamberPixels } from './purification-chamber-pixels';
import { paintAuthoredEnvironmentLayer } from './chamber-authored-architecture';
import { CHAMBER_EXTERIOR_LAYERS, type ChamberExteriorLayer } from '../scenes/chamber-exterior-motion';
import { MATERIAL } from '../../assets/source/purification-r9/environment';
export { CHAMBER_EXTERIOR_LAYERS, type ChamberExteriorLayer } from '../scenes/chamber-exterior-motion';

export function paintChamberExteriorLayer(p: ChamberPixels, layer: ChamberExteriorLayer): void {
  paintAuthoredEnvironmentLayer(p, layer);
}

/** Compatible still-image compositor. Runtime allocates the three independent plates. */
export function paintChamberExterior(p: ChamberPixels): void {
  for (const layer of CHAMBER_EXTERIOR_LAYERS) paintChamberExteriorLayer(p, layer.id);
}

/** An incomplete remote silhouette, baked once into an 80×96 plate. It has no
 * eyes, light, identifiable species, or interaction affordance. */
export function paintChamberDistantPresence(p: ChamberPixels): void {
  p.poly([[30,10],[39,6],[46,16],[47,30],[59,35],[67,52],[61,63],[65,81],
    [52,90],[46,75],[33,72],[27,81],[18,76],[22,62],[14,52],[19,41],[31,34]], MATERIAL.void);
  p.poly([[39,6],[46,16],[47,30],[59,35],[63,42],[51,38],[39,23]], MATERIAL.farReturn);
  p.poly([[61,63],[65,81],[52,90],[48,82],[56,73],[55,63]], MATERIAL.farReturn);
}
