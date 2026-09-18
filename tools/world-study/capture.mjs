/** Real browser captures and input checks for the standalone world generator. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:3011';
const out = path.resolve(process.env.ARTIFACT_DIR ?? 'docs/qa/artifacts/rift-world-study');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1600, height: 1040 }, deviceScaleFactor: 1 });
const report = { scope: 'Actual seeded generator, browser screenshots and keyboard/collision checks; no aesthetic approval inferred.', errors: [], captures: [], input: [] };
page.on('pageerror', error => report.errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });

async function ready() {
  await page.waitForFunction(() => window.__worldStudy?.getState().ready || window.__worldStudy?.getState().error, null, { timeout: 30000 });
  const state = await page.evaluate(() => window.__worldStudy.getState());
  if (state.error) throw new Error(state.error);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  return state;
}
async function capture(name) {
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  if (name.endsWith('-loops') || name.endsWith('-walk')) {
    await page.locator('#world').screenshot({ path: path.join(out, `${name}-map.png`) });
  }
  const state = await page.evaluate(() => window.__worldStudy.getState());
  report.captures.push({ name, state });
  console.log(name, JSON.stringify(state));
}
try {
  await page.goto(`${base}/rift-worlds.html`);
  await ready();
  const worlds = await page.locator('[data-world]').evaluateAll(buttons => buttons.map(button => button.dataset.world));
  for (const world of worlds) {
    for (const topology of ['loops', 'channels']) {
      await page.goto(`${base}/rift-worlds.html?world=${world}&topology=${topology}&seed=70421&view=overview`);
      await ready();
      await capture(`${world}-${topology}`);
      if (topology === 'loops') {
        await page.locator('#walk').click();
        await capture(`${world}-walk`);
        const walking = await page.evaluate(() => window.__worldStudy.getState());
        if (!walking.field) throw new Error('Walking preview did not preserve core visibility');
        if (walking.zoom !== 1.5) throw new Error('Walking preview must use the Rift base camera scale');
        await page.locator('#field').click();
        await capture(`${world}-surface`);
        await page.locator('#field').click();
        await page.locator('canvas').focus();
        const before = await page.evaluate(() => window.__worldStudy.getState());
        const positions = [];
        for (const key of ['w', 'd', 's', 'a']) {
          await page.keyboard.down(key);
          for (let step = 0; step < 4; step++) {
            await page.waitForTimeout(100);
            positions.push(await page.evaluate(() => {
              const state = window.__worldStudy.getState();
              return { ...state.player, canStand: window.__worldStudy.collisionAt(state.player.x, state.player.y) };
            }));
          }
          await page.keyboard.up(key);
        }
        const after = await page.evaluate(() => window.__worldStudy.getState());
        if (after.movedDistance <= before.movedDistance + 10) throw new Error(`${world}: keyboard input did not move player`);
        if (positions.some(position => !position.canStand)) throw new Error(`${world}: player entered blocked terrain`);
        report.input.push({ world, before, after, positions });
        await page.keyboard.down('d');
        const timings = await page.evaluate(() => new Promise(resolve => {
          const intervals = []; let last = 0;
          function tick(now) {
            if (last) intervals.push(now - last);
            last = now;
            if (intervals.length < 30) requestAnimationFrame(tick);
            else {
              intervals.sort((a, b) => a - b);
              resolve({ medianMs: intervals[15], p95Ms: intervals[28] });
            }
          }
          requestAnimationFrame(tick);
        }));
        await page.keyboard.up('d');
        report.input.push({ world, movingFrameTimes: timings });
      }
    }
  }
  await page.goto(`${base}/rift-worlds.html?world=crystal-fibre&topology=loops&seed=70421&view=walk`);
  await ready();
  await page.locator('canvas').focus();
  await page.keyboard.down('a');
  await page.waitForTimeout(3000);
  const boundaryBefore = await page.evaluate(() => window.__worldStudy.getState());
  await page.waitForTimeout(500);
  const boundaryAfter = await page.evaluate(() => {
    const state = window.__worldStudy.getState();
    return { ...state, canStand: window.__worldStudy.collisionAt(state.player.x, state.player.y) };
  });
  await page.keyboard.up('a');
  if (!boundaryAfter.canStand || Math.hypot(boundaryAfter.player.x - boundaryBefore.player.x,
    boundaryAfter.player.y - boundaryBefore.player.y) > .1) throw new Error('Boundary collision did not stop movement');
  report.input.push({ boundaryStop: { before: boundaryBefore, after: boundaryAfter } });
  await page.goto(`${base}/rift-worlds.html?world=crystal-fibre&topology=loops&seed=70421&view=walk`);
  await ready();
  if (!(await page.evaluate(() => window.__worldStudy.getState().field))) throw new Error('Direct walking URL must enable visibility');
  await capture('crystal-fibre-field');
  await page.locator('canvas').focus();
  await page.keyboard.down('w');
  await page.waitForTimeout(200);
  const normalVelocity = await page.evaluate(() => window.__worldStudy.getState().velocity);
  await page.keyboard.down('Shift');
  await page.waitForTimeout(200);
  const shiftedVelocity = await page.evaluate(() => window.__worldStudy.getState().velocity);
  await page.keyboard.up('w');
  await page.keyboard.up('Shift');
  await page.waitForTimeout(200);
  const stoppedVelocity = await page.evaluate(() => window.__worldStudy.getState().velocity);
  for (const velocity of [normalVelocity, shiftedVelocity]) {
    if (Math.abs(Math.hypot(velocity.x, velocity.y) - 80) > .001) throw new Error('Actual browser movement must stay at 80px/s with or without Shift');
  }
  if (Math.hypot(stoppedVelocity.x, stoppedVelocity.y) > .001) throw new Error('Player did not settle after key release');
  report.input.push({ baseMovement: { normalVelocity, shiftedVelocity, stoppedVelocity } });
  await page.locator('#regenerate').click();
  await ready();
  const newSeed = await page.evaluate(() => window.__worldStudy.getState().seed);
  if (newSeed === 70421) throw new Error('Reroll kept original seed');
  await capture('crystal-fibre-new-seed');
  const box = await page.locator('canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const zoomBefore = await page.evaluate(() => window.__worldStudy.getState().zoom);
  await page.mouse.wheel(0, -250);
  await page.waitForTimeout(100);
  const zoomAfter = await page.evaluate(() => window.__worldStudy.getState().zoom);
  if (zoomAfter <= zoomBefore) throw new Error('Wheel did not zoom');
  // Exercise CSV-driven controls and ensure a material swap preserves the map.
  const spaceOptions = await page.locator('#topology option').evaluateAll(options => options.map(option => option.value));
  if (spaceOptions.length < 2) throw new Error('Missing generated space controls');
  for (const space of spaceOptions) {
    await page.locator('#topology').selectOption(space);
    await ready();
    const before = await page.evaluate(() => ({ state: window.__worldStudy.getState(), grid: window.__worldStudy.getGrid() }));
    if (before.state.space !== space || !await page.evaluate(() => new URLSearchParams(location.search).get('space'))) throw new Error('Space selection did not update state/URL');
    for (const world of await page.locator('[data-world]').evaluateAll(buttons => buttons.map(button => button.dataset.world))) {
      await page.locator(`[data-world="${world}"]`).click();
      await ready();
      const after = await page.evaluate(() => ({ state: window.__worldStudy.getState(), grid: window.__worldStudy.getGrid() }));
      if (JSON.stringify(after.grid) !== JSON.stringify(before.grid) || JSON.stringify(after.state.player) !== JSON.stringify(before.state.player)) throw new Error('Changing material recipe changed space/player location');
    }
    report.input.push({ spaceControl: space, materialSwapPreservesGeometry: true });
  }
  if (report.errors.length) throw new Error(`Browser errors: ${report.errors.join('; ')}`);
} catch (error) {
  report.failure = String(error);
  console.error(error);
  process.exitCode = 1;
} finally {
  await writeFile(path.join(out, 'browser-check.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
