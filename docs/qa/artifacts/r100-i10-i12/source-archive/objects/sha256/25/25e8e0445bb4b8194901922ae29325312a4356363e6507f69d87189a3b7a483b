/**
 * Procedural 32×48 four-facing rewriter pixels (production look, DEC-066).
 * Contract: docs/art/rewriter-sprite.md.
 * All four sheets stay upright (head toward canvas top). Do not rotate the
 * silhouette 90°/180° into the bitmap — that reads as actor spin.
 */

import Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';
import type { MotionGait } from '@/entities/actor-motion';

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

export type RewriterAnimState = 'patrol' | 'suspicious' | 'search' | 'chase';

const FACINGS: Facing4[] = ['down', 'up', 'left', 'right'];

const FLESH = [0x2e, 0x2d, 0x30, 255] as const;
const CLOTH = [0x2a, 0x2a, 0x2e, 255] as const;
const BONE = [0x3a, 0x38, 0x38, 255] as const;
const DEEP = [0x0e, 0x4a, 0x3f, 255] as const;
const MID = [0x1a, 0x6b, 0x5c, 255] as const;
const CORE = [0x1a, 0xad, 0x96, 255] as const;
const GLOW = [0x2a, 0xe6, 0xc8, 255] as const;

type Rgba = readonly [number, number, number, number];
type Variant = 'patrol' | 'search' | 'chase';

/** Shared upright origin. Head is always −f (canvas top); never flip Y. */
const UPRIGHT_OX = 15;
const UPRIGHT_OY = 22;

/** Extra claw/melt pixels that reach into the facing direction (side views only). */
const SIDE_REACH: ReadonlyArray<readonly [number, number]> = [
  [2, 8],
  [4, 9],
  [6, 10],
  [8, 9],
  [1, 9],
  [3, 7],
  [5, 8],
  [7, 9],
  [9, 10],
  [4, 11],
  [6, 11],
  [8, 11],
  [2, 10],
  [0, 8],
];

/** Intact-side extra mass on left/right so the profile is not a sliver. */
const SIDE_BULK: ReadonlyArray<readonly [number, number]> = [
  [-5, -7],
  [-3, -7],
  [-1, -7],
  [1, -7],
  [3, -7],
  [-4, -8],
  [0, -8],
  [2, -8],
  [-2, -7],
  [4, -7],
  [-6, -7],
  [5, -8],
  [-3, -9],
];

/**
 * Chase 1 px jitter along body-right on an upright sheet.
 * Left/right jitter horizontally (the facing axis), not vertically — the sprite no longer lies on its side.
 */
export const REWRITER_RIGHT: Record<Facing4, { x: number; y: number }> = {
  down: { x: 1, y: 0 },
  up: { x: -1, y: 0 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

function toCanvas(f: number, r: number, facing: Facing4): { x: number; y: number } {
  const y = UPRIGHT_OY + f;
  switch (facing) {
    case 'down':
      return { x: UPRIGHT_OX + r, y };
    case 'up':
      return { x: UPRIGHT_OX - r, y };
    case 'right':
      return { x: UPRIGHT_OX + r + 2, y };
    case 'left':
      return { x: UPRIGHT_OX - r - 2, y };
  }
}

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
  const data = new Uint8ClampedArray(REWRITER_CANVAS_W * REWRITER_CANVAS_H * 4);
  const put = (f: number, r: number, color: Rgba): void => {
    const { x, y } = toCanvas(f, r, facing);
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
    for (let r = -5; r <= -2; r++) put(f, r, facing === 'up' ? BONE : FLESH);
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

  if (facing === 'left' || facing === 'right') {
    for (const [f, r] of SIDE_BULK) put(f, r, FLESH);
    for (const [f, r] of SIDE_REACH) put(f, r, MID);
  }

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

const IDLE_SX = [1, 1.03, 1, 0.97];
const IDLE_SY = [1, 0.96, 1, 1.04];
const WALK_SX = [1, 1.1, 1, 0.9];
const WALK_SY = [1, 0.88, 1, 1.12];

function isMelt(r: number, g: number, _b: number): boolean {
  return r < 50 && g > 50;
}

function warpMotion(
  src: Uint8ClampedArray,
  gait: MotionGait,
  frame: number,
  facing: Facing4
): Uint8ClampedArray {
  const w = REWRITER_CANVAS_W;
  const h = REWRITER_CANVAS_H;
  const ox = REWRITER_ORIGIN_X;
  const oy = REWRITER_ORIGIN_Y;
  const sx = gait === 'walk' ? WALK_SX[frame]! : IDLE_SX[frame]!;
  const sy = gait === 'walk' ? WALK_SY[frame]! : IDLE_SY[frame]!;
  const melt = gait === 'walk' ? (frame === 1 ? 1 : frame === 3 ? -1 : 0) : 0;
  const right = REWRITER_RIGHT[facing];
  const dst = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] === 0) continue;
      let nx = Math.round(ox + (x - ox) * sx);
      let ny = Math.round(oy + (y - oy) * sy);
      if (isMelt(src[i]!, src[i + 1]!, src[i + 2]!)) {
        nx += right.x * melt;
        ny += right.y * melt;
      }
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = (ny * w + nx) * 4;
      dst[j] = src[i]!;
      dst[j + 1] = src[i + 1]!;
      dst[j + 2] = src[i + 2]!;
      dst[j + 3] = src[i + 3]!;
    }
  }
  return dst;
}

