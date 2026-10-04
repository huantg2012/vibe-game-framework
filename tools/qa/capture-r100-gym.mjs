/** Native v3 training scene captures; no formal economy or human approval claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i04/native-preview');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), report = { scope: 'Production v3 generator and renderer; isolated memory training loadout. Fixed normal camera, real timed keyboard, no god mode. These brief captures do not certify whole expeditions.', cases: [], errors: [] };
page.on('pageerror', e => report.errors.push(String(e)));
const worlds = (process.env.QA_WORLDS ?? 'cinder-ridge,pallid-membrane,silt-gel').split(',');
const grades = (process.env.QA_GRADES ?? 'medium').split(',');
try {
  for (const world of worlds) for (const grade of grades) {
    const id = `${world}-${grade}`;
    await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3043'}/r100-gym.html?world=${world}&grade=${grade}&seed=${process.env.QA_SEED ?? '20261004'}`);
    await page.waitForFunction(() => window.__r100Gym?.getState().runtime.running, null, { timeout: 60000 });
    const state = await page.evaluate(() => window.__r100Gym.getState());
    assert.equal(state.recipe.package.id, `r100-${world}`);
    assert.equal(state.runtime.probe.pollutionGrade, grade);
    await page.waitForTimeout(600);
    await page.locator('#game-container canvas').screenshot({ path: path.join(out, `${id}-entry.png`) });
    await page.locator('#game-container').focus();
    await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
    await page.keyboard.down('d'); await page.waitForTimeout(1500); await page.keyboard.up('d');
    await page.locator('#game-container canvas').screenshot({ path: path.join(out, `${id}-walk.png`) });
    const after = await page.evaluate(() => window.__r100Gym.getState());
    assert(!after.runtime.starting && after.runtime.running);
    assert(!after.runtime.paused, 'short walking segment must stay active');
    assert(after.runtime.probe.elapsedMs - state.runtime.probe.elapsedMs >= 2500,
      'running flag alone does not prove the simulation advanced during keyboard travel');
    assert(Math.hypot(after.runtime.probe.player.x - state.runtime.probe.player.x,
      after.runtime.probe.player.y - state.runtime.probe.player.y) >= 40,
    'normal-view movement evidence requires actual displacement, not two stationary frames');
    await page.locator('#pause').click();
    const held = await page.evaluate(() => window.__r100Gym.getState().runtime.probe);
    await page.waitForTimeout(250);
    const still = await page.evaluate(() => window.__r100Gym.getState().runtime.probe);
    assert.equal(held.elapsedMs, still.elapsedMs); assert.equal(held.chaos, still.chaos);
    report.cases.push({ id, before: state, after, pauseHeld: true });
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`${id}: actual normal scene, movement and pause captured`);
  }
  assert.deepEqual(report.errors, []); report.status = 'captured';
} catch (error) { report.status = 'failed'; report.failure = String(error); await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {}); console.error(error); process.exitCode = 1; }
finally { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
