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

// ─── Slice 3: Growth + Tide Economy types ───────────────────────────────────

/** Contaminant type (10 kinds) */
export type ContaminantType =
  | 'solidify' | 'ruminate' | 'scatter' | 'retrograde'
  | 'delay' | 'siphon' | 'expand'
  | 'resonate' | 'overwrite' | 'erode';

/** Contaminant rarity */
export type ContaminantRarity = 'common' | 'fine' | 'rare';

/** Contaminant lifecycle stage */
export type ContaminantStage = 'defense' | 'tool' | 'broken';

/** A single contaminant instance */
export interface Contaminant {
  id: string;
  type: ContaminantType;
  rarity: ContaminantRarity;
  stage: ContaminantStage;
  /** Impact charges accumulated during defense stage (transforms at 3) */
  impactCharges: number;
  /** Uses remaining during sortie tool stage */
  usesRemaining: number;
}

/** Tide phase within a single tide */
export type TidePhase = 'rise' | 'crest' | 'ebb';

/** Runtime tide state */
export interface TideState {
  /** Current tide number: 1-5, where 5 = Final */
  tideNumber: number;
  phase: TidePhase;
  /** Current cycle within the active phase */
  cycleInPhase: number;
  /** Current impact intensity multiplier */
  currentIntensity: number;
}

/** Permanent upgrade IDs (Slice 3: one per axis) */
export type GrowthUpgradeId =
  | 'growth_chaos_resist'
  | 'growth_kindling_affinity'
  | 'growth_vitality';

/** Persistent growth state */
export interface GrowthState {
  /** upgradeId -> current level (0 = not purchased) */
  upgrades: Record<GrowthUpgradeId, number>;
}

/** Purification stability tracker state */
export interface StabilityState {
  /** Progress toward purification completion: 0-100 */
  progress: number;
  /** Whether progress has reached 100% */
  reached: boolean;
}

/** Save data structure (version 1) */
export interface SaveDataV1 {
  version: 1;
  kindlingReserve: number;
  modules: { id: string; type: string; hp: number; maxHp: number }[];
  cycle: number;
  tide: TideState;
  contaminants: Contaminant[];
  /** 3 defense slots at the purification point (contaminant id or null) */
  defenseSlots: (string | null)[];
  /** 3 sortie loadout slots (contaminant id or null) */
  sortieLoadout: (string | null)[];
  growth: GrowthState;
  stability: StabilityState;
}
