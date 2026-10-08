/** Task-specific user-authorized sampling. Original raw failures and full-mode contracts remain intact. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const SAMPLING_AMENDMENT = {
  path: 'docs/qa/artifacts/r100-i10-i12/sampling-amendment/root-approved-sampling.json',
  sha256: '3cbe3cde85dcb601d51190ad349a46fc81c2902e68c89a4e773dbdf81fc2364e',
};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const originalInvalidation = 'I10新出发已采用修订6；保留本条修订5历史证据，当前资格待源码/几何/RGBA连续性及正式恢复证明。';

export function samplingForPlan(plan, read, ids) {
  if (!Object.hasOwn(plan, 'samplingAmendment')) return null;
  assert.deepEqual(plan.samplingAmendment, SAMPLING_AMENDMENT, 'Sampling requires the exact human-authorized root amendment');
  const amendment = read.receipt(plan.samplingAmendment);
  assert.equal(amendment.status, 'user-authorized-sampled-acceptance'); assert.equal(amendment.reviewer, 'root');
  assert.equal(amendment.authorization.quote, '不用做全量测试，抽查即可');
  assert.deepEqual(amendment.finalSource, plan.finalSource, 'Sampling amendment concerns a different final source');
  assert.deepEqual(amendment.scopeChanges.lifecycle.catalogWorldIds, ids, 'Sampling catalog/order differs');
  return amendment;
}

function checkRefs(value, read) {
  if (!value || typeof value !== 'object') return;
  if (value.path && /^[a-f0-9]{64}$/.test(value.sha256 ?? ''))
    assert.equal(sha(read.bytes(value.path)), value.sha256, 'Sampling supporting bytes changed: ' + value.path);
  for (const item of Object.values(value)) checkRefs(item, read);
}

export function validateSampledBudget(report, plan, amendment, read) {
  const scope = amendment.scopeChanges.budget, ids = amendment.scopeChanges.lifecycle.catalogWorldIds;
  assert.equal(report.status, 'failed', 'Preserve the stopped original budget failure');
  assert.equal(report.exclusiveWindow, true); assert.deepEqual(report.errors, []);
  assert.deepEqual(report.worlds, ids); assert.deepEqual(report.cases.map(row => row.world), scope.completedWorldIds, 'Sampled budget completed subset differs');
  assert.equal(report.cases.length, 74); assert.equal(report.caseProgress.length, 75);
  for (const [index, row] of report.caseProgress.entries()) {
    assert.deepEqual({index: row.index, world: row.world, grade: row.grade, seed: row.seed, status: row.status},
      {index, world: ids[index], grade: 'severe', seed: 20261004, status: index < 74 ? 'passed' : 'failed'}, 'Sampled budget original progress differs');
  }
  const interrupted = report.caseProgress[74];
  assert.equal(interrupted.world, scope.interruptedWorldId);
  assert.deepEqual(report.currentCase, interrupted);
  assert.equal(report.failure, interrupted.failure); assert.match(report.failure, /Target page, context or browser has been closed/);
  const numeric = validateBudgetMeasurements(report);
  const stop = read.receipt(plan.budgetStop);
  assert.equal(stop.status, 'user-directed-sampling-stop'); assert.deepEqual(stop.problems, []);
  assert.deepEqual(stop.originalReport, plan.budget);
  const bindings = plan.runtimeBindings.map(ref => ({ref, value: read.receipt(ref)})).filter(row => row.value.kind === 'budget');
  assert.equal(bindings.length, 1); assert.deepEqual(stop.originalSourceBinding, bindings[0].ref);
  assert.equal(stop.originalRunStatus, 'failed'); assert.equal(stop.originalSourceBindingStatus, 'failed');
  assert.equal(stop.originalHarnessExitCodeFromBinding, 1); assert.equal(stop.originalHarnessSignalFromBinding, null);
  assert.equal(stop.originalFailure, report.failure); assert.equal(stop.originalWrapperFailure, bindings[0].value.failure);
  for (const key of ['originalFull108PassClaimed', 'originalReportOrHarnessRewritten', 'automaticRetry', 'originalOperatorFinalReceiptExists']) assert.equal(stop[key], false);
  assert.equal(stop.originalOperatorExitCode, null); assert.equal(stop.completedSampleCount, 74); assert.equal(stop.validCompletedSampleCount, 74);
  assert.equal(stop.unstartedCount, 33); assert.equal(stop.withoutCompleteMeasurementCount, 34);
  assert.deepEqual(stop.completedSamples.map(row => row.world), scope.completedWorldIds);
  for (const [index, row] of stop.completedSamples.entries()) {
    const raw = report.cases[index];
    assert.equal(row.index, index); assert.equal(row.grade, raw.grade); assert.equal(row.seed, raw.seed);
    assert.equal(row.durationMs, raw.duration); assert.equal(row.actualIntervalObservations, raw.positions.length);
    assert.equal(row.originalBudgetPass, true); assert.equal(row.validCompletedSample, true); assert.deepEqual(row.issues, []);
  }
  assert.deepEqual(stop.interruptedCase.originalCaseProgress, interrupted);
  assert.equal(stop.interruptedCase.validCompleteSample, false); assert.equal(stop.interruptedCase.originalMetricRowExists, false);
  assert.deepEqual(stop.unstartedCases.map(row => row.world), scope.notStartedWorldIds);
  assert.deepEqual(stop.unstartedCases, ids.slice(75).map((world, n) => ({index: n + 75, world, grade: 'severe', seed: 20261004, status: 'not-started-user-directed-stop'})));
  const request = read.receipt(stop.stopRequest);
  assert.equal(request.status, 'user-directed-sampling-stop-requested'); assert.equal(request.authority.userInstruction, amendment.authorization.quote);
  assert.equal(request.target.signal, 'SIGTERM'); assert.equal(request.completedAtStopRequest, 74); assert.equal(request.passedAtStopRequest, 74);
  assert.equal(request.currentCaseAtStopRequest.world, interrupted.world); assert.equal(request.originalToolAndReportUnmodified, true);
  assert(Date.parse(interrupted.startedAt) <= Date.parse(request.requestedAt) && Date.parse(request.requestedAt) <= Date.parse(interrupted.finishedAt), 'Stop must occur during the interrupted case');
  const consistency = read.receipt(stop.sourceConsistency), cleanup = read.receipt(stop.resourceCleanup);
  assert.deepEqual(consistency.source, plan.finalSource); assert.deepEqual(consistency.originalBinding, bindings[0].ref);
  assert.equal(consistency.workingSourceCount, 1397); assert.equal(consistency.frozenSourceCount, 1397);
  assert.deepEqual(consistency.sourceMismatches, []); assert.deepEqual(consistency.frozenInputMismatches, []);
  assert.equal(consistency.originalBeforeAndAfterRuntimeVerified, true); assert.equal(consistency.originalBeforeAndAfterServedHashesEqualManifest, true);
  assert.deepEqual(cleanup.matchingOwnedProcesses, []); assert.deepEqual(cleanup.remainingOwnedIdleSleepAssertions, []);
  assert.equal(stop.ownedProcessesClosed, true); assert.equal(stop.ownedIdleSleepAssertionsReleased, true);
  assert.deepEqual(stop.powerAudit.systemSleepEventsInWindow, []); assert(stop.powerAudit.limitation?.length, 'Preserve interrupted outer operator observation limits');
  checkRefs(stop, read);
  return {status: 'pass-sampled-budget', originalStatus: 'failed', completed: 74, interrupted: 1, notStarted: 33, numeric};
}

export function validateSampledLifecycle(report, amendment) {
  const scope = amendment.scopeChanges.lifecycle;
  assert.equal(report.status, 'passed-bounded-lifecycle'); assert.deepEqual(report.errors, []);
  assert.deepEqual(report.catalogWorldIds, scope.catalogWorldIds); assert.equal(report.repetitions, 10); assert.equal(report.mixedRebuilds, 18);
  assert.deepEqual(report.mixedCoverage, scope.mixedCoverage, 'Sampled lifecycle mixed order differs');
  const step = (world, phase, index, grade = 'severe', seed = 20261004) => ({world, grade, seed, phase, index});
  const expected = [step('ash-strata', 'initial-load', 0), ...scope.warmupWorldIds.map((world, index) => step(world, 'warmup', index)),
    step('ash-strata', 'baseline', 0), ...Array.from({length: 10}, (_, n) => step('ash-strata', 'identical', n)),
    ...scope.mixedCoverage.map((row, n) => step(row.world, 'mixed', n, row.grade, row.seed)), step('ash-strata', 'after-mixed', 18)];
  assert.deepEqual(report.rebuildProgress.map(({world, grade, seed, phase, index}) => ({world, grade, seed, phase, index})), expected, 'Sampled lifecycle actual reconstruction order differs');
  assert(report.rebuildProgress.every(row => row.status === 'completed'), 'Sampled lifecycle unfinished rebuild');
  assert.deepEqual(report.currentStep, report.rebuildProgress.at(-1));
  return validateLifecycleMeasurements(report, scope.mixedCoverage);
}

/** Called only after the final source/continuity/current per-grade checks pass. */
export function restoreReviewedRevision5Invalidation(world, oldIds, plan) {
  if (!world.invalidated) { assert.equal(world.invalidated, false); assert(Object.values(world.grades).every(row => row.invalidated === false)); return; }
  assert(oldIds.includes(world.id), 'Only explicitly inherited old52 invalidation can be restored');
  assert.equal(world.revision, 'r100-native-v3-revision-5'); assert.equal(world.invalidationReason, originalInvalidation);
  assert(Object.values(world.grades).every(row => row.invalidated === true), 'Unexpected partial historical invalidation');
  const history = {invalidated: true, reason: world.invalidationReason, revision: world.revision,
    generation: structuredClone(world.generation), dependencyManifest: structuredClone(world.dependencyManifest),
    grades: Object.fromEntries(Object.entries(world.grades).map(([grade, value]) => [grade, {invalidated: value.invalidated}])),
    restoration: {revision: 'r100-native-v3-revision-6', finalSource: plan.finalSource, inheritance: plan.inheritance,
      technicalReview: plan.technicalReview, art: plan.art, production: plan.production,
      scope: 'Current evidence restores only this named revision-transition invalidation; all historical evidence and human decisions remain.'}};
  world.invalidationHistory = [...(world.invalidationHistory ?? []), history];
  world.invalidated = false; for (const row of Object.values(world.grades)) row.invalidated = false;
}

