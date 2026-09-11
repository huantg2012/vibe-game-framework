/** R4: isolated browser + actual input + read-only probes; no simulation control. */
import assert from 'node:assert/strict';
import { mkdir, writeFile, rename, access } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const mode = process.env.CASE ?? 'functional-stage';
assert(/^(functional|death|visual|windows|tail|terminal|look|gpu|smoke)-(stage|vista)$/.test(mode), 'CASE must be functional/death/visual/windows/tail/terminal/look/gpu/smoke-stage/vista');
const view = mode.endsWith('-stage') ? 'stage' : 'vista';
const runId = process.env.RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.join(process.env.ARTIFACT_DIR ?? 'docs/qa/artifacts/iteration-21-spatial/r4-pixel-polish', `${mode}-${runId}`);
await mkdir(dir, { recursive: true });
// Preserve failed routes and earlier source revisions instead of overwriting them.
await assert.rejects(access(path.join(dir, 'evidence.json')));
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir, size: { width: 1080, height: 720 } } });
assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
const page = await context.newPage(), held = new Set();
const evidence = { mode, runId, method: 'New empty context; real keyboard held across simulation frames; natural clock; only read-only game probes. No teleport, AI/HP/phase manipulation.',
  observations: [], checks: [], errors: [], consoleErrors: [], consoleErrorLocations: [], navigation: [], resourceFailures: [], devUpdates: [], visualVerdict: 'NOT-REVIEWED: successful scripted inputs do not approve the presentation.' };
