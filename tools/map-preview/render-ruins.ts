/**
 * Paint C2 ruins with floor/wall hierarchy (not flat occupancy).
 *
 *   npm run preview:ruins
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateRuins } from '../../src/generation/ruins.ts';
import { paintRuinedMask } from '../../src/generation/preview-paint.ts';
import { writePng } from './png.ts';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '../../docs/art/demos/slice-6-outline');
/** I6-G：四张可生成。居民区公寓保持未启用，禁止进入残墟生成器枚举。 */
const TYPES = ['frag-outdoor', 'frag-clinic', 'frag-metro', 'frag-library'] as const;
const SEEDS = [101, 202, 303, 404, 505, 606];

mkdirSync(DIR, { recursive: true });
const manifest: Array<{ seed: number; type: string; file: string; features: string }> = [];

for (const type of TYPES) {
  for (const seed of SEEDS) {
    const mask = generateRuins(seed, type);
    const painted = paintRuinedMask(mask, 16);
    const short = type.replace('frag-', '');
    const file = `c2-${short}-${seed}.png`;
    writePng(join(DIR, file), Buffer.from(painted.rgba), painted.width, painted.height);
    manifest.push({
      seed,
      type,
      file,
      features: mask.features.map((f) => f.kind).join('+'),
    });
  }
}

writeFileSync(join(DIR, 'c2-manifest.json'), JSON.stringify({ seeds: manifest }, null, 2));
console.log(`wrote ${manifest.length} C2 pngs in ${DIR}`);
