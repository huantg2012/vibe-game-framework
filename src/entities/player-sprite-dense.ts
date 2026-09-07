/**
 * Dense industrial 32×32 player pixels (DEC-068: wired to sortie Player).
 * Warm-grey body + visor slit + pack + lamp housing. No teal, no paired eyes, no outline.
 */

import Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';
import type { MotionGait } from '@/entities/actor-motion';

const FACINGS: Facing4[] = ['down', 'up', 'left', 'right'];
const CANVAS = 32;

type Rgba = readonly [number, number, number, number];

const SHADE: Rgba = [0x1c, 0x18, 0x14, 255];
const DARK: Rgba = [0x34, 0x2c, 0x26, 255];
const MID: Rgba = [0x44, 0x3a, 0x32, 255];
const METAL: Rgba = [0x52, 0x46, 0x3c, 255];
const HI: Rgba = [0x62, 0x54, 0x46, 255];
const VISOR: Rgba = [0x0d, 0x11, 0x14, 255];
const WARM: Rgba = [0x8a, 0x5c, 0x2a, 255];
const GLOW: Rgba = [0xc4, 0x87, 0x3a, 255];
const HOT: Rgba = [0xe0, 0xa8, 0x48, 255];

interface Deform {
  readonly dx: number;
  readonly bodyDy: number;
  readonly headDy: number;
  readonly lampDx: number;
  readonly lampDy: number;
  readonly leftFootDy: number;
  readonly rightFootDy: number;
  readonly coatDx: number;
  readonly packDy: number;
  readonly lampHot: boolean;
}

const ZERO: Deform = {
  dx: 0,
  bodyDy: 0,
  headDy: 0,
  lampDx: 0,
  lampDy: 0,
  leftFootDy: 0,
  rightFootDy: 0,
  coatDx: 0,
  packDy: 0,
  lampHot: false,
};

function idleDeform(frame: number): Deform {
  if (frame === 1) {
    return { ...ZERO, bodyDy: -1, headDy: -1, lampDy: -1, packDy: -1, lampHot: true };
  }
  if (frame === 3) {
    return { ...ZERO, bodyDy: 1, headDy: 1, leftFootDy: 1, rightFootDy: 1 };
  }
  return ZERO;
}

function walkDeform(facing: Facing4, frame: number): Deform {
  const lean = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  if (frame === 0) {
    return { ...ZERO, dx: lean, leftFootDy: -2, coatDx: -1, lampDx: -1 };
  }
  if (frame === 1) {
    return {
      ...ZERO,
      dx: lean,
      bodyDy: -1,
      headDy: -1,
      leftFootDy: -1,
      rightFootDy: -1,
      lampDy: -2,
      packDy: -1,
      lampHot: true,
    };
  }
  if (frame === 2) {
    return { ...ZERO, dx: lean, rightFootDy: -2, coatDx: 1, lampDx: 1 };
  }
  return {
    ...ZERO,
    dx: lean,
    bodyDy: 1,
    headDy: 1,
    leftFootDy: 1,
    rightFootDy: 1,
    lampDy: 2,
    packDy: 1,
  };
}

export const DENSE_PLAYER_IDLE_TEXTURE: Record<Facing4, readonly string[]> = {
  down: ['player-dense-down', 'player-dense-down-idle-1', 'player-dense-down-idle-2', 'player-dense-down-idle-3'],
  up: ['player-dense-up', 'player-dense-up-idle-1', 'player-dense-up-idle-2', 'player-dense-up-idle-3'],
  left: ['player-dense-left', 'player-dense-left-idle-1', 'player-dense-left-idle-2', 'player-dense-left-idle-3'],
  right: ['player-dense-right', 'player-dense-right-idle-1', 'player-dense-right-idle-2', 'player-dense-right-idle-3'],
};

