/** I14 single-case causal diagnostic. Extra instrumentation excludes this run
 * from budget qualification. No game behavior, clocks, resources or power change. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i14/runtime-profile');
const planPath = path.join(out, 'policy-freeze.json');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const ref = file => ({ path: file, sha256: sha(file) });
const write = (name, data) => fs.writeFileSync(path.join(out, name), `${JSON.stringify(data, null, 2)}\n`);
const power = () => ({ battery: execFileSync('pmset', ['-g', 'batt'], { encoding: 'utf8' }).trim(),
  processInfo: JSON.parse(execFileSync('osascript', ['-l', 'JavaScript', '-e', 'ObjC.import("Foundation"); JSON.stringify({lowPowerModeEnabled:$.NSProcessInfo.processInfo.isLowPowerModeEnabled,thermalState:Number($.NSProcessInfo.processInfo.thermalState)})'], { encoding: 'utf8' })) });
const keys = ['d', 'w', 'a', 's', 'd', 's', 'a', 'w', 'd', 'w', 'a', 's'];
if (process.argv.includes('--freeze')) {
  assert(!fs.existsSync(out), 'Do not overwrite a diagnostic freeze or failure');
  fs.mkdirSync(out, { recursive: true });
  write('policy-freeze.json', { createdAt: new Date().toISOString(), purpose: 'One causal profile only; not a repeat pass attempt or a natural48 sortie.',
    authorization: 'Root approved one hollow diagnostic after four preregistered failures, before any production decision.',
    tools: [ref('tools/qa/profile-r100-i14-runtime.mjs'), ref('tools/qa/check-r100-i14-runtime-budget.mjs')],
    sources: [ref('docs/qa/artifacts/r100-i14/runtime-policy-freeze.json'), ref('docs/qa/artifacts/r100-i14/runtime-reference/report.json'),
      ref('docs/qa/artifacts/r100-i14/runtime-reference/code-cause-review.json'), ref('docs/qa/artifacts/r100-i14/frozen-source/source-snapshot.json')],
    gameUrl: process.env.GAME_URL ?? 'http://127.0.0.1:3035', world: 'hollow-wreckage', grade: 'severe', seed: 20261004, keys, heldMs: 5100,
    changes: ['Read-only synchronous duration wrappers around afterUpdate, material GL submission, texture update, stress, actor masks, audio and public frame/source reads.',
      'CDP V8 CPU sampling at1000us; preserve full profile and raw stage durations.', 'Record original frame/CPU/material aggregates without granting budget qualification.'],
    unchanged: ['Normal body, visibility, enemies, damage and time; same61.2s held input.', 'Current power settings unchanged; no state fixtures or resource injection.'],
    powerAtFreeze: power() });
  console.log(planPath); process.exit(0);
}
assert(process.argv.includes('--run'), 'Use --freeze or --run');
const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
for (const item of [...plan.tools, ...plan.sources]) assert.equal(sha(item.path), item.sha256, `Frozen dependency changed: ${item.path}`);
assert(!fs.existsSync(path.join(out, 'report.json')), 'Never overwrite the first profile');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = { status: 'running', startedAt: new Date().toISOString(), plan: ref(path.relative(process.cwd(), planPath)), browser: browser.version(),
  powerBefore: power(), instrumentationOnly: true, budgetQualification: false, errors: [] };
write('report.json', report);
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.goto(`${plan.gameUrl.replace(/\/$/, '')}/r100-gym.html?world=${plan.world}&grade=${plan.grade}&seed=${plan.seed}`);
  await page.waitForFunction(() => window.__r100Gym?.getState().runtime.running, null, { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const game = audioManager.game, scene = game.scene.getScene('RiftScene'), runtime = scene.devRuntime;
    const state = { start: scene.probeBuildLabState(), stages: {}, frames: [], cpu: [], material: [], positions: [], restorers: [] };
    const wrap = (object, key, label) => {
      if (typeof object?.[key] !== 'function') throw new Error(`Missing real stage ${label}`);
      const original = object[key], values = state.stages[label] = [];
      object[key] = function (...args) { const began = performance.now(); try { return original.apply(this, args); }
        finally { values.push(performance.now() - began); } };
      state.restorers.push(() => { object[key] = original; });
    };
    wrap(runtime, 'afterUpdate', 'afterUpdateTotal');
    wrap(runtime.renderer, 'draw', 'materialGLSubmit');
    wrap(runtime.texture.source[0], 'update', 'phaserTextureUpdate');
    wrap(runtime, 'drawStress', 'stressGeometry');
    wrap(runtime, 'maskActor', 'actorMasks');
    wrap(runtime.audio, 'update', 'materialAudio');
    wrap(runtime.context, 'readPresentationFrame', 'readPresentationFrame');
    wrap(runtime.context, 'readPollutionSources', 'readPollutionSources');
    let previous = 0, before = 0;
    state.pre = () => { const now = performance.now(); if (previous) state.frames.push(now - previous); previous = now; before = now; };
    state.post = () => { state.cpu.push(performance.now() - before); state.material.push(runtime.snapshot().lastRenderMs); };
    game.events.on('prestep', state.pre); game.events.on('poststep', state.post);
    window.__i14Profile = state;
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
  await cdp.send('Profiler.start');
  await page.locator('#game-container').focus();
  for (const key of plan.keys) {
    await page.keyboard.down(key); await page.waitForTimeout(plan.heldMs); await page.keyboard.up(key);
    await page.evaluate(() => window.__i14Profile.positions.push(window.__r100Gym.getState().runtime.probe));
  }
  const { profile } = await cdp.send('Profiler.stop');
  await cdp.send('Profiler.disable');
  const sample = await page.evaluate(async () => {
    const { audioManager } = await import('/src/managers/audio-manager.ts');
    const s = window.__i14Profile, game = audioManager.game;
    game.events.off('prestep', s.pre); game.events.off('poststep', s.post);
    for (const restore of s.restorers.reverse()) restore();
    return { start: s.start, end: window.__r100Gym.getState().runtime.probe, positions: s.positions,
      frames: s.frames, cpu: s.cpu, material: s.material, stages: s.stages };
  });
  write('raw-stages.json', sample); write('v8.cpuprofile', profile);
  const stats = values => { const sorted = [...values].sort((a, b) => a - b); return { count: sorted.length, total: sorted.reduce((a, b) => a + b, 0),
    p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], p99: sorted[Math.floor(sorted.length * .99)], max: sorted.at(-1) }; };
  report.measurements = { duration: sample.end.elapsedMs - sample.start.elapsedMs, alive: !sample.end.ended, start: sample.start, end: sample.end,
    frames: stats(sample.frames), cpu: stats(sample.cpu), materialAggregate: stats(sample.material), stages: Object.fromEntries(Object.entries(sample.stages).map(([name, values]) => [name, stats(values)])) };
  report.artifacts = [ref(path.relative(process.cwd(), path.join(out, 'raw-stages.json'))), ref(path.relative(process.cwd(), path.join(out, 'v8.cpuprofile')))];
  await page.screenshot({ path: path.join(out, 'end.png') });
  assert.deepEqual(report.errors, []);
  report.status = 'completed-diagnostic-only';
} catch (error) { report.status = 'failed'; report.failure = String(error.stack ?? error); process.exitCode = 1; }
finally { await browser.close(); report.browsersClosed = true; report.finishedAt = new Date().toISOString(); report.powerAfter = power(); write('report.json', report); }
console.log(JSON.stringify({ status: report.status, stages: report.measurements?.stages, failure: report.failure }));
