/** Actual Chrome GPU-process allocator dumps; do not sum shared allocations
 * across processes or label these as exclusive physical VRAM residency. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { createHash } from 'node:crypto';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? '/Users/yilungao/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const out = path.resolve(process.env.QA_OUTPUT_DIR ?? 'docs/qa/artifacts/r100-i03-i06-completion/gpu-allocations');
const base = (process.env.GAME_URL ?? 'http://127.0.0.1:3074').replace(/\/$/, '');
const families = (process.env.QA_FAMILIES ?? 'ash-strata,crystal-fibre,ivory-basin,cinder-ridge,pallid-membrane,silt-gel').split(',');
const baselineWorld = process.env.QA_BASE_WORLD ?? 'ash-strata';
assert(families.length > 0 && families.every(Boolean) && new Set(families).size === families.length);
const MiB = 1024 * 1024;
fs.mkdirSync(out, { recursive: true });
const args = ['--enable-precise-memory-info'];
if (process.env.QA_GPU_BACKEND === 'swiftshader') args.push('--use-angle=swiftshader', '--enable-unsafe-swiftshader');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(), cdp = await browser.newBrowserCDPSession(), renderer = await context.newCDPSession(page);
const report = {
  status: 'running', base, families, baselineWorld, environment: { platform: os.platform(), arch: os.arch(), cpu: os.cpus()[0].model, browser: browser.version(), backendRequested: process.env.QA_GPU_BACKEND ?? 'default' },
  method: 'Fresh isolated browser. Chrome memory-infra detailed deterministic dumps of the GPU process; gpu.size includes shared resources once at that process root. Two actual renderer GC calls before each sample. Same renderer/game, real native world rebuilds. No user storage.',
  limitations: 'Allocator backing accounting, not exclusive device physical residency; one physical machine. GPU-process total includes compositor tile caches and transfer staging, so is recorded, not confused with game-owned leak count. Shared-image WebGL/Canvas backing below is a separate, non-overlapping mailbox subtotal, not all private ANGLE resources. SwiftShader is a software-backend check, not a second hardware device. Dump overhead is not frame-time evidence.',
  references: ['https://chromium.googlesource.com/chromium/src/+/HEAD/docs/memory-infra/probe-gpu.md', 'https://chromedevtools.github.io/devtools-protocol/tot/Tracing/'],
  samples: [], errors: [], sourceHashes: {},
};
const sourceFetches = [];
page.on('pageerror', e => report.errors.push(String(e)));
page.on('response', response => {
  const url = new URL(response.url());
  if (!response.ok() || !/^\/(src\/|assets\/r100-materials\/)/.test(url.pathname)) return;
  sourceFetches.push(fetch(response.url()).then(async r => {
    assert(r.ok); const hash = createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');
    if (report.sourceHashes[url.pathname]) assert.equal(report.sourceHashes[url.pathname], hash, `changed source: ${url.pathname}`);
    report.sourceHashes[url.pathname] = hash;
  }).catch(e => { report.errors.push(String(e)); }));
});
const write = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');

async function snapshot(label) {
  await renderer.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(80);
  await renderer.send('HeapProfiler.collectGarbage');
  await page.waitForTimeout(100);
  const events = [];
  const collect = p => events.push(...p.value);
  cdp.on('Tracing.dataCollected', collect);
  try {
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { recordMode: 'recordAsMuchAsPossible', includedCategories: ['disabled-by-default-memory-infra'], excludedCategories: ['*'], memoryDumpConfig: { triggers: [] } } });
    const processes = await cdp.send('SystemInfo.getProcessInfo');
    const gpu = processes.processInfo.find(p => p.type === 'GPU'); assert(gpu, 'GPU process exists');
    const dump = await cdp.send('Tracing.requestMemoryDump', { deterministic: true, levelOfDetail: 'detailed' });
    assert(dump.success, 'memory dump completed');
    const finished = new Promise(resolve => cdp.once('Tracing.tracingComplete', resolve));
    await cdp.send('Tracing.end'); await finished;
    const candidates = events.filter(e => e.pid === gpu.id && e.args?.dumps?.allocators?.gpu);
    assert(candidates.length, 'GPU-process allocator accounting was actually captured');
    const latest = candidates.at(-1), allocators = latest.args.dumps.allocators;
    const size = name => allocators[name]?.attrs?.size ? parseInt(allocators[name].attrs.size.value, 16) : null;
    const childKeys = Object.keys(allocators).filter(k => k.startsWith('gpu/') && k.split('/').length === 2);
    const images = Object.entries(allocators).filter(([k]) => /^gpu\/shared_images\/[^/]+\/mailbox_[^/]+$/.test(k));
    const byUsage = {};
    for (const [, image] of images) {
      const usage = image.attrs.usage?.value ?? 'unknown';
      byUsage[usage] = (byUsage[usage] ?? 0) + parseInt(image.attrs.size.value, 16);
    }
    const webglCanvasBackingBytes = Object.entries(byUsage).filter(([usage]) => usage.includes('Gles2Read') || usage.includes('Gles2Write')).reduce((sum, [, bytes]) => sum + bytes, 0);
    const sample = { label, dump, gpuPid: gpu.id, traceTimestamp: latest.ts, gpuBytes: size('gpu'), categories: Object.fromEntries(childKeys.map(k => [k, size(k)])), sharedImagesByUsage: byUsage, webglCanvasBackingBytes, heap: await renderer.send('Runtime.getHeapUsage') };
    // Preserve actual dumps and process metadata; unrelated trace events add no
    // evidence to this allocator check and needlessly bloat the repository.
    const retained = events.filter(e => e.ph === 'v' || e.name === 'process_name');
    fs.writeFileSync(path.join(out, `${label}.json.gz`), zlib.gzipSync(JSON.stringify({ traceEvents: retained })));
    report.samples.push(sample); write(); console.log(JSON.stringify({ label, gpuMiB: sample.gpuBytes / MiB, categories: sample.categories }));
  } finally { cdp.off('Tracing.dataCollected', collect); }
}

async function select(world, grade, seed) {
  const oldWorld = await page.locator('#world').inputValue();
  const oldGrade = await page.locator('#grade').inputValue();
  await page.locator('#seed').fill(String(seed));
  if (oldWorld !== world) await page.locator('#world').selectOption(world);
  else if (oldGrade !== grade) await page.locator('#grade').selectOption(grade);
  else await page.locator('#generate').click();
  await page.waitForFunction(({ world, seed }) => {
    const s = window.__r100Gym?.getState();
    return s?.recipe?.package.id === `r100-${world}` && s.recipe.requestedSeed === seed && s.runtime.running && !s.runtime.starting;
  }, { world, seed }, { timeout: 60000 });
  if (await page.locator('#grade').inputValue() !== grade) {
    await page.locator('#grade').selectOption(grade);
    await page.waitForFunction(grade => { const s = window.__r100Gym.getState(); return s.runtime.running && !s.runtime.starting && s.recipe.nativeDefinition.grade === grade; }, grade, { timeout: 60000 });
  }
  await page.waitForTimeout(500);
  if (!await page.evaluate(() => window.__r100Gym.getState().runtime.paused)) await page.locator('#pause').click();
}

try {
  report.systemInfo = await cdp.send('SystemInfo.getInfo');
  await page.goto(`${base}/r100-gym.html?world=${baselineWorld}&grade=severe&seed=20261004`);
  await page.waitForFunction(() => window.__r100Gym?.getState().runtime.running, null, { timeout: 60000 });
  for (const world of families) { await select(world, 'severe', 20261004); await snapshot(`family-${world}`); }
  await select(baselineWorld, 'severe', 20261004); await snapshot('warmed-baseline');
  const baseline = report.samples.at(-1);
  const repetitions = Number(process.env.QA_REBUILDS ?? 10);
  for (let i = 0; i < repetitions; i++) { await select(baselineWorld, 'severe', 20261004); await snapshot(`identical-${i + 1}`); }
  const worlds = await page.locator('#world option').evaluateAll(options => options.map(o => o.value));
  const mixed = Number(process.env.QA_MIXED_REBUILDS ?? 12);
  const mixedCycles = Number(process.env.QA_MIXED_CYCLES ?? 1);
  assert(Number.isInteger(mixedCycles) && mixedCycles >= 1 && mixedCycles <= 10);
  report.mixedCycles = mixedCycles;
  for (let cycle = 0; cycle < mixedCycles; cycle++) {
    for (let i = 0; i < mixed; i++) await select(worlds[(i + 6) % worlds.length], ['low', 'medium', 'severe'][i % 3], 20261004 + i);
    await select(baselineWorld, 'severe', 20261004);
    await snapshot(cycle === 0 ? 'after-mixed-return' : `after-mixed-return-${cycle + 1}`);
  }
  for (const sample of report.samples.filter(s => s.label.startsWith('identical-') || s.label.startsWith('after-mixed-return'))) {
    sample.sameWorldGpuGrowthBytes = sample.gpuBytes - baseline.gpuBytes;
    sample.sameWorldWebglCanvasBackingGrowthBytes = sample.webglCanvasBackingBytes - baseline.webglCanvasBackingBytes;
    sample.sameWorldHeapGrowthBytes = sample.heap.usedSize - baseline.heap.usedSize + Math.max(0, (sample.heap.backingStorageSize ?? 0) - (baseline.heap.backingStorageSize ?? 0));
    assert(sample.sameWorldWebglCanvasBackingGrowthBytes <= 10 * MiB, `${sample.label}: WebGL/Canvas shared-image same-world retained growth exceeds 10 MiB`);
    assert(sample.sameWorldHeapGrowthBytes <= 10 * MiB, `${sample.label}: JS+backing retained growth exceeds 10 MiB`);
  }
  await Promise.all(sourceFetches); assert.deepEqual(report.errors, []);
  report.status = 'passed-allocator-retention';
} catch (error) { report.status = 'failed'; report.failure = String(error); process.exitCode = 1; console.error(error); }
finally { await Promise.allSettled(sourceFetches); write(); await browser.close(); }
