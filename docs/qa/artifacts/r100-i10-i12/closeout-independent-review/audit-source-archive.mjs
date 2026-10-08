/** Independent read-only audit. Deliberately does not import the archive implementation. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const root = process.cwd();
const base = 'docs/qa/artifacts/r100-i10-i12';
const archive = `${base}/source-archive`;
const output = process.argv[2];
assert(output && output.startsWith(`${base}/closeout-independent-review/`), 'Owned output required');
assert(!fs.existsSync(output), 'Never overwrite a prior audit');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = new Map();
function bytes(file, expected) {
  const data = fs.readFileSync(file), sha256 = digest(data);
  if (expected) assert.equal(sha256, expected, `Changed bytes: ${file}`);
  const relative = path.relative(root, path.resolve(file));
  inputs.set(relative, {path: relative, sha256});
  return data;
}
const json = (file, expected) => JSON.parse(bytes(file, expected));
const receipt = file => ({path: file, sha256: digest(fs.readFileSync(file))});
const indexPath = `${archive}/index.json`;
const indexBytes = bytes(indexPath);
const indexSha256 = digest(indexBytes), index = JSON.parse(indexBytes);
assert.equal(indexSha256, 'fc28c21561bcffbba8aeeaecf46327a9a83ca98140f7771c8dc0726f461b5676');
assert.deepEqual(bytes(`${archive}/indexes/${indexSha256}.json`, indexSha256), indexBytes);
assert.equal(index.parentIndexSha256, null);
json(`${archive}/${index.plan.path}`, index.plan.sha256);
const restorePath = `${archive}/initial-restore-verification.json`;
const restored = json(restorePath, '0741d1f42997b9029b0a0d1e35ac59f2d9ab811e84da0d9b8ea4e23308adb8eb');
assert.equal(restored.status, 'pass'); assert.equal(restored.indexSha256, indexSha256);
assert.equal(restored.restoreAll, true); assert.equal(restored.originalSourceRead, false); assert.equal(restored.serviceStarted, false);
assert.equal(index.snapshots.length, 35); assert.equal(restored.restores.length, 35);
assert.equal(new Set(index.snapshots.map(row => row.manifestSha256)).size, 35);
const objectSizes = new Map();
function object(sha256, size) {
  assert(/^[a-f0-9]{64}$/.test(sha256));
  const file = `${archive}/objects/sha256/${sha256.slice(0, 2)}/${sha256}`;
  let at = archive;
  for (const part of file.slice(archive.length + 1).split('/')) {
    at += `/${part}`; assert(!fs.lstatSync(at).isSymbolicLink(), `Symlink: ${at}`);
  }
  if (!objectSizes.has(sha256)) {
    const raw = fs.readFileSync(file); assert.equal(digest(raw), sha256, `Bad content object: ${file}`);
    objectSizes.set(sha256, raw.length);
  }
  if (size !== undefined) assert.equal(objectSizes.get(sha256), size);
  return file;
}
let fileEntries = 0, expandedFileBytes = 0;
const sources = [];
for (const ref of index.snapshots) {
  const snapshot = json(`${archive}/${ref.path}`, ref.sha256);
  assert.equal(snapshot.manifest.sha256, ref.manifestSha256);
  assert.equal(snapshot.manifestObject, ref.manifestSha256);
  const manifest = JSON.parse(fs.readFileSync(object(ref.manifestSha256)));
  assert.equal(manifest.temporaryRoot, snapshot.originalTemporaryRoot);
  assert.equal(snapshot.files.length, ref.fileCount);
  assert.deepEqual(snapshot.files.map(row => row.path).sort(), Object.keys(manifest.sources).sort());
  assert.equal(new Set(snapshot.files.map(row => row.path)).size, snapshot.files.length);
  const directoryNames = new Set(snapshot.directories.map(row => row.path));
  let sourceBytes = 0;
  for (const row of snapshot.files) {
    assert(!path.isAbsolute(row.path) && !row.path.includes('\\') && row.path.split('/').every(p => p && p !== '.' && p !== '..'));
    assert.equal(manifest.sources[row.path], row.sha256); object(row.sha256, row.size);
    assert(Number.isInteger(row.mode) && row.mode >= 0 && row.mode <= 0o777);
    let parent = path.posix.dirname(row.path);
    while (parent !== '.') {assert(directoryNames.has(parent)); parent = path.posix.dirname(parent);}
    sourceBytes += row.size;
  }
  for (const manifestPath of ref.manifestPaths) bytes(manifestPath, ref.manifestSha256);
  const rows = restored.restores.filter(row => row.manifestSha256 === ref.manifestSha256);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.status, 'pass'); assert.deepEqual(row.snapshot, ref);
  assert.equal(row.filesVerified, snapshot.files.length); assert.equal(row.bytesVerified, sourceBytes);
  for (const flag of ['modesVerified', 'verifiedTemporaryTreeRemoved']) assert.equal(row[flag], true);
  assert.equal(row.originalSourceRead, false); assert.equal(row.serviceStarted, false);
  fileEntries += snapshot.files.length; expandedFileBytes += sourceBytes;
  sources.push({manifestSha256: ref.manifestSha256, manifestPaths: ref.manifestPaths, fileCount: snapshot.files.length,
    originalTemporaryRoot: manifest.temporaryRoot, snapshot: {path: `${archive}/${ref.path}`, sha256: ref.sha256},
    hasLockInOriginalManifest: Object.hasOwn(manifest.sources, 'package-lock.json'),
    hasQaExecutorInOriginalManifest: Object.keys(manifest.sources).some(name => name.startsWith('tools/'))});
}
for (const supplement of index.supplements) {
  object(supplement.sha256, supplement.size);
  const authority = JSON.parse(fs.readFileSync(object(supplement.authority.sha256)));
  const value = supplement.authority.jsonPointer.slice(1).split('/').reduce((value, token) => value[token.replace(/~1/g, '/').replace(/~0/g, '~')], authority);
  assert.deepEqual({path:value.path,sha256:value.sha256}, {path:supplement.path,sha256:supplement.sha256});
}
const counts = {snapshots: sources.length, fileEntries, objects: objectSizes.size, objectBytes: [...objectSizes.values()].reduce((a,b)=>a+b,0)};
assert.deepEqual(counts, index.counts); assert.deepEqual(counts, restored.counts);

const historicalPlan = json('docs/qa/artifacts/r100-i07-i09/final-binding/plan.json');
const historicalGeneration = json(historicalPlan.generation.path, historicalPlan.generation.sha256);
const externalHistoricalTools = [];
for (const source of historicalPlan.generationSources) {
  const manifest = json(source.path, source.sha256);
  const group = historicalGeneration.groups.find(row => row.id === source.groupId); assert(group);
  for (const dependency of group.dependencies.filter(row => row.path.startsWith('tools/'))) {
    const file = path.join(manifest.temporaryRoot, dependency.path);
    const exists = fs.existsSync(file);
    const actual = exists ? digest(fs.readFileSync(file)) : null;
    externalHistoricalTools.push({groupId:source.groupId, source:{path:source.path,sha256:source.sha256},
      path:dependency.path, expectedSha256:dependency.sha256, currentTemporaryFile:file, currentExists:exists,
      currentSha256:actual, exactCurrentBytes:actual === dependency.sha256,
      includedInSourceArchive:Object.hasOwn(manifest.sources, dependency.path)});
  }
}
const checks = {
  originalIndexAndReceiptShaExact: true, sourceIdentityMatchesOriginalManifest: true,
  originalManifestsStillExact: true, allStoredObjectHashesVerified: true, previousRestoreRowsConsistent: true,
  priorRestoreExpandedFileBytes: expandedFileBytes, restoreRerunByThisAudit: false,
  originalSourceTreesRead: false, historicalTemporaryQaFilesRead: true, serviceStarted: false,
};
const report = {schemaVersion:1,status:'pass-independent-archive-content-and-existing-restore-audit',
  createdAt:new Date().toISOString(),reviewer:'i12_qa',featureIds:['COH-F052','COH-F044','COH-F005'],
  archiveIndex:{path:`${archive}/indexes/${indexSha256}.json`,sha256:indexSha256},previousRestore:receipt(restorePath),
  counts,checks,sources,externalHistoricalTools,
  limitations:[
    'This audit hashes every stored object and independently reconciles source identity and the existing 35 restore receipts. It does not rerun the 6.29 GB filesystem restoration.',
    'Original manifests exclude node_modules, browser/OS, QA executors and package-lock. The receipt-bound lock is an explicit supplement and is not backfilled into original source identity.',
    'The final binder still reads historical tools from original temporary roots. Their verified bytes are reported separately; the source-only archive alone cannot reconstruct that binder input.',
    'Final enabled108 source and its incremental archive are not yet present in this initial 35-source audit. No game, art, performance or closure pass is assigned.',
  ],inputs:[...inputs.values()].sort((a,b)=>a.path.localeCompare(b.path))};
fs.mkdirSync(path.dirname(output),{recursive:true}); fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:report.status,counts,checks,externalHistoricalTools:externalHistoricalTools.length,
  externalToolsMissing:externalHistoricalTools.filter(row=>!row.exactCurrentBytes).length,report:receipt(output)},null,2));
