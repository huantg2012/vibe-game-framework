#!/usr/bin/env node
/**
 * Bind already-reviewed revision-3 evidence, without closing any iteration.
 * No writes by default. Root owns the ledger and must explicitly run --write.
 */
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import assert from 'node:assert/strict';
import { checkPlan } from '../world-study/r100-progress.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const LEDGER = 'docs/progress/rift-r100.json';
const BASE = 'docs/qa/artifacts/r100-i03-i06-completion';
const VISUAL = 'docs/qa/artifacts/r100-i03-i06/visual-entry-r3';
const INHERITANCE = 'docs/qa/artifacts/r100-world-play-coverage/visual-inheritance.json';
const TECHNICAL = 'docs/qa/rift-r100-i03-i06-technical.md';
const REVISION = 'r100-native-v3-revision-3';
const GRADES = ['low', 'medium', 'severe'];
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const append = (items, id) => items.includes(id) ? items : [...items, id];

function repositoryReader(root) {
  const reads = new Map();
  const absolute = path => {
    const file = resolve(root, path), rel = relative(realpathSync(root), realpathSync(file));
    requireThat(!isAbsolute(path) && rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel), `Outside repository: ${path}`);
    requireThat(statSync(file).isFile(), `Not a file: ${path}`);
    return file;
  };
  const bytes = path => {
    if (!reads.has(path)) reads.set(path, readFileSync(absolute(path)));
    return reads.get(path);
  };
  return {
    bytes,
    json: path => JSON.parse(bytes(path).toString('utf8')),
    unchanged() {
      for (const [path, original] of reads) requireThat(readFileSync(absolute(path)).equals(original), `Input changed during binding; rerun: ${path}`);
    },
  };
}

function loadInputs(root) {
  const reader = repositoryReader(root), read = reader.json;
  const ledger = read(LEDGER), index = read(`${BASE}/final-packages/index.json`);
  const bindings = read(`${BASE}/evidence-bindings.json`);
  const sourcePath = `${BASE}/final-source/source-snapshot.json`, source = read(sourcePath);
  const inheritance = read(INHERITANCE);
  const runtime = read(`${BASE}/serial-entry/report.json`);
  const qualification = read(`${BASE}/revision3/qualification/report.json`);
  const holdout = read(`${BASE}/revision3/holdout/report.json`);
  const equivalence = read(`${BASE}/revision3/browser-equivalence.json`);
  const visualReports = [20261004, 20261005].map(seed => ({ seed, path: `${VISUAL}/seed-${seed}-final/report.json`, report: read(`${VISUAL}/seed-${seed}-final/report.json`) }));
  const normalMatrix = read(inheritance.normalMatrix);
  reader.bytes(TECHNICAL);
  reader.bytes(inheritance.oldManifest);
  requireThat(source.verifiedCopyHashes === true && source.patches.length === 0, 'Expected unpatched, verified final source snapshot');
  requireThat(inheritance.finalManifest === sourcePath, 'Visual inheritance targets a different final source');
  requireThat(index.worlds.length === 20 && new Set(index.worlds.map(w => w.worldId)).size === 20, 'Exactly 20 distinct final world receipts required');
  requireThat(bindings.evidence.length === 20, 'Exactly 20 formal-integration bindings required');
  for (const item of index.worlds) {
    const manifest = read(item.dependencyManifest.path);
    requireThat(sha256(reader.bytes(item.dependencyManifest.path)) === item.dependencyManifest.hash, `${item.worldId}: receipt hash mismatch`);
    requireThat(manifest.worldId === item.worldId && isDeepStrictEqual(manifest.algorithm, { id: 'r100-native', version: 3, revision: 3 }), `${item.worldId}: not final revision 3`);
    requireThat(isDeepStrictEqual(item.grades, GRADES), `${item.worldId}: incomplete receipt grades`);
    for (const dependency of manifest.dependencies) {
      requireThat(sha256(reader.bytes(dependency.path)) === dependency.sha256, `${item.worldId}: current dependency changed: ${dependency.path}`);
      if (source.sources[dependency.path] !== undefined) requireThat(source.sources[dependency.path] === dependency.sha256, `${item.worldId}: dependency differs from runtime snapshot: ${dependency.path}`);
    }
  }
  for (const comparison of [...inheritance.comparisons, ...inheritance.extra]) {
    requireThat(source.sources[comparison.file] === comparison.finalSha256, `Stale visual comparison: ${comparison.file}`);
    requireThat(comparison.same === (comparison.oldSha256 === comparison.finalSha256), `Incorrect visual equality flag: ${comparison.file}`);
    requireThat(comparison.same || ['src/generated/r100-native-worlds.ts', 'src/systems/r100-world/presentation.ts'].includes(comparison.file), `Unreviewed visual difference: ${comparison.file}`);
  }
  requireThat(inheritance.currentReplacement.world === 'pressed-dunes', 'Unexpected visual replacement world');
  for (const { seed, path, report } of visualReports) {
    requireThat(report.status === 'captured' && report.errors.length === 0 && report.cases.length === 6, `Incomplete visual captures: ${path}`);
    for (const world of ['cinder-ridge', 'pressed-dunes']) for (const grade of GRADES) {
      const rows = report.cases.filter(c => c.id === `${world}-${grade}`);
      requireThat(rows.length === 1 && rows[0].pauseHeld === true, `Missing visual case ${world}/${grade}/${seed}`);
      requireThat(rows[0].before.recipe.package.algorithmRevision === 3 && rows[0].before.recipe.requestedSeed === seed, `Wrong visual revision/seed: ${world}/${grade}/${seed}`);
      for (const suffix of ['entry', 'walk']) reader.bytes(`${dirname(path)}/${world}-${grade}-${suffix}.png`);
    }
  }
  const executorHash = sha256(reader.bytes(qualification.source.executor));
  requireThat(executorHash === qualification.source.sha256 && holdout.source.sha256 === executorHash, 'Qualification and holdout must use the same frozen executor');
  for (const dependency of qualification.source.dependencies) requireThat(sha256(reader.bytes(dependency.path)) === dependency.sha256, `Qualification source changed: ${dependency.path}`);
  return { reader, ledger, index, bindings, sourcePath, sourceHash: sha256(reader.bytes(sourcePath)), inheritance, normalMatrix, visualReports, runtime, qualification, holdout, equivalence };
}

