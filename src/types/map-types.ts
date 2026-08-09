/**
 * Map data contracts shared by the fixed rift layout, the tilemap pipeline,
 * the visibility system and (later) the AI/pathfinding systems.
 *
 * Contract sources:
 * - `OccluderGrid`            -> docs/specs/system-movement-vision.md
 * - `WalkGrid`                -> docs/specs/system-enemy-ai.md
 * - `EnemySpawnData` / `PatrolRouteData` -> docs/specs/system-enemy-ai.md
 * - `KindlingNodeDef` / `ExtractionPointDef` / `RiftLayoutData`
 *                             -> docs/specs/system-chaos-scavenge-extract.md
 */

import type { TileCoord, Vector2 } from '@/types/game-types';

/** Raw tile index grid. Values are `TileType` members and double as tileset frame indices. */
export interface TileMapData {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** Row-major, `rows` entries of `cols` tile indices. */
  readonly tiles: readonly number[][];
}

/** Which tiles block line of sight. Out-of-bounds always counts as opaque. */
export interface OccluderGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  isOpaque(col: number, row: number): boolean;
  /** Incremented whenever tile data changes, so consumers can invalidate caches. */
  readonly version: number;
}

/** Which tiles can be walked on. Out-of-bounds always counts as unwalkable. */
export interface WalkGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  isWalkable(col: number, row: number): boolean;
  readonly version: number;
}

/** How an enemy walks its fixed patrol route. */
export type PatrolMode = 'loop' | 'pingpong' | 'static';

export interface PatrolRouteData {
  /** At least one waypoint; every waypoint must be walkable. */
  readonly waypoints: readonly TileCoord[];
  readonly mode: PatrolMode;
  /** Dwell time at each waypoint. Falls back to `AI.WAYPOINT_PAUSE_MS`. */
  readonly pauseMs?: number;
  /** Scan headings (degrees, 0 = right) cycled while dwelling. */
  readonly scanAngles?: readonly number[];
}

export interface EnemySpawnData {
  readonly id: string;
  readonly type: 'infiltrator';
  readonly spawn: TileCoord;
  /** Initial heading in degrees, 0 = right, clockwise. */
  readonly facing: number;
  readonly patrol: PatrolRouteData;
}

/** Kindling value tier. Price grows super-linearly with the cost of reaching it. */
export type KindlingTier = 'safe' | 'contested' | 'deep';

export interface KindlingNodeDef {
  readonly id: string;
  readonly tier: KindlingTier;
  /** World position (px), tile centre. */
  readonly position: Vector2;
  /** Omit to use the tier default from `LOOT.VALUE_*`. */
  readonly value?: number;
}

export interface ExtractionPointDef {
  readonly id: string;
  readonly position: Vector2;
  /** Radius (px) within which the extract prompt appears. */
  readonly triggerRadius: number;
}

/** A visual landmark decal placed at a key junction for navigation orientation. */
export interface LandmarkDef {
  readonly id: string;
  /** Tile column (grid coordinate, not pixels). */
  readonly col: number;
  /** Tile row (grid coordinate, not pixels). */
  readonly row: number;
  /** Which drawing routine to use. */
  readonly style:
    | 'pool'
    | 'scratches'
    | 'rubble'
    | 'crack'
    | 'scorch'
    | 'crystals'
    | 'bloodtrail'
    | 'rune';
}

/** Contaminant pickup node position (Slice 3, spec CN8-CN9). */
export interface ContaminantNodeDef {
  readonly id: string;
  /** World position (px), tile centre. */
  readonly position: Vector2;
}

/**
 * Everything a rift scene needs to place its content.
 * `enemySpawns` is consumed by the AI system (T7), the rest by loot/extraction (T9).
 */
export interface RiftLayoutData {
  readonly spawnPoint: Vector2;
  readonly extractionPoint: ExtractionPointDef;
  readonly kindlingNodes: readonly KindlingNodeDef[];
  readonly contaminantNodes: readonly ContaminantNodeDef[];
  readonly enemySpawns: readonly EnemySpawnData[];
  readonly landmarks: readonly LandmarkDef[];
}
