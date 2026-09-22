/** Scene-handoff regression: fresh isolated browser profiles, real production
 * new-game/departure inputs, and every rendered frame sampled in the browser.
 * The fault case explicitly injects one cleanup exception; no user save touched. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createChamberDriver } from './i30-chamber-driver.mjs';

const expectFlash = process.argv.includes('--expect-flash');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/iteration-28/rift-entry-transition');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { started: new Date().toISOString(), status: 'running', method: 'Fresh isolated profiles; actual new-game, walking, E and Shift+Enter. No seed/save fixture or movement setter. Read-only postrender observer checks every transition frame, not only final state. Vite HMR disabled in test page to keep its loaded revision fixed. Fault case separately labels its injected cleanup error.', expectFlash, cases: [] };
const persist = () => fs.writeFileSync(path.join(out, expectFlash ? 'before-report.json' : 'report.json'), JSON.stringify(report, null, 2));
async function runCase(name) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
  const page = await context.newPage(), errors = [];
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const dir = path.join(out, name); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'journey.jsonl'), '');
  const driver = createJourneyDriver(page, dir), chamber = createChamberDriver(page, driver);
  const result = { name, errors, injection: name === 'cleanup-fault' ? 'Throw once after PurificationScene chamber.destroy completes. Production cleanup, catch, saved departure and MainMenu handoff otherwise unchanged.' : null };
  report.cases.push(result); persist();
  try {
    await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3021/');
    await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
    await driver.press('Enter');
    await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
    await page.waitForFunction(() => !window.__game.scene.getScene('PurificationScene').menuEntry);
    const p = await page.evaluate(() => ({ ...window.__game.scene.getScene('PurificationScene').player.getPosition() }));
    assert.deepEqual(p, { x: 366, y: 289 }, 'fresh chamber starts on the main floor');
    // Follow the open front side of the purifier, then approach the rift console.
    // The route is in sole coordinates and sends real keys; it never teleports.
    await chamber.via([[415, 303], [492, 303], [507, 287]]);
    const arrival = await driver.state();
    assert.equal(arrival.route, 'main');
    assert(Math.hypot(arrival.player.x - 507, arrival.player.y + 10 - 287) < 3,
      `Actual keyboard route must reach the rift operation point: ${JSON.stringify(arrival)}`);
    await driver.press('e'); await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(dir, 'prepare.png') });
    await page.evaluate(({ fault }) => {
      const game = window.__game, base = game.scene.getScene('PurificationScene');
      const observation = { frames: [], images: {}, firstRiftFrame: null, frame: 0 };
      window.__entryTransitionQA = observation;
      const sample = () => {
        const base = game.scene.getScene('PurificationScene'), rift = game.scene.getScene('RiftScene');
        const overlay = document.getElementById('scene-transition-overlay'), rect = overlay?.getBoundingClientRect(), canvas = game.canvas.getBoundingClientRect();
        const css = overlay && getComputedStyle(overlay);
        const opaqueCover = !!(rect && css && css.display !== 'none' && css.visibility !== 'hidden' && Number(css.opacity) === 1 && css.backgroundColor === 'rgb(0, 0, 0)' && rect.left <= canvas.left + .5 && rect.top <= canvas.top + .5 && rect.right >= canvas.right - .5 && rect.bottom >= canvas.bottom - .5);
        const state = { frame: observation.frame++, at: performance.now(), baseActive: base.scene.isActive(), baseVisible: base.sys.settings.visible, baseCleanup: base.cleanupComplete, baseChildren: base.children?.list.length ?? 0, opaqueCover, overlay: !!overlay, glow: !!document.getElementById('scene-transition-glow'), riftActive: rift.scene.isActive(), riftVisible: rift.sys.settings.visible, menuActive: game.scene.isActive('MainMenuScene') };
        state.uncoveredCleanedBase = !!(state.baseActive && state.baseVisible && state.baseCleanup && !state.opaqueCover);
        observation.frames.push(state);
        const saveImage = key => { if (!observation.images[key]) observation.images[key] = game.canvas.toDataURL('image/png'); };
        if (state.uncoveredCleanedBase) saveImage('uncovered-cleaned-base');
        if (state.baseActive && state.baseCleanup && !state.baseVisible && !state.riftActive) saveImage('handoff-dark-frame');
        if (state.baseCleanup && state.opaqueCover) saveImage('covered-cleanup-canvas');
        if (state.riftActive && state.riftVisible && observation.firstRiftFrame === null) { observation.firstRiftFrame = state.frame; saveImage('first-rift-canvas'); }
      };
      game.events.on('postrender', sample);
      observation.stop = () => game.events.off('postrender', sample);
      if (fault) {
        const chamber = base.chamber, destroy = chamber.destroy.bind(chamber);
        chamber.destroy = () => { chamber.destroy = destroy; destroy(); throw new Error('QA_ENTRY_CLEANUP_FAULT'); };
      }
    }, { fault: name === 'cleanup-fault' });
    await driver.press('Shift+Enter');
    if (name === 'repeated-input') {
      for (let n = 0; n < 3; n++) { await driver.press('Shift+Enter', 15); await driver.press('e', 15); }
    }
    await page.waitForFunction(fault => window.__game?.scene.isActive(fault ? 'MainMenuScene' : 'RiftScene'), name === 'cleanup-fault', { timeout: 20000 });
    await page.waitForTimeout(180);
    const observation = await page.evaluate(() => {
      const q = window.__entryTransitionQA; q.stop();
      const save = JSON.parse(localStorage.getItem('coh-save-v1'));
      return { frames: q.frames, images: q.images, firstRiftFrame: q.firstRiftFrame,
        remainingOverlays: document.querySelectorAll('#scene-transition-overlay,#scene-transition-glow').length,
        save: { cycle: save.cycle, runId: save.inventory?.run?.id, departure: save.riftDeparture, checkpoint: !!save.riftCheckpoint } };
    });
    await page.screenshot({ path: path.join(dir, 'settled.png') });
    for (const [key, data] of Object.entries(observation.images)) fs.writeFileSync(path.join(dir, `${key}.png`), Buffer.from(data.split(',')[1], 'base64'));
    const { images, ...metrics } = observation;
    result.metrics = metrics;
    result.uncoveredFrames = observation.frames.filter(frame => frame.uncoveredCleanedBase);
    result.frames = observation.frames.length;
    assert(observation.frames.some(frame => frame.opaqueCover), 'opaque transition must actually render');
    if (expectFlash) assert(result.uncoveredFrames.length > 0, 'baseline must reproduce an uncovered cleaned base frame');
    else assert.equal(result.uncoveredFrames.length, 0, 'cleanup must never expose the old base before next scene renders');
    assert.equal(observation.remainingOverlays, 0, 'handoff must not leak either overlay');
    if (!expectFlash) {
      assert(observation.images['handoff-dark-frame'], 'observe the actual queued handoff frame');
      const pixels = await sharp(Buffer.from(observation.images['handoff-dark-frame'].split(',')[1], 'base64')).removeAlpha().raw().toBuffer();
      const first = [...pixels.subarray(0, 3)];
      let differingPixels = 0;
      for (let i = 0; i < pixels.length; i += 3) if (pixels[i] !== first[0] || pixels[i + 1] !== first[1] || pixels[i + 2] !== first[2]) differingPixels++;
      result.handoffPixels = { rgb: first, differingPixels, totalPixels: pixels.length / 3 };
      assert.equal(differingPixels, 0, 'the queued handoff must show only renderer background');
    }
    assert.equal(observation.save.cycle, 1, 'repeated input must not start another cycle');
    assert(observation.save.runId, 'committed run remains');
    if (name === 'cleanup-fault') {
      assert(observation.save.departure, 'failed handoff retains saved departure');
      assert(errors.length > 0 && errors.every(error => error.includes('QA_ENTRY_CLEANUP_FAULT')), `unexpected errors: ${JSON.stringify(errors)}`);
    } else {
      assert(observation.firstRiftFrame !== null, 'target scene rendered');
      assert.deepEqual(errors, []);
    }
    if (!expectFlash && name === 'normal') {
      // Isolated lifecycle regression only, not a claim of full extraction play.
      // Reuse the same scene instance hidden on departure and ask Phaser to start it.
      await page.evaluate(() => window.__game.scene.getScene('RiftScene').scene.start('PurificationScene', { fromMenu: true }));
      await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene'));
      await page.waitForTimeout(300);
      result.restart = await page.evaluate(() => {
        const base = window.__game.scene.getScene('PurificationScene'), sprite = base.player.getSprite();
        return { method: 'Explicit isolated Phaser scene restart after production departure; no simulated extraction outcome.',
          limitation: 'Only visibility and player reconstruction are gated. Active journey is not settled by this injection; save-retry notice is expected. This is not return settlement or HUD usability evidence.',
          active: base.scene.isActive(), visible: base.sys.settings.visible, cleanupComplete: base.cleanupComplete,
          playerActive: sprite.active, playerVisible: sprite.visible,
          overlays: document.querySelectorAll('#scene-transition-overlay,#scene-transition-glow').length,
          hudDomPresent: !!document.querySelector('#purif-hud') };
      });
      assert(result.restart.active && result.restart.visible && !result.restart.cleanupComplete && result.restart.playerActive && result.restart.playerVisible, 'Phaser restart restores base visibility and player');
      assert.equal(result.restart.overlays, 0);
      await page.screenshot({ path: path.join(dir, 'restarted-base.png') });
      assert.deepEqual(errors, []);
    }
    result.status = 'passed'; console.log(name, JSON.stringify({ frames: result.frames, uncovered: result.uncoveredFrames.length, firstRiftFrame: observation.firstRiftFrame, overlays: observation.remainingOverlays }));
  } catch (error) {
    result.status = 'failed'; result.failure = String(error);
    await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {});
    throw error;
  } finally { persist(); await context.close(); }
}
try {
  for (const name of expectFlash ? ['before'] : ['normal', 'repeated-input', 'cleanup-fault']) await runCase(name);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = String(error); console.error(error); process.exitCode = 1; }
finally { report.finished = new Date().toISOString(); persist(); await browser.close(); }
