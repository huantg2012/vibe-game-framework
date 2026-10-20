/** Real root/departure/recovery, isolated storage. Explicit seed and P/A fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/light-eater-production-2026-10-20');
await fs.mkdir(output, { recursive: true });
const sourceFiles = ['src/scenes/rift-scene.ts', 'src/systems/visibility-system.ts', 'src/systems/vision-light-eater.ts', 'src/systems/rift-recovery-state.ts'];
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report = {
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(), sourcesBefore: await hashes(),
  scope: 'Normal title → haven → preparation → native Rift → Esc checkpoint → cold Continue. Separate Chrome contexts; seed selection and P/A setters are controlled QA fixtures. No visionArtStudy or godmode. Does not certify long expeditions, balance, performance budget, other browsers or human visual acceptance.',
  worlds: [], errors: [],
};
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
report.browser = await browser.version();
const persist = () => fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
async function bind(page) {
  await page.evaluate(async () => {
    async function loaded(file) {
      const url = performance.getEntriesByType('resource').filter(e => new URL(e.name).pathname === file).at(-1)?.name ?? file;
      return import(url);
    }
    const { gameState } = await loaded('/src/managers/game-state.ts');
    const { saveManager } = await loaded('/src/managers/save-manager.ts');
    window.__opticalQA = { gameState, saveManager, firstFrames: [] };
    window.__game.events.on('poststep', () => {
      const q = window.__opticalQA, s = window.__game.scene.getScene('RiftScene');
      if (q.firstFrames.length >= 3 || !s?.scene.isActive() || !s.chaos || !s.visibility ||
          s.stagedEntry?.isActive() || s.nativeEntryFence?.isActive() || s.entryView?.active) return;
      q.firstFrames.push({ presentation: s.visibility.getPresentation(), state: { ...s.visibility.lightEaterState } });
    });
  });
}
const waitRift = page => page.waitForFunction(() => {
  const s = window.__game?.scene.getScene('RiftScene');
  return s?.scene.isActive() && s.chaos && s.visibility && s.nativeWorldPresentation &&
    !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive() && !s.entryView?.active;
}, null, { timeout: 90000 });
async function snapshot(page) {
  return page.evaluate(() => {
    const s = window.__game.scene.getScene('RiftScene'), q = window.__opticalQA;
    const lamp = s.devRuntime?.worldMaterialLighting?.lights[0];
    return {
      world: s.recovery?.identity.generation?.package.id,
      production: s.productionLightEater, presentation: s.visibility.getPresentation(),
      artFixture: !!s.devFixture?.visionArtStudy, previewOverride: !!s.devFixture?.readVisionPreview,
      godMode: s.combat.godMode, chaos: s.chaos.exportRuntimeState(), assimilation: q.gameState.getAssimilation(),
      optics: { ...s.visibility.lightEaterState }, lampRadius: s.visibility.getLightEaterLampRadius(),
      lamp: lamp && { x: lamp.x, y: lamp.y, radius: lamp.radius, intensity: lamp.intensity },
      shoulder: s.lastLightPlayerPresentation?.getLampPosition(), position: s.player.getPosition(),
      visionMultiplier: s.defenseVisionScale, toolMultiplier: s.toolSystem.getVisionRadiusMultiplier(),
      hostMultiplier: s.hosts.getVolumeSightMult(),
      thresholdOverlayCount: document.querySelectorAll('.chaos-threshold-overlay').length,
      thresholdLevel: s.thresholdLevel, thresholdUntilMs: s.thresholdUntilMs, narrationMs: s.narrationMs,
      paused: s.scene.isPaused(), firstFrames: q.firstFrames,
      loadedChaos: s.recovery?.checkpoint?.state.chaos,
    };
  });
}
function checkOptics(s) {
  assert.equal(s.presentation, 'light-eater');
  assert(s.production && !s.artFixture && !s.previewOverride && !s.godMode);
  assert.equal(s.chaos.assimilationMode, 'persistent-v1');
  const p = s.optics.pollution / 100, a = s.optics.assimilation / 100;
  assert(Math.abs(s.optics.pollution - s.chaos.value) < .15, 'actual pollution drives the rendered field');
  assert(Math.abs(s.optics.assimilation - s.assimilation) < .03, 'persistent A drives the rendered field');
  assert(Math.abs(s.optics.warmRadius - 232 * (1 - .45 * p)) < 1e-6);
  assert(Math.abs(s.optics.perceptionRadius - 232 * (1 - .45 * p + .35 * a * p)) < 1e-6);
  assert(Math.abs(s.lampRadius - s.optics.warmRadius * s.optics.rangeScale) < 1e-6);
  assert(Math.abs(s.lamp.radius - s.lampRadius) < 1e-6);
  assert(Math.hypot(s.optics.lampX - s.shoulder.x, s.optics.lampY - s.shoulder.y) < .01);
}
async function picture(page, name) {
  const clip = await page.locator('#game-container canvas').boundingBox();
  await page.screenshot({ clip, path: path.join(output, `${name}.png`) });
  return `${name}.png`;
}
try {
  for (const world of (process.env.QA_WORLDS ?? 'crystal-fibre,cinder-ridge,ruptured-film').split(',')) {
    const row = { world, checks: [], images: {} }; report.worlds.push(row); await persist();
    const context = await browser.newContext({ viewport: { width: 1264, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push({ world, message: e.message }));
    try {
      console.log(`START ${world}`);
      await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3027/');
      await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
      await bind(page);
      await page.getByRole('button', { name: '开始', exact: true }).click();
      await page.waitForFunction(() => {
        const s = window.__game?.scene.getScene('PurificationScene');
        return s?.scene.isActive() && !s.resting && !s.restTween && !s.isAnyPanelOpen() &&
          !s.transitioning && !s.menuEntry && !s.shuttingDown;
      }, null, { timeout: 30000 });
      await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
      await page.locator('[data-departure-grade="medium"]').click();
      await page.locator('[data-prepare-action="next"]').click();
      row.seed = await page.evaluate(async world => {
        const { selectR100ProductionRecipe } = await import('/src/generation/world-study/r100-package.ts');
        let seed = 20261020;
        while (seed < 20281020 && selectR100ProductionRecipe(seed, 'medium').package.id !== `r100-${world}`) seed++;
        if (seed === 20281020) throw new Error(`World not enabled: ${world}`);
        const original = crypto.getRandomValues;
        crypto.getRandomValues = function(values) {
          if (values instanceof Uint32Array && values.length === 1) {
            crypto.getRandomValues = original; values[0] = seed; return values;
          }
          return original.call(this, values);
        };
        return seed;
      }, world);
      await page.locator('[data-prepare-action="depart"]').click();
      await waitRift(page); await page.waitForTimeout(400);
      row.entry = await snapshot(page); checkOptics(row.entry);
      assert.equal(row.entry.world, `r100-${world}`);
      assert(row.entry.firstFrames.length && row.entry.firstFrames.every(f => f.presentation === 'light-eater'));
      row.checks.push('normal departure and first visible frames use production optics');
      row.images.entry = await picture(page, `${world}-entry`);
      const before = row.entry.position;
      for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft']) {
        await page.keyboard.down(key); await page.waitForTimeout(180); await page.keyboard.up(key);
        const now = await snapshot(page);
        if (Math.hypot(now.position.x - before.x, now.position.y - before.y) > 3) break;
      }
      row.moved = await snapshot(page); checkOptics(row.moved);
      assert(Math.hypot(row.moved.position.x - before.x, row.moved.position.y - before.y) > 3);
      assert(row.moved.chaos.value > row.entry.chaos.value);
      row.checks.push('actual keyboard movement and natural pollution growth update shoulder field');
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('RiftScene');
        window.__opticalQA.gameState.setAssimilation(0); s.chaos.addChaos('qa-saturation', 1000);
      });
      await page.waitForTimeout(250);
      row.high = await snapshot(page); checkOptics(row.high);
      assert.equal(row.high.chaos.value, 100);
      assert(row.high.assimilation < .02);
      assert.equal(row.high.thresholdOverlayCount, 0, 'continuous optics must not receive the old tier-colored screen flash');
      assert.equal(row.high.thresholdLevel, 3, 'the real threshold cue still executes');
      row.images.high = await picture(page, `${world}-saturated`);
      await page.evaluate(() => window.__opticalQA.gameState.setAssimilation(80));
      await page.waitForTimeout(250);
      row.adapted = await snapshot(page); checkOptics(row.adapted);
      assert.equal(row.high.optics.warmRadius, row.adapted.optics.warmRadius);
      assert.equal(row.high.lamp.intensity, row.adapted.lamp.intensity);
      assert(row.adapted.optics.perceptionRadius > row.high.optics.perceptionRadius);
      row.images.adapted = await picture(page, `${world}-adapted`);
      row.checks.push('P100 absorbs near light; A80 extends perception without brightening lamp');
      await page.waitForTimeout(650);
      row.grown = await snapshot(page);
      assert(row.grown.assimilation > row.adapted.assimilation);
      if (world === 'crystal-fibre') {
        await page.waitForTimeout(3200);
        const expired = await snapshot(page);
        assert.equal(expired.thresholdLevel, 0, 'warning priority releases even without a DOM color overlay');
        row.checks.push('threshold narration remains active, with no tier color flash and correct expiry');
      }
      await page.keyboard.press('Escape');
      await page.locator('.pause-menu-panel').waitFor({ timeout: 5000 });
      row.paused = await snapshot(page);
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
      await page.waitForTimeout(350);
      row.pausedLater = await snapshot(page);
      assert.equal(row.paused.optics.elapsedMs, row.pausedLater.optics.elapsedMs);
      assert.equal(row.paused.chaos.clockMs, row.pausedLater.chaos.clockMs);
      assert.equal(row.paused.assimilation, row.pausedLater.assimilation);
      assert.equal(saved.assimilation, saved.riftCheckpoint.state.chaos.assimilationValue);
      row.saved = { identity: saved.riftCheckpoint.identity, chaos: saved.riftCheckpoint.state.chaos, conditions: saved.riftCheckpoint.state.conditions };
      row.checks.push('real Esc freezes simulation and erosion; checkpoint persists P/A');
      await page.reload();
      await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
      await bind(page);
      await page.getByRole('button', { name: '继续', exact: true }).click();
      await waitRift(page); await page.waitForTimeout(250);
      row.restored = await snapshot(page); checkOptics(row.restored);
      assert.equal(row.restored.world, row.entry.world);
      assert.deepEqual(row.restored.loadedChaos, saved.riftCheckpoint.state.chaos);
      assert(row.restored.firstFrames.length && row.restored.firstFrames.every(f => f.presentation === 'light-eater'));
      row.checks.push('cold Continue restores exact checkpoint physiology and new optics from first frame');
      row.pass = true; console.log(`PASS ${world}: ${row.checks.length} checks`);
    } catch (e) {
      row.pass = false; row.error = e.stack;
      try { row.failure = await snapshot(page); row.images.failure = await picture(page, `${world}-failure`); } catch {}
      throw e;
    } finally { await persist(); await context.close(); }
  }
  assert.equal(report.errors.length, 0);
  report.sourcesAfter = await hashes();
  assert.deepEqual(report.sourcesAfter, report.sourcesBefore, 'runtime source stayed frozen throughout coverage');
  report.pass = true;
} catch (e) { report.pass = false; report.failure = e.stack; process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); await persist(); await browser.close(); console.log(`REPORT ${output}/report.json`); }