page.on('pageerror', error => evidence.errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') { evidence.consoleErrors.push(message.text()); evidence.consoleErrorLocations.push({ text: message.text(), location: message.location() }); }
  if (/\[vite\]/.test(message.text())) evidence.devUpdates.push({ time: Date.now(), text: message.text() });
});
page.on('framenavigated', frame => { if (frame === page.mainFrame()) evidence.navigation.push({ time: Date.now(), url: frame.url() }); });
page.on('response', response => { if (response.status() >= 400) evidence.resourceFailures.push({ url: response.url(), status: response.status() }); });
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3000';
const sentinelValue = `r4-qa-isolated-${runId}`;
async function observe(label) {
  const gpu = evidence.consoleErrors.find(message => /Shader Error|shader is not compiled|VALIDATE_STATUS false|CONTEXT_LOST_WEBGL/.test(message));
  if (gpu) throw Error(`GPU rendering blocker: ${gpu}`);
  const state = await page.evaluate(() => ({ ...window.__spatialSlices.getState(),
    presentationFrame: window.__spatialSlices.game.scene.getScene('RiftScene').probePresentationFrame() }));
  if (state.error) throw Error(`Application error: ${state.error}`);
  if (label) evidence.observations.push({ label, ...state });
  return state;
}
async function release() { for (const key of held) await page.keyboard.up(key); held.clear(); }
async function key(name, ms = 100) { held.add(name); await page.keyboard.down(name); try { await page.waitForTimeout(ms); } finally { await page.keyboard.up(name); held.delete(name); } }
async function until(predicate, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const state = await observe(); if (predicate(state)) return state; await page.waitForTimeout(45); }
  throw Error(`Timeout: ${label}; ${JSON.stringify((await observe()).snapshot)}`);
}
async function focusGame() { await page.locator('#game-container').click({ position: { x: 24, y: 24 } }); }
async function move(axis, target, timeout = 16000) {
  const start = await observe(); assert(start.running && !start.paused && !start.snapshot.ended, 'Must move in active simulation');
  if (Math.abs(start.snapshot.player[axis] - target) < 2) return;
  const sign = target > start.snapshot.player[axis] ? 1 : -1;
  const name = axis === 'x' ? sign > 0 ? 'd' : 'a' : sign > 0 ? 's' : 'w';
  held.add(name); await page.keyboard.down(name);
  try { await until(s => { if (s.snapshot.ended) throw Error('Run ended during actual walking'); return sign * (target - s.snapshot.player[axis]) <= 2; }, `${axis}=${target}`, timeout); }
  finally { await release(); }
}
async function cap(label) {
  await observe(label); await page.screenshot({ path: path.join(dir, `${label}.png`) });
  if (view === 'stage' && (await observe()).running) {
    const support = await page.evaluate(() => {
      const scene = window.__spatialSlices.game.scene.getScene('RiftScene'), runtime = scene.devRuntime, p = runtime.presentation;
      if (!p.player || !p.enemies) return null; // A lifecycle check may have switched presentation.
      const frame = scene.probePresentationFrame(), floor = (x, y) => runtime.world.groundHeightAt(x, y);
      const model = p.player.snapshot();
      return { player: { hp: frame.player.hp, xy: frame.player.position, origin: model.origin, expectedGround: floor(frame.player.position.x, frame.player.position.y),
        footClearance: model.feet.map(v => v[1] - floor(v[0], v[2])), rendering: model.rendering },
        enemies: [...p.enemies].filter(([,m]) => m.root.visible).map(([id,m]) => ({ id, origin: m.root.position.toArray(),
          expectedGround: floor(m.root.position.x,m.root.position.z), footClearance: m.snapshot().feet.map(v=>v[1]-floor(v[0],v[2])) })),
        loot: [...p.loot.snapshot().piles,...p.loot.snapshot().items].filter(v=>v.visible).map(v=>({id:v.id, origin:v.position, expectedGround:floor(v.position[0],v.position[2])})) };
    });
    if (support) {
      assert(Math.abs(support.player.origin[0] - support.player.xy.x) < .001 && Math.abs(support.player.origin[2] - support.player.xy.y) < .001, 'Rendering preserves formal XY');
      assert(Math.abs(support.player.origin[1] - support.player.expectedGround) < .001, 'Actual player is supported by the authoritative mesh field');
      if (support.player.hp > 0) assert(support.player.footClearance.every(h=>h>=1.49 && h<=4.51), 'Live feet use local slope support');
      for (const object of [...support.enemies,...support.loot]) assert(Math.abs(object.origin[1]-object.expectedGround)<.001, 'Visible objects use the shared support surface');
      (evidence.groundSupportChecks ??= []).push({ label, ...support });
    }
  }
  evidence.checkpointRecords = await records(); evidence.checkpointFrameTimes = await page.evaluate(() => window.__qaFrames ?? []);
}
async function sentinel(label) { assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), sentinelValue); evidence.checks.push(`Official SAVE unchanged: ${label}`); }
async function records() { return page.evaluate(() => window.__spatialSlices.getRecords()); }
async function search(label) {
  const before = (await observe()).snapshot.search.remaining;
  await key('e', 1850);
  await until(s => s.snapshot.search.remaining < before, `actual completed search ${label}`, 2000);
  await cap(label);
}
async function fight() {
  // Follow the actual nearby enemy using movement direction; Space uses production swing timing.
  // This route approaches on the open NE floor, never across the central VOID.
  for (let n = 0; n < 16; n++) {
    const state = (await observe()).snapshot;
    if (!state.enemies.length) break;
    const enemy = state.enemies[0], dx = enemy.position.x - state.player.x, dy = enemy.position.y - state.player.y;
    const directions = [];
    if (Math.abs(dx) > Math.abs(dy) * .42) directions.push(dx > 0 ? 'd' : 'a');
    if (Math.abs(dy) > Math.abs(dx) * .42) directions.push(dy > 0 ? 's' : 'w');
    for (const k of directions) { held.add(k); await page.keyboard.down(k); }
    await page.waitForTimeout(Math.hypot(dx, dy) > 70 ? 320 : 85); await release();
    await key('Space', 110); await page.waitForTimeout(560);
  }
  assert.equal((await observe()).snapshot.enemies.length, 0, 'Production enemy must die from actual combat');
  const record = (await records())[0].gameplay;
  assert(record.events.some(e => e.event === 'enemy:damaged' && e.payload.amount > 0), 'Need committed enemy damage, not an animation alone');
  assert(Object.values(record.metrics.consumedUses).some(n => n > 0), 'Need actual weapon durability consumption');
  await cap('07-actual-combat');
}
async function checkMenus() {
  await key('Tab'); const before = (await observe()).snapshot.elapsedMs;
  await page.waitForTimeout(350); assert((await observe()).snapshot.elapsedMs > before + 150, 'Tab report must not pause');
  await cap('02-tab-live'); await key('Tab'); await page.waitForTimeout(250); // Production 150ms close-to-input guard.
  await key('Escape'); await until(s => s.paused, 'Esc pauses'); const paused = await observe();
  await page.waitForTimeout(350); const stillPaused = await observe(); assert.equal(stillPaused.snapshot.elapsedMs, paused.snapshot.elapsedMs);
  assert.deepEqual(stillPaused.spatial.presentation.fallingWater ?? stillPaused.spatial.presentation.sea?.flow,
    paused.spatial.presentation.fallingWater ?? paused.spatial.presentation.sea?.flow, 'Paused presentation flow does not use wall time');
  await sentinel('Esc pause'); await key('Escape'); await until(s => !s.paused, 'Esc resumes');
}
async function worldWindow(label) {
  await cap(`${label}-before`); const before = await observe();
  await page.waitForTimeout(8000);
  await cap(`${label}-after`); const after = await observe();
  assert(after.snapshot.elapsedMs - before.snapshot.elapsedMs >= 7800, 'Window observation uses advancing simulation time');
  assert(Math.hypot(after.snapshot.player.x - before.snapshot.player.x, after.snapshot.player.y - before.snapshot.player.y) < .5, 'Window observation stays at the actual stationary position');
  const read = s => ({ elapsedMs: s.snapshot.elapsedMs, player: s.snapshot.player,
    giantX: s.spatial.presentation.giantX ?? null, visibleVoidPixels: s.spatial.presentation.visibleVoidPixels ?? null,
    presentation: s.spatial.presentation });
  (evidence.worldWindows ??= []).push({ label, before: read(before), after: read(after),
    verdict: label.includes('central') ? 'R4: internal absence must remain unknowable; no giant, reflected world or upper water may appear. Actual pixels checked separately.' : 'Exterior scenery needs screenshot/video review; changing giant coordinates alone do not prove a readable distant body.' });
  if (view === 'vista' && label.includes('central')) await assertInternalAbsence();
}
async function assertInternalAbsence() {
  // Read the actual authored final mask and underlying rendered buffers, not the diagnostic constant.
  const actual = await page.evaluate(() => {
    const p = window.__spatialSlices.game.scene.getScene('RiftScene').devRuntime.presentation;
    const image = p.images.find(i => i.texture.key.endsWith('-unreachable-absence'));
    const canvas = image.texture.getSourceImage();
    const mask = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let total = 0, uncovered = 0, upperWater = 0, lowerWorld = 0;
    for (let i = 0; i < p.isAbsence.length; i++) if (p.isAbsence[i]) {
      total++; const at = i * 4;
      if (mask[at] !== 6 || mask[at + 1] !== 9 || mask[at + 2] !== 10 || mask[at + 3] !== 255) uncovered++;
      if (p.pixels.data[at + 3] !== 0) upperWater++;
      if (p.abyssPixels.data[at + 3] !== 0) lowerWorld++;
    }
    return { total, uncovered, upperWater, lowerWorld, maskDepth: image.depth, visible: image.visible };
  });
  assert(actual.total > 1000 && actual.visible, 'Real internal-absence mask must exist');
  assert.equal(actual.uncovered, 0); assert.equal(actual.upperWater, 0); assert.equal(actual.lowerWorld, 0);
  (evidence.internalAbsenceChecks ??= []).push(actual);
}
async function eastApproach() {
  // Bottom floor ends at x832; turn north before moving farther east.
  await move('x', 800); await move('y', 688); await move('x', 880); await move('y', 624);
  // Observe the geographical east edge before turning toward the water on the west.
  await key('d', 200);
  if (mode.startsWith('smoke')) await cap('03-east-boundary'); else await worldWindow('03-east-boundary-window');
  await key('a', 220);
  const facing = (await observe()).presentationFrame.player.facing;
  assert(Math.abs(Math.atan2(Math.sin(facing - Math.PI), Math.cos(facing - Math.PI))) < .15, 'Face west toward water before visual observation');
  await until(s => s.spatial.water.active, 'observe active irregular water from dry east side'); await cap('03-active-water-from-dry-ground');
  assert.equal((await observe()).spatial.water.inside, false);
  // Stay dry and keep the complete feed/head/contact/cutoff/tail cycle at natural speed.
  const cycleBefore = await observe(); await page.waitForTimeout(10500); await cap('03-complete-falling-cycle');
  const cycleAfter = await observe(); assert.equal(cycleAfter.spatial.water.committedHits, cycleBefore.spatial.water.committedHits);
  evidence.checks.push('Observed one complete natural-speed water cycle from dry ground; perceived falling still requires video review');
  await move('x', 880);
}
async function functional() {
  await checkMenus(); await eastApproach();
  await move('x', 864); // Stay inside the narrowing eastern floor with real 20px body clearance.
  const before = (await observe()).spatial.water.committedHits;
  await move('y', 464); assert.equal((await observe()).spatial.water.committedHits, before, 'East alternative must avoid water');
  await cap('04-dry-alternative');
  // Return to a safe approach and wait for quiet before genuinely crossing the same hazard.
  await move('y', 640); await until(s => s.spatial.water.phase === 'quiet', 'wait for safe crossing window');
  await move('x', 784); await move('y', 464);
  assert.equal((await observe()).spatial.water.committedHits, before, 'Observed quiet window must permit actual crossing');
  await cap('04-safe-window-crossing');
  await move('x', 784); await search('04-east-search');
  await move('y', 320); await cap('05-north-approach');
  await until(s => s.spatial.targets.some(t => t.visibility > 0), 'legally visible nearby enemy', 3000);
  await cap('06-visible-enemy'); await fight();
  await move('y', 272); await move('x', 272); await search('08-west-search');
  // Test actual collision from the safe west lip of the central VOID (col11 starts x352).
  await move('y', 400); await move('x', 332); await key('d', 650); await cap('09-real-void-collision');
  assert((await observe()).snapshot.player.x <= 342.5, 'Player center must stop one half-body before the true VOID');
  await worldWindow('09-central-void-window');
  await move('x', 272); await move('y', 688); await move('x', 496); await move('y', 752);
  await key('e', 1750); await until(s => s.inventory.run?.status === 'settled', 'actual extraction settlement', 5000);
  await page.waitForFunction(() => window.__spatialSlices.getRecords().some(r => r.gameplay.outcome === 'extract'), null, { timeout: 5000 });
  const final = await observe(); assert.equal(final.inventory.run.outcome, 'extract'); assert(final.inventory.run.returnedIds.length > 0);
  await cap('90-real-return'); await sentinel('actual carried loot settlement');
}
async function death() {
  await move('x', 800); await move('y', 688); await move('x', 784); await move('y', 592);
  await until(s => s.spatial.water.committedHits > 0, 'real irregular water damage'); await cap('03-real-water-damage');
  await until(s => s.snapshot.ended, 'actual natural water death', 55000);
  await page.waitForFunction(() => window.__spatialSlices.getRecords().some(r => r.gameplay.outcome === 'death'), null, { timeout: 5000 });
  await cap('90-real-water-death'); const s = await observe(); assert.equal(s.inventory.run.outcome, 'death'); assert.equal(s.inventory.items.length, 0);
  const record = (await records())[0], waterHits = record.gameplay.events.filter(e => e.event === 'player:damaged' && e.payload.source === 'environment:split-water-tongue');
  assert.equal(record.space.at(-1).water.committedHits, waterHits.length, 'Include the lethal committed hit in archived record');
  const last = s.spatial.water.committedHits; await page.waitForTimeout(1200); assert.equal((await observe()).spatial.water.committedHits, last, 'No hits after ended');
  await sentinel('actual death');
}
async function stageTail() {
  assert.equal(view, 'stage');
  // Revisit real nearby ground, then approach the former 06 enemy-view location without a second full search/combat run.
  await move('x', 800); await move('y', 688); await move('x', 880); await move('y', 624);
  await key('a', 220); await cap('03-near-water-terrain');
  await move('x', 864); await move('y', 336); await move('x', 784); await key('w', 200); await cap('06-enemy-nearby-terrain');
  await move('x', 864); await move('y', 640); await key('w', 200); await cap('07-known-ground-return');
  await key('Escape'); await until(s => s.paused, 'pause before terminal animation');
  const pauseBefore = await observe(); await page.waitForTimeout(400); const pauseAfter = await observe();
  assert.equal(pauseAfter.snapshot.elapsedMs, pauseBefore.snapshot.elapsedMs);
  assert.equal(pauseAfter.spatial.presentation.endTailMs, pauseBefore.spatial.presentation.endTailMs);
  evidence.checks.push('Pre-death scene pause freezes world and current endTailMs; active post-death pause is not exposed by this UI.');
  await key('Escape'); await until(s => !s.paused, 'resume before natural death');
  // Normal UI restart isolates terminal-animation observation from the pursuer attracted by the terrain visit.
  await page.locator('#abort').click(); await until(s => !s.running, 'end short terrain observation');
  await page.locator('#start').click(); await until(s => s.running && s.snapshot?.elapsedMs > 100, 'fresh normal run for terminal animation'); await focusGame();
  await move('x', 800); await move('y', 688);
  await move('x', 784); await move('y', 592);
  await terminalSamples();
}
async function terminalSamples() {
  const first = await until(s => s.snapshot.ended, 'real death for bounded tail', 55000);
  const observedAt = Date.now(); evidence.tailObservations = [];
  for (const requestedMs of [0, 500, 1200]) {
    await page.waitForTimeout(Math.max(0, requestedMs - (Date.now() - observedAt)));
    const state = await observe(), observedAfterFirstEndedMs = Date.now() - observedAt;
    // Only return lightweight evidence. Sending the whole ledger here can delay the next 500ms sample.
    const observed = await page.evaluate(() => {
      const lab = window.__spatialSlices, model = lab.game.scene.getScene('RiftScene').devRuntime.presentation.player;
      const pixels = model.copyPixels(); let hash = 2166136261, opaque = 0;
      for (let i = 0; i < pixels.length; i++) { hash = Math.imul(hash ^ pixels[i], 16777619); if (i % 4 === 3 && pixels[i]) opaque++; }
      return { pose: { visible: model.root.visible, pixelHash: hash >>> 0, opaque, rendering: model.snapshot().rendering },
        records: lab.getRecords().map(r => ({ outcome: r.gameplay.outcome, finalSampleElapsedMs: r.gameplay.samples.at(-1)?.elapsedMs,
          finalSpaceElapsedMs: r.space.at(-1)?.elapsedMs, finalWater: r.space.at(-1)?.water,
          sampleCount: r.gameplay.samples.length, eventCount: r.gameplay.events.length })) };
    });
    evidence.tailObservations.push({ requestedMs, observedAfterFirstEndedMs, state, ...observed });
    assert.equal(state.snapshot.elapsedMs, first.snapshot.elapsedMs); assert.equal(state.spatial.elapsedMs, first.spatial.elapsedMs);
    assert.deepEqual(state.spatial.water, first.spatial.water, 'Water frame/contact counters frozen after actual end');
    evidence.observations.push({ label: `90-tail-${requestedMs}ms`, ...state });
    await page.screenshot({ path: path.join(dir, `90-tail-${requestedMs}ms.png`) });
  }
  const tails = evidence.tailObservations;
  assert(tails[1].state.spatial.presentation.endTailMs > tails[0].state.spatial.presentation.endTailMs);
  assert.equal(tails[2].state.spatial.presentation.endTailMs, 1000);
  assert(tails[0].pose.visible && tails[1].pose.visible && !tails[2].pose.visible, 'Real model finishes its bounded death motion then hides');
  assert.equal(tails[0].pose.rendering, 'authored-pixel-card');
  assert.notEqual(tails[1].pose.pixelHash, tails[0].pose.pixelHash, 'Actual pixel drawing changes during death; this is not an unobstructed visual approval');
  assert.deepEqual(tails[2].records.map(r => [r.finalSampleElapsedMs, r.finalSpaceElapsedMs]),
    tails[1].records.map(r => [r.finalSampleElapsedMs, r.finalSpaceElapsedMs]), 'Gameplay/space clocks freeze while normal delayed settlement may finish its ledger');
  assert.equal(tails[2].records.at(-1).outcome, 'death', 'Normal settlement must finish without advancing the frozen world');
  assert.equal(tails[2].state.inventory.run.outcome, 'death'); await sentinel('bounded terminal animation');
}
async function lifecycle() {
  evidence.routeRecords = await records(); evidence.routeFrameTimes = await page.evaluate(() => window.__qaFrames ?? []);
  const signature = evidence.routeRecords[0].gameplay.metadata.fixtureSignature;
  await key('r'); await until(s => !s.running, 'R returns configuration', 4000); await sentinel('R return');
  await page.locator('#view').selectOption(view === 'stage' ? 'vista' : 'stage'); await page.locator('#start').click();
  await until(s => s.running && s.snapshot?.elapsedMs > 100, 'switch presentation');
  assert.equal((await observe()).spatial.fixture, signature); await sentinel('mode switch');
  await focusGame(); await checkMenus(); await page.locator('#abort').click(); await until(s => !s.running, 'abort'); await sentinel('abort');
  await page.locator('#start').click(); await until(s => s.running && s.snapshot?.elapsedMs > 100, 'restart'); await sentinel('restart');
  await page.reload(); await page.waitForFunction(() => window.__spatialSlices?.getState().snapshot?.elapsedMs > 100); await sentinel('refresh'); await cap('95-refreshed');
}
try {
  await page.goto(`${base}/spatial-slices.html?view=${view}&seed=7&autostart=0`);
  await page.waitForFunction(() => window.__spatialSlices?.getState().ready, null, { timeout: 30000 });
  await page.evaluate(value => { if (localStorage.getItem('coh-save-v1') !== null) throw Error('Refuse to overwrite existing save'); localStorage.setItem('coh-save-v1', value); }, sentinelValue);
  await page.locator('#start').click(); await until(s => s.running && s.snapshot?.elapsedMs > 100, 'production scene started'); await focusGame();
  await sentinel('start'); await cap('01-spawn');
  assert((await observe()).spatial.targets.every(t => t.visibility === 0), 'Unknown distant enemy remains hidden at spawn');
  await page.evaluate(() => { window.__qaFrames = []; let last; const collect = t => { if (last !== undefined && window.__qaFrames.length < 18000) window.__qaFrames.push(t - last); last = t; requestAnimationFrame(collect); }; requestAnimationFrame(collect); });
  if (mode.startsWith('functional')) await functional();
  else if (mode.startsWith('smoke')) { await eastApproach(); await page.locator('#abort').click(); await sentinel('bounded refinement GPU smoke'); }
  else if (mode.startsWith('tail')) await stageTail();
  else if (mode.startsWith('terminal')) {
    assert.equal(view, 'stage'); await move('x', 800); await move('y', 688); await move('x', 784); await move('y', 592); await terminalSamples();
  }
  else if (mode.startsWith('death')) { await death(); await lifecycle(); }
  else if (mode.startsWith('look') || mode.startsWith('gpu')) {
    await eastApproach();
    if (view === 'stage') {
      await move('x', 864); await move('y', 336); await move('x', 784); await key('w', 220); await cap('06-enemy-and-slope');
      if (!mode.startsWith('gpu')) { await move('x', 864); await move('y', 688); }
    } else await move('y', 688);
    if (!mode.startsWith('gpu')) {
      await move('x', 272); await move('y', 400); await move('x', 332); await key('d', 650);
      assert((await observe()).snapshot.player.x <= 342.5); await worldWindow('09-central-void-window');
    }
    await page.locator('#abort').click(); await sentinel('R4 visual smoke abort');
  }
  else if (mode.startsWith('windows')) {
    await eastApproach(); await move('y', 688); await move('x', 272); await move('y', 400); await move('x', 332); await key('d', 650);
    assert((await observe()).snapshot.player.x <= 342.5); await worldWindow('09-central-void-window');
    await page.locator('#abort').click(); await sentinel('two-window visual observation abort');
  }
  else { await page.waitForTimeout(21500); await cap('02-normal-speed-two-cycles'); await eastApproach(); await page.locator('#abort').click(); await sentinel('visual observation abort'); }
  assert.deepEqual(evidence.errors, []);
  assert.equal(evidence.consoleErrors.filter(message => /Shader Error|shader is not compiled|VALIDATE_STATUS false|CONTEXT_LOST_WEBGL/.test(message)).length, 0, 'No GPU rendering failure hidden from pageerror');
  assert.deepEqual(evidence.resourceFailures.filter(r => !new URL(r.url).pathname.endsWith('/favicon.ico')), [], 'No missing game resources');
  evidence.inputChecksPassed = true;
  evidence.gpuChecksPassed = true;
} catch (error) { evidence.inputChecksPassed = false; evidence.failure = String(error.stack ?? error); console.error(evidence.failure); }
finally {
  await release().catch(() => {});
  evidence.lifecycleRecords = await records().catch(() => null); evidence.records = evidence.routeRecords ?? evidence.lifecycleRecords ?? evidence.checkpointRecords;
  const finalFrames = await page.evaluate(() => window.__qaFrames ?? []).catch(() => []);
  evidence.frameTimes = evidence.routeFrameTimes ?? (finalFrames.length ? finalFrames : evidence.checkpointFrameTimes ?? []);
  const frames = evidence.frameTimes.slice().sort((a, b) => a - b);
  evidence.performance = { count: frames.length, medianMs: frames[Math.floor(frames.length * .5)], p95Ms: frames[Math.floor(frames.length * .95)], maxMs: frames.at(-1), over50ms: frames.filter(x => x > 50).length, scope: 'This development host, headless Chrome, recording enabled; not representative device certification.' };
  await page.screenshot({ path: path.join(dir, '99-final.png') }).catch(() => {});
  await writeFile(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const video = page.video(); await context.close(); if (video) await rename(await video.path(), path.join(dir, 'continuous.webm')); await browser.close();
  console.log(JSON.stringify({ directory: dir, inputChecksPassed: evidence.inputChecksPassed, failure: evidence.failure, performance: evidence.performance }));
  if (!evidence.inputChecksPassed) process.exitCode = 1;
}
