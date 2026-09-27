import { LAST_LIGHT_DATA } from '../generated/last-light-layout';

export interface WorldPoint { readonly x:number; readonly y:number; readonly z:number }
export interface ChamberPoint { readonly x:number; readonly y:number }
export type ChamberDevice='core'|'storage'|'purifier'|'offering'|'growth'|'rift';
export type LastLightRoute='main'|'upper'|'west-ramp';
export type ChamberPolygon=readonly ChamberPoint[];
export interface WalkTriangle {readonly route:LastLightRoute;readonly points:readonly (readonly number[])[]}
export const LAST_LIGHT_WALK:readonly WalkTriangle[]=LAST_LIGHT_DATA.walk as WalkTriangle[];
export const LAST_LIGHT_OBSTACLES=LAST_LIGHT_DATA.obstacles;
export const LAST_LIGHT_STATIONS=LAST_LIGHT_DATA.stations;
export const CHAMBER_SIZE={width:960,height:640} as const;
export const CHAMBER_CAMERA={x:480,y:320,zoom:1} as const;
export const CHAMBER_GROUND_OFFSET_Y=10;
export const CHAMBER_INTERACTION_RADIUS=24;
export const LAST_LIGHT_FOOT_RADIUS=LAST_LIGHT_DATA.footRadius;
export const LAST_LIGHT_MAX_STEP_MS=100;
export const LAST_LIGHT_HUB_SPEED_MULTIPLIER=1.5;
export const LAST_LIGHT_CAMERA=LAST_LIGHT_DATA.camera;
const direction=LAST_LIGHT_CAMERA.direction;
const norm=Math.hypot(...direction),horizontal=Math.hypot(direction[0]!,direction[2]!);
export const LAST_LIGHT_BASIS={
 back:[direction[0]!/norm,direction[1]!/norm,direction[2]!/norm],
 right:[direction[2]!/horizontal,0,-direction[0]!/horizontal],
 up:[-direction[0]!*direction[1]!/(horizontal*norm),horizontal/norm,-direction[2]!*direction[1]!/(horizontal*norm)],
} as const;
export function projectLastLight(p:WorldPoint):{x:number;y:number;depth:number}{
 const {right,up,back}=LAST_LIGHT_BASIS,c=LAST_LIGHT_CAMERA;
 const x=p.x-c.target[0]!,y=p.y-c.target[1]!,z=p.z-c.target[2]!;
 return{x:c.origin[0]!+c.scale*(right[0]*x+right[2]*z),y:c.origin[1]!-c.scale*(up[0]*x+up[1]*y+up[2]*z),depth:back[0]*x+back[1]*y+back[2]*z};
}
export const worldPoint=(p:readonly number[]):WorldPoint=>({x:p[0]!,y:p[1]!,z:p[2]!});
export interface SurfaceSample {height:number;dx:number;dz:number;triangle:number}
/** The caller supplies the physical layer; overlapping storeys never select it. */
export function sampleLastLightSurface(route:LastLightRoute,x:number,z:number):SurfaceSample|null{
 let result:SurfaceSample|null=null;
 for(let i=0;i<LAST_LIGHT_WALK.length;i++){
  const t=LAST_LIGHT_WALK[i]!;if(t.route!==route)continue;
  const a=t.points[0]!,b=t.points[1]!,c=t.points[2]!;
  const det=(b[2]!-c[2]!)*(a[0]!-c[0]!)+(c[0]!-b[0]!)*(a[2]!-c[2]!);
  if(Math.abs(det)<1e-10)continue;
  const u=((b[2]!-c[2]!)*(x-c[0]!)+(c[0]!-b[0]!)*(z-c[2]!))/det;
  const v=((c[2]!-a[2]!)*(x-c[0]!)+(a[0]!-c[0]!)*(z-c[2]!))/det,w=1-u-v;
  if(u< -1e-8||v< -1e-8||w< -1e-8)continue;
  const height=u*a[1]!+v*b[1]!+w*c[1]!;
  if(result&&result.height>=height)continue;
  const dx=((b[2]!-c[2]!)*(a[1]!-c[1]!)+(c[2]!-a[2]!)*(b[1]!-c[1]!))/det;
  const dz=((c[0]!-b[0]!)*(a[1]!-c[1]!)+(a[0]!-c[0]!)*(b[1]!-c[1]!))/det;
  result={height,dx,dz,triangle:i};
 }return result;
}
function grounded(p:readonly number[],route:LastLightRoute):WorldPoint{
 return{x:p[0]!,y:sampleLastLightSurface(route,p[0]!,p[2]!)?.height??p[1]!,z:p[2]!};
}
export const LAST_LIGHT_SPAWN=grounded(LAST_LIGHT_DATA.spawn,'main');
export const CHAMBER_SPAWN_POINT=projectLastLight(LAST_LIGHT_SPAWN);
export const CHAMBER_DEVICE_BASES={} as Record<ChamberDevice,ChamberPoint>;
export const CHAMBER_DEVICE_ANCHORS={} as Record<ChamberDevice,ChamberPoint>;
export const CHAMBER_DEVICE_FLOORS={} as Record<ChamberDevice,'main'|'upper'>;
export const CHAMBER_DEVICE_WORLD_ANCHORS={} as Record<ChamberDevice,WorldPoint>;
export const CHAMBER_DEVICE_VISUAL_BOUNDS={} as Record<ChamberDevice,readonly[number,number,number,number]>;
export const CHAMBER_DEVICE_FOOTPRINTS={} as Record<ChamberDevice,ChamberPolygon>;
for(const s of LAST_LIGHT_STATIONS){
 const key=s.key as ChamberDevice,floor=s.floor as 'main'|'upper';
 CHAMBER_DEVICE_BASES[key]=projectLastLight(worldPoint(s.position));
 CHAMBER_DEVICE_FLOORS[key]=floor;
 CHAMBER_DEVICE_WORLD_ANCHORS[key]=grounded(s.approach,floor);
 CHAMBER_DEVICE_ANCHORS[key]=projectLastLight(CHAMBER_DEVICE_WORLD_ANCHORS[key]);
 CHAMBER_DEVICE_VISUAL_BOUNDS[key]=s.visualBounds as [number,number,number,number];
 const obstacle=LAST_LIGHT_OBSTACLES.find(o=>o.id===key);
 if(obstacle){const c=Math.cos(obstacle.yaw),ss=Math.sin(obstacle.yaw),b=obstacle.bounds;
  CHAMBER_DEVICE_FOOTPRINTS[key]=[[b[0]!,b[1]!],[b[2]!,b[1]!],[b[2]!,b[3]!],[b[0]!,b[3]!]].map(([x,z])=>projectLastLight({x:obstacle.position[0]!+x!*c+z!*ss,y:obstacle.position[1]!,z:obstacle.position[2]!-x!*ss+z!*c}));
 }else CHAMBER_DEVICE_FOOTPRINTS[key]=LAST_LIGHT_DATA.riftCut.map(p=>projectLastLight({x:p[0]!,y:0,z:p[1]!}));
}
export const REST_POSITION=worldPoint(LAST_LIGHT_DATA.rest.position);
export const REST_YAW=LAST_LIGHT_DATA.rest.yaw;
export const REST_WORLD_APPROACH=grounded(LAST_LIGHT_DATA.rest.approach,'main');
export const REST_APPROACH=projectLastLight(REST_WORLD_APPROACH);
export const CHAMBER_CONTACTS={west:projectLastLight({x:-4.8,y:0,z:.4}),rear:projectLastLight({x:9.5,y:2.6,z:-7.2}),east:projectLastLight({x:14.6,y:0,z:3.9})};
export function chamberFeetToPlayerPosition(p:ChamberPoint):ChamberPoint{return{x:p.x,y:p.y-CHAMBER_GROUND_OFFSET_Y};}
