/** Read-only I10-I12 closure contract inventory; does not construct completion. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {checkPlan, hashAchievement} from '../../../../../tools/world-study/r100-progress.mjs';

const ROOT = process.cwd(), BASE = 'docs/qa/artifacts/r100-i10-i12/';
const OUTPUT = `${BASE}closeout-independent-review/iteration-closure-preparation.json`;
const sha = value => createHash('sha256').update(value).digest('hex');
const inputs = new Map();
const bytes = file => {if (!inputs.has(file)) inputs.set(file, fs.readFileSync(file)); return inputs.get(file);};
const read = file => JSON.parse(bytes(file));
const ref = file => ({path: file, sha256: sha(bytes(file))});
const sorted = values => [...values].sort();
const GRADES = ['low', 'medium', 'severe'];
assert(!fs.existsSync(OUTPUT), 'Preserve any earlier independent receipt');
const ledgerFile = 'docs/progress/rift-r100.json', ledger = read(ledgerFile);
const validation = checkPlan(ledger, {root: ROOT}); assert(validation.ok, validation.errors.join('\n'));
const frozen = read(`${BASE}qualification-plan.json`), source = ref(`${BASE}final-source/source-snapshot.json`);
const finalDraft = read(`${BASE}final-binding/plan.enabled108.draft.json`);
const play = read(`${BASE}final-fixed-play/summary.json`);
const historicalPlay = read('docs/qa/artifacts/r100-i07-i09/final-fixed-play/summary.json');
const prior = ledger.iterations.find(row => row.id === 'R100-I09'); assert.equal(prior.state, 'closed');
const priorHash = hashAchievement(prior.id, prior.achievement);
const priorEvidence = ledger.evidence.find(row => prior.achievement.evidenceIds.includes(row.id)
  && row.purpose === 'iteration-achievement' && row.iterationId === prior.id);
assert.equal(priorHash, priorEvidence.achievementHash);

for (const file of ['tools/world-study/r100-progress.mjs', 'tools/qa/r100-bind-i10-i12.mjs',
  'tools/qa/check-r100-i10-i12-final-binding.mjs', 'docs/tasks/rift-r100-i10.md', 'docs/tasks/rift-r100-i11.md',
  'docs/tasks/rift-r100-i12.md', 'docs/qa/rift-r100-i10-i12.md', 'docs/progress/r100-i10-i12-checkpoint.md',
  `${BASE}final-artifact-contract.json`, `${BASE}final-execution-order.json`, `${BASE}final-binding/contract.json`,
  `${BASE}final-tool-change-addendum.json`, `${BASE}final-tool-method-binding-addendum.json`,
  `${BASE}final-source-archive-plan.json`, `${BASE}source-archive/index.json`,
  `${BASE}source-archive/final-source-restore-verification.json`, `${BASE}qa-tool-contract/audio-i12-root-disposition.json`,
  `${BASE}closeout-independent-review/iteration-closure-preparation-development.json`,
  `${BASE}closeout-independent-review/prepare-iteration-closure.mjs`]) bytes(file);

const plannedScopes = ['R100-I10', 'R100-I11', 'R100-I12'].map((id, index) => {
  const current = ledger.iterations.find(row => row.id === id), target = [72, 92, 108][index];
  const stages = ['R100-I10', 'R100-I11', 'R100-I12'].slice(0, index + 1);
  const included = frozen.batches.filter(row => stages.includes(row.iteration));
  const newBatches = frozen.batches.filter(row => row.iteration === id);
  const plannedWorldIds = [...frozen.baseline.worlds, ...included.flatMap(row => row.worlds)];
  assert.equal(plannedWorldIds.length, target); assert.equal(new Set(plannedWorldIds).size, target);
  assert(plannedWorldIds.every(world => ledger.worlds.some(row => row.id === world)));
  assert.equal(current.targetWorlds, target); assert.equal(current.targetGradeCases, target * 3);
  const newWorlds = newBatches.flatMap(row => row.worlds), cumulativeNew = target - 52;
  return {iterationId: id, currentState: current.state, currentStage: current.stage,
    declaredLedgerAcceptance: {goal: current.goal, technical: current.technical, visual: current.visual,
      batches: current.batches, review: current.review, exit: current.exit},
    currentActualRevision: current.actualRevision, currentGateResults: current.gateResults,
    currentAchievementPresent: Boolean(current.achievement), executionState: current.execution?.state,
    dependency: current.dependencies[0], dependencyCurrentState: ledger.iterations.find(row => row.id === current.dependencies[0]).state,
    targetWorlds: target, targetGradeCases: target * 3, plannedWorldIds: sorted(plannedWorldIds),
    scopeOnlyHash: sha(JSON.stringify(sorted(plannedWorldIds))), requiredGradesForEveryWorld: GRADES,
    includedBatchIds: included.map(row => row.id), newBatchIds: newBatches.map(row => row.id), newWorldIds: newWorlds,
    scopeConstruction: `Frozen baseline52 plus ${included.map(row => row.id).join(',')}; use exact IDs, not a slice of current ledger/package ordering.`,
    expectedAccounting: {historicalBaseExecutedRevision5: 7488, cumulativeCurrentRevision6Base: cumulativeNew * 3 * 48,
      cumulativeBaseUniqueCases: target * 3 * 48, cumulativeFixedUniqueProcesses: target * 3 * 2,
      newIterationFixedUniqueProcesses: newWorlds.length * 6,
      observedNewIterationAttemptRecords: play.attempts.filter(row => newWorlds.includes(row.world)).length,
      additionalHoldoutRequiredAtThisStage: index === 0 ? 'Base48 is the I10 content minimum; the later final108 binding also proves all additional8.'
        : index === 1 ? 'I11 exact92 × 3 × 8 = 2208, separate from base48.' : 'I11 2208 plus last16 × 3 × 8 = 384; final total2592.'},
    assignmentOnly: 'These are required prospective scope IDs, not a qualified achievement or approval. Do not compute/sign a new achievement hash before actual gates are complete.'};
});
assert.deepEqual(sorted(plannedScopes[2].plannedWorldIds), sorted(ledger.worlds.map(row => row.id)));

const evidenceFiles = [
  'final-generation/summary.json', 'expanded-holdout-i11/summary.json', 'expanded-holdout-i12/summary.json',
  'final-fixed-play/summary.json', 'old52-r6-inheritance/independent-review.json',
  'final-art-review.json', 'final-art-root-review.json', 'final-packages/index.json',
  'closeout-independent-review/final-compatibility-review.json', 'closeout-independent-review/final-static-readiness-review.json',
  'closeout-independent-review/final-static-readiness-supplement.json', 'selection-final108/selection.json',
  'final-controlled-execution/execution.json', 'final-build/execution.json',
  'final-audio-engineering-binding.json', 'final-audio-root-disposition.json',
  'closeout-independent-review/final-binding-preparation/preparation-review.json',
  'production-full-recheck-preparation/root-approved-protocol.json',
];
const available = evidenceFiles.map(file => {const value = read(BASE + file); return {
  reference: ref(BASE + file), recordedStatus: value.status ?? null,
  boundary: file.includes('preparation-review') ? 'Prepared checker only; genuine baseline and negatives not run.'
    : file.includes('audio') ? 'Existing engineering reuse only; listening and human approval remain pending.'
      : file.includes('root-approved-protocol') ? 'One actual full recheck is authorized; its completion is not supplied by this protocol.'
        : 'Existing bounded evidence; retain the limitations of the referenced receipt and its independent reviews.'};});
const sound = read(`${BASE}final-audio-root-disposition.json`);
assert.equal(sound.reviewer, 'root'); assert.deepEqual(sound.finalSource, source);
assert.equal(sound.listeningPass, false); assert.equal(sound.humanApproval, false);
const pendingFiles = ['final-binding/plan.json', 'browser-equivalence-final108/browser-equivalence.json',
  'browser-equivalence-final108/source-binding.json', 'continuous-final108/summary.json', 'continuous-final108/review.json',
  'continuous-final108/independent-experience-review.json', 'runtime-budget-final108/report.json',
  'runtime-budget-final108/source-binding.json', 'lifecycle-final108/report.json', 'lifecycle-final108/source-binding.json',
  'lifecycle-final108/shader-review.json', 'final-technical-review.json'];
const pendingArtifacts = pendingFiles.map(file => ({path: BASE + file, existsAtObservation: fs.existsSync(BASE + file),
  meaning: 'Existence alone is not an acceptance result; the complete referenced report/source audit and required independent review are mandatory.'}));
const currentProductionPath = `${BASE}production-final108-recheck-idle-sleep/report.json`;
let ongoingProduction = {path: currentProductionPath, existsAtObservation: false};
if (fs.existsSync(currentProductionPath)) {
  const raw = fs.readFileSync(currentProductionPath), value = JSON.parse(raw);
  ongoingProduction = {path: currentProductionPath, existsAtObservation: true, mutableObservation: true,
    observedAt: new Date().toISOString(), sha256AtRead: sha(raw), recordedStatusAtRead: value.status,
    caseCountAtRead: value.cases?.length, requiredCompleteCases: 324,
    boundary: 'An in-progress observation only. This file may continue changing and is not claimed as an immutable final reference.'};
}

const report = {version: 1, status: 'prepared', at: new Date().toISOString(), reviewer: 'i12_qa', featureIds: ['F052', 'F044', 'F005'],
  scope: 'Read-only machine-contract and evidence-readiness preparation for sequential I10→I11→I12 closeout. No ledger proposal, new achievement hash, approval, browser, full binder baseline or heavy CPU test is produced.',
  authority: {ledger: ref(ledgerFile), validator: ref('tools/world-study/r100-progress.mjs'),
    qualificationPlan: ref(`${BASE}qualification-plan.json`), finalDraft: ref(`${BASE}final-binding/plan.enabled108.draft.json`), finalSource: source,
    sourceLocations: {achievementHash: [28, 36], evidenceShapeAndReferences: [90, 114], currentWorldQualification: [143, 219],
      executionProgress: [244, 252], gatesAndDependencies: [253, 276], verifiedAndClosed: [277, 297], releaseGateAndIssueProof: [300, 316], finalRelease: [325, 334]}},
  currentLedgerOnlyCheck: {ok: validation.ok, counts: validation.counts, warnings: validation.warnings,
    meaning: 'Structural/current-ledger evidence validation only, not a runtime acceptance result. Final108 activation alone does not update these qualified counts.'},
  existingHistoricalHashSanityCheck: {iterationId: prior.id, evidenceId: priorEvidence.id,
    hash: priorHash, matchesExistingLedgerEvidence: true, boundary: 'Recomputed existing closed I09 only; no new I10-I12 completion hash was generated.'},
  plannedScopes,
  machineContract: {
    sequentialState: [
      'I10 depends on I09; I11 depends on I10; I12 depends on I11. Each non-planned iteration requires its predecessor state=closed.',
      'I11/I12 planned + stage=not-started may coexist with execution.state=in-progress/implemented and revision-bound implementation evidence. This never closes an upstream gate.',
      'The sole dependency exception is two previously executed changes-required iterations with open rework and actualRevision; it is not a path to start/close a new downstream iteration.',
      'Every proposed intermediate ledger after closing I10, then I11, then I12 must independently satisfy checkPlan. checkPlan does not enforce transition history if all states are changed at once.',
    ],
    iterationCompletionFields: {
      actualRevision: 'Nonempty current revision with evidence; use r100-native-v3-revision-6 for this final source scope.',
      evidenceIds: 'Array of unique registered IDs; at least one evidence row must have revision=actualRevision.',
      achievement: {revision: 'Must exactly equal iteration.actualRevision.', qualifiedWorldIds: 'Unique implemented ledger IDs; machine minimum is >= targetWorlds.',
        gradeCases: 'Unique {worldId,grade} for implemented IDs and low/medium/severe; all3 required for each achievement world; machine minimum >= targetGradeCases.',
        evidenceIds: 'Registered unique IDs, each also present in iteration.evidenceIds. At least one is the exact iteration/revision/hash-bound achievement evidence.'},
      achievementEvidence: {id: 'Unique registered evidence ID, chosen only when issuing the actual closeout.',
        kind: 'One of automated/runtime/source/human; an agent/root technical decision must not impersonate human approval.',
        purpose: 'iteration-achievement', iterationId: 'Exact R100-I10, R100-I11 or R100-I12', revision: 'Same as achievement.revision',
        achievementHash: 'hashAchievement(iteration.id, iteration.achievement)', path: 'Existing regular repository file, no escaping symlink',
        scope: 'Nonempty truthful actual scope', limitations: 'Required string retaining inherited/finite-sample/human/audio limits'},
      gateResults: 'Each item needs nonempty id and pending/pass/changes-required; pass requires registered evidence at gate.revision or iteration.actualRevision. The machine does not declare which gates must exist or pass.',
      execution: 'If retained, state is only in-progress or implemented, with nonempty summary and current-revision evidence. Do not set execution.state=closed.',
      stage: 'Workflow ID or not-started; for honest closeout use close. The validator does not itself couple state=closed to stage=close.',
      completedDate: 'Record the actual completion date by project practice; checkPlan does not validate this field.',
    },
    hashAchievement: {algorithm: 'SHA-256 of UTF-8 JSON.stringify(payload) with insertion order iterationId, revision, qualifiedWorldIds, gradeCases.',
      payload: 'iterationId; achievement.revision; qualifiedWorldIds copied and lexically sorted; gradeCases reduced to {worldId,grade}, then sorted by comparison of each JSON.stringify(row). No whitespace or trailing newline.',
      excluded: ['evidenceIds', 'completedDate', 'reviewer', 'source/package bytes', 'gateResults', 'issue states', 'current eligibility', 'extra achievement fields'],
      consequence: 'The hash seals membership+revision only. Its matching ledger row and file existence do not validate the semantic truth or body of the closeout document.'},
    currentWorldContract: 'Before new achievements, final actual binder must prove each named world and all3 grades: implemented/non-retired/non-invalidated, current revision+package-hash matching technical/visual/experience pass evidence; grade-specific evidence; formal runtime coverage includes both production-entry and recovery. Exact manifest file SHA is required.',
  },
  rootAcceptanceContractBeyondCheckPlan: {
    minimumAllIterations: [
      'All final actual evidence and reviews must precede signing. Use the completed reviewed final plan and dry buildProposal plus all89 real semantic negatives before any ledger binding.',
      'Check the exact frozen plannedWorldIds for each iteration are in current qualifiedIds and productionIds and have all216/276/324 corresponding grade cases; do not rely on count thresholds, implementation status or a historical warning-only achievement.',
      'Resolve this iteration’s blocking issues with current evidence and explicit scope. Current P36 and P44 cannot be silently accepted or removed because checkPlan permits historical closure.',
      'Record distinct root technical, bounded art and actual experience conclusions with their source/report references and explicit limitations. Preserve original failed, empty, death and superseded records.',
      'Choose and enumerate actual closure gates once; require unique IDs and every blocking gate pass, even though checkPlan has no completeness/duplicate/blocking rule for iteration.gateResults.',
    ],
    I10: ['Exact baseline52 + B01–B05 =72/216 current qualified production cases.', 'Current20 base2880 + historical52 base7488 with explicit r5→r6 inheritance;120 new original fixed seed processes and312 inherited unique processes.', 'Normal-view/nearest-world and original geometry/behavior constraints, final compatibility/selection/production with Worker audit; root bounded art/play and P36 closure.'],
    I11: ['Exact baseline52 + B01–B10 =92/276 current cases.', 'Current40 base5760 remains separate from old7488 and I11 additional2208.', 'New20 original120 fixed processes; nearest/weakest-world review; capability1536 and actual presentation15552 final-source record-renderer matrix supply complete92 subset, while retaining no actual GPU/audio claim.'],
    I12: ['All108/324 current cases; current56 base8064 + old7488 + additional2592 =18144 unique generation identities,648 unique fixed processes. Actual failure/recheck reports are a different counter.', 'All324 formal entry/recovery,342 browser equivalence, natural48+root experience review,108 severe ≥60s exclusive performance,10 identical+324 mixed lifecycle and12 Shader samples with independent root ownership review.', 'Final packages/source/full dependency continuity/archive/restore, source-specific build/codegen and compatibility, root full technical decision, exact audio-engineering disposition and RC manifest before closing.'],
    rootSignedArtifacts: {
      technical: {requiredStatus: 'independent-technical-pass', requiredSourceField: 'finalSourceSha256',
        evidenceKeys: ['generation', 'historicalGeneration', 'expandedHoldoutI11', 'expandedHoldoutI12', 'play', 'historicalPlay', 'inheritance', 'production', 'equivalence', 'budget', 'lifecycle', 'shaderReview'],
        boundary: 'Current binder requires these exact refs/status; root authorship and actual independent assessment still require review, not just that status string.'},
      art: {requiredStatus: 'bounded-internal-pass', sourceField: 'finalSourceSha256',
        perWorld: ['worldId', 'status=bounded-internal-pass', 'dependencyHash', 'nonempty scope', 'nonempty limitations', 'independentReviewer=root', 'nonempty hash-bound evidence with source continuity']},
      shader: {requiredStatus: 'bounded-independent-shader-pass', requiredReviewer: 'root',
        requiredFields: ['finalSource', 'report', 'sourceBinding', 'reviewedShaderSamples exactly all12 observed label/created/live/active values', 'nonempty scope', 'nonempty ownershipConclusion', 'nonempty limitations']},
      inheritance: {requiredStatus: 'bounded-pass', requiredReviewer: 'root',
        boundary: 'Old52 actual executed revision5 remains explicit in both candidate and review; shared source/RGBA/current proofs and continued source path must match.'},
      naturalExperience: {requiredPathByContract: `${BASE}continuous-final108/independent-experience-review.json`,
        requiredAssessment: 'Root actual bounded review of 4×12 original continuous histories, equipment/cost/use/loss/settlement and repeated-neighbor/failed-process diagnosis;48 completed rows alone cannot sign experience.',
        boundary: 'The generic binder does not consume natural48. It remains a separate closure gate and must not be omitted.'},
      sound: {existingDecision: ref(`${BASE}final-audio-root-disposition.json`), decisionStatus: sound.status,
        requiredRetainedFields: ['listeningPass=false', 'humanApproval=false', 'R100-R10 pending-actual-listening, target I14, waived=false'],
        boundary: 'Engineering reuse is now root-bound to final source, satisfying the explicit I12 scope decision only. Actual listening, new geometry audibility, masking/fatigue and final human approval remain unverified.'},
    },
    rcAndRelease: {
      taskRequirement: 'I12 requires an actual frozen RC manifest; checkPlan’s iteration-closure block does not enforce that task requirement.',
      ledgerShape: {versionReleaseManifest: '{revision: nonempty RC revision, path: existing repository file, hash: exact file SHA256}'},
      optionalCoverageReleaseResult: 'If R100-G-COVERAGE is signed now, releaseGateResults needs {id,status:pass,revision,evidenceIds}; a cited evidence row must have purpose=release-gate, gateId=R100-G-COVERAGE and the same RC revision/releaseManifestHash. Other release gates stay independently pending.',
      preserve: ['version.status must not become released', 'version.finalAcceptance remains null', 'I13 and I14 remain unfinished', 'human review remains pending for currentr6', 'R100-R10 actual-listening requirement remains a release blocker'],
    },
  },
  actualReadinessAtObservation: {availableBoundedEvidence: available, pendingArtifacts, ongoingProduction,
    ledgerOpenIssues: ledger.issues.filter(row => row.status !== 'resolved').map(row => ({id: row.id, title: row.title, severity: row.severity, iteration: row.iteration, status: row.status, remainingRequirement: row.remainingRequirement ?? row.note})),
    qualifiedLedgerStillNotFinal108: validation.counts.qualified !== 108 || validation.counts.productionGradeCases !== 324,
    finalDraftIncompleteReferences: [...Object.entries(finalDraft).filter(([, value]) => value && !Array.isArray(value) && Object.hasOwn(value, 'sha256') && value.sha256 === null)
      .map(([field, value]) => ({field, path: value.path})), ...finalDraft.runtimeBindings.filter(row => !row.sha256).map(row => ({field: 'runtimeBindings', path: row.path}))],
    draftBoundary: 'Preserve this historical draft; art now exists separately. Final plan must supply actual SHA refs, all four distinct runtime bindings and the reviewed new production canonical path after full recheck. Do not reuse the original failed production report merely because its draft path is populated.',
    noActualIterationCloseout: ledger.iterations.filter(row => ['R100-I10', 'R100-I11', 'R100-I12'].includes(row.id)).map(row => ({id: row.id, actualRevision: row.actualRevision, gateCount: row.gateResults.length, hasAchievement: Boolean(row.achievement)})),
    rcPresentInLedger: ledger.version.releaseManifest !== null,
    fixedPlayCounters: {uniqueHistoricalProcesses: historicalPlay.completedSeedProcesses, historicalActualReports: historicalPlay.actualAttempts,
      uniqueAddedProcesses: play.completedSeedProcesses, addedActualReports: play.actualAttempts,
      uniqueTotal: historicalPlay.completedSeedProcesses + play.completedSeedProcesses,
      actualRecordedTotal: historicalPlay.actualAttempts + play.actualAttempts,
      boundary: '648 unique fixed seed processes and661 actual reports are distinct;346 new includes10 extra attempts. Production recheck attempts and natural48 are separate axes.'}},
  misSigningRisks: [
    'checkPlan keeps historical completion even if current eligibility falls below target: it emits warnings rather than refusing old closed iterations. Do not use that intentionally historical contract to mint a new unsupported achievement.',
    'Machine achievement checks >=target and implemented members, permits extra grade cases outside the world list, and does not bind a frozen batch subset. Root must insist on exact72/216,92/276,108/324 sets for these closeouts.',
    'Iteration gate results may be absent, duplicated, pending or changes-required without blocking closed; P0/P1 unresolved rejection is only in final version=released. The actual task contract is stricter.',
    'A matching achievement hash does not hash the evidence file content, approvals or gate decisions. Receipt SHA/source scope and independent review must be bound by the actual closeout artifact.',
    'Old final-binding/contract.json describes two runtime bindings; the current reviewed binder/final-runtime contract requires four plus Shader review. The old prepared document must not weaken final closure.',
    'A dry binder proposal intentionally preserves iteration/issue/release/audio state and omits natural48 as a generic ledger binding input. A green binder alone does not close I10–I12.',
    'Original production case152 remains failed; clean full324 recheck requires its separate approved single-run protocol,476 maximum actual attempts, complete original152 identity comparison and power/worker cleanup evidence.',
    'Package enabled flags, author count108, historical52 approval, controlled matrices and finite normal frames are separate from current complete qualifications, real GPU performance, full appearance coverage and user/audio approval.',
  ],
  suggestedRootExecutionOrder: ['Complete and independently review production/P44/P36, equivalence, natural48, exclusive budget, lifecycle+Shader.',
    'Produce root final technical report and complete hash-bound final plan with all current addenda; run actual dry binder and all89 true-data semantic negatives.',
    'Bind current world/grade evidence only after those gates pass; re-run read-only checkPlan and assert exact current subsets.',
    'Create actual root closeout+achievement evidence for I10 and validate proposed ledger; repeat for I11 after I10 closed, then I12 after I11 closed with RC and preserved audio decision.',
    'Keep I13/I14/release/human/audio pending, update task/checkpoint/game-state/read-only presentation from actual state and complete the authorized local commit.'],
  checkerPathInterface: {checker: ref('tools/qa/check-r100-i10-i12-final-binding.mjs'),
    syntax: ['node', 'tools/qa/check-r100-i10-i12-final-binding.mjs', '--plan', '<explicit-complete-plan-path>', '--output', '<explicit-new-report-path>'],
    pathRules: 'Both paths resolve inside the repository; input realpath must remain inside; output must not already exist. No default final plan path is assumed.',
    behavior: 'Actual baseline first, then89 separately resealed real-evidence variants; unexpected/stale/setup/wrong-predicate outcomes fail. No --write or ledger mutation.',
    notExecutedHere: true},
  minimalReadOnlyCommandsAfterActualRootProposal: [
    ['node', 'tools/qa/r100-bind-i10-i12.mjs', '--plan', '<finished-final-plan.json>'],
    ['node', 'tools/qa/check-r100-i10-i12-final-binding.mjs', '--plan', '<finished-final-plan.json>', '--output', '<new-negative-check.json>'],
    ['node', 'tools/world-study/r100-progress.mjs', 'check', '--input', '<root-proposed-ledger-after-each-close.json>'],
  ],
  inspectedInputs: [...inputs].map(([file, value]) => ({path: file, sha256: sha(value)})), inspectedInputsUnchanged: true,
};
for (const [file, before] of inputs) assert(fs.readFileSync(file).equals(before), `Concurrent input update; prepare a new observation: ${file}`);
fs.writeFileSync(OUTPUT, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, path: OUTPUT, sha256: sha(fs.readFileSync(OUTPUT)),
  currentCounts: validation.counts, plannedWorlds: plannedScopes.map(row => row.targetWorlds), actualBinderRun: false}));
