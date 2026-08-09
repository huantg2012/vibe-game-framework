/**
 * Main Menu Scene.
 * Title screen with start/continue options.
 */

import Phaser from 'phaser';
import { gameState } from '@/managers/game-state';
import { saveManager } from '@/managers/save-manager';
import { contaminantSystem } from '@/systems/contaminant-system';
import { growthSystem } from '@/systems/growth-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { tideSystem } from '@/systems/tide-system';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  private startNewExpedition(): void {
    saveManager.deleteSave();
    gameState.reset();
    tideSystem.reset();
    contaminantSystem.reset();
    growthSystem.reset();
    stabilityTracker.reset();
    this.scene.start('PurificationScene');
  }

  private continueExpedition(): void {
    const loaded = saveManager.load();
    if (loaded) {
      this.scene.start('PurificationScene');
    } else {
      // Save corrupted, start fresh
      this.startNewExpedition();
    }
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Title
    this.add.text(width / 2, height / 3, 'COH', {
      fontSize: '48px',
      color: '#888888',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(width / 2, height / 3 + 50, 'Prototype Build', {
      fontSize: '14px',
      color: '#555555',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // The game itself is keyboard-driven (DEC-008), so the menu is too.
    this.input.keyboard?.once('keydown-ENTER', () => { this.startNewExpedition(); });
    this.input.keyboard?.once('keydown-SPACE', () => { this.startNewExpedition(); });

    // Start new game button
    const startBtn = this.add.text(width / 2, height / 2 + 40, '[ New Expedition ]', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerout', () => startBtn.setColor('#aaaaaa'));
    startBtn.on('pointerdown', () => { this.startNewExpedition(); });

    // Continue button (only if save exists)
    if (saveManager.hasSave()) {
      const continueBtn = this.add.text(width / 2, height / 2 + 80, '[ Continue ]', {
        fontSize: '18px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'));
      continueBtn.on('pointerout', () => continueBtn.setColor('#aaaaaa'));
      continueBtn.on('pointerdown', () => { this.continueExpedition(); });
    }
  }
}
