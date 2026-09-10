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
  CORE = 'core',
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

/** Tile types. Frame index in the rift tileset equals the enum value. */
export enum TileType {
  WALL = 0,
  FLOOR = 1,
  FRACTURE = 2,
  /** Unwalkable, opaque (void swallows light), painted void-black. */
  VOID = 3,
}

// ─── Slice 3: Growth + Tide Economy types ───────────────────────────────────

/** Contaminant type (18 kinds) */
export type ContaminantType =
  | 'solidify' | 'ruminate' | 'scatter' | 'retrograde'
  | 'delay' | 'siphon' | 'expand'
  | 'resonate' | 'overwrite' | 'erode'
  | 'muffle' | 'kindle' | 'stitch'
  | 'compress' | 'mirror' | 'echo'
  | 'abyss' | 'combust';

/** Contaminant rarity */
export type ContaminantRarity = 'common' | 'fine' | 'rare';

/** Quality is independent of the legacy ability-family rarity/visual identity. */
export type ContaminantQuality = 'ordinary' | 'good' | 'fine' | 'excellent';

/** Contaminant lifecycle stage */
export type ContaminantStage = 'defense' | 'tool' | 'broken';

/** A single contaminant instance */
export interface Contaminant {
  id: string;
  type: ContaminantType;
  rarity: ContaminantRarity;
  /** Absent on legacy instances; display resolves a fallback without rewriting the save. */
  quality?: ContaminantQuality;
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

/**
 * Permanent upgrade IDs. Source of truth is data/upgrades.csv (generated into
 * src/generated/upgrade-data.ts) — this union must list exactly the same ids.
 * Slice 3: growth_chaos_resist / growth_kindling_affinity / growth_vitality.
 * Slice 5 T5: growth_sortie_slot / growth_defense_slot / growth_forecast_clarity.
 */
export type GrowthUpgradeId =
  | 'growth_chaos_resist'
  | 'growth_kindling_affinity'
  | 'growth_vitality'
  | 'growth_sortie_slot'
  | 'growth_defense_slot'
  | 'growth_forecast_clarity';

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
  /**
   * Contaminant runtime state (Slice 5 T3/D3, DEC-032): per-contaminant-id persistent
   * counters (solidify shatter cycle, combust burn accumulator, echo bonus-grant cap).
   * Optional so saves written before this field existed still load (empty state).
   */
  contaminantRuntimeState?: Record<string, { solidifyCounter?: number; combustAccumulator?: number; echoBonusGranted?: number }>;
  /**
   * Global module maxHp thicken tier (Slice 7, DEC-064). 0–3 → maxHp 100/115/130/145.
   * Optional so pre-Slice-7 saves still load (treated as 0; missing PURIFIER is filled).
   */
  moduleMaxHpTier?: 0 | 1 | 2 | 3;
  /** One-shot module repair allowance; missing on old saves means none earned. */
  repairBonusHp?: number;
  /** Optional on old saves. Keeps displayed impact promises stable across menu/load. */
  impactForecast?: import('../systems/impact-system').ImpactForecastState;
}

/** Inventory-backed save. V1 remains readable and is migrated without changing IDs. */
export interface SaveDataV2 extends Omit<SaveDataV1, 'version' | 'contaminants' | 'defenseSlots' | 'sortieLoadout'> {
  version: 2;
  inventory: import('./inventory-types').InventoryState;
}
export type ExpeditionSaveData = SaveDataV1 | SaveDataV2;
