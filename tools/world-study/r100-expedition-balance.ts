/**
 * R100 native business diagnostics and real-play coverage manifest.
 * Run: TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/world-study/r100-expedition-balance.ts
 * No movement/AI/Host/rendering is exercised here. None of these probes count as a completed sortie.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { R100_EXPEDITION_GRADES } from '../../src/generated/rift-expedition-grade-data';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { growthSystem } from '../../src/systems/growth-system';
import { tideSystem } from '../../src/systems/tide-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { impactSystem } from '../../src/systems/impact-system';
import { audioManager } from '../../src/managers/audio-manager';
import { RunController } from '../../src/systems/run-controller';
import { ChaosSystem } from '../../src/systems/chaos-system';
import { calculateKindlingYield } from '../../src/systems/kindling-yield';
import { createContaminantDropPlan } from '../../src/systems/contaminant-drop-plan';
import { getCatalogRuntimeAbility } from '../../src/systems/contaminant-catalog';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import type { KindlingNodeDef, ContaminantNodeDef, KindlingTier } from '../../src/types/map-types';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
const { LootSearchSystem } = await import('../../src/systems/loot-search-system');
const args = process.argv.slice(2);
const out = resolve(args.includes('--out') ? args[args.indexOf('--out') + 1]! : 'docs/qa/artifacts/r100-expedition-balance');
mkdirSync(out, { recursive: true });
const paths = ['data/rift-expedition-grades.csv', 'data/rift-pollution-grades.csv', 'data/contaminant-items.csv',
  'data/contaminant-loot-profiles.csv', 'data/contaminant-offerings.csv', 'src/systems/loot-search-system.ts',
  'src/systems/run-controller.ts', 'src/systems/inventory-store.ts', 'src/systems/impact-system.ts',
  'src/systems/tide-system.ts', 'src/systems/chaos-system.ts', 'src/managers/game-state.ts'];
const fingerprints = () => Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const beforeSources = fingerprints();
const records = new Map<string, string>();
saveManager.setStorage({ getItem: key => records.get(key) ?? null, removeItem: key => { records.delete(key); },
  setItem: (key, value) => { records.set(key, value); } });
audioManager.playSFX = () => {};
audioManager.startLoop = () => {};
audioManager.stopLoop = () => {};
const tiers: KindlingTier[] = ['safe', 'contested', 'deep'];
type Grade = typeof R100_EXPEDITION_GRADES[number];
function reset() {
  records.clear(); inventoryStore.setPersistence(null); gameState.reset(); contaminantSystem.reset();
  growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); impactSystem.resetForecastState();
}
function nodes(grade: Grade) {
  const kindling: KindlingNodeDef[] = [], contaminants: ContaminantNodeDef[] = [];
  for (const tier of tiers) {
    for (let n = 0; n < grade[`kindling_${tier}_count`]; n++) kindling.push({ id: `fuel-${tier}-${n}`, tier,
      value: grade[`kindling_${tier}_value`], allowWeapon: false, position: { x: kindling.length * 160, y: 0 } });
    for (let n = 0; n < grade[`contaminant_${tier}_count`]; n++) contaminants.push({ id: `item-${tier}-${n}`, tier,
      position: { x: contaminants.length * 160, y: 160 } });
  }
  return { kindling, contaminants };
}
function searchFixture(grade: Grade, runId: string, affinity: number, seed: number, includeItems: boolean) {
  const model = nodes(grade), modifiers = gameState.getSortieModifiers();
  const dropPlan = includeItems ? createContaminantDropPlan({ runId, runSeed: seed, nodes: model.contaminants,
    ...(inventoryStore.isCatalogTutorialEligible() ? { tutorialNodeId: model.contaminants[0]!.id } : {}) }) : undefined;
  if (dropPlan) assert(inventoryStore.installDropPlan(dropPlan).ok);
  const search = new LootSearchSystem();
  Object.assign((search as any).hud, { create() {}, destroy() {}, setPrompt() {}, setChannel() {}, setKindling() {}, flashKindling() {} });
  search.create({} as never, model.kindling, includeItems ? model.contaminants : [], {
    overlayRoot: {} as never, getVisibilityAt: () => 1, fragmentTypeId: 'r100-business-fixture', inventoryEnabled: true,
    runSeed: seed, dropPlan, kindlingAffinity: affinity, kindlingValueModifier: modifiers.kindlingValueModifier,
    createVisual: (_scene, p) => ({ x: p.x, y: p.y, setVisibility() {}, setRummaging() {}, playReveal() {}, update() {}, destroy() {} }),
  });
  const input = { playerPos: { x: 0, y: 0 }, searchHeld: false, moving: false, attacking: false,
    toolPressed: false, hitThisFrame: false, paused: false };
  // Controlled search positions, deliberately NOT movement evidence.
  for (const node of [...model.kindling, ...(includeItems ? model.contaminants : [])]) {
    input.playerPos = node.position; input.searchHeld = false; search.update(0, input);
    input.searchHeld = true; search.update(0, input); search.update(1200, input);
    input.searchHeld = false; search.update(0, input);
  }
  const expected = model.kindling.reduce((n, item) => n + calculateKindlingYield(item.value!, affinity, modifiers.kindlingValueModifier), 0);
  assert.equal(search.getCarriedKindling(), expected, 'real channel settlement agrees with public per-pile rounding');
  return { search, expected, dropPlan, modifiers };
}
function endNativeRun(runId: string, carried: number, outcome: 'extract' | 'death' = 'extract') {
  const run = new RunController();
  let paused = false, disabled = false;
  run.create({ time: { now: 0, delayedCall() {} } } as never, { pauseChaos: value => { paused = value; },
    setPlayerInput: value => { disabled = !value; }, getCarriedKindling: () => carried });
  if (outcome === 'extract') eventBus.emit(GameEvent.RIFT_EXIT_REACHED, {});
  else eventBus.emit(GameEvent.PLAYER_DIED, { cause: 'diagnostic' });
  assert(paused && disabled && run.isRunEnded());
  assert.equal(inventoryStore.getRun()?.id, runId);
  assert.equal(inventoryStore.getRun()?.kindlingGained, outcome === 'extract' ? carried : 0);
  const first = JSON.stringify(inventoryStore.getState());
  eventBus.emit(GameEvent.RIFT_EXIT_REACHED, {});
  assert.equal(JSON.stringify(inventoryStore.getState()), first, 'settlement cannot repeat or turn death into extraction');
  run.destroy();
}
function payRepairs(target: Readonly<Record<string, number>>) {
  let spent = 0;
  for (const module of [...gameState.getModules()].sort((a, b) => a.hp - b.hp)) {
    const required = Math.max(0, Math.ceil(((target[module.id] ?? module.maxHp) - module.hp) / 4));
    spent += gameState.allocateToModule(module.id, required);
  }
  return spent;
}
const cashProbes: unknown[] = [];
for (const grade of R100_EXPEDITION_GRADES) for (const storageHp of [25, 40, 55, 70, 100]) for (const affinity of [0, 1, 3]) {
  reset(); const state = gameState.getState(); state.modules.find(m => m.type === 'STORAGE')!.hp = storageHp; gameState.loadState(state);
  const runId = `probe-${grade.grade_id}-${storageHp}-${affinity}`;
  assert(inventoryStore.beginRun(runId).ok);
  const { search, expected, modifiers } = searchFixture(grade, runId, affinity, 391, false);
  endNativeRun(runId, expected);
  gameState.addKindling(inventoryStore.getRun()!.kindlingGained!);
  gameState.incrementCycle(); gameState.incrementCycle();
  const target = Object.fromEntries(gameState.getModules().map(m => [m.id, m.hp]));
  const impact = impactSystem.run([], [], () => .25);
  const spent = payRepairs(target);
  cashProbes.push({ grade: grade.grade_id, storageHp, affinity, multiplier: modifiers.kindlingValueModifier,
    actualCollected: expected, actualImpact: impact.damages.reduce((n, m) => n + m.damage, 0), repairSpent: spent,
    reserveAfter: gameState.getKindlingReserve(), unresolvedDamage: gameState.getModules().reduce((n, m) => n + Math.max(0, target[m.id]! - m.hp), 0) });
  search.destroy();
}
const chaosProbes: unknown[] = [];
for (const grade of R100_EXPEDITION_GRADES) for (const resistance of [0, 20, 60]) {
  const chaos = new ChaosSystem({ pollutionGrade: grade.grade_id, getPollutionResistance: () => resistance });
  const points: Record<string, number> = {};
  for (let time = 100; time <= 180000; time += 100) { chaos.update(100); if ([90000, 120000, 180000].includes(time)) points[String(time)] = chaos.getValue(); }
  const saved = chaos.exportRuntimeState(); chaos.setPaused(true); chaos.update(100); assert.deepEqual(chaos.exportRuntimeState(), { ...saved, paused: true });
  chaosProbes.push({ grade: grade.grade_id, resistance, caveat: 'constant supplied resistance is a sensitivity fixture, NOT a free or permanent item', points }); chaos.destroy();
}

// No-field-loss, full-clear business replay. These 90 returns are an optimistic SUPPLY DIAGNOSTIC, not 90 playthroughs.
const supplyDiagnostics: unknown[] = [];
for (const policy of ['low-only', 'low-medium', 'low-medium-severe'] as const) {
  reset(); assert(inventoryStore.ensureStarter(`starter-${policy}`).ok);
  const history: unknown[] = [];
  for (let index = 0; index < 30; index++) {
    const gradeIndex = policy === 'low-only' ? 0 : policy === 'low-medium' ? (index < 10 ? 0 : 1) : Math.min(2, Math.floor(index / 10));
    const grade = R100_EXPEDITION_GRADES[gradeIndex]!, runId = `business-${policy}-${index + 1}`;
    const offeringSlots = contaminantSystem.getDefenseSlotCount();
    for (let slot = 0; slot < offeringSlots; slot++) {
      if (inventoryStore.getOfferingItems()[slot]) continue;
      const candidate = inventoryStore.getItems().find(item => item.location.kind === 'stash' && item.kind === 'contaminant' && item.contaminant.stage === 'defense');
      if (candidate) assert(inventoryStore.slotOffering(candidate.id, slot).ok);
    }
    const reserveBefore = gameState.getKindlingReserve(), hpBefore = gameState.getModules().map(m => ({ type: m.type, hp: m.hp }));
    gameState.incrementCycle(); assert(inventoryStore.beginRun(runId, { catalogVersion: 'contaminant-v1', lootAlgorithmVersion: 1, combatRulesVersion: 2 }).ok);
    const { search, expected } = searchFixture(grade, runId, 0, 61000 + index, true);
    endNativeRun(runId, expected);
    const saved = saveManager.commitWorldTransaction(() => {
      gameState.addKindling(expected); gameState.setImpactIntensity(tideSystem.getCurrentIntensity());
      const ids = inventoryStore.getOfferingItems().map(item => item?.id ?? null);
      const impact = impactSystem.run(contaminantSystem.getDefenseSlotted(), ids, () => .25, stabilityTracker.getProgress());
      if (!impact.skipped) assert(contaminantSystem.finishOfferingImpact(tideSystem.isHighTide(), impact.defenseResult?.bonusCharges ?? {}, ids, `impact:${runId}`).ok);
      const change = tideSystem.advanceCycle(gameState.getModules().every(m => m.hp > 0) && !(impact.newlyZeroModules ?? 0));
      stabilityTracker.recordReturn({ extracted: true, newlyZeroModules: impact.newlyZeroModules ?? 0, phaseChange: change });
      assert(inventoryStore.markBaseSettled().ok);
      return impact;
    });
    assert(saved, 'base transaction saved');
    const repairSpent = payRepairs(Object.fromEntries(gameState.getModules().map(m => [m.id, m.maxHp])));
    saveManager.save();
    const saveBytes = [...records.values()]; assert(saveBytes.length > 0, 'business state persisted to isolated in-memory storage');
    const stateBeforeLoad = JSON.stringify({ game: gameState.getState(), inventory: inventoryStore.getState(), tide: tideSystem.getState() });
    assert(saveManager.load());
    assert.equal(JSON.stringify({ game: gameState.getState(), inventory: inventoryStore.getState(), tide: tideSystem.getState() }), stateBeforeLoad, 'same base save restores between diagnostic returns');
    const ready = inventoryStore.getItems().flatMap(item => item.kind === 'contaminant' && getCatalogRuntimeAbility(item.contaminant)
      ? [{ id: item.id, definition: item.contaminant.catalog!.definitionId, family: getCatalogRuntimeAbility(item.contaminant)!.familyId, uses: item.contaminant.usesRemaining }] : []);
    history.push({ ordinal: index + 1, runId, grade: grade.grade_id, reserveBefore, hpBefore, collected: expected,
      repairSpent, reserveAfter: gameState.getKindlingReserve(), hpAfter: gameState.getModules().map(m => ({ type: m.type, hp: m.hp })),
      ready, unrevealed: inventoryStore.getItems().filter(item => item.kind === 'contaminant' && item.contaminant.stage === 'defense').length });
    search.destroy();
  }
  supplyDiagnostics.push({ policy, mode: 'optimistic-business-replay', actualPlaythroughs: 0,
    omissions: ['no geometry or enemies', 'all search seats are directly supplied', 'all returns survive', 'no active tool consumption', 'no combat durability loss', 'no growth spending', 'no movement/search time pressure'], history });
}
const families = ['folded-slab', 'fibre-knot', 'broken-shell'];
const playPlan = families.flatMap(family => R100_EXPEDITION_GRADES.flatMap(grade => [20261004, 20261005].flatMap(seed => ['resist-suppress', 'survey-lure'].map(build => ({
  caseId: `${family}-${grade.grade_id}-${seed}-${build}`, family, grade: grade.grade_id, seed, build,
  status: 'pending', method: 'production-input-playthrough', requiredArtifacts: ['input-trace', 'runtime-samples', 'entry-frame', 'search-frame', 'return-or-death-frame', 'base-settlement'],
})))));
assert.equal(playPlan.length, 36);
const naturalPlan = ['conservative', 'gradual', 'repeat-risk'].map(policy => ({ policy, requiredContinuousReturns: 30,
  status: 'pending', recordedReturns: 0, prohibit: ['injected rewards or mature gear', 'reset after loss', 'forced world coverage counted as natural random'],
  required: ['original starting save hash', 'consecutive before/after save hashes', 'real input/runtime artifacts', 'every failed/aborted attempt', 'tool use and offering receipts'] }));
const afterSources = fingerprints();
const report = { generatedAt: new Date().toISOString(), evidenceType: 'native-business-diagnostic', actualPlaythroughs: 0,
  completedI03PlayMatrix: false, completedI06NaturalSupply: false, sourceStable: JSON.stringify(beforeSources) === JSON.stringify(afterSources),
  sources: beforeSources, observedAfterSources: afterSources, cashProbes, chaosProbes, supplyDiagnostics,
  limitations: ['renderer/DOM/audio are adapted', 'not an economic-balance PASS', 'full-clear survivor replays are optimistic and cannot replace real 36/90 run evidence', 'active tools not consumed in 90 business returns', 'actual waiting/route/threat cost not measured'] };
writeFileSync(resolve(out, 'business-diagnostic.json'), JSON.stringify(report, null, 2) + '\n');
writeFileSync(resolve(out, 'play-coverage-plan.json'), JSON.stringify({ revision: 1, i03: playPlan, i06: naturalPlan }, null, 2) + '\n');
assert(report.sourceStable, 'sources changed during diagnostics; rerun only after source freeze');
console.log(JSON.stringify({ output: out, nativeCashCases: cashProbes.length, nativeChaosCases: chaosProbes.length,
  optimisticBusinessReturns: 90, realPlaythroughs: 0, i03RealRuns: '0/36 pending', i06NaturalRuns: '0/90 pending' }, null, 2));
