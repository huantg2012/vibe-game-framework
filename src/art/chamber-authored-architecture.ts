import { ENVIRONMENT_FACES, MATERIAL, type Layer, type Face } from '../../assets/source/purification-r9/environment';
import { CHAMBER_WALK_POLYGONS } from '../systems/purification-chamber-layout';
import type { ChamberPixels, ChamberPoint } from './purification-chamber-pixels';
import type { SurfacePlane } from './chamber-surface-map';

/** All production and offline plates consume the same named source faces. */
export function paintAuthoredEnvironmentLayer(p: ChamberPixels, layer: Layer): void {
  for (const face of ENVIRONMENT_FACES) {
    if (face.layer !== layer) continue;
    p.setPlane(face.plane);
    paintMaterial(p, face.points, face.color, materialFor(face), hashName(face.id));
  }
  p.setPlane(null);
}

/** Complete load-bearing shell; floor surfaces are a separate plate. */
export function paintAuthoredChamberArchitecture(p: ChamberPixels): void {
  paintAuthoredEnvironmentLayer(p, 'architecture');
}

export function paintAuthoredChamberFloor(p: ChamberPixels): void {
  p.setPlane({ normal: [0,0,1], elevation: 0, occlusion: .96, roughness: .94 });
  paintMaterial(p, poly('main'), MATERIAL.floor, 'floor', 182);
  p.setPlane({ normal: [0,0,1], elevation: 32, occlusion: .97, roughness: .93 });
  paintMaterial(p, poly('upper'), MATERIAL.upper, 'floor', 248);
  paintAuthoredEnvironmentLayer(p, 'floor');
  paintRamp(p, 'left-stair');
  paintRamp(p, 'right-stair');
  // Contact shadows are authored in the R9 floor plate at the actual wall feet.
  p.setPlane(null);
}

export function paintAuthoredChamberForeground(p: ChamberPixels): void {
  paintAuthoredEnvironmentLayer(p, 'foreground');
}

function poly(route: keyof typeof CHAMBER_WALK_POLYGONS): ChamberPoint[] {
  return CHAMBER_WALK_POLYGONS[route].map(({x,y}) => [x,y]);
}

function paintRamp(p: ChamberPixels, route: 'left-stair' | 'right-stair'): void {
  const points = poly(route);
  const [a,b,e,d] = points as [ChamberPoint, ChamberPoint, ChamberPoint, ChamberPoint];
  const slope = -32 / (d[1] - a[1]);
  const plane: SurfacePlane = { normal: [0,-slope,1+slope], elevation: 32,
    originY: a[1], riseY: slope, occlusion: .98, roughness: .94 };
  p.setPlane(plane);
  paintMaterial(p, points, MATERIAL.slateWorn, 'concrete', route === 'left-stair' ? 281 : 375);
  // Worn broad centre is continuous, treads follow the exact physical slope.
  paintMaterial(p, [[a[0]+8,a[1]],[b[0]-9,b[1]],[e[0]-9,e[1]],[d[0]+8,d[1]]], MATERIAL.concrete, 'floor', 73);
  for (let step = 1; step < 7; step++) {
    const t = step / 7;
    const x1 = a[0] + (d[0] - a[0]) * t + 1;
    const x2 = b[0] + (e[0] - b[0]) * t - 1;
    const y = a[1] + (d[1] - a[1]) * t;
    const treadShift = (d[0]-a[0]) / (d[1]-a[1]) * 2;
    p.poly([[x1,y],[x2,y],[x2+treadShift,y+2],[x1+treadShift,y+2]], MATERIAL.floorShade);
    if (step === 2 || step === 5) p.line(x1+8,y-1,x1+22,y-1,MATERIAL.slateWorn);
  }
  p.setPlane(null);
}


type Finish = 'none' | 'concrete' | 'lime' | 'floor' | 'middle' | 'near' | 'steel';
/** Finish is assigned to the authored material plane, never to its silhouette.
 * Broad mineral bodies, connected lamination and sparse inclusions use distinct
 * scales. There is no all-room point emitter and no brightness-derived normal. */
