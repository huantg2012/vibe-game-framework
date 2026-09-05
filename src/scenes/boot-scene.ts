/**
 * Boot Scene - handles asset preloading.
 * First scene to run. Shows loading progress, then transitions to MainMenu.
 */

import Phaser from 'phaser';
import { AUDIO_ASSETS, audioUrlsFor } from '@/managers/audio-catalog';
import { audioManager } from '@/managers/audio-manager';
import {
  CORE_SPRITE_VARIANTS,
  PURIFIER_FRAME_H,
  PURIFIER_FRAME_W,
  PURIFIER_SHEET_KEY,
  STORAGE_FRAME_H,
  STORAGE_FRAME_W,
  STORAGE_SHEET_KEY,
  coreSpriteKey,
  coreSpriteUrl,
} from '@/entities/purification-module';
import { enqueueEntranceSheets } from '@/scenes/rift-entrance-visual';
import { enqueueOfferingSheet } from '@/scenes/offering-stand-visual';
import { enqueueGrowthSheet } from '@/scenes/growth-console-visual';
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

    // 核心模块抽卡贴图 v6（a=敬畏 b=仪式 c=封印）
    // 来源 docs/art/review-2026-08-28/cards/，用 URL ?core=a|b|c 切换实测
    for (const v of CORE_SPRITE_VARIANTS) {
      this.load.image(coreSpriteKey(v), coreSpriteUrl(v));
    }

    // 净化器模块抽卡（B1 横卧过滤罐）——8 帧序列，过滤器必须有动效
    this.load.spritesheet(
      PURIFIER_SHEET_KEY,
      'assets/sprites/modules/purifier-b1-sheet.png',
      { frameWidth: PURIFIER_FRAME_W, frameHeight: PURIFIER_FRAME_H },
    );

    // 储藏模块（C1 顶压观察井，DEC-112）
    this.load.spritesheet(
      STORAGE_SHEET_KEY,
      'assets/sprites/modules/storage-c1-sheet.png',
      { frameWidth: STORAGE_FRAME_W, frameHeight: STORAGE_FRAME_H },
    );

    // 裂隙入口抽卡 spike：三张都预载。缺文件不得打断启动，场景回落圆点。
    enqueueEntranceSheets(this.load);

    // 供奉台（DEC-115）：卡 I 环。缺文件不得打断启动，场景回落圆点。
    enqueueOfferingSheet(this.load);

    // 培养藏（DEC-116）：卡 A 立缸。缺文件不得打断启动，场景回落圆点。
    enqueueGrowthSheet(this.load);
  }

  create(): void {
    audioManager.bind(this.game);
    audioManager.unlock();

    generatePlaceholderTextures(this);

    // Dev deep link: `#rift` or `#purif` boots straight into the target scene.
    if (import.meta.env.DEV) {
      const hash = window.location.hash;
      if (hash === '#rift' || hash.startsWith('#rift=')) {
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
