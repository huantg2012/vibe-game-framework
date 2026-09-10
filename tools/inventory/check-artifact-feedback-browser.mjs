/** Real Rift keyboard + accepted damage; isolated browser storage, never a user save. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000/';
try {
  await page.goto(base);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  await page.evaluate(async () => {
    window.reviewModule = async path => import(performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === path).name);
    (await window.reviewModule('/src/managers/session.ts')).beginNewExpedition(window.__game.scene.getScene('MainMenuScene'));
  });
  await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene') && !window.__game.scene.getScene('PurificationScene').menuEntry);
  await page.evaluate(async () => {
    const { inventoryStore } = await window.reviewModule('/src/systems/inventory-store.ts');
    window.reviewInventory = inventoryStore;
    for (const [type, slot, uses] of [['mirror', 0, 3], ['compress', 1, 3], ['siphon', 2, 2]]) {
      const added = inventoryStore.addContaminant({ id: `feedback-${type}`, type, rarity: 'common', quality: 'ordinary', stage: 'tool', usesRemaining: uses, impactCharges: 3 });
      if (!added.ok || !inventoryStore.prepareTool(`feedback-${type}`, slot).ok) throw new Error('feedback fixture rejected');
    }
    window.__game.scene.getScene('PurificationScene').enterRift();
  });
  await page.waitForSelector('#inventory-panel.is-prepare');
  await page.keyboard.press('Shift+Enter', { delay: 70 });
  await page.waitForFunction(() => window.__game.scene.isActive('RiftScene'));
  await page.evaluate(() => { window.reviewRift = window.__game.scene.getScene('RiftScene'); });
  await page.keyboard.press('q', { delay: 60 });
  assert.equal(await page.evaluate(() => window.reviewRift.toolSystem.getSlotUses(0)), 2, 'actual Q reaches the equipped active item');
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.equal(await page.evaluate(() => window.reviewRift.combat.applyHazardHit('feedback-review-hit', 1)), true);
    await page.waitForFunction(() => [...document.querySelectorAll('.toast-inline')].some(node => node.textContent.includes('附着的空壳')), null, { timeout: 2000 });
    const state = await page.evaluate(() => ({
      remaining: window.reviewRift.toolSystem.getSlotUses(2),
      resistance: window.reviewRift.toolSystem.getPollutionResistanceBonus(),
      equipped: document.querySelector('.rift-equipment-row[data-slot-id="2"]')?.textContent,
      toast: [...document.querySelectorAll('.toast-inline')].map(node => node.textContent).join(' '),
    }));
    assert.equal(state.remaining, 1 - attempt);
    assert.equal(state.resistance, 20, 'the final use retains its full effect');
    assert.match(state.toast, /附着的空壳/);
    if (attempt === 1) assert.match(state.equipped, /未装配/);
    await page.evaluate(() => window.reviewRift.toolSystem.update(8001));
    await page.waitForTimeout(1100); // expire both the feedback toast and combat hit invulnerability
  }
  console.log('PASS actual Rift damage gives normal and final passive-use feedback after equipment removal');

  // A genuine failed durable transaction must not look like an inert key, or release a free ability.
  await page.evaluate(() => {
    window.reviewOriginalPersist = window.reviewInventory.persist;
    window.reviewInventory.setPersistence(() => { throw new Error('intentional QA persistence failure'); });
  });
  await page.keyboard.press('q', { delay: 60 });
  assert.equal(await page.evaluate(() => window.reviewRift.toolSystem.getSlotUses(0)), 2);
  await page.waitForFunction(() => [...document.querySelectorAll('.toast-inline')].some(node => /保存/.test(node.textContent)), null, { timeout: 2000 });
  assert.equal(await page.evaluate(() => window.reviewRift.ai.visualDecoys.size), 0, 'failed commit does not release a free decoy');
  await page.evaluate(() => window.reviewInventory.setPersistence(window.reviewOriginalPersist));
  assert.deepEqual(errors, []);
  console.log('PASS failed active commit is free and explains the save problem through the existing Rift feedback channel');
} finally { await browser.close(); }
