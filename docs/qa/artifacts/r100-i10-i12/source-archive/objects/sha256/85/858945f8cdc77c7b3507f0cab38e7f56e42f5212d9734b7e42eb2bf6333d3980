/**
 * Procedural 32×32 four-facing infiltrator pixels (production look, DEC-066).
 * Hunched predator: long reaching arm, mass toward facing, missing contour.
 * Collision stays 20. Gait is squash-stretch, never rotation.
 */

import Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';
import type { MotionGait } from '@/entities/actor-motion';

export const INFILTRATOR_TEXTURE: Record<Facing4, string> = {
  down: 'placeholder-enemy-down',
  up: 'placeholder-enemy-up',
  left: 'placeholder-enemy-left',
  right: 'placeholder-enemy-right',
};

/** Legacy alias: down-facing idle frame 0. Combat FX pool boots from this key. */
export const INFILTRATOR_TEXTURE_DEFAULT = INFILTRATOR_TEXTURE.down;

export const INFILTRATOR_CANVAS = 32;

const FACINGS: Facing4[] = ['down', 'up', 'left', 'right'];
const CANVAS = INFILTRATOR_CANVAS;

type Rgba = readonly [number, number, number, number];

const FLESH: Rgba = [0x2e, 0x2d, 0x30, 255];
const CLOTH: Rgba = [0x2a, 0x2a, 0x2e, 255];
const BONE: Rgba = [0x3a, 0x38, 0x38, 255];
const CORE: Rgba = [0x1a, 0xad, 0x96, 255];
const COLD: Rgba = [0x1a, 0x7a, 0x9a, 255];
const VISOR: Rgba = [0x1a, 0x1c, 0x1f, 255];

interface Deform {
  readonly dx: number;
  readonly bodyDy: number;
  readonly headDy: number;
  readonly armExtra: number;
  readonly footDy: number;
  readonly speckSway: number;
  readonly lean: number;
}

const ZERO: Deform = {
  dx: 0,
  bodyDy: 0,
  headDy: 0,
  armExtra: 0,
  footDy: 0,
  speckSway: 0,
  lean: 0,
};

function idleDeform(frame: number): Deform {
  if (frame === 1) return { ...ZERO, bodyDy: -1, headDy: -1, lean: 1 };
  if (frame === 3) return { ...ZERO, bodyDy: 1, headDy: 1, footDy: 1, speckSway: 1 };
  return ZERO;
}

function walkDeform(facing: Facing4, frame: number): Deform {
  const side = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  if (frame === 0) return { ...ZERO, dx: side, lean: 1, armExtra: 1 };
  if (frame === 1) {
    return { ...ZERO, dx: side * 2, bodyDy: -2, headDy: -1, armExtra: 3, footDy: -2, speckSway: 1, lean: 2 };
  }
  if (frame === 2) return { ...ZERO, dx: side, lean: 1, armExtra: 1 };
  return { ...ZERO, dx: side, bodyDy: 2, headDy: 1, footDy: 2, speckSway: -1, lean: 1 };
}

export const INFILTRATOR_IDLE_TEXTURE: Record<Facing4, readonly string[]> = {
  down: ['placeholder-enemy-down', 'placeholder-enemy-down-idle-1', 'placeholder-enemy-down-idle-2', 'placeholder-enemy-down-idle-3'],
  up: ['placeholder-enemy-up', 'placeholder-enemy-up-idle-1', 'placeholder-enemy-up-idle-2', 'placeholder-enemy-up-idle-3'],
  left: ['placeholder-enemy-left', 'placeholder-enemy-left-idle-1', 'placeholder-enemy-left-idle-2', 'placeholder-enemy-left-idle-3'],
  right: ['placeholder-enemy-right', 'placeholder-enemy-right-idle-1', 'placeholder-enemy-right-idle-2', 'placeholder-enemy-right-idle-3'],
};

export const INFILTRATOR_WALK_TEXTURE: Record<Facing4, readonly string[]> = {
  down: ['placeholder-enemy-down-walk-0', 'placeholder-enemy-down-walk-1', 'placeholder-enemy-down-walk-2', 'placeholder-enemy-down-walk-3'],
  up: ['placeholder-enemy-up-walk-0', 'placeholder-enemy-up-walk-1', 'placeholder-enemy-up-walk-2', 'placeholder-enemy-up-walk-3'],
  left: ['placeholder-enemy-left-walk-0', 'placeholder-enemy-left-walk-1', 'placeholder-enemy-left-walk-2', 'placeholder-enemy-left-walk-3'],
  right: ['placeholder-enemy-right-walk-0', 'placeholder-enemy-right-walk-1', 'placeholder-enemy-right-walk-2', 'placeholder-enemy-right-walk-3'],
};

