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
import { PURIFICATION_WORKS_COLORS as C } from '@/scenes/purification-renewal-visual';
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
/** 默认层；净化点由地面接触点排序覆盖，对照课保留默认。 */
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
  private cradle: Phaser.GameObjects.Graphics | null = null;
  private tier: OfferingChargeTier = 0;
  private pressure = 0;
  private cradleSignature = '';

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
      this.cradle = this.scene.add.graphics({ x: this.x, y: this.y });
      this.cradle.setDepth(OFFERING_DEPTH + .05);
    } else {
      this.sprite.setVisible(true);
    }
    this.setCharge(tier);
    this.drawCradle();
    return true;
  }

  setCharge(tier: OfferingChargeTier): void {
    if (!this.sprite) return;
    if (this.tier === tier && this.sprite.anims.isPlaying) return;
    this.tier = tier;
    this.sprite.play(offeringStandAnimKey(tier));
    this.drawCradle();
  }

  /** Only public tide pressure is accepted, never item identity or maturity. */
  setPressure(pressure: number): void {
    const next = pressure >= .75 ? 2 : pressure >= .35 ? 1 : 0;
    if (this.pressure === next) return;
    this.pressure = next;
    this.drawCradle();
  }

  private drawCradle(): void {
    if (!this.cradle) return;
    const signature = `${this.tier}:${this.pressure}`;
    if (signature === this.cradleSignature) return;
    this.cradleSignature = signature;
    const g = this.cradle;
    g.clear();
    // The ring's lower inner lip is a bearing surface. Asymmetric jaws meet
    // that material, preserving the upper hole and the locked ring silhouette.
    g.fillStyle(C.metal).fillRect(-5,-12,3,2).fillRect(4,-11,3,2);
    g.fillStyle(C.edge).fillRect(-5,-12,3,1).fillRect(4,-11,2,1);
    g.fillStyle(C.repair).fillRect(-4,-9,9,2);
    if (this.tier === 0) return;
    // A shrouded unknown mass, never the identifiable icon of a hidden item.
    const width = this.tier === 1 ? 4 : this.tier === 2 ? 6 : 7;
    const left = 1-Math.ceil(width/2);
    const compressed = this.pressure === 2;
    const top = compressed ? -14 : -16;
    g.fillStyle(C.concrete).fillRect(left,top,width,-9-top);
    g.fillStyle(C.repair).fillRect(left,top,width-1,2).fillRect(left+1,top-1,width-3,1);
    g.fillStyle(C.metal).fillRect(left,top+1,2,2);
    g.fillStyle(C.shadow).fillRect(left+width-2,top+2,2,-11-top);
    g.fillStyle(C.metal).fillRect(-4,-11,3,2).fillRect(3,-10,3,2);
    // Pressure is held inside the clamp; no ring illumination or extra lights.
    if (this.pressure > 0) {
      g.fillStyle(C.deep).fillRect(left+2,-13,Math.max(1,width-3),2);
      if (this.pressure === 2) g.fillStyle(C.medium).fillRect(1,-12,2,1);
    }
  }

  setDepth(depth: number): void {
    this.sprite?.setDepth(depth);
    this.cradle?.setDepth(depth + .05);
  }

  isShowing(): boolean {
    return this.sprite !== null && this.sprite.visible;
  }

  clear(): void {
    this.sprite?.destroy();
    this.sprite = null;
    this.cradle?.destroy();
    this.cradle = null;
    this.cradleSignature = '';
  }

  destroy(): void {
    this.clear();
  }
}
