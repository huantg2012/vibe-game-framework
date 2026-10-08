/** DEC-158: real effect/search/memory modules and inventory transactions.
 * Engine drawing, DOM widgets and sound output alone are adapted; this is not a playthrough.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/recovery/check-effects.ts
 */
import assert from 'node:assert/strict';
import { ToolSystem, validateToolRuntimeState } from '../../src/systems/tool-system';
import { ChaosSystem, validateChaosRuntimeState, getChaosModulators } from '../../src/systems/chaos-system';
import { TrailSystem, validateTrailRuntimeState } from '../../src/systems/trail-system';
import { Minimap, validateMinimapRuntimeState } from '../../src/ui/minimap';
import { FieldLootInventory, notifyFieldAcquisition, validateFieldLootRuntimeState } from '../../src/systems/field-loot-inventory';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { CONTAMINANT_DATA } from '../../src/generated/contaminant-data';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { audioManager } from '../../src/managers/audio-manager';
import type { ContaminantType, Vector2 } from '../../src/types/game-types';
import type { ToolRuntimeState } from '../../src/systems/tool-system';
import type { LootSearchRuntimeState } from '../../src/systems/loot-search-system';
import { createSuspendedSeaWorld } from '../../src/dev/suspended-sea/world';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'zh-CN' } });
const { LootSearchSystem, validateLootSearchRuntimeState } = await import('../../src/systems/loot-search-system');
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
let passed = 0;
function check(name: string, run: () => void) { run(); passed++; console.log(`PASS ${name}`); }
const graphic: unknown = new Proxy({}, { get: () => () => graphic });
const scene = { add: { graphics: () => graphic }, time: { now: 123, delayedCall() {} },
  cameras: { main: { worldView: { x: 0, y: 0, width: 96, height: 96 } } } };
const productionAudio = { playSFX: audioManager.playSFX, stopLoop: audioManager.stopLoop };
const audible: unknown[] = [];
audioManager.playSFX = (key, options) => { audible.push([key, json(options ?? null)]); };
audioManager.stopLoop = (...args) => { audible.push(['stop', ...args]); };
const observed: unknown[] = [];
const observe = (event: GameEvent) => (value: unknown) => observed.push([event, json(value)]);
const observers = Object.values(GameEvent).map(event => ({ event, listener: observe(event) }));
for (const { event, listener } of observers) eventBus.on(event, listener);