export function infiltratorMotionTexture(facing: Facing4, gait: MotionGait, frame: number): string {
  const table = gait === 'walk' ? INFILTRATOR_WALK_TEXTURE : INFILTRATOR_IDLE_TEXTURE;
  return table[facing][frame] ?? table[facing][0]!;
}

/** Edge pixels relative to the 32×32 origin, for contamination flakes. */
export const INFILTRATOR_FLAKE_LOCAL: Record<Facing4, ReadonlyArray<{ x: number; y: number }>> = {
  down: [
    { x: 11, y: 11 },
    { x: -8, y: 3 },
    { x: 4, y: 12 },
    { x: -5, y: -8 },
    { x: 8, y: 1 },
  ],
  up: [
    { x: -10, y: -10 },
    { x: 7, y: 3 },
    { x: -4, y: 11 },
    { x: 6, y: -9 },
    { x: -8, y: 2 },
  ],
  left: [
    { x: -12, y: 3 },
    { x: -11, y: 10 },
    { x: 5, y: -7 },
    { x: -8, y: -4 },
    { x: 4, y: 11 },
  ],
  right: [
    { x: 12, y: 3 },
    { x: 11, y: 10 },
    { x: -5, y: -7 },
    { x: 8, y: -4 },
    { x: -4, y: 11 },
  ],
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

function paintSpecks(
  data: Uint8ClampedArray,
  spots: ReadonlyArray<readonly [number, number]>,
  sway: number,
  facing: Facing4
): void {
  const sx = facing === 'left' ? -sway : facing === 'right' ? sway : 0;
  const sy = facing === 'up' ? -sway : facing === 'down' ? sway : 0;
  spots.forEach(([x, y], i) => {
    px(data, x + sx, y + sy, i === 2 || i === 4 ? COLD : CORE);
  });
}

function paintDown(data: Uint8ClampedArray, d: Deform): void {
  const dx = d.dx;
  const hy = d.headDy + d.lean;
  const by = d.bodyDy + d.lean;
  const arm = d.armExtra;
  const ft = d.footDy;

  span(data, 12 + dx, 3 + hy, 6, FLESH);
  span(data, 11 + dx, 4 + hy, 8, FLESH);
  span(data, 10 + dx, 5 + hy, 10, CLOTH);
  px(data, 13 + dx, 4 + hy, BONE);
  span(data, 12 + dx, 6 + hy, 7, VISOR);
  span(data, 10 + dx, 7 + hy, 10, FLESH);
  span(data, 11 + dx, 8 + hy, 8, CLOTH);
  span(data, 12 + dx, 9 + hy, 6, FLESH);

  span(data, 8 + dx, 10 + by, 14, FLESH);
  span(data, 7 + dx, 11 + by, 16, CLOTH);
  span(data, 7 + dx, 12 + by, 16, FLESH);
  span(data, 8 + dx, 13 + by, 14, FLESH);
  span(data, 8 + dx, 14 + by, 14, CLOTH);
  span(data, 9 + dx, 15 + by, 12, FLESH);
  span(data, 9 + dx, 16 + by, 12, CLOTH);
  span(data, 10 + dx, 17 + by, 10, FLESH);
  px(data, 7 + dx, 14 + by, BONE);

  rect(data, 5 + dx, 12 + by, 3, 6, CLOTH);
  px(data, 5 + dx, 18 + by, FLESH);

  rect(data, 21 + dx + arm, 11 + by, 4, 10, CLOTH);
  rect(data, 24 + dx + arm, 18 + by, 3, 6, CLOTH);
  px(data, 27 + dx + arm, 23 + by, CLOTH);
  px(data, 27 + dx + arm, 24 + by, FLESH);
  px(data, 26 + dx + arm, 25 + by, CLOTH);
  px(data, 28 + dx + arm, 24 + by, CLOTH);

  rect(data, 10 + dx, 18 + by + ft, 4, 8, FLESH);
  rect(data, 16 + dx, 19 + by + ft, 4, 8, CLOTH);
  span(data, 10 + dx, 26 + by + ft, 4, CLOTH);
  span(data, 16 + dx, 27 + by + ft, 4, CLOTH);

  paintSpecks(
    data,
    [
      [20 + dx, 11 + by],
      [8 + dx, 15 + by],
      [26 + dx + arm, 20 + by],
      [14 + dx, 22 + by + ft],
      [11 + dx, 6 + hy],
      [23 + dx + arm, 16 + by],
    ],
    d.speckSway,
    'down'
  );
}

function paintUp(data: Uint8ClampedArray, d: Deform): void {
  const dx = d.dx;
  const hy = d.headDy - d.lean;
  const by = d.bodyDy;
  const arm = d.armExtra;
  const ft = d.footDy;

  span(data, 12 + dx, 3 + hy, 6, CLOTH);
  span(data, 11 + dx, 4 + hy, 8, FLESH);
  span(data, 10 + dx, 5 + hy, 10, FLESH);
  span(data, 10 + dx, 6 + hy, 10, BONE);
  span(data, 11 + dx, 7 + hy, 8, FLESH);

  rect(data, 8 + dx, 8 + by, 14, 9, CLOTH);
  span(data, 7 + dx, 10 + by, 16, FLESH);
  span(data, 9 + dx, 16 + by, 12, CLOTH);
  px(data, 21 + dx, 11 + by, BONE);

  rect(data, 5 + dx - arm, 2 + hy, 4, 9, CLOTH);
  px(data, 5 + dx - arm, 1 + hy, CLOTH);
  px(data, 4 + dx - arm, 2 + hy, FLESH);
  px(data, 4 + dx - arm, 3 + hy, CLOTH);

  rect(data, 10 + dx, 17 + by + ft, 4, 8, FLESH);
  rect(data, 16 + dx, 17 + by + ft, 4, 8, CLOTH);
  span(data, 10 + dx, 25 + by + ft, 4, CLOTH);
  span(data, 16 + dx, 25 + by + ft, 4, CLOTH);

  paintSpecks(
    data,
    [
      [6 + dx - arm, 4 + hy],
      [21 + dx, 12 + by],
      [8 + dx, 15 + by],
      [18 + dx, 21 + by + ft],
      [13 + dx, 5 + hy],
      [5 + dx - arm, 8 + hy],
    ],
    d.speckSway,
    'up'
  );
}

function paintSide(data: Uint8ClampedArray, facing: 'left' | 'right', d: Deform): void {
  const dir = facing === 'right' ? 1 : -1;
  const X = (local: number): number => 16 + dir * (local + d.lean) + d.dx;
  const hy = d.headDy;
  const by = d.bodyDy;
  const arm = d.armExtra;
  const ft = d.footDy;

  const col = (local: number, y: number, c: Rgba): void => px(data, X(local), y, c);
  const band = (local0: number, y: number, n: number, c: Rgba): void => {
    for (let i = 0; i < n; i++) col(local0 + i, y, c);
  };

  band(-1, 3 + hy, 7, FLESH);
  band(-2, 4 + hy, 9, FLESH);
  band(-2, 5 + hy, 9, CLOTH);
  col(5, 5 + hy, VISOR);
  col(6, 5 + hy, VISOR);
  band(-2, 6 + hy, 9, FLESH);
  band(-1, 7 + hy, 7, CLOTH);
  col(1, 4 + hy, BONE);

  band(-6, 8 + by, 12, FLESH);
  band(-7, 9 + by, 14, CLOTH);
  band(-7, 10 + by, 14, FLESH);
  band(-6, 11 + by, 13, FLESH);
  band(-6, 12 + by, 13, CLOTH);
  band(-5, 13 + by, 12, FLESH);
  band(-5, 14 + by, 12, CLOTH);
  band(-4, 15 + by, 10, FLESH);
  col(-6, 11 + by, BONE);

  band(6 + arm, 9 + by, 5, CLOTH);
  band(7 + arm, 10 + by, 5, CLOTH);
  band(8 + arm, 12 + by, 5, FLESH);
  band(9 + arm, 14 + by, 4, CLOTH);
  col(13 + arm, 17 + by, CLOTH);
  col(13 + arm, 18 + by, FLESH);
  col(12 + arm, 19 + by, CLOTH);
  col(14 + arm, 18 + by, CLOTH);

  band(-4, 16 + by + ft, 5, FLESH);
  band(-4, 17 + by + ft, 5, CLOTH);
  band(-4, 18 + by + ft, 5, FLESH);
  band(-4, 20 + by + ft, 4, CLOTH);
  band(-4, 22 + by + ft, 3, CLOTH);
  band(1, 16 + by + ft, 5, CLOTH);
  band(1, 17 + by + ft, 5, FLESH);
  band(2, 18 + by + ft, 4, CLOTH);
  band(2, 20 + by + ft, 4, CLOTH);
  band(2, 22 + by + ft, 3, FLESH);

  const spots: Array<[number, number]> = [
    [X(-6), 10 + by],
    [X(10 + arm), 13 + by],
    [X(4), 6 + hy],
    [X(-3), 19 + by + ft],
    [X(8 + arm), 18 + by],
    [X(12 + arm), 16 + by],
  ];
  paintSpecks(data, spots, d.speckSway, facing);
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

export function generateInfiltratorPlaceholders(scene: Phaser.Scene): void {
  for (const facing of FACINGS) {
    for (let frame = 0; frame < 4; frame++) {
      upload(scene, INFILTRATOR_IDLE_TEXTURE[facing][frame]!, paintPose(facing, idleDeform(frame)));
      upload(scene, INFILTRATOR_WALK_TEXTURE[facing][frame]!, paintPose(facing, walkDeform(facing, frame)));
    }
  }
  upload(scene, 'placeholder-enemy', paintPose('down', ZERO));
}
