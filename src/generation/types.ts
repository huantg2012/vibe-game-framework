/**
 * Slice 6 map-generation contracts. C1 = land outline. C2 = scenic walls.
 * C3 = `GeneratedRiftLayout` (spawn / extract / loot / patrols). Atmosphere is
 * a generated field on the ruined mask (preview-baked; C5 paints it in-game).
 */

import type { Vector2 } from '@/types/game-types';
import type {
  ContaminantNodeDef,
  EnemySpawnData,
  ExtractionPointDef,
  KindlingNodeDef,
  LandmarkDef,
  TileMapData,
} from '@/types/map-types';

export interface OutlineBBox {
  readonly minCol: number;
  readonly minRow: number;
  readonly maxCol: number;
  readonly maxRow: number;
  readonly width: number;
  readonly height: number;
}

/** Measurements used to keep or discard a land mask. */
export interface OutlineMetrics {
  readonly landCount: number;
  readonly fillRatio: number;
  readonly bbox: OutlineBBox;
  readonly bboxFill: number;
  readonly borderOccupancy: number;
  readonly edgesTouching: number;
  readonly roughness: number;
}

export interface OutlineReject {
  readonly ok: false;
  readonly reasons: readonly string[];
  readonly metrics: OutlineMetrics;
}

export interface OutlineAccept {
  readonly ok: true;
  readonly reasons: readonly [];
  readonly metrics: OutlineMetrics;
}

export type OutlineVerdict = OutlineAccept | OutlineReject;

/**
 * Walkable land mask inside a rectangular tile buffer.
 * Land = FLOOR. Everything else in the buffer = VOID.
 */
export interface OutlineMask {
  readonly seed: number;
  readonly attempt: number;
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  /** Row-major, 1 = land, 0 = void. Length = cols * rows. */
  readonly land: Uint8Array;
  readonly tileMap: TileMapData;
  readonly metrics: OutlineMetrics;
}

export interface RuinCell {
  readonly col: number;
  readonly row: number;
}

export type RuinFeatureKind = 'enclosure' | 'ridge' | 'slab' | 'cluster' | 'lattice' | 'growth';

/** Floor marks, except `stump` / `root` which skin bole and root wall cells. */
export type RuinPaintRole =
  | 'interior'
  | 'debris'
  | 'vegetation'
  | 'organic'
  | 'stump'
  | 'root'
  | 'wreck'
  | 'glitch';

export type OverlayKind = 'glow' | 'mote' | 'ripple' | 'band';

/** Sub-tile FX, preview-baked. Never a wall. */
export interface OverlayStamp {
  readonly kind: OverlayKind;
  readonly col: number;
  readonly row: number;
  readonly radiusTiles: number;
  readonly strength: number;
}

export interface RuinPaintCell {
  readonly col: number;
  readonly row: number;
  readonly role: RuinPaintRole;
}

export interface RuinFeature {
  readonly kind: RuinFeatureKind;
  readonly cells: readonly RuinCell[];
  readonly paint?: readonly RuinPaintCell[];
  readonly alignY?: boolean;
}

export interface RuinMetrics {
  readonly wallCount: number;
  readonly wallRatio: number;
  readonly featureCount: number;
  readonly leftoverConnected: boolean;
}

/** One sky mass. rest* is the pose at phase 0.5; paint slides it along wind. */
export interface SkyOccluder {
  readonly restCx: number;
  readonly restCy: number;
  readonly ux: number;
  readonly uy: number;
  readonly length: number;
  readonly halfWidth: number;
  readonly softness: number;
  readonly strength: number;
  readonly travel: number;
}

/** Layers 7–9 as one field. Same field animates by changing phase. */
export interface AtmosphereField {
  readonly phase: number;
  readonly slideSpan: number;
  readonly windX: number;
  readonly windY: number;
  readonly occluders: readonly SkyOccluder[];
  readonly fog: Float32Array;
  readonly motes: readonly OverlayStamp[];
}

export interface RuinedMask {
  readonly seed: number;
  readonly attempt: number;
  readonly fragmentTypeId: string;
  readonly outline: OutlineMask;
  /** Row-major, 1 = wall. Walls exist only on land. */
  readonly walls: Uint8Array;
  readonly features: readonly RuinFeature[];
  readonly tileMap: TileMapData;
  readonly metrics: RuinMetrics;
  readonly overlays?: readonly OverlayStamp[];
  readonly atmosphere?: AtmosphereField;
}

export interface WalkableMask {
  readonly cols: number;
  readonly rows: number;
  isWalkable(col: number, row: number): boolean;
}

/** One sortie of generated rift content. Unchanged until the player leaves. */
export interface GeneratedRiftLayout {
  readonly seed: number;
  readonly fragmentTypeId: string;
  readonly recipeId: string;
  readonly tileMap: TileMapData;
  /** Full recipe-stack island, including paint roles and atmosphere for the surface. */
  readonly ruins: RuinedMask;
  readonly walkableMask: WalkableMask;
  readonly spawnPoint: Vector2;
  readonly extractionPoint: ExtractionPointDef;
  readonly kindlingNodes: readonly KindlingNodeDef[];
  readonly contaminantNodes: readonly ContaminantNodeDef[];
  readonly enemySpawns: readonly EnemySpawnData[];
  readonly landmarks: readonly LandmarkDef[];
}
