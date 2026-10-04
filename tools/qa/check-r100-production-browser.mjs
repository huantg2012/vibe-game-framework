/** Integration probe. Real menu/grade/departure/reload input, isolated storage.
 * Opens preparation via the scene method to isolate it from haven navigation.
 * This is integration evidence, not a complete or novice expedition playtest. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03/production');
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { method: 'Isolated new records; real menu/grade/depart/reload input. Preparation opened through its normal scene method. No loot, seed, outcome or clock overrides.', cases: [], status: 'running' };
const grades = (process.env.QA_GRADES ?? 'low,medium,severe').split(',');
const requestedWorlds = (process.env.QA_WORLDS ?? '').split(',').filter(Boolean);
const worlds = requestedWorlds.length ? requestedWorlds : [null];
if (requestedWorlds.length) report.method = 'Controlled coverage: one departure seed per world is selected before any play; the enabled formal pool still selects the world. Real grade/departure/reload controls; preparation opened by its scene method. Fresh ordinary inventory. No outcome, map, health, loot, position or clock overrides. Not a natural expedition/economy sample.';
const responses = new Map(), pendingResponses = [];
report.sourceHashMethod = 'Fetch the exact served module/asset URLs independently of worker lifetime. Run only against an immutable source snapshot. Hashes verify served content, not browser cache transfer.';
try {
  coverage: for (const world of worlds) for (const grade of grades) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__r100LongTasks = [];
      new PerformanceObserver(list => {
        for (const row of list.getEntries()) window.__r100LongTasks.push({ start: row.startTime, duration: row.duration });
      }).observe({ entryTypes: ['longtask'] });
    });
    const id = world ? `${world}-${grade}` : grade;
    const result = { world, grade, errors: [], status: 'running' }; report.cases.push(result);
    page.on('pageerror', error => result.errors.push(String(error)));
    const recordResponse = response => {
      const url = new URL(response.url());
      if (!response.ok() || !/^\/(src\/|assets\/r100-materials\/)/.test(url.pathname)) return;
      // A material worker intentionally terminates after prewarming. Its CDP
      // response body can disappear before Playwright reads it, although the
      // game loaded it successfully. Audit the same frozen URL independently.
      pendingResponses.push(fetch(response.url()).then(async source => {
        if (!source.ok) throw new Error(`Source audit HTTP ${source.status}: ${response.url()}`);
        const body = Buffer.from(await source.arrayBuffer());
        const hash = createHash('sha256').update(body).digest('hex');
        const before = responses.get(url.pathname);
        if (before && before !== hash) throw new Error(`Source changed during coverage: ${url.pathname}`);
        responses.set(url.pathname, hash);
      }).catch(error => { result.errors.push(String(error)); }));
    };
    page.on('response', recordResponse);
    try {
      await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3043/');
      await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
      await page.waitForTimeout(350); await page.keyboard.press('Enter', { delay: 100 });
      await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
      await page.waitForTimeout(2200);
      await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
      const choice = page.locator(`[data-departure-grade="${grade}"]`);
      await choice.waitFor(); await choice.click();
      assert.equal(await choice.getAttribute('aria-pressed'), 'true');
      if (world) {
        result.controlledSeed = await page.evaluate(async ({ world, grade }) => {
          const { selectR100ProductionRecipe } = await import('/src/generation/world-study/r100-package.ts');
          let seed = 0;
          while (seed < 20000 && selectR100ProductionRecipe(seed, grade).package.id !== `r100-${world}`) seed++;
          if (seed === 20000) throw new Error(`World is not in the enabled pool: ${world}`);
          const original = crypto.getRandomValues;
          crypto.getRandomValues = function(values) {
            if (values instanceof Uint32Array && values.length === 1) {
              crypto.getRandomValues = original; values[0] = seed; return values;
            }
            return original.call(this, values);
          };
          return seed;
        }, { world, grade });
      }
      await page.screenshot({ path: path.join(out, `${id}-prepare.png`) });
      const timing = Date.now();
      const entryStart = await page.evaluate(() => performance.now());
      const profiler = process.env.QA_CPU_PROFILE === '1' ? await context.newCDPSession(page) : null;
      if (profiler) { await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
      await page.keyboard.press('Shift+Enter', { delay: 100 });
      await page.waitForFunction(() => {
        const s = window.__game?.scene.getScene('RiftScene');
        return s?.scene.isActive() && s.player && s.nativeWorldPresentation && s.devRuntime;
      }, null, { timeout: 30000 });
      result.departureMs = Date.now() - timing;
      await page.waitForTimeout(800);
      result.entryLongTasks = await page.evaluate(start => window.__r100LongTasks.filter(row => row.start >= start), entryStart);
      if (profiler) {
        const profile = await profiler.send('Profiler.stop');
        fs.writeFileSync(path.join(out, `${id}-entry.cpuprofile`), JSON.stringify(profile.profile));
        await profiler.detach();
      }
      await page.screenshot({ path: path.join(out, `${id}-entry.png`) });
      result.runtime = await page.evaluate(() => {
        const s = window.__game.scene.getScene('RiftScene');
        return { grade: s.chaos.exportRuntimeState(), world: s.nativeWorldPresentation.world.definition,
          bodyGrid: s.formFloorGrid.tileSize, enemies: s.ai.getEnemies().length,
          nodes: s.search.nodes.map(n => ({ kind: n.kind, tier: n.tier, value: n.value })),
          elapsed: s.devElapsedMs };
      });
      assert.equal(result.runtime.world.grade, grade);
      assert.equal(result.runtime.bodyGrid, 8);
      await page.keyboard.press('Escape', { delay: 100 }); await page.waitForTimeout(150);
      const before = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
      result.identity = before.riftCheckpoint?.identity ?? before.riftDeparture?.identity;
      assert.equal(result.identity.generation.version, 3);
      assert.equal(result.identity.generation.package.grade, grade);
      if (world) {
        assert.equal(result.identity.generation.package.id, `r100-${world}`);
        assert.equal(result.identity.generation.requestedSeed, result.controlledSeed);
      }
      assert(before.riftCheckpoint?.state?.world.nativePresentation, 'formal renderer persists its own clock');
      result.savedWorldState = before.riftCheckpoint.state.world;
      if (process.env.QA_REQUIRE_BODY_VERSION === '1') {
        assert.equal(before.riftCheckpoint.state.world.bodyGeometryVersion, 1);
        const player = before.riftCheckpoint.state.player;
        assert(Math.abs(player.bodyPosition.x + 10 - player.position.x) < 1e-6);
        assert(Math.abs(player.bodyPosition.y + 10 - player.position.y) < 1e-6);
      }
      await page.reload();
      await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
      await page.waitForTimeout(350);
      const restoreStart = await page.evaluate(() => performance.now());
      await page.keyboard.press('Enter', { delay: 100 });
      await page.waitForFunction(() => {
        const s = window.__game?.scene.getScene('RiftScene');
        return s?.scene.isActive() && s.nativeWorldPresentation && s.devRuntime;
      }, null, { timeout: 30000 });
      await page.keyboard.press('Escape', { delay: 100 }); await page.waitForTimeout(150);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
      result.coldReloadLongTasks = await page.evaluate(() => window.__r100LongTasks);
      result.restoreLongTasks = result.coldReloadLongTasks.filter(row => row.start >= restoreStart);
      assert.deepEqual(after.riftCheckpoint?.identity ?? after.riftDeparture?.identity, result.identity);
      assert.deepEqual(after.riftCheckpoint.state.player.position, before.riftCheckpoint.state.player.position);
      if (process.env.QA_REQUIRE_BODY_VERSION === '1') {
        assert.equal(after.riftCheckpoint.state.world.bodyGeometryVersion, 1);
        assert.deepEqual(after.riftCheckpoint.state.player.bodyPosition, before.riftCheckpoint.state.player.bodyPosition);
        assert(after.riftCheckpoint.elapsedMs >= before.riftCheckpoint.elapsedMs);
        result.bodyGeometry = { version: 1, fullBodyCheckpointAdmitted: true, coldBodyPositionPreserved: true };
      }
      result.coldIdentityPreserved = true;
      assert.deepEqual(result.errors, []);
      result.status = 'passed';
      await page.screenshot({ path: path.join(out, `${id}-restored.png`) });
      console.log(`${id}: entry and reload passed (${result.departureMs} ms including scene transition)`);
    } catch (error) {
      result.status = 'failed'; result.failure = String(error);
      await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {});
      result.diagnostic = await page.evaluate(() => ({ text: document.body.innerText, saved: localStorage.getItem('coh-save-v1'), active: window.__game?.scene.getScenes(true).map(s => s.sys.settings.key) })).catch(() => null);
      console.error(id, error); process.exitCode = 1;
    } finally {
      page.off('response', recordResponse);
      await Promise.all(pendingResponses);
      if (result.errors.length) { result.status = 'failed'; result.failure ??= 'Source/browser errors'; }
      fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
      await context.close();
    }
    if (result.status === 'failed' && process.env.QA_STOP_ON_FAILURE === '1') break coverage;
  }
  report.status = report.cases.every(c => c.status === 'passed') ? 'passed' : 'failed';
} finally {
  await Promise.all(pendingResponses);
  report.loadedSourceHashes = Object.fromEntries([...responses.entries()].sort());
  if (report.cases.some(result => result.errors.length)) { report.status = 'failed'; process.exitCode = 1; }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
