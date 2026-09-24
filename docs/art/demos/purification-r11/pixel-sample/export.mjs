import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { buildSample, renderSample, renderLayer, SAMPLE_CROP, WIDTH, HEIGHT } from './scene.ts';
import { LIGHT_RGB, POLLUTION_RGB } from './palette.ts';
import { MATERIALS } from './raster.ts';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output' || !args[1])) {
  throw new Error('Usage: node --import tsx export.mjs [--output DIRECTORY]');
}
const output = args.length ? path.resolve(args[1]) : path.join(dir, 'assets');
await fs.mkdir(path.join(output, 'layers'), { recursive: true });
const format = { raw: { width: WIDTH, height: HEIGHT, channels: 4 } };
const manifest = { authoring: 'authored pixel surfaces with fractional pigment tones, normals and material parameters; directed material lighting, receiver shadows and separate atmospheric scattering; no generated image sampled', width: WIDTH, height: HEIGHT, crop: SAMPLE_CROP, states: {}, layers: [] };
manifest.sourceAuthority = 'The TypeScript surface definitions and renderer are authoritative. PNG maps are quantized interchange/debug views, not source data for reconstructing the authored surfaces.';
const layers = buildSample().layers;
for (const layer of layers) {
  if (layer.width !== WIDTH || layer.height !== HEIGHT) throw new Error(`Invalid ${layer.name} dimensions`);
  for (const channel of ['mat', 'tone', 'normalX', 'normalY', 'normalZ', 'light', 'emission', 'roughness', 'occlusion', 'specular']) {
    if (layer[channel].length !== WIDTH * HEIGHT) throw new Error(`Invalid ${layer.name}.${channel} length`);
  }
  for (let i = 0; i < layer.mat.length; i++) {
    if (!layer.mat[i]) continue;
    const at = `${layer.name} at ${i % WIDTH},${Math.floor(i / WIDTH)}`;
    if (!Number.isInteger(layer.mat[i]) || layer.mat[i] < 1 || layer.mat[i] > MATERIALS.length) throw new Error(`Invalid material: ${at}`);
    if (!Number.isFinite(layer.tone[i]) || layer.tone[i] < 0 || layer.tone[i] > 7) throw new Error(`Invalid tone: ${at}`);
    for (const channel of ['normalX', 'normalY', 'normalZ']) {
      if (!Number.isInteger(layer[channel][i]) || layer[channel][i] < -127 || layer[channel][i] > 127) throw new Error(`Invalid ${channel}: ${at}`);
    }
    if (layer.normalX[i] === 0 && layer.normalY[i] === 0 && layer.normalZ[i] === 0) throw new Error(`Zero surface normal: ${at}`);
    for (const channel of ['light', 'roughness', 'occlusion', 'specular']) {
      if (!Number.isInteger(layer[channel][i]) || layer[channel][i] < 0 || layer[channel][i] > 255) throw new Error(`Invalid ${channel}: ${at}`);
    }
    if (layer.emission[i] !== 0 && layer.emission[i] !== 1) throw new Error(`Invalid emission: ${at}`);
  }
}
const palette = new Set([...Object.values(LIGHT_RGB).flat(), ...Object.values(POLLUTION_RGB).flat(2)].map(rgb => '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')));
let baseMask;
for (const state of ['ambient', 'core', 'intrusion']) {
  const rgba = renderSample(state);
  const surface = renderSample(state, { atmosphere: false });
  const mask = [];
  let occupied = 0;
  for (let p = 0; p < rgba.length; p += 4) {
    if (surface[p + 3] !== rgba[p + 3]) throw new Error('Air changed the silhouette');
    if (rgba[p + 3] === 0) continue;
    if (rgba[p + 3] !== 255) throw new Error('Unexpected antialias alpha');
    const x = (p / 4) % WIDTH, y = Math.floor(p / 4 / WIDTH);
    if (x < SAMPLE_CROP.x || x >= SAMPLE_CROP.x + SAMPLE_CROP.width || y < SAMPLE_CROP.y || y >= SAMPLE_CROP.y + SAMPLE_CROP.height) throw new Error('Paint escaped sample bounds');
    const color = '#' + [...surface.slice(p, p + 3)].map(v => v.toString(16).padStart(2, '0')).join('');
    if (!palette.has(color)) throw new Error(`Color outside designed ramps: ${color}`);
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
const finish = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
for (const layer of layers) {
  if (layer.name === 'intrusion' || layer.name === 'contact-shadows') continue;
  for (let y = SAMPLE_CROP.y; y < SAMPLE_CROP.y + SAMPLE_CROP.height; y++) {
    for (let x = SAMPLE_CROP.x; x < SAMPLE_CROP.x + SAMPLE_CROP.width; x++) {
      const i = y * WIDTH + x, p = i * 4;
      if (!layer.mat[i]) continue;
      indices.set([layer.mat[i], Math.round(layer.tone[i] / 7 * 255), layer.emission[i], 255], p);
      normals.set([layer.normalX[i] + 128, layer.normalY[i] + 128, layer.normalZ[i] + 128, 255], p);
      finish.set([layer.roughness[i], layer.occlusion[i], layer.specular[i], 255], p);
    }
  }
}
await sharp(Buffer.from(indices), format).png().toFile(path.join(output, 'material-tone-emission.png'));
await sharp(Buffer.from(normals), format).png().toFile(path.join(output, 'surface-normals.png'));
await sharp(Buffer.from(finish), format).png().toFile(path.join(output, 'roughness-occlusion-specular.png'));
manifest.mapCoverage = 'Topmost occupied base surface in layer order; intrusion and contact-shadow receiver masks are excluded. Alpha is 255 for occupied pixels and 0 elsewhere.';
manifest.materialMap = { file: 'material-tone-emission.png', red: 'material index, 1-based', green: 'Float32 paint tone quantized to round(tone / 7 × 255); decode byte × 7 / 255, maximum quantization error 7 / 510', blue: 'emission flag 0 or 1' };
manifest.normalMap = { file: 'surface-normals.png', rgb: 'Signed normal components quantized to round(component × 127), then offset by 128. Decode (byte - 128) / 127 and normalize the resulting vector as the renderer does.' };
manifest.surfaceParameters = { file: 'roughness-occlusion-specular.png', red: 'roughness', green: 'occlusion visibility: 0 fully occluded, 1 unoccluded', blue: 'specular response', quantization: 'The rasterizer stores round(clamp(source, 0, 1) × 255); decode byte / 255. The PNG preserves those stored unsigned bytes exactly.' };
if (new Set(Object.values(manifest.states).map(state => state.rgbaHash)).size !== 3) throw new Error('Three states are not distinct');
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Exported 3 states, ${layers.length} authored layers, material/normal/roughness-occlusion-specular/shadow maps and actor composite to ${output}; source channels, surface ramps and final masks checked.`);
