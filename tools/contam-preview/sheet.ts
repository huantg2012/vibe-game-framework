/**
 * Contact-sheet compositor for contamination-form previews.
 * Preview tooling only: writes PNGs for human review, never imported by `src/**`.
 */

import { writePng } from '../map-preview/png';

export type Rgb = readonly [number, number, number];

export interface Sheet {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

export interface Buf {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

export function makeSheet(w: number, h: number, bg: Rgb): Sheet {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = bg[0];
    data[i * 4 + 1] = bg[1];
    data[i * 4 + 2] = bg[2];
    data[i * 4 + 3] = 255;
  }
  return { data, w, h };
}

export function fillRect(s: Sheet, x: number, y: number, w: number, h: number, rgb: Rgb): void {
  for (let j = 0; j < h; j++) {
    const py = y + j;
    if (py < 0 || py >= s.h) continue;
    for (let i = 0; i < w; i++) {
      const pxx = x + i;
      if (pxx < 0 || pxx >= s.w) continue;
      const o = (py * s.w + pxx) * 4;
      s.data[o] = rgb[0];
      s.data[o + 1] = rgb[1];
      s.data[o + 2] = rgb[2];
      s.data[o + 3] = 255;
    }
  }
}

/** Nearest-neighbour blit with straight alpha composite over whatever is already there. */
export function blit(s: Sheet, src: Buf, dx: number, dy: number, scale: number): void {
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const i = (y * src.w + x) * 4;
      const a = src.data[i + 3] ?? 0;
      if (a === 0) continue;
      const t = a / 255;
      for (let sy = 0; sy < scale; sy++) {
        const py = dy + y * scale + sy;
        if (py < 0 || py >= s.h) continue;
        for (let sx = 0; sx < scale; sx++) {
          const pxx = dx + x * scale + sx;
          if (pxx < 0 || pxx >= s.w) continue;
          const o = (py * s.w + pxx) * 4;
          s.data[o] = (src.data[i] ?? 0) * t + (s.data[o] ?? 0) * (1 - t);
          s.data[o + 1] = (src.data[i + 1] ?? 0) * t + (s.data[o + 1] ?? 0) * (1 - t);
          s.data[o + 2] = (src.data[i + 2] ?? 0) * t + (s.data[o + 2] ?? 0) * (1 - t);
          s.data[o + 3] = 255;
        }
      }
    }
  }
}

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['111', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '111', '100', '111'],
  F: ['111', '100', '111', '100', '100'],
  G: ['111', '100', '101', '101', '111'],
  H: ['101', '101', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '111'],
  K: ['101', '101', '110', '101', '101'],
  L: ['100', '100', '100', '100', '111'],
  M: ['101', '111', '111', '101', '101'],
  N: ['110', '101', '101', '101', '101'],
  O: ['111', '101', '101', '101', '111'],
  P: ['111', '101', '111', '100', '100'],
  Q: ['111', '101', '101', '111', '001'],
  R: ['111', '101', '111', '110', '101'],
  S: ['111', '100', '111', '001', '111'],
  T: ['111', '010', '010', '010', '010'],
  U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'],
  W: ['101', '101', '111', '111', '101'],
  X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'],
  Z: ['111', '001', '010', '100', '111'],
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  ' ': ['000', '000', '000', '000', '000'],
  '-': ['000', '000', '111', '000', '000'],
  '.': ['000', '000', '000', '000', '010'],
  ':': ['000', '010', '000', '010', '000'],
  '/': ['001', '001', '010', '100', '100'],
  '+': ['000', '010', '111', '010', '000'],
  '*': ['101', '010', '101', '000', '000'],
  '(': ['010', '100', '100', '100', '010'],
  ')': ['010', '001', '001', '001', '010'],
  '=': ['000', '111', '000', '111', '000'],
  '>': ['100', '010', '001', '010', '100'],
  '#': ['101', '111', '101', '111', '101'],
};

export function textWidth(str: string, scale: number): number {
  return str.length * 4 * scale - scale;
}

export function text(s: Sheet, str: string, x: number, y: number, rgb: Rgb, scale = 1): void {
  let cx = x;
  for (const ch of str.toUpperCase()) {
    const g = GLYPHS[ch] ?? GLYPHS['-']!;
    for (let row = 0; row < 5; row++) {
      const bits = g[row]!;
      for (let col = 0; col < 3; col++) {
        if (bits[col] !== '1') continue;
        fillRect(s, cx + col * scale, y + row * scale, scale, scale, rgb);
      }
    }
    cx += 4 * scale;
  }
}

export function save(path: string, s: Sheet): void {
  writePng(path, Buffer.from(s.data.buffer, s.data.byteOffset, s.data.length), s.w, s.h);
}
