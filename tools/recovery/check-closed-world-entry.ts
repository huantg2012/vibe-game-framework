/** Actual session/save/inventory owners against isolated storage. World workers
 * are held only to observe the unchanged recovery route; no old world is built.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx --import ./tools/recovery/register-css.mjs tools/recovery/check-closed-world-entry.ts
 */
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import Phaser from 'phaser';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { R100_NATIVE_WORLDS } from '../../src/generated/r100-native-worlds';
import { createR100ProductionRecipe } from '../../src/generation/world-study/r100-package';
import { checkpointChecksum, type RiftCheckpoint } from '../../src/types/rift-checkpoint';
import type { SaveDataV2 } from '../../src/types/game-types';

Object.assign(Phaser, { Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } } });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
Object.defineProperty(globalThis, 'window', { configurable: true, value: new EventTarget() });
class HeldWorker {
  static all: HeldWorker[] = [];
  onmessage = null; onerror = null; onmessageerror = null;
  terminated = false;
  constructor() { HeldWorker.all.push(this); }
  postMessage(): void {}
  terminate(): void { this.terminated = true; }
}
Object.defineProperty(globalThis, 'Worker', { configurable: true, value: HeldWorker });
const { saveManager } = await import('../../src/managers/save-manager');
const { inventoryStore } = await import('../../src/systems/inventory-store');
const { gameState } = await import('../../src/managers/game-state');
const { growthSystem } = await import('../../src/systems/growth-system');
const { tideSystem } = await import('../../src/systems/tide-system');
const { loadExpedition } = await import('../../src/managers/session');
const key = GAME_CONSTANTS.SAVE.KEY, records = new Map<string, string>();
let failWrites = false, writes = 0;
saveManager.setStorage({ getItem: name => records.get(name) ?? null, removeItem: name => { records.delete(name); },
  setItem: (name, bytes) => { if (failWrites) throw new Error('Controlled storage failure'); writes++; records.set(name, bytes); } });
const base = (JSON.parse(readFileSync('tools/recovery/fixtures/prepared-base.json', 'utf8')) as { record: SaveDataV2 }).record;
records.set(key, JSON.stringify(base)); assert(saveManager.load());
assert(inventoryStore.beginRun('closed-world-check').ok); gameState.incrementCycle(); assert(saveManager.trySave());
const active = JSON.parse(records.get(key)!) as SaveDataV2;
const routes: unknown[][] = [], errors: string[] = [];
const host = { events: new EventEmitter(), scene: { start: (...args: unknown[]) => { routes.push(args); } } } as unknown as Phaser.Scene;
const options = { onError: (message: string) => { errors.push(message); } };
const facts = () => structuredClone({ inventory: inventoryStore.getState(), game: gameState.getState(),
  growth: growthSystem.getState(), tide: tideSystem.getState() });
const enabled = R100_NATIVE_WORLDS.filter(world => world.enabled);
const disabled = R100_NATIVE_WORLDS.filter(world => !world.enabled);
assert.equal(enabled.length, 3); assert.equal(disabled.length, 105);
const identityFor = (worldId: string, grade: 'low' | 'medium' | 'severe' = 'medium'): RiftCheckpoint['identity'] => ({
  worldId: 'procedural-rift', layoutId: 'procedural-rift', seed: 92, signature: 'controlled-routing-only',
  generation: createR100ProductionRecipe(worldId, 92, grade),
});
function encode(record: SaveDataV2): string {
  delete record.checkpointChecksum;
  if (record.riftCheckpoint || record.riftDeparture) record.checkpointChecksum = checkpointChecksum(record);
  return JSON.stringify(record);
}
function fixture(identity: RiftCheckpoint['identity'] | null, departure = false): SaveDataV2 {
  const record = structuredClone(active);
  if (identity) {
    if (departure) record.riftDeparture = { version: 1, runId: record.inventory.run!.id, identity,
      conditions: { modifiers: gameState.getSortieModifiers(), cycle: record.cycle } };
    else record.riftCheckpoint = { version: 1, runId: record.inventory.run!.id, sequence: 1,
      identity, elapsedMs: 100, state: {} };
  }
  return record;
}
let checks = 0;
async function check(name: string, run: () => void | Promise<void>): Promise<void> {
  await run(); checks++; console.log(`PASS ${name}`);
}

for (const departure of [false, true]) await check(`closed native ${departure ? 'departure' : 'checkpoint'} abandons before any worker`, async () => {
  const record = fixture(identityFor(disabled[0]!.id), departure), bytes = encode(record);
  records.set(key, bytes); const workers = HeldWorker.all.length, entries = routes.length;
  assert.equal(saveManager.captureLoadSnapshot()?.runStatus, 'active');
  let rescuePrompts = 0;
  assert.equal(await loadExpedition(host, undefined, () => { rescuePrompts++; }, options), 'entered');
  assert.equal(rescuePrompts, 0); assert.equal(HeldWorker.all.length, workers);
  assert.equal(routes.length, entries + 1); assert.equal(routes.at(-1)?.[0], 'PurificationScene');
  const saved = JSON.parse(records.get(key)!) as SaveDataV2;
  assert.equal(saved.inventory.run?.outcome, 'abandon'); assert.equal(saved.inventory.run?.status, 'settled');
  assert.equal(saved.inventory.run?.kindlingGained, 0); assert.equal(saved.inventory.run?.baseSettled, undefined);
  assert.deepEqual(saved.inventory.items.map(item => item.id).sort(), record.inventory.items.filter(item => item.location.kind !== 'carried').map(item => item.id).sort());
  assert.deepEqual(saved.growth, record.growth); assert.deepEqual(saved.modules, record.modules);
  assert.equal(saved.kindlingReserve, record.kindlingReserve); assert.equal(saved.cycle, record.cycle);
  assert.deepEqual(saved.inventory.riftWorldHistory, record.inventory.riftWorldHistory);
  assert.equal(saved.riftCheckpoint, undefined); assert.equal(saved.riftDeparture, undefined);
});

