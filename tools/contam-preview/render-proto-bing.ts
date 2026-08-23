/**
 * Sample 6 — 丙：基体 = 拓扑，覆盖 = 拓扑违规。
 * 与 current-bing.png 同构对照：3 基体 × 3 覆盖度，外加同一格四个 seed。
 */

import { yardSurfaceColors } from '@/entities/form-renderers/d/fragment-ramp';
import { protoContamRamp } from './proto-ramp';
import { bakeBingProto, type Coverage } from './proto-bing';
import { blit, fillRect, makeSheet, save, text, type Rgb } from './sheet';

const FRAGMENT = 'frag-clinic';
const CELL = 96;
const SCALE = 2;
const CELL_PX = CELL * SCALE;
const SUBSTRATES = ['fungal_mat', 'oil_film', 'ash_veil'] as const;
const SUB_LABEL: Record<string, string> = {
  fungal_mat: 'FUNGAL MAT / LOBE MASS',
  oil_film: 'OIL FILM / VEIN TREE',
  ash_veil: 'ASH VEIL / HOLED VEIL',
};
const COVERAGES: readonly Coverage[] = ['infiltrate', 'rewrite', 'overwrite'];
const SEEDS = [7, 4113, 20260822, 99181];

const GAP = 4;
const GROUP_GAP = 30;
const MARGIN_L = 20;
const MARGIN_T = 58;
const INK: Rgb = [0xc8, 0xcd, 0xd4];
const DIM: Rgb = [0x5a, 0x5f, 0x66];

const groupW = SEEDS.length * CELL_PX + (SEEDS.length - 1) * GAP;
const sheetW = MARGIN_L + COVERAGES.length * groupW + (COVERAGES.length - 1) * GROUP_GAP + 16;
const sheetH = MARGIN_T + SUBSTRATES.length * (CELL_PX + 22) + 8;

const floor = yardSurfaceColors(FRAGMENT).floor;
const ramp = protoContamRamp(FRAGMENT);
const sheet = makeSheet(sheetW, sheetH, [0x0a, 0x0b, 0x0d]);
text(sheet, 'PROTO BING  SUBSTRATE PICKS A TOPOLOGY  COVERAGE VIOLATES IT', MARGIN_L, 12, INK, 2);
text(sheet, 'MASS SPLITS INTO A RING / TREE CLOSES A LOOP / RING NESTS A RING', MARGIN_L, 28, DIM, 1);

for (let c = 0; c < COVERAGES.length; c++) {
  const gx = MARGIN_L + c * (groupW + GROUP_GAP);
  text(sheet, COVERAGES[c]!, gx, 44, INK, 2);
}

for (let s = 0; s < SUBSTRATES.length; s++) {
  const substrate = SUBSTRATES[s]!;
  const rowY = MARGIN_T + s * (CELL_PX + 22);
  text(sheet, SUB_LABEL[substrate]!, MARGIN_L, rowY, DIM, 1);
  for (let c = 0; c < COVERAGES.length; c++) {
    for (let k = 0; k < SEEDS.length; k++) {
      const cx = MARGIN_L + c * (groupW + GROUP_GAP) + k * (CELL_PX + GAP);
      const cy = rowY + 10;
      fillRect(sheet, cx, cy, CELL_PX, CELL_PX, floor);
      const buf = bakeBingProto(substrate, COVERAGES[c]!, SEEDS[k]!, ramp, CELL, CELL);
      blit(sheet, buf, cx, cy, SCALE);
    }
  }
}

save('docs/art/samples/proto-bing-topology.png', sheet);
console.log(`proto-bing-topology.png  ${sheetW}x${sheetH}`);
