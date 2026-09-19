/** I27: current catalog use -> final charge -> JSON continuation, no replayed costs or targets. */
import assert from 'node:assert/strict';
import Phaser from 'phaser';
Object.assign(Phaser.Math, { Clamp: (value:number,min:number,max:number) => Math.max(min,Math.min(max,value)) });
import { ToolSystem, validateToolRuntimeState } from '../../src/systems/tool-system';
import { EnemyControlState } from '../../src/systems/enemy-control-state';
import { EnvironmentHazardControl } from '../../src/systems/environment-hazard-control';
import { inventoryStore } from '../../src/systems/inventory-store';
import { contaminantSystem } from '../../src/systems/contaminant-system';
import { CONTAMINANT_DATA, ACTIVE_CONTAMINANT_TYPES } from '../../src/generated/contaminant-data';
import { AIState, type ContaminantType } from '../../src/types/game-types';
import { eventBus } from '../../src/core/event-bus';
import { GameEvent } from '../../src/types/events';
import { validateBodyEchoRuntimeState } from '../../src/systems/tool-body-echo';
const controls=(c:EnemyControlState)=>({movement:c.movementMultiplier,perception:c.perceptionMultiplier,attack:c.attackSuppressed,revision:c.attackInterruptRevision,sources:[...(c as any).sources]});
function fixture(type:ContaminantType,uses=1) {
 inventoryStore.setPersistence(null);contaminantSystem.reset();
 const item=contaminantSystem.createUnowned(type,CONTAMINANT_DATA[type].rarity);item.stage='tool';item.usesRemaining=uses;
 assert(inventoryStore.addContaminant(item).ok);const slot=CONTAMINANT_DATA[type].toolType==='passive'?2:0;
 assert(inventoryStore.prepareTool(item.id,slot).ok);assert(inventoryStore.beginRun('current-tools-'+type).ok);
 let visible=true,writes=0,input=true,moves=0,reverse=0,sounds=0,hostUses=0;let fill=1;
 const position={x:type==='mirror'?500:24,y:0},origin={x:0,y:0};
 const control=new EnemyControlState(),environment=new EnvironmentHazardControl(),decoys=new Map();
 const reveals:unknown[]=[];
 const enemy={getId:()=> 'enemy',getRole:()=> 'infiltrator',getPosition:()=>position,getState:()=>AIState.CHASE,isTargetingLure:()=>false,isTargetingDecoy:()=>false};
 const graphic:any=new Proxy({},{get:()=>()=>graphic});const tools=new ToolSystem();
 tools.create({add:{graphics:()=>graphic},time:{now:0}} as never,contaminantSystem.getSortieLoadout(),()=>origin,()=>[enemy] as never,{
  isTargetAlive:()=>true,isTargetVisible:()=>visible,hasTargetLineOfSight:()=>true,
  setEnemyControl:(_id,source,effect)=>control.set(source,effect),clearEnemyControl:(_id,source)=>control.clear(source),hasEnemyControl:(_id,source)=>control.has(source),
  getPhaseDestination:()=>({x:96,y:0}),movePlayerTo:p=>{Object.assign(origin,p);moves++;},setPlayerInput:v=>{input=v;},
  setVisualDecoy:(source,p)=>{if(p)decoys.set(source,{...p});else decoys.delete(source);},reverseEnemyPatrol:()=>{reverse++;},
  getSoundLureDestination:()=>({x:96,y:0}),reportSoundLure:()=>{sounds++;},setHearingSuppressed(){},setEnemyDetectionFillRateMult:(_id,mult)=>{fill=mult;},
  getStitchPlacement:()=>({pointA:{x:32,y:-32},pointB:{x:32,y:32}}),
  getEnvironmentTargets:()=>[{id:'host',position:{x:20,y:0},hazardReleased:false,canDelayNextHazard:true,canSuppressHazard:true,delayRemainingMs:environment.delayRemainingMs,suppressionRemainingMs:environment.suppressionRemainingMs}] as never,
  delayEnvironmentHazard:(_id,source,ms)=>{hostUses++;environment.delay(source,ms);return true;},
  suppressEnvironmentHazard:(_id,source,ms)=>{hostUses++;environment.suppress(source,ms);return true;},clearEnvironmentControl:(_id,source)=>environment.clear(source),
  getRevealSnapshot:()=>({enemyPositions:[position],nodePositions:[{x:48,y:0}],corePositions:[{x:20,y:0}]}),
  showAbyssReveal:(enemies,nodes,ms,cores)=>reveals.push({enemies,nodes,ms,cores}),
 });
 inventoryStore.setPersistence(()=>{writes++;});
 function activate(){if(type==='scatter')tools.notifyEnemySuspicious('enemy');else if(type==='muffle')assert(tools.notifyProximityAvoid());else if(type==='siphon')eventBus.emit(GameEvent.PLAYER_DAMAGED,{amount:3,source:'test'});else if(type==='retrograde'){eventBus.emit(GameEvent.ENEMY_ALERT,{enemyId:'enemy',alertLevel:'chase'});visible=false;tools.update(16);}else assert(tools.useSlot(slot));}
 return {tools,item,activate,control,environment,position,origin,decoys,reveals,counts:()=>({writes,moves,reverse,sounds,hostUses}),get input(){return input;},get fill(){return fill;}};
}
for(const type of ACTIVE_CONTAMINANT_TYPES){
 const f=fixture(type);f.activate();if(type==='stitch')f.position.x=48;f.tools.update(16);
 assert.equal(f.counts().writes,1,type+' charges once');assert.equal(inventoryStore.getItem(f.item.id),undefined,type+' final equipment is gone');
 const json=JSON.parse(JSON.stringify(f.tools.exportRuntimeState()));assert(validateToolRuntimeState(json),type);
 const beforeCounts=f.counts(),beforeControl=controls(f.control),beforeEnvironment=f.environment.exportRuntimeState();
 f.control.beginRuntimeRestore();f.tools.restoreRuntimeState(json);f.control.restoreInterruptRevision(beforeControl.revision);assert.deepEqual(f.tools.exportRuntimeState(),json,type+' restores clocks and effect identities');
 assert.deepEqual(f.counts(),beforeCounts,type+' no replayed payments, moves, reverse, sounds or host use');
 assert.deepEqual(controls(f.control),beforeControl,type+' same AI sources');assert.deepEqual(f.environment.exportRuntimeState(),beforeEnvironment,type+' same Host timers');
 if(type==='expand'){assert(!f.input);f.tools.update(1000);assert(f.input);}
 if(type==='scatter')assert.equal(f.fill,CONTAMINANT_DATA.scatter.toolDetectionFillMult);
 f.tools.destroy();console.log('PASS '+type+' final-charge continuation');
}
{
 const f=fixture('solidify');f.activate();f.control.breakOnDamage();const saved=f.tools.exportRuntimeState();assert.equal(saved.extended!.freezes[0]!.controlActive,false);f.tools.restoreRuntimeState(saved);assert.equal(f.control.attackSuppressed,false,'broken freeze cannot regenerate on restore');f.tools.destroy();
}
{
 const f=fixture('muffle',2),saved=f.tools.exportRuntimeState();const legacy={...saved};delete legacy.extended;assert(f.tools.validateRuntimeState(legacy));f.tools.restoreRuntimeState(legacy);assert.equal(f.tools.exportRuntimeState().muffle.triggersRemaining,2);f.tools.destroy();
}
{
 const f=fixture('mirror');f.activate();f.position.x=0;f.tools.update(CONTAMINANT_DATA.mirror.toolDurationMs+16);
 const saved=f.tools.exportRuntimeState();assert(saved.extended!.mirrors[0]!.shattering);assert(saved.extended!.mirrors[0]!.remainingMs<0);
 f.tools.restoreRuntimeState(saved);assert.deepEqual(f.tools.exportRuntimeState(),saved);f.tools.update(100);f.tools.update(100);assert.equal(f.tools.exportRuntimeState().extended!.mirrors.length,0);f.tools.destroy();
}
{
 const f=fixture('expand');f.activate();assert(!f.input);const saved=f.tools.exportRuntimeState();const prior={...saved,extended:undefined};
 f.tools.restoreRuntimeState(prior);assert(f.input,'replacing an expand state with an earlier empty state releases its input lock');f.tools.destroy();
}
const pose={mode:'memory',width:1,height:1,originX:.5,originY:1,scaleX:1,scaleY:1,rgba:btoa(String.fromCharCode(10,20,30,255))};
assert(validateBodyEchoRuntimeState(pose));assert(!validateBodyEchoRuntimeState({...pose,rgba:'invalid'}));assert(!validateBodyEchoRuntimeState({...pose,width:513}));
console.log('PASS broken-freeze boundary, legacy five-tool snapshot, bounded immutable pose serialization');
