import type Phaser from 'phaser';
import type { Rgba } from '@/gym/form-renderers/a/colors';
import { CORE, DEEP, GLOW } from '@/gym/form-renderers/a/colors';

export interface PaintBuf {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

export function makeBuf(w: number, h: number): PaintBuf {
  return { data: new Uint8ClampedArray(w * h * 4), w, h };
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

export function span(buf: PaintBuf, x: number, y: number, w: number, c: Rgba): void {
  for (let i = 0; i < w; i++) px(buf, x + i, y, c);
}

export function rect(buf: PaintBuf, x: number, y: number, w: number, h: number, c: Rgba): void {
  for (let j = 0; j < h; j++) span(buf, x, y + j, w, c);
}

export function blit(src: PaintBuf, dst: PaintBuf, dx: number, dy: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const si = (y * src.w + x) * 4;
      if ((src.data[si + 3] ?? 0) === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= dst.w || ny >= dst.h) continue;
      const di = (ny * dst.w + nx) * 4;
      dst.data[di] = src.data[si] ?? 0;
      dst.data[di + 1] = src.data[si + 1] ?? 0;
      dst.data[di + 2] = src.data[si + 2] ?? 0;
      dst.data[di + 3] = src.data[si + 3] ?? 0;
    }
  }
}

export function shiftOpaque(buf: PaintBuf, dx: number, dy: number): void {
  const src = { data: buf.data.slice(), w: buf.w, h: buf.h };
  buf.data.fill(0);
  blit(src, buf, dx, dy);
}

/** Coverage fail: 0 infiltrate, 1 rewrite, 2 overwrite. */
export function applyCoverageFail(buf: PaintBuf, fail: 0 | 1 | 2, seed: number): void {
  const n = buf.w * buf.h;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    if ((buf.data[i + 3] ?? 0) === 0) continue;
    const u = unit(seed, p + 17);
    if (fail === 0) {
      if (u < 0.05) write(buf.data, i, u < 0.025 ? CORE : GLOW);
      continue;
    }
    if (fail === 1) {
      if (u < 0.38) {
        buf.data[i + 3] = 0;
      } else if (u < 0.58) {
        write(buf.data, i, u < 0.48 ? DEEP : CORE);
      }
      continue;
    }
    if (u < 0.74) {
      buf.data[i + 3] = 0;
    } else if (u < 0.92) {
      write(buf.data, i, u < 0.84 ? CORE : DEEP);
    } else {
      write(buf.data, i, GLOW);
    }
  }
}

function write(data: Uint8ClampedArray, i: number, c: Rgba): void {
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
  data[i + 3] = c[3];
}

export function shardSplit(buf: PaintBuf, seed: number): void {
  const src: PaintBuf = { data: buf.data.slice(), w: buf.w, h: buf.h };
  buf.data.fill(0);
  const third = unit(seed, 91) > 0.45;
  blit(src, buf, -4, -1);
  blit(src, buf, 5, 2);
  if (third) blit(src, buf, 0, -5);
}

export function uploadPixels(scene: Phaser.Scene, key: string, buf: PaintBuf): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, buf.w, buf.h);
  if (!tex) return;
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
