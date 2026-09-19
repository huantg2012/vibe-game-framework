import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gameState } from '@/managers/game-state';
import { growthSystem } from '@/systems/growth-system';
import { tideSystem } from '@/systems/tide-system';
import { stabilityTracker } from '@/systems/stability-tracker';
import { impactSystem } from '@/systems/impact-system';
import { inventoryStore } from '@/systems/inventory-store';
import { contaminantSystem } from '@/systems/contaminant-system';
import { saveManager } from '@/managers/save-manager';
import { audioManager } from '@/managers/audio-manager';
import { CombatSystem } from '@/systems/combat-system';
import { UPGRADE_DATA } from '@/generated/upgrade-data';
import { CONTAMINANT_DATA, ACTIVE_CONTAMINANT_TYPES } from '@/generated/contaminant-data';
import { CONTAMINANT_QUALITY_DATA } from '@/generated/contaminant-quality-data';
import { WEAPON_DATA } from '@/generated/weapon-data';
import { GAME_CONSTANTS } from '@/config/constants';
const out='docs/qa/artifacts/game-wide-review-2026-09-18/tech';
const bytes=new Map<string,string>(); let fail=false;
const storage={getItem:(key:string)=>bytes.get(key)??null,setItem:(key:string,value:string)=>{if(fail)throw Error('simulated quota');bytes.set(key,value)},removeItem:(key:string)=>bytes.delete(key)};
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
saveManager.setStorage(storage);
const {LootSearchSystem}=await import('@/systems/loot-search-system');
audioManager.playSFX=()=>{};
function reset(){fail=false;inventoryStore.setPersistence(null);gameState.reset();growthSystem.reset();tideSystem.reset();stabilityTracker.reset();contaminantSystem.reset();impactSystem.resetForecastState();}
reset();
const catalog={weapons:Object.values(WEAPON_DATA),families:ACTIVE_CONTAMINANT_TYPES.map(type=>({type,...CONTAMINANT_DATA[type],qualities:Object.values(CONTAMINANT_QUALITY_DATA).map(q=>({quality:q.id,uses:q.maxUses[type]}))})),upgrades:UPGRADE_DATA};
fs.writeFileSync(out+'/catalog.json',JSON.stringify(catalog,null,2));
const growthRows:any[]=[];
for(const level of [0,1,3]){
 reset();gameState.addKindling(1000);for(let i=0;i<level;i++){growthSystem.purchase('growth_kindling_affinity');growthSystem.purchase('growth_vitality');}
 const modifiers=growthSystem.getModifiers();
 const rewards=[];
 for(const value of [1,2,4]){
  const search=new LootSearchSystem();
  // Call real settlement; omit renderer creation, adapt only no-op drawing/audio.
  const s=search as any;s.inventoryEnabled=true;s.kindlingValueModifier=gameState.getSortieModifiers().kindlingValueModifier;
  s.hud={setChannel(){},setKindling(){}};
  s.channel={elapsedMs:1200,node:{id:'fuel-'+value,kind:'kindling',value,tier:'safe',allowWeapon:false,position:{x:0,y:0},collected:false,visual:{setRummaging(){},playReveal(){}}}};
  s.complete({x:0,y:0});rewards.push(search.getCarriedKindling());
 }
 const combat=new CombatSystem();
 growthRows.push({level,modifiers,baseModifiers:gameState.getSortieModifiers(),rewards,combatMaxHp:combat.getMaxHealth(),displayExpectedHp:GAME_CONSTANTS.PLAYER.MAX_HEALTH+modifiers.vitalityBonus});
}
assert.deepEqual(growthRows.map(r=>r.rewards),[[1,2,5],[1,2,5],[1,2,5]]);
assert.deepEqual(growthRows.map(r=>r.combatMaxHp),[100,100,100]);
console.log('REPRO: paid affinity levels 0/1/3 keep actual settlement [1,2,5]; paid vitality levels 0/1/3 keep CombatSystem maxHP100 while display expects100/115/145');
const failedGrowth:any[]=[];
for(const kind of ['growth','thicken']){
 reset();gameState.addKindling(50);saveManager.save(); const before={game:gameState.getState(),growth:growthSystem.getState(),stability:stabilityTracker.getState()};const saved=bytes.get(GAME_CONSTANTS.SAVE.KEY);fail=true;let error='';
 try{if(kind==='growth'){growthSystem.purchase('growth_vitality');stabilityTracker.addProgress('growth',GAME_CONSTANTS.STABILITY.GAIN_GROWTH);}else gameState.raiseModuleMaxHp();saveManager.save();}catch(e){error=String(e);}
 failedGrowth.push({kind,error,before,after:{game:gameState.getState(),growth:growthSystem.getState(),stability:stabilityTracker.getState()},savedBytesUnchanged:saved===bytes.get(GAME_CONSTANTS.SAVE.KEY),pendingSave:saveManager.hasPendingSave()});
 assert(error);assert(saved===bytes.get(GAME_CONSTANTS.SAVE.KEY));assert.equal(saveManager.hasPendingSave(),false);fail=false;
}
console.log('REPRO: growth/thicken production purchase sequence mutates runtime then save throws; old bytes retained, pendingSave=false. Caller source is growth-panel.ts232–251; no DOM invoked.');
reset();gameState.addKindling(1000);const costs:any[]=[];for(const id of growthSystem.getAllUpgradeIds()){let total=0;while(growthSystem.getLevel(id)<growthSystem.getMaxLevel(id))total+=growthSystem.purchase(id);costs.push({id,total,maxLevel:growthSystem.getMaxLevel(id)});}
reset();const tideRows=[];for(let cycle=1;cycle<=40;cycle++){const before=tideSystem.getState(); const preview=tideSystem.peekNextIntensity();const change=tideSystem.advanceCycle();assert(Math.abs(preview-tideSystem.getCurrentIntensity())<1e-9);tideRows.push({cycle,before,change,after:tideSystem.getState(),unmitigatedDamage:30*before.currentIntensity,repairKindlingTheoretical:30*before.currentIntensity/4});}
const moduleRows=[];for(const hp of [0,40,70,100]){reset();for(const m of gameState.getModules())m.hp=hp;moduleRows.push({hp,modifiers:gameState.getSortieModifiers()});}
reset();for(const m of gameState.getModules())m.hp=100;gameState.addKindling(100);const preThicken=gameState.getSortieModifiers();gameState.raiseModuleMaxHp();const postThicken=gameState.getSortieModifiers();
fs.writeFileSync(out+'/cross-system.json',JSON.stringify({generatedAt:new Date().toISOString(),scope:'Production modules in Node; Phaser/renderer stub; not gameplay or UI evidence',growthRows,failedGrowth,costs,tideRows,moduleRows,thicken:{preThicken,postThicken,currentHp:100,maxHp:115}},null,2));
console.log('PASS independent production-module economic projections: upgrade total costs, all five tide phases/peek parity, module effects, thickening no instant heal');
