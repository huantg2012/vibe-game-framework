/** Isolated capacity fixtures; production offering UI and durable transactions. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createJourneyDriver } from './i27-journey-driver.mjs';

const out = process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/offering-capacity-2026-10-16';
const url = process.env.GAME_URL ?? 'http://127.0.0.1:3027/';
const original = JSON.parse(JSON.parse(fs.readFileSync('docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json', 'utf8'))['coh-save-v1']);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
fs.mkdirSync(out, { recursive: true });
const report = { scope: 'Controlled preboot growth levels and unoffered items. Controlled scene.openDefensePanel opens production UI; mouse and keyboard use real InventoryStore/SaveManager. Not earned progression or natural loot evidence.', cases: [] };

try {
  for (const capacity of [1, 2, 3, 4]) {
    const folder = path.join(out, `capacity-${capacity}`);
    const fixture = structuredClone(original);
    fixture.growth.schemaVersion = 2;
    fixture.growth.upgrades.growth_defense_slot = capacity - 1;
    delete fixture.checkpointChecksum;
    for (let i = 0; i < 4; i++) {
      const id = `WPN_offering_capacity_${i}`;
      fixture.inventory.items.push({ kind: 'weapon', id, weapon: { id, definitionId: 'crowbar_good_standard', stage: 'defense', impactCharges: i % 3, usesRemaining: 0 }, location: { kind: 'stash' } });
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.addInitScript(save => { if (!localStorage.getItem('coh-save-v1')) localStorage.setItem('coh-save-v1', JSON.stringify(save)); }, fixture);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    const journey = createJourneyDriver(page, folder);
    const state = () => page.evaluate(async () => {
      const { inventoryStore } = await import('/src/systems/inventory-store.ts');
      const { contaminantSystem } = await import('/src/systems/contaminant-system.ts');
      return { inventory: inventoryStore.getState(), slots: inventoryStore.getOfferingItems(), capacity: contaminantSystem.getDefenseSlotCount(), bytes: localStorage.getItem('coh-save-v1') };
    });
    const readout = () => page.locator('#defense-panel .readout-section').first().textContent();
    const occupied = snapshot => snapshot.slots.filter(Boolean).length;
    const record = { capacity, ok: false, checks: [], errors };
    report.cases.push(record);
    try {
      await page.goto(url);
      await page.locator('.joint-action:not([disabled])').first().waitFor({ state: 'visible' });
      await journey.press('Enter');
      await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
      await page.waitForTimeout(1200);
      await page.evaluate(async () => {
        const { inventoryStore } = await import('/src/systems/inventory-store.ts');
        const { createCatalogContaminant } = await import('/src/systems/contaminant-catalog.ts');
        const item = createCatalogContaminant({ id: 'offering-capacity-catalog', definitionId: 'amber_beetle', appearanceId: 'wax_parcel', offeringProfileId: 'resist_35', quality: 'excellent', acquiredOrdinal: 0 });
        const result = inventoryStore.addContaminant(item);
        if (!result.ok) throw new Error(JSON.stringify(result));
        const originalSetItem = Storage.prototype.setItem;
        window.__rejectOfferingWrite = false;
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage && key === 'coh-save-v1' && window.__rejectOfferingWrite) throw new DOMException('Controlled quota refusal', 'QuotaExceededError');
          return originalSetItem.call(this, key, value);
        };
      });
      await page.evaluate(() => window.__game.scene.getScene('PurificationScene').openDefensePanel());
      await page.locator('#defense-panel').waitFor({ state: 'visible' });
      await page.waitForTimeout(350);
      assert.equal((await state()).capacity, capacity);
      assert.equal(await readout(), `供奉容量 0 / ${capacity}`);
      for (let n = 1; n <= capacity; n++) {
        if (n % 2) await page.locator('.defense-equip-tile').first().click();
        else {
          await page.mouse.move(0, 0);
          await journey.press('Enter');
        }
        assert.equal(occupied(await state()), n, `Capacity ${capacity}: consecutive item ${n}`);
        assert.equal(await readout(), `供奉容量 ${n} / ${capacity}`);
      }
      record.checks.push('mouse/Enter consecutive mixed item offering reaches actual capacity');
      const full = await state();
      await page.locator('.defense-equip-tile').first().click();
      assert.match(await page.locator('#defense-inspect-dock').textContent(), /槽位已满|供奉槽已满/);
      assert.equal((await state()).bytes, full.bytes);
      await page.mouse.move(0, 0);
      await journey.press('Enter');
      assert.deepEqual((await state()).inventory, full.inventory);
      await journey.snap('01-full-capacity');
      record.checks.push('full mouse/keyboard refusal explains real full capacity and does not mutate');

      await page.locator('.defense-unslot-btn').first().hover();
      await page.mouse.move(0, 0);
      await journey.press('Enter');
      assert.equal(occupied(await state()), capacity - 1);
      await journey.press('Tab');
      await journey.press(' ');
      assert.equal(occupied(await state()), capacity);
      record.checks.push('keyboard removal then Tab/Space refill, progress preserved');

      await page.locator('.defense-unslot-btn').first().click();
      const beforeRefusal = await state();
      await page.evaluate(() => { window.__rejectOfferingWrite = true; });
      await page.locator('.defense-equip-tile').first().click();
      assert.match(await page.locator('#defense-panel [role="alert"]').textContent(), /未能保存，物件位置未改变/);
      const refused = await state();
      assert.deepEqual(refused.inventory, beforeRefusal.inventory);
      assert.equal(refused.bytes, beforeRefusal.bytes);
      await page.evaluate(() => { window.__rejectOfferingWrite = false; });
      await page.mouse.move(0, 0);
      await journey.press('Enter');
      const afterRetry = await state();
      assert.equal(occupied(afterRetry), capacity);
      assert.equal(new Set(afterRetry.slots.filter(Boolean).map(item => item.id)).size, capacity);
      for (const item of afterRetry.inventory.items) {
        const before = full.inventory.items.find(candidate => candidate.id === item.id);
        assert(before);
        assert.deepEqual(item.kind === 'weapon' ? item.weapon : item.contaminant, before.kind === 'weapon' ? before.weapon : before.contaminant);
      }
      record.checks.push('mouse removal, rejected persistence leaves bytes/items unchanged, keyboard retry succeeds');
      await journey.press('Escape');
      await page.reload();
      await page.locator('.joint-action:not([disabled])').first().waitFor({ state: 'visible' });
      await journey.press('Enter');
      await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
      assert.deepEqual((await state()).inventory, afterRetry.inventory);
      record.checks.push('cold reload retains exact item state and assignments');
      assert.deepEqual(errors, []);
      record.ok = true;
      console.log(`PASS offering capacity ${capacity}: ${record.checks.length} checks`);
    } catch (error) {
      record.error = String(error);
      await page.screenshot({ path: path.join(folder, 'failure.png') }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
