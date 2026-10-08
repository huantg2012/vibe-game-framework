#!/usr/bin/env node
/** Task-local, fail-closed proposal preparation. Never writes the real ledger.
 * Default: --refs <completed-inputs.json> --output <new-directory> validates only.
 * Add --prepare-proposals to write immutable evidence and three checked proposals.
 * No browser, generation, buildProposal, negative matrix or release application.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {fileURLToPath} from 'node:url';
import {checkPlan, hashAchievement} from '../../../../../tools/world-study/r100-progress.mjs';
import {caseInventory} from '../../../../../tools/qa/check-r100-i10-i12-final-binding.mjs';
import {validateFinalReport} from '../../../../../tools/qa/r100-i09-final-probe.mjs';
import {validateShaderReview} from '../../../../../tools/qa/r100-bind-i10-i12.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const BASE = 'docs/qa/artifacts/r100-i10-i12/closure-preparation/';
const SELF = BASE + 'proposal-builder.mjs', LEDGER = 'docs/progress/rift-r100.json';
const REVISION = 'r100-native-v3-revision-6', GRADES = ['low', 'medium', 'severe'];
const ITERATIONS = ['R100-I10', 'R100-I11', 'R100-I12'];
const COUNTS = {candidates: 108, qualified: 108, production: 108, humanApproved: 0,
  qualifiedGradeCases: 324, productionGradeCases: 324};
const ACCOUNTING = {historicalRevision5Base: 7488, currentRevision6Base: 8064,
  additionalHoldout: 2592, fixedSeedProcesses: 648};
const PLAN_REFS = ['qualificationPlan', 'finalSource', 'packages', 'generation', 'historicalGeneration',
  'expandedHoldoutI11', 'expandedHoldoutI12', 'play', 'historicalPlay', 'inheritance', 'historicalBinding',
  'art', 'technicalReview', 'shaderReview', 'production', 'equivalence', 'budget', 'lifecycle'];
export const EVIDENCE_KEYS = ['artRoot', 'galleryRoot', 'audioRoot', 'activation', 'selection', 'continuity',
  'compatibility', 'staticReview', 'staticSupplement', 'build', 'controlled', 'archivePlan', 'archiveIndex',
  'archivePack', 'archiveRestore', 'productionIndependent', 'continuousPolicy', 'continuousExecution',
  'continuousSummary', 'continuousAutomaticReview', 'experienceRoot', 'toolChangeAddendum', 'methodBindingAddendum'];
/** Root must explicitly sign every entry and its exact complete reference set. */
export const GATE_INPUTS = {
  'current-world-grade-qualification': ['boundLedger', 'plan.packages', 'plan.technicalReview', 'plan.art'],
  'generation-and-original-fixed-processes': ['plan.generation', 'plan.historicalGeneration', 'plan.expandedHoldoutI11', 'plan.expandedHoldoutI12', 'plan.play', 'plan.historicalPlay', 'plan.inheritance'],
  'formal-entry-recovery-and-original-failures': ['plan.production', 'evidence.productionIndependent'],
  'browser-equivalence-342': ['plan.equivalence', 'plan.technicalReview'],
  'compatibility-and-selection': ['evidence.compatibility', 'evidence.selection'],
  'controlled-capability-and-presentation': ['evidence.controlled', 'evidence.staticSupplement'],
  'bounded-art-and-gallery': ['plan.art', 'evidence.artRoot', 'evidence.galleryRoot'],
  'source-package-continuity-and-archive': ['plan.finalSource', 'plan.packages', 'evidence.activation', 'evidence.continuity', 'evidence.archivePlan', 'evidence.archiveIndex', 'evidence.archivePack', 'evidence.archiveRestore', 'evidence.staticReview'],
  'final-source-build-and-codegen': ['evidence.build', 'evidence.staticSupplement'],
  'natural48-root-experience': ['evidence.continuousPolicy', 'evidence.continuousExecution', 'evidence.continuousSummary', 'evidence.continuousAutomaticReview', 'evidence.experienceRoot'],
  'exclusive-108-performance': ['plan.budget', 'plan.technicalReview'],
  'bounded-resource-and-shader-release': ['plan.lifecycle', 'plan.shaderReview'],
  'audio-engineering-listening-still-pending': ['evidence.audioRoot'],
  'actual-final-binding-and-89-negatives': ['plan', 'negativeCheck', 'evidence.toolChangeAddendum', 'evidence.methodBindingAddendum'],
  'frozen-internal-rc': ['rcManifest'],
};
const sha = value => createHash('sha256').update(value).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const clone = value => structuredClone(value);
const sorted = value => [...value].sort();
const sameSet = (a, b, label) => {assert.equal(new Set(a).size, a.length, label + ': duplicate'); assert.deepEqual(sorted(a), sorted(b), label);};
const nonempty = (value, label) => assert(typeof value === 'string' && value.trim(), label + ' required');
const realDate = value => assert(/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value, 'Actual date required');
const allRefs = value => !value || typeof value !== 'object' ? [] : [
  ...(typeof value.path === 'string' && /^[a-f0-9]{64}$/.test(value.sha256 ?? '') ? [value] : []),
  ...Object.values(value).flatMap(allRefs),
];

