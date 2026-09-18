/** Actual keyboard verification. Read-only debug data chooses routes; no simulation writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const output = process.argv[2] ?? 'docs/qa/artifacts/iteration-26/play';
const base = process.env.WORLD_PLAY_URL ?? 'http://127.0.0.1:3011';
const initialWorld = process.env.WORLD_PLAY_WORLD ?? 'ash-strata';
const singleRun = process.env.WORLD_PLAY_SINGLE === '1';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1040 }, deviceScaleFactor: 1,
  ...(process.env.WORLD_PLAY_VIDEO === '1' ? { recordVideo: { dir: output, size: { width: 1600, height: 1040 } } } : {}) });
const events = [], failures = [], errors = [];
const captures = new Set();
page.on('pageerror', error => errors.push(error.stack ?? error.message));
await page.addInitScript(() => {
  localStorage.setItem('coh-save-v1', 'I26-independent-browser-sentinel');
  window.__storageWrites = [];
  const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem, clear = Storage.prototype.clear;
  Storage.prototype.setItem = function(key, value) { window.__storageWrites.push({ operation: 'set', key }); return set.call(this, key, value); };
  Storage.prototype.removeItem = function(key) { window.__storageWrites.push({ operation: 'remove', key }); return remove.call(this, key); };
  Storage.prototype.clear = function() { window.__storageWrites.push({ operation: 'clear' }); return clear.call(this); };
});
const read = () => page.evaluate(() => window.__worldPlay.getState());
const record = async (action, extra = {}) => {
  const state = await read();
  events.push({ time: new Date().toISOString(), action, ...extra, snapshot: state.snapshot, surface: state.surface });
  return state;
};
const press = async (key, milliseconds) => {
  await page.keyboard.down(key); await page.waitForTimeout(milliseconds); await page.keyboard.up(key); await page.waitForTimeout(35);
};
async function walkTo(target, name) {
  const state = await read();
  const route = await page.evaluate(({ from, to }) => window.__worldPlay.getRoutes(from, to), { from: state.snapshot.player, to: target });
  events.push({ action: 'route', name, route });
  for (const point of route) for (const axis of ['x', 'y']) {
    let count = 0;
    while (true) {
      const current = (await read()).snapshot;
      assert(!current.ended, `Run ended while walking to ${name}`);
      for (const [label, condition] of [['moving-threat', current.enemies.some(enemy => enemy.state === 'chase')], ['moving-damaged', current.hp < 100]]) {
        if (condition && !captures.has(label)) {
          captures.add(label); await record(label); await page.screenshot({ path: `${output}/${label}.png` });
        }
      }
      const difference = point[axis] - current.player[axis];
      if (Math.abs(difference) < 1.5) break;
      assert(count++ < 45, `Cannot reach ${name} ${JSON.stringify(point)} from ${JSON.stringify(current.player)}`);
      const key = axis === 'x' ? difference > 0 ? 'KeyD' : 'KeyA' : difference > 0 ? 'KeyS' : 'KeyW';
      await press(key, Math.max(17, Math.min(180, Math.abs(difference) / 80 * 1000 - 8)));
    }
  }
  await record(`arrive:${name}`, { target });
}
let startedAt = Date.now();
try {
  await page.goto(`${base}/rift-world-play.html?world=${initialWorld}&space=open-scars&seed=70421`);
  await page.waitForFunction(() => window.__worldPlay?.getState().sceneCreated || window.__worldPlay?.getState().error, null, { timeout: 30000 });
  let state = await read(); assert.equal(state.error, ''); assert(state.sceneCreated);
  events.push({ action: 'ready', elapsedWallMs: Date.now() - startedAt, metadata: state.metadata });
  await page.waitForTimeout(400); state = await record('start');
  assert.equal(state.surface.footprint.width, 20); assert.equal(state.surface.footprint.height, 20);
  assert(Math.abs(state.surface.footprint.x + 10 - state.snapshot.player.x) < .01);
  assert(Math.abs(state.surface.footprint.y + 10 - state.snapshot.player.y) < .01);
  await page.screenshot({ path: `${output}/01-start.png` });
  const safe = state.layout.kindlingNodes[0].position;
  await walkTo(safe, 'safe-search');
  await press('KeyE', 550);
  state = await record('search-release-interrupt'); assert.equal(state.snapshot.search.remaining, 4); assert.equal(state.snapshot.search.progress, null);
  await page.keyboard.down('KeyE'); await page.waitForTimeout(650);
  state = await record('search-channel'); assert(state.snapshot.search.progress > 0);
  await page.screenshot({ path: `${output}/02-searching.png` });
  await page.waitForTimeout(900); await page.keyboard.up('KeyE'); await page.waitForTimeout(500);
  state = await record('search-complete'); assert.equal(state.snapshot.search.remaining, 3);
  assert.equal(state.snapshot.kindling, 1);
  await press('Tab', 30); await page.waitForTimeout(250);
  await page.screenshot({ path: `${output}/03-native-inventory.png` });
  const beforeBag = await read(); await page.waitForTimeout(400); const afterBag = await read();
  assert(afterBag.snapshot.elapsedMs > beforeBag.snapshot.elapsedMs, 'Inventory must not pause the native world');
  await press('Tab', 30);
  state = await read();
  await walkTo(state.layout.extractionPoint.position, 'extraction');
  await page.screenshot({ path: `${output}/04-before-extract.png` });
  await press('KeyE', 45); await page.waitForTimeout(1000);
  state = await record('settled-extract'); assert(state.snapshot.ended);
  const records = await page.evaluate(() => window.__worldPlay.getRecord());
  assert.equal(records.at(-1).outcome, 'extract');
  assert.equal(state.inventory.run?.status, 'settled');
  await page.screenshot({ path: `${output}/05-result.png` });
  assert.match(await page.locator('#rift-result-continue').innerText(), /返回配置/);
  await writeFile(`${output}/native-run.json`, JSON.stringify(records, null, 2));
  // R returns to the config instead of the base. Reopening gets a clean native run.
  await press('KeyR', 30); await page.waitForTimeout(200);
  assert.equal((await read()).running, false);
  if (!singleRun) {
  for (const [world, space, seed] of [['crystal-fibre', 'fracture-fields', '175150'], ['ivory-basin', 'open-scars', '0'],
    ['carmine-lacquer', 'open-scars', '70421'], ['cobalt-gold', 'open-scars', '70421'], ['ash-strata', 'open-scars', '70421']]) {
    await page.selectOption('#world', world); await page.selectOption('#space', space); await page.fill('#seed', seed);
    startedAt = Date.now(); await page.click('#start');
    await page.waitForFunction(() => window.__worldPlay.getState().sceneCreated || window.__worldPlay.getState().error);
    state = await record('restart', { elapsedWallMs: Date.now() - startedAt }); assert.equal(state.error, '');
    assert.equal(state.surface.textureCount, 2); assert.equal(state.snapshot.search.remaining, 4);
    assert.equal(state.inventory.firstWeaponDiscovered, false);
    await page.waitForTimeout(250); await page.screenshot({ path: `${output}/restart-${world}.png` });
  }
  // Deliberate exposure is actual player input, never forced HP or an injected death.
  state = await read();
  const watcher = state.snapshot.enemies.find(enemy => enemy.id === 'WP_watcher');
  await walkTo({ x: watcher.position.x - 40, y: watcher.position.y }, 'native-threat-exposure');
  const deathDeadline = Date.now() + 45000;
  while (!(await read()).snapshot.ended && Date.now() < deathDeadline) await page.waitForTimeout(500);
  await page.waitForTimeout(850); state = await record('settled-native-death');
  assert(state.snapshot.ended, 'Native enemy did not finish the deliberate exposure');
  const deathRecords = await page.evaluate(() => window.__worldPlay.getRecord());
  assert.equal(deathRecords.at(-1).outcome, 'death');
  assert.equal(state.inventory.run.outcome, 'death');
  assert.equal(state.inventory.equipment.weaponId, null);
  assert.equal(state.inventory.items.filter(item => item.location.kind === 'carried').length, 0);
  await page.screenshot({ path: `${output}/06-native-death.png` });
  await writeFile(`${output}/all-native-records.json`, JSON.stringify(deathRecords, null, 2));
  }
  const storage = await page.evaluate(() => ({ save: localStorage.getItem('coh-save-v1'), writes: window.__storageWrites }));
  assert.equal(storage.save, 'I26-independent-browser-sentinel');
  assert.equal(storage.writes.filter(write => write.key === 'coh-save-v1' || write.operation === 'clear').length, 0);
  events.push({ action: 'storage-isolation', storage });
  assert.deepEqual(errors, []);
} catch (reason) {
  failures.push(reason.stack ?? String(reason));
  await page.screenshot({ path: `${output}/failure.png` }).catch(() => {});
} finally {
  const finalState = await read().catch(() => null);
  await writeFile(`${output}/keyboard-probe.json`, JSON.stringify({ test: 'Native input only; routes read from body-safe graph', events, failures, errors, finalState, endedAt: new Date().toISOString() }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ events: events.length, failures, errors }));
if (failures.length || errors.length) process.exitCode = 1;
