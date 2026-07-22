/**
 * Phaser game configuration.
 */

import Phaser from 'phaser';
import { BootScene } from '@/scenes/boot-scene';
import { MainMenuScene } from '@/scenes/main-menu-scene';
import { RiftScene } from '@/scenes/rift-scene';
import { PurificationScene } from '@/scenes/purification-scene';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 960,
  height: 640,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0a0a0a',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, MainMenuScene, RiftScene, PurificationScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    antialias: false,
    antialiasGL: false,
  },
};
