/** Static boundary calculation, not a browser playthrough. node --import tsx <this> with tools/contam-preview tsconfig. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const sha=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const ref=p=>({path:path.relative(process.cwd(),path.resolve(p)),sha256:sha(p)});
const read=p=>JSON.parse(fs.readFileSync(p));
const imp=async p=>import(pathToFileURL(path.resolve(p)).href);
const {GAME_CONSTANTS}=await imp('src/config/constants.ts');
const {applyDefenseEffects}=await imp('src/systems/defense-engine.ts');
const {getContaminantOffering}=await imp('src/systems/contaminant-catalog.ts');
const {calculateKindlingYield}=await imp('src/systems/kindling-yield.ts');
const base='docs/qa/artifacts/r100-i13/',out='docs/qa/artifacts/r100-i13-continuation/qa-entry-bound.json';
const original=base+'r2-natural-maintenance/report.json',report=read(original),last=report.realJourneyAttempts.at(-1),state=last.afterPreparation.state;
const raw=base+'r2-natural-maintenance/i13/6-after-preparation.save.json';
assert.equal(sha(raw),last.afterPreparation.sha256);assert.deepEqual(read(raw),state);
assert.equal(state.repairBonusHp,0);assert.equal(state.tide.phase,'crest');assert.equal(state.tide.currentIntensity,3);
const P=GAME_CONSTANTS.PURIFICATION,forecast=state.impactForecast,primary=forecast.actualPrimaryId;
assert(!forecast.consumed);assert.equal(forecast.nextIntensity,state.tide.currentIntensity);
const total=Math.round(P.BASE_IMPACT_DAMAGE*state.tide.currentIntensity),primaryDamage=Math.round(P.BASE_IMPACT_DAMAGE*state.tide.currentIntensity*P.THREAT_FOCUS_RATIO),rest=total-primaryDamage;
const bases=Object.fromEntries(state.modules.map(m=>[m.id,0]));bases[primary]=primaryDamage;
const others=state.modules.filter(m=>m.id!==primary);let allocated=0;
for(let i=0;i<others.length;i++){const n=i===others.length-1?rest-allocated:Math.round(rest/others.length);bases[others[i].id]=n;allocated+=n;}
const ids=state.inventory.equipment.defenseIds,items=ids.map(id=>state.inventory.items.find(i=>i.id===id)),slots=items.map(i=>i?.kind==='contaminant'?i.contaminant:null);
assert(slots.filter(Boolean).every(c=>c.type==='catalog'),'Legacy offering effects require separate modeling');
const result=applyDefenseEffects(bases,structuredClone(slots),{forecastTargetId:forecast.targetId,actualPrimaryId:primary,stabilityProgress:state.stability.progress??0,
  moduleHps:Object.fromEntries(state.modules.map(m=>[m.id,m.hp])),moduleMaxHps:Object.fromEntries(state.modules.map(m=>[m.id,m.maxHp]))},ids);
assert.equal(result.kindlingGain,0);assert.equal(result.repairBonusHp,0);assert(Object.keys(result.healOut).length===0);
const projected=state.modules.map(m=>({...m,hp:Math.max(0,m.hp-result.finalDamagePerModule[m.id])}));
const service={CORE:51,STORAGE:100,PURIFIER:51},capital={CORE:51,STORAGE:102,PURIFIER:51};
const debt=target=>projected.map(m=>({id:m.id,target:target[m.id],hp:m.hp,kindling:Math.ceil(Math.max(0,target[m.id]-m.hp)/P.REPAIR_PER_KINDLING)}));
const serviceRepair=debt(service),capitalRepair=debt(capital),sum=r=>r.reduce((n,x)=>n+x.kindling,0);
const cases=[];
for(const grade of ['low','medium','severe']){
  const file=base+`paired-ash-strata-${grade}/report.json`,a=read(file).realJourneyAttempts[0];
  assert.equal(a.identity.seed,20261005);assert.equal(a.identity.generation.package.id,'r100-ash-strata');assert.equal(a.identity.generation.package.algorithmRevision,6);
  const spawn=a.entryState.pos,nodes=a.fieldResult.nodes.filter(n=>Math.hypot(n.pos.x-spawn.x,n.pos.y-spawn.y)<=320).map(n=>({id:n.id,kind:n.kind,tier:n.tier,base:n.value,pos:n.pos,
    radius:Math.hypot(n.pos.x-spawn.x,n.pos.y-spawn.y),possibleKindling:n.kind==='kindling'?calculateKindlingYield(n.value,3,1.5):0}));
  const upper=nodes.map(n=>n.possibleKindling).sort((a,b)=>b-a).slice(0,2).reduce((a,b)=>a+b,0);
  assert.equal(upper,6);
  cases.push({grade,oldGeometrySource:ref(file),world:'ash-strata',seed:20261005,spawn,positionRadius:320,searchCap:2,nodesInsideRadius:nodes,
    fieldIncomeUpper:upper,firstReturnServiceRepair:sum(serviceRepair),firstReturnMaintenanceUpper:upper+result.kindlingGain-sum(serviceRepair),
    newBrowserGeometryAndActualInputsStillRequired:true});
}
const offeringRows=fs.readFileSync('data/contaminant-offerings.csv','utf8').trim().split(/\r?\n/).slice(1).map(r=>r.split(','));
const bestReduction=Math.max(...offeringRows.filter(r=>r[2]==='impact_damage_reduction').map(r=>Number(r[3])));
assert.equal(bestReduction,.45);
const arithmetic={finalCrestRawDamage:total,maxNewContaminantsPerSelectedEntryReturn:1,maxNewOfferingReduction:bestReduction,
  comment:'At final crest every offering reaches its 3-charge maturity threshold on one impact. Newly obtained items cannot keep defending indefinitely. Weapons do not reduce impact damage.',
  conservativeSteadyDamageLowerPerReturn:total*(1-bestReduction)-state.modules.length*.5,
  conservativeSteadyRepairLowerPerReturn:(total*(1-bestReduction)-state.modules.length*.5)/P.REPAIR_PER_KINDLING,
  incomeUpperPerReturn:6,
  restrictions:'Conditional on repeatedly obtaining at most the selected radius set: one new catalog contaminant plus at most an added weapon; no external stock, no persistent free repair, fixed service/capital, final crest. Multiplicative defense has diminishing savings, so batching finite new offerings cannot increase total saved HP beyond 40.5 per acquired 45% item before rounding. Finite initial cash/HP/old offerings cannot be injected repeatedly. Does not cover other worlds/radii, newborn tide phases or every player strategy.'};
assert(Math.abs(arithmetic.conservativeSteadyRepairLowerPerReturn-12)<1e-10);
assert(!fs.existsSync(out));
fs.writeFileSync(out,JSON.stringify({recordedDate:'2026-10-08',status:'source-model-bound-awaiting-real-input',tool:ref(fileURLToPath(import.meta.url)),sourceState:ref(raw),sourceReport:ref(original),
  sources:['src/config/constants.ts','src/systems/defense-engine.ts','src/systems/impact-system.ts','src/systems/contaminant-catalog.ts','src/systems/kindling-yield.ts','src/systems/contaminant-system.ts','data/contaminant-offerings.csv'].map(ref),
  validationHistory:['Initial pure-model run stopped before writing output: strict floating-point equality compared 12.000000000000002 with 12. Replaced only that numerical sanity assertion with 1e-10 tolerance; no game state, formula, or browser action changed.'],
  fixedServiceTarget:service,originalCapitalTarget:capital,repairCreditBefore:state.repairBonusHp,rawDamage:bases,
  offeringItems:items.map(i=>({id:i.id,kind:i.kind,offering:i.kind==='contaminant'?getContaminantOffering(i.contaminant):null})),defenseResult:result,projectedReturnedModules:projected,serviceRepair,capitalRepair,cases,conditionalRepeatedEntryBound:arithmetic,
  limitations:['Pure source calculation and reuse of old identical geometry, not new actual returns. New evidence must confirm the same radius set, source state, non-skipped impact, and actual repairs.',
    'No hidden node kind/tier/location may be passed into the gameplay selector; these are post-registration audit bounds only.',
    'Matured old holdings and one-time earned repair credits are finite assets, never recurring free income.',
    'This bound excludes a same-service positive-cash loop for this specified repeated entry budget at final crest; it does not claim a theorem over 108 worlds or every route.']},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output:ref(out),firstRepair:sum(serviceRepair),firstMarginUpper:cases.map(c=>({grade:c.grade,upper:c.firstReturnMaintenanceUpper})),steadyRepairLower:arithmetic.conservativeSteadyRepairLowerPerReturn}));
