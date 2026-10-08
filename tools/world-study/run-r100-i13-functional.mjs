/** One qualified natural severe trip and at most two low recovery trips.
 * Separate freeze, executable and evidence; no old sample or policy is replaced.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { checkFunctionalSelection } from './r100-i13-functional-policy.mjs';

const parent = 'docs/qa/artifacts/r100-i13-continuation';
const root = path.join(parent, 'functional-selection');
const planPath = path.join(root, 'policy-freeze.json');
const journey = 'tools/world-study/r100-i13-functional-journey.mjs';
const read = file => JSON.parse(fs.readFileSync(file));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const binding = file => ({ file, sha256: sha(file) });
const dependencies = [journey, 'tools/world-study/r100-i13-functional-policy.mjs', 'tools/world-study/run-r100-i13-functional.mjs',
  'tools/world-study/r100-i13-continuation-encounters.mjs', 'tools/world-study/r100-i13-continuation-policy.mjs',
  'tools/qa/r100-i09-tool-slots.mjs', 'tools/qa/r100-observed-searches.mjs', 'tools/qa/i27-journey-driver.mjs'];

if (process.argv.includes('--self-check')) {
  for (const file of dependencies) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  console.log(JSON.stringify({ syntaxFiles: dependencies.length, selection: checkFunctionalSelection() }));
  process.exit(0);
}

if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(planPath), 'Do not replace a frozen plan');
  assert.equal(read(path.join(parent, 'execution.json')).status, 'completed', 'The previous batch must finish first');
  const qaPath = path.join(parent, 'qa-functional-preflight.json'), qa = read(qaPath);
  assert.equal(qa.status, 'qualified-for-one-natural-severe-and-at-most-two-low-followups');
  assert.equal(qa.serviceDebt, 0);
  assert(qa.fifoEligibleSelection.survey.power >= 128 && qa.fifoEligibleSelection.survey.uses >= 2);
  assert(qa.fifoEligibleSelection.dash.power >= 48 && qa.fifoEligibleSelection.dash.uses >= 3);
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
  const previousReport = read(path.join(parent, 'a-new-directions/report.json'));
  const terminal = previousReport.realJourneyAttempts.at(-1), previousCase = prior.cases.find(row => row.id === 'a-new-directions');
  assert.equal(terminal.status, 'completed-real-input'); assert.deepEqual(terminal.afterPreparation.state, JSON.parse(raw).state ?? JSON.parse(raw));
  const family = (family, minimumPower, minimumUses) => ({ family, minimumPower, minimumUses });
  const passive = { name: '黄铜背扣' };
  const information = { id: 'public-eligible-information-and-dash-fifo', active: [family('survey', 128, 2), family('dash', 48, 3)], passive };
  const control = { id: 'public-eligible-control-fifo', active: [family('suppress', 3, 2), family('solidify', 2.5, 2)], passive };
  const budget = previousCase.steps[0].budget;
  const steps = [{ grade: 'severe', preparation: information, requiredUses: [2, 3], surveyDecision: true, budget },
    ...Array.from({ length: 2 }, () => ({ grade: 'low', preparation: control, surveyDecision: false, budget }))];
  fs.mkdirSync(root, { recursive: true });
  const input = path.join(root, 'earned-storage.json');
  fs.writeFileSync(input, JSON.stringify(rawStorage, null, 2) + '\n', { flag: 'wx' });
  const caseRow = { id: 'a-qualified-functional', sourceBranch: 'A', sourceStorage: qa.sourceStorage.path,
    sourceStorageSha256: sha(qa.sourceStorage.path), sourceTerminal: qa.sourceTerminal,
    input, inputSha256: sha(input), steps, searchLimit: 6,
    ancestorRunIds: [...previousCase.ancestorRunIds, ...previousReport.realJourneyAttempts.map(row => row.entrySave.state.inventory.run.id)],
    freshItemIds: terminal.freshAcquisitionOrder.map(row => row.id), initialReserve: qa.reserve, initialModules: qa.modules,
    expectedInitialSelection: qa.fifoEligibleSelection };
  const plan = { version: 1, createdAt: new Date().toISOString(), maxAttempts: 3, maxContexts: 1, gameUrl: prior.gameUrl,
    authorization: 'Root explicitly approved only this causal selection correction after batch14 and independent trueA4 readiness qualification: one natural severe plus at most two low recovery, no acquisition trip.',
    preflight: binding(qaPath), sourceManifest: prior.sourceManifest,
    dependencies: dependencies.map(binding), immutablePriorSources: [...prior.dependencies, ...prior.immutablePriorSources,
      binding(path.join(parent, 'policy-freeze.json')), binding(path.join(parent, 'execution.json')), binding(path.join(parent, 'batch14-execution-receipt.json'))],
    taskContract: binding('docs/tasks/rift-r100-i13.md'), cases: [caseRow], limits: [
      'Selection first filters actual public family/power/single-item uses, then uses actual branch acquisition FIFO. No hidden catalog selection.',
      'Initial severe needs service51/100/51, survey128px and2uses, dash48px and3uses. Source qualified independently before freezing.',
      'Low recovery chooses public suppress>=3seconds and solidify>=2.5seconds, each one item>=2uses before departure.',
      'Original normal per-slot1 and actually visible near attack emergency dash policy is unchanged, including all overspend and losses.',
      'Routes, survey decision, cost, maintenance, FIFO offering and growth remain the completed14 policy.',
      'All three destinations use normal production world selection; no fixed world/seed, no replacement or grant.',
      'Keep old planned severe downgrade unchanged; this is a separately disclosed causal method correction, not a rewrite or unlimited sustainability proof.'
    ] };
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log('Frozen independently qualified natural severe plus two low recovery trips'); process.exit(0);
}

assert(process.argv.includes('--run'), 'Use --self-check, --freeze or --run');
const plan = read(planPath);
for (const row of [...plan.dependencies, ...plan.immutablePriorSources, plan.preflight, plan.sourceManifest]) assert.equal(sha(row.file), row.sha256, row.file);
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
result.status = result.exitCode === 0 && result.completed === 3 ? 'completed' : 'failed';
execution.status = result.status; execution.finishedAt = new Date().toISOString(); save();
console.log(result.id, result.status, result.completed + '/3');
if (result.status !== 'completed') process.exitCode = 1;
