import assert from 'node:assert/strict';
import {LastLightGait,lastLightWalkLeg,LAST_LIGHT_STRIDE_METRES,LAST_LIGHT_WALK_FRAMES,LAST_LIGHT_SETTLE_STAGES,LAST_LIGHT_SETTLE_SECONDS,LAST_LIGHT_IDLE_FRAMES} from '../../src/art/last-light-gait';
import {actorShadowCapsules,actorLampAnchor} from '../../docs/art/demos/purification-last-light/actor';
const epsilon=(a:number,b:number,message:string):void=>assert(Math.abs(a-b)<1e-8,`${message}: ${a} vs ${b}`);
let plantedSamples=0,recoverySamples=0;
for(let i=0;i<1200;i++){
 const cycle=i/1200,legs=[lastLightWalkLeg(cycle,false),lastLightWalkLeg(cycle,true)];
 assert(legs.some(leg=>leg.grounded),'A walk must never have an airborne flight phase');
 for(const [side,leg]of legs.entries()){
  epsilon(Math.hypot(...leg.hip.map((n,j)=>n-leg.knee[j]!)),.335,'Thigh length');
  epsilon(Math.hypot(...leg.ankle.map((n,j)=>n-leg.knee[j]!)),.31,'Shin length');
  assert(leg.footLift>=0&&leg.footLift<=.105001);
  const next=lastLightWalkLeg(cycle+.00001,side===1);
  if(leg.grounded&&next.grounded&&Math.abs(next.footZ-leg.footZ)<.01){
   epsilon(leg.footZ+cycle*LAST_LIGHT_STRIDE_METRES,next.footZ+(cycle+.00001)*LAST_LIGHT_STRIDE_METRES,'Stance foot must stay fixed in world');plantedSamples++;
  }
 }
}
// Every baked walk phase must recover its feet, not merely lower them while
// freezing a stride. A gathering foot lifts while the other carries weight.
for(let frame=0;frame<LAST_LIGHT_WALK_FRAMES;frame++)for(let i=0;i<=100;i++){
 const cycle=frame/LAST_LIGHT_WALK_FRAMES,t=i/100;
 const legs=[lastLightWalkLeg(cycle,false,t),lastLightWalkLeg(cycle,true,t)];
 assert(legs.some(l=>l.grounded),'Recovery must keep a supporting foot');
 legs.forEach((leg,side)=>{
  const next=lastLightWalkLeg(cycle,side===1,Math.min(1,t+.00001));
  if(leg.grounded&&next.grounded)epsilon(leg.footZ,next.footZ,'A grounded foot cannot be dragged during recovery');
  if(i===100){epsilon(leg.footZ,side===1?.080:-.075,'Recovered foot reaches authored rest stance');epsilon(leg.footLift,0,'Recovered sole reaches floor');}
 });recoverySamples++;
}
const walk=(ticks:number)=>{const gait=new LastLightGait();let last=gait.update([0,0,0],0,false);for(let i=1;i<=ticks;i++)last=gait.update([0,0,i/ticks*2.1],1/ticks,false);return last;};
const slow=walk(30),fast=walk(120),phaseDifference=Math.abs(slow.cycle-fast.cycle);epsilon(Math.min(phaseDifference,1-phaseDifference),0,'Frame-rate independence');assert.equal(slow.frame,fast.frame);
for(let phase=0;phase<12;phase++){
 const gait=new LastLightGait();gait.update([0,0,0],0,false);
 const distance=(((phase/12-1/3+1)%1)||1)*LAST_LIGHT_STRIDE_METRES;
 const position=[0,0,distance] as const,moving=gait.update(position,.05,false);
 assert.equal(moving.frame,phase);
 const begin=gait.update(position,1/60,false);
 assert.equal(begin.pose,'walk');assert.equal(begin.frame,LAST_LIGHT_WALK_FRAMES+phase*LAST_LIGHT_SETTLE_STAGES);
 let stopped=begin;for(let i=0;i<Math.ceil(LAST_LIGHT_SETTLE_SECONDS*60);i++)stopped=gait.update(position,1/60,false);
 assert.equal(stopped.pose,'idle','Every stop must exit walking in a bounded time');assert.equal(stopped.frame,0);assert.equal(stopped.moving,false);
 epsilon(stopped.cycle,moving.cycle,'Wall pressure/no displacement cannot advance stride');
 const idleFrames=new Set<number>();for(let i=0;i<240;i++){const idle=gait.update(position,1/60,false);assert.equal(idle.pose,'idle');idleFrames.add(idle.frame);}
 assert.equal(idleFrames.size,LAST_LIGHT_IDLE_FRAMES,'Independent idle loop must progress while stationary');
 const paused=gait.update(position,0,false);assert.equal(gait.update(position,0,false).frame,paused.frame);
 assert.equal(gait.update([0,0,distance+.02],1/60,false).pose,'walk','Walking can restart from idle');
}
// A short tap and a restart during gathering must never get trapped in idle.
const tap=new LastLightGait();tap.update([0,0,0],0,false);tap.update([.005,0,0],.016,false);tap.update([.005,0,0],.1,false);assert.equal(tap.update([.015,0,0],.016,false).moving,true);
const seatGait=new LastLightGait();seatGait.update([4.9,0,5.95],.016,true);
const approach=[5.371919378928117,.05585438262346214,4.901290269048628] as const;
const stood=seatGait.update(approach,.016,false);assert.equal(stood.pose,'idle');assert.equal(stood.moving,false);epsilon(stood.cycle,1/3,'Seat anchor restoration cannot advance stride');
const resumed=seatGait.update([approach[0],approach[1],approach[2]+.02],.016,false);assert.equal(resumed.pose,'walk');epsilon(resumed.cycle,1/3+.02/LAST_LIGHT_STRIDE_METRES,'First real step after standing advances normally');
assert.equal(seatGait.update([20,0,20],.016,false).pose,'idle','Teleport resets to standing');
for(let direction=0;direction<8;direction++)for(let frame=0;frame<12;frame++){
 const yaw=direction*Math.PI/4,phase=frame/12*Math.PI*2,rig=actorShadowCapsules('walk',yaw,phase),base=actorShadowCapsules('walk',0,phase);
 assert.equal(rig.length,11);
 for(let i=0;i<rig.length;i++)for(const endpoint of[0,3]){
  epsilon(rig[i]![endpoint]!,base[i]![endpoint]!*Math.cos(yaw)+base[i]![endpoint+2]!*Math.sin(yaw),'Rig X follows facing');
  epsilon(rig[i]![endpoint+2]!,-base[i]![endpoint]!*Math.sin(yaw)+base[i]![endpoint+2]!*Math.cos(yaw),'Rig Z follows facing');
 }
 assert.deepEqual(actorShadowCapsules('walk',yaw,phase,1),actorShadowCapsules('idle',yaw,0),'Final recovery shadow matches idle');
 assert.deepEqual(actorLampAnchor([0,0,0],yaw,0,phase,1),actorLampAnchor([0,0,0],yaw,0),'Final recovery lamp matches idle');
}
console.log(JSON.stringify({status:'PASS',plantedSamples,recoverySamples,checks:['world-locked stance','fixed walk bone lengths','supported foot recovery','12-phase stop to independent breathing idle','distance phase and collision stop','short tap/restart','seat restoration','pose-matched shadow and lamp']},null,2));
