/** Bind an earlier world's evidence to an append-only catalog snapshot.
 * Unknown runtime changes fail closed. The two narrow unused-shape exceptions
 * are checked against every selected world's authored instances and AST bodies.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const arg = name => process.argv[process.argv.indexOf(name) + 1];
for (const name of ['--from', '--to', '--worlds', '--output']) assert(process.argv.includes(name), `Missing ${name}`);
const fromPath = arg('--from'), toPath = arg('--to'), output = arg('--output');
const mode = process.argv.includes('--unused-shape-change') ? arg('--unused-shape-change') : 'none';
assert(['none', 'v3-only', 'terrace-only', 'unused-profiles'].includes(mode));
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
for (const world of worlds) {
  const old = pick(oldWorlds, world), current = pick(newWorlds, world);
  assert.deepEqual(withoutEnabled(old), withoutEnabled(current), `World content changed: ${world}`);
  const instances = old.definitions.flatMap(definition => definition.instances);
  if (mode === 'v3-only') assert(instances.every(instance => (instance.constructionVersion ?? 1) < 3), `${world} uses v3`);
  if (mode === 'terrace-only') assert(instances.every(instance => instance.shapeProfile !== 'terrace-shelf'), `${world} uses terrace`);
  if (mode === 'unused-profiles') assert(instances.every(instance => !['pleated-sheet', 'cellular-shell', 'monolith-buttress', 'terrace-shelf'].includes(instance.shapeProfile)), `${world} uses a revised profile`);
  projections.push({ worldId: world, contentSha256: sha(JSON.stringify(withoutEnabled(old))),
    enabledBefore: old.enabled, enabledAfter: current.enabled });
}
const projected = new Set([catalog, 'data/rift-native-worlds.csv']);
for (const [file, name, csv] of [
  ['src/generated/r100-world-appearance.ts', 'R100_WORLD_APPEARANCES', 'data/rift-world-appearance.csv'],
  ['src/generated/rift-search-remains.ts', 'SEARCH_REMAINS', 'data/rift-search-remains.csv'],
]) {
  const old = literal(before, file, name), current = literal(after, file, name);
  for (const world of worlds) assert.deepEqual(pick(old, world, 'worldId'), pick(current, world, 'worldId'), `${file}:${world}`);
  projected.add(file); projected.add(csv);
}
// The catalog receipt legitimately changes when new rows are appended. Actual
// material bytes and the material dependency values must still be identical.
const receipt = 'src/generated/r100-package-manifest.ts';
assert.deepEqual(literal(before, receipt, 'R100_MATERIAL_DEPENDENCIES'), literal(after, receipt, 'R100_MATERIAL_DEPENDENCIES'));
projected.add(receipt);
const printer = ts.createPrinter({ removeComments: true });
function outsideFunctions(snapshot, file, names) {
  const ast = parse(snapshot, file);
  return ast.statements.filter(statement => !(ts.isFunctionDeclaration(statement)
    && (names === null || names.includes(statement.name?.text))))
    .map(statement => printer.printNode(ts.EmitHint.Unspecified, statement, ast)).join('\n');
}
const allowedShapeFiles = mode === 'none' ? [] : mode === 'terrace-only'
  ? ['src/generation/world-study/native-volume-expansion.ts']
  : ['src/generation/world-study/native-volume-expansion.ts', 'src/generation/world-study/native-volume-cellular.ts'];
const changed = [], identical = [];
for (const [file, oldHash] of Object.entries(before.sources)) {
  assert(after.sources[file], `A runtime/source file disappeared: ${file}`);
  // Verify both copies; matching metadata alone is not evidence of matching bytes.
  load(before, file); load(after, file);
  if (oldHash === after.sources[file]) { identical.push(file); continue; }
  if (projected.has(file)) { changed.push({ file, reason: 'selected world projection unchanged; catalog or enabled rows may expand' }); continue; }
  assert(allowedShapeFiles.includes(file), `Unreviewed runtime change: ${file}`);
  const omitted = mode === 'terrace-only' ? ['terraceShelf'] : mode === 'unused-profiles'
    ? file.endsWith('native-volume-cellular.ts') ? ['buildCellularShell'] : ['pleatedSheet', 'monolithButtress', 'terraceShelf'] : null;
  assert.equal(outsideFunctions(before, file, omitted), outsideFunctions(after, file, omitted), `Module code outside unused shape functions changed: ${file}`);
  changed.push({ file, reason: `Only unused ${mode} shape function bodies changed; dispatch and selected instance versions unchanged` });
}
const additions = Object.keys(after.sources).filter(file => !before.sources[file]);
// Appended files require separate review; do not assume a new shader/module is inert.
assert.equal(additions.length, 0, `Unexpected new source files: ${additions.join(', ')}`);
const result = { status: 'pass', scope: 'Earlier evidence remains applicable to the listed world content and unchanged runtime paths. This creates no new art/play approval, and enabled-pool behavior still needs formal entry and selection tests.',
  before: { path: fromPath, sha256: sha(fs.readFileSync(fromPath)) }, after: { path: toPath, sha256: sha(fs.readFileSync(toPath)) },
  mode, worlds: projections, unchangedFiles: identical.length, reviewedChanges: changed,
  limitations: 'Catalog codegen consistency is checked independently. Existing source copies must remain available to repeat this comparison.' };
assert(!fs.existsSync(output), 'Do not overwrite continuity evidence');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
console.log(`PASS source continuity: ${worlds.length} world projections, ${identical.length} identical files, ${changed.length} narrowly checked changes`);
