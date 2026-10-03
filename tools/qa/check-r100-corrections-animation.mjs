/** Native fixed-seat time series. This is motion evidence, not aesthetic approval. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
const { chromium } = await import('/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve('docs/qa/artifacts/rift-r100-i02-corrections/animation');
await mkdir(out, { recursive: true });
const report = { date: new Date().toISOString(), scope: 'folded-slab three grades, seed 20261002, same legal controlled position; normal native visibility and unmodified time. Video has no audio. No walking, full-cycle, balance or user-art-approval claim.', sources: {}, cases: [], errors: [] };
for (const name of ['presentation', 'surface-renderer', 'surface-fields']) {
  const file = `src/dev/rift-r100-masters/${name}.ts`; report.sources[file] = createHash('sha256').update(await readFile(file)).digest('hex');
}
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage({ viewport: { width: 1340, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', error => report.errors.push(String(error)));
const sample = () => page.evaluate(async () => {
  const { audioManager } = await import('/src/managers/audio-manager.ts');
  const s = audioManager.game.scene.getScene('RiftScene'), c = s.cameras.main;
  return { wallTime: performance.now(), presentation: s.devRuntime.snapshot(), probe: s.probeBuildLabState(), camera: { scrollX: c.scrollX, scrollY: c.scrollY, zoom: c.zoom, rotation: c.rotation } };
});
try {
  for (const grade of ['low', 'medium', 'severe']) {
    await page.goto(`${process.env.GAME_URL ?? 'http://127.0.0.1:3046'}/rift-r100-masters.html?family=folded-slab&grade=${grade}&seed=20261002`);
    await page.waitForFunction(() => { try { return JSON.parse(document.querySelector('#diagnostics').textContent).runtime.running; } catch { return false; } }, null, { timeout: 60000 });
    await page.locator('#pixel').click();
    const seat = { x: 444, y: 388 };
    await page.evaluate(async point => {
      const { audioManager } = await import('/src/managers/audio-manager.ts');
      const { TileGrid } = await import('/src/systems/tile-grid.ts');
      const { bodyHasSupport } = await import('/src/systems/ai/physical-grid.ts');
      const s = audioManager.game.scene.getScene('RiftScene');
      if (!bodyHasSupport(new TileGrid(s.devRuntime.world.layout.tileMap), point, 10, 10)) throw new Error('Common observation seat has no body support');
      s.probePlacePlayer(point.x, point.y);
    }, seat);
    await page.locator('#game-container').focus();
    await page.keyboard.down('w'); await page.waitForTimeout(130); await page.keyboard.up('w');
    // Return to the same admitted coordinate after real input chose facing.
    await page.evaluate(async point => { const { audioManager } = await import('/src/managers/audio-manager.ts'); audioManager.game.scene.getScene('RiftScene').probePlacePlayer(point.x, point.y); }, seat);
    await page.waitForTimeout(500);
    const pixels = await page.evaluate(async () => {
      const { audioManager } = await import('/src/managers/audio-manager.ts');
      const { buildMasterSurfaceFields } = await import('/src/dev/rift-r100-masters/surface-fields.ts');
      const s = audioManager.game.scene.getScene('RiftScene'), w = s.devRuntime.world, fields = buildMasterSurfaceFields(w), c = s.cameras.main;
      const points = new Set();
      for (const index of w.raster.occupiedPixels) {
        if (fields.infection[index] < .18) continue;
        const x = index % w.raster.width + .5, y = Math.floor(index / w.raster.width) + .5;
        if (s.visibility.getVisibilityAt({ x, y }) <= 0) continue;
        const p = c.matrix.transformPoint(x - c.scrollX, y - c.scrollY), px = Math.floor(p.x), py = Math.floor(p.y);
        if (px >= 0 && py >= 0 && px < 960 && py < 640) points.add(py * 960 + px);
      }
      return [...points];
    });
    assert(pixels.length > 20, `${grade}: visible actual infected structure must be in frame`);
    await page.evaluate(() => {
      const canvas = document.querySelector('#game-container canvas');
      const stream = canvas.captureStream(20), chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 1600000 });
      const done = new Promise(resolve => { recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); }; recorder.onstop = async () => { const bytes = new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()); stream.getTracks().forEach(t => t.stop()); let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte); resolve(btoa(binary)); }; });
      window.__r100AnimationRecording = { recorder, done }; recorder.start(250);
    });
    const samples = [], buffers = [], start = Date.now();
    for (const targetMs of [0, 500, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]) {
      await page.waitForTimeout(Math.max(1, start + targetMs - Date.now()));
      const state = await sample(), file = `${grade}-${String(targetMs).padStart(4, '0')}.png`;
      const png = await page.locator('#game-container canvas').screenshot({ path: path.join(out, file) });
      buffers.push(await sharp(png).ensureAlpha().raw().toBuffer()); samples.push({ targetMs, file, ...state });
    }
    const encodedVideo = await page.evaluate(async () => { const r = window.__r100AnimationRecording; r.recorder.stop(); const data = await r.done; delete window.__r100AnimationRecording; return data; });
    await writeFile(path.join(out, `${grade}.webm`), Buffer.from(encodedVideo, 'base64'));
    const videoMetadata = await page.evaluate(async grade => {
      const video = document.createElement('video'); video.muted = true;
      video.src = `/docs/qa/artifacts/rift-r100-i02-corrections/animation/${grade}.webm`;
      await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; video.onerror = () => reject(new Error('Recorded WebM metadata failed')); });
      video.currentTime = 1; await new Promise(resolve => { video.onseeked = resolve; });
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d'); ctx.drawImage(video, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let visiblePixels = 0;
      for (let i = 0; i < data.length; i += 4) if (Math.max(data[i], data[i + 1], data[i + 2]) > 20) visiblePixels++;
      const result = { width: video.videoWidth, height: video.videoHeight, decodedTime: video.currentTime, visiblePixels };
      video.removeAttribute('src'); video.load(); return result;
    }, grade);
    assert(videoMetadata.width === 960 && videoMetadata.height === 640 && videoMetadata.visiblePixels > 1000, 'recorded WebM decodes actual native game pixels');
    const selected = pixels.filter(i => { const q = i * 4, b = buffers[0]; return b[q + 1] > b[q] * 1.08 && b[q + 1] > b[q + 2] * 1.02 && b[q + 1] > 20; });
    assert(selected.length > 20, `${grade}: actual rendered pixels read green in the visible structure`);
    const changes = samples.map((row, at) => {
      const before = buffers[0], after = buffers[at]; let changed = 0, totalDelta = 0, maximumDelta = 0;
      for (const i of selected) { const q = i * 4, d = Math.max(Math.abs(after[q] - before[q]), Math.abs(after[q + 1] - before[q + 1]), Math.abs(after[q + 2] - before[q + 2])); if (d >= 4) changed++; totalDelta += d; maximumDelta = Math.max(maximumDelta, d); }
      return { targetMs: row.targetMs, elapsedMs: row.presentation.elapsedMs - samples[0].presentation.elapsedMs, changedPixels: changed, fraction: changed / selected.length, meanMaxChannelDelta: totalDelta / selected.length, maximumDelta };
    });
    assert(samples.at(-1).presentation.elapsedMs - samples[0].presentation.elapsedMs > 7000, 'normal native time advances');
    assert(samples.every(row => !row.probe.ended), 'no ended run masquerading as animated video');
    assert(samples.every(row => Math.hypot(row.probe.player.x - samples[0].probe.player.x, row.probe.player.y - samples[0].probe.player.y) < .01), 'observation position fixed');
    assert(samples.every(row => JSON.stringify(row.camera) === JSON.stringify(samples[0].camera)), 'camera position and scale fixed');
    assert(changes.some(row => row.fraction > .1), 'visible green structural pixels must actually change');
    await page.locator('#pause').click(); await page.waitForTimeout(200);
    const pauseStart = await sample(), frozenA = await page.locator('#game-container canvas').screenshot({ path: path.join(out, `${grade}-paused-a.png`) });
    await page.waitForTimeout(700);
    const pauseEnd = await sample(), frozenB = await page.locator('#game-container canvas').screenshot({ path: path.join(out, `${grade}-paused-b.png`) });
    assert.equal(pauseStart.presentation.elapsedMs, pauseEnd.presentation.elapsedMs);
    assert.equal(pauseStart.probe.chaos, pauseEnd.probe.chaos);
    const frozen = (await sharp(frozenA).ensureAlpha().raw().toBuffer()).equals(await sharp(frozenB).ensureAlpha().raw().toBuffer());
    assert(frozen, 'paused actual game canvas must stop changing');
    const row = { grade, seat, video: `${grade}.webm`, videoMetadata, samples, changes, visibleInfectedPixels: pixels.length, greenSamplePixels: selected.length, pause: { frozen, before: pauseStart, after: pauseEnd } };
    report.cases.push(row); await writeFile(path.join(out, `${grade}.json`), JSON.stringify(row, null, 2));
    console.log(JSON.stringify({ grade, nativeElapsed: changes.at(-1).elapsedMs, greenSamplePixels: selected.length, earliestChanged: changes.find(row => row.fraction > .1), pausedFrozen: frozen }));
  }
  assert.equal(report.errors.length, 0); report.status = 'limited-native-animation-pass';
} catch (error) { report.status = 'failed'; report.failure = String(error); throw error; }
finally { await writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2)); await browser.close(); }
const labels = { low: '低污染', medium: '中污染', severe: '重污染' };
await writeFile(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><title>R100 绿色侵蚀动态证据</title><style>body{background:#111512;color:#cbd3ca;font:16px/1.6 system-ui;margin:28px auto;max-width:1000px}video{display:block;width:960px;image-rendering:pixelated;background:#000}a{color:#99c5ae}section{margin:32px 0}p{color:#a9b5aa}code{color:#d7dfd5}</style><h1>绿色侵蚀 · 原生动态证据</h1><p>同一种子与合法站位，正常视野。每段约8秒真实模拟时间，无声音；未改曝光、相位或灯光。视频与逐帧记录仅证明动画存在及暂停冻结，不等于审美通过。</p>${report.cases.map(row => `<section><h2>${labels[row.grade]}</h2><video controls loop preload="metadata" src="${row.video}" poster="${row.samples[0].file}"></video><p>实际模拟经过 ${(row.changes.at(-1).elapsedMs / 1000).toFixed(2)} 秒。首个有明显像素变化的采样：${row.changes.find(r => r.fraction > .1)?.targetMs}ms；暂停画面一致。<a href="${row.grade}.json">状态与测量</a></p><p>${row.samples.map(s => `<a href="${s.file}">${s.targetMs / 1000}s</a>`).join(' · ')}</p></section>`).join('')}<p><a href="report.json">完整记录与源指纹</a></p>`);
