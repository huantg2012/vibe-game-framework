/**
 * Samples 3–5 — the 构件骨架 + 违规预算 prototype.
 *   proto-jia-individuals.png  一基体一覆盖度十个体：同一行里没有两只一样
 *   proto-jia-escalation.png   一个体三覆盖度：疯狂是结构违规，不是加漆
 *   proto-fragment-ramp.png    五碎片同一只：现行 ramp（四张碎片完全同色） vs 污染方言
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import type { FragmentContamRamp } from '@/entities/form-renderers/d/fragment-ramp';
import { jiaRecipeFromForm, type JiaBodyColors } from '@/entities/form-renderers/d/jia-recipe';
import { yardSurfaceColors } from '@/entities/form-renderers/d/fragment-ramp';
import { protoContamRamp } from './proto-ramp';
import { skeletonOf, transgress, type Family } from './proto-skeleton';
import { drawSkeleton, paintContamination } from './proto-paint';
import { blit, fillRect, makeSheet, save, text, type Rgb } from './sheet';

const W = 48;
const H = 64;
const SCALE = 3;
const CELL_W = W * SCALE;
const CELL_H = H * SCALE;

const FAMILIES: readonly Family[] = [
  'organic_remnant',
  'stalk_clump',
  'lamp_pillar',
  'railing_post',
  'doorframe',
];
const LABEL: Record<Family, string> = {
  organic_remnant: 'ORGANIC',
  stalk_clump: 'STALK',
  lamp_pillar: 'LAMP',
  railing_post: 'RAIL',
  doorframe: 'DOOR',
};
const COVERAGES = ['infiltrate', 'rewrite', 'overwrite'] as const;
const FRAGMENTS = [
  'frag-outdoor',
  'frag-clinic',
  'frag-metro',
  'frag-library',
  'frag-residential',
] as const;
const FRAG_LABEL: Record<string, string> = {
  'frag-outdoor': 'SOIL',
  'frag-clinic': 'TILE',
  'frag-metro': 'METAL',
  'frag-library': 'WOOD',
  'frag-residential': 'PLASTER',
};

const INK: Rgb = [0xc8, 0xcd, 0xd4];
const DIM: Rgb = [0x5a, 0x5f, 0x66];

function formOf(substrate: string, coverage: (typeof COVERAGES)[number]): ContaminationForm {
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

function withRamp(base: JiaBodyColors, ramp: FragmentContamRamp): JiaBodyColors {
  const q = (c: readonly [number, number, number]) => [c[0], c[1], c[2], 255] as const;
  return {
    ...base,
    deep: q(ramp.deep),
    mid: q(ramp.mid),
    core: q(ramp.core),
    glow: q(ramp.glow),
    bright: q(ramp.glow),
  };
}

function bake(
  family: Family,
  coverage: (typeof COVERAGES)[number],
  seed: number,
  fragment: string,
  ramp: FragmentContamRamp | null,
) {
  const base = jiaRecipeFromForm(formOf(family, coverage), seed, fragment).colors;
  const colors = ramp ? withRamp(base, ramp) : base;
  const sk = transgress(skeletonOf(family, seed, W, H), coverage, seed);
  const buf = drawSkeleton(sk, colors);
  paintContamination(buf, coverage, colors, seed);
  return { buf, applied: sk.applied };
}

const DEFAULT_FRAGMENT = 'frag-clinic';
const dialect = (f: string) => protoContamRamp(f);

// ------------------------------------------------------- sheet 3：同基体十个体

{
  const COLS = 10;
  const GAP = 4;
  const MARGIN_L = 76;
  const MARGIN_T = 42;
  const sheetW = MARGIN_L + COLS * (CELL_W + GAP) - GAP + 16;
  const sheetH = MARGIN_T + FAMILIES.length * (CELL_H + GAP) - GAP + 16;
  const sheet = makeSheet(sheetW, sheetH, [0x0a, 0x0b, 0x0d]);
  const floor = yardSurfaceColors(DEFAULT_FRAGMENT).floor;
  text(sheet, 'PROTO JIA  ONE SUBSTRATE X TEN SEEDS  COVERAGE=REWRITE', MARGIN_L, 12, INK, 2);
  text(sheet, 'SKELETON GRAMMAR + PART LIBRARY + 3 STRUCTURAL VIOLATIONS', MARGIN_L, 26, DIM, 1);

  for (let r = 0; r < FAMILIES.length; r++) {
    const family = FAMILIES[r]!;
    const cy = MARGIN_T + r * (CELL_H + GAP);
    text(sheet, LABEL[family], 6, cy + CELL_H / 2 - 4, INK, 2);
    for (let c = 0; c < COLS; c++) {
      const cx = MARGIN_L + c * (CELL_W + GAP);
      fillRect(sheet, cx, cy, CELL_W, CELL_H, floor);
      const seed = 1000 + c * 977 + r * 13;
      blit(sheet, bake(family, 'rewrite', seed, DEFAULT_FRAGMENT, dialect(DEFAULT_FRAGMENT)).buf, cx, cy, SCALE);
    }
  }
  save('docs/art/samples/proto-jia-individuals.png', sheet);
  console.log(`proto-jia-individuals.png  ${sheetW}x${sheetH}`);
}

// --------------------------------------------------------- sheet 4：疯狂阶梯

{
  const SEEDS = [4211, 8807, 15013];
  const GAP = 4;
  const GROUP_GAP = 26;
  const MARGIN_L = 76;
  const MARGIN_T = 56;
  const groupW = COVERAGES.length * CELL_W + (COVERAGES.length - 1) * GAP;
  const sheetW = MARGIN_L + SEEDS.length * groupW + (SEEDS.length - 1) * GROUP_GAP + 16;
  const sheetH = MARGIN_T + FAMILIES.length * (CELL_H + GAP) - GAP + 16;
  const sheet = makeSheet(sheetW, sheetH, [0x0a, 0x0b, 0x0d]);
  const floor = yardSurfaceColors(DEFAULT_FRAGMENT).floor;
  text(sheet, 'PROTO JIA  ONE INDIVIDUAL X THREE COVERAGE DEPTHS', MARGIN_L, 12, INK, 2);
  text(sheet, 'BUDGET 1 / 3 / 5 VIOLATIONS   RADIATE UNLOCKS ONLY AT OVERWRITE', MARGIN_L, 26, DIM, 1);

  for (let g = 0; g < SEEDS.length; g++) {
    const gx = MARGIN_L + g * (groupW + GROUP_GAP);
    text(sheet, `SEED ${SEEDS[g]}`, gx, 38, DIM, 1);
    for (let c = 0; c < COVERAGES.length; c++) {
      text(sheet, COVERAGES[c]!.slice(0, 5), gx + c * (CELL_W + GAP), 48, DIM, 1);
    }
  }
  for (let r = 0; r < FAMILIES.length; r++) {
    const family = FAMILIES[r]!;
    const cy = MARGIN_T + r * (CELL_H + GAP);
    text(sheet, LABEL[family], 6, cy + CELL_H / 2 - 4, INK, 2);
    for (let g = 0; g < SEEDS.length; g++) {
      for (let c = 0; c < COVERAGES.length; c++) {
        const cx = MARGIN_L + g * (groupW + GROUP_GAP) + c * (CELL_W + GAP);
        fillRect(sheet, cx, cy, CELL_W, CELL_H, floor);
        const out = bake(family, COVERAGES[c]!, SEEDS[g]!, DEFAULT_FRAGMENT, dialect(DEFAULT_FRAGMENT));
        blit(sheet, out.buf, cx, cy, SCALE);
      }
    }
  }
  save('docs/art/samples/proto-jia-escalation.png', sheet);
  console.log(`proto-jia-escalation.png  ${sheetW}x${sheetH}`);
}

// ------------------------------------------------------ sheet 5：碎片污染方言

{
  const SEED = 8807;
  const GAP = 4;
  const BLOCK_GAP = 44;
  const MARGIN_L = 76;
  const MARGIN_T = 58;
  const blockW = FRAGMENTS.length * CELL_W + (FRAGMENTS.length - 1) * GAP;
  const sheetW = MARGIN_L + 2 * blockW + BLOCK_GAP + 16;
  const sheetH = MARGIN_T + FAMILIES.length * (CELL_H + GAP) - GAP + 16;
  const sheet = makeSheet(sheetW, sheetH, [0x0a, 0x0b, 0x0d]);
  text(sheet, 'SAME INDIVIDUAL ACROSS FIVE WORLD FRAGMENTS', MARGIN_L, 12, INK, 2);
  text(sheet, 'LEFT: SHIPPED DERIVEFRAGMENTCONTAMRAMP', MARGIN_L, 30, DIM, 1);
  text(sheet, 'RIGHT: PROTO DIALECT  SAME LOCKED PALETTE', MARGIN_L + blockW + BLOCK_GAP, 30, DIM, 1);

  for (let b = 0; b < 2; b++) {
    for (let f = 0; f < FRAGMENTS.length; f++) {
      const cx = MARGIN_L + b * (blockW + BLOCK_GAP) + f * (CELL_W + GAP);
      text(sheet, FRAG_LABEL[FRAGMENTS[f]!]!, cx + 2, 46, DIM, 1);
    }
  }
  for (let r = 0; r < FAMILIES.length; r++) {
    const family = FAMILIES[r]!;
    const cy = MARGIN_T + r * (CELL_H + GAP);
    text(sheet, LABEL[family], 6, cy + CELL_H / 2 - 4, INK, 2);
    for (let f = 0; f < FRAGMENTS.length; f++) {
      const fragment = FRAGMENTS[f]!;
      const floor = yardSurfaceColors(fragment).floor;
      const left = MARGIN_L + f * (CELL_W + GAP);
      fillRect(sheet, left, cy, CELL_W, CELL_H, floor);
      // ramp=null 走 jiaRecipeFromForm 的生产配色：deep/mid 是 ramp 原色，core/glow 已被 clampCoreTeal 钳过。
      blit(sheet, bake(family, 'rewrite', SEED, fragment, null).buf, left, cy, SCALE);
      const right = MARGIN_L + blockW + BLOCK_GAP + f * (CELL_W + GAP);
      fillRect(sheet, right, cy, CELL_W, CELL_H, floor);
      blit(sheet, bake(family, 'rewrite', SEED, fragment, dialect(fragment)).buf, right, cy, SCALE);
    }
  }
  save('docs/art/samples/proto-fragment-ramp.png', sheet);
  console.log(`proto-fragment-ramp.png  ${sheetW}x${sheetH}`);
}
