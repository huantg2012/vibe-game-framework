/** Director's bounded disposition. No output before the complete independent audit exists. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base = 'docs/qa/artifacts/r100-i14/';
const read = path => JSON.parse(fs.readFileSync(path));
const sha = path => createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const ref = path => ({path, sha256: sha(path)});
const out = base + 'root/release-gates-through48.json';
assert(!fs.existsSync(out), 'Preserve the completed disposition; do not overwrite.');
const recommendationPath = base + 'qa-release-gates-through48.json';
const recommendation = read(recommendationPath);
assert.equal(recommendation.disposition, 'independent-four-bounded-pass-recommendations-after-complete48');
assert.equal(recommendation.humanApproval, false);
assert.equal(recommendation.releaseApproval, false);
for (const evidence of [recommendation.tool, recommendation.priorThreeGateRecommendation]) {
  assert.equal(sha(evidence.path), evidence.sha256, evidence.path);
}
assert.equal(recommendation.release.hash, 'bbea9d40ab270586e6361b56b764050670b92101270c051715d3a1e1521690d3');
assert.equal(sha(recommendation.release.path), recommendation.release.hash);
const rc = read(recommendation.release.path);
assert.equal(rc.revision, recommendation.release.revision);
assert.equal(rc.finalAcceptance, null);
assert.equal(rc.releaseApproval, false);
assert.equal(sha(rc.finalSource.path), rc.finalSource.sha256);
assert.equal(sha(base + 'root/actor-occlusion-disposition.json'), '7d5e7353f40ebbc248b1ddf8b1f2afe09fc9f8a2a179ed4efa4e710e8e0eaecf');
assert.equal(sha(base + 'root/release-gates-after-cache.json'), '8bdddc7eb5159a4e2ee1fad77b9d5180eb9568e66be008daabe3b720396ea45e');
const source = read(rc.finalSource.path);
assert.equal(Object.keys(source.sources).length, 1398);
for (const [path, hash] of Object.entries(source.sources)) assert.equal(sha(path), hash, path);
for (const evidence of recommendation.sourceAndEvidenceBindingsVerified) assert.equal(sha(evidence.path), evidence.sha256, evidence.path);
assert.deepEqual(recommendation.recommendations.map(r => r.gateId).sort(), [
  'R100-G-COVERAGE', 'R100-G-ECONOMY', 'R100-G-EXPEDITION', 'R100-G-RECOVERY'
]);
for (const gate of recommendation.recommendations) {
  assert.equal(gate.status, 'pass');
  assert.equal(gate.purpose, 'release-gate');
  assert.equal(gate.revision, rc.revision);
  assert.equal(gate.releaseManifestHash, recommendation.release.hash);
  for (const evidence of gate.evidence) assert.equal(sha(evidence.path), evidence.sha256, evidence.path);
}
const expedition = recommendation.recommendations.find(r => r.gateId === 'R100-G-EXPEDITION');
assert.equal(expedition.results.uniqueSorties, 48);
assert.equal(expedition.results.rawFinancialSaves, 192);
assert.deepEqual(expedition.results.byGrade, {low: 16, medium: 16, severe: 16});
assert.equal(Object.keys(expedition.results.byFamily).length, 6);
assert.equal(Object.values(expedition.results.byFamily).reduce((sum, count) => sum + count, 0), 48);
assert.deepEqual(recommendation.remaining.map(r => r.gateId).sort(), ['R100-G-ART', 'R100-G-RELEASE']);

const result = {
  status: 'accepted-four-bounded-current-rc-gates-after-complete48',
  createdAt: new Date().toISOString(), reviewer: 'root / director',
  tool: ref(import.meta.filename), release: recommendation.release,
  independentRecommendation: ref(recommendationPath),
  priorThreeGateDisposition: ref(base + 'root/release-gates-after-cache.json'),
  immutableSourceBridge: ref(base + 'root/actor-occlusion-disposition.json'),
  accepted: recommendation.recommendations.map(g => ({
    gateId: g.gateId, evidenceId: g.id, scope: g.scope,
    limitations: g.limits ?? g.limitations ?? [], evidence: g.evidence
  })),
  newContinuousResults: expedition.results,
  sourceAccounting: {originalSourceSorties: 12, qualifiedRenderDeltaSorties: 36, totalNewUniqueSorties: 48},
  remaining: recommendation.remaining,
  iteration: {id: 'R100-I14', state: 'active', closedIterations: 13, totalIterations: 14},
  finalAcceptance: null, humanApproval: false, releaseApproval: false,
  limitations: [
    'This accepts the preregistered bounded stability and selection sample, preserving real deaths, losses, empty returns and diagnostic failures. It does not introduce or prove an unlimited profitability or exact-item replenishment gate.',
    'Reference-machine performance, source equality and an installable clean device kit do not establish another weaker physical device or cross-platform compatibility.',
    'Whole visual experience, actual listening and continuous fatigue review, and current-RC user final acceptance remain pending. No release or I14 closure is authorized by this disposition.',
    'Historical source-bridge, first-failure and three-gate receipts remain immutable. The final48 receipt adds evidence without rewriting earlier claims.'
  ]
};
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output: ref(out), gates: result.accepted.map(g => g.gateId), results: result.newContinuousResults, releaseApproval: false}));
