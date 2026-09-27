import type {Player} from '../entities/player';
import {GAME_CONSTANTS} from '../config/constants';
import {LAST_LIGHT_OCCLUSION_BASE64} from '../generated/last-light-layout';
import {
 LAST_LIGHT_WALK,LAST_LIGHT_OBSTACLES,LAST_LIGHT_STATIONS,LAST_LIGHT_SPAWN,LAST_LIGHT_FOOT_RADIUS,
 LAST_LIGHT_CAMERA,LAST_LIGHT_BASIS,LAST_LIGHT_MAX_STEP_MS,LAST_LIGHT_WORLD_WALK_SPEED,
 CHAMBER_GROUND_OFFSET_Y,CHAMBER_INTERACTION_RADIUS,CHAMBER_DEVICE_WORLD_ANCHORS,CHAMBER_DEVICE_FLOORS,REST_WORLD_APPROACH,
 projectLastLight,sampleLastLightSurface,worldPoint,
 type WorldPoint,type ChamberPoint,type ChamberDevice,type LastLightRoute,
} from './last-light-layout';

export interface LastLightMovementState {x:number;y:number;z:number;route:LastLightRoute;facing:number}
interface Edge {ax:number;az:number;bx:number;bz:number;dx:number;dz:number;length2:number}
const EPS=1e-7,RADIUS=LAST_LIGHT_FOOT_RADIUS;
const edge=(ax:number,az:number,bx:number,bz:number):Edge=>({ax,az,bx,bz,dx:bx-ax,dz:bz-az,length2:(bx-ax)**2+(bz-az)**2});
function closest(p:{x:number;z:number},e:Edge):{x:number;z:number;distance:number}{
 const t=Math.max(0,Math.min(1,((p.x-e.ax)*e.dx+(p.z-e.az)*e.dz)/e.length2));
 const x=e.ax+e.dx*t,z=e.az+e.dz*t;return{x,z,distance:Math.hypot(p.x-x,p.z-z)};
}
const rampT=(x:number,z:number)=>((x-2)*1.5+(z+.5)*-3.5)/14.5;
const rampTriangles=LAST_LIGHT_WALK.filter(t=>t.route==='west-ramp');
const rampVertices=rampTriangles.flatMap(t=>t.points).filter((p,i,ps)=>ps.findIndex(q=>Math.hypot(p[0]!-q[0]!,p[2]!-q[2]!)<EPS)===i);
const bottom=rampVertices.filter(p=>p[1]!<.1),top=rampVertices.filter(p=>p[1]!>2.6);
if(bottom.length!==2||top.length!==2)throw new Error('Last Light must have one full-width west ramp');
const lowerPortal=edge(bottom[0]![0]!,bottom[0]![2]!,bottom[1]![0]!,bottom[1]![2]!);
const upperPortal=edge(top[0]![0]!,top[0]![2]!,top[1]![0]!,top[1]![2]!);
function ownSupport(route:LastLightRoute,x:number,z:number):boolean{
 if(!sampleLastLightSurface(route,x,z))return false;
 // The solid ramp occupies the main-floor volume; its ends, not its side,
 // establish the transition to the ramp's separate height plane.
 return route!=='main'||!sampleLastLightSurface('west-ramp',x,z)||rampT(x,z)<=EPS;
}
const perimeterEdges=(route:LastLightRoute):Edge[]=>{
 const triangles=LAST_LIGHT_WALK.filter(t=>t.route===route||((route==='main'||route==='upper')&&t.route==='west-ramp'));
 const raw:Edge[]=[];const seen=new Set<string>();
 for(const t of triangles)for(let i=0;i<3;i++){
  const a=t.points[i]!,b=t.points[(i+1)%3]!;if(Math.hypot(a[0]!-b[0]!,a[2]!-b[2]!)<EPS)continue;
  const ka=`${a[0]!.toFixed(6)},${a[2]!.toFixed(6)}`,kb=`${b[0]!.toFixed(6)},${b[2]!.toFixed(6)}`;
  const key=ka<kb?`${ka}:${kb}`:`${kb}:${ka}`;if(seen.has(key))continue;seen.add(key);raw.push(edge(a[0]!,a[2]!,b[0]!,b[2]!));
 }
 const result:Edge[]=[];
 for(const e of raw){const cuts=[0,1];
  for(const other of raw){const ox=other.ax-e.ax,oz=other.az-e.az,den=e.dx*other.dz-e.dz*other.dx;
   if(Math.abs(den)>EPS){const t=(ox*other.dz-oz*other.dx)/den,u=(ox*e.dz-oz*e.dx)/den;if(t>EPS&&t<1-EPS&&u>=-EPS&&u<=1+EPS)cuts.push(t);}
   else if(Math.abs(ox*e.dz-oz*e.dx)<EPS)for(const end of [0,1]){const t=((ox+other.dx*end)*e.dx+(oz+other.dz*end)*e.dz)/e.length2;if(t>EPS&&t<1-EPS)cuts.push(t);}
  }
  cuts.sort((a,b)=>a-b);const length=Math.sqrt(e.length2),nx=-e.dz/length,nz=e.dx/length;
  for(let i=1;i<cuts.length;i++){const a=cuts[i-1]!,b=cuts[i]!;if(b-a<EPS)continue;const t=(a+b)/2,x=e.ax+e.dx*t,z=e.az+e.dz*t;
   if(ownSupport(route,x+nx*.00003,z+nz*.00003)===ownSupport(route,x-nx*.00003,z-nz*.00003))continue;
   // The broken upper polygon slightly overlaps the ramp top. Its irregular
   // edge inside that landing is a supported seam, not a collision wall.
   if(route==='upper'&&rampT(x,z)>.90&&sampleLastLightSurface('west-ramp',x,z))continue;
   const portal=(route==='main'? [lowerPortal]:route==='upper'?[upperPortal]:[lowerPortal,upperPortal]).some(p=>closest({x,z},p).distance<1e-5);
   if(!portal)result.push(edge(e.ax+e.dx*a,e.az+e.dz*a,e.ax+e.dx*b,e.az+e.dz*b));
  }
 }return result;
};
const BOUNDARIES:Record<LastLightRoute,Edge[]>={main:perimeterEdges('main'),upper:perimeterEdges('upper'),'west-ramp':perimeterEdges('west-ramp')};
const POLYGON_OBSTACLES=LAST_LIGHT_OBSTACLES.map(o=>{
 const c=Math.cos(o.yaw),s=Math.sin(o.yaw),b=o.bounds;
 const ps=[[b[0]!,b[1]!],[b[2]!,b[1]!],[b[2]!,b[3]!],[b[0]!,b[3]!]].map(([x,z])=>({x:o.position[0]!+x!*c+z!*s,z:o.position[2]!-x!*s+z!*c}));
 return{...o,edges:ps.map((p,i)=>{const q=ps[(i+1)%4]!;return edge(p.x,p.z,q.x,q.z);})};
});
function obstacleClearance(p:WorldPoint,o:typeof POLYGON_OBSTACLES[number]):number{
 if(p.y<o.position[1]!-.13||p.y>o.position[1]!+o.height+.13)return Infinity;
 const dx=p.x-o.position[0]!,dz=p.z-o.position[2]!;
 if(o.kind==='circle')return Math.hypot(dx,dz)-o.bounds[2]!;
 const c=Math.cos(o.yaw),s=Math.sin(o.yaw),x=dx*c-dz*s,z=dx*s+dz*c,b=o.bounds;
 const ox=Math.max(b[0]!-x,0,x-b[2]!),oz=Math.max(b[1]!-z,0,z-b[3]!);
 return ox||oz?Math.hypot(ox,oz):-Math.min(x-b[0]!,b[2]!-x,z-b[1]!,b[3]!-z);
}
function supportedNeighbor(route:LastLightRoute,x:number,z:number):boolean{
 if(ownSupport(route,x,z))return true;
 const t=rampT(x,z);
 if(route==='main')return t>=-EPS&&t<.10&&!!sampleLastLightSurface('west-ramp',x,z);
 if(route==='upper')return t>.90&&t<=1+EPS&&!!sampleLastLightSurface('west-ramp',x,z);
 return t<.05?ownSupport('main',x,z):t>.95?ownSupport('upper',x,z):false;
}
export function canStandLastLight(p:WorldPoint,route:LastLightRoute):boolean{
 if(![p.x,p.y,p.z].every(Number.isFinite)||!ownSupport(route,p.x,p.z))return false;
 for(const e of BOUNDARIES[route])if(closest(p,e).distance<RADIUS-EPS)return false;
 // Endpoint circles must also have support on the far side of an open seam.
 for(let i=0;i<20;i++){const a=i*Math.PI/10;if(!supportedNeighbor(route,p.x+Math.cos(a)*(RADIUS-EPS),p.z+Math.sin(a)*(RADIUS-EPS)))return false;}
 return !POLYGON_OBSTACLES.some(o=>obstacleClearance(p,o)<RADIUS-EPS);
}
export function createLastLightMovementState(p:WorldPoint=LAST_LIGHT_SPAWN,route:LastLightRoute='main'):LastLightMovementState{
 const surface=sampleLastLightSurface(route,p.x,p.z);if(!surface)throw new Error('Last Light spawn has no matching physical surface');
 const state={x:p.x,y:surface.height,z:p.z,route,facing:Math.atan2(9,-.4)};
 if(!canStandLastLight(state,route))throw new Error('Last Light spawn lacks full foot clearance');return state;
}
function candidate(state:LastLightMovementState,x:number,z:number):LastLightMovementState|null{
 let route=state.route;
 if(!ownSupport(route,x,z)){
  const t=rampT(x,z);
  if(route==='main'&&t<.10&&sampleLastLightSurface('west-ramp',x,z))route='west-ramp';
  else if(route==='upper'&&t>.90&&sampleLastLightSurface('west-ramp',x,z))route='west-ramp';
  else if(route==='west-ramp'&&t<=.02&&ownSupport('main',x,z))route='main';
  else if(route==='west-ramp'&&t>=.98&&ownSupport('upper',x,z))route='upper';
  else return null;
 }
 const surface=sampleLastLightSurface(route,x,z);if(!surface||Math.abs(surface.height-state.y)>.16)return null;
 const result={x,z,y:surface.height,route,facing:state.facing};return canStandLastLight(result,route)?result:null;
}
/** Local inverse projection keeps WASD screen-relative on level ground and slopes. */
export function lastLightWorldDelta(route:LastLightRoute,p:WorldPoint,sx:number,sy:number):{x:number;z:number}{
 const h=sampleLastLightSurface(route,p.x,p.z),b=LAST_LIGHT_BASIS,S=LAST_LIGHT_CAMERA.scale;
 const a=S*b.right[0],c=S*b.right[2],d=-S*(b.up[0]+b.up[1]*(h?.dx??0)),e=-S*(b.up[2]+b.up[1]*(h?.dz??0));
 const det=a*e-c*d;return{x:(sx*e-c*sy)/det,z:(a*sy-sx*d)/det};
}
/** Keep keyboard direction screen-relative while giving the body a consistent
 * physical walking speed. Perspective foreshortening must not become a sprint. */
