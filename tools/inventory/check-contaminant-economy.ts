import assert from 'node:assert/strict';
import { ACTIVE_CONTAMINANT_TYPES, CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { CONTAMINANT_MIGRATIONS, CONTAMINANT_LOOT_PROFILES } from '../../src/generated/contaminant-economy-data';
import { CONTAMINANT_QUALITY_ORDER } from '../../src/generated/contaminant-quality-data';
import { migrateContaminant } from '../../src/systems/contaminant-migration';
import { rollContaminantNodeDrop, getContaminantMaxUses, getContaminantQualityRank } from '../../src/systems/contaminant-quality';
import { InventoryStore } from '../../src/systems/inventory-store';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { createWeaponInstance } from '../../src/systems/equipment-lifecycle';
import type { Contaminant, ContaminantType } from '../../src/types/game-types';
import type { InventoryState } from '../../src/types/inventory-types';

assert.equal(ACTIVE_CONTAMINANT_TYPES.length, 13);
const retired = ['ruminate', 'resonate', 'overwrite', 'erode', 'echo'] as const;
assert(retired.every(type => !ACTIVE_CONTAMINANT_TYPES.includes(type)));
for (const [source, rule] of Object.entries(CONTAMINANT_MIGRATIONS)) {
  for (const rarity of ['common', 'fine', 'rare'] as const) for (const remaining of [1, rule.legacyUses - 1, rule.legacyUses, rule.legacyUses + 2]) {
    const original: Contaminant = { id: `${source}-${rarity}-${remaining}`, type: source as ContaminantType, rarity,
      stage: 'tool', impactCharges: 3, usesRemaining: remaining };
    const before = structuredClone(original), next = migrateContaminant(original);
    assert.deepEqual(original, before, 'conversion cannot mutate source save');
    assert.equal(next.type, rule.target); assert.equal(next.id, original.id); assert.equal(next.impactCharges, 3);
    assert.equal(next.usesRemaining, Math.max(1, Math.floor(remaining * getContaminantMaxUses(next) / rule.legacyUses)));
    assert.deepEqual(migrateContaminant(next), next, 'read/write/read cannot repeatedly increase uses');
  }
  const raw: Contaminant = { id: source, type: source as ContaminantType, rarity: 'rare', stage: 'defense', impactCharges: 1.5, usesRemaining: 0 };
  const next = migrateContaminant(raw); assert.equal(next.impactCharges, 1.5); assert.equal(next.usesRemaining, 0);
}
console.log('PASS all ten legacy migrations preserve identity/progress and quota ratio, including bonus and last use');
const store = new InventoryStore(); store.configure({ weaponDefinition: id => WEAPON_DATA[id], isPassiveTool: c => CONTAMINANT_DATA[c.type].toolType === 'passive' });
const state: InventoryState = { version: 2, starterGranted: true, firstWeaponDiscovered: true,
  equipment: { weaponId: 'weapon', toolIds: ['legacy', null, null], defenseIds: ['raw', null, null] },
  items: [
    { id: 'weapon', kind: 'weapon', location: { kind: 'carried' }, weapon: createWeaponInstance('crowbar_plain', true, 'weapon') },
    { id: 'legacy', kind: 'contaminant', location: { kind: 'carried' }, contaminant: { id: 'legacy', type: 'ruminate', rarity: 'common', stage: 'tool', impactCharges: 3, usesRemaining: 2 } },
    { id: 'raw', kind: 'contaminant', location: { kind: 'defense', slot: 0 }, contaminant: { id: 'raw', type: 'resonate', rarity: 'rare', stage: 'defense', impactCharges: 1, usesRemaining: 0 } },
    { id: 'ground', kind: 'contaminant', location: { kind: 'ground', runId: 'old-run', position: { x: 40, y: 40 } }, contaminant: { id: 'ground', type: 'echo', rarity: 'fine', stage: 'defense', impactCharges: 0, usesRemaining: 0 } },
  ], run: { id: 'old-run', status: 'active', carriedOutIds: ['weapon', 'legacy'], revealedNodes: { pile: ['ground'] }, destroyedIds: [] } };
assert(store.loadState(state)); const migrated = store.getState();
assert.deepEqual(migrated.equipment, state.equipment); assert.deepEqual(migrated.run, state.run);
assert.deepEqual(migrated.items.map(i => i.location), state.items.map(i => i.location));
assert(store.loadState(migrated)); assert.deepEqual(store.getState(), migrated);
let writes = 0; store.setPersistence(() => { writes++; throw Error('quota'); });
assert.equal(store.consumeEquipmentUse('legacy').ok, false); assert.equal(writes, 1); assert.deepEqual(store.getState(), migrated);
store.setPersistence(null); assert(store.settleRun('old-run', 'death', 0).ok);
assert.equal(store.getItem('weapon'), undefined); assert.equal(store.getItem('legacy'), undefined); assert.equal(store.getItem('ground'), undefined);
assert.equal(store.getItem('raw')?.kind, 'contaminant', 'base offering survives; carried and field items do not');
console.log('PASS real inventory active-run migration, ownership/ledger preservation, quota rollback and death loss');

const meanRanks: number[] = [];
for (const tier of ['safe', 'contested', 'deep'] as const) {
  const seen = new Set<string>(); let sum = 0;
  for (let seed = 0; seed < 4096; seed++) {
    const drop = rollContaminantNodeDrop(seed, 'CTM_NODE_01', tier);
    assert.deepEqual(rollContaminantNodeDrop(seed, 'CTM_NODE_01', tier), drop);
    assert(ACTIVE_CONTAMINANT_TYPES.includes(drop.type)); assert(drop.quality);
    seen.add(drop.type + '/' + drop.quality); sum += getContaminantQualityRank(drop);
  }
  assert.equal(seen.size, 52, 'every family/quality is reachable at each risk tier');
  meanRanks.push(sum / 4096);
  const weights = CONTAMINANT_LOOT_PROFILES[tier];
  const expected = CONTAMINANT_QUALITY_ORDER.reduce((a, q, i) => a + weights[q] * (i + 1), 0) / 100;
  assert(Math.abs(sum / 4096 - expected) < .08);
}
assert(meanRanks[0]! < meanRanks[1]! && meanRanks[1]! < meanRanks[2]!);
console.log('PASS stable per-node risk loot, all 52 outcomes, increasing mean quality:', meanRanks.map(x => x.toFixed(3)).join('/'));

// Real supply domain at base: weapons and artifacts compete for the same finite slots.
for (const slots of [3, 4]) for (const charges of [1, 3]) {
  const inventory = new InventoryStore(); inventory.configure({ weaponDefinition: id => WEAPON_DATA[id], defenseSlotCount: () => slots });
  const weapon = createWeaponInstance('crowbar_plain', false, 'supply-weapon');
  const start: InventoryState = { version: 2, items: [{ id: weapon.id, kind: 'weapon', weapon, location: { kind: 'stash' } }],
    equipment: { weaponId: null, toolIds: [], defenseIds: [] }, run: null, starterGranted: false, firstWeaponDiscovered: false };
  assert(inventory.loadState(start)); assert(inventory.slotOffering(weapon.id, 0).ok);
  for (let slot = 1; slot < slots; slot++) {
    const type = ACTIVE_CONTAMINANT_TYPES[slot]!;
    const c: Contaminant = { id: `supply-${slot}`, type, rarity: CONTAMINANT_DATA[type].rarity, quality: 'ordinary', stage: 'defense', impactCharges: 0, usesRemaining: 0 };
    assert(inventory.addContaminant(c).ok); assert(inventory.slotOffering(c.id, slot).ok);
  }
  let rounds = 0;
  while (inventory.getOfferingItems().some(Boolean) && rounds++ < 4) {
    const ids = inventory.getOfferingItems().map(i => i?.id ?? null);
    assert(inventory.finishOfferingImpact(ids, charges).ok);
  }
  assert.equal(rounds, charges === 3 ? 1 : 3);
  assert.equal(inventory.getItems().filter(item => (item.kind === 'weapon' ? item.weapon : item.contaminant).stage === 'tool').length, slots);
}
console.log('PASS shared offering throughput: normal three returns, crest one; 3/4 slots including weapon');
