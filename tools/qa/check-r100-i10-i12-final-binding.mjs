#!/usr/bin/env node
/** Adversarial checks over the completed, real I10-I12 final evidence plan.
 * --prepare --output <new.json> runs only small checker-infrastructure fixtures.
 * --list prints the inert case inventory.
 * --plan <finished-plan.json> --output <new.json> first requires an unchanged
 * buildProposal baseline, then changes actual evidence in memory and reseals
 * its consumed references. It never writes the ledger or recorded evidence.
 * Missing inputs, setup errors, stale receipts, unexpected exceptions and
 * rejections at an unrelated predicate are failures, never passing negatives.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildProposal} from './r100-bind-i10-i12.mjs';
import {summarizeWorkerEvents} from './r100-i09-final-probe.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SELF = 'tools/qa/check-r100-i10-i12-final-binding.mjs';
const BINDER = 'tools/qa/r100-bind-i10-i12.mjs';
const LEDGER = 'docs/progress/rift-r100.json';
const KINDS = ['production', 'equivalence', 'budget', 'lifecycle'];
const GENERATIONS = ['historicalGeneration', 'generation', 'expandedHoldoutI11', 'expandedHoldoutI12'];
const HARNESS = {production: 'tools/qa/check-r100-production-browser.mjs',
  equivalence: 'tools/world-study/check-r100-browser-equivalence.mjs',
  budget: 'tools/qa/check-r100-runtime-budget.mjs', lifecycle: 'tools/qa/check-r100-gym-lifecycle.mjs'};
const sha = value => createHash('sha256').update(value).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const clone = value => structuredClone(value);
const jsonl = rows => Buffer.from(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
const lines = value => value.toString('utf8').trim().split('\n').filter(Boolean).map(row => JSON.parse(row));
const changedHash = value => {assert.equal(typeof value, 'string'); assert(value.length); return (value[0] === '0' ? '1' : '0') + value.slice(1);};

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

/** An evidence hash failure is distinct from any game/coverage predicate. */
class EvidenceReceiptError extends Error {}

export function createScenario(originalPlan, inputs) {
  const plan = clone(originalPlan), overlays = new Map(), checkedReceipts = [];
  const bytes = file => overlays.get(repositoryPath(file)) ?? inputs.bytes(file);
  const read = {
    bytes, exists: file => overlays.has(repositoryPath(file)) || inputs.exists(file),
    json: file => JSON.parse(bytes(file)),
    receipt(ref) {
      if (!ref?.path || !/^[a-f0-9]{64}$/.test(ref.sha256)) throw new EvidenceReceiptError('Explicit evidence SHA required');
      const actual = sha(bytes(ref.path));
      if (actual !== ref.sha256) throw new EvidenceReceiptError(`Evidence changed: ${ref.path}`);
      checkedReceipts.push({path: ref.path, sha256: actual});
      return JSON.parse(bytes(ref.path));
    },
    unchanged: () => inputs.unchanged(),
  };
  const putBytes = (file, value) => {
    inputs.bytes(file); // Only recorded inputs may be mutated; no invented successful baseline files.
    const copy = Buffer.from(value); overlays.set(repositoryPath(file), copy); return sha(copy);
  };
  const putJson = (file, value) => putBytes(file, encode(value));
  const reseal = (ref, value) => {ref.sha256 = putJson(ref.path, value);};
  function updateTechnical(names) {
    if (!plan.technicalReview || names.includes('technicalReview')) return;
    const review = read.receipt(plan.technicalReview);
    for (const name of names) if (Object.hasOwn(review.evidence, name)) review.evidence[name] = clone(plan[name]);
    reseal(plan.technicalReview, review);
  }
  function updateShader(change) {
    const review = read.receipt(plan.shaderReview); change(review); reseal(plan.shaderReview, review);
    updateTechnical(['shaderReview']);
  }
  function bindingFor(kind) {
    const matches = plan.runtimeBindings.map(ref => ({ref, value: read.receipt(ref)})).filter(row => row.value.kind === kind);
    assert.equal(matches.length, 1, `Mutation needs the real ${kind} binding`); return matches[0];
  }
  function mutateBinding(kind, change) {
    const {ref, value} = bindingFor(kind); change(value); reseal(ref, value);
    if (kind === 'lifecycle') updateShader(review => {review.sourceBinding = clone(ref);});
  }
  function updateHistorical(name) {
    const field = name === 'historicalGeneration' ? 'historicalGeneration' : 'historicalFixedPlay';
    const historical = read.receipt(plan.historicalBinding);
    historical[name === 'historicalGeneration' ? 'generation' : 'play'] = clone(plan[name]);
    reseal(plan.historicalBinding, historical);
    const review = read.receipt(plan.inheritance), candidate = read.receipt(review.candidate);
    for (const object of [candidate, review]) Object.assign(object[field], clone(plan[name]));
    reseal(review.candidate, candidate); reseal(plan.inheritance, review);
    updateTechnical(['inheritance']);
  }
  function replaceTop(name, value) {
    assert(plan[name]?.path, `Mutation needs actual ${name} evidence`); reseal(plan[name], value);
    if (KINDS.includes(name)) {
      mutateBinding(name, binding => {binding.report = clone(plan[name]);});
      if (name === 'lifecycle') updateShader(review => {review.report = clone(plan.lifecycle);});
    }
    if (['historicalGeneration', 'historicalPlay'].includes(name)) updateHistorical(name);
    updateTechnical([name]);
  }
  const mutateTop = (name, change) => {const value = read.receipt(plan[name]); change(value); replaceTop(name, value);};
  return {plan, read, putBytes, putJson, reseal, replaceTop, mutateTop, mutateBinding, bindingFor,
    checkedReceipts,
    edits: () => [...overlays].map(([file, value]) => ({path: file, originalSha256: sha(inputs.bytes(file)), mutatedSha256: sha(value)})),
  };
}

