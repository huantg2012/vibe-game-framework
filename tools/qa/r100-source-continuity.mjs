/** Bind an earlier world's evidence to an append-only catalog snapshot.
 * Unknown runtime changes fail closed. Narrow unused-shape exceptions
 * are checked against every selected world's authored instances and AST bodies.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { assertRemainsSourceContinuity } from './r100-remains-source-continuity.mjs';
import { assertOrganizationDispatchContinuity, assertInertOrganizationSource } from './r100-organization-dispatch-continuity.mjs';
import { assertInactivePresentationChanges } from './r100-inactive-presentation-continuity.mjs';
import { assertExplicitProfileContinuity } from './r100-explicit-profile-continuity.mjs';
import { assertSettledProjectionContinuity } from './r100-settled-projection-continuity.mjs';
import { assertReviewedStartupRepair, assertUnusedMaterialExtension, STARTUP_HELPER } from './r100-reviewed-startup-continuity.mjs';

const arg = name => process.argv[process.argv.indexOf(name) + 1];
for (const name of ['--from', '--to', '--worlds', '--output']) assert(process.argv.includes(name), `Missing ${name}`);
const fromPath = arg('--from'), toPath = arg('--to'), output = arg('--output');
const mode = process.argv.includes('--unused-shape-change') ? arg('--unused-shape-change') : 'none';
const allowUnusedRemains = process.argv.includes('--unused-remains-forms');
const allowUnusedOrganizations = process.argv.includes('--unused-organization-profiles');
const allowInactivePresentation = process.argv.includes('--inactive-presentation-branches');
const allowExplicitProfiles = process.argv.includes('--unused-explicit-profiles');
const allowReviewedStartup = process.argv.includes('--reviewed-startup-material-change');
const allowSettledProjection = process.argv.includes('--unused-settled-projection');
assert(['none', 'v3-only', 'terrace-only', 'unused-profiles', 'v4-only'].includes(mode));
assert(!allowUnusedOrganizations || mode === 'none', 'Organization addition must be audited without other shape exceptions');
assert(!allowInactivePresentation || (mode === 'none' && !allowUnusedOrganizations), 'Inactive presentation changes require a separate source edge');
assert(!allowExplicitProfiles || (mode === 'none' && !allowUnusedOrganizations && !allowInactivePresentation && !allowUnusedRemains),
  'Explicit profile additions require a separate source edge');
assert(!allowReviewedStartup || (mode === 'none' && !allowUnusedOrganizations && !allowInactivePresentation && !allowUnusedRemains),
  'The reviewed transport/material migration may only combine with the disjoint explicit-profile proof');
assert(!allowSettledProjection || (mode === 'none' && !allowUnusedOrganizations && !allowInactivePresentation && !allowExplicitProfiles && !allowReviewedStartup && !allowUnusedRemains),
  'The two shallow projection profiles require their own separate source edge');
const worlds = arg('--worlds').split(',');
assert(worlds.length && new Set(worlds).size === worlds.length);
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const before = read(fromPath), after = read(toPath);
const load = (snapshot, file) => {
  const bytes = fs.readFileSync(path.join(snapshot.temporaryRoot, file));
  assert.equal(sha(bytes), snapshot.sources[file], `Frozen input drifted: ${file}`);
  return bytes.toString('utf8');
};
const parse = (snapshot, file) => ts.createSourceFile(file, load(snapshot, file), ts.ScriptTarget.Latest, true);
function literal(snapshot, file, name) {
  const ast = parse(snapshot, file);
  for (const statement of ast.statements) if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) if (declaration.name.getText(ast) === name) {
      let value = declaration.initializer;
      while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value))) value = value.expression;
      return JSON.parse(value.getText(ast));
    }
  }
  throw new Error(`Missing literal ${file}:${name}`);
}
const catalog = 'src/generated/r100-native-worlds.ts';
const oldWorlds = literal(before, catalog, 'R100_NATIVE_WORLDS');
const newWorlds = literal(after, catalog, 'R100_NATIVE_WORLDS');
const pick = (rows, id, field = 'id') => { const matches = rows.filter(row => row[field] === id); assert.equal(matches.length, 1, id); return matches[0]; };
const withoutEnabled = ({ enabled, ...content }) => content;
const projections = [];
const materialKeys = new Set();
const selectedGrammars = [];
const selectedInstances = [];
const selectedAppearances = [];
for (const world of worlds) {
  const old = pick(oldWorlds, world), current = pick(newWorlds, world);
  assert.deepEqual(withoutEnabled(old), withoutEnabled(current), `World content changed: ${world}`);
  const instances = old.definitions.flatMap(definition => definition.instances);
  selectedInstances.push(...instances);
  for (const definition of old.definitions) {
    assert.equal(typeof definition.family, 'string', 'Selected native material family is explicit');
    materialKeys.add(definition.family);
    for (const instance of definition.instances) materialKeys.add(instance.family ?? definition.family);
  }
  if (mode === 'v3-only') assert(instances.every(instance => (instance.constructionVersion ?? 1) < 3), `${world} uses v3`);
  if (mode === 'terrace-only') assert(instances.every(instance => instance.shapeProfile !== 'terrace-shelf'), `${world} uses terrace`);
  if (mode === 'unused-profiles') assert(instances.every(instance => !['pleated-sheet', 'cellular-shell', 'monolith-buttress', 'terrace-shelf'].includes(instance.shapeProfile)), `${world} uses a revised profile`);
  if (mode === 'v4-only') assert(instances.every(instance => (instance.constructionVersion ?? 1) < 4
    && instance.groundEdgeWidth === undefined), `${world} uses v4 or authored ground edges`);
  projections.push({ worldId: world, contentSha256: sha(JSON.stringify(withoutEnabled(old))),
    enabledBefore: old.enabled, enabledAfter: current.enabled });
}
const projected = new Set([catalog, 'data/rift-native-worlds.csv']);
for (const [file, name, csv] of [
  ['src/generated/r100-world-appearance.ts', 'R100_WORLD_APPEARANCES', 'data/rift-world-appearance.csv'],
  ['src/generated/rift-search-remains.ts', 'SEARCH_REMAINS', 'data/rift-search-remains.csv'],
]) {
  const old = literal(before, file, name), current = literal(after, file, name);
  for (const world of worlds) {
    const previous = pick(old, world, 'worldId');
    assert.deepEqual(previous, pick(current, world, 'worldId'), `${file}:${world}`);
    if (name === 'R100_WORLD_APPEARANCES' && previous.materialOrganization)
      materialKeys.add(`organization:${previous.materialOrganization}`);
    if (name === 'R100_WORLD_APPEARANCES') selectedAppearances.push(previous);
    if (name === 'SEARCH_REMAINS') selectedGrammars.push(previous.grammar);
  }
  projected.add(file); projected.add(csv);
}
// The catalog receipt legitimately changes when new rows are appended. Actual
// material bytes and the material dependency values must still be identical.
const receipt = 'src/generated/r100-package-manifest.ts';
const priorMaterials = literal(before, receipt, 'R100_MATERIAL_DEPENDENCIES');
const currentMaterials = literal(after, receipt, 'R100_MATERIAL_DEPENDENCIES');
for (const key of materialKeys) {
  assert(Object.hasOwn(priorMaterials, key) && Object.hasOwn(currentMaterials, key), `Missing used material dependency: ${key}`);
  assert.deepEqual(priorMaterials[key], currentMaterials[key], `Used material dependency changed: ${key}`);
}
projected.add(receipt);
const printer = ts.createPrinter({ removeComments: true });
function outsideFunctions(snapshot, file, names) {
  const ast = parse(snapshot, file);
  return ast.statements.filter(statement => !(ts.isFunctionDeclaration(statement)
    && (names === null || names.includes(statement.name?.text))))
    .map(statement => printer.printNode(ts.EmitHint.Unspecified, statement, ast)).join('\n');
}
const groundFile = 'src/generation/world-study/native-volume-ground.ts';
const geometryFile = 'src/generation/world-study/native-volume-geometry.ts';
const organizationFile = 'src/generation/world-study/native-volume-organization.ts';
const surfaceFile = 'src/systems/r100-world/surface-bake.ts';
const samplingFile = 'src/systems/r100-world/organization-sampling.ts';
const edgeFile = 'src/generation/world-study/native-volume-ground-edge.ts';
const expansionFile = 'src/generation/world-study/native-volume-expansion.ts';
const tearFile = 'src/generation/world-study/native-volume-pleated-tear.ts';
const settledFile = 'src/generation/world-study/native-volume-settled-sheet.ts';
const settledProjectionFile = 'src/generation/world-study/native-volume-settled-projection.ts';
const organizationContinuity = allowUnusedOrganizations ? assertOrganizationDispatchContinuity({
  oldGeometry: load(before, geometryFile), newGeometry: load(after, geometryFile),
  oldGround: load(before, groundFile), newGround: load(after, groundFile),
  module: load(after, organizationFile), instances: selectedInstances,
}) : undefined;
const consumers = (snapshot, module) => Object.keys(snapshot.sources).filter(file => {
    if (!/\.[cm]?[jt]sx?$/.test(file)) return false;
    const content = load(snapshot, file);
    if (!content.includes(path.posix.basename(module, '.ts'))) return false;
    return ts.preProcessFile(content, true, true).importedFiles.some(reference => {
      const name = reference.fileName;
      const target = name.startsWith('@/') ? `src/${name.slice(2)}`
        : name.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), name)) : name;
      return target.replace(/\.ts$/, '') === module.replace(/\.ts$/, '');
    });
  }).sort();
const settledProjectionContinuity = allowSettledProjection ? assertSettledProjectionContinuity({
  oldGeometry: load(before, geometryFile), newGeometry: load(after, geometryFile),
  oldGround: load(before, groundFile), newGround: load(after, groundFile),
  module: load(after, settledProjectionFile), instances: selectedInstances,
}) : undefined;
if (settledProjectionContinuity) {
  assert(!before.sources[settledProjectionFile], 'The shallow projection module must be a new addition');
  assert.deepEqual(consumers(after, settledProjectionFile), [groundFile], 'Only the exact two audited ground cases may consume the inert module');
}
const startupReviewPath = 'docs/qa/artifacts/r100-i10-i12/worker-startup-retry/independent-pipeline-review.json';
const startupRepair = allowReviewedStartup ? assertReviewedStartupRepair({
  before: file => load(before, file), after: file => load(after, file), review: read(startupReviewPath),
}) : undefined;
const materialExtension = allowReviewedStartup ? assertUnusedMaterialExtension({
  before: file => load(before, file), after: file => load(after, file),
  literal: (side, file, name) => literal(side === 'before' ? before : after, file, name),
  appearances: selectedAppearances,
}) : undefined;
if (startupRepair) {
  assert(!before.sources[STARTUP_HELPER], 'Migration must begin before the reviewed transport helper exists');
  assert.deepEqual(consumers(after, STARTUP_HELPER), Object.keys({
    'src/generation/rift-generation-client.ts': 1,
    'src/systems/r100-world/surface-preparation-client.ts': 1,
  }).sort(), 'The retry helper may only be consumed by the two reviewed clients');
}
const removedCandidate = 'src/generation/world-study/native-volume-compressed-felt.ts';
const candidateRemoved = allowReviewedStartup && before.sources[removedCandidate] && !after.sources[removedCandidate];
if (candidateRemoved) {
  load(before, removedCandidate);
  // Reject even non-import string references, including dynamic import targets.
  for (const snapshot of [before, after]) for (const file of Object.keys(snapshot.sources)) {
    if (file === removedCandidate || !/\.[cm]?[jt]sx?$/.test(file)) continue;
    assert(!load(snapshot, file).includes('native-volume-compressed-felt'), `Removed candidate still referenced by ${file}`);
  }
}
if (organizationContinuity) {
  assert.deepEqual(consumers(before, organizationFile), [], 'Preexisting organization module must have no imported consumers');
  assert.deepEqual(consumers(after, organizationFile), [geometryFile, groundFile].sort(), 'Only the two audited guarded entries may import organization geometry');
}
const explicitProfileContinuity = allowExplicitProfiles ? assertExplicitProfileContinuity({
  oldExpansion: load(before, expansionFile), newExpansion: load(after, expansionFile),
  oldGround: load(before, groundFile), newGround: load(after, groundFile),
  oldGeometry: load(before, geometryFile), newGeometry: load(after, geometryFile),
  tearModule: load(after, tearFile), settledModule: load(after, settledFile), instances: selectedInstances,
}) : undefined;
if (explicitProfileContinuity) {
  assert.deepEqual(consumers(before, tearFile), []);
  assert.deepEqual(consumers(before, settledFile), []);
  assert.deepEqual(consumers(after, tearFile), [expansionFile], 'Only the audited opt-in tear branch may import the new module');
  assert.deepEqual(consumers(after, settledFile), [groundFile], 'Only the audited explicit ground dispatch may import the new module');
  if (startupRepair) {
    const shapeFiles = [geometryFile, expansionFile, groundFile, tearFile, settledFile];
    assert([...startupRepair.changedFiles, ...startupRepair.addedFiles, ...materialExtension.changedFiles, ...materialExtension.addedFiles]
      .every(file => !shapeFiles.includes(file)), 'Combined proofs must audit disjoint files');
  }
}
const inactivePresentationContinuity = allowInactivePresentation ? assertInactivePresentationChanges({
  beforeSurface: load(before, surfaceFile), afterSurface: load(after, surfaceFile),
  beforeGeometry: load(before, geometryFile), afterGeometry: load(after, geometryFile),
  samplingModule: load(after, samplingFile), edgeModule: load(after, edgeFile),
  beforeEdgeModule: load(before, edgeFile),
  instances: selectedInstances, appearances: selectedAppearances,
}) : undefined;
if (inactivePresentationContinuity) {
  assert.deepEqual(consumers(before, samplingFile), []); assert.deepEqual(consumers(after, samplingFile), [surfaceFile]);
  assert.deepEqual(consumers(before, edgeFile), [geometryFile]); assert.deepEqual(consumers(after, edgeFile), [geometryFile]);
  assert.deepEqual(consumers(before, organizationFile), []); assert.deepEqual(consumers(after, organizationFile), []);
  assertInertOrganizationSource(load(after, organizationFile));
}
function assertInertV4Module(snapshot) {
  const ast = parse(snapshot, groundFile); assert.equal(ast.parseDiagnostics.length, 0);
  const inertValue = node => {
    if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) return inertValue(node.expression);
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return true;
    if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true;
    return ts.isArrayLiteralExpression(node) && node.elements.every(inertValue);
  };
  for (const statement of ast.statements) {
    if (ts.isImportDeclaration(statement)) {
      assert(statement.importClause?.isTypeOnly, 'Unused v4 module may import types only'); continue;
    }
    if (ts.isFunctionDeclaration(statement)) {
      assert(statement.name, 'No anonymous v4 entry');
      if (statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
        assert.equal(statement.name.text, 'buildGroundNativeVolume', 'Only the guarded v4 entry may be exported');
      continue;
    }
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) continue;
    assert(ts.isVariableStatement(statement) && (statement.declarationList.flags & ts.NodeFlags.Const), 'No v4 top-level execution');
    for (const declaration of statement.declarationList.declarations)
      assert(ts.isIdentifier(declaration.name) && declaration.initializer && inertValue(declaration.initializer), 'No executable v4 initializer');
  }
}
if (mode === 'v4-only') {
  const geometry = 'src/generation/world-study/native-volume-geometry.ts';
  for (const file of [geometry, 'src/generation/world-study/native-volume-expansion.ts']) {
    assert(before.sources[file] && after.sources[file], 'Both dispatch and shared Builder sources are required');
    assert.equal(before.sources[file], after.sources[file], `V4 exception cannot change old dispatch/shared Builder: ${file}`);
  }
  const ast = parse(before, geometry), calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'buildGroundNativeVolume') calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.equal(calls.length, 1, 'One guarded v4 geometry call required');
  const call = calls[0], statement = call.parent, guard = statement.parent;
  assert(ts.isExpressionStatement(statement) && ts.isIfStatement(guard) && guard.thenStatement === statement);
  assert.equal(guard.expression.getText(ast), 'spec.constructionVersion === 4');
  assert.equal(call.getText(ast), 'buildGroundNativeVolume(builder)');
  assertInertV4Module(before); assertInertV4Module(after);
}
const allowedShapeFiles = mode === 'none' ? [] : mode === 'terrace-only'
  ? ['src/generation/world-study/native-volume-expansion.ts']
  : mode === 'v4-only' ? [groundFile]
  : ['src/generation/world-study/native-volume-expansion.ts', 'src/generation/world-study/native-volume-cellular.ts'];
const changed = [], identical = [];
let remainsContinuity;
for (const [file, oldHash] of Object.entries(before.sources)) {
  if (candidateRemoved && file === removedCandidate) {
    changed.push({ file, reason: 'Removed unregistered candidate: verified old bytes and no source import/string consumers in either snapshot' }); continue;
  }
  assert(after.sources[file], `A runtime/source file disappeared: ${file}`);
  // Verify both copies; matching metadata alone is not evidence of matching bytes.
  load(before, file); load(after, file);
  if (oldHash === after.sources[file]) { identical.push(file); continue; }
  if (projected.has(file)) { changed.push({ file, reason: 'selected world projection unchanged; catalog or enabled rows may expand' }); continue; }
  if (allowUnusedRemains && file === 'src/generation/world-study/search-remains.ts') {
    remainsContinuity = assertRemainsSourceContinuity(load(before, file), load(after, file), selectedGrammars);
    changed.push({ file, reason: remainsContinuity.rule }); continue;
  }
  if (organizationContinuity && [geometryFile, groundFile, organizationFile].includes(file)) {
    changed.push({ file, reason: organizationContinuity.scope }); continue;
  }
  if (inactivePresentationContinuity && [surfaceFile, edgeFile].includes(file)) {
    changed.push({ file, reason: inactivePresentationContinuity.scope }); continue;
  }
  if (explicitProfileContinuity && [geometryFile, expansionFile, groundFile].includes(file)) {
    changed.push({ file, reason: explicitProfileContinuity.scope }); continue;
  }
  if (settledProjectionContinuity && [geometryFile, groundFile].includes(file)) {
    changed.push({ file, reason: settledProjectionContinuity.scope }); continue;
  }
  if (startupRepair?.changedFiles.includes(file) || materialExtension?.changedFiles.includes(file)) {
    changed.push({ file, reason: startupRepair.changedFiles.includes(file) ? startupRepair.scope : materialExtension.scope }); continue;
  }
  assert(allowedShapeFiles.includes(file), `Unreviewed runtime change: ${file}`);
  const omitted = mode === 'terrace-only' ? ['terraceShelf'] : mode === 'unused-profiles'
    ? file.endsWith('native-volume-cellular.ts') ? ['buildCellularShell'] : ['pleatedSheet', 'monolithButtress', 'terraceShelf'] : null;
  assert.equal(outsideFunctions(before, file, omitted), outsideFunctions(after, file, omitted), `Module code outside unused shape functions changed: ${file}`);
  changed.push({ file, reason: `Only unused ${mode} shape function bodies changed; dispatch and selected instance versions unchanged` });
}
const additions = Object.keys(after.sources).filter(file => !before.sources[file]);
for (const file of additions) load(after, file);
// Appended files require separate review; do not assume a new shader/module is inert.
const reviewedAdditionNames = settledProjectionContinuity ? [settledProjectionFile]
  : organizationContinuity ? [organizationFile]
  : inactivePresentationContinuity ? [organizationFile, samplingFile]
  : [...(explicitProfileContinuity ? [tearFile, settledFile] : []),
    ...(startupRepair ? [...startupRepair.addedFiles, ...materialExtension.addedFiles] : [])];
const unreviewedAdditions = additions.filter(file => !reviewedAdditionNames.includes(file));
assert.equal(unreviewedAdditions.length, 0, `Unexpected new source files: ${unreviewedAdditions.join(', ')}`);
if (settledProjectionContinuity) assert.deepEqual(additions, [settledProjectionFile], 'Only the exact inert shallow projection module may be added');
if (organizationContinuity) assert.deepEqual(additions, before.sources[organizationFile] ? [] : [organizationFile], 'Only an unimported or newly added organization module may be admitted');
if (inactivePresentationContinuity) assert.deepEqual([...additions].sort(), [organizationFile, samplingFile].sort(), 'Only the two audited inactive modules may be added');
if (explicitProfileContinuity || startupRepair) assert.deepEqual([...additions].sort(), [...reviewedAdditionNames].sort(), 'Only the exact independently audited addition sets may be combined');
const result = { status: 'pass', scope: 'Earlier evidence remains applicable to the listed world content and unchanged runtime paths. This creates no new art/play approval, and enabled-pool behavior still needs formal entry and selection tests.',
  before: { path: fromPath, sha256: sha(fs.readFileSync(fromPath)) }, after: { path: toPath, sha256: sha(fs.readFileSync(toPath)) },
  mode, worlds: projections, materialDependencyKeys: [...materialKeys].sort(), unchangedFiles: identical.length, reviewedChanges: changed,
  ...(remainsContinuity ? { remainsContinuity } : {}),
  ...(settledProjectionContinuity ? { settledProjectionContinuity, reviewedAdditions: additions } : {}),
  ...(organizationContinuity ? { organizationContinuity, reviewedAdditions: additions } : {}),
  ...(inactivePresentationContinuity ? { inactivePresentationContinuity, reviewedAdditions: additions } : {}),
  ...(explicitProfileContinuity ? { explicitProfileContinuity, reviewedAdditions: additions } : {}),
  ...(startupRepair ? { startupRepair, materialExtension, candidateRemoved: !!candidateRemoved, reviewedAdditions: additions,
    startupReview: { path: startupReviewPath, sha256: sha(fs.readFileSync(startupReviewPath)) },
    evidenceBoundary: 'Reuse is limited to successful content generation, normal images, and actual completed processes without startup errors. Transport behavior changed; original failed attempts stay failed. No old entry/cold-resume, performance/loading evidence, or P36 closure is inherited.' } : {}),
  limitations: 'Catalog codegen consistency is checked independently. Existing source copies must remain available to repeat this comparison.' };
assert(!fs.existsSync(output), 'Do not overwrite continuity evidence');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(`PASS source continuity: ${worlds.length} world projections, ${identical.length} identical files, ${changed.length} narrowly checked changes`);
