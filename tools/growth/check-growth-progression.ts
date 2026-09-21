/** I29: CSV-qualified purchases and conservative, reward-free experience records. */
import assert from 'node:assert/strict';
import { eventBus } from '../../src/core/event-bus';
import { UPGRADE_DATA } from '../../src/generated/upgrade-data';
import { gameState } from '../../src/managers/game-state';
import { growthSystem, validateGrowthProgressionState } from '../../src/systems/growth-system';
import type { GrowthReturnFacts } from '../../src/systems/growth-system';
import { GameEvent } from '../../src/types/events';
import type { GrowthProgressionState, GrowthState, GrowthUpgradeId } from '../../src/types/game-types';

const noFacts: GrowthReturnFacts = {
  impactOccurred: false, offeringCompleted: false, toolRevealed: false, leftFiniteCrest: false,
};
const emptyProgression: GrowthProgressionState = {
  version: 1, impactExperienced: false, offeringCompleted: false, toolRevealed: false, crestExperienced: false,
};

function reset(): void {
  growthSystem.reset();
  gameState.reset();
  gameState.addKindling(1000);
}

function loadProgression(progression: unknown): void {
  growthSystem.loadState({ ...growthSystem.getState(), progression } as GrowthState);
}

reset();
const expectedCosts: Record<GrowthUpgradeId, readonly number[]> = {
  growth_chaos_resist: [8, 12, 18, 25, 35],
  growth_kindling_affinity: [8, 12, 18],
  growth_vitality: [8, 12, 18, 25],
  growth_sortie_slot: [40],
  growth_defense_slot: [35],
  growth_forecast_clarity: [10, 20, 30],
};
for (const id of growthSystem.getAllUpgradeIds()) {
  const definition = growthSystem.getUpgradeDefinition(id);
  assert.equal(definition, UPGRADE_DATA[id]);
  assert.deepEqual(definition.costs, expectedCosts[id]);
  assert.equal(definition.unlocks.length, definition.maxLevel);
  assert(definition.name.length > 0);
  if (definition.responsibility === 'body') {
    assert.deepEqual(growthSystem.getAvailability(id), { visible: true, unlocked: true, reason: null, nextLevel: 1 });
    assert(definition.unlocks.every(requirement => requirement === 'none'));
  } else {
    const availability = growthSystem.getAvailability(id);
    assert.equal(availability.visible, false);
    assert.equal(availability.unlocked, false);
    assert.equal(availability.reason, definition.unlocks[0]);
    assert.equal(growthSystem.canAfford(id, 1000), false);
  }
}
assert.equal(UPGRADE_DATA.growth_forecast_clarity.effectPerLevel, 1);
assert.equal(UPGRADE_DATA.growth_forecast_clarity.effectUnit, '信息层');
console.log('PASS CSV retains six axes and all costs; new characters qualify only for body upgrades');

let purchaseEvents = 0;
let kindlingEvents = 0;
let stabilityEvents = 0;
const onPurchase = (): void => { purchaseEvents++; };
const onKindling = (): void => { kindlingEvents++; };
const onStability = (): void => { stabilityEvents++; };
eventBus.on(GameEvent.GROWTH_PURCHASED, onPurchase);
eventBus.on(GameEvent.KINDLING_COLLECTED, onKindling);
eventBus.on(GameEvent.STABILITY_CHANGED, onStability);

