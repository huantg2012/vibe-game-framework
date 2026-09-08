/**
 * Observation yard for the contamination-lexicon practice lesson.
 * Not a generated rift island. Pins are baked so 乙/丙/丁 have a legal seat.
 * 丙座是可走地板，不是氛围簇核。
 */

import { GAME_CONSTANTS } from '@/config/constants';
import type { ContaminationPins } from '@/generation/types';
import { TileType, type TileCoord, type Vector2 } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';

export const LEXICON_ARENA_COLS = 20;
export const LEXICON_ARENA_ROWS = 14;

/** Default matches a common map-lesson fragment (clinic). Geometry ignores the id. */
export const LEXICON_DEFAULT_FRAGMENT = 'frag-clinic';

const TILE = GAME_CONSTANTS.TILE_SIZE;

function isCover(col: number, row: number): boolean {
  return col >= 7 && col <= 9 && row >= 4 && row <= 8;
}

function isBorder(col: number, row: number): boolean {
  return col === 0 || row === 0 || col === LEXICON_ARENA_COLS - 1 || row === LEXICON_ARENA_ROWS - 1;
}

export function createLexiconObserveMap(
  fragmentTypeId: string = LEXICON_DEFAULT_FRAGMENT,
): TileMapData {
  void fragmentTypeId;
  const tiles: number[][] = [];
  for (let row = 0; row < LEXICON_ARENA_ROWS; row++) {
    const line: number[] = [];
    for (let col = 0; col < LEXICON_ARENA_COLS; col++) {
      line.push(isBorder(col, row) || isCover(col, row) ? TileType.WALL : TileType.FLOOR);
    }
    tiles.push(line);
  }
  return {
    cols: LEXICON_ARENA_COLS,
    rows: LEXICON_ARENA_ROWS,
    tileSize: TILE,
    tiles,
  };
}

export function lexiconPlayerSpawn(): Vector2 {
  return { x: 3.5 * TILE, y: 7.5 * TILE };
}

/** Loop around the yard. Walkable, from the player-side door around the cover. */
export const LEXICON_JIA_WAYPOINTS: readonly TileCoord[] = [
  { col: 2, row: 2 },
  { col: 16, row: 2 },
  { col: 16, row: 11 },
  { col: 2, row: 11 },
];

export function lexiconJiaSpawn(index: number): TileCoord {
  const points = LEXICON_JIA_WAYPOINTS;
  return points[index % points.length]!;
}

export function lexiconPracticePins(): ContaminationPins {
  const wallTiles: { col: number; row: number }[] = [];
  const strikeFloors: { col: number; row: number }[] = [];
  for (let row = 4; row <= 8; row++) {
    wallTiles.push({ col: 9, row });
    strikeFloors.push({ col: 10, row });
  }
  // R3 doors require an architectural end/opening, including the walkable
  // tangent around the end. These cells already exist in the shared yard map.
  // Keep the actual wall-seat validator; do not bypass it for the inspector.
  strikeFloors.push({ col: 9, row: 3 }, { col: 10, row: 3 },
    { col: 9, row: 9 }, { col: 10, row: 9 });
  const clusterCol = 12;
  const clusterRow = 11;
  return {
    wallEdges: [{ tiles: wallTiles, strikeFloors }],
    paintFloors: [
      {
        floorCol: clusterCol,
        floorRow: clusterRow,
        onGreedy: false,
        throatScore: 2,
      },
    ],
    corridorAabbs: [
      { minCol: 12, minRow: 3, maxCol: 17, maxRow: 8, coreCol: 14, coreRow: 5 },
    ],
  };
}
