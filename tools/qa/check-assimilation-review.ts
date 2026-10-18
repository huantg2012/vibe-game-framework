/** Independent adversarial cases from the assimilation contract; isolated storage only.
 * Run: TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/qa/check-assimilation-review.ts
 */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { performHealingCycle } from '../../src/managers/healing-cycle';
import { ChaosSystem } from '../../src/systems/chaos-system';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';

let failures = 0;
function check(name: string, body: () => void): void {
  try { body(); console.log(`PASS ${name}`); }
  catch (error) { failures++; console.error(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`); }
}
const records = new Map<string, string>();
saveManager.setStorage({ getItem: key => records.get(key) ?? null,
  setItem: (key, value) => { records.set(key, value); }, removeItem: key => { records.delete(key); } });
gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset();
contaminantSystem.reset(); impactSystem.resetForecastState();
gameState.setAssimilation(40);
const first = performHealingCycle();
assert(first.ok && first.result.cycleId === 'healing:1');
const key = GAME_CONSTANTS.SAVE.KEY;
const complete = JSON.parse(records.get(key)!);
assert.equal(complete.assimilation, 25);
assert.equal(complete.healingCycles, 1);

// One surviving field proves this is a new body-state package, not an old save.
for (const missing of ['assimilation', 'healingCycles'] as const) {
  check(`new base record rejects missing ${missing}`, () => {
    records.set(key, JSON.stringify(complete));
    assert(saveManager.load());
    const before = gameState.getState();
    const damaged = structuredClone(complete);
    delete damaged[missing];
    records.set(key, JSON.stringify(damaged));
    const accepted = saveManager.load();
    assert.equal(accepted, false, `accepted malformed new record; body=${gameState.getAssimilation()}, healingCycles=${gameState.getHealingCycles()}`);
    assert.deepEqual(gameState.getState(), before, 'rejection leaves current state intact');
  });
}

function expiryTrial(frameMs: number): number {
  let assimilation = 0;
  const chaos = new ChaosSystem({ assimilationMode: 'persistent-v1', startingValue: 99.97,
    getAssimilation: () => assimilation, setAssimilation: value => { assimilation = value; } });
  chaos.setTemporaryRateReduction(.5, 50);
  try {
    for (let elapsed = 0; elapsed < 100; elapsed += frameMs) chaos.update(frameMs);
    return assimilation;
  } finally { chaos.destroy(); }
}
check('saturation crossing splits an in-frame rate expiry at its actual time', () => {
  // Base pollution .5/sec: first 50ms contributes .0125, then 35ms reaches 100;
  // only the remaining 15ms accrue .6 assimilation/minute.
  const expected = .6 * 15 / 60000;
  const coarse = expiryTrial(100), fine = expiryTrial(10);
  assert(Math.abs(coarse - expected) < 1e-9 && Math.abs(fine - expected) < 1e-9,
    `100ms=${coarse}, 10ms=${fine}, exact=${expected}`);
});
console.log(`${failures ? 'FAIL' : 'PASS'} independent assimilation review: ${failures} failing cases`);
process.exitCode = failures ? 1 : 0;
