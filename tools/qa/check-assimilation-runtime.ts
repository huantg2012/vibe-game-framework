import assert from 'node:assert/strict';
import { ChaosSystem, validateChaosRuntimeState, type ChaosModulators } from '../../src/systems/chaos-system';
import { validRiftDeparture } from '../../src/types/rift-checkpoint';

const near = (actual: number, expected: number, epsilon = 1e-8): void =>
  assert(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
function fixture(options: { start?: number; assimilation?: number; resistance?: number; growth?: number;
  core?: number; grade?: 'low' | 'medium' | 'severe' } = {}) {
  let assimilation = options.assimilation ?? 0;
  const projections: ChaosModulators[] = [];
  const chaos = new ChaosSystem({ assimilationMode: 'persistent-v1', startingValue: options.start,
    pollutionGrade: options.grade, chaosRateModifier: options.core ?? 1,
    growthResistance: options.growth ?? 0,
    getPollutionResistance: () => options.resistance ?? 0,
    getAssimilation: () => assimilation, setAssimilation: value => { assimilation = value; },
    onModulate: projection => projections.push(projection) });
  return { chaos, value: () => assimilation, projections };
}
function step(chaos: ChaosSystem, durationMs: number, frameMs = 100): void {
  for (let elapsed = 0; elapsed < durationMs; elapsed += frameMs) chaos.update(Math.min(frameMs, durationMs - elapsed));
}

const crossing = fixture({ start: 99.975 });
crossing.chaos.update(100);
near(crossing.chaos.getValue(), 100);
near(crossing.value(), .0005); // 50 ms at 0.6 points/minute.
crossing.chaos.addChaos('paint_step', 1000);
crossing.chaos.addChaos('combat', 1000);
near(crossing.value(), .0005, 1e-10);
const projected = crossing.projections.length;
crossing.chaos.update(100);
assert(crossing.projections.length > projected, 'Saturation continues to publish adaptation');
near(crossing.value(), .0015);
crossing.chaos.setPaused(true); crossing.chaos.update(60000); near(crossing.value(), .0015);
crossing.chaos.setPaused(false); crossing.chaos.update(60000); near(crossing.value(), .0025);
crossing.chaos.addChaos('cleanse', -20); crossing.chaos.update(100); near(crossing.value(), .0025);
crossing.chaos.destroy();

for (const [grade, expected] of [['low', .6], ['medium', .8], ['severe', 1]] as const) {
  const run = fixture({ start: 100, grade }); step(run.chaos, 60000); near(run.value(), expected); run.chaos.destroy();
}
const protectedRun = fixture({ start: 100, resistance: 50, growth: .2, core: .3 });
step(protectedRun.chaos, 60000); near(protectedRun.value(), .24); // Core does not attenuate assimilation a second time.
const protectedState = protectedRun.chaos.exportRuntimeState();
assert(validateChaosRuntimeState(protectedState));
const restored = fixture({ start: 0, assimilation: protectedRun.value(), resistance: 50, growth: .2, core: .3 });
restored.chaos.restoreRuntimeState(protectedState);
step(protectedRun.chaos, 500, 100); step(restored.chaos, 500, 10);
near(protectedRun.value(), restored.value());
const mismatched = fixture({ growth: .2, core: .3 });
assert(!mismatched.chaos.validateRuntimeState(protectedState), 'Outer physiology and checkpoint must agree');
protectedRun.chaos.destroy(); restored.chaos.destroy(); mismatched.chaos.destroy();

// Crossing during the graded ramp is independent of the update partition.
const large = fixture({ grade: 'low' }), small = fixture({ grade: 'low' });
step(large.chaos, 90000); step(small.chaos, 90000);
large.chaos.addChaos('qa', 99.99 - large.chaos.getValue());
small.chaos.addChaos('qa', 99.99 - small.chaos.getValue());
step(large.chaos, 100, 100); step(small.chaos, 100, 10);
near(large.value(), small.value()); large.chaos.destroy(); small.chaos.destroy();

// Two independent internal deadlines split one frame into three intervals.
// 25ms at .5/s, 50ms at .25/s, then 25ms saturated at .5/s.
for (const frameMs of [100, 10, 1]) {
  const run = fixture({ start: 99.975 });
  run.chaos.setTemporaryRateMult(2, 25);
  run.chaos.setTemporaryRateReduction(.5, 75);
  step(run.chaos, 100, frameMs);
  near(run.value(), .00025);
  const ended = run.chaos.exportRuntimeState();
  assert.equal(ended.tempRateDeadlineMs, 0); assert.equal(ended.reductionDeadlineMs, 0);
  run.chaos.destroy();
}
const endBoundary = fixture();
endBoundary.chaos.setTemporaryRateMult(2, 100); endBoundary.chaos.update(100);
near(endBoundary.chaos.getValue(), .1); near(endBoundary.chaos.getRate(), .5);
endBoundary.chaos.destroy();
const oldBoundary = new ChaosSystem();
oldBoundary.setTemporaryRateMult(2, 100); oldBoundary.update(100);
near(oldBoundary.getValue(), .05); // Legacy endpoint expiry stays frozen.
oldBoundary.destroy();

const legacy = new ChaosSystem({ startingValue: 149.99 }); legacy.update(100);
near(legacy.getValue(), 150); near(legacy.getModulators().speedMult, .5);
const legacyState = legacy.exportRuntimeState(); assert(validateChaosRuntimeState(legacyState));
assert(!('assimilationMode' in legacyState));
const modern = fixture({ start: 150, assimilation: 99.9999 });
near(modern.chaos.getValue(), 100); modern.chaos.update(100); near(modern.value(), 100);
assert(!modern.chaos.validateRuntimeState(legacyState));
assert(!legacy.validateRuntimeState(modern.chaos.exportRuntimeState()));
assert(!validateChaosRuntimeState({ ...modern.chaos.exportRuntimeState(), value: 101, peak: 101 }));
assert(!validateChaosRuntimeState({ ...legacyState, assimilationValue: 20 }));
legacy.destroy(); modern.chaos.destroy();

const departure = { version: 1, runId: 'qa', identity: { worldId: 'procedural-rift', layoutId: 'procedural-rift',
  seed: 1, signature: 'qa' }, conditions: { cycle: 1, modifiers: { chaosRateModifier: 1, kindlingValueModifier: 1, startingChaos: 0 } } };
assert(validRiftDeparture(departure));
assert(validRiftDeparture({ ...departure, conditions: { ...departure.conditions, assimilationMode: 'persistent-v1' } }));
assert(!validRiftDeparture({ ...departure, conditions: { ...departure.conditions, assimilationMode: 'future' } }));
console.log('PASS assimilation runtime: cap, partial frame, grade/rate factors, pause, inflow, projections, snapshot and legacy departure isolation');
