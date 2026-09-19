import assert from 'node:assert/strict';
import { CATALOG_ITEMS,CATALOG_APPEARANCES,CATALOG_OFFERINGS } from '../../src/generated/contaminant-catalog-data';
import { createCatalogContaminant,getCatalogRuntimeAbility,projectItemForPlayer,projectDiscoveredCatalogItems,validateCatalogContaminant,getCatalogItemWeight } from '../../src/systems/contaminant-catalog';
import { createContaminantDropPlan,validateContaminantDropPlan } from '../../src/systems/contaminant-drop-plan';
import { InventoryStore } from '../../src/systems/inventory-store';
import { WEAPON_DATA } from '../../src/generated/weapon-data';
import { applyDefenseEffects } from '../../src/systems/defense-engine';
import type { Contaminant } from '../../src/types/game-types';
const rules={catalogVersion:'contaminant-v1',lootAlgorithmVersion:1,combatRulesVersion:2} as const;
let serial=0,checks=0;
function check(name:string,fn:()=>void){fn();checks++;console.log(`PASS ${name}`);}
function raw(definitionId='amber_beetle',offeringProfileId='resist_35'):Contaminant{return createCatalogContaminant({id:`cat-${++serial}`,definitionId,offeringProfileId,appearanceId:'wax_parcel',quality:'ordinary',acquiredOrdinal:0});}
function store(){const s=new InventoryStore();s.configure({weaponDefinition:id=>WEAPON_DATA[id],starterDefinitionId:'crowbar_plain'});assert(s.ensureStarter().ok);return s;}
function addReady(s:InventoryStore,definitionId:string,remaining?:number){const c=raw(definitionId);assert(s.addContaminant(c).ok);assert(s.slotOffering(c.id,0).ok);assert(s.finishOfferingImpact([c.id],3,{},`mature:${c.id}`).ok);const saved=s.getState();if(remaining!==undefined){const item=saved.items.find(x=>x.id===c.id)!;if(item.kind==='contaminant')item.contaminant.usesRemaining=remaining;assert(s.loadState(saved));}return c.id;}
check('48 definitions and every hidden public projection is identical under the same shell/quality/reaction',()=>{
 const values=Object.values(CATALOG_ITEMS);assert.equal(values.length,48);
 const projections=values.map(d=>{const c=raw(d.id),p=projectItemForPlayer(c);assert(validateCatalogContaminant(c));assert.equal(p.iconRef.kind,'appearance');assert.equal(getCatalogItemWeight(c),20);const {instanceId,...rest}=p;return JSON.stringify(rest);});
 assert.equal(new Set(projections).size,1);
});
check('plan is deterministic and independent from node order; tutorial never rolls another family',()=>{
 const nodes=[{id:'a',tier:'safe'},{id:'b',tier:'deep'},{id:'c',tier:'contested'}] as const;
 const p=createContaminantDropPlan({runId:'r',runSeed:1,nodes,tutorialNodeId:'b'});
 assert(validateContaminantDropPlan(p));assert.deepEqual(p,createContaminantDropPlan({runId:'r',runSeed:1,nodes:[...nodes].reverse(),tutorialNodeId:'b'}));
 assert.equal(p.entries.find(x=>x.nodeId==='b')!.contaminant.catalog!.definitionId,'amber_beetle');
 const bad=structuredClone(p);bad.entries[0]!.contaminant.catalog!.definitionId='missing';assert(!validateContaminantDropPlan(bad));
});
check('joint core conditioning changes rates correctly and never produces an empty 3-node map',()=>{
 const nodes=[{id:'a',tier:'safe'},{id:'b',tier:'safe'},{id:'c',tier:'safe'}] as const;
 const counts={core:0,weak:0,inert:0};
 for(let seed=0;seed<12000;seed++){const p=createContaminantDropPlan({runId:'r',runSeed:seed,nodes});let core=0;for(const e of p.entries){const cls=CATALOG_ITEMS[e.contaminant.catalog!.definitionId]!.class;counts[cls]++;if(cls==='core')core++;}assert(core>0);}
 const expected=.65/(1-.35**3);assert(Math.abs(counts.core/36000-expected)<.01);assert(Math.abs(counts.weak/counts.inert-2.5)<.15);
});
check('failed offering transaction, receipt replay, inert lifecycle and no equip',()=>{
 const s=store(),c=raw('double_hole_token');assert(s.addContaminant(c).ok);assert(s.slotOffering(c.id,0).ok);
 const before=s.getState();s.setPersistence(()=>{throw Error('quota');});assert(!s.finishOfferingImpact([c.id],3,{},'impact:1').ok);assert.deepEqual(s.getState(),before);
 s.setPersistence(null);assert(s.finishOfferingImpact([c.id],3,{},'impact:1').ok);
 const item=s.getItem(c.id)!;assert.equal(item.kind==='contaminant'&&item.contaminant.stage,'inert');assert.equal(item.location.kind,'stash');assert(!s.prepareTool(c.id,0).ok);assert(!s.prepareTool(c.id,2).ok);
 assert.deepEqual(s.finishOfferingImpact([c.id],3,{},'impact:1'),{ok:true,value:[]});assert.deepEqual(s.getState().discoveredCatalogIds,['double_hole_token']);
 const restored=store();assert(restored.loadState(s.getState()));
});
check('offering effects use public reaction and last impact applies before revealing',()=>{
 const a=raw('amber_beetle','resist_25'),b=raw('paper_spiral','resist_45');
 const result=applyDefenseEffects({CORE:100,STORAGE:100,PURIFIER:100},[a,b],{forecastTargetId:'CORE',actualPrimaryId:'CORE',stabilityProgress:0,moduleHps:{CORE:100,STORAGE:100,PURIFIER:100},moduleMaxHps:{CORE:100,STORAGE:100,PURIFIER:100}});
 assert.deepEqual(result.finalDamagePerModule,{CORE:41,STORAGE:41,PURIFIER:41});
 const s=store(),q=raw('amber_beetle','quickening');s.addContaminant(q);s.slotOffering(q.id,0);s.finishOfferingImpact([q.id],1,{},'i1');assert.equal(s.getContaminants()[0]!.impactCharges,2);s.finishOfferingImpact([q.id],1,{},'i2');assert.equal(s.getContaminants()[0]!.stage,'tool');
});
check('drop plan installs once, reveal cannot substitute hidden outcome, ownership and ordinal survive reload',()=>{
 const s=store();assert(s.beginRun('r',rules).ok);const plan=createContaminantDropPlan({runId:'r',runSeed:12,nodes:[{id:'n',tier:'deep'}]});assert(s.installDropPlan(plan).ok);assert(s.installDropPlan(plan).ok);
 const changed=createContaminantDropPlan({runId:'r',runSeed:13,nodes:[{id:'n',tier:'deep'}]});assert(!s.installDropPlan(changed).ok);
 const c=plan.entries[0]!.contaminant,item={kind:'contaminant' as const,id:c.id,contaminant:c};const bad=structuredClone(item);bad.contaminant.catalog!.offeringProfileId='quiet';if(bad.contaminant.catalog!.offeringProfileId===c.catalog!.offeringProfileId)bad.contaminant.catalog!.offeringProfileId='resist_25';assert(!s.revealBatch('n',[bad],{x:1,y:1}).ok);
 assert(s.revealBatch('n',[item],{x:1,y:1}).ok);const ordinal=s.getContaminants()[0]!.catalog!.acquiredOrdinal;assert.equal(ordinal,1);assert(s.revealBatch('n',[item],{x:1,y:1}).ok);assert.equal(s.getState().nextAcquiredOrdinal,2);assert(store().loadState(s.getState()));
});
check('empty claims cannot consume tutorial; discovery records never identify another instance',()=>{
 const s=store();s.beginRun('guard',rules);const p=createContaminantDropPlan({runId:'guard',runSeed:8,nodes:[{id:'n',tier:'safe'}],tutorialNodeId:'n'});s.installDropPlan(p);assert(!s.revealBatch('n',[],{x:1,y:1}).ok);assert(s.isCatalogTutorialEligible());
 const views=projectDiscoveredCatalogItems(['amber_beetle','amber_beetle','unknown']);assert.equal(views.length,1);assert.equal(views[0]!.definitionId,'amber_beetle');assert.equal(projectItemForPlayer(raw('amber_beetle')).identification,'unidentified');assert.deepEqual(projectDiscoveredCatalogItems([]),[]);
});
check('last passive use is paid once, remains weighted and survives reload; full load returned before expiration',()=>{
 const s=store(),id=addReady(s,'reverse_woven_basket',1);assert(s.prepareTool(id,2).ok);assert.equal(s.getCapacity(),240);assert(s.beginRun('p',rules).ok);assert.equal(s.getCapacity(),240);assert.equal(s.getContaminants()[0]!.usesRemaining,0);assert(!s.beginRun('p',rules).ok);assert.equal(s.getCarryWeight(),50);
 const plan=createContaminantDropPlan({runId:'p',runSeed:9,nodes:Array.from({length:9},(_,i)=>({id:`n${i}`,tier:'safe' as const}))});assert(s.installDropPlan(plan).ok);
 for(const e of plan.entries)assert(s.revealBatch(e.nodeId,[{kind:'contaminant',id:e.contaminant.id,contaminant:e.contaminant}],{x:1,y:1}).ok);
 assert.equal(s.getCarryWeight(),230);const saved=s.getState(),restored=store();assert(restored.loadState(saved));assert.equal(restored.getCapacity(),240);assert(!restored.consumeTool(id,'bad-manual').ok);
 assert(restored.settleRun('p','extract',1).ok);assert.equal(restored.getCapacity(),160);assert.equal(restored.getItem(id),undefined);assert.equal(restored.getState().run!.returnedIds!.length,9);assert.equal(restored.getItems().filter(x=>x.location.kind==='stash').length,9);assert(store().loadState(restored.getState()));
 const forged=structuredClone(saved);const bound=forged.items.find(x=>x.id===id)!;if(bound.kind==='contaminant')bound.contaminant.catalog!.runBinding!.runId='another';assert(!store().loadState(forged));
});
check('last active effect keeps its resolved identity while carrier removal and action replay are durable',()=>{
 const s=store(),id=addReady(s,'sealed_hourglass',1);assert(s.prepareTool(id,0).ok);assert(s.beginRun('active',rules).ok);const c=s.getContaminants()[0]!,resolved=getCatalogRuntimeAbility(c)!;assert.equal(resolved.durationMs,5500);
 const before=s.getState();s.setPersistence(()=>{throw Error('quota');});assert(!s.consumeTool(id,'action:1').ok);assert.deepEqual(s.getState(),before);s.setPersistence(null);
 assert.deepEqual(s.consumeTool(id,'action:1'),{ok:true,value:{broken:true,usesLeft:0}});assert.equal(s.getItem(id),undefined);assert.deepEqual(s.consumeTool(id,'action:1'),{ok:false,error:'duplicate-action'});assert.equal(resolved.durationMs,5500);assert(store().loadState(s.getState()));
});
check('whole-frame cancellation reverses catalog consumption and receipts together',()=>{
 const s=store(),id=addReady(s,'amber_beetle');s.prepareTool(id,0);s.beginRun('frame',rules);const before=s.getState();s.beginFrameTransaction();assert(s.consumeTool(id,'action').ok);s.cancelFrameTransaction();assert.deepEqual(s.getState(),before);assert(s.consumeTool(id,'action').ok);
});
check('legacy quality/defense/uses survive v2 import without new semantics',()=>{
 const s=store(),old:Contaminant={id:'old',type:'muffle',rarity:'common',quality:'good',stage:'tool',impactCharges:3,usesRemaining:4};const state=s.getState();state.version=2;state.items.push({kind:'contaminant',id:old.id,contaminant:old,location:{kind:'stash'}});assert(s.loadState(state));assert.deepEqual(s.getContaminants()[0],old);assert.equal(projectItemForPlayer(s.getContaminants()[0]!).identification,'legacy_known');assert(s.prepareTool('old',2).ok);assert(s.beginRun('legacy').ok);assert.equal(s.getContaminants()[0]!.usesRemaining,4);
});
check('tutorial is paid only on successful reveal; misses retry next world but deaths never regrant',()=>{
 const s=store();assert(s.isCatalogTutorialEligible());s.beginRun('tutorial',rules);
 const plan=createContaminantDropPlan({runId:'tutorial',runSeed:11,nodes:[{id:'teach',tier:'safe'}],tutorialNodeId:'teach'});s.installDropPlan(plan);assert(s.isCatalogTutorialEligible());
 const c=plan.entries[0]!.contaminant,item={kind:'contaminant' as const,id:c.id,contaminant:c};s.setPersistence(()=>{throw Error('quota');});assert(!s.revealBatch('teach',[item],{x:1,y:1}).ok);assert(s.isCatalogTutorialEligible());s.setPersistence(null);
 assert(s.revealBatch('teach',[item],{x:1,y:1}).ok);assert(!s.isCatalogTutorialEligible());s.settleRun('tutorial','death',0);assert(!s.isCatalogTutorialEligible());const restored=store();assert(restored.loadState(s.getState()));assert(!restored.isCatalogTutorialEligible());
 const missed=store();missed.beginRun('missed',rules);missed.settleRun('missed','death',0);assert(missed.isCatalogTutorialEligible());
 const old=store().getState();old.version=2;delete old.catalogTutorialRevealed;assert(restored.loadState(old));assert(!restored.isCatalogTutorialEligible());
});
assert.equal(Object.keys(CATALOG_APPEARANCES).length,8);assert.equal(Object.keys(CATALOG_OFFERINGS).length,5);
console.log(`Catalog: ${checks} meaningful checks passed`);