try {
  const initialGame = gameState.getState();
  for (const id of ['growth_sortie_slot', 'growth_defense_slot', 'growth_forecast_clarity'] as const) {
    assert.equal(growthSystem.purchase(id), 0);
  }
  assert.deepEqual(gameState.getState(), initialGame);
  assert.equal(purchaseEvents, 0);
  assert.equal(kindlingEvents, 0);

  growthSystem.recordReturn(noFacts);
  assert.deepEqual(growthSystem.getState().progression, emptyProgression);
  growthSystem.recordReturn({ ...noFacts, impactOccurred: true });
  assert.equal(growthSystem.getAvailability('growth_forecast_clarity').unlocked, true);
  assert.equal(growthSystem.getAvailability('growth_defense_slot').unlocked, false);
  assert.equal(growthSystem.getAvailability('growth_sortie_slot').unlocked, false);
  growthSystem.recordReturn({ ...noFacts, offeringCompleted: true });
  growthSystem.recordReturn({ ...noFacts, toolRevealed: true });
  growthSystem.recordReturn({ ...noFacts, leftFiniteCrest: true });
  const allFacts = growthSystem.getState();
  growthSystem.recordReturn(noFacts);
  growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: true, toolRevealed: true, leftFiniteCrest: true });
  assert.deepEqual(growthSystem.getState(), allFacts);
  assert.deepEqual(gameState.getState(), initialGame);
  assert.equal(purchaseEvents, 0);
  assert.equal(kindlingEvents, 0);
  assert.equal(stabilityEvents, 0);
  const detached = growthSystem.getState();
  detached.progression!.toolRevealed = false;
  detached.upgrades.growth_vitality = 4;
  assert.deepEqual(growthSystem.getState(), allFacts);
  growthSystem.reset();
  growthSystem.loadState(JSON.parse(JSON.stringify(allFacts)) as GrowthState);
  assert.deepEqual(growthSystem.getState(), allFacts);
  console.log('PASS locked direct purchases are inert; return facts OR, serialize and clone without rewards or events');

  reset();
  const invalidFacts = { impactOccurred: 'true', offeringCompleted: 1, toolRevealed: [], leftFiniteCrest: {} };
  growthSystem.recordReturn(invalidFacts as unknown as GrowthReturnFacts);
  assert.deepEqual(growthSystem.getState().progression, emptyProgression);
  assert(validateGrowthProgressionState(undefined));
  assert(validateGrowthProgressionState({ version: 1 }));
  assert(validateGrowthProgressionState({ version: 1, offeringCompleted: true }));
  for (const malformed of [null, [], 'true', 1, true, {}, { version: 2, toolRevealed: true },
    ...['impactExperienced', 'offeringCompleted', 'toolRevealed', 'crestExperienced'].flatMap(key =>
      ['true', 1, null, [], {}].map(value => ({ ...emptyProgression, [key]: value })))]) {
    assert.equal(validateGrowthProgressionState(malformed), false);
    loadProgression(malformed);
    assert.deepEqual(growthSystem.getState().progression, emptyProgression);
    assert.equal(growthSystem.getAvailability('growth_sortie_slot').unlocked, false);
  }
  loadProgression({ version: 1, offeringCompleted: true });
  assert.deepEqual(growthSystem.getState().progression, { ...emptyProgression, offeringCompleted: true });
  assert.equal(growthSystem.getAvailability('growth_defense_slot').unlocked, true);
  assert.equal(growthSystem.getAvailability('growth_sortie_slot').unlocked, false);
  assert.equal(growthSystem.getAvailability('growth_forecast_clarity').unlocked, false);
  console.log('PASS partial saves retain only explicit boolean facts; malformed and future records never unlock upgrades');

  reset();
  growthSystem.recordReturn({ ...noFacts, impactOccurred: true });
  assert.equal(growthSystem.canAfford('growth_forecast_clarity', 9), false);
  assert.equal(growthSystem.purchase('growth_forecast_clarity'), 10);
  assert.equal(growthSystem.getModifiers().forecastClarity, 1);
  assert.deepEqual(growthSystem.getAvailability('growth_forecast_clarity'),
    { visible: true, unlocked: false, reason: 'offeringCompleted', nextLevel: 2 });
  assert.equal(growthSystem.purchase('growth_forecast_clarity'), 0);
  growthSystem.recordReturn({ ...noFacts, offeringCompleted: true });
  assert.equal(growthSystem.purchase('growth_forecast_clarity'), 20);
  assert.equal(growthSystem.getModifiers().forecastClarity, 2);
  assert.equal(growthSystem.getAvailability('growth_forecast_clarity').reason, 'crestExperienced');
  assert.equal(growthSystem.purchase('growth_forecast_clarity'), 0);
  growthSystem.recordReturn({ ...noFacts, leftFiniteCrest: true });
  assert.equal(growthSystem.purchase('growth_forecast_clarity'), 30);
  assert.deepEqual(growthSystem.getAvailability('growth_forecast_clarity'),
    { visible: true, unlocked: false, reason: null, nextLevel: null });
  assert.equal(growthSystem.getModifiers().forecastClarity, 3);
  assert.equal(growthSystem.getCost('growth_forecast_clarity'), Infinity);
  assert.equal(growthSystem.canAfford('growth_forecast_clarity', 1000), false);
  assert.equal(growthSystem.purchase('growth_forecast_clarity'), 0);
  assert.equal(gameState.getKindlingReserve(), 940);
  console.log('PASS forecast layers charge 10/20/30 once, require their own facts and stop at the purchased cap');

  reset();
  const oldSave = growthSystem.getState();
  delete oldSave.progression;
  for (const id of growthSystem.getAllUpgradeIds()) oldSave.upgrades[id] = growthSystem.getMaxLevel(id);
  growthSystem.loadState(oldSave);
  assert.deepEqual(growthSystem.getState().progression, emptyProgression);
  assert.deepEqual(growthSystem.getModifiers(), { chaosResist: 0.2, kindlingAffinity: 3, vitalityBonus: 60, forecastClarity: 3 });
  assert.equal(growthSystem.getSortieSlotBonus(), 1);
  assert.equal(growthSystem.getDefenseSlotBonus(), 1);
  for (const id of growthSystem.getAllUpgradeIds()) assert.equal(growthSystem.getAvailability(id).visible, true);
  oldSave.upgrades.growth_forecast_clarity = 1;
  growthSystem.loadState(oldSave);
  assert.deepEqual(growthSystem.getAvailability('growth_forecast_clarity'),
    { visible: true, unlocked: false, reason: 'offeringCompleted', nextLevel: 2 });
  growthSystem.recordReturn({ ...noFacts, offeringCompleted: true });
  assert.equal(growthSystem.purchase('growth_forecast_clarity'), 20);
  assert.equal(growthSystem.getModifiers().forecastClarity, 2);
  assert.equal(growthSystem.getState().progression!.impactExperienced, false);
  growthSystem.reset();
  assert.deepEqual(growthSystem.getState().progression, emptyProgression);
  assert(growthSystem.getAllUpgradeIds().every(id => growthSystem.getLevel(id) === 0));
  console.log('PASS purchased old-save effects and visibility survive missing facts; only the next layer is gated');
} finally {
  eventBus.off(GameEvent.GROWTH_PURCHASED, onPurchase);
  eventBus.off(GameEvent.KINDLING_COLLECTED, onKindling);
  eventBus.off(GameEvent.STABILITY_CHANGED, onStability);
  growthSystem.reset();
  gameState.reset();
}
