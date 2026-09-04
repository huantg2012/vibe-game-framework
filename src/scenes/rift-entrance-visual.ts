/**
 * 净化点北侧【裂隙入口】的世界内外形。**已是生产默认（DEC-113）。**
 *
 * 身份锁：伤口渗漏，不是门（`docs/design-notes/rift-entrance-identity.md`）。
 * 人 2026-09-04 抽卡定案：入口在**地面上**，画成地面裂缝贴花，不再是呼吸圆点。
 *   · 卡 4 地缝（生产默认）：一道中间粗两边细的裂缝，缝深处一条丝在走
 *   · 卡 5 击裂（留作对照，`?entrance=5`）：由受击点向外辐射，像钢化玻璃
 *
 * 两张都画在**地面平面内**，所以锚点取中心、层压在地板之上玩家之下，玩家能踩过去。
 * 贴图缺失才回落到旧的呼吸圆点。交互（32 像素半径 → 按 E 开出击装配）不因外形改变。
 * 像素生成器：`docs/art/review-2026-08-28/gen/rift_entrance_ground.py`。
 */

import Phaser from 'phaser';

export const ENTRANCE_FRAME_W = 40;
export const ENTRANCE_FRAME_H = 56;
export const ENTRANCE_FRAMES = 8;
export const ENTRANCE_FPS = 6;
/** 地面贴花画在地面平面内，所以锚点取中心，不是脚底。 */
export const ENTRANCE_ORIGIN_Y = 0.5;
/** 层：地板是 0，交互点读数桩是 20，玩家是 30。贴花要能被玩家踩过去。 */
export const ENTRANCE_DEPTH = 1;

export const ENTRANCE_VARIANTS = [4, 5] as const;
export type EntranceVariant = (typeof ENTRANCE_VARIANTS)[number];

/** 生产默认 = 卡 4 地缝（DEC-113）。卡 5 击裂只在 `?entrance=5` 下看。 */
export const ENTRANCE_DEFAULT_VARIANT: EntranceVariant = 4;

export function entranceSheetKey(variant: EntranceVariant): string {
  return `module-rift-e${variant}`;
}

export function entranceSheetUrl(variant: EntranceVariant): string {
  return `assets/sprites/modules/rift-e${variant}-sheet.png?v=ground01`;
}

export function entranceAnimKey(variant: EntranceVariant): string {
  return `module-rift-e${variant}-run`;
}

export function isEntranceSheetKey(key: string): boolean {
  return ENTRANCE_VARIANTS.some((variant) => entranceSheetKey(variant) === key);
}

/** URL `?entrance=4|5` 只用来看对照。无查询 = 生产默认卡 4。 */
export function readEntranceVariantQuery(): EntranceVariant | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('entrance');
  const n = Number(raw);
  if (raw !== null && (ENTRANCE_VARIANTS as readonly number[]).includes(n)) {
    return n as EntranceVariant;
  }
  return null;
}

export function writeEntranceVariantQuery(variant: EntranceVariant): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('entrance', String(variant));
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * 两张都排队。缺文件不得打断启动：Phaser 仍会 complete，场景用 exists 回落。
 */
export function enqueueEntranceSheets(load: Phaser.Loader.LoaderPlugin): void {
  load.on('loaderror', (file: { key?: string }) => {
    const key = file.key ?? '';
    if (isEntranceSheetKey(key)) return;
  });
  for (const variant of ENTRANCE_VARIANTS) {
    load.spritesheet(entranceSheetKey(variant), entranceSheetUrl(variant), {
      frameWidth: ENTRANCE_FRAME_W,
      frameHeight: ENTRANCE_FRAME_H,
    });
  }
}

export function entranceTextureReady(
  scene: Phaser.Scene,
  variant: EntranceVariant,
): boolean {
  const key = entranceSheetKey(variant);
  if (!scene.textures.exists(key)) return false;
  const image = scene.textures.get(key).getSourceImage() as { width?: number; height?: number };
  const width = image.width ?? 0;
  const height = image.height ?? 0;
  return width >= ENTRANCE_FRAME_W * ENTRANCE_FRAMES && height >= ENTRANCE_FRAME_H;
}

export function ensureEntranceAnim(
  scene: Phaser.Scene,
  variant: EntranceVariant,
): boolean {
  if (!entranceTextureReady(scene, variant)) return false;
  const animKey = entranceAnimKey(variant);
  const frameRate = ENTRANCE_FPS;
  if (scene.anims.exists(animKey)) {
    const existing = scene.anims.get(animKey);
    if (existing.frameRate !== frameRate) {
      scene.anims.remove(animKey);
    }
  }
  if (!scene.anims.exists(animKey)) {
    scene.anims.create({
      key: animKey,
      frames: scene.anims.generateFrameNumbers(entranceSheetKey(variant), {
        start: 0,
        end: ENTRANCE_FRAMES - 1,
      }),
      frameRate,
      repeat: -1,
    });
  }
  return true;
}

export class RiftEntranceVisual {
  private sprite: Phaser.GameObjects.Sprite | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
  ) {}

  /** 贴图就绪则挂 8 帧循环；否则拆掉 sprite，调用方回落旧的呼吸圆点。 */
  mount(variant: EntranceVariant): boolean {
    if (!ensureEntranceAnim(this.scene, variant)) {
      this.clear();
      return false;
    }
    const key = entranceSheetKey(variant);
    if (!this.sprite) {
      this.sprite = this.scene.add.sprite(this.x, this.y, key);
    } else {
      this.sprite.setTexture(key);
      this.sprite.setVisible(true);
    }
    this.sprite.setOrigin(0.5, ENTRANCE_ORIGIN_Y);
    this.sprite.setDepth(ENTRANCE_DEPTH);
    this.sprite.play(entranceAnimKey(variant));
    return true;
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
