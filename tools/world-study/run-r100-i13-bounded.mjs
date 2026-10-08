/** At most four genuineB low trips with bounded re-evaluation and service recovery.
 * Separate freeze, executable and evidence; no old sample or policy is replaced.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { checkFunctionalSelection } from './r100-i13-functional-policy.mjs';
import { checkRetryPolicy } from './r100-i13-retry-policy.mjs';

const parent = 'docs/qa/artifacts/r100-i13-continuation';
const root = path.join(parent, 'b-bounded-recovery');
const planPath = path.join(root, 'policy-freeze.json');
const journey = 'tools/world-study/r100-i13-bounded-journey.mjs';
const read = file => JSON.parse(fs.readFileSync(file));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const binding = file => ({ file, sha256: sha(file) });
const dependencies = [journey, 'tools/world-study/r100-i13-functional-policy.mjs', 'tools/world-study/run-r100-i13-bounded.mjs', 'tools/world-study/r100-i13-retry-policy.mjs',
  'tools/world-study/r100-i13-continuation-encounters.mjs', 'tools/world-study/r100-i13-continuation-policy.mjs',
  'tools/qa/r100-i09-tool-slots.mjs', 'tools/qa/r100-observed-searches.mjs', 'tools/qa/i27-journey-driver.mjs'];

if (process.argv.includes('--self-check')) {
  for (const file of dependencies) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  console.log(JSON.stringify({ syntaxFiles: dependencies.length, selection: checkFunctionalSelection(), retry: checkRetryPolicy() }));
  process.exit(0);
}

if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(planPath), 'Do not replace a frozen plan');
  assert.equal(read(path.join(parent, 'execution.json')).status, 'completed', 'The previous batch must finish first');
  const qaPath = path.join(parent, 'qa-b-retry-preflight.json'), qa = read(qaPath);
  assert.equal(qa.status, 'exact-B11-debt-preserving-recovery-source-verified');
  assert.equal(qa.serviceDebt, 24); assert.equal(qa.reserve, 0);
  assert.deepEqual(qa.modules.map(module => module.hp), [31, 24, 52]);
  for (const row of [...qa.sources, qa.sourceTerminal, qa.sourceStorage]) assert.equal(sha(row.path), row.sha256, row.path);
  const rawStorage = read(qa.sourceStorage.path), raw = rawStorage.origins[0].localStorage.find(row => row.name === 'coh-save-v1').value;
  assert.deepEqual(JSON.parse(raw), read(qa.sourceTerminal.path));
  assert.equal(rawStorage.origins.length, 1); assert.equal(rawStorage.cookies.length, 0);
  rawStorage.origins[0].origin = 'http://127.0.0.1:3033';
  assert.equal(rawStorage.origins[0].localStorage.find(row => row.name === 'coh-save-v1').value, raw);
  const prior = read(path.join(parent, 'policy-freeze.json'));
  for (const row of [...prior.dependencies, ...prior.immutablePriorSources, prior.sourceManifest]) assert.equal(sha(row.file), row.sha256, row.file);
  const manifest = read(prior.sourceManifest.file);
  for (const [file, hash] of Object.entries(manifest.sources)) assert.equal(sha(file), hash, file);
  const previousReport = read(path.join(parent, 'b-service-recovery/report.json'));
  const terminal = previousReport.realJourneyAttempts.at(-1), previousCase = prior.cases.find(row => row.id === 'b-service-recovery');
  assert.equal(terminal.status, 'completed-real-input'); assert.deepEqual(terminal.afterPreparation.state, JSON.parse(raw).state ?? JSON.parse(raw));
  const family = (family, minimumPower, minimumUses) => ({ family, minimumPower, minimumUses });
  const passive = { name: '黄铜背扣' };
  const preparation = { id: 'public-eligible-silence-and-dash-fifo', active: [family('silence', 5, 2), family('dash', 48, 2)], passive };
  const budget = previousCase.steps[0].budget;
  const steps = Array.from({ length: 4 }, () => ({ grade: 'low', preparation, surveyDecision: false, budget }));
  fs.mkdirSync(root, { recursive: true });
  const input = path.join(root, 'earned-storage.json');
  fs.writeFileSync(input, JSON.stringify(rawStorage, null, 2) + '\n', { flag: 'wx' });
  const caseRow = { id: 'b-bounded-functional', sourceBranch: 'B', stopAtService: true, sourceStorage: qa.sourceStorage.path,
    sourceStorageSha256: sha(qa.sourceStorage.path), sourceTerminal: qa.sourceTerminal,
    input, inputSha256: sha(input), steps, searchLimit: 6,
    ancestorRunIds: [...previousCase.ancestorRunIds, ...previousReport.realJourneyAttempts.map(row => row.entrySave.state.inventory.run.id)],
    freshItemIds: terminal.freshAcquisitionOrder.map(row => row.id), initialReserve: qa.reserve, initialModules: qa.modules,
    expectedInitialSelection: qa.fifoEligibleSelection };
  const taskCopy = path.join(root, 'task-preregistration.md'); fs.writeFileSync(taskCopy, fs.readFileSync('docs/tasks/rift-r100-i13.md'), { flag: 'wx' });
  const plan = { version: 1, createdAt: new Date().toISOString(), maxAttempts: 4, maxContexts: 1, gameUrl: prior.gameUrl,
    authorization: 'Root explicitly approved B11 true-debt continuation for at most4 low trips with eligible functional preparation plus bounded public-observation target reconsideration and second pure geometry direction. Stop immediately when service51/100/51 is restored; no random extra acquisition runs.',
    preflight: binding(qaPath), sourceManifest: prior.sourceManifest,
    dependencies: dependencies.map(binding), immutablePriorSources: [...prior.dependencies, ...prior.immutablePriorSources,
      binding('tools/world-study/r100-i13-functional-journey.mjs'), binding(path.join(parent, 'policy-freeze.json')), binding(path.join(parent, 'execution.json')), binding(path.join(parent, 'batch14-execution-receipt.json'))],
    taskContract: binding(taskCopy), originalTaskAtFreeze: binding('docs/tasks/rift-r100-i13.md'), cases: [caseRow], limits: [
      'Combined method correction: eligible public silence>=5seconds/dash>=48px with single-item2uses before actual branch FIFO; unavailable functions remain empty. Ancestor replacements retain their provenance.',
      'At most2 attempts per normally observed target. Retry requires at least5seconds and movement>=48px or another successful search, plus fresh normal blocker movement>=32px or natural5second memory expiry. No stationary cooldown wait.',
      'If no explicit enemy originally blocked, move to a new observation point and normally see the target again; original live caution must still permit approach/search.',
      'A second failed target attempt stays deferred for the trip. Original52px proximity and88px facing threat gates remain.',
      'At most2 distinct geometry exploration goals; second is full-body reachable,>=128px from actual walked footprint and chosen by least visited256px neighborhood, then shortest body path. No node or enemy inputs.',
      'At most18 outer decisions. Original hp30/chaos120/return145,25second target approach,42second geometry and6actual pickups always take precedence.',
      'Normal1 per active slot, observed near-attack emergency expenditure, fixed service repair order, real offering FIFO and growth are unchanged.',
      'B starts truecash0/modules31,24,52/serviceDebt24; original service51/100/51 restoration stops the batch immediately. At most4low; no reset, grant, replacement, A-stock transfer or chosen world.',
      'This does not retrospectively rewrite any failed recovery and is not a single-factor route causal estimate.'

    ] };
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log('Frozen independent B debt-preserving bounded recovery, at most4low'); process.exit(0);
}

assert(process.argv.includes('--run'), 'Use --self-check, --freeze or --run');
const plan = read(planPath);
for (const row of [...plan.dependencies, ...plan.immutablePriorSources, plan.preflight, plan.sourceManifest, plan.taskContract]) assert.equal(sha(row.file), row.sha256, row.file);
const row = plan.cases[0], executionPath = path.join(root, 'execution.json');
assert(!fs.existsSync(executionPath), 'No hidden retry or replacement');
assert.equal(sha(row.input), row.inputSha256); assert.equal(sha(row.sourceStorage), row.sourceStorageSha256);
const out = path.join(root, row.id); assert(!fs.existsSync(out)); fs.mkdirSync(out);
const execution = { startedAt: new Date().toISOString(), planSha256: sha(planPath), status: 'running', cases: [{ ...row, status: 'running' }] };
const save = () => fs.writeFileSync(executionPath, JSON.stringify(execution, null, 2) + '\n'); save();
const fd = fs.openSync(path.join(out, 'process.log'), 'wx');
const env = { ...process.env, GAME_URL: plan.gameUrl, QA_OUTPUT_DIR: out, QA_STORAGE_STATE: row.input, QA_GRADES: 'i13',
  QA_RUNS: String(row.steps.length), QA_I13_SCHEDULE: JSON.stringify(row.steps.map(step => step.grade)),
  QA_I13_PREPARATION: JSON.stringify(row.steps[0].preparation), QA_I13_CONTINUATION: JSON.stringify(row),
  QA_SEARCH_LIMIT: '6', QA_POST_RETURN_MANAGEMENT: '1', QA_ENTRY_WAIT: '600', QA_ORDINAL_START: '1',
  QA_WORLD_ID: '', QA_SEED: '', QA_CONTROLLED_BUILD: '', QA_REPRO_IDENTITY_FILE: '', QA_REPLAY_INPUTS: '', TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' };
const result = execution.cases[0];
try {
  result.exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', journey], { env, stdio: ['ignore', fd, fd] });
    child.once('error', reject); child.once('close', resolve);
  });
} catch (error) { result.error = String(error); result.exitCode = -1; }
finally { fs.closeSync(fd); }
result.report = path.join(out, 'report.json');
const report = fs.existsSync(result.report) ? read(result.report) : null;
result.completed = report?.realJourneyAttempts.filter(trip => trip.status === 'completed-real-input').length ?? 0;
result.plannedStop = report?.plannedStop ?? null;
result.status = result.exitCode === 0 && (result.completed === 4 || (result.completed > 0 && result.plannedStop)) ? 'completed' : 'failed';
execution.status = result.status; execution.finishedAt = new Date().toISOString(); save();
console.log(result.id, result.status, result.completed + '/4');
if (result.status !== 'completed') process.exitCode = 1;
