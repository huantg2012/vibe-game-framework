import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildPlaySummary} from '../../../../tools/qa/r100-play-qualification.mjs';
import {isWorkerObservationFailure} from '../../../../tools/qa/r100-worker-observer.mjs';
const base='docs/qa/artifacts/r100-i10-i12/',folder=process.argv[2];assert(/^(b\d\d-[a-z-]+qualified)$/.test(folder),'Explicit current batch folder required');
const out=base+folder+'/',read=p=>JSON.parse(fs.readFileSync(p)),ref=p=>({path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex')}),write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const commands=read(out+'play-commands.json'),execution=read(out+'play-execution.json');assert.equal(execution.status,'completed-script');assert.equal(execution.exitCode,0);assert.equal(execution.cases,commands.worlds.length*6);assert.deepEqual(execution.commands,ref(out+'play-commands.json'));
const planFile=out+'play-summary-plan.json';write(planFile,{version:1,worlds:commands.worlds,grades:['low','medium','severe'],seeds:[20261005,3075192741],batches:[out+'play'],algorithmRevisions:[6]});
const summary=buildPlaySummary(planFile);write(out+'play-summary.json',summary);
const files=[],counts={},exceptions=[],contexts=[];
for(const name of fs.readdirSync(out+'worker-observations/').sort()){
 if(!name.endsWith('.jsonl'))continue;const file=out+'worker-observations/'+name,events=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);files.push(ref(file));
 for(const row of events){counts[row.event]=(counts[row.event]??0)+1;if(isWorkerObservationFailure(row))exceptions.push({...row,file});}
 if(!events.some(row=>row.event==='launch'))continue;
 for(const key of ['launch','browser-ready','context-created','context-closed','browser-disconnected'])assert.equal(events.filter(x=>x.event===key).length,1,`${file}/${key}`);
 const created=events.filter(x=>x.event==='worker-created').map(x=>x.workerId).sort(),closed=events.filter(x=>x.event==='worker-closed').map(x=>x.workerId).sort();assert(created.length>0);assert.deepEqual(created,closed);
 const network=events.filter(x=>x.event==='network-summary'&&x.reason==='context-closed');assert.equal(network.length,1);assert(network[0].requests>0&&network[0].responses>0&&network[0].urls.length>0);
 contexts.push({file:ref(file),workers:created.length,network:network[0]});
}
assert.equal(contexts.length,execution.cases);assert.equal(exceptions.length,0);
write(out+'worker-observation-summary.json',{status:'complete-observation',execution:ref(out+'play-execution.json'),play:ref(out+'play-summary.json'),observer:ref('tools/qa/r100-worker-observer.mjs'),files,eventCounts:counts,exceptionEvents:exceptions,contexts,limitations:'These recorded contexts only. Absence of observed errors neither explains earlier Worker failures nor closes P36. Final324 ordinary entry/cold still required.'});
const outcomes=summary.attempts.map(a=>{const raw=read(a.report),j=raw.realJourneyAttempts?.[0];return{...a,fieldHp:j?.fieldResult?.hp??null,fieldChaos:j?.fieldResult?.chaos??null,fieldElapsedMs:j?.fieldResult?.elapsedMs??null,errors:j?.errors??[],consoleErrors:j?.consoleErrors??[]};});
write(out+'outcomes.json',{summary:ref(out+'play-summary.json'),outcomes});
console.log(JSON.stringify({status:summary.status,gradePairs:summary.qualifiedGradePairs,processes:summary.completedSeedProcesses,nonEntryExtract:summary.searchAndExtractAttempts,nearOnly:summary.nearEntryOnlyReturns??0,empty:summary.emptyReturns,deaths:summary.deaths,errors:exceptions.length}));
if(summary.status!=='pass')process.exitCode=1;
