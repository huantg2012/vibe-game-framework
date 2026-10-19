/** Bounded production-component regression in an isolated browser document.
 * Uses a running Vite server; does not start the game or touch player storage.
 * Run: node tools/qa/check-rift-hud-polish.mjs
 * Optional: COH_QA_BASE_URL, COH_PLAYWRIGHT_MODULE, COH_CHROME_PATH.
 * The 13,000ms help check calls update once; it does not wait 13 seconds.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
let playwrightModule = process.env.COH_PLAYWRIGHT_MODULE;
if (!playwrightModule) {
  try { playwrightModule = require.resolve('playwright'); }
  catch { playwrightModule = join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'); }
}
const { chromium } = require(playwrightModule);
const executablePath = process.env.COH_CHROME_PATH
  ?? (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
const browser = await chromium.launch({ headless: true, executablePath });
const baseUrl = process.env.COH_QA_BASE_URL ?? 'http://127.0.0.1:3027';
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/qa-hud-refinement', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body style="margin:0;background:#0b100d"></body></html>' }));
  await page.goto(new URL('/qa-hud-refinement', baseUrl).href);
  const result = await page.evaluate(async () => {
    const { openInventory } = await import('/src/ui/inventory-presenter.ts');
    const presenterSource = await (await fetch('/src/ui/inventory-presenter.ts')).text();
    // Reuse Vite's exact HMR module URL; a plain import can create a second singleton.
    const panelMatch = presenterSource.match(/from "([^"]+inventory-panel[^"]*)"/);
    if (!panelMatch) throw new Error('Could not resolve the presenter inventory-panel module');
    const panelPath = panelMatch[1];
    const { inventoryPanel } = await import(panelPath);
    const { RiftHud } = await import('/src/ui/dom/rift-hud.ts');
    const { commitEffects, afterStateCommit } = await import('/src/core/commit-effects.ts');
    const read = () => [...document.querySelectorAll('.inventory-physiology-value')].map(x => x.textContent);
    let a = 0;
    openInventory({ mode: 'rift', getAssimilation: () => a, onClose() {} });
    const samples = [];
    for (a of [0, 30, 60, 100]) { inventoryPanel.refreshPhysiology(); samples.push({ a, values: read() }); }
    const header = document.querySelector('.inventory-title').textContent;
    const continuing = document.querySelector('.inventory-message').textContent;
    const bodyBounds = document.querySelector('.inventory-physiology').getBoundingClientRect().toJSON();
    const fits = [...document.querySelectorAll('.inventory-physiology-fact')].every(x => x.scrollWidth <= x.clientWidth);
    a = null; inventoryPanel.refreshPhysiology();
    const legacyHidden = document.querySelector('.inventory-physiology').hidden;
    inventoryPanel.close();
    let physiology = { assimilation: 30, saturatedVisionPercent: 65.5, unprovokedPerceptionPercent: 82 };
    const items = Array.from({ length: 30 }, (_, i) => ({ id: `item-${i}`, kind: 'weapon', name: `物件 ${i}`, weight: 2, location: 'carried' }));
    inventoryPanel.open({ mode: 'rift', getSnapshot: () => ({ physiology, items, equipment: [], weight: 60, capacity: 100 }), getPhysiology: () => physiology, onAction() {}, onClose() {} });
    const list = document.querySelector('.inventory-list[data-lane="main"]');
    const row = list.children[8]; row.focus(); list.scrollTop = 180;
    const scroll = list.scrollTop;
    commitEffects.begin(); physiology = { ...physiology, assimilation: 60 };
    afterStateCommit(() => inventoryPanel.refreshPhysiology());
    const deferred = read()[0] === '30.0%';
    commitEffects.flush();
    const retained = row === list.children[8] && document.activeElement === row && list.scrollTop === scroll;
    const updated = read()[0] === '60.0%';
    commitEffects.begin(); physiology = { ...physiology, assimilation: 100 };
    afterStateCommit(() => inventoryPanel.refreshPhysiology()); commitEffects.discard();
    const discarded = read()[0] === '60.0%';
    window.__hudQA = { inventoryPanel, RiftHud, commitEffects, afterStateCommit };
    return { samples, header, continuing, bodyBounds, fits, legacyHidden, retained, updated, deferred, discarded, scroll };
  });
  assert.deepEqual(result.samples.map(x => x.values), [['0.0%', '55.0%', '100.0%'], ['30.0%', '65.5%', '82.0%'], ['60.0%', '76.0%', '64.0%'], ['100.0%', '90.0%', '40.0%']]);
  assert.equal(result.header, '随身'); assert(result.continuing.includes('世界仍在继续'));
  for (const key of ['fits', 'legacyHidden', 'retained', 'updated', 'deferred', 'discarded']) assert(result[key], key);
  assert(result.scroll > 0);
  await page.keyboard.press('Tab'); assert.equal(await page.locator('#inventory-panel').count(), 0);
  await page.evaluate(() => {
    const hud = new window.__hudQA.RiftHud(); window.__hud = hud;
    window.__assimilation = 30;
    hud.create({ canExtract: () => false, isRunEnded: () => false, getAssimilation: () => window.__assimilation, onInventory() {} });
    hud.restoreReadouts({ health: 100, maxHealth: 100, chaos: 100, kindling: 0 });
  });
  assert.equal(await page.locator('#rift-hud-help').evaluate(x => x.open), false);
  assert.equal(await page.locator('.rift-assimilation-value').textContent(), '30.0%');
  assert.equal(await page.locator('#rift-hud-assimilation').isVisible(), true);
  assert(!(await page.locator('#rift-hud-status').textContent()).includes('同化'));
  assert(!(await page.locator('#rift-hud-chaos').textContent()).includes('同化'));
  const assimilation = await page.evaluate(() => {
    const { commitEffects, afterStateCommit, inventoryPanel } = window.__hudQA;
    const read = () => document.querySelector('.rift-assimilation-value').textContent;
    const samples = [];
    for (const a of [0, 100]) {
      window.__assimilation = a; window.__hud.refreshAssimilation();
      samples.push({ a, text: read(), visible: !document.querySelector('#rift-hud-assimilation').hidden });
    }
    commitEffects.begin(); window.__assimilation = 60;
    afterStateCommit(() => window.__hud.refreshAssimilation());
    const deferred = read() === '100.0%'; commitEffects.flush();
    const flushed = read() === '60.0%';
    commitEffects.begin(); window.__assimilation = 80;
    afterStateCommit(() => window.__hud.refreshAssimilation()); commitEffects.discard();
    const discarded = read() === '60.0%';
    const node = document.querySelector('.rift-assimilation-value').firstChild;
    window.__assimilation = 60.001; window.__hud.refreshAssimilation();
    const unchangedPrecisionPreservesNode = document.querySelector('.rift-assimilation-value').firstChild === node;
    inventoryPanel.open({ mode: 'rift', getSnapshot: () => ({ items: [], equipment: [], weight: 0, capacity: 100 }), onAction() {}, onClose() {} });
    const hiddenBehindPanel = getComputedStyle(document.querySelector('#rift-hud-assimilation')).display === 'none';
    inventoryPanel.close();
    return { samples, deferred, flushed, discarded, unchangedPrecisionPreservesNode, hiddenBehindPanel };
  });
  assert.deepEqual(assimilation.samples, [{ a: 0, text: '0.0%', visible: true }, { a: 100, text: '100.0%', visible: true }]);
  for (const key of ['deferred', 'flushed', 'discarded', 'unchangedPrecisionPreservesNode', 'hiddenBehindPanel']) assert(assimilation[key], key);
  assert((await page.locator('#rift-hud').textContent()).includes('临界'));
  await page.locator('#rift-hud-help summary').focus(); await page.keyboard.press('Enter');
  assert.equal(await page.locator('#rift-hud-help').evaluate(x => x.open), true);
  const layout = await page.evaluate(() => {
    const readout = document.querySelector('#rift-hud-assimilation').getBoundingClientRect();
    const help = document.querySelector('#rift-hud-help').getBoundingClientRect();
    const entry = document.querySelector('#rift-hud-burden').getBoundingClientRect();
    return { insideCanvas: readout.left >= 0 && readout.right <= 960 && readout.bottom <= 640,
      separateFromHelp: readout.left >= help.right || readout.bottom <= help.top,
      belowEntry: readout.top > entry.bottom };
  });
  for (const [key, pass] of Object.entries(layout)) assert(pass, key);
  await page.evaluate(() => window.__hud.update(13000));
  assert.equal(await page.locator('#rift-hud-help').evaluate(x => x.open), true);
  await page.locator('#rift-hud-help summary').click(); assert.equal(await page.locator('#rift-hud-help').evaluate(x => x.open), false);
  await page.evaluate(() => { window.__hud.destroy(); window.__hud.create({ canExtract: () => false, isRunEnded: () => false, getAssimilation: () => null }); window.__hud.restoreReadouts({ health: 100, maxHealth: 100, chaos: 150, kindling: 0 }); });
  const legacyText = await page.locator('#rift-hud').textContent(); assert(legacyText.includes('混乱')); assert(legacyText.includes('150')); assert(!legacyText.includes('/ 100'));
  assert.equal(await page.locator('#rift-hud-assimilation').isVisible(), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ pass: true, scope: 'Production UI modules in isolated blank browser document, not production scene art QA', ...result, assimilation, layout }, null, 2));
} finally { await browser.close(); }
