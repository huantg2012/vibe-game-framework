/** Exact original pixel/scan-line oracle, plus the actual presentation mask method. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createMasterWorld, type MasterWorld } from '../../src/generation/world-study/r100-master-world';
import { nativeVolumeHeightAt } from '../../src/generation/world-study/native-volume-raster';
import { ActorOcclusionField } from '../../src/systems/r100-world/actor-occlusion-field';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { MasterPresentation } = await import('../../src/systems/r100-world/presentation');
const maskActor = Reflect.get(MasterPresentation.prototype, 'maskActor') as (this: unknown) => void;
const out = process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i14/actor-occlusion/equivalence';
assert(!existsSync(out), 'Keep the first result; choose a new output for a justified repeat');
mkdirSync(out, { recursive: true });
let assertions = 0;
type Span = [number, number, number, number];
const hash = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const oracle = (world: MasterWorld, x: number, y: number, limit: number): boolean =>
  world.roleAt(x, y) !== 'solid' || nativeVolumeHeightAt(world.raster, x, y) < limit;
function spans(query: (x: number, y: number) => boolean, bounds: number[]): Span[] {
  const [x0, x1, y0, y1] = bounds as [number, number, number, number], result: Span[] = [];
  for (let y = y0; y <= y1; y++) {
    let start = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      const visible = x <= x1 && query(x, y);
      if (visible && start < 0) start = x;
      if (!visible && start >= 0) { result.push([start, y, x - start, 1]); start = -1; }
    }
  }
  return result;
}
const results: Record<string, unknown>[] = [];
for (const id of ['ash-strata', 'crystal-fibre', 'ivory-basin', 'cinder-ridge', 'pallid-membrane', 'silt-gel', 'hollow-wreckage', 'felt-wedges']) {
  const recipe = createR100ProductionRecipe(id, 20261004, 'severe');
  const world = createMasterWorld(recipe.nativeDefinition, recipe.requestedSeed, { grade: recipe.gradeDefinition, profile: recipe.profile });
  const began = performance.now(), field = new ActorOcclusionField(world), buildMs = performance.now() - began;
  const oldAlpha = new Uint8Array(field.width * field.height), newAlpha = new Uint8Array(oldAlpha.length);
  let solid = 0, relief = 0, empty = 0;
  for (let y = -1; y <= field.height; y++) for (let x = -1; x <= field.width; x++) {
    const h = nativeVolumeHeightAt(world.raster, x, y), role = world.roleAt(x, y);
    if (role === 'solid') solid++; else if (role === 'relief') relief++; else empty++;
    for (const limit of [1, Math.max(1, h), Math.max(1, h + 1e-7), Math.max(1, h - 1e-7), 32.125, Infinity, NaN]) {
      const expected = oracle(world, x, y, limit), actual = field.isVisibleAtPixel(x, y, limit);
      if (expected !== actual) throw new Error(`${id}: mismatch at${x},${y} height${h} role${role} limit${limit}`);
      assertions++;
    }
    if (x >= 0 && y >= 0 && x < field.width && y < field.height) {
      oldAlpha[y * field.width + x] = Number(oracle(world, x, y, Math.max(1, 448.375 - y))) * 255;
      newAlpha[y * field.width + x] = Number(field.isVisibleAtPixel(x, y, Math.max(1, 448.375 - y))) * 255;
    }
  }
  assert.equal(hash(oldAlpha), hash(newAlpha)); assertions++;
  // Each fake object supplies the same real API read by maskActor, recording only draw commands.
  const makeActor = (x: number, y: number, ground: number) => {
    const pose = { x, y, ground, wide: false }, draw: Span[] = [], events = { clears: 0, graphicsDestroyed: 0, maskDestroyed: 0 };
    const object = { scene: {} as object | null, getBounds: () => ({ left: pose.x - (pose.wide ? 90.75 : 20.25), right: pose.x + 34.1, top: pose.y - 92.5, bottom: pose.y + 22.3 }) };
    const entry = { actor: { objects: [object], getPosition: () => ({ x: pose.x, y: pose.y }), getGroundY: () => pose.ground },
      graphics: { clear: () => { draw.length = 0; events.clears++; }, fillStyle: () => {}, fillRect: (...s: Span) => { draw.push(s); }, destroy: () => { events.graphicsDestroyed++; } },
      mask: { destroy: () => { events.maskDestroyed++; } }, objects: [object], key: '', retired: false };
    return { pose, draw, events, object, entry };
  };
  const a = makeActor(world.layout.spawnPoint.x, world.layout.spawnPoint.y, world.layout.spawnPoint.y + .375);
  const solidPoint = world.definition.instances.find(instance => instance.role === 'solid');
  const b = makeActor(solidPoint?.x ?? 500, solidPoint?.y ?? 450, (solidPoint?.y ?? 450) + 16.125);
  const owner = { actorMasks: [a.entry, b.entry], actorOcclusionField: field }, poses: Record<string, unknown>[] = [];
  for (let stage = 0; stage < 7; stage++) {
    if (stage === 1) { a.pose.wide = true; b.pose.ground += 1e-7; }
    if (stage === 2) { a.pose.x += .9; a.pose.y -= .6; b.pose.x += 16; }
    if (stage === 3) { a.pose.x = -15.75; b.pose.y = field.height + 10.5; }
    if (stage === 4) { a.pose.ground = NaN; b.pose.ground = Infinity; }
    if (stage === 5) { a.pose.ground = -Infinity; b.pose.x = field.width - .25; }
    maskActor.call(owner);
    for (const item of [a, b]) {
      const { x, y, ground } = item.pose, box = item.object.getBounds();
      const bounds = [Math.floor(Math.min(x - 64, box.left - 2)), Math.ceil(Math.max(x + 64, box.right + 2)),
        Math.floor(Math.min(y - 80, box.top - 2)), Math.ceil(Math.max(y + 64, box.bottom + 2))];
      const expected = spans((px, py) => oracle(world, px, py, Math.max(1, ground - py)), bounds);
      assert.deepEqual(item.draw, expected, `${id}: actual maskActor spans stage${stage}`); assertions++;
      poses.push({ stage, bounds, ground: Number.isFinite(ground) ? ground : String(ground), spanCount: expected.length, oldSha256: hash(JSON.stringify(expected)), newSha256: hash(JSON.stringify(item.draw)) });
    }
    const clears = a.events.clears + b.events.clears;
    maskActor.call(owner); assert.equal(a.events.clears + b.events.clears, clears, 'unchanged original bounds/ground key reuses mask'); assertions++;
  }
  a.object.scene = null; maskActor.call(owner); assert(a.entry.retired); assert.equal(a.events.graphicsDestroyed, 1); assert.equal(a.events.maskDestroyed, 1); assert.equal(a.entry.objects.length, 0); assertions += 4;
  b.object.scene = null; maskActor.call(owner); field.destroy(); assert.equal(field.byteLength, 0); maskActor.call(owner); // Retired actors never query the destroyed field.
  assert.throws(() => field.isVisibleAtPixel(0, 0, 1), /after destruction/); assertions += 2;
  const allocatedBytes = (oldAlpha.length + Math.ceil(field.width / 16) * field.height) * 4;
  const rebuilt = new ActorOcclusionField(world); assert.equal(rebuilt.byteLength, allocatedBytes); assert.equal(rebuilt.isVisibleAtPixel(0, 0, 1), oracle(world, 0, 0, 1)); rebuilt.destroy(); assertions += 2;
  const row = { world: id, family: world.definition.family, grade: 'severe', seed: 20261004, buildMs, width: field.width, height: field.height,
    allocatedBytes, roles: { solid, relief, empty }, alphaOldSha256: hash(oldAlpha), alphaNewSha256: hash(newAlpha), alphaDifferences: 0, poses, destroyedBytes: field.byteLength };
  results.push(row); console.log(`${id}: exact pixels/spans, build${buildMs.toFixed(2)}ms/${row.allocatedBytes}bytes`);
}
writeFileSync(`${out}/report.json`, `${JSON.stringify({ status: 'passed', assertions, sources: ['src/systems/r100-world/actor-occlusion-field.ts', 'src/systems/r100-world/presentation.ts'].map(path => ({ path })), results }, null, 2)}\n`);
console.log(`${assertions} exact equivalence assertions passed.`);
