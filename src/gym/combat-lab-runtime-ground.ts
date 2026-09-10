/** Geometry is a controlled test fixture; ground shading is the production rift painter. */
import type { RuinedMask } from '@/generation/types';
import { createLexiconObserveMap } from '@/gym/gym-lexicon-arena';
import { TileType } from '@/types/game-types';

export function createCombatLabGround(fragmentTypeId: string, seed: number): RuinedMask {
  const tileMap = createLexiconObserveMap(fragmentTypeId);
  // A single-cell partition for real phase-tool practice, away from the sparring lane.
  for (let row = 5; row <= 8; row++) tileMap.tiles[row]![4] = TileType.WALL;
  const { cols, rows, tileSize } = tileMap;
  const walls = new Uint8Array(cols * rows);
  const land = new Uint8Array(cols * rows).fill(1);
  let wallCount = 0;
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    if (tileMap.tiles[row]![col] === TileType.WALL) { walls[row * cols + col] = 1; wallCount++; }
  }
  return { seed, attempt: 0, fragmentTypeId, tileMap, walls, features: [],
    contaminationAge: 'standard', ruinSeverity: 'broken',
    outline: { seed, attempt: 0, cols, rows, tileSize, land, tileMap,
      metrics: { landCount: cols * rows, fillRatio: 1, bbox: { minCol: 0, minRow: 0,
        maxCol: cols - 1, maxRow: rows - 1, width: cols, height: rows },
      bboxFill: 1, borderOccupancy: 1, edgesTouching: 4, roughness: 0 } },
    metrics: { wallCount, wallRatio: wallCount / (cols * rows), featureCount: 0, leftoverConnected: true },
  };
}
