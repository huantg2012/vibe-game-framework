/** Hash every generated value, including scenery/material fields and Host map. */
import { createHash } from 'node:crypto';
import type { WorldProductionMap } from '../../src/generation/world-study/production-map';
import type { GeneratedRiftLayout } from '../../src/generation/types';

const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function legacyGenerationGold(layout: GeneratedRiftLayout, world: WorldProductionMap | null) {
  // Public geometry is verified by value; implementation-private TileGrid field
  // layout is deliberately excluded from serialization.
  const { walkableMask: _mask, ...content } = layout;
  return {
    layoutSha256: hash(content), tileMapSha256: hash(layout.tileMap),
    hostMapSha256: world ? hash(world.hostTileMap) : null,
    sampleSha256: world ? hash(world.sample) : null,
    metadataSha256: world ? hash(world.metadata) : null,
  };
}
