/** Independent pre-block scanner oracle. This checks exact drawing commands,
 * not merely equivalent alpha, and makes no browser-performance claim. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { MasterWorld } from '../../src/generation/world-study/r100-master-world';
import type { NativeVolumeRaster } from '../../src/generation/world-study/native-volume-raster';
import { nativeVolumeHeightAt } from '../../src/generation/world-study/native-volume-raster';
import { ActorOcclusionField } from '../../src/systems/r100-world/actor-occlusion-field';

type MaskWorld = Pick<MasterWorld, 'layout' | 'raster' | 'roleAt'>;
type Span = [number, number, number, number];
const out = process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/actor-mask-blocks';
assert(!existsSync(out), 'Preserve the first result; use a fresh path for a justified repeat');
mkdirSync(out, { recursive: true });
const sourcePaths = ['src/systems/r100-world/actor-occlusion-field.ts', 'src/systems/r100-world/presentation.ts'];
const sourceHashes = sourcePaths.map(path => ({ path, sha256: createHash('sha256').update(readFileSync(path)).digest('hex') }));
const sampleHeights = [-Infinity, -8, -0, 0, 1, Math.fround(1.0000001192092896), 16, 32.125, 80, Infinity, NaN];
let rowChecks = 0, pixelChecks = 0;
const results: Record<string, unknown>[] = [];

function makeWorld(width: number, height: number, mode: 'mixed' | 'open' | 'solid'): MaskWorld {
  const heights = new Float32Array(width * height);
  for (let i = 0; i < heights.length; i++) heights[i] = mode === 'open' ? 0 : sampleHeights[i % sampleHeights.length]!;
  // Only fields read by nativeVolumeHeightAt are needed by this pure art oracle.
  const raster = { config: { x: 0, y: 0 }, pixelSize: 1, width, height, heightField: heights } as NativeVolumeRaster;
  return {
    layout: { tileMap: { cols: width, rows: height, tileSize: 1 } } as MasterWorld['layout'], raster,
    roleAt: (x, y) => {
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      if (mode === 'open') return 'relief';
      if (mode === 'solid') return 'solid';
      return (x + y * 3) % 5 === 0 ? 'relief' : 'solid';
    },
  };
}

/** Exact prior integer-pixel predicate, including its malformed-ground path. */
function originalPixel(world: MaskWorld, x: number, y: number, limit: number): boolean {
  if (Number.isNaN(limit)) return world.roleAt(x, y) !== 'solid';
  const { cols, rows, tileSize } = world.layout.tileMap;
  const width = Math.ceil(cols * tileSize), height = Math.ceil(rows * tileSize);
  const storedHeight = world.roleAt(x, y) === 'solid' ? nativeVolumeHeightAt(world.raster, x, y) : -Infinity;
  return x < 0 || y < 0 || x >= width || y >= height || storedHeight < limit;
}
function originalRow(world: MaskWorld, x0: number, x1: number, y: number, limit: number): Span[] {
  const spans: Span[] = [];
  let start = -1;
  for (let x = x0; x <= x1 + 1; x++) {
    const visible = x <= x1 && originalPixel(world, x, y, limit);
    if (visible && start < 0) start = x;
    if (!visible && start >= 0) { spans.push([start, y, x - start, 1]); start = -1; }
  }
  return spans;
}

