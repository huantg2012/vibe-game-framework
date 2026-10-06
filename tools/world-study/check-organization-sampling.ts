import assert from 'node:assert/strict';
import { buildNativeVolume, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { prepareOrganizationSurfaceWindows, organizationSampleIndex } from '../../src/systems/r100-world/organization-sampling';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';

let checked = 0, samples = 0;
for (const definition of ORGANIZATION_MATERIALS) {
  const source = (row: typeof definition | typeof definition.solid): PaintedSurface => ({
    width: row.logical_pixels, height: row.logical_pixels,
    pixels: new Uint8ClampedArray(row.logical_pixels * row.logical_pixels * 4),
    worldSize: row.world_size, source: row.source, regions: row.regions,
  });
  const painting: PaintedMaterial = { ...source(definition), solid: { ...source(definition.solid),
    skinRoughness: definition.solid.skinRoughness, cutRoughness: definition.solid.cutRoughness,
    gain: definition.solid.gain, cutGain: definition.solid.cutGain } };
  const family = definition.organization === 'short-fibre' ? 'membrane-rim' : 'granular-ridge';
  for (const length of [90, 160, 480]) for (const seed of [0, 20261005, 0xffffffff]) {
    const spec: NativeVolumeSpec = { id: 1, family, seed, x: 100, y: 100, rotation: .7, length, width: length * .75,
      height: 40, thickness: 10, fold: .6, branches: 3, opening: .7, distortion: .3, blocking: 1 };
    const mesh = buildNativeVolume(spec), meshBefore = mesh.uv.slice(), pixelsBefore = painting.pixels.slice();
    const prepared = prepareOrganizationSurfaceWindows([mesh], family, painting), entry = prepared.get(1)!;
    assert(entry.solid); assert.equal(prepared.size, 1);
    assert.deepEqual(prepared, prepareOrganizationSurfaceWindows([mesh], family, painting));
    assert.equal(prepareOrganizationSurfaceWindows([mesh], family === 'membrane-rim' ? 'granular-ridge' : 'membrane-rim', painting).size, 0,
      'secondary-family matter does not consume a primary organization source');
    for (const surfaces of [entry.ground, entry.solid]) for (const window of Object.values(surfaces)) {
      assert(window.scale > 0 && Number.isFinite(window.scale));
      for (let i = 0; i < mesh.uv.length; i += 2) {
        const offset = organizationSampleIndex(window, mesh.uv[i]!, mesh.uv[i + 1]!);
        const x = (offset / 4) % window.sourceWidth, y = Math.floor(offset / 4 / window.sourceWidth);
        assert(x >= window.left && x < window.left + window.width);
        assert(y >= window.top && y < window.top + window.height); samples++;
      }
      // A centered object must progress monotonically through one source
      // window rather than reverse direction at local U/V zero.
      const step = 1 / window.scale, u0 = window.minU, v0 = window.minV;
      assert(organizationSampleIndex(window, u0 + step * 2, v0) > organizationSampleIndex(window, u0, v0));
      assert(organizationSampleIndex(window, u0, v0 + step * 2) > organizationSampleIndex(window, u0, v0));
    }
    assert.deepEqual(mesh.uv, meshBefore); assert.deepEqual(painting.pixels, pixelsBefore); checked++;
    assert.throws(() => prepareOrganizationSurfaceWindows([mesh], family, { ...painting, regions: undefined }), /source region/);
  }
}
console.log(JSON.stringify({ status: 'pass', cases: checked, sourceCoordinatesChecked: samples,
  scope: 'Pure source-window contracts only: deterministic, bounded, monotonic, uniform axis density, immutable inputs and secondary-family exclusion. Not visual approval.' }, null, 2));
