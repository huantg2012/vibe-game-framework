/** Reproduce the immutable native revision 7 executor from its Git revision, never live files. */
import { build, version as esbuildVersion } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const revision = 'b2d737901ebe6e7ea61c4ea37be3470370d981a4';
const output = 'src/generation/legacy-r100-v7';
const entry = `export { createR100ProductionMap } from './src/generation/world-study/r100-production-map';\nexport { createR100ProductionRecipe, validR100ProductionRecipe } from './src/generation/world-study/r100-package';\nexport { bakeMasterWorldSurface } from './src/systems/r100-world/surface-bake';\n`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const temporary = mkdtempSync(join(tmpdir(), 'coh-legacy-generation-'));
try {
  const archive = spawnSync('git', ['archive', revision, 'src', 'tsconfig.json'], { maxBuffer: 64 * 1024 * 1024 });
  assert.equal(archive.status, 0, archive.stderr.toString());
  const extraction = spawnSync('tar', ['-x', '-C', temporary], { input: archive.stdout });
  assert.equal(extraction.status, 0, extraction.stderr.toString());
  const result = await build({
    absWorkingDir: temporary,
    stdin: { contents: entry, resolveDir: temporary, sourcefile: 'legacy-generation-entry.ts' },
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
    write: false, metafile: true, tsconfig: join(temporary, 'tsconfig.json'), treeShaking: true, legalComments: 'none',
    banner: { js: `// IMMUTABLE R100 native generation through revision 7. Source: ${revision}.\n// Reproduce with tools/recovery/freeze-native-r100-revision7.mjs; do not regenerate from current sources.` },
  });
  const bytes = result.outputFiles[0].contents;
  const imports = Object.values(result.metafile.outputs).flatMap(output => output.imports);
  assert.equal(imports.length, 0, 'legacy executor must not call mutable generation or data modules');
  const manifest = {
    schemaVersion: 1, id: 'r100-native-through-revision7', sourceRevision: revision, esbuildVersion,
    formats: [1, 2, 3, 4, 5, 6, 7].map(revision => `r100-native-v3-revision${revision}`),
    executorSha256: sha256(bytes), executorBytes: bytes.length, entrySha256: sha256(entry), imports,
    dependencies: Object.keys(result.metafile.inputs).map(path => relative(temporary, resolve(temporary, path)))
      .filter(path => !path.endsWith('legacy-generation-entry.ts')).sort()
      .map(path => ({ path, sha256: sha256(readFileSync(join(temporary, path))) })),
  };
  const json = `${JSON.stringify(manifest, null, 2)}\n`;
  if (process.argv.includes('--write')) {
    assert(!existsSync(`${output}/executor.js`) && !existsSync(`${output}/manifest.json`), 'frozen executors are append-only; existing archive must never be overwritten');
    writeFileSync(`${output}/executor.js`, bytes);
    writeFileSync(`${output}/manifest.json`, json);
  } else {
    assert.deepEqual(readFileSync(`${output}/executor.js`), Buffer.from(bytes), 'frozen executor differs from its historical sources');
    assert.equal(readFileSync(`${output}/manifest.json`, 'utf8'), json, 'historical manifest differs');
  }
  const materialSources = ['data/rift-master-materials.csv', 'data/rift-material-organizations.csv'].map(path => {
    const result = spawnSync('git', ['show', `${revision}:${path}`]);
    assert.equal(result.status, 0, `historical material catalog must exist: ${path}`);
    return result.stdout.toString();
  });
  const assets = [...new Set([...materialSources.join('\n').matchAll(/\/assets\/[a-zA-Z0-9_./-]+\.png/g)].map(match => `public${match[0]}`))].sort().map(path => {
    const file = spawnSync('git', ['show', `${revision}:${path}`], { maxBuffer: 16 * 1024 * 1024 });
    assert.equal(file.status, 0, `historical asset is missing: ${path}`);
    return { path, sha256: sha256(file.stdout) };
  });
  const assetJson = `${JSON.stringify({ sourceRevision: revision, assets }, null, 2)}\n`;
  const assetPath = `${output}/assets.json`;
  if (process.argv.includes('--write') && !existsSync(assetPath)) writeFileSync(assetPath, assetJson);
  else assert.equal(readFileSync(assetPath, 'utf8'), assetJson, 'immutable material receipt differs');
  for (const asset of assets) assert.equal(sha256(readFileSync(asset.path)), asset.sha256, `historical asset path was overwritten: ${asset.path}`);
  console.log(`PASS immutable generation archive: ${manifest.dependencies.length} dependencies, ${bytes.length} bytes, no mutable imports, ${manifest.executorSha256}`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
