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
const textures=PAINTED_MATERIALS.flatMap(row=>[row,row.solid]);
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
        const size = textures.find(value => value.source === image.src)!.logical_pixels;
        assert.deepEqual(rect, [0, 0, size, size]); drawn = image; drawCalls++;
      },
      getImageData(...rect: number[]) {
        assert(drawn); const size = textures.find(value => value.source === drawn!.src)!.logical_pixels;
        assert.deepEqual(rect, [0, 0, size, size]);
        if (failure === 'pixels') throw new Error('injected pixel read failure');
        pixelReads++;
        const data = new Uint8ClampedArray(size * size * 4);
        data[0] = drawn.src.includes('solid')?157:drawn.src.includes('ash') ? 23 : drawn.src.includes('crystal') ? 37 : 91;
        data[data.length - 1] = 255;
        return { data };
      },
    };
    const canvas = { width: 0, height: 0, getContext(kind: string) { assert.equal(kind, '2d'); return failure === 'context' ? null : context; } };
    canvases.push(canvas); return canvas;
  },
} });

async function settleDecodeBatch(rejectIndex=-1):Promise<void>{
  const batch=pending.splice(0);assert.equal(batch.length,2,'a family prepares independent ground and solid sources');
  batch.forEach((p,i)=>i===rejectIndex?p.reject(new Error('injected image decode failure')):p.resolve());
  await Promise.resolve();
}
try {
  assert.throws(()=>compilePaintedMaterialCSV(changeFirst('solid_source', PAINTED_MATERIALS[0]!.source)),/solid source/);
  assert.throws(()=>compilePaintedMaterialCSV(changeFirst('solid_skin_roughness','0.95')),/roughness/);
  assert.throws(()=>compilePaintedMaterialCSV(changeFirst('solid_gain','Infinity')),/solid_gain/);
  await assert.rejects(loadPaintedMaterial('unregistered' as never), /Unknown.*unregistered/);
  assert.equal(images.length,0);
  const first=loadPaintedMaterial('folded-slab'),duplicate=loadPaintedMaterial('folded-slab');
  assert.equal(first,duplicate);assert.equal(images.length,2);assert.equal(canvases.length,0);
  const failures=Promise.allSettled([first,duplicate]);await settleDecodeBatch(1);
  assert((await failures).every(r=>r.status==='rejected'&&/solid.*decode failed/.test(r.reason.message)),'failed solid texture rejects the pair rather than silently reusing ground');
  const retry=loadPaintedMaterial('folded-slab');await settleDecodeBatch();const ash=await retry;
  const definition=PAINTED_MATERIALS[0]!;
  assert.equal(ash.source,definition.source);assert.equal(ash.solid!.source,definition.solid.source);
  assert.notEqual(ash.pixels,ash.solid!.pixels);assert.equal(ash.pixels[0],23);assert.equal(ash.solid!.pixels[0],157);
  assert.deepEqual(ash.regions,definition.regions);assert.deepEqual(ash.solid!.regions,definition.solid.regions);
  assert.equal(ash.solid!.skinRoughness,definition.solid.skinRoughness);
  assert.equal(ash.solid!.gain,definition.solid.gain);
  for(const [family,failure] of [['fibre-knot','context'],['broken-shell','pixels']] as const){
    nextCanvasFailure=failure;
    const failed=loadPaintedMaterial(family),assertion=assert.rejects(failed,/prepare native pixels failed/);
    await settleDecodeBatch();await assertion;
    const retry=loadPaintedMaterial(family);await settleDecodeBatch();const recovered=await retry;
    assert.equal(recovered.pixels[0],family==='fibre-knot'?37:91);assert.equal(recovered.solid!.pixels[0],157);
  }
  const allocations=images.length,reads=pixelReads,buffers=new Set<Uint8ClampedArray>();
  for(let i=0;i<10;i++)for(const row of PAINTED_MATERIALS){
    const request=loadPaintedMaterial(row.family);assert.equal(request,loadPaintedMaterial(row.family));const p=await request;
    assert.equal(p.source,row.source);assert.equal(p.solid!.source,row.solid.source);buffers.add(p.pixels);buffers.add(p.solid!.pixels);
  }
  assert.equal(buffers.size,6,'three families retain six distinct surface buffers');
  assert.equal(images.length,allocations);assert.equal(pixelReads,reads,'cached pairs never decode again');
  assert.equal(await loadPaintedMaterial('folded-slab'),ash);
  assert.equal(pending.length,0);assert(images.every(i=>i.released));
  assert(canvases.every(c=>c.width===1&&c.height===1));
  console.log(JSON.stringify({status:'pass',families:3,retainedSurfaceBuffers:buffers.size,checks:['CSV source/finish separation','concurrent pair deduplication','solid failure rejects whole family','decode/context/read retry','immutable six-source reuse','scratch cleanup'],scope:'fake browser lifecycle; visual/native decoding verified separately'}));
} finally {
  for (const [name, descriptor] of descriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
  }
}
