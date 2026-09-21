/** I29: recover only experiences proven by validated production inventory/tide records. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { CATALOG_ITEMS } from '../../src/generated/contaminant-catalog-data';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { gameState } from '../../src/managers/game-state';
import { createCatalogContaminant, getContaminantSlot } from '../../src/systems/contaminant-catalog';
import { createWeaponInstance } from '../../src/systems/equipment-lifecycle';
import { recoverGrowthFacts } from '../../src/systems/growth-evidence';
import { growthSystem } from '../../src/systems/growth-system';
import type { GrowthReturnFacts } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { InventoryStore } from '../../src/systems/inventory-store';
import { tideSystem } from '../../src/systems/tide-system';
import type { TideState } from '../../src/types/game-types';
import type { InventoryState } from '../../src/types/inventory-types';

const noFacts: GrowthReturnFacts = {
  impactOccurred: false, offeringCompleted: false, toolRevealed: false, leftFiniteCrest: false,
};
const checks: { name: string; result: 'PASS'; facts: GrowthReturnFacts; inventoryHash: string; cycle: number }[] = [];
let purityReads = 0;

function createStore(): InventoryStore {
  const store = new InventoryStore();
  store.configure({ weaponDefinition: id => WEAPON_DATA[id], starterDefinitionId: 'crowbar_plain',
    isPassiveTool: contaminant => getContaminantSlot(contaminant) === 'passive' });
  return store;
}

function snapshotWorld() {
  return { game: gameState.getState(), growth: growthSystem.getState(), tide: tideSystem.getState(),
    forecast: impactSystem.getForecastState() };
}

function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function check(name: string, store: InventoryStore, tide: TideState, cycle: number, expected: Partial<GrowthReturnFacts> = {}): void {
  const inventory: InventoryState = store.getState();
  const validator = createStore();
  assert(validator.loadState(structuredClone(inventory)), `${name}: production inventory must admit this fixture`);
  const beforeInventory = JSON.stringify(inventory);
  const beforeTide = JSON.stringify(tide);
  const beforeWorld = snapshotWorld();
  let publications = 0;
  let writes = 0;
  const unsubscribe = store.subscribe(() => { publications++; });
  store.setPersistence(() => { writes++; });
  freeze(inventory); freeze(tide);
  const random = Math.random;
  let facts: GrowthReturnFacts;
  try {
    Math.random = () => { throw new Error('Evidence recovery must not consume randomness'); };
    facts = recoverGrowthFacts(inventory, tide, cycle);
    assert.deepEqual(facts, { ...noFacts, ...expected }, name);
    assert.deepEqual(recoverGrowthFacts(inventory, tide, cycle), facts, `${name}: repeat read`);
    purityReads += 2;
  } finally {
    Math.random = random;
    store.setPersistence(null);
    unsubscribe();
  }
  assert.equal(JSON.stringify(inventory), beforeInventory);
  assert.equal(JSON.stringify(tide), beforeTide);
  assert.equal(JSON.stringify(store.getState()), beforeInventory);
  assert.deepEqual(snapshotWorld(), beforeWorld);
  assert.equal(publications, 0);
  assert.equal(writes, 0);
  checks.push({ name, result: 'PASS', facts, cycle,
    inventoryHash: createHash('sha256').update(beforeInventory).digest('hex') });
  console.log(`PASS ${name}`);
}

function catalogStore(slot: 'active' | 'passive' | null): { store: InventoryStore; id: string } {
  const definition = Object.values(CATALOG_ITEMS).find(item => item.slot === slot)!;
  assert(definition);
  const store = createStore();
  const id = `evidence-${definition.id}`;
  assert(store.addContaminant(createCatalogContaminant({ id, definitionId: definition.id,
    appearanceId: 'wax_parcel', offeringProfileId: 'quiet', quality: 'ordinary', acquiredOrdinal: 0 })).ok);
  assert(store.slotOffering(id, 0).ok);
  return { store, id };
}

function advanceUntil(matches: (state: TideState) => boolean, intact: boolean): void {
  for (let count = 0; count < 32 && !matches(tideSystem.getState()); count++) tideSystem.advanceCycle(intact);
  assert(matches(tideSystem.getState()), 'expected finite tide transition within 32 returns');
}

gameState.reset(); growthSystem.reset(); tideSystem.reset(); impactSystem.resetForecastState();
const rise = tideSystem.getState();
const empty = createStore();
check('new empty record proves no experience', empty, { ...rise }, 0);
check('large cycle count alone proves no impact or success', empty, { ...rise }, 500);
assert(empty.ensureStarter('starter-whiteboard').ok);
check('granted ready starter weapon is not a completed offering', empty, { ...rise }, 0);
assert(empty.beginRun('first-return').ok);
check('active ledger never proves a settled impact', empty, { ...rise }, 500);
assert(empty.settleRun('first-return', 'extract', 0).ok);
check('settled ledger before base settlement proves no impact', empty, { ...rise }, 500);
gameState.incrementCycle();
assert.equal(impactSystem.run([]).skipped, true);
assert(empty.markBaseSettled().ok);
check('real first return with base receipt remains impact-exempt', empty, { ...rise }, gameState.getCycle());
assert(empty.beginRun('second-return').ok);
gameState.incrementCycle();
assert(empty.settleRun('second-return', 'extract', 0).ok);
assert.equal(impactSystem.run([]).skipped, false);
check('real second impact without the base receipt is not yet historical proof', empty, { ...rise }, gameState.getCycle());
assert(empty.markBaseSettled().ok);
check('real second return with completed base receipt proves impact', empty, { ...rise }, gameState.getCycle(), { impactOccurred: true });

for (const outcome of ['death', 'abandon'] as const) {
  const store = createStore();
  assert(store.ensureStarter(`starter-${outcome}`).ok);
  assert(store.beginRun(`returned-${outcome}`).ok);
  assert(store.settleRun(`returned-${outcome}`, outcome).ok);
  assert.equal(impactSystem.run([]).skipped, false);
  assert(store.markBaseSettled().ok);
  check(`${outcome} with completed base receipt proves impact but no successful-return fact`, store, { ...rise }, 2,
    { impactOccurred: true });
}

const legacy = createStore();
assert(legacy.addContaminant({ id: 'legacy-known', type: 'solidify', rarity: 'common', quality: 'ordinary',
  stage: 'tool', impactCharges: 3, usesRemaining: 2 }).ok);
check('mature legacy tool proves only usable-tool revelation', legacy, { ...rise }, 0, { toolRevealed: true });

for (const slot of ['active', 'passive'] as const) {
  const { store, id } = catalogStore(slot);
  check(`unknown catalog ${slot} tool proves no offering or revelation`, store, { ...rise }, 0);
  const incomplete = store.finishOfferingImpact([id], 1, {}, `partial-${slot}`);
  assert(incomplete.ok); assert.equal(incomplete.value.length, 0);
  check(`empty ${slot} offering receipt proves no completion`, store, { ...rise }, 0);
  const completed = store.finishOfferingImpact([id], 2, {}, `complete-${slot}`);
  assert(completed.ok); assert.equal(completed.value.length, 1);
  check(`mature catalog ${slot} tool and receipt prove offering and revelation`, store, { ...rise }, 0,
    { offeringCompleted: true, toolRevealed: true });
  // Historic discovery knowledge survives loss of the actual item and receipt pruning.
  assert(store.discardAtBase(id).ok);
  const discoveryOnly = store.getState(); discoveryOnly.offeringReceipts = {};
  assert(store.loadState(discoveryOnly));
  check(`discovered ${slot} definition proves both facts after the item is lost`, store, { ...rise }, 0,
    { offeringCompleted: true, toolRevealed: true });
}

const inert = catalogStore(null);
assert(inert.store.finishOfferingImpact([inert.id], 3, {}, 'complete-inert').ok);
assert.equal(inert.store.getItem(inert.id)?.kind, 'contaminant');
check('completed inert offering proves completion but never a usable tool', inert.store, { ...rise }, 0,
  { offeringCompleted: true });
const inertDiscoveryOnly = inert.store.getState(); inertDiscoveryOnly.offeringReceipts = {};
assert(inert.store.loadState(inertDiscoveryOnly));
check('inert catalog discovery alone does not invent a usable-tool or offering fact', inert.store, { ...rise }, 0);

const historicReceipt = createStore();
assert(historicReceipt.ensureStarter('receipt-starter').ok);
assert(historicReceipt.beginRun('weapon-supply').ok);
assert(historicReceipt.revealBatch('weapon-node', [{ kind: 'weapon', id: 'former-weapon',
  weapon: createWeaponInstance('crowbar_plain', false, 'former-weapon') }], { x: 0, y: 0 }).ok);
assert(historicReceipt.settleRun('weapon-supply', 'extract').ok);
assert(historicReceipt.slotOffering('former-weapon', 0).ok);
const incompleteWeapon = historicReceipt.finishOfferingImpact(['former-weapon'], 1, {}, 'empty-weapon');
assert(incompleteWeapon.ok); assert.equal(incompleteWeapon.value.length, 0);
check('empty historic weapon receipt proves no completion', historicReceipt, { ...rise }, 0);
const matureWeapon = historicReceipt.finishOfferingImpact(['former-weapon'], 2, {}, 'historical-weapon');
assert(matureWeapon.ok); assert.equal(matureWeapon.value.length, 1);
assert(historicReceipt.discardAtBase('former-weapon').ok);
check('nonempty historic weapon receipt proves completion even after item loss', historicReceipt, { ...rise }, 0,
  { offeringCompleted: true });

tideSystem.reset();
advanceUntil(state => state.phase === 'crest', true);
check('entering the first crest does not prove leaving it', createStore(), tideSystem.getState(), 0);
advanceUntil(state => state.phase === 'ebb', false);
check('leaving a failed finite crest proves experience without intact-crest success', createStore(), tideSystem.getState(), 0,
  { leftFiniteCrest: true });
advanceUntil(state => state.tideNumber > 1, false);
check('later tide proves prior finite-crest experience without success inference', createStore(), tideSystem.getState(), 0,
  { leftFiniteCrest: true });

const sources = ['src/systems/growth-evidence.ts', 'src/systems/growth-system.ts', 'src/systems/inventory-store.ts',
  'src/systems/contaminant-catalog.ts', 'tools/growth/check-growth-evidence.ts'];
const out = process.argv[2] ?? 'docs/qa/artifacts/iteration-29/growth-evidence.json';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ iteration: 29, feature: 'COH-F029', result: 'PASS', verifiedAt: new Date().toISOString(),
  revision: 'working-tree', method: 'real InventoryStore mutations and validation; actual ImpactSystem first/second returns; repeated frozen-input evidence queries',
  checkCount: checks.length, purityReads, checks,
  sourceSha256: Object.fromEntries(sources.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])),
  limitations: ['Controlled automated records; no natural acquisition, browser interaction or player acceptance claimed.'] }, null, 2) + '\n');
gameState.reset(); growthSystem.reset(); tideSystem.reset(); impactSystem.resetForecastState();
console.log(`${checks.length} growth evidence checks and ${purityReads} pure reads passed; ${out}`);
