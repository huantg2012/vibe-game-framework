/**
 * Slice 6 map-generation contracts. C1 = land outline. C2 = scenic walls.
 * Spawn / extract / atmosphere arrive in later batches.
 */

import type { TileMapData } from '@/types/map-types';

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

/** Floor marks for the atlas. Never stamped as walls. */
export type RuinPaintRole = 'interior' | 'debris';

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
}
