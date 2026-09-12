/** Iteration 21 M. Isolated actual-input QA; reads production probes, never controls simulation state. */
import assert from 'node:assert/strict';
import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const testCase = process.env.CASE ?? 'bare';
assert(['bare', 'melee', 'light', 'lifecycle', 'composition', 'settlement'].includes(testCase), 'CASE must be bare/melee/light/lifecycle/composition/settlement');
const loadout = ['lifecycle', 'composition', 'settlement'].includes(testCase) ? 'melee' : testCase;
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3001';
const runId = process.env.RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
const dir = path.resolve(process.env.ARTIFACT_DIR ?? 'docs/qa/artifacts/iteration-21-gameplay', `${testCase}-${runId}`);
await mkdir(dir, { recursive: true });
await assert.rejects(access(path.join(dir, 'evidence.json')), 'A prior attempt must never be overwritten');
const sourceFiles = [
  'docs/tasks/iteration-21.md', 'src/dev/spatial-slices.ts', 'src/dev/spatial-study/slice-runtime.ts',
  'src/dev/spatial-study/slice-world.ts', 'src/dev/spatial-study/fixture.ts', 'src/dev/spatial-study/stage/camera.ts',
  'src/dev/spatial-study/stage/presentation.ts', 'src/dev/spatial-study/stage/actors.ts', 'src/dev/spatial-study/stage/sea.ts',
  'src/dev/spatial-study/stage/terrain.ts', 'src/dev/spatial-study/stage/ground-mesh.ts',
  'src/dev/spatial-study/stage/bridge.ts', 'src/dev/spatial-study/stage/support.ts', 'src/dev/spatial-study/stage/effects.ts',
  'src/systems/tool-presentation.ts', 'src/systems/tool-system.ts', 'src/systems/combat-system.ts',
  'src/scenes/rift-scene.ts', 'data/stage-gameplay-scenes.csv', 'data/stage-gameplay-placements.csv',
  'data/stage-gameplay-water.csv', 'data/build-lab-loadouts.csv', 'tools/spatial-study/qa-gameplay.mjs',
];
async function sourceSnapshot() {
  const files = [];
  for (const file of sourceFiles) {
    try { const bytes = await readFile(file); files.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }); }
    catch (error) { files.push({ file, error: String(error) }); }
  }
  return { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), files };
}
const evidence = { schema: 1, testCase, loadout, route: 'long', seed: 7, runId, sourceBefore: await sourceSnapshot(),
  method: 'Empty isolated Chrome context. Real keyboard/mouse, normal world clock. No teleport, protection, refill, enemy manipulation or fast-forward. Keys stop before probe serialization. Source and every failed attempt retained.',
  observations: [], checks: [], moves: [], errors: [], consoleErrors: [], resourcesFailed: [], devUpdates: [],
  userArtVerdict: 'NOT-REVIEWED: recorded real frames go to independent art review and the user; numerical checks do not certify beauty.' };
await writeFile(path.join(dir, 'source-start.json'), JSON.stringify(evidence.sourceBefore, null, 2));
let browser;
try { browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' }); }
catch (error) { evidence.passed = false; evidence.failureKind = 'environment-launch'; evidence.failure = String(error.stack ?? error); await writeFile(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2)); throw error; }
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, recordVideo: { dir, size: { width: 1080, height: 720 } } });
assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
const page = await context.newPage(), held = new Set();
const sentinelValue = `i21-M-${runId}`;
page.on('pageerror', error => evidence.errors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error') evidence.consoleErrors.push({ text: message.text(), location: message.location() });
  if (/\[vite\]/.test(message.text())) evidence.devUpdates.push({ at: Date.now(), text: message.text() });
});
page.on('response', response => { if (response.status() >= 400) evidence.resourcesFailed.push({ url: response.url(), status: response.status() }); });