function actualSupplement(test, revision) {
  const play = test.read.receipt(test.plan.play);
  const sources = play.sources.filter(row => row.controllerPolicyRevision === revision);
  assert.equal(sources.length, 1, `Exactly one actual policy${revision} batch is required`);
  const source = sources[0], policy = test.read.json(source.policy);
  const protocol = test.read.receipt(source.controllerSupplement);
  return {play, source, policy, protocol, summaryPlan: test.read.json(play.plan),
    batch: test.read.json(`${source.folder}/batch-report.json`)};
}

function mutateProtocol(test, revision, change) {
  const value = actualSupplement(test, revision); change(value.protocol);
  test.reseal(value.source.controllerSupplement, value.protocol);
  value.policy.controllerSupplement = clone(value.source.controllerSupplement);
  const ref = value.summaryPlan.controllerSupplements.find(row => row.path === value.source.controllerSupplement.path);
  assert(ref); Object.assign(ref, value.source.controllerSupplement);
  value.source.policySha256 = test.putJson(value.source.policy, value.policy);
  value.play.planSha256 = test.putJson(value.play.plan, value.summaryPlan);
  test.replaceTop('play', value.play);
}

function mutateSupplementBatch(test, revision, change) {
  const value = actualSupplement(test, revision); change(value.batch);
  value.source.reportSha256 = test.putJson(`${value.source.folder}/batch-report.json`, value.batch);
  test.replaceTop('play', value.play);
}

function mutateSupplementJourney(test, revision, change, predicate = () => true) {
  const value = actualSupplement(test, revision);
  const candidates = value.play.attempts.filter(row => row.report.startsWith(`${value.source.folder}/`))
    .map(attempt => ({attempt, raw: test.read.json(attempt.report)}));
  const selected = candidates.find(row => row.raw.realJourneyAttempts.length === 1 && predicate(row.raw.realJourneyAttempts[0]));
  assert(selected, `Actual policy${revision} journey with required observations is missing`);
  const logPath = path.join(path.dirname(selected.attempt.report), selected.attempt.grade, 'journey.jsonl');
  const events = revision === 17 ? lines(test.read.bytes(logPath)) : null;
  change(selected.raw.realJourneyAttempts[0], events, selected.attempt);
  const digest = test.putJson(selected.attempt.report, selected.raw);
  for (const row of value.play.attempts.filter(row => row.report === selected.attempt.report)) row.reportSha256 = digest;
  if (events) test.putBytes(logPath, jsonl(events));
  test.replaceTop('play', value.play);
}

/** Keep related trace values coherent while deliberately corrupting one action.
 * Chronology itself is unchanged here; dedicated negatives corrupt that order. */
function mirrorFacingRecord(record, events) {
  for (let i = 0; i < events.length; i++) {
    const old = events[i], head = {at: old.at, event: old.event};
    if (old.event === 'bounded-melee-facing-check' && old.index === record.index) events[i] = {...head, ...clone(record)};
    if (old.facingCheckIndex !== record.index) continue;
    if (['facing-turn-input', 'facing-turn-input-end'].includes(old.event)) {
      const segment = clone(record.segments[old.index]); assert(segment);
      if (old.event === 'facing-turn-input') {delete segment.waitIssued; segment.endedElapsedMs = null; segment.released = false;}
      events[i] = {...head, facingCheckIndex: record.index, ...segment};
    }
    if (['facing-space-input', 'facing-space-input-end'].includes(old.event)) {
      assert(record.spaceInput); const input = clone(record.spaceInput);
      if (old.event === 'facing-space-input') {input.endedElapsedMs = null; input.issued = false;}
      events[i] = {...head, facingCheckIndex: record.index, ...input};
    }
  }
}

function mutateFacing(test, change, predicate = row => row.spaceInput?.issued && row.segments.length > 0) {
  mutateSupplementJourney(test, 17, (journey, events) => {
    const record = journey.facingChecks.find(predicate); assert(record, 'Recorded facing action required');
    change(record, journey); mirrorFacingRecord(record, events);
  }, journey => journey.facingChecks.some(predicate));
}

function mutateWorkerEvents(test, change) {
  const {value} = test.bindingFor('production'), observation = test.read.receipt(value.workerObservation);
  assert(observation.files.length > 0);
  const arrays = observation.files.map(ref => lines(test.read.bytes(ref.path)));
  change(arrays);
  for (let index = 0; index < arrays.length; index++) observation.files[index].sha256 = test.putBytes(observation.files[index].path, jsonl(arrays[index]));
  const recomputed = {...summarizeWorkerEvents(arrays.flat(), 324), files: observation.files};
  const hash = test.putJson(value.workerObservation.path, recomputed);
  test.mutateBinding('production', binding => {binding.workerObservation.sha256 = hash;});
}

const CASES = [];
function add(name, axis, rationale, functions, message, mutate) {
  CASES.push({name, axis, rationale, rejectAt: {functions: Array.isArray(functions) ? functions : [functions],
    ...(message ? {message} : {})}, mutate});
}
const top = (name, change) => test => test.mutateTop(name, change);

for (const kind of KINDS) {
  add(`${kind}-missing-runtime-audit`, kind, 'Each runtime method requires its own source binding.',
    'validateFinalRuntimeBindings', 'Exactly four runtime-source audits required', test => {
      const {ref} = test.bindingFor(kind); test.plan.runtimeBindings = test.plan.runtimeBindings.filter(row => row.path !== ref.path);
    });
  add(`${kind}-wrong-method-harness-resealed`, kind, 'A valid SHA of another actual method does not establish this method execution.',
    'validateRuntimeBinding', 'wrong runtime harness', test => test.mutateBinding(kind, binding => {
      const file = Object.values(HARNESS).find(value => value !== HARNESS[kind]);
      binding.harness = {path: file, sha256: sha(test.read.bytes(file))};
    }));
  add(`${kind}-another-real-source`, kind, 'A passed audit of an earlier real source cannot bind the final snapshot.',
    'validateRuntimeBinding', null, test => {
      const old = test.plan.generationSources.find(row => row.sha256 !== test.plan.finalSource.sha256); assert(old);
      test.read.receipt(old); test.mutateBinding(kind, binding => {binding.finalSource = {path: old.path, sha256: old.sha256};});
    });
  add(`${kind}-served-source-missing`, kind, 'True verification flags cannot replace the complete before/after served byte maps.',
    'validateRuntimeBinding', null, test => test.mutateBinding(kind, binding => {
      const file = Object.keys(binding.beforeServedHashes).find(value => value.startsWith('src/')); assert(file);
      delete binding.beforeServedHashes[file]; delete binding.afterServedHashes[file];
    }));
}

