/**
 * I5-M：大号蠕虫骨架语法。
 * 无足、分节长条。4–8 节沿画面 X 相接成一条身体（永远横躺）。
 * 不是残茎那种共享着地点的竖茎丛；长出足就变成虫，有四足就变成哺乳动物。
 * 节宽 3–6px、轴倾 0–2px、某处加粗。朝向只换头端；贴地高低最多 ±1px。
 * 排节后整条（含干环/核）钉到画布原点，不立图腾，不把身体扔到画布上下缘。
 * 基体侧分节 / 干环（bone / concrete / metal）。禁止黏膜、流体尾、湿肉边。
 * 算子 / weld / 漆由调用方按合同顺序接：applyOperators → weld → 刷漆。
 */
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import { genomeCanvasOf } from '@/entities/form-renderers/d/genome/canvas';
import { applyOperators } from '@/entities/form-renderers/d/genome/operators';
import { paintWeldedBody } from '@/entities/form-renderers/d/genome/weld';
import type { PaintBuf } from '@/entities/form-renderers/d/genome/buffer';
import type { GenomeCanvas, GenomeMat, GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { Facing4 } from '@/types/game-types';

export const WORM_REMNANT_ID = 'worm_remnant' as const;

const BODY_MATS: readonly GenomeMat[] = ['bone', 'concrete', 'metal'];
const RING_MATS: readonly GenomeMat[] = ['bone', 'metal', 'metalMid'];

const SEG_MIN = 4;
const SEG_MAX = 8;
const CROSS_MIN = 3;
const CROSS_MAX = 6;
const OVERLAP = 1;
const GAIT_PAD = 3;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function pickMat(rng: SeededRandom, pool: readonly GenomeMat[]): GenomeMat {
  const t = rng.next();
  if (t < 0.34) return pool[0]!;
  if (t < 0.67) return pool[1]!;
  return pool[2]!;
}

function sampleSegCount(rng: SeededRandom): number {
  return clamp(4 + rng.nextInt(0, 4), SEG_MIN, SEG_MAX);
}

function totalAlong(sizes: readonly number[]): number {
  if (sizes.length === 0) return 0;
  return sizes.reduce((s, v) => s + v, 0) - (sizes.length - 1) * OVERLAP;
}

function sampleAlongSizes(n: number, avail: number, rng: SeededRandom): number[] {
  const sizes = Array.from({ length: n }, () => rng.nextInt(3, 6));
  let guard = 0;
  while (totalAlong(sizes) > avail && guard++ < 32) {
    const i = sizes.findIndex((v) => v > 3);
    if (i < 0) break;
    sizes[i]! -= 1;
  }
  const lo = totalAlong(sizes);
  const target = Math.min(avail, Math.max(lo, Math.floor(avail * (0.58 + rng.next() * 0.28))));
  guard = 0;
  while (totalAlong(sizes) < target && guard++ < 24) {
    const i = rng.nextInt(0, n - 1);
    if (sizes[i]! >= 6) continue;
    sizes[i]! += 1;
    if (totalAlong(sizes) > avail) {
      sizes[i]! -= 1;
      break;
    }
  }
  return sizes;
}

function placeFromHead(sizes: readonly number[], headAtLow: boolean, lo: number, hi: number): number[] {
  const out: number[] = [];
  if (headAtLow) {
    let c = lo;
    for (const sz of sizes) {
      out.push(c);
      c += sz - OVERLAP;
    }
    return out;
  }
  let c = hi;
  for (const sz of sizes) {
    c -= sz;
    out.push(c);
    c += OVERLAP;
  }
  return out;
}

function partsBox(parts: readonly GenomeNode[]): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of parts) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.w - 1);
    y1 = Math.max(y1, p.y + p.h - 1);
  }
  return { x0, y0, x1, y1 };
}

function translateParts(parts: GenomeNode[], dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  for (const p of parts) {
    p.x += dx;
    p.y += dy;
  }
}

/**
 * 不透明包围盒中心钉到碰撞原点。朝上/朝下相对原点最多 ±1px，禁止扔到画布上下缘。
 * 头左/头右绕该点翻转，禁止整条在 X 上搬家。
 */
function pinWormPartsToOrigin(parts: GenomeNode[], originX: number, originY: number, facing: Facing4): void {
  if (parts.length === 0) return;
  const box = partsBox(parts);
  const cx = (box.x0 + box.x1) / 2;
  const cy = (box.y0 + box.y1) / 2;
  const dx = Math.round(originX - cx);
  let dy = Math.round(originY - cy);
  if (facing === 'up') dy -= 1;
  if (facing === 'down') dy += 1;
  translateParts(parts, dx, dy);
}

/**
 * 永远横躺：节沿画面 X 相接。朝左头在左、朝右头在右。
 * 禁止 up/down 改成竖排。禁止事后整图画布旋转。禁止把横条扔到画布上缘或下缘。
 */
