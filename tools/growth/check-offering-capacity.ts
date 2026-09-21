/** I29: real capacity purchases and versioned base/world-save migration. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { purchaseGrowth } from '../../src/managers/growth-purchases';
import { saveManager } from '../../src/managers/save-manager';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { createWeaponInstance } from '../../src/systems/equipment-lifecycle';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import type { RiftRecoveryState } from '../../src/systems/rift-recovery-state';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';
import type { Contaminant, SaveDataV1, SaveDataV2 } from '../../src/types/game-types';
import type { InventoryItem, InventoryState } from '../../src/types/inventory-types';
import { checkpointChecksum, type RiftCheckpoint } from '../../src/types/rift-checkpoint';

const records = new Map<string, string>();
const key = GAME_CONSTANTS.SAVE.KEY;
let failWrites = false;
let writes = 0;
const checks: string[] = [];
saveManager.setStorage({
  getItem: id => records.get(id) ?? null,
  removeItem: id => { records.delete(id); },
  setItem: (id, bytes) => {
    if (failWrites) throw new Error('simulated quota');
    if (id === key) writes++;
    records.set(id, bytes);
  },
});
// The real admission adapter imports locale-aware presentation code; its isolated
// test environment supplies only the read needed at module initialization.
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { installProceduralRiftRecovery } = await import('../../src/managers/rift-recovery');
installProceduralRiftRecovery();
const fixture = JSON.parse(readFileSync('tools/recovery/fixtures/formal-active.json', 'utf8')) as {
  checkpoint: RiftCheckpoint<RiftRecoveryState>; inventory: InventoryState;
};
function check(name: string, action: () => void): void {
  action(); checks.push(name); console.log(`PASS ${name}`);
}
function read(): SaveDataV2 { return JSON.parse(records.get(key)!) as SaveDataV2; }
function snapshot() {
  return { game: gameState.getState(), growth: growthSystem.getState(), inventory: inventoryStore.getState(),
    tide: tideSystem.getState(), stability: stabilityTracker.getState(), forecast: impactSystem.getForecastState() };
}
function reset(): void {
  failWrites = false;
  saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); contaminantSystem.reset();
  tideSystem.reset(); stabilityTracker.reset(); impactSystem.resetForecastState();
  assert(saveManager.trySave());
}
function contaminant(id: string): Contaminant {
  return { id, type: 'solidify', rarity: 'common', quality: 'ordinary', stage: 'defense', impactCharges: 1, usesRemaining: 0 };
}
function legacyBase(level: 0 | 1): SaveDataV2 {
  reset();
  const record = read();
  delete record.growth.schemaVersion;
  record.growth.upgrades.growth_defense_slot = level;
  record.growth.upgrades.growth_chaos_resist = 2;
  record.growth.upgrades.growth_forecast_clarity = 1;
  const offered: InventoryItem[] = Array.from({ length: 3 + level }, (_, slot) => {
    const id = `legacy-offering-${slot}`;
    return slot === 0
      ? { id, kind: 'weapon', weapon: createWeaponInstance('crowbar_plain', false, id), location: { kind: 'defense', slot } }
      : { id, kind: 'contaminant', contaminant: contaminant(id), location: { kind: 'defense', slot } };
  });
  record.inventory.items.push(...offered);
  record.inventory.equipment.defenseIds = offered.map(item => item.id);
  return record;
}
function writeRecord(record: SaveDataV2 | SaveDataV1): string {
  if (record.version === 2 && (record.riftCheckpoint || record.riftDeparture)) {
    delete record.checkpointChecksum;
    record.checkpointChecksum = checkpointChecksum(record);
  }
  const bytes = JSON.stringify(record);
  records.set(key, bytes);
  return bytes;
}
function assertCapacity(count: number): void {
  assert.equal(contaminantSystem.getDefenseSlotCount(), count);
  assert.equal(contaminantSystem.getDefenseSlotted().length, count);
  assert.equal(inventoryStore.getOfferingItems().length, count);
}
function assertEnvelopeChecksum(record: SaveDataV2): void {
  const { checkpointChecksum: checksum, ...body } = record;
  assert.equal(checksum, checkpointChecksum(body));
}
function legacyWorld(level: 0 | 1): SaveDataV2 {
  const record = legacyBase(level);
  const offered = record.inventory.items.filter(item => item.location.kind === 'defense');
  record.cycle = fixture.checkpoint.state.conditions.cycle;
  record.inventory = { ...record.inventory, ...structuredClone(fixture.inventory) };
  record.inventory.items.push(...offered);
  record.inventory.equipment.defenseIds = offered.map(item => item.id);
  record.riftCheckpoint = structuredClone(fixture.checkpoint);
  return record;
}
function unlockFacts(): void {
  growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: true, toolRevealed: true, leftFiniteCrest: true });
}

check('new record starts at one slot; real linear purchases expand it exactly 1→2→3→4', () => {
  reset(); assertCapacity(1);
  assert.equal(read().growth.schemaVersion, 2);
  unlockFacts(); gameState.addKindling(10000);
  const first = contaminant('new-offering-0');
  assert(inventoryStore.addContaminant(first).ok);
  assert(inventoryStore.slotOffering(first.id, 0).ok);
  assert.equal(inventoryStore.slotOffering(null, 1).ok, false);
  let expansions = 0;
  for (let iteration = 0; iteration < 100; iteration++) {
    const next = growthSystem.getNextStep();
    if (!next) break;
    const items = inventoryStore.getState().items;
    const slots = [...inventoryStore.getEquipment().defenseIds];
    assert(purchaseGrowth(next.id).ok, `route purchase ${next.id}/${next.level}`);
    if (next.id !== 'growth_defense_slot') continue;
    expansions++;
    assertCapacity(1 + expansions);
    assert.deepEqual(inventoryStore.getState().items, items);
    assert.deepEqual(inventoryStore.getEquipment().defenseIds, slots);
    const added = contaminant(`new-offering-${expansions}`);
    assert(inventoryStore.addContaminant(added).ok);
    assert(inventoryStore.slotOffering(added.id, expansions).ok);
    const before = snapshot();
    assert(saveManager.load()); assert.deepEqual(snapshot(), before);
  }
  assert.equal(expansions, 3); assertCapacity(4);
  assert.equal(inventoryStore.slotOffering(null, 4).ok, false);
  assert.equal(purchaseGrowth('growth_defense_slot').ok, false);
});

check('rejected expansion saves restore exact capacity, items, reserve and growth before a successful retry', () => {
  reset(); unlockFacts(); gameState.addKindling(10000);
  for (let iteration = 0; iteration < 100; iteration++) {
    const next = growthSystem.getNextStep(); assert(next);
    if (next.id === 'growth_defense_slot') break;
    assert(purchaseGrowth(next.id).ok);
  }
  const next = growthSystem.getNextStep(); assert.equal(next?.id, 'growth_defense_slot');
  assert(saveManager.trySave());
  const before = snapshot(), bytes = records.get(key), beforeWrites = writes;
  failWrites = true;
  assert.deepEqual(purchaseGrowth('growth_defense_slot'), { ok: false, reason: 'storage-failed' });
  assert.deepEqual(snapshot(), before); assert.equal(records.get(key), bytes); assert.equal(writes, beforeWrites);
  failWrites = false; assert(purchaseGrowth('growth_defense_slot').ok); assertCapacity(2);
  const bought = snapshot(); assert(saveManager.load()); assert.deepEqual(snapshot(), bought);
});

check('legacy base 3/4 slots migrate once to schema 2 levels 2/3, keeping weapon and contaminant references', () => {
  for (const level of [0, 1] as const) {
    const record = legacyBase(level), original = structuredClone(record);
    writeRecord(record);
    const beforeWrites = writes;
    assert(saveManager.load()); assertCapacity(3 + level);
    assert.equal(writes, beforeWrites + 1);
    assert.equal(read().growth.schemaVersion, 2);
    assert.deepEqual(read().growth.upgrades, { ...original.growth.upgrades, growth_defense_slot: 2 + level });
    assert.deepEqual(inventoryStore.getState(), original.inventory);
    assert.deepEqual(read().impactForecast, original.impactForecast);
    assert.equal(growthSystem.getModifiers().chaosResist, .08);
    const migrated = snapshot(), bytes = records.get(key);
    for (let attempt = 0; attempt < 3; attempt++) assert(saveManager.load());
    assert.deepEqual(snapshot(), migrated); assert.equal(records.get(key), bytes); assert.equal(writes, beforeWrites + 1);
  }
});

check('legacy V1 and missing defense field retain the original three slots without creating purchases or rewards', () => {
  const record = legacyBase(0);
  const { inventory, version: _version, ...base } = record;
  const legacy: SaveDataV1 = { ...base, version: 1, contaminants: [0, 1, 2].map(slot => contaminant(`v1-${slot}`)),
    defenseSlots: ['v1-0', 'v1-1', 'v1-2'], sortieLoadout: [null, null, null] };
  Reflect.deleteProperty(legacy.growth.upgrades, 'growth_defense_slot');
  const originalProgress = legacy.stability.progress, originalReserve = legacy.kindlingReserve;
  writeRecord(legacy); assert(saveManager.load()); assertCapacity(3);
  assert.deepEqual(inventoryStore.getEquipment().defenseIds.slice(0, 3), legacy.defenseSlots);
  assert.equal(read().growth.upgrades.growth_defense_slot, 2);
  assert.equal(stabilityTracker.getProgress(), originalProgress); assert.equal(gameState.getKindlingReserve(), originalReserve);
  assert.equal(inventoryStore.getState().items.length, inventory.items.length);
});

check('a rejected legacy-base migration leaves old bytes intact and repeated loads/retry never add capacity twice', () => {
  const record = legacyBase(1), bytes = writeRecord(record);
  failWrites = true;
  for (let attempt = 0; attempt < 3; attempt++) { assert(saveManager.load()); assertCapacity(4); assert.equal(records.get(key), bytes); }
  const before = snapshot(); assert.equal(saveManager.trySave(), false); assert.deepEqual(snapshot(), before);
  failWrites = false; assert(saveManager.trySave()); assert(saveManager.load());
  assert.deepEqual(snapshot(), before); assert.equal(read().growth.schemaVersion, 2);
});

check('old active world loads unchanged, then a complete frame commits schema 2 and survives denywrite/reload', () => {
  for (const level of [0, 1] as const) {
    const record = legacyWorld(level), bytes = writeRecord(record), beforeWrites = writes;
    assert(saveManager.load()); assertCapacity(3 + level);
    assert.equal(records.get(key), bytes); assert.equal(writes, beforeWrites);
    assert.deepEqual(saveManager.peekRiftCheckpoint(), record.riftCheckpoint);
    assert.deepEqual(inventoryStore.getEquipment().defenseIds, record.inventory.equipment.defenseIds);
    const checkpoint = structuredClone(record.riftCheckpoint!); checkpoint.sequence++;
    const commit = saveManager.prepareRiftCommit(checkpoint);
    const before = snapshot();
    failWrites = true; assert.throws(commit, /simulated quota/);
    assert.equal(records.get(key), bytes); assert.deepEqual(snapshot(), before);
    failWrites = false; commit(); commit();
    assert.equal(writes, beforeWrites + 1);
    const migrated = read(); assertEnvelopeChecksum(migrated);
    assert.equal(migrated.growth.schemaVersion, 2);
    assert.deepEqual(migrated.riftCheckpoint, checkpoint);
    assert.deepEqual((migrated.riftCheckpoint!.state as RiftRecoveryState).conditions, fixture.checkpoint.state.conditions);
    assert(saveManager.load()); assert.deepEqual(snapshot(), before); assertCapacity(3 + level);
  }
});

check('old departure intent preserves frozen modifiers and equipment while its next save adopts schema 2', () => {
  const record = legacyWorld(1);
  const checkpoint = record.riftCheckpoint! as RiftCheckpoint<RiftRecoveryState>;
  delete record.riftCheckpoint;
  record.riftDeparture = { version: 1, runId: checkpoint.runId, identity: checkpoint.identity,
    conditions: { modifiers: checkpoint.state.conditions.modifiers, cycle: record.cycle } };
  const bytes = writeRecord(record);
  assert(saveManager.load()); assert.equal(records.get(key), bytes); assertCapacity(4);
  assert(saveManager.trySave()); const migrated = read(); assertEnvelopeChecksum(migrated);
  assert.equal(migrated.growth.schemaVersion, 2); assert.deepEqual(migrated.riftDeparture, record.riftDeparture);
  const before = snapshot(); assert(saveManager.load()); assert.deepEqual(snapshot(), before);
});

check('an unfinished old return keeps its receipt until base settlement, then saves migration and settlement together', () => {
  const record = legacyWorld(0);
  const checkpoint = record.riftCheckpoint! as RiftCheckpoint<RiftRecoveryState>;
  checkpoint.state = { version: 1, phase: 'settled', conditions: checkpoint.state.conditions,
    presentationSequence: checkpoint.state.presentationSequence, result: checkpoint.state.result,
    run: { ...checkpoint.state.run, runEnded: true, lastEndReason: 'extract', lastKindling: 0,
      settlementSaved: true, settlementEmitted: true, settlementDelayRemainingMs: null } };
  Object.assign(record.inventory.run!, { status: 'settled', outcome: 'extract', returnedIds: [], kindlingGained: 0 });
  const bytes = writeRecord(record);
  assert(saveManager.load()); assert.equal(records.get(key), bytes); assertCapacity(3);
  const oldGrowth = growthSystem.getState();
  failWrites = true;
  assert.equal(saveManager.commitWorldTransaction(() => { assert(inventoryStore.markBaseSettled().ok); }), false);
  assert.equal(records.get(key), bytes); assert.equal(saveManager.hasPendingSave(), true);
  failWrites = false; assert(saveManager.trySave()); assert.equal(read().riftCheckpoint, undefined);
  assert.equal(read().checkpointChecksum, undefined); assert.equal(read().growth.schemaVersion, 2);
  assert.deepEqual(growthSystem.getState(), oldGrowth);
  const settled = snapshot(); assert(saveManager.load()); assert.deepEqual(snapshot(), settled);
  assert.equal(inventoryStore.getRun()?.baseSettled, true);
});

check('unsupported schemas and malformed levels reject before live state or stored bytes change', () => {
  reset(); const baseline = snapshot(), valid = read();
  const candidates: SaveDataV2[] = [];
  for (const schema of [null, 1, 3, '2', false]) {
    const candidate = structuredClone(valid); Reflect.set(candidate.growth, 'schemaVersion', schema); candidates.push(candidate);
  }
  for (const [schema, levels] of [[undefined, [2, 3, -1, .5, '1']], [2, [4, -1, .5, '1']]] as const) {
    for (const level of levels) {
      const candidate = structuredClone(valid);
      if (schema === undefined) delete candidate.growth.schemaVersion;
      Reflect.set(candidate.growth.upgrades, 'growth_defense_slot', level); candidates.push(candidate);
    }
  }
  for (const candidate of candidates) {
    const bytes = writeRecord(candidate);
    assert.equal(saveManager.load(), false); assert.deepEqual(snapshot(), baseline); assert.equal(records.get(key), bytes);
  }
  for (const level of [0, 1, 2, 3]) {
    const candidate = structuredClone(valid); candidate.growth.upgrades.growth_defense_slot = level;
    writeRecord(candidate); assert(saveManager.load()); assertCapacity(1 + level);
  }
});

const out = process.argv[2] ?? 'docs/qa/artifacts/iteration-29-r2/offering-capacity.json';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ iteration: 29, verifiedAt: new Date().toISOString(), result: 'PASS',
  method: 'isolated memory storage; production purchases, save manager and procedural recovery admission with recorded formal world',
  checks, limitations: ['No player visual acceptance or browser input is claimed.'] }, null, 2) + '\n');
inventoryStore.setPersistence(null);
console.log(`${checks.length} offering capacity and migration checks passed; ${out}`);
