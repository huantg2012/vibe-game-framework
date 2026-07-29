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

    // Transition to main menu
    this.scene.start('MainMenuScene');
  }

  /**
   * Generate placeholder graphics so the game can run without art assets.
   * Colours follow the placeholder encoding protocol in art-direction section 12;
   * they get replaced per asset class as real art lands.
   */
  private generatePlaceholders(): void {
    const tile = GAME_CONSTANTS.TILE_SIZE;
    const bodySize = GAME_CONSTANTS.PLAYER.BODY_SIZE;

    // Player: white rectangle matching the collider, inside a tile-sized frame.
    const playerGfx = this.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0xffffff, 1);
    playerGfx.fillRect((tile - bodySize) / 2, (tile - bodySize) / 2, bodySize, bodySize);
    playerGfx.generateTexture('placeholder-player', tile, tile);
    playerGfx.destroy();

    // Player facing marker: a triangle pointing along +x, rotated to the facing angle.
    const facingGfx = this.make.graphics({ x: 0, y: 0 });
    facingGfx.fillStyle(0xffffff, 1);
    facingGfx.fillTriangle(10, 6, 0, 0, 0, 12);
    facingGfx.generateTexture('placeholder-player-facing', 10, 12);
    facingGfx.destroy();

    // Enemy placeholder (dark red, lowest threat tier)
    const enemyGfx = this.make.graphics({ x: 0, y: 0 });
    enemyGfx.fillStyle(0xcc4444, 1);
    enemyGfx.fillRect(0, 0, 24, 24);
    enemyGfx.generateTexture('placeholder-enemy', 24, 24);
    enemyGfx.destroy();

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
