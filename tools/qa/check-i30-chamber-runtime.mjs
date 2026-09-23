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
import { createChamberDriver, CHAMBER_TEST_POINTS as P, CHAMBER_TEST_ROUTES as R } from './i30-chamber-driver.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const url = process.env.I30_URL ?? 'http://127.0.0.1:3025/';
const out = process.env.I30_OUT ?? 'docs/qa/artifacts/iteration-30-r9/runtime';
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
  workingTree: process.env.I30_LABEL ?? 'I30 R9 changes under test', url,
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

const chamber = createChamberDriver(page, d);

async function verifyPanel({ name, device, floor, selector, text, shot }) {
  const [x, y] = P[device];
  const arrival = await chamber.walkFeet(x, y);
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
  near(start.player.x, P.spawn[0], 'Spawn X'); near(start.player.y, P.spawn[1] - 10, 'Spawn Y');
  assert.equal(start.route, 'main');
  await d.snap('01-hub-main');
  await d.hold(['w'], 220);
  assert((await base()).player.y < start.player.y - 8, 'W must move into floor depth');
  await chamber.walkFeet(...P.spawn);
  manifest.scope.push('Fresh production entry; W independently moves through depth on main floor');

  await verifyPanel({ name: '核心', device: 'core', floor: 'main', selector: '#allocation-panel', text: '核心', shot: '02-repair-core' });
  await chamber.via(R.coreToStorage);
  await verifyPanel({ name: '储藏', device: 'storage', floor: 'main', selector: '#allocation-panel', text: '储藏', shot: '03-storage' });
  // Walk behind the core, then around its front. The model's base blocks its center.
  await chamber.via(R.storageToBehindCore);
  await page.waitForTimeout(160);
  const occlusion = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('PurificationScene');
    const devices = scene.children.list.filter(object => object.texture?.key?.startsWith('purification-chamber-core-'));
    return { coreAlpha: devices[0]?.alpha, playerAlpha: scene.player.getSprite().alpha };
  });
  assert(occlusion.coreAlpha <= .5, 'Only the occluding device fades so the original player remains findable');
  assert.equal(occlusion.playerAlpha, 1, 'Occlusion must not fade the player');
  await d.snap('04-behind-core');
  await d.hold(['s'], 450);
  const blocked = await base();
  assert(blocked.player.y + 10 <= 289.1, 'Core footprint blocks feet entering the solid base');
  await chamber.via(R.behindToFrontCore);
  await page.waitForTimeout(160);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('PurificationScene').children.list
    .find(object => object.texture?.key?.startsWith('purification-chamber-core-')).alpha), 1,
  'Device opacity restores after the player passes in front');
  await d.snap('05-front-core');
  await chamber.via([P.spawn]);
  await verifyPanel({ name: '净化器', device: 'purifier', floor: 'main', selector: '#allocation-panel', text: '净化器', shot: '06-purifier' });
  await verifyPanel({ name: '裂隙备行', device: 'rift', floor: 'main', selector: '#inventory-panel', text: '踏入裂隙', shot: '07-prepare' });

  await chamber.via([[329, 320], ...R.mainToClimb]);
  const ramp = await base();
  assert.equal(ramp.route, 'left-stair');
  await page.waitForTimeout(160);
  samePosition((await base()).player, ramp.player, 'Released ramp input');
  await d.hold(['a'], 90);
  assert((await base()).player.x < ramp.player.x - 3, 'Ramp has usable width, not a center rail');
  const beforeReverse = await base();
  await d.hold(['s'], 100);
  assert((await base()).player.y > beforeReverse.player.y + 3, 'Ramp permits immediate reversal');
  await d.press('e');
  assert.equal(await page.locator('#allocation-panel, #growth-panel, #defense-panel, #inventory-panel').count(), 0,
    'No device can be operated from a connecting ramp');
  await d.snap('08-ramp-width-stop-reverse');
  await chamber.via(R.climbToUpper);
  await verifyPanel({ name: '蜕变', device: 'growth', floor: 'upper', selector: '#growth-panel', text: '蜕变', shot: '09-growth' });
  await chamber.via(R.upperToOffering);
  await verifyPanel({ name: '供奉', device: 'offering', floor: 'upper', selector: '#defense-panel', text: '供奉', shot: '10-offering' });
  await d.snap('11-upper');
  await chamber.descendEast();
  await d.snap('12-loop-complete');
  manifest.scope.push('All six devices by real movement; behind/front core and solid base; central ramp transverse move/stop/reverse; east ramp descent; no teleport');

  await chamber.via([P.rift]);
  await d.press('e');
  await page.locator('#inventory-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await d.press('Shift+Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene'), null, { timeout: 30000 });
  await page.waitForTimeout(700);
  const riftStart = await d.state();
  assert.equal(riftStart.scene, 'rift');
  assert.equal(riftStart.active, true);
  // The new random world may spawn beside a void. Choose an actually clear
  // direction on each axis, using the original body and floor grid read-only.
  manifest.riftMovement = [];
  for (const axis of ['y', 'x']) {
    const direction = await page.evaluate(axis => {
      const scene = window.__game.scene.getScene('RiftScene');
      const body = scene.player.getSprite().body, grid = scene.formFloorGrid;
      for (const sign of axis === 'y' ? [-1,1] : [1,-1]) {
        let clear = true;
        for (let step=0;step<=20&&clear;step+=2) {
          const x=body.center.x+(axis==='x'?step*sign:0), y=body.center.y+(axis==='y'?step*sign:0);
          for (const dx of [-body.halfWidth,0,body.halfWidth])
            for (const dy of [-body.halfHeight,0,body.halfHeight])
              if(!grid.isWalkableAt(x+dx,y+dy)) clear=false;
        }
        if(clear) return sign;
      }
      return 0;
    },axis);
    assert(direction!==0,`Rift spawn lacks a clear ${axis}-axis probe; choose a real floor route before asserting movement`);
    const before=(await d.state()).pos;
    const key=axis==='x'?(direction>0?'d':'a'):(direction>0?'s':'w');
    await d.hold([key],180);
    const after=(await d.state()).pos;
    assert((after[axis]-before[axis])*direction>3,`Rift ${key} must move on clear ${axis} axis`);
    manifest.riftMovement.push({axis,key,before,after});
  }
  await d.snap('13-rift-topdown-regression');
  await d.press('Escape');
  await d.ledger('fresh-session-end');
  manifest.scope.push('Production entrance -> fresh Rift via Shift+Enter; Both axes retain top-down movement on read-only verified floor clearance');
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
