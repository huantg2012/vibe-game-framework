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

    // Kindling placeholder (teal diamond: kindling is contamination-side, not warm)
    const kindlingGfx = this.make.graphics({ x: 0, y: 0 });
    kindlingGfx.fillStyle(0x2ae6c8, 1);
    kindlingGfx.fillTriangle(8, 0, 16, 8, 8, 16);
    kindlingGfx.fillTriangle(8, 0, 0, 8, 8, 16);
    kindlingGfx.generateTexture('placeholder-kindling', 16, 16);
    kindlingGfx.destroy();

    this.generateRiftTileset(tile);
  }

  /**
   * Player body: 32x32 industrial suit silhouette + 2x2 shoulder lamp texture.
   * Generated once, cached by key. The lamp sprite follows the player based on facing.
   */
  private generatePlayerSprite(): void {
    const g = this.make.graphics({ x: 0, y: 0 });
    const cx = 16; // center x

    // Legs (bottom shadow)
    g.fillStyle(0x151a1e);
    g.fillRect(cx - 4, 22, 3, 4);
    g.fillRect(cx + 1, 22, 3, 4);

    // Torso (hexagonal-ish shape)
    g.fillStyle(0x2c2e33);
    g.fillRect(cx - 5, 10, 10, 12);
    // Shoulder widening
    g.fillRect(cx - 6, 11, 12, 8);

    // Backpack bump
    g.fillStyle(0x2a2a2e);
    g.fillRect(cx - 3, 14, 6, 5);

    // Head
    g.fillStyle(0x3a3d42);
    g.fillRect(cx - 2, 6, 4, 5);

    // Bottom/right shadow edge (1px)
    g.fillStyle(0x151a1e);
    g.fillRect(cx - 6, 19, 12, 1);
    g.fillRect(cx + 6, 11, 1, 8);

    g.generateTexture('player-body', 32, 32);
    g.destroy();

    // Shoulder lamp: tiny 2x2 texture (orange dot)
    const lamp = this.make.graphics({ x: 0, y: 0 });
    lamp.fillStyle(0xc4873a);
    lamp.fillRect(0, 0, 2, 2);
    lamp.generateTexture('player-lamp', 2, 2);
    lamp.destroy();

    // Also register 'placeholder-player' pointing to the same silhouette so any
    // remaining references still resolve to a valid texture.
    const compat = this.make.graphics({ x: 0, y: 0 });
    const ccx = 16;
    compat.fillStyle(0x151a1e);
    compat.fillRect(ccx - 4, 22, 3, 4);
    compat.fillRect(ccx + 1, 22, 3, 4);
    compat.fillStyle(0x2c2e33);
    compat.fillRect(ccx - 5, 10, 10, 12);
    compat.fillRect(ccx - 6, 11, 12, 8);
    compat.fillStyle(0x2a2a2e);
    compat.fillRect(ccx - 3, 14, 6, 5);
    compat.fillStyle(0x3a3d42);
    compat.fillRect(ccx - 2, 6, 4, 5);
    compat.fillStyle(0x151a1e);
    compat.fillRect(ccx - 6, 19, 12, 1);
    compat.fillRect(ccx + 6, 11, 1, 8);
    compat.generateTexture('placeholder-player', 32, 32);
    compat.destroy();
  }

  /**
   * Infiltrator: distorted humanoid silhouette with teal scatter dots ("bad pixels").
   * The asymmetric proportions (one shoulder higher, arms too long) signal "not quite
   * human" at a glance. State communication rides on the separate indicator sprites
   * (dot + lock triangle) positioned above the head by enemy-factory.
   */
  private generateEnemyPlaceholders(): void {
    const ai = GAME_CONSTANTS.AI;

    const bodyGfx = this.make.graphics({ x: 0, y: 0 });
    // Base body (dark, low contrast with environment)
    bodyGfx.fillStyle(0x2e2d30);
    // Head (small, offset slightly)
    bodyGfx.fillRect(10, 1, 3, 3);
    // Shoulders (asymmetric - one higher than other)
    bodyGfx.fillRect(7, 4, 4, 2);  // left shoulder (higher)
    bodyGfx.fillRect(13, 5, 4, 2); // right shoulder (lower)
    // Torso
    bodyGfx.fillRect(8, 6, 8, 8);
    // Arms (too long - 2px longer than normal)
    bodyGfx.fillRect(5, 5, 3, 10);  // left arm (long)
    bodyGfx.fillRect(16, 6, 3, 10); // right arm (long)
    // Legs
    bodyGfx.fillRect(9, 14, 3, 6);
    bodyGfx.fillRect(13, 14, 3, 6);
    // Teal scatter dots (5 "bad pixels" signature)
    bodyGfx.fillStyle(0x1aad96);
    bodyGfx.fillRect(9, 7, 1, 1);   // dot 1 on torso
    bodyGfx.fillRect(14, 9, 1, 1);  // dot 2 on torso
    bodyGfx.fillRect(6, 8, 1, 1);   // dot 3 on left arm
    bodyGfx.fillRect(17, 12, 1, 1); // dot 4 on right arm
    bodyGfx.fillRect(11, 3, 1, 1);  // dot 5 on head
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
