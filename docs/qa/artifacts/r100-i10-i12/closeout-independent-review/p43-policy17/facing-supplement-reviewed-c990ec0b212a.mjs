/** Explicit bounded facing corrections cannot silently replace the frozen policy15
 * attempts or change their game, earned save, seeds or qualification threshold. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const caseKey = row => `${row.world}/${row.grade}/${row.seed}`;

export function validateFacingControllerSupplement(reference, policy, batch, plan, bytes) {
  const read = ref => {
    assert(ref?.path && /^[a-f0-9]{64}$/.test(ref.sha256), 'Explicit supplement input SHA required');
    assert.equal(digest(bytes(ref.path)), ref.sha256, `Supplement input changed: ${ref.path}`);
    return JSON.parse(bytes(ref.path));
  };
  assert((plan.controllerSupplements ?? []).some(row => row.path === reference?.path
    && row.sha256 === reference?.sha256), 'Supplement must be explicitly included in the summary plan');
  const protocol = read(reference);
  assert.equal(protocol.version, 1);
  assert.equal(protocol.status, 'approved-bounded-visible-facing-input');
  assert.equal(protocol.reviewer, 'root');
  assert.equal(protocol.issueId, 'R100-P43');
  assert.equal(protocol.policyRevision, 17);
  assert.equal(protocol.algorithmRevision, 6);
  assert.equal(protocol.gameplayChanges, 'none');
  assert.deepEqual(protocol.limits, {maxFacingSegments: 3, maxSegmentInputMs: 60, maxTurnInputMs: 180,
    maxFacingElapsedMs: 1000, earlyStopMs: 750, actionReserveMs: 100, maxErrorDegrees: 25,
    maxActualPickups: 3, minimumNonEntryDistance: 320, noHiddenAiState: true});
  const frozen = read(protocol.qualificationPlan);
  assert.equal(protocol.qualificationPlan.path, 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json');
  assert.equal(frozen.actualPlay.controllerPolicyRevision, 15);
  assert.equal(frozen.actualPlay.maximumActualPickups, protocol.limits.maxActualPickups);
  assert.equal(frozen.actualPlay.nonEntryDistanceExclusive, protocol.limits.minimumNonEntryDistance);
  assert.equal(policy.controllerPolicyRevision, 17);
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
  const wanted = [20261005, 3075192741].map(seed => `ochre-folds/severe/${seed}`).sort();
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

const finite = value => Number.isFinite(value);
const near = (actual, expected, message) => assert(finite(actual) && Math.abs(actual - expected) < 1e-7, message);
const point = value => assert(value && finite(value.x) && finite(value.y), 'Finite observed position required');

function validateGeometry(check, record, allowed = false) {
  assert(check && check.targetId === record.targetId, 'Facing check changed its original visible target');
  assert(typeof check.visible === 'boolean');
  assert(finite(check.observedElapsedMs) && check.observedElapsedMs >= record.startedElapsedMs
    && check.observedElapsedMs <= record.endedElapsedMs, 'Observation lies outside its input window');
  point(check.player?.pos); assert(finite(check.player.facing));
  assert(finite(check.hp) && finite(check.chaos) && typeof check.ended === 'boolean');
  if (!check.visible) {assert(!allowed, 'Cannot swing at an unseen enemy'); assert.equal(check.enemy, null); return;}
  assert.equal(check.enemy?.id, record.targetId); point(check.enemy.pos);
  assert(['idle', 'windup', 'strike', 'recover'].includes(check.enemy.attack));
  const dx = check.enemy.pos.x - check.player.pos.x, dy = check.enemy.pos.y - check.player.pos.y;
  const bearing = Math.atan2(dy, dx), distance = Math.hypot(dx, dy);
  const error = Number((Math.abs(Math.atan2(Math.sin(bearing - check.player.facing),
    Math.cos(bearing - check.player.facing))) * 180 / Math.PI).toFixed(10));
  near(check.bearing, bearing, 'Reported bearing differs from visible geometry');
  near(check.distance, distance, 'Reported distance differs from visible geometry');
  near(check.errorDegrees, error, 'Reported angle differs from actual player facing');
  const inRange = record.maxDistance === 37 ? distance <= 37 : distance < 40;
  assert.equal(check.withinRange, inRange); assert.equal(check.aligned, error <= 25);
  assert.equal(check.phaseAllowed, !['windup', 'strike'].includes(check.enemy.attack));
  if (allowed) {
    assert(check.withinRange && check.aligned && check.phaseAllowed, 'Space requires current visible safe geometry');
    assert(!check.ended && check.hp > 30 && check.hp >= record.minimumHp && check.chaos < 120,
      'Space cannot weaken the original survival conditions');
  }
}

/** A bounded correction is evidence only when every recorded Space has its
 * matching original input log and independently recomputable visible geometry. */
