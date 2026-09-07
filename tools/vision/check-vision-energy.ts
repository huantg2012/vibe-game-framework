/**
 * I9-FINAL: texture energy parity + isolux-band structure and pinned brightness
 * (DEC-105 / DEC-107).
 *
 *   npm run check:vision-energy
 *
 * Noise luma-energy must land in 0.90–1.10× of the legacy 59.3 baseline.
 * Lamp / flashlight disc-mean alpha must land in 0.85–1.05× of the legacy
 * 0.360 / 0.333 baselines. Isolated single-pixel grains are forbidden.
 * Isolux bands: 32-level structure + telescope identity + range silhouette;
 * full-range sector area-weighted mean pinned to the wrap-up measurement.
 */
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
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
  SUBDIV2_BAND_COUNT,
  SUBDIV2_BAND_FLOOR_PX,
  SUBDIV2_LEVELS,
  computeFieldBandRadii,
  computeLevelEraseAlphas,
  fieldVisibilityAt,
  type VisionFieldParams,
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

// ---------------------------------------------------------------------------
// Isolux-band structure + pinned brightness (I9-FINAL / DEC-107).
// Noise / lamp / beam gates above are unchanged. Bands comparison is gone:
// the wrap-up pins the 32-layer curve the person signed off, not a loose
// absolute floor.
// ---------------------------------------------------------------------------

const V = GAME_CONSTANTS.VISIBILITY;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const FORWARD_COUNT = V.RAY_SPLIT_FORWARD;
const AMBIENT_COUNT = V.RAY_SPLIT_AMBIENT;
const RADIUS_FORWARD = V.RADIUS_FORWARD;
const RADIUS_AMBIENT = V.RADIUS_AMBIENT;
const CONE_HALF = V.CONE_HALF_ANGLE;
const CONE_FALLOFF = V.CONE_FALLOFF_ANGLE;
const SUBDIV2_BAND_RATIO_MIN = 0.85;
const SUBDIV2_BAND_RATIO_MAX = 1.15;
/** I9-FINAL wrap-up measurement of the 32-layer full-range sector mean. */
const SUBDIV2_FULL_RANGE_BASELINE = 0.674;
const TELESCOPE_EPS = 1e-6;
const RADIUS_EPS = 1e-4;

