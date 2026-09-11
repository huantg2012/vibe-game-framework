import assert from 'node:assert/strict';
import { BUILD_LAB_LOADOUTS, BUILD_LAB_SCENES } from '../../src/generated/build-lab-data';
import { buildLabFixtureSignature, BUILD_LAB_VOLUMES, createBuildLabLayout } from '../../src/dev/build-lab-fixtures';
import { BuildLabMemoryStorage, prepareBuildLabRun } from '../../src/dev/build-lab-session';
import { BuildLabRecorder, type BuildLabSample } from '../../src/dev/build-lab-recorder';
import { saveManager } from '../../src/managers/save-manager';
import { gameState } from '../../src/managers/game-state';
import { inventoryStore } from '../../src/systems/inventory-store';
import { getSurvivalAttributes } from '../../src/systems/survival-attributes';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { RunController } from '../../src/systems/run-controller';
import { TileType } from '../../src/types/game-types';

let checks = 0;
function check(name: string, fn: () => void): void { fn(); checks++; console.log(`PASS ${name}`); }
const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let productionAccesses = 0;
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => {
  productionAccesses++; throw new Error('Production storage must never be touched by the lab');
} });
const memory = new BuildLabMemoryStorage();
saveManager.setStorage(memory);

function shortest(scene: ReturnType<typeof createBuildLabLayout>, target: {x:number;y:number}, avoid?: (col:number,row:number) => boolean): number {
  const start = { col: Math.floor(scene.spawnPoint.x / 32), row: Math.floor(scene.spawnPoint.y / 32), distance: 0 };
  const queue = [start], seen = new Set([`${start.col}:${start.row}`]);
  for (let index = 0; index < queue.length; index++) {
    const point = queue[index]!;
    if (point.col === Math.floor(target.x / 32) && point.row === Math.floor(target.y / 32)) return point.distance;
    for (const [dx, dy] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      const col = point.col + dx!, row = point.row + dy!, id = `${col}:${row}`;
      if (!seen.has(id) && scene.walkableMask.isWalkable(col,row) && !avoid?.(col,row)) {
        seen.add(id); queue.push({col,row,distance:point.distance+1});
      }
    }
  }
  return Infinity;
}

