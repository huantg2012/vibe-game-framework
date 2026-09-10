/** Real production ToolSystem/AI/Combat contract checks in an isolated browser context. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const errors = []; page.on('pageerror', error => errors.push(error.message));
const url = (process.env.GAME_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const choose = async (id, value) => { await page.locator(`#${id}`).selectOption(value); await page.waitForTimeout(180); await page.waitForFunction(() => window.__combatLab?.getState().ready); };
try {
  await page.addInitScript(() => localStorage.setItem('coh-save-v1', 'tool-contract-save-sentinel'));
  await page.goto(`${url}/combat-lab.html?auto-reset=0`);
  await page.waitForFunction(() => window.__combatLab?.getState().ready);
  await choose('weapon', 'crowbar_plain');
  await choose('tool-q', 'solidify');
  await choose('exercise', 'duel');
  if (await page.locator('#pause-veil').isVisible()) await page.locator('#resume').click();
  await page.locator('#approach').click();
  await page.keyboard.press('q', { delay: 60 });
  const inspect = () => page.evaluate(() => {
    const s = window.__combatLab.game.scene.getScene('CombatLabScene');
    const enemy = s.ai.getEnemies()[0];
    const c = enemy && s.ai.getEnemyControlState(enemy.getId());
    return { blocked: c?.attackSuppressed, position: enemy && { ...enemy.getPosition() },
      health: s.combat.getHealth(), enemyHealth: enemy && s.combat.getEnemyHealth(enemy.getId()),
      hits: window.__combatLab.getState().hitsDealt };
  });
  const frozen = await inspect(); assert.equal(frozen.blocked, true, 'Q reaches production attack suppression');
  await page.waitForTimeout(900);
  const held = await inspect(); assert.equal(held.blocked, true);
  assert.equal(held.health, frozen.health, 'frozen enemy cannot finish a windup');
  assert.ok(Math.hypot(held.position.x - frozen.position.x, held.position.y - frozen.position.y) < 1, 'frozen body remains still');
  await page.keyboard.press('Space', { delay: 70 });
  await page.waitForFunction(() => window.__combatLab.getState().hitsDealt > 0, null, { timeout: 2000 });
  const broken = await inspect(); assert.equal(broken.blocked, false, 'accepted damage breaks freeze');
  assert.ok(broken.enemyHealth < frozen.enemyHealth, 'breaking blow deals real damage');
  console.log('PASS real Q freezes body and cancels enemy attacks; real crowbar contact deals damage and thaws');
  await choose('tool-q', 'expand');
  if (await page.locator('#pause-veil').isVisible()) await page.locator('#resume').click();
  const uses = await page.evaluate(() => window.__combatLab.getState().tools.find(t => t.id === 'expand').remaining);
  await page.keyboard.press('q', { delay: 50 });
  assert.equal(await page.evaluate(() => window.__combatLab.getState().tools.find(t => t.id === 'expand').remaining), uses,
    'open ground without a wall cannot spend a phase use');
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), 'tool-contract-save-sentinel');
  assert.deepEqual(errors, []);
  console.log('PASS invalid phase activation is free; formal save unchanged; no browser exceptions');
} finally { await browser.close(); }
