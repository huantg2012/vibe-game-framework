/**
 * 剪影判别度测量 —— 把"长得不一样"变成数字。
 *
 * `visualKeyOf` 比的是参数元组字符串，从不看像素，所以陈列馆的 522 格是
 * "被认为会改像素的参数组合数"，不是量出来的形体数。这里量的是 alpha 掩膜：
 *   IoU 越高 = 越像。distinct = 去重后真正不同的掩膜个数。
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import { bakeJiaBase } from '@/entities/form-renderers/d/jia-paint';
import { jiaRecipeFromForm, JIA_FAMILIES } from '@/entities/form-renderers/d/jia-recipe';
import { skeletonOf, transgress, type Family } from './proto-skeleton';
import { drawSkeleton } from './proto-paint';

const FRAGMENT = 'frag-clinic';
const COVERAGES = ['infiltrate', 'rewrite', 'overwrite'] as const;
type Coverage = (typeof COVERAGES)[number];
const MASK_W = 48;
const MASK_H = 64;
const SEEDS = 16;

function formOf(substrate: string, coverage: Coverage): ContaminationForm {
  return {
    substrate,
    coverage,
    continuity: 'monolith',
    occupancy: 'floor',
    portfolio: 'jia',
    lexemes: {
      motion: 'motion_patrol',
      sense: 'sense_cone',
      rhythm: 'rhythm_pulse',
      contact: 'contact_melee_three',
    },
  };
}

/** Bottom-centre align into a common mask so 32x32 / 32x48 / 48x64 compare fairly. */
function maskOf(buf: { data: Uint8ClampedArray; w: number; h: number }): Uint8Array {
  const m = new Uint8Array(MASK_W * MASK_H);
  const ox = ((MASK_W - buf.w) / 2) | 0;
  const oy = MASK_H - buf.h;
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if ((buf.data[(y * buf.w + x) * 4 + 3] ?? 0) === 0) continue;
      const px = x + ox;
      const py = y + oy;
      if (px < 0 || py < 0 || px >= MASK_W || py >= MASK_H) continue;
      m[py * MASK_W + px] = 1;
    }
  }
  return m;
}

function iou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0;
  let uni = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (x || y) uni += 1;
    if (x && y) inter += 1;
  }
  return uni === 0 ? 1 : inter / uni;
}

/**
 * 粗占格描述子。IoU 在 1–2px 宽的剪影上会骗人：两根都只有 1px 宽的杆错开 2px，
 * IoU 掉到接近 0，人却读成同一根杆。这里把掩膜降到 6×8 的占格率再比 L1 距离 ——
 * 两根细杆都接近全空，距离小（判"像"，与人一致）；细杆对大团距离大（判"不像"）。
 */
const CD_COLS = 6;
const CD_ROWS = 8;

function coarse(mask: Uint8Array): Float32Array {
  const out = new Float32Array(CD_COLS * CD_ROWS);
  const cw = MASK_W / CD_COLS;
  const ch = MASK_H / CD_ROWS;
  for (let y = 0; y < MASK_H; y++) {
    for (let x = 0; x < MASK_W; x++) {
      if (!mask[y * MASK_W + x]) continue;
      const c = Math.min(CD_COLS - 1, (x / cw) | 0);
      const r = Math.min(CD_ROWS - 1, (y / ch) | 0);
      const bin = r * CD_COLS + c;
      out[bin] = (out[bin] ?? 0) + 1;
    }
  }
  const per = cw * ch;
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / per;
  return out;
}

function coarseDist(a: Uint8Array, b: Uint8Array): number {
  const ca = coarse(a);
  const cb = coarse(b);
  let s = 0;
  for (let i = 0; i < ca.length; i++) s += Math.abs(ca[i]! - cb[i]!);
  return s / ca.length;
}

function medianCoarse(masks: readonly Uint8Array[]): number {
  const vals: number[] = [];
  for (let i = 0; i < masks.length; i++) {
    for (let j = i + 1; j < masks.length; j++) vals.push(coarseDist(masks[i]!, masks[j]!));
  }
  vals.sort((a, b) => a - b);
  return vals.length === 0 ? 0 : vals[vals.length >> 1]!;
}

