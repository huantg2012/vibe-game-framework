/** Read completed matrix/build/art receipts only. No checker, renderer or browser is executed. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const base = 'docs/qa/artifacts/r100-i10-i12', root = process.cwd();
const output = `${base}/closeout-independent-review/final-static-readiness-supplement.json`;
assert(!fs.existsSync(output));
const sha = value => createHash('sha256').update(value).digest('hex');
const inputs = new Map();
function bytes(file, expected) {
  const content = fs.readFileSync(file), actual = sha(content);
  if (expected) assert.equal(actual, expected, file);
  const relative = path.relative(root, path.resolve(file)); inputs.set(relative, {path: relative, sha256: actual}); return content;
}
const read = item => JSON.parse(bytes(item.path, item.sha256));
const ref = file => ({path: path.relative(root, path.resolve(file)), sha256: sha(fs.readFileSync(file))});
const priorRef = {path: `${base}/closeout-independent-review/final-static-readiness-review.json`, sha256: '1ea362f34f8e8406718acfa5f201d69362c9fa2ef961ad4f204d06154137ae79'};
const prior = read(priorRef), source = read(prior.finalSource);
const executionRef = {path: `${base}/final-controlled-execution/execution.json`, sha256: '0797dda549775996b971a27c13422e5051c1fa2f000cc483657be52a5a6d37cc'};
const execution = read(executionRef), commands = read(execution.commands), plan = read(execution.qualificationPlan);
assert.equal(execution.status, 'pass'); assert.deepEqual(execution.finalSource, prior.finalSource);
bytes(execution.preparer.path, execution.preparer.sha256);
assert.equal(commands.frozenRuntime.sha256, prior.finalSource.sha256);
assert.equal(path.resolve(commands.frozenRuntime.path), path.resolve(prior.finalSource.path));
assert.deepEqual(commands.qualificationPlan, execution.qualificationPlan);
assert.deepEqual(commands.tool, execution.preparer); assert.equal(commands.status, 'prepared-not-run');
const worlds = [...plan.baseline.worlds, ...plan.batches.flatMap(row => row.worlds)];
assert.deepEqual(commands.worldIds, worlds); assert.equal(worlds.length, 108);
assert.deepEqual(execution.stages.map(stage => stage.id), ['prepare', 'capability', 'presentation']);
for (const [i, stage] of execution.stages.entries()) {
  assert.equal(stage.exitCode, 0); bytes(stage.log.path, stage.log.sha256);
  for (const edge of [stage.before, stage.after]) {
    assert.equal(edge.sourceFiles, 1397); assert(edge.workingTreeAndFrozenExact && edge.sourceAndPlanExact);
  }
  assert(Date.parse(stage.startedAt) < Date.parse(stage.finishedAt));
  if (i) assert(Date.parse(execution.stages[i - 1].finishedAt) < Date.parse(stage.startedAt));
}
for (const input of commands.copiedInputs) {
  bytes(input.original, input.sha256); bytes(input.target, input.sha256);
}
assert.equal(commands.copiedInputs.length, 4);
const dynamicAbility = plan.i11ContractMatrix.abilitySource;
assert.equal(source.sources[dynamicAbility.path], dynamicAbility.sha256);
bytes(path.join(source.temporaryRoot, dynamicAbility.path), dynamicAbility.sha256);
const dependencyRecords = new Map(), bindingRows = [];
for (const command of commands.commands) {
  const stage = execution.stages.find(row => row.id === command.kind); assert(stage);
  assert.deepEqual(stage.command, [command.command, ...command.args]); assert.equal(stage.cwd, command.cwd);
  const executorBytes = bytes(command.executor.path, command.executor.sha256);
  assert.equal(command.args[0], command.executor.path); assert(command.finalCoverageCompiled);
  assert.equal(command.args[1], path.resolve(execution[command.kind].path));
  assert.deepEqual(command.unsetEnvironment, ['QA_WORLDS']);
  for (const directory of ['src', 'data'])
    assert.equal(fs.realpathSync(path.join(command.cwd, directory)), fs.realpathSync(path.join(source.temporaryRoot, directory)));
  for (const dependency of command.dependencies) {
    if (dependency.origin === 'immutable-runtime') {
      assert.equal(source.sources[dependency.path], dependency.sha256);
      if (!dependencyRecords.has(dependency.path)) bytes(path.join(source.temporaryRoot, dependency.path), dependency.sha256);
    } else {
      assert.equal(dependency.origin, 'copied-harness');
      const copied = commands.copiedInputs.find(row => row.original === dependency.path); assert(copied);
      assert.equal(copied.sha256, dependency.sha256); bytes(copied.target, dependency.sha256);
    }
    if (dependencyRecords.has(dependency.path)) assert.equal(dependencyRecords.get(dependency.path).sha256, dependency.sha256);
    dependencyRecords.set(dependency.path, dependency);
  }
  if (command.kind === 'presentation') {
    assert(executorBytes.toString().includes('var finalMatrix = true;'));
    assert(executorBytes.toString().includes('Final matrix cannot select a partial world list'));
  }
  bindingRows.push({kind: command.kind, executor: command.executor, dependencyCount: command.dependencies.length,
    expectedCases: command.expectedCases, inputAndExecutorCurrentHashesMatchPrepared: true, stage: stage.id});
}
const capability = read(execution.capability), presentation = read(execution.presentation);
for (const report of [capability, presentation]) {
  assert.equal(report.status, 'pass'); assert.deepEqual(report.plan, execution.qualificationPlan);
  const copied = commands.copiedInputs.find(row => row.original === report.source.path); assert(copied);
  assert.equal(report.source.sha256, copied.sha256);
}
assert.deepEqual(capability.abilitySource, dynamicAbility);
const matrix = plan.i11ContractMatrix, directions = matrix.orientationsDegrees, phases = matrix.normalizedAnimationPhases;
assert.deepEqual(directions, [0, 45, 90, 135, 180, 225, 270, 315]); assert.deepEqual(phases, [0, .25, .5, .75]);
const expectedCapability = matrix.abilityFamilies.flatMap(family => directions.flatMap(degrees => phases.flatMap(phase =>
  ['open', 'occluded', 'void', 'solid'].map(topology => `${family}/${degrees}/${phase}/${topology}`))));
const actualCapability = capability.rows.map(row => {
  const key = `${row.family}/${row.degrees}/${row.phase}/${row.topology}`; assert.equal(row.label, key);
  if (matrix.abilitySlots[row.family] === 'passive') {
    assert.equal(row.accepted, 'passive-at-departure'); assert.equal(row.continuationExact, true);
    assert.equal(row.receipt.familyId, row.family); assert.equal(row.receipt.definitionId, row.definitionId); assert(row.receipt.benefit > 0);
  } else {
    assert.equal(typeof row.accepted, 'boolean'); assert.equal(row.commits, Number(row.accepted));
    if (row.accepted) {assert.equal(row.continuationExact, true); assert.equal(row.activeEffect.definitionId, row.definitionId);}
    else {assert.equal(row.continuationExact, undefined); assert.equal(row.activeEffect, undefined);}
  }
  return key;
});
assert.equal(capability.rows.length, 1536); assert.equal(capability.counts.cases, 1536); assert.equal(new Set(actualCapability).size, 1536);
assert.deepEqual([...actualCapability].sort(), [...expectedCapability].sort());
assert.equal(presentation.coverageMode, 'final108'); assert.deepEqual(presentation.worlds, worlds);
const presentationPhases = [...phases, .8, .9];
const expectedPresentation = worlds.flatMap(world => ['low', 'medium', 'severe'].flatMap(grade => directions.flatMap(degrees =>
  presentationPhases.map(phase => `${world}/${grade}/${degrees}/${phase}`))));
const actualPresentation = presentation.rows.map(row => {
  assert.equal(row.restorationExact, true); assert.equal(row.pausedClockExact, true);
  assert([row.position.x, row.position.y, row.elapsedMs, row.sourceCount, row.activeLightCount].every(Number.isFinite));
  assert(row.elapsedMs >= 0 && row.sourceCount > 0 && row.activeLightCount >= 0 && row.activeLightCount <= 8);
  return `${row.world}/${row.grade}/${row.degrees}/${row.phase}`;
});
assert.equal(presentation.rows.length, 15552); assert.equal(presentation.counts.cases, 15552); assert.equal(new Set(actualPresentation).size, 15552);
assert.deepEqual([...actualPresentation].sort(), [...expectedPresentation].sort());
assert.equal(presentation.counts.drawCalls, 15552 * 5); assert.equal(presentation.counts.destroyed, 15552 * 2);
for (const kind of ['capability', 'presentation']) {
  const stage = execution.stages.find(row => row.id === kind);
  const log = JSON.parse(bytes(stage.log.path, stage.log.sha256));
  assert.equal(log.status, 'pass');
  for (const [key, value] of Object.entries((kind === 'capability' ? capability : presentation).counts)) assert.equal(log[key], value);
}

const artReviewRef = {path: `${base}/final-art-root-review.json`, sha256: 'c0b765ab2c9ee7e41216a5148d65cb67643faf04054ae86bf09ed244ecd8694b'};
const artRef = {path: `${base}/final-art-review.json`, sha256: 'f22a0bcda8d3c2812520260df5331f8c316657c209698b1efa279aab833b9e83'};
const artReview = read(artReviewRef), art = read(artRef), candidate = read(artReview.candidate);
assert.deepEqual(artReview.candidate, prior.artMetadata.candidate);
assert.deepEqual(artReview.finalSource, prior.finalSource); assert.deepEqual(artReview.packages, prior.packages.index);
assert.deepEqual(art.rootBindingReview, artReviewRef); assert.equal(artReview.reviewer, 'root'); assert.equal(art.reviewer, 'root');
assert.equal(art.status, 'bounded-internal-pass'); assert.equal(artReview.status, 'bounded-internal-pass');
assert.equal(art.worlds.length, 108); assert.equal(art.summary.boundedInternalPassWorlds, 108);
assert.equal(art.summary.rootDispositionPendingWorlds, 0);
let artEvidenceCount = 0;
for (let i = 0; i < 108; i++) {
  const current = art.worlds[i], old = candidate.worlds[i]; assert.equal(current.worldId, old.worldId);
  for (const key of ['scope', 'limitations', 'historicalEvidence', 'authorEvidence', 'rootEvidence', 'finalSource', 'finalDependencyManifest'])
    assert.deepEqual(current[key], old[key]);
  assert.equal(current.status, 'bounded-internal-pass'); assert.deepEqual(current.finalBinding.rootReview, artReviewRef);
  assert.equal(current.evidence.length, old.evidence.length);
  for (let j = 0; j < current.evidence.length; j++) {
    const evidence = current.evidence[j], original = old.evidence[j];
    for (const key of ['path', 'sha256', 'sourceManifest', 'sourceManifestSha256', 'role']) assert.deepEqual(evidence[key], original[key]);
    assert.deepEqual(evidence.finalBinding.target, original.finalBinding.target);
    assert.deepEqual(evidence.finalBinding.continuity, original.finalBinding.continuity); artEvidenceCount++;
  }
}
assert.equal(artEvidenceCount, 260); assert(artReview.humanApproval.startsWith('pending'));
assert(artReview.audioListening.includes('not-reviewed'));

const buildRef = {path: `${base}/final-build/execution.json`, sha256: '5aa16d4960c33d0981667cec3086553f793db9d7c526cb071a320fd1f9f6c686'};
const build = read(buildRef); assert.equal(build.status, 'pass'); assert.deepEqual(build.finalSource, prior.finalSource);
assert.equal(build.inputs.length, 6); for (const item of build.inputs) bytes(item.path, item.sha256);
assert.deepEqual(build.commands.map(row => row.command), [['node', 'tools/world-study/codegen-r100-worlds.mjs', '--check'],
  ['node', 'tools/world-study/codegen-r100-packages.mjs', '--check'], ['npm', 'run', 'build']]);
for (const command of build.commands) {
  assert.equal(command.exitCode, 0); bytes(command.log.path, command.log.sha256);
  for (const edge of [command.before, command.after]) {assert.equal(edge.files, 1397); assert(edge.workingTreeAndFrozenExact);}
}
const buildLog = bytes(build.commands[2].log.path, build.commands[2].log.sha256).toString();
assert(buildLog.includes('tsc && vite build')); assert(buildLog.includes('✓ built in'));
const warningLines = buildLog.split('\n').filter(line => line.includes('Some chunks are larger') || line.includes('game-config-') && line.includes('.js'));
assert.equal(warningLines.length, 2);
const packageJson = JSON.parse(bytes('package.json', source.sources['package.json'])); assert.equal(packageJson.scripts.build, 'tsc && vite build');
assert.equal(packageJson.scripts.test, undefined);

const result = {schema: 'coh.qa.final-static-readiness-supplement.v1', status: 'pass-completed-controlled-matrices-build-and-bounded-art-binding',
  at: new Date().toISOString(), reviewer: 'i12_qa', auditor: ref(fileURLToPath(import.meta.url)), supplementsWithoutChanging: priorRef,
  finalSource: prior.finalSource,
  controlledMatrices: {execution: executionRef, commands: execution.commands, executors: bindingRows, uniqueDependencyFiles: dependencyRecords.size,
    copiedInputs: commands.copiedInputs, runtimeReadInputOutsideBundle: dynamicAbility,
    capability: {report: execution.capability, actualKeys: actualCapability.length, uniqueKeys: new Set(actualCapability).size,
      cartesianProduct: '12 authored ordinary core families ×8 directions ×4 lifecycle phases ×4 controlled topologies',
      completeExpectedKeySet: true, activeAccepted: capability.rows.filter(row => row.accepted === true).length,
      activeRefused: capability.rows.filter(row => row.accepted === false).length,
      passiveAtDeparture: capability.rows.filter(row => row.accepted === 'passive-at-departure').length, counters: capability.counts},
    presentation: {report: execution.presentation, actualKeys: actualPresentation.length, uniqueKeys: new Set(actualPresentation).size,
      cartesianProduct: '108 authored worlds ×3 grades ×8 directions ×6 phases', completeExpectedKeySet: true,
      phases: presentationPhases, counters: presentation.counts},
    rendererBoundary: {capability: 'Graphics Proxy records calls/finite arguments; scene graphics are adapted. Actual ability/inventory/control/collision runtime is exercised on controlled fixtures.',
      presentation: 'Actual authored map/collision/presentation clocks use a renderer object whose draw records lights/activity/time/mode and gpuBytes is0. Scene images/textures/graphics are adapters; no actual GPU rasterization or audible playback.',
      pause: 'No-tick and setMotion clock contracts; not an actual browser pause-key test.',
      executorBinding: 'Prepared executor SHA and declared compiled dependencies match fresh bytes; actual execution command/cwd/report/log references agree. Original execution receipt records full source/plan checks before/after; this audit does not invent per-step executor telemetry.'}},
  artDisposition: {rootReview: artReviewRef, finalArt: artRef, worlds: 108, activeEvidenceBindings: artEvidenceCount,
    scopesLimitationsHistoryAndRoutesUnchanged: true, status: 'bounded-internal-pass', freshImagesViewed: 0,
    humanApproval: artReview.humanApproval, audioListening: artReview.audioListening},
  build: {execution: buildRef, commands: build.commands.map(row => ({command: row.command, exitCode: row.exitCode, log: row.log})),
    buildIncludes: ['TypeScript compiler', 'Vite build'], dedicatedNpmTestScript: false, preservedWarnings: warningLines,
    limitation: 'Build exit0 does not establish bundle-size, first-screen load, GPU stability or gameplay performance thresholds.'},
  limits: ['No map generator, controlled checker, build command, restore or browser was rerun by this audit.',
    'Runtime production/equivalence/budget/lifecycle and final binder integrity remain separate unfinished verification stages in this supplement.',
    'The prior draft retains its original null fields and original static audit stays immutable; subsequent completed artifacts are referenced here without retroactively changing the draft.',
    'No fresh art quality or audio listening acceptance is inferred from internal root binding or recorded-renderer matrices.'],
  inputs: [...inputs.values()].sort((a,b) => a.path.localeCompare(b.path))};
for (const item of result.inputs) assert.equal(sha(fs.readFileSync(item.path)), item.sha256, `Changed during read-only review: ${item.path}`);
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', {flag:'wx'});
console.log(JSON.stringify({status: result.status, receipt: ref(output), capability: actualCapability.length, presentation: actualPresentation.length,
  dependencyFiles: dependencyRecords.size, artWorlds: 108, buildCommands: 3}));
