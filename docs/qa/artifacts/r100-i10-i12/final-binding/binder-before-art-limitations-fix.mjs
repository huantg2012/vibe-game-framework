#!/usr/bin/env node
/** Attach final r6 receipts with explicit historical inheritance to the ledger. Never closes iterations or grants human approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {checkPlan} from '../world-study/r100-progress.mjs';
import {buildGenerationSummary} from './r100-qualification-summary.mjs';
import {buildPlaySummary} from './r100-play-qualification.mjs';
import {validateFinalReport, summarizeWorkerEvents} from './r100-i09-final-probe.mjs';
import {validateExpansionPlan} from './check-r100-expansion-plan.mjs';
import {samplingForPlan, validateSampledBudget, validateSampledLifecycle, restoreReviewedRevision5Invalidation} from './r100-sampled-acceptance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const grades = ['low', 'medium', 'severe'];
const revision = 'r100-native-v3-revision-6';
const qualificationPlanPath = 'docs/qa/artifacts/r100-i10-i12/qualification-plan.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const runtimeHarnesses = {
  production: 'tools/qa/check-r100-production-browser.mjs',
  equivalence: 'tools/world-study/check-r100-browser-equivalence.mjs',
  budget: 'tools/qa/check-r100-runtime-budget.mjs',
  lifecycle: 'tools/qa/check-r100-gym-lifecycle.mjs',
};

function reader() {
  const inputs = new Map();
  function bytes(file) {
    assert(!path.isAbsolute(file) && !path.relative(root, path.resolve(root, file)).startsWith('..'), `Outside repository: ${file}`);
    const target = fs.realpathSync(path.resolve(root, file));
    assert(!path.relative(root, target).startsWith('..'), `Symlink outside repository: ${file}`);
    if (!inputs.has(file)) inputs.set(file, fs.readFileSync(target));
    return inputs.get(file);
  }
  return {bytes, json: file => JSON.parse(bytes(file)),
    receipt(value) {
      assert(value?.path && /^[a-f0-9]{64}$/.test(value.sha256), 'Explicit evidence SHA required');
      assert.equal(digest(bytes(value.path)), value.sha256, `Evidence changed: ${value.path}`);
      return JSON.parse(bytes(value.path));
    },
    unchanged() { for (const [file, original] of inputs) assert(fs.readFileSync(path.resolve(root, file)).equals(original), `Concurrent edit: ${file}`); },
  };
}

/** Separate accounting scopes prevent a total count from hiding missing worlds,
 * relabeled historical executions or absent additional holdout cases. */
export function validateAccountingScopes(frozen, generations, plays) {
  const sorted = values => [...values].sort();
  const old = frozen.baseline.worlds;
  const added = frozen.batches.flatMap(batch => batch.worlds);
  assert.equal(old.length, 52); assert.equal(added.length, 56);
  assert.equal(new Set([...old, ...added]).size, 108);
  const i11 = [...old, ...frozen.batches.filter(row => row.iteration !== 'R100-I12').flatMap(row => row.worlds)];
  const i12 = frozen.batches.filter(row => row.iteration === 'R100-I12').flatMap(row => row.worlds);
  const scopes = {historicalGeneration: [old, 48], generation: [added, 48],
    expandedHoldoutI11: [i11, 8], expandedHoldoutI12: [i12, 8]};
  for (const [name, [ids, seedCount]] of Object.entries(scopes)) {
    const cpu = generations[name], expected = ids.length * 3 * seedCount;
    assert.equal(cpu.status, 'pass');
    for (const key of ['successful', 'uniqueCases', 'expectedCases']) assert.equal(cpu[key], expected, `${name}/${key}`);
    assert.deepEqual(cpu.missing, []); assert.deepEqual(cpu.unresolved, []);
    assert.deepEqual(sorted(cpu.groups.flatMap(group => group.worlds)), sorted(ids), `${name}: missing/duplicate world`);
    if (seedCount === 8) {
      assert.equal(cpu.seedPolicy?.mode, 'expanded-holdout-only');
      assert.equal(cpu.seedPolicy.stage, name === 'expandedHoldoutI11' ? 'I11' : 'I12');
    } else assert.equal(cpu.seedPolicy, undefined, 'Base48 must remain separate from expanded holdout');
  }
  for (const [name, ids] of [['historicalPlay', old], ['play', added]]) {
    const play = plays[name]; assert.equal(play.status, 'pass');
    assert.equal(play.qualifiedGradePairs, ids.length * 3);
    assert.equal(play.completedSeedProcesses, ids.length * 6); assert.equal(play.expectedSeeds, ids.length * 6);
    assert.deepEqual(sorted(play.pairs.map(row => `${row.world}/${row.grade}`)),
      sorted(ids.flatMap(world => grades.map(grade => `${world}/${grade}`))), `${name}: missing/duplicate world-grade`);
    assert(play.sources.every(row => (row.algorithmRevision ?? (name === 'historicalPlay' ? 5 : undefined))
      === (name === 'historicalPlay' ? 5 : 6)), 'Do not relabel executed revisions');
  }
  return {old, added, ids: [...old, ...added]};
}

