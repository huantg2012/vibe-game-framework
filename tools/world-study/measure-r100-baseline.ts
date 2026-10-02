/** I01 timing evidence. Isolated generation and cold restoration, never a qualification claim. */
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, platform, release, totalmem } from 'node:os';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SELF = fileURLToPath(import.meta.url);
const DEFAULT_OUTPUT = 'docs/qa/artifacts/rift-r100-i01/generation-baseline.json';
type Identity = RiftCheckpoint['identity'];
type Channel = 'natural-selection-v2' | 'directed-regression-v2' | 'historical-fixture-v1';
interface SampleCase { id: string; channel: Channel; seed: number; identity?: Identity; expected?: Record<string, string> }
interface WorkerInput { mode: 'generate' | 'restore'; entry: SampleCase; identity?: Identity; expected?: Record<string, string> }
interface WorkerResult {
  status: 'ok' | 'error' | 'timeout'; mode: WorkerInput['mode']; elapsedMs?: number;
  warmCacheMs?: number; workerWallMs?: number; identity?: Identity; fingerprints?: Record<string, string>;
  error?: string; stderr?: string; [key: string]: unknown;
}
interface RecordEntry { entry: SampleCase; generation?: WorkerResult; restoration?: WorkerResult }
const hash = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const json = (value: unknown): string => JSON.stringify(value);

function stats(values: number[]): Record<string, number | null> {
  const ordered = [...values].sort((a, b) => a - b);
  // Nearest-rank empirical sample quantiles, explicitly not population estimates.
  const at = (q: number): number | null => ordered.length ? ordered[Math.ceil(ordered.length * q) - 1]! : null;
  return { count: values.length, min: ordered[0] ?? null, sampleP50: at(.5), sampleP95: at(.95),
    max: ordered.at(-1) ?? null, mean: values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null };
}

function cases(naturalCount: number): SampleCase[] {
  const natural: SampleCase[] = Array.from({ length: naturalCount }, (_, index) => ({
    id: `natural-${String(index + 1).padStart(2, '0')}`, channel: 'natural-selection-v2',
    seed: (0x91e10da5 + Math.imul(index, 0x9e3779b9)) >>> 0,
  }));
  const directed: SampleCase[] = [0, 5, 70421, 1002007].map(seed => ({ id: `regression-${seed}`,
    channel: 'directed-regression-v2', seed }));
  const fixture = JSON.parse(readFileSync(resolve(ROOT, 'tools/recovery/fixtures/world-generation-v1.json'), 'utf8')) as {
    records: { identity: Identity; tileMapHash: string; hostMapHash: string }[];
  };
  const old: SampleCase[] = fixture.records.map((row, index) => ({ id: `v1-fixture-${index}`,
    channel: 'historical-fixture-v1', seed: row.identity.generation!.requestedSeed, identity: row.identity,
    expected: { tileMapHash: row.tileMapHash, hostMapHash: row.hostMapHash } }));
  return [...natural, ...directed, ...old];
}

function sourceManifest(): Record<string, string> {
  const paths = new Set<string>();
  function add(file: string): void {
    const absolute = resolve(ROOT, file);
    if (paths.has(file) || !existsSync(absolute)) return;
    paths.add(file);
    if (!/\.(?:ts|mjs|js)$/.test(file)) return;
    const source = readFileSync(absolute, 'utf8');
    for (const match of source.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g)) {
      const specifier = match[1]!;
      const target = specifier.startsWith('@/') ? resolve(ROOT, 'src', specifier.slice(2))
        : specifier.startsWith('.') ? resolve(dirname(absolute), specifier) : undefined;
      if (!target) continue;
      for (const candidate of [target, `${target}.ts`, `${target}.mjs`, `${target}.js`, `${target}/index.ts`]) {
        if (existsSync(candidate) && /\.(?:ts|mjs|js|json|css)$/.test(candidate)) { add(relative(ROOT, candidate)); break; }
      }
    }
  }
  for (const file of ['src/managers/rift-recovery.ts', 'src/generation/world-study/production-recipe.ts',
    'src/generation/legacy-rift-v2/manifest.json', 'tools/recovery/fixtures/world-generation-v1.json',
    'tools/world-study/measure-r100-baseline.ts', 'tools/contam-preview/tsconfig.json',
    'tools/contam-preview/phaser-stub.ts', 'tools/recovery/register-css.mjs', 'tools/recovery/css-loader.mjs',
    'package-lock.json']) add(file);
  return Object.fromEntries([...paths].sort().map(file => [file, hash(readFileSync(resolve(ROOT, file)))]));
}

