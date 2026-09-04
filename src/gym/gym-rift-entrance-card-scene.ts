/**
 * 裂隙入口外形对照课。两卡并排，打开即播，放大 4×。
 * 抽卡已结案（DEC-113）：卡 4 地缝 = 生产默认，卡 5 击裂 = 留作对照。
 * 落选的墙上三张与卡 6 囚笼已整支删除。
 * 底是与出击同一份净化点混凝土（`createPurificationFloorTexture`），不是纯黑——
 * 纯黑会把任何不透明外沿看成描边（`.cursor/skills/pixel-models/SKILL.md` 第 9 条）。
 * 不刷玩家、不走出击、不进主菜单。这里换卡不改生产默认。
 */

import Phaser from 'phaser';
import { createPurificationFloorTexture } from '@/scenes/purification-scene';
import {
  ENTRANCE_FRAME_H,
  ENTRANCE_FRAME_W,
  ENTRANCE_ORIGIN_Y,
  ENTRANCE_VARIANTS,
  entranceAnimKey,
  entranceSheetKey,
  enqueueEntranceSheets,
  ensureEntranceAnim,
  type EntranceVariant,
} from '@/scenes/rift-entrance-visual';

const CARD_SCALE = 4;
const CARD_XS = [320, 640] as const;
const CARD_Y = 380;
const FLOOR_KEY = 'gym-entrance-floor';
const HIGHLIGHT = 0x2ae6c8;

const DIGIT_KEYCODES = [
  Phaser.Input.Keyboard.KeyCodes.FOUR,
  Phaser.Input.Keyboard.KeyCodes.FIVE,
] as const;

interface CardSlot {
  readonly variant: EntranceVariant;
  readonly x: number;
  readonly y: number;
  sprite: Phaser.GameObjects.Sprite | null;
  missingLabel: Phaser.GameObjects.Text | null;
}

export class GymRiftEntranceCardScene extends Phaser.Scene {
  private slots: CardSlot[] = [];
  private highlight: Phaser.GameObjects.Graphics | null = null;
  private selected: EntranceVariant = 4;
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super({ key: 'GymRiftEntranceCardScene' });
  }

  preload(): void {
    enqueueEntranceSheets(this.load);
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, 960, 640);
    camera.setZoom(1);
    camera.centerOn(480, 320);

    // 落地底：出击同一份净化点地面，同样放大 4×，让「外沿是不是溶进混凝土」判得准
    createPurificationFloorTexture(this, FLOOR_KEY);
    this.add
      .image(-416, -448, FLOOR_KEY)
      .setOrigin(0, 0)
      .setScale(CARD_SCALE)
      .setDepth(-1);

    this.highlight = this.add.graphics().setDepth(0);

    this.slots = ENTRANCE_VARIANTS.map((variant, index) => {
      const x = CARD_XS[index]!;
      const y = CARD_Y;
      this.add
        .text(x, y - ENTRANCE_FRAME_H * CARD_SCALE * ENTRANCE_ORIGIN_Y - 16, `卡 ${variant}`, {
          fontFamily: '"Courier New", Courier, monospace',
          fontSize: '16px',
          color: '#c8cdd4',
        })
        .setOrigin(0.5, 1)
        .setDepth(2);

      let sprite: Phaser.GameObjects.Sprite | null = null;
      let missingLabel: Phaser.GameObjects.Text | null = null;
      if (ensureEntranceAnim(this, variant)) {
        sprite = this.add.sprite(x, y, entranceSheetKey(variant));
        sprite.setOrigin(0.5, ENTRANCE_ORIGIN_Y);
        sprite.setScale(CARD_SCALE);
        sprite.setDepth(1);
        sprite.play(entranceAnimKey(variant));
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
    if (title) title.textContent = '练习场 · 裂隙入口抽卡';
    const roster = document.getElementById('gym-roster');
    if (roster) {
      roster.textContent = [
        '身份已锁：伤口渗漏，不是门。入口在地面上，不显式呈现那边是什么。',
        '卡 4 地缝 = 地面上一道中间粗两边细的裂缝，缝深处一条丝在走。生产默认（DEC-113）。',
        '卡 5 击裂 = 由受击点向外辐射的裂缝，像钢化玻璃；青绿从中心往外淡出。留作对照。',
        '两张都画在地面平面内，是贴花，玩家能踩过去。',
      ].join('\n');
    }
    const status = document.getElementById('gym-status');
    if (status) {
      status.textContent =
        '打开即播八帧循环、每秒六帧。键 4 / 5 高亮对应卡。底是出击同一份净化点混凝土，同样放大 4×。开发课，不是游戏内界面。';
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.onShutdown, this);
  }

  update(): void {
    for (let i = 0; i < this.digitKeys.length; i++) {
      const key = this.digitKeys[i];
      const variant = ENTRANCE_VARIANTS[i];
      if (!key || !variant || !Phaser.Input.Keyboard.JustDown(key)) continue;
      this.selected = variant;
      this.drawHighlight();
    }
  }

  private drawHighlight(): void {
    const slot = this.slots.find((s) => s.variant === this.selected);
    if (!this.highlight || !slot) return;
    const padX = 18;
    const padY = 14;
    const boxW = ENTRANCE_FRAME_W * CARD_SCALE + padX * 2;
    const boxH = ENTRANCE_FRAME_H * CARD_SCALE + padY * 2;
    const top = slot.y - ENTRANCE_FRAME_H * CARD_SCALE * ENTRANCE_ORIGIN_Y - padY;
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
