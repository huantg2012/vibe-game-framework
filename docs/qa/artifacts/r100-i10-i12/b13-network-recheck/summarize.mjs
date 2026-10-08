import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {buildPlaySummary} from '../../../../../tools/qa/r100-play-qualification.mjs';
import {isWorkerObservationFailure} from '../../../../../tools/qa/r100-worker-observer.mjs';

const base = 'docs/qa/artifacts/r100-i10-i12/', folder = `${base}b13-network-recheck`;
const read = file => JSON.parse(fs.readFileSync(file));
const ref = file => ({path: file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', {flag: 'wx'});
const plan = read(`${folder}/plan.json`), execution = read(`${folder}/execution.json`);
assert.equal(execution.status, 'completed-recheck-and-original21');
assert.deepEqual(execution.plan, ref(`${folder}/plan.json`));
assert(execution.stages.every(stage => stage.code === 0));
assert.equal(execution.stages[0].identityMatch.fullIdentityExact, true);
assert.equal(execution.stages[0].identityMatch.beforeSaveExact, true);
const commands = read(plan.originalCommand.path);
const batchFolders = [`${base}b13-current-qualified/play`, ...plan.stages.map(stage => `${stage.folder}/play`)];
const summaryPlanPath = `${folder}/play-summary-plan.json`;
write(summaryPlanPath, {version: 1, worlds: commands.worlds, grades: ['low', 'medium', 'severe'],
  seeds: [20261005, 3075192741], batches: batchFolders, algorithmRevisions: [6]});
const summary = buildPlaySummary(summaryPlanPath);
write(`${folder}/play-summary.json`, summary);
assert.equal(summary.completedSeedProcesses, 24);
assert.equal(summary.actualAttempts, 25);

const allAttempts = summary.attempts.map(attempt => {
  const journey = read(attempt.report).realJourneyAttempts[0];
  return {...attempt, fieldHp: journey.fieldResult?.hp ?? null, fieldChaos: journey.fieldResult?.chaos ?? null,
    fieldElapsedMs: journey.fieldResult?.elapsedMs ?? null, carried: journey.fieldResult?.carried ?? null,
    errors: journey.errors ?? [], consoleErrors: journey.consoleErrors ?? []};
});
const originalAttempt = allAttempts.find(attempt => attempt.report === plan.originalAttempt.path);
assert(originalAttempt, 'Original network-failed process must remain in accounting');
const logicalAttempts = allAttempts.filter(attempt => attempt !== originalAttempt);
assert.equal(logicalAttempts.length, 24); assert.equal(new Set(logicalAttempts.map(attempt => attempt.key)).size, 24);
const outcomes = {
  nonEntry: logicalAttempts.filter(attempt => attempt.searchAndExtract).length,
  nearOnly: logicalAttempts.filter(attempt => attempt.processComplete && attempt.outcome === 'extract' && !attempt.collected.length && attempt.actualPickups > 0).length,
  empty: logicalAttempts.filter(attempt => attempt.processComplete && attempt.outcome === 'extract' && !attempt.collected.length && !attempt.actualPickups).length,
  deaths: logicalAttempts.filter(attempt => attempt.processComplete && attempt.outcome === 'death').length,
};
write(`${folder}/outcomes.json`, {summary: ref(`${folder}/play-summary.json`), allAttempts, logicalAttempts,
  retainedOriginal: originalAttempt, logicalOutcomes: outcomes,
  limitation: 'Logical original seed coverage selects the explicitly authorized clean original003 recheck. The original errored process and its gameplay outcome remain in allAttempts; no failed journey is replaced by another seed.'});

const observationDirectories = [`${base}b13-current-qualified/worker-observations`, ...plan.stages.map(stage => stage.env.QA_WORKER_OBSERVER_DIR)];
const files = [], contexts = [], failures = [];
for (const directory of observationDirectories) {
  for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.jsonl')).sort()) {
    const file = path.join(directory, name), events = fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
    files.push(ref(file));
    for (const row of events.filter(isWorkerObservationFailure)) failures.push({...row, file});
    if (!events.some(row => row.event === 'launch')) continue;
    for (const event of ['launch', 'browser-ready', 'context-created', 'context-closed', 'browser-disconnected'])
      assert.equal(events.filter(row => row.event === event).length, 1, `${file}/${event}`);
    const created = events.filter(row => row.event === 'worker-created').map(row => row.workerId).sort();
    const closed = events.filter(row => row.event === 'worker-closed').map(row => row.workerId).sort();
    assert(created.length > 0); assert.deepEqual(created, closed);
    const network = events.filter(row => row.event === 'network-summary' && row.reason === 'context-closed');
    assert.equal(network.length, 1); assert(network[0].requests > 0 && network[0].responses > 0);
    contexts.push({file: ref(file), workers: created.length, network: network[0]});
  }
}
assert.equal(contexts.length, 25); assert.equal(failures.length, 3);
assert(failures.every(row => row.file.startsWith(`${base}b13-current-qualified/`)
  && row.event === 'requestfailed' && row.failure.errorText === 'net::ERR_NETWORK_CHANGED'));
write(`${folder}/worker-observation-summary.json`, {status: 'completed-with-original-three-network-errors-retained',
  execution: ref(`${folder}/execution.json`), originalDiagnosis: plan.diagnosis, files, contexts, exceptionEvents: failures,
  cleanAdditionalContexts: 22, limitations: 'Original003 retains three network failures and its pending requests. Clean same-identity follow-up does not explain historical P36 or replace final324 entry/cold checks.'});
write(`${folder}/reconciliation.json`, {status: summary.status === 'pass'
  ? 'completed-original24-with-retained-environment-attempt' : 'completed-original24-with-qualified-pair-deficit',
  uniqueSeedProcesses: 24, actualAttempts: 25, qualifiedGradePairs: summary.qualifiedGradePairs, originalObservationFailureRetained: true,
  originalCommands: plan.originalCommand, originalExecution: plan.originalFailure,
  correctionExecution: ref(`${folder}/execution.json`), summary: ref(`${folder}/play-summary.json`),
  outcomes: ref(`${folder}/outcomes.json`), observations: ref(`${folder}/worker-observation-summary.json`), logicalOutcomes: outcomes});
console.log(JSON.stringify({status: summary.status, originalSeeds: 24, actualAttempts: 25, outcomes,
  originalNetworkFailures: failures.length, newNetworkFailures: 0, output: `${folder}/reconciliation.json`}));
if (summary.status !== 'pass') process.exitCode = 1;
