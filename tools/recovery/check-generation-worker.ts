/** Real isolated workers + deterministic lifecycle failures; no game save is touched. */
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { Worker as NodeWorker } from 'node:worker_threads';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { RiftGenerationClient, type RiftGenerationWorkerPort } from '../../src/generation/rift-generation-client';
import type { RiftGenerationInput, RiftGenerationRequest, RiftGenerationResponse, RiftGenerationWire } from '../../src/generation/rift-generation-protocol';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';
import { TileType } from '../../src/types/game-types';
import { legacyGenerationGold } from './legacy-generation-gold';

const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/legacy-generation-gold.json', 'utf8'));
const v1 = JSON.parse(readFileSync('tools/recovery/fixtures/world-generation-v1.json', 'utf8'));
const input: RiftGenerationInput = { kind: 'recovery', identity: fixture.records[0].identity };
class FakeWorker implements RiftGenerationWorkerPort {
  onmessage: RiftGenerationWorkerPort['onmessage'] = null;
  onerror: RiftGenerationWorkerPort['onerror'] = null;
  onmessageerror: RiftGenerationWorkerPort['onmessageerror'] = null;
  request: RiftGenerationRequest | null = null;
  terminated = 0;
  postMessage(request: RiftGenerationRequest): void { this.request = request; }
  terminate(): void { this.terminated++; }
  respond(response: RiftGenerationResponse): void { this.onmessage?.({ data: response } as MessageEvent<RiftGenerationResponse>); }
}
function assertDisposed(worker: FakeWorker): void {
  assert.equal(worker.terminated, 1); assert.equal(worker.onmessage, null);
  assert.equal(worker.onerror, null); assert.equal(worker.onmessageerror, null);
}
assert.throws(() => new RiftGenerationClient(undefined, 60001));
assert.throws(() => new RiftGenerationClient(undefined, 0));
const cancelled = new AbortController(); cancelled.abort();
await assert.rejects(new RiftGenerationClient(() => { throw new Error('Must not create aborted worker'); })
  .generate(input, cancelled.signal), { name: 'AbortError' });
const abortedWorker = new FakeWorker(), controller = new AbortController();
const aborted = new RiftGenerationClient(() => abortedWorker).generate(input, controller.signal);
const late = abortedWorker.onmessage!;
controller.abort();
await assert.rejects(aborted, { name: 'AbortError' }); assertDisposed(abortedWorker);
late({ data: { id: abortedWorker.request!.id, result: {} as RiftGenerationWire } } as MessageEvent<RiftGenerationResponse>);
assertDisposed(abortedWorker);
const timeoutWorker = new FakeWorker();
await assert.rejects(new RiftGenerationClient(() => timeoutWorker, 5).generate(input), { name: 'TimeoutError' });
assertDisposed(timeoutWorker);
for (const failure of ['error', 'messageerror', 'response-error', 'post-error'] as const) {
  const fake = new FakeWorker();
  if (failure === 'post-error') fake.postMessage = () => { throw new Error('post failed'); };
  const waiting = new RiftGenerationClient(() => fake).generate(input);
  if (failure === 'error') fake.onerror!({ message: 'worker failed' } as ErrorEvent);
  else if (failure === 'messageerror') fake.onmessageerror!({} as MessageEvent);
  else if (failure === 'response-error') fake.respond({ id: fake.request!.id, error: 'generation failed' });
  await assert.rejects(waiting); assertDisposed(fake);
}
const stale = new FakeWorker(), waiting = new RiftGenerationClient(() => stale).generate(input);
stale.respond({ id: stale.request!.id + 1, error: 'stale' });
assert.equal(stale.terminated, 0);
stale.respond({ id: stale.request!.id, result: {} as RiftGenerationWire });
await waiting; assertDisposed(stale);
console.log('PASS worker lifecycle: pre-abort, active abort, late/stale replies, timeout, worker/clone/post errors, success cleanup');

