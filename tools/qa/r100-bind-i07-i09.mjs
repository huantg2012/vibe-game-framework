#!/usr/bin/env node
/** Attach final r5 receipts to the ledger. Never closes iterations or grants human approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {checkPlan} from '../world-study/r100-progress.mjs';
import {buildGenerationSummary} from './r100-qualification-summary.mjs';
import {buildPlaySummary} from './r100-play-qualification.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const grades = ['low', 'medium', 'severe'];
const revision = 'r100-native-v3-revision-5';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

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

/** The plan contains hashes of already finished reports and explicit bounded art decisions. */
export function buildProposal(plan, read) {
  assert.equal(plan.version, 1);
  const ledger = read.json('docs/progress/rift-r100.json');
  const index = read.receipt(plan.packages), source = read.receipt(plan.finalSource);
  const cpu = read.receipt(plan.generation), play = read.receipt(plan.play);
  const production = read.receipt(plan.production), equivalence = read.receipt(plan.equivalence);
  const art = read.receipt(plan.art), technicalReview = read.receipt(plan.technicalReview);
  const relative = file => path.isAbsolute(file) ? path.relative(root, file) : file;
  const bytes = file => read.bytes(relative(file));
  const exists = file => read.exists ? read.exists(relative(file)) : fs.existsSync(path.resolve(root, relative(file)));
  // A matching hash binds bytes, not the truth of a derived claim. Recompute
  // coverage from those raw bytes so stale summaries cannot grant qualification.
  assert.deepEqual(buildGenerationSummary(cpu.plan.path, bytes, exists), cpu, 'Generation summary does not match raw evidence');
  const {createdAt: previousTime, ...claimedPlay} = play;
  const {createdAt: recomputeTime, ...recomputedPlay} = buildPlaySummary(play.plan, bytes, exists);
  assert.deepEqual(recomputedPlay, claimedPlay, 'Play summary does not match raw evidence');
  assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
  assert.equal(index.worlds.length, 52);
  const ids = index.worlds.map(row => row.worldId), sorted = rows => [...rows].sort();
  assert.equal(new Set(ids).size, 52);
  assert.deepEqual(sorted(ids), sorted(ledger.worlds.map(row => row.id)));
  assert.equal(cpu.status, 'pass'); assert.equal(cpu.successful, 7488);
  assert.equal(cpu.uniqueCases, 7488); assert.equal(cpu.expectedCases, 7488);
  assert.deepEqual(cpu.missing, []); assert.deepEqual(cpu.unresolved, []);
  assert.deepEqual(sorted(cpu.groups.flatMap(group => group.worlds)), sorted(ids));
  assert.equal(play.status, 'pass'); assert.equal(play.qualifiedGradePairs, 156);
  assert.equal(play.completedSeedProcesses, 312); assert.equal(play.expectedSeeds, 312);
  assert.equal(play.pairs.length, 156);
  // Re-read raw inputs by their recorded hashes instead of trusting a mutable summary.
  for (const group of cpu.groups) for (const attempt of group.attempts) {
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
  assert.equal(production.status, 'passed'); assert.equal(production.cases.length, 156);
  assert.equal(equivalence.status, 'pass'); assert.equal(equivalence.results.length, 174);
  assert(equivalence.results.every(row => row.exactIdentity));
  const currentIdentities = equivalence.results.filter(row => row.revision === 5);
  assert.equal(currentIdentities.length, 156);
  for (const world of ids) for (const grade of grades) {
    const rows = currentIdentities.filter(row => row.world === `r100-${world}` && row.grade === grade);
    assert.equal(rows.length, 1, `Missing/duplicate cross-engine identity: ${world}/${grade}`);
    assert.equal(rows[0].requestedSeed, 20261004); assert.equal(rows[0].expected, rows[0].actual);
  }
  const legacyIdentities = equivalence.results.filter(row => row.revision === 1);
  const original = read.json('tools/recovery/fixtures/r100-revision1-gold.json').records;
  assert.equal(legacyIdentities.length, 18); assert.equal(original.length, 18);
  for (const {identity} of original) {
    const rows = legacyIdentities.filter(row => row.world === identity.generation.package.id
      && row.grade === identity.generation.package.grade && row.seed === identity.seed);
    assert.equal(rows.length, 1, 'Missing/duplicate original browser identity');
    assert.equal(rows[0].expected, identity.signature); assert.equal(rows[0].actual, identity.signature);
  }
  const runtimeBindings = plan.runtimeBindings.map(item => read.receipt(item));
  for (const key of ['production', 'equivalence']) {
    const bindings = runtimeBindings.filter(row => row.report.path === plan[key].path);
    assert.equal(bindings.length, 1, `Missing runtime-source audit: ${key}`);
    const binding = bindings[0]; assert.equal(binding.status, 'pass');
    assert.equal(binding.kind, key);
    assert.deepEqual(binding.finalSource, plan.finalSource); assert.deepEqual(binding.report, plan[key]);
    for (const flag of ['beforeRuntimeVerified', 'afterRuntimeVerified', 'servedSourceVerified']) assert.equal(binding[flag], true);
    assert.equal(binding.exitCode, 0);
    assert.equal(digest(read.bytes(binding.harness.path)), binding.harness.sha256);
    assert.equal(binding.wrapper.path, 'tools/qa/r100-i09-final-probe.mjs');
    assert.equal(digest(read.bytes(binding.wrapper.path)), binding.wrapper.sha256);
    const served = Object.fromEntries(Object.entries(source.sources).filter(([file]) => /^(src|data|public)\//.test(file)));
    assert.deepEqual(binding.beforeServedHashes, served); assert.deepEqual(binding.afterServedHashes, served);
    assert.deepEqual(binding.beforeFiles, {nodeWorkingDirectory: root, frozenDirectory: source.temporaryRoot, files: Object.keys(source.sources).length});
    assert.deepEqual(binding.afterFiles, binding.beforeFiles);
    assert.deepEqual(sorted(binding.worldIds), sorted(ids));
  }
  assert(Object.keys(production.loadedSourceHashes ?? {}).length > 0);
  assert(Object.keys(equivalence.loadedSourceHashes ?? {}).length > 0);
  assert.equal(technicalReview.status, 'independent-technical-pass');
  assert.equal(technicalReview.finalSourceSha256, plan.finalSource.sha256);
  assert.equal(art.status, 'bounded-internal-pass'); assert.equal(art.worlds.length, 52);
  assert.equal(art.finalSourceSha256, plan.finalSource.sha256);
  assert.deepEqual(sorted(art.worlds.map(row => row.worldId)), sorted(ids));

  // Every reused capture/play source must have an explicit world projection to the final snapshot.
  const continuity = plan.continuity.map(item => ({receipt: item, value: read.receipt(item)}));
  function hasContinuity(world, manifest, hash) {
    if (manifest === plan.finalSource.path && hash === plan.finalSource.sha256) return true;
    return continuity.some(({value}) => value.status === 'pass' && value.before.path === manifest
      && value.before.sha256 === hash && value.after.path === plan.finalSource.path
      && value.after.sha256 === plan.finalSource.sha256 && value.worlds.some(row => row.worldId === world));
  }
  for (const {value} of continuity) {
    assert.equal(digest(read.bytes(value.before.path)), value.before.sha256);
    assert.equal(digest(read.bytes(value.after.path)), value.after.sha256);
  }
  assert.equal(plan.generationSources.length, cpu.groups.length);
  for (const group of cpu.groups) {
    const entries = plan.generationSources.filter(row => row.groupId === group.id);
    assert.equal(entries.length, 1, `Missing exact generation source: ${group.id}`);
    const entry = entries[0], snapshot = read.receipt(entry);
    for (const dependency of group.dependencies) {
      if (dependency.path === 'tools/world-study/check-r100-library.ts') {
        // The executable is already hash-bound by the CPU summary. Its entry
        // script is copied alongside the frozen game, outside the runtime list.
        assert.equal(digest(fs.readFileSync(path.join(snapshot.temporaryRoot, dependency.path))), dependency.sha256);
      } else assert.equal(snapshot.sources[dependency.path], dependency.sha256, `Generation/frozen-source mismatch: ${group.id}/${dependency.path}`);
    }
    for (const world of group.worlds) assert(hasContinuity(world, entry.path, entry.sha256), `Unbound CPU world: ${world}`);
  }
  for (const key of ['generation', 'production', 'equivalence'])
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
    assert.deepEqual(manifest.algorithm, {id: 'r100-native', version: 3, revision: 5});
    assert.deepEqual(item.grades, grades); assert.equal(world.family, item.family);
    assert.equal(world.implementation, 'implemented'); assert.equal(world.invalidated, false);
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
          assert(owner && hasContinuity(world.id, owner.sourceManifest, owner.sourceManifestSha256), `Unbound play source: ${world.id}/${grade}`);
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
      assert.equal(row.identity.generation.package.algorithmRevision, 5);
      assert.deepEqual(row.historyBeforeDeparture, {version: 1, visits: []});
      assert.deepEqual(row.committedWorldHistory, {version: 1, visits: [{worldId: world.id, grade}]});
      assert.equal(row.worldHistoryPreserved, true);
    }
    const common = {revision, worldId: world.id, dependencyHash: item.dependencyManifest.hash, grades: [...grades],
      sourceManifest: plan.finalSource.path, sourceManifestSha256: plan.finalSource.sha256};
    const evidence = {
      technical: {id: `R100-R5-FINAL-TECHNICAL-${world.id}`, kind: 'source', purpose: 'technical-review', ...common,
        path: plan.technicalReview.path, supportingPaths: [plan.generation.path, plan.equivalence.path, plan.production.path],
        scope: '每档32普通、8边界和8保留种子；当前跨引擎身份、正式进入/冷续及集中技术审阅已绑定。',
        limitations: '固定有限样本和本机证据；不代表全种子、全设备或实际声音听感。'},
      visual: {id: `R100-R5-FINAL-VISUAL-${world.id}`, kind: 'source', purpose: 'bounded-art-review', ...common,
        path: plan.art.path, supportingPaths: visual.evidence.map(row => row.path), scope: visual.scope, limitations: visual.limitations},
      experience: {id: `R100-R5-FINAL-EXPERIENCE-${world.id}`, kind: 'runtime', purpose: 'fixed-seed-search-extraction', ...common,
        path: plan.play.path, scope: '三档各两个原定种子的实际键盘过程，每档至少一次非入口搜取后撤回同一已结算档；失败、空返和死亡完整保留。',
        limitations: play.limitations},
      production: {id: `R100-R5-FINAL-PRODUCTION-${world.id}`, kind: 'runtime', purpose: 'production-integration', ...common,
        path: plan.production.path, coverage: ['production-entry', 'recovery'],
        scope: '三档从正式备行及启用池出发、暂停保存、整页重载继续；当前身体位置和身份保留。',
        limitations: '覆盖测试预先选择出发随机数，不是自然世界分布、完整游玩或经济样本。'},
    };
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
  assert.equal(validation.counts.qualified, 52); assert.equal(validation.counts.productionGradeCases, 156);
  assert.equal(validation.counts.humanApproved, 0);
  return {proposed, summary: {addedEvidence: additions, counts: validation.counts,
    preserved: ['iteration states', 'issue states', 'historical evidence', 'original human approval scopes', 'release gates']}};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), at = args.indexOf('--plan');
  assert(at >= 0 && args[at + 1], 'Usage: --plan <finished evidence plan> [--write]');
  const read = reader(), plan = read.json(args[at + 1]);
  const result = buildProposal(plan, read);
  if (args.includes('--write')) {
    const target = path.join(root, 'docs/progress/rift-r100.json'), temporary = `${target}.r5-${process.pid}.tmp`;
    try { fs.writeFileSync(temporary, JSON.stringify(result.proposed, null, 2) + '\n', {flag: 'wx'}); read.unchanged(); fs.renameSync(temporary, target); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  console.log(JSON.stringify({written: args.includes('--write'), ...result.summary}, null, 2));
}
