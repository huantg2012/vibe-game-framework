/**
 * 净化点西侧【培养藏】（spec 名「改造祭坛」）的世界内外形。
 * **生产默认 = 卡 A 立缸（DEC-116）。**
 *
 * 身份锁：一具能装下人体的圆柱培养藏，舱里是冒泡的半透明液体
 * （`docs/design-notes/growth-console-identity.md`）。
 * 立着、45° 等距，锚点脚底、层与读数桩同层（DEC-ARCH-019）。
 * 贴图缺失回落旧的呼吸圆点。交互（32 像素半径 → 按 E 开蜕变面板）不因外形改变。
 * 像素生成器：`docs/art/review-2026-08-28/gen/growth_console_cards.py`。
 */

import Phaser from 'phaser';
import { PURIFICATION_WORKS_COLORS as C } from '@/scenes/purification-renewal-visual';

export const GROWTH_FRAME_W = 40;
export const GROWTH_FRAME_H = 42;
export const GROWTH_FRAMES = 8;
export const GROWTH_FPS = 6;
/** 立着的对象，锚点取脚底。与对照课同一份 40/42。 */
export const GROWTH_ORIGIN_Y = 40 / GROWTH_FRAME_H;
/** 默认层；净化点由地面接触点排序覆盖，对照课保留默认。 */
export const GROWTH_DEPTH = 20;

export const GROWTH_PRODUCTION_VARIANT = 'a' as const;

export const GROWTH_SHEET_KEY = 'module-growth-a';

export function growthConsoleSheetUrl(): string {
  return 'assets/sprites/modules/growth-a-sheet.png?v=growth06';
}

export function growthConsoleAnimKey(): string {
  return `${GROWTH_SHEET_KEY}-run`;
}

export function enqueueGrowthSheet(load: Phaser.Loader.LoaderPlugin): void {
  load.on('loaderror', (file: { key?: string }) => {
    if ((file.key ?? '') === GROWTH_SHEET_KEY) return;
  });
  load.spritesheet(GROWTH_SHEET_KEY, growthConsoleSheetUrl(), {
    frameWidth: GROWTH_FRAME_W,
    frameHeight: GROWTH_FRAME_H,
  });
}

export function growthTextureReady(scene: Phaser.Scene): boolean {
  if (!scene.textures.exists(GROWTH_SHEET_KEY)) return false;
  const image = scene.textures.get(GROWTH_SHEET_KEY).getSourceImage() as {
    width?: number;
    height?: number;
  };
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  return width >= GROWTH_FRAME_W * GROWTH_FRAMES && height >= GROWTH_FRAME_H;
}

export function ensureGrowthAnim(scene: Phaser.Scene): boolean {
  if (!growthTextureReady(scene)) return false;
  const animKey = growthConsoleAnimKey();
  if (scene.anims.exists(animKey)) {
    const existing = scene.anims.get(animKey);
    if (existing.frameRate !== GROWTH_FPS) {
      scene.anims.remove(animKey);
    }
  }
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(GROWTH_SHEET_KEY, {
        start: 0,
        end: GROWTH_FRAMES - 1,
      }),
      frameRate: GROWTH_FPS,
      repeat: -1,
    });
  }
  return true;
}

export class GrowthConsoleVisual {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private fittings: Phaser.GameObjects.Graphics | null = null;
  private investment = 0;
  private fittingsSignature = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
  ) {}

  /** 贴图就绪则挂八帧循环；否则拆掉 sprite，调用方回落呼吸圆点。 */
  mount(): boolean {
    if (!ensureGrowthAnim(this.scene)) {
      this.clear();
      return false;
    }
    if (!this.sprite) {
      this.sprite = this.scene.add.sprite(this.x, this.y, GROWTH_SHEET_KEY);
      this.sprite.setOrigin(0.5, GROWTH_ORIGIN_Y);
      this.sprite.setDepth(GROWTH_DEPTH);
      this.sprite.setRotation(0);
      this.fittings = this.scene.add.graphics({ x: this.x, y: this.y });
      this.fittings.setDepth(GROWTH_DEPTH + .05);
    } else {
      this.sprite.setVisible(true);
    }
    this.sprite.play(growthConsoleAnimKey());
    this.drawFittings();
    return true;
  }

  /** Already committed growth levels. Visual milestones, never a new upgrade. */
  setInvestment(levels: Readonly<Record<string, number>>): void {
    const total = Object.values(levels).reduce((sum, n) => sum + Math.max(0,n), 0);
    const next = total === 0 ? 0 : total < 5 ? 1 : 2;
    if (next === this.investment) return;
    this.investment = next;
    this.drawFittings();
  }

  private drawFittings(): void {
    if (!this.fittings || this.fittingsSignature === this.investment) return;
    this.fittingsSignature = this.investment;
    const g = this.fittings;
    g.clear();
    // A suspended internal support ends inside the liquid; the empty body-sized
    // middle stays liquid, not a painted second person or a transparent doorway.
    g.fillStyle(C.deep).fillRect(-4,-30,2,18).fillRect(5,-28,2,16);
    g.fillStyle(C.medium).fillRect(-3,-29,1,14);
    g.fillStyle(C.concrete).fillRect(-5,-12,13,2);
    g.fillStyle(C.metal).fillRect(4,-13,4,1);
    // Connection at the actual bottom-right casing, aligned to the core light.
    g.fillStyle(C.concrete).fillRect(8,-5,6,4);
    g.fillStyle(C.metal).fillRect(9,-5,5,1);
    if (this.investment === 0) return;
    // First permanent intervention: thicker in-cavity restraints and a socket.
    g.fillStyle(C.concrete).fillRect(-6,-24,3,3).fillRect(4,-23,4,3);
    g.fillStyle(C.metal).fillRect(4,-23,3,1);
    g.fillStyle(C.repair).fillRect(10,-9,4,6);
    g.fillStyle(C.edge).fillRect(11,-9,3,1);
    g.fillStyle(C.shadow).fillRect(11,-6,2,2);
    if (this.investment < 2) return;
    // Second intervention: paired lower contact; broad plate, not a level lamp.
    g.fillStyle(C.repair).fillRect(-7,-18,4,3).fillRect(4,-17,5,3);
    g.fillStyle(C.metal).fillRect(5,-17,3,1);
    g.fillStyle(C.concrete).fillRect(-8,-7,5,5);
    g.fillStyle(C.metal).fillRect(-8,-7,4,1);
  }

  setDepth(depth: number): void {
    this.sprite?.setDepth(depth);
    this.fittings?.setDepth(depth + .05);
  }

  isShowing(): boolean {
    return this.sprite !== null && this.sprite.visible;
  }

  clear(): void {
    this.sprite?.destroy();
    this.sprite = null;
    this.fittings?.destroy();
    this.fittings = null;
    this.fittingsSignature = -1;
  }

  destroy(): void {
    this.clear();
  }
}
