/** Derive the revision-7-only synchronous executor from the immutable Git source.
 * Historical routing remains at the live public boundary. This artifact cannot
 * dispatch revisions 1–6, so it does not embed a second copy of their closures.
 * The original through-revision7 archive is preserved as the equality oracle. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build, version as esbuildVersion } from 'esbuild';
import ts from 'typescript';

const revision = 'b2d737901ebe6e7ea61c4ea37be3470370d981a4';
const archiveDirectory = 'src/generation/legacy-r100-v7';
const output = `${archiveDirectory}/executor-revision7.js`;
const manifestPath = `${archiveDirectory}/manifest-revision7.json`;
const entry = `export { createR100ProductionMap } from './src/generation/world-study/r100-production-map';\nexport { createR100ProductionRecipe, validR100ProductionRecipe } from './src/generation/world-study/r100-package';\nexport { bakeMasterWorldSurface } from './src/systems/r100-world/surface-bake';\n`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const original = JSON.parse(readFileSync(`${archiveDirectory}/manifest.json`, 'utf8'));
assert.equal(original.sourceRevision, revision);
assert.equal(sha(readFileSync(`${archiveDirectory}/executor.js`)), original.executorSha256);
const compact = source => source.replace(/\s+/g, '');
const specifications = [
  {
    file: 'src/generation/world-study/r100-package.ts', functionName: 'validR100ProductionRecipe', inTry: true,
    imports: ['validFrozenR100ProductionRecipe', 'validRevision3Recipe', 'validRevision4Recipe', 'validRevision5Recipe', 'validRevision6Recipe'],
    routes: [
      "if(pack?.algorithmRevision===1||pack?.algorithmRevision===2)returnvalidFrozenR100ProductionRecipe(value);",
      'if(pack?.algorithmRevision===3)returnvalidRevision3Recipe(value);',
      'if(pack?.algorithmRevision===4)returnvalidRevision4Recipe(value);',
      'if(pack?.algorithmRevision===5)returnvalidRevision5Recipe(value);',
      'if(pack?.algorithmRevision===6)returnvalidRevision6Recipe(value);',
    ],
  },
  {
    file: 'src/generation/world-study/r100-production-map.ts', functionName: 'createR100ProductionMap',
    imports: ['createRevision4Map', 'createRevision3Map', 'createFrozenR100ProductionMap', 'createRevision5Map', 'createRevision6Map'],
    routes: [
      'if(recipe.package?.algorithmRevision===1||recipe.package?.algorithmRevision===2)returncreateFrozenR100ProductionMap(recipe);',
      'if(recipe.package?.algorithmRevision===3)returncreateRevision3Map(recipe);',
      'if(recipe.package?.algorithmRevision===4)returncreateRevision4Map(recipe);',
      'if(recipe.package?.algorithmRevision===5)returncreateRevision5Map(recipe);',
      'if(recipe.package?.algorithmRevision===6)returncreateRevision6Map(recipe);',
    ],
  },
  {
    file: 'src/systems/r100-world/surface-bake.ts', functionName: 'bakeMasterWorldSurface',
    imports: ['bakeRevision4Surface', 'bakeRevision3Surface', 'bakeRevision5Surface', 'bakeRevision6Surface'],
    routes: [
      'if(!world.appearance)returnbakeRevision3Surface(world,painting);',
      'if(world.algorithmRevision===undefined)returnbakeRevision4Surface(world,painting);',
      'if(world.algorithmRevision===5)returnbakeRevision5Surface(world,painting);',
      'if(world.algorithmRevision===6)returnbakeRevision6Surface(world,painting);',
    ],
    replacement: "if (world.algorithmRevision !== 7 || !world.appearance) throw new Error('Revision 7 surface requires an explicit revision 7 world with appearance');",
  },
];

/** Select exact AST nodes, then edit only their spans. No generated algorithm,
 * material code, number, data row or remaining whitespace is rewritten. */
