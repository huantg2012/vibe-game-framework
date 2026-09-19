/** Real SaveManager against an isolated in-memory Storage; never reads a user save. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { saveManager } from '../../src/managers/save-manager';
import { gameState } from '../../src/managers/game-state';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { tideSystem } from '../../src/systems/tide-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { getDefenseRuntimeState, resetDefenseEngine } from '../../src/systems/defense-engine';
import type { SaveDataV1, SaveDataV2 } from '../../src/types/game-types';

const map = new Map<string, string>();
let failWrites = false;
let writes = 0;
const memoryStorage: Storage = {
  get length() { return map.size; },
  clear() { map.clear(); },
  key(index) { return [...map.keys()][index] ?? null; },
  getItem(key) { return map.get(key) ?? null; },
  removeItem(key) { map.delete(key); },
  setItem(key, value) { if (failWrites) throw new Error('simulated quota'); writes++; map.set(key, value); },
};
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });
const key = GAME_CONSTANTS.SAVE.KEY;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
let checks = 0;
function check(name: string, fn: () => void) { fn(); checks++; console.log(`PASS ${name}`); }
function resetRuntime(): void {
  inventoryStore.setPersistence(null);
  gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); resetDefenseEngine(); contaminantSystem.reset();
}
function snapshot() {
  return { inventory: inventoryStore.getState(), game: gameState.getState(), growth: growthSystem.getState(), tide: tideSystem.getState(), stability: stabilityTracker.getState(), defense: getDefenseRuntimeState(), echo: contaminantSystem.getEchoBonusState() };
}
function readV2(): SaveDataV2 { return JSON.parse(memoryStorage.getItem(key)!) as SaveDataV2; }
try {
  resetRuntime();
  const gs = gameState.getState();
  const legacy: SaveDataV1 = {
    version: 1, kindlingReserve: 117, modules: gs.modules, moduleMaxHpTier: gs.moduleMaxHpTier, cycle: 9,
    // Tide 2, first completed Rise step: floor 1.2 + (2.0 - 1.2) / 4.
    tide: { ...tideSystem.getState(), tideNumber: 2, cycleInPhase: 1, currentIntensity: 1.4 },
    contaminants: [
      { id: 'owned-active', type: 'solidify', rarity: 'common', stage: 'tool', impactCharges: 3, usesRemaining: 2 },
      { id: 'owned-passive', type: 'muffle', rarity: 'fine', stage: 'tool', impactCharges: 3, usesRemaining: 1 },
      { id: 'offered', type: 'solidify', rarity: 'common', stage: 'defense', impactCharges: 1, usesRemaining: 3 },
      { id: 'stored', type: 'delay', rarity: 'fine', stage: 'defense', impactCharges: 0, usesRemaining: 2 },
    ],
    defenseSlots: ['offered', null, null, null], sortieLoadout: ['owned-active', null, null, 'owned-passive'],
    growth: { upgrades: { ...growthSystem.getState().upgrades, growth_sortie_slot: 1, growth_defense_slot: 1, growth_vitality: 2 } },
    stability: { progress: 31, reached: false },
    contaminantRuntimeState: { offered: { solidifyCounter: 2 }, 'owned-active': { echoBonusGranted: 1 } },
  };
  let migrated: SaveDataV2;
  check('V1 migration preserves identity, locations, slots, remaining uses, growth and runtime counters', () => {
    memoryStorage.setItem(key, JSON.stringify(legacy));
    assert.equal(saveManager.load(), true);
    migrated = readV2(); assert.equal(migrated.version, 2);
    assert.equal('contaminants' in migrated, false, 'no second authoritative item array');
    for (const original of legacy.contaminants) {
      const item = inventoryStore.getItem(original.id); assert.equal(item?.kind, 'contaminant');
      if (item?.kind === 'contaminant') assert.deepEqual(item.contaminant, original.type === 'delay' ? { ...original, quality: 'good' } : original);
    }
    assert.equal(inventoryStore.getItem('offered')?.location.kind, 'defense');
    assert.equal(inventoryStore.getItem('stored')?.location.kind, 'stash');
    assert.equal(inventoryStore.getItem('owned-active')?.location.kind, 'carried');
    assert.deepEqual(migrated.inventory.equipment.toolIds, legacy.sortieLoadout);
    assert.deepEqual(migrated.inventory.equipment.defenseIds, legacy.defenseSlots);
    assert.deepEqual(migrated.growth, legacy.growth); assert.deepEqual(migrated.contaminantRuntimeState, legacy.contaminantRuntimeState);
    assert.equal(migrated.inventory.items.filter(item => item.kind === 'weapon').length, 1);
    assert.equal(gameState.getKindlingReserve(), 117); assert.equal(gameState.getCycle(), 9);
  });
  check('V2 repeated load and save roundtrip never duplicates the starter', () => {
    const baseline = snapshot(); const weapon = inventoryStore.getEquipment().weaponId;
    for (let i = 0; i < 3; i++) { assert.equal(saveManager.load(), true); saveManager.save(); }
    assert.equal(inventoryStore.getEquipment().weaponId, weapon); assert.equal(inventoryStore.getItems().length, 5);
    assert.deepEqual(snapshot(), baseline); assert.deepEqual(readV2(), migrated!);
  });
  check('malformed loads leave every live system and stored bytes intact', () => {
    const baseline = snapshot();
    const broken = clone(migrated!); broken.inventory.equipment.toolIds[0] = broken.inventory.equipment.weaponId;
    for (const invalid of [null, { version: 2 }, { ...migrated!, growth: null }, broken, { ...legacy, contaminants: [legacy.contaminants[0], legacy.contaminants[0]] }]) {
      const bytes = JSON.stringify(invalid); memoryStorage.setItem(key, bytes);
      assert.equal(saveManager.load(), false); assert.deepEqual(snapshot(), baseline); assert.equal(memoryStorage.getItem(key), bytes);
    }
    memoryStorage.setItem(key, JSON.stringify(migrated!)); assert.equal(saveManager.load(), true);
  });
  check('tool consumption persists before reload; active runs load without automatic loss or recovery', () => {
    assert.equal(inventoryStore.beginRun('save-audit-run').ok, true);
    const result = contaminantSystem.tryConsumeTool('owned-active'); assert.equal(result.ok, true);
    const saved = readV2();
    const active = saved.inventory.items.find(item => item.id === 'owned-active');
    assert.equal(active?.kind === 'contaminant' && active.contaminant.usesRemaining, 1);
    const before = snapshot(); assert.equal(saveManager.load(), true); assert.deepEqual(snapshot(), before);
    assert.equal(inventoryStore.getRun()?.status, 'active'); assert.equal(inventoryStore.getRun()?.outcome, undefined);
    assert(inventoryStore.getItem('owned-active')); assert(inventoryStore.getEquipment().weaponId);
  });
  check('quota failure preserves live tool references and stored bytes', () => {
    const before = snapshot(); const bytes = memoryStorage.getItem(key); const ref = contaminantSystem.getAll().find(c => c.id === 'owned-active')!;
    failWrites = true;
    assert.deepEqual(contaminantSystem.tryConsumeTool('owned-active'), { ok: false, error: 'storage-failed' });
    assert.equal(saveManager.trySave(), false); assert.deepEqual(snapshot(), before); assert.equal(memoryStorage.getItem(key), bytes);
    assert.equal(ref.usesRemaining, 1); assert.equal(ref.stage, 'tool'); failWrites = false;
    assert.equal(contaminantSystem.tryConsumeTool('owned-active').ok, true);
    assert.equal(ref.usesRemaining, 0); assert.equal(ref.stage, 'broken'); assert.equal(saveManager.load(), true);
    assert.equal(inventoryStore.getItem('owned-active'), undefined); assert.equal(inventoryStore.getEquipment().toolIds[0], null);
  });
  check('failed migration write preserves V1 bytes and retry saves exactly one starter', () => {
    const oldBytes = JSON.stringify(legacy); memoryStorage.setItem(key, oldBytes); failWrites = true;
    assert.equal(saveManager.load(), true); assert.equal(memoryStorage.getItem(key), oldBytes);
    const starterId = inventoryStore.getEquipment().weaponId;
    assert.equal(saveManager.trySave(), false); assert.equal(inventoryStore.getItems().filter(item => item.kind === 'weapon').length, 1);
    failWrites = false; assert.equal(saveManager.trySave(), true); assert.equal(readV2().version, 2);
    assert.equal(inventoryStore.getEquipment().weaponId, starterId); assert.equal(saveManager.load(), true);
    assert.equal(inventoryStore.getItems().filter(item => item.kind === 'weapon').length, 1);
  });
  check('new record delete/reset cannot write a half-reset snapshot from starter creation', () => {
    const beforeWrites = writes; saveManager.deleteSave();
    gameState.reset(); tideSystem.reset(); contaminantSystem.reset();
    assert.equal(memoryStorage.getItem(key), null); assert.equal(writes, beforeWrites);
    // Mirrors the real session ordering: old growth exists until after inventory reset.
    growthSystem.reset(); stabilityTracker.reset(); resetDefenseEngine();
    assert.equal(memoryStorage.getItem(key), null); saveManager.save();
    const fresh = readV2(); assert.equal(fresh.inventory.items.length, 1); assert.equal(fresh.cycle, 0);
    assert.equal(fresh.growth.upgrades.growth_vitality, 0); assert.deepEqual(fresh.contaminantRuntimeState, {});
  });
  check('world settlement writes once and failed retry cannot replay rewards or tide', () => {
    assert.equal(inventoryStore.beginRun('atomic-world-run').ok, true);
    assert.equal(inventoryStore.settleRun('atomic-world-run', 'extract', 7).ok, true);
    const previousCycle = gameState.getCycle();
    const previousKindling = gameState.getKindlingReserve();
    const beforeWrites = writes;
    let applied = 0;
    failWrites = true;
    assert.equal(saveManager.commitWorldTransaction(() => {
      applied++;
      gameState.addKindling(7);
      gameState.incrementCycle();
      inventoryStore.markBaseSettled();
    }), false);
    assert.equal(applied, 1);
    assert.equal(writes, beforeWrites, 'nested inventory changes must not partially save');
    assert.equal(saveManager.hasPendingSave(), true);
    assert.equal(saveManager.commitWorldTransaction(() => { applied++; }), false);
    assert.equal(applied, 1);
    assert.equal(inventoryStore.beginRun('must-not-start').ok, false);
    assert.equal(saveManager.trySave(), false);
    failWrites = false;
    assert.equal(saveManager.trySave(), true);
    assert.equal(saveManager.hasPendingSave(), false);
    assert.equal(writes, beforeWrites + 1);
    assert.equal(readV2().inventory.run?.baseSettled, true);
    assert.equal(readV2().inventory.run?.kindlingGained, 7);
    assert.equal(saveManager.load(), true);
    assert.equal(gameState.getCycle(), previousCycle + 1);
    assert.equal(gameState.getKindlingReserve(), previousKindling + 7);
    assert.equal(inventoryStore.getRun()?.baseSettled, true);
  });
  check('old V2 weapon lifecycle migrates once; spent uses survive reload and bad new lifecycle is rejected', () => {
    const old = readV2(); old.inventory.version = 1;
    const weapon = old.inventory.items.find(item => item.kind === 'weapon'); assert(weapon?.kind === 'weapon');
    const id = weapon.id, def = WEAPON_DATA[weapon.weapon.definitionId]!;
    delete (weapon.weapon as Partial<typeof weapon.weapon>).stage;
    delete (weapon.weapon as Partial<typeof weapon.weapon>).impactCharges;
    delete (weapon.weapon as Partial<typeof weapon.weapon>).usesRemaining;
    memoryStorage.setItem(key, JSON.stringify(old)); assert(saveManager.load());
    assert.equal(readV2().inventory.version, 2);
    const migratedWeapon = inventoryStore.getItem(id); assert(migratedWeapon?.kind === 'weapon');
    assert.equal(migratedWeapon.weapon.stage, 'tool'); assert.equal(migratedWeapon.weapon.usesRemaining, def.maxUses);
    assert(inventoryStore.consumeEquipmentUse(id).ok);
    assert(saveManager.load());
    const spent = inventoryStore.getItem(id); assert(spent?.kind === 'weapon');
    assert.equal(spent.weapon.usesRemaining, def.maxUses - 1, 'do not refill on every load');
    const malformed = readV2();
    const bad = malformed.inventory.items.find(item => item.id === id); assert(bad?.kind === 'weapon');
    delete (bad.weapon as Partial<typeof bad.weapon>).usesRemaining;
    const before = snapshot(); memoryStorage.setItem(key, JSON.stringify(malformed));
    assert.equal(saveManager.load(), false); assert.deepEqual(snapshot(), before);
  });
  console.log(`${checks} real SaveManager migration/integration checks passed.`);
} finally {
  inventoryStore.setPersistence(null);
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
  else delete (globalThis as { localStorage?: Storage }).localStorage;
}
