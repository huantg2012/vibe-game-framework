/** Sparse reflection samples seated on the actual baked material, never void. */
import type { WorldSample } from './types';
import type { Raster } from './raster';
import { worldSupportAt } from './support';
export interface MaterialHighlight { x: number; y: number; normal: number; color: number; strength: number; width: number; height: number; sharpness: number }
const cache = new WeakMap<WorldSample, MaterialHighlight[]>();
const overpaint = new WeakMap<WorldSample, { raster: Raster; written: Uint32Array; revision: number; registered: Map<MaterialHighlight, number> }>();
export function beginMaterialResponse(sample: WorldSample): MaterialHighlight[] {
  const previous = overpaint.get(sample);
  if (previous) {
    previous.raster.setPaintObserver(null);
    overpaint.delete(sample);
  }
  const values: MaterialHighlight[] = []; cache.set(sample, values); return values;
}

/** Later deposits and surface forms replace the underlying reflective material. */
export function trackMaterialOverpaint(sample: WorldSample, raster: Raster): void {
  if (overpaint.has(sample)) throw new Error('Material overpaint tracking is already active');
  const written = new Uint32Array(raster.width * raster.height);
  const tracked = { raster, written, revision: 0, registered: new Map<MaterialHighlight, number>() };
  overpaint.set(sample, tracked);
  raster.setPaintObserver((start, end) => written.fill(++tracked.revision, start, end));
}

/** Retire an entire small reflection sample if any of its footprint was covered. */
export function finishMaterialResponse(sample: WorldSample): void {
  const tracked = overpaint.get(sample);
  if (!tracked) return;
  tracked.raster.setPaintObserver(null);
  overpaint.delete(sample);
  const values = cache.get(sample);
  if (!values) return;
  const { raster, written } = tracked;
  let kept = 0;
  for (const value of values) {
    let covered = false;
    for (let dy = 0; dy < value.height && !covered; dy++) for (let dx = 0; dx < value.width; dx++) {
      const x = value.x + dx, y = value.y + dy;
      if (x < 0 || y < 0 || x >= raster.width || y >= raster.height || written[y * raster.width + x]! > (tracked.registered.get(value) ?? 0)) {
        covered = true;
        break;
      }
    }
    if (!covered) values[kept++] = value;
  }
  values.length = kept;
}

export function groundMaterialHighlights(sample: WorldSample): readonly MaterialHighlight[] { return cache.get(sample) ?? []; }

/** Register after painting the owning face. Later overpaint still invalidates it. */
export function registerFormHighlight(sample: WorldSample, value: MaterialHighlight): void {
  const tracked = overpaint.get(sample), values = cache.get(sample);
  if (!tracked || !values) return;
  const face = { ...value, x: Math.floor(value.x), y: Math.floor(value.y),
    width: Math.max(1, Math.floor(value.width)), height: Math.max(1, Math.floor(value.height)) };
  for (let dy = 0; dy < face.height; dy++) for (let dx = 0; dx < face.width; dx++) {
    if (!worldSupportAt(sample, face.x + dx, face.y + dy)) return;
  }
  tracked.registered.set(face, tracked.revision);
  values.push(face);
}
