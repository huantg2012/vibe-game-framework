/**
 * Minimap - fog-of-war overlay showing explored areas.
 *
 * Renders a small top-down view of the map in the corner. Only tiles the player
 * has seen (entered their vision cone at least once) are revealed. The extraction
 * point is shown once discovered. Player / extract / abyss marks use distinct
 * shapes (cross / slit / square / diamond) so they stay readable in grayscale.
 *
 * Canvas sits inside `#rift-minimap.device-plate` on `#dom-ui-root`.
 */

import { GAME_CONSTANTS } from '@/config/constants';
import { TileType, type Vector2 } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from '@/ui/dom/panel-styles';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const MINIMAP_SCALE = 3;          // px per tile
const BG_COLOR = '#080a0c';
const EXPLORED_FLOOR = '#151a1e';
const EXPLORED_WALL = '#4a4e55';
const PLAYER_COLOR = '#c4873a';
const EXTRACTION_COLOR = '#b0fff5';
const ABYSS_ENEMY_COLOR = '#7fffee';
const ABYSS_NODE_COLOR = '#1aad96';

/**
 * abyss tool (`docs/art/tool-vfx-spec.md` A5 族群H): "地图上所有敌人和薪柴节点位置以标记
 * 显示(含视野外)". Enemies stay 3×3 squares; nodes are a 3px diamond in a darker
 * same-family teal so the two marks are not the same shape.
 */
const ABYSS_DOT_ALPHA_FLOOR = 0.30;
const ABYSS_FLICKER_WINDOW_MS = 1000;
const ABYSS_FLICKER_PERIOD_MS = 180;

// ---------------------------------------------------------------------------
// Minimap class
// ---------------------------------------------------------------------------

export class Minimap {
  private wrap: HTMLDivElement | null = null;
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
    this.destroy();

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

    injectPanelStyles();

    const wrap = document.createElement('div');
    wrap.id = 'rift-minimap';
    wrap.className = 'device-plate';
    wrap.style.cssText = [
      'position:absolute',
      'right:12px',
      'bottom:12px',
      'z-index:1000',
      'pointer-events:none',
      'padding:4px',
    ].join(';');

    this.canvas = document.createElement('canvas');
    this.canvas.width = w;
    this.canvas.height = h;
    this.canvas.style.cssText =
      `width:${w}px;height:${h}px;border:none;display:block;image-rendering:pixelated;`;
    wrap.appendChild(this.canvas);
    getDomUiRoot().appendChild(wrap);
    this.wrap = wrap;

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

    for (let dy = -revealRadius; dy <= revealRadius; dy++) {
      for (let dx = -revealRadius; dx <= revealRadius; dx++) {
        if (dx * dx + dy * dy > revealRadius * revealRadius) continue;
        const mx = tx + dx;
        const my = ty + dy;
        if (mx < 0 || mx >= this.mapWidth || my < 0 || my >= this.mapHeight) continue;
        const idx = my * this.mapWidth + mx;
        if (!this.explored[idx]) this.explored[idx] = 1;
      }
    }

    // Check if extraction point discovered
    if (!this.extractionDiscovered && this.extractionTile) {
      const eidx = this.extractionTile.y * this.mapWidth + this.extractionTile.x;
      if (this.explored[eidx]) this.extractionDiscovered = true;
    }

    this.drawExplored();
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
    this.wrap?.remove();
    this.wrap = null;
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

  private cellCenter(tileX: number, tileY: number): { cx: number; cy: number } {
    return {
      cx: Math.round(tileX * MINIMAP_SCALE + MINIMAP_SCALE / 2),
      cy: Math.round(tileY * MINIMAP_SCALE + MINIMAP_SCALE / 2),
    };
  }

  private drawPlayerCross(cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(cx - 2, cy - 1, 5, 2);
    ctx.fillRect(cx - 1, cy - 2, 2, 5);
  }

  private drawExtractSlit(cx: number, cy: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = EXTRACTION_COLOR;
    ctx.fillRect(cx - 1, cy - 3, 2, 7);
  }

  private drawEnemySquare(cx: number, cy: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ABYSS_ENEMY_COLOR;
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
    ctx.globalAlpha = 1;
  }

  private drawNodeDiamond(cx: number, cy: number, alpha: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ABYSS_NODE_COLOR;
    ctx.fillRect(cx, cy - 1, 1, 1);
    ctx.fillRect(cx - 1, cy, 3, 1);
    ctx.fillRect(cx, cy + 1, 1, 1);
    ctx.globalAlpha = 1;
  }

  private drawDynamic(playerTileX: number, playerTileY: number): void {
    if (this.abyssRemainingMs > 0) {
      const alpha = this.abyssDotAlpha();
      if (alpha > 0) {
        for (const pos of this.abyssNodePositions) {
          const { cx, cy } = this.cellCenter(
            Math.floor(pos.x / this.tileSize),
            Math.floor(pos.y / this.tileSize),
          );
          this.drawNodeDiamond(cx, cy, alpha);
        }
        for (const pos of this.abyssEnemyPositions) {
          const { cx, cy } = this.cellCenter(
            Math.floor(pos.x / this.tileSize),
            Math.floor(pos.y / this.tileSize),
          );
          this.drawEnemySquare(cx, cy, alpha);
        }
      }
    }

    if (this.extractionDiscovered && this.extractionTile) {
      const { cx, cy } = this.cellCenter(this.extractionTile.x, this.extractionTile.y);
      this.drawExtractSlit(cx, cy);
    }

    const { cx, cy } = this.cellCenter(playerTileX, playerTileY);
    this.drawPlayerCross(cx, cy);
  }
}
