import assert from 'node:assert/strict';
import { RiftEntryFrameFence } from '../../src/systems/rift-entry-frame-fence';

function harness(alreadyPaused = false) {
  let frame = 12, allowed = true, paused = alreadyPaused, releases = 0, resumes = 0;
  const listeners = new Set<() => void>();
  const fence = new RiftEntryFrameFence({ frame: () => frame, canPresent: () => allowed,
    pausePhysics: () => { const owned = !paused; paused = true; return owned; },
    resumePhysics: () => { paused = false; resumes++; },
    subscribeRendered: fn => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    released: () => { releases++; },
  });
  return { fence, listeners, tick: () => frame++, allow: (value: boolean) => { allowed = value; },
    render: () => { for (const fn of [...listeners]) fn(); }, state: () => ({ paused, releases, resumes }) };
}

const h = harness();
assert.deepEqual(h.state(), { paused: true, releases: 0, resumes: 0 });
assert.equal(h.fence.needsPresentation(), false);
assert.throws(() => h.fence.markPresented());
h.render(); assert(h.fence.isActive(), 'construction render cannot release simulation');
h.tick(); assert(h.fence.needsPresentation());
h.render(); assert(h.fence.isActive(), 'render without completed picture/checkpoint cannot release');
// A storage failure or a paused/hidden scene cannot pass the render boundary.
h.allow(false); assert.equal(h.fence.needsPresentation(), false); h.render(); assert(h.fence.isActive());
h.allow(true); h.fence.markPresented();
assert.equal(h.fence.needsPresentation(), false);
h.allow(false); h.render(); assert(h.fence.isActive());
h.tick(); h.allow(true); h.render();
assert.deepEqual(h.state(), { paused: false, releases: 1, resumes: 1 });
assert.equal(h.listeners.size, 0);
h.render(); h.fence.destroy(); assert.equal(h.state().resumes, 1);

for (const prepared of [false, true]) {
  const cancelled = harness();
  if (prepared) { cancelled.tick(); cancelled.fence.markPresented(); }
  const stale = [...cancelled.listeners][0]!;
  cancelled.fence.destroy(); cancelled.fence.destroy(); stale();
  assert.deepEqual(cancelled.state(), { paused: false, releases: 0, resumes: 1 });
  assert.equal(cancelled.listeners.size, 0);
}
const borrowed = harness(true);
borrowed.tick(); borrowed.fence.markPresented(); borrowed.render();
assert.deepEqual(borrowed.state(), { paused: true, releases: 1, resumes: 0 });
console.log('Rift entry frame fence: actual-frame, checkpoint, pause/hidden, cancel, stale listener and physics ownership checks passed');
