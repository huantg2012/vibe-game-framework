/** Freeze and run one final52 probe. Source audits happen outside its measured
 * browser interval. No game state, world seed or probe outcome is rewritten.
 * --probe production|equivalence|budget|lifecycle --source <manifest> --output <new folder>
 * GAME_URL is required; budget also requires QA_EXCLUSIVE_WINDOW=1.
 * --self-check verifies receipt scope guards without starting a browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROBES = {
  production: { harness: 'tools/qa/check-r100-production-browser.mjs', report: 'report.json' },
  equivalence: { harness: 'tools/world-study/check-r100-browser-equivalence.mjs', report: 'browser-equivalence.json' },
  budget: { harness: 'tools/qa/check-r100-runtime-budget.mjs', report: 'report.json' },
  lifecycle: { harness: 'tools/qa/check-r100-gym-lifecycle.mjs', report: 'report.json' },
};
const GOLD = 'tools/recovery/fixtures/r100-revision1-gold.json';
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => hashBytes(fs.readFileSync(path.resolve(ROOT, file)));
const read = file => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
const relative = file => path.relative(ROOT, path.resolve(ROOT, file));
const receipt = file => ({ path: relative(file), sha256: sha(file) });
const sorted = values => [...values].sort();
const grades = ['low', 'medium', 'severe'];
const WORKER_OBSERVER = 'tools/qa/r100-worker-observer.mjs';

export function finalProbeLaunchOptions(kind, revision, argv, inherited, out) {
  const stopOnFailure = argv.includes('--stop-on-failure'), observeWorkers = argv.includes('--observe-workers');
  assert(!(stopOnFailure || observeWorkers) || (kind === 'production' && revision === 6),
    'Explicit failure/Worker observation options are for revision6 production coverage only');
  assert(!observeWorkers || stopOnFailure, 'Worker observation requires failure-stop coverage');
  assert(!observeWorkers || !inherited.NODE_OPTIONS, 'Use the tracked observer preload, without untracked NODE_OPTIONS');
  const env = { ...inherited };
  // Historical callers retain their default continuation policy. An explicit
  // request is applied after sanitization so it cannot be silently discarded.
  delete env.QA_STOP_ON_FAILURE;
  delete env.QA_WORKER_OBSERVER_DIR;
  delete env.QA_WORKER_OBSERVER_FAILURE_FILE;
  if (stopOnFailure) env.QA_STOP_ON_FAILURE = '1';
  if (observeWorkers) {
    env.QA_WORKER_OBSERVER_DIR = path.join(out, 'worker-observations');
    env.QA_WORKER_OBSERVER_FAILURE_FILE = path.join(out, 'worker-observation-first-error.json');
  }
  return { stopOnFailure, observeWorkers, env,
    preload: observeWorkers ? ['--import', path.join(ROOT, WORKER_OBSERVER)] : [] };
}

export function summarizeWorkerEvents(events, expectedContexts) {
  const counts = {}, issues = [], created = new Set(), closed = new Set(), workerContexts = new Set(), summaries = new Map();
  const key = row => `${row.pid}/${row.browserId}/${row.contextId}/${row.workerId}`;
  for (const row of events) {
    counts[row.event] = (counts[row.event] ?? 0) + 1;
    if (row.event === 'worker-created') {
      assert(!created.has(key(row)), 'Duplicate Worker creation'); created.add(key(row));
      workerContexts.add(`${row.pid}/${row.browserId}/${row.contextId}`);
    }
    if (row.event === 'worker-closed') { assert(!closed.has(key(row)), 'Duplicate Worker close'); closed.add(key(row)); }
    if (row.event === 'network-summary' && row.reason === 'context-closed') summaries.set(`${row.pid}/${row.browserId}/${row.contextId}`, row);
    if (['requestfailed', 'http-error', 'pageerror', 'page-crash', 'Target.targetCrashed'].includes(row.event)
      || row.event === 'console' && row.type === 'error') issues.push(row);
  }
  if (counts['preload-ready'] !== 1 || counts.launch !== 1 || counts['browser-disconnected'] !== 1)
    issues.push({ issue: 'Expected exactly one observed production browser lifecycle' });
  if (counts['context-created'] !== expectedContexts || counts['context-closed'] !== expectedContexts || summaries.size !== expectedContexts)
    issues.push({ issue: 'Incomplete observed context coverage', expectedContexts, actual: counts['context-created'] ?? 0 });
  if (!created.size || !closed.size || JSON.stringify(sorted(created)) !== JSON.stringify(sorted(closed)))
    issues.push({ issue: 'Incomplete Worker lifecycle pairing' });
  for (const [context, summary] of summaries) {
    if (!summary.requests || !summary.responses || !summary.urls.length)
      issues.push({ issue: 'Missing network observation', contextId: summary.contextId });
    if (!workerContexts.has(context)) issues.push({ issue: 'Context has no Worker observation', contextId: summary.contextId });
  }
  return { status: issues.length ? 'failed' : 'pass-observed-events', expectedContexts, counts, issues,
    limitation: 'External observed events only. Absence of an event cannot establish a browser-internal cause or eliminate the earlier intermittent failure.' };
}

export function validateFinalReport(kind, report, ids, gold, revision = 5) {
  assert([5, 6].includes(revision), 'Unsupported expected revision');
  const expected = sorted(ids.flatMap(world => grades.map(grade => `${world}/${grade}`)));
  if (kind === 'production') {
    assert.equal(report.status, 'passed');
    assert.deepEqual(sorted(report.cases.map(row => `${row.world}/${row.grade}`)), expected);
    for (const row of report.cases) {
      assert.equal(row.status, 'passed'); assert.deepEqual(row.errors, []);
      assert.equal(row.coldIdentityPreserved, true); assert.equal(row.worldHistoryPreserved, true);
      assert.deepEqual(row.historyBeforeDeparture, { version: 1, visits: [] });
      assert.deepEqual(row.committedWorldHistory, { version: 1, visits: [{ worldId: row.world, grade: row.grade }] });
      assert.deepEqual(row.bodyGeometry, { version: 1, fullBodyCheckpointAdmitted: true, coldBodyPositionPreserved: true });
      assert.equal(row.identity.generation.package.id, `r100-${row.world}`);
      assert.equal(row.identity.generation.package.grade, row.grade);
      assert.equal(row.identity.generation.package.algorithmRevision, revision);
      assert.equal(row.identity.generation.requestedSeed, row.controlledSeed);
    }
  } else if (kind === 'equivalence') {
    assert.equal(report.status, 'pass'); assert.equal(report.results.length, ids.length * 3 + gold.length);
    const current = report.results.filter(row => row.revision === revision), old = report.results.filter(row => row.revision === 1);
    assert.deepEqual(sorted(current.map(row => `${row.world.replace(/^r100-/, '')}/${row.grade}`)), expected);
    assert.deepEqual(sorted(old.map(row => `${row.world}/${row.grade}/${row.seed}/${row.expected}`)),
      sorted(gold.map(row => `${row.generation.package.id}/${row.generation.package.grade}/${row.seed}/${row.signature}`)));
    for (const row of report.results) {
      assert.equal(row.exactIdentity, true); assert.equal(row.actual, row.expected);
      if (row.revision === revision) assert.equal(row.requestedSeed, 20261004);
    }
  } else if (kind === 'budget') {
    assert.equal(report.status, 'passed-reference-samples'); assert.equal(report.exclusiveWindow, true);
    assert.deepEqual(sorted(report.worlds), sorted(ids)); assert.deepEqual(sorted(report.cases.map(row => row.world)), sorted(ids));
    assert.deepEqual(report.errors, []);
    for (const row of report.cases) {
      assert.equal(row.grade, 'severe'); assert.equal(row.fullAliveDuration, true);
      assert(row.duration >= 60000); assert.equal(row.budgetPass, true);
    }
  } else if (kind === 'lifecycle') {
    assert.equal(report.status, 'passed-bounded-lifecycle'); assert.deepEqual(report.errors, []);
    assert.deepEqual(sorted(report.catalogWorldIds), sorted(ids)); assert.equal(report.repetitions, 10);
    assert.equal(report.mixedRebuilds, ids.length * 3);
    assert.deepEqual(sorted(report.mixedCoverage.map(row => `${row.world}/${row.grade}`)), expected);
  } else assert.fail(`Unknown probe ${kind}`);
  if (kind === 'production' || kind === 'equivalence')
    assert(Object.keys(report.loadedSourceHashes ?? {}).length > 0, 'Probe must record actual served module URLs');
}

function verifyFiles(source) {
  assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
  assert(Object.keys(source.sources).length > 0);
  for (const [file, expected] of Object.entries(source.sources)) {
    assert(!path.isAbsolute(file) && !file.split('/').includes('..'), `Invalid source path: ${file}`);
    assert.equal(sha(file), expected, `Node working source changed: ${file}`);
    assert.equal(sha(path.join(source.temporaryRoot, file)), expected, `Frozen source changed: ${file}`);
  }
  return { nodeWorkingDirectory: ROOT, frozenDirectory: source.temporaryRoot, files: Object.keys(source.sources).length };
}
export function rawModuleBytes(bytes) {
  const source = ts.createSourceFile('raw-module.js', bytes.toString('utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.equal(source.parseDiagnostics.length, 0, 'Invalid raw module syntax');
  assert.equal(source.statements.length, 1, 'Raw module must have exactly one export default');
  const assignment = source.statements[0];
  assert(ts.isExportAssignment(assignment) && !assignment.isExportEquals, 'Raw module must export default');
  assert(ts.isStringLiteral(assignment.expression) || ts.isNoSubstitutionTemplateLiteral(assignment.expression),
    'Raw module must export a literal string without interpolation or execution');
  return Buffer.from(assignment.expression.text, 'utf8');
}
export function exactRawSource(bytes, expected) {
  // Some Vite responses contain the original file directly. Exact bytes also
  // disambiguate a source file whose own content is an export-default string.
  const directHash = hashBytes(bytes);
  if (directHash === expected) return { sha256: directHash, encoding: 'direct-raw' };
  const decodedHash = hashBytes(rawModuleBytes(bytes));
  assert.equal(decodedHash, expected, 'Wrong decoded source bytes');
  return { sha256: decodedHash, encoding: 'literal-module' };
}
export async function verifyServedSourceFile({ file, expected, url, literalModule = true, failureDirectory }) {
  let response, bytes;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(30000) });
    bytes = Buffer.from(await response.arrayBuffer());
    assert(response.ok, `HTTP ${response.status}`);
    if (literalModule) return exactRawSource(bytes, expected);
    const actual = hashBytes(bytes);
    assert.equal(actual, expected, 'Wrong direct source bytes');
    return { sha256: actual, encoding: 'direct-raw' };
  } catch (error) {
    if (failureDirectory) {
      const name = hashBytes(Buffer.from(`${file}\n${url}`));
      fs.mkdirSync(failureDirectory, { recursive: true });
      const body = bytes && path.join(failureDirectory, `${name}.body`);
      if (body) fs.writeFileSync(body, bytes);
      fs.writeFileSync(path.join(failureDirectory, `${name}.json`), JSON.stringify({ file, url: String(url),
        expected, httpStatus: response?.status, headers: response && Object.fromEntries(response.headers),
        body, bodySha256: bytes && hashBytes(bytes), failure: String(error) }, null, 2) + '\n');
    }
    throw new Error(`${file} (${url}): ${error}`);
  }
}
async function verifyServed(source, gameUrl, failureDirectory) {
  const hashes = {};
  // Vite transforms HTML entry files even with ?raw; their disk bytes are
  // checked above. Verify all runtime/data/public bytes over HTTP separately.
  const files = Object.keys(source.sources).filter(file => /^(src|data|public)\//.test(file));
  let cursor = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < files.length) {
      const file = files[cursor++], isPublic = file.startsWith('public/');
      const binary = /\.(?:png|jpe?g|webp|gif|ico|woff2?|ttf|mp3|ogg|wav|wasm)$/i.test(file);
      const url = new URL(isPublic ? `/${file.slice(7)}` : binary ? `/${file}` : `/${file}?raw&import`, gameUrl);
      hashes[file] = (await verifyServedSourceFile({ file, expected: source.sources[file], url,
        literalModule: !isPublic && !binary, failureDirectory })).sha256;
    }
  }));
  return Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => a.localeCompare(b)));
}

async function selfCheck() {
  const historicalLaunch = finalProbeLaunchOptions('production', 5, [], { QA_STOP_ON_FAILURE: '1' }, '/unused');
  assert.equal(historicalLaunch.env.QA_STOP_ON_FAILURE, undefined); assert.deepEqual(historicalLaunch.preload, []);
  const observedLaunch = finalProbeLaunchOptions('production', 6, ['--stop-on-failure', '--observe-workers'], {}, '/unused');
  assert.equal(observedLaunch.env.QA_STOP_ON_FAILURE, '1'); assert.equal(observedLaunch.env.QA_WORKER_OBSERVER_DIR, '/unused/worker-observations');
  assert.equal(observedLaunch.env.QA_WORKER_OBSERVER_FAILURE_FILE, '/unused/worker-observation-first-error.json');
  assert.equal(finalProbeLaunchOptions('production', 5, [], { QA_WORKER_OBSERVER_FAILURE_FILE: '/stale' }, '/unused').env.QA_WORKER_OBSERVER_FAILURE_FILE, undefined);
  assert.deepEqual(observedLaunch.preload, ['--import', path.join(ROOT, WORKER_OBSERVER)]);
  for (const [kind, revision, args, env] of [
    ['production', 5, ['--stop-on-failure'], {}], ['budget', 6, ['--observe-workers', '--stop-on-failure'], {}],
    ['production', 6, ['--observe-workers'], {}], ['production', 6, ['--observe-workers', '--stop-on-failure'], { NODE_OPTIONS: '--import untracked.mjs' }],
  ]) assert.throws(() => finalProbeLaunchOptions(kind, revision, args, env, '/unused'));
  const event = (name, extra = {}) => ({ event: name, pid: 1, browserId: 1, contextId: 1, ...extra });
  const observed = [event('preload-ready'), event('launch'), event('context-created'),
    event('worker-created', { workerId: 1 }), event('worker-closed', { workerId: 1 }),
    event('network-summary', { reason: 'context-closed', requests: 3, responses: 3, urls: [1, 2] }),
    event('context-closed'), event('browser-disconnected')];
  assert.equal(summarizeWorkerEvents(observed, 1).status, 'pass-observed-events');
  assert.equal(summarizeWorkerEvents(observed, 2).status, 'failed');
  assert.equal(summarizeWorkerEvents(observed.filter(row => row.event !== 'worker-closed'), 1).status, 'failed');
  assert.equal(summarizeWorkerEvents(observed.filter(row => row.event !== 'preload-ready'), 1).status, 'failed');
  for (const failure of ['requestfailed', 'http-error', 'pageerror', 'page-crash', 'Target.targetCrashed', 'console'])
    assert.equal(summarizeWorkerEvents([...observed, event(failure, { type: 'error' })], 1).status, 'failed');
  const ids = ['one'], rows = grades.map(grade => ({ world: 'one', grade, status: 'passed', errors: [],
    coldIdentityPreserved: true, worldHistoryPreserved: true, historyBeforeDeparture: { version: 1, visits: [] },
    committedWorldHistory: { version: 1, visits: [{ worldId: 'one', grade }] },
    bodyGeometry: { version: 1, fullBodyCheckpointAdmitted: true, coldBodyPositionPreserved: true }, controlledSeed: 1,
    identity: { generation: { requestedSeed: 1, package: { id: 'r100-one', grade, algorithmRevision: 5 } } } }));
  const production = { status: 'passed', cases: rows, loadedSourceHashes: { source: 'hash' } };
  validateFinalReport('production', production, ids, []);
  for (const mutate of [x => x.cases.push(x.cases[0]), x => x.cases.pop(), x => x.cases[0].worldHistoryPreserved = false,
    x => x.cases[0].committedWorldHistory.visits.push({ worldId: 'one', grade: 'low' }), x => x.cases[0].identity.generation.package.algorithmRevision = 4,
    x => x.loadedSourceHashes = {}]) {
    const value = structuredClone(production); mutate(value); assert.throws(() => validateFinalReport('production', value, ids, []));
  }
  const equivalent = { status: 'pass', loadedSourceHashes: { source: 'hash' }, results: grades.map(grade => ({ world: 'r100-one', grade, revision: 5,
    seed: 20261004, requestedSeed: 20261004, exactIdentity: true, expected: 'signature', actual: 'signature' })) };
  validateFinalReport('equivalence', equivalent, ids, []);
  const revision6Production = structuredClone(production);
  for (const row of revision6Production.cases) row.identity.generation.package.algorithmRevision = 6;
  validateFinalReport('production', revision6Production, ids, [], 6);
  assert.throws(() => validateFinalReport('production', revision6Production, ids, [], 5));
  const revision6Equivalent = structuredClone(equivalent);
  for (const row of revision6Equivalent.results) row.revision = 6;
  validateFinalReport('equivalence', revision6Equivalent, ids, [], 6);
  assert.throws(() => validateFinalReport('equivalence', revision6Equivalent, ids, [], 5));
  assert.throws(() => validateFinalReport('production', revision6Production, ids, [], 7));
  for (const mutate of [x => x.results[1] = x.results[0], x => x.results[0].requestedSeed++, x => x.results[0].actual = 'changed']) {
    const value = structuredClone(equivalent); mutate(value); assert.throws(() => validateFinalReport('equivalence', value, ids, []));
  }
  const templateModule = value => 'export default `' + value.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${').replaceAll('\r', '\\r') + '`;';
  const literal = 'backtick ` / backslash \\ / ${literal text} / 雪\nsecond line\r\nthird line';
  for (const module of ['export default ' + JSON.stringify(literal) + ';', templateModule(literal)])
    assert.equal(rawModuleBytes(Buffer.from(module)).toString('utf8'), literal);
  for (const module of ['export default `prefix ${globalThis.doNotExecute()} suffix`;',
    'export default String("text");', 'globalThis.doNotExecute(); export default "text";',
    'export default "text"; globalThis.doNotExecute();', 'export default "one"; export default "two";',
    'export { value as default };', 'export default ("text");', 'export default `unterminated'])
    assert.throws(() => rawModuleBytes(Buffer.from(module)), /Raw module|Invalid raw module/);
  for (const value of ['export const value: number = 1;\n', 'id,value\na,1\n', 'export default "original source";']) {
    const bytes = Buffer.from(value), expected = hashBytes(bytes);
    assert.deepEqual(exactRawSource(bytes, expected), { sha256: expected, encoding: 'direct-raw' });
    assert.deepEqual(exactRawSource(Buffer.from(templateModule(value)), expected), { sha256: expected, encoding: 'literal-module' });
    assert.throws(() => exactRawSource(Buffer.from(value + '\n'), expected));
    assert.throws(() => exactRawSource(Buffer.from('export default ' + JSON.stringify(value) + '; globalThis.doNotExecute();'), expected));
  }
  const fixture = { 'src/example.ts': Buffer.from('export const value = 1;\n'), 'src/example.png': Buffer.from([137, 80, 78, 71, 128, 255]), 'data/example.csv': Buffer.from('id,value\na,1\n'),
    'src/direct.ts': Buffer.from('export const direct: number = 2;\n'), 'data/direct.csv': Buffer.from('id,value\nb,2\n'),
    'src/literal-source.ts': Buffer.from('export default "original source";'),
    'public/example.bin': Buffer.from([0, 1, 128, 255]) };
  const source = { sources: Object.fromEntries(Object.entries(fixture).map(([file, bytes]) => [file, hashBytes(bytes)])) };
  const server = createServer((request, response) => {
    const file = new URL(request.url, 'http://localhost').pathname.slice(1);
    const value = fixture[file] ?? fixture[`public/${file}`];
    if (!value) { response.writeHead(404).end(); return; }
    response.end(file === 'src/example.ts' ? `export default ${JSON.stringify(value.toString('utf8'))};`
      : file === 'data/example.csv' ? templateModule(value.toString('utf8')) : value);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const failureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'r100-raw-check-'));
  try {
    const url = `http://127.0.0.1:${server.address().port}`;
    assert.deepEqual(await verifyServed(source, url), Object.fromEntries(Object.entries(source.sources).sort(([a], [b]) => a.localeCompare(b))));
    await assert.rejects(() => verifyServed({ sources: { 'src/example.ts': 'wrong-hash' } }, url), /Wrong decoded source/);
    await assert.rejects(() => verifyServed({ sources: { 'src/missing.ts': 'missing' } }, url), /HTTP 404/);
    await assert.rejects(() => verifyServedSourceFile({ file: 'src/direct.ts', expected: 'wrong',
      url: new URL('/src/direct.ts?raw&import', url), failureDirectory }), /src\/direct.ts.*Raw module/);
    const failure = JSON.parse(fs.readFileSync(path.join(failureDirectory, fs.readdirSync(failureDirectory).find(file => file.endsWith('.json'))), 'utf8'));
    assert.equal(failure.file, 'src/direct.ts'); assert.equal(failure.httpStatus, 200);
    assert.equal(failure.url, `${url}/src/direct.ts?raw&import`);
    assert.deepEqual(fs.readFileSync(failure.body), fixture['src/direct.ts']);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(failureDirectory, { recursive: true }); }
  console.log('PASS final probe: explicit revision6 failure-stop/observed preload and unchanged historical default; incomplete/error observations rejected; unique scope, exact revisions/seeds, one committed history, cold preservation, exact direct bytes/literal wrapper decoding and rejected HTTP/source mismatches');
}

async function main() {
  if (process.argv.includes('--self-check')) { await selfCheck(); return; }
  const arg = name => { const at = process.argv.indexOf(name); assert(at >= 0 && process.argv[at + 1], `${name} required`); return process.argv[at + 1]; };
  const optional = (name, fallback) => process.argv.includes(name) ? arg(name) : fallback;
  const expectedWorlds = Number(optional('--expected-worlds', '52'));
  const revision = Number(optional('--expected-revision', '5'));
  assert([52, 72, 92, 108].includes(expectedWorlds) && [5, 6].includes(revision), 'Unsupported final scope');
  const kind = arg('--probe'), config = PROBES[kind]; assert(config, 'Known probe required');
  const manifest = arg('--source'), out = path.resolve(ROOT, arg('--output')), gameUrl = process.env.GAME_URL;
  const launchOptions = finalProbeLaunchOptions(kind, revision, process.argv, process.env, out);
  assert(gameUrl, 'GAME_URL required'); assert(!fs.existsSync(out), 'Keep original attempts; choose a new output folder');
  const source = read(manifest), url = new URL(gameUrl);
  assert.equal(url.hostname, '127.0.0.1'); assert.equal(Number(url.port), source.port);
  const catalogSource = fs.readFileSync(path.resolve(ROOT, 'src/generated/r100-native-worlds.ts'), 'utf8');
  const catalog = JSON.parse(catalogSource.split('R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].trim().replace(/;$/, ''));
  const ids = catalog.filter(row => row.enabled).map(row => row.id);
  assert.equal(ids.length, expectedWorlds); assert.equal(new Set(ids).size, expectedWorlds); assert.equal(catalog.length, expectedWorlds);
  if (kind === 'budget') assert.equal(process.env.QA_EXCLUSIVE_WINDOW, '1', 'Only measure in the agreed exclusive window');
  fs.mkdirSync(out, { recursive: true });
  const binding = { version: 1, kind, expectedWorlds, expectedRevision: revision, status: 'running', startedAt: new Date().toISOString(), gameUrl,
    finalSource: receipt(manifest), harness: receipt(config.harness), wrapper: receipt(fileURLToPath(import.meta.url)),
    dependencies: [GOLD, 'tools/contam-preview/tsconfig.json', 'package-lock.json', ...(launchOptions.observeWorkers ? [WORKER_OBSERVER] : [])].map(receipt), worldIds: ids, beforeRuntimeVerified: false,
    afterRuntimeVerified: false, servedSourceVerified: false };
  if (launchOptions.stopOnFailure || launchOptions.observeWorkers) binding.probeOptions = {
    stopOnFailure: launchOptions.stopOnFailure, observeWorkers: launchOptions.observeWorkers,
    successfulTraffic: 'Exact URL catalogue plus per-context counts; all failure and Worker lifecycle events retained individually',
  };
  const save = () => fs.writeFileSync(path.join(out, 'source-binding.json'), JSON.stringify(binding, null, 2) + '\n'); save();
  for (const item of [binding.finalSource, binding.harness, binding.wrapper, ...binding.dependencies]) {
    const target = path.join(out, 'sources', item.path); fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.resolve(ROOT, item.path), target, fs.constants.COPYFILE_EXCL);
  }
  try {
    binding.beforeFiles = verifyFiles(source); binding.beforeServedHashes = await verifyServed(source, gameUrl, path.join(out, 'source-audit-failures', 'before')); binding.beforeRuntimeVerified = true; save();
    const env = { ...launchOptions.env, GAME_URL: gameUrl, QA_OUTPUT_DIR: out, QA_WORLDS: ids.join(','), QA_GRADES: grades.join(','),
      QA_EXPECTED_ALGORITHM_REVISION: String(revision), QA_REQUIRE_BODY_VERSION: '1', QA_REBUILDS: '10', QA_MIXED_REBUILDS: String(ids.length * 3), QA_SCREENSHOTS: '0', QA_DEFER_AUDIT: '1' };
    for (const key of ['QA_CPU_PROFILE', 'QA_STAGE_TIMING', 'QA_P01_STRICT', 'QA_WORLD_ID', 'QA_SEED', 'QA_CONTROLLED_BUILD', 'QA_REPRO_IDENTITY_FILE']) delete env[key];
    const fd = fs.openSync(path.join(out, 'runner.log'), 'wx');
    if (launchOptions.observeWorkers) assert(!fs.existsSync(env.QA_WORKER_OBSERVER_FAILURE_FILE), 'Observer marker must be fresh for this batch');
    await new Promise(resolve => {
      const child = spawn(process.execPath, [...launchOptions.preload, config.harness], { cwd: ROOT, env, stdio: ['ignore', fd, fd] });
      child.once('error', error => { binding.spawnError = String(error); });
      child.once('close', (code, signal) => { fs.closeSync(fd); binding.exitCode = code; binding.signal = signal; resolve(); });
    });
    if (launchOptions.observeWorkers) {
      const folder = env.QA_WORKER_OBSERVER_DIR;
      const files = fs.existsSync(folder) ? fs.readdirSync(folder).filter(file => /^observer-\d+\.jsonl$/.test(file)).sort().map(file => path.join(folder, file)) : [];
      const events = files.flatMap(file => fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line)));
      const observation = { ...summarizeWorkerEvents(events, ids.length * 3), files: files.map(receipt) };
      const observationPath = path.join(out, 'worker-observation-summary.json');
      fs.writeFileSync(observationPath, JSON.stringify(observation, null, 2) + '\n', { flag: 'wx' });
      binding.workerObservation = receipt(observationPath); binding.workerObservationStatus = observation.status; save();
    }
    binding.afterFiles = verifyFiles(source); binding.afterRuntimeVerified = true;
    binding.afterServedHashes = await verifyServed(source, gameUrl, path.join(out, 'source-audit-failures', 'after'));
    assert.deepEqual(binding.afterServedHashes, binding.beforeServedHashes); binding.servedSourceVerified = true;
    for (const item of [binding.finalSource, binding.harness, binding.wrapper, ...binding.dependencies]) assert.equal(sha(item.path), item.sha256, `Probe input changed: ${item.path}`);
    binding.report = receipt(path.join(out, config.report)); assert.equal(binding.exitCode, 0, 'Original probe failed; preserve it before any diagnosis');
    if (launchOptions.observeWorkers) assert.equal(binding.workerObservationStatus, 'pass-observed-events', 'Worker/network observations require diagnosis');
    validateFinalReport(kind, read(binding.report.path), ids, read(GOLD).records.map(row => row.identity), revision);
    binding.status = 'pass';
  } catch (error) { binding.status = 'failed'; binding.failure = String(error); process.exitCode = 1; }
  finally { binding.endedAt = new Date().toISOString(); save(); }
  console.log(JSON.stringify({ status: binding.status, kind, report: binding.report, binding: relative(path.join(out, 'source-binding.json')) }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
