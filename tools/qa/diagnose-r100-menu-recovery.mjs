/** Read the original failed QA save into isolated browser contexts. No production
 * state is edited; the optional delayed title response tests menu readiness. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const folder = 'docs/qa/artifacts/r100-world-identity/recovery-input-diagnostic';
const original = JSON.parse(fs.readFileSync(path.join(folder, 'original-failed-case.json'), 'utf8'));
const saved = original.diagnostic.saved;
const source = JSON.parse(saved);
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { source: 'Original failed ash-strata/medium case, saved bytes unmodified', sourceSaveSha256: createHash('sha256').update(saved).digest('hex'), url: 'http://127.0.0.1:3087/', cases: [] };
const state = async page => page.evaluate(() => {
  const menu = window.__game?.scene.getScene('MainMenuScene'), rift = window.__game?.scene.getScene('RiftScene');
  return { now: performance.now(), active: window.__game?.scene.getScenes(true).map(scene => scene.scene.key), ready: menu?.ready,
    interactive: menu?.scene.isActive() ? menu.interactive() : false, mode: menu?.mode, focused: document.hasFocus(),
    selected: [...document.querySelectorAll('.joint-action')].map(button => ({ label: button.textContent, disabled: button.disabled, current: button.getAttribute('aria-current') })),
    riftReady: !!(rift?.scene.isActive() && rift.nativeWorldPresentation && rift.devRuntime && !rift.stagedEntry?.isActive() && !rift.nativeEntryFence?.isActive()),
  };
});
try {
  for (const mode of ['original-350ms', 'readiness-wait', 'delayed-art-350ms']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } }), page = await context.newPage();
    const row = { mode, errors: [], delayedArtMs: mode === 'delayed-art-350ms' ? 2000 : 0 };
    report.cases.push(row);
    page.on('pageerror', error => row.errors.push(String(error)));
    await page.addInitScript(({ saved }) => {
      localStorage.setItem('coh-save-v1', saved); window.__menuKeyEvidence = [];
      document.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        const s = window.__game?.scene.getScene('MainMenuScene');
        window.__menuKeyEvidence.push({ time: performance.now(), trusted: event.isTrusted, repeat: event.repeat, ready: s?.ready,
          interactive: s?.scene.isActive() ? s.interactive() : false, focused: document.hasFocus(), mode: s?.mode });
      }, true);
    }, { saved });
    if (row.delayedArtMs) await page.route('**/assets/art/menu-refuge-f.png', async route => { await new Promise(resolve => setTimeout(resolve, row.delayedArtMs)); await route.continue(); });
    try {
      await page.goto(report.url);
      await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
      row.sceneActive = await state(page);
      if (mode === 'readiness-wait') await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
      else await page.waitForTimeout(350);
      row.beforeFirstEnter = await state(page);
      await page.keyboard.press('Enter', { delay: 100 });
      await page.waitForTimeout(1000);
      row.afterFirstEnter = await state(page);
      if (row.afterFirstEnter.active?.includes('MainMenuScene') && row.afterFirstEnter.mode === 'root') {
        row.firstEnterNotAccepted = true;
        await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive());
        row.beforeReadyEnter = await state(page);
        await page.keyboard.press('Enter', { delay: 100 });
      }
      await page.waitForFunction(() => {
        const s = window.__game?.scene.getScene('RiftScene');
        return s?.scene.isActive() && s.nativeWorldPresentation && s.devRuntime && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive();
      }, null, { timeout: 30000 });
      row.restored = await state(page);
      await page.keyboard.press('Escape', { delay: 100 }); await page.waitForTimeout(150);
      const after = await page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
      assert.deepEqual(after.riftCheckpoint.identity, source.riftCheckpoint.identity);
      assert.deepEqual(after.riftCheckpoint.state.player.position, source.riftCheckpoint.state.player.position);
      row.sameIdentity = true; row.samePlayerPosition = true; row.status = 'passed';
      await page.screenshot({ path: path.join(folder, `${mode}-restored.png`) });
    } catch (error) { row.status = 'failed'; row.failure = String(error); row.failureState = await state(page); }
    row.keyEvents = await page.evaluate(() => window.__menuKeyEvidence);
    fs.writeFileSync(path.join(folder, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ mode, status: row.status, before: row.beforeFirstEnter, ignored: row.firstEnterNotAccepted, errors: row.errors }));
    await context.close();
  }
} finally { await browser.close(); }
assert(report.cases.every(row => row.status === 'passed'));
