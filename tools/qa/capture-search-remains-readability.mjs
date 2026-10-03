/** Native, normal-FOV search-object evidence from isolated DEV entry points. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const phase = process.env.QA_PHASE ?? 'before';
const mode = process.env.QA_MODE ?? 'visual';
const only = process.env.QA_ONLY?.split(',');
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3046';
const out = path.resolve(`docs/qa/artifacts/search-remains-readability/${phase}`);
await mkdir(out, { recursive: true });
const baseline = phase === 'before' ? null : JSON.parse(await readFile('docs/qa/artifacts/search-remains-readability/before/report.json', 'utf8'));
const report = { phase, at: new Date().toISOString(), status: 'running',
  method: 'Fresh isolated browser; controlled full-body-legal starting seat, then real keyboard approach/search. Native normal FOV, enemies and simulation unchanged. Not a natural full-run or human art approval.',
  sources: {}, cases: [], errors: [] };
for (const source of ['src/scenes/rift-scene.ts', 'src/systems/loot-search-presentation.ts',
  'src/systems/world-search-presentation.ts', 'src/systems/search-remains-ambient.ts', 'src/generation/world-study/search-remains.ts', 'src/dev/rift-r100-masters/main.ts',
  'data/rift-search-remains.csv', 'src/generated/rift-search-remains.ts',
  'src/dev/rift-r100-masters/painted-material.ts', 'src/dev/rift-r100-masters/surface-renderer.ts',
  'src/dev/rift-r100-masters/generated-materials.ts', 'data/rift-master-materials.csv',
  'public/assets/r100-materials/ash-strata-source.png', 'public/assets/r100-materials/crystal-fibre-source.png',
  'public/assets/r100-materials/ivory-basin-source.png', 'public/assets/r100-materials/slab-solid-source.png',
  'public/assets/r100-materials/fibre-solid-source.png', 'public/assets/r100-materials/shell-solid-source.png']) {
  try { report.sources[source] = createHash('sha256').update(await readFile(source)).digest('hex'); } catch { report.sources[source] = null; }
}
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
report.environment = { browser: await browser.version(), node: process.version, url: base, deviceScaleFactor: 1 };
report.baselineRevision = '04cde7e99365cb50886caf2c442f5c2b8bcbc089';
report.mode = mode;
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
assert.deepEqual(await context.storageState(), { cookies: [], origins: [] });
await context.addInitScript(() => {
  window.__qaStorage = { reads: 0, writes: 0, saveReads: 0, saveWrites: 0, events: [] };
  for (const [method, counter] of [['getItem', 'reads'], ['setItem', 'writes'], ['removeItem', 'writes'], ['clear', 'writes']]) {
    const original = Storage.prototype[method];
    Storage.prototype[method] = function (...args) {
      window.__qaStorage[counter]++;
      if (args[0] === 'coh-save-v1') window.__qaStorage[counter === 'reads' ? 'saveReads' : 'saveWrites']++;
      window.__qaStorage.events.push({ method, key: args[0] ?? null });
      return original.apply(this, args);
    };
  }
});
const page = await context.newPage();
page.on('pageerror', error => report.errors.push(String(error)));
const persist = () => writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
if (process.env.QA_REVIEW_ONLY === '1') {
  const behaviorOut = path.resolve('docs/qa/artifacts/search-remains-readability/behavior');
  const behavior = JSON.parse(await readFile(path.join(behaviorOut, 'report.json'), 'utf8'));
  behavior.videoReview = [];
  for (const row of behavior.cases) {
    const samples = JSON.parse(await readFile(path.join(behaviorOut, row.dynamic.samplesFile), 'utf8'));
    const peak = samples.reduce((best, s) => s.sheen.visible && s.sheen.alpha > best.sheen.alpha ? s : best);
    const flakes = samples.reduce((best, s) => s.flakes.reduce((a, f) => a + (f.visible ? f.alpha : 0), 0)
      > best.flakes.reduce((a, f) => a + (f.visible ? f.alpha : 0), 0) ? s : best);
    const quiet = samples.find(s => s.time - samples[0].time > 150 && !s.sheen.visible && s.flakes.every(f => !f.visible));
    const url = `${base}/docs/qa/artifacts/search-remains-readability/behavior/${row.dynamic.video}`;
    await page.setViewportSize({ width: 1000, height: 700 });
    await page.setContent(`<style>body{margin:0;background:black}video{display:block;width:960px;height:640px}</style><video muted playsinline preload="auto" src="${url}"></video>`);
    await page.waitForFunction(() => document.querySelector('video').readyState >= 2);
    await page.evaluate(() => document.querySelector('video').play());
    await page.waitForTimeout(350);
    const played = await page.evaluate(() => { const v = document.querySelector('video'); v.pause(); return { time: v.currentTime, width: v.videoWidth, height: v.videoHeight, error: v.error }; });
    assert(played.time > .1 && played.width === 960 && played.height === 640 && !played.error, 'Saved WebM actually plays at native dimensions');
    const frames = [];
    for (const [label, chosen] of [['quiet', quiet], ['reflection', peak], ['flakes', flakes]]) {
      assert(chosen, `${label}: real observed sample exists`);
      const time = (chosen.time - samples[0].time) / 1000;
      const actual = await page.evaluate(time => new Promise(resolve => {
        const v = document.querySelector('video');
        v.addEventListener('seeked', () => requestAnimationFrame(() => requestAnimationFrame(() => resolve(v.currentTime))), { once: true });
        v.currentTime = time;
      }), time);
      const file = `${row.id}-video-${label}.png`;
      await page.locator('video').screenshot({ path: path.join(behaviorOut, file) });
      frames.push({ label, time, actual, file, source: row.dynamic.video, sample: chosen });
    }
    row.dynamic.keyframes = frames;
    behavior.videoReview.push({ id: row.id, played, frames: frames.map(({ sample, ...frame }) => frame) });
    console.log(`saved video playback and keyframes: ${row.id}`);
  }
  await writeFile(path.join(behaviorOut, 'report.json'), JSON.stringify(behavior, null, 2));
  await writeComparisonIndex(behavior, behaviorOut);
  await page.goto(`${base}/docs/qa/artifacts/search-remains-readability/index.html`);
  assert.equal(await page.locator('article:not([hidden])').count(), 1);
  await page.locator('#case').selectOption('formal-cobalt-gold');
  assert.equal(await page.locator('article:not([hidden])').getAttribute('id'), 'formal-cobalt-gold');
  assert.equal(await page.locator('#case option').count(), 8);
  await browser.close();
  process.exit(0);
}

async function sample() {
  return page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const s = audioManager.game.scene.getScene('RiftScene');
    const search = s.probeGetSearchState();
    const object = o => o ? { name: o.name, x: o.x, y: o.y, visible: o.visible, alpha: o.alpha,
      blendMode: o.blendMode, scaleX: o.scaleX, scaleY: o.scaleY, key: o.texture?.key ?? null } : null;
    const nodes = s.search.nodes.map(n => ({ id: n.id, collected: n.collected,
      visibility: s.visibility.getVisibilityAt(n.position), visualClass: n.visual.constructor.name,
      sprite: n.visual.sprite ? { key: n.visual.sprite.texture?.key, name: n.visual.sprite.name,
        visible: n.visual.sprite.visible, alpha: n.visual.sprite.alpha, x: n.visual.sprite.x, y: n.visual.sprite.y } : null,
      ambient: n.visual.appearance?.ambient ? { elapsed: n.visual.appearance.ambient.elapsed, period: n.visual.appearance.ambient.period,
        sheen: object(n.visual.appearance.ambient.sheen), flakes: n.visual.appearance.ambient.flakes.map(object),
        reducedMotion: n.visual.appearance.ambient.motionPreference?.matches ?? false } : null }));
    const cam = s.cameras.main;
    return { search, nodes, probe: s.probeBuildLabState(), paused: s.sys.isPaused(),
      textures: s.textures.getTextureKeys().filter(k => k.startsWith('__world_search_') || k.startsWith('__search_remains_sheen_')),
      worldProfile: s.devRuntime?.world?.sample?.profile?.id ?? s.devFixture?.productionWorld?.sample?.profile?.id ?? null,
      camera: { x: cam.worldView.x, y: cam.worldView.y, zoom: cam.zoom }, storage: window.__qaStorage };
  });
}

async function legalApproach(caseId) {
  const reference = baseline?.cases.find(row => row.id === caseId);
  const seat = await page.evaluate(async reference => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const { bodyHasSupport, bodyDisplacementFraction } = await import('/src/systems/ai/physical-grid.ts');
    const s = audioManager.game.scene.getScene('RiftScene'), grid = s.formFloorGrid;
    if (reference) {
      const start = reference.seat.point;
      if (!bodyHasSupport(grid, start, 10, 10)) throw Error('Recorded baseline start is no longer body-legal');
      s.probePlacePlayer(start.x, start.y);
      return reference.seat;
    }
    const choices = [];
    for (const node of s.search.getNodesProbe().filter(n => !n.collected)) {
      for (const [ox, oy, key] of [[0, 1, 'w'], [-1, 0, 'd'], [1, 0, 'a'], [0, -1, 's']]) {
        const point = { x: node.x + ox * 72, y: node.y + oy * 72 };
        if (!bodyHasSupport(grid, point, 10, 10) || bodyDisplacementFraction(grid, point, 10, 10, -ox * 44, -oy * 44) !== 1) continue;
        const distance = Math.hypot(point.x - s.player.getPosition().x, point.y - s.player.getPosition().y);
        choices.push({ point, node, key, score: distance });
      }
    }
    choices.sort((a, b) => a.score - b.score);
    if (!choices[0]) throw Error('No legal controlled start with a clear native approach');
    s.probePlacePlayer(choices[0].point.x, choices[0].point.y);
    return choices[0];
  }, reference ?? null);
  await page.locator('#game-container').focus();
  await page.keyboard.down(seat.key); await page.waitForTimeout(510); await page.keyboard.up(seat.key);
  await page.waitForTimeout(220);
  const approached = await sample();
  if (reference) {
    await page.evaluate(async point => {
      const { audioManager } = await import('/src/managers/audio-manager.ts');
      const { bodyHasSupport } = await import('/src/systems/ai/physical-grid.ts');
      const s = audioManager.game.scene.getScene('RiftScene');
      if (!bodyHasSupport(s.formFloorGrid, point, 10, 10)) throw Error('Recorded baseline stop is no longer body-legal');
      s.probePlacePlayer(point.x, point.y);
    }, reference.state.search.player);
    await page.waitForTimeout(120);
  }
  const state = await sample();
  assert(!state.probe.ended && state.probe.hp > 0, 'Native approach must remain an active run');
  assert.equal(state.search.prompt, 'search', 'Actual approach produces native search prompt');
  assert(Math.hypot(approached.search.player.x - seat.point.x, approached.search.player.y - seat.point.y) > .1, 'Actual keyboard moved the actor before station correction');
  assert(Math.hypot(state.search.player.x - seat.point.x, state.search.player.y - seat.point.y) > 20, 'Capture stop is inside the approach corridor');
  assert(state.nodes.find(n => n.id === seat.node.id)?.visibility > 0, 'Search object is visible under normal FOV');
  const comparison = reference ? { start: 'exact baseline seat', stop: 'exact baseline stop after native keyboard approach',
    correctionPx: Math.hypot(approached.search.player.x - reference.state.search.player.x, approached.search.player.y - reference.state.search.player.y),
    baselinePosition: reference.state.search.player, actualPosition: state.search.player } : null;
  if (reference) assert.deepEqual(state.search.player, reference.state.search.player, 'Comparison uses exact recorded baseline position');
  return { seat, state, comparison };
}

async function capture(id, node) {
  const box = await page.locator('#game-container canvas').boundingBox();
  assert(box && Math.abs(box.width - 960) < .1 && Math.abs(box.height - 640) < .1, 'Capture remains native 960x640');
  await page.screenshot({ clip: box, path: path.join(out, `${id}.png`) });
  const state = await sample(), x = box.x + (node.x - state.camera.x) * state.camera.zoom,
    y = box.y + (node.y - state.camera.y) * state.camera.zoom;
  const clip = { x: Math.max(box.x, Math.min(box.x + box.width - 160, x - 80)),
    y: Math.max(box.y, Math.min(box.y + box.height - 160, y - 100)), width: 160, height: 160 };
  await page.screenshot({ clip, path: path.join(out, `${id}-crop.png`) });
  if (process.env.QA_TEXTURE_PROBE === '1') {
    const source = await page.evaluate(async id => {
      const { audioManager } = await import('/src/managers/audio-manager.ts');
      const s = audioManager.game.scene.getScene('RiftScene'), n = s.search.nodes.find(n => n.id === id), sprite = n.visual.sprite;
      return { image: sprite.texture.getSourceImage().toDataURL(), name: sprite.name, bounds: sprite.getBounds(),
        screen: s.cameras.main.matrix.transformPoint(sprite.x - s.cameras.main.scrollX, sprite.y - s.cameras.main.scrollY),
        texture: sprite.texture.key, frame: sprite.frame.name, visible: sprite.visible, depth: sprite.depth, alpha: sprite.alpha,
        camera: { scrollX: s.cameras.main.scrollX, scrollY: s.cameras.main.scrollY, worldView: s.cameras.main.worldView } };
    }, node.id);
    await writeFile(path.join(out, `${id}-texture.png`), Buffer.from(source.image.split(',')[1], 'base64'));
    delete source.image; await writeFile(path.join(out, `${id}-texture-probe.json`), JSON.stringify(source, null, 2));
  }
  return { frame: `${id}.png`, crop: `${id}-crop.png`, clip };
}

async function loadMaster(family, grade) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/rift-r100-masters.html?family=${family}&grade=${grade}&seed=20261002`);
  await page.waitForFunction(() => { try { return JSON.parse(document.querySelector('#diagnostics').textContent).runtime.running; } catch { return false; } }, null, { timeout: 60000 });
  await page.locator('#pixel').click();
  await page.locator('#mode').selectOption('normal');
  await page.waitForTimeout(150);
}

function verifySource(state, profile) {
  assert.equal(state.worldProfile, profile);
  for (const node of state.nodes) {
    assert(node.sprite?.key.startsWith(`__world_search_${profile}_`), `${profile}: actual factory texture is installed`);
    assert(node.sprite?.name.startsWith(`search-remains:${profile}:`), `${profile}: actual sprite declares its world identity`);
    if (node.visibility <= 0) assert(node.sprite.alpha === 0 || node.sprite.visible === false, 'Normal hidden sources do not bypass FOV');
  }
  assert.equal(state.storage.saveReads, 0); assert.equal(state.storage.saveWrites, 0);
}

async function loadFormal(profile) {
  // A 304px existing sidebar leaves the authored canvas exactly 960px wide.
  await page.setViewportSize({ width: 1264, height: 1000 });
  await page.goto(`${base}/rift-gym.html?world=${profile}&seed=20261002`);
  await page.waitForFunction(() => { const s = window.__riftGym?.getState(); return s && !s.busy && s.metadata && s.runtime.ready; }, null, { timeout: 90000 });
  await page.locator('#play').click();
  await page.waitForFunction(() => window.__riftGym?.getState().runtime.running, null, { timeout: 60000 });
  await page.waitForTimeout(150);
}

async function searchInteraction(id, initial, node) {
  await page.keyboard.down('e'); await page.waitForTimeout(420);
  const held = await sample(); assert(held.search.progress > 0 && held.search.progress < 1, 'Real E starts partial search');
  assertAmbientHidden(held.nodes.find(n => n.id === node.id), 'Rummaging');
  await page.keyboard.up('e'); await page.waitForTimeout(140);
  const interrupted = await sample();
  assert.equal(interrupted.search.progress, null); assert.equal(interrupted.search.remaining, initial.search.remaining);
  assert.equal(interrupted.search.kindling, initial.search.kindling);
  assert(!interrupted.nodes.find(n => n.id === node.id)?.collected, 'Interruption retains concealed pile');
  await page.keyboard.down('e'); await page.waitForTimeout(1430); await page.keyboard.up('e'); await page.waitForTimeout(800);
  const completed = await sample(), target = completed.nodes.find(n => n.id === node.id);
  assert(target?.collected && target.sprite?.visible === false, 'Completed pile is hidden');
  assertAmbientHidden(target, 'Collected');
  assert.equal(completed.search.remaining, initial.search.remaining - 1);
  assert(completed.search.kindling > initial.search.kindling, 'Actual search grants kindling');
  return { held, interrupted, completed, images: await capture(`${id}-completed`, node) };
}

function assertAmbientHidden(node, reason) {
  assert(node?.ambient, `${reason}: world ambient exists`);
  assert(!node.ambient.sheen.visible && node.ambient.flakes.every(o => !o.visible), `${reason}: all ambient objects are hidden`);
}

async function placeAt(point) {
  await page.evaluate(async point => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const { bodyHasSupport } = await import('/src/systems/ai/physical-grid.ts');
    const s = audioManager.game.scene.getScene('RiftScene');
    if (!bodyHasSupport(s.formFloorGrid, point, 10, 10)) throw Error('Diagnostic station must remain body-legal');
    s.probePlacePlayer(point.x, point.y);
  }, point);
  await page.waitForTimeout(150);
}

async function dynamicEvidence(id, node, entry, initial) {
  // MediaRecorder captures the actual native WebGL canvas, not a reconstructed animation.
  await page.evaluate(async nodeId => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const game = audioManager.game, s = game.scene.getScene('RiftScene');
    const n = s.search.nodes.find(n => n.id === nodeId), v = n.visual, ambient = v.appearance.ambient;
    const stream = game.canvas.captureStream(30), chunks = [], samples = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8', videoBitsPerSecond: 3500000 });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const record = () => {
      const o = p => ({ x: p.x, y: p.y, alpha: p.alpha, visible: p.visible, blendMode: p.blendMode });
      samples.push({ time: performance.now(), elapsed: ambient.elapsed, paused: s.sys.isPaused(),
        body: { ...o(v.sprite), scaleX: v.sprite.scaleX, scaleY: v.sprite.scaleY, tint: v.sprite.tintTopLeft },
        visibility: s.visibility.getVisibilityAt(n.position), sheen: o(ambient.sheen), flakes: ambient.flakes.map(o) });
    };
    record(); const interval = setInterval(record, 50); recorder.start(250);
    window.__qaVideo = { recorder, stream, chunks, samples, interval };
  }, node.id);
  await page.waitForTimeout(10500);
  const result = await page.evaluate(async () => {
    const p = window.__qaVideo; clearInterval(p.interval);
    await new Promise(resolve => { p.recorder.onstop = resolve; p.recorder.stop(); });
    p.stream.getTracks().forEach(track => track.stop());
    const bytes = new Uint8Array(await new Blob(p.chunks, { type: p.recorder.mimeType }).arrayBuffer());
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { base64: btoa(binary), mime: p.recorder.mimeType, samples: p.samples };
  });
  const video = `${id}.webm`, samplesFile = `${id}-motion.json`;
  await writeFile(path.join(out, video), Buffer.from(result.base64, 'base64'));
  await writeFile(path.join(out, samplesFile), JSON.stringify(result.samples, null, 2));
  const observed = { video, samplesFile, mime: result.mime, sampleCount: result.samples.length,
    durationMs: result.samples.at(-1).time - result.samples[0].time,
    sheenFrames: result.samples.filter(s => s.sheen.visible && s.sheen.alpha > .1).length,
    flakeFrames: result.samples.filter(s => s.flakes.some(f => f.visible && f.alpha > .1)).length,
    maxSheenAlpha: Math.max(...result.samples.map(s => s.sheen.alpha)),
    stationaryBody: result.samples.every(s => JSON.stringify(s.body) === JSON.stringify(result.samples[0].body)) };
  assert(observed.durationMs >= 9500 && observed.sampleCount > 100, 'Continuous native video samples cover more than two material periods');
  assert(observed.sheenFrames > 5 && observed.flakeFrames > 5, 'Real runtime reflection and falling fragments are present');
  assert(observed.stationaryBody, 'Idle base position, alpha, tint and scale remain constant');
  assert(result.samples.every(s => s.sheen.blendMode === 0 && s.flakes.every(f => f.blendMode === 0)), 'Ambient uses ordinary alpha blending');
  await page.waitForFunction(async nodeId => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const n = audioManager.game.scene.getScene('RiftScene').search.nodes.find(n => n.id === nodeId);
    return n.visual.appearance.ambient.sheen.alpha > .5 && n.visual.appearance.ambient.sheen.visible;
  }, node.id, { timeout: 7000 });
  observed.peakImages = await capture(`${id}-reflection`, node);
  await page.keyboard.press('Escape'); await page.waitForTimeout(100);
  const paused = await sample(); assert(paused.paused, 'Escape pauses the actual Rift Scene');
  await page.waitForTimeout(750); const stillPaused = await sample();
  assert.deepEqual(stillPaused.nodes, paused.nodes, 'True scene pause freezes all body and ambient states');
  assert.equal(stillPaused.probe.elapsedMs, paused.probe.elapsedMs, 'Pause freezes simulation time');
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const resumed = await sample(); assert(!resumed.paused, 'Escape resumes native scene');
  assert(resumed.nodes.find(n => n.id === node.id).ambient.elapsed > paused.nodes.find(n => n.id === node.id).ambient.elapsed);
  await placeAt(entry.search.player);
  const hidden = await sample(), hiddenTarget = hidden.nodes.find(n => n.id === node.id);
  assert(hiddenTarget.visibility <= .02 && hiddenTarget.sprite.alpha <= .02, 'Original legal spawn is outside object FOV');
  assertAmbientHidden(hiddenTarget, 'Outside FOV');
  await page.waitForTimeout(450); const remainsHidden = await sample();
  assert.deepEqual(remainsHidden.nodes.find(n => n.id === node.id).ambient, hiddenTarget.ambient, 'Hidden ambient clock and objects remain frozen');
  await placeAt(initial.search.player);
  return { ...observed, paused, stillPaused, resumed, hidden, remainsHidden };
}

try {
  for (const family of ['folded-slab', 'fibre-knot', 'broken-shell']) for (const grade of ['medium']) {
    const id = `${family}-${grade}`;
    if (only && !only.includes(id)) continue;
    await loadMaster(family, grade);
    const entry = await sample();
    const { seat, state, comparison } = await legalApproach(id);
    const row = { id, kind: 'r100-master', entry, seat, state, comparison, images: await capture(id, seat.node) };
    if (phase !== 'before') {
      const profile = { 'folded-slab': 'ash-strata', 'fibre-knot': 'crystal-fibre', 'broken-shell': 'ivory-basin' }[family];
      verifySource(entry, profile); verifySource(state, profile);
    }
    if (phase !== 'before' && mode !== 'visual' && grade === 'medium') {
      row.dynamic = await dynamicEvidence(id, seat.node, entry, state);
      row.interaction = await searchInteraction(id, await sample(), seat.node);
    }
    report.cases.push(row); await persist(); console.log(`${phase}: ${id} captured`);
  }
  {
    report.cleanup = [];
    for (let i = 0; i < (phase === 'before' || mode === 'visual' ? 0 : 6); i++) {
      const family = ['folded-slab', 'fibre-knot', 'broken-shell'][i % 3];
      const profile = ['ash-strata', 'crystal-fibre', 'ivory-basin'][i % 3];
      const previousKeys = await page.evaluate(async () => {
        const { audioManager } = await import('/src/managers/audio-manager.ts');
        const s = audioManager.game.scene.getScene('RiftScene');
        window.__qaOldSprites = s.search.nodes.flatMap(n => [n.visual.sprite,
          n.visual.appearance.ambient.sheen, ...n.visual.appearance.ambient.flakes]);
        return s.textures.getTextureKeys().filter(k => k.startsWith('__world_search_') || k.startsWith('__search_remains_sheen_'));
      });
      await page.locator(`[data-family="${family}"]`).click();
      await page.waitForFunction(profile => { try {
        const d = JSON.parse(document.querySelector('#diagnostics').textContent);
        return d.runtime.running && d.world.family === { 'ash-strata': 'folded-slab', 'crystal-fibre': 'fibre-knot', 'ivory-basin': 'broken-shell' }[profile];
      } catch { return false; } }, profile, { timeout: 60000 });
      await page.waitForTimeout(150);
      const next = await sample(); verifySource(next, profile);
      const oldSpritesDestroyed = await page.evaluate(() => window.__qaOldSprites.every(sprite => !sprite.scene));
      assert(oldSpritesDestroyed, 'Scene rebuild destroys previous visual sprite instances');
      assert(previousKeys.every(key => !next.textures.includes(key)), 'Scene rebuild releases previous world texture leases');
      assert.equal(next.textures.length, new Set(next.nodes.flatMap(node => [node.sprite.key, node.ambient.sheen.key])).size,
        'Only currently referenced world and reflection textures remain');
      report.cleanup.push({ i, family, previousKeys, currentKeys: next.textures, oldSpritesDestroyed });
      await persist(); console.log(`cleanup ${i + 1}/6: ${family}`);
    }
    for (const profile of mode === 'behavior' ? [] : ['ash-strata', 'crystal-fibre', 'ivory-basin', 'carmine-lacquer', 'cobalt-gold']) {
      if (only && !only.includes(`formal-${profile}`)) continue;
      await loadFormal(profile);
      const entry = await sample(); verifySource(entry, profile);
      const { seat, state, comparison } = await legalApproach(`formal-${profile}`); verifySource(state, profile);
      const images = await capture(`formal-${profile}`, seat.node);
      report.cases.push({ id: `formal-${profile}`, kind: 'formal-map-via-dev-gym', entry, seat, state, comparison, images,
        admission: await page.evaluate(() => window.__riftGym.getState().metadata) });
      await persist(); console.log(`${phase}: formal-${profile} captured`);
    }
  }
  assert.deepEqual(report.errors, []);
  report.status = 'captured';
} catch (error) {
  report.status = 'failed'; report.failure = String(error);
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  throw error;
} finally {
  report.endSources = {};
  for (const file of Object.keys(report.sources)) {
    try { report.endSources[file] = createHash('sha256').update(await readFile(file)).digest('hex'); } catch { report.endSources[file] = null; }
  }
  report.sourceChangedDuringCapture = Object.entries(report.sources).some(([file, hash]) => hash !== report.endSources[file]);
  await persist();
  await writeFile(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Search remains readability ${phase}</title><style>body{background:#151917;color:#cbd2ca;font:16px system-ui;margin:24px}section{margin:32px 0}img,video{image-rendering:pixelated;vertical-align:top}.crop{width:320px}a{color:#a8c3ad}summary{cursor:pointer;margin:12px 0}</style><h1>翻找残骸可读性 · ${phase}</h1><p>正常有限视野、原生960×640画面；右侧为未经改图的局部裁切。受控合法起点后的真实键盘接近，修后停点按合法修前坐标校准，并非完整自然出行。视频直接记录原生游戏画布，不包含DOM界面。</p><a href="report.json">验证记录与源码指纹</a>${report.cases.map(row => `<section><h2>${row.id}</h2><img src="${row.images.frame}"><img class="crop" src="${row.images.crop}">${phase === 'after' ? `<details><summary>同站位修前</summary><img src="../before/${row.images.frame}"><img class="crop" src="../before/${row.images.crop}"></details>` : ''}${row.dynamic ? `<p>连续原生录像（${(row.dynamic.durationMs / 1000).toFixed(1)}秒，局部反光与落屑）：</p><video controls loop preload="metadata" width="960" src="${row.dynamic.video}"></video><p><a href="${row.dynamic.samplesFile}">只读动态采样</a></p><img class="crop" src="${row.dynamic.peakImages.crop}">` : ''}</section>`).join('')}`);
  await browser.close();
  if (phase === 'behavior' && report.status === 'captured') await writeComparisonIndex(report, out);
}

async function writeComparisonIndex(report, out) {
    const after = JSON.parse(await readFile(path.join(out, '../after/report.json'), 'utf8'));
    const cards = after.cases.map((row, i) => {
      const motion = report.cases.find(item => item.id === row.id)?.dynamic;
      const pair = suffix => `<div class="pair">${['before', 'after'].map(p => `<figure><figcaption>${p === 'before' ? '修前 · 04cde7e9' : '修后 · 最终冻结版'}</figcaption><a href="${p}/${row.id}${suffix}.png" target="_blank"><img class="${suffix ? 'crop' : 'frame'}" src="${p}/${row.id}${suffix}.png" alt="${row.id} ${p}"></a></figure>`).join('')}</div>`;
      return `<article id="${row.id}"${i ? ' hidden' : ''}><h2>${row.id}</h2>${pair('-crop')}<details><summary>同站位原生完整帧（点击图片打开960×640原图）</summary>${pair('')}</details>${motion ? `<h3>真实连续动效</h3><p>原生画布直接录制约10.5秒，局部反光与碎屑；整堆闲置位置、透明度、缩放和颜色恒定。</p><video controls loop muted playsinline preload="metadata" src="behavior/${motion.video}"></video><p><a href="behavior/${motion.samplesFile}">50ms只读时间序列</a> · <a href="behavior/${motion.peakImages.frame}">反光时原生帧</a></p>` : '<p>本来源仅采同站位静帧，动态行为由三母版代表样本验证。</p>'}</article>`;
    }).join('');
    await writeFile(path.join(out, '../index.html'), `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>翻找残骸可读性 · 修前修后</title><style>body{background:#151917;color:#d7ded4;font:16px/1.6 system-ui;margin:24px auto;padding:0 24px;max-width:1440px}h1{font-size:28px}a{color:#b9d4bd}select{font:inherit;padding:8px;background:#202921;color:inherit;border:1px solid #657165}.pair{display:flex;gap:24px;align-items:start}figure{margin:12px 0;flex:1;min-width:0}figcaption{margin:8px 0}img,video{image-rendering:pixelated;max-width:100%}.crop{width:480px}.frame{width:960px}video{width:960px}summary{cursor:pointer}details{margin:20px 0}footer{color:#adb6a8;margin-top:40px}</style><h1>翻找残骸可读性 · 修前修后</h1><p>保留四种残骸形状，加强真实材料的明暗分离，并增加局部短暂反光与落屑。正常视野、原肩灯、原敌人，同种子20261002、相同合法停点。</p><label>来源 <select id="case">${after.cases.map(row => `<option value="${row.id}">${row.id}</option>`).join('')}</select></label>${cards}<footer><p>局部图是未经改图的160×160浏览器截图，页面仅作像素放大。使用受控合法起点、真实键盘接近；修后停点按修前坐标校准。视频直接记录原生画布，不含DOM界面。仅此8组静帧、3组动态/翻找及6次重建；不代表全部世界或人审通过。</p><p><a href="before/report.json">修前记录</a> · <a href="after/report.json">最终静帧记录与源指纹</a> · <a href="behavior/report.json">动态/行为/清理记录与源指纹</a></p><details><summary>历史第一版（未定稿，不作最终效果）</summary><a href="first-pass/index.html">第一版证据</a></details></footer><script>document.querySelector('#case').addEventListener('change',event=>{document.querySelectorAll('article').forEach(item=>item.hidden=item.id!==event.target.value);document.querySelectorAll('video').forEach(item=>item.pause());});</script></html>`);
}
