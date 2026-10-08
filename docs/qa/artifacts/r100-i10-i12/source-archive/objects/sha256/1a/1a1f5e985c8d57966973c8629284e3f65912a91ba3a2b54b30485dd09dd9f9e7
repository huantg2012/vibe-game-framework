/**
 * 供奉台外形抽卡对比课。九卡三行三列，打开即播，放大 5×。
 *
 * 第一轮 A/B/C 是同一句形体——实心方块 + 前左面开洞（人 2026-09-04：
 * 「本质上是同一个方向只是调整了大小，区分度非常低」）。
 * 第二轮按体积分布拆：D 横伸 / E 竖高 / F 贴地。
 * 第三轮按开口怎么占空间拆：G 拱 / H 钳 / I 环。生产默认 = 卡 I 环（DEC-115）。
 *
 * 身份已锁（`docs/design-notes/offering-stand-identity.md`）：**一台同时起收容、
 * 控制、暴露三种作用的装置。** 不是架子、不是祭坛。相机 = 45° 等距，与已锁三台同一套。
 * 外观不显槽数——不画可数槽位。H / I 的青绿是装填光点：空档不亮，
 * 一 / 二 / 三档随装填 1 / 2 / 3+ 变大变亮；第 4 槽不另开一档。
 * 键 [ ] 切装填档。对照课不改生产默认。
 *
 * 底是与出击同一份净化点混凝土（`createPurificationFloorTexture`），不是纯黑——
 * 纯黑会把任何不透明外沿看成描边（`.cursor/skills/pixel-models/SKILL.md` 画法定律第 10 条）。
 * 不刷玩家、不走出击、不进主菜单。
 */

import Phaser from 'phaser';
import { createPurificationFloorTexture } from '@/scenes/purification-scene';
import {
  OFFERING_CHARGE_TIER_COUNT,
  OFFERING_CHARGE_VARIANTS,
  offeringChargeAnimKey,
  type OfferingChargeTier,
} from '@/scenes/offering-charge';

const FRAME_W = 32;
const FRAME_H = 32;
const FRAMES = 8;
const FPS = 6;
/** footprint 中心在 23/32；前角还会往下探，接地斑落在 29/30。 */
const ORIGIN_Y = 26 / FRAME_H;
const CARD_SCALE = 5;
const CARD_XS = [200, 480, 760] as const;
/** 上排第一轮方块；中排第二轮体积分布；下排第三轮开口占空间。 */
const ROW_YS = [155, 355, 555] as const;
const FLOOR_KEY = 'gym-offering-floor';
const HIGHLIGHT = 0x2ae6c8;

const VARIANTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;
type OfferingVariant = (typeof VARIANTS)[number];

const LABELS: Record<OfferingVariant, string> = {
  a: '卡 A 压钳 · 方块',
  b: '卡 B 笼斗 · 方块',
  c: '卡 C 浇墩 · 方块',
  d: '卡 D 举出 · 横伸',
  e: '卡 E 抱箍 · 竖高',
  f: '卡 F 压槽 · 贴地',
  g: '卡 G 拱 · 从当中看过去',
  h: '卡 H 钳 · 顶上两座峰',
  i: '卡 I 环 · 生产',
};

const CHARGE_LABELS: Record<OfferingChargeTier, string> = {
  0: '空',
  1: '一档',
  2: '二档',
  3: '三档',
};

function isChargeVariant(variant: OfferingVariant): boolean {
  return (OFFERING_CHARGE_VARIANTS as readonly string[]).includes(variant);
}