export function buildBinding(inputs, root = ROOT) {
  const { ledger, index, bindings, runtime, qualification, holdout, equivalence, inheritance, normalMatrix, visualReports, sourcePath, sourceHash } = inputs;
  requireThat(ledger.schemaVersion === 2 && ledger.worlds.length === 20, 'Expected current 20-world ledger');
  const proposed = structuredClone(ledger), added = [], changes = [];
  const addEvidence = row => {
    const existing = proposed.evidence.find(e => e.id === row.id);
    requireThat(!existing || isDeepStrictEqual(existing, row), `Refusing to overwrite historical evidence: ${row.id}`);
    if (!existing) { proposed.evidence.push(row); added.push(row.id); }
  };
  requireThat(runtime.status === 'passed' && runtime.cases.length === 60, 'Formal entry/Continue matrix not complete');
  requireThat(equivalence.status === 'pass' && equivalence.results.length === 78 && equivalence.results.every(c => c.exactIdentity), 'Cross-engine exact identity regression not complete');
  for (const [name, report, count] of [['qualification', qualification, 2400], ['holdout', holdout, 480]]) {
    requireThat(report.status === 'pass' && report.successful === count && report.rows.length === count && report.failures.length === 0, `${name}: incomplete CPU qualification`);
  }
  for (const item of index.worlds) {
    const world = proposed.worlds.find(w => w.id === item.worldId);
    requireThat(world && world.family === item.family, `${item.worldId}: ledger family missing/mismatched`);
    requireThat(world.implementation === 'implemented' && world.invalidated === false, `${world.id}: do not clear intentional invalidation or invent implementation`);
    requireThat(world.review.experience === 'pending' && world.review.human === 'pending', `${world.id}: experience/human status changed; requires owner review`);
    const productionRows = bindings.evidence.filter(e => e.worldId === world.id);
    requireThat(productionRows.length === 1, `${world.id}: missing/duplicate production binding`);
    const production = productionRows[0];
    requireThat(production.kind === 'runtime' && production.purpose === 'production-integration' && production.revision === REVISION
      && production.dependencyHash === item.dependencyManifest.hash && isDeepStrictEqual(production.grades, GRADES)
      && ['production-entry', 'recovery'].every(c => production.coverage.includes(c))
      && production.path === `${BASE}/serial-entry/report.json` && production.sourceManifest === sourcePath, `${world.id}: invalid final runtime binding`);
    for (const grade of GRADES) {
      const state = world.grades[grade];
      requireThat(state && !state.invalidated && state.review.experience === 'pending', `${world.id}/${grade}: preserve pending experience and invalidation`);
      const cases = runtime.cases.filter(c => c.world === world.id && c.grade === grade);
      requireThat(cases.length === 1 && cases[0].status === 'passed' && cases[0].errors.length === 0 && cases[0].coldIdentityPreserved
        && cases[0].bodyGeometry?.version === 1 && cases[0].bodyGeometry.fullBodyCheckpointAdmitted && cases[0].bodyGeometry.coldBodyPositionPreserved
        && cases[0].identity.generation.package.algorithmRevision === 3, `${world.id}/${grade}: actual formal entry and cold recovery proof incomplete`);
      for (const [name, report, size] of [['qualification', qualification, 40], ['holdout', holdout, 8]]) {
        const rows = report.rows.filter(r => r.world === world.id && r.grade === grade);
        requireThat(rows.length === size && new Set(rows.map(r => r.seed)).size === size, `${world.id}/${grade}: ${name} seed coverage incomplete`);
      }
    }
    const inherited = inheritance.worlds.filter(w => w.id === world.id);
    requireThat(inherited.length === 1 && inherited[0].profileUnchanged && (world.id === 'pressed-dunes' ? !inherited[0].definitionsUnchanged : inherited[0].definitionsUnchanged), `${world.id}: visual inheritance is not supported`);
    if (world.id !== 'pressed-dunes') for (const grade of GRADES) {
      const cases = normalMatrix.cases.filter(c => c.world === world.id && c.grade === grade);
      requireThat(cases.length === 2 && new Set(cases.map(c => c.seed)).size === 2, `${world.id}/${grade}: original visual coverage missing`);
    }
    const shared = { revision: REVISION, worldId: world.id, dependencyHash: item.dependencyManifest.hash, grades: [...GRADES], sourceManifest: sourcePath, sourceManifestSha256: sourceHash };
    const technical = {
      id: `R100-R3-TECHNICAL-${world.id}`, kind: 'source', purpose: 'revision3-technical-review', ...shared, path: TECHNICAL,
      supportingPaths: [`${BASE}/revision3/qualification/report.json`, `${BASE}/revision3/holdout/report.json`, `${BASE}/revision3/browser-equivalence.json`, `${BASE}/serial-entry/report.json`, `${BASE}/entry-performance-summary.json`],
      scope: '当前修订3每档40个生成/完整CPU恢复样本及8个独立保留种子；60个当前Node→Chrome身份逐字一致，旧身份18项另列；当前正式入口及冷续覆盖全部三档。预烤、身体、取消和事务等定向技术证据及历史影响边界见集中正文。',
      limitations: '有限种子和本机浏览器证据，不是全种子、所有设备或整趟玩法证明。2.4秒为未警觉巡路模型空档，不保证实际搜取安全。入场预算只覆盖新出击/点击Continue之后；整页启动仍有100–117ms任务。声音工程检查不等于实际审听。',
    };
    const replacement = world.id === 'pressed-dunes', comparator = world.id === 'cinder-ridge';
    const visual = {
      id: `R100-R3-VISUAL-${world.id}`, kind: 'source', purpose: 'revision3-bounded-visual-review', ...shared, path: INHERITANCE,
      supportingPaths: [inheritance.oldVisualReview, ...(replacement ? [] : [inheritance.normalMatrix]), ...((replacement || comparator) ? visualReports.map(r => r.path) : [])],
      scope: replacement
        ? '当前修订3压实脊廊新实体布局：三档、两个固定种子的正常镜头入口及短走图，经美术审查确认材料、实体几何、局部空间区别和足边；不继承原布局图。'
        : `根据逐文件及逐世界定义比对，继承原修订1两种子三档的材料、实体几何、表面画法、局部空间区别与正常足边审查。${comparator ? '另有当前修订3三档两种子的余烬脊对照图。' : ''}`,
      limitations: '原图保留原始修订，当前记录只登记有证据的有限视觉继承/替换。不会继承旧敌人巡路、收益、声音、当前整趟玩法或用户认可；截图存在和自动采集不是审美通过的替代。已记录的局部辨识弱项保留。',
    };
    for (const evidence of [technical, production, visual]) { addEvidence(evidence); world.evidenceIds = append(world.evidenceIds, evidence.id); }
    const before = { revision: world.revision, dependencyManifest: world.dependencyManifest };
    world.revision = REVISION;
    world.generation = { id: 'r100-native', version: 3, revision: 3 };
    world.dependencyManifest = structuredClone(item.dependencyManifest);
    world.integration = 'production';
    world.review.technical = 'pass'; world.review.visual = 'pass';
    world.reviewEvidence.technical = append(world.reviewEvidence.technical, technical.id);
    world.reviewEvidence.visual = append(world.reviewEvidence.visual, visual.id);
    world.reviewScope = { ...world.reviewScope, technical: technical.scope, visual: visual.scope };
    for (const grade of GRADES) {
      const state = world.grades[grade];
      state.integration = 'production'; state.review.technical = 'pass'; state.review.visual = 'pass';
      state.reviewEvidence.technical = append(state.reviewEvidence.technical, technical.id);
      state.reviewEvidence.visual = append(state.reviewEvidence.visual, visual.id);
      state.integrationEvidence = append(state.integrationEvidence, production.id);
    }
    changes.push({ world: world.id, before, after: { revision: world.revision, dependencyManifest: world.dependencyManifest }, evidence: [technical.id, production.id, visual.id], experience: 'pending', human: 'pending' });
  }
  // No mutable issue/iteration/approval/history section may be altered as a side effect.
  for (const key of Object.keys(ledger).filter(k => !['worlds', 'evidence'].includes(k))) assert.deepEqual(proposed[key], ledger[key]);
  assert.deepEqual(proposed.evidence.slice(0, ledger.evidence.length), ledger.evidence);
  const validation = checkPlan(proposed, { root });
  requireThat(validation.ok, `Proposed ledger rejected:\n${validation.errors.join('\n')}`);
  requireThat(validation.counts.qualified === 0 && validation.counts.humanApproved === 0, 'Binding must not grant complete qualification or human approval');
  return { proposed, summary: { addedEvidence: added.length, changes, validation, preserved: ['historical evidence', 'experience pending', 'human pending', 'issues including P04', 'iterations', 'release gates', 'user approval'] } };
}

