/** Inventory transaction history checks, no user storage or rendered scene. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { InventoryStore } from '../../src/systems/inventory-store';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import type { InventoryState } from '../../src/types/inventory-types';
import type { RiftWorldHistory } from '../../src/types/rift-world-history';

const base = JSON.parse(readFileSync('tools/recovery/fixtures/prepared-base.json', 'utf8')).record.inventory as InventoryState;
const store = new InventoryStore();
store.configure({ weaponDefinition: id => WEAPON_DATA[id] });
const loadBase = () => { store.setPersistence(null); assert(store.loadState(structuredClone(base))); };
const visit = { worldId: 'ash-strata', grade: 'medium' as const };
let checks = 0;
const check = (name: string, fn: () => void) => { fn(); checks++; console.log(`PASS ${name}`); };
check('fresh and legacy schema 1/2/3 have empty history, preserving items', () => {
  assert.equal(store.getState().version, 4);
  assert.deepEqual(store.getRiftWorldHistory(), { version: 1, visits: [] });
  for (const version of [1, 2, 3] as const) {
    const legacy = structuredClone(base); legacy.version = version; delete legacy.riftWorldHistory;
    assert(store.loadState(legacy)); assert.equal(store.getState().version, 4);
    assert.deepEqual(store.getRiftWorldHistory(), { version: 1, visits: [] });
    assert.deepEqual(store.getState().items, base.items);
  }
});
check('current schema rejects corrupt or absent history without replacing live state', () => {
  loadBase(); const before = store.getState();
  for (const history of [undefined, null, { version: 2, visits: [] }, { version: 1, visits: Array(9).fill(visit) },
    { version: 1, visits: [{ ...visit, grade: 'impossible' }] }, { version: 1, visits: [{ ...visit, worldId: '' }] }]) {
    const bad = { ...before, riftWorldHistory: history } as unknown as InventoryState;
    assert.equal(store.loadState(bad), false); assert.deepEqual(store.getState(), before);
  }
  const retired = { ...before, riftWorldHistory: { version: 1, visits: [{ worldId: 'retired-native-world', grade: 'low' }] } } as InventoryState;
  assert(store.loadState(retired)); assert.deepEqual(store.getRiftWorldHistory(), retired.riftWorldHistory);
});
check('missing weapon, overweight and refused storage never publish a visit', () => {
  store.reset(); assert.equal(store.beginRun('no-weapon', undefined, visit).ok, false);
  assert.equal(store.getRiftWorldHistory().visits.length, 0);
  loadBase(); const before = store.getState();
  store.configure({ capacity: 0 }); assert.deepEqual(store.beginRun('too-heavy', undefined, visit), { ok: false, error: 'overweight' });
  assert.deepEqual(store.getState(), before); store.configure({ capacity: 160 });
  store.setPersistence(() => { throw new Error('refused storage'); });
  assert.deepEqual(store.beginRun('refused', undefined, visit), { ok: false, error: 'storage-failed' });
  assert.deepEqual(store.getState(), before); store.setPersistence(null);
});
check('successful commits are bounded across grades and duplicate beginRun is not replayed', () => {
  loadBase();
  for (let index = 0; index < 12; index++) {
    const id = `run-${index}`;
    assert(store.beginRun(id, undefined, { worldId: `native-${index}`, grade: (['low', 'medium', 'severe'] as const)[index % 3]! }).ok);
    const committed = store.getRiftWorldHistory();
    assert.deepEqual(store.beginRun(id, undefined, visit), { ok: false, error: 'run-active' });
    assert.deepEqual(store.getRiftWorldHistory(), committed);
    assert(store.settleRun(id, 'extract').ok);
    assert.deepEqual(store.getRiftWorldHistory(), committed, 'return does not remove committed departure');
  }
  assert.deepEqual(store.getRiftWorldHistory().visits.map(row => row.worldId), Array.from({ length: 8 }, (_, i) => `native-${i + 4}`));
  const saved = store.getState(), history = store.getRiftWorldHistory();
  for (let index = 0; index < 3; index++) { assert(store.loadState(saved)); assert.deepEqual(store.getRiftWorldHistory(), history); }
  (history as { visits: unknown[] }).visits.length = 0;
  assert.equal(store.getRiftWorldHistory().visits.length, 8, 'getter cannot mutate owner');
});
check('death, abandon and explicit fresh reset preserve only their defined history', () => {
  for (const outcome of ['death', 'abandon', 'abandon-keep'] as const) {
    loadBase(); assert(store.beginRun(outcome, undefined, visit).ok);
    const history: RiftWorldHistory = store.getRiftWorldHistory();
    assert(store.settleRun(outcome, outcome).ok); assert.deepEqual(store.getRiftWorldHistory(), history);
  }
  store.reset(); assert.equal(store.getRiftWorldHistory().visits.length, 0);
});
console.log(`World history: ${checks} checks passed.`);
