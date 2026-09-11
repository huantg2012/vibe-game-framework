/** Browser integration smoke. Actual keys for movement, attack, inventory and extraction. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
const output = process.env.ARTIFACT_DIR ?? '/tmp/build-lab-smoke';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const context = await browser.newContext({ viewport: { width:1440, height:960 } });
const page = await context.newPage(), errors = [], evidence = [];
page.on('pageerror', error => errors.push(error.stack ?? error.message));
const sentinel = 'build-lab-smoke-production-save-untouched';
await page.goto(base);
await page.evaluate(value => localStorage.setItem('coh-save-v1', value), sentinel);
async function state() { return page.evaluate(() => window.__buildLab.getState()); }
async function load(query) {
  await page.goto(`${base}/build-lab.html?${query}`);
  await page.waitForFunction(() => window.__buildLab?.getState().running || document.querySelector('#error')?.textContent, null, { timeout:25000 });
  const current = await state(); assert.equal(current.error, ''); assert(current.running);
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), sentinel);
  await page.locator('#game-container canvas').click();
  return current;
}
try {
  const initial = await load('scene=watched&build=quiet&seed=7');
  await page.keyboard.down('d'); await page.waitForTimeout(1000); await page.keyboard.up('d');
  const walked = await state(); assert(walked.snapshot.player.x > initial.snapshot.player.x + 30);
  await page.keyboard.press('Tab');
  const bagBefore = await state(); await page.waitForTimeout(500); const bagAfter = await state();
  assert(!bagAfter.paused); assert(bagAfter.snapshot.elapsedMs > bagBefore.snapshot.elapsedMs + 250);
  await page.keyboard.press('Tab');
  await page.locator('#loadout').focus();
  assert((await state()).paused,'editing configuration safely pauses the current run');
  await page.selectOption('#loadout','light'); await page.click('#start');
  await page.waitForFunction(() => window.__buildLab.getState().running && window.__buildLab.getState().inventory.items.length === 3);
  const light = await state(); assert.equal(light.attributes.weight,70); assert(!light.paused);
  const records = await page.evaluate(() => window.__buildLab.getRecords());
  assert.equal(records[0].outcome,'aborted'); assert.equal(records[1].outcome,'running');
  assert.equal(records[0].metadata.fixtureSignature,records[1].metadata.fixtureSignature);
  evidence.push({ initial,walked,light,records });
  await page.screenshot({ path:path.join(output,'watched-light.png') });
  for (const volume of ['gas_mass','mist_bank','dust_swarm']) {
    const snapshot = await load(`scene=periodic&build=cycle-delay&seed=7&volume=${volume}`);
    assert.equal(snapshot.snapshot.hosts.length,1); assert.equal(snapshot.snapshot.hosts[0].substrate,volume);
    assert.equal(snapshot.snapshot.enemies.length,1);
    evidence.push({volume,snapshot});
  }
  await load('scene=contested&build=bare&seed=7');
  await page.screenshot({ path:path.join(output,'contested-start.png') });
  // Start is also the real extraction anchor. A held E uses the actual ExtractionSystem.
  await page.keyboard.down('e'); await page.waitForTimeout(2200); await page.keyboard.up('e');
  await page.waitForFunction(() => window.__buildLab.getRecords().some(record => record.outcome === 'extract'),null,{timeout:6000});
  const extracted = await state(); assert.equal(extracted.inventory.run.status,'settled'); assert.equal(extracted.inventory.run.outcome,'extract');
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')),sentinel);
  await page.keyboard.press('r'); await page.waitForFunction(() => !window.__buildLab.getState().running);
  const returned = await state(); assert.equal(returned.inventory.run.status,'settled');
  evidence.push({extracted,returned});
  await page.reload(); await page.waitForFunction(() => window.__buildLab?.getState().running);
  assert.equal((await state()).inventory.run.status,'active');
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')),sentinel);
  assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'evidence.json'),JSON.stringify({checks:'real input / geometry / isolated localStorage / no game-state manipulation',evidence,errors},null,2));
  console.log('PASS build-lab browser smoke; evidence:',output);
} finally { await browser.close(); }