function finiteNonnegative(value, label) {
  assert(Number.isFinite(value) && value >= 0, `Finite nonnegative ${label} required`);
}

function validateMeasurementStats(stats, label) {
  assert(Number.isSafeInteger(stats?.count) && stats.count > 0, `${label}: nonempty measurements required`);
  for (const key of ['p50', 'p95', 'p99', 'max', 'over50']) finiteNonnegative(stats[key], `${label}/${key}`);
  assert(stats.p50 <= stats.p95 && stats.p95 <= stats.p99 && stats.p99 <= stats.max,
    `${label}: ordered measured quantiles required`);
  assert(stats.over50 <= 1, `${label}: over50 is a fraction`);
}

function validateBudgetMeasurements(report) {
  for (const row of report.cases) {
    assert.equal(row.seed, 20261004, 'The declared severe budget seed cannot change');
    assert.equal(row.grade, 'severe');
    for (const key of ['frames', 'cpu', 'materialSubmit']) validateMeasurementStats(row[key], `${row.world}/${key}`);
    // These are the original measurement harness thresholds, not new budgets.
    assert(row.frames.p95 <= 20, `${row.world}: frame P95 exceeds 20ms`);
    assert(row.frames.p99 <= 33.4, `${row.world}: frame P99 exceeds 33.4ms`);
    assert(row.frames.over50 <= .005, `${row.world}: frames over 50ms exceed 0.5%`);
    assert(row.cpu.p95 <= 12, `${row.world}: CPU P95 exceeds 12ms`);
    assert(row.materialSubmit.p95 <= 3, `${row.world}: material submission P95 exceeds 3ms`);
    assert.equal(row.positions?.length, 12, 'Preserve the twelve actual held-key interval observations');
    let elapsed = row.start?.elapsedMs;
    finiteNonnegative(elapsed, `${row.world}/start time`);
    for (const sample of [row.start, ...row.positions, row.end]) {
      finiteNonnegative(sample.elapsedMs, `${row.world}/sample time`);
      assert(sample.elapsedMs >= elapsed, `${row.world}: sample clock moved backward`); elapsed = sample.elapsedMs;
      assert.equal(sample.pollutionGrade, 'severe', 'Measure the actual severe runtime');
      assert.equal(sample.ended, false, 'All observations must remain alive');
      assert(Number.isFinite(sample.hp) && sample.hp > 0, 'Actual positive health required');
    }
    assert.equal(row.duration, row.end.elapsedMs - row.start.elapsedMs, 'Duration differs from the actual runtime clock');
    assert(row.duration >= 60000, 'At least 60 seconds of alive runtime required');
    assert.equal(row.fullAliveDuration, true); assert.equal(row.budgetPass, true);
  }
  return { status: 'pass-measured-budget-contract', thresholds: {
    frameP95Ms: 20, frameP99Ms: 33.4, framesOver50Fraction: .005, cpuP95Ms: 12, materialP95Ms: 3,
    minimumAliveMs: 60000, seed: 20261004,
  }, exclusivity: 'operator-declared; resource scheduling must also be independently checked' };
}

