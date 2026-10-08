/** One explicitly dispatched sampled lifecycle run; original harness bytes remain untouched. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = '/Users/yilungao/coh';
const BASE = 'docs/qa/artifacts/r100-i10-i12';
const PLAN = `${BASE}/sampling-amendment/lifecycle-execution-plan.json`;
const OUT = `${BASE}/lifecycle-sampled-final108`;
const AUDIT = `${BASE}/remaining-runtime-power-execution/lifecycle-sampled`;
const SELF = path.relative(ROOT, fileURLToPath(import.meta.url));
const exec = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => hash(fs.readFileSync(path.resolve(ROOT, file)));
const read = file => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
const ref = file => ({ path: file, sha256: sha(file) });
const now = () => new Date().toISOString();
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const write = (file, value, exclusive = true) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: exclusive ? 'wx' : 'w' });
const command = async (bin, args) => (await exec(bin, args, { cwd: ROOT, timeout: 30000, maxBuffer: 32 * 1024 * 1024 })).stdout;
const verifyRef = item => assert.equal(sha(item.path), item.sha256, `Frozen input changed: ${item.path}`);

assert.equal(process.cwd(), ROOT);
assert.deepEqual(process.argv.slice(2), ['--root-dispatch-lifecycle-sampled', '--exclusive-cpu-and-chrome']);
assert(!fs.existsSync(OUT) && !fs.existsSync(AUDIT), 'Preserve attempts: output and audit must both be absent');
const plan = read(PLAN);
assert.equal(plan.status, 'prepared-awaiting-root-stage-dispatch');
verifyRef(plan.operator);
assert.equal(plan.operator.path, SELF);
for (const item of [plan.samplingAmendment, plan.finalSource, plan.harness, ...plan.dependencies]) verifyRef(item);
const amendment = read(plan.samplingAmendment.path);
assert.equal(amendment.status, 'user-authorized-sampled-acceptance');
assert.deepEqual(plan.finalSource, amendment.finalSource);
assert.deepEqual(plan.harness, amendment.scopeChanges.lifecycle.harness);
const scope = amendment.scopeChanges.lifecycle;
assert.equal(scope.repetitions, 10); assert.equal(scope.mixedRebuilds, 18); assert.equal(scope.retainedSamples, 12);
assert.deepEqual(plan.argv, ['/usr/bin/caffeinate', '-i', '/usr/local/bin/node', plan.harness.path]);
assert.deepEqual(plan.envOverrides, {
  GAME_URL: 'http://127.0.0.1:3122/', QA_OUTPUT_DIR: path.resolve(ROOT, OUT),
  QA_REBUILDS: '10', QA_MIXED_REBUILDS: '18', QA_EXCLUSIVE_WINDOW: '1', NODE_OPTIONS: '', DEBUG: '',
});
const source = read(plan.finalSource.path);
assert.equal(source.port, 3122); assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
assert.equal(Object.keys(source.sources).length, 1397);
const helper = plan.dependencies.find(item => item.path === 'tools/qa/r100-i09-final-probe.mjs');
assert(helper);
const { verifyServedSourceFile } = await import(pathToFileURL(path.resolve(ROOT, helper.path)).href);

async function processes() {
  return (await command('ps', ['-Ao', 'pid=,ppid=,command='])).split('\n').flatMap(line => {
    const match = line.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), command: match[3] }] : [];
  });
}
function verifyFiles() {
  for (const [file, expected] of Object.entries(source.sources)) {
    assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
    assert.equal(sha(file), expected, `Working source changed: ${file}`);
    assert.equal(hash(fs.readFileSync(path.join(source.temporaryRoot, file))), expected, `Frozen source changed: ${file}`);
  }
  return { nodeWorkingDirectory: ROOT, frozenDirectory: source.temporaryRoot, files: 1397 };
}
async function verifyServed(phase) {
  const files = Object.keys(source.sources).filter(file => /^(src|data|public)\//.test(file));
  assert.equal(files.length, 1393);
  const hashes = {}; let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++], publicFile = file.startsWith('public/');
      const binary = /\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf|mp3|ogg|wav|wasm)$/i.test(file);
      const url = new URL(publicFile ? `/${file.slice(7)}` : binary ? `/${file}` : `/${file}?raw&import`, plan.envOverrides.GAME_URL);
      hashes[file] = (await verifyServedSourceFile({ file, expected: source.sources[file], url,
        literalModule: !publicFile && !binary, failureDirectory: `${OUT}/source-audit-failures/${phase}` })).sha256;
    }
  }));
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}
const initial = await processes();
assert(!initial.some(row => !row.command.startsWith('/bin/zsh -c') && (
  row.command.startsWith('/usr/bin/caffeinate ') || row.command.startsWith('caffeinate ')
  || row.command.includes('playwright_chromiumdev_profile-')
  || row.command.includes('node tools/qa/check-r100-')
  || row.command.includes('node tools/qa/r100-i09-final-probe.mjs'))), 'An existing QA process violates the exclusive stage');
const listener = await command('lsof', ['-nP', '-iTCP:3122', '-sTCP:LISTEN']);
assert(/\bnode\s+76518\b/.test(listener), 'The original frozen service is required');
fs.mkdirSync(OUT); fs.mkdirSync(AUDIT); fs.mkdirSync(`${AUDIT}/samples`);
const refs = [ref(PLAN), plan.samplingAmendment, plan.finalSource, plan.harness, plan.operator, ...plan.dependencies];
for (const item of refs) {
  const target = path.join(OUT, 'sources', item.path); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(item.path, target, fs.constants.COPYFILE_EXCL);
}
fs.writeFileSync(`${AUDIT}/listener-before.txt`, listener, { flag: 'wx' });
write(`${AUDIT}/processes-before.json`, { at: now(), operatorPid: process.pid,
  ancestors: initial.filter(row => [process.pid, process.ppid, 76518].includes(row.pid))
    .map(({ pid, ppid }) => ({ pid, ppid })), unrelatedArgvPersisted: false });
fs.writeFileSync(`${AUDIT}/assertions-before.txt`, await command('/usr/bin/pmset', ['-g', 'assertions']), { flag: 'wx' });
fs.writeFileSync(`${AUDIT}/power-log-before.txt`, await command('/usr/bin/pmset', ['-g', 'log']), { flag: 'wx' });
const startedAt = now(), problems = [], known = new Map(), profiles = new Set(), assertionOwners = new Set();
let child, closed = false, exitCode = null, exitSignal = null, samples = 0, abortSignal = null;
const actual = { identicalRebuilds: 0, mixedRebuilds: 0, retainedSamples: 0, reportSteps: 0 };
const binding = { version: 1, kind: 'lifecycle', validationMode: 'sampled', status: 'running', startedAt,
  gameUrl: plan.envOverrides.GAME_URL, expectedWorlds: 108, expectedRevision: 6,
  samplingAmendment: plan.samplingAmendment, finalSource: plan.finalSource, harness: plan.harness,
  wrapper: plan.operator, dependencies: plan.dependencies, executionPlan: ref(PLAN), worldIds: scope.catalogWorldIds,
  sampleScope: { repetitions: 10, mixedRebuilds: 18, warmupWorldIds: scope.warmupWorldIds,
    warmupCoverage: scope.warmupWorldIds.map(world => ({ world, grade: 'severe', seed: 20261004 })),
    mixedCoverage: scope.mixedCoverage, retainedSamples: 12, fullCatalogWorldCount: 108,
    limitation: scope.selectionReason },
  exclusiveCpuAndChromeDeclared: true, automaticRetry: false,
  beforeRuntimeVerified: false, afterRuntimeVerified: false, servedSourceVerified: false };
const save = () => write(`${OUT}/source-binding.json`, binding, false);
save();
write(`${AUDIT}/dispatch.json`, { status: 'root-dispatched-sampled-lifecycle-once', startedAt,
  operator: plan.operator, executionPlan: ref(PLAN), samplingAmendment: plan.samplingAmendment,
  argv: plan.argv, envOverrides: plan.envOverrides, removedEnvironmentKeys: ['PLAYWRIGHT_MODULE'],
  rootDispatch: 'Invoked only after the root explicitly grants this exact sampled stage its exclusive CPU/Chrome window.',
  exclusiveCpuAndChrome: true, automaticRetry: false });
function stop(signal) {
  abortSignal = signal;
  if (child && !closed) { try { process.kill(-child.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
}
process.on('SIGTERM', stop); process.on('SIGINT', stop);
async function samplePower() {
  const all = await processes(), owned = new Set([child.pid]);
  for (let n = 0; n < 20; n++) {
    const before = owned.size; for (const row of all) if (owned.has(row.ppid)) owned.add(row.pid);
    if (owned.size === before) break;
  }
  const rows = all.filter(row => owned.has(row.pid));
  for (const row of rows) {
    known.set(row.pid, row);
    const profile = row.command.match(/--user-data-dir=(\S*playwright_chromiumdev_profile-\S+)/)?.[1];
    if (profile) profiles.add(profile);
  }
  const assertions = await command('/usr/bin/pmset', ['-g', 'assertions']);
  const matched = [...assertions.matchAll(/^\s*pid (\d+)\(caffeinate\):.*\bPreventUserIdleSystemSleep\b.*$/gm)]
    .map(match => Number(match[1])).filter(pid => owned.has(pid));
  matched.forEach(pid => assertionOwners.add(pid)); samples++;
  const name = String(samples).padStart(4, '0');
  write(`${AUDIT}/samples/${name}.json`, { at: now(), launchPid: child.pid, processes: rows, ownedIdleSleepAssertionPids: matched });
  fs.writeFileSync(`${AUDIT}/samples/${name}-assertions.txt`, assertions, { flag: 'wx' });
  if (!closed && Date.now() - Date.parse(binding.measurementStartedAt) > 5000) assert(matched.length, 'Scoped idle-sleep assertion missing');
}
try {
  binding.beforeFiles = verifyFiles(); binding.beforeServedHashes = await verifyServed('before');
  binding.beforeRuntimeVerified = true; save();
  const log = fs.openSync(`${OUT}/runner.log`, 'wx');
  const env = { ...process.env, ...plan.envOverrides }; delete env.PLAYWRIGHT_MODULE;
  binding.measurementStartedAt = now();
  child = spawn(plan.argv[0], plan.argv.slice(1), { cwd: ROOT, env, detached: true, stdio: ['ignore', log, log] });
  child.once('error', error => problems.push({ phase: 'spawn', error: String(error) }));
  child.once('close', (code, signal) => { closed = true; exitCode = code; exitSignal = signal; fs.closeSync(log); });
  write(`${AUDIT}/launch.json`, { at: now(), pid: child.pid, operatorPid: process.pid, argv: plan.argv });
  console.log(JSON.stringify({ status: 'launched-sampled-lifecycle', pid: child.pid, operatorPid: process.pid, at: now() }));
  let nextSample = 0;
  while (!closed) {
    if (abortSignal) throw new Error(`Operator interrupted by ${abortSignal}`);
    if (Date.now() >= nextSample) { await samplePower(); nextSample = Date.now() + (profiles.size ? 30000 : 1000); }
    await delay(200);
  }
} catch (error) { problems.push({ phase: 'measurement-or-before-source', error: String(error.stack ?? error) }); }
finally {
  if (child && !closed) {
    stop(abortSignal ?? 'failure-cleanup');
    for (let n = 0; n < 50 && !closed; n++) await delay(200);
    if (!closed) { try { process.kill(-child.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    for (let n = 0; n < 25 && !closed; n++) await delay(200);
  }
  binding.measurementEndedAt = now(); binding.exitCode = exitCode; binding.signal = exitSignal;
  let remaining = [], remainingAssertions = [], assertions = '';
  for (let n = 0; n < 50; n++) {
    remaining = (await processes()).filter(row => known.get(row.pid)?.command === row.command
      || [...profiles].some(profile => row.command.startsWith('/Applications/Google Chrome') && row.command.includes(profile)));
    assertions = await command('/usr/bin/pmset', ['-g', 'assertions']);
    remainingAssertions = [...assertionOwners].filter(pid => new RegExp(`^\\s*pid ${pid}\\(caffeinate\\):.*\\bPreventUserIdleSystemSleep\\b`, 'm').test(assertions));
    if (!remaining.length && !remainingAssertions.length) break;
    await delay(200);
  }
  if (remaining.length) {
    problems.push({ phase: 'cleanup', error: 'Owned resources required explicit termination', pids: remaining.map(row => row.pid) });
    for (const row of remaining) { try { process.kill(row.pid, 'SIGTERM'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    await delay(1000);
    remaining = (await processes()).filter(row => known.get(row.pid)?.command === row.command
      || [...profiles].some(profile => row.command.startsWith('/Applications/Google Chrome') && row.command.includes(profile)));
    for (const row of remaining) { try { process.kill(row.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; } }
    if (remaining.length) await delay(500);
    remaining = (await processes()).filter(row => known.get(row.pid)?.command === row.command
      || [...profiles].some(profile => row.command.startsWith('/Applications/Google Chrome') && row.command.includes(profile)));
    assertions = await command('/usr/bin/pmset', ['-g', 'assertions']);
    remainingAssertions = [...assertionOwners].filter(pid => new RegExp(`^\\s*pid ${pid}\\(caffeinate\\):.*\\bPreventUserIdleSystemSleep\\b`, 'm').test(assertions));
  }
  write(`${AUDIT}/processes-after.json`, { at: now(), ownedAlive: remaining, remainingOwnedAssertions: remainingAssertions });
  fs.writeFileSync(`${AUDIT}/assertions-after.txt`, assertions, { flag: 'wx' });
  if (remaining.length || remainingAssertions.length) problems.push({ phase: 'cleanup', error: 'Owned resources remain' });
  if (child && !assertionOwners.size) problems.push({ phase: 'power', error: 'Scoped assertion was never observed' });
  const endedAt = now(), power = await command('/usr/bin/pmset', ['-g', 'log']);
  fs.writeFileSync(`${AUDIT}/power-log-after.txt`, power, { flag: 'wx' });
  const window = power.split('\n').filter(line => {
    const m = line.match(/^(\d{4}-\d\d-\d\d) (\d\d:\d\d:\d\d) ([+-]\d{4})\s+(\S+)/);
    if (!m) return false;
    const at = Date.parse(`${m[1]}T${m[2]}${m[3]}`);
    return at >= Math.floor(Date.parse(startedAt) / 1000) * 1000 && at <= Date.parse(endedAt);
  });
  fs.writeFileSync(`${AUDIT}/power-log-execution-window.txt`, window.join('\n') + '\n', { flag: 'wx' });
  const sleeps = window.filter(line => /^\S+ \S+ \S+\s+Sleep\b/.test(line));
  if (sleeps.length) problems.push({ phase: 'power', error: 'System Sleep during run', events: sleeps });
  // All whole-source checks run outside the measured browser interval.
  try {
    assert.equal(remaining.length, 0, 'Do not run whole-source checks while an owned runtime remains');
    binding.afterFiles = verifyFiles(); binding.afterRuntimeVerified = true;
    binding.afterServedHashes = await verifyServed('after');
    assert.deepEqual(binding.afterServedHashes, binding.beforeServedHashes); binding.servedSourceVerified = true;
    refs.forEach(verifyRef);
  } catch (error) { problems.push({ phase: 'after-source', error: String(error.stack ?? error) }); }
  try {
    binding.report = ref(`${OUT}/report.json`); const report = read(binding.report.path);
    actual.identicalRebuilds = (report.rebuildProgress ?? []).filter(row => row.phase === 'identical' && row.status === 'completed').length;
    actual.mixedRebuilds = (report.mixedCoverage ?? []).length;
    actual.retainedSamples = (report.samples ?? []).length;
    actual.reportSteps = (report.rebuildProgress ?? []).length;
    assert.equal(exitCode, 0); assert.equal(exitSignal, null);
    assert.equal(report.status, 'passed-bounded-lifecycle'); assert.deepEqual(report.errors, []);
    assert.deepEqual(report.catalogWorldIds, scope.catalogWorldIds);
    assert.equal(report.repetitions, 10); assert.equal(report.mixedRebuilds, 18);
    assert.deepEqual(report.mixedCoverage, scope.mixedCoverage);
    assert.deepEqual(report.samples.map(row => row.label), ['warmed-baseline',
      ...Array.from({ length: 10 }, (_, n) => `identical-${n + 1}`), 'after-mixed-18']);
    assert.equal(report.rebuildProgress.length, 37);
    assert(report.rebuildProgress.every(row => row.status === 'completed'));
    assert.deepEqual(report.rebuildProgress.filter(row => row.phase === 'warmup')
      .map(({ world, grade, seed }) => ({ world, grade, seed })), binding.sampleScope.warmupCoverage);
    binding.originalHarnessPassed = true;
    binding.independentResourceAndShaderReview = 'pending-separate-QA-receipt';
  } catch (error) { problems.push({ phase: 'sampled-report', error: String(error.stack ?? error) }); }
  binding.status = problems.length ? 'failed' : 'pass-sampled'; binding.endedAt = now(); binding.problems = problems; save();
  const receipt = { status: problems.length ? 'failed-preserved-no-retry' : 'pass-sampled-lifecycle',
    startedAt, endedAt: binding.endedAt, operator: plan.operator, executionPlan: ref(PLAN), samplingAmendment: plan.samplingAmendment,
    sourceBinding: ref(`${OUT}/source-binding.json`), report: binding.report, exitCode, signal: exitSignal,
    powerSamples: samples, ownedIdleAssertionPids: [...assertionOwners], noSystemSleep: !sleeps.length,
    ownedProcessesClosed: !remaining.length, ownedAssertionsReleased: !remainingAssertions.length,
    actualIdenticalRebuilds: actual.identicalRebuilds, actualMixedRebuilds: actual.mixedRebuilds,
    retainedSamples: actual.retainedSamples, reportSteps: actual.reportSteps,
    countMeaning: 'Configured identical/mixed operations; 37 original report steps include setup, warmups, baseline and return. No exact internal scene-construction count is asserted.',
    full334Claimed: false, automaticRetry: false, problems,
    nextStage: 'Stop; root and QA independently review the actual sampled report and Shader evidence.' };
  write(`${AUDIT}/execution.json`, receipt);
  console.log(JSON.stringify({ status: receipt.status, receipt: ref(`${AUDIT}/execution.json`), problems }));
  process.exitCode = problems.length ? 1 : 0;
}
