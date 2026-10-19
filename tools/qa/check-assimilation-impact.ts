/** Assimilation is bodily adaptation, never an amplifier for the world's tide.
 * Domain paths only; isolated storage, no browser saves or map generation.
 */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { getHealingPreview, performHealingCycle } from '../../src/managers/healing-cycle';
import { healingCyclesToClear } from '../../src/systems/assimilation-system';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';

const records = new Map<string, string>();
saveManager.setStorage({ getItem: key => records.get(key) ?? null,
  setItem: (key, bytes) => { records.set(key, bytes); }, removeItem: key => { records.delete(key); } });
function reset(assimilation: number, intensity: number): void {
  saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); contaminantSystem.reset(); stabilityTracker.reset(); tideSystem.reset();
  impactSystem.resetForecastState();
  gameState.incrementCycle(); gameState.incrementCycle();
  gameState.setAssimilation(assimilation); gameState.setImpactIntensity(intensity);
  impactSystem.generateForecast(intensity, 0, intensity, () => .4);
}
function addOffering(): void {
  assert(inventoryStore.addContaminant({ id: 'impact-fixture', type: 'mirror', rarity: 'common', quality: 'ordinary',
    stage: 'defense', impactCharges: 0, usesRemaining: 0 }).ok);
  assert(inventoryStore.slotOffering('impact-fixture', 0).ok);
}
let returnCases = 0;
for (const intensity of [1, 1.8, 3]) {
  for (const outcome of ['extract', 'death', 'abandon'] as const) {
    for (const defended of [false, true]) {
      let reference: unknown;
      for (const assimilation of [0, 30, 60, 100]) {
        reset(assimilation, intensity);
        if (defended) addOffering();
        assert(inventoryStore.ensureStarter('impact-starter').ok);
        const weapon = inventoryStore.getItems().find(item => item.kind === 'weapon' && item.weapon.stage === 'tool');
        assert(weapon && inventoryStore.prepareWeapon(weapon.id).ok);
        assert(inventoryStore.beginRun('impact-return').ok);
        assert(inventoryStore.settleRun('impact-return', outcome).ok);
        assert.equal(gameState.getAssimilation(), assimilation, 'ending a run keeps the body state');
        const readings = [0, 1, 2, 3].map(level => impactSystem.getForecastReading(level));
        const ids = inventoryStore.getOfferingItems().map(item => item?.id ?? null);
        const result = impactSystem.run(contaminantSystem.getDefenseSlotted(), ids, () => .4);
        assert.equal(result.intensity, intensity);
        const observed = { readings, display: impactSystem.getForecastDisplay(), result };
        if (assimilation === 0) reference = observed;
        else assert.deepEqual(observed, reference, `${outcome}, tide ${intensity}, defense ${defended}, A ${assimilation}`);
        if (!defended) assert.equal(result.damages.reduce((sum, entry) => sum + entry.damage, 0),
          GAME_CONSTANTS.PURIFICATION.BASE_IMPACT_DAMAGE * intensity);
        returnCases++;
      }
    }
  }
}

// Legacy commitments and blurred display are still their own frozen facts.
reset(0, 1.8);
impactSystem.loadForecastState({ version: 1, targetId: 'CORE', committed: true, consumed: false,
  display: { targetId: 'CORE', severity: 'moderate' }, lookahead: { targetId: 'STORAGE', severity: 'heavy' },
  queuedTargets: ['STORAGE'], nextIntensity: 1.8, nextNextIntensity: 2.3 });
const legacy = { reading: impactSystem.getForecastReading(3), display: impactSystem.getForecastDisplay(),
  lookahead: impactSystem.getForecastLookahead(), state: impactSystem.getForecastState() };
for (const assimilation of [30, 60, 100]) {
  gameState.setAssimilation(assimilation);
  assert.deepEqual({ reading: impactSystem.getForecastReading(3), display: impactSystem.getForecastDisplay(),
    lookahead: impactSystem.getForecastLookahead(), state: impactSystem.getForecastState() }, legacy);
}
assert.equal(impactSystem.run([], [], () => .4).intensity, 1.8);

let healingReference: unknown;
for (const assimilation of [10, 30, 60, 100]) {
  reset(assimilation, 1);
  // Force one shared, deterministic forecast for the initial tide.
  const preview = getHealingPreview();
  assert(preview.available);
  assert(!('impactMultiplier' in preview));
  const outcome = performHealingCycle();
  assert(outcome.ok);
  assert.equal(outcome.result.after, Math.max(0, assimilation - 15));
  const observed = { impact: outcome.result.impact, forecast: preview.forecast };
  if (assimilation === 10) healingReference = observed;
  else assert.deepEqual(observed, healingReference, 'every A pays the same tide impact per healing cycle');
}
assert.deepEqual([10, 30, 60, 100].map(healingCyclesToClear), [1, 2, 4, 7]);
inventoryStore.setPersistence(null);
console.log(`PASS assimilation impact isolation: ${returnCases} extraction/death/abandon cases across A/tide/defense; legacy forecasts; healing fixed impact and cycle counts`);
