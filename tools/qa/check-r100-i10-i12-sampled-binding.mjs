#!/usr/bin/env node
/** Eight actual-evidence semantic checks under the explicit user sampling amendment.
 * A fresh complete dry proposal is mandatory. No browser, ledger write, invented
 * report, full89 claim, or modification of the preserved full checker occurs.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildProposal} from './r100-bind-i10-i12.mjs';
import {createScenario, classifyRejection} from './check-r100-i10-i12-final-binding.mjs';
import {SAMPLING_AMENDMENT} from './r100-sampled-acceptance.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SELF = 'tools/qa/check-r100-i10-i12-sampled-binding.mjs';
const BINDER = 'tools/qa/r100-bind-i10-i12.mjs', LEDGER = 'docs/progress/rift-r100.json';
const sha = value => createHash('sha256').update(value).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const clone = value => structuredClone(value);
const CASES = [
  {name: 'unauthorized-sampling-amendment', axis: 'authorization', rejectAt: {functions: ['samplingForPlan'], message: 'exact human-authorized root amendment'},
    mutate(test) {const value = test.read.receipt(test.plan.samplingAmendment); value.authorization.quote = 'synthetic unauthorized instruction'; test.reseal(test.plan.samplingAmendment, value);}},
  {name: 'production-served-source-missing', axis: 'source-binding', rejectAt: {functions: ['validateRuntimeBinding']},
    mutate(test) {test.mutateBinding('production', value => {const key = Object.keys(value.afterServedHashes).find(key => key.startsWith('src/')); assert(key); delete value.afterServedHashes[key];});}},
  {name: 'lifecycle-wrong-method-harness', axis: 'method-binding', rejectAt: {functions: ['validateRuntimeBinding'], message: 'wrong runtime harness'},
    mutate(test) {test.mutateBinding('lifecycle', value => {const file = 'tools/qa/check-r100-runtime-budget.mjs'; value.harness = {path: file, sha256: sha(test.read.bytes(file))};});}},
  {name: 'budget-completed-subset-missing', axis: 'budget', rejectAt: {functions: ['validateSampledBudget'], message: 'completed subset differs'},
    mutate(test) {test.mutateTop('budget', value => {assert.equal(value.cases.length, 74); value.cases.pop();});}},
  {name: 'budget-original-cpu-threshold', axis: 'budget', rejectAt: {functions: ['validateBudgetMeasurements'], message: 'CPU P95 exceeds 12ms'},
    mutate(test) {test.mutateTop('budget', value => {const stats = value.cases[0].cpu; stats.p95 = 12.01; stats.p99 = Math.max(stats.p99, stats.p95); stats.max = Math.max(stats.max, stats.p99);});}},
  {name: 'lifecycle-mixed-order-changed', axis: 'lifecycle', rejectAt: {functions: ['validateSampledLifecycle'], message: 'mixed order differs'},
    mutate(test) {test.mutateTop('lifecycle', value => {const rows = value.mixedCoverage; [rows[0], rows[1]] = [rows[1], rows[0]];});}},
  {name: 'lifecycle-active-resources-grow', axis: 'lifecycle', rejectAt: {functions: ['validateLifecycleMeasurements'], message: 'active resources did not return to baseline'},
    mutate(test) {test.mutateTop('lifecycle', value => {const row = value.samples[1].objects.Texture; row.active++; row.live = Math.max(row.live, row.active); row.created = Math.max(row.created, row.live);});}},
  {name: 'shader-unreviewed-sample', axis: 'shader', rejectAt: {functions: ['validateShaderReview'], message: 'does not concern the observed counts'},
    mutate(test) {test.mutateTop('shaderReview', value => {assert.equal(value.reviewedShaderSamples.length, 12); value.reviewedShaderSamples.pop();});}},
];
export function sampledCaseInventory() {return CASES.map(({mutate, ...row}) => clone(row));}

function syncSampledRefs(test) {
  // Keep derived receipt edges coherent; failures must be semantic, not stale SHA.
  const stop = test.read.receipt(test.plan.budgetStop), binding = test.bindingFor('budget');
  stop.originalReport = clone(test.plan.budget); stop.originalSourceBinding = clone(binding.ref);
  const consistency = test.read.receipt(stop.sourceConsistency); consistency.originalBinding = clone(binding.ref);
  test.reseal(stop.sourceConsistency, consistency); test.reseal(test.plan.budgetStop, stop);
  const review = test.read.receipt(test.plan.technicalReview);
  for (const key of ['samplingAmendment', 'budgetStop', 'runtimeBindings']) review.evidence[key] = clone(test.plan[key]);
  test.reseal(test.plan.technicalReview, review);
}

function repositoryPath(file) {
  assert.equal(typeof file, 'string');
  const relative = path.relative(ROOT, path.resolve(ROOT, file));
  assert(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Outside repository: ${file}`);
  return relative;
}

function recordedInputs() {
  const originals = new Map();
  function target(file) {
    const relative = repositoryPath(file), resolved = fs.realpathSync(path.join(ROOT, relative));
    repositoryPath(resolved); assert(fs.statSync(resolved).isFile(), `Expected file: ${file}`);
    return {relative, resolved};
  }
  return {
    bytes(file) {
      const {relative, resolved} = target(file);
      if (!originals.has(relative)) originals.set(relative, fs.readFileSync(resolved));
      return originals.get(relative);
    },
    exists(file) {return fs.existsSync(path.join(ROOT, repositoryPath(file)));},
    unchanged() {
      for (const [file, before] of originals) assert(fs.readFileSync(target(file).resolved).equals(before), `Input changed during check: ${file}`);
    },
    receipts() {return [...originals].sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => ({path: file, sha256: sha(bytes)}));},
  };
}

function registerModuleSources(inputs) {
  const visited = new Set();
  function visit(file) {
    file = repositoryPath(file); if (visited.has(file)) return; visited.add(file);
    const source = inputs.bytes(file).toString('utf8');
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      const next = path.join(path.dirname(file), match[1]); if (/\.(?:mjs|cjs|js|ts)$/.test(next)) visit(next);
    }
  }
  visit(SELF); inputs.bytes(LEDGER); inputs.bytes('package-lock.json');
  return [...visited].sort();
}

function outputDestination(output) {
  const relative = repositoryPath(output), destination = path.join(ROOT, relative);
  assert(!fs.existsSync(destination), 'Preserve previous receipts; choose a new output path');
  let parent = path.dirname(destination);
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  const actualParent = fs.realpathSync(parent);
  assert(actualParent === ROOT || repositoryPath(actualParent), 'Output parent outside repository');
  return destination;
}

function writeReport(destination, report) {
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, encode(report), {flag: 'wx'});
}

function frozenFilesExact(source) {
  assert(source.temporaryRoot && path.isAbsolute(source.temporaryRoot));
  const rows = Object.entries(source.sources).sort(([a], [b]) => a.localeCompare(b));
  assert.equal(rows.length, 1397, 'Use the actual frozen final108 source');
  for (const [file, expected] of rows) {
    assert(!path.isAbsolute(file) && !file.split('/').includes('..'));
    assert.equal(sha(fs.readFileSync(path.join(source.temporaryRoot, file))), expected, `Frozen source changed during checks: ${file}`);
  }
  return {files: rows.length, sourceMapSha256: sha(encode(rows)), exact: true};
}

export function checkSampledBinding(planFile, output) {
  const destination = outputDestination(output), inputs = recordedInputs(), planPath = repositoryPath(planFile);
  const report = {version: 1, status: 'running', validationMode: 'sampled', full89Claim: false,
    startedAt: new Date().toISOString(), baseline: null, cases: [], caseCountRequired: 8,
    scope: 'Actual final108 proposal plus eight user-authorized semantic samples; original full89 inventory preserved but not executed.'};
  let source, failed = false;
  try {
    report.executableModules = registerModuleSources(inputs);
    const plan = JSON.parse(inputs.bytes(planPath));
    report.plan = {path: planPath, sha256: sha(inputs.bytes(planPath))};
    report.binder = {path: BINDER, sha256: sha(inputs.bytes(BINDER))}; report.checker = {path: SELF, sha256: sha(inputs.bytes(SELF))};
    assert.deepEqual(plan.samplingAmendment, SAMPLING_AMENDMENT); report.samplingAmendment = clone(plan.samplingAmendment);
    const baseline = createScenario(plan, inputs); source = baseline.read.receipt(plan.finalSource);
    report.frozenBefore = frozenFilesExact(source);
    const result = buildProposal(baseline.plan, baseline.read);
    assert.deepEqual(baseline.edits(), []); assert.deepEqual(baseline.plan, plan);
    assert.equal(result.summary.validationMode, 'sampled'); assert.equal(result.summary.counts.qualified, 108);
    assert.equal(result.summary.counts.productionGradeCases, 324); assert.equal(result.summary.counts.humanApproved, 0);
    report.baseline = {status: 'pass', counts: result.summary.counts, accounting: result.summary.accounting,
      proposedLedgerSha256: sha(encode(result.proposed)), addedEvidence: result.summary.addedEvidence, checkedReceiptCount: baseline.checkedReceipts.length};
    console.log('PASS unchanged actual sampled final108 proposal');
    for (const spec of CASES) {
      const test = createScenario(plan, inputs), row = {...sampledCaseInventory().find(value => value.name === spec.name), status: 'failed'};
      try {
        spec.mutate(test); syncSampledRefs(test); assert(test.edits().length > 0, 'No actual evidence mutation');
        let error; try {buildProposal(test.plan, test.read);} catch (caught) {error = caught;}
        const verdict = classifyRejection(error, spec.rejectAt);
        Object.assign(row, verdict, {status: verdict.ok ? 'pass' : 'failed', error: error ? String(error) : null, stack: error?.stack ?? null});
      } catch (error) {Object.assign(row, {ok: false, actual: 'mutation-setup-failed', error: String(error), stack: error.stack});}
      row.edits = test.edits(); row.checkedReceiptCount = test.checkedReceipts.length; row.planSha256 = sha(encode(test.plan));
      report.cases.push(row); if (!row.ok) failed = true;
      console.log(`${row.ok ? 'PASS' : 'FAIL'} ${row.name}: ${row.actual}`);
    }
    assert.equal(report.cases.length, 8); assert(!failed, 'A sampled negative failed or rejected at the wrong predicate');
    report.status = 'pass-sampled';
  } catch (error) {failed = true; report.status = 'failed'; report.failure = String(error); report.failureStack = error.stack;}
  finally {
    try {inputs.unchanged(); report.actualInputsUnchanged = true;
      if (source && report.frozenBefore) {report.frozenAfter = frozenFilesExact(source); assert.deepEqual(report.frozenAfter, report.frozenBefore);}
    } catch (error) {failed = true; report.status = 'failed'; report.preservationFailure = String(error);}
    report.inputs = inputs.receipts(); report.endedAt = new Date().toISOString(); writeReport(destination, report);
  }
  return {report, failed};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--list') console.log(JSON.stringify({status: 'prepared-only', cases: sampledCaseInventory()}, null, 2));
  else {
    assert.equal(args.length, 4, 'Usage: --plan <actual-final-plan> --output <new-report>; or --list');
    const at = name => {const index = args.indexOf(name); assert(index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')); return args[index + 1];};
    const result = checkSampledBinding(at('--plan'), at('--output')); if (result.failed) process.exitCode = 1;
  }
}
