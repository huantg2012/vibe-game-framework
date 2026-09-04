/**
 * 净化点西南【供奉台】的世界内外形。**生产默认 = 卡 I 环（DEC-115）。**
 *
 * 身份锁：一台同时起收容、控制、暴露三种作用的装置
 * （`docs/design-notes/offering-stand-identity.md`）。
 * 立着、45° 等距，锚点脚底、层与读数桩同层（DEC-ARCH-019）。
 * 装填光点三档 = 槽里 1 / 2 / 3+ 个残渣；空档不亮；第 4 槽不另开一档。
 * 贴图缺失回落旧的呼吸圆点。交互（32 像素半径 → 按 E 开防御槽）不因外形改变。
 * 像素生成器：`docs/art/review-2026-08-28/gen/offering_stand_cards.py`。
 */

import Phaser from 'phaser';
import {
  OFFERING_CHARGE_TIER_COUNT,
  offeringChargeTier,
  type OfferingChargeTier,
} from '@/scenes/offering-charge';

export const OFFERING_FRAME_W = 32;
export const OFFERING_FRAME_H = 32;
export const OFFERING_FRAMES = 8;
export const OFFERING_FPS = 6;
/** 立着的对象，锚点取脚底。与对照课同一份 26/32。 */
export const OFFERING_ORIGIN_Y = 26 / OFFERING_FRAME_H;
/** 层与读数桩同层（地板 0 / 读数桩 20 / 玩家 30）。 */
export const OFFERING_DEPTH = 20;

export const OFFERING_PRODUCTION_VARIANT = 'i' as const;

export const OFFERING_SHEET_KEY = 'module-offering-i';

export function offeringStandSheetUrl(): string {
  return 'assets/sprites/modules/offering-i-sheet.png?v=offering04';
}

export function offeringStandAnimKey(tier: OfferingChargeTier): string {
  return `${OFFERING_SHEET_KEY}-c${tier}`;
}

export function offeringStandSlottedCount(
  slotted: readonly (unknown | null)[],
): number {
  return slotted.filter(Boolean).length;
}

export function offeringStandChargeFromSlots(
  slotted: readonly (unknown | null)[],
): OfferingChargeTier {
  return offeringChargeTier(offeringStandSlottedCount(slotted));
}

export function enqueueOfferingSheet(load: Phaser.Loader.LoaderPlugin): void {
  load.on('loaderror', (file: { key?: string }) => {
    if ((file.key ?? '') === OFFERING_SHEET_KEY) return;
  });
  load.spritesheet(OFFERING_SHEET_KEY, offeringStandSheetUrl(), {
    frameWidth: OFFERING_FRAME_W,
    frameHeight: OFFERING_FRAME_H,
  });
}

export function offeringTextureReady(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(OFFERING_SHEET_KEY)) return false;
  const image = scene.textures.get(OFFERING_SHEET_KEY).getSourceImage() as {
    width?: number;
    height?: number;
  };
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  return (
    width >= OFFERING_FRAME_W * OFFERING_FRAMES * OFFERING_CHARGE_TIER_COUNT
    && height >= OFFERING_FRAME_H
  );
}

export function ensureOfferingAnims(scene: Phaser.Scene): boolean {
  if (!offeringTextureReady(scene)) return false;
  for (let tier = 0; tier < OFFERING_CHARGE_TIER_COUNT; tier++) {
    const animKey = offeringStandAnimKey(tier as OfferingChargeTier);
    if (scene.anims.exists(animKey)) {
      const existing = scene.anims.get(animKey);
      if (existing.frameRate !== OFFERING_FPS) {
        scene.anims.remove(animKey);
      }
    }
    if (!scene.anims.exists(animKey)) {
      const start = tier * OFFERING_FRAMES;
      scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers(OFFERING_SHEET_KEY, {
          start,
          end: start + OFFERING_FRAMES - 1,
        }),
        frameRate: OFFERING_FPS,
        repeat: -1,
      });
    }
  }
  return true;
}

export class OfferingStandVisual {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private tier: OfferingChargeTier = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
  ) {}

  /** 贴图就绪则挂对应装填档的 8 帧循环；否则拆掉 sprite，调用方回落呼吸圆点。 */
  mount(tier: OfferingChargeTier = 0): boolean {
    if (!ensureOfferingAnims(this.scene)) {
      this.clear();
      return false;
    }
    if (!this.sprite) {
      this.sprite = this.scene.add.sprite(this.x, this.y, OFFERING_SHEET_KEY);
      this.sprite.setOrigin(0.5, OFFERING_ORIGIN_Y);
      this.sprite.setDepth(OFFERING_DEPTH);
      this.sprite.setRotation(0);
    } else {
      this.sprite.setVisible(true);
    }
    this.setCharge(tier);
    return true;
  }

  setCharge(tier: OfferingChargeTier): void {
    if (!this.sprite) return;
    if (this.tier === tier && this.sprite.anims.isPlaying) return;
    this.tier = tier;
    this.sprite.play(offeringStandAnimKey(tier));
  }

  isShowing(): boolean {
    return this.sprite !== null && this.sprite.visible;
  }

  clear(): void {
    this.sprite?.destroy();
    this.sprite = null;
  }

  destroy(): void {
    this.clear();
  }
}
