/**
 * Focused production-scene/UI integration regression, using a fresh isolated
 * Chromium context per case. Ended-run fixtures deliberately bypass traversal;
 * base settlement, persistence, report rendering and key input are production.
 * No existing browser profile or player record is opened.
 *
 * GAME_URL=http://127.0.0.1:3021 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
 * CHROME_PATH=/path/to/chrome node tools/qa/check-first-return.mjs
 */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const out = process.env.QA_OUTPUT_DIR ?? '/tmp/coh-first-return-check';
await mkdir(out, { recursive: true });
const results = [];
const errors = [];

async function fixture() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
  const page = await context.newPage();
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3021'}/#purif`);
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.evaluate(async () => {
    // Vite may stamp a changed dependency URL even in a fresh page. Instrument
    // the module instance the running scene loaded, not a second plain-URL copy.
    const loadedModule = pathname => {
      const request = performance.getEntriesByType('resource').reverse()
        .find(entry => new URL(entry.name).pathname === pathname);
      return import(request?.name ?? pathname);
    };
    const [{ gameState }, { inventoryStore }, { saveManager }, { impactSystem },
      { tideSystem }, { stabilityTracker }, { impactResultPanel }, { createCatalogContaminant }, { pauseMenu }] = await Promise.all([
      loadedModule('/src/managers/game-state.ts'), loadedModule('/src/systems/inventory-store.ts'),
      loadedModule('/src/managers/save-manager.ts'), loadedModule('/src/systems/impact-system.ts'),
      loadedModule('/src/systems/tide-system.ts'), loadedModule('/src/systems/stability-tracker.ts'),
      loadedModule('/src/ui/dom/impact-result-panel.ts'), loadedModule('/src/systems/contaminant-catalog.ts'),
      loadedModule('/src/ui/dom/pause-menu.ts'),
    ]);
    const q = window.__firstReturnCheck = {
      gameState, inventoryStore, saveManager, impactSystem, impactResultPanel, pauseMenu,
      createCatalogContaminant, shows: 0, impacts: 0, impactAudio: 0, failWrites: false,
      failedWrites: 0, closed: 0, forecastConsumptions: [],
      read() {
        const scene = window.__game.scene.getScene('PurificationScene');
        return structuredClone({ modules: gameState.getModules(), reserve: gameState.getKindlingReserve(),
          cycle: gameState.getCycle(), tide: tideSystem.getState(), stability: stabilityTracker.getState(),
          inventory: inventoryStore.getState(), forecast: impactSystem.getForecastState(),
          nextTideIntensity: tideSystem.peekNextIntensity(), forecastConsumptions: q.forecastConsumptions,
          input: scene.player.inputEnabled, panel: impactResultPanel.isOpen(), pause: pauseMenu.isOpen(),
          pending: saveManager.hasPendingSave(), shows: q.shows, impacts: q.impacts, impactAudio: q.impactAudio,
          text: document.querySelector('#impact-result-panel')?.textContent ?? '',
        });
      },
    };
    const show = impactResultPanel.show;
    impactResultPanel.show = (...args) => { q.shows++; return show(...args); };
    const run = impactSystem.run;
    impactSystem.run = (...args) => {
      q.impacts++;
      const before = impactSystem.getForecastState();
      const result = run.apply(impactSystem, args);
      q.forecastConsumptions.push({ before, after: impactSystem.getForecastState() });
      return result;
    };
    const scene = window.__game.scene.getScene('PurificationScene');
    const audio = scene.playImpactAudio;
    scene.playImpactAudio = (...args) => { q.impactAudio++; return audio.apply(scene, args); };
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (this === localStorage && key === 'coh-save-v1' && q.failWrites) {
        q.failedWrites++;
        throw new DOMException('Isolated settlement write failure', 'QuotaExceededError');
      }
      return setItem.call(this, key, value);
    };
  });
  assert.equal(await page.locator('#impact-result-panel').count(), 0, 'new base entry has no report');
  return { context, page };
}

const read = page => page.evaluate(() => window.__firstReturnCheck.read());
async function settleFixture(page, { outcome = 'extract', loot = 0, offering = false, fail = false, fromMenu = false } = {}) {
  return page.evaluate(options => {
    const q = window.__firstReturnCheck;
    const must = result => { if (!result.ok) throw new Error(JSON.stringify(result)); };
    if (options.offering) {
      const item = q.createCatalogContaminant({ id: 'first-return-offering', definitionId: 'amber_beetle',
        appearanceId: 'wax_parcel', offeringProfileId: 'resist_35', quality: 'ordinary', acquiredOrdinal: 0 });
      must(q.inventoryStore.addContaminant(item)); must(q.inventoryStore.slotOffering(item.id, 0));
    }
    const id = `first-return-${q.gameState.getCycle() + 1}`;
    if (!q.saveManager.commitWorldTransaction(() => {
      must(q.inventoryStore.beginRun(id, { catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 }));
      q.gameState.incrementCycle();
    })) throw new Error('Fixture departure did not save');
    must(q.inventoryStore.settleRun(id, options.outcome, options.loot));
    const before = q.read();
    q.failWrites = options.fail;
    window.__game.scene.getScene('PurificationScene').scene.restart({ kindlingGained: options.loot,
      survived: options.outcome === 'extract', fromMenu: options.fromMenu });
    return before;
  }, { outcome, loot, offering, fail, fromMenu });
}