function medianPairIou(masks: readonly Uint8Array[]): number {
  const vals: number[] = [];
  for (let i = 0; i < masks.length; i++) {
    for (let j = i + 1; j < masks.length; j++) vals.push(iou(masks[i]!, masks[j]!));
  }
  vals.sort((a, b) => a - b);
  return vals.length === 0 ? 1 : vals[vals.length >> 1]!;
}

function distinctCount(masks: readonly Uint8Array[]): number {
  const keys = new Set<string>();
  for (const m of masks) keys.add(Buffer.from(m).toString('base64'));
  return keys.size;
}

function currentMask(family: string, coverage: Coverage, seed: number): Uint8Array {
  const recipe = jiaRecipeFromForm(formOf(family, coverage), seed, FRAGMENT);
  return maskOf(bakeJiaBase(recipe, 'down', 'idle', 0, 'patrol'));
}

function protoMask(family: Family, coverage: Coverage, seed: number): Uint8Array {
  const colors = jiaRecipeFromForm(formOf(family, coverage), seed, FRAGMENT).colors;
  const sk = transgress(skeletonOf(family, seed, MASK_W, MASK_H), coverage, seed);
  return maskOf(drawSkeleton(sk, colors));
}

const seedList = Array.from({ length: SEEDS }, (_, i) => 1000 + i * 977);

function pad(s: string, n: number): string {
  return s.length >= n ? s : s + ' '.repeat(n - s.length);
}

console.log('== A. 同基体同覆盖度，16 个随机种子 ==');
console.log('distinct = 去重后不同剪影数 / 粗占格距离越大 = 越不像 / IoU 越大 = 越像');
console.log(
  pad('substrate', 18),
  pad('cur distinct', 14),
  pad('pro distinct', 14),
  pad('cur coarse', 11),
  pad('pro coarse', 11),
  pad('cur IoU', 8),
  'pro IoU',
);
for (const family of JIA_FAMILIES) {
  const cur = seedList.map((s) => currentMask(family, 'rewrite', s));
  const pro = seedList.map((s) => protoMask(family, 'rewrite', s));
  console.log(
    pad(family, 18),
    pad(`${distinctCount(cur)} / ${SEEDS}`, 14),
    pad(`${distinctCount(pro)} / ${SEEDS}`, 14),
    pad(medianCoarse(cur).toFixed(4), 11),
    pad(medianCoarse(pro).toFixed(4), 11),
    pad(medianPairIou(cur).toFixed(3), 8),
    medianPairIou(pro).toFixed(3),
  );
}

console.log('');
console.log('== B. 同个体，覆盖度相邻两档 ==  粗占格距离越小 = 覆盖度越没改剪影');
console.log(
  pad('substrate', 18),
  pad('cur inf>rew', 12),
  pad('cur rew>ovr', 12),
  pad('pro inf>rew', 12),
  'pro rew>ovr',
);
for (const family of JIA_FAMILIES) {
  const seed = mix32(7, family) % 8192;
  const c0 = currentMask(family, 'infiltrate', seed);
  const c1 = currentMask(family, 'rewrite', seed);
  const c2 = currentMask(family, 'overwrite', seed);
  const p0 = protoMask(family as Family, 'infiltrate', seed);
  const p1 = protoMask(family as Family, 'rewrite', seed);
  const p2 = protoMask(family as Family, 'overwrite', seed);
  console.log(
    pad(family, 18),
    pad(coarseDist(c0, c1).toFixed(4), 12),
    pad(coarseDist(c1, c2).toFixed(4), 12),
    pad(coarseDist(p0, p1).toFixed(4), 12),
    coarseDist(p1, p2).toFixed(4),
  );
}

console.log('');
console.log('== C. 跨基体（覆盖度=改写，同种子）==  粗占格距离越小 = 不同基体越像');
{
  const seed = 8807;
  const cur = JIA_FAMILIES.map((f) => currentMask(f, 'rewrite', seed));
  const pro = JIA_FAMILIES.map((f) => protoMask(f as Family, 'rewrite', seed));
  console.log(`current 五基体两两粗占格距离中位数  ${medianCoarse(cur).toFixed(4)}   (IoU ${medianPairIou(cur).toFixed(3)})`);
  console.log(`proto   五基体两两粗占格距离中位数  ${medianCoarse(pro).toFixed(4)}   (IoU ${medianPairIou(pro).toFixed(3)})`);
}
