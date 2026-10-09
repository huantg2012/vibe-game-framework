/** Four finite batches of twelve genuine sorties. No retries, replacement runs,
 * grants, grade downgrades, hidden destination selection or economic pass gate.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { checkFunctionalSelection } from './r100-i13-functional-policy.mjs';
import { checkRetryPolicy } from './r100-i13-retry-policy.mjs';
import { differences } from '../qa/r100-i14-lifecycle.mjs';

const root = 'docs/qa/artifacts/r100-i14';
const continuous = path.join(root, 'continuous');
const planPath = path.join(continuous, 'policy-freeze.json');
const journey = 'tools/world-study/r100-i14-continuous-journey.mjs';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const binding = file => ({ file, sha256: sha(file) });
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const currentRaw = storage => storage.origins[0].localStorage.find(row => row.name === 'coh-save-v1').value;
const dependencies = [journey, 'tools/qa/r100-i14-lifecycle.mjs', 'tools/world-study/run-r100-i14-continuous.mjs',
  'tools/world-study/r100-i13-bounded-journey.mjs', 'tools/world-study/r100-i13-retry-policy.mjs',
  'tools/world-study/r100-i13-functional-policy.mjs', 'tools/world-study/r100-i13-continuation-encounters.mjs',
  'tools/world-study/r100-i13-continuation-policy.mjs', 'tools/qa/r100-i09-tool-slots.mjs',
  'tools/qa/i27-journey-driver.mjs', 'tools/world-study/r100-frozen-server.mjs',
  'tools/qa/check-r100-i14-runtime-budget.mjs', 'tools/qa/check-r100-runtime-budget.mjs', 'package-lock.json'];

function verifyBindings(rows) {
  for (const row of rows) assert.equal(sha(row.file ?? row.path), row.sha256 ?? row.hash, row.file ?? row.path);
}
function inspectInheritance() {
  const rcPath = 'docs/qa/artifacts/r100-i10-i12/release-candidate.json';
  const rc = read(rcPath);
  const references = Object.values(rc).filter(value => value && typeof value === 'object' && value.path && value.sha256);
  verifyBindings(references);
  const source = read(rc.finalSource.path);
  for (const [file, expected] of Object.entries(source.sources)) assert.equal(sha(file), expected, file);
  const index = read(rc.packages.path), manifests = [], unique = new Map();
  for (const world of index.worlds) {
    const ref = world.dependencyManifest; assert.equal(sha(ref.path), ref.hash, ref.path);
    manifests.push({ file: ref.path, sha256: ref.hash });
    for (const dependency of read(ref.path).dependencies) {
      if (unique.has(dependency.path)) assert.equal(unique.get(dependency.path), dependency.sha256);
      unique.set(dependency.path, dependency.sha256);
    }
  }
  verifyBindings([...unique].map(([file, sha256]) => ({ file, sha256 })));
  assert.equal(Object.keys(source.sources).length, 1397); assert.equal(index.worlds.length, 108); assert.equal(unique.size, 307);
  return { status: 'exact-current-files-match-internal-rc-not-release-approval', rc: binding(rcPath),
    references: references.map(row => ({ file: row.path, sha256: row.sha256 })), sourceManifest: binding(rc.finalSource.path),
    productionFileCount: 1397, worldCount: 108, gradeQualifications: 324, dependencyManifestCount: manifests.length,
    uniquePackageDependencies: [...unique].map(([file, sha256]) => ({ file, sha256 })), manifests,
    priorPerformance: { complete: 74, interrupted: ['felt-wedges'], unstarted: 33, materialP95At3ms: ['hollow-wreckage', 'buried-lamellae'] },
    limitation: 'Current file identity only. Historical coverage retains its original browser and sampling scope. No actual hearing, weak-device or final approval is inferred.' };
}
function environment() {
  const command = (exe, args) => { try { return execFileSync(exe, args, { encoding: 'utf8' }).trim(); } catch { return null; } };
  const chrome = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  const packages = Object.fromEntries(['tsx', 'typescript', 'vite', 'phaser'].map(name => {
    const file = `node_modules/${name}/package.json`; return [name, { version: read(file).version, sha256: sha(file) }];
  }));
  return { node: process.version, platform: process.platform, arch: process.arch, osRelease: os.release(),
    cpu: os.cpus()[0]?.model, logicalCores: os.cpus().length, totalMemory: os.totalmem(), chromePath: chrome,
    chromeVersion: command(chrome, ['--version']), packageLock: binding('package-lock.json'), packages,
    power: process.platform === 'darwin' ? command('pmset', ['-g', 'batt']) : null,
    limitations: 'One reference machine. No true weak hardware or actual listening is claimed; current Chrome WebGL renderer is separately observed in browser.' };
}
function selfCheck() {
  for (const file of dependencies.filter(file => file.endsWith('.mjs'))) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr);
  }
  const schedule = Array.from({ length: 48 }, (_, index) => ['low', 'medium', 'severe'][index % 3]);
  assert.deepEqual(Object.fromEntries(['low', 'medium', 'severe'].map(grade => [grade, schedule.filter(item => item === grade).length])), { low: 16, medium: 16, severe: 16 });
  assert.deepEqual(differences({ tools: { uses: 4 }, clock: 3 }, { tools: { uses: 3 }, clock: 4 }).map(row => row.path), ['tools.uses', 'clock']);
  return { status: 'pass', syntaxFiles: dependencies.filter(file => file.endsWith('.mjs')).length,
    functionalSelection: checkFunctionalSelection(), retry: checkRetryPolicy(), diffPreservesConsumptionAndClockChanges: true,
    limitation: 'Syntax is not lint; package.json defines no lint/test command. This does not validate browser execution.' };
}

if (process.argv.includes('--self-check')) { console.log(JSON.stringify(selfCheck())); process.exit(0); }
if (process.argv.includes('--audit')) {
  fs.mkdirSync(root, { recursive: true });
  write(path.join(root, 'code-inheritance.json'), { recordedAt: new Date().toISOString(), tool: binding('tools/world-study/run-r100-i14-continuous.mjs'),
    inheritance: inspectInheritance(), environment: environment() });
  console.log('I14 source1397 /108 package manifests /307 dependencies verified'); process.exit(0);
}
if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(planPath), 'Never replace a frozen plan');
  const inheritance = inspectInheritance(), env = environment();
  const sourceManifest = process.env.QA_SOURCE_MANIFEST; assert(sourceManifest, 'Frozen server source manifest required');
  assert.deepEqual(read(sourceManifest).sources, read(inheritance.sourceManifest.file).sources);
  const gameUrl = process.env.GAME_URL; assert(gameUrl, 'Explicit isolated GAME_URL required');
  const qaPath = path.join(root, 'qa-continuous-source-preflight.json'), qa = read(qaPath);
  assert.equal(qa.status, 'source-continuity-pass-not-runtime'); verifyBindings([qa.sourceReport, qa.sourceStorage, qa.sourceTerminal]);
  const rawStorage = read(qa.sourceStorage.path), raw = currentRaw(rawStorage);
  assert.deepEqual(JSON.parse(raw), read(qa.sourceTerminal.path)); assert.equal(rawStorage.origins.length, 1); assert.equal(rawStorage.cookies.length, 0);
  const sourceOrigin = rawStorage.origins[0].origin; rawStorage.origins[0].origin = new URL(gameUrl).origin;
  assert.equal(currentRaw(rawStorage), raw);
  const sourceReport = read(qa.sourceReport.path), sourceTerminal = sourceReport.realJourneyAttempts.at(-1);
  assert.deepEqual(sourceTerminal.afterPreparation.state, JSON.parse(raw));
  fs.mkdirSync(continuous, { recursive: true });
  const input = path.join(continuous, 'earned-a23-storage.json'); write(input, rawStorage);
  const task = path.join(continuous, 'task-preregistration.md'); fs.copyFileSync('docs/tasks/rift-r100-i14.md', task, fs.constants.COPYFILE_EXCL);
  const prep = { id: 'i14-public-silence-dash-fifo', active: [{ family: 'silence', minimumPower: 5, minimumUses: 2 },
    { family: 'dash', minimumPower: 48, minimumUses: 2 }], passive: { name: '黄铜背扣' } };
  const budget = { normalPerSlot: 1, protectNextPreparation: true,
    minimumPower: { survey: 128, dash: 48, suppress: 3, solidify: 2.5, silence: 5 },
    emergency: 'Only dash against a currently observed windup/active attack within65px; record actual overspend and consequences' };
  const steps = Array.from({ length: 48 }, (_, index) => ({ ordinal: index + 1, grade: ['low', 'medium', 'severe'][index % 3], preparation: prep, surveyDecision: false, budget }));
  const plan = { version: 1, createdAt: new Date().toISOString(), authorization: 'Root and Design approved I14 new48 continuous sorties in four batches12, trueA23 lineage, B14 bounded public silence/dash policy; no economic qualification and no I13 recovery early-stop.',
    maxAttempts: 48, maxBatch: 12, maxContexts: 1, gameUrl, sourceOrigin, mappedOrigin: new URL(gameUrl).origin,
    unchangedStorageValues: true, sourceManifest: binding(sourceManifest), releaseManifest: inheritance.rc,
    preflight: binding(qaPath), initialSource: [qa.sourceStorage, qa.sourceTerminal, qa.sourceReport].map(row => ({ file: row.path, sha256: row.sha256 })),
    input: binding(input), taskContract: binding(task), dependencies: dependencies.map(binding), environment: env, steps,
    initialFreshItemIds: sourceTerminal.freshAcquisitionOrder.map(row => row.id),
    ancestorRunIds: [...new Set([...(sourceReport.continuation.ancestorRunIds ?? []), ...sourceReport.realJourneyAttempts.map(row => row.entrySave.state.inventory.run.id)])],
    lifecycle: { ordinals: [1, 2, 3], phase: 'After formal entry receipt, before any field movement/search/tool input.', pauseWaitMs: 700,
      focus: 'Actual alternate blank-tab activation only, trusted native events recorded. If headless emits no loss, explicitly pending; never substitute synthetic blur.',
      cold: 'Exact normal pause autosave, reload/menu Continue, first complete runtime capture and all field differences retained. No re-equipping or new departure.' },
    media: { ordinals: [1, 2, 3], phase: 'After lifecycle recovery before first field movement through actual return/management.',
      method: 'Canvas30fps VP8 plus unmodified Phaser master Opus audio. DOM excluded; normal full-page screenshots and input logs accompany.', performanceQualification: false },
    limitations: ['Full static terrain aids body pathing; targets/threats use normal observations only. Not novice behavior or human enjoyment.',
      'No destination override, loot selection, resource grant, stock reset or special grade eligibility. Missing tools remain empty.',
      'Actual death, empty return, debt and inability to continue are retained. Technical interruptions stop at the original checkpoint, never rerolled.',
      'Public same-function>=2 eligibility before earned FIFO, Q/F normal1, existing near-attack emergency. Third active empty; real same-name passive if available.',
      'Maintain51/100/51 via real paid repairs, then original reserve-constrained growth and new earned FIFO offerings. Not a profitability or supply acceptance gate.',
      'Each batch inherits exact preceding terminal and FIFO metadata. Independent QA checks every batch; no batch substitutes for the required48.',
      'Six material families are observed, not forced. Any natural coverage gap remains separate from fixed diagnostic samples.'] };
  write(planPath, plan);
  write(path.join(root, 'runtime-policy-freeze.json'), { version: 1, createdAt: new Date().toISOString(), taskContract: plan.taskContract,
    sourceManifest: plan.sourceManifest, releaseManifest: plan.releaseManifest, gameUrl, environment: env,
    releaseCandidate: { path: plan.releaseManifest.file, sha256: plan.releaseManifest.sha256, revision: read(plan.releaseManifest.file).revision },
    tools: ['tools/qa/check-r100-i14-runtime-budget.mjs', 'tools/qa/check-r100-runtime-budget.mjs'].map(file => ({ path: file, sha256: sha(file) })),
    dependencies: [binding('tools/qa/check-r100-i14-runtime-budget.mjs'), binding('tools/qa/check-r100-runtime-budget.mjs'), binding('package-lock.json')],
    worlds: ['hollow-wreckage', 'buried-lamellae', 'felt-wedges', 'white-scarfield'], grade: 'severe', seed: 20261004,
    keys: ['d','w','a','s','d','s','a','w','d','w','a','s'], heldMs: 5100, minimumActiveMs: 60000,
    budgets: { frameP95Ms: 20, frameP99Ms: 33.4, fractionOver50Ms: .005, cpuP95Ms: 12, materialSubmissionP95Ms: 3 },
    selection: 'Two historical material submission3ms cases, one historically interrupted, one unmeasured structural risk example. Not a ranking of the whole library.',
    method: 'Four severe diagnostic Gym cases, serial and exclusive, normal body/sight/enemies/damage/time, no media capture. Separate from natural48 denominator and from actual weak-device verification.' });
  write(path.join(continuous, 'code-self-check.json'), selfCheck());
  console.log(`Frozen ${planPath}:48 new sorties /4 batches; fixed runtime plan separate`); process.exit(0);
}

const batchOption = process.argv.indexOf('--run-batch');
assert(batchOption >= 0, 'Use --audit, --self-check, --freeze, or --run-batch N');
const batch = Number(process.argv[batchOption + 1]); assert(Number.isInteger(batch) && batch >= 1 && batch <= 4);
const plan = read(planPath); verifyBindings([...plan.dependencies, ...plan.initialSource, plan.input, plan.preflight, plan.sourceManifest, plan.releaseManifest, plan.taskContract]);
const production = read(plan.sourceManifest.file); for (const [file, expected] of Object.entries(production.sources)) assert.equal(sha(file), expected, file);
const firstOrdinal = (batch - 1) * 12 + 1, out = path.join(continuous, `batch-${String(batch).padStart(2, '0')}`);
assert(!fs.existsSync(out), 'Do not retry or overwrite any actual batch');
let input = plan.input.file, previous = null, freshItemIds = plan.initialFreshItemIds, ancestorRunIds = plan.ancestorRunIds;
if (batch > 1) {
  const priorFolder = path.join(continuous, `batch-${String(batch - 1).padStart(2, '0')}`), reportFile = path.join(priorFolder, 'report.json');
  previous = read(reportFile); assert.equal(previous.realJourneyAttempts.length, 12);
  assert(previous.realJourneyAttempts.every(row => row.status === 'completed-real-input'), 'Previous technical failure must be handled at its same checkpoint; no new batch');
  input = path.join(priorFolder, 'i14/browser-storage.json');
  assert.deepEqual(JSON.parse(currentRaw(read(input))), previous.realJourneyAttempts.at(-1).afterPreparation.state);
  freshItemIds = previous.realJourneyAttempts.at(-1).freshAcquisitionOrder.map(row => row.id);
  ancestorRunIds = [...new Set([...previous.continuation.ancestorRunIds, ...previous.realJourneyAttempts.map(row => row.entrySave.state.inventory.run.id)])];
}
const row = { id: `i14-continuous-batch-${batch}`, sourceBranch: 'I13-A23-to-I14-single-chain',
  sourceStorage: input, sourceStorageSha256: sha(input), steps: plan.steps.slice(firstOrdinal - 1, firstOrdinal + 11), freshItemIds, ancestorRunIds };
fs.mkdirSync(out); write(path.join(out, 'batch-input.json'), { batch, plan: binding(planPath), input: binding(input), continuation: row, environment: environment() });
const env = { ...process.env, GAME_URL: plan.gameUrl, QA_OUTPUT_DIR: out, QA_STORAGE_STATE: input, QA_GRADES: 'i14', QA_RUNS: '12',
  QA_I14_SCHEDULE: JSON.stringify(row.steps.map(step => step.grade)), QA_I14_PREPARATION: JSON.stringify(row.steps[0].preparation), QA_I14_CONTINUATION: JSON.stringify(row),
  QA_SEARCH_LIMIT: '6', QA_POST_RETURN_MANAGEMENT: '1', QA_ENTRY_WAIT: '600', QA_ORDINAL_START: String(firstOrdinal),
  QA_WORLD_ID: '', QA_SEED: '', QA_CONTROLLED_BUILD: '', QA_REPRO_IDENTITY_FILE: '', QA_REPLAY_INPUTS: '',
  CHROME_PATH: plan.environment.chromePath, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' };
const check = spawnSync(process.execPath, ['--import', 'tsx', journey, '--check-return-policy'], { env, encoding: 'utf8' });
write(path.join(out, 'return-policy-check.json'), { exitCode: check.status, stdout: check.stdout, stderr: check.stderr }); assert.equal(check.status, 0, check.stderr);
const fd = fs.openSync(path.join(out, 'process.log'), 'wx');
const execution = { batch, firstOrdinal, startedAt: new Date().toISOString(), status: 'running', planSha256: sha(planPath), input: binding(input), environment: environment() };
const executionFile = path.join(out, 'execution.json'), save = () => fs.writeFileSync(executionFile, JSON.stringify(execution, null, 2) + '\n'); save();
try { execution.exitCode = await new Promise((resolve, reject) => { const child = spawn(process.execPath, ['--import', 'tsx', journey], { env, stdio: ['ignore', fd, fd] });
  execution.childPid = child.pid; save(); child.once('error', reject); child.once('close', resolve); }); }
catch (error) { execution.error = String(error); execution.exitCode = -1; }
finally { fs.closeSync(fd); }
const reportFile = path.join(out, 'report.json'), report = fs.existsSync(reportFile) ? read(reportFile) : null;
execution.report = report ? binding(reportFile) : null; execution.actualAttempts = report?.realJourneyAttempts.length ?? 0;
execution.completed = report?.realJourneyAttempts.filter(row => row.status === 'completed-real-input').length ?? 0;
execution.status = execution.exitCode === 0 && execution.completed === 12 ? 'completed' : 'failed-preserved-no-replacement';
execution.finishedAt = new Date().toISOString(); save();
console.log(`I14 batch${batch}: ${execution.status}, ${execution.completed}/12`);
if (execution.status !== 'completed') process.exitCode = 1;
