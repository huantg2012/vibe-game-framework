/** Real native water/camera/terrain owners, no renderer or gameplay shortcuts. */
import assert from 'node:assert/strict';
import { createSuspendedSeaWorld } from '../../src/dev/suspended-sea/world';
import { SuspendedSeaShellSystem } from '../../src/worlds/suspended-sea/shell-system';
import { StageVisibility } from '../../src/dev/spatial-study/stage/terrain';
import { StageFollowCamera } from '../../src/dev/spatial-study/stage/camera';
import { SuspendedSeaRuntime } from '../../src/dev/suspended-sea/runtime';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';
import type { MeleeTarget } from '../../src/systems/weapon-swing';

let checks = 0;
for (const id of ['sea-open-channel', 'sea-folded-ridge'] as const) {
  const native = createSuspendedSeaWorld(7, id);
  function shell() {
    const owner = new SuspendedSeaShellSystem(native.shellDefinition, native.shellTiming, (x, y) => native.base.isFloor(x, y));
    const targets: MeleeTarget[] = []; owner.collectMeleeTargets(targets);
    return { owner, target: targets[0]! };
  }
  const at = native.shellTiming.contactStartMs + 10, continuous = shell();
  continuous.owner.prepare(at, false); continuous.target.applyHit(20);
  continuous.owner.resolveContact(native.shellDefinition.position, true, () => false);
  continuous.owner.prepare(at + 250, false);
  const state = JSON.parse(JSON.stringify(continuous.owner.exportRuntimeState()));
  const resumed = shell(); resumed.owner.restoreRuntimeState(state);
  assert.deepEqual(resumed.owner.readView(), continuous.owner.readView());
  const a: unknown[] = [], b: unknown[] = [];
  for (const elapsed of [at + 599, at + 600, at + 799, at + 800, native.shellTiming.contactEndMs,
    native.shellTiming.contactEndMs + 650, native.shellTiming.periodMs + native.shellTiming.warningStartMs]) {
    continuous.owner.prepare(elapsed, false); resumed.owner.prepare(elapsed, false);
    continuous.owner.resolveContact(native.shellDefinition.position, true, (source, damage) => { a.push([elapsed, source, damage]); return true; });
    resumed.owner.resolveContact(native.shellDefinition.position, true, (source, damage) => { b.push([elapsed, source, damage]); return true; });
    assert.deepEqual(resumed.owner.exportRuntimeState(), continuous.owner.exportRuntimeState());
  }
  assert.deepEqual(a, b);
  assert.throws(() => resumed.owner.restoreRuntimeState({ ...state, signature: 'old-data' }));
  assert.deepEqual(resumed.owner.exportRuntimeState(), continuous.owner.exportRuntimeState(), 'reject before mutation');
  continuous.owner.destroy(); resumed.owner.destroy(); checks++;
  console.log(`PASS ${id}: diversion remainder, shared invulnerable contact deadline, return and next cycle match continuous water`);
}

let sees = true;
const context = { visibilityAt: () => sees ? 1 : 0 } as unknown as RiftDevRuntimeContext;
const memory = new StageVisibility(context, 24, 16, x => x < 16);
memory.update(50);
const saved = JSON.parse(JSON.stringify(memory.exportRuntimeState()));
const restoredMemory = new StageVisibility(context, 24, 16, x => x < 16);
sees = false; restoredMemory.restoreRuntimeState(saved); restoredMemory.update(50);
const rgba = restoredMemory.texture.image.data as Uint8Array;
for (let i = 0; i < rgba.length; i += 4) {
  assert.equal(rgba[i], 0, 'saved exploration never creates current sight or cuts the sea');
  assert.equal(rgba[i + 1], rgba[i + 2] ? 255 : 0, 'empty air never becomes remembered floor');
}
assert.equal(restoredMemory.validateRuntimeState({ ...saved, seenBits: btoa('\xff') }), false);
assert.deepEqual(restoredMemory.exportRuntimeState(), saved);
memory.texture.dispose(); restoredMemory.texture.dispose(); checks++;
console.log('PASS terrain: only G memory is restored; R recomputes, air remains absent; invalid bits are rejected');

const motion = { position: { x: 240, y: 944 }, velocity: { x: 100, y: -20 }, moving: true };
const camera = new StageFollowCamera(1824, 1120, motion.position);
for (let time = 0; time <= 3000; time += 16) {
  motion.position.x += 2; motion.position.y -= .4; camera.update(time, motion, false);
}
const cameraState = JSON.parse(JSON.stringify(camera.exportRuntimeState()));
const restoredCamera = new StageFollowCamera(1824, 1120, { x: 240, y: 944 });
restoredCamera.restoreRuntimeState(cameraState);
for (let time = 3008; time <= 5000; time += 16) {
  motion.position.x += 2; motion.position.y -= .4;
  camera.update(time, motion, false); restoredCamera.update(time, motion, false);
  assert.deepEqual(restoredCamera.snapshot(), camera.snapshot());
}
assert.equal(restoredCamera.validateRuntimeState({ ...cameraState, center: { x: 999999, y: 0 } }), false);
checks++; console.log('PASS fixed 35° follow camera: current easing, target and preceding position continue without a snap');

// Complete native owner rehydrates without recording a historical hit or contact event.
const makeRuntime = () => {
  const native = createSuspendedSeaWorld(42, 'sea-folded-ridge'), events: string[] = [];
  const targets: MeleeTarget[] = [];
  const ctx = { registerMeleeTargets: (owner: { collectMeleeTargets(list: MeleeTarget[]): void }) => {
    owner.collectMeleeTargets(targets); return () => {};
  }, isRunEnded: () => false, player: { getPosition: () => native.shellDefinition.position }, applyHazardHit: () => true } as unknown as RiftDevRuntimeContext;
  const owner = new SuspendedSeaRuntime(ctx, native.base, native.shellDefinition, event => events.push(event), () => ({
    update: () => {}, destroy: () => {}, snapshot: () => ({}), exportRuntimeState: () => ({ version: 1 }),
    validateRuntimeState: (value: unknown) => !!value && (value as { version: number }).version === 1,
    restoreRuntimeState: () => {},
  }));
  return { native, owner, events, target: targets[0]! };
};
const first = makeRuntime();
const elapsed = first.native.shellTiming.contactStartMs + 100;
first.owner.beforeCombat(elapsed, false); first.target.applyHit(15); first.owner.update(elapsed, false); first.owner.afterUpdate(elapsed);
const worldState = JSON.parse(JSON.stringify(first.owner.exportRuntimeState()));
const second = makeRuntime(); second.owner.restoreRuntimeState(worldState); second.owner.afterUpdate(elapsed);
assert.deepEqual(second.events, [], 'hydrate does not replay old hit, water, or contact observations');
assert.deepEqual(second.owner.exportRuntimeState(), worldState);
first.owner.destroy(); second.owner.destroy(); checks++;
console.log('PASS native owner: shell and elapsed restore silently without repeating material or contact events');
console.log(`${checks} world recovery checks passed.`);
