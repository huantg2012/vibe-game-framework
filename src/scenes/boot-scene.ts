/**
 * Boot Scene - handles asset preloading.
 * First scene to run. Shows loading progress, then transitions to MainMenu.
 */

import Phaser from 'phaser';
import { AUDIO_ASSETS, audioUrlsFor } from '@/managers/audio-catalog';
import { audioManager } from '@/managers/audio-manager';
import { generatePlaceholderTextures } from '@/scenes/placeholder-textures';

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

    const loadingText = this.add.text(width / 2, height / 2 - 40, '载入', {
      fontSize: '16px',
      color: '#cccccc',
    });
    loadingText.setOrigin(0.5, 0.5);
    loadingText.setPadding({ top: 4, right: 0, bottom: 0, left: 0 });

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

    for (const asset of AUDIO_ASSETS) {
      this.load.audio(asset.key, audioUrlsFor(asset));
    }
  }

  create(): void {
    audioManager.bind(this.game);
    audioManager.unlock();

    generatePlaceholderTextures(this);

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
}
