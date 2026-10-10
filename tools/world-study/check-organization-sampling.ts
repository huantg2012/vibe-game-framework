import assert from 'node:assert/strict';
import { buildNativeVolume, type NativeVolumeSpec } from '../../src/generation/world-study/native-volume-geometry';
import { ORGANIZATION_MATERIALS } from '../../src/generated/r100-material-organizations';
import { prepareOrganizationSurfaceWindows, organizationSampleIndex } from '../../src/systems/r100-world/organization-sampling';
import type { PaintedMaterial, PaintedSurface } from '../../src/systems/r100-world/painted-material';
import { compileNativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
import { riftGenerationTransferables, type RiftGenerationWire } from '../../src/generation/rift-generation-protocol';

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
// The same local formation may own a short coast or an entire large world.
// Neither global UV extent nor later opaque coverage can corrupt its domain.
const atom = ORGANIZATION_MATERIALS.find(row => row.organization === 'short-fibre-loose')!;
const painting: PaintedMaterial = { width: atom.logical_pixels, height: atom.logical_pixels,
  worldSize: atom.world_size, source: atom.source, regions: atom.regions,
  pixels: new Uint8ClampedArray(atom.logical_pixels ** 2 * 4) };
const spec: NativeVolumeSpec = { id: 1, family: 'membrane-rim', seed: 20261010,
  x: 70, y: 64, rotation: -.2, length: 90, width: 64, height: 4, thickness: 2,
  fold: .43, branches: 3, opening: .7, distortion: .3, blocking: 0,
  constructionVersion: 4, shapeProfile: 'compressed-wedge' };
const local = buildNativeVolume(spec);
const expected = prepareOrganizationSurfaceWindows([local], spec.family, painting);
let shorePixels = 0, overwrittenShorePixels = 0;
for (const [width, height] of [[128, 128], [2304, 1792]] as const) {
  const owner = buildNativeVolume({ ...spec, groundEdgeWidth: 8 }, { width, height,
    polygons: [[{ x: 0, y: 0 }, { x: 24, y: 0 }, { x: 24, y: height }, { x: 0, y: height }]],
    matterAt: (x, y) => x >= 24 && x < width && y >= 0 && y < height });
  assert.deepEqual(owner.groundEdgeStart, { vertex: local.vertexCount, triangle: local.triangleCount });
  assert.deepEqual(owner.uv.subarray(0, local.uv.length), local.uv);
  assert.deepEqual(prepareOrganizationSurfaceWindows([owner], spec.family, painting), expected,
    'A coastline cannot enlarge the local organization window');
  if (width !== 128) continue;
  const blocker = buildNativeVolume({ ...spec, id: 2, x: 32, length: 28, width: 48, height: 40, thickness: 8, blocking: 1 });
  const config = { x: 0, y: 0, width, height, opticalHeight: 16 };
  const alone = compileNativeVolumeRaster([owner], config), raster = compileNativeVolumeRaster([owner, blocker], config);
  const { groundEdgeStart: _domain, ...unmarkedOwner } = owner;
  const legacyFields = compileNativeVolumeRaster([unmarkedOwner, blocker], config);
  assert.equal(legacyFields.groundEdgePixels, undefined, 'No extra raster buffer without explicit domains');
  const { groundEdgePixels, ...unchanged } = raster;
  assert(groundEdgePixels); assert.deepEqual(unchanged, legacyFields, 'Domains are metadata only');
  for (let i = 0; i < raster.matter.length; i++) {
    const bit = 1 << (i & 31), isShore = (groundEdgePixels[i >>> 5]! & bit) !== 0;
    if (isShore) {
      shorePixels++; assert.equal(raster.objectId[i], owner.spec.id);
      assert(Math.abs(raster.uv[i * 2]! - (i % width + .5)) < .001);
      assert(Math.abs(raster.uv[i * 2 + 1]! - (Math.floor(i / width) + .5)) < .001);
    }
    if ((alone.groundEdgePixels![i >>> 5]! & bit) !== 0 && raster.objectId[i] === blocker.spec.id) {
      overwrittenShorePixels++; assert(!isShore, 'A later opaque local surface clears the sea-domain bit');
    }
  }
  const wire = { world: { native: { raster, sameBuffer: groundEdgePixels } } } as unknown as RiftGenerationWire;
  assert.equal(riftGenerationTransferables(wire).filter(buffer => buffer === groundEdgePixels.buffer).length, 1,
    'The generation worker transfers the sea-domain buffer exactly once');
  const copy = groundEdgePixels.slice(), transferred = structuredClone(copy, { transfer: [copy.buffer] });
  assert.equal(copy.byteLength, 0); assert.deepEqual(transferred, groundEdgePixels);
}
assert(shorePixels > 100 && overwrittenShorePixels > 10, 'Exercise actual coast and overlapping local winners');
console.log(JSON.stringify({ status: 'pass', cases: checked, sourceCoordinatesChecked: samples,
  coastExtents: [128, 2304], shorePixels, overwrittenShorePixels, transferDeduplication: true,
  scope: 'Pure source-window contracts only: deterministic, bounded, monotonic, uniform axis density, immutable inputs and secondary-family exclusion. Not visual approval.' }, null, 2));
