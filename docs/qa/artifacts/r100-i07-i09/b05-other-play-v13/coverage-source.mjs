/** Fixed real-input coverage against an immutable QA server. Failures are retained. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

const out = process.env.QA_OUTPUT_DIR;
const manifest = process.env.QA_SOURCE_MANIFEST;
const gameUrl = process.env.GAME_URL;
assert(out && manifest && gameUrl, 'Declare output, frozen source manifest and game URL');
const storageSource = 'docs/qa/artifacts/r100-p13/natural-low-final/low-growth/browser-storage.json';
const harness = 'tools/qa/r100-i07-i09-journey.mjs';
const dependencies = ['tools/world-study/r100-p13-costed-encounters.mjs', 'tools/qa/i27-journey-driver.mjs', 'src/systems/last-light-locomotion.ts', 'src/systems/last-light-layout.ts'];
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = JSON.parse(fs.readFileSync(manifest));
assert.equal(new URL(gameUrl).hostname, '127.0.0.1');
assert.equal(Number(new URL(gameUrl).port), source.port, 'Use the server belonging to this snapshot');
for (const [file, expected] of Object.entries(source.sources)) assert.equal(sha(path.join(source.temporaryRoot, file)), expected, `Snapshot changed: ${file}`);
for (const file of dependencies.filter(file => file.startsWith('src/'))) assert.equal(sha(file), source.sources[file], `Routing code differs from server: ${file}`);
// Verify returned source, not only a manifest on disk. Vite transforms TS imports,
// so the literal data CSV is the stable HTTP proof of this server's catalog.
const servedCatalog = await fetch(new URL('/data/rift-native-worlds.csv?raw', gameUrl));
assert(servedCatalog.ok);
assert.equal(createHash('sha256').update(await servedCatalog.text()).digest('hex'), source.sources['data/rift-native-worlds.csv']);
const catalogSource = fs.readFileSync(path.join(source.temporaryRoot, 'src/generated/r100-native-worlds.ts'), 'utf8');
const catalog = JSON.parse(catalogSource.split('R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].trim().replace(/;$/, ''));
const selected = process.env.QA_WORLDS?.split(',') ?? catalog.map(world => world.id);
assert(selected.every(id => catalog.some(world => world.id === id)));
const grades = (process.env.QA_GRADES ?? 'low,medium,severe').split(',');
assert(selected.length && new Set(selected).size === selected.length);
assert(grades.length && new Set(grades).size === grades.length && grades.every(grade => ['low', 'medium', 'severe'].includes(grade)));
const seeds = (process.env.QA_SEEDS ?? '20261005,3075192741').split(',').map(Number);
assert(new Set(seeds).size === seeds.length);
assert(seeds.length && seeds.every(seed => Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff));
const parallelism = Number(process.env.QA_CONCURRENCY ?? 2);
assert(Number.isInteger(parallelism) && parallelism >= 1 && parallelism <= 2);
// Cooperative scheduling only, between completed journeys. Never freeze the
// browser, character, simulation clock or a partially played expedition.
const resourcePauseFile = process.env.QA_RESOURCE_PAUSE_FILE;
const cases = selected.flatMap(world => grades.flatMap(grade => seeds.map((seed, index) => ({world, grade, seed, role: index === 0 ? 'search-and-extract' : 'second-seed-process'}))))
  .map((row, index) => ({...row, index: index + 1, dir: `${String(index + 1).padStart(3, '0')}-${row.world}-${row.grade}-${row.seed}`}));
fs.mkdirSync(out, {recursive: true});
const freeze = path.join(out, 'policy-freeze.json');
assert(!fs.existsSync(freeze), 'Never overwrite or silently repeat an attempt');
const storage = path.join(out, 'earned-storage.json');
const originalStorage = JSON.parse(fs.readFileSync(storageSource));
assert.equal(originalStorage.origins.length, 1);
// Only the origin changes to reach the isolated server; save bytes stay exact.
originalStorage.origins[0].origin = new URL(gameUrl).origin;
fs.writeFileSync(storage, JSON.stringify(originalStorage, null, 2));
const policy = {version: 1, frozenAt: new Date().toISOString(), cases, gameUrl,
  manifest, manifestSha256: sha(manifest), storageSource, storageSourceSha256: sha(storageSource), storage, storageSha256: sha(storage),
  harness, harnessSha256: sha(harness), wrapperSha256: sha(new URL(import.meta.url)), dependencies: dependencies.map(file => ({file, sha256: sha(file)})),
  parallelism, resourcePauseFile,
  method: 'One fixed attempt per world/grade/seed. Actual WASD/E/R with earned equipment. Static terrain assists macro routing; enemies/Hosts only currently observed or 5s memory. No field reward, HP, clock or position injection. One non-entry collected remain (>320px from entry), then actual return. A failed or empty process remains a failure for the primary search-and-extract requirement; no pass is assigned by this runner.',
  limitations: 'Controlled world and seed on identical earned save branches; not natural continuous economy, novice play, success-rate inference, or exclusive performance measurement.'};
fs.writeFileSync(freeze, JSON.stringify(policy, null, 2));
fs.copyFileSync(harness, path.join(out, 'journey-source.mjs'));
fs.copyFileSync(new URL(import.meta.url), path.join(out, 'coverage-source.mjs'));
const report = {status: 'running', startedAt: new Date().toISOString(), policy: 'policy-freeze.json', attempts: []};
const save = () => fs.writeFileSync(path.join(out, 'batch-report.json'), JSON.stringify(report, null, 2));
let cursor = 0; save();
async function worker() {
  for (;;) {
    if (cursor >= cases.length) return;
    if (resourcePauseFile && fs.existsSync(resourcePauseFile)) {
      report.resourceWait = {since: new Date().toISOString(), file: resourcePauseFile};
      save(); console.log('WAIT resource window; completed journeys remain closed');
      while (fs.existsSync(resourcePauseFile)) await new Promise(resolve => setTimeout(resolve, 1000));
      delete report.resourceWait; save(); console.log('RESUME resource window');
    }
    const at = cursor++; if (at >= cases.length) return;
    const row = {...cases[at], status: 'running', startedAt: new Date().toISOString()}, folder = path.join(out, row.dir);
    for (const dependency of [...policy.dependencies, {file: harness, sha256: policy.harnessSha256}, {file: manifest, sha256: policy.manifestSha256}, {file: storage, sha256: policy.storageSha256}]) assert.equal(sha(dependency.file), dependency.sha256, `Changed input: ${dependency.file}`);
    fs.mkdirSync(folder, {recursive: true}); report.attempts.push(row); save(); console.log('START', row.dir);
    const env = {...process.env, GAME_URL: gameUrl, QA_GRADES: row.grade, QA_WORLD_ID: row.world, QA_SEED: String(row.seed), QA_RUNS: '1', QA_SEARCH_LIMIT: '1', QA_POST_RETURN_MANAGEMENT: '0', QA_STORAGE_STATE: storage, QA_OUTPUT_DIR: folder, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json'};
    for (const name of ['QA_CONTROLLED_BUILD', 'QA_REPRO_IDENTITY_FILE', 'QA_REPLAY_INPUTS', 'QA_ORDINAL_START']) delete env[name];
    const fd = fs.openSync(path.join(folder, 'runner.log'), 'wx');
    await new Promise(resolve => {
      const child = spawn(process.execPath, ['--import', 'tsx', harness], {cwd: process.cwd(), env, stdio: ['ignore', fd, fd]});
      const timeout = setTimeout(() => {row.timeout = true; child.kill('SIGTERM');}, 480000);
      child.on('error', error => {row.spawnError = String(error);});
      child.on('close', (code, signal) => {clearTimeout(timeout); fs.closeSync(fd); row.exitCode = code; row.signal = signal; resolve();});
    });
    row.endedAt = new Date().toISOString(); row.status = row.exitCode === 0 ? 'completed-script' : 'failed-script';
    const receipt = path.join(folder, 'report.json');
    if (fs.existsSync(receipt)) {
      const data = JSON.parse(fs.readFileSync(receipt));
      row.journeys = data.realJourneyAttempts.map(journey => ({status: journey.status, outcome: journey.outcome ?? null,
        world: journey.identity?.generation.package.id?.replace(/^r100-/, ''), grade: journey.identity?.generation.package.grade, revision: journey.identity?.generation.package.algorithmRevision,
        requestedSeed: journey.identity?.generation.requestedSeed,
        matchesPlan: journey.identity?.generation.package.id === `r100-${row.world}` && journey.identity?.generation.package.grade === row.grade && journey.identity?.generation.package.algorithmRevision === 5 && journey.identity?.generation.requestedSeed === row.seed,
        collected: journey.searches.filter(search => search.collected).length, elapsedMs: journey.fieldResult?.elapsedMs ?? journey.exploration?.state?.elapsedMs ?? null,
        entryPosition: journey.entryState?.pos, lastPosition: journey.fieldResult?.pos, failure: journey.failure, navigationWarning: journey.navigationWarning,
        baseSettled: journey.afterReturn?.state?.inventory?.run?.baseSettled ?? false}));
    }
    save(); console.log('END', row.dir, row.exitCode, row.journeys?.map(journey => [journey.outcome, journey.collected, Math.round((journey.elapsedMs ?? 0) / 1000)]));
  }
}
await Promise.all(Array.from({length: policy.parallelism}, worker));
report.status = 'completed-fixed-attempts-pending-review'; report.endedAt = new Date().toISOString(); save();
console.log('DONE', cases.length, 'fixed attempts; failures retained, no automatic qualification');
if (report.attempts.length !== cases.length || report.attempts.some(row => row.exitCode !== 0 || !row.journeys?.length || row.journeys.some(journey => !journey.matchesPlan))) process.exitCode = 1;
