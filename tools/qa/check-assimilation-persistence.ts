/** Persistent body state, honest forecasts and failure-safe base cycles; no real saves. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { purchaseGrowth } from '../../src/managers/growth-purchases';
import { getHealingPreview, performHealingCycle } from '../../src/managers/healing-cycle';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { tideSystem } from '../../src/systems/tide-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { impactSystem } from '../../src/systems/impact-system';
import type { SaveDataV2 } from '../../src/types/game-types';

const records = new Map<string, string>();
let rejectWrites = false;
saveManager.setStorage({ getItem: key => records.get(key) ?? null, removeItem: key => { records.delete(key); },
  setItem: (key, bytes) => { if (rejectWrites) throw Error('simulated refusal'); records.set(key, bytes); } });
function reset(): void {
  saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); contaminantSystem.reset();
  impactSystem.resetForecastState();
}
function record(): SaveDataV2 { return JSON.parse(records.get(GAME_CONSTANTS.SAVE.KEY)!) as SaveDataV2; }
reset();
gameState.setAssimilation(47.5);
gameState.incrementHealingCycles();
assert(saveManager.trySave());
const bodyRecord = record();
assert.equal(bodyRecord.physiologyVersion, 1);
assert.equal(bodyRecord.assimilation, 47.5);
assert.equal(bodyRecord.healingCycles, 1);
gameState.reset();
assert.equal(gameState.getAssimilation(), 0);
assert(saveManager.load());
assert.equal(gameState.getAssimilation(), 47.5);
assert.equal(gameState.getHealingCycles(), 1);

for (const outcome of ['death', 'abandon'] as const) {
  assert(inventoryStore.ensureStarter(`starter-${outcome}`).ok);
  const weapon = inventoryStore.getItems().find(item => item.kind === 'weapon' && item.weapon.stage === 'tool');
  assert(weapon && inventoryStore.prepareWeapon(weapon.id).ok);
  assert(inventoryStore.beginRun(`assimilation-${outcome}`).ok);
  gameState.setAssimilation(61.25);
  assert(inventoryStore.settleRun(`assimilation-${outcome}`, outcome).ok);
  assert.equal(record().assimilation, 61.25, `${outcome} retains persistent burden`);
  assert(inventoryStore.markBaseSettled().ok);
}

const old = structuredClone(bodyRecord);
delete old.physiologyVersion; delete old.assimilation; delete old.healingCycles;
records.set(GAME_CONSTANTS.SAVE.KEY, JSON.stringify(old));
assert(saveManager.load());
assert.equal(gameState.getAssimilation(), 0);
assert.equal(gameState.getHealingCycles(), 0);
assert.equal(record().physiologyVersion, 1, 'a true legacy base is migrated as one complete physiology record');
assert.equal(record().assimilation, 0);
assert.equal(record().healingCycles, 0);
for (const field of ['physiologyVersion', 'assimilation', 'healingCycles'] as const) {
  const incomplete = structuredClone(bodyRecord);
  delete incomplete[field];
  const bytes = JSON.stringify(incomplete);
  records.set(GAME_CONSTANTS.SAVE.KEY, bytes);
  const before = gameState.getState();
  assert.equal(saveManager.load(), false, `missing new physiology field ${field} rejects`);
  assert.deepEqual(gameState.getState(), before);
  assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), bytes);
}
for (const patch of [{ assimilation: -1 }, { assimilation: 101 }, { assimilation: null },
  { assimilation: '20' }, { healingCycles: -1 }, { healingCycles: 1.5 }, { healingCycles: null },
  { physiologyVersion: 0 }, { physiologyVersion: 2 }, { physiologyVersion: '1' }, { physiologyVersion: null }]) {
  const bytes = JSON.stringify({ ...bodyRecord, ...patch });
  records.set(GAME_CONSTANTS.SAVE.KEY, bytes);
  const before = gameState.getState();
  assert.equal(saveManager.load(), false, `reject ${JSON.stringify(patch)}`);
  assert.deepEqual(gameState.getState(), before);
  assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), bytes);
}

reset();
gameState.incrementCycle(); gameState.incrementCycle();
gameState.setImpactIntensity(1.4);
impactSystem.generateForecast(1.4, 0, 1.6, () => .4);
const forecastBefore = impactSystem.getForecastState();
const originalPressure = impactSystem.getForecastReading(3)!;
gameState.setAssimilation(100);
const increasedPressure = impactSystem.getForecastReading(3)!;
assert.equal(increasedPressure.intensity, 1.4 * 1.5);
assert.deepEqual(impactSystem.getForecastState(), forecastBefore, 'body pressure never rerolls the target');
assert.equal(increasedPressure.targetId, originalPressure.targetId);
const impact = impactSystem.run([], [], () => .4);
assert.equal(impact.intensity, increasedPressure.intensity);
assert.deepEqual(Object.fromEntries(impact.damages.map(row => [row.moduleId, row.damage])), increasedPressure.baseDamagePerModule);

reset();
gameState.setAssimilation(30);
assert(saveManager.trySave());
const beforeBytes = records.get(GAME_CONSTANTS.SAVE.KEY);
rejectWrites = true;
let applications = 0;
assert.equal(saveManager.commitWorldTransaction(() => {
  applications++;
  gameState.setAssimilation(15);
  gameState.incrementHealingCycles();
}), false);
assert.equal(saveManager.hasPendingSave(), true);
assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), beforeBytes);
assert.equal(saveManager.commitWorldTransaction(() => { applications++; }), false);
rejectWrites = false;
assert(saveManager.trySave());
assert.equal(applications, 1);
assert.equal(record().assimilation, 15);
assert.equal(record().healingCycles, 1);
assert(saveManager.load());
assert.equal(gameState.getAssimilation(), 15);
assert.equal(gameState.getHealingCycles(), 1);

reset();
assert.equal(getHealingPreview().reason, 'unaffected');
gameState.setAssimilation(30);
gameState.applyDamage('PURIFIER', 46);
assert.equal(getHealingPreview().reason, 'purifier-damaged');
gameState.healModule('PURIFIER', 1);
assert.equal(getHealingPreview().available, true, '25 HP is sufficient');
gameState.healModule('PURIFIER', 75);
gameState.addKindling(1000);
for (let step = 0; step < 4; step++) {
  const next = growthSystem.getNextStep();
  assert(next && purchaseGrowth(next.id).ok);
}
assert.equal(growthSystem.getAvailability('growth_forecast_clarity').reason, 'impactExperienced');
assert(inventoryStore.addContaminant({ id: 'healing-offering', type: 'mirror', rarity: 'common', quality: 'ordinary',
  stage: 'defense', impactCharges: 2, usesRemaining: 0 }).ok);
assert(inventoryStore.slotOffering('healing-offering', 0).ok);
stabilityTracker.loadState({ progress: 20, reached: false });
assert(saveManager.trySave());
const baseCycle = gameState.getCycle(), initialTide = tideSystem.getState();
const healingBefore = records.get(GAME_CONSTANTS.SAVE.KEY);
rejectWrites = true;
const refusedHealing = performHealingCycle();
assert(!refusedHealing.ok && refusedHealing.reason === 'storage-failed');
assert.equal(refusedHealing.pendingResult.impact.skipped, false, 'treatment never inherits first-return exemption');
assert.equal(refusedHealing.pendingResult.impact.intensity, initialTide.currentIntensity * 1.15);
assert.equal(refusedHealing.pendingResult.transforms.length, 1);
assert.equal(gameState.getAssimilation(), 15);
assert.equal(gameState.getCycle(), baseCycle, 'treatment is not a sortie');
assert.equal(inventoryStore.getRun(), null, 'treatment does not invent a run ledger');
assert.equal(stabilityTracker.getProgress(), 20, 'treatment does not award stability');
assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), healingBefore);
const pendingHealing = { inventory: inventoryStore.getState(), game: gameState.getState(), tide: tideSystem.getState() };
assert.deepEqual(performHealingCycle(), { ok: false, reason: 'pending-save' });
rejectWrites = false;
assert(saveManager.trySave());
assert(saveManager.load());
assert.deepEqual({ inventory: inventoryStore.getState(), game: gameState.getState(), tide: tideSystem.getState() }, pendingHealing);
assert.equal(record().inventory.offeringReceipts?.['healing:1']?.length, 1);
assert.equal(record().healingCycles, 1);
assert.equal(growthSystem.getAvailability('growth_forecast_clarity').unlocked, true, 'a real treatment impact unlocks the first forecast experience');
assert.deepEqual(record().growth.progression, { version: 1, impactExperienced: true, offeringCompleted: true, toolRevealed: true, crestExperienced: false });
const secondHealing = performHealingCycle();
assert(secondHealing.ok);
assert.equal(secondHealing.result.cycleId, 'healing:2');
assert.equal(secondHealing.result.after, 0);
assert.equal(getHealingPreview().reason, 'unaffected');
assert.equal(gameState.getCycle(), baseCycle);
assert.equal(stabilityTracker.getProgress(), 20);

for (let step = 0; step < 16; step++) {
  const next = growthSystem.getNextStep();
  assert(next);
  if (next.requirement === 'crestExperienced') break;
  assert(purchaseGrowth(next.id).ok);
}
assert.equal(growthSystem.getAvailability('growth_forecast_clarity').reason, 'crestExperienced');
const finiteCrest = GAME_CONSTANTS.TIDE.TIDES[0]!;
tideSystem.loadState({ tideNumber: 1, phase: 'crest', cycleInPhase: finiteCrest.crestCycles - 1, currentIntensity: finiteCrest.peak });
for (const module of gameState.getModules()) gameState.healModule(module.id, module.maxHp);
gameState.setAssimilation(10);
const stabilityBeforeCrest = stabilityTracker.getProgress();
const crestHealing = performHealingCycle();
assert(crestHealing.ok);
assert.equal(crestHealing.result.phaseChange?.to, 'ebb');
assert.equal(growthSystem.getAvailability('growth_forecast_clarity').unlocked, true, 'leaving a finite crest through treatment unlocks the third forecast experience');
assert.equal(record().growth.progression?.crestExperienced, true);
assert.equal(gameState.getCycle(), baseCycle);
assert.equal(stabilityTracker.getProgress(), stabilityBeforeCrest, 'crest experience does not grant stability');

reset();
gameState.setAssimilation(100);
gameState.incrementCycle();
assert.equal(impactSystem.run().skipped, true, 'ordinary first return remains exempt');

reset();
gameState.setAssimilation(10);
gameState.applyDamage('CORE', 69);
stabilityTracker.addProgress('fixture', 20, false);
const firstTide = GAME_CONSTANTS.TIDE.TIDES[0]!;
tideSystem.loadState({ tideNumber: 1, phase: 'ebb', cycleInPhase: firstTide.ebbCycles - 1, currentIntensity: firstTide.ebbTarget });
const crossing = performHealingCycle();
assert(crossing.ok);
assert.equal(crossing.result.phaseChange?.to, 'rise');
assert.equal(crossing.result.impact.newlyZeroModules, 1);
assert.equal(crossing.result.stabilityDelta, GAME_CONSTANTS.STABILITY.LOSS_MODULE_ZERO);
assert.equal(stabilityTracker.getProgress(), 19, 'real module loss is penalized but crossing tides grants no treatment reward');
inventoryStore.setPersistence(null);
console.log('PASS assimilation persistence: old/malformed saves, death/abandon, exact forecast pressure, treatment gates/offering/tide, frozen retry and cold load');
