import fs from 'node:fs';
import { gameState } from '/Users/yilungao/coh/src/managers/game-state';
import { saveManager } from '/Users/yilungao/coh/src/managers/save-manager';
import { contaminantSystem } from '/Users/yilungao/coh/src/systems/contaminant-system';
import { inventoryStore } from '/Users/yilungao/coh/src/systems/inventory-store';
import { growthSystem } from '/Users/yilungao/coh/src/systems/growth-system';
import { tideSystem } from '/Users/yilungao/coh/src/systems/tide-system';
import { stabilityTracker } from '/Users/yilungao/coh/src/systems/stability-tracker';
import { impactSystem } from '/Users/yilungao/coh/src/systems/impact-system';
import { CONTAMINANT_DATA } from '/Users/yilungao/coh/src/generated/contaminant-data';
const out='/Users/yilungao/coh/docs/qa/artifacts/iteration-27/strategies';fs.mkdirSync(out,{recursive:true});
const records=new Map<string,string>();saveManager.setStorage({getItem:k=>records.get(k)??null,setItem:(k,v)=>{records.set(k,v);},removeItem:k=>{records.delete(k);}});
for(const type of ['bare','kindle','combust'] as const){
 inventoryStore.setPersistence(null);saveManager.deleteSave();gameState.reset();contaminantSystem.reset();growthSystem.reset();tideSystem.reset();stabilityTracker.reset();impactSystem.resetForecastState();inventoryStore.ensureStarter();
 if(type!=='bare'){
  const item=contaminantSystem.createUnowned(type,CONTAMINANT_DATA[type].rarity);item.id='I27-fixture-'+type;
  const add=inventoryStore.addContaminant(item);if(!add.ok)throw Error(add.error);
  const placed=inventoryStore.slotOffering(item.id,0);if(!placed.ok)throw Error(placed.error);
  const mature=inventoryStore.finishOfferingImpact([item.id],3,{});if(!mature.ok)throw Error(mature.error);
  const equipped=inventoryStore.prepareTool(item.id,0);if(!equipped.ok)throw Error(equipped.error);
 }
 saveManager.save();fs.writeFileSync(out+'/'+type+'.storage.json',JSON.stringify(Object.fromEntries(records),null,2));
}
fs.writeFileSync(out+'/fixture-manifest.json',JSON.stringify({scope:'Isolated prepared base saves, not naturally earned loadouts; zero in-run resource injection.',methods:'Production factory, inventory offering 3 points, equip Q; default new base and starter weapon; growth level0.',cases:['bare conservative crowbar','kindle sound-lure search','combust environment suppression search']},null,2));
