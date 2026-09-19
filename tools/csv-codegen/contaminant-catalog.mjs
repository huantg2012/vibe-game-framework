/** Versioned catalog. Strict CSV validation occurs before publishing generated code. */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
function rows(root, name) {
  const lines = readFileSync(resolve(root, 'data', name), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const header = lines.shift().split(',');
  return lines.map((line, i) => {
    const fields = line.split(',');
    if (fields.length !== header.length) throw Error(`${name}:${i+2}: unexpected CSV fields`);
    return Object.fromEntries(header.map((key, n) => [key, fields[n]]));
  });
}
function number(value, min = 0, max = Infinity, integer = false) {
  const n = Number(value);
  if (value === '' || !Number.isFinite(n) || n < min || n > max || (integer && !Number.isSafeInteger(n))) throw Error(`Invalid catalog number ${value}`);
  return n;
}
function unique(entries, key='id') {
  const map={};
  for(const entry of entries) { if(!/^[a-z][a-z0-9_-]*$/.test(entry[key]) || map[entry[key]]) throw Error(`Duplicate/invalid catalog id ${entry[key]}`); map[entry[key]]=entry; }
  return map;
}
export function generateContaminantCatalog(root, output) {
  const abilities=unique(rows(root,'contaminant-abilities.csv').map(r=>({id:r.family_id,name:r.display_role,slot:r.slot,scope:r.scope,paramKey:r.param_key,rangeSemantics:r.range_semantics,baseUses:number(r.ordinary_uses,1,99,true),targetContract:r.target_contract,stackContract:r.stack_contract})));
  for(const a of Object.values(abilities)) if(!['active','passive'].includes(a.slot)||!['timed','run','instant','snapshot'].includes(a.scope))throw Error(`Invalid ability contract ${a.id}`);
  const items=unique(rows(root,'contaminant-items.csv').map(r=>{
    const family=r.family_id||null,a=family?abilities[family]:null;
    if((r.item_class==='inert')!==(family===null)||family&&!a||!['core','weak','inert'].includes(r.item_class)||r.content_version!=='contaminant-v1'||!['true','false'].includes(r.enabled))throw Error(`Invalid item ${r.item_id}`);
    const grade=number(r.grade,0,3,true),paramValue=number(r.param_value),baseUses=number(r.ordinary_uses,0,99,true);
    if((r.item_class==='core')!==(grade>0)||a&&(r.param_key!==a.paramKey||baseUses!==a.baseUses)||!a&&(baseUses!==0||paramValue!==0))throw Error(`Invalid item parameters ${r.item_id}`);
    return {id:r.item_id,class:r.item_class,familyId:family,grade,name:r.display_name,description:r.short_effect,paramKey:r.param_key,paramValue,durationMs:number(r.duration_ms,0,300000,true),rangePx:number(r.range_px,0,4096),baseUses,weight:number(r.weight,0.1,100)*10,slot:a?.slot??null,scope:a?.scope??null,iconId:r.icon_id,enabled:r.enabled==='true',contentVersion:r.content_version};
  }));
  const ids=Object.values(items);
  for(const itemClass of ['core','weak','inert'])if(!ids.some(x=>x.class===itemClass&&x.enabled))throw Error(`Empty enabled item class ${itemClass}`);
  const names=new Set();
  for(const item of ids){if(names.has(item.name)||!item.iconId)throw Error('Duplicate name / missing icon');names.add(item.name);}
  for(const family of Object.keys(abilities)){
    const core=ids.filter(x=>x.familyId===family&&x.class==='core').sort((a,b)=>a.grade-b.grade);
    const grades=[1,2,3].map(grade=>core.find(x=>x.grade===grade&&x.enabled));
    if(grades.some(x=>!x))throw Error(`Missing enabled core grades ${family}`);
    const descending=family==='slow_zone';
    if(grades.some((x,i)=>i>0&&(descending?x.paramValue>=grades[i-1].paramValue:x.paramValue<=grades[i-1].paramValue)))throw Error(`Unordered grade power ${family}`);
    const baseline=grades[0],ability=abilities[family];
    for(const item of core) {
      const grade=grades[item.grade-1];
      if(item.paramValue!==grade.paramValue||item.weight!==baseline.weight)throw Error(`Multiple strength axes ${item.id}`);
      const durationLinked=ability.paramKey.endsWith('duration_ms');
      const rangeLinked=['travel_distance','walkable_path_distance'].includes(ability.rangeSemantics);
      if(item.durationMs!==(durationLinked?item.paramValue:baseline.durationMs)
        ||item.rangePx!==(rangeLinked?item.paramValue:baseline.rangePx))throw Error(`Multiple strength axes ${item.id}`);
    }
    for(const weak of ids.filter(x=>x.familyId===family&&x.class==='weak'))if(descending?weak.paramValue<=baseline.paramValue:weak.paramValue>=baseline.paramValue)throw Error(`Weak item is not weaker ${weak.id}`);
  }
  const offerings=unique(rows(root,'contaminant-offerings.csv').map(r=>({id:r.offering_id,name:r.display_name,effect:r.effect,amount:number(r.amount),chargeMultiplier:number(r.charge_multiplier,1,10),selectionWeight:number(r.weight,0,1000),description:r.short_effect})));
  for(const r of Object.values(offerings))if(!['impact_damage_reduction','self_charge_multiplier','none'].includes(r.effect)||(r.effect==='impact_damage_reduction'&&r.amount>=1))throw Error('Invalid offering effect');
  const appearances=unique(rows(root,'contaminant-appearances.csv').map(r=>({id:r.appearance_id,name:r.display_name,weight:number(r.weight,.1,100)*10,selectionWeight:number(r.selection_weight,0,1000),iconId:r.appearance_id,compatiblePool:r.compatible_pool})));
  if(Object.values(appearances).some(a=>a.compatiblePool!=='all_enabled'||a.weight!==20))throw Error('Appearance leaks item identity');
  const loot=unique(rows(root,'contaminant-loot-profiles.csv').map(r=>({id:r.profile_id,coreWeight:number(r.core_weight),weakWeight:number(r.weak_weight),inertWeight:number(r.inert_weight),gradeWeights:[number(r.grade_1_weight),number(r.grade_2_weight),number(r.grade_3_weight)],globalFamilyMix:number(r.global_family_mix,0,1)})));
  for(const p of Object.values(loot))if(p.coreWeight+p.weakWeight+p.inertWeight<=0||p.gradeWeights.reduce((a,b)=>a+b,0)<=0)throw Error('Empty loot distribution');
  const affinities={};for(const r of rows(root,'contaminant-source-affinities.csv')){if(!abilities[r.family_id])throw Error('Invalid affinity');const pool=affinities[r.source_tag]??=[];if(pool.some(x=>x.familyId===r.family_id))throw Error('Duplicate affinity');pool.push({familyId:r.family_id,weight:number(r.relative_weight,0,1000),publicHint:r.public_hint,sourceLabel:r.source_label});}
  for(const p of Object.values(affinities))if(p.reduce((n,x)=>n+x.weight,0)<=0)throw Error('Empty affinity pool');
  const qualities=unique(rows(root,'contaminant-qualities.csv').map(r=>({id:r.id,name:r.display_name,rank:number(r.quality_rank,1,4,true),extraUses:number(r.extra_uses,0,99,true),weight:number(r.standard_drop_weight,0,1000)})));
  const inventory=Object.fromEntries(rows(root,'inventory-rules.csv').map(r=>[r.id,number(r.value,1,10000,true)]));
  const familyType=Object.keys(abilities).map(x=>JSON.stringify(x)).join(' | ');
  const text=[`// AUTO-GENERATED from data/contaminant-*.csv. Do not edit.`,
    `export type CatalogAbilityFamily = ${familyType};`,
    `export interface CatalogAbilityDefinition { id: CatalogAbilityFamily; name:string; slot:'active'|'passive'; scope:'timed'|'run'|'instant'|'snapshot'; paramKey:string; rangeSemantics:string; baseUses:number; targetContract:string; stackContract:string }`,
    `export interface CatalogItemDefinition { id:string; class:'core'|'weak'|'inert'; familyId:CatalogAbilityFamily|null; grade:number; name:string; description:string; paramKey:string; paramValue:number; durationMs:number; rangePx:number; baseUses:number; weight:number; slot:'active'|'passive'|null; scope:'timed'|'run'|'instant'|'snapshot'|null; iconId:string; enabled:boolean; contentVersion:'contaminant-v1' }`,
    `export interface CatalogOfferingDefinition { id:string; name:string; effect:'impact_damage_reduction'|'self_charge_multiplier'|'none'; amount:number; chargeMultiplier:number; selectionWeight:number; description:string }`,
    `export interface CatalogAppearanceDefinition { id:string; name:string; weight:number; selectionWeight:number; iconId:string; compatiblePool:string }`,
    `export interface CatalogLootProfile { id:string; coreWeight:number; weakWeight:number; inertWeight:number; gradeWeights:readonly number[]; globalFamilyMix:number }`,
    `export const CATALOG_ABILITIES:Readonly<Record<CatalogAbilityFamily,CatalogAbilityDefinition>>=${JSON.stringify(abilities,null,2)};`,
    `export const CATALOG_ITEMS:Readonly<Record<string,CatalogItemDefinition>>=${JSON.stringify(items,null,2)};`,
    `export const CATALOG_OFFERINGS:Readonly<Record<string,CatalogOfferingDefinition>>=${JSON.stringify(offerings,null,2)};`,
    `export const CATALOG_APPEARANCES:Readonly<Record<string,CatalogAppearanceDefinition>>=${JSON.stringify(appearances,null,2)};`,
    `export const CATALOG_LOOT_PROFILES:Readonly<Record<string,CatalogLootProfile>>=${JSON.stringify(loot,null,2)};`,
    `export const CATALOG_SOURCE_AFFINITIES:Readonly<Record<string,readonly {familyId:CatalogAbilityFamily;weight:number;publicHint:string;sourceLabel:string}[]>>=${JSON.stringify(affinities,null,2)};`,
    `export const CATALOG_QUALITIES:Readonly<Record<string,{id:string;name:string;rank:number;extraUses:number;weight:number}>>=${JSON.stringify(qualities,null,2)};`,
    `export const INVENTORY_RULES=${JSON.stringify(inventory,null,2)} as const;`].join('\n');
  writeFileSync(resolve(output,'contaminant-catalog-data.ts'),text+'\n');
  console.log(`  contaminant-catalog-data.ts (${ids.length} items / ${Object.keys(abilities).length} abilities)`);
}
