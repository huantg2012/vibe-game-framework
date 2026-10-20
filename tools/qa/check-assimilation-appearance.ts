import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {
  ASSIMILATION_SURFACE_STRIDE, ASSIMILATION_GRIP_CONTACT_RADIUS, AssimilationLookParameters,
  getAssimilationLookPalettes, sampleAssimilationSurface, writeAssimilationSurface,
} from '../../src/art/assimilation-appearance';
import { LAST_LIGHT_PLAYER_CAMERA as camera, LAST_LIGHT_PLAYER_BASIS as basis } from '../../src/entities/player-last-light-math';
import { unprojectLastLight } from '../../src/art/last-light-spatial';
import { lastLightWalkArm } from '../../src/art/last-light-gait';

const root = 'public/assets/player-last-light-a/';
const manifest = JSON.parse(await fs.readFile(root + 'manifest.json', 'utf8'));
const base = manifest.variants.find((variant: { id: string }) => variant.id === 'a');
const look = new AssimilationLookParameters(), scratch = new Float32Array(5);
const state = { amount: 0, fibre: 1, membrane: 0, seconds: 0, motion: true, subjective: false };
const checks = { frames: 0, opaque: 0, maskBytes: 0, affected: 0, identityProtected: 0, originalTraces: 0, motion: 0, sourceDifference: 0 };
const protectedParts = { sole: 0, lens: 0, visor: 0, grip: 0 };
type Coverage = { opaque: number; affected: number };
const regions: Record<string, Coverage> = Object.fromEntries(
  ['helmet', 'pack', 'arms', 'legs', 'leftHand', 'rightHandBack', 'darkMaterial'].map(name => [name, { opaque: 0, affected: 0 }]));
const frameCoverage: { key: string; group: string; opaque: number; affected: number; ratio: number; fibreRegion: number; membraneRegion: number }[] = [];
const [fibrePalette, membranePalette] = getAssimilationLookPalettes();
assert.equal(fibrePalette.worldId, 'crystal-fibre');
assert.equal(membranePalette.worldId, 'ruptured-film');

