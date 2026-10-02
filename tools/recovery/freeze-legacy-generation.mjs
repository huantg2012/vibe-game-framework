/** Reproduce the immutable pre-R100 executor from its Git revision, never live files. */
import { build, version as esbuildVersion } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const revision = 'ac9ddd7fab04202d629a97293ffeeb19f71acaec';
const output = 'src/generation/legacy-rift-v2';
const entry = `export { createWorldProductionMap } from './src/generation/world-study/production-map';
export { validWorldProductionRecipe } from './src/generation/world-study/production-recipe';
export { generateRiftLayout } from './src/generation/rift-layout';\n`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const temporary = mkdtempSync(join(tmpdir(), 'coh-legacy-generation-'));
try {
  const archive = spawnSync('git', ['archive', revision, 'src', 'tsconfig.json'], { maxBuffer: 32 * 1024 * 1024 });
  assert.equal(archive.status, 0, archive.stderr.toString());
  const extraction = spawnSync('tar', ['-x', '-C', temporary], { input: archive.stdout });
  assert.equal(extraction.status, 0, extraction.stderr.toString());
  const result = await build({
    absWorkingDir: temporary,
    stdin: { contents: entry, resolveDir: temporary, sourcefile: 'legacy-generation-entry.ts' },
    bundle: true, format: 'esm', platform: 'browser', target: 'es2020',
    write: false, metafile: true, tsconfig: join(temporary, 'tsconfig.json'), treeShaking: true, legalComments: 'none',
    banner: { js: `// IMMUTABLE pre-R100 generation executor. Source: ${revision}.\n// Reproduce with tools/recovery/freeze-legacy-generation.mjs; do not regenerate from current sources.` },
  });
  const bytes = result.outputFiles[0].contents;
  const imports = Object.values(result.metafile.outputs).flatMap(output => output.imports);
  assert.equal(imports.length, 0, 'legacy executor must not call mutable generation or data modules');
  const manifest = {
    schemaVersion: 1, id: 'legacy-rift-through-v2', sourceRevision: revision, esbuildVersion,
    formats: ['unversioned', 'world-production-v1', 'world-production-v2'],
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
  console.log(`PASS immutable generation archive: ${manifest.dependencies.length} dependencies, ${bytes.length} bytes, no mutable imports, ${manifest.executorSha256}`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