const temporary = mkdtempSync(join(tmpdir(), 'coh-generation-worker-'));
const originalWorker = Object.getOwnPropertyDescriptor(globalThis, 'Worker');
const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
let spawned = 0, terminated = 0;
try {
  const bundle = await build({ stdin: { contents: `import { parentPort } from 'node:worker_threads';
globalThis.self = { onmessage: null, postMessage: data => parentPort.postMessage(data) };
await import(${JSON.stringify(resolve('src/generation/rift-generation-worker.ts'))});
parentPort.on('message', data => globalThis.self.onmessage({ data }));`, resolveDir: process.cwd(), sourcefile: 'node-worker-shim.ts' },
    bundle: true, platform: 'node', format: 'esm', target: 'es2022', write: false, metafile: true, tsconfig: 'tsconfig.json' });
  assert(!Object.keys(bundle.metafile!.inputs).some(path => /src\/(?:managers|scenes)\/|node_modules\/phaser/.test(path)),
    'Generation worker must remain independent of Phaser, managers and persistent game state');
  const file = join(temporary, 'worker.mjs'); writeFileSync(file, bundle.outputFiles[0]!.contents);
  class RealWorker implements RiftGenerationWorkerPort {
    onmessage: RiftGenerationWorkerPort['onmessage'] = null;
    onerror: RiftGenerationWorkerPort['onerror'] = null;
    onmessageerror: RiftGenerationWorkerPort['onmessageerror'] = null;
    private readonly worker = new NodeWorker(file);
    constructor() {
      spawned++;
      this.worker.on('message', data => this.onmessage?.({ data } as MessageEvent<RiftGenerationResponse>));
      this.worker.on('error', error => this.onerror?.({ message: error.message } as ErrorEvent));
      this.worker.on('messageerror', () => this.onmessageerror?.({} as MessageEvent));
    }
    postMessage(request: RiftGenerationRequest): void { this.worker.postMessage(request); }
    terminate(): void { terminated++; void this.worker.terminate(); }
  }
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: RealWorker });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  const recovery = await import('../../src/managers/rift-recovery');
  for (const record of [...v1.records, ...fixture.records]) {
    const identity = record.identity as RiftCheckpoint['identity'], bytes = JSON.stringify(identity);
    await recovery.prepareProceduralRecovery(identity);
    assert(recovery.hasPreparedProceduralLayout(identity));
    const layout = recovery.withPreparedProceduralRecovery(identity, () => recovery.restoreProceduralLayout(identity));
    const world = recovery.restoreProceduralWorld(identity);
    assert.equal(recovery.proceduralRiftIdentity(layout).signature, identity.signature);
    assert.equal(JSON.stringify(identity), bytes, 'Caller identity remains unchanged');
    if (record.layoutSha256) {
      const { id: _id, identity: _identity, ...expected } = record;
      assert.deepEqual(legacyGenerationGold(layout, world), expected);
    } else {
      assert.equal(checkpointChecksum(layout.tileMap), record.tileMapHash);
      assert.equal(checkpointChecksum(world!.hostTileMap), record.hostMapHash);
    }
    for (let y = -1; y <= layout.tileMap.rows; y++) for (let x = -1; x <= layout.tileMap.cols; x++) {
      const tile = layout.tileMap.tiles[y]?.[x];
      assert.equal(layout.walkableMask.isWalkable(x, y), tile === TileType.FLOOR || tile === TileType.FRACTURE);
    }
    const bad = { ...identity, signature: 'tampered' };
    assert(!recovery.hasPreparedProceduralLayout(bad));
    assert.throws(() => recovery.withPreparedProceduralRecovery(bad, () => true));
    recovery.withPreparedProceduralRecovery(identity, () => {
      assert.throws(() => recovery.restoreProceduralLayout({ ...identity, seed: (identity.seed + 1) >>> 0 }),
        /cannot synchronously generate/, 'A scoped admission cannot fall back to expensive generation');
    });
    const before = spawned;
    await recovery.prepareProceduralRecovery(identity);
    assert.equal(spawned, before, 'Exact ready identity reuses cache');
    console.log(`PASS isolated ${record.id ?? 'v1'} identity ${identity.signature}: old values, rebuilt walkability and prepared-only scope`,
      recovery.getProceduralPreparationMetrics());
  }
  // Cold error and active cancellation never admit an unverified map.
  await assert.rejects(recovery.prepareProceduralRecovery({ ...fixture.records[0].identity, signature: 'tampered' }));
  const unknown = structuredClone(fixture.records[0].identity); unknown.generation.version = 3;
  const beforeInvalid = spawned;
  await assert.rejects(recovery.prepareProceduralRecovery(unknown));
  assert.equal(spawned, beforeInvalid);
  const cold = v1.records[0].identity as RiftCheckpoint['identity'];
  const abort = new AbortController();
  const pending = recovery.prepareProceduralRecovery(cold, { signal: abort.signal });
  abort.abort(); await assert.rejects(pending, { name: 'AbortError' });
  assert(!recovery.hasPreparedProceduralLayout(cold));
  let randomCalls = 0;
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
    getRandomValues(values: Uint32Array) { randomCalls++; values[0] = 0; return values; },
  } });
  const departure = await recovery.prepareProceduralDeparture();
  assert.equal(randomCalls, 1); assert.equal(departure.signature, fixture.records[0].identity.signature);
  assert.equal(departure.catalogVersion, 'contaminant-v1');
  assert.equal(departure.lootAlgorithmVersion, 1); assert.equal(departure.combatRulesVersion, 2);
  assert.equal(spawned, terminated, 'Every generated/failed/cancelled worker must be terminated');
  console.log(`PASS async generation: ${v1.records.length} v1 + ${fixture.records.length} gold cases; frozen new departure; ${spawned}/${terminated} workers disposed; no Phaser/storage dependencies`);
} finally {
  if (originalWorker) Object.defineProperty(globalThis, 'Worker', originalWorker); else Reflect.deleteProperty(globalThis, 'Worker');
  if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto);
  rmSync(temporary, { recursive: true, force: true });
}