add('production-duplicate-grade', 'production', '324 rows must have 324 unique world/grade identities.', 'validateFinalReport', null,
  top('production', report => {assert(report.cases.length === 324); report.cases[1] = clone(report.cases[0]);}));
add('production-cold-identity-false', 'production', 'Identity recovery must be demonstrated for each case.', 'validateFinalReport', null,
  top('production', report => {report.cases[0].coldIdentityPreserved = false;}));
add('production-body-position-false', 'production', 'Identity alone does not prove body-position recovery.', 'validateFinalReport', null,
  top('production', report => {report.cases[0].bodyGeometry.coldBodyPositionPreserved = false;}));
add('production-history-double-commit', 'production', 'Reload must not append another departure visit.', 'validateFinalReport', null,
  top('production', report => {report.cases[0].committedWorldHistory.visits.push(clone(report.cases[0].committedWorldHistory.visits[0]));}));
add('production-requested-seed-mismatch', 'production', 'Actual full identity must use the controlled departure seed.', 'validateFinalReport', null,
  top('production', report => {report.cases[0].identity.generation.requestedSeed ^= 1;}));
add('production-missing-failure-stop', 'production', 'The final production gate must preserve its failure-stop policy.',
  'validateRuntimeBinding', 'must stop after failure', test => test.mutateBinding('production', binding => {binding.probeOptions.stopOnFailure = false;}));
add('production-raw-worker-error-resealed', 'production', 'A resealed worker/network error cannot be concealed by successful case rows.',
  'validateRuntimeBinding', 'Original Worker/network events need diagnosis', test => mutateWorkerEvents(test, arrays => {
    const known = arrays[0].find(row => row.event === 'context-created'); assert(known);
    arrays[0].push({...known, event: 'pageerror', message: 'negative-check: recorded execution error'});
  }));
add('production-missing-worker-close-resealed', 'production', 'Every created worker must retain its actual matching close.',
  'validateRuntimeBinding', 'Original Worker/network events need diagnosis', test => mutateWorkerEvents(test, arrays => {
    const selected = arrays.find(rows => rows.some(row => row.event === 'worker-closed')); assert(selected);
    selected.splice(selected.findIndex(row => row.event === 'worker-closed'), 1);
  }));

add('equivalence-wrong-requested-seed', 'equivalence', 'Current equivalence uses the frozen requested seed.', 'validateFinalReport', null,
  top('equivalence', report => {const row = report.results.find(value => value.revision === 6); assert(row); row.requestedSeed++;}));
add('equivalence-duplicate-current-grade', 'equivalence', 'A duplicate cannot conceal one missing current world/grade.', 'validateFinalReport', null,
  top('equivalence', report => {const index = report.results.findIndex(value => value.revision === 6), other = report.results.findIndex((row, i) => i !== index && row.revision === 6); assert(index >= 0 && other >= 0); report.results[other] = clone(report.results[index]);}));
add('equivalence-r1-gold-identity-changed', 'equivalence', 'The original revision1 gold identity set remains exact.', 'validateFinalReport', null,
  top('equivalence', report => {const row = report.results.find(value => value.revision === 1); assert(row); row.actual = row.expected = changedHash(row.expected);}));
add('equivalence-exactness-false', 'equivalence', 'Count coverage cannot replace current CPU/browser equality.', 'validateFinalReport', null,
  top('equivalence', report => {report.results.find(value => value.revision === 6).exactIdentity = false;}));

add('budget-missing-world', 'budget', 'Every enabled world needs its severe measured run.', 'validateFinalReport', null,
  top('budget', report => {assert.equal(report.cases.length, 108); report.cases.pop();}));
add('budget-nonexclusive-window', 'budget', 'Budget sampling requires the separately scheduled exclusive window.', 'validateFinalReport', null,
  top('budget', report => {report.exclusiveWindow = false;}));
add('budget-under-60s-with-consistent-clock', 'budget', 'A truthful shorter game-clock duration cannot qualify as a 60-second sample.',
  'validateBudgetMeasurements', 'At least 60 seconds', top('budget', report => {
    const row = report.cases[0], start = row.start.elapsedMs; assert(row.positions.length === 12);
    row.positions.forEach((value, index) => {value.elapsedMs = start + 59999 * (index + 1) / 13;});
    row.end.elapsedMs = start + 59999; row.duration = row.end.elapsedMs - start;
  }));
for (const [field, metric, limit, message] of [['frames', 'p95', 20, 'frame P95 exceeds'],
  ['frames', 'p99', 33.4, 'frame P99 exceeds'], ['frames', 'over50', .005, 'frames over 50ms'],
  ['cpu', 'p95', 12, 'CPU P95 exceeds'], ['materialSubmit', 'p95', 3, 'material submission P95 exceeds']]) {
  add(`budget-${field}-${metric}-over-limit`, 'budget', 'The original measured threshold cannot be replaced by budgetPass=true.',
    'validateBudgetMeasurements', message, top('budget', report => {
      const value = report.cases[0][field]; value[metric] = limit + .0001;
      if (metric !== 'over50') {value.p99 = Math.max(value.p99, value.p95); value.max = Math.max(value.max, value.p99);}
    }));
}
add('budget-observed-death', 'budget', 'The complete measured interval must remain alive.', 'validateBudgetMeasurements', 'All observations must remain alive',
  top('budget', report => {report.cases[0].positions[5].ended = true;}));

