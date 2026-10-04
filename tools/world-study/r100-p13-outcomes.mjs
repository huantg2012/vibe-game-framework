/** Read-only accounting of real P13 natural runs; no gameplay or hidden-content routing. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root=path.resolve('docs/qa/artifacts/r100-p13');
const groups=[
 {id:'low-growth',reports:['natural-low/report.json','natural-low-continuation/report.json','natural-low-final/report.json'],origin:'independent-new-save'},
 {id:'medium-growth',reports:['natural-medium/report.json','natural-medium-continuation/report.json'],origin:'independent-new-save'},
 {id:'prepared-natural',reports:['prepared-natural/report.json','prepared-natural-final/report.json'],origin:'branch-of-real-low-return12'},
];
const totals=rows=>({fieldMinutes:rows.reduce((n,r)=>n+r.elapsedMs,0)/60000,earnedPerFieldMinute:rows.reduce((n,r)=>n+r.earned,0)/(rows.reduce((n,r)=>n+r.elapsedMs,0)/60000||1),afterRepairNetPerFieldMinute:rows.reduce((n,r)=>n+r.earned-r.repair,0)/(rows.reduce((n,r)=>n+r.elapsedMs,0)/60000||1),attempts:rows.length,extracts:rows.filter(r=>r.outcome==='extract').length,deaths:rows.filter(r=>r.outcome==='death').length,earned:rows.reduce((a,r)=>a+r.earned,0),repair:rows.reduce((a,r)=>a+r.repair,0),growth:rows.reduce((a,r)=>a+r.growth,0),afterRepairNet:rows.reduce((a,r)=>a+r.earned-r.repair,0),deathCarriedFuelLost:rows.reduce((a,r)=>a+r.deathCarriedFuelLost,0),deepPilesReturned:rows.reduce((a,r)=>a+r.deepPilesReturned,0),deepPilesLost:rows.reduce((a,r)=>a+r.deepPilesLost,0)});
const sequences=[];
for(const group of groups){
 const sources=group.reports.filter(file=>fs.existsSync(path.join(root,file))).map(file=>{const raw=fs.readFileSync(path.join(root,file));return{file,sha256:createHash('sha256').update(raw).digest('hex'),report:JSON.parse(raw)};});
 const rows=sources.flatMap(({file,report})=>report.realJourneyAttempts.filter(r=>r.status==='completed-real-input').map(r=>{
  const before=r.before.state,after=r.afterPreparation.state,returned=r.afterReturn.state,actions=r.management?.actions??[];
  const earned=returned.kindlingReserve-before.kindlingReserve,repair=actions.filter(a=>a.kind==='repair').reduce((n,a)=>n+a.spent,0),growth=actions.filter(a=>a.kind==='growth').reduce((n,a)=>n+a.cost,0);
  assert.equal(before.kindlingReserve+earned-repair-growth,after.kindlingReserve);
  const deepPiles=r.searches.filter(s=>s.collected&&s.kind==='kindling'&&s.tier==='deep').length;
  const catalogUses=Object.entries(returned.inventory.run.actionReceipts).filter(([key])=>key.startsWith('catalog:')).map(([key,receipt])=>({receipt:key,itemId:receipt.itemId,definitionId:receipt.definitionId,usesLeft:receipt.usesLeft,broken:receipt.broken}));
  const weapons=r.entrySave.state.inventory.items.filter(i=>i.kind==='weapon'&&r.entrySave.state.inventory.equipment.weaponId===i.id);
  return{ordinal:r.ordinal,source:file,entryAffinity:r.entrySave.state.growth.upgrades.growth_kindling_affinity,entryVitality:r.entrySave.state.growth.upgrades.growth_vitality,entryGrowthCount:Object.values(r.entrySave.state.growth.upgrades).reduce((n,v)=>n+v,0)+(r.entrySave.state.moduleMaxHpTier??0),entryStorageHp:r.entrySave.state.modules.find(m=>m.id==='STORAGE').hp,runId:returned.inventory.run.id,world:r.identity.generation.package.id,seed:r.identity.generation.requestedSeed,grade:r.grade,outcome:r.outcome,entryHp:r.entryState.hp,entryChaos:r.entryState.chaos,endingHp:r.fieldResult.hp,endingChaos:r.fieldResult.chaos,elapsedMs:r.fieldResult.elapsedMs,earned,repair,growth,afterRepairNet:earned-repair,deathCarriedFuelLost:r.outcome==='death'?r.fieldResult.carried:0,deepPilesReturned:r.outcome==='extract'?deepPiles:0,deepPilesLost:r.outcome==='death'?deepPiles:0,collected:r.searches.filter(s=>s.collected).length,reserveBefore:before.kindlingReserve,reserveAfter:after.kindlingReserve,modules:after.modules,growthPurchases:actions.filter(a=>a.kind==='growth'),entryEquipment:r.entrySave.state.inventory.equipment,entryWeapon:weapons,catalogUses,decision:r.gradeDecision??null};
 })).sort((a,b)=>a.ordinal-b.ordinal);
 sequences.push({id:group.id,origin:group.origin,sources:sources.map(({report,...s})=>s),...totals(rows),byGrade:Object.fromEntries(['low','medium','severe'].map(grade=>[grade,totals(rows.filter(r=>r.grade===grade))])),byEntryAffinity:Object.fromEntries([...new Set(rows.map(r=>r.entryAffinity))].sort().map(affinity=>[affinity,Object.fromEntries(['low','medium','severe'].map(grade=>[grade,totals(rows.filter(r=>r.grade===grade&&r.entryAffinity===affinity))]))])),rows});
}
const result={generatedAt:new Date().toISOString(),method:'Actual settled receipts and genuine repair/growth actions. Death carries count as lost, never banked. Classification uses revealed post-run nodes, never routing inputs. Two independent new saves plus one disclosed branch share ancestry; this is not three independent samples of the player population. A net cash result does not by itself establish fun or optimal tactics.',completed:sequences.reduce((n,s)=>n+s.attempts,0),expected:90,sequences};
fs.writeFileSync(path.join(root,'natural-outcomes.json'),JSON.stringify(result,null,2));
for(const s of sequences)console.log(s.id,s.attempts,'runs',s.earned,'earned',s.repair,'repair',s.growth,'invested',s.deepPilesReturned,'deep returned',s.deaths,'deaths');
