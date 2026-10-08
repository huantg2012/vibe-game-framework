/** Adversarial protocol checks only; creates no game execution or approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateControllerSupplement, validateSupplementJourney} from './r100-i12-controller-supplement.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const ref = file => ({path: file, sha256: sha(fs.readFileSync(file))});
const folder = 'docs/qa/artifacts/r100-i10-i12/b13-network-recheck/original005-006/play';
const originalPolicy = read(`${folder}/policy-freeze.json`);
const originalReports = [
  `${folder}/001-white-scarfield-severe-20261005/report.json`,
  `${folder}/002-white-scarfield-severe-3075192741/report.json`,
];
const fixture = () => {
  const memory = new Map([['synthetic-executor', Buffer.from('fixture executor')],
    ['synthetic-wrapper', Buffer.from('fixture wrapper')]]);
  const protocol = {version: 1, status: 'approved-bounded-input-recheck', reviewer: 'root', issueId: 'R100-P42',
    policyRevision: 16, algorithmRevision: 6, gameplayChanges: 'none',
    limits: {maxRechecksPerJourney: 1, maxRecheckElapsedMs: 6000, maxActualPickups: 3,
      minimumNonEntryDistance: 320, noHiddenAiState: true},
    qualificationPlan: ref('docs/qa/artifacts/r100-i10-i12/qualification-plan.json'),
    originalPolicy: ref(`${folder}/policy-freeze.json`),
    source: {path: originalPolicy.manifest, sha256: originalPolicy.manifestSha256},
    storage: {path: originalPolicy.storageSource, sha256: originalPolicy.storageSourceSha256},
    executor: {path: 'synthetic-executor', sha256: sha(memory.get('synthetic-executor'))},
    wrapper: {path: 'synthetic-wrapper', sha256: sha(memory.get('synthetic-wrapper'))},
    dependencies: originalPolicy.dependencies,
    cases: originalReports.map((file, index) => ({world: 'white-scarfield', grade: 'severe',
      seed: [20261005, 3075192741][index], originalReport: ref(file)})),
  };
  const policy = {...structuredClone(originalPolicy), controllerPolicyRevision: 16,
    harnessSha256: protocol.executor.sha256, wrapperSha256: protocol.wrapper.sha256};
  const batch = {attempts: structuredClone(protocol.cases)};
  const plan = {batches: [folder]};
  const bytes = file => memory.get(file) ?? fs.readFileSync(file);
  const bind = () => {
    const raw = Buffer.from(JSON.stringify(protocol)); memory.set('synthetic-protocol', raw);
    const reference = {path: 'synthetic-protocol', sha256: sha(raw)};
    plan.controllerSupplements = [reference];
    return validateControllerSupplement(reference, policy, batch, plan, bytes);
  };
  return {memory, protocol, policy, batch, plan, bytes, bind};
};
const checks = [];
const check = (name, run) => {run(); checks.push({name, status: 'pass'});};
check('synthetic metadata with actual preserved two original failures', () => fixture().bind());
for (const [name, mutate] of [
  ['author cannot approve own new input policy', f => f.protocol.reviewer = 'author'],
  ['broader world scope rejected even with resealed metadata', f => f.protocol.cases[0].world = 'ochre-folds'],
  ['replacement seed rejected', f => f.protocol.cases[0].seed = 1],
  ['one favorable seed cannot replace the two-seed recheck', f => f.batch.attempts.pop()],
  ['second retry cannot be hidden inside batch', f => f.batch.attempts.push(f.batch.attempts[0])],
  ['old attempts cannot be excluded', f => f.plan.batches = []],
  ['six-second input budget cannot be relaxed', f => f.protocol.limits.maxRecheckElapsedMs = 6500],
  ['non-entry distance cannot be lowered', f => f.protocol.limits.minimumNonEntryDistance = 300],
  ['original one-pickup process budget cannot increase', f => f.policy.actualPickupLimit = 2],
  ['same original game snapshot required', f => f.policy.manifestSha256 = sha('different game')],
  ['same earned starting save required', f => f.policy.storageSourceSha256 = sha('different resources')],
  ['executor bytes cannot change after approval', f => f.memory.set('synthetic-executor', Buffer.from('changed'))],
  ['dependencies cannot be silently replaced', f => f.policy.dependencies[0].sha256 = sha('changed')],
]) check(name, () => {const f = fixture(); mutate(f); assert.throws(f.bind);});
check('supplement requires an explicit summary whitelist', () => {
  const f = fixture(); f.bind();
  const raw = f.memory.get('synthetic-protocol'); f.plan.controllerSupplements = [];
  assert.throws(() => validateControllerSupplement({path: 'synthetic-protocol', sha256: sha(raw)}, f.policy, f.batch, f.plan, f.bytes));
});
const originalJourney = read(originalReports[0]).realJourneyAttempts[0];
const journeyFixture = () => {
  const f = fixture(), binding = f.bind(), journey = structuredClone(originalJourney);
  const trigger = journey.searches[0];
  journey.boundedSearchRechecks = [{targetId: 'r100-kindling-deep-1', reason: 'visible-opponent-too-close',
    originalSearchIndex: 0, triggerElapsedMs: trigger.elapsedMs,
    startedElapsedMs: trigger.elapsedMs + 1, endedElapsedMs: trigger.elapsedMs + 6000,
    status: 'game-time-budget', errors: [], withinTimeBound: true, releasedAllTrackedKeys: true, maxObservedElapsedMs: 5999}];
  return {binding, journey, attempt: f.protocol.cases[0]};
};
const verifyJourney = f => validateSupplementJourney(f.binding, f.attempt, f.journey, []);
check('bounded action accounting with exact original identity/save', () => assert.deepEqual(verifyJourney(journeyFixture()), []));
for (const [name, mutate] of [
  ['changed full generation identity rejected', f => f.journey.identity.generation.requestedSeed = 1],
  ['added starting resource rejected', f => f.journey.before.state.kindlingReserve += 1],
  ['missing explicit action accounting rejected', f => delete f.journey.boundedSearchRechecks],
  ['multiple additional search actions rejected', f => f.journey.boundedSearchRechecks.push(f.journey.boundedSearchRechecks[0])],
  ['nonfinite game deadline rejected', f => f.journey.boundedSearchRechecks[0].endedElapsedMs = NaN],
  ['invented target rejected', f => f.journey.boundedSearchRechecks[0].targetId = 'nonexistent'],
  ['missing real refused search rejected', f => f.journey.searches = []],
  ['extra action before observed refusal rejected', f => {
    f.journey.boundedSearchRechecks[0].startedElapsedMs = 1000;
    f.journey.boundedSearchRechecks[0].endedElapsedMs = 2000;
  }],
  ['missing supplemental action status rejected', f => delete f.journey.boundedSearchRechecks[0].status],
]) check(name, () => {const f = journeyFixture(); mutate(f); assert.throws(() => verifyJourney(f));});
check('actual game-time overrun remains an invalid attempt, not dropped evidence', () => {
  const f = journeyFixture(); f.journey.boundedSearchRechecks[0].endedElapsedMs += 2;
  f.journey.boundedSearchRechecks[0].maxObservedElapsedMs = 6001;
  assert.deepEqual(verifyJourney(f), ['Supplement exceeded its 6000ms game-time budget', 'Supplement observed game duration exceeded 6000ms']);
});
for (const [name, mutate] of [
  ['unreleased key makes action invalid', r => r.releasedAllTrackedKeys = false],
  ['unproven time bound makes action invalid', r => r.withinTimeBound = false],
  ['caught action error cannot become a successful process', r => r.errors.push('original action error')],
]) check(name, () => {const f = journeyFixture(); mutate(f.journey.boundedSearchRechecks[0]); assert(verifyJourney(f).length > 0);});
check('four actual pickups rejected independently of reported search target count', () => {
  const f = journeyFixture(); assert.throws(() => validateSupplementJourney(f.binding, f.attempt, f.journey, [{}, {}, {}, {}]));
});
const output = process.argv[2]; assert(output && !fs.existsSync(output), 'Fresh output path required');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, JSON.stringify({status: 'pass', scope: 'Protocol and accounting predicates with synthetic policy16 metadata plus the actual preserved policy15 failures. No policy16 gameplay, root approval or world qualification.',
  validator: ref('tools/qa/r100-i12-controller-supplement.mjs'), harness: ref('tools/qa/check-r100-i12-controller-supplement.mjs'), checks}, null, 2) + '\n', {flag: 'wx'});
console.log(`PASS ${checks.length} bounded controller supplement predicates; no gameplay executed`);
