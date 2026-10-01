/** Exterior-specific F-title evidence. Reuses the established lifecycle checker;
 * its own fresh browser then records actual title playback and separately calls
 * the actual exported exterior renderer to inspect its transparent layer.
 * No game storage, playback controls, or product debug markers are invented.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const out = process.env.OPENING_TITLE_EXTERIOR_OUT ?? 'docs/qa/artifacts/opening-title-exterior';
const url = process.env.OPENING_TITLE_EXTERIOR_URL ?? 'http://127.0.0.1:3027/docs/art/demos/opening-joint/index.html';
const durationMs = Number(process.env.OPENING_TITLE_EXTERIOR_DURATION_MS ?? 20000);
assert(Number.isFinite(durationMs) && durationMs >= 19000 && durationMs <= 45000,
  'Capture must cover the first exterior event, without an unbounded recording');
const started = new Date().toISOString();
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const sourceFiles = ['src/scenes/main-menu-scene.ts', 'src/art/title-motion.ts',
  'src/art/title-exterior.ts', 'src/ui/dom/main-menu.css', 'docs/art/demos/opening-joint/entry.ts', 'docs/art/demos/opening-joint/title-motion.ts',
  'docs/art/demos/opening-joint/title-exterior.ts', 'docs/art/demos/opening-joint/style.css',
  'docs/art/demos/opening-joint/assets/title/candidates/f.png'];
const fingerprint = () => Object.fromEntries(sourceFiles.map(file => [file,
  createHash('sha256').update(readFileSync(file)).digest('hex')]));
const sourceFingerprints = fingerprint();
const baselineRevision = process.env.OPENING_TITLE_EXTERIOR_BASELINE_REVISION;
let baseline = null;
if (baselineRevision) {
  assert(/^[a-f0-9]{7,40}$/i.test(baselineRevision), 'Use a concrete accepted commit for exterior preservation checks');
  const source = execFileSync('git', ['show', `${baselineRevision}:docs/art/demos/opening-joint/title-exterior.ts`], { encoding: 'utf8' });
  const { transform } = await import('esbuild');
  baseline = { revision: baselineRevision, sha256: createHash('sha256').update(source).digest('hex'),
    code: (await transform(source, { loader: 'ts', format: 'esm', target: 'es2022' })).code };
}
await mkdir(out, { recursive: true });

// This remains the single implementation of the actual entry/return, storage,
// pause and reduced-motion contract. The new module participates through its
// real owner, JointTitleMotion, rather than a second fake scene.
const lifecycleOut = path.join(out, 'lifecycle');
execFileSync(process.execPath, ['tools/qa/check-opening-title-motion.mjs'], {
  env: { ...process.env, OPENING_TITLE_MOTION_URL: url, OPENING_TITLE_MOTION_OUT: lifecycleOut },
  stdio: 'inherit', timeout: 90000,
});
const lifecycle = JSON.parse(readFileSync(path.join(lifecycleOut, 'result.json'), 'utf8'));
assert.equal(lifecycle.ok, true);

const playwrightModule = process.env.PLAYWRIGHT_MODULE
  ?? pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href;
const { chromium } = await import(playwrightModule);
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await context.newPage();
const errors = [], failedRequests = [], checks = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
const regions = {
  farCorridor: { x: 690, y: 40, w: 100, h: 160 },
  middleGap: { x: 545, y: 260, w: 75, h: 70 },
  deepWell: { x: 490, y: 510, w: 60, h: 110 },
};

try {
  await page.goto(url);
  await page.locator('.joint-action:enabled').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('body').getAttribute('data-title-variant'), 'f');
  assert.equal(await page.locator('.joint-title-motion').count(), 1);
  await page.screenshot({ path: path.join(out, 'f-title-exterior-start.png') });

  const recording = await page.evaluate(async ({ durationMs, regions }) => {
    const motion = document.querySelector('.joint-title-motion'), art = document.querySelector('.joint-art');
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type =>
      typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
    if (!mimeType || !HTMLCanvasElement.prototype.captureStream) return { supported: false };
    const composite = document.createElement('canvas'); composite.width = 960; composite.height = 640;
    const ctx = composite.getContext('2d', { willReadFrequently: true }); ctx.imageSmoothingEnabled = false;
    const stream = composite.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks = [], samples = [], snapshots = [], previous = {}, frameIntervals = [];
    let raf = 0, nextSample = 0, frames = 0, lastFrameTime = null;
    const start = performance.now(), startSceneTime = Number(motion.dataset.motionTime);
    const stopped = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = resolve; recorder.onerror = event => reject(new Error(event.error?.message ?? 'MediaRecorder failed'));
    });
    const draw = () => {
      const frameTime = performance.now();
      if (lastFrameTime !== null) frameIntervals.push(frameTime - lastFrameTime);
      lastFrameTime = frameTime;
      ctx.clearRect(0, 0, 960, 640); ctx.drawImage(art, 0, 0, 960, 640); ctx.drawImage(motion, 0, 0); frames++;
      const elapsedMs = performance.now() - start;
      if (elapsedMs >= nextSample) {
        const measures = {};
        for (const [name, r] of Object.entries(regions)) {
          const pixels = ctx.getImageData(r.x, r.y, r.w, r.h).data; let changedPixels = 0, sum = 0, maxChannelDelta = 0;
          const last = previous[name];
          if (last) for (let i = 0; i < pixels.length; i += 4) {
            let changed = false;
            for (let c = 0; c < 3; c++) {
              const d = Math.abs(pixels[i + c] - last[i + c]); sum += d; maxChannelDelta = Math.max(maxChannelDelta, d);
              if (d) changed = true;
            }
            if (changed) changedPixels++;
          }
          measures[name] = { changedPixels, meanChannelDelta: sum / (r.w * r.h * 3), maxChannelDelta };
          previous[name] = pixels;
        }
        samples.push({ elapsedMs, sceneTime: Number(motion.dataset.motionTime), measures });
        nextSample += 500;
      }
      const seconds = elapsedMs / 1000;
      if (snapshots.length < 4 && seconds >= [2, 9, 13, 19][snapshots.length]) {
        snapshots.push({ elapsedMs, sceneTime: Number(motion.dataset.motionTime), png: composite.toDataURL('image/png') });
      }
      if (elapsedMs < durationMs) raf = requestAnimationFrame(draw); else recorder.stop();
    };
    recorder.start(); draw();
    try {
      await stopped;
      const blob = new Blob(chunks, { type: mimeType });
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      const sortedIntervals = frameIntervals.slice().sort((a, b) => a - b);
      const meanMs = frameIntervals.reduce((sum, value) => sum + value, 0) / frameIntervals.length;
      const frameCadence = { sampleCount: frameIntervals.length, meanMs, approximateFps: 1000 / meanMs,
        p95Ms: sortedIntervals[Math.floor(sortedIntervals.length * .95)],
        p99Ms: sortedIntervals[Math.floor(sortedIntervals.length * .99)],
        maxMs: sortedIntervals.at(-1), above33ms: frameIntervals.filter(ms => ms > 33.4).length,
        above50ms: frameIntervals.filter(ms => ms > 50).length };
      return { supported: true, mimeType, durationMs: performance.now() - start, frames, bytes: blob.size,
        requestedCaptureFps: 30, width: 960, height: 640, startSceneTime, endSceneTime: Number(motion.dataset.motionTime),
        frameCadence, samples, snapshots, dataUrl };
    } finally { cancelAnimationFrame(raf); stream.getTracks().forEach(track => track.stop()); }
  }, { durationMs, regions });
  assert(recording.supported && recording.bytes > 10000 && recording.frames > 100, 'Actual exterior video must contain frames');
  assert(recording.endSceneTime - recording.startSceneTime > 18, 'Capture must span the event using the real scene clock');
  assert(recording.samples.every((sample, i) => i === 0 || sample.sceneTime >= recording.samples[i - 1].sceneTime),
    'Natural recording must retain one monotonic scene clock, without HMR resetting the title');
  await writeFile(path.join(out, 'f-title-exterior.webm'), Buffer.from(recording.dataUrl.split(',')[1], 'base64'));
  delete recording.dataUrl;
  for (let i = 0; i < recording.snapshots.length; i++) {
    const snapshot = recording.snapshots[i], file = `f-title-exterior-frame-${i + 1}.png`;
    await writeFile(path.join(out, file), Buffer.from(snapshot.png.split(',')[1], 'base64'));
    delete snapshot.png; snapshot.file = file;
  }
  await writeFile(path.join(out, 'natural-playback.json'), JSON.stringify({ regions, ...recording }, null, 2));
  for (const name of Object.keys(regions)) {
    const early = recording.samples.filter(sample => sample.elapsedMs > 400 && sample.elapsedMs < 3500);
    assert(early.some(sample => sample.measures[name].changedPixels > 0), `${name}: actual exterior changes during the first three seconds`);
  }
  checks.push('actual default F playback changes in all three exterior depth regions within the first three seconds');
  checks.push('at least 19 seconds of natural playback includes the first event window, with real scene-clock and frame evidence');

  const isolated = await page.evaluate(async ({ regions, baseline }) => {
    const { JointTitleExterior } = await import('/docs/art/demos/opening-joint/title-exterior.ts');
    const art = document.querySelector('.joint-art');
    const base = document.createElement('canvas'); base.width = 960; base.height = 640;
    const baseCtx = base.getContext('2d'); baseCtx.imageSmoothingEnabled = false; baseCtx.drawImage(art, 0, 0, 960, 640);
    const source = baseCtx.getImageData(0, 0, 960, 640).data;
    const exterior = new JointTitleExterior(source), ctx = exterior.canvas.getContext('2d');
    let accepted = null;
    if (baseline) {
      const moduleUrl = URL.createObjectURL(new Blob([baseline.code], { type: 'text/javascript' }));
      try { accepted = new (await import(moduleUrl)).JointTitleExterior(source); }
      finally { URL.revokeObjectURL(moduleUrl); }
    }
    const protectedAreas = {
      menu: { x: 0, y: 0, w: 360, h: 640 },
      seatedActor: { x: 606, y: 350, w: 57, h: 84 },
      furnace: { x: 660, y: 320, w: 57, h: 101 },
      coreEnergy: { x: 799, y: 241, w: 33, h: 56 },
      coreBase: { x: 784, y: 346, w: 68, h: 16 },
      apparatusUpper: { x: 825, y: 209, w: 5, h: 7 },
      foregroundFloor: { x: 660, y: 426, w: 300, h: 174 },
      mainColumn: { x: 636, y: 80, w: 20, h: 130 },
    };
    const sha = async pixels => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', pixels)),
      value => value.toString(16).padStart(2, '0')).join('');
    const snapshots = [], samples = [], preservation = [];
    for (const time of [0, .5, 1, 2, 3, 6, 7, 9, 11, 13, 15, 17, 18, 19, 22, 33, 52]) {
      exterior.draw(time);
      const pixels = ctx.getImageData(0, 0, 960, 640).data;
      if (accepted) {
        accepted.draw(time);
        const previous = accepted.canvas.getContext('2d').getImageData(0, 0, 960, 640).data;
        let changedPixels = 0, maxByteDelta = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          let changed = false;
          for (let c = 0; c < 4; c++) {
            const delta = Math.abs(pixels[i + c] - previous[i + c]);
            if (delta) changed = true;
            maxByteDelta = Math.max(maxByteDelta, delta);
          }
          if (changed) changedPixels++;
        }
        preservation.push({ time, changedPixels, maxByteDelta });
      }
      const protectedPixels = {};
      for (const [name, r] of Object.entries(protectedAreas)) {
        let count = 0;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (pixels[(y * 960 + x) * 4 + 3]) count++;
        protectedPixels[name] = count;
      }
      const measures = {};
      for (const [name, r] of Object.entries(regions)) {
        let visiblePixels = 0, darkenedPixels = 0, darkening = 0, maxDarkening = 0;
        for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
          const i = (y * 960 + x) * 4, alpha = pixels[i + 3] / 255;
          if (alpha) visiblePixels++;
          const sourceValue = (source[i] + source[i + 1] + source[i + 2]) / 3;
          const overlayValue = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
          const delta = Math.max(0, (sourceValue - overlayValue) * alpha);
          if (delta > 1) darkenedPixels++;
          darkening += delta; maxDarkening = Math.max(maxDarkening, delta);
        }
        measures[name] = { visiblePixels, darkenedPixels, meanDarkening: darkening / (r.w * r.h), maxDarkening };
      }
      samples.push({ time, sha256: await sha(pixels), protectedPixels, measures });
      if ([0, 2, 11, 15, 19].includes(time)) snapshots.push({ time, png: exterior.canvas.toDataURL('image/png') });
    }
    exterior.draw(11); const repeatSha256 = await sha(ctx.getImageData(0, 0, 960, 640).data);
    exterior.destroy(); accepted?.destroy();
    return { samples, snapshots, protectedAreas, repeatSha256, afterDestroy: { width: exterior.canvas.width, height: exterior.canvas.height },
      baselineComparison: baseline ? { revision: baseline.revision, sha256: baseline.sha256, phases: preservation } : null };
  }, { regions, baseline });
  for (const snapshot of isolated.snapshots) {
    const file = `exterior-only-${snapshot.time}s.png`;
    await writeFile(path.join(out, file), Buffer.from(snapshot.png.split(',')[1], 'base64'));
    delete snapshot.png; snapshot.file = file;
  }
  await writeFile(path.join(out, 'exterior-layer.json'), JSON.stringify({ regions, ...isolated }, null, 2));
  const coverageFailures = isolated.samples.flatMap(sample => Object.entries(sample.protectedPixels)
    .filter(([, count]) => count > 0).map(([area, visiblePixels]) => ({ time: sample.time, area, visiblePixels })));
  assert.deepEqual(coverageFailures, [], 'Actual exterior layer covers protected foreground or masonry');
  const quietFar = isolated.samples.filter(sample => [0, 2, 3, 6, 19, 22].includes(sample.time))
    .map(sample => sample.measures.farCorridor.darkenedPixels);
  const passageFar = isolated.samples.filter(sample => sample.time > 7 && sample.time < 19)
    .map(sample => sample.measures.farCorridor.darkenedPixels);
  assert(Math.max(...passageFar) > Math.max(...quietFar) + 30,
    'First passage must measurably darken the actual far corridor beyond quiet atmosphere alone');
  assert.equal(isolated.repeatSha256, isolated.samples.find(sample => sample.time === 11).sha256, 'Renderer must be deterministic at an identical supplied scene time');
  assert.notEqual(isolated.samples[0].sha256, isolated.samples.find(sample => sample.time === 2).sha256, 'Exterior alone must evolve before its first event');
  assert.deepEqual(isolated.afterDestroy, { width: 0, height: 0 }, 'Destroy must release the actual exterior canvas surface');
  checks.push('actual exported exterior layer remains transparent over menu, seated actor, furnace, core, foreground floor and main column in 17 sampled phases');
  checks.push('isolated actual exterior renderer changes before the first event and repeats deterministically at identical scene time');
  checks.push('first event measurably darkens the far corridor beyond pre/post-event phases');
  if (isolated.baselineComparison) {
    const quietPhases = isolated.baselineComparison.phases.filter(sample => [0, .5, 1, 2, 3, 6, 7, 19, 22, 33].includes(sample.time));
    assert(quietPhases.every(sample => sample.changedPixels === 0), 'Accepted non-event atmosphere must remain byte-identical to the supplied baseline');
    assert(isolated.baselineComparison.phases.some(sample => sample.time > 7 && sample.time < 19 && sample.changedPixels > 0),
      'The revised event itself must differ from the rejected baseline silhouette');
    checks.push('accepted non-event exterior remains byte-identical to the previous commit in ten phases, while the event changes');
  }
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  assert.deepEqual(fingerprint(), sourceFingerprints, 'Source changed during QA; regenerate final evidence after implementation freezes');
  await writeFile(path.join(out, 'result.json'), JSON.stringify({ ok: true, started, revision, url, sourceFingerprints,
    lifecycle: { result: 'lifecycle/result.json', checks: lifecycle.checks }, checks, regions, recording,
    isolatedEvidence: 'exterior-layer.json', acceptedBaseline: baseline ? { revision: baseline.revision, sha256: baseline.sha256 } : null,
    errors, failedRequests,
    method: 'Actual default DEV scene in a fresh headless context; real image+motion canvas captured naturally. A separate offscreen instance of the actual exported exterior renderer receives the same F pixels for layer-isolation checks.',
    limitations: ['Pixel changes establish animation, not human aesthetic approval or guaranteed subjective visibility.',
      'Offscreen phase samples directly render known scene times; they are not a second natural playback or gameplay session.',
      'Protected rectangles sample important foreground and architectural surfaces; they are not a semantic proof for every source-image pixel.',
      'Frame cadence is a finite local headless capture with recorder, image composition and pixel-probe overhead, not a low-end performance certification.',
      'Video omits DOM menu and audio; dispatched blur and business-entry checks are reused from the linked lifecycle result.'] }, null, 2));
  console.log(JSON.stringify({ ok: true, checks, lifecycleChecks: lifecycle.checks.length, recordingSeconds: recording.durationMs / 1000,
    frameCadence: recording.frameCadence,
    errors, failedRequests, output: out }));
} catch (error) {
  if (!page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') });
  await writeFile(path.join(out, 'failure.json'), JSON.stringify({ ok: false, started, error: String(error), checks, errors, failedRequests }, null, 2));
  throw error;
} finally { await browser.close(); }
