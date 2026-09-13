/** Current-content admission using real native state owners, without a renderer.
 * TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx tools/recovery/check-admission.ts
 */
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { inventoryStore } from '../../src/systems/inventory-store';
import { audioManager } from '../../src/managers/audio-manager';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { TileType } from '../../src/types/game-types';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { TileGrid } from '../../src/systems/tile-grid';
import { bodyDisplacementFraction, bodyHasSupport } from '../../src/systems/ai/physical-grid';
import { createAIRuntimeConfiguration } from '../../src/systems/ai/ai-system';
import { createCombatRuntimeConfigurationSignature } from '../../src/systems/combat-system';
import type { ActiveRiftRecoveryState, SettledRiftRecoveryState } from '../../src/systems/rift-recovery-state';
import type { RiftCheckpoint } from '../../src/types/rift-checkpoint';

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'zh-CN' } });
const { validateSuspendedSeaAdmission: admit } = await import('../../src/dev/suspended-sea/recovery-validation');
const { createNativeRecoveryFixture: fixture } = await import('./native-fixture');
type Fixture = ReturnType<typeof fixture>;
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const originalAudio = { playSFX: audioManager.playSFX, stopLoop: audioManager.stopLoop };
audioManager.playSFX = () => {}; audioManager.stopLoop = () => {};
let checks = 0;
function check(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`); }
function checkpoint(f: Fixture): RiftCheckpoint<ActiveRiftRecoveryState> {
  const metadata = f.native.metadata;
  return json({ version: 1, runId: inventoryStore.getState().run!.id, sequence: 1,
    identity: { worldId: metadata.worldId, layoutId: metadata.sceneId, seed: metadata.seed, signature: metadata.signature },
    elapsedMs: f.run.exportRuntimeState().elapsedMs, state: f.capture() });
}

check('both layouts and seed variants match live AI/Combat configuration; JSON admission preserves all input and emits nothing', () => {
  for (const sceneId of ['sea-open-channel', 'sea-folded-ridge'] as const) for (const seed of [7, 19, 41]) {
    const f = fixture({ sceneId, seed });
    try {
      f.setElapsed(500); f.world.beforeCombat(500, false); f.world.afterUpdate(500);
      const saved = checkpoint(f), inventory = inventoryStore.getState();
      const before = JSON.stringify({ saved, inventory }), grid = new TileGrid(f.native.base.layout.tileMap);
      const config = createAIRuntimeConfiguration(f.native.base.layout.enemySpawns, grid);
      assert.equal(config.rosterSignature, saved.state.ai.rosterSignature);
      assert.equal(createCombatRuntimeConfigurationSignature({ signature: saved.identity.signature, runSeed: seed,
        externalTargetIds: [f.native.shellDefinition.id] }, f.native.base.layout.enemySpawns.map(spawn => ({
        id: spawn.id, role: spawn.type, form: spawn.form! }))), saved.state.combat.configurationSignature);
      let events = 0;
      const onEvent = () => { events++; };
      const observed = [GameEvent.RIFT_EXITED, GameEvent.ENEMY_DAMAGED, GameEvent.ENEMY_KILLED, GameEvent.ENEMY_ALERT];
      for (const event of observed) eventBus.on(event, onEvent);
      try { assert(admit(saved, inventory)); assert(admit(json(saved), inventory)); }
      finally { for (const event of observed) eventBus.off(event, onEvent); }
      assert.equal(events, 0); assert.equal(JSON.stringify({ saved, inventory }), before);
    } finally { f.destroy(); }
  }
});

check('world, shell, camera, memory and actor configuration corruptions reject before hydration', () => {
  const f = fixture();
  try {
    const good = checkpoint(f), inventory = inventoryStore.getState();
    const corruptions: readonly [string, (bad: any) => void][] = [
      ['world absent', bad => { bad.state.world = {}; }],
      ['world signature', bad => { bad.state.world.signature += 'x'; }],
      ['world clock', bad => { bad.state.world.elapsedMs = 1; }],
      ['shell version', bad => { bad.state.world.shell.version = 2; }],
      ['shell signature', bad => { bad.state.world.shell.signature += 'x'; }],
      ['shell clock', bad => { bad.state.world.shell.elapsedMs = 1; }],
      ['shell stopped', bad => { bad.state.world.shell.stopped = true; }],
      ['shell counters', bad => { bad.state.world.shell.committedHits = 1; }],
      ['shell cycle', bad => { bad.state.world.shell.hitCycle = 100; }],
      ['presentation version', bad => { bad.state.world.presentation.version = 2; }],
      ['camera version', bad => { bad.state.world.presentation.camera.version = 2; }],
      ['camera bounds', bad => { bad.state.world.presentation.camera.center.x = -1; }],
      ['camera clock', bad => { bad.state.world.presentation.camera.elapsedMs = 1; }],
      ['camera previous player', bad => { bad.state.world.presentation.camera.previousPlayer.x += 10; }],
      ['memory dimensions', bad => { bad.state.world.presentation.memory.width++; }],
      ['memory payload', bad => { bad.state.world.presentation.memory.seenBits = '%%%'; }],
      ['AI generated recipe', bad => { bad.state.ai.rosterSignature += 'x'; }],
      ['AI foreign route alias', bad => { bad.state.ai.enemies[0].state.currentPatrolLegIndex = 999; }],
      ['AI changed static recipe', bad => { bad.state.ai.enemies[0].state.patrolMode = 'static'; }],
      ['AI different seed', bad => { bad.state.ai.runSeed++; bad.state.combat.runSeed++; bad.state.search.runSeed++; }],
      ['Combat current data', bad => { bad.state.combat.configurationSignature += 'x'; }],
      ['Combat initial roster', bad => { bad.state.combat.enemyIds.reverse(); }],
      ['Combat foreign shell', bad => { bad.state.combat.externalTargetIds = ['foreign-shell']; }],
      ['another inventory run', bad => { bad.runId += 'x'; }],
      ['current world metadata', bad => { bad.identity.signature += 'x'; }],
      ['seed outside uint32', bad => { bad.identity.seed = 0x100000000; }],
    ];
    assert(admit(good, inventory));
    for (const [name, corrupt] of corruptions) { const bad = json(good); corrupt(bad); assert(!admit(bad, inventory), name); }
    assert(admit(good, inventory), 'a failed guard must not contaminate cached recipe or next admission');
  } finally { f.destroy(); }
});

check('memory cannot remember a VOID cell and each temporary DataTexture is disposed even on rejection', () => {
  const f = fixture();
  const originalDispose = THREE.DataTexture.prototype.dispose;
  let disposed = 0;
  THREE.DataTexture.prototype.dispose = function () { disposed++; originalDispose.call(this); };
  try {
    const good = checkpoint(f), inventory = inventoryStore.getState(), bad = json(good) as any;
    assert(admit(good, inventory)); assert.equal(disposed, 1);
    const memory = bad.state.world.presentation.memory, map = f.native.base.layout.tileMap;
    const bits = Uint8Array.from(atob(memory.seenBits), char => char.charCodeAt(0));
    let changed = false;
    for (let index = 0; index < memory.width * memory.height; index++) {
      const x = (index % memory.width + .5) / memory.width * f.native.base.width;
      const y = (Math.floor(index / memory.width) + .5) / memory.height * f.native.base.height;
      if (map.tiles[Math.floor(y / map.tileSize)]?.[Math.floor(x / map.tileSize)] !== TileType.VOID) continue;
      bits[index >> 3]! |= 1 << (index & 7); changed = true; break;
    }
    assert(changed, 'native world has actual void');
    memory.seenBits = btoa(String.fromCharCode(...bits));
    assert(!admit(bad, inventory)); assert.equal(disposed, 2);
    assert(admit(good, inventory)); assert.equal(disposed, 3);
  } finally { THREE.DataTexture.prototype.dispose = originalDispose; f.destroy(); }
});

check('actual actor AABBs reject chasms, edge overlap, out-of-bounds and sprite/body disagreement', () => {
  const f = fixture();
  try {
    const good = checkpoint(f), inventory = inventoryStore.getState(), grid = new TileGrid(f.native.base.layout.tileMap);
    const half = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
    const positions = [{ x: -1, y: -1 }];
    let voidPoint: { x: number; y: number } | undefined, edgePoint: { x: number; y: number } | undefined;
    for (let row = 0; row < grid.rows; row++) for (let col = 0; col < grid.cols; col++) {
      if (grid.getTile(col, row) === TileType.VOID) voidPoint ??= { x: (col + .5) * grid.tileSize, y: (row + .5) * grid.tileSize };
      if (grid.isWalkable(col, row) && !grid.isWalkable(col + 1, row)) {
        edgePoint ??= { x: (col + 1) * grid.tileSize - half / 2, y: (row + .5) * grid.tileSize };
      }
    }
    assert(voidPoint && edgePoint); positions.push(voidPoint, edgePoint);
    assert(grid.isWalkableAt(edgePoint.x, edgePoint.y), 'center-only floor admission would incorrectly accept this body');
    for (const position of positions) for (const actor of ['player', 'enemy'] as const) {
      const bad = json(good) as any;
      const entity = actor === 'player' ? bad.state.player : bad.state.ai.enemies[0].entity;
      entity.position = { ...position }; entity.bodyPosition = { x: position.x - half, y: position.y - half };
      if (actor === 'enemy') bad.state.ai.enemies[0].state.position = { ...position };
      else bad.state.world.presentation.camera.previousPlayer = { ...position };
      assert(!admit(bad, inventory), `${actor}: ${JSON.stringify(position)}`);
    }
    const disagreement = json(good) as any; disagreement.state.player.bodyPosition.x++;
    assert(!admit(disagreement, inventory));
    const edge = { x: edgePoint.x - half / 2, y: edgePoint.y };
    assert(bodyHasSupport(grid, edge, half, half), 'exact contact with the floor edge remains legal');
    assert.equal(bodyDisplacementFraction(grid, edge, half, half, 0, 1), 1, 'same touching-edge convention as existing movement');
    assert(admit(good, inventory));
  } finally { f.destroy(); }
});

check('known dead roster remains absent while historical tool references stay admissible', () => {
  const f = fixture();
  try {
    const saved = checkpoint(f) as any, deadId = saved.state.ai.enemies[0].id;
    saved.state.ai.enemies.shift(); saved.state.combat.enemies.shift(); saved.state.result.killCount = 1;
    saved.state.tools.controlSerial = 1;
    saved.state.tools.stitchStops = [{ enemyId: deadId, source: 'tool:1', remainingMs: 500 }];
    assert(admit(saved, inventoryStore.getState()));
    saved.state.ai.enemies = []; saved.state.combat.enemies = []; saved.state.result.killCount = 2;
    assert(admit(saved, inventoryStore.getState()));
  } finally { f.destroy(); }
});

check('terminal receipt validates same identity/ledger without actor/world payload or DataTexture allocation', () => {
  const f = fixture({ seed: 83, sceneId: 'sea-folded-ridge' });
  const originalDispose = THREE.DataTexture.prototype.dispose;
  let disposed = 0;
  try {
    const before = checkpoint(f); f.setElapsed(800); f.run.abandon();
    const receipt: RiftCheckpoint<SettledRiftRecoveryState> = { ...before, elapsedMs: 800,
      state: { version: 1, phase: 'settled', conditions: f.conditions, run: f.run.exportRuntimeState(),
        result: { killCount: 0, acquired: [], passiveTriggers: [] }, presentationSequence: 0 } };
    const inventory = inventoryStore.getState();
    THREE.DataTexture.prototype.dispose = function () { disposed++; originalDispose.call(this); };
    assert(admit(json(receipt), inventory)); assert.equal(disposed, 0);
    const bad = json(receipt); bad.identity.signature += 'x'; assert(!admit(bad, inventory));
    const settled = json(inventory); settled.run!.baseSettled = true; assert(!admit(receipt, settled));
  } finally { THREE.DataTexture.prototype.dispose = originalDispose; f.destroy(); }
});

inventoryStore.setPersistence(null); audioManager.playSFX = originalAudio.playSFX; audioManager.stopLoop = originalAudio.stopLoop;
console.log(`check:recovery-admission ${checks} passed (real state owners, no GPU or browser)`);