const DIGIT_KEYCODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
  Phaser.Input.Keyboard.KeyCodes.FOUR,
  Phaser.Input.Keyboard.KeyCodes.FIVE,
  Phaser.Input.Keyboard.KeyCodes.SIX,
  Phaser.Input.Keyboard.KeyCodes.SEVEN,
  Phaser.Input.Keyboard.KeyCodes.EIGHT,
  Phaser.Input.Keyboard.KeyCodes.NINE,
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
  private selected: OfferingVariant = 'i';
  private chargeTier: OfferingChargeTier = 2;
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];
  private chargeDown: Phaser.Input.Keyboard.Key | null = null;
  private chargeUp: Phaser.Input.Keyboard.Key | null = null;

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
          `assets/sprites/modules/offering-${variant}-sheet.png?v=offering04`,
        { frameWidth: FRAME_W, frameHeight: FRAME_H },
      );
    }
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, 960, 640);
    camera.setZoom(1);
    camera.centerOn(480, 320);

    createPurificationFloorTexture(this, FLOOR_KEY);
    this.add.image(-620, -680, FLOOR_KEY).setOrigin(0, 0).setScale(CARD_SCALE).setDepth(-1);

    this.highlight = this.add.graphics().setDepth(0);

    this.slots = VARIANTS.map((variant, index) => {
      const x = CARD_XS[index % CARD_XS.length]!;
      const y = ROW_YS[Math.floor(index / CARD_XS.length)]!;
      this.add
        .text(x, y - FRAME_H * CARD_SCALE * ORIGIN_Y - 14, LABELS[variant], {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '13px',
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
        sprite.play(
          isChargeVariant(variant)
            ? offeringChargeAnimKey(variant, this.chargeTier)
            : animKey(variant),
        );
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
      this.chargeDown = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.OPEN_BRACKET, true, false);
      this.chargeUp = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CLOSED_BRACKET, true, false);
    }

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 供奉台抽卡';
    const roster = document.getElementById('gym-roster');
    if (roster) {
      roster.textContent = [
        '身份已锁：一台同时起收容、控制、暴露三种作用的装置。不是架子、不是祭坛。',
        '上排第一轮（都是方块类）：A 压钳 / B 笼斗 / C 浇墩。',
        '中排第二轮按体积分布：D 举出 = 横伸 / E 抱箍 = 竖高 / F 压槽 = 贴地。',
        '下排第三轮按开口占空间：G 拱 / H 钳 / I 环（生产默认，DEC-115）。H 与 I 的丫口 / 圈心在空档不亮；装填后一团光点贴在夹持面上浮动。',
        '键 [ ] 切 H/I 装填档：空 / 一档 / 二档 / 三档 = 0 / 1 / 2 / 3+ 个残渣。不显第四槽。这里换卡不改生产默认。',
      ].join('\n');
    }
    this.writeStatus();

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
    if (this.chargeDown && Phaser.Input.Keyboard.JustDown(this.chargeDown)) {
      this.setChargeTier((this.chargeTier + OFFERING_CHARGE_TIER_COUNT - 1) % OFFERING_CHARGE_TIER_COUNT as OfferingChargeTier);
    }
    if (this.chargeUp && Phaser.Input.Keyboard.JustDown(this.chargeUp)) {
      this.setChargeTier((this.chargeTier + 1) % OFFERING_CHARGE_TIER_COUNT as OfferingChargeTier);
    }
  }

  private ensureAnim(variant: OfferingVariant): boolean {
    const key = sheetKey(variant);
    if (!this.textures.exists(key)) return false;
    const src = this.textures.get(key).getSourceImage() as { width?: number };
    const need = isChargeVariant(variant)
      ? FRAME_W * FRAMES * OFFERING_CHARGE_TIER_COUNT
      : FRAME_W * FRAMES;
    if ((src.width ?? 0) < need) return false;
    if (isChargeVariant(variant)) {
      for (let tier = 0; tier < OFFERING_CHARGE_TIER_COUNT; tier++) {
        const anim = offeringChargeAnimKey(variant, tier as OfferingChargeTier);
        if (!this.anims.exists(anim)) {
          const start = tier * FRAMES;
          this.anims.create({
            key: anim,
            frames: this.anims.generateFrameNumbers(key, { start, end: start + FRAMES - 1 }),
            frameRate: FPS,
            repeat: -1,
          });
        }
      }
      return true;
    }
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

  private setChargeTier(tier: OfferingChargeTier): void {
    this.chargeTier = tier;
    for (const slot of this.slots) {
      if (!slot.sprite || !isChargeVariant(slot.variant)) continue;
      slot.sprite.play(offeringChargeAnimKey(slot.variant, this.chargeTier));
    }
    this.writeStatus();
  }

  private writeStatus(): void {
    const status = document.getElementById('gym-status');
    if (!status) return;
    status.textContent =
      `打开即播八帧循环、每秒六帧。键 1–9 高亮。H/I 装填 ${CHARGE_LABELS[this.chargeTier]}（键 [ ]）。` +
      '底是出击同一份净化点混凝土，放大 5×。开发课，不是游戏内界面。';
  }

  private drawHighlight(): void {
    const slot = this.slots.find((s) => s.variant === this.selected);
    if (!this.highlight || !slot) return;
    const padX = 16;
    const padY = 12;
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
    if (this.chargeDown) this.input.keyboard?.removeKey(this.chargeDown, true);
    if (this.chargeUp) this.input.keyboard?.removeKey(this.chargeUp, true);
    this.chargeDown = null;
    this.chargeUp = null;
    for (const slot of this.slots) {
      slot.sprite?.destroy();
      slot.missingLabel?.destroy();
    }
    this.slots = [];
    this.highlight?.destroy();
    this.highlight = null;
  }
}
