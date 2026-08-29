/**
 * I9-G: texture energy parity for rift vision presentation (DEC-105).
 *
 *   npm run check:vision-energy
 *
 * Noise luma-energy must land in 0.90–1.10× of the legacy 59.3 baseline.
 * Lamp / flashlight disc-mean alpha must land in 0.85–1.05× of the legacy
 * 0.360 / 0.333 baselines. Isolated single-pixel grains are forbidden.
 */
import {
  countIsolatedLitPixels,
  fillLegacyVoidNoise,
  fillVoidNoise,
  FLASHLIGHT_ALPHA_STOPS,
  LAMP_ALPHA_STOPS,
  FLASHLIGHT_DISC_ENERGY_BASELINE,
  LAMP_DISC_ENERGY_BASELINE,
  LEGACY_FLASHLIGHT_ALPHA_STOPS,
  LEGACY_LAMP_ALPHA_STOPS,
  LIGHT_ENERGY_RATIO_MAX,
  LIGHT_ENERGY_RATIO_MIN,
  NOISE_ENERGY_BASELINE,
  NOISE_ENERGY_RATIO_MAX,
  NOISE_ENERGY_RATIO_MIN,
  noiseLumaEnergy,
  radialMeanAlpha,
  VOID_NOISE_COVERAGE,
} from '../../src/systems/vision-textures.ts';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZE = 64;
const LIGHT_SIZE = 256;
const TRIALS = 8;

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  process.exit(1);
}

function ratioOk(value: number, baseline: number, min: number, max: number): boolean {
  const r = value / baseline;
  return r >= min && r <= max;
}

const legacyBuf = new Uint8ClampedArray(SIZE * SIZE * 4);
fillLegacyVoidNoise(legacyBuf, SIZE, mulberry32(1));
const legacyEnergy = noiseLumaEnergy(legacyBuf);

const newEnergies: number[] = [];
let isolated = 0;
for (let t = 0; t < TRIALS; t++) {
  const buf = new Uint8ClampedArray(SIZE * SIZE * 4);
  fillVoidNoise(buf, SIZE, mulberry32(1000 + t));
  newEnergies.push(noiseLumaEnergy(buf));
  isolated += countIsolatedLitPixels(buf, SIZE);
}
const newEnergy =
  newEnergies.reduce((a, b) => a + b, 0) / newEnergies.length;

const lampOld = radialMeanAlpha(LIGHT_SIZE, LEGACY_LAMP_ALPHA_STOPS, true);
const lampNew = radialMeanAlpha(LIGHT_SIZE, LAMP_ALPHA_STOPS, true);
const beamOld = radialMeanAlpha(LIGHT_SIZE, LEGACY_FLASHLIGHT_ALPHA_STOPS, true);
const beamNew = radialMeanAlpha(LIGHT_SIZE, FLASHLIGHT_ALPHA_STOPS, true);

console.log('I9-G vision energy');
console.log(
  `  noise coverage=${VOID_NOISE_COVERAGE}  legacy sample=${legacyEnergy.toFixed(3)}  spec baseline=${NOISE_ENERGY_BASELINE}`
);
console.log(
  `  noise new mean=${newEnergy.toFixed(3)}  ratio vs spec=${(newEnergy / NOISE_ENERGY_BASELINE).toFixed(3)}×  isolated=${isolated}`
);
console.log(
  `  lamp disc  old=${lampOld.toFixed(4)} (spec ${LAMP_DISC_ENERGY_BASELINE})  new=${lampNew.toFixed(4)}  ratio=${(lampNew / lampOld).toFixed(3)}×`
);
console.log(
  `  beam disc  old=${beamOld.toFixed(4)} (spec ${FLASHLIGHT_DISC_ENERGY_BASELINE})  new=${beamNew.toFixed(4)}  ratio=${(beamNew / beamOld).toFixed(3)}×`
);

if (isolated !== 0) fail(`isolated lit pixels: ${isolated} (2×2 cells must be uniform)`);

if (!ratioOk(newEnergy, NOISE_ENERGY_BASELINE, NOISE_ENERGY_RATIO_MIN, NOISE_ENERGY_RATIO_MAX)) {
  fail(
    `noise energy ${newEnergy.toFixed(3)} is ${(newEnergy / NOISE_ENERGY_BASELINE).toFixed(3)}× of ${NOISE_ENERGY_BASELINE} (need ${NOISE_ENERGY_RATIO_MIN}–${NOISE_ENERGY_RATIO_MAX}×); tune VOID_NOISE_COVERAGE`
  );
}

if (!ratioOk(lampNew, lampOld, LIGHT_ENERGY_RATIO_MIN, LIGHT_ENERGY_RATIO_MAX)) {
  fail(
    `lamp disc energy ${lampNew.toFixed(4)} is ${(lampNew / lampOld).toFixed(3)}× of measured old ${lampOld.toFixed(4)} (need ${LIGHT_ENERGY_RATIO_MIN}–${LIGHT_ENERGY_RATIO_MAX}×)`
  );
}

if (!ratioOk(beamNew, beamOld, LIGHT_ENERGY_RATIO_MIN, LIGHT_ENERGY_RATIO_MAX)) {
  fail(
    `flashlight disc energy ${beamNew.toFixed(4)} is ${(beamNew / beamOld).toFixed(3)}× of measured old ${beamOld.toFixed(4)} (need ${LIGHT_ENERGY_RATIO_MIN}–${LIGHT_ENERGY_RATIO_MAX}×)`
  );
}

console.log('PASS vision energy parity');