export function lastLightProjectedWalkingSpeed(state:Readonly<LastLightMovementState>,input:ChamberPoint,worldSpeed:number):number{
 const length=Math.hypot(input.x,input.y);
 if(!Number.isFinite(length)||length<EPS||!Number.isFinite(worldSpeed)||worldSpeed<=0)return 0;
 const world=lastLightWorldDelta(state.route,state,input.x/length,input.y/length);
 return worldSpeed/Math.max(EPS,Math.hypot(world.x,world.z));
}
function slideCandidate(state:LastLightMovementState,dx:number,dz:number):LastLightMovementState|null{
 let best:LastLightMovementState|null=null,bestProgress=0;
 const edges=[...BOUNDARIES[state.route]];
 for(const o of POLYGON_OBSTACLES)if(obstacleClearance(state,o)<RADIUS+.09)edges.push(...o.edges);
 for(const e of edges){const q=closest(state,e);if(q.distance>RADIUS+.075||q.distance<EPS)continue;
  const nx=(state.x-q.x)/q.distance,nz=(state.z-q.z)/q.distance,dot=dx*nx+dz*nz;if(dot>=0)continue;
  const vx=dx-dot*nx,vz=dz-dot*nz;if(Math.hypot(vx,vz)<EPS)continue;
  const next=candidate(state,state.x+vx,state.z+vz);if(!next)continue;
  const progress=(next.x-state.x)*dx+(next.z-state.z)*dz;if(progress>bestProgress){best=next;bestProgress=progress;}
 }
 return best;
}
/** Substeps are bounded in metres; even an extreme speed cannot tunnel through
 * an edge. No floor snapping, waypoint teleport, or scripted walking is used. */
