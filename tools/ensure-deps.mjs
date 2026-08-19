/**
 * Make `npm run dev` work on a fresh clone.
 * If Vite isn't installed yet, run `npm install` before the dev server starts.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const viteBin = join(root, 'node_modules', 'vite', 'bin', 'vite.js');

if (existsSync(viteBin)) process.exit(0);

console.log('未找到 node_modules，正在安装依赖…');
const result = spawnSync('npm', ['install'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
