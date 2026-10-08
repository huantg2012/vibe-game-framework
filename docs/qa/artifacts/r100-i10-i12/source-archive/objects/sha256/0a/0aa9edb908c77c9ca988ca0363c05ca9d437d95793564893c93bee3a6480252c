/**
 * I5-K：虫骨架语法（第三轮：透视排足）。
 * 足总数 4–10，截断正态 μ=6 σ=1.5。长度随体轴深度 / 近远侧 / 朝向，不按对复制。
 * 中央一块团（头胸 / 腹甲，壳质硬边）。四向直立：足往两侧伸，禁止纯俯视圆虫。
 * 算子 / weld / 漆由调用方按合同顺序接：applyOperators → weld → 刷漆。
 */
import { mix32 } from '@/generation/seed-fork';
import { SeededRandom } from '@/utils/random';
import { genomeCanvasOf } from '@/entities/form-renderers/d/genome/canvas';
import { applyOperators } from '@/entities/form-renderers/d/genome/operators';
import { paintWeldedBody } from '@/entities/form-renderers/d/genome/weld';
import type { PaintBuf } from '@/entities/form-renderers/d/genome/buffer';
import type { GenomeMat, GenomeNode, GenomeSkeleton } from '@/entities/form-renderers/d/genome/types';
import type { CoverageId } from '@/generated/contamination-lexicon-data';
import type { Facing4 } from '@/types/game-types';

export const INSECT_REMNANT_ID = 'insect_remnant' as const;

const CARAPACE_MATS: readonly GenomeMat[] = ['bone', 'concrete', 'metal'];
const LEG_MATS: readonly GenomeMat[] = ['bone', 'metal', 'metalMid'];

const LEG_COUNT_MU = 6;
const LEG_COUNT_SIGMA = 1.5;
const LEG_COUNT_MIN = 4;
const LEG_COUNT_MAX = 10;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function pickMat(rng: SeededRandom, pool: readonly GenomeMat[]): GenomeMat {
  const t = rng.next();
  if (t < 0.34) return pool[0]!;
  if (t < 0.67) return pool[1]!;
  return pool[2]!;
}

/** 截断正态：μ=6 σ=1.5，四舍五入后钳到 [4,10]。禁止均匀抽对数。 */
function sampleLegCount(rng: SeededRandom): number {
  return clamp(Math.round(LEG_COUNT_MU + LEG_COUNT_SIGMA * rng.nextGaussian()), LEG_COUNT_MIN, LEG_COUNT_MAX);
}

function splitSideCounts(n: number, facing: Facing4): { left: number; right: number } {
  const half = Math.floor(n / 2);
  if (n % 2 === 0) return { left: half, right: half };
  if (facing === 'left' || facing === 'down') return { left: half + 1, right: half };
  return { left: half, right: half + 1 };
}

function isNearSide(facing: Facing4, side: 'left' | 'right'): boolean {
  if (facing === 'left') return side === 'left';
  if (facing === 'right') return side === 'right';
  return true;
}

function hipYForDepth(
  t: number,
  facing: Facing4,
  massY: number,
  carapaceH: number,
): number {
  const top = massY + 1;
  const bot = massY + carapaceH - 1;
  if (facing === 'up') return Math.round(lerp(top, bot, t));
  if (facing === 'left' || facing === 'right') {
    const mid = massY + Math.floor(carapaceH * 0.5);
    const span = Math.max(1, Math.floor(carapaceH * 0.35));
    return clamp(mid + Math.round((t - 0.5) * span), massY, massY + carapaceH - 1);
  }
  return Math.round(lerp(bot, top, t));
}

/**
 * 透视排足。n 是 limb post 条数（重合 accent 不计）。
 * 朝向在这里吃掉：深度 t、近远侧、朝下朝上；不要事后给所有柱 +1px。
 */
