/** I29 R2: real linear purchase transactions, rollback, progression and public projection. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { eventBus } from '../../src/core/event-bus';
import { GROWTH_ROUTE_DATA } from '../../src/generated/growth-route-data';
import { UPGRADE_DATA } from '../../src/generated/upgrade-data';
import { gameState } from '../../src/managers/game-state';
import { purchaseGrowth } from '../../src/managers/growth-purchases';
import { saveManager } from '../../src/managers/save-manager';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { impactSystem } from '../../src/systems/impact-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';
import { GameEvent } from '../../src/types/events';
import type { GrowthState } from '../../src/types/game-types';

const records = new Map<string, string>();
let rejectWrites = false;
let writes = 0;
const checks: string[] = [];
saveManager.setStorage({
  getItem: key => records.get(key) ?? null,
  removeItem: key => { records.delete(key); },
  setItem: (key, value) => {
    if (rejectWrites) throw new Error('controlled storage rejection');
    if (key === GAME_CONSTANTS.SAVE.KEY) writes++;
    records.set(key, value);
  },
});
function check(name: string, run: () => void): void { run(); checks.push(name); console.log(`PASS ${name}`); }
function reset(): void {
  rejectWrites = false; inventoryStore.setPersistence(null); saveManager.deleteSave();
  gameState.reset(); growthSystem.reset(); contaminantSystem.reset();
  tideSystem.reset(); impactSystem.resetForecastState(); stabilityTracker.reset();
  gameState.addKindling(1000);
}
function snapshot() {
  return { game: gameState.getState(), growth: growthSystem.getState(), inventory: inventoryStore.getState(),
    forecast: impactSystem.getForecastState(), stability: stabilityTracker.getState() };
}

check('CSV covers every level exactly once and retains the authored 22-step order and gently exponential 426-kindling total', () => {
  assert.deepEqual(GROWTH_ROUTE_DATA.map(step => `${step.unit}:${step.level}`), [
    'growth_vitality:1', 'growth_kindling_affinity:1', 'growth_defense_slot:1', 'growth_chaos_resist:1',
    'growth_forecast_clarity:1', 'growth_vitality:2', 'thicken:1', 'growth_kindling_affinity:2',
    'growth_forecast_clarity:2', 'growth_defense_slot:2', 'growth_chaos_resist:2', 'growth_sortie_slot:1',
    'growth_vitality:3', 'thicken:2', 'growth_chaos_resist:3', 'growth_kindling_affinity:3',
    'growth_forecast_clarity:3', 'growth_defense_slot:3', 'growth_vitality:4', 'growth_chaos_resist:4',
    'thicken:3', 'growth_chaos_resist:5',
  ]);
  const total = GROWTH_ROUTE_DATA.reduce((sum, step) => sum + step.cost, 0);
  assert.equal(total, 426);
  for (const [index, step] of GROWTH_ROUTE_DATA.entries()) {
    assert.equal(step.cost, Math.round(8 * 1.077 ** index));
    if (index > 0) {
      const previous = GROWTH_ROUTE_DATA[index - 1]!.cost;
      assert(step.cost >= previous, 'route price never falls');
      // Integer rounding can turn 14→16 into 14.3% although the underlying
      // authored curve grows 7.7%; the permitted rounded jump remains <=15%.
      assert(step.cost / previous <= 1.15, 'rounded adjacent increase stays modest');
    }
    if (step.unit !== 'thicken') assert.equal(UPGRADE_DATA[step.unit].costs[step.level - 1], step.cost);
  }
  assert.deepEqual(GROWTH_ROUTE_DATA.filter(step => step.requirement !== 'none').map(step => step.order), [5, 17]);
});

check('all 22 real purchases reject skipped nodes, persist once, reload identically and expose only the next step', () => {
  reset(); assert(saveManager.trySave());
  let spent = 0;
  for (const authored of GROWTH_ROUTE_DATA) {
    const next = growthSystem.getNextStep(); assert(next);
    assert.equal(next.id, authored.unit); assert.equal(next.level, authored.level);
    assert.equal(next.cost, authored.cost);
    assert.deepEqual(growthSystem.getRouteProgress(), { completed: authored.order - 1, total: 22 });
    const before = snapshot(), bytes = records.get(GAME_CONSTANTS.SAVE.KEY), writeCount = writes;
    for (const id of [...growthSystem.getAllUpgradeIds(), 'thicken'] as const) {
      if (id === next.id) continue;
      assert.deepEqual(purchaseGrowth(id), { ok: false, reason: 'unavailable' });
      if (id !== 'thicken') assert.equal(growthSystem.purchase(id), 0);
    }
    assert.deepEqual(snapshot(), before); assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), bytes);
    assert.equal(writes, writeCount);
    assert.deepEqual(Object.keys(next).sort(), ['id', 'level', 'maxLevel', 'currentLevel', 'order', 'phase',
      'requirement', 'requirementText', 'unlocked', 'cost'].sort());
    for (let read = 0; read < 20; read++) {
      assert.deepEqual(growthSystem.getNextStep(), next); growthSystem.getRouteProgress();
    }
    assert.deepEqual(snapshot(), before); assert.equal(writes, writeCount);
    if (authored.requirement !== 'none') {
      assert.equal(next.unlocked, false);
      assert.deepEqual(purchaseGrowth(next.id), { ok: false, reason: 'unavailable' });
      assert.deepEqual(snapshot(), before);
      growthSystem.recordReturn({ impactOccurred: authored.order === 5, leftFiniteCrest: authored.order === 17,
        offeringCompleted: false, toolRevealed: false });
      assert.equal(growthSystem.getNextStep()?.unlocked, true);
    }
    const result = purchaseGrowth(next.id); assert(result.ok);
    assert.equal(result.newLevel, authored.level); assert.equal(result.spent, next.cost);
    spent += result.spent;
    assert.equal(writes, writeCount + 1);
    const after = snapshot(); assert(saveManager.load()); assert.deepEqual(snapshot(), after);
    assert.equal(growthSystem.getState().progression?.offeringCompleted, false);
    assert.equal(growthSystem.getState().progression?.toolRevealed, false);
  }
  assert.equal(spent, 426); assert.equal(gameState.getKindlingReserve(), 574);
  assert.equal(stabilityTracker.getProgress(), 19);
  assert.equal(growthSystem.getNextStep(), null);
  assert.deepEqual(growthSystem.getRouteProgress(), { completed: 22, total: 22 });
  assert.equal(contaminantSystem.getDefenseSlotCount(), 4);
  const before = snapshot();
  for (const id of [...growthSystem.getAllUpgradeIds(), 'thicken'] as const) assert(!purchaseGrowth(id).ok);
  assert.deepEqual(snapshot(), before);
});

check('new upgrade and thicken writes roll back the complete state and retry emits one success', () => {
  for (const target of ['growth_vitality', 'thicken'] as const) {
    reset(); growthSystem.recordReturn({ impactOccurred: true, offeringCompleted: false, toolRevealed: false, leftFiniteCrest: true });
    while (growthSystem.getNextStep()?.id !== target) {
      const next = growthSystem.getNextStep(); assert(next && purchaseGrowth(next.id).ok);
    }
    assert(saveManager.trySave());
    const before = snapshot(), bytes = records.get(GAME_CONSTANTS.SAVE.KEY), writeCount = writes;
    let purchases = 0;
    const onPurchase = (): void => { purchases++; };
    eventBus.on(GameEvent.GROWTH_PURCHASED, onPurchase);
    rejectWrites = true;
    assert.deepEqual(purchaseGrowth(target), { ok: false, reason: 'storage-failed' });
    assert.deepEqual(snapshot(), before); assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), bytes);
    assert.equal(writes, writeCount); assert.equal(purchases, 0);
    rejectWrites = false; assert(purchaseGrowth(target).ok); assert.equal(purchases, 1);
    eventBus.off(GameEvent.GROWTH_PURCHASED, onPurchase);
  }
});

check('legacy purchases keep effects and skip already-owned nodes without making missing experience disappear', () => {
  for (const oldBonus of [0, 1]) {
    reset(); const saved: GrowthState = growthSystem.getState(); delete saved.schemaVersion; delete saved.progression;
    saved.upgrades.growth_defense_slot = oldBonus;
    saved.upgrades.growth_vitality = 4; saved.upgrades.growth_forecast_clarity = 2;
    growthSystem.loadState(saved);
    assert.equal(growthSystem.getDefenseSlotBonus(), oldBonus + 2);
    assert.equal(growthSystem.getModifiers().vitalityBonus, 60);
    assert.equal(growthSystem.getModifiers().forecastClarity, 2);
    assert.equal(growthSystem.getNextStep()?.id, 'growth_kindling_affinity');
    const normalized = growthSystem.getState(); growthSystem.loadState(normalized);
    assert.deepEqual(growthSystem.getState(), normalized);
    assert.equal(growthSystem.getState().progression?.crestExperienced, false);
  }
  reset(); growthSystem.loadState({ upgrades: {} } as GrowthState);
  assert.equal(growthSystem.getDefenseSlotBonus(), 2);
  assert.equal(growthSystem.getState().schemaVersion, 2);
  growthSystem.reset(); assert.equal(growthSystem.getDefenseSlotBonus(), 0);
});

const out = process.argv[2] ?? 'docs/qa/artifacts/iteration-29-r2/linear-growth.json';
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });
writeFileSync(out, JSON.stringify({ iteration: 29, issue: 'R2-linear-growth', verifiedAt: new Date().toISOString(),
  result: 'PASS', method: 'isolated memory storage with production CSV, GrowthSystem, purchaseGrowth and SaveManager',
  checks, limitations: ['No browser or player visual acceptance is claimed.'] }, null, 2) + '\n');
inventoryStore.setPersistence(null);
