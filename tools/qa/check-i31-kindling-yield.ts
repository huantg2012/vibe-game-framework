/** Production settlement and repair projections; only rendering/audio are adapted. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { gameState, type ModuleType } from '../../src/managers/game-state';
import { calculateKindlingYield, calculateKindlingYieldExamples } from '../../src/systems/kindling-yield';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';

Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => 'zh-CN' }, configurable: true });
const { LootSearchSystem } = await import('../../src/systems/loot-search-system');
const { audioManager } = await import('../../src/managers/audio-manager');
const { saveManager } = await import('../../src/managers/save-manager');
const { inventoryStore } = await import('../../src/systems/inventory-store');
const originalAudio = audioManager.playSFX;
audioManager.playSFX = () => {};

const bases = [GAME_CONSTANTS.LOOT.VALUE_SAFE, GAME_CONSTANTS.LOOT.VALUE_CONTESTED, GAME_CONSTANTS.LOOT.VALUE_DEEP];
const player = { x: 0, y: 0 };
let settlements = 0;
function settlePile(baseValue: number, affinity: number, modifier: number): number {
  const search = new LootSearchSystem();
  const node = { id: 'yield-pile', kind: 'kindling', value: baseValue, position: player, collected: false,
    visual: { setRummaging() {}, playReveal() {} } };
  const state = search as unknown as { channel: unknown; kindlingAffinity: number; kindlingValueModifier: number;
    complete: (position: typeof player) => void; carried: number };
  state.channel = { node, elapsedMs: GAME_CONSTANTS.LOOT.SEARCH_CHANNEL_MS };
  state.kindlingAffinity = affinity;
  state.kindlingValueModifier = modifier;
  let emitted = 0;
  const onCollected = ({ amount }: { amount: number }) => { emitted = amount; };
  eventBus.on(GameEvent.KINDLING_COLLECTED, onCollected);
  state.complete(player);
  eventBus.off(GameEvent.KINDLING_COLLECTED, onCollected);
  assert.equal(node.collected, true);
  assert.equal(state.carried, emitted, 'live carry and public pickup event agree');
  search.destroy();
  settlements++;
  return emitted;
}

function fixture(storageHp: number, swapped = false, resonate = false, bonus = 0): void {
  gameState.reset();
  gameState.loadState({ kindlingReserve: 0, cycle: 3, moduleMaxHpTier: 1,
    moduleSwapActive: swapped, repairBonusHp: bonus,
    modules: [
      { id: 'CORE', type: 'CORE', hp: 37, maxHp: 115 },
      { id: 'STORAGE', type: 'STORAGE', hp: storageHp, maxHp: 115 },
      { id: 'PURIFIER', type: 'PURIFIER', hp: 53, maxHp: 115 },
    ] });
  gameState.setResonateBonusActive(resonate);
}

let projections = 0;
let thresholds = 0;
let durableRepairJourneys = 0;
try {
  for (const affinity of [0, 1, 3]) for (const hp of [0, 70, 99, 100, 115]) {
    for (const swapped of [false, true]) for (const resonate of [false, true]) for (const bonus of [0, 6]) {
      fixture(hp, swapped, resonate, bonus);
      const current = gameState.getSortieModifiers();
      const examples = calculateKindlingYieldExamples(affinity, current.kindlingValueModifier);
      bases.forEach((base, index) => {
        assert.equal(examples[index], Math.max(1, Math.floor((base + affinity) * current.kindlingValueModifier)));
        assert.equal(settlePile(base, affinity, current.kindlingValueModifier), examples[index]);
      });

      for (const type of ['CORE', 'STORAGE', 'PURIFIER'] as const) {
        const before = gameState.getState();
        const next = gameState.getNextKindlingYieldRepair(type, affinity);
        assert.deepEqual(gameState.getState(), before, 'threshold lookup does not spend reserve or bonus');
        if (next) {
          assert.ok(next.kindlingCost > gameState.getKindlingReserve(), 'threshold ignores current zero reserve');
          const prior = gameState.getSortieModifiersAfterRepair(type, next.kindlingCost - 1);
          assert.deepEqual(calculateKindlingYieldExamples(affinity, prior.kindlingValueModifier), examples,
            'reported threshold is the first integer-yield change');
          const projected = gameState.getSortieModifiersAfterRepair(type, next.kindlingCost);
          assert.deepEqual(calculateKindlingYieldExamples(affinity, projected.kindlingValueModifier), next.yields);
          assert.notDeepEqual(next.yields, examples);
          const module = gameState.getModule(type)!;
          assert.equal(next.repairedHp, gameState.previewModuleRepair(module.hp, module.maxHp, next.kindlingCost));
          thresholds++;
        } else {
          const full = gameState.getSortieModifiersAfterRepair(type, 100);
          assert.deepEqual(calculateKindlingYieldExamples(affinity, full.kindlingValueModifier), examples,
            'null threshold is an actual lack of reachable yield improvement');
        }

        for (const amount of [0, 1, 2, 8, 100]) {
          gameState.loadState(before);
          const projected = gameState.getSortieModifiersAfterRepair(type, amount);
          assert.deepEqual(gameState.getState(), before, 'preview is pure');
          gameState.addKindling(100);
          const spent = gameState.allocateToModule(type, amount);
          assert.deepEqual(gameState.getSortieModifiers(), projected,
            `${type} preview equals committed repair: hp=${hp}, affinity=${affinity}, swap=${swapped}, resonate=${resonate}, bonus=${bonus}, amount=${amount}`);
          assert.equal(gameState.getRepairBonusHp(), spent ? 0 : bonus);
          projections++;
        }
        gameState.loadState(before);
      }
    }
  }

  // Regression behind this iteration: a rising multiplier can buy no extra whole kindling.
  fixture(70);
  const at70 = calculateKindlingYieldExamples(0, gameState.getSortieModifiers().kindlingValueModifier);
  fixture(99);
  assert.deepEqual(calculateKindlingYieldExamples(0, gameState.getSortieModifiers().kindlingValueModifier), at70);
  assert.deepEqual(at70, [1, 2, 5]);
  fixture(70);
  assert.deepEqual(gameState.getNextKindlingYieldRepair('STORAGE', 0), { kindlingCost: 8, repairedHp: 102, yields: [1, 3, 6] });
  assert.deepEqual(calculateKindlingYieldExamples(0, gameState.getSortieModifiersAfterRepair('STORAGE', 7).kindlingValueModifier), at70);
  fixture(70, false, false, 6);
  assert.deepEqual(gameState.getNextKindlingYieldRepair('STORAGE', 0), { kindlingCost: 6, repairedHp: 100, yields: [1, 3, 6] });
  for (const amount of [0, 0.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(gameState.getSortieModifiersAfterRepair('STORAGE', amount), gameState.getSortieModifiers(),
      'non-injection cannot apply one-time repair bonus');
  }
  for (const type of ['CORE', 'STORAGE', 'PURIFIER'] as ModuleType[]) {
    assert.equal(gameState.getSortieModifiersAfterRepair(type, 0).startingChaos, gameState.getStartingChaos());
  }
  assert.equal(calculateKindlingYield(0, 0, 0), 1, 'existing minimum one-kindling rule is unchanged');
  const frozen = gameState.getSortieModifiers().kindlingValueModifier;
  gameState.addKindling(100); gameState.allocateToModule('STORAGE', 100);
  assert.equal(settlePile(4, 0, frozen), 5, 'a frozen sortie modifier does not re-read repaired base state');
  fixture(70);
  const unthickened = gameState.getState();
  unthickened.moduleMaxHpTier = 0;
  gameState.loadState(unthickened);
  assert.deepEqual(gameState.getNextKindlingYieldRepair('STORAGE', 0), { kindlingCost: 8, repairedHp: 100, yields: [1, 3, 6] },
    'unthickened repair caps at 100 rather than the thickened 102');
  fixture(100);
  assert.equal(gameState.getNextKindlingYieldRepair('STORAGE', 0), null, '100 to 115 only adds damage buffer');

  // Controlled business-connection fixtures, not natural new-game playthroughs.
  // Exercise the real durable repair entry, rollback, reload and searched-pile settlement.
  for (const reserve of [3, 6]) {
    const records = new Map<string, string>();
    let rejectWrites = false;
    let writeAttempts = 0;
    saveManager.setStorage({
      getItem: key => records.get(key) ?? null,
      removeItem: key => { records.delete(key); },
      setItem: (key, value) => {
        writeAttempts++;
        if (rejectWrites) throw new Error('Controlled I31 storage rejection');
        records.set(key, value);
      },
    });
    fixture(70, false, false, 6);
    gameState.addKindling(reserve);
    saveManager.save();

    const threshold = gameState.getNextKindlingYieldRepair('STORAGE', 0)!;
    assert.equal(threshold.kindlingCost, 6);
    assert.equal(Math.max(0, threshold.kindlingCost - reserve), reserve === 3 ? 3 : 0);
    const selected = Math.min(reserve, threshold.kindlingCost);
    const predictedHp = gameState.previewModuleRepair(70, 115, selected);
    const predictedModifiers = gameState.getSortieModifiersAfterRepair('STORAGE', selected);
    const predictedYield = calculateKindlingYieldExamples(0, predictedModifiers.kindlingValueModifier)[2];
    assert.equal(predictedHp, reserve === 3 ? 88 : 100);
    assert.equal(predictedYield, reserve === 3 ? 5 : 6);

    const before = gameState.getState();
    const beforeBytes = records.get(GAME_CONSTANTS.SAVE.KEY);
    const attemptsBeforeRepair = writeAttempts;
    rejectWrites = true;
    assert.equal(saveManager.allocateToModule('STORAGE', selected), 0);
    assert.equal(writeAttempts, attemptsBeforeRepair + 1, 'repair reaches the actual rejected save');
    assert.deepEqual(gameState.getState(), before, 'rejected durable repair restores reserve, all HP and finite bonus');
    assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY), beforeBytes, 'rejection preserves the exact prior record');
    assert.deepEqual(gameState.getSortieModifiersAfterRepair('STORAGE', selected), predictedModifiers,
      'retry preview has not lost the finite bonus');

    rejectWrites = false;
    assert.equal(saveManager.allocateToModule('STORAGE', selected), selected);
    assert.equal(writeAttempts, attemptsBeforeRepair + 2, 'retry commits exactly one new record');
    assert.equal(gameState.getKindlingReserve(), reserve - selected);
    assert.equal(gameState.getModule('STORAGE')!.hp, predictedHp);
    assert.equal(gameState.getRepairBonusHp(), 0);
    assert.deepEqual(gameState.getSortieModifiers(), predictedModifiers);
    const committed = gameState.getState();
    const committedBytes = records.get(GAME_CONSTANTS.SAVE.KEY)!;
    assert.notEqual(committedBytes, beforeBytes);
    const persisted = JSON.parse(committedBytes) as { kindlingReserve: number; repairBonusHp: number;
      modules: { id: string; hp: number }[] };
    assert.equal(persisted.kindlingReserve, reserve - selected);
    assert.equal(persisted.repairBonusHp, 0);
    assert.equal(persisted.modules.find(module => module.id === 'STORAGE')!.hp, predictedHp);

    gameState.reset();
    assert.equal(saveManager.load(), true, 'the committed repair survives the production loader');
    assert.deepEqual(gameState.getState(), committed);
    const frozenModifiers = Object.freeze({ ...gameState.getSortieModifiers() });
    // The expedition owns this snapshot: later base mutations cannot alter its pile yield.
    gameState.applyDamage('STORAGE', predictedHp);
    assert.equal(settlePile(GAME_CONSTANTS.LOOT.VALUE_DEEP, 0, frozenModifiers.kindlingValueModifier), predictedYield,
      'frozen departure modifiers feed real LootSearchSystem completion and match the pre-repair preview');
    durableRepairJourneys++;
  }
} finally {
  audioManager.playSFX = originalAudio;
  saveManager.setStorage(null);
  inventoryStore.setPersistence(null);
  gameState.reset();
}

console.log(`PASS I31 yield: ${settlements} actual pile settlements, ${projections} pure/committed repair comparisons, ${thresholds} minimum thresholds, ${durableRepairJourneys} controlled durable-repair/reload/search connections; affinity, swap, resonate, finite bonus, 100 effect cap / 115 HP and frozen sortie covered.`);
