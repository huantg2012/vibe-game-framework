/** Phaser-free pixel buffer. Genome weld tests must not import Phaser. */
export interface PaintBuf {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

export type Rgba = readonly [number, number, number, number];

export function makeBuf(w: number, h: number): PaintBuf {
  return { data: new Uint8ClampedArray(w * h * 4), w, h };
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

export function rect(buf: PaintBuf, x: number, y: number, w: number, h: number, c: Rgba): void {
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) px(buf, x + i, y + j, c);
  }
}

export function alphaAt(buf: PaintBuf, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return 0;
  return buf.data[(y * buf.w + x) * 4 + 3] ?? 0;
}