add('lifecycle-wrong-mixed-seed', 'lifecycle', 'The mixed reconstruction order and seed schedule stay frozen.',
  'validateLifecycleMeasurements', 'Mixed reconstruction identities', top('lifecycle', report => {report.mixedCoverage[0].seed++;}));
add('lifecycle-missing-gc-sample', 'lifecycle', 'All warmed and double-GC observations are required.',
  'validateLifecycleMeasurements', 'All twelve double-GC', top('lifecycle', report => {assert.equal(report.samples.length, 12); report.samples.pop();}));
add('lifecycle-active-resource-growth', 'lifecycle', 'Destroyed scenes must return active resource counts to baseline.',
  'validateLifecycleMeasurements', 'active resources did not return', top('lifecycle', report => {
    const count = report.samples[1].objects.Texture; count.active++; count.live = Math.max(count.live, count.active); count.created = Math.max(count.created, count.live);
  }));
add('lifecycle-live-shader-growth', 'lifecycle', 'Cumulative creates do not excuse growing live Shader wrappers.',
  'validateLifecycleMeasurements', 'live Shader wrappers grew', top('lifecycle', report => {
    const count = report.samples[1].objects.Shader; count.live++; count.created = Math.max(count.created, count.live);
  }));
add('lifecycle-retained-10mib-boundary', 'lifecycle', 'Exactly 10 MiB fails the original strict retained-growth limit.',
  'validateLifecycleMeasurements', 'retained growth reaches', top('lifecycle', report => {
    const base = report.samples[0], row = report.samples[1]; row.usage.usedSize = base.usage.usedSize + 10 * 1024 * 1024;
    row.usage.totalSize = Math.max(row.usage.totalSize, row.usage.usedSize);
    row.usage.backingStorageSize = base.usage.backingStorageSize ?? 0; row.usedHeapGrowth = 10 * 1024 * 1024; row.backingGrowth = 0;
  }));

for (const name of GENERATIONS) {
  add(`${name}-actual-raw-case-removed-resealed`, 'generation', 'A missing actual raw case cannot retain the fully successful derived summary.',
    'buildProposal', `${name}: summary does not match raw evidence`, test => test.mutateTop(name, report => {
      let removed = false;
      for (const group of report.groups) for (const attempt of group.attempts) {
        if (removed) continue;
        const rows = lines(test.read.bytes(attempt.raw.path)), index = rows.findIndex(row => row.ok && group.worlds.includes(row.world));
        if (index < 0) continue;
        rows.splice(index, 1); attempt.raw.sha256 = test.putBytes(attempt.raw.path, jsonl(rows)); attempt.executed = rows.length; removed = true;
      }
      assert(removed, 'An actually successful raw generation case is required');
    }));
}
add('current-generation-harness-dependency-missing', 'generation', 'Every executed tool dependency needs its exact archived bytes.',
  'validateGenerationHarnessSources', 'dependency coverage changed', test => {assert(test.plan.generationSources[0].harnessSources.length); test.plan.generationSources[0].harnessSources.pop();});
add('current-generation-harness-other-real-version', 'generation', 'A real archived executor from another generation is not the executed dependency.',
  'validateGenerationHarnessSources', 'differs from the executed dependency', test => {
    const entry = test.plan.generationSources[0].harnessSources[0], other = test.plan.historicalGenerationSources.flatMap(row => row.harnessSources).find(row => row.sha256 !== entry.sha256); assert(other);
    test.read.bytes(other.path); entry.path = other.path; entry.sha256 = other.sha256;
  });
add('historical-generation-group-missing', 'historical-source', 'All eleven original generation groups retain their source mapping.',
  'validateHistoricalGenerationSources', 'coverage changed', test => {assert.equal(test.plan.historicalGenerationSources.length, 11); test.plan.historicalGenerationSources.pop();});
add('historical-generation-group-duplicate', 'historical-source', 'A duplicate historical group cannot hide another original group.',
  'validateHistoricalGenerationSources', 'Duplicate historical generation group', test => {test.plan.historicalGenerationSources[1] = clone(test.plan.historicalGenerationSources[0]);});
add('historical-generation-source-replaced-by-real-source', 'historical-source', 'An actual later snapshot cannot replace an original group source identity.',
  'validateHistoricalGenerationSources', 'Historical source path changed', test => {
    const entry = test.plan.historicalGenerationSources[0], other = test.plan.generationSources.find(row => row.path !== entry.path); assert(other);
    test.read.receipt(other); entry.path = other.path; entry.sha256 = other.sha256;
  });
add('historical-harness-newer-real-version', 'historical-source', 'Historical execution may use a repository copy only if its bytes exactly match the original dependency.',
  'validateGenerationHarnessSources', 'differs from the executed dependency', test => {
    const entry = test.plan.historicalGenerationSources[0].harnessSources[0], other = test.plan.generationSources.flatMap(row => row.harnessSources).find(row => row.sha256 !== entry.sha256); assert(other);
    test.read.bytes(other.path); entry.path = other.path; entry.sha256 = other.sha256;
  });

add('historical-play-relabeled-current-revision', 'inheritance', 'Historical played processes retain their executed revision5 identity.',
  'validateAccountingScopes', 'Do not relabel executed revisions', top('historicalPlay', play => {play.sources[0].algorithmRevision = 6;}));
add('inheritance-old-generation-relabeled-revision6', 'inheritance', 'A root review does not turn historical execution into current execution.',
  'validateInheritance', 'Historical evidence was executed by revision5', test => {
    const review = test.read.receipt(test.plan.inheritance), candidate = test.read.receipt(review.candidate);
    for (const value of [review, candidate]) value.historicalGeneration.executedAlgorithmRevision = 6;
    test.reseal(review.candidate, candidate); test.replaceTop('inheritance', review);
  });
