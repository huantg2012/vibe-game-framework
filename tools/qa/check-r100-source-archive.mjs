import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createPlan, pack, readIndex, relativeName, restore, sha256, verify } from './r100-source-archive.mjs';

function fixture(fn) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'source-archive-test-')));
  const project = path.join(root, 'project'), archive = path.join(root, 'archive');
  fs.mkdirSync(project);
  const make = (id, text = id) => {
    const source = path.join(root, `source-${id}`);
    fs.mkdirSync(path.join(source, 'src'), { recursive: true });
    fs.writeFileSync(path.join(source, 'src/main.ts'), text);
    fs.writeFileSync(path.join(source, 'package.json'), '{"name":"frozen-fixture"}\n');
    fs.chmodSync(path.join(source, 'src/main.ts'), 0o755);
    fs.chmodSync(path.join(source, 'src'), 0o750);
    const sources = Object.fromEntries(['src/main.ts', 'package.json'].map(name => [name, sha256(fs.readFileSync(path.join(source, name)))]));
    const name = `evidence/${id}-source/source-snapshot.json`, manifest = { temporaryRoot: source, sources };
    fs.mkdirSync(path.dirname(path.join(project, name)), { recursive: true });
    fs.writeFileSync(path.join(project, name), JSON.stringify(manifest));
    return { source, name, manifest, hash: sha256(fs.readFileSync(path.join(project, name))) };
  };
  const one = make('one'), makePlan = (...rows) => createPlan({ project, manifests: rows.map(row => row.name) });
  try { fn({ root, project, archive, one, make, makePlan }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test('source-independent restore preserves bytes, relative tree, executable and directory modes', () => fixture(({ root, project, archive, one, makePlan }) => {
  pack({ project, archive, plan: makePlan(one) });
  fs.rmSync(one.source, { recursive: true });
  fs.rmSync(path.join(project, 'evidence'), { recursive: true });
  const result = restore({ archive, manifestSha256: one.hash, target: path.join(root, 'restored') });
  assert.equal(result.originalSourceRead, false); assert.equal(result.filesVerified, 2);
  assert.equal(fs.readFileSync(path.join(root, 'restored/src/main.ts'), 'utf8'), 'one');
  assert.equal(fs.statSync(path.join(root, 'restored/src/main.ts')).mode & 0o777, 0o755);
  assert.equal(fs.statSync(path.join(root, 'restored/src')).mode & 0o777, 0o750);
  const object = one.manifest.sources['src/main.ts'];
  assert.equal(fs.statSync(path.join(archive, `objects/sha256/${object.slice(0, 2)}/${object}`)).mode & 0o777, 0o444);
  assert.equal(verify({ archive, restoreAll: true }).restores.length, 1);
}));

test('incremental snapshots deduplicate bytes and preserve the previous index verbatim', () => fixture(({ project, archive, one, make, makePlan }) => {
  const first = pack({ project, archive, plan: makePlan(one) });
  const original = fs.readFileSync(path.join(archive, 'index.json'));
  const two = make('two');
  pack({ project, archive, plan: makePlan(one, two) });
  const index = readIndex(archive);
  assert.equal(index.parentIndexSha256, first.index.sha256);
  assert.deepEqual(fs.readFileSync(path.join(archive, first.index.path)), original);
  assert.equal(index.counts.snapshots, 2); assert.equal(index.counts.objects, 5); // 3 contents + 2 raw manifests.
  assert.equal(verify({ archive, restoreAll: true }).restores.length, 2);
}));

test('plan follows only provenance graph links, includes historical endpoints and pending final source', () => fixture(({ project, one, make }) => {
  const two = make('two');
  const ref = name => ({ path: name, sha256: sha256(fs.readFileSync(path.join(project, name))) });
  fs.writeFileSync(path.join(project, 'edge.json'), JSON.stringify({ before: ref(one.name), after: ref(two.name) }));
  fs.writeFileSync(path.join(project, 'binding.json'), JSON.stringify({ continuity: [ref('edge.json')], unrelated: { path: 'not-traversed.json', sha256: 'bad' }, finalSource: { path: 'future/source-snapshot.json', sha256: null } }));
  const plan = createPlan({ project, references: ['binding.json'], scanDirectories: ['evidence'] });
  assert.equal(plan.snapshots.length, 2); assert.equal(plan.references.length, 2); assert.equal(plan.pending.length, 1);
}));

test('reject changed bound provenance and changed source bytes', () => fixture(({ project, archive, one, makePlan }) => {
  fs.writeFileSync(path.join(project, 'binding.json'), JSON.stringify({ source: { path: one.name, sha256: '0'.repeat(64) } }));
  assert.throws(() => createPlan({ project, references: ['binding.json'] }), /changed/);
  const plan = makePlan(one); fs.writeFileSync(path.join(one.source, 'src/main.ts'), 'mutated');
  assert.throws(() => pack({ project, archive, plan }), /SHA mismatch/);
  assert(!fs.existsSync(path.join(archive, 'index.json')));
}));

test('reject traversal, absolute, drive, separator, control and noncanonical paths', () => {
  for (const name of ['../escape', 'src/../escape', '/tmp/escape', 'C:/escape', 'src\\escape', 'src//a', './a', 'src/\u0000x', '']) assert.throws(() => relativeName(name));
});

test('manifest path traversal fails closed before publishing', () => fixture(({ project, archive, one, makePlan }) => {
  one.manifest.sources['../escape'] = one.manifest.sources['src/main.ts'];
  fs.writeFileSync(path.join(project, one.name), JSON.stringify(one.manifest));
  assert.throws(() => pack({ project, archive, plan: makePlan(one) }), /Noncanonical/);
  assert(!fs.existsSync(path.join(archive, 'index.json')));
}));

test('refuse source symlink instead of archiving an external referent', () => fixture(({ project, archive, one, makePlan }) => {
  fs.unlinkSync(path.join(one.source, 'src/main.ts'));
  fs.symlinkSync('../package.json', path.join(one.source, 'src/main.ts'));
  assert.throws(() => pack({ project, archive, plan: makePlan(one) }), /Symlink/);
}));

test('refuse existing target, archive target and symlinked target parent', () => fixture(({ root, project, archive, one, makePlan }) => {
  pack({ project, archive, plan: makePlan(one) });
  assert.throws(() => restore({ archive, manifestSha256: one.hash, target: root }), /must not exist/);
  assert.throws(() => restore({ archive, manifestSha256: one.hash, target: path.join(archive, 'restored') }), /inside archive/);
  fs.symlinkSync(root, path.join(root, 'redirect'));
  assert.throws(() => restore({ archive, manifestSha256: one.hash, target: path.join(root, 'redirect/restored') }), /canonical/);
}));

test('truncated and corrupted content objects fail verification and restore', () => fixture(({ root, project, archive, one, makePlan }) => {
  pack({ project, archive, plan: makePlan(one) });
  const hash = one.manifest.sources['src/main.ts'], file = path.join(archive, `objects/sha256/${hash.slice(0, 2)}/${hash}`);
  fs.chmodSync(file, 0o644); fs.writeFileSync(file, '');
  assert.throws(() => verify({ archive }), /SHA mismatch/);
  assert.throws(() => restore({ archive, manifestSha256: one.hash, target: path.join(root, 'truncated') }), /SHA mismatch/);
  fs.writeFileSync(file, 'bad'); assert.throws(() => verify({ archive }), /SHA mismatch/);
}));

test('corrupted snapshot metadata, raw manifest and index fail closed', () => fixture(({ project, archive, one, makePlan }) => {
  pack({ project, archive, plan: makePlan(one) });
  const index = readIndex(archive), snapFile = path.join(archive, index.snapshots[0].path), saved = fs.readFileSync(snapFile);
  fs.writeFileSync(snapFile, '{}'); assert.throws(() => verify({ archive }), /SHA mismatch/); fs.writeFileSync(snapFile, saved);
  const rawFile = path.join(archive, `objects/sha256/${one.hash.slice(0, 2)}/${one.hash}`);
  fs.chmodSync(rawFile, 0o644); fs.writeFileSync(rawFile, '{}'); assert.throws(() => verify({ archive }), /SHA mismatch/);
  fs.writeFileSync(path.join(archive, 'index.json'), '{}'); assert.throws(() => readIndex(archive));
}));

test('object path symlinks are refused and not overwritten', () => fixture(({ root, project, archive, one, makePlan }) => {
  pack({ project, archive, plan: makePlan(one) });
  const hash = one.manifest.sources['src/main.ts'], file = path.join(archive, `objects/sha256/${hash.slice(0, 2)}/${hash}`), outside = path.join(root, 'outside');
  fs.writeFileSync(outside, 'one'); fs.unlinkSync(file); fs.symlinkSync(outside, file);
  assert.throws(() => verify({ archive }), /Symlink/); assert.equal(fs.readFileSync(outside, 'utf8'), 'one');
}));

test('an existing write lock prevents concurrent publication', () => fixture(({ project, archive, one, makePlan }) => {
  fs.mkdirSync(archive); fs.writeFileSync(path.join(archive, '.write-lock'), 'owned');
  assert.throws(() => pack({ project, archive, plan: makePlan(one) }), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(archive, '.write-lock'), 'utf8'), 'owned');
}));

test('conflicting file/directory paths cannot be archived', () => fixture(({ project, archive, one, makePlan }) => {
  one.manifest.sources.src = one.manifest.sources['src/main.ts'];
  fs.writeFileSync(path.join(project, one.name), JSON.stringify(one.manifest));
  assert.throws(() => pack({ project, archive, plan: makePlan(one) }), /Wrong file type/);
  assert(!fs.existsSync(path.join(archive, 'index.json')));
}));

test('metadata symlink cannot redirect publication outside archive', () => fixture(({ root, project, archive, one, makePlan }) => {
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside); fs.mkdirSync(archive);
  fs.symlinkSync(outside, path.join(archive, 'snapshots'));
  assert.throws(() => pack({ project, archive, plan: makePlan(one) }), /Metadata parents/);
  assert.equal(fs.readdirSync(outside).length, 0);
}));

