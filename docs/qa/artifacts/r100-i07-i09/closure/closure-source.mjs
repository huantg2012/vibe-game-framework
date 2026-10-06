#!/usr/bin/env node
/** REVIEW DRAFT — not executed by its author.
 * node /tmp/r100-close-i07-i09.mjs --root /Users/yilungao/coh
 *   --output docs/qa/artifacts/r100-i07-i09/closure/closure.json [--write]
 * Optional: --binding-plan, --negative-check, --experience-review, --date.
 * Default is read-only. Missing future reports fail closed. This does not run
 * browsers, change runtime, grant human approval, start I10 or release R100.
 * On --write an immutable, validated closure proposal and this script are saved
 * first; the ledger is replaced atomically only after all checks and a byte CAS.
 * If that last write fails, the proposal remains evidence, not proof of commit.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const options = new Set(['--root', '--output', '--binding-plan', '--negative-check', '--experience-review', '--date']);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--write') continue;
  assert(options.has(args[i]) && args[i + 1] && !args[i + 1].startsWith('--'), 'Unknown/missing argument: ' + args[i]);
  i++;
}
const arg = (name, fallback) => { const at = args.indexOf(name); return at < 0 ? fallback : args[at + 1]; };
assert(arg('--root') && arg('--output'), '--root and repository-relative --output are required');
const root = fs.realpathSync(arg('--root'));
process.chdir(root);
const base = 'docs/qa/artifacts/r100-i07-i09';
const i09 = 'docs/qa/artifacts/r100-i09';
const revision = 'r100-native-v3-revision-5';
const grades = ['low', 'medium', 'severe'];
const targetIterations = ['R100-I07', 'R100-I08', 'R100-I09'];
const date = arg('--date', new Date().toISOString().slice(0, 10));
assert(/^\d{4}-\d{2}-\d{2}$/.test(date) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date, 'Real closure date required');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const sameSet = (a, b, label) => assert.deepEqual([...a].sort(), [...b].sort(), label);
const inputs = new Map();
function relative(file) {
  const result = path.relative(root, path.resolve(root, file));
  assert(result && result !== '..' && !result.startsWith('../') && !path.isAbsolute(result), 'Path outside repository: ' + file);
  return result;
}
function bytes(file) {
  file = relative(file);
  const absolute = fs.realpathSync(path.resolve(root, file)); relative(absolute);
  if (!inputs.has(file)) inputs.set(file, fs.readFileSync(absolute));
  return inputs.get(file);
}
const read = file => JSON.parse(bytes(file));
const receipt = file => ({ path: relative(file), sha256: hash(bytes(file)) });
function consume(ref) {
  assert(ref && /^[a-f0-9]{64}$/.test(ref.sha256), 'Explicit receipt required');
  assert.equal(hash(bytes(ref.path)), ref.sha256, 'Changed evidence: ' + ref.path);
  return read(ref.path);
}
function unchanged() {
  for (const [file, value] of inputs) assert(fs.readFileSync(path.resolve(root, file)).equals(value), 'Concurrent input change: ' + file);
}
function allReceipts(value, found = []) {
  if (Array.isArray(value)) for (const child of value) allReceipts(child, found);
  else if (value && typeof value === 'object') {
    if (typeof value.path === 'string' && /^[a-f0-9]{64}$/.test(value.sha256 ?? '')) found.push(value);
    for (const child of Object.values(value)) allReceipts(child, found);
  }
  return found;
}
const output = relative(arg('--output'));
assert(output.startsWith(base + '/') && output.endsWith('.json'), 'Closure evidence must be JSON in this iteration artifact directory');
assert(!fs.existsSync(output), 'Preserve earlier closure evidence; choose a new output');
const scriptOutput = path.join(path.dirname(output), 'closure-source.mjs');
assert(!fs.existsSync(scriptOutput), 'Preserve previous closure script; choose a new directory');
const { checkPlan, hashAchievement } = await import(pathToFileURL(path.join(root, 'tools/world-study/r100-progress.mjs')));
const { buildProposal } = await import(pathToFileURL(path.join(root, 'tools/qa/r100-bind-i07-i09.mjs')));
const { buildPlaySummary } = await import(pathToFileURL(path.join(root, 'tools/qa/r100-play-qualification.mjs')));
const { validateFinalReport } = await import(pathToFileURL(path.join(root, 'tools/qa/r100-i09-final-probe.mjs')));
for (const file of ['tools/world-study/r100-progress.mjs', 'tools/qa/r100-bind-i07-i09.mjs', 'tools/qa/r100-play-qualification.mjs',
  'tools/qa/r100-qualification-summary.mjs', 'tools/qa/r100-observed-searches.mjs', 'tools/qa/r100-i09-final-probe.mjs', 'package-lock.json']) bytes(file);
const bindingPlanPath = arg('--binding-plan', base + '/final-binding/plan.json');
const bindingPlan = read(bindingPlanPath);
const ledgerPath = 'docs/progress/rift-r100.json', originalBytes = bytes(ledgerPath), ledger = read(ledgerPath);
const originalValidation = checkPlan(ledger, { root }); assert(originalValidation.ok, originalValidation.errors.join('\n'));
assert.equal(originalValidation.counts.qualified, 52); assert.equal(originalValidation.counts.production, 52);
assert.equal(originalValidation.counts.qualifiedGradeCases, 156); assert.equal(originalValidation.counts.productionGradeCases, 156);
const bound = buildProposal(bindingPlan, { bytes, json: read, receipt: consume,
  exists: file => fs.existsSync(path.resolve(root, relative(file))) });
assert.deepEqual(bound.proposed, ledger, 'Binder must already have written this exact current qualification; closure does not apply binder changes');
const source = consume(bindingPlan.finalSource), technical = consume(bindingPlan.technicalReview);
assert.equal(technical.status, 'independent-technical-pass');
assert.equal(technical.finalSourceSha256, bindingPlan.finalSource.sha256);
for (const key of ['generation', 'production', 'equivalence']) assert.deepEqual(technical.evidence[key], bindingPlan[key]);
const index = consume(bindingPlan.packages), ids = index.worlds.map(row => row.worldId);
assert.equal(ids.length, 52); assert.equal(new Set(ids).size, 52);
const negativePath = arg('--negative-check', base + '/final-binding/negative-check.json'), negative = read(negativePath);
assert.equal(negative.status, 'pass'); assert.equal(negative.actualInputsUnchanged, true);
assert.deepEqual(negative.plan, receipt(bindingPlanPath)); assert.equal(negative.baseline.status, 'pass');
assert.equal(negative.baseline.counts.qualified, 52); assert.equal(negative.baseline.counts.productionGradeCases, 156);
const negativeNames = ['missing-second-fixed-seed', 'empty-return-claimed-as-search', 'raw-search-proof-removed-with-resealed-receipts',
  'raw-cpu-case-missing-with-resealed-receipt', 'formal-cold-identity-false', 'formal-cold-body-false', 'formal-history-double-commit',
  'equivalence-wrong-requested-seed', 'equivalence-duplicate-grade', 'art-wrong-world-dependency', 'missing-production-runtime-binding',
  'runtime-bound-to-another-real-source', 'served-source-coverage-missing', 'technical-review-wrong-source', 'technical-review-wrong-evidence'];
sameSet(negative.cases.map(row => row.name), negativeNames, 'All15 actual negative cases required');
assert(negative.cases.every(row => row.status === 'pass' && row.actual === 'logical-assertion'));
assert.deepEqual(negative.binder, receipt('tools/qa/r100-bind-i07-i09.mjs'));
const checker = negative.inputs.find(row => row.path === 'tools/qa/check-r100-final-binding.mjs');
assert(checker); assert.deepEqual(checker, receipt(checker.path));

function actualPlay(file, count) {
  const summary = read(file), { createdAt: ignored, ...actual } = summary;
  const { createdAt: ignoredRecomputed, ...recomputed } = buildPlaySummary(summary.plan, bytes, file => fs.existsSync(path.resolve(root, relative(file))));
  assert.deepEqual(actual, recomputed, 'Actual fixed-play raw records must match summary');
  assert.equal(summary.status, 'pass'); assert.equal(summary.qualifiedGradePairs, count * 3);
  assert.equal(summary.completedSeedProcesses, count * 6);
  const worlds = [...new Set(summary.pairs.map(row => row.world))].sort(); assert.equal(worlds.length, count);
  assert(summary.pairs.every(row => row.qualified && row.seeds.length === 2 && row.seeds.every(seed => seed.processComplete)));
  const cases = summary.pairs.map(row => ({ worldId: row.world, grade: row.grade }));
  sameSet(cases.map(row => row.worldId + '/' + row.grade), worlds.flatMap(world => grades.map(grade => world + '/' + grade)));
  return { worlds, cases, summary, receipt: receipt(file) };
}
const i07 = actualPlay(base + '/i07-fixed-play/summary.json', 36);
const full = actualPlay(bindingPlan.play.path, 52); sameSet(full.worlds, ids);
assert(i07.worlds.every(id => ids.includes(id)));
const gold = read('tools/recovery/fixtures/r100-revision1-gold.json').records.map(row => row.identity);
function finalProbe(kind, folder, reportName) {
  const reportPath = folder + '/' + reportName, report = read(reportPath), bindingPath = folder + '/source-binding.json', audit = read(bindingPath);
  assert.equal(audit.kind, kind); assert.equal(audit.status, 'pass'); assert.equal(audit.exitCode, 0);
  assert.deepEqual(audit.finalSource, bindingPlan.finalSource); assert.deepEqual(audit.report, receipt(reportPath));
  for (const flag of ['beforeRuntimeVerified', 'afterRuntimeVerified', 'servedSourceVerified']) assert.equal(audit[flag], true);
  const served = Object.fromEntries(Object.entries(source.sources).filter(([file]) => /^(src|data|public)\//.test(file)));
  assert.deepEqual(audit.beforeServedHashes, served); assert.deepEqual(audit.afterServedHashes, served);
  assert.deepEqual(audit.beforeFiles, { nodeWorkingDirectory: root, frozenDirectory: source.temporaryRoot, files: Object.keys(source.sources).length });
  assert.deepEqual(audit.afterFiles, audit.beforeFiles); sameSet(audit.worldIds, ids);
  for (const item of [audit.harness, audit.wrapper, ...audit.dependencies]) assert.equal(hash(bytes(item.path)), item.sha256);
  validateFinalReport(kind, report, ids, gold);
  return { report: receipt(reportPath), binding: receipt(bindingPath) };
}
const budget = finalProbe('budget', i09 + '/runtime-budget-final52', 'report.json');
const lifecycle = finalProbe('lifecycle', i09 + '/lifecycle-final52', 'report.json');
assert.deepEqual(technical.evidence.runtimeBudget, budget.report);
assert.deepEqual(technical.evidence.lifecycle, lifecycle.report);
const continuousFolder = i09 + '/continuous-final52';
const summaryPath = continuousFolder + '/summary.json', automaticPath = continuousFolder + '/review-death-loss-v2.json';
const summary = read(summaryPath), automatic = read(automaticPath);
const continuousPolicy = read(summary.policy), continuousExecution = read(continuousFolder + '/execution.json');
const failedAutomaticPath = continuousFolder + '/review.json', correctionPath = continuousFolder + '/death-loss-review-check-v2.json';
const failedAutomatic = read(failedAutomaticPath), correction = read(correctionPath);
assert.equal(failedAutomatic.status, 'incomplete-or-invalid-data', 'Preserve the original failed automatic review');
assert.equal(relative(automatic.supersedes.path), failedAutomaticPath);
assert.equal(automatic.supersedes.sha256, receipt(failedAutomaticPath).sha256);
assert.equal(relative(automatic.reviewTool.derivedFrom.path), relative(continuousPolicy.review.tool));
assert.equal(automatic.reviewTool.derivedFrom.sha256, continuousPolicy.review.toolSha256);
assert.equal(failedAutomatic.reviewTool.sha256, continuousPolicy.review.toolSha256);
for (const item of [automatic.reviewTool, automatic.reviewTool.derivedFrom, automatic.reviewPolicy])
  assert.equal(hash(bytes(item.path)), item.sha256, 'Changed corrected-review source or policy');
assert.equal(correction.status, 'pass');
for (const key of ['syntaxExitCode', 'selfCheckExitCode', 'actualReviewExitCode']) assert.equal(correction.checks[key], 0);
assert.equal(correction.checks.originalAccountingAndInputCases, 'pass');
sameSet(correction.checks.negativeCases, ['extract missing tool', 'death non-carried', 'not carried out', 'different run', 'not settled',
  'not base settled', 'death returned items', 'death returned kindling', 'not dead', 'not ended', 'uncleared equipment', 'uncleared defense reference']);
for (const item of allReceipts(correction)) assert.equal(hash(bytes(item.path)), item.sha256, 'Changed death-loss correction evidence');
for (const needed of [receipt(failedAutomaticPath), receipt(automaticPath), receipt(automatic.reviewTool.path), receipt(continuousPolicy.review.tool)])
  assert(correction.inputs.some(item => relative(item.path) === needed.path && item.sha256 === needed.sha256), 'Correction must bind ' + needed.path);
for (const [key, value] of Object.entries(correction.actualResult)) assert.deepEqual(automatic[key], value, 'Corrected review/check mismatch: ' + key);
assert.equal(failedAutomatic.mandatoryDiagnosis.length, 2, 'The narrow correction must not dismiss other original diagnoses');
sameSet(failedAutomatic.mandatoryDiagnosis.map(item => item.ordinal), [7, 10]);
for (const item of failedAutomatic.mandatoryDiagnosis)
  assert(item.kind === 'contract-failure' && item.policy === 'severe' && item.actualFailure === null
    && item.failure.startsWith('AssertionError [ERR_ASSERTION]: Tool disappeared without exhaustion/destruction: '), 'Unexpected original diagnosis');
for (const item of failedAutomatic.inputs) assert.equal(hash(bytes(item.path)), item.sha256, 'Original failed-review input changed');

assert.equal(relative(continuousPolicy.sourceManifestOriginal), bindingPlan.finalSource.path);
assert(bytes(continuousPolicy.sourceManifest).equals(bytes(bindingPlan.finalSource.path)), 'Continuous copy must match final source bytes');
sameSet(continuousPolicy.worldIds, ids); assert.equal(continuousPolicy.searchLimit, 3); assert.equal(continuousPolicy.concurrency, 1);
for (const item of continuousPolicy.fixedFiles) assert.equal(hash(bytes(item.file)), item.sha256, 'Changed continuous input: ' + item.file);
assert.equal(continuousExecution.status, 'completed-attempts-pending-summary');
assert.equal(continuousExecution.branches.length, 4); assert(continuousExecution.branches.every(row => row.exitCode === 0));
assert.deepEqual(continuousExecution.finalServedSourceAnchors, continuousPolicy.servedSourceAnchors);
for (const [file, digest] of Object.entries(continuousPolicy.servedSourceAnchors)) assert.equal(digest, source.sources[file]);
for (const item of automatic.inputs) assert.equal(hash(bytes(item.path)), item.sha256, 'Changed automatic-review input');
assert.equal(summary.status, 'completed-continuous-samples-pending-review'); assert.equal(summary.sourceValid, true);
assert.equal(summary.plannedTrips, 48); assert.equal(summary.validatedTrips, 48);
assert.equal(automatic.status, 'complete-valid-data-pending-experience-review'); assert.equal(automatic.experienceApproval, 'pending');
assert.equal(automatic.validatedTrips, 48); assert.deepEqual(automatic.gradeCounts, { low: 16, medium: 16, severe: 16 });
const policies = ['low', 'medium', 'severe', 'alternating'];
sameSet(summary.branches.map(row => row.policy), policies); sameSet(automatic.branches.map(row => row.policy), policies);
const branchReceipts = [];
for (const policy of policies) {
  const row = summary.branches.find(row => row.policy === policy), raw = read(row.report);
  assert.equal(hash(bytes(row.report)), row.reportSha256); assert.equal(raw.policyRevision, 15);
  assert.equal(raw.realJourneyAttempts.length, 12); assert.equal(automatic.branches.find(row => row.policy === policy).rows.length, 12);
  branchReceipts.push(receipt(row.report));
}
const experiencePath = arg('--experience-review', continuousFolder + '/independent-experience-review.json'), experience = read(experiencePath);
assert.equal(experience.status, 'bounded-experience-pass', 'Root approval is independent from automatic valid-data completion');
assert.equal(experience.reviewer, 'root');
const experienceReceipts = allReceipts(experience);
for (const item of experienceReceipts) assert.equal(hash(bytes(item.path)), item.sha256);
for (const needed of [bindingPlan.finalSource, receipt(summaryPath), receipt(automaticPath), ...branchReceipts])
  assert(experienceReceipts.some(row => relative(row.path) === needed.path && row.sha256 === needed.sha256), 'Root experience review must bind ' + needed.path);
assert(experienceReceipts.some(row => /\.(png|webp|jpe?g)$/i.test(row.path)), 'Root review must cite its actual images');
// If the automatic review flags pressure/empty-return/death streaks or another
// mandatory diagnosis, require an explicit root disposition for every flag.
for (const flag of automatic.mandatoryDiagnosis) {
  const diagnosis = (experience.diagnoses ?? []).find(row => isDeepStrictEqual(row.flag, flag));
  assert(diagnosis && ['resolved', 'bounded-nonblocking'].includes(diagnosis.decision) && diagnosis.reason?.trim(), 'Unreviewed mandatory continuous diagnosis');
  assert(allReceipts(diagnosis).length > 0, 'Diagnosis must cite original evidence');
}
const selectionPath = i09 + '/selection-final52/selection.json', selection = read(selectionPath);
sameSet(selection.worldIds, ids); assert.equal(selection.uniform.samples, 32768); assert.equal(selection.recent.samples, 32768);
assert.equal(selection.policy.historyLimit, 8);
const catalog = bytes('src/generated/r100-native-worlds.ts').toString('utf8');
assert.equal(selection.catalogSourceHash, /R100_NATIVE_CATALOG_SOURCE_HASH = '([^']+)'/.exec(catalog)?.[1]);
assert.equal(selection.policySourceHash, /R100_SELECTION_SOURCE_HASH = '([^']+)'/.exec(bytes('src/generated/r100-world-selection.ts').toString('utf8'))?.[1]);

const issueDefinitions = [
  { id: 'R100-P14', worlds: ['bleached-court'], repairs: ['b02-terrace-refined/protected-before.json', 'b02-terrace-refined/protected-after.json', 'b02-terrace-refined/geometry-report.json', 'b02-refined-art-review.json'],
    resolution: '仅调整厚岸形体，补出真实下岸退缺、偏置上层和不等断端；其他世界保持证明、限定实景复审及最终资格已绑定。',
    resolutionEvidence: '厚岸修前后保护记录、几何报告和白岸复审对应本次修复；最终技术、美术、固定游玩与正式接入证据共同绑定修后白岸。' },
  { id: 'R100-P15', worlds: [], repairs: ['calibration-v13/calibration-summary.json', 'play-continuation/old20-reconciled-summary.json', 'qualification-policy/final52-summary.json', 'final-fixed-play/summary.json', 'final-binding/production-equivalence-review.json'],
    resolution: '保留原负载、控制器和环境失败；使用原执行器、原种子的精确补验与固定策略 13 游玩补齐来源绑定覆盖。策略 15 的自然游玩记账、独占性能和资源释放各有独立当前证据。',
    resolutionEvidence: '策略 13 标定、旧 20 世界拾取对账、7488 格生成汇总、312 个固定种子过程及正式接入与等价复核均保留原失败；本轮关闭另核自然 48 趟、独占性能和资源释放真实报告。' },
  { id: 'R100-P16', worlds: ['tendon-shelves'], repairs: ['tendon-repair/authoring-protection.json', 'tendon-repaired-qualification/summary.json', 'tendon-foot-refined/report.json', 'final-geometry-gates/actual-effective-ports.json'],
    resolution: '仅调整韧束第二实例的位置与朝向，重新验证完整身体穿口和原种子真实输入；旧 144 格整组归档，由修后完整 144 格及最终当前资格接替。',
    resolutionEvidence: '单世界作者保护、修后 144 格资格、原种子足口实走和实际生效种子扫掠共同证明第二足口恢复连通；第一实例、其他世界和共享几何保持不变。' },
  { id: 'R100-P17', worlds: ['sentinel-mass', 'stepped-bowl', 'draped-bay'], repairs: ['b07-geometry/refinement-protection.json', 'b07-geometry/refined-route-summary.json', 'b07-geometry/refined-production-probe.json', 'b07-identity-followup/report.json'],
    resolution: '修正高体、折岸与垂幕组合三个世界的作者布局，共享侵蚀和身体规则保持不变，保留原 3096 失败。修后真口、静庭和限定补拍现已绑定最终源资格。',
    resolutionEvidence: '三世界布局保护、全身体路线汇总、正式生成预检和真实输入补拍覆盖口部与庭院修复；最终来源连续性将这些修后证据绑定到当前世界资格。' },
  { id: 'R100-P18', worlds: ['sentinel-mass'], repairs: ['sentinel-repair/authoring-protection.json', 'sentinel-repair/source-protection.json', 'sentinel-repair/joined-shoulders.json', 'sentinel-repaired-qualification/summary.json', 'b07-identity-review.json'],
    resolution: '将被否决的孤立高体改为相连且不对称的高低双肩，形成不同朝向的两个真口；其他 47 世界和共享代码保持不变。旧 144 格整组归档，修后美术、游玩和技术证据均绑定当前版本。',
    resolutionEvidence: '作者与源码保护、双肩真实交接报告、修后完整 144 格资格和限定身份复审共同证明构造关系变化；最终绑定继续覆盖两个真口及其他 47 世界不变。' },
];
const proposed = structuredClone(ledger), additions = [];
const append = (rows, value) => { if (!rows.includes(value)) rows.push(value); };
function evidence(id, primary, scope, kind = 'source', extra = {}) {
  assert(!proposed.evidence.some(row => row.id === id), 'Closure evidence ID already exists: ' + id);
  const proof = { id, kind, revision, path: primary.path, evidenceSha256: primary.sha256, sourceManifest: bindingPlan.finalSource.path,
    sourceManifestSha256: bindingPlan.finalSource.sha256, scope, limitations: 'Bounded internal iteration closure only; no new human approval, release decision, actual audio-listening result, weaker-device guarantee or long-term economy conclusion.',
    closureEvidencePath: output, ...extra };
  proposed.evidence.push(proof); additions.push(id); return id;
}
const proofs = {
  technical: evidence('R100-R5-CLOSE-TECHNICAL', bindingPlan.technicalReview, 'Final source, compatibility, geometry and actual runtime technical review.'),
  visual: evidence('R100-R5-CLOSE-ART', bindingPlan.art, '52 world-specific bounded art decisions and current dependency receipts.'),
  i07: evidence('R100-R5-CLOSE-I07-FIXED-PLAY', i07.receipt, 'Actual36 worlds/108 grades with both original seeds and retained failures.', 'runtime'),
  full: evidence('R100-R5-CLOSE-52-FIXED-PLAY', full.receipt, 'Actual52 worlds/156 grades with312 original seed processes and315 attempts retained.', 'runtime'),
  production: evidence('R100-R5-CLOSE-PRODUCTION', bindingPlan.production, '156 formal enabled-pool entries and cold continuation, exact history/body/identity.', 'runtime'),
  equivalence: evidence('R100-R5-CLOSE-EQUIVALENCE', bindingPlan.equivalence, '156 current and18 original revision1 cross-engine identities.', 'automated'),
  selection: evidence('R100-R5-CLOSE-SELECTION', receipt(selectionPath), 'Actual52 positive-weight distribution and recent-history sampling;32768 per policy.', 'automated'),
  experience: evidence('R100-R5-CLOSE-CONTINUOUS-ROOT', receipt(experiencePath), 'Root bounded judgement of all four12-trip actual branches and required diagnoses.', 'runtime'),
  performance: evidence('R100-R5-CLOSE-PERFORMANCE', budget.report, '52 severe full-alive60-second reference samples in the declared exclusive window.', 'runtime'),
  lifecycle: evidence('R100-R5-CLOSE-LIFECYCLE', lifecycle.report, 'Ten same-world cycles and156 mixed world-grade rebuilds with bounded release checks.', 'runtime'),
};
const repaired = [];
for (const definition of issueDefinitions) {
  const issue = proposed.issues.find(row => row.id === definition.id); assert(issue && issue.status === 'open', 'Do not rewrite an earlier issue resolution');
  const repairs = definition.repairs.map(file => receipt(base + '/' + file));
  const currentEvidenceIds = definition.worlds.flatMap(world => ['TECHNICAL', 'VISUAL', 'EXPERIENCE', 'PRODUCTION'].map(axis => 'R100-R5-FINAL-' + axis + '-' + world));
  assert(currentEvidenceIds.every(id => ledger.evidence.some(row => row.id === id && row.revision === revision)));
  const id = evidence('R100-R5-CLOSED-' + definition.id, bindingPlan.technicalReview, definition.resolution, 'source',
    { purpose: 'issue-resolution', issueId: definition.id, repairs, currentEvidenceIds, supportingPaths: [output, ...repairs.map(row => row.path)] });
  Object.assign(issue, { status: 'resolved', revision, resolvedDate: date, resolution: definition.resolution,
    resolutionEvidence: definition.resolutionEvidence,
    remainingRequirement: '' });
  append(issue.evidenceIds, id); repaired.push({ id: definition.id, repairs, currentEvidenceIds });
}
const gateLabels = {
  'current52-library': '52 个世界的当前完整资格',
  'selection-history-and-compatibility': '世界抽选、历史保存与版本兼容',
  'root-continuous48-experience': '总监对连续 48 趟实际体验的限定复审',
  'exclusive-performance': '独占运行窗口的真实性能验证',
  'bounded-resource-release': '声明范围内的资源释放验证',
  'current-world-grade-qualification': '当前世界及三档完整资格',
  'formal-entry-and-recovery': '正式进入与冷启动续玩验证',
  'bounded-repairs-and-source-binding': '本轮修复及最终来源绑定',
};
const stages = [], achievements = [];
for (const id of targetIterations) {
  const iteration = proposed.iterations.find(row => row.id === id); assert(iteration && iteration.state !== 'closed', 'Never rewrite an existing closure');
  assert(iteration.dependencies.every(dependency => proposed.iterations.find(row => row.id === dependency)?.state === 'closed'), id + ': predecessor must close first');
  assert(iteration.gateResults.every(gate => gate.status === 'pass' || gate.blocking === false), id + ': unresolved existing gate requires a separate decision');
  assert(iteration.issueIds.every(issueId => proposed.issues.find(row => row.id === issueId)?.status === 'resolved'), id + ': unresolved assigned issue');
  const basis = id === 'R100-I07' ? i07 : full;
  assert.equal(basis.worlds.length, iteration.targetWorlds); assert.equal(basis.cases.length, iteration.targetGradeCases);
  const achievementId = 'R100-R5-CLOSED-' + id;
  const achievement = { revision, qualifiedWorldIds: [...basis.worlds], gradeCases: structuredClone(basis.cases), evidenceIds: [achievementId] };
  const achievementHash = hashAchievement(id, achievement);
  evidence(achievementId, id === 'R100-I09' ? receipt(experiencePath) : basis.receipt,
    id + ': current ' + basis.worlds.length + ' worlds/' + basis.cases.length + ' grades; predecessor-first bounded internal closure.', 'source',
    { purpose: 'iteration-achievement', iterationId: id, achievementHash, supportingPaths: [output, bindingPlan.technicalReview.path, bindingPlan.art.path, basis.receipt.path] });
  const gates = id === 'R100-I09'
    ? [['current52-library', proofs.technical, proofs.full, proofs.visual, proofs.production], ['selection-history-and-compatibility', proofs.selection, proofs.production, proofs.equivalence], ['root-continuous48-experience', proofs.experience], ['exclusive-performance', proofs.performance], ['bounded-resource-release', proofs.lifecycle]]
    : [['current-world-grade-qualification', proofs.technical, proofs.visual, id === 'R100-I07' ? proofs.i07 : proofs.full], ['formal-entry-and-recovery', proofs.production, proofs.equivalence], ['bounded-repairs-and-source-binding', achievementId]];
  for (const [gateId, ...evidenceIds] of gates) {
    assert(!iteration.gateResults.some(gate => gate.id === gateId), 'Do not replace existing gate: ' + gateId);
    iteration.gateResults.push({ id: gateId, label: gateLabels[gateId], status: 'pass', blocking: true, revision, evidenceIds });
    for (const eid of evidenceIds) append(iteration.evidenceIds, eid);
  }
  append(iteration.evidenceIds, achievementId);
  Object.assign(iteration, { state: 'closed', stage: 'close', actualRevision: revision, completedDate: date, achievement });
  iteration.execution = { ...iteration.execution, state: 'implemented', revision,
    summary: id + ' 已完成本轮内部收尾：实际 ' + basis.worlds.length + ' 个世界、' + basis.cases.length + ' 个世界档位组合通过当前来源绑定；真实生成、固定游玩、美术与正式接入证据齐备，原失败记录保留。I09 另核连续 48 趟总监体验复审、独占性能与资源释放。本记录不新增人审、发布或 I10 通过结论。',
    evidenceIds: [...new Set([...(iteration.execution?.evidenceIds ?? []), ...iteration.evidenceIds])] };
  const validation = checkPlan(proposed, { root }); assert(validation.ok, validation.errors.join('\n'));
  assert.equal(validation.counts.qualified, 52); assert.equal(validation.counts.productionGradeCases, 156);
  stages.push({ iterationId: id, counts: validation.counts, warnings: validation.warnings });
  achievements.push({ iterationId: id, ...achievement, achievementHash });
}
// Whitelist the mutation: no worlds, historical evidence, earlier/later
// iterations, other issues, resume, release gates, risks or human state change.
for (const key of Object.keys(ledger).filter(key => !['iterations', 'issues', 'evidence'].includes(key))) assert.deepEqual(proposed[key], ledger[key], 'Protected ledger section: ' + key);
for (const iteration of ledger.iterations.filter(row => !targetIterations.includes(row.id))) assert.deepEqual(proposed.iterations.find(row => row.id === iteration.id), iteration);
for (const issue of ledger.issues.filter(row => !issueDefinitions.some(item => item.id === row.id))) assert.deepEqual(proposed.issues.find(row => row.id === issue.id), issue);
assert.deepEqual(proposed.evidence.slice(0, ledger.evidence.length), ledger.evidence);
assert.deepEqual(proposed.worlds, ledger.worlds);
const finalValidation = checkPlan(proposed, { root }); assert(finalValidation.ok, finalValidation.errors.join('\n'));
const sourceBytes = fs.readFileSync(fileURLToPath(import.meta.url));
const closure = { version: 1, status: 'validated-closure-proposal', date, revision, finalSource: bindingPlan.finalSource,
  bindingPlan: receipt(bindingPlanPath), negativeChecks: receipt(negativePath), technicalReview: bindingPlan.technicalReview,
  rootExperienceReview: receipt(experiencePath), continuousSummary: receipt(summaryPath), automaticReview: receipt(automaticPath),
  originalFailedAutomaticReview: receipt(failedAutomaticPath), automaticReviewCorrection: receipt(correctionPath), branchReceipts,
  performance: budget, lifecycle, selection: receipt(selectionPath), originalLedgerSha256: hash(originalBytes), proposedLedgerSha256: hash(encode(proposed)),
  script: { path: scriptOutput, sha256: hash(sourceBytes) }, achievements, issues: repaired, stages, addedEvidenceIds: additions,
  sourceInputs: [...inputs].map(([file, value]) => ({ path: file, sha256: hash(value) })),
  protected: ['All52 world and human states', 'All prior evidence bytes/rows', 'I01-I06 and I10-I14', 'Other issues', 'Version/releaseGateResults/risks/resume/changeLog'],
  limitations: 'This immutable proposal records successful prewrite validation. The ledger equals proposedLedgerSha256 only after the atomic write succeeds; file existence alone is not proof of closure. No R100 release or new human approval.' };
unchanged();
if (!args.includes('--write')) {
  console.log(JSON.stringify({ written: false, ready: true, stages, output, missingEvidence: [], note: 'No files written. --write reruns every check, saves independent closure evidence, then atomically replaces the unchanged ledger.' }, null, 2));
} else {
  let existingParent = path.dirname(output);
  while (!fs.existsSync(existingParent)) existingParent = path.dirname(existingParent);
  relative(fs.realpathSync(existingParent));
  fs.mkdirSync(path.dirname(output), { recursive: true }); relative(fs.realpathSync(path.dirname(output)));
  const temporary = ledgerPath + '.close-' + process.pid + '.tmp';
  try {
    fs.writeFileSync(scriptOutput, sourceBytes, { flag: 'wx' }); fs.writeFileSync(output, encode(closure), { flag: 'wx' });
    unchanged();
    const verified = checkPlan(proposed, { root }); assert(verified.ok, verified.errors.join('\n'));
    fs.writeFileSync(temporary, encode(proposed), { flag: 'wx' }); unchanged();
    assert(fs.readFileSync(ledgerPath).equals(originalBytes), 'Ledger changed immediately before commit');
    fs.renameSync(temporary, ledgerPath);
    console.log(JSON.stringify({ written: true, evidence: receipt(output), ledgerSha256: hash(fs.readFileSync(ledgerPath)), closed: targetIterations, counts: verified.counts }, null, 2));
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
