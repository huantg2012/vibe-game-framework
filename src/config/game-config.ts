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
  backgroundColor: '#0a0b0d',
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
    // #game-container 已用 flex 居中（index.html），此处不再让 Phaser 用 margin 二次居中，
    // 否则 flex 会把 "canvas + Phaser 居中 margin" 整体再居中一次，导致内容偏移。
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  render: {
    antialias: false,
    antialiasGL: false,
  },
};
