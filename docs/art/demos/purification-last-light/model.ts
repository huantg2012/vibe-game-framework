import { ShapeUtils, Vector2 } from 'three';

export type V3 = readonly [number, number, number];
export type V2 = readonly [number, number];
export type Material = 'stone' | 'cutstone' | 'iron' | 'steel' | 'bronze' | 'wood' | 'paper' | 'cloth' | 'glass' | 'liquid' | 'pollutant' | 'energy' | 'ember' | 'lamp' | 'black';
export type Layer = 'far' | 'middle' | 'near' | 'haven';
export interface Triangle { a: V3; b: V3; c: V3; normal: V3; material: Material; tint: number; object: number; layer: Layer; }
export type LightKind = 'pollution' | 'furnace' | 'shoulder';
export interface Light { position: V3; color: V3; power: number; radius: number; kind: LightKind; id: string; }
export interface Station { id: number; key: string; name: string; position: V3; approach: V3; radius: number; description: string; }
export interface EnergyVolume { center:V3; radii:V3; yaw:number; seed:number; object:number; layer:Layer; }
export const add = (a: V3,b: V3): V3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
export const sub = (a: V3,b: V3): V3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
export const mul = (a: V3,n: number): V3 => [a[0]*n,a[1]*n,a[2]*n];
export const dot = (a: V3,b: V3): number => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const cross = (a: V3,b: V3): V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const unit = (a: V3): V3 => mul(a,1/(Math.hypot(...a)||1));
export const clamp = (n: number,a=0,b=1): number => Math.max(a,Math.min(b,n));
export function random(seed: number): () => number { let n=seed|0; return ()=>{ n|=0;n=n+0x6D2B79F5|0;let t=Math.imul(n^n>>>15,1|n);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; }; }

/** All primitives become ordinary editable triangles. No bitmap supplies their
 * geometry or surface colours. Y is up; units are metres in this art study. */
