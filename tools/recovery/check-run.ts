/** Real RunController / inventory / frame commits. The clock is the only scene stub.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/recovery/check-run.ts
 */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { commitEffects } from '../../src/core/commit-effects';
import { eventBus } from '../../src/core/event-bus';
import { BuildLabMemoryStorage, prepareBuildLabRun } from '../../src/dev/build-lab-session';
import { saveManager } from '../../src/managers/save-manager';
import { inventoryStore } from '../../src/systems/inventory-store';
import { RiftFrameCommit } from '../../src/systems/rift-frame-commit';
import { RunController, validateRunRuntimeState, type RunControllerDeps, type RunRuntimeStateV1 } from '../../src/systems/run-controller';
import { GameEvent } from '../../src/types/events';
import type { SaveDataV2 } from '../../src/types/game-types';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';

const key = GAME_CONSTANTS.SAVE.KEY, delay = GAME_CONSTANTS.EXTRACTION.SETTLE_DELAY_MS;
const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
let checks = 0;
function check(name: string, run: () => void): void { run(); checks++; console.log(`PASS ${name}`); }

class Clock {
  now: number;
  scheduled = 0;
  private readonly timers: { at: number; callback: () => void }[] = [];
  constructor(now = 0) { this.now = now; }
  delayedCall(ms: number, callback: () => void): void {
    this.scheduled++; this.timers.push({ at: this.now + ms, callback });
  }
  advance(ms: number): void {
    this.now += ms;
    for (let index = 0; index < this.timers.length;) {
      if (this.timers[index]!.at > this.now) { index++; continue; }
      const [timer] = this.timers.splice(index, 1); timer!.callback();
    }
  }
}

class Storage extends BuildLabMemoryStorage {
  fail = false;
  readonly attempts: string[] = [];
  override setItem(storedKey: string, bytes: string): void {
    if (storedKey === key) this.attempts.push(bytes);
    if (this.fail) throw new Error('Injected quota failure');
    super.setItem(storedKey, bytes);
  }
}

type RunCheckpoint = RiftCheckpoint<{ run: RunRuntimeStateV1 }>;
saveManager.setRiftStateValidator((checkpoint, inventory) => {
  const state = (checkpoint as RunCheckpoint).state?.run, ledger = inventory.run;
  return validateRunRuntimeState(state) && checkpoint.elapsedMs === state.elapsedMs
    && !!ledger && state.runEnded === (ledger.status === 'settled')
    && (!state.runEnded || (state.settlementSaved && ledger.kindlingGained === state.lastKindling
      && ledger.outcome === (state.lastEndReason === 'player_died' ? 'death' : state.lastEndReason)));
});

