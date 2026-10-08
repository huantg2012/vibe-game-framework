/**
 * TilemapRenderer - turns tile data into a visible Phaser tilemap layer.
 *
 * Shared scene pipeline (architecture DEC-ARCH-008): the rift feeds it the fixed map,
 * the purification point will feed it its own hand-built map. It knows nothing about
 * either scene - which tiles exist, which tileset to use and which indices collide all
 * arrive through `TilemapRenderConfig`.
 *
 * Culling is Phaser's built-in tilemap frustum culling, so map size does not affect
 * draw cost (architecture performance rules).
 */

import Phaser from 'phaser';
import type { TileMapData } from '@/types/map-types';

export interface TilemapRenderConfig {
  /** Texture key of the tileset image; frame index == tile index in the data. */
  readonly tilesetKey: string;
  /** Tile indices that should collide with physics bodies. */
  readonly collidingIndices: readonly number[];
  readonly depth: number;
  /** Extra tiles rendered beyond the camera edge. Defaults to 2. */
  readonly cullPadding?: number;
}

export class TilemapRenderer {
  private tilemap: Phaser.Tilemaps.Tilemap | null = null;
  private layer: Phaser.Tilemaps.TilemapLayer | null = null;

  /**
   * Builds the tilemap and returns the created layer.
   * Throws if the tileset texture is missing - a silently blank map is worse than a crash.
   */
  create(
    scene: Phaser.Scene,
    map: TileMapData,
    config: TilemapRenderConfig
  ): Phaser.Tilemaps.TilemapLayer {
    if (!scene.textures.exists(config.tilesetKey)) {
      throw new Error(`TilemapRenderer: missing tileset texture '${config.tilesetKey}'`);
    }

    this.tilemap = scene.make.tilemap({
      data: map.tiles as number[][],
      tileWidth: map.tileSize,
      tileHeight: map.tileSize,
    });

    const tileset = this.tilemap.addTilesetImage(
      config.tilesetKey,
      config.tilesetKey,
      map.tileSize,
      map.tileSize,
      0,
      0
    );
    if (!tileset) {
      throw new Error(`TilemapRenderer: could not add tileset '${config.tilesetKey}'`);
    }

    const layer = this.tilemap.createLayer(0, tileset, 0, 0);
    if (!layer) {
      throw new Error('TilemapRenderer: could not create tilemap layer');
    }

    layer.setDepth(config.depth);
    const padding = config.cullPadding ?? 2;
    layer.setCullPadding(padding, padding);
    if (config.collidingIndices.length > 0) {
      layer.setCollision(config.collidingIndices as number[]);
    }

    this.layer = layer;
    return layer;
  }

  getLayer(): Phaser.Tilemaps.TilemapLayer | null {
    return this.layer;
  }

  /** World size of the rendered map in pixels. Returns zeros before `create()`. */
  getWorldSize(out: { width: number; height: number }): { width: number; height: number } {
    out.width = this.tilemap ? this.tilemap.widthInPixels : 0;
    out.height = this.tilemap ? this.tilemap.heightInPixels : 0;
    return out;
  }

  destroy(): void {
    this.layer?.destroy();
    this.tilemap?.destroy();
    this.layer = null;
    this.tilemap = null;
  }
}
