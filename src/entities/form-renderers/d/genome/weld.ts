/**
 * weld：不相接的构件拉回最近构件。焊后可见身体四连通分量必须为 1。
 * 几何相接之后仍以像素四连通为准（团缺角、丝弯曲可能让包围盒相接但像素断开）。
 */
import { alphaAt, px, type PaintBuf } from '@/entities/form-renderers/d/genome/buffer';
import { DEFAULT_GENOME_INK, drawSkeleton, partBounds } from '@/entities/form-renderers/d/genome/parts';
import type { GenomeInk, GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

function aabbTouches(a: GenomeNode, b: GenomeNode): boolean {
  const A = partBounds(a);
  const B = partBounds(b);
  const overlapX = A.x < B.x + B.w && B.x < A.x + A.w;
  const overlapY = A.y < B.y + B.h && B.y < A.y + A.h;
  if (overlapX && overlapY) return true;
  const abutX = A.x === B.x + B.w || B.x === A.x + A.w;
  const abutY = A.y === B.y + B.h || B.y === A.y + A.h;
  return (abutX && overlapY) || (abutY && overlapX);
}

function clampPart(p: GenomeNode, canvasW: number, canvasH: number): void {
  const b = partBounds(p);
  let dx = 0;
  let dy = 0;
  if (b.x < 0) dx = -b.x;
  else if (b.x + b.w > canvasW) dx = canvasW - (b.x + b.w);
  if (b.y < 0) dy = -b.y;
  else if (b.y + b.h > canvasH) dy = canvasH - (b.y + b.h);
  p.x = Math.round(p.x + dx);
  p.y = Math.round(p.y + dy);
  p.w = Math.max(1, Math.round(p.w));
  p.h = Math.max(1, Math.round(p.h));
}

function pullToward(p: GenomeNode, q: GenomeNode): void {
  const A = partBounds(p);
  const B = partBounds(q);
  const dx = B.x + B.w / 2 - (A.x + A.w / 2);
  const dy = B.y + B.h / 2 - (A.y + A.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) {
    const gap = Math.abs(dx) - (A.w + B.w) / 2;
    p.x += Math.sign(dx) * Math.max(1, Math.round(gap));
  } else {
    const gap = Math.abs(dy) - (A.h + B.h) / 2;
    p.y += Math.sign(dy) * Math.max(1, Math.round(gap));
  }
  p.x = Math.round(p.x);
  p.y = Math.round(p.y);
}

/** 包围盒相接：不相接的拉向最近构件。 */
export function weld(sk: GenomeSkeleton): void {
  const { w, h } = sk.canvas;
  for (let pass = 0; pass < 8; pass++) {
    let moved = false;
    for (const p of sk.parts) {
      if (sk.parts.some((q) => q !== p && aabbTouches(p, q))) continue;
      let best: GenomeNode | null = null;
      let bestD = Infinity;
      for (const q of sk.parts) {
        if (q === p) continue;
        const A = partBounds(p);
        const B = partBounds(q);
        const d =
          (A.x + A.w / 2 - (B.x + B.w / 2)) ** 2 + (A.y + A.h / 2 - (B.y + B.h / 2)) ** 2;
        if (d < bestD) {
          bestD = d;
          best = q;
        }
      }
      if (!best) continue;
      pullToward(p, best);
      clampPart(p, w, h);
      moved = true;
    }
    if (!moved) return;
  }
}

export function countOpaque4Components(buf: PaintBuf): number {
  const seen = new Uint8Array(buf.w * buf.h);
  let n = 0;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const i = y * buf.w + x;
      if (seen[i] || alphaAt(buf, x, y) === 0) continue;
      n += 1;
      const stack = [i];
      seen[i] = 1;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        const cx = cur % buf.w;
        const cy = (cur / buf.w) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= buf.w || ny >= buf.h) continue;
          const ni = ny * buf.w + nx;
          if (seen[ni] || alphaAt(buf, nx, ny) === 0) continue;
          seen[ni] = 1;
          stack.push(ni);
        }
      }
    }
  }
  return n;
}

function labelOpaque4(buf: PaintBuf): { labels: Int32Array; sizes: number[] } {
  const labels = new Int32Array(buf.w * buf.h);
  labels.fill(-1);
  const sizes: number[] = [];
  let next = 0;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      const i = y * buf.w + x;
      if (labels[i] !== -1 || alphaAt(buf, x, y) === 0) continue;
      const id = next;
      next += 1;
      let size = 0;
      const stack = [i];
      labels[i] = id;
      while (stack.length > 0) {
        const cur = stack.pop()!;
        size += 1;
        const cx = cur % buf.w;
        const cy = (cur / buf.w) | 0;
        for (const [dx, dy] of DIRS) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= buf.w || ny >= buf.h) continue;
          const ni = ny * buf.w + nx;
          if (labels[ni] !== -1 || alphaAt(buf, nx, ny) === 0) continue;
          labels[ni] = id;
          stack.push(ni);
        }
      }
      sizes[id] = size;
    }
  }
  return { labels, sizes };
}