function fixture() {
  const storage = new Storage(); saveManager.setStorage(storage);
  const runId = prepareBuildLabRun('bare');
  const calls = { paused: 0, disabled: 0, kindling: 0, returned: 0, retried: 0, captured: 0, notified: 0 };
  const presentation: string[] = [];
  let clock = new Clock(1000), playMs = 1400, retry: (() => void) | null = null, loading = false;
  let controller = new RunController(), frame: RiftFrameCommit;
  const read = () => JSON.parse(storage.getItem(key)!) as SaveDataV2 & { riftCheckpoint: RunCheckpoint };
  const deps: RunControllerDeps = {
    pauseChaos: paused => { assert(paused); calls.paused++; },
    setPlayerInput: enabled => { assert(!enabled); calls.disabled++; },
    getCarriedKindling: () => { calls.kindling++; return 9; },
    getElapsedMs: () => playMs,
    onRuntimeStateChanged: () => frame.markChanged(),
    onReturn: () => {
      assert.equal(read().inventory.run?.status, 'settled');
      assert.equal(read().riftCheckpoint.state.run.restarted, true);
      calls.returned++; presentation.push('return');
    },
  };
  function createFrame(restored?: RiftCheckpoint) {
    return new RiftFrameCommit({
      capture: sequence => {
        calls.captured++;
        return { version: 1, runId, sequence,
          identity: { worldId: 'suspended-sea', layoutId: 'sea-open-channel', seed: 7, signature: 'run-lifecycle-check' },
          elapsedMs: controller.getElapsedMs(), state: { run: controller.exportRuntimeState() } };
      },
      onFailure: action => { retry = action; },
      onRetried: () => { calls.retried++; },
    }, restored);
  }
  controller.create({ time: clock } as never, deps); frame = createFrame();
  const listener = ({ kindlingGained, survived }: { kindlingGained: number; survived: boolean }) => {
    const state = read().riftCheckpoint.state.run;
    assert(state.settlementSaved && state.settlementEmitted, 'publish only a durable result reservation');
    assert.equal(kindlingGained, state.lastKindling); assert.equal(survived, state.lastEndReason === 'extract');
    presentation.push('result');
  };
  eventBus.on(GameEvent.RIFT_EXITED, listener);
  // SaveManager.load also notifies its newly loaded projection; count domain commits separately.
  const unsubscribe = inventoryStore.subscribe(() => { if (!loading) calls.notified++; });
  return {
    storage, calls, presentation, read,
    get controller() { return controller; }, get clock() { return clock; }, get frame() { return frame; },
    retry: () => { assert(retry); retry(); },
    finish: () => frame.finish(playMs),
    reload: () => {
      frame.destroy(); controller.destroy(); loading = true;
      try { assert(saveManager.load()); } finally { loading = false; }
      const checkpoint = read().riftCheckpoint, before = { ...calls };
      clock = new Clock(999999); playMs = checkpoint.elapsedMs;
      controller = new RunController(); controller.create({ time: clock } as never, deps);
      frame = createFrame(checkpoint); controller.restoreRuntimeState(roundTrip(checkpoint.state.run));
      assert.deepEqual(calls, before, 'restore must not pause, settle, notify, draw kindling, or publish');
      return checkpoint.state.run;
    },
    dispose: () => { controller.destroy(); frame.destroy(); unsubscribe(); eventBus.off(GameEvent.RIFT_EXITED, listener); },
  };
}

check('active scene and external clocks resume the saved elapsed basis without offline time or restore events', () => {
  const deps = { pauseChaos() { assert.fail('restore paused chaos'); }, setPlayerInput() { assert.fail('restore changed input'); }, getCarriedKindling: () => 0 };
  for (const external of [false, true]) {
    const firstClock = new Clock(1000), first = new RunController(); let originalPlay = 0;
    first.create({ time: firstClock } as never, { ...deps, ...(external ? { getElapsedMs: () => originalPlay } : {}) });
    firstClock.advance(375); originalPlay = 375;
    const state = roundTrip(first.exportRuntimeState()); assert(validateRunRuntimeState(state));
    const newClock = new Clock(987654321), restored = new RunController(); let restoredPlay = 42000;
    restored.create({ time: newClock } as never, { ...deps, ...(external ? { getElapsedMs: () => restoredPlay } : {}) });
    restored.restoreRuntimeState(state); assert.deepEqual(restored.exportRuntimeState(), state);
    assert.equal(newClock.scheduled, 0); restored.finishRuntimeRestore(); restored.finishRuntimeRestore();
    firstClock.advance(57); newClock.advance(57); originalPlay += 57; restoredPlay += 57;
    assert.deepEqual(restored.exportRuntimeState(), first.exportRuntimeState());
    const before = restored.exportRuntimeState();
    for (const patch of [{ version: 2 }, { elapsedMs: Infinity }, { elapsedMs: -1 }, { lastKindling: .5 },
      { settlementEmitted: true }, { restarted: true }, { lastEndReason: 'abandon' }, { settlementDelayRemainingMs: 0 }]) {
      const bad = { ...before, ...patch }; assert(!validateRunRuntimeState(bad));
      assert.throws(() => restored.restoreRuntimeState(bad)); assert.deepEqual(restored.exportRuntimeState(), before);
    }
    assert.throws(() => restored.restoreRuntimeState({ ...before, clockSource: external ? 'scene' : 'external' }));
    assert.deepEqual(restored.exportRuntimeState(), before);
    first.destroy(); restored.destroy();
  }
});

