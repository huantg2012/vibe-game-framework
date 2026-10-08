/** Transaction transport checks. These do not replace scene recovery playtests. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { commitEffects, afterStateCommit } from '../../src/core/commit-effects';
import { saveManager } from '../../src/managers/save-manager';
import { gameState } from '../../src/managers/game-state';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';
import type { SaveDataV2 } from '../../src/types/game-types';
import { checkpointChecksum, type RiftCheckpoint } from '../../src/types/rift-checkpoint';

const records = new Map<string, string>();
const key = GAME_CONSTANTS.SAVE.KEY;
let failWrites = false;
const attempted: string[] = [];
saveManager.setStorage({
  getItem: key => records.get(key) ?? null,
  removeItem: key => { records.delete(key); },
  setItem: (storedKey, bytes) => {
    if (storedKey === key) attempted.push(bytes);
    if (failWrites) throw new Error('Injected unavailable storage');
    records.set(storedKey, bytes);
  },
});
saveManager.deleteSave();
gameState.reset(); tideSystem.reset(); contaminantSystem.reset();
growthSystem.reset(); stabilityTracker.reset(); impactSystem.resetForecastState();
saveManager.save();
assert(inventoryStore.beginRun('atomic-rift').ok);
const weaponId = inventoryStore.getEquipment().weaponId!;
const initial = inventoryStore.getItem(weaponId)!;
assert(initial.kind === 'weapon');
const durability = initial.weapon.usesRemaining;
const read = () => JSON.parse(records.get(key)!) as SaveDataV2;
let notifications = 0, visible = 0;
const unsubscribe = inventoryStore.subscribe(() => notifications++);
const checkpoint: RiftCheckpoint<{ health: number; kindling: number; effect: string }> = {
  version: 1, runId: 'atomic-rift', sequence: 0,
  identity: { worldId: 'suspended-sea', layoutId: 'sea-open-channel', seed: 7, signature: 'transport-fixture' },
  elapsedMs: 1000, state: { health: 82, kindling: 3, effect: 'shell-diverted' },
};
saveManager.setRiftStateValidator(value => {
  const state = value.state as Partial<typeof checkpoint.state>;
  return typeof state.health === 'number' && Number.isFinite(state.health)
    && typeof state.kindling === 'number' && Number.isSafeInteger(state.kindling) && state.kindling >= 0
    && state.effect === 'shell-diverted';
});
inventoryStore.beginFrameTransaction(); commitEffects.begin();
assert(inventoryStore.consumeEquipmentUse(weaponId).ok);
afterStateCommit(() => visible++);
assert.equal(notifications, 0); assert.equal(visible, 0);
assert.equal(read().inventory.items.find(item => item.id === weaponId)?.kind, 'weapon');
const old = records.get(key);
const persist = saveManager.prepareRiftCommit(checkpoint);
// A caller retaining a mutable object cannot change the already frozen result.
checkpoint.state.health = 1;
failWrites = true;
assert.equal(inventoryStore.commitFrameTransaction(persist), false);
assert.equal(records.get(key), old);
assert.equal(notifications, 0); assert.equal(visible, 0);
assert.deepEqual(inventoryStore.consumeEquipmentUse(weaponId), { ok: false, error: 'storage-failed' });
assert.equal(saveManager.load(), false, 'loading cannot replace a pending frame');
const failedBytes = attempted.at(-1);
failWrites = false;
assert(inventoryStore.commitFrameTransaction(persist)); commitEffects.flush();
assert.equal(attempted.at(-1), failedBytes, 'retry must use the exact candidate');
assert.equal(notifications, 1); assert.equal(visible, 1);
assert.equal(read().riftCheckpoint?.sequence, 0);
assert.equal((read().riftCheckpoint?.state as typeof checkpoint.state).health, 82);
assert.equal((read().inventory.items.find(item => item.id === weaponId) as typeof initial).weapon.usesRemaining, durability - 1);
assert.equal(records.get(`${key}:previous`), old);
assert(saveManager.load());
assert.equal(inventoryStore.getRun()?.status, 'active');
assert.equal(gameState.getCycle(), 0, 'load never starts another trip');
console.log('PASS durability, corresponding world effect and presentation publish only as one complete commit; failed retry does not reroll');

const baseline = inventoryStore.getState(), complete = records.get(key)!;
const corrupt = read(); corrupt.inventory.items[0]!.id = 'tampered';
records.set(key, JSON.stringify(corrupt));
assert.equal(saveManager.load(), false); assert.deepEqual(inventoryStore.getState(), baseline);
assert.equal(records.get(key), JSON.stringify(corrupt));
const unsupported = JSON.parse(complete) as SaveDataV2;
(unsupported.riftCheckpoint!.state as { effect: string }).effect = 'unknown';
delete unsupported.checkpointChecksum;
unsupported.checkpointChecksum = checkpointChecksum(unsupported);
records.set(key, JSON.stringify(unsupported));
assert.equal(saveManager.load(), false); assert.deepEqual(inventoryStore.getState(), baseline);
assert.equal(records.get(`${key}:previous`), old, 'backup is retained, never silently selected');
records.set(key, complete); assert(saveManager.load());
assert.throws(() => saveManager.prepareRiftCommit({ ...checkpoint, sequence: 0, state: { ...checkpoint.state, effect: 'shell-diverted' } }), /sequence/);
console.log('PASS mismatched, corrupt and unsupported complete records leave live state and raw evidence intact');

inventoryStore.beginFrameTransaction();
assert(inventoryStore.settleRun('atomic-rift', 'abandon').ok);
const terminal = { ...checkpoint, sequence: 1, state: { ...checkpoint.state, effect: 'shell-diverted' } };
assert(inventoryStore.commitFrameTransaction(saveManager.prepareRiftCommit(terminal)));
assert.equal(inventoryStore.getRun()?.outcome, 'abandon');
assert.equal(inventoryStore.getRun()?.kindlingGained, 0);
assert.equal(inventoryStore.getItem(weaponId), undefined);
const terminalBytes = records.get(key);
assert(saveManager.load()); assert.equal(records.get(key), terminalBytes);
assert.equal(inventoryStore.getRun()?.status, 'settled');
unsubscribe(); saveManager.setRiftStateValidator(null);
console.log('PASS explicit abandon is durable and distinct from death, gives no carried reward, and repeated load cannot revive the weapon');
console.log('3 recovery persistence transport checks passed.');
