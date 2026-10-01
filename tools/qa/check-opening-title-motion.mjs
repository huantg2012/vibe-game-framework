/** F-title motion only. A fresh headless context protects the user's browser and
 * records; native entry/return exercise scene ownership without repeating the
 * navigation/transaction suite. Browser blur is explicitly dispatched, rather
 * than claiming an operating-system window-focus test.
 *
 * OPENING_TITLE_MOTION_URL / OPENING_TITLE_MOTION_OUT / PLAYWRIGHT_MODULE /
 * CHROMIUM_EXECUTABLE_PATH override local defaults. The optional 8s WebM copies
 * the actual F image + live motion canvas; it excludes DOM menu text and audio.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const playwrightModule = process.env.PLAYWRIGHT_MODULE
  ?? pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href;
const { chromium } = await import(playwrightModule).catch(error => {
  throw new Error('Playwright runtime unavailable; set PLAYWRIGHT_MODULE to an installed entry point.', { cause: error });
});
const url = process.env.OPENING_TITLE_MOTION_URL ?? 'http://127.0.0.1:3027/docs/art/demos/opening-joint/index.html';
const out = process.env.OPENING_TITLE_MOTION_OUT ?? 'docs/qa/artifacts/opening-title-motion';
const sourceFiles = ['src/scenes/main-menu-scene.ts', 'src/art/title-motion.ts',
  'src/art/title-exterior.ts', 'src/ui/dom/main-menu.css', 'docs/art/demos/opening-joint/entry.ts', 'docs/art/demos/opening-joint/title-motion.ts',
  'docs/art/demos/opening-joint/style.css', 'docs/art/demos/opening-joint/assets/title/candidates/f.png'];
const fingerprint = () => Object.fromEntries(sourceFiles.map(file => [file,
  createHash('sha256').update(readFileSync(file)).digest('hex')]));
const sourceFingerprints = fingerprint();
const started = new Date().toISOString();
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const checks = [], samples = [], errors = [], failedRequests = [];
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext({ viewport: { width: 1100, height: 800 } });
await context.route('**/__title-motion-storage-probe', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
const probe = await context.newPage();
await probe.goto(new URL('/__title-motion-storage-probe', url).href);
await probe.evaluate(() => localStorage.setItem('coh-save-v1', 'title-motion-protected-record'));
const page = await context.newPage();
page.on('pageerror', error => errors.push(String(error)));
page.on('response', response => { if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() }); });
const wait = milliseconds => page.waitForTimeout(milliseconds);
const sample = async label => {
  const value = await page.locator('.joint-title-motion').evaluate(async canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const hash = await crypto.subtle.digest('SHA-256', pixels);
    let visiblePixels = 0, menuSafetyPixels = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) {
      visiblePixels++; if (((i - 3) / 4) % canvas.width < 360) menuSafetyPixels++;
    }
    return { time: Number(canvas.dataset.motionTime), width: canvas.width, height: canvas.height, visiblePixels, menuSafetyPixels,
      sha256: Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('') };
  });
  assert(Number.isFinite(value.time), 'The actual motion canvas must expose its scene clock');
  samples.push({ label, ...value });
  assert.equal(value.menuSafetyPixels, 0, `${label}: x < 360 menu safety region must remain transparent`);
  return value;
};
const assertFrozen = (a, b, label) => {
  assert.equal(b.time, a.time, `${label}: scene clock must freeze`);
  assert.equal(b.sha256, a.sha256, `${label}: canvas pixels must freeze`);
};
const assertAdvanced = (a, b, label) => {
  assert(b.time > a.time, `${label}: scene clock must advance`);
  assert.notEqual(b.sha256, a.sha256, `${label}: real RGBA pixels must change`);
};

async function recordActualMotion() {
  const clip = await page.evaluate(async () => {
    const motion = document.querySelector('.joint-title-motion');
    const art = document.querySelector('.joint-art');
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
      .find(type => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type));
    if (!mimeType || !HTMLCanvasElement.prototype.captureStream) return { supported: false };
    const canvas = document.createElement('canvas'); canvas.width = motion.width; canvas.height = motion.height;
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    const chunks = []; let raf = 0, compositeSamples = 0;
    const started = performance.now();
    const stopped = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = resolve; recorder.onerror = event => reject(new Error(event.error?.message ?? 'MediaRecorder failed'));
    });
    const draw = () => {
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
      ctx.drawImage(motion, 0, 0); compositeSamples++;
      if (performance.now() - started < 8000) raf = requestAnimationFrame(draw);
      else recorder.stop();
    };
    recorder.start(); draw();
    try {
      await stopped;
      const blob = new Blob(chunks, { type: mimeType });
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob);
      });
      return { supported: true, mimeType, durationMs: performance.now() - started, compositeSamples,
        width: canvas.width, height: canvas.height, requestedCaptureFps: 30, bytes: blob.size, dataUrl };
    } finally { cancelAnimationFrame(raf); stream.getTracks().forEach(track => track.stop()); }
  });
  if (clip.supported) {
    await writeFile(path.join(out, 'f-title-motion.webm'), Buffer.from(clip.dataUrl.split(',')[1], 'base64'));
    delete clip.dataUrl;
    assert(clip.bytes > 1000 && clip.compositeSamples > 20, 'Motion recording must contain actual frames');
  }
  return clip;
}