test('resealed index cannot restore B while labelling it as requested manifest A', () => fixture(({ root, project, archive, one, make, makePlan }) => {
  const two = make('two'); pack({ project, archive, plan: makePlan(one, two) });
  const index = readIndex(archive), a = index.snapshots.find(ref => ref.manifestSha256 === one.hash), b = index.snapshots.find(ref => ref.manifestSha256 === two.hash);
  a.path = b.path; a.sha256 = b.sha256;
  const bytes = Buffer.from(JSON.stringify(index)); fs.writeFileSync(path.join(archive, 'index.json'), bytes);
  fs.writeFileSync(path.join(archive, `indexes/${sha256(bytes)}.json`), bytes);
  assert.throws(() => restore({ archive, manifestSha256: one.hash, target: path.join(root, 'wrong-source') }), /wrong source manifest/);
  assert(!fs.existsSync(path.join(root, 'wrong-source')));
}));

test('explicit alias requires an authority entry binding receipt and source together', () => fixture(({ project, one }) => {
  fs.writeFileSync(path.join(project, 'review.json'), JSON.stringify({ source: 'one-source/source-snapshot.json' }));
  const receipt = { path: 'review.json', sha256: sha256(fs.readFileSync(path.join(project, 'review.json'))) };
  const entry = { ...receipt, sourceManifest: one.name, sourceManifestSha256: one.hash };
  fs.writeFileSync(path.join(project, 'art.json'), JSON.stringify({ worlds: [{ evidence: [entry] }] }));
  const alias = { receipt, originalPath: 'one-source/source-snapshot.json', source: { path: one.name, sha256: one.hash },
    authority: { path: 'art.json', sha256: sha256(fs.readFileSync(path.join(project, 'art.json'))), jsonPointer: '/worlds/0/evidence/0' } };
  assert.throws(() => createPlan({ project, references: ['review.json'] }), /Unresolved/);
  const plan = createPlan({ project, references: ['review.json'], aliases: [alias] });
  assert.equal(plan.snapshots[0].sha256, one.hash); assert.equal(plan.aliasesApplied.length, 1);
  assert.throws(() => createPlan({ project, references: ['review.json'], aliases: [{ ...alias, source: { path: one.name, sha256: '0'.repeat(64) } }] }), /bind this exact/);
  assert.throws(() => createPlan({ project, aliases: [alias, { ...alias, source: { path: one.name, sha256: '0'.repeat(64) } }] }), /Conflicting/);
}));