function toolFixture() {
  const position = { x: 12, y: 12 }, player = { x: 0, y: 0 };
  const controls = new EnemyControlState(), sounds: unknown[] = [];
  let hearing = false;
  const target = { getId: () => 'target', getPosition: () => position, getRole: () => 'infiltrator', getState: () => 'patrol' };
  const system = new ToolSystem();
  system.create(scene as never, contaminantSystem.getSortieLoadout(), () => player, () => [target] as never, {
    setEnemyControl: (_id, source, effect) => controls.set(source, effect),
    clearEnemyControl: (_id, source) => controls.clear(source), hasEnemyControl: (_id, source) => controls.has(source),
    getStitchPlacement: () => ({ pointA: { x: 32, y: -32 }, pointB: { x: 32, y: 32 } }),
    getSoundLureDestination: () => ({ x: 48, y: 0 }),
    reportSoundLure: (point, radius) => sounds.push({ ...point, radius }),
    setHearingSuppressed: value => { hearing = value; },
  });
  return { system, position, player, controls, sounds, get hearing() { return hearing; },
    restoreHearingState(value: boolean) { hearing = value; } };
}
type ToolFixture = ReturnType<typeof toolFixture>;
function prepareTools(types: readonly ContaminantType[], uses = 1) {
  inventoryStore.setPersistence(null); contaminantSystem.reset();
  let active = 0;
  for (const type of types) {
    const item = contaminantSystem.createUnowned(type, CONTAMINANT_DATA[type].rarity);
    item.stage = 'tool'; item.usesRemaining = uses;
    assert(inventoryStore.addContaminant(item).ok);
    assert(inventoryStore.prepareTool(item.id, CONTAMINANT_DATA[type].toolType === 'passive' ? 2 : active++).ok);
  }
  assert(inventoryStore.beginRun(`effects-${types.join('-')}`).ok);
  return toolFixture();
}
function state(f: ToolFixture) {
  return json({ runtime: f.system.exportRuntimeState(), presentation: f.system.getPresentationState(),
    movement: f.controls.movementMultiplier, perception: f.controls.perceptionMultiplier,
    attackSuppressed: f.controls.attackSuppressed, hearing: f.hearing, resistance: f.system.getPollutionResistanceBonus() });
}
/** Re-run exactly the same input and simulation dt from one JSON cut. */
function compareToolContinuation(f: ToolFixture, actions: readonly ((current: ToolFixture) => void)[]) {
  f.system.getPresentationState();
  const checkpoint = json(f.system.exportRuntimeState()), inv = inventoryStore.getState();
  const hearingAtCheckpoint = f.hearing;
  const position = { ...f.position }, player = { ...f.player };
  const eventsAt = observed.length, soundAt = f.sounds.length;
  const expected = actions.map(action => { action(f); return state(f); });
  const expectedInventory = inventoryStore.getState(), expectedEvents = observed.slice(eventsAt), expectedSounds = f.sounds.slice(soundAt);
  f.system.destroy(); assert(inventoryStore.loadState(inv));
  const restored = toolFixture(); Object.assign(restored.position, position); Object.assign(restored.player, player);
  const beforeRestore = observed.length;
  restored.controls.beginRuntimeRestore(); restored.restoreHearingState(hearingAtCheckpoint);
  restored.system.restoreRuntimeState(json(checkpoint)); restored.controls.restoreInterruptRevision(0);
  assert.equal(restored.hearing, hearingAtCheckpoint, 'Tool restore preserves the AI-owned published hearing flag');
  assert.equal(observed.length, beforeRestore, 'restoring emits no lifecycle or ability events');
  assert.equal(restored.sounds.length, 0, 'restoring never reports the initial sound lure again');
  assert.deepEqual(restored.system.exportRuntimeState(), checkpoint);
  const resumedAt = observed.length;
  const actual = actions.map(action => { action(restored); return state(restored); });
  assert.deepEqual(actual, expected); assert.deepEqual(inventoryStore.getState(), expectedInventory);
  assert.deepEqual(observed.slice(resumedAt), expectedEvents); assert.deepEqual(restored.sounds, expectedSounds);
  restored.system.destroy();
}