check('quota failure gates timer scheduling, result publication, and return; each retry commits identical bytes', () => {
  const f = fixture();
  try {
    const initial = f.storage.getItem(key); f.frame.begin(); f.storage.fail = true;
    eventBus.emit(GameEvent.RIFT_EXIT_REACHED, {}); eventBus.emit(GameEvent.PLAYER_DIED, { cause: 'late' }); f.controller.abandon();
    assert(f.controller.isRunEnded()); assert.equal(inventoryStore.getRun()?.outcome, 'extract');
    assert.equal(f.calls.paused, 1); assert.equal(f.calls.disabled, 1); assert.equal(f.calls.kindling, 1);
    assert.equal(f.clock.scheduled, 0); assert.equal(f.calls.notified, 0);
    assert.equal(f.finish(), false); assert.equal(f.storage.getItem(key), initial);
    const terminalBytes = f.storage.attempts.at(-1);
    f.clock.advance(5000); f.retry(); assert.equal(f.storage.attempts.at(-1), terminalBytes);
    assert.equal(f.clock.scheduled, 0); assert.deepEqual(f.presentation, []);
    f.storage.fail = false; f.retry(); assert.equal(f.storage.attempts.at(-1), terminalBytes);
    assert.equal(f.calls.captured, 1); assert.equal(f.calls.notified, 1); assert.equal(f.clock.scheduled, 1);
    assert.equal(f.read().riftCheckpoint.state.run.settlementEmitted, false);

    f.frame.begin(); f.clock.advance(delay - 1); assert.deepEqual(f.presentation, []);
    f.clock.advance(1); assert.equal(f.controller.exportRuntimeState().settlementEmitted, true);
    assert.deepEqual(f.presentation, []); f.storage.fail = true;
    assert.equal(f.finish(), false, 'frozen play time still needs a durable event reservation');
    const eventBytes = f.storage.attempts.at(-1); assert.equal(f.calls.captured, 2);
    assert.equal(f.read().riftCheckpoint.state.run.settlementEmitted, false);
    f.storage.fail = false; f.retry(); assert.equal(f.storage.attempts.at(-1), eventBytes);
    assert.deepEqual(f.presentation, ['result']);

    f.frame.begin(); f.controller.restart(); f.controller.restart(); f.storage.fail = true;
    assert.equal(f.finish(), false); const returnBytes = f.storage.attempts.at(-1);
    assert.equal(f.calls.returned, 0); assert.equal(f.read().riftCheckpoint.state.run.restarted, false);
    f.storage.fail = false; f.retry(); assert.equal(f.storage.attempts.at(-1), returnBytes);
    assert.deepEqual(f.presentation, ['result', 'return']); assert.equal(f.calls.returned, 1);
    f.controller.restart(); f.clock.advance(5000); assert.equal(f.calls.returned, 1); assert.equal(f.calls.notified, 1);
  } finally { f.dispose(); }
});

