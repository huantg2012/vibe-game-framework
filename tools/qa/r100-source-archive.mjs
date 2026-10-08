/** Content-addressed preservation of immutable QA source manifests. No game/runtime imports. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const VERSION = 1;
const SHA = /^[a-f0-9]{64}$/;
const FOLLOW = new Set(['continuity', 'sourceContinuity', 'historicalBinding', 'inheritance', 'candidate', 'art',
  'receipt', 'evidence', 'authorEvidence', 'rootEvidence', 'historicalEvidence', 'historicalManifest', 'historicalArt', 'historicalRuntimeEquivalence']);
const jsonBytes = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const ordered = rows => rows.sort((a, b) => a.path.localeCompare(b.path));
function pointerValue(document, pointer) {
  assert(typeof pointer === 'string' && pointer.startsWith('/'), 'Expected an explicit JSON pointer');
  return pointer.slice(1).split('/').reduce((value, token) => value?.[token.replace(/~1/g, '/').replace(/~0/g, '~')], document);
}

export function relativeName(value) {
  assert(typeof value === 'string' && value.length > 0, 'Empty relative path');
  assert(!path.posix.isAbsolute(value) && !value.includes('\\') && !/[\x00-\x1f]/.test(value), `Unsafe path: ${value}`);
  assert(value.split('/').every(part => part && part !== '.' && part !== '..'), `Noncanonical path: ${value}`);
  assert(!/^[A-Za-z]:/.test(value), `Drive path: ${value}`);
  return value;
}

function regularFile(root, name) {
  relativeName(name);
  let cursor = root;
  const parts = name.split('/');
  for (let i = 0; i < parts.length; i++) {
    cursor = path.join(cursor, parts[i]);
    const info = fs.lstatSync(cursor);
    assert(!info.isSymbolicLink(), `Symlink is not archived/restored: ${cursor}`);
    assert(i === parts.length - 1 ? info.isFile() : info.isDirectory(), `Wrong file type: ${cursor}`);
  }
  return cursor;
}

function checkedBytes(file, expected) {
  assert(SHA.test(expected), `Invalid SHA: ${expected}`);
  const bytes = fs.readFileSync(file);
  assert.equal(sha256(bytes), expected, `SHA mismatch: ${file}`);
  return bytes;
}

function writeNew(file, bytes, mode = 0o644) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, bytes, { flag: 'wx', mode });
}

function archiveRoot(folder) {
  fs.mkdirSync(folder, { recursive: true });
  assert(!fs.lstatSync(folder).isSymbolicLink(), 'Archive root cannot be a symlink');
  return fs.realpathSync(folder);
}

function objectName(hash) {
  assert(SHA.test(hash));
  return `objects/sha256/${hash.slice(0, 2)}/${hash}`;
}

function putObject(root, bytes) {
  const hash = sha256(bytes), name = objectName(hash), dest = path.join(root, name);
  if (fs.existsSync(dest)) checkedBytes(regularFile(root, name), hash);
  else {
    const parent = path.dirname(dest);
    fs.mkdirSync(parent, { recursive: true });
    assert.equal(fs.realpathSync(parent), parent, 'Object parents cannot be symlinks');
    writeNew(dest, bytes, 0o444);
  }
  return hash;
}

function publishJson(root, directory, value) {
  const bytes = jsonBytes(value), hash = sha256(bytes), name = `${directory}/${hash}.json`;
  const dest = path.join(root, name);
  if (fs.existsSync(dest)) checkedBytes(regularFile(root, name), hash);
  else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    assert.equal(fs.realpathSync(path.dirname(dest)), path.dirname(dest), 'Metadata parents cannot be symlinks');
    writeNew(dest, bytes);
  }
  return { path: name, sha256: hash };
}

/** Only selected provenance graph keys recurse; arbitrary journey reports are never crawled. */
export function createPlan({ project, references = [], manifests = [], scanDirectories = [], aliases = [], supplements = [] }) {
  project = fs.realpathSync(project);
  const selected = new Map(), seen = new Set(), readReferences = [], pending = [], aliasesApplied = [], aliasKeys = new Map();
  for (const alias of aliases) {
    const key = `${alias.receipt.path}\0${alias.originalPath}`;
    const identity = `${alias.source.path}\0${alias.source.sha256}`;
    assert(!aliasKeys.has(key) || aliasKeys.get(key) === identity, 'Conflicting explicit source aliases'); aliasKeys.set(key, identity);
    const authority = JSON.parse(checkedBytes(regularFile(project, alias.authority.path), alias.authority.sha256));
    const entry = pointerValue(authority, alias.authority.jsonPointer);
    assert(entry && entry.path === alias.receipt.path && entry.sha256 === alias.receipt.sha256
      && entry.sourceManifest === alias.source.path && entry.sourceManifestSha256 === alias.source.sha256, 'Alias authority must bind this exact receipt and source together');
    checkedBytes(regularFile(project, alias.receipt.path), alias.receipt.sha256);
    checkedBytes(regularFile(project, alias.source.path), alias.source.sha256);
  }
  // A receipt may link ../sibling/source-snapshot.json; resolve that document link
  // inside the project. Frozen *file entry names* always remain strict/nonrelative.
  const link = (name, from) => relativeName(name.startsWith('./') || name.startsWith('../')
    ? path.posix.normalize(path.posix.join(path.posix.dirname(from), name)) : name);
  const sourceLink = (name, from, expected) => {
    const canonical = link(name, from);
    if (fs.existsSync(path.join(project, canonical))) return { name: canonical, expected };
    const alias = aliases.find(item => item.receipt.path === from && item.originalPath === name);
    if (!alias) return { name: canonical, expected };
    if (expected != null) assert.equal(expected, alias.source.sha256, 'Alias disagrees with inline source SHA');
    if (!aliasesApplied.includes(alias)) aliasesApplied.push(alias);
    return { name: alias.source.path, expected: alias.source.sha256 };
  };
  const add = (name, expected, reason) => {
    name = relativeName(name);
    const file = path.join(project, name);
    if (!fs.existsSync(file)) {
      assert(expected == null, `Missing bound source: ${name}`);
      pending.push({ path: name, reason });
      return;
    }
    const bytes = fs.readFileSync(regularFile(project, name)), actual = sha256(bytes);
    if (expected != null) assert.equal(actual, expected, `Referenced source changed: ${name}`);
    const doc = JSON.parse(bytes);
    assert(doc.temporaryRoot && doc.sources && !Array.isArray(doc.sources), `Not a frozen QA source manifest: ${name}`);
    const old = selected.get(name);
    if (old) { assert.equal(old.sha256, actual); old.reasons.add(reason); }
    else selected.set(name, { path: name, sha256: actual, temporaryRoot: doc.temporaryRoot, fileCount: Object.keys(doc.sources).length, reasons: new Set([reason]) });
  };
  const visit = (name, expected = null) => {
    name = relativeName(name);
    const file = path.join(project, name);
    if (!fs.existsSync(file)) {
      assert(expected == null, `Missing bound reference: ${name}`);
      pending.push({ path: name, reason: 'future provenance reference' }); return;
    }
    const bytes = fs.readFileSync(regularFile(project, name)), hash = sha256(bytes);
    if (expected != null) assert.equal(hash, expected, `Provenance reference changed: ${name}`);
    if (seen.has(name)) return;
    seen.add(name); readReferences.push({ path: name, sha256: hash });
    const walk = (value, key = '') => {
      if (Array.isArray(value)) { for (const child of value) walk(child, key); return; }
      if (!value || typeof value !== 'object') return;
      for (const [k, v] of Object.entries(value)) {
        if (typeof v === 'string' && v.endsWith('/source-snapshot.json') && !path.isAbsolute(v)) {
          const expectedHash = k === 'path' ? value.sha256 : value[`${k}Sha256`];
          const resolved = sourceLink(v, name, expectedHash);
          // Only explicit null marks future/unbound source. An unresolvable old
          // receipt string with no SHA is a gap, never silently a future item.
          assert(fs.existsSync(path.join(project, resolved.name)) || resolved.expected === null, `Unresolved source reference: ${name} -> ${v}`);
          add(resolved.name, resolved.expected, `${name}#${k}`);
        }
      }
      if (FOLLOW.has(key) && typeof value.path === 'string' && value.path.endsWith('.json') && !value.path.endsWith('/source-snapshot.json')) visit(link(value.path, name), value.sha256);
      for (const [k, v] of Object.entries(value)) walk(v, k);
    };
    walk(JSON.parse(bytes));
  };
  for (const directory of scanDirectories) {
    const dir = path.join(project, relativeName(directory));
    for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
      if (child.isDirectory() && child.name.includes('source')) {
        const name = `${directory}/${child.name}/source-snapshot.json`;
        if (fs.existsSync(path.join(project, name))) add(name, null, `top-level source scan: ${directory}`);
      }
    }
  }
  for (const name of manifests) add(name, null, 'explicit manifest');
  for (const name of references) visit(name);
  assert(selected.size > 0, 'No source manifests discovered');
  return { schemaVersion: VERSION, status: 'planned-not-archived', createdAt: new Date().toISOString(), project,
    scope: 'Original manifest-declared source files and required directory modes. External node_modules, caches, OS/browser binaries and unlisted QA executors are not frozen by these manifests and are not claimed as preserved runtime dependencies.',
    references: ordered(readReferences), pending, aliasesApplied, supplements,
    snapshots: ordered([...selected.values()].map(v => ({ ...v, reasons: [...v.reasons].sort() }))) };
}

