/** I09 four continuous earned-save branches. No seed/world injection, replacement
 * attempts, or automatic art/economy approval. Run only against frozen 52 worlds.
 * GAME_URL, QA_SOURCE_MANIFEST, QA_SELECTION_REPORT and QA_OUTPUT_DIR are required.
 * --summarize rechecks existing receipts without starting browsers.
 * --self-check exercises accounting/continuity guards with synthetic records. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { collectI09SearchReceipts } from './r100-i09-search-receipts.mjs';
import { rawModuleBytes } from './r100-i09-final-probe.mjs';

const ROUNDS = 12;
const GRADES = ['low', 'medium', 'severe'];
const POLICIES = [...GRADES, 'alternating'];
const SOURCE_STORAGE = 'docs/qa/artifacts/r100-p13/natural-low-final/low-growth/browser-storage.json';
const HARNESS = 'tools/qa/r100-i09-journey.mjs';
const REVIEW_POLICY = 'tools/qa/r100-i09-review-policy.json';
const REVIEW_TOOL = 'tools/qa/r100-i09-review-continuous.mjs';
const DEPENDENCIES = ['tools/qa/r100-i09-costed-encounters.mjs', 'tools/qa/r100-i09-tool-slots.mjs', 'tools/qa/r100-i09-search-receipts.mjs', 'tools/qa/r100-observed-searches.mjs', 'tools/qa/i27-journey-driver.mjs',
  'tools/qa/r100-i09-final-probe.mjs', 'package-lock.json',
  'src/systems/last-light-locomotion.ts', 'src/systems/last-light-layout.ts', 'tools/contam-preview/tsconfig.json', 'tools/contam-preview/phaser-stub.ts'];
const ANCHORS = ['src/generated/r100-native-worlds.ts', 'src/generated/r100-world-appearance.ts', 'src/generated/r100-world-selection.ts',
  'src/generation/world-study/native-volume-expansion.ts', 'src/generation/world-study/r100-package.ts',
  'src/generation/world-study/r100-world-selection.ts', 'src/systems/r100-world/surface-bake.ts',
  'src/scenes/purification-scene.ts', 'src/scenes/rift-scene.ts', 'src/config/constants.ts', 'src/systems/contaminant-system.ts', 'src/ui/inventory-presenter.ts', 'src/managers/save-manager.ts', 'src/systems/inventory-store.ts'];
const hashBytes = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = file => hashBytes(fs.readFileSync(file));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const gradeAt = (policy, index) => policy === 'alternating' ? GRADES[index % 3] : policy;
const mainSave = storage => {
  assert.equal(storage.origins.length, 1, 'one isolated storage origin required');
  const entries = storage.origins[0].localStorage.filter(row => row.name === 'coh-save-v1');
  assert.equal(entries.length, 1, 'exactly one authoritative save'); return entries[0].value;
};
function remapStorage(original, gameUrl) {
  assert.equal(original.origins.length, 1); assert.equal(original.cookies.length, 0, 'earned fixture must not carry site cookies');
  const mapped = structuredClone(original); mapped.origins[0].origin = new URL(gameUrl).origin;
  assert.equal(mainSave(mapped), mainSave(original));
  assert.deepEqual(mapped.origins[0].localStorage, original.origins[0].localStorage, 'all save and companion bytes remain exact');
  return mapped;
}
function verifyJourney(receipt, policy, index, previous, initial) {
  assert.equal(receipt.ordinal, index + 1); assert.equal(receipt.policy, policy);
  assert.equal(receipt.grade, gradeAt(policy, index), 'grade must follow predeclared policy, including severe after a death');
  assert.equal(receipt.status, 'completed-real-input'); assert.equal(receipt.noStateInjection, true);
  assert.equal(receipt.fixedDefectIdentity, false); assert.deepEqual(receipt.errors, []); assert.deepEqual(receipt.consoleErrors, []);
  const before = receipt.before.state, entry = receipt.entrySave.state, after = receipt.afterReturn.state, end = receipt.afterPreparation.state;
  if (previous) assert.deepEqual(before, previous.afterPreparation.state, 'the next trip continues the exact prior terminal state');
  else {
    // Legal schema3 ->4 migration is allowed; real resources and earned identity are not rewritten.
    for (const key of ['cycle', 'kindlingReserve', 'modules', 'growth', 'tide']) assert.deepEqual(before[key], initial[key], `earned initial ${key}`);
    for (const key of ['items', 'equipment', 'run']) assert.deepEqual(before.inventory[key], initial.inventory[key], `earned initial inventory ${key}`);
  }
  const generation = receipt.identity.generation;
  assert.equal(generation.package.algorithmRevision, 5); assert.equal(generation.package.grade, receipt.grade);
  assert.equal(before.inventory.version, 4); assert.equal(entry.inventory.version, 4);
  assert.equal(entry.cycle, before.cycle + 1); assert.notEqual(entry.inventory.run.id, before.inventory.run?.id);
  assert.equal(entry.inventory.run.id, after.inventory.run.id); assert.equal(after.inventory.run.id, end.inventory.run.id);
  const history = before.inventory.riftWorldHistory, expected = { version: 1, visits: [...history.visits.slice(-7),
    { worldId: generation.package.id.slice('r100-'.length), grade: receipt.grade }] };
  assert.deepEqual(entry.inventory.riftWorldHistory, expected, 'one and only one selected identity appended');
  assert.deepEqual(after.inventory.riftWorldHistory, expected); assert.deepEqual(end.inventory.riftWorldHistory, expected);
  assert.equal(after.inventory.run.status, 'settled'); assert.equal(after.inventory.run.baseSettled, true);
  assert.equal(receipt.outcome, after.inventory.run.outcome); assert(['extract', 'death'].includes(receipt.outcome));
  const searches = collectI09SearchReceipts(receipt);
  return { ordinal: receipt.ordinal, grade: receipt.grade, world: generation.package.id.slice('r100-'.length),
    seed: generation.requestedSeed, dependencyHash: generation.package.dependencyHash, runId: entry.inventory.run.id,
    outcome: receipt.outcome, searched: searches.filter(row => row.eligibleNonEntry).length,
    actualPickups: searches.length, nearEntryPickups: searches.filter(row => !row.eligibleNonEntry).length, collectedNodes: searches,
    elapsedMs: receipt.fieldResult.elapsedMs, beforeReserve: before.kindlingReserve, returnedReserve: after.kindlingReserve,
    finalReserve: end.kindlingReserve, kindlingReturned: after.inventory.run.kindlingGained ?? 0,
    management: receipt.management ?? null, offeredIds: receipt.offered ?? [], equipmentChanges: receipt.equipmentChanges ?? [],
    carriedOutIds: entry.inventory.run.carriedOutIds ?? [], returnedIds: after.inventory.run.returnedIds ?? [], destroyedIds: after.inventory.run.destroyedIds ?? [],
    itemChanges: before.inventory.items.flatMap(item => {
      const next = end.inventory.items.find(row => row.id === item.id), uses = value => (value?.kind === 'weapon' ? value.weapon : value?.contaminant)?.usesRemaining ?? null;
      return !next || uses(item) !== uses(next) ? [{ id: item.id, kind: item.kind, beforeUses: uses(item), afterUses: uses(next), removed: !next }] : [];
    }),
    navigationWarning: receipt.navigationWarning ?? null,
    performance: receipt.performance, history: expected, beforeHash: receipt.before.sha256, afterHash: receipt.afterPreparation.sha256 };
}
function summarizeBranch(data, policy, initial, neighbors, receiptDirectory) {
  assert.equal(data.postReturnManagement, true); assert.equal(data.normalManagement, true);
  assert.equal(data.controlledWorld, null); assert.equal(data.controlledBuild, null); assert.equal(data.fixedDefectIdentity, null);
  const attempts = data.realJourneyAttempts; assert(attempts.length <= ROUNDS);
  const rows = [], issues = [], runIds = new Set();
  for (let index = 0; index < attempts.length; index++) {
    try {
      const receipt = attempts[index];
      if (receiptDirectory) for (const [key, label] of [['before', 'before'], ['entrySave', 'entry'], ['afterReturn', 'returned'], ['afterPreparation', 'after-preparation']]) {
        const file = path.join(receiptDirectory, `${receipt.ordinal}-${label}.save.json`);
        assert.equal(sha(file), receipt[key].sha256, 'original saved bytes must match the report receipt');
        assert.deepEqual(read(file), receipt[key].state);
      }
      const row = verifyJourney(receipt, policy, index, attempts[index - 1], initial);
      assert(!runIds.has(row.runId), 'a run cannot count twice'); runIds.add(row.runId); rows.push(row);
    } catch (error) { issues.push({ ordinal: index + 1, failure: String(error), reportedStatus: attempts[index].status, reportedFailure: attempts[index].failure ?? null }); }
  }
  const sequence = rows.map(row => row.world);
  return { policy, plannedTrips: ROUNDS, recordedTrips: attempts.length, validatedTrips: rows.length, issues, rows,
    completed: attempts.length === ROUNDS && rows.length === ROUNDS && data.status === 'completed-limited-real-input',
    outcomes: { extract: rows.filter(row => row.outcome === 'extract').length, death: rows.filter(row => row.outcome === 'death').length,
      emptyReturns: rows.filter(row => row.outcome === 'extract' && row.actualPickups === 0).length,
      nearEntryOnlyReturns: rows.filter(row => row.outcome === 'extract' && row.actualPickups > 0 && row.searched === 0).length },
    worldSequence: sequence, distinctWorlds: new Set(sequence).size,
    immediateRepeatCount: sequence.filter((id, i) => i > 0 && id === sequence[i - 1]).length,
    immediateNeighborCount: sequence.filter((id, i) => i > 0 && id !== sequence[i - 1] && neighbors[sequence[i - 1]]?.includes(id)).length,
    caution: 'Twelve naturally selected worlds are descriptive experience samples, not population probabilities or matched-seed economic comparisons.' };
}
function selfCheck() {
  const fixture = { cookies: [], origins: [{ origin: 'http://127.0.0.1:1', localStorage: [{ name: 'coh-save-v1', value: '{"x": 1}' }, { name: 'other', value: 'unchanged' }] }] };
  assert.equal(mainSave(remapStorage(fixture, 'http://127.0.0.1:2/')), '{"x": 1}'); assert.equal(fixture.origins[0].origin, 'http://127.0.0.1:1');
  assert.deepEqual(Array.from({ length: ROUNDS }, (_, index) => gradeAt('alternating', index)), Array(4).fill(GRADES).flat());
  assert(Array.from({ length: ROUNDS }, (_, index) => gradeAt('severe', index)).every(grade => grade === 'severe'));
  const incomplete = summarizeBranch({ postReturnManagement: true, normalManagement: true, controlledWorld: null, controlledBuild: null, fixedDefectIdentity: null, realJourneyAttempts: [], status: 'completed-limited-real-input' }, 'low', {}, {});
  assert.equal(incomplete.completed, false); assert.equal(incomplete.validatedTrips, 0);
  assert.throws(() => summarizeBranch({ controlledWorld: 'ash-strata' }, 'low', {}, {}));
  const initial = { cycle: 30, kindlingReserve: 20, modules: [], growth: {}, tide: {}, inventory: { version: 3, items: [], equipment: {}, run: { id: 'past', status: 'settled', baseSettled: true } } };
  const before = structuredClone(initial); before.inventory.version = 4; before.inventory.riftWorldHistory = { version: 1, visits: [] };
  const entry = structuredClone(before); entry.cycle++; entry.inventory.run = { id: 'next', status: 'active' };
  entry.inventory.riftWorldHistory.visits.push({ worldId: 'test-world', grade: 'low' });
  const returned = structuredClone(entry); returned.inventory.run = { id: 'next', status: 'settled', baseSettled: true, outcome: 'extract', kindlingGained: 1 };
  const receipt = { ordinal: 1, policy: 'low', grade: 'low', status: 'completed-real-input', noStateInjection: true, fixedDefectIdentity: false,
    errors: [], consoleErrors: [], before: { state: before }, entrySave: { state: entry }, afterReturn: { state: returned }, afterPreparation: { state: returned },
    identity: { generation: { package: { id: 'r100-test-world', algorithmRevision: 5, grade: 'low' }, requestedSeed: 1 } },
    outcome: 'extract', searches: [{ id: 'node', collected: true, elapsedMs: 20000 }],
    entryState: { pos: { x: 0, y: 0 }, nodes: [{ id: 'node', kind: 'kindling', pos: { x: 400, y: 0 }, collected: false }] },
    fieldResult: { elapsedMs: 50000, nodes: [{ id: 'node', kind: 'kindling', pos: { x: 400, y: 0 }, collected: true }] } };
  assert.equal(verifyJourney(receipt, 'low', 0, null, initial).world, 'test-world');
  const recounted = structuredClone(receipt); recounted.afterPreparation.state.inventory.riftWorldHistory.visits.push({ worldId: 'test-world', grade: 'low' });
  assert.throws(() => verifyJourney(recounted, 'low', 0, null, initial), 'return cannot append history again');
  const changedGrade = structuredClone(receipt); changedGrade.grade = 'low'; changedGrade.policy = 'severe';
  assert.throws(() => verifyJourney(changedGrade, 'severe', 0, null, initial), 'severe chain cannot silently switch to low');
  const refilled = structuredClone(receipt); refilled.before.state.kindlingReserve++;
  assert.throws(() => verifyJourney(refilled, 'low', 0, null, initial), 'earned starting resources cannot be refilled');
  console.log('PASS I09 orchestration: origin-only byte preservation, fixed/alternating plans, empty or controlled reports rejected, one-trip accounting, duplicate history, silent grade downgrade and resource refill rejected');
}
async function verifySources(source, gameUrl) {
  const url = new URL(gameUrl);
  assert(['127.0.0.1', 'localhost'].includes(url.hostname)); assert.equal(Number(url.port), source.port, 'server and source manifest must identify the same port');
  assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
  for (const [file, hash] of Object.entries(source.sources)) assert.equal(sha(path.join(source.temporaryRoot, file)), hash, `Frozen source changed: ${file}`);
  const served = {};
  for (const file of ANCHORS) {
    assert(source.sources[file], `Missing required source: ${file}`);
    const response = await fetch(new URL(`/${file}?raw`, url), { signal: AbortSignal.timeout(30000) });
    assert(response.ok, `${file}: HTTP ${response.status}`);
    served[file] = hashBytes(rawModuleBytes(Buffer.from(await response.arrayBuffer())));
    assert.equal(served[file], source.sources[file], `Wrong server source: ${file}`);
  }
  return served;
}
function assertStable(policy) {
  for (const row of policy.fixedFiles) assert.equal(sha(row.file), row.sha256, `Frozen test input changed: ${row.file}`);
}
async function main() {
  if (process.argv.includes('--self-check')) { selfCheck(); return; }
  const out = path.resolve(process.env.QA_OUTPUT_DIR ?? ''); assert(process.env.QA_OUTPUT_DIR, 'QA_OUTPUT_DIR required');
  const policyPath = path.join(out, 'policy-freeze.json');
  if (process.argv.includes('--summarize')) {
    const policy = read(policyPath), initial = JSON.parse(mainSave(read(policy.storage))), neighbors = read(policy.selectionReport).neighbors;
    const execution = read(path.join(out, 'execution.json'));
    const sourceValid = execution.status === 'completed-attempts-pending-summary'
      && JSON.stringify(execution.finalServedSourceAnchors) === JSON.stringify(policy.servedSourceAnchors)
      && execution.branches.length === POLICIES.length && execution.branches.every(branch => branch.exitCode === 0);
    assert.equal(sha(policy.storage), policy.fixedFiles.find(row => row.file === policy.storage).sha256);
    assert.equal(sha(policy.selectionReport), policy.fixedFiles.find(row => row.file === policy.selectionReport).sha256);
    const branches = policy.branches.map(branch => {
      const file = path.join(out, branch.folder, 'report.json');
      if (fs.existsSync(file)) {
        const data = read(file);
        assert.equal(data.policyRevision, 15, 'I09 uses actual pickup counting and public slot bindings');
        assert.equal(data.harnessSha256, policy.fixedFiles.find(row => row.file === HARNESS).sha256, 'journey uses frozen harness');
        for (const dependency of data.harnessDependencies) assert.equal(dependency.sha256, policy.fixedFiles.find(row => row.file === dependency.file)?.sha256);
      }
      return fs.existsSync(file) ? { ...summarizeBranch(read(file), branch.policy, initial, neighbors, path.join(out, branch.folder, branch.policy)), report: file, reportSha256: sha(file) }
        : { policy: branch.policy, plannedTrips: ROUNDS, recordedTrips: 0, validatedTrips: 0, completed: false, issues: ['No report; attempt not completed'] };
    });
    const result = { status: sourceValid && branches.every(branch => branch.completed) ? 'completed-continuous-samples-pending-review' : 'incomplete-or-invalid', sourceValid,
      policy: policyPath, policySha256: sha(policyPath), plannedTrips: ROUNDS * POLICIES.length,
      review: policy.review,
      validatedTrips: branches.reduce((sum, branch) => sum + branch.validatedTrips, 0), branches,
      limitation: 'Shared earned ancestor, four continued save branches and geometry-assisted observed-threat driving. No novice, full 52-world coverage, subjective audio, or I13 final economic claim.' };
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(result, null, 2) + '\n');
    if (result.status !== 'completed-continuous-samples-pending-review') process.exitCode = 1;
    console.log(JSON.stringify({ status: result.status, plannedTrips: result.plannedTrips, validatedTrips: result.validatedTrips })); return;
  }
  const manifest = process.env.QA_SOURCE_MANIFEST, gameUrl = process.env.GAME_URL, selectionReport = process.env.QA_SELECTION_REPORT;
  assert(manifest && gameUrl && selectionReport, 'Declare frozen source manifest, GAME_URL and final selection report');
  assert(!fs.existsSync(policyPath), 'An existing frozen attempt cannot be overwritten or rerolled');
  const source = read(manifest), anchors = await verifySources(source, gameUrl);
  for (const file of DEPENDENCIES.filter(file => file.startsWith('src/'))) assert.equal(sha(file), source.sources[file], `Node route helper differs from frozen game: ${file}`);
  const catalogSource = fs.readFileSync(path.join(source.temporaryRoot, 'src/generated/r100-native-worlds.ts'), 'utf8');
  const declaration = 'R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ';
  const catalog = JSON.parse(catalogSource.slice(catalogSource.indexOf(declaration) + declaration.length).trim().replace(/;$/, ''));
  const ids = catalog.filter(world => world.enabled).map(world => world.id).sort(); assert.equal(ids.length, 52, 'Wait for the final 52-world library'); assert.equal(new Set(ids).size, 52);
  const selection = read(selectionReport); assert.deepEqual(selection.worldIds, ids);
  assert.equal(selection.catalogSourceHash, /R100_NATIVE_CATALOG_SOURCE_HASH = '([^']+)'/.exec(catalogSource)?.[1]);
  const selectionSource = fs.readFileSync(path.join(source.temporaryRoot, 'src/generated/r100-world-selection.ts'), 'utf8');
  assert.equal(selection.policySourceHash, /R100_SELECTION_SOURCE_HASH = '([^']+)'/.exec(selectionSource)?.[1]);
  assert.equal(selection.policy.historyLimit, 8);
  const harnessSource = fs.readFileSync(HARNESS, 'utf8'); assert(harnessSource.includes("'alternating'"), 'Journey harness must first implement the approved alternating policy');
  fs.mkdirSync(out, { recursive: true });
  const storage = path.join(out, 'earned-storage.json'), original = read(SOURCE_STORAGE);
  fs.writeFileSync(storage, JSON.stringify(remapStorage(original, gameUrl), null, 2) + '\n', { flag: 'wx' });
  const initial = JSON.parse(mainSave(original)); assert.equal(initial.inventory.run.baseSettled, true);
  const frozenSelection = path.join(out, 'sampling-evidence.json'); fs.copyFileSync(selectionReport, frozenSelection, fs.constants.COPYFILE_EXCL);
  const frozenManifest = path.join(out, 'server-manifest.json'); fs.copyFileSync(manifest, frozenManifest, fs.constants.COPYFILE_EXCL);
  const frozenReview = path.join(out, 'review-policy.json'); fs.copyFileSync(REVIEW_POLICY, frozenReview, fs.constants.COPYFILE_EXCL);
  const fixedFiles = [manifest, frozenManifest, selectionReport, frozenSelection, SOURCE_STORAGE, storage, REVIEW_POLICY, REVIEW_TOOL, frozenReview, HARNESS, ...DEPENDENCIES, new URL(import.meta.url)].map(file => ({ file: file instanceof URL ? fileURLToPath(file) : file, sha256: sha(file) }));
  const harnessCopies = [HARNESS, REVIEW_POLICY, REVIEW_TOOL, ...DEPENDENCIES, fileURLToPath(import.meta.url)].map(file => {
    const copy = path.join(out, 'harness-sources', path.relative(process.cwd(), path.resolve(file)));
    fs.mkdirSync(path.dirname(copy), { recursive: true }); fs.copyFileSync(file, copy, fs.constants.COPYFILE_EXCL);
    assert.equal(sha(copy), sha(file)); return { original: file, copy, sha256: sha(copy) };
  });
  const policy = { version: 1, createdAt: new Date().toISOString(), gameUrl, sourceManifest: frozenManifest, sourceManifestOriginal: manifest, servedSourceAnchors: anchors, storageSource: SOURCE_STORAGE, storage,
    review: { policy: frozenReview, policySha256: sha(frozenReview), tool: REVIEW_TOOL, toolSha256: sha(REVIEW_TOOL), status: 'requires-independent-review-of-actual-results', completionIsExperienceApproval: false },
    sourceSaveSha256: hashBytes(mainSave(original)), initialCycle: initial.cycle, initialReserve: initial.kindlingReserve, selectionReport: frozenSelection, selectionReportOriginal: selectionReport, harnessCopies,
    worldIds: ids, fixedFiles, branches: POLICIES.map(policy => ({ policy, folder: policy, rounds: ROUNDS,
      grades: Array.from({ length: ROUNDS }, (_, index) => gradeAt(policy, index)) })),
    searchLimit: 3, postReturnManagement: true, entryWaitMs: 600, concurrency: 1, method: 'Four earned-save branches, each12 consecutive actual departures. Natural world/seed, no gear grants or selected world, no replacement after death. Same mature ancestor; every branch mutates its own save through real search/return/repair/growth/offering.',
    limitation: 'I09 selection persistence and finite continuous experience. Does not repeat I06/I13 three supply stages or establish final economic efficiency; 48 trips do not estimate all-world probabilities.' };
  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2) + '\n', { flag: 'wx' });
  const run = { status: 'running', policy: policyPath, branches: [] };
  const save = () => fs.writeFileSync(path.join(out, 'execution.json'), JSON.stringify(run, null, 2) + '\n'); save();
  let activeChild = null, interrupted = false;
  const interrupt = signal => { interrupted = true; run.interruption = signal; activeChild?.kill('SIGTERM'); save(); };
  const onInterrupt = () => interrupt('SIGINT'), onTerminate = () => interrupt('SIGTERM');
  process.on('SIGINT', onInterrupt); process.on('SIGTERM', onTerminate);
  try {
    for (const branch of policy.branches) {
      assert(!interrupted, 'Explicitly interrupted; no further departures');
      assertStable(policy); await verifySources(source, gameUrl);
      const row = { policy: branch.policy, startedAt: new Date().toISOString(), status: 'running' }; run.branches.push(row); save();
      const folder = path.join(out, branch.folder); fs.mkdirSync(folder, { recursive: true });
      const env = { ...process.env, GAME_URL: gameUrl, QA_GRADES: branch.policy, QA_RUNS: String(ROUNDS), QA_SEARCH_LIMIT: '3', QA_POST_RETURN_MANAGEMENT: '1', QA_ENTRY_WAIT: '600', QA_ORDINAL_START: '1', QA_STORAGE_STATE: storage, QA_OUTPUT_DIR: folder, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' };
      for (const name of ['QA_WORLD_ID', 'QA_SEED', 'QA_CONTROLLED_BUILD', 'QA_REPRO_IDENTITY_FILE', 'QA_REPLAY_INPUTS']) delete env[name];
      const fd = fs.openSync(path.join(folder, 'runner.log'), 'wx');
      await new Promise(resolve => {
        const child = spawn(process.execPath, ['--import', 'tsx', HARNESS], { cwd: process.cwd(), env, stdio: ['ignore', fd, fd] });
        activeChild = child;
        const timeout = setTimeout(() => { row.timeout = true; child.kill('SIGTERM'); }, ROUNDS * 480000);
        child.once('error', error => { row.spawnError = String(error); });
        child.once('close', (code, signal) => { activeChild = null; clearTimeout(timeout); fs.closeSync(fd); row.exitCode = code; row.signal = signal; resolve(); });
      });
      assertStable(policy); row.endedAt = new Date().toISOString(); row.status = row.exitCode === 0 ? 'completed-script' : 'failed-script'; save();
    }
    run.finalServedSourceAnchors = await verifySources(source, gameUrl); run.status = 'completed-attempts-pending-summary';
  } catch (error) { run.status = 'failed'; run.failure = String(error); process.exitCode = 1; }
  finally { process.off('SIGINT', onInterrupt); process.off('SIGTERM', onTerminate); run.endedAt = new Date().toISOString(); save(); }
  // Explicit accounting is separate from the journey child exit status.
  process.argv.push('--summarize'); await main();
}
await main();
