/**
 * I5-G：有机残影骨架语法。
 * 一块团当质量，2–4 根不等长的杆当肢，没有虫 / 哺乳动物 / 蠕虫的体轴。
 * 读「曾经会走，但叫不出是什么动物」。禁止四足纵轴、多足横向、无足分节长条。
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

export const ORGANIC_REMNANT_ID = 'organic_remnant' as const;

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * 团大小 / 肢数 / 肢长差 / 前倾 / 缝都是连续采样，禁止用种子对基体取模切身份。
 * 团高与肢长吃画布高度，渗透→改写不能只靠画布从 32 高变 48 高。
 */
function layoutOrganicNodes(w: number, h: number, seed: number): GenomeNode[] {
  const rng = new SeededRandom(mix32(seed, 'organic_remnant:layout'));
  const limbAmt = rng.next();
  const limbCount = 2 + Math.round(limbAmt * 2);
  const lean = rng.nextInt(0, 3);
  const leanDir = rng.next() < 0.5 ? -1 : 1;
  const hasSeam = rng.next() > 0.42;
  const sideBias = rng.next();

  const massW = rng.nextInt(6, Math.min(11, Math.max(6, w - 10)));
  const massH = rng.nextInt(Math.max(5, Math.round(h * 0.18)), Math.max(8, Math.round(h * 0.34)));
  const limbBase = rng.nextInt(Math.max(4, Math.round(h * 0.14)), Math.max(6, Math.round(h * 0.26)));
  const lengths = Array.from({ length: limbCount }, (_, i) =>
    clamp(limbBase + i, 3, Math.max(4, h - massH - 4)),
  );
  rng.shuffle(lengths);

  const groundY = h - 2;
  const limbMax = Math.max(...lengths);
  const massY = clamp(groundY - limbMax - massH + 2, 2, h - massH - 4);
  const cx = clamp(Math.floor(w / 2) + rng.nextInt(-1, 1), 7, w - 8);
  const massX = clamp(cx - Math.floor(massW / 2) + lean * leanDir, 1, w - massW - 1);

  const parts: GenomeNode[] = [
    {
      kind: 'mass',
      x: massX,
      y: massY,
      w: massW,
      h: massH,
      mat: 'bone',
      role: 'spine',
    },
  ];

  const addLimb = (x: number, y: number, lw: number, lh: number): void => {
    parts.push({
      kind: 'post',
      x: clamp(x, 0, w - lw),
      y: clamp(y, 0, h - lh),
      w: lw,
      h: lh,
      mat: rng.next() < 0.45 ? 'cloth' : 'earth',
      role: 'limb',
    });
  };

  const insetL = massX + 1;
  const insetR = massX + massW - 2;
  const bottomY = massY + massH - 2;
  const leftish = clamp(insetL + rng.nextInt(0, 1), insetL, Math.max(insetL, insetR - 2));
  const rightish = clamp(insetR - rng.nextInt(0, 1), leftish + 2, insetR);

  addLimb(leftish, bottomY, rng.nextInt(1, 2), lengths[0]!);

  if (limbCount === 2 && sideBias > 0.58) {
    const sideLeft = sideBias > 0.79;
    const lw = rng.nextInt(1, 2);
    const midY = massY + rng.nextInt(1, Math.max(2, massH - 3));
    addLimb(sideLeft ? massX - lw + 1 : massX + massW - 1, midY, lw, lengths[1]!);
  } else {
    addLimb(rightish, bottomY, rng.nextInt(1, 2), lengths[1]!);
  }

  if (limbCount >= 3) {
    const lw = rng.nextInt(1, 2);
    const attachY = massY + rng.nextInt(1, Math.max(2, Math.floor(massH * 0.35)));
    const maxH = Math.max(3, massY + massH - 3 - attachY);
    addLimb(massX - lw + 1, attachY, lw, clamp(Math.min(lengths[2]!, maxH), 3, maxH));
  }
  if (limbCount >= 4) {
    const lw = rng.nextInt(1, 2);
    const attachY = massY + rng.nextInt(
      Math.max(1, Math.floor(massH * 0.22)),
      Math.max(2, Math.floor(massH * 0.5)),
    );
    const maxH = Math.max(3, massY + massH - 3 - attachY);
    addLimb(massX + massW - 1, attachY, lw, clamp(Math.min(lengths[3]!, maxH), 3, maxH));
  }

  if (hasSeam) {
    const seamH = Math.max(2, Math.floor(massH * (0.5 + rng.next() * 0.2)));
    parts.push({
      kind: 'filament',
      x: clamp(massX + Math.floor(massW / 2) + leanDir, massX + 1, massX + massW - 2),
      y: massY,
      w: 1,
      h: seamH,
      bend: 0,
      mat: 'shadow',
      role: 'accent',
    });
  }

  const feet = parts.filter((p) => p.role === 'limb');
  const footLeft = Math.min(...feet.map((p) => p.x));
  const footRight = Math.max(...feet.map((p) => p.x + p.w));
  const plateX = clamp(Math.min(footLeft, massX) - 1, 0, w - 4);
  const plateW = clamp(Math.max(footRight, massX + massW) - plateX + 1, 4, w - plateX);
  parts.push({
    kind: 'plate',
    x: plateX,
    y: groundY - 1,
    w: plateW,
    h: 2,
    mat: 'shadow',
    role: 'base',
  });

  const coreW = 1;
  parts.push({
    kind: 'core',
    x: clamp(massX + Math.floor(massW / 2), 0, w - coreW),
    y: clamp(massY + rng.nextInt(1, Math.max(2, Math.floor(massH * 0.4))), 0, h - coreW),
    w: coreW,
    h: coreW,
    mat: 'glow',
    role: 'accent',
  });

  return parts;
}

/**
 * 按朝向摆残余：底座不动，团与肢朝面向侧移。
 * `down` 保持原采样。禁止整图画布转 90°（转了会读成四足纵轴）。
 */
function poseOrganicRemnantFacing(parts: GenomeNode[], w: number, facing: Facing4): void {
  if (facing !== 'left' && facing !== 'right') return;
  const dx = facing === 'left' ? -2 : 2;
  for (const p of parts) {
    if (p.role === 'base') continue;
    p.x = clamp(p.x + dx, 0, Math.max(0, w - p.w));
  }
}

export function buildOrganicRemnantSkeleton(
  coverage: CoverageId,
  seed = 0,
  sense?: string,
  facing4: Facing4 = 'down',
): GenomeSkeleton {
  const canvas = genomeCanvasOf(coverage, sense);
  const parts = layoutOrganicNodes(canvas.w, canvas.h, seed);
  poseOrganicRemnantFacing(parts, canvas.w, facing4);
  return {
    canvas,
    parts,
  };
}

/** 算子 → weld → 漆。给闸门与练习场同一条管线。 */
export function paintOrganicRemnantBody(
  coverage: CoverageId,
  seed: number,
  sense?: string,
): PaintBuf {
  const sk = buildOrganicRemnantSkeleton(coverage, seed, sense);
  applyOperators(sk, coverage, seed);
  return paintWeldedBody(sk);
}
