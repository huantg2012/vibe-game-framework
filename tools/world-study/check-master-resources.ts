/** Explicit CPU ArrayBuffer accounting, not browser heap/GC or GPU-driver evidence.
 * Run with TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx ...
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createMasterWorld } from '../../src/dev/rift-r100-masters/world';
import { paintMasterGround } from '../../src/dev/rift-r100-masters/ground';
import { MasterSurfaceRenderer } from '../../src/dev/rift-r100-masters/surface-renderer';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import { PAINTED_MATERIALS } from '../../src/dev/rift-r100-masters/generated-materials';
import { NativeVolumeLighting, type NativeVolumeMaterialSet } from '../../src/generation/world-study/native-volume-raster';

const MiB = 1024 * 1024, CPU_CACHE_LIMIT = 64 * MiB;
type Phase = 'world' | 'ground' | 'volume-material' | 'renderer-upload';
interface Allocation { readonly phase: Phase; readonly bytes: number }

/** Count backing stores, including the whole buffer behind a small view, once. */
function buffersOf(...roots: unknown[]): Set<ArrayBufferLike> {
  const objects = new Set<object>(), buffers = new Set<ArrayBufferLike>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object' || objects.has(value)) return;
    objects.add(value);
    if (ArrayBuffer.isView(value)) { buffers.add(value.buffer); return; }
    if (value instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && value instanceof SharedArrayBuffer)) {
      buffers.add(value); return;
    }
    if (value instanceof Map) { for (const [key, item] of value) { visit(key); visit(item); } return; }
    if (value instanceof Set) { for (const item of value) visit(item); return; }
    // Do not invoke getters, inspect prototypes, or pretend to introspect closures/WeakMaps.
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) if ('value' in descriptor) visit(descriptor.value);
  };
  roots.forEach(visit); return buffers;
}
const bytesOf = (buffers: Iterable<ArrayBufferLike>): number => [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);

/** Instrument only this isolated test process. Actual allocated stores are kept
 * by the auditor until a case ends; that artificial lifetime is never called GC. */
function tracker() {
  const allocations = new Map<ArrayBufferLike, Allocation>();
  let phase: Phase = 'world';
  const originals = new Map<string, PropertyDescriptor>();
  const names = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array'] as const;
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)!;
    originals.set(name, descriptor);
    const Constructor = descriptor.value;
    const proxy = new Proxy(Constructor, { construct(target, args) {
      const array = Reflect.construct(target, args) as ArrayBufferView;
      if (!allocations.has(array.buffer)) allocations.set(array.buffer, { phase, bytes: array.buffer.byteLength });
      return array;
    } });
    Object.defineProperty(globalThis, name, { ...descriptor, value: proxy });
  }
  return {
    allocations,
    run<T>(next: Phase, action: () => T): T {
      phase = next; const value = action();
      // Also catch any stores created through built-in species rather than new.
      for (const buffer of buffersOf(value)) if (!allocations.has(buffer)) allocations.set(buffer, { phase, bytes: buffer.byteLength });
      return value;
    },
    restore(): void { for (const [name, descriptor] of originals) Object.defineProperty(globalThis, name, descriptor); },
  };
}

/** No uploaded array is retained by this fake GL, as it would bias residency. */
function installUploadSink() {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const uploads: number[] = [];
  const known = new WeakSet<object>();
  let quadBytes = 0, losses = 0;
  const gl = new Proxy({
    getShaderParameter: () => true, getProgramParameter: () => true,
    createShader: () => ({}), createProgram: () => ({}), createBuffer: () => ({}), createTexture: () => ({}),
    getAttribLocation: () => 0, getUniformLocation: () => ({}),
    bufferData(_target: unknown, data: ArrayBufferView) { quadBytes += data.byteLength; },
    texImage2D(_target: unknown, _level: unknown, _format: unknown, _width: unknown, _height: unknown,
      _border: unknown, _pixelFormat: unknown, _type: unknown, data: ArrayBufferView) {
      assert(!known.has(data.buffer), 'four uploads should have distinct backing stores');
      known.add(data.buffer); uploads.push(data.buffer.byteLength);
    },
    getExtension: () => ({ loseContext() { losses++; } }),
  }, { get(target, property) {
    if (property in target) return Reflect.get(target, property);
    return /^[A-Z0-9_]+$/.test(String(property)) ? 0 : () => {};
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement() {
    return { width: 0, height: 0, getContext: () => gl };
  } } });
  return { uploads, quadBytes: () => quadBytes, losses: () => losses,
    restore() { if (previous) Object.defineProperty(globalThis, 'document', previous); else Reflect.deleteProperty(globalThis, 'document'); } };
}

