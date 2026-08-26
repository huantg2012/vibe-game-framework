/**
 * I5-E：街具残骸骨架语法。
 * 竖杆 + 底座骨干。灯柱 / 栏柱 / 标牌杆是共用参数上的种子邻域，不是三条 if、不是三个基体。
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

export const STREET_WRECKAGE_ID = 'street_wreckage' as const;

/** 灯柱 / 栏柱 / 标牌杆邻域。与 layout 同一套 spread / lift，不是三条 if 剪影。 */
export type StreetWreckageNeighborhoodId = 'lamp' | 'rail' | 'sign';

export const STREET_WRECKAGE_NEIGHBORHOODS: readonly StreetWreckageNeighborhoodId[] = [
  'lamp',
  'rail',
  'sign',
];

export const STREET_WRECKAGE_NEIGHBORHOOD_LABEL: Record<StreetWreckageNeighborhoodId, string> = {
  lamp: '灯柱',
  rail: '栏柱',
  sign: '标牌杆',
};

export interface StreetWreckageAxes {
  readonly spread: number;
  readonly lift: number;
}

/**
 * 复现 `layoutStreetNodes` 前七次抽样（五次 nextInt + spread + lift）。
 * 禁止改 layout 怎么长；本函数只给目录选种子 / 闸门核对。
 */
export function sampleStreetAxes(seed: number): StreetWreckageAxes {
  const rng = new SeededRandom(mix32(seed, 'street_wreckage:layout'));
  rng.nextInt(2, 5);
  rng.nextInt(0, 2);
  rng.nextInt(1, 2);
  rng.nextInt(2, 4);
  rng.nextInt(0, 2);
  return { spread: rng.next(), lift: rng.next() };
}

/** spread 高 → 栏柱；lift 高 → 灯柱顶团；lift 中段 → 标牌扁团。可重叠。 */
export function streetHoodsFromAxes(axes: StreetWreckageAxes): ReadonlySet<StreetWreckageNeighborhoodId> {
  const out = new Set<StreetWreckageNeighborhoodId>();
  if (axes.lift > 0.62) out.add('lamp');
  if (axes.spread > 0.58) out.add('rail');
  if (axes.lift > 0.28 && axes.lift < 0.78) out.add('sign');
  if (out.size === 0) out.add('rail');
  return out;
}

