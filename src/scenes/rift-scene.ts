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
import { createRiftVisionConfig, VisibilitySystem } from '@/systems/visibility-system';
import { TileType } from '@/types/game-types';

/** Render depths. The gaps leave room for decals, entities and the HUD. */
const DEPTH = {
  tilemap: 0,
  player: 30,
  visionMask: 50,
  debug: 200,
} as const;

export class RiftScene extends Phaser.Scene {
  private readonly tilemapRenderer = new TilemapRenderer();
  private readonly player = new Player();
  private readonly visibility = new VisibilitySystem();

  private debugText: Phaser.GameObjects.Text | null = null;
  private debugAccumulatorMs = 0;

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

    const layer = this.tilemapRenderer.create(this, tileMap, {
      tilesetKey: 'placeholder-rift-tileset',
      collidingIndices: [TileType.WALL],
      depth: DEPTH.tilemap,
    });

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
    if (this.debugText) this.updateDebugOverlay(delta);
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
    this.debugText?.destroy();
    this.debugText = null;
  }

  // ------------------------------------------------------------ dev overlay

  /**
   * Reports the numbers this slice has to be verified against: framing in tiles, the
   * raycasting cost against its 2 ms budget, and whether the static cache is holding.
   * Dev builds only; F1 toggles it.
   */
  private createDebugOverlay(): void {
    this.debugText = this.add
      .text(6, 6, '', {
        fontSize: '11px',
        color: '#8ad8cc',
        fontFamily: 'monospace',
        backgroundColor: '#00000088',
        padding: { x: 4, y: 3 },
      })
      .setScrollFactor(0)
      .setScale(1 / GAME_CONSTANTS.CAMERA.ZOOM)
      .setDepth(DEPTH.debug);

    this.input.keyboard?.on('keydown-F1', () => {
      this.debugText?.setVisible(!this.debugText.visible);
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

    this.debugText?.setText(
      [
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
      ].join('\n')
    );
  }
}
