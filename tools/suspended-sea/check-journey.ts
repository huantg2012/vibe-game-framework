/** State/transaction integration checks. Engine drawing and timers are isolated;
 * these are not keyboard playthrough evidence or a long-term supply validation.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/suspended-sea/check-journey.ts
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import type { PurificationDevDeparture } from '../../src/scenes/purification-scene';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { ActorPixelDrawing } from '../../src/dev/spatial-study/stage/actor-pixels';
import { StagePlayer } from '../../src/dev/spatial-study/stage/actors';
import { createPresentationFrame } from '../../src/dev/spatial-study/stage/bridge';
import { disposeTree } from '../../src/dev/spatial-study/stage/materials';
import { STAGE_TOOL_TYPES, supportsStageWeapon } from '../../src/dev/spatial-study/stage/support';
import type { InventoryResult } from '../../src/types/inventory-types';
let browserWrites = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: () => 'zh-CN', setItem() { browserWrites++; throw new Error('Real browser storage was accessed'); }, removeItem() { browserWrites++; },
} });
const { SuspendedSeaJourneySession, assertSeaJourneyEquipment } = await import('../../src/dev/suspended-sea/journey-session');
const { BuildLabMemoryStorage } = await import('../../src/dev/build-lab-session');
const { PurificationScene } = await import('../../src/scenes/purification-scene');
const { RunController } = await import('../../src/systems/run-controller');
const { saveManager } = await import('../../src/managers/save-manager');
const { gameState } = await import('../../src/managers/game-state');
const { contaminantSystem } = await import('../../src/systems/contaminant-system');
const { inventoryStore } = await import('../../src/systems/inventory-store');
const { getContaminantMaxUses, rollContaminantNodeDrop } = await import('../../src/systems/contaminant-quality');
const { createWeaponInstance } = await import('../../src/systems/equipment-lifecycle');
const { rollWeaponDrop } = await import('../../src/systems/weapon-loot');
const { getEquipmentLifecycle } = await import('../../src/types/inventory-types');
const { createSuspendedSeaWorld } = await import('../../src/dev/suspended-sea/world');
let passed = 0;
function check(name: string, run: () => void): void { run(); passed++; console.log(`PASS ${name}`); }
function success<T>(result: InventoryResult<T>): T { assert(result.ok, JSON.stringify(result)); return result.value; }
class Storage extends BuildLabMemoryStorage {
  fail = false;
  override setItem(key: string, value: string): void { if (this.fail) throw new Error('Expected test save failure'); super.setItem(key, value); }
}
const drawnBoundary = new Error('Engine rendering boundary');
/** Execute the exact formal create() settlement, then stop at the first engine
 * texture access. No copied impact, tide or offering algorithm in the harness. */
function baseSettlement(initial: boolean, storage: Storage): () => void {
  const scene = new PurificationScene();
  let retry: (() => void) | undefined;
  Object.assign(scene, { textures: { exists() { throw drawnBoundary; } },
    requestSaveRetry: () => { retry = () => { storage.fail = false; assert(saveManager.trySave()); }; } });
  assert.throws(() => scene.create({ fromMenu: initial }), error => error === drawnBoundary);
  return () => { assert(retry); retry(); };
}
function fixture(enterThrows = false) {
  const storage = new Storage(); let bases = 0, starts = 0, retryBase: (() => void) | null = null;
  const session = new SuspendedSeaJourneySession({
    enterBase(initial) { bases++; retryBase = baseSettlement(initial, storage); },
    enterRift() { starts++; if (enterThrows) throw new Error('Engine insertion failed'); session.markRiftReady(); },
  }, storage);
  session.initialize({} as never);
  return { session, storage, counts: () => ({ bases, starts }), retryBase: () => retryBase!() };
}
function departure(session: InstanceType<typeof SuspendedSeaJourneySession>, seed = '19', scene = 'sea-open-channel') {
  const plan = session.prepareDeparture({ scene, seed });
  const id = crypto.randomUUID();
  assert(saveManager.commitWorldTransaction(() => { success(inventoryStore.beginRun(id)); gameState.incrementCycle(); }));
  plan.start({ cycle: gameState.getCycle(), modifiers: gameState.getSortieModifiers(), loadout: contaminantSystem.getSortieLoadout() });
  return { id, plan };
}
function endRun(session: InstanceType<typeof SuspendedSeaJourneySession>, death = false, failSave?: Storage) {
  const calls: (() => void)[] = []; let retry: (() => void) | null = null;
  const controller = new RunController();
  controller.create({ time: { now: 0, delayedCall: (_ms: number, fn: () => void) => calls.push(fn) } } as never,
    { pauseChaos() {}, setPlayerInput() {}, getCarriedKindling: () => 0, onReturn: () => { session.returnToBase(); },
      onSettlementFailure: (_message, fn) => { retry = fn; } });
  if (failSave) failSave.fail = true;
  eventBus.emit(death ? GameEvent.PLAYER_DIED : GameEvent.RIFT_EXIT_REACHED, death ? { cause: 'test' } : {});
  for (const call of calls) call();
  return { controller, retry: () => { assert(retry); retry(); } };
}

