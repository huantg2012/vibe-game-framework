import assert from 'node:assert/strict';
import {LastLightGait,lastLightWalkLeg,LAST_LIGHT_STRIDE_METRES,LAST_LIGHT_WALK_FRAMES} from '../../src/art/last-light-gait';
import {actorShadowCapsules} from '../../docs/art/demos/purification-last-light/actor';

const epsilon=(a:number,b:number,message:string):void=>assert(Math.abs(a-b)<1e-8,`${message}: ${a} vs ${b}`);
let plantedSamples=0;
for(let i=0;i<1200;i++){
 const cycle=i/1200,legs=[lastLightWalkLeg(cycle,false),lastLightWalkLeg(cycle,true)];
 assert(legs.some(leg=>leg.grounded),'A walk must never have an airborne flight phase');
 for(const [side,leg]of legs.entries()){
  epsilon(Math.hypot(...leg.hip.map((n,j)=>n-leg.knee[j]!)),.335,'Thigh length');
  epsilon(Math.hypot(...leg.ankle.map((n,j)=>n-leg.knee[j]!)),.31,'Shin length');
  assert(leg.footLift>=0&&leg.footLift<=.155001);
  const next=lastLightWalkLeg(cycle+.00001,side===1);
  if(leg.grounded&&next.grounded&&Math.abs(next.footZ-leg.footZ)<.01){
   epsilon(leg.footZ+cycle*LAST_LIGHT_STRIDE_METRES,next.footZ+(cycle+.00001)*LAST_LIGHT_STRIDE_METRES,'Stance foot must stay fixed in world');plantedSamples++;
  }
  const stop=lastLightWalkLeg(cycle,side===1,1);
  epsilon(stop.footZ,leg.footZ,'Stopping cannot slide a planted foot');epsilon(stop.footLift,0,'Stopping must put both soles on the floor');
 }
}
// Identical travel at different frame rates must reach the same phase.
const walk=(ticks:number):ReturnType<LastLightGait['update']>=>{const gait=new LastLightGait();gait.update([0,0,0],0,false);let last=gait.update([0,0,0],0,false);for(let i=1;i<=ticks;i++)last=gait.update([0,0,i/ticks*2.1],1/ticks,false);return last;};
const slow=walk(30),fast=walk(120),phaseDifference=Math.abs(slow.cycle-fast.cycle);epsilon(Math.min(phaseDifference,1-phaseDifference),0,'Frame-rate independence');assert.equal(slow.frame,fast.frame);
const gait=new LastLightGait();gait.update([0,0,0],0,false);const moving=gait.update([0,0,.24],.05,false);
let stopped=moving;for(let i=0;i<120;i++)stopped=gait.update([0,0,.24],1/60,false);
epsilon(stopped.cycle,moving.cycle,'Wall pressure/no displacement cannot advance feet');assert.equal(stopped.frame,LAST_LIGHT_WALK_FRAMES+moving.frame*2+1);assert.equal(stopped.moving,false);
assert.equal(gait.update([0,0,.24],0,true).pose,'sit');assert.equal(gait.update([5,0,5],.016,false).pose,'idle');
// The real seat/approach anchors differ by 1.15m, below the generic teleport
// threshold. Leaving the seated presentation is still not travelled distance.
const seatGait=new LastLightGait();seatGait.update([4.9,0,5.95],.016,true);
const approach=[5.371919378928117,.05585438262346214,4.901290269048628] as const;
const stood=seatGait.update(approach,.016,false);
assert.equal(stood.pose,'idle');assert.equal(stood.moving,false);epsilon(stood.cycle,0,'Seat anchor restoration cannot advance stride');
const resumed=seatGait.update([approach[0],approach[1],approach[2]+.02],.016,false);
assert.equal(resumed.pose,'walk');assert.equal(resumed.moving,true);epsilon(resumed.cycle,.02/LAST_LIGHT_STRIDE_METRES,'First real step after standing must advance normally');
// Eight directions rotate the same finite, capped rig; no mirrored walk legs.
for(let direction=0;direction<8;direction++)for(let frame=0;frame<12;frame++){
 const yaw=direction*Math.PI/4,rig=actorShadowCapsules('walk',yaw,frame/12*Math.PI*2),base=actorShadowCapsules('walk',0,frame/12*Math.PI*2);
 assert.equal(rig.length,11);
 for(let i=0;i<rig.length;i++)for(const endpoint of[0,3]){
  epsilon(rig[i]![endpoint]!,base[i]![endpoint]!*Math.cos(yaw)+base[i]![endpoint+2]!*Math.sin(yaw),'Rig X follows facing');
  epsilon(rig[i]![endpoint+2]!,-base[i]![endpoint]!*Math.sin(yaw)+base[i]![endpoint+2]!*Math.cos(yaw),'Rig Z follows facing');
 }
}
console.log(JSON.stringify({status:'PASS',plantedSamples,checks:['world-locked stance','fixed bone lengths','continuous ground support','stationary stop','frame-rate independent distance phase','seat-to-stand anchor restoration','eight-way pose rig']},null,2));
