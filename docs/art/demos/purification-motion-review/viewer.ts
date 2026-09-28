import {LastLightRenderer,type LastLightFrame,type LastLightRenderImages,type LastLightRenderPack,type LastLightRenderState} from '../../../../src/art/last-light-renderer';
import {LastLightGait} from '../../../../src/art/last-light-gait';
import {lastLightScreenFacingYaws} from '../../../../src/art/last-light-facing';
import {createLastLightMovementState,stepLastLightMovement,lastLightProjectedWalkingSpeed,type LastLightMovementState} from '../../../../src/systems/last-light-locomotion';
import {LAST_LIGHT_WORLD_WALK_SPEED,sampleLastLightSurface,projectLastLight,type LastLightRoute} from '../../../../src/systems/last-light-layout';
const root='/assets/last-light/';
const manifest=await(await fetch(root+'manifest.json')).json();
const image=async(file:string)=>createImageBitmap(await(await fetch(root+file)).blob(),{imageOrientation:'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none'});
const t=manifest.textures,a=manifest.actor.textures;
const names={scene:t.haven,background:t.background,far:'exterior-far.png',middle:'exterior-middle.png',near:'exterior-near.png',exteriorFields:'exterior-fields.png',pollution:t.pollution,coreLight:t.coreLight,storageLight:t.storageLight,purifierLight:t.purifierLight,furnace:t.furnace,motion:t.motion,depth:t.depth,volumeDepth:t.volumeDepth,exteriorDepth:t.exteriorDepth,energy:t.coreEnergy,normal:t.normal,albedo:t.albedo,rough:t.roughSpec,actorColor:a.albedo,actorNormal:a.normal,actorDepth:a.depth,actorRough:a.roughSpec};
const images=Object.fromEntries(await Promise.all(Object.entries(names).map(async([key,file])=>[key,await image(file)]))) as unknown as LastLightRenderImages;
const frames=manifest.actor.frames.map((f:any)=>({...f.rect,anchor:f.anchor,yaw:f.yaw,pose:f.pose,phase:f.frame,lamp:f.lamp,shadowCapsules:f.shadowCapsules})) as LastLightFrame[];
const pack:LastLightRenderPack={camera:manifest.camera,frames,lights:manifest.lights,occluders:(await(await fetch(root+'occluders.json')).json()).triangles,images,actorPortrait:await image(a.color),actorDepthOffset:80,actorDepthScale:256,exteriorPadding:32,exteriorParallax:[.06,.18,.38]};
const renderer=new LastLightRenderer(pack),host=document.querySelector('#scene')!;host.append(renderer.canvas);
const detail=document.createElement('canvas');detail.width=960;detail.height=240;detail.id='detail';host.append(detail);const detailContext=detail.getContext('2d')!;detailContext.imageSmoothingEnabled=false;
const state:LastLightRenderState={seconds:0,world:[0,0,0],yaw:0,walking:false,resting:false,health:[.7,.7,.7],charge:0,growth:0,thicken:0,pulses:new Float32Array(6),reducedMotion:false,gaitPose:'idle',gaitFrame:0};
const selector=document.querySelector('#case') as HTMLSelectElement,seek=document.querySelector('#seek') as HTMLInputElement,output=document.querySelector('#state') as HTMLOutputElement,play=document.querySelector('#play') as HTMLButtonElement;
let elapsed=0,last=performance.now(),running=true,gait=new LastLightGait(),movement:LastLightMovementState,segment=0,hold=0,cycle=0;
let screenDirection='—',screenKeys='—',screenInput={x:0,y:0};
type Waypoint=readonly[number,number,LastLightRoute?];
const paths:Record<string,readonly Waypoint[]>={purifier:[[-1,1.7],[-.2,2.8],[1.15,4.3],[-.2,2.8],[-1,1.7],[0,0],[-1,1.7]],upper:[[6,-3.33,'upper'],[9.02,-3.55,'upper'],[6,-3.33,'upper'],[3.76,-4.6,'upper'],[6,-3.33,'upper']],hearth:[[3.8,3.8],[4.2,4.9],[5.3,4.9],[4.2,4.9],[3.8,3.8],[2.3,3.2],[3.8,3.8]],ramp:[[1.4,.4],[2.05,.30],[2,-.5],[2.75,-2.25,'west-ramp'],[3.76,-4.6,'upper'],[4.4,-4.2,'upper'],[3.76,-4.6,'upper'],[3.3,-3.53,'west-ramp'],[2.75,-2.25,'west-ramp'],[2,-.5],[1.4,.4]],exterior:[[-2,-2],[2.05,.3],[4.1,1.15],[3.7,-.77],[4.8,-1.48],[8.4,-.325],[12,.83],[10.7,2.1],[12,.83],[8.4,-.325],[4.8,-1.48],[3.7,-.77],[2.05,.3],[-2,-2]],core:[[10.7,2.1],[11.4,1.3],[12,.83],[11.4,1.3],[10.7,2.1],[9.6,2.9],[10.7,2.1]]};
// Build the spokes from the actual screen-key inverse, not world-XZ diagonals.
// Returning from each spoke also exercises the opposite screen direction.
const flatFacings=lastLightScreenFacingYaws(manifest.camera);
const spoke=(yaw:number,distance:number):Waypoint=>[Math.sin(yaw)*distance,Math.cos(yaw)*distance];
paths.eight=[[0,0],...flatFacings.flatMap(yaw=>[spoke(yaw,1.2),[0,0] as Waypoint])];
paths.idle=[[0,0],spoke(flatFacings[1]!, .54),[0,0]];
// A 2.6m straight screen-horizontal pass lasts 1.44 seconds at production speed:
// more than two complete strides before the actor rests and reverses.
// Offset away from the ramp-side clearance band before extending the pass.
const lateralCenter={x:0,y:0,z:.3};
const lateralPoint=(distance:number):Waypoint=>[lateralCenter.x+Math.sin(flatFacings[0]!)*distance,lateralCenter.z+Math.cos(flatFacings[0]!)*distance];
const lateralLeft=lateralPoint(-1.3),lateralRight=lateralPoint(1.3);
paths.lateral=[lateralLeft,lateralRight,lateralLeft];
// Traverse both edges of the landing, then turn on the real upper floor.
// This deliberately avoids the old hand-picked, right-biased ascent waypoint.
const landingPoint=(t:number,side:number):Waypoint=>[2+1.5*t+3.5/Math.sqrt(14.5)*side,-.5-3.5*t+1.5/Math.sqrt(14.5)*side,t<1?'west-ramp':'upper'];
paths.landing=[landingPoint(.75,-.65),landingPoint(1.2,-.65),[4.5,-4.35,'upper'],landingPoint(1.2,.65),landingPoint(.75,.65),landingPoint(.75,0),landingPoint(1.2,0),[4.5,-4.35,'upper'],landingPoint(1.2,-.65),landingPoint(.75,-.65)];
// Hold actual screen-key diagonals into a boundary: no waypoint steering can
// quietly turn away from the contact whose movement/facing we are reviewing.
const PRESSES:Record<string,{start:Waypoint;input:{x:number;y:number}}>={
  'edge-outer':{start:[4.8,7.6],input:{x:1,y:1}},
  'edge-ramp':{start:[2.1062174142785115,-3.7687639653092098],input:{x:1,y:-1}},
  'edge-prop':{start:[11.004217905218487,6.341515064693588],input:{x:1,y:-1}},
  'edge-slope':{start:[1.783619853,-1.835591491,'west-ramp'],input:{x:-1,y:-1}},
};
let movedMetres=0,facingTravelErrorDegrees=0;
const DIRECTIONS=['E','SE','S','SW','W','NW','N','NE'];
const KEYS=['D','D+S','S','S+A','A','A+W','W','W+D'];
const HOLD_SECONDS:Record<string,number>={eight:1.4,idle:6.4,lateral:1.3};
const firstHold=()=>selector.value==='idle'?1:selector.value==='lateral'?1.3:.45;