export class Model {
  readonly triangles: Triangle[]=[];
  readonly lights: Light[]=[];
  readonly volumes: EnergyVolume[]=[];
  object=0;
  layer: Layer='haven';
  private origin: V3=[0,0,0];
  private angle=0;
  energyVolume(center:V3,radii:V3,seed:number):void {
    this.volumes.push({center:this.transform(center),radii,yaw:this.angle,seed,object:this.object,layer:this.layer});
  }
  at(origin: V3,angle: number,object: number,draw:()=>void):void {
    const oldOrigin=this.origin,oldAngle=this.angle,oldObject=this.object;
    this.origin=this.transform(origin);this.angle+=angle;this.object=object;
    try { draw(); } finally {this.origin=oldOrigin;this.angle=oldAngle;this.object=oldObject;}
  }
  private transform(p: V3):V3 { const c=Math.cos(this.angle),s=Math.sin(this.angle);return [this.origin[0]+p[0]*c+p[2]*s,this.origin[1]+p[1],this.origin[2]-p[0]*s+p[2]*c]; }
  triangle(a:V3,b:V3,c:V3,material:Material,tint=1):void {
    a=this.transform(a);b=this.transform(b);c=this.transform(c);
    const normal=unit(cross(sub(b,a),sub(c,a)));
    this.triangles.push({a,b,c,normal,material,tint,object:this.object,layer:this.layer});
  }
  quad(a:V3,b:V3,c:V3,d:V3,material:Material,tint=1):void {this.triangle(a,b,c,material,tint);this.triangle(a,c,d,material,tint);}
  /** Chamfers are geometry, including the narrow top and bottom returns. */
  box(center:V3,size:V3,material:Material,bevel=0,tint=1):void {
    const [cx,cy,cz]=center,[sx,sy,sz]=size.map(n=>n/2) as [number,number,number];
    const b=Math.min(bevel,sx*.6,sy*.6,sz*.6);
    const ring=(y:number,shrink:number):V3[]=>[[cx-sx+shrink+b,y,cz-sz+shrink],[cx+sx-shrink-b,y,cz-sz+shrink],[cx+sx-shrink,y,cz-sz+shrink+b],[cx+sx-shrink,y,cz+sz-shrink-b],[cx+sx-shrink-b,y,cz+sz-shrink],[cx-sx+shrink+b,y,cz+sz-shrink],[cx-sx+shrink,y,cz+sz-shrink-b],[cx-sx+shrink,y,cz-sz+shrink+b]];
    const rings=[ring(cy-sy,b*.35),ring(cy-sy+b,0),ring(cy+sy-b,0),ring(cy+sy,b*.35)];
    for(let k=0;k<3;k++)for(let i=0;i<8;i++){const j=(i+1)%8;this.quad(rings[k]![i]!,rings[k+1]![i]!,rings[k+1]![j]!,rings[k]![j]!,material,tint);}
    for(let i=0;i<8;i++){const j=(i+1)%8;this.triangle([cx,cy+sy,cz],rings[3]![j]!,rings[3]![i]!,material,tint);this.triangle([cx,cy-sy,cz],rings[0]![i]!,rings[0]![j]!,material,tint);}
  }
  beam(a:V3,b:V3,width:number,depth:number,material:Material,tint=1):void {
    const axis=unit(sub(b,a)),side=unit(cross(axis,Math.abs(axis[1])>.94?[1,0,0]:[0,1,0])),up=unit(cross(side,axis));
    const ring=(p:V3):V3[]=>[add(p,add(mul(side,-width/2),mul(up,-depth/2))),add(p,add(mul(side,width/2),mul(up,-depth/2))),add(p,add(mul(side,width/2),mul(up,depth/2))),add(p,add(mul(side,-width/2),mul(up,depth/2)))];
    const ar=ring(a),br=ring(b);
    for(let i=0;i<4;i++){const j=(i+1)%4;this.quad(ar[i]!,ar[j]!,br[j]!,br[i]!,material,tint);}
    this.quad(...ar as [V3,V3,V3,V3],material,tint);this.quad(br[3]!,br[2]!,br[1]!,br[0]!,material,tint);
  }
  cylinder(center:V3,radius:number,height:number,material:Material,segments=20,topRadius=radius,tint=1):void {
    const [x,y,z]=center;
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const p:V3=[x+Math.cos(a)*radius,y-height/2,z+Math.sin(a)*radius],q:V3=[x+Math.cos(b)*radius,y-height/2,z+Math.sin(b)*radius];
      const r:V3=[x+Math.cos(b)*topRadius,y+height/2,z+Math.sin(b)*topRadius],s:V3=[x+Math.cos(a)*topRadius,y+height/2,z+Math.sin(a)*topRadius];
      this.quad(p,s,r,q,material,tint);
      this.triangle([x,y+height/2,z],r,s,material,tint);this.triangle([x,y-height/2,z],p,q,material,tint);
    }
  }
  /** A ring in a vertical plane. Axis is Z. */
  ring(center:V3,radius:number,tube:number,depth:number,material:Material,segments=36,tint=1):void {
    const [x,y,z]=center;
    for(let i=0;i<segments;i++){
      const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
      const pt=(ang:number,r:number,zz:number):V3=>[x+Math.cos(ang)*r,y+Math.sin(ang)*r,z+zz];
      this.quad(pt(a,radius,-depth/2),pt(a,radius,depth/2),pt(b,radius,depth/2),pt(b,radius,-depth/2),material,tint);
      this.quad(pt(a,radius-tube,depth/2),pt(a,radius-tube,-depth/2),pt(b,radius-tube,-depth/2),pt(b,radius-tube,depth/2),material,tint*.82);
      this.quad(pt(a,radius,depth/2),pt(a,radius-tube,depth/2),pt(b,radius-tube,depth/2),pt(b,radius,depth/2),material,tint);
      this.quad(pt(a,radius-tube,-depth/2),pt(a,radius,-depth/2),pt(b,radius,-depth/2),pt(b,radius-tube,-depth/2),material,tint*.75);
    }
  }
  slab(points:readonly V2[],top:number,bottom:number,material:Material,tint=1):void {
    const faces=ShapeUtils.triangulateShape(points.map(p=>new Vector2(p[0],p[1])),[]);
    for(const face of faces){const a=points[face[0]!]!,b=points[face[1]!]!,c=points[face[2]!]!;this.triangle([a[0],top,a[1]],[c[0],top,c[1]],[b[0],top,b[1]],material,tint);}
    for(let i=0;i<points.length;i++){const a=points[i]!,b=points[(i+1)%points.length]!;this.quad([a[0],top,a[1]],[a[0],bottom,a[1]],[b[0],bottom,b[1]],[b[0],top,b[1]],material,tint*.82);}
  }
  rock(center:V3,size:V3,material:Material,seed:number,tint=1):void {
    const rng=random(seed),[cx,cy,cz]=center;
    const ring=(h:number,r:number):V3[]=>Array.from({length:7},(_,i)=>{const a=i/7*Math.PI*2;return [cx+Math.cos(a)*size[0]*r*(.75+rng()*.35),cy+h*size[1],cz+Math.sin(a)*size[2]*r*(.75+rng()*.35)] as V3;});
    const lo=ring(-.45,.46),mid=ring(0,.58),hi=ring(.38,.38);
    for(let i=0;i<7;i++){const j=(i+1)%7;this.quad(lo[i]!,mid[i]!,mid[j]!,lo[j]!,material,tint*(.86+rng()*.25));this.quad(mid[i]!,hi[i]!,hi[j]!,mid[j]!,material,tint*(.87+rng()*.2));this.triangle(hi[i]!,[cx,cy+size[1]*.47,cz],hi[j]!,material,tint);}
  }
  cable(points:readonly V3[],width:number,material:Material,tint=1):void { for(let i=1;i<points.length;i++)this.beam(points[i-1]!,points[i]!,width,width,material,tint); }
  light(position:V3,color:V3,power:number,radius:number,source?:{kind:LightKind;id:string}):void {
    this.lights.push({position:this.transform(position),color,power,radius,kind:source?.kind??'pollution',id:source?.id??`pollution-${this.lights.length}`});
  }
}
