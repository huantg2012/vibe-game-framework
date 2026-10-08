import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn, execFileSync} from 'node:child_process';
import {isWorkerObservationFailure} from '../../../../../tools/qa/r100-worker-observer.mjs';

const folder = 'docs/qa/artifacts/r100-i10-i12/b13-network-recheck';
const read = file => JSON.parse(fs.readFileSync(file));
const ref = file => ({path: file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const planRef = ref(`${folder}/plan.json`), plan = read(planRef.path);
const anchors = [planRef, plan.originalCommand, plan.originalFailure, plan.originalBatch,
  plan.originalPolicy, plan.originalAttempt, plan.diagnosis, plan.source, ...plan.references];
const verify = () => {for (const item of anchors) assert.deepEqual(ref(item.path), item);};
function noBrowser() {
  for (const line of execFileSync('ps', ['-axo', 'pid=,comm='], {encoding: 'utf8'}).split('\n')) {
    const match = line.trim().match(/^(\d+)\s+(.+)$/);
    if (!match) continue;
    const executable = path.basename(match[2]);
    if (!['Google Chrome', 'headless_shell', 'chrome-headless-shell'].includes(executable)) continue;
    const args = execFileSync('ps', ['-p', match[1], '-o', 'command='], {encoding: 'utf8'});
    assert(!(executable.includes('headless') || args.includes('--headless')), 'Another QA Chrome is active');
  }
}
function observe(stage) {
  const observationFiles = fs.readdirSync(stage.env.QA_WORKER_OBSERVER_DIR)
    .filter(file => file.endsWith('.jsonl')).sort().map(file => path.join(stage.env.QA_WORKER_OBSERVER_DIR, file));
  const events = observationFiles.flatMap(file => fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)));
  const failures = events.filter(isWorkerObservationFailure);
  assert.equal(failures.length, 0, 'Clean follow-up must have no observer failures');
  const contexts = events.filter(event => event.event === 'network-summary' && event.reason === 'context-closed');
  assert.equal(contexts.length, stage.cases, 'Every original process must close its sole context');
  assert(contexts.every(event => event.failed === 0 && event.pending.length === 0), 'No pending/failed transport at context closure');
  return {files: observationFiles.map(ref), failureCount: failures.length, contextCount: contexts.length,
    requests: contexts.reduce((sum, row) => sum + row.requests, 0), pendingAtClose: 0};
}
verify(); noBrowser();
const output = `${folder}/execution.json`;
const report = {status: 'running', pid: process.pid, startedAt: new Date().toISOString(),
  plan: planRef, runner: ref(`${folder}/run.mjs`), stages: []};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
try {
  for (const stage of plan.stages) {
    verify(); noBrowser();
    assert(!fs.existsSync(stage.folder), 'Never overwrite a previous stage');
    assert(!fs.existsSync('/tmp/coh-r100-i10-i12.pause'), 'Resource window not released');
    fs.mkdirSync(stage.folder);
    const log = `${stage.folder}/execution.log`, fd = fs.openSync(log, 'wx');
    report.current = stage.id; save(); console.log('START', stage.id);
    const env = {...process.env, ...stage.env};
    for (const name of ['QA_CONTROLLED_BUILD', 'QA_REPRO_IDENTITY_FILE', 'QA_REPLAY_INPUTS', 'QA_ORDINAL_START']) delete env[name];
    let result;
    try {
      result = await new Promise((resolve, reject) => {
        const child = spawn(stage.command, stage.args, {env, stdio: ['ignore', fd, fd]});
        report.childPid = child.pid; save();
        child.once('error', reject); child.once('close', (code, signal) => resolve({code, signal}));
      });
    } finally {fs.closeSync(fd); delete report.childPid;}
    const row = {id: stage.id, originalIndices: stage.originalIndices, ...result, log: ref(log)};
    report.stages.push(row); save();
    assert.equal(result.code, 0, 'Retain failure and stop; no automatic retry');
    const batchPath = `${stage.folder}/play/batch-report.json`, batch = read(batchPath);
    assert.equal(batch.status, 'completed-fixed-attempts-pending-review');
    assert.equal(batch.attempts.length, stage.cases);
    assert(batch.attempts.every(item => item.exitCode === 0)); assert(!batch.stoppedAfterFailure);
    assert(!fs.existsSync(stage.env.QA_WORKER_OBSERVER_FAILURE_FILE));
    row.batch = ref(batchPath); row.observation = observe(stage);
    const policy = read(`${stage.folder}/play/policy-freeze.json`), originalPolicy = read(plan.originalPolicy.path);
    for (const key of ['algorithmRevision', 'controllerPolicyRevision', 'manifestSha256', 'storageSourceSha256', 'storageSha256', 'harnessSha256'])
      assert.deepEqual(policy[key], originalPolicy[key], `Original ${key} must stay exact`);
    assert.deepEqual(policy.dependencies, originalPolicy.dependencies);
    assert.deepEqual(policy.wrapperDependencies, originalPolicy.wrapperDependencies);
    if (stage.id === '003-same-identity-recheck') {
      const original = read(plan.originalAttempt.path), replayPath = `${stage.folder}/play/${batch.attempts[0].dir}/report.json`, replay = read(replayPath);
      const originalJourney = original.realJourneyAttempts[0], replayJourney = replay.realJourneyAttempts[0];
      assert.equal(replay.policyRevision, 15);
      assert.deepEqual(replayJourney.identity, originalJourney.identity, 'Full generation and identity must match original003');
      assert.deepEqual(replayJourney.before, originalJourney.before, 'Exact earned-save branch before original preparation');
      assert.equal(replayJourney.status, 'completed-real-input');
      assert.equal(replayJourney.noStateInjection, originalJourney.noStateInjection, 'Controlled identity disclosure must remain exact');
      row.identityMatch = {original: plan.originalAttempt, replay: ref(replayPath), fullIdentityExact: true,
        beforeSaveExact: true, policyRevision: 15, originalNetworkFailureRetained: true};
    }
    verify(); noBrowser(); save(); console.log('END', stage.id);
  }
  delete report.current; report.status = 'completed-recheck-and-original21';
  report.finishedAt = new Date().toISOString(); save();
} catch (error) {
  report.status = 'failed'; report.error = String(error.stack ?? error);
  report.finishedAt = new Date().toISOString(); save(); throw error;
}