export const DENSE_PLAYER_WALK_TEXTURE: Record<Facing4, readonly string[]> = {
  down: ['player-dense-down-walk-0', 'player-dense-down-walk-1', 'player-dense-down-walk-2', 'player-dense-down-walk-3'],
  up: ['player-dense-up-walk-0', 'player-dense-up-walk-1', 'player-dense-up-walk-2', 'player-dense-up-walk-3'],
  left: ['player-dense-left-walk-0', 'player-dense-left-walk-1', 'player-dense-left-walk-2', 'player-dense-left-walk-3'],
  right: ['player-dense-right-walk-0', 'player-dense-right-walk-1', 'player-dense-right-walk-2', 'player-dense-right-walk-3'],
};

export function densePlayerMotionTexture(facing: Facing4, gait: MotionGait, frame: number): string {
  const table = gait === 'walk' ? DENSE_PLAYER_WALK_TEXTURE : DENSE_PLAYER_IDLE_TEXTURE;
  return table[facing][frame] ?? table[facing][0]!;
}

/** Neutral soles end at texture y=26; keep this contact fixed during gait. */
export const DENSE_PLAYER_GROUND_OFFSET_Y = 10;

/** Lamp housing centre relative to the 32×32 origin, for lamp-dust sync. */
export const DENSE_PLAYER_LAMP_LOCAL: Record<Facing4, { x: number; y: number }> = {
  down: { x: 10, y: -4 },
  up: { x: -8, y: -3 },
  left: { x: -8, y: -4 },
  right: { x: 8, y: -4 },
};

function px(data: Uint8ClampedArray, x: number, y: number, c: Rgba): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= CANVAS || iy >= CANVAS) return;
  const i = (iy * CANVAS + ix) * 4;
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = c[3];
}

function span(data: Uint8ClampedArray, x: number, y: number, w: number, c: Rgba): void {
  for (let i = 0; i < w; i++) px(data, x + i, y, c);
}

function rect(data: Uint8ClampedArray, x: number, y: number, w: number, h: number, c: Rgba): void {
  for (let j = 0; j < h; j++) span(data, x, y + j, w, c);
}

function paintLamp(data: Uint8ClampedArray, x: number, y: number, hot: boolean, dir: 1 | -1 = 1): void {
  const x0 = dir === 1 ? x : x - 3;
  rect(data, x0, y, 4, 3, METAL);
  px(data, x0 + (dir === 1 ? 3 : 0), y, SHADE);
  px(data, x0 + 1, y + 1, GLOW);
  px(data, x0 + 2, y + 1, hot ? HOT : GLOW);
  px(data, x0 + 1, y + 2, WARM);
  px(data, x0 + 2, y + 2, WARM);
}

function paintDown(data: Uint8ClampedArray, d: Deform): void {
  const dx = d.dx;
  const hy = d.headDy;
  const by = d.bodyDy;
  const cx = d.coatDx;
  const pk = d.packDy;
  const lx = d.lampDx;
  const ly = d.lampDy;

  span(data, 14 + dx, 4 + hy, 4, METAL);
  span(data, 13 + dx, 5 + hy, 6, METAL);
  span(data, 12 + dx, 6 + hy, 8, METAL);
  px(data, 15 + dx, 6 + hy, HI);
  px(data, 16 + dx, 6 + hy, HI);
  span(data, 12 + dx, 7 + hy, 8, METAL);
  px(data, 12 + dx, 8 + hy, METAL);
  span(data, 13 + dx, 8 + hy, 6, VISOR);
  px(data, 19 + dx, 8 + hy, METAL);
  span(data, 12 + dx, 9 + hy, 8, METAL);
  span(data, 13 + dx, 10 + hy, 6, DARK);
  px(data, 14 + dx, 10 + hy, METAL);

  rect(data, 8 + dx, 12 + by + pk, 2, 6, METAL);
  rect(data, 22 + dx, 12 + by + pk, 2, 5, METAL);
  px(data, 8 + dx, 13 + by + pk, HI);
  px(data, 23 + dx, 15 + by + pk, SHADE);

  span(data, 10 + dx + cx, 11 + by, 12, MID);
  span(data, 9 + dx + cx, 12 + by, 14, MID);
  span(data, 9 + dx + cx, 13 + by, 14, DARK);
  span(data, 10 + dx + cx, 14 + by, 12, MID);
  span(data, 10 + dx + cx, 15 + by, 12, DARK);
  span(data, 11 + dx + cx, 16 + by, 10, METAL);
  span(data, 11 + dx + cx, 17 + by, 10, DARK);
  px(data, 10 + dx + cx, 18 + by, DARK);
  span(data, 11 + dx + cx, 18 + by, 10, SHADE);
  px(data, 10 + dx, 12 + by, HI);
  px(data, 21 + dx, 12 + by, SHADE);
  px(data, 16 + dx, 16 + by, WARM);

  rect(data, 7 + dx, 13 + by, 2, 5, DARK);
  px(data, 7 + dx, 17 + by, METAL);
  rect(data, 23 + dx + lx, 13 + by + ly, 2, 4, DARK);
  paintLamp(data, 24 + dx + lx, 11 + by + ly, d.lampHot);

  rect(data, 12 + dx, 19 + by + d.leftFootDy, 3, 6, DARK);
  rect(data, 17 + dx, 19 + by + d.rightFootDy, 3, 6, MID);
  px(data, 13 + dx, 20 + by + d.leftFootDy, MID);
  px(data, 18 + dx, 20 + by + d.rightFootDy, DARK);
  span(data, 12 + dx, 25 + by + d.leftFootDy, 3, SHADE);
  span(data, 17 + dx, 25 + by + d.rightFootDy, 3, SHADE);
  px(data, 12 + dx, 26 + by + d.leftFootDy, SHADE);
  px(data, 19 + dx, 26 + by + d.rightFootDy, SHADE);
}

