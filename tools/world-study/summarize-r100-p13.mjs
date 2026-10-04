/** Read-only accounting of recorded actual-input journeys. Does not play or infer unseen player choices. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]??'docs/qa/artifacts/r100-p13');
const reports=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,e.name);if(e.isDirectory())walk(file);else if(e.name==='report.json'){const data=JSON.parse(fs.readFileSync(file));if(data.realJourneyAttempts)reports.push({file,data});}}}
walk(root);
const output={generatedAt:new Date().toISOString(),method:'Read-only actual receipt accounting. Formula checks explain paid outcomes; they do not replace recorded play or establish optimal balance.',groups:[]};
for(const {file,data}of reports){
 const rows=[];
 for(const r of data.realJourneyAttempts){
  if(r.status!=='completed-real-input')continue;
  const start=r.before.state,returned=r.afterReturn.state,end=(r.afterPreparation??r.afterRepair??r.afterReturn).state;
  const actions=r.management?.actions??[],repairs=actions.filter(a=>a.kind==='repair').reduce((n,a)=>n+a.spent,0),growth=actions.filter(a=>a.kind==='growth').reduce((n,a)=>n+a.cost,0);
  const earned=returned.kindlingReserve-start.kindlingReserve;
  assert.equal(start.kindlingReserve+earned-repairs-growth,end.kindlingReserve,`${file} ordinal${r.ordinal} actual reserve accounting`);
  assert.equal(end.cycle,start.cycle+1,`${file} ordinal${r.ordinal} exactly one actual return`);
  const conditions=r.entrySave.state.riftCheckpoint.state.conditions;
  let expected=0;for(const searched of r.searches.filter(s=>s.collected&&s.kind==='kindling')){
   const node=r.entryState.nodes.find(n=>n.id===searched.id);expected+=Math.max(1,Math.floor((node.value+conditions.kindlingAffinity)*conditions.modifiers.kindlingValueModifier));
  }
  assert.equal(expected,r.fieldResult.carried,`${file} ordinal${r.ordinal} searched pile values`);
  if(r.outcome==='extract')assert.equal(earned,expected,`${file} ordinal${r.ordinal} extraction settlement`);
  rows.push({ordinal:r.ordinal,grade:r.grade,world:r.identity.generation.package.id,outcome:r.outcome,cycleStart:start.cycle,cycleEnd:end.cycle,startReserve:start.kindlingReserve,earned,repairs,growth,endReserve:end.kindlingReserve,startModules:start.modules.map(m=>({id:m.id,hp:m.hp})),endModules:end.modules.map(m=>({id:m.id,hp:m.hp})),growthActions:actions.filter(a=>a.kind==='growth'),entryMaxHealth:conditions.maxHealth,entryAffinity:conditions.kindlingAffinity,storageModifier:conditions.modifiers.kindlingValueModifier,elapsedMs:r.fieldResult.elapsedMs,endHp:r.fieldResult.hp,endChaos:r.fieldResult.chaos,deepKindlingCollected:r.searches.filter(s=>s.collected&&s.kind==='kindling'&&s.tier==='deep').length,searches:r.searches.filter(s=>s.collected).length});
 }
 output.groups.push({report:path.relative(root,file),policyRevision:data.policyRevision,controlledBuild:data.controlledBuild,sourceStatus:data.status,completed:rows.length,pendingOrFailed:data.realJourneyAttempts.filter(r=>r.status!=='completed-real-input').map(r=>({ordinal:r.ordinal,status:r.status,failure:r.failure})),totalEarned:rows.reduce((n,r)=>n+r.earned,0),totalRepairs:rows.reduce((n,r)=>n+r.repairs,0),totalGrowth:rows.reduce((n,r)=>n+r.growth,0),extractions:rows.filter(r=>r.outcome==='extract').length,deaths:rows.filter(r=>r.outcome==='death').length,deepKindling:rows.reduce((n,r)=>n+r.deepKindlingCollected,0),deepKindlingBroughtHome:rows.filter(r=>r.outcome==='extract').reduce((n,r)=>n+r.deepKindlingCollected,0),worldCount:new Set(rows.map(r=>r.world)).size,rows});
}
fs.writeFileSync(path.join(root,'actual-accounting.json'),JSON.stringify(output,null,2));
for(const g of output.groups)console.log(g.report,`${g.completed} complete, +${g.totalEarned} / repairs${g.totalRepairs} / growth${g.totalGrowth}; deep${g.deepKindling}, death${g.deaths}`);