for (const [group, atlas] of [['original', base.atlas], ['bodyWithoutArm', manifest.bodyWithoutArm.atlas]] as const) {
  const [albedo, depth, material] = await Promise.all(['albedo', 'depth', 'material'].map(async key =>
    sharp(root + atlas[key]).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
  for (const frame of base.frames) {
    const count = frame.rect[2] * frame.rect[3], mask = new Uint8Array(count * ASSIMILATION_SURFACE_STRIDE);
    let opaque = 0, affected = 0, fibreRegion = 0, membraneRegion = 0;
    const c = Math.cos(frame.yaw), s = Math.sin(frame.yaw);
    const leftWrist = frame.pose === 'walk' ? lastLightWalkArm(false, frame.phase / (Math.PI * 2)).wrist : [-.312, .758, .083];
    for (let y = 0; y < 80; y++) for (let x = 0; x < 64; x++) {
      const i = ((frame.rect[1] + y) * albedo!.info.width + frame.rect[0] + x) * 4;
      if (!albedo!.data[i + 3]) continue;
      opaque++; checks.opaque++;
      const relative = (depth!.data[i]! * 256 + depth!.data[i + 1]!) / 256 - 80;
      const p = unprojectLastLight(x + .5, y + .5, relative, camera, basis);
      const lx = p[0] * c - p[2] * s, ly = p[1], lz = p[0] * s + p[2] * c;
      const red = albedo!.data[i]!, green = albedo!.data[i + 1]!, blue = albedo!.data[i + 2]!;
      const emission = material!.data[i + 3]!;
      const maximum = Math.max(red, green, blue), offset = (y * 64 + x) * ASSIMILATION_SURFACE_STRIDE;
      // The palm contact is the pose-matched endpoint, not the entire glove.
      const contact = Math.hypot(p[0] - frame.wristWorld[0], p[1] - frame.wristWorld[1], p[2] - frame.wristWorld[2]) < ASSIMILATION_GRIP_CONTACT_RADIUS;
      writeAssimilationSurface(lx, ly, lz, maximum, emission, mask, offset, contact);
      const visor = maximum < 20 && ly > 1.22 && lz > .12 && Math.abs(lx) < .24;
      const grip = contact;
      const identityProtected = ly <= .09 || emission > 0 || visor || grip;
      if (ly <= .09) protectedParts.sole++;
      if (emission > 0) protectedParts.lens++;
      if (visor) protectedParts.visor++;
      if (grip) protectedParts.grip++;
      if (identityProtected) {
        checks.identityProtected++;
        assert.equal(mask[offset], 0, `${frame.key}: lens, sole, visor and actual grip remain protected`);
      } else if (!mask[offset]) checks.originalTraces++;
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
      const isAffected = scratch[4]! >= .5;
      if (isAffected) { affected++; checks.affected++; }
      const countRegion = (name: string, belongs: boolean): void => {
        if (!belongs) return;
        regions[name]!.opaque++;
        if (isAffected) regions[name]!.affected++;
      };
      countRegion('helmet', ly > 1.22 && !visor);
      countRegion('pack', lz < -.17 && ly > .68 && ly < 1.25);
      countRegion('arms', Math.abs(lx) > .23 && ly > .65 && ly < 1.2);
      countRegion('legs', ly > .09 && ly < .62);
      countRegion('leftHand', Math.hypot(lx - leftWrist[0]!, ly - leftWrist[1]!, lz - leftWrist[2]!) < .13);
      countRegion('rightHandBack', group === 'original' && frame.glovePixels.includes(y * 64 + x) && !contact);
      countRegion('darkMaterial', maximum < 38 && !identityProtected);
      if (mask[offset]) {
        if (mask[offset + 5]! < 100) fibreRegion++;
        if (mask[offset + 5]! > 160) membraneRegion++;
        if (mask[offset + 6] && (mask[offset + 1] !== mask[offset + 2] || mask[offset + 3] !== mask[offset + 4])) checks.motion++;
        if (mask[offset + 1] !== mask[offset + 3]) checks.sourceDifference++;
      }
    }
    checks.frames++; checks.maskBytes += opaque * ASSIMILATION_SURFACE_STRIDE;
    frameCoverage.push({ key: frame.key, group, opaque, affected, ratio: affected / opaque, fibreRegion, membraneRegion });
    assert(fibreRegion >= 6 && membraneRegion >= 6, 'Every view retains independent source regions');
  }
}
assert.equal(checks.frames, 208);
assert(checks.maskBytes < 1024 * 1024, 'Bounded sparse masks must remain under 1 MiB');
for (const [name, region] of Object.entries(regions)) {
  assert(region.opaque > 20, `${name} must be represented in the real exported frames`);
  assert(region.affected / region.opaque >= .65, `${name} cannot remain a large protected block`);
}
assert(checks.motion > 500 && checks.sourceDifference > 1000, 'Actual exported frames exercise structured material and motion');
const movingSurface = new Uint8Array(ASSIMILATION_SURFACE_STRIDE), next = new Float32Array(5);
writeAssimilationSurface(-.29, 1.05, .08, 110, 0, movingSurface, 0);
for (let seconds = 0; seconds < 5; seconds += .01) {
  look.set({ ...state, seconds });
  sampleAssimilationSurface(movingSurface, 0, look, 100, 92, 85, scratch);
  look.set({ ...state, seconds: seconds + .000001 });
  sampleAssimilationSurface(movingSurface, 0, look, 100, 92, 85, next);
  for (let channel = 0; channel < 4; channel++)
    assert(Math.abs(scratch[channel]! - next[channel]!) < .001, 'Material phase cannot jump at a clock threshold');
}
look.set({ ...state, fibre: 0, membrane: 0, amount: 1 });
assert.equal(look.amount, 0, 'No source means unchanged body');
look.set({ ...state, fibre: Number.NaN, membrane: Infinity, amount: Number.NaN });
assert.equal(look.amount, 0, 'Nonfinite art controls cannot poison rendering');
look.set(null); assert.equal(look.enabled, false);
const ratios = frameCoverage.map(frame => frame.ratio);
const aggregate = checks.affected / checks.opaque;
assert(ratios.every(ratio => ratio >= .75 && ratio <= .90), 'Every original frame must reach 75–90% of all opaque pixels at mix weight >=0.5');
assert(checks.identityProtected / checks.opaque <= .15, 'Identity protection cannot become a large body exemption');
assert(Object.values(protectedParts).every(count => count > 0), 'All four small protection categories must exist in the real frame set');
console.log(JSON.stringify({ pass: true, checks, protectedParts, coverage: { aggregate, minimum: Math.min(...ratios), maximum: Math.max(...ratios) },
  regions, idleCoverage: frameCoverage.filter(frame => frame.group === 'original' && frame.key.includes('idle')),
  limits: 'Coverage uses material mix weight >=0.5 divided by every opaque body pixel. Original 208 exported frames only; deformed geometry and browser appearance remain separate checks.' }, null, 2));
