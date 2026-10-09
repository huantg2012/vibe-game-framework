import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { checkPlan } from '../../../../tools/world-study/r100-progress.mjs';

const base = 'docs/qa/artifacts/r100-i14/';
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file));
const ref = path => ({ path, sha256: sha(path) });
const checked = new Map();
function verify(row) {
  assert.equal(sha(row.path), row.sha256 ?? row.hash, `Source reference changed: ${row.path}`);
  const previous = checked.get(row.path);
  assert.ok(!previous || previous === (row.sha256 ?? row.hash), `Conflicting hash: ${row.path}`);
  checked.set(row.path, row.sha256 ?? row.hash);
}
function refs(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.path === 'string' && /^[a-f0-9]{64}$/.test(value.sha256 ?? value.hash ?? '')) verify(value);
  for (const child of Object.values(value)) refs(child);
}
const ledgerPath = 'docs/progress/rift-r100.json';
const ledger = read(ledgerPath), release = ledger.version.releaseManifest;
verify(release);
const rc = read(release.path);
assert.equal(rc.revision, release.revision);
refs(rc);
const snapshot = read(rc.finalSource.path);
assert.equal(Object.keys(snapshot.sources).length, 1397);
for (const [path, sha256] of Object.entries(snapshot.sources)) verify({ path, sha256 });
const packages = read(rc.packages.path), dependencies = new Map();
assert.equal(packages.worlds.length, 108);
for (const world of packages.worlds) {
  verify(world.dependencyManifest);
  const pack = read(world.dependencyManifest.path);
  assert.equal(pack.worldId, world.worldId);
  assert.deepEqual(pack.grades.map(row => row.grade).sort(), ['low', 'medium', 'severe']);
  for (const row of pack.dependencies) {
    verify(row);
    assert.ok(!dependencies.has(row.path) || dependencies.get(row.path) === row.sha256);
    dependencies.set(row.path, row.sha256);
  }
}
assert.equal(dependencies.size, 307);
const outside = [...dependencies.keys()].filter(path => !Object.hasOwn(snapshot.sources, path));
assert.deepEqual(outside, ['package-lock.json']);
const finalPlan = read(rc.finalPlan.path);
refs(finalPlan);
const technical = read(rc.rootTechnical.path);
refs(technical);
const closurePath = 'docs/qa/artifacts/r100-i13-continuation/root/closure-disposition.json';
const closure = read(closurePath);
assert.equal(closure.result, 'bounded-internal-pass');
assert.equal(closure.productionChanged, false);
refs(closure);
assert.equal(closure.counts.uniqueActualRuns, 52);
assert.equal(closure.counts.financialSnapshots, 208);
assert.equal(closure.counts.accountingAssertions, 29638);
const planCheck = checkPlan(ledger);
assert.equal(planCheck.ok, true, planCheck.errors?.join('\n'));
assert.equal(planCheck.counts.qualified, 108);
assert.equal(planCheck.counts.production, 108);
assert.equal(planCheck.counts.qualifiedGradeCases, 324);
assert.equal(planCheck.counts.productionGradeCases, 324);
const report = {
  date: '2026-10-09', status: 'current-source-and-historical-evidence-binding-pass', reviewer: 'qa',
  tool: ref(`${base}qa-source-inheritance.mjs`), ledgerAtCheck: ref(ledgerPath), releaseManifest: ref(release.path),
  releaseRevision: rc.revision, sourceSnapshot: rc.finalSource, packages: rc.packages,
  currentProductionHashes: 1397, packageManifests: 108, uniquePackageDependencies: 307,
  dependenciesOutsideSourceSnapshot: outside, boundFiles: [...checked].map(([path, sha256]) => ({ path, sha256 })),
  currentCounts: planCheck.counts, i13Closure: ref(closurePath), i13Counts: closure.counts,
  candidateInheritedGates: ['R100-G-COVERAGE', 'R100-G-ECONOMY'],
  pendingAdditionalRuntimeGates: ['R100-G-EXPEDITION', 'R100-G-RECOVERY'],
  pendingActualHumanAndDeviceGates: ['R100-G-ART', 'R100-G-RELEASE'],
  limits: [
    'SHA continuity and existing qualified ledger counts inherit the cited historical scope, not new execution.',
    'No game, build, browser, source extraction or accounting assertion suite was rerun by this source audit.',
    'Original74 complete/1 interrupted/33 unstarted performance cases and sampled lifecycle limits remain.',
    'I13 bounded economics does not imply heavy profit superiority, infinite supply, B recipe recovery or ancestral items being newly earned.',
    'No current Chrome155 runtime, real weaker hardware, actual listening or final user acceptance is signed here.',
  ],
};
fs.writeFileSync(`${base}qa-source-inheritance.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, source: 1397, packages: 108, dependencies: 307, boundFiles: checked.size, counts: planCheck.counts }));
