/**
 * The fixed rift map for Slice 1 (hand-authored, no procedural generation).
 *
 * This file is pure data: the tile grid plus the content anchors that other systems
 * consume. Rendering lives in `systems/tilemap-renderer.ts`, so the same data can be
 * fed to any scene.
 *
 * ---------------------------------------------------------------------------
 * LAYOUT — OUTDOOR OPEN SPACE
 * ---------------------------------------------------------------------------
 * The rift is a swallowed outdoor fragment — a piece of some other world pulled
 * into the void. The map is mostly open floor with scattered static obstacles
 * (rock formations, ruined walls, alien debris, cliff fragments) that compress
 * the player's movement space and break sight lines.
 *
 * Spawn sits bottom-center, extraction top-center; the player must cross 3-4
 * distinct "zones" separated by major obstacle clusters. Multiple paths exist
 * between all zones — no corridors, always 2+ ways around any obstacle.
 *
 * Zone layout (top to bottom):
 *   Zone 4 (rows 1-7):   Extraction area — moderate obstacles, last gate patrol
 *   Zone 3 (rows 8-14):  Upper contested — dense obstacles, two patrols
 *   Zone 2 (rows 15-22): Lower transition — C-shape ruin, cliff ridge, loop patrol
 *   Zone 1 (rows 23-30): Spawn area — sparse obstacles, safe start
 *
 * Obstacle density: ~12% interior wall tiles. Gaps between adjacent clusters
 * average 3-5 tiles horizontally, breaking most 7-tile sight lines in the
 * contested zones while leaving spawn area relatively open for learning.
 *
 * Obstacle shapes: L-shapes, T-shapes, C-shapes, irregular clusters (2-12 tiles),
 * linear ridge/cliff features, pillar pairs. No rectangles that read as "rooms".
 *
 * ---------------------------------------------------------------------------
 * ASCII LEGEND
 * ---------------------------------------------------------------------------
 *   #        wall / obstacle     .   walkable floor (outdoor ground)
 *   S        player spawn        X   extraction point
 *   1-8      kindling KDL_01..KDL_08 (1-3 safe, 4-6 contested, 7-8 deep)
 *   A B      ENM_INF_01 patrol waypoints (first = spawn)
 *   C D      ENM_INF_02
 *   E F G H  ENM_INF_03
 *   J K      ENM_INF_04
 *
 * Markers always occupy floor tiles; `validateRiftMap()` fails loudly if that
 * ever stops being true.
 */

import { TileType, type Vector2 } from '@/types/game-types';
import type {
  EnemySpawnData,
  KindlingNodeDef,
  KindlingTier,
  LandmarkDef,
  PatrolMode,
  RiftLayoutData,
  TileMapData,
} from '@/types/map-types';
import { TileGrid } from '@/systems/tile-grid';
import { GAME_CONSTANTS } from '@/config/constants';

/** 48 x 32 tiles = 1536 x 1024 px. */
const RIFT_MAP_ASCII: readonly string[] = [
  '################################################',
  '#..............................................#',
  '#.....##..............X.........###............#',
  '#.....###.........##..............##.....##....#',
  '#..........##...............##.................#',
  '#.......J....##.......................K...##...#',
  '#.....##...........###........##...............#',
  '#.........##.............##............##......#',
  '#..7........###........##..........###.........#',
  '#...####..........######.........##............#',
  '#...###..........##....##...........6..........#',
  '#........##.........##...........##............#',
  '#.........##.............###...................#',
  '#.....C...##........5....###..........D........#',
  '#...####..........##.....##....................#',
  '#..##.........##..........##..........###......#',
  '#......###............##.......###.............#',
  '#.....E...##.....##...................##.......#',
  '#......####..........##............4.....##....#',
  '#..............####.........##...........##....#',
  '#..##..........###..........##........###......#',
  '#.............##...............##...F.....8....#',
  '#...........##............##...................#',
  '#.......##........##........##.................#',
  '#.....H.......##...................G...##......#',
  '#...........3........##...........##...........#',
  '#....##.....A.................2......B.........#',
  '#........##...........1............##..........#',
  '#.....................S..........##............#',
  '#....##....................##..................#',
  '#..............................................#',
  '################################################',
];

/** Tier per kindling marker. Values come from `LOOT.VALUE_*` (T9); see the tier table. */
const KINDLING_TIERS: Readonly<Record<string, KindlingTier>> = {
  '1': 'safe',
  '2': 'safe',
  '3': 'safe',
  '4': 'contested',
  '5': 'contested',
  '6': 'contested',
  '7': 'deep',
  '8': 'deep',
};

