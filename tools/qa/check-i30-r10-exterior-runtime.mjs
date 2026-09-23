/** I30 R10: fresh production entry and genuine keyboard navigation.
 * Read-only geometry/state guide the route. No teleports, injected saves,
 * gameplay clock changes, resource grants, or forced presence phases.
 * The separate 35s video is one continuous normal-speed browser session.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createChamberDriver, CHAMBER_TEST_POINTS as P, CHAMBER_TEST_ROUTES as R } from './i30-chamber-driver.mjs';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const url = process.env.I30_URL ?? 'http://127.0.0.1:3025/';
const out = process.env.I30_OUT ?? 'docs/qa/artifacts/iteration-30-r10/runtime';
fs.mkdirSync(out, { recursive: true });
const sourceFiles = [
  'src/scenes/purification-scene.ts', 'src/scenes/purification-chamber-visual.ts',
  'src/scenes/chamber-exterior-atmosphere.ts', 'src/art/chamber-exterior-pixels.ts',
  'src/art/chamber-authored-architecture.ts', 'src/scenes/chamber-exterior-motion.ts',
  'src/systems/purification-chamber-layout.ts', 'assets/source/purification-r9/environment.ts',
  'assets/source/purification-r9/exterior.ts', 'assets/source/purification-r9/schema.ts',
];
const fingerprint = () => Object.fromEntries(sourceFiles.filter(file => fs.existsSync(file))
  .map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const manifest = {
  started: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sources: fingerprint(), url,
  method: 'Two fresh isolated browser contexts. Production / -> Enter; real keys only. Read-only state and authored route diagnostics. No storage injection, teleports, forced phase, or gameplay clock changes.',
  cases: [], limitations: ['Informed route following is not first-time navigation evidence.',
    'One naturally observed distant-presence window is a limited observation, not long-run cadence certification.',
    'No audio, Firefox/Safari, human artistic acceptance, or sustained hardware performance certification.'],
};
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });

async function setup(name, video = false) {
  const dir = path.join(out, name); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'journey.jsonl'), '');
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 },
    ...(video ? { recordVideo: { dir, size: { width: 1440, height: 960 } } } : {}) });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  const d = createJourneyDriver(page, dir), chamber = createChamberDriver(page, d);
  await page.goto(url);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), null, 'Fresh isolated storage');
  await d.press('Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1800);
  await page.waitForFunction(() => !!window.__game.scene.getScene('PurificationScene').chamber?.getExteriorState);
  return { context, page, d, chamber, errors, dir };
}

async function snapshot(page) {
  return page.evaluate(() => {
    const scene = window.__game.scene.getScene('PurificationScene');
    const c = scene.cameras.main;
    const project = image => ({ name: image.name, key: image.texture?.key,
      x: image.x, y: image.y, scaleX: image.scaleX, scaleY: image.scaleY,
      // All captured layers use origin 0 and the main camera.
      screenX: c.width * c.originX + (image.x - c.scrollX - c.width * c.originX) * c.zoom,
      screenY: c.height * c.originY + (image.y - c.scrollY - c.height * c.originY) * c.zoom,
      depth: image.depth, alpha: image.alpha });
    const objects = scene.children.list;
    const mesh = objects.find(o => o.name === 'chamber-exterior-near-projection');
    const meshSource = mesh.texture.getSourceImage(), meshWidth = meshSource.width, meshHeight = meshSource.height;
    const vertices = [...new Map(mesh.vertices.map(v => [`${v.u},${v.v}`, {
      x: mesh.x + (v.u - .5) * meshWidth, y: mesh.y + (v.v - .5) * meshHeight,
      dx: v.x - (v.u - .5) * meshWidth, dy: (.5 - v.v) * meshHeight - v.y }])).values()];
    const extreme = axis => vertices.reduce((best, v) => Math.abs(v[axis]) > Math.abs(best[axis]) ? v : best, vertices[0]);
    return { at: performance.now(), player: { ...scene.player.getPosition() }, route: scene.probeJourneyState().route,
      paused: scene.scene.isPaused(), exterior: scene.chamber.getExteriorState(),
      camera: { scrollX: c.scrollX, scrollY: c.scrollY, zoom: c.zoom, midX: c.midPoint.x, midY: c.midPoint.y },
      layers: objects.filter(o => o.texture?.key?.startsWith('purification-chamber-exterior-') && o !== mesh).map(project),
      room: objects.filter(o => o.texture?.key?.startsWith('purification-chamber-architecture-')).map(project),
      nearProjection: { maxX: extreme('dx').dx, maxY: extreme('dy').dy,
        displacedVertexCount: vertices.filter(v => Math.hypot(v.dx, v.dy) > .001).length,
        anchorNeighborhoods: [{ x: 227, y: 151 }, { x: 394, y: 273 }].map(anchor => ({ anchor,
          vertices: vertices.filter(v => Math.abs(v.x - anchor.x) <= 16 && Math.abs(v.y - anchor.y) <= 16) })) },
      clip: { shared: !!mesh.mask && objects.filter(o => o.texture?.key?.startsWith('purification-chamber-exterior-')).every(o => o.mask === mesh.mask),
        maskX: mesh.mask?.geometryMask?.x, maskY: mesh.mask?.geometryMask?.y,
        commands: mesh.mask?.geometryMask?.commandBuffer?.slice() ?? [] },
      resources: { sceneObjects: objects.length,
        exteriorObjects: objects.filter(o => o.name?.startsWith('chamber-exterior-')).length,
        chamberTextures: Object.keys(scene.textures.list).filter(k => /^purification-chamber-|^chamber-activity-|^chamber-exterior-presence-/.test(k)).length,
        allTextures: Object.keys(scene.textures.list).length } };
  });
}

const layer = (s, id) => s.layers.find(l => l.key.includes(`exterior-${id}-`));
const same = (a, b, what, tolerance = .001) => assert(Math.abs(a - b) <= tolerance, `${what}: ${a} versus ${b}`);
function samePlayer(a, b, what) { same(a.player.x, b.player.x, `${what} X`); same(a.player.y, b.player.y, `${what} Y`); }
function layerGeometry(s) { return { room: s.room.map(({ x, y }) => ({ x, y })), layers: s.layers.map(({ x, y, scaleX, scaleY }) => ({ x, y, scaleX, scaleY })) }; }
function verifyDepthMotion(a, b, axis) {
  const shifts = Object.fromEntries(['near', 'middle', 'far'].map(id => [id,
    id === 'near' ? (b.nearProjection[axis === 'x' ? 'maxX' : 'maxY'] - a.nearProjection[axis === 'x' ? 'maxX' : 'maxY']) * b.camera.zoom
      : layer(b, id)[axis === 'x' ? 'screenX' : 'screenY'] - layer(a, id)[axis === 'x' ? 'screenX' : 'screenY']]));
  assert(Math.abs(b.player[axis] - a.player[axis]) > 8, `Real player moved on ${axis}`);
  // Screen response must differ by distance; weight declarations alone are insufficient.
  assert(Math.abs(shifts.near - shifts.middle) > .2, `Near/middle ${axis} displacement differs: ${JSON.stringify(shifts)}`);
  assert(Math.abs(shifts.middle - shifts.far) > .2, `Middle/far ${axis} displacement differs: ${JSON.stringify(shifts)}`);
  assert(Math.abs(shifts.far) > Math.abs(shifts.middle) && Math.abs(shifts.middle) > Math.abs(shifts.near) && Math.abs(shifts.near) > .1,
    `Fixed-room compensation far > middle > near on ${axis}: ${JSON.stringify(shifts)}`);
  same(a.camera.scrollX, b.camera.scrollX, 'The room camera remains fixed in X');
  same(a.camera.scrollY, b.camera.scrollY, 'The room camera remains fixed in Y');
  for (const s of [a, b]) for (const group of s.nearProjection.anchorNeighborhoods) {
    assert(group.vertices.length >= 4, 'Every root has an actual surrounding mesh cell');
    for (const vertex of group.vertices) { same(vertex.dx, 0, 'Actual root cell X stays welded'); same(vertex.dy, 0, 'Actual root cell Y stays welded'); }
  }
  same(layer(a, 'near').x - a.room[0].x, layer(b, 'near').x - b.room[0].x, 'Near root remains attached in X');
  same(layer(a, 'near').y - a.room[0].y, layer(b, 'near').y - b.room[0].y, 'Near root remains attached in Y');
  return shifts;
}

async function verifyOutsideAuthoredBounds(page) {
  // In this fixed 1440x960 fixture the unchanged 640x400 world projects to
  // y=30..930. The two 15px margins must remain the single void colour, never
  // become stretched replicas of the authored first/last texture row.
  const { data, info } = await sharp(await page.screenshot()).raw().toBuffer({ resolveWithObject: true });
  const rows = [15, 945].map(y => {
    const colors = new Map();
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * info.channels, rgb = [...data.subarray(i, i + 3)].join(',');
      colors.set(rgb, (colors.get(rgb) ?? 0) + 1);
    }
    assert.equal(colors.size, 1, `Outside-authored row ${y} has no stretched exterior stripes`);
    return { y, colors: Object.fromEntries(colors) };
  });
  return { width: info.width, height: info.height, rows };
}

async function runFunctional() {
  const t = await setup('checks'); const { page, context, d, chamber, errors, dir } = t;
  const result = { name: 'production-functional', samples: {}, errors };
  async function panel(id, selector) {
    await chamber.walkFeet(...P[id]);
    const before = await d.state();
    await d.press('e'); await page.locator(selector).waitFor({ state: 'visible' }); await page.waitForTimeout(380);
    await d.press('Escape'); await page.locator(selector).waitFor({ state: 'detached' }); await page.waitForTimeout(380);
    const after = await d.state();
    same(before.player.x, after.player.x, `${id} panel actor X`); same(before.player.y, after.player.y, `${id} panel actor Y`);
    (result.extraPanels ??= []).push({ id, selector, before, after });
  }
  try {
    result.samples.start = await snapshot(page);
    assert(result.samples.start.clip.shared, 'All exterior plates and the near mesh share one world mask');
    same(result.samples.start.clip.maskX, 0, 'World mask origin X'); same(result.samples.start.clip.maskY, 0, 'World mask origin Y');
    assert(result.samples.start.clip.commands.includes(640) && result.samples.start.clip.commands.includes(400), 'Actual mask graphics contains the authored width and height');
    result.outsideBounds = await verifyOutsideAuthoredBounds(page);
    await d.hold(['w'], 350); await page.waitForTimeout(300);
    result.samples.vertical = await snapshot(page);
    result.verticalShifts = verifyDepthMotion(result.samples.start, result.samples.vertical, 'y');
    await chamber.walkFeet(...P.spawn); await page.waitForTimeout(300);
    result.samples.beforeHorizontal = await snapshot(page);
    await d.hold(['a'], 500); await page.waitForTimeout(300);
    result.samples.horizontal = await snapshot(page);
    result.horizontalShifts = verifyDepthMotion(result.samples.beforeHorizontal, result.samples.horizontal, 'x');

    await chamber.walkFeet(...P.core); await page.waitForTimeout(1400);
    const unfocused = await snapshot(page);
    await page.waitForTimeout(1100);
    const still = await snapshot(page);
    assert.deepEqual(layerGeometry(still), layerGeometry(unfocused), 'Stationary player does not drift the exterior plates');
    same(still.nearProjection.maxX, unfocused.nearProjection.maxX, 'Stationary near mesh X');
    same(still.nearProjection.maxY, unfocused.nearProjection.maxY, 'Stationary near mesh Y');
    result.stationary = { before: unfocused, after: still };
    await d.press('e'); await page.locator('#allocation-panel').waitFor({ state: 'visible' });
    const focusSamples = [];
    for (let n = 0; n < 12; n++) { focusSamples.push(await snapshot(page)); await page.waitForTimeout(45); }
    await d.hold(['d', 'w'], 250); samePlayer(unfocused, await snapshot(page), 'Focused panel freezes actor');
    await d.press('Escape'); await page.locator('#allocation-panel').waitFor({ state: 'detached' });
    for (let n = 0; n < 12; n++) { focusSamples.push(await snapshot(page)); await page.waitForTimeout(45); }
    const restored = await snapshot(page); samePlayer(unfocused, restored, 'Closing panel preserves actor');
    assert.deepEqual(layerGeometry(restored), layerGeometry(unfocused), 'Focus and close do not alter layer world transforms');
    for (const sample of focusSamples) {
      assert.deepEqual(layerGeometry(sample), layerGeometry(unfocused), 'No camera-focus driven parallax jump');
      same(sample.nearProjection.maxX, unfocused.nearProjection.maxX, 'Focus does not displace near mesh X');
      same(sample.nearProjection.maxY, unfocused.nearProjection.maxY, 'Focus does not displace near mesh Y');
      assert.deepEqual(sample.clip, unfocused.clip, 'Focus preserves the actual shared world mask');
    }
    same(unfocused.camera.scrollX, restored.camera.scrollX, 'Camera X returns');
    same(unfocused.camera.scrollY, restored.camera.scrollY, 'Camera Y returns');
    same(unfocused.camera.zoom, restored.camera.zoom, 'Camera zoom returns');
    result.focus = { before: unfocused, samples: focusSamples, after: restored };

    await chamber.via(R.coreToStorage); await panel('storage', '#allocation-panel');
    // The straight storage->spawn diagonal can meet the core's solid sole.
    // Keep the return on the authored y327 circulation strip before climbing.
    await chamber.via([[103, 327], [175, 327], P.spawn]);
    await chamber.climbCenter(); result.samples.upper = await snapshot(page);
    await panel('growth', '#growth-panel');
    await chamber.via(R.upperToOffering); await panel('offering', '#defense-panel');
    await chamber.descendEast(); result.samples.descended = await snapshot(page);
    await panel('purifier', '#allocation-panel');
    assert.equal(result.samples.upper.route, 'upper'); assert.equal(result.samples.descended.route, 'main');

    await d.press('Escape'); await page.waitForFunction(() => window.__game.scene.getScene('PurificationScene').scene.isPaused());
    const paused = await snapshot(page); await page.waitForTimeout(1100); const pausedAfter = await snapshot(page);
    assert.deepEqual(pausedAfter.exterior, paused.exterior, 'Pause freezes exterior time, presence, and parallax');
    assert.deepEqual(layerGeometry(pausedAfter), layerGeometry(paused));
    result.pause = { before: paused, after: pausedAfter };
    await d.press('Escape'); await page.waitForTimeout(300);

    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(300);
    const reduced = await snapshot(page); await page.waitForTimeout(1400); const reducedAfter = await snapshot(page);
    assert.deepEqual(layerGeometry(reducedAfter), layerGeometry(reduced), 'Reduced-motion idle has no layer drifting');
    assert.equal(reducedAfter.exterior.reducedMotion, true);
    assert.equal(reducedAfter.exterior.presence.visible, false, 'Reduced motion suppresses the passing distant presence');
    result.reducedMotion = { before: reduced, after: reducedAfter };
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(200);

    // Observe normal elapsed scene time. This is deliberately not a phase setter.
    result.naturalPresence = { samples: [], observed: false };
    const observationStart = Date.now();
    while (Date.now() - observationStart < 60000) {
      const s = await snapshot(page); result.naturalPresence.samples.push(s.exterior);
      if (s.exterior.presence?.visible && s.exterior.presence?.alpha > .42) {
        result.naturalPresence.observed = true;
        await page.screenshot({ path: path.join(dir, 'natural-distant-presence.png') });
        result.naturalPresence.visible = s; break;
      }
      await page.waitForTimeout(200);
    }
    result.naturalPresence.wallMs = Date.now() - observationStart;
    assert(result.naturalPresence.observed, 'At least one distant presence appears on natural elapsed time');

    const resources = (await snapshot(page)).resources;
    result.reentries = [];
    for (let n = 0; n < 3; n++) {
      await d.press('Escape'); await page.locator('.pause-menu-row').filter({ hasText: '载入已保存的记录' }).click();
      await page.waitForFunction(() => window.__game.scene.isActive('PurificationScene'));
      await page.waitForTimeout(1800);
      const s = await snapshot(page); assert.deepEqual(s.resources, resources, `Reload ${n + 1} has stable resource counts`);
      result.reentries.push(s);
    }
    await chamber.walkFeet(...P.rift); await d.press('e');
    await page.locator('#inventory-panel').waitFor({ state: 'visible' }); await page.waitForTimeout(300);
    await page.evaluate(() => {
      const mesh = window.__game.scene.getScene('PurificationScene').children.list.find(o => o.name === 'chamber-exterior-near-projection');
      window.__r10RetiredMask = { mask: mesh.mask, graphics: mesh.mask.geometryMask };
    });
    await d.press('Shift+Enter');
    await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene'), null, { timeout: 30000 });
    await page.waitForTimeout(700); result.rift = await d.state();
    assert.equal(result.rift.scene, 'rift'); assert.equal(result.rift.active, true);
    result.exteriorAfterExit = await page.evaluate(() => ({
      textures: Object.keys(window.__game.textures.list).filter(k => /^purification-chamber-|^chamber-activity-|^chamber-exterior-presence-/.test(k)),
      chamber: window.__game.scene.getScene('PurificationScene').chamber,
      maskReleased: window.__r10RetiredMask.mask.geometryMask === null,
      maskGraphicsReleased: !window.__r10RetiredMask.graphics.scene,
    }));
    assert.deepEqual(result.exteriorAfterExit.textures, [], 'Leaving chamber releases owned textures');
    assert.equal(result.exteriorAfterExit.chamber, null, 'Scene releases chamber owner');
    assert(result.exteriorAfterExit.maskReleased && result.exteriorAfterExit.maskGraphicsReleased, 'Leaving chamber releases the world mask and off-list Graphics');
    assert.deepEqual(errors, []); result.ok = true;
  } catch (error) {
    result.ok = false; result.error = String(error); await page.screenshot({ path: path.join(dir, 'failure.png') }).catch(() => {}); throw error;
  } finally {
    manifest.cases.push(result); fs.writeFileSync(path.join(dir, 'observations.json'), JSON.stringify(result, null, 2));
    await context.close();
  }
}

async function recordNaturalVideo() {
  const t = await setup('natural-video', true); const { page, context, d, chamber, errors, dir } = t;
  const result = { name: 'natural-walk-clip', errors, samples: [], method: 'Fresh title entry, normal clock, actual WASD; at least 31s gameplay with no phase control. Video includes title/entry before these 31s.' };
  const started = Date.now();
  try {
    await d.snap('01-spawn'); result.samples.push(await snapshot(page));
    result.outsideBounds = await verifyOutsideAuthoredBounds(page);
    await d.hold(['w'], 350); await d.hold(['s'], 350); await d.hold(['a'], 500); await d.hold(['d'], 500);
    await chamber.via(R.mainToClimb); await d.snap('02-left-ramp'); result.samples.push(await snapshot(page));
    await chamber.via(R.climbToUpper); await chamber.via(R.upperToOffering);
    await d.snap('03-upper'); result.samples.push(await snapshot(page));
    await chamber.descendEast(); await chamber.walkFeet(...P.spawn);
    await d.snap('04-loop-return'); result.samples.push(await snapshot(page));
    while (Date.now() - started < 31000) { result.samples.push(await snapshot(page)); await page.waitForTimeout(200); }
    result.gameplayWallMs = Date.now() - started;
    assert.deepEqual(errors, []); result.ok = true;
  } catch (error) { result.ok = false; result.error = String(error); throw error; }
  finally {
    const video = page.video(); await context.close();
    if (video) { const original = await video.path(); const target = path.join(dir, 'natural-walk.webm'); await video.saveAs(target); fs.unlinkSync(original); result.video = target; }
    manifest.cases.push(result); fs.writeFileSync(path.join(dir, 'observations.json'), JSON.stringify(result, null, 2));
  }
}

try {
  if (process.env.I30_CASE !== 'checks') await recordNaturalVideo();
  if (process.env.I30_CASE !== 'video') await runFunctional();
  assert.deepEqual(fingerprint(), manifest.sources, 'Source fingerprint must remain stable throughout runtime evidence capture');
  manifest.ok = true;
} catch (error) { manifest.ok = false; manifest.failure = String(error); throw error; }
finally {
  manifest.finished = new Date().toISOString(); manifest.finalSources = fingerprint();
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2)); await browser.close();
}
console.log(JSON.stringify({ ok: manifest.ok, cases: manifest.cases.map(c => ({ name: c.name, ok: c.ok })), out }, null, 2));
