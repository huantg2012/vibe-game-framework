/** Explicit bounded input rechecks cannot silently replace the frozen policy15
 * attempts or change their game, earned save, seeds or qualification threshold. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const caseKey = row => `${row.world}/${row.grade}/${row.seed}`;

export function validateControllerSupplement(reference, policy, batch, plan, bytes) {
  const read = ref => {
    assert(ref?.path && /^[a-f0-9]{64}$/.test(ref.sha256), 'Explicit supplement input SHA required');
    assert.equal(digest(bytes(ref.path)), ref.sha256, `Supplement input changed: ${ref.path}`);
    return JSON.parse(bytes(ref.path));
  };
  assert((plan.controllerSupplements ?? []).some(row => row.path === reference?.path
    && row.sha256 === reference?.sha256), 'Supplement must be explicitly included in the summary plan');
  const protocol = read(reference);
  assert.equal(protocol.version, 1);
  assert.equal(protocol.status, 'approved-bounded-input-recheck');
  assert.equal(protocol.reviewer, 'root');
  assert.equal(protocol.issueId, 'R100-P42');
  assert.equal(protocol.policyRevision, 16);
  assert.equal(protocol.algorithmRevision, 6);
  assert.equal(protocol.gameplayChanges, 'none');
  assert.deepEqual(protocol.limits, {maxRechecksPerJourney: 1, maxRecheckElapsedMs: 6000,
    maxActualPickups: 3, minimumNonEntryDistance: 320, noHiddenAiState: true});
  const frozen = read(protocol.qualificationPlan);
  assert.equal(protocol.qualificationPlan.path, 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json');
  assert.equal(frozen.actualPlay.controllerPolicyRevision, 15);
  assert.equal(frozen.actualPlay.maximumActualPickups, protocol.limits.maxActualPickups);
  assert.equal(frozen.actualPlay.nonEntryDistanceExclusive, protocol.limits.minimumNonEntryDistance);
  assert.equal(policy.controllerPolicyRevision, 16);
  assert.equal(policy.algorithmRevision, 6);
  assert.deepEqual(protocol.source, {path: policy.manifest, sha256: policy.manifestSha256});
  assert.deepEqual(protocol.storage, {path: policy.storageSource, sha256: policy.storageSourceSha256});
  const originalPolicy = read(protocol.originalPolicy);
  assert.equal(originalPolicy.controllerPolicyRevision, 15);
  assert.deepEqual(protocol.source, {path: originalPolicy.manifest, sha256: originalPolicy.manifestSha256});
  assert.deepEqual(protocol.storage, {path: originalPolicy.storageSource, sha256: originalPolicy.storageSourceSha256});
  assert.equal(policy.actualPickupLimit, originalPolicy.actualPickupLimit, 'Original search limit must remain unchanged');
  assert(Number.isInteger(policy.actualPickupLimit) && policy.actualPickupLimit > 0
    && policy.actualPickupLimit <= protocol.limits.maxActualPickups);
  read(protocol.source); read(protocol.storage);
  assert.equal(digest(bytes(protocol.executor.path)), protocol.executor.sha256);
  assert.equal(protocol.executor.sha256, policy.harnessSha256);
  assert.equal(digest(bytes(protocol.wrapper.path)), protocol.wrapper.sha256);
  assert.equal(protocol.wrapper.sha256, policy.wrapperSha256);
  assert.deepEqual(policy.dependencies, protocol.dependencies);
  for (const dependency of protocol.dependencies) {
    assert.equal(digest(bytes(dependency.file)), dependency.sha256, 'Supplement dependency changed');
  }
  const wanted = [20261005, 3075192741].map(seed => `white-scarfield/severe/${seed}`).sort();
  assert.deepEqual(protocol.cases.map(caseKey).sort(), wanted, 'Bounded recheck scope changed');
  assert.deepEqual(policy.cases.map(caseKey).sort(), wanted, 'Recheck scheduler changed');
  assert.deepEqual(batch.attempts.map(caseKey).sort(), wanted, 'Both original seeds must be attempted exactly once');
  const originals = new Map();
  for (const row of protocol.cases) {
    assert(plan.batches.some(folder => row.originalReport.path.startsWith(`${folder}/`)),
      'Original unsuccessful attempt must remain in the summary');
    const original = read(row.originalReport);
    assert.equal(original.policyRevision, 15);
    assert.equal(original.controlledWorld, row.world);
    assert.equal(original.realJourneyAttempts.length, 1);
    const journey = original.realJourneyAttempts[0];
    assert.equal(journey.identity.generation.package.id, `r100-${row.world}`);
    assert.equal(journey.identity.generation.package.grade, row.grade);
    assert.equal(journey.identity.generation.requestedSeed, row.seed);
    assert.equal(journey.identity.generation.package.algorithmRevision, 6);
    assert.equal(journey.status, 'completed-real-input');
    assert(journey.fieldResult.nodes.every(node => !node.collected), 'This supplement concerns the preserved zero-pickup failures');
    originals.set(caseKey(row), journey);
  }
  return {protocol, originals, actualPickupLimit: policy.actualPickupLimit};
}

export function validateSupplementJourney(binding, attempt, journey, actualPickups) {
  const original = binding.originals.get(caseKey(attempt));
  assert(original, 'Journey lies outside approved supplement');
  assert.deepEqual(journey.identity, original.identity, 'Supplement changed original full generation identity');
  assert.deepEqual(journey.before, original.before, 'Supplement changed the earned starting save');
  const records = journey.boundedSearchRechecks;
  assert(Array.isArray(records), 'Supplement must explicitly record its bounded input actions');
  assert(records.length <= binding.protocol.limits.maxRechecksPerJourney, 'Too many additional search attempts');
  assert(actualPickups.length <= binding.actualPickupLimit, 'Supplement exceeded original actual pickup budget');
  const problems = [];
  for (const record of records) {
    assert(typeof record.targetId === 'string' && record.targetId.length);
    assert.equal(record.reason, 'visible-opponent-too-close');
    assert(['completed', 'game-time-budget', 'failed'].includes(record.status), 'Unknown supplemental action outcome');
    assert(Number.isInteger(record.originalSearchIndex) && record.originalSearchIndex >= 0);
    const trigger = journey.searches[record.originalSearchIndex];
    assert(trigger && trigger.id === record.targetId && trigger.searchDecision?.attempted === false
      && trigger.searchDecision.reason === record.reason, 'Supplement must follow a real refusal at the same observed target');
    assert.equal(record.originalSearchIndex, journey.searches.findIndex(row => row.searchDecision?.attempted === false
      && row.searchDecision.reason === record.reason), 'Supplement must follow the first eligible refusal');
    assert.equal(record.triggerElapsedMs, trigger.elapsedMs);
    assert(record.triggerElapsedMs <= record.startedElapsedMs, 'Supplement cannot precede its triggering refusal');
    const node = journey.entryState.nodes.find(row => row.id === record.targetId);
    assert(node && !node.collected && Math.hypot(node.pos.x - journey.entryState.pos.x,
      node.pos.y - journey.entryState.pos.y) > binding.protocol.limits.minimumNonEntryDistance,
    'Supplement target must be an original uncollected non-entry node');
    const elapsed = record.endedElapsedMs - record.startedElapsedMs;
    assert(Number.isFinite(record.startedElapsedMs) && Number.isFinite(record.endedElapsedMs) && elapsed >= 0,
      'Bounded input action requires actual game elapsed time');
    assert(record.startedElapsedMs >= journey.entryState.elapsedMs && record.endedElapsedMs <= journey.fieldResult.elapsedMs,
      'Bounded input action lies outside the actual journey');
    if (elapsed > binding.protocol.limits.maxRecheckElapsedMs) problems.push('Supplement exceeded its 6000ms game-time budget');
    assert(Array.isArray(record.errors), 'Supplement action errors must be explicitly recorded');
    if (record.errors.length) problems.push(...record.errors.map(error => `Supplement action: ${error}`));
    if (record.withinTimeBound !== true) problems.push('Supplement action did not prove its time bound');
    if (record.releasedAllTrackedKeys !== true) problems.push('Supplement action did not release every tracked key');
    assert(Number.isFinite(record.maxObservedElapsedMs) && record.maxObservedElapsedMs >= elapsed,
      'Supplement maximum observed game duration must include the complete action');
    if (record.maxObservedElapsedMs > binding.protocol.limits.maxRecheckElapsedMs)
      problems.push('Supplement observed game duration exceeded 6000ms');
    if (record.status === 'failed') problems.push('Supplement action failed');
  }
  return problems;
}