async function measureCompositeFrameDelta() {
  const box = await page.locator('#game-container').boundingBox();
  assert(box && Math.round(box.width) === 960 && Math.round(box.height) === 640);
  const crop = { left: Math.round(box.x), top: Math.round(box.y), width: 960, height: 640 };
  const animated = await sharp(path.join(out, 'f-title-after-8s.png')).extract(crop).removeAlpha().raw().toBuffer();
  const still = await sharp(path.join(out, 'f-title-initial-reduced.png')).extract(crop).removeAlpha().raw().toBuffer();
  const regions = { scene: { x: 0, y: 0, w: 960, h: 640 }, menuSafety: { x: 0, y: 0, w: 360, h: 640 },
    coreInterior: { x: 794, y: 237, w: 47, h: 67 }, furnaceGrille: { x: 662, y: 354, w: 42, h: 51 },
    distantAir: { x: 405, y: 55, w: 235, h: 585 } };
  const measurements = {};
  for (const [name, r] of Object.entries(regions)) {
    let changedPixels = 0, sum = 0, maxChannelDelta = 0;
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
      const i = (y * 960 + x) * 3; let changed = false;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(animated[i + c] - still[i + c]); sum += d;
        if (d > 0) changed = true; maxChannelDelta = Math.max(maxChannelDelta, d);
      }
      if (changed) changedPixels++;
    }
    measurements[name] = { bounds: r, changedPixels, totalPixels: r.w * r.h,
      meanChannelDeltaOnChangedPixels: changedPixels ? sum / (changedPixels * 3) : 0, maxChannelDelta };
  }
  assert.equal(measurements.menuSafety.changedPixels, 0, 'Final rendered menu region must be unchanged too');
  await writeFile(path.join(out, 'frame-delta.json'), JSON.stringify({
    method: 'Actual animated browser screenshot versus initially reduced-motion screenshot with independently verified zero-alpha motion canvas. Absolute RGB differences (0-255).',
    crop, sources: { animated: 'f-title-after-8s.png', still: 'f-title-initial-reduced.png' }, measurements,
    limitations: ['One observed phase, not a visibility or aesthetic acceptance threshold.',
      'Regions measure the composite and may overlap scene details; they do not isolate individual effect layers.'],
  }, null, 2));
}