async function check(name, run) {
  const f = await fixture();
  try { await run(f.page); results.push(name); console.log(`PASS ${name}`); }
  finally { await f.context.close(); }
}

try {
  for (const outcome of ['extract', 'death', 'abandon']) {
    await check(`first ${outcome}: empty return reports exemption, preserves HP/charges and closes once`, async page => {
      const before = await settleFixture(page, { outcome, offering: true, fromMenu: outcome === 'abandon' });
      await page.locator('#impact-result-panel').waitFor();
      const after = await read(page);
      assert.equal(after.cycle, 1); assert.equal(after.shows, 1); assert.equal(after.impacts, 1);
      assert.equal(after.panel, true); assert.equal(after.input, false); assert.equal(after.impactAudio, 0);
      assert.deepEqual(after.modules, before.modules); assert.equal(after.reserve, before.reserve);
      assert.equal(after.inventory.run.baseSettled, true);
      const offered = state => state.inventory.items.find(item => item.id === 'first-return-offering');
      assert.deepEqual(offered(after), offered(before), 'no charge, transformation or reward on exemption');
      assert.notDeepEqual(after.tide, before.tide, 'normal return still advances tide');
      // I29 R3: exemption suppresses damage/charges, but this returned trip's
      // forecast is consumed. The next promise uses the advanced tide; targets
      // may coincidentally repeat, so do not assert that the random ID changes.
      assert.equal(after.forecastConsumptions.length, 1);
      assert.deepEqual(after.forecastConsumptions[0].before, before.forecast);
      assert.equal(after.forecastConsumptions[0].after.consumed, true, 'first return consumes its forecast');
      assert.equal(after.forecast.consumed, false, 'the next forecast is ready and unconsumed');
      assert.equal(after.forecast.version, 2);
      assert(after.forecast.display, 'the next forecast has a player-facing reading');
      assert(after.modules.some(module => module.id === after.forecast.actualPrimaryId), 'the next real target is frozen');
      assert.equal(after.forecast.nextIntensity, after.tide.currentIntensity, 'next forecast uses the advanced tide');
      assert.equal(after.forecast.nextNextIntensity, after.nextTideIntensity, 'lookahead uses the next tide preview');
      assert.notEqual(after.forecast.nextIntensity, before.forecast.nextIntensity, 'first rise does not retain birth intensity');
      assert.match(after.text, /归来之后/); assert.match(after.text, /首次归来，本次免受冲击/);
      assert.match(after.text, /供奉积累不增加/); assert(!after.text.includes('冲击强度'));
      assert(!after.text.includes('最大损伤')); assert(!after.text.includes('−0'));
      assert.equal(await page.locator('#impact-result-panel .dmg-row').count(), 3);
      const fixed = await page.locator('#impact-close-btn').boundingBox();
      assert(fixed && fixed.y >= 0 && fixed.y + fixed.height <= 960, 'close is within view');
      if (outcome === 'extract') {
        await page.locator('#impact-result-panel').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
        await page.screenshot({ path: path.join(out, 'first-return.png'), timeout: 60000 });
      }
      await page.keyboard.down('Enter'); // ordinary keyboard path
      await page.keyboard.up('Enter');
      await page.waitForTimeout(100);
      const closed = await read(page); assert(!closed.panel); assert(closed.input); assert(!closed.pause);
      assert.equal(await page.locator('#impact-backdrop').count(), 0);
      await page.evaluate(() => { window.__firstReturnCheck.impactResultPanel.close(); window.__firstReturnCheck.impactResultPanel.close(); });
      const closedTwice = await read(page);
      assert.deepEqual(closedTwice.inventory, after.inventory);
      assert.deepEqual(closedTwice.forecast, after.forecast, 'closing the report cannot reroll the next forecast');
    });
  }

  await check('extraction reward saves once; Esc does not open pause; second return still damages and charges', async page => {
    const before = await settleFixture(page, { loot: 7, offering: true });
    await page.locator('#impact-result-panel').waitFor();
    assert.equal((await read(page)).reserve, before.reserve + 7);
    await page.keyboard.press('Escape'); await page.waitForTimeout(250);
    assert.equal((await read(page)).pause, false); assert.equal((await read(page)).input, true);
    const beforeSecond = await settleFixture(page);
    await page.locator('#impact-result-panel').waitFor();
    const second = await read(page);
    assert.equal(second.shows, 2); assert.equal(second.impacts, 2); assert.equal(second.impactAudio, 1);
    assert(second.modules.some((module, i) => module.hp < beforeSecond.modules[i].hp));
    assert.equal(second.inventory.items.find(item => item.id === 'first-return-offering').contaminant.impactCharges, 1);
    assert.match(second.text, /冲击之后/); assert.match(second.text, /冲击强度/);
    assert(!second.text.includes('首次归来')); await page.locator('#impact-close-btn').click();
    assert.equal((await read(page)).input, true);
  });

  await check('save failure hides report; retry publishes once without replaying settlement', async page => {
    const before = await settleFixture(page, { loot: 7, offering: true, fail: true });
    await page.locator('#save-retry-notice').waitFor();
    const pending = await read(page);
    assert(pending.pending); assert(!pending.panel); assert(!pending.input); assert.equal(pending.shows, 0);
    await page.locator('#save-retry-notice button').click();
    assert.equal((await read(page)).shows, 0, 'another failed write cannot reveal the report');
    await page.evaluate(() => { window.__firstReturnCheck.failWrites = false; });
    await page.locator('#save-retry-notice button').click();
    await page.locator('#impact-result-panel').waitFor();
    const after = await read(page);
    assert.equal(after.shows, 1); assert.equal(after.impacts, 1); assert(!after.pending);
    assert.equal(after.reserve, before.reserve + 7); assert.deepEqual(after.tide, pending.tide);
    assert.deepEqual(after.modules, before.modules); assert.deepEqual(after.inventory, pending.inventory);
    assert.deepEqual(after.forecast, pending.forecast, 'retry saves the same forecast candidate');
    await page.locator('#impact-close-btn').click();
    const saved = await read(page);
    await page.evaluate(() => window.__game.scene.getScene('PurificationScene').scene.restart({ kindlingGained: 7, survived: true }));
    await page.waitForTimeout(250);
    const duplicate = await read(page);
    assert.equal(duplicate.shows, 1); assert.equal(duplicate.impacts, 1); assert(!duplicate.panel);
    assert.deepEqual(duplicate.inventory, saved.inventory); assert.deepEqual(duplicate.tide, saved.tide);
    assert.deepEqual(duplicate.forecast, saved.forecast, 'duplicate arrival does not consume or reroll the saved promise');
    assert.equal(duplicate.reserve, saved.reserve);
    await page.evaluate(() => history.replaceState({}, '', '/'));
    await page.reload(); await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
    const reloaded = await page.evaluate(async () => {
      const loadedModule = pathname => {
        const request = performance.getEntriesByType('resource').reverse()
          .find(entry => new URL(entry.name).pathname === pathname);
        return import(request?.name ?? pathname);
      };
      const [{ gameState }, { impactSystem }] = await Promise.all([
        loadedModule('/src/managers/game-state.ts'), loadedModule('/src/systems/impact-system.ts'),
      ]);
      return { reserve: gameState.getKindlingReserve(), forecast: impactSystem.getForecastState() };
    });
    await page.waitForTimeout(250); assert.equal(await page.locator('#impact-result-panel').count(), 0);
    assert.equal(reloaded.reserve, saved.reserve);
    assert.deepEqual(reloaded.forecast, saved.forecast, 'reload preserves the committed next forecast');
  });

  await check('report ignores held-key repeats; destroy removes stale key listener and callback', async page => {
    await settleFixture(page); await page.locator('#impact-result-panel').waitFor();
    await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true })));
    assert.equal((await read(page)).panel, true);
    await page.evaluate(() => {
      const q = window.__firstReturnCheck;
      q.impactResultPanel.show([], 0, () => q.closed++, { firstReturnExempt: true });
      q.impactResultPanel.destroy();
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      q.impactResultPanel.close();
    });
    assert.equal(await page.evaluate(() => window.__firstReturnCheck.closed), 0);
    assert.equal(await page.locator('#impact-backdrop').count(), 0);
  });
  assert.deepEqual(errors, []);
} finally {
  await writeFile(path.join(out, 'results.json'), JSON.stringify({ method: 'Fresh isolated browser contexts; production base scene and systems with synthetic ended-run fixtures. No traversal or visual acceptance claimed.', results, errors }, null, 2));
  await browser.close();
}
console.log(`First-return regression: ${results.length} passed; evidence ${out}`);