function rewriterBaseKey(facing: Facing4, state: RewriterAnimState): string {
  if (state === 'chase') return REWRITER_TEXTURE_CHASE[facing];
  if (state === 'search') return REWRITER_TEXTURE_SEARCH[facing];
  if (state === 'suspicious') return `${REWRITER_TEXTURE[facing]}-suspicious`;
  return REWRITER_TEXTURE[facing];
}

function motionKeysFor(base: string): { idle: readonly string[]; walk: readonly string[] } {
  return {
    idle: [base, `${base}-idle-1`, `${base}-idle-2`, `${base}-idle-3`],
    walk: [`${base}-walk-0`, `${base}-walk-1`, `${base}-walk-2`, `${base}-walk-3`],
  };
}

const REWRITER_MOTION: Record<RewriterAnimState, Record<Facing4, { idle: readonly string[]; walk: readonly string[] }>> = {
  patrol: {
    down: motionKeysFor(rewriterBaseKey('down', 'patrol')),
    up: motionKeysFor(rewriterBaseKey('up', 'patrol')),
    left: motionKeysFor(rewriterBaseKey('left', 'patrol')),
    right: motionKeysFor(rewriterBaseKey('right', 'patrol')),
  },
  suspicious: {
    down: motionKeysFor(rewriterBaseKey('down', 'suspicious')),
    up: motionKeysFor(rewriterBaseKey('up', 'suspicious')),
    left: motionKeysFor(rewriterBaseKey('left', 'suspicious')),
    right: motionKeysFor(rewriterBaseKey('right', 'suspicious')),
  },
  search: {
    down: motionKeysFor(rewriterBaseKey('down', 'search')),
    up: motionKeysFor(rewriterBaseKey('up', 'search')),
    left: motionKeysFor(rewriterBaseKey('left', 'search')),
    right: motionKeysFor(rewriterBaseKey('right', 'search')),
  },
  chase: {
    down: motionKeysFor(rewriterBaseKey('down', 'chase')),
    up: motionKeysFor(rewriterBaseKey('up', 'chase')),
    left: motionKeysFor(rewriterBaseKey('left', 'chase')),
    right: motionKeysFor(rewriterBaseKey('right', 'chase')),
  },
};

function uploadMotionSet(
  scene: Phaser.Scene,
  facing: Facing4,
  baseKey: string,
  pixels: Uint8ClampedArray
): void {
  const keys = motionKeysFor(baseKey);
  upload(scene, keys.idle[0]!, pixels);
  for (let frame = 1; frame < 4; frame++) {
    upload(scene, keys.idle[frame]!, warpMotion(pixels, 'idle', frame, facing));
  }
  for (let frame = 0; frame < 4; frame++) {
    upload(scene, keys.walk[frame]!, warpMotion(pixels, 'walk', frame, facing));
  }
}

/** Boot-time four-facing sheets. Each facing is an upright pose, not a rotated down-sheet. */
export function generateRewriterPlaceholders(scene: Phaser.Scene): void {
  for (const facing of FACINGS) {
    uploadMotionSet(scene, facing, REWRITER_TEXTURE[facing], paintVariant(facing, 'patrol', false));
    uploadMotionSet(
      scene,
      facing,
      `${REWRITER_TEXTURE[facing]}-suspicious`,
      paintVariant(facing, 'patrol', true)
    );
    uploadMotionSet(scene, facing, REWRITER_TEXTURE_SEARCH[facing], paintVariant(facing, 'search', false));
    uploadMotionSet(scene, facing, REWRITER_TEXTURE_CHASE[facing], paintVariant(facing, 'chase', false));
  }
}

export function rewriterTextureFor(
  facing: Facing4,
  state: RewriterAnimState,
  gait: MotionGait = 'idle',
  frame = 0
): string {
  const keys = REWRITER_MOTION[state][facing][gait];
  return keys[frame] ?? keys[0]!;
}

const FLAKE_SOURCES: ReadonlyArray<readonly [number, number]> = [
  ...SIDE_REACH,
  [-6, 9],
  [3, 9],
  [7, 8],
  [5, 10],
  [-2, 8],
  [11, 4],
];

/** Melt-side edge relative to sprite origin, for contamination flakes. */
export function rewriterFlakeLocals(facing: Facing4): ReadonlyArray<{ x: number; y: number }> {
  return FLAKE_SOURCES.map(([f, r]) => {
    const { x, y } = toCanvas(f, r, facing);
    return { x: x - REWRITER_ORIGIN_X, y: y - REWRITER_ORIGIN_Y };
  });
}