export function stepLastLightMovement(state:LastLightMovementState,input:ChamberPoint,deltaMs:number,speed:number):void{
 if(![deltaMs,speed,input.x,input.y].every(Number.isFinite)||deltaMs<=0||speed<=0)return;
 const length=Math.hypot(input.x,input.y);if(length<EPS)return;
 const ux=input.x/Math.max(1,length),uy=input.y/Math.max(1,length);
 let remaining=Math.min(deltaMs,LAST_LIGHT_MAX_STEP_MS)*speed/1000;
 // A 0.5 native-pixel budget is < 4cm on the steepest authored chart.
 let attempts=0;
 while(remaining>EPS&&attempts++<10000){const pixels=Math.min(remaining,.5);remaining-=pixels;
  const d=lastLightWorldDelta(state.route,state,ux*pixels,uy*pixels);
  const next=candidate(state,state.x+d.x,state.z+d.z)??slideCandidate(state,d.x,d.z);
  if(!next)continue;
  const dx=next.x-state.x,dz=next.z-state.z;if(Math.hypot(dx,dz)>EPS)next.facing=Math.atan2(dx,dz);
  Object.assign(state,next);
 }
}
export function getLastLightMovementPosition(state:Readonly<LastLightMovementState>):ReturnType<typeof projectLastLight>{return projectLastLight(state);}
export function canInteractLastLight(state:Readonly<LastLightMovementState>,device:ChamberDevice):boolean{
 if(state.route!==CHAMBER_DEVICE_FLOORS[device])return false;
 const feet=projectLastLight(state),approach=projectLastLight(CHAMBER_DEVICE_WORLD_ANCHORS[device]);
 if(Math.hypot(feet.x-approach.x,feet.y-approach.y)>CHAMBER_INTERACTION_RADIUS)return false;
 const target=CHAMBER_DEVICE_WORLD_ANCHORS[device],distance=Math.hypot(target.x-state.x,target.z-state.z);
 const count=Math.max(1,Math.ceil(distance/.06));
 for(let i=1;i<=count;i++){const t=i/count,x=state.x+(target.x-state.x)*t,z=state.z+(target.z-state.z)*t;
  const surface=sampleLastLightSurface(state.route,x,z);if(!surface||!canStandLastLight({x,y:surface.height,z},state.route))return false;
 }return true;
}