add('bounded-play-continuity-behavior-differs', 'inheritance', 'A play-only edge must preserve actual deployed behavior.',
  'validateBoundedPlayContinuity', 'Actual production behavior differs', test => {
    assert(test.plan.boundedPlayContinuity.length); const ref = test.plan.boundedPlayContinuity[0], review = test.read.receipt(ref), report = test.read.receipt(review.behaviorReport);
    report.cases[0].after.exact.production = changedHash(report.cases[0].after.exact.production);
    test.reseal(review.behaviorReport, report); test.reseal(ref, review);
  });
add('play-missing-original-fixed-seed', 'play', 'Both predeclared seed processes are required for every grade pair.',
  'assertPlaySummaryExact', 'Play summary does not match raw evidence', top('play', play => {assert.equal(play.pairs[0].seeds.length, 2); play.pairs[0].seeds.pop();}));
add('play-raw-settlement-missing-resealed', 'play', 'A real extract claim without matching settlement cannot remain qualified.',
  'assertPlaySummaryExact', 'Play summary does not match raw evidence', test => test.mutateTop('play', play => {
    const attempt = play.attempts.find(row => row.searchAndExtract && !row.report.includes('policy16') && !row.report.includes('policy17')); assert(attempt);
    const raw = test.read.json(attempt.report); raw.realJourneyAttempts[0].afterReturn.state.inventory.run.baseSettled = false;
    attempt.reportSha256 = test.putJson(attempt.report, raw);
  }));

for (const revision of [16, 17]) {
  const protocolGuard = revision === 16 ? 'validateControllerSupplement' : 'validateFacingControllerSupplement';
  const journeyGuard = revision === 16 ? 'validateSupplementJourney' : 'validateFacingSupplementJourney';
  add(`policy${revision}-unapproved-protocol-resealed`, `policy${revision}`, 'Only the explicit root-approved input supplement is admissible.',
    protocolGuard, null, test => mutateProtocol(test, revision, protocol => {protocol.status = 'candidate-not-approved';}));
  add(`policy${revision}-third-attempt-resealed`, `policy${revision}`, 'Each of the two original seeds may have exactly one supplemental attempt.',
    protocolGuard, 'Both original seeds must be attempted exactly once', test => mutateSupplementBatch(test, revision, batch => {batch.attempts.push(clone(batch.attempts[0]));}));
  add(`policy${revision}-changed-full-identity-resealed`, `policy${revision}`, 'Unchanged world and seed alone cannot replace complete original identity.',
    journeyGuard, revision === 16 ? 'full generation identity' : 'full original identity', test => mutateSupplementJourney(test, revision, journey => {journey.identity.signature = changedHash(journey.identity.signature);}));
  add(`policy${revision}-changed-earned-before-resealed`, `policy${revision}`, 'The complete actually earned starting save stays identical.',
    journeyGuard, 'earned starting save', test => mutateSupplementJourney(test, revision, journey => {journey.before.sha256 = changedHash(journey.before.sha256);}));
  add(`policy${revision}-original-failure-batch-omitted`, `policy${revision}`, 'A supplement cannot erase the original unsuccessful processes from the main accounting.',
    protocolGuard, 'Original unsuccessful attempt must remain in the summary', test => {
      const value = actualSupplement(test, revision), file = value.protocol.cases[0].originalReport.path;
      const original = value.summaryPlan.batches.find(folder => file.startsWith(`${folder}/`)); assert(original);
      value.summaryPlan.batches = value.summaryPlan.batches.filter(folder => folder !== original);
      value.play.planSha256 = test.putJson(value.play.plan, value.summaryPlan); test.replaceTop('play', value.play);
    });
}
add('policy16-missing-explicit-action-list', 'policy16', 'Even a journey using no repeat action must explicitly record its empty bounded list.',
  'validateSupplementJourney', 'explicitly record', test => mutateSupplementJourney(test, 16, journey => {delete journey.boundedSearchRechecks;}));
add('policy16-invented-two-extra-rechecks', 'policy16', 'Adding two purported actions to actual reports must fail before any claimed success can count.',
  'validateSupplementJourney', 'Too many additional search attempts', test => mutateSupplementJourney(test, 16, journey => {assert.deepEqual(journey.boundedSearchRechecks, []); journey.boundedSearchRechecks = [{negativeCheck: true}, {negativeCheck: true}];}));
add('policy17-extra-unbound-space', 'policy17', 'Every actual Space requires its own current-facing decision.',
  'validateFacingSupplementJourney', 'Every actual Space', test => mutateSupplementJourney(test, 17, (journey, events) => {
    const event = events.find(row => row.event === 'key' && row.key === 'Space'); assert(event); events.push(clone(event));
  }));
add('policy17-space-before-permission', 'policy17', 'Matching action counts cannot hide a Space pressed before permission.',
  'validateFacingSupplementJourney', 'chronological order', test => mutateSupplementJourney(test, 17, (journey, events) => {
    const index = events.findIndex(row => row.event === 'key' && row.key === 'Space'); assert(index > 0);
    const [event] = events.splice(index, 1); events.unshift(event);
  }));
add('policy17-wrong-visible-facing-geometry', 'policy17', 'Reported alignment must be independently recomputable from the observed position and actual facing.',
  'validateGeometry', 'angle differs', test => mutateFacing(test, record => {
    record.finalCheck.player.facing += Math.PI; record.spaceInput.finalCheck = clone(record.finalCheck);
  }));
add('policy17-space-during-windup', 'policy17', 'A claimed allowed Space cannot bypass the visible enemy attack phase.',
  'validateGeometry', 'Space requires current visible safe geometry', test => mutateFacing(test, record => {
    record.finalCheck.enemy.attack = 'windup'; record.finalCheck.phaseAllowed = false; record.spaceInput.finalCheck = clone(record.finalCheck);
  }));