function relative(file) {
  nonempty(file, 'Repository path');
  const result = path.relative(ROOT, path.resolve(ROOT, file));
  assert(result && result !== '..' && !result.startsWith('..' + path.sep) && !path.isAbsolute(result), 'Outside repository: ' + file);
  return result;
}
function reader() {
  const originals = new Map();
  function bytes(file) {
    file = relative(file); const resolved = fs.realpathSync(path.join(ROOT, file)); relative(resolved);
    assert(fs.statSync(resolved).isFile(), 'Not a file: ' + file);
    if (!originals.has(file)) originals.set(file, fs.readFileSync(resolved));
    return originals.get(file);
  }
  const json = file => JSON.parse(bytes(file));
  const ref = file => ({path: relative(file), sha256: sha(bytes(file))});
  const exact = value => {assert(value && /^[a-f0-9]{64}$/.test(value.sha256 ?? ''), 'Explicit SHA reference required');
    assert.equal(sha(bytes(value.path)), value.sha256, 'Changed referenced bytes: ' + value.path); return value;};
  return {bytes, json, ref, exact, consume: value => {exact(value); return json(value.path);},
    unchanged() {for (const [file, before] of originals) assert(fs.readFileSync(path.join(ROOT, file)).equals(before), 'Concurrent input change: ' + file);},
    refs: () => [...originals].map(([file, value]) => ({path: file, sha256: sha(value)}))};
}
function rootReview(value, status, label) {
  assert.equal(value.reviewer, 'root', label + ': actual root reviewer required');
  assert.equal(value.status, status, label + ': wrong status');
}
function proofIncludes(document, needed, read, label) {
  const refs = allRefs(document); for (const item of refs) read.exact(item);
  for (const item of needed) assert(refs.some(row => relative(row.path) === relative(item.path) && row.sha256 === item.sha256), label + ': missing exact reference ' + item.path);
}
function assertCounts(validation) {assert(validation.ok, validation.errors.join('\n')); assert.deepEqual(validation.counts, COUNTS);}
function outputPath(value) {
  const output = relative(value); assert(output.startsWith(BASE) && output.length > BASE.length && !path.extname(output), 'Use a new directory inside ' + BASE);
  assert(!fs.existsSync(path.join(ROOT, output)), 'Keep existing attempts; output directory must not exist');
  const parent = path.dirname(path.join(ROOT, output));
  assert(fs.existsSync(parent) && fs.statSync(parent).isDirectory(), 'Create/choose an existing output parent; the final output directory itself must be new');
  const real = fs.realpathSync(parent); assert(real === ROOT || relative(real)); return output;
}

