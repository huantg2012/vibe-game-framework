/** Isolated real-browser durability wiring check. Mutates only this disposable lab context. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${process.env.GAME_URL ?? 'http://localhost:3000'}/combat-lab.html?protected=1&auto-reset=0&weapon=crowbar_plain`);
  await page.waitForFunction(() => window.__combatLab?.getState().ready);
  // Import the exact URL already used by the app, including its HMR suffix. Never read a save.
  const read = () => page.evaluate(async () => {
    const resource = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/systems/inventory-store.ts');
    if (!resource) throw Error('Lab inventory module not loaded');
    const { inventoryStore: store } = await import(resource.name);
    const equipped = store.getEquipment().weaponId;
    const item = equipped ? store.getItem(equipped) : undefined;
    return { state: window.__combatLab.getState(), equipped,
      weaponCount: store.getItems().filter(item => item.kind === 'weapon').length,
      remaining: item?.kind === 'weapon' ? item.weapon.usesRemaining : null,
      bytes: Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)])) };
  });
  const initial = await read();
  assert.equal(initial.remaining, 60);
  await page.evaluate(async () => {
    const url = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/systems/inventory-store.ts').name;
    const { inventoryStore: store } = await import(url);
    store.setPersistence(null);
    const fixture = store.getState();
    fixture.items.find(item => item.kind === 'weapon').weapon.usesRemaining = 1;
    if (!store.loadState(fixture)) throw Error('Last-use fixture rejected');
  });
  const space = async () => { await page.keyboard.down('Space'); await page.waitForTimeout(65); await page.keyboard.up('Space'); };
  // Real keyboard input facing away from the initially distant enemy guarantees an empty swing.
  await page.locator('#game-container canvas').click();
  await page.keyboard.down('a'); await page.waitForTimeout(140); await page.keyboard.up('a');
  await space(); await page.waitForTimeout(440);
  const whiff = await read();
  assert.equal(whiff.state.swingCount, 1, 'real Space input starts a swing');
  assert.equal(whiff.state.hitsDealt, 0, 'out-of-range empty swing');
  assert.equal(whiff.remaining, 1, 'empty swing does not consume a use');
  // The public approach button is part of the experience tool; Space still resolves real geometry/AI.
  let attempts = 0;
  for (; attempts < 3; attempts++) {
    await page.locator('#approach').click(); await page.waitForTimeout(270);
    await space(); await page.waitForTimeout(440);
    if ((await read()).state.hitsDealt === 1) break;
  }
  const diagnostic = await read();
  console.log('CONTACT_DIAGNOSTIC', JSON.stringify(diagnostic));
  assert.equal(diagnostic.state.hitsDealt, 1, 'one of three real approach + Space attempts must hit');
  const hit = await read();
  assert.equal(hit.state.swingCount, 2 + attempts);
  assert.ok(hit.state.subjects[0].health < 75 && hit.state.subjects[0].health > 0, 'last use damages real living enemy');
  assert.equal(hit.equipped, null, 'last successful hit clears equipment reference');
  assert.equal(hit.weaponCount, 0, 'exhausted weapon is removed');
  await page.waitForTimeout(450);
  assert.equal((await read()).state.playerPhase, 'idle', 'last attack completes its recovery');
  await space(); await page.waitForTimeout(440);
  const after = await read();
  assert.equal(after.state.swingCount, hit.state.swingCount, 'weaponless Space cannot start another swing');
  assert.equal(after.state.hitsDealt, 1);
  // Real reset keyboard path restores the selected training loadout, not a persistent game save.
  await page.keyboard.down('r'); await page.waitForTimeout(65); await page.keyboard.up('r');
  await page.waitForFunction(() => window.__combatLab.getState().swingCount === 0);
  const reset = await read();
  assert.equal(reset.remaining, 60); assert.equal(reset.weaponCount, 1);
  assert.equal(reset.state.subjects[0].health, 75);
  assert.deepEqual(reset.bytes, initial.bytes, 'lab interaction did not alter any saved game bytes');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ whiffUses: whiff.remaining, lastDamage: hit.state.lastSwingDamage,
    targetHp: hit.state.subjects[0].health, afterUses: hit.remaining, furtherSwingCount: after.state.swingCount,
    resetUses: reset.remaining, savedBytesUnchanged: true }));
  console.log('weapon-uses-browser PASS: real input whiff / final hit / exhausted lockout / R refill / isolated save');
} finally { await browser.close(); }
