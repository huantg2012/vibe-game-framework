/** Real inventory/save/impact regression, isolated from the user's browser save. */
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
  const first = impactSystem.getForecastDisplay()!;
  const memory = contaminantSystem.acquire('retrograde', 'common');
  check('slot immediately upgrades the current target and creates one committed lookahead', () => {
    assert(contaminantSystem.slotDefense(memory.id, 0));
    assert(impactSystem.getForecastLookahead());
    assert.equal(impactSystem.getForecastDisplay()?.targetId, first.targetId);
    assert(impactSystem.getForecastState().committed);
  });
  const promise = impactSystem.getForecastState();
  check('menu redraw and departure cycle changes cannot reroll either promised target', () => {
    Math.random = () => .99;
    for (let i = 0; i < 5; i++) generate();
    gameState.incrementCycle(); generate();
    assert.deepEqual(impactSystem.getForecastState(), promise);
  });
  check('removing the item and reloading retain both already disclosed promises', () => {
    contaminantSystem.unslotDefense(0); generate();
    assert.deepEqual(impactSystem.getForecastState(), promise);
    saveManager.save(); impactSystem.resetForecastState();
    assert(saveManager.load()); assert.deepEqual(impactSystem.getForecastState(), promise);
  });
  check('actual impact consumes one promise; remaining queued target is still certain after removal', () => {
    assert.equal(impactSystem.run([]).primaryModuleId, promise.targetId);
    tideSystem.advanceCycle(); generate();
    assert.equal(impactSystem.getForecastDisplay()?.targetId, promise.lookahead?.targetId);
    assert.equal(impactSystem.getForecastDisplay()?.severity, promise.lookahead?.severity);
    assert.equal(impactSystem.getForecastLookahead(), null);
    assert.equal(impactSystem.run([]).primaryModuleId, promise.lookahead?.targetId);
    tideSystem.advanceCycle(); generate();
    assert.equal(impactSystem.getForecastState().committed, false);
  });
  check('final offering impact benefits before maturation, preserving next impact promise', () => {
    reset(); Math.random = () => 0;
    const item = contaminantSystem.acquire('retrograde', 'common');
    assert(contaminantSystem.slotDefense(item.id, 0)); generate();
    const pending = impactSystem.getForecastLookahead()!;
    const snapshot = inventoryStore.getOfferingItems().map(entry => entry?.id ?? null);
    const result = impactSystem.run(contaminantSystem.getDefenseSlotted(), snapshot);
    assert(result.defenseResult?.forecastCorrect);
    assert(inventoryStore.finishOfferingImpact(snapshot, 999, result.defenseResult?.bonusCharges ?? {}).ok);
    assert.equal(contaminantSystem.getDefenseSlotted()[0], null);
    tideSystem.advanceCycle(); generate();
    assert.deepEqual(impactSystem.getForecastDisplay(), pending);
    Math.random = () => .99;
    assert.equal(impactSystem.run([]).primaryModuleId, pending.targetId);
  });
  check('slot promise and inventory are atomic on failed persistence, then durable on success', () => {
    reset(); Math.random = () => 0; generate();
    const item = contaminantSystem.acquire('retrograde', 'common'); saveManager.save();
    const before = impactSystem.getForecastState(); const saved = bytes.get(key);
    failWrites = true;
    assert.equal(contaminantSystem.slotDefense(item.id, 0), false);
    assert.deepEqual(impactSystem.getForecastState(), before); assert.equal(bytes.get(key), saved);
    assert.equal(contaminantSystem.getDefenseSlotted()[0], null);
    failWrites = false; assert(contaminantSystem.slotDefense(item.id, 0));
    const after = impactSystem.getForecastState();
    assert(after.committed && after.lookahead);
    assert.deepEqual((JSON.parse(bytes.get(key)!) as SaveDataV2).impactForecast, after);
    impactSystem.resetForecastState(); assert(saveManager.load());
    assert.deepEqual(impactSystem.getForecastState(), after);
  });
  check('old saves gain one stable forecast; invalid forecast payloads leave live state intact', () => {
    const data = JSON.parse(bytes.get(key)!) as SaveDataV2;
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
