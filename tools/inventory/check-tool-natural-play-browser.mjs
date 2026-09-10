/** Natural-play follow-up: after entering the arena only real keys and read-only observations. */
import assert from 'node:assert/strict';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const artifacts = process.env.ARTIFACT_DIR ?? 'docs/qa/artifacts/iteration-20-followup-qa';
await mkdir(artifacts, { recursive: true });
const base = (process.env.GAME_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const observations = { method: 'Production lab URL setup, then keyboard only; no teleports, skill calls, fake LOS, manual update or clock advances.', scenarios: {} };
const context = await browser.newContext({ viewport: { width: 1440, height: 960 },
  recordVideo: { dir: artifacts, size: { width: 1080, height: 720 } } });
await context.addInitScript(() => localStorage.setItem('coh-save-v1', 'natural-play-sentinel'));
const page = await context.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
const held = new Set();
async function release() { for (const key of held) await page.keyboard.up(key); held.clear(); }
async function observe() {
  return page.evaluate(() => {
    const s = window.__combatLab.game.scene.getScene('CombatLabScene');
    const player = { ...s.player.getPosition() };
    const enemy = s.ai.getEnemies()[0];
    const p = enemy?.getPosition();
    const marks = s.tools.retrogradeMarks.map(mark => ({ position: { ...mark.position }, remainingMs: mark.remainingMs, hasEcho: !!mark.echo }));
    return { time: s.time.now, player, facing: s.player.getFacingAngle(), uses: s.tools.getSlotUses(2), qUses: s.tools.getSlotUses(0),
      enemy: enemy ? { id: enemy.getId(), position: { ...p }, state: enemy.getState(),
        los: s.tools.hasTargetLineOfSight(player, p), lure: enemy.isTargetingLure?.() ?? false } : null,
      marks, trackingCount: s.tools.trackingEpisodes.size,
      inputAllowed: s.toolInputAllowed, phase: s.tools.expandEffect?.phase ?? null,
      effects: s.tools.getActiveTimedEffects(), bodyEnabled: s.player.getSprite().body.enable,
      body: { x: s.player.getSprite().body.center.x, y: s.player.getSprite().body.center.y },
      textures: Object.keys(s.textures.list).filter(key => key.startsWith('tool-body-')),
      message: document.querySelector('#message')?.textContent ?? '',
      error: document.querySelector('#error')?.textContent ?? '' };
  });
}
async function load(query) {
  await release();
  await page.goto(`${base}/combat-lab.html?auto-reset=0&protected=1&tool-quality=ordinary&${query}`);
  await page.waitForFunction(() => window.__combatLab?.getState().ready);
  await page.locator('#game-container canvas').click();
}
async function walk(key, axis, target, trace, timeoutMs = 8000, tolerance = 1.5) {
  await release();
  const start = await observe(), sign = target >= start.player[axis] ? 1 : -1;
  await page.keyboard.down(key); held.add(key);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(40);
    const sample = await observe(); trace.push(sample);
    if ((sample.player[axis] - target) * sign >= -tolerance) { await release(); return sample; }
  }
  await release(); throw new Error(`Walking ${key} could not reach ${axis}=${target}: ${JSON.stringify(await observe())}`);
}
try {
  if (process.env.ONLY !== 'expand') {
    await load('exercise=duel&tool-passive=retrograde');
    const trace = [await observe()];
    observations.scenarios.retrograde = { trace };
    await walk('d', 'x', 410, trace);
    await page.waitForFunction(() => window.__combatLab.game.scene.getScene('CombatLabScene').ai.getEnemies()[0]?.getState() === 'chase', null, { timeout: 12000 });
    const chasing = await observe(); trace.push(chasing);
    assert(chasing.enemy.los && !chasing.enemy.lure); assert.equal(chasing.uses, 5);
    await page.screenshot({ path: path.join(artifacts, 'retrograde-01-natural-chase.png') });
    await walk('a', 'x', 334, trace);
    await walk('w', 'y', 120, trace);
    await walk('a', 'x', 216, trace);
    await walk('s', 'y', 210, trace);
    const firstLoss = trace.find(sample => sample.marks.length > 0);
    assert(firstLoss, 'Walking around the real cover must naturally produce a memory');
    assert.equal(firstLoss.enemy.los, false, 'memory starts at a real occluding wall');
    assert.equal(firstLoss.uses, 4); assert(firstLoss.marks[0].hasEcho);
    const active = await observe(); trace.push(active);
    assert(active.marks.length > 0, 'memory remains long enough to read after rounding the cover');
    assert.deepEqual(active.marks[0].position, firstLoss.marks[0].position, 'real moving enemy must not drag its stale memory');
    assert(active.textures.length >= 3);
    await page.screenshot({ path: path.join(artifacts, 'retrograde-02-natural-loss-memory.png') });
    await page.waitForFunction(() => window.__combatLab.game.scene.getScene('CombatLabScene').tools.retrogradeMarks.length === 0, null, { timeout: 7500 });
    const expired = await observe(); trace.push(expired);
    assert.equal(expired.uses, 4);
    await page.screenshot({ path: path.join(artifacts, 'retrograde-03-natural-expiry.png') });
    observations.scenarios.retrograde = { chasing, firstLoss, active, expired, trace };
    console.log('PASS natural AI chase -> WASD around real cover -> real LOS loss -> fixed body memory -> real-clock expiry');
  }
  if (process.env.ONLY !== 'retrograde') {
    await load('exercise=empty&tool-q=expand');
    const trace = [await observe()];
    observations.scenarios.expand = { trace };
    await walk('w', 'y', 118, trace);
    await walk('a', 'x', 100, trace);
    await walk('s', 'y', 210, trace, 8000, 0); // Restore the original route: the body straddles two same-face wall tiles.
    await page.keyboard.down('d'); held.add('d');
    await page.waitForTimeout(450); await release();
    const before = await observe(); trace.push(before);
    assert(before.body.x <= 118.01 && before.body.x >= 110, 'walking into the real thin wall stops the body on its left face');
    assert(before.body.y - 10 < 224 && before.body.y + 10 > 224, 'the full body crosses the row-6/7 tile seam, without adding wall thickness');
    assert(Math.abs(before.facing) < .05, 'actual D input establishes the direction');
    await page.screenshot({ path: path.join(artifacts, 'expand-01-walked-to-thin-wall.png') });
    await page.keyboard.press('q', { delay: 60 });
    const crossed = await observe(); trace.push(crossed);
    assert(crossed.body.x >= 170 && crossed.body.x - before.body.x >= 50, 'actual Q crosses the complete one-cell wall with the full body');
    assert.equal(crossed.qUses, before.qUses - 1); assert(crossed.bodyEnabled);
    assert.equal(crossed.inputAllowed, false); assert.equal(crossed.phase, 'stiffness');
    assert(crossed.effects.some(effect => effect.type === 'expand' && effect.remainingMs > 0), 'rematerialization state is disclosed');
    await page.keyboard.down('d'); held.add('d');
    await page.waitForTimeout(350);
    const heldDuring = await observe(); trace.push(heldDuring);
    assert.equal(heldDuring.inputAllowed, false);
    assert(Math.hypot(heldDuring.body.x - crossed.body.x, heldDuring.body.y - crossed.body.y) < .01, 'held movement does not bypass rematerialization');
    await page.screenshot({ path: path.join(artifacts, 'expand-02-actual-Q-rematerialization.png') });
    await page.waitForFunction(() => window.__combatLab.game.scene.getScene('CombatLabScene').toolInputAllowed, null, { timeout: 2200 });
    await release();
    await walk('d', 'x', crossed.body.x + 24, trace);
    const recovered = await observe(); trace.push(recovered);
    assert.equal(recovered.phase, null); assert.equal(recovered.qUses, crossed.qUses); assert(recovered.bodyEnabled);
    await page.screenshot({ path: path.join(artifacts, 'expand-03-real-clock-input-recovery.png') });
    observations.scenarios.expand = { before, crossed, heldDuring, recovered, trace };
    console.log('PASS WASD to the real thin wall -> actual Q full-body crossing -> held key blocked for rematerialization -> real-clock movement recovery');
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), 'natural-play-sentinel');
  assert.deepEqual(errors, []);
} finally {
  await release().catch(() => {});
  observations.errors = errors;
  const recordedVideo = await page.video().path();
  observations.video = 'natural-play.webm';
  await context.close();
  await rename(recordedVideo, path.join(artifacts, observations.video));
  await writeFile(path.join(artifacts, 'natural-play-observations.json'), JSON.stringify(observations, null, 2));
  await browser.close();
}
