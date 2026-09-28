import assert from 'node:assert/strict';
import {
  lastLightWalkLeg, lastLightFootPoint, lastLightWalkBodyLift,
  LAST_LIGHT_STRIDE_METRES, LAST_LIGHT_STANCE_FRACTION, LAST_LIGHT_WALK_FRAMES,
  LAST_LIGHT_THIGH_LENGTH, LAST_LIGHT_SHIN_LENGTH,
  type GaitPoint, type LastLightLegPose,
} from '../../src/art/last-light-gait';
import {LAST_LIGHT_WORLD_WALK_SPEED} from '../../src/systems/last-light-layout';

// Independent silhouette and contact checks. Bone-length preservation alone
// accepted the previous permanently crouched, forward-knee walk. These gates
// require a readable straightening support leg and a sustained rear stroke.
const SAMPLES = 12000;
const SOLE_Y = .0025, HEEL_Z = -.096, TOE_Z = .190;
const difference = (a: GaitPoint, b: GaitPoint): number[] => a.map((v, i) => v - b[i]!);
const dot = (a: readonly number[], b: readonly number[]): number => a.reduce((sum, v, i) => sum + v * b[i]!, 0);
const degrees = (radians: number): number => radians * 180 / Math.PI;
const fraction = (value: number): number => ((value % 1) + 1) % 1;
const mean = (values: readonly number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;
const rounded = (value: number): number => Number(value.toFixed(5));
const flexion = (leg: LastLightLegPose): number => {
  const thigh = difference(leg.hip, leg.knee), shin = difference(leg.ankle, leg.knee);
  return 180 - degrees(Math.acos(Math.max(-1, Math.min(1, dot(thigh, shin) / (Math.hypot(...thigh) * Math.hypot(...shin))))));
};
const bootPoint = (leg: LastLightLegPose, z: number): GaitPoint => lastLightFootPoint(leg, [0, SOLE_Y, z]);

let maxReach = 0, maxBoneError = 0, lowestSole = Infinity;
let minimumHipY = Infinity, maximumHipY = -Infinity, maxContactDrift = 0;
let contacts = 0, supportingSamples = 0, rearSupportSamples = 0, forwardAnkleSamples = 0, rearAnkleSamples = 0;
const supportFlexions: number[] = [], midSupportFlexions: number[] = [];
for (let i = 0; i < SAMPLES; i++) {
  const cycle = i / SAMPLES;
  const legs = [lastLightWalkLeg(cycle, false), lastLightWalkLeg(cycle, true)];
  assert(legs.some(leg => leg.grounded), 'Walking must retain a supporting foot instead of developing a running flight phase');
  for (const [side, leg] of legs.entries()) {
    const phase = fraction(cycle + side * .5), supporting = phase <= LAST_LIGHT_STANCE_FRACTION;
    assert([...leg.hip, ...leg.knee, ...leg.ankle, leg.footPitch].every(Number.isFinite), 'The entire leg pose must stay finite');
    const reach = Math.hypot(...difference(leg.hip, leg.ankle));
    maxReach = Math.max(maxReach, reach);
    maxBoneError = Math.max(maxBoneError,
      Math.abs(Math.hypot(...difference(leg.hip, leg.knee)) - LAST_LIGHT_THIGH_LENGTH),
      Math.abs(Math.hypot(...difference(leg.knee, leg.ankle)) - LAST_LIGHT_SHIN_LENGTH));
    minimumHipY = Math.min(minimumHipY, leg.hip[1]);
    maximumHipY = Math.max(maximumHipY, leg.hip[1]);

    // Check the sole's heel, centre and toe. Since the rigid pitch is affine,
    // its minimum is attained at an endpoint; the centre also catches a bad
    // pivot convention. These are the actual authored boot dimensions.
    for (const z of [HEEL_Z, (HEEL_Z + TOE_Z) / 2, TOE_Z]) {
      lowestSole = Math.min(lowestSole, bootPoint(leg, z)[1]);
    }
    if (!supporting) continue;
    supportingSamples++;
    const bend = flexion(leg);
    supportFlexions.push(bend);
    // Exclude loading response and toe-off: the middle support leg should
    // extend under the body, even though a late push-off knee can flex more.
    const stanceProgress = phase / LAST_LIGHT_STANCE_FRACTION;
    if (stanceProgress >= .25 && stanceProgress <= .70) midSupportFlexions.push(bend);
    if (leg.knee[2] < leg.hip[2] - .01) rearSupportSamples++;
    if (leg.ankle[2] > leg.hip[2] + .01) forwardAnkleSamples++;
    if (leg.ankle[2] < leg.hip[2] - .01) rearAnkleSamples++;

    // A rolling ankle is supposed to move. Measure the heel/toe ground pivot,
    // not the ankle or boot centre. The root advances by stride per cycle.
    const nextCycle = cycle + 1 / SAMPLES;
    if (phase + 1 / SAMPLES > LAST_LIGHT_STANCE_FRACTION) continue;
    const next = lastLightWalkLeg(nextCycle, side === 1);
    if (next.footPivotZ !== leg.footPivotZ) continue; // flat sole transfers contact heel → toe
    const contact = bootPoint(leg, leg.footPivotZ), nextContact = bootPoint(next, leg.footPivotZ);
    assert(Math.abs(contact[1] - SOLE_Y) < 1e-8, 'A supporting roll pivot must remain on the floor');
    const drift = Math.hypot(nextContact[0] - contact[0], nextContact[1] - contact[1],
      nextContact[2] + nextCycle * LAST_LIGHT_STRIDE_METRES - contact[2] - cycle * LAST_LIGHT_STRIDE_METRES);
    maxContactDrift = Math.max(maxContactDrift, drift);
    contacts++;
  }
}

assert(maxReach < LAST_LIGHT_THIGH_LENGTH + LAST_LIGHT_SHIN_LENGTH, 'Foot roll may not push the ankle beyond the leg reach');
assert(maxBoneError < 1e-7, 'Solving reach by silently stretching a limb is not valid');
assert(lowestSole >= -1e-7, 'The rolled boot sole penetrates the floor');
assert(maxContactDrift < 1e-7, 'A planted heel/toe slides against the advancing root');
assert(mean(supportFlexions) < 35, 'The supporting leg is persistently crouched rather than bearing the body');
assert(mean(midSupportFlexions) < 30 && Math.max(...midSupportFlexions) < 40,
  'Mid-stance must visibly straighten instead of holding the knee in front of the body');
assert(rearSupportSamples / supportingSamples > .20, 'The body never passes its planted leg: the rear-support stroke is missing');
assert(forwardAnkleSamples / supportingSamples > .25 && rearAnkleSamples / supportingSamples > .25,
  'A complete planted step must move from in front of the pelvis to behind it');
assert(maximumHipY - minimumHipY < .10, 'Repairing leg extension introduced an excessive body bounce');

// Heel strike, a settled sole and toe-off must be distinct contact shapes.
const landing = lastLightWalkLeg(0, false);
const middle = lastLightWalkLeg(LAST_LIGHT_STANCE_FRACTION * .45, false);
const departure = lastLightWalkLeg(LAST_LIGHT_STANCE_FRACTION, false);
assert(bootPoint(landing, TOE_Z)[1] - bootPoint(landing, HEEL_Z)[1] > .02, 'Landing needs a raised toe and a load-bearing heel');
assert(Math.abs(bootPoint(middle, TOE_Z)[1] - bootPoint(middle, HEEL_Z)[1]) < .003, 'Middle stance never settles the full sole');
assert(bootPoint(departure, HEEL_Z)[1] - bootPoint(departure, TOE_Z)[1] > .04, 'The rear leg needs a raised heel before toe-off');

// Also sample each authored recovery: the working boot must lift while its
// support partner rolls down, without dragging or cutting through the floor.
let recoveryChecks = 0;
for (let frame = 0; frame < LAST_LIGHT_WALK_FRAMES; frame++) {
  for (let step = 0; step <= 100; step++) {
    const recovery = step / 100;
    for (const right of [false, true]) {
      const leg = lastLightWalkLeg(frame / LAST_LIGHT_WALK_FRAMES, right, recovery);
      assert(Math.min(bootPoint(leg, HEEL_Z)[1], bootPoint(leg, TOE_Z)[1]) >= -1e-7,
        'A recovering boot rolls below the floor');
      if (step < 100) {
        const next = lastLightWalkLeg(frame / LAST_LIGHT_WALK_FRAMES, right, recovery + .01);
        if (leg.footLift < 1e-9 && next.footLift < 1e-9) {
          assert(Math.hypot(...difference(bootPoint(leg, leg.footPivotZ), bootPoint(next, leg.footPivotZ))) < 1e-8,
            'Recovery dragged its supporting boot');
        }
      }
      recoveryChecks++;
    }
  }
}
const cadence = LAST_LIGHT_WORLD_WALK_SPEED / LAST_LIGHT_STRIDE_METRES * 120;
assert(cadence >= 90 && cadence <= 190, 'Travel speed and stride produce a shuffle/run cadence instead of a readable brisk walk');

const frameSummary = Array.from({length: LAST_LIGHT_WALK_FRAMES}, (_, frame) => {
  const cycle = frame / LAST_LIGHT_WALK_FRAMES, leg = lastLightWalkLeg(cycle, false);
  return {
    frame, supporting: cycle <= LAST_LIGHT_STANCE_FRACTION,
    hipY: rounded(leg.hip[1]), kneeAheadHip: rounded(leg.knee[2] - leg.hip[2]),
    ankleAheadHip: rounded(leg.ankle[2] - leg.hip[2]), kneeFlexionDegrees: rounded(flexion(leg)),
    bootPitchDegrees: rounded(degrees(leg.footPitch)), bodyLift: rounded(lastLightWalkBodyLift(cycle)),
  };
});
console.log(JSON.stringify({
  status: 'PASS', cyclesSampled: SAMPLES, legSamples: SAMPLES * 2, plantedContactPairs: contacts, recoveryChecks,
  cadenceStepsPerMinute: rounded(cadence),
  supportMeanFlexionDegrees: rounded(mean(supportFlexions)), midSupportMeanFlexionDegrees: rounded(mean(midSupportFlexions)),
  supportMaximumFlexionDegrees: rounded(Math.max(...supportFlexions)),
  rearSupportFraction: rounded(rearSupportSamples / supportingSamples),
  hipRange: [rounded(minimumHipY), rounded(maximumHipY)], maximumReach: rounded(maxReach),
  maximumBoneLengthError: maxBoneError, minimumSoleHeight: rounded(lowestSole), maximumGroundContactDrift: maxContactDrift,
  checks: ['support-leg extension', 'sustained rear support', 'heel-flat-toe load transfer', 'world-locked rolling contact',
    'no sole penetration', 'fixed bone lengths without overreach', 'bounded body rise', 'non-shuffling cadence', 'recovery contact'],
  // Right leg has the same cycle offset by one half; both legs were sampled above.
  leftLegFrames: frameSummary,
}, null, 2));