/** Validates real completed evidence. It intentionally does NOT rerun a binder. */
export function validateInputs(configFile) {
  const read = reader(), config = read.json(configFile); read.bytes(SELF);
  assert.equal(config.schemaVersion, 1); realDate(config.date);
  sameSet(Object.keys(config), ['schemaVersion', 'date', 'plan', 'prebindLedger', 'boundLedger', 'negativeCheck', 'rootApproval', 'rcManifest', 'evidence'], 'Exact refs schema');
  sameSet(Object.keys(config.evidence ?? {}), EVIDENCE_KEYS, 'Required independent evidence keys');
  for (const reference of [...['plan', 'prebindLedger', 'boundLedger', 'negativeCheck', 'rootApproval', 'rcManifest'].map(key => config[key]), ...Object.values(config.evidence)])
    assert.equal(reference.path, relative(reference.path), 'Primary refs must use canonical repository-relative paths');
  assert.equal(relative(config.boundLedger.path), LEDGER);
  assert.notEqual(relative(config.prebindLedger.path), LEDGER, 'Pre-bind bytes must be immutably archived');
  const ledger = read.consume(config.boundLedger), prebind = read.consume(config.prebindLedger);
  const plan = read.consume(config.plan), negative = read.consume(config.negativeCheck);
  const approval = read.consume(config.rootApproval), rc = read.consume(config.rcManifest);
  const documents = Object.fromEntries(PLAN_REFS.map(key => [key, read.consume(plan[key])]));
  const evidence = Object.fromEntries(EVIDENCE_KEYS.map(key => [key, read.consume(config.evidence[key])]));
  rootReview(approval, 'approved-i10-i12-closure-proposals', 'Closeout approval');
  assert.equal(approval.date, config.date); assert.deepEqual(approval.builder, read.ref(SELF));
  assert.deepEqual(approval.inputs, Object.fromEntries(['plan', 'prebindLedger', 'boundLedger', 'negativeCheck', 'rcManifest', 'evidence'].map(key => [key, config[key]])));
  assert.deepEqual(approval.finalSource, plan.finalSource); nonempty(approval.scope, 'Root closeout scope'); nonempty(approval.limitations, 'Root closeout limitations');
  const validation = checkPlan(ledger, {root: ROOT}); assertCounts(validation);
  assert(!ledger.evidence.some(row => row.id.startsWith('R100-R6-CLOSE-GATE-') || ITERATIONS.some(id => row.id === 'R100-R6-CLOSED-' + id)), 'Never reuse reserved closure evidence from an earlier ledger mutation');
  assert.equal(ledger.version.status, 'active'); assert.equal(ledger.version.finalAcceptance, null); assert.equal(ledger.version.releaseManifest, null, 'I12 introduces the reviewed RC exactly once');
  for (const id of ['R100-I13', 'R100-I14']) {const row = ledger.iterations.find(row => row.id === id); assert.equal(row.state, 'planned'); assert.equal(row.stage, 'not-started'); assert(!row.achievement && row.actualRevision === null);}
  const risk = ledger.risks.find(row => row.id === 'R100-R10'); assert(risk && risk.status === 'unverified' && risk.requiredBeforeRelease === true && risk.blockingThisBatch === false); assert.equal(risk.iteration, 'R100-I14');
  for (const world of ledger.worlds) {assert.equal(world.review.human, 'pending'); assert.equal(world.revision, REVISION);}
  assert.equal(ledger.iterations.find(row => row.id === 'R100-I09').state, 'closed');
  for (const id of ITERATIONS) {const row = ledger.iterations.find(row => row.id === id); assert(row && !['closed', 'verified'].includes(row.state) && !row.achievement && row.actualRevision === null); sameSet(row.gateResults.map(g => g.id), [], id + ': this builder will not replace preexisting gate decisions');
    for (const issueId of row.issueIds) assert.equal(ledger.issues.find(issue => issue.id === issueId)?.status, 'resolved', id + ': unresolved assigned issue ' + issueId);}
  const p45 = ledger.issues.find(row => row.id === 'R100-P45'); assert(p45 && p45.status === 'resolved'); nonempty(p45.remainingRequirement, 'P45 original pending final-check text');
  for (const id of ['R100-P36', 'R100-P44']) {
    const issue = ledger.issues.find(row => row.id === id); assert.equal(issue.status, 'resolved'); assert.equal(issue.revision, REVISION); assert.equal(issue.resolutionReviewer, 'root'); nonempty(issue.resolution, id + ' resolution');
    const signed = approval.issueDispositions?.find(row => row.issueId === id); assert(signed && signed.decision === 'bounded-resolved');
    assert.equal(signed.ledgerIssueSha256, sha(encode(issue)), id + ': root must bind the whole preserved resolution'); nonempty(signed.limitations, id + ' retained limits');
  }
  assert.equal(approval.issueDispositions.length, 2);

  // Exact already-written binder output, not just a count or a fabricated report.
  assert.equal(negative.status, 'pass'); assert.equal(negative.actualInputsUnchanged, true); assert.equal(negative.baseline.status, 'pass');
  assert.deepEqual(negative.plan, config.plan); assert.deepEqual(negative.baseline.counts, COUNTS); assert.deepEqual(negative.baseline.accounting, ACCOUNTING);
  assert.equal(config.boundLedger.sha256, negative.baseline.proposedLedgerSha256, 'Real binder must already have written the exact negative-baseline proposal bytes');
  assert.equal(sha(encode(ledger)), config.boundLedger.sha256, 'Canonical proposed-ledger encoding changed');
  assert.deepEqual(negative.binder, read.ref('tools/qa/r100-bind-i10-i12.mjs')); assert.deepEqual(negative.checker, read.ref('tools/qa/check-r100-i10-i12-final-binding.mjs'));
  const inventory = caseInventory(); assert.equal(inventory.length, 89); assert.equal(negative.caseCountRequired, 89);
  sameSet(negative.cases.map(row => row.name), inventory.map(row => row.name), 'All89 real semantic negatives');
  for (const expected of inventory) {const actual = negative.cases.find(row => row.name === expected.name); for (const [key, value] of Object.entries(expected)) assert.deepEqual(actual[key], value);
    assert.equal(actual.ok, true); assert.equal(actual.status, 'pass'); assert.equal(actual.actual, 'expected-logical-rejection'); assert(actual.checkedReceiptCount > 0);}
  assert(negative.frozenBefore?.exact && negative.frozenBefore.files === 1397); assert.deepEqual(negative.frozenAfter, negative.frozenBefore);
  const ledgerInput = negative.inputs.filter(row => relative(row.path) === LEDGER); assert.equal(ledgerInput.length, 1); assert.equal(ledgerInput[0].sha256, config.prebindLedger.sha256);
  for (const item of negative.inputs) if (relative(item.path) !== LEDGER) read.exact(item);
  for (const key of Object.keys(prebind).filter(key => !['worlds', 'evidence'].includes(key))) assert.deepEqual(ledger[key], prebind[key], 'Binder changed protected ledger section ' + key);
  assert.deepEqual(ledger.evidence.slice(0, prebind.evidence.length), prebind.evidence);

  const frozen = documents.qualificationPlan, ids = documents.packages.worlds.map(row => row.worldId);
  assert.equal(documents.play.completedSeedProcesses, 336); assert.equal(documents.historicalPlay.completedSeedProcesses, 312);
  assert.equal(documents.play.actualAttempts, 346); assert.equal(documents.historicalPlay.actualAttempts, 315);
  sameSet(ids, ledger.worlds.map(row => row.id), 'Final package/world IDs'); sameSet(ids, validation.qualifiedIds, 'Current qualified IDs'); sameSet(ids, validation.productionIds, 'Current production IDs');
  const source = documents.finalSource; assert.equal(Object.keys(source.sources).length, 1397); assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
  assert.equal(negative.frozenBefore.sourceMapSha256, sha(encode(Object.entries(source.sources).sort(([a], [b]) => a.localeCompare(b)))), 'Actual negative run must audit this exact final source map');
  const scopes = ITERATIONS.map((iterationId, index) => {
    const worlds = [...frozen.baseline.worlds, ...frozen.batches.filter(row => ITERATIONS.slice(0, index + 1).includes(row.iteration)).flatMap(row => row.worlds)].sort();
    assert.equal(worlds.length, [72, 92, 108][index]); sameSet(worlds, [...new Set(worlds)], 'Unique scope');
    const gradeCases = worlds.flatMap(worldId => GRADES.map(grade => ({worldId, grade})));
    for (const world of worlds) assert(validation.qualifiedIds.includes(world) && validation.productionIds.includes(world));
    for (const rows of [validation.qualifiedGradeCases, validation.productionGradeCases]) sameSet(rows.filter(row => worlds.includes(row.worldId)).map(row => row.worldId + '/' + row.grade), gradeCases.map(row => row.worldId + '/' + row.grade), iterationId + ': exact current grade membership');
    const iteration = ledger.iterations.find(row => row.id === iterationId); assert.equal(iteration.targetWorlds, worlds.length); assert.equal(iteration.targetGradeCases, gradeCases.length);
    return {iterationId, qualifiedWorldIds: worlds, gradeCases};
  });
  sameSet(approval.iterationScopes.map(row => row.iterationId), ITERATIONS, 'Root scope decisions');
  for (const scope of scopes) {const signed = approval.iterationScopes.find(row => row.iterationId === scope.iterationId); assert.equal(signed.status, 'bounded-internal-pass');
    sameSet(signed.qualifiedWorldIds, scope.qualifiedWorldIds, 'Root exact world scope'); sameSet(signed.gradeCases.map(row => row.worldId + '/' + row.grade), scope.gradeCases.map(row => row.worldId + '/' + row.grade), 'Root exact grade scope'); nonempty(signed.scope, 'Root iteration scope'); nonempty(signed.limitations, 'Root iteration limits');}
  rootReview(documents.technicalReview, 'independent-technical-pass', 'Technical'); assert.equal(documents.technicalReview.finalSourceSha256, plan.finalSource.sha256);
  for (const key of ['generation', 'historicalGeneration', 'expandedHoldoutI11', 'expandedHoldoutI12', 'play', 'historicalPlay', 'inheritance', 'production', 'equivalence', 'budget', 'lifecycle', 'shaderReview']) assert.deepEqual(documents.technicalReview.evidence[key], plan[key]);
  assert.equal(plan.runtimeBindings.length, 4); const bindings = plan.runtimeBindings.map(ref => ({ref, value: read.consume(ref)}));
  sameSet(bindings.map(row => row.value.kind), ['production', 'equivalence', 'budget', 'lifecycle'], 'Four distinct final runtime methods');
  const gold = read.json('tools/recovery/fixtures/r100-revision1-gold.json').records.map(row => row.identity);
  for (const {value} of bindings) {assert.equal(value.status, 'pass'); assert.deepEqual(value.finalSource, plan.finalSource); assert.deepEqual(value.report, plan[value.kind]); validateFinalReport(value.kind, documents[value.kind], ids, gold, 6);}
  validateShaderReview(documents.shaderReview, plan, documents.lifecycle, bindings.find(row => row.value.kind === 'lifecycle').ref);
  rootReview(evidence.artRoot, 'bounded-internal-pass', 'Art'); assert.deepEqual(evidence.artRoot.finalSource, plan.finalSource); assert.deepEqual(evidence.artRoot.packages, plan.packages); assert.equal(evidence.artRoot.results.worlds, 108);
  assert(evidence.artRoot.humanApproval === false || typeof evidence.artRoot.humanApproval === 'string' && /^pending\b/.test(evidence.artRoot.humanApproval), 'Art cannot extend human approval');
  assert.equal(documents.art.status, 'bounded-internal-pass'); assert.equal(documents.art.finalSourceSha256, plan.finalSource.sha256);
  rootReview(evidence.galleryRoot, 'bounded-gallery-layout-and-interaction-pass', 'Gallery'); assert.equal(evidence.galleryRoot.browserClosed, true); assert(evidence.galleryRoot.viewedScreenshots.length > 0); for (const item of allRefs(evidence.galleryRoot)) read.exact(item);
  rootReview(evidence.audioRoot, 'bounded-engineering-reuse-final-binding-pass-listening-pending', 'Audio'); assert.deepEqual(evidence.audioRoot.finalSource, plan.finalSource); assert.deepEqual(evidence.audioRoot.packages, plan.packages);
  assert.equal(evidence.audioRoot.listeningPass, false); assert.equal(evidence.audioRoot.humanApproval, false); assert.deepEqual(Object.fromEntries(['riskId', 'target', 'status', 'waived'].map(key => [key, evidence.audioRoot.releaseGate[key]])), {riskId: 'R100-R10', target: 'I14', status: 'pending-actual-listening', waived: false});

  // Independent static gates retain their actual narrow statuses, not generic pass strings.
  for (const [key, status] of Object.entries({activation: 'pass-enabled-only-recipe-compatibility', continuity: 'pass', compatibility: 'pass-five-original-commands-on-final108', staticReview: 'pass-static-readiness-not-runtime-or-binder-acceptance', staticSupplement: 'pass-completed-controlled-matrices-build-and-bounded-art-binding', build: 'pass', controlled: 'pass', archiveIndex: 'archived-content-verified-not-game-approval', archivePack: 'pass', archiveRestore: 'pass', productionIndependent: 'bounded-independent-production-completion-pass'})) assert.equal(evidence[key].status, status, key);
  assert.deepEqual(evidence.compatibility.source, plan.finalSource); for (const key of ['staticReview', 'staticSupplement', 'build', 'controlled']) assert.deepEqual(evidence[key].finalSource, plan.finalSource);
  assert.deepEqual(evidence.continuity.after, plan.finalSource); assert.deepEqual(evidence.staticReview.archiveIndex, config.evidence.archiveIndex);
  assert.deepEqual(evidence.staticReview.archive.finalRestore, config.evidence.archiveRestore);
  assert.deepEqual(evidence.productionIndependent.inputs.report, plan.production); assert.deepEqual(evidence.productionIndependent.sourceAudit.finalSource, plan.finalSource);
  assert.equal(evidence.productionIndependent.coverage.totalActualAttempts, 476); assert.equal(evidence.productionIndependent.identity.strictWholeOriginalIdentitiesCompared, 152);
  sameSet(evidence.selection.worldIds, ids, 'Selection worlds'); assert.equal(evidence.selection.uniform.samples, 32768); assert.equal(evidence.selection.recent.samples, 32768);
  sameSet(evidence.build.commands.map(row => row.name), ['native-codegen-check', 'package-codegen-check', 'build'], 'Build commands');
  for (const row of evidence.build.commands) {assert.equal(row.exitCode, 0); for (const edge of [row.before, row.after]) {assert.equal(edge.files, 1397); assert.equal(edge.workingTreeAndFrozenExact, true);} read.exact(row.log);}
  sameSet(evidence.controlled.stages.map(row => row.id), ['prepare', 'capability', 'presentation'], 'Controlled stages'); for (const row of evidence.controlled.stages) {assert.equal(row.exitCode, 0); read.exact(row.log);}
  assert.deepEqual(evidence.staticSupplement.build.execution, config.evidence.build);
  assert.deepEqual(evidence.staticSupplement.controlledMatrices.execution, config.evidence.controlled);
  for (const [key, count] of [['capability', 1536], ['presentation', 15552]]) {
    const actual = read.consume(evidence.controlled[key]), independent = evidence.staticSupplement.controlledMatrices[key];
    assert.equal(actual.status, 'pass'); assert.equal(actual.counts.cases, count); assert.equal(actual.rows.length, count);
    assert.deepEqual(independent.report, evidence.controlled[key]); assert.equal(independent.actualKeys, count); assert.equal(independent.uniqueKeys, count); assert.equal(independent.completeExpectedKeySet, true);
  }
  assert.deepEqual(evidence.archivePack.counts, {snapshots: 36, fileEntries: 49798, objects: 1636, objectBytes: 228105618}); assert.deepEqual(evidence.archiveIndex.counts, evidence.archivePack.counts);
  assert.equal(evidence.archivePack.index.sha256, config.evidence.archiveIndex.sha256);
  assert.equal(evidence.archiveIndex.plan.sha256, config.evidence.archivePlan.sha256);
  assert.equal(evidence.archiveRestore.manifestSha256, plan.finalSource.sha256); assert.equal(evidence.archiveRestore.filesVerified, 1397); assert.equal(evidence.archiveRestore.serviceStarted, false);
  for (const key of ['toolChangeAddendum', 'methodBindingAddendum']) {assert.equal(evidence[key].reviewer, 'root'); assert(evidence[key].status.startsWith('approved-'));}
  assert(allRefs(evidence.methodBindingAddendum).some(item => item.path === negative.binder.path && item.sha256 === negative.binder.sha256), 'Latest binder addendum must bind the checked method-hardened binder');

  const policy = evidence.continuousPolicy, summary = evidence.continuousSummary, automatic = evidence.continuousAutomaticReview, experience = evidence.experienceRoot;
  assert.equal(relative(policy.sourceManifestOriginal), relative(plan.finalSource.path)); assert(read.bytes(policy.sourceManifest).equals(read.bytes(plan.finalSource.path)));
  sameSet(policy.worldIds, ids, 'Continuous worlds'); assert.equal(policy.algorithmRevision, 6); assert.equal(policy.searchLimit, 3); assert.equal(policy.concurrency, 1);
  for (const item of policy.fixedFiles) assert.equal(sha(read.bytes(item.file)), item.sha256);
  assert.equal(evidence.continuousExecution.status, 'completed-attempts-pending-summary'); assert.equal(evidence.continuousExecution.branches.length, 4); assert(evidence.continuousExecution.branches.every(row => row.exitCode === 0));
  assert.equal(summary.status, 'completed-continuous-samples-pending-review'); assert.equal(summary.sourceValid, true); assert.equal(summary.plannedTrips, 48); assert.equal(summary.validatedTrips, 48);
  assert.equal(automatic.status, 'complete-valid-data-pending-experience-review'); assert.equal(automatic.experienceApproval, 'pending'); assert.equal(automatic.validatedTrips, 48); assert.deepEqual(automatic.gradeCounts, {low: 16, medium: 16, severe: 16});
  for (const item of automatic.inputs) read.exact(item);
  sameSet(summary.branches.map(row => row.policy), ['low', 'medium', 'severe', 'alternating'], 'Four natural histories'); const branchRefs = [];
  for (const row of summary.branches) {const reference = {path: relative(row.report), sha256: row.reportSha256}, raw = read.consume(reference); assert.equal(raw.policyRevision, 15); assert.equal(raw.realJourneyAttempts.length, 12); branchRefs.push(reference);}
  rootReview(experience, 'bounded-experience-pass', 'Actual natural experience');
  proofIncludes(experience, [plan.finalSource, config.evidence.continuousSummary, config.evidence.continuousAutomaticReview, ...branchRefs], read, 'Experience review');
  assert(allRefs(experience).some(item => /\.(png|jpe?g|webp)$/i.test(item.path)), 'Experience needs actual viewed frames');
  for (const flag of automatic.mandatoryDiagnosis) {const decision = experience.diagnoses?.find(row => isDeepStrictEqual(row.flag, flag)); assert(decision && ['resolved', 'bounded-nonblocking'].includes(decision.decision)); nonempty(decision.reason, 'Actual flagged-history disposition'); assert(allRefs(decision).length > 0);}

  rootReview(rc, 'frozen-internal-release-candidate', 'RC'); nonempty(rc.revision, 'Actual RC revision'); assert.equal(rc.algorithmRevision, 6);
  for (const [key, needed] of Object.entries({finalSource: plan.finalSource, packages: plan.packages, finalPlan: config.plan, negativeCheck: config.negativeCheck, rootTechnical: plan.technicalReview, rootShader: plan.shaderReview, rootExperience: config.evidence.experienceRoot, audioDisposition: config.evidence.audioRoot})) assert.deepEqual(rc[key], needed, 'RC ' + key);
  sameSet(rc.worldIds, ids, 'RC exact108'); sameSet(rc.gradeCases.map(row => row.worldId + '/' + row.grade), scopes[2].gradeCases.map(row => row.worldId + '/' + row.grade), 'RC exact324');
  assert.equal(rc.versionStatus, 'active'); assert.equal(rc.finalAcceptance, null); assert.equal(rc.humanApproval, false); assert.equal(rc.releaseApproval, false); sameSet(rc.pendingIterations, ['R100-I13', 'R100-I14'], 'RC pending iterations');
  assert.deepEqual(rc.listeningRisk, {id: 'R100-R10', status: 'unverified', requiredBeforeRelease: true, waived: false}); nonempty(rc.limitations, 'RC limits');
  const resolveKey = key => key.startsWith('plan.') ? plan[key.slice(5)] : key.startsWith('evidence.') ? config.evidence[key.slice(9)] : config[key];
  sameSet(approval.gates.map(row => row.id), Object.keys(GATE_INPUTS), 'All unique blocking closeout gates');
  for (const [id, keys] of Object.entries(GATE_INPUTS)) {const gate = approval.gates.find(row => row.id === id); assert.equal(gate.status, 'pass'); assert.equal(gate.blocking, true); assert.deepEqual(gate.finalSource, plan.finalSource);
    const canonical = rows => rows.map(row => relative(row.path) + ':' + row.sha256); sameSet(canonical(gate.evidence), canonical(keys.map(resolveKey)), id + ': exact root-bound evidence'); for (const item of gate.evidence) read.exact(item); nonempty(gate.scope, id + ' scope'); nonempty(gate.limitations, id + ' limits');}
  assert.equal(approval.p45Disposition.decision, 'remaining-final-binding-checks-satisfied'); assert.deepEqual(approval.p45Disposition.negativeCheck, config.negativeCheck); nonempty(approval.p45Disposition.limitations, 'P45 limits');
  read.unchanged(); return {read, config, ledger, plan, approval, rc, scopes, validation, configRef: read.ref(configFile)};
}