check('one formal fresh expedition, one starter, and storage isolation', () => {
  const f = fixture();
  assert.equal(f.session.snapshot().phase, 'base'); assert.equal(gameState.getCycle(), 0);
  const state = inventoryStore.getState(); assert.equal(state.items.length, 1);
  assert.equal(state.items[0]!.kind, 'weapon');
  assert.equal(getEquipmentLifecycle(state.items[0]!).usesRemaining, 60);
  assert.deepEqual(f.session.exportLedger().map(row => row.boundary), ['initial', 'base-saved']);
  assert.throws(() => f.session.initialize({} as never));
  assert.deepEqual(inventoryStore.getState(), state); assert.equal(browserWrites, 0); f.session.close();
});

check('unsupported equipped items fail before beginRun, cycle or storage, but all five quality families are admitted', () => {
  const f = fixture(), initial = inventoryStore.getState();
  for (const type of [...STAGE_TOOL_TYPES, 'expand'] as const) {
    for (const quality of ['ordinary', 'good', 'fine', 'excellent'] as const) {
      const state = structuredClone(initial), item = contaminantSystem.createUnowned(type, CONTAMINANT_DATA[type].rarity, quality);
      item.stage = 'tool'; item.usesRemaining = getContaminantMaxUses(item);
      state.items.push({ id: item.id, kind: 'contaminant', contaminant: item, location: { kind: 'carried' } });
      state.equipment.toolIds[CONTAMINANT_DATA[type].toolType === 'passive' ? 2 : 0] = item.id;
      if (type === 'expand') assert.throws(() => assertSeaJourneyEquipment(state)); else assertSeaJourneyEquipment(state);
    }
  }
  const bad = structuredClone(initial); if (bad.items[0]?.kind === 'weapon') bad.items[0].weapon.definitionId = 'future-weapon';
  assert.throws(() => assertSeaJourneyEquipment(bad));
  assert.throws(() => f.session.prepareDeparture({ scene: 'unknown', seed: '19' }));
  assert.throws(() => f.session.prepareDeparture({ scene: 'sea-open-channel', seed: '1.5' }));
  assert.deepEqual(inventoryStore.getState(), initial); assert.equal(gameState.getCycle(), 0); f.session.close();
});

check('the actual base departure method retains its plan across failed save and dispatches only after retry', () => {
  const f = fixture(), scene = new PurificationScene();
  type Gate = { devDeparture: PurificationDevDeparture | null; transitionToRift(): void };
  const gate = scene as unknown as Gate;
  let retry: (() => void) | undefined;
  Object.assign(scene, { devSession: { prepareDeparture: () => f.session.prepareDeparture({ scene: 'sea-folded-ridge', seed: '7' }) },
    requestSaveRetry: (afterSaved: () => void) => { retry = () => { assert(saveManager.trySave()); afterSaved(); }; },
    finishRiftDeparture: () => { const plan = gate.devDeparture!; gate.devDeparture = null;
      plan.start({ cycle: gameState.getCycle(), modifiers: gameState.getSortieModifiers(), loadout: contaminantSystem.getSortieLoadout() }); } });
  f.storage.fail = true; gate.transitionToRift();
  assert(saveManager.hasPendingSave()); assert.equal(f.counts().starts, 0); assert.equal(gameState.getCycle(), 1);
  const id = inventoryStore.getRun()!.id; gate.transitionToRift(); assert.equal(inventoryStore.getRun()!.id, id);
  f.storage.fail = false; assert(retry); retry();
  assert.equal(f.counts().starts, 1); assert.equal(f.session.snapshot().world!.sceneId, 'sea-folded-ridge');
  assert.equal(gameState.getCycle(), 1); assert.equal(inventoryStore.getRun()!.id, id);
  f.session.close(); assert.equal(inventoryStore.getRun()!.status, 'active');
});

