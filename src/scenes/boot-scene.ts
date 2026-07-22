/**
 * Boot Scene - handles asset preloading.
 * First scene to run. Shows loading progress, then transitions to MainMenu.
 */

import Phaser from 'phaser';

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
   * These will be replaced with real sprites as art is produced.
   */
  private generatePlaceholders(): void {
    // Player placeholder (green square)
    const playerGfx = this.make.graphics({ x: 0, y: 0 });
    playerGfx.fillStyle(0x44cc44, 1);
    playerGfx.fillRect(0, 0, 24, 24);
    playerGfx.generateTexture('placeholder-player', 24, 24);
    playerGfx.destroy();

    // Enemy placeholder (red square)
    const enemyGfx = this.make.graphics({ x: 0, y: 0 });
    enemyGfx.fillStyle(0xcc4444, 1);
    enemyGfx.fillRect(0, 0, 24, 24);
    enemyGfx.generateTexture('placeholder-enemy', 24, 24);
    enemyGfx.destroy();

    // Kindling placeholder (yellow diamond)
    const kindlingGfx = this.make.graphics({ x: 0, y: 0 });
    kindlingGfx.fillStyle(0xccaa22, 1);
    kindlingGfx.fillTriangle(8, 0, 16, 8, 8, 16);
    kindlingGfx.fillTriangle(8, 0, 0, 8, 8, 16);
    kindlingGfx.generateTexture('placeholder-kindling', 16, 16);
    kindlingGfx.destroy();

    // Wall tile placeholder (dark gray)
    const wallGfx = this.make.graphics({ x: 0, y: 0 });
    wallGfx.fillStyle(0x333333, 1);
    wallGfx.fillRect(0, 0, 32, 32);
    wallGfx.lineStyle(1, 0x444444, 0.5);
    wallGfx.strokeRect(0, 0, 32, 32);
    wallGfx.generateTexture('placeholder-wall', 32, 32);
    wallGfx.destroy();

    // Floor tile placeholder (slightly lighter)
    const floorGfx = this.make.graphics({ x: 0, y: 0 });
    floorGfx.fillStyle(0x1a1a1a, 1);
    floorGfx.fillRect(0, 0, 32, 32);
    floorGfx.lineStyle(1, 0x222222, 0.3);
    floorGfx.strokeRect(0, 0, 32, 32);
    floorGfx.generateTexture('placeholder-floor', 32, 32);
    floorGfx.destroy();
  }
}
