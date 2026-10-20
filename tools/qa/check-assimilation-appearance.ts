import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {
  ASSIMILATION_SURFACE_STRIDE, AssimilationLookParameters,
  getAssimilationLookPalettes, sampleAssimilationSurface, writeAssimilationSurface,
} from '../../src/art/assimilation-appearance';
import { LAST_LIGHT_PLAYER_CAMERA as camera, LAST_LIGHT_PLAYER_BASIS as basis } from '../../src/entities/player-last-light-math';
import { unprojectLastLight } from '../../src/art/last-light-spatial';

const root = 'public/assets/player-last-light-a/';
const manifest = JSON.parse(await fs.readFile(root + 'manifest.json', 'utf8'));
const base = manifest.variants.find((variant: { id: string }) => variant.id === 'a');
const look = new AssimilationLookParameters(), scratch = new Float32Array(5);
const state = { amount: 0, fibre: 1, membrane: 0, seconds: 0, motion: true, subjective: false };
const checks = { frames: 0, pixels: 0, maskBytes: 0, changed: 0, protected: 0, motion: 0, sourceDifference: 0 };
const idleCoverage: { key: string; mutable: number; covered: number; ratio: number }[] = [];
const [fibrePalette, membranePalette] = getAssimilationLookPalettes();
assert.equal(fibrePalette.worldId, 'crystal-fibre');
assert.equal(membranePalette.worldId, 'ruptured-film');

for (const atlas of [base.atlas, manifest.bodyWithoutArm.atlas]) {
  const [albedo, depth, material] = await Promise.all(['albedo', 'depth', 'material'].map(async key =>
    sharp(root + atlas[key]).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  for (const frame of base.frames) {
    const count = frame.rect[2] * frame.rect[3], mask = new Uint8Array(count * ASSIMILATION_SURFACE_STRIDE);
    let visible = 0, mutable = 0, covered = 0;
    const c = Math.cos(frame.yaw), s = Math.sin(frame.yaw);
    for (let y = 0; y < 80; y++) for (let x = 0; x < 64; x++) {
      const i = ((frame.rect[1] + y) * albedo!.info.width + frame.rect[0] + x) * 4;
      if (!albedo!.data[i + 3]) continue;
      visible++; checks.pixels++;
      const relative = (depth!.data[i]! * 256 + depth!.data[i + 1]!) / 256 - 80;
      const p = unprojectLastLight(x + .5, y + .5, relative, camera, basis);
      const localX = p[0] * c - p[2] * s, localZ = p[0] * s + p[2] * c;
      const red = albedo!.data[i]!, green = albedo!.data[i + 1]!, blue = albedo!.data[i + 2]!;
      const emission = material!.data[i + 3]!;
      const maximum = Math.max(red, green, blue), offset = (y * 64 + x) * ASSIMILATION_SURFACE_STRIDE;
      writeAssimilationSurface(localX, p[1], localZ, maximum, emission, mask, offset,
        frame.glovePixels.includes(y * 64 + x));
      const isProtected = p[1] <= .27 || p[1] >= 1.2 || (localZ < -.17 && p[1] > .68)
        || (localX > .22 && p[1] > .6) || (Math.abs(localX) > .23 && p[1] < .84) || emission > 0 || maximum < 38
        || (Math.abs(localX) < .036 && localZ > .08);
      if (isProtected) { checks.protected++; assert.equal(mask[offset], 0, `${frame.key}: identity protection`); }
      else mutable++;
      if (frame.glovePixels.includes(y * 64 + x)) assert.equal(mask[offset], 0, `${frame.key}: exported held-tool glove protection`);
      if (mask[offset]) { covered++; checks.changed++; }
      state.amount = 0; look.set(state);
      sampleAssimilationSurface(mask, offset, look, red, green, blue, scratch);
      assert.deepEqual([...scratch], [red, green, blue, 0, 0], `${frame.key}: exact zero`);
      let previousCoverage = 0;
      for (const amount of [.000001, .23, .47, .69, 1]) {
        state.amount = amount; look.set(state);
        sampleAssimilationSurface(mask, offset, look, red, green, blue, scratch);
        assert(scratch.every(Number.isFinite));
        assert(scratch[4]! >= previousCoverage, 'Continuous amount cannot retreat or reseed a region');
        assert(Math.abs(scratch[3]!) <= .18, 'Normal relief remains bounded');
        if (amount === .000001) assert(Math.abs(scratch[0]! - red) < .00001, 'No visible discontinuity at zero');
        previousCoverage = scratch[4]!;
      }
      if (mask[offset]) {
        if (mask[offset + 6] && (mask[offset + 1] !== mask[offset + 2] || mask[offset + 3] !== mask[offset + 4])) checks.motion++;
        if (mask[offset + 1] !== mask[offset + 3]) checks.sourceDifference++;
      }
    }
    checks.frames++; checks.maskBytes += visible * ASSIMILATION_SURFACE_STRIDE;
    if (atlas === base.atlas && frame.pose === 'idle')
      idleCoverage.push({ key: frame.key, mutable, covered, ratio: covered / mutable });
  }
}
assert.equal(checks.frames, 208);
assert(checks.maskBytes < 1024 * 1024, 'Bounded sparse masks must remain under 1 MiB');
assert(checks.changed > 4000 && checks.motion > 500 && checks.sourceDifference > 1000, 'Actual exported frames exercise structured material and motion');
look.set({ ...state, fibre: 0, membrane: 0, amount: 1 });
assert.equal(look.amount, 0, 'No source means unchanged body');
look.set({ ...state, fibre: Number.NaN, membrane: Infinity, amount: Number.NaN });
assert.equal(look.amount, 0, 'Nonfinite art controls cannot poison rendering');
look.set(null); assert.equal(look.enabled, false);
console.log(JSON.stringify({ pass: true, checks, idleCoverage,
  limits: 'Pure exported-frame coverage/identity/continuity checks. Does not establish visual acceptance or browser render performance.' }, null, 2));
