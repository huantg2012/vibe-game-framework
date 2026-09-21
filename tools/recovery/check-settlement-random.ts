/** Optional entropy injection only: real impact/forecast/inventory/save methods, no global RNG patch. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { impactSystem } from '../../src/systems/impact-system';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { tideSystem } from '../../src/systems/tide-system';
import { growthSystem } from '../../src/systems/growth-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { loadDefenseRuntimeState } from '../../src/systems/defense-engine';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { SeededRandom } from '../../src/utils/random';
import { mix32 } from '../../src/generation/seed-fork';
import type { ContaminantType } from '../../src/types/game-types';

const originalRandom = Math.random;
const records = new Map<string, string>();
let failWrites = false;
saveManager.setStorage({ getItem: key => records.get(key) ?? null, removeItem: key => { records.delete(key); },
  setItem: (key, value) => { if (failWrites) throw new Error('Injected base save failure'); records.set(key, value); } });
const key = GAME_CONSTANTS.SAVE.KEY;
function sequence(values: readonly number[]) {
  let draws = 0;
  return { random: () => { assert(draws < values.length, 'unexpected entropy consumption'); return values[draws++]!; },
    get draws() { return draws; } };
}
function reset() {
  failWrites = false; inventoryStore.setPersistence(null); saveManager.deleteSave();
  gameState.reset(); contaminantSystem.reset(); tideSystem.reset(); growthSystem.reset(); stabilityTracker.reset();
  loadDefenseRuntimeState(undefined);
  impactSystem.resetForecastState(); gameState.incrementCycle(); gameState.incrementCycle(); gameState.setImpactIntensity(tideSystem.getCurrentIntensity());
}
function tool(type: ContaminantType, id: string) {
  const item = contaminantSystem.createUnowned(type, CONTAMINANT_DATA[type].rarity);
  item.id = id; item.stage = 'tool'; item.usesRemaining = 2;
  assert(inventoryStore.addContaminant(item).ok);
  return id;
}
function snapshot() { return { game: gameState.getState(), inventory: inventoryStore.getState(),
  forecast: impactSystem.getForecastState(), echo: contaminantSystem.getEchoBonusState() }; }

// Both selection branches consume only the supplied stream, including fallback without a forecast.
reset();
const target = gameState.getModules()[0]!.id;
impactSystem.loadForecastState({ version: 1, targetId: target, committed: false, consumed: false,
  display: { targetId: target, severity: 'light' }, lookahead: null, queuedTargets: [], nextIntensity: 1, nextNextIntensity: 1 });
const miss = sequence([.99, .99]);
assert.equal(impactSystem.run([], undefined, miss.random).primaryModuleId, gameState.getModules().at(-1)!.id);
assert.equal(miss.draws, 2);
reset();
const fallback = sequence([0, .99]);
assert.equal(impactSystem.run([], undefined, fallback.random).primaryModuleId, gameState.getModules().at(-1)!.id);
assert.equal(fallback.draws, 2);

// Forecast target, blur and frozen actual target use the injected stream once.
reset();
const blurred = sequence([.4, .1, .7, .99, .99]);
impactSystem.generateForecast(2.2, 0, 2.8, blurred.random);
assert.deepEqual(impactSystem.getForecastDisplay(), { targetId: gameState.getModules()[1]!.id, severity: 'extreme' });
assert.equal(blurred.draws, 5);
assert.equal(impactSystem.getForecastState().actualPrimaryId, gameState.getModules().at(-1)!.id);
const display = impactSystem.getForecastState();
impactSystem.generateForecast(2.9, .99, 3, () => { throw new Error('already disclosed forecast must not reroll'); });
assert.deepEqual(impactSystem.getForecastState(), display);

// Previously committed lookahead is consumed, not drawn again; no new lookahead mechanism is introduced.
reset();
impactSystem.loadForecastState({ version: 1, targetId: 'CORE', committed: true, consumed: false,
  display: { targetId: 'CORE', severity: 'light' }, lookahead: { targetId: 'STORAGE', severity: 'moderate' },
  queuedTargets: ['STORAGE'], nextIntensity: 1, nextNextIntensity: 1.8 });
const forbiddenDraw = () => { throw new Error('committed target must not consume entropy'); };
assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, 'CORE');
impactSystem.generateForecast(1.8, 0, 2, forbiddenDraw);
assert.equal(impactSystem.getForecastDisplay()!.targetId, 'STORAGE');
assert.equal(impactSystem.getForecastLookahead(), null);
assert.equal(impactSystem.run([], undefined, forbiddenDraw).primaryModuleId, 'STORAGE');

// Failed persistence leaves the original settled record available. Reloading it reconstructs
// exactly the same decisions from a recreated stream, not from the advanced in-memory stream.
for (const seed of [1, 7, 19, 41, 0xffffffff]) {
  reset();
  const firstToolId = tool('compress', 'return-tool-a'), secondToolId = tool('muffle', 'return-tool-b');
  const offering = contaminantSystem.acquire('siphon', CONTAMINANT_DATA.siphon.rarity);
  assert(contaminantSystem.slotDefense(offering.id, 0));
  assert(inventoryStore.beginRun(`return-replay-${seed}`).ok);
  assert(inventoryStore.settleRun(`return-replay-${seed}`, 'extract', 3).ok);
  const initialForecast = new SeededRandom(mix32(seed, 'initial-forecast'));
  impactSystem.generateForecast(1, 0, 1.5, () => initialForecast.next());
  saveManager.save();
  const originalBytes = records.get(key)!;
  assert.equal(inventoryStore.getRun()!.status, 'settled'); assert(!inventoryStore.getRun()!.baseSettled);

  function replayReturn() {
    const impactRandom = new SeededRandom(mix32(seed, 'impact'));
    const forecastRandom = new SeededRandom(mix32(seed, 'forecast'));
    const offeringIds = inventoryStore.getOfferingItems().map(item => item?.id ?? null);
    const impact = impactSystem.run(contaminantSystem.getDefenseSlotted(), offeringIds, () => impactRandom.next());
    assert.equal(impact.defenseResult!.toolUseGrants, 0, 'current offering rules do not reactivate retired echo rewards');
    // Exercise the existing grant API separately. The current thirteen-family defense engine does not call it.
    const grants = [contaminantSystem.grantRandomToolUse(() => impactRandom.next()),
      contaminantSystem.grantRandomToolUse(() => impactRandom.next())];
    impactSystem.generateForecast(1.8, 0, 2.3, () => forecastRandom.next());
    return { impact, grants, state: snapshot() };
  }
  const first = replayReturn();
  assert(first.grants.every(Boolean));
  assert.deepEqual(first.state.inventory.items.map(item => item.id), JSON.parse(originalBytes).inventory.items.map((item: { id: string }) => item.id));
  assert(Object.keys(first.state.echo).every(id => id === firstToolId || id === secondToolId));
  failWrites = true; assert.equal(saveManager.trySave(), false);
  assert.equal(records.get(key), originalBytes);
  failWrites = false; assert(saveManager.load());
  assert.equal(inventoryStore.getRun()!.status, 'settled'); assert(!inventoryStore.getRun()!.baseSettled);
  const second = replayReturn();
  assert.deepEqual(second, first, `seed ${seed}: HP, primary module, tool grant, cap ledger and forecast must match after failed-write reload`);
  saveManager.save();
  const committed = snapshot();
  assert(saveManager.load());
  impactSystem.generateForecast(1.8, 0, 2.3, forbiddenDraw);
  assert.deepEqual(snapshot(), committed, 'committed forecast/grant counters are stable on repeated load');
}

// The existing per-tool cap survives JSON/storage reload; exhausted/empty pools draw nothing.
reset();
tool('compress', 'capped-a'); tool('muffle', 'capped-b');
const cap = GAME_CONSTANTS.CONTAMINANT.ECHO_MAX_TOOL_USE_BONUS;
const grant = sequence(Array(2 * cap).fill(0));
for (let index = 0; index < 2 * cap; index++) assert(contaminantSystem.grantRandomToolUse(grant.random));
assert.equal(grant.draws, 2 * cap);
assert(!contaminantSystem.grantRandomToolUse(forbiddenDraw));
impactSystem.generateForecast(1, 0, 1.5, () => .6); saveManager.save();
const capped = snapshot(); assert(saveManager.load()); assert(!contaminantSystem.grantRandomToolUse(forbiddenDraw));
assert.deepEqual(snapshot(), capped);
reset(); assert(!contaminantSystem.grantRandomToolUse(forbiddenDraw));
gameState.reset(); assert(impactSystem.run([], undefined, forbiddenDraw).skipped);
assert.equal(Math.random, originalRandom, 'test and implementation never patch the global random source');
inventoryStore.setPersistence(null);
console.log('check:settlement-random PASS: seeded primary/fallback and forecast blur; legacy lookahead/no reroll; five failed-save/reload returns; deterministic grants and persisted per-item cap. Impact invocation/baseSettled dedup remains the coordinator responsibility.');
