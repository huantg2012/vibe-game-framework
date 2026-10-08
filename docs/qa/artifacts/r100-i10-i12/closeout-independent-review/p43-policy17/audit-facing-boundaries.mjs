import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {stepAngleToward} from '../../../../../../src/utils/math.ts';
import {GAME_CONSTANTS} from '../../../../../../src/config/constants.ts';
import {createJourneyDriver} from '../../../../../../tools/qa/i27-journey-driver.mjs';

const root=process.cwd(), own=path.dirname(fileURLToPath(import.meta.url));
const candidatePath=process.argv[2];
assert(candidatePath,'Pass the frozen candidate JSON; no review of a moving draft');
const candidate=JSON.parse(fs.readFileSync(candidatePath,'utf8'));
const moduleFile='tools/qa/r100-i12-turn-align.mjs';
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const moduleSha256=hash(moduleFile);
// Candidate shape may evolve during preparation. Require its literal evidence
// to contain this exact path and SHA before importing the executor under test.
const candidateRaw=JSON.stringify(candidate);
assert(candidateRaw.includes(moduleFile)&&candidateRaw.includes(moduleSha256),'Frozen candidate must bind the reviewed alignment bytes');
const {FACING_POLICY,FACING_INPUT_DURATION_SEMANTICS,facingGeometry,createBoundedFacingInput}=await import(pathToFileURL(path.resolve(moduleFile)));
assert.deepEqual(FACING_POLICY,{maxSegments:3,maxSegmentInputMs:60,maxTurnInputMs:180,maxElapsedMs:1000,
  earlyStopMs:750,actionReserveMs:100,maxErrorDegrees:25,spaceInputMs:60});
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'coh-independent-policy17-'));
const results=[];
const radians=degrees=>degrees*Math.PI/180;
function fixture(options={}){
  const state={scene:'rift',active:true,paused:false,ended:false,hp:100,chaos:20,elapsedMs:10000,
    pos:{x:0,y:0},facing:Math.PI,nodes:[],...options.state};
  let enemies=structuredClone(options.enemies??[{id:'same-visible',position:{x:30,y:0},attack:'idle'}]);
  const keys=new Set(),events=[],records=[];
  let reads=0,observations=0;
  function advance(ms){
    const x=Number(keys.has('d'))-Number(keys.has('a')),y=Number(keys.has('s'))-Number(keys.has('w'));
    if((x||y)&&!options.lockFacing)state.facing=stepAngleToward(state.facing,Math.atan2(y,x),radians(GAME_CONSTANTS.PLAYER.FACING_TURN_RATE)*ms/1000);
    state.elapsedMs+=ms;
  }
  const handle={state,keys,events,records,advance,getEnemies:()=>enemies,setEnemies:value=>{enemies=value;}};
  const page={
    keyboard:{
      async down(key){keys.add(key);events.push({type:'down',key,elapsedMs:state.elapsedMs});await options.onDown?.(handle,key);},
      async up(key){events.push({type:'up-start',key,elapsedMs:state.elapsedMs});await options.onUp?.(handle,key);keys.delete(key);events.push({type:'up-end',key,elapsedMs:state.elapsedMs});},
      async press(key,{delay=0}={}){await this.down(key);await page.waitForTimeout(delay);await this.up(key);},
    },
    async waitForTimeout(ms){events.push({type:'wait',ms,elapsedMs:state.elapsedMs,held:[...keys]});advance(ms);await options.onWait?.(handle,ms);},
    async evaluate(){reads++;await options.onState?.(handle,reads);return structuredClone(state);},
  };
  const driver=createJourneyDriver(page,path.join(folder,String(results.length)));
  async function observe(){observations++;await options.onObserve?.(handle,observations);return{position:{...state.pos},
    facing:state.facing,hp:state.hp,chaos:state.chaos,ended:state.ended,elapsedMs:state.elapsedMs,enemies:structuredClone(enemies)};}
  const align=createBoundedFacingInput({page,driver,observe,
    returnBudgetStopped:async value=>await options.returnBudgetStopped?.(handle,value)??false,
    onRecord:record=>records.push(structuredClone(record))});
  const invoke=async(extra={})=>align({targetId:'same-visible',context:'visible-pursuer',triggerElapsedMs:10000,maxDistance:37,minimumHp:45,...extra});
  return{...handle,invoke};
}
const downs=f=>f.events.filter(e=>e.type==='down');
const spaces=f=>downs(f).filter(e=>e.key==='Space');
async function check(name,fn){
  try{const detail=await fn();results.push({name,status:'pass',...detail});}
  catch(error){results.push({name,status:'fail',error:String(error.stack??error)});}
}
try{
  await check('180degree turn reaches the real production turning rate in three60ms requested segments',async()=>{
    const f=fixture(),r=await f.invoke();assert.equal(r.status,'allowed');assert.equal(r.segments.length,3);
    assert.equal(r.turnInputMs,180);assert.equal(r.elapsedMs,240);assert.equal(spaces(f).length,1);
    assert(r.spaceInput.finalCheck.errorDegrees<=25);assert.equal(f.keys.size,0);
    return{segments:r.segments.length,requestedTurnMs:r.turnInputMs,elapsedMs:r.elapsedMs,finalErrorDegrees:r.spaceInput.finalCheck.errorDegrees};
  });
  await check('angle wrap across +/-pi keeps a4degree aligned target and creates no turn segment',async()=>{
    const a=radians(-178),f=fixture({state:{facing:radians(178)},enemies:[{id:'same-visible',position:{x:30*Math.cos(a),y:30*Math.sin(a)},attack:'idle'}]});
    const r=await f.invoke();assert.equal(r.status,'allowed');assert.equal(r.segments.length,0);assert(Math.abs(r.finalCheck.errorDegrees-4)<1e-9);
  });
  await check('25degree threshold separates24.9999 from25.0001 degrees',async()=>{
    for(const [angle,turns]of[[24.9999,0],[25.0001,1]]){
      const f=fixture({state:{facing:radians(angle)}}),r=await f.invoke();assert.equal(r.status,'allowed');assert.equal(r.segments.length,turns);
    }
  });
  await check('pursuer includes37px and excludes37.0001px; cornered excludes40px',async()=>{
    for(const [context,distance,allowed]of[['visible-pursuer',37,true],['visible-pursuer',37.0001,false],['cornered',39.9999,true],['cornered',40,false]]){
      const f=fixture({state:{facing:0},enemies:[{id:'same-visible',position:{x:distance,y:0},attack:'idle'}]});
      const r=await f.invoke({context,maxDistance:context==='cornered'?40:37,minimumHp:context==='cornered'?30:45});
      assert.equal(r.status,allowed?'allowed':'abandoned');assert.equal(spaces(f).length,Number(allowed));
    }
  });
  await check('a remembered or absent target never switches to a different visible enemy',async()=>{
    const f=fixture({enemies:[{id:'different-visible',position:{x:10,y:0},attack:'idle'}]}),r=await f.invoke();
    assert.equal(r.reason,'target-no-longer-visible');assert.equal(downs(f).length,0);
  });
  await check('both real enemy windup and strike phases forbid direction and Space input',async()=>{
    for(const attack of['windup','strike']){
      const f=fixture({enemies:[{id:'same-visible',position:{x:30,y:0},attack}]}),r=await f.invoke();
      assert.equal(r.reason,'visible-attack-phase');assert.equal(downs(f).length,0);
    }
  });
  for(const change of['hidden','range','strike'])await check(`same target becomes${change} after a turn: release and omit Space`,async()=>{
    const f=fixture({onWait:({setEnemies})=>setEnemies(change==='hidden'?[]:[{id:'same-visible',position:{x:change==='range'?38:30,y:0},attack:change==='strike'?'strike':'idle'}])});
    const r=await f.invoke();assert.equal(r.status,'abandoned');assert.equal(r.segments.length,1);assert.equal(spaces(f).length,0);assert.equal(f.keys.size,0);
  });
  await check('locked facing exhausts exactly three requested segments then abandons without Space',async()=>{
    const f=fixture({lockFacing:true}),r=await f.invoke();assert.equal(r.status,'abandoned');assert.equal(r.reason,'angle-not-aligned');
    assert.equal(r.segments.length,3);assert.equal(r.turnInputMs,180);assert.equal(spaces(f).length,0);assert.equal(f.keys.size,0);
  });
  await check('asynchronous held-key reads may exceed180actual ms but are honestly bounded by the whole1000ms clock',async()=>{
    const f=fixture({onState:({keys,advance})=>{if([...keys].some(key=>'wasd'.includes(key)))advance(20);}}),r=await f.invoke();
    assert.equal(r.status,'allowed');assert.equal(r.turnInputMs,120);
    const segmentElapsed=r.segments.reduce((sum,s)=>sum+s.endedElapsedMs-s.startedElapsedMs,0);
    assert.equal(segmentElapsed,200);assert.equal(r.elapsedMs,260);assert.equal(r.withinTimeBound,true);assert.equal(f.keys.size,0);
    return{requestedTurnMs:r.turnInputMs,measuredSegmentElapsedMs:segmentElapsed,wholeActionElapsedMs:r.elapsedMs,semantics:FACING_INPUT_DURATION_SEMANTICS};
  });
  await check('a key-down stall stops before issuing its wait; no phantom requested duration is counted',async()=>{
    const f=fixture({onDown:({advance})=>advance(700)}),r=await f.invoke();assert.equal(r.status,'abandoned');assert.equal(r.reason,'game-time-budget');
    assert.equal(r.turnInputMs,0);assert.equal(f.events.filter(e=>e.type==='wait').length,0);assert.equal(spaces(f).length,0);assert.equal(f.keys.size,0);
  });
  await check('a diagonal first-key stall stops the second key and always releases the first',async()=>{
    const f=fixture({enemies:[{id:'same-visible',position:{x:22,y:22},attack:'idle'}],onDown:({advance})=>advance(600)}),r=await f.invoke();
    assert.equal(r.status,'abandoned');assert.deepEqual(downs(f).map(e=>e.key),['d']);assert.equal(r.turnInputMs,0);assert.equal(f.keys.size,0);
  });
  await check('an input await beyond1000ms is failed evidence with no subsequent Space',async()=>{
    const f=fixture({onDown:({advance})=>advance(1001)}),r=await f.invoke();assert.equal(r.status,'failed');assert.equal(r.withinTimeBound,false);
    assert.equal(r.maxObservedElapsedMs,1001);assert.equal(downs(f).length,1);assert.equal(spaces(f).length,0);assert.equal(f.keys.size,0);
  });
  await check('a return-route read beyond1000ms is failed before any keyboard input',async()=>{
    const f=fixture({returnBudgetStopped:({advance})=>{advance(1001);return false;}}),r=await f.invoke();
    assert.equal(r.status,'failed');assert.equal(r.withinTimeBound,false);assert.equal(downs(f).length,0);
  });
  await check('a return reserve stop after the first turn forbids Space',async()=>{
    const f=fixture({returnBudgetStopped:({state})=>state.elapsedMs>=10060}),r=await f.invoke();
    assert.equal(r.status,'abandoned');assert.equal(r.reason,'return-reserve-threshold');assert.equal(r.turnInputMs,60);assert.equal(spaces(f).length,0);
  });
  await check('Space cleanup is included: exactly1000ms passes,1000.001ms is failed',async()=>{
    for(const [extra,valid]of[[940,true],[940.001,false]]){
      let delayed=false;const f=fixture({state:{facing:0},onUp:({advance},key)=>{if(key==='Space'&&!delayed){delayed=true;advance(extra);}}});
      const r=await f.invoke();assert.equal(r.status,valid?'allowed':'failed');assert.equal(r.withinTimeBound,valid);assert.equal(f.keys.size,0);
      assert(Math.abs(r.elapsedMs-(60+extra))<1e-8);
    }
  });
  await check('permanent release failure retains a failed receipt and cannot claim all keys released',async()=>{
    const f=fixture({onUp:()=>{throw Error('injected release error');}}),r=await f.invoke();
    assert.equal(r.status,'failed');assert.equal(r.releasedAllTrackedKeys,false);assert.equal(f.keys.size,1);assert(r.errors.length>0);
  });
  await check('real HP45 boundary, HP30 floor and chaos120 ceiling are preserved',async()=>{
    for(const [state,allowed]of[[{hp:45,facing:0},true],[{hp:44.9999,facing:0},false],[{hp:30,facing:0},false],[{chaos:120,facing:0},false]]){
      const f=fixture({state}),r=await f.invoke();assert.equal(r.status,allowed?'allowed':'abandoned');assert.equal(spaces(f).length,Number(allowed));
    }
  });
  await check('ended, inactive and paused scenes never receive input',async()=>{
    for(const state of[{ended:true},{active:false},{paused:true}]){
      const f=fixture({state}),r=await f.invoke();assert.equal(r.status,'abandoned');assert.equal(downs(f).length,0);
    }
  });
  await check('590ms elapsed plus60ms Space and100ms reserve stops before Space',async()=>{
    let delayed=false;const f=fixture({state:{facing:0},onObserve:({advance})=>{if(!delayed){advance(590);delayed=true;}}}),r=await f.invoke();
    assert.equal(r.status,'abandoned');assert.equal(r.reason,'game-time-budget');assert.equal(downs(f).length,0);
  });
  await check('nonfinite final clock and backward final clock are failed even after Space input',async()=>{
    for(const elapsedMs of[NaN,9999]){
      const f=fixture({state:{facing:0},onUp:({state},key)=>{if(key==='Space')state.elapsedMs=elapsedMs;}}),r=await f.invoke();
      assert.equal(r.status,'failed');assert.equal(r.withinTimeBound,false);assert.equal(f.keys.size,0);
    }
  });
  assert.equal(hash(moduleFile),moduleSha256,'Executor bytes changed during independent checks');
  const report={schema:'coh.qa.policy17-facing-boundaries-independent.v1',status:results.every(r=>r.status==='pass')?'pass':'fail',
    candidate:{path:candidatePath,sha256:hash(candidatePath)},executor:{path:moduleFile,sha256:moduleSha256},policy:FACING_POLICY,
    semantics:FACING_INPUT_DURATION_SEMANTICS,productionModel:{turnRate:GAME_CONSTANTS.PLAYER.FACING_TURN_RATE,
      math:{path:'src/utils/math.ts',sha256:hash('src/utils/math.ts')},constants:{path:'src/config/constants.ts',sha256:hash('src/config/constants.ts')},
      driver:{path:'tools/qa/i27-journey-driver.mjs',sha256:hash('tools/qa/i27-journey-driver.mjs')},
      limitation:'Mock keyboard and public observation fixture; position held at a blocked point while actual production angle stepping responds to held directional input. This is executor verification, not a browser run or gameplay qualification.'},
    counts:{passed:results.filter(r=>r.status==='pass').length,failed:results.filter(r=>r.status==='fail').length},results};
  const output=path.join(own,'boundary-review.json');assert(!fs.existsSync(output),'Preserve earlier receipts: select a fresh audit script/output for a rerun');
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,sha256:hash(output),status:report.status,...report.counts}));
  if(report.status!=='pass')process.exitCode=1;
}finally{fs.rmSync(folder,{recursive:true,force:true});}
