/** Metadata and incremental-byte audit only; no map generation, browser or restore execution. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = process.cwd(), base = 'docs/qa/artifacts/r100-i10-i12', archive = `${base}/source-archive`;
const out = `${base}/closeout-independent-review/final-static-readiness-review.json`;
assert(!fs.existsSync(out), 'Never overwrite independent evidence');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const readInputs = new Map(), cache = new Map();
function bytes(file, expected) {
  const raw = fs.readFileSync(file), digest = sha(raw);
  if (expected) assert.equal(digest, expected, file);
  const relative = path.relative(root, path.resolve(file));
  readInputs.set(relative, {path: relative, sha256: digest}); return raw;
}
const ref = file => ({path: file, sha256: sha(fs.readFileSync(file))});
const json = (file, expected) => JSON.parse(bytes(file, expected));
function consume(item) {
  assert(typeof item?.path === 'string' && /^[0-9a-f]{64}$/.test(item.sha256), 'Concrete immutable ref required');
  const key = `${item.path}:${item.sha256}`;
  if (!cache.has(key)) cache.set(key, json(item.path, item.sha256));
  return cache.get(key);
}
const sourceRef = {path: `${base}/final-source/source-snapshot.json`, sha256: 'e4477ea30d618f8d3f76bab7379961ee5fb8cc668f580c84385626509bdbd1af'};
const planRef = {path: `${base}/final-binding/plan.enabled108.draft.json`, sha256: '23fb64b27eca6e85a5b5262e3ba96601bbe71857693f33b67ea76865719491af'};
const source = consume(sourceRef), plan = consume(planRef);
assert.deepEqual(plan.finalSource, sourceRef); assert.equal(source.port, 3122);
assert(source.verifiedCopyHashes); assert.deepEqual(source.patches, []); assert.equal(Object.keys(source.sources).length, 1397);
const qualification = consume(plan.qualificationPlan);
const worldIds = [...qualification.baseline.worlds, ...qualification.batches.flatMap(batch => batch.worlds)];
assert.equal(worldIds.length, 108); assert.equal(new Set(worldIds).size, 108);
const activation = json(`${base}/final-enable/activation-execution.json`, '9e4c15eeb6543803ec24bea40dba9b4e81423f935fd8c5cd9c274c7060300f53');
const enable = consume(activation.report), before = consume(activation.before);
for (const key of ['qualificationPlan', 'fixedPlay', 'artReadiness', 'p43Art']) consume(activation[key]);
assert.equal(enable.status, 'pass-enabled-only-recipe-compatibility');
assert.deepEqual([enable.beforeEnabled, enable.afterEnabled, enable.changedCsvFields, enable.old52GradeRecipesExact,
  enable.all108GradeRecipesExact, enable.preEnableRecipesStillValid], [52, 108, 56, 156, 324, 324]);
assert.equal(before.recipes.length, 324);
assert.deepEqual(activation.changedWorlds, qualification.batches.flatMap(batch => batch.worlds));
for (const command of activation.commands) {assert.equal(command.exitCode, 0); bytes(command.log.path, command.log.sha256);}
const continuityRef = {path: `${base}/final-enable/continuity-all108.json`, sha256: 'ff84d7b83a273654aba967dbe9537a56101ea62df10c3044b612e6378a377f7a'};
const continuity = consume(continuityRef), oldSource = consume(continuity.before);
assert.deepEqual(continuity.after, sourceRef); assert.equal(continuity.status, 'pass'); assert.equal(continuity.mode, 'none');
assert.deepEqual(Object.keys(oldSource.sources).sort(), Object.keys(source.sources).sort());
const changed = Object.keys(source.sources).filter(file => source.sources[file] !== oldSource.sources[file]).sort();
assert.deepEqual(changed, ['data/rift-native-worlds.csv', 'src/generated/r100-native-worlds.ts', 'src/generated/r100-package-manifest.ts']);
assert.equal(continuity.unchangedFiles, 1394); assert.deepEqual(continuity.reviewedChanges.map(row => row.file).sort(), changed);
for (const [file, hash] of Object.entries(enable.sourceHashesBefore)) assert.equal(oldSource.sources[file], hash);
for (const [file, hash] of Object.entries(enable.sourceHashesAfter)) assert.equal(source.sources[file], hash);
function frozen(snapshot, file) {return bytes(path.join(snapshot.temporaryRoot, file), snapshot.sources[file]).toString('utf8');}
function literal(text, name) {
  const start = text.indexOf(`export const ${name}`); assert(start >= 0, name);
  const equals = text.indexOf(' = ', start); assert(equals >= 0);
  const end = text.indexOf(';', equals);
  return JSON.parse(text.slice(equals + 3, end).replace(/ as const\s*$/, ''));
}
const oldRows = literal(frozen(oldSource, changed[1]), 'R100_NATIVE_WORLDS');
const finalRows = literal(frozen(source, changed[1]), 'R100_NATIVE_WORLDS');
const omitEnabled = ({enabled, ...content}) => content;
assert.deepEqual(oldRows.map(row => row.id), worldIds); assert.deepEqual(finalRows.map(row => row.id), worldIds);
assert.deepEqual(continuity.worlds.map(row => row.worldId), worldIds);
for (let i = 0; i < 108; i++) {
  assert.deepEqual(omitEnabled(oldRows[i]), omitEnabled(finalRows[i])); assert.equal(finalRows[i].enabled, true);
  assert.equal(continuity.worlds[i].contentSha256, sha(JSON.stringify(omitEnabled(oldRows[i]))));
  assert.equal(continuity.worlds[i].enabledBefore, oldRows[i].enabled);
}
const oldCsv = frozen(oldSource, changed[0]), finalCsv = frozen(source, changed[0]);
assert.equal(bytes(`${base}/final-enable/native-before.csv`).toString(), oldCsv);
const oldLines = oldCsv.split('\n'), newLines = finalCsv.split('\n'); assert.equal(oldLines.length, newLines.length);
const enabledColumn = oldLines[0].split(',').indexOf('enabled'); assert(enabledColumn >= 0);
const csvChanges = [];
for (let i = 0; i < oldLines.length; i++) {
  if (oldLines[i] === newLines[i]) continue;
  const columns = oldLines[i].split(','); assert.equal(columns[enabledColumn], 'false');
  csvChanges.push(columns[0]); columns[enabledColumn] = 'true'; assert.equal(newLines[i], columns.join(','));
}
assert.deepEqual(csvChanges, activation.changedWorlds);
const oldPackageTs = frozen(oldSource, changed[2]), newPackageTs = frozen(source, changed[2]);
assert.deepEqual(literal(oldPackageTs, 'R100_MATERIAL_DEPENDENCIES'), literal(newPackageTs, 'R100_MATERIAL_DEPENDENCIES'));
const oldPackage = literal(oldPackageTs, 'R100_PACKAGE_MANIFEST'), newPackage = literal(newPackageTs, 'R100_PACKAGE_MANIFEST');
const expectedNewPackage = structuredClone(oldPackage);
for (const dep of expectedNewPackage.dependencies) if (source.sources[dep.path]) dep.sha256 = source.sources[dep.path];
assert.deepEqual(newPackage, expectedNewPackage);

const packageExecution = consume(plan.preparation.packageExecution), packageIndex = consume(plan.packages);
assert.equal(plan.packages.sha256, '4e49172dd3205533313bee33108beefd1dffd2972d8a5729dec9266f9d6faeab');
assert.deepEqual(packageExecution.source, sourceRef); assert(packageExecution.sourceBeforeAndAfterExact);
assert.equal(packageExecution.status, 'pass'); assert.equal(packageExecution.algorithmRevision, 6);
assert.deepEqual(packageExecution.index, plan.packages); assert.deepEqual(packageExecution.worlds, worldIds);
for (const key of ['compiler', 'runner', 'packageLock']) bytes(packageExecution[key].path, packageExecution[key].sha256);
assert.deepEqual(packageIndex.worlds.map(row => row.worldId), worldIds);
const dependencyMap = new Map();
const packageRefs = packageIndex.worlds.map(row => {
  const item = {path: row.dependencyManifest.path, sha256: row.dependencyManifest.hash};
  const payload = consume(item); assert.equal(payload.worldId, row.worldId); assert.equal(payload.algorithm.revision, 6);
  assert.deepEqual(payload.grades.map(grade => grade.grade), ['low', 'medium', 'severe']);
  for (const dep of payload.dependencies) {
    if (dependencyMap.has(dep.path)) assert.equal(dependencyMap.get(dep.path), dep.sha256);
    dependencyMap.set(dep.path, dep.sha256);
    assert.equal(source.sources[dep.path] ?? packageExecution.packageLock.sha256, dep.sha256);
    if (!source.sources[dep.path]) assert.equal(dep.path, 'package-lock.json');
  }
  return {worldId: row.worldId, ...item};
});
assert.equal(dependencyMap.size, 307);
const selectionExecution = json(`${base}/final-enable/selection-execution.json`, 'a4ba1cd6fed87f60ee82cfeeb9bb738bf72b771bb4bd24acedbc28679328dcb6');
assert.deepEqual(selectionExecution.source, sourceRef); assert.equal(selectionExecution.status, 'pass');
assert.equal(selectionExecution.exitCode, 0); assert(selectionExecution.beforeAllSourceExact && selectionExecution.afterAllSourceExact);
consume(selectionExecution.compatibility); bytes(selectionExecution.harness.path, selectionExecution.harness.sha256);
const selectionLog = JSON.parse(bytes(selectionExecution.log.path, selectionExecution.log.sha256));
assert.equal(selectionLog.status, 'PASS'); assert.equal(selectionLog.worlds, 108); assert.equal(selectionLog.samplesPerPolicy, 32768);
const selection = json(`${base}/selection-final108/selection.json`);
assert.deepEqual(selection.worldIds, worldIds); assert.equal(selection.catalogSourceHash, source.sources['data/rift-native-worlds.csv']);
for (const type of ['uniform', 'recent']) {
  assert.equal(selection[type].samples, 32768); assert.deepEqual(Object.keys(selection[type].counts), worldIds);
  assert.equal(Object.values(selection[type].counts).reduce((sum, n) => sum + n, 0), 32768);
}

const addendum = consume(plan.preparation.toolChangeAddendum);
assert.equal(addendum.status, 'approved-accounting-tool-addendum'); assert.equal(addendum.reviewer, 'root');
consume(addendum.originalOrder); consume(addendum.originalArtifactContract);
for (const item of addendum.currentTools) bytes(item.path, item.sha256);
for (const item of [...addendum.checks, ...addendum.protocols]) consume(item);
const harnessSupplement = json(`${base}/closeout-independent-review/historical-generation-harness-supplement.json`, '7487ab29c41db02b242e0b0951b6c5c10d7ed2a29f5928c91516d9825127a388');
assert.deepEqual(plan.historicalGenerationSources, harnessSupplement.historicalGenerationSources);
assert.equal(plan.historicalGenerationSources.length, 11); assert.equal(plan.runtimeBindings.length, 4);
const pending = [];
function validatePlanRefs(value, pointer = '') {
  if (!value || typeof value !== 'object') return;
  if (typeof value.path === 'string' && Object.hasOwn(value, 'sha256')) {
    if (value.sha256 === null) pending.push({pointer, path: value.path});
    else bytes(value.path, value.sha256);
  }
  for (const [key, child] of Object.entries(value)) validatePlanRefs(child, `${pointer}/${key}`);
}
validatePlanRefs(plan); assert.equal(pending.length, 11);

const initialAudit = json(`${base}/closeout-independent-review/initial-archive-audit.json`, '52468cb3e1b846711ff102426e7985d646ff484be9411911bdbfe3c862ce4656');
const oldIndex = consume(initialAudit.archiveIndex);
const indexRef = {path: `${archive}/index.json`, sha256: 'fe91926a0ab0cc2af4a091c7b18288353a73b16fc5b695ed1fe9a2ac11d88174'};
const index = consume(indexRef); bytes(`${archive}/indexes/${indexRef.sha256}.json`, indexRef.sha256);
assert.equal(index.parentIndexSha256, initialAudit.archiveIndex.sha256);
const pack = json(`${archive}/final-pack-report.json`, 'c6f3329d75d9dad6eaeb3ac65eff6ba8fb16b23c7b397e8ae3fc658e3c0aab73');
assert.equal(pack.status, 'pass'); assert.deepEqual(pack.counts, index.counts); assert.equal(pack.index.sha256, indexRef.sha256);
const archivePlan = json(`${base}/final-source-archive-plan.json`, index.plan.sha256);
json(`${archive}/${index.plan.path}`, index.plan.sha256); assert.deepEqual(archivePlan.pending, []);
assert.equal(archivePlan.snapshots.length, 1); assert.equal(archivePlan.snapshots[0].sha256, sourceRef.sha256);
for (const old of oldIndex.snapshots) assert.deepEqual(index.snapshots.find(item => item.manifestSha256 === old.manifestSha256), old);
assert.equal(index.snapshots.length, 36); assert.equal(new Set(index.snapshots.map(row => row.manifestSha256)).size, 36);
const oldObjectSet = new Set(), objectSizes = new Map(), allSnapshots = new Map();
for (const row of index.snapshots) {
  const snapshot = json(`${archive}/${row.path}`, row.sha256); allSnapshots.set(row.manifestSha256, snapshot);
  assert.equal(snapshot.manifest.sha256, row.manifestSha256); assert.equal(snapshot.files.length, row.fileCount);
  const isOld = oldIndex.snapshots.some(old => old.manifestSha256 === row.manifestSha256);
  for (const entry of [{sha256: snapshot.manifestObject}, ...snapshot.files]) {
    if (isOld) oldObjectSet.add(entry.sha256);
    const file = `${archive}/objects/sha256/${entry.sha256.slice(0, 2)}/${entry.sha256}`;
    const stat = fs.lstatSync(file); assert(stat.isFile() && !stat.isSymbolicLink());
    if (entry.size !== undefined) assert.equal(stat.size, entry.size);
    objectSizes.set(entry.sha256, stat.size);
  }
}
for (const item of oldIndex.supplements) {oldObjectSet.add(item.sha256); oldObjectSet.add(item.authority.sha256);}
for (const item of index.supplements) {
  const content = `${archive}/objects/sha256/${item.sha256.slice(0, 2)}/${item.sha256}`;
  const authorityFile = `${archive}/objects/sha256/${item.authority.sha256.slice(0, 2)}/${item.authority.sha256}`;
  const authority = json(authorityFile, item.authority.sha256);
  const authorityValue = item.authority.jsonPointer.slice(1).split('/').reduce((value, token) => value[token.replaceAll('~1', '/').replaceAll('~0', '~')], authority);
  assert.equal(authorityValue.path, item.path); assert.equal(authorityValue.sha256, item.sha256);
  bytes(item.path, item.sha256); objectSizes.set(item.sha256, fs.statSync(content).size);
  objectSizes.set(item.authority.sha256, fs.statSync(authorityFile).size);
}
assert.equal(oldObjectSet.size, 1629);
const deltaObjects = [...objectSizes].filter(([digest]) => !oldObjectSet.has(digest)).map(([digest, size]) => {
  const file = `${archive}/objects/sha256/${digest.slice(0, 2)}/${digest}`;
  assert.equal(bytes(file, digest).length, size); return {path: file, sha256: digest, size};
});
assert.equal(deltaObjects.length, 7);
const counts = {snapshots: index.snapshots.length, fileEntries: index.snapshots.reduce((sum, row) => sum + row.fileCount, 0),
  objects: objectSizes.size, objectBytes: [...objectSizes.values()].reduce((sum, n) => sum + n, 0)};
assert.deepEqual(counts, index.counts); assert.deepEqual(counts, {snapshots: 36, fileEntries: 49798, objects: 1636, objectBytes: 228105618});
const finalSnapshot = allSnapshots.get(sourceRef.sha256);
assert.equal(finalSnapshot.manifestObject, sourceRef.sha256); assert.equal(finalSnapshot.originalTemporaryRoot, source.temporaryRoot);
assert.deepEqual(Object.fromEntries(finalSnapshot.files.map(row => [row.path, row.sha256])), source.sources);
const restore = json(`${archive}/final-source-restore-verification.json`, 'f000e57da0f5e4764cf134a3ebdb822fb89575bb05bdc56c62e77318397ab6ae');
assert.equal(restore.status, 'pass'); assert.equal(restore.manifestSha256, sourceRef.sha256);
assert.deepEqual(restore.snapshot, index.snapshots.find(row => row.manifestSha256 === sourceRef.sha256));
assert.equal(restore.filesVerified, 1397); assert.equal(restore.bytesVerified, finalSnapshot.files.reduce((sum, row) => sum + row.size, 0));
assert.equal(restore.originalSourceRead, false); assert.equal(restore.serviceStarted, false); assert(restore.modesVerified);
const restoredDeltaFiles = [];
for (const row of finalSnapshot.files) {
  const restoredFile = path.join(restore.target, row.path), stat = fs.lstatSync(restoredFile);
  assert(stat.isFile() && !stat.isSymbolicLink()); assert.equal(stat.size, row.size); assert.equal(stat.mode & 0o777, row.mode);
  if (!oldObjectSet.has(row.sha256)) {bytes(restoredFile, row.sha256); restoredDeltaFiles.push(row.path);}
}
for (const row of finalSnapshot.directories) {
  const stat = fs.lstatSync(path.join(restore.target, row.path)); assert(stat.isDirectory() && !stat.isSymbolicLink()); assert.equal(stat.mode & 0o777, row.mode);
}

const artAudit = json(`${base}/final-art-binding-audit.json`, '5abaa2d92e8ca52e3748a0b40be5a9dc3bea4a75822e6fe039ca055fbe4170e6');
const artInputs = consume(artAudit.inputs), art = consume(artAudit.candidate), artPrior = consume(artAudit.upstreamCandidate);
assert.deepEqual(artInputs.observedImmutablePlan, planRef); assert.deepEqual(artInputs.finalSource, sourceRef);
assert.deepEqual(artInputs.finalPackageIndex, plan.packages); assert.deepEqual(artInputs.finalEnableBridge, continuityRef);
assert.equal(art.status, 'bound-pending-root-disposition'); assert.equal(artAudit.summary.rootDispositionPending, true);
assert.equal(art.worlds.length, 108); assert.equal(artInputs.activeEvidenceBindings.length, 260);
assert.deepEqual(art.worlds.map(row => row.worldId), worldIds); assert.deepEqual(artAudit.errors, []);
const historicalBinding = consume(plan.historicalBinding), inheritance = consume(plan.inheritance);
const eligible = new Map([...plan.continuity, ...historicalBinding.continuity, plan.inheritance].map(item => [`${item.path}:${item.sha256}`, item]));
assert.equal(eligible.size, 32); assert.equal(inheritance.reviewer, 'root'); assert.equal(inheritance.status, 'bounded-pass');
const historicalWorldIds = new Set(qualification.baseline.worlds);
let maximumRouteEdges = 0, activeEvidence = 0, historicalEvidence = 0;
for (const binding of artInputs.activeEvidenceBindings) {
  consume(binding.receipt); consume(binding.source); assert.deepEqual(binding.target, sourceRef);
  let current = binding.source.sha256;
  for (const item of binding.route) {
    assert(eligible.has(`${item.path}:${item.sha256}`), 'Art route may only use standard or root-approved inheritance edge');
    const edge = consume(item); assert.equal(edge.before.sha256, current);
    if (item.path === plan.inheritance.path) assert(historicalWorldIds.has(binding.worldId));
    else {assert.equal(edge.status, 'pass'); assert(edge.worlds.some(row => (typeof row === 'string' ? row : row.worldId) === binding.worldId));}
    current = edge.after.sha256;
  }
  assert.equal(current, sourceRef.sha256); maximumRouteEdges = Math.max(maximumRouteEdges, binding.route.length);
  const world = art.worlds.find(row => row.worldId === binding.worldId), evidence = world.evidence[binding.evidenceIndex];
  assert.equal(evidence.path, binding.receipt.path); assert.equal(evidence.sha256, binding.receipt.sha256);
  assert.equal(evidence.sourceManifest, binding.source.path); assert.equal(evidence.sourceManifestSha256, binding.source.sha256);
  assert.deepEqual(evidence.finalBinding.continuity, binding.route); assert.deepEqual(evidence.finalBinding.target, sourceRef);
  activeEvidence++;
}
for (let i = 0; i < art.worlds.length; i++) {
  const current = art.worlds[i], original = artPrior.worlds[i]; assert.equal(current.worldId, original.worldId);
  for (const key of ['scope', 'limitations', 'historicalEvidence', 'authorEvidence', 'rootEvidence']) assert.deepEqual(current[key], original[key]);
  assert.equal(current.status, 'bound-pending-root-disposition'); assert.equal(current.dependencyHash, packageRefs[i].sha256);
  assert.deepEqual(current.finalSource, sourceRef); historicalEvidence += current.historicalEvidence?.length ?? 0;
}
assert.equal(historicalEvidence, 56); assert.equal(artInputs.historicalOnlySupersededEvidence.length, 2);
for (const entry of artInputs.historicalOnlySupersededEvidence) {
  assert.equal(entry.worldId, 'cleft-tableland'); consume(entry.receipt); consume(entry.source);
  assert(!artInputs.activeEvidenceBindings.some(row => row.worldId === entry.worldId && row.receipt.path === entry.receipt.path));
}
assert.equal(activeEvidence, artAudit.summary.activeArtEvidenceBindings); assert.equal(maximumRouteEdges, artAudit.summary.maximumRouteEdges);

const audit = {schema: 'coh.qa.final-static-readiness-independent-review.v1', status: 'pass-static-readiness-not-runtime-or-binder-acceptance',
  at: new Date().toISOString(), reviewer: 'i12_qa', features: ['F052', 'F044', 'F005'], auditor: ref(fileURLToPath(import.meta.url)),
  finalSource: sourceRef, observedPlan: planRef, archiveIndex: indexRef,
  activation: {report: activation.report, enabledBefore: 52, enabledAfter: 108, enabledOnlyCsvChanges: csvChanges.length,
    exactContentProjections: 108, sourceManifestDifferences: changed, recipeComparisonReport: '324 full original recipes and production-validator check are bound to the unchanged checker execution; no map generation was rerun.'},
  packages: {index: plan.packages, worlds: packageRefs.length, grades: 324, uniqueDependencies: dependencyMap.size,
    dependenciesMatchingFinalSourceManifest: 306, separatelyBoundDependency: packageExecution.packageLock},
  selection: {execution: ref(`${base}/final-enable/selection-execution.json`), result: selectionLog, method: 'Verified original execution/source references and raw32768-per-policy count totals; did not rerun selection.'},
  finalPlan: {historicalGenerationSources: 11, runtimeBindings: 4, concretePlanReferencesShaChecked: true, pendingReferences: pending, toolChangeAddendum: plan.preparation.toolChangeAddendum},
  archive: {counts, inheritedAudit: ref(`${base}/closeout-independent-review/initial-archive-audit.json`), originalSnapshotsUnchanged: 35,
    incrementalSnapshots: 1, originalObjectHashesInherited: oldObjectSet.size, incrementalObjectsShaVerified: deltaObjects,
    explicitSupplements: index.supplements, finalRestore: ref(`${archive}/final-source-restore-verification.json`),
    finalSnapshotMappingsVerified: 1397, restoredFileSizesAndModesChecked: 1397, restoredDirectoryModesChecked: finalSnapshot.directories.length,
    restoredIncrementalFilesShaChecked: restoredDeltaFiles, restoredFileHashesFromPriorObjectsInherited: 1397 - restoredDeltaFiles.length,
    restoresExecutedByThisAudit: 0, servicesStarted: 0},
  artMetadata: {inputs: artAudit.inputs, candidate: artAudit.candidate, sourceAudit: ref(`${base}/final-art-binding-audit.json`),
    activeBindingsChecked: activeEvidence, allowedRouteReceipts: eligible.size, maximumRouteEdges,
    worldScopesAndLimitationsPreserved: 108, historicalEvidenceEntriesPreserved: historicalEvidence, supersededHistoricalOnlyCleftRefs: 2,
    rootDispositionRemainsPendingInCandidate: true, freshVisualOrAudioViews: 0},
  limitations: ['This receipt grants only static metadata, scope and incremental archive readiness. Final actual runtime reports, four source bindings, technical/shader review and binder corruption checks remain separate.',
    'The initial35 snapshot payload hashes and full restore executions are inherited from the original independent audit; only seven new objects and newly introduced restored source bytes were freshly hashed here. All1397 restored file sizes/modes and74 directory modes were checked.',
    'Package dependency metadata was checked against final source hashes. The307 dependency files and1397 frozen-source bytes were not all read again; original full-source package/art/compatibility audits retain their actual scope.',
    'Art route metadata and preservation were reviewed without viewing images or hearing audio; root owns final bounded art disposition and human aesthetic approval is not inferred.',
    'Explicit historical harness supplements preserve original path/SHA identity; they do not become retroactive members of old source manifests, and node_modules/OS/browser remain outside source archive coverage.'],
  consumedInputs: [...readInputs.values()].sort((a, b) => a.path.localeCompare(b.path))};
for (const item of audit.consumedInputs) assert.equal(sha(fs.readFileSync(item.path)), item.sha256, `Input changed during audit: ${item.path}`);
fs.writeFileSync(out, JSON.stringify(audit, null, 2) + '\n', {flag: 'wx'});
console.log(JSON.stringify({status: audit.status, review: ref(out), archive: counts, pendingReferences: pending.length, artBindings: activeEvidence}));
