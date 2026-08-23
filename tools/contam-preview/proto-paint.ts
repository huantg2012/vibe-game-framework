/**
 * PROTOTYPE painter for 构件骨架. Preview tooling only.
 *
 * The contamination layer here is deliberately the SAME language the shipped
 * 甲 uses (deep on the broken side, core clusters, mid spray, data holes) so
 * the sheets isolate one variable: where the outline comes from.
 */

import type { JiaBodyColors } from '@/entities/form-renderers/d/jia-recipe';
import { Rng, type MatKey, type Part, type Skeleton } from './proto-skeleton';

export interface Buf {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

type Rgba = readonly [number, number, number, number];

export function makeBuf(w: number, h: number): Buf {
  return { data: new Uint8ClampedArray(w * h * 4), w, h };
}

function put(b: Buf, x: number, y: number, c: Rgba): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= b.w || iy >= b.h) return;
  const o = (iy * b.w + ix) * 4;
  b.data[o] = c[0];
  b.data[o + 1] = c[1];
  b.data[o + 2] = c[2];
  b.data[o + 3] = c[3];
}

function clear(b: Buf, x: number, y: number): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= b.w || iy >= b.h) return;
  const o = (iy * b.w + ix) * 4;
  b.data[o] = 0;
  b.data[o + 1] = 0;
  b.data[o + 2] = 0;
  b.data[o + 3] = 0;
}

function alphaAt(b: Buf, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= b.w || y >= b.h) return 0;
  return b.data[(y * b.w + x) * 4 + 3] ?? 0;
}

function rect(b: Buf, x: number, y: number, w: number, h: number, c: Rgba): void {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(b, x + i, y + j, c);
}

function ink(colors: JiaBodyColors, mat: MatKey): Rgba {
  return colors[mat] as Rgba;
}

export function drawPart(b: Buf, p: Part, colors: JiaBodyColors): void {
  const c = ink(colors, p.mat);
  const shadow = ink(colors, 'shadow');
  switch (p.kind) {
    case 'post': {
      rect(b, p.x, p.y, p.w, p.h, c);
      if (p.w >= 3) for (let j = 0; j < p.h; j++) put(b, p.x + p.w - 1, p.y + j, shadow);
      return;
    }
    case 'beam':
    case 'plate': {
      rect(b, p.x, p.y, p.w, p.h, c);
      if (p.h >= 2) for (let i = 0; i < p.w; i++) put(b, p.x + i, p.y + p.h - 1, shadow);
      return;
    }
    case 'mass': {
      rect(b, p.x, p.y, p.w, p.h, c);
      for (let i = 0; i < p.w; i++) put(b, p.x + i, p.y, ink(colors, 'bone'));
      clear(b, p.x, p.y);
      clear(b, p.x + p.w - 1, p.y);
      clear(b, p.x, p.y + p.h - 1);
      clear(b, p.x + p.w - 1, p.y + p.h - 1);
      return;
    }
    case 'filament': {
      const bend = p.bend ?? 0;
      for (let j = 0; j < p.h; j++) {
        const t = p.h <= 1 ? 0 : j / (p.h - 1);
        const dx = Math.round(bend * t);
        for (let i = 0; i < p.w; i++) put(b, p.x + dx + i, p.y + j, c);
      }
      return;
    }
    case 'nub': {
      rect(b, p.x, p.y, p.w, p.h, c);
      return;
    }
    case 'core': {
      rect(b, p.x, p.y, p.w, p.h, ink(colors, 'glow'));
      return;
    }
  }
}

export function drawSkeleton(sk: Skeleton, colors: JiaBodyColors): Buf {
  const b = makeBuf(sk.w, sk.h);
  const order: Part['role'][] = ['base', 'spine', 'rib', 'limb', 'head', 'lintel', 'accent'];
  for (const role of order) {
    for (const p of sk.parts) if (p.role === role) drawPart(b, p, colors);
  }
  for (const p of sk.parts) if (!p.role) drawPart(b, p, colors);
  return b;
}