// Values do not change allocation sizes. This exercises the real constructor,
// whose output arrays have the same dimensions as the live palette constructor.
const material = { base: [90, 95, 92], dark: [35, 40, 38], light: [160, 166, 158], roughness: .8, structure: .6 } as const;
const palette: NativeVolumeMaterialSet = { outer: material, cut: material, inner: material, joint: material };
const materialSources = [...new Map(PAINTED_MATERIALS.flatMap(row => [[row.source, row] as const,[row.solid.source, row.solid] as const])).values()];
const materialCacheBytes = materialSources.reduce((sum, row) => sum + row.logical_pixels ** 2 * 4, 0);

function measure(definition: typeof MASTER_SCENES[number], seed: number) {
  const audit = tracker(), sink = installUploadSink();
  let renderer: MasterSurfaceRenderer | undefined;
  try {
    const world = audit.run('world', () => createMasterWorld(definition, seed));
    const worldBuffers = buffersOf(world), rasterBuffers = buffersOf(world.raster), meshBuffers = buffersOf(world.meshes);
    const ground = audit.run('ground', () => paintMasterGround(world));
    const volume = audit.run('volume-material', () => new NativeVolumeLighting(world.raster, palette, { seed, axis: definition.axis }));
    renderer = audit.run('renderer-upload', () => new MasterSurfaceRenderer(world, ground, volume));
    const rendererBuffers = buffersOf(renderer), groundBuffers = buffersOf(ground), volumeBuffers = buffersOf(volume);
    // Ground, material arrays and input world are constructor arguments, not
    // fields. Test actual ownership; counting all arguments as resident is wrong.
    for (const buffer of rendererBuffers) assert(!groundBuffers.has(buffer) && !volumeBuffers.has(buffer) && !worldBuffers.has(buffer), 'renderer must not retain preparation/world buffers');
    assert.equal(sink.uploads.length, 4);
    assert.equal(bytesOf(rendererBuffers), 64 * 4, 'renderer retains only two light-uniform float arrays');
    const byPhase = Object.fromEntries((['world', 'ground', 'volume-material', 'renderer-upload'] as const).map(phase =>
      [phase, [...audit.allocations.values()].filter(item => item.phase === phase).reduce((sum, item) => sum + item.bytes, 0)]));
    // The matterAt/sight closures retain at least their hidden support buffer.
    // Conservatively retain every unexposed world-phase store (including BFS
    // scratch), avoiding an unverifiable claim about JS closure slot collection.
    const hiddenWorldUpperBound = [...audit.allocations].filter(([buffer, item]) => item.phase === 'world' && !worldBuffers.has(buffer))
      .reduce((sum, [, item]) => sum + item.bytes, 0);
    assert(hiddenWorldUpperBound >= world.sight.cols * world.sight.rows, 'include closed-over 8px matter buffer');
    const residentUpperBound = bytesOf(buffersOf(world, renderer)) + hiddenWorldUpperBound + materialCacheBytes;
    const explicitAllocationUpperBound = [...audit.allocations.values()].reduce((sum, item) => sum + item.bytes, 0) + materialCacheBytes;
    assert(residentUpperBound <= CPU_CACHE_LIMIT, `${definition.id}: explicit resident cache exceeds 64 MiB`);
    const result = { id: definition.id, seed, geometryFingerprint: world.diagnostics.geometryFingerprint,
      width: world.raster.width, height: world.raster.height,
      graph: { uniqueWorldBuffers: worldBuffers.size, worldBytes: bytesOf(worldBuffers), rasterBytes: bytesOf(rasterBuffers), meshBytes: bytesOf(meshBuffers),
        rendererBytes: bytesOf(rendererBuffers), groundPreparationBytes: bytesOf(groundBuffers),
        volumePreparationExclusiveBytes: bytesOf([...volumeBuffers].filter(buffer => !worldBuffers.has(buffer))) },
      allocationBytesByPhase: byPhase, hiddenWorldRetentionUpperBoundBytes: hiddenWorldUpperBound,
      uploadStagingBytes: sink.uploads.reduce((sum, value) => sum + value, 0), quadUploadBytes: sink.quadBytes(),
      allFamilyMaterialCacheBytes: materialCacheBytes, explicitResidentUpperBoundBytes: residentUpperBound,
      cumulativeExplicitAllocationUpperBoundBytes: explicitAllocationUpperBound,
      estimatedGpuBytes: renderer.gpuBytes };
    renderer.destroy(); renderer.destroy(); assert.equal(sink.losses(), 1);
    return result;
  } finally { renderer?.destroy(); sink.restore(); audit.restore(); audit.allocations.clear(); }
}

