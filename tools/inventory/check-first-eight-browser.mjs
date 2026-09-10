/** First-eight integration: real scene adapters, tools and quality projection. Fresh browser storage only. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
const state = () => page.evaluate(() => window.__combatLab.getState());
const choose = async (id, value) => { await page.locator(`#${id}`).selectOption(value); await page.waitForTimeout(180); await page.waitForFunction(() => window.__combatLab?.getState().ready); };
const resume = async () => { if (await page.locator('#pause-veil').isVisible()) await page.locator('#resume').click(); else await page.locator('#game-container canvas').click(); };
try {
  await page.addInitScript(() => localStorage.setItem('coh-save-v1', 'first-eight-sentinel'));
  await page.goto(`${base}/combat-lab.html?auto-reset=0&tool-q=solidify&tool-passive=retrograde&tool-quality=ordinary&exercise=empty`);
  await page.waitForFunction(() => window.__combatLab?.getState().ready);
  assert.equal(await page.locator('#tool-q option[value="retrograde"]').count(), 0);
  assert.equal(await page.locator('#tool-passive option[value="retrograde"]').count(), 1);
  let expected = 5;
  for (const quality of ['ordinary', 'good', 'fine', 'excellent']) {
    await choose('tool-quality', quality);
    assert.equal((await state()).tools.find(t => t.id === 'solidify').remaining, expected++);
    assert.equal(await page.locator('#tool-description img').count(), 2);
  }
  console.log('PASS four qualities reach real loadout counts; fixed passive role; native icons');
  await choose('tool-q', 'mirror'); await resume(); await page.keyboard.press('q', { delay: 60 });
  assert.equal(await page.evaluate(() => window.__combatLab.game.scene.getScene('CombatLabScene').ai.visualDecoys.size), 1);
  assert.equal((await state()).tools.find(t => t.id === 'mirror').remaining, 6);
  await page.waitForTimeout(8200);
  assert.equal(await page.evaluate(() => window.__combatLab.game.scene.getScene('CombatLabScene').ai.visualDecoys.size), 0);
  console.log('PASS visual decoy reaches AI and expires after real duration');
  await choose('tool-q', 'kindle'); await resume(); await page.keyboard.press('q', { delay: 60 });
  const thrown = await page.evaluate(() => {
    const s = window.__combatLab.game.scene.getScene('CombatLabScene');
    return { position: s.tools.kindleZones[0]?.position, player: s.player.getPosition() };
  });
  assert(thrown.position); assert(Math.hypot(thrown.position.x - thrown.player.x, thrown.position.y - thrown.player.y) > 50);
  assert.equal((await state()).tools.find(t => t.id === 'kindle').remaining, 7);
  console.log('PASS sound source lands ahead on real walk grid; consumes one use');
  await choose('tool-q', 'combust'); await choose('exercise', 'duel');
  const environmental = await page.locator('#enemy option').evaluateAll(options => options.find(o => /气团/.test(o.textContent))?.value);
  assert(environmental, 'production gas entry available'); await choose('enemy', environmental);
  await page.locator('#protected').check(); await page.waitForTimeout(200); await resume(); await page.locator('#approach').click();
  await page.waitForFunction(() => window.__combatLab.game.scene.getScene('CombatLabScene').hosts.getToolTargets().some(t => t.hazardReleased), null, { timeout: 15000 });
  await page.keyboard.press('q', { delay: 60 });
  const suppressed = await page.evaluate(() => window.__combatLab.game.scene.getScene('CombatLabScene').hosts.getToolTargets()[0]);
  assert(suppressed.suppressionRemainingMs > 4500, JSON.stringify(suppressed));
  assert.equal((await state()).tools.find(t => t.id === 'combust').remaining, 5);
  assert.equal((await state()).subjects[0].alive, true);
  const before = (await state()).tools.find(t => t.id === 'combust').remaining;
  await page.keyboard.press('q', { delay: 60 });
  assert.equal((await state()).tools.find(t => t.id === 'combust').remaining, before, 'already suppressed hazard cannot waste a second use');
  console.log('PASS actual gas release is suppressed via Host; core remains alive; invalid repetition free');
  await page.locator('#pause').click();
  await page.screenshot({ path: process.env.I20_SCREENSHOT ?? '/tmp/i20-first-eight-lab.png' });
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), 'first-eight-sentinel');
  assert.deepEqual(errors, []);
  console.log('PASS formal save untouched; no browser errors');
} finally { await browser.close(); }
