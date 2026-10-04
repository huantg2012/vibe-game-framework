/** Read-only accounting counterfactuals over frozen, completed actual-input receipts.
 * Does not replay movement, change saves or grant equipment. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { GAME_CONSTANTS as C } from '../../src/config/constants';
import { calculateKindlingYield } from '../../src/systems/kindling-yield';
import { applyDefenseEffects } from '../../src/systems/defense-engine';
import { getContaminantOffering, getContaminantLifecycleRules } from '../../src/systems/contaminant-catalog';
import type { Contaminant } from '../../src/types/game-types';

const folder = 'docs/qa/artifacts/r100-i06/economy-policy-analysis';
mkdirSync(folder, { recursive: true });
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const subset = (s: any) => Object.fromEntries(['cycle','kindlingReserve','repairBonusHp','modules','tide','inventory','growth','impactForecast'].map(k=>[k,s[k]]));
const inputPath = `${folder}/inputs.json`;
if (process.argv.includes('--freeze')) {
 const inputs = [
  ...['conservative','gradual','repeat-risk'].map(policy=>({policy,path:`docs/qa/artifacts/r100-i06/natural/${policy}/report.json`})),
  {policy:'contaminant-first-control',path:'docs/qa/artifacts/r100-i06/natural-defense-baseline/report.json'},
 ].map(({policy,path})=>{
  const bytes=readFileSync(path,'utf8'),report=JSON.parse(bytes);
  return {policy,source:path,sourceSha256:sha(bytes),harnessSha256:report.harnessSha256,
   offeringPreference:report.offeringPreference,runs:report.realJourneyAttempts.filter((r:any)=>r.status==='completed-real-input').map((r:any)=>({
    ordinal:r.ordinal,grade:r.grade,outcome:r.outcome,before:subset(r.before.state),returned:subset(r.afterReturn.state),
    repaired:subset((r.afterRepair??r.afterReturn).state),prepared:subset((r.afterPreparation??r.afterRepair??r.afterReturn).state),
    conditions:r.entrySave.state.riftCheckpoint.state.conditions,nodes:r.fieldResult.nodes,searches:r.searches,
    returnedIds:r.afterReturn.state.inventory.run.returnedIds,equipmentChanges:r.equipmentChanges,
   }))};
 });
 writeFileSync(inputPath,JSON.stringify({capturedAt:new Date().toISOString(),scope:'Completed actual-input receipts only; frozen partial cohorts, not newly played runs.',inputs},null,2)+'\n');
}
const frozen=JSON.parse(readFileSync(inputPath,'utf8'));
type Hp=Record<string,number>;
function baseDamage(run:any):Hp {
 const mods=run.before.modules,primary=run.before.impactForecast.actualPrimaryId;
 const result:Hp=Object.fromEntries(mods.map((m:any)=>[m.id,0]));
 if(run.conditions.cycle<=1)return result;
 assert(primary&&Object.hasOwn(result,primary),'actual recorded impact target required');
 const total=C.PURIFICATION.BASE_IMPACT_DAMAGE*run.before.tide.currentIntensity;
 result[primary]=Math.round(total*C.PURIFICATION.THREAT_FOCUS_RATIO);
 const others=mods.filter((m:any)=>m.id!==primary),rest=Math.round(total)-result[primary]!;
 let spent=0;others.forEach((m:any,i:number)=>{const amount=i===others.length-1?rest-spent:Math.round(rest/others.length);result[m.id]=amount;spent+=amount;});
 return result;
}
function reduceDamage(run:any,hp:Hp,offered:Contaminant|null):Hp {
 const base=baseDamage(run);if(!offered)return base;
 return applyDefenseEffects(base,[offered],{forecastTargetId:run.before.impactForecast.targetId,
  actualPrimaryId:run.before.impactForecast.actualPrimaryId,stabilityProgress:0,moduleHps:hp,
  moduleMaxHps:Object.fromEntries(run.before.modules.map((m:any)=>[m.id,m.maxHp]))},[offered.id]).finalDamagePerModule;
}
function collected(run:any,modifier:number):number {
 if(run.outcome!=='extract')return 0;
 return run.nodes.filter((n:any)=>n.kind==='kindling'&&n.collected).reduce((sum:number,n:any)=>sum+calculateKindlingYield(n.value,run.conditions.kindlingAffinity,modifier),0);
}
const audit=[];
for(const cohort of frozen.inputs)for(const run of cohort.runs){
 const hp:Hp=Object.fromEntries(run.before.modules.map((m:any)=>[m.id,m.hp]));
 const offeredId=run.before.inventory.equipment.defenseIds[0];
 const item=run.before.inventory.items.find((i:any)=>i.id===offeredId);
 assert(!item||item.kind==='weapon'||item.contaminant.type==='catalog','diagnostic currently supports actual catalog offerings');
 const damage=reduceDamage(run,hp,item?.kind==='contaminant'?item.contaminant:null);
 for(const m of run.returned.modules)assert.equal(m.hp,Math.max(0,hp[m.id]!-damage[m.id]!),`${cohort.policy}/${run.ordinal} actual impact reproduction`);
 assert.equal(collected(run,run.conditions.modifiers.kindlingValueModifier),run.returned.inventory.run.kindlingGained);
 assert.equal(run.returned.kindlingReserve,run.before.kindlingReserve+run.returned.inventory.run.kindlingGained);
 const paid=run.returned.kindlingReserve-run.repaired.kindlingReserve;
 assert.equal(run.repaired.modules.reduce((n:number,m:any)=>n+m.hp,0)-run.returned.modules.reduce((n:number,m:any)=>n+m.hp,0),paid*4);
 audit.push({policy:cohort.policy,ordinal:run.ordinal,income:run.returned.inventory.run.kindlingGained,paid,
  netDamage:Object.values(damage).reduce((a,b)=>a+b,0),actualHpLoss:run.before.modules.reduce((n:number,m:any)=>n+m.hp,0)-run.returned.modules.reduce((n:number,m:any)=>n+m.hp,0)});
}

const policies=['all70','storage100-all70','storage100-core60-purifier70','staged-storage100'] as const;
function simulate(cohort:any,policy:typeof policies[number],offeringSelection:'first-contaminant'|'highest-public-reduction'){
 const first=cohort.runs[0];if(!first)return null;
 const hp:Hp=Object.fromEntries(first.before.modules.map((m:any)=>[m.id,m.hp]));
 const caps:Hp=Object.fromEntries(first.before.modules.map((m:any)=>[m.id,m.maxHp]));
 const types:Record<string,string>=Object.fromEntries(first.before.modules.map((m:any)=>[m.id,m.type]));
 let reserve=first.before.kindlingReserve,offered:Contaminant|null=null;
 const inventory=new Map<string,Contaminant>();
 for(const i of first.before.inventory.items)if(i.kind==='contaminant')inventory.set(i.id,structuredClone(i.contaminant));
 const rows:any[]=[];
 const repair=(id:string,target:number,spends:any[])=>{
  const requested=Math.max(0,Math.ceil((target-hp[id]!)/4));
  const used=Math.min(requested,reserve,Math.max(0,Math.ceil((caps[id]!-hp[id]!)/4)));
  const before=hp[id]!;reserve-=used;hp[id]=Math.min(caps[id]!,before+used*4);
  if(used)spends.push({id,used,before,after:hp[id],target});
 };
 for(const run of cohort.runs){
  assert.equal(run.conditions.kindlingAffinity,0,'no free growth affinity in this model');
  const startHp={...hp},reserveBefore=reserve;
  const storage=Object.keys(hp).find(id=>types[id]==='STORAGE')!,core=Object.keys(hp).find(id=>types[id]==='CORE')!,purifier=Object.keys(hp).find(id=>types[id]==='PURIFIER')!;
  const multiplier=1+Math.min(100,hp[storage]!)/100*C.PURIFICATION.MAX_STORAGE_BONUS;
  const income=collected(run,multiplier);reserve+=income;
  const offeredBefore=offered?{id:offered.id,reduction:getContaminantOffering(offered).reduction,charges:offered.impactCharges}:null;
  const damage=reduceDamage(run,hp,offered);
  for(const id of Object.keys(hp))hp[id]=Math.max(0,hp[id]!-damage[id]!);
  const postImpact={...hp},matured:string[]=[];
  if(offered&&run.conditions.cycle>1){
   const rule=getContaminantLifecycleRules(offered);
   offered.impactCharges+=(run.before.tide.phase==='crest'?C.TIDE.CREST_CHARGE_COST:C.TIDE.NORMAL_CHARGE_COST)*rule.chargeMultiplier;
   if(offered.impactCharges>=rule.offeringCharges){offered.stage='tool';offered.usesRemaining=rule.maxUses;matured.push(offered.id);offered=null;}
  }
  // Only objects actually returned in this recorded trip are added, after this
  // impact. They cannot provide defense retroactively or be manufactured free.
  for(const id of run.returnedIds){
   const i=run.returned.inventory.items.find((item:any)=>item.id===id);
   if(i?.kind==='contaminant'&&!inventory.has(id)){
    assert.equal(i.contaminant.type,'catalog');assert.equal(i.contaminant.stage,'defense');
    inventory.set(id,structuredClone(i.contaminant));
   }
  }
  if(!offered){
   const candidates=[...inventory.values()].filter(c=>c.stage==='defense');
   if(offeringSelection==='highest-public-reduction')candidates.sort((a,b)=>getContaminantOffering(b).reduction-getContaminantOffering(a).reduction);
   offered=candidates[0]??null;
  }
  const spends:any[]=[];
  if(policy==='all70'){
   for(const id of Object.keys(hp).sort((a,b)=>hp[a]!-hp[b]!))repair(id,70,spends);
  }else{
   // No future target/tide/loot information influences these repairs.
   for(const id of Object.keys(hp).sort((a,b)=>hp[a]!-hp[b]!))repair(id,40,spends);
   if(policy==='staged-storage100'){
    repair(purifier,60,spends);repair(core,50,spends);repair(storage,50,spends);
    // The +1 contested/+1 deep yield step exists at exactly 100 HP. Do not
    // spend an insufficient investment toward 99 while leaving other bills.
    const thresholdCost=Math.ceil((100-hp[storage]!)/4);
    if(reserve>=thresholdCost)repair(storage,100,spends);
    repair(purifier,70,spends);repair(core,60,spends);
   }else{
    repair(storage,100,spends);repair(purifier,70,spends);repair(core,policy==='storage100-all70'?70:60,spends);
   }
  }
  rows.push({ordinal:run.ordinal,grade:run.grade,outcome:run.outcome,startHp,reserveBefore,income,multiplier,
   baseDamage:baseDamage(run),offeredBefore,damage,postImpact,spends,matured,offeredAfter:offered?.id??null,
   endHp:{...hp},reserveAfter:reserve,storageAt100:hp[storage]===100,
   startingChaosNext:Math.round(50*(1-Math.min(1,hp[purifier]!/100))),chaosMultiplierNext:1-Math.min(1,hp[core]!/100)*.3,
   zeroAfterImpact:Object.values(postImpact).some(h=>h===0)});
 }
 return{policy,offeringSelection,rows,summary:{income:rows.reduce((s,r)=>s+r.income,0),repairs:rows.reduce((s,r)=>s+r.spends.reduce((v:number,x:any)=>v+x.used,0),0),
  initialHp:Object.fromEntries(first.before.modules.map((m:any)=>[m.id,m.hp])),endHp:hp,endReserve:reserve,
  fullStorageDepartures:rows.filter(r=>r.multiplier===1.5).length,zeroImpactCount:rows.filter(r=>r.zeroAfterImpact).length,
  firstZeroOrdinal:rows.find(r=>r.zeroAfterImpact)?.ordinal??null,matured:rows.flatMap(r=>r.matured).length}};
}

const matrices=frozen.inputs.map((cohort:any)=>({cohort:cohort.policy,count:cohort.runs.length,
 models:policies.flatMap(policy=>['first-contaminant','highest-public-reduction'].map(selection=>simulate(cohort,policy,selection as any)))}));
// Conditional operating bills after the 60/100/70 regime has been established.
// Unlimited funds here calculate a requirement; they are never credited to the
// feasible replay above. Each module retains its actual 1–3 HP rounding residue.
const maintenance=frozen.inputs.map((cohort:any,index:number)=>{
 const model=matrices[index].models.find((m:any)=>m.policy==='storage100-core60-purifier70'&&m.offeringSelection==='highest-public-reduction')!;
 const hp:Hp={CORE:60,STORAGE:100,PURIFIER:70},targets={...hp};let cumulativeGap=0,requiredBuffer=0;
 const rows=cohort.runs.map((run:any,i:number)=>{
  const opening={...hp},damage=model.rows[i].damage,spends:Hp={};
  for(const id of Object.keys(hp)){
   const after=Math.max(0,hp[id]!-damage[id]!);spends[id]=Math.max(0,Math.ceil((targets[id]!-after)/4));hp[id]=Math.min(100,after+spends[id]!*4);
  }
  const bill=Object.values(spends).reduce((a,b)=>a+b,0),actualHarvestAt100=collected(run,1.5);
  cumulativeGap+=bill-actualHarvestAt100;requiredBuffer=Math.max(requiredBuffer,cumulativeGap);
  const counts=(tier:string)=>run.nodes.filter((n:any)=>n.kind==='kindling'&&n.tier===tier).length;
  const options=[];
  for(let safe=0;safe<=counts('safe');safe++)for(let contested=0;contested<=counts('contested');contested++)for(let deep=0;deep<=counts('deep');deep++){
   const income=safe+contested*3+deep*6;
   if(income>=bill)options.push({safe,contested,deep,income,nodes:safe+contested+deep});
  }
  options.sort((a,b)=>a.nodes-b.nodes||a.income-b.income);
  return{ordinal:run.ordinal,grade:run.grade,tide:run.before.tide,opening,offering:model.rows[i].offeredBefore,damage,spends,bill,
   closing:{...hp},actualHarvestAt100,cumulativeGap,minimumCollectionOptions:options.filter(o=>o.nodes===options[0]?.nodes),
   allPilesIncome:counts('safe')+counts('contested')*3+counts('deep')*6};
 });
 return{cohort:cohort.policy,scope:'Operating requirement conditional on already-established 60/100/70, not free startup funding',rows,
  totalBills:rows.reduce((s:number,r:any)=>s+r.bill,0),actualHarvestAt100:rows.reduce((s:number,r:any)=>s+r.actualHarvestAt100,0),
  requiredStartingReserveForThisFixedSequence:requiredBuffer,finalCumulativeGap:cumulativeGap};
});
const peakRequirements=C.TIDE.TIDES.flatMap((tide,tideIndex)=>[0,.25,.35,.45].map(reduction=>{
 const hp:Hp={CORE:60,STORAGE:100,PURIFIER:70},target={...hp},rows=[];
 for(let n=0;n<12;n++){
  const keys=Object.keys(hp),primary=keys[n%keys.length]!,total=C.PURIFICATION.BASE_IMPACT_DAMAGE*tide.peak;
  const base:Hp={[primary]:Math.round(total*.65)},other=keys.filter(k=>k!==primary);let rest=Math.round(total)-base[primary]!;
  base[other[0]!]=Math.round(rest/2);base[other[1]!]=rest-base[other[0]!]!;
  const damage:Hp={},spends:Hp={};
  for(const id of keys){damage[id]=Math.round(base[id]!*(1-reduction));const after=hp[id]!-damage[id]!;spends[id]=Math.max(0,Math.ceil((target[id]!-after)/4));hp[id]=Math.min(100,after+4*spends[id]!);}
  rows.push({primary,base,damage,spends,total:Object.values(spends).reduce((a,b)=>a+b,0),hp:{...hp}});
 }
 return{tide:tideIndex+1,intensity:tide.peak,reduction,scope:'Conditional mechanics-only peak: fixed available attenuation, rotated actual target contract; no item supply or real journey claim',
  perImpactBills:rows.map(r=>r.total),mean:rows.reduce((n,r)=>n+r.total,0)/rows.length,max:Math.max(...rows.map(r=>r.total)),rows};
}));
const yieldSteps=[0,39,40,49,50,60,70,80,90,99,100].map(hp=>({storageHp:hp,multiplier:1+hp/200,
 piles:[1,2,4].map(base=>calculateKindlingYield(base,0,1+hp/200)),
 low:[1,2,2,4].reduce((s,b)=>s+calculateKindlingYield(b,0,1+hp/200),0),
 medium:[1,2,2,4,4].reduce((s,b)=>s+calculateKindlingYield(b,0,1+hp/200),0),
 severe:[1,2,2,4,4,4].reduce((s,b)=>s+calculateKindlingYield(b,0,1+hp/200),0)}));
const result={generatedAt:new Date().toISOString(),inputSha256:sha(readFileSync(inputPath,'utf8')),evidence:'accounting counterfactual; not new gameplay',
 limitations:['same actually collected nodes, extraction/death outcomes, tide and impact target sequence held fixed',
 'changed starting chaos, patrol exposure, tool maturity and tactics are not replayed; no claim the same journey would remain executable',
 'only actual acquired contaminants are supplied; no new tool effects, money, growth purchases or free defense',
 'repair decisions use current HP and reserve only; offering choices use visible catalog offering effects, never future damage or unrevealed active ability',
 'counterfactuals after first module zero continue accounting diagnostically, not a viable survival claim'],
 sources:['src/config/constants.ts','src/systems/kindling-yield.ts','src/systems/defense-engine.ts','src/systems/contaminant-catalog.ts','src/systems/equipment-lifecycle.ts','data/contaminant-offerings.csv'].map(path=>({path,sha256:sha(readFileSync(path,'utf8'))})),
 audit,yieldSteps,matrices,maintenance,peakRequirements};
writeFileSync(`${folder}/analysis.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({auditedReceipts:audit.length,inputs:frozen.inputs.map((c:any)=>({policy:c.policy,count:c.runs.length})),
 summaries:matrices.map((m:any)=>({cohort:m.cohort,models:m.models.map((x:any)=>({policy:x.policy,offeringSelection:x.offeringSelection,...x.summary}))}))},null,2));
