/**
 * Main Menu Scene.
 * Title screen with start/continue options.
 */

import Phaser from 'phaser';
import { gameState } from '@/managers/game-state';
import { SAVE_KEY } from '@/types/save-data';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
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
    this.input.keyboard?.once('keydown-ENTER', () => { gameState.reset(); this.scene.start('PurificationScene'); });
    this.input.keyboard?.once('keydown-SPACE', () => { gameState.reset(); this.scene.start('PurificationScene'); });

    // Start new game button
    const startBtn = this.add.text(width / 2, height / 2 + 40, '[ New Expedition ]', {
      fontSize: '18px',
      color: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startBtn.on('pointerover', () => startBtn.setColor('#ffffff'));
    startBtn.on('pointerout', () => startBtn.setColor('#aaaaaa'));
    startBtn.on('pointerdown', () => {
      gameState.reset();
      this.scene.start('PurificationScene');
    });

    // Continue button (only if save exists)
    const hasSave = localStorage.getItem(SAVE_KEY) !== null;
    if (hasSave) {
      const continueBtn = this.add.text(width / 2, height / 2 + 80, '[ Continue ]', {
        fontSize: '18px',
        color: '#aaaaaa',
        fontFamily: 'monospace',
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });

      continueBtn.on('pointerover', () => continueBtn.setColor('#ffffff'));
      continueBtn.on('pointerout', () => continueBtn.setColor('#aaaaaa'));
      continueBtn.on('pointerdown', () => {
        // TODO: Load save and determine which scene to start
        this.scene.start('PurificationScene');
      });
    }
  }
}