function reset(){
  const start=PRESSES[selector.value]?.start??paths[selector.value]![0]!;
  movement=createLastLightMovementState({x:start[0],y:0,z:start[1]},start[2]??'main');
  gait=new LastLightGait();segment=1;hold=firstHold();elapsed=0;state.seconds=0;
  screenDirection='—';screenKeys='—';screenInput={x:0,y:0};
  gait.update([movement.x,movement.y,movement.z],0,false);
  update(0);renderer.settleExteriorObserver(state.world,0);
}
function update(dt:number){
  elapsed+=dt;state.seconds=elapsed;const path=paths[selector.value]!,press=PRESSES[selector.value];
  const before={x:movement.x,z:movement.z};
  if(press){
    const input=elapsed>.45&&elapsed<3.45?press.input:{x:0,y:0};
    screenInput=input;hold=0;
    const sector=(Math.round(Math.atan2(input.y,input.x)/(Math.PI/4))+8)%8;
    screenDirection=input.x||input.y?DIRECTIONS[sector]!:'—';screenKeys=input.x||input.y?KEYS[sector]!:'—';
    stepLastLightMovement(movement,input,dt*1000,lastLightProjectedWalkingSpeed(movement,input,LAST_LIGHT_WORLD_WALK_SPEED));
  }else if(hold>0)hold=Math.max(0,hold-dt);
  else{
    const target=path[segment]!,dx=target[0]-movement.x,dz=target[1]-movement.z,dist=Math.hypot(dx,dz);
    const arrivalDistance=['eight','idle','lateral'].includes(selector.value)?.000001:.025;
    if(dist<arrivalDistance){
      // The final point is already the first one. Skip the duplicate on wrap
      // so every endpoint has exactly one intentional rest interval.
      segment=segment===path.length-1?1:segment+1;
      hold=HOLD_SECONDS[selector.value]??.25;
    }else{
      const h=sampleLastLightSurface(movement.route,movement.x,movement.z)!;
      const p=projectLastLight(movement),q=projectLastLight({x:target[0],z:target[1],y:movement.y+h.dx*dx+h.dz*dz});
      const length=Math.hypot(q.x-p.x,q.y-p.y),input={x:(q.x-p.x)/length,y:(q.y-p.y)/length};
      const sector=(Math.round(Math.atan2(input.y,input.x)/(Math.PI/4))+8)%8;
      screenDirection=DIRECTIONS[sector]!;screenKeys=KEYS[sector]!;screenInput=input;
      stepLastLightMovement(movement,input,Math.min(dt,dist/LAST_LIGHT_WORLD_WALK_SPEED)*1000,
        lastLightProjectedWalkingSpeed(movement,input,LAST_LIGHT_WORLD_WALK_SPEED));
    }
  }
  const dx=movement.x-before.x,dz=movement.z-before.z;
  movedMetres=Math.hypot(dx,dz);
  facingTravelErrorDegrees=movedMetres>.00001?Math.abs(Math.atan2(Math.sin(movement.facing-Math.atan2(dx,dz)),Math.cos(movement.facing-Math.atan2(dx,dz))))*180/Math.PI:0;
  state.world=[movement.x,movement.y,movement.z];state.yaw=movement.facing;
  const pose=gait.update(state.world,dt,false);
  state.gaitPose=pose.pose;state.gaitFrame=pose.frame;state.walking=pose.moving;cycle=pose.cycle;
}
function draw(){
  renderer.draw(state);const b=renderer.actorBounds;
  detailContext.fillStyle='#080a0a';detailContext.fillRect(0,0,960,240);
  detailContext.drawImage(renderer.canvas,Math.round(b.x+b.width/2-40),Math.round(b.y+b.height/2-30),80,60,0,0,320,240);
  const contextOrigin=selector.value==='lateral'?projectLastLight(lateralCenter):null;
  detailContext.drawImage(renderer.canvas,contextOrigin?Math.round(contextOrigin.x-80):450,contextOrigin?Math.round(contextOrigin.y-80):190,160,120,350,0,320,240);
  const yawDegrees=state.yaw*180/Math.PI;
  output.value=`${elapsed.toFixed(2)}s · ${movement.route} · ${screenKeys} ${screenDirection} · yaw ${yawDegrees.toFixed(2)}° · ${state.gaitPose} ${state.gaitFrame}`;
  output.dataset.state=JSON.stringify({case:selector.value,elapsed,world:state.world,route:movement.route,
    frame:state.gaitFrame,pose:state.gaitPose,moving:state.walking,cycle,yaw:state.yaw,yawDegrees,
    screenDirection,screenKeys,screenInput,segment,hold,movedMetres,facingTravelErrorDegrees});
  seek.value=String(Math.min(elapsed,Number(seek.max)));
}
play.onclick=()=>{running=!running;play.textContent=running?'暂停':'播放';};
document.querySelector('#restart')!.addEventListener('click',()=>{reset();draw();});
selector.onchange=()=>{reset();draw();};
seek.oninput=()=>{
  running=false;play.textContent='播放';const target=Number(seek.value);reset();
  const frames=Math.floor(target*60),remainder=target-frames/60;
  for(let frame=0;frame<frames;frame++)update(1/60);
  // Do not append a floating-point epsilon frame: it would replace the last
  // real movement sample with a false "stationary" diagnostic while seeking.
  if(remainder>1e-9)update(remainder);
  renderer.settleExteriorObserver(state.world,state.seconds);draw();
};
reset();let request=0;
function animate(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(running)update(dt);draw();request=requestAnimationFrame(animate);
}
request=requestAnimationFrame(animate);
window.addEventListener('pagehide',()=>{cancelAnimationFrame(request);renderer.destroy();},{once:true});
