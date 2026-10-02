/** Fresh-context production haven keys plus real result components with labelled fixtures. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const origin = process.env.NARRATION_URL ?? 'http://127.0.0.1:3027/';
const out = 'docs/qa/artifacts/atmosphere-copy-2026-10-02';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1200, height: 850 } }), page = await context.newPage();
const errors = [], checks = [], lines = [];
page.on('pageerror', e => errors.push(String(e)));
const read = selector => page.locator(selector).textContent();
const shot = name => page.screenshot({ path: `${out}/${name}.png` });
const key = name => page.keyboard.press(name, { delay: 90 });
const fromPool = (text, pool) => page.evaluate(async ({ text, pool }) => {
  const { ATMOSPHERE_LINES } = await import('/src/generated/atmosphere-copy-data.ts');
  return ATMOSPHERE_LINES[pool].some(row => row.text === text);
}, { text, pool });
try {
  await page.goto(origin);
  await page.getByRole('button', { name: '开始', exact: true }).click({ timeout: 60000 });
  await page.locator('#purif-hud').waitFor({ timeout: 30000 });
  await page.locator('#menu-entry-transition').waitFor({ state: 'detached', timeout: 30000 });
  await page.locator('#haven-atmosphere-line').waitFor(); await page.waitForTimeout(600);
  const arrival = await read('#haven-atmosphere-line'); assert(await fromPool(arrival, 'haven.arrival'));
  lines.push({ context: 'real new-game arrival', text: arrival }); await shot('01-arrival');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.locator('#pause-overlay').waitFor();
  assert.equal(await page.locator('#haven-atmosphere-line').evaluate(el => el.style.visibility), 'hidden');
  const frozen = await page.locator('#haven-atmosphere-line').getAttribute('style');
  await page.waitForTimeout(700); assert.equal(await page.locator('#haven-atmosphere-line').getAttribute('style'), frozen);
  await key('x'); assert.equal(await page.locator('#haven-atmosphere-line').evaluate(el => el.style.visibility), '');
  checks.push('real arrival after title, blur hides/freezes and resume retains remaining reading');
  await key('e'); await page.locator('#purification-rest-line').waitFor(); await page.waitForTimeout(900);
  const first = await read('#purification-rest-line'); assert(await fromPool(first, 'haven.rest'));
  lines.push({ context: 'real E sit', text: first }); await shot('02-rest');
  await key('Escape'); await page.waitForTimeout(650); assert.equal(await page.locator('#purification-rest-line').count(), 0);
  await key('e'); await page.waitForTimeout(850); assert.equal(await read('#purification-rest-line'), first);
  await page.waitForTimeout(7500); assert.equal(await page.locator('#purification-rest-line').count(), 0);
  checks.push('real sit/stand clears; rapid resit reuses one line; continued rest becomes silent');
  await page.waitForTimeout(23000); await key('Escape'); await page.waitForTimeout(650); await key('e');
  await page.locator('#purification-rest-line').waitFor(); await page.waitForTimeout(500);
  const second = await read('#purification-rest-line'); assert.notEqual(second, first);
  lines.push({ context: 'later rest', text: second }); checks.push('later rest consumes a different line');
  await key('Escape'); await page.waitForTimeout(650);
  const history = await page.evaluate(() => localStorage.getItem('coh.atmosphere.v1'));
  await page.reload(); await page.getByRole('button', { name: '继续', exact: true }).click({ timeout: 60000 });
  await page.locator('#menu-entry-transition').waitFor({ state: 'detached', timeout: 30000 });
  await page.locator('#purif-hud').waitFor(); await key('e');
  await page.locator('#purification-rest-line').waitFor();
  const third = await read('#purification-rest-line'); assert(![first, second].includes(third));
  assert(history); lines.push({ context: 'rest after real page reload', text: third });
  checks.push('Continue after reload retains used rest history without changing gameplay record format');
  await key('Escape'); await page.waitForTimeout(650);
  // Pause the actual haven underneath explicit result fixtures. No inventory/transaction writes.
  await page.evaluate(async () => { const { audioManager } = await import('/src/managers/audio-manager.ts'); audioManager.game.scene.getScene('PurificationScene').scene.pause(); });
  const fixtures = await page.evaluate(async () => {
    const { riftResultPanel } = await import('/src/ui/dom/rift-result-panel.ts');
    const { impactResultPanel } = await import('/src/ui/dom/impact-result-panel.ts');
    const { ATMOSPHERE_LINES } = await import('/src/generated/atmosphere-copy-data.ts');
    const results = [];
    const base = { survived: true, kindlingGained: 0, acquired: [], weapons: [], killCount: 0, peakChaos: 30, elapsedMs: 60000, passiveTriggers: new Map() };
    for (const [pool, change] of [['result.empty', {}], ['result.return', { kindlingGained: 5 }], ['result.death', { survived: false }], ['result.abandon', { survived: false, abandoned: true }]]) {
      riftResultPanel.show({ ...base, ...change }, () => true);
      const text = document.querySelector('[data-result-narration]').textContent;
      if (!ATMOSPHERE_LINES[pool].some(row => row.text === text)) throw Error('Wrong result pool ' + pool);
      if (change.survived === false && !document.querySelector('#rift-result-panel').textContent.includes('全部遗失')) throw Error('Loss facts missing');
      results.push({ pool, text }); riftResultPanel.close();
    }
    for (const [pool, damage, newHp, exempt] of [[null, 0, 70, true], ['impact.held', 0, 0, false], ['impact.damaged', 5, 65, false], ['impact.broken', 70, 0, false]]) {
      impactResultPanel.show([{ moduleId: 'CORE', damage, newHp }], 1, () => {}, { firstReturnExempt: exempt });
      const line = document.querySelector('[data-impact-narration]');
      if (pool ? !line || !ATMOSPHERE_LINES[pool].some(row => row.text === line.textContent) : line) throw Error('Wrong impact pool ' + pool);
      results.push({ pool, text: line?.textContent ?? null }); impactResultPanel.destroy();
    }
    riftResultPanel.show({ ...base, kindlingGained: 5 }, () => true);
    return results;
  });
  lines.push(...fixtures); await shot('03-result-fixture');
  checks.push('actual result components: empty/loaded/death/abandon retain facts; exempt/held/old broken/damaged/new broken choose truthful pool');
  assert.deepEqual(errors, []);
  await writeFile(`${out}/result.json`, JSON.stringify({ status: 'PASS', at: new Date().toISOString(), origin, checks, lines, errors, scope: 'Fresh isolated context, actual root menu and E/Esc sitting. Result/impact components tested with explicitly injected presentation fixtures, not natural full sorties. User browser/save untouched.' }, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', checks, out }, null, 2));
} catch (error) { await shot('failure'); throw error; }
finally { await context.close(); await browser.close(); }