function shortestArc(radians: number): number {
  let a = radians % TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

function effectiveRange(theta: number): number {
  const abs = Math.abs(shortestArc(theta));
  const half = CONE_HALF * DEG;
  const falloff = CONE_FALLOFF * DEG;
  if (abs <= half) return RADIUS_FORWARD;
  if (abs >= half + falloff || falloff <= 0) return RADIUS_AMBIENT;
  const t = (abs - half) / falloff;
  return RADIUS_FORWARD + (RADIUS_AMBIENT - RADIUS_FORWARD) * smoothstep01(t);
}

/** Zone visibilities occupy [r_{k-1}, r_k] with r_{-1} = 0; past the last radius is 0. */
function areaWeightedVis(radii: readonly number[], vis: readonly number[], range: number): number {
  const denom = range * range;
  if (denom <= 0) return 0;
  let sum = 0;
  let prev = 0;
  for (let k = 0; k < radii.length; k++) {
    const r = radii[k]!;
    if (r > prev) sum += vis[k]! * (r * r - prev * prev);
    prev = r;
  }
  return sum / denom;
}

function assertLevels(): void {
  if (SUBDIV2_LEVELS.length !== SUBDIV2_BAND_COUNT) {
    fail(`SUBDIV2_LEVELS.length ${SUBDIV2_LEVELS.length} !== SUBDIV2_BAND_COUNT ${SUBDIV2_BAND_COUNT}`);
  }
  if (SUBDIV2_BAND_COUNT !== 32) {
    fail(`SUBDIV2_BAND_COUNT ${SUBDIV2_BAND_COUNT} !== 32`);
  }
  if (SUBDIV2_LEVELS[0] !== 1) {
    fail(`levels[0] ${SUBDIV2_LEVELS[0]} !== 1`);
  }
  const last = SUBDIV2_LEVELS[31]!;
  if (last > 0.03) {
    fail(`levels[31] ${last} > 0.03`);
  }
  for (let k = 1; k < SUBDIV2_LEVELS.length; k++) {
    if (!(SUBDIV2_LEVELS[k]! < SUBDIV2_LEVELS[k - 1]!)) {
      fail(`levels not strictly descending at k=${k}: ${SUBDIV2_LEVELS[k - 1]} → ${SUBDIV2_LEVELS[k]}`);
    }
  }
}

function assertTelescope(): void {
  const alphas = computeLevelEraseAlphas(SUBDIV2_LEVELS);
  if (Math.abs(alphas[0]! - 1) > TELESCOPE_EPS) {
    fail(`telescope alphas[0] ${alphas[0]} !== 1`);
  }
  for (let k = 0; k < SUBDIV2_LEVELS.length; k++) {
    let product = 1;
    for (let j = k; j < alphas.length; j++) {
      product *= 1 - alphas[j]!;
    }
    const expected = 1 - SUBDIV2_LEVELS[k]!;
    if (Math.abs(product - expected) > TELESCOPE_EPS) {
      fail(
        `telescope at k=${k}: Π(1-alphas[j≥k])=${product} !== 1-levels[k]=${expected}`
      );
    }
  }
}

function assertRadii(out: Float32Array[], ranges: Float32Array, label: string): void {
  const last = SUBDIV2_BAND_COUNT - 1;
  for (let i = 0; i < ranges.length; i++) {
    const range = ranges[i]!;
    let prev = -Infinity;
    for (let k = 0; k < SUBDIV2_BAND_COUNT; k++) {
      const rho = out[k]![i]!;
      if (rho + RADIUS_EPS < prev) {
        fail(`${label} ray ${i} band ${k} radius ${rho} < previous ${prev}`);
      }
      if (rho > range + RADIUS_EPS) {
        fail(`${label} ray ${i} band ${k} radius ${rho} > range ${range}`);
      }
      prev = rho;
    }
    const outer = out[last]![i]!;
    if (Math.abs(outer - range) > RADIUS_EPS) {
      fail(`${label} ray ${i} last-band radius ${outer} !== range ${range}`);
    }
  }
}

function computeRadii(
  offsets: Float32Array,
  ranges: Float32Array,
  params: {
    radiusForward: number;
    radiusAmbient: number;
    coneHalfAngleDeg: number;
    coneFalloffAngleDeg: number;
  }
): Float32Array[] {
  const out: Float32Array[] = [];
  for (let b = 0; b < SUBDIV2_LEVELS.length; b++) out.push(new Float32Array(offsets.length));
  computeFieldBandRadii(SUBDIV2_LEVELS, offsets, ranges, params, SUBDIV2_BAND_FLOOR_PX, out);
  return out;
}

assertLevels();
assertTelescope();

const halfSpan = (CONE_HALF + CONE_FALLOFF) * DEG;
const offsets = new Float32Array(FORWARD_COUNT + AMBIENT_COUNT);
const ranges = new Float32Array(offsets.length);
for (let i = 0; i < FORWARD_COUNT; i++) {
  offsets[i] = -halfSpan + (2 * halfSpan * i) / (FORWARD_COUNT - 1);
}
const ambientSpan = TAU - 2 * halfSpan;
const ambientStep = ambientSpan / (AMBIENT_COUNT + 1);
for (let i = 0; i < AMBIENT_COUNT; i++) {
  offsets[FORWARD_COUNT + i] = halfSpan + ambientStep * (i + 1);
}
for (let i = 0; i < offsets.length; i++) ranges[i] = effectiveRange(offsets[i]!);

const subdiv2Out = computeRadii(offsets, ranges, {
  radiusForward: RADIUS_FORWARD,
  radiusAmbient: RADIUS_AMBIENT,
  coneHalfAngleDeg: CONE_HALF,
  coneFalloffAngleDeg: CONE_FALLOFF,
});
assertRadii(subdiv2Out, ranges, 'cone');

const purifyRadius = V.PURIFY_RADIUS;
const omniParams: VisionFieldParams = {
  radiusForward: purifyRadius,
  radiusAmbient: purifyRadius,
  coneHalfAngleDeg: 180,
  coneFalloffAngleDeg: 0,
};

// I12-A: an omni field must have no seam, including the Float32 ±π values
// produced by the runtime ray buffer. Check the light field itself as well
// as every isolux band; monotonic/range checks alone accepted the 4px notch.
const seamAngles = [
  -Math.PI, Math.PI, Math.fround(-Math.PI), Math.fround(Math.PI),
  Math.fround(-Math.PI + 1e-6), Math.fround(-Math.PI - 1e-6),
  Math.fround(Math.PI - 1e-6), Math.fround(Math.PI + 1e-6),
];
const facingAngles = Array.from({ length: 8 }, (_, i) => (TAU * i) / 8);
for (const distance of [SUBDIV2_BAND_FLOOR_PX, purifyRadius * 0.5, purifyRadius * 0.8, purifyRadius]) {
  const expected = fieldVisibilityAt(0, distance, omniParams);
  for (const angle of [...seamAngles, ...facingAngles]) {
    for (const facing of facingAngles) {
      const actual = fieldVisibilityAt(Math.fround(angle - facing), distance, omniParams);
      if (Math.abs(actual - expected) > TELESCOPE_EPS) {
        fail(`omni angular seam at angle=${angle}, facing=${facing}, distance=${distance}: ${actual} !== ${expected}`);
      }
    }
  }
}

const degradedOmniCount = V.RAY_SPLIT_FORWARD_DEGRADED + V.RAY_SPLIT_AMBIENT_DEGRADED;
for (const count of [V.PURIFY_RAY_COUNT, degradedOmniCount]) {
  const sampleOffsets = new Float32Array(count);
  const sampleRanges = new Float32Array(count).fill(purifyRadius);
  for (let i = 0; i < count; i++) sampleOffsets[i] = -Math.PI + (TAU * i) / count;
  const sampleOut = computeRadii(sampleOffsets, sampleRanges, omniParams);
  const reference = computeRadii(new Float32Array([0]), new Float32Array([purifyRadius]), omniParams);
  assertRadii(sampleOut, sampleRanges, `omni ${count} rays`);
  for (let band = 0; band < SUBDIV2_BAND_COUNT; band++) {
    for (let ray = 0; ray < count; ray++) {
      if (Math.abs(sampleOut[band]![ray]! - reference[band]![0]!) > RADIUS_EPS) {
        fail(`omni ${count} rays: band ${band}, ray ${ray} differs from forward radius`);
      }
    }
  }
  if (sampleOut[0]![0]! <= purifyRadius * 0.5) {
    fail(`omni ${count} rays: full-bright core collapsed to ${sampleOut[0]![0]}px`);
  }
}

// The omni repair must not turn the rift's forward cone into a full circle.
const coneParams: VisionFieldParams = {
  radiusForward: RADIUS_FORWARD,
  radiusAmbient: RADIUS_AMBIENT,
  coneHalfAngleDeg: CONE_HALF,
  coneFalloffAngleDeg: CONE_FALLOFF,
};
const coneDistance = RADIUS_AMBIENT * 0.5;
const coneForward = fieldVisibilityAt(0, coneDistance, coneParams);
const coneRear = fieldVisibilityAt(Math.fround(Math.PI), coneDistance, coneParams);
const coneShoulder = fieldVisibilityAt((CONE_HALF + CONE_FALLOFF * 0.5) * DEG, coneDistance, coneParams);
if (!(coneForward > coneShoulder && coneShoulder > coneRear)) {
  fail(`cone lost angular falloff: front=${coneForward}, shoulder=${coneShoulder}, rear=${coneRear}`);
}
console.log(`I12-A omni seam PASS: Float32 ±π, 8 facings, ${V.PURIFY_RAY_COUNT}/${degradedOmniCount} rays; cone directional falloff retained`);

const omniOffsets = new Float32Array(V.PURIFY_RAY_COUNT);
const omniRanges = new Float32Array(V.PURIFY_RAY_COUNT);
for (let i = 0; i < V.PURIFY_RAY_COUNT; i++) {
  omniOffsets[i] = -Math.PI + (TAU * i) / V.PURIFY_RAY_COUNT;
  omniRanges[i] = purifyRadius;
}
const omniOut = computeRadii(omniOffsets, omniRanges, omniParams);
assertRadii(omniOut, omniRanges, 'omni');

type SectorMeans = { subdiv2: number; n: number };

function accumulateSector(start: number, end: number, filter?: (theta: number) => boolean): SectorMeans {
  let subdiv2Sum = 0;
  let n = 0;
  for (let i = start; i < end; i++) {
    const theta = offsets[i]!;
    if (filter && !filter(theta)) continue;
    const range = ranges[i]!;
    const s2Radii = subdiv2Out.map((row) => row[i]!);
    subdiv2Sum += areaWeightedVis(s2Radii, SUBDIV2_LEVELS, range);
    n++;
  }
  return { subdiv2: subdiv2Sum / n, n };
}

const coneHalfRad = CONE_HALF * DEG;
const fullRange = accumulateSector(0, FORWARD_COUNT, (theta) => Math.abs(shortestArc(theta)) <= coneHalfRad);
const coneWithShoulder = accumulateSector(0, FORWARD_COUNT);
const ring = accumulateSector(FORWARD_COUNT, offsets.length);

if (fullRange.subdiv2 < 0.6 || fullRange.subdiv2 > 0.74) {
  fail(
    `full-range sector ${fullRange.subdiv2.toFixed(3)} outside construction window [0.60, 0.74]; stop and return to director`
  );
}

console.log('I9-FINAL isolux-band energy');
console.log(
  `  full-range sector (gated)  subdiv2=${fullRange.subdiv2.toFixed(3)}  baseline=${SUBDIV2_FULL_RANGE_BASELINE.toFixed(3)}  ratio=${(fullRange.subdiv2 / SUBDIV2_FULL_RANGE_BASELINE).toFixed(3)}×  n=${fullRange.n}`
);
console.log(`  cone+shoulder (report)  subdiv2=${coneWithShoulder.subdiv2.toFixed(3)}  n=${coneWithShoulder.n}`);
console.log(`  ring (report)  subdiv2=${ring.subdiv2.toFixed(3)}  n=${ring.n}`);
console.log(`  omni radii asserted  rays=${omniRanges.length}  range=${purifyRadius}`);

if (
  !ratioOk(fullRange.subdiv2, SUBDIV2_FULL_RANGE_BASELINE, SUBDIV2_BAND_RATIO_MIN, SUBDIV2_BAND_RATIO_MAX)
) {
  fail(
    `subdiv2 full-range sector ${fullRange.subdiv2.toFixed(3)}/${SUBDIV2_FULL_RANGE_BASELINE.toFixed(3)} = ${(fullRange.subdiv2 / SUBDIV2_FULL_RANGE_BASELINE).toFixed(3)}× (need ${SUBDIV2_BAND_RATIO_MIN}–${SUBDIV2_BAND_RATIO_MAX}×)`
  );
}

console.log('PASS vision energy parity');