function validateSupplement(root, item) {
  const bytes = checkedBytes(regularFile(root, objectName(item.sha256)), item.sha256);
  assert.equal(bytes.length, item.size);
  const authority = JSON.parse(checkedBytes(regularFile(root, objectName(item.authority.sha256)), item.authority.sha256));
  const bound = pointerValue(authority, item.authority.jsonPointer);
  assert(bound?.path === item.path && bound.sha256 === item.sha256, 'Supplement is not bound by its authority');
  return bytes;
}

function validateSnapshot(root, ref) {
  const snapshot = JSON.parse(checkedBytes(regularFile(root, ref.path), ref.sha256));
  assert.equal(snapshot.schemaVersion, VERSION);
  assert.equal(ref.manifestSha256, snapshot.manifest.sha256, 'Snapshot mapped to the wrong source manifest');
  assert.equal(ref.fileCount, snapshot.files.length, 'Snapshot file count differs from index');
  const manifest = JSON.parse(checkedBytes(regularFile(root, objectName(snapshot.manifest.sha256)), snapshot.manifest.sha256));
  assert.equal(snapshot.manifest.sha256, snapshot.manifestObject);
  assert.equal(manifest.temporaryRoot, snapshot.originalTemporaryRoot);
  assert.equal(snapshot.files.length, Object.keys(manifest.sources).length);
  const names = new Set();
  for (const entry of snapshot.files) {
    relativeName(entry.path); assert(!names.has(entry.path), 'Duplicate file'); names.add(entry.path);
    assert.equal(manifest.sources[entry.path], entry.sha256, `Snapshot differs from original manifest: ${entry.path}`);
    assert(Number.isSafeInteger(entry.size) && entry.size >= 0);
    assert(Number.isInteger(entry.mode) && entry.mode >= 0 && entry.mode <= 0o777, 'Invalid file mode');
  }
  const directories = new Set();
  for (const entry of snapshot.directories) {
    relativeName(entry.path); assert(!names.has(entry.path) && !directories.has(entry.path), 'Path type/duplicate directory conflict'); directories.add(entry.path);
    assert(Number.isInteger(entry.mode) && entry.mode >= 0 && entry.mode <= 0o777, 'Invalid directory mode');
  }
  for (const name of [...names, ...directories]) {
    let parent = path.posix.dirname(name);
    while (parent !== '.') { assert(directories.has(parent), `Missing directory metadata: ${parent}`); parent = path.posix.dirname(parent); }
  }
  return snapshot;
}

