import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isWorkerObservationFailure} from '../../../../../tools/qa/r100-worker-observer.mjs';
const base='docs/qa/artifacts/r100-i10-i12/b06-porous-repaired-play/';
const ref=file=>({path:file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
const read=file=>JSON.parse(fs.readFileSync(file));
const execution=read(base+'execution.json');assert.equal(execution.status,'completed-original11');
const summary=read(base+'play-summary.json'),files=[],counts={},exceptions=[],contexts=[];
for(const id of ['original002-low-second','remaining-marrow-upper','remaining-pore-all']){
 const dir=base+id+'-worker-observations/';
 for(const name of fs.readdirSync(dir).sort()){
  if(!name.endsWith('.jsonl'))continue;
  const file=dir+name,events=fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));files.push(ref(file));
  for(const row of events){counts[row.event]=(counts[row.event]??0)+1;if(isWorkerObservationFailure(row))exceptions.push({...row,file});}
  if(!events.some(row=>row.event==='launch'))continue;
  for(const key of ['launch','browser-ready','context-created','context-closed','browser-disconnected'])assert.equal(events.filter(x=>x.event===key).length,1,`${file}/${key}`);
  const created=events.filter(x=>x.event==='worker-created').map(x=>x.workerId).sort();
  const closed=events.filter(x=>x.event==='worker-closed').map(x=>x.workerId).sort();assert(created.length>0);assert.deepEqual(created,closed);
  const network=events.filter(x=>x.event==='network-summary'&&x.reason==='context-closed');assert.equal(network.length,1);assert(network[0].requests>0&&network[0].responses>0&&network[0].urls.length>0);
  contexts.push({file:ref(file),workers:created.length,network:network[0]});
 }
}
assert.equal(contexts.length,11);assert.equal(exceptions.length,0);
const result={status:'complete-observation',execution:ref(base+'execution.json'),play:ref(base+'play-summary.json'),observer:ref('tools/qa/r100-worker-observer.mjs'),files,eventCounts:counts,exceptionEvents:exceptions,contexts,
 limitations:'Only the new11 repaired-source processes are observed here. Original failed002 and successful001 remain in play-summary.json. No observed error is not proof of the earlier cause and does not close P36; final324 ordinary entry/cold and independent disposition remain required.'};
const out=base+'worker-observation-summary.json';assert(!fs.existsSync(out));fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
const outcomes=summary.attempts.map(a=>{const raw=read(a.report),j=raw.realJourneyAttempts?.[0];return {...a,fieldHp:j?.fieldResult?.hp??null,fieldChaos:j?.fieldResult?.chaos??null,fieldElapsedMs:j?.fieldResult?.elapsedMs??null,errors:j?.errors??[],consoleErrors:j?.consoleErrors??[]};});
const outcomePath=base+'outcomes.json';assert(!fs.existsSync(outcomePath));fs.writeFileSync(outcomePath,JSON.stringify({summary:ref(base+'play-summary.json'),outcomes},null,2)+'\n');
console.log(JSON.stringify({observedContexts:contexts.length,exceptionEvents:exceptions.length,qualifiedGradePairs:summary.qualifiedGradePairs,processes:summary.completedSeedProcesses,attempts:summary.actualAttempts}));
