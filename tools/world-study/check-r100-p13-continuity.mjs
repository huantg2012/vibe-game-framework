/** Read-only continuity of the preregistered three actual-input sequences. Does not play or infer balance. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const root=path.resolve('docs/qa/artifacts/r100-p13');
const definitions=[
 {id:'low-growth',expected:30,sources:['natural-low/report.json','natural-low-continuation/report.json','natural-low-final/report.json'],origin:'Independent new save'},
 {id:'medium-growth',expected:30,sources:['natural-medium/report.json','natural-medium-continuation/report.json'],origin:'Independent new save'},
 {id:'prepared-natural',expected:30,sources:['prepared-natural/report.json','prepared-natural-final/report.json'],origin:'Disclosed branch of low-growth after its actual return12',baseline:'natural-low/report.json'},
];
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fields=['cycle','kindlingReserve','modules','growth','inventory','moduleMaxHpTier'];
const sequences=[],allRuns=new Set();
for(const def of definitions){
 const loaded=def.sources.filter(file=>fs.existsSync(path.join(root,file))).map(file=>({file,sha256:sha(path.join(root,file)),data:JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))}));
 const records=loaded.flatMap(({file,data})=>data.realJourneyAttempts.filter(row=>row.status==='completed-real-input').map(row=>({file,row}))).sort((a,b)=>a.row.ordinal-b.row.ordinal);
 let previous=null,baseline=null;
 if(def.baseline){const data=JSON.parse(fs.readFileSync(path.join(root,def.baseline),'utf8'));baseline=data.realJourneyAttempts.filter(row=>row.status==='completed-real-input').at(-1).afterPreparation.state;previous=baseline;}
 const rows=[];
 for(const {row:r,file}of records){
  const begin=r.before.state,end=r.afterPreparation.state;
  assert.equal(r.ordinal,rows.length+1,`${def.id} ordinal without retry substitution`);
  assert.equal(end.cycle,begin.cycle+1,`${def.id}:${r.ordinal} exactly one real settlement`);
  if(r.continuationPreparationBridge){
   const bridge=r.continuationPreparationBridge;assert((def.id==='low-growth'&&r.ordinal===26)||(def.id==='prepared-natural'&&r.ordinal===25),'only the documented predeparture UI resumptions are permitted');assert(bridge.changes.length>0);
   for(const field of fields.filter(field=>field!=='inventory'))assert.deepEqual(begin[field],bridge.previousState[field],`predeparture UI resume preserves ${field}`);
   const a=bridge.previousState.inventory,b=begin.inventory;assert.equal(a.items.length,b.items.length);
   for(const key of Object.keys(a).filter(key=>!['items','equipment'].includes(key)))assert.deepEqual(b[key],a[key]);
   assert.equal(a.equipment.weaponId,b.equipment.weaponId);assert.deepEqual(a.equipment.defenseIds,b.equipment.defenseIds);
   for(const old of a.items){const live=b.items.find(item=>item.id===old.id);const{location:oldLocation,...oldRest}=old,{location:liveLocation,...liveRest}=live;assert.deepEqual(oldRest,liveRest);
    if(bridge.changes.some(change=>change.after===old.id)){assert.equal(oldLocation.kind,'stash');assert.equal(liveLocation.kind,'carried');}else assert.deepEqual(oldLocation,liveLocation);
   }
   for(const change of bridge.changes){assert.equal(a.equipment.toolIds[change.slot],null);assert.equal(b.equipment.toolIds[change.slot],change.after);}
  }
  if(previous)for(const field of fields)assert.deepEqual((r.continuationPreparationBridge?.previousState??begin)[field],previous[field],`${def.id}:${r.ordinal} ${field} continuous`);
  const id=r.entrySave.state.riftCheckpoint.runId;assert(!allRuns.has(id),`duplicate actual run ${id}`);allRuns.add(id);
  const actions=r.management?.actions??[],repair=actions.filter(a=>a.kind==='repair').reduce((n,a)=>n+a.spent,0),growth=actions.filter(a=>a.kind==='growth').reduce((n,a)=>n+a.cost,0);
  const earned=r.afterReturn.state.kindlingReserve-begin.kindlingReserve;
  assert.equal(begin.kindlingReserve+earned-repair-growth,end.kindlingReserve,`${def.id}:${r.ordinal} cash conservation`);
  assert.equal(r.noStateInjection,true,`${def.id}:${r.ordinal} natural sequence must not contain a fixture`);
  rows.push({ordinal:r.ordinal,runId:id,source:file,grade:r.grade,world:r.identity.generation.package.id,revision:r.identity.generation.package.algorithmRevision,cycle:begin.cycle,outcome:r.outcome,earned,repair,growth,reserve:end.kindlingReserve,modules:end.modules.map(m=>({id:m.id,hp:m.hp,maxHp:m.maxHp})),growthPurchases:actions.filter(a=>a.kind==='growth'),actualDeepFuelReturned:r.outcome==='extract'?r.searches.filter(s=>s.collected&&s.kind==='kindling'&&s.tier==='deep').length:0});
  previous=end;
 }
 sequences.push({...def,completed:rows.length,status:rows.length===def.expected?'sequence-complete-accounting-valid':'incomplete-not-passed',loaded:loaded.map(({data,...s})=>s),baselineCycle:baseline?.cycle??0,ending:previous?{cycle:previous.cycle,reserve:previous.kindlingReserve,modules:previous.modules,growth:previous.growth,moduleMaxHpTier:previous.moduleMaxHpTier}:null,earned:rows.reduce((n,r)=>n+r.earned,0),repair:rows.reduce((n,r)=>n+r.repair,0),growthSpent:rows.reduce((n,r)=>n+r.growth,0),deaths:rows.filter(r=>r.outcome==='death').length,rows});
}
const result={generatedAt:new Date().toISOString(),method:'No gameplay writes. Consecutive real before/after storage, unique run IDs, actual costs and settlements. Three sequences share one disclosed mature origin; this is two independent new saves plus one branch, not three independent new saves. Completion does not assert enjoyment or optimal play.',expected:90,completed:allRuns.size,status:allRuns.size===90?'all-sequences-complete-accounting-valid':'incomplete-not-passed',sequences};
fs.writeFileSync(path.join(root,'natural-continuity.json'),JSON.stringify(result,null,2));
console.log(`${result.completed}/90 actual returns; ${result.status}; ${sequences.map(s=>`${s.id}=${s.completed}`).join(', ')}`);
