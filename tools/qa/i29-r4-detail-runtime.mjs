/** R4 focused regressions: isolated fixtures, real world entry and input, transport-only failure injection. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createCycleInputs } from './i27-cycle-inputs.mjs';

const outRoot = process.env.I29_R4_DETAIL_OUT ?? 'docs/qa/artifacts/growth-ux-2026-09-21/detail-runtime/verified';
const seed = JSON.parse(JSON.parse(fs.readFileSync('docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json'))['coh-save-v1']);
const route = fs.readFileSync('data/growth-route.csv', 'utf8').trim().split('\n').slice(1).map(line => {
  const [order, id, level, , , , cost] = line.split(','); return { order: +order, id, level: +level, cost: +cost };
});
const cases = [{ name: 'vitality-save-rejection', owned: 0 }, { name: 'thicken-save-rejection', owned: 6 }, { name: 'intermediate-navigation', owned: 16 }, { name: 'completed-navigation', owned: 22 }];
const manifest = { method: 'Isolated Playwright contexts and controlled saves; real walking/E/keyboard/click/wheel. Storage transport refusal only; no runtime game-state setters. Not natural economy or human art acceptance.', cases: [] };
fs.mkdirSync(outRoot, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  for (const test of cases) {
    const out = path.join(outRoot, test.name); fs.mkdirSync(out, { recursive: true });
    const save = structuredClone(seed);
    save.kindlingReserve = 1000; save.growth.schemaVersion = 2; save.moduleMaxHpTier = 0; save.cycle = 1;
    save.growth.progression = { version: 1, impactExperienced: true, offeringCompleted: true, toolRevealed: true, crestExperienced: true };
    delete save.impactForecast; delete save.checkpointChecksum;
    for (const id of Object.keys(save.growth.upgrades)) save.growth.upgrades[id] = 0;
    for (const step of route.slice(0, test.owned)) {
      if (step.id === 'thicken') save.moduleMaxHpTier = step.level; else save.growth.upgrades[step.id] = step.level;
    }
    save.modules.forEach(module => { module.hp = 100; module.maxHp = 100 + 15 * save.moduleMaxHpTier; });
    fs.writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(save, null, 2));
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.addInitScript(s => { if (!localStorage.getItem('coh-save-v1')) localStorage.setItem('coh-save-v1', JSON.stringify(s)); }, save);
    const page = await context.newPage(), errors = [], results = {};
    page.on('pageerror', error => errors.push(String(error)));
    await page.route('**/@vite/client', r => r.fulfill({ contentType: 'application/javascript', body: '' }));
    const d = createJourneyDriver(page, out), c = createCycleInputs(page, d);
    const raw = () => page.evaluate(() => localStorage.getItem('coh-save-v1'));
    const selected = () => page.locator('#growth-panel .card-selected').getAttribute('data-id');
    try {
      await page.goto(process.env.I29_URL ?? 'http://127.0.0.1:3025/');
      await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
      await d.press('Enter'); await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene')); await page.waitForTimeout(1500);
      for (const point of [{ x: 160, y: 238 }, { x: 112, y: 216 }]) assert((await c.baseTo(point)).ok, 'walk to growth cabinet');
      await d.press('e'); await page.waitForTimeout(500);
      const panel = page.locator('#growth-panel'); await panel.waitFor({ state: 'visible' });
      await d.snap('01-open');
      if (test.name.endsWith('save-rejection')) {
        const step = route[test.owned], before = await raw(), reading = await panel.innerText();
        assert.equal(await selected(), step.id);
        results.styles = await panel.evaluate(el => {
          const style = selector => { const node = el.querySelector(selector); if (!node) return null; const s = getComputedStyle(node); return { text: node.textContent, color: s.color, fontSize: s.fontSize, lineHeight: s.lineHeight }; };
          return { name: style('.growth-name'), gain: style('.growth-gain'), gainNumber: style('.growth-gain strong'), note: style('.growth-flavor, .growth-consequences .readout-note'), cost: style('.growth-payment .growth-cost') };
        });
        assert.notEqual(results.styles.gain.color, results.styles.note.color, 'gain and explanatory note colors differ');
        assert.notEqual(results.styles.cost.color, results.styles.gain.color, 'payment and benefit colors differ');
        assert(parseFloat(results.styles.gainNumber.fontSize) > parseFloat(results.styles.note.fontSize), 'gain number dominates note');
        await page.evaluate(() => {
          const original = Storage.prototype.setItem; window.__qaRejectWrite = true;
          Storage.prototype.setItem = function (key, value) {
            if (key === 'coh-save-v1' && window.__qaRejectWrite) throw new DOMException('QA controlled quota failure', 'QuotaExceededError');
            return original.call(this, key, value);
          };
        });
        if (test.owned === 0) await d.press('Enter'); else await panel.locator('#growth-confirm-btn').click();
        await page.waitForTimeout(150);
        assert.equal(await raw(), before, 'rejected save preserves all persisted bytes');
        assert.equal(await panel.innerText(), reading, 'rejected save preserves displayed reserve, level, next action');
        assert((await page.locator('body').innerText()).includes('未能保存，薪柴未扣除。'));
        await d.snap('02-save-rejected');
        await page.evaluate(() => { window.__qaRejectWrite = false; });
        await d.press('Enter');
        const after = JSON.parse(await raw()), base = JSON.parse(before);
        assert.equal(after.kindlingReserve, base.kindlingReserve - step.cost, 'retry spends once');
        assert.equal(step.id === 'thicken' ? after.moduleMaxHpTier : after.growth.upgrades[step.id], step.level, 'retry grants exactly one level');
        assert((await panel.locator('[data-growth-feedback]').innerText()).includes(`Level ${step.level} 已刻入`));
        results.purchase = { beforeReserve: base.kindlingReserve, afterReserve: after.kindlingReserve, targetLevel: step.level, feedback: await panel.locator('[data-growth-feedback]').innerText() };
        await d.snap('03-retry-success');
      } else {
        const list = panel.locator('.decision-main'), cards = panel.locator('.upgrade-card');
        const first = await selected(); await d.press('ArrowDown'); const second = await selected(); assert.notEqual(second, first);
        await d.press('ArrowUp'); assert.equal(await selected(), first, 'keyboard moves selection both ways');
        await cards.nth(1).hover(); assert.equal(await selected(), await cards.nth(1).getAttribute('data-id'), 'pointer and keyboard share selection');
        const box = await list.boundingBox(); assert(box);
        await page.mouse.move(box.x + box.width / 2, box.y + box.height - 20); await page.mouse.wheel(0, 420); await page.waitForTimeout(200);
        const beforeScroll = await list.evaluate(el => el.scrollTop); assert(beforeScroll > 0, 'long list scrolls');
        const last = cards.last(); await last.hover();
        assert.equal(await list.evaluate(el => el.scrollTop), beforeScroll, 'pointer selection preserves list scroll');
        results.layout = await panel.evaluate(el => {
          const list = el.querySelector('.decision-main'), footer = el.querySelector('.key-hint-bar'), aside = el.querySelector('.decision-aside');
          const box = node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
          return { list: box(list), footer: box(footer), aside: box(aside), scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight };
        });
        assert(results.layout.list.bottom <= results.layout.footer.top, 'footer does not cover list');
        assert(results.layout.aside.bottom <= results.layout.footer.top, 'footer does not cover details');
        const forecast = panel.locator('[data-id="growth_forecast_clarity"][data-growth-next="false"]');
        await forecast.hover(); const ownedText = await panel.locator('.decision-aside').innerText();
        assert(!ownedText.includes('→'), 'owned ability describes only current effect');
        if (test.owned === 16) {
          assert(ownedText.includes('Level 2')); assert(ownedText.includes('重点装置'));
          assert(!ownedText.includes('供奉前压力') && !ownedText.includes('供奉抵消前'), 'owned Level 2 preview cannot leak future pressure layer');
        }
        results.ownedForecast = ownedText; await d.snap('02-owned-forecast');
      }
      await d.press('Escape'); await page.waitForTimeout(350);
      assert.equal(await page.locator('#growth-panel').count(), 0);
      const positionBefore = (await d.state()).player;
      assert((await c.baseTo({ x: 145, y: 232 })).ok, 'movement resumes after leaving growth');
      const positionAfter = (await d.state()).player;
      assert(Math.hypot(positionAfter.x - positionBefore.x, positionAfter.y - positionBefore.y) > 10, 'exit really restores player movement');
      results.exit = { positionBefore, positionAfter };
      if (!test.name.endsWith('save-rejection')) {
        await d.press('Tab'); await page.waitForTimeout(200);
        for (let i = 0; i < 3; i++) await d.press(']');
        const status = page.locator('#status-panel'); await status.waitFor({ state: 'visible' });
        assert((await status.innerText()).includes('Level'));
        assert(!/\d\s*\/\s*\d/.test(await status.innerText()), 'growth report has no fractional level notation');
        await status.locator('.item-tile').filter({ hasText: '预兆洞察' }).hover();
        const inspect = await status.locator('#status-inspect-dock').innerText();
        if (test.owned === 16) { assert(inspect.includes('Level 2')); assert(!inspect.includes('供奉前压力') && !inspect.includes('供奉抵消前')); }
        results.statusText = await status.innerText(); await d.snap('03-report-growth');
        await d.press('Tab'); assert.equal(await page.locator('#status-panel').count(), 0);
      }
      assert.deepEqual(errors, []);
      manifest.cases.push({ name: test.name, ok: true, results, errors });
    } catch (error) {
      manifest.cases.push({ name: test.name, ok: false, error: String(error), results, errors });
      await page.screenshot({ path: path.join(out, 'failure.png') });
    } finally { await context.close(); }
  }
} finally {
  await browser.close(); fs.writeFileSync(path.join(outRoot, 'manifest.json'), JSON.stringify(manifest, null, 2));
}
console.log(JSON.stringify(manifest, null, 2));
if (manifest.cases.some(test => !test.ok)) process.exitCode = 1;
