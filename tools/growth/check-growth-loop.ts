/** I27: real purchase/search/combat/impact/tide consumers; engine drawing only is adapted. */
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../src/config/constants';
import { purchaseGrowth } from '../../src/managers/growth-purchases';
import { gameState } from '../../src/managers/game-state';
import { saveManager } from '../../src/managers/save-manager';
import { growthSystem } from '../../src/systems/growth-system';
import { stabilityTracker } from '../../src/systems/stability-tracker';
import { tideSystem } from '../../src/systems/tide-system';
import { impactSystem } from '../../src/systems/impact-system';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { inventoryStore } from '../../src/systems/inventory-store';
import { CombatSystem, validateCombatRuntimeState } from '../../src/systems/combat-system';
import { audioManager } from '../../src/managers/audio-manager';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
const records = new Map<string,string>(); let fail = false;
Object.defineProperty(globalThis, 'localStorage', {configurable:true, value:{getItem:()=>null}});
const { LootSearchSystem } = await import('../../src/systems/loot-search-system');
const { createNativeRecoveryFixture } = await import('../recovery/native-fixture');
saveManager.setStorage({getItem:key=>records.get(key)??null,removeItem:key=>records.delete(key),setItem:(key,value)=>{if(fail)throw Error('quota');records.set(key,value);}});
audioManager.playSFX = ()=>{};
function reset() { fail=false; inventoryStore.setPersistence(null); saveManager.deleteSave(); gameState.reset(); contaminantSystem.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); impactSystem.resetForecastState(); }
const snapshot=()=>({game:gameState.getState(),growth:growthSystem.getState(),stability:stabilityTracker.getState(),forecast:impactSystem.getForecastState()});
let purchaseEvents=0, stabilityEvents=0;
eventBus.on(GameEvent.GROWTH_PURCHASED,()=>purchaseEvents++);eventBus.on(GameEvent.STABILITY_CHANGED,()=>stabilityEvents++);
for (const id of ['growth_vitality','thicken'] as const) {
 reset(); gameState.addKindling(100); saveManager.save(); const before=snapshot(), bytes=records.get(GAME_CONSTANTS.SAVE.KEY), pe=purchaseEvents,se=stabilityEvents;
 fail=true; assert.deepEqual(purchaseGrowth(id),{ok:false,reason:'storage-failed'}); assert.deepEqual(snapshot(),before); assert.equal(records.get(GAME_CONSTANTS.SAVE.KEY),bytes); assert.equal(purchaseEvents,pe);assert.equal(stabilityEvents,se);
 fail=false; const result=purchaseGrowth(id); assert(result.ok); assert.equal(purchaseEvents,pe+1); assert.equal(gameState.getKindlingReserve(),100-result.spent);assert(saveManager.load());assert.equal(gameState.getKindlingReserve(),100-result.spent);
 assert.equal(stabilityTracker.getProgress(),id==='thicken'?0:1);
}
console.log('PASS growth/thicken rejected writes preserve live state, bytes and success events; retry commits once');
reset();gameState.addKindling(100);assert(inventoryStore.beginRun('purchase-boundary').ok);
const inRun=snapshot();assert.deepEqual(purchaseGrowth('growth_vitality'),{ok:false,reason:'unavailable'});assert.deepEqual(snapshot(),inRun);
assert(inventoryStore.settleRun('purchase-boundary','extract',0).ok);
assert.deepEqual(purchaseGrowth('thicken'),{ok:false,reason:'pending-save'});assert.deepEqual(snapshot(),inRun);
assert(inventoryStore.markBaseSettled().ok);assert(purchaseGrowth('growth_vitality').ok);
console.log('PASS base purchases reject active and not-yet-base-settled runs without mutation');
const graphic:any = new Proxy({}, {get:()=>()=>graphic});
const image:any = new Proxy({}, {get:()=>()=>image});
for(const level of [0,1,2,4]) {
 reset(); gameState.addKindling(1000); for(let n=0;n<level;n++)assert(purchaseGrowth('growth_vitality').ok);
 const fixture=createNativeRecoveryFixture();
 const max=100+growthSystem.getModifiers().vitalityBonus;
 const combat=new CombatSystem(); combat.create({add:{graphics:()=>graphic,image:()=>image},textures:{remove(){},createCanvas:(key:string)=>({key,destroy(){}})}} as never,
  (fixture.combat as any).occluders,fixture.player,fixture.ai,{onNoise(){}},max);
 assert.equal(combat.getHealth(),max);assert.equal(combat.getMaxHealth(),max);
 combat.configureWeapon('crowbar_plain',19);combat.enableRuntimeRecovery({signature:'growth-test',runSeed:19,externalTargetIds:[]});
 const state=combat.exportRuntimeState();assert(validateCombatRuntimeState(state,max)); if(level>0)assert(!validateCombatRuntimeState(state));
 combat.restoreRuntimeState(state);assert.equal(combat.getHealth(),max);assert(!validateCombatRuntimeState({...state,health:max+1},max));
 fixture.destroy();combat.destroy();
}
console.log('PASS 0/1/2/max vitality reaches real combat health, health DTO and matching restore ceiling');
for(const affinity of [0,1,3]) for(const multiplier of [1,1.35,1.5]) for(const value of [1,2,4]) {
 reset(); assert(inventoryStore.beginRun('affinity').ok);const search=new LootSearchSystem();
 Object.assign((search as any).hud,{create(){},destroy(){},setPrompt(){},setChannel(){},setKindling(){},flashKindling(){}});
 search.create({} as never,[{id:'fuel',position:{x:0,y:0},tier:'safe',value,allowWeapon:false}],[],{overlayRoot:{} as never,getVisibilityAt:()=>1,fragmentTypeId:'test',inventoryEnabled:true,kindlingAffinity:affinity,kindlingValueModifier:multiplier,
 createVisual:()=>({x:0,y:0,setVisibility(){},setRummaging(){},playReveal(){},update(){},destroy(){}})});
 const input={playerPos:{x:0,y:0},searchHeld:true,moving:false,attacking:false,toolPressed:false,hitThisFrame:false,paused:false}; search.update(0,input);search.update(1200,input);
 assert.equal(search.getCarriedKindling(),Math.max(1,Math.floor((value+affinity)*multiplier)));
 const dto=search.exportRuntimeState();assert.equal(dto.kindlingAffinity,affinity);assert(search.validateRuntimeState(dto));
 const legacy={...dto};delete legacy.kindlingAffinity;assert.equal(search.validateRuntimeState(legacy),affinity===0);search.destroy();
}
console.log('PASS 27 native search combinations: affinity before storage multiplier, snapshot identity and old-zero compatibility');
reset();const base=gameState.getState();gameState.incrementCycle();assert(impactSystem.run([]).skipped);assert.deepEqual(gameState.getModules(),base.modules);gameState.incrementCycle();assert(!impactSystem.run([]).skipped);
for(const module of gameState.getModules())module.hp=1;
const result=impactSystem.run([]);assert.equal(result.newlyZeroModules,3);assert.equal(impactSystem.run([]).newlyZeroModules,0);
stabilityTracker.loadState({progress:10,reached:false});stabilityTracker.recordReturn({extracted:true,newlyZeroModules:3,phaseChange:null});assert.equal(stabilityTracker.getProgress(),8);
reset();for(let i=0;i<6;i++){const change=tideSystem.advanceCycle(true);stabilityTracker.recordReturn({extracted:true,newlyZeroModules:0,phaseChange:change});}assert.equal(stabilityTracker.getProgress(),14);
tideSystem.loadState({tideNumber:3,phase:'crest',cycleInPhase:0,currentIntensity:2.4});assert.equal(tideSystem.advanceCycle(false),null);const saved=tideSystem.getState();tideSystem.reset();tideSystem.loadState(saved);assert.equal(tideSystem.advanceCycle(true)?.survivedCrest,false);
tideSystem.loadState({tideNumber:5,phase:'crest',cycleInPhase:0,currentIntensity:3});for(let i=0;i<20;i++)assert.equal(tideSystem.advanceCycle(true),null);
console.log('PASS first return exempt, later impacts active, module-zero transitions, resource-free extraction, complete crest/tide rewards and saved failed-crest history');
reset();gameState.incrementCycle();gameState.incrementCycle();assert(inventoryStore.beginRun('return-once').ok);assert(inventoryStore.settleRun('return-once','extract',0).ok);saveManager.save();
function settle(){const ledger=inventoryStore.getRun();if(ledger?.status!=='settled'||ledger.baseSettled)return;saveManager.commitWorldTransaction(()=>{const impact=impactSystem.run([]);const phaseChange=tideSystem.advanceCycle(gameState.getModules().every(m=>m.hp>0)&&!impact.newlyZeroModules);stabilityTracker.recordReturn({extracted:ledger.outcome==='extract',newlyZeroModules:impact.newlyZeroModules??0,phaseChange});assert(inventoryStore.markBaseSettled().ok);});}
settle();const settled=snapshot();settle();assert.deepEqual(snapshot(),settled);assert(saveManager.load());settle();assert.deepEqual(snapshot(),settled);
console.log('PASS ledger receipt prevents duplicate return reward/impact after repeat entry and load');