function paintUp(data: Uint8ClampedArray, d: Deform): void {
  const dx = d.dx;
  const hy = d.headDy;
  const by = d.bodyDy;
  const pk = d.packDy;
  const lx = d.lampDx;
  const ly = d.lampDy;

  span(data, 14 + dx, 4 + hy, 4, METAL);
  span(data, 13 + dx, 5 + hy, 6, DARK);
  span(data, 12 + dx, 6 + hy, 8, METAL);
  span(data, 12 + dx, 7 + hy, 8, METAL);
  span(data, 12 + dx, 8 + hy, 8, DARK);
  span(data, 13 + dx, 9 + hy, 6, METAL);

  rect(data, 10 + dx, 10 + by + pk, 12, 9, METAL);
  span(data, 11 + dx, 11 + by + pk, 10, DARK);
  span(data, 12 + dx, 12 + by + pk, 8, MID);
  px(data, 13 + dx, 13 + by + pk, HI);
  px(data, 18 + dx, 14 + by + pk, SHADE);
  px(data, 16 + dx, 16 + by + pk, WARM);
  span(data, 11 + dx, 16 + by + pk, 2, SHADE);
  span(data, 19 + dx, 16 + by + pk, 2, SHADE);
  span(data, 10 + dx, 18 + by + pk, 12, DARK);

  rect(data, 8 + dx, 13 + by, 2, 5, DARK);
  rect(data, 22 + dx, 13 + by, 2, 5, DARK);
  paintLamp(data, 6 + dx + lx, 12 + by + ly, d.lampHot);

  rect(data, 12 + dx, 19 + by + d.rightFootDy, 3, 6, DARK);
  rect(data, 17 + dx, 19 + by + d.leftFootDy, 3, 6, MID);
  span(data, 12 + dx, 25 + by + d.rightFootDy, 3, SHADE);
  span(data, 17 + dx, 25 + by + d.leftFootDy, 3, SHADE);
}

