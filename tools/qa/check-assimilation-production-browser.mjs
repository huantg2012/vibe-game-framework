/** Normal game entry and isolated storage. Seed/A/source setters are explicit QA fixtures. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const output = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/assimilation-production-2026-10-20');
await fs.mkdir(output, { recursive: true });
const sourceFiles = ['src/scenes/rift-scene.ts', 'src/scenes/purification-scene.ts',
  'src/scenes/last-light-visual.ts', 'src/art/last-light-renderer.ts', 'src/entities/player-last-light-presentation.ts',
  'src/art/assimilation-appearance.ts', 'src/art/assimilation-state-presentation.ts',
  'src/art/assimilation-presentation.ts', 'src/art/assimilation-model/client.ts', 'src/art/assimilation-model/geometry.ts'];
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file =>
  [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report = {
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  startedAt: new Date().toISOString(), sourcesBefore: await hashes(),
  mode: process.env.QA_HAVEN_ONLY ? 'Haven-only supplement: normal New Game entrance, attributed A85 fixture, ready standing/sitting/healing' : 'three-world production journey',
  scope: 'Normal title → haven → preparation → seeded Rift. Separate Chrome contexts protect user saves. Controlled fixtures set A85 with the actual selected world source at low natural P; Haven mix uses two genuine attributed increases. Movement, attack, pause, cold Continue, abandon, rest and one healing cycle use gameplay/UI paths. Growth panel opening uses the scene interaction handler. No art-study query, godmode, teleport or simulated attack clock. Screenshots wait for complete ready geometry. This does not certify long expeditions, balance, other browsers, GPU time or human art acceptance.',
  measurement: 'DEV server, headless Chrome. rAF intervals measure whole-page scheduling; renderer timers measure CPU draw/submission, including existing work. Warmup is complete-bank wall time. No CPU delta is attributed exclusively to assimilation and no GPU timing is inferred.',
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
    window.__assimQA = { gameState, captureAttack: false, attacks: [] };
    window.__game.events.on('poststep', () => {
      const q = window.__assimQA, s = window.__game.scene.getScene('RiftScene');
      if (!q.captureAttack || !s?.scene.isActive() || q.attacks.length >= 180) return;
      q.attacks.push(s.lastLightPlayerPresentation.getProbe());
    });
    window.__game.events.on('postrender', () => {
      const q = window.__assimQA, s = window.__game.scene.getScene('RiftScene');
      if (!q.captureAttack || q.attackImage || !s?.scene.isActive()) return;
      const probe = s.lastLightPlayerPresentation.getProbe();
      if (probe.attackPhase === 'active') q.attackImage = {
        png: window.__game.canvas.toDataURL('image/png'), probe,
      };
    });
  });
}
const waitRift = page => page.waitForFunction(() => {
  const s = window.__game?.scene.getScene('RiftScene');
  return s?.scene.isActive() && s.chaos && s.nativeWorldPresentation && s.assimilationPresentation &&
    !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive() && !s.entryView?.active;
}, null, { timeout: 90000 });
const waitHaven = page => page.waitForFunction(() => {
  const s = window.__game?.scene.getScene('PurificationScene');
  return s?.scene.isActive() && s.chamber?.assimilation && !s.restTween && !s.transitioning && !s.menuEntry && !s.shuttingDown;
}, null, { timeout: 30000 });

async function snapshot(page, profile = 'rift') {
  return page.evaluate(profile => {
    const s = window.__game.scene.getScene(profile === 'rift' ? 'RiftScene' : 'PurificationScene');
    const owner = profile === 'rift' ? s.assimilationPresentation : s.chamber.assimilation;
    const renderer = profile === 'rift' ? s.lastLightPlayerPresentation : s.chamber.renderer;
    const q = window.__assimQA, look = renderer.assimilationLook;
    return {
      profile, amount: q.gameState.getAssimilation(), sources: q.gameState.getAssimilationSources(),
      healingCycles: q.gameState.getHealingCycles(), status: owner.status, cache: owner.metrics,
      cpu: { ...renderer.getAssimilationLookMetrics() },
      look: { amount: look.amount, fibre: look.fibre, neutralFraction: look.neutralFraction,
        fibrePalette: look.fibrePalette, membranePalette: look.membranePalette,
        neutralPalette: look.neutralPalette, paletteRevision: look.paletteRevision, seconds: look.seconds },
      position: s.player.getPosition(),
      ...(profile === 'rift' ? {
        world: s.recovery?.identity.generation?.package.id, chaos: s.chaos.exportRuntimeState(),
        probe: renderer.getProbe(), artFixture: !!s.devFixture?.assimilationArtStudy,
        godMode: s.combat.godMode, paused: s.scene.isPaused(), health: s.combat.getHealth(),
        loadedChaos: s.recovery?.checkpoint?.state.chaos,
      } : {
        journey: s.probeJourneyState(), pose: renderer.currentFrame?.pose,
        model: renderer.assimilationUploadedFrame && {
          id: renderer.assimilationUploadedFrame.id, meta: renderer.assimilationUploadedFrame.meta,
        },
      }),
    };
  }, profile);
}
async function waitReady(page, profile = 'rift') {
  const start = Date.now();
  await page.waitForFunction(profile => {
    const s = window.__game.scene.getScene(profile === 'rift' ? 'RiftScene' : 'PurificationScene');
    const status = (profile === 'rift' ? s.assimilationPresentation : s.chamber.assimilation).status;
    if (status.state === 'failed') throw new Error(status.error);
    return status.state === 'ready';
  }, profile, { timeout: 90000, polling: 100 });
  await page.waitForTimeout(120);
  const state = await snapshot(page, profile);
  assert.equal(state.status.completed, state.status.total);
  assert(state.status.total > 0);
  assert.equal(state.cache.activeFrames, state.status.total);
  if (profile === 'rift') assert(state.probe.assimilation.frame, 'Ready Rift must use complete model bank');
  else assert(state.model, 'Ready Haven must upload complete model bank');
  return { waitWallMs: Date.now() - start, state };
}
async function sample(page, profile, durationMs = 2000) {
  return page.evaluate(async ({ profile, durationMs }) => {
    const s = window.__game.scene.getScene(profile === 'rift' ? 'RiftScene' : 'PurificationScene');
    const r = profile === 'rift' ? s.lastLightPlayerPresentation : s.chamber.renderer;
    const before = { ...r.getAssimilationLookMetrics() }, intervals = [], cpu = [];
    let previous = 0, count = before.count;
    const start = performance.now();
    await new Promise(resolve => {
      function tick(now) {
        if (previous) intervals.push(now - previous);
        previous = now;
        const m = r.getAssimilationLookMetrics();
        if (m.count !== count) { cpu.push(m.lastMs); count = m.count; }
        if (now - start >= durationMs) resolve(); else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    const after = { ...r.getAssimilationLookMetrics() };
    const stats = values => {
      const sorted = [...values].sort((a, b) => a - b);
      const at = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;
      return { count: values.length, mean: values.reduce((sum, n) => sum + n, 0) / Math.max(1, values.length),
        p50: at(.5), p95: at(.95), p99: at(.99), max: at(1) };
    };
    return { wallMs: performance.now() - start, rafMs: stats(intervals), cpuMs: stats(cpu),
      rendererCount: after.count - before.count, rendererTotalMs: after.totalMs - before.totalMs,
      maskBytes: after.maskBytes, preparedFrames: after.preparedFrames };
  }, { profile, durationMs });
}
async function picture(page, name) {
  const clip = await page.locator('#game-container canvas').boundingBox();
  await page.screenshot({ clip, path: path.join(output, `${name}.png`) });
  return `${name}.png`;
}
function checkAmount(s, amount) {
  assert.equal(s.amount, amount);
  assert(Math.abs(s.look.amount - (amount / 100) ** 2 * (3 - 2 * amount / 100)) < 1e-9);
  assert(s.cache.hotFrames <= 32 && s.cache.bankCount <= 4);
}
async function fixture(page, world) {
  await page.evaluate(world => {
    const g = window.__assimQA.gameState;
    g.setAssimilation(0);
    if (world === 'mixed') { g.setAssimilation(42.5, 'crystal-fibre'); g.setAssimilation(85, 'ruptured-film'); }
    else g.setAssimilation(85, world);
  }, world);
  await page.waitForTimeout(80);
}
async function enter(page, world) {
  await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3027/');
  await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
  await bind(page);
  await page.getByRole('button', { name: '开始', exact: true }).click();
  await waitHaven(page);
  await page.waitForFunction(() => !window.__game.scene.getScene('PurificationScene').isAnyPanelOpen());
  await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
  await page.locator('[data-departure-grade="medium"]').click();
  await page.locator('[data-prepare-action="next"]').click();
  const seed = await page.evaluate(async world => {
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
  await waitRift(page);
  return seed;
}
async function journey(page, row) {
  await fixture(page, 'mixed');
  row.riftMixedReady = await waitReady(page);
  assert.equal(row.riftMixedReady.state.look.fibre, .5);
  row.images.mixedIdle = await picture(page, `${row.world}-mixed-idle-ready`);
  const before = (await snapshot(page)).position;
  for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft']) {
    await page.keyboard.down(key); await page.waitForTimeout(180); await page.keyboard.up(key);
    const now = (await snapshot(page)).position;
    if (Math.hypot(now.x - before.x, now.y - before.y) > 3) break;
  }
  row.moved = await snapshot(page);
  assert(Math.hypot(row.moved.position.x - before.x, row.moved.position.y - before.y) > 3);
  await page.evaluate(() => { window.__assimQA.attacks = []; window.__assimQA.captureAttack = true; });
  await page.keyboard.press('Space'); await page.waitForTimeout(850);
  row.attacks = await page.evaluate(() => { window.__assimQA.captureAttack = false; return window.__assimQA.attacks; });
  const active = row.attacks.filter(frame => frame.attackFrame >= 0);
  assert(active.length >= 3, 'Actual keyboard attack produces live sample frames');
  assert(new Set(active.map(frame => frame.attackFrame)).size >= 3, 'Attack clock advances through bank samples');
  assert(active.every(frame => frame.assimilation.body && frame.assimilation.arm), 'Every active attack uses matching body/arm models');
  assert(row.attacks.at(-1).attackFrame === -1, 'Actual attack returns to idle');
  const attackImage = await page.evaluate(() => window.__assimQA.attackImage);
  assert(attackImage, 'Postrender captured an actual active attack frame');
  row.attackImageProbe = attackImage.probe;
  row.images.mixedAttack = `${row.world}-mixed-attack.png`;
  await fs.writeFile(path.join(output, row.images.mixedAttack), Buffer.from(attackImage.png.split(',')[1], 'base64'));
  row.checks.push('real movement and live attack samples retain body/arm depth, held-tool and mask path');
  await page.keyboard.press('Escape');
  await page.locator('.pause-menu-panel').waitFor({ timeout: 5000 });
  row.paused = await snapshot(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
  await page.waitForTimeout(350);
  row.pausedLater = await snapshot(page);
  assert.equal(row.paused.look.seconds, row.pausedLater.look.seconds);
  assert.equal(row.paused.chaos.clockMs, row.pausedLater.chaos.clockMs);
  assert.deepEqual(row.paused.sources, row.pausedLater.sources);
  row.saved = { assimilation: saved.assimilation, assimilationSources: saved.assimilationSources,
    chaos: saved.riftCheckpoint.state.chaos };
  await page.reload();
  await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
  await bind(page);
  await page.getByRole('button', { name: '继续', exact: true }).click();
  await waitRift(page);
  row.restoredImmediate = await snapshot(page);
  checkAmount(row.restoredImmediate, 85);
  assert.deepEqual(row.restoredImmediate.sources, row.paused.sources);
  assert.deepEqual(row.restoredImmediate.loadedChaos, saved.riftCheckpoint.state.chaos);
  row.restoredReady = await waitReady(page);
  row.images.continued = await picture(page, `${row.world}-continued-ready`);
  row.checks.push('pause freezes material clock and A/sources; cold Continue preserves sources and exact chaos checkpoint');
  await page.keyboard.press('Escape');
  await page.locator('.pause-menu-panel').waitFor({ timeout: 5000 });
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__game.scene.getScene('RiftScene').runController.isRunEnded(), null, { timeout: 10000 });
  await page.locator('#rift-result-continue').waitFor({ timeout: 10000 });
  await page.locator('#rift-result-continue').click();
  await waitHaven(page);
  if (await page.locator('#impact-close-btn').count()) await page.locator('#impact-close-btn').click();
  await page.waitForFunction(() => !window.__game.scene.getScene('PurificationScene').isAnyPanelOpen());
  row.returned = await snapshot(page, 'haven');
  checkAmount(row.returned, 85);
  assert.deepEqual(row.returned.sources, row.paused.sources);
  row.returnSave = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('coh-save-v1'));
    return { outcome: s.inventory.run.outcome, baseSettled: s.inventory.run.baseSettled };
  });
  assert.deepEqual(row.returnSave, { outcome: 'abandon', baseSettled: true });
  row.checks.push('explicit abandon reaches Haven with unchanged A/sources and settled loss outcome');
  await havenJourney(page, row);
}
async function havenJourney(page, row) {
  await fixture(page, 'mixed');
  row.havenMixedReady = await waitReady(page, 'haven');
  const mixed = row.havenMixedReady.state;
  checkAmount(mixed, 85);
  assert.equal(mixed.look.fibre, .5);
  assert.equal(mixed.look.neutralFraction, 0);
  assert.equal(mixed.sources.worlds['crystal-fibre'], 42.5);
  assert.equal(mixed.sources.worlds['ruptured-film'], 42.5);
  assert.equal(mixed.model.meta.pose, 'idle');
  row.havenSteady = await sample(page, 'haven');
  row.images.havenStanding = await picture(page, 'haven-mixed-standing-ready');
  // Walk to the real rest approach using screen direction input; never set position.
  for (let attempt = 0; attempt < 24; attempt++) {
    const target = await page.evaluate(() => {
      const s = window.__game.scene.getScene('PurificationScene'), p = s.probeJourneyState();
      return { canRest: s.locomotion.canRest(), dx: p.rest.x - s.player.getPosition().x,
        dy: p.rest.y - s.player.getGroundY() };
    });
    if (target.canRest) break;
    const keys = [];
    if (Math.abs(target.dx) > 3) keys.push(target.dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    if (Math.abs(target.dy) > 3) keys.push(target.dy > 0 ? 'ArrowDown' : 'ArrowUp');
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForTimeout(100);
    for (const key of keys) await page.keyboard.up(key);
  }
  assert(await page.evaluate(() => window.__game.scene.getScene('PurificationScene').locomotion.canRest()), 'Actual movement reaches rest approach');
  await page.keyboard.press('e', { delay: 80 });
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('PurificationScene');
    return s.resting && !s.restTween && s.chamber.renderer.assimilationUploadedFrame?.meta.pose === 'sit';
  }, null, { timeout: 5000 });
  row.seated = await snapshot(page, 'haven');
  checkAmount(row.seated, 85);
  assert.equal(row.seated.pose, 'sit');
  assert.equal(row.seated.model.meta.pose, 'sit');
  assert.deepEqual(row.seated.sources, mixed.sources);
  row.images.havenSeated = await picture(page, 'haven-mixed-seated-ready');
  await page.keyboard.press('e', { delay: 80 });
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('PurificationScene');
    return !s.resting && !s.restTween;
  });
  row.checks.push('mixed-source Haven has real standing and seated geometry through keyboard input');
  await page.evaluate(() => window.__game.scene.getScene('PurificationScene').openGrowthPanel());
  await page.locator('[data-cultivation-page="healing"]').click();
  await page.locator('#healing-confirm-btn').click();
  await page.locator('#impact-close-btn').waitFor({ timeout: 10000 });
  await page.locator('#impact-close-btn').click();
  if (await page.locator('#growth-panel').count()) await page.keyboard.press('Escape');
  row.healedReady = await waitReady(page, 'haven');
  const healed = row.healedReady.state;
  checkAmount(healed, 70);
  assert.equal(healed.healingCycles, mixed.healingCycles + 1);
  assert.equal(healed.sources.worlds['crystal-fibre'], 35);
  assert.equal(healed.sources.worlds['ruptured-film'], 35);
  assert.equal(healed.look.fibre, .5);
  assert.equal(healed.cache.activeSource.amount, .7);
  assert.notEqual(healed.model.id, mixed.model.id);
  row.images.havenHealed = await picture(page, 'haven-mixed-healed-ready');
  row.checks.push('real healing cycle reduces A85→70 and both source weights proportionally, with updated ready geometry');
}

try {
  for (const world of (process.env.QA_HAVEN_ONLY ? ['haven-supplement']
    : (process.env.QA_WORLDS ?? 'crystal-fibre,ruptured-film,cinder-ridge').split(','))) {
    const row = { world, checks: [], images: {} };
    report.worlds.push(row); await persist();
    const context = await browser.newContext({ viewport: { width: 1264, height: 1000 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push({ world, message: e.message }));
    try {
      console.log(`START ${world}`);
      if (world === 'haven-supplement') {
        await page.goto(process.env.GAME_URL ?? 'http://127.0.0.1:3027/');
        await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
        await bind(page);
        await page.getByRole('button', { name: '开始', exact: true }).click();
        await waitHaven(page);
        await page.waitForFunction(() => !window.__game.scene.getScene('PurificationScene').isAnyPanelOpen());
        await havenJourney(page, row);
        row.pass = true; console.log(`PASS ${world}: ${row.checks.length} checks`);
        continue;
      }
      row.seed = await enter(page, world);
      row.entry = await snapshot(page);
      assert.equal(row.entry.world, `r100-${world}`);
      assert.equal(row.entry.amount, 0);
      assert(!row.entry.artFixture && !row.entry.godMode);
      assert.equal(row.entry.probe.assimilation.frame, null);
      row.baseline = await sample(page, 'rift');
      row.images.baseline = await picture(page, `${world}-a0`);
      await fixture(page, world);
      row.warming = await snapshot(page);
      checkAmount(row.warming, 85);
      row.warmingSample = await sample(page, 'rift');
      row.ready = await waitReady(page);
      const ready = row.ready.state;
      checkAmount(ready, 85);
      assert.equal(ready.sources.worlds[world], 85);
      assert.equal(ready.look.neutralFraction, world === 'cinder-ridge' ? 1 : 0);
      assert.equal(ready.look.fibre, world === 'crystal-fibre' ? 1 : 0);
      assert(ready.chaos.value < 50, 'Fixture remains below assimilation-growth saturation');
      row.steady = await sample(page, 'rift');
      row.images.ready = await picture(page, `${world}-a85-ready`);
      row.checks.push('actual A/source projection drives ready full-body model and correct source family at low P');
      console.log(`READY ${world}: ${Math.round(ready.cache.warmupMs)}ms, ${ready.cache.activeFrames} frames`);
      if (world === 'crystal-fibre') await journey(page, row);
      row.pass = true; console.log(`PASS ${world}: ${row.checks.length} checks`);
    } catch (error) {
      row.pass = false; row.error = error.stack;
      try {
        const profile = await page.evaluate(() => window.__game.scene.getScene('PurificationScene').scene.isActive() ? 'haven' : 'rift');
        row.failure = await snapshot(page, profile); row.images.failure = await picture(page, `${world}-failure-${Date.now()}`);
      } catch {}
      throw error;
    } finally { await persist(); await context.close(); }
  }
  assert.equal(report.errors.length, 0);
  report.sourcesAfter = await hashes();
  assert.deepEqual(report.sourcesAfter, report.sourcesBefore, 'Runtime source stayed frozen throughout coverage');
  report.pass = true;
} catch (error) { report.pass = false; report.failure = error.stack; process.exitCode = 1; }
finally {
  report.finishedAt = new Date().toISOString();
  await persist(); await browser.close(); console.log(`REPORT ${output}/report.json`);
}