function specialize(source, specification) {
  const ast = ts.createSourceFile(specification.file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert.equal(ast.parseDiagnostics.length, 0);
  const edits = [];
  for (const alias of specification.imports) {
    const matches = ast.statements.filter(node => ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && /legacy-r100-v[23456]\/executor(?:-recovery)?\.js$/.test(node.moduleSpecifier.text)
      && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
      && node.importClause.namedBindings.elements.length === 1
      && node.importClause.namedBindings.elements[0].name.text === alias);
    assert.equal(matches.length, 1, `Exact historical import required: ${alias}`);
    const node = matches[0]; edits.push({ start: node.getStart(ast), end: node.end, before: node.getText(ast), after: '', kind: 'remove-unreachable-historical-import' });
  }
  const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === specification.functionName);
  assert.equal(functions.length, 1); assert(functions[0].body);
  let statements = functions[0].body.statements;
  if (specification.inTry) {
    const blocks = statements.filter(ts.isTryStatement); assert.equal(blocks.length, 1);
    statements = blocks[0].tryBlock.statements;
  }
  for (const [index, expected] of specification.routes.entries()) {
    const matches = statements.filter(node => ts.isIfStatement(node) && compact(node.getText(ast)) === expected);
    assert.equal(matches.length, 1, `Exact historical route required: ${expected}`);
    const node = matches[0];
    assert(ts.isReturnStatement(node.thenStatement) && !node.elseStatement);
    edits.push({ start: node.getStart(ast), end: node.end, before: node.getText(ast),
      after: index === 0 ? specification.replacement ?? '' : '', kind: specification.replacement ? 'replace-historical-surface-route-with-revision7-guard' : 'remove-unreachable-historical-route' });
  }
  let derived = source;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    assert.equal(derived.slice(edit.start, edit.end), edit.before);
    derived = derived.slice(0, edit.start) + edit.after + derived.slice(edit.end);
  }
  // Existing revision-7 recipe validation remains the authoritative map gate.
  if (specification.functionName === 'validR100ProductionRecipe') assert(derived.includes('pack.algorithmRevision !== 7'));
  if (specification.functionName === 'createR100ProductionMap') assert(derived.includes("if (!validR100ProductionRecipe(recipe)) throw new Error('Invalid or unavailable native world package');"));
  return { derived, receipt: { path: specification.file, originalSha256: sha(source), derivedSha256: sha(derived), edits } };
}

const temporary = mkdtempSync(join(tmpdir(), 'coh-revision7-only-'));
try {
  const archive = spawnSync('git', ['archive', revision, 'src', 'tsconfig.json'], { maxBuffer: 64 * 1024 * 1024 });
  assert.equal(archive.status, 0, archive.stderr.toString());
  const extraction = spawnSync('tar', ['-x', '-C', temporary], { input: archive.stdout });
  assert.equal(extraction.status, 0, extraction.stderr.toString());
  const transformations = specifications.map(specification => {
    const file = join(temporary, specification.file), source = readFileSync(file, 'utf8');
    const { derived, receipt } = specialize(source, specification);
    writeFileSync(file, derived); return receipt;
  });
  const result = await build({ absWorkingDir: temporary,
    stdin: { contents: entry, resolveDir: temporary, sourcefile: 'revision7-only-entry.ts' },
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020', write: false,
    metafile: true, tsconfig: join(temporary, 'tsconfig.json'), treeShaking: true, legalComments: 'none',
    banner: { js: `// IMMUTABLE revision-7-only derivative. Source: ${revision}.\n// Reproduce with tools/recovery/derive-native-r100-revision7.mjs. Original through-v7 archive is retained.` },
  });
  const bytes = result.outputFiles[0].contents;
  const imports = Object.values(result.metafile.outputs).flatMap(row => row.imports);
  assert.deepEqual(imports, [], 'Derived closure must have no mutable imports');
  const inputs = Object.keys(result.metafile.inputs).filter(file => !file.endsWith('revision7-only-entry.ts'));
  assert(inputs.every(file => !/legacy-r100-v[23456]/.test(file)), 'Prior revisions must stay in the outer router, never in this derivative');
  const manifest = { schemaVersion: 1, id: 'r100-native-revision7-only', sourceRevision: revision,
    original: { path: `${archiveDirectory}/executor.js`, sha256: original.executorSha256,
      manifest: `${archiveDirectory}/manifest.json`, manifestSha256: sha(readFileSync(`${archiveDirectory}/manifest.json`)) },
    admittedAlgorithmRevisions: [7], rejectsOtherRevisions: true,
    derivation: 'Only exact AST-selected old-version import/return nodes are removed; the surface fallback becomes an explicit revision7 guard. All current-v7 algorithm/data text is preserved. Public historical dispatch remains outside this artifact.',
    tool: { path: 'tools/recovery/derive-native-r100-revision7.mjs', sha256: sha(readFileSync(new URL(import.meta.url))) },
    esbuildVersion, typescriptVersion: ts.version, executorSha256: sha(bytes), executorBytes: bytes.length,
    entrySha256: sha(entry), imports, transformations,
    dependencies: inputs.map(file => relative(temporary, resolve(temporary, file))).sort()
      .map(file => ({ path: file, sha256: sha(readFileSync(join(temporary, file))) })),
  };
  const json = JSON.stringify(manifest, null, 2) + '\n';
  if (process.argv.includes('--write')) {
    assert(!existsSync(output) && !existsSync(manifestPath), 'Never overwrite a previously derived closure');
    writeFileSync(output, bytes); writeFileSync(manifestPath, json);
  } else {
    assert.deepEqual(readFileSync(output), Buffer.from(bytes), 'Derived executor differs');
    assert.equal(readFileSync(manifestPath, 'utf8'), json, 'Derivation manifest differs');
  }
  console.log(JSON.stringify({ status: 'pass', output, dependencies: inputs.length, bytes: bytes.length,
    originalBytes: original.executorBytes, sha256: manifest.executorSha256, imports }));
} finally { rmSync(temporary, { recursive: true, force: true }); }
