/** Smoke the actual production bundle with an isolated, unedited real-play save. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = 'docs/qa/artifacts/iteration-28/production-build';
fs.mkdirSync(out, { recursive: true });
const saved = JSON.parse(fs.readFileSync(process.env.SAVE_FIXTURE ?? 'docs/qa/artifacts/iteration-28/production-browser/entry.storage.json', 'utf8'));
const expected = JSON.parse(saved['coh-save-v1']);
assert(expected.riftCheckpoint?.identity.generation, 'recorded actual new-world departure needed');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
await context.addInitScript(values => {
  if (sessionStorage.getItem('production-check-seeded')) return;
  sessionStorage.setItem('production-check-seeded', '1');
  for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
}, saved);
const page = await context.newPage(), errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
try {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3022/');
  await page.locator('#game-container canvas').waitFor(); await page.waitForTimeout(2000); // Phaser title/menu is drawn on canvas.
  assert.equal(await page.evaluate(() => typeof window.__game), 'undefined', 'production must not depend on DEV globals');
  await page.keyboard.press('Enter'); await page.locator('#rift-hud').waitFor();
  await page.waitForTimeout(900);
  const first = await read();
  assert.deepEqual(first.riftCheckpoint.identity, expected.riftCheckpoint.identity);
  assert.deepEqual(first.riftCheckpoint.state.player.position, expected.riftCheckpoint.state.player.position);
  const direction = first.riftCheckpoint.state.player.position.x > 896 ? 'a' : 'd';
  await page.keyboard.down(direction); await page.waitForTimeout(450); await page.keyboard.up(direction);
  await page.waitForTimeout(650); await page.keyboard.press('Escape');
  const moved = await read();
  assert.notDeepEqual(moved.riftCheckpoint.state.player.position, first.riftCheckpoint.state.player.position, 'actual production keyboard movement');
  await page.screenshot({ path: path.join(out, '01-production-paused.png') });
  await page.reload(); await page.locator('#game-container canvas').waitFor(); await page.waitForTimeout(2000); // Phaser title/menu is drawn on canvas.
  await page.keyboard.press('Enter'); await page.locator('#rift-hud').waitFor();
  await page.waitForTimeout(700); await page.keyboard.press('Escape');
  const resumed = await read();
  assert.deepEqual(resumed.riftCheckpoint.identity, moved.riftCheckpoint.identity);
  assert.deepEqual(resumed.riftCheckpoint.state.player.position, moved.riftCheckpoint.state.player.position);
  assert.deepEqual(resumed.inventory.run.dropPlan, moved.inventory.run.dropPlan);
  await page.screenshot({ path: path.join(out, '02-production-resumed.png') });
  assert.deepEqual(errors, []);
  const report = { passed: true, method: 'Actual Vite production bundle, no DEV global. Isolated unmodified real-input save; keyboard move, save and browser reload/continue.',
    identity: resumed.riftCheckpoint.identity, before: first.riftCheckpoint.state.player.position, moved: moved.riftCheckpoint.state.player.position,
    resumed: resumed.riftCheckpoint.state.player.position, saveCharacters: JSON.stringify(resumed).length, errors };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ passed: true, world: report.identity.generation.profile.id, moved: report.moved, resumed: report.resumed, errors }));
} catch (reason) {
  await page.screenshot({ path: path.join(out, 'failure.png') });
  fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ reason: String(reason), errors }, null, 2));
  throw reason;
} finally { await context.close(); await browser.close(); }