export function pack({ project, archive, plan }) {
  assert.equal(plan.schemaVersion, VERSION);
  const root = archiveRoot(archive), lock = path.join(root, '.write-lock');
  const lockFd = fs.openSync(lock, 'wx');
  try {
    const oldIndex = fs.existsSync(path.join(root, 'index.json')) ? readIndex(root) : null;
    const all = new Map((oldIndex?.snapshots ?? []).map(ref => [ref.manifestSha256, ref]));
    const supplements = new Map((oldIndex?.supplements ?? []).map(item => [`${item.path}:${item.sha256}`, item]));
    for (const item of plan.supplements ?? []) {
      const authorityBytes = checkedBytes(regularFile(project, item.authority.path), item.authority.sha256);
      const bound = pointerValue(JSON.parse(authorityBytes), item.authority.jsonPointer);
      assert(bound?.path === item.path && bound.sha256 === item.sha256, 'Supplement is not bound by its authority');
      const file = regularFile(project, item.path), bytes = checkedBytes(file, item.sha256);
      putObject(root, authorityBytes); putObject(root, bytes);
      supplements.set(`${item.path}:${item.sha256}`, { ...item, size: bytes.length, mode: fs.statSync(file).mode & 0o777 });
    }
    for (const ref of oldIndex?.snapshots ?? []) validateSnapshot(root, ref);
    for (const item of plan.snapshots) {
      const bytes = checkedBytes(regularFile(project, item.path), item.sha256), manifest = JSON.parse(bytes);
      assert.equal(manifest.temporaryRoot, item.temporaryRoot);
      assert.equal(Object.keys(manifest.sources).length, item.fileCount);
      if (all.has(item.sha256)) {
        const existing = all.get(item.sha256);
        existing.manifestPaths = [...new Set([...existing.manifestPaths, item.path])].sort();
        continue;
      }
      const sourceRoot = fs.realpathSync(manifest.temporaryRoot), files = [], dirs = new Map();
      for (const [name, expected] of Object.entries(manifest.sources).sort(([a], [b]) => a.localeCompare(b))) {
        const sourceFile = regularFile(sourceRoot, name), before = fs.statSync(sourceFile);
        assert.equal(before.mode & 0o7000, 0, `Special permission bits are not supported: ${name}`);
        const content = checkedBytes(sourceFile, expected), after = fs.statSync(sourceFile);
        assert.equal(before.size, after.size); assert.equal(before.mtimeMs, after.mtimeMs, `Source changed during read: ${name}`);
        assert.equal(content.length, before.size);
        putObject(root, content);
        files.push({ path: name, sha256: expected, size: content.length, mode: before.mode & 0o777 });
        let parent = path.posix.dirname(name);
        while (parent !== '.') {
          if (!dirs.has(parent)) dirs.set(parent, { path: parent, mode: fs.statSync(path.join(sourceRoot, parent)).mode & 0o777 });
          parent = path.posix.dirname(parent);
        }
      }
      // Detect mutation of the manifest itself while its tree was being read.
      checkedBytes(regularFile(project, item.path), item.sha256);
      const snapshot = { schemaVersion: VERSION, manifest: { path: item.path, sha256: item.sha256 }, manifestObject: putObject(root, bytes), originalTemporaryRoot: manifest.temporaryRoot,
        scope: plan.scope, files, directories: ordered([...dirs.values()]), externalDependencies: ['node_modules symlink (unlisted/unpinned by original source manifest)', 'Vite caches and host/browser runtime'] };
      const ref = { ...publishJson(root, 'snapshots', snapshot), manifestSha256: item.sha256, manifestPaths: [item.path], fileCount: files.length };
      validateSnapshot(root, ref); all.set(item.sha256, ref);
    }
    const snapshots = [...all.values()].sort((a, b) => a.manifestSha256.localeCompare(b.manifestSha256));
    const objects = new Map();
    for (const item of supplements.values()) {
      validateSupplement(root, item); objects.set(item.sha256, item.size);
      objects.set(item.authority.sha256, fs.statSync(regularFile(root, objectName(item.authority.sha256))).size);
    }
    for (const ref of snapshots) {
      const snapshot = validateSnapshot(root, ref);
      for (const file of snapshot.files) {
        if (objects.has(file.sha256)) assert.equal(objects.get(file.sha256), file.size);
        else objects.set(file.sha256, file.size);
      }
      objects.set(snapshot.manifestObject, fs.statSync(regularFile(root, objectName(snapshot.manifestObject))).size);
    }
    // Full content verification before publishing; orphan objects from an interrupted run never imply success.
    for (const [hash, size] of objects) assert.equal(checkedBytes(regularFile(root, objectName(hash)), hash).length, size);
    const index = { schemaVersion: VERSION, status: 'archived-content-verified-not-game-approval', createdAt: new Date().toISOString(),
      parentIndexSha256: oldIndex ? sha256(fs.readFileSync(path.join(root, 'index.json'))) : null, plan: publishJson(root, 'plans', plan),
      snapshots, supplements: [...supplements.values()], counts: { snapshots: snapshots.length, fileEntries: snapshots.reduce((sum, ref) => sum + ref.fileCount, 0), objects: objects.size, objectBytes: [...objects.values()].reduce((a, b) => a + b, 0) }, scope: plan.scope };
    const ref = publishJson(root, 'indexes', index), temp = path.join(root, `index.${randomUUID()}.tmp`);
    writeNew(temp, jsonBytes(index)); fs.renameSync(temp, path.join(root, 'index.json'));
    return { status: 'pass', index: ref, counts: index.counts };
  } finally { fs.closeSync(lockFd); fs.unlinkSync(lock); }
}

