/** Presentation-only gates: legacy parity, anatomy registration, deterministic
 * world/seed variation and authoritative animation seams. Not an art verdict. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bakeHumanModel, type HumanModelRequest, type HumanPhase } from '../../src/entities/form-renderers/d/human-model';
import { resolveEnemyWorldAdaptation } from '../../src/entities/form-renderers/d/world-adaptation';
import type { CoverageId } from '../../src/generated/contamination-lexicon-data';
import { lightModelPixels } from '../../src/entities/form-renderers/d/model-visual';
const tiers: CoverageId[] = ['infiltrate', 'rewrite', 'overwrite'];
const facings = ['up', 'down', 'left', 'right'] as const;
const phases: HumanPhase[] = ['idle', 'walk', 'alert', 'windup', 'strike', 'recover'];
const hash = (data: Uint8ClampedArray) => createHash('sha256').update(data).digest('hex');
const alphaHash = (data: Uint8ClampedArray) => hash(data.filter((_, i) => i % 4 === 3));
const legacy: string[] = [];
for (const coverage of tiers) for (const facing4 of facings) for (const phase of phases) for (const phase01 of [0, .25, .5, .75, 1]) {
  legacy.push(hash(bakeHumanModel({ seed: 37, coverage, facing4, phase, phase01 }).buf.data));
}
// Captured before the optional world branch was introduced (360 existing poses).
assert.equal(createHash('sha256').update(JSON.stringify(legacy)).digest('hex'), '6c41dfe27fd4d60e7e9282620cc5a7bd69ed728457fce415faa84ac74e84976b');
assert.equal(resolveEnemyWorldAdaptation('not-a-world'), undefined);
assert.equal(resolveEnemyWorldAdaptation('ash-strata'), undefined);
const profiles = ['crystal-fibre', 'ruptured-film'].map(id => resolveEnemyWorldAdaptation(id)!);
assert(profiles.every(Boolean));
assert.notEqual(profiles[0]!.key, profiles[1]!.key);
let frames = 0, silhouetteDifferences = 0, minMargin = 64;
for (const seed of [1, 37, 4294967295]) for (const coverage of tiers) for (const facing4 of facings) for (const phase of phases) for (const phase01 of [0, .25, .5, .75, 1]) {
  const request: HumanModelRequest = { seed, coverage, facing4, phase, phase01 };
  const silhouettes: string[] = [];
  for (const worldAdaptation of profiles) {
    const { buf, canvas } = bakeHumanModel({ ...request, worldAdaptation });
    assert.equal(hash(buf.data), hash(bakeHumanModel({ ...request, worldAdaptation }).buf.data));
    assert.deepEqual([canvas.w, canvas.h, canvas.originX, canvas.originY, canvas.collision], [64, 64, 32, 42, 20]);
    const palette = new Set([worldAdaptation.dark, worldAdaptation.mid, worldAdaptation.light, worldAdaptation.secondary].map(rgb => rgb.join(',')));
    let pixels = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4, alpha = buf.data[i + 3];
      assert(alpha === 0 || alpha === 255);
      if (!alpha) continue;
      pixels++;
      minMargin = Math.min(minMargin, x, y, 63 - x, 63 - y);
      assert(palette.has(Array.from(buf.data.slice(i, i + 3)).join(',')));
    }
    assert(pixels >= 80);
    silhouettes.push(alphaHash(buf.data));
    frames++;
  }
  if (silhouettes[0] !== silhouettes[1]) silhouetteDifferences++;
}
assert(minMargin >= 2);
assert(silhouetteDifferences > frames * .4, 'world adaptation must change anatomy, not merely RGB');
for (const worldAdaptation of profiles) for (const coverage of tiers) for (const facing4 of facings) {
  const request = { seed: 37, coverage, facing4, worldAdaptation };
  const pose = (phase: HumanPhase, phase01: number) => hash(bakeHumanModel({ ...request, phase, phase01 }).buf.data);
  for (const phase of ['idle', 'walk'] as const) assert.equal(pose(phase, 0), pose(phase, 1));
  assert.equal(pose('strike', 1), pose('recover', 0));
  assert.equal(pose('recover', 1), pose('idle', 0));
}
for (const worldAdaptation of profiles) {
  const variants = new Set([1, 37, 89, 1024].map(seed => hash(bakeHumanModel({ seed, coverage: 'rewrite', facing4: 'down', phase: 'walk', phase01: .25, worldAdaptation }).buf.data)));
  assert(variants.size > 1, 'seed variation missing');
  const baked = bakeHumanModel({ seed: 37, coverage: 'rewrite', facing4: 'down', phase: 'idle', phase01: 0, worldAdaptation });
  assert(baked.lightingSurface);
  const before = hash(baked.buf.data), lit = baked.buf.data.slice(), dark = baked.buf.data.slice();
  lightModelPixels(lit, baked.lightingSurface, 0, 0, { lights: [{ x: -15, y: 64, z: 42, radius: 330, intensity: 2.6, color: [1, .94, .86] }] });
  lightModelPixels(dark, baked.lightingSurface, 0, 0, { lights: [] });
  assert.notEqual(hash(lit), hash(dark), 'same cached pose responds to scene light');
  assert.equal(alphaHash(lit), alphaHash(baked.buf.data));
  assert.equal(hash(baked.buf.data), before, 'lighting cannot mutate cached albedo');
  for (let i = 0; i < 4096; i++) if (lit[i * 4 + 3]) {
    const p = i * 3, n = baked.lightingSurface.normals;
    assert(Math.abs(Math.hypot(n[p]!, n[p+1]!, n[p+2]!) - 1) < .001);
  }
}
console.log(JSON.stringify({ legacyFrames: legacy.length, legacyByteParity: true, adaptedFrames: frames, silhouetteDifferences, minMargin, registration: [64, 64, 32, 42, 20], deterministic: true, binaryAlpha: true, worldPaletteOnly: true, animationSeams: 0 }));
