/** Compare exact generation identity across the actual Node and Chromium runtimes.
 * Old packages are checked against original browser saves, not rounded or repaired. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const folder = process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i05-qualification-rev2';
fs.mkdirSync(folder, { recursive: true });
const script = `import {R100_NATIVE_WORLDS} from './src/generated/r100-native-worlds.ts';
import {createR100ProductionRecipe} from './src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from './src/generation/world-study/r100-production-map.ts';
import {generatedRiftIdentity} from './src/generation/rift-generation-identity.ts';
const rows=[];for(const world of R100_NATIVE_WORLDS)for(const grade of ['low','medium','severe']){
const recipe=createR100ProductionRecipe(world.id,20261004,grade),map=createR100ProductionMap(recipe);
rows.push(generatedRiftIdentity(map.layout,recipe,map));}console.log(JSON.stringify(rows));`;
const node = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], {
  env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' }, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
});
if (node.status !== 0) throw Error(node.stderr);
const current = JSON.parse(node.stdout), old = JSON.parse(fs.readFileSync('tools/recovery/fixtures/r100-revision1-gold.json')).records.map(row => row.identity);
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage();
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3064/');
  const results = await page.evaluate(async ({ current, old }) => {
    const { createR100ProductionMap } = await import('/src/generation/world-study/r100-production-map.ts');
    const { generatedRiftIdentity } = await import('/src/generation/rift-generation-identity.ts');
    return [...current, ...old].map(saved => {
      const world = createR100ProductionMap(saved.generation), value = generatedRiftIdentity(world.layout, saved.generation, world);
      const { catalogVersion: _catalog, combatRulesVersion: _combat, lootAlgorithmVersion: _loot, ...expected } = saved;
      return { world: saved.generation.package.id, grade: saved.generation.package.grade, revision: saved.generation.package.algorithmRevision,
        seed: saved.seed, expected: saved.signature, actual: value.signature, exactIdentity: JSON.stringify(value) === JSON.stringify(expected) };
    });
  }, { current, old });
  const report = { scope: '60 new-revision Node→actual Chromium exact identities; 18 original saved Chromium revision-1 identities→current Chromium. Old Node divergence remains documented, never rounded on restore.',
    url: process.env.GAME_URL ?? 'http://127.0.0.1:3064/', node: process.version, chromium: browser.version(),
    status: results.every(row => row.exactIdentity) ? 'pass' : 'failed', results };
  fs.writeFileSync(path.join(folder, 'browser-equivalence.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(report.status, results.length, 'exact identities', results.filter(row => !row.exactIdentity));
  if (report.status !== 'pass') process.exitCode = 1;
} finally { await browser.close(); }