export function readIndex(root) {
  const bytes = fs.readFileSync(regularFile(root, 'index.json')), hash = sha256(bytes);
  checkedBytes(regularFile(root, `indexes/${hash}.json`), hash);
  const index = JSON.parse(bytes);
  assert.equal(index.schemaVersion, VERSION); assert.equal(index.status, 'archived-content-verified-not-game-approval');
  checkedBytes(regularFile(root, index.plan.path), index.plan.sha256);
  const history = new Set([hash]);
  let parent = index.parentIndexSha256;
  while (parent !== null) {
    assert(SHA.test(parent) && !history.has(parent), 'Invalid/cyclic index history'); history.add(parent);
    const older = JSON.parse(checkedBytes(regularFile(root, `indexes/${parent}.json`), parent));
    checkedBytes(regularFile(root, older.plan.path), older.plan.sha256);
    parent = older.parentIndexSha256;
  }
  assert(index.snapshots.length > 0 && index.snapshots.length === index.counts.snapshots);
  assert.equal(new Set(index.snapshots.map(ref => ref.manifestSha256)).size, index.snapshots.length);
  return index;
}

export function restore({ archive, manifestSha256, target }) {
  const root = fs.realpathSync(archive), index = readIndex(root), ref = index.snapshots.find(item => item.manifestSha256 === manifestSha256);
  assert(ref, `Unknown source manifest SHA: ${manifestSha256}`);
  target = path.resolve(target);
  assert(!fs.existsSync(target), 'Restore target must not exist');
  const parent = fs.realpathSync(path.dirname(target));
  assert.equal(path.dirname(target), parent, 'Restore parent must be canonical, not a symlink');
  assert(!(target === root || target.startsWith(`${root}${path.sep}`)), 'Cannot restore inside archive');
  const snapshot = validateSnapshot(root, ref);
  fs.mkdirSync(target, { mode: 0o700 });
  for (const entry of snapshot.directories) fs.mkdirSync(path.join(target, entry.path), { recursive: true, mode: 0o700 });
  for (const entry of snapshot.files) {
    const bytes = checkedBytes(regularFile(root, objectName(entry.sha256)), entry.sha256);
    assert.equal(bytes.length, entry.size);
    writeNew(path.join(target, entry.path), bytes); fs.chmodSync(path.join(target, entry.path), entry.mode);
  }
  for (const entry of [...snapshot.directories].sort((a, b) => b.path.length - a.path.length)) fs.chmodSync(path.join(target, entry.path), entry.mode);
  let fileBytes = 0;
  for (const entry of snapshot.files) {
    const file = regularFile(target, entry.path), bytes = checkedBytes(file, entry.sha256), stat = fs.statSync(file);
    assert.equal(bytes.length, entry.size); assert.equal(stat.mode & 0o777, entry.mode); fileBytes += bytes.length;
  }
  for (const entry of snapshot.directories) assert.equal(fs.statSync(path.join(target, entry.path)).mode & 0o777, entry.mode);
  return { status: 'pass', manifestSha256, snapshot: ref, target, filesVerified: snapshot.files.length, bytesVerified: fileBytes, modesVerified: true, originalSourceRead: false, serviceStarted: false };
}

