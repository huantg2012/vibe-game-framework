/** Real session/save/scene transactions with a controlled Worker delivery.
 * Rendering is adapted; browser timing and visual approval are separate gates. */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { executeRiftGeneration } from '../../src/generation/rift-generation-execute';
import type { RiftGenerationRequest, RiftGenerationResponse } from '../../src/generation/rift-generation-protocol';
import type { RiftGenerationWorkerPort } from '../../src/generation/rift-generation-client';
import type { SaveDataV2 } from '../../src/types/game-types';
import { checkpointChecksum } from '../../src/types/rift-checkpoint';

Object.assign(Phaser, { Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const windowTarget = new EventTarget();
Object.defineProperty(globalThis, 'window', { configurable: true, value: windowTarget });
Object.defineProperty(globalThis, 'document', { configurable: true, value: { hidden: false, hasFocus: () => true } });
class ControlledWorker implements RiftGenerationWorkerPort {
  static all: ControlledWorker[] = [];
  onmessage: ((event: MessageEvent<RiftGenerationResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;
  request!: RiftGenerationRequest;
  terminated = false;
  constructor() { ControlledWorker.all.push(this); }
  postMessage(request: RiftGenerationRequest): void { this.request = structuredClone(request); }
  terminate(): void { this.terminated = true; }
  complete(): void {
    let response: RiftGenerationResponse;
    try { response = { id: this.request.id, result: executeRiftGeneration(this.request.input) }; }
    catch (error) { response = { id: this.request.id, error: error instanceof Error ? error.message : String(error) }; }
    this.onmessage?.({ data: response } as MessageEvent<RiftGenerationResponse>);
  }
  fail(): void { this.onerror?.({ message: 'Injected generation failure' } as ErrorEvent); }
}
Object.defineProperty(globalThis, 'Worker', { configurable: true, value: ControlledWorker });
const { saveManager } = await import('../../src/managers/save-manager');
const { inventoryStore } = await import('../../src/systems/inventory-store');
const { gameState } = await import('../../src/managers/game-state');
const { loadExpedition, beginNewExpedition } = await import('../../src/managers/session');
const { PurificationScene } = await import('../../src/scenes/purification-scene');
const { pauseMenu } = await import('../../src/ui/dom/pause-menu');
const { inventoryPanel } = await import('../../src/ui/dom/inventory-panel');
const { withPreparedProceduralRecovery, restoreProceduralLayout } = await import('../../src/managers/rift-recovery');
const records = new Map<string, string>();
let failWrites = false;
saveManager.setStorage({ getItem: key => records.get(key) ?? null, removeItem: key => { records.delete(key); },
  setItem: (key, value) => { if (failWrites) throw new Error('Injected storage failure'); records.set(key, value); } });
const key = GAME_CONSTANTS.SAVE.KEY;
const base = (JSON.parse(readFileSync('tools/recovery/fixtures/prepared-base.json', 'utf8')) as { record: SaveDataV2 }).record;
const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/formal-active.json', 'utf8'));
const active = structuredClone(base);
active.inventory = fixture.inventory; active.riftCheckpoint = fixture.checkpoint;
active.cycle = fixture.checkpoint.state.conditions.cycle;
active.checkpointChecksum = checkpointChecksum(active);
const original = JSON.stringify(active);
const host = { events: new EventEmitter(), scene: { start: (...args: unknown[]) => { routes.push(args); } } } as unknown as Phaser.Scene;
const routes: unknown[][] = [], errors: string[] = [];
const options = { onError: (message: string) => { errors.push(message); } };
const facts = () => structuredClone({ inventory: inventoryStore.getState(), game: gameState.getState() });
const lastWorker = (): ControlledWorker => ControlledWorker.all.at(-1)!;
let count = 0;
async function check(name: string, run: () => void | Promise<void>): Promise<void> {
  await run(); count++; console.log(`PASS ${name}`);
}

records.set(key, JSON.stringify(base)); assert(saveManager.load());
const before = facts();
records.set(key, original);
await check('cancel/repeated confirmation leave the entire live state and exact saved bytes unchanged', async () => {
  const controller = new AbortController();
  const pending = loadExpedition(host, undefined, undefined, { ...options, signal: controller.signal });
  assert.equal(ControlledWorker.all.length, 1);
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'busy');
  assert.equal(beginNewExpedition(host, undefined, true), false);
  controller.abort();
  assert.equal(await pending, 'cancelled'); assert(lastWorker().terminated);
  assert.deepEqual(facts(), before); assert.equal(records.get(key), original); assert.equal(routes.length, 0);
});

for (const event of ['shutdown', 'destroy', 'blur']) await check(`${event} aborts cold load without a scene handoff`, async () => {
  const pending = loadExpedition(host, undefined, undefined, options), worker = lastWorker();
  if (event === 'blur') windowTarget.dispatchEvent(new Event('blur')); else host.events.emit(event);
  assert.equal(await pending, 'cancelled'); assert(worker.terminated);
  assert.deepEqual(facts(), before); assert.equal(records.get(key), original); assert.equal(routes.length, 0);
});

await check('worker failure preserves the live base and record and unlocks retry', async () => {
  const pending = loadExpedition(host, undefined, undefined, options);
  lastWorker().fail(); assert.equal(await pending, 'failed');
  assert.deepEqual(facts(), before); assert.equal(records.get(key), original);
});

await check('bad outing identity retains an explicit base-rescue choice; it never abandons automatically', async () => {
  const invalid = structuredClone(active);
  invalid.riftCheckpoint!.identity.signature = 'bad-saved-identity';
  delete invalid.checkpointChecksum; invalid.checkpointChecksum = checkpointChecksum(invalid);
  const bytes = JSON.stringify(invalid); records.set(key, bytes);
  let offered = 0;
  const pending = loadExpedition(host, undefined, () => { offered++; }, options);
  lastWorker().complete();
  assert.equal(await pending, 'interrupted'); assert.equal(offered, 1);
  assert.deepEqual(facts(), before); assert.equal(records.get(key), bytes); assert.equal(routes.length, 0);
  records.set(key, original);
});

await check('a changed record is never offered the old outing rescue after Worker failure', async () => {
  let offered = 0;
  const pending = loadExpedition(host, undefined, () => { offered++; }, options);
  records.set(key, JSON.stringify(base)); lastWorker().fail();
  assert.equal(await pending, 'failed'); assert.equal(offered, 0); assert.deepEqual(facts(), before);
  records.set(key, original);
});

await check('changed bytes during preparation are rejected before admission mutates state', async () => {
  const pending = loadExpedition(host, undefined, undefined, options);
  const newer = JSON.stringify(base);
  records.set(key, newer); lastWorker().complete();
  assert.equal(await pending, 'failed'); assert.deepEqual(facts(), before);
  assert.equal(records.get(key), newer); assert.equal(routes.length, 0);
  records.set(key, original);
});

await check('prepared-only scope never generates an unprepared foreign identity', () => {
  withPreparedProceduralRecovery(active.riftCheckpoint!.identity, () => {
    assert.throws(() => restoreProceduralLayout({ ...active.riftCheckpoint!.identity, seed: 987 }), /cannot synchronously generate/);
  });
});

await check('admitted original checkpoint routes the saved world without rewriting it', async () => {
  const workers = ControlledWorker.all.length;
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'entered');
  assert.equal(ControlledWorker.all.length, workers, 'already prepared exact identity is reused');
  assert.equal(routes.at(-1)?.[0], 'RiftScene');
  assert.deepEqual((routes.at(-1)?.[1] as { recovery: { checkpoint: unknown } }).recovery.checkpoint, fixture.checkpoint);
  assert.equal(records.get(key), original);
});

await check('SaveManager expected snapshot rejects replacement even at the final synchronous boundary', () => {
  const snapshot = saveManager.captureLoadSnapshot()!;
  records.set(key, JSON.stringify(base));
  const loadedFacts = facts();
  assert.equal(saveManager.load(undefined, snapshot), false);
  assert.deepEqual(facts(), loadedFacts);
});

// The actual departure method is exercised through its persistence boundary;
// waiting DOM and final transition rendering belong to the browser smoke test.
assert(saveManager.load());
const departureBefore = facts(), departureBytes = records.get(key);
inventoryPanel.close = () => {};
let cancelPreparation: (() => void) | undefined;
pauseMenu.open = (_scene, options) => { cancelPreparation = options?.preparation?.cancel; };
pauseMenu.finishPreparation = () => { cancelPreparation = undefined; };
const scene = new PurificationScene();
let finished = 0, retry: (() => void) | undefined;
Object.assign(scene, { events: new EventEmitter(), requestSaveRetry: (afterSaved: () => void) => {
  retry = () => { assert(saveManager.trySave()); afterSaved(); };
}, finishRiftDeparture: () => { finished++; } });
const gate = scene as unknown as { transitionToRift(): void; prepareRiftDeparture(): Promise<void>; departureAbort: AbortController | null };

await check('actual departure cancels before beginRun; duplicate confirm launches only one worker', async () => {
  const pending = gate.prepareRiftDeparture(), workers = ControlledWorker.all.length;
  gate.transitionToRift(); assert.equal(ControlledWorker.all.length, workers);
  assert(cancelPreparation); cancelPreparation(); await pending;
  assert.deepEqual(facts(), departureBefore); assert.equal(records.get(key), departureBytes);
  assert.equal(finished, 0); assert.equal(gate.departureAbort, null);
});

await check('actual departure retains one frozen transaction and identity across a failed save and retry', async () => {
  const pending = gate.prepareRiftDeparture(), worker = lastWorker();
  assert.equal(worker.request.input.kind, 'departure');
  assert.deepEqual(facts(), departureBefore, 'waiting consumes no gear or cycle');
  failWrites = true; worker.complete(); await pending;
  assert(saveManager.hasPendingSave()); assert(retry); assert.equal(finished, 0);
  assert.equal(records.get(key), departureBytes, 'failed setItem retains the old record');
  const runId = inventoryStore.getRun()!.id, cycle = gameState.getCycle(), workers = ControlledWorker.all.length;
  gate.transitionToRift(); assert.equal(ControlledWorker.all.length, workers);
  assert.equal(inventoryStore.getRun()!.id, runId);
  failWrites = false; retry();
  assert.equal(finished, 1); assert.equal(inventoryStore.getRun()!.id, runId); assert.equal(gameState.getCycle(), cycle);
  assert.equal(saveManager.peekRiftDeparture()?.runId, runId);
});

assert.equal(host.events.listenerCount('shutdown'), 0); assert.equal(host.events.listenerCount('destroy'), 0);
assert(ControlledWorker.all.every(worker => worker.terminated));
inventoryStore.setPersistence(null);
console.log(`Async entry: ${count} checks passed; actual persistence/session paths, adapted rendering and controlled delivery.`);
