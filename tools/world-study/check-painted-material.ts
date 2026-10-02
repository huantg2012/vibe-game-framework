/** Loader/codegen contract with fake browser primitives; not an image-quality review. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPaintedMaterial } from '../../src/dev/rift-r100-masters/painted-material';
import { PAINTED_MATERIALS } from '../../src/dev/rift-r100-masters/generated-materials';
import { compilePaintedMaterialCSV } from './generate-master-materials.mjs';

const csv = await readFile('data/rift-master-materials.csv', 'utf8');
assert.equal(compilePaintedMaterialCSV(csv), await readFile('src/dev/rift-r100-masters/generated-materials.ts', 'utf8'));
function changeFirst(column: string, value: string): string {
  const lines = csv.trim().split(/\r?\n/), fields = lines[0]!.split(','), row = lines[1]!.split(',');
  row[fields.indexOf(column)] = value; lines[1] = row.join(','); return lines.join('\n');
}
assert.throws(() => compilePaintedMaterialCSV(changeFirst('logical_pixels', '0')), /logical_pixels/);
assert.throws(() => compilePaintedMaterialCSV(changeFirst('world_size', 'NaN')), /world_size/);
assert.throws(() => compilePaintedMaterialCSV(changeFirst('family', PAINTED_MATERIALS[1]!.family)), /one painted material/);
assert.throws(() => compilePaintedMaterialCSV(changeFirst('source', '../private.png')), /source/);
assert.throws(() => compilePaintedMaterialCSV(changeFirst('source', PAINTED_MATERIALS[1]!.source)), /own source/);
assert(compilePaintedMaterialCSV(changeFirst('world_size', '768')).includes('"world_size": 768'), 'CSV remains the editable resolution/scale authority');
assert.throws(() => compilePaintedMaterialCSV(changeFirst('skin_region', '0.9:0.1:0.2:0.2')), /region/);
assert.throws(() => compilePaintedMaterialCSV(changeFirst('cleaved_region', '0::0.2:0.2')), /region/);
assert.throws(() => compilePaintedMaterialCSV(changeFirst('loose_region', '0:0:0.001:0.2')), /region/);

const pending: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
const images: FakeImage[] = [];
class FakeImage {
  naturalWidth = 2048;
  naturalHeight = 2048;
  decoding = '';
  src = '';
  decoded = false;
  released = false;
  constructor() { images.push(this); }
  decode(): Promise<void> {
    return new Promise((resolve, reject) => pending.push({ resolve: () => { this.decoded = true; resolve(); }, reject }));
  }
  removeAttribute(name: string): void { assert.equal(name, 'src'); this.src = ''; this.released = true; }
}
type CanvasFailure = 'none' | 'context' | 'pixels';
let nextCanvasFailure: CanvasFailure = 'none';
const canvases: Array<{ width: number; height: number }> = [];
let pixelReads = 0, drawCalls = 0;
const descriptors = ['Image', 'document'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
Object.defineProperty(globalThis, 'Image', { configurable: true, value: FakeImage });
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  createElement(name: string) {
    assert.equal(name, 'canvas');
    const failure = nextCanvasFailure; nextCanvasFailure = 'none';
    let drawn: FakeImage | null = null;
    const context = {
      imageSmoothingEnabled: false, imageSmoothingQuality: 'low',
      drawImage(image: FakeImage, ...rect: number[]) {
        assert(image.decoded, 'pixels cannot be read before the source decode completes');
        assert.equal(image.decoding, 'async'); assert.equal(image.naturalWidth, 2048);
        assert.equal(this.imageSmoothingEnabled, true); assert.equal(this.imageSmoothingQuality, 'high');
        const size = PAINTED_MATERIALS.find(value => value.source === image.src)!.logical_pixels;
        assert.deepEqual(rect, [0, 0, size, size]); drawn = image; drawCalls++;
      },
      getImageData(...rect: number[]) {
        assert(drawn); const size = PAINTED_MATERIALS.find(value => value.source === drawn!.src)!.logical_pixels;
        assert.deepEqual(rect, [0, 0, size, size]);
        if (failure === 'pixels') throw new Error('injected pixel read failure');
        pixelReads++;
        const data = new Uint8ClampedArray(size * size * 4);
        data[0] = drawn.src.includes('ash') ? 23 : drawn.src.includes('crystal') ? 37 : 91;
        data[data.length - 1] = 255;
        return { data };
      },
    };
    const canvas = { width: 0, height: 0, getContext(kind: string) { assert.equal(kind, '2d'); return failure === 'context' ? null : context; } };
    canvases.push(canvas); return canvas;
  },
} });

try {
  await assert.rejects(loadPaintedMaterial('unregistered' as never), /Unknown.*unregistered/);
  assert.equal(images.length, 0, 'unknown families never allocate an image');
  const first = loadPaintedMaterial('folded-slab'), duplicate = loadPaintedMaterial('folded-slab');
  assert.equal(first, duplicate, 'concurrent callers share the same pending request');
  assert.equal(images.length, 1); assert.equal(canvases.length, 0);
  const failures = Promise.allSettled([first, duplicate]);
  pending.shift()!.reject(new Error('injected image decode failure'));
  const rejected = await failures;
  assert(rejected.every(value => value.status === 'rejected' && /folded-slab.*ash-strata-source.png.*decode failed.*injected/.test(value.reason.message)));
  assert(images[0]!.released, 'failed decoding releases the original source');

  const retry = loadPaintedMaterial('folded-slab'); assert.notEqual(retry, first);
  pending.shift()!.resolve(); const ash = await retry;
  const ashDefinition = PAINTED_MATERIALS.find(value => value.family === 'folded-slab')!;
  assert.equal(ash.width, ashDefinition.logical_pixels); assert.equal(ash.height, ashDefinition.logical_pixels); assert.equal(ash.worldSize, ashDefinition.world_size);
  assert.equal(ash.source, ashDefinition.source); assert.equal(ash.pixels.length, ashDefinition.logical_pixels ** 2 * 4);
  assert.deepEqual(ash.regions, ashDefinition.regions, 'artist-selected source regions reach the renderer without changing cached pixels');
  assert.equal(ash.pixels[0], 23); assert.equal(ash.pixels[ash.pixels.length - 1], 255);

  for (const [family, failure, message] of [
    ['fibre-knot', 'context', /fibre-knot.*prepare native pixels failed.*context is unavailable/],
    ['broken-shell', 'pixels', /broken-shell.*prepare native pixels failed.*injected pixel read failure/],
  ] as const) {
    nextCanvasFailure = failure;
    const failed = loadPaintedMaterial(family), assertion = assert.rejects(failed, message);
    pending.shift()!.resolve(); await assertion;
    const recovered = loadPaintedMaterial(family); pending.shift()!.resolve();
    const pixels = await recovered;
    assert.equal(pixels.pixels[0], family === 'fibre-knot' ? 37 : 91, 'a retry prepares the correct family, never a placeholder');
  }
  const allocationCount = images.length;
  for (let i = 0; i < 10; i++) for (const definition of PAINTED_MATERIALS) {
    const cached = loadPaintedMaterial(definition.family);
    assert.equal(cached, loadPaintedMaterial(definition.family));
    assert.equal((await cached).source, definition.source);
  }
  assert.equal(await loadPaintedMaterial('folded-slab'), ash, 'completed requests keep one shared native pixel buffer');
  assert.equal(images.length, allocationCount, 'switching across the three families does not decode more originals');
  assert.equal(pixelReads, 3, 'only three successful native pixel buffers are retained');
  assert.equal(pending.length, 0); assert(images.every(image => image.released));
  assert(canvases.every(canvas => canvas.width === 1 && canvas.height === 1), 'scratch canvases release full-size backing stores on success and failure');
  console.log(JSON.stringify({ status: 'pass', families: PAINTED_MATERIALS.length, sourceAttempts: images.length, drawCalls, nativePixelBuffers: pixelReads,
    checks: ['CSV validation/staleness', 'concurrent decode deduplication', 'native smoothing/size', 'pixel payload', 'decode/context/read retry', 'three-source cache reuse', 'scratch cleanup'],
    scope: 'fake Image/Canvas lifecycle; actual PNG decoding and visual integration require the browser' }));
} finally {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
  }
}
