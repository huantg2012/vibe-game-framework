/** Regression: later opaque material owns its pixels, even when RGB is unchanged. */
import assert from 'node:assert/strict';
import { Raster } from '../../src/generation/world-study/raster';
import { beginMaterialResponse, trackMaterialOverpaint, finishMaterialResponse, groundMaterialHighlights,
  registerFormHighlight, type MaterialHighlight } from '../../src/generation/world-study/material-response';
import { paintGroundMaterial } from '../../src/generation/world-study/ground-material';
import { paintMaterialForms } from '../../src/generation/world-study/material-forms';
import { renderWorldSurface } from '../../src/generation/world-study/surface';
import { generateWorldSample } from '../../src/generation/world-study/layout';
import { WORLD_PROFILES } from '../../src/generation/world-study/profiles';
import { worldSupportAt } from '../../src/generation/world-study/support';
import type { WorldSample, WorldProfile } from '../../src/generation/world-study/types';

const color = 0x76839a;
const highlight = (x: number, y: number): MaterialHighlight => ({
  x, y, width: 2, height: 2, normal: .5, color: 0xdce5e5, strength: .46, sharpness: 5,
});
function key(): WorldSample {
  // Response storage only uses object identity; no geometry is consumed here.
  return {} as WorldSample;
}
function fixture(): { sample: WorldSample; raster: Raster; first: MaterialHighlight; second: MaterialHighlight } {
  const sample = key(), raster = new Raster(32, 24), first = highlight(6, 6), second = highlight(23, 18);
  raster.fill(color);
  beginMaterialResponse(sample).push(first, second);
  trackMaterialOverpaint(sample, raster);
  return { sample, raster, first, second };
}
function sameBytes(first: Uint8ClampedArray, second: Uint8ClampedArray): boolean {
  return Buffer.compare(new Uint8Array(first.buffer, first.byteOffset, first.byteLength),
    new Uint8Array(second.buffer, second.byteOffset, second.byteLength)) === 0;
}

const primitiveCases: readonly [string, (raster: Raster) => void][] = [
  ['pixel partial footprint', raster => raster.pixel(7.8, 7.1, color)],
  ['rect', raster => raster.rect(7, 7, 3, 2, color)],
  ['line', raster => raster.line(6, 6, 10, 10, color)],
  ['thick line', raster => raster.line(6, 6, 9, 9, color, 3)],
  ['zero-length thick line', raster => raster.line(7, 7, 7, 7, color, 2)],
  ['polygon', raster => raster.polygon([[6, 6], [9, 6], [9, 9], [6, 9]], color)],
  ['ellipse', raster => raster.ellipse(7, 7, 1.5, 1.5, color)],
];
for (const [label, paint] of primitiveCases) {
  const { sample, raster, second } = fixture(), before = raster.rgba.slice();
  paint(raster);
  assert(sameBytes(before, raster.rgba), `${label}: fixture must overpaint with exactly the same RGB`);
  finishMaterialResponse(sample);
  assert.deepEqual(groundMaterialHighlights(sample), [second], `${label}: overpaint did not retire the covered response`);
  raster.pixel(second.x, second.y, color);
  finishMaterialResponse(sample);
  assert.deepEqual(groundMaterialHighlights(sample), [second], `${label}: tracking survived finalization`);
}

{
  const { sample, raster } = fixture();
  raster.setClip(() => false);
  // Raster.fill has always replaced the entire backing buffer regardless of clip.
  raster.fill(color);
  finishMaterialResponse(sample);
  assert.equal(groundMaterialHighlights(sample).length, 0, 'Whole-buffer fill did not retire all responses');
}
{
  const { sample, raster, first, second } = fixture();
  raster.setClip((x, y) => x > 12 && y < 10);
  raster.rect(0, 0, 32, 24, color);
  raster.pixel(7, 7, color);
  finishMaterialResponse(sample);
  assert.deepEqual(groundMaterialHighlights(sample), [first, second], 'Rejected clip pixels erased material ownership');
}
{
  const { sample, raster, second } = fixture();
  raster.setClip((x, y) => x === 7 && y === 7);
  raster.rect(0, 0, 32, 24, color);
  finishMaterialResponse(sample);
  assert.deepEqual(groundMaterialHighlights(sample), [second], 'A partial clipped overwrite was not recorded');
}
{
  const { sample, raster, first, second } = fixture();
  raster.pixel(-1, -1, color); raster.pixel(32, 24, color);
  raster.rect(-10, -10, 5, 5, color); raster.rect(40, 40, 5, 5, color);
  raster.polygon([[-8, -8], [-2, -8], [-2, -2]], color);
  finishMaterialResponse(sample);
  assert.deepEqual(groundMaterialHighlights(sample), [first, second], 'Off-canvas writes erased material ownership');
}
{
  const { sample, raster: oldRaster } = fixture();
  const raster = new Raster(32, 24), replacement = highlight(6, 6);
  beginMaterialResponse(sample).push(replacement);
  trackMaterialOverpaint(sample, raster);
  oldRaster.fill(color);
  finishMaterialResponse(sample);
  assert.deepEqual(groundMaterialHighlights(sample), [replacement], 'Restarted baking retained an old overpaint observer');
}

