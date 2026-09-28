import {
  lastLightWalkLeg, lastLightFootPoint, lastLightWalkUpperPoint, lastLightWalkArm,
  LAST_LIGHT_STANCE_FRACTION, LAST_LIGHT_THIGH_LENGTH, LAST_LIGHT_SHIN_LENGTH,
  type GaitPoint, type LastLightLegPose,
} from '../../src/art/last-light-gait';

// These are motion relationships, not a checksum of an authored curve. The
// preceding gait preserved every bone and contact while the torso stayed rigid
// and the unloaded leg straightened before folding. Those failures need their
// own gates; a passing report still does not replace viewing the 12 real frames.
const SAMPLES = 2400, DUTY = LAST_LIGHT_STANCE_FRACTION;
const LENGTH = LAST_LIGHT_THIGH_LENGTH + LAST_LIGHT_SHIN_LENGTH;
const failures: string[] = [];
const check = (condition: boolean, message: string): void => { if (!condition) failures.push(message); };
const delta = (a: GaitPoint, b: GaitPoint): GaitPoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const distance = (a: GaitPoint, b: GaitPoint): number => Math.hypot(...delta(a, b));
const middle = (a: GaitPoint, b: GaitPoint): GaitPoint => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const dot = (a: GaitPoint, b: GaitPoint): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length;
const range = (values: readonly number[]): number => Math.max(...values) - Math.min(...values);
const degrees = (radians: number): number => radians * 180 / Math.PI;
const rounded = (value: number): number => Number(value.toFixed(5));
const correlation = (a: readonly number[], b: readonly number[]): number => {
  const am = mean(a), bm = mean(b);
  let product = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]! - am, y = b[i]! - bm;
    product += x * y; aa += x * x; bb += y * y;
  }
  return aa > 1e-14 && bb > 1e-14 ? product / Math.sqrt(aa * bb) : 0;
};
const flexion = (leg: LastLightLegPose): number => {
  const thigh = delta(leg.hip, leg.knee), shin = delta(leg.ankle, leg.knee);
  return 180 - degrees(Math.acos(Math.max(-1, Math.min(1,
    dot(thigh, shin) / (Math.hypot(...thigh) * Math.hypot(...shin))))));
};
const lineYaw = (left: GaitPoint, right: GaitPoint): number => Math.atan2(right[2] - left[2], right[0] - left[0]);
const lineRoll = (left: GaitPoint, right: GaitPoint): number => Math.atan2(right[1] - left[1], right[0] - left[0]);
const probes: readonly GaitPoint[] = [[-.279, 1.142, .012], [.276, 1.145, .008], [0, 1.60, 0], [0, .73, 0]];
const parts = ['chest', 'head', 'pack'] as const;
const snapshot = (cycle: number, settle = 0): GaitPoint[] => {
  const points: GaitPoint[] = [];
  for (const right of [false, true]) {
    const leg = lastLightWalkLeg(cycle, right, settle), arm = lastLightWalkArm(right, cycle, settle);
    points.push(leg.hip, leg.knee, leg.ankle, arm.shoulder, arm.elbow, arm.wrist);
    for (const z of [-.096, .190]) points.push(lastLightFootPoint(leg, [right ? .143 : -.148, .0025, z]));
  }
  for (const part of parts) for (const point of probes) points.push(lastLightWalkUpperPoint(point, cycle, settle, part));
  return points;
};

