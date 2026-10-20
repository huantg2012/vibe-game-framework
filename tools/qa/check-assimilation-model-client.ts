import assert from 'node:assert/strict';
import { createAssimilationModelClient, disposeAssimilationModelCache } from '../../src/art/assimilation-model/client';
import type { AssimilationModelFrame, AssimilationModelRequest } from '../../src/art/assimilation-model/protocol';

/** This finite scheduler test never builds an actor or starts a real worker.
 * Geometry/byte parity is covered by check-assimilation-model-geometry.ts. */
class FakeWorker {
  static requests = 0;
  static instances = 0;
  static live = 0;
  static failNext = false;
  onmessage: ((event: { data: AssimilationModelFrame }) => void) | null = null;
  onerror: ((event: { message: string }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  private closed = false;
  constructor() { FakeWorker.instances++; FakeWorker.live++; }
  postMessage(request: AssimilationModelRequest): void {
    FakeWorker.requests++;
    queueMicrotask(() => {
      if (this.closed) return;
      if (FakeWorker.failNext) { FakeWorker.failNext = false; this.onerror?.({ message: 'finite injected worker error' }); return; }
      const channels = Array.from({ length: 4 }, () => new Uint8Array(64 * 80 * 4));
      for (const channel of channels) channel.set([request.id % 254 + 1, 19, 31, 255]);
      const frame: AssimilationModelFrame = {
        id: request.id, width: 64, height: 80, albedo: channels[0]!, normal: channels[1]!, material: channels[2]!, depth: channels[3]!,
        meta: { yaw: request.yaw, phase: request.phase, breath: request.breath, amount: request.amount, fibre: request.fibre,
          structure: request.structure ?? 1, part: request.part ?? 'body', pose: request.pose ?? 'idle',
          settle: request.settle, attackSample: request.attackSample, anchor: [32, 66], lamp: [0, 1, 0],
          shoulder: { world: [0, 1, 0], screen: [32, 40] }, wrist: { world: [0, .7, 0], screen: [32, 50] }, shadowCapsules: [] },
        buildMs: 1, bakeMs: 2, triangles: 1,
      };
      this.onmessage?.({ data: frame });
    });
  }
  terminate(): void { if (!this.closed) { this.closed = true; FakeWorker.live--; } }
}
Object.defineProperty(globalThis, 'Worker', { value: FakeWorker, configurable: true });
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 5));
async function ready(client: ReturnType<typeof createAssimilationModelClient>): Promise<void> {
  for (let attempt = 0; attempt < 1000; attempt++) {
    assert.notEqual(client.status.state, 'failed', client.status.error);
    if (client.status.state === 'ready') return;
    await tick();
  }
  throw new Error('Finite model cache check exceeded five seconds');
}
async function checkHandoff(): Promise<void> {
  const rift = createAssimilationModelClient({ profile: 'rift', yaws: [0] });
  const source = { amount: 1, fibre: .5 };
  rift.update(source); await ready(rift);
  const baseline = FakeWorker.requests;
  rift.prewarm({ profile: 'haven', yaws: [0] });
  for (let i = 0; i < 100 && FakeWorker.requests < baseline + 3; i++) await tick();
  const retained = FakeWorker.requests - baseline;
  assert(retained > 0 && retained < 69, 'The prewarm is deliberately incomplete at scene shutdown');
  rift.destroy();
  const paused = FakeWorker.requests;
  await new Promise(resolve => setTimeout(resolve, 40));
  assert.equal(FakeWorker.requests, paused, 'Unwatched prewarming pauses during the handoff grace period');
  const haven = createAssimilationModelClient({ profile: 'haven', yaws: [0] });
  haven.update(source);
  assert.equal(haven.status.completed, retained, 'The next scene acquires completed prewarm frames without rebaking');
  assert.equal(haven.getFrame({ yaw: 0, phase: null, breath: 0 }), null, 'A partial handoff bank still cannot render');
  await ready(haven);
  assert.equal(FakeWorker.requests, baseline + 69, 'Every Haven frame is baked exactly once across scene handoff');

  const expired = createAssimilationModelClient({ profile: 'rift', yaws: [1] });
  expired.update(source);
  for (let i = 0; i < 100 && expired.status.completed < 1; i++) await tick();
  assert(expired.status.completed > 0);
  expired.destroy();
  const banksBeforeExpiry = haven.metrics.bankCount;
  await new Promise(resolve => setTimeout(resolve, 2050));
  assert.equal(haven.metrics.bankCount, banksBeforeExpiry - 1, 'Unclaimed partial bank expires after the bounded grace');
  const afterExpiry = createAssimilationModelClient({ profile: 'rift', yaws: [1] });
  afterExpiry.update(source);
  assert.equal(afterExpiry.status.completed, 0, 'An expired partial bank starts fresh');
  afterExpiry.destroy(); haven.destroy(); disposeAssimilationModelCache();
  assert.equal(FakeWorker.live, 0, 'Disposal clears grace timers and terminates the worker');
  console.log(JSON.stringify({ pass: true, check: 'partial-bank scene handoff', retainedFrames: retained,
    graceMs: 2000, duplicateHavenFrames: 0 }, null, 2));
}
if (process.argv.includes('--handoff-only')) {
  await checkHandoff();
  process.exit(0);
}
const yaw = 0, baseQuery = { yaw, phase: null, breath: 0 } as const;
const rift = createAssimilationModelClient({ profile: 'rift', yaws: [yaw] });
rift.update({ amount: 0, fibre: .5 });
assert.equal(FakeWorker.requests, 0, 'A0 neither creates a worker nor prepares a bank');
rift.update({ amount: 1, fibre: .5 });
assert.equal(rift.status.state, 'warming');
assert.equal(rift.getFrame(baseQuery), null, 'An incomplete bank never replaces live base actions');
await ready(rift);
assert.equal(rift.status.total, 41, 'One Rift yaw contains 13 full + 13 armless + 15 combat poses');
const first = rift.getFrame(baseQuery)!;
assert(first);
const expectedByte = first.albedo[0];
for (const part of ['body', 'withoutArm'] as const) {
  assert(rift.getFrame({ ...baseQuery, part }));
  for (let walk = 0; walk < 12; walk++) {
    const frame = rift.getFrame({ ...baseQuery, part, phase: walk / 12 * Math.PI * 2 })!;
    assert(frame); void frame.albedo;
  }
}
for (let attackSample = 0; attackSample < 15; attackSample++) {
  const frame = rift.getFrame({ ...baseQuery, part: 'arm', attackSample })!;
  assert(frame); void frame.depth;
}
assert.equal(rift.getFrame(baseQuery), first, 'Frame identity remains stable after dense LRU eviction');
assert.equal(first.albedo[0], expectedByte, 'Sparse reconstruction preserves channel bytes');
assert(rift.metrics.hotFrames <= 32, 'Dense channel cache stays bounded');

