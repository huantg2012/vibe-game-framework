/** Final bounded gate recommendations. Refuses to run before the independently audited 48 unique sorties exist. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const base = 'docs/qa/artifacts/r100-i14/';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const ref = path => ({path, sha256: sha(path)});
const out = base + 'qa-release-gates-through48.json';
assert(!fs.existsSync(out), 'Preserve final evidence; do not overwrite.');
const rcPath = base + 'release-candidate.json';
const rc = read(rcPath);
const releaseHash = sha(rcPath);
assert.equal(releaseHash, 'bbea9d40ab270586e6361b56b764050670b92101270c051715d3a1e1521690d3');
assert.equal(rc.revision, 'r100-native-v3-revision-6-i14-occlusion-rc-20261009');
assert.equal(rc.worldIds.length, 108);
assert.equal(rc.gradeCases.length, 324);
assert.equal(rc.finalAcceptance, null);
assert.equal(rc.releaseApproval, false);

const checked = new Map();
function bind(r) {
  const file = r.path ?? r.file;
  assert.equal(sha(file), r.sha256, file);
  checked.set(file, ref(file));
}
for (const r of Object.values(rc)) if (r && typeof r === 'object' && r.path && r.sha256) bind(r);
const auditPath = base + 'qa-continuous-delta-v4-through-48.json';
const audit = read(auditPath);
assert.equal(audit.status, '48-unique-continuous-sample-accounting-pass');
assert.equal(audit.completedBatches, 4);
assert.equal(audit.uniqueActualSorties, 48);
assert.equal(audit.financialSnapshots, 192);
assert.equal(audit.all48Complete, true);
assert.equal(audit.coverageComplete, true);
assert.deepEqual(audit.missingFamilies, []);
assert.deepEqual(audit.byGrade, {low: 16, medium: 16, severe: 16});
assert.equal(audit.requiredFamilies.length, 6);
assert.equal(audit.sourceBridge.oldUniqueRuns, 12);
assert.equal(audit.sourceBridge.newUniqueRuns, 36);
assert.equal(audit.sourceBridge.predepartureFailureNaturalRuns, 0);
assert.equal(audit.originalFirstInterruption.failedSegmentNotExtraSortie, true);
assert.equal(audit.originalFirstInterruption.uniqueDeparturesRepresented, 1);
assert.equal(audit.sourceAllStillMatch, true);
assert.equal(audit.sourceCount, 1398);
assert.equal(new Set(audit.rows.map(r => r.runId)).size, 48);
assert(audit.rows.every((r, i) => r.ordinal === i + 1 && r.grade === ['low', 'medium', 'severe'][i % 3]));
assert(audit.rows.every(r => ['death', 'extract'].includes(r.outcome)));
assert.deepEqual(audit.sourceBridge.subsequentSource, {file: rc.finalSource.path, sha256: rc.finalSource.sha256});
for (const r of [audit.tool, audit.accountingTool, audit.accounting, ...audit.references]) bind(r);
const accounting = read(audit.accounting.file);
assert.deepEqual(accounting.failures, []);
assert.equal(accounting.checked.trips, 48);
assert.equal(accounting.checked.snapshotFiles, 192);
assert.equal(accounting.checked.assertions, audit.conservationAssertions);
for (const [file, hash] of Object.entries(read(rc.finalSource.path).sources)) assert.equal(sha(file), hash, file);

const priorPath = base + 'qa-release-gates-occlusion.json';
assert.equal(sha(priorPath), '5ff3d45650e8f2ca8cb1189a298399bf072a4d502dde888004bf6bde445d34f0');
const prior = read(priorPath);
const recommendations = prior.recommendations.map(gate => {
  assert.equal(gate.releaseManifestHash, releaseHash);
  assert.equal(gate.revision, rc.revision);
  assert.equal(gate.status, 'pass');
  assert.equal(gate.purpose, 'release-gate');
  for (const e of gate.evidence) bind(e);
  return {...structuredClone(gate), priorRecommendation: ref(priorPath)};
});
assert.deepEqual(recommendations.map(g => g.gateId).sort(), ['R100-G-COVERAGE', 'R100-G-ECONOMY', 'R100-G-RECOVERY']);
const historicalRunPath = 'docs/qa/artifacts/r100-i13-continuation/qa-final-run-binding.json';
assert.equal(sha(historicalRunPath), '6d619a1bf6573f53a4338b6185959f9a54ae26329e9bc58d93201a81e357b460');
const expedition = {
  id: 'R100-E-I14-QA-EXPEDITION-48', purpose: 'release-gate', gateId: 'R100-G-EXPEDITION', kind: 'automated', status: 'pass',
  revision: rc.revision, releaseManifestHash: releaseHash,
  method: 'Independent whole-save adjacency, unique-run identity, actual grade/settlement, inventory conservation and explicit two-source bridge across four preregistered batches; retain the original I13 preparation and tool-effect evidence.',
  evidence: [ref(rcPath), ref(auditPath), ref(audit.accounting.file), ref(historicalRunPath), ref(base + 'qa-release-gate-recovery.json'), ref(base + 'qa-render-entry-review.json'), ref(rc.rootDeltaDisposition.path)],
  scope: '48 new continuous sorties from one actually earned A23 terminal: low/medium/severe16 each, all six material families naturally sampled, formal preparation/entry/search/return-or-death/base settlement and next departure preserved. First12 ran on1397 source; remaining36 ran on the explicitly qualified1398 exact-render-delta source.',
  results: {uniqueSorties: 48, rawFinancialSaves: 192, conservationAssertions: audit.conservationAssertions, byGrade: audit.byGrade, byFamily: audit.byFamily, outcomes: {extract: audit.rows.filter(r => r.outcome === 'extract').length, death: audit.totals.deaths, emptyExtracts: audit.totals.emptyReturns}, totals: audit.totals, terminal: audit.terminal},
  limits: [
    'One earned player lineage, not48 independent players. Natural identities were not rerolled; gameplay deaths/losses/empty returns remain in the denominator.',
    'The original first low strict-byte assertion and its same-run recovery count once. The v3 origin mismatch stopped before departure and adds zero natural runs. Diagnostic focus, render entry, performance and resource branches are excluded.',
    'This is the original I14 bounded stability/grade-selection sample, not a new profitability, exact-item refill, unlimited supply or all-world/all-seed gate.',
    'Only the first three natural sorties received the full pause/cold lifecycle insertion; later isolated new-source cold probes do not mean all48 were cold-restored.',
    'I13 preparation/tool-action success and failures retain their original scope and ancestry; current mature ancestral inventory is not newly earned supply.',
    'Automated route completion and accounting do not sign enjoyment, current overall ART, listening, fatigue, weaker hardware or user final acceptance.'
  ]
};
for (const e of expedition.evidence) bind(e);
recommendations.push(expedition);
const result = {
  schemaVersion: 1, createdAt: new Date().toISOString(), reviewer: 'qa',
  disposition: 'independent-four-bounded-pass-recommendations-after-complete48',
  tool: ref(import.meta.filename), release: {revision: rc.revision, path: rcPath, hash: releaseHash},
  priorThreeGateRecommendation: ref(priorPath), recommendations,
  remaining: [
    {gateId: 'R100-G-ART', status: 'pending', reason: 'Current overall visual/continuous experience and human judgment are not replaced by bounded exact-render/static evidence.'},
    {gateId: 'R100-G-RELEASE', status: 'pending', reason: 'Actual weaker hardware, real listening/fatigue and RC-bound user final acceptance still required.'}
  ],
  sourceAndEvidenceBindingsVerified: [...checked.values()], humanApproval: false, releaseApproval: false, ledgerModified: false
};
fs.writeFileSync(out, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({output: ref(out), gates: recommendations.map(r => r.gateId), uniqueSorties: 48, releaseHash}));
