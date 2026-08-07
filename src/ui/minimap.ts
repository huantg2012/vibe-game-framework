/**
 * Minimap - fog-of-war overlay showing explored areas.
 *
 * Renders a small top-down view of the map in the corner. Only tiles the player
 * has seen (entered their vision cone at least once) are revealed. The extraction
 * point is shown once discovered. Player position is always shown as a dot.
 *
 * Uses a dedicated canvas element overlaid on the game, avoiding Phaser's render
 * pipeline entirely (no depth/scroll/camera concerns).
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { TileType, type Vector2 } from '@/types/game-types';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MINIMAP_SCALE = 3;          // px per tile
const MARGIN = 8;                 // px from screen edge
const BG_COLOR = '#0a0d0a';
const EXPLORED_FLOOR = '#2a3228';
const EXPLORED_WALL = '#4a4038';
const PLAYER_COLOR = '#ffffff';
const PLAYER_DOT_SIZE = 2;
const EXTRACTION_COLOR = '#ffffff';
const EXTRACTION_DOT_SIZE = 2;
const BORDER_COLOR = '#333840';
const OPACITY = 0.85;

// ---------------------------------------------------------------------------
// Minimap class
// ---------------------------------------------------------------------------

export class Minimap {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private explored!: Uint8Array;
  private mapWidth = 0;
  private mapHeight = 0;
  private tileSize = 0;
  private tiles!: readonly number[][];
  private extractionTile: { x: number; y: number } | null = null;
  private extractionDiscovered = false;

  create(
    mapTiles: readonly number[][],
    mapWidth: number,
    mapHeight: number,
    tileSize: number,
    extractionPos: Vector2,
  ): void {
    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;
    this.tileSize = tileSize;
    this.tiles = mapTiles;
    this.explored = new Uint8Array(mapWidth * mapHeight);
    this.extractionDiscovered = false;

    this.extractionTile = {
      x: Math.floor(extractionPos.x / tileSize),
      y: Math.floor(extractionPos.y / tileSize),
    };

    const w = mapWidth * MINIMAP_SCALE;
    const h = mapHeight * MINIMAP_SCALE;

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.cssText =
      `position:fixed;bottom:${MARGIN}px;right:${MARGIN}px;` +
      `width:${w}px;height:${h}px;` +
      `opacity:${OPACITY};border:1px solid ${BORDER_COLOR};` +
      `pointer-events:none;z-index:1000;image-rendering:pixelated;`;
    document.body.appendChild(this.canvas);

    this.ctx = this.canvas.getContext('2d')!;
    this.drawBase();
  }

  /**
   * Called each frame with the player's world position and the vision radius.
   * Reveals tiles within a generous radius around the player (approximating
   * what they've actually seen).
   */
  update(playerWorldPos: Vector2): void {
    const tx = Math.floor(playerWorldPos.x / this.tileSize);
    const ty = Math.floor(playerWorldPos.y / this.tileSize);

    // Reveal only tiles within ambient vision range (~2.5 tiles) — not the full forward cone
    const baseRadius = GAME_CONSTANTS.VISIBILITY.RADIUS_AMBIENT / this.tileSize;
    const revealRadius = Math.ceil(baseRadius);

    let changed = false;
    for (let dy = -revealRadius; dy <= revealRadius; dy++) {
      for (let dx = -revealRadius; dx <= revealRadius; dx++) {
        if (dx * dx + dy * dy > revealRadius * revealRadius) continue;
        const mx = tx + dx;
        const my = ty + dy;
        if (mx < 0 || mx >= this.mapWidth || my < 0 || my >= this.mapHeight) continue;
        const idx = my * this.mapWidth + mx;
        if (!this.explored[idx]) {
          this.explored[idx] = 1;
          changed = true;
        }
      }
    }

    // Check if extraction point discovered
    if (!this.extractionDiscovered && this.extractionTile) {
      const eidx = this.extractionTile.y * this.mapWidth + this.extractionTile.x;
      if (this.explored[eidx]) this.extractionDiscovered = true;
    }

    if (changed) this.drawExplored();
    this.drawDynamic(tx, ty);
  }

  reset(): void {
    this.explored.fill(0);
    this.extractionDiscovered = false;
    this.drawBase();
  }

  destroy(): void {
    this.canvas?.remove();
  }

  // ------------------------------------------------------------------ internal

  private drawBase(): void {
    const ctx = this.ctx;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawExplored(): void {
    const ctx = this.ctx;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    for (let y = 0; y < this.mapHeight; y++) {
      const row = this.tiles[y];
      if (!row) continue;
      for (let x = 0; x < this.mapWidth; x++) {
        const idx = y * this.mapWidth + x;
        if (!this.explored[idx]) continue;

        const isWall = row[x] === TileType.WALL;
        ctx.fillStyle = isWall ? EXPLORED_WALL : EXPLORED_FLOOR;
        ctx.fillRect(x * MINIMAP_SCALE, y * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
      }
    }
  }

  private drawDynamic(playerTileX: number, playerTileY: number): void {
    // Extraction point (once discovered)
    if (this.extractionDiscovered && this.extractionTile) {
      const ctx = this.ctx;
      ctx.fillStyle = EXTRACTION_COLOR;
      const ex = this.extractionTile.x * MINIMAP_SCALE + MINIMAP_SCALE / 2;
      const ey = this.extractionTile.y * MINIMAP_SCALE + MINIMAP_SCALE / 2;
      ctx.beginPath();
      ctx.arc(ex, ey, EXTRACTION_DOT_SIZE, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player dot
    const ctx = this.ctx;
    ctx.fillStyle = PLAYER_COLOR;
    const px = playerTileX * MINIMAP_SCALE + MINIMAP_SCALE / 2;
    const py = playerTileY * MINIMAP_SCALE + MINIMAP_SCALE / 2;
    ctx.beginPath();
    ctx.arc(px, py, PLAYER_DOT_SIZE, 0, Math.PI * 2);
    ctx.fill();
  }
}
