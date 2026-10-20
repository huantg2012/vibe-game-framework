import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const out = path.resolve('docs/qa/artifacts/assimilation-body-2026-10-20');
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1360, height: 1100 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:3027/docs/art/previews/assimilation-appearance-study/?amount=0&fibre=1');
  await page.waitForFunction(() => window.__assimilationStudy?.snapshot().ready, null, { timeout: 90000 });
  await page.evaluate(() => { window.__assimilationStudy.inspector(false); window.__assimilationStudy.face(Math.PI / 2); });
  await page.waitForTimeout(600);
  const result = await page.evaluate(async () => {
    const api = window.__assimilationStudy, samples = [], chunks = [];
    const canvas = document.querySelector('#game-container canvas');
    const stream = canvas.captureStream(20);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm', videoBitsPerSecond: 1500000 });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.start();
    const timer = setInterval(() => {
      const s = api.snapshot();
      samples.push({ amount: s.state.amount, fibre: s.state.fibre, applied: s.modelMetrics.applied, requests: s.modelMetrics.requests,
        cacheBytes: s.modelMetrics.cacheBytes, error: s.modelMetrics.error });
    }, 100);
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    await wait(500); api.set(1, 1); await wait(3000);
    api.set(1, 0); await wait(2500);
    api.set(1, .5); await wait(2500);
    api.set(0, .5); await wait(3000);
    clearInterval(timer);
    const stopped = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.stop(); await stopped; stream.getTracks().forEach(track => track.stop());
    api.pause(true); await wait(200);
    const frozen = api.snapshot(); await wait(500); const frozenLater = api.snapshot();
    const blob = new Blob(chunks, { type: 'video/webm' });
    const data = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(blob); });
    return { samples, frozen, frozenLater, video: data };
  });
  assert.equal(errors.length, 0);
  assert(result.samples.some(s => s.amount > .99));
  assert(result.samples.some(s => s.amount > .2 && s.amount < .8), 'intermediate assimilation states actually render');
  assert(result.samples.some(s => s.fibre < .01), 'source transition reaches film');
  assert(result.samples.at(-1).amount < .001, 'continuous healing returns to original');
  assert(result.samples.at(-1).applied > 15, 'actual geometry frames applied through transitions');
  assert(result.samples.every(s => s.cacheBytes <= 1310720 && !s.error));
  assert.equal(result.frozen.state.seconds, result.frozenLater.state.seconds, 'pause freezes study motion time');
  assert.equal(result.frozen.modelMetrics.requests, result.frozenLater.modelMetrics.requests, 'pause does not keep rebuilding');
  await fs.writeFile(path.join(out, 'body-transition.webm'), Buffer.from(result.video.split(',')[1], 'base64'));
  delete result.video;
  await fs.writeFile(path.join(out, 'motion-check.json'), JSON.stringify({ errors, ...result }, null, 2) + '\n');
  // One concise sheet is a browser-rendered arrangement of real captured frames.
  await page.goto('http://127.0.0.1:3027/docs/qa/artifacts/assimilation-body-2026-10-20/');
  await page.locator('.row').nth(1).screenshot({ path: path.join(out, 'side-comparison.png') });
  console.log(JSON.stringify({ samples: result.samples.length, applied: result.samples.at(-1).applied, errors, pause: 'pass' }));
} finally { await browser.close(); }
