import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {
 CHAMBER_DEVICE_WORLD_ANCHORS,CHAMBER_DEVICE_FLOORS,LAST_LIGHT_SPAWN,
 REST_WORLD_APPROACH,projectLastLight,sampleLastLightSurface,
 type WorldPoint,type ChamberDevice,type LastLightRoute,
} from '../../src/systems/last-light-layout.ts';
import {
 createLastLightMovementState,stepLastLightMovement,canStandLastLight,
 canInteractLastLight,getLastLightObservation,isLastLightSightClear,
 type LastLightMovementState,
} from '../../src/systems/last-light-locomotion.ts';

const speed=120;
const results:string[]=[];
const stateAt=(x:number,z:number,route:LastLightRoute='main')=>createLastLightMovementState({x,y:0,z},route);
function walk(state:LastLightMovementState,point:WorldPoint,label:string):void {
 for(let tick=0;tick<800;tick++){
  if(Math.hypot(state.x-point.x,state.z-point.z)<.018)return;
  const h=sampleLastLightSurface(state.route,state.x,state.z)!;
  const onPlane={...point,y:state.y+h.dx*(point.x-state.x)+h.dz*(point.z-state.z)};
  const a=projectLastLight(state),b=projectLastLight(onPlane),distance=Math.hypot(b.x-a.x,b.y-a.y);
  stepLastLightMovement(state,{x:(b.x-a.x)/distance,y:(b.y-a.y)/distance},Math.min(1000/60,distance/speed*1000),speed);
  assert(canStandLastLight(state,state.route),`${label}: full-circle foot clearance lost`);
 }
 throw new Error(`${label}: stuck ${JSON.stringify(state)} target ${JSON.stringify(point)}`);
}
function via(state:LastLightMovementState,points:readonly (readonly [number,number,LastLightRoute?])[],label:string):void{
 for(const [x,z,route='main']of points){const h=sampleLastLightSurface(route,x,z);assert(h,`${label}: target has no floor`);walk(state,{x,y:h.height,z},label);}
}

const allKeys=Object.keys(CHAMBER_DEVICE_WORLD_ANCHORS) as ChamberDevice[];
for(const key of allKeys){const anchor=CHAMBER_DEVICE_WORLD_ANCHORS[key],floor=CHAMBER_DEVICE_FLOORS[key];assert(canStandLastLight(anchor,floor),`${key} approach clearance`);assert(canInteractLastLight(createLastLightMovementState(anchor,floor),key),`${key} approach interaction`);}
assert(canStandLastLight(REST_WORLD_APPROACH,'main'),'seat approach clearance');
results.push('all six independent interaction approaches and seat have full 0.22m clearance');

for(const key of ['purifier','offering','rift'] as const){const state=createLastLightMovementState();walk(state,CHAMBER_DEVICE_WORLD_ANCHORS[key],key);assert(canInteractLastLight(state,key));}
const restState=createLastLightMovementState();walk(restState,REST_WORLD_APPROACH,'rest');
results.push('spawn → purifier / offering / Rift / rest walking paths');

const bridgeState=createLastLightMovementState();
via(bridgeState,[[4.1,1.15],[3.7,-.77],[4.8,-1.48],[8.4,-.325],[12,.83]],'core bridge');
walk(bridgeState,CHAMBER_DEVICE_WORLD_ANCHORS.core,'core approach');assert(canInteractLastLight(bridgeState,'core'));
via(bridgeState,[[12,.83],[8.4,-.325],[4.8,-1.48],[3.7,-.77],[4.1,1.15]],'bridge return');walk(bridgeState,LAST_LIGHT_SPAWN,'bridge return spawn');
results.push('spawn ↔ core via actual retained bridge');

const upperState=createLastLightMovementState();
via(upperState,[[2.05,.30],[2,-.5],[2.75,-2.25,'west-ramp'],[3.76,-4.6,'upper'],[4.4,-4.2,'upper']],'west ascent');
assert.equal(upperState.route,'upper');
walk(upperState,CHAMBER_DEVICE_WORLD_ANCHORS.growth,'growth');assert(canInteractLastLight(upperState,'growth'));
walk(upperState,CHAMBER_DEVICE_WORLD_ANCHORS.storage,'storage');assert(canInteractLastLight(upperState,'storage'));
via(upperState,[[4.4,-4.2,'upper'],[3.76,-4.6,'upper'],[3.3,-3.53,'west-ramp'],[2.75,-2.25,'west-ramp'],[2,-.5],[2.05,.3]],'west descent');
walk(upperState,LAST_LIGHT_SPAWN,'ramp return spawn');assert.equal(upperState.route,'main');
results.push('spawn → single west ramp → growth → storage → west ramp → spawn');

