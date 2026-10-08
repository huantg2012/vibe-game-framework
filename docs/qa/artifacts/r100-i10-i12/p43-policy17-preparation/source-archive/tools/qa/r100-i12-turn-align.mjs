/** Policy17: actual input alignment at the two existing defensive Space sites.
 * Reads only the player's current angle and currently visible target geometry.
 * No actor setters, hidden AI state, new swing opportunities, or search retries. */
import assert from 'node:assert/strict';

export const FACING_POLICY = Object.freeze({maxSegments:3, maxSegmentInputMs:60, maxTurnInputMs:180,
  maxElapsedMs:1000, earlyStopMs:750, actionReserveMs:100, maxErrorDegrees:25, spaceInputMs:60});
export const FACING_INPUT_DURATION_SEMANTICS = 'turnInputMs sums the direction-key wait requests actually issued (each<=60ms,total<=180ms). Segment elapsed clocks include input dispatch/read/release latency and are not claimed<=180ms. The whole alignment, Space and cleanup must be<=1000ms actual game time.';

export function facingGeometry(facts,targetId,maxDistance) {
  const publicState={hp:facts.hp,chaos:facts.chaos,ended:facts.ended};
  const enemy=facts.enemies.find(row=>row.id===targetId);
  if(!enemy)return{...publicState,targetId,visible:false,observedElapsedMs:facts.elapsedMs,player:{pos:facts.position,facing:facts.facing},enemy:null};
  const dx=enemy.position.x-facts.position.x,dy=enemy.position.y-facts.position.y,bearing=Math.atan2(dy,dx);
  // Normalize machine rounding at the inclusive25 degree boundary; precision
  // is ten decimal places, far below any observable facing difference.
  const errorDegrees=Number((Math.abs(Math.atan2(Math.sin(bearing-facts.facing),Math.cos(bearing-facts.facing)))*180/Math.PI).toFixed(10));
  return{...publicState,targetId,visible:true,observedElapsedMs:facts.elapsedMs,player:{pos:{...facts.position},facing:facts.facing},
    enemy:{id:enemy.id,pos:{...enemy.position},attack:enemy.attack},bearing,errorDegrees,distance:Math.hypot(dx,dy),
    withinRange:maxDistance===37?Math.hypot(dx,dy)<=37:Math.hypot(dx,dy)<40,aligned:errorDegrees<=FACING_POLICY.maxErrorDegrees,
    phaseAllowed:!['windup','strike'].includes(enemy.attack)};
}

export function facingInputKeys(check) {
  const dx=check.enemy.pos.x-check.player.pos.x,dy=check.enemy.pos.y-check.player.pos.y,keys=[];
  if(Math.abs(dx)>.42*Math.abs(dy))keys.push(dx>0?'d':'a');
  if(Math.abs(dy)>.42*Math.abs(dx))keys.push(dy>0?'s':'w');
  return keys;
}

class FacingStop extends Error {}

