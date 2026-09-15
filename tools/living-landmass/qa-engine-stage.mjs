/** Real-keyboard review of the isolated engine scene. Probes only observe. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const dir = path.resolve(process.env.ARTIFACT_DIR ?? `docs/qa/artifacts/iteration-23/engine-${new Date().toISOString().replace(/[:.]/g, '-')}`);
const evidence = { schema: 1, startedAt: new Date().toISOString(),
  scope: 'Static engine geometry, actual camera, normal production Player movement and physical support. No combat, FOV or inventory validation.',
  method: 'Empty isolated Chrome context. Real keyboard and mouse, normal clock. Read-only scene probe, no teleport or state/time overrides.',
  observations: [], inputs: [], checks: [], errors: [], consoleErrors: [], failedRequests: [], verdict: 'IN-PROGRESS',
  visualVerdict: 'HUMAN-REVIEW-PENDING; technical assertions cannot establish aesthetic acceptance.' };
const sourceFiles = [...execFileSync('rg', ['--files', 'src/dev/living-landmass-stage'], { encoding: 'utf8' }).trim().split('\n'),
  'living-landmass-stage.html', 'src/dev/living-landmass-stage.ts', 'src/dev/spatial-study/stage/actor-pixels.ts',
  'src/dev/spatial-study/stage/actors.ts', 'src/entities/player.ts', 'src/systems/ai/physical-grid.ts',
  'src/systems/tile-grid.ts', 'src/config/game-config.ts', 'tools/living-landmass/qa-engine-stage.mjs'];
async function sources() { return Promise.all(sourceFiles.sort().map(async file => ({ file,
  sha256: createHash('sha256').update(await readFile(file)).digest('hex') }))); }
await mkdir(dir, { recursive: true });
evidence.sourceBefore = await sources();
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, recordVideo: { dir, size: { width: 1440, height: 1000 } } });
const page = await context.newPage();
page.on('pageerror', error => evidence.errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
page.on('response', response => { if (response.status() >= 400) evidence.failedRequests.push({ url: response.url(), status: response.status() }); });
const check = (name, ok, details) => { evidence.checks.push({ name, ok, details }); assert(ok, `${name}: ${JSON.stringify(details)}`); };
async function read() { return page.evaluate(() => window.__livingLandmassStage.getState()); }
function support(state, label) {
  check(`${label}: complete physical support`, state.player.supported, state.player);
  check(`${label}: feet use rendered height`, state.player.feet.every(f => Number.isFinite(f.clearance) && f.clearance >= 1.49 && f.clearance <= 4.51), state.player.feet);
  check(`${label}: no scene errors`, state.errors.length === 0 && state.pageErrors.length === 0, { errors: state.errors, pageErrors: state.pageErrors });
}
async function capture(label) {
  const state = await read(); support(state, label);
  evidence.observations.push({ label, at: new Date().toISOString(), state });
  await page.locator('canvas[data-living-stage]').screenshot({ path: path.join(dir, `${label}.png`) });
  console.log(label, JSON.stringify({ player: { x: state.player.x, y: state.player.y, height: state.player.height }, angle: state.camera.elevation }));
  return state;
}
async function hold(keys, ms, label) {
  const before = await read(); evidence.inputs.push({ keys, ms, label, at: new Date().toISOString(), before: before.player });
  for (const key of keys) await page.keyboard.down(key);
  let middle;
  try { await page.waitForTimeout(ms / 2); middle = await read(); support(middle, `${label} moving`); await page.waitForTimeout(ms / 2); }
  finally { for (const key of [...keys].reverse()) await page.keyboard.up(key); }
  await page.waitForTimeout(180);
  const after = await capture(label);
  evidence.inputs.at(-1).after = after.player;
  evidence.inputs.at(-1).elapsedMs = after.elapsedMs - before.elapsedMs;
  return { before, middle, after, distance: Math.hypot(after.player.x - before.player.x, after.player.y - before.player.y) };
}
try {
  const url = new URL('/living-landmass-stage.html', process.env.GAME_URL ?? 'http://127.0.0.1:3007'); evidence.url = url.href;
  await page.goto(url.href);
  await page.waitForFunction(() => window.__livingLandmassStage?.getState().ready, null, { timeout: 30000 });
  await page.locator('#game-container').click({ position: { x: 16, y: 16 } }); await page.waitForTimeout(500);
  const start = await capture('01-start-50');
  check('default camera is actual orthographic 50', start.camera.projection === 'orthographic' && start.camera.elevation === 50, start.camera);
  check('native 960x640 draw target', start.camera.resolution.width === 960 && start.camera.resolution.height === 640, start.camera.resolution);
  check('real mesh scene', start.geometry.meshes >= 3 && start.geometry.triangles > 1000, start.geometry);
  for (const [key, angle] of [['1',42],['3',58],['2',50]]) {
    evidence.inputs.push({ kind: 'camera-key', key, angle }); await page.keyboard.press(key); await page.waitForTimeout(160);
    const state = await capture(`02-camera-${angle}`);
    check(`camera ${angle} synchronized with actor`, state.camera.elevation === angle && state.actorProjection.elevation === angle, state.actorProjection);
    check(`camera ${angle} does not move player`, Math.hypot(state.player.x - start.player.x, state.player.y - start.player.y) < .01, state.player);
    check(`camera ${angle} same geometry`, JSON.stringify(state.geometry) === JSON.stringify(start.geometry), state.geometry);
  }
  const east = await hold(['d'], 850, '03-east');
  check('east movement exists', east.distance > 20, east.distance);
  check('production speed unchanged', Math.abs(Math.hypot(east.middle.player.velocity.x, east.middle.player.velocity.y) - 80) < .01, east.middle.player.velocity);
  const diag = await hold(['d','w'], 700, '04-diagonal');
  check('diagonal normalized to same speed', Math.abs(Math.hypot(diag.middle.player.velocity.x, diag.middle.player.velocity.y) - 80) < .01, diag.middle.player.velocity);
  const north = await hold(['w'], 1500, '05-north'); check('screen-depth movement exists', north.distance > 20, north.distance);
  await hold(['a'], 1500, '06-bay-rim');
  await hold(['s'], 1800, '07-near-rim');
  const rim = await hold(['s'], 4500, '08-edge-contact');
  const stopped = await hold(['s'], 1000, '09-edge-stop');
  check('air edge blocks continued walking', stopped.distance < .1 && stopped.after.blockedFrames > rim.before.blockedFrames, { distance: stopped.distance, blocked: stopped.after.blockedFrames });
  await hold(['d'], 600, '10-edge-slide');
  // Buttons and real focus transitions must not leave a held key latched.
  await page.keyboard.down('w'); await page.waitForTimeout(150);
  await page.locator('button[data-angle="42"]').click(); await page.keyboard.up('w'); await page.waitForTimeout(200);
  const button = await read(); check('mouse camera control', button.camera.elevation === 42, button.camera);
  const idle = await read(); await page.waitForTimeout(450); const later = await read();
  check('released movement does not drift', Math.hypot(later.player.x-idle.player.x,later.player.y-idle.player.y) < .01, { idle: idle.player, later: later.player });
  check('no storage records created', JSON.stringify(await context.storageState()) === JSON.stringify({ cookies: [], origins: [] }), await context.storageState());
  await page.reload(); await page.waitForFunction(() => window.__livingLandmassStage?.getState().ready, null, { timeout: 30000 });
  const reloaded = await capture('11-reload');
  check('refresh returns to same study spawn', Math.hypot(reloaded.player.x-start.player.x,reloaded.player.y-start.player.y) < .01 && reloaded.camera.elevation === 50, reloaded.player);
  check('one live visible Three canvas after refresh', await page.locator('canvas[data-living-stage]').count() === 1, await page.locator('canvas[data-living-stage]').count());
  check('no browser errors', evidence.errors.length === 0 && evidence.consoleErrors.length === 0 && evidence.failedRequests.length === 0,
    { errors: evidence.errors, console: evidence.consoleErrors, requests: evidence.failedRequests });
  evidence.sourceAfter = await sources();
  check('tested source stayed unchanged', JSON.stringify(evidence.sourceBefore) === JSON.stringify(evidence.sourceAfter), null);
  evidence.verdict = 'TECHNICAL-PASS / HUMAN-VISUAL-REVIEW-PENDING';
} catch (error) {
  evidence.verdict = 'FAILED'; evidence.failure = error.stack ?? String(error);
  console.error(error); process.exitCode = 1;
} finally {
  evidence.endedAt = new Date().toISOString();
  await writeFile(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2));
  await context.close(); await browser.close(); console.log('Artifacts:', dir);
}
