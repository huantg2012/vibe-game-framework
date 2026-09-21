/** I29: frozen impact facts, tiered disclosure and pure pressure previews. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { purchaseGrowth } from '../../src/managers/growth-purchases';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { getDefenseRuntimeState } from '../../src/systems/defense-engine';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem, validImpactForecastState, type ImpactForecastState } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';
import type { SaveDataV2 } from '../../src/types/game-types';

const records = new Map<string, string>();
let failWrites = false;
saveManager.setStorage({ getItem: key => records.get(key) ?? null, removeItem: key => { records.delete(key); },
  setItem: (key, value) => { if (failWrites) throw Error('simulated quota'); records.set(key, value); } });
const key = GAME_CONSTANTS.SAVE.KEY;
const checks: string[] = [];
const forbiddenDraw = () => { throw Error('A frozen fact or pure reading must not consume entropy'); };
function check(name: string, test: () => void): void { test(); checks.push(name); console.log(`PASS ${name}`); }
function reset(): void {
  failWrites = false; saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); contaminantSystem.reset(); tideSystem.reset(); stabilityTracker.reset();
  growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: true, toolRevealed: true, leftFiniteCrest: true });
  impactSystem.resetForecastState(); gameState.incrementCycle(); gameState.incrementCycle();
  gameState.addKindling(100);
}
function sequence(values: readonly number[]): () => number {
  let index = 0;
  return () => { assert(index < values.length, 'unexpected entropy draw'); return values[index++]!; };
}
function snapshot() {
  return { game: gameState.getState(), inventory: inventoryStore.getState(), growth: growthSystem.getState(),
    forecast: impactSystem.getForecastState(), defense: getDefenseRuntimeState(), stability: stabilityTracker.getState() };
}
function legacy(committed = false): ImpactForecastState {
  return { version: 1, targetId: 'CORE', committed, consumed: false,
    display: { targetId: 'CORE', severity: committed ? 'heavy' : 'moderate' }, lookahead: null,
    queuedTargets: [], nextIntensity: 2.2, nextNextIntensity: 2.4 };
}

check('L0/L1/L2/L3 reveal fixed facts in order; low levels omit intensity and pressure', () => {
  reset(); gameState.setImpactIntensity(2.2);
  impactSystem.generateForecast(2.2, 0, 2.4, sequence([0, .1, 0, .99, .99]));
  const frozen = impactSystem.getForecastState();
  assert.equal(frozen.version, 2); assert.equal(frozen.targetId, 'CORE'); assert.equal(frozen.actualPrimaryId, 'PURIFIER');
  const zero = impactSystem.getForecastReading(0)!;
  assert.deepEqual(zero, { targetId: 'CORE', severity: 'moderate', targetCertain: false,
    severityCertain: false, intensity: null, baseDamagePerModule: null, legacy: false });
  const one = impactSystem.getForecastReading(1)!;
  assert.equal(one.severity, 'heavy'); assert(one.severityCertain); assert(!one.targetCertain);
  assert.equal(one.targetId, 'CORE'); assert.equal(one.intensity, null); assert.equal(one.baseDamagePerModule, null);
  const two = impactSystem.getForecastReading(2)!;
  assert.equal(two.targetId, 'PURIFIER'); assert(two.targetCertain); assert(two.severityCertain);
  assert.equal(two.intensity, null); assert.equal(two.baseDamagePerModule, null);
  const three = impactSystem.getForecastReading(3)!;
  assert.equal(three.intensity, 2.2); assert.deepEqual(three.baseDamagePerModule, { CORE: 12, STORAGE: 11, PURIFIER: 43 });
  assert.deepEqual(impactSystem.getForecastState(), frozen);
  assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, 'PURIFIER');
});

check('legacy probability bonus no longer changes any generated fact or draw sequence', () => {
  reset(); impactSystem.generateForecast(2.2, 0, 2.4, sequence([0, .1, 0, .99, .99]));
  const baseline = impactSystem.getForecastState();
  impactSystem.resetForecastState();
  impactSystem.generateForecast(2.2, .99, 2.4, sequence([0, .1, 0, .99, .99]));
  assert.deepEqual(impactSystem.getForecastState(), baseline);
});

check('generated actual target retains the 80 percent conditional hit rule and freezes both branches', () => {
  let hits = 0;
  for (let roll = 0; roll < 100; roll++) {
    reset();
    impactSystem.generateForecast(1, 0, 1.2, sequence([.4, .9, roll / 100, .9]));
    const state = impactSystem.getForecastState();
    if (state.targetId === state.actualPrimaryId) hits++;
    assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, state.actualPrimaryId);
  }
  assert.equal(hits, 80);
});

check('pressure preview is pure, independently copied and uses exactly the real rounding for every module', () => {
  for (const intensity of [1, 1.2, 1.5, 1.8, 2.2, 2.5, 3]) for (const targetRoll of [0, .4, .9]) {
    reset(); gameState.setImpactIntensity(intensity);
    impactSystem.generateForecast(intensity, 0, intensity, sequence([targetRoll, .9, 0]));
    const before = snapshot();
    const reading = impactSystem.getForecastReading(3)!;
    const pressure = { ...reading.baseDamagePerModule! };
    (reading.baseDamagePerModule as Record<string, number>).CORE = -1;
    for (let repeat = 0; repeat < 5; repeat++) {
      impactSystem.getForecastReading(repeat % 4);
      impactSystem.generateForecast(intensity, 0, intensity, forbiddenDraw);
    }
    assert.deepEqual(snapshot(), before);
    assert.deepEqual(impactSystem.getForecastReading(3)!.baseDamagePerModule, pressure);
    const result = impactSystem.run([], undefined, forbiddenDraw);
    assert.deepEqual(Object.fromEntries(result.damages.map(item => [item.moduleId, item.damage])), pressure);
    assert.equal(Object.values(pressure).reduce((sum, value) => sum + value, 0), Math.round(30 * intensity));
  }
});

check('slotting and removing an offering does not alter original pressure or apply defense side effects', () => {
  reset(); gameState.setImpactIntensity(3);
  impactSystem.generateForecast(3, 0, 3, sequence([0, .9, 0]));
  const pressure = impactSystem.getForecastReading(3)!.baseDamagePerModule;
  assert.deepEqual(pressure, { CORE: 59, STORAGE: 16, PURIFIER: 15 });
  const offering = contaminantSystem.acquire('retrograde', 'common');
  for (let iteration = 0; iteration < 3; iteration++) {
    assert(contaminantSystem.slotDefense(offering.id, 0));
    const before = snapshot();
    assert.deepEqual(impactSystem.getForecastReading(3)!.baseDamagePerModule, pressure);
    assert.deepEqual(snapshot(), before);
    contaminantSystem.unslotDefense(0);
  }
  assert(contaminantSystem.slotDefense(offering.id, 0));
  const result = impactSystem.run(contaminantSystem.getDefenseSlotted(), undefined, forbiddenDraw);
  assert.deepEqual(result.baseDamagePerModule, pressure);
  assert(result.damages.reduce((sum, item) => sum + item.damage, 0) < 90);
});

check('V1 uncommitted records never claim new certainty before actual consumption; promises and queued targets survive', () => {
  reset(); impactSystem.loadForecastState(legacy());
  for (let level = 0; level <= 3; level++) {
    const reading = impactSystem.getForecastReading(level)!;
    assert(reading.legacy); assert(!reading.targetCertain); assert(!reading.severityCertain);
    assert.equal(reading.intensity, null); assert.equal(reading.baseDamagePerModule, null);
  }
  assert(saveManager.trySave()); const bytes = records.get(key);
  assert(saveManager.load()); assert.equal(records.get(key), bytes); assert.equal(impactSystem.getForecastState().version, 1);
  assert.equal(impactSystem.run([], undefined, sequence([.99, .99])).primaryModuleId, 'PURIFIER');
  impactSystem.generateForecast(2.4, 0, 2.5, sequence([0, .9, 0]));
  assert.equal(impactSystem.getForecastReading(2)!.legacy, false);
  assert(impactSystem.getForecastReading(2)!.targetCertain);
  impactSystem.loadForecastState({ ...legacy(true), lookahead: { targetId: 'STORAGE', severity: 'heavy' }, queuedTargets: ['STORAGE'] });
  const reading = impactSystem.getForecastReading(0)!;
  assert(reading.targetCertain); assert(reading.severityCertain); assert.equal(reading.baseDamagePerModule, null);
  assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, 'CORE');
  impactSystem.generateForecast(2.4, 0, 2.5, forbiddenDraw);
  assert.equal(impactSystem.getForecastReading(0)!.targetId, 'STORAGE');
  assert(impactSystem.getForecastReading(0)!.targetCertain);
  assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, 'STORAGE');
});

check('first exempt return has zero preview and consumes it before tide advancement creates the first real pressure', () => {
  reset(); gameState.reset();
  impactSystem.generateForecast(tideSystem.getCurrentIntensity(), 0, tideSystem.peekNextIntensity(), sequence([0, .9, 0]));
  assert.deepEqual(impactSystem.getForecastReading(3)!.baseDamagePerModule, { CORE: 0, STORAGE: 0, PURIFIER: 0 });
  gameState.incrementCycle(); assert(impactSystem.run([], undefined, forbiddenDraw).skipped);
  assert(impactSystem.getForecastState().consumed); assert(!impactSystem.getForecastState().earnedPending);
  tideSystem.advanceCycle();
  impactSystem.generateForecast(tideSystem.getCurrentIntensity(), 0, tideSystem.peekNextIntensity(), sequence([.4, .9, 0]));
  const pressure = impactSystem.getForecastReading(3)!.baseDamagePerModule;
  assert.equal(impactSystem.getForecastReading(3)!.intensity, 1.2);
  assert.equal(Object.values(pressure!).reduce((sum, value) => sum + value, 0), 36);
  gameState.incrementCycle(); gameState.setImpactIntensity(tideSystem.getCurrentIntensity());
  assert.deepEqual(Object.fromEntries(impactSystem.run([], undefined, forbiddenDraw).damages.map(item => [item.moduleId, item.damage])), pressure);
});

check('V2 save validation rejects absent/foreign/contradictory frozen targets before mutating live systems', () => {
  reset(); impactSystem.generateForecast(1, 0, 1.2, sequence([0, .9, 0])); assert(saveManager.trySave());
  const saved = JSON.parse(records.get(key)!) as SaveDataV2;
  const baseline = snapshot();
  const invalidStates = [
    { ...saved.impactForecast!, actualPrimaryId: undefined },
    { ...saved.impactForecast!, actualPrimaryId: 'missing' },
    { ...saved.impactForecast!, actualPrimaryId: 'STORAGE', committed: true },
    { ...saved.impactForecast!, display: null, targetId: null, actualPrimaryId: 'CORE' },
  ];
  for (const invalid of invalidStates) {
    assert(!validImpactForecastState(invalid, ['CORE', 'STORAGE', 'PURIFIER']));
    records.set(key, JSON.stringify({ ...saved, impactForecast: invalid }));
    assert.equal(saveManager.load(), false); assert.deepEqual(snapshot(), baseline);
  }
});

check('all three real information purchases preserve the actual impact; rejected writes expose no unpersisted tier', () => {
  reset();
  gameState.addKindling(1000);
  impactSystem.generateForecast(1, 0, 1.2, sequence([0, .9, .99, .99]));
  assert(saveManager.trySave());
  const frozen = impactSystem.getForecastState();
  for (let level = 1; level <= 3; level++) {
    while (growthSystem.getNextStep()?.id !== 'growth_forecast_clarity') {
      const next = growthSystem.getNextStep();
      assert(next && purchaseGrowth(next.id).ok);
    }
    const before = snapshot(), bytes = records.get(key);
    const beforeReading = impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity'));
    failWrites = true; assert.deepEqual(purchaseGrowth('growth_forecast_clarity'), { ok: false, reason: 'storage-failed' });
    assert.deepEqual(snapshot(), before); assert.equal(records.get(key), bytes);
    assert.deepEqual(impactSystem.getForecastReading(growthSystem.getLevel('growth_forecast_clarity')), beforeReading);
    failWrites = false; assert(purchaseGrowth('growth_forecast_clarity').ok);
    assert.equal(growthSystem.getLevel('growth_forecast_clarity'), level);
    assert.deepEqual(impactSystem.getForecastState(), frozen);
    const reading = impactSystem.getForecastReading(level); assert(saveManager.load());
    assert.deepEqual(impactSystem.getForecastState(), frozen); assert.deepEqual(impactSystem.getForecastReading(level), reading);
  }
  const pressure = impactSystem.getForecastReading(3)!.baseDamagePerModule;
  assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, frozen.actualPrimaryId);
  impactSystem.loadForecastState(frozen);
  const noInvestment = growthSystem.getState(); noInvestment.upgrades.growth_forecast_clarity = 0;
  growthSystem.loadState(noInvestment);
  assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, frozen.actualPrimaryId);
  assert.deepEqual(impactSystem.getForecastReading(3)!.baseDamagePerModule, pressure);
});

check('save admission rejects malformed progression before mutation and accepts missing or partial historical facts', () => {
  reset(); assert(saveManager.trySave());
  const original = JSON.parse(records.get(key)!) as SaveDataV2;
  const before = snapshot();
  for (const progression of [null, [], 'true', { version: 2 }, { version: 1, toolRevealed: 'true' }, { version: 1, offeringCompleted: 1 }]) {
    records.set(key, JSON.stringify({ ...original, growth: { ...original.growth, progression } }));
    assert.equal(saveManager.load(), false); assert.deepEqual(snapshot(), before);
  }
  for (const progression of [undefined, { version: 1, impactExperienced: true }]) {
    records.set(key, JSON.stringify({ ...original, growth: { ...original.growth, progression } }));
    assert(saveManager.load());
    assert.equal(growthSystem.getState().progression!.impactExperienced, progression?.impactExperienced === true);
    assert.equal(growthSystem.getState().progression!.toolRevealed, false);
  }
});

const out = process.argv[2] ?? 'docs/qa/artifacts/iteration-29/forecast-reading.json';
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, JSON.stringify({ iteration: 29, verifiedAt: new Date().toISOString(), result: 'PASS', checks,
  method: 'real impact, save, purchase and inventory systems with isolated memory storage and injected entropy',
  limitations: ['Controlled qualifying return facts; no player visual acceptance or natural progression pacing is claimed.'] }, null, 2) + '\n');
inventoryStore.setPersistence(null);
console.log(`${checks.length} forecast reading checks passed; ${out}`);
