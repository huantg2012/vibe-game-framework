/** Regression for the continuous torn skin. This verifies real geometry, not art. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { buildSync } from 'esbuild';
import { buildNativeVolume, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
const output = resolve(process.argv[2] ?? 'docs/qa/artifacts/r100-i10-i12/b01-torn-refined');
mkdirSync(output, { recursive: true });
const snapshot = JSON.parse(readFileSync('docs/qa/artifacts/r100-i10-i12/b01-refined-source/source-snapshot.json', 'utf8'));
const geometryPath = 'src/generation/world-study/native-volume-geometry.ts';
const sourcePath = resolve(snapshot.temporaryRoot, geometryPath);
assert.equal(createHash('sha256').update(readFileSync(sourcePath)).digest('hex'), snapshot.sources[geometryPath]);
const bundle = resolve(output, 'previous-geometry.mjs');
buildSync({ entryPoints: [sourcePath], outfile: bundle, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
const previous = await import(pathToFileURL(bundle).href) as { buildNativeVolume: typeof buildNativeVolume };
const spec: NativeVolumeSpec = { id: 1, family: 'folded-slab', seed: 20261005, x: 280, y: 280, rotation: 0,
  length: 330, width: 240, height: 54, thickness: 12, fold: .6, branches: 3, opening: .7, distortion: .3,
  constructionVersion: 4, shapeProfile: 'torn-sheet', blocking: 1 };
const config = { x: 0, y: 0, width: 560, height: 560, opticalHeight: 16 };
const mesh = buildNativeVolume(spec), old = previous.buildNativeVolume(spec);
const raster = compileNativeVolumeRaster([mesh], config), oldRaster = compileNativeVolumeRaster([old], config);
assert.deepEqual(mesh.bounds, old.bounds, 'original exterior footprint bounds retained');
assert.deepEqual(raster.matter, oldRaster.matter, 'exterior ground footprint must retain every pixel');
const joints = [[[.13, -.37], [.04, -.02]], [[.04, -.02], [-.28, .13]]];
let sharedSkinSamples = 0, formerCutSamples = 0;
for (const [a, c] of joints) for (let i = 2; i <= 18; i++) {
  const t = i / 20, x = Math.floor(spec.x + (a![0]! + (c![0]! - a![0]!) * t) * spec.length),
    y = Math.floor(spec.y + (a![1]! + (c![1]! - a![1]!) * t) * spec.width), pixel = y * config.width + x;
  assert.notEqual(raster.material[pixel], 1, 'shared roll root is skin, never a closed cut seam');
  assert(raster.heightField[pixel]! > 3, 'roll root remains connected material above ground');
  if (oldRaster.material[pixel] === 1) formerCutSamples++;
  sharedSkinSamples++;
}
assert(formerCutSamples > 20, 'fixture must catch the original internally closed cut walls');
let protectedMeshes = 0;
const affected: { world: string; grade: string; instance: number; role: string }[] = [];
for (const world of R100_NATIVE_WORLDS.slice(52)) for (const definition of world.definitions) for (const instance of definition.instances) {
  const { role, groundEdgeWidth: _width, ...raw } = instance;
  const native = { ...raw, family: instance.family ?? definition.family, seed: 20261005 ^ Math.imul(instance.id, 104729), blocking: role === 'solid' ? 1 : 0 } as NativeVolumeSpec;
  const current = buildNativeVolume(native), before = previous.buildNativeVolume(native);
  if (native.shapeProfile === 'torn-sheet') {
    assert.deepEqual(current.bounds, before.bounds, 'affected instance exterior bounds retained');
    affected.push({ world: world.id, grade: definition.grade, instance: instance.id, role });
  } else if (native.shapeProfile !== 'clamp-bank') {
    // Root concurrently owns clampBank; its new geometry is independently reviewed.
    for (const field of ['positions', 'normals', 'uv', 'indices', 'materials', 'regions', 'bounds', 'joints'] as const) assert.deepEqual(current[field], before[field]);
    protectedMeshes++;
  }
}
const cutPixels = Array.from(raster.occupiedPixels).filter(at => raster.material[at] === 1).length;
const greenPixels = Array.from(raster.occupiedPixels).filter(at => raster.material[at] === 3).length;
assert(cutPixels > 100 && greenPixels >= 4);
const topNormalDirections = new Set(Array.from(mesh.materials).flatMap((slot, face) => slot === 0 || slot === 2 ? [Math.round(mesh.normals[mesh.indices[face * 3]! * 3 + 1]! * 10)] : []));
assert(topNormalDirections.size >= 8, 'the roll must have continuous changing slopes, not three large flat tiles');
const report = { topNormalDirections: topNormalDirections.size, status: 'PASS', previousSnapshot: 'docs/qa/artifacts/r100-i10-i12/b01-refined-source/source-snapshot.json',
  exteriorFootprintPixelsExact: raster.occupiedPixels.length, sharedSkinSamples, formerCutSamples, cutPixels, greenPixels,
  protectedOtherV4Meshes: protectedMeshes, affected, triangles: mesh.triangleCount,
  scope: 'Continuous roll root and changing slopes; unchanged exterior footprint, fracture-fan and fallen-bundle arrays. Root-owned concurrent clampBank is explicitly excluded from exact comparison. Normal-field material/shape quality still requires art review.' };
writeFileSync(resolve(output, 'connection.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
