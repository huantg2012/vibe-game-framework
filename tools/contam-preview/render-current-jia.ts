/**
 * Sample 1 — what 甲 actually looks like today.
 * 5 substrates × 3 族内变体 × 3 覆盖深度 = 45 frames, one sheet.
 * Read the columns: coverage never reaches `paintJiaSilhouette`, so the outline
 * inside each family block is one drawing repeated three times.
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import { mix32 } from '@/generation/seed-fork';
import { bakeJiaBase } from '@/entities/form-renderers/d/jia-paint';
import { jiaRecipeFromForm, JIA_FAMILIES } from '@/entities/form-renderers/d/jia-recipe';
import { yardSurfaceColors } from '@/entities/form-renderers/d/fragment-ramp';
import { blit, fillRect, makeSheet, save, text, type Rgb } from './sheet';

const FRAGMENT = 'frag-clinic';
const COVERAGES = ['infiltrate', 'rewrite', 'overwrite'] as const;
const COVER_LABEL: Record<string, string> = {
  infiltrate: 'INFILTRATE',
  rewrite: 'REWRITE',
  overwrite: 'OVERWRITE',
};
const FAMILY_LABEL: Record<string, string> = {
  organic_remnant: 'ORGANIC',
  stalk_clump: 'STALK',
  lamp_pillar: 'LAMP',
  railing_post: 'RAIL',
  doorframe: 'DOOR',
};

const SCALE = 4;
const CELL_W = 32 * SCALE;
const CELL_H = 48 * SCALE;
const GAP = 4;
const GROUP_GAP = 30;
const MARGIN_L = 44;
const MARGIN_T = 54;
const INK: Rgb = [0xc8, 0xcd, 0xd4];
const DIM: Rgb = [0x5a, 0x5f, 0x66];

function seedForVariant(substrate: string, variant: number): number {
  for (let seed = 1; seed < 8192; seed++) {
    if (mix32(seed, substrate) % 3 === variant) return seed;
  }
  throw new Error(`no seed for ${substrate} v${variant}`);
}

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

const groupW = COVERAGES.length * CELL_W + (COVERAGES.length - 1) * GAP;
const sheetW = MARGIN_L + JIA_FAMILIES.length * groupW + (JIA_FAMILIES.length - 1) * GROUP_GAP + 16;
const sheetH = MARGIN_T + 3 * (CELL_H + GAP) - GAP + 18;

const floor = yardSurfaceColors(FRAGMENT).floor;
const sheet = makeSheet(sheetW, sheetH, [0x0a, 0x0b, 0x0d]);

text(sheet, 'CURRENT JIA  5 SUBSTRATES X 3 VARIANTS X 3 COVERAGE', MARGIN_L, 12, INK, 2);

for (let f = 0; f < JIA_FAMILIES.length; f++) {
  const family = JIA_FAMILIES[f]!;
  const gx = MARGIN_L + f * (groupW + GROUP_GAP);
  text(sheet, FAMILY_LABEL[family] ?? family, gx, 30, INK, 2);
  for (let c = 0; c < COVERAGES.length; c++) {
    const coverage = COVERAGES[c]!;
    const cx = gx + c * (CELL_W + GAP);
    text(sheet, COVER_LABEL[coverage]!.slice(0, 5), cx + 2, 44, DIM, 1);
    for (let v = 0; v < 3; v++) {
      const cy = MARGIN_T + v * (CELL_H + GAP);
      fillRect(sheet, cx, cy, CELL_W, CELL_H, floor);
      const seed = seedForVariant(family, v);
      const recipe = jiaRecipeFromForm(formOf(family, coverage), seed, FRAGMENT);
      const buf = bakeJiaBase(recipe, 'down', 'idle', 0, 'patrol');
      blit(sheet, buf, cx, cy + (CELL_H - buf.h * SCALE), SCALE);
      if (f === 0 && c === 0) text(sheet, `V${v}`, 8, cy + CELL_H / 2, DIM, 2);
    }
  }
}

save('docs/art/samples/current-jia.png', sheet);
console.log(`current-jia.png  ${sheetW}x${sheetH}`);
