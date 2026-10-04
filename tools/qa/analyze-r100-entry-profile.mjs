/** Attribute sampled CPU to observed browser long tasks. No game is launched. */
import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve(process.env.QA_OUTPUT_DIR??'docs/qa/artifacts/r100-i06/entry-profile-final/aligned');
const report=JSON.parse(fs.readFileSync(path.join(dir,'report.json')));
function analysis(phase){
 const profile=JSON.parse(fs.readFileSync(path.join(dir,`${phase.name}.cpuprofile`)));
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map();for(const n of nodes.values())for(const c of n.children??[])parents.set(c,n.id);
 let timestamp=profile.startTime/1000-phase.alignment.offsetMs;
 const samples=profile.samples.map((id,i)=>{
  const start=timestamp;timestamp+=profile.timeDeltas[i]/1000;
  const chain=[];let cursor=id;while(cursor){chain.push(nodes.get(cursor).callFrame);cursor=parents.get(cursor);}
  return {id,start,end:timestamp,chain};
 });
 const matches=(sample,name,file)=>sample.chain.some(f=>f.functionName===name&&(!file||f.url.includes(file)));
 const bucket=s=>{
  if(matches(s,'hostManifest','rift-recovery'))return 'checkpoint: recompute Host manifest';
  if(matches(s,'createRun','rift-scene')){
   if(matches(s,'attachSchemeD'))return 'createRun: enemy and Host visual attach';
   if(matches(s,'MasterPresentation'))return 'createRun: native presentation setup';
   if(matches(s,'createContaminantSourceRegions'))return 'createRun: source-region BFS';
   if(matches(s,'createWorldSearchVisual'))return 'createRun: source-specific loot visuals';
   return 'createRun: remaining scene setup';
  }
  if(matches(s,'onPostUpdate','rift-scene')){
   if(matches(s,'commitRuntimeFrame'))return 'first frame: other checkpoint work';
   if(matches(s,'syncSchemeDPoses'))return 'first frame: live enemy and Host paint';
   if(matches(s,'afterUpdate','r100-world/presentation'))return 'first frame: native actor occlusion';
   if(matches(s,'syncMinimapExploration')||s.chain.some(f=>f.url.includes('/visibility-system.ts')))return 'first frame: visibility and minimap';
   return 'first frame: other post-update';
  }
  if(matches(s,'update','rift-scene'))return 'first frame: gameplay update';
  if(s.chain.some(f=>f.url.includes('/phaser.js')))return 'Phaser/browser integration';
  return `unattributed: ${nodes.get(s.id).callFrame.functionName||'(anonymous)'}`;
 };
 function aggregate(start,end){
  const exclusive={},inclusive=new Map();let sampled=0;
  for(const s of samples){const overlap=Math.max(0,Math.min(s.end,end)-Math.max(s.start,start));if(!overlap)continue;sampled+=overlap;
   const name=bucket(s);exclusive[name]=(exclusive[name]??0)+overlap;
   for(const f of s.chain){if(!f.url.includes('/src/'))continue;const key=`${f.functionName} @ ${new URL(f.url).pathname}:${f.lineNumber+1}`;inclusive.set(key,(inclusive.get(key)??0)+overlap);}
  }
  return {start,end,sampledMs:sampled,exclusiveMs:Object.fromEntries(Object.entries(exclusive).sort((a,b)=>b[1]-a[1]).map(([k,v])=>[k,+v.toFixed(3)])),inclusiveMs:Object.fromEntries([...inclusive].sort((a,b)=>b[1]-a[1]).slice(0,60).map(([k,v])=>[k,+v.toFixed(3)]))};
 }
 const full=aggregate(samples[0].start,samples.at(-1).end);
 const exactTasks=phase.longTasks.map(task=>({observed:task,...aggregate(task.start,task.start+task.duration)}));
 return {phase:phase.name,alignment:phase.alignment,taskAttribution:exactTasks,fullProfileInclusiveMs:full.inclusiveMs,
  nativeHeavyFunctionsSampled:profile.nodes.filter(n=>['bakeMasterWorldSurface','bakeMasterSurface','MasterGroundSurface','NativeVolumeLighting','createR100ProductionMap','executeR100ProductionMap','executeRiftGeneration'].includes(n.callFrame.functionName)).map(n=>n.callFrame)};
}
const out={method:'CDP CPU timestamp aligned to page Performance.now with bracketed Timestamp metric; samples are clipped to exact longtask interval. Inclusive rows overlap; exclusive rows are disjoint. Profiler perturbs absolute timings; sampling uncertainty is about 1–2ms plus listed clock alignment bound. Two initial comparison profiles are separate unaligned evidence, not added into these task totals.',cases:report.phases.map(analysis)};
fs.writeFileSync(path.join(dir,'attribution.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out.cases.map(c=>({phase:c.phase,tasks:c.taskAttribution.map(t=>({observed:t.observed,sampledMs:t.sampledMs,exclusive:t.exclusiveMs})),nativeHeavyFunctionsSampled:c.nativeHeavyFunctionsSampled})),null,2));
