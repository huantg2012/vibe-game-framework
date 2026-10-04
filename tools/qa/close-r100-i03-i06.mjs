// Bind the independent, completed review to the current packages. This does
// not grant human approval, close the major version, or approve audio listening.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { checkPlan, hashAchievement } from '../world-study/r100-progress.mjs';

const ledgerPath = 'docs/progress/rift-r100.json';
const reviewPath = 'docs/qa/artifacts/r100-grade-closure/experience-review.json';
const completionPath = 'docs/qa/artifacts/r100-i03-i06-completion/internal-completion.json';
const revision = 'r100-native-v3-revision-3';
const grades = ['low', 'medium', 'severe'];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = fs.readFileSync(ledgerPath);
const data = JSON.parse(original);
const reviewBytes = fs.readFileSync(reviewPath), review = JSON.parse(reviewBytes);
const packages = JSON.parse(fs.readFileSync('docs/qa/artifacts/r100-i03-i06-completion/final-packages/index.json'));
assert.equal(review.schemaVersion, 1);
assert.equal(review.reviewer, '/root/r100_feedback_record');
assert.equal(review.status, 'pass-bounded-current-r3', 'Independent final review is not complete');
assert.equal(review.fullSearchReturnCells, 60);
assert.equal(review.internalPassCells, 60);
assert.equal(review.cells.length, 60);
assert.equal(new Set(review.cells.map(c => `${c.world}/${c.grade}`)).size, 60);
assert.equal(sha(fs.readFileSync(review.sourceManifest)), review.sourceManifestSha256);
assert(data.issues.every(i => i.status === 'resolved'), 'Resolve the recorded issues before closure');
assert.equal(data.worlds.length, 20);
const addEvidence = value => {
  const prior = data.evidence.find(e => e.id === value.id);
  if (prior) assert.deepEqual(prior, value, `Do not rewrite evidence ${value.id}`);
  else data.evidence.push(value);
};
const append = (items, id) => { if (!items.includes(id)) items.push(id); };
for (const world of data.worlds) {
  const current = packages.worlds.find(p => p.worldId === world.id);
  assert(current);
  assert.equal(world.revision, revision);
  assert.deepEqual(world.dependencyManifest, current.dependencyManifest);
  const manifestBytes = fs.readFileSync(current.dependencyManifest.path);
  assert.equal(sha(manifestBytes), current.dependencyManifest.hash);
  for (const dependency of JSON.parse(manifestBytes).dependencies)
    assert.equal(sha(fs.readFileSync(dependency.path)), dependency.sha256, dependency.path);
  const cells = review.cells.filter(c => c.world === world.id);
  assert.deepEqual(cells.map(c => c.grade).sort(), [...grades].sort());
  for (const cell of cells) {
    assert.equal(cell.decision, 'pass');
    assert.equal(cell.algorithmRevision, 3);
    assert.equal(cell.worldDependencyManifest.hash, current.dependencyManifest.hash);
    assert.equal(cell.currentSourceManifestSha256, review.sourceManifestSha256);
    assert(cell.fullSearchReturn?.actualSearchReturn && cell.fullSearchReturn?.settled);
    assert(cell.secondSeedProcess && cell.secondSeedProcess.seed !== cell.fullSearchReturn.seed);
    const second = cell.secondSeedProcess;
    if (cell.secondProcessBasis === 'pressure/failure') {
      assert.equal(second.pressureOrFailure, true, 'Second process has no reviewed pressure/failure evidence');
    } else {
      assert.equal(cell.secondProcessBasis, 'different actually searched positions on another seed');
      const points = run => (run.searchedPoints ?? []).map(p => [p.x, p.y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      assert(points(second).length > 0 && points(cell.fullSearchReturn).length > 0);
      assert.notDeepEqual(points(second), points(cell.fullSearchReturn), 'Second process does not show a different searched route');
    }
    for (const run of [cell.fullSearchReturn, cell.secondSeedProcess])
      assert.equal(sha(fs.readFileSync(run.path)), run.sha256, run.path);
  }
  const evidence = {
    id: `R100-R3-EXPERIENCE-${world.id}`, kind: 'runtime', purpose: 'bounded-experience-review',
    revision, worldId: world.id, dependencyHash: current.dependencyManifest.hash, grades,
    path: reviewPath, reviewSha256: sha(reviewBytes), sourceManifest: review.sourceManifest,
    sourceManifestSha256: review.sourceManifestSha256,
    scope: '独立审查当前世界三级：每级真实搜取、E撤离、R结算；不同种子的实际路线或受压/失败过程另列。三母版针对性准备与90趟经营补充玩法可行性。',
    limitations: '有限种子、诊断几何导航及已披露的正常截图暂停；不代表初见玩家、胜率或全种子。死亡和空返保留，第二过程不要求盈利。实际声音听感归R10未验证；人审待定，长期等级效率归R07/I13。',
  };
  addEvidence(evidence); append(world.evidenceIds, evidence.id);
  world.review.experience = 'pass'; append(world.reviewEvidence.experience, evidence.id);
  world.reviewScope.experience = evidence.scope;
  world.reviewScope.audio = '工程已验；实际听感未验证，R100-R10发布前复核。';
  for (const grade of grades) {
    world.grades[grade].review.experience = 'pass';
    append(world.grades[grade].reviewEvidence.experience, evidence.id);
    assert.equal(world.grades[grade].review.human, 'pending');
  }
  assert.equal(world.review.human, 'pending');
}
const achievements = [];
for (const iteration of data.iterations.filter(i => ['R100-I03', 'R100-I04', 'R100-I05', 'R100-I06'].includes(i.id))) {
  assert(iteration.gateResults.every(g => g.status === 'pass' || g.blocking === false), `${iteration.id}: unresolved blocking gate`);
  const ids = data.worlds.filter(w => w.iterationId <= iteration.id).map(w => w.id);
  assert.equal(ids.length, iteration.targetWorlds);
  const eid = `R100-R3-CLOSED-${iteration.id}`;
  const achievement = { revision, qualifiedWorldIds: ids,
    gradeCases: ids.flatMap(worldId => grades.map(grade => ({ worldId, grade }))), evidenceIds: [eid] };
  const evidence = { id: eid, kind: 'source', purpose: 'iteration-achievement', iterationId: iteration.id,
    revision, achievementHash: hashAchievement(iteration.id, achievement), path: completionPath,
    scope: `累计${ids.length}世界/${ids.length * 3}等级的内部技术、美术与有限实际玩法审核完成，当前依赖绑定；按追加授权结案。`,
    limitations: '内部实施结案，非用户美术终审。实际听感、较弱设备和长期配对效率按已登记发布/后续风险继续；108世界大版本尚未完成。' };
  addEvidence(evidence); append(iteration.evidenceIds, eid);
  Object.assign(iteration, { state: 'closed', stage: 'close', actualRevision: revision,
    completedDate: '2026-10-04', achievement });
  const gate = { id: 'current-world-grade-experience', status: 'pass', revision,
    label: `${ids.length}世界/${ids.length * 3}等级当前包资格与双种子实际过程完成`, evidenceIds: [eid] };
  const prior = iteration.gateResults.findIndex(g => g.id === gate.id);
  if (prior < 0) iteration.gateResults.push(gate); else iteration.gateResults[prior] = gate;
  iteration.execution.summary = evidence.scope;
  achievements.push({ iterationId: iteration.id, ...achievement, achievementHash: evidence.achievementHash });
}
Object.assign(data.resume, {
  iteration: 'R100-I06', batch: 'I03–I06 completed; next planned I07', updatedDate: '2026-10-04',
  headline: 'I03— I06内部结案：20世界、60个污染等级资格',
  lastCompleted: '四轮阻断问题均已解决，逐世界三档搜返与另一种子过程、90趟连续经营、三母版针对性准备及最终生成/恢复/参考机预算已复核。失败保留，用户认可和实际听感未代签。',
  nextAction: '下一轮I07先按当前20世界近邻缺口安排16个新世界；保留R07长期效率、R10实际审听与I14弱设备复核。此次不擅自启动额外迭代。',
  evidenceRevision: revision,
});
const completion = { version: 1, date: '2026-10-04', status: 'internally-complete', revision,
  sourceManifest: review.sourceManifest, sourceManifestSha256: review.sourceManifestSha256,
  experienceReview: reviewPath, experienceReviewSha256: sha(reviewBytes), achievements,
  issues: data.issues.map(i => ({ id: i.id, status: i.status, revision: i.revision })),
  humanApproval: 'pending', actualAudioListening: 'unverified; R100-R10 before I14 release',
  remainingVersionScope: '88 further worlds / 264 grades; I07–I14 not executed in this task',
};
if (!data.changeLog.some(c => c.summary?.startsWith('I03— I06内部结案'))) data.changeLog.push({ date: '2026-10-04', summary: 'I03— I06内部结案：20世界/60档资格、实际搜返及另一种子过程、90趟连续经营和三母版准备验证完整绑定；用户认可、实际审听和发布风险独立保留。' });
if (process.argv.includes('--write')) {
  assert(fs.readFileSync(ledgerPath).equals(original), 'Ledger changed during review');
  const previousCompletion = fs.existsSync(completionPath) ? fs.readFileSync(completionPath) : null;
  fs.writeFileSync(completionPath, JSON.stringify(completion, null, 2) + '\n');
  try {
    const validation = checkPlan(data, { root: process.cwd() });
    assert(validation.ok, validation.errors.join('\n'));
    assert.equal(validation.counts.qualified, 20); assert.equal(validation.counts.qualifiedGradeCases, 60);
    assert.equal(validation.counts.production, 20); assert.equal(validation.counts.productionGradeCases, 60);
    assert.equal(validation.counts.humanApproved, 0);
    assert(fs.readFileSync(ledgerPath).equals(original), 'Ledger changed during validation');
    fs.writeFileSync(ledgerPath, JSON.stringify(data, null, 2) + '\n');
    console.log(JSON.stringify({ written: true, ...validation.counts }));
  } catch (error) {
    if (previousCompletion) fs.writeFileSync(completionPath, previousCompletion);
    else fs.unlinkSync(completionPath);
    throw error;
  }
} else console.log(JSON.stringify({ ready: true, proposedWorlds: 20, proposedGrades: 60, achievements: achievements.map(a => a.iterationId) }));
