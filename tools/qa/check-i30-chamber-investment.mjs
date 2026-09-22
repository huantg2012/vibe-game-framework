/** Controlled save fixtures + genuine keyboard transactions; never touches user storage. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createChamberDriver } from './i30-chamber-driver.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const url = process.env.I30_URL ?? 'http://127.0.0.1:3025/';
const root = process.env.I30_INVESTMENT_OUT ?? 'docs/qa/artifacts/iteration-30-r2/investment';
const source = 'docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json';
const original = JSON.parse(JSON.parse(fs.readFileSync(source, 'utf8'))['coh-save-v1']);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const manifest = { at: new Date().toISOString(), version: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  method: 'Separate isolated contexts seeded before boot. Controlled snapshots are not naturally earned progression. All movement, repair and upgrade transactions use real keyboard input; no teleport, live grants or state setters.', cases: [] };
fs.mkdirSync(root, { recursive: true });

function fixture(name) {
  const save = structuredClone(original);
  save.kindlingReserve = 100;
  save.moduleMaxHpTier = 0;
  save.modules.forEach(mod => { mod.hp = 70; mod.maxHp = 100; });
  save.growth = { schemaVersion: 2,
    upgrades: { growth_chaos_resist: 0, growth_kindling_affinity: 0, growth_vitality: 0,
      growth_sortie_slot: 0, growth_defense_slot: 0, growth_forecast_clarity: 0 },
    progression: { version: 1, impactExperienced: false, offeringCompleted: false, toolRevealed: false, crestExperienced: false } };
  delete save.impactForecast;
  delete save.checkpointChecksum;
  if (name === 'damaged') save.modules.forEach((mod, index) => { mod.hp = [8, 24, 0][index]; });
  if (name === 'capped') {
    save.moduleMaxHpTier = 3;
    save.modules.forEach(mod => { mod.hp = 145; mod.maxHp = 145; });
    save.growth.upgrades = { growth_chaos_resist: 5, growth_kindling_affinity: 3, growth_vitality: 4,
      growth_sortie_slot: 1, growth_defense_slot: 3, growth_forecast_clarity: 3 };
    save.growth.progression = { version: 1, impactExperienced: true, offeringCompleted: true, toolRevealed: true, crestExperienced: true };
  }
  return save;
}

try {
  for (const name of (process.env.I30_INVESTMENT_CASES ?? 'purchase,damaged,capped').split(',')) {
    const out = path.join(root, name); fs.mkdirSync(out, { recursive: true });
    const save = fixture(name);
    fs.writeFileSync(path.join(out, 'fixture.json'), JSON.stringify(save, null, 2));
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.addInitScript(value => {
      if (!localStorage.getItem('coh-save-v1')) localStorage.setItem('coh-save-v1', JSON.stringify(value));
    }, save);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
    const d = createJourneyDriver(page, out);
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
    const pos = async () => (await d.state()).player;
    const chamber = createChamberDriver(page, d);
    async function exclusionCheck() {
      const result = await page.evaluate(() => {
        const scene = window.__game.scene.getScene('PurificationScene');
        const camera = scene.cameras.main, actor = scene.player.getSprite();
        const canvas = window.__game.canvas.getBoundingClientRect();
        const sx = canvas.width / 960, sy = canvas.height / 640;
        const ox = camera.width * camera.originX, oy = camera.height * camera.originY;
        const x = camera.x + ox + (actor.x - camera.scrollX - ox) * camera.zoom;
        const y = camera.y + oy + (actor.y - camera.scrollY - oy) * camera.zoom;
        const body = { left: canvas.left + (x - actor.displayWidth * actor.originX * camera.zoom) * sx,
          top: canvas.top + (y - actor.displayHeight * actor.originY * camera.zoom) * sy,
          right: canvas.left + (x + actor.displayWidth * (1 - actor.originX) * camera.zoom) * sx,
          bottom: canvas.top + (y + actor.displayHeight * (1 - actor.originY) * camera.zoom) * sy };
        const rect = document.querySelector('.core-integrity').getBoundingClientRect();
        const readout = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        return { body, readout, actorAlpha: actor.alpha,
          overlap: body.left < rect.right && body.right > rect.left && body.top < rect.bottom && body.bottom > rect.top };
      });
      assert.equal(result.actorAlpha, 1, 'Allocation focus preserves the actor rather than hiding overlap');
      assert.equal(result.overlap, false, 'Integrity readout must not cover the projected actor rectangle');
      d.log({ event: 'allocation-readout-actor-exclusion', ...result });
      fs.writeFileSync(path.join(out, 'readout-exclusion.json'), JSON.stringify(result, null, 2));
    }
    try {
      await page.goto(url);
      await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
      await d.press('Enter');
      await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
      await page.waitForTimeout(1800);
      await d.snap('01-main');
      if (name === 'purchase') {
        assert.equal((await stored()).kindlingReserve, 100);
        await chamber.walkFeet(284, 313); await d.press('e');
        await page.locator('#allocation-panel').waitFor({ state: 'visible' });
        await page.waitForTimeout(420);
        await exclusionCheck();
        await d.snap('02-repair-ready');
        const frozen = await pos();
        await d.press('ArrowRight');
        await d.press('Enter', 20);
        await d.snap('03-repair-pulse');
        const repaired = await stored();
        assert.equal(repaired.modules.find(mod => mod.id === 'CORE').hp, 74);
        assert.equal(repaired.kindlingReserve, 99);
        assert.deepEqual(await pos(), frozen, 'Repair transaction cannot move the actor');
        await page.locator('#allocation-panel').waitFor({ state: 'detached' });
        await page.waitForTimeout(350);
        await d.snap('04-after-repair');
      }

      await chamber.climbCenter();
      await chamber.via([[231, 203], [183, 202]]);
      await d.snap('05-upper');
      await d.press('e');
      await page.locator('#growth-panel').waitFor({ state: 'visible' });
      await page.waitForTimeout(380);
      if (name === 'purchase') {
        assert.equal(await page.locator('.upgrade-card[data-id="growth_vitality"]').count(), 1);
        await d.press('Enter', 20);
        await d.snap('06-growth-pulse');
        const grown = await stored();
        assert.equal(grown.growth.upgrades.growth_vitality, 1);
        assert.equal(grown.kindlingReserve, 91);
        assert.equal(grown.modules.find(mod => mod.id === 'CORE').hp, 74);
        assert((await page.locator('[data-growth-feedback]').innerText()).includes('已刻入'));
      } else await d.snap('06-growth-fixture');
      await d.press('Escape');
      await page.locator('#growth-panel').waitFor({ state: 'detached' });
      await page.waitForTimeout(350);
      await d.snap('07-after-growth');
      if (name === 'purchase') {
        const purchased = await stored();
        await page.reload();
        await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
        await d.press('Enter');
        await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
        await page.waitForTimeout(1400);
        const loaded = await stored();
        assert.deepEqual(loaded.growth, purchased.growth, 'Actual growth purchase survives reload');
        assert.deepEqual(loaded.modules, purchased.modules, 'Actual repair survives reload');
        assert.equal(loaded.kindlingReserve, 91);
        await d.snap('08-persisted');
      }
      await d.ledger('end');
      assert.deepEqual(errors, []);
      manifest.cases.push({ name, ok: true, errors,
        scope: name === 'purchase'
          ? 'Controlled 100-kindling, HP70, zero-growth fixture; real repair costs 1 (HP74/reserve99), first vitality upgrade costs 8 (level1/reserve91), survives reload; actor/readout exclusion.'
          : 'Controlled visual snapshot only: main, upper and growth panel; no claim of naturally reaching this progression.' });
    } catch (error) {
      manifest.cases.push({ name, ok: false, error: String(error), errors });
      await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
      throw error;
    } finally { await context.close(); }
  }
} finally {
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close();
}
console.log(JSON.stringify(manifest, null, 2));
