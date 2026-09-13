/** Native module fixture; rendering and DOM alone are adapted. Not a playthrough. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Player } from '../../src/entities/player';
import { AISystem } from '../../src/systems/ai/ai-system';
import { CombatSystem } from '../../src/systems/combat-system';
import { ToolSystem } from '../../src/systems/tool-system';
import { ChaosSystem, getChaosModulators } from '../../src/systems/chaos-system';
import { TrailSystem } from '../../src/systems/trail-system';
import { Minimap } from '../../src/ui/minimap';
import { FieldLootInventory } from '../../src/systems/field-loot-inventory';
import { RunController } from '../../src/systems/run-controller';
import { TileGrid } from '../../src/systems/tile-grid';
import { createSuspendedSeaWorld } from '../../src/dev/suspended-sea/world';
import { SuspendedSeaRuntime } from '../../src/dev/suspended-sea/runtime';
import { StageVisibility } from '../../src/dev/spatial-study/stage/terrain';
import { StageFollowCamera } from '../../src/dev/spatial-study/stage/camera';
import type { RiftDevRuntimeContext } from '../../src/scenes/rift-scene';
import { TileType } from '../../src/types/game-types';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import type { Vector2 } from '../../src/types/game-types';
import type { ActiveRiftRecoveryState, RiftRecoveryConditions } from '../../src/systems/rift-recovery-state';
const { LootSearchSystem } = await import('../../src/systems/loot-search-system');
const require = createRequire(import.meta.url), Emitter = require('eventemitter3');
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
class Point {
  constructor(public x = 0, public y = 0) {}
  set(x: number, y: number) { this.x = x; this.y = y; return this; }
  copy(p: Vector2) { return this.set(p.x, p.y); }
}
class Image {
  texture: { key: string }; body: Body; depth = 0; name = ''; active = true;
  constructor(public x: number, public y: number, key: string) { this.texture = { key }; this.body = new Body(this); }
  setDepth(value: number) { this.depth = value; return this; } setName(value: string) { this.name = value; return this; }
  setPosition(x: number, y: number) { this.x = x; this.y = y; return this; } setTexture(key: string) { this.texture.key = key; return this; }
  setVisible() { return this; } setOrigin() { return this; } setRotation() { return this; } setAlpha() { return this; }
  setScale() { return this; } setTintFill() { return this; } destroy() { this.active = false; }
}
class Body {
  position = new Point(); prev = new Point(); prevFrame = new Point(); velocity = new Point(); center = new Point(); halfWidth = 10; halfHeight = 10;
  constructor(readonly image: Image) { this.reset(image.x, image.y); }
  reset(x: number, y: number) { this.image.setPosition(x, y); this.position.set(x - this.halfWidth, y - this.halfHeight);
    this.prev.copy(this.position); this.prevFrame.copy(this.position); this.velocity.set(0, 0); this.updateCenter(); return this; }
  updateCenter() { this.center.set(this.position.x + this.halfWidth, this.position.y + this.halfHeight); }
  setSize(w: number, h: number) { this.halfWidth = w / 2; this.halfHeight = h / 2; return this.reset(this.image.x, this.image.y); }
  setOffset() { return this; } setCollideWorldBounds() { return this; } setImmovable() { return this; }
}
const graphic: unknown = new Proxy({}, { get: () => () => graphic });
export function createNativeRecoveryFixture(options: { preserveInventory?: boolean; seed?: number; sceneId?: 'sea-open-channel' | 'sea-folded-ridge'; conditions?: RiftRecoveryConditions } = {}) {
  if (!options.preserveInventory) {
    inventoryStore.setPersistence(null); contaminantSystem.reset(); inventoryStore.configure({ capacity: 10000 });
    assert(inventoryStore.beginRun('whole-native-run').ok);
  }
  const conditions = options.conditions ?? { cycle: 1, modifiers: { chaosRateModifier: 1, kindlingValueModifier: 1, startingChaos: 0 } };
  const seed = options.seed ?? 19;
  const native = createSuspendedSeaWorld(seed, options.sceneId ?? 'sea-open-channel');
  const engine = { time: { now: 0, delayedCall() {} }, input: { keyboard: null },
    physics: { world: new Emitter(), add: { image: (x: number, y: number, key: string) => new Image(x, y, key) } },
    add: { image: (x: number, y: number, key: string) => new Image(x, y, key), graphics: () => graphic },
    cameras: { main: { worldView: { x: 0, y: 0, width: 100, height: 100 } } } };
  const grid = new TileGrid(native.base.layout.tileMap), ai = new AISystem();
  ai.create(engine as never, native.base.layout.enemySpawns, grid, grid, { recovery: { runSeed: seed, signature: native.metadata.signature } });
  for (const enemy of ai.getEnemies()) Object.assign(enemy, { syncVisuals() {} });
  const player = new Player(), spawn = native.base.layout.spawnPoint, image = new Image(spawn.x, spawn.y, 'player');
  Object.assign(player, { image, lag: { isTurning: false, trigger() {}, sync() {} }, aura: { sync() {} },
    weaponRig: { equip() {}, sync() {}, getTorsoOffset: () => ({ x: 0, y: 0, rotation: 0 }) } });
  player.postUpdate();
  const combat = new CombatSystem();
  Object.assign(combat, { scene: engine, player, ai, occluders: grid, hooks: {}, spawnFx() {}, drawVisuals() {}, stepFx() {} });
  combat.noteRosterChanged(); combat.configureWeapon('crowbar_plain', seed);
  const worldContext = { player, isRunEnded: () => run.isRunEnded(),
    visibilityAt: (point: Readonly<Vector2>) => Math.hypot(point.x - spawn.x, point.y - spawn.y) < 160 ? 1 : 0,
    registerMeleeTargets: (owner: Parameters<CombatSystem['registerMeleeTargets']>[0]) => {
      combat.registerMeleeTargets(owner); return () => combat.unregisterMeleeTargets(owner); },
    applyHazardHit: () => false } as unknown as RiftDevRuntimeContext;
  const memory = new StageVisibility(worldContext, native.base.width, native.base.height, (x, y) => {
    const map = native.base.layout.tileMap, tile = map.tiles[Math.floor(y / map.tileSize)]?.[Math.floor(x / map.tileSize)];
    return tile !== undefined && tile !== TileType.VOID;
  });
  const camera = new StageFollowCamera(native.base.width, native.base.height, spawn);
  // Actual geometry/state owners; renderer, audio and shell drawing are omitted.
  const world = new SuspendedSeaRuntime(worldContext, native.base, native.shellDefinition, () => {}, () => ({
    update: time => { memory.update(time); camera.update(time, { position: player.getPosition(), velocity: { x: 0, y: 0 }, moving: false }, false); },
    destroy: () => memory.texture.dispose(), snapshot: () => ({}),
    exportRuntimeState: () => ({ version: 1, memory: memory.exportRuntimeState(), camera: camera.exportRuntimeState() }),
    validateRuntimeState: value => { const state = value as { version: number; memory: unknown; camera: unknown };
      return state?.version === 1 && memory.validateRuntimeState(state.memory) && camera.validateRuntimeState(state.camera); },
    restoreRuntimeState: value => { const state = value as { memory: unknown; camera: unknown };
      memory.restoreRuntimeState(state.memory); camera.restoreRuntimeState(state.camera); },
  }));
  combat.enableRuntimeRecovery({ signature: native.metadata.signature, runSeed: seed, externalTargetIds: [native.shellDefinition.id] });
  const tools = new ToolSystem();
  tools.create(engine as never, contaminantSystem.getSortieLoadout(), () => ({ ...player.getPosition() }), () => ai.getEnemies(), {
    setEnemyControl: (id, source, effect) => ai.setEnemyControl(id, source, effect),
    clearEnemyControl: (id, source) => ai.clearEnemyControl(id, source), setHearingSuppressed: value => ai.setHearingSuppressed(value),
  });
  const chaos = new ChaosSystem({ startingValue: conditions.modifiers.startingChaos, chaosRateModifier: conditions.modifiers.chaosRateModifier });
  player.setSpeedModifier('chaos', getChaosModulators(chaos.getValue()).speedMult);
  const search = new LootSearchSystem();
  Object.assign((search as unknown as { hud: object }).hud, { create() {}, destroy() {}, setPrompt() {}, setChannel() {}, setKindling() {}, flashResidue() {}, flashKindling() {} });
  search.create(engine as never, native.base.layout.kindlingNodes, native.base.layout.contaminantNodes, {
    overlayRoot: {} as never, getVisibilityAt: () => 1, fragmentTypeId: 'suspended-sea', runSeed: seed, inventoryEnabled: true,
    kindlingValueModifier: conditions.modifiers.kindlingValueModifier,
    createVisual: (_s, p) => ({ x: p.x, y: p.y, setVisibility() {}, setRummaging() {}, playReveal() {}, update() {}, destroy() {} }),
  });
  const field = new FieldLootInventory(); field.restoreRuntimeState({ version: 1, acquisitionRun: null, acquiredIds: [] });
  const trail = new TrailSystem(), map = native.base.layout.tileMap, minimap = new Minimap();
  trail.create(engine as never, map.cols, map.tileSize, () => 1);
  Object.assign(minimap, { mapWidth: map.cols, mapHeight: map.rows, tileSize: map.tileSize,
    explored: new Uint8Array(map.cols * map.rows), extractionTile: {
      x: Math.floor(native.base.layout.extractionPoint.position.x / map.tileSize), y: Math.floor(native.base.layout.extractionPoint.position.y / map.tileSize) } });
  let elapsed = 0;
  const run = new RunController(); run.create(engine as never, { getCarriedKindling: () => search.getCarriedKindling(),
    setPlayerInput: value => player.setInputEnabled(value), pauseChaos: value => chaos.setPaused(value), getElapsedMs: () => elapsed });
  world.beforeCombat(0, false); world.afterUpdate(0);
  const capture = (): ActiveRiftRecoveryState => json({ version: 1, phase: 'active', conditions, physics: { fixedStep: true, fps: 60, timeScale: 1, elapsedMs: 0 },
    player: player.exportRuntimeState(), combat: combat.exportRuntimeState(), ai: ai.exportRuntimeState(), tools: tools.exportRuntimeState(),
    chaos: chaos.exportRuntimeState(), search: search.exportRuntimeState(), field: field.exportRuntimeState(),
    trail: trail.exportRuntimeState(), minimap: minimap.exportRuntimeState(), run: run.exportRuntimeState(),
    world: world.exportRuntimeState(), presentationSequence: 0,
    result: { killCount: 0, acquired: [], passiveTriggers: [] }, defenseHudEffects: [] });
  const finishSearch = (nodeId: string) => {
    const node = search.getNodesProbe().find(n => n.id === nodeId)!;
    const input = { playerPos: { x: node.x, y: node.y }, searchHeld: true, moving: false, attacking: false, toolPressed: false, hitThisFrame: false, paused: false };
    search.update(0, { ...input, searchHeld: false }); search.update(0, input); search.update(1200, input);
  };
  return { native, world, ai, player, combat, tools, chaos, search, field, trail, minimap, run, capture, conditions, finishSearch,
    setElapsed(value: number) { elapsed = value; },
    destroy() { world.destroy(); run.destroy(); tools.destroy(); chaos.destroy(); search.destroy(); trail.destroy(); ai.destroy(); } };
}