check('last stitch: crossing history, independent stop, fade tail, source IDs and no repeat consumption', () => {
  const f = prepareTools(['stitch']); assert(f.system.useSlot(0));
  f.system.update(CONTAMINANT_DATA.stitch.toolDurationMs - 150);
  f.position.x = 40; f.system.update(50);
  const saved = f.system.exportRuntimeState();
  assert.equal(saved.loadoutIds[0], null); assert.equal(saved.stitchStops[0]?.remainingMs, 1500);
  assert(validateToolRuntimeState(json(saved))); assert.equal(saved.stitches[0]?.affectedEnemyIds[0], 'target');
  compareToolContinuation(f, [
    current => current.system.update(100), // The line expires while its stop is still live.
    current => current.system.update(90), current => current.system.update(90),
    current => { current.position.x = 12; current.system.update(30); },
    current => { current.position.x = 40; current.system.update(30); },
    current => current.system.update(1160),
  ]);
});
check('stitch before its first crossing retains previous positions, without inventing a source on export', () => {
  const f = prepareTools(['stitch']); assert(f.system.useSlot(0)); f.system.update(20);
  const before = json(f.system.exportRuntimeState());
  for (let i = 0; i < 3; i++) assert.deepEqual(f.system.exportRuntimeState(), before);
  assert.equal(before.controlSerial, 0); assert.equal(before.stitches[0]?.presentationId, null);
  compareToolContinuation(f, [current => { current.position.x = 40; current.system.update(20); }, current => current.system.update(1500)]);
});
check('overlapping compress anchors retain separate sources and remaining lifetimes through the final charge', () => {
  const f = prepareTools(['compress'], 2); assert(f.system.useSlot(0)); f.system.update(1000);
  assert(f.system.useSlot(0)); f.system.update(20);
  const saved = f.system.exportRuntimeState();
  assert.equal(saved.loadoutIds[0], null); assert.equal(saved.anchors.length, 2);
  assert.notEqual(saved.anchors[0]?.source, saved.anchors[1]?.source);
  assert.notEqual(saved.anchors[0]?.remainingMs, saved.anchors[1]?.remainingMs);
  compareToolContinuation(f, [current => current.system.update(3980), current => current.system.update(80),
    current => { current.position.x = 999; current.system.update(20); },
    current => { current.position.x = 12; current.system.update(20); }, current => current.system.update(1000),
    current => current.system.update(80), current => current.system.update(80)]);
});
check('compress with no contact keeps its lazy source and stable control serial', () => {
  const f = prepareTools(['compress']); f.position.x = 999; assert(f.system.useSlot(0)); f.system.update(20);
  assert.equal(f.system.exportRuntimeState().anchors[0]?.source, null);
  compareToolContinuation(f, [current => { current.position.x = 12; current.system.update(10); }, current => current.system.update(100)]);
});
check('kindle resumes its real throw/pulse clock and does not replay the first lure', () => {
  const f = prepareTools(['kindle']); assert(f.system.useSlot(0)); f.system.update(140);
  assert.equal(f.sounds.length, 1);
  compareToolContinuation(f, [current => current.system.update(860), current => current.system.update(1000),
    current => current.system.update(1000), current => current.system.update(5000)]);
});
check('last siphon charge stays active independently of the cleared slot; damage never triggers a second use', () => {
  const f = prepareTools(['siphon']); eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 2, source: 'test' }); f.system.update(200);
  assert.equal(f.system.exportRuntimeState().loadoutIds[2], null); assert(f.system.getPollutionResistanceBonus() > 0);
  compareToolContinuation(f, [current => current.system.update(450),
    () => eventBus.emit(GameEvent.PLAYER_DAMAGED, { amount: 2, source: 'test' }),
    current => current.system.update(CONTAMINANT_DATA.siphon.toolDurationMs - 650)]);
});
check('last muffle episode extends only on real signals and survives an empty slot; never-signaled infinity encodes null', () => {
  const f = prepareTools(['muffle']);
  assert.equal(f.system.exportRuntimeState().muffle.lastSignalMs, null);
  assert(f.system.notifyProximityAvoid()); f.system.update(500);
  compareToolContinuation(f, [current => { assert(current.system.notifyProximityAvoid()); },
    current => current.system.update(CONTAMINANT_DATA.muffle.toolDurationMs - 1),
    current => current.system.update(1), current => { assert.equal(current.system.notifyProximityAvoid(), false); }]);
});
check('fresh muffle restores the initial unpublished hearing state, then the same first real update publishes it', () => {
  const f = prepareTools(['muffle']); assert.equal(f.hearing, false);
  compareToolContinuation(f, [current => current.system.update(16), current => { assert(current.system.notifyProximityAvoid()); }]);
});
check('invalid Tool state leaves runtime untouched; current families recover while retired effects refuse', () => {
  const f = prepareTools(['stitch']); assert(f.system.useSlot(0)); const saved = f.system.exportRuntimeState();
  const bad = json(saved) as unknown as { stitches: { pointA: { x: number } }[] };
  bad.stitches[0]!.pointA.x = NaN;
  assert(!f.system.validateRuntimeState(bad)); assert.throws(() => f.system.restoreRuntimeState(bad));
  assert.deepEqual(f.system.exportRuntimeState(), saved);
  const fork = json(saved) as ToolRuntimeState; (fork.stitches[0]!.pointA as Vector2).x = 999;
  assert.notDeepEqual(f.system.exportRuntimeState(), fork, 'exported coordinates are detached'); f.system.destroy();
  const other = prepareTools(['solidify']); assert(other.system.validateRuntimeState(other.system.exportRuntimeState()));
  // Current solidify is supported by I27; a still-running retired resonance cannot be silently lost.
  Object.assign(other.system, { resonatePendingPoint: { x: 0, y: 0 } });
  assert.throws(() => other.system.exportRuntimeState(), /Retired/); other.system.destroy();
});