export function verify({ archive, restoreAll = false }) {
  const root = fs.realpathSync(archive), index = readIndex(root), objects = new Map(), results = [];
  for (const item of index.supplements ?? []) {
    validateSupplement(root, item); objects.set(item.sha256, item.size);
    objects.set(item.authority.sha256, fs.statSync(regularFile(root, objectName(item.authority.sha256))).size);
  }
  for (const ref of index.snapshots) {
    const snapshot = validateSnapshot(root, ref);
    assert.equal(ref.manifestSha256, snapshot.manifest.sha256); assert.equal(ref.fileCount, snapshot.files.length);
    for (const file of snapshot.files) {
      if (objects.has(file.sha256)) assert.equal(objects.get(file.sha256), file.size);
      objects.set(file.sha256, file.size);
    }
    objects.set(snapshot.manifestObject, fs.statSync(regularFile(root, objectName(snapshot.manifestObject))).size);
  }
  for (const [hash, size] of objects) assert.equal(checkedBytes(regularFile(root, objectName(hash)), hash).length, size);
  assert.equal(objects.size, index.counts.objects);
  assert.equal([...objects.values()].reduce((a, b) => a + b, 0), index.counts.objectBytes);
  assert.equal(index.snapshots.reduce((sum, ref) => sum + ref.fileCount, 0), index.counts.fileEntries);
  if (restoreAll) {
    const temporary = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r100-source-archive-restore-')));
    try {
      for (const ref of index.snapshots) {
        const target = path.join(temporary, ref.manifestSha256);
        const result = restore({ archive: root, manifestSha256: ref.manifestSha256, target });
        fs.rmSync(target, { recursive: true }); results.push({ ...result, verifiedTemporaryTreeRemoved: true });
      }
      fs.rmdirSync(temporary);
    } catch (error) { throw new Error(`Restore failure retained in ${temporary}: ${error.message}`, { cause: error }); }
  }
  return { status: 'pass', indexSha256: sha256(fs.readFileSync(path.join(root, 'index.json'))), counts: index.counts,
    restoreAll, restores: results, originalSourceRead: false, serviceStarted: false };
}

