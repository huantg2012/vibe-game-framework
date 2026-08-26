/**
 * I5-G：残茎骨架语法。
 * 3–6 根竖杆聚在共享着地点，顶可碎。签名是丛与茎间空隙，不是一根粗柱，不是一条分节身体。
 * 算子 / weld / 漆由调用方按合同顺序接：applyOperators → weld → 刷漆。
 */
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import { genomeCanvasOf } from '@/entities/form-renderers/d/genome/canvas';
import { applyOperators } from '@/entities/form-renderers/d/genome/operators';
import { paintWeldedBody } from '@/entities/form-renderers/d/genome/weld';
import type { PaintBuf } from '@/entities/form-renderers/d/genome/buffer';
import type { GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { Facing4 } from '@/types/game-types';

export const STALK_CLUMP_ID = 'stalk_clump' as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 茎数 / 丛宽 / 一侧加密都是连续采样，禁止用种子对基体取模切身份。
 * 茎高吃画布高度，渗透与改写不会只是整丛下移。
 */
function layoutStalkNodes(w: number, h: number, seed: number): GenomeNode[] {
  const rng = new SeededRandom(mix32(seed, 'stalk_clump:layout'));
  const stemAmt = rng.next();
  const stemCount = 3 + Math.round(stemAmt * 3);
  const lean = rng.nextInt(0, 3);
  const leanDir = rng.next() < 0.5 ? -1 : 1;
  const denseAmt = rng.next();
  const denseSide = rng.next() < 0.5 ? -1 : 1;
  const debrisAmt = rng.next();
  const baseGap = rng.nextInt(1, 3);
  const widths = Array.from({ length: stemCount }, () => rng.nextInt(1, 3));

  const groundY = h - 1;
  const plateH = 2;
  const plateY = groundY - plateH;
  const headroom = rng.nextInt(2, 4);
  const maxStemH = Math.max(8, plateY - headroom);
  const stemH = rng.nextInt(Math.max(7, Math.floor(maxStemH * 0.62)), maxStemH);

  const xs: number[] = [];
  let cursor = 0;
  for (let i = 0; i < stemCount; i++) {
    const t = stemCount === 1 ? 0.5 : i / (stemCount - 1);
    const onDense = (denseSide < 0 && t < 0.55) || (denseSide > 0 && t > 0.45);
    const gap = i === 0 ? 0 : onDense ? Math.max(1, baseGap - 1) : baseGap + (denseAmt > 0.55 ? 1 : 0);
    cursor += gap;
    xs.push(cursor);
    cursor += widths[i]!;
  }
  const span = cursor;
  const cx = clamp(Math.floor(w / 2) + rng.nextInt(-1, 1), 6, w - 7);
  const shift = cx - Math.floor(span / 2);
  for (let i = 0; i < xs.length; i++) {
    xs[i] = clamp(xs[i]! + shift, 1, Math.max(1, w - widths[i]! - 1));
  }
  if (new Set(xs).size < 2 && xs.length >= 2) {
    xs[xs.length - 1] = clamp(xs[0]! + widths[0]! + 1, 1, w - widths[xs.length - 1]! - 1);
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs.map((x, i) => x + widths[i]!));
  const plateX = clamp(minX - 1, 0, w - 4);
  const plateW = clamp(maxX - plateX + 1, 4, w - plateX);

  const parts: GenomeNode[] = [
    {
      kind: 'plate',
      x: plateX,
      y: plateY,
      w: plateW,
      h: plateH,
      mat: 'earth',
      role: 'base',
    },
  ];

  const addStem = (x: number, width: number, height: number, mat: GenomeNode['mat']): number => {
    const thisH = clamp(height, 6, maxStemH);
    const postTop = clamp(plateY - thisH + 1, 1, plateY - 5);
    const postH = plateY - postTop + 2;
    const px = clamp(x, 0, w - width);
    if (lean === 0) {
      parts.push({
        kind: 'post',
        x: px,
        y: postTop,
        w: width,
        h: postH,
        mat,
        role: 'spine',
      });
      return postTop;
    }
    const upperH = Math.max(3, Math.floor(postH * 0.42));
    const lowerH = postH - upperH + 1;
    const upperX = clamp(px + leanDir * lean, 0, w - width);
    parts.push({
      kind: 'post',
      x: px,
      y: postTop + upperH - 1,
      w: width,
      h: lowerH,
      mat,
      role: 'spine',
    });
    parts.push({
      kind: 'post',
      x: upperX,
      y: postTop,
      w: width,
      h: upperH,
      mat: 'bone',
      role: 'spine',
    });
    return postTop;
  };

  const tops: number[] = [];
  for (let i = 0; i < stemCount; i++) {
    const jitter = rng.nextInt(-2, 2);
    const mat: GenomeNode['mat'] = rng.next() < 0.4 ? 'bone' : 'cloth';
    tops.push(addStem(xs[i]!, widths[i]!, stemH + jitter, mat));
  }

  const debrisCount = Math.round(debrisAmt * stemCount);
  for (let i = 0; i < debrisCount; i++) {
    const idx = i % stemCount;
    const nw = rng.nextInt(1, 2);
    const nh = rng.nextInt(1, 2);
    parts.push({
      kind: 'nub',
      x: clamp(xs[idx]! + (widths[idx]! > 1 ? rng.nextInt(0, 1) : 0), 0, w - nw),
      y: clamp(tops[idx]! - nh + 1, 0, h - nh),
      w: nw,
      h: nh,
      mat: 'bone',
      role: 'accent',
    });
  }

  const coreW = 1;
  const mid = Math.floor(stemCount / 2);
  parts.push({
    kind: 'core',
    x: clamp(xs[mid]! + (leanDir > 0 ? widths[mid]! : -coreW + 1), 0, w - coreW),
    y: clamp(tops[mid]! + rng.nextInt(1, 3), 0, h - coreW),
    w: coreW,
    h: coreW,
    mat: 'glow',
    role: 'accent',
  });

  return parts;
}

/**
 * 按朝向摆丛：底座不动，茎朝面向侧移。
 * `down` 保持原采样，避免改坏去重闸门。禁止整图画布转 90°。
 */
function poseStalkClumpFacing(parts: GenomeNode[], w: number, facing: Facing4): void {
  if (facing !== 'left' && facing !== 'right') return;
  const dx = facing === 'left' ? -2 : 2;
  for (const p of parts) {
    if (p.role === 'base') continue;
    p.x = clamp(p.x + dx, 0, Math.max(0, w - p.w));
  }
}

export function buildStalkClumpSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  facing4: Facing4 = 'down',
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  const parts = layoutStalkNodes(canvas.w, canvas.h, seed);
  poseStalkClumpFacing(parts, canvas.w, facing4);
  return {
    canvas,
    parts,
  };
}

/** 算子 → weld → 漆。给闸门与练习场同一条管线。 */
export function paintStalkClumpBody(
  coverage: CoverageId,
  seed: number,
  sense?: string,
): PaintBuf {
  const sk = buildStalkClumpSkeleton(coverage, seed, sense);
  applyOperators(sk, coverage, seed);
  return paintWeldedBody(sk);
}
