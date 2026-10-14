/** Further specialize the retained revision11-only closure for saved recovery.
 * The public live factory still creates current packages. The old factory is
 * absent from this entry; its catalog is projected only after AST proof that
 * the sole remaining catalog use is the original exact world-ID membership. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { build, version as esbuildVersion } from 'esbuild';
import ts from 'typescript';

const directory = 'src/generation/legacy-r100-v11';
const sourceFile = `${directory}/executor-revision11.js`;
const sourceManifestFile = `${directory}/manifest-revision11.json`;
const output = `${directory}/executor-recovery.js`;
const manifestPath = `${directory}/manifest-recovery.json`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceManifest = JSON.parse(readFileSync(sourceManifestFile, 'utf8'));
assert.equal(sourceManifest.sourceRevision, 'ef50f137413284d2e1d796adb8d3a358f1e7df59');
assert.equal(sha(readFileSync(sourceFile)), sourceManifest.executorSha256);
assert.deepEqual(sourceManifest.admittedAlgorithmRevisions, [11]);
const entry = `export { createR100ProductionMap, validR100ProductionRecipe, bakeMasterWorldSurface, bakeSearchSitePatches, validateSearchSites, hydrateR100MasterWorld } from './${sourceFile}';\n`;
const settings = { bundle: true, format: 'esm', platform: 'browser', target: 'es2020', write: false,
  metafile: true, treeShaking: true, legalComments: 'none' };
const first = await build({ ...settings, stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: 'revision11-recovery-entry.js' } });
assert.deepEqual(Object.values(first.metafile.outputs).flatMap(row => row.imports), []);
const before = first.outputFiles[0].text;
const ast = ts.createSourceFile('revision11-recovery.js', before, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
assert.equal(ast.parseDiagnostics.length, 0);
const names = [], declarations = [];
function visit(node) {
  if (ts.isIdentifier(node) && node.text === 'R100_NATIVE_WORLDS') names.push(node);
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'R100_NATIVE_WORLDS') declarations.push(node);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.equal(declarations.length, 1, 'Exactly one immutable native-world array declaration');
assert.equal(names.length, 2, 'Exactly declaration plus one use; reject any additional catalog consumer');
const declaration = declarations[0], initializer = declaration.initializer;
assert(ts.isArrayLiteralExpression(initializer));
const use = names.find(node => node !== declaration.name);
assert(ts.isPropertyAccessExpression(use.parent) && use.parent.expression === use && use.parent.name.text === 'some');
const call = use.parent.parent;
assert(ts.isCallExpression(call) && call.expression === use.parent && call.arguments.length === 1);
assert.equal(call.getText(ast).replace(/\s+/g, ''), 'R100_NATIVE_WORLDS.some((world)=>`r100-${world.id}`===pack.id)',
  'Only the original exact ID membership predicate can consume the projection');
const ids = initializer.elements.map(element => {
  assert(ts.isObjectLiteralExpression(element));
  const matches = element.properties.filter(property => ts.isPropertyAssignment(property)
    && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === 'id');
  assert.equal(matches.length, 1); assert(ts.isStringLiteral(matches[0].initializer));
  return matches[0].initializer.text;
});
assert.equal(ids.length, 108); assert.equal(new Set(ids).size, 108);
assert(ids.every(id => /^[a-z][a-z0-9-]+$/.test(id)));
const projectedInitializer = `[${ids.map(id => `{id:${JSON.stringify(id)}}`).join(',')}]`;
const derived = before.slice(0, initializer.getStart(ast)) + projectedInitializer + before.slice(initializer.end);
const final = await build({ ...settings, stdin: { contents: derived, resolveDir: process.cwd(), sourcefile: 'revision11-projected-recovery.js' },
  banner: { js: `// IMMUTABLE revision11 recovery closure. Source: ${sourceManifest.sourceRevision}.\n// Exact 108-ID membership projection; reproduce tools/recovery/project-native-r100-revision11.mjs. Prior archives remain retained.` } });
const bytes = final.outputFiles[0].contents, imports = Object.values(final.metafile.outputs).flatMap(row => row.imports);
assert.deepEqual(imports, []);
const manifest = { schemaVersion: 1, id: 'r100-native-revision11-recovery', sourceRevision: sourceManifest.sourceRevision,
  source: { path: sourceFile, sha256: sourceManifest.executorSha256, manifest: sourceManifestFile, manifestSha256: sha(readFileSync(sourceManifestFile)) },
  original: sourceManifest.original, admittedAlgorithmRevisions: [11],
  entryExports: ['createR100ProductionMap', 'validR100ProductionRecipe', 'bakeMasterWorldSurface', 'bakeSearchSitePatches', 'validateSearchSites', 'hydrateR100MasterWorld'], entrySha256: sha(entry),
  projection: { reason: 'After entry tree-shaking, exactly one catalog consumer only reads id through the original membership predicate.',
    consumer: call.getText(ast), identifierReferences: names.length, ids,
    beforeBundleSha256: sha(before), originalInitializerSha256: sha(initializer.getText(ast)),
    projectedInitializerSha256: sha(projectedInitializer), projectedBundleSha256: sha(derived),
    removedFieldsCannotBeRead: true },
  tool: { path: 'tools/recovery/project-native-r100-revision11.mjs', sha256: sha(readFileSync(new URL(import.meta.url))) },
  esbuildVersion, typescriptVersion: ts.version, executorSha256: sha(bytes), executorBytes: bytes.length, imports,
  preservedPublicContract: 'Outer synchronous revision1–11 dispatcher unchanged. Only the internal revision11 recovery entry is specialized; current package creation remains live revision12.' };
const json = JSON.stringify(manifest, null, 2) + '\n';
if (process.argv.includes('--write')) {
  assert(!existsSync(output) && !existsSync(manifestPath), 'Never overwrite earlier projection evidence');
  writeFileSync(output, bytes); writeFileSync(manifestPath, json);
} else {
  assert.deepEqual(readFileSync(output), Buffer.from(bytes));
  assert.equal(readFileSync(manifestPath, 'utf8'), json);
}
console.log(JSON.stringify({ status: 'pass', output, bytes: bytes.length, previousBytes: sourceManifest.executorBytes,
  sha256: manifest.executorSha256, catalogIds: ids.length, catalogConsumers: 1, imports }));
