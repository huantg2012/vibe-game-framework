import type { GeneratedRiftLayout } from '@/generation/types';
import { TileGrid } from '@/systems/tile-grid';
import { TileType } from '@/types/game-types';
import type { OccluderGrid, TileMapData } from '@/types/map-types';
import { VoidRegions } from '../void-regions';

/** Stage-only optical interpretation. Open air is visible but never walkable. */
class StageSightGrid implements OccluderGrid {
  private readonly topology: TileMapData;
  private regions!: VoidRegions;
  private regionVersion = -1;

  constructor(layout: GeneratedRiftLayout, private readonly physical: TileGrid) {
    const map = layout.tileMap;
    if (map.cols !== physical.cols || map.rows !== physical.rows || map.tileSize !== physical.tileSize) {
      throw new Error('Stage sight grid must match its physical layout');
    }
    // TileGrid owns a copy of the layout. This independent snapshot follows that live
    // copy, not the immutable generator output, when a future tile edit opens a shore.
    this.topology = { cols: physical.cols, rows: physical.rows, tileSize: physical.tileSize,
      tiles: Array.from({ length: physical.rows }, () => new Array<number>(physical.cols)) };
    this.refreshRegions();
  }

  get cols(): number { return this.physical.cols; }
  get rows(): number { return this.physical.rows; }
  get tileSize(): number { return this.physical.tileSize; }
  get version(): number { return this.physical.version; }

  isOpaque(col: number, row: number): boolean {
    if (this.physical.getTile(col, row) !== TileType.VOID) return this.physical.isOpaque(col, row);
    this.refreshRegions();
    return !this.regions.isInterior((col + .5) * this.tileSize, (row + .5) * this.tileSize);
  }

  private refreshRegions(): void {
    if (this.regionVersion === this.physical.version) return;
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) this.topology.tiles[row]![col] = this.physical.getTile(col, row);
    }
    this.regions = new VoidRegions(this.topology);
    this.regionVersion = this.physical.version;
  }
}

/** A fresh view per scene; no global mode flag and deliberately no WalkGrid API. */
export function createStageSightGrid(layout: GeneratedRiftLayout, physicalGrid: TileGrid): OccluderGrid {
  return new StageSightGrid(layout, physicalGrid);
}
