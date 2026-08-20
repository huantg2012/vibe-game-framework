/**
 * Phaser game configuration.
 *
 * Visual / physics fields are shared with the gym (`gameConfigWithScenes`) so
 * pixelArt, FIT scale, and Arcade settings cannot drift from the sortie.
 */

import Phaser from 'phaser';
import { BootScene } from '@/scenes/boot-scene';
import { MainMenuScene } from '@/scenes/main-menu-scene';
import { RiftScene } from '@/scenes/rift-scene';
import { PurificationScene } from '@/scenes/purification-scene';

const VIEW: Omit<Phaser.Types.Core.GameConfig, 'scene'> = {
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
  scale: {
    mode: Phaser.Scale.FIT,
    // #game-container 已用 flex 居中（index.html / gym.html），此处不再让 Phaser 用 margin 二次居中，
    // 否则 flex 会把 "canvas + Phaser 居中 margin" 整体再居中一次，导致内容偏移。
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  render: {
    antialias: false,
    antialiasGL: false,
  },
};

export function gameConfigWithScenes(
  scene: Phaser.Types.Core.GameConfig['scene'],
): Phaser.Types.Core.GameConfig {
  return { ...VIEW, scene };
}

export const gameConfig: Phaser.Types.Core.GameConfig = gameConfigWithScenes([
  BootScene,
  MainMenuScene,
  RiftScene,
  PurificationScene,
]);
