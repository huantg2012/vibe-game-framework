/** F037/F011 loading UI regression. Production departure + real Workers in a
 * fresh browser context. Direct scene interaction avoids unrelated navigation;
 * no player record, map seed, clock, renderer or completion result is replaced. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:3038/';
const out = path.resolve(process.env.QA_OUTPUT_DIR
  ?? `docs/qa/artifacts/rift-loading-2026-10-20/attempt-${new Date().toISOString().replace(/[:.]/g, '-')}`);
assert(!fs.existsSync(out), 'Keep previous evidence; choose a fresh output directory');
fs.mkdirSync(out, { recursive: true });
const report = {
  startedAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  method: 'New isolated record, real production preparation/Workers. Read-only state and animation observation; keyboard/click interaction. Preparation page is opened via its real scene method.',
  sources: Object.fromEntries(['src/ui/dom/pause-menu.ts', 'src/ui/dom/panel-styles.ts', 'src/scenes/purification-scene.ts']
    .map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  checks: [], errors: [], status: 'running',
};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = (name, detail) => { report.checks.push({ name, status: 'pass', detail }); save(); console.log(`PASS ${name}`); };
save();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
page.on('pageerror', error => { report.errors.push(String(error)); save(); });
// Keep Vite's exported CSS/hot-context helpers available; block only its live
// update transport so an unrelated edit cannot reload a verification halfway.
await page.routeWebSocket(/ws:\/\/127\.0\.0\.1:/, socket => socket.close());
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene('PurificationScene');
  return {
    preparing: !!scene.departureAbort, paused: scene.scene.isPaused(), active: scene.scene.isActive(),
    position: { ...scene.player.getPosition() }, world: { ...scene.locomotion.getWorldPosition() },
    physicsElapsed: scene.physics.world._elapsed, sceneNow: scene.time.now,
    visual: { seconds: scene.chamber.elapsed, exterior: scene.chamber.exteriorClock.seconds },
    game: JSON.stringify(window.__preparationCheck.gameState.getState()),
    inventory: JSON.stringify(window.__preparationCheck.inventoryStore.getState()),
    raw: localStorage.getItem('coh-save-v1'),
    menuText: document.querySelector('.pause-menu-panel')?.textContent ?? null,
    title: document.querySelector('.pause-menu-panel .panel-title')?.textContent,
    stage: document.querySelector('.rift-preparation-line.is-current')?.dataset.stage,
    activity: document.querySelector('.rift-preparation-activity')
      ? getComputedStyle(document.querySelector('.rift-preparation-activity')).width : null,
    preRenderListeners: window.__game.events.listenerCount('prerender'),
  };
});
async function prepare() {
  await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
  await page.locator('[data-departure-grade="low"]').click();
  await page.locator('[data-prepare-action="next"]').click();
  await page.locator('[data-prepare-action="depart"]').waitFor();
  await page.waitForTimeout(250);
}
async function screenshot(name) {
  const buffer = await page.screenshot({ path: path.join(out, name), fullPage: false });
  return sharp(buffer).extract({ left: 0, top: 0, width: 700, height: 960 }).ensureAlpha().raw().toBuffer();
}
try {
  report.browser = browser.version();
  await page.goto(base);
  await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive(), null, { timeout: 30000 });
  await page.keyboard.press('Enter', { delay: 70 });
  await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene'));
  await page.waitForTimeout(2300);
  await page.evaluate(async () => {
    const loaded = pathname => {
      const request = performance.getEntriesByType('resource').reverse().find(entry => new URL(entry.name).pathname === pathname);
      return import(request?.name ?? pathname);
    };
    const [{ gameState }, { inventoryStore }] = await Promise.all([
      loaded('/src/managers/game-state.ts'), loaded('/src/systems/inventory-store.ts'),
    ]);
    window.__preparationCheck = { gameState, inventoryStore, stages: [] };
    const observer = new MutationObserver(() => {
      const line = document.querySelector('.rift-preparation-line.is-current');
      if (!line) return;
      const record = { stage: line.dataset.stage, text: line.textContent, at: performance.now() };
      const stages = window.__preparationCheck.stages;
      if (stages.at(-1)?.stage !== record.stage) stages.push(record);
    });
    observer.observe(document.getElementById('dom-ui-root'), { childList: true, subtree: true });
  });
  await prepare();
  const baseState = await snapshot();
  await page.locator('[data-prepare-action="depart"]').click();
  await page.locator('.rift-preparation-log').waitFor();
  await page.waitForTimeout(250);
  const start = await snapshot();
  assert.equal(start.title, '临行');
  assert(start.paused && start.preparing);
  assert(!start.menuText.includes('记录') && !start.menuText.includes('选中') && !start.menuText.includes('合上'));
  assert(start.menuText.includes('取消准备') && start.menuText.includes('我还看不清那边。'));
  check('loading has its own title, real initial phase and one unambiguous cancel action', { title: start.title, text: start.menuText });
  const image0 = await screenshot('loading-start.png');
  for (const key of ['w', 'e', 'Tab']) await page.keyboard.down(key);
  await page.waitForTimeout(650);
  for (const key of ['w', 'e', 'Tab']) await page.keyboard.up(key);
  const held = await snapshot();
  const image1 = await screenshot('loading-after.png');
  assert(held.preparing && held.paused, 'Must observe a live pending operation, not a completed scene');
  assert(held.visual.seconds > start.visual.seconds && held.visual.exterior > start.visual.exterior);
  let changed = 0;
  for (let i = 0; i < image0.length; i += 4) {
    if (Math.abs(image0[i] - image1[i]) + Math.abs(image0[i + 1] - image1[i + 1]) + Math.abs(image0[i + 2] - image1[i + 2]) > 9) changed++;
  }
  assert(changed > 100, 'Real visible background must change, not only the DOM indicator');
  for (const key of ['position', 'world', 'physicsElapsed', 'sceneNow', 'game', 'inventory', 'raw']) {
    assert.deepEqual(held[key], start[key], `${key} remains frozen while the real visual projection runs`);
  }
  check('real background animates while movement, timers, state and save remain frozen', {
    startVisual: start.visual, afterVisual: held.visual, changedLeftPixels: changed,
  });
  const widths = [];
  for (let i = 0; i < 5; i++) {
    widths.push((await snapshot()).activity);
    await page.waitForTimeout(110);
  }
  assert(new Set(widths).size > 1, 'An unchanged phase must still indicate activity');
  check('current stage has an animated activity mark without fabricated progress', widths);
  await page.keyboard.press('Escape', { delay: 60 });
  await page.waitForFunction(() => !window.__game.scene.getScene('PurificationScene').departureAbort);
  const cancelled = await snapshot();
  assert(cancelled.active && !cancelled.paused && !cancelled.menuText);
  assert.equal(cancelled.raw, baseState.raw);
  assert.equal(cancelled.game, baseState.game);
  assert.equal(cancelled.inventory, baseState.inventory);
  assert.deepEqual(cancelled.position, start.position);
  assert.equal(cancelled.preRenderListeners, baseState.preRenderListeners);
  check('Escape cancels without consuming inventory, changing record or leaking visual listeners');
  await page.waitForTimeout(250);
  await prepare();
  await page.evaluate(() => { window.__preparationCheck.stages.length = 0; });
  await page.locator('[data-prepare-action="depart"]').click();
  await page.waitForFunction(() => {
    const scene = window.__game.scene.getScene('RiftScene');
    return scene?.scene.isActive() && scene.player && !scene.stagedEntry?.isActive() && !scene.nativeEntryFence?.isActive()
      && !scene.entryView?.active;
  }, null, { timeout: 90000 });
  const stages = await page.evaluate(() => window.__preparationCheck.stages);
  assert.equal(stages[0]?.stage, 'layout');
  assert(stages.some(entry => entry.stage === 'surface'));
  assert.equal(await page.locator('.rift-preparation-log').count(), 0);
  await page.screenshot({ path: path.join(out, 'entered-rift.png') });
  check('actual Worker stages proceed from layout to surface and enter the real Rift', stages);
  const player = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('RiftScene'), presentation = scene.lastLightPlayerPresentation;
    window.__preparationCheck.attackImage = null;
    const capture = () => {
      const probe = presentation.getProbe();
      if (probe.attackPhase !== 'active') return;
      window.__preparationCheck.attackImage = { png: window.__game.canvas.toDataURL('image/png'), probe };
      window.__game.events.off('postrender', capture);
    };
    window.__game.events.on('postrender', capture);
    return {
      world: scene.recovery?.identity.generation?.package.id,
      scale: presentation.image.scaleX, contactScale: presentation.contact.scaleX,
      gloveScale: presentation.glove.scaleX, weaponScale: presentation.weapon.scaleX,
      body: { width: scene.player.getSprite().body.width, height: scene.player.getSprite().body.height },
      probe: presentation.getProbe(),
    };
  });
  await page.keyboard.press('Space', { delay: 70 });
  await page.waitForFunction(() => !!window.__preparationCheck.attackImage, null, { timeout: 3000 });
  const attackImage = await page.evaluate(() => window.__preparationCheck.attackImage);
  fs.writeFileSync(path.join(out, 'player-active-attack.png'), Buffer.from(attackImage.png.split(',')[1], 'base64'));
  assert.equal(player.scale, .8);
  assert.equal(player.contactScale, .8);
  assert.equal(player.gloveScale, .8);
  assert.equal(player.weaponScale, .68 * .8);
  check('Rift player applies one .8 transform and actual Space attack still renders', { ...player, activeAttack: attackImage.probe });
  assert.deepEqual(report.errors, []);
  report.status = 'passed';
} catch (error) {
  report.status = 'failed';
  report.failure = error.stack ?? String(error);
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  save();
  await context.close();
  await browser.close();
}
