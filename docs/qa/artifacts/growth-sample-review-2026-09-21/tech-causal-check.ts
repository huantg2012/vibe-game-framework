/** Read-only review harness: production systems with memory-only saves, no production edits. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { GAME_CONSTANTS } from '../../../../src/config/constants';
import { GROWTH_ROUTE_DATA } from '../../../../src/generated/growth-route-data';
import { gameState } from '../../../../src/managers/game-state';
import { purchaseGrowth } from '../../../../src/managers/growth-purchases';
import { saveManager } from '../../../../src/managers/save-manager';
import { ChaosSystem } from '../../../../src/systems/chaos-system';
import { contaminantSystem } from '../../../../src/systems/contaminant-system';
import { createWeaponInstance } from '../../../../src/systems/equipment-lifecycle';
import { growthSystem } from '../../../../src/systems/growth-system';
import { impactSystem } from '../../../../src/systems/impact-system';
import { inventoryStore } from '../../../../src/systems/inventory-store';
import { stabilityTracker } from '../../../../src/systems/stability-tracker';
import { tideSystem } from '../../../../src/systems/tide-system';
import type { SaveDataV2 } from '../../../../src/types/game-types';

const output = 'docs/qa/artifacts/growth-sample-review-2026-09-21/tech-causal-results.json';
const records = new Map<string, string>();
saveManager.setStorage({ getItem: key => records.get(key) ?? null,
  removeItem: key => { records.delete(key); }, setItem: (key, value) => { records.set(key, value); } });
function reset(): void {
  inventoryStore.setPersistence(null); saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); contaminantSystem.reset();
  tideSystem.reset(); impactSystem.resetForecastState(); stabilityTracker.reset();
}
const close = (a: number, b: number): void => assert(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
function sampleChaos(equippedResistance: number) {
  const moduleRate = gameState.getSortieModifiers().chaosRateModifier;
  const growth = growthSystem.getModifiers();
  // This is the exact composition used by RiftScene.create, not an alternative formula.
  const chaos = new ChaosSystem({ chaosRateModifier: moduleRate * (1 - growth.chaosResist),
    startingValue: 0, getPollutionResistance: () => equippedResistance });
  const perSecond = chaos.getRate();
  chaos.addChaos('review-field-contact', 10);
  const discreteTen = chaos.getValue();
  chaos.reset(0); for (let i = 0; i < 10; i++) chaos.update(100);
  close(chaos.getValue(), perSecond);
  chaos.destroy();
  return { equippedResistance, moduleRate, permanentRateReduction: growth.chaosResist,
    timeOneSecond: perSecond, discreteTen, previewModuleReductionPercent: (1 - moduleRate) * 100 };
}

reset(); gameState.addKindling(1000);
growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: false, toolRevealed: false, leftFiniteCrest: true });
const resistance: unknown[] = [{ level: 0, samples: [0, 40, 60].map(sampleChaos) }];
const purchases: unknown[] = [];
for (const row of GROWTH_ROUTE_DATA) {
  const expected = growthSystem.getNextStep(); assert(expected);
  const bought = purchaseGrowth(expected.id); assert(bought.ok);
  const after = growthSystem.getState(); assert(saveManager.load()); assert.deepEqual(growthSystem.getState(), after);
  purchases.push({ order: row.order, id: expected.id, level: bought.newLevel, spent: bought.spent,
    nextId: growthSystem.getNextStep()?.id ?? null, maxHealth: 100 + growthSystem.getModifiers().vitalityBonus,
    affinity: growthSystem.getModifiers().kindlingAffinity,
    offeringCapacity: contaminantSystem.getDefenseSlotCount(), activeSlots: contaminantSystem.getSortieActiveSlotCount() });
  if (row.unit === 'growth_chaos_resist') resistance.push({ level: row.level, samples: [0, 40, 60].map(sampleChaos) });
}
close(gameState.getKindlingReserve(), 572);

const throughput: unknown[] = [];
for (let bonus = 0; bonus < 4; bonus++) {
  reset(); const growth = growthSystem.getState(); growth.upgrades.growth_defense_slot = bonus; growthSystem.loadState(growth);
  // Controlled equal supply and maturity: intentionally not a claim about natural drops.
  const state = inventoryStore.getState();
  for (let slot = 0; slot <= bonus; slot++) {
    const id = `review-offer-${slot}`;
    state.items.push({ id, kind: 'weapon', weapon: createWeaponInstance('crowbar_plain', false, id), location: { kind: 'defense', slot } });
    state.equipment.defenseIds[slot] = id;
  }
  assert(inventoryStore.loadState(state));
  const impacts: unknown[] = [];
  for (let turn = 1; turn <= 3; turn++) {
    const ids = inventoryStore.getOfferingItems().map(item => item?.id ?? null);
    const result = contaminantSystem.finishOfferingImpact(false, {}, ids, `review-${bonus}-${turn}`); assert(result.ok);
    impacts.push({ turn, transformed: result.value.length,
      charges: state.items.filter(item => item.id.startsWith('review-offer')).map(item => {
        const live = inventoryStore.getItem(item.id); return live?.kind === 'weapon' ? live.weapon.impactCharges : null;
      }), filled: inventoryStore.getOfferingItems().filter(Boolean).length });
  }
  const matured = inventoryStore.getItems().filter(item => item.kind === 'weapon' && item.id.startsWith('review-offer') && item.weapon.stage === 'tool').length;
  assert.equal(matured, bonus + 1);
  throughput.push({ capacity: bonus + 1, impacts, matured });
}

reset(); assert(saveManager.trySave());
const invalid: SaveDataV2 = JSON.parse(records.get(GAME_CONSTANTS.SAVE.KEY)!);
invalid.inventory.items.push({ id: 'review-hidden', kind: 'weapon',
  weapon: createWeaponInstance('crowbar_plain', false, 'review-hidden'), location: { kind: 'defense', slot: 3 } });
invalid.inventory.equipment.defenseIds = [null, null, null, 'review-hidden'];
records.set(GAME_CONSTANTS.SAVE.KEY, JSON.stringify(invalid));
const accepted = saveManager.load();
const offeringOverflow = { method: 'hand-constructed malformed schema-2 base record; not reachable through normal slotOffering',
  accepted, schema: invalid.growth.schemaVersion, level: invalid.growth.upgrades.growth_defense_slot,
  effectiveCapacity: contaminantSystem.getDefenseSlotCount(),
  visibleIds: inventoryStore.getOfferingItems().map(item => item?.id ?? null),
  retainedItem: inventoryStore.getItem('review-hidden'),
  removeViaSlot: inventoryStore.slotOffering(null, 3), discardViaBase: inventoryStore.discardAtBase('review-hidden') };
assert(accepted); assert.equal(offeringOverflow.effectiveCapacity, 1);
assert(!offeringOverflow.visibleIds.includes('review-hidden'));
assert(!offeringOverflow.removeViaSlot.ok); assert(!offeringOverflow.discardViaBase.ok);

const sources = ['src/systems/growth-system.ts', 'src/systems/chaos-system.ts', 'src/scenes/rift-scene.ts',
  'src/systems/inventory-store.ts', 'src/managers/save-manager.ts', 'src/managers/growth-purchases.ts',
  'src/config/growth-upgrade-display.ts', 'src/ui/dom/loadout-panel.ts', 'data/upgrades.csv', 'data/growth-route.csv',
  'docs/design-notes/purification-growth-renewal.md', 'docs/specs/system-growth-tide.md', 'docs/specs/system-survival-attributes.md'];
writeFileSync(output, JSON.stringify({ reviewedAt: new Date().toISOString(), baseCommit: '7a6752379198e2b5296a7b387bd8915dcd4ea144',
  method: 'production domain systems; memory-only saves; Phaser rendering not exercised; facts and inventories preseeded',
  resistance, purchases, throughput, offeringOverflow,
  hashes: Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])) }, null, 2) + '\n');
inventoryStore.setPersistence(null);
console.log(`Review evidence written: ${output}`);
