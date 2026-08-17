/**
 * Raster the C1 game generator (not the design-preview script).
 *
 *   npm run preview:outline
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateOutline } from '../../src/generation/outline-mask.ts';
import { writePng } from './png.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../docs/art/demos/slice-6-outline');
const SCALE = 8;
const VOID = [8, 10, 12] as const;
const LAND = [26, 30, 24] as const;
const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808];

function raster(land: Uint8Array, cols: number, rows: number): { rgba: Buffer; pw: number; ph: number } {
  const pw = cols * SCALE;
  const ph = rows * SCALE;
  const rgba = Buffer.alloc(pw * ph * 4);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = land[y * cols + x] ? LAND : VOID;
      for (let sy = 0; sy < SCALE; sy++) {
        for (let sx = 0; sx < SCALE; sx++) {
          const o = ((y * SCALE + sy) * pw + (x * SCALE + sx)) * 4;
          rgba[o] = c[0];
          rgba[o + 1] = c[1];
          rgba[o + 2] = c[2];
          rgba[o + 3] = 255;
        }
      }
    }
  }
  return { rgba, pw, ph };
}

mkdirSync(DIR, { recursive: true });
const manifest: Array<{ seed: number; file: string; attempt: number; fill: string }> = [];

for (const seed of SEEDS) {
  const mask = generateOutline(seed);
  const { rgba, pw, ph } = raster(mask.land, mask.cols, mask.rows);
  const file = `c1-${seed}.png`;
  writePng(join(DIR, file), rgba, pw, ph);
  manifest.push({
    seed,
    file,
    attempt: mask.attempt,
    fill: mask.metrics.fillRatio.toFixed(3),
  });
}

writeFileSync(join(DIR, 'c1-manifest.json'), JSON.stringify({ seeds: manifest }, null, 2));
console.log(`wrote ${manifest.length} C1 pngs in ${DIR}`);
