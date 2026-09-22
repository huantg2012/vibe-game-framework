/**
 * I30 R4 lighting integration evidence. Fresh isolated production entry, genuine
 * keys and read-only scene probes. No state injection, teleport, method patches,
 * time scaling or FPS sampling. Run serially with other presentation captures.
 *
 * node tools/qa/check-i30-light-runtime.mjs [--url URL] [--out DIRECTORY]
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { createChamberDriver } from './i30-chamber-driver.mjs';

const { values } = parseArgs({ options: {
  url: { type: 'string', default: process.env.I30_URL ?? 'http://127.0.0.1:3025/' },
  out: { type: 'string', default: process.env.I30_LIGHT_OUT ?? 'docs/qa/artifacts/iteration-30-r4/lighting-runtime' },
} });
const out = values.out;
fs.mkdirSync(out, { recursive: true });
const sourcePaths = [
  'src/art/chamber-light-field.ts', 'src/art/chamber-floor-light.ts',
  'src/art/purification-chamber-pixels.ts', 'src/scenes/purification-chamber-lighting.ts',
  'src/scenes/purification-chamber-visual.ts', 'src/scenes/purification-scene.ts',
  'src/entities/player.ts', 'src/entities/player-lamp-aura.ts',
  'src/systems/purification-chamber-layout.ts', 'tools/qa/check-i30-light-runtime.mjs',
  'tools/qa/i30-chamber-driver.mjs', 'tools/qa/i27-journey-driver.mjs',
];
const fingerprint = () => Object.fromEntries(sourcePaths.map(file =>
  [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const errors = [];
const manifest = {
  at: new Date().toISOString(), version: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  url: values.url, viewport: { width: 1440, height: 960 }, sources: fingerprint(), errors,
  method: 'Fresh isolated browser storage; production MainMenu -> Purification -> Rift. Real keyboard only. Read-only lamp/Graphics/texture observations and CDP precise coverage; no production method replacement.',
  scope: [],
  limitations: [
    'Informed authored routes do not establish first-time navigation or aesthetic approval.',
    'Command-buffer changes establish submitted Graphics activity, not perceptual quality of the final GPU composite.',
    'No FPS benchmark, long-term leak certification, synthetic damage, purchases or hidden-state probes are included.',
  ],
};
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: manifest.viewport });
const page = await context.newPage();
page.on('pageerror', error => errors.push(String(error)));
await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
const journey = createJourneyDriver(page, out);
const chamber = createChamberDriver(page, journey);
const cdp = await context.newCDPSession(page);
let coverageActive = false;

function devicePaintCalls(coverage) {
  return coverage.result.filter(script => script.url.includes('/src/art/purification-chamber-pixels.ts'))
    .flatMap(script => script.functions).filter(fn => fn.functionName === 'paintChamberDevice')
    .reduce((sum, fn) => sum + (fn.ranges[0]?.count ?? 0), 0);
}

async function hubSnapshot(includeTextures = false) {
  return page.evaluate(withTextures => {
    const scene = window.__game.scene.getScene('PurificationScene');
    const visual = scene.chamber, lighting = visual.lighting, player = scene.player;
    if (!scene.scene.isActive() || !lighting) throw Error('Production chamber lighting must be active');
    const hash = values => {
      let result = 2166136261;
      for (const value of values) {
        const text = String(value);
        for (let i = 0; i < text.length; i++) result = Math.imul(result ^ text.charCodeAt(i), 16777619);
        result = Math.imul(result ^ 124, 16777619);
      }
      return (result >>> 0).toString(16).padStart(8, '0');
    };
    const graphics = scene.children.list.filter(child => child.name?.startsWith('chamber-') && Array.isArray(child.commandBuffer))
      .map(child => ({ name: child.name, commands: child.commandBuffer.length, hash: hash(child.commandBuffer),
        depth: child.depth, visible: child.visible, alpha: child.alpha }));
    const lamp = { x: 0, y: 0 };
    player.getLampWorldPosition(lamp);
    const position = player.getPosition();
    const textureData = withTextures ? visual.devices.map(device => {
      const data = device.texture.context.getImageData(0, 0, 640, 400).data;
      return { id: device.id, key: device.texture.key, hash: hash(data),
        depth: device.image.depth, alpha: device.image.alpha };
    }) : undefined;
    return {
      time: visual.time, player: { x: position.x, y: position.y, alpha: player.getSprite().alpha },
      facing: player.getFacing4(), lamp,
      aura: { glow: { x: player.aura.glow.x, y: player.aura.glow.y, alpha: player.aura.glow.alpha },
        poolVisible: player.aura.pool.visible, externalGround: player.aura.externalGround },
      projectedLamp: { x: lighting.lampX, y: lighting.lampY },
      emitters: lighting.emitters.map(emitter => ({ id: emitter.id, energy: emitter.energy,
        floor: emitter.floor, ground: { ...emitter.ground },
        floorSpanCount: emitter.floorSpans.length, wallSpanCount: emitter.wallSpans.length })),
      graphics, textures: textureData,
      shadowCommands: [...lighting.shadow.commandBuffer],
    };
  }, includeTextures);
}

function verifyLamp(snapshot, facing) {
  if (facing) assert.equal(snapshot.facing, facing, 'Real input must select the expected original facing');
  assert.equal(snapshot.aura.poolVisible, false, 'Hub opt-in must hide the original unmasked foot pool');
  assert.equal(snapshot.aura.externalGround, true, 'Only the hub delegates ground-light ownership');
  assert.equal(snapshot.player.alpha, 1, 'Lighting must retain the opaque original actor');
  for (const axis of ['x', 'y']) {
    assert(Math.abs(snapshot.lamp[axis] - snapshot.aura.glow[axis]) < 1e-6,
      `Lamp getter must match the original animated glow ${axis}`);
    assert.equal(snapshot.projectedLamp[axis], Math.round(snapshot.lamp[axis]),
      `POST_UPDATE must pass the current original lamp ${axis} to chamber lighting`);
  }
  if (facing === 'left' || facing === 'up') assert(snapshot.lamp.x < snapshot.player.x, `${facing} keeps the lamp on its authored side`);
  if (facing === 'right' || facing === 'down') assert(snapshot.lamp.x > snapshot.player.x, `${facing} keeps the lamp on its authored side`);
  assert(snapshot.lamp.y < snapshot.player.y, 'The lamp remains attached above the actor centre, not at the feet');
}

// These opcodes come from the installed Phaser Graphics command format. The
// production shadow submits only styles and integer fill rectangles; reject an
// unknown command rather than guessing its length and manufacturing evidence.
function shadowRectangles(commands) {
  const rectangles = [];
  let alpha = 0;
  for (let i = 0; i < commands.length;) {
    const command = commands[i++];
    if (command === 7) { i++; alpha = commands[i++]; }
    else if (command === 6) i += 3;
    else if (command === 3) {
      const [x, y, width, height] = commands.slice(i, i + 4); i += 4;
      if (alpha > 0) rectangles.push({ x, y, width, height, alpha });
    } else assert.fail(`Unexpected directional-shadow Graphics command ${command}`);
  }
  return rectangles;
}

function verifyCoreShadow(snapshot, side) {
  const rectangles = shadowRectangles(snapshot.shadowCommands);
  assert(rectangles.length > 0, `${side} of the core must have a submitted directional shadow`);
  const foot = { x: Math.round(snapshot.player.x), y: Math.round(snapshot.player.y + 10) };
  const source = snapshot.emitters.find(emitter => emitter.id === 'core').ground;
  const dx = foot.x - source.x, dy = foot.y - source.y;
  assert(side === 'right' ? dx > 0 : dx < 0, 'Known route must reach the requested side of the source');
  let count = 0, sumX = 0, sumY = 0;
  for (const rectangle of rectangles) {
    assert(Number.isInteger(rectangle.x) && Number.isInteger(rectangle.y)
      && Number.isInteger(rectangle.width) && rectangle.width > 0 && rectangle.height === 1,
    'Actor shadow must use integer one-pixel scanlines');
    for (let x = rectangle.x; x < rectangle.x + rectangle.width; x++) {
      const vx = x + .5 - foot.x, vy = rectangle.y + .5 - foot.y;
      assert(vx * dx + vy * dy >= -.001, 'Each shadow pixel must extend away from the core source');
      assert(Math.hypot(vx, vy) < 29, 'Actor shadow remains a bounded foot-attached projection');
      sumX += x + .5; sumY += rectangle.y + .5; count++;
    }
  }
  assert(side === 'right' ? sumX / count > foot.x : sumX / count < foot.x,
    'Shadow centroid must switch sides when the player circles the core');
  return { side, foot, source, pixelCount: count, centroid: { x: sumX / count, y: sumY / count },
    scanlines: rectangles.length, maxAlpha: Math.max(...rectangles.map(rectangle => rectangle.alpha)) };
}

try {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  coverageActive = true;
  await page.goto(values.url);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), null,
    'Fresh isolated context must not inherit or alter a user save');
  await journey.press('Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1800);
  const calibration = devicePaintCalls(await cdp.send('Profiler.takePreciseCoverage'));
  assert(calibration >= 6, 'CDP must observe all initial device painting before a zero-call window means anything');

  const initial = await hubSnapshot(true);
  verifyLamp(initial, 'right');
  assert.deepEqual(initial.emitters.map(emitter => emitter.id).sort(), ['core', 'growth', 'purifier', 'wall-lamp']);
  assert.deepEqual(initial.textures.map(texture => texture.id).sort(), ['core', 'growth', 'offering', 'purifier', 'rift', 'storage']);
  for (const emitter of initial.emitters) {
    assert(emitter.energy > 0 && emitter.floorSpanCount > 0 && emitter.wallSpanCount > 0,
      `${emitter.id} must have real active floor and wall receivers`);
  }
  const idle = [initial];
  for (let index = 0; index < 10; index++) {
    await page.waitForTimeout(210);
    idle.push(await hubSnapshot());
  }
  const ending = await hubSnapshot(true);
  const idlePaintCalls = devicePaintCalls(await cdp.send('Profiler.takePreciseCoverage'));
  assert.equal(idlePaintCalls, 0, 'Idle source activity must not repaint any device bitmap');
  assert.deepEqual(ending.textures, initial.textures, 'All six device textures and body states remain cached while lights animate');
  for (const sample of idle) verifyLamp(sample, 'right');
  const energyRanges = Object.fromEntries(initial.emitters.map(emitter => {
    const energies = idle.map(sample => sample.emitters.find(candidate => candidate.id === emitter.id).energy);
    const min = Math.min(...energies), max = Math.max(...energies);
    assert(max - min > .00001, `${emitter.id} energy must actually change during idle observation`);
    return [emitter.id, { min, max }];
  }));
  const activityNames = ['chamber-floor-light', 'chamber-wall-light', 'chamber-source-motes',
    'chamber-device-light-core', 'chamber-device-light-growth', 'chamber-device-light-purifier'];
  const activity = Object.fromEntries(activityNames.map(name => {
    const samples = idle.map(sample => sample.graphics.find(graphics => graphics.name === name));
    assert(samples.every(graphics => graphics?.visible && graphics.commands > 0), `${name} must submit live Graphics`);
    const hashes = [...new Set(samples.map(graphics => graphics.hash))];
    assert(hashes.length > 1, `${name} command buffer must respond to source activity`);
    return [name, { distinctBuffers: hashes.length, commandCount: samples[0].commands, depth: samples[0].depth }];
  }));
  manifest.idle = { durationMs: idle.at(-1).time - initial.time, calibrationDevicePaintCalls: calibration,
    idleDevicePaintCalls: idlePaintCalls, energyRanges, activity, textures: initial.textures };
  manifest.scope.push('Four finite sources and floor/wall/device Graphics animate during idle; calibrated CDP observes zero device repaints and six identical cached bitmaps');
  await journey.snap('01-idle-lighting');

  manifest.facings = [];
  for (const [key, facing] of [['a', 'left'], ['w', 'up'], ['d', 'right'], ['s', 'down']]) {
    await journey.hold([key], 85);
    await page.waitForTimeout(100);
    const snapshot = await hubSnapshot();
    verifyLamp(snapshot, facing);
    manifest.facings.push({ facing, player: snapshot.player, lamp: snapshot.lamp,
      originalGlow: snapshot.aura.glow, chamberLamp: snapshot.projectedLamp, poolVisible: snapshot.aura.poolVisible });
  }
  await chamber.walkFeet(284, 313);
  await page.waitForTimeout(160);
  const right = await hubSnapshot();
  verifyLamp(right);
  const rightShadow = verifyCoreShadow(right, 'right');
  await journey.snap('02-core-shadow-right');
  await chamber.via([[285, 322], [219, 322], [219, 313]]);
  await page.waitForTimeout(160);
  const left = await hubSnapshot();
  verifyLamp(left);
  const leftShadow = verifyCoreShadow(left, 'left');
  await journey.snap('03-core-shadow-left');
  manifest.coreShadows = [rightShadow, leftShadow];
  const movementPaintCalls = devicePaintCalls(await cdp.send('Profiler.takePreciseCoverage'));
  assert.equal(movementPaintCalls, 0, 'Facing changes and movement around the core must not repaint device bitmaps');
  manifest.movementDevicePaintCalls = movementPaintCalls;
  manifest.scope.push('All four facings preserve the original animated lamp anchor with one hub floor pool; real travel to both sides of the core reverses a bounded integer-pixel shadow');
  await cdp.send('Profiler.stopPreciseCoverage');
  coverageActive = false;
  await cdp.send('Profiler.disable');

  await chamber.via([[219, 322], [350, 314], [460, 303], [503, 300], [507, 287]]);
  await journey.press('e');
  await page.locator('#inventory-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  await journey.press('Shift+Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('RiftScene'), null, { timeout: 30000 });
  await page.waitForTimeout(700);
  manifest.rift = await page.evaluate(oldKeys => {
    const game = window.__game, scene = game.scene.getScene('RiftScene');
    const hub = game.scene.getScene('PurificationScene');
    return { active: scene.scene.isActive(), poolVisible: scene.player.aura.pool.visible,
      externalGround: scene.player.aura.externalGround, playerAlpha: scene.player.getSprite().alpha,
      oldDeviceTextures: oldKeys.filter(key => game.textures.exists(key)),
      remainingHubLightGraphics: hub.children.list.filter(child => child.name?.startsWith('chamber-')).map(child => child.name) };
  }, initial.textures.map(texture => texture.key));
  assert.equal(manifest.rift.active, true);
  assert.equal(manifest.rift.poolVisible, true, 'Default Rift actor must restore the original foot-light pool');
  assert.equal(manifest.rift.externalGround, false, 'Hub ground-light delegation must not leak into Rift');
  assert.equal(manifest.rift.playerAlpha, 1);
  assert.deepEqual(manifest.rift.oldDeviceTextures, [], 'Hub device textures must be released on departure');
  assert.deepEqual(manifest.rift.remainingHubLightGraphics, [], 'Hub Graphics must be released on departure');
  await journey.snap('04-rift-original-lamp');
  await journey.press('Escape');
  manifest.scope.push('Real entrance E/Shift+Enter enters Rift, restores the default original floor pool and releases hub device textures/light Graphics');
  assert.deepEqual(errors, [], 'No browser runtime errors');
  manifest.endingSources = fingerprint();
  assert.deepEqual(manifest.endingSources, manifest.sources, 'Sources changed during observation; rerun after the code is stable');
  manifest.ok = true;
} catch (error) {
  manifest.ok = false;
  manifest.failure = String(error);
  await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => {});
  await journey.log({ event: 'failure', message: String(error) });
  throw error;
} finally {
  if (coverageActive) await cdp.send('Profiler.stopPreciseCoverage').catch(() => {});
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await cdp.detach().catch(() => {});
  await context.close();
  await browser.close();
}
console.log(JSON.stringify({ ok: manifest.ok, out, scope: manifest.scope }, null, 2));
