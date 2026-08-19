/**
 * Procedural 32×48 four-facing rewriter placeholders.
 * Contract: docs/art/rewriter-sprite.md. Do not rotate one sheet.
 */

import Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';

export const REWRITER_TEXTURE: Record<Facing4, string> = {
  down: 'placeholder-rewriter-down',
  up: 'placeholder-rewriter-up',
  left: 'placeholder-rewriter-left',
  right: 'placeholder-rewriter-right',
};

export const REWRITER_TEXTURE_SEARCH: Record<Facing4, string> = {
  down: 'placeholder-rewriter-down-search',
  up: 'placeholder-rewriter-up-search',
  left: 'placeholder-rewriter-left-search',
  right: 'placeholder-rewriter-right-search',
};

export const REWRITER_TEXTURE_CHASE: Record<Facing4, string> = {
  down: 'placeholder-rewriter-down-chase',
  up: 'placeholder-rewriter-up-chase',
  left: 'placeholder-rewriter-left-chase',
  right: 'placeholder-rewriter-right-chase',
};

export const REWRITER_CANVAS_W = 32;
export const REWRITER_CANVAS_H = 48;
export const REWRITER_ORIGIN_X = 16;
export const REWRITER_ORIGIN_Y = 30;

const FLESH = [0x2e, 0x2d, 0x30, 255] as const;
const CLOTH = [0x2a, 0x2a, 0x2e, 255] as const;
const BONE = [0x3a, 0x38, 0x38, 255] as const;
const DEEP = [0x0e, 0x4a, 0x3f, 255] as const;
const MID = [0x1a, 0x6b, 0x5c, 255] as const;
const CORE = [0x1a, 0xad, 0x96, 255] as const;
const GLOW = [0x2a, 0xe6, 0xc8, 255] as const;

type Rgba = readonly [number, number, number, number];
type Variant = 'patrol' | 'search' | 'chase';

const FACING_BASIS: Record<Facing4, { fx: number; fy: number; rx: number; ry: number; ox: number; oy: number }> = {
  down: { fx: 0, fy: 1, rx: 1, ry: 0, ox: 15, oy: 22 },
  up: { fx: 0, fy: -1, rx: -1, ry: 0, ox: 16, oy: 26 },
  left: { fx: -1, fy: 0, rx: 0, ry: 1, ox: 16, oy: 24 },
  right: { fx: 1, fy: 0, rx: 0, ry: -1, ox: 15, oy: 24 },
};

/** Body-right unit in canvas pixels for the chase 1 px jitter. */
export const REWRITER_RIGHT: Record<Facing4, { x: number; y: number }> = {
  down: { x: 1, y: 0 },
  up: { x: -1, y: 0 },
  left: { x: 0, y: 1 },
  right: { x: 0, y: -1 },
};

const CLUSTER: ReadonlyArray<readonly [number, number]> = [
  [-4, 2], [-4, 3], [-4, 4], [-3, 2], [-3, 3], [-3, 4], [-2, 3],
  [1, 3], [1, 4], [2, 3], [2, 4], [2, 5], [3, 4],
  [-1, 5], [0, 5], [0, 6], [1, 6],
];

const CLUSTER_HEARTS: ReadonlyArray<readonly [number, number]> = [
  [-3, 3], [2, 4],
];

const SEARCH_GLOW: ReadonlyArray<readonly [number, number]> = [
  [-4, 3], [-2, 3], [1, 4], [0, 5],
];

const CHASE_KEEP_CORE: ReadonlyArray<readonly [number, number]> = [
  [-4, 2], [1, 3], [0, 6],
];

function keyOf(f: number, r: number): string {
  return `${f},${r}`;
}

