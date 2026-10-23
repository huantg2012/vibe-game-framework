/** Bounded offline checks: anatomy, saved contracts, hazard fields and lighting.
 * No browser/Phaser scene, gameplay automation or save access. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { nativeSubjects, nativeOut, groundSource, coverages, facingNames } from './native-specimens';
import { productionModelFor } from '../../src/entities/form-renderers/d/production-models';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import { resolveRuntimeEnemyWorldAppearance } from '../../src/entities/form-renderers/d/world-runtime';
import { BODY_INKS } from '../../src/entities/form-renderers/d/body-pixel-material';
import { lightModelPixels } from '../../src/entities/form-renderers/d/model-visual';
import { createVolumePresenceFrame, updateVolumePresenceFrame, sampleVolumeDensity, volumeTimeAtPhase } from '../../src/systems/volume-presence';
import { paintNativeVolume } from '../../src/entities/form-renderers/d/native-volume-paint';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { withEnemyAppearance } from '../../src/generation/world-study/enemy-appearance-contract';
import type { CreaturePhase } from '../../src/entities/form-renderers/d/model-raster';

const worlds = JSON.parse(fs.readFileSync(`${groundSource}/atlas.json`, 'utf8')).cards as { worldId: string }[];
const hash = (data: Uint8ClampedArray | Uint8Array) => createHash('sha256').update(data).digest('hex');
const phases: CreaturePhase[] = ['idle', 'walk', 'alert', 'windup', 'strike', 'recover'];
const times: number[] = [], volumeTimes: number[] = [], litVolumeTimes: number[] = [];
let frames = 0, volumes = 0, contracts = 0, minMargin = 64, normalChecks = 0;
const masks = new Map<string, Set<string>>();
for (const { worldId } of worlds) {
  const material = resolveEnemyWorldAdaptation(worldId)!;
  const palette = new Set([...Object.values(BODY_INKS).flat(), material.dark, material.mid, material.light, material.secondary].map(c => c.join(',')));
  for (const subject of nativeSubjects.filter(s => s.type === 'body')) {
    const model = productionModelFor(subject.id, true, 3)!;
    assert.notEqual(model.id, productionModelFor(subject.id, true, 2)!.id);
    assert.equal(productionModelFor(subject.id, false, 3), productionModelFor(subject.id));
    for (const seed of [1, 2, 7]) for (const coverage of coverages) for (const facing4 of facingNames) for (const phase of phases) for (const phase01 of [0, .5, 1]) {
      const req = { seed, coverage, facing4, phase, phase01, worldAdaptation: material };
      const start = performance.now(), body = model.bake(req); times.push(performance.now() - start);
      assert.deepEqual([body.canvas.w, body.canvas.h, body.canvas.originX, body.canvas.originY, body.canvas.collision], [64, 64, 32, 42, 20]);
      assert(body.lightingSurface);
      let pixels = 0;
      for (let i = 0; i < 4096; i++) {
        const a = body.buf.data[i * 4 + 3]; assert(a === 0 || a === 255, 'hard alpha');
        if (!a) continue;
        pixels++;
        const x = i % 64, y = Math.floor(i / 64); minMargin = Math.min(minMargin, x, y, 63 - x, 63 - y);
        assert(palette.has(Array.from(body.buf.data.subarray(i * 4, i * 4 + 3)).join(',')), 'only native and retained body pigments');
        const n = body.lightingSurface.normals.subarray(i * 3, i * 3 + 3);
        assert(Math.abs(Math.hypot(...n) - 1) < .001, 'opaque pixels have geometric normals'); normalChecks++;
      }
      assert(pixels > 45);
      if (phase === 'walk' && phase01 === 0) assert.equal(hash(body.buf.data), hash(model.bake({ ...req, phase01: 1 }).buf.data), 'walk cycle closes');
      if (seed === 1 && phase === 'idle' && phase01 === 0 && facing4 === 'down') {
        assert.equal(hash(body.buf.data), hash(model.bake(req).buf.data), 'deterministic bake');
        const key = `${subject.id}:${coverage}`, set = masks.get(key) ?? new Set();
        set.add(hash(body.buf.data.filter((_, i) => i % 4 === 3))); masks.set(key, set);
        const shaded = body.buf.data.slice(); lightModelPixels(shaded, body.lightingSurface, 0, 0, { lights: [] });
        assert.notEqual(hash(shaded), hash(body.buf.data), 'native bodies receive scene lighting');
      }
      frames++;
    }
  }
  for (const substrate of ['gas_mass', 'mist_bank', 'dust_swarm']) for (const coverage of coverages) for (const phase of ['rest', 'gather', 'release', 'disperse'] as const) for (const active of [true, false]) {
    const frame = updateVolumePresenceFrame(createVolumePresenceFrame(), { substrate, coverage, elapsedMs: volumeTimeAtPhase(substrate, phase, .6), rect: { x: 64, y: 64, w: 128, h: 96 }, active,
      isWalkableFloor: (x, y) => !(x === 3 && y === 3) });
    const before = JSON.stringify(frame), out = new Uint8ClampedArray(160 * 128 * 4), opacity = active ? 1 : .5;
    const start = performance.now(); paintNativeVolume(out, 160, 128, frame, 37, { material }, 2); volumeTimes.push(performance.now() - start);
    assert.equal(JSON.stringify(frame), before, 'render cannot mutate authoritative density');
    for (let y = 0; y < 128; y++) for (let x = 0; x < 160; x++) {
      const d = sampleVolumeDensity(frame, x + 48.5, y + 48.5), a = out[(y * 160 + x) * 4 + 3]!;
      if (d < .035) assert.equal(a, 0, 'VOID, mist passage and absent air remain clear');
      if (d >= frame.dangerThreshold) assert(a >= (substrate === 'gas_mass' ? 100 : substrate === 'mist_bank' ? 50 : 48) * opacity, 'texture never erases danger');
    }
    const repeated = new Uint8ClampedArray(out.length); paintNativeVolume(repeated, 160, 128, frame, 37, { material }, 2);
    assert.equal(hash(repeated), hash(out)); volumes++;
    if (active && coverage === 'rewrite' && phase === 'release') {
      let rays = 0;
      const light = { x: 100, y: 120, z: 90, radius: 350, intensity: 2.4, color: [1, .8, .6] as const };
      const lighting = { lights: [light], shadeAt: () => { rays++; return .6; } };
      for (let sample = 0; sample < 3; sample++) {
        rays = 0; const start = performance.now();
        paintNativeVolume(repeated, 160, 128, frame, 37, { material, lighting }, 2);
        litVolumeTimes.push(performance.now() - start);
        assert(rays <= Math.ceil(160 / 4) * Math.ceil(128 / 4), 'bounded shadow queries per 4px optical cell');
      }
      assert.notEqual(hash(repeated), hash(out), 'air receives world lighting');
      assert.deepEqual(repeated.filter((_, i) => i % 4 === 3), out.filter((_, i) => i % 4 === 3), 'lighting never alters air density alpha');
    }
  }
  // Echo's dedicated pressure geometry is checked in check-air-readability.ts;
  // preserving legacy alpha here would preserve the reported rectangular fill.

}
assert(minMargin >= 3, `native geometry margin ${minMargin}`);
for (const [key, values] of masks) assert(values.size >= 3, `${key}: materials must change structure as well as pigment`);
for (const world of R100_NATIVE_WORLDS) for (const grade of ['low', 'medium', 'severe'] as const) {
  const current = createR100ProductionRecipe(world.id, 20261023, grade), old = withEnemyAppearance(current, 2);
  assert.equal(current.enemyAppearance!.version, 3);
  assert(validR100ProductionRecipe(JSON.parse(JSON.stringify(current)))); assert(validR100ProductionRecipe(old));
  const { enemyAppearance: a, ...base } = current, { enemyAppearance: b, ...oldBase } = old;
  assert.deepEqual(base, oldBase, 'visual rollout cannot alter layout or deployment'); assert.notEqual(a!.signature, b!.signature);
  const wrong = structuredClone(current); (wrong.enemyAppearance as { version: number }).version = 2;
  assert(!validR100ProductionRecipe(wrong), 'version change cannot reuse another generation signature');
  for (const subject of nativeSubjects) assert.equal(resolveRuntimeEnemyWorldAppearance(a!.material, subject.id, undefined, 3).worldAdaptation, a!.material);
  assert.deepEqual(resolveRuntimeEnemyWorldAppearance(a!.material, 'gas_mass', undefined, 2), {});
  assert.equal(productionModelFor('organic_remnant', true, 2)!.id, 'human17');
  assert.equal(productionModelFor('organic_remnant', true, 3)!.id, 'organic_remnant-native3');
  contracts++;
}
const stats = (values: number[]) => { values.sort((a, b) => a - b); return { median: values[Math.floor(values.length * .5)], p95: values[Math.floor(values.length * .95)], max: values.at(-1) }; };
const report = { scope: 'Offline native models, appearance v2/v3 contracts and unchanged hazard fields. No gameplay or GPU performance claim.', frames, normalChecks, volumes, contracts, minimumMargin: minMargin,
  materialSilhouettes: Object.fromEntries([...masks].map(([k, v]) => [k, v.size])), cpuBodyMs: stats(times), cpuVolumeMs: stats(volumeTimes), cpuLitVolumeMs: stats(litVolumeTimes) };
fs.mkdirSync(nativeOut, { recursive: true }); fs.writeFileSync(`${nativeOut}/checks.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
