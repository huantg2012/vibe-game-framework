/** Isolated real keyboard routes plus explicitly labelled in-memory HP fixtures.
 * Never attaches to a user's browser or reads a user's save. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createChamberDriver } from './i30-chamber-driver.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = process.env.I30_OUT ?? 'docs/qa/artifacts/iteration-30-r8/integrity-runtime';
fs.mkdirSync(out, { recursive: true });
const manifest = { at: new Date().toISOString(), method: 'Fresh isolated browser context, real WASD/E/Esc; HP matrix changes only in-memory public module records, without broadcasting world visual refresh. Its screenshots are UI-only and do not verify device activity or light at that HP. No human aesthetic verdict.', checks: [], errors: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
page.on('pageerror', error => manifest.errors.push(String(error)));
await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
const journey = createJourneyDriver(page, out), chamber = createChamberDriver(page, journey);

async function sample() { return page.evaluate(() => window.__r8IntegritySample()); }
async function beginFrames() { await page.evaluate(() => { window.__r8IntegrityFrames = []; }); }
async function endFrames(label) {
  const frames = await page.evaluate(() => window.__r8IntegrityFrames);
  assert(frames.length > 2, `${label} has actual rendered frames`);
  for (const frame of frames) {
    assert(frame.world.length + (frame.dom?.opacity > .001 ? 1 : 0) <= 1, `${label}: multiple primary readings ${JSON.stringify(frame)}`);
    for (const world of frame.world) assert(!world.overlap, `${label}: world covers full actor rig`);
    if (frame.dom?.opacity > .001) {
      assert(!frame.dom.overlap, `${label}: DOM covers actor or reserved device/control area ${JSON.stringify(frame)}`);
      assert(frame.dom.inViewport, `${label}: DOM left safe viewport`);
    }
  }
  manifest.checks.push({ label, frameCount: frames.length, passed: true });
}

try {
  await page.goto(process.env.I30_URL ?? 'http://127.0.0.1:3025/');
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), null);
  await journey.press('Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    window.__r8IntegrityFrames = [];
    const scene = window.__game.scene.getScene('PurificationScene');
    const overlap = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;
    window.__r8IntegritySample = () => {
      const actor = scene.player.getVisualBounds(scene.interactionPlayerBounds);
      const world = [scene.coreModule, scene.storageModule, scene.purifierModule]
        .filter(mod => mod.readout.commandBuffer.length && mod.readout.alpha > .001)
        .map(mod => ({ id: mod.id, alpha: mod.readout.alpha, hp: mod.getHpData(),
          overlap: overlap(mod.integrity.sides.world.placement.rect, actor, 4.4),
          dangerPaint: mod.readout.commandBuffer.includes(0xbd685e), commands: mod.readout.commandBuffer.length }));
      const element = document.querySelector('.core-integrity');
      let dom = null;
      if (element && scene.interactionModule) {
        const geometry = scene.getIntegrityScreenGeometry(scene.interactionModule.id);
        const rect = { left: element.offsetLeft, top: element.offsetTop, right: element.offsetLeft + element.offsetWidth, bottom: element.offsetTop + element.offsetHeight };
        const controls = [...document.querySelectorAll('.core-work,.core-identity')].filter(node => getComputedStyle(node).visibility !== 'hidden').map(node => ({ left: node.offsetLeft, top: node.offsetTop, right: node.offsetLeft + node.offsetWidth, bottom: node.offsetTop + node.offsetHeight }));
        const style = getComputedStyle(element), fill = element.querySelector('.pbar-fill');
        dom = { opacity: style.visibility === 'hidden' ? 0 : Number(style.opacity), rect,
          overlap: [geometry.player, ...(geometry.reserved ?? []), ...controls].some(other => overlap(rect, other, 7.3)),
          inViewport: rect.left >= 15.5 && rect.right <= 944.5 && rect.top >= 15.5 && rect.bottom <= 624.5,
          condition: element.dataset.condition, text: element.innerText, color: getComputedStyle(fill).backgroundColor,
          fill: parseFloat(fill.style.width), cap: getComputedStyle(element.querySelector('.pbar-wrap'), '::after').content };
      }
      return { time: scene.time.now, world, dom, focused: scene.interactionModule?.id ?? null };
    };
    window.__game.events.on('postrender', () => {
      if (window.__r8IntegrityFrames.length < 500) window.__r8IntegrityFrames.push(window.__r8IntegritySample());
    });
  });
  await chamber.via([[285, 322], [253, 318]]);
  await page.waitForTimeout(500);
  const front = await sample();
  assert.equal(front.world[0]?.id, 'CORE', 'Old failing core-front spot now has an observation gauge');
  assert.equal(await page.evaluate(() => window.__game.scene.getScene('PurificationScene').coreModule.isInRange()), false, 'Observation does not grant remote E');
  await journey.snap('01-front-observation-without-e');
  manifest.checks.push({ label: 'front-observation-without-e', ...front });

  await chamber.walkFeet(284, 313);
  await page.waitForTimeout(400);
  for (let repeat = 0; repeat < 3; repeat++) {
    await beginFrames();
    await journey.press('e', 60);
    await page.waitForTimeout(450);
    const focused = await sample();
    assert(focused.dom?.opacity > .99 && focused.dom.condition === 'damaged');
    await journey.press('Escape', 10);
    await journey.press('Escape', 10);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#allocation-panel').count(), 0);
    await endFrames(`core-open-close-repeat-${repeat + 1}`);
  }
  // Public module records are altered only within this isolated test context.
  for (const [hp, maxHp, condition, color] of [[0, 100, 'failed', 'rgb(189, 104, 94)'], [24, 100, 'danger', 'rgb(189, 104, 94)'],
    [25, 100, 'damaged', 'rgb(191, 150, 91)'], [70, 115, 'damaged', 'rgb(191, 150, 91)'],
    [100, 100, 'stable', 'rgb(158, 170, 168)'], [100, 115, 'stable', 'rgb(158, 170, 168)'], [115, 115, 'stable', 'rgb(158, 170, 168)']]) {
    await page.evaluate(async ({ hp, maxHp }) => {
      const { gameState } = await import('/src/managers/game-state.ts');
      Object.assign(gameState.getModule('CORE'), { hp, maxHp });
    }, { hp, maxHp });
    await page.waitForTimeout(220);
    const world = await sample();
    assert.equal(world.world[0]?.hp.hp, hp);
    if (hp === 0) { assert(world.world[0].dangerPaint, 'Zero HP world gauge still contains danger-color cap'); await journey.snap('02-zero-world-cap'); }
    await journey.press('e', 60); await page.waitForTimeout(460);
    const focused = await sample();
    assert.equal(focused.dom.condition, condition); assert.equal(focused.dom.color, color);
    assert(Math.abs(focused.dom.fill - hp / maxHp * 100) < .001, 'Exact capacity fill is separate from condition');
    if (hp === 0) assert.equal(focused.dom.cap, '""', 'Failed DOM bar retains a pseudo-element cap');
    if (hp === 0 || hp === 25 || hp === 100 && maxHp === 115) await journey.snap(`03-hp-${hp}-of-${maxHp}`);
    manifest.checks.push({ label: 'explicit-hp-fixture', scope: 'UI-only; device/light state not refreshed', hp, maxHp, ...focused });
    await journey.press('Escape', 10); await page.waitForTimeout(400);
  }
  await chamber.via([[285, 322], [180, 322], [162, 304]]);
  await page.waitForTimeout(450); await beginFrames();
  await journey.press('e', 60); await page.waitForTimeout(450);
  assert.equal((await sample()).focused, 'STORAGE');
  await journey.press('Escape', 10); await page.waitForTimeout(400); await endFrames('storage-open-close');
  await chamber.via([[180, 322], [350, 315], [413, 307], [458, 301]]);
  await page.waitForTimeout(450); await beginFrames();
  await journey.press('e', 60); await page.waitForTimeout(450);
  assert.equal((await sample()).focused, 'PURIFIER');
  await journey.press('Escape', 10); await page.waitForTimeout(400); await endFrames('purifier-open-close');
  assert.equal(manifest.errors.length, 0);
  manifest.result = 'PASS';
} catch (error) {
  manifest.result = 'FAIL'; manifest.failure = String(error);
  await page.screenshot({ path: path.join(out, 'failure.png') });
  throw error;
} finally {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await browser.close();
}
console.log(`I30 R8 integrity runtime PASS: ${manifest.checks.length} recorded cases.`);
