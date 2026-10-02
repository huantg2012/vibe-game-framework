/** Stratified ground is an overlapping deposit, not a noise-coloured plane.
 * Broad beds, cleavage and the fragments liberated at their ends share geometry.
 * The shallow relief is a visual surface; navigation remains owned by the map. */
import type { WorldPalette, WorldMaterial } from './types';

export interface GroundPressureSource { readonly x:number; readonly y:number; readonly rotation:number; readonly length:number; readonly width:number }
export interface MasterGroundOptions {
  readonly width:number; readonly height:number; readonly seed:number; readonly axis:number;
  readonly material:WorldMaterial; readonly palette:WorldPalette; readonly support?:Uint8Array;
  readonly sources?:readonly GroundPressureSource[];
}
export interface MasterGroundSurface {
  readonly width:number; readonly height:number;
  readonly rgba:Uint8ClampedArray; readonly albedo:Uint8ClampedArray;
  readonly normals:Float32Array; readonly heightField:Float32Array;
  readonly roughness:Float32Array; readonly ambientOcclusion:Float32Array;
  /** Deposit ID is useful for checking that a visible edge belongs to a real bed. */
  readonly depositId:Uint16Array;
  /** 0 compact parent, 1 fresh exposure, 2 liberated fines. */
  readonly materialEvents:Uint8Array;
}
export type MasterMaterialEvent='compact'|'cleaved'|'loose';
export interface MasterMaterialSample { tone:number; roughness:number; relief:number }
const clamp=(v:number,a=0,b=1):number=>Math.max(a,Math.min(b,v));
function hash(x:number,y:number,seed:number):number {let h=Math.imul(x^seed,374761393)^Math.imul(y,668265263);h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function smooth(t:number):number{return t*t*(3-2*t);}
function field(x:number,y:number,seed:number):number {const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);return (hash(ix,iy,seed)*(1-fx)+hash(ix+1,iy,seed)*fx)*(1-fy)+(hash(ix,iy+1,seed)*(1-fx)+hash(ix+1,iy+1,seed)*fx)*fy;}
function random(seed:number):()=>number {let s=seed>>>0;return()=>{s+=0x6d2b79f5;let t=Math.imul(s^(s>>>15),1|s);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
function channel(col:number,shift:number):number{return(col>>>shift)&255;}

/** A weather skin peels away from a continuous parent material. The exposure
 * mask is shared by pigment, roughness and relief; it is not a grid of stones.
 * 'compact'/'cleaved' bias the same event rather than selecting unrelated noise.
 * Native pixel clusters are kept inside the exposed faces, with loose aggregate
 * reserved for actual fracture products. */
export function sampleMasterMaterial(material:WorldMaterial,u:number,v:number,seed:number,out:MasterMaterialSample,event:MasterMaterialEvent='compact'):void {
  const warp=field(u/113,v/91,seed+41)-.5;
  const a=u+warp*12,b=v+field(u/89,v/67,seed+47)*7;
  const broad=field(a/103,b/71,seed+59);
  const history=field(a/71,b/43,seed+97)*.72+field(a/27,b/19,seed+131)*.28;
  const bias=event==='cleaved'?.12:event==='loose'?.04:-.06;
  const exposure=smooth(clamp((history+bias-.48)*12));
  // Two distinct brush scales: wide interlocking half-tones and little mineral
  // pits. The latter cannot change the location or character of an exposure.
  const stretch=material==='crystal'?2.2:material==='glaze'?.74:1;
  const pu=Math.floor(a/2)*2/stretch,pv=Math.floor(b/2)*2;
  const cluster=field(pu/23,pv/15,seed+173);
  const clusterStep=Math.floor(cluster*5)/4;
  const mottling=field(pu/7,pv/5,seed+181);
  const grain=hash(Math.floor(u),Math.floor(v),seed+191);
  const compactTone=.32+(broad-.5)*.13+(field(a/32,b/24,seed+193)-.5)*.055;
  const faceTone=.55+(broad-.5)*.12+(clusterStep-.5)*.22+(mottling-.5)*.045;
  // Sparse, finite cleavage marks. They end inside a face; no closed cell
  // outlines, no constant-pitch stripes spanning all material.
  const row=Math.floor(b/26),section=Math.floor(a/53);
  const markV=(row+.23+hash(section,row,seed+211)*.5)*26;
  const markU=(section+.2+hash(section,row,seed+223)*.5)*53;
  const dx=(a-markU)/(8+hash(section,row,seed+227)*13);
  const dy=b-markV+(a-markU)*.075;
  const mark=hash(section,row,seed+229)>.57&&exposure>.78
    ? clamp(1-Math.abs(dx))*clamp(1.2-Math.abs(dy)) : 0;
  const pore=exposure>.5&&cluster<.39&&grain<.07?.07:0;
  const chip=(grain-.5)*(event==='loose'?.08:.025);
  const compactRough=material==='glaze'?.38:material==='crystal'?.64:.85;
  const faceRough=material==='glaze'?.72:material==='crystal'?.38:.67;
  const loose=event==='loose';
  // Fine loose grains have different grouping from a coherent fresh cleavage.
  const aggregate=Math.floor(field(a/5.5,b/4.5,seed+241)*5)/4;
  const looseTone=.37+(broad-.5)*.12+(aggregate-.5)*.27+chip;
  out.tone=clamp(loose?looseTone:compactTone*(1-exposure)+faceTone*exposure-mark*.12-pore+chip,.10,.82);
  out.roughness=loose?.94:compactRough*(1-exposure)+faceRough*exposure+mark*.07;
  // The retained skin sits above the exposed core. It produces a short
  // material lip rather than outlining an independent cobblestone object.
  const faceRelief=(clusterStep-.5)*.24+(mottling-.5)*.08;
  out.relief=loose?(aggregate-.5)*.48:(1-exposure)*.33+faceRelief*exposure-mark*.18+(broad-.5)*.1;
}
interface Bed {x:number;y:number;angle:number;length:number;width:number;rise:number;tone:number;seed:number;kind:number;points:readonly (readonly[number,number])[]}

export function bakeMasterGround(options:MasterGroundOptions):MasterGroundSurface {
  const {width,height,seed,axis,material,palette,support}=options;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>16777216)throw new Error('Invalid ground extent');
  const size=width*height;if(support&&support.length!==size)throw new Error('Ground support extent mismatch');
  const albedo=new Uint8ClampedArray(size*4),rgba=new Uint8ClampedArray(size*4),heightField=new Float32Array(size),normals=new Float32Array(size*3),roughness=new Float32Array(size),ambientOcclusion=new Float32Array(size),depositId=new Uint16Array(size),materialEvents=new Uint8Array(size);
  const tones=new Float32Array(size),sourceU=new Float32Array(size),sourceV=new Float32Array(size),edgeField=new Float32Array(size),surfaceSeed=new Uint32Array(size);
  const rnd=random(seed),ca=Math.cos(axis),sa=Math.sin(axis),sample:MasterMaterialSample={tone:0,roughness:0,relief:0};
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,u=x*ca+y*sa,v=-x*sa+y*ca;
    sampleMasterMaterial(material,u,v,seed,sample);heightField[i]=.45+field(u/180,v/80,seed+51)*.6+sample.relief;
    tones[i]=sample.tone-.015;roughness[i]=sample.roughness;sourceU[i]=u;sourceV[i]=v;surfaceSeed[i]=seed;
  }
  // Successive deposition is deliberately overlapping. No global cell boundary
  // is traced, so compressed beds remain continuous across large quiet regions.
  const beds:Bed[]=[];
  const count=(options.sources?.length??3)*4;
  for(let j=0;j<count;j++){
    const source=options.sources?.[Math.floor(j/4)%(options.sources?.length??1)];
    const sourceAngle=source?.rotation??axis,cx=source?.x??width*.5,cy=source?.y??height*.5;
    const caSource=Math.cos(sourceAngle),saSource=Math.sin(sourceAngle);
    // Fracture products belong to the exposed foot of their parent structure.
    // Do not distribute identical little plates across every square of floor.
    const along=(j%4/3-.5)*(source?.length??width*.7)+(rnd()-.5)*24;
    const across=(source?.width??80)*(.37+rnd()*.38);
    const x=cx+caSource*along-saSource*across,y=cy+saSource*along+caSource*across;
    let angle=axis+(rnd()-.5)*.34,pressure=0;
    for(const source of options.sources??[]){const d=Math.hypot((x-source.x)/Math.max(source.length,.01),(y-source.y)/Math.max(source.width*2,.01)),w=Math.exp(-d*d);pressure=Math.max(pressure,w);angle+=(source.rotation-axis)*w*.45;}
    const length=material==='crystal'?55+rnd()*70:material==='glaze'?32+rnd()*48:38+rnd()*59;
    const widthBed=material==='crystal'?6+rnd()*11:material==='glaze'?22+rnd()*31:12+rnd()*23;
    const bevel=rnd()*.16,short=.14+rnd()*.2;
    const points:Bed['points']=material==='glaze'?[[-.47,-.26],[-.18,-.5],[.34,-.34],[.5,.18],[.06,.47],[-.38,.24]]:material==='crystal'?[[-.5,-.13],[-.29,-.39],[.45,-.28],[.5,.01],[.25,.34],[-.43,.17]]:[[-.5,-.28],[-.5+short,-.48],[.5,-.34],[.33,.05],[.39,.29],[-.19-bevel,.46],[-.39,.18]];
    beds.push({x,y,angle,length,width:widthBed,rise:.16+rnd()*.50+pressure*.18,tone:(rnd()-.5)*.08,seed:Math.floor(rnd()*0xffffffff),kind:0,points});
    // Fines settle beyond the severed end, not uniformly over intact surfaces.
    const tip=length*(.44+rnd()*.1),offset=(rnd()-.5)*widthBed*.3;
    beds.push({x:x+Math.cos(angle)*tip-Math.sin(angle)*offset,y:y+Math.sin(angle)*tip+Math.cos(angle)*offset,angle:angle+(rnd()-.5)*.25,length:25+rnd()*41,width:15+rnd()*21,rise:.03,tone:0,seed:Math.floor(rnd()*0xffffffff),kind:2,points:[[-.5,-.12],[-.22,-.5],[.24,-.37],[.5,.08],[.13,.46],[-.4,.33]]});
    // A few liberated splinters share their parent's fault direction and colour.
    if(rnd()<.8){const fragments=1+Math.floor(rnd()*3);for(let k=0;k<fragments;k++){const shift=length*(.43+rnd()*.16),side=(rnd()-.5)*widthBed;
      beds.push({x:x+Math.cos(angle)*shift-Math.sin(angle)*side,y:y+Math.sin(angle)*shift+Math.cos(angle)*side,angle:angle+(rnd()-.5)*.55,length:9+rnd()*22,width:5+rnd()*11,rise:.9+rnd()*.6,tone:(rnd()-.5)*.15,seed:Math.floor(rnd()*0xffffffff),kind:1,points:[[-.5,-.3],[.08,-.5],[.5,-.1],[.26,.5],[-.5,.2]]});}}
  }
  let id=0;
  for(const bed of beds){id++;const c=Math.cos(bed.angle),s=Math.sin(bed.angle),rad=(bed.length+bed.width)*.55;
    const minX=Math.max(0,Math.floor(bed.x-rad)),maxX=Math.min(width-1,Math.ceil(bed.x+rad)),minY=Math.max(0,Math.floor(bed.y-rad)),maxY=Math.min(height-1,Math.ceil(bed.y+rad));
    const pts=bed.points.map(([x,y])=>[x*bed.length,y*bed.width] as const);
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const dx=x-bed.x,dy=y-bed.y,u=dx*c+dy*s,v=-dx*s+dy*c;let edge=Infinity,inside=true;
      for(let p=0;p<pts.length;p++){const a=pts[p]!,b=pts[(p+1)%pts.length]!,ex=b[0]-a[0],ey=b[1]-a[1],d=(ex*(v-a[1])-ey*(u-a[0]))/Math.hypot(ex,ey);if(d<0){inside=false;break;}edge=Math.min(edge,d);}
      if(!inside)continue;const i=y*width+x;
      // Exposure is one-sided: the upturned break has a 6–12px sloping section;
      // the buried side merges into the bed instead of making a complete outline.
      const exposed=clamp(u/bed.length+.5),lip=bed.kind?2:3+exposed*6;
      const buried=smooth(clamp((u/bed.length+.5)*2.2));
      const bevel=smooth(clamp(edge/lip))*buried,slope=(u/bed.length)*.13;
      // A ground shoulder and the object rising from it use the same material
      // coordinates. Only detached fragments get a fragment-local orientation.
      const mu=bed.kind===1?u+bed.seed%97:x*ca+y*sa;
      const mv=bed.kind===1?v:-x*sa+y*ca;
      const ms=bed.kind===1?bed.seed:seed;
      sampleMasterMaterial(material,mu,mv,ms,sample,bed.kind===2?'loose':'cleaved');
      if(bed.kind===2){
        const amount=smooth(clamp(edge/5))*.86;
        if(amount<.08)continue;
        heightField[i]=heightField[i]!+sample.relief*.06*amount;
        tones[i]=tones[i]!*(1-amount)+(sample.tone+bed.tone)*amount;
        roughness[i]=roughness[i]!*(1-amount)+sample.roughness*amount;
        if(amount>.24){materialEvents[i]=2;sourceU[i]=mu;sourceV[i]=mv;surfaceSeed[i]=ms;}
        continue;
      }
      const h=.68+bed.rise*bevel+slope+sample.relief*bevel;
      if(h<heightField[i]!)continue;
      heightField[i]=h;depositId[i]=id;materialEvents[i]=1;surfaceSeed[i]=ms;sourceU[i]=mu;sourceV[i]=mv;edgeField[i]=edge;
      const fracture=(1-bevel)*exposed,compressed=clamp((field(u/44,v/23,bed.seed+83)-.53)*4);
      const weight=bed.kind?1:clamp(bevel*1.9);
      tones[i]=tones[i]!*(1-weight)+(sample.tone+bed.tone+fracture*.14-compressed*.055)*weight;
      roughness[i]=clamp(sample.roughness+fracture*.14,0.1,1);
    }
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,p=i*4,n=i*3;if(support&&!support[i]){rgba[p+3]=255;continue;}
    const h=heightField[i]!,left=heightField[y*width+Math.max(0,x-1)]!,right=heightField[y*width+Math.min(width-1,x+1)]!,up=heightField[Math.max(0,y-1)*width+x]!,down=heightField[Math.min(height-1,y+1)*width+x]!;
    const nx=(left-right)*.39,ny=(up-down)*.39,nz=1,inv=1/Math.hypot(nx,ny,nz);normals[n]=nx*inv;normals[n+1]=ny*inv;normals[n+2]=inv;
    let enclosure=0;
    for(const[dx,dy]of [[-4,0],[4,0],[0,-4],[0,4],[-8,-4],[8,4]] as const){const xx=clamp(x+dx,0,width-1),yy=clamp(y+dy,0,height-1);enclosure+=Math.max(0,heightField[yy*width+xx]!-h-.15);}
    const ao=clamp(1-enclosure*.047,.65,1);ambientOcclusion[i]=ao;
    const u=sourceU[i]!,v=sourceV[i]!,sd=surfaceSeed[i]!;
    // Mineral flecks only occur inside exposed end-grain, never uniform pepper.
    const endgrain=depositId[i]!==0&&edgeField[i]!<4&&field(u/11,v/7,sd+71)>.62;
    const grain=endgrain&&hash(Math.floor(u/2),Math.floor(v/2),sd)>.77?.12:0;
    const mineral=field(u/9,v/6,sd+37),poreZone=clamp((mineral-.51)*7);
    const granule=hash(Math.floor(u),Math.floor(v),sd+17);
    const grit=materialEvents[i]===2 && poreZone>.2 && granule>.88 ? (granule>.96?.075:-.065)*poreZone : 0;
    const tone=clamp(tones[i]!+grain+grit,.06,.88);
    for(let k=0;k<3;k++){
      const shift=16-k*8,dark=channel(palette.materialDark,shift)*.65+channel(palette.floorDeep,shift)*.35;
      const light=channel(palette.materialLight,shift)*.76+channel(palette.floorLight,shift)*.24;
      const color=dark+(light-dark)*tone;
      albedo[p+k]=Math.round(color);rgba[p+k]=Math.round(color*ao);
    }
    albedo[p+3]=rgba[p+3]=255;
  }
  return{width,height,rgba,albedo,normals,heightField,roughness,ambientOcclusion,depositId,materialEvents};
}
