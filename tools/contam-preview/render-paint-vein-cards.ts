/**
 * 油膜抽卡六支对照（与 gym `?lesson=paint-vein-card` 同参数：种子 1000 / 改写 / 菌落 / 触地 / 随簇呼吸）。
 * 第一轮 A/B/C = 树参数 tweak（cursor-grok-4.6-xhigh-fast）；第二轮 D/E/F = 从「油膜做污染体基底」
 * 原初 idea 重推（kimi-k3）：聚珠成滩 / 沾抹拖尾 / 薄滩收边。DEFAULT = 现行拓扑（闸门身份）。
 */
import { bakePaintGenome } from '@/entities/form-renderers/d/paint-genome/bake';
import type { PaintVeinVariant } from '@/entities/form-renderers/d/paint-genome/topology';
import { blit, fillRect, makeSheet, save, text, type Rgb } from './sheet';

const SEED = 1000;
const VARIANTS: { v: PaintVeinVariant | undefined; label: string }[] = [
  { v: undefined, label: 'DEFAULT' },
  { v: 0, label: 'A FLAT' },
  { v: 1, label: 'B SHEEN' },
  { v: 2, label: 'C CONVERGE' },
  { v: 3, label: 'D BEADS' },
  { v: 4, label: 'E SMEAR' },
  { v: 5, label: 'F RIMPOOL' },
];

const SCALE = 3;
const CELL = 88;
const CELL_PX = CELL * SCALE;
const GAP = 8;
const MARGIN_T = 24;
const INK: Rgb = [0xc8, 0xcd, 0xd4];

const sheetW = 16 + VARIANTS.length * (CELL_PX + GAP);
const sheetH = MARGIN_T + CELL_PX + 16;
const sheet = makeSheet(sheetW, sheetH, [0x0a, 0x0b, 0x0d]);

for (let i = 0; i < VARIANTS.length; i++) {
  const { v, label } = VARIANTS[i]!;
  const x = 8 + i * (CELL_PX + GAP);
  text(sheet, label, x, 8, INK, 1);
  fillRect(sheet, x, MARGIN_T, CELL_PX, CELL_PX, [0x14, 0x16, 0x1a]);
  const r = bakePaintGenome({
    substrate: 'oil_film',
    coverage: 'rewrite',
    seed: SEED,
    continuity: 'colony',
    sense: 'sense_touch',
    rhythm: 'rhythm_cluster',
    veinVariant: v,
  });
  blit(sheet, r.buf, x, MARGIN_T, SCALE);
}

save('docs/art/samples/paint-vein-cards.png', sheet);
console.log(`paint-vein-cards.png ${sheetW}x${sheetH}`);
