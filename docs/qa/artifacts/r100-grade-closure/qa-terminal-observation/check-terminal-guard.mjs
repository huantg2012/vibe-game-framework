import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const target=process.env.QA_TARGET??new URL('./candidate.mjs',import.meta.url).href;
const { createVisibleEncounterPolicy }=await import(target);
const results=[];
function harness({endedInitially=false,endAfterFacts=false,exportError=null,effects=[]}={}){
 let ended=endedInitially,exports=0,calls=0;
 const scene={
  ai:{getEnemies:()=>[]},combat:{isEnemyAlive:()=>false,getHealth:()=>ended?0:145},
  hosts:{getSubjects:()=>[]},visibilityAt:()=>1,search:{nodes:[]},
  player:{getPosition:()=>({x:0,y:0}),getFacingAngle:()=>0},chaos:{getValue:()=>30},
  runController:{getElapsedMs:()=>10,isRunEnded:()=>ended},
  toolSystem:{exportRuntimeState:()=>{exports++;if(exportError)throw exportError;return {catalog:{effects}};}}
 };
 globalThis.window={__game:{scene:{getScene:()=>scene}}};
 const logs=[];
 const page={evaluate:async(fn,arg)=>{calls++;const value=await fn(arg);if(calls===1&&endAfterFacts)ended=true;return value;}};
 const policy=createVisibleEncounterPolicy(page,{log:value=>logs.push(value)},async()=>({items:[],equipment:{toolIds:[]}}));
 return {policy,logs,counts:()=>({calls,exports})};
}
{
 const h=harness({endedInitially:true});const facts=await h.policy.observe();
 assert.equal(facts.ended,true);assert.deepEqual(h.counts(),{calls:1,exports:0});
 results.push({case:'already-settled-observation-skips-active-tool-export',pass:true});
}
{
 const h=harness({endAfterFacts:true});const facts=await h.policy.observe();
 assert.equal(facts.ended,true);assert.deepEqual(h.counts(),{calls:2,exports:0});
 assert.equal(h.logs.at(-1).ended,true);
 results.push({case:'settlement-between-evaluations-skips-active-tool-export',pass:true});
}
{
 const failure=new Error('Tool state does not match its recoverable inventory');
 const h=harness({exportError:failure});await assert.rejects(h.policy.observe(),error=>error===failure);
 assert.deepEqual(h.counts(),{calls:2,exports:1});
 results.push({case:'genuine-active-runtime-export-failure-still-propagates',pass:true});
}
{
 const snapshot={enemyPositions:[{x:13,y:14}],hostPositions:[]};
 const h=harness({effects:[{resolvedParams:{familyId:'survey'},remainingTime:800,startTime:2,snapshot}]});
 const facts=await h.policy.observe();assert.deepEqual(facts.displayedSurvey.snapshot,snapshot);
 assert.equal(h.policy.remembered()[0].source,'paid-static-survey');
 assert.deepEqual(h.counts(),{calls:2,exports:1});
 results.push({case:'active-paid-survey-still-exports-original-static-snapshot',pass:true});
}
{
 let ended=false,uses=2,exports=0;
 const scene={runController:{isRunEnded:()=>ended},toolSystem:{exportRuntimeState:()=>{exports++;assert(!ended,'must not export after settlement');return{catalog:{effects:[]}};}}};
 globalThis.window={__game:{scene:{getScene:()=>scene}}};
 const item=()=>({id:'owned-suppress',name:'灰釉齿',description:'压住一处污染源1秒',canEquip:true,usesRemaining:uses});
 const owned=async()=>({items:[item()],equipment:{toolIds:['owned-suppress']}});
 const facts=()=>({visibleSearches:[],visibleCells:[{x:8,y:8,paint:true,air:false}],position:{x:0,y:0},facing:0,hp:ended?0:145,chaos:30,elapsedMs:1000,ended,enemies:[],hosts:[{id:'visible-host',position:{x:12,y:0},occupancy:'paint'}]});
 const page={evaluate:async(fn,arg)=>fn.toString().includes('const visibleCells=[]')?facts():fn(arg)};
 const driver={state:async()=>({pos:{x:0,y:0},elapsedMs:1000}),hold:async()=>{},press:async()=>{uses--;ended=true;},log:()=>{}};
 const policy=createVisibleEncounterPolicy(page,driver,owned,{visiblePollution:true});
 await policy.beforeMove({x:30,y:0},{id:'visible-remains',pos:{x:30,y:0}});
 assert.equal(uses,1);assert.equal(exports,1,'only pre-use active survey export is allowed');
 results.push({case:'death-after-paid-suppression-input-skips-followup-active-export',pass:true});
}
delete globalThis.window;
await writeFile(new URL('./test-report.json',import.meta.url),JSON.stringify({status:'pass',scope:process.env.QA_TARGET?'Applied shared QA helper; no production gameplay change':'QA candidate only',target,results},null,2)+'\n');
console.log(JSON.stringify({passed:results.length,total:results.length}));
