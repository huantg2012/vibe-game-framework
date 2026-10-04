/** World-library qualification evidence is deliberately narrower than art/play acceptance. */
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { dirname, resolve } from 'node:path';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { R100_EXPEDITION_GRADES } from '../../src/generated/rift-expedition-grade-data';
import { createR100ProductionRecipe, validR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { createR100ProductionMap } from '../../src/generation/world-study/r100-production-map';
import { generatedRiftIdentity } from '../../src/generation/rift-generation-identity';
import { executeRiftGeneration } from '../../src/generation/rift-generation-execute';
import { hydrateRiftGeneration, riftGenerationTransferables } from '../../src/generation/rift-generation-protocol';
import { hydrateR100MasterWorld } from '../../src/generation/world-study/r100-native-data';
import { bakePaintGenome, collectPaintGenomeFloorTiles } from '../../src/entities/form-renderers/d/paint-genome/bake';
import { resolvePaintVeinVariant } from '../../src/entities/form-renderers/d/paint-genome/topology';
import { mix32 } from '../../src/generation/seed-fork';
import { POLLUTION_GRADES } from '../../src/generation/world-study/pollution-grade';
import { ContaminationHostSystem, validateHostRuntimeSnapshot } from '../../src/systems/contamination-host-system';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { MasterMaterialAudio, validMasterMaterialAudioState } from '../../src/systems/r100-world/audio';
import { r100MaterialPressure } from '../../src/systems/r100-world/presentation-state';

interface QualificationCase { world: string; grade: 'low' | 'medium' | 'severe'; seed: number; cohort: string }
function qualify(input: QualificationCase) {
 const world = R100_NATIVE_WORLDS.find(row => row.id === input.world)!, grade = input.grade, seed = input.seed;
 const graphic: unknown = new Proxy({}, { get: () => () => graphic });
 const scene = { add: { graphics: () => graphic } };
  const requested = createR100ProductionRecipe(world.id, seed, grade), before = JSON.stringify(requested), started = performance.now();
  const value = createR100ProductionMap(requested), layout = value.layout, native = hydrateR100MasterWorld(value.native!, layout);
  const grid = new TileGrid(layout.tileMap), hostGrid = new TileGrid(value.hostTileMap);
  assert.equal(value.metadata.requestedSeed, seed); assert.equal(requested.gradeDefinition.id, grade);
  assert(value.metadata.attempt < 8);
  assert.equal(value.native!.definition.id, requested.nativeDefinition.id);
  for (const point of [layout.spawnPoint, layout.extractionPoint.position, ...layout.kindlingNodes.map(row => row.position), ...layout.contaminantNodes.map(row => row.position)])
    assert(bodyHasSupport(grid, point, 10, 10), `${world.id}/${grade}: full body at content`);
  for (const enemy of layout.enemySpawns) for (let index = 1; index < enemy.patrol.waypoints.length; index++) {
    const a = enemy.patrol.waypoints[index - 1]!, b = enemy.patrol.waypoints[index]!;
    assert.equal(bodyDisplacementFraction(grid, { x: (a.col + .5) * 8, y: (a.row + .5) * 8 }, 10, 10, (b.col - a.col) * 8, (b.row - a.row) * 8), 1);
  }
  assert.equal(requested.package.algorithmRevision, 2);
  assert(layout.enemySpawns.every(enemy => enemy.patrol.mode === 'pingpong' && enemy.patrol.waypoints.length >= 2), 'new worlds cannot silently fall back to a permanent guard');
  const patrolWindows = (native.diagnostics.expedition as { patrolWindows: { id: string; durationMs: number }[] }).patrolWindows;
  const searchNodes = [...layout.kindlingNodes, ...layout.contaminantNodes].filter(node => node.tier !== 'safe');
  assert.equal(patrolWindows.length, searchNodes.length);
  assert(searchNodes.every(node => patrolWindows.some(window => window.id === node.id && window.durationMs >= 2400)), 'each guarded node has a dry full-body search window in the unalerted patrol model');
  const budget = R100_EXPEDITION_GRADES.find(row => row.grade_id === grade)!;
  assert.equal(layout.enemySpawns.length, budget.enemy_count);
  assert.equal(layout.kindlingNodes.filter(node => node.tier === 'safe').length, 1);
  assert.equal(layout.kindlingNodes.find(node => node.tier === 'safe')!.value, 1);
  const occupied = new Set<string>(), footprints: { id: string; cells: { col: number; row: number }[] }[] = [];
  for (const [slot, form] of layout.contaminationDraw.forms.filter(form => form.portfolio === 'bing').entries()) {
    const id = `ENM_BING_${String(slot + 1).padStart(2, '0')}`, pin = layout.contaminationPins.paintFloors[slot]!, hostSeed = mix32(layout.seed, id);
    const baked = bakePaintGenome({ ...form, seed: hostSeed, sense: form.lexemes.sense, rhythm: form.lexemes.rhythm,
      fragmentTypeId: layout.fragmentTypeId, geometryVersion: 2, veinVariant: resolvePaintVeinVariant(form.substrate, hostSeed) });
    const cells = (field: Float32Array) => collectPaintGenomeFloorTiles(field, baked.canvasW, baked.canvasH, (pin.floorCol + .5) * 32, (pin.floorRow + .5) * 32, 32);
    for (const point of cells(baked.terrainFootprintField)) assert(hostGrid.isWalkable(point.col, point.row), 'complete breathing support');
    const danger = cells(baked.field);
    for (const point of danger) { const key = `${point.col},${point.row}`; assert(!occupied.has(key), 'no stacked paint contact'); occupied.add(key); }
    footprints.push({ id, cells: danger });
  }
  for (const point of native.pollution.safeRoute) {
    const col = Math.floor(point.x / 32), row = Math.floor(point.y / 32);
    assert(!occupied.has(`${col},${row}`));
    assert(!native.pollution.volumes.some(box => col >= box.minCol && col <= box.maxCol && row >= box.minRow && row <= box.maxRow));
  }
  const hosts = new ContaminationHostSystem();
  hosts.create(scene as never, { ...layout, tileMap: value.hostTileMap }, null, null, () => 1,
    { liveMotion: true, occluders: hostGrid, sightGrid: native.sight });
  hosts.setSkipPaint(true);
  for (const footprint of footprints) hosts.setStepFloors(footprint.id, footprint.cells);
  const snapshot = hosts.exportRuntimeState();
  assert(validateHostRuntimeSnapshot(snapshot, layout.contaminationDraw));
  assert(hosts.validateRuntimeState(snapshot)); hosts.restoreRuntimeState(structuredClone(snapshot));
  assert.deepEqual(hosts.exportRuntimeState(), snapshot);
  const volumes = hosts.getSubjects().filter(host => host.form.portfolio === 'ding').map(host => host.id);
  assert.deepEqual(volumes, Array.from({ length: requested.gradeDefinition.volumeCount }, (_, index) => `ENM_DING_${String(index + 1).padStart(2, '0')}`));
  const targets = hosts.getRecoveryTargetIds(); assert.equal(new Set(targets).size, targets.length);
  const coldHosts = new ContaminationHostSystem();
  coldHosts.create(scene as never, { ...layout, tileMap: value.hostTileMap }, null, null, () => 1,
    { liveMotion: true, occluders: hostGrid, sightGrid: native.sight });
  coldHosts.setSkipPaint(true);
  for (const footprint of footprints) coldHosts.setStepFloors(footprint.id, footprint.cells);
  // Actual wall/paint/volume state advances through gathering, danger, release
  // and cooldown. A fresh owner must continue every captured phase identically.
  for (const delta of [16.67, 1083.33, 1300, 650, 1700, 5916.3, 16.67]) {
    hosts.update(delta, layout.spawnPoint, false, 0);
    const state = hosts.exportRuntimeState();
    assert(validateHostRuntimeSnapshot(state, layout.contaminationDraw));
    assert(coldHosts.validateRuntimeState(state)); coldHosts.restoreRuntimeState(structuredClone(state));
    hosts.update(16.67, layout.spawnPoint, false, 0); coldHosts.update(16.67, layout.spawnPoint, false, 0);
    assert.deepEqual(coldHosts.exportRuntimeState(), hosts.exportRuntimeState(), 'cold Host phase continues without resetting its danger clock');
  }
  coldHosts.destroy();
  hosts.destroy();
  const audio = new MasterMaterialAudio({ family: requested.nativeDefinition.family, grade, seed }, { playSFX() {}, stopInstance() {} });
  const audioRestored = new MasterMaterialAudio({ family: requested.nativeDefinition.family, grade, seed }, { playSFX() {}, stopInstance() {} });
  const period = requested.nativeDefinition.motion_period, sources = [{ x: layout.spawnPoint.x + 40, y: layout.spawnPoint.y }];
  // The real quiet-to-loading transition caused a live save rejection. Check
  // every 60Hz frame and restore at normal 500ms save cadence, including silence.
  for (let frame = 0; frame <= Math.ceil(period * 60 * 2); frame++) {
    const time = frame * (1000 / 60), pressure = r100MaterialPressure(time, period);
    audio.update(time, pressure, layout.spawnPoint, sources);
    const state = audio.exportRuntimeState(); assert(validMasterMaterialAudioState(state));
    if (frame % 30 === 0) {
      audioRestored.restoreRuntimeState(structuredClone(state));
      assert.deepEqual(audioRestored.exportRuntimeState(), state, 'silent intervals are recoverable too');
    }
  }
  audio.destroy(); audioRestored.destroy();
  const identity = generatedRiftIdentity(layout, requested, value);
  {
    const wire = executeRiftGeneration({ kind: 'recovery', identity });
    const buffers = riftGenerationTransferables(wire), first = buffers[0];
    const received = hydrateRiftGeneration(structuredClone(wire, { transfer: buffers }));
    if (first) assert.equal(first.byteLength, 0, 'sender relinquishes the buffer');
    assert.equal(generatedRiftIdentity(received.layout, requested, received.world).signature, identity.signature);
    assert(validR100ProductionRecipe(requested));
  }
  assert.equal(JSON.stringify(requested), before, 'content and grade remain immutable');
  return { world: world.id, cohort: input.cohort, grade, seed, effectiveSeed: layout.seed, attempts: value.metadata.attempt + 1,
    signature: identity.signature, geometry: native.diagnostics.geometryFingerprint, generationAndChecksMs: performance.now() - started,
    bodySeats: value.metadata.reachableBodySeats, hostCounts: { paint: footprints.length, volume: volumes.length },
    rejectedAttempts: value.metadata.rejected, actualInteractionCost: native.diagnostics.expedition };
}

if (!isMainThread) {
  try { parentPort!.postMessage({ ok: true, value: qualify(workerData) }); }
  catch (error) { parentPort!.postMessage({ ok: false, error: error instanceof Error ? error.stack : String(error) }); }
} else {
  const { build } = await import('esbuild');
  const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const arg = (name: string) => { const at = process.argv.indexOf(name); return at < 0 ? undefined : process.argv[at + 1]; };
  const full = process.argv.includes('--full'), held = arg('--holdout');
  const reportPath = resolve(arg('--report') ?? 'docs/qa/artifacts/r100-i03-i06/native-library.json');
  const folder = dirname(reportPath); mkdirSync(folder, { recursive: true });
  const normal = Array.from({ length: 32 }, (_, i) => ((i + 1) * 0x100000000 / 33) >>> 0);
  // Integer limits, a former packing retry, and the recorded real checkpoint failure world.
  const boundary = [0, 1, 28, 65535, 65536, 0x7fffffff, 0xffffffff, 3390232493];
  const heldData = held ? JSON.parse(readFileSync(held, 'utf8')) : null;
  const seeds = held ? ((Array.isArray(heldData) ? heldData : heldData.seeds) as number[]).map(seed => ({ seed, cohort: 'independent-holdout' }))
    : full ? [...normal.map(seed => ({ seed, cohort: 'ordinary' })), ...boundary.map(seed => ({ seed, cohort: 'boundary' }))]
    : [20261002, 20261003].map(seed => ({ seed, cohort: 'smoke' }));
  assert.equal(new Set(seeds.map(row => row.seed)).size, seeds.length);
  assert(seeds.every(row => Number.isSafeInteger(row.seed) && row.seed >= 0 && row.seed <= 0xffffffff));
  const existingExecutor = arg('--executor');
  const result = existingExecutor ? null : await build({ entryPoints: ['tools/world-study/check-r100-library.ts'], bundle: true, write: false,
    platform: 'node', format: 'esm', target: 'node22', tsconfig: 'tools/contam-preview/tsconfig.json',
    external: ['esbuild'], metafile: true });
  const bytes = existingExecutor ? readFileSync(existingExecutor) : result!.outputFiles[0]!.contents;
  const bundleHash = sha(bytes), executor = resolve(folder, `qualification-${bundleHash.slice(0, 12)}.mjs`);
  writeFileSync(executor, bytes);
  const previousSource = existingExecutor ? JSON.parse(readFileSync(resolve(dirname(existingExecutor), 'source-snapshot.json'), 'utf8')) : null;
  if (previousSource) assert.equal(previousSource.sha256, bundleHash, 'holdout must load the already committed executor');
  const source = { executor: executor.slice(process.cwd().length + 1), sha256: bundleHash,
    dependencies: previousSource?.dependencies ?? Object.keys(result!.metafile!.inputs).sort().map(path => ({ path, sha256: sha(readFileSync(path)) })) };
  writeFileSync(resolve(folder, 'source-snapshot.json'), JSON.stringify(source, null, 2) + '\n');
  const cases = R100_NATIVE_WORLDS.filter(row => !arg('--world') || row.id === arg('--world')).flatMap(world =>
    POLLUTION_GRADES.flatMap(grade => seeds.map(row => ({ world: world.id, grade, ...row }))));
  const rows: ReturnType<typeof qualify>[] = [], failures: unknown[] = [], timings: number[] = [];
  const log = resolve(folder, 'cases.jsonl'); writeFileSync(log, '');
  const timeoutMs = 60000, concurrency = Math.min(2, Math.max(1, Number(arg('--concurrency') ?? 2)));
  console.log(`FROZEN ${bundleHash}: ${cases.length} cases, ${concurrency} isolated workers, ${timeoutMs}ms timeout/case`);
  let cursor = 0;
  const run = (input: QualificationCase) => new Promise<any>(done => {
    const worker = new Worker(executor, { workerData: input }); let complete = false;
    const finish = (value: any) => { if (complete) return; complete = true; clearTimeout(timer); void worker.terminate(); done(value); };
    const timer = setTimeout(() => finish({ ok: false, error: `Case exceeded ${timeoutMs}ms; no replacement seed` }), timeoutMs);
    worker.once('message', finish); worker.once('error', error => finish({ ok: false, error: String(error.stack) }));
    worker.once('exit', code => { if (!complete) finish({ ok: false, error: `Worker ended before reporting (${code})` }); });
  });
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (cursor < cases.length) {
      const input = cases[cursor++]!, started = performance.now(), value = await run(input);
      const durationMs = performance.now() - started; timings.push(durationMs);
      if (value.ok) rows.push(value.value); else failures.push({ ...input, error: value.error, durationMs });
      appendFileSync(log, JSON.stringify({ ...input, ...value, durationMs }) + '\n');
      if ((rows.length + failures.length) % 60 === 0) console.log(`QUALIFIED ${rows.length + failures.length}/${cases.length}; failures=${failures.length}`);
    }
  }));
  rows.sort((a, b) => `${a.world}:${a.grade}:${a.seed}`.localeCompare(`${b.world}:${b.grade}:${b.seed}`));
  timings.sort((a, b) => a - b);
  const distribution = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [String(i + 1), rows.filter(row => row.attempts === i + 1).length]));
  const report = { status: failures.length ? 'failed' : 'pass', scope: 'Complete native generation, real Host, body paths, full CPU cold reconstruction and transferable ownership. No GPU/art/play approval.',
    source, timeoutMs, concurrency, worlds: new Set(cases.map(row => row.world)).size,
    grades: new Set(cases.map(row => `${row.world}/${row.grade}`)).size, seeds, cases: cases.length,
    successful: rows.length, failures, transferred: rows.length, attemptDistribution: distribution,
    workerDurationMs: { p50: timings[Math.floor(timings.length * .5)], p95: timings[Math.floor(timings.length * .95)], p99: timings[Math.floor(timings.length * .99)], max: timings.at(-1) }, rows };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.status.toUpperCase()} native library ${report.worlds} worlds / ${report.grades} grades / ${report.cases} fixed seed cases; ${rows.length} transferred cold reconstructions; ${failures.length} failures`);
  if (failures.length) process.exitCode = 1;
}
