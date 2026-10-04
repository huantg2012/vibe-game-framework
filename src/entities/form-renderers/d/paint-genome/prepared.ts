/** Exact presentation bake identity; preparation never defines gameplay cells. */
import type { PaintGenomeBakeRequest, PaintGenomeBakeResult } from './bake';
export interface PreparedPaintGenome { readonly key: string; readonly baked: PaintGenomeBakeResult }
export function paintGenomePreparationKey(request: PaintGenomeBakeRequest): string {
  return JSON.stringify([request.substrate, request.coverage, request.seed, request.continuity,
    request.sense, request.rhythm, request.fragmentTypeId, request.veinVariant, request.geometryVersion]);
}
