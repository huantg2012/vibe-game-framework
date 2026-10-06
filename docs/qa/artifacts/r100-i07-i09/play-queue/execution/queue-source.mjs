/** Serial fixed-world coverage after the existing owned queues have closed.
 * --check validates a plan without starting browsers. --run freezes it and runs
 * each remaining batch once. --ready-prefix permits just the listed ready
 * batches while later sources are still pending; it never runs a pending batch.
 * Failures remain in their original output folders.
 * SIGINT/SIGTERM requests a stop between journeys, never a frozen field clock.
 * --self-check exercises preflight guards without starting a process/browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const WRAPPER = 'tools/qa/r100-i07-i09-coverage.mjs';
const HARNESS = 'tools/qa/r100-i07-i09-journey.mjs';
const V13_SHA = '6e2b8d76a7e03a08e7b774d2465954e51636f8ceb2467dfdc880702541e3587f';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const alive = pid => { try { process.kill(pid, 0); return true; } catch (error) { if (error.code === 'ESRCH') return false; throw error; } };

function validatePlan(plan, running) {
  assert.equal(plan.version, 1); assert.equal(plan.concurrency, 1);
  assert.equal(plan.resourcePauseFile, '/tmp/coh-r100-i07-i09-20261005.pause');
  assert.deepEqual(plan.grades, ['low', 'medium', 'severe']); assert.deepEqual(plan.seeds, [20261005, 3075192741]);
  assert(Array.isArray(plan.batches) && plan.batches.length > 0);
  assert(Array.isArray(plan.predecessors) && plan.predecessors.length > 0);
  assert(Number.isSafeInteger(plan.predecessorParentPid) && plan.predecessorParentPid > 1);
  const worlds = new Set(), outputs = new Set(), ids = new Set();
  for (const batch of plan.batches) {
    assert(typeof batch.id === 'string' && !ids.has(batch.id)); ids.add(batch.id);
    assert(typeof batch.output === 'string' && !outputs.has(batch.output)); outputs.add(batch.output);
    assert(batch.worlds.length > 0); assert.equal(typeof batch.manifest, 'string');
    assert.equal(new URL(batch.gameUrl).hostname, '127.0.0.1');
    for (const id of batch.worlds) { assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)); assert(!worlds.has(id), `Duplicate planned world: ${id}`); worlds.add(id); }
  }
  if (running) assert.deepEqual(plan.pendingBatches, [], 'Resolve the exact final frozen source and IDs before starting');
}
function validatePredecessor(policy, report) {
  assert.equal(report.status, 'completed-fixed-attempts-pending-review', 'Predecessor queue must have fully ended');
  assert.equal(report.attempts.length, policy.cases.length);
  assert.deepEqual(report.attempts.map(row => row.dir).sort(), policy.cases.map(row => row.dir).sort());
  assert(report.attempts.every(row => Number.isInteger(row.exitCode) && row.status !== 'running'), 'No predecessor child may still be running');
  // Exit1 remains an original failed attempt; qualification/rechecks are separate.
}
function environment(plan, batch) {
  const env = { ...process.env, GAME_URL: batch.gameUrl, QA_SOURCE_MANIFEST: batch.manifest, QA_OUTPUT_DIR: batch.output,
    QA_WORLDS: batch.worlds.join(','), QA_GRADES: plan.grades.join(','), QA_SEEDS: plan.seeds.join(','),
    QA_CONCURRENCY: '1', QA_RESOURCE_PAUSE_FILE: plan.resourcePauseFile, QA_ENTRY_WAIT: '600' };
  for (const key of ['QA_CONTROLLED_BUILD', 'QA_REPRO_IDENTITY_FILE', 'QA_REPLAY_INPUTS', 'QA_ORDINAL_START', 'QA_WORLD_ID', 'QA_SEED']) delete env[key];
  return env;
}
function checkSources(plan) {
  assert.equal(sha(HARNESS), V13_SHA, 'The fixed coverage policy13 must remain exact');
  for (const batch of plan.batches) {
    const source = read(batch.manifest); assert.equal(Number(new URL(batch.gameUrl).port), source.port);
    const file = path.join(source.temporaryRoot, 'src/generated/r100-native-worlds.ts');
    assert.equal(sha(file), source.sources['src/generated/r100-native-worlds.ts']);
    const text = fs.readFileSync(file, 'utf8'), catalog = JSON.parse(text.split('R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].trim().replace(/;$/, ''));
    assert(batch.worlds.every(id => catalog.some(world => world.id === id)), `${batch.id}: source must contain every planned identity`);
  }
}
function selfCheck() {
  const plan = { version: 1, concurrency: 1, resourcePauseFile: '/tmp/coh-r100-i07-i09-20261005.pause', grades: ['low', 'medium', 'severe'],
    seeds: [20261005, 3075192741], predecessorParentPid: 97333, predecessors: ['record'], pendingBatches: [],
    batches: [{ id: 'example', output: 'unused', worlds: ['ash-strata'], manifest: 'unused.json', gameUrl: 'http://127.0.0.1:3089' }] };
  validatePlan(plan, true);
  for (const patch of [{ concurrency: 2 }, { seeds: [1, 2] }, { pendingBatches: ['future-source'] }, { batches: [...plan.batches, { ...plan.batches[0], id: 'copy', output: 'another' }] }])
    assert.throws(() => validatePlan({ ...plan, ...patch }, true));
  const policy = { cases: [{ dir: 'one' }] }, report = { status: 'completed-fixed-attempts-pending-review', attempts: [{ dir: 'one', status: 'failed-script', exitCode: 1 }] };
  validatePredecessor(policy, report);
  assert.throws(() => validatePredecessor(policy, { ...report, status: 'running' }));
  assert.throws(() => validatePredecessor(policy, { ...report, attempts: [] }));
  assert.throws(() => validatePredecessor(policy, { ...report, attempts: [{ dir: 'one', status: 'running' }] }));
  const env = environment(plan, plan.batches[0]); assert.equal(env.QA_CONCURRENCY, '1'); assert.equal(env.QA_SEEDS, '20261005,3075192741');
  assert.equal(env.QA_CONTROLLED_BUILD, undefined); assert.equal(env.QA_REPLAY_INPUTS, undefined);
  console.log('PASS serial queue guards: fixed two seeds, one browser, no duplicate worlds, no pending source or running predecessor, failures retained');
}

if (process.argv.includes('--self-check')) selfCheck();
else {
  const value = name => { const at = process.argv.indexOf(name); assert(at >= 0 && process.argv[at + 1], `${name} required`); return process.argv[at + 1]; };
  const planFile = value('--plan'), plan = read(planFile), running = process.argv.includes('--run');
  const readyPrefix = process.argv.includes('--ready-prefix');
  assert(running || process.argv.includes('--check'), 'Choose --check or --run');
  validatePlan(plan, running && !readyPrefix); checkSources(plan);
  if (!running) console.log(JSON.stringify({ status: 'valid-plan-not-executed', readyBatches: plan.batches.length, pendingBatches: plan.pendingBatches,
    plannedReadyJourneys: plan.batches.reduce((sum, batch) => sum + batch.worlds.length * 6, 0) }));
  else {
    assert(!alive(plan.predecessorParentPid), 'Existing Python queue must exit before a new browser queue starts');
    for (const folder of plan.predecessors) validatePredecessor(read(path.join(folder, 'policy-freeze.json')), read(path.join(folder, 'batch-report.json')));
    for (const batch of plan.batches) assert(!fs.existsSync(batch.output), `Do not repeat an existing output: ${batch.output}`);
    const out = value('--output'); assert(!fs.existsSync(out), 'Never overwrite an earlier queue execution'); fs.mkdirSync(out, { recursive: true });
    fs.copyFileSync(planFile, path.join(out, 'plan.json'));
    fs.copyFileSync(new URL(import.meta.url), path.join(out, 'queue-source.mjs'));
    const fixed = [planFile, WRAPPER, HARNESS, ...plan.batches.map(batch => batch.manifest)].map(file => ({ file, sha256: sha(file) }));
    const report = { status: 'running', startedAt: new Date().toISOString(), fixedFiles: fixed, concurrency: 1,
      pendingLaterBatches: plan.pendingBatches, readyPrefix, attempts: [] };
    const save = () => fs.writeFileSync(path.join(out, 'execution.json'), JSON.stringify(report, null, 2) + '\n'); save();
    let stopping = false;
    const stop = signal => {
      stopping = true; report.stopRequested = { signal, at: new Date().toISOString(), method: 'Wait for active journey and its Chrome to close, then stop only the waiting scheduler.' };
      try { fs.writeFileSync(plan.resourcePauseFile, 'serial play queue stop requested\n', { flag: 'wx' }); report.createdPauseFile = true; }
      catch (error) { if (error.code !== 'EEXIST') { report.stopPauseError = String(error); } }
      save();
    };
    const onInt = () => stop('SIGINT'), onTerm = () => stop('SIGTERM');
    process.on('SIGINT', onInt); process.on('SIGTERM', onTerm);
    try {
      for (const batch of plan.batches) {
        if (stopping) break;
        for (const row of fixed) assert.equal(sha(row.file), row.sha256, `Frozen queue input changed: ${row.file}`);
        const row = { id: batch.id, output: batch.output, status: 'running', startedAt: new Date().toISOString() }; report.attempts.push(row); save();
        const fd = fs.openSync(path.join(out, `${batch.id}.log`), 'wx');
        await new Promise(resolve => {
          // Separate process group prevents a terminal interrupt from freezing a field journey.
          const child = spawn(process.execPath, [WRAPPER], { cwd: process.cwd(), env: environment(plan, batch), detached: true, stdio: ['ignore', fd, fd] });
          row.pid = child.pid; save();
          const timer = setInterval(() => {
            if (!stopping) return;
            try {
              const state = read(path.join(batch.output, 'batch-report.json'));
              if (state.resourceWait && state.attempts.every(attempt => attempt.status !== 'running')) child.kill('SIGTERM');
            } catch { /* Scheduler has not yet written its between-journey receipt. */ }
          }, 1000);
          child.once('error', error => { row.spawnError = String(error); });
          child.once('close', (code, signal) => { clearInterval(timer); fs.closeSync(fd); row.exitCode = code; row.signal = signal; resolve(); });
        });
        row.endedAt = new Date().toISOString(); row.status = row.exitCode === 0 ? 'completed-script' : 'failed-script'; save();
        if (!stopping) {
          validatePredecessor(read(path.join(batch.output, 'policy-freeze.json')), read(path.join(batch.output, 'batch-report.json')));
          assert.equal(row.exitCode, 0, `${batch.id}: retain failed batch and diagnose before scheduling another batch`);
        }
      }
      report.status = stopping ? 'stopped-between-journeys' : plan.pendingBatches.length
        ? 'completed-ready-prefix-later-batches-pending' : 'completed-fixed-batches-pending-qualification';
      if (stopping || report.attempts.some(row => row.exitCode !== 0)) process.exitCode = 1;
    } catch (error) { report.status = 'failed'; report.failure = String(error); process.exitCode = 1; }
    finally { process.off('SIGINT', onInt); process.off('SIGTERM', onTerm); report.endedAt = new Date().toISOString(); save(); }
  }
}
