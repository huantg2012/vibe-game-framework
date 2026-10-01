/** Compare two actual title recordings at equal 200ms intervals, after both
 * have been recorded by check-opening-title-motion.mjs. Measures rendered
 * temporal change, never interprets a parameter ratio as perceived strength.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const playwrightModule = process.env.PLAYWRIGHT_MODULE
  ?? pathToFileURL(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href;
const { chromium } = await import(playwrightModule);
const origin = process.env.OPENING_TITLE_MOTION_ORIGIN ?? 'http://127.0.0.1:3027';
const baselineRoot = process.env.OPENING_TITLE_MOTION_BASELINE ?? 'docs/qa/artifacts/opening-title-motion';
const currentRoot = process.env.OPENING_TITLE_MOTION_OUT ?? 'docs/qa/artifacts/opening-title-motion-strong';
const oldReport = JSON.parse(await fs.readFile(path.join(baselineRoot, 'result.json'), 'utf8'));
const newReport = JSON.parse(await fs.readFile(path.join(currentRoot, 'result.json'), 'utf8'));
const artPath = 'docs/art/demos/opening-joint/assets/title/candidates/f.png';
assert.equal(oldReport.sourceFingerprints[artPath], newReport.sourceFingerprints[artPath], 'Both recordings must use the same fixed F artwork');
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const context = await browser.newContext();
const page = await context.newPage();
await page.route('**/__motion-compare', route => route.fulfill({ contentType: 'text/html', body: '<html></html>' }));
await page.goto(origin + '/__motion-compare');
try {
  const analyze = async root => page.evaluate(async url => {
    const video = document.createElement('video'); video.muted = true; video.preload = 'auto';
    const load = new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('Could not decode recording')), { once: true });
    });
    video.src = url; await load;
    if (video.videoWidth !== 960 || video.videoHeight !== 640) throw new Error('Expected matching 960x640 actual recordings');
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 640;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const regions = { coreInterior: { x: 794, y: 237, w: 47, h: 67 },
      furnaceGrille: { x: 662, y: 354, w: 42, h: 51 },
      chimneyAndSmoke: { x: 660, y: 268, w: 49, h: 62 },
      distantAir: { x: 405, y: 55, w: 235, h: 585 },
      menuSafetyControl: { x: 0, y: 0, w: 360, h: 640 } };
    const accum = Object.fromEntries(Object.keys(regions).map(key => [key, { sum: 0, thresholdSum: 0, thresholdPixels: 0, peakChannelDelta: 0 }]));
    let previous = null, sampledFrames = 0, framePairs = 0;
    for (let index = 1; index <= 39; index++) {
      const time = index * .2;
      const seek = new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Video seek timed out')), 5000);
        video.addEventListener('seeked', () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      video.currentTime = time; await seek;
      ctx.drawImage(video, 0, 0); const pixels = ctx.getImageData(0, 0, 960, 640).data; sampledFrames++;
      if (previous) {
        framePairs++;
        for (const [name, r] of Object.entries(regions)) {
          const a = accum[name];
          for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
            const offset = (y * 960 + x) * 4; let sum = 0, maximum = 0;
            for (let c = 0; c < 3; c++) { const d = Math.abs(pixels[offset + c] - previous[offset + c]); sum += d; maximum = Math.max(maximum, d); }
            a.sum += sum; a.peakChannelDelta = Math.max(a.peakChannelDelta, maximum);
            if (maximum >= 3) { a.thresholdPixels++; a.thresholdSum += sum; }
          }
        }
      }
      previous = pixels;
    }
    video.removeAttribute('src'); video.load();
    return { sampledFrames, framePairs, stepSeconds: .2, firstSecond: .2, lastSecond: 7.8,
      regions: Object.fromEntries(Object.entries(regions).map(([name, r]) => {
        const a = accum[name]; return [name, { bounds: r,
          meanAbsoluteChannelDeltaPer200ms: a.sum / (framePairs * r.w * r.h * 3),
          meanChangedPixelsPer200msAtDelta3: a.thresholdPixels / framePairs,
          meanChangedAreaFractionAtDelta3: a.thresholdPixels / (framePairs * r.w * r.h),
          meanChannelDeltaOnThresholdPixels: a.thresholdPixels ? a.thresholdSum / (a.thresholdPixels * 3) : 0,
          peakChannelDelta: a.peakChannelDelta }];
      })) };
  }, new URL('/' + root + '/f-title-motion.webm', origin).href);
  const baseline = await analyze(baselineRoot), current = await analyze(currentRoot);
  const baselineStill = JSON.parse(await fs.readFile(path.join(baselineRoot, 'frame-delta.json'), 'utf8'));
  const currentStill = JSON.parse(await fs.readFile(path.join(currentRoot, 'frame-delta.json'), 'utf8'));
  const report = { method: 'Decode both actual 960x640 recordings with the same browser. Sample 39 frames from 0.2s to 7.8s and measure absolute RGB change between each 200ms pair. Active pixels require a maximum channel delta of at least 3/255.',
    sources: { baseline: baselineRoot + '/f-title-motion.webm', current: currentRoot + '/f-title-motion.webm' },
    artworkSha256: newReport.sourceFingerprints[artPath], baseline, current,
    onePhaseVersusStill: { baseline: baselineStill.measurements, current: currentStill.measurements },
    limitations: ['This measures temporal pixel change, not aesthetic quality or a perceived-intensity multiplier.',
      'Only one 8-second clip per version; starting animation phases are not synchronized.',
      'Lossy video compression contributes some temporal variation; the static menu region is provided as a control.',
      'The screenshot comparison is one phase versus the static illustration and cannot establish whole-cycle brightness.'] };
  await fs.writeFile(path.join(currentRoot, 'comparison-to-previous.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ baseline: baseline.regions, current: current.regions }));
} finally { await browser.close(); }