for (const [name, identity] of [
  ['legacy procedural', { worldId: 'procedural-rift', layoutId: 'procedural-rift', seed: 1, signature: 'legacy' }],
  ['legacy sea', { worldId: 'suspended-sea', layoutId: 'sea-open-channel', seed: 1, signature: 'sea' }],
  ['missing outing identity', null],
] as const) await check(`${name} valid active ledger also closes without generating a world`, async () => {
  records.set(key, encode(fixture(identity))); const workers = HeldWorker.all.length;
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'entered');
  assert.equal(inventoryStore.getRun()?.outcome, 'abandon'); assert.equal(HeldWorker.all.length, workers);
});

await check('refused abandon write keeps original bytes and retries once without losing base ownership', async () => {
  const bytes = encode(fixture(identityFor(disabled[1]!.id))); records.set(key, bytes);
  const entries = routes.length; failWrites = true;
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'failed');
  assert.equal(records.get(key), bytes); assert.equal(inventoryStore.getRun()?.status, 'active');
  assert.equal(routes.length, entries); failWrites = false;
  const beforeWrites = writes;
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'entered');
  assert.equal(writes, beforeWrites + 1); assert.equal(inventoryStore.getRun()?.outcome, 'abandon');
  const saved = records.get(key), settled = facts();
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'entered');
  assert.equal(records.get(key), saved); assert.deepEqual(facts(), settled); assert.equal(writes, beforeWrites + 1);
});

await check('already aborted request does not abandon or write', async () => {
  const bytes = encode(fixture(identityFor(disabled[0]!.id))); records.set(key, bytes);
  const controller = new AbortController(); controller.abort(); const beforeWrites = writes;
  assert.equal(await loadExpedition(host, undefined, undefined, { ...options, signal: controller.signal }), 'cancelled');
  assert.equal(records.get(key), bytes); assert.equal(writes, beforeWrites);
});

for (const world of enabled) for (const grade of ['low', 'medium', 'severe'] as const) {
  await check(`${world.id}/${grade} stays on ordinary cancellable world recovery`, async () => {
    const bytes = encode(fixture(identityFor(world.id, grade))); records.set(key, bytes);
    const before = facts(), beforeWrites = writes, workers = HeldWorker.all.length;
    const controller = new AbortController();
    const pending = loadExpedition(host, undefined, undefined, { ...options, signal: controller.signal });
    assert.equal(HeldWorker.all.length, workers + 1); controller.abort();
    assert.equal(await pending, 'cancelled'); assert(HeldWorker.all.at(-1)?.terminated);
    assert.equal(records.get(key), bytes); assert.equal(writes, beforeWrites); assert.deepEqual(facts(), before);
  });
}

await check('closed-world settled checkpoint is not abandoned again', async () => {
  const record = fixture(identityFor(disabled[0]!.id));
  Object.assign(record.inventory.run!, { status: 'settled', outcome: 'extract', returnedIds: [], kindlingGained: 3 });
  const bytes = encode(record); records.set(key, bytes);
  assert.equal(saveManager.captureLoadSnapshot()?.runStatus, 'settled');
  const workers = HeldWorker.all.length, beforeWrites = writes, before = facts();
  const controller = new AbortController();
  const pending = loadExpedition(host, undefined, undefined, { ...options, signal: controller.signal });
  assert.equal(HeldWorker.all.length, workers + 1); controller.abort();
  assert.equal(await pending, 'cancelled'); assert.equal(records.get(key), bytes);
  assert.equal(writes, beforeWrites); assert.deepEqual(facts(), before);
});

await check('damaged envelope retains the existing explicit-rescue protection', async () => {
  const record = fixture(identityFor(disabled[0]!.id)); record.checkpointChecksum = 'broken';
  const bytes = JSON.stringify(record); records.set(key, bytes);
  assert.equal(saveManager.captureLoadSnapshot()?.runStatus, null);
  const before = facts(), beforeWrites = writes, workers = HeldWorker.all.length;
  let rescuePrompts = 0;
  assert.equal(await loadExpedition(host, undefined, () => { rescuePrompts++; }, options), 'interrupted');
  assert.equal(rescuePrompts, 1); assert.equal(records.get(key), bytes); assert.equal(writes, beforeWrites);
  assert.equal(HeldWorker.all.length, workers); assert.deepEqual(facts(), before);
});

await check('return after automatic abandonment settles the base once through the existing scene flow', async () => {
  records.set(key, encode(fixture(identityFor(disabled[0]!.id))));
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'entered');
  const { PurificationScene } = await import('../../src/scenes/purification-scene');
  const { audioManager } = await import('../../src/managers/audio-manager');
  audioManager.playSFX = () => {}; audioManager.stopLoop = () => {};
  const drawBoundary = new Error('Stop before drawing the base');
  const returnToBase = (): void => {
    const scene = new PurificationScene();
    Object.assign(scene, { physics: { world: { setBounds() { throw drawBoundary; } } } });
    assert.throws(() => scene.create({ fromMenu: true }), reason => reason === drawBoundary);
  };
  const oldTide = tideSystem.getState(); returnToBase();
  assert.equal(inventoryStore.getRun()?.baseSettled, true);
  assert.notDeepEqual(tideSystem.getState(), oldTide);
  const settled = facts();
  assert.equal(await loadExpedition(host, undefined, undefined, options), 'entered'); returnToBase();
  assert.deepEqual(facts(), settled);
});
console.log(`Closed-world entry: ${checks} focused checks passed; actual world rendering is not exercised.`);
