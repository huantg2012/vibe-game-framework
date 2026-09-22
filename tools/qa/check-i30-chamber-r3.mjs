/**
 * I30 R3 presentation evidence, not art acceptance or first-time navigation.
 * Isolated production entry and genuine keys. Diagnostics only read scene state;
 * CDP observes painter invocation counts without replacing production methods.
 * The damaged case changes only three public module HP values before boot.
 *
 * node tools/qa/check-i30-chamber-r3.mjs --out <evidence-directory>
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
  out: { type: 'string', default: process.env.I30_R3_OUT ?? 'docs/qa/artifacts/iteration-30-r3/presentation' },
  url: { type: 'string', default: process.env.I30_URL ?? 'http://127.0.0.1:3025/' },
} });
const out = values.out;
fs.mkdirSync(out, { recursive: true });
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE
  ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const sourcePaths = [
  'src/art/chamber-pixel-helpers.ts', 'src/art/chamber-exterior-pixels.ts',
  'src/art/chamber-surface-map.ts',
  'src/art/purification-chamber-pixels.ts', 'src/scenes/purification-chamber-visual.ts',
  'src/art/chamber-floor-light.ts', 'src/art/chamber-light-field.ts',
  'src/scenes/purification-chamber-lighting.ts', 'src/entities/player.ts', 'src/entities/player-lamp-aura.ts',
  'src/scenes/purification-scene.ts', 'src/systems/purification-chamber-layout.ts',
  'tools/qa/check-i30-chamber-r3.mjs', 'tools/qa/i30-chamber-driver.mjs',
];
const fingerprint = () => Object.fromEntries(sourcePaths.map(file =>
  [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const sources = fingerprint();
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const manifest = {
  at: new Date().toISOString(), version: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  sources, url: values.url, viewport: { width: 1440, height: 960 },
  method: 'Fresh isolated browser contexts; real keyboard on production entry. Read-only routing and texture observations. CDP precise coverage counts paint calls without patching game code. Damaged context derives from this run’s new save and changes only public module HP.',
  limitations: ['Known-safe routes are not first-time navigation evidence.',
    'Short frame samples are headless desktop observations, not a hardware-wide FPS or memory-leak certification.',
    'Zero cached painter calls covers the measured windows; live Graphics activity is expected and not prohibited.',
    'Texture population/hash checks do not judge aesthetics, material quality, boundary readability or player understanding.',
    'Synthetic damage is not naturally earned progression. No hidden item identities, growth or forecast values are authored.'],
  cases: [],
};
const devices = ['core', 'storage', 'purifier', 'growth', 'offering', 'rift'];
const layers = [...devices, 'architecture', 'exterior', 'grounding', 'resistance', 'front-cut'];
const cachedPainters = ['paintChamberArchitecture', 'paintChamberExterior', 'paintChamberGrounding',
  'paintChamberForeground', 'paintChamberResistance', 'paintChamberDevice'];

async function newCase(name, save) {
  const caseOut = path.join(out, name);
  fs.mkdirSync(caseOut, { recursive: true });
  const context = await browser.newContext({ viewport: manifest.viewport });
  if (save) await context.addInitScript(value => {
    if (localStorage.getItem('coh-save-v1') === null) localStorage.setItem('coh-save-v1', JSON.stringify(value));
  }, save);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.route('**/@vite/client', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  const journey = createJourneyDriver(page, caseOut);
  return { name, caseOut, context, page, errors, journey, chamber: createChamberDriver(page, journey) };
}

async function enter(test, fresh = false) {
  const { page, journey } = test;
  await page.goto(values.url);
  await page.waitForFunction(() => window.__game?.scene.isActive('MainMenuScene'));
  if (fresh) assert.equal(await page.evaluate(() => localStorage.getItem('coh-save-v1')), null,
    'Fresh case must not inherit any user record');
  await journey.press('Enter');
  await page.waitForFunction(() => window.__game?.scene.isActive('PurificationScene'));
  await page.waitForTimeout(1800);
  assert.equal((await journey.state()).scene, 'base');
}

async function textureSnapshot(page) {
  return page.evaluate(() => {
    const game = window.__game;
    const scene = game.scene.getScene('PurificationScene');
    const keys = game.textures.getTextureKeys().filter(key => key.startsWith('purification-chamber-')).sort();
    const textures = keys.map(key => {
      const texture = game.textures.get(key), image = scene.children.list.find(child => child.texture?.key === key);
      const canvas = texture.getSourceImage();
      const data = texture.context.getImageData(0, 0, canvas.width, canvas.height).data;
      let hash = 2166136261, occupied = 0;
      for (let index = 0; index < data.length; index++) {
        hash = Math.imul(hash ^ data[index], 16777619);
        if (index % 4 === 3 && data[index] > 0) occupied++;
      }
      return { key, layer: key.replace(/^purification-chamber-/, '').replace(/-\d+$/, ''),
        width: canvas.width, height: canvas.height, hash: (hash >>> 0).toString(16).padStart(8, '0'), occupied,
        imageCount: scene.children.list.filter(child => child.texture?.key === key).length,
        visible: image?.visible, alpha: image?.alpha, depth: image?.depth };
    });
    return { textures, totalTextureCount: game.textures.getTextureKeys().length,
      publicHealth: { ...scene.chamberState.moduleHealth },
      playerAlpha: scene.player.getSprite().alpha };
  });
}