check('return during the terminal frame settles death once and survives reload without a duplicate RIFT_EXITED', () => {
  const f = fixture();
  try {
    f.frame.begin(); eventBus.emit(GameEvent.PLAYER_DIED, { cause: 'enemy_attack' });
    f.controller.restart(); f.controller.restart(); assert.deepEqual(f.presentation, []);
    assert(f.finish()); assert.deepEqual(f.presentation, ['result', 'return']);
    assert.equal(f.clock.scheduled, 0); assert.equal(inventoryStore.getRun()?.outcome, 'death');
    assert.equal(inventoryStore.getItems().length, 0); assert.equal(f.calls.notified, 1);
    const saved = f.reload(); assert(saved.restarted && saved.settlementEmitted && saved.lastEndReason === 'player_died');
    f.controller.restart(); assert.equal(f.calls.returned, 1, 'hydration cannot execute a queued return');
    f.controller.finishRuntimeRestore(); f.controller.finishRuntimeRestore(); f.controller.restart();
    assert.deepEqual(f.presentation, ['result', 'return', 'return']);
    assert.equal(f.calls.notified, 1, 'resume navigation cannot repeat the settlement');
    assert.equal(inventoryStore.getItems().length, 0);
  } finally { f.dispose(); }
});

check('terminal delay resumes its remaining time and an already published result restores without replay', () => {
  const f = fixture();
  try {
    f.frame.begin(); eventBus.emit(GameEvent.RIFT_EXIT_REACHED, {}); assert(f.finish());
    const oldClock = f.clock;
    f.frame.begin(); f.clock.advance(230); f.frame.markChanged(); assert(f.finish());
    assert.equal(f.read().riftCheckpoint.state.run.settlementDelayRemainingMs, delay - 230);
    const saved = f.reload(); assert.equal(f.clock.scheduled, 0);
    f.controller.finishRuntimeRestore(); f.controller.finishRuntimeRestore(); assert.equal(f.clock.scheduled, 1);
    oldClock.advance(5000); assert.deepEqual(f.presentation, [], 'the destroyed scene timer is inert');
    f.frame.begin(); f.clock.advance(saved.settlementDelayRemainingMs! - 1); assert.deepEqual(f.presentation, []);
    f.clock.advance(1); assert.deepEqual(f.presentation, []); assert(f.finish());
    assert.deepEqual(f.presentation, ['result']);
    const published = f.reload(); assert(published.settlementEmitted && !published.restarted);
    f.controller.finishRuntimeRestore(); f.clock.advance(5000);
    assert.equal(f.clock.scheduled, 0); assert.deepEqual(f.presentation, ['result']);
    assert.equal(f.calls.notified, 1);
  } finally { f.dispose(); }
});

check('explicit abandon loses carried equipment, persists its distinct reason, and cannot become extraction', () => {
  const f = fixture();
  try {
    const carried = inventoryStore.getItems().map(item => item.id); assert(carried.length > 0);
    f.frame.begin(); f.controller.abandon(); f.controller.abandon(); eventBus.emit(GameEvent.RIFT_EXIT_REACHED, {});
    assert.equal(f.controller.exportRuntimeState().lastEndReason, 'abandon'); assert.equal(f.calls.kindling, 0);
    assert(f.finish()); const saved = f.reload();
    assert.equal(saved.lastKindling, 0); assert.equal(inventoryStore.getRun()?.outcome, 'abandon');
    for (const id of carried) assert.equal(inventoryStore.getItem(id), undefined);
    f.controller.finishRuntimeRestore(); f.frame.begin(); f.controller.restart(); assert(f.finish());
    assert.deepEqual(f.presentation, ['result', 'return']); assert.equal(f.calls.notified, 1);
    const before = f.controller.exportRuntimeState();
    for (const patch of [{ lastKindling: 9 }, { settlementSaved: false }, { lastEndReason: 'quit' }, { settlementDelayRemainingMs: delay }]) {
      assert(!validateRunRuntimeState({ ...before, ...patch }));
      assert.throws(() => f.controller.restoreRuntimeState({ ...before, ...patch }));
      assert.deepEqual(f.controller.exportRuntimeState(), before);
    }
  } finally { f.dispose(); }
});

assert.equal(commitEffects.isOpen(), false); assert.equal(inventoryStore.hasFrameTransaction(), false);
inventoryStore.setPersistence(null); saveManager.setRiftStateValidator(null);
console.log(`${checks} run recovery checks passed.`);
