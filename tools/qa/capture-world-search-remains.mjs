/** Native, normal-FOV search-object evidence from isolated DEV entry points. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? pathToFileURL(path.join(homedir(),
  '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const phase = process.env.QA_PHASE ?? 'after';
const mode = process.env.QA_MODE ?? 'full';
const only = process.env.QA_ONLY?.split(',');
const base = process.env.GAME_URL ?? 'http://127.0.0.1:3046';
const out = path.resolve(`docs/qa/artifacts/world-search-remains/${phase}`);
await mkdir(out, { recursive: true });
const report = { phase, at: new Date().toISOString(), status: 'running',
  method: 'Fresh isolated browser; controlled full-body-legal starting seat, then real keyboard approach/search. Native normal FOV, enemies and simulation unchanged. Not a natural full-run or human art approval.',
  sources: {}, cases: [], errors: [] };
for (const source of ['src/scenes/rift-scene.ts', 'src/systems/loot-search-presentation.ts',
  'src/systems/world-search-presentation.ts', 'src/generation/world-study/search-remains.ts', 'src/dev/rift-r100-masters/main.ts',
  'data/rift-search-remains.csv', 'src/generated/rift-search-remains.ts',
  'src/systems/r100-world/painted-material.ts', 'src/systems/r100-world/surface-renderer.ts',
  'src/generated/r100-materials.ts', 'data/rift-master-materials.csv',
  'public/assets/r100-materials/ash-strata-source.png', 'public/assets/r100-materials/crystal-fibre-source.png',
  'public/assets/r100-materials/ivory-basin-source.png', 'public/assets/r100-materials/slab-solid-source.png',
  'public/assets/r100-materials/fibre-solid-source.png', 'public/assets/r100-materials/shell-solid-source.png']) {
  try { report.sources[source] = createHash('sha256').update(await readFile(source)).digest('hex'); } catch { report.sources[source] = null; }
}
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
report.environment = { browser: await browser.version(), node: process.version, url: base, deviceScaleFactor: 1 };
report.userBaseline = '../user-before.png';
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

async function sample() {
  return page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const s = audioManager.game.scene.getScene('RiftScene');
    const search = s.probeGetSearchState();
    const nodes = s.search.nodes.map(n => ({ id: n.id, collected: n.collected,
      visibility: s.visibility.getVisibilityAt(n.position), visualClass: n.visual.constructor.name,
      sprite: n.visual.sprite ? { key: n.visual.sprite.texture?.key, name: n.visual.sprite.name,
        visible: n.visual.sprite.visible, alpha: n.visual.sprite.alpha, x: n.visual.sprite.x, y: n.visual.sprite.y } : null }));
    const cam = s.cameras.main;
    return { search, nodes, probe: s.probeBuildLabState(), textures: s.textures.getTextureKeys().filter(k => k.startsWith('__world_search_')),
      worldProfile: s.devRuntime?.world?.sample?.profile?.id ?? s.devFixture?.productionWorld?.sample?.profile?.id ?? null,
      camera: { x: cam.worldView.x, y: cam.worldView.y, zoom: cam.zoom }, storage: window.__qaStorage };
  });
}

async function legalApproach() {
  const seat = await page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const { bodyHasSupport, bodyDisplacementFraction } = await import('/src/systems/ai/physical-grid.ts');
    const s = audioManager.game.scene.getScene('RiftScene'), grid = s.formFloorGrid;
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
  });
  await page.locator('#game-container').focus();
  await page.keyboard.down(seat.key); await page.waitForTimeout(510); await page.keyboard.up(seat.key);
  await page.waitForTimeout(220);
  const state = await sample();
  assert(!state.probe.ended && state.probe.hp > 0, 'Native approach must remain an active run');
  assert.equal(state.search.prompt, 'search', 'Actual approach produces native search prompt');
  assert(Math.hypot(state.search.player.x - seat.point.x, state.search.player.y - seat.point.y) > 20, 'Actual keyboard moved the actor');
  assert(state.nodes.find(n => n.id === seat.node.id)?.visibility > 0, 'Search object is visible under normal FOV');
  return { seat, state };
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
  await page.keyboard.up('e'); await page.waitForTimeout(140);
  const interrupted = await sample();
  assert.equal(interrupted.search.progress, null); assert.equal(interrupted.search.remaining, initial.search.remaining);
  assert.equal(interrupted.search.kindling, initial.search.kindling);
  assert(!interrupted.nodes.find(n => n.id === node.id)?.collected, 'Interruption retains concealed pile');
  await page.keyboard.down('e'); await page.waitForTimeout(1430); await page.keyboard.up('e'); await page.waitForTimeout(800);
  const completed = await sample(), target = completed.nodes.find(n => n.id === node.id);
  assert(target?.collected && target.sprite?.visible === false, 'Completed pile is hidden');
  assert.equal(completed.search.remaining, initial.search.remaining - 1);
  assert(completed.search.kindling > initial.search.kindling, 'Actual search grants kindling');
  return { held, interrupted, completed, images: await capture(`${id}-completed`, node) };
}

try {
  for (const family of ['folded-slab', 'fibre-knot', 'broken-shell']) for (const grade of phase === 'before' || mode === 'behavior' ? ['medium'] : ['low', 'medium', 'severe']) {
    const id = `${family}-${grade}`;
    if (only && !only.includes(id)) continue;
    await loadMaster(family, grade);
    const entry = await sample();
    const { seat, state } = await legalApproach();
    const row = { id, kind: 'r100-master', entry, seat, state, images: await capture(id, seat.node) };
    if (phase !== 'before') {
      const profile = { 'folded-slab': 'ash-strata', 'fibre-knot': 'crystal-fibre', 'broken-shell': 'ivory-basin' }[family];
      verifySource(entry, profile); verifySource(state, profile);
    }
    if (phase !== 'before' && mode !== 'visual' && grade === 'medium') row.interaction = await searchInteraction(id, state, seat.node);
    report.cases.push(row); await persist(); console.log(`${phase}: ${id} captured`);
  }
  if (phase !== 'before') {
    report.cleanup = [];
    for (let i = 0; i < (mode === 'visual' ? 0 : 6); i++) {
      const family = ['folded-slab', 'fibre-knot', 'broken-shell'][i % 3];
      const profile = ['ash-strata', 'crystal-fibre', 'ivory-basin'][i % 3];
      const previousKeys = await page.evaluate(async () => {
        const { audioManager } = await import('/src/managers/audio-manager.ts');
        const s = audioManager.game.scene.getScene('RiftScene');
        window.__qaOldSprites = s.search.nodes.map(n => n.visual.sprite);
        return s.textures.getTextureKeys().filter(k => k.startsWith('__world_search_'));
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
      assert.equal(next.textures.length, new Set(next.nodes.map(node => node.sprite.key)).size, 'Only currently referenced world textures remain');
      report.cleanup.push({ i, family, previousKeys, currentKeys: next.textures, oldSpritesDestroyed });
      await persist(); console.log(`cleanup ${i + 1}/6: ${family}`);
    }
    for (const profile of mode === 'behavior' ? [] : ['ash-strata', 'crystal-fibre', 'ivory-basin', 'carmine-lacquer', 'cobalt-gold']) {
      if (only && !only.includes(`formal-${profile}`)) continue;
      await loadFormal(profile);
      const entry = await sample(); verifySource(entry, profile);
      const { seat, state } = await legalApproach(); verifySource(state, profile);
      const images = await capture(`formal-${profile}`, seat.node);
      report.cases.push({ id: `formal-${profile}`, kind: 'formal-map-via-dev-gym', entry, seat, state, images,
        admission: await page.evaluate(() => window.__riftGym.getState().metadata) });
      await persist(); console.log(`after: formal-${profile} captured`);
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
  await writeFile(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>World search remains ${phase}</title><style>body{background:#151917;color:#cbd2ca;font:16px system-ui;margin:24px}section{margin:32px 0}img{image-rendering:pixelated;vertical-align:top}.crop{width:320px}a{color:#a8c3ad}</style><h1>翻找对象 · ${phase}</h1><p>正常有限视野、原生960×640画面；右侧为未经改图的局部裁切。受控合法起点后的真实键盘接近，并非完整自然出行。</p><a href="report.json">验证记录与源码指纹</a>${report.cases.map(row => `<section><h2>${row.id}</h2><img src="${row.images.frame}"><img class="crop" src="${row.images.crop}"></section>`).join('')}`);
  await browser.close();
}
