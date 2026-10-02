/** Actual RiftScene lifecycle methods with engine/DOM adapters only. No renderer.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/recovery/check-lifecycle.ts
 */
import assert from 'node:assert/strict';
import Phaser from 'phaser';
import { audioManager } from '../../src/managers/audio-manager';

Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => 'zh-CN' } });
const windowListeners = new Set<unknown>();
Object.defineProperty(globalThis, 'window', { value: {
  addEventListener: (_event: string, listener: unknown) => windowListeners.add(listener),
  removeEventListener: (_event: string, listener: unknown) => windowListeners.delete(listener),
} });
Object.defineProperty(globalThis, 'document', { value: { removeEventListener() {}, getElementById: () => null } });
Object.assign(Phaser, { Scenes: { Events: { POST_UPDATE: 'postupdate', PAUSE: 'pause', RESUME: 'resume' } } });
const { RiftScene } = await import('../../src/scenes/rift-scene');
const haltNonBgm = audioManager.haltNonBgm; audioManager.haltNonBgm = () => {};

class World {
  pauses = 0; resumes = 0;
  constructor(public isPaused = false) {}
  pause() { this.pauses++; this.isPaused = true; }
  resume() { this.resumes++; this.isPaused = false; }
}
function fixture(freezeAfterEnd = true) {
  // Access private lifecycle methods in the test; gameplay never uses this facade.
  const scene = new RiftScene() as any;
  const calls = { lost: 0, disabled: 0, clearedBuffer: 0, input: true, scenePauses: 0,
    terminalUpdates: [] as number[], disposed: [] as string[] };
  let ended = false;
  const dispose = (name: string) => () => calls.disposed.push(name);
  const world = new World();
  const keyboard = { keys: [], on() {}, off() {}, resetKeys() {}, removeKey() {} };
  Object.assign(scene, { devFixture: freezeAfterEnd ? { freezeAfterEnd: true } : null,
    physics: { world }, input: { keyboard }, events: { off() {} }, scene: { pause() { calls.scenePauses++; } },
    player: { setInputEnabled: (value: boolean) => { calls.input = value; }, destroy: dispose('player') },
    ai: { onPlayerLost() { calls.lost++; }, getEnemies: () => [], setCueListener() {}, destroy: dispose('ai') },
    combat: { setEnabled(value: boolean) { assert.equal(value, false); calls.disabled++; },
      clearAttackBuffer() { calls.clearedBuffer++; }, destroy: dispose('combat') },
    runController: { isRunEnded: () => ended, destroy: dispose('run') },
    devRuntime: { update(time: number, complete: boolean) { assert(complete); calls.terminalUpdates.push(time); }, destroy: dispose('runtime') },
    devElapsedMs: 400, toolInputAllowed: true,
  });
  for (const key of ['fieldInventory', 'hosts', 'detectionPulse', 'encounter', 'hud', 'extraction', 'toolSystem',
    'search', 'chaos', 'trail', 'minimap', 'riftSurface', 'visibility', 'tilemapRenderer']) {
    scene[key] = { destroy: dispose(key) };
  }
  scene.encounter.clear = () => {}; // DOM presentation adapter; real lifecycle still owns cleanup.
  return { scene, world, calls, setEnded(value: boolean) { ended = value; },
    enter() { Object.assign(scene.entryView, { active: true, elapsedMs: 100, durationMs: 1200, progress: 1 / 12 }); scene.beginEntryGate(); },
    end() { ended = true; scene.onRunEnded(); },
    shutdown() { scene.onShutdown(); assert(calls.disposed.includes('tilemapRenderer'), 'cleanup must reach its final system'); } };
}
let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`); }

check('entry abandon transfers one pause, cancels entry time and repeated end notifications remain inert', () => {
  const f = fixture(); f.enter();
  assert(f.world.isPaused); assert(f.scene.entryOwnsPhysicsPause); assert.equal(f.world.pauses, 1);
  f.end(); const entry = structuredClone(f.scene.entryView);
  assert.equal(entry.active, false); assert.equal(entry.elapsedMs, 100);
  assert.equal(f.scene.entryOwnsPhysicsPause, false); assert.equal(f.scene.endOwnsPhysicsPause, true);
  assert.equal(windowListeners.size, 0, 'entry release listener is removed');
  f.scene.onRunEnded(); f.scene.finishEntryGate(); f.scene.update(1400, 1300); f.scene.update(2700, 1300);
  assert.deepEqual(f.scene.entryView, entry); assert.equal(f.scene.devElapsedMs, 400);
  assert.deepEqual(f.calls.terminalUpdates, [400, 400]);
  assert.equal(f.world.resumes, 0); assert.equal(f.world.pauses, 1); assert(f.world.isPaused);
  assert.equal(f.calls.lost, 1); assert.equal(f.calls.disabled, 1);
  assert.equal(f.calls.scenePauses, 0, 'physics freeze must leave the settlement clock running');
  f.shutdown(); assert.equal(f.world.resumes, 1);
});

check('Arcade world already null at terminal shutdown still releases every system and both ownership flags', () => {
  const f = fixture(); f.end();
  assert.equal(f.scene.endOwnsPhysicsPause, true);
  f.scene.physics.world = null; // ArcadePhysics.shutdown runs before the scene SHUTDOWN callback.
  assert.doesNotThrow(() => f.shutdown());
  assert.equal(f.world.resumes, 0); assert.equal(f.scene.endOwnsPhysicsPause, false); assert.equal(f.scene.endFrozen, false);
  assert(f.calls.disposed.includes('runtime') && f.calls.disposed.includes('player') && f.calls.disposed.includes('ai'));
});

check('Arcade world already null during entry shutdown clears entry without attempting resume', () => {
  const f = fixture(); f.enter(); f.scene.physics.world = null;
  assert.doesNotThrow(() => f.shutdown());
  assert.equal(f.world.resumes, 0); assert.equal(f.scene.entryOwnsPhysicsPause, false);
  assert.equal(f.scene.entryView.active, false); assert.equal(windowListeners.size, 0);
});

check('normal active finish pauses once; a later entry on the reused scene can acquire and release a new world', () => {
  const f = fixture(); f.end(); f.scene.onRunEnded();
  assert.equal(f.world.pauses, 1); f.shutdown(); assert.equal(f.world.resumes, 1);
  const nextWorld = new World(); f.scene.physics.world = nextWorld; f.setEnded(false); f.enter();
  assert(nextWorld.isPaused); assert.equal(nextWorld.pauses, 1); assert.equal(f.scene.endFrozen, false);
  f.scene.finishEntryGate(); assert.equal(nextWorld.isPaused, false); assert.equal(nextWorld.resumes, 1);
  assert.equal(f.calls.input, true);
  f.end(); assert.equal(nextWorld.isPaused, true); assert.equal(nextWorld.pauses, 2);
  f.shutdown(); assert.equal(nextWorld.resumes, 2);
});

check('pre-existing external physics pause is never resumed by entry/end ownership cleanup', () => {
  const f = fixture(); f.world.isPaused = true; f.enter(); f.end();
  assert.equal(f.scene.entryOwnsPhysicsPause, false); assert.equal(f.scene.endOwnsPhysicsPause, false);
  f.shutdown(); assert.equal(f.world.pauses, 0); assert.equal(f.world.resumes, 0); assert(f.world.isPaused);
});

check('legacy entry without freezeAfterEnd retains its prior end behavior and normal entry resume', () => {
  const f = fixture(false); f.enter(); f.end(); f.scene.onRunEnded();
  assert.equal(f.scene.entryView.active, true); assert.equal(f.scene.endFrozen, false);
  assert.equal(f.calls.lost, 2); assert.equal(f.calls.disabled, 2);
  f.scene.finishEntryGate(); assert.equal(f.world.isPaused, false); assert.equal(f.world.resumes, 1);
  f.shutdown(); assert.equal(f.world.resumes, 1);
});

audioManager.haltNonBgm = haltNonBgm;
console.log(`check:recovery-lifecycle ${checks} passed (actual scene lifecycle, no GPU)`);