function largestId(sizes: readonly number[]): number {
  let best = 0;
  let bestN = -1;
  for (let i = 0; i < sizes.length; i++) {
    const n = sizes[i] ?? 0;
    if (n > bestN) {
      bestN = n;
      best = i;
    }
  }
  return best;
}

function centroidOf(buf: PaintBuf, labels: Int32Array, id: number): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (labels[y * buf.w + x] !== id) continue;
      sx += x;
      sy += y;
      n += 1;
    }
  }
  if (n === 0) return { x: buf.w / 2, y: buf.h / 2 };
  return { x: sx / n, y: sy / n };
}

function partInComponent(p: GenomeNode, buf: PaintBuf, labels: Int32Array, id: number): boolean {
  const b = partBounds(p);
  const x0 = Math.max(0, Math.floor(b.x));
  const y0 = Math.max(0, Math.floor(b.y));
  const x1 = Math.min(buf.w, Math.ceil(b.x + b.w));
  const y1 = Math.min(buf.h, Math.ceil(b.y + b.h));
  let owned = 0;
  let inMain = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (alphaAt(buf, x, y) === 0) continue;
      owned += 1;
      if (labels[y * buf.w + x] === id) inMain += 1;
    }
  }
  return owned === 0 || inMain === owned;
}

function colorAt(buf: PaintBuf, x: number, y: number): readonly [number, number, number, number] {
  const i = (y * buf.w + x) * 4;
  return [buf.data[i] ?? 0, buf.data[i + 1] ?? 0, buf.data[i + 2] ?? 0, buf.data[i + 3] ?? 255];
}

function paintOrtho(buf: PaintBuf, x0: number, y0: number, x1: number, y1: number): void {
  const c = colorAt(buf, x1, y1);
  let x = x0;
  let y = y0;
  while (x !== x1 || y !== y1) {
    if (x !== x1) x += Math.sign(x1 - x);
    else y += Math.sign(y1 - y);
    px(buf, x, y, c);
  }
}

function bridgeIslands(buf: PaintBuf): void {
  for (let pass = 0; pass < 16; pass++) {
    const { labels, sizes } = labelOpaque4(buf);
    if (sizes.length <= 1) return;
    const main = largestId(sizes);
    const island: Array<{ x: number; y: number }> = [];
    const hub: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < buf.h; y++) {
      for (let x = 0; x < buf.w; x++) {
        const id = labels[y * buf.w + x] ?? -1;
        if (id < 0) continue;
        if (id === main) hub.push({ x, y });
        else island.push({ x, y });
      }
    }
    if (island.length === 0 || hub.length === 0) return;
    let bestD = Infinity;
    let pair: { ix: number; iy: number; mx: number; my: number } | null = null;
    for (const a of island) {
      for (const b of hub) {
        const d = (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
        if (d < bestD) {
          bestD = d;
          pair = { ix: a.x, iy: a.y, mx: b.x, my: b.y };
        }
      }
    }
    if (!pair) return;
    paintOrtho(buf, pair.ix, pair.iy, pair.mx, pair.my);
  }
}

function pullIslands(sk: GenomeSkeleton, buf: PaintBuf): void {
  const { labels, sizes } = labelOpaque4(buf);
  if (sizes.length <= 1) return;
  const main = largestId(sizes);
  const target = centroidOf(buf, labels, main);
  for (const p of sk.parts) {
    if (partInComponent(p, buf, labels, main)) continue;
    const b = partBounds(p);
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const dx = target.x - cx;
    const dy = target.y - cy;
    if (Math.abs(dx) >= Math.abs(dy)) p.x += Math.sign(dx) || 1;
    else p.y += Math.sign(dy) || 1;
    p.x = Math.round(p.x);
    p.y = Math.round(p.y);
    clampPart(p, sk.canvas.w, sk.canvas.h);
  }
}

/**
 * 几何 weld → 绘制 → 若像素四连通仍 > 1 则再拉岛。
 * 返回焊后可见身体。空骨架分量是 0，调用方不要当成品。
 */
export function paintWeldedBody(sk: GenomeSkeleton, colors: GenomeInk = DEFAULT_GENOME_INK): PaintBuf {
  weld(sk);
  let buf = drawSkeleton(sk, colors);
  for (let pass = 0; pass < 32 && countOpaque4Components(buf) > 1; pass++) {
    pullIslands(sk, buf);
    weld(sk);
    buf = drawSkeleton(sk, colors);
  }
  if (countOpaque4Components(buf) > 1) bridgeIslands(buf);
  return buf;
}
