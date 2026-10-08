/**
 * 培养藏外形抽卡对比课。三卡一行，打开即播。
 *
 * 人已取卡 A 立缸翻进净化点（DEC-116）。A = 40×42（加粗、压矮）；B / C 仍 32×36。
 *
 * 身份已锁（`docs/design-notes/growth-console-identity.md`）：**一具能装下人体的
 * 圆柱培养藏。舱里是冒泡的半透明液体。** 主光源 = 核心（东侧）。
 * 相机 = 45° 等距。生产默认 = 卡 A。这里换卡不改生产默认。
 *
 * 底是与出击同一份净化点混凝土（`createPurificationFloorTexture`），不是纯黑。
 * 不刷玩家、不走出击、不进主菜单。
 */

import Phaser from 'phaser';
import { createPurificationFloorTexture } from '@/scenes/purification-scene';

const FRAMES = 8;
const FPS = 6;
const FLOOR_KEY = 'gym-growth-floor';
const HIGHLIGHT = 0x2ae6c8;
const CARD_XS = [200, 480, 760] as const;
const ROW_Y = 340;

const VARIANTS = ['a', 'b', 'c'] as const;
type GrowthVariant = (typeof VARIANTS)[number];

interface CardSpec {
  readonly w: number;
  readonly h: number;
  readonly originY: number;
  readonly scale: number;
}

const SPECS: Record<GrowthVariant, CardSpec> = {
  a: { w: 40, h: 42, originY: 40 / 42, scale: 4 },
  b: { w: 32, h: 36, originY: 30 / 36, scale: 5 },
  c: { w: 32, h: 36, originY: 30 / 36, scale: 5 },
};

const LABELS: Record<GrowthVariant, string> = {
  a: '卡 A 立缸 · 立缸 40×42',
  b: '卡 B 横棺 · 横卧',
  c: '卡 C 沉井 · 沉井',
};

const DIGIT_KEYCODES = [
  Phaser.Input.Keyboard.KeyCodes.ONE,
  Phaser.Input.Keyboard.KeyCodes.TWO,
  Phaser.Input.Keyboard.KeyCodes.THREE,
] as const;

function sheetKey(variant: GrowthVariant): string {
  return `growth-${variant}`;
}

function animKey(variant: GrowthVariant): string {
  return `growth-${variant}-run`;
}

interface CardSlot {
  readonly variant: GrowthVariant;
  readonly spec: CardSpec;
  readonly x: number;
  readonly y: number;
  sprite: Phaser.GameObjects.Sprite | null;
  missingLabel: Phaser.GameObjects.Text | null;
}

export class GymGrowthCardScene extends Phaser.Scene {
  private slots: CardSlot[] = [];
  private highlight: Phaser.GameObjects.Graphics | null = null;
  private selected: GrowthVariant = 'a';
  private digitKeys: Phaser.Input.Keyboard.Key[] = [];

  constructor() {
    super({ key: 'GymGrowthCardScene' });
  }

  preload(): void {
    this.load.on('loaderror', () => {
      /* 贴图缺失不得打断启动 */
    });
    for (const variant of VARIANTS) {
      const spec = SPECS[variant];
      this.load.spritesheet(
        sheetKey(variant),
        `assets/sprites/modules/growth-${variant}-sheet.png?v=growth06`,
        { frameWidth: spec.w, frameHeight: spec.h },
      );
    }
  }

  create(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, 960, 640);
    camera.setZoom(1);
    camera.centerOn(480, 320);

    createPurificationFloorTexture(this, FLOOR_KEY);
    this.add.image(-620, -680, FLOOR_KEY).setOrigin(0, 0).setScale(5).setDepth(-1);

    this.highlight = this.add.graphics().setDepth(0);

    this.slots = VARIANTS.map((variant, index) => {
      const spec = SPECS[variant];
      const x = CARD_XS[index]!;
      const y = ROW_Y;
      this.add
        .text(x, y - spec.h * spec.scale * spec.originY - 14, LABELS[variant], {
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
        sprite.setOrigin(0.5, spec.originY);
        sprite.setScale(spec.scale);
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
      return { variant, spec, x, y, sprite, missingLabel };
    });

    this.drawHighlight();

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.digitKeys = DIGIT_KEYCODES.map((code) => keyboard.addKey(code, true, false));
    }

    const title = document.getElementById('gym-title');
    if (title) title.textContent = '练习场 · 培养藏抽卡';
    const roster = document.getElementById('gym-roster');
    if (roster) {
      roster.textContent = [
        '人取卡 A 立缸已翻进净化点（DEC-116）。画布 40×42。加粗、压矮。中段舱液约全高 70%。紧贴地面。',
        '主光源 = 核心（东侧，右亮左暗，影子往西）。玩家灯是走近时的暖补光。',
        'B / C 仍对照。这里换卡不改生产默认。',
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
  }

  private ensureAnim(variant: GrowthVariant): boolean {
    const spec = SPECS[variant];
    const key = sheetKey(variant);
    if (!this.textures.exists(key)) return false;
    const src = this.textures.get(key).getSourceImage() as { width?: number };
    if ((src.width ?? 0) < spec.w * FRAMES) return false;
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

  private writeStatus(): void {
    const status = document.getElementById('gym-status');
    if (!status) return;
    status.textContent =
      '打开即播八帧、每秒六帧。键 1–3。A 放大 4×（40×42），B/C 放大 5×。底是出击同一份净化点混凝土。开发课，不是游戏内界面。';
  }

  private drawHighlight(): void {
    const slot = this.slots.find((s) => s.variant === this.selected);
    if (!this.highlight || !slot) return;
    const { spec } = slot;
    const padX = 16;
    const padY = 12;
    const boxW = spec.w * spec.scale + padX * 2;
    const boxH = spec.h * spec.scale + padY * 2;
    const top = slot.y - spec.h * spec.scale * spec.originY - padY;
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
