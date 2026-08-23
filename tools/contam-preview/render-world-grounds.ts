/**
 * 五张世界碎片的**真实**地面（走 generateRuins → paintRuinedMask 的出击同一条路径），
 * 用来回答「污染体配色要与世界协同」协同的是什么。
 * 同时打印每张碎片地面的主色统计，供设计协同规则用，不靠猜。
 */

import { generateRuins } from '@/generation/ruins';
import { paintRuinedMask } from '@/generation/preview-paint';
import { blit, makeSheet, save, text, type Rgb } from './sheet';

// library / residential 在 `rift-fragments.csv` 里 enabled=false，`generateRuins` 会抛。
// 所以出击里真正会遇到的世界只有三张。
const FRAGMENTS = ['frag-outdoor', 'frag-clinic', 'frag-metro'] as const;
const LABEL: Record<string, string> = {
  'frag-outdoor': 'OUTDOOR / SOIL',
  'frag-clinic': 'CLINIC / TILE',
  'frag-metro': 'METRO / METAL',
  'frag-library': 'LIBRARY / WOOD',
  'frag-residential': 'RESIDENTIAL / PLASTER',
};

const T = 16;
const CROP_TILES_W = 14;
const CROP_TILES_H = 10;
const CROP_W = CROP_TILES_W * T;
const CROP_H = CROP_TILES_H * T;
const SCALE = 2;
const SEED = 404;

interface Crop {
  readonly data: Uint8ClampedArray;
  readonly w: number;
  readonly h: number;
}

function bakeCrop(fragmentTypeId: string): { crop: Crop; stats: string } {
  const mask = generateRuins(SEED, fragmentTypeId);
  const painted = paintRuinedMask(mask, T);
  const cols = mask.outline.cols;
  const rows = mask.outline.rows;

  // 找一片地板最密的窗口，避免裁到大片墙或图外。
  let bestCol = 0;
  let bestRow = 0;
  let bestScore = -1;
  for (let r = 0; r + CROP_TILES_H <= rows; r += 2) {
    for (let c = 0; c + CROP_TILES_W <= cols; c += 2) {
      let score = 0;
      for (let j = 0; j < CROP_TILES_H; j++) {
        for (let i = 0; i < CROP_TILES_W; i++) {
          const idx = (r + j) * cols + (c + i);
          if (mask.outline.land[idx] && !mask.walls[idx]) score += 1;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestCol = c;
        bestRow = r;
      }
    }
  }

  const ox = bestCol * T;
  const oy = bestRow * T;
  const out = new Uint8ClampedArray(CROP_W * CROP_H * 4);
  const hist = new Map<string, number>();
  let sr = 0;
  let sg = 0;
  let sb = 0;
  for (let y = 0; y < CROP_H; y++) {
    for (let x = 0; x < CROP_W; x++) {
      const si = ((oy + y) * painted.width + (ox + x)) * 4;
      const di = (y * CROP_W + x) * 4;
      const r = painted.rgba[si] ?? 0;
      const g = painted.rgba[si + 1] ?? 0;
      const b = painted.rgba[si + 2] ?? 0;
      out[di] = r;
      out[di + 1] = g;
      out[di + 2] = b;
      out[di + 3] = 255;
      sr += r;
      sg += g;
      sb += b;
      const key = `${r},${g},${b}`;
      hist.set(key, (hist.get(key) ?? 0) + 1);
    }
  }
  const n = CROP_W * CROP_H;
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const hex = (k: string): string =>
    '#' + k.split(',').map((v) => Number(v).toString(16).padStart(2, '0')).join('');
  const mean = `mean #${[sr / n, sg / n, sb / n].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const tops = top.map(([k, c]) => `${hex(k)} ${((c / n) * 100).toFixed(0)}%`).join('  ');
  return { crop: { data: out, w: CROP_W, h: CROP_H }, stats: `${mean}   ${tops}` };
}

const GAP = 8;
const MARGIN_T = 34;
const sheetW = FRAGMENTS.length * (CROP_W * SCALE + GAP) - GAP + 32;
const sheetH = MARGIN_T + CROP_H * SCALE + 20;
const sheet = makeSheet(sheetW, sheetH, [0x08, 0x0a, 0x0c]);
const INK: Rgb = [0xc8, 0xcd, 0xd4];
const DIM: Rgb = [0x5a, 0x5f, 0x66];

text(sheet, 'REAL SORTIE GROUND  FIVE WORLD FRAGMENTS  SEED 404  AGE=STANDARD RUIN=BROKEN', 16, 10, INK, 2);

for (let i = 0; i < FRAGMENTS.length; i++) {
  const id = FRAGMENTS[i]!;
  const { crop, stats } = bakeCrop(id);
  const x = 16 + i * (CROP_W * SCALE + GAP);
  text(sheet, LABEL[id]!.split(' / ')[1]!, x, 24, DIM, 1);
  blit(sheet, crop, x, MARGIN_T, SCALE);
  console.log(`${id.padEnd(18)} ${stats}`);
}

save('docs/art/samples/world-grounds.png', sheet);
console.log(`world-grounds.png  ${sheetW}x${sheetH}`);

// 青绿家族像素占比：验证「ramp 塌成灰」在地面上的后果。
const TEAL_FAMILY = ['#0e4a3f', '#1a6b5c', '#1aad96', '#2ae6c8', '#3cffd4', '#7fffee', '#b0fff5', '#4adf8a', '#1a7a9a'];
const tealSet = new Set(TEAL_FAMILY);
console.log('');
console.log('地面青绿家族像素占比（污染簇是否真的是青绿）：');
for (const id of FRAGMENTS) {
  const mask = generateRuins(SEED, id);
  const painted = paintRuinedMask(mask, T);
  let teal = 0;
  const n = painted.width * painted.height;
  for (let i = 0; i < n; i++) {
    const hex =
      '#' +
      [painted.rgba[i * 4]!, painted.rgba[i * 4 + 1]!, painted.rgba[i * 4 + 2]!]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('');
    if (tealSet.has(hex)) teal += 1;
  }
  console.log(`  ${id.padEnd(16)} ${((teal / n) * 100).toFixed(2)}%`);
}
