/**
 * I5-F：门框骨架语法。
 * 左右各一根杆 + 顶上一根梁，围出中空开口。可选楣（梁上的扁团）。
 * 签名是洞，不是实心竖杆。禁止画成街具残骸那种单杆+座。
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

export const DOORFRAME_ID = 'doorframe' as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 完整度是连续采样邻域，禁止用种子对基体取模切成三个剪影身份。
 * 低 integrity → 更缺一柱；高 integrity + 楣 → 更楣沉。满框是中间带。邻域可叠。
 */
function layoutDoorNodes(w: number, h: number, seed: number): GenomeNode[] {
  const rng = new SeededRandom(mix32(seed, 'doorframe:layout'));
  const jamb = rng.nextInt(2, 4);
  let gap = rng.nextInt(6, 12);
  const beamH = rng.nextInt(1, 2);
  const lintelH = rng.nextInt(2, 4);
  const integrity = rng.next();
  const lintelBias = rng.next();
  const dropSide = rng.next();
  const dropPost = integrity < 0.34;
  const hasLintel = lintelBias > 0.28 || integrity > 0.55;
  const sink =
    hasLintel && integrity > 0.62 ? rng.nextInt(1, 3) : hasLintel ? rng.nextInt(0, 1) : 0;
  const dropLeft = dropSide < 0.5;

  const maxSpan = w - 2;
  while (jamb * 2 + gap > maxSpan && gap > 6) gap -= 1;
  const span = jamb * 2 + gap;
  const cx = clamp(Math.floor(w / 2) + rng.nextInt(-1, 1), Math.ceil(span / 2) + 1, w - Math.ceil(span / 2) - 1);
  const xL = clamp(cx - Math.floor(span / 2), 1, Math.max(1, w - span - 1));
  const xR = xL + jamb + gap;

  const groundY = h - 1;
  const headroom = rng.nextInt(2, 4);
  const lintelClear = hasLintel ? Math.max(0, lintelH - 1) : 0;
  const beamY = clamp(headroom + lintelClear, 1, Math.max(2, h - 16));
  const postTop = beamY;
  const postH = Math.max(10, groundY - postTop + 1);
  const beamW = span;
  const keepLeft = !dropPost || !dropLeft;
  const keepRight = !dropPost || dropLeft;

  const parts: GenomeNode[] = [];

  const addJamb = (x: number, mat: GenomeNode['mat']): void => {
    parts.push({
      kind: 'post',
      x,
      y: postTop,
      w: jamb,
      h: postH,
      mat,
      role: 'spine',
    });
  };

  if (keepLeft) addJamb(xL, 'brick');
  if (keepRight) addJamb(xR, 'metal');

  parts.push({
    kind: 'beam',
    x: xL,
    y: beamY,
    w: beamW,
    h: beamH,
    mat: 'metalMid',
    role: 'rib',
  });

  if (hasLintel) {
    const lw = clamp(beamW - rng.nextInt(0, 2), 4, beamW);
    const lx = clamp(xL + Math.floor((beamW - lw) / 2), 0, w - lw);
    const rawY = beamY - (lintelH - 1) + sink;
    const ly = clamp(rawY, Math.max(0, beamY - lintelH + 1), beamY + beamH - 1);
    parts.push({
      kind: 'mass',
      x: lx,
      y: ly,
      w: lw,
      h: lintelH,
      mat: 'concrete',
      role: 'lintel',
    });
  }

  const host = parts.find((p) => p.kind === 'post') ?? parts[0]!;
  if (rng.next() > 0.42) {
    const nw = rng.nextInt(1, 2);
    const nh = rng.nextInt(1, 2);
    const outer = host.x <= xL;
    parts.push({
      kind: 'nub',
      x: clamp(outer ? host.x - (nw - 1) : host.x + host.w - 1, 0, w - nw),
      y: clamp(host.y + rng.nextInt(2, Math.max(3, Math.floor(host.h * 0.45))), 0, h - nh),
      w: nw,
      h: nh,
      mat: 'bone',
      role: 'accent',
    });
  }

  const coreW = rng.nextInt(1, 2);
  const outerCore = host.x <= xL;
  parts.push({
    kind: 'core',
    x: clamp(outerCore ? host.x - coreW + 1 : host.x + host.w - 1, 0, w - coreW),
    y: clamp(host.y + rng.nextInt(1, Math.max(2, Math.floor(host.h * 0.28))), 0, h - coreW),
    w: coreW,
    h: coreW,
    mat: 'glow',
    role: 'accent',
  });

  return parts;
}

/**
 * 按朝向摆框：开口仍在两柱之间，近侧柱加厚、框整体朝面向平移。
 * 仍是杆+梁围洞，不是新构件、不是侧视单杆。`down`/`up` 保持原采样。
 */
function poseDoorframeFacing(parts: GenomeNode[], w: number, facing: Facing4): void {
  if (facing !== 'left' && facing !== 'right') return;
  const dx = facing === 'left' ? -2 : 2;
  for (const p of parts) {
    p.x = clamp(p.x + dx, 0, Math.max(0, w - p.w));
  }
  const posts = parts.filter((p) => p.kind === 'post').sort((a, b) => a.x - b.x);
  if (posts.length === 0) return;
  const near = facing === 'left' ? posts[0]! : posts[posts.length - 1]!;
  const far = facing === 'left' ? posts[posts.length - 1]! : posts[0]!;
  if (near.w < 5) {
    if (facing === 'right') near.x = clamp(near.x - 1, 0, w - (near.w + 1));
    near.w += 1;
    if (near.x + near.w > w) near.x = w - near.w;
  }
  if (far !== near && far.w > 2) {
    if (facing === 'left') far.x = clamp(far.x + 1, 0, w - (far.w - 1));
    far.w -= 1;
  }
  for (const c of parts) {
    if (c.kind !== 'core') continue;
    c.x = clamp(near.x + Math.floor((near.w - c.w) / 2), 0, w - c.w);
  }
}

export function buildDoorframeSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  facing4: Facing4 = 'down',
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  const parts = layoutDoorNodes(canvas.w, canvas.h, seed);
  poseDoorframeFacing(parts, canvas.w, facing4);
  return {
    canvas,
    parts,
  };
}

/** 算子 → weld → 漆。给闸门与练习场同一条管线。 */
export function paintDoorframeBody(
  coverage: CoverageId,
  seed: number,
  sense?: string,
): PaintBuf {
  const sk = buildDoorframeSkeleton(coverage, seed, sense);
  applyOperators(sk, coverage, seed);
  return paintWeldedBody(sk);
}
