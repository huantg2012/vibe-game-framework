/** Structured-clone boundary. Methods are rebuilt; world data are never reinterpreted. */
import type { GeneratedRiftLayout } from './types';
import type { WorldProductionMap } from './world-study/production-map';
import type { WorldProductionRecipe } from './world-study/production-recipe';
import type { RiftCheckpoint } from '@/types/rift-checkpoint';
import { TileGrid } from '@/systems/tile-grid';

export type RiftGenerationInput =
  | { readonly kind: 'departure'; readonly generation: WorldProductionRecipe }
  | { readonly kind: 'recovery'; readonly identity: RiftCheckpoint['identity'] };
export interface RiftGenerationRequest { readonly id: number; readonly input: RiftGenerationInput }
export type RiftLayoutWire = Omit<GeneratedRiftLayout, 'walkableMask'> & { readonly walkableMask: null };
export interface RiftGenerationWire {
  readonly layout: RiftLayoutWire;
  readonly world: (Omit<WorldProductionMap, 'layout'> & { readonly layout: RiftLayoutWire }) | null;
  readonly identity: RiftCheckpoint['identity'];
  readonly generationMs: number;
}
export type RiftGenerationResponse =
  | { readonly id: number; readonly result: RiftGenerationWire }
  | { readonly id: number; readonly error: string };

export function serializeRiftGeneration(layout: GeneratedRiftLayout, world: WorldProductionMap | null,
  identity: RiftCheckpoint['identity'], generationMs: number): RiftGenerationWire {
  const wireLayout: RiftLayoutWire = { ...layout, walkableMask: null };
  return { layout: wireLayout, world: world ? { ...world, layout: wireLayout } : null, identity, generationMs };
}

export function hydrateRiftGeneration(wire: RiftGenerationWire): { layout: GeneratedRiftLayout; world: WorldProductionMap | null } {
  if (!wire || !wire.layout || wire.layout.walkableMask !== null
    || (wire.world !== null && wire.world.layout !== wire.layout)) throw new Error('Malformed generated world transfer');
  const layout: GeneratedRiftLayout = { ...wire.layout, walkableMask: new TileGrid(wire.layout.tileMap) };
  return { layout, world: wire.world ? { ...wire.world, layout } : null };
}

/** Native raster buffers can be tens of MB. Transfer their ownership once rather
 * than copying them on the Worker exit; shared references are deduplicated. */
export function riftGenerationTransferables(wire: RiftGenerationWire): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>(), visited = new Set<object>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (ArrayBuffer.isView(value)) { if (value.buffer instanceof ArrayBuffer) buffers.add(value.buffer); return; }
    if (value instanceof ArrayBuffer) { buffers.add(value); return; }
    for (const item of Object.values(value)) visit(item);
  };
  visit(wire); return [...buffers];
}
