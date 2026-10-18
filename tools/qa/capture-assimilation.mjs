/** Isolated production-browser QA; fixtures are explicit, never user-profile storage. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const stamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
const output = path.resolve(`docs/qa/artifacts/assimilation-healing-2026-10-19/browser-${stamp}`);
await fs.mkdir(output, { recursive: true });
const report = { startedAt: new Date().toISOString(), scope: 'Isolated Chrome context, production title/base/departure/Rift lifecycle. Controlled A/HP/money and saturation fixtures. Real keyboard/clicks after device-entry calls. Not natural navigation, full expedition economy, balance, sound quality, or human aesthetic acceptance.', steps: [], pageErrors: [], consoleErrors: [], sources: {} };
if (process.env.COH_CAPTURE_PREVIEW_ONLY) report.scope = 'Isolated production base and cultivation preview only. Controlled A30, purifier HP70, money100; actual Tab and scroll-wheel input. Verifies public cost facts, precision, cost/footer visibility, and scroll reach. No new Rift entry or cycle execution in this capture.';
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
report.browser = await browser.version();
const context = await browser.newContext({ viewport: { width: 1264, height: 1000 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  window.__qaStorage = { attempts: 0, rejected: 0, reject: false };
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (key === 'coh-save-v1') {
      window.__qaStorage.attempts++;
      if (window.__qaStorage.reject) { window.__qaStorage.rejected++; throw new Error('QA simulated write refusal'); }
    }
    return set.call(this, key, value);
  };
});
const page = await context.newPage();
page.on('pageerror', error => report.pageErrors.push({ at: new Date().toISOString(), message: error.message }));
page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push({ at: new Date().toISOString(), text: message.text() }); });
async function persist() { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
async function bind() {
  return page.evaluate(async () => {
    const modules = {};
    async function loaded(file) {
      const url = performance.getEntriesByType('resource').filter(entry => new URL(entry.name).pathname === file).at(-1)?.name ?? file;
      modules[file] = url; return import(url);
    }
    const { audioManager } = await loaded('/src/managers/audio-manager.ts');
    const { gameState } = await loaded('/src/managers/game-state.ts');
    const { saveManager } = await loaded('/src/managers/save-manager.ts');
    const { tideSystem } = await loaded('/src/systems/tide-system.ts');
    const { growthPanel } = await loaded('/src/ui/dom/growth-panel.ts');
    const { getHealingPreview } = await loaded('/src/managers/healing-cycle.ts');
    window.__qa = { game: audioManager.game, gameState, saveManager, tideSystem, growthPanel, getHealingPreview, modules };
    return modules;
  });
}
async function snap() {
  return page.evaluate(() => {
    const q = window.__qa, s = q?.game?.scene.getScene('RiftScene');
    const saved = JSON.parse(localStorage.getItem('coh-save-v1') || 'null');
    return { scenes: q?.game?.scene.getScenes(true).map(s => s.sys.settings.key), state: q?.gameState.getState(),
      tide: q?.tideSystem.getState(), pending: q?.saveManager.hasPendingSave(), storage: window.__qaStorage,
      saved: saved && { assimilation: saved.assimilation, healingCycles: saved.healingCycles, cycle: saved.cycle,
        modules: saved.modules, tide: saved.tide, run: saved.inventory?.run && { id: saved.inventory.run.id, status: saved.inventory.run.status, baseSettled: saved.inventory.run.baseSettled },
        departureMode: saved.riftDeparture?.conditions.assimilationMode,
        checkpoint: saved.riftCheckpoint && { sequence: saved.riftCheckpoint.sequence, elapsedMs: saved.riftCheckpoint.elapsedMs,
          identity: { worldId: saved.riftCheckpoint.identity.worldId, generationWorld: saved.riftCheckpoint.identity.generation?.package?.id, grade: saved.riftCheckpoint.identity.generation?.package?.grade }, chaos: saved.riftCheckpoint.state.chaos } },
      rift: s?.chaos && !s.shuttingDown ? { active: s.scene.isActive(), paused: s.scene.isPaused(), chaos: s.chaos.exportRuntimeState(), enabled: s.chaos.isAssimilationEnabled(),
        position: s.player.getPosition(), mods: s.chaos.getModulators(), recognition: s.ai.playerRecognitionRangeMultiplier,
        resistance: s.chaos.getPollutionResistance(), frameBlocked: s.frameCommit?.isBlocked(),
        loadedChaos: s.recovery?.checkpoint?.state.chaos } : null,
      dom: document.querySelector('#dom-ui-root')?.innerText?.slice(0, 14000) ?? document.body.innerText.slice(0, 14000) };
  });
}
async function picture(name) {
  // Existing panels fade in over 220–260ms; first-paint pixels are not the settled UI.
  await page.waitForTimeout(350);
  const box = await page.locator('#game-container canvas').boundingBox();
  const file = `${name}.png`; await page.screenshot({ ...(box ? { clip: box } : {}), path: path.join(output, file) }); return file;
}
async function step(name, action) {
  console.log(`START ${name}`);
  const record = { name, startedAt: new Date().toISOString() }; report.steps.push(record); await persist();
  try { record.details = await action(); record.result = 'pass'; console.log(`PASS ${name}`); }
  catch (error) {
    record.result = 'fail'; record.error = error.stack;
    try { record.snapshot = await snap(); record.image = await picture(`failure-${report.steps.length}`); } catch (diagnosticError) { record.diagnosticError = String(diagnosticError); }
    await persist(); throw error;
  }
  record.finishedAt = new Date().toISOString(); await persist();
}
async function waitBase() {
  await page.waitForFunction(() => { const s = window.__qa?.game?.scene.getScene('PurificationScene'); return s?.scene.isActive() && s.player && !s.menuEntry && !s.interactionFocusReturn; }, null, { timeout: 25000 });
}
async function openHealing(method = 'tab') {
  await page.evaluate(() => window.__qa.game.scene.getScene('PurificationScene').openGrowthPanel());
  await page.locator('#growth-panel').waitFor({ timeout: 5000 });
  if (method === 'tab') await page.keyboard.press('Tab'); else await page.locator('[data-cultivation-page="healing"]').click();
  await page.locator('#healing-confirm-btn').waitFor({ timeout: 5000 });
}
async function fixture(assimilation, hp = 70) {
  await page.evaluate(({ assimilation, hp }) => {
    const q = window.__qa; q.gameState.setAssimilation(assimilation);
    const module = q.gameState.getModule('PURIFIER');
    if (module.hp > hp) q.gameState.applyDamage('PURIFIER', module.hp - hp); else q.gameState.healModule('PURIFIER', hp - module.hp);
    if (!q.saveManager.trySave()) throw new Error('Fixture save failed');
  }, { assimilation, hp });
}
try {
  await step('production-start-isolated', async () => {
    await page.goto(process.env.COH_REVIEW_BASE_URL || 'http://127.0.0.1:3027/');
    await page.getByRole('button', { name: '开始', exact: true }).waitFor({ timeout: 30000 });
    const modules = await bind(); await page.getByRole('button', { name: '开始', exact: true }).click(); await waitBase();
    await page.evaluate(() => { const q = window.__qa; q.gameState.addKindling(Math.max(0, 100 - q.gameState.getKindlingReserve())); });
    await fixture(30, 70);
    return { modules, snapshot: await snap() };
  });
  if (process.env.COH_CAPTURE_PREVIEW_ONLY) {
    await step('healing-preview-public-cost-facts', async () => {
      await openHealing();
      const text = await page.locator('#growth-panel').innerText();
      assert(text.includes('30.0%') && text.includes('15.0%') && text.includes('7.5%'), text);
      assert(text.includes('净化器') && text.includes('70') && text.includes('25') && text.includes('潮'), text);
      const layout = await page.locator('#growth-panel').evaluate(panel => {
        const rect = panel.getBoundingClientRect(), button = panel.querySelector('#healing-confirm-btn').getBoundingClientRect();
        const cost = panel.querySelector('.healing-cost').getBoundingClientRect(), content = panel.querySelector('.healing-content').getBoundingClientRect();
        return { panel: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
          button: { left: button.left, top: button.top, right: button.right, bottom: button.bottom },
          cost: { top: cost.top, bottom: cost.bottom }, content: { top: content.top, bottom: content.bottom },
          mountedUnderRoot: panel.closest('#dom-ui-root') !== null,
          scroll: { height: panel.querySelector('.healing-content').clientHeight, content: panel.querySelector('.healing-content').scrollHeight } };
      });
      assert(layout.mountedUnderRoot && layout.button.bottom <= layout.panel.bottom);
      assert(layout.cost.top >= layout.content.top && layout.cost.bottom <= layout.content.bottom && layout.content.bottom < layout.button.top);
      const image = await picture('healing-preview-cost-facts');
      await page.locator('.healing-content').hover(); await page.mouse.wheel(0, 500); await page.waitForTimeout(100);
      const scroll = await page.locator('.healing-content').evaluate(content => ({ top: content.scrollTop, height: content.clientHeight, total: content.scrollHeight }));
      assert(scroll.top > 0 && scroll.top + scroll.height >= scroll.total - 2);
      return { text, layout, scroll, snapshot: await snap(), image, scrolledImage: await picture('healing-preview-effects-scrolled') };
    });
  } else {
  await step('healing-keyboard-preview-and-one-cycle', async () => {
    await openHealing();
    const text = await page.locator('#growth-panel').innerText(); assert(text.includes('30.0%') && text.includes('15.0%'), text);
    const before = await snap(), previewImage = await picture('healing-preview-30');
    await page.keyboard.down('Enter');
    await page.locator('#impact-result-panel').waitFor({ timeout: 5000 });
    await page.keyboard.down('Enter'); await page.keyboard.down('Enter'); await page.keyboard.up('Enter');
    assert(await page.locator('#impact-result-panel').isVisible(), 'held Enter must not dismiss the result');
    const after = await snap();
    assert.equal(after.state.assimilation, 15); assert.equal(after.saved.assimilation, 15);
    assert.equal(after.state.healingCycles, before.state.healingCycles + 1); assert.equal(after.state.cycle, before.state.cycle);
    assert.notDeepEqual(after.state.modules, before.state.modules); assert.notDeepEqual(after.tide, before.tide);
    const resultImage = await picture('healing-report-15'); await page.locator('#impact-close-btn').click(); await waitBase();
    return { before, after, previewImage, resultImage };
  });
  await step('healing-zero-and-low-purifier-gates', async () => {
    const results = [];
    for (const [a, hp, reason] of [[0, 70, '没有需要疗愈'], [30, 24, '至少需要 25']]) {
      await fixture(a, hp); await openHealing('click');
      assert(await page.locator('#healing-confirm-btn').isDisabled());
      const text = await page.locator('[data-healing-reason]').innerText(); assert(text.includes(reason), text);
      const before = await snap(); await page.keyboard.press('Enter'); assert.equal((await snap()).state.healingCycles, before.state.healingCycles);
      results.push({ a, hp, reason: text, image: await picture(`healing-disabled-a${a}-hp${hp}`) });
      await page.keyboard.press('Escape'); await waitBase();
    }
    return results;
  });
  await step('healing-refusal-freezes-esc-and-retry-once', async () => {
    await fixture(30, 70); await openHealing('click');
    const before = await snap(), bytes = await page.evaluate(() => localStorage.getItem('coh-save-v1'));
    await page.evaluate(() => { window.__qaStorage.reject = true; });
    await page.locator('#healing-confirm-btn').click();
    await page.locator('#save-retry-notice').waitFor({ timeout: 5000 });
    const refused = await snap(); assert(refused.pending); assert.equal(refused.state.assimilation, 15);
    assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), bytes);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const blocked = await snap(); assert.equal(await page.locator('.pause-menu-panel').count(), 0); assert.equal(blocked.state.healingCycles, refused.state.healingCycles);
    const refusalImage = await picture('healing-refused-esc');
    await page.evaluate(() => { window.__qaStorage.reject = false; });
    await page.locator('#save-retry-notice button').click();
    await page.locator('#impact-result-panel').waitFor({ timeout: 5000 });
    const retried = await snap(); assert(!retried.pending); assert.equal(retried.saved.assimilation, 15);
    assert.equal(retried.state.healingCycles, before.state.healingCycles + 1); assert.deepEqual(retried.state.modules, refused.state.modules); assert.deepEqual(retried.tide, refused.tide);
    await page.locator('#impact-close-btn').click(); await waitBase();
    return { before, refused, blocked, retried, refusalImage };
  });
  let baseSaved;
  await step('base-cold-continue-does-not-replay-healing', async () => {
    baseSaved = (await snap()).saved;
    await page.reload(); await page.getByRole('button', { name: '继续', exact: true }).waitFor({ timeout: 30000 });
    const modules = await bind(); await page.getByRole('button', { name: '继续', exact: true }).click(); await waitBase();
    const restored = await snap(); assert.equal(restored.state.assimilation, baseSaved.assimilation); assert.equal(restored.state.healingCycles, baseSaved.healingCycles);
    assert.deepEqual(restored.state.modules, baseSaved.modules); assert.deepEqual(restored.tide, baseSaved.tide); assert.equal(await page.locator('#impact-result-panel').count(), 0);
    return { modules, restored, image: await picture('base-cold-continue') };
  });
  if (!process.env.COH_CAPTURE_BASE_ONLY) {
  await step('production-departure-grade-equipment-enter', async () => {
    await page.evaluate(() => window.__qa.game.scene.getScene('PurificationScene').enterRift());
    await page.locator('[data-departure-grade="low"]').click();
    await page.getByRole('button', { name: '整理行装', exact: true }).click();
    const preparationImage = await picture('departure-equipment');
    const started = Date.now(); await page.locator('[data-prepare-action="depart"]').click();
    await page.waitForFunction(() => { const s = window.__qa?.game?.scene.getScene('RiftScene'); return s?.scene.isActive() && s.chaos && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive() && !s.entryView?.active; }, null, { timeout: 90000 });
    const entered = await snap(); assert(entered.rift.enabled); assert.equal(entered.rift.chaos.assimilationMode, 'persistent-v1');
    assert.equal(entered.rift.chaos.pollutionGrade, 'low'); assert.equal(entered.state.assimilation, baseSaved.assimilation);
    return { entered, entryMs: Date.now() - started, preparationImage, lowPollutionImage: await picture('rift-low-pollution') };
  });
  await step('controlled-saturation-adaptation-and-simulation-growth', async () => {
    await page.evaluate(() => { const q = window.__qa, s = q.game.scene.getScene('RiftScene'); q.gameState.setAssimilation(0); s.chaos.addChaos('qa-saturation', 1000); });
    await page.waitForTimeout(150); const saturatedZero = await snap(), zeroImage = await picture('rift-p100-a0-controlled');
    assert.equal(saturatedZero.rift.chaos.value, 100); assert(saturatedZero.state.assimilation < .01, 'discrete overflow must not convert directly into A');
    await page.evaluate(() => window.__qa.gameState.setAssimilation(60)); await page.waitForTimeout(150);
    const saturated60 = await snap(), adaptedImage = await picture('rift-p100-a60-controlled');
    assert(saturated60.rift.mods.radiusScale > saturatedZero.rift.mods.radiusScale); assert(saturated60.rift.recognition < saturatedZero.rift.recognition);
    const start = await snap(); await page.waitForTimeout(1500); const end = await snap();
    const duration = end.rift.chaos.clockMs - start.rift.chaos.clockMs;
    const expected = .6 * (1 - Math.min(.6, start.rift.resistance / 100)) * (1 - start.rift.chaos.growthResistance) * duration / 60000;
    assert(duration > 500 && end.state.assimilation > start.state.assimilation);
    assert(Math.abs(end.state.assimilation - start.state.assimilation - expected) < 1e-6);
    assert.equal(end.rift.chaos.value, 100);
    return { saturatedZero, saturated60, start, end, duration, expected, zeroImage, adaptedImage };
  });
  await step('active-rift-cold-continue-preserves-A-and-mode', async () => {
    await page.keyboard.press('Escape'); await page.waitForTimeout(120);
    const frozen = await snap(); assert(frozen.rift.paused); assert.equal(frozen.saved.assimilation, frozen.rift.chaos.assimilationValue);
    await page.reload(); await page.getByRole('button', { name: '继续', exact: true }).waitFor({ timeout: 30000 }); await bind();
    const started = Date.now(); await page.getByRole('button', { name: '继续', exact: true }).click();
    await page.waitForFunction(() => { const s = window.__qa?.game?.scene.getScene('RiftScene'); return s?.chaos && s.recovery?.checkpoint && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive(); }, null, { timeout: 90000 });
    const restored = await snap(); assert(restored.rift.enabled); assert.equal(restored.rift.loadedChaos.assimilationValue, frozen.saved.assimilation);
    assert.equal(restored.rift.loadedChaos.clockMs, frozen.saved.checkpoint.chaos.clockMs); assert.equal(restored.saved.run.id, frozen.saved.run.id);
    assert.equal(restored.state.healingCycles, frozen.state.healingCycles); assert(restored.state.assimilation >= frozen.saved.assimilation);
    return { frozen, restored, entryMs: Date.now() - started, image: await picture('rift-cold-continue') };
  });
  }
  }
  report.result = 'pass';
} catch (error) { report.result = 'fail'; report.error = error.stack; process.exitCode = 1; }
finally {
  for (const file of ['src/managers/healing-cycle.ts','src/managers/save-manager.ts','src/systems/chaos-system.ts','src/scenes/purification-scene.ts','src/scenes/rift-scene.ts','src/ui/dom/growth-panel.ts','src/ui/dom/rift-hud.ts','src/ui/dom/impact-result-panel.ts']) report.sources[file] = createHash('sha256').update(await fs.readFile(file)).digest('hex');
  report.finishedAt = new Date().toISOString(); await persist(); await browser.close();
}
console.log(JSON.stringify({ result: report.result, output, steps: report.steps.map(s => ({ name: s.name, result: s.result })), error: report.error }, null, 2));