try {
  const limits = [-Infinity, -1, 0, 1 - 1e-7, 1, 1 + 1e-7, Math.fround(1.0000001192092896), 16 - 1e-7, 16, 16 + 1e-7, 32.125, 80, Infinity, NaN];
  for (const width of [1, 15, 16, 17, 31, 32, 33, 65]) for (const mode of ['mixed', 'open', 'solid'] as const) {
    const height = 11, world = makeWorld(width, height, mode), field = new ActorOcclusionField(world);
    const beforeRows = rowChecks, beforePixels = pixelChecks;
    const boundaries = [...new Set([-40, -17, -16, -1, 0, 1, 14, 15, 16, 17, 30, 31, 32, 33, width - 1, width, width + 1, width + 17])].sort((a, b) => a - b);
    const rows = [-2, -1, ...Array.from({ length: height }, (_, i) => i), height, height + 1];
    const actual: Span[] = [], sink = { fillRect: (...span: Span) => actual.push(span) };
    for (const y of rows) for (const limit of limits) {
      for (let x = -2; x <= width + 1; x++) {
        assert.equal(field.isVisibleAtPixel(x, y, limit), originalPixel(world, x, y, limit)); pixelChecks++;
      }
      for (let a = 0; a < boundaries.length; a++) for (let b = a; b < boundaries.length; b++) {
        const x0 = boundaries[a]!, x1 = boundaries[b]!;
        actual.length = 0;
        field.drawVisibleRow(sink, x0, x1, y, limit);
        assert.deepEqual(actual, originalRow(world, x0, x1, y, limit), `${width}/${mode} [${x0},${x1}] y${y} limit${limit}`);
        rowChecks++;
      }
    }
    // The real mask threshold is max(1, ground-y), including ±Infinity and NaN.
    for (const ground of [-Infinity, -0.375, 8.125, 16, 16 + 1e-7, Infinity, NaN]) for (const y of rows) {
      const limit = Math.max(1, ground - y);
      actual.length = 0; field.drawVisibleRow(sink, -20, width + 20, y, limit);
      assert.deepEqual(actual, originalRow(world, -20, width + 20, y, limit)); rowChecks++;
    }
    const heightBytes = width * height * 4, blockBytes = Math.ceil(width / 16) * height * 4;
    assert.equal(field.byteLength, heightBytes + blockBytes);
    field.destroy(); field.destroy(); assert.equal(field.byteLength, 0);
    assert.throws(() => field.isVisibleAtPixel(0, 0, 1), /after destruction/);
    assert.throws(() => field.drawVisibleRow(sink, 0, width, 0, 1), /after destruction/);
    results.push({ width, height, mode, rowChecks: rowChecks - beforeRows, pixelChecks: pixelChecks - beforePixels, heightBytes, blockBytes, destroyedBytes: field.byteLength });
  }
  // New presentation/recovery construction cannot reuse the prior world's index.
  const closed = new ActorOcclusionField(makeWorld(33, 11, 'solid'));
  const open = new ActorOcclusionField(makeWorld(33, 11, 'open'));
  const spans: Span[] = [], sink = { fillRect: (...span: Span) => spans.push(span) };
  closed.drawVisibleRow(sink, 0, 32, 0, 1); const closedSpans = [...spans];
  spans.length = 0; open.drawVisibleRow(sink, 0, 32, 0, 1);
  assert.notDeepEqual(spans, closedSpans); assert.deepEqual(spans, [[0, 0, 33, 1]]);
  closed.destroy(); open.destroy();
  const large = new ActorOcclusionField(makeWorld(2304, 1792, 'open'));
  assert.equal(large.byteLength, 17_547_264); large.destroy(); assert.equal(large.byteLength, 0);
  writeFileSync(`${out}/report.json`, JSON.stringify({ status: 'passed', rowChecks, pixelChecks, sourceHashes,
    scope: 'Exact original row drawing commands and point queries; no revision-specific branch, no source-world mutation. Browser frame cost is a separate gate.',
    largeWorld: { width: 2304, height: 1792, heightBytes: 16_515_072, addedBlockBytes: 1_032_192, totalBytes: 17_547_264, destroyedBytes: 0 }, results }, null, 2) + '\n');
  console.log(`PASS ${rowChecks} exact rows, ${pixelChecks} exact pixels; per-world block memory released.`);
} catch (error) {
  writeFileSync(`${out}/report.json`, JSON.stringify({ status: 'failed', rowChecks, pixelChecks, sourceHashes, error: String(error), results }, null, 2) + '\n');
  throw error;
}
