/** Isolated expert audit. Actual game singletons run only in this Node process.
 * SaveManager uses a private in-memory backend; no browser or user save is read.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GAME_CONSTANTS as C } from '../../../../../src/config/constants';
import { UPGRADE_DATA } from '../../../../../src/generated/upgrade-data';
import { growthSystem } from '../../../../../src/systems/growth-system';
import { gameState } from '../../../../../src/managers/game-state';
import { tideSystem } from '../../../../../src/systems/tide-system';
import { stabilityTracker } from '../../../../../src/systems/stability-tracker';
import { contaminantSystem } from '../../../../../src/systems/contaminant-system';
import { inventoryStore } from '../../../../../src/systems/inventory-store';
import { createCatalogContaminant } from '../../../../../src/systems/contaminant-catalog';
import { impactSystem } from '../../../../../src/systems/impact-system';
import { saveManager } from '../../../../../src/managers/save-manager';
import { purchaseGrowth } from '../../../../../src/managers/growth-purchases';
const memory = new Map<string,string>();
saveManager.setStorage({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);},removeItem:k=>{memory.delete(k);}});
function reset(){ gameState.reset(); growthSystem.reset(); tideSystem.reset(); stabilityTracker.reset(); inventoryStore.reset(); impactSystem.resetForecastState(); memory.clear(); }
reset();
const upgrades=Object.values(UPGRADE_DATA).map(d=>({...d,cumulativeCosts:d.costs.map((_,i)=>d.costs.slice(0,i+1).reduce((s,n)=>s+n,0)),totalCost:d.costs.reduce((s,n)=>s+n,0),totalEffect:d.maxLevel*d.effectPerLevel}));
const purchases=[]; gameState.addKindling(1000);
for(const d of upgrades){for(let n=0;n<d.maxLevel;n++) assert(purchaseGrowth(d.id).ok); purchases.push({id:d.id,level:growthSystem.getLevel(d.id),maxedPurchase:purchaseGrowth(d.id)});}
const maxState={reserve:gameState.getKindlingReserve(),modifiers:growthSystem.getModifiers(),sortieSlots:contaminantSystem.getSortieSlotCount(),activeSlots:contaminantSystem.getSortieActiveSlotCount(),offeringSlots:contaminantSystem.getDefenseSlotCount(),stability:stabilityTracker.getProgress()};
assert.equal(maxState.reserve,666); assert.equal(maxState.stability,17);
reset(); gameState.addKindling(1000); for(const m of gameState.getModules()) gameState.healModule(m.id,1000);
const thickening=[{tier:0,max:gameState.getModuleMaxHp(),chaos:gameState.getStartingChaos(),modifiers:gameState.getSortieModifiers()}];
for(let n=0;n<3;n++){assert(purchaseGrowth('thicken').ok);thickening.push({tier:n+1,max:gameState.getModuleMaxHp(),chaos:gameState.getStartingChaos(),modifiers:gameState.getSortieModifiers()});}
const thickenResult={states:thickening,cost:1000-gameState.getKindlingReserve(),stability:stabilityTracker.getProgress()};
reset(); const tides=[];
for(let cycle=1;cycle<=40;cycle++){const before=tideSystem.getState();const transition=tideSystem.advanceCycle(true);tides.push({cycle,phaseBefore:before.phase,tideBefore:before.tideNumber,intensityBefore:before.currentIntensity,rawImpact:cycle===1?0:30*before.currentIntensity,offeringCharges:cycle===1?0:before.phase==='crest'?3:1,transition,after:tideSystem.getState()});}
const loot=[];
for(const storageHp of [0,70,100,145])for(let affinity=0;affinity<=3;affinity++){
 const multiplier=1+Math.min(storageHp,100)*.005;
 const tiers=[{name:'safe',value:1,count:3},{name:'contested',value:2,count:3},{name:'deep',value:4,count:2}].map(t=>({...t,yield:Math.max(1,Math.floor((t.value+affinity)*multiplier))}));
 loot.push({storageHp,affinity,multiplier,tiers,fullMapYield:tiers.reduce((s,t)=>s+t.count*t.yield,0)});
}
const forecast=[];
for(const bonus of [0,.05,.10,.15]){
 reset(); gameState.incrementCycle();gameState.incrementCycle();gameState.setImpactIntensity(2.1);
 let sequence=[.1,.1,.2]; impactSystem.generateForecast(2.1,bonus,2.1,()=>sequence.shift()??.1);
 const display=impactSystem.getForecastDisplay(); const result=impactSystem.run([],[],()=>.85);
 forecast.push({bonus,display,damages:result.damages});
}
// Real purchase with an equipped passive at the former last slot.
reset();inventoryStore.ensureStarter('test-starter');
assert(inventoryStore.addContaminant(createCatalogContaminant({id:'test-passive',definitionId:'brass_monocle',appearanceId:'wax_parcel',offeringProfileId:'resist_35',quality:'ordinary',acquiredOrdinal:1})).ok);
assert(inventoryStore.slotOffering('test-passive',0).ok);
assert(inventoryStore.finishOfferingImpact(['test-passive'],3,{},'isolated-maturity').ok);
assert(inventoryStore.prepareTool('test-passive',2).ok);
const slotsBefore=JSON.parse(JSON.stringify(inventoryStore.getEquipment()));
gameState.addKindling(40); const slotPurchase=purchaseGrowth('growth_sortie_slot');
const slotsAfter=JSON.parse(JSON.stringify(inventoryStore.getEquipment()));const departureAfter=inventoryStore.beginRun('isolated-slot-test');
assert(slotPurchase.ok);assert.deepEqual(departureAfter,{ok:false,error:'incompatible'});
const move=inventoryStore.prepareTool('test-passive',3);const repairedDeparture=inventoryStore.beginRun('isolated-slot-test');
assert(move.ok&&repairedDeparture.ok);
const sourceFiles=['data/upgrades.csv','src/generated/upgrade-data.ts','src/systems/growth-system.ts','src/managers/growth-purchases.ts','src/managers/game-state.ts','src/systems/impact-system.ts','src/systems/tide-system.ts','src/systems/inventory-store.ts','src/scenes/rift-scene.ts','src/systems/loot-search-system.ts','src/config/constants.ts'];
const hashes=Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const result={scope:'Read-only informed expert implementation/data audit; pure Node process and injected memory storage; no user save or browser',upgrades,totalPurchaseCount:upgrades.reduce((s,x)=>s+x.maxLevel,0),totalUpgradeCost:upgrades.reduce((s,x)=>s+x.totalCost,0),purchases,maxState,thickenResult,tides,loot,forecast,passiveSlotUpgrade:{slotsBefore,slotPurchase,slotsAfter,departureAfter,manualMove:move,repairedDeparture},hashes};
fs.writeFileSync('docs/qa/artifacts/purification-growth-review-2026-09-20/growth/analysis.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({totalUpgradeCost:result.totalUpgradeCost,maxState,thickenResult,loot,forecast,passiveSlotUpgrade:result.passiveSlotUpgrade},null,2));
