/**
 * 供奉台外形抽卡对比课。六卡两行三列，打开即播，放大 6×。
 *
 * 第一轮 A/B/C 是同一句形体——实心方块 + 前左面开洞，只有块的高矮与表面纹理在换，
 * 剪影类别只有一个（人 2026-09-04：「本质上是同一个方向只是调整了大小，区分度非常低」）。
 * 第二轮换按**形体类**拆：D 横向外伸 / E 竖向细高 / F 贴地矮宽。上排是第一轮，
 * 下排是第二轮。人没抽卡不翻默认。
 *
 * 身份已锁（`docs/design-notes/offering-stand-identity.md`）：**一台同时起收容、
 * 控制、暴露三种作用的装置。** 不是架子、不是祭坛。相机 = 45° 等距，与已锁三台同一套。
 * 外观不显槽数——里面那点青绿是活层，不对应具体槽位。
 *
 * 底是与出击同一份净化点混凝土（`createPurificationFloorTexture`），不是纯黑——
 * 纯黑会把任何不透明外沿看成描边（`.cursor/skills/pixel-models/SKILL.md` 画法定律第 10 条）。
 * 不刷玩家、不走出击、不进主菜单。生产默认仍是呼吸圆点，人没抽卡不翻默认。
 */

import Phaser from 'phaser';
import { createPurificationFloorTexture } from '@/scenes/purification-scene';

const FRAME_W = 32;
const FRAME_H = 32;
const FRAMES = 8;
const FPS = 6;
/** footprint 中心在 23/32；前角还会往下探，接地斑落在 29/30。 */
const ORIGIN_Y = 26 / FRAME_H;
const CARD_SCALE = 6;
const CARD_XS = [200, 480, 760] as const;
/** 上排 = 第一轮（方块类）；下排 = 第二轮（三种别的形体类）。 */
const ROW_YS = [230, 560] as const;
const FLOOR_KEY = 'gym-offering-floor';
const HIGHLIGHT = 0x2ae6c8;

const VARIANTS = ['a', 'b', 'c', 'd', 'e', 'f'] as const;
type OfferingVariant = (typeof VARIANTS)[number];

const LABELS: Record<OfferingVariant, string> = {
  a: '卡 A 压钳 · 方块',
  b: '卡 B 笼斗 · 方块',
  c: '卡 C 浇墩 · 方块',
  d: '卡 D 举出 · 横伸',
  e: '卡 E 抱箍 · 竖高',
  f: '卡 F 压槽 · 贴地',
};

const DIGIT_KEYCODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
  Phaser.Input.Keyboard.KeyCodes.FOUR,
  Phaser.Input.Keyboard.KeyCodes.FIVE,
  Phaser.Input.Keyboard.KeyCodes.SIX,
] as const;

function sheetKey(variant: OfferingVariant): string {
  return `offering-${variant}`;
}

function animKey(variant: OfferingVariant): string {
  return `offering-${variant}-run`;
}

interface CardSlot {
  readonly variant: OfferingVariant;
  readonly x: number;
  readonly y: number;
  sprite: Phaser.GameObjects.Sprite | null;
  missingLabel: Phaser.GameObjects.Text | null;
}

