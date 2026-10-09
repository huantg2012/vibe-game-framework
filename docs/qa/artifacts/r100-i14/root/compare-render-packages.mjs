/** Exact package dependency bridge; does not award gameplay or human qualification. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base = 'docs/qa/artifacts/r100-i14/actor-occlusion/';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = path => ({path, sha256: sha(path)});
const oldPath = 'docs/qa/artifacts/r100-i10-i12/final-packages/index.json';
const nextPath = base + 'packages/index.json';
const old = read(oldPath), next = read(nextPath);
assert.equal(next.worlds.length, 108);
assert.deepEqual(next.worlds.map(row => row.worldId), old.worlds.map(row => row.worldId));
const delta = read(base + 'delta-freeze.json');
const allowed = new Map(delta.delta.map(row => [row.path, row]));
assert.equal(allowed.size, 2);
const snapshot = read(delta.newSource.path), allDependencies = new Map(), worlds = [];
assert.equal(sha(delta.newSource.path), delta.newSource.sha256);
for (let index = 0; index < next.worlds.length; index++) {
  const previousRow = old.worlds[index], row = next.worlds[index];
  assert.deepEqual(row.grades, ['low', 'medium', 'severe']);
  assert.equal(sha(previousRow.dependencyManifest.path), previousRow.dependencyManifest.hash);
  assert.equal(sha(row.dependencyManifest.path), row.dependencyManifest.hash);
  const previous = read(previousRow.dependencyManifest.path), current = read(row.dependencyManifest.path);
  const {dependencies: previousDependencies, ...previousPayload} = previous;
  const {dependencies, ...currentPayload} = current;
  assert.deepEqual(currentPayload, previousPayload, `${row.worldId}: content changed`);
  const before = new Map(previousDependencies.map(entry => [entry.path, entry.sha256]));
  assert(dependencies.length === previousDependencies.length + 1);
  const changes = [];
  for (const dependency of dependencies) {
    const prior = before.get(dependency.path) ?? null;
    if (prior !== dependency.sha256) {
      assert.deepEqual(allowed.get(dependency.path), {path: dependency.path, before: prior, after: dependency.sha256});
      changes.push(dependency.path);
    }
    if (allDependencies.has(dependency.path)) assert.equal(allDependencies.get(dependency.path), dependency.sha256);
    allDependencies.set(dependency.path, dependency.sha256);
    before.delete(dependency.path);
  }
  assert.equal(before.size, 0, 'No dependency removed');
  assert.deepEqual(changes.sort(), [...allowed.keys()].sort());
  worlds.push({worldId: row.worldId, grades: row.grades, oldManifest: previousRow.dependencyManifest,
    newManifest: row.dependencyManifest, payloadEqual: true, changedDependencyPaths: changes});
}
for (const [file, expected] of allDependencies) {
  assert.equal(sha(file), expected, file);
  if (file !== 'package-lock.json') assert.equal(snapshot.sources[file], expected, `${file}: outside frozen source`);
}
const report = {status: 'passed-exact-package-delta', createdAt: new Date().toISOString(),
  scope: '108 complete world payloads and three grades remain exact; only the approved presentation dependency changes and one new cache dependency. This is source continuity, not new 108-world runtime or human review.',
  oldIndex: ref(oldPath), newIndex: ref(nextPath), source: delta.newSource,
  delta: ref(base + 'delta-freeze.json'), uniqueDependencies: allDependencies.size,
  packageLockOutsideSource: ref('package-lock.json'), worlds};
fs.writeFileSync(base + 'package-continuity.json', JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: report.status, worlds: worlds.length, dependencies: allDependencies.size}));