interface Pt {
  readonly x: number;
  readonly y: number;
}

function opaque(b: Buf): Pt[] {
  const out: Pt[] = [];
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) if (alphaAt(b, x, y) !== 0) out.push({ x, y });
  return out;
}

function centroidX(pts: readonly Pt[], fallback: number): number {
  if (pts.length === 0) return fallback;
  let s = 0;
  for (const p of pts) s += p.x;
  return s / pts.length;
}

function isOutline(b: Buf, x: number, y: number): boolean {
  if (alphaAt(b, x, y) === 0) return false;
  return (
    alphaAt(b, x - 1, y) === 0 ||
    alphaAt(b, x + 1, y) === 0 ||
    alphaAt(b, x, y - 1) === 0 ||
    alphaAt(b, x, y + 1) === 0
  );
}

function isInterior(b: Buf, x: number, y: number): boolean {
  return (
    alphaAt(b, x - 1, y) !== 0 &&
    alphaAt(b, x + 1, y) !== 0 &&
    alphaAt(b, x, y - 1) !== 0 &&
    alphaAt(b, x, y + 1) !== 0
  );
}

/** Same paint language as production 甲. Only the outline underneath is new. */
export function paintContamination(
  b: Buf,
  coverage: 'infiltrate' | 'rewrite' | 'overwrite',
  colors: JiaBodyColors,
  seed: number,
): void {
  const rng = new Rng(seed, `paint:${coverage}`);
  const pts = opaque(b);
  if (pts.length === 0) return;
  const cx = centroidX(pts, b.w / 2);
  const broken = (p: Pt): boolean => p.x > cx + 1;

  if (coverage === 'infiltrate') {
    for (let i = 0; i < 6; i++) {
      const p = pts[rng.int(0, pts.length - 1)]!;
      put(b, p.x, p.y, (i === 2 || i === 4 ? colors.cold : colors.core) as Rgba);
    }
    return;
  }

  // 崩坏侧铺 deep，留基体透出来（不整片糊掉，剪影结构才读得出）。
  // 数据孔只打在内部像素上：规则栅格打在外沿会读成排线阴影。
  const soak = coverage === 'overwrite' ? 0.82 : 0.58;
  for (const p of pts) {
    if (!broken(p)) continue;
    if (isInterior(b, p.x, p.y) && rng.next() < 0.14) {
      clear(b, p.x, p.y);
      continue;
    }
    if (rng.next() > soak) continue;
    put(b, p.x, p.y, colors.deep as Rgba);
  }

  if (coverage === 'overwrite') {
    for (const p of pts) {
      if (broken(p)) continue;
      if (!isInterior(b, p.x, p.y)) continue;
      if (rng.next() < 0.34) clear(b, p.x, p.y);
    }
  }

  const pool = pts.filter(broken);
  const src = pool.length > 8 ? pool : pts;
  const total = coverage === 'overwrite' ? 32 : 17;
  const groups = coverage === 'overwrite' ? [12, 12, 8] : [7, 6, 4];
  const painted: Pt[] = [];
  for (const want of groups) {
    const center = src[rng.int(0, src.length - 1)]!;
    const near = [...src].sort(
      (a, c) => (a.x - center.x) ** 2 + (a.y - center.y) ** 2 - ((c.x - center.x) ** 2 + (c.y - center.y) ** 2),
    );
    for (const p of near.slice(0, want)) {
      if (painted.length >= total) break;
      painted.push(p);
      put(b, p.x, p.y, colors.core as Rgba);
    }
    put(b, center.x, center.y, colors.glow as Rgba);
  }

  if (coverage !== 'overwrite') return;
  let n = 0;
  for (const p of pts) {
    if (n >= 18) break;
    if (!isOutline(b, p.x, p.y) || !broken(p)) continue;
    if (rng.next() < 0.45) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
    ] as const) {
      if (alphaAt(b, p.x + dx, p.y + dy) !== 0) continue;
      put(b, p.x + dx, p.y + dy, colors.mid as Rgba);
      n += 1;
      break;
    }
  }
}
