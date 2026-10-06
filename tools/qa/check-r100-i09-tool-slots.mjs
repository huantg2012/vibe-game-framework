/** Offline controller contract, not game execution or economic evidence.
 * Exercises the real I09 encounter policy against a controlled public scene.
 * Run: node --import tsx tools/qa/check-r100-i09-tool-slots.mjs */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { GAME_CONSTANTS } from '../../src/config/constants.ts';
import { activeToolSlots, planOwnedToolEquipment } from './r100-i09-tool-slots.mjs';
import { createVisibleEncounterPolicy } from './r100-i09-costed-encounters.mjs';

const keys = GAME_CONSTANTS.CONTAMINANT.SORTIE_ACTIVE_KEYS;
const bindings = count => Array.from({ length: count }, (_, index) => ({ index, id: String(index),
  key: index === count - 1 ? null : keys[index], label: index === count - 1 ? '被动' : `工具 ${keys[index]}` }));
const fixture = count => ({ toolSlots: bindings(count), equipment: { toolIds: Array(count).fill(null), weaponId: null }, items: [] });
const tool = (id, count, passive = false, usesRemaining = 4) => ({ id, kind: 'contaminant', name: '已知物件',
  description: '原地留下假身8秒', canEquip: usesRemaining > 0, usesRemaining,
  toolSlots: Array.from({ length: count }, (_, index) => index).filter(index => passive === (index === count - 1)).map(String) });
const results = [];
for (const count of [3, 4]) {
  const owned = fixture(count);
  assert.deepEqual(activeToolSlots(owned).map(slot => slot.key), keys.slice(0, count - 1));
  owned.equipment.toolIds[0] = 'already'; owned.items.push(tool('already', count));
  for (let i = 1; i < count - 1; i++) owned.items.push(tool(`active-${i}`, count));
  owned.items.push(tool('passive', count, true), tool('unready', count, false, 0));
  const before = structuredClone(owned), plan = planOwnedToolEquipment(owned);
  assert.deepEqual(plan, Array.from({ length: count - 2 }, (_, index) => ({ slot: String(index + 1), label: `工具 ${keys[index + 1]}`, id: `active-${index + 1}` }))
    .concat({ slot: String(count - 1), label: '被动', id: 'passive' }));
  assert.deepEqual(owned, before, 'equipment planning cannot grant, mutate or consume items');
  results.push(`public ${count}-slot layout: exact labels, no duplicate equipment, real passive index`);
}
const malformed = fixture(4); malformed.toolSlots[3].key = 'G';
assert.throws(() => activeToolSlots(malformed), /last open slot is passive/);
assert.throws(() => activeToolSlots({ equipment: { toolIds: [] } }), /public runtime tool bindings/);

async function exercise(count, itemSlot, uses = 4) {
  const owned = fixture(count), id = `owned-${itemSlot}`;
  owned.equipment.toolIds[itemSlot] = id; owned.items.push(tool(id, count, itemSlot === count - 1, uses));
  let elapsedMs = 1000;
  const presses = [], logs = [], position = { x: 256, y: 256 };
  const enemy = { id: 'currently-visible', position: { x: 310, y: 256 }, facing: Math.PI, attack: 'idle' };
  const scene = {
    ai: { getEnemies: () => [{ getId: () => enemy.id, getPosition: () => enemy.position, getFacingAngle: () => enemy.facing }] },
    combat: { isEnemyAlive: () => true, getEnemyAttackVisualState: () => ({ phase: enemy.attack }), getHealth: () => 100 },
    visibilityAt: () => 1, hosts: { getSubjects: () => [] }, search: { nodes: [] },
    player: { getPosition: () => position, getFacingAngle: () => 0 }, chaos: { getValue: () => 0 },
    runController: { getElapsedMs: () => elapsedMs, isRunEnded: () => false },
    toolSystem: { exportRuntimeState: () => ({ catalog: { effects: [] } }) },
    formFloorGrid: { cols: 32, rows: 32, tileSize: 32, isWalkable: () => true },
  };
  const priorWindow = globalThis.window;
  globalThis.window = { __game: { scene: { getScene: name => { assert.equal(name, 'RiftScene'); return scene; } } } };
  const publicOwned = async () => structuredClone(owned);
  const page = { evaluate: async (callback, argument) => callback(argument), waitForTimeout: async ms => { elapsedMs += ms; } };
  const driver = {
    state: async () => ({ pos: { ...position }, hp: 100, elapsedMs, ended: false }),
    hold: async (_keys, ms) => { elapsedMs += ms; }, snap: async () => {}, log: row => logs.push(row),
    press: async key => {
      presses.push(key); const index = keys.findIndex(candidate => candidate.toLowerCase() === key);
      assert(index >= 0 && index < count - 1, 'controller must never activate a passive slot');
      const item = owned.items.find(candidate => candidate.id === owned.equipment.toolIds[index]);
      assert(item?.canEquip); item.usesRemaining--; item.canEquip = item.usesRemaining > 0;
    },
  };
  try {
    const policy = createVisibleEncounterPolicy(page, driver, publicOwned);
    const target = { id: 'observed-search', pos: { x: 450, y: 256 } };
    await policy.evade(target, await policy.observe());
    const active = itemSlot < count - 1 && uses > 0;
    assert.deepEqual(presses, active ? [keys[itemSlot].toLowerCase()] : []);
    assert.equal(owned.items[0].usesRemaining, uses - (active ? 1 : 0));
    if (active) {
      const cast = logs.find(row => row.event === 'known-tool-context-input');
      assert.equal(cast.slot, itemSlot); assert.equal(cast.key, keys[itemSlot]); assert.equal(cast.used, 1);
      await policy.evade(target, await policy.observe());
      assert.equal(presses.length, 1, 'existing 8000ms tool cooldown stays intact');
      elapsedMs += 8001;
      await policy.evade(target, await policy.observe());
      assert.equal(presses.length, uses > 1 ? 2 : 1, 'no use after last charge; no granted charges');
    }
    return { count, itemSlot, startingUses: uses, requestedKeys: presses, remainingUses: owned.items[0].usesRemaining };
  } finally { if (priorWindow === undefined) delete globalThis.window; else globalThis.window = priorWindow; }
}
const controlled = [];
for (const slot of [0, 1, 2, 3]) controlled.push(await exercise(4, slot));
controlled.push(await exercise(3, 2), await exercise(4, 2, 1), await exercise(4, 2, 0));
const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(sha('tools/qa/r100-i07-i09-journey.mjs'), '6e2b8d76a7e03a08e7b774d2465954e51636f8ceb2467dfdc880702541e3587f');
assert.equal(sha('tools/world-study/r100-p13-costed-encounters.mjs'), '8850a30414e72f0465304fc3c90e38a0e08406b9e442b9b8ea7bfaea80ae3715');
console.log(JSON.stringify({ status: 'pass-offline-controller-contract', results, controlled,
  preserved: ['original policy13 SHA', 'original P13 SHA', 'contextual use predicate', '8000ms cooldown', 'actual mock charge decrement', 'passive no hotkey'],
  limitation: 'Mock public scene and item charge handler. No browser, game outcome, or actual ability behavior is claimed.' }, null, 2));
