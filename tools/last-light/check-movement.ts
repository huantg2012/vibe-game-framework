import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {
 CHAMBER_DEVICE_WORLD_ANCHORS,CHAMBER_DEVICE_FLOORS,LAST_LIGHT_SPAWN,
 LAST_LIGHT_WALK,LAST_LIGHT_FOOT_RADIUS,LAST_LIGHT_WORLD_WALK_SPEED,
 REST_WORLD_APPROACH,projectLastLight,sampleLastLightSurface,
 type WorldPoint,type ChamberDevice,type LastLightRoute,
} from '../../src/systems/last-light-layout.ts';
import {
 createLastLightMovementState,stepLastLightMovement,canStandLastLight,lastLightProjectedWalkingSpeed,
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

// The former irregular landing passed the single right-biased waypoint route
// above, while the left half of the real ramp stopped short of the upper floor.
// Derive its complete cross-section from production triangles instead of
// blessing another hand-picked centre path or reducing the actor's foot radius.
const rampVertices=LAST_LIGHT_WALK.filter(t=>t.route==='west-ramp').flatMap(t=>t.points)
 .filter((point,index,points)=>points.findIndex(other=>Math.hypot(point[0]!-other[0]!,point[1]!-other[1]!,point[2]!-other[2]!)<1e-7)===index);
const bottomHeight=Math.min(...rampVertices.map(p=>p[1]!)),topHeight=Math.max(...rampVertices.map(p=>p[1]!));
const bottom=rampVertices.filter(p=>Math.abs(p[1]!-bottomHeight)<1e-7);
const top=rampVertices.filter(p=>Math.abs(p[1]!-topHeight)<1e-7).sort((a,b)=>a[0]!-b[0]!);
assert.equal(bottom.length,2,'west ramp must retain its full-width bottom');
assert.equal(top.length,2,'west ramp must retain its full-width top');
const bottomCentre={x:(bottom[0]![0]!+bottom[1]![0]!)/2,z:(bottom[0]![2]!+bottom[1]![2]!)/2};
const topCentre={x:(top[0]![0]!+top[1]![0]!)/2,z:(top[0]![2]!+top[1]![2]!)/2};
const rampWidth=Math.hypot(top[1]![0]!-top[0]![0]!,top[1]![2]!-top[0]![2]!);
const across={x:(top[1]![0]!-top[0]![0]!)/rampWidth,z:(top[1]![2]!-top[0]![2]!)/rampWidth};
const rampPoint=(progress:number,offset:number)=>({
 x:bottomCentre.x+(topCentre.x-bottomCentre.x)*progress+across.x*offset,
 z:bottomCentre.z+(topCentre.z-bottomCentre.z)*progress+across.z*offset,
});
const onFloor=(point:{x:number;z:number},route:LastLightRoute):WorldPoint=>{
 const h=sampleLastLightSurface(route,point.x,point.z);assert(h,`landing target has no ${route} surface`);
 return{...point,y:h.height};
};

// Real screen-up input formerly stuck at world (2.746, 2.482, -4.080).
// This is keyboard movement, not a waypoint path steered around the bad join.
const naturalAscent=createLastLightMovementState(onFloor(rampPoint(.5,0),'west-ramp'),'west-ramp');
for(let tick=0;tick<240&&naturalAscent.route!=='upper';tick++){
 const input={x:0,y:-1},beforeHeight=naturalAscent.y;
 const pixels=lastLightProjectedWalkingSpeed(naturalAscent,input,LAST_LIGHT_WORLD_WALK_SPEED);
 stepLastLightMovement(naturalAscent,input,1000/60,pixels);
 assert(canStandLastLight(naturalAscent,naturalAscent.route),'screen-up ascent must retain full foot support');
 assert(Math.abs(naturalAscent.y-beforeHeight)<=.16,'screen-up ascent may not teleport between storeys');
}
assert.equal(naturalAscent.route,'upper','holding screen-up from the ramp centre still catches the broken landing');
results.push('real screen-up input clears the previously blocked west-ramp landing');

const centreHalfWidth=rampWidth/2-LAST_LIGHT_FOOT_RADIUS-.005;
let crossingLanes=0;
for(let lane=0;lane<=12;lane++){
 const offset=-centreHalfWidth+2*centreHalfWidth*lane/12;
 const below=onFloor(rampPoint(.8,offset),'west-ramp'),above=onFloor(rampPoint(1.15,offset),'upper');
 const state=createLastLightMovementState(below,'west-ramp');
 walk(state,above,`full-width ascent lane ${lane}`);assert.equal(state.route,'upper');
 walk(state,below,`full-width descent lane ${lane}`);assert.equal(state.route,'west-ramp');
 // The join must support the entire foot disk from either side, not merely
 // permit one substep to hop over a small unsupported or collider-only seam.
 for(const progress of [.94,.98,.9999,1.0001,1.02,1.05]){
  const route=progress<=1?'west-ramp':'upper',point=onFloor(rampPoint(progress,offset),route);
  assert(canStandLastLight(point,route),`unsupported landing cross-section t=${progress}, offset=${offset}`);
 }
 crossingLanes++;
}
for(const side of [-1,1]){
 // Approach the landing sideways from its two wings, turn down the ramp, then
 // reverse into the upper floor without using the old corrective waypoint.
 const wing=onFloor(rampPoint(1.15,side*(rampWidth/2+.15)),'upper');
 const turn=onFloor(rampPoint(1.10,side*.30),'upper');
 const below=onFloor(rampPoint(.75,side*.30),'west-ramp');
 const state=createLastLightMovementState(wing,'upper');
 walk(state,turn,`landing wing ${side} turn`);
 walk(state,below,`landing wing ${side} descent`);assert.equal(state.route,'west-ramp');
 walk(state,turn,`landing wing ${side} return ascent`);assert.equal(state.route,'upper');
 walk(state,wing,`landing wing ${side} return turn`);
 const outside=rampPoint(.8,side*(rampWidth/2+.05));
 assert(!canStandLastLight({...outside,y:topHeight},'west-ramp'),'opening the landing must not open the ramp sides');
}
results.push(`${crossingLanes} full-width landing lanes ascend/descend with supported cross-sections; both wings turn down/back up; ramp sides remain closed`);

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
for(const route of ['main','west-ramp'] as const)for(const input of [{x:1,y:0},{x:0,y:1},{x:1,y:1},{x:-1,y:1}]){
 const s=route==='main'?stateAt(0,0):stateAt(2.75,-2.25,route),before={...s};
 const pixels=lastLightProjectedWalkingSpeed(s,input,1.8);stepLastLightMovement(s,input,100,pixels);
 assert(Math.abs(Math.hypot(s.x-before.x,s.z-before.z)-.18)<.0002,'world walking pace must match gait across projection/slope');
}
results.push('production world walking speed is 1.8m/s across input axes and ramp, independent of foreshortening');

for(const key of ['core','storage','purifier'] as const){const state=createLastLightMovementState(CHAMBER_DEVICE_WORLD_ANCHORS[key],CHAMBER_DEVICE_FLOORS[key]);const observation=getLastLightObservation(state,key.toUpperCase() as 'CORE'|'STORAGE'|'PURIFIER');assert(observation.visible,`${key}: approach can observe own device`);assert(observation.distance<58,`${key}: observation distance native pixels`);}
assert(!isLastLightSightClear({x:10,y:1,z:-4},{x:10,y:3.5,z:-4}),'upper floor physically occludes vertical sight');
assert(isLastLightSightClear({x:3.8,y:1.43,z:3.8},{x:3.8,y:2,z:3.8}),'clear nearby air ray');
results.push('3D device observation and real upper-floor occlusion');

const benchmark=createLastLightMovementState(),start=performance.now();
for(let i=0;i<1000;i++){stepLastLightMovement(benchmark,{x:i%200<100?1:-1,y:0},1000/60,speed);for(const key of allKeys)canInteractLastLight(benchmark,key);}
const frameMs=(performance.now()-start)/1000;
console.log(JSON.stringify({passed:results.length,checks:results,benchmark:{iterations:1000,movementAndSixInteractionQueriesMeanMs:frameMs}},null,2));
