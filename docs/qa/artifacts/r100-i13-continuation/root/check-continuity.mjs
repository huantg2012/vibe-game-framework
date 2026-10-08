import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const folder = path.join(root, 'docs/qa/artifacts/r100-i13-continuation');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const currentPath = path.join(folder, 'frozen-source/source-snapshot.json');
const originalPath = path.join(root, 'docs/qa/artifacts/r100-i13/frozen-source/source-snapshot.json');
const current = read(currentPath), original = read(originalPath);
const errors = [];
for (const [file, expected] of Object.entries(original.sources)) {
  if (current.sources[file] !== expected) errors.push(`Frozen production changed: ${file}`);
  if (hash(path.join(root, file)) !== expected) errors.push(`Working production changed: ${file}`);
}
assert.deepEqual(Object.keys(current.sources).sort(), Object.keys(original.sources).sort());
const immutablePath = path.join(folder, 'root/original-artifacts.json');
const immutable = read(immutablePath);
for (const file of immutable.files) {
  if (hash(path.join(root, file.path)) !== file.sha256) errors.push(`Prior artifact changed: ${file.path}`);
}
const freezePath = path.join(folder, 'policy-freeze.json');
const freeze = read(freezePath);
const preservedTask = path.join(folder, 'root/task-preregistration.md');
assert.equal(hash(preservedTask), freeze.taskContract.sha256);
const report = {
  checkedAt: new Date().toISOString(), status: errors.length ? 'failed' : 'pass',
  productionFiles: Object.keys(current.sources).length,
  preservedPriorArtifacts: immutable.files.length,
  frozenTaskSha256: hash(preservedTask),
  inputs: [currentPath, originalPath, immutablePath, freezePath].map(file => ({
    path: path.relative(root, file), sha256: hash(file),
  })), errors,
  limitations: 'Byte continuity and historical preservation only; no runtime, economy, or human-experience acceptance is implied.',
};
fs.writeFileSync(path.join(folder, 'root/continuity.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({status: report.status, productionFiles: report.productionFiles, preservedPriorArtifacts: report.preservedPriorArtifacts}));
assert.deepEqual(errors, []);
