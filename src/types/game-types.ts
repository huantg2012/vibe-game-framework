/**
 * Core game type definitions.
 * These types are shared across all systems.
 */

/** 2D position */
export interface Position {
  x: number;
  y: number;
}

/** 2D vector (same structure as Position but semantically different) */
export interface Vector2 {
  x: number;
  y: number;
}

/** Rectangle bounds */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tile coordinates (grid-based) */
export interface TileCoord {
  col: number;
  row: number;
}

/**
 * Four-way facing, used for sprite frame selection.
 * The continuous facing angle stays separate (the vision cone needs it).
 */
export type Facing4 = 'up' | 'down' | 'left' | 'right';

/** Enemy AI states */
export enum AIState {
  PATROL = 'patrol',
  SUSPICIOUS = 'suspicious',
  ALERT = 'alert',
  CHASE = 'chase',
  RETURN = 'return',
}

/** Purification point module definition */
export interface PurificationModule {
  id: string;
  name: string;
  health: number;       // 0-100, percentage
  maxHealth: number;
  effect: ModuleEffect;
  allocated: number;    // kindling allocated for next impact
}

/** Module effects on gameplay */
export enum ModuleEffect {
  /** Affects chaos value base growth rate */
  BARRIER = 'barrier',
  /** Affects carry capacity / inventory slots */
  STORAGE = 'storage',
}

/** Item slot in inventory */
export interface ItemSlot {
  itemId: string | null;
  itemType: string | null;
}

/** Map fragment data (from Voronoi partitioning) */
export interface FragmentData {
  id: number;
  /** Cell indices belonging to this fragment (Voronoi region) */
  cells: TileCoord[];
  /** Approximate center of the fragment */
  center: Position;
  /** Role assigned during content placement */
  type: FragmentType;
  /** IDs of adjacent fragments (share a border) */
  neighbors: number[];
}

/** Fragment types for content placement and progression */
export enum FragmentType {
  /** Player spawn fragment - relatively safe */
  SPAWN = 'spawn',
  /** Standard exploration fragment */
  NORMAL = 'normal',
  /** Contains patrolling enemies guarding loot */
  GUARDED = 'guarded',
  /** Contains extraction/exit point */
  EXIT = 'exit',
  /** High-value loot, higher danger */
  TREASURE = 'treasure',
}

/** A narrow passage connecting two fragments ("spatial fracture") */
export interface FractureData {
  /** Fragment IDs this fracture connects */
  fromFragment: number;
  toFragment: number;
  /** Tile positions forming the fracture passage */
  tiles: TileCoord[];
  /** Center point of the fracture (useful for AI/placement) */
  center: Position;
}

/** Generated map data structure */
export interface MapData {
  width: number;
  height: number;
  tiles: number[][];            // 2D array: 0 = wall, 1 = floor, 2 = fracture passage
  fragments: FragmentData[];    // Voronoi-generated irregular regions
  fractures: FractureData[];    // Narrow connections between fragments
  spawnPoint: Position;
  exitPoints: Position[];
}

/** Tile types */
export enum TileType {
  WALL = 0,
  FLOOR = 1,
  FRACTURE = 2,
}
