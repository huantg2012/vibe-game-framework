import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {SAMPLING_AMENDMENT, samplingForPlan, validateSampledBudget, validateSampledLifecycle, restoreReviewedRevision5Invalidation} from '../../../../../tools/qa/r100-sampled-acceptance.mjs';
import {validateRuntimeBinding} from '../../../../../tools/qa/r100-bind-i10-i12.mjs';
import {validateFinalReport} from '../../../../../tools/qa/r100-i09-final-probe.mjs';
import {sampledCaseInventory} from '../../../../../tools/qa/check-r100-i10-i12-sampled-binding.mjs';
import {gateInputsFor, SAMPLED_COVERAGE} from '../closure-preparation/proposal-builder.mjs';
const base = 'docs/qa/artifacts/r100-i10-i12/', sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = new Map(), bytes = path => {if (!inputs.has(path)) inputs.set(path, fs.readFileSync(path)); return inputs.get(path);};
const ref = path => ({path, sha256: sha(bytes(path))});
const json = path => JSON.parse(bytes(path));
const read = {bytes, json, receipt(value) {assert.equal(sha(bytes(value.path)), value.sha256); return json(value.path);}};
const plan = {samplingAmendment: SAMPLING_AMENDMENT, finalSource: ref(base + 'final-source/source-snapshot.json'),
  budget: ref(base + 'runtime-budget-final108/report.json'), lifecycle: ref(base + 'lifecycle-sampled-final108/report.json'),
  budgetStop: ref(base + 'remaining-runtime-power-execution/budget/user-directed-sampling-stop.json'),
  runtimeBindings: [ref(base + 'runtime-budget-final108/source-binding.json'), ref(base + 'lifecycle-sampled-final108/source-binding.json')]};
const checks = [], output = process.argv[2]; assert(output && !fs.existsSync(output));
let error;
try {
  const amendment = samplingForPlan(plan, read, json(base + 'final-packages/index.json').worlds.map(row => row.worldId));
  const source = read.receipt(plan.finalSource), budget = read.receipt(plan.budget), lifecycle = read.receipt(plan.lifecycle);
  const budgetResult = validateSampledBudget(budget, plan, amendment, read);
  checks.push({name: 'actual completed74 budget metadata and original stop receipts match', status: 'pass', result: budgetResult});
  const lifecycleResult = validateSampledLifecycle(lifecycle, amendment);
  checks.push({name: 'actual sampled lifecycle metadata retains original resource thresholds', status: 'pass', result: lifecycleResult});
  for (const item of plan.runtimeBindings) {const binding = read.receipt(item); validateRuntimeBinding(binding, binding.kind, plan, source, amendment.scopeChanges.lifecycle.catalogWorldIds, bytes, amendment);}
  checks.push({name: 'actual budget and lifecycle method/source-binding metadata', status: 'pass'});
  for (const [kind, value] of [['budget', budget], ['lifecycle', lifecycle]]) assert.throws(() => validateFinalReport(kind, value, amendment.scopeChanges.lifecycle.catalogWorldIds, [], 6), assert.AssertionError);
  checks.push({name: 'unchanged full validator still rejects stopped74 budget and partial lifecycle', status: 'pass'});
  const original = json('docs/progress/rift-r100.json').worlds.find(row => row.invalidated), good = structuredClone(original), bad = structuredClone(original);
  restoreReviewedRevision5Invalidation(good, [good.id], plan); assert.equal(good.invalidated, false); assert.equal(good.invalidationHistory.at(-1).invalidated, true);
  assert.equal(good.invalidationReason, original.invalidationReason); assert.equal(original.invalidated, true);
  bad.invalidationReason = 'unresolved independent defect'; assert.throws(() => restoreReviewedRevision5Invalidation(bad, [bad.id], plan));
  checks.push({name: 'one synthetic copy preserves named old52 invalidation history; unrelated reason rejected', status: 'pass', scope: 'No actual ledger/proposal mutation'});
  const inventory = sampledCaseInventory(); assert.equal(inventory.length, 8); assert.equal(new Set(inventory.map(row => row.name)).size, 8);
  assert.equal(Object.keys(gateInputsFor(plan)).length, 15); assert(!Object.hasOwn(gateInputsFor(plan), 'exclusive-108-performance'));
  assert(Object.hasOwn(gateInputsFor({}), 'exclusive-108-performance'));
  checks.push({name: '8-case inert inventory and separate full/sampled closure gates', status: 'pass', inventory, rcCoverage: SAMPLED_COVERAGE});
} catch (caught) {error = {message: String(caught), stack: caught.stack};}
for (const [path, before] of inputs) assert(fs.readFileSync(path).equals(before), 'Input changed: ' + path);
const tools = ['tools/qa/r100-bind-i10-i12.mjs', 'tools/qa/r100-sampled-acceptance.mjs', 'tools/qa/check-r100-i10-i12-sampled-binding.mjs', base + 'closure-preparation/proposal-builder.mjs', base + 'closeout-independent-review/sampling-adaptation-preparation-check.mjs'].map(ref);
const result = {status: error ? 'failed-preparation-preserved' : 'prepared-only', at: new Date().toISOString(),
  scope: 'Lightweight contract/metadata preparation only. No buildProposal baseline, actual semantic-negative matrix, browser, full89 or ledger write.',
  actualFinalBaseline: 'not-run', actualEightNegatives: 'not-run', tools, checks, error: error ?? null,
  inputs: [...inputs].map(([path, value]) => ({path, sha256: sha(value)})), actualInputsUnchanged: true};
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: result.status, checks: checks.length, error: error ?? null, output}));
if (error) process.exitCode = 1;