export function assertPlaySummaryExact(claimedValue, recomputedValue, historical = false) {
  const {createdAt: previousTime, ...claimed} = claimedValue;
  const {createdAt: recomputeTime, ...recomputed} = structuredClone(recomputedValue);
  if (historical && claimed.algorithmRevisions === undefined) {
    // The frozen r5 summary predates explicit version metadata. Verify the
    // stronger current raw checks, then compare its original schema without
    // rewriting any old report or ignoring changed gameplay results.
    assert.deepEqual(recomputed.algorithmRevisions, [5]); delete recomputed.algorithmRevisions;
    assert.equal(recomputed.sources.length, claimed.sources.length);
    for (const [index, row] of recomputed.sources.entries()) {
      assert.equal(claimed.sources[index].algorithmRevision, undefined);
      assert.equal(claimed.sources[index].controllerPolicyRevision, undefined);
      assert.equal(row.algorithmRevision, 5); assert.equal(row.controllerPolicyRevision, 13);
      delete row.algorithmRevision; delete row.controllerPolicyRevision;
    }
  }
  assert.deepEqual(recomputed, claimed, 'Play summary does not match raw evidence');
}

export function validateInheritance(candidate, review, frozen, plan) {
  assert.equal(review.status, 'bounded-pass'); assert.equal(review.reviewer, 'root');
  assert.equal(candidate.machineChecks, 'pass'); assert.equal(candidate.algorithmRevision, 6);
  assert.deepEqual(candidate.qualificationPlan, plan.qualificationPlan);
  assert.deepEqual(candidate.before, frozen.baseline.source);
  for (const key of ['before', 'after', 'exactCurrentProof', 'archivedRecoveryProof', 'currentPackages'])
    assert.deepEqual(review[key], candidate[key], `Inheritance review differs: ${key}`);
  for (const [key, ref, countKey, count] of [
    ['historicalGeneration', plan.historicalGeneration, 'cases', 7488],
    ['historicalFixedPlay', plan.historicalPlay, 'completeOriginalSeedProcesses', 312],
  ]) {
    for (const value of [candidate[key], review[key]]) {
      assert.equal(value.path, ref.path); assert.equal(value.sha256, ref.sha256);
      assert.equal(value.executedAlgorithmRevision, 5, 'Historical evidence was executed by revision5'); assert.equal(value[countKey], count);
    }
  }
  assert.deepEqual(candidate.worlds.map(row => row.worldId).sort(), [...frozen.baseline.worlds].sort());
  assert(candidate.worlds.every(row => row.currentRevision === 6
    && JSON.stringify(row.grades.map(value => value.grade)) === JSON.stringify(grades)));
  for (const [key, value] of Object.entries({worlds: 52, grades: 156, generationCases: 7488, fixedJourneys: 312}))
    assert.equal(review.approvedInheritance[key], value);
}

