/** Read-only preflight. Run with TSX_TSCONFIG_PATH=tools/contam-preview/tsconfig.json node --import tsx <this>. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.cwd(),base='docs/qa/artifacts/r100-i13/',out='docs/qa/artifacts/r100-i13-continuation/qa-preflight.json';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ref=p=>({path:path.relative(root,path.resolve(p)),sha256:sha(p)});
const {getCatalogRuntimeAbility,projectItemForPlayer}=await import(pathToFileURL(path.resolve('src/systems/contaminant-catalog.ts')).href);
const {calculateKindlingYield}=await import(pathToFileURL(path.resolve('src/systems/kindling-yield.ts')).href);
const sourceManifest=base+'frozen-source/source-snapshot.json',manifest=read(sourceManifest);
for(const [file,hash] of Object.entries(manifest.sources))assert.equal(sha(file),hash,`Production source changed: ${file}`);
function csv(file){const [head,...rows]=fs.readFileSync(file,'utf8').trim().split(/\r?\n/).map(x=>x.split(','));return rows.map(row=>Object.fromEntries(head.map((key,i)=>[key,row[i]])));}
const routes=csv('data/growth-route.csv'),grades=csv('data/rift-expedition-grades.csv');
const service={CORE:51,STORAGE:100,PURIFIER:51},capital={CORE:51,STORAGE:102,PURIFIER:51};
function debt(state,target){return Math.min(...[null,...state.modules.map(m=>m.id)].map(bonus=>state.modules.reduce((n,m)=>{const missing=Math.max(0,target[m.id]-m.hp);return n+(missing?Math.max(1,Math.ceil((missing-(bonus===m.id?state.repairBonusHp:0))/4)):0);},0)));}
const branches=[];
for(const [name,files] of [['A',['natural-maintenance/report.json','r2-natural-maintenance/report.json']],['B',['natural-prepared-recovery/report.json','r2-earned-glove/report.json']]]){
  const reports=files.map(p=>read(base+p)),attempts=reports.flatMap(r=>r.realJourneyAttempts);
  for(let i=1;i<attempts.length;i++)assert.deepEqual(attempts[i].before.state,attempts[i-1].afterPreparation.state);
  const final=attempts.at(-1),state=final.afterPreparation.state,raw=base+path.dirname(files[1])+`/i13/${final.ordinal}-after-preparation.save.json`;
  assert.equal(sha(raw),final.afterPreparation.sha256);assert.deepEqual(read(raw),state);
  const newRuns=new Set(attempts.map(r=>r.afterReturn.state.inventory.run.id));
  function source(item){return{source:item.source,acquiredInThisI13Branch:newRuns.has(item.source?.runId)};}
  function chain(item){return{acquiredOrdinal:attempts.findIndex(r=>r.afterReturn.state.inventory.run.returnedIds.includes(item.id))+1||null,
    offeredOrdinal:attempts.findIndex(r=>r.offered.includes(item.id))+1||null,
    maturedOrdinal:attempts.findIndex(r=>(r.afterReturn.state.inventory.offeringReceipts?.[`impact:${r.afterReturn.state.inventory.run.id}`]??[]).some(x=>x.itemId===item.id))+1||null,
    activeUses:attempts.reduce((n,r)=>n+Object.values(r.afterReturn.state.inventory.run.actionReceipts??{}).filter(x=>x.itemId===item.id).length,0)};}
  const publicReadyTools=state.inventory.items.filter(i=>i.kind==='contaminant'&&i.contaminant.stage==='tool'&&i.contaminant.catalog?.identification==='revealed'&&i.contaminant.usesRemaining>0).map(i=>({id:i.id,...source(i),...chain(i),public:projectItemForPlayer(i.contaminant),ability:getCatalogRuntimeAbility(i.contaminant)}));
  const unready=state.inventory.items.filter(i=>i.kind==='contaminant'&&i.contaminant.catalog?.identification==='unidentified').map(i=>({id:i.id,...source(i),public:projectItemForPlayer(i.contaminant),location:i.location}));
  const currentLevel=r=>r.unit==='thicken'?state.moduleMaxHpTier:state.growth.upgrades[r.unit],next=routes.find(r=>currentLevel(r)<Number(r.level));
  assert(!state.moduleSwapActive);assert(!state.pendingSideEffects.some(x=>x.type==='resonate'));
  const modifier=1+Math.min(100,state.modules.find(m=>m.id==='STORAGE').hp)/100*0.5;
  const publicWeapons=state.inventory.items.filter(i=>i.kind==='weapon'&&i.weapon.stage==='tool').map(i=>({id:i.id,...source(i),...chain(i),definition:i.weapon.definitionId,uses:i.weapon.usesRemaining,location:i.location}));
  branches.push({name,reports:files.map(p=>ref(base+p)),rawTerminal:ref(raw),completeRecordedTrips:attempts.length,cycle:state.cycle,reserve:state.kindlingReserve,modules:state.modules,tide:state.tide,
    fixedServiceTarget:service,fixedServiceDebt:debt(state,service),originalCapitalTarget:capital,originalCapitalDebt:debt(state,capital),
    nextGrowth:next?{...next,cost:Number(next.cost),cashGapOnly:Math.max(0,Number(next.cost)-state.kindlingReserve),excludesRequiredRepair:true}:null,
    entryKindlingStaticOnly:{affinity:state.growth.upgrades.growth_kindling_affinity,modifier,baseValue:1,yield:calculateKindlingYield(1,state.growth.upgrades.growth_kindling_affinity,modifier),notActualFutureIncome:true},
    publicReadyTools,unidentifiedItemsWithNoHiddenIdentity:unready,publicWeapons,
    eligibleBTools:publicReadyTools.filter(i=>(i.ability.familyId==='survey'&&i.ability.rangePx>=128)||(i.ability.familyId==='dash'&&i.ability.rangePx>=48)).map(i=>({id:i.id,family:i.ability.familyId,uses:i.public.usesRemaining,fresh:i.acquiredInThisI13Branch,range:i.ability.rangePx})),
    eligibleATools:publicReadyTools.filter(i=>(i.ability.familyId==='suppress'&&i.ability.durationMs>=3000)||(i.ability.familyId==='solidify'&&i.ability.durationMs>=2500)).map(i=>({id:i.id,family:i.ability.familyId,uses:i.public.usesRemaining,fresh:i.acquiredInThisI13Branch,duration:i.ability.durationMs}))});
}
assert(!fs.existsSync(out),'Never overwrite evidence');
const result={recordedDate:'2026-10-08',status:'read-only-public-inventory-and-source-preflight',tool:ref(fileURLToPath(import.meta.url)),sources:[sourceManifest,'src/systems/contaminant-catalog.ts','src/systems/kindling-yield.ts','src/generation/world-study/r100-expedition.ts','src/systems/impact-system.ts','data/rift-expedition-grades.csv','data/growth-route.csv'].map(ref),unchangedProductionFiles:Object.keys(manifest.sources).length,
  staticEntryBudget:grades.map(r=>({grade:r.grade_id,kindlingSafeCount:Number(r.kindling_safe_count),kindlingSafeBase:Number(r.kindling_safe_value),contaminantSafeCount:Number(r.contaminant_safe_count)})),
  initialGrowthThresholds:routes.slice(0,2).map(r=>({order:Number(r.order),unit:r.unit,cost:Number(r.cost)})),branches,
  limitations:['Static identical entry budgets do not prove that the same visible-route policy reaches the same kinds of objects or prevents farming.',
    'Safe is deployment route-relative, not a fixed entry radius; physical real-input round trips are required.',
    'One return applies its normal tide impact and offering maturity regardless of short field time; prior inventory maturation is not newly acquired supply.',
    'Public-ready ownership and stock suffice for a bounded test precondition, not useful ability or economic recovery acceptance.',
    'A and B are separate continuations; moving fresh A tools to B or calling A a recovery of B would fabricate evidence.']};
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:ref(out),sourcesMatched:result.unchangedProductionFiles,branches:branches.map(b=>({name:b.name,reserve:b.reserve,serviceDebt:b.fixedServiceDebt,capitalDebt:b.originalCapitalDebt,nextGrowth:b.nextGrowth,eligibleBTools:b.eligibleBTools,eligibleATools:b.eligibleATools}))}));
