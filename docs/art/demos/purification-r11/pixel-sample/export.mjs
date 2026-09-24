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
const manifest = { authoring: 'authored indexed pixel painting; material lighting, receiver shadows and separate atmospheric scattering; no generated image sampled', width: WIDTH, height: HEIGHT, crop: SAMPLE_CROP, states: {}, layers: [] };
const palette = new Set(Object.values(LIGHT_RGB).flat().map(rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')));
let baseMask;
for (const state of ['ambient', 'core', 'intrusion']) {
  const rgba = renderSample(state);
  const surface = renderSample(state, { atmosphere: false });
  const mask = [];
  let occupied = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    if (rgba[p + 3] === 0) continue;
    if (rgba[p + 3] !== 255) throw new Error('Unexpected antialias alpha');
    const x = (p / 4) % WIDTH, y = Math.floor(p / 4 / WIDTH);
    if (x < SAMPLE_CROP.x || x >= SAMPLE_CROP.x + SAMPLE_CROP.width || y < SAMPLE_CROP.y || y >= SAMPLE_CROP.y + SAMPLE_CROP.height) throw new Error('Paint escaped sample bounds');
    const color = '#' + [...surface.slice(p, p + 3)].map(v => v.toString(16).padStart(2, '0')).join('');
    if (!palette.has(color)) throw new Error(`Color outside designed ramps: ${color}`);
    if (surface[p + 3] !== rgba[p + 3]) throw new Error('Air changed the silhouette');
    mask.push(p / 4); occupied++;
  }
  const maskHash = crypto.createHash('sha256').update(JSON.stringify(mask)).digest('hex');
  if (baseMask && maskHash !== baseMask) throw new Error('Lighting state changed the sample footprint');
  baseMask = maskHash;
  await sharp(Buffer.from(rgba), format).png().toFile(path.join(output, `sample-${state}.png`));
  await sharp(Buffer.from(rgba), format).extract({ left: SAMPLE_CROP.x, top: SAMPLE_CROP.y, width: SAMPLE_CROP.width, height: SAMPLE_CROP.height }).png().toFile(path.join(output, `detail-${state}.png`));
  await sharp(Buffer.from(surface), format).png().toFile(path.join(output, `surface-${state}.png`));
  manifest.states[state] = { occupied, maskHash, rgbaHash: crypto.createHash('sha256').update(rgba).digest('hex') };
}
await sharp(Buffer.from(renderSample('core', { player: true })), format)
  .extract({ left: SAMPLE_CROP.x, top: SAMPLE_CROP.y, width: SAMPLE_CROP.width, height: SAMPLE_CROP.height })
  .png().toFile(path.join(output, 'master-with-player.png'));
await sharp(path.join(output, 'master-with-player.png'))
  .resize(SAMPLE_CROP.width * 2, SAMPLE_CROP.height * 2, { kernel: 'nearest' })
  .png().toFile(path.join(output, 'master-preview.png'));
const layers = buildSample().layers;
for (const layer of layers) {
  await sharp(Buffer.from(renderLayer(layer, 'intrusion')), format).png().toFile(path.join(output, 'layers', `${layer.name}.png`));
  manifest.layers.push(layer.name);
}
for (const [name, mask] of Object.entries(buildSample().fields)) {
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let y = SAMPLE_CROP.y; y < SAMPLE_CROP.y + SAMPLE_CROP.height; y++) {
    for (let x = SAMPLE_CROP.x; x < SAMPLE_CROP.x + SAMPLE_CROP.width; x++) {
      const i = y * WIDTH + x;
      if (!Number.isFinite(mask[i]) || mask[i] < -0.00001 || mask[i] > 1.00001) throw new Error(`Invalid ${name} light mask`);
      rgba.set([255, 255, 255, Math.round(Math.min(1, Math.max(0, mask[i])) * 255)], i * 4);
    }
  }
  await sharp(Buffer.from(rgba), format).png().toFile(path.join(output, `${name}-shadow-mask.png`));
}
manifest.lightMasks = ['cast-shadow-mask.png', 'contact-shadow-mask.png', 'wall-shadow-mask.png'];
manifest.passes = ['surface-{state}.png: lit materials before air', 'sample-{state}.png: final light and air', 'master-with-player.png: cropped core state with existing actor'];
const indices = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
const normals = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
for (const layer of layers) {
  if (layer.name === 'intrusion' || layer.name === 'contact-shadows') continue;
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
console.log(`Exported 3 states, ${layers.length} authored layers, material/normal/shadow maps and actor composite; surface ramps and final masks checked.`);
