/**
 * TileGrid - the single source of truth for "what is where" in a tile-based scene.
 *
 * Implements both `OccluderGrid` (line of sight) and `WalkGrid` (pathfinding) so the
 * visibility system, the AI and the renderer all read the same data. Walls block
 * sight and movement. VOID (Slice 6) is unwalkable and not opaque. Out-of-bounds
 * still reads as WALL so existing maps keep an opaque edge.
 *
 * Pure data + math, no Phaser dependency, so it can be reused and unit-tested.
 */

import { TileType, type TileCoord, type Vector2 } from '@/types/game-types';
import type { OccluderGrid, TileMapData, WalkGrid } from '@/types/map-types';

export class TileGrid implements OccluderGrid, WalkGrid {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;
  readonly widthPx: number;
  readonly heightPx: number;

  private readonly data: Uint8Array;
  private _version = 0;

  constructor(map: TileMapData) {
    this.cols = map.cols;
    this.rows = map.rows;
    this.tileSize = map.tileSize;
    this.widthPx = map.cols * map.tileSize;
    this.heightPx = map.rows * map.tileSize;

    this.data = new Uint8Array(map.cols * map.rows);
    for (let row = 0; row < map.rows; row++) {
      const sourceRow = map.tiles[row];
      if (!sourceRow || sourceRow.length !== map.cols) {
        throw new Error(`TileGrid: row ${row} does not have ${map.cols} tiles`);
      }
      for (let col = 0; col < map.cols; col++) {
        this.data[row * map.cols + col] = sourceRow[col]!;
      }
    }
  }

  get version(): number {
    return this._version;
  }

  /** Returns `TileType.WALL` for out-of-bounds so callers never need bounds checks. */
  getTile(col: number, row: number): number {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return TileType.WALL;
    return this.data[row * this.cols + col]!;
  }

  isOpaque(col: number, row: number): boolean {
    return this.getTile(col, row) === TileType.WALL;
  }

  isWalkable(col: number, row: number): boolean {
    const tile = this.getTile(col, row);
    return tile === TileType.FLOOR || tile === TileType.FRACTURE;
  }

  /** True when the world position falls inside a walkable tile. */
  isWalkableAt(x: number, y: number): boolean {
    return this.isWalkable(Math.floor(x / this.tileSize), Math.floor(y / this.tileSize));
  }

  /** Mutates a tile and bumps `version` so caches (vision, paths) invalidate. */
  setTile(col: number, row: number, tile: number): void {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const index = row * this.cols + col;
    if (this.data[index] === tile) return;
    this.data[index] = tile;
    this._version++;
  }

  /** Writes the centre of a tile into `out` (no allocation). */
  tileToWorld(col: number, row: number, out: Vector2): Vector2 {
    out.x = col * this.tileSize + this.tileSize / 2;
    out.y = row * this.tileSize + this.tileSize / 2;
    return out;
  }

  /** Writes the tile containing a world position into `out` (no allocation). */
  worldToTile(x: number, y: number, out: TileCoord): TileCoord {
    out.col = Math.floor(x / this.tileSize);
    out.row = Math.floor(y / this.tileSize);
    return out;
  }
}