function selfTest(inputs) {
  const first = buildBinding(inputs);
  assert.ok(first.summary.addedEvidence >= 0 && first.summary.addedEvidence <= 60);
  const repeated = buildBinding({ ...inputs, ledger: first.proposed });
  assert.equal(repeated.summary.addedEvidence, 0);
  assert.deepEqual(repeated.proposed, first.proposed);
  const invalid = (edit, pattern) => { const copy = structuredClone({ ...inputs, reader: undefined }); edit(copy); assert.throws(() => buildBinding(copy), pattern); };
  invalid(d => d.runtime.cases[0].coldIdentityPreserved = false, /recovery proof incomplete/);
  invalid(d => d.bindings.evidence[0].dependencyHash = '0'.repeat(64), /runtime binding/);
  invalid(d => d.qualification.rows.pop(), /incomplete CPU/);
  invalid(d => d.inheritance.worlds.find(w => w.id === 'ash-strata').definitionsUnchanged = false, /visual inheritance/);
  invalid(d => d.ledger.worlds[0].review.experience = 'pass', /experience\/human status changed/);
  invalid(d => {
    const prior = d.ledger.evidence.find(e => e.id === 'R100-R3-TECHNICAL-ash-strata');
    if (prior) prior.scope = 'different historical claim';
    else d.ledger.evidence.push({ ...first.proposed.evidence.find(e => e.id === 'R100-R3-TECHNICAL-ash-strata'), scope: 'different historical claim' });
  }, /overwrite historical evidence/);
  return { status: 'pass', checks: 8, scope: 'In-memory proposal only: schema, append-only history, idempotence, missing cold recovery, hash mismatch, incomplete CPU evidence, visual mismatch, concurrent owner review / evidence collision. No ledger writes.' };
}

