import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createJourneyDriver } from './i27-journey-driver.mjs';
import { RECHECK_POLICY, claimObservedSearchRecheck, createRecheckBudget, guardRecheckDriver } from './r100-i12-recheck-budget.mjs';

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'coh-policy16-boundary-'));
const checks = [];
const meta = {targetId:'observed',reason:'visible-opponent-too-close',originalSearchIndex:0,triggerElapsedMs:10000};
function fixture({onWait,onDown,onUp,returnBudgetStopped}={}) {
  const state = {scene:'rift',active:true,paused:false,ended:false,hp:100,chaos:20,elapsedMs:10000,
    nodes:[{id:'observed',collected:false},{id:'other',collected:false}]};
  const events = [], keys = new Set(), logs = [];
  const snapshot = async () => structuredClone(state);
  const rawPage = {
    keyboard:{
      async down(key){events.push(['down',key,state.elapsedMs]);keys.add(key);await onDown?.(state,key);},
      async up(key){events.push(['up',key,state.elapsedMs]);await onUp?.(state,key);keys.delete(key);},
      async press(key,{delay=0}={}){await this.down(key);state.elapsedMs+=delay;await this.up(key);},
    },
    async waitForTimeout(ms){events.push(['wait',ms,state.elapsedMs]);state.elapsedMs+=ms;await onWait?.(state,ms);},
    evaluate:snapshot,
  };
  const budget=createRecheckBudget(rawPage,snapshot,row=>logs.push(row),returnBudgetStopped);
  const driver=guardRecheckDriver(createJourneyDriver(budget.page,folder),snapshot,budget);
  return {state,events,keys,logs,budget,driver};
}
async function check(name,work){await work();checks.push(name);}
try {
  await check('single claim per whole trip, known non-entry target and original one-pickup limit',async()=>{
    const value={decision:{attempted:false,reason:'visible-opponent-too-close'},target:{id:'observed',pos:{x:321,y:0}},
      observedIds:['observed'],entry:{x:0,y:0},state:{ended:false,hp:100,chaos:0},pickupCount:0,pickupLimit:1};
    for(const replacement of [{observedIds:[]},{target:{id:'observed',pos:{x:320,y:0}}},{pickupCount:1},
      {decision:{attempted:true,reason:'visible-opponent-too-close'}},{decision:{attempted:false,reason:'other'}},
      {state:{ended:true,hp:100,chaos:0}},{state:{ended:false,hp:30,chaos:0}},{state:{ended:false,hp:100,chaos:120}}])
      assert.equal(claimObservedSearchRecheck({used:false},{...value,...replacement}),false);
    const trip={used:false};assert.equal(claimObservedSearchRecheck(trip,value),true);
    assert.equal(claimObservedSearchRecheck(trip,{...value,target:{id:'second',pos:{x:600,y:0}},observedIds:['second']}),false);
  });
  await check('nested real driver holds/presses and direct E channel include actual game time',async()=>{
    const f=fixture();
    const result=await f.budget.run(meta,async()=>{
      await f.driver.hold(['w','d'],400);await f.driver.press('Space',60);
      await f.budget.page.keyboard.down('e');await f.budget.page.waitForTimeout(150);
      f.state.nodes[0].collected=true;await f.budget.page.keyboard.up('e');
      return {searchDecision:{attempted:true,reason:'collected'}};
    });
    assert.equal(result.receipt.elapsedMs,645);assert.equal(result.receipt.status,'completed');
    assert.deepEqual(result.receipt.actualCollectedNodeIds,['observed']);assert.equal(result.receipt.withinTimeBound,true);
    assert.equal(result.receipt.releasedAllTrackedKeys,true);assert.equal(f.keys.size,0);
    await assert.rejects(f.budget.run(meta,async()=>{}),/At most one/);
  });
  await check('insufficient time for a complete nested hold prevents its first key-down',async()=>{
    const f=fixture();
    const result=await f.budget.run(meta,async()=>{f.state.elapsedMs+=4450;await f.driver.hold(['d'],400);});
    assert.equal(result.receipt.status,'game-time-budget');assert.equal(f.events.filter(row=>row[0]==='down').length,0);
    assert.equal(result.receipt.elapsedMs,4450);assert.equal(f.keys.size,0);
  });
  await check('deadline during E search releases E and latches stop across caught exceptions',async()=>{
    const f=fixture({onWait:state=>{state.elapsedMs=15001;}});
    const result=await f.budget.run(meta,async()=>{
      await f.budget.page.keyboard.down('e');
      try {await f.budget.page.waitForTimeout(150);} catch {}
      await f.budget.page.keyboard.down('d');
    });
    assert.equal(result.receipt.status,'game-time-budget');assert.equal(result.receipt.elapsedMs,5001);
    assert.equal(result.receipt.searchDecision.attempted,true);assert.deepEqual(f.events.filter(row=>row[0]==='down').map(row=>row[1]),['e']);
    assert.equal(f.keys.size,0);assert.equal(result.receipt.releasedAllTrackedKeys,true);
  });
  await check('async input stall beyond 6000ms is invalid and forbids subsequent dangerous input',async()=>{
    const f=fixture({onDown:state=>{state.elapsedMs=16100;}});
    const result=await f.budget.run(meta,async()=>{await f.budget.page.keyboard.down('e');await f.driver.press('Space');});
    assert.equal(result.receipt.status,'failed');assert.equal(result.receipt.withinTimeBound,false);
    assert.equal(result.receipt.maxObservedElapsedMs,6100);assert(result.receipt.errors.some(error=>error.includes('exceeded6000')));
    assert.equal(f.events.filter(row=>row[0]==='down').length,1);assert.equal(f.keys.size,0);
  });
  for(const [name,change,reason] of [
    ['ended',state=>{state.ended=true;},'run-ended'],
    ['HP30',state=>{state.hp=30;},'return-reserve-threshold'],
    ['chaos120',state=>{state.chaos=120;},'return-reserve-threshold'],
    ['paused',state=>{state.paused=true;},'run-not-active'],
  ])await check(`${name} reached inside caution/input stops before another action`,async()=>{
    const f=fixture({onWait:change});
    const result=await f.budget.run(meta,async()=>{await f.driver.hold(['a'],65);await f.driver.press('q');});
    assert.equal(result.receipt.status,'completed');assert.equal(result.receipt.completionReason,reason);
    assert.equal(f.events.filter(row=>row[0]==='down').length,1);assert.equal(f.keys.size,0);
  });
  await check('known return reserve reached during asynchronous route read prevents input',async()=>{
    const f=fixture({returnBudgetStopped:async state=>state.elapsedMs>=10100});
    const result=await f.budget.run(meta,async()=>{f.state.elapsedMs+=100;await f.driver.press('q');});
    assert.equal(result.receipt.completionReason,'return-reserve-threshold');assert.equal(f.events.length,0);
  });
  await check('route calculation time is included and rechecked after its await',async()=>{
    let f,calls=0;f=fixture({returnBudgetStopped:async()=>{if(++calls===2)f.state.elapsedMs+=6100;return false;}});
    const result=await f.budget.run(meta,async()=>{await f.driver.press('q');});
    assert.equal(result.receipt.status,'failed');assert.equal(result.receipt.elapsedMs,6100);assert.equal(f.events.length,0);
  });
  await check('exception cleanup is measured and retained as a failed supplemental action',async()=>{
    const f=fixture();const result=await f.budget.run(meta,async()=>{await f.budget.page.keyboard.down('d');throw Error('test exception');});
    assert.equal(result.receipt.status,'failed');assert(result.receipt.errors.some(error=>error.includes('test exception')));assert.equal(f.keys.size,0);
  });
  await check('failed key release cannot report all keys released',async()=>{
    const f=fixture({onUp:async()=>{throw Error('release failure');}});
    const result=await f.budget.run(meta,async()=>{await f.budget.page.keyboard.down('e');});
    assert.equal(result.receipt.status,'failed');assert.equal(result.receipt.releasedAllTrackedKeys,false);assert.equal(f.keys.size,1);
  });
  await check('all three stale active checks corrected against the real renderer enum',async()=>{
    const journey=fs.readFileSync(new URL('./r100-i12-recheck-journey.mjs',import.meta.url),'utf8');
    const encounters=fs.readFileSync(new URL('./r100-i12-recheck-encounters.mjs',import.meta.url),'utf8');
    const source=fs.readFileSync(new URL('../../src/entities/form-renderers/form-renderer.ts',import.meta.url),'utf8');
    assert(source.includes("'idle' | 'windup' | 'strike' | 'recover'"));
    assert.equal((journey.match(/enemy\.attack==='strike'/g)??[]).length,1);
    assert.equal((encounters.match(/e\.attack==='strike'/g)??[]).length,2);
    assert(!/\.attack==='active'/.test(journey+encounters));
  });
  console.log(JSON.stringify({status:'pass',checks:checks.length,policy:RECHECK_POLICY,results:checks},null,2));
} finally {fs.rmSync(folder,{recursive:true,force:true});}
