/** I29: durable, reward-free experience records and authored-route qualification. */
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
function reset(): void { growthSystem.reset(); gameState.reset(); gameState.addKindling(1000); }
function loadProgression(progression: unknown): void {
  growthSystem.loadState({ ...growthSystem.getState(), progression } as GrowthState);
}
reset();
const expectedCosts: Record<GrowthUpgradeId, readonly number[]> = {
  growth_chaos_resist: [10, 17, 23, 33, 38], growth_kindling_affinity: [9, 13, 24],
  growth_vitality: [8, 12, 19, 30], growth_sortie_slot: [18],
  growth_defense_slot: [9, 16, 28], growth_forecast_clarity: [11, 14, 26],
};
for (const id of growthSystem.getAllUpgradeIds()) {
  assert.equal(growthSystem.getUpgradeDefinition(id), UPGRADE_DATA[id]);
  assert.deepEqual(UPGRADE_DATA[id].costs, expectedCosts[id]);
  assert.equal(growthSystem.getAvailability(id).unlocked, id === 'growth_vitality');
  assert.equal(growthSystem.getAvailability(id).visible, id === 'growth_vitality');
}
assert.equal(UPGRADE_DATA.growth_forecast_clarity.effectPerLevel, 1);
assert.equal(UPGRADE_DATA.growth_forecast_clarity.effectUnit, '信息层');
console.log('PASS six CSV axes project authored route prices; only the authored first step is public and purchasable');

let notifications = 0;
const onNotification = (): void => { notifications++; };
for (const event of [GameEvent.GROWTH_PURCHASED, GameEvent.KINDLING_COLLECTED, GameEvent.STABILITY_CHANGED]) {
  eventBus.on(event, onNotification);
}
try {
  const initialGame = gameState.getState();
  for (const id of ['growth_sortie_slot', 'growth_defense_slot', 'growth_forecast_clarity'] as const) {
    assert.equal(growthSystem.purchase(id), 0);
  }
  growthSystem.recordReturn(noFacts);
  assert.deepEqual(growthSystem.getState().progression, emptyProgression);
  growthSystem.recordReturn({ ...noFacts, impactOccurred: true });
  growthSystem.recordReturn({ ...noFacts, offeringCompleted: true });
  growthSystem.recordReturn({ ...noFacts, toolRevealed: true });
  growthSystem.recordReturn({ ...noFacts, leftFiniteCrest: true });
  const allFacts = growthSystem.getState();
  growthSystem.recordReturn(noFacts);
  growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: true, toolRevealed: true, leftFiniteCrest: true });
  assert.deepEqual(growthSystem.getState(), allFacts);
  assert.deepEqual(gameState.getState(), initialGame);
  assert.equal(notifications, 0);
  const detached = growthSystem.getState();
  detached.progression!.toolRevealed = false;
  detached.upgrades.growth_vitality = 4;
  assert.deepEqual(growthSystem.getState(), allFacts);
  growthSystem.reset();
  growthSystem.loadState(JSON.parse(JSON.stringify(allFacts)) as GrowthState);
  assert.deepEqual(growthSystem.getState(), allFacts);
  console.log('PASS locked purchases are inert; return facts OR, clone and serialize without rewards or events');

  reset();
  growthSystem.recordReturn({ impactOccurred: 'true', offeringCompleted: 1, toolRevealed: [], leftFiniteCrest: {} } as unknown as GrowthReturnFacts);
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
  }
  loadProgression({ version: 1, offeringCompleted: true });
  assert.deepEqual(growthSystem.getState().progression, { ...emptyProgression, offeringCompleted: true });
  assert.equal(growthSystem.getNextStep()?.id, 'growth_vitality');
  console.log('PASS malformed/future records never grant experience; historical offering facts do not bypass the route');

  reset();
  const oldSave = growthSystem.getState();
  delete oldSave.schemaVersion;
  delete oldSave.progression;
  for (const id of growthSystem.getAllUpgradeIds()) oldSave.upgrades[id] = growthSystem.getMaxLevel(id);
  oldSave.upgrades.growth_defense_slot = 1;
  growthSystem.loadState(oldSave);
  assert.deepEqual(growthSystem.getModifiers(), { chaosResist: 0.2, kindlingAffinity: 3, vitalityBonus: 60, forecastClarity: 3 });
  assert.equal(growthSystem.getSortieSlotBonus(), 1);
  assert.equal(growthSystem.getDefenseSlotBonus(), 3);
  assert.deepEqual(growthSystem.getState().progression, emptyProgression);
  assert.equal(growthSystem.getState().schemaVersion, 2);
  assert.equal(growthSystem.getNextStep()?.id, 'thicken');
  const migrated = growthSystem.getState();
  growthSystem.loadState(migrated);
  assert.deepEqual(growthSystem.getState(), migrated);
  assert.equal(growthSystem.getRouteProgress().completed, 19);
  growthSystem.reset();
  assert(growthSystem.getAllUpgradeIds().every(id => growthSystem.getLevel(id) === 0));
  console.log('PASS old purchased effects survive missing facts and normalize capacity once; reset starts at zero');
} finally {
  for (const event of [GameEvent.GROWTH_PURCHASED, GameEvent.KINDLING_COLLECTED, GameEvent.STABILITY_CHANGED]) {
    eventBus.off(event, onNotification);
  }
  growthSystem.reset(); gameState.reset();
}
