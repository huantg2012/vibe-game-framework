/** A19 pursuit-control plus dash: one natural severe and up to two low recovery trips.
 * Separate freeze, executable and evidence; no old sample or policy is replaced.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { checkFunctionalSelection } from './r100-i13-functional-policy.mjs';
import { checkPursuitPolicy } from './r100-i13-pursuit-policy.mjs';

const parent = 'docs/qa/artifacts/r100-i13-continuation';
const root = path.join(parent, 'a-pursuit-window');
const planPath = path.join(root, 'policy-freeze.json');
const journey = 'tools/world-study/r100-i13-pursuit-journey.mjs';
const read = file => JSON.parse(fs.readFileSync(file));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const binding = file => ({ file, sha256: sha(file) });
const dependencies = [journey, 'tools/world-study/r100-i13-functional-policy.mjs', 'tools/world-study/run-r100-i13-pursuit.mjs', 'tools/world-study/r100-i13-pursuit-policy.mjs',
  'tools/world-study/r100-i13-pursuit-encounters.mjs', 'tools/world-study/r100-i13-continuation-policy.mjs',
  'tools/qa/r100-i09-tool-slots.mjs', 'tools/qa/r100-observed-searches.mjs', 'tools/qa/i27-journey-driver.mjs'];

if (process.argv.includes('--self-check')) {
  for (const file of dependencies) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  }
  console.log(JSON.stringify({ syntaxFiles: dependencies.length, selection: checkFunctionalSelection(), pursuit: checkPursuitPolicy() }));
  process.exit(0);
}

if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(planPath), 'Do not replace a frozen plan');
  assert.equal(read(path.join(parent, 'execution.json')).status, 'completed', 'The previous batch must finish first');
  const qaPath = path.join(parent, 'qa-a-pursuit-preflight.json'), qa = read(qaPath);
  assert.equal(qa.status, 'qualified-A19-fresh-four-second-solidify-and-dash');
  assert.equal(qa.serviceDebt, 0);
  assert(qa.fifoEligibleSelection.solidify.power >= 4000 && qa.fifoEligibleSelection.solidify.uses >= 4);
  assert(qa.fifoEligibleSelection.dash.power >= 48 && qa.fifoEligibleSelection.dash.uses >= 3);
  for (const row of [...qa.sources, qa.sourceTerminal, qa.sourceStorage]) assert.equal(sha(row.path), row.sha256, row.path);
  const rawStorage = read(qa.sourceStorage.path), raw = rawStorage.origins[0].localStorage.find(row => row.name === 'coh-save-v1').value;
  assert.deepEqual(JSON.parse(raw), read(qa.sourceTerminal.path));
  assert.equal(rawStorage.origins.length, 1); assert.equal(rawStorage.cookies.length, 0);
  rawStorage.origins[0].origin = 'http://127.0.0.1:3033';
  assert.equal(rawStorage.origins[0].localStorage.find(row => row.name === 'coh-save-v1').value, raw);
  const prior = read(path.join(parent, 'functional-selection/policy-freeze.json'));
  for (const row of [...prior.dependencies, ...prior.immutablePriorSources, prior.sourceManifest]) assert.equal(sha(row.file), row.sha256, row.file);
  const manifest = read(prior.sourceManifest.file);
  for (const [file, hash] of Object.entries(manifest.sources)) assert.equal(sha(file), hash, file);
  const previousReport = read(path.join(parent, 'functional-selection/a-qualified-functional/report.json'));
  const terminal = previousReport.realJourneyAttempts.at(-1), previousCase = prior.cases.find(row => row.id === 'a-qualified-functional');
  assert.equal(terminal.status, 'completed-real-input'); assert.deepEqual(terminal.afterPreparation.state, JSON.parse(raw).state ?? JSON.parse(raw));
  const family = (family, minimumPower, minimumUses) => ({ family, minimumPower, minimumUses });
  const passive = { name: '黄铜背扣' };
  const information = { id: 'public-fresh-four-second-control-and-dash', active: [family('solidify', 4, 4), family('dash', 48, 3)], passive };
  const control = { id: 'public-eligible-four-second-control-and-dash-recovery', active: [family('solidify', 4, 2), family('dash', 48, 2)], passive };
  const budget = { ...previousCase.steps[0].budget, controlMaxPerTrip: 2, controlRoles: { transit: 1, search: 1 }, minimumPower: { ...previousCase.steps[0].budget.minimumPower, solidify: 4 } };
  const steps = [{ grade: 'severe', preparation: information, requiredUses: [4, 3], surveyDecision: false, budget },
    ...Array.from({ length: 2 }, () => ({ grade: 'low', preparation: control, surveyDecision: false, budget }))];
  fs.mkdirSync(root, { recursive: true });
  const input = path.join(root, 'earned-storage.json');
  fs.writeFileSync(input, JSON.stringify(rawStorage, null, 2) + '\n', { flag: 'wx' });
  const caseRow = { id: 'a-pursuit-control', sourceBranch: 'A', stopAfterLowPreparation: true, recoveryFunctions: [{family:'solidify',minimumPower:4},{family:'dash',minimumPower:48}], sourceStorage: qa.sourceStorage.path,
    sourceStorageSha256: sha(qa.sourceStorage.path), sourceTerminal: qa.sourceTerminal,
    input, inputSha256: sha(input), steps, searchLimit: 6,
    ancestorRunIds: [...previousCase.ancestorRunIds, ...previousReport.realJourneyAttempts.map(row => row.entrySave.state.inventory.run.id)],
    freshItemIds: terminal.freshAcquisitionOrder.map(row => row.id), initialReserve: qa.reserve, initialModules: qa.modules,
    expectedInitialSelection: qa.fifoEligibleSelection };
  const taskCopy = path.join(root, 'task-preregistration.md'); fs.writeFileSync(taskCopy, fs.readFileSync('docs/tasks/rift-r100-i13.md'), { flag: 'wx' });
  const plan = { version: 1, createdAt: new Date().toISOString(), maxAttempts: 3, maxContexts: 1, gameUrl: prior.gameUrl,
    authorization: 'Root approved this separately preregistered A19 new pursuit-control/dash direction and explicitly changed Q normal budget1 to two conditional roles. At most one natural severe then two low, no acquisition trip, no B route-policy changes.',
    preflight: binding(qaPath), sourceManifest: prior.sourceManifest,
    dependencies: dependencies.map(binding), immutablePriorSources: [...prior.dependencies, ...prior.immutablePriorSources,
      binding('tools/world-study/r100-i13-functional-journey.mjs'), binding(path.join(parent, 'functional-selection/policy-freeze.json')), binding(path.join(parent, 'functional-selection/execution.json')), binding(path.join(parent, 'functional-selection/execution-receipt.json'))],
    taskContract: binding(taskCopy), originalTaskAtFreeze: binding('docs/tasks/rift-r100-i13.md'), cases: [caseRow], limits: [
      'TrueA19 service53/102/53 cash32, fresh four-second pocket watch4 and dash48px3 are independently qualified. Initial severe requires equipped4/3 and service51/100/51.',
      'Q normal budget explicitly changes1 to at most2: one currently visible pursuit-blocked short leg and one actual search window. Each role at most1. Every use must leave a real public four-second same-function single item>=2.',
      'Transit: current visible enemy<=110px, approaching through normal consecutive observations or windup/active, blocking actual planned visible28px segment under existing proximity/facing danger. No enemy luring or hidden pursuit state.',
      'Only actual successful own sourceInstanceId/effectId/targetId with controlActive and positive remaining time may leave the temporary decision threat set; raw normal visible enemies remain logged. Control break or expiry revokes permission.',
      'Controlled input is reobserved after at most24px/140ms, stricter than28px/450ms. Other threats and Host remain; Space is prohibited while own control active to avoid breaking it.',
      'F normal1 plus original actual-near-attack emergency remains; old A route/exit/search/time/economy policies unchanged. No B reconsideration or second region policy included.',
      'Low followups use public four-second control/dash48px each single item>=2, FIFO, missing function empty. After first actual low stop if serviceD0 and ordinary2/2 preparation exists; otherwise second low ends the batch.',
      'Ordinary2/2 preparation is distinct from next severe4/3 admission. All worlds naturally random, no added acquisition, grant, reroll or replacement.'

    ] };
  fs.writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log('Frozen A19 pursuit-control direction: one natural severe and up to two low recovery trips'); process.exit(0);
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
result.status = result.exitCode === 0 && (result.completed === 3 || (result.completed > 0 && result.plannedStop)) ? 'completed' : 'failed';
execution.status = result.status; execution.finishedAt = new Date().toISOString(); save();
console.log(result.id, result.status, result.completed + '/3');
if (result.status !== 'completed') process.exitCode = 1;