async function worker(input: WorkerInput): Promise<WorkerResult> {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues(values: Uint32Array): Uint32Array { values[0] = input.entry.seed; return values; },
  } });
  const { createProceduralDeparture, restoreProceduralWorld, proceduralRiftIdentity } = await import('../../src/managers/rift-recovery');
  const { checkpointChecksum } = await import('../../src/types/rift-checkpoint');
  const before = process.memoryUsage(), started = performance.now();
  try {
    const identity = input.mode === 'generate' ? createProceduralDeparture() : input.identity!;
    // Generation's measured interval is the actual formal departure call. Its map
    // is already cached; fetching it below must not be counted as cold restoration.
    const generationMs = performance.now() - started;
    const world = restoreProceduralWorld(identity);
    if (!world) throw new Error('Expected a versioned production world');
    const elapsedMs = input.mode === 'generate' ? generationMs : performance.now() - started;
    const after = process.memoryUsage();
    const warmStarted = performance.now();
    assert.equal(restoreProceduralWorld(identity), world);
    const warmCacheMs = performance.now() - warmStarted;
    assert.equal(proceduralRiftIdentity(world.layout).signature, identity.signature);
    const fingerprints = { tileMapHash: checkpointChecksum(world.layout.tileMap),
      hostMapHash: checkpointChecksum(world.hostTileMap), worldSha256: hash(json(world)) };
    if (input.expected) for (const [key, value] of Object.entries(input.expected)) {
      assert.equal(fingerprints[key as keyof typeof fingerprints], value, `cold restore ${key}`);
    }
    return { status: 'ok', mode: input.mode, elapsedMs, warmCacheMs, identity, fingerprints,
      executor: 'frozen-v1-v2', worldId: identity.generation!.profile.id, spaceId: identity.generation!.space.id,
      version: identity.generation!.version, selectedRequestedSeed: identity.generation!.requestedSeed,
      programId: identity.generation!.version === 2 ? identity.generation!.conditions.programId : null,
      metadata: world.metadata, identityBytes: Buffer.byteLength(json(identity)),
      memory: { before, after, rssDeltaBytes: after.rss - before.rss, heapUsedDeltaBytes: after.heapUsed - before.heapUsed,
        processPeakRssBytes: process.resourceUsage().maxRSS * 1024,
        note: 'Node process memory; no forced GC. Peak includes imports and post-timing fingerprint validation. Not browser/GPU residency or leak evidence.' } };
  } catch (error) {
    return { status: 'error', mode: input.mode, elapsedMs: performance.now() - started,
      error: error instanceof Error ? error.stack ?? error.message : String(error), memoryAfter: process.memoryUsage() };
  }
}