export function validateFacingSupplementJourney(binding, attempt, journey, actualPickups, logEvents) {
  const original = binding.originals.get(caseKey(attempt));
  assert(original, 'Facing journey lies outside the approved original cases');
  assert.deepEqual(journey.identity, original.identity, 'Facing supplement changed the full original identity');
  assert.deepEqual(journey.before, original.before, 'Facing supplement changed the earned starting save');
  assert(actualPickups.length <= binding.actualPickupLimit, 'Facing supplement exceeded the original pickup limit');
  assert.equal(journey.boundedSearchRechecks, undefined, 'Facing correction must not introduce repeat searches');
  const records = journey.facingChecks;
  assert(Array.isArray(records) && Array.isArray(logEvents), 'Facing actions and original input log required');
  const logged = logEvents.filter(row => row.event === 'bounded-melee-facing-check')
    .map(({at, event, ...record}) => record);
  assert.deepEqual(logged, records, 'Facing records differ from their original chronological input log');
  const spaces = logEvents.filter(row => row.event === 'key' && row.key === 'Space');
  const issued = records.filter(row => row.spaceInput?.issued === true);
  assert.equal(spaces.length, issued.length, 'Every actual Space must have exactly one facing check');
  assert(spaces.every(row => row.delay === 60), 'Original Space duration changed');
  const loggedSpaces = logEvents.filter(row => row.event === 'facing-space-input-end')
    .map(({at, event, facingCheckIndex, ...input}) => ({index: facingCheckIndex, input}));
  assert.deepEqual(loggedSpaces, issued.map(row => ({index: row.index, input: row.spaceInput})),
    'Actual Space completion traces differ from the reported actions');
  const loggedTurns = logEvents.filter(row => row.event === 'facing-turn-input-end')
    .map(({at, event, facingCheckIndex, ...segment}) => ({index: facingCheckIndex, segment}));
  assert.deepEqual(loggedTurns, records.flatMap(row => row.segments.map(segment => ({index: row.index, segment}))),
    'Turn segment completion traces differ from their actual input records');
  const problems = [];
  let previousEnd = journey.entryState.elapsedMs;
  for (const [index, record] of records.entries()) {
    assert.equal(record.index, index);
    assert(['visible-pursuer', 'cornered'].includes(record.context));
    assert.equal(record.maxDistance, record.context === 'visible-pursuer' ? 37 : 40);
    assert.equal(record.minimumHp, record.context === 'visible-pursuer' ? 45 : 30);
    assert(typeof record.targetId === 'string' && record.targetId.length);
    assert(['allowed', 'abandoned', 'failed'].includes(record.status));
    assert(typeof record.reason === 'string' || record.status === 'failed');
    assert(finite(record.triggerElapsedMs) && record.triggerElapsedMs <= record.startedElapsedMs);
    assert(finite(record.startedElapsedMs) && finite(record.endedElapsedMs)
      && record.startedElapsedMs >= previousEnd && record.endedElapsedMs >= record.startedElapsedMs
      && record.endedElapsedMs <= journey.fieldResult.elapsedMs, 'Input windows must be ordered within the real journey');
    previousEnd = record.endedElapsedMs;
    near(record.elapsedMs, record.endedElapsedMs - record.startedElapsedMs, 'Elapsed facing time must use the game clock');
    assert(finite(record.maxObservedElapsedMs) && record.maxObservedElapsedMs >= record.elapsedMs);
    if (record.elapsedMs > 1000 || record.maxObservedElapsedMs > 1000 || record.withinTimeBound !== true)
      problems.push('Facing correction exceeded its 1000ms actual game-time bound');
    assert(Array.isArray(record.errors));
    if (record.errors.length) problems.push(...record.errors.map(error => `Facing action: ${error}`));
    if (record.releasedAllTrackedKeys !== true) problems.push('Facing correction did not release all tracked keys');
    if (record.status === 'failed') problems.push('Facing correction failed');
    assert(Array.isArray(record.segments) && record.segments.length <= 3, 'At most three original direction segments');
    let requested = 0, segmentEnd = record.startedElapsedMs;
    for (const [segmentIndex, segment] of record.segments.entries()) {
      assert.equal(segment.index, segmentIndex);
      assert(Array.isArray(segment.keys) && segment.keys.length > 0 && segment.keys.length <= 2
        && new Set(segment.keys).size === segment.keys.length && segment.keys.every(key => ['w', 'a', 's', 'd'].includes(key))
        && !(segment.keys.includes('w') && segment.keys.includes('s'))
        && !(segment.keys.includes('a') && segment.keys.includes('d')), 'Only actual direction keys may align');
      assert(finite(segment.requestedMs) && segment.requestedMs > 0 && segment.requestedMs <= 60);
      assert(finite(segment.startedElapsedMs) && finite(segment.endedElapsedMs)
        && segment.startedElapsedMs >= segmentEnd && segment.endedElapsedMs >= segment.startedElapsedMs
        && segment.endedElapsedMs <= record.endedElapsedMs);
      segmentEnd = segment.endedElapsedMs;
      validateGeometry(segment.before, record);
      assert(segment.before.visible && segment.before.withinRange && segment.before.phaseAllowed);
      assert.equal(segment.before.aligned, false, 'An aligned opportunity needs no additional movement');
      assert(segment.before.observedElapsedMs <= segment.startedElapsedMs);
      const dx = segment.before.enemy.pos.x - segment.before.player.pos.x;
      const dy = segment.before.enemy.pos.y - segment.before.player.pos.y, keys = [];
      if (Math.abs(dx) > .42 * Math.abs(dy)) keys.push(dx > 0 ? 'd' : 'a');
      if (Math.abs(dy) > .42 * Math.abs(dx)) keys.push(dy > 0 ? 's' : 'w');
      assert.deepEqual(segment.keys, keys, 'Turn inputs must follow the same currently visible bearing');
      if (segment.waitIssued === true) requested += segment.requestedMs;
      else if (record.status !== 'failed') assert.fail('Nonfailed turn segment must record its actual wait request');
      if (segment.released !== true) problems.push('Facing segment did not release its keys');
    }
    assert.equal(record.turnInputMs, requested);
    assert(requested <= 180, 'Requested direction-key holds exceed the frozen 180ms budget');
    if (record.finalCheck) validateGeometry(record.finalCheck, record);
    if (record.spaceInput?.issued) {
      const input = record.spaceInput;
      assert.equal(input.requestedMs, 60);
      assert(finite(input.startedElapsedMs) && finite(input.endedElapsedMs)
        && input.startedElapsedMs >= segmentEnd && input.endedElapsedMs >= input.startedElapsedMs
        && input.endedElapsedMs <= record.endedElapsedMs);
      assert.deepEqual(input.finalCheck, record.finalCheck);
      validateGeometry(input.finalCheck, record, true);
      assert(input.finalCheck.observedElapsedMs <= input.startedElapsedMs);
    }
    if (record.status === 'allowed') assert.equal(record.spaceInput?.issued, true);
    if (record.status === 'abandoned') assert(!record.spaceInput?.issued, 'An abandoned alignment cannot hide a swing');
  }
  return problems;
}