export function prepareProposals(state, output) {
  const {read, config, ledger, plan, approval, rc, scopes} = state;
  output = outputPath(output); read.unchanged();
  fs.mkdirSync(path.join(ROOT, output), {recursive: false});
  assert(relative(fs.realpathSync(path.join(ROOT, output))).startsWith(BASE), 'Output symlink changed');
  const write = (name, value) => {const file = output + '/' + name; const data = Buffer.isBuffer(value) ? value : encode(value);
    fs.writeFileSync(path.join(ROOT, file), data, {flag: 'wx'}); return {path: file, sha256: sha(data)};};
  const generated = [], steps = []; let previous = config.boundLedger, proposed = clone(ledger);
  try {
    generated.push(write('builder-source.mjs', read.bytes(SELF)), write('completed-inputs.json', read.bytes(state.configRef.path)));
    const addEvidence = row => {assert(!proposed.evidence.some(value => value.id === row.id), 'Do not replace prior evidence ' + row.id); proposed.evidence.push(row); return row.id;};
    for (const [index, scope] of scopes.entries()) {
      read.unchanged(); const before = clone(proposed), id = scope.iterationId;
      const iteration = proposed.iterations.find(row => row.id === id); assert(iteration.dependencies.every(dep => proposed.iterations.find(row => row.id === dep)?.state === 'closed'));
      const signed = approval.iterationScopes.find(row => row.iterationId === id), gateIds = Object.keys(GATE_INPUTS).filter(gate => index === 2 || gate !== 'frozen-internal-rc');
      const gateEvidence = [];
      for (const gateId of gateIds) {const eid = 'R100-R6-CLOSE-GATE-' + gateId, decision = approval.gates.find(row => row.id === gateId);
        if (!proposed.evidence.some(row => row.id === eid)) addEvidence({id: eid, kind: 'source', purpose: 'iteration-closeout-gate', revision: REVISION,
          path: config.rootApproval.path, documentSha256: config.rootApproval.sha256, gateId, scope: decision.scope, limitations: decision.limitations, evidence: decision.evidence});
        gateEvidence.push(eid); iteration.gateResults.push({id: gateId, status: 'pass', blocking: true, revision: REVISION, evidenceIds: [eid]});}
      const aid = 'R100-R6-CLOSED-' + id, achievement = {revision: REVISION, qualifiedWorldIds: scope.qualifiedWorldIds, gradeCases: scope.gradeCases, evidenceIds: [aid]};
      const achievementHash = hashAchievement(id, achievement);
      const receipt = write(id.toLowerCase() + '-achievement.json', {status: 'proposal-not-applied', iterationId: id, revision: REVISION, date: config.date,
        rootApproval: config.rootApproval, rootDecision: signed, previousLedger: previous, finalSource: plan.finalSource, finalPlan: config.plan, actualNegativeCheck: config.negativeCheck,
        achievement, achievementHash, blockingGates: gateIds, originalResults: {fixedUniqueProcesses: 648, fixedActualReports: 661, productionOriginalAttempts: 152, productionNewAttempts: 324, productionTotalAttempts: 476, originalFailedProduction152: 'retained-failed', policy16and17: 'original failures and explicit supplements retained'},
        limitations: signed.limitations, application: 'Immutable proposal evidence only; root must review, CAS-apply this exact step and rerun checkPlan. No release, human or listening approval.'}); generated.push(receipt);
      addEvidence({id: aid, kind: 'source', purpose: 'iteration-achievement', iterationId: id, revision: REVISION, achievementHash,
        path: receipt.path, documentSha256: receipt.sha256, scope: signed.scope, limitations: signed.limitations, rootApproval: config.rootApproval});
      iteration.evidenceIds = [...new Set([...iteration.evidenceIds, ...gateEvidence, aid])];
      Object.assign(iteration, {state: 'closed', stage: 'close', actualRevision: REVISION, completedDate: config.date, achievement});
      iteration.execution = {...iteration.execution, state: 'implemented', revision: REVISION, summary: signed.scope,
        evidenceIds: [...new Set([...(iteration.execution?.evidenceIds ?? []), ...iteration.evidenceIds])]};
      if (index === 2) {
        proposed.version.releaseManifest = {revision: rc.revision, path: config.rcManifest.path, hash: config.rcManifest.sha256};
        const issue = proposed.issues.find(row => row.id === 'R100-P45');
        assert(!Object.hasOwn(issue, 'remainingRequirementBeforeFinalBinding')); issue.remainingRequirementBeforeFinalBinding = issue.remainingRequirement;
        issue.remainingRequirement = '实际 final dry 与 89 项真实证据反例已通过并绑定；本问题剩余检查已满足，原缺口与修复历史保留。';
        issue.finalBindingVerification = {date: config.date, reviewer: 'root', negativeCheck: config.negativeCheck, rootApproval: config.rootApproval, limitations: approval.p45Disposition.limitations};
        issue.evidenceIds = [...new Set([...issue.evidenceIds, 'R100-R6-CLOSE-GATE-actual-final-binding-and-89-negatives'])];
      }
      for (const key of Object.keys(before).filter(key => !['iterations', 'evidence', ...(index === 2 ? ['version', 'issues'] : [])].includes(key))) assert.deepEqual(proposed[key], before[key], 'Protected section ' + key);
      for (const row of before.iterations.filter(row => row.id !== id)) assert.deepEqual(proposed.iterations.find(value => value.id === row.id), row, 'Unrelated iteration');
      assert.deepEqual(proposed.evidence.slice(0, before.evidence.length), before.evidence);
      if (index === 2) {assert.deepEqual({...proposed.version, releaseManifest: before.version.releaseManifest}, before.version);
        for (const issue of before.issues.filter(row => row.id !== 'R100-P45')) assert.deepEqual(proposed.issues.find(row => row.id === issue.id), issue);
        const oldIssue = before.issues.find(row => row.id === 'R100-P45'), newIssue = proposed.issues.find(row => row.id === 'R100-P45');
        for (const key of Object.keys(oldIssue).filter(key => !['evidenceIds', 'remainingRequirement'].includes(key))) assert.deepEqual(newIssue[key], oldIssue[key], 'Preserve P45 history ' + key);
        assert.deepEqual(newIssue.evidenceIds.slice(0, oldIssue.evidenceIds.length), oldIssue.evidenceIds);}
      sameSet(iteration.gateResults.map(row => row.id), gateIds, 'Complete unique step gates'); assert(iteration.gateResults.every(row => row.blocking === true && row.status === 'pass'));
      const checked = checkPlan(proposed, {root: ROOT}); assertCounts(checked); read.unchanged();
      const proposal = write(id.toLowerCase() + '-ledger-proposal.json', proposed); generated.push(proposal);
      const validation = write(id.toLowerCase() + '-validation.json', {status: 'proposal-not-applied', iterationId: id, previousLedger: previous, proposedLedger: proposal,
        evidence: receipt, achievementHash, checkPlan: checked, rootReviewStillRequired: true, actualLedgerWritten: false}); generated.push(validation);
      steps.push({iterationId: id, expectedPreviousLedgerSha256: previous.sha256, proposedLedger: proposal, validation, achievement: receipt}); previous = proposal;
    }
    read.unchanged(); for (const item of generated) assert.equal(sha(fs.readFileSync(path.join(ROOT, item.path))), item.sha256);
    const result = {status: 'proposal-not-applied', at: new Date().toISOString(), builder: read.ref(SELF), inputs: state.configRef,
      rootApproval: config.rootApproval, originalLedger: config.boundLedger, steps, applied: false, counts: state.validation.counts,
      protected: ['worlds and all human states', 'all historical evidence rows and bytes', 'I01-I09/I13/I14', 'P36/P44 and every issue except narrow I12 P45 final-check addition', 'risks/R10', 'releaseGateResults', 'resume/changeLog', 'version active/finalAcceptance null'],
      applicationContract: 'Root independently reviews all3 proposals, applies I10 then I11 then I12 only if actual ledger SHA equals that step expectedPreviousLedgerSha256, and runs checkPlan after each. This program has no apply/write-ledger mode.', consumedInputs: read.refs()};
    return write('proposal-sequence.json', result);
  } catch (error) {
    write('failure-not-applied.json', {status: 'failed-proposal-not-applied', at: new Date().toISOString(), error: String(error), stack: error.stack,
      originalLedger: config.boundLedger, completedSteps: steps, generatedFiles: generated, actualLedgerWritten: false, retainAllFiles: true}); throw error;
  }
}

