/** Real durable growth purchase + prose qualification; isolated memory record only. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { saveManager } from '../../src/managers/save-manager';
import { gameState } from '../../src/managers/game-state';
import { purchaseGrowth } from '../../src/managers/growth-purchases';
import { growthSystem } from '../../src/systems/growth-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { tideSystem } from '../../src/systems/tide-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { resetDefenseEngine } from '../../src/systems/defense-engine';
import { PreparationNarrationAdapter } from '../../src/narrative/preparation-narration-adapter';
import { PREPARATION_NARRATION_POOLS } from '../../src/generated/preparation-narration-data';

const records = new Map<string, string>();
let rejectWrites = false;
const memory: Storage = {
 get length() { return records.size; }, key(index) { return [...records.keys()][index] ?? null; },
 getItem(key) { return records.get(key) ?? null; }, removeItem(key) { records.delete(key); }, clear() { records.clear(); },
 setItem(key, value) { if (rejectWrites) throw Error('simulated refusal'); records.set(key, value); },
};
const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: memory });
const adapter = new PreparationNarrationAdapter(inventoryStore);
const frame = { grade: 'low' as const, visible: true, paused: false };
function currentPool(expected: 'prepare.baseline.low' | 'prepare.body_growth'): void {
 const journey = adapter.createJourney();
 const text = journey.update(250, frame);
 assert(PREPARATION_NARRATION_POOLS[expected].lines.some(row => row.text === text), `Expected ${expected}: ${text}`);
 journey.destroy();
}
try {
 inventoryStore.setPersistence(null);
 gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); resetDefenseEngine(); contaminantSystem.reset();
 gameState.addKindling(1000);
 assert(saveManager.trySave());
 const beforeBytes = memory.getItem(GAME_CONSTANTS.SAVE.KEY);
 const beforeReserve = gameState.getKindlingReserve();
 const beforeGrowth = growthSystem.getState();
 const beforeStability = stabilityTracker.getState();
 rejectWrites = true;
 assert.deepEqual(purchaseGrowth('growth_vitality'), { ok: false, reason: 'storage-failed' });
 assert.equal(gameState.getKindlingReserve(), beforeReserve);
 assert.deepEqual(growthSystem.getState(), beforeGrowth);
 assert.deepEqual(stabilityTracker.getState(), beforeStability);
 assert.equal(memory.getItem(GAME_CONSTANTS.SAVE.KEY), beforeBytes);
 currentPool('prepare.baseline.low');
 rejectWrites = false;
 const purchase = purchaseGrowth('growth_vitality');
 assert(purchase.ok); assert.equal(growthSystem.getLevel('growth_vitality'), 1);
 assert.equal(gameState.getKindlingReserve(), beforeReserve - purchase.spent);
 const saved = JSON.parse(memory.getItem(GAME_CONSTANTS.SAVE.KEY)!);
 assert.equal(saved.growth.upgrades.growth_vitality, 1);
 assert.equal(saved.kindlingReserve, gameState.getKindlingReserve());
 currentPool('prepare.body_growth');
 adapter.clearRecent();
 assert(purchaseGrowth('growth_kindling_affinity').ok);
 currentPool('prepare.baseline.low');
 console.log('PASS real purchaseGrowth/SaveManager: refusal restores reserve, growth, stability and bytes with no prose; successful vitality saves payment then unlocks body prose; successful affinity does not unlock body prose');
} finally {
 adapter.destroy(); inventoryStore.setPersistence(null);
 if (original) Object.defineProperty(globalThis, 'localStorage', original); else Reflect.deleteProperty(globalThis, 'localStorage');
}
