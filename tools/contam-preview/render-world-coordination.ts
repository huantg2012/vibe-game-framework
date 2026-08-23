/**
 * Sample 7 — 污染体站在**真实出击地面**上，现状配色 vs 协同配色。
 * 回答「污染体的配色要与世界协同」：协同不是靠近底色，是与底色构成稳定关系 + 对比度下限。
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import type { FragmentContamRamp } from '@/entities/form-renderers/d/fragment-ramp';
import { generateRuins } from '@/generation/ruins';
import { paintRuinedMask } from '@/generation/preview-paint';
import { jiaRecipeFromForm, type JiaBodyColors } from '@/entities/form-renderers/d/jia-recipe';
import { protoContamRamp } from './proto-ramp';
import { skeletonOf, transgress, type Family } from './proto-skeleton';
import { drawSkeleton, paintContamination } from './proto-paint';
import { blit, makeSheet, save, text, type Rgb } from './sheet';

const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro'] as const;
const LABEL: Record<string, string> = {
  'frag-outdoor': 'OUTDOOR  OLIVE DARK',
  'frag-clinic': 'CLINIC  COOL GREY',
  'frag-metro': 'METRO  OLIVE + AMBER',
};
const CAST: readonly { readonly family: Family; readonly seed: number }[] = [
  { family: 'organic_remnant', seed: 8807 },
  { family: 'lamp_pillar', seed: 4211 },
  { family: 'doorframe', seed: 15013 },
  { family: 'stalk_clump', seed: 2971 },
];

const W = 48;
const H = 64;
const T = 16;
const TILES_W = 15;
const TILES_H = 5;
const BG_W = TILES_W * T;
const BG_H = TILES_H * T;
const SCALE = 3;
const SEED = 404;

function formOf(substrate: string): ContaminationForm {
  return {
    substrate,
    coverage: 'rewrite',
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
  const q = (c: Rgb) => [c[0], c[1], c[2], 255] as const;
  return { ...base, deep: q(ramp.deep), mid: q(ramp.mid), core: q(ramp.core), glow: q(ramp.glow), bright: q(ramp.glow) };
}

function bake(family: Family, seed: number, fragment: string, ramp: FragmentContamRamp | null) {
  const base = jiaRecipeFromForm(formOf(family), seed, fragment).colors;
  const colors = ramp ? withRamp(base, ramp) : base;
  const sk = transgress(skeletonOf(family, seed, W, H), 'rewrite', seed);
  const buf = drawSkeleton(sk, colors);
  paintContamination(buf, 'rewrite', colors, seed);
  return buf;
}

/** 真实地面裁一条横带，地板最密的窗口。 */
function groundStrip(fragmentTypeId: string) {
  const mask = generateRuins(SEED, fragmentTypeId);
  const painted = paintRuinedMask(mask, T);
  const cols = mask.outline.cols;
  const rows = mask.outline.rows;
  let bc = 0;
  let br = 0;
  let best = -1;
  for (let r = 0; r + TILES_H <= rows; r += 1) {
    for (let c = 0; c + TILES_W <= cols; c += 1) {
      let s = 0;
      for (let j = 0; j < TILES_H; j++) {
        for (let i = 0; i < TILES_W; i++) {
          const idx = (r + j) * cols + (c + i);
          if (mask.outline.land[idx] && !mask.walls[idx]) s += 1;
        }
      }
      if (s > best) {
        best = s;
        bc = c;
        br = r;
      }
    }
  }
  const out = new Uint8ClampedArray(BG_W * BG_H * 4);
  for (let y = 0; y < BG_H; y++) {
    for (let x = 0; x < BG_W; x++) {
      const si = ((br * T + y) * painted.width + (bc * T + x)) * 4;
      const di = (y * BG_W + x) * 4;
      out[di] = painted.rgba[si] ?? 0;
      out[di + 1] = painted.rgba[si + 1] ?? 0;
      out[di + 2] = painted.rgba[si + 2] ?? 0;
      out[di + 3] = 255;
    }
  }
  return { data: out, w: BG_W, h: BG_H };
}

/** 第三列：只用色板亮端，测「霓虹式污染」够不够，不加新色。 */
const BRIGHT_END: Record<string, FragmentContamRamp> = {
  'frag-outdoor': {
    deep: [0x1a, 0x6b, 0x5c],
    mid: [0x4a, 0xdf, 0x8a],
    core: [0x3c, 0xff, 0xd4],
    glow: [0xb0, 0xff, 0xf5],
  },
  'frag-clinic': {
    deep: [0x1a, 0x6b, 0x5c],
    mid: [0x2a, 0xe6, 0xc8],
    core: [0x7f, 0xff, 0xee],
    glow: [0xb0, 0xff, 0xf5],
  },
  'frag-metro': {
    deep: [0x1a, 0x7a, 0x9a],
    mid: [0x1a, 0xad, 0x96],
    core: [0x2a, 0xe6, 0xc8],
    glow: [0x7f, 0xff, 0xee],
  },
};

const BLOCK_GAP = 26;
const ROW_GAP = 10;
const MARGIN_L = 18;
const MARGIN_T = 50;
const BLOCKS = 3;
const blockW = BG_W * SCALE;
const rowH = BG_H * SCALE;
const sheetW = MARGIN_L + BLOCKS * blockW + (BLOCKS - 1) * BLOCK_GAP + 18;
const sheetH = MARGIN_T + FRAGMENTS.length * (rowH + ROW_GAP + 12) + 8;

const sheet = makeSheet(sheetW, sheetH, [0x08, 0x0a, 0x0c]);
const INK: Rgb = [0xc8, 0xcd, 0xd4];
const DIM: Rgb = [0x5a, 0x5f, 0x66];
text(sheet, 'SAME CAST ON REAL SORTIE GROUND   ALL THREE USE THE LOCKED PALETTE', MARGIN_L, 10, INK, 2);
const heads = [
  'A SHIPPED RAMP  GROUND TEAL 0.00% ON OUTDOOR / METRO',
  'B COORDINATED  RELATION TO GROUND + CONTRAST FLOOR',
  'C PALETTE BRIGHT END  IS THIS THE NEON YOU MEANT',
];
for (let b = 0; b < BLOCKS; b++) {
  text(sheet, heads[b]!, MARGIN_L + b * (blockW + BLOCK_GAP), 30, DIM, 1);
}

for (let f = 0; f < FRAGMENTS.length; f++) {
  const fragment = FRAGMENTS[f]!;
  const y = MARGIN_T + f * (rowH + ROW_GAP + 12);
  text(sheet, LABEL[fragment]!, MARGIN_L, y - 8, DIM, 1);
  const strip = groundStrip(fragment);
  for (let b = 0; b < BLOCKS; b++) {
    const x = MARGIN_L + b * (blockW + BLOCK_GAP);
    blit(sheet, strip, x, y, SCALE);
    const ramp = b === 0 ? null : b === 1 ? protoContamRamp(fragment) : BRIGHT_END[fragment]!;
    for (let i = 0; i < CAST.length; i++) {
      const c = CAST[i]!;
      const buf = bake(c.family, c.seed, fragment, ramp);
      const cx = x + Math.round((i + 0.5) * (blockW / CAST.length) - (W * SCALE) / 2);
      blit(sheet, buf, cx, y + rowH - H * SCALE, SCALE);
    }
  }
}

save('docs/art/samples/world-coordination.png', sheet);
console.log(`world-coordination.png  ${sheetW}x${sheetH}`);
