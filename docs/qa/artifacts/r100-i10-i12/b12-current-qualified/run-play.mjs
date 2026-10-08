import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {validateExpansionExecutionPlan} from '../../../../../tools/qa/check-r100-expansion-plan.mjs';
const folder = 'docs/qa/artifacts/r100-i10-i12/b12-current-qualified';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = file => ({path: file, sha256: hash(fs.readFileSync(file))});
const read = file => JSON.parse(fs.readFileSync(file));
const commandFile = folder + '/play-commands.json', commands = read(commandFile), commandReceipt = receipt(commandFile);
const references = [commandReceipt, commands.source, commands.qualificationPlan, commands.executionPlan,
  commands.generationSummary, commands.executionPlanCheck, ...commands.rootReviews, ...commands.dependencies];
const verify = () => { for (const ref of references) assert.equal(receipt(ref.path).sha256, ref.sha256, ref.path); };
verify();
assert.deepEqual(validateExpansionExecutionPlan(read(commands.executionPlan.path), {batch: 'B12'}).executionWorlds, commands.worlds);
assert.deepEqual(commands.worlds, ["double-return","offset-basins","pinched-fan","spliced-reaches"]);
assert.deepEqual(commands.play.env.QA_WORLDS.split(','), commands.worlds);
assert.equal(commands.play.cases, 24); assert.equal(commands.play.env.QA_CONCURRENCY, '1');
assert.equal(commands.play.env.QA_STOP_ON_FAILURE, '1');
assert.equal(read(commands.executionPlan.path).batches.find(row => row.id === 'B12').status, 'ready');
for (const file of ['/play', '/play-execution.json', '/worker-observation-first-error.json']) assert(!fs.existsSync(folder + file));
assert(!fs.existsSync('/tmp/coh-r100-i10-i12.pause'), 'Resolve resource handoff first');
const reportFile = folder + '/play-execution.json', log = folder + '/play-execution.log';
const report = {status: 'running', pid: process.pid, startedAt: new Date().toISOString(), cases: 24,
  worlds: commands.worlds, wholeBatchReady: true, source: commands.source, commands: commandReceipt,
  runner: receipt(folder + '/run-play.mjs'), log, method: commands.method};
const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
save(); const fd = fs.openSync(log, 'wx'), started = Date.now();
try {
  const env = {...process.env, ...commands.play.env};
  for (const key of ['QA_CONTROLLED_BUILD', 'QA_REPRO_IDENTITY_FILE', 'QA_REPLAY_INPUTS', 'QA_ORDINAL_START']) delete env[key];
  const result = await new Promise((resolve, reject) => {
    const child = spawn(commands.play.command, commands.play.args, {env, stdio: ['ignore', fd, fd]});
    report.childPid = child.pid; save(); let error;
    child.once('error', value => {error = value;});
    child.once('close', (code, signal) => error ? reject(error) : resolve({code, signal}));
  });
  fs.closeSync(fd); delete report.childPid;
  report.exitCode = result.code; report.signal = result.signal; report.elapsedSeconds = (Date.now() - started) / 1000;
  report.logSha256 = receipt(log).sha256; report.finishedAt = new Date().toISOString();
  verify(); assert.equal(result.code, 0, 'Original failure retained; no automatic seed retry');
  const batch = read(folder + '/play/batch-report.json');
  assert.equal(batch.attempts.length, 24); assert(batch.attempts.every(row => row.exitCode === 0));
  assert(!batch.stoppedAfterFailure); assert(!fs.existsSync(folder + '/worker-observation-first-error.json'));
  report.status = 'completed-script'; save(); console.log('B12 original24 complete; outcomes need review');
} catch (error) {
  try {fs.closeSync(fd);} catch {}
  report.status = 'failed'; report.error = String(error.stack ?? error); save(); throw error;
}