test('document-relative source links resolve within the project without relaxing frozen file paths', () => fixture(({ project, one }) => {
  fs.mkdirSync(path.join(project, 'evidence/review'));
  fs.writeFileSync(path.join(project, 'evidence/review/record.json'), JSON.stringify({ source: { path: '../one-source/source-snapshot.json', sha256: one.hash } }));
  assert.equal(createPlan({ project, references: ['evidence/review/record.json'] }).snapshots[0].path, one.name);
}));

test('supplement preserves only the receipt-bound lock and remains independent of old snapshots', () => fixture(({ project, archive, one, makePlan }) => {
  const file = path.join(project, 'package-lock.json'); fs.writeFileSync(file, '{"lockfileVersion":3}');
  const hash = sha256(fs.readFileSync(file));
  fs.writeFileSync(path.join(project, 'qualification.json'), JSON.stringify({ dependencies: [{ path: 'package-lock.json', sha256: hash }] }));
  const authority = { path: 'qualification.json', sha256: sha256(fs.readFileSync(path.join(project, 'qualification.json'))), jsonPointer: '/dependencies/0' };
  const plan = makePlan(one); plan.supplements = [{ path: 'package-lock.json', sha256: hash, authority, scope: 'Only this qualification dependency, not unknown old environments.' }];
  pack({ project, archive, plan }); fs.rmSync(project, { recursive: true });
  const index = readIndex(archive); assert.equal(index.supplements.length, 1);
  assert.equal(index.snapshots[0].fileCount, 2); assert.equal(verify({ archive, restoreAll: true }).status, 'pass');
}));