check('chaos restores thresholds/chase cooldowns/temp reductions/last projection and advances by simulation time alone', () => {
  const mods: unknown[] = [];
  const a = new ChaosSystem({ chaosRateModifier: .85, startingValue: 45, onModulate: value => mods.push(value) });
  eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: 'target', alertLevel: 'chase' });
  a.setTemporaryRateMult(2, 800); a.setTemporaryRateReduction(.5, 600); a.update(100);
  a.addChaos('test', 20); a.addChaos('test', -2);
  const saved = json(a.exportRuntimeState()); assert(validateChaosRuntimeState(saved));
  const continuation = (current: ChaosSystem) => {
    const result = [];
    eventBus.emit(GameEvent.ENEMY_ALERT, { enemyId: 'target', alertLevel: 'chase' }); // same cooldown, no new bonus
    for (let at = 0; at < 20; at++) { current.update(80); result.push(current.exportRuntimeState()); }
    eventBus.emit(GameEvent.ENEMY_LOST_PLAYER, { enemyId: 'target' });
    result.push(current.exportRuntimeState()); return result;
  };
  const at = observed.length, expected = continuation(a), events = observed.slice(at); a.destroy();
  const b = new ChaosSystem({ chaosRateModifier: .85, onModulate: value => mods.push(value) });
  const atRestore = observed.length; b.restoreRuntimeState(saved); assert.equal(observed.length, atRestore);
  assert.deepEqual(mods.at(-1), getChaosModulators(saved.lastModulated)); assert.deepEqual(b.exportRuntimeState(), saved);
  const actualAt = observed.length; assert.deepEqual(continuation(b), expected); assert.deepEqual(observed.slice(actualAt), events);
  const good = b.exportRuntimeState(); assert.throws(() => b.restoreRuntimeState({ ...good, clockMs: -1 }));
  assert.deepEqual(b.exportRuntimeState(), good); b.setPaused(true); const pause = b.exportRuntimeState();
  b.restoreRuntimeState(json(pause)); b.update(10000); assert.deepEqual(b.exportRuntimeState(), pause); b.destroy();
});

