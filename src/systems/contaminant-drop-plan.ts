/** Fixed, pure per-world plan. No acquisition or offering operation rolls again. */
import { CATALOG_ABILITIES,CATALOG_APPEARANCES,CATALOG_ITEMS,CATALOG_OFFERINGS,CATALOG_QUALITIES,CATALOG_LOOT_PROFILES,CATALOG_SOURCE_AFFINITIES } from '@/generated/contaminant-catalog-data';
import { mix32 } from '@/generation/seed-fork';
import { createCatalogContaminant,validateCatalogContaminant,CURRENT_CATALOG_VERSION } from './contaminant-catalog';
import type { Contaminant,ContaminantQuality } from '@/types/game-types';
export interface CatalogDropNode { readonly id:string;readonly tier:'safe'|'contested'|'deep';readonly sourceTag?:string }
export interface CatalogPlannedDrop {readonly nodeId:string;readonly sourceTag:string;readonly tier:CatalogDropNode['tier'];readonly contaminant:Contaminant}
export interface CatalogSourceRegion {readonly sourceTag:string;readonly hint:string}
export interface ContaminantDropPlan {readonly sourceRegions?:Readonly<Record<string,CatalogSourceRegion>>;readonly version:1;readonly catalogVersion:typeof CURRENT_CATALOG_VERSION;readonly lootAlgorithmVersion:1;readonly runId:string;readonly runSeed:number;readonly tutorialNodeId?:string;readonly entries:readonly CatalogPlannedDrop[]}
function weighted<T>(entries:readonly T[],weight:(value:T)=>number,sample:number):T {
  const total=entries.reduce((n,x)=>n+weight(x),0);if(!entries.length||total<=0)throw Error('Empty catalog pool');
  let remaining=sample*total;
  for(const entry of entries){remaining-=weight(entry);if(remaining<0)return entry;}
  return entries[entries.length-1]!;
}
export function createContaminantDropPlan(input:{runId:string;runSeed:number;nodes:readonly CatalogDropNode[];tutorialNodeId?:string;sourceRegions?:Readonly<Record<string,CatalogSourceRegion>>}):ContaminantDropPlan {
  if(!input.runId||!Number.isSafeInteger(input.runSeed)||input.runSeed<0||input.runSeed>0xffffffff)throw Error('Invalid drop plan identity');
  const ids=new Set<string>();
  for(const node of input.nodes){if(!node.id||ids.has(node.id)||!CATALOG_LOOT_PROFILES[node.tier]||!CATALOG_SOURCE_AFFINITIES[node.sourceTag??'unbiased'])throw Error('Invalid catalog node');ids.add(node.id);}
  if(input.tutorialNodeId&&!ids.has(input.tutorialNodeId))throw Error('Tutorial node missing');
  const sample=(id:string,part:string)=>(mix32(input.runSeed,`catalog:${id}:${part}`)>>>0)/4294967296;
  const order=[...input.nodes].sort((a,b)=>sample(a.id,'order')-sample(b.id,'order')||a.id.localeCompare(b.id));
  const forcedTutorial=!!input.tutorialNodeId;
  let coreSeen=forcedTutorial; // A fixed core already satisfies the joint event.
  const entries:CatalogPlannedDrop[]=[];
  for(let n=0;n<order.length;n++){
    const node=order[n]!,profile=CATALOG_LOOT_PROFILES[node.tier]!;
    const total=profile.coreWeight+profile.weakWeight+profile.inertWeight,p=profile.coreWeight/total;
    let probability=p;
    if(!coreSeen&&order.length>=3){
      const noCore=order.slice(n).reduce((q,next)=>{const r=CATALOG_LOOT_PROFILES[next.tier]!;return q*(1-r.coreWeight/(r.coreWeight+r.weakWeight+r.inertWeight));},1);
      if(noCore===1)throw Error('Core guarantee has no support');probability=p/(1-noCore);
    }
    const tutorial=node.id===input.tutorialNodeId;
    const core=tutorial||sample(node.id,'class')<probability;
    if(core)coreSeen=true;
    const cls=core?'core':sample(node.id,'noncore')<profile.weakWeight/(profile.weakWeight+profile.inertWeight)?'weak':'inert';
    const sourceTag=node.sourceTag??'unbiased';
    let candidates=Object.values(CATALOG_ITEMS).filter(d=>d.enabled&&d.class===cls);
    if(core){
      const global=Object.keys(CATALOG_ABILITIES),affinity=CATALOG_SOURCE_AFFINITIES[sourceTag]!;
      const family=sample(node.id,'mixture')<profile.globalFamilyMix?global[Math.floor(sample(node.id,'family')*global.length)]!:weighted(affinity,x=>x.weight,sample(node.id,'family')).familyId;
      const grade=tutorial?1:weighted([1,2,3],g=>profile.gradeWeights[g-1]!,sample(node.id,'grade'));
      candidates=candidates.filter(d=>d.familyId===family&&d.grade===grade);
    }
    const definition=tutorial?CATALOG_ITEMS.amber_beetle!:weighted(candidates,()=>1,sample(node.id,'definition'));
    const quality=(tutorial?'ordinary':weighted(Object.values(CATALOG_QUALITIES),q=>q.weight,sample(node.id,'quality')).id) as ContaminantQuality;
    const offering=tutorial?CATALOG_OFFERINGS.resist_35!:weighted(Object.values(CATALOG_OFFERINGS),q=>q.selectionWeight,sample(node.id,'offering'));
    const appearance=weighted(Object.values(CATALOG_APPEARANCES),q=>q.selectionWeight,sample(node.id,'appearance'));
    const contaminant=createCatalogContaminant({id:`CAT_${input.runId}_${node.id}`,definitionId:definition.id,quality,appearanceId:appearance.id,offeringProfileId:offering.id,acquiredOrdinal:0});
    entries.push({nodeId:node.id,tier:node.tier,sourceTag,contaminant});
  }
  entries.sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
  return {...(input.sourceRegions?{sourceRegions:structuredClone(input.sourceRegions)}:{}),version:1,catalogVersion:CURRENT_CATALOG_VERSION,lootAlgorithmVersion:1,runId:input.runId,runSeed:input.runSeed,...(input.tutorialNodeId?{tutorialNodeId:input.tutorialNodeId}:{}),entries};
}
export function validateContaminantDropPlan(value:unknown):value is ContaminantDropPlan {
  if(!value||typeof value!=='object')return false;
  const p=value as ContaminantDropPlan;
  if(p.version!==1||p.catalogVersion!==CURRENT_CATALOG_VERSION||p.lootAlgorithmVersion!==1||typeof p.runId!=='string'||!p.runId||!Number.isSafeInteger(p.runSeed)||p.runSeed<0||p.runSeed>0xffffffff||!Array.isArray(p.entries)||p.entries.length>4096)return false;
  if(p.tutorialNodeId!==undefined){const tutorial=p.entries.find(e=>e?.nodeId===p.tutorialNodeId)?.contaminant;if(typeof p.tutorialNodeId!=='string'||!tutorial||tutorial.catalog?.definitionId!=='amber_beetle'||tutorial.catalog.offeringProfileId!=='resist_35'||tutorial.quality!=='ordinary')return false;}
  if (p.sourceRegions && (typeof p.sourceRegions !== 'object' || Array.isArray(p.sourceRegions)
    || Object.entries(p.sourceRegions).some(([id,region]) => !id || !region || typeof region.hint !== 'string'
      || !CATALOG_SOURCE_AFFINITIES[region.sourceTag]))) return false;
  if (p.sourceRegions && p.entries.some(entry => p.sourceRegions![entry.nodeId]?.sourceTag !== entry.sourceTag)) return false;
  const ids=new Set<string>(),items=new Set<string>();
  return p.entries.every(e=>{if(!e||typeof e.nodeId!=='string'||!e.nodeId||ids.has(e.nodeId)||!CATALOG_LOOT_PROFILES[e.tier]||!CATALOG_SOURCE_AFFINITIES[e.sourceTag]||!e.contaminant||e.contaminant.type!=='catalog'||!validateCatalogContaminant(e.contaminant)||e.contaminant.catalog?.acquiredOrdinal!==0||e.contaminant.stage!=='defense'||e.contaminant.impactCharges!==0||e.contaminant.usesRemaining!==0||items.has(e.contaminant.id)||e.contaminant.id!==`CAT_${p.runId}_${e.nodeId}`)return false;ids.add(e.nodeId);items.add(e.contaminant.id);return true;});
}