try {
  await page.goto(url);
  await page.locator('.joint-action:enabled').waitFor({ timeout: 60000 });
  assert.equal(await page.locator('body').getAttribute('data-title-variant'), 'f');
  assert.match(await page.locator('.joint-art').getAttribute('src'), /\/candidates\/f\.png$/);
  assert.equal(await page.locator('.joint-title-motion').count(), 1);
  checks.push('default entry loads F and exactly one motion canvas');
  const originalCanvas = await page.locator('.joint-title-motion').elementHandle();
  await wait(300);
  const initial = await sample('initial'); await wait(650); const animated = await sample('after-650ms');
  assertAdvanced(initial, animated, 'ordinary playback'); assert(animated.visiblePixels > 0);
  checks.push('scene time advances and real canvas RGBA pixels change');
  await page.screenshot({ path: path.join(out, 'f-title-start.png') });
  const recording = await recordActualMotion().catch(error => ({ supported: false, reason: String(error) }));
  if (!recording.supported) await wait(650);
  await page.screenshot({ path: path.join(out, 'f-title-after-8s.png') });
  const recorded = await sample('after-recording'); assertAdvanced(animated, recorded, 'recorded playback');
  checks.push(recording.supported ? '8-second WebM captures actual artwork plus live motion' : 'WebM unavailable in this runtime; frame/pixel checks remain authoritative');

  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const blurred = await sample('blurred'); await wait(450); const stillBlurred = await sample('blurred-after-450ms');
  assertFrozen(blurred, stillBlurred, 'blur pause'); checks.push('dispatched browser blur freezes clock and pixels');
  await page.keyboard.press('x'); await wait(600); const refocused = await sample('focus-resumed');
  assertAdvanced(stillBlurred, refocused, 'focus resume'); checks.push('keyboard resume restores actual animation');

  await page.emulateMedia({ reducedMotion: 'reduce' }); await wait(100);
  const reduced = await sample('reduced-motion'); await wait(450); const stillReduced = await sample('reduced-motion-after-450ms');
  assertFrozen(reduced, stillReduced, 'reduced-motion preference');
  assert.equal(reduced.visiblePixels, 0, 'Reduced motion must clear the overlay and show the unchanged F illustration, not freeze the last animated frame');
  assert.equal(stillReduced.visiblePixels, 0, 'Overlay must stay clear while reduced motion is requested');
  checks.push('reduced-motion clears the overlay to the original F illustration and freezes its clock');
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await wait(600);
  const restored = await sample('motion-preference-restored'); assertAdvanced(stillReduced, restored, 'motion preference resume');
  checks.push('restoring motion preference resumes pixels and clock');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.dataset.openingPhase === 'playing', null, { timeout: 30000 });
  assert.equal(await page.locator('#game-container > canvas').getAttribute('data-last-light-asset-root'), '/docs/art/demos/opening-joint/assets/haven/');
  assert.equal(await page.locator('.joint-title-motion').count(), 0);
  assert.equal(await originalCanvas.evaluate(canvas => canvas.isConnected), false);
  const detachedTime = await originalCanvas.evaluate(canvas => canvas.dataset.motionTime);
  await wait(300); assert.equal(await originalCanvas.evaluate(canvas => canvas.dataset.motionTime), detachedTime);
  await page.screenshot({ path: path.join(out, 'entered-haven.png') });
  checks.push('real haven entry removes the original motion instance and stops its clock');

  await page.locator('#return-title').click();
  await page.locator('.joint-action:enabled').first().waitFor({ timeout: 30000 });
  assert.equal(await page.locator('.joint-title-motion').count(), 1);
  assert.equal(await originalCanvas.evaluate(canvas => canvas.isConnected), false);
  const returned = await sample('returned-title'); await wait(600); const returnedActive = await sample('returned-title-after-600ms');
  assert(returned.time < restored.time, 'Returning must construct a fresh title animation clock');
  assertAdvanced(returned, returnedActive, 'return animation');
  checks.push('return creates exactly one new F motion instance and playback resumes');
  await originalCanvas.dispose();

  // A fresh document may start with the preference already enabled: it must
  // expose a valid zero clock and retain only the untouched F illustration.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.locator('.joint-action:enabled').first().waitFor({ timeout: 60000 });
  assert.equal(await page.locator('.joint-title-motion').count(), 1);
  const reducedAtLoad = await sample('initial-reduced-motion');
  assert.equal(reducedAtLoad.visiblePixels, 0, 'Initially reduced-motion overlay must be transparent');
  assert.equal(reducedAtLoad.time, 0, 'Initially reduced-motion clock must be finite and zero');
  await wait(350); const reducedLoadStill = await sample('initial-reduced-motion-after-350ms');
  assertFrozen(reducedAtLoad, reducedLoadStill, 'initial reduced-motion preference');
  await page.screenshot({ path: path.join(out, 'f-title-initial-reduced.png') });
  await measureCompositeFrameDelta();
  await page.emulateMedia({ reducedMotion: 'no-preference' }); await wait(600);
  const initiallyReducedResume = await sample('initially-reduced-then-resumed');
  assertAdvanced(reducedLoadStill, initiallyReducedResume, 'initial reduced-motion resume');
  assert(initiallyReducedResume.visiblePixels > 0);
  checks.push('initial reduced-motion load has a zero-alpha overlay and finite zero clock; disabling it restores motion');

  assert.equal(await probe.evaluate(() => localStorage.getItem('coh-save-v1')), 'title-motion-protected-record');
  checks.push('original-origin storage sentinel remains untouched');
  checks.push('every sampled frame leaves the x < 360 menu safety region fully transparent');
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  assert.deepEqual(fingerprint(), sourceFingerprints, 'Source changed during the motion check; regenerate final evidence after edits finish.');
  const report = { ok: true, started, revision, url, sourceFingerprints, checks, samples, recording, errors, failedRequests, compositeFrameDelta: 'frame-delta.json',
    method: 'One fresh headless Chromium context; production-origin sentinel in a separate blank page. F loaded through default DEV entry; native Enter and Return button own scene transitions. Read-only motion pixel and DOM probes.',
    limitations: ['Finite local lifecycle check, not human aesthetic acceptance or sustained performance certification.',
      'Browser blur is a dispatched event. The optional 8-second WebM composites the actual image and actual motion canvas, excluding DOM text and audio.',
      'Navigation, inventory transactions and Rift recovery are outside this motion-only check.'] };
  await writeFile(path.join(out, 'result.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, checks, recording, errors, failedRequests, output: out }));
} catch (error) {
  if (!page.isClosed()) await page.screenshot({ path: path.join(out, 'failure.png') });
  await writeFile(path.join(out, 'failure.json'), JSON.stringify({ ok: false, started, error: String(error), checks, samples, errors, failedRequests }, null, 2));
  throw error;
} finally { await browser.close(); }