function verifyTextures(snapshot) {
  assert.deepEqual(snapshot.textures.map(texture => texture.layer).sort(), [...layers].sort(),
    'All six devices and five environment layers must exist exactly once');
  for (const texture of snapshot.textures) {
    assert.equal(texture.width, 640, `${texture.layer} texture width`);
    assert.equal(texture.height, 400, `${texture.layer} texture height`);
    assert(texture.occupied > 0, `${texture.layer} texture must contain painted pixels`);
    assert.equal(texture.imageCount, 1, `${texture.layer} must have one live scene image`);
    assert.equal(texture.visible, true, `${texture.layer} must be visible`);
    assert(Number.isFinite(texture.depth), `${texture.layer} depth must be finite`);
  }
  assert.equal(snapshot.playerAlpha, 1, 'Scene treatment keeps the original player opaque');
  assert.equal(new Set(snapshot.textures.filter(texture => devices.includes(texture.layer)).map(texture => texture.hash)).size,
    6, 'Device bitmaps must not accidentally alias one image');
}

function painterCounts(coverage) {
  const counts = Object.fromEntries(cachedPainters.map(name => [name, 0]));
  for (const script of coverage.result) {
    if (!['purification-chamber-pixels.ts', 'chamber-exterior-pixels.ts']
      .some(file => script.url.includes(`/src/art/${file}`))) continue;
    for (const fn of script.functions) {
      if (Object.hasOwn(counts, fn.functionName)) counts[fn.functionName] += fn.ranges[0]?.count ?? 0;
    }
  }
  return counts;
}

async function measureFrameIntervals(page, durationMs = 2500) {
  const sample = await page.evaluate(duration => new Promise(resolve => {
    const game = window.__game, intervals = [];
    let previous = performance.now(), frames = 0;
    const started = previous;
    const onStep = () => {
      const now = performance.now();
      if (frames > 0 && intervals.length < 1000) intervals.push(now - previous);
      previous = now; frames++;
    };
    game.events.on('poststep', onStep);
    setTimeout(() => {
      game.events.off('poststep', onStep);
      resolve({ durationMs: performance.now() - started, frames, intervals,
        documentVisibility: document.visibilityState });
    }, duration);
  }), durationMs);
  const sorted = [...sample.intervals].sort((a, b) => a - b);
  const percentile = p => sorted[Math.floor((sorted.length - 1) * p)] ?? null;
  assert.equal(sample.documentVisibility, 'visible');
  assert(sample.frames > 30, 'Scene must keep rendering during a short observation');
  return { ...sample, p50Ms: percentile(.5), p95Ms: percentile(.95), maxMs: sorted.at(-1),
    approximateFps: sample.frames * 1000 / sample.durationMs,
    note: 'Observed without CDP precise coverage and without screenshots; listener allocation adds small measurement overhead.' };
}

async function captureViews(test) {
  const { page, journey, chamber } = test;
  await journey.snap('01-main');
  await chamber.walkFeet(284, 313);
  await journey.press('e');
  await page.locator('#allocation-panel').waitFor({ state: 'visible' });
  await page.waitForTimeout(420);
  await journey.snap('02-core-focus');
  await journey.press('Escape');
  await page.locator('#allocation-panel').waitFor({ state: 'detached' });
  await page.waitForTimeout(350);
  await chamber.climbCenter();
  await chamber.via([[231, 203], [183, 202]]);
  await journey.snap('03-upper-west');
  await chamber.via([[222, 203], [315, 198], [348, 198]]);
  await journey.snap('04-upper-east');
  await chamber.descendEast();
}

async function reloadThroughMenu(test, previousKeys, pass) {
  const { page, journey } = test;
  await journey.press('Escape');
  await page.locator('.pause-menu-panel').waitFor({ state: 'visible' });
  await journey.press('ArrowUp');
  assert.equal((await page.locator('.pause-menu-row.is-selected').innerText()).trim(), '载入已保存的记录',
    'Lifecycle test must select reload, never overwrite the save');
  await journey.press('Enter');
  await page.waitForFunction(keys => {
    const game = window.__game;
    return game?.scene.isActive('PurificationScene') && keys.every(key => !game.textures.exists(key));
  }, previousKeys);
  await page.waitForTimeout(450);
  const current = await textureSnapshot(page);
  verifyTextures(current);
  assert.equal(current.textures.some(texture => previousKeys.includes(texture.key)), false,
    'Every old chamber texture must be released before the new instance is used');
  await journey.log({ event: 'texture-lifecycle-reentry', pass, textureKeys: current.textures.map(texture => texture.key) });
  return current;
}

