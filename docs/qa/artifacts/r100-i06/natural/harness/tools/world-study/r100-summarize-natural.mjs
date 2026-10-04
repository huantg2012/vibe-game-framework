/** Read only the actual-input receipts; never infer unplayed returns from economy formulas. */
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.argv[2]??'docs/qa/artifacts/r100-i06/natural');
const summaries=[];
for(const policy of ['conservative','gradual','repeat-risk']){
 const file=path.join(root,policy,'report.json');if(!fs.existsSync(file))continue;
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 const runs=report.realJourneyAttempts.filter(run=>run.status==='completed-real-input');
 const summarize=list=>{
  if(!list.length)return null;
  const last=list.at(-1),end=last.afterPreparation?.state??last.afterRepair?.state??last.afterReturn.state;
  return{from:list[0].ordinal,to:last.ordinal,count:list.length,grades:Object.fromEntries(['low','medium','severe'].map(grade=>[grade,list.filter(run=>run.grade===grade).length])),
   deaths:list.filter(run=>run.outcome==='death').length,extractions:list.filter(run=>run.outcome==='extract').length,
   returnedKindling:list.reduce((sum,run)=>sum+run.afterReturn.state.inventory.run.kindlingGained,0),
   repairsPaid:list.reduce((sum,run)=>sum+run.afterReturn.state.kindlingReserve-(run.afterRepair?.state.kindlingReserve??run.afterReturn.state.kindlingReserve),0),
   startReserve:list[0].before.state.kindlingReserve,endReserve:end.kindlingReserve,
   startModuleHp:list[0].before.state.modules.map(module=>({type:module.type,hp:module.hp})),endModuleHp:end.modules.map(module=>({type:module.type,hp:module.hp})),
   offerings:list.reduce((sum,run)=>sum+(run.offered?.length??0),0),
   endKnownMatureTools:end.inventory.items.filter(item=>item.kind==='contaminant'&&item.contaminant.stage==='tool'&&item.contaminant.usesRemaining>0).map(item=>({id:item.id,usesRemaining:item.contaminant.usesRemaining})),
   worldCounts:Object.fromEntries([...new Set(list.map(run=>run.identity.generation.package.id))].sort().map(world=>[world,list.filter(run=>run.identity.generation.package.id===world).length]))};
 };
 summaries.push({policy,completed:runs.length,status:report.status,total:summarize(runs),blocks:Array.from({length:Math.ceil(runs.length/10)},(_,i)=>summarize(runs.slice(i*10,i*10+10))),
  uncompleted:report.realJourneyAttempts.filter(run=>run.status!=='completed-real-input').map(run=>({ordinal:run.ordinal,status:run.status,failure:run.failure??null})),
  gradeDecisions:runs.map(run=>({ordinal:run.ordinal,...run.gradeDecision})),
  source:root,harnessSha256:report.harnessSha256});
}
const output={generatedAt:new Date().toISOString(),scope:'Only completed native-input receipts; no equipment/resource grants or fixed world selection. Read-only full-map routing, simple tool policy, no growth purchases or melee optimization. A policy unable to equip for severe remains at lower grades; no forced quota. Partial blocks explicitly retain their count.',completed:summaries.reduce((n,row)=>n+row.completed,0),policies:summaries};
fs.mkdirSync(root,{recursive:true});fs.writeFileSync(path.join(root,'supply-summary.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify({completed:output.completed,policies:summaries.map(({policy,completed,total,uncompleted})=>({policy,completed,total,uncompleted}))},null,2));
