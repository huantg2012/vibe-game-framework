/** Validate a prospective expansion plan. Passing this is never game evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_PLAN = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const grades = ['low', 'medium', 'severe'];
const unique = values => new Set(values).size === values.length;
const uint32 = value => Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;

export function validateExpansionPlan(plan, { batch, read = file => fs.readFileSync(file) } = {}) {
  assert.equal(plan.schemaVersion, 1); assert.equal(plan.algorithmRevision, 6);
  assert.equal(plan.baseRevision, 'd194be4cb8f89f37d4ba7f05d17e16f9bed055ee');
  assert(['planning', 'frozen'].includes(plan.status));
  assert.deepEqual(plan.grades, grades);
  assert.equal(plan.baseline.worlds.length, 52); assert(unique(plan.baseline.worlds));
  assert.equal(plan.baseline.qualifiedSeedsPerGrade, 48);
  assert.equal(plan.baseline.fixedPlayProcesses, 312);
  const bound = receipt => { const bytes = read(receipt.path); assert.equal(sha(bytes), receipt.sha256, receipt.path); return bytes; };
  const oldPackages = JSON.parse(bound(plan.baseline.packages)); bound(plan.baseline.source);
  assert.deepEqual(oldPackages.worlds.map(row => row.worldId), plan.baseline.worlds);
  assert.equal(plan.batches.length, 14);
  const all = [...plan.baseline.worlds];
  for (const [index, row] of plan.batches.entries()) {
    assert.equal(row.id, `B${String(index + 1).padStart(2, '0')}`);
    assert.equal(row.iteration, index < 5 ? 'R100-I10' : index < 10 ? 'R100-I11' : 'R100-I12');
    assert.equal(row.capacity, 4); assert(['unassigned', 'specified', 'ready'].includes(row.status));
    assert.equal(row.worlds.length, row.status === 'unassigned' ? 0 : 4);
    assert(row.worlds.every(id => /^[a-z][a-z0-9-]{0,79}$/.test(id)));
    all.push(...row.worlds);
  }
  assert(unique(all), 'World IDs must be unique across old and all new batches');
  if (plan.status === 'frozen') assert.equal(all.length, 108, 'A frozen whole plan has all 56 new IDs');
  if (batch) assert(plan.batches.some(row => row.id === batch && row.status === 'ready'), 'Selected batch is not ready');
  const g = plan.generation;
  assert.deepEqual(g.ordinarySeeds, Array.from({ length: 32 }, (_, index) => Math.floor((index + 1) * 2 ** 32 / 33)));
  assert.deepEqual(g.boundarySeeds, [0, 1, 28, 65535, 65536, 0x7fffffff, 0xffffffff, 3390232493]);
  for (const receipt of [g.holdout, g.expandedHoldout]) {
    assert.equal(receipt.seeds.length, 8);
    assert.deepEqual(JSON.parse(bound(receipt)).seeds, receipt.seeds);
  }
  const seeds = [...g.ordinarySeeds, ...g.boundarySeeds, ...g.holdout.seeds, ...g.expandedHoldout.seeds];
  assert.equal(seeds.length, 56); assert(unique(seeds) && seeds.every(uint32));
  assert.equal(g.newBaseCases, 56 * 3 * 48);
  assert.deepEqual(g.expandedAtI11, { worlds: 92, cases: 92 * 3 * 8 });
  assert.deepEqual(g.expandedAtI12, { worlds: 16, cases: 16 * 3 * 8 });
  assert.equal(g.finalUniqueCases, 108 * 3 * 56);
  assert.deepEqual(plan.actualPlay.seeds, [20261005, 3075192741]);
  assert.equal(plan.actualPlay.newWorldProcesses, 336); assert.equal(plan.actualPlay.finalUniqueProcesses, 648);
  assert.equal(plan.actualPlay.controllerPolicyRevision, 15);
  bound({ path: plan.actualPlay.controller, sha256: plan.actualPlay.controllerSha256 });
  bound({ path: plan.actualPlay.storage, sha256: plan.actualPlay.storageSha256 });
  assert.equal(plan.actualPlay.maximumActualPickups, 3); assert.equal(plan.actualPlay.nonEntryDistanceExclusive, 320);
  assert.deepEqual(plan.continuity.surfaceFields, ['albedo', 'normal', 'response', 'emission']);
  assert.equal(plan.continuity.allRecipeComparisons, 156); assert.equal(plan.continuity.allSurfaceComparisons, 156);
  const final = plan.finalPool;
  assert.equal(final.worlds, 108); assert.equal(final.grades, 324);
  assert.equal(final.productionEntryAndColdCases, 324); assert.equal(final.nodeChromiumCurrent, 324);
  assert.equal(final.originalRevision1Fixtures, 18); assert.equal(final.equivalenceTotal, 342);
  assert.equal(final.runtimeBudget.worlds, 108); assert.equal(final.runtimeBudget.grade, 'severe');
  assert.equal(final.runtimeBudget.seed, 20261004); assert.equal(final.runtimeBudget.minimumAliveMs, 60000);
  assert.equal(final.runtimeBudget.exclusive, true); assert.equal(final.runtimeBudget.noProtectionFixture, true);
  assert.equal(final.lifecycle.identicalRebuilds, 10); assert.equal(final.lifecycle.mixedRebuilds, 324);
  assert.equal(final.lifecycle.retainedBytesLimit, 10 * 1024 * 1024); assert.equal(final.lifecycle.shaderCountsReviewed, true);
  assert.equal(final.selection.samplesPerPolicy, 32768);
  assert.deepEqual(plan.continuousNatural.branches, ['low', 'medium', 'severe', 'alternating']);
  assert.equal(plan.continuousNatural.tripsPerBranch, 12); assert.equal(plan.continuousNatural.totalTrips, 48);
  assert.equal(plan.continuousNatural.perGradeTrips, 16); assert.equal(plan.continuousNatural.policyRevision, 15);
  assert.equal(plan.continuousNatural.postReturnManagement, true);
  bound({ path: plan.continuousNatural.storage, sha256: plan.continuousNatural.storageSha256 });
  bound({ path: plan.continuousNatural.controller, sha256: plan.continuousNatural.controllerSha256 });
  assert.deepEqual(plan.i11ContractMatrix.orientationsDegrees, [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.deepEqual(plan.i11ContractMatrix.normalizedAnimationPhases, [0, .25, .5, .75]);
  bound(plan.i11ContractMatrix.abilitySource);
  assert.equal(plan.execution.maxQaBrowsers, 1); assert.equal(plan.execution.performanceRequiresExclusiveCpu, true);
  assert.equal(plan.retention.noHistoricalDeletion, true);
  assert.equal(plan.soundGate.listeningStatus, 'pending'); assert.equal(plan.soundGate.engineeringIsListening, false);
  assert.equal(plan.soundGate.requiredForI12Decision, true);
  return { status: 'valid-plan-only', assignedNewWorlds: all.length - 52, finalWorlds: 108,
    newGenerationCases: 10656, inheritedBaseCases: 7488, finalUniqueGenerationCases: 18144, newPlayProcesses: 336 };
}

/** Readiness is a separate execution copy, never an edit to frozen test inputs.
 * Only the selected batch's status may change; all source policy bytes remain
 * represented by the original receipt and all other parsed values are exact. */
