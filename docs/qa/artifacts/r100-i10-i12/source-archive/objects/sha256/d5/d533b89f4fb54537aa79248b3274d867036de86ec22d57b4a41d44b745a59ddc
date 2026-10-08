/**
 * 共享构件绘制：杆 / 梁 / 团 / 座 / 丝 / 碎 / 核。
 * 对照 `tools/contam-preview/` 的构件语言，不复制进本目录以外。
 */
import {
  alphaAt,
  clearPx,
  makeBuf,
  px,
  rect,
  type PaintBuf,
  type Rgba,
} from '@/entities/form-renderers/d/genome/buffer';
import type { GenomeInk, GenomeMat, GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';

const OPAQUE = 255;

export const DEFAULT_GENOME_INK: GenomeInk = {
  flesh: [0x2e, 0x2d, 0x30, OPAQUE],
  cloth: [0x2a, 0x2a, 0x2e, OPAQUE],
  bone: [0x3a, 0x38, 0x38, OPAQUE],
  earth: [0x1a, 0x1c, 0x1f, OPAQUE],
  brick: [0x2a, 0x1f, 0x1c, OPAQUE],
  metal: [0x4a, 0x4e, 0x55, OPAQUE],
  metalMid: [0x3a, 0x3d, 0x42, OPAQUE],
  concrete: [0x2c, 0x2e, 0x33, OPAQUE],
  shadow: [0x15, 0x1a, 0x1e, OPAQUE],
  core: [0x1a, 0xad, 0x96, OPAQUE],
  glow: [0x2a, 0xe6, 0xc8, OPAQUE],
};

function ink(colors: GenomeInk, mat: GenomeMat): Rgba {
  return colors[mat];
}

export function partBounds(p: GenomeNode): { x: number; y: number; w: number; h: number } {
  if (p.kind !== 'filament' || !p.bend) return { x: p.x, y: p.y, w: p.w, h: p.h };
  const minX = Math.min(p.x, p.x + p.bend);
  const maxX = Math.max(p.x + p.w, p.x + p.w + p.bend);
  return { x: minX, y: p.y, w: Math.max(1, maxX - minX), h: p.h };
}

export function drawPart(buf: PaintBuf, p: GenomeNode, colors: GenomeInk): void {
  const c = ink(colors, p.mat);
  const shadow = ink(colors, 'shadow');
  switch (p.kind) {
    case 'post': {
      rect(buf, p.x, p.y, p.w, p.h, c);
      if (p.w >= 3) for (let j = 0; j < p.h; j++) px(buf, p.x + p.w - 1, p.y + j, shadow);
      return;
    }
    case 'beam':
    case 'plate': {
      rect(buf, p.x, p.y, p.w, p.h, c);
      if (p.h >= 2) for (let i = 0; i < p.w; i++) px(buf, p.x + i, p.y + p.h - 1, shadow);
      return;
    }
    case 'mass': {
      rect(buf, p.x, p.y, p.w, p.h, c);
      for (let i = 0; i < p.w; i++) px(buf, p.x + i, p.y, ink(colors, 'bone'));
      clearPx(buf, p.x, p.y);
      clearPx(buf, p.x + p.w - 1, p.y);
      clearPx(buf, p.x, p.y + p.h - 1);
      clearPx(buf, p.x + p.w - 1, p.y + p.h - 1);
      return;
    }
    case 'filament': {
      const bend = p.bend ?? 0;
      let prevX = p.x;
      for (let j = 0; j < p.h; j++) {
        const t = p.h <= 1 ? 0 : j / (p.h - 1);
        const dx = Math.round(bend * t);
        const x = p.x + dx;
        const y = p.y + j;
        if (j > 0 && x !== prevX) {
          for (let i = 0; i < p.w; i++) px(buf, prevX + i, y, c);
        }
        for (let i = 0; i < p.w; i++) px(buf, x + i, y, c);
        prevX = x;
      }
      return;
    }
    case 'nub': {
      rect(buf, p.x, p.y, p.w, p.h, c);
      return;
    }
    case 'core': {
      rect(buf, p.x, p.y, p.w, p.h, ink(colors, 'glow'));
    }
  }
}

const ROLE_ORDER: readonly NonNullable<GenomeNode['role']>[] = [
  'base',
  'spine',
  'rib',
  'limb',
  'head',
  'lintel',
  'accent',
];

export function drawSkeleton(sk: GenomeSkeleton, colors: GenomeInk = DEFAULT_GENOME_INK): PaintBuf {
  const buf = makeBuf(sk.canvas.w, sk.canvas.h);
  for (const role of ROLE_ORDER) {
    for (const p of sk.parts) if (p.role === role) drawPart(buf, p, colors);
  }
  for (const p of sk.parts) if (!p.role) drawPart(buf, p, colors);
  return buf;
}

export function countOpaquePixels(buf: PaintBuf): number {
  let n = 0;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) if (alphaAt(buf, x, y) !== 0) n++;
  }
  return n;
}