async function main() {
  const args = process.argv.slice(2), allowed = new Set(['--refs', '--output', '--prepare-proposals']), parsed = new Map();
  for (let i = 0; i < args.length; i++) {const key = args[i]; assert(allowed.has(key) && !parsed.has(key), 'Unknown/repeated option: ' + key);
    if (key === '--prepare-proposals') parsed.set(key, true); else {assert(args[i + 1] && !args[i + 1].startsWith('--'), 'Missing value for ' + key); parsed.set(key, args[++i]);}}
  assert(parsed.has('--refs') && parsed.has('--output'), 'Usage: --refs <completed-inputs.json> --output <new-directory> [--prepare-proposals]');
  const output = outputPath(parsed.get('--output')), state = validateInputs(parsed.get('--refs'));
  if (!parsed.has('--prepare-proposals')) {state.read.unchanged(); console.log(JSON.stringify({status: 'dry-inputs-verified-no-proposals', written: false,
    scopes: state.scopes.map(row => ({iterationId: row.iterationId, worlds: row.qualifiedWorldIds.length, grades: row.gradeCases.length})), boundLedger: state.config.boundLedger, output})); return;}
  console.log(JSON.stringify({status: 'proposal-not-applied', sequence: prepareProposals(state, output), actualLedgerWritten: false}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