/**
 * Patrol units. `waypointChars` lists the ASCII markers of the route in walk order;
 * the first one doubles as the spawn tile.
 */
interface PatrolUnitDef {
  readonly id: string;
  readonly waypointChars: string;
  readonly mode: PatrolMode;
  readonly facing: number;
  readonly pauseMs?: number;
  readonly scanAngles?: readonly number[];
  /** Author's note on what this unit is for; kept so tuning has context. */
  readonly role: string;
}

const PATROL_UNITS: readonly PatrolUnitDef[] = [
  {
    id: 'ENM_INF_01',
    waypointChars: 'AB',
    mode: 'pingpong',
    facing: 0,
    role: 'spawn area sweep; east-west patrol covering the open ground between safe kindling and the transition zone',
  },
  {
    id: 'ENM_INF_02',
    waypointChars: 'CD',
    mode: 'pingpong',
    facing: 0,
    role: 'upper contested area; sweeps east-west through the debris field, guards KDL_05 and approach to deep zone',
  },
  {
    id: 'ENM_INF_03',
    waypointChars: 'EFGH',
    mode: 'loop',
    facing: 0,
    role: 'rectangular loop in the transition zone; covers the C-shape ruin and cliff ridge areas, guards KDL_04 and KDL_08 approaches',
  },
  {
    id: 'ENM_INF_04',
    waypointChars: 'JK',
    mode: 'pingpong',
    facing: 0,
    scanAngles: [180, 0],
    role: 'top zone gate; sweeps east-west in the extraction approach — the last obstacle before exit',
  },
];

/**
 * Visual landmarks placed at key junctions for navigation orientation.
 * All positions are verified to land on floor tiles during `validateRiftMap()`.
 */
const LANDMARKS: readonly LandmarkDef[] = [
  { id: 'LMK_POOL', col: 28, row: 6, style: 'pool' },
  { id: 'LMK_SCRATCHES', col: 20, row: 26, style: 'scratches' },
  { id: 'LMK_RUBBLE', col: 8, row: 15, style: 'rubble' },
  { id: 'LMK_CRACK', col: 40, row: 18, style: 'crack' },
  { id: 'LMK_SCORCH', col: 30, row: 4, style: 'scorch' },
  { id: 'LMK_CRYSTALS', col: 41, row: 9, style: 'crystals' },
  { id: 'LMK_BLOODTRAIL', col: 22, row: 22, style: 'bloodtrail' },
  { id: 'LMK_RUNE', col: 6, row: 19, style: 'rune' },
];

// ---------------------------------------------------------------------------
// Parsing (runs once at module load; the map is static)
// ---------------------------------------------------------------------------

interface ParsedRiftMap {
  readonly tileMap: TileMapData;
  readonly grid: TileGrid;
  readonly layout: RiftLayoutData;
}

function parseRiftMap(): ParsedRiftMap {
  const tileSize = GAME_CONSTANTS.TILE_SIZE;
  const rows = RIFT_MAP_ASCII.length;
  const cols = RIFT_MAP_ASCII[0]!.length;

  const tiles: number[][] = [];
  const markers = new Map<string, Vector2>();

  for (let row = 0; row < rows; row++) {
    const line = RIFT_MAP_ASCII[row]!;
    if (line.length !== cols) {
      throw new Error(`rift-map-data: row ${row} has ${line.length} chars, expected ${cols}`);
    }
    const tileRow: number[] = new Array(cols);
    for (let col = 0; col < cols; col++) {
      const char = line[col]!;
      tileRow[col] = char === '#' ? TileType.WALL : TileType.FLOOR;
      if (char !== '#' && char !== '.') {
        if (markers.has(char)) {
          throw new Error(`rift-map-data: marker '${char}' appears more than once`);
        }
        markers.set(char, {
          x: col * tileSize + tileSize / 2,
          y: row * tileSize + tileSize / 2,
        });
      }
    }
    tiles.push(tileRow);
  }

  const requireMarker = (char: string): Vector2 => {
    const position = markers.get(char);
    if (!position) throw new Error(`rift-map-data: missing marker '${char}'`);
    return position;
  };

  const kindlingNodes: KindlingNodeDef[] = Object.keys(KINDLING_TIERS)
    .sort()
    .map((char) => ({
      id: `KDL_0${char}`,
      tier: KINDLING_TIERS[char]!,
      position: requireMarker(char),
    }));

  const enemySpawns: EnemySpawnData[] = PATROL_UNITS.map((unit) => {
    const waypoints = unit.waypointChars.split('').map((char) => {
      const position = requireMarker(char);
      return {
        col: Math.floor(position.x / tileSize),
        row: Math.floor(position.y / tileSize),
      };
    });
    return {
      id: unit.id,
      type: 'infiltrator' as const,
      spawn: waypoints[0]!,
      facing: unit.facing,
      patrol: {
        waypoints,
        mode: unit.mode,
        pauseMs: unit.pauseMs,
        scanAngles: unit.scanAngles,
      },
    };
  });

  const tileMap: TileMapData = { cols, rows, tileSize, tiles };

  return {
    tileMap,
    grid: new TileGrid(tileMap),
    layout: {
      spawnPoint: requireMarker('S'),
      extractionPoint: {
        id: 'EXIT_01',
        position: requireMarker('X'),
        triggerRadius: GAME_CONSTANTS.PURIFICATION.INTERACTION_RADIUS,
      },
      kindlingNodes,
      enemySpawns,
      landmarks: LANDMARKS,
    },
  };
}

