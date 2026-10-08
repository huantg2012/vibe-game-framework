import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateRuntimeBinding} from '../../../../../../tools/qa/r100-bind-i10-i12.mjs';
import {summarizeWorkerEvents} from '../../../../../../tools/qa/r100-i09-final-probe.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const binderPath = 'tools/qa/r100-bind-i10-i12.mjs', before = fs.readFileSync(binderPath);
const paths = {production: 'tools/qa/check-r100-production-browser.mjs',
  equivalence: 'tools/world-study/check-r100-browser-equivalence.mjs',
  budget: 'tools/qa/check-r100-runtime-budget.mjs', lifecycle: 'tools/qa/check-r100-gym-lifecycle.mjs'};
const inputs = new Map([[binderPath, before]]);
const disk = file => {if (!inputs.has(file)) inputs.set(file, fs.readFileSync(file)); return inputs.get(file);};
const ref = file => ({path: file, sha256: sha(disk(file))});
const source = {temporaryRoot: '/synthetic/frozen-not-runtime', sources: {'src/synthetic.ts': sha('synthetic')}};
const sourceRef = {path: 'synthetic-source.json', sha256: sha('synthetic source')};
const events = [{event: 'preload-ready', pid: 1}, {event: 'launch', pid: 1, browserId: 1},
  ...[1, 2, 3].flatMap(contextId => ['context-created', 'worker-created', 'worker-closed', 'network-summary', 'context-closed']
    .map(event => ({event, pid: 1, browserId: 1, contextId,
      ...(['worker-created', 'worker-closed'].includes(event) ? {workerId: contextId} : {}),
      ...(event === 'network-summary' ? {reason: 'context-closed', requests: 2, responses: 2, urls: ['synthetic']} : {})}))),
  {event: 'browser-disconnected', pid: 1, browserId: 1}];
const raw = Buffer.from(events.map(row => JSON.stringify(row)).join('\n') + '\n');
const observation = {...summarizeWorkerEvents(events, 3), files: [{path: 'synthetic-events.jsonl', sha256: sha(raw)}]};
assert.equal(observation.status, 'pass-observed-events');
const summary = Buffer.from(JSON.stringify(observation));
const bytes = file => file === 'synthetic-events.jsonl' ? raw : file === 'synthetic-observation.json' ? summary : disk(file);
const results = [];
for (const [kind, harness] of Object.entries(paths)) {
  const plan = {finalSource: sourceRef, [kind]: {path: `synthetic-${kind}.json`, sha256: sha(kind)}};
  const binding = {status: 'pass', kind, finalSource: sourceRef, report: plan[kind],
    beforeRuntimeVerified: true, afterRuntimeVerified: true, servedSourceVerified: true, exitCode: 0,
    harness: ref(harness), wrapper: ref('tools/qa/r100-i09-final-probe.mjs'),
    beforeServedHashes: source.sources, afterServedHashes: source.sources,
    beforeFiles: {nodeWorkingDirectory: process.cwd(), frozenDirectory: source.temporaryRoot, files: 1},
    worldIds: ['synthetic-world'], probeOptions: {stopOnFailure: true, observeWorkers: true},
    dependencies: [ref('tools/qa/r100-worker-observer.mjs')], workerObservationStatus: 'pass-observed-events',
    workerObservation: {path: 'synthetic-observation.json', sha256: sha(summary)}};
  binding.afterFiles = structuredClone(binding.beforeFiles);
  validateRuntimeBinding(binding, kind, plan, source, ['synthetic-world'], bytes);
  const wrong = structuredClone(binding), other = Object.values(paths).find(file => file !== harness);
  wrong.harness = ref(other);
  let rejected;
  try {validateRuntimeBinding(wrong, kind, plan, source, ['synthetic-world'], bytes);} catch (error) {rejected = error;}
  assert(rejected instanceof assert.AssertionError, `${kind}: wrong method must explicitly fail`);
  assert.match(rejected.message, /harness/i);
  assert.match(rejected.stack, /validateRuntimeBinding/);
  results.push({kind, expectedHarness: binding.harness, alteredHarness: wrong.harness,
    correctMetadata: 'accepted', resealedWrongMethod: 'rejected', error: String(rejected)});
}
for (const [file, bytesBefore] of inputs) assert(fs.readFileSync(file).equals(bytesBefore), `Changed input: ${file}`);
const output = path.join(path.dirname(new URL(import.meta.url).pathname), 'harness-path-fix-independent-review.json');
const report = {version: 1, status: 'pass-isolated-metadata-predicate', at: new Date().toISOString(),
  scope: 'Four method-specific positive and four resealed wrong-harness fixtures. Synthetic source/report/observer metadata; actual harness/wrapper/observer source hashes. No buildProposal or real final108 baseline executed.',
  priorGap: ref('docs/qa/artifacts/r100-i10-i12/closeout-independent-review/final-binding-preparation/harness-path-gap.json'),
  binder: {path: binderPath, sha256: sha(before)}, results,
  inspectedChange: 'Each known runtime kind has one expected harness path before the existing byte-SHA check. No runtime harness or product source change is required.',
  inputs: [...inputs].map(([file, value]) => ({path: file, sha256: sha(value)})), inputsUnchanged: true,
  remaining: 'Run all four negatives through the actual final-plan buildProposal baseline after all genuine final reports exist.'};
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, output: path.relative(process.cwd(), output), sha256: sha(fs.readFileSync(output))}));