function layoutWormNodes(canvas: GenomeCanvas, seed: number, facing: Facing4): GenomeNode[] {
  const w = canvas.w;
  const h = canvas.h;
  const rng = new SeededRandom(mix32(seed, 'worm_remnant:layout'));
  const n = sampleSegCount(rng);
  const tilt = rng.nextInt(0, 2);
  const leanDir = rng.next() < 0.5 ? -1 : 1;
  const thickI = rng.nextInt(0, n - 1);
  const thickExtra = 1 + (rng.next() < 0.45 ? 1 : 0);
  const rodAmt = rng.next();
  const ringAmt = rng.next();
  const ringCount = ringAmt < 0.22 ? 0 : ringAmt < 0.7 ? 1 : 2;
  const baseCross = rng.nextInt(CROSS_MIN, 5);

  const alongPad = 2;
  const availAlong = Math.max(10, w - alongPad * 2);
  const alongs = sampleAlongSizes(n, availAlong, rng);
  alongs[0] = clamp(alongs[0]! + (rng.next() < 0.5 ? 1 : 0), 3, 6);
  if (totalAlong(alongs) > availAlong) alongs[0] = clamp(alongs[0]! - 1, 3, 6);

  const crosses = Array.from({ length: n }, (_, i) => {
    const extra = i === thickI ? thickExtra : 0;
    return clamp(baseCross + extra, CROSS_MIN, CROSS_MAX);
  });

  const span = totalAlong(alongs);
  const alongLo = clamp(Math.round((w - span) / 2), 0, Math.max(0, w - span));
  const alongHi = alongLo + span;
  const headAtLow = facing === 'left' || facing === 'up';
  const origins = placeFromHead(alongs, headAtLow, alongLo, alongHi);

  const centerY = canvas.originY;

  const parts: GenomeNode[] = [];
  const segs: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const perp = Math.round(tilt * leanDir * (t - 0.5) * 2);
    const along = origins[i]!;
    const y = clamp(
      centerY - Math.floor(crosses[i]! / 2) + perp,
      GAIT_PAD,
      Math.max(GAIT_PAD, h - crosses[i]! - 1),
    );
    const sw = alongs[i]!;
    const sh = crosses[i]!;
    const px = clamp(along, 0, w - sw);
    const py = clamp(y, 0, h - sh);
    const asRod = rodAmt > 0.55 ? i % 2 === 1 : rodAmt > 0.28 && i !== 0 && i !== thickI;
    parts.push({
      kind: asRod ? 'post' : 'mass',
      x: px,
      y: py,
      w: sw,
      h: sh,
      mat: pickMat(rng, BODY_MATS),
      role: i === 0 ? 'head' : 'spine',
    });
    segs.push({ x: px, y: py, w: sw, h: sh });
  }

  for (let i = 0; i < n - 1; i++) {
    const a = segs[i]!;
    const b = segs[i + 1]!;
    const jx = Math.min(a.x + a.w, b.x + b.w) - 1;
    const jy0 = Math.max(a.y, b.y);
    const jy1 = Math.min(a.y + a.h, b.y + b.h);
    const jh = Math.max(2, jy1 - jy0);
    parts.push({
      kind: 'post',
      x: clamp(jx, 0, w - 1),
      y: clamp(jy0, 0, h - jh),
      w: 1,
      h: jh,
      mat: pickMat(rng, RING_MATS),
      role: 'accent',
    });
  }

  if (ringCount > 0) {
    const used = new Set<number>();
    for (let r = 0; r < ringCount; r++) {
      let idx = rng.nextInt(0, n - 1);
      if (used.has(idx)) idx = (idx + 1) % n;
      used.add(idx);
      const s = segs[idx]!;
      const rw = Math.max(2, s.w - 2);
      parts.push({
        kind: 'beam',
        x: clamp(s.x + 1, 0, w - rw),
        y: clamp(s.y + Math.floor(s.h / 2), 0, h - 1),
        w: rw,
        h: 1,
        mat: pickMat(rng, RING_MATS),
        role: 'accent',
      });
    }
  }

  const head = segs[0]!;
  parts.push({
    kind: 'core',
    x: clamp(head.x + Math.floor(head.w / 2), 0, w - 1),
    y: clamp(head.y + Math.max(1, Math.floor(head.h / 2)), 0, h - 1),
    w: 1,
    h: 1,
    mat: 'glow',
    role: 'accent',
  });

  pinWormPartsToOrigin(parts, canvas.originX, canvas.originY, facing);
  return parts;
}

export function buildWormRemnantSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  facing4: Facing4 = 'down',
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  return {
    canvas,
    parts: layoutWormNodes(canvas, seed, facing4),
  };
}

/** 算子 → weld → 漆。给闸门与练习场同一条管线。 */
export function paintWormRemnantBody(
  coverage: CoverageId,
  seed: number,
  sense?: string,
): PaintBuf {
  const sk = buildWormRemnantSkeleton(coverage, seed, sense);
  applyOperators(sk, coverage, seed);
  return paintWeldedBody(sk);
}
