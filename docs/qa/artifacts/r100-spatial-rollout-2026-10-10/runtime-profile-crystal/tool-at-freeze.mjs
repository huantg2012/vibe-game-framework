/** Spatial rollout single-case causal diagnostic. Normal 61.2s keyboard input;
 * extra synchronous wrappers / V8 sampling never qualify runtime budgets.
 * --freeze records the current failed case and immutable browser source; --run
 * is a separate, operator-scheduled action. Neither mode changes game state. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const artifactRoot = 'docs/qa/artifacts/r100-spatial-rollout-2026-10-10';
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? `${artifactRoot}/runtime-profile-crystal`);
const planPath = path.join(out, 'policy-freeze.json');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({ path: path.relative(process.cwd(), path.resolve(file)), sha256: sha(file) });
const write = (name, value) => fs.writeFileSync(path.join(out, name), `${JSON.stringify(value, null, 2)}\n`);
const power = () => ({ battery: execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' }).trim(),
  processInfo: JSON.parse(execFileSync('osascript', ['-l', 'JavaScript', '-e', 'ObjC.import("Foundation"); JSON.stringify({lowPowerModeEnabled:$.NSProcessInfo.processInfo.isLowPowerModeEnabled,thermalState:Number($.NSProcessInfo.processInfo.thermalState)})'], { encoding: 'utf8' })) });
const keys = ['d', 'w', 'a', 's', 'd', 's', 'a', 'w', 'd', 'w', 'a', 's'];
async function verifySource(snapshot, gameUrl) {
  assert(snapshot.root && Object.keys(snapshot.files ?? {}).length, 'A complete immutable source snapshot is required');
  for (const [file, expected] of Object.entries(snapshot.files)) {
    assert.equal(sha(path.join(snapshot.root, file)), expected, `Frozen browser source changed: ${file}`);
  }
  const response = await fetch(`${gameUrl}/source-snapshot.json`);
  assert(response.ok, 'The configured server must expose its immutable source snapshot');
  assert.deepEqual(await response.json(), snapshot, 'Server does not match the failed sample source snapshot');
}

assert.equal(Number(process.argv.includes('--freeze')) + Number(process.argv.includes('--run')), 1, 'Use exactly one of --freeze or --run');
if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(out), 'Never overwrite a diagnostic freeze or failure');
  const world = process.env.QA_WORLD ?? 'crystal-fibre';
  assert(/^[a-z][a-z0-9-]*$/.test(world), 'QA_WORLD must be a native world ID');
  const failurePath = process.env.QA_FAILURE_REPORT ?? `${artifactRoot}/runtime-release/report.json`;
  const sourcePath = process.env.QA_SOURCE_SNAPSHOT ?? `${artifactRoot}/runtime-release/source-snapshot.json`;
  // Capture the bytes once: the original seven-case report may still be appended.
  const failureBytes = fs.readFileSync(failurePath), failures = JSON.parse(failureBytes);
  const selectedCase = failures.cases.find(row => row.world === world && row.grade === 'severe' && row.seed === 20261004);
  assert(selectedCase && selectedCase.budgetPass === false, 'Freeze only an already measured failing case with identical input');
  const snapshot = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const gameUrl = (process.env.GAME_URL ?? 'http://127.0.0.1:3046').replace(/\/$/, '');
  await verifySource(snapshot, gameUrl);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'failure-report-at-freeze.json'), failureBytes);
  write('source-snapshot.json', snapshot);
  write('policy-freeze.json', { createdAt: new Date().toISOString(),
    purpose: 'One causal diagnostic for an observed spatial-rollout budget failure; not a repeat qualification attempt or natural exploration playtest.',
    authorization: 'Director assigned this independent spatial-rollout profiler; --run remains a separately scheduled action to avoid concurrent browser sampling.',
    tools: [ref('tools/spatial-rollout/profile-runtime.mjs'), ref('tools/qa/check-r100-i14-runtime-budget.mjs')],
    sources: [ref(path.join(out, 'failure-report-at-freeze.json')), ref(path.join(out, 'source-snapshot.json'))],
    originalFailureReport: { path: failurePath, sha256AtCapture: crypto.createHash('sha256').update(failureBytes).digest('hex'), statusAtCapture: failures.status,
      note: 'Append-only case results can continue after freeze; this preserved copy is the diagnostic input.' },
    originalSourceSnapshot: ref(sourcePath), selectedCase: { world, grade: selectedCase.grade, seed: selectedCase.seed,
      frames: selectedCase.frames, cpu: selectedCase.cpu, materialSubmit: selectedCase.materialSubmit },
    gameUrl, world, grade: 'severe', seed: 20261004, keys, heldMs: 5100,
    changes: ['Synchronous duration wrappers: original material stages plus scene update, visibility, AI, hosts, pose/depth, minimap, presentation sync and frame commit.',
      'CDP V8 CPU sampling at 1000us; retain complete profile and raw stage samples. Durations are inclusive and overlapping, not additive.',
      'Original PRE_STEP intervals / PRE_STEP to POST_STEP submission aggregates; not GPU duration.'],
    unchanged: ['Normal body, visibility, enemies, damage, resources and time; the same twelve held keys for 61.2 seconds.',
      'Source/data frozen server; no fixture injection, teleports, visibility override, clock changes, power changes or user-app manipulation.'],
    limitations: ['Shared reference machine; external activity is not excluded.', 'Instrumentation changes timing: all outcomes remain diagnostic-only.',
      'Static assets and installed dependencies are linked by the original source snapshot, not independently frozen by this profiler.'], powerAtFreeze: power() });
  console.log(planPath);
  process.exit(0);
}

const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
for (const item of [...plan.tools, ...plan.sources]) assert.equal(sha(item.path), item.sha256, `Frozen dependency changed: ${item.path}`);
assert(!fs.existsSync(path.join(out, 'report.json')), 'Never overwrite the first profile, including failed attempts');
const snapshot = JSON.parse(fs.readFileSync(path.join(out, 'source-snapshot.json'), 'utf8'));
await verifySource(snapshot, plan.gameUrl);
const report = { status: 'starting', startedAt: new Date().toISOString(), plan: ref(planPath),
  world: plan.world, grade: plan.grade, seed: plan.seed, powerBefore: power(), instrumentationOnly: true, budgetQualification: false, errors: [] };
write('report.json', report);
let browser;
try {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  report.browser = browser.version(); report.status = 'running'; write('report.json', report);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(`${plan.gameUrl}/r100-gym.html?world=${plan.world}&grade=${plan.grade}&seed=${plan.seed}`);
  await page.waitForFunction(() => window.__r100Gym?.getState().runtime.running, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const game = audioManager.game, scene = game.scene.getScene('RiftScene'), runtime = scene.devRuntime;
    const state = { start: scene.probeBuildLabState(), stages: {}, frames: [], cpu: [], material: [], positions: [], restorers: [],
      dimensions: { width: runtime.renderer.canvas.width, height: runtime.renderer.canvas.height,
        actorMasks: runtime.actorMasks.length, sourceLights: runtime.phaseSources.length, staticActorCacheBytes: runtime.actorOcclusionField.byteLength } };
    const wrap = (object, key, label) => {
      if (typeof object?.[key] !== 'function') throw new Error(`Missing real stage ${label}`);
      const original = object[key], owned = Object.hasOwn(object, key), values = state.stages[label] = [];
      object[key] = function (...args) { const began = performance.now(); try { return original.apply(this, args); }
        finally { values.push(performance.now() - began); } };
      state.restorers.push(() => { if (owned) object[key] = original; else delete object[key]; });
    };
    wrap(runtime, 'afterUpdate', 'afterUpdateTotal');
    wrap(runtime.renderer, 'draw', 'materialGLSubmit');
    wrap(runtime.texture.source[0], 'update', 'phaserTextureUpdate');
    wrap(runtime, 'drawStress', 'stressGeometry');
    wrap(runtime, 'maskActor', 'actorMasks');
    wrap(runtime.audio, 'update', 'materialAudio');
    wrap(runtime.context, 'readPresentationFrame', 'readPresentationFrame');
    wrap(runtime.context, 'readPollutionSources', 'readPollutionSources');
    wrap(scene, 'update', 'sceneUpdate');
    wrap(scene.visibility, 'update', 'visibilityUpdate');
    wrap(scene.ai, 'update', 'aiUpdate'); wrap(scene.ai, 'postUpdate', 'aiPostUpdate');
    wrap(scene.hosts, 'update', 'hostsUpdate');
    wrap(scene, 'syncSchemeDPoses', 'actorPoses');
    if (scene.groundDepthSorter) wrap(scene.groundDepthSorter, 'update', 'groundDepth');
    wrap(scene, 'syncMinimapExploration', 'minimapExploration');
    wrap(scene.minimap, 'update', 'minimapUpdate');
    wrap(scene, 'syncDevPresentation', 'presentationSync');
    wrap(scene, 'commitRuntimeFrame', 'frameCommit');
    let previous = 0, before = 0;
    state.pre = () => { const now = performance.now(); if (previous) state.frames.push(now - previous); previous = now; before = now; };
    state.post = () => { state.cpu.push(performance.now() - before); state.material.push(runtime.snapshot().lastRenderMs); };
    game.events.on('prestep', state.pre); game.events.on('poststep', state.post);
    window.__spatialRuntimeProfile = state;
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await page.locator('#game-container').focus();
  for (const key of plan.keys) {
    await page.keyboard.down(key); await page.waitForTimeout(plan.heldMs); await page.keyboard.up(key);
    await page.evaluate(() => window.__spatialRuntimeProfile.positions.push(window.__r100Gym.getState().runtime.probe));
  }
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Profiler.disable');
  const sample = await page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const state = window.__spatialRuntimeProfile, game = audioManager.game;
    game.events.off('prestep', state.pre); game.events.off('poststep', state.post);
    for (const restore of state.restorers.reverse()) restore();
    return { start: state.start, end: window.__r100Gym.getState().runtime.probe, positions: state.positions, dimensions: state.dimensions,
      frames: state.frames, cpu: state.cpu, material: state.material, stages: state.stages };
  });
  write('raw-stages.json', sample); write('v8.cpuprofile', profile);
  const stats = values => { const sorted = [...values].sort((a, b) => a - b); return { count: sorted.length, total: sorted.reduce((a, b) => a + b, 0),
    p50: sorted[Math.floor(sorted.length * .5)] ?? null, p95: sorted[Math.floor(sorted.length * .95)] ?? null,
    p99: sorted[Math.floor(sorted.length * .99)] ?? null, max: sorted.at(-1) ?? null }; };
  report.measurements = { duration: sample.end.elapsedMs - sample.start.elapsedMs, alive: !sample.end.ended, start: sample.start, end: sample.end,
    dimensions: sample.dimensions, frames: stats(sample.frames), cpu: stats(sample.cpu), materialAggregate: stats(sample.material),
    stages: Object.fromEntries(Object.entries(sample.stages).map(([name, values]) => [name, stats(values)])) };
  await page.screenshot({ path: path.join(out, 'end.png') });
  report.artifacts = ['raw-stages.json', 'v8.cpuprofile', 'end.png'].map(name => ref(path.join(out, name)));
  assert.deepEqual(report.errors, []);
  await verifySource(snapshot, plan.gameUrl);
  report.sourceVerifiedAfter = true;
  report.status = 'completed-diagnostic-only';
} catch (error) { report.status = 'failed'; report.failure = String(error.stack ?? error); process.exitCode = 1; }
finally {
  if (browser) await browser.close();
  report.browsersClosed = true; report.finishedAt = new Date().toISOString();
  try { report.powerAfter = power(); } catch (error) { report.powerReadFailure = String(error); }
  write('report.json', report);
}
console.log(JSON.stringify({ status: report.status, stages: report.measurements?.stages, failure: report.failure }));
