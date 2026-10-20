import assert from 'node:assert/strict';
import { AssimilationStatePresentation } from '../../src/art/assimilation-state-presentation';
import {
  ASSIMILATION_NEUTRAL_PALETTE, ASSIMILATION_SURFACE_STRIDE, AssimilationLookParameters,
  getAssimilationLookPalettes, sampleAssimilationSurface, writeAssimilationSurface,
} from '../../src/art/assimilation-appearance';
import { R100_WORLD_APPEARANCES } from '../../src/generated/r100-world-appearance';
import { normalizeAssimilationSources } from '../../src/systems/assimilation-system';

const projection = new AssimilationStatePresentation(), look = new AssimilationLookParameters();
const [fp, mp] = getAssimilationLookPalettes();
const near = (a: number, b: number): void => assert(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`);
projection.update(100, { version: 1, worlds: { 'crystal-fibre': 60, 'ruptured-film': 40 }, unattributed: 0 }, 3, true, false);
assert.equal(projection.typedFraction, 1);
assert.equal(projection.look.fibre, .6);
assert.equal(projection.look.neutralFraction, 0);
assert.deepEqual(projection.look.palettes?.[0].mid, fp.mid);
assert.deepEqual(projection.look.palettes?.[1].light, mp.light);
const lookReference = projection.look, palettesReference = projection.look.palettes;
const paletteRevision = projection.look.paletteRevision;
projection.update(50, { version: 1, worlds: { 'crystal-fibre': 30, 'ruptured-film': 20 }, unattributed: 0 }, 4, false, true);
assert.equal(projection.look, lookReference);
assert.equal(projection.look.palettes, palettesReference);
assert.equal(projection.look.paletteRevision, paletteRevision, 'healing retains material identities and needs no palette upload');
assert.equal(projection.look.amount, .5);
assert.equal(projection.look.seconds, 4);
assert.equal(projection.look.motion, false);
assert.equal(projection.look.subjective, true);

projection.update(100, { version: 1, worlds: { 'cinder-ridge': 100 }, unattributed: 0 }, 0, true, true);
assert.equal(projection.typedFraction, 0, 'no unapproved local anatomy is invented');
assert.equal(projection.look.neutralFraction, 1);
const solid = R100_WORLD_APPEARANCES.find(row => row.worldId === 'cinder-ridge')!.solid;
assert.deepEqual(projection.look.neutralPalette!.mid, [solid.mid >>> 16 & 255, solid.mid >>> 8 & 255, solid.mid & 255]);
projection.update(100, normalizeAssimilationSources(100), 0, true, true);
assert.equal(projection.typedFraction, 0);
assert.equal(projection.look.neutralFraction, 1);
assert.deepEqual(projection.look.neutralPalette, ASSIMILATION_NEUTRAL_PALETTE);
look.set(projection.look);
assert.equal(look.amount, 1, 'unattributed exposure still changes the body material');
projection.update(80, { version: 1, worlds: { 'crystal-fibre': 20, 'ruptured-film': 20, 'cinder-ridge': 20 }, unattributed: 20 }, 0, true, false);
near(projection.typedFraction, .5);
near(projection.look.fibre, .5);
near(projection.look.neutralFraction!, .5);
assert.deepEqual(projection.look.palettes?.[0].dark, fp.dark, 'neutral does not dilute the fibre region');
assert.deepEqual(projection.look.palettes?.[1].dark, mp.dark, 'neutral does not dilute the membrane region');
projection.update(0, normalizeAssimilationSources(0), 0, false, false);
assert.equal(projection.typedFraction, 0);
assert.equal(projection.look.neutralFraction, 0);

// Exact reference for the human-approved two-family CPU material before production projection.
const clamp = (n: number): number => Math.max(0, Math.min(1, n));
const smooth = (n: number): number => { const v = clamp(n); return v * v * (3 - 2 * v); };
function oldSample(mask: Uint8Array, p: AssimilationLookParameters, output: Float32Array): void {
  const rank = mask[0]!, coverage = rank === 0 ? 0 : p.amount * smooth((p.amount - rank / 255 + .12) / .24);
  output[4] = coverage;
  if (coverage === 0) { output.set([65, 58, 44, 0, 0]); return; }
  const moving = mask[6]!, fibre = smooth((p.fibre - mask[5]! / 255 + .055) / .11);
  const f0 = mask[1]! / 255, f1 = mask[2]! / 255, m0 = mask[3]! / 255, m1 = mask[4]! / 255;
  const fphase = moving * p.fibrePhase, mphase = moving * p.membranePhase;
  const ft = f0 + (f1 - f0) * fphase, mt = m0 + (m1 - m0) * mphase;
  const fc0 = f0 < .3 ? fp.dark : f0 > .8 ? fp.light : fp.mid;
  const fc1 = f1 < .3 ? fp.dark : f1 > .8 ? fp.light : fp.mid;
  const mc0 = m0 < .3 ? mp.dark : m0 > .8 ? mp.light : mp.mid;
  const mc1 = m1 < .3 ? mp.dark : m1 > .8 ? mp.light : mp.mid;
  for (let channel = 0; channel < 3; channel++) {
    const fc = fc0[channel]! + (fc1[channel]! - fc0[channel]!) * fphase;
    const ml0 = m0 > .8 ? (mc0[channel]! + mp.mid[channel]!) * .5 : mc0[channel]!;
    const ml1 = m1 > .8 ? (mc1[channel]! + mp.mid[channel]!) * .5 : mc1[channel]!;
    const mc = ml0 + (ml1 - ml0) * mphase, original = [65, 58, 44][channel]!;
    output[channel] = original + (mc + (fc - mc) * fibre - original) * coverage;
  }
  output[3] = ((mt - .57) * .27 * (1 - fibre) + (ft - .57) * .34 * fibre) * coverage;
}
const actual = new Float32Array(5), expected = new Float32Array(5), mask = new Uint8Array(ASSIMILATION_SURFACE_STRIDE);
let samples = 0;
for (const amount of [0, .01, .23, .47, .69, 1]) for (const fibre of [0, .5, 1]) {
  look.set({ amount, fibre, membrane: 1 - fibre, seconds: 2.34, motion: true, subjective: false });
  for (let y = .1; y < 1.6; y += .13) for (let x = -.3; x < .31; x += .06) for (const z of [-.25, 0, .18]) {
    writeAssimilationSurface(x, y, z, 65, 0, mask, 0);
    sampleAssimilationSurface(mask, 0, look, 65, 58, 44, actual);
    oldSample(mask, look, expected);
    assert.deepEqual(actual, expected, 'default two-family material remains byte-equivalent at Float32 output');
    samples++;
  }
}
const flat = (color: readonly [number, number, number]) => ({ dark: color, mid: color, light: color });
look.set({ amount: 1, fibre: .5, membrane: .5, seconds: 0, motion: false, subjective: false,
  neutralFraction: .33, palettes: [flat([255, 0, 0]), flat([0, 0, 255])], neutralPalette: flat([0, 255, 0]) });
const regions = [0, 0, 0];
for (let y = .15; y < 1.6; y += .035) for (let x = -.35; x < .35; x += .035) for (const z of [-.2, .1, .2]) {
  writeAssimilationSurface(x, y, z, 65, 0, mask, 0);
  sampleAssimilationSurface(mask, 0, look, 65, 58, 44, actual);
  for (let channel = 0; channel < 3; channel++) if (actual[channel]! > 250) regions[channel]!++;
}
assert(regions.every(count => count > 10), `all three independent material regions survive: ${regions}`);
console.log(`PASS assimilation state presentation: persistent source weights, neutral legacy/unthemed world, zero, healing, stable objects, ${samples} exact approved-material samples, three distinct regions`);