export class GymOfferingCardScene extends Phaser.Scene {
  private slots: CardSlot[] = [];
  private highlight: Phaser.GameObjects.Graphics | null = null;
  private selected: OfferingVariant = 'a';
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super({ key: 'GymOfferingCardScene' });
  }

  preload(): void {
    this.load.on('loaderror', () => {
      /* 贴图缺失不得打断启动：场景用 textures.exists 回落到「图未到」 */
    });
    for (const variant of VARIANTS) {
      this.load.spritesheet(
        sheetKey(variant),
        `assets/sprites/modules/offering-${variant}-sheet.png?v=offering01`,
        { frameWidth: FRAME_W, frameHeight: FRAME_H },
      );
    }
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, 960, 640);
    camera.setZoom(1);
    camera.centerOn(480, 320);

    // 落地底：出击同一份净化点地面，同样放大 6×
    createPurificationFloorTexture(this, FLOOR_KEY);
    this.add.image(-620, -680, FLOOR_KEY).setOrigin(0, 0).setScale(CARD_SCALE).setDepth(-1);

    this.highlight = this.add.graphics().setDepth(0);

    this.slots = VARIANTS.map((variant, index) => {
      const x = CARD_XS[index % CARD_XS.length]!;
      const y = ROW_YS[Math.floor(index / CARD_XS.length)]!;
      this.add
        .text(x, y - FRAME_H * CARD_SCALE * ORIGIN_Y - 18, LABELS[variant], {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '16px',
          color: '#c8cdd4',
        })
        .setOrigin(0.5, 1)
        .setDepth(2);

      let sprite: Phaser.GameObjects.Sprite | null = null;
      let missingLabel: Phaser.GameObjects.Text | null = null;
      if (this.ensureAnim(variant)) {
        sprite = this.add.sprite(x, y, sheetKey(variant));
        sprite.setOrigin(0.5, ORIGIN_Y);
        sprite.setScale(CARD_SCALE);
        sprite.setDepth(1);
        sprite.play(animKey(variant));
      } else {
        missingLabel = this.add
          .text(x, y, '图未到', {
            fontFamily: '"Courier New", Courier, monospace',
            fontSize: '14px',
            color: '#8a8f96',
          })
          .setOrigin(0.5, 0.5)
          .setDepth(1);
      }
      return { variant, x, y, sprite, missingLabel };
    });

    this.drawHighlight();

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.digitKeys = DIGIT_KEYCODES.map((code) => keyboard.addKey(code, true, false));
    }

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 供奉台抽卡';
    const roster = document.getElementById('gym-roster');
    if (roster) {
      roster.textContent = [
        '身份已锁：一台同时起收容、控制、暴露三种作用的装置。不是架子、不是祭坛。',
        '上排第一轮（都是方块类，区分度低）：A 压钳 夹 / B 笼斗 围 / C 浇墩 浇。',
        '下排第二轮按形体类拆：D 举出 = 宽底 + 长斜臂把残渣举到装置外的空气里。',
        'E 抱箍 = 一根柱贯到顶，中段被比柱宽的抱箍咬住，残渣在箍上那道口里。',
        'F 压槽 = 矮槽坐在地上，偏心厚压板压住大半个槽口，只留一段月牙敞着。',
        '六张都朝外开一面，压力从那儿进来。外观不显槽数；里面那点青绿是活层。',
      ].join('\n');
    }
    const status = document.getElementById('gym-status');
    if (status) {
      status.textContent =
        '打开即播八帧循环、每秒六帧。键 1–6 高亮对应卡（上排 1/2/3，下排 4/5/6）。底是出击同一份净化点混凝土，同样放大 6×。开发课，不是游戏内界面。';
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(): void {
    for (let i = 0; i < this.digitKeys.length; i++) {
      const key = this.digitKeys[i];
      const variant = VARIANTS[i];
      if (!key || !variant || !Phaser.Input.Keyboard.JustDown(key)) continue;
      this.selected = variant;
      this.drawHighlight();
    }
  }

  private ensureAnim(variant: OfferingVariant): boolean {
    const key = sheetKey(variant);
    if (!this.textures.exists(key)) return false;
    const src = this.textures.get(key).getSourceImage() as { width?: number };
    if ((src.width ?? 0) < FRAME_W * FRAMES) return false;
    const anim = animKey(variant);
    if (!this.anims.exists(anim)) {
      this.anims.create({
        key: anim,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: FRAMES - 1 }),
        frameRate: FPS,
        repeat: -1,
      });
    }
    return true;
  }

  private drawHighlight(): void {
    const slot = this.slots.find((s) => s.variant === this.selected);
    if (!this.highlight || !slot) return;
    const padX = 20;
    const padY = 16;
    const boxW = FRAME_W * CARD_SCALE + padX * 2;
    const boxH = FRAME_H * CARD_SCALE + padY * 2;
    const top = slot.y - FRAME_H * CARD_SCALE * ORIGIN_Y - padY;
    this.highlight.clear();
    this.highlight.lineStyle(2, HIGHLIGHT, 0.85);
    this.highlight.strokeRect(slot.x - boxW / 2, top, boxW, boxH);
  }

  private onShutdown(): void {
    for (const k of this.digitKeys) {
      this.input.keyboard?.removeKey(k, true);
    }
    this.digitKeys = [];
    for (const slot of this.slots) {
      slot.sprite?.destroy();
      slot.missingLabel?.destroy();
    }
    this.slots = [];
    this.highlight?.destroy();
    this.highlight = null;
  }
}