assert(!canStandLastLight({x:7.7,y:0,z:1.6},'main'),'breach must be empty');
assert(!canStandLastLight({x:.6,y:0,z:5.94},'main'),'Rift notch must be empty');
assert.throws(()=>stateAt(7.7,1.6),'invalid spawn must not snap across hole');
assert.throws(()=>stateAt(3,-2),'main cannot enter solid ramp volume');
const upperAnchor=createLastLightMovementState(CHAMBER_DEVICE_WORLD_ANCHORS.storage,'upper');assert(!canInteractLastLight(upperAnchor,'core'),'no cross-floor interaction');
const edgeState=stateAt(7.7,3.08);for(let i=0;i<20;i++)stepLastLightMovement(edgeState,{x:0,y:-1},100,10000);assert(canStandLastLight(edgeState,edgeState.route),'large speed cannot tunnel');assert.equal(edgeState.route,'main');
results.push('actual breach and Rift cut excluded; no invalid spawn snap, cross-floor interaction, or fast edge tunneling');

for(const input of [{x:1,y:0},{x:0,y:1},{x:-1,y:0},{x:0,y:-1},{x:1,y:1},{x:-1,y:1},{x:1,y:-1},{x:-1,y:-1}]){
 const s=stateAt(0,0),a=projectLastLight(s);stepLastLightMovement(s,input,100,speed);const b=projectLastLight(s),n=Math.hypot(input.x,input.y);
 assert(Math.abs(b.x-a.x-input.x/n*12)<.01&&Math.abs(b.y-a.y-input.y/n*12)<.01,`screen-relative speed ${JSON.stringify(input)}`);
 const slope=stateAt(2.75,-2.25,'west-ramp'),c=projectLastLight(slope);stepLastLightMovement(slope,input,20,speed);const d=projectLastLight(slope);
 assert(Math.abs(d.x-c.x-input.x/n*2.4)<.01&&Math.abs(d.y-c.y-input.y/n*2.4)<.01,`slope screen-relative speed ${JSON.stringify(input)}`);
}
const frozen=createLastLightMovementState(),before={...frozen};stepLastLightMovement(frozen,{x:0,y:0},100,speed);assert.deepEqual(frozen,before);stepLastLightMovement(frozen,{x:NaN,y:1},100,speed);assert.deepEqual(frozen,before);
const one=createLastLightMovementState(),long=createLastLightMovementState();stepLastLightMovement(one,{x:1,y:0},100,speed);stepLastLightMovement(long,{x:1,y:0},2000,speed);assert.deepEqual(long,one);
results.push('normalized eight-way screen-relative speed on floor and slope, zero/invalid input freeze, 100ms stall cap');

for(const key of ['core','storage','purifier'] as const){const state=createLastLightMovementState(CHAMBER_DEVICE_WORLD_ANCHORS[key],CHAMBER_DEVICE_FLOORS[key]);const observation=getLastLightObservation(state,key.toUpperCase() as 'CORE'|'STORAGE'|'PURIFIER');assert(observation.visible,`${key}: approach can observe own device`);assert(observation.distance<58,`${key}: observation distance native pixels`);}
assert(!isLastLightSightClear({x:10,y:1,z:-4},{x:10,y:3.5,z:-4}),'upper floor physically occludes vertical sight');
assert(isLastLightSightClear({x:3.8,y:1.43,z:3.8},{x:3.8,y:2,z:3.8}),'clear nearby air ray');
results.push('3D device observation and real upper-floor occlusion');

const benchmark=createLastLightMovementState(),start=performance.now();
for(let i=0;i<1000;i++){stepLastLightMovement(benchmark,{x:i%200<100?1:-1,y:0},1000/60,speed);for(const key of allKeys)canInteractLastLight(benchmark,key);}
const frameMs=(performance.now()-start)/1000;
console.log(JSON.stringify({passed:results.length,checks:results,benchmark:{iterations:1000,movementAndSixInteractionQueriesMeanMs:frameMs}},null,2));