function main() {
  const args = process.argv.slice(2);
  requireThat(args.every(a => ['--write', '--dry-run', '--self-test'].includes(a)) && new Set(args).size === args.length, 'Usage: node tools/qa/r100-bind-final-reviews.mjs [--dry-run | --write | --self-test]');
  requireThat(args.length <= 1, 'Choose one mode; default is dry-run');
  const inputs = loadInputs(ROOT);
  if (args.includes('--self-test')) { console.log(JSON.stringify(selfTest(inputs), null, 2)); return; }
  const result = buildBinding(inputs), mode = args.includes('--write') ? 'write' : 'dry-run';
  const output = `${JSON.stringify(result.proposed, null, 2)}\n`;
  let written = false;
  if (mode === 'write' && !inputs.reader.bytes(LEDGER).equals(Buffer.from(output))) {
    const target = resolve(ROOT, LEDGER), temporary = `${target}.binding-${process.pid}.tmp`;
    let created = false;
    try {
      writeFileSync(temporary, output, { flag: 'wx', mode: statSync(target).mode });
      created = true;
      // Root may have continued editing while evidence was checked. Never overwrite those edits.
      inputs.reader.unchanged();
      renameSync(temporary, target); written = true;
    } finally { if (created) try { unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  }
  console.log(JSON.stringify({ mode, written, ledger: LEDGER, sourceManifest: inputs.sourcePath, sourceManifestSha256: inputs.sourceHash, ledgerBeforeSha256: sha256(inputs.reader.bytes(LEDGER)), ...result.summary }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
