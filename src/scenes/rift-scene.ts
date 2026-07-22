/**
 * Rift Scene - Core gameplay.
 * Handles the dungeon exploration, combat, stealth, and collection loop.
 * This is where the player spends most of their time.
 */

import Phaser from 'phaser';

export class RiftScene extends Phaser.Scene {
  constructor() {
    super({ key: 'RiftScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Placeholder: indicate this scene is active
    this.add.text(width / 2, height / 2, 'Rift Scene\n(Core gameplay placeholder)', {
      fontSize: '20px',
      color: '#44cc44',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 60, 'Press ESC to return to menu', {
      fontSize: '14px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Temporary: ESC to go back
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('MainMenuScene');
    });

    // TODO: Slice 1+ will implement:
    // - Map generation and rendering
    // - Player entity with movement
    // - Visibility system
    // - Enemy spawning and AI
    // - Chaos value tracking
    // - HUD overlay
    // - Exit/evacuation logic
  }

  update(_time: number, _delta: number): void {
    // Game loop - systems update here
    // (will be populated in implementation slices)
  }
}
