/** Resume the actual first I14 run after a checker false positive; retain all48
 * preregistered grades and real state. The original failed batch is immutable.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { checkpointChecksum, validRiftCheckpoint } from '../../src/types/rift-checkpoint.ts';
import { differences } from '../qa/r100-i14-lifecycle-v2.mjs';

const base = 'docs/qa/artifacts/r100-i14/continuous';
const root = path.join(base, 'recovery-v2'), planFile = path.join(root, 'policy-freeze.json');
const parentPlan = path.join(base, 'policy-freeze.json');
const journey = 'tools/world-study/r100-i14-continuous-v2-journey.mjs';
const read = file => JSON.parse(fs.readFileSync(file));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({ file, sha256: sha(file) });
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const rawOf = storage => storage.origins[0].localStorage.find(row => row.name === 'coh-save-v1').value;
const verify = rows => { for (const row of rows) assert.equal(sha(row.file), row.sha256, row.file); };
const ownFiles = [journey, 'tools/qa/r100-i14-lifecycle-v2.mjs', 'tools/world-study/run-r100-i14-continuous-v2.mjs'];
function valid(saved) { const { checkpointChecksum: sum, ...rest } = saved; return validRiftCheckpoint(saved.riftCheckpoint) && sum === checkpointChecksum(rest); }
function allowedCommit(before, after) {
  return valid(before) && valid(after) && after.riftCheckpoint.sequence >= before.riftCheckpoint.sequence
    && differences(before, after).every(row => ['riftCheckpoint.sequence', 'checkpointChecksum'].includes(row.path));
}
function check() {
  for (const file of ownFiles) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); }
  const original = read(path.join(base, 'batch-01/i14/1-cold-input.save.json'));
  const actual = JSON.parse(rawOf(read(path.join(base, 'batch-01/i14/browser-storage.json'))));
  assert(allowedCommit(original, actual));
  const changed = structuredClone(actual); changed.kindlingReserve++; const { checkpointChecksum: ignored, ...record } = changed;
  changed.checkpointChecksum = checkpointChecksum(record); assert(valid(changed)); assert(!allowedCommit(original, changed), 'Even a checksum-valid resource mutation cannot pass the envelope-only exception');
  return { status: 'pass', syntaxFiles: ownFiles.length, actualOriginalDifferences: differences(original, actual),
    sameRun: actual.inventory.run.id, sequence: actual.riftCheckpoint.sequence, validOriginalAndCurrentChecksums: true,
    checksumValidResourceChangeRejected: true };
}
if (process.argv.includes('--self-check')) { console.log(JSON.stringify(check())); process.exit(0); }
if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(planFile));
  const prior = read(parentPlan); verify([...prior.dependencies, ...prior.initialSource, prior.sourceManifest, prior.taskContract]);
  const sourceStorage = path.join(base, 'batch-01/i14/browser-storage.json'), interruptedReport = path.join(base, 'batch-01/report.json');
  const failed = read(interruptedReport).realJourneyAttempts;
  assert.equal(failed.length, 1); assert.equal(failed[0].status, 'failed'); assert.equal(failed[0].searches.length, 0);
  assert.equal(failed[0].lifecycle.strategyBudgetAtReload.normalSlotUses, 0);
  const selfCheck = check(); fs.mkdirSync(root, { recursive: true }); write(path.join(root, 'code-self-check.json'), selfCheck);
  const input = path.join(root, 'same-run-earned-storage.json'); fs.copyFileSync(sourceStorage, input, fs.constants.COPYFILE_EXCL);
  const contract = path.join(root, 'task-preregistration.md'); fs.copyFileSync(prior.taskContract.file, contract, fs.constants.COPYFILE_EXCL);
  write(planFile, { ...prior, version: 2, createdAt: new Date().toISOString(), parentPlan: ref(parentPlan), taskContract: ref(contract),
    reason: 'Normal pagehide recommitted identical full paused game state, sequence6→8 and checksum only. V1 byte-equality assertion was too strict. V2 accepts only validated monotonic envelope recommit; every other field remains exact.',
    authorization: 'Root explicitly authorized the two-field checker correction and normal same-run Continue from actualseq8; total remains48, first failed segment preserved. No resources or runtime facts injected.',
    dependencies: [...prior.dependencies, ...ownFiles.map(ref)], input: ref(input), sourceStorage: ref(sourceStorage), interruptedReport: ref(interruptedReport),
    immutableFailure: [ref(path.join(base, 'batch-01/execution.json')), ref(path.join(base, 'batch-01/i14/1-cold-input.save.json')),
      ref(path.join(base, 'batch-01/i14/1-cold-before.json')), ref(path.join(base, 'batch-01/i14/journey.jsonl'))],
    sameRunRecovery: { runId: selfCheck.sameRun, checkpointSequence: 8, inheritedSearches: 0, inheritedToolUses: 0, replacementDeparture: false },
    focusDisposition: 'First headless tab activation emitted no native blur. Retainpending; no synthetic event. Later real headed focused diagnostic is separately required.' });
  console.log(`Frozen ${planFile}`); process.exit(0);
}
const arg = process.argv.indexOf('--run-batch'), batch = Number(process.argv[arg + 1]);
assert(arg >= 0 && Number.isInteger(batch) && batch >= 1 && batch <= 4, 'Use --self-check, --freeze or --run-batch1..4');
const plan = read(planFile); verify([...plan.dependencies, ...plan.initialSource, ...plan.immutableFailure,
  plan.parentPlan, plan.input, plan.sourceStorage, plan.interruptedReport, plan.preflight, plan.sourceManifest, plan.releaseManifest, plan.taskContract]);
for (const [file, expected] of Object.entries(read(plan.sourceManifest.file).sources)) assert.equal(sha(file), expected, file);
const firstOrdinal = (batch - 1) * 12 + 1, out = path.join(root, `batch-${String(batch).padStart(2, '0')}`);
assert(!fs.existsSync(out), 'Retain failures; never silently rerun a batch');
let input = plan.input.file, freshItemIds = plan.initialFreshItemIds, ancestorRunIds = plan.ancestorRunIds;
if (batch > 1) {
  const previousFolder = path.join(root, `batch-${String(batch - 1).padStart(2, '0')}`), previous = read(path.join(previousFolder, 'report.json'));
  assert.equal(previous.realJourneyAttempts.length, 12); assert(previous.realJourneyAttempts.every(row => row.status === 'completed-real-input'));
  input = path.join(previousFolder, 'i14/browser-storage.json'); assert.deepEqual(JSON.parse(rawOf(read(input))), previous.realJourneyAttempts.at(-1).afterPreparation.state);
  freshItemIds = previous.realJourneyAttempts.at(-1).freshAcquisitionOrder.map(row => row.id);
  ancestorRunIds = [...new Set([...previous.continuation.ancestorRunIds, ...previous.realJourneyAttempts.map(row => row.entrySave.state.inventory.run.id)])];
}
const continuation = { id: `i14-v2-batch-${batch}`, sourceBranch: 'I13-A23-to-I14-single-chain', sourceStorage: input, sourceStorageSha256: sha(input),
  steps: plan.steps.slice(firstOrdinal - 1, firstOrdinal + 11), freshItemIds, ancestorRunIds,
  resumeFirst: batch === 1, ...(batch === 1 ? { interruptedReport: plan.interruptedReport.file } : {}) };
fs.mkdirSync(out); write(path.join(out, 'batch-input.json'), { plan: ref(planFile), input: ref(input), continuation });
const env = { ...process.env, GAME_URL: plan.gameUrl, QA_OUTPUT_DIR: out, QA_STORAGE_STATE: input, QA_RUNS: '12',
  QA_I14_SCHEDULE: JSON.stringify(continuation.steps.map(step => step.grade)), QA_I14_PREPARATION: JSON.stringify(continuation.steps[0].preparation),
  QA_I14_CONTINUATION: JSON.stringify(continuation), QA_POST_RETURN_MANAGEMENT: '1', QA_ENTRY_WAIT: '600', QA_ORDINAL_START: String(firstOrdinal),
  QA_WORLD_ID: '', QA_SEED: '', QA_CONTROLLED_BUILD: '', QA_REPRO_IDENTITY_FILE: '', QA_REPLAY_INPUTS: '',
  CHROME_PATH: plan.environment.chromePath, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' };
const guard = spawnSync(process.execPath, ['--import', 'tsx', journey, '--check-return-policy'], { env, encoding: 'utf8' });
write(path.join(out, 'return-policy-check.json'), { exitCode: guard.status, stdout: guard.stdout, stderr: guard.stderr }); assert.equal(guard.status, 0);
const execution = { batch, firstOrdinal, startedAt: new Date().toISOString(), planSha256: sha(planFile), input: ref(input), status: 'running', sameRunRecovery: batch === 1 ? plan.sameRunRecovery : null };
const save = () => fs.writeFileSync(path.join(out, 'execution.json'), JSON.stringify(execution, null, 2) + '\n'); save();
const fd = fs.openSync(path.join(out, 'process.log'), 'wx');
try { execution.exitCode = await new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--import', 'tsx', journey], { env, stdio: ['ignore', fd, fd] });
  execution.childPid = child.pid; save(); child.once('error', reject); child.once('close', resolve); }); }
catch (error) { execution.error = String(error); execution.exitCode = -1; }
finally { fs.closeSync(fd); }
const reportPath = path.join(out, 'report.json'), report = fs.existsSync(reportPath) ? read(reportPath) : null;
execution.report = report ? ref(reportPath) : null; execution.actualAttempts = report?.realJourneyAttempts.length ?? 0;
execution.completed = report?.realJourneyAttempts.filter(row => row.status === 'completed-real-input').length ?? 0;
execution.status = execution.exitCode === 0 && execution.completed === 12 ? 'completed' : 'failed-preserved-no-replacement';
execution.finishedAt = new Date().toISOString(); save(); console.log(`I14 v2 batch${batch}: ${execution.status} ${execution.completed}/12`);
if (execution.status !== 'completed') process.exitCode = 1;