check('formal settlement and base-save retry each occur once, with no duplicate return impact', () => {
  const f = fixture(); departure(f.session);
  const ended = endRun(f.session, false, f.storage);
  assert.equal(inventoryStore.getRun()!.status, 'active'); assert.equal(f.session.returnToBase(), false);
  f.storage.fail = false; ended.retry(); assert.equal(f.session.snapshot().phase, 'rift-settled');
  f.storage.fail = true; ended.controller.restart();
  assert.equal(f.counts().bases, 2); assert.equal(f.session.snapshot().phase, 'base-starting'); assert(saveManager.hasPendingSave());
  const afterImpact = gameState.getState(), inventory = inventoryStore.getState();
  ended.controller.restart(); assert.equal(f.session.returnToBase(), false); assert.equal(f.counts().bases, 2);
  f.retryBase(); assert.equal(f.session.snapshot().phase, 'base');
  assert.deepEqual(gameState.getState(), afterImpact); assert.deepEqual(inventoryStore.getState(), inventory);
  const boundaries = f.session.exportLedger().map(row => row.boundary);
  assert.equal(boundaries.filter(value => value === 'rift-settled').length, 1);
  assert.equal(boundaries.filter(value => value === 'base-saved').length, 2);
  ended.controller.destroy(); f.session.close();
});

check('source-derived items keep IDs through real scene offering, maturation and next departure; death leaves stash intact', () => {
  const f = fixture(); const first = departure(f.session), world = createSuspendedSeaWorld(19, 'sea-open-channel');
  const node = world.base.layout.contaminantNodes.find(value => value.id === 'SS_foreign-remnant')!;
  const drop = rollContaminantNodeDrop(19, node.id, node.tier, node.lootPoolId);
  assert.equal(drop.type, 'kindle'); assert.equal(drop.quality, 'good');
  const tool = contaminantSystem.createUnowned(drop.type, drop.rarity, drop.quality);
  const weaponNode = world.base.layout.kindlingNodes.find(value => value.id === 'SS_foreign-kindling')!;
  const definitionId = rollWeaponDrop({ runSeed: 19, nodeId: weaponNode.id, tier: weaponNode.tier, firstWeaponDiscovered: false, allowWeapon: weaponNode.allowWeapon });
  assert.equal(definitionId, 'crowbar_good_standard');
  const weapon = createWeaponInstance(definitionId!);
  success(inventoryStore.revealBatch(node.id, [{ id: tool.id, kind: 'contaminant', contaminant: tool,
    source: { runId: first.id, nodeId: node.id } }, { id: weapon.id, kind: 'weapon', weapon,
    source: { runId: first.id, nodeId: weaponNode.id } }], { x: 0, y: 0 }));
  let ended = endRun(f.session); ended.controller.restart(); ended.controller.destroy();
  success(inventoryStore.slotOffering(tool.id, 0)); success(inventoryStore.slotOffering(weapon.id, 1));
  assert.equal(getEquipmentLifecycle(inventoryStore.getItem(tool.id)!).impactCharges, 0);
  for (const [seed, expected] of [['7', 2], ['41', 4]] as const) {
    departure(f.session, seed); ended = endRun(f.session); ended.controller.restart(); ended.controller.destroy();
    assert.equal(getEquipmentLifecycle(inventoryStore.getItem(tool.id)!).impactCharges, expected);
  }
  assert.equal(getEquipmentLifecycle(inventoryStore.getItem(tool.id)!).usesRemaining, 6);
  const thirdBoundary = f.session.exportLedger();
  success(inventoryStore.prepareTool(tool.id, 0)); departure(f.session, '19');
  success(inventoryStore.consumeTool(tool.id)); // Unit fixture: the production transaction, not a claimed keyboard cast.
  assert.equal(getEquipmentLifecycle(inventoryStore.getItem(tool.id)!).usesRemaining, 5);
  ended = endRun(f.session); ended.controller.restart(); ended.controller.destroy();
  assert.equal(getEquipmentLifecycle(inventoryStore.getItem(weapon.id)!).usesRemaining, 75);
  success(inventoryStore.prepareWeapon(weapon.id)); departure(f.session, '7');
  success(inventoryStore.consumeEquipmentUse(weapon.id)); assert.equal(getEquipmentLifecycle(inventoryStore.getItem(weapon.id)!).usesRemaining, 74);
  const stashId = inventoryStore.getItems().find(item => item.location.kind === 'stash' && item.kind === 'weapon')!.id;
  ended = endRun(f.session, true); ended.controller.restart(); ended.controller.destroy();
  assert.equal(inventoryStore.getItem(tool.id), undefined); assert.equal(inventoryStore.getItem(weapon.id), undefined);
  assert(inventoryStore.getItem(stashId));
  assert.equal(thirdBoundary.filter(row => row.boundary === 'base-saved').length, 4);
  assert.equal(f.session.exportLedger().filter(row => row.boundary === 'base-saved').length, 6);
  const copy = f.session.exportLedger() as unknown as { state: { inventory: { items: unknown[] } } }[];
  copy[0]!.state.inventory.items.length = 0; assert.equal(f.session.exportLedger()[0]!.state.inventory.items.length, 1);
  f.session.close(); assert.equal(browserWrites, 0);
});

