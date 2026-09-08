/** Regression for the rejected rigid six-lobe orbit; checks motion, not aesthetic PASS. */
import assert from 'node:assert/strict';
import { createVolumePresenceFrame, updateVolumePresenceFrame, getVolumeProfile, sampleVolumeDensity } from '../../src/systems/volume-presence';
const profile=getVolumeProfile('dust_swarm');
const cycle=profile.restMs+profile.gatherMs+profile.releaseMs+profile.disperseMs;
const frame=(time:number,w=160,h=128)=>updateVolumePresenceFrame(createVolumePresenceFrame(),{
 substrate:'dust_swarm',coverage:'rewrite',elapsedMs:time,rect:{x:32,y:48,w,h},active:true,
});
const distance=(a:{cx:number;cy:number},b:{cx:number;cy:number})=>Math.hypot(a.cx-b.cx,a.cy-b.cy);
let maxStep=0,changingPairs=0;
assert(frame(0).partCount<=6,'dust reads as a few broad suspended masses, not a swarm of small creatures');
assert(frame(0).parts.slice(0,frame(0).partCount).every(p=>p.rx*p.ry>100),'each tuft needs a broad visible body at world scale');
const initial=frame(0),later=frame(1800),nextCycle=frame(cycle);
assert(new Set(initial.parts.slice(0,initial.partCount).map(p=>Math.round(p.rx*10))).size>=4,'dust knots cannot all have the same radius');
for(let i=0;i<initial.partCount;i++)for(let j=i+1;j<initial.partCount;j++) {
 if(Math.abs(distance(initial.parts[i]!,initial.parts[j]!)-distance(later.parts[i]!,later.parts[j]!))>2)changingPairs++;
}
assert(changingPairs>=initial.partCount,'relative spacing must deform, not rigidly translate or rotate');
assert(initial.parts.some((p,i)=>distance(p,nextCycle.parts[i]!)>3),'a hazard cycle must not reset the material to an identical orbit frame');
for(const [w,h] of [[64,64],[96,160],[160,96],[352,336]]) {
 let previous=frame(-16,w,h);
 for(let time=0;time<cycle*3;time+=16) {
  const f=frame(time,w,h);assert(f.hasPresence,'small or tall stages retain visible material');
  assert(sampleVolumeDensity(f,f.coreX,f.coreY)>=f.dangerThreshold,'core follows actual material');
  for(let i=0;i<f.partCount;i++) {
   const step=distance(f.parts[i]!,previous.parts[i]!);maxStep=Math.max(maxStep,step);
   assert(step<4,'no teleport at phase boundary, delayed response or noise knot');
  }
  previous=f;
 }
}
const a=frame(2713),b=frame(2713);assert.deepEqual(a,b,'absolute seek reconstructs deterministic dust');
console.log(JSON.stringify({changingPairs,maxStepPixelsPer16ms:+maxStep.toFixed(3),repeatable:true}));
console.log('check:dust-motion PASS');
