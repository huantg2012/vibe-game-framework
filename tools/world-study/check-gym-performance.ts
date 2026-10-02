import assert from 'node:assert/strict';
import { RiftGymPerformance } from '../../src/dev/rift-gym-performance';
let now = 1000;
Object.defineProperty(globalThis, 'performance', { configurable: true, value: { now: () => now } });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { visibilityState: 'visible' } });
for (const [key, value] of Object.entries({ innerWidth: 1600, innerHeight: 1040, devicePixelRatio: 1 }))
  Object.defineProperty(globalThis, key, { configurable: true, value });
const probe = new RiftGymPerformance();
assert.equal(probe.snapshot().state, 'not-started');
probe.reset();
for (let i = 0; i < 100; i++) { now += 10; probe.before(true); probe.after(); }
assert.equal(probe.snapshot().frames, null, 'warmup does not produce timing samples');
now += 1500;
for (let i = 0; i < 50; i++) { now += 15; probe.before(true); now += 1; probe.after(); }
const initial = probe.snapshot();
assert.equal(initial.frames!.p50Ms, 16);
assert.equal(initial.cpuSubmission!.p95Ms, 1);
assert.equal(initial.heapEndBytes, null, 'unsupported browser heap is not zero');
probe.before(false); now += 30000; probe.before(false);
for (let i = 0; i < 1000; i++) { now += 15; probe.before(true); now += 1; probe.after(); }
const completed = probe.snapshot();
assert.equal(completed.state, 'complete');
assert.equal(completed.frames!.maxMs, 16, 'paused time must not become a slow frame');
assert.equal(completed.pauseSegmentsExcluded, 1);
assert(completed.sampledMs >= 12000 && completed.sampledMs < 12020);
now += 100000; probe.before(true); probe.after();
assert.deepEqual(probe.snapshot().frames, completed.frames, 'completed sampling is bounded');
probe.reset(); now += 2100; probe.before(true); probe.after();
Object.assign(document, { visibilityState: 'hidden' }); probe.before(true); now += 30000;
Object.assign(document, { visibilityState: 'visible' }); probe.before(true); probe.after(); now += 16; probe.before(true); probe.after();
assert.equal(probe.snapshot().frames!.maxMs, 16, 'hidden tab gap is excluded');
console.log(JSON.stringify({ passed: 5, cases: ['warmup', 'CPU submission distinct from intervals', 'unsupported heap', 'pause/hidden exclusion', 'bounded/reset sampling'] }));
