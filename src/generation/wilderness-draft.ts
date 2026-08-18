/**
 * Preview-only wilderness drafts. Top-down, seeded, not the live C2 generator.
 * Does not replace masses.ts. Does not wire RiftScene.
 */

import { leftoverDisconnectedCount, openSealedFloors } from '@/generation/connectivity';
import { generateOutline } from '@/generation/outline-mask';
import { mix32 } from '@/generation/seed-fork';
import { buildStructure, type StructureBuildSpec } from '@/generation/structure-grammars';
import type { RuinedMask } from '@/generation/types';
import { SeededRandom } from '@/utils/random';

export const WILDERNESS_KINDS = ['ridge', 'shear', 'hunks'] as const;
export type WildernessKind = (typeof WILDERNESS_KINDS)[number];

const SPECS: Record<WildernessKind, StructureBuildSpec> = {
  ridge: { grammar: 'ridge', density: 0.55, gapiness: 0.4, thickness: 2, align: 'free' },
  shear: { grammar: 'shear', density: 0.5, gapiness: 0.4, thickness: 1, align: 'free' },
  hunks: { grammar: 'hunks', density: 0.7, gapiness: 0.5, thickness: 1, align: 'free' },
};

function hashKind(kind: WildernessKind): number {
  return mix32(0xa5a5a5a5, kind);
}

export function generateWildernessDraft(seed: number, kind: WildernessKind): RuinedMask {
  const outline = generateOutline(seed);
  const rng = new SeededRandom((seed ^ hashKind(kind) ^ 0xa5a5a5a5) >>> 0);
  const built = buildStructure(outline, rng, SPECS[kind]);
  openSealedFloors(outline.land, built.walls, outline.cols, outline.rows);
  let wallCount = 0;
  for (let i = 0; i < built.walls.length; i++) if (built.walls[i]) wallCount++;
  const leftoverConnected = leftoverDisconnectedCount(outline.land, built.walls, outline.cols, outline.rows) === 0;
  const typeId = kind === 'shear' ? 'frag-metro' : 'frag-outdoor';
  return {
    seed,
    attempt: 0,
    fragmentTypeId: typeId,
    outline,
    walls: built.walls,
    features: [
      {
        kind: kind === 'hunks' ? 'cluster' : kind === 'shear' ? 'slab' : 'ridge',
        cells: [],
        paint: built.paint,
      },
    ],
    tileMap: outline.tileMap,
    metrics: {
      wallCount,
      wallRatio: outline.metrics.landCount === 0 ? 0 : wallCount / outline.metrics.landCount,
      featureCount: 1,
      leftoverConnected,
    },
  };
}
