/** Synthetic trace adversaries using preserved real identities. No game execution. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateFacingControllerSupplement, validateFacingSupplementJourney} from './r100-i12-facing-supplement.mjs';

const copy = value => structuredClone(value);
const bytes = file => fs.readFileSync(file);
const ref = path => ({path, sha256: createHash('sha256').update(bytes(path)).digest('hex')});
const folder = 'docs/qa/artifacts/r100-i10-i12/b13-network-recheck/original007-024/play';
const cases = [20261005, 3075192741].map((seed, index) => ({world: 'ochre-folds', grade: 'severe', seed,
  originalReport: ref(`${folder}/${String(11 + index).padStart(3, '0')}-ochre-folds-severe-${seed}/report.json`)}));
const originals = new Map(cases.map(row => [`${row.world}/${row.grade}/${row.seed}`,
  JSON.parse(bytes(row.originalReport.path)).realJourneyAttempts[0]]));
const limits = {maxFacingSegments: 3, maxSegmentInputMs: 60, maxTurnInputMs: 180, maxFacingElapsedMs: 1000,
  earlyStopMs: 750, actionReserveMs: 100, maxErrorDegrees: 25, maxActualPickups: 3,
  minimumNonEntryDistance: 320, noHiddenAiState: true};
const binding = {protocol: {limits}, originals, actualPickupLimit: 1};
const base = copy(originals.values().next().value);
base.facingChecks = [];
const events = journey => journey.facingChecks.flatMap(record => [
  ...record.segments.flatMap(segment => {
    const {waitIssued, ...start} = segment;
    return [{event:'facing-turn-input', facingCheckIndex: record.index, ...start, endedElapsedMs:null, released:false},
      {event: 'facing-turn-input-end', facingCheckIndex: record.index, ...segment}];
  }),
  ...(record.spaceInput?.issued ? [{event:'facing-space-input', facingCheckIndex:record.index,
    ...record.spaceInput, endedElapsedMs:null, issued:false}, {event: 'key', key: 'Space', delay: 60},
    {event: 'facing-space-input-end', facingCheckIndex: record.index, ...record.spaceInput}] : []),
  {event: 'bounded-melee-facing-check', ...record},
]);
const geometry = {targetId: 'visible-test-opponent', visible: true, observedElapsedMs: 20100,
  player: {pos: {x: 100, y: 100}, facing: 0}, enemy: {id: 'visible-test-opponent', pos: {x: 130, y: 100}, attack: 'idle'},
  hp: 145, chaos: 40, ended: false, bearing: 0, errorDegrees: 0, distance: 30,
  withinRange: true, aligned: true, phaseAllowed: true};
const allowed = {index: 0, targetId: geometry.targetId, context: 'visible-pursuer', triggerElapsedMs: 19990,
  maxDistance: 37, minimumHp: 45, startedElapsedMs: 20000, endedElapsedMs: 20300, elapsedMs: 300,
  maxObservedElapsedMs: 300, status: 'allowed', reason: 'current-visible-target-aligned', segments: [], turnInputMs: 0,
  finalCheck: geometry, spaceInput: {requestedMs: 60, startedElapsedMs: 20120, endedElapsedMs: 20200,
    issued: true, finalCheck: geometry}, withinTimeBound: true, releasedAllTrackedKeys: true, errors: []};
const good = () => {const journey = copy(base); journey.facingChecks = [copy(allowed)]; return journey;};
const check = (journey, logs = events(journey), pickups = []) =>
  validateFacingSupplementJourney(binding, cases[0], journey, pickups, logs);
const passed = [];
const test = (name, fn) => {fn(); passed.push(name);};
const rejected = (name, mutate, logs) => test(name, () => {
  const journey = good(); mutate(journey);
  assert.throws(() => check(journey, logs ? logs(journey) : events(journey)));
});
test('zero actual melee opportunities are valid and disclosed', () => assert.deepEqual(check(base), []));
test('one real-log-bound aligned input is accepted', () => assert.deepEqual(check(good()), []));
rejected('changed full identity', j => j.identity.generation.requestedSeed++);
rejected('changed earned save', j => j.before.state.kindlingReserve++);
rejected('extra search retry field', j => j.boundedSearchRechecks = []);
rejected('missing original Space', () => {}, j => events(j).filter(x => x.event !== 'key'));
rejected('unrecorded extra Space', () => {}, j => [...events(j), {event: 'key', key: 'Space', delay: 60}]);
rejected('Space duration changed', () => {}, j => events(j).map(x => x.event === 'key' ? {...x, delay: 70} : x));
rejected('raw final action differs', () => {}, j => events(j).map(x => x.event === 'bounded-melee-facing-check' ? {...x, reason: 'altered'} : x));
rejected('raw Space completion differs', () => {}, j => events(j).map(x => x.event === 'facing-space-input-end' ? {...x, requestedMs: 80} : x));
rejected('context cannot enlarge original range', j => j.facingChecks[0].maxDistance = 90);
rejected('context cannot weaken health requirement', j => j.facingChecks[0].minimumHp = 1);
rejected('fake angle despite false actual facing', j => j.facingChecks[0].finalCheck.player.facing = Math.PI);
rejected('fake distance', j => j.facingChecks[0].finalCheck.enemy.pos.x = 160);
rejected('unknown or hidden target', j => j.facingChecks[0].finalCheck.enemy.id = 'hidden');
rejected('Space against enemy windup', j => {const g=j.facingChecks[0].finalCheck;g.enemy.attack='windup';g.phaseAllowed=false;});
rejected('Space against enemy strike', j => {const g=j.facingChecks[0].finalCheck;g.enemy.attack='strike';g.phaseAllowed=false;});
rejected('Space after death', j => j.facingChecks[0].finalCheck.ended = true);
rejected('Space below original health floor', j => j.facingChecks[0].finalCheck.hp = 44);
rejected('Space above original chaos floor', j => j.facingChecks[0].finalCheck.chaos = 120);
rejected('observation outside the action window', j => j.facingChecks[0].finalCheck.observedElapsedMs = 21000);
rejected('time summary cannot understate actual elapsed', j => j.facingChecks[0].elapsedMs = 1);
rejected('abandonment cannot hide a Space', j => j.facingChecks[0].status = 'abandoned');
test('actual overrun invalidates qualification', () => {const j=good(),r=j.facingChecks[0];r.endedElapsedMs=21100;r.elapsedMs=r.maxObservedElapsedMs=1100;assert(check(j).length>0);});
test('recorded error invalidates qualification', () => {const j=good();j.facingChecks[0].errors.push('CDP failure');assert(check(j).length>0);});
test('unreleased keys invalidate qualification', () => {const j=good();j.facingChecks[0].releasedAllTrackedKeys=false;assert(check(j).length>0);});
test('actual pickup limit stays one', () => assert.throws(() => check(good(), events(good()), [{}, {}])));

const withTurn = () => {
  const j=good(),r=j.facingChecks[0],before=copy(geometry);
  before.observedElapsedMs=20010;before.player.facing=Math.PI;before.errorDegrees=180;before.aligned=false;
  r.segments=[{index:0,keys:['d'],requestedMs:60,startedElapsedMs:20020,endedElapsedMs:20090,
    before,released:true,waitIssued:true}];r.turnInputMs=60;return j;
};
test('direction request and raw segment receipt are accepted', () => assert.deepEqual(check(withTurn()), []));
test('requested turn duration cannot be understated', () => {const j=withTurn();j.facingChecks[0].turnInputMs=0;assert.throws(()=>check(j));});
test('no unrecorded direction segment', () => {const j=withTurn();assert.throws(()=>check(j,events(j).filter(x=>x.event!=='facing-turn-input-end')));});
test('direction keys must point toward the visible opponent', () => {const j=withTurn();j.facingChecks[0].segments[0].keys=['a'];assert.throws(()=>check(j));});
test('segment request duration must remain bounded', () => {const j=withTurn();j.facingChecks[0].segments[0].requestedMs=61;j.facingChecks[0].turnInputMs=61;assert.throws(()=>check(j));});
test('unreleased segment invalidates qualification', () => {const j=withTurn();j.facingChecks[0].segments[0].released=false;assert(check(j).length>0);});

const originalPolicyRef=ref(`${folder}/policy-freeze.json`), oldPolicy=JSON.parse(bytes(originalPolicyRef.path));
const protocol = {version: 1, status: 'approved-bounded-visible-facing-input', reviewer: 'root', issueId: 'R100-P43',
  policyRevision: 17, algorithmRevision: 6, gameplayChanges: 'none', limits,
  qualificationPlan: ref('docs/qa/artifacts/r100-i10-i12/qualification-plan.json'),
  source: {path: oldPolicy.manifest, sha256: oldPolicy.manifestSha256},
  storage: {path: oldPolicy.storageSource, sha256: oldPolicy.storageSourceSha256}, originalPolicy: originalPolicyRef,
  executor: ref('tools/qa/r100-revision6-journey.mjs'), wrapper: ref('tools/qa/r100-i07-i09-coverage.mjs'),
  dependencies: oldPolicy.dependencies, cases};
function protocolCheck(mutate = () => {}) {
  const p=copy(protocol);mutate(p);const raw=Buffer.from(JSON.stringify(p));
  const reference={path:'synthetic-facing-protocol.json',sha256:createHash('sha256').update(raw).digest('hex')};
  const read=file=>file===reference.path?raw:bytes(file);
  const policy={...oldPolicy,controllerPolicyRevision:17,cases};
  const plan={batches:[folder],controllerSupplements:[reference]};
  return validateFacingControllerSupplement(reference,policy,{attempts:cases},plan,read);
}
test('explicit synthetic protocol validates preserved source and cases', () => assert.equal(protocolCheck().actualPickupLimit, 1));
for(const [name, mutate] of [
  ['unsigned status', p=>p.status='draft'], ['other issue', p=>p.issueId='R100-P42'],
  ['different policy revision', p=>p.policyRevision=16], ['extra seed', p=>p.cases.push(p.cases[0])],
  ['other world', p=>p.cases[0].world='white-scarfield'], ['larger window', p=>p.limits.maxFacingElapsedMs=2000],
  ['extra turn', p=>p.limits.maxFacingSegments=4], ['weaker angle', p=>p.limits.maxErrorDegrees=60],
]) test(name, () => assert.throws(() => protocolCheck(mutate)));

const report={status:'pass',scope:'Synthetic metadata/trace guard tests only; no browser, game execution or qualification.',
  checks:passed.length,passed,harness:ref('tools/qa/check-r100-i12-facing-supplement.mjs'),
  implementation:ref('tools/qa/r100-i12-facing-supplement.mjs')};
const at=process.argv.indexOf('--output');
if(at>=0)fs.writeFileSync(process.argv[at+1],JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
