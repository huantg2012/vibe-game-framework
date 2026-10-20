import assert from 'node:assert/strict';
import { Model, type V3 } from '../../docs/art/demos/purification-last-light/model';
import { buildActor, actorLampAnchor } from '../../docs/art/demos/purification-last-light/actor';
import { render } from '../../docs/art/demos/purification-last-light/render';
import {
  ASSIMILATION_MODEL_CAMERA, buildAssimilationModel, morphAssimilationPoint,
} from '../../src/dev/assimilation-model-geometry';
import { bakeAssimilationModel } from '../../src/dev/assimilation-model-worker';
import type { AssimilationModelFrame, AssimilationModelRequest } from '../../src/dev/assimilation-model-protocol';
import { lastLightBasis, unprojectLastLight } from '../../src/art/last-light-spatial';
import {
  ASSIMILATION_GRIP_CONTACT_RADIUS, ASSIMILATION_SURFACE_STRIDE, AssimilationLookParameters,
  sampleAssimilationSurface, writeAssimilationSurface,
} from '../../src/art/assimilation-appearance';

const base: AssimilationModelRequest = { id: 1, amount: 0, fibre: .5, phase: null, yaw: 0, breath: 0 };
const distance = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const coverageContract = { minimum: .75, maximum: .90, materialWeight: .5 };
const basis = lastLightBasis(ASSIMILATION_MODEL_CAMERA);
function materialCoverage(frame: AssimilationModelFrame) {
  const look = new AssimilationLookParameters();
  look.set({ amount: 1, fibre: frame.meta.fibre, membrane: 1 - frame.meta.fibre, seconds: 0, motion: false, subjective: false });
  const surface = new Uint8Array(ASSIMILATION_SURFACE_STRIDE), sample = new Float32Array(5);
  const c = Math.cos(frame.meta.yaw), s = Math.sin(frame.meta.yaw);
  let visiblePixels = 0, coveredPixels = 0, gripContactPixels = 0;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const i = (y * frame.width + x) * 4;
    if (!frame.albedo[i + 3]) continue;
    visiblePixels++;
    const depth = (frame.depth[i]! * 256 + frame.depth[i + 1]!) / 256 - 80;
    const point = unprojectLastLight(x + .5, y + .5, depth, ASSIMILATION_MODEL_CAMERA, basis);
    const gripContact = distance(point, frame.meta.wrist.world) < ASSIMILATION_GRIP_CONTACT_RADIUS;
    if (gripContact) gripContactPixels++;
    writeAssimilationSurface(point[0] * c - point[2] * s, point[1], point[0] * s + point[2] * c,
      Math.max(frame.albedo[i]!, frame.albedo[i + 1]!, frame.albedo[i + 2]!),
      frame.material[i + 3]! / 255 * 2, surface, 0, gripContact);
    sampleAssimilationSurface(surface, 0, look, frame.albedo[i]!, frame.albedo[i + 1]!, frame.albedo[i + 2]!, sample);
    if (sample[4]! >= coverageContract.materialWeight) coveredPixels++;
  }
  assert(visiblePixels > 0, 'Coverage denominator includes every visible alpha pixel');
  const ratio = coveredPixels / visiblePixels;
  return { visiblePixels, coveredPixels, gripContactPixels, ratio,
    withinContract: ratio >= coverageContract.minimum && ratio <= coverageContract.maximum };
}
const results: { yaw: number; fibre: number; phase: number | null; changedSilhouettePixels: number; triangles: number; ms: number;
  coverage: ReturnType<typeof materialCoverage> }[] = [];
