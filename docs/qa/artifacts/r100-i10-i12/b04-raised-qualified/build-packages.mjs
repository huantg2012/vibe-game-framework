/** Dependency receipts only, built from the exact frozen browser source. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const output = 'docs/qa/artifacts/r100-i10-i12/b04-raised-qualified';
const manifest = 'docs/qa/artifacts/r100-i10-i12/b04-buried-raised-source/source-snapshot.json';
const compiler = 'tools/world-study/r100-qualification-manifests.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const receipt = file => ({ path: file, sha256: sha(fs.readFileSync(path.join(root, file))) });
const source = JSON.parse(fs.readFileSync(manifest, 'utf8'));
const sourceReceipt = receipt(manifest), compilerReceipt = receipt(compiler);
assert.equal(sourceReceipt.sha256, 'f7c0302cba8c86b82dd972731205e1db1e193380f6c98fd9727202127f69e94d');
assert.equal(source.verifiedCopyHashes, true); assert.deepEqual(source.patches, []);
assert(!fs.existsSync(`${output}/packages`)); assert(!fs.existsSync(`${output}/package-execution.json`));
const packageLock = fs.readFileSync('package-lock.json');
assert.equal(sha(packageLock), '97189266199c56f2f04f5054f01620aa6b866f2e676450abbca415ed2f7cfe88');
const verifySource = () => {
  assert.deepEqual(receipt(manifest), sourceReceipt); assert.deepEqual(receipt(compiler), compilerReceipt);
  for (const [file, hash] of Object.entries(source.sources))
    assert.equal(sha(fs.readFileSync(path.join(source.temporaryRoot, file))), hash, file);
};
verifySource();
const { writeR100QualificationManifests } = await import(pathToFileURL(path.join(root, compiler)).href);
const temporaryView = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-r100-b04-packages-'));
const worlds = ['fibre-choke', 'buried-lamellae', 'pressed-rim', 'wedged-hide'];
try {
  for (const directory of ['src', 'data', 'public']) fs.symlinkSync(path.join(source.temporaryRoot, directory), path.join(temporaryView, directory), 'dir');
  fs.symlinkSync(path.join(root, 'docs'), path.join(temporaryView, 'docs'), 'dir');
  fs.writeFileSync(path.join(temporaryView, 'package-lock.json'), packageLock, { flag: 'wx' });
  process.chdir(temporaryView);
  const index = writeR100QualificationManifests({ outputDirectory: `${output}/packages`, immutable: true, worldIds: worlds });
  assert.equal(index.length, 4);
  for (const row of index) {
    const payload = JSON.parse(fs.readFileSync(row.dependencyManifest.path, 'utf8'));
    assert.equal(payload.algorithm.revision, 6); assert.equal(payload.worldId, row.worldId);
    assert.deepEqual(payload.grades.map(grade => grade.grade), ['low', 'medium', 'severe']);
  }
  process.chdir(root); verifySource();
  const report = { status: 'pass', source: sourceReceipt, sourceBeforeAndAfterExact: true,
    packageLock: { path: 'package-lock.json', sha256: sha(packageLock), exactToCommit: 'd194be4cb8f89f37d4ba7f05d17e16f9bed055ee' },
    compiler: compilerReceipt, runner: receipt(`${output}/build-packages.mjs`), worlds, algorithmRevision: 6,
    index: receipt(`${output}/packages/index.json`),
    method: 'Existing compiler reads an isolated view of frozen3110 source/assets and baseline-exact package-lock. Mutable workspace catalog is not read. These manifests confer no qualification.' };
  fs.writeFileSync(`${output}/package-execution.json`, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
} finally { process.chdir(root); fs.rmSync(temporaryView, { recursive: true, force: true }); }
