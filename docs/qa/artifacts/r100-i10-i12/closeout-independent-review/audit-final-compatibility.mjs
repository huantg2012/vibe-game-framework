/** Read-only post-execution audit. Never runs a compatibility check or browser. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = process.cwd();
const directory = 'docs/qa/artifacts/r100-i10-i12/final-compatibility';
const output = 'docs/qa/artifacts/r100-i10-i12/closeout-independent-review/final-compatibility-review.json';
assert(!fs.existsSync(output), 'Preserve prior independent audit');
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const ref = file => ({path: path.relative(root, path.resolve(file)), sha256: hash(file)});
const verify = item => { assert.equal(hash(item.path), item.sha256, item.path); return item; };
const executionPath = `${directory}/execution.json`;
const execution = read(executionPath);
assert.equal(hash(executionPath), 'a78156db7d58858892edaf143ac70861acb78ad718d721efdb7d725101a35d16');
assert.equal(execution.status, 'pass');
assert.deepEqual(execution.errors, []);
verify(execution.source); verify(execution.preparation); verify(execution.runner); verify(execution.sourceBinding);
assert.equal(execution.source.sha256, 'e4477ea30d618f8d3f76bab7379961ee5fb8cc668f580c84385626509bdbd1af');
const source = read(execution.source.path), preparation = read(execution.preparation.path);
const binding = read(execution.sourceBinding.path);
assert.equal(binding.status, 'pass'); assert.deepEqual(binding.source, execution.source);
assert.equal(binding.executionRoot, execution.executionRoot);
assert.equal(binding.sourceRoot, source.temporaryRoot);
assert.equal(execution.enabledWorldCount, 108); assert.equal(binding.enabledWorldCount, 108);
assert.equal(Object.keys(source.sources).length, 1397);
assert.equal(execution.inputFileCount, 73); assert.equal(binding.inputs.length, 73);
assert.equal(preparation.harnessAndSupport.length, 66); assert.equal(preparation.fixtures.length, 7);
assert.equal(execution.checks.length, 5); assert.deepEqual(execution.checks.map(row => row.id), preparation.checks.map(row => row.id));
assert.deepEqual(execution.recoveryRunnerDeclaredSequence, preparation.recoverySequentialChecks);
assert.equal(execution.recoveryRunnerDeclaredSequence.length, 31);
const runnerSource = fs.readFileSync(`${directory}/input-sources/tools/recovery/check.mjs`, 'utf8');
const declared = runnerSource.match(/const checks = (\[[^\n]+\]);/)[1];
assert.deepEqual(JSON.parse(declared.replaceAll("'", '"')), preparation.recoverySequentialChecks);
assert(runnerSource.includes('spawnSync(process.execPath'));
assert(runnerSource.includes('if (result.status !== 0) process.exit(result.status ?? 1);'));

const boundaryRefs = [execution.before, execution.after];
for (const [index, check] of execution.checks.entries()) {
  const expected = preparation.checks[index];
  assert.deepEqual(check.command, expected.command); assert.deepEqual(check.environment, expected.env);
  assert.equal(check.cwd, execution.executionRoot); assert.equal(check.exitCode, 0); assert.equal(check.signal, null);
  assert.equal(check.status, 'pass'); assert.equal(check.log.path, expected.log); verify(check.log);
  assert(Date.parse(check.startedAt) <= Date.parse(check.endedAt));
  if (index > 0) assert(Date.parse(execution.checks[index - 1].endedAt) <= Date.parse(check.startedAt));
  boundaryRefs.push(check.before, check.after);
}
assert.deepEqual(binding.commandBoundaries, execution.checks.map(row => ({id: row.id, before: row.before, after: row.after, log: row.log, exitCode: row.exitCode})));
const boundaries = boundaryRefs.map(item => {
  verify(item); const data = read(item.path);
  assert.equal(data.status, 'pass'); assert.equal(data.runtimeFileCount, 1397);
  assert.deepEqual(data.source, execution.source); assert.deepEqual(data.runtimeFiles, source.sources);
  assert.equal(data.inputs.files.length, 73);
  for (const input of data.inputs.files) {
    assert.equal(input.originalSha256, input.sha256);
    assert.equal(input.stagedSha256, input.sha256);
    assert.equal(input.archivedSha256, input.sha256);
  }
  for (const input of data.inputs.protectedHistoricalOutputs) assert.equal(input.actualSha256, input.sha256);
  return {...item, at: data.at, runtimeFileCount: data.runtimeFileCount, harnessAndFixtureCount: data.inputs.files.length};
});
assert.equal(boundaries.length, 12);
for (const item of binding.inputs) {
  assert.equal(hash(item.original), item.sha256); assert.equal(hash(item.archived), item.sha256);
  assert.equal(hash(item.staged), item.sha256);
}
for (const item of preparation.historicalOutputsToProtect) verify(item);
for (const item of execution.isolatedProducedOutputs) verify(item);
assert.equal(execution.isolatedProducedOutputs.length, 1);
assert.equal(fs.realpathSync(path.join(execution.executionRoot, 'src')), fs.realpathSync(path.join(source.temporaryRoot, 'src')));
assert(!fs.lstatSync(path.join(execution.executionRoot, 'docs')).isSymbolicLink());

const general = fs.readFileSync(`${directory}/general-recovery.log`, 'utf8');
const expectedRecoveryLines = [
  'Async entry: 16 checks passed;',
  'PASS 60 actual revision-2 browser identities and exact world payloads;',
  'PASS frozen generation: 4 v1 and 5 complete-world gold records; each recovered in a fresh process',
  'PASS 100000 interval/exact FMA cases',
  'PASS async generation: 4 v1 + 5 gold cases; frozen new departure; 12/12 workers disposed;',
];
for (const line of expectedRecoveryLines) assert(general.includes(line), line);
assert(!general.includes('AssertionError')); assert(!general.includes('ERR_ASSERTION'));
const controlledTimeouts = [...general.matchAll(/DOMException \[TimeoutError\]: Generation exceeded 60000 ms budget/g)].length;
assert.equal(controlledTimeouts, 2);
assert(general.includes('PASS worker failure preserves the live base and record and unlocks retry'));
assert(general.includes('PASS a changed record is never offered the old outing rescue after Worker failure'));
const grade = read(`${directory}/grade-host.log`);
assert.equal(grade.status, 'pass'); assert.equal(grade.placement.length, 18); assert.equal(grade.exposure.length, 3);
const chaos = fs.readFileSync(`${directory}/frozen-chaos.log`, 'utf8');
assert(chaos.includes('caller mutation, cold resume, grade mismatch, invalid rate and legacy absence passed'));
const recipe = fs.readFileSync(`${directory}/frozen-recipe.log`, 'utf8');
assert(recipe.includes('PASS 3 frozen v3 grades retain identical complete native payloads'));
const contract = fs.readFileSync(`${directory}/revision6-contract.log`, 'utf8');
assert(contract.includes('22 re-sealed invalid native schemas, 23 organization negatives, 28 extended-profile negatives'));

const review = {
  schema: 'coh.qa.final-compatibility-independent-review.v1',
  status: 'pass-five-original-commands-on-final108', reviewedAt: new Date().toISOString(),
  featureIds: ['F052', 'F044', 'F005'], auditor: ref(fileURLToPath(import.meta.url)),
  execution: ref(executionPath), source: execution.source, preparation: execution.preparation,
  sourceBinding: execution.sourceBinding, recoveryRunner: ref(`${directory}/input-sources/tools/recovery/check.mjs`),
  executionFacts: {firstAttemptOnly: true, sequentialCommands: 5, recoveryChildChecks: 31,
    commandExitCodes: execution.checks.map(row => ({id: row.id, exitCode: row.exitCode, elapsedMs: row.elapsedMs, log: row.log})),
    runtimeSourceFileCount: 1397, enabledWorldCount: 108, toolAndSupportFiles: 66, historicalReadFixtures: 7,
    boundaryChecks: boundaries, executionRoot: execution.executionRoot, isolatedProducedOutputs: execution.isolatedProducedOutputs,
    protectedHistoricalOutputs: preparation.historicalOutputsToProtect, dependencyRuntime: execution.dependencyRuntime},
  observedCoverage: {
    recovery: '31 unchanged sequential child checks reached successful runner exit. Logs include 16 async-entry checks, 60 actual prior revision2 browser identities/full payloads, cold v1/v2/unversioned fixtures, arithmetic fallback, actual isolated workers and 12/12 worker cleanup.',
    frozenChaos: chaos.trim(), frozenRecipe: recipe.trim(),
    gradeHost: {scope: grade.scope, admissions: grade.placement.length, grades: grade.exposure.map(row => row.grade)},
    revision6: contract.trim(),
  },
  expectedFailureInjectionObservation: {
    controlledWorkerTimeouts: controlledTimeouts,
    result: 'Both legacy ControlledWorker pre-ack failure scenarios consumed the shared60000ms deadline after product startup retry; raw errors were retained and the corresponding preservation/rescue assertions passed. No command retry or test alteration was performed.',
  },
  limitations: [
    'No browser, GPU, natural48 selection, lifecycle/performance, art/audio or complete I10–I12 acceptance is asserted by these CPU checks.',
    'The source manifest excludes tools/node_modules; exact73 tool/support/fixture bytes were separately copied/archived. Existing installed dependency versions and package-lock are disclosed, not claimed as a frozen dependency archive.',
    'Recovery31 completion is established by the exact sequential runner and exit0 with actual logs; per-child exit telemetry was not inserted.',
    'Historical revision3/4/5 closure continuity remains a separate evidence obligation; these checks must not be relabelled as all342 current+r1 cases.',
  ],
};
fs.writeFileSync(output, JSON.stringify(review, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: review.status, review: ref(output)}));
