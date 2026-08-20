/**
 * Gym arena: a walled yard plus one loop per enemy role.
 *
 * Loops are 8 waypoints whose successive legs are east / southeast / south /
 * southwest / west / northwest / north / northeast. A* is 8-connected, so those
 * legs actually walk those headings instead of only snapping to a rectangle.
 *
 * Adding a CSV enemy role: add a loop here (`Record<EnemyRole, …>` will not
 * compile until you do). AISystem still requires exactly one rewriter in the
 * spawn table — do not add a second rewriter to demonstrate a skin.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { ENEMY_DATA, ENEMY_ROLES, type EnemyRole } from '@/generated/enemy-data';
import { TileType, type TileCoord } from '@/types/game-types';
import type { EnemySpawnData, TileMapData } from '@/types/map-types';

export const GYM_COLS = 18;
export const GYM_ROWS = 12;

/**
 * One closed octagon per role. Inner rewriter loop stays off the infiltrator
 * walls so they do not share a single file.
 */
export const GYM_LOOPS: Record<EnemyRole, readonly TileCoord[]> = {
  infiltrator: [
    { col: 2, row: 2 },
    { col: 9, row: 2 },
    { col: 15, row: 4 },
    { col: 15, row: 8 },
    { col: 9, row: 10 },
    { col: 2, row: 10 },
    { col: 1, row: 6 },
    { col: 1, row: 3 },
  ],
  rewriter: [
    { col: 4, row: 4 },
    { col: 10, row: 4 },
    { col: 13, row: 5 },
    { col: 13, row: 8 },
    { col: 10, row: 9 },
    { col: 4, row: 9 },
    { col: 3, row: 7 },
    { col: 3, row: 5 },
  ],
};

const FACING_ALONG_FIRST_LEG: Record<EnemyRole, number> = {
  infiltrator: 0,
  rewriter: 0,
};

export function createGymTileMap(): TileMapData {
  const tiles: number[][] = [];
  for (let row = 0; row < GYM_ROWS; row++) {
    const line: number[] = [];
    for (let col = 0; col < GYM_COLS; col++) {
      const edge = row === 0 || col === 0 || row === GYM_ROWS - 1 || col === GYM_COLS - 1;
      line.push(edge ? TileType.WALL : TileType.FLOOR);
    }
    tiles.push(line);
  }
  return {
    cols: GYM_COLS,
    rows: GYM_ROWS,
    tileSize: GAME_CONSTANTS.TILE_SIZE,
    tiles,
  };
}

export function createGymEnemySpawns(): EnemySpawnData[] {
  return ENEMY_ROLES.map((role) => spawnFor(role));
}

function spawnFor(role: EnemyRole): EnemySpawnData {
  const waypoints = GYM_LOOPS[role];
  const start = waypoints[0];
  if (!start) {
    throw new Error(`[gym] missing loop for ${role}`);
  }
  return {
    id: `gym-${role}`,
    type: role,
    spawn: start,
    facing: FACING_ALONG_FIRST_LEG[role],
    patrol: {
      waypoints,
      mode: 'loop',
    },
  };
}

export function gymRosterLines(): readonly string[] {
  return ENEMY_ROLES.map((role) => `${ENEMY_DATA[role].displayName}（${role}）`);
}
