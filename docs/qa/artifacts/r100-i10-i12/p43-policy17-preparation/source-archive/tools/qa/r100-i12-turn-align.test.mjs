import assert from 'node:assert/strict';
import {stepAngleToward,degToRad} from '../../src/utils/math.ts';
import {GAME_CONSTANTS} from '../../src/config/constants.ts';
import {createBoundedFacingInput,facingGeometry,facingInputKeys,FACING_POLICY} from './r100-i12-turn-align.mjs';

const checks=[];
function fixture(options={}) {
  const state={scene:'rift',active:true,paused:false,ended:false,hp:100,chaos:20,elapsedMs:10000,
    position:{x:0,y:0},facing:options.facing??Math.PI};
  const enemy={id:'visible',position:{x:options.distance??30,y:0},attack:'idle'};
  const keys=new Set(),events=[],records=[];
  function tick(ms) {
    state.elapsedMs+=ms;
    const x=(keys.has('d')?1:0)-(keys.has('a')?1:0),y=(keys.has('s')?1:0)-(keys.has('w')?1:0);
    if((x||y)&&!options.lockedFacing)state.facing=stepAngleToward(state.facing,Math.atan2(y,x),degToRad(GAME_CONSTANTS.PLAYER.FACING_TURN_RATE)*ms/1000);
  }
  const page={keyboard:{
    async down(key){events.push({event:'actual-down',key});keys.add(key);await options.onDown?.({state,enemy,keys,tick,key});},
    async up(key){events.push({event:'actual-up',key});await options.onUp?.({state,enemy,keys,tick,key});keys.delete(key);},
  },async waitForTimeout(ms){tick(ms);await options.onWait?.({state,enemy,keys,tick,ms});}};
  const driver={
    async state(){await options.onState?.({state,enemy,keys,tick});return structuredClone(state);},
    log:event=>events.push(structuredClone(event)),
    async press(key,delay){events.push({event:'key',key,delay});await page.keyboard.down(key);await page.waitForTimeout(delay);await page.keyboard.up(key);},
  };
  async function observe(){await options.onObserve?.({state,enemy,keys,tick});return {...structuredClone(state),enemies:options.hidden?[]:[structuredClone(enemy)]};}
  const align=createBoundedFacingInput({page,driver,observe,
    returnBudgetStopped:async state=>options.returnStop?.(state)??false,onRecord:record=>records.push(record)});
  return{state,enemy,keys,events,records,align};
}
const request={targetId:'visible',context:'visible-pursuer',triggerElapsedMs:10000,maxDistance:37,minimumHp:45};
async function check(name,work){await work();checks.push(name);}
await check('real production angle helper reaches180 degrees in at most three60ms direction segments',async()=>{
  const f=fixture(),record=await f.align(request);assert.equal(record.status,'allowed');
  assert.equal(record.segments.length,3);assert.equal(record.turnInputMs,180);assert(record.finalCheck.errorDegrees<=25);
  assert.equal(record.spaceInput.issued,true);assert.equal(f.events.filter(row=>row.event==='key'&&row.key==='Space').length,1);
  assert.equal(record.elapsedMs,240);assert.equal(f.keys.size,0);assert.equal(record.releasedAllTrackedKeys,true);
  const log=f.events.find(row=>row.event==='bounded-melee-facing-check');const {event,...copy}=log;assert.deepEqual(copy,record);
});
await check('angle25 inclusive,25.01 excluded and +/-pi wraps on the shortest arc',async()=>{
  const facts={hp:100,chaos:20,ended:false,elapsedMs:0,position:{x:0,y:0},facing:degToRad(25),enemies:[{id:'v',position:{x:30,y:0},attack:'idle'}]};
  assert.equal(facingGeometry(facts,'v',37).aligned,true);
  assert.equal(facingGeometry({...facts,facing:degToRad(25.01)},'v',37).aligned,false);
  const wrapped={...facts,facing:degToRad(-179),enemies:[{id:'v',position:{x:Math.cos(degToRad(179))*30,y:Math.sin(degToRad(179))*30},attack:'idle'}]};
  assert(Math.abs(facingGeometry(wrapped,'v',37).errorDegrees-2)<1e-10);
});
await check('eight-direction input quantization is explicit and does not assign actor facing',async()=>{
  for(let n=0;n<8;n++){
    const angle=n*Math.PI/4,keys=facingInputKeys({player:{pos:{x:0,y:0}},enemy:{pos:{x:Math.cos(angle)*30,y:Math.sin(angle)*30}}});
    const x=(keys.includes('d')?1:0)-(keys.includes('a')?1:0),y=(keys.includes('s')?1:0)-(keys.includes('w')?1:0);
    assert(Math.abs(Math.atan2(Math.sin(Math.atan2(y,x)-angle),Math.cos(Math.atan2(y,x)-angle)))<1e-12);
  }
});
await check('original pursuer range includes37; cornered excludes40',async()=>{
  assert.equal((await fixture({facing:0,distance:37}).align(request)).status,'allowed');
  assert.equal((await fixture({facing:0,distance:37.001}).align(request)).status,'abandoned');
  const cornered={...request,context:'cornered',maxDistance:40,minimumHp:30};
  assert.equal((await fixture({facing:0,distance:40}).align(cornered)).status,'abandoned');
  assert.equal((await fixture({facing:0,distance:39.999}).align(cornered)).status,'allowed');
});
await check('same currently visible target required; disappearance cannot redirect Space',async()=>{
  const f=fixture({hidden:true,facing:0});const record=await f.align(request);
  assert.equal(record.reason,'target-no-longer-visible');assert.equal(f.events.filter(row=>row.event==='key').length,0);
});
for(const phase of ['windup','strike'])await check(`currently visible ${phase} abandons Space`,async()=>{
  const f=fixture({facing:0});f.enemy.attack=phase;const record=await f.align(request);
  assert.equal(record.reason,'visible-attack-phase');assert.equal(record.spaceInput,null);
});
await check('phase/range changes after a turn are reobserved before Space',async()=>{
  const f=fixture({onWait:({enemy})=>{enemy.attack='strike';}});const record=await f.align(request);
  assert.equal(record.status,'abandoned');assert.equal(record.reason,'visible-attack-phase');assert.equal(f.keys.size,0);
  assert.equal(f.events.filter(row=>row.event==='key').length,0);
});
await check('public health/chaos/ended and original45 minimum remain strict',async()=>{
  for(const value of [{hp:30},{hp:44},{chaos:120},{ended:true},{active:false},{paused:true}]){
    const f=fixture({facing:0});Object.assign(f.state,value);const record=await f.align(request);
    assert.equal(record.status,'abandoned');assert.equal(record.spaceInput,null);assert.equal(f.keys.size,0);
  }
  const f=fixture({facing:0});f.state.hp=45;const record=await f.align(request);assert.equal(record.status,'allowed');
  assert.equal(record.finalCheck.hp,45);assert.equal(record.finalCheck.chaos,20);assert.equal(record.finalCheck.ended,false);
});
await check('known return-budget stop prevents the facing input entirely',async()=>{
  const f=fixture({returnStop:()=>true});const record=await f.align(request);assert.equal(record.reason,'return-reserve-threshold');
  assert.equal(f.events.filter(row=>row.event==='actual-down').length,0);
});
await check('locked real facing consumes at most original three segments and never buffered Space',async()=>{
  const f=fixture({lockedFacing:true}),record=await f.align(request);assert.equal(record.reason,'angle-not-aligned');
  assert.equal(record.segments.length,3);assert.equal(record.turnInputMs,180);assert.equal(record.spaceInput,null);
});
await check('before an incomplete action margin, no subsequent key-down may start',async()=>{
  let first=true;const f=fixture({onObserve:({tick})=>{if(first){first=false;tick(650);}}});
  const record=await f.align(request);assert.equal(record.reason,'game-time-budget');assert.equal(f.events.filter(row=>row.event==='actual-down').length,0);
});
await check('real asynchronous overrun above1000 fails and releases keys before any Space',async()=>{
  const f=fixture({onDown:({tick})=>tick(1001)}),record=await f.align(request);
  assert.equal(record.status,'failed');assert.equal(record.withinTimeBound,false);assert.equal(record.turnInputMs,0);
  assert(record.maxObservedElapsedMs>1000);assert.equal(record.spaceInput,null);assert.equal(f.keys.size,0);
});
await check('1000ms actual boundary is inclusive;1000.001ms is failed even without input',async()=>{
  for(const [ms,within] of [[1000,true],[1000.001,false]]){
    let first=true;const f=fixture({onObserve:({tick})=>{if(first){first=false;tick(ms);}}});const record=await f.align(request);
    assert.equal(record.withinTimeBound,within);assert.equal(record.status,within?'abandoned':'failed');
  }
});
await check('180ms is issued wait requests; actual segment latency remains visible inside whole1000ms',async()=>{
  const f=fixture({onDown:({tick,key})=>{if(key!=='Space')tick(20);},onState:({tick,keys})=>{if(keys.size)tick(15);}});
  const record=await f.align(request);assert.equal(record.status,'allowed');assert(record.turnInputMs<=180);
  assert(record.segments.reduce((n,row)=>n+row.endedElapsedMs-row.startedElapsedMs,0)>180);
  assert(record.elapsedMs<=1000);assert.equal(f.keys.size,0);
});
await check('key-release failure cannot qualify or claim released keys',async()=>{
  const f=fixture({onUp:({key})=>{if(key==='d')throw Error('release refused');}}),record=await f.align(request);
  assert.equal(record.status,'failed');assert.equal(record.releasedAllTrackedKeys,false);assert(record.errors.length>0);
});
console.log(JSON.stringify({status:'pass',checks:checks.length,policy:FACING_POLICY,results:checks,
  limitation:'Finite deterministic guard/real pure rotation tests. No browser, gameplay success, guaranteed hit or runtime timing claim.'},null,2));
