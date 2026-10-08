/** Dependency receipts from the final enabled snapshot; no qualification claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const base = 'docs/qa/artifacts/r100-i10-i12';
const manifest = `${base}/final-source/source-snapshot.json`;
const output = `${base}/final-packages`;
const compiler = 'tools/world-study/r100-qualification-manifests.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = file => ({path: file, sha256: sha(fs.readFileSync(path.join(root, file)))});
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const qualificationPath = `${base}/qualification-plan.json`;
const qualification = read(qualificationPath);
assert.equal(receipt(qualificationPath).sha256, 'd493aeb9d26b4758c90434c8c5a8cdfb74fb581800a2c37a50ae3b2eb91f0c25');
const worlds = [...qualification.baseline.worlds, ...qualification.batches.flatMap(batch => batch.worlds)];
assert.equal(worlds.length, 108); assert.equal(new Set(worlds).size, 108);
const source = read(manifest), sourceReceipt = receipt(manifest), compilerReceipt = receipt(compiler);
assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
const activationPath = `${base}/final-enable/report.json`, activation = read(activationPath);
assert.equal(activation.status, 'pass-enabled-only-recipe-compatibility');
assert.equal(activation.afterEnabled, 108); assert.equal(activation.all108GradeRecipesExact, 324);
for (const [file, hash] of Object.entries(activation.sourceHashesAfter)) assert.equal(source.sources[file], hash);
assert(!fs.existsSync(output), 'Final package directory must be fresh');
const executionPath = `${base}/final-enable/package-execution.json`;
assert(!fs.existsSync(executionPath));
const packageLock = fs.readFileSync(path.join(root, 'package-lock.json'));
assert.equal(sha(packageLock), '97189266199c56f2f04f5054f01620aa6b866f2e676450abbca415ed2f7cfe88');
const verifySource = () => {
  assert.deepEqual(receipt(manifest), sourceReceipt); assert.deepEqual(receipt(compiler), compilerReceipt);
  for (const [file, hash] of Object.entries(source.sources))
    assert.equal(sha(fs.readFileSync(path.join(source.temporaryRoot, file))), hash, file);
};
verifySource();
const {writeR100QualificationManifests} = await import(pathToFileURL(path.join(root, compiler)).href);
const temporaryView = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-r100-final108-packages-'));
try {
  for (const directory of ['src', 'data', 'public'])
    fs.symlinkSync(path.join(source.temporaryRoot, directory), path.join(temporaryView, directory), 'dir');
  fs.symlinkSync(path.join(root, 'docs'), path.join(temporaryView, 'docs'), 'dir');
  fs.writeFileSync(path.join(temporaryView, 'package-lock.json'), packageLock, {flag: 'wx'});
  process.chdir(temporaryView);
  const index = writeR100QualificationManifests({outputDirectory: output, immutable: true, worldIds: worlds});
  assert.deepEqual(index.map(row => row.worldId), worlds);
  for (const row of index) {
    const payload = JSON.parse(fs.readFileSync(row.dependencyManifest.path, 'utf8'));
    assert.equal(payload.algorithm.revision, 6); assert.equal(payload.worldId, row.worldId);
    assert.deepEqual(payload.grades.map(grade => grade.grade), ['low', 'medium', 'severe']);
  }
  process.chdir(root); verifySource();
  const report = {
    status: 'pass', source: sourceReceipt, sourceBeforeAndAfterExact: true,
    activation: receipt(activationPath), qualificationPlan: receipt(qualificationPath),
    packageLock: {path: 'package-lock.json', sha256: sha(packageLock), exactToCommit: qualification.baseRevision},
    compiler: compilerReceipt, runner: receipt(`${base}/final-enable/build-final-packages.mjs`),
    worlds, algorithmRevision: 6, index: receipt(`${output}/index.json`),
    method: 'Existing compiler reads only final frozen source/assets and baseline-exact package-lock through an isolated view. Dependency receipts confer no technical, art, gameplay or human qualification.',
  };
  fs.writeFileSync(executionPath, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({status: report.status, worlds: worlds.length, index: report.index}));
} finally {process.chdir(root); fs.rmSync(temporaryView, {recursive: true, force: true});}
