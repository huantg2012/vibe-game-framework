/** Derive the revision-10-only synchronous executor from the immutable Git source.
 * Historical routing remains at the live public boundary. This artifact cannot
 * dispatch revisions 1–9, so it does not embed a second copy of their closures.
 * The original fixed Git source and pre-change independent hashes are the equality oracle. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { build, version as esbuildVersion } from 'esbuild';
import ts from 'typescript';

const revision = '99998703743895da7486fdee552f7bed019e64b8';
const archiveDirectory = 'src/generation/legacy-r100-v10';
const output = `${archiveDirectory}/executor-revision10.js`;
const manifestPath = `${archiveDirectory}/manifest-revision10.json`;
const entry = `export { createR100ProductionMap } from './src/generation/world-study/r100-production-map';\nexport { createR100ProductionRecipe, validR100ProductionRecipe } from './src/generation/world-study/r100-package';\nexport { bakeMasterWorldSurface } from './src/systems/r100-world/surface-bake';\nexport { bakeSearchSitePatches } from './src/systems/r100-world/search-site-bake';\nexport { validateSearchSites } from './src/generation/world-study/search-site-placement';\nexport { hydrateR100MasterWorld } from './src/generation/world-study/r100-native-data';\n`;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const compact = source => source.replace(/\s+/g, '');
const specifications = [
  {
    file: 'src/generation/world-study/r100-package.ts', functionName: 'validR100ProductionRecipe', inTry: true,
    imports: ['validFrozenR100ProductionRecipe', 'validRevision3Recipe', 'validRevision4Recipe', 'validRevision5Recipe', 'validRevision6Recipe', 'validRevision7Recipe', 'validRevision8Recipe', 'validRevision9Recipe'],
    routes: [
      "if(pack?.algorithmRevision===1||pack?.algorithmRevision===2)returnvalidFrozenR100ProductionRecipe(value);",
      'if(pack?.algorithmRevision===3)returnvalidRevision3Recipe(value);',
      'if(pack?.algorithmRevision===4)returnvalidRevision4Recipe(value);',
      'if(pack?.algorithmRevision===5)returnvalidRevision5Recipe(value);',
      'if(pack?.algorithmRevision===6)returnvalidRevision6Recipe(value);',
      'if(pack?.algorithmRevision===7)returnvalidRevision7Recipe(value);',
      'if(pack?.algorithmRevision===8)returnvalidRevision8Recipe(value);',
      'if(pack?.algorithmRevision===9)returnvalidRevision9Recipe(value);',
    ],
  },
  {
    file: 'src/generation/world-study/r100-production-map.ts', functionName: 'createR100ProductionMap',
    imports: ['createRevision4Map', 'createRevision3Map', 'createFrozenR100ProductionMap', 'createRevision5Map', 'createRevision6Map', 'createRevision7Map', 'createRevision8Map', 'createRevision9Map'],
    routes: [
      'if(recipe.package?.algorithmRevision===1||recipe.package?.algorithmRevision===2)returncreateFrozenR100ProductionMap(recipe);',
      'if(recipe.package?.algorithmRevision===3)returncreateRevision3Map(recipe);',
      'if(recipe.package?.algorithmRevision===4)returncreateRevision4Map(recipe);',
      'if(recipe.package?.algorithmRevision===5)returncreateRevision5Map(recipe);',
      'if(recipe.package?.algorithmRevision===6)returncreateRevision6Map(recipe);',
      'if(recipe.package?.algorithmRevision===7)returncreateRevision7Map(recipe);',
      'if(recipe.package?.algorithmRevision===8)returncreateRevision8Map(recipe);',
      'if(recipe.package?.algorithmRevision===9)returncreateRevision9Map(recipe);',
    ],
  },
  {
    file: 'src/systems/r100-world/surface-bake.ts', functionName: 'bakeMasterWorldSurface',
    imports: ['bakeRevision4Surface', 'bakeRevision3Surface', 'bakeRevision5Surface', 'bakeRevision6Surface', 'bakeRevision7Surface', 'bakeRevision8Surface', 'bakeRevision9Surface'],
    routes: [
      'if(!world.appearance)returnbakeRevision3Surface(world,painting);',
      'if(world.algorithmRevision===undefined)returnbakeRevision4Surface(world,painting);',
      'if(world.algorithmRevision===5)returnbakeRevision5Surface(world,painting);',
      'if(world.algorithmRevision===6)returnbakeRevision6Surface(world,painting);',
      'if(world.algorithmRevision===7)returnbakeRevision7Surface(world,painting);',
      'if(world.algorithmRevision===8)returnbakeRevision8Surface(world,painting);',
      'if(world.algorithmRevision===9)returnbakeRevision9Surface(world,painting);',
    ],
    replacement: "if (world.algorithmRevision !== 10 || !world.appearance) throw new Error('Revision 10 surface requires an explicit revision 10 world with appearance');",
  },
  {
    file: 'src/generation/world-study/r100-native-data.ts', functionName: 'hydrateR100MasterWorld',
    imports: ['hydrateRevision9World'],
    routes: ['if(native.algorithmRevision===9)returnhydrateRevision9World(native,layout);'],
  },
  {
    file: 'src/systems/r100-world/search-site-bake.ts', functionName: 'bakeSearchSitePatches',
    imports: ['bakeRevision9SearchSites'],
    routes: ['if(world.algorithmRevision===9)returnbakeRevision9SearchSites(world,baseSurface,painting);'],
  },
  {
    file: 'src/generation/world-study/search-site-placement.ts', functionName: 'validateSearchSites',
    imports: ['validateRevision9SearchSites'],
    routes: ['if(world.algorithmRevision===9){validateRevision9SearchSites(world);return;}'],
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
      && /legacy-r100-v[23456789]\/executor(?:-recovery)?\.js$/.test(node.moduleSpecifier.text)
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
    assert((ts.isReturnStatement(node.thenStatement) || (ts.isBlock(node.thenStatement) && node.thenStatement.statements.length === 2 && ts.isExpressionStatement(node.thenStatement.statements[0]) && ts.isReturnStatement(node.thenStatement.statements[1]))) && !node.elseStatement);
    edits.push({ start: node.getStart(ast), end: node.end, before: node.getText(ast),
      after: index === 0 ? specification.replacement ?? '' : '', kind: specification.replacement ? 'replace-historical-surface-route-with-revision10-guard' : 'remove-unreachable-historical-route' });
  }
  let derived = source;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    assert.equal(derived.slice(edit.start, edit.end), edit.before);
    derived = derived.slice(0, edit.start) + edit.after + derived.slice(edit.end);
  }
  // Existing revision-10 recipe validation remains the authoritative map gate.
  if (specification.functionName === 'validR100ProductionRecipe') assert(derived.includes('pack.algorithmRevision !== 10'));
  if (specification.functionName === 'createR100ProductionMap') assert(derived.includes("if (!validR100ProductionRecipe(recipe)) throw new Error('Invalid or unavailable native world package');"));
  return { derived, receipt: { path: specification.file, originalSha256: sha(source), derivedSha256: sha(derived), edits } };
}

const temporary = mkdtempSync(join(tmpdir(), 'coh-revision10-only-'));
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
    stdin: { contents: entry, resolveDir: temporary, sourcefile: 'revision10-only-entry.ts' },
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020', write: false,
    metafile: true, tsconfig: join(temporary, 'tsconfig.json'), treeShaking: true, legalComments: 'none',
    banner: { js: `// IMMUTABLE revision-10-only derivative. Source: ${revision}.\n// Reproduce with tools/recovery/derive-native-r100-revision10.mjs. Earlier revision archives remain separate.` },
  });
  const bytes = result.outputFiles[0].contents;
  const imports = Object.values(result.metafile.outputs).flatMap(row => row.imports);
  assert.deepEqual(imports, [], 'Derived closure must have no mutable imports');
  const inputs = Object.keys(result.metafile.inputs).filter(file => !file.endsWith('revision10-only-entry.ts'));
  assert(inputs.every(file => !/legacy-r100-v[23456789]/.test(file)), 'Prior revisions must stay in the outer router, never in this derivative');
  const manifest = { schemaVersion: 1, id: 'r100-native-revision10-only', sourceRevision: revision,
    original: { sourceRevision: revision, basis: 'Fixed Git archive, with independent unmodified independent saved-r10 full-map, surface and intact/searched patch oracle captures.' },
    admittedAlgorithmRevisions: [10], rejectsOtherRevisions: true,
    derivation: 'Only exact AST-selected old-version import/return nodes are removed; the surface fallback becomes an explicit revision10 guard. All current-v10 algorithm/data text is preserved. Public historical dispatch remains outside this artifact.',
    tool: { path: 'tools/recovery/derive-native-r100-revision10.mjs', sha256: sha(readFileSync(new URL(import.meta.url))) },
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
    sha256: manifest.executorSha256, imports }));
} finally { rmSync(temporary, { recursive: true, force: true }); }