export function validateExpansionExecutionPlan(execution, { batch, read = file => fs.readFileSync(file) } = {}) {
  assert(batch, 'Execution requires a specific batch');
  const result = validateExpansionPlan(execution, { batch, read });
  const source = execution.executionSource;
  assert(source && Object.keys(source).sort().join(',') === 'path,sha256', 'Execution requires the original frozen plan receipt');
  assert.equal(path.resolve(source.path), path.resolve(DEFAULT_PLAN), 'Readiness must derive from this expansion scope freeze');
  const bytes = read(source.path); assert.equal(sha(bytes), source.sha256, 'Original frozen plan changed');
  const original = JSON.parse(bytes); assert.equal(original.status, 'frozen'); validateExpansionPlan(original, { read });
  const restored = structuredClone(execution); delete restored.executionSource;
  const row = restored.batches.find(row => row.id === batch), prior = original.batches.find(row => row.id === batch);
  assert.equal(prior.status, 'specified', 'Only an authored, frozen batch may become ready');
  row.status = prior.status;
  assert.deepEqual(restored, original, 'Readiness cannot alter IDs, seeds, controller, ancestor, review policy or another batch');
  return { ...result, executionBatch: batch, frozenPlan: source };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = process.argv.indexOf('--plan'), planPath = flag < 0 ? DEFAULT_PLAN : process.argv[flag + 1];
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const result = validateExpansionPlan(plan);
  if (process.argv.includes('--self-check')) {
    const fails = [
      p => { p.generation.newBaseCases--; },
      p => { p.generation.expandedAtI11.cases--; },
      p => { p.generation.expandedHoldout.seeds[0] = p.generation.holdout.seeds[0]; },
      p => { p.batches[0].status = 'ready'; p.batches[0].worlds = ['only-one']; },
      p => { p.batches[0].status = 'ready'; p.batches[0].worlds = ['x', 'x', 'y', 'z']; },
      p => { p.batches[0].iteration = 'R100-I12'; },
      p => { p.status = 'frozen'; p.batches[0].status = 'unassigned'; p.batches[0].worlds = []; },
      p => { p.actualPlay.seeds[0]++; },
      p => { p.finalPool.runtimeBudget.minimumAliveMs = 59999; },
      p => { p.finalPool.lifecycle.mixedRebuilds--; },
      p => { p.execution.maxQaBrowsers = 2; },
      p => { p.soundGate.listeningStatus = 'pass'; },
      p => { p.continuousNatural.tripsPerBranch = 11; },
    ];
    for (const mutate of fails) { const wrong = structuredClone(plan); mutate(wrong); assert.throws(() => validateExpansionPlan(wrong)); }
    assert.throws(() => validateExpansionPlan(plan, { batch: 'B01' }));
    const ready = structuredClone(plan); ready.status = 'frozen';
    ready.batches.forEach((row, index) => { row.status = 'ready'; row.worlds = Array.from({ length: 4 }, (_, slot) => `fixture-${index}-${slot}`); });
    assert.equal(validateExpansionPlan(ready, { batch: 'B14' }).assignedNewWorlds, 56);
    const executable = structuredClone(plan);
    executable.executionSource = { path: DEFAULT_PLAN, sha256: sha(fs.readFileSync(DEFAULT_PLAN)) };
    executable.batches[0].status = 'ready';
    assert.equal(validateExpansionExecutionPlan(executable, { batch: 'B01' }).executionBatch, 'B01');
    const executionFailures = [
      p => { p.batches[0].worlds[0] = 'different-world'; },
      p => { p.actualPlay.requirement += ' altered'; },
      p => { p.continuousNatural.review.pop(); },
      p => { p.batches[1].status = 'ready'; },
      p => { delete p.executionSource; },
      p => { p.executionSource.sha256 = '0'.repeat(64); },
    ];
    for (const mutate of executionFailures) {
      const wrong = structuredClone(executable); mutate(wrong);
      assert.throws(() => validateExpansionExecutionPlan(wrong, { batch: 'B01' }));
    }
    console.log(JSON.stringify({ ...result, selfCheck: { negativeCases: fails.length + 1,
      completeSyntheticPlan: 'pass', executionCopyNegativeCases: executionFailures.length, executionCopyStatusOnly: 'pass' } }));
  } else console.log(JSON.stringify(result));
}
