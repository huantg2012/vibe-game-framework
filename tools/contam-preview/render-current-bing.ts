/**
 * Sample 2 — what 丙 actually looks like today.
 * 3 substrates × 3 覆盖深度 × 3 连续性. `substrateShape()` has exactly three
 * branches and two of them are `thin: true` flat bands, so 油膜 / 灰幕 collapse
 * onto one shape identity.
 */

import type { ContaminationForm } from '@/generation/contamination-draw';
import type { FormAttachContext, FormVisualPose } from '@/entities/form-renderers/form-renderer';
import type { ContinuityId } from '@/generated/contamination-lexicon-data';
import { bingRecipeFromForm } from '@/entities/form-renderers/d/bing-dialect';
import { layoutBingOrganisms } from '@/entities/form-renderers/d/bing-shape';
import {
  deformBingOrganisms,
  makeBingPulseField,
  paintBingFrame,
} from '@/entities/form-renderers/d/bing-paint';
import { yardSurfaceColors } from '@/entities/form-renderers/d/fragment-ramp';
import { blit, fillRect, makeSheet, save, text, type Rgb } from './sheet';

const FRAGMENT = 'frag-clinic';
const SEED = 20260822;
const SUBSTRATES = ['fungal_mat', 'oil_film', 'ash_veil'] as const;
const SUB_LABEL: Record<string, string> = {
  fungal_mat: 'FUNGAL MAT',
  oil_film: 'OIL FILM',
  ash_veil: 'ASH VEIL',
};
const COVERAGES = ['infiltrate', 'rewrite', 'overwrite'] as const;
const CONTINUITIES: readonly ContinuityId[] = ['monolith', 'colony', 'field'];

const SCALE = 2;
const CELL = 144;
const CELL_PX = CELL * SCALE;
const GAP = 4;
const GROUP_GAP = 28;
const MARGIN_L = 48;
const MARGIN_T = 56;
const INK: Rgb = [0xc8, 0xcd, 0xd4];
const DIM: Rgb = [0x5a, 0x5f, 0x66];

function formOf(
  substrate: string,
  coverage: (typeof COVERAGES)[number],
  continuity: ContinuityId,
): ContaminationForm {
  return {
    substrate,
    coverage,
    continuity,
    occupancy: 'paint',
    portfolio: 'bing',
    lexemes: {
      motion: 'motion_cluster',
      sense: 'sense_narrow',
      rhythm: 'rhythm_cluster',
      contact: 'contact_step_chaos',
    },
  };
}

const ctx = { seed: SEED, fragmentTypeId: FRAGMENT } as unknown as FormAttachContext;
const pose: FormVisualPose = {
  x: 0,
  y: 0,
  facing4: 'down',
  moving: false,
  visibility: 1,
  signal: 'idle',
  deltaMs: 16,
};

function bake(substrate: string, coverage: (typeof COVERAGES)[number], continuity: ContinuityId) {
  const form = formOf(substrate, coverage, continuity);
  const recipe = bingRecipeFromForm(form, ctx);
  const w = CELL;
  const h = CELL;
  const organisms = layoutBingOrganisms(recipe, SEED);
  const field = makeBingPulseField(w, h, organisms, recipe);
  const out = new Uint8ClampedArray(w * h * 4);
  deformBingOrganisms(organisms, recipe, pose, 0, w / 2, h / 2);
  paintBingFrame(out, w, h, field, organisms, recipe, pose, 0, SEED);
  return { data: out, w, h };
}

const groupW = CONTINUITIES.length * CELL_PX + (CONTINUITIES.length - 1) * GAP;
const sheetW = MARGIN_L + SUBSTRATES.length * groupW + (SUBSTRATES.length - 1) * GROUP_GAP + 16;
const sheetH = MARGIN_T + COVERAGES.length * (CELL_PX + GAP) - GAP + 18;

const floor = yardSurfaceColors(FRAGMENT).floor;
const sheet = makeSheet(sheetW, sheetH, [0x0a, 0x0b, 0x0d]);
text(sheet, 'CURRENT BING  3 SUBSTRATES X 3 COVERAGE X 3 CONTINUITY', MARGIN_L, 12, INK, 2);

for (let s = 0; s < SUBSTRATES.length; s++) {
  const substrate = SUBSTRATES[s]!;
  const gx = MARGIN_L + s * (groupW + GROUP_GAP);
  text(sheet, SUB_LABEL[substrate]!, gx, 30, INK, 2);
  for (let k = 0; k < CONTINUITIES.length; k++) {
    const continuity = CONTINUITIES[k]!;
    const cx = gx + k * (CELL_PX + GAP);
    text(sheet, continuity.slice(0, 8), cx + 2, 46, DIM, 1);
    for (let c = 0; c < COVERAGES.length; c++) {
      const cy = MARGIN_T + c * (CELL_PX + GAP);
      fillRect(sheet, cx, cy, CELL_PX, CELL_PX, floor);
      blit(sheet, bake(substrate, COVERAGES[c]!, continuity), cx, cy, SCALE);
      if (s === 0 && k === 0) {
        text(sheet, COVERAGES[c]!.slice(0, 5), 6, cy + CELL_PX / 2, DIM, 1);
      }
    }
  }
}

save('docs/art/samples/current-bing.png', sheet);
console.log(`current-bing.png  ${sheetW}x${sheetH}`);
