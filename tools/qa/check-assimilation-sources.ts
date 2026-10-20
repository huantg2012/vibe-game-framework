/** Source history follows the real scalar and complete save transactions; no browser saves. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { performHealingCycle } from '../../src/managers/healing-cycle';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { tideSystem } from '../../src/systems/tide-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { impactSystem } from '../../src/systems/impact-system';
import { normalizeAssimilationSources, validAssimilationSources } from '../../src/systems/assimilation-system';
import type { SaveDataV2 } from '../../src/types/game-types';

const records = new Map<string, string>();
let rejectWrites = false;
saveManager.setStorage({
  getItem: key => records.get(key) ?? null,
  removeItem: key => { records.delete(key); },
  setItem: (key, bytes) => { if (rejectWrites) throw Error('simulated refusal'); records.set(key, bytes); },
});
const read = (): SaveDataV2 => JSON.parse(records.get(GAME_CONSTANTS.SAVE.KEY)!) as SaveDataV2;
function reset(): void {
  saveManager.deleteSave(); gameState.reset(); growthSystem.reset(); tideSystem.reset();
  stabilityTracker.reset(); contaminantSystem.reset(); impactSystem.resetForecastState();
}
function sum(): number {
  const sources = gameState.getAssimilationSources();
  return sources.unattributed + Object.values(sources.worlds).reduce((total, value) => total + value, 0);
}
function near(a: number, b: number): void { assert(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`); }

reset();
gameState.setAssimilation(20, 'crystal-fibre');
gameState.setAssimilation(35, 'ruptured-film');
gameState.setAssimilation(40, 'ember-spine');
assert.deepEqual(gameState.getAssimilationSources(), {
  version: 1, worlds: { 'crystal-fibre': 20, 'ruptured-film': 15, 'ember-spine': 5 }, unattributed: 0,
});
const stable = structuredClone(gameState.getAssimilationSources());
gameState.setAssimilation(40, 'another-world');
assert.deepEqual(gameState.getAssimilationSources(), stable, 'entering another world does not recolour history');
gameState.setAssimilation(110, 'crystal-fibre');
gameState.setAssimilation(110, 'ruptured-film');
assert.equal(gameState.getAssimilationSources().worlds['crystal-fibre'], 80);
assert.equal(gameState.getAssimilationSources().worlds['ruptured-film'], 15);
assert.equal(gameState.getAssimilation(), 100);
near(sum(), 100);
const beforeInvalid = gameState.getState();
assert.throws(() => gameState.setAssimilation(99, '__proto__'));
assert.deepEqual(gameState.getState(), beforeInvalid);

// Snapshots are owned copies, so healing and later exposure cannot mutate rollback history.
gameState.setAssimilation(50);
assert.equal(beforeInvalid.assimilationSources.worlds['crystal-fibre'], 80);
near(gameState.getAssimilationSources().worlds['crystal-fibre']!, 40);
gameState.loadState(beforeInvalid);
assert.equal(gameState.getAssimilationSources().worlds['crystal-fibre'], 80);
gameState.setAssimilation(0);
assert.deepEqual(gameState.getAssimilationSources(), { version: 1, worlds: {}, unattributed: 0 });

reset();
gameState.setAssimilation(30, 'crystal-fibre');
assert(saveManager.trySave());
const legacy = read();
delete legacy.assimilationSources;
records.set(GAME_CONSTANTS.SAVE.KEY, JSON.stringify(legacy));
gameState.reset();
assert(saveManager.load());
assert.deepEqual(gameState.getAssimilationSources(), { version: 1, worlds: {}, unattributed: 30 });
assert.deepEqual(read().assimilationSources, gameState.getAssimilationSources(), 'base migration is durable');
gameState.setAssimilation(40, 'ruptured-film');
assert.deepEqual(gameState.getAssimilationSources(), { version: 1, worlds: { 'ruptured-film': 10 }, unattributed: 30 });
const beforeHealing = gameState.getState();
assert(saveManager.trySave());
const preHealingBytes = records.get(GAME_CONSTANTS.SAVE.KEY);
rejectWrites = true;
const refused = performHealingCycle();
assert(!refused.ok && refused.reason === 'storage-failed');
assert.equal(gameState.getAssimilation(), 25);
near(gameState.getAssimilationSources().worlds['ruptured-film']!, 6.25);
near(gameState.getAssimilationSources().unattributed, 18.75);
assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), preHealingBytes);
assert.equal(beforeHealing.assimilationSources.unattributed, 30);
const frozenCandidate = gameState.getState();
assert.deepEqual(performHealingCycle(), { ok: false, reason: 'pending-save' });
rejectWrites = false;
assert(saveManager.trySave());
assert.deepEqual(read().assimilationSources, frozenCandidate.assimilationSources);
gameState.reset();
assert(saveManager.load());
assert.deepEqual(gameState.getAssimilationSources(), frozenCandidate.assimilationSources);
near(sum(), gameState.getAssimilation());

for (const outcome of ['extract', 'death', 'abandon'] as const) {
  reset();
  gameState.setAssimilation(12.5, 'crystal-fibre');
  assert(saveManager.trySave());
  assert(inventoryStore.ensureStarter(`source-${outcome}`).ok);
  assert(inventoryStore.beginRun(`source-run-${outcome}`).ok);
  gameState.setAssimilation(18, 'ruptured-film');
  assert(inventoryStore.settleRun(`source-run-${outcome}`, outcome).ok);
  const settledSources = read().assimilationSources;
  assert.deepEqual(settledSources, { version: 1, worlds: { 'crystal-fibre': 12.5, 'ruptured-film': 5.5 }, unattributed: 0 });
  assert(inventoryStore.markBaseSettled().ok);
  gameState.reset();
  assert(saveManager.load());
  assert.deepEqual(gameState.getAssimilationSources(), settledSources);
}

const good = read();
for (const malformed of [
  null, { version: 2, worlds: {}, unattributed: 18 },
  { version: 1, worlds: [], unattributed: 18 },
  { version: 1, worlds: { 'crystal-fibre': -1 }, unattributed: 19 },
  { version: 1, worlds: { 'crystal-fibre': 20 }, unattributed: 0 },
  { version: 1, worlds: { 'crystal-fibre': 0 }, unattributed: 18 },
  { version: 1, worlds: { '../fake': 1 }, unattributed: 17 },
  { version: 1, worlds: {}, unattributed: '18' },
]) {
  const bytes = JSON.stringify({ ...good, assimilationSources: malformed });
  records.set(GAME_CONSTANTS.SAVE.KEY, bytes);
  const before = gameState.getState();
  assert.equal(saveManager.load(), false);
  assert.deepEqual(gameState.getState(), before, 'malformed source spectrum cannot partially hydrate');
  assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), bytes);
}
assert.deepEqual(normalizeAssimilationSources(18, { version: 1, worlds: { 'retired-world': 6 }, unattributed: 2 }),
  { version: 1, worlds: { 'retired-world': 6 }, unattributed: 12 });
assert.equal(validAssimilationSources({ version: 1, worlds: { 'crystal-fibre': Infinity }, unattributed: 0 }, 18), false);
assert.equal(validAssimilationSources({ version: 1, worlds: {}, unattributed: NaN }, 18), false);
reset();
for (let i = 0; i < 100_000; i++) {
  gameState.setAssimilation(Math.min(100, gameState.getAssimilation() + .0001), i % 2 ? 'crystal-fibre' : 'ruptured-film');
}
near(sum(), gameState.getAssimilation());
assert(validAssimilationSources(gameState.getAssimilationSources(), gameState.getAssimilation()));
assert(saveManager.trySave());
assert(saveManager.load());
near(sum(), gameState.getAssimilation());
gameState.addKindling(10);
gameState.applyDamage('CORE', 10);
assert(saveManager.trySave());
const beforeRejectedRepair = gameState.getState();
const beforeRejectedRepairBytes = records.get(GAME_CONSTANTS.SAVE.KEY);
rejectWrites = true;
assert.equal(saveManager.allocateToModule('CORE', 1), 0);
rejectWrites = false;
assert.deepEqual(gameState.getState(), beforeRejectedRepair, 'whole-state rollback restores the same source spectrum');
assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), beforeRejectedRepairBytes);
inventoryStore.setPersistence(null);
console.log('PASS assimilation sources: real deltas, cap, legacy neutral, proportional healing, frozen retry, cold base load, three outcomes, malformed envelope rejection, failed-repair rollback, snapshots and 100k steps');
