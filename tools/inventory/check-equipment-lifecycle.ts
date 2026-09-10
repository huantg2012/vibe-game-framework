import assert from 'node:assert/strict';
import { InventoryStore } from '../../src/systems/inventory-store';
import { createWeaponInstance } from '../../src/systems/weapon-loot';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { applyDefenseEffects } from '../../src/systems/defense-engine';
import { getEquipmentLifecycle, type InventoryState, type InventoryItem } from '../../src/types/inventory-types';

function store(capacity = 160) {
  const s = new InventoryStore();
  s.configure({ capacity, starterDefinitionId: 'crowbar_plain', weaponDefinition: id => WEAPON_DATA[id],
    isPassiveTool: c => CONTAMINANT_DATA[c.type].toolType === 'passive' });
  return s;
}
const rawWeapon = (id: string): InventoryItem => ({ id, kind: 'weapon', weapon: createWeaponInstance('crowbar_good_standard', false, id), location: { kind: 'stash' } });
const baseState = (items: InventoryItem[]): InventoryState => ({ version: 2, items,
  equipment: { weaponId: null, toolIds: [null, null, null], defenseIds: [null, null, null] },
  run: null, starterGranted: true, firstWeaponDiscovered: true });
{
  const s = store(); assert(s.loadState(baseState([rawWeapon('w')])));
  assert.equal(s.prepareWeapon('w').ok, false); assert(s.slotOffering('w', 0).ok);
  s.finishOfferingImpact(['w'], 1); assert.equal(getEquipmentLifecycle(s.getItem('w')!).impactCharges, 1);
  s.finishOfferingImpact(['w'], 1); assert.equal(getEquipmentLifecycle(s.getItem('w')!).stage, 'defense');
  const result = s.finishOfferingImpact(['w'], 1); assert(result.ok);
  assert.equal(result.value[0]?.kind, 'weapon'); assert.equal(s.getOfferingItems()[0], null);
  assert.equal(getEquipmentLifecycle(s.getItem('w')!).usesRemaining, 75);
  assert(s.prepareWeapon('w').ok); assert(s.beginRun('r').ok);
  assert.equal(s.consumeEquipmentUse('w').ok, true); assert.equal(getEquipmentLifecycle(s.getItem('w')!).usesRemaining, 74);
}
{
  const s = store(); assert(s.loadState(baseState([rawWeapon('w')]))); s.slotOffering('w', 0);
  const before = s.getState(); s.setPersistence(() => { throw Error('quota'); });
  assert.equal(s.finishOfferingImpact(['w'], 3).ok, false); assert.deepEqual(s.getState(), before);
  s.setPersistence(null); assert(s.finishOfferingImpact(['w'], 3).ok);
}
{
  const s = store(); const erode: InventoryItem = { id: 'erode', kind: 'contaminant', location: { kind: 'stash' },
    contaminant: { id: 'erode', type: 'erode', rarity: 'fine', stage: 'defense', impactCharges: 2, usesRemaining: 0 } };
  assert(s.loadState(baseState([rawWeapon('w'), erode]))); s.slotOffering('w', 0); s.slotOffering('erode', 1);
  s.finishOfferingImpact(['w', null], 1);
  const payload = s.getItem('erode'); assert(payload?.kind === 'contaminant');
  const result = applyDefenseEffects({ CORE: 100 }, [null, payload.contaminant], {
    forecastTargetId: 'CORE', actualPrimaryId: 'CORE', stabilityProgress: 0, moduleHps: { CORE: 100 }, moduleMaxHps: { CORE: 100 },
  }, ['w', 'erode']);
  assert.equal(result.slotDisclosures.length, 1, 'weapon grants no invented defense effect');
  assert.equal(result.slotDisclosures[0]?.contaminantId, 'erode', 'threshold-crossing contaminant defended this impact');
  assert.equal(result.bonusCharges.w, 1, 'existing sibling charge reaches weapon in same offering slots');
  const mature = s.finishOfferingImpact(['w', 'erode'], 1, result.bonusCharges); assert(mature.ok);
  assert.equal(getEquipmentLifecycle(s.getItem('w')!).stage, 'tool');
  assert.equal(getEquipmentLifecycle(s.getItem('erode')!).stage, 'tool');
}
{
  const s = store(30); assert(s.ensureStarter().ok);
  assert(s.addContaminant({ id: 'tool', type: 'solidify', rarity: 'common', stage: 'tool', impactCharges: 3, usesRemaining: 2 }).ok);
  assert(s.prepareTool('tool', 0).ok, 'base preparation has no weight limit');
  assert.equal(s.getCarryWeight(), 50); assert.equal(s.beginRun('overweight').ok, false, 'departure validates real equipped burden');
}
{
  const s = store(); const legacy = baseState([rawWeapon('w')]); legacy.version = 1;
  const weapon = legacy.items[0]; assert(weapon?.kind === 'weapon');
  delete (weapon.weapon as Partial<typeof weapon.weapon>).stage;
  delete (weapon.weapon as Partial<typeof weapon.weapon>).impactCharges;
  delete (weapon.weapon as Partial<typeof weapon.weapon>).usesRemaining;
  assert(s.loadState(legacy)); assert.equal(s.getState().version, 2);
  assert.equal(getEquipmentLifecycle(s.getItem('w')!).stage, 'tool');
  assert.equal(getEquipmentLifecycle(s.getItem('w')!).usesRemaining, 75);
  const malformed = structuredClone(legacy); malformed.version = 2;
  assert.equal(s.loadState(malformed), false, 'missing lifecycle in new saves must not silently become ready');
}
console.log('equipment-lifecycle PASS: shared offering/last-impact defense/cross-slot charge, raw equipment gate, durability, atomic rollback, base/departure burden, legacy-only migration');

// Malformed legacy rows must be rejected, not dereferenced during migration.
{
 const store = new InventoryStore();
 const bad = store.getState(); bad.version = 1;
 (bad.items as unknown[]).push(null);
 assert.equal(store.loadState(bad), false);
}
