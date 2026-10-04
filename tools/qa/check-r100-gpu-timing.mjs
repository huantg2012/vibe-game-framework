/** WebGL timer queries of actual native-material and Phaser draws. Query results
 * measure GPU work, not JS submission, composite latency or physical VRAM. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base = (process.env.GAME_URL ?? 'http://127.0.0.1:3074').replace(/\/$/, '');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03-i06-completion/gpu-timing');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const report = {
  status: 'running', base, environment: { platform: os.platform(), cpu: os.cpus()[0].model, browser: browser.version() },
  method: 'Real held-key motion in six native severe families. EXT_disjoint_timer_query_webgl2 wraps the original draw methods; samples are read asynchronously, never gl.finish. Disjoint intervals are discarded, query handles deleted. Production damage, clocks, visibility, enemies and shader unchanged.',
  limitations: 'Two independent GPU contexts; their distributions are not added as if synchronous wall time. Excludes browser composition/scanout, shader compilation and entry. Instrumented frame times are diagnostic, not the uninstrumented P01 acceptance. One physical reference machine. Timer-query overhead is present. entry-cross uses real short returns around the entry, not deep-combat performance coverage.',
  movementPattern: process.env.QA_PATTERN ?? 'wide-loop',
  cases: [], errors: [], sourceHashes: {},
};
const write = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const stats = values => { const s = [...values].sort((a, b) => a - b); return { count: s.length, p50: s[Math.floor(s.length * .5)], p95: s[Math.floor(s.length * .95)], p99: s[Math.floor(s.length * .99)], max: s.at(-1) }; };
const worlds = (process.env.QA_WORLDS ?? 'ash-strata,crystal-fibre,ivory-basin,cinder-ridge,pallid-membrane,silt-gel').split(',');
const audit = [];
try {
  for (const world of worlds) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    page.on('pageerror', e => report.errors.push(`${world}: ${e}`));
    page.on('response', response => {
      const url = new URL(response.url());
      if (!response.ok() || !/^\/(src\/|assets\/r100-materials\/)/.test(url.pathname)) return;
      audit.push(fetch(response.url()).then(async r => {
        assert(r.ok); const hash = createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
        if (report.sourceHashes[url.pathname]) assert.equal(report.sourceHashes[url.pathname], hash, `changed source: ${url.pathname}`);
        report.sourceHashes[url.pathname] = hash;
      }).catch(e => report.errors.push(String(e))));
    });
    try {
      await page.goto(`${base}/r100-gym.html?world=${world}&grade=severe&seed=20261004`);
      await page.waitForFunction(() => window.__r100Gym?.getState().runtime.running, null, { timeout: 60000 });
      await page.waitForTimeout(800);
      const supported = await page.evaluate(async () => {
        const { audioManager } = await import('/src/managers/audio-manager.ts');
        const game = audioManager.game, scene = game.scene.getScene('RiftScene');
        const readers = [], contexts = [], frames = [], cpu = [], start = scene.probeBuildLabState();
        let before = 0, previous = 0;
        const active = () => scene.sys.isActive() && !scene.runController.isRunEnded();
        const pre = () => {
          if (!active()) { previous = before = 0; return; }
          const t = performance.now(); if (previous) frames.push(t - previous); previous = before = t;
        };
        const post = () => { if (before) cpu.push(performance.now() - before); };
        game.events.on('prestep', pre); game.events.on('poststep', post);
        function instrument(owner, method, name) {
          const gl = owner.gl, v2 = !!gl?.createQuery;
          const ext = gl?.getExtension(v2 ? 'EXT_disjoint_timer_query_webgl2' : 'EXT_disjoint_timer_query');
          if (!ext) return { name, supported: false };
          const createQuery = () => v2 ? gl.createQuery() : ext.createQueryEXT();
          const deleteQuery = q => v2 ? gl.deleteQuery(q) : ext.deleteQueryEXT(q);
          const available = q => v2 ? gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE) : ext.getQueryObjectEXT(q, ext.QUERY_RESULT_AVAILABLE_EXT);
          const result = q => v2 ? gl.getQueryParameter(q, gl.QUERY_RESULT) : ext.getQueryObjectEXT(q, ext.QUERY_RESULT_EXT);
          const original = owner[method], samples = [], pending = [];
          const debug = gl.getExtension('WEBGL_debug_renderer_info');
          const info = { name, supported: true, api: v2 ? 'WebGL2' : 'WebGL1', renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), samples, discarded: 0, skipped: 0 };
          const read = () => {
            if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
              info.discarded += pending.length; for (const q of pending) deleteQuery(q); pending.length = 0; return;
            }
            while (pending.length && available(pending[0])) {
              const q = pending.shift(); samples.push(result(q) / 1e6); deleteQuery(q);
            }
          };
          owner[method] = function (...args) {
            read();
            if (!active()) return original.apply(this, args);
            if (pending.length >= 64 || gl.isContextLost()) { info.skipped++; return original.apply(this, args); }
            const q = createQuery();
            if (v2) gl.beginQuery(ext.TIME_ELAPSED_EXT, q); else ext.beginQueryEXT(ext.TIME_ELAPSED_EXT, q);
            try { return original.apply(this, args); }
            finally { if (v2) gl.endQuery(ext.TIME_ELAPSED_EXT); else ext.endQueryEXT(ext.TIME_ELAPSED_EXT); pending.push(q); }
          };
          readers.push(() => { owner[method] = original; read(); info.pendingAtEnd = pending.length; for (const q of pending) deleteQuery(q); pending.length = 0; });
          contexts.push(info); return { name, supported: true, renderer: info.renderer };
        }
        const support = [instrument(scene.devRuntime.renderer, 'draw', 'native-material'), instrument(game.renderer, 'render', 'phaser')];
        window.__gpuMeasurement = { start, frames, cpu, contexts, positions: [], finish() { for (const read of readers) read(); game.events.off('prestep', pre); game.events.off('poststep', post); return { start, frames, cpu, contexts, positions: this.positions, end: scene.probeBuildLabState() }; } };
        return support;
      });
      report.currentSupport = supported; write();
      assert(supported.every(s => s.supported), 'actual GPU timer-query support is required; no CPU-time substitution');
      await page.locator('#game-container').focus();
      const entryCross = process.env.QA_PATTERN === 'entry-cross';
      const interval = Number(process.env.QA_MOVE_MS ?? (entryCross ? 1020 : 5100));
      const keys = entryCross ? Array.from({ length: 16 }, () => ['d', 'a', 'w', 's']).flat()
        : ['d', 'w', 'a', 's', 'd', 's', 'a', 'w', 'd', 'w', 'a', 's'];
      for (const key of keys) {
        await page.keyboard.down(key); await page.waitForTimeout(interval); await page.keyboard.up(key);
        const ended = await page.evaluate(() => {
          const probe = window.__r100Gym.getState().runtime.probe;
          window.__gpuMeasurement.positions.push(probe); return probe.ended;
        });
        if (ended) break;
      }
      const sample = await page.evaluate(() => window.__gpuMeasurement.finish());
      fs.writeFileSync(path.join(out, `${world}-raw.json`), JSON.stringify(sample));
      const row = { world, grade: 'severe', seed: 20261004, support: supported, duration: sample.end.elapsedMs - sample.start.elapsedMs, ended: sample.end.ended,
        frames: stats(sample.frames), cpu: stats(sample.cpu), gpu: sample.contexts.map(({ samples, ...rest }) => ({ ...rest, milliseconds: stats(samples) })), start: sample.start, end: sample.end };
      report.cases.push(row); write(); console.log(JSON.stringify(row));
      assert(row.gpu.every(g => g.milliseconds.count > 100), 'real asynchronous GPU samples returned');
      if (!process.env.QA_MOVE_MS) assert(!row.ended && row.duration >= 60000, 'complete live 60-second sample');
    } finally { await context.close(); }
  }
  await Promise.all(audit); assert.deepEqual(report.errors, []); report.status = 'measured-real-gpu';
} catch (error) { report.status = 'failed'; report.failure = String(error); process.exitCode = 1; console.error(error); }
finally { await Promise.allSettled(audit); write(); await browser.close(); }
