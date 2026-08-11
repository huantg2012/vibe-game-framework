/**
 * Boot Scene - handles asset preloading.
 * First scene to run. Shows loading progress, then transitions to MainMenu.
 */

import Phaser from 'phaser';
import { GAME_CONSTANTS } from '@/config/constants';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    const loadingText = this.add.text(width / 2, height / 2 - 40, 'Loading...', {
      fontSize: '16px',
      color: '#cccccc',
    });
    loadingText.setOrigin(0.5, 0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x666666, 1);
      progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // -------------------------------------------------------
    // Asset loading goes here as the project grows.
    // For now, we generate placeholder graphics at runtime.
    // -------------------------------------------------------
  }

  create(): void {
    // Generate placeholder textures for development
    this.generatePlaceholders();

    // Dev deep link: `#rift` or `#purif` boots straight into the target scene.
    if (import.meta.env.DEV) {
      const hash = window.location.hash;
      if (hash === '#rift') {
        this.scene.start('RiftScene');
        return;
      }
      if (hash === '#purif') {
        this.scene.start('PurificationScene');
        return;
      }
    }
    this.scene.start('MainMenuScene');
  }

  /**
   * Generate placeholder graphics so the game can run without art assets.
   * Colours follow the placeholder encoding protocol in art-direction section 12;
   * they get replaced per asset class as real art lands.
   */
  private generatePlaceholders(): void {
    const tile = GAME_CONSTANTS.TILE_SIZE;

    this.generatePlayerSprite();

    // Legacy facing marker kept for backward compat (other systems may reference it).
    const facingGfx = this.make.graphics({ x: 0, y: 0 });
    facingGfx.fillStyle(0xffffff, 1);
    facingGfx.fillTriangle(10, 6, 0, 0, 0, 12);
    facingGfx.generateTexture('placeholder-player-facing', 10, 12);
    facingGfx.destroy();

    this.generateEnemyPlaceholders();

    // Kindling placeholder (dark gold crystalline downward triangle, 5 irregular vertices)
    const kindlingGfx = this.make.graphics({ x: 0, y: 0 });
    kindlingGfx.fillStyle(0x8a6020, 1);
    kindlingGfx.fillPoints([
      { x: 8, y: 0 },
      { x: 14, y: 3 },
      { x: 15, y: 9 },
      { x: 8, y: 16 },
      { x: 1, y: 9 },
    ], true);
    // Bright facet highlight
    kindlingGfx.fillStyle(0xb88030, 1);
    kindlingGfx.fillPoints([
      { x: 8, y: 1 },
      { x: 12, y: 4 },
      { x: 10, y: 7 },
      { x: 6, y: 5 },
    ], true);
    kindlingGfx.generateTexture('placeholder-kindling', 16, 16);
    kindlingGfx.destroy();

    this.generateRiftTileset(tile);
  }

  /**
   * Player body: 4 directional textures (32x32 each) for 3/4 top-down view.
   * Generates: player-down, player-left, player-right, player-up
   * Warm orange tones (#8a5c2a body) so the player is the only warm object on screen.
   */
  private generatePlayerSprite(): void {
    // --- Frame 0: Down (facing toward camera) ---
    const gDown = this.make.graphics({ x: 0, y: 0 });
    // Body (torso)
    gDown.fillStyle(0x5a3818);
    gDown.fillRect(12, 16, 8, 6);
    // Shoulders
    gDown.fillStyle(0x6a4420);
    gDown.fillRect(10, 12, 12, 4);
    // Head (top)
    gDown.fillStyle(0x8a5c2a);
    gDown.fillEllipse(16, 10, 7, 5);
    // Face hint (dark area on head)
    gDown.fillStyle(0x3a2818);
    gDown.fillRect(14, 10, 4, 3);
    // Shoulder lamp (right shoulder)
    gDown.fillStyle(0xc4873a);
    gDown.fillRect(21, 12, 2, 2);
    gDown.generateTexture('player-down', 32, 32);
    gDown.destroy();

    // --- Frame 1: Left (facing left) ---
    const gLeft = this.make.graphics({ x: 0, y: 0 });
    // Body
    gLeft.fillStyle(0x5a3818);
    gLeft.fillRect(13, 16, 7, 6);
    // Shoulders (left shoulder prominent)
    gLeft.fillStyle(0x6a4420);
    gLeft.fillRect(10, 12, 11, 4);
    // Head
    gLeft.fillStyle(0x8a5c2a);
    gLeft.fillEllipse(15, 10, 6, 5);
    // Shoulder lamp (left shoulder visible)
    gLeft.fillStyle(0xc4873a);
    gLeft.fillRect(10, 12, 2, 2);
    gLeft.generateTexture('player-left', 32, 32);
    gLeft.destroy();

    // --- Frame 2: Right (facing right, mirror of left) ---
    const gRight = this.make.graphics({ x: 0, y: 0 });
    // Body
    gRight.fillStyle(0x5a3818);
    gRight.fillRect(12, 16, 7, 6);
    // Shoulders (right shoulder prominent)
    gRight.fillStyle(0x6a4420);
    gRight.fillRect(11, 12, 11, 4);
    // Head
    gRight.fillStyle(0x8a5c2a);
    gRight.fillEllipse(17, 10, 6, 5);
    // Shoulder lamp (right shoulder visible)
    gRight.fillStyle(0xc4873a);
    gRight.fillRect(20, 12, 2, 2);
    gRight.generateTexture('player-right', 32, 32);
    gRight.destroy();

    // --- Frame 3: Up (facing away from camera) ---
    const gUp = this.make.graphics({ x: 0, y: 0 });
    // Backpack bump (visible from behind)
    gUp.fillStyle(0x2a2018);
    gUp.fillRect(13, 18, 6, 4);
    // Body
    gUp.fillStyle(0x5a3818);
    gUp.fillRect(12, 16, 8, 6);
    // Shoulders
    gUp.fillStyle(0x6a4420);
    gUp.fillRect(10, 12, 12, 4);
    // Head (back of head, slightly darker)
    gUp.fillStyle(0x7a4c22);
    gUp.fillEllipse(16, 10, 7, 5);
    // Shoulder lamp (right shoulder)
    gUp.fillStyle(0xc4873a);
    gUp.fillRect(21, 12, 2, 2);
    gUp.generateTexture('player-up', 32, 32);
    gUp.destroy();

    // Also generate a single 'player-body' as default (uses down frame)
    const gDefault = this.make.graphics({ x: 0, y: 0 });
    gDefault.fillStyle(0x5a3818);
    gDefault.fillRect(12, 16, 8, 6);
    gDefault.fillStyle(0x6a4420);
    gDefault.fillRect(10, 12, 12, 4);
    gDefault.fillStyle(0x8a5c2a);
    gDefault.fillEllipse(16, 10, 7, 5);
    gDefault.fillStyle(0x3a2818);
    gDefault.fillRect(14, 10, 4, 3);
    gDefault.fillStyle(0xc4873a);
    gDefault.fillRect(21, 12, 2, 2);
    gDefault.generateTexture('player-body', 32, 32);
    gDefault.destroy();

    // Shoulder lamp: tiny 2x2 texture (orange dot) for the separate lamp sprite
    const lamp = this.make.graphics({ x: 0, y: 0 });
    lamp.fillStyle(0xc4873a);
    lamp.fillRect(0, 0, 2, 2);
    lamp.generateTexture('player-lamp', 2, 2);
    lamp.destroy();

    // Backward-compat texture alias
    const compat = this.make.graphics({ x: 0, y: 0 });
    compat.fillStyle(0x5a3818);
    compat.fillRect(12, 16, 8, 6);
    compat.fillStyle(0x6a4420);
    compat.fillRect(10, 12, 12, 4);
    compat.fillStyle(0x8a5c2a);
    compat.fillEllipse(16, 10, 7, 5);
    compat.fillStyle(0x3a2818);
    compat.fillRect(14, 10, 4, 3);
    compat.fillStyle(0xc4873a);
    compat.fillRect(21, 12, 2, 2);
    compat.generateTexture('placeholder-player', 32, 32);
    compat.destroy();
  }

  /**
   * Infiltrator (top-down): irregular asymmetric polygon, cold blue-gray with teal
   * scatter dots. Larger than the player (24x24 vs 32x32 canvas but ~16px diameter
   * vs player's ~14px), distinctly colder in hue. Rotation indicates facing.
   */
  private generateEnemyPlaceholders(): void {
    const ai = GAME_CONSTANTS.AI;

    const bodyGfx = this.make.graphics({ x: 0, y: 0 });
    const cx = 12; // center of 24x24
    const cy = 12;

    // Irregular asymmetric polygon (cold gray) - 9 vertices, not symmetric
    bodyGfx.fillStyle(0x3a4448);
    bodyGfx.fillPoints([
      { x: cx, y: cy - 8 },       // top (facing direction)
      { x: cx + 5, y: cy - 5 },   // top-right
      { x: cx + 7, y: cy - 1 },   // right shoulder (wider)
      { x: cx + 6, y: cy + 4 },   // right lower
      { x: cx + 3, y: cy + 7 },   // bottom-right
      { x: cx - 2, y: cy + 6 },   // bottom-left (narrower)
      { x: cx - 5, y: cy + 3 },   // left lower
      { x: cx - 6, y: cy - 2 },   // left shoulder (narrower than right)
      { x: cx - 3, y: cy - 6 },   // top-left
    ], true);

    // Teal scatter dots (4 "pollution leak" dots, irregular positions)
    bodyGfx.fillStyle(0x1aad96);
    bodyGfx.fillRect(cx + 2, cy - 3, 1, 1);   // dot 1
    bodyGfx.fillRect(cx - 3, cy + 1, 1, 1);   // dot 2
    bodyGfx.fillRect(cx + 4, cy + 2, 1, 1);   // dot 3
    bodyGfx.fillRect(cx - 1, cy + 4, 1, 1);   // dot 4

    bodyGfx.generateTexture('placeholder-enemy', 24, 24);
    bodyGfx.destroy();

    const dotGfx = this.make.graphics({ x: 0, y: 0 });
    dotGfx.fillStyle(ai.INDICATOR_COLOR, 1);
    dotGfx.fillRect(0, 0, 4, 4);
    dotGfx.generateTexture('placeholder-enemy-dot', 4, 4);
    dotGfx.destroy();

    const lockGfx = this.make.graphics({ x: 0, y: 0 });
    lockGfx.fillStyle(ai.INDICATOR_COLOR, 1);
    lockGfx.fillTriangle(0, 0, 8, 0, 4, 6);
    lockGfx.generateTexture('placeholder-enemy-lock', 8, 6);
    lockGfx.destroy();
  }

  /**
   * Rift tileset placeholder: frame index equals the `TileType` value, so tile data can
   * be handed to the tilemap unchanged. Solid colours with a 1px inner border, per the
   * placeholder strategy (walkable #1a1a1a, wall #000000).
   */
  private generateRiftTileset(tile: number): void {
    const gfx = this.make.graphics({ x: 0, y: 0 });

    // frame 0 - wall
    gfx.fillStyle(0x000000, 1);
    gfx.fillRect(0, 0, tile, tile);
    gfx.lineStyle(1, 0x0a0a0a, 1);
    gfx.strokeRect(0.5, 0.5, tile - 1, tile - 1);

    // frame 1 - walkable floor
    gfx.fillStyle(0x1a1a1a, 1);
    gfx.fillRect(tile, 0, tile, tile);
    gfx.lineStyle(1, 0x232323, 1);
    gfx.strokeRect(tile + 0.5, 0.5, tile - 1, tile - 1);

    gfx.generateTexture('placeholder-rift-tileset', tile * 2, tile);
    gfx.destroy();
  }
}
