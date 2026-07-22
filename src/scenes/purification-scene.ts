/**
 * Purification Scene - Base management as a walkable space.
 *
 * Design: A tiny top-down area (~12x10 tiles) where the player walks around.
 * Modules are interactable entities; approaching one triggers a DOM management panel.
 * The boundary is visible - beyond it is darkness with periodic, subtle movement
 * hinting at the external pollution pressing in.
 *
 * Reuses RiftScene's rendering pipeline: player movement, visibility system, tile rendering.
 * Does NOT use: AI, chaos, pathfinding, combat.
 */

import Phaser from 'phaser';

export class PurificationScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PurificationScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Placeholder: indicate this scene is active
    this.add.text(width / 2, height / 2 - 20, 'Purification Point', {
      fontSize: '20px',
      color: '#4488cc',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 20, '(Walkable space + boundary atmosphere placeholder)', {
      fontSize: '14px',
      color: '#555555',
      fontFamily: 'monospace',
      align: 'center',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 60, 'Press ENTER to enter rift', {
      fontSize: '14px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 80, 'Press ESC to return to menu', {
      fontSize: '14px',
      color: '#666666',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Temporary navigation
    this.input.keyboard?.on('keydown-ENTER', () => {
      this.scene.start('RiftScene');
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.start('MainMenuScene');
    });

    // TODO: Implementation slices will add:
    // - Static small tilemap (hand-designed, ~12x10 tiles)
    // - Player entity with movement (reuse from RiftScene)
    // - Visibility system (reuse, adjusted parameters for full interior light)
    // - Module entities (sprites with overlap trigger zones)
    // - InteractionTrigger system (approach → prompt → DOM panel)
    // - BoundaryAtmosphere system:
    //   - Dark background beyond boundary
    //   - Particle emitter: large, low-alpha drifting particles (30-50 count)
    //   - Periodic sprite apparitions: blurry shapes fade in/out every 8-15s
    //   - Intensity scales with impactIntensity (more activity before impacts)
    // - DOM overlay panels (allocation, module status)
    // - Rift entrance interactable (triggers expedition confirmation)
  }

  update(_time: number, _delta: number): void {
    // Game loop - boundary atmosphere + interaction checks
    // (will be populated in implementation slices)
  }
}