let normalSnapshot;
let freshSave;
try {
  const normal = await newCase('normal');
  const result = { name: 'normal', errors: normal.errors };
  manifest.cases.push(result);
  const cdp = await normal.context.newCDPSession(normal.page);
  try {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    await enter(normal, true);
    const calibration = painterCounts(await cdp.send('Profiler.takePreciseCoverage'));
    for (const name of cachedPainters) assert(calibration[name] > 0,
      `Coverage must observe ${name} on initial construction before zero-call windows mean anything`);
    await normal.page.waitForTimeout(2300);
    const idleCounts = painterCounts(await cdp.send('Profiler.takePreciseCoverage'));
    await normal.journey.hold(['w'], 180);
    await normal.chamber.walkFeet(366, 299);
    const movementCounts = painterCounts(await cdp.send('Profiler.takePreciseCoverage'));
    await cdp.send('Profiler.stopPreciseCoverage');
    await cdp.send('Profiler.disable');
    result.cachedPaintCalls = { calibration, idleCounts, movementCounts };
    for (const [window, counts] of Object.entries({ idleCounts, movementCounts })) {
      for (const [name, count] of Object.entries(counts)) assert.equal(count, 0, `${window}: cached ${name} must not continuously repaint`);
    }
    result.frameSample = await measureFrameIntervals(normal.page);
    normalSnapshot = await textureSnapshot(normal.page);
    verifyTextures(normalSnapshot);
    result.initialTextures = normalSnapshot;
    freshSave = await normal.page.evaluate(() => JSON.parse(localStorage.getItem('coh-save-v1')));
    assert(freshSave?.modules?.length === 3, 'Production new save must contain the public three-module state');
    await captureViews(normal);
    let current = normalSnapshot;
    result.reentries = [];
    for (let pass = 1; pass <= 3; pass++) {
      current = await reloadThroughMenu(normal, current.textures.map(texture => texture.key), pass);
      result.reentries.push(current);
    }
    assert.deepEqual(result.reentries.map(snapshot => snapshot.textures.length), [layers.length, layers.length, layers.length]);
    assert.deepEqual(result.reentries.map(snapshot => snapshot.totalTextureCount),
      Array(3).fill(result.reentries[0].totalTextureCount), 'Total texture registry must stabilize across three same-session reentries');
    await normal.journey.snap('05-third-reentry');
    assert.deepEqual(normal.errors, [], 'Normal case must not report browser errors');
    result.ok = true;
  } catch (error) {
    result.ok = false; result.failure = String(error);
    await normal.page.screenshot({ path: path.join(normal.caseOut, 'failure.png') }).catch(() => {});
    throw error;
  } finally { await cdp.detach(); await normal.context.close(); }

  const damagedSave = structuredClone(freshSave);
  const damageHp = { CORE: 8, STORAGE: 24, PURIFIER: 0 };
  for (const module of damagedSave.modules) module.hp = damageHp[module.id];
  const damaged = await newCase('synthetic-damage', damagedSave);
  const damagedResult = { name: 'synthetic-damage', errors: damaged.errors,
    fixture: { source: 'New isolated production save from the normal case in this same run',
      changedFields: damagedSave.modules.map(module => ({ field: `modules.${module.id}.hp`, value: module.hp })),
      naturalProgression: false } };
  manifest.cases.push(damagedResult);
  try {
    await enter(damaged);
    const snapshot = await textureSnapshot(damaged.page);
    verifyTextures(snapshot);
    for (const module of damagedSave.modules) {
      assert.equal(snapshot.publicHealth[module.id.toLowerCase()], module.hp / module.maxHp,
        'Visual boundary state must come from the actual loaded public HP');
    }
    const hashes = new Map(normalSnapshot.textures.map(texture => [texture.layer, texture.hash]));
    for (const texture of snapshot.textures) {
      if (['core', 'storage', 'purifier', 'resistance'].includes(texture.layer)) {
        assert.notEqual(texture.hash, hashes.get(texture.layer), `${texture.layer} must respond to public damage`);
      } else assert.equal(texture.hash, hashes.get(texture.layer), `${texture.layer} must retain the same undamaged cached source`);
    }
    damagedResult.textures = snapshot;
    await captureViews(damaged);
    assert.deepEqual(damaged.errors, []);
    damagedResult.ok = true;
  } catch (error) {
    damagedResult.ok = false; damagedResult.failure = String(error);
    await damaged.page.screenshot({ path: path.join(damaged.caseOut, 'failure.png') }).catch(() => {});
    throw error;
  } finally { await damaged.context.close(); }
  manifest.endingSources = fingerprint();
  assert.deepEqual(manifest.endingSources, sources, 'Source files changed during the run; evidence must be rerun after code is frozen');
  manifest.ok = true;
} catch (error) {
  manifest.ok = false; manifest.failure = String(error); throw error;
} finally {
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ ok: manifest.ok, out, cases: manifest.cases.map(result => ({ name: result.name, ok: result.ok })) }, null, 2));