const pelvisYaw: number[] = [], chestYaw: number[] = [], pelvisRoll: number[] = [], chestPitch: number[] = [];
const armExcursion: number[][] = [[], []], legExcursion: number[][] = [[], []];
const armLengths: number[][] = [[], [], [], []], supportShift: number[][] = [[], []];
let maximumLegLengthError = 0, maximumMotionStep = 0, maximumEndpointDifference = 0;
let worstLeg: {cycle: number; side: number; grounded: boolean; reach: number; boneLengthError: number} | undefined;
let previous = snapshot(-1 / SAMPLES);
const restCenter = middle(lastLightWalkLeg(0, false, 1).hip, lastLightWalkLeg(0, true, 1).hip);
const rest = snapshot(0, 1);
for (let i = 0; i <= SAMPLES; i++) {
  const cycle = i / SAMPLES;
  const legs = [lastLightWalkLeg(cycle, false), lastLightWalkLeg(cycle, true)];
  const arms = [lastLightWalkArm(false, cycle), lastLightWalkArm(true, cycle)];
  const hipCenter = middle(legs[0]!.hip, legs[1]!.hip);
  pelvisYaw.push(lineYaw(legs[0]!.hip, legs[1]!.hip));
  pelvisRoll.push(lineRoll(legs[0]!.hip, legs[1]!.hip));
  const shoulders = probes.slice(0, 2).map(point => lastLightWalkUpperPoint(point, cycle, 0, 'chest'));
  chestYaw.push(lineYaw(shoulders[0]!, shoulders[1]!));
  const chestBottom = lastLightWalkUpperPoint([0, .90, 0], cycle, 0, 'chest');
  const chestTop = lastLightWalkUpperPoint([0, 1.20, 0], cycle, 0, 'chest');
  chestPitch.push(Math.atan2(chestTop[2] - chestBottom[2], chestTop[1] - chestBottom[1]));
  for (const side of [0, 1]) {
    const leg = legs[side]!, arm = arms[side]!;
    const boneLengthError = Math.max(
      Math.abs(distance(leg.hip, leg.knee) - LAST_LIGHT_THIGH_LENGTH),
      Math.abs(distance(leg.knee, leg.ankle) - LAST_LIGHT_SHIN_LENGTH));
    if (boneLengthError > maximumLegLengthError) {
      maximumLegLengthError = boneLengthError;
      worstLeg = {cycle, side, grounded: leg.grounded, reach: distance(leg.hip, leg.ankle), boneLengthError};
    }
    armLengths[side * 2]!.push(distance(arm.shoulder, arm.elbow));
    armLengths[side * 2 + 1]!.push(distance(arm.elbow, arm.wrist));
    armExcursion[side]!.push(arm.wrist[2] - arm.shoulder[2]);
    legExcursion[side]!.push(leg.ankle[2] - leg.hip[2]);
    if (leg.grounded && !legs[1 - side]!.grounded) {
      const direction = Math.sign(leg.ankle[0] - restCenter[0]);
      supportShift[side]!.push((hipCenter[0] - restCenter[0]) * direction);
    }
  }
  const current = snapshot(cycle);
  check(current.every(point => point.every(Number.isFinite)), `Non-finite joint at cycle ${cycle}`);
  for (let point = 0; point < current.length; point++) {
    maximumMotionStep = Math.max(maximumMotionStep, distance(current[point]!, previous[point]!));
  }
  previous = current;
  // Settling must erase the cycle from all body parts, including separate head,
  // pack and arms. Actor drawing switches to its authored idle at this endpoint.
  if (i % 200 === 0) {
    const settled = snapshot(cycle, 1);
    for (let point = 0; point < rest.length; point++) {
      maximumEndpointDifference = Math.max(maximumEndpointDifference, distance(settled[point]!, rest[point]!));
    }
    for (const part of parts) for (const point of probes) {
      check(distance(lastLightWalkUpperPoint(point, cycle, 1, part), point) < 1e-8,
        `The ${part} transform must return to the authored idle at full settle`);
    }
  }
}

// A bounded per-sample displacement can hide a small discontinuity. Approach
// each landing/toe-off from both sides with an epsilon much smaller than the
// normal sample interval, including the second leg's half-cycle offset.
let maximumContactSeamDifference = 0;
for (const cycle of [0, .5, DUTY, DUTY - .5]) {
  const before = snapshot(cycle - 1e-7), after = snapshot(cycle + 1e-7);
  for (let point = 0; point < before.length; point++) {
    maximumContactSeamDifference = Math.max(maximumContactSeamDifference, distance(before[point]!, after[point]!));
  }
}
check(maximumLegLengthError < 1e-7, 'Whole-body sway must not stretch either walking leg');
check(maximumMotionStep < .01, 'A body joint jumps across the continuous gait or cycle seam');
check(maximumContactSeamDifference < .0001, 'A landing or toe-off changes body/limb position discontinuously');
check(maximumEndpointDifference < 1e-8, 'Different walking phases settle to different body poses');
check(degrees(range(pelvisYaw)) > .5 && degrees(range(chestYaw)) > .5,
  'Pelvis and chest need observable cyclic rotation, rather than one rigid fixed lean');
