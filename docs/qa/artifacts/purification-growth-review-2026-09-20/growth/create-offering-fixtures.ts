/** Controlled visual fixtures. Load a copied fresh save only into a Node-private Map.
 * Actual factories and purchase/inventory/save APIs; no natural acquisition claim.
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { GAME_CONSTANTS } from '../../../../../src/config/constants';
import { saveManager } from '../../../../../src/managers/save-manager';
import { gameState } from '../../../../../src/managers/game-state';
import { purchaseGrowth } from '../../../../../src/managers/growth-purchases';
import { inventoryStore } from '../../../../../src/systems/inventory-store';
import { createCatalogContaminant } from '../../../../../src/systems/contaminant-catalog';
const dir='docs/qa/artifacts/purification-growth-review-2026-09-20/growth';
const source='docs/qa/artifacts/purification-growth-review-2026-09-20/runtime/walk-verified/fresh.storage.json';
const initial=JSON.parse(fs.readFileSync(source,'utf8')) as Record<string,string>;
const memory=new Map(Object.entries(initial));
saveManager.setStorage({getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);},removeItem:k=>{memory.delete(k);}});
assert(saveManager.load());
assert.equal(inventoryStore.getRun(),null);
gameState.addKindling(105);
assert(purchaseGrowth('growth_defense_slot').ok);
const rows=[
 {definitionId:'amber_beetle',appearanceId:'wax_parcel',offeringProfileId:'resist_25',quality:'ordinary'},
 {definitionId:'brass_monocle',appearanceId:'resin_nodule',offeringProfileId:'resist_35',quality:'good'},
 {definitionId:'salted_vial',appearanceId:'ash_cocoon',offeringProfileId:'resist_45',quality:'fine'},
 {definitionId:'split_heel_boot',appearanceId:'layered_hide',offeringProfileId:'quickening',quality:'excellent'},
] as const;
rows.forEach((row,i)=>{
 const c=createCatalogContaminant({...row,id:`audit-offering-${i+1}`,acquiredOrdinal:i+1});
 assert(inventoryStore.addContaminant(c).ok);assert(inventoryStore.slotOffering(c.id,i).ok);
});
function output(name:string){
 assert(saveManager.trySave());
 const bytes=memory.get(GAME_CONSTANTS.SAVE.KEY)!;const save=JSON.parse(bytes);
 assert.equal(save.inventory.run,null);
 assert(save.inventory.items.filter((x:any)=>x.location.kind==='defense').every((x:any)=>x.contaminant.stage==='defense'&&x.contaminant.impactCharges===0));
 fs.writeFileSync(`${dir}/${name}.save.json`,JSON.stringify(save,null,2)+'\n');
 fs.writeFileSync(`${dir}/${name}.storage.json`,JSON.stringify({[GAME_CONSTANTS.SAVE.KEY]:bytes},null,2)+'\n');
 assert(saveManager.load());
 console.log(`${name}: validated through saveManager.load; ${inventoryStore.getOfferingItems().filter(Boolean).length}/4 occupied, unripe, no active run`);
}
output('offering-4');
assert(inventoryStore.slotOffering(null,3).ok);output('offering-3');
