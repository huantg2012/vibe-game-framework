import assert from 'node:assert/strict';
import { InventoryStore } from '../../src/systems/inventory-store';
import type { Contaminant } from '../../src/types/game-types';
import type { NewInventoryItem } from '../../src/types/inventory-types';

const c = (id: string, tool = false): Contaminant => ({ id, type: 'solidify', rarity: 'common', stage: tool ? 'tool' : 'defense', impactCharges: 0, usesRemaining: 2 });
const loot = (id: string): NewInventoryItem => ({ id, kind: 'contaminant', contaminant: c(id) });
function store(capacity = 160): InventoryStore {
  const result = new InventoryStore();
  result.configure({ capacity, contaminantWeight: 20, starterDefinitionId: 'crowbar_plain', weaponDefinition: id => id === 'crowbar_plain' ? { id, weight: 30 } : undefined, isPassiveTool: () => false, toolSlotCount: () => 3 });
  assert.equal(result.ensureStarter().ok, true);
  return result;
}
let checks = 0;
function check(name: string, fn: () => void): void { fn(); checks++; console.log(`PASS ${name}`); }
check('starter is unique and equipped weight counts once', () => {
  const s = store(); const id = s.getEquipment().weaponId;
  s.ensureStarter(); assert.equal(s.getItems().length, 1); assert.equal(s.getCarryWeight(), 30); assert.equal(s.getEquipment().weaponId, id);
});
check('mixed batch takes all or leaves all; reveal cannot reroll', () => {
  const s = store(60); s.beginRun('r');
  assert.deepEqual(s.revealBatch('n', [loot('a'), loot('b')], { x: 4, y: 8 }), { ok: true, value: { ids: ['a', 'b'], taken: false } });
  assert.equal(s.getCarryWeight(), 30);
  const repeat = s.revealBatch('n', [loot('new')], { x: 100, y: 100 });
  assert.equal(repeat.ok, true); assert.equal(s.getItem('new'), undefined); assert.equal(s.getItems().length, 3);
  assert.equal(s.take(['a'], () => true).ok, true); assert.equal(s.take(['b'], () => true).ok, false);
});
check('exchange atomic, equipped drop forbidden, ground ownership reversible', () => {
  const s = store(70); s.beginRun('r'); s.revealBatch('n', [loot('a'), loot('b'), loot('c')], { x: 0, y: 0 });
  s.take(['a', 'b'], () => true);
  const before = s.getState();
  assert.equal(s.exchange(['c'], ['a'], { x: 3, y: 4 }, { canTake: () => true, canDrop: () => false }).ok, false);
  assert.deepEqual(s.getState(), before);
  assert.equal(s.drop([s.getEquipment().weaponId!], { x: 1, y: 1 }, () => true).ok, false);
  assert.equal(s.exchange(['c'], ['a'], { x: 3, y: 4 }, { canTake: () => true, canDrop: () => true }).ok, true);
  assert.equal(s.getItem('a')?.location.kind, 'ground'); assert.equal(s.getCarryWeight(), 70);
  s.drop(['c'], { x: 3, y: 4 }, () => true); s.take(['a'], () => true); assert.equal(s.getCarryWeight(), 70);
});
check('write failure rolls back ownership and tool consumption, no notifications', () => {
  const s = store(); s.addContaminant(c('tool', true)); s.prepareTool('tool', 0); s.beginRun('r');
  let events = 0; s.subscribe(() => events++);
  const before = s.getState(); s.setPersistence(() => { throw new Error('quota'); });
  assert.deepEqual(s.consumeTool('tool'), { ok: false, error: 'storage-failed' });
  assert.equal(s.revealBatch('n', [loot('a')], { x: 0, y: 0 }).ok, false); assert.deepEqual(s.getState(), before); assert.equal(events, 0);
});
check('tool identity stays live, final use clears references and burden', () => {
  const s = store(); s.addContaminant(c('tool', true)); s.prepareTool('tool', 0); const ref = s.getContaminants()[0]!; s.beginRun('r');
  s.consumeTool('tool'); assert.equal(ref.usesRemaining, 1); assert.equal(s.getContaminants()[0], ref);
  s.consumeTool('tool'); assert.equal(ref.usesRemaining, 0); assert.equal(ref.stage, 'broken'); assert.equal(s.getItem('tool'), undefined); assert.equal(s.getEquipment().toolIds[0], null); assert.equal(s.getCarryWeight(), 30);
});
check('death loses every carried item, preserves stash and defense, is idempotent', () => {
  const s = store(); s.addContaminant(c('stash')); s.addContaminant(c('def')); s.slotDefense('def', 0); s.beginRun('r'); s.revealBatch('n', [loot('new')], { x: 0, y: 0 });
  s.settleRun('r', 'death'); assert.deepEqual(s.getItems().map(i => i.id).sort(), ['def', 'stash']); assert.equal(s.getEquipment().weaponId, null);
  const before = s.getState(); s.settleRun('r', 'extract'); assert.deepEqual(s.getState(), before); s.ensureStarter(); assert.equal(s.getItems().length, 3);
});
check('extraction returns only final loot; legacy migration preserves IDs/uses/slots', () => {
  const s = store(); s.importLegacy([c('old', true), c('def'), c('stash')], ['def', null, null], ['old', null, null]); s.ensureStarter();
  assert.equal(s.getItem('old')?.kind, 'contaminant'); assert.equal(s.getItem('def')?.location.kind, 'defense'); assert.equal(s.getEquipment().toolIds[0], 'old');
  s.beginRun('r'); s.revealBatch('n', [loot('a'), loot('b')], { x: 0, y: 0 }); s.drop(['b'], { x: 0, y: 0 }, () => true);
  assert.deepEqual(s.settleRun('r', 'extract'), { ok: true, value: { returnedIds: ['a'] } }); assert.equal(s.getItem('a')?.location.kind, 'stash'); assert.equal(s.getItem('b'), undefined);
  const other = store(); assert.equal(other.loadState(s.getState()), true); assert.deepEqual(other.getState(), s.getState());
});
check('interrupted load is inert until explicit recovery policy', () => {
  const s = store(); s.beginRun('r'); s.revealBatch('n', [loot('a')], { x: 0, y: 0 });
  const other = store(); other.loadState(s.getState()); assert.equal(other.getRun()?.status, 'active'); assert.equal(other.getItem('a')?.location.kind, 'carried');
  other.recoverInterruptedRun('keep-carried-out'); assert.equal(other.getItem('a'), undefined); assert.equal(other.getItems().length, 1);
});

check('invalid nested save leaves the active state untouched', () => {
  const s = store(); const before = s.getState(); const invalid = s.getState();
  invalid.equipment.toolIds = [invalid.equipment.weaponId];
  assert.equal(s.loadState(invalid), false); assert.deepEqual(s.getState(), before);
});

console.log(`${checks} inventory contract checks passed.`);
