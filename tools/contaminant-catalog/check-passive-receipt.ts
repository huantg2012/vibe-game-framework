import assert from 'node:assert/strict';
import { InventoryStore } from '../../src/systems/inventory-store';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { createCatalogContaminant } from '../../src/systems/contaminant-catalog';
import { projectRunPassiveReceipts } from '../../src/systems/run-passive-receipt';
import type { InventoryState } from '../../src/types/inventory-types';

const versions = { catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 } as const;
let serial = 0, checks = 0;
function check(name: string, run: () => void): void { run(); checks++; console.log(`PASS ${name}`); }
function store(): InventoryStore {
  const result = new InventoryStore();
  result.configure({ weaponDefinition: id => WEAPON_DATA[id], starterDefinitionId: 'crowbar_plain' });
  assert(result.ensureStarter().ok);
  return result;
}
function prepared(definitionId = 'brass_monocle', remaining = 2): { inventory: InventoryStore; id: string } {
  const inventory = store();
  const contaminant = createCatalogContaminant({ id: `receipt-${++serial}`, definitionId,
    appearanceId: 'wax_parcel', offeringProfileId: 'resist_35', quality: 'ordinary', acquiredOrdinal: 0 });
  assert(inventory.addContaminant(contaminant).ok);
  assert(inventory.slotOffering(contaminant.id, 0).ok);
  assert(inventory.finishOfferingImpact([contaminant.id], 3, {}, `reveal:${contaminant.id}`).ok);
  const state = inventory.getState();
  const item = state.items.find(value => value.id === contaminant.id)!;
  if (item.kind === 'contaminant') item.contaminant.usesRemaining = remaining;
  assert(inventory.loadState(state));
  assert(inventory.prepareTool(contaminant.id, 2).ok);
  return { inventory, id: contaminant.id };
}

check('no companion and historical settled record do not fabricate facts', () => {
  const inventory = store();
  assert(inventory.beginRun('empty', versions).ok);
  assert.deepEqual(projectRunPassiveReceipts(inventory.getRun()!.passiveReceipts), []);
  assert(inventory.settleRun('empty', 'extract').ok);
  const old = inventory.getState(); delete old.run!.passiveReceipts;
  assert(inventory.loadState(old));
  assert.equal(inventory.getRun()!.passiveReceipts, undefined);
});
check('sight and capacity freeze real parameters and pay only once on departure', () => {
  for (const [definition, effect] of [['brass_monocle', '视距 ×1.1'], ['brass_back_buckle', '负重上限 +4']]) {
    const { inventory, id } = prepared(definition);
    let written: InventoryState | undefined;
    inventory.setPersistence(state => { written = state; });
    assert(inventory.beginRun('paid', versions).ok);
    const receipt = inventory.getRun()!.passiveReceipts![0]!;
    assert.equal(receipt.itemId, id); assert.equal(receipt.usesRemaining, 1);
    assert.deepEqual(written!.run!.passiveReceipts, [receipt]);
    assert.equal(projectRunPassiveReceipts([receipt])[0]!.effect, effect);
    assert.equal(projectRunPassiveReceipts([receipt])[0]!.consumption, '消耗 1 趟');
    const before = inventory.getState();
    assert(!inventory.beginRun('paid', versions).ok);
    assert(!inventory.beginRun('different', versions).ok);
    assert.deepEqual(inventory.getState(), before);
    const reload = store(); assert(reload.loadState(before)); assert.deepEqual(reload.getState(), before);
  }
});
check('failed departure and canceled world frame preserve both charge and receipt', () => {
  const { inventory } = prepared(); const before = inventory.getState();
  inventory.setPersistence(() => { throw Error('quota'); });
  assert.deepEqual(inventory.beginRun('denied', versions), { ok: false, error: 'storage-failed' });
  assert.deepEqual(inventory.getState(), before);
  inventory.setPersistence(null); inventory.beginFrameTransaction();
  assert(inventory.beginRun('canceled', versions).ok); inventory.cancelFrameTransaction();
  assert.deepEqual(inventory.getState(), before);
});
check('final use remains truthful through extract, death, abandon, reload and cleanup', () => {
  for (const outcome of ['extract', 'death', 'abandon', 'abandon-keep'] as const) {
    const { inventory, id } = prepared('reverse_woven_basket', 1);
    assert(inventory.beginRun(outcome, versions).ok);
    const receipts = inventory.getState().run!.passiveReceipts!;
    assert.equal(receipts[0]!.usesRemaining, 0);
    assert.equal(inventory.getCapacity(), 240);
    assert(inventory.settleRun(outcome, outcome, 4).ok);
    assert.equal(inventory.getItem(id), undefined);
    assert.deepEqual(inventory.getRun()!.passiveReceipts, receipts);
    assert.equal(inventory.getRun()!.kindlingGained, outcome === 'extract' ? 4 : 0);
    const reload = store(); assert(reload.loadState(inventory.getState()));
    assert.deepEqual(projectRunPassiveReceipts(reload.getRun()!.passiveReceipts), [{
      name: '反编藤篮', effect: '负重上限 +8', consumption: '消耗 1 趟',
    }]);
    assert(reload.settleRun(outcome, outcome).ok); assert(reload.markBaseSettled().ok);
    assert.deepEqual(reload.getRun()!.passiveReceipts, receipts);
  }
});
check('old active records derive only the existing consumed binding without spending again', () => {
  const { inventory, id } = prepared('brass_monocle', 1);
  assert(inventory.beginRun('old', versions).ok);
  const before = inventory.getState(), old = structuredClone(before); delete old.run!.passiveReceipts;
  assert(inventory.loadState(old)); assert.deepEqual(inventory.getState(), before);
  assert.equal(old.run!.passiveReceipts, undefined, 'do not mutate the caller');
  const invalid = structuredClone(old);
  const item = invalid.items.find(value => value.id === id)!;
  if (item.kind === 'contaminant') item.contaminant.catalog!.runBinding!.runId = 'other';
  assert(!inventory.loadState(invalid));
});
check('forged, inconsistent, hidden, duplicate or missing companion receipts are rejected', () => {
  const { inventory } = prepared(); assert(inventory.beginRun('valid', versions).ok);
  const before = inventory.getState();
  const mutations: ((state: InventoryState) => void)[] = [
    state => { state.run!.passiveReceipts![0]!.benefit = 100; },
    state => { state.run!.passiveReceipts![0]!.usesRemaining = 100; },
    state => { state.run!.passiveReceipts![0]!.publicName = '未曾揭晓的名称'; },
    state => { state.run!.passiveReceipts![0]!.definitionId = 'amber_beetle'; },
    state => { state.run!.passiveReceipts![0]!.familyId = 'capacity'; },
    state => { state.run!.passiveReceipts!.push(state.run!.passiveReceipts![0]!); },
    state => { state.run!.passiveReceipts = []; },
    state => { state.run!.carriedOutIds = []; },
    state => { state.run!.passiveReceipts = null as never; },
  ];
  for (const mutate of mutations) {
    const invalid = structuredClone(before); mutate(invalid);
    assert(!inventory.loadState(invalid)); assert.deepEqual(inventory.getState(), before);
  }
});
console.log(`Passive receipt: ${checks} contract groups passed`);