// Compact exact-triangle BVH for physical observation. Constructed lazily once.
interface Node {lo:number[];hi:number[];left?:Node;right?:Node;ids?:number[]}
let sightData:Float32Array|null=null,sightRoot:Node|null=null;
function prepareSight():void{
 if(sightRoot)return;
 const bytes=Uint8Array.from(atob(LAST_LIGHT_OCCLUSION_BASE64),c=>c.charCodeAt(0));sightData=new Float32Array(bytes.buffer);
 const data=sightData;
 const bounds=Array.from({length:data.length/10},(_,id)=>{const o=id*10;return{lo:[0,1,2].map(k=>Math.min(data[o+k]!,data[o+3+k]!,data[o+6+k]!)),hi:[0,1,2].map(k=>Math.max(data[o+k]!,data[o+3+k]!,data[o+6+k]!))};});
 const build=(ids:number[]):Node=>{const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const id of ids){const t=bounds[id]!;for(let k=0;k<3;k++){lo[k]=Math.min(lo[k]!,t.lo[k]!);hi[k]=Math.max(hi[k]!,t.hi[k]!);}}
  if(ids.length<=12)return{lo,hi,ids};let axis=0;for(let k=1;k<3;k++)if(hi[k]!-lo[k]!>hi[axis]!-lo[axis]!)axis=k;
  ids.sort((a,b)=>bounds[a]!.lo[axis]!+bounds[a]!.hi[axis]!-bounds[b]!.lo[axis]!-bounds[b]!.hi[axis]!);
  const mid=ids.length>>1;return{lo,hi,left:build(ids.slice(0,mid)),right:build(ids.slice(mid))};
 };sightRoot=build(bounds.map((_,i)=>i));
}
export function isLastLightSightClear(eye:WorldPoint,target:WorldPoint,ignoreObject=-1):boolean{
 prepareSight();const data=sightData!,root=sightRoot!,o=[eye.x,eye.y,eye.z],d=[target.x-eye.x,target.y-eye.y,target.z-eye.z];
 const stack=[root];
 while(stack.length){const node=stack.pop()!;let low=0.0001,high=.9999;
  for(let k=0;k<3;k++){if(Math.abs(d[k]!)<1e-10){if(o[k]!<node.lo[k]!||o[k]!>node.hi[k]!)high=-1;continue;}
   let a=(node.lo[k]!-o[k]!)/d[k]!,b=(node.hi[k]!-o[k]!)/d[k]!;if(a>b)[a,b]=[b,a];low=Math.max(low,a);high=Math.min(high,b);}
  if(high<low)continue;
  if(!node.ids){if(node.left)stack.push(node.left);if(node.right)stack.push(node.right);continue;}
  for(const id of node.ids){const k=id*10;if(data[k+9]===ignoreObject)continue;
   const ax=data[k]!,ay=data[k+1]!,az=data[k+2]!,ex=data[k+3]!-ax,ey=data[k+4]!-ay,ez=data[k+5]!-az,fx=data[k+6]!-ax,fy=data[k+7]!-ay,fz=data[k+8]!-az;
   const px=d[1]!*fz-d[2]!*fy,py=d[2]!*fx-d[0]!*fz,pz=d[0]!*fy-d[1]!*fx,det=ex*px+ey*py+ez*pz;if(Math.abs(det)<1e-9)continue;
   const tx=o[0]!-ax,ty=o[1]!-ay,tz=o[2]!-az,u=(tx*px+ty*py+tz*pz)/det;if(u<0||u>1)continue;
   const qx=ty*ez-tz*ey,qy=tz*ex-tx*ez,qz=tx*ey-ty*ex,v=(d[0]!*qx+d[1]!*qy+d[2]!*qz)/det;if(v<0||u+v>1)continue;
   const t=(fx*qx+fy*qy+fz*qz)/det;if(t>.001&&t<.999)return false;
  }
 }return true;
}
export function getLastLightObservation(state:Readonly<LastLightMovementState>,moduleId:'CORE'|'STORAGE'|'PURIFIER'):{distance:number;visible:boolean}{
 const key=moduleId.toLowerCase() as ChamberDevice,s=LAST_LIGHT_STATIONS.find(s=>s.key===key)!;
 const feet=projectLastLight(state),base=projectLastLight(worldPoint(s.position)),bounds=s.visualBounds;
 // Distance remains in native projected pixels, but height/floor visibility is 3D.
 const left=base.x+bounds[0]!,right=base.x+bounds[2]!;
 const distance=Math.hypot(Math.max(left-feet.x,0,feet.x-right),feet.y-base.y);
 if(distance>95)return{distance,visible:false};
 const eye={x:state.x,y:state.y+1.43,z:state.z};
 for(const height of [.80,.55,.32])for(const side of [0,-.30,.30]){
  const target={x:s.position[0]!+Math.cos(s.yaw)*side,y:s.position[1]!+s.height*height,z:s.position[2]!-Math.sin(s.yaw)*side};
  if(isLastLightSightClear(eye,target,s.id))return{distance,visible:true};
 }return{distance,visible:false};
}

