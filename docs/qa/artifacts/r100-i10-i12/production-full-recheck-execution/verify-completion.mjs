import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { validateFinalReport } from '../../../../../tools/qa/r100-i09-final-probe.mjs';

const base = 'docs/qa/artifacts/r100-i10-i12';
const audit = base + '/production-full-recheck-execution';
const out = base + '/production-final108-recheck-idle-sleep';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({ path: file, sha256: hash(file) });
const target = audit + '/completion-verification.json';
assert(!fs.existsSync(target), 'Keep the original completion verification');
const execution = read(audit + '/execution.json');
assert.equal(execution.status, 'pass-single-full-recheck');
assert.equal(execution.exitCode, 0);
assert.deepEqual(execution.problems, []);
assert.equal(execution.actualTotalAttempts, 476);
for (const key of ['noSystemSleepDuringExecution', 'ownedProcessesClosed', 'ownedAssertionsReleased', 'frozenRefsUnchanged'])
  assert.equal(execution[key], true, key);
const protocol = read(execution.protocol.path);
assert.equal(hash(execution.protocol.path), execution.protocol.sha256);
for (const item of protocol.reviewedInputs) assert.equal(hash(item.path), item.sha256, item.path);
const binding = read(out + '/source-binding.json');
assert.equal(binding.status, 'pass');
for (const key of ['beforeRuntimeVerified', 'afterRuntimeVerified', 'servedSourceVerified']) assert.equal(binding[key], true, key);
assert.equal(binding.workerObservationStatus, 'pass-observed-events');
assert.deepEqual(binding.beforeServedHashes, binding.afterServedHashes);
const report = read(out + '/report.json');
validateFinalReport('production', report, binding.worldIds, [], 6);
const schedule = report.cases.map((row, index) => ({
  ordinal: index + 1, world: row.world, grade: row.grade, controlledSeed: row.controlledSeed,
}));
assert.deepEqual(schedule, read(protocol.expectedCases.path).cases);
const original = read(protocol.originalFailure.path);
assert.equal(original.cases.length, 152);
assert.equal(original.cases[151].status, 'failed');
for (const [index, row] of original.cases.entries()) {
  const current = report.cases[index];
  for (const key of ['world', 'grade', 'controlledSeed']) assert.equal(current[key], row[key]);
  const identity = row.identity ?? JSON.parse(row.diagnostic.saved).riftCheckpoint.identity;
  assert.deepEqual(current.identity, identity, 'Entire identity mismatch at original case ' + (index + 1));
}
const rawBefore = read(audit + '/processes-before.json');
const publicBefore = read(audit + '/processes-before.for-publication.json');
assert.equal(rawBefore.relevant.length, publicBefore.relevant.length);
for (const row of rawBefore.relevant) {
  const exported = publicBefore.relevant.find(value => value.pid === row.pid);
  if (row.pid === rawBefore.operatorPpid) {
    assert.equal(exported.pid, 88685); assert.equal(exported.ppid, row.ppid);
    assert.equal(exported.comm, 'codex'); assert.equal(exported.command, undefined);
  } else assert.deepEqual(exported, row);
}
const observation = read(out + '/worker-observation-summary.json');
assert.equal(observation.status, 'pass-observed-events');
assert.deepEqual(observation.issues, []);
const receipt = {
  status: 'pass-strict-completion-verification', at: new Date().toISOString(),
  verifier: ref(audit + '/verify-completion.mjs'), execution: ref(audit + '/execution.json'),
  approvedProtocol: ref(execution.protocol.path), source: ref(protocol.finalSource.path),
  operatorSource: ref(audit + '/operator-source.py'), exactOperatorCommand: ref(audit + '/operator-command.txt'),
  operatorSourceProvenance: ref(audit + '/operator-source-receipt.json'),
  sourceBinding: ref(out + '/source-binding.json'), report: ref(out + '/report.json'),
  sourceFilesVerifiedBeforeAndAfter: execution.sourceFilesVerifiedBeforeAndAfter,
  servedFileCount: Object.keys(binding.beforeServedHashes).length,
  all324OrderedScheduleEqual: true, original152StrictCompleteIdentityAndScheduleEqual: true,
  comparisonSemantics: 'node:assert/strict deepEqual, including the entire generation and every identity field',
  failed152NewPass: true, originalFailedReportUnchanged: ref(protocol.originalFailure.path),
  workerObservation: ref(out + '/worker-observation-summary.json'),
  observedCounts: observation.counts, observedErrors: observation.issues, observerLimitation: observation.limitation,
  powerWindow: ref(audit + '/power-log-execution-window.txt'), powerLog: ref(audit + '/power-log-after.txt'),
  noSystemSleepInExecutionWindow: true, ownedProcessesAndAssertionsClosed: true,
  publicationInventory: ref(audit + '/processes-before.for-publication.json'),
  publicationDelta: 'Only the unrelated shared Codex execution-service parent argv is omitted. Its PID/PPID/comm remain. All probe node/caffeinate/Chrome child-tree argv evidence is preserved. Original local inventory bytes are unchanged and excluded from git.',
  originalLocalInventorySha256: hash(audit + '/processes-before.json'),
  attemptedCaseAccounting: { original: 152, completeRecheck: 324, total: 476 },
  scope: 'Formal entry/cold reload integration and limited observed power/process evidence. No natural expedition, performance or lifecycle qualification.',
};
fs.writeFileSync(target, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, receipt: ref(target), observed: observation.counts }));