check('partial insertion and closing an active temporary page never synthesize a death or reinitialize inventory', () => {
  const f = fixture(true), starter = inventoryStore.getEquipment().weaponId;
  assert.throws(() => departure(f.session), /Engine insertion failed/);
  assert.equal(f.session.snapshot().phase, 'faulted'); assert.equal(inventoryStore.getRun()!.status, 'active');
  f.session.close(); f.session.close();
  assert.equal(inventoryStore.getEquipment().weaponId, starter); assert.equal(inventoryStore.getRun()!.status, 'active');
  assert.equal(f.session.exportLedger().filter(row => row.boundary === 'closed').length, 1);
  assert.equal(f.session.returnToBase(), false);
});

check('ten definitions draw their native variants, four quality silhouettes remain distinct, and grip scale is preserved', () => {
  const frame = createPresentationFrame(); frame.player.hp = 100;
  const signatures = new Set<string>(), sourceSignatures = new Set<string>();
  assert.equal(Object.keys(WEAPON_DATA).length, 10);
  for (const weapon of Object.values(WEAPON_DATA)) {
    assert(supportsStageWeapon(weapon.id)); const model = new StagePlayer(); frame.player.weaponDefinitionId = weapon.id;
    const hash = createHash('sha256'), sourceHash = createHash('sha256');
    // Record actual pixel polygons submitted to the native painter, including
    // grip pixels subsequently occluded by the hand. Authored variants differ
    // only at that grip; they must not be enlarged or recoloured to fake variety.
    const polygon = ActorPixelDrawing.prototype.polygon;
    ActorPixelDrawing.prototype.polygon = function(vertices, colour, count, bias) {
      sourceHash.update(JSON.stringify([Array.from(vertices), colour, count, bias]));
      return polygon.call(this, vertices, colour, count, bias);
    };
    for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      frame.player.facing = facing; model.update(frame.player, 1000); hash.update(model.copyPixels());
      assert.equal(model.snapshot().weaponDefinitionId, weapon.id);
      const tip = model.snapshot().weaponTip as number[];
      assert(Math.hypot(tip[0]! - frame.player.position.x, tip[2]! - frame.player.position.y) < 40);
    }
    ActorPixelDrawing.prototype.polygon = polygon;
    sourceSignatures.add(sourceHash.digest('hex')); signatures.add(hash.digest('hex')); disposeTree(model.root);
  }
  assert.equal(sourceSignatures.size, 10, 'Each legal definition must submit its actual native asset');
  assert.equal(signatures.size, 4, 'Four quality silhouettes differ; same-quality grip marks can be occluded by the glove');
  assert(!supportsStageWeapon('future-weapon'));
});
console.log(`${passed} journey integration checks passed. Actual five-run keyboard and held-model visual QA remain separate.`);
