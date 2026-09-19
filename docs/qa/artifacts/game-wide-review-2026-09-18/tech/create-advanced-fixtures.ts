import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {saveManager} from '@/managers/save-manager';
import {gameState} from '@/managers/game-state';
import {inventoryStore} from '@/systems/inventory-store';
import {contaminantSystem} from '@/systems/contaminant-system';
import {createWeaponInstance} from '@/systems/equipment-lifecycle';
import {CONTAMINANT_DATA} from '@/generated/contaminant-data';
import {GAME_CONSTANTS} from '@/config/constants';
import type {ContaminantType} from '@/types/game-types';
const root='docs/qa/artifacts/game-wide-review-2026-09-18';const out=root+'/tech';const baseline=root+'/coordinator/fresh-base.storage.json';
const baselineBytes=fs.readFileSync(baseline,'utf8');const original=JSON.parse(baselineBytes);const key=GAME_CONSTANTS.SAVE.KEY;
const memory=new Map<string,string>(Object.entries(original));
const storage={getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>memory.set(k,v),removeItem:(k:string)=>memory.delete(k)};
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});saveManager.setStorage(storage);assert(saveManager.load());
assert.equal(inventoryStore.getRun(),null);assert.equal(gameState.getKindlingReserve(),0);
function artifact(type:ContaminantType,id:string){const result=contaminantSystem.createUnowned(type,CONTAMINANT_DATA[type].rarity,'ordinary');const item={...result,id};assert(inventoryStore.addContaminant(item).ok);return id;}
const readyMirror=artifact('mirror','QA_GW_mature_mirror');const readyMuffle=artifact('muffle','QA_GW_mature_muffle');
const weapons=[createWeaponInstance('crowbar_good_standard',false,'QA_GW_good_crowbar'),createWeaponInstance('crowbar_fine_standard',false,'QA_GW_raw_fine_crowbar')];
const state=inventoryStore.getState();state.items.push(...weapons.map(weapon=>({id:weapon.id,kind:'weapon' as const,weapon,location:{kind:'stash' as const}})));assert(inventoryStore.loadState(state));
const readyIds=[readyMirror,readyMuffle,weapons[0]!.id];readyIds.forEach((id,i)=>assert(inventoryStore.slotOffering(id,i).ok));
for(let i=0;i<3;i++)assert(inventoryStore.finishOfferingImpact([...readyIds],1).ok);
for(const id of readyIds){const item=inventoryStore.getItem(id)!;assert.equal(item.kind==='weapon'?item.weapon.stage:item.contaminant.stage,'tool');assert.equal(item.location.kind,'stash');}
const rawSolidify=artifact('solidify','QA_GW_raw_solidify');const rawIds=[rawSolidify,weapons[1]!.id];
rawIds.forEach((id,i)=>assert(inventoryStore.slotOffering(id,i).ok));assert(inventoryStore.finishOfferingImpact([...rawIds],1).ok);rawIds.forEach((_,i)=>assert(inventoryStore.slotOffering(null,i).ok));
for(const id of rawIds){const item=inventoryStore.getItem(id)!;assert.equal(item.kind==='weapon'?item.weapon.stage:item.contaminant.stage,'defense');assert.equal(item.location.kind,'stash');}
gameState.addKindling(24);gameState.applyDamage('CORE',30);gameState.applyDamage('PURIFIER',50);
function output(name:string){saveManager.save();const bytes=memory.get(key)!;const data=JSON.parse(bytes);assert.equal(data.version,2);assert.equal(data.inventory.run,null);fs.writeFileSync(out+'/'+name+'.save.json',JSON.stringify(data,null,2));fs.writeFileSync(out+'/'+name+'.storage.json',JSON.stringify({[key]:bytes},null,2));assert(saveManager.load());return{file:name+'.storage.json',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),reserve:data.kindlingReserve,itemCount:data.inventory.items.length};}
const withResources=output('advanced-24');assert(gameState.spendKindling(24));const noResources=output('advanced-0');
const manifest={purpose:'Explicit B-stage fixture, not natural growth/economy evidence',baseline,baselineSha256:crypto.createHash('sha256').update(baselineBytes).digest('hex'),files:[withResources,noResources],changes:[
'Original base starter crowbar retained at its original instance ID and equipment location; original growth/tide/cycle/stability/forecast remain unchanged.',
'Added ordinary mirror and muffle through contaminantSystem factory; assigned stable QA-only IDs for traceable fixtures.',
'Added good-standard and fine-standard weapon instances through production factory, admitted through InventoryStore.loadState; no hand-copied weapon stats.',
'Mirror, muffle, good crowbar matured by slotOffering + three actual finishOfferingImpact(1) calls, then naturally returned to stash. These calls seed lifecycle only: they do not represent played sorties, base damage, or natural rewards.',
'Raw solidify and fine crowbar each received one actual offering charge and were removed to stash, preserving partial progress. Remaining defense slots empty.',
'Raised reserve0→24 with production addKindling; CORE70→40 and PURIFIER70→20 with production applyDamage, STORAGE70 retained; maxHP100 unchanged.',
'advanced-0 differs only by production spendKindling(24); all items/states identical.',
'Final save serialized and loaded through real SaveManager; run=null so preparation/offering allowed; no active/checkpoint/departure or artificial baseSettled ledger.'
],usage:['Use .storage.json as isolated storage map; .save.json is parsed SaveDataV2 for inspection. Never load into user storage.','advanced-24: repair cost/preview, mature versus unready item identity, offering progression, compatibility and preparation.','advanced-0: same module/item contexts with insufficient repair/growth resources.','Mature gear remains stash for visible preparation; ordinary original weapon remains equipped. No immediate equipped skills are implied.'],ids:{mature:readyIds,unready:rawIds},validation:'Both snapshots accepted by production SaveManager.load; no browser validation claimed.'};
fs.writeFileSync(out+'/advanced-fixtures.manifest.json',JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest,null,2));
