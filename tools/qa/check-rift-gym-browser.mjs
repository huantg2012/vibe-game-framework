/** DEV gym: real controls/keyboard, isolated browser, read-only diagnostics. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/rift-gym-2026-10-02');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript(() => {
  localStorage.setItem('coh-save-v1', 'gym-save-sentinel');
  window.__storageReads = 0; window.__storageWrites = 0;
  const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
  Storage.prototype.getItem = function (...args) { if (args[0] === 'coh-save-v1') window.__storageReads++; return get.apply(this, args); };
  Storage.prototype.setItem = function (...args) { if (args[0] === 'coh-save-v1') window.__storageWrites++; return set.apply(this, args); };
  Storage.prototype.removeItem = function (...args) { if (args[0] === 'coh-save-v1') window.__storageWrites++; return remove.apply(this, args); };
});
const page = await context.newPage();
const report = { status: 'running', method: 'Real gym controls and keyboard; read-only state probes; isolated browser save sentinel.', errors: [], checks: [] };
page.on('pageerror', e => report.errors.push(String(e)));
page.on('console', msg => { if (msg.type() === 'error' && !msg.text().includes('favicon')) report.errors.push(msg.text()); });
const state = () => page.evaluate(() => window.__riftGym?.getState());
const waitMap = () => page.waitForFunction(() => { const s = window.__riftGym?.getState(); return s && !s.busy && s.metadata && s.runtime.ready; }, null, { timeout: 90000 });
function check(label, detail) { report.checks.push({ label, detail }); fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2)); console.log(label, JSON.stringify(detail ?? 'PASS')); }
try {
  await page.goto(`${process.env.QA_BASE_URL ?? 'http://127.0.0.1:3027'}/gym.html?lesson=rift-world`, { waitUntil: 'domcontentloaded' });
  await waitMap();
  const first = await state(); assert.equal(first.combinationCount, 30); assert(!first.error); assert(page.url().includes('/rift-gym.html?'));
  await page.screenshot({ path: path.join(out, 'overview.png') }); check('gym redirect / native worker / full map', { selection: first.selection, seed: first.metadata.effectiveSeed, signature: first.metadata.signature });
  await page.locator('#routes').check(); await page.locator('#support').check();
  await page.locator('#pixel').click(); await page.locator('#fit').click(); await page.locator('#support').uncheck();
  const canvasBox = await page.locator('#map').boundingBox(); assert(canvasBox.width > 900 && canvasBox.height > 500);
  await page.screenshot({ path: path.join(out, 'routes.png') });
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__riftGym.getState().runtime.running, null, { timeout: 60000 });
  const entered = await state(); assert.equal(entered.metadata.signature, first.metadata.signature); assert(!entered.error);
  await page.screenshot({ path: path.join(out, 'play.png') });
  await page.keyboard.press('Escape'); await page.waitForFunction(() => window.__riftGym.getState().runtime.paused);
  await page.keyboard.press('Escape'); await page.waitForFunction(() => !window.__riftGym.getState().runtime.paused);
  const beforeMove = (await state()).runtime.probe.player;
  await page.keyboard.down('d'); await page.waitForTimeout(350); await page.keyboard.up('d');
  const afterMove = (await state()).runtime.probe.player;
  assert(Math.hypot(afterMove.x - beforeMove.x, afterMove.y - beforeMove.y) > 1, 'real movement advances actor');
  await page.locator('#seed').focus(); await page.waitForFunction(() => window.__riftGym.getState().runtime.paused);
  await page.locator('#pause').click(); await page.waitForFunction(() => !window.__riftGym.getState().runtime.paused);
  const run = await page.evaluate(async () => (await import('/src/systems/inventory-store.ts')).inventoryStore.getRun());
  assert.equal(run.catalogVersion, 'contaminant-v1'); assert.equal(run.lootAlgorithmVersion, 1); assert.equal(run.combatRulesVersion, 2);
  await page.locator('#return').click(); assert.equal((await state()).runtime.running, false);
  await page.locator('#play').click(); await page.waitForFunction(() => window.__riftGym.getState().runtime.running);
  assert.equal((await state()).metadata.signature, first.metadata.signature);
  await page.locator('#return').click(); check('same-map native play / Esc / focus pause / restart', { catalogVersion: run.catalogVersion, combatRulesVersion: run.combatRulesVersion });
  await page.locator('#seed').fill('-1'); await page.locator('#generate').click(); assert((await page.locator('#error').textContent()).includes('整数'));
  const previousWorld = (await state()).selection.world;
  const otherWorld = await page.locator('#world option').nth(1).getAttribute('value');
  await page.locator('#world').selectOption(otherWorld);
  assert.equal(await page.locator('#world').inputValue(), previousWorld, 'invalid seed restores combination control');
  assert.equal(await page.locator('#seed').inputValue(), '-1');
  await page.locator('#seed').fill('20261002'); await page.locator('#generate').click(); await waitMap();
  await page.locator('#next').click(); await page.locator('#next').click(); await waitMap();
  assert.equal((await state()).selection.program, (await page.locator('#program').inputValue()));
  check('invalid seed rejected / rapid requests cancel', (await state()).selection);
  const downloadPromise = page.waitForEvent('download'); await page.locator('#export').click();
  const download = await downloadPromise; const downloadFile = path.join(out, 'export.json'); await download.saveAs(downloadFile);
  const exported = JSON.parse(fs.readFileSync(downloadFile)); assert.equal(exported.metadata.signature, (await state()).metadata.signature);
  await page.locator('#tour').click();
  const tourStart = Date.now(); let lastCount = -1;
  for (;;) {
    const s = await state();
    assert(s, 'gym remains loaded during tour');
    const count = Object.keys(s.results).length;
    if (count !== lastCount) { check('tour progress', { count, selection: s.selection, busy: s.busy }); lastCount = count; }
    if (!s.tour && !s.busy) { assert.equal(count, s.combinationCount, 'tour completes without navigation or hot reload'); break; }
    assert(Date.now() - tourStart < 300000, 'tour time budget');
    await page.waitForTimeout(1000);
  }
  const toured = await state(); const failures = Object.entries(toured.results).filter(([, r]) => r.status === 'failed');
  check('full compatible combination tour', { count: Object.keys(toured.results).length, failures }); assert.deepEqual(failures, []);
  await page.screenshot({ path: path.join(out, 'tour-complete.png') });
  // Stop in flight then choose a new map; a stale worker must not overwrite it.
  await page.locator('#tour').click(); await page.locator('#tour').click(); assert.equal((await state()).tour, false);
  await page.locator('#next').click(); await waitMap();
  const finalSelection = (await state()).selection; await page.waitForTimeout(1000); assert.deepEqual((await state()).selection, finalSelection);
  const storage = await page.evaluate(() => ({ reads: window.__storageReads, writes: window.__storageWrites }));
  assert.deepEqual(storage, { reads: 0, writes: 0 }); check('cancel / save isolation', storage);
  assert.deepEqual(report.errors, []); report.status = 'passed';
} catch (reason) {
  report.status = 'failed'; report.failure = String(reason); report.lastState = await state().catch(() => null);
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); throw reason;
} finally { fs.writeFileSync(path.join(out, 'browser.json'), JSON.stringify(report, null, 2)); await browser.close(); }
