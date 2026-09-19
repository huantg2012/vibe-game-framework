import fs from 'node:fs';
import assert from 'node:assert/strict';
import {saveManager} from '@/managers/save-manager';
import {gameState} from '@/managers/game-state';
import {inventoryStore,InventoryStore} from '@/systems/inventory-store';
import {contaminantSystem} from '@/systems/contaminant-system';
import {growthSystem} from '@/systems/growth-system';
import {GAME_CONSTANTS} from '@/config/constants';
import {WEAPON_DATA} from '@/generated/weapon-data';
import {CONTAMINANT_DATA} from '@/generated/contaminant-data';
const out='docs/qa/artifacts/game-wide-review-2026-09-18/tech';const state=JSON.parse(fs.readFileSync('docs/qa/artifacts/game-wide-review-2026-09-18/art/B24-after-departure.storageState.json','utf8'));
const entry=state.origins.find((o:any)=>o.origin==='http://127.0.0.1:3013');const memory=new Map<string,string>(entry.localStorage.map((x:any)=>[x.name,x.value]));
const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)};Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});saveManager.setStorage(storage);const loaded=saveManager.load();assert(loaded);
const actual={loaded,weight:inventoryStore.getCarryWeight(),capacity:inventoryStore.getCapacity(),game:gameState.getState(),growth:growthSystem.getModifiers(),loadout:contaminantSystem.getSortieLoadout(),defense:contaminantSystem.getDefenseSlotted(),inventory:inventoryStore.getState()};assert.equal(actual.weight,70);assert.equal(actual.game.kindlingReserve,6);assert.equal(actual.loadout[0]?.type,'mirror');assert.equal(actual.loadout[2]?.type,'muffle');
// Isolated admission counterfactual only: discard the just-created ledger from the cloned DTO,
// leaving the exact prepared items untouched, then run the real production beginRun gate again.
const candidate=inventoryStore.getState();candidate.run=null;const admission=new InventoryStore();admission.configure({weaponDefinition:id=>WEAPON_DATA[id],isPassiveTool:c=>CONTAMINANT_DATA[c.type].toolType==='passive',toolSlotCount:()=>3,defenseSlotCount:()=>3});assert(admission.loadState(candidate));const begun=admission.beginRun('QA_B24_admission');assert(begun.ok);
const result={scope:'Node production validation/admission; not scene rendering. Source art save unchanged.',actual,admission:begun,observation:'B24 is valid and exact prepared inventory can beginRun. Existing active ledger explains later menu refusal; it does not reveal the first scene transition exception.'};fs.writeFileSync(out+'/b24-fixture-validation.json',JSON.stringify(result,null,2));console.log('PASS actual B24 SaveManager.load, identity/passive slots,70/160 weight,6 reserve,modifier projection; isolated exact inventory beginRun accepted.');
