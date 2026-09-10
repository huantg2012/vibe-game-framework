/** Production inventory/save/impact regression; never touches the user's browser. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { impactSystem } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { tideSystem } from '../../src/systems/tide-system';
import { growthSystem } from '../../src/systems/growth-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import type { SaveDataV2 } from '../../src/types/game-types';

const bytes = new Map<string, string>();
let failWrites = false;
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalRandom = Math.random;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => bytes.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failWrites) throw Error('quota'); bytes.set(key, value); },
  removeItem: (key: string) => bytes.delete(key),
} });
const key = GAME_CONSTANTS.SAVE.KEY;
let checks = 0;
function check(name: string, fn: () => void): void { fn(); console.log(`PASS ${name}`); checks++; }
function reset(): void {
  failWrites = false; inventoryStore.setPersistence(null); saveManager.deleteSave();
  gameState.reset(); contaminantSystem.reset(); tideSystem.reset(); growthSystem.reset(); stabilityTracker.reset();
  impactSystem.resetForecastState(); gameState.incrementCycle(); gameState.setImpactIntensity(1);
}
function generate(): void { impactSystem.generateForecast(tideSystem.getCurrentIntensity(), 0, tideSystem.peekNextIntensity()); }
try {
  reset(); Math.random = () => 0; generate();
  const first = impactSystem.getForecastState();
  const memory = contaminantSystem.acquire('retrograde', 'common');
  check('slot/read/unslot never grants free current certainty or next reading', () => {
    for (let i = 0; i < 4; i++) {
      assert(contaminantSystem.slotDefense(memory.id, 0));
      assert.equal(impactSystem.getForecastLookahead(), null);
      impactSystem.getForecastDisplay(); generate();
      assert.deepEqual(impactSystem.getForecastState(), first);
      contaminantSystem.unslotDefense(0);
    }
    assert.deepEqual(impactSystem.getForecastState(), first);
  });
  check('same-cycle redraw and departure cycle change never reroll a reading', () => {
    Math.random = () => .99;
    for (let i = 0; i < 5; i++) generate();
    gameState.incrementCycle(); generate();
    assert.deepEqual(impactSystem.getForecastState(), first);
  });
  check('actual offering impact earns the next record without rewriting current target', () => {
    assert(contaminantSystem.slotDefense(memory.id, 0));
    const snapshot = inventoryStore.getOfferingItems().map(entry => entry?.id ?? null);
    const result = impactSystem.run(contaminantSystem.getDefenseSlotted(), snapshot);
    assert.notEqual(result.primaryModuleId, first.targetId);
    assert.equal(impactSystem.getForecastState().earnedPending, true);
    contaminantSystem.unslotDefense(0); tideSystem.advanceCycle(); generate();
    assert(impactSystem.getForecastState().committed);
    assert.equal(impactSystem.getForecastState().earnedPending, false);
    assert.equal(impactSystem.getForecastLookahead(), null);
  });
  check('earned record survives removal/save/load and is consumed exactly once', () => {
    const promised = impactSystem.getForecastState();
    saveManager.save(); impactSystem.resetForecastState();
    assert(saveManager.load()); assert.deepEqual(impactSystem.getForecastState(), promised);
    Math.random = () => .1;
    assert.equal(impactSystem.run([]).primaryModuleId, promised.targetId);
    tideSystem.advanceCycle(); generate();
    assert.equal(impactSystem.getForecastState().committed, false);
  });
  check('last offering impact earns record before maturation; cycle-zero exemption earns none', () => {
    reset(); Math.random = () => 0;
    const item = contaminantSystem.acquire('retrograde', 'common');
    assert(contaminantSystem.slotDefense(item.id, 0)); generate();
    const snapshot = inventoryStore.getOfferingItems().map(entry => entry?.id ?? null);
    const result = impactSystem.run(contaminantSystem.getDefenseSlotted(), snapshot);
    assert(inventoryStore.finishOfferingImpact(snapshot, 999, result.defenseResult?.bonusCharges ?? {}).ok);
    assert.equal(contaminantSystem.getDefenseSlotted()[0], null);
    tideSystem.advanceCycle(); generate();
    const pending = impactSystem.getForecastDisplay()!;
    assert(impactSystem.getForecastState().committed);
    Math.random = () => .99;
    assert.equal(impactSystem.run([]).primaryModuleId, pending.targetId);
    reset(); gameState.reset();
    const fresh = contaminantSystem.acquire('retrograde', 'common');
    assert(contaminantSystem.slotDefense(fresh.id, 0)); generate();
    assert(impactSystem.run(contaminantSystem.getDefenseSlotted()).skipped);
    assert.equal(impactSystem.getForecastState().earnedPending, false);
  });
  check('failed slot persistence rolls back inventory without manufacturing memory', () => {
    reset(); Math.random = () => 0; generate();
    const item = contaminantSystem.acquire('retrograde', 'common'); saveManager.save();
    const before = impactSystem.getForecastState(); const saved = bytes.get(key);
    failWrites = true;
    assert.equal(contaminantSystem.slotDefense(item.id, 0), false);
    assert.deepEqual(impactSystem.getForecastState(), before); assert.equal(bytes.get(key), saved);
    assert.equal(contaminantSystem.getDefenseSlotted()[0], null);
    failWrites = false; assert(contaminantSystem.slotDefense(item.id, 0));
    assert.deepEqual(impactSystem.getForecastState(), before);
  });
  check('failed save preserves earned pending token; retry creates exactly one durable promise', () => {
    const snapshot = inventoryStore.getOfferingItems().map(entry => entry?.id ?? null);
    impactSystem.run(contaminantSystem.getDefenseSlotted(), snapshot);
    tideSystem.advanceCycle();
    const before = impactSystem.getForecastState(); const saved = bytes.get(key);
    assert(before.earnedPending && before.consumed);
    failWrites = true; assert.equal(saveManager.trySave(), false);
    assert.deepEqual(impactSystem.getForecastState(), before); assert.equal(bytes.get(key), saved);
    failWrites = false; saveManager.save();
    const after = impactSystem.getForecastState(); assert(after.committed && !after.earnedPending);
    saveManager.save(); assert.deepEqual(impactSystem.getForecastState(), after);
  });
  check('previously published legacy double commitments remain valid naturally', () => {
    reset();
    impactSystem.loadForecastState({ version: 1, targetId: 'CORE', committed: true, consumed: false,
      display: { targetId: 'CORE', severity: 'light' }, lookahead: { targetId: 'STORAGE', severity: 'light' },
      queuedTargets: ['STORAGE'], nextIntensity: 1, nextNextIntensity: 1 });
    generate(); saveManager.save(); assert(saveManager.load());
    Math.random = () => .99;
    assert.equal(impactSystem.run([]).primaryModuleId, 'CORE');
    tideSystem.advanceCycle(); generate();
    assert.equal(impactSystem.getForecastDisplay()?.targetId, 'STORAGE');
    assert.equal(impactSystem.getForecastLookahead(), null);
    assert.equal(impactSystem.run([]).primaryModuleId, 'STORAGE');
    tideSystem.advanceCycle(); generate();
    assert.equal(impactSystem.getForecastState().committed, false);
  });
  check('old saves get stable baseline; malformed forecasts leave live state intact', () => {
    saveManager.save(); const data = JSON.parse(bytes.get(key)!) as SaveDataV2;
    delete data.impactForecast; bytes.set(key, JSON.stringify(data));
    assert(saveManager.load()); generate(); saveManager.save();
    const stable = impactSystem.getForecastState();
    assert(saveManager.load()); generate(); assert.deepEqual(impactSystem.getForecastState(), stable);
    data.impactForecast = { ...stable, queuedTargets: ['NOT_A_MODULE'] };
    bytes.set(key, JSON.stringify(data));
    const inventoryBefore = inventoryStore.getState();
    assert.equal(saveManager.load(), false);
    assert.deepEqual(inventoryStore.getState(), inventoryBefore);
    assert.deepEqual(impactSystem.getForecastState(), stable);
  });
  console.log(`${checks} forecast contract checks passed`);
} finally {
  Math.random = originalRandom; inventoryStore.setPersistence(null);
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
}
