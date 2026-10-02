import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { buildNativeVolume, type NativeVolumeFamily, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster, NativeVolumeLighting, nativeVolumeHeightAt, nativeVolumeLightVisibility,
  nativeVolumeOccludesAt, type NativeVolumeColor, type NativeVolumeMaterialSet } from '../../src/generation/world-study/native-volume-raster';

let checks = 0;
function check(condition: unknown, message: string): void { assert.ok(condition, message); checks++; }
const families: readonly NativeVolumeFamily[] = ['folded-slab', 'fibre-knot', 'broken-shell'];
const spec = (family: NativeVolumeFamily, id = 1): NativeVolumeSpec => ({ id, family, seed: 8473, x: 160, y: 160,
  rotation: -.37, length: 220, width: 150, height: 54, thickness: 20, fold: .76, branches: 3, opening: .24, distortion: .65 });
const profileRows = (await readFile('data/rift-world-profiles.csv', 'utf8')).trim().split(/\r?\n/).map(row => row.split(','));
const fields = profileRows[0]!;
const colors = (id: string): NativeVolumeMaterialSet => {
  const row = profileRows.find(r => r[0] === id)!;
  const color = (role: string): NativeVolumeColor => {
    const value = Number.parseInt(row[fields.indexOf(role)]!, 16);
    return [value >>> 16, (value >>> 8) & 255, value & 255];
  };
  return {
    outer: { base: color('materialMid'), dark: color('materialDark'), light: color('materialLight'), roughness: .8, structure: .45 },
    cut: { base: color('materialLight'), dark: color('materialDark'), light: color('faceLight'), roughness: .92, structure: .7 },
    inner: { base: color('materialMid'), dark: color('shadow'), light: color('faceLight'), roughness: .45, structure: .3 },
    joint: { base: color('materialDark'), dark: color('shadow'), light: color('materialMid'), roughness: .7, structure: .4 },
  };
};

const profileIds = ['ash-strata', 'crystal-fibre', 'ivory-basin'];
const tiles: Uint8ClampedArray[] = [];
const metrics: object[] = [];
for (let f = 0; f < families.length; f++) {
  const family = families[f]!, s = spec(family), mesh = buildNativeVolume(s), repeat = buildNativeVolume(s);
  check(Buffer.from(mesh.positions.buffer).equals(Buffer.from(repeat.positions.buffer)), `${family}: deterministic geometry`);
  const secondSeed = buildNativeVolume({ ...s, seed: s.seed + 97 });
  check(!Buffer.from(mesh.positions.buffer).equals(Buffer.from(secondSeed.positions.buffer)), `${family}: seed changes actual contact geometry`);
  check(mesh.positions.every(Number.isFinite) && mesh.normals.every(Number.isFinite), `${family}: finite geometry`);
  check(mesh.triangleCount > 200 && mesh.vertexCount > 200, `${family}: actual surfaces rather than a flat mask`);
  const slots = new Set(mesh.materials);
  check(slots.has(0) && slots.has(1) && slots.has(2), `${family}: separate outer, cut and inner surfaces`);
  const heights = mesh.positions.filter((_n, i) => i % 3 === 2);
  check(Math.max(...heights) - Math.min(...heights) > 20, `${family}: finite volume`);
  check(Math.abs(Math.max(...heights) - s.height) < .001, `${family}: height is absolute maximum, not added again to thickness`);
  for (let i = 0; i < mesh.normals.length; i += 3) assert.ok(Math.abs(Math.hypot(mesh.normals[i]!, mesh.normals[i + 1]!, mesh.normals[i + 2]!) - 1) < .001);
  checks++;
  const raster = compileNativeVolumeRaster([mesh], { x: 0, y: 0, width: 320, height: 320, opticalHeight: 22 });
  check(raster.occupiedPixels.length > 1000 && raster.occupiedPixels.length < 60000, `${family}: bounded local matter`);
  check(raster.occupancy.filter(Boolean).length > raster.optical.filter(Boolean).length, `${family}: physical and optical masks differ by real height`);
  for (const p of raster.occupiedPixels) {
    const x = p % raster.width, y = Math.floor(p / raster.width);
    assert.equal(raster.occupancy[Math.floor(y / 8) * raster.columns + Math.floor(x / 8)], 1);
  }
  checks++;
  check(nativeVolumeHeightAt(raster, -1, -1) === -Infinity && !nativeVolumeOccludesAt(raster, -1, -1, 0), `${family}: void contains no receiver`);
  const centre = raster.occupiedPixels[Math.floor(raster.occupiedPixels.length / 2)]!;
  check(nativeVolumeOccludesAt(raster, centre % raster.width + .5, Math.floor(centre / raster.width) + .5, -1), `${family}: same geometry answers occlusion`);
  const shader = new NativeVolumeLighting(raster, colors(profileIds[f]!));
  if (family === 'folded-slab') {
    const regions = new Set(raster.region.filter((_value, index) => raster.matter[index] === 1));
    check(regions.has(0) && regions.has(1) && regions.has(2) && regions.has(3), 'Slab has intact, compressed, peeled and expelled fracture surfaces');
    const roughness = new Set(Array.from(shader.roughness).filter(v => v > 0).map(v => v.toFixed(2)));
    check(roughness.size >= 4, 'Actual construction regions change material roughness');
    check(raster.material.filter((slot, index) => slot === 3 && raster.matter[index] === 1).length >= 8,
      'Slab joint has actual visible native pixels for a source, not a hidden fallback anchor');
  }
  const a = new Uint8ClampedArray(320 * 320 * 4), other = new Uint8ClampedArray(a.length);
  const begin = performance.now();
  shader.render([{ x: 60, y: 85, z: 24, radius: 280, intensity: 2.3, color: [1, .94, .83] }], a, { ambient: .20 });
  const elapsedMs = performance.now() - begin;
  shader.render([{ x: 270, y: 240, z: 24, radius: 280, intensity: 2.3, color: [1, .94, .83] }], other, { ambient: .20 });
  let changed = 0, transparent = 0;
  for (let p = 0; p < raster.matter.length; p++) {
    if (Math.abs(a[p * 4]! - other[p * 4]!) > 3) changed++;
    if (!raster.matter[p]) { assert.equal(a[p * 4 + 3], 0); transparent++; }
  }
  checks++;
  check(changed > 500 && transparent > 50000, `${family}: moving shoulder light changes faces without emitting from void`);
  const hidden = new Uint8ClampedArray(a.length).fill(255);
  shader.render([{ x: 160, y: 160, z: 100, radius: 300, intensity: 3, color: [1, 1, 1] }], hidden,
    { ambient: 1, visibility: new Float32Array(320 * 320) });
  check(hidden.every(v => v === 0), `${family}: authoritative zero visibility skips surfaces before dynamic light`);
  const noShadow = { x: 30, y: 160, z: 24, radius: 400, intensity: 1, color: [1, 1, 1] as const };
  let shadowed = 0, clear = 0;
  for (let y = 20; y < 300; y += 8) for (let x = 20; x < 300; x += 8) {
    if (nativeVolumeHeightAt(raster, x, y) !== -Infinity) continue;
    const visibility = nativeVolumeLightVisibility(raster, x, y, 0, noShadow);
    if (visibility < .2) shadowed++;
    if (visibility > .95) clear++;
  }
  check(shadowed > 3 && clear > 10, `${family}: shared height field casts bounded shadows`);
  tiles.push(a, other);
  metrics.push({ family, triangles: mesh.triangleCount, matterPixels: raster.occupiedPixels.length,
    physicalCells: raster.occupancy.filter(Boolean).length, opticalCells: raster.optical.filter(Boolean).length, lampChangedPixels: changed, shadowedSamples: shadowed, elapsedMs });
}