add('policy17-direction-away-from-visible-target', 'policy17', 'Direction keys must follow the same observed target bearing.',
  'validateFacingSupplementJourney', 'same currently visible bearing', test => mutateFacing(test, record => {
    record.segments[0].keys = record.segments[0].keys.map(key => ({w: 's', s: 'w', a: 'd', d: 'a'})[key]);
  }));
add('policy17-segment-over-60ms', 'policy17', 'A segment cannot exceed its frozen 60ms input request.',
  'validateFacingSupplementJourney', null, test => mutateFacing(test, record => {record.segments[0].requestedMs = 60.01; record.turnInputMs += .01;}));
add('policy17-observed-game-clock-over-1000ms', 'policy17', 'Reported success cannot conceal a real observed whole-action deadline overrun.',
  'assertPlaySummaryExact', 'Play summary does not match raw evidence', test => mutateFacing(test, record => {record.maxObservedElapsedMs = 1000.01;}));
add('policy17-keys-not-released', 'policy17', 'A completed correction must prove key cleanup.',
  'assertPlaySummaryExact', 'Play summary does not match raw evidence', test => mutateFacing(test, record => {record.releasedAllTrackedKeys = false;}));
add('policy17-added-search-retry', 'policy17', 'Facing correction does not authorize another search attempt.',
  'validateFacingSupplementJourney', 'must not introduce repeat searches', test => mutateSupplementJourney(test, 17, journey => {journey.boundedSearchRechecks = [];}));

add('art-package-dependency-mismatch', 'art', 'Each bounded art verdict must concern the exact final world package.', 'buildProposal', null,
  top('art', art => {art.worlds[0].dependencyHash = changedHash(art.worlds[0].dependencyHash);}));
add('art-missing-limitations', 'art', 'Internal art approval must preserve an explicit bounded scope.', 'buildProposal', null,
  top('art', art => {art.worlds[0].limitations = '';}));
add('art-author-self-signoff', 'art', 'The independent root verdict cannot be replaced by an author assertion.', 'buildProposal', null,
  top('art', art => {art.worlds[0].independentReviewer = 'author';}));
add('art-source-not-in-world-continuity', 'art', 'A real receipt outside the source-continuity graph cannot bind a reused art capture.',
  'buildProposal', 'Unbound art source', test => test.mutateTop('art', art => {
    const evidence = art.worlds[0].evidence[0]; assert(evidence);
    evidence.sourceManifest = test.plan.production.path; evidence.sourceManifestSha256 = test.plan.production.sha256;
  }));
add('technical-review-wrong-final-source', 'technical-review', 'An independent technical verdict must name the final frozen source.',
  'buildProposal', null, top('technicalReview', review => {review.finalSourceSha256 = changedHash(review.finalSourceSha256);}));
add('technical-review-wrong-budget-evidence', 'technical-review', 'A review from another validation axis cannot stand in for the final budget report.',
  'buildProposal', 'Technical review concerns different budget', test => test.mutateTop('technicalReview', review => {review.evidence.budget = clone(test.plan.production);}));
add('shader-author-self-signoff', 'shader', 'Numeric lifecycle results do not replace root Shader ownership review.',
  'validateShaderReview', null, top('shaderReview', review => {review.reviewer = 'author';}));
add('shader-one-sample-unreviewed', 'shader', 'The independent review must bind all twelve actual Shader samples.',
  'validateShaderReview', 'does not concern the observed counts', top('shaderReview', review => {assert.equal(review.reviewedShaderSamples.length, 12); review.reviewedShaderSamples.pop();}));
add('shader-count-changed-resealed', 'shader', 'A signed status cannot conceal a mismatched Shader count.',
  'validateShaderReview', 'does not concern the observed counts', top('shaderReview', review => {review.reviewedShaderSamples[1].live++;}));
add('shader-wrong-runtime-binding', 'shader', 'Shader ownership review must use the lifecycle source audit.',
  'validateShaderReview', null, test => test.mutateTop('shaderReview', review => {review.sourceBinding = clone(test.bindingFor('budget').ref);}));
add('shader-empty-ownership-conclusion', 'shader', 'An empty numerical signoff is not an ownership conclusion.',
  'validateShaderReview', 'Missing Shader review ownershipConclusion', top('shaderReview', review => {review.ownershipConclusion = ' ';}));

export function caseInventory() {return CASES.map(({mutate, ...value}) => clone(value));}

