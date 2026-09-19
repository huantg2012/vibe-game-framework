/** Growth and thickening failure through real purchase controls, isolated storage. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const out = 'docs/qa/artifacts/iteration-27/root', key = 'coh-save-v1', errors = [], results = [];
const fixture = JSON.parse(fs.readFileSync('docs/qa/artifacts/game-wide-review-2026-09-18/tech/advanced-24.storage.json', 'utf8'));
const press = key => page.keyboard.press(key, { delay: 100 });
const raw = () => page.evaluate(key => localStorage.getItem(key), key);
const reading = id => page.evaluate(id => ({ reserve: document.querySelector('#growth-panel .panel-reserve')?.textContent,
  level: document.querySelector(`#growth-panel [data-id="${id}"] .readout-note`)?.textContent }), id);
page.on('pageerror', error => errors.push(String(error)));
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3016');
  for (const id of ['growth_vitality', 'thicken']) {
    await page.evaluate(fixture => { localStorage.clear(); for (const [key, value] of Object.entries(fixture)) localStorage.setItem(key, value); }, fixture);
    await page.reload(); await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
    await press('Enter'); await page.waitForTimeout(2000);
    await page.evaluate(() => window.__game.scene.getScene('PurificationScene').openWorldInteraction('growth'));
    await page.waitForTimeout(400);
    const card = page.locator(`#growth-panel [data-id="${id}"]`);
    await card.hover(); const before = await reading(id), bytes = await raw(), base = JSON.parse(bytes);
    await page.evaluate(key => { const original = Storage.prototype.setItem; window.__qaWriteReject = true;
      Storage.prototype.setItem = function(k, value) { if (k === key && window.__qaWriteReject) throw new DOMException('QA growth quota', 'QuotaExceededError'); return original.call(this, k, value); }; }, key);
    await card.click(); await page.waitForTimeout(200);
    assert.deepEqual(await reading(id), before); assert.equal(await raw(), bytes);
    assert((await page.locator('body').innerText()).includes('保存'));
    await page.screenshot({ path: `${out}/${id}-rejected.png` });
    await page.evaluate(() => window.__qaWriteReject = false);
    await card.click(); await page.waitForTimeout(250);
    const after = JSON.parse(await raw());
    const beforeLevel = id === 'thicken' ? base.moduleMaxHpTier : base.growth.upgrades[id] ?? 0;
    const afterLevel = id === 'thicken' ? after.moduleMaxHpTier : after.growth.upgrades[id] ?? 0;
    assert.equal(afterLevel, beforeLevel + 1); assert(after.kindlingReserve < base.kindlingReserve);
    results.push({ id, before, after: await reading(id), reserveBefore: base.kindlingReserve, reserveAfter: after.kindlingReserve, beforeLevel, afterLevel });
    await page.reload(); await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
    await press('Enter'); await page.waitForTimeout(1900);
    const loaded = JSON.parse(await raw());
    assert.deepEqual(loaded.growth, after.growth); assert.equal(loaded.moduleMaxHpTier, after.moduleMaxHpTier); assert.equal(loaded.kindlingReserve, after.kindlingReserve);
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(out + '/growth-rejected-writes.json', JSON.stringify({ method: 'Unchanged isolated advanced24 fixture; actual purchase clicks with storage-transport refusal. Panels opened through normal scene entry method. No grants or state edits.', results, errors }, null, 2));
  console.log('PASS purchase UI: growth/thickening reject without spending; retry exactly once; reload retains result');
} finally { await browser.close(); }
