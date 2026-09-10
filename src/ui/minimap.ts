/**
 * Minimap - circular local fog-of-war window.
 *
 * 33-tile (66px) window follows the player's current tile. Explored tiles are
 * accumulated by the scene from real visibility queries; this module does not
 * import VisibilitySystem. Player / extract / abyss marks use distinct shapes.
 *
 * Canvas sits inside `#rift-minimap.device-plate` on `#dom-ui-root`.
 */

import { TileType, type Facing4, type Vector2 } from '@/types/game-types';
import { getDomUiRoot, injectPanelStyles } from '@/ui/dom/panel-styles';

// ---------------------------------------------------------------------------
// Config (docs/art/ux-visual-pass-slice-55.md §4)
// ---------------------------------------------------------------------------

const MINIMAP_SCALE = 2;
/** 25 × 1.3 = 32.5, kept odd so the player stays on the center tile. */
const WINDOW_TILES = 33;
const WINDOW_RADIUS_TILES = (WINDOW_TILES - 1) / 2;
const CANVAS_SIZE = WINDOW_TILES * MINIMAP_SCALE;
const CLIP_CX = (CANVAS_SIZE - 1) / 2;
const CLIP_CY = CLIP_CX;
const CLIP_RADIUS = CLIP_CX;

const BG_COLOR = '#080a0c';
const EXPLORED_FLOOR = '#151a1e';
const EXPLORED_WALL = '#4a4e55';
const PLAYER_COLOR = '#c4873a';
const EXTRACTION_COLOR = '#b0fff5';
const ABYSS_ENEMY_COLOR = '#9db5a8';
const ABYSS_NODE_COLOR = '#1aad96';