function validateLifecycleMeasurements(report, mixed) {
  /* Sampling changes only the expected visit set; all original numeric checks remain. */
  assert.deepEqual(report.mixedCoverage, mixed, 'Mixed reconstruction identities/order/seeds differ from the fixed schedule');
  assert.deepEqual(report.samples?.map(row => row.label), ['warmed-baseline',
    ...Array.from({ length: 10 }, (_, n) => `identical-${n + 1}`), `after-mixed-${report.mixedRebuilds}`],
  'All twelve double-GC retained samples are required');
  const baseline = report.samples[0], kinds = ['WebGL2', 'Texture', 'Buffer', 'Program', 'Shader', 'Framebuffer', 'Renderbuffer'];
  const shaders = [];
  let maxCombinedGrowth = 0;
  for (const [index, row] of report.samples.entries()) {
    for (const key of ['usedSize', 'totalSize']) finiteNonnegative(row.usage?.[key], `${row.label}/${key}`);
    assert(row.usage.usedSize <= row.usage.totalSize, 'Used heap cannot exceed total heap');
    finiteNonnegative(row.usage.backingStorageSize ?? 0, `${row.label}/backingStorageSize`);
    for (const kind of kinds) {
      const counts = row.objects?.[kind];
      for (const key of ['created', 'live', 'active'])
        assert(Number.isSafeInteger(counts?.[key]) && counts[key] >= 0, `${row.label}/${kind}/${key}: resource count required`);
      assert(counts.active <= counts.live && counts.live <= counts.created, `${row.label}/${kind}: impossible resource counts`);
      if (index) assert(counts.created >= report.samples[index - 1].objects[kind].created, 'Cumulative creates cannot decrease');
      assert.equal(counts.active, baseline.objects[kind].active, `${row.label}/${kind}: active resources did not return to baseline`);
    }
    assert(baseline.objects.WebGL2.active > 0, 'A real warmed WebGL context is required');
    // The earlier independent Shader review required bounded live/active counts,
    // not a flat cumulative create count. This numeric check does not sign that review.
    assert.equal(row.objects.Shader.live, baseline.objects.Shader.live, `${row.label}: live Shader wrappers grew`);
    const used = row.usage.usedSize - baseline.usage.usedSize;
    const backing = (row.usage.backingStorageSize ?? 0) - (baseline.usage.backingStorageSize ?? 0);
    assert.equal(row.usedHeapGrowth, used, 'Reported retained heap delta differs from measured bytes');
    assert.equal(row.backingGrowth, backing, 'Reported backing delta differs from measured bytes');
    const combined = used + Math.max(0, backing);
    assert(combined < 10 * 1024 * 1024, `${row.label}: retained growth reaches the original 10MiB limit`);
    maxCombinedGrowth = Math.max(maxCombinedGrowth, combined);
    shaders.push({ label: row.label, ...row.objects.Shader });
  }
  return { status: 'pass-measured-lifecycle-contract', retainedBytesLimit: 10 * 1024 * 1024,
    maxCombinedGrowth, shaderSamples: shaders, independentShaderReview: 'pending-separate-receipt',
    limitation: 'Numeric resource checks only. Final technical/closure binding must separately consume the independent Shader review; no GPU driver bytes/RSS or unbounded lifetime claim.' };
}

