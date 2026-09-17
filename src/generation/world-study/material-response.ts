/** Sparse reflection samples seated on the actual baked material, never void. */
import type { WorldSample } from './types';
export interface MaterialHighlight { x: number; y: number; normal: number; color: number; strength: number; width: number; height: number }
const cache = new WeakMap<WorldSample, MaterialHighlight[]>();
export function beginMaterialResponse(sample: WorldSample): MaterialHighlight[] {
  const values: MaterialHighlight[] = []; cache.set(sample, values); return values;
}
export function groundMaterialHighlights(sample: WorldSample): readonly MaterialHighlight[] { return cache.get(sample) ?? []; }
