/** Cold restoration plus deliberate current-generator failure. No repository mutation. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const run = (args: string[]): void => {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' } });
  process.stdout.write(result.stdout);
  assert.equal(result.status, 0, result.stderr);
};
const worker = 'tools/recovery/restore-legacy-generation-worker.ts';
const manifest = JSON.parse(readFileSync('src/generation/legacy-rift-v2/manifest.json', 'utf8'));
assert.equal(createHash('sha256').update(readFileSync('src/generation/legacy-rift-v2/executor.js')).digest('hex'), manifest.executorSha256);
assert.deepEqual(manifest.imports, []);
const old = JSON.parse(readFileSync('tools/recovery/fixtures/world-generation-v1.json', 'utf8'));
const gold = JSON.parse(readFileSync('tools/recovery/fixtures/legacy-generation-gold.json', 'utf8'));
for (let i = 0; i < old.records.length; i++) run(['--import', 'tsx', '--import', './tools/recovery/register-css.mjs', worker, 'v1', String(i)]);
for (let i = 0; i < gold.records.length; i++) run(['--import', 'tsx', '--import', './tools/recovery/register-css.mjs', worker, 'gold', String(i)]);

const temporary = mkdtempSync(join(tmpdir(), 'coh-old-generation-proof-'));
try {
  let replaced = 0;
  const result = await build({
    entryPoints: [worker], bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022',
    tsconfig: 'tools/contam-preview/tsconfig.json', loader: { '.css': 'empty' },
    plugins: [{ name: 'poison-live-generation', setup(build) {
      build.onLoad({ filter: /src\/generation\/(?:world-study\/(?:production-map|production-recipe)|rift-layout)\.ts$/ }, async args => {
        let contents = readFileSync(args.path, 'utf8');
        for (const name of ['createWorldProductionMap', 'generateRiftLayout', 'validWorldProductionRecipe']) {
          const pattern = new RegExp(`(export function ${name}\\([\\s\\S]*?\\): [^{]+\\{)`);
          if (pattern.test(contents)) {
            contents = contents.replace(pattern, `$1 throw new Error('LIVE_GENERATOR_WAS_USED:${name}');`);
            replaced++;
          }
        }
        return { contents, loader: 'ts', resolveDir: resolve(args.path, '..') };
      });
    } }],
  });
  assert(replaced >= 1, 'the mutable production recipe validator must actually be poisoned');
  const bundled = join(temporary, 'restore-poisoned.mjs');
  writeFileSync(bundled, result.outputFiles[0]!.contents);
  run([bundled, 'gold', '0']);
  run([bundled, 'gold', '3']);
  run([bundled, 'v1', '0']);
  console.log(`PASS old generation isolated from changed live execution/validation (${replaced} function(s) poisoned)`);
} finally { rmSync(temporary, { recursive: true, force: true }); }
console.log(`PASS frozen generation: ${old.records.length} v1 and ${gold.records.length} complete-world gold records; each recovered in a fresh process`);