export function createBoundedFacingInput({page,driver,observe,returnBudgetStopped,onRecord}) {
  let index=0;
  return async function alignAndSwing({targetId,context,triggerElapsedMs,maxDistance,minimumHp}) {
    assert(['visible-pursuer','cornered'].includes(context));
    assert.equal(maxDistance,context==='visible-pursuer'?37:40);
    assert.equal(minimumHp,context==='visible-pursuer'?45:30);
    const start=await driver.state(),held=new Set();
    assert(start.scene==='rift'&&Number.isFinite(start.elapsedMs));
    const record={index:index++,targetId,context,triggerElapsedMs,maxDistance,minimumHp,startedElapsedMs:start.elapsedMs,
      endedElapsedMs:null,maxObservedElapsedMs:0,status:'abandoned',reason:null,segments:[],turnInputMs:0,
      finalCheck:null,spaceInput:null,releasedAllTrackedKeys:false,withinTimeBound:false,errors:[]};
    let stopped=null;
    function clock(state,cost=0,{eligibility=true}={}) {
      assert(state.scene==='rift'&&Number.isFinite(state.elapsedMs),'Actual Rift clock required');
      const elapsed=state.elapsedMs-record.startedElapsedMs;assert(elapsed>=0,'Clock cannot move backwards');
      record.maxObservedElapsedMs=Math.max(record.maxObservedElapsedMs,elapsed);
      if(!eligibility)return;
      if(stopped)throw new FacingStop(stopped);
      let reason=null;
      if(state.ended||!state.active||state.paused)reason='run-stopped';
      else if(state.hp<=30||state.hp<minimumHp||state.chaos>=120)reason='health-or-chaos-limit';
      else if(elapsed+cost+FACING_POLICY.actionReserveMs>=FACING_POLICY.earlyStopMs)reason='game-time-budget';
      if(reason){stopped=reason;throw new FacingStop(reason);}
    }
    const stop=reason=>{stopped=reason;throw new FacingStop(reason);};
    async function check(cost=0) {
      const state=await driver.state();clock(state,cost);
      if(await returnBudgetStopped(state))stop('return-reserve-threshold');
      clock(await driver.state(),cost);
      const facts=await observe();
      clock(await driver.state(),cost);
      record.finalCheck=facingGeometry(facts,targetId,maxDistance);
      if(facts.ended||facts.hp<=30||facts.hp<minimumHp||facts.chaos>=120)stop('health-chaos-or-ended');
      if(!record.finalCheck.visible)stop('target-no-longer-visible');
      if(!record.finalCheck.withinRange)stop('target-outside-original-range');
      if(!record.finalCheck.phaseAllowed)stop('visible-attack-phase');
      return record.finalCheck;
    }
    async function release(key) {await page.keyboard.up(key);held.delete(key);}
    try {
      let geometry=await check();
      while(!geometry.aligned&&record.segments.length<FACING_POLICY.maxSegments) {
        geometry=await check(FACING_POLICY.maxSegmentInputMs);
        if(geometry.aligned)break;
        const keys=facingInputKeys(geometry);if(!keys.length)stop('no-direction-input');
        const before=await driver.state();clock(before,FACING_POLICY.maxSegmentInputMs);
        const segment={index:record.segments.length,keys,requestedMs:FACING_POLICY.maxSegmentInputMs,
          startedElapsedMs:before.elapsedMs,endedElapsedMs:null,before:geometry,released:false};
        record.segments.push(segment);
        driver.log({event:'facing-turn-input',facingCheckIndex:record.index,...segment});
        try {
          for(const key of keys){clock(await driver.state(),segment.requestedMs);held.add(key);await page.keyboard.down(key);clock(await driver.state(),segment.requestedMs);}
          // Count only requests actually dispatched; key-down errors cannot
          // fabricate a completed wait or consume a phantom input duration.
          record.turnInputMs+=segment.requestedMs;segment.waitIssued=true;
          assert(record.turnInputMs<=FACING_POLICY.maxTurnInputMs);
          await page.waitForTimeout(segment.requestedMs);clock(await driver.state());
        } finally {
          for(const key of keys)await release(key);
          const after=await driver.state();clock(after,0,{eligibility:false});
          segment.endedElapsedMs=after.elapsedMs;segment.released=keys.every(key=>!held.has(key));
          driver.log({event:'facing-turn-input-end',facingCheckIndex:record.index,...segment});
        }
        geometry=await check();
      }
      geometry=await check(FACING_POLICY.spaceInputMs);
      if(!geometry.aligned)stop('angle-not-aligned');
      // Last geometry read is the sole Space permission; no new target is chosen.
      const beforeSpace=await driver.state();clock(beforeSpace,FACING_POLICY.spaceInputMs);
      record.spaceInput={requestedMs:FACING_POLICY.spaceInputMs,startedElapsedMs:beforeSpace.elapsedMs,
        endedElapsedMs:null,issued:false,finalCheck:geometry};
      driver.log({event:'facing-space-input',facingCheckIndex:record.index,...record.spaceInput});
      held.add('Space');record.spaceInput.issued=true;
      try {await driver.press('Space',FACING_POLICY.spaceInputMs);}
      finally {await release('Space');}
      const afterSpace=await driver.state();clock(afterSpace,0,{eligibility:false});
      record.spaceInput.endedElapsedMs=afterSpace.elapsedMs;
      driver.log({event:'facing-space-input-end',facingCheckIndex:record.index,...record.spaceInput});
      record.status='allowed';record.reason='current-visible-target-aligned';
    } catch(error) {
      if(error instanceof FacingStop){record.status='abandoned';record.reason=error.message;}
      else {record.status='failed';record.errors.push(String(error.stack??error));}
    } finally {
      for(const key of [...held])try {await release(key);}catch(error){record.errors.push(`Failed release ${key}: ${error}`);}
      try {
        const end=await driver.state();clock(end,0,{eligibility:false});record.endedElapsedMs=end.elapsedMs;
        record.elapsedMs=end.elapsedMs-record.startedElapsedMs;
        record.withinTimeBound=record.elapsedMs>=0&&record.maxObservedElapsedMs<=FACING_POLICY.maxElapsedMs;
        if(!record.withinTimeBound)record.errors.push(`Facing check exceeded1000ms: ${record.maxObservedElapsedMs}`);
      } catch(error){record.errors.push(`Final facing clock: ${error}`);}
      record.releasedAllTrackedKeys=held.size===0;
      if(!record.releasedAllTrackedKeys)record.errors.push('Held facing inputs remain unreleased');
      if(record.errors.length)record.status='failed';
      onRecord(record);driver.log({event:'bounded-melee-facing-check',...record});
    }
    return record;
  };
}