function paintVariant(facing: Facing4, variant: Variant, suspiciousDot: boolean): Uint8ClampedArray {
  const { fx, fy, rx, ry, ox, oy } = FACING_BASIS[facing];
  const data = new Uint8ClampedArray(REWRITER_CANVAS_W * REWRITER_CANVAS_H * 4);
  const put = (f: number, r: number, color: Rgba): void => {
    const x = ox + fx * f + rx * r;
    const y = oy + fy * f + ry * r;
    if (x < 0 || y < 0 || x >= REWRITER_CANVAS_W || y >= REWRITER_CANVAS_H) return;
    const i = (y * REWRITER_CANVAS_W + x) * 4;
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
    data[i + 3] = color[3];
  };

  for (let f = -6; f <= 5; f++) {
    for (let r = -6; r <= -2; r++) {
      if (f === 2 && r === -2) continue;
      put(f, r, FLESH);
    }
  }
  for (let f = -10; f <= -7; f++) {
    for (let r = -5; r <= -2; r++) put(f, r, FLESH);
  }
  for (const [f, r] of [
    [-6, -7], [-5, -7], [-6, -8], [-5, -6], [-4, -3],
  ] as const) {
    put(f, r, BONE);
  }
  for (const [f, r] of [
    [-2, -8], [0, -8], [2, -8], [4, -8], [6, -9], [8, -9], [9, -10], [10, -10], [11, -11],
  ] as const) {
    put(f, r, CLOTH);
  }
  for (let f = -7; f <= 6; f++) {
    for (let r = 1; r <= 7; r++) {
      if ((f + r) % 5 === 0) continue;
      put(f, r, DEEP);
    }
  }

  const keepCore = new Set(CHASE_KEEP_CORE.map(([f, r]) => keyOf(f, r)));
  const searchGlow = new Set(SEARCH_GLOW.map(([f, r]) => keyOf(f, r)));

  for (const [f, r] of CLUSTER) {
    const k = keyOf(f, r);
    if (variant === 'chase') {
      put(f, r, keepCore.has(k) ? CORE : GLOW);
    } else if (variant === 'search' && searchGlow.has(k)) {
      put(f, r, GLOW);
    } else {
      put(f, r, CORE);
    }
  }
  for (const [f, r] of CLUSTER_HEARTS) {
    if (variant === 'chase' && keepCore.has(keyOf(f, r))) continue;
    put(f, r, GLOW);
  }
  if (variant === 'search') {
    for (const [f, r] of SEARCH_GLOW) put(f, r, GLOW);
    for (const [f, r] of CLUSTER_HEARTS) put(f, r, GLOW);
  }

  put(-3, -4, CORE);
  for (const [f, r] of [
    [-6, 9], [3, 9], [7, 8], [5, 10], [-2, 8],
  ] as const) {
    put(f, r, MID);
  }
  put(8, 3, MID);
  put(9, 3, MID);
  put(10, 4, MID);
  put(11, 4, CORE);

  if (suspiciousDot) put(-9, -3, GLOW);

  return data;
}

function upload(scene: Phaser.Scene, key: string, pixels: Uint8ClampedArray): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, REWRITER_CANVAS_W, REWRITER_CANVAS_H);
  if (!tex) return;
  const ctx = tex.getContext();
  const image = ctx.createImageData(REWRITER_CANVAS_W, REWRITER_CANVAS_H);
  image.data.set(pixels);
  ctx.putImageData(image, 0, 0);
  tex.refresh();
}

/** Boot-time four-facing sheets. Search / chase are independent paints, not rotations. */
export function generateRewriterPlaceholders(scene: Phaser.Scene): void {
  const facings: Facing4[] = ['down', 'up', 'left', 'right'];
  for (const facing of facings) {
    upload(scene, REWRITER_TEXTURE[facing], paintVariant(facing, 'patrol', false));
    upload(scene, `${REWRITER_TEXTURE[facing]}-suspicious`, paintVariant(facing, 'patrol', true));
    upload(scene, REWRITER_TEXTURE_SEARCH[facing], paintVariant(facing, 'search', false));
    upload(scene, REWRITER_TEXTURE_CHASE[facing], paintVariant(facing, 'chase', false));
  }
}

export function rewriterTextureFor(facing: Facing4, state: 'patrol' | 'suspicious' | 'search' | 'chase'): string {
  if (state === 'chase') return REWRITER_TEXTURE_CHASE[facing];
  if (state === 'search') return REWRITER_TEXTURE_SEARCH[facing];
  if (state === 'suspicious') return `${REWRITER_TEXTURE[facing]}-suspicious`;
  return REWRITER_TEXTURE[facing];
}
