import assert from 'node:assert/strict';
import { Model, type V3 } from '../../docs/art/demos/purification-last-light/model';
import { buildActor, actorLampAnchor } from '../../docs/art/demos/purification-last-light/actor';
import { render } from '../../docs/art/demos/purification-last-light/render';
import {
  ASSIMILATION_MODEL_CAMERA, buildAssimilationModel, morphAssimilationPoint,
} from '../../src/dev/assimilation-model-geometry';
import { bakeAssimilationModel } from '../../src/dev/assimilation-model-worker';
import type { AssimilationModelRequest } from '../../src/dev/assimilation-model-protocol';

const base: AssimilationModelRequest = { id: 1, amount: 0, fibre: .5, phase: null, yaw: 0, breath: 0 };
const distance = (a: V3, b: V3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const results: { yaw: number; fibre: number; phase: number | null; changedSilhouettePixels: number; triangles: number; ms: number }[] = [];
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
      results.push({ yaw, fibre, phase, changedSilhouettePixels: changed, triangles: high.triangles, ms: high.buildMs + high.bakeMs });
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
console.log(JSON.stringify({ pass: true, frames: results.length, results,
  limits: 'Finite author-geometry/raster checks; no scene integration, combat, seated morph, browser Worker throughput or human visual acceptance.' }, null, 2));