test('supplement with a mismatched receipt binding refuses publication', () => fixture(({ project, archive, one, makePlan }) => {
  fs.writeFileSync(path.join(project, 'qualification.json'), JSON.stringify({ dependencies: [] }));
  const plan = makePlan(one); plan.supplements = [{ path: 'package-lock.json', sha256: '0'.repeat(64), authority: { path: 'qualification.json', sha256: sha256(fs.readFileSync(path.join(project, 'qualification.json'))), jsonPointer: '/dependencies/0' } }];
  assert.throws(() => pack({ project, archive, plan }), /not bound/);
  assert(!fs.existsSync(path.join(archive, 'index.json')));
}));

test('corrupt plan or missing parent revision invalidates the archive index', () => fixture(({ project, archive, one, make, makePlan }) => {
  const first = pack({ project, archive, plan: makePlan(one) }); const two = make('two');
  pack({ project, archive, plan: makePlan(two) });
  const index = readIndex(archive), plan = path.join(archive, index.plan.path), original = fs.readFileSync(plan);
  fs.writeFileSync(plan, '{}'); assert.throws(() => readIndex(archive), /SHA mismatch/); fs.writeFileSync(plan, original);
  fs.unlinkSync(path.join(archive, first.index.path)); assert.throws(() => readIndex(archive), /ENOENT/);
}));
