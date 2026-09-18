/** Read-only frame timing; keep other browser/CPU work idle during this probe. */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1040 }, deviceScaleFactor: 1 });
const results = [], errors = [], failures = [];
page.on('pageerror', error => errors.push(error.stack ?? error.message));
async function measure(mode) {
  const sampling = page.evaluate(() => new Promise(resolve => {
    const gaps = []; let previous = 0, start = 0;
    const tick = time => {
      if (!start) start = time;
      if (previous) gaps.push(time - previous);
      previous = time;
      if (time - start >= 3000) resolve({ gaps, durationMs: time - start }); else requestAnimationFrame(tick);
    }; requestAnimationFrame(tick);
  }));
  if (mode === 'moving') {
    for (const key of ['KeyD', 'KeyA', 'KeyS', 'KeyW']) {
      await page.keyboard.down(key); await page.waitForTimeout(550); await page.keyboard.up(key); await page.waitForTimeout(150);
    }
  }
  const result = await sampling, sorted = [...result.gaps].sort((a, b) => a - b);
  const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  return { mode, fps: result.gaps.length / result.durationMs * 1000, p50Ms: percentile(.5), p95Ms: percentile(.95),
    p99Ms: percentile(.99), maxMs: sorted.at(-1), framesOver33ms: sorted.filter(gap => gap > 33.4).length, frames: sorted.length };
}
try {
  for (const world of ['ash-strata', 'crystal-fibre', 'ivory-basin', 'carmine-lacquer', 'cobalt-gold']) {
    for (const space of ['open-scars', 'fracture-fields']) {
      const started = Date.now();
      await page.goto(`http://127.0.0.1:3012/rift-world-play.html?world=${world}&space=${space}&seed=70421`);
      await page.waitForFunction(() => window.__worldPlay?.getState().sceneCreated || window.__worldPlay?.getState().error);
      const readyMs = Date.now() - started;
      assert.equal(await page.evaluate(() => window.__worldPlay.getState().error), '');
      await page.waitForTimeout(900);
      const stationary = await measure('stationary'), moving = await measure('moving');
      const state = await page.evaluate(() => window.__worldPlay.getState());
      results.push({ world, space, readyMs, stationary, moving, surface: state.surface, metadata: state.metadata });
      console.log(JSON.stringify({ world, space, stationary: stationary.fps, moving: moving.fps }));
    }
  }
  // Original entry has no fixture. Confirm its default sight/noise contract and movement.
  await page.goto('http://127.0.0.1:3012/#rift=70421');
  await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene'));
  await page.waitForTimeout(700);
  const before = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('RiftScene');
    return { fixture: scene.devFixture, vision: { ...scene.visibility.config }, tileSize: scene.formFloorGrid.tileSize, position: { ...scene.player.getPosition() } };
  });
  assert.equal(before.fixture, null); assert.equal(before.vision.voidNoiseEnabled, true); assert.equal(before.vision.voidColor, 0x080a0c);
  assert.equal(before.tileSize, 32);
  await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => ({ ...window.__game.scene.getScene('RiftScene').player.getPosition() }));
  assert(Math.hypot(after.x - before.position.x, after.y - before.position.y) > 5);
  // Rendering-only assertion, explicitly not a settlement or gameplay result.
  const defaultLabel = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('RiftScene');
    scene.onRiftExitedShowResult({ survived: true, kindlingGained: 0 });
    return document.querySelector('#rift-result-continue').textContent.trim();
  });
  assert.match(defaultLabel, /返回净化点/);
  results.push({ defaultFixture: { before, after, defaultLabel, labelCheck: 'presentation-only, no outcome asserted' } });
  assert.deepEqual(errors, []);
} catch (reason) { failures.push(reason.stack ?? String(reason)); }
finally {
  await writeFile('docs/qa/artifacts/iteration-26/play/performance.json', JSON.stringify({
    environment: 'Headless Chrome, 1600×1040 viewport, DPR1, native960×640 logic, one page, no video or screenshots during timing',
    measurement: '3s stationary + 3s normal key movement per world/space. rAF frame intervals; not a long-run or all-hardware certification.',
    results, errors, failures, endedAt: new Date().toISOString() }, null, 2)); await browser.close();
}
console.log(JSON.stringify({ cases: results.length, errors, failures }));
if (errors.length || failures.length) process.exitCode = 1;
