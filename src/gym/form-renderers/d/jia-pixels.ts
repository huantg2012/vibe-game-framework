import Phaser from 'phaser';
import type { Facing4 } from '@/types/game-types';
import type { Rgb } from '@/gym/form-renderers/d/fragment-ramp';

export interface PaintBuf {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

export type Rgba = readonly [number, number, number, number];

export function makeBuf(w: number, h: number): PaintBuf {
  return { data: new Uint8ClampedArray(w * h * 4), w, h };
}

export function cloneBuf(buf: PaintBuf): PaintBuf {
  return { data: buf.data.slice(), w: buf.w, h: buf.h };
}

export function hash32(seed: number, n: number): number {
  let h = (seed ^ n) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
}

export function unit(seed: number, n: number): number {
  return hash32(seed, n) / 4294967296;
}

export function toRgba(rgb: Rgb, a = 255): Rgba {
  return [rgb[0], rgb[1], rgb[2], a];
}

export function px(buf: PaintBuf, x: number, y: number, c: Rgba): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= buf.w || iy >= buf.h) return;
  const i = (iy * buf.w + ix) * 4;
  buf.data[i] = c[0];
  buf.data[i + 1] = c[1];
  buf.data[i + 2] = c[2];
  buf.data[i + 3] = c[3];
}

export function clearPx(buf: PaintBuf, x: number, y: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= buf.w || iy >= buf.h) return;
  const i = (iy * buf.w + ix) * 4;
  buf.data[i] = 0;
  buf.data[i + 1] = 0;
  buf.data[i + 2] = 0;
  buf.data[i + 3] = 0;
}

export function span(buf: PaintBuf, x: number, y: number, w: number, c: Rgba): void {
  for (let i = 0; i < w; i++) px(buf, x + i, y, c);
}

export function rect(buf: PaintBuf, x: number, y: number, w: number, h: number, c: Rgba): void {
  for (let j = 0; j < h; j++) span(buf, x, y + j, w, c);
}

export function alphaAt(buf: PaintBuf, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return 0;
  return buf.data[(y * buf.w + x) * 4 + 3] ?? 0;
}

export function rgbAt(buf: PaintBuf, x: number, y: number): Rgb {
  const i = (y * buf.w + x) * 4;
  return [buf.data[i] ?? 0, buf.data[i + 1] ?? 0, buf.data[i + 2] ?? 0];
}

/** Teal-axis melt test. Grey flesh/metal stays; ramp contamination slides. */
export function isMeltRgb(r: number, g: number, b: number): boolean {
  return g > r + 18 && g > b - 8 && r < 90 && b < 180;
}

const IDLE_SX = [1, 1.03, 1, 0.97];
const IDLE_SY = [1, 0.96, 1, 1.04];
const WALK_SX = [1, 1.1, 1, 0.9];
const WALK_SY = [1, 0.88, 1, 1.12];

const MELT_DIR: Record<Facing4, { x: number; y: number }> = {
  down: { x: 1, y: 0 },
  up: { x: -1, y: 0 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function warpMotion(
  src: PaintBuf,
  gait: 'idle' | 'walk',
  frame: number,
  facing: Facing4,
  originX: number,
  originY: number,
  melt: boolean,
): PaintBuf {
  const w = src.w;
  const h = src.h;
  const sx = gait === 'walk' ? WALK_SX[frame]! : IDLE_SX[frame]!;
  const sy = gait === 'walk' ? WALK_SY[frame]! : IDLE_SY[frame]!;
  const meltAmt = melt && gait === 'walk' ? (frame === 1 ? 1 : frame === 3 ? -1 : 0) : 0;
  const right = MELT_DIR[facing];
  const dst = makeBuf(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      let nx = Math.round(originX + (x - originX) * sx);
      let ny = Math.round(originY + (y - originY) * sy);
      if (meltAmt !== 0 && isMeltRgb(src.data[i]!, src.data[i + 1]!, src.data[i + 2]!)) {
        nx += right.x * meltAmt;
        ny += right.y * meltAmt;
      }
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = (ny * w + nx) * 4;
      dst.data[j] = src.data[i]!;
      dst.data[j + 1] = src.data[i + 1]!;
      dst.data[j + 2] = src.data[i + 2]!;
      dst.data[j + 3] = src.data[i + 3]!;
    }
  }
  return dst;
}

export function uploadPixels(scene: Phaser.Scene, key: string, buf: PaintBuf): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, buf.w, buf.h);
  if (!tex) return;
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
  const ctx = tex.getContext();
  const image = ctx.createImageData(buf.w, buf.h);
  image.data.set(buf.data);
  ctx.putImageData(image, 0, 0);
  tex.refresh();
}

export function removeKeys(scene: Phaser.Scene, keys: readonly string[]): void {
  for (const key of keys) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
  }
}