function paintSide(data: Uint8ClampedArray, facing: 'left' | 'right', d: Deform): void {
  const dir = facing === 'right' ? 1 : -1;
  const X = (local: number): number => 16 + dir * local + d.dx;
  const hy = d.headDy;
  const by = d.bodyDy;
  const pk = d.packDy;
  const lx = d.lampDx;
  const ly = d.lampDy;
  const frontFoot = facing === 'right' ? d.rightFootDy : d.leftFootDy;
  const backFoot = facing === 'right' ? d.leftFootDy : d.rightFootDy;

  const col = (local: number, y: number, c: Rgba): void => px(data, X(local), y, c);
  const band = (local0: number, y: number, n: number, c: Rgba): void => {
    for (let i = 0; i < n; i++) col(local0 + i, y, c);
  };

  band(-3, 4 + hy, 7, METAL);
  band(-4, 5 + hy, 9, METAL);
  col(0, 5 + hy, HI);
  col(1, 5 + hy, HI);
  band(-4, 6 + hy, 9, METAL);
  band(-4, 7 + hy, 9, DARK);
  col(3, 7 + hy, VISOR);
  col(4, 7 + hy, VISOR);
  col(5, 7 + hy, VISOR);
  band(-4, 8 + hy, 9, METAL);
  band(-3, 9 + hy, 7, DARK);
  band(-2, 10 + hy, 5, DARK);

  band(-9, 10 + by + pk, 7, METAL);
  band(-10, 11 + by + pk, 8, METAL);
  band(-10, 12 + by + pk, 8, DARK);
  band(-10, 13 + by + pk, 8, METAL);
  band(-10, 14 + by + pk, 8, DARK);
  band(-9, 15 + by + pk, 7, METAL);
  band(-9, 16 + by + pk, 7, DARK);
  band(-8, 17 + by + pk, 6, SHADE);
  col(-8, 12 + by + pk, HI);
  col(-7, 14 + by + pk, WARM);

  band(-4, 11 + by, 9, MID);
  band(-5, 12 + by, 11, DARK);
  band(-4, 13 + by, 10, MID);
  band(-4, 14 + by, 10, DARK);
  band(-3, 15 + by, 9, METAL);
  px(data, X(0), 15 + by, WARM);
  band(-4, 16 + by, 10, DARK);
  band(-3, 17 + by, 9, SHADE);
  band(-2, 18 + by, 7, SHADE);
  col(4, 12 + by, HI);

  band(5, 12 + by + ly, 3, DARK);
  band(5, 13 + by + ly, 3, DARK);
  band(5, 14 + by + ly, 2, MID);
  paintLamp(data, X(7) + lx, 11 + by + ly, d.lampHot, dir === 1 ? 1 : -1);

  band(-4, 19 + by + backFoot, 4, DARK);
  band(-4, 20 + by + backFoot, 4, DARK);
  band(-4, 21 + by + backFoot, 4, MID);
  band(-4, 22 + by + backFoot, 4, DARK);
  band(-4, 23 + by + backFoot, 4, DARK);
  band(-4, 24 + by + backFoot, 4, SHADE);
  band(-4, 25 + by + backFoot, 3, SHADE);

  band(0, 19 + by + frontFoot, 4, MID);
  band(0, 20 + by + frontFoot, 4, DARK);
  band(0, 21 + by + frontFoot, 4, MID);
  band(0, 22 + by + frontFoot, 4, DARK);
  band(1, 23 + by + frontFoot, 3, DARK);
  band(0, 24 + by + frontFoot, 4, SHADE);
  col(2, 25 + by + frontFoot, SHADE);
}

function paintPose(facing: Facing4, d: Deform): Uint8ClampedArray {
  const data = new Uint8ClampedArray(CANVAS * CANVAS * 4);
  if (facing === 'down') paintDown(data, d);
  else if (facing === 'up') paintUp(data, d);
  else paintSide(data, facing, d);
  return data;
}

function upload(scene: Phaser.Scene, key: string, pixels: Uint8ClampedArray): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, CANVAS, CANVAS);
  if (!tex) return;
  const ctx = tex.getContext();
  const image = ctx.createImageData(CANVAS, CANVAS);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
  tex.refresh();
}

export function generateDensePlayerPlaceholders(scene: Phaser.Scene): void {
  for (const facing of FACINGS) {
    for (let frame = 0; frame < 4; frame++) {
      upload(scene, DENSE_PLAYER_IDLE_TEXTURE[facing][frame]!, paintPose(facing, idleDeform(frame)));
      upload(scene, DENSE_PLAYER_WALK_TEXTURE[facing][frame]!, paintPose(facing, walkDeform(facing, frame)));
    }
  }
}