function materialFor(face: Face): Finish {
  if (face.layer === 'far') return 'none';
  if (face.layer === 'middle') return 'middle';
  if (face.layer === 'near') return face.plane ? 'near' : 'none';
  if (face.layer === 'floor') return 'floor';
  if ([MATERIAL.steel, MATERIAL.steelEdge, MATERIAL.steelSide].includes(face.color as never)) return 'steel';
  if ([MATERIAL.plaster, MATERIAL.plasterShade, MATERIAL.plasterWorn, MATERIAL.lime].includes(face.color as never)) return 'lime';
  if ([MATERIAL.deep, MATERIAL.cavity, MATERIAL.underside].includes(face.color as never)) return 'none';
  return 'concrete';
}

const finishSettings: Record<Exclude<Finish,'none'>, readonly [number,number,number,number]> = {
  // broad scale x/y, aggregate strength, broad mineral contrast
  concrete: [29,13,7,7], lime: [31,21,4,9], floor: [32,13,5,5],
  middle: [34,16,2,3], near: [25,12,6,7], steel: [30,5,1,2],
};
function paintMaterial(p: ChamberPixels, points: readonly ChamberPoint[], base: string,
  finish: Finish, seed: number): void {
  if (finish === 'none') { p.poly(points,base); return; }
  const [scaleX,scaleY,grain,contrast] = finishSettings[finish];
  const rgb = parseInt(base.slice(1),16);
  const red=rgb>>16, green=(rgb>>8)&255, blue=rgb&255;
  // Deliberate stepped pigment ramps retain pixel clusters without a washed gradient.
  const ramp=[-5, -2, 0, 2, 5].map(change=> {
    return '#'+[red+change,green+change,blue+change].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');
  });
  const y0=Math.ceil(Math.min(...points.map(v=>v[1]))), y1=Math.ceil(Math.max(...points.map(v=>v[1])));
  for(let y=y0;y<y1;y++) {
    const intersections: number[]=[];
    for(let i=0;i<points.length;i++) {
      const a=points[i]!,b=points[(i+1)%points.length]!;
      if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))
        intersections.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));
    }
    intersections.sort((a,b)=>a-b);
    for(let segment=0;segment+1<intersections.length;segment+=2) {
      const start=Math.ceil(intersections[segment]!),end=Math.ceil(intersections[segment+1]!);
      let previous=-1,run=start;
      for(let x=start;x<end;x++) {
        const body=field(Math.floor(x/2)*2/scaleX,Math.floor(y/2)*2/scaleY,seed);
        const stratum=finish==='lime' ? field(x/5,y/24,seed+31)
          : field((x+y*.26)/22,Math.floor(y/2)*2/5,seed+31);
        // Large authored slabs/joints carry the design. Sparse connected pigment
        // clusters only vary intact material; no per-pixel aggregate noise.
        const emphasis = contrast >= 7 && grain >= 4;
        const at = body < .24 ? (emphasis ? 0 : 1)
          : body < .37 && stratum < .5 ? 1
          : body > .77 ? (emphasis ? 4 : 3)
          : body > .62 && stratum > .65 ? 3 : 2;
        if(at!==previous) {
          if(x>run) p.rect(run,y,x-run,1,ramp[previous]!);
          run=x; previous=at;
        }
      }
      if(end>run) p.rect(run,y,end-run,1,ramp[previous]!);
    }
  }
}
function hashName(name:string):number {
  let value=0; for(let i=0;i<name.length;i++) value=(Math.imul(value,31)+name.charCodeAt(i))|0;
  return value;
}
function noise(x:number,y:number,seed:number):number {
  let value=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(seed,1274126177);
  value=Math.imul(value^(value>>>13),1274126177);
  return ((value^(value>>>16))>>>0)/4294967295;
}
function field(x:number,y:number,seed:number):number {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy);
  const a=noise(ix,iy,seed),b=noise(ix+1,iy,seed),c=noise(ix,iy+1,seed),d=noise(ix+1,iy+1,seed);
  return (a+(b-a)*sx)*(1-sy)+(c+(d-c)*sx)*sy;
}