async function runWorker(input: WorkerInput, budgetMs: number): Promise<WorkerResult> {
  return await new Promise(resolveResult => {
    const started = performance.now();
    const child = spawn(process.execPath, ['--import', 'tsx', '--import', './tools/recovery/register-css.mjs', SELF, '--worker'], {
      cwd: ROOT, env: { ...process.env, TSX_TSCONFIG_PATH: 'tools/contam-preview/tsconfig.json' }, stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '', expired = false, finished = false;
    const finish = (result: WorkerResult): void => {
      if (finished) return; finished = true; clearTimeout(timer);
      resolveResult({ ...result, workerWallMs: performance.now() - started, ...(stderr ? { stderr } : {}) });
    };
    const timer = setTimeout(() => { expired = true; child.kill('SIGKILL'); }, budgetMs);
    child.stdout.on('data', data => { stdout += String(data); });
    child.stderr.on('data', data => { stderr += String(data); });
    child.stdin.on('error', () => { /* close/error supplies the bounded worker failure */ });
    child.on('error', error => finish({ status: 'error', mode: input.mode, error: error.message }));
    child.on('close', code => {
      if (expired) finish({ status: 'timeout', mode: input.mode, error: `Worker exceeded ${budgetMs} ms; recipe legality not inferred.` });
      else if (code !== 0) finish({ status: 'error', mode: input.mode, error: stderr || stdout || `exit ${code}` });
      else {
        try { finish(JSON.parse(stdout) as WorkerResult); }
        catch { finish({ status: 'error', mode: input.mode, error: 'Malformed worker JSON', stdout }); }
      }
    });
    child.stdin.end(json(input));
  });
}

function summary(records: RecordEntry[], planned: SampleCase[]): unknown[] {
  const channels: Channel[] = ['natural-selection-v2', 'directed-regression-v2', 'historical-fixture-v1'];
  return channels.map(channel => {
    const entries = records.filter(row => row.entry.channel === channel);
    const generations = entries.map(row => row.generation).filter((r): r is WorkerResult => r?.status === 'ok');
    const restorations = entries.map(row => row.restoration).filter((r): r is WorkerResult => r?.status === 'ok');
    const worlds = Object.fromEntries([...new Set(generations.map(row => row.worldId as string))].sort()
      .map(id => [id, generations.filter(row => row.worldId === id).length]));
    return { channel, planned: planned.filter(row => row.channel === channel).length, attempted: entries.length,
      generated: generations.length, restored: restorations.length,
      generationErrors: entries.filter(row => row.generation && row.generation.status !== 'ok').length,
      restorationErrors: entries.filter(row => row.restoration && row.restoration.status !== 'ok').length,
      generationMs: stats(generations.map(row => row.elapsedMs!)), coldRestoreMs: stats(restorations.map(row => row.elapsedMs!)),
      warmRestoreMs: stats(restorations.map(row => row.warmCacheMs!)),
      generationWorkerWallMs: stats(generations.map(row => row.workerWallMs!)),
      coldRestoreWorkerWallMs: stats(restorations.map(row => row.workerWallMs!)), worldSelectionCounts: worlds,
      fallbackUses: generations.filter(row => (row.metadata as { fallbackUsed: boolean }).fallbackUsed).length,
      attemptCounts: generations.map(row => (row.metadata as { attempt: number }).attempt) };
  });
}

function numberArg(name: string, fallback: number, min: number, max: number): number {
  const index = process.argv.indexOf(name), value = index < 0 ? fallback : Number(process.argv[index + 1]);
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be ${min}–${max}`);
  return value;
}

async function main(): Promise<void> {
  const naturalCount = numberArg('--natural-count', 32, 1, 256);
  const workerBudgetMs = numberArg('--worker-budget-ms', 30000, 1000, 120000);
  const totalBudgetMs = numberArg('--budget-ms', 300000, 1000, 1800000);
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new Error('--output requires a path');
  const output = resolve(ROOT, outputIndex < 0 ? DEFAULT_OUTPUT : process.argv[outputIndex + 1]!);
  const planned = cases(naturalCount), records: RecordEntry[] = [], sources = sourceManifest();
  const started = performance.now();
  const report: Record<string, unknown> = {
    schemaVersion: 1, createdAt: new Date().toISOString(), status: 'running',
    revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(),
    sourceHash: hash(json(sources)), sources,
    host: { platform: platform(), release: release(), arch: process.arch, node: process.version,
      cpu: cpus()[0]?.model ?? 'unknown', logicalCpus: cpus().length, totalMemoryBytes: totalmem(), loadAverageAtStart: loadavg() },
    method: { naturalSeedSequence: 'uint32(0x91e10da5 + imul(index, 0x9e3779b9)), index=0..N-1, no filtering',
      executor: 'Formal departure and recovery dispatch frozen v1/v2 executor; selector uses current generated CSV configuration.',
      isolation: 'Sequential workers. Every generation and every cold restore gets its own fresh Node process; serialized identity passes over stdin.',
      elapsedMs: 'Measured after module import; departure includes selector, generation and signature. Restore includes validation/signature. Worker wall time separately includes Node/TSX startup and fingerprint checks.',
      quantiles: 'Nearest-rank empirical sample quantiles. 32 natural seeds are not sufficient to estimate population p99.',
      failurePolicy: 'No replacement/resampling on failure. Preserve per-case errors and timeouts. Historical/directed cases never enter the natural denominator.' },
    limitations: ['Node CPU/heap baseline, not browser frame timing, GPU memory, mobile/lower-spec qualification, or natural player experience.',
      'Concurrent developer activity can affect timings. CPU load recorded; no claims of isolated lab measurement.',
      'No warm-process JIT generation measurement; warm restore explicitly measures an existing cache, not regeneration.',
      'Existing legacy worlds only; zero R100 world–pollution-grade qualification cells inferred.'],
    workerBudgetMs, totalBudgetMs, planned, records,
  };
  const persist = (): void => {
    report.elapsedMs = performance.now() - started; report.summary = summary(records, planned);
    report.remainingCaseIds = planned.slice(records.length).map(row => row.id);
    mkdirSync(dirname(output), { recursive: true });
    const temporary = `${output}.tmp-${process.pid}`;
    writeFileSync(temporary, JSON.stringify(report, null, 2) + '\n'); renameSync(temporary, output);
  };
  persist();
  for (const entry of planned) {
    let remaining = totalBudgetMs - (performance.now() - started);
    if (remaining < 1000) break;
    const record: RecordEntry = { entry }; records.push(record);
    let identity = entry.identity, expected = entry.expected;
    if (!identity) {
      record.generation = await runWorker({ mode: 'generate', entry }, Math.min(workerBudgetMs, remaining));
      if (record.generation.status === 'ok') { identity = record.generation.identity; expected = record.generation.fingerprints; }
      persist(); // The generated identity is durable before a new process attempts restore.
    }
    remaining = totalBudgetMs - (performance.now() - started);
    if (identity && remaining >= 1000) {
      record.restoration = await runWorker({ mode: 'restore', entry, identity, expected }, Math.min(workerBudgetMs, remaining));
    }
    persist();
    process.stderr.write(`R100 baseline ${records.length}/${planned.length}: ${entry.id} generate=${record.generation?.status ?? 'fixture'} restore=${record.restoration?.status ?? 'not-run'}\n`);
  }
  report.sourcesUnchanged = json(sources) === json(sourceManifest());
  report.finishedAt = new Date().toISOString(); report.loadAverageAtEnd = loadavg();
  const failed = records.some(row => row.generation?.status === 'error' || row.restoration?.status === 'error');
  const incomplete = records.length < planned.length || records.some(row => row.generation?.status === 'timeout'
    || row.restoration?.status === 'timeout' || ((row.entry.identity || row.generation?.status === 'ok') && !row.restoration));
  report.status = !report.sourcesUnchanged ? 'source-changed-during-run'
    : incomplete ? 'partial-budget-limited' : failed ? 'complete-with-errors' : 'finite-sample-complete';
  persist();
  console.log(json({ output: relative(ROOT, output), status: report.status, elapsedMs: report.elapsedMs, summary: report.summary }));
  if (!report.sourcesUnchanged || incomplete || failed) process.exitCode = 1;
}

if (process.argv.includes('--worker')) console.log(json(await worker(JSON.parse(readFileSync(0, 'utf8')) as WorkerInput)));
else if (process.argv.includes('--self-test')) {
  assert.deepEqual(stats([]), { count: 0, min: null, sampleP50: null, sampleP95: null, max: null, mean: null });
  assert.deepEqual(stats([4, 1, 3, 2]), { count: 4, min: 1, sampleP50: 2, sampleP95: 4, max: 4, mean: 2.5 });
  const cohort = cases(32), natural = cohort.filter(row => row.channel === 'natural-selection-v2');
  assert.equal(natural.length, 32); assert.equal(new Set(natural.map(row => row.seed)).size, 32);
  assert.equal(cohort.filter(row => row.channel === 'historical-fixture-v1').length, 4);
  assert(natural.every(row => Number.isSafeInteger(row.seed) && row.seed >= 0 && row.seed <= 0xffffffff));
  assert.equal((summary([], cohort)[0] as { planned: number }).planned, 32);
  console.log('PASS R100 measurement statistics, fixed distinct natural cohort, independent channel denominators and historical fixtures');
} else await main();
