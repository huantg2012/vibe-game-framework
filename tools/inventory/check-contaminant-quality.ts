import assert from 'node:assert/strict';
import { CONTAMINANT_DATA, ACTIVE_CONTAMINANT_TYPES } from '../../src/generated/contaminant-data';
import { CONTAMINANT_QUALITY_DATA, CONTAMINANT_QUALITY_ORDER } from '../../src/generated/contaminant-quality-data';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { InventoryStore, inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { equipmentLifecycleDefinition } from '../../src/systems/equipment-lifecycle';
import { getContaminantMaxUses, getContaminantQuality, getContaminantQualityName, getContaminantQualityRank, rollContaminantDrop, rollContaminantQuality, supportsContaminantQuality } from '../../src/systems/contaminant-quality';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { growthSystem } from '../../src/systems/growth-system';
import { tideSystem } from '../../src/systems/tide-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { GAME_CONSTANTS } from '../../src/config/constants';
import type { Contaminant, ContaminantQuality, ContaminantType, SaveDataV2 } from '../../src/types/game-types';
import type { InventoryItem, InventoryState } from '../../src/types/inventory-types';

const families = ACTIVE_CONTAMINANT_TYPES;
const baselineUses: Partial<Record<ContaminantType, number>> = {
  solidify: 5, scatter: 5, retrograde: 5, muffle: 5, expand: 3, mirror: 4, kindle: 5, combust: 3, delay: 4, siphon: 5, stitch: 4, compress: 4, abyss: 3,
};
const stableNames: Partial<Record<ContaminantType, string>> = {
  solidify: '凝滞的石块', scatter: '重影碎片', retrograde: '记忆碎片', muffle: '消声的旧布',
  expand: '带缺口的石头', mirror: '留影玻璃', kindle: '回声空壳', combust: '冷却的余烬', delay: '不落的砂砾', siphon: '附着的空壳', stitch: '打结的细线', compress: '沉重的石块', abyss: '映出别处的珠子',
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name: string, fn: () => void): void { fn(); checks++; console.log(`PASS ${name}`); }
function makeStore(): InventoryStore {
  const store = new InventoryStore();
  store.configure({ weaponDefinition: id => WEAPON_DATA[id], starterDefinitionId: 'crowbar_plain',
    isPassiveTool: c => CONTAMINANT_DATA[c.type].toolType === 'passive' });
  return store;
}

check('52 quality variants share identity, body burden and offering threshold while uses improve', () => {
  assert.equal(families.length, 13);
  assert.equal(families.filter(supportsContaminantQuality).length, 13);
  for (const type of families) {
    const definition = CONTAMINANT_DATA[type];
    if (!supportsContaminantQuality(type)) {
      const legacy = contaminantSystem.createUnowned(type, definition.rarity);
      assert.equal(legacy.quality, undefined);
      assert.equal(legacy.usesRemaining, 0);
      assert.equal(getContaminantMaxUses(legacy), definition.toolUses);
      continue;
    }
    assert.equal(definition.displayNameDefense, stableNames[type]);
    assert.equal(definition.displayNameTool, stableNames[type]);
    const defaultRaw = contaminantSystem.createUnowned(type, definition.rarity);
    assert.equal(defaultRaw.quality, 'ordinary', 'new quality does not inherit ability-family rarity');
    for (const [index, quality] of CONTAMINANT_QUALITY_ORDER.entries()) {
      const raw = contaminantSystem.createUnowned(type, definition.rarity, quality);
      assert.equal(raw.stage, 'defense'); assert.equal(raw.usesRemaining, 0); assert.equal(raw.impactCharges, 0);
      assert.equal(raw.rarity, definition.rarity); assert.equal(raw.quality, quality);
      assert.equal(getContaminantMaxUses(raw), baselineUses[type]! + index);
      assert.equal(getContaminantQualityRank(raw), index + 1);
      assert.equal(getContaminantQualityName(raw), ['普通', '优良', '精良', '卓越'][index]);
      const store = makeStore(); assert(store.addContaminant(raw).ok);
      const item = store.getItem(raw.id)!;
      assert.equal(store.getWeight(item), 20);
      assert.equal(equipmentLifecycleDefinition(item).offeringCharges, 3);
      assert.equal(store.prepareTool(raw.id, definition.toolType === 'passive' ? 2 : 0).ok, false);
      assert(store.slotOffering(raw.id, 0).ok);
      assert(store.finishOfferingImpact([raw.id], 3).ok);
      const mature = store.getItem(raw.id); assert(mature?.kind === 'contaminant');
      assert.equal(mature.contaminant.usesRemaining, baselineUses[type]! + index);
      assert.equal(mature.contaminant.quality, quality);
      assert.equal(mature.location.kind, 'stash');
    }
  }
});

check('family selection is uniform and independent of 60/25/12/3 quality distribution', () => {
  for (const [index, type] of families.entries()) {
    const counts: Record<ContaminantQuality, number> = { ordinary: 0, good: 0, fine: 0, excellent: 0 };
    for (let qualityRoll = 0; qualityRoll < 100; qualityRoll++) {
      const values = [(index + 0.5) / families.length, (qualityRoll + 0.5) / 100];
      const drop = rollContaminantDrop(() => values.shift()!);
      assert.equal(drop.type, type); assert.equal(drop.rarity, CONTAMINANT_DATA[type].rarity);
      if (supportsContaminantQuality(type)) { assert(drop.quality); counts[drop.quality]++; assert.equal(values.length, 0); }
      else { assert.equal(drop.quality, undefined); assert.equal(values.length, 1, 'unconverted families do not acquire fake quality'); }
    }
    if (supportsContaminantQuality(type)) assert.deepEqual(counts, { ordinary: 60, good: 25, fine: 12, excellent: 3 });
  }
  assert.equal(rollContaminantQuality(() => 0, { ordinary: 0, good: 0, fine: 0, excellent: 1 }), 'excellent');
  assert.throws(() => rollContaminantQuality(() => 0, { ordinary: -1, good: 1, fine: 1, excellent: 1 }));
  assert.throws(() => rollContaminantQuality(() => 0, { ordinary: 0, good: 0, fine: 0, excellent: 0 }));
  assert.throws(() => rollContaminantQuality(() => 1));
  assert.throws(() => rollContaminantDrop(() => NaN));
});

check('legacy quality fallback is a read-only projection and never refills or clamps current uses', () => {
  for (const [rarity, expected] of [['common', 'ordinary'], ['fine', 'good'], ['rare', 'fine']] as const) {
    const old: Contaminant = { id: rarity, type: 'solidify', rarity, stage: 'tool', impactCharges: 3, usesRemaining: 2 };
    const before = clone(old);
    assert.equal(getContaminantQuality(old), expected); assert.equal(old.quality, undefined);
    getContaminantMaxUses(old); getContaminantQualityName(old); getContaminantQualityRank(old);
    assert.deepEqual(old, before);
    const store = makeStore(); assert(store.addContaminant(old).ok);
    assert.equal(store.loadState(store.getState()), true);
    assert.deepEqual(store.getContaminants()[0], before);
  }
  const store = makeStore();
  const old = contaminantSystem.createUnowned('solidify', 'common', 'excellent');
  old.stage = 'tool'; old.usesRemaining = 12; // Old echo bonuses may exceed the new table maximum.
  assert(store.addContaminant(old).ok);
  const state = store.getState(); const legacy = state.items[0]; assert(legacy?.kind === 'contaminant');
  delete legacy.contaminant.quality;
  assert(store.loadState(state));
  assert.equal(store.getContaminants()[0]?.quality, undefined, 'in-place reference preservation cannot retain a newer optional field');
  assert.equal(store.getContaminants()[0]?.usesRemaining, 12);
});

check('malformed explicit quality rejects before publication, including field reveal', () => {
  const store = makeStore(); assert(store.ensureStarter().ok);
  const raw = contaminantSystem.createUnowned('solidify', 'common', 'good');
  const malformed = { ...raw, quality: 'legendary' } as unknown as Contaminant;
  const before = store.getState();
  assert.equal(store.addContaminant(malformed).ok, false); assert.deepEqual(store.getState(), before);
  const invalid = clone(before);
  invalid.items.push({ id: malformed.id, kind: 'contaminant', contaminant: malformed, location: { kind: 'stash' } });
  assert.equal(store.loadState(invalid), false); assert.deepEqual(store.getState(), before);
  const oldFamily = { ...raw, type: 'ruminate' } as Contaminant;
  assert.equal(store.addContaminant(oldFamily).ok, false, 'unconverted families reject unsupported explicit quality');
  assert(store.beginRun('reject-quality').ok);
  const runBefore = store.getState();
  assert.equal(store.revealBatch('bad-node', [{ id: malformed.id, kind: 'contaminant', contaminant: malformed }], { x: 0, y: 0 }).ok, false);
  assert.deepEqual(store.getState(), runBefore);
});

check('offering persistence failure retains raw quality and zero uses until a successful single commit', () => {
  const store = makeStore();
  const raw = contaminantSystem.createUnowned('solidify', 'common', 'excellent');
  assert(store.addContaminant(raw).ok); assert(store.slotOffering(raw.id, 0).ok);
  const before = store.getState(); const reference = store.getContaminants()[0]!;
  let writes = 0;
  store.setPersistence(() => { throw new Error('quota'); });
  assert.equal(store.finishOfferingImpact([raw.id], 3).ok, false);
  assert.deepEqual(store.getState(), before); assert.equal(reference.usesRemaining, 0); assert.equal(reference.quality, 'excellent');
  store.setPersistence(() => { writes++; });
  assert(store.finishOfferingImpact([raw.id], 3).ok); assert.equal(writes, 1); assert.equal(reference.usesRemaining, 8);
});

check('legacy retrograde slot is retained on load but must be corrected before a new sortie', () => {
  const store = makeStore(); assert(store.ensureStarter().ok);
  const state = store.getState();
  const legacy: Contaminant = { id: 'old-retrograde', type: 'retrograde', rarity: 'common', stage: 'tool', usesRemaining: 2, impactCharges: 3 };
  state.items.push({ id: legacy.id, kind: 'contaminant', contaminant: legacy, location: { kind: 'carried' } });
  state.equipment.toolIds = [legacy.id, null, null];
  assert(store.loadState(state)); assert.deepEqual(store.getState(), state);
  assert.deepEqual(store.beginRun('incorrect-slot'), { ok: false, error: 'incompatible' });
  assert.equal(store.getEquipment().toolIds[0], legacy.id);
  assert(store.prepareTool(legacy.id, 2).ok); assert(store.beginRun('correct-slot').ok);
  const active = store.getState(); assert(store.loadState(active)); assert.deepEqual(store.getState(), active);
});

const savedStrings = new Map<string, string>();
let failWrites = false;
const memoryStorage = {
  getItem: (key: string) => savedStrings.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failWrites) throw new Error('quota'); savedStrings.set(key, value); },
  removeItem: (key: string) => savedStrings.delete(key),
};
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });
try {
  const saveKey = GAME_CONSTANTS.SAVE.KEY;
  inventoryStore.setPersistence(null);
  gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); contaminantSystem.reset();
  saveManager.save();
  const envelope = JSON.parse(memoryStorage.getItem(saveKey)!) as SaveDataV2;
  const oldRaw: Contaminant = { id: 'old-raw', type: 'expand', rarity: 'fine', stage: 'defense', impactCharges: 1, usesRemaining: 3 };
  const newReady: Contaminant = { id: 'new-ready', type: 'solidify', rarity: 'common', quality: 'excellent', stage: 'tool', impactCharges: 3, usesRemaining: 2 };
  const ground: Contaminant = { id: 'ground-new', type: 'kindle', rarity: 'fine', quality: 'good', stage: 'defense', impactCharges: 0, usesRemaining: 0 };
  const items: InventoryItem[] = [
    { id: oldRaw.id, kind: 'contaminant', contaminant: oldRaw, location: { kind: 'defense', slot: 0 } },
    { id: newReady.id, kind: 'contaminant', contaminant: newReady, location: { kind: 'carried' } },
    { id: ground.id, kind: 'contaminant', contaminant: ground, location: { kind: 'ground', runId: 'quality-run', position: { x: 80, y: 96 } } },
  ];
  envelope.inventory.items.push(...items);
  envelope.inventory.equipment.toolIds = [newReady.id, null, null];
  envelope.inventory.equipment.defenseIds = [oldRaw.id, null, null];
  envelope.inventory.run = { id: 'quality-run', status: 'active', carriedOutIds: [envelope.inventory.equipment.weaponId!, newReady.id], destroyedIds: [], revealedNodes: { 'quality-node': [ground.id] } };
  check('real SaveManager roundtrips old/new qualities, locations and active run without migration rewriting', () => {
    const bytes = JSON.stringify(envelope); memoryStorage.setItem(saveKey, bytes);
    assert(saveManager.load()); assert.equal(memoryStorage.getItem(saveKey), bytes, 'quality fallback has no eager save migration');
    assert.deepEqual(inventoryStore.getState(), envelope.inventory);
    saveManager.save(); assert(saveManager.load());
    assert.deepEqual(inventoryStore.getState(), envelope.inventory);
    assert.equal(inventoryStore.getRun()?.status, 'active'); assert.equal(inventoryStore.getRun()?.outcome, undefined);
  });
  check('invalid quality load leaves every live item, world and stored byte unchanged', () => {
    const before = { inventory: inventoryStore.getState(), game: gameState.getState(), tide: tideSystem.getState() };
    const invalid = clone(envelope);
    const item = invalid.inventory.items.find(value => value.id === newReady.id)!;
    assert(item.kind === 'contaminant'); (item.contaminant as unknown as { quality: unknown }).quality = null;
    const bytes = JSON.stringify(invalid); memoryStorage.setItem(saveKey, bytes);
    assert.equal(saveManager.load(), false); assert.equal(memoryStorage.getItem(saveKey), bytes);
    assert.deepEqual({ inventory: inventoryStore.getState(), game: gameState.getState(), tide: tideSystem.getState() }, before);
    memoryStorage.setItem(saveKey, JSON.stringify(envelope)); assert(saveManager.load());
  });
  check('durable use preserves quality and quota rollback retains exact live reference', () => {
    const before: InventoryState = inventoryStore.getState(); const bytes = memoryStorage.getItem(saveKey);
    const reference = inventoryStore.getContaminants().find(c => c.id === newReady.id)!;
    failWrites = true; assert.equal(inventoryStore.consumeTool(newReady.id).ok, false);
    assert.deepEqual(inventoryStore.getState(), before); assert.equal(memoryStorage.getItem(saveKey), bytes);
    assert.equal(reference.usesRemaining, 2); assert.equal(reference.quality, 'excellent');
    failWrites = false; assert(inventoryStore.consumeTool(newReady.id).ok); assert(saveManager.load());
    assert.equal(reference.usesRemaining, 1); assert.equal(reference.quality, 'excellent');
    assert.equal(inventoryStore.getRun()?.status, 'active');
  });
} finally {
  inventoryStore.setPersistence(null);
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else delete (globalThis as { localStorage?: unknown }).localStorage;
}
assert.equal(CONTAMINANT_QUALITY_DATA.ordinary.standardDropWeight, 60);
console.log(`${checks} contaminant quality/drop/lifecycle/migration checks passed.`);
