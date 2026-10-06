/** Dispatcher contract only. Synthetic worker output never enters production QA. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';

const folder = mkdtempSync(resolve(tmpdir(), 'r100-resume-contract-'));
const original = resolve(folder, 'original'); mkdirSync(original);
// Keep the external esbuild import resolvable while compiling this dispatcher
// once. Each validation probe then runs one directly killable Node process.
const driverFolder = mkdtempSync(resolve('node_modules', '.r100-resume-dispatch-'));
const dispatcher = resolve(driverFolder, 'dispatcher.mjs');
const calls = resolve(folder, 'worker-calls.jsonl');
const executor = resolve(original, 'qualification-fixture.mjs');
const bytes = `import { parentPort, workerData } from 'node:worker_threads';
import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(calls)}, JSON.stringify(workerData)+'\\n');
parentPort.postMessage({ok:true,value:{...workerData,attempts:1,signature:'synthetic-dispatch-fixture',geometry:'synthetic-dispatch-fixture'}});`;
writeFileSync(executor, bytes);
const sha = value => createHash('sha256').update(value).digest('hex');
const executorSha256 = sha(bytes);
writeFileSync(resolve(original, 'source-snapshot.json'), JSON.stringify({ sha256: executorSha256, dependencies: [] }));
const makeCase = (grade, seed) => ({ world: 'ash-strata', grade, seed, cohort: 'smoke' });
const passed = makeCase('low', 1), failed = makeCase('medium', 2), missing = makeCase('severe', 3);
writeFileSync(resolve(original, 'planned-cases.json'), JSON.stringify({ executorSha256, cases: [passed, failed, missing] }));
const priorCases = resolve(original, 'cases.jsonl');
const originalLog = [{ ...passed, ok: true, value: { ...passed, attempts: 1 }, durationMs: 1 },
  { ...failed, ok: false, error: 'Synthetic timeout fixture', durationMs: 60000 }].map(row => JSON.stringify(row)).join('\n') + '\n';
writeFileSync(priorCases, originalLog);
const baseline = { version: 1, executorSha256, expectedCases: 3, priorCases, cases: [failed, missing] };
function invoke(label, value, includeExecutor = true) {
  const at = resolve(folder, label); mkdirSync(at);
  const manifest = resolve(at, 'case-list.json'); writeFileSync(manifest, JSON.stringify(value));
  return { at, result: spawnSync(process.execPath, [dispatcher,
    '--case-list', manifest, ...(includeExecutor ? ['--executor', executor] : []),
    '--concurrency', '1', '--report', resolve(at, 'report.json')], { encoding: 'utf8', timeout: 20000 }) };
}
try {
  await build({ entryPoints: ['tools/world-study/check-r100-library.ts'], outfile: dispatcher, bundle: true,
    platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tools/contam-preview/tsconfig.json', external: ['esbuild'] });
  const invalid = [
    ['missing-executor', baseline, false],
    ['null-manifest', null],
    ['unknown-field', { ...baseline, fallbackSeed: 4 }],
    ['duplicate-case', { ...baseline, cases: [failed, missing, missing] }],
    ['successful-case', { ...baseline, cases: [passed, failed, missing] }],
    ['missing-failure', { ...baseline, cases: [missing] }],
    ['changed-seed', { ...baseline, cases: [{ ...failed, seed: 4 }, missing] }],
    ['changed-missing-seed', { ...baseline, cases: [failed, { ...missing, seed: 4 }] }],
    ['changed-cohort', { ...baseline, cases: [{ ...failed, cohort: 'boundary' }, missing] }],
    ['unknown-world', { ...baseline, cases: [{ ...failed, world: 'not-a-world' }, missing] }],
    ['changed-executor', { ...baseline, executorSha256: '0'.repeat(64) }],
  ];
  for (const [label, value, includeExecutor] of invalid) {
    const { result } = invoke(label, value, includeExecutor);
    assert.equal(result.error, undefined, `${label}: dispatcher must reject before a worker timeout`);
    assert.notEqual(result.status, 0, `${label}: invalid resume accepted`);
    assert.match(result.stderr, /AssertionError/, `${label}: expected manifest rejection, not an import/startup failure`);
    assert(!existsSync(calls), `${label}: invalid manifest scheduled a worker`);
  }
  const { at, result } = invoke('valid', baseline);
  assert.equal(result.error, undefined); assert.equal(result.status, 0, result.stderr);
  const aggregate = JSON.parse(readFileSync(resolve(at, 'aggregate.json'), 'utf8'));
  assert.equal(aggregate.status, 'pass'); assert.equal(aggregate.cases, 3); assert.equal(aggregate.successful, 3);
  assert.equal(aggregate.originalFailures.length, 1); assert.equal(aggregate.retries.length, 1);
  assert.deepEqual(readFileSync(calls, 'utf8').trim().split('\n').map(JSON.parse), [failed, missing]);
  assert.equal(readFileSync(priorCases, 'utf8'), originalLog, 'Original failure evidence is immutable');
  assert.equal(sha(readFileSync(resolve(at, 'qualification-' + executorSha256.slice(0, 12) + '.mjs'))), executorSha256);
  console.log('PASS resume dispatcher: 11 invalid manifests rejected without workers; exact failed/missing cases only; original failure and executor preserved. Synthetic dispatcher fixture, no world qualification.');
} finally {
  rmSync(folder, { recursive: true, force: true });
  rmSync(driverFolder, { recursive: true, force: true });
}