export function validateRuntimeBinding(binding, kind, plan, source, ids, bytes, sampling = null) {
  const sampledBudget = sampling && kind === 'budget', sampledLifecycle = sampling && kind === 'lifecycle';
  assert.equal(binding.status, sampledBudget ? 'failed' : sampledLifecycle ? 'pass-sampled' : 'pass'); assert.equal(binding.kind, kind);
  assert.deepEqual(binding.finalSource, plan.finalSource); assert.deepEqual(binding.report, plan[kind]);
  for (const flag of ['beforeRuntimeVerified', 'afterRuntimeVerified', 'servedSourceVerified']) assert.equal(binding[flag], true);
  assert.equal(binding.exitCode, sampledBudget ? 1 : 0);
  if (sampledBudget) assert.equal(binding.signal, null);
  assert(Object.hasOwn(runtimeHarnesses, kind), 'Known runtime method required');
  assert.equal(binding.harness.path, runtimeHarnesses[kind], `${kind}: wrong runtime harness`);
  assert.equal(digest(bytes(binding.harness.path)), binding.harness.sha256);
  assert.equal(binding.wrapper.path, sampledLifecycle
    ? 'docs/qa/artifacts/r100-i10-i12/sampling-amendment/execute-lifecycle-sampled.mjs'
    : 'tools/qa/r100-i09-final-probe.mjs', `${kind}: wrong runtime wrapper`);
  assert.equal(digest(bytes(binding.wrapper.path)), binding.wrapper.sha256);
  if (sampledLifecycle) {
    assert.equal(binding.validationMode, 'sampled'); assert.deepEqual(binding.samplingAmendment, plan.samplingAmendment);
    assert.deepEqual(binding.harness, sampling.scopeChanges.lifecycle.harness);
    const scope = sampling.scopeChanges.lifecycle;
    assert.deepEqual(binding.sampleScope, {repetitions: 10, mixedRebuilds: 18, retainedSamples: 12,
      mixedCoverage: scope.mixedCoverage, warmupWorldIds: scope.warmupWorldIds,
      warmupCoverage: scope.warmupWorldIds.map(world => ({world, grade: 'severe', seed: 20261004})),
      fullCatalogWorldCount: 108, limitation: scope.selectionReason});
    assert.equal(binding.exclusiveCpuAndChromeDeclared, true); assert.equal(binding.automaticRetry, false);
    assert.equal(binding.originalHarnessPassed, true); assert.deepEqual(binding.problems, []);
    assert.equal(binding.signal, null);
  }
  if (sampling) {
    assert.equal(binding.expectedWorlds, 108); assert.equal(binding.expectedRevision, 6);
    for (const ref of binding.dependencies ?? []) assert.equal(digest(bytes(ref.path)), ref.sha256, 'Runtime dependency changed');
  }
  const served = Object.fromEntries(Object.entries(source.sources).filter(([file]) => /^(src|data|public)\//.test(file)));
  assert.deepEqual(binding.beforeServedHashes, served); assert.deepEqual(binding.afterServedHashes, served);
  assert.deepEqual(binding.beforeFiles, {nodeWorkingDirectory: root, frozenDirectory: source.temporaryRoot, files: Object.keys(source.sources).length});
  assert.deepEqual(binding.afterFiles, binding.beforeFiles);
  assert.deepEqual([...binding.worldIds].sort(), [...ids].sort());
  if (kind === 'production') {
    assert.equal(binding.probeOptions?.stopOnFailure, true, 'Final revision6 entry coverage must stop after failure');
    assert.equal(binding.probeOptions?.observeWorkers, true, 'Final revision6 entry coverage requires P36 observations');
    const observer = (binding.dependencies ?? []).filter(row => row.path === 'tools/qa/r100-worker-observer.mjs');
    assert.equal(observer.length, 1, 'Exactly one tracked observer source required');
    assert.equal(digest(bytes(observer[0].path)), observer[0].sha256, 'Observer source changed');
    assert.equal(binding.workerObservationStatus, 'pass-observed-events');
    const reference = binding.workerObservation; assert(reference, 'Missing Worker observation report');
    const raw = bytes(reference.path); assert.equal(digest(raw), reference.sha256);
    const observation = JSON.parse(raw), {files, ...claimed} = observation;
    assert(Array.isArray(files) && files.length > 0, 'No raw Worker observations');
    assert.equal(new Set(files.map(row => row.path)).size, files.length, 'Duplicate raw Worker observation file');
    const events = files.flatMap(row => {
      const data = bytes(row.path); assert.equal(digest(data), row.sha256, 'Raw Worker observations changed');
      return data.toString('utf8').split('\n').filter(Boolean).map(line => JSON.parse(line));
    });
    const recomputed = summarizeWorkerEvents(events, ids.length * 3);
    assert.equal(recomputed.status, 'pass-observed-events', 'Original Worker/network events need diagnosis');
    assert.deepEqual(claimed, recomputed, 'Worker observation summary differs from original events');
  }
}

/** All four final runtime methods need their own complete source audit. */
export function validateFinalRuntimeBindings(plan, source, ids, read) {
  const sampling = samplingForPlan(plan, read, ids);
  const kinds = ['production', 'equivalence', 'budget', 'lifecycle'];
  for (const kind of kinds) {
    assert(plan[kind]?.path && /^[a-f0-9]{64}$/.test(plan[kind].sha256), `Missing final runtime report: ${kind}`);
  }
  assert.equal(new Set(kinds.map(kind => plan[kind].path)).size, kinds.length, 'Runtime reports must be distinct');
  assert.equal(plan.runtimeBindings?.length, kinds.length, 'Exactly four runtime-source audits required');
  const candidates = plan.runtimeBindings.map(reference => ({reference, binding: read.receipt(reference)}));
  const result = {};
  for (const kind of kinds) {
    const matches = candidates.filter(row => row.binding.report.path === plan[kind].path);
    assert.equal(matches.length, 1, `Missing runtime-source audit: ${kind}`);
    validateRuntimeBinding(matches[0].binding, kind, plan, source, ids, read.bytes, sampling);
    result[kind] = matches[0];
  }
  return result;
}

/** A numerical pass is not an independent review of Shader ownership. The
 * reviewer must bind every observed sample and the same final-source audit. */
export function validateShaderReview(review, plan, lifecycle, lifecycleBinding) {
  assert.equal(review.status, 'bounded-independent-shader-pass');
  assert.equal(review.reviewer, 'root');
  assert.deepEqual(review.finalSource, plan.finalSource);
  assert.deepEqual(review.report, plan.lifecycle);
  assert.deepEqual(review.sourceBinding, lifecycleBinding);
  for (const field of ['scope', 'ownershipConclusion', 'limitations'])
    assert(typeof review[field] === 'string' && review[field].trim().length > 0, `Missing Shader review ${field}`);
  assert.equal(lifecycle.samples?.length, 12, 'Shader review requires every warmed and GC sample');
  assert.deepEqual(review.reviewedShaderSamples, lifecycle.samples.map(sample => ({
    label: sample.label, created: sample.objects.Shader.created, live: sample.objects.Shader.live, active: sample.objects.Shader.active,
  })), 'Shader review does not concern the observed counts');
}

/** Explicitly reviewed play-only inheritance. It cannot satisfy a generation
 * or art source edge, and is restricted to each originally played recipe. */
export function validateBoundedPlayContinuity(review, report, frozen) {
  assert.equal(review.status, 'approved-bounded'); assert.equal(review.reviewer, 'root');
  assert.equal(report.status, 'pass'); assert.equal(report.purpose, 'r100-ground-edge-production-behavior');
  assert.equal(report.sourceBeforeAndAfterExact, true);
  assert.deepEqual(report.before, review.before); assert.deepEqual(report.after, review.after);
  assert.deepEqual(report.harness, review.reviewedImplementation);
  const fields = ['recipe', 'production', 'nativeBehavior', 'behaviorDiagnostics', 'physicalRaster', 'blockingMeshes', 'nonEdgeMeshes'].sort();
  const identity = row => `${row.world}/${row.grade}/${row.seed}`;
  assert.equal(new Set(review.identities.map(identity)).size, review.identities.length);
  assert.deepEqual(report.cases.map(identity).sort(), review.identities.map(identity).sort());
  const worlds = [...new Set(review.identities.map(row => row.world))];
  assert(worlds.length && worlds.every(world => frozen.batches.some(batch => batch.worlds.includes(world))));
  assert.deepEqual(review.identities.map(identity).sort(), worlds.flatMap(world => grades.flatMap(grade =>
    frozen.actualPlay.seeds.map(seed => identity({world, grade, seed})))).sort());
  for (const row of report.cases) {
    assert.equal(row.behaviorExact, true);
    assert.deepEqual(row.after.exact, row.before.exact, 'Actual production behavior differs');
    assert.deepEqual(Object.keys(row.before.exact).sort(), fields);
    assert(Object.values(row.before.exact).every(value => /^[a-f0-9]{64}$/.test(value)));
    for (const side of [row.before, row.after]) {
      assert.equal(side.algorithmRevision, 6); assert.equal(identity(side), identity(row));
    }
  }
  return {...report, review};
}

/** Preserve the historical source identities while allowing their exact QA
 * executors to live in the repository instead of a disposable temporary tree. */
export function validateHistoricalGenerationSources(supplement, historical) {
  assert(Array.isArray(supplement));
  assert.equal(supplement.length, historical.length, 'Historical source coverage changed');
  assert.equal(new Set(supplement.map(row => row.groupId)).size, supplement.length,
    'Duplicate historical generation group');
  for (const original of historical) {
    const matches = supplement.filter(row => row.groupId === original.groupId);
    assert.equal(matches.length, 1, `Missing historical generation group: ${original.groupId}`);
    const entry = matches[0];
    assert.equal(entry.path, original.path, 'Historical source path changed');
    assert.equal(entry.sha256, original.sha256, 'Historical source SHA changed');
  }
  return supplement;
}

export function validateGenerationHarnessSources(entry, dependencies, bytes) {
  assert(Array.isArray(entry.harnessSources), 'Explicit generation harness sources required');
  assert.deepEqual(entry.harnessSources.map(row => row.dependencyPath).sort(),
    dependencies.map(row => row.path).sort(), 'Generation harness dependency coverage changed');
  for (const row of entry.harnessSources) {
    assert.equal(digest(bytes(row.path)), row.sha256, 'Archived generation harness changed');
    assert.equal(row.sha256, dependencies.find(value => value.path === row.dependencyPath).sha256,
      'Archived generation harness differs from the executed dependency');
  }
}

/** The plan contains hashes of already finished reports and explicit bounded art decisions. */
export function buildProposal(plan, read) {
  assert.equal(plan.version, 1);
  const ledger = read.json('docs/progress/rift-r100.json');
  const index = read.receipt(plan.packages), source = read.receipt(plan.finalSource);
  assert.equal(plan.qualificationPlan.path, qualificationPlanPath);
  const frozen = read.receipt(plan.qualificationPlan); validateExpansionPlan(frozen, {read: read.bytes});
  const generations = Object.fromEntries(['historicalGeneration', 'generation', 'expandedHoldoutI11', 'expandedHoldoutI12']
    .map(key => [key, read.receipt(plan[key])]));
  const plays = Object.fromEntries(['historicalPlay', 'play'].map(key => [key, read.receipt(plan[key])]));
  const scopes = validateAccountingScopes(frozen, generations, plays);
  const inheritanceReview = read.receipt(plan.inheritance), candidate = read.receipt(inheritanceReview.candidate);
  validateInheritance(candidate, inheritanceReview, frozen, plan);
  for (const key of ['harness', 'before', 'after', 'exactCurrentProof', 'archivedRecoveryProof', 'currentPackages', 'historicalSourceContinuity']) {
    const ref = candidate[key]; assert.equal(digest(read.bytes(ref.path)), ref.sha256, `Inheritance input changed: ${key}`);
  }
  const exact = read.receipt(candidate.exactCurrentProof);
  assert.equal(exact.status, 'pass'); assert.equal(exact.sourceBeforeAndAfterExact, true);
  assert.deepEqual(exact.frozenSource, candidate.after);
  assert.deepEqual(exact.cases.map(row => `${row.world}/${row.grade}`).sort(),
    scopes.old.flatMap(world => grades.map(grade => `${world}/${grade}`)).sort());
  for (const row of exact.cases) {
    assert(/^[a-f0-9]{64}$/.test(row.comparablePayloadHash));
    for (const channel of ['albedo', 'normal', 'response', 'emission']) assert(/^[a-f0-9]{64}$/.test(row.surface[channel]));
  }
  const historicalBinding = read.receipt(plan.historicalBinding);
  assert.deepEqual(historicalBinding.finalSource, frozen.baseline.source);
  assert.deepEqual(historicalBinding.generation, plan.historicalGeneration); assert.deepEqual(historicalBinding.play, plan.historicalPlay);
  const play = {pairs: [...plays.historicalPlay.pairs, ...plays.play.pairs],
    attempts: [...plays.historicalPlay.attempts, ...plays.play.attempts], sources: [...plays.historicalPlay.sources, ...plays.play.sources],
    limitations: 'Original fixed seed identities only: old52 executed revision5 with reviewed inheritance; added56 executed revision6.'
      + (plays.play.sources.some(row => row.controllerPolicyRevision === 16)
        ? ' Explicit bounded policy16 input rechecks accompany the preserved original policy15 failures; they are additional attempts, not additional unique seed processes.' : '')
      + (plays.play.sources.some(row => row.controllerPolicyRevision === 17)
        ? ' Policy17 independently records bounded visible-facing input corrections at the original melee opportunities; the original policy15 deaths remain, and no extra search attempts or game changes are implied.' : '')
      + ' Natural48 and sound review remain separate.'};
  const runtime = Object.fromEntries(['production', 'equivalence', 'budget', 'lifecycle']
    .map(kind => [kind, read.receipt(plan[kind])]));
  const {production, equivalence} = runtime;
  const art = read.receipt(plan.art), technicalReview = read.receipt(plan.technicalReview);
  const relative = file => path.isAbsolute(file) ? path.relative(root, file) : file;
  const bytes = file => read.bytes(relative(file));
  const exists = file => read.exists ? read.exists(relative(file)) : fs.existsSync(path.resolve(root, relative(file)));
  // A matching hash binds bytes, not the truth of a derived claim. Recompute
  // coverage from those raw bytes so stale summaries cannot grant qualification.
  for (const [name, cpu] of Object.entries(generations))
    assert.deepEqual(buildGenerationSummary(cpu.plan.path, bytes, exists), cpu, `${name}: summary does not match raw evidence`);
  for (const [name, value] of Object.entries(plays)) {
    assertPlaySummaryExact(value, buildPlaySummary(value.plan, bytes, exists), name === 'historicalPlay');
  }
  assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
  assert.equal(index.worlds.length, 108);
  const ids = index.worlds.map(row => row.worldId), sorted = rows => [...rows].sort();
  assert.deepEqual(sorted(ids), sorted(scopes.ids));
  assert.deepEqual(sorted(ids), sorted(ledger.worlds.map(row => row.id)));
  // Re-read raw inputs by their recorded hashes instead of trusting a mutable summary.
  for (const cpu of Object.values(generations)) for (const group of cpu.groups) for (const attempt of group.attempts) {
    for (const item of [attempt.source, attempt.plan, attempt.raw]) {
      const file = path.isAbsolute(item.path) ? path.relative(root, item.path) : item.path;
      assert.equal(digest(read.bytes(file)), item.sha256, `Generation input changed: ${file}`);
    }
  }
  for (const item of play.sources) {
    assert.equal(digest(read.bytes(item.policy)), item.policySha256);
    assert.equal(digest(read.bytes(`${item.folder}/batch-report.json`)), item.reportSha256);
    assert.equal(digest(read.bytes(item.sourceManifest)), item.sourceManifestSha256);
  }
  for (const attempt of play.attempts) if (attempt.reportSha256) assert.equal(digest(read.bytes(attempt.report)), attempt.reportSha256);
  const gold = read.json('tools/recovery/fixtures/r100-revision1-gold.json').records.map(row => row.identity);
  const sampling = samplingForPlan(plan, read, ids);
  for (const [kind, report] of Object.entries(runtime)) {
    if (sampling && kind === 'budget') validateSampledBudget(report, plan, sampling, read);
    else if (sampling && kind === 'lifecycle') validateSampledLifecycle(report, sampling);
    else validateFinalReport(kind, report, ids, gold, 6);
  }
  const runtimeBindings = validateFinalRuntimeBindings(plan, source, ids, read);
  const shaderReview = read.receipt(plan.shaderReview);
  validateShaderReview(shaderReview, plan, runtime.lifecycle, runtimeBindings.lifecycle.reference);
  assert(Object.keys(production.loadedSourceHashes ?? {}).length > 0);
  assert(Object.keys(equivalence.loadedSourceHashes ?? {}).length > 0);
  assert.equal(technicalReview.status, sampling ? 'independent-technical-sampled-pass' : 'independent-technical-pass');
  if (sampling) assert.equal(technicalReview.reviewer, 'root');
  assert.equal(technicalReview.finalSourceSha256, plan.finalSource.sha256);
  assert.equal(art.status, 'bounded-internal-pass'); assert.equal(art.worlds.length, 108);
  assert.equal(art.finalSourceSha256, plan.finalSource.sha256);
  assert.deepEqual(sorted(art.worlds.map(row => row.worldId)), sorted(ids));

  // Every reused capture/play source must have an explicit world projection to the final snapshot.
  const continuity = [...plan.continuity, ...historicalBinding.continuity].map(item => read.receipt(item));
  for (const value of continuity) {
    assert.equal(value.status, 'pass'); read.receipt(value.before); read.receipt(value.after);
    assert.equal(new Set(value.worlds.map(row => row.worldId)).size, value.worlds.length);
  }
  const boundedPlayContinuity = (plan.boundedPlayContinuity ?? []).map(ref => {
    const review = read.receipt(ref), report = read.receipt(review.behaviorReport);
    read.receipt(review.before); read.receipt(review.after);
    assert.deepEqual(report.qualificationPlan, plan.qualificationPlan);
    assert.equal(digest(read.bytes(review.reviewedImplementation.path)), review.reviewedImplementation.sha256);
    const oldPlay = read.receipt(review.originalPlayReview), currentArt = read.receipt(review.normalArtReview);
    for (const value of [oldPlay, currentArt]) {
      assert.equal(value.status, 'bounded-pass'); assert.equal(value.reviewer, 'root');
    }
    assert.deepEqual(oldPlay.source, review.before); assert.deepEqual(currentArt.sourceManifest, review.after);
    assert(review.identities.every(row => currentArt.repairRecheckWorlds.includes(row.world)
      && currentArt.grades.includes(row.grade)), 'Changed surface requires its new normal-view review');
    return validateBoundedPlayContinuity(review, report, frozen);
  });
  function hasContinuity(world, manifest, hash, playAttempt = null) {
    const target = `${plan.finalSource.path}/${plan.finalSource.sha256}`, queue = [`${manifest}/${hash}`], seen = new Set();
    while (queue.length) {
      const current = queue.shift(); if (current === target) return true;
      if (seen.has(current)) continue; seen.add(current);
      for (const value of continuity) if (`${value.before.path}/${value.before.sha256}` === current
        && value.worlds.some(row => row.worldId === world)) queue.push(`${value.after.path}/${value.after.sha256}`);
      // The sole cross-revision edge is the explicit, root-approved old52 review.
      if (scopes.old.includes(world) && current === `${candidate.before.path}/${candidate.before.sha256}`)
        queue.push(`${candidate.after.path}/${candidate.after.sha256}`);
      // Never traverse this edge for CPU generation, inherited art or packages.
      if (playAttempt) for (const value of boundedPlayContinuity) {
        if (`${value.before.path}/${value.before.sha256}` !== current) continue;
        const row = value.cases.find(row => row.world === world && row.grade === playAttempt.grade && row.seed === playAttempt.seed);
        if (!row) continue;
        const raw = read.json(playAttempt.report); assert.equal(raw.realJourneyAttempts.length, 1);
        const recipe = raw.realJourneyAttempts[0].identity.generation;
        assert.equal(digest(JSON.stringify({...recipe, package: {...recipe.package, dependencyHash: 'identity-only'}})),
          row.before.exact.recipe, 'Behavior evidence must use the actual played recipe');
        queue.push(`${value.after.path}/${value.after.sha256}`);
      }
    }
    return false;
  }
  for (const world of scopes.old) assert(hasContinuity(world, candidate.after.path, candidate.after.sha256), `Inheritance stops before final source: ${world}`);
  const historicalSources = plan.historicalGenerationSources === undefined ? historicalBinding.generationSources
    : validateHistoricalGenerationSources(plan.historicalGenerationSources, historicalBinding.generationSources);
  for (const [set, cpu] of Object.entries(generations)) {
    const sources = set === 'historicalGeneration' ? historicalSources
      : plan.generationSources.filter(row => row.summary === plan[set].path);
    assert.equal(sources.length, cpu.groups.length);
    for (const group of cpu.groups) {
      const entries = sources.filter(row => row.groupId === group.id);
      assert.equal(entries.length, 1, `Missing exact generation source: ${set}/${group.id}`);
      const entry = entries[0], snapshot = read.receipt(entry);
      const toolDependencies = group.dependencies.filter(row => row.path.startsWith('tools/'));
      const archivedHarness = set !== 'historicalGeneration' || plan.historicalGenerationSources !== undefined;
      if (archivedHarness) validateGenerationHarnessSources(entry, toolDependencies, read.bytes);
      for (const dependency of group.dependencies) {
        if (dependency.path.startsWith('tools/')) {
          // Old executors copied their entry beside the frozen game. Current
          // preparation copies it into a repository receipt, never reads a newer harness.
          if (!archivedHarness)
            assert.equal(digest(fs.readFileSync(path.join(snapshot.temporaryRoot, dependency.path))), dependency.sha256);
        } else assert.equal(snapshot.sources[dependency.path], dependency.sha256, `Generation/frozen-source mismatch: ${set}/${group.id}/${dependency.path}`);
      }
      for (const world of group.worlds) assert(hasContinuity(world, entry.path, entry.sha256), `Unbound CPU world: ${world}`);
    }
  }
  for (const key of ['generation', 'historicalGeneration', 'expandedHoldoutI11', 'expandedHoldoutI12', 'play', 'historicalPlay', 'inheritance', 'production', 'equivalence', 'budget', 'lifecycle', 'shaderReview', ...(sampling ? ['samplingAmendment', 'budgetStop', 'runtimeBindings'] : [])])
    assert.deepEqual(technicalReview.evidence[key], plan[key], `Technical review concerns different ${key} evidence`);
  for (const [file, hash] of Object.entries(source.sources)) {
    assert.equal(digest(read.bytes(file)), hash, `Current runtime differs from final source: ${file}`);
    assert.equal(digest(fs.readFileSync(path.join(source.temporaryRoot, file))), hash, `Frozen copy changed: ${file}`);
  }
  const proposed = structuredClone(ledger), additions = [];
  function addEvidence(row) {
    const prior = proposed.evidence.find(item => item.id === row.id);
    if (prior) assert.deepEqual(prior, row, `Do not overwrite evidence: ${row.id}`);
    else { proposed.evidence.push(row); additions.push(row.id); }
    return row.id;
  }
  const append = (values, item) => values.includes(item) ? values : [...values, item];
  for (const item of index.worlds) {
    const world = proposed.worlds.find(row => row.id === item.worldId);
    const manifest = read.json(item.dependencyManifest.path);
    assert.equal(digest(read.bytes(item.dependencyManifest.path)), item.dependencyManifest.hash);
    assert.equal(manifest.worldId, world.id);
    assert.deepEqual(manifest.algorithm, {id: 'r100-native', version: 3, revision: 6});
    assert.deepEqual(item.grades, grades); assert.equal(world.family, item.family);
    assert.equal(world.implementation, 'implemented');
    assert.notEqual(world.review.human, 'changes-requested', 'Unresolved user request requires explicit review');
    for (const dependency of manifest.dependencies) {
      assert.equal(digest(read.bytes(dependency.path)), dependency.sha256, `Stale package: ${dependency.path}`);
      if (source.sources[dependency.path]) assert.equal(source.sources[dependency.path], dependency.sha256);
    }
    const visual = art.worlds.find(row => row.worldId === world.id);
    assert.equal(visual.status, 'bounded-internal-pass');
    assert(visual.scope?.length && visual.limitations?.length && visual.independentReviewer === 'root');
    assert.equal(visual.dependencyHash, item.dependencyManifest.hash);
    assert(visual.evidence.length > 0);
    for (const evidence of visual.evidence) {
      read.receipt(evidence);
      assert(hasContinuity(world.id, evidence.sourceManifest, evidence.sourceManifestSha256), `Unbound art source: ${world.id}`);
    }
    for (const grade of grades) {
      const pairs = play.pairs.filter(row => row.world === world.id && row.grade === grade);
      assert.equal(pairs.length, 1); assert.equal(pairs[0].qualified, true);
      assert.deepEqual(pairs[0].seeds.map(row => row.seed), [20261005, 3075192741]);
      assert(pairs[0].seeds.every(row => row.processComplete));
      assert(play.attempts.some(row => row.world === world.id && row.grade === grade
        && row.processComplete && row.searchAndExtract && row.collected.length > 0 && row.outcome === 'extract'));
      for (const seed of pairs[0].seeds) {
        const attempts = play.attempts.filter(row => row.world === world.id && row.grade === grade && row.seed === seed.seed && row.processComplete);
        assert(attempts.length > 0);
        for (const attempt of attempts) {
          const owner = play.sources.find(row => attempt.report.startsWith(`${row.folder}/`));
          assert(owner && hasContinuity(world.id, owner.sourceManifest, owner.sourceManifestSha256, attempt), `Unbound play source: ${world.id}/${grade}`);
        }
      }
      const rows = production.cases.filter(row => row.world === world.id && row.grade === grade);
      assert.equal(rows.length, 1);
      const row = rows[0]; assert.equal(row.status, 'passed'); assert.deepEqual(row.errors, []);
      assert.equal(row.coldIdentityPreserved, true);
      assert.equal(row.bodyGeometry?.version, 1);
      assert.equal(row.bodyGeometry.fullBodyCheckpointAdmitted, true);
      assert.equal(row.bodyGeometry.coldBodyPositionPreserved, true);
      assert.equal(row.identity.generation.package.id, `r100-${world.id}`);
      assert.equal(row.identity.generation.package.grade, grade);
      assert.equal(row.identity.generation.package.algorithmRevision, 6);
      assert.deepEqual(row.historyBeforeDeparture, {version: 1, visits: []});
      assert.deepEqual(row.committedWorldHistory, {version: 1, visits: [{worldId: world.id, grade}]});
      assert.equal(row.worldHistoryPreserved, true);
    }
    restoreReviewedRevision5Invalidation(world, scopes.old, plan);
    const common = {revision, worldId: world.id, dependencyHash: item.dependencyManifest.hash, grades: [...grades],
      sourceManifest: plan.finalSource.path, sourceManifestSha256: plan.finalSource.sha256};
    const evidence = {
      technical: {id: `R100-R6-FINAL-TECHNICAL-${world.id}`, kind: 'source', purpose: 'technical-review', ...common,
        path: plan.technicalReview.path, supportingPaths: [plan.historicalGeneration.path, plan.generation.path, plan.expandedHoldoutI11.path, plan.expandedHoldoutI12.path, plan.inheritance.path, plan.equivalence.path, plan.production.path, plan.budget.path, plan.lifecycle.path, plan.shaderReview.path],
        scope: '每档32普通、8边界及16保留种子；旧52基础48沿已审连续性继承revision5执行，新56基础48与全108追加8为revision6。当前跨引擎身份、正式进入/冷续、逐世界60秒性能和重复切换资源回收另验，Shader计数由独立审查绑定。',
        limitations: '固定有限样本和本机证据；不代表全种子、全设备或实际声音听感。'},
      visual: {id: `R100-R6-FINAL-VISUAL-${world.id}`, kind: 'source', purpose: 'bounded-art-review', ...common,
        path: plan.art.path, supportingPaths: visual.evidence.map(row => row.path), scope: visual.scope, limitations: visual.limitations},
      experience: {id: `R100-R6-FINAL-EXPERIENCE-${world.id}`, kind: 'runtime', purpose: 'fixed-seed-search-extraction', ...common,
        path: scopes.old.includes(world.id) ? plan.historicalPlay.path : plan.play.path,
        supportingPaths: scopes.old.includes(world.id) ? [plan.inheritance.path] : [],
        executedAlgorithmRevision: scopes.old.includes(world.id) ? 5 : 6,
        scope: '三档各两个原定种子的实际键盘过程，每档至少一次非入口搜取后撤回同一已结算档；旧52为明确继承，新56为当前执行；失败、空返和死亡完整保留。',
        limitations: play.limitations},
      production: {id: `R100-R6-FINAL-PRODUCTION-${world.id}`, kind: 'runtime', purpose: 'production-integration', ...common,
        path: plan.production.path, coverage: ['production-entry', 'recovery'],
        scope: '三档从正式备行及启用池出发、暂停保存、整页重载继续；当前身体位置和身份保留。',
        limitations: '覆盖测试预先选择出发随机数，不是自然世界分布、完整游玩或经济样本。'},
    };
    if (sampling) {
      const measured = sampling.scopeChanges.budget.completedWorldIds.includes(world.id);
      evidence.technical.supportingPaths.push(plan.samplingAmendment.path, plan.budgetStop.path);
      evidence.technical.validationMode = 'sampled';
      evidence.technical.samplingAmendment = structuredClone(plan.samplingAmendment);
      evidence.technical.performanceCoverage = {measured, grade: measured ? 'severe' : null,
        originalCaseIndex: measured ? sampling.scopeChanges.budget.completedWorldIds.indexOf(world.id) : null,
        status: measured ? 'completed-60-second-sample' : world.id === sampling.scopeChanges.budget.interruptedWorldId ? 'interrupted-not-qualified-as-measurement' : 'not-started',
        completedSamples: 74, totalWorlds: 108};
      evidence.technical.scope = '生成、原定过程、当前跨引擎身份和三档正式进入/冷续按完整内容范围验证；用户授权性能与资源抽查。'
        + (measured ? '该世界在74项完整重档60秒性能样本内。' : '该世界无完整最终60秒性能测量，不宣称该项通过。')
        + '资源限6个重档预热、10次同世界和前18个低档混合重建，12次GC观测；独立Shader审查另绑定。';
      evidence.technical.limitations = sampling.limitations + ' 原预算报告保留failed/exit1；外层operator末段采样缺口及未获得退出码保留。';
    }
    if (world.review.human === 'approved') {
      world.historicalHumanApproval ??= {revision: world.revision, dependencyManifest: structuredClone(world.dependencyManifest),
        evidenceIds: [...world.reviewEvidence.human],
        grades: Object.fromEntries(grades.map(grade => [grade, {status: world.grades[grade].review.human,
          evidenceIds: [...(world.grades[grade].reviewEvidence.human ?? [])]}])),
        note: '原有用户视觉通过保留；这不等于对当前整体修订或新增世界的重新审批。'};
      world.review.human = 'pending';
    }
    world.revision = revision; world.generation = {...manifest.algorithm};
    world.dependencyManifest = structuredClone(item.dependencyManifest); world.integration = 'production';
    for (const [axis, proof] of Object.entries(evidence)) {
      const id = addEvidence(proof); world.evidenceIds = append(world.evidenceIds, id);
      if (axis !== 'production') {
        world.review[axis] = 'pass'; world.reviewEvidence[axis] = append(world.reviewEvidence[axis], id);
        world.reviewScope = {...world.reviewScope, [axis]: proof.scope};
      }
      for (const grade of grades) {
        const state = world.grades[grade]; assert.equal(state.invalidated, false);
        state.integration = 'production';
        if (state.review.human === 'approved') state.review.human = 'pending';
        if (axis === 'production') state.integrationEvidence = append(state.integrationEvidence, id);
        else { state.review[axis] = 'pass'; state.reviewEvidence[axis] = append(state.reviewEvidence[axis], id); }
      }
    }
  }
  for (const key of Object.keys(ledger).filter(key => !['worlds', 'evidence'].includes(key))) assert.deepEqual(proposed[key], ledger[key]);
  assert.deepEqual(proposed.evidence.slice(0, ledger.evidence.length), ledger.evidence);
  const validation = checkPlan(proposed, {root});
  assert(validation.ok, validation.errors.join('\n'));
  assert.equal(validation.counts.qualified, 108); assert.equal(validation.counts.productionGradeCases, 324);
  assert.equal(validation.counts.humanApproved, 0);
  return {proposed, summary: {...(sampling ? {validationMode: 'sampled', samplingAmendment: plan.samplingAmendment, budgetCompleted: 74, budgetInterrupted: 1, budgetNotStarted: 33, lifecycleMixed: 18, full89Claim: false} : {}), addedEvidence: additions, counts: validation.counts,
    accounting: {historicalRevision5Base: 7488, currentRevision6Base: 8064, additionalHoldout: 2592, fixedSeedProcesses: 648},
    preserved: ['iteration states', 'issue states', 'historical evidence and executed revisions', 'original human approval scopes', 'release gates', 'audio approval']}};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--plan');
  assert(at >= 0 && args[at + 1], 'Usage: --plan <finished evidence plan> [--write]');
  const read = reader(), plan = read.json(args[at + 1]);
  const result = buildProposal(plan, read);
  if (args.includes('--write')) {
    const target = path.join(root, 'docs/progress/rift-r100.json'), temporary = `${target}.r6-${process.pid}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(result.proposed, null, 2) + '\n', {flag: 'wx'}); read.unchanged(); fs.renameSync(temporary, target); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  console.log(JSON.stringify({written: args.includes('--write'), ...result.summary}, null, 2));
}
