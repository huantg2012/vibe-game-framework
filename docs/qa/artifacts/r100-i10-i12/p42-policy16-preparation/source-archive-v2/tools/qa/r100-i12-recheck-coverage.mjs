/** Policy16 supplementary fixed inputs. Requires an explicit root-approved protocol.
 * The original two policy15 failures and their exact identity/save remain bound. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { validateExpansionExecutionPlan } from './check-r100-expansion-plan.mjs';
import { verifyServedSourceFile } from './r100-i09-final-probe.mjs';
import { collectI09SearchReceipts } from './r100-i09-search-receipts.mjs';
import { validateControllerSupplement, validateSupplementJourney } from './r100-i12-controller-supplement.mjs';

const out = process.env.QA_OUTPUT_DIR;
const manifest = process.env.QA_SOURCE_MANIFEST;
const gameUrl = process.env.GAME_URL;
assert(out && manifest && gameUrl, 'Declare output, frozen source manifest and game URL');
assert(!fs.existsSync(out), 'Preserve every earlier output, including preflight failures; choose a fresh directory');
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const expansionPath = process.env.QA_EXPANSION_PLAN;
const expansion = expansionPath ? JSON.parse(fs.readFileSync(expansionPath, 'utf8')) : undefined;
const expansionBatch = process.env.QA_BATCH_ID;
if (expansion) { assert(expansionBatch, 'Expansion batch must be explicitly declared'); validateExpansionExecutionPlan(expansion, { batch: expansionBatch }); }
else assert(!expansionBatch, 'A batch requires its frozen expansion plan');
const algorithmRevision = expansion?.algorithmRevision ?? 5;
const storageSource = expansion?.actualPlay.storage ?? 'docs/qa/artifacts/r100-p13/natural-low-final/low-growth/browser-storage.json';
assert(expansion && expansionBatch==='B13' && algorithmRevision===6);
const supplementPath=process.env.QA_CONTROLLER_SUPPLEMENT;
assert(supplementPath,'A root-approved supplementary protocol is required');
const supplement=JSON.parse(fs.readFileSync(supplementPath,'utf8'));
const supplementRef={path:supplementPath,sha256:sha(supplementPath)};
assert.equal(supplement.status,'approved-bounded-input-recheck');
const harness = 'tools/qa/r100-i12-recheck-journey.mjs';
const dependencies = ['tools/qa/r100-i12-recheck-encounters.mjs','tools/qa/r100-i12-recheck-budget.mjs',
  'tools/qa/r100-i09-tool-slots.mjs','tools/qa/i27-journey-driver.mjs',
  'src/systems/last-light-locomotion.ts','src/systems/last-light-layout.ts'];
const wrapperDependencies = ['tools/qa/r100-i12-controller-supplement.mjs','tools/qa/check-r100-expansion-plan.mjs', 'tools/qa/r100-i09-final-probe.mjs',
  'tools/qa/r100-i09-search-receipts.mjs', 'tools/qa/r100-observed-searches.mjs'];
const source = JSON.parse(fs.readFileSync(manifest));
assert.equal(new URL(gameUrl).hostname, '127.0.0.1');
assert.equal(Number(new URL(gameUrl).port), source.port, 'Use the server belonging to this snapshot');
for (const [file, expected] of Object.entries(source.sources)) assert.equal(sha(path.join(source.temporaryRoot, file)), expected, `Snapshot changed: ${file}`);
for (const file of dependencies.filter(file => file.startsWith('src/'))) assert.equal(sha(file), source.sources[file], `Routing code differs from server: ${file}`);
// Verify returned source, not only a manifest on disk. Vite transforms TS imports,
// so the literal data CSV is the stable HTTP proof of this server's catalog.
const servedCatalog = await verifyServedSourceFile({ file: 'data/rift-native-worlds.csv',
  expected: source.sources['data/rift-native-worlds.csv'], url: new URL('/data/rift-native-worlds.csv?raw', gameUrl),
  failureDirectory: path.join(out, 'source-audit-failures') });
const catalogSource = fs.readFileSync(path.join(source.temporaryRoot, 'src/generated/r100-native-worlds.ts'), 'utf8');
const catalog = JSON.parse(catalogSource.split('R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].trim().replace(/;$/, ''));
const batchWorlds = expansion?.batches.find(row => row.id === expansionBatch).worlds;
const selected = process.env.QA_WORLDS?.split(',') ?? expansion?.executionWorlds ?? batchWorlds ?? catalog.map(world => world.id);
assert(selected.every(id => catalog.some(world => world.id === id)));
if (batchWorlds) assert(selected.every(id => batchWorlds.includes(id)), 'No world outside the declared batch');
if (expansion?.executionWorlds) assert(selected.every(id => expansion.executionWorlds.includes(id)), 'No world outside the explicitly ready subset');
assert.deepEqual(selected,['white-scarfield']);
const grades = (process.env.QA_GRADES ?? 'severe').split(',');
assert.deepEqual(grades,['severe']);
assert(selected.length && new Set(selected).size === selected.length);
assert(grades.length && new Set(grades).size === grades.length && grades.every(grade => ['low', 'medium', 'severe'].includes(grade)));
const seeds = (process.env.QA_SEEDS ?? '20261005,3075192741').split(',').map(Number);
assert.deepEqual(seeds,[20261005,3075192741],'Both original seeds, in original order, exactly once');
assert(new Set(seeds).size === seeds.length);
assert(seeds.length && seeds.every(seed => Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff));
if (expansion) assert(seeds.every(seed => expansion.actualPlay.seeds.includes(seed)), 'Only the two original fixed seeds are allowed');
const parallelism = Number(process.env.QA_CONCURRENCY ?? (expansion ? 1 : 2));
assert(Number.isInteger(parallelism) && parallelism >= 1 && parallelism <= 2);
if (expansion) assert.equal(parallelism, 1, 'Expansion real-input evidence requires the sole browser');
const stopOnFailure = process.env.QA_STOP_ON_FAILURE === '1';
assert(stopOnFailure,'Technical failures must stop without automatic retry');
const observationFailureFile = process.env.QA_WORKER_OBSERVER_FAILURE_FILE;
if (stopOnFailure) assert.equal(parallelism, 1, 'Failure-stop coverage is strictly serial');
if (observationFailureFile) {
  assert(stopOnFailure, 'Observed failures require an explicit between-case stop');
  assert(!fs.existsSync(observationFailureFile), 'Preserve stale observation failure; use a fresh attempt directory');
}
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
const frozenExpansion = expansion ? path.join(out, 'qualification-plan.json') : undefined;
if (frozenExpansion) fs.copyFileSync(expansionPath, frozenExpansion, fs.constants.COPYFILE_EXCL);
const policy = {version: 1, frozenAt: new Date().toISOString(), cases, gameUrl,
  algorithmRevision, controllerPolicyRevision:16, controllerDerivation:null, controllerSupplement:supplementRef,
  expansion: expansion ? {plan: frozenExpansion, sha256: sha(frozenExpansion), originalPlan: expansionPath, batch: expansionBatch} : null,
  servedCatalog, actualPickupLimit: 1,
  manifest, manifestSha256: sha(manifest), storageSource, storageSourceSha256: sha(storageSource), storage, storageSha256: sha(storage),
  harness, harnessSha256: sha(harness), wrapperSha256: sha(new URL(import.meta.url)), dependencies: dependencies.map(file => ({file, sha256: sha(file)})),
  wrapperDependencies: wrapperDependencies.map(file => ({file, sha256: sha(file)})),
  parallelism, resourcePauseFile,
  ...(stopOnFailure ? {stopOnFailure, observationFailureFile} : {}),
  method: 'Explicit policy16 supplement: one bounded reapproach/search per trip and three strike enum corrections. One fixed attempt per original world/grade/seed. Actual WASD/E/R with earned equipment. Static terrain assists macro routing; enemies/Hosts only currently observed or 5s memory. No field reward, HP, clock or position injection. One non-entry collected remain (>320px from entry), then actual return. A failed or empty process remains a failure for the primary search-and-extract requirement; no pass is assigned by this runner.',
  limitations: 'Controlled world and seed on identical earned save branches; not natural continuous economy, novice play, success-rate inference, or exclusive performance measurement.'};
const validationPlan={controllerSupplements:[supplementRef],batches:[...new Set(supplement.cases.map(row=>path.dirname(path.dirname(row.originalReport.path))))]};
// Validate the frozen scheduler before opening Chrome; this is a planned case list,
// not a fabricated execution batch. The actual batch is independently checked below.
const binding=validateControllerSupplement(supplementRef,policy,{attempts:cases},validationPlan,file=>fs.readFileSync(file));
assert.equal(sha(new URL(import.meta.url)),supplement.wrapper.sha256);
assert.equal(policy.actualPickupLimit,1);
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
    for (const dependency of [...policy.dependencies, ...policy.wrapperDependencies,
      ...(policy.expansion ? [{file: policy.expansion.plan, sha256: policy.expansion.sha256}] : []),
      ...[supplementRef,supplement.originalPolicy,...supplement.cases.map(row=>row.originalReport)].map(row=>({file:row.path,sha256:row.sha256})),
      {file: harness, sha256: policy.harnessSha256}, {file: manifest, sha256: policy.manifestSha256}, {file: storage, sha256: policy.storageSha256}]) assert.equal(sha(dependency.file), dependency.sha256, `Changed input: ${dependency.file}`);
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
      assert.equal(data.policyRevision, policy.controllerPolicyRevision, 'Controller must match the frozen input policy');
      row.journeys = data.realJourneyAttempts.map(journey => {
        let pickups, accountingError;
        if (expansion && journey.status === 'completed-real-input') {
          try { pickups = collectI09SearchReceipts(journey); const problems=validateSupplementJourney(binding,row,journey,pickups);assert.deepEqual(problems,[]); } catch (error) { accountingError = String(error); }
        }
        return {status: journey.status, outcome: journey.outcome ?? null,
        world: journey.identity?.generation.package.id?.replace(/^r100-/, ''), grade: journey.identity?.generation.package.grade, revision: journey.identity?.generation.package.algorithmRevision,
        requestedSeed: journey.identity?.generation.requestedSeed,
        matchesPlan: journey.identity?.generation.package.id === `r100-${row.world}` && journey.identity?.generation.package.grade === row.grade && journey.identity?.generation.package.algorithmRevision === algorithmRevision && journey.identity?.generation.requestedSeed === row.seed,
        collected: pickups ? pickups.filter(pickup => pickup.eligibleNonEntry).length : journey.searches.filter(search => search.collected).length,
        actualPickups: pickups?.length, accountingError,
        elapsedMs: journey.fieldResult?.elapsedMs ?? journey.exploration?.state?.elapsedMs ?? null,
        entryPosition: journey.entryState?.pos, lastPosition: journey.fieldResult?.pos, failure: journey.failure, navigationWarning: journey.navigationWarning,
        baseSettled: journey.afterReturn?.state?.inventory?.run?.baseSettled ?? false}; });
    }
    save(); console.log('END', row.dir, row.exitCode, row.journeys?.map(journey => [journey.outcome, journey.collected, Math.round((journey.elapsedMs ?? 0) / 1000)]));
    // The child has exited and closed its browser before this boundary. Never
    // interrupt a live field to make a failed observation disappear.
    if (stopOnFailure && (row.exitCode !== 0 || !row.journeys?.length
      || row.journeys.some(journey => !journey.matchesPlan || journey.accountingError)
      || observationFailureFile && fs.existsSync(observationFailureFile))) {
      report.stoppedAfterFailure = {index: row.index, dir: row.dir,
        observation: observationFailureFile && fs.existsSync(observationFailureFile) ? JSON.parse(fs.readFileSync(observationFailureFile)) : null};
      save(); break;
    }
  }
}
await Promise.all(Array.from({length: policy.parallelism}, worker));
report.status = report.stoppedAfterFailure ? 'stopped-after-failed-attempt' : 'completed-fixed-attempts-pending-review'; report.endedAt = new Date().toISOString(); save();
if(report.attempts.length===cases.length)validateControllerSupplement(supplementRef,policy,report,validationPlan,file=>fs.readFileSync(file));
console.log('DONE', cases.length, 'supplementary fixed attempts; original failures retained, no automatic qualification');
if (report.stoppedAfterFailure || report.attempts.length !== cases.length || report.attempts.some(row => row.exitCode !== 0 || !row.journeys?.length || row.journeys.some(journey => !journey.matchesPlan || journey.accountingError))) process.exitCode = 1;
