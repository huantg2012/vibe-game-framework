import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateEdgeStudy, PREVIEW_SEEDS } from './edge-treatment.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const geometry = JSON.parse(fs.readFileSync(path.join(directory, 'geometry.json'), 'utf8'));
const seeds = PREVIEW_SEEDS;
const samples = seeds.map(seed => generateEdgeStudy(geometry, seed));
const [width, height] = geometry.authoringFrame;
const makeSvg = sample => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>矩形骨架的局部断缘打磨；种子 ${sample.seed}；白地黑空</title><rect width="${width}" height="${height}" fill="black"/><path d="${sample.pathD}" fill="white" fill-rule="evenodd"/></svg>`;
for (let i = 0; i < samples.length; i++) {
  const sample = samples[i];
  const basename = i === 0 ? 'polished' : `polished-${sample.seed}`;
  const svg = makeSvg(sample);
  fs.writeFileSync(path.join(directory, `${basename}.svg`), `${svg}\n`);
  await sharp(Buffer.from(svg)).png().toFile(path.join(directory, `${basename}.png`));
}
fs.writeFileSync(path.join(directory, 'edge-samples.json'), JSON.stringify({
  scope: 'Local edge study only. Rectangle layout fixed; seeds change edge treatment, not map generation.',
  seeds,
  samples,
}, null, 2) + '\n');
console.log(JSON.stringify(samples.map(({seed, stats}) => ({seed, ...stats})), null, 2));
