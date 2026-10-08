import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRuntimeBinding} from '../../../../../../tools/qa/r100-bind-i10-i12.mjs';

const root = process.cwd();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const binder = 'tools/qa/r100-bind-i10-i12.mjs';
const binderBytes = fs.readFileSync(binder);
const ref = file => ({path: file, sha256: sha(fs.readFileSync(file))});
const source = {temporaryRoot: '/synthetic/frozen-not-an-execution', sources: {'src/synthetic.ts': sha('synthetic bytes')}};
const plan = {finalSource: {path: 'synthetic-source.json', sha256: sha('synthetic source')},
  budget: {path: 'synthetic-budget.json', sha256: sha('synthetic report')}};
const binding = {status: 'pass', kind: 'budget', finalSource: plan.finalSource, report: plan.budget,
  beforeRuntimeVerified: true, afterRuntimeVerified: true, servedSourceVerified: true, exitCode: 0,
  harness: ref('tools/qa/check-r100-runtime-budget.mjs'), wrapper: ref('tools/qa/r100-i09-final-probe.mjs'),
  beforeServedHashes: source.sources, afterServedHashes: source.sources,
  beforeFiles: {nodeWorkingDirectory: root, frozenDirectory: source.temporaryRoot, files: 1},
  worldIds: ['synthetic-world']};
binding.afterFiles = structuredClone(binding.beforeFiles);
const verify = value => validateRuntimeBinding(value, 'budget', plan, source, ['synthetic-world'], file => fs.readFileSync(file));
verify(binding);
const altered = structuredClone(binding);
altered.harness = ref('tools/qa/check-r100-production-browser.mjs');
assert.notEqual(altered.harness.path, binding.harness.path);
verify(altered);
assert(fs.readFileSync(binder).equals(binderBytes), 'Binder changed during minimal reproduction');
const output = path.join(path.dirname(new URL(import.meta.url).pathname), 'harness-path-gap.json');
const report = {version: 1, status: 'confirmed-validator-gap', at: new Date().toISOString(),
  scope: 'Synthetic metadata fixture invokes validateRuntimeBinding only. Both harness and wrapper SHA values refer to actual files. No final108 baseline, runtime report, browser, source claim, ledger mutation or acceptance decision is fabricated.',
  binder: {path: binder, sha256: sha(binderBytes)}, verifier: 'validateRuntimeBinding',
  correctMethodHarness: binding.harness, wrongMethodHarness: altered.harness, wrapper: binding.wrapper,
  expected: 'The budget binding must reject the production harness even when its actual bytes and new SHA match.',
  actual: 'Both the correct budget harness and resealed production harness were accepted for kind=budget.',
  boundary: 'This demonstrates a validator identity gap; it does not allege any recorded production or budget execution used the wrong harness.',
  recommendation: 'Binder owner should require the declared method to use its specific frozen harness path; retain four method-specific negatives in the final real-evidence checker.',
  binderUnchanged: true};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, output: path.relative(root, output), sha256: sha(fs.readFileSync(output))}));