function selfTest() {
  const buffer = new ArrayBuffer(64), view = new Uint8Array(buffer, 8, 3), other = new DataView(buffer, 16, 8);
  const cycle: Record<string, unknown> = { view, other, buffer, values: new Map([['view', view]]) }; cycle.self = cycle;
  assert.equal(buffersOf(cycle).size, 1); assert.equal(bytesOf(buffersOf(cycle)), 64, 'views count the complete backing store once');
  const audit = tracker();
  try {
    const result = audit.run('world', () => { const hidden = new Uint8Array(13); const publicView = new Uint16Array(9);
      return { publicView, alias: publicView.subarray(1), hiddenAt: () => hidden[0] }; });
    assert.equal(bytesOf(buffersOf(result)), 18);
    assert.equal([...audit.allocations.values()].reduce((sum, row) => sum + row.bytes, 0), 31, 'allocation upper bound includes hidden closure data without double counting views');
  } finally { audit.restore(); }
  console.log('PASS unique backing stores, view offsets/aliases, object cycles, hidden closure allocation accounting and constructor restoration');
}

if (process.argv.includes('--self-test')) selfTest();
else {
  const outputAt = process.argv.indexOf('--output');
  const output = outputAt >= 0 ? process.argv[outputAt + 1] : undefined;
  if (outputAt >= 0 && (!output || existsSync(output))) throw new Error('--output requires a new file path');
  const sources = ['tools/world-study/check-master-resources.ts', 'src/dev/rift-r100-masters/world.ts', 'src/systems/r100-world/ground.ts',
    'src/systems/r100-world/surface-renderer.ts', 'src/dev/rift-r100-masters/generated-scenes.ts', 'src/generated/r100-materials.ts',
    'src/generation/world-study/master-ground-field.ts', 'src/generation/world-study/native-volume-geometry.ts', 'src/generation/world-study/native-volume-raster.ts'];
  const fingerprints = () => Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
  const before = fingerprints();
  const results = MASTER_SCENES.flatMap(definition => (process.argv.includes('--both-seeds') ? [definition.seed, definition.seed + 1] : [definition.seed])
    .map(seed => measure(definition, seed)));
  assert.deepEqual(fingerprints(), before, 'resource-owning source changed during measurement');
  const report = { status: 'pass', createdAt: new Date().toISOString(), cases: results.length,
    method: 'Actual constructor allocations and object-graph ArrayBuffer identity de-duplication; sequential worlds; fake GL upload sink retains no payload.',
    scope: 'Explicit R100 material/world CPU buffers only, not total browser heap, GC, leak, decoded image, Canvas, Phaser or GPU driver measurement.',
    cpuCacheLimitBytes: CPU_CACHE_LIMIT, maximumExplicitResidentUpperBoundBytes: Math.max(...results.map(row => row.explicitResidentUpperBoundBytes)),
    maximumCumulativeExplicitAllocationUpperBoundBytes: Math.max(...results.map(row => row.cumulativeExplicitAllocationUpperBoundBytes)),
    materialCache: { bytes: materialCacheBytes, sources: materialSources.map(row => ({ source: row.source, logicalPixels: row.logical_pixels, rgbaBytes: row.logical_pixels ** 2 * 4 })),
      method: 'Manifest-sized decoded native pixel caches, summed separately across six ground/solid sources; source-image decode and scratch Canvas are not measured in Node.' },
    limitations: ['World closures are opaque: all unexposed world allocations are conservatively included as potentially resident.',
      'Cumulative explicit allocation upper bound assumes no intermediate collection and includes scratch/preparation/upload arrays; it is not a measured concurrent peak or resident cache.',
      'Plain JS objects/arrays, strings, closure/Map overhead, browser image decode/Canvas backing, Phaser actors/fog/audio and driver copies are excluded.',
      'Typed-array constructors are observed in this isolated test; built-in output stores are additionally found through returned object graphs. This is not a universal allocation profiler.',
      'NativeVolumeLighting is prepared but not CPU-rendered in the live GPU path, so its unused shadow WeakMap does not accumulate light caches.',
      'No 10-enter/leave retained-heap or GC claim; only one current world is included, not 9/18 resident worlds.'], sources: before, results };
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
}