class SearchVisual {
  visible = 0; rummaging = false; reveals = 0;
  readonly x: number; readonly y: number;
  constructor(position: Readonly<Vector2>) { this.x = position.x; this.y = position.y; }
  setVisibility(value: number) { this.visible = value; } setRummaging(value: boolean) { this.rummaging = value; }
  playReveal() { this.reveals++; } update() {} destroy() {}
}
function searchFixture() {
  const native = createSuspendedSeaWorld(19, 'sea-open-channel'), system = new LootSearchSystem();
  const noise: unknown[] = [], visuals: SearchVisual[] = [];
  // Adapt only DOM operations; the actual create(), update() and complete() execute.
  Object.assign((system as unknown as { hud: object }).hud, { create() {}, destroy() {}, setPrompt() {}, setChannel() {}, setKindling() {}, flashResidue() {}, flashKindling() {} });
  system.create(scene as never, native.base.layout.kindlingNodes, native.base.layout.contaminantNodes, {
    overlayRoot: {} as never, getVisibilityAt: () => 1, fragmentTypeId: 'suspended-sea', runSeed: 19, inventoryEnabled: true,
    createVisual: (_scene, position) => { const v = new SearchVisual(position); visuals.push(v); return v; },
    onNoise: (position, radius) => noise.push({ ...position, radius }),
  });
  const field = new FieldLootInventory();
  const input = (nodeId: string, held = true, dt = 100) => {
    const node = system.getNodesProbe().find(row => row.id === nodeId)!;
    system.update(dt, { playerPos: { x: node.x, y: node.y }, searchHeld: held,
      moving: false, attacking: false, toolPressed: false, hitThisFrame: false, paused: false });
  };
  const finish = (nodeId: string) => { input(nodeId, false, 0); input(nodeId, true, 0); for (let i = 0; i < 12; i++) input(nodeId); };
  return { native, system, field, noise, visuals, input, finish };
}
function prepareSearch(capacity = 10000) {
  inventoryStore.setPersistence(null); contaminantSystem.reset(); inventoryStore.configure({ capacity });
  assert(inventoryStore.beginRun('search-recovery').ok);
  const f = searchFixture(); f.field.restoreRuntimeState({ version: 1, acquisitionRun: null, acquiredIds: [] }); return f;
}
check('all seven native search nodes preserve pure fuel, ground loot, cached failed roll and unrolled/none/weapon distinctions', () => {
  const a = prepareSearch(30);
  const fuel = a.native.base.layout.kindlingNodes.find(node => node.allowWeapon === false)!;
  a.finish(fuel.id);
  let state = a.system.exportRuntimeState(); assert.equal(state.nodes.length, 7);
  assert.deepEqual(state.nodes.find(node => node.id === fuel.id)?.weaponRoll, { state: 'none' });
  assert.equal(inventoryStore.getRun()?.revealedNodes[fuel.id], undefined, 'pure kindling has no item ledger entry');
  const remnant = a.native.base.layout.contaminantNodes[0]!; a.finish(remnant.id);
  assert(inventoryStore.getItems().some(item => item.location.kind === 'ground'));
  const weapon = a.native.base.layout.kindlingNodes.find(node => node.allowWeapon)!; a.finish(weapon.id);
  state = a.system.exportRuntimeState(); assert(state.nodes.some(node => node.weaponRoll.state === 'weapon'));
  const pending = a.native.base.layout.contaminantNodes[1]!;
  inventoryStore.setPersistence(() => { throw new Error('Expected durable write failure'); }); a.finish(pending.id);
  const cut = json(a.system.exportRuntimeState()), inv = inventoryStore.getState(), acquired = a.field.exportRuntimeState();
  assert(!cut.nodes.find(node => node.id === pending.id)!.collected); assert(cut.nodes.find(node => node.id === pending.id)!.revealedItem);
  inventoryStore.setPersistence(null);
  const eventsAt = observed.length; a.finish(pending.id);
  const expected = a.system.exportRuntimeState(), expectedInventory = inventoryStore.getState(), expectedEvents = observed.slice(eventsAt);
  a.system.destroy(); assert(inventoryStore.loadState(inv));
  const b = searchFixture(), restoreEventAt = observed.length, restoreSoundAt = audible.length;
  b.field.restoreRuntimeState(json(acquired)); b.system.restoreRuntimeState(cut);
  assert.equal(observed.length, restoreEventAt); assert.equal(audible.length, restoreSoundAt);
  assert.deepEqual(b.system.exportRuntimeState(), cut); assert(b.visuals.every(v => v.reveals === 0));
  assert(b.visuals.filter((_v, i) => cut.nodes[i]!.collected).every(v => v.visible === 0));
  const resumedAt = observed.length; b.finish(pending.id);
  assert.deepEqual(b.system.exportRuntimeState(), expected); assert.deepEqual(inventoryStore.getState(), expectedInventory);
  assert.deepEqual(observed.slice(resumedAt), expectedEvents);
  const clean = b.system.exportRuntimeState(), inconsistent = json(clean) as LootSearchRuntimeState;
  (inconsistent.nodes.find(node => node.id === remnant.id) as { collected: boolean }).collected = false;
  assert(!b.system.validateRuntimeState(inconsistent)); assert.throws(() => b.system.restoreRuntimeState(inconsistent));
  assert.deepEqual(b.system.exportRuntimeState(), clean); assert(validateLootSearchRuntimeState(clean)); b.system.destroy();
});
check('search channel resumes exact progress without replaying start noise or reward, and release still interrupts', () => {
  const a = prepareSearch(); const node = a.native.base.layout.kindlingNodes.find(row => !row.allowWeapon)!;
  a.input(node.id, true, 0); a.input(node.id, true, 400);
  const saved = json(a.system.exportRuntimeState()), inv = inventoryStore.getState(); assert.equal(saved.channel?.elapsedMs, 400);
  const before = observed.length; a.input(node.id, true, 800);
  const expected = a.system.exportRuntimeState(), events = observed.slice(before); a.system.destroy();
  assert(inventoryStore.loadState(inv)); const b = searchFixture(); const soundsAt = audible.length;
  b.system.restoreRuntimeState(saved); assert.equal(audible.length, soundsAt); assert.equal(b.noise.length, 0);
  const at = observed.length; b.input(node.id, true, 800);
  assert.deepEqual(b.system.exportRuntimeState(), expected); assert.deepEqual(observed.slice(at), events); assert.equal(b.noise.length, 0);
  assert(inventoryStore.loadState(inv)); b.system.restoreRuntimeState(saved); b.input(node.id, false, 1);
  assert.equal(b.system.getChannelProgress01(), null); assert.equal(b.system.getCarriedKindling(), saved.carried); b.system.destroy();
});
check('restored acquisition dedup never re-notifies an item after a drop/take cycle and retains unique IDs', () => {
  const f = prepareSearch(); const node = f.native.base.layout.contaminantNodes[0]!; f.finish(node.id);
  const itemId = inventoryStore.getRun()!.revealedNodes[node.id]![0]!, saved = json(f.field.exportRuntimeState());
  assert(validateFieldLootRuntimeState(saved)); assert(saved.acquiredIds.includes(itemId));
  const at = observed.length;
  f.field.restoreRuntimeState(saved); notifyFieldAcquisition([itemId, itemId]);
  assert(inventoryStore.drop([itemId], { x: 0, y: 0 }, () => true).ok);
  assert(inventoryStore.take([itemId], () => true).ok); notifyFieldAcquisition([itemId]);
  assert.equal(observed.length, at); assert.deepEqual(f.field.exportRuntimeState(), saved);
  assert.throws(() => f.field.restoreRuntimeState({ ...saved, acquiredIds: ['unknown-item'] }));
  assert.deepEqual(f.field.exportRuntimeState(), saved); f.system.destroy();
});
check('trail and minimap retain exploration/extraction information without advancing it during offline time', () => {
  const a = new TrailSystem(); a.create(scene as never, 3, 32, () => 1); a.update(1, 1, 0, 500); a.update(2, 1, 0, 500);
  const saved = json(a.exportRuntimeState()); assert(validateTrailRuntimeState(saved));
  const b = new TrailSystem(); b.create(scene as never, 3, 32, () => 1); b.restoreRuntimeState(saved);
  assert.deepEqual(b.exportRuntimeState(), saved); a.update(2, 2, 30, 80); b.update(2, 2, 30, 80);
  assert.deepEqual(b.exportRuntimeState(), a.exportRuntimeState()); a.destroy(); b.destroy();
  // Phaser reuses the same Scene and its owned TrailSystem between sorties.
  a.create(scene as never, 3, 32, () => 1);
  assert.equal(a.exportRuntimeState().elapsedMs, 0);
  assert.deepEqual(a.exportRuntimeState().visited, []);
  a.update(1, 1, 0, 16);
  assert.equal(a.exportRuntimeState().elapsedMs, 16, 'a new sortie must not retain its predecessor clock');
  assert.equal(a.exportRuntimeState().visited[0]?.atMs, 16);
  a.destroy();
  const map = () => {
    const m = new Minimap(); Object.assign(m, { mapWidth: 3, mapHeight: 3, tileSize: 32,
      extractionTile: { x: 1, y: 1 }, explored: new Uint8Array(9) }); return m;
  };
  const first = map(); first.markExplored(1, 1); first.markExplored(0, 0);
  const memory = json(first.exportRuntimeState()); assert(validateMinimapRuntimeState(memory));
  const second = map(); second.restoreRuntimeState(memory); assert.deepEqual(second.exportRuntimeState(), memory);
  first.markExplored(2, 1); second.markExplored(2, 1); assert.deepEqual(first.exportRuntimeState(), second.exportRuntimeState());
  const before = second.exportRuntimeState(); assert.throws(() => second.restoreRuntimeState({ ...memory, explored: [1] }));
  assert.deepEqual(second.exportRuntimeState(), before);
});

for (const { event, listener } of observers) eventBus.off(event, listener);
audioManager.playSFX = productionAudio.playSFX; audioManager.stopLoop = productionAudio.stopLoop;
inventoryStore.setPersistence(null);
console.log(`${passed} effect/search/memory recovery checks passed. JSON equivalence is a unit boundary, not keyboard or performance evidence.`);
