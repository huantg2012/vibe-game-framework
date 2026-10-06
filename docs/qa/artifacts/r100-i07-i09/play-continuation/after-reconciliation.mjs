/** New scheduling receipt after the original, intentionally strict SHA guard.
 * Waits only; never resumes a failed child, rewrites an attempt, or changes input.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPlaySummary } from '../../../../../tools/qa/r100-play-qualification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
process.chdir(root);
const base = 'docs/qa/artifacts/r100-i07-i09', out = `${base}/play-continuation/after-reconciliation-execution.json`;
const previousFile = `${base}/play-continuation/execution.json`, plan = `${base}/play-queue/plan.json`;
const read = file => JSON.parse(fs.readFileSync(file));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { if (e.code === 'ESRCH') return false; throw e; } };
const files = [fileURLToPath(import.meta.url), 'tools/qa/r100-i07-i09-play-queue.mjs', 'tools/qa/r100-i07-i09-journey.mjs',
  'tools/qa/r100-i07-i09-coverage.mjs', 'tools/qa/r100-play-qualification.mjs', 'tools/qa/r100-observed-searches.mjs', plan,
  `${base}/play-continuation/old20-reconciled-summary.json`, `${base}/play-continuation/pickup-reconciliation.json`];
const expected = files.map(file => ({ file, sha256: sha(file) }));
const stable = () => { for (const row of expected) assert.equal(sha(row.file), row.sha256, `Changed reviewed continuation input: ${row.file}`); };
const state = { version: 1, status: 'waiting-for-original-guard', startedAt: new Date().toISOString(), pid: process.pid,
  previous: previousFile, fixedFiles: expected, method: 'Let original guard stop on reviewed accounting-source change, independently verify that sole change and the reconciled qualification, then create a new144 execution. Does not bypass the original guard.' };
assert(!fs.existsSync(out), 'Keep prior scheduling receipts');
const save = () => fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n'); save();
try {
  let previous = read(previousFile);
  while (previous.status === 'running') {
    assert(alive(previous.pid), 'Original scheduler disappeared without a terminal receipt');
    await new Promise(resolve => setTimeout(resolve, 2000)); previous = read(previousFile);
  }
  assert.equal(previous.status, 'stopped-on-failure');
  assert.equal(previous.failure, "AssertionError('Changed scheduling input: tools/qa/r100-play-qualification.mjs')");
  assert(previous.stages.some(row => row.stage === 'existing-b01-b02' && row.status === 'pass'));
  assert(!previous.stages.some(row => row.stage === 'remaining144'), 'Original must not have started144');
  while (alive(previous.pid)) await new Promise(resolve => setTimeout(resolve, 100));
  for (const row of previous.fixedFiles) if (row.path !== 'tools/qa/r100-play-qualification.mjs')
    assert.equal(sha(row.path), row.sha256, `Unexpected other original input change: ${row.path}`);
  stable();
  const recorded = read(`${base}/play-continuation/old20-reconciled-summary.json`);
  const rebuilt = buildPlaySummary(recorded.plan); delete recorded.createdAt; delete rebuilt.createdAt;
  assert.deepEqual(rebuilt, recorded); assert.equal(rebuilt.status, 'pass'); assert.equal(rebuilt.qualifiedGradePairs, 60);
  assert.equal(rebuilt.actualAttempts, 123); assert.equal(rebuilt.invalidOrIncompleteProcesses, 3);
  const processes = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' });
  assert(!processes.includes('--user-data-dir=') || !processes.split('\n').some(line => /--user-data-dir=.*playwright_chromiumdev_profile-/.test(line)), 'QA browser must close before handoff');
  assert(!alive(97333), 'Existing source queue must exit');
  state.status = 'running144'; state.previousSha256 = sha(previousFile); state.rebuiltOld20 = { status: rebuilt.status, pairs: 60, attempts: 123, retainedOriginalFailures: 3 }; save();
  const fd = fs.openSync(`${base}/play-continuation/remaining144-after-reconciliation.log`, 'wx');
  try {
    const child = spawn(process.execPath, ['tools/qa/r100-i07-i09-play-queue.mjs', '--run', '--plan', plan, '--output', `${base}/play-queue/execution`], { stdio: ['ignore', fd, fd] });
    state.childPid = child.pid; save(); console.log('START remaining144 after reviewed accounting guard');
    await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => { state.exitCode = code; state.signal = signal; resolve(); }); });
  } finally { fs.closeSync(fd); }
  state.status = state.exitCode === 0 ? 'completed-fixed-batches-pending-qualification' : 'stopped-on-batch-failure';
  if (state.exitCode !== 0) process.exitCode = 1;
} catch (error) { state.status = 'stopped-on-handoff-failure'; state.failure = String(error); process.exitCode = 1; }
finally { state.endedAt = new Date().toISOString(); save(); console.log(state.status, state.failure ?? ''); }
