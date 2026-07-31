/**
 * Rift Scene - core gameplay.
 *
 * At this point in Slice 1 it owns the fixed map, the player and the limited field of
 * view. Enemies (T7), combat (T8) and chaos/loot/extraction (T9) plug in on top; the
 * layout data they need is already published by `RIFT_MAP.layout`.
 *
 * The scene is the orchestration layer: it owns the system instances and does the wiring
 * between them, which is what keeps the systems from calling each other directly
 * (architecture DEC-ARCH-002).
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';
import { Player } from '@/entities/player';
import { RIFT_MAP, validateRiftMap } from '@/scenes/rift-map-data';
import { TilemapRenderer } from '@/systems/tilemap-renderer';
import { createRiftSurfaceTexture } from '@/systems/procedural-surface';
import { createRiftVisionConfig, VisibilitySystem } from '@/systems/visibility-system';
import { TileType } from '@/types/game-types';

/** Render depths. The gaps leave room for decals, entities and the HUD. */
const DEPTH = {
  surface: 0,
  player: 30,
  visionMask: 50,
} as const;

const RIFT_SURFACE_KEY = 'rift-surface';

export class RiftScene extends Phaser.Scene {
  private readonly tilemapRenderer = new TilemapRenderer();
  private readonly player = new Player();
  private readonly visibility = new VisibilitySystem();

  private debugPanel: HTMLDivElement | null = null;
  private debugVisible = true;
  /** Seeded past the refresh interval so the panel has content on the first frame. */
  private debugAccumulatorMs = Number.POSITIVE_INFINITY;

  constructor() {
    super({ key: 'RiftScene' });
  }

  create(): void {
    const { tileMap, grid, layout } = RIFT_MAP;

    if (import.meta.env.DEV) {
      const problems = validateRiftMap();
      if (problems.length > 0) {
        console.error(`[RiftScene] fixed map validation failed:\n- ${problems.join('\n- ')}`);
      }
    }

    // The tilemap layer stays for physics/collision but is made invisible: the visible
    // surface is a continuous procedural texture (DEC-018), not the flat placeholder tiles.
    const layer = this.tilemapRenderer.create(this, tileMap, {
      tilesetKey: 'placeholder-rift-tileset',
      collidingIndices: [TileType.WALL],
      depth: DEPTH.surface,
    });
    layer.setVisible(false);

    createRiftSurfaceTexture(this, tileMap, RIFT_SURFACE_KEY);
    this.add.image(0, 0, RIFT_SURFACE_KEY).setOrigin(0, 0).setDepth(DEPTH.surface);

    this.physics.world.setBounds(0, 0, grid.widthPx, grid.heightPx);

    // Zoom must be set before the visibility system sizes its mask to the view.
    const camera = this.cameras.main;
    camera.setBounds(0, 0, grid.widthPx, grid.heightPx);
    camera.setZoom(GAME_CONSTANTS.CAMERA.ZOOM);
    camera.setBackgroundColor(GAME_CONSTANTS.VISIBILITY.VOID_COLOR);

    this.player.create(this, { spawn: layout.spawnPoint, depth: DEPTH.player, facing: 'right' });
    this.physics.add.collider(this.player.getSprite(), layer);
    camera.startFollow(this.player.getSprite(), true);

    this.visibility.create(this, createRiftVisionConfig(DEPTH.visionMask), grid);

    // Visibility runs after the physics step so the mask and the sprite agree on where
    // the player actually ended up this frame.
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);

    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);

    if (import.meta.env.DEV) this.createDebugOverlay();
  }

  update(_time: number, delta: number): void {
    this.player.update(delta);
  }

  private onPostUpdate(_time: number, delta: number): void {
    this.player.postUpdate();
    this.visibility.update(this.player.getPosition(), this.player.getFacingAngle(), delta);
    if (this.debugPanel) this.updateDebugOverlay(delta);
  }

  private returnToMenu(): void {
    this.scene.start('MainMenuScene');
  }

  private onShutdown(): void {
    this.events.off(Phaser.Scenes.Events.POST_UPDATE, this.onPostUpdate, this);
    this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
    this.input.keyboard?.off('keydown-F1');
    this.visibility.destroy();
    this.player.destroy();
    this.tilemapRenderer.destroy();
    this.debugPanel?.remove();
    this.debugPanel = null;
  }

  // ------------------------------------------------------------ dev overlay

  /**
   * Reports the numbers this slice has to be verified against: framing in tiles, the
   * raycasting cost against its 2 ms budget, and whether the static cache is holding.
   *
   * A DOM overlay rather than a Phaser Text: scroll-factor-0 game objects are still
   * transformed by the camera zoom, so anything meant to be screen-space needs either a
   * second camera or the DOM. The DOM is the cheaper answer for a dev panel.
   * Dev builds only; F1 toggles it.
   */
  private createDebugOverlay(): void {
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:8px',
      'z-index:10',
      'padding:4px 6px',
      'font:11px/1.45 monospace',
      'color:#8ad8cc',
      'background:rgba(0,0,0,0.55)',
      'white-space:pre',
      'pointer-events:none',
    ].join(';');
    (document.getElementById('game-container') ?? document.body).appendChild(panel);
    this.debugPanel = panel;

    this.input.keyboard?.on('keydown-F1', () => {
      this.debugVisible = !this.debugVisible;
      if (this.debugPanel) this.debugPanel.style.display = this.debugVisible ? 'block' : 'none';
    });
  }

  private updateDebugOverlay(delta: number): void {
    this.debugAccumulatorMs += delta;
    if (this.debugAccumulatorMs < 200) return;
    this.debugAccumulatorMs = 0;

    const camera = this.cameras.main;
    const tile = GAME_CONSTANTS.TILE_SIZE;
    const stats = this.visibility.getStats();
    const position = this.player.getPosition();
    const view = camera.worldView;

    if (!this.debugPanel) return;
    this.debugPanel.textContent = [
      `fps ${Math.round(this.game.loop.actualFps)}  zoom ${camera.zoom}`,
      `viewport ${Math.round(view.width)}x${Math.round(view.height)}px = ` +
        `${(view.width / tile).toFixed(1)}x${(view.height / tile).toFixed(1)} tiles`,
      `rays ${stats.rayCount}  last ${stats.lastMs.toFixed(2)}ms  ` +
        `avg ${stats.avgMs.toFixed(2)}ms  budget ${GAME_CONSTANTS.VISIBILITY.BUDGET_MS}ms`,
      `degrade ${stats.degradeLevel}  ${stats.cached ? 'cached' : 'recast'}`,
      `pos ${Math.round(position.x)},${Math.round(position.y)}  ` +
        `tile ${Math.floor(position.x / tile)},${Math.floor(position.y / tile)}  ` +
        `facing ${this.player.getFacing4()}`,
      'F1 overlay   ESC menu',
    ].join('\n');
  }
}
