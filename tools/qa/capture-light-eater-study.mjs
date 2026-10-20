/** Isolated art study capture. No production saves; this is not balance acceptance. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(homedir(), '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const quick = process.argv.includes('--quick');
const output = path.resolve('docs/qa/artifacts/light-eater-continuity-2026-10-20');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1060 }, deviceScaleFactor: 1 });
const sourceFiles = ['src/systems/vision-light-eater.ts', 'src/systems/visibility-system.ts', 'src/scenes/rift-scene.ts', 'src/dev/rift-light-eater-study.ts', 'src/dev/rift-light-eater-study.css'];
const hashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, createHash('sha256').update(await fs.readFile(file)).digest('hex')])));
const report = { sourcesBefore: await hashes(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), errors: [], checks: [], samples: [], scope: 'DEV-only actual Rift map/material/player. No production integration, performance target or human art acceptance.' };
page.on('pageerror', error => report.errors.push(String(error.stack ?? error)));
await page.addInitScript(() => {
  window.__localStorageCalls = [];
  for (const name of ['getItem', 'setItem', 'removeItem', 'clear']) {
    const method = Storage.prototype[name];
    Storage.prototype[name] = function(...args) { if (this === window.localStorage) window.__localStorageCalls.push({ name, key: args[0] ?? '' }); return method.apply(this, args); };
  }
});
async function ready() {
  await page.waitForFunction(() => window.__lightEaterStudy?.snapshot().state.running, { timeout: 90000 });
  await page.waitForTimeout(2200);
}
async function set(p, a, mode = 'light-eater') {
  await page.evaluate(args => { window.__lightEaterStudy.resume(); window.__lightEaterStudy.set(...args); }, [p, a, mode]);
  await page.waitForFunction(([p, a]) => { const s = window.__lightEaterStudy.snapshot(); return Math.abs(s.preview.pollution - p) < .2 && Math.abs(s.preview.assimilation - a) < .2; }, [p, a], { timeout: 12000 });
  await page.waitForTimeout(300);
}
async function check(name, pass, detail) { report.checks.push({ name, pass, detail }); console.log(pass ? 'PASS' : 'FAIL', name); assert(pass, name); }
async function shot(name) {
  await page.screenshot({ clip: await page.locator('#stage').boundingBox(), path: path.join(output, `${name}.png`) });
  const s = await page.evaluate(() => window.__lightEaterStudy.snapshot());
  report.samples.push({ name, world: s.world, preview: s.preview, player: s.state.probe?.player }); console.log('SHOT', name);
}
try {
  await page.goto('http://127.0.0.1:3027/docs/art/previews/rift-light-eater-study/');
  await ready();
  await set(0, 0); await shot('crystal-clear');
  await set(25, 0); await shot('crystal-low');
  await set(55, 0); await shot('crystal-mid');
  await set(80, 0); await shot('crystal-deep');
  await set(100, 0); await shot('crystal-high');
  await set(100, 80); await shot('crystal-adapted');
  if (!quick) {
    // Exposed art fixture API only; no private mutation of running scene state.
    await set(100, 0);
    const start = await page.evaluate(() => window.__lightEaterStudy.snapshot().state.probe.player);
    await page.locator('#game-container').click();
    await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
    const end = await page.evaluate(() => window.__lightEaterStudy.snapshot().state.probe.player);
    await check('actual movement input updates player', JSON.stringify(start) !== JSON.stringify(end), { start, end });
    await shot('crystal-moved');
    await page.evaluate(() => { window.__lightEaterStudy.auto(true); window.__lightEaterStudy.pause(); });
    const frozen = await page.evaluate(() => { const s = window.__lightEaterStudy.snapshot(); return { cycleMs: s.cycleMs, preview: s.preview }; });
    const first = await page.locator('#game-container canvas').screenshot(); await page.waitForTimeout(400);
    const second = await page.locator('#game-container canvas').screenshot();
    await check('paused art frame remains frozen', Buffer.compare(first, second) === 0);
    await check('paused continuous timeline also freezes', JSON.stringify(frozen) === JSON.stringify(
      await page.evaluate(() => { const s = window.__lightEaterStudy.snapshot(); return { cycleMs: s.cycleMs, preview: s.preview }; })));
    await check('paused controls cannot misrepresent frozen preview', await page.locator('#pollution').isDisabled());
    await page.evaluate(() => window.__lightEaterStudy.resume());
    await page.waitForTimeout(100);
    await set(0, 0);
    const recording = await page.evaluate(async () => {
      const source = document.querySelector('#game-container canvas');
      // The scene is copied unchanged; a separate footer records the actual
      // art-fixture values so this video does not imply new game HUD.
      const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 680;
      const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const samples = []; let frame = 0, nextSample = 0;
      function draw(time) {
        const s = window.__lightEaterStudy.snapshot();
        ctx.fillStyle = '#080d0e'; ctx.fillRect(0, 0, 960, 680);
        ctx.drawImage(source, 0, 0, 960, 640);
        ctx.font = '14px monospace'; ctx.fillStyle = '#a8b8ac';
        ctx.fillText(`美术打版 / 连续扫描     污染 ${s.preview.pollution.toFixed(1)}     同化 ${s.preview.assimilation.toFixed(1)}%`, 24, 665);
        if (time >= nextSample) { samples.push({ ms: s.cycleMs, p: s.preview.pollution, a: s.preview.assimilation }); nextSample = time + 180; }
        frame = requestAnimationFrame(draw);
      }
      window.__lightEaterStudy.auto(true);
      frame = requestAnimationFrame(draw);
      const stream = canvas.captureStream(20);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' }), chunks = [];
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      const stopped = new Promise(resolve => { recorder.onstop = resolve; });
      recorder.start();
      await new Promise(resolve => setTimeout(resolve, 34500));
      recorder.stop(); await stopped; cancelAnimationFrame(frame);
      window.__lightEaterStudy.auto(false);
      stream.getTracks().forEach(track => track.stop());
      return { bytes: [...new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())], samples };
    });
    await fs.writeFile(path.join(output, 'transition.webm'), Buffer.from(recording.bytes));
    await check('continuous video recorded from actual engine', recording.bytes.length > 10000, { bytes: recording.bytes.length });
    report.timeline = recording.samples;
    const rise = recording.samples.filter(s => s.ms <= 21000);
    const maximumRate = Math.max(...rise.slice(1).map((s, i) => Math.abs(s.p - rise[i].p) / Math.max(1, s.ms - rise[i].ms) * 1000));
    await check('actual sweep covers all pollution states without parameter jumps',
      rise.length > 50 && rise[0].p < 1 && rise.at(-1).p > 99 && maximumRate < 11 &&
      rise.slice(1).every((s, i) => s.p >= rise[i].p),
      { observations: rise.length, maximumPointsPerSecond: maximumRate });
    await check('adaptation expands at sustained saturation', recording.samples.some(s => s.a > 79 && s.p > 99));
    for (const world of ['cinder-ridge', 'ruptured-film']) {
      await page.selectOption('#world', world); await ready();
      await set(55, 0); await shot(`${world}-mid`);
      await set(100, 0); await shot(`${world}-high`);
      await set(100, 80); await shot(`${world}-adapted`);
      await check(`${world} sample still running`, !await page.evaluate(() => window.__lightEaterStudy.snapshot().state.probe.ended));
    }
    const calls = await page.evaluate(() => window.__localStorageCalls);
    await check('no save or narration storage access; no preference writes', calls.every(call => call.name === 'getItem' && call.key === 'coh_locale'), calls);
  }
  report.sourcesAfter = await hashes();
  await check('capture source remains frozen', JSON.stringify(report.sourcesBefore) === JSON.stringify(report.sourcesAfter));
  await check('no page errors', report.errors.length === 0, report.errors);
  await fs.writeFile(path.join(output, 'index.html'), `<!doctype html><meta charset="utf-8"><title>吞光 · 连续侵蚀打版记录</title><style>body{background:#0b1011;color:#b7c3b7;font:14px/1.7 monospace;margin:30px auto;width:984px}a{color:#adb897}h1{font-weight:400}main{display:grid;grid-template-columns:repeat(2,480px);gap:24px}figure{margin:0}img{display:block;width:480px;image-rendering:pixelated}figcaption{padding:8px 0}</style><h1>光的尽头 · 连续侵蚀</h1><p><a href="/docs/art/previews/rift-light-eater-study/">进入动态观察台</a> · 仅美术样片，未接正式流程。可暂停、拖动或观看完整往返。</p>${quick ? '' : '<video src="transition.webm" width="960" controls loop autoplay muted></video><p>真实连续画面：污染 0 → 100 → 同化 80。下方灰字为观察台读数，不是游戏HUD。</p>'}<main>${report.samples.map(s => `<figure><a href="${s.name}.png"><img src="${s.name}.png"></a><figcaption>${s.name} · 污染 ${s.preview.pollution.toFixed(0)} / 同化 ${s.preview.assimilation.toFixed(0)}</figcaption></figure>`).join('')}</main>`);
} catch (error) {
  report.failure = String(error);
  report.failureState = await page.evaluate(() => window.__lightEaterStudy?.snapshot()).catch(() => null);
  throw error;
} finally {
  await fs.writeFile(path.join(output, quick ? 'quick-report.json' : 'report.json'), JSON.stringify(report, null, 2)); await browser.close();
}
