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
const BORDER_COLOR = '#2a2d32';
const OPACITY = 0.85;

/**
 * abyss tool (`docs/art/tool-vfx-spec.md` A5 族群H): "地图上所有敌人和薪柴节点位置以标记
 * 显示(含视野外)". Spec calls for tiny SQUARE dots (方点) in the palette's contam-peak,
 * one shared color for both enemies and nodes - not the old red/brown pair, which was
 * also a palette violation (A3-2 bans non-teal-spectrum colors project-wide).
 */
const ABYSS_DOT_COLOR_RGB = '127,255,238'; // contam-peak #7fffee
const ABYSS_DOT_SIZE = 3;
/** Brightness decay floor - never fades all the way to invisible before the final-second
 * flicker (below) takes over; keeps "信息正在流失" readable as a fade, not a vanish. */
const ABYSS_DOT_ALPHA_FLOOR = 0.30;
/** Last-second flicker window and toggle period - "最后1s加速闪烁2-3次后统一移除". */
const ABYSS_FLICKER_WINDOW_MS = 1000;
const ABYSS_FLICKER_PERIOD_MS = 180;

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

  /** Slice 5 abyss tool (T1). Empty/zero when no reveal is active. */
  private abyssEnemyPositions: readonly Vector2[] = [];
  private abyssNodePositions: readonly Vector2[] = [];
  private abyssRemainingMs = 0;
  /** Captured once per reveal so brightness decay (below) has a stable denominator even
   * as `abyssRemainingMs` counts down. */
  private abyssTotalMs = 0;

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
   * what they've actually seen). `deltaMs` only drives the abyss reveal countdown
   * (Slice 5 T1); fog-of-war reveal itself is not time-based.
   */
  update(playerWorldPos: Vector2, deltaMs = 0): void {
    if (this.abyssRemainingMs > 0) {
      this.abyssRemainingMs -= deltaMs;
      if (this.abyssRemainingMs <= 0) {
        this.abyssRemainingMs = 0;
        this.abyssEnemyPositions = [];
        this.abyssNodePositions = [];
      }
    }

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

  /** abyss: "10秒内地图上所有敌人和薪柴节点位置以标记显示(含视野外)". */
  showAbyssReveal(
    enemyPositions: readonly Vector2[],
    nodePositions: readonly Vector2[],
    durationMs: number,
  ): void {
    this.abyssEnemyPositions = enemyPositions;
    this.abyssNodePositions = nodePositions;
    this.abyssRemainingMs = durationMs;
    this.abyssTotalMs = durationMs;
  }

  reset(): void {
    this.explored.fill(0);
    this.extractionDiscovered = false;
    this.abyssEnemyPositions = [];
    this.abyssNodePositions = [];
    this.abyssRemainingMs = 0;
    this.abyssTotalMs = 0;
    this.drawBase();
  }

  destroy(): void {
    this.canvas?.remove();
  }

  // ------------------------------------------------------------------ internal

  /**
   * abyss's minimap brightness: linearly decays from full to `ABYSS_DOT_ALPHA_FLOOR` over
   * the reveal's duration ("方点亮度随10s倒计时逐渐衰减"), then in the final
   * `ABYSS_FLICKER_WINDOW_MS` switches to a discrete on/off toggle ("最后1s加速闪烁2-3次
   * 后统一移除") - a deliberate discrete jump, not a continued fade, matching the rest of
   * this Slice's "结束消散用离散跳变不用连续渐隐" rule. Returns 0 to mean "don't draw".
   */
  private abyssDotAlpha(): number {
    if (this.abyssRemainingMs <= ABYSS_FLICKER_WINDOW_MS) {
      const elapsedInWindow = ABYSS_FLICKER_WINDOW_MS - this.abyssRemainingMs;
      const toggleIndex = Math.floor(elapsedInWindow / ABYSS_FLICKER_PERIOD_MS);
      return toggleIndex % 2 === 0 ? 1 : 0;
    }
    const fraction = this.abyssTotalMs > 0 ? this.abyssRemainingMs / this.abyssTotalMs : 1;
    return ABYSS_DOT_ALPHA_FLOOR + (1 - ABYSS_DOT_ALPHA_FLOOR) * fraction;
  }

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
    // Slice 5 abyss tool (T1/T4): drawn first so the player/extraction dots stay on top.
    if (this.abyssRemainingMs > 0) {
      const alpha = this.abyssDotAlpha();
      if (alpha > 0) {
        const ctx = this.ctx;
        ctx.fillStyle = `rgba(${ABYSS_DOT_COLOR_RGB},${alpha})`;
        const half = ABYSS_DOT_SIZE / 2;
        for (const pos of [...this.abyssNodePositions, ...this.abyssEnemyPositions]) {
          const x = (pos.x / this.tileSize) * MINIMAP_SCALE;
          const y = (pos.y / this.tileSize) * MINIMAP_SCALE;
          ctx.fillRect(x - half, y - half, ABYSS_DOT_SIZE, ABYSS_DOT_SIZE);
        }
      }
    }

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