function layoutInsectNodes(w: number, h: number, seed: number, facing: Facing4): GenomeNode[] {
  const rng = new SeededRandom(mix32(seed, 'insect_remnant:layout'));
  const n = sampleLegCount(rng);
  const { left: leftCount, right: rightCount } = splitSideCounts(n, facing);
  const reachAmt = rng.next();
  const lenAmt = rng.next();
  const segAmt = rng.next();
  const segCount = Math.round(segAmt * 2);
  const lean = rng.nextInt(0, 2);
  const leanDir = rng.next() < 0.5 ? -1 : 1;
  const farScale = 0.65 + rng.next() * 0.1;
  const oddShift = 1 + Math.round(rng.next());

  const gaitPad = 2;
  const baseReach = w <= 32 ? 4 : 6;
  const maxReach = baseReach + (w <= 32 ? 1 : 2);
  const leftRoom = (facing === 'left' ? maxReach + 1 : maxReach) + gaitPad;
  const rightRoom = (facing === 'right' ? maxReach + 1 : maxReach) + gaitPad;
  const massWHi = Math.min(14, Math.max(8, w - leftRoom - rightRoom));
  const massW = rng.nextInt(8, Math.max(8, massWHi));
  const carapaceW = Math.min(Math.max(massW, 8), Math.max(8, w - leftRoom - rightRoom));
  const carapaceHMin = Math.min(carapaceW, w <= 32 ? 6 : 6);
  const carapaceHMax = Math.min(
    carapaceW,
    w <= 32 ? 8 : Math.min(12, Math.max(7, Math.round(h * 0.22))),
  );
  const carapaceH = rng.nextInt(carapaceHMin, Math.max(carapaceHMin, carapaceHMax));

  const groundY = h - 2;
  const minClear = 4;
  const maxMassY = groundY - minClear - carapaceH + 1;
  const preferY = clamp(
    Math.round(h * (0.18 + reachAmt * 0.06)) + Math.round((lenAmt - 0.5) * 2),
    2,
    Math.max(2, maxMassY),
  );
  const massY = clamp(preferY, 2, Math.min(Math.max(2, maxMassY), Math.round(h * 0.32)));
  const toward = facing === 'left' ? -1 : facing === 'right' ? 1 : 0;
  const minMassX = leftRoom - 1;
  const maxMassX = w - carapaceW - rightRoom + 1;
  const cx = clamp(
    Math.floor(w / 2) + rng.nextInt(-1, 1) + lean * leanDir + toward,
    minMassX + Math.floor(carapaceW / 2),
    Math.max(minMassX, maxMassX) + Math.floor(carapaceW / 2),
  );
  const massX = clamp(cx - Math.floor(carapaceW / 2), minMassX, Math.max(minMassX, maxMassX));

  const carapaceMat = pickMat(rng, CARAPACE_MATS);
  const parts: GenomeNode[] = [
    {
      kind: 'mass',
      x: massX,
      y: massY,
      w: carapaceW,
      h: carapaceH,
      mat: carapaceMat,
      role: 'spine',
    },
  ];

  const addShaft = (x: number, y: number, lw: number, lh: number, mat: GenomeMat): void => {
    const px = clamp(x, 0, w - lw);
    const py = clamp(y, 0, h - 1);
    const ph = clamp(lh, 1, h - py);
    parts.push({
      kind: 'post',
      x: px,
      y: py,
      w: lw,
      h: ph,
      mat,
      role: 'limb',
    });
    parts.push({
      kind: 'post',
      x: px,
      y: py,
      w: lw,
      h: ph,
      mat,
      role: 'accent',
    });
  };
  const addFemur = (x: number, y: number, lw: number, mat: GenomeMat): void => {
    const fw = clamp(lw, 1, w);
    parts.push({
      kind: 'beam',
      x: clamp(x, 0, w - fw),
      y: clamp(y, 0, h - 1),
      w: fw,
      h: 1,
      mat,
      role: 'limb',
    });
  };

  const shaftW = 1;
  const extraSide: 'left' | 'right' = leftCount > rightCount ? 'left' : 'right';
  const placeSide = (side: 'left' | 'right', count: number): void => {
    const near = isNearSide(facing, side);
    const sideScale = near ? 1 : farScale;
    for (let i = 0; i < count; i++) {
      const raw = count <= 1 ? 0.45 : i / (count - 1);
      const stagger = side === 'right' ? 0.06 : 0;
      const t = clamp(raw + stagger, 0, 1);
      const open = 1 - 0.42 * t;
      let reach = Math.max(2, Math.round(baseReach * open * sideScale));
      if (near && t < 0.45 && (facing === 'left' || facing === 'right')) reach += 1;
      const attachY0 = hipYForDepth(t, facing, massY, carapaceH);
      const along =
        n % 2 === 1 && side === extraSide && i === count - 1
          ? facing === 'left' || facing === 'right'
            ? 0
            : oddShift
          : 0;
      const attachY = clamp(attachY0 + along, massY, massY + carapaceH - 1);
      const available = groundY - attachY;
      const plant = t < 0.4;
      const foreshorten = 1 - 0.25 * t;
      const lift = plant ? 0 : 2 + Math.round(2 * t);
      const lh = clamp(
        Math.round(available * foreshorten * sideScale) - lift,
        3,
        Math.max(3, available),
      );
      const mat = pickMat(rng, LEG_MATS);
      if (side === 'left') {
        const inset =
          facing === 'right' ? Math.round(t * Math.min(2, Math.floor(carapaceW * 0.2))) : 0;
        const leftX = massX + inset - reach + 1;
        addFemur(leftX, attachY, reach, mat);
        addShaft(leftX, attachY, shaftW, lh, mat);
      } else {
        const inset =
          facing === 'left' ? Math.round(t * Math.min(2, Math.floor(carapaceW * 0.2))) : 0;
        const rightFemurX = massX + carapaceW - 1 - inset;
        addFemur(rightFemurX, attachY, reach, mat);
        addShaft(rightFemurX + reach - shaftW, attachY, shaftW, lh, mat);
      }
    }
  };

  placeSide('left', leftCount);
  placeSide('right', rightCount);

  if (segCount >= 1) {
    const sw = rng.nextInt(2, 3);
    const sh = rng.nextInt(2, 3);
    parts.push({
      kind: rng.next() < 0.5 ? 'nub' : 'mass',
      x: clamp(massX + carapaceW - sw - 1, massX + 1, w - sw),
      y: clamp(massY + carapaceH - 1, 0, h - sh),
      w: sw,
      h: sh,
      mat: 'bone',
      role: 'accent',
    });
  }
  if (segCount >= 2) {
    const sw = rng.nextInt(2, 3);
    const sh = 2;
    parts.push({
      kind: 'nub',
      x: clamp(massX + carapaceW - sw, massX + 2, w - sw),
      y: clamp(massY + Math.floor(carapaceH * 0.45), massY + 1, massY + carapaceH - sh),
      w: sw,
      h: sh,
      mat: 'concrete',
      role: 'accent',
    });
  }

  const coreW = 1;
  parts.push({
    kind: 'core',
    x: clamp(massX + Math.floor(carapaceW / 2), 0, w - coreW),
    y: clamp(massY + rng.nextInt(1, Math.max(2, Math.floor(carapaceH * 0.45))), 0, h - coreW),
    w: coreW,
    h: coreW,
    mat: 'glow',
    role: 'accent',
  });

  return parts;
}

export function buildInsectRemnantSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  facing4: Facing4 = 'down',
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  const parts = layoutInsectNodes(canvas.w, canvas.h, seed, facing4);
  return {
    canvas,
    parts,
  };
}

/** 算子 → weld → 漆。给闸门与练习场同一条管线。 */
export function paintInsectRemnantBody(
  coverage: CoverageId,
  seed: number,
  sense?: string,
): PaintBuf {
  const sk = buildInsectRemnantSkeleton(coverage, seed, sense);
  applyOperators(sk, coverage, seed);
  return paintWeldedBody(sk);
}