check(correlation(pelvisYaw, chestYaw) < -.35, 'Shoulders and pelvis must counter-rotate through the stride');
check(degrees(range(pelvisRoll)) > .25, 'The pelvis never changes tilt during weight transfer');
check(degrees(range(chestPitch)) > .25, 'Chest pitch is constant throughout the complete stride');
for (const side of [0, 1]) {
  const shifts = supportShift[side]!;
  check(shifts.length > 0 && mean(shifts) > .005 && shifts.filter(value => value > 0).length / shifts.length > .70,
    `The pelvis must transfer toward the ${side ? 'right' : 'left'} supporting foot`);
  check(range(armExcursion[side]!) > .06, 'An arm has no readable forward/back swing');
  check(correlation(armExcursion[side]!, legExcursion[side]!) < -.35,
    'An arm must oppose its same-side leg rather than marching forward with it');
}
for (const lengths of armLengths) check(range(lengths) < 1e-6, 'Arm animation changes a humerus or forearm length');

// Recovery order: rear toe unloads -> knee folds -> lower leg extends to land.
// Sample each side in its own swing coordinates so gait phase offsets cannot
// accidentally turn a world-space direction test into a motion-quality test.
const swingSummary = [false, true].map(right => {
  const at = (progress: number): LastLightLegPose => lastLightWalkLeg(DUTY + progress * (1 - DUTY) - (right ? .5 : 0), right);
  const departureFlexion = flexion(at(0));
  const firstQuarter = Array.from({length: 26}, (_, i) => flexion(at(i / 100)));
  const recovery = Array.from({length: 100}, (_, i) => ({progress: i / 100, flexion: flexion(at(i / 100))}));
  const peak = recovery.reduce((best, row) => row.flexion > best.flexion ? row : best);
  const reserves = Array.from({length: 46}, (_, i) => {
    const leg = at(.15 + i / 100);
    return LENGTH - distance(leg.hip, leg.ankle);
  });
  check(Math.min(...firstQuarter) >= departureFlexion - 4,
    'The unloaded rear leg straightens before folding: the previous straight-leg sweep has returned');
  check(flexion(at(.30)) > departureFlexion + 12, 'Knee recovery is delayed until the middle of the forward swing');
  check(peak.progress <= .65 && peak.flexion > departureFlexion + 20,
    'The knee must fold early enough to leave a distinct extension phase before landing');
  // An airborne leg close to full reach could still impose the old pelvis
  // ceiling. Measurable slack in early/mid swing rules out that failure there;
  // the supporting-only dependency itself is a separate code-review check.
  check(Math.min(...reserves) > .012, 'The early/middle airborne leg is taut enough to dictate pelvis height');
  check(flexion(at(.94)) < peak.flexion - 15, 'The recovered leg never releases its shin to prepare landing');
  return {
    side: right ? 'right' : 'left', departureFlexionDegrees: rounded(departureFlexion),
    minimumEarlyFlexionDegrees: rounded(Math.min(...firstQuarter)),
    firstThirdFlexionDegrees: rounded(flexion(at(.30))), peakFlexionDegrees: rounded(peak.flexion),
    peakAtSwingFraction: peak.progress, minimumAirborneReachReserve: rounded(Math.min(...reserves)),
  };
});

console.log(JSON.stringify({
  status: failures.length ? 'FAIL' : 'PASS', sampledPhases: SAMPLES,
  pelvisYawRangeDegrees: rounded(degrees(range(pelvisYaw))),
  chestYawRangeDegrees: rounded(degrees(range(chestYaw))),
  shoulderPelvisCorrelation: rounded(correlation(pelvisYaw, chestYaw)),
  pelvisRollRangeDegrees: rounded(degrees(range(pelvisRoll))),
  chestPitchRangeDegrees: rounded(degrees(range(chestPitch))),
  averageSupportSideTransfer: supportShift.map(values => rounded(mean(values))),
  armLegCorrelation: armExcursion.map((values, side) => rounded(correlation(values, legExcursion[side]!))),
  armLengthRanges: armLengths.map(values => values.length ? rounded(range(values)) : 0),
  maximumLegLengthError, worstLeg, maximumMotionStep, maximumContactSeamDifference, maximumEndpointDifference, swing: swingSummary,
  checks: ['early knee recovery before shin release', 'airborne recovery reach reserve', 'shoulder/pelvis counter-rotation',
    'support-side weight transfer', 'varying torso pitch and pelvis roll', 'fixed arm/leg lengths',
    'contralateral arm swing', 'continuous cycle and common idle endpoint'],
  failures,
}, null, 2));
if (failures.length) throw new Error(failures.join('\n'));