export function classifyRejection(error, expected) {
  if (!error) return {ok: false, actual: 'accepted-corrupt-evidence'};
  if (error instanceof EvidenceReceiptError || /Explicit (?:evidence|supplement input) SHA required|Evidence changed:|Supplement input changed:|Generation input changed:/.test(error.message ?? ''))
    return {ok: false, actual: 'stale-or-missing-receipt'};
  if (!(error instanceof assert.AssertionError)) return {ok: false, actual: 'unexpected-exception'};
  // buildProposal is on every validator stack. Merely finding its caller frame
  // would incorrectly credit an earlier, unrelated guard as an art negative.
  // Require the innermost declared validation boundary, ignoring tiny assertion
  // helpers such as near()/survives() inside the named geometry contract.
  const boundaries = new Set([...CASES.flatMap(row => row.rejectAt.functions), ...expected.functions,
    'validateExpansionPlan', 'validateAccountingScopes', 'validateInheritance', 'validateRuntimeBinding',
    'validateFinalRuntimeBindings', 'validateShaderReview', 'validateBoundedPlayContinuity',
    'validateHistoricalGenerationSources', 'validateGenerationHarnessSources',
    'validateMeasurementStats', 'validateBudgetMeasurements', 'validateLifecycleMeasurements',
    'buildGenerationSummary', 'buildPlaySummary', 'checkPlan']);
  const frames = [...(error.stack ?? '').matchAll(/^\s+at ([\w.]+) \(/gm)].map(match => match[1]);
  const boundary = frames.find(name => boundaries.has(name));
  if (!expected.functions.includes(boundary) || (expected.message && !error.message.includes(expected.message)))
    return {ok: false, actual: 'rejected-at-unexpected-predicate', boundary: boundary ?? null};
  return {ok: true, actual: 'expected-logical-rejection'};
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

export function checkFinalBinding(planFile, output) {
  const destination = outputDestination(output), inputs = recordedInputs(), planPath = repositoryPath(planFile);
  const report = {version: 1, status: 'running', startedAt: new Date().toISOString(),
    scope: 'Actual completed final108 buildProposal baseline plus in-memory, resealed semantic corruptions. No browser, generated runtime, fixture baseline, ledger write or recorded evidence replacement.',
    baseline: null, cases: [], caseCountRequired: CASES.length};
  let failed = false, source;
  try {
    report.executableModules = registerModuleSources(inputs);
    const plan = JSON.parse(inputs.bytes(planPath));
    report.plan = {path: planPath, sha256: sha(inputs.bytes(planPath))}; report.binder = {path: BINDER, sha256: sha(inputs.bytes(BINDER))};
    report.checker = {path: SELF, sha256: sha(inputs.bytes(SELF))};
    const baseline = createScenario(plan, inputs); source = baseline.read.receipt(plan.finalSource);
    assert.equal(plan.historicalGenerationSources?.length, 11, 'Final checks require all archived historical harness mappings');
    for (const kind of KINDS) baseline.read.receipt(plan[kind]);
    for (const name of ['art', 'technicalReview', 'shaderReview']) baseline.read.receipt(plan[name]);
    report.frozenBefore = frozenFilesExact(source);
    const result = buildProposal(baseline.plan, baseline.read);
    assert.deepEqual(baseline.edits(), []); assert.deepEqual(baseline.plan, plan);
    assert.equal(result.summary.counts.qualified, 108); assert.equal(result.summary.counts.productionGradeCases, 324);
    assert.equal(result.summary.counts.humanApproved, 0);
    assert.deepEqual(result.summary.accounting, {historicalRevision5Base: 7488, currentRevision6Base: 8064, additionalHoldout: 2592, fixedSeedProcesses: 648});
    report.baseline = {status: 'pass', counts: result.summary.counts, accounting: result.summary.accounting,
      proposedLedgerSha256: sha(encode(result.proposed)), addedEvidence: result.summary.addedEvidence,
      checkedReceiptCount: baseline.checkedReceipts.length};
    console.log('PASS unchanged actual final108 dry proposal');
    for (const spec of CASES) {
      const test = createScenario(plan, inputs), row = {...caseInventory().find(value => value.name === spec.name), status: 'failed'};
      try {
        spec.mutate(test);
        assert(!encode(test.plan).equals(encode(plan)) || test.edits().length > 0, 'Mutation must actually change recorded evidence or the plan');
        let error;
        try {buildProposal(test.plan, test.read);} catch (caught) {error = caught;}
        const classification = classifyRejection(error, spec.rejectAt);
        Object.assign(row, classification, {status: classification.ok ? 'pass' : 'failed',
          error: error ? String(error) : null, stack: error?.stack ?? null});
      } catch (error) {
        Object.assign(row, {ok: false, actual: 'mutation-setup-failed', error: String(error), stack: error?.stack ?? null});
      }
      row.edits = test.edits(); row.checkedReceiptCount = test.checkedReceipts.length; row.planSha256 = sha(encode(test.plan));
      report.cases.push(row); if (!row.ok) failed = true;
      console.log(`${row.ok ? 'PASS' : 'FAIL'} ${spec.name}: ${row.actual}`);
    }
    assert.equal(report.cases.length, CASES.length);
    assert(!failed, 'At least one negative was accepted, misconfigured, stale or rejected at an unrelated predicate');
    report.status = 'pass';
  } catch (error) {report.status = 'failed'; report.failure = String(error); report.failureStack = error.stack; failed = true;}
  finally {
    try {
      inputs.unchanged(); report.actualInputsUnchanged = true;
      if (source && report.frozenBefore) {report.frozenAfter = frozenFilesExact(source); assert.deepEqual(report.frozenAfter, report.frozenBefore);}
    } catch (error) {report.status = 'failed'; report.preservationFailure = String(error); failed = true;}
    report.inputs = inputs.receipts(); report.endedAt = new Date().toISOString(); writeReport(destination, report);
  }
  return {report, failed};
}

/** Deliberately tiny infrastructure fixtures, never a fabricated 108-world
 * passing baseline. This branch does not call buildProposal at all. */
export function prepareChecker(output) {
  const destination = outputDestination(output), checks = [];
  const check = (name, run) => {run(); checks.push({name, status: 'pass'});};
  const memory = new Map(), remember = (file, value) => {const bytes = encode(value); memory.set(file, bytes); return {path: file, sha256: sha(bytes)};};
  const reportRef = remember('fixture-lifecycle.json', {samples: []});
  const bindingRef = remember('fixture-lifecycle-binding.json', {kind: 'lifecycle', report: reportRef});
  const shaderRef = remember('fixture-shader.json', {report: reportRef, sourceBinding: bindingRef});
  const technicalRef = remember('fixture-technical.json', {evidence: {lifecycle: reportRef, shaderReview: shaderRef}});
  const plan = {lifecycle: reportRef, runtimeBindings: [bindingRef], shaderReview: shaderRef, technicalReview: technicalRef};
  const originals = new Map([...memory].map(([file, bytes]) => [file, Buffer.from(bytes)]));
  const inputs = {bytes(file) {const bytes = memory.get(repositoryPath(file)); assert(bytes, `Unknown fixture input: ${file}`); return bytes;},
    exists: file => memory.has(repositoryPath(file)), unchanged() {for (const [file, bytes] of originals) assert(memory.get(file).equals(bytes));}};
  const test = createScenario(plan, inputs);
  check('overlay leaves all original fixture bytes and input plan untouched', () => {
    test.mutateTop('lifecycle', value => {value.samples.push({negativeFixture: true});});
    inputs.unchanged(); assert.deepEqual(plan.lifecycle, reportRef); assert.equal(JSON.parse(memory.get(reportRef.path)).samples.length, 0);
  });
  check('reseal cascades report to runtime audit and Shader report/sourceBinding to technical review', () => {
    const binding = test.read.receipt(test.plan.runtimeBindings[0]), shader = test.read.receipt(test.plan.shaderReview), technical = test.read.receipt(test.plan.technicalReview);
    assert.deepEqual(binding.report, test.plan.lifecycle); assert.deepEqual(shader.report, test.plan.lifecycle);
    assert.deepEqual(shader.sourceBinding, test.plan.runtimeBindings[0]); assert.deepEqual(technical.evidence.lifecycle, test.plan.lifecycle);
    assert.deepEqual(technical.evidence.shaderReview, test.plan.shaderReview); test.read.receipt(test.plan.lifecycle);
  });
  check('unknown synthetic input cannot be invented by an overlay', () => {assert.throws(() => test.putJson('not-recorded.json', {}), /Unknown fixture input/);});
  check('a stale receipt is a checker failure, never a semantic negative', () => {
    let caught; try {test.read.receipt(reportRef);} catch (error) {caught = error;}
    assert.equal(classifyRejection(caught, {functions: ['read']}).actual, 'stale-or-missing-receipt');
  });
  check('accepted evidence and non-assertion exceptions fail closed', () => {
    assert.equal(classifyRejection(null, {functions: ['guard']}).ok, false);
    assert.equal(classifyRejection(new TypeError('broken mutation'), {functions: ['guard']}).actual, 'unexpected-exception');
  });
  check('rejection must reach the declared predicate and message', () => {
    function intendedGuard() {assert.fail('target contract');}
    let error; try {intendedGuard();} catch (caught) {error = caught;}
    assert.equal(classifyRejection(error, {functions: ['intendedGuard'], message: 'target contract'}).ok, true);
    assert.equal(classifyRejection(error, {functions: ['anotherGuard']}).ok, false);
    assert.equal(classifyRejection(error, {functions: ['intendedGuard'], message: 'another contract'}).ok, false);
  });
  check('an expected outer caller cannot mask an unrelated inner validator', () => {
    function validateRuntimeBinding() {assert.fail('unrelated runtime problem');}
    function intendedOuterGuard() {validateRuntimeBinding();}
    let error; try {intendedOuterGuard();} catch (caught) {error = caught;}
    assert.equal(classifyRejection(error, {functions: ['intendedOuterGuard']}).actual, 'rejected-at-unexpected-predicate');
  });
  check('case names are unique and every axis has executable negative definitions', () => {
    assert.equal(new Set(CASES.map(row => row.name)).size, CASES.length);
    for (const axis of [...KINDS, 'generation', 'historical-source', 'inheritance', 'play', 'policy16', 'policy17', 'art', 'shader', 'technical-review'])
      assert(CASES.some(row => row.axis === axis), `Missing axis ${axis}`);
    assert(CASES.every(row => typeof row.mutate === 'function' && row.rejectAt.functions.length));
  });
  check('all four method-harness semantic negatives are mandatory', () => {
    for (const kind of KINDS) assert(CASES.some(row => row.name === `${kind}-wrong-method-harness-resealed`));
  });
  check('repository traversal is rejected', () => {assert.throws(() => repositoryPath('../outside.json'), /Outside repository/);});
  const report = {version: 1, status: 'prepared-only', at: new Date().toISOString(),
    scope: 'Checker infrastructure fixtures and static case inventory only. No buildProposal, final108 baseline, genuine semantic-negative matrix, browser or game execution occurred.',
    checker: {path: SELF, sha256: sha(fs.readFileSync(path.join(ROOT, SELF)))},
    binder: {path: BINDER, sha256: sha(fs.readFileSync(path.join(ROOT, BINDER)))},
    baseline: {status: 'not-run', reason: 'Wait for the complete real final108 plan and independent runtime/art/Shader reviews.'},
    checks, caseCount: CASES.length, cases: caseInventory(),
    policy16Boundary: 'Both actual policy16 records contain no bounded search recheck. Final actual negatives therefore cover protocol, original retention, identity/save, explicit list and rejected added action count. The 6000ms executed-action guard remains covered by separately labeled preparation fixtures, not invented actual action evidence.',
    nextCommand: `node ${SELF} --plan <root-approved-finished-plan.json> --output <new-negative-report.json>`,
    limitations: 'Prepared code may still reveal mutation setup defects or binder defects when run against final actual evidence. Such outcomes are failures and retained; preparation is not a final acceptance pass.'};
  writeReport(destination, report); return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const arg = name => {const index = args.indexOf(name); assert(index >= 0 && args[index + 1] && !args[index + 1].startsWith('--'), `${name} is required`); return args[index + 1];};
  if (args.length === 1 && args[0] === '--list') console.log(JSON.stringify({status: 'inert-inventory', cases: caseInventory()}, null, 2));
  else if (args.includes('--prepare')) {
    assert.equal(args.length, 3); assert(!args.includes('--plan')); const report = prepareChecker(arg('--output'));
    console.log(JSON.stringify({status: report.status, infrastructureChecks: report.checks.length, plannedNegatives: report.caseCount, output: arg('--output')}));
  } else {
    assert.equal(args.length, 4, 'Usage: --plan <completed-plan> --output <new-report>; or --prepare --output <new-report>; or --list');
    const result = checkFinalBinding(arg('--plan'), arg('--output')); if (result.failed) process.exitCode = 1;
  }
}