async function release() { for (const key of held) await page.keyboard.up(key); held.clear(); }
async function press(name, ms = 85) {
  held.add(name); await page.keyboard.down(name);
  try { await page.waitForTimeout(ms); } finally { await page.keyboard.up(name); held.delete(name); }
}
async function read() {
  const result = await page.evaluate(() => {
    const lab = window.__spatialSlices;
    const scene = lab.game.scene.getScene('RiftScene');
    const running = lab.game.scene.isActive('RiftScene') || lab.game.scene.isPaused('RiftScene');
    return { running, paused: lab.game.scene.isPaused('RiftScene'),
      snapshot: running ? scene.probeBuildLabState() : null,
      frame: running ? scene.probePresentationFrame() : null,
      error: document.querySelector('#error')?.textContent ?? '' };
  });
  assert(!result.error, `Application error: ${result.error}`);
  return result;
}
async function until(predicate, name, timeout = 12000, step = 50) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const state = await read(); if (predicate(state)) return state; await page.waitForTimeout(step); }
  throw Error(`Timeout: ${name}; ${JSON.stringify(await read())}`);
}
async function focus() { await page.locator('#game-container').click({ position: { x: 18, y: 18 } }); }
async function move(axis, target, timeout = 40000) {
  const start = Date.now(); let pulses = 0;
  while (Date.now() - start < timeout) {
    assert.equal(held.size, 0, 'Probe reads may not leave movement held');
    const state = await read();
    assert(state.running && !state.paused && !state.snapshot.ended, 'Move requires a live scene');
    const diff = target - state.snapshot.player[axis];
    if (Math.abs(diff) <= 4) { evidence.moves.push({ axis, target, actual: state.snapshot.player[axis], elapsedMs: state.snapshot.elapsedMs, pulses }); return; }
    await press(axis === 'x' ? diff > 0 ? 'd' : 'a' : diff > 0 ? 's' : 'w', Math.max(24, Math.min(200, Math.abs(diff) * 3)));
    pulses++;
  }
  throw Error(`Real walking did not converge ${axis}=${target}; ${JSON.stringify((await read()).snapshot)}`);
}
async function waypoint(x, y, order = 'xy') { for (const axis of order) await move(axis, axis === 'x' ? x : y); }
async function cap(label) {
  await release();
  const state = await page.evaluate(() => ({ ...window.__spatialSlices.getState(),
    frame: window.__spatialSlices.game.scene.getScene('RiftScene').probePresentationFrame() }));
  evidence.observations.push({ label, ...state });
  if (state.spatial?.mode === 'stage') {
    const marks = await page.evaluate(() => {
      const scene = window.__spatialSlices.game.scene.getScene('RiftScene');
      const runtime = scene.devRuntime, effects = runtime?.presentation.effects;
      const points = effects?.copyGroundPoints() ?? [];
      let unsupported = 0, below = 0;
      for (let i = 0; i < points.length; i += 3) {
        if (!runtime.world.isFloor(points[i], points[i+2])) unsupported++;
        if (points[i+1] < runtime.world.groundHeightAt(points[i], points[i+2]) + .69) below++;
      }
      return { count: points.length / 3, unsupported, below, summary: effects?.snapshot() ?? null };
    });
    assert.equal(marks.unsupported, 0, 'Actual displayed tool marks must have ground support');
    assert.equal(marks.below, 0, 'Actual displayed tool marks remain above relief');
    (evidence.groundMarkChecks ??= []).push({ label, ...marks });
  }
  await page.screenshot({ path: path.join(dir, `${label}.png`) });
  console.log(`${testCase}: ${label} (${state.snapshot?.elapsedMs ?? 'stopped'} ms)`);
}
async function assertSave(label) {
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), sentinelValue);
  evidence.checks.push(`Official SAVE unchanged: ${label}`);
}
async function items() {
  return page.evaluate(() => window.__spatialSlices.getState().inventory.items.map(item => ({ id: item.id, kind: item.kind,
    type: item.kind === 'contaminant' ? item.contaminant.type : item.weapon.definitionId,
    uses: item.kind === 'contaminant' ? item.contaminant.usesRemaining : item.weapon.usesRemaining,
    location: item.location })));
}
async function recordSummary() {
  return page.evaluate(() => window.__spatialSlices.getRecords().map(row => ({ metadata: row.gameplay.metadata,
    outcome: row.gameplay.outcome, events: row.gameplay.events, metrics: row.gameplay.metrics,
    initialInventory: row.gameplay.initialInventory, finalInventory: row.gameplay.finalInventory,
    samplesCount: row.gameplay.samples.length, first: row.gameplay.samples[0], final: row.gameplay.samples.at(-1) })));
}
async function search(label) {
  const before = (await read()).snapshot.search.remaining;
  await press('e', 1850);
  await until(s => s.snapshot.search.remaining < before, `search completed ${label}`, 3000);
  await cap(label);
}
async function strikeEnemy(id) {
  for (let n = 0; n < 18; n++) {
    const state = await read(), enemy = state.snapshot.enemies.find(e => e.id === id);
    if (!enemy) return;
    const dx = enemy.position.x - state.snapshot.player.x, dy = enemy.position.y - state.snapshot.player.y;
    const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 'd' : 'a' : dy > 0 ? 's' : 'w';
    await press(direction, Math.hypot(dx, dy) > 65 ? 220 : 45);
    await press('Space', 100); await page.waitForTimeout(500);
  }
  assert(!(await read()).snapshot.enemies.some(e => e.id === id), `Actual attack must kill ${id}`);
}
async function menusAndPause() {
  await press('Tab'); const before = (await read()).snapshot.elapsedMs;
  await page.waitForTimeout(400); assert((await read()).snapshot.elapsedMs > before + 200, 'Report remains live');
  await cap('02-tab-live'); await press('Tab'); await page.waitForTimeout(250);
  await press('Escape'); await until(s => s.paused, 'Esc paused');
  const a = await page.evaluate(() => window.__spatialSlices.getState());
  await page.waitForTimeout(450);
  const b = await page.evaluate(() => window.__spatialSlices.getState());
  assert.equal(a.snapshot.elapsedMs, b.snapshot.elapsedMs, 'Paused simulation clock freezes');
  assert.deepEqual(a.spatial.presentation.camera, b.spatial.presentation.camera, 'Paused camera freezes');
  assert.deepEqual(a.spatial.presentation.effects, b.spatial.presentation.effects, 'Paused effects freeze');
  const frameA = (await read()).frame; await page.waitForTimeout(200); const frameB = (await read()).frame;
  assert.deepEqual(frameA.tools, frameB.tools, 'Actual tool clocks freeze during pause');
  await assertSave('pause'); await cap('02-esc-paused'); await press('Escape'); await until(s => !s.paused, 'Esc resumed');
}
async function turnPair(label, a = 'w', b = 's') {
  await press(a, 24); await cap(`${label}-look-${a}`);
  await press(b, 24); await cap(`${label}-look-${b}`);
}
async function edgeSwings(label, outward, inward) {
  for (const [name, direction] of [['out', outward], ['in', inward]]) {
    await press(direction, 24); await press('Space', 24);
    await until(s => ['active', 'recovery'].includes(s.frame.player.attack.phase), `${label} actual swing`, 2000, 15);
    await cap(`${label}-swing-${name}`); await page.waitForTimeout(550);
  }
}
async function westApproach() {
  await move('x', 272);
  if (testCase === 'bare') {
    await move('y', 640); await move('x', 110); await edgeSwings('02-west-boundary', 'a', 'd'); await move('x', 272);
  }
  await move('y', 272); await search('03-west-search');
  if (testCase === 'bare') {
    await turnPair('03-west-bank');
    await move('y', 112); await turnPair('03-north-outside');
  }
  await move('y', 208);
}
async function invalidSeam() {
  await waypoint(272, 500); await move('x', 338); await press('d', 160);
  const before = await items(); await press('q'); await page.waitForTimeout(120);
  assert.equal((await read()).frame.tools.seams.length, 0, 'VOID-crossing seam rejected');
  assert.deepEqual(await items(), before, 'Illegal complete line does not consume inventory');
  await cap('03-rejected-void-stitch'); await move('x', 272); await move('y', 208);
}
async function firstEncounter({ skill = false } = {}) {
  await move('x', 510);
  if (skill) {
    await press('d', 40); await press('q');
    await until(s => s.frame.tools.seams.length > 0, 'real seam committed'); await cap('04-stitch-deployed');
    // Step behind the line, so a melee enemy must cross it before reaching us.
    // An actual missed swing supplies normal audible combat stimulus.
    await move('x', 448); await press('d', 40); await press('Space', 100);
    await until(s => s.frame.enemies.some(e => e.restraint?.snared), 'enemy actually crosses deployed line', 12000);
    await cap('05-stitch-recipient');
    await until(s => !s.frame.enemies.some(e => e.restraint?.snared), 'snare naturally releases', 4000);
    await press('f'); await until(s => s.frame.tools.pressures.length > 0, 'real pressure committed');
    await until(s => s.frame.enemies.some(e => e.restraint?.pressure), 'real pressure recipient', 5000);
    await cap('06-pressure-recipient');
    await until(s => s.frame.tools.siphonRemainingMs > 0, 'positive real damage activates siphon', 8000);
    await cap('07-siphon-positive-hit');
    await move('x', 410);
    await until(s => s.frame.tools.pressures.length === 0 && s.frame.enemies.some(e => e.id === 'SS_listener' && !e.restraint?.pressure), 'pressure expires and living recipient recovers', 9000);
    await cap('08-pressure-released');
    await strikeEnemy('SS_listener');
  } else await strikeEnemy('SS_listener');
  assert(!(await read()).snapshot.enemies.some(e => e.id === 'SS_listener'));
  await cap('09-listener-killed');
  if (testCase === 'bare') await turnPair('09-north-bank');
}
async function fullLoop() {
  if (testCase === 'bare') { await menusAndPause(); await westApproach(); await firstEncounter(); }
  else { await invalidSeam(); await move('y', 272); await search('03-west-search'); await move('y', 208); await firstEncounter({ skill: true }); }
  await move('y', 208); await move('x', 1024); await cap('10-camera-middle');
  if (testCase === 'bare') await turnPair('10-middle-bank');
  await move('y', 208);
  await move('x', 1616); await search('11-far-search');
  await move('y', 430); await strikeEnemy('SS_watcher'); await cap('12-watcher-killed');
  if (testCase === 'bare') { await move('y', 640); await move('x', 1712); await edgeSwings('12-east-boundary', 'd', 'a'); }
  await move('x', 1616); await move('y', 912); await search('13-return-search');
  await move('y', 944); await move('x', 1392); await press('w', 150); await cap('14-water-from-safe-south');
  await move('y', 944); await move('x', 1008); await cap('15-return-camera');
  await move('x', 240); await press('e', 160); await until(s => s.snapshot.ended, 'real extraction', 6000);
  // RunController commits inventory before its normal settled-event delay.
  await page.waitForFunction(() => window.__spatialSlices.getRecords().some(r => r.gameplay.outcome === 'extract'), null, { timeout: 6000 });
  await cap('90-extraction'); await assertSave('full loop extraction');
  const summary = await recordSummary(), run = summary.at(-1);
  assert.equal(run.outcome, 'extract'); assert.equal(run.final.search.remaining, 0); assert.equal(run.final.enemies.length, 0);
  assert(run.events.filter(e => e.event === 'enemy:killed').length >= 2, 'Both real encounters killed');
  assert(run.finalInventory.run.returnedIds.length > 0, 'Real pickup return committed');
}
async function lightCase() {
  await westApproach(); await move('y', 272); await move('x', 656); await press('d', 60);
  await until(s => s.frame.tools.muffleEpisodeActive, 'natural hearing intercepted', 5000);
  await cap('04-muffle-hearing');
  await press('w', 24); await press('q', 24); await cap('05-kindling-throw');
  await until(s => s.frame.tools.soundLures.length > 0, 'real sound lure instance');
  await until(s => s.frame.enemies.some(e => e.targetingLure), 'actual enemy investigates sound lure', 4000);
  await cap('06-lure-recipient');
  await menusAndPause();
  await until(s => s.frame.tools.soundLures.length === 0, 'natural lure expiry', 9000);
  await cap('07-lure-finished'); await assertSave('light targeted route');
}
async function compositionCase() {
  await waypoint(272, 272); await turnPair('03-west-bank');
  await move('y', 112); await turnPair('03-north-outside'); await move('y', 208);
  await move('x', 510); await press('d', 24); await press('q'); await press('f');
  const visible = await until(s => s.frame.tools.seams.length > 0 && s.frame.tools.pressures.length > 0, 'actual material skills before composition');
  await cap('04-currently-visible-tools');
  await move('x', 480); await press('d', 24); await cap('04-pressure-offset');
  await move('x', 350); await press('a', 24);
  const hidden = await read();
  assert(hidden.frame.tools.seams.length > 0 && hidden.frame.tools.pressures.length > 0, 'Hidden skills remain alive, not silently expired');
  const hiddenGeometry = await page.evaluate(() => window.__spatialSlices.game.scene.getScene('RiftScene').devRuntime.presentation.effects.snapshot());
  assert.equal(hiddenGeometry.points, 0, 'Off-view still-alive skills submit no visible marks');
  evidence.observations.push({ label: '05-hidden-tools-proof', toolsBefore: visible.frame.tools, toolsAfter: hidden.frame.tools, hiddenGeometry });
  await cap('05-alive-tools-outside-sight');
  await move('x', 470); await press('d', 24);
  const returned = await read(); assert(returned.frame.tools.seams.length > 0, 'Returning before seam expiry');
  const marks = await page.evaluate(() => window.__spatialSlices.game.scene.getScene('RiftScene').devRuntime.presentation.effects.snapshot());
  assert(marks.points > 0, 'Current sight renders legal ground marks again');
  await cap('06-returned-sight-tools');
  // Walk around the live listener instead of deleting it for a picture.
  await move('y', 240); await move('x', 1024); await move('y', 208); await press('d', 24);
  await cap('10-camera-middle'); await turnPair('10-middle-bank');
  await assertSave('bounded sea/tool composition');
}
async function settlementCase() {
  await press('q'); await press('f');
  await until(s => s.frame.tools.seams.length > 0 && s.frame.tools.pressures.length > 0, 'live skills at extraction origin');
  await move('x', 269); await press('a', 24); await cap('80-pre-extract-active-tools');
  await press('e', 90); const first = await until(s => s.snapshot.ended, 'real extraction with active instances');
  assert(first.frame.tools.seams.length > 0 && first.frame.tools.pressures.length > 0, 'Skills still active at end, not expired');
  await page.waitForTimeout(1200); const after = await read();
  assert.equal(after.snapshot.elapsedMs, first.snapshot.elapsedMs, 'Ended world does not advance');
  assert.deepEqual(after.frame.tools, first.frame.tools, 'Ended ability clocks and remaining lifetimes freeze');
  await page.waitForFunction(() => window.__spatialSlices.getRecords().some(r => r.gameplay.outcome === 'extract'), null, { timeout: 6000 });
  evidence.observations.push({ label: '90-ended-ability-clock-proof', before: first.frame.tools, after1200ms: after.frame.tools });
  await cap('90-active-extraction-frozen'); await assertSave('real active-skill extraction');
}
async function lifecycle() {
  await page.locator('#abort').click(); await until(s => !s.running, 'normal abort');
  const cleared = await page.evaluate(() => ({ canvases: document.querySelectorAll('#game-container canvas').length,
    state: window.__spatialSlices.getState(), projector: window.__spatialSlices.game.scene.getScene('RiftScene').devWorldProjector ?? null }));
  assert.equal(cleared.state.spatial, null, 'Runtime released on abort');
  assert.equal(cleared.projector, null, 'Projector released on abort');
  evidence.observations.push({ label: '91-aborted-lifecycle', ...cleared }); await assertSave('abort');
  await page.locator('#route').selectOption('local'); await page.locator('#loadout').selectOption('bare');
  await page.locator('#view').selectOption('vista'); await page.locator('#start').click();
  await until(s => s.running && s.snapshot?.elapsedMs > 100, 'normal Vista local restart'); await focus();
  const vista = await read(); assert(vista.frame.tools.seams.length + vista.frame.tools.pressures.length + vista.frame.tools.soundLures.length === 0);
  assert.equal(vista.frame.tools.siphonRemainingMs, 0); assert.equal(vista.frame.tools.muffleEpisodeActive, false);
  await cap('92-vista-cleared'); await assertSave('Vista new route and bare loadout');
  await page.locator('#abort').click(); await until(s => !s.running, 'Vista abort');
  await page.locator('#view').selectOption('stage'); await page.locator('#route').selectOption('long'); await page.locator('#loadout').selectOption('bare');
  await page.locator('#start').click(); await until(s => s.running && s.snapshot?.elapsedMs > 100, 'Stage restart'); await focus();
  const stage = await read(); assert(stage.frame.tools.seams.length + stage.frame.tools.pressures.length + stage.frame.tools.soundLures.length === 0);
  assert.equal(stage.frame.tools.siphonRemainingMs, 0); assert.equal(stage.frame.tools.muffleEpisodeActive, false);
  await cap('93-stage-cleared'); await assertSave('Stage restart');
  await page.locator('#abort').click();
}
async function installSampler() {
  await page.evaluate(() => {
    // Diagnostic memory only: getters copy values, no game object is written.
    window.__qaM = { samples: [], frameTimes: [], sampleErrors: [], events: [], lastEvent: 0 };
    let lastFrame;
    const frames = now => {
      if (lastFrame !== undefined && window.__qaM.frameTimes.length < 72000) window.__qaM.frameTimes.push(now - lastFrame);
      lastFrame = now; requestAnimationFrame(frames);
    };
    requestAnimationFrame(frames);
    setInterval(() => {
      try {
        const lab = window.__spatialSlices, scene = lab?.game.scene.getScene('RiftScene');
        if (!scene || !lab.game.scene.isActive('RiftScene')) return;
        const frame = scene.probePresentationFrame(); if (!frame || window.__qaM.samples.length >= 25000) return;
        const runtime = scene.devRuntime, p = runtime?.presentation, cam = p?.camera;
        let camera = null;
        if (cam?.isOrthographicCamera) {
          const ground = runtime.world.groundHeightAt(frame.player.position.x, frame.player.position.y);
          const project = (x, h, y) => {
            const v = cam.position.clone().set(x, h, y).project(cam);
            return [(v.x + 1) * 480, (1 - v.y) * 320];
          };
          camera = { position: cam.position.toArray(), span: cam.right - cam.left, zoom: cam.zoom,
            foot: project(frame.player.position.x, ground, frame.player.position.y),
            head: project(frame.player.position.x, ground + 42, frame.player.position.y),
            ruler: project(frame.player.position.x + 32, ground, frame.player.position.y) };
        }
        const body = frame.player.body;
        const clear = (x, y) => runtime?.world.isFloor(x, y) ?? null;
        const c = .01;
        const physical = runtime ? { playerCentreFloor: clear(body.x + body.width / 2, body.y + body.height / 2),
          playerCornersFloor: [[body.x+c,body.y+c],[body.x+body.width-c,body.y+c],
            [body.x+c,body.y+body.height-c],[body.x+body.width-c,body.y+body.height-c]].map(([x,y]) => clear(x,y)) } : null;
        const tools = structuredClone(frame.tools);
        window.__qaM.samples.push({ elapsedMs: frame.elapsedMs, ended: frame.ended,
          player: { position: { ...frame.player.position }, velocity: { ...frame.player.velocity }, hp: frame.player.hp,
            durability: frame.player.durability, weaponId: frame.player.weaponId, displayedWeapon: frame.player.weaponDefinitionId,
            attack: { ...frame.player.attack } },
          tools, enemies: frame.enemies.map(e => ({ id: e.id, position: { ...e.position }, hp: e.hp, visibility: e.visibility,
            velocity: { ...e.velocity }, state: e.state, attack: { ...e.attack }, restraint: { ...e.restraint },
            motionSuppressed: e.motionSuppressed, targetingLure: e.targetingLure })), camera, physical,
          stageCanvas: !!document.querySelector('canvas[data-spatial-stage]') });
        for (const e of frame.events) if (e.sequence > window.__qaM.lastEvent) {
          window.__qaM.events.push(structuredClone(e)); window.__qaM.lastEvent = e.sequence;
        }
      } catch (error) { window.__qaM.sampleErrors.push(String(error)); }
    }, 50);
  });
}
function verifySamples(trace) {
  assert.deepEqual(trace.sampleErrors, [], 'Read-only trace sampler must be valid');
  const moving = trace.samples.filter(s => s.camera && !s.ended);
  assert(moving.length > (testCase === 'settlement' ? 5 : 20), 'Need actual multi-frame movement capture');
  const spans = moving.map(s => s.camera.span), scale = moving.map(s => s.camera.ruler[0] - s.camera.foot[0]);
  assert(spans.every(s => Math.abs(s - 1060) < .01), 'Long route keeps 1060 world-unit camera frame');
  assert(Math.max(...scale) - Math.min(...scale) < .001, 'World projection scale never shrinks');
  const clip = moving.filter(s => [...s.camera.foot, ...s.camera.head].some((v, i) => v < 0 || v > (i % 2 === 0 ? 960 : 640)));
  assert.equal(clip.length, 0, 'Player full height remains in the actual view');
  const floorSamples = moving.filter(s => s.physical);
  assert(floorSamples.every(s => s.physical.playerCentreFloor && s.physical.playerCornersFloor.every(Boolean)), 'Actual body sampled on legal ground');
  const phases = [...new Set(moving.map(s => s.player.attack.phase))];
  if (['bare', 'melee'].includes(testCase)) assert(['windup', 'active', 'recovery'].every(p => phases.includes(p)), 'Actual weapon has all swing phases');
  evidence.traceSummary = { samples: trace.samples.length, legalBodySamples: floorSamples.length,
    spans: [Math.min(...spans), Math.max(...spans)], scale: [Math.min(...scale), Math.max(...scale)], phases,
    cameraX: [Math.min(...moving.map(s => s.camera.position[0])), Math.max(...moving.map(s => s.camera.position[0]))],
    snaredSamples: moving.filter(s => s.enemies.some(e => e.restraint.snared)).length,
    pressureSamples: moving.filter(s => s.enemies.some(e => e.restraint.pressure)).length,
    lureSamples: moving.filter(s => s.enemies.some(e => e.targetingLure)).length,
    positiveSiphonSamples: moving.filter(s => s.tools.siphonRemainingMs > 0 && s.player.hp < 100).length,
    soundFlightSamples: moving.filter(s => s.tools.soundLures.some(l => l.elapsedMs < 160)).length,
    hearingInterceptSamples: moving.filter(s => s.tools.muffleEpisodeActive).length,
    note: '50ms sampled reads, not a proof of every simulation frame. Camera and pixel samples are not an art verdict.' };
  if (['bare', 'melee'].includes(testCase)) assert(evidence.traceSummary.cameraX[1] - evidence.traceSummary.cameraX[0] > 600, 'Camera must traverse the long route');
}
let trace;
try {
  await page.goto(`${base}/spatial-slices.html?view=stage&route=long&loadout=${loadout}&seed=7&autostart=0`);
  await page.waitForFunction(() => window.__spatialSlices?.getState().ready, null, { timeout: 30000 });
  await page.evaluate(value => { assertSentinelAbsent(); localStorage.setItem('coh-save-v1', value);
    function assertSentinelAbsent() { if (localStorage.getItem('coh-save-v1') !== null) throw Error('Refuse to overwrite save'); }
  }, sentinelValue);
  await page.locator('#start').click(); await until(s => s.running && s.snapshot?.elapsedMs > 100, 'production start'); await focus();
  await installSampler(); await assertSave('initial start'); await cap('01-spawn');
  assert.deepEqual((await read()).frame.tools.loadoutTypes.filter(Boolean).sort(),
    (loadout === 'bare' ? [] : loadout === 'melee' ? ['stitch', 'compress', 'siphon'] : ['kindle', 'muffle']).sort(), 'Chosen training build is actually equipped');
  if (testCase === 'bare' || testCase === 'melee') await fullLoop();
  else if (testCase === 'light') await lightCase();
  else if (testCase === 'composition') await compositionCase();
  else if (testCase === 'settlement') await settlementCase();
  else { await press('q'); await press('f'); await menusAndPause(); }
  trace = await page.evaluate(() => window.__qaM);
  verifySamples(trace);
  if (testCase === 'light' || testCase === 'lifecycle') await lifecycle();
  if (testCase === 'composition') await page.locator('#abort').click();
  evidence.records = await recordSummary();
  await assertSave('final');
  assert.deepEqual(evidence.errors, []);
  assert(!evidence.consoleErrors.some(e => /Shader Error|shader is not compiled|VALIDATE_STATUS false|CONTEXT_LOST_WEBGL/.test(e.text)), 'No shader/GPU failures');
  assert.deepEqual(evidence.resourcesFailed.filter(r => !new URL(r.url).pathname.endsWith('/favicon.ico')), [], 'No missing game resources');
  evidence.passed = true;
} catch (error) {
  evidence.passed = false; evidence.failure = String(error.stack ?? error); console.error(evidence.failure);
} finally {
  await release().catch(() => {});
  trace ??= await page.evaluate(() => window.__qaM).catch(() => null);
  evidence.records ??= await recordSummary().catch(() => null);
  evidence.sourceAfter = await sourceSnapshot();
  const changedCode = evidence.sourceBefore.files.filter(f => /^(src|data)\//.test(f.file))
    .filter(f => evidence.sourceAfter.files.find(g => g.file === f.file)?.sha256 !== f.sha256);
  evidence.codeChangedDuringRun = changedCode.map(f => f.file);
  if (changedCode.length) { evidence.passed = false; evidence.failure = `${evidence.failure ?? ''}\nSource changed during run: ${changedCode.map(f => f.file).join(', ')}`; }
  if (trace) {
    await writeFile(path.join(dir, 'trace.json'), JSON.stringify(trace));
    const frames = trace.frameTimes.slice().sort((a,b) => a-b);
    evidence.performance = { count: frames.length, medianMs: frames[Math.floor(frames.length*.5)], p95Ms: frames[Math.floor(frames.length*.95)],
      maxMs: frames.at(-1), over50ms: frames.filter(v => v > 50).length, scope: 'This host, headless Chrome with video; no cross-device/performance certification.' };
  }
  await page.screenshot({ path: path.join(dir, '99-final.png') }).catch(() => {});
  await writeFile(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  const video = page.video(); await context.close(); if (video) await rename(await video.path(), path.join(dir, 'continuous.webm')); await browser.close();
  console.log(JSON.stringify({ directory: dir, passed: evidence.passed, failure: evidence.failure, traceSummary: evidence.traceSummary, performance: evidence.performance }));
  if (!evidence.passed) process.exitCode = 1;
}