/** Bounded, stale positions: mobile bodies are solid, cores hollow, loot diamond-shaped.
 * Brightness ages with the captured record; none of these marks reads live positions. */
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
  private abyssCorePositions: readonly Vector2[] = [];
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

    injectPanelStyles();

    const wrap = document.createElement('div');
    wrap.id = 'rift-minimap';
    wrap.className = 'device-plate';

    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_SIZE;
    this.canvas.height = CANVAS_SIZE;
    wrap.appendChild(this.canvas);
    getDomUiRoot().appendChild(wrap);
    this.wrap = wrap;

    this.ctx = this.canvas.getContext('2d')!;
    this.drawClear();
  }

  /**
   * Scene-owned exploration: mark a tile the current visibility query just saw.
   * Persistent `Uint8Array` lives here; VisibilitySystem is not imported.
   */
  markExplored(tileX: number, tileY: number): void {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return;
    }
    const idx = tileY * this.mapWidth + tileX;
    if (!this.explored[idx]) this.explored[idx] = 1;

    if (
      !this.extractionDiscovered &&
      this.extractionTile &&
      this.extractionTile.x === tileX &&
      this.extractionTile.y === tileY
    ) {
      this.extractionDiscovered = true;
    }
  }

  /**
   * Draw the local circular window. `deltaMs` only drives the abyss reveal countdown
   * (Slice 5 T1); fog-of-war itself is not time-based. Facing comes from the scene
   * (`Player.getFacing4()`); last facing is kept by the player when standing still.
   */
  update(playerWorldPos: Vector2, facing: Facing4, deltaMs = 0): void {
    if (this.abyssRemainingMs > 0) {
      this.abyssRemainingMs -= deltaMs;
      if (this.abyssRemainingMs <= 0) {
        this.abyssRemainingMs = 0;
        this.abyssCorePositions = [];
        this.abyssEnemyPositions = [];
        this.abyssNodePositions = [];
      }
    }

    const playerTileX = Math.floor(playerWorldPos.x / this.tileSize);
    const playerTileY = Math.floor(playerWorldPos.y / this.tileSize);
    const originTileX = playerTileX - WINDOW_RADIUS_TILES;
    const originTileY = playerTileY - WINDOW_RADIUS_TILES;

    this.drawFrame(originTileX, originTileY, facing);
  }

  /** A bounded six-second position snapshot; never live enemy tracking. */
  showAbyssReveal(
    enemyPositions: readonly Vector2[],
    nodePositions: readonly Vector2[],
    durationMs: number,
    corePositions: readonly Vector2[] = [],
  ): void {
    this.abyssCorePositions = corePositions.map(position => ({ ...position }));
    this.abyssEnemyPositions = enemyPositions.map(position => ({ ...position }));
    this.abyssNodePositions = nodePositions.map(position => ({ ...position }));
    this.abyssRemainingMs = durationMs;
    this.abyssTotalMs = durationMs;
  }

  reset(): void {
    this.explored.fill(0);
    this.extractionDiscovered = false;
    this.abyssCorePositions = [];
    this.abyssEnemyPositions = [];
    this.abyssNodePositions = [];
    this.abyssRemainingMs = 0;
    this.abyssTotalMs = 0;
    this.drawClear();
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

  private drawClear(): void {
    this.ctx.fillStyle = BG_COLOR;
    this.ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  private drawFrame(originTileX: number, originTileY: number, facing: Facing4): void {
    const ctx = this.ctx;
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.save();
    ctx.beginPath();
    ctx.arc(CLIP_CX, CLIP_CY, CLIP_RADIUS, 0, Math.PI * 2);
    ctx.clip();

    for (let wy = 0; wy < WINDOW_TILES; wy++) {
      const my = originTileY + wy;
      if (my < 0 || my >= this.mapHeight) continue;
      const row = this.tiles[my];
      if (!row) continue;
      for (let wx = 0; wx < WINDOW_TILES; wx++) {
        const mx = originTileX + wx;
        if (mx < 0 || mx >= this.mapWidth) continue;
        if (!this.explored[my * this.mapWidth + mx]) continue;

        const tile = row[mx];
        if (tile === undefined || tile === TileType.VOID) continue;
        ctx.fillStyle = tile === TileType.WALL ? EXPLORED_WALL : EXPLORED_FLOOR;
        ctx.fillRect(wx * MINIMAP_SCALE, wy * MINIMAP_SCALE, MINIMAP_SCALE, MINIMAP_SCALE);
      }
    }

    this.drawMarks(originTileX, originTileY, facing);
    ctx.restore();
  }

  /** Pixel center of a map tile inside the current window, or null if outside coverage. */
  private windowCellCenter(
    tileX: number,
    tileY: number,
    originTileX: number,
    originTileY: number,
  ): { cx: number; cy: number } | null {
    const wx = tileX - originTileX;
    const wy = tileY - originTileY;
    if (wx < 0 || wx >= WINDOW_TILES || wy < 0 || wy >= WINDOW_TILES) return null;
    const cx = wx * MINIMAP_SCALE + 1;
    const cy = wy * MINIMAP_SCALE + 1;
    return { cx, cy };
  }

  private drawPlayerCross(facing: Facing4): void {
    const ctx = this.ctx;
    const cx = CLIP_CX;
    const cy = CLIP_CY;
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fillRect(cx - 2, cy, 5, 2);
    ctx.fillRect(cx, cy - 2, 2, 5);
    if (facing === 'up') ctx.fillRect(cx, cy - 4, 2, 2);
    else if (facing === 'right') ctx.fillRect(cx + 3, cy, 2, 2);
    else if (facing === 'down') ctx.fillRect(cx, cy + 3, 2, 2);
    else ctx.fillRect(cx - 4, cy, 2, 2);
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

  private drawMarks(originTileX: number, originTileY: number, facing: Facing4): void {
    if (this.abyssRemainingMs > 0) {
      const alpha = this.abyssDotAlpha();
      if (alpha > 0) {
        for (const pos of this.abyssNodePositions) {
          const cell = this.windowCellCenter(
            Math.floor(pos.x / this.tileSize),
            Math.floor(pos.y / this.tileSize),
            originTileX,
            originTileY,
          );
          if (cell) this.drawNodeDiamond(cell.cx, cell.cy, alpha);
        }
        for (const pos of this.abyssCorePositions) {
          const cell = this.windowCellCenter(Math.floor(pos.x / this.tileSize), Math.floor(pos.y / this.tileSize), originTileX, originTileY);
          if (cell) {
            this.ctx.globalAlpha = alpha;
            this.ctx.fillStyle = '#a49778';
            this.ctx.fillRect(cell.cx - 1, cell.cy - 1, 3, 1);
            this.ctx.fillRect(cell.cx - 1, cell.cy + 1, 3, 1);
            this.ctx.fillRect(cell.cx - 1, cell.cy, 1, 1);
            this.ctx.fillRect(cell.cx + 1, cell.cy, 1, 1);
            this.ctx.globalAlpha = 1;
          }
        }
        for (const pos of this.abyssEnemyPositions) {
          const cell = this.windowCellCenter(
            Math.floor(pos.x / this.tileSize),
            Math.floor(pos.y / this.tileSize),
            originTileX,
            originTileY,
          );
          if (cell) this.drawEnemySquare(cell.cx, cell.cy, alpha);
        }
      }
    }

    if (this.extractionDiscovered && this.extractionTile) {
      const cell = this.windowCellCenter(
        this.extractionTile.x,
        this.extractionTile.y,
        originTileX,
        originTileY,
      );
      if (cell) this.drawExtractSlit(cell.cx, cell.cy);
    }

    this.drawPlayerCross(facing);
  }
}
