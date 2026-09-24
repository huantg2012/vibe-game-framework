import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { buildSample, renderSample, renderLayer, SAMPLE_CROP, WIDTH, HEIGHT } from './scene.ts';
import { LIGHT_RGB } from './palette.ts';

const dir = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(dir, 'assets');
await fs.mkdir(path.join(output, 'layers'), { recursive: true });
const format = { raw: { width: WIDTH, height: HEIGHT, channels: 4 } };
const manifest = { authoring: 'indexed pixel shapes; no generated image sampled', width: WIDTH, height: HEIGHT, crop: SAMPLE_CROP, states: {}, layers: [] };
const palette = new Set(Object.values(LIGHT_RGB).flat().map(rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')));
let baseMask;
for (const state of ['ambient', 'core', 'intrusion']) {
  const rgba = renderSample(state);
  const mask = [];
  let occupied = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    if (rgba[p + 3] === 0) continue;
    if (rgba[p + 3] !== 255) throw new Error('Unexpected antialias alpha');
    const x = (p / 4) % WIDTH, y = Math.floor(p / 4 / WIDTH);
    if (x < SAMPLE_CROP.x || x >= SAMPLE_CROP.x + SAMPLE_CROP.width || y < SAMPLE_CROP.y || y >= SAMPLE_CROP.y + SAMPLE_CROP.height) throw new Error('Paint escaped sample bounds');
    const color = '#' + [...rgba.slice(p, p + 3)].map(v => v.toString(16).padStart(2, '0')).join('');
    if (!palette.has(color)) throw new Error(`Color outside designed ramps: ${color}`);
    mask.push(p / 4); occupied++;
  }
  const maskHash = crypto.createHash('sha256').update(JSON.stringify(mask)).digest('hex');
  if (baseMask && maskHash !== baseMask) throw new Error('Lighting state changed the sample footprint');
  baseMask = maskHash;
  await sharp(Buffer.from(rgba), format).png().toFile(path.join(output, `sample-${state}.png`));
  await sharp(Buffer.from(rgba), format).extract({ left: SAMPLE_CROP.x, top: SAMPLE_CROP.y, width: SAMPLE_CROP.width, height: SAMPLE_CROP.height }).png().toFile(path.join(output, `detail-${state}.png`));
  manifest.states[state] = { occupied, maskHash, rgbaHash: crypto.createHash('sha256').update(rgba).digest('hex') };
}
const layers = buildSample().layers;
for (const layer of layers) {
  await sharp(Buffer.from(renderLayer(layer, 'intrusion')), format).png().toFile(path.join(output, 'layers', `${layer.name}.png`));
  manifest.layers.push(layer.name);
}
const indices = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
const normals = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
for (const layer of layers) {
  if (layer.name === 'intrusion') continue;
  for (let y = SAMPLE_CROP.y; y < SAMPLE_CROP.y + SAMPLE_CROP.height; y++) {
    for (let x = SAMPLE_CROP.x; x < SAMPLE_CROP.x + SAMPLE_CROP.width; x++) {
      const i = y * WIDTH + x, p = i * 4;
      if (!layer.mat[i]) continue;
      indices.set([layer.mat[i], layer.tone[i], layer.emission[i], 255], p);
      normals.set([layer.normalX[i] + 128, layer.normalY[i] + 128, layer.normalZ[i] + 128, 255], p);
    }
  }
}
await sharp(Buffer.from(indices), format).png().toFile(path.join(output, 'material-tone-emission.png'));
await sharp(Buffer.from(normals), format).png().toFile(path.join(output, 'surface-normals.png'));
if (new Set(Object.values(manifest.states).map(state => state.rgbaHash)).size !== 3) throw new Error('Three states are not distinct');
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Exported 3 palette-constrained states, ${layers.length} independent layers and surface maps.`);