const shell = buildNativeVolume({ ...spec('broken-shell'), rotation: 0, distortion: .4 });
const shellRaster = compileNativeVolumeRaster([shell], { x: 0, y: 0, width: 320, height: 320, opticalHeight: 22 });
const bottom = nativeVolumeHeightAt(shellRaster, 184, 140), rim = nativeVolumeHeightAt(shellRaster, 130, 110);
check(bottom > 0 && rim > bottom + 20, 'Shell contains real low cavity bottom and raised thick lip');
const empty = compileNativeVolumeRaster([], { x: 0, y: 0, width: 24, height: 24, opticalHeight: 20 });
const emptyOutput = new Uint8ClampedArray(24 * 24 * 4).fill(255);
new NativeVolumeLighting(empty, colors('ash-strata')).render([], emptyOutput, { ambient: 1 });
check(emptyOutput.every(v => v === 0), 'An empty volume cannot fill the black void with light');
assert.throws(() => buildNativeVolume({ ...spec('folded-slab'), height: NaN })); checks++;
assert.throws(() => buildNativeVolume({ ...spec('folded-slab'), branches: 999 })); checks++;
assert.throws(() => compileNativeVolumeRaster([shell, shell], { x: 0, y: 0, width: 320, height: 320, opticalHeight: 20 })); checks++;

const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0) {
  const output = process.argv[outputIndex + 1];
  if (!output) throw new Error('--output requires a PNG path');
  await mkdir(path.dirname(output), { recursive: true });
  await sharp({ create: { width: 960, height: 640, channels: 4, background: { r: 19, g: 21, b: 22, alpha: 1 } } })
    .composite(tiles.map((data, i) => ({ input: Buffer.from(data), raw: { width: 320, height: 320, channels: 4 as const }, left: Math.floor(i / 2) * 320, top: (i % 2) * 320 })))
    .png().toFile(output);
  await writeFile(output.replace(/\.png$/, '.json'), JSON.stringify({ status: 'technical-diagnostic-not-art-approval', checks, metrics,
    limitations: ['Different materials use current CSV roles; no formal ground/actor/vision in this diagnostic.', 'Height-field shadows cannot trace undercuts; projected entity footprint is nonwalkable.', 'Timing is one cold CPU call, not a frame performance qualification.'] }, null, 2));
}
console.log(JSON.stringify({ status: 'pass', checks, metrics }, null, 2));
