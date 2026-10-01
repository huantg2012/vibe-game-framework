/** Complete DEV haven pack for the paired opening study. Production assets and
 * navigation are read-only. Actor atlases are copied byte-for-byte, not rebaked.
 * Run: node --import tsx tools/last-light/export-joint.mjs [--check]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { JOINT_AIR, applyJointAir } from './joint-air.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = path.join(root, 'docs/art/demos/opening-joint/assets/haven');
const production = path.join(root, 'public/assets/last-light');
const entry = 'tools/last-light/joint-scene.ts';
const self = 'tools/last-light/export-joint.mjs';
const args = process.argv.slice(2);
if (args.some(arg => !['--check', '--help', '-h'].includes(arg))) throw new Error('Only --check or --help is supported. Output is a fixed DEV directory.');
if (args.includes('--help') || args.includes('-h')) {
  console.log(`Usage: node --import tsx ${self} [--check]\nOutput: ${path.relative(root, output)}\nNever writes production assets or generated navigation.`);
  process.exit(0);
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = async filename => JSON.parse(await fs.readFile(filename, 'utf8'));
const sourceHashes = {};
async function fingerprint(filename) {
  const absolute = path.resolve(root, filename), relative = path.relative(root, absolute).split(path.sep).join('/');
  assert(!relative.startsWith('../') && !path.isAbsolute(relative), `Source outside repository: ${filename}`);
  if (sourceHashes[relative]) return;
  const bytes = await fs.readFile(absolute);
  sourceHashes[relative] = digest(bytes);
  if (!/\.(?:[cm]?js|tsx?)$/.test(relative)) return;
  const imports = /\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"](\.[^'"]+)['"]|\bimport\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
  for (const match of bytes.toString('utf8').matchAll(imports)) {
    const target = path.resolve(path.dirname(absolute), match[1] ?? match[2]);
    let resolved;
    for (const candidate of [target, target + '.ts', target + '.mjs', target + '.js', path.join(target, 'index.ts')]) {
      try { if ((await fs.stat(candidate)).isFile()) { resolved = candidate; break; } }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    assert(resolved, `Unresolved author import in ${relative}: ${target}`);
    await fingerprint(path.relative(root, resolved));
  }
}
const actorManifest = await readJson(path.join(production, 'manifest.json'));
assert.equal(actorManifest.status, 'complete', 'Production actor source must be complete');
const copiedInputs = {};
for (const filename of ['manifest.json', ...new Set(Object.values(actorManifest.actor.textures))]) {
  copiedInputs[`public/assets/last-light/${filename}`] = digest(await fs.readFile(path.join(production, filename)));
}
const navigationFile = 'src/generated/last-light-layout.ts';
copiedInputs[navigationFile] = digest(await fs.readFile(path.join(root, navigationFile)));

async function checkPack(directory) {
  const manifest = await readJson(path.join(directory, 'manifest.json'));
  const checksums = await readJson(path.join(directory, 'checksums.json'));
  assert.equal(manifest.status, 'complete');
  assert.equal(manifest.delivery, 'dev');
  assert.equal(manifest.review.status, 'REVIEW-PENDING', 'Export validation must not imply human art approval');
  assert.equal(manifest.source.entry, entry);
  assert.deepEqual(manifest.camera, actorManifest.camera, 'Playable camera must match retained actor/navigation');
  assert.deepEqual(manifest.actor, actorManifest.actor, 'Actor animation metadata must remain identical');
  assert.deepEqual(checksums.sources, manifest.source.hashes);
  for (const [filename, expected] of Object.entries({ ...checksums.sources, ...checksums.reusedInputs })) {
    assert.equal(digest(await fs.readFile(path.join(root, filename))), expected, `Stale input: ${filename}`);
  }
  for (const [filename, expected] of Object.entries(checksums.outputs)) {
    assert.equal(digest(await fs.readFile(path.join(directory, filename))), expected, `Stale output: ${filename}`);
  }
  for (const filename of Object.values(manifest.actor.textures)) {
    assert.equal(digest(await fs.readFile(path.join(directory, filename))), checksums.reusedInputs[`public/assets/last-light/${filename}`], `Actor atlas was altered: ${filename}`);
  }
  for (const [filename, expected] of Object.entries(checksums.imageDimensions)) {
    const meta = await sharp(path.join(directory, filename)).metadata();
    assert.equal(meta.width, expected.width, `${filename} width`);
    assert.equal(meta.height, expected.height, `${filename} height`);
    assert.equal(meta.channels, 4, `${filename} must preserve four raw channels`);
  }
  const required = new Set([...Object.values(manifest.textures), ...Object.values(manifest.actor.textures), ...manifest.exteriorLayers.map(layer => layer.color)]);
  for (const filename of required) assert(checksums.imageDimensions[filename], `Unvalidated manifest texture: ${filename}`);
  const fields = await readJson(path.join(directory, 'exterior-fields.json'));
  assert.deepEqual(fields.sourceHashes, manifest.source.hashes);
  assert.equal(fields.textureHash, checksums.outputs[fields.texture]);
  assert.deepEqual(fields.columns, ['far', 'middle', 'near', 'haven']);
  assert.deepEqual(fields.rows, ['otherPollution', 'core', 'storage', 'purifier', 'furnace', 'motion', 'normal']);
  assert(manifest.lights.length <= 40, 'Runtime light limit exceeded');
  assert(!manifest.lights.some(light => light.kind === 'shoulder'), 'Shoulder light must follow the real player');
  for (const key of ['core-heart', 'haven-furnace']) assert(manifest.lights.some(light => light.id === key), `Missing ${key}`);
  assert(!manifest.statistics.objects.includes(7), 'Static scene includes baked actor pixels');
  assert(manifest.statistics.energyAdditiveHalo > 100, 'Energy radiance at zero alpha was lost');
  assert.deepEqual(manifest.exteriorAir.parameters, JOINT_AIR, 'Air parameters do not match the world-space author');
  assert.equal(manifest.exteriorAir.textureHash, checksums.outputs['exterior-far.png']);
  const air = manifest.exteriorAir.statistics;
  assert(air.additivePixels > 1000 && air.surfacePixels > 100, 'Air must occupy real gaps and the space before some far surfaces');
  assert(air.truncatedRays > 100 && air.fullyOccludedRays > 100, 'Air was not clipped by the real far geometry');
  for (let channel = 0; channel < 3; channel++) assert(air.maxIncrement[channel] <= JOINT_AIR.maxIncrement[channel], 'Air exceeded the agreed radiance limit');
  const farRgba = await sharp(path.join(directory, 'exterior-far.png')).raw().toBuffer();
  let additivePixels = 0;
  for (let i = 0; i < farRgba.length; i += 4) if (farRgba[i + 3] === 0 && (farRgba[i] || farRgba[i + 1] || farRgba[i + 2])) additivePixels++;
  assert(additivePixels >= air.additivePixels, 'PNG roundtrip lost air radiance at zero alpha');
  console.log(JSON.stringify({ valid: true, output: path.relative(root, output), statistics: manifest.statistics, imageCount: Object.keys(checksums.imageDimensions).length, timing: manifest.timing }, null, 2));
}
if (args.includes('--check')) { await checkPack(output); process.exit(0); }

// Missing joint-scene is deliberately fatal: never silently substitute the old
// scene and label it a new joint study.
await fingerprint(entry);
await fingerprint(self);
await fingerprint('docs/art/demos/purification-last-light/render.ts');
await fingerprint('src/art/last-light-spatial.ts');
await fingerprint('package.json');
await fingerprint('package-lock.json');
const hashes = Object.fromEntries(Object.entries(sourceHashes).sort(([a], [b]) => a.localeCompare(b)));
const { buildJointScene } = await import(pathToFileURL(path.join(root, entry)).href);
assert.equal(typeof buildJointScene, 'function', 'joint-scene must export buildJointScene()');
const { Model } = await import('../../docs/art/demos/purification-last-light/model.ts');
const { CAMERA, project, render } = await import('../../docs/art/demos/purification-last-light/render.ts');
const { ENERGY_FRAMES } = await import('../../docs/art/demos/purification-last-light/energy.ts');
const { LAST_LIGHT_EXTERIOR } = await import('../../src/art/last-light-exterior.ts');
assert.deepEqual(CAMERA, actorManifest.camera, 'Reusing actor atlas requires the production camera');
const author = buildJointScene();
assert(author?.model && author.stations?.length, 'Joint builder must provide its complete model and stations');
const stationIdentity = station => ({ id: station.id, key: station.key, position: station.position, yaw: station.yaw, approach: station.approach });
assert.deepEqual(author.stations.map(stationIdentity), actorManifest.stations.map(stationIdentity), 'DEV visual study may not move functional stations');
const world = new Model();
world.triangles.push(...author.model.triangles.filter(triangle => triangle.object !== 7));
world.lights.push(...author.model.lights.filter(light => light.kind !== 'shoulder'));
world.volumes.push(...author.model.volumes);
assert(world.lights.length <= 40, `Runtime supports 40 lights, joint model has ${world.lights.length}`);
assert(world.volumes.some(volume => volume.object === 1), 'The real volumetric core must survive');
const { width: W, height: H } = CAMERA, padding = 32, PW = W + padding * 2, PH = H + padding * 2;
const columns = ['far', 'middle', 'near', 'haven'];
const rows = ['otherPollution', 'core', 'storage', 'purifier', 'furnace', 'motion', 'normal'];
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'coh-joint-haven-'));
const outputHashes = {}, imageDimensions = {}, timing = {};
const allStarted = performance.now();
async function save(name, data, width = W, height = H) {
  assert.equal(data.length, width * height * 4, `${name}: raw image size`);
  // Raw PNG encoding retains radiance in RGB even at alpha zero. Do not use
  // flatten(), composite(), premultiplication or an HTML canvas intermediary.
  const bytes = await sharp(Buffer.from(data), { raw: { width, height, channels: 4 } }).png().toBuffer();
  await fs.writeFile(path.join(temp, name), bytes);
  outputHashes[name] = digest(bytes);
  imageDimensions[name] = { width, height };
}
async function saveJson(name, value) {
  const bytes = Buffer.from(JSON.stringify(value, null, 2) + '\n');
  await fs.writeFile(path.join(temp, name), bytes);
  outputHashes[name] = digest(bytes);
}
function encodeDepth(frame, depth = frame.opaqueDepth) {
  const out = new Uint8ClampedArray(depth.length * 4);
  for (let i = 0; i < depth.length; i++) {
    if (!Number.isFinite(depth[i])) continue;
    const value = Math.max(1, Math.min(65535, Math.round((depth[i] + 80) * 256)));
    out.set([value >> 8, value & 255, frame.layers[i], 255], i * 4);
  }
  return out;
}
function cropPadded(data) {
  const cropped = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) cropped.set(data.subarray(((y + padding) * PW + padding) * 4, ((y + padding) * PW + padding + W) * 4), y * W * 4);
  return cropped;
}
function bounds(id) {
  const vertices = world.triangles.filter(triangle => triangle.object === id).flatMap(triangle => [triangle.a, triangle.b, triangle.c]).map(point => project(point));
  assert(vertices.length, `Missing object ${id}`);
  const x = Math.max(0, Math.floor(Math.min(...vertices.map(point => point[0]))) - 3);
  const y = Math.max(0, Math.floor(Math.min(...vertices.map(point => point[1]))) - 3);
  return { x, y, width: Math.min(W, Math.ceil(Math.max(...vertices.map(point => point[0]))) + 3) - x,
    height: Math.min(H, Math.ceil(Math.max(...vertices.map(point => point[1]))) + 3) - y };
}
try {
  console.log(`Joint haven: ${world.triangles.length} static triangles, ${world.lights.length} lights. Actor atlas is reused.`);
  let started = performance.now();
  const scene = render(world, CAMERA, message => console.log(`[joint] ${message}`));
  timing.scene = Math.round(performance.now() - started);
  assert.equal(scene.energyFrames.length, ENERGY_FRAMES);
  assert.equal(ENERGY_FRAMES, 8, 'Runtime energy sheet uses four columns and two rows');
  await save('base-before-energy.png', scene.energyBase);
  await save('reference.png', scene.rgba);
  for (const [name, data] of [
    ['albedo.png', scene.albedo], ['normal.png', scene.normal], ['rough-spec.png', scene.roughSpec],
    ['motion.png', scene.motion], ['light-pollution.png', scene.lightFields.pollution], ['light-core.png', scene.coreLight],
    ['light-storage.png', scene.storageLight], ['light-purifier.png', scene.purifierLight], ['light-furnace.png', scene.lightFields.furnace],
  ]) await save(name, data);
  await save('depth.png', encodeDepth(scene));
  const volumeDepth = new Float32Array(scene.depth.length).fill(-Infinity);
  for (let i = 0; i < volumeDepth.length; i++) if (scene.depth[i] > scene.opaqueDepth[i] + .01) volumeDepth[i] = scene.depth[i];
  await save('energy-depth.png', encodeDepth(scene, volumeDepth));
  const objects = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < scene.objects.length; i++) objects.set([scene.objects[i], 0, 0, 255], i * 4);
  await save('objects.png', objects);
  const energy = new Uint8ClampedArray(W * 4 * H * 2 * 4);
  let energyAdditiveHalo = 0;
  for (let frame = 0; frame < ENERGY_FRAMES; frame++) for (let y = 0; y < H; y++) {
    energy.set(scene.energyFrames[frame].subarray(y * W * 4, (y + 1) * W * 4), ((Math.floor(frame / 4) * H + y) * W * 4 + frame % 4 * W) * 4);
  }
  for (let i = 0; i < energy.length; i += 4) if (energy[i + 3] === 0 && (energy[i] || energy[i + 1] || energy[i + 2])) energyAdditiveHalo++;
  await save('core-energy.png', energy, W * 4, H * 2);
  await save('background.png', render(new Model(), CAMERA, undefined, { skipEnergy: true }).rgba);
  const exteriorDepth = new Uint8ClampedArray(PW * PH * columns.length * 4);
  const fields = new Uint8ClampedArray(PW * columns.length * PH * rows.length * 4);
  const paddedCamera = { ...CAMERA, width: PW, height: PH, origin: [CAMERA.origin[0] + padding, CAMERA.origin[1] + padding] };
  let airStatistics;
  for (let column = 0; column < columns.length; column++) {
    const layer = columns[column], plate = new Model();
    plate.triangles.push(...world.triangles.filter(triangle => triangle.layer === layer));
    plate.lights.push(...world.lights);
    if (layer === 'haven') plate.volumes.push(...world.volumes);
    started = performance.now();
    console.log(`[joint] ${layer}: ${plate.triangles.length} triangles, all-world shadow casters.`);
    const frame = render(plate, paddedCamera, undefined, { shadowModel: world, transparentBackground: true, skipEnergy: true, sampleOffset: [padding, padding] });
    if (layer === 'far') {
      const alpha = frame.energyBase.filter((_, i) => i % 4 === 3);
      const beforeDepth = digest(new Uint8Array(frame.depth.buffer));
      airStatistics = applyJointAir(frame.energyBase, frame.depth, paddedCamera);
      assert.deepEqual(frame.energyBase.filter((_, i) => i % 4 === 3), alpha, 'Air may not invent surface coverage');
      assert.equal(digest(new Uint8Array(frame.depth.buffer)), beforeDepth, 'Air may not invent geometry depth');
    }
    timing[layer] = Math.round(performance.now() - started);
    await save(layer === 'haven' ? 'haven.png' : `exterior-${layer}.png`, layer === 'haven' ? cropPadded(frame.energyBase) : frame.energyBase, layer === 'haven' ? W : PW, layer === 'haven' ? H : PH);
    exteriorDepth.set(encodeDepth(frame), column * PW * PH * 4);
    const other = new Uint8ClampedArray(frame.lightFields.pollution.length);
    for (let i = 0; i < other.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) other[i + channel] = Math.max(0, frame.lightFields.pollution[i + channel] - frame.coreLight[i + channel] - frame.storageLight[i + channel] - frame.purifierLight[i + channel]);
      other[i + 3] = 255;
    }
    const samples = [other, frame.coreLight, frame.storageLight, frame.purifierLight, frame.lightFields.furnace, frame.motion, frame.normal];
    for (let row = 0; row < rows.length; row++) for (let y = 0; y < PH; y++) {
      fields.set(samples[row].subarray(y * PW * 4, (y + 1) * PW * 4), ((row * PH + y) * PW * columns.length + column * PW) * 4);
    }
  }
  await save('exterior-depth.png', exteriorDepth, PW, PH * columns.length);
  await save('exterior-fields.png', fields, PW * columns.length, PH * rows.length);
  const exteriorMetadata = { version: 1, texture: 'exterior-fields.png', width: PW * columns.length, height: PH * rows.length,
    tile: { width: PW, height: PH, padding }, columns, rows, timing, sourceHashes: hashes, textureHash: outputHashes['exterior-fields.png'],
    encoding: 'Each layer colour/depth/received light/material uses the same padded UV. Raw RGBA preserves additive air at alpha zero. Full-world shadow casters; actor and shoulder absent.' };
  await saveJson('exterior-fields.json', exteriorMetadata);
  const occluders = world.triangles.filter(triangle => !['glass', 'liquid', 'energy'].includes(triangle.material));
  await saveJson('occluders.json', { version: 1, count: occluders.length, triangles: occluders.flatMap(triangle => [...triangle.a, ...triangle.b, ...triangle.c].map(value => Math.round(value * 1e5) / 1e5)) });
  for (const filename of new Set(Object.values(actorManifest.actor.textures))) {
    const bytes = await fs.readFile(path.join(production, filename));
    assert.equal(digest(bytes), copiedInputs[`public/assets/last-light/${filename}`], `Actor source changed during export: ${filename}`);
    await fs.writeFile(path.join(temp, filename), bytes);
    outputHashes[filename] = digest(bytes);
    const dimensions = await sharp(bytes).metadata();
    imageDimensions[filename] = { width: dimensions.width, height: dimensions.height };
  }
  const manifest = structuredClone(actorManifest);
  manifest.status = 'complete'; manifest.delivery = 'dev';
  manifest.review = { status: 'REVIEW-PENDING', scope: 'Joint opening and playable haven visual continuity',
    note: 'Complete describes the exported resource pack only. Reused production actor/geometry metadata does not grant this new scene human art approval.' };
  manifest.camera = CAMERA; manifest.canvas = { width: W, height: H };
  manifest.exteriorPadding = padding;
  manifest.exteriorObservation = { ...LAST_LIGHT_EXTERIOR,
    note: 'Authoritative current renderer observation limits. exteriorLayers.parallax is a retained, unused legacy compatibility coefficient.' };
  manifest.lights = world.lights.map(light => ({ ...light, screen: project(light.position) }));
  manifest.stations = author.stations.map(station => ({ ...station, screen: project(station.position), approachScreen: project(station.approach), bounds: bounds(station.id) }));
  manifest.rest.bounds = bounds(manifest.rest.id);
  manifest.source = { entry, triangles: world.triangles.length, riftForm: actorManifest.source.riftForm, hashes,
    reusedActor: 'public/assets/last-light/manifest.json', navigation: navigationFile, scope: 'Independent joint DEV scene; production resources and gameplay layout unchanged.' };
  manifest.statistics = { objects: [...new Set(scene.objects)].sort((a, b) => a - b), actorPixels: [...scene.objects].filter(value => value === 7).length,
    shoulderLights: 0, triangles: world.triangles.length,
    layerTriangles: Object.fromEntries(columns.map(layer => [layer, world.triangles.filter(triangle => triangle.layer === layer).length])),
    lights: world.lights.length, actorFrames: manifest.actor.frames.length, actorFramesRebaked: 0, energyAdditiveHalo };
  manifest.exteriorFields = { metadata: 'exterior-fields.json', width: exteriorMetadata.width, height: exteriorMetadata.height, tile: exteriorMetadata.tile,
    columns, rows, sourceHashes: hashes, motion: actorManifest.exteriorFields.motion };
  manifest.exteriorAir = { source: 'tools/last-light/joint-air.ts', parameters: JOINT_AIR, statistics: airStatistics,
    texture: 'exterior-far.png', textureHash: outputHashes['exterior-far.png'],
    compositing: 'Existing raw premultiplied exterior compositor adds RGB at alpha zero; actual surface depth is retained. Middle/near/haven occlude the far plate normally.' };
  manifest.textures.exteriorFields = 'exterior-fields.png';
  timing.total = Math.round(performance.now() - allStarted);
  manifest.timing = timing;
  await saveJson('manifest.json', manifest);
  await fs.writeFile(path.join(temp, 'checksums.json'), JSON.stringify({ sources: hashes, reusedInputs: copiedInputs, outputs: outputHashes, imageDimensions }, null, 2) + '\n');
  // Validate immutable inputs again before publishing. A concurrent author edit
  // cannot receive a misleading checksum stamped over an older render.
  await checkPack(temp);
  await fs.mkdir(output, { recursive: true });
  for (const filename of await fs.readdir(temp)) await fs.copyFile(path.join(temp, filename), path.join(output, filename));
  console.log(`DEV pack ready: ${output}`);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