rift.prewarm({ profile: 'haven', yaws: [yaw] });
const haven = createAssimilationModelClient({ profile: 'haven', yaws: [yaw] });
haven.update({ amount: 1, fibre: .5 });
await ready(haven);
assert.equal(haven.status.total, 69);
for (let walk = 0; walk < 12; walk++) for (let stage = 0; stage <= 4; stage++)
  assert(haven.getFrame({ ...baseQuery, phase: walk / 12 * Math.PI * 2, settle: stage / 4 }), 'Every Haven walk/settle pose is synchronous');
assert(haven.getFrame({ ...baseQuery, pose: 'sit' }), 'Haven sitting remains a complete original pose');
for (let idle = 0; idle < 8; idle++) assert(haven.getFrame({ ...baseQuery, breath: idle / 8 * Math.PI * 2 }));
assert.equal(FakeWorker.instances, 1, 'Scenes and prewarm share one worker');

rift.update({ amount: 1, fibre: .5, structure: 0 });
assert.equal(rift.status.state, 'updating');
assert.equal(rift.getFrame(baseQuery), first, 'A source update keeps the previous complete action bank');
await ready(rift);
const second = rift.getFrame(baseQuery)!;
assert.notEqual(second.id, first.id, 'Frame IDs are unique across shape epochs');
assert.equal(second.meta.structure, 0);
rift.destroy(); haven.destroy();
const requestsBeforeReuse = FakeWorker.requests;
const reused = createAssimilationModelClient({ profile: 'rift', yaws: [yaw] });
reused.update({ amount: 1, fibre: .5, structure: 0 });
assert.equal(reused.status.state, 'ready', 'A completed bank survives scene disposal');
assert.equal(reused.getFrame(baseQuery), second);
assert.equal(FakeWorker.requests, requestsBeforeReuse, 'Scene reuse does not rebake completed geometry');

const cancelled = createAssimilationModelClient({ profile: 'rift', yaws: [1] });
cancelled.update({ amount: .75, fibre: .5 }); cancelled.destroy();
assert.equal(cancelled.status.state, 'disposed');
await tick();
assert(reused.metrics.cancelled >= 1);
assert(reused.metrics.bankCount <= 4);
assert(reused.metrics.packedBytes <= 32 * 1024 * 1024);
reused.destroy(); disposeAssimilationModelCache();
assert.equal(FakeWorker.live, 0, 'Global disposal terminates the worker');
const failed = createAssimilationModelClient({ profile: 'rift', yaws: [yaw] });
FakeWorker.failNext = true; failed.update({ amount: .5, fibre: 1 });
for (let i = 0; i < 20 && failed.status.state !== 'failed'; i++) await tick();
assert.equal(failed.status.state, 'failed');
assert.equal(failed.getFrame(baseQuery), null, 'Worker failure leaves the accurate base path available');
const metrics = failed.metrics;
failed.destroy(); disposeAssimilationModelCache();
assert.equal(FakeWorker.live, 0);
console.log(JSON.stringify({ pass: true, requests: FakeWorker.requests, metrics,
  limits: 'Finite fake-worker scheduler/cache checks; actual raster, browser transfer throughput and scene integration are separate.' }, null, 2));
