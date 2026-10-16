/** F037 focused regression. Isolated real Chrome tabs, trusted focus events, actual production panels. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const base = process.env.GAME_URL ?? 'http://127.0.0.1:3027/';
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? `docs/qa/artifacts/focus-menu-2026-10-16/attempt-${new Date().toISOString().replace(/[:.]/g, '-')}`);
assert(!fs.existsSync(out), 'Preserve prior evidence; use a new output directory');
fs.mkdirSync(out, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  task: 'COH-F037: Haven focus loss does not auto-pause; Rift focus loss opens the existing system menu',
  method: 'Fresh isolated record; normal title/grade/loadout/departure controls. Haven offering and preparation are opened through their actual scene methods to avoid irrelevant navigation. Real headed Chrome tab switching with focus emulation disabled; no synthetic focus events, game clock/state/position or generation changes.',
  exclusions: ['No OS application switching or other browsers', 'Not a performance test or final human visual acceptance', 'Persistence failure uses an isolated Storage.setItem quota fault; no user storage is touched'],
  sourceHashes: Object.fromEntries(['src/main.ts','src/ui/dom/pause-menu.ts','src/scenes/rift-scene.ts','src/scenes/purification-scene.ts','src/ui/dom/panel-styles.ts'].map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  cases: [], errors: [], status: 'running',
};
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
save();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: false, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const alternate = await context.newPage(); await alternate.goto('about:blank');
const alternateSession = await context.newCDPSession(alternate); await alternateSession.send('Emulation.setFocusEmulationEnabled', { enabled: false });
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(String(error)));
await page.addInitScript(() => {
  window.__focusTrace = [];
  const observe = e => window.__focusTrace.push({ type: e.type, key: e.key, trusted: e.isTrusted, at: performance.now(), hidden: document.hidden, focused: document.hasFocus() });
  for (const name of ['blur', 'focus']) window.addEventListener(name, observe);
  for (const name of ['visibilitychange', 'keydown']) document.addEventListener(name, observe, true);
});
const snapshot = async () => page.evaluate(async () => {
  const g = window.__game, haven = g.scene.getScene('PurificationScene'), rift = g.scene.getScene('RiftScene');
  const saved = JSON.parse(localStorage.getItem('coh-save-v1') ?? 'null');
  const runningRift = rift && (rift.scene.isActive() || rift.scene.isPaused());
  let combat = null; try { combat = runningRift && rift.combat?.exportRuntimeState(); } catch {}
  return { at: performance.now(), hidden: document.hidden, focused: document.hasFocus(),
    haven: { active: haven.scene.isActive(), paused: haven.scene.isPaused(), preparing: !!haven.departureAbort },
    rift: { active: rift.scene.isActive(), paused: rift.scene.isPaused(), pendingFocus: rift.focusPauseRequested,
      fence: !!rift.nativeEntryFence?.isActive(), staging: !!rift.stagedEntry?.isActive(), position: runningRift && rift.player ? { ...rift.player.getPosition() } : null,
      inputVector: runningRift && rift.player ? { ...rift.player.exportRuntimeState().inputVector } : null,
      bodyPosition: runningRift && rift.player ? { ...rift.player.exportRuntimeState().bodyPosition } : null,
      physicsElapsed: runningRift ? rift.physics.world._elapsed : null,
      runtimeElapsed: runningRift ? rift.devElapsedMs : null,
      combat: combat && { health: combat.health, phase: combat.phase, attackSequence: combat.attackSequence, bufferedMs: combat.bufferedMs } },
    menu: !!document.querySelector('.pause-menu-panel'), menuCount: document.querySelectorAll('.pause-menu-panel').length,
    oldOverlay: document.querySelectorAll('#pause-overlay').length, inventory: !!document.querySelector('#inventory-panel'), offering: !!document.querySelector('#defense-backdrop'),
    menuText: document.querySelector('.pause-menu-panel')?.innerText ?? null,
    saved: saved ? { raw: JSON.stringify(saved), run: saved.inventory?.run, checkpointSequence: saved.riftCheckpoint?.sequence, elapsedMs: saved.riftCheckpoint?.elapsedMs } : null,
    trace: window.__focusTrace,
  };
});
const compact = state => ({ ...state, saved: state.saved && { ...state.saved, raw: undefined } });
const startCase = async name => {
  const row = { name, status: 'running', before: compact(await snapshot()) }; report.cases.push(row); save(); return row;
};
const done = (row, detail = {}) => { Object.assign(row, detail, { status: 'pass' }); save(); console.log(`${row.name}: pass`); };
async function away(row, wait = 100) {
  const before = await snapshot();
  await alternate.bringToFront(); await page.waitForTimeout(wait);
  const lost = await snapshot();
  const events = lost.trace.slice(before.trace.length).filter(e => e.trusted && (e.type === 'blur' || e.type === 'visibilitychange' && e.hidden));
  assert(events.length > 0, 'Must observe trusted browser focus loss, never synthetic events');
  row.loss = compact(lost); row.trustedLossEvents = events; save(); return lost;
}
async function back() { await page.bringToFront(); await page.waitForTimeout(50); return snapshot(); }
async function expectRiftPause(row) {
  const lost = await away(row);
  assert(lost.rift.paused && lost.menu && lost.menuCount === 1, 'Rift loss must pause with one system menu');
  assert(!lost.inventory && !lost.oldOverlay, 'No inventory or redundant focus overlay over system menu');
  await page.waitForTimeout(350); const held = await snapshot();
  assert.deepEqual(held.rift.position, lost.rift.position); assert.deepEqual(held.rift.combat, lost.rift.combat);
  assert.equal(held.saved.raw, lost.saved.raw, 'Paused saved state must stay stable');
  const returned = await back(); assert(returned.rift.paused && returned.menu, 'Refocus must not auto-resume');
  row.held = compact(held); row.returned = compact(returned); return returned;
}
async function resume(key = 'Enter', allowExistingMomentum = false) {
  const before = await snapshot();
  await page.keyboard.press(key, { delay: 40 });
  await page.waitForFunction(() => window.__game.scene.isActive('RiftScene'));
  await page.waitForTimeout(100); const after = await snapshot();
  assert(!after.menu && !after.rift.paused);
  if (!allowExistingMomentum) assert.deepEqual(after.rift.position, before.rift.position, 'Resume key must not move a previously stationary player');
  assert.deepEqual(after.rift.inputVector, { x: 0, y: 0 }, 'Menu action must not leave a movement input held');
  assert.equal(after.rift.combat.attackSequence, before.rift.combat.attackSequence, 'Resume key must not start attack');
  return compact(after);
}
async function preparation() {
  await page.evaluate(() => window.__game.scene.getScene('PurificationScene').enterRift());
  await page.locator('[data-departure-grade="low"]').click();
  await page.locator('[data-prepare-action="next"]').click();
  await page.locator('[data-prepare-action="depart"]').waitFor();
}
try {
  report.browser = browser.version();
  await page.goto(base); await page.bringToFront();
  const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false });
  await page.waitForFunction(() => window.__game?.scene.getScene('MainMenuScene')?.interactive(), null, { timeout: 30000 });
  await page.keyboard.press('Enter', { delay: 60 });
  await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene')); await page.waitForTimeout(2200);
  {
    const row = await startCase('Haven idle focus loss'); const lost = await away(row);
    assert(lost.haven.active && !lost.haven.paused && !lost.menu && !lost.oldOverlay);
    const returned = await back(); assert(returned.haven.active && !returned.menu); done(row);
  }
  {
    await page.evaluate(() => window.__game.scene.getScene('PurificationScene').openDefensePanel());
    const row = await startCase('Haven offering stays open on focus loss'); assert(row.before.offering);
    const lost = await away(row); assert(lost.haven.active && !lost.menu && lost.offering);
    const returned = await back(); assert(returned.offering && !returned.menu);
    await page.screenshot({ path: path.join(out, 'haven-offering-return.png') });
    await page.keyboard.press('Escape'); await page.waitForTimeout(450); done(row);
  }
  {
    await preparation(); const row = await startCase('Haven preparation cancels on real focus loss'); const before = await snapshot();
    await page.keyboard.press('Shift+Enter', { delay: 10 });
    await page.waitForFunction(() => !!window.__game.scene.getScene('PurificationScene').departureAbort);
    await away(row);
    await page.waitForFunction(() => !window.__game.scene.getScene('PurificationScene').departureAbort, null, { timeout: 15000 });
    const cancelled = await snapshot(); assert(cancelled.haven.active && !cancelled.haven.paused && !cancelled.menu);
    assert.equal(cancelled.saved.raw, before.saved.raw, 'Cancelled preparation must preserve exact original save');
    assert(!cancelled.rift.active && !cancelled.rift.paused); await back();
    row.cancelled = compact(cancelled); done(row); await page.waitForTimeout(400);
  }
  await preparation();
  await page.keyboard.press('Shift+Enter', { delay: 60 });
  {
    await page.waitForFunction(() => window.__game.scene.getScene('RiftScene')?.stagedEntry?.isActive(), null, { polling: 10, timeout: 45000 });
    const row = await startCase('Rift focus loss during native staged entry');
    assert(row.before.rift.staging || row.before.rift.fence, 'Must actually reach an unfinished native entry');
    await away(row);
    await page.waitForFunction(() => window.__game.scene.isPaused('RiftScene'), null, { timeout: 45000 });
    const settled = await snapshot();
    assert(!settled.rift.fence && !settled.rift.staging && settled.menuCount === 1, 'First complete native frame finishes before focus menu');
    row.settled = compact(settled); await back(); row.resumed = await resume(); done(row);
  }
  await page.waitForFunction(() => {
    const s = window.__game?.scene.getScene('RiftScene');
    return s?.player && s.nativeWorldPresentation && !s.stagedEntry?.isActive() && !s.nativeEntryFence?.isActive() && s.scene.isActive();
  }, null, { timeout: 45000 });
  await page.waitForTimeout(300);
  {
    const row = await startCase('Rift idle focus loss and explicit Enter resume'); await expectRiftPause(row);
    await page.screenshot({ path: path.join(out, 'rift-system-menu-refocus.png') });
    row.resumed = await resume(); done(row);
  }
  {
    await page.waitForTimeout(250); await page.keyboard.press('Tab');
    const row = await startCase('Rift open inventory closes on focus loss'); assert(row.before.inventory);
    await expectRiftPause(row); row.resumed = await resume('Space'); done(row);
  }
  {
    await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(220);
    const row = await startCase('Rift focus loss within menu close debounce');
    await page.keyboard.press('Enter', { delay: 0 }); await expectRiftPause(row);
    const trace = row.loss.trace;
    const enter = [...trace].reverse().find(e => e.type === 'keydown' && e.key === 'Enter');
    const loss = row.trustedLossEvents.find(e => e.type === 'blur') ?? row.trustedLossEvents[0];
    row.closeToLossMs = loss.at - enter.at; assert(row.closeToLossMs >= 0 && row.closeToLossMs < 200, 'Race must actually occur inside 200ms debounce');
    row.resumed = await resume(); done(row);
  }
  {
    await page.waitForTimeout(250); await page.keyboard.press('Tab'); await page.keyboard.press('Escape', { delay: 0 });
    const row = await startCase('Rift recently closed inventory does not suppress focus pause');
    await expectRiftPause(row); const trace = row.loss.trace;
    const esc = [...trace].reverse().find(e => e.type === 'keydown' && e.key === 'Escape');
    const loss = row.trustedLossEvents.find(e => e.type === 'blur') ?? row.trustedLossEvents[0];
    row.closeToLossMs = loss.at - esc.at; assert(row.closeToLossMs >= 0 && row.closeToLossMs < 150);
    row.resumed = await resume(); done(row);
  }
  {
    await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(220);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    const row = await startCase('Repeated Rift focus loss preserves abandonment guard'); assert(row.before.menuText.includes('确认放弃'));
    const lost = await away(row); assert(lost.rift.paused && lost.menuCount === 1); assert.equal(lost.menuText, row.before.menuText);
    const returned = await back(); assert.equal(returned.menuText, row.before.menuText);
    await page.keyboard.press('Enter'); assert((await snapshot()).menuText.includes('合上，继续本趟'));
    row.resumed = await resume(); done(row);
  }
  {
    const row = await startCase('Quota failure on focus loss retries without a physical resume frame');
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.__focusOriginalSetItem = Storage.prototype.setItem;
      window.__focusResumeEvents = [];
      window.__game.scene.getScene('RiftScene').events.on('resume', () => window.__focusResumeEvents.push(performance.now()));
      Storage.prototype.setItem = function(key, value) {
        if (key === 'coh-save-v1') throw new DOMException('F037 isolated QA quota injection', 'QuotaExceededError');
        return window.__focusOriginalSetItem.call(this, key, value);
      };
    });
    await away(row); await page.keyboard.up('ArrowRight');
    await page.locator('#inventory-settlement-retry').waitFor();
    const blocked = await snapshot(); assert(blocked.rift.paused && !blocked.menu);
    await page.waitForTimeout(200); const held = await snapshot();
    assert.deepEqual(held.rift, blocked.rift, 'Quota retry gate freezes the complete physical state');
    await page.evaluate(() => { Storage.prototype.setItem = window.__focusOriginalSetItem; });
    await back(); await page.locator('#inventory-settlement-retry button').click();
    await page.waitForFunction(() => !!document.querySelector('.pause-menu-panel'));
    const retried = await snapshot();
    assert(retried.rift.paused && retried.menuCount === 1);
    assert.deepEqual(retried.rift.position, blocked.rift.position);
    assert.deepEqual(retried.rift.bodyPosition, blocked.rift.bodyPosition);
    assert.equal(retried.rift.physicsElapsed, blocked.rift.physicsElapsed);
    assert.equal(retried.rift.runtimeElapsed, blocked.rift.runtimeElapsed);
    assert.deepEqual(await page.evaluate(() => window.__focusResumeEvents), [], 'Successful retry must not emit scene resume before system menu');
    row.blocked = compact(blocked); row.retried = compact(retried); row.resumed = await resume('Enter', true); done(row, { note: 'Already-moving velocity may decelerate only after the explicit resume; retry itself emitted no resume or physics advance.' });
  }
  {
    await page.waitForTimeout(250); await page.keyboard.press('Escape'); await page.waitForTimeout(220);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    // Explicit user-equivalent abandonment creates the ordinary result screen.
    await page.waitForTimeout(1000);
    const row = await startCase('Rift scene shutdown clears focus listeners');
    if (!row.before.haven.active) {
      const text = await page.locator('body').innerText(); row.transitionText = text;
      await page.keyboard.press('r');
    }
    await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene'), null, { timeout: 15000 });
    await page.waitForTimeout(1200); const lost = await away(row); assert(lost.haven.active && !lost.menu && !lost.rift.paused);
    await back(); done(row);
  }
  assert.deepEqual(report.errors, []); report.status = 'passed';

} catch (error) {
  report.status = 'failed'; report.failure = String(error.stack ?? error); process.exitCode = 1;
  try { report.failureState = compact(await snapshot()); await page.screenshot({ path: path.join(out, 'failure.png') }); } catch {}
} finally {
  report.finishedAt = new Date().toISOString();
  report.sourcesUnchanged = Object.entries(report.sourceHashes).every(([file, hash]) => hash === createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
  if (!report.sourcesUnchanged) { report.status = 'source-changed-during-run'; process.exitCode = 1; }
  save(); await browser.close(); console.log(JSON.stringify({ status: report.status, cases: report.cases.map(({ name, status }) => ({ name, status })), out, failure: report.failure }));
}
