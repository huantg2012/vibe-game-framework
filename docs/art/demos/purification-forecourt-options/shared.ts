import { buildHaven } from '../purification-last-light/scene';
import { type Model, type V2, type V3, type Station, type Triangle } from '../purification-last-light/model';
import { type Haven } from '../purification-last-light/scene';

export interface Option {
  id: string;
  title: string;
  summary: string;
  tradeoff: string;
  model: Model;
  route: V3[];
  stop: V3;
  footprint: V3[];
  callouts: { text: string; point: V3 }[];
  routes?: {label:string;points:V3[]}[];
  stations?: Station[];
  design?: string[];
  changedObjects?: number[];
  carved?: V2[];
}

export function base() {
  const haven=buildHaven();
  const core=haven.stations.find(s=>s.key==='core')!;
  const world=(x:number,y:number,z:number):V3=>[
    core.position[0]+x*Math.cos(core.yaw)+z*Math.sin(core.yaw),
    core.position[1]+y,
    core.position[2]-x*Math.sin(core.yaw)+z*Math.cos(core.yaw),
  ];
  return {...haven,core,world};
}

/** One rigid transform drives the object, its operation point, volume and light. */
export function relocate(haven:Haven,key:string,position:V3,yaw:number):Station {
  const station=haven.stations.find(s=>s.key===key);
  if(!station)throw new Error(`Unknown station ${key}`);
  const old=station.position,angle=yaw-station.yaw,c=Math.cos(angle),s=Math.sin(angle);
  const rotate=(p:V3):V3=>[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];
  const point=(p:V3):V3=>{const q=rotate([p[0]-old[0],p[1]-old[1],p[2]-old[2]]);return [q[0]+position[0],q[1]+position[1],q[2]+position[2]];};
  for(const t of haven.model.triangles)if(t.object===station.id){t.a=point(t.a);t.b=point(t.b);t.c=point(t.c);t.normal=rotate(t.normal);}
  for(const l of haven.model.lights)if(l.id.startsWith(`${key}-`))l.position=point(l.position);
  for(const v of haven.model.volumes)if(v.object===station.id){v.center=point(v.center);v.yaw+=angle;}
  station.approach=point(station.approach);station.position=position;station.yaw=yaw;
  return station;
}

/** Exact convex subtraction of a vertical opening, preserving every outside
 * triangle fragment. The caller authors the exposed load-bearing section. */
export function carveFloor(model:Model,outline:readonly V2[],ceiling=.25):void {
  const area=outline.reduce((s,p,i)=>{const q=outline[(i+1)%outline.length]!;return s+p[0]*q[1]-q[0]*p[1];},0);
  const orientation=area>=0?1:-1;
  const clip=(polygon:V3[],a:V2,b:V2,inside:boolean):V3[]=>{
    const distance=(p:V3)=>orientation*((b[0]-a[0])*(p[2]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
    const out:V3[]=[];
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i]!,q=polygon[(i+1)%polygon.length]!,dp=distance(p),dq=distance(q);
      const kp=inside?dp>=0:dp<=0,kq=inside?dq>=0:dq<=0;
      if(kp)out.push(p);
      if(kp!==kq){const t=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t]);}
    }return out;
  };
  const result:Triangle[]=[];
  for(const t of model.triangles){
    if(t.object!==0||t.layer!=='haven'||Math.max(t.a[1],t.b[1],t.c[1])>ceiling){result.push(t);continue;}
    let remaining:V3[]=[t.a,t.b,t.c];
    for(let i=0;i<outline.length&&remaining.length>=3;i++){
      const a=outline[i]!,b=outline[(i+1)%outline.length]!,outside=clip(remaining,a,b,false);
      for(let k=1;k<outside.length-1;k++){
        const aa=outside[0]!,bb=outside[k]!,cc=outside[k+1]!;
        const u=[bb[0]-aa[0],bb[1]-aa[1],bb[2]-aa[2]],v=[cc[0]-aa[0],cc[1]-aa[1],cc[2]-aa[2]];
        if(Math.hypot(u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!)>1e-9)result.push({...t,a:aa,b:bb,c:cc});
      }
      remaining=clip(remaining,a,b,true);
    }
  }
  model.triangles.splice(0,model.triangles.length,...result);
}