/** The parsed fixed rift map. Immutable for the lifetime of the page. */
export const RIFT_MAP: ParsedRiftMap = parseRiftMap();

export { RIFT_MAP_ASCII, PATROL_UNITS };

// ---------------------------------------------------------------------------
// Development-time validation
// ---------------------------------------------------------------------------

/**
 * Checks the invariants the rest of Slice 1 depends on and returns human-readable
 * problems. Called from `RiftScene` in dev builds - a broken fixed map has to fail
 * loudly rather than manifest as an enemy stuck in a wall three tasks later.
 */
export function validateRiftMap(): string[] {
  const { grid, layout } = RIFT_MAP;
  const problems: string[] = [];
  const tileSize = grid.tileSize;
  const toTile = (p: Vector2) => ({
    col: Math.floor(p.x / tileSize),
    row: Math.floor(p.y / tileSize),
  });

  const check = (label: string, p: Vector2): void => {
    const { col, row } = toTile(p);
    if (!grid.isWalkable(col, row)) problems.push(`${label} at tile (${col},${row}) is not walkable`);
  };

  check('spawnPoint', layout.spawnPoint);
  check('extractionPoint', layout.extractionPoint.position);
  for (const node of layout.kindlingNodes) check(node.id, node.position);
  for (const landmark of layout.landmarks) {
    if (!grid.isWalkable(landmark.col, landmark.row)) {
      problems.push(`${landmark.id} at tile (${landmark.col},${landmark.row}) is not walkable`);
    }
  }
  for (const enemy of layout.enemySpawns) {
    enemy.patrol.waypoints.forEach((wp, i) => {
      if (!grid.isWalkable(wp.col, wp.row)) {
        problems.push(`${enemy.id} waypoint ${i} at (${wp.col},${wp.row}) is not walkable`);
      }
    });
  }

  // Everything the player must reach has to be reachable from the spawn.
  const reachable = floodFill(grid, toTile(layout.spawnPoint));
  const index = (col: number, row: number) => row * grid.cols + col;
  const reach = (label: string, p: Vector2): void => {
    const { col, row } = toTile(p);
    if (!reachable[index(col, row)]) problems.push(`${label} is unreachable from spawn`);
  };
  reach('extractionPoint', layout.extractionPoint.position);
  for (const node of layout.kindlingNodes) reach(node.id, node.position);
  for (const enemy of layout.enemySpawns) {
    for (let i = 0; i < enemy.patrol.waypoints.length; i++) {
      const wp = enemy.patrol.waypoints[i]!;
      if (!reachable[index(wp.col, wp.row)]) {
        problems.push(`${enemy.id} waypoint ${i} is unreachable from spawn`);
      }
    }
  }

  return problems;
}

/** 8-way flood fill that refuses to cut corners, matching what an AABB body can do. */
function floodFill(grid: TileGrid, start: { col: number; row: number }): Uint8Array {
  const seen = new Uint8Array(grid.cols * grid.rows);
  if (!grid.isWalkable(start.col, start.row)) return seen;

  const queue: number[] = [start.row * grid.cols + start.col];
  seen[queue[0]!] = 1;

  while (queue.length > 0) {
    const current = queue.pop()!;
    const col = current % grid.cols;
    const row = (current - col) / grid.cols;

    for (let dRow = -1; dRow <= 1; dRow++) {
      for (let dCol = -1; dCol <= 1; dCol++) {
        if (dCol === 0 && dRow === 0) continue;
        const nextCol = col + dCol;
        const nextRow = row + dRow;
        if (!grid.isWalkable(nextCol, nextRow)) continue;
        if (dCol !== 0 && dRow !== 0) {
          if (!grid.isWalkable(col + dCol, row) || !grid.isWalkable(col, row + dRow)) continue;
        }
        const next = nextRow * grid.cols + nextCol;
        if (seen[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
  }

  return seen;
}
