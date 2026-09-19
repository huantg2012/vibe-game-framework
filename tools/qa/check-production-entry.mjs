/** Final production smoke: only normal UI inputs; storage is read for assertions. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
const out = 'docs/qa/artifacts/iteration-27/production';
fs.mkdirSync(out, { recursive: true });
const errors = [], requests = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('request', request => { if (request.url().endsWith('.js')) requests.push(request.url()); });
const press = key => page.keyboard.press(key, { delay: 100 });
const hold = async (key, ms) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(120); };
const save = () => page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3020');
  await page.waitForTimeout(2000);
  assert.equal(await page.evaluate(() => typeof window.__game), 'undefined');
  await press('Enter'); await page.waitForTimeout(2100);
  assert.equal((await save()).cycle, 0);
  await page.screenshot({ path: out + '/01-fresh-base.png' });
  // Walk around the actual core footprint, then approach the north entrance.
  await hold('ArrowRight', 500); await hold('ArrowUp', 2100); await hold('ArrowLeft', 500);
  await press('e'); await page.waitForTimeout(550);
  assert((await page.locator('body').innerText()).includes('踏入裂隙'));
  await page.screenshot({ path: out + '/02-prepare.png' });
  await press('Shift+Enter'); await page.waitForTimeout(2500);
  assert(await page.locator('#rift-hud-status').isVisible());
  const first = await save();
  assert.equal(first.inventory.run.status, 'active'); assert(first.riftCheckpoint);
  assert(Number.isFinite(first.riftCheckpoint.state.combat.health));
  await page.screenshot({ path: out + '/03-rift-active.png' });
  await press('Escape'); await page.waitForTimeout(250);
  const paused = await save();
  await page.screenshot({ path: out + '/03-rift-pause.png' });
  await page.reload(); await page.waitForTimeout(1700); await press('Enter'); await page.waitForTimeout(2300);
  assert(await page.locator('#rift-hud-status').isVisible());
  await press('Escape'); await page.waitForTimeout(250);
  const resumed = await save();
  assert.equal(resumed.inventory.run.id, paused.inventory.run.id);
  assert.equal(resumed.cycle, paused.cycle);
  assert.deepEqual(resumed.riftCheckpoint.identity, paused.riftCheckpoint.identity);
  assert.deepEqual(resumed.riftCheckpoint.state.player.position, paused.riftCheckpoint.state.player.position);
  assert.equal(resumed.riftCheckpoint.state.combat.health, paused.riftCheckpoint.state.combat.health);
  assert.deepEqual(errors, []);
  await page.screenshot({ path: out + '/04-resumed.png' });
  fs.writeFileSync(out + '/result.json', JSON.stringify({ method: 'Empty isolated storage; production build without __game. Real menu keys, walking to entrance, prepare, departure, pause, browser reload, title continue. No game methods or resource grants.', checks: ['fresh base', 'walk to entrance', 'formal active checkpoint', 'resume same run/world/position/health'], runId: resumed.inventory.run.id, identity: resumed.riftCheckpoint.identity, requests, errors }, null, 2));
  console.log('PASS production normal UI: fresh base, real walk/depart, refresh and same-run recovery');
} finally {
  fs.writeFileSync(out + '/errors.json', JSON.stringify(errors));
  await page.screenshot({ path: out + '/last-state.png' }).catch(() => {});
  await browser.close();
}
