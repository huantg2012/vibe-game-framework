/** Scoped, repeatable r5 -> r6 inheritance audit. No generation or browser work.
 * Produces a candidate for independent review, never an iteration approval. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const base = 'docs/qa/artifacts/r100-i10-i12';
const output = `${base}/old52-r6-inheritance`;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = value => createHash('sha256').update(value).digest('hex');
const ref = file => ({ path: file, sha256: sha(fs.readFileSync(file)) });
const plan = read(`${base}/qualification-plan.json`), worlds = plan.baseline.worlds;
const beforeRef = plan.baseline.source, afterRef = ref(`${base}/b01-final-source/source-snapshot.json`);
assert.equal(ref(beforeRef.path).sha256, beforeRef.sha256);
const before = read(beforeRef.path), after = read(afterRef.path);
const load = (snapshot, file) => {
  const bytes = fs.readFileSync(path.join(snapshot.temporaryRoot, file));
  assert.equal(sha(bytes), snapshot.sources[file], `Frozen source drift: ${file}`);
  return bytes.toString('utf8');
};
for (const snapshot of [before, after]) for (const file of Object.keys(snapshot.sources)) load(snapshot, file);
const parse = (snapshot, file) => ts.createSourceFile(file, load(snapshot, file), ts.ScriptTarget.Latest, true);
const printer = ts.createPrinter({ removeComments: true });
const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
function literal(snapshot, file, name) {
  const ast = parse(snapshot, file);
  const declaration = ast.statements.filter(ts.isVariableStatement).flatMap(row => [...row.declarationList.declarations])
    .find(row => row.name.getText(ast) === name);
  assert(declaration?.initializer, `${file}:${name}`);
  let value = declaration.initializer;
  while (ts.isAsExpression(value) || ts.isSatisfiesExpression(value)) value = value.expression;
  return JSON.parse(value.getText(ast));
}
const pick = (rows, field, id) => { const matches = rows.filter(row => row[field] === id); assert.equal(matches.length, 1); return matches[0]; };
const catalogFile = 'src/generated/r100-native-worlds.ts';
const previous = literal(before, catalogFile, 'R100_NATIVE_WORLDS');
const current = literal(after, catalogFile, 'R100_NATIVE_WORLDS');
assert.equal(worlds.length, 52); assert.deepEqual(previous.map(row => row.id), worlds);
const families = new Set();
for (const id of worlds) {
  const a = pick(previous, 'id', id), b = pick(current, 'id', id);
  assert.deepEqual(b, a, `Old catalog row changed: ${id}`);
  for (const definition of b.definitions) {
    assert.equal(definition.authoredErosion, undefined);
    families.add(definition.family);
    for (const instance of definition.instances) {
      assert((instance.constructionVersion ?? 1) < 4);
      assert.equal(instance.groundEdgeWidth, undefined);
      families.add(instance.family ?? definition.family);
    }
  }
}
for (const [file, name] of [
  ['src/generated/r100-world-appearance.ts', 'R100_WORLD_APPEARANCES'],
  ['src/generated/rift-search-remains.ts', 'SEARCH_REMAINS'],
]) {
  const a = literal(before, file, name), b = literal(after, file, name);
  for (const id of worlds) {
    assert.deepEqual(pick(a, 'worldId', id), pick(b, 'worldId', id), `${name}:${id}`);
    if (name === 'R100_WORLD_APPEARANCES') assert.equal(pick(b, 'worldId', id).materialOrganization, undefined);
  }
}
const materialsFile = 'src/generated/r100-package-manifest.ts';
const oldMaterials = literal(before, materialsFile, 'R100_MATERIAL_DEPENDENCIES');
const newMaterials = literal(after, materialsFile, 'R100_MATERIAL_DEPENDENCIES');
for (const family of families) assert.deepEqual(newMaterials[family], oldMaterials[family]);

const reviewedChanges = {
  'src/generated/r100-native-worlds.ts': 'All 52 complete old rows, including enabled state and all three definitions, compare exactly. Four new worlds are outside this inheritance.',
  'src/generated/r100-package-manifest.ts': 'Revision6 implementation receipt changes; all used family definition/surface/solid SHA values are exact. New organizations are not selected.',
  'src/generated/r100-world-appearance.ts': 'All 52 appearance rows compare exactly; materialOrganization is absent.',
  'src/generated/rift-search-remains.ts': 'All 52 remains rows compare exactly; renderer and original atomic assets are byte-identical.',
  'data/rift-native-worlds.csv': 'Compiled selected-world projection is exact, including default erosion and construction versions below4.',
  'data/rift-world-appearance.csv': 'Compiled selected-world appearance projection is exact.',
  'data/rift-search-remains.csv': 'Compiled selected-world remains projection is exact.',
  'src/generation/world-study/native-volume-geometry.ts': 'Old MeshBuilder and all old shape bodies are AST-exact. New version4 dispatch and ground-edge call are guarded by fields absent from every old definition. Old version1–3 validation domains retain their existing profiles and numeric limits.',
  'src/generation/world-study/r100-master-world.ts': 'Roles, meshes and raster construction move after deterministic land/matter loops. Old inputs pass undefined ground context; old erosion ownership validation returns without mutation. Remaining statements and old construction arguments compare exactly.',
  'src/generation/world-study/r100-package.ts': 'Revision6 changes only version/hash identity and adds strict erosion/edge validation plus optional selected-organization dependencies. All 156 old authored recipes are accepted in exact continuity tests. Saved revision5 uses the independently proven frozen recovery closure.',
  'src/generation/world-study/r100-production-map.ts': 'Old revision5 dispatch added; current metadata version changes5→6. Generation attempts, seed mixing, deployment and remaining map statements compare exactly.',
  'src/generation/world-study/r100-world-appearance.ts': 'New organization enum and optional validator clause only. Old profiles and ramps compare exactly; profileWithWorldAppearance is AST-exact.',
  'src/systems/r100-world/painted-material.ts': 'Undefined organization resolves the same original family row. prepareMaterial decoding is AST-exact; load cache, Promise lifecycle and surfaces are unchanged after resolver substitution.',
  'src/systems/r100-world/surface-bake.ts': 'Adds frozen revision5 routing. Current bakeMasterSurface and masterVolumePalette are AST-exact, including painterly sampling, roughness and all four RGBA channels.',
  'src/systems/r100-world-presentation.ts': 'Primary loader/admission receives the optional organization; all selected old worlds pass undefined and use the original family assets. Cache/abort/discard helpers are AST-exact. Formal revision6 scene entry/cold reconstruction remains pending.',
};
const changed = Object.keys(before.sources).filter(file => before.sources[file] !== after.sources[file]);
assert.deepEqual(changed.sort(), Object.keys(reviewedChanges).sort(), 'Unreviewed existing-file change');
const additions = Object.keys(after.sources).filter(file => !Object.hasOwn(before.sources, file));
assert.equal(additions.length, 19);
assert(additions.every(file => file.startsWith('src/generation/legacy-r100-v5/') || [
  'src/generated/r100-material-organizations.ts', 'src/generation/world-study/native-volume-erosion.ts',
  'src/generation/world-study/native-volume-ground-edge.ts', 'src/generation/world-study/native-volume-ground.ts',
  'data/rift-material-organizations.csv',
].includes(file) || /^public\/assets\/r100-materials\/(?:short-fibre|porous-marrow)-(?:ground|solid)-source\.png$/.test(file)), 'Unreviewed source addition');

const changedBodies = {
  'src/generation/world-study/native-volume-geometry.ts': ['validateNativeVolumeSpec', 'buildNativeVolume'],
  'src/generation/world-study/r100-master-world.ts': ['createMasterWorld'],
  'src/generation/world-study/r100-package.ts': ['materialDependencies', 'dependencyHash', 'createR100ProductionRecipe', 'validR100ProductionRecipe'],
  'src/generation/world-study/r100-production-map.ts': ['createR100ProductionMap'],
  'src/generation/world-study/r100-world-appearance.ts': ['validR100WorldAppearance'],
  'src/systems/r100-world/painted-material.ts': ['loadPaintedMaterial'],
  'src/systems/r100-world/surface-bake.ts': ['bakeMasterWorldSurface'],
  'src/systems/r100-world-presentation.ts': ['prepareR100Presentation', 'createR100WorldPresentation'],
};
const stableBodies = [];
for (const [file, allowed] of Object.entries(changedBodies)) {
  const a = parse(before, file), b = parse(after, file);
  for (const declaration of a.statements.filter(node => ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node))) {
    const name = declaration.name.text;
    const target = b.statements.find(node => (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name?.text === name);
    assert(target, `${file}:${name} removed`);
    if (!allowed.includes(name)) {
      assert.equal(print(declaration, a), print(target, b), `${file}:${name} changed`);
      stableBodies.push({ file, name, astSha256: sha(print(target, b)) });
    }
  }
}
const mapFile = 'src/generation/world-study/r100-production-map.ts';
const stripMapMetadata = source => source.replace(/^import .*createRevision5Map.*\n/m, '')
  .replace(/^  if \(recipe\.package\?\.algorithmRevision === 5\) return createRevision5Map\(recipe\);\n/m, '')
  .replace('algorithmRevision: 6, appearance:', 'algorithmRevision: 5, appearance:');
assert.equal(stripMapMetadata(load(after, mapFile)), load(before, mapFile));

// The exact legacy construction is moved, not reimplemented. Compare its
// canonical AST after removing only the explicit undefined-context adapter.
const masterFile = 'src/generation/world-study/r100-master-world.ts';
const master = snapshot => {
  const ast = parse(snapshot, masterFile), fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'createMasterWorld');
  const parts = new Map(); const rest = [];
  for (const statement of fn.body.statements) {
    const key = ts.isVariableStatement(statement) ? statement.declarationList.declarations[0].name.getText(ast) : '';
    if (['roles', 'meshes', 'raster'].includes(key)) parts.set(key, print(statement, ast));
    else if (statement.getText(ast) !== 'validateNativeGroundEdgeOwnership(definition);') rest.push(print(statement, ast));
  }
  return {parts, rest};
};
const aMaster = master(before), bMaster = master(after);
assert.deepEqual(aMaster.rest, bMaster.rest);
for (const key of ['roles', 'raster']) assert.equal(aMaster.parts.get(key), bMaster.parts.get(key));
const groundAdapter = ', instance.groundEdgeWidth === undefined ? undefined : { polygons: definition.erosion, width, height, matterAt }';
assert(bMaster.parts.get('meshes').includes(groundAdapter));
assert.equal(bMaster.parts.get('meshes').replace(groundAdapter, ''), aMaster.parts.get('meshes'));

const exactPath = `${base}/old52-organization-continuity/report.json`, exact = read(exactPath);
assert.equal(exact.status, 'pass'); assert.equal(exact.sourceBeforeAndAfterExact, true);
assert.deepEqual(exact.frozenSource, afterRef); assert.equal(exact.cases.length, 156);
assert.deepEqual(exact.cases.map(row => `${row.world}/${row.grade}`).sort(), worlds.flatMap(world => plan.grades.map(grade => `${world}/${grade}`)).sort());
const cpuPath = 'docs/qa/artifacts/r100-i07-i09/qualification-policy/final52-summary.json', cpu = read(cpuPath);
const playPath = 'docs/qa/artifacts/r100-i07-i09/final-fixed-play/summary.json', play = read(playPath);
assert.equal(cpu.status, 'pass'); assert.equal(cpu.successful, 7488); assert.equal(cpu.uniqueCases, 7488);
assert.deepEqual(cpu.missing, []); assert.deepEqual(cpu.unresolved, []);
assert.equal(play.status, 'pass'); assert.equal(play.qualifiedGradePairs, 156); assert.equal(play.completedSeedProcesses, 312);
assert.deepEqual(play.pairs.map(row => `${row.world}/${row.grade}`).sort(), exact.cases.map(row => `${row.world}/${row.grade}`).sort());
const packages = read(`${output}/packages/index.json`);
assert.deepEqual(packages.worlds.map(row => row.worldId), worlds);
for (const row of packages.worlds) {
  assert.equal(ref(row.dependencyManifest.path).sha256, row.dependencyManifest.hash);
  assert.equal(read(row.dependencyManifest.path).algorithm.revision, 6);
}
const report = {
  status: 'candidate-awaiting-independent-review', machineChecks: 'pass', algorithmRevision: 6,
  method: 'Complete frozen source inventories and all selected data projections checked; changed-path review plus exact156 map/fourRGBA proof. No historical execution is relabeled.',
  harness: ref(`${output}/audit.mjs`), qualificationPlan: ref(`${base}/qualification-plan.json`),
  before: beforeRef, after: afterRef, verifiedSourceFiles: { before: Object.keys(before.sources).length, after: Object.keys(after.sources).length },
  unchangedFiles: Object.keys(before.sources).filter(file => before.sources[file] === after.sources[file]).map(file => ({file, sha256: before.sources[file]})),
  reviewedChanges: changed.map(file => ({file, beforeSha256: before.sources[file], afterSha256: after.sources[file], review: reviewedChanges[file]})),
  additions: additions.map(file => ({file, sha256: after.sources[file]})), stableBodies,
  exactCurrentProof: ref(exactPath), archivedRecoveryProof: ref(`${base}/p19-revision5-closure/projection-exact-156.json`),
  historicalSourceContinuity: ref('docs/qa/artifacts/r100-i07-i09/final-binding/continuity-execution.json'),
  historicalGeneration: {...ref(cpuPath), executedAlgorithmRevision: 5, cases: 7488},
  historicalFixedPlay: {...ref(playPath), executedAlgorithmRevision: 5, completeOriginalSeedProcesses: 312, attemptsIncludingFailures: 315},
  currentPackages: ref(`${output}/packages/index.json`),
  worlds: packages.worlds.map(row => ({worldId: row.worldId, currentRevision: 6, dependencyManifest: row.dependencyManifest,
    grades: plan.grades.map(grade => ({grade, currentDependencyHash: exact.cases.find(item => item.world === row.worldId && item.grade === grade).revision6DependencyHash,
      generation: 'historical-r5-candidate-inheritance-48-seeds', fixedPlay: 'historical-r5-candidate-inheritance-two-original-seeds',
      currentFormalEntryAndColdResume: 'pending-final324', currentArt: 'existing-approval-plus-exact-output-continuity-no-new-human-signoff'}))})),
  limitations: ['Independent root approval required before ledger inheritance.', 'Exact rendering samples are52×3; broader-seed inheritance also relies on reviewed unchanged active code paths and exact authored data.',
    'Final324 revision6 formal entry/cold reconstruction,342 equivalence,108-world performance/resource/selection and48 natural trips remain separate pending work.',
    'No new human art or sound listening approval. I11 extra8 holdout for old52 is still required.'],
};
const destination = process.argv[2] ?? `${output}/candidate.json`;
assert(!fs.existsSync(destination), 'Never overwrite an inheritance attempt');
fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
console.log(`PASS scoped source checks: ${worlds.length} worlds, ${stableBodies.length} unchanged bodies, ${changed.length} reviewed changed files. Independent inheritance decision pending.`);