for (const phase of [null, Math.PI / 2]) {
  for (const yaw of [Math.atan2(19, 30), Math.atan2(19, 30) + Math.PI / 2, Math.atan2(19, 30) + Math.PI]) {
    const request = { ...base, phase, yaw };
    const original = new Model();
    buildActor(original, [0, 0, 0], yaw, 0, phase ?? undefined);
    const zero = buildAssimilationModel(request);
    assert.deepEqual(zero.model.triangles, original.triangles, 'A0 is the exact original model, including material and normals');
    assert.deepEqual(zero.meta.lamp, actorLampAnchor([0, 0, 0], yaw, 0, phase ?? undefined));
    for (const light of original.lights) { light.power = 1; light.radius = 2.6; }
    const originalFrame = render(original, ASSIMILATION_MODEL_CAMERA, undefined, { transparentBackground: true, skipEnergy: true });
    const unchanged = bakeAssimilationModel(request);
    assert.deepEqual(unchanged.albedo, new Uint8Array(originalFrame.albedo.buffer), 'A0 albedo is byte-identical');
    assert.deepEqual(unchanged.normal, new Uint8Array(originalFrame.normal.buffer), 'A0 normals are byte-identical');
    assert.deepEqual(unchanged.material, new Uint8Array(originalFrame.roughSpec.buffer), 'A0 materials are byte-identical');
    for (const fibre of [0, .5, 1]) {
      const high = bakeAssimilationModel({ ...request, amount: 1, fibre });
      let changed = 0;
      for (let i = 3; i < high.albedo.length; i += 4) {
        if (high.albedo[i] !== unchanged.albedo[i]) changed++;
        assert.equal(high.depth[i], high.albedo[i], 'Geometry and depth share opaque coverage');
      }
      assert(changed >= 45, 'A100 changes actual silhouette at each representative yaw, not only surface colour');
      assert(high.triangles > original.triangles.length, 'High assimilation adds actual closed structure');
      assert(distance(high.meta.lamp, unchanged.meta.lamp) > .05, 'Shoulder light follows the changed body');
      assert(distance(high.meta.wrist.world, unchanged.meta.wrist.world) > .01, 'Wrist follows the changed body');
      assert(high.meta.shadowCapsules.flat().every(Number.isFinite), 'Shadow capsules remain finite');
      assert.equal(high.meta.shadowCapsules.length, zero.meta.shadowCapsules.length, 'Existing shadow rig remains compatible');
      for (let x = 0; x < 64; x++) {
        assert.equal(high.albedo[x * 4 + 3], 0, 'No top clipping');
        assert.equal(high.albedo[((80 - 1) * 64 + x) * 4 + 3], 0, 'No bottom clipping');
      }
      for (let y = 0; y < 80; y++) {
        assert.equal(high.albedo[(y * 64) * 4 + 3], 0, 'No left clipping');
        assert.equal(high.albedo[(y * 64 + 63) * 4 + 3], 0, 'No right clipping');
      }
      results.push({ yaw, fibre, phase, changedSilhouettePixels: changed, triangles: high.triangles, ms: high.buildMs + high.bakeMs,
        coverage: materialCoverage(high) });
    }
  }
}
const local = new Model(); buildActor(local, [0, 0, 0], 0, 0);
for (const t of local.triangles) for (const point of [t.a, t.b, t.c]) {
  if (point[1] <= .56) assert.deepEqual(morphAssimilationPoint(point, 1, .5), point, 'Soles/lower legs are not moved by the posture field');
}
const head: V3 = [0, 1.55, 0];
const front = morphAssimilationPoint(head, 1, .5);
assert(front[2] > .25 && front[1] < head[1] - .04, 'Head leans forward and lowers in true geometry');
const left = morphAssimilationPoint([-.276, 1.145, .008], 1, .5);
const right = morphAssimilationPoint([.276, 1.145, .008], 1, .5);
assert(left[1] - right[1] > .075, 'Shoulder asymmetry is a real world-space height difference');
for (let i = 0; i < 100; i++) {
  const a = morphAssimilationPoint(head, i / 100, .5), b = morphAssimilationPoint(head, (i + 1) / 100, .5);
  assert(distance(a, b) < .012, 'Amount is continuous without structural state thresholds');
  const f = morphAssimilationPoint(head, 1, i / 100), g = morphAssimilationPoint(head, 1, (i + 1) / 100);
  assert(distance(f, g) < .002, 'Source mixture uses one continuous pose');
}
assert.throws(() => buildAssimilationModel({ ...base, amount: Infinity }), /Invalid/);
// A recovery stage is a separate pose coordinate, not a thirteenth walk frame.
for (const settle of [.25, .5, .75, 1]) {
  const request = { ...base, phase: Math.PI * 7 / 6, settle, yaw: .7 };
  const original = new Model(); buildActor(original, [0, 0, 0], request.yaw, 0, request.phase, settle);
  assert.deepEqual(buildAssimilationModel(request).model.triangles, original.triangles, 'A0 matches each original recovery stage');
  const recovery = buildAssimilationModel({ ...request, amount: 1 });
  assert.equal(recovery.meta.settle, settle);
  assert(recovery.model.triangles.every(t => [...t.a, ...t.b, ...t.c, ...t.normal].every(Number.isFinite)));
  if (settle === 1) {
    const idle = buildAssimilationModel({ ...base, amount: 1, yaw: request.yaw });
    assert.deepEqual(recovery.model.triangles, idle.model.triangles, 'Final recovery settles body and growth into the identical idle model');
    assert.deepEqual(recovery.meta.lamp, idle.meta.lamp, 'Final recovery lamp is idle');
    assert.deepEqual(recovery.meta.wrist, idle.meta.wrist, 'Final recovery grip is idle');
    assert.deepEqual(recovery.meta.shadowCapsules, idle.meta.shadowCapsules, 'Final recovery shadows are idle');
  }
}
assert.throws(() => buildAssimilationModel({ ...base, settle: 2 }), /Invalid/);
const coverageRange = (frames: typeof results) => ({
  minimum: Math.min(...frames.map(frame => frame.coverage.ratio)),
  maximum: Math.max(...frames.map(frame => frame.coverage.ratio)),
  aggregate: frames.reduce((n, frame) => n + frame.coverage.coveredPixels, 0)
    / frames.reduce((n, frame) => n + frame.coverage.visiblePixels, 0),
});
const outsideContract = results.filter(frame => !frame.coverage.withinContract);
console.log(JSON.stringify({ pass: outsideContract.length === 0, frames: results.length,
  coverageContract, coverageRange: coverageRange(results),
  coverageBySource: [0, .5, 1].map(fibre => ({ fibre, ...coverageRange(results.filter(frame => frame.fibre === fibre)) })),
  coverageByPose: [null, Math.PI / 2].map(phase => ({ phase, ...coverageRange(results.filter(frame => frame.phase === phase)) })),
  outsideCoverageContract: outsideContract.map(({ yaw, fibre, phase, coverage }) => ({ yaw, fibre, phase, ...coverage })),
  results,
  limits: 'Finite author-geometry/raster and shared CPU material checks; no scene integration, GPU parity, combat, seated morph, browser Worker throughput or human visual acceptance.' }, null, 2));
assert.equal(outsideContract.length, 0, 'Every A100 sample must cover 75–90% of all visible alpha pixels at material weight >= .5; inspect the printed ranges without changing the mask to pass.');
