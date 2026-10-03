/** Independent browser regression for the P2 destroy-during-preparation defect.
 * Run from repo root: node docs/qa/artifacts/rift-r100-i02-validation/async-review/review-direct-destroy.mjs
 * Fresh contexts only. Removing a native scene is a lifecycle fault injection,
 * not a natural gameplay route or a performance qualification. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = path.resolve('docs/qa/artifacts/rift-r100-i02-validation/async-review');
const origin = process.env.GAME_URL ?? 'http://127.0.0.1:3027/';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = ['src/scenes/main-menu-scene.ts', 'src/scenes/purification-scene.ts',
  'src/scenes/rift-scene.ts', 'src/ui/dom/pause-menu.ts', 'src/managers/session.ts',
  'src/managers/save-manager.ts', 'src/managers/rift-recovery.ts', 'src/generation/rift-generation-client.ts'];
const sources = async () => Object.fromEntries(await Promise.all(sourcePaths.map(async file => [file, sha(await readFile(file))])));
const startedSources = await sources();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { createdAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  origin, sources: startedSources, scope: 'Independent real Chromium direct-destroy regression. Isolated storage. Native menus and Worker implementation; scene.remove fault injection. No timing/visual acceptance inferred.',
  historicalFailure: { reproduction: 'Waiting departure, then SceneManager.remove(PurificationScene)',
    error: "TypeError: Cannot read properties of null (reading 'isPaused')", savedBytesPreserved: true,
    note: 'Observed before this fix in the independent /tmp reproduction; not re-created by modifying current sources.' },
  checks: [] };
await mkdir(out, { recursive: true });

async function contextWithProbe(saved) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  await context.addInitScript(raw => {
    if (raw) localStorage.setItem('coh-save-v1', raw);
    window.__destroyReviewWorkers = [];
    const WorkerOriginal = window.Worker;
    window.Worker = class extends WorkerOriginal {
      constructor(...args) {
        super(...args);
        const facts = { started: performance.now(), terminated: 0 };
        window.__destroyReviewWorkers.push(facts);
        const terminate = this.terminate.bind(this);
        this.terminate = () => { facts.terminated++; terminate(); };
      }
    };
  }, saved ?? null);
  const page = await context.newPage(), errors = [], consoleErrors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  await page.goto(`${origin}?async-destroy-review=${Date.now()}`);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene')
    && document.querySelector('.joint-action')?.disabled === false, null, { timeout: 60000 });
  // Assert this page loaded the fixed module, not a tab left on an older HMR state.
  const currentModule = await page.request.get(new URL('/src/scenes/main-menu-scene.ts', origin).href);
  assert((await currentModule.text()).includes('releaseTitle'), 'Fresh server serves the fixed releaseTitle module');
  return { context, page, errors, consoleErrors };
}

try {
  {
    const { context, page, errors, consoleErrors } = await contextWithProbe();
    try {
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
      await page.waitForTimeout(1800);
      // Use the actual existing interaction; this isolates preparation from pathfinding.
      await page.evaluate(() => window.__game.scene.getScene('PurificationScene').openWorldInteraction('rift'));
      await page.getByRole('button', { name: /踏入裂隙/ }).waitFor(); await page.waitForTimeout(350);
      await page.keyboard.press('Shift+Enter');
      await page.getByRole('button', { name: '取消准备', exact: true }).waitFor();
      const before = await page.evaluate(() => localStorage.getItem('coh-save-v1'));
      await page.screenshot({ path: path.join(out, 'haven-before-destroy.jpg') });
      await page.evaluate(() => window.__game.scene.remove('PurificationScene'));
      await page.waitForTimeout(1000);
      const after = await page.evaluate(() => ({ saved: localStorage.getItem('coh-save-v1'),
        workers: window.__destroyReviewWorkers, sceneExists: !!window.__game.scene.keys.PurificationScene,
        preparationUiCount: document.querySelectorAll('.pause-menu-panel,.pause-menu-backdrop').length }));
      await page.screenshot({ path: path.join(out, 'haven-after-destroy.jpg') });
      assert.equal(after.saved, before); assert.equal(after.sceneExists, false); assert.equal(after.preparationUiCount, 0);
      assert(after.workers.length > 0); assert(after.workers.every(worker => worker.terminated === 1));
      assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
      report.checks.push({ id: 'haven-direct-destroy', status: 'pass', errors, consoleErrors,
        savedBytesPreserved: true, saveSha256: sha(before), workerLifecycle: after.workers,
        sceneRemoved: true, preparationUiCount: after.preparationUiCount });
    } finally { await context.close(); }
  }
  {
    const base = JSON.parse(await readFile('tools/recovery/fixtures/prepared-base.json', 'utf8')).record;
    const active = JSON.parse(await readFile('tools/recovery/fixtures/formal-active.json', 'utf8'));
    base.inventory = active.inventory; base.riftCheckpoint = active.checkpoint;
    base.cycle = active.checkpoint.state.conditions.cycle; delete base.checkpointChecksum;
    let checksum = 2166136261;
    const bytes = JSON.stringify(base);
    for (let i = 0; i < bytes.length; i++) { checksum ^= bytes.charCodeAt(i); checksum = Math.imul(checksum, 16777619); }
    base.checkpointChecksum = (checksum >>> 0).toString(16).padStart(8, '0');
    const saved = JSON.stringify(base);
    const { context, page, errors, consoleErrors } = await contextWithProbe(saved);
    try {
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: '取消载入', exact: true }).waitFor();
      await page.screenshot({ path: path.join(out, 'title-before-destroy.jpg') });
      await page.evaluate(() => window.__game.scene.remove('MainMenuScene'));
      await page.waitForTimeout(1000);
      const after = await page.evaluate(() => ({ saved: localStorage.getItem('coh-save-v1'),
        workers: window.__destroyReviewWorkers, sceneExists: !!window.__game.scene.keys.MainMenuScene,
        titleUiCount: document.querySelectorAll('.joint-title').length, activeScenes: window.__game.scene.getScenes(true).map(scene => scene.sys.settings.key) }));
      await page.screenshot({ path: path.join(out, 'title-after-destroy.jpg') });
      assert.equal(after.saved, saved); assert.equal(after.sceneExists, false); assert.equal(after.titleUiCount, 0);
      assert(!after.activeScenes.includes('RiftScene')); assert(after.workers.length > 0);
      assert(after.workers.every(worker => worker.terminated === 1)); assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
      report.checks.push({ id: 'title-direct-destroy', status: 'pass', errors, consoleErrors,
        savedBytesPreserved: true, saveSha256: sha(saved), workerLifecycle: after.workers,
        sceneRemoved: true, titleUiCount: after.titleUiCount, activeScenes: after.activeScenes });
    } finally { await context.close(); }
  }
  const afterSources = await sources();
  assert.deepEqual(afterSources, startedSources, 'Reviewed modules must stay fixed throughout the browser run');
  report.sourcesUnchanged = true; report.status = 'pass';
} catch (error) { report.status = 'fail'; report.failure = String(error); process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  await writeFile(path.join(out, 'direct-destroy-report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  console.log(JSON.stringify({ status: report.status, checks: report.checks.map(check => check.id), failure: report.failure }));
}