export class LastLightLocomotion{
 private readonly state:LastLightMovementState;
 constructor(private readonly player:Player){
  this.state=createLastLightMovementState();
  // Build the immutable sight tree during scene setup, before live movement.
  prepareSight();
 }
 update(deltaMs:number):void{
  const input=this.player.getMovementInput();
  const speed=lastLightProjectedWalkingSpeed(this.state,input,LAST_LIGHT_WORLD_WALK_SPEED*this.player.getEffectiveSpeed()/GAME_CONSTANTS.PLAYER.SPEED);
  stepLastLightMovement(this.state,input,deltaMs,speed);
  const feet=projectLastLight(this.state);this.player.applyConstrainedMovement(feet.x,feet.y-CHAMBER_GROUND_OFFSET_Y);
 }
 getRoute():LastLightRoute{return this.state.route;}
 canInteract(device:ChamberDevice):boolean{return canInteractLastLight(this.state,device);}
 getWorldPosition():Readonly<WorldPoint>{return{x:this.state.x,y:this.state.y,z:this.state.z};}
 getWorldFacing():number{return this.state.facing;}
 canRest():boolean{
  if(this.state.route!=='main')return false;
  const a=projectLastLight(this.state),b=projectLastLight(REST_WORLD_APPROACH);if(Math.hypot(a.x-b.x,a.y-b.y)>24)return false;
  const distance=Math.hypot(this.state.x-REST_WORLD_APPROACH.x,this.state.z-REST_WORLD_APPROACH.z),steps=Math.max(1,Math.ceil(distance/.06));
  for(let i=1;i<=steps;i++){const t=i/steps,x=this.state.x+(REST_WORLD_APPROACH.x-this.state.x)*t,z=this.state.z+(REST_WORLD_APPROACH.z-this.state.z)*t,h=sampleLastLightSurface('main',x,z);if(!h||!canStandLastLight({x,y:h.height,z},'main'))return false;}
  return true;
 }
 getObservation(moduleId:'CORE'|'STORAGE'|'PURIFIER'):{distance:number;visible:boolean}{return getLastLightObservation(this.state,moduleId);}
}
