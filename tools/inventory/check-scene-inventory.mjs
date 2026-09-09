/** Actual production scenes in an isolated Chromium context; never touches a user's save. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.error(error.stack); });
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3000/');
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  // Resolve Vite's original, timestamped module URLs. Bare imports create a second singleton after HMR.
  await page.evaluate(async () => {
    window.productionModule = async path => import(performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === path).name);
    const { beginNewExpedition } = await window.productionModule('/src/managers/session.ts');
    beginNewExpedition(window.__game.scene.getScene('MainMenuScene'));
  });
  await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene'));
  await page.waitForFunction(()=>!window.__game.scene.getScene('PurificationScene').menuEntry);
  await page.keyboard.press('b', {delay:80}); await page.waitForSelector('#inventory-panel');
  assert.equal(await page.locator('.inventory-title').innerText(), '随身');
  await page.keyboard.press('Escape', {delay:80});
  await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
  await page.waitForSelector('#inventory-panel'); await page.keyboard.press('Shift+Enter', {delay:80});
  await page.waitForFunction(() => window.__game.scene.isActive('RiftScene'));
  const departed = await page.evaluate(async () => (await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.getState());
  assert.equal(departed.run.status, 'active'); assert.equal(departed.run.carriedOutIds.length, 1);
  console.log('PASS real base B, preparation and durable departure');

  await page.evaluate(() => {
    const scene = window.__game.scene.getScene('RiftScene');
    scene.probeReviewProtection(true);
    const node = scene.search.nodes.find(value => value.kind === 'kindling' && value.tier !== 'safe');
    scene.probePlacePlayer(node.position.x, node.position.y);
    scene.probeSetSearchHeld(true);
  });
  await page.waitForFunction(() => window.__game.scene.getScene('RiftScene').search.nodes.some(node => node.weaponDefinitionId && node.collected));
  await page.evaluate(() => window.__game.scene.getScene('RiftScene').probeSetSearchHeld(false));
  const searched = await page.evaluate(async () => (await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.getState());
  const loot = searched.items.find(item => !searched.run.carriedOutIds.includes(item.id));
  assert.equal(loot.weapon.definitionId, 'crowbar_good_standard');
  assert.equal(loot.location.kind, 'carried');
  console.log('PASS actual timed pile search yields a durable first crowbar alongside kindling');

  await page.keyboard.press('b', {delay:80}); await page.waitForSelector('#inventory-panel');
  const before = await page.evaluate(() => window.__game.scene.getScene('RiftScene').time.now);
  await page.waitForTimeout(250);
  assert.equal(await page.evaluate(time => window.__game.scene.getScene('RiftScene').time.now > time, before), true);
  await page.keyboard.press('w', {delay:80}); await page.waitForSelector('#inventory-panel', { state: 'detached' });
  console.log('PASS backpack keeps world clock running; movement closes it');

  await page.evaluate(async () => {
    window.__game.scene.getScene('RiftScene').runController.endRun('extract');
  });
  await page.waitForSelector('#rift-result-panel');
  assert.match(await page.locator('#rift-result-panel').innerText(), /带回武器\n优良撬棍/);
  await page.keyboard.press('r', {delay:80});
  await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene'), null, {timeout:5000}).catch(async error=>{console.log('RETURN DIAGNOSTIC', await page.evaluate(()=>({scene:window.__game.scene.getScenes(true).map(s=>s.scene.key),input:window.__game.scene.getScene('RiftScene').input.keyboard.enabled,ended:window.__game.scene.getScene('RiftScene').runController.isRunEnded(),restarted:window.__game.scene.getScene('RiftScene').runController.restarted,focus:document.activeElement?.tagName}))); throw error;});
  const returned = await page.evaluate(async () => (await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.getState());
  assert.equal(returned.run.baseSettled, true);
  assert.equal(returned.items.find(item => item.id === loot.id).location.kind, 'stash');
  assert.deepEqual(returned.run.returnedIds, [loot.id]);
  console.log('PASS actual result shows final carried loot and base settlement is durable');

  // A second run dies: carry-out equipment is lost but the previous run's stashed crowbar remains.
  await page.evaluate(async () => {
    const { impactResultPanel } = await window.productionModule('/src/ui/dom/impact-result-panel.ts');
    impactResultPanel.close();
    window.__game.scene.getScene('PurificationScene').enterRift();
  });
  await page.waitForSelector('#inventory-panel');
  await page.locator(`[data-item-id="${loot.id}"]`).click();
  await page.keyboard.press('Enter', {delay:80});
  await page.keyboard.press('Shift+Enter', {delay:80});
  await page.waitForFunction(() => window.__game.scene.isActive('RiftScene'));
  const swing = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('RiftScene');
    scene.combat.requestPlayerAttack();
    return {...scene.combat.getSwingSnapshot(), layoutSeed: scene.layoutDebug.seed};
  });
  assert.ok(swing.damage >= 29 && swing.damage <= 35);
  assert.equal(swing.runSeed, swing.layoutSeed);
  assert.equal(swing.sequence, 1);
  console.log('PASS actual equipped upgraded crowbar drives production swing range and run seed');
  await page.evaluate(async () => {
    window.__game.scene.getScene('RiftScene').runController.endRun('player_died');
  });
  await page.waitForSelector('#rift-result-panel');
  assert.match(await page.locator('#rift-result-panel').innerText(), /全部遗失/);
  await page.keyboard.press('r', {delay:80});
  await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene'), null, {timeout:5000}).catch(async error=>{console.log('RETURN DIAGNOSTIC', await page.evaluate(()=>({scene:window.__game.scene.getScenes(true).map(s=>s.scene.key),input:window.__game.scene.getScene('RiftScene').input.keyboard.enabled,ended:window.__game.scene.getScene('RiftScene').runController.isRunEnded(),restarted:window.__game.scene.getScene('RiftScene').runController.restarted,focus:document.activeElement?.tagName}))); throw error;});
  const dead = await page.evaluate(async () => (await window.productionModule('/src/systems/inventory-store.ts')).inventoryStore.getState());
  assert.equal(dead.run.outcome, 'death'); assert.equal(dead.run.baseSettled, true);
  assert.equal(dead.items.length, 1); assert.equal(dead.items[0].weapon.definitionId, 'crowbar_plain');
  assert.equal(dead.items.some(item => item.id === loot.id), false);
  assert.equal(dead.equipment.weaponId, null);
  assert.deepEqual(errors, []);
  console.log('PASS death loses carry-out equipment while the unequipped plain crowbar in stash survives; zero browser runtime errors');
} finally { await browser.close(); }
