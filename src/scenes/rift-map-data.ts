/**
 * The fixed rift map for Slice 1 (hand-authored, no procedural generation).
 *
 * This file is pure data: the tile grid plus the content anchors that other systems
 * consume. Rendering lives in `systems/tilemap-renderer.ts`, so the same data can be
 * fed to any scene.
 *
 * ---------------------------------------------------------------------------
 * LAYOUT
 * ---------------------------------------------------------------------------
 * Spawn sits bottom-left, the extraction point top-left; the route between them
 * never doubles back (docs/specs/system-chaos-scavenge-extract.md rule 21).
 *
 * Two ways across, both ending on the same final corridor:
 *   - SHORT / EXPOSED (~177 tiles, ~35 s of pure walking): bottom corridor -> the open
 *     central shaft -> upper corridor -> right riser -> top corridor -> exit. The shaft
 *     is a wide open hall with almost no cover and one patrol looping inside it.
 *   - LONG / HIDDEN (~228 tiles, ~46 s): bottom corridor all the way right -> right
 *     riser -> middle corridor -> left riser -> upper corridor -> ... The middle
 *     corridor is baffled the whole way, so it is slower but keeps walls between the
 *     player and everything else.
 *
 * Every corridor is 3 tiles tall with alternating single-tile wall stubs ("baffles").
 * They leave a 1-tile gap (passable, `BODY_SIZE` 20 < 32) while breaking sight lines
 * along the corridor, which is what makes peeking and corner-holding meaningful.
 *
 * The last stretch to the extraction point is the top corridor, patrolled by
 * `ENM_INF_04`. The extraction chamber itself sits behind the wall stub at column 11
 * and is 17 tiles from the nearest patrol waypoint, so it is never inside a patrol's
 * standing line of sight.
 *
 * ---------------------------------------------------------------------------
 * MEASURED TRAVEL COSTS (Dijkstra, 8-way, no corner cutting, at MOVE_SPEED 160 px/s)
 * ---------------------------------------------------------------------------
 *   spawn -> exit, short route : 177 tiles (~35 s)
 *   spawn -> exit, long route  : 228 tiles (~46 s)
 *   round-trip detour per node : KDL_01/02/04 ~0 | KDL_03 14 | KDL_05 1 | KDL_06 2
 *                                KDL_07 54 | KDL_08 50
 *   full clear, walking only   : ~297 tiles (~59 s), before any waiting on patrols
 *
 * Both deep nodes sit >= 25 tiles off the main route one-way, satisfying the ">= 15
 * tile" layout requirement. NOTE FOR T9: the chaos spec's `BASE_RATE` derivation
 * assumed a full clear of ~220 s and asks for a recalculation once the map is final
 * (target: full-clear time ~= time-to-HARD_CAP x 1.15). The numbers above are the
 * walking-only floor; the remainder has to come from waiting on patrol windows, so
 * `BASE_RATE` must be re-measured against real play, not recomputed on paper.
 *
 * ---------------------------------------------------------------------------
 * ASCII LEGEND
 * ---------------------------------------------------------------------------
 *   #        wall              .   walkable floor
 *   S        player spawn      X   extraction point
 *   1-8      kindling KDL_01..KDL_08 (1-3 safe, 4-6 contested, 7-8 deep)
 *   A B      ENM_INF_01 patrol waypoints, in alphabetical order (first = spawn)
 *   C D      ENM_INF_02
 *   E F G H  ENM_INF_03
 *   J K      ENM_INF_04
 *
 * Markers always occupy floor tiles; `validateRiftMap()` fails loudly if that ever
 * stops being true.
 */

import { TileType, type Vector2 } from '@/types/game-types';
import type {
  EnemySpawnData,
  KindlingNodeDef,
  KindlingTier,
  PatrolMode,
  RiftLayoutData,
  TileMapData,
} from '@/types/map-types';
import { TileGrid } from '@/systems/tile-grid';
import { GAME_CONSTANTS } from '@/config/constants';

/** 64 x 44 tiles = 2048 x 1408 px. */
const RIFT_MAP_ASCII: readonly string[] = [
  '################################################################',
  '################################################################',
  '##.......#######################################################',
  '##.......#######################################################',
  '##...X...#######################################################',
  '##.........#...............#..............#................#####',
  '##.........#......#...J....#......#.......#.......#.K......#####',
  '##................#...............#...............#........#####',
  '##.......###############################################...#####',
  '##########..........#...............####################...#####',
  '##########..........#.......#.......####################...#####',
  '##########.7................#.......####################...#####',
  '##########......#################...####################...#####',
  '##########......#################...####################...#####',
  '#################################...####################...#####',
  '#####......#..............#...................#............#####',
  '#####......#.....#....C...#.............#.....#5..D.#......#####',
  '#####............#......................#...........#......#####',
  '#####...####...#################################################',
  '#####...####.....#.....................#########################',
  '#####...####.....#.....#...............#########################',
  '#####...####...........#...............#########################',
  '#####...####################..E.....F..#########################',
  '#####...####################...........#########################',
  '#####...####################...##......#########################',
  '#####...####################...##......#########################',
  '#####.......#.........#.........................#..........#####',
  '#####.......#.3...#...#...................#.....#....#.....#####',
  '#####.............#.......................#..........#.....#####',
  '############################...........#################...#####',
  '############################.....6##...##########......#...#####',
  '############################......##...####.........8..#...#####',
  '############################...........####............#...#####',
  '############################..H.....G..##..............#...#####',
  '############################...........##...############...#####',
  '############################...........##...############...#####',
  '##.......###################...........##...############...#####',
  '##.......######################....######...############...#####',
  '##..........#.........2..#...................#.............#####',
  '##...S......#......#.....#..........B.#......#.....#.......#####',
  '##........1.....A..#......4...........#............#.......#####',
  '##.......#######################################################',
  '################################################################',
  '################################################################',
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
    role: 'bottom corridor; sweeps across KDL_04, the first contested pickup',
  },
  {
    id: 'ENM_INF_02',
    waypointChars: 'CD',
    mode: 'pingpong',
    facing: 0,
    role: 'upper corridor; covers KDL_05 near its turnaround and the mouth of the NW deep branch',
  },
  {
    id: 'ENM_INF_03',
    waypointChars: 'EFGH',
    mode: 'loop',
    facing: 0,
    role: 'loops the open central shaft; makes the short route the exposed one and guards KDL_06',
  },
  {
    id: 'ENM_INF_04',
    waypointChars: 'JK',
    mode: 'pingpong',
    facing: 0,
    scanAngles: [180, 0],
    role: 'final corridor before extraction - the last gate',
  },
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