export function streetNeighborhoodsOf(seed: number): ReadonlySet<StreetWreckageNeighborhoodId> {
  return streetHoodsFromAxes(sampleStreetAxes(seed));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 邻域轴是连续采样，禁止用种子对基体取模切成三个剪影身份。
 * spread 高 → 更栏柱（第二根杆、更宽座、更多梁）；lift 高 → 更灯柱顶团；lift 中段 → 更标牌扁团。
 * 三个名字是重叠区域，用来检查厅里看得到三种街具残法。
 */
function layoutStreetNodes(w: number, h: number, seed: number): GenomeNode[] {
  const rng = new SeededRandom(mix32(seed, 'street_wreckage:layout'));
  const postW = rng.nextInt(2, 5);
  const lean = rng.nextInt(0, 2);
  const beamH = rng.nextInt(1, 2);
  const plateH = rng.nextInt(2, 4);
  const seam = rng.nextInt(0, 2);
  const spread = rng.next();
  const lift = rng.next();
  const beamAmt = rng.next();
  const leanDir = rng.next() < 0.5 ? -1 : 1;

  let extraPost = spread > 0.58 && rng.next() > 0.32;
  let gap = extraPost ? rng.nextInt(3, 6) : 0;
  let spanW = extraPost ? postW * 2 + gap : postW;
  while (extraPost && spanW + 2 > w - 2 && gap > 2) {
    gap -= 1;
    spanW = postW * 2 + gap;
  }
  if (extraPost && spanW + 2 > w - 2) {
    extraPost = false;
    gap = 0;
    spanW = postW;
  }

  const platePad = 2 + Math.round(spread * 4);
  const plateW = clamp(Math.max(spanW + 2, postW + platePad), 4, w - 2);
  const beamCount = beamAmt < 0.25 ? 0 : beamAmt < 0.7 ? 1 : 2;
  const topMass = lift > 0.62;
  const midMass = lift > 0.28 && lift < 0.78;

  const groundY = h - 1;
  const plateY = groundY - plateH;
  const headroom = rng.nextInt(2, 4);
  const capH = topMass ? rng.nextInt(3, 4) : 0;
  const postTop = clamp(headroom + (topMass ? capH - 1 : 0), 1, Math.max(2, plateY - 8));
  const postH = Math.max(6, plateY - postTop + 1);
  const cx = clamp(Math.floor(w / 2) + rng.nextInt(-1, 1), 4, w - 5);
  let plateX = clamp(cx - Math.floor(plateW / 2), 1, w - plateW - 1);
  const seat = plateX + Math.floor((plateW - spanW) / 2) + seam * leanDir;
  const postX0 = clamp(seat, 1, Math.max(1, w - spanW - 1));

  const parts: GenomeNode[] = [
    {
      kind: 'plate',
      x: plateX,
      y: plateY,
      w: plateW,
      h: plateH,
      mat: 'concrete',
      role: 'base',
    },
  ];

  const addLeaningPost = (x: number, mat: GenomeNode['mat']): { x: number; top: number } => {
    const px = clamp(x, 0, w - postW);
    if (lean === 0) {
      parts.push({
        kind: 'post',
        x: px,
        y: postTop,
        w: postW,
        h: postH,
        mat,
        role: 'spine',
      });
      return { x: px, top: postTop };
    }
    const upperH = Math.max(3, Math.floor(postH * 0.45));
    const lowerH = postH - upperH + 1;
    const upperX = clamp(px + leanDir * lean, 0, w - postW);
    parts.push({
      kind: 'post',
      x: px,
      y: postTop + upperH - 1,
      w: postW,
      h: lowerH,
      mat,
      role: 'spine',
    });
    parts.push({
      kind: 'post',
      x: upperX,
      y: postTop,
      w: postW,
      h: upperH,
      mat: 'metalMid',
      role: 'spine',
    });
    return { x: upperX, top: postTop };
  };

  const primary = addLeaningPost(postX0, 'metal');
  let secondaryX = primary.x;
  if (extraPost) {
    const second = addLeaningPost(postX0 + postW + gap, 'metalMid');
    secondaryX = second.x;
  }

  const leftX = Math.min(primary.x, extraPost ? postX0 + postW + gap : primary.x);
  const rightX = extraPost ? Math.max(primary.x, secondaryX) + postW : primary.x + postW;
  const beamSpan = Math.max(4, rightX - leftX + 1);

  if (beamCount >= 1) {
    const by = clamp(postTop + Math.floor(postH * (0.2 + rng.next() * 0.22)), postTop + 1, plateY - 3);
    const short = !extraPost;
    const bw = short ? postW + rng.nextInt(2, 4) : beamSpan + rng.nextInt(0, 2);
    const bx = clamp(short ? primary.x - 1 : leftX - 1, 0, w - bw);
    parts.push({
      kind: 'beam',
      x: bx,
      y: by,
      w: Math.min(bw, w - bx),
      h: beamH,
      mat: extraPost ? 'metal' : 'metalMid',
      role: 'rib',
    });
  }
  if (beamCount >= 2) {
    const by = clamp(postTop + Math.floor(postH * (0.48 + rng.next() * 0.18)), postTop + 3, plateY - 2);
    const bw = extraPost ? beamSpan : postW + rng.nextInt(3, 6);
    const bx = clamp(extraPost ? leftX - 1 : primary.x - rng.nextInt(0, 2), 0, w - 4);
    parts.push({
      kind: 'beam',
      x: bx,
      y: by,
      w: clamp(bw, 4, w - bx),
      h: beamH,
      mat: 'metal',
      role: 'rib',
    });
  }

  if (topMass) {
    const mw = rng.nextInt(3, 5);
    const mh = capH || rng.nextInt(3, 4);
    const mx = clamp(primary.x + Math.floor((postW - mw) / 2), 0, w - mw);
    const my = clamp(primary.top - mh + 2, 0, postTop + 1);
    parts.push({
      kind: 'mass',
      x: mx,
      y: my,
      w: mw,
      h: mh,
      mat: 'metalMid',
      role: 'head',
    });
  }

  if (midMass) {
    const mw = rng.nextInt(5, 8);
    const mh = rng.nextInt(2, 3);
    const mx = clamp(primary.x + Math.floor((postW - mw) / 2), 0, w - mw);
    const my = clamp(postTop + Math.floor(postH * (0.16 + rng.next() * 0.14)), postTop + 1, plateY - mh - 1);
    parts.push({
      kind: 'mass',
      x: mx,
      y: my,
      w: mw,
      h: mh,
      mat: 'concrete',
      role: 'head',
    });
  }

  if (rng.next() > 0.42) {
    const nw = rng.nextInt(1, 3);
    const nh = rng.nextInt(1, 2);
    parts.push({
      kind: 'nub',
      x: clamp(plateX + (rng.next() < 0.5 ? 0 : plateW - nw), 0, w - nw),
      y: clamp(plateY - 1, 0, h - nh),
      w: nw,
      h: nh,
      mat: 'bone',
      role: 'accent',
    });
  }

  const coreW = rng.nextInt(1, 2);
  parts.push({
    kind: 'core',
    x: clamp(primary.x + (leanDir > 0 ? postW : -coreW + 1), 0, w - coreW),
    y: clamp(postTop + rng.nextInt(1, Math.max(2, Math.floor(postH * 0.35))), 0, h - coreW),
    w: coreW,
    h: coreW,
    mat: 'glow',
    role: 'accent',
  });

  return parts;
}

/**
 * 按朝向摆杆：底座不动，其余构件朝面向侧移。
 * `down` 保持原采样，避免改坏去重闸门。对向可相同；正交必须不同。
 */
function poseStreetWreckageFacing(parts: GenomeNode[], w: number, facing: Facing4): void {
  if (facing !== 'left' && facing !== 'right') return;
  const dx = facing === 'left' ? -2 : 2;
  for (const p of parts) {
    if (p.role === 'base') continue;
    p.x = clamp(p.x + dx, 0, Math.max(0, w - p.w));
  }
}

export function buildStreetWreckageSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  facing4: Facing4 = 'down',
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  const parts = layoutStreetNodes(canvas.w, canvas.h, seed);
  poseStreetWreckageFacing(parts, canvas.w, facing4);
  return {
    canvas,
    parts,
  };
}

/** 算子 → weld → 漆。给闸门与练习场同一条管线。 */
export function paintStreetWreckageBody(
  coverage: CoverageId,
  seed: number,
  sense?: string,
): PaintBuf {
  const sk = buildStreetWreckageSkeleton(coverage, seed, sense);
  applyOperators(sk, coverage, seed);
  return paintWeldedBody(sk);
}
