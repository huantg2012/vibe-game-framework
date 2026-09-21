/** I29 R02: exercise real purchase, persistence, legacy repair and departure. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { eventBus } from '../../src/core/event-bus';
import { gameState } from '../../src/managers/game-state';
import { purchaseGrowth } from '../../src/managers/growth-purchases';
import { saveManager } from '../../src/managers/save-manager';
import { createCatalogContaminant } from '../../src/systems/contaminant-catalog';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';
import { GameEvent } from '../../src/types/events';
import type { Contaminant, SaveDataV2 } from '../../src/types/game-types';

const records = new Map<string, string>();
const key = GAME_CONSTANTS.SAVE.KEY;
let failWrites = false;
let primaryWrites = 0;
const checks: string[] = [];
saveManager.setStorage({
  getItem: id => records.get(id) ?? null,
  removeItem: id => { records.delete(id); },
  setItem: (id, value) => {
    if (failWrites) throw new Error('simulated quota');
    if (id === key) primaryWrites++;
    records.set(id, value);
  },
});
function check(name: string, run: () => void): void {
  run(); checks.push(name); console.log(`PASS ${name}`);
}
function snapshot() {
  return { game: gameState.getState(), growth: growthSystem.getState(), inventory: inventoryStore.getState(),
    stability: stabilityTracker.getState(), forecast: impactSystem.getForecastState() };
}
function saved(): SaveDataV2 { return JSON.parse(records.get(key)!) as SaveDataV2; }
function reset(passive = true): void {
  failWrites = false;
  saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); contaminantSystem.reset();
  // Controlled prior return evidence; qualification itself has its own C1 gate.
  growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: true, toolRevealed: true, leftFiniteCrest: false });
  tideSystem.reset(); stabilityTracker.reset(); impactSystem.resetForecastState();
  gameState.addKindling(1000);
  // This suite targets the expansion transaction after the prior authored route nodes.
  while (growthSystem.getNextStep()?.id !== 'growth_sortie_slot') {
    const step = growthSystem.getNextStep();
    assert(step && purchaseGrowth(step.id).ok);
  }
  gameState.spendKindling(gameState.getKindlingReserve() - 100);
  const tools: Contaminant[] = [
    { id: 'active-a', type: 'solidify', rarity: 'common', quality: 'ordinary', stage: 'tool', impactCharges: 3, usesRemaining: 2 },
    { id: 'active-b', type: 'delay', rarity: 'common', quality: 'ordinary', stage: 'tool', impactCharges: 3, usesRemaining: 1 },
    ...(passive ? [{ id: 'passive', type: 'muffle', rarity: 'common', quality: 'ordinary', stage: 'tool', impactCharges: 4, usesRemaining: 2 } satisfies Contaminant] : []),
  ];
  for (const [slot, tool] of tools.entries()) {
    assert(inventoryStore.addContaminant(tool).ok);
    assert(inventoryStore.prepareTool(tool.id, slot).ok);
  }
  assert(saveManager.trySave());
}
function simulateOldExpandedRecord(): void {
  const growth = growthSystem.getState(); growth.upgrades.growth_sortie_slot = 1;
  growthSystem.loadState(growth);
  assert(saveManager.trySave());
  assert.equal(saved().inventory.equipment.toolIds[2], 'passive');
}

check('purchase moves the existing passive, preserves every item and saves one complete record before notification', () => {
  reset();
  const before = snapshot();
  let observations = 0;
  const unsubscribe = inventoryStore.subscribe(() => {
    observations++;
    assert.deepEqual(saved().inventory, inventoryStore.getState());
    assert.equal(saved().growth.upgrades.growth_sortie_slot, 1);
  });
  const writes = primaryWrites;
  assert.deepEqual(purchaseGrowth('growth_sortie_slot'), { ok: true, spent: 40, newLevel: 1 });
  unsubscribe();
  assert.equal(primaryWrites, writes + 1);
  assert.equal(observations, 1);
  assert.deepEqual(inventoryStore.getEquipment().toolIds, ['active-a', 'active-b', null, 'passive']);
  assert.deepEqual(inventoryStore.getState().items, before.inventory.items);
  assert.equal(gameState.getKindlingReserve(), before.game.kindlingReserve - 40);
  assert.equal(stabilityTracker.getProgress(), before.stability.progress + 1);
  const bought = snapshot();
  assert(saveManager.load()); assert.deepEqual(snapshot(), bought);
  assert(inventoryStore.beginRun('expanded-with-passive').ok);
  assert.equal(inventoryStore.getItem('passive')?.kind === 'contaminant'
    && inventoryStore.getContaminants().find(item => item.id === 'passive')?.usesRemaining, 2);
});

check('empty passive slot remains empty, active tools stay in place and the new active slot can be used', () => {
  reset(false);
  const before = inventoryStore.getState().items;
  assert(purchaseGrowth('growth_sortie_slot').ok);
  assert.deepEqual(inventoryStore.getState().items, before);
  assert.deepEqual(inventoryStore.getEquipment().toolIds, ['active-a', 'active-b', null, null]);
  assert.equal(inventoryStore.getEquipment().toolIds[3] ?? null, null);
  assert(inventoryStore.addContaminant({ id: 'active-c', type: 'solidify', rarity: 'common',
    quality: 'ordinary', stage: 'tool', impactCharges: 3, usesRemaining: 1 }).ok);
  assert(inventoryStore.prepareTool('active-c', 2).ok);
  assert(inventoryStore.beginRun('expanded-empty-passive').ok);
});

check('rejected storage restores slots, resources, growth, stability, forecast and original item references', () => {
  reset();
  const before = snapshot(), bytes = records.get(key), writes = primaryWrites;
  const reference = inventoryStore.getContaminants().find(item => item.id === 'passive');
  let purchases = 0, stability = 0;
  const onPurchase = () => { purchases++; };
  const onStability = () => { stability++; };
  eventBus.on(GameEvent.GROWTH_PURCHASED, onPurchase);
  eventBus.on(GameEvent.STABILITY_CHANGED, onStability);
  const unsubscribe = inventoryStore.subscribe(() => assert.deepEqual(snapshot(), before));
  failWrites = true;
  assert.deepEqual(purchaseGrowth('growth_sortie_slot'), { ok: false, reason: 'storage-failed' });
  unsubscribe();
  assert.deepEqual(snapshot(), before); assert.equal(records.get(key), bytes);
  assert.equal(primaryWrites, writes); assert.equal(purchases, 0); assert.equal(stability, 0);
  assert.equal(inventoryStore.hasFrameTransaction(), false);
  assert.equal(inventoryStore.getContaminants().find(item => item.id === 'passive'), reference);
  failWrites = false;
  assert(purchaseGrowth('growth_sortie_slot').ok);
  assert.equal(purchases, 1); assert.equal(stability, 1);
  eventBus.off(GameEvent.GROWTH_PURCHASED, onPurchase);
  eventBus.off(GameEvent.STABILITY_CHANGED, onStability);
  assert(inventoryStore.beginRun('retry-expanded').ok);
});

check('insufficient funds and maxed purchases leave inventory and all base state unchanged', () => {
  reset(); gameState.spendKindling(gameState.getKindlingReserve()); assert(saveManager.trySave());
  let before = snapshot();
  assert.deepEqual(purchaseGrowth('growth_sortie_slot'), { ok: false, reason: 'unavailable' });
  assert.deepEqual(snapshot(), before);
  gameState.addKindling(100); assert(purchaseGrowth('growth_sortie_slot').ok); before = snapshot();
  assert.deepEqual(purchaseGrowth('growth_sortie_slot'), { ok: false, reason: 'unavailable' });
  assert.deepEqual(snapshot(), before);
});

check('occupied destination fails without displacing either item or partially buying the upgrade', () => {
  reset();
  const extra: Contaminant = { id: 'other-passive', type: 'muffle', rarity: 'common', quality: 'ordinary',
    stage: 'tool', impactCharges: 3, usesRemaining: 1 };
  assert(inventoryStore.addContaminant(extra).ok);
  const conflicting = inventoryStore.getState();
  conflicting.equipment.toolIds[3] = extra.id;
  conflicting.items.find(item => item.id === extra.id)!.location = { kind: 'carried' };
  assert(inventoryStore.loadState(conflicting)); assert(saveManager.trySave());
  const before = snapshot(), bytes = records.get(key);
  assert.deepEqual(purchaseGrowth('growth_sortie_slot'), { ok: false, reason: 'unavailable' });
  assert.deepEqual(snapshot(), before); assert.equal(records.get(key), bytes);
});

check('catalog whole-run passive keeps identity and uses during purchase, then consumes exactly once on real departure', () => {
  reset(false);
  const passive = createCatalogContaminant({ id: 'catalog-passive', definitionId: 'reverse_woven_basket',
    appearanceId: 'wax_parcel', offeringProfileId: 'resist_35', quality: 'ordinary', acquiredOrdinal: 0 });
  assert(inventoryStore.addContaminant(passive).ok);
  assert(inventoryStore.slotOffering(passive.id, 0).ok);
  assert(inventoryStore.finishOfferingImpact([passive.id], 3, {}, 'slot-test-offering').ok);
  assert(inventoryStore.prepareTool(passive.id, 2).ok);
  const before = inventoryStore.getState().items;
  assert(purchaseGrowth('growth_sortie_slot').ok);
  assert.deepEqual(inventoryStore.getState().items, before);
  const uses = inventoryStore.getContaminants().find(item => item.id === passive.id)!.usesRemaining;
  assert(inventoryStore.beginRun('catalog-slot-run', { catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 }).ok);
  assert.equal(inventoryStore.getContaminants().find(item => item.id === passive.id)!.usesRemaining, uses - 1);
  const departed = inventoryStore.getState();
  assert(saveManager.load()); assert.deepEqual(inventoryStore.getState(), departed);
  assert.equal(inventoryStore.getCapacity(), 240);
});

check('old expanded base records repair once, preserve item payloads and can depart after repeated reload', () => {
  reset(); simulateOldExpandedRecord();
  const items = inventoryStore.getState().items, writes = primaryWrites;
  assert(saveManager.load());
  assert.equal(primaryWrites, writes + 1);
  assert.deepEqual(inventoryStore.getEquipment().toolIds, ['active-a', 'active-b', null, 'passive']);
  assert.deepEqual(inventoryStore.getState().items, items);
  const repaired = records.get(key);
  assert(saveManager.load()); assert.equal(primaryWrites, writes + 1); assert.equal(records.get(key), repaired);
  assert(inventoryStore.beginRun('repaired-base-run').ok);
});

check('old-record repair remains usable after a rejected migration write and retry never replenishes items', () => {
  reset(); simulateOldExpandedRecord();
  const bytes = records.get(key), items = inventoryStore.getState().items;
  failWrites = true; assert(saveManager.load()); assert.equal(records.get(key), bytes);
  assert.deepEqual(inventoryStore.getState().items, items);
  assert.equal(inventoryStore.getEquipment().toolIds[3], 'passive');
  failWrites = false; assert(saveManager.trySave()); assert(saveManager.load());
  assert.deepEqual(inventoryStore.getState().items, items);
  assert(inventoryStore.beginRun('repaired-after-quota').ok);
});

check('active and unfinished-return records keep original equipment and bytes unchanged', () => {
  for (const finish of [false, true]) {
    reset(); assert(inventoryStore.beginRun(`old-active-${finish}`).ok);
    if (finish) assert(inventoryStore.settleRun(`old-active-${finish}`, 'extract').ok);
    simulateOldExpandedRecord();
    const before = snapshot(), bytes = records.get(key), writes = primaryWrites;
    assert(saveManager.load()); assert.deepEqual(snapshot(), before);
    assert.equal(records.get(key), bytes); assert.equal(primaryWrites, writes);
  }
});

const out = process.argv[2] ?? 'docs/qa/artifacts/iteration-29-r2/growth-slots-linear.json';
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, JSON.stringify({ iteration: 29, issue: 'R02', verifiedAt: new Date().toISOString(),
  result: 'PASS', method: 'isolated memory storage; real purchaseGrowth, InventoryStore, SaveManager and beginRun',
  checks, limitations: ['No player visual acceptance or browser input is claimed.'] }, null, 2) + '\n');
inventoryStore.setPersistence(null);
console.log(`${checks.length} growth slot checks passed; ${out}`);