// Observing paint must not change clipping, bounds, scanline or color behavior.
{
  const ordinary = new Raster(29, 25), observed = new Raster(29, 25);
  let writes = 0;
  observed.setPaintObserver((start, end) => {
    assert(Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= 29 * 25 && end > start);
    writes += end - start;
  });
  for (const raster of [ordinary, observed]) {
    raster.fill(0x102030);
    raster.rect(-3, 2.5, 19.4, 8, 0x829a43);
    raster.setClip((x, y) => (x + y) % 3 !== 0);
    raster.line(2.2, -3, 20.5, 23.8, 0xa93e71, 4);
    raster.ellipse(15, 14, 12, 7, 0x53a9c3);
    raster.polygon([[3, 4], [28, 8], [10, 24]], 0xcec1a3);
  }
  assert(writes > ordinary.width * ordinary.height, 'Paint observer did not see accepted writes');
  assert(sameBytes(ordinary.rgba, observed.rgba), 'Paint observer changed the baked artwork');
}

/** Captures the same accepted writes independently of response compaction. */
class AuditedRaster extends Raster {
  readonly overwritten = new Uint8Array(this.width * this.height);
  override setPaintObserver(observer: ((start: number, end: number) => void) | null): void {
    super.setPaintObserver(observer ? (start, end) => {
      this.overwritten.fill(1, start, end);
      observer(start, end);
    } : null);
  }
}

// Real consumer integration: both deposited debris and later material forms.
const base = WORLD_PROFILES.find(profile => profile.id === 'ivory-basin') ?? WORLD_PROFILES[0];
assert(base);
const profile: WorldProfile = { ...base, id: 'unregistered-response-regression',
  surface: { ...base.surface, substrate: 'glaze', coating: 'strata', coverage: .5, wear: .8, deposits: .8, relief: 1 } };
const sample = generateWorldSample(profile, 'loops', 70421);
const width = sample.cols * sample.tileSize, height = sample.rows * sample.tileSize;
const raster = new AuditedRaster(width, height), floor = new Uint8Array(width * height);
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
  floor[y * width + x] = Number(worldSupportAt(sample, x, y));
}
raster.fill(0);
paintGroundMaterial(raster, sample, floor);
const registered = [...groundMaterialHighlights(sample)];
const survives = (value: MaterialHighlight): boolean => {
  for (let dy = 0; dy < value.height; dy++) for (let dx = 0; dx < value.width; dx++) {
    if (raster.overwritten[(value.y + dy) * width + value.x + dx]) return false;
  }
  return true;
};
const afterDeposits = registered.filter(survives).length;
paintMaterialForms(raster, sample, floor);
const expected = registered.filter(survives);
finishMaterialResponse(sample);
assert(afterDeposits < registered.length, 'Integration fixture did not exercise deposited overpaint');
assert(expected.length < afterDeposits, 'Integration fixture did not exercise later material forms');
assert(expected.length > 0, 'Integration removed all responses, including uncovered material');
const registeredSet = new Set(registered);
assert.deepEqual(groundMaterialHighlights(sample).filter(value => registeredSet.has(value)), expected, 'Covered ground reflectors survived final material ownership');
const finalExpected = [...groundMaterialHighlights(sample)];
const formOwned = finalExpected.filter(value => !registeredSet.has(value));
assert(formOwned.length > 0, 'Integration did not exercise new face-owned responses');

// The public entry finalizes the same ownership, including a second bake of the same object.
const publicSurface = renderWorldSurface(sample);
assert(sameBytes(raster.rgba, publicSurface.rgba), 'Ownership retirement altered visible material pixels');
assert.deepEqual(groundMaterialHighlights(sample), finalExpected, 'Public surface did not finalize reflection ownership');
const repeated = renderWorldSurface(sample);
assert(sameBytes(publicSurface.rgba, repeated.rgba), 'Same-sample rebake changed artwork');
assert.deepEqual(groundMaterialHighlights(sample), finalExpected, 'Same-sample rebake retained stale ownership');

console.log(JSON.stringify({
  result: 'PASS', sameColorPrimitiveCases: primitiveCases.length,
  clippingAndBounds: 'PASS', observerDoesNotChangePixels: 'PASS', sameSampleRebake: 'PASS',
  initialReflectionSamples: registered.length, removedByDeposits: registered.length - afterDeposits,
  removedByLaterForms: afterDeposits - expected.length, remainingGroundReflectionSamples: expected.length, newFormReflectionSamples: formOwned.length,
}));

// Paint history before registration is owned by the new face. Future writes are not.
{
  const sample = { ...generateWorldSample('ivory-basin', 'loops', 17), cols: 6, rows: 6,
    land: new Uint8Array(36).fill(1), walls: new Uint8Array(36) };
  const raster = new Raster(96, 96);
  beginMaterialResponse(sample); trackMaterialOverpaint(sample, raster);
  raster.rect(30, 30, 20, 20, color);
  registerFormHighlight(sample, highlight(32, 32));
  registerFormHighlight(sample, highlight(40, 40));
  registerFormHighlight(sample, highlight(-2, -2));
  raster.pixel(41, 41, color); // Same RGB still replaces the reflective face.
  finishMaterialResponse(sample);
  assert.deepEqual(groundMaterialHighlights(sample), [highlight(32, 32)]);
}
console.log('New material faces: prior paint retained; same-color future overpaint retired; void registration rejected.');
