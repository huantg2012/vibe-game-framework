/** Isolated native I02 lifecycle probe. Never attaches to the user's browser. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const runtimeModule = process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium } = await import(runtimeModule);
const root = process.cwd();
const output = path.resolve(process.env.OUTPUT_DIR ?? 'docs/qa/artifacts/rift-r100-i02-validation/memory');
const origin = process.env.GAME_ORIGIN ?? 'http://127.0.0.1:3027';
const executablePath = process.env.CHROME_EXECUTABLE ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const count = Number(process.env.REBUILD_COUNT ?? 10);
assert(Number.isSafeInteger(count) && count >= 10, 'At least 10 measured rebuilds are required');
await mkdir(output, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  scope: 'R100-I02 native DEV stage; isolated incognito profile; no user save or existing browser access',
  budget: { source: 'docs/tasks/rift-r100-i01.md:84', retainedGrowthBytes: 10 * 1024 ** 2 },
  method: 'Warm all nine family/grade combinations and all three painted caches. Compare the same shell/severe/20261002 baseline after ten same-case and twelve varied reconstructions. Pause only for each measurement; run two CDP HeapProfiler.collectGarbage calls in separate tasks. Snapshot real post-GC live objects and V8 external backing storage; weak instrumentation never strongly retains tested resources.',
  environment: {}, sourceHashes: {}, loadedModuleHashes: {}, navigations: [], warmups: [], samples: [], snapshots: [], errors: [], warnings: [], failures: [], limitations: [
    'CDP Runtime.getHeapUsage is the main world isolate, not total renderer RSS or GPU driver memory. UsedSize, backingStorageSize and embedderHeapUsedSize are reported separately; their sum is only a conservative observation envelope, not a certified disjoint process allocation total.',
    'Heap snapshots count live JS/native wrappers and backing stores. WebGL delete/loseContext and wrapper reclamation do not measure physical GPU/driver bytes.',
    'The DEV runtime retains one Phaser Game and preloaded audio assets across reconstructions; this covers native scene recreation, not whole browser/device shutdown or formal sortie transitions.',
    'Sampling pauses the scene after a bounded running interval. It is lifecycle evidence, not frame-performance, sound-quality, or long-play certification.',
  ],
};
for (const file of ['src/dev/rift-r100-masters/main.ts', 'src/dev/rift-r100-masters/presentation.ts', 'src/dev/rift-r100-masters/surface-renderer.ts', 'src/dev/rift-r100-masters/painted-material.ts', 'src/dev/rift-r100-masters/audio.ts', 'src/dev/rift-gym-runtime.ts', 'src/scenes/rift-scene.ts']) {
  report.sourceHashes[file] = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
}
const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
const browserCDP = await browser.newBrowserCDPSession();
page.on('pageerror', error => report.errors.push(error.stack || error.message || String(error)));
page.on('console', message => { if (message.type() === 'warning' || message.type() === 'error') report.warnings.push({ type: message.type(), text: message.text() }); });
page.on('framenavigated', frame => { if (frame === page.mainFrame()) report.navigations.push({ at: new Date().toISOString(), url: frame.url() }); });
const responseTasks = [];
page.on('response', response => {
  if (new URL(response.url()).pathname.startsWith('/src/') && response.status() === 200) responseTasks.push(response.body().then(bytes => {
    report.loadedModuleHashes[new URL(response.url()).pathname] = createHash('sha256').update(bytes).digest('hex');
  }));
});

await page.addInitScript(() => {
  const rows = [], ids = new WeakMap(); let next = 0;
  const track = (object, kind) => {
    if (!object || ids.has(object)) return object;
    const row = { id: ++next, kind, ref: new WeakRef(object), deleted: false, lost: false };
    rows.push(row); ids.set(object, row); return object;
  };
  const wrap = (prototype, name, after) => {
    const original = prototype?.[name]; if (typeof original !== 'function') return;
    prototype[name] = function(...args) { return after(Reflect.apply(original, this, args), this, args); };
  };
  wrap(Document.prototype, 'createElement', (value, self, args) => String(args[0]).toLowerCase() === 'canvas' ? track(value, 'Canvas') : value);
  wrap(HTMLCanvasElement.prototype, 'getContext', (value, self, args) => {
    if (value && String(args[0]).includes('webgl')) track(value, String(args[0]) === 'webgl2' ? 'WebGL2Context' : 'WebGLContext');
    return value;
  });
  for (const prototype of [globalThis.WebGLRenderingContext?.prototype, globalThis.WebGL2RenderingContext?.prototype]) {
    if (!prototype) continue;
    for (const name of ['Texture', 'Buffer', 'Program', 'Shader', 'Framebuffer', 'Renderbuffer', 'VertexArray']) {
      wrap(prototype, `create${name}`, value => track(value, `GL${name}`));
      wrap(prototype, `delete${name}`, (value, self, args) => { const row = ids.get(args[0]); if (row) row.deleted = true; return value; });
    }
    wrap(prototype, 'getExtension', (value, self, args) => {
      if (value && args[0] === 'WEBGL_lose_context' && !ids.has(value)) {
        ids.set(value, {}); const lose = value.loseContext;
        value.loseContext = function(...loseArgs) { const row = ids.get(self); if (row) row.lost = true; return Reflect.apply(lose, this, loseArgs); };
      }
      return value;
    });
  }
  for (const name of ['AudioContext', 'OfflineAudioContext']) {
    const Original = globalThis[name]; if (!Original) continue;
    globalThis[name] = new Proxy(Original, { construct(target, args, newTarget) { return track(Reflect.construct(target, args, newTarget), name); } });
  }
  const base = globalThis.BaseAudioContext?.prototype;
  for (const name of ['Buffer', 'BufferSource', 'Gain', 'StereoPanner', 'Panner', 'BiquadFilter', 'DynamicsCompressor', 'Oscillator']) {
    wrap(base, `create${name}`, value => track(value, `Audio${name}`));
  }
  wrap(base, 'decodeAudioData', value => { if (value?.then) value.then(buffer => track(buffer, 'DecodedAudioBuffer')); return value; });
  Object.defineProperty(window, '__retainedProbe', { value: Object.freeze({ read() {
    const kinds = {};
    for (const row of rows) {
      const stats = kinds[row.kind] ??= { created: 0, collected: 0, live: 0, liveDeleted: 0, liveLost: 0 };
      stats.created++; if (row.ref.deref()) { stats.live++; if (row.deleted) stats.liveDeleted++; if (row.lost) stats.liveLost++; } else stats.collected++;
    }
    return kinds;
  } }) });
});

const diagnostic = () => page.evaluate(() => JSON.parse(document.querySelector('#diagnostics').textContent));
async function ready(family, grade, seed) {
  await page.waitForFunction(({ family, grade, seed }) => {
    try {
      const d = JSON.parse(document.querySelector('#diagnostics').textContent);
      return d.world?.family === family && d.world?.grade === grade && d.world?.seed === seed && d.runtime?.running && !d.runtime.starting && document.querySelector('#loading').hidden;
    } catch { return false; }
  }, { family, grade, seed }, { timeout: 120000 });
  assert.equal(await page.locator('#error').isVisible(), false, await page.locator('#error').textContent());
}
async function reconstruct(family, grade, seed, warmup = false) {
  const before = await diagnostic();
  await page.locator('#seed').fill(String(seed));
  if (before.world.family !== family) await page.locator(`[data-family="${family}"]`).click();
  else if (before.world.grade !== grade) await page.locator(`[data-grade="${grade}"]`).click();
  else await page.locator('#rebuild').click();
  // Changing both axes requires sequential UI operations, never racing builds.
  await ready(family, before.world.family !== family ? before.world.grade : grade, seed);
  if (before.world.family !== family && before.world.grade !== grade) { await page.locator(`[data-grade="${grade}"]`).click(); await ready(family, grade, seed); }
  await page.waitForTimeout(warmup ? 1000 : 1500);
  if (warmup) report.warmups.push({ family, grade, seed, resources: (await diagnostic()).runtime.resources });
}
async function collect(label) {
  const d = await diagnostic();
  if (!d.runtime.paused) await page.locator('#pause').click();
  await page.waitForTimeout(400);
  const beforeGC = await cdp.send('Runtime.getHeapUsage');
  await cdp.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(150);
  await cdp.send('HeapProfiler.collectGarbage');
  const postGC = await cdp.send('Runtime.getHeapUsage');
  const sample = { label, at: new Date().toISOString(), world: d.world.identity, seed: d.world.seed, beforeGC, postGC,
    envelopeBytes: postGC.usedSize + (postGC.backingStorageSize ?? 0) + (postGC.embedderHeapUsedSize ?? 0),
    resources: (await diagnostic()).runtime.resources, weakResources: await page.evaluate(() => window.__retainedProbe.read()),
    dom: await cdp.send('Memory.getDOMCounters') };
  report.samples.push(sample);
  console.log(JSON.stringify({ label, postGC, envelopeMiB: sample.envelopeBytes / 1024 ** 2 }));
  await writeFile(path.join(output, 'controlled-gc-memory.json'), JSON.stringify(report, null, 2));
  return sample;
}
async function heapSnapshot(label) {
  const chunks = []; const listener = ({ chunk }) => chunks.push(chunk);
  cdp.on('HeapProfiler.addHeapSnapshotChunk', listener);
  try { await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false, captureNumericValue: true }); }
  finally { cdp.off('HeapProfiler.addHeapSnapshotChunk', listener); }
  const data = chunks.join(''); const snapshot = JSON.parse(data);
  await writeFile(path.join(output, `${label}.heapsnapshot.json.gz`), gzipSync(data, { level: 6 }));
  const fields = snapshot.snapshot.meta.node_fields, width = fields.length;
  const typeIndex = fields.indexOf('type'), nameIndex = fields.indexOf('name'), sizeIndex = fields.indexOf('self_size');
  const types = snapshot.snapshot.meta.node_types[typeIndex];
  const groups = new Map();
  for (let i = 0; i < snapshot.nodes.length; i += width) {
    const type = types[snapshot.nodes[i + typeIndex]], name = snapshot.strings[snapshot.nodes[i + nameIndex]];
    const key = `${type}:${name}`, row = groups.get(key) ?? { type, name, count: 0, selfBytes: 0 };
    row.count++; row.selfBytes += snapshot.nodes[i + sizeIndex]; groups.set(key, row);
  }
  const all = [...groups.values()].sort((a, b) => b.selfBytes - a.selfBytes);
  const classes = all.filter(row => /MasterPresentation|MasterSurfaceRenderer|MasterMaterialAudio|HTMLCanvasElement|CanvasRendering|WebGL|AudioBuffer|AudioContext|ArrayBuffer|RiftScene|TextureManager/.test(row.name) && ['object', 'native'].includes(row.type));
  const summary = { label, nodeCount: snapshot.snapshot.node_count, edgeCount: snapshot.snapshot.edge_count, snapshotSha256: createHash('sha256').update(data).digest('hex'), classes, largestGroups: all.slice(0, 35) };
  report.snapshots.push(summary); await writeFile(path.join(output, `${label}-heap-summary.json`), JSON.stringify(summary, null, 2));
}

try {
  report.environment = { browser: await cdp.send('Browser.getVersion'), headless: true, viewport: '1280x900', dpr: 1, logical: '960x640', camera: 1.5, platform: process.platform, architecture: process.arch, isolatedContext: true };
  await cdp.send('HeapProfiler.enable');
  await page.goto(`${origin}/rift-r100-masters.html?family=folded-slab&grade=low&seed=20261002`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await ready('folded-slab', 'low', 20261002);
  for (const family of ['folded-slab', 'fibre-knot', 'broken-shell']) for (const grade of ['low', 'medium', 'severe']) await reconstruct(family, grade, 20261002, true);
  // Ensure the AudioContext is actually unlocked and native scene can run.
  await page.locator('#game-container').click({ position: { x: 480, y: 300 } });
  await page.waitForTimeout(2500);
  const baseline = await collect('warmed-baseline'); await heapSnapshot('warmed-baseline');
  for (let i = 1; i <= count; i++) { await reconstruct('broken-shell', 'severe', 20261002); await collect(`same-case-${String(i).padStart(2, '0')}`); }
  await heapSnapshot('same-case-final');
  // Four rounds of three families; every third sample returns to the baseline.
  for (let i = 0; i < 12; i++) {
    const family = ['folded-slab', 'fibre-knot', 'broken-shell'][i % 3];
    const grade = family === 'broken-shell' ? 'severe' : ['low', 'medium', 'severe'][Math.floor(i / 3) % 3];
    const seed = family === 'broken-shell' ? 20261002 : 20261002 + Math.floor(i / 3) % 2;
    await reconstruct(family, grade, seed); await collect(`mixed-${String(i + 1).padStart(2, '0')}`);
  }
  await heapSnapshot('mixed-final');
  const matching = report.samples.filter(sample => sample.world === baseline.world && sample.seed === baseline.seed);
  report.comparison = { baseline: baseline.label, sameCaseRebuilds: count, variedSelections: 12, matchingBaselineSamples: matching.length,
    maxEnvelopeGrowthBytes: Math.max(...matching.map(sample => sample.envelopeBytes - baseline.envelopeBytes)),
    finalEnvelopeGrowthBytes: report.samples.at(-1).envelopeBytes - baseline.envelopeBytes,
    maxV8AndBackingGrowthBytes: Math.max(...matching.map(sample => sample.postGC.usedSize + sample.postGC.backingStorageSize - baseline.postGC.usedSize - baseline.postGC.backingStorageSize)),
  };
  report.comparison.measuredEnvelopeWithin10MiB = report.comparison.maxEnvelopeGrowthBytes <= report.budget.retainedGrowthBytes;
  // Attempt direct native memory-infra evidence; failure remains explicit.
  await browserCDP.send('Tracing.start', { categories: 'disabled-by-default-memory-infra', transferMode: 'ReturnAsStream' });
  report.memoryInfraAttempt = await browserCDP.send('Tracing.requestMemoryDump', { deterministic: true, levelOfDetail: 'detailed' });
  const completed = new Promise(resolve => browserCDP.once('Tracing.tracingComplete', resolve));
  await browserCDP.send('Tracing.end'); const event = await completed;
  let trace = '';
  for (;;) { const chunk = await browserCDP.send('IO.read', { handle: event.stream }); trace += chunk.data; if (chunk.eof) break; }
  await browserCDP.send('IO.close', { handle: event.stream });
  await writeFile(path.join(output, 'memory-infra-attempt.json.gz'), gzipSync(trace));
  assert(report.comparison.measuredEnvelopeWithin10MiB, 'Observed post-GC envelope exceeds the 10MiB growth budget');
  assert.deepEqual(report.errors, [], 'Native scene errors');
} catch (reason) { report.failures.push(reason.stack ?? String(reason)); process.exitCode = 1; }
finally {
  await Promise.allSettled(responseTasks);
  report.completedAt = new Date().toISOString();
  await writeFile(path.join(output, 'controlled-gc-memory.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ output, samples: report.samples.length, comparison: report.comparison, errors: report.errors, failures: report.failures }, null, 2));