function parseArguments(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]; assert(key.startsWith('--'), `Unexpected argument: ${key}`);
    if (key === '--restore-all') { options.restoreAll = true; continue; }
    const value = argv[++i]; assert(value && !value.startsWith('--'), `Missing value: ${key}`);
    (options[key.slice(2)] ??= []).push(value);
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const command = process.argv[2], args = parseArguments(process.argv.slice(3));
    const allowed = { plan: ['project', 'reference', 'manifest', 'scan', 'aliases', 'supplements', 'report'], pack: ['project', 'archive', 'plan', 'report'], verify: ['archive', 'restoreAll', 'report'], restore: ['archive', 'manifest-sha', 'target', 'report'] };
    assert(allowed[command], 'Expected plan, pack, verify, or restore');
    for (const key of Object.keys(args)) assert(allowed[command].includes(key), `Unknown option: ${key}`);
    if (args.report) assert(args.report.length === 1 && !fs.existsSync(args.report[0]), 'Report must be a new path');
    const one = key => { assert(args[key]?.length === 1, `Expected one --${key}`); return args[key][0]; };
    let result;
    if (command === 'plan') result = createPlan({ project: args.project?.[0] ?? process.cwd(), references: args.reference, manifests: args.manifest, scanDirectories: args.scan,
      aliases: args.aliases ? readJson(one('aliases')) : [], supplements: args.supplements ? readJson(one('supplements')) : [] });
    else if (command === 'pack') result = pack({ project: args.project?.[0] ?? process.cwd(), archive: one('archive'), plan: readJson(one('plan')) });
    else if (command === 'verify') result = verify({ archive: one('archive'), restoreAll: args.restoreAll === true });
    else if (command === 'restore') result = restore({ archive: one('archive'), manifestSha256: one('manifest-sha'), target: one('target') });
    else throw new Error('Commands: plan --reference/--manifest/--scan --report; pack --plan --archive; verify --archive [--restore-all]; restore --archive --manifest-sha --target. Optional --report writes a new receipt, never overwrites.');
    if (args.report) writeNew(one('report'), jsonBytes(result));
    console.log(JSON.stringify(command === 'plan' ? { status: result.status, snapshots: result.snapshots.length, references: result.references.length, pending: result.pending } : { ...result, restores: result.restores?.length }, null, 2));
  } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