try {
  check('3 encounters × 3 seeds × 3 volume bodies retain legal connected fixtures and one hearing axis', () => {
    for (const row of BUILD_LAB_SCENES) for (const seed of [0,7,99991]) for (const volume of BUILD_LAB_VOLUMES) {
      const layout = createBuildLabLayout(row.id, seed, volume);
      assert(layout.ruins.metrics.leftoverConnected);
      assert.equal(layout.contaminationDraw.forms.filter(form => form.lexemes.sense === 'sense_hear').length, 1);
      assert.equal(layout.contaminationDraw.forms.filter(form => form.portfolio === 'jia').length, layout.enemySpawns.length);
      for (const node of [...layout.kindlingNodes,...layout.contaminantNodes]) assert(Number.isFinite(shortest(layout,node.position)));
      if (row.id === 'periodic') assert.equal(layout.contaminationDraw.forms.find(form => form.portfolio === 'ding')?.substrate,volume);
    }
  });
  check('watched shortcut and periodic hazard each have longer genuine alternate ground routes', () => {
    const watched = createBuildLabLayout('watched',7), periodic = createBuildLabLayout('periodic',7);
    const watchedPrize = watched.contaminantNodes[0]!.position;
    assert(shortest(watched,watchedPrize,(col,row) => col === 16 && row >= 10 && row <= 14) > shortest(watched,watchedPrize));
    assert(Number.isFinite(shortest(watched,watchedPrize,(col,row) => col === 16 && row >= 10 && row <= 14)));
    const periodicPrize = periodic.contaminantNodes[0]!.position;
    const detour = shortest(periodic,periodicPrize,(col,row) => col >= 16 && col <= 21 && row >= 10 && row <= 15);
    assert(Number.isFinite(detour)); assert(detour > shortest(periodic,periodicPrize));
    // Exactly one wall cell thick, with actual full-tile walkable landing on both sides.
    assert.equal(watched.tileMap.tiles[8]![16],TileType.WALL);
    assert(watched.walkableMask.isWalkable(15,8) && watched.walkableMask.isWalkable(17,8));
  });
  check('fixed seed/input signatures do not depend on equipment; fresh layouts cannot leak mutations', () => {
    const before = createBuildLabLayout('periodic',7);
    const signature = buildLabFixtureSignature('periodic',7,'gas_mass');
    before.tileMap.tiles[12]![5] = TileType.WALL;
    const after = createBuildLabLayout('periodic',7);
    assert.equal(after.tileMap.tiles[12]![5],TileType.FLOOR);
    assert.equal(buildLabFixtureSignature('periodic',7,'gas_mass'),signature);
    assert.notEqual(buildLabFixtureSignature('periodic',8,'gas_mass'),signature);
    assert.notEqual(buildLabFixtureSignature('periodic',7,'mist_bank'),signature);
    assert.throws(() => createBuildLabLayout('periodic',NaN));
  });
  check('all 7 loadouts use actual factories, legal ordinary slots and fresh run ledgers', () => {
    const weights: Record<string,number> = {};
    for (const definition of BUILD_LAB_LOADOUTS) {
      const runId = prepareBuildLabRun(definition.id);
      const state = inventoryStore.getState();
      assert.equal(state.run?.id,runId); assert.equal(state.run?.status,'active');
      assert.deepEqual(state.run?.revealedNodes,{}); assert.deepEqual(state.run?.destroyedIds,[]);
      assert(state.items.every(item => item.kind === 'weapon' || item.contaminant.quality === 'ordinary'));
      weights[definition.id] = getSurvivalAttributes().weight;
    }
    assert.equal(weights.quiet! - weights.light!,20);
    assert.equal(weights['cycle-none'],weights.bare);
    assert.equal(weights['cycle-delay'],weights['cycle-suppress']);
  });
  check('save, migration-compatible load, active-run reload, delete and world commit stay in the injected backend', () => {
    prepareBuildLabRun('quiet');
    const id = inventoryStore.getEquipment().weaponId!;
    assert(inventoryStore.consumeEquipmentUse(id).ok);
    const before = inventoryStore.getState();
    assert(saveManager.hasSave()); assert(saveManager.peekRecordSummary());
    assert(saveManager.load()); assert.deepEqual(inventoryStore.getState(),before);
    assert.equal(inventoryStore.getRun()?.status,'active');
    assert(saveManager.commitWorldTransaction(() => {}));
    assert(inventoryStore.consumeEquipmentUse(id).ok, 'transaction reattached persistence must use the same backend');
    assert(memory.getItem(GAME_CONSTANTS.SAVE.KEY));
    saveManager.deleteSave(); assert.equal(saveManager.hasSave(),false);
    assert.equal(productionAccesses,0);
  });
  check('injected write failures roll back consumption and retry pending world saves without touching production storage', () => {
    class FailableMemoryStorage extends BuildLabMemoryStorage {
      failWrites = false;
      override setItem(key: string, value: string): void {
        if (this.failWrites) throw new Error('Injected storage write failure');
        super.setItem(key,value);
      }
    }
    const backend = new FailableMemoryStorage();
    saveManager.setStorage(backend);
    prepareBuildLabRun('quiet');
    const weaponId = inventoryStore.getEquipment().weaponId!;
    const toolId = inventoryStore.getEquipment().toolIds[0]!;
    const initial = inventoryStore.getState(), originalBytes = backend.getItem(GAME_CONSTANTS.SAVE.KEY);
    let published = 0, worldChanges = 0;
    const unsubscribe = inventoryStore.subscribe(() => published++);
    try {
      backend.failWrites = true;
      for (const id of [weaponId,toolId]) {
        const result = inventoryStore.consumeEquipmentUse(id);
        assert(!result.ok && result.error === 'storage-failed');
        assert.deepEqual(inventoryStore.getState(),initial,'failed consumption cannot debit a use or change references');
        assert.equal(published,0,'failed transaction cannot notify the scene or recorder');
        assert.equal(backend.getItem(GAME_CONSTANTS.SAVE.KEY),originalBytes);
      }
      const initialKindling = gameState.getKindlingReserve();
      assert.equal(saveManager.commitWorldTransaction(() => { worldChanges++; gameState.addKindling(7); }),false);
      assert(saveManager.hasPendingSave()); assert.equal(worldChanges,1);
      assert.equal(gameState.getKindlingReserve(),initialKindling+7);
      assert.equal(backend.getItem(GAME_CONSTANTS.SAVE.KEY),originalBytes);
      assert.throws(() => saveManager.setStorage(memory),'pending world settlement cannot switch persistence backend');
      const whilePending = inventoryStore.consumeEquipmentUse(weaponId);
      assert(!whilePending.ok && whilePending.error === 'storage-failed');
      assert.equal(published,0); assert.deepEqual(inventoryStore.getState(),initial);
      assert.equal(saveManager.commitWorldTransaction(() => worldChanges++),false,'pending operation cannot replay world changes');
      assert.equal(worldChanges,1);
      backend.failWrites = false;
      assert(saveManager.trySave()); assert.equal(saveManager.hasPendingSave(),false);
      assert.equal(worldChanges,1); assert.equal(gameState.getKindlingReserve(),initialKindling+7);
      const saved = JSON.parse(backend.getItem(GAME_CONSTANTS.SAVE.KEY)!);
      assert.equal(saved.kindlingReserve,initialKindling+7);
      assert.deepEqual(saved.inventory,initial);
      assert(inventoryStore.consumeEquipmentUse(weaponId).ok);
      assert.equal(published,1,'successful post-retry transaction publishes once');
      assert.deepEqual(JSON.parse(backend.getItem(GAME_CONSTANTS.SAVE.KEY)!).inventory,inventoryStore.getState(),
        'retry must reattach the same memory backend to subsequent inventory persistence');
      assert.equal(productionAccesses,0);
    } finally {
      unsubscribe(); backend.failWrites = false;
      if (saveManager.hasPendingSave()) saveManager.save();
      saveManager.setStorage(memory);
    }
  });
  check('recorded uses distinguish damage/breakage from dropping and death loss', () => {
    prepareBuildLabRun('quiet');
    const initial = inventoryStore.getState(), id = inventoryStore.getEquipment().weaponId!;
    const recorder = new BuildLabRecorder({trainingInventory:true},initial);
    assert(inventoryStore.consumeEquipmentUse(id).ok); recorder.inventory(inventoryStore.getState());
    assert.equal(recorder.record.metrics.consumedUses[id],1);
    assert(inventoryStore.settleRun(inventoryStore.getRun()!.id,'death').ok);
    recorder.inventory(inventoryStore.getState()); recorder.finish('death',inventoryStore.getState());
    assert.equal(recorder.record.metrics.consumedUses[id],1,'remaining durability lost at death is not consumed hit count');
    assert.equal(Object.keys(recorder.record.metrics.consumedUses).length,1,'lost unspent skills are not uses');
    assert.equal(recorder.record.finalInventory.items.length,0);
    recorder.event('ignored',{}); assert.equal(recorder.record.events.at(-1)?.event,'record:finished');
    prepareBuildLabRun('bare'); const finalId = inventoryStore.getEquipment().weaponId!;
    const almostBroken = inventoryStore.getState(); const weapon = almostBroken.items.find(item => item.id === finalId)!;
    assert(weapon.kind === 'weapon'); weapon.weapon.usesRemaining = 1; assert(inventoryStore.loadState(almostBroken));
    const lastUse = new BuildLabRecorder({},inventoryStore.getState());
    assert(inventoryStore.consumeEquipmentUse(finalId).ok); lastUse.inventory(inventoryStore.getState());
    assert.equal(lastUse.record.metrics.consumedUses[finalId],1);
  });
  check('recorder keeps immutable positions and measures simulation-only stationary/AI intervals', () => {
    prepareBuildLabRun('bare');
    const recorder = new BuildLabRecorder({},inventoryStore.getState());
    const sample: BuildLabSample = {elapsedMs:0,ended:false,player:{x:0,y:0},hp:100,chaos:0,
      attack:{phase:'idle',cooldownRemainingMs:0},kindling:0,search:{prompt:null,progress:null,remaining:2},enemies:[],hosts:[]};
    recorder.sample(sample); sample.player.x = 10; sample.elapsedMs = 100; recorder.sample(sample);
    sample.elapsedMs = 200; recorder.sample(sample);
    assert.equal(recorder.record.samples[0]!.player.x,0);
    assert.equal(recorder.record.metrics.distancePx,10); assert.equal(recorder.record.metrics.stationaryMs,100);
    recorder.sample(sample); assert.equal(recorder.record.metrics.stationaryMs,100,'same clock while paused never counts twice');
  });
  check('RunController alternate return saves real death/extract and emits exactly once before callback', () => {
    for (const reason of ['extract','death'] as const) {
      prepareBuildLabRun('bare');
      const callbacks: (() => void)[] = []; let exited = 0, returned = 0;
      const listener = () => { exited++; assert.equal(inventoryStore.getRun()?.status,'settled'); };
      eventBus.on(GameEvent.RIFT_EXITED,listener);
      const controller = new RunController();
      controller.create({ time:{now:0,delayedCall:(_ms:number,callback:()=>void) => callbacks.push(callback)} } as unknown as Phaser.Scene,
        {pauseChaos:()=>{},setPlayerInput:()=>{},getCarriedKindling:()=>9,onReturn:()=>{returned++; assert.equal(exited,1);} });
      if(reason === 'extract') eventBus.emit(GameEvent.RIFT_EXIT_REACHED,{}); else eventBus.emit(GameEvent.PLAYER_DIED,{cause:'enemy_attack'});
      controller.restart(); callbacks.forEach(callback => callback()); controller.restart();
      assert.equal(inventoryStore.getRun()?.outcome,reason); assert.equal(exited,1); assert.equal(returned,1);
      if(reason === 'death') assert.equal(inventoryStore.getItems().length,0);
      controller.destroy(); eventBus.off(GameEvent.RIFT_EXITED,listener);
    }
    assert.equal(productionAccesses,0);
  });
  console.log(`${checks} build-lab checks passed.`);
} finally {
  inventoryStore.setPersistence(null);
  if (storageDescriptor) Object.defineProperty(globalThis,'localStorage',storageDescriptor); else delete (globalThis as {localStorage?: Storage}).localStorage;
}
