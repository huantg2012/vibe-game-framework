/**
 * I30 production journey regression. New isolated browser storage; real keyboard
 * movement and panel actions only. Read-only scene probes guide the tester, so
 * this is route/lifecycle evidence, not a first-time navigation or art acceptance.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createJourneyDriver } from './i27-journey-driver.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const url = process.env.I30_URL ?? 'http://127.0.0.1:3025/';
const out = process.env.I30_OUT ?? 'docs/qa/artifacts/iteration-30/runtime';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
const d = createJourneyDriver(page, out);
const manifest = {
  at: new Date().toISOString(), version: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTree: 'I30 changes under test', url,
  method: 'Fresh isolated Playwright context; real keyboard; read-only diagnostics for routing; no save injection, teleport, clock change or grants.',
  scope: [], errors,
};
const near = (actual, expected, label, tolerance = 1.1) => assert(Math.abs(actual - expected) <= tolerance,
  `${label}: ${actual} != ${expected}`);
const samePosition = (a, b, label) => {
  near(a.x, b.x, `${label} X`, .001);
  near(a.y, b.y, `${label} Y`, .001);
};
const base = async () => {
  const state = await d.state();
  assert.equal(state.scene, 'base', 'Expected production purification scene');
  return state;
};

async function walkTo(x) {
  for (let count = 0; count < 90; count++) {
    const state = await base();
    assert(['main', 'upper'].includes(state.route), `Horizontal walk began on ${state.route}`);
    const gap = x - state.player.x;
    // A real rendered frame can advance several pixels on a slow test host;
    // device approach is not a subpixel-placement test (endpoints clamp below).
    if (Math.abs(gap) < 3) return state;
    await d.hold([gap > 0 ? 'd' : 'a'], Math.max(20, Math.min(160, Math.abs(gap) / 80 * 1000)));
  }
  assert.fail(`Could not reach x=${x}: ${JSON.stringify(await base())}`);
}

async function reachFloor(route, key) {
  d.log({ event: 'stairs-to-floor', route, key });
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(expected => {
      const scene = window.__game?.scene.getScene('PurificationScene');
      return scene?.probeJourneyState()?.route === expected;
    }, route, { timeout: 7000 });
  } finally {
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(80);
  return base();
}

async function verifyPanel({ name, x, floor, selector, text, shot }) {
  const arrival = await walkTo(x);
  assert.equal(arrival.route, floor, `${name} must be reached on its own floor`);
  await page.waitForTimeout(80);
  assert((await page.locator('#purif-prompt').innerText()).includes(text), `${name} prompt must identify the local device`);
  await d.press('e');
  await page.locator(selector).waitFor({ state: 'visible' });
  await page.waitForTimeout(420);
  await d.snap(shot);
  const before = (await base()).player;
  await d.hold(['d', 'w'], 300);
  samePosition((await base()).player, before, `${name} panel freeze`);
  await d.press('Escape');
  await page.locator(selector).waitFor({ state: 'detached' });
  await page.waitForTimeout(320);
  samePosition((await base()).player, before, `${name} close does not move the actor`);
  manifest.scope.push(`${name}: real E open, movement freeze, Escape close`);
}

try {
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), null, 'Test must begin with fresh isolated storage');
  await d.press('Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1800);
  const start = await base();
  near(start.player.x, 224, 'Spawn X'); near(start.player.y, 286, 'Spawn Y');
  assert.equal(start.route, 'main');
  await d.snap('01-hub-main');

  await d.hold(['w'], 350);
  samePosition((await base()).player, start.player, 'W away from a staircase');
  manifest.scope.push('Fresh MainMenu Enter -> production hub; W on the main floor cannot walk into the rear wall');

  await verifyPanel({ name: '储藏', x: 166, floor: 'main', selector: '#allocation-panel', text: '储藏', shot: '02-storage' });
  await verifyPanel({ name: '核心', x: 276, floor: 'main', selector: '#allocation-panel', text: '核心', shot: '03-repair-core' });
  await walkTo(262);
  assert(!(await page.locator('#purif-prompt').innerText()).includes('蜕变'), 'Upper growth must not be prompted directly below it');
  await verifyPanel({ name: '净化器', x: 386, floor: 'main', selector: '#allocation-panel', text: '净化器', shot: '04-repair-purifier' });
  await walkTo(378);
  assert(!(await page.locator('#purif-prompt').innerText()).includes('供奉'), 'Upper offering must not be prompted directly below it');
  await verifyPanel({ name: '裂隙备行', x: 496, floor: 'main', selector: '#inventory-panel', text: '踏入裂隙', shot: '05-prepare' });

  await walkTo(88);
  await d.hold(['a'], 350);
  near((await base()).player.x, 88, 'Main left boundary clamp', .001);
  await d.hold(['w'], 500);
  const stair = await base();
  assert.equal(stair.route, 'left-stair');
  assert(stair.player.x > 88 && stair.player.x < 184 && stair.player.y < 286 && stair.player.y > 180);
  // Both feet and center travel continuously along the same visible stair slope.
  near((stair.player.x - 88) / 96, (286 - stair.player.y) / 106, 'Left stair support', .00001);
  await page.waitForTimeout(250);
  samePosition((await base()).player, stair.player, 'Released stair input');
  await d.press('e');
  assert.equal(await page.locator('#allocation-panel, #growth-panel, #defense-panel, #inventory-panel').count(), 0,
    'No device interaction is available halfway up a stair');
  await d.hold(['s'], 200);
  const reversed = await base();
  assert(reversed.player.x < stair.player.x && reversed.player.y > stair.player.y, 'S must reverse a partial stair ascent');
  await d.snap('06-stair-stop-reverse');
  const upper = await reachFloor('upper', 'w');
  near(upper.player.x, 184, 'Left upper landing X', .001); near(upper.player.y, 180, 'Upper Y', .001);
  await d.hold(['a'], 350);
  near((await base()).player.x, 184, 'Upper left edge clamp', .001);
  await d.snap('07-hub-upper');
  manifest.scope.push('Left staircase: continuous ascent, stop, reverse, E blocked mid-stair, upper landing and edge clamp');

  await verifyPanel({ name: '蜕变', x: 262, floor: 'upper', selector: '#growth-panel', text: '蜕变', shot: '08-growth' });
  assert(!(await page.locator('#purif-prompt').innerText()).includes('核心'), 'Lower core is not the target above it');
  await verifyPanel({ name: '供奉', x: 378, floor: 'upper', selector: '#defense-panel', text: '供奉', shot: '09-offering' });

  await walkTo(456);
  await d.hold(['d'], 350);
  near((await base()).player.x, 456, 'Upper right edge clamp', .001);
  await d.hold(['s'], 420);
  const rightStair = await base();
  assert.equal(rightStair.route, 'right-stair');
  near((rightStair.player.x - 456) / 96, (rightStair.player.y - 180) / 106, 'Right stair support', .00001);
  await page.waitForTimeout(200);
  samePosition((await base()).player, rightStair.player, 'Released descending input');
  const main = await reachFloor('main', 's');
  near(main.player.x, 552, 'Right lower landing X', .001); near(main.player.y, 286, 'Main Y', .001);
  await d.hold(['d'], 300);
  near((await base()).player.x, 552, 'Main right edge clamp', .001);
  // Traverse the same right stair upwards too, proving both links are bidirectional.
  await reachFloor('upper', 'w');
  near((await base()).player.x, 456, 'Right upper landing X', .001);
  await reachFloor('main', 's');
  await d.snap('10-hub-loop-complete');
  manifest.scope.push('Right staircase: descent, stop, return ascent, both landing clamps; all six devices reached without teleport');

  await walkTo(496);
  await d.press('e');
  await page.locator('#inventory-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await d.press('Shift+Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene'), null, { timeout: 30000 });
  await page.waitForTimeout(700);
  const riftStart = await d.state();
  assert.equal(riftStart.scene, 'rift');
  assert.equal(riftStart.active, true);
  const movementBefore = { ...riftStart.pos };
  await d.hold(['w'], 250);
  const afterW = await d.state();
  assert(afterW.pos.y < movementBefore.y - 3, 'Rift W must still move freely on the top-down Y axis');
  await d.hold(['d'], 250);
  const afterD = await d.state();
  assert(afterD.pos.x > afterW.pos.x + 3, 'Rift D must still move on the top-down X axis');
  await d.snap('11-rift-topdown-regression');
  await d.press('Escape');
  await d.ledger('fresh-session-end');
  manifest.scope.push('Production entrance -> fresh Rift via Shift+Enter; W and D retain top-down movement');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  manifest.ok = true;
} catch (error) {
  manifest.ok = false;
  manifest.failure = String(error);
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  await d.log({ event: 'failure', message: String(error) });
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await context.close();
  await browser.close();
}
console.log(JSON.stringify(manifest, null, 2));
