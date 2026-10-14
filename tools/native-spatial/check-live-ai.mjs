/** CPU live-AI assay. Usage: node tools/native-spatial/check-live-ai.mjs --self-test REPORT
 * or: node tools/native-spatial/check-live-ai.mjs PASSED_PRODUCTION_RECEIPT REPORT.
 * The display adapter is bundled with the real production AI and installed Arcade.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';

assert(process.argv[2] && process.argv[3], 'Expected input receipt (or --self-test) and NEW_REPORT.json');
assert(!fs.existsSync(process.argv[3]), 'Do not overwrite prior evidence');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-native-ai-'));
try {
  const output = path.join(temporary, 'runtime.mjs');
  await build({entryPoints: ['tools/native-spatial/live-ai-runtime.mjs'], outfile: output,
    bundle: true, platform: 'node', format: 'esm', packages: 'external',
    tsconfig: 'tools/contam-preview/tsconfig.json', define: {'import.meta.env.DEV': 'false'},
    alias: {phaser: path.resolve('tools/contam-preview/phaser-stub.ts')},
    banner: {js: `import {createRequire as _createRequire} from 'node:module'; const require = _createRequire(${JSON.stringify(path.join(process.cwd(), 'package.json'))});`}});
  const child = spawnSync(process.execPath, [output, ...process.argv.slice(2)], {stdio: 'inherit', env: process.env});
  if (child.error) throw child.error;
  process.exitCode = child.status ?? 1;
} finally { fs.rmSync(temporary, {recursive: true, force: true}); }
