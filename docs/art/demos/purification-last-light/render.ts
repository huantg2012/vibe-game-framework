import { add, clamp, cross, dot, mul, sub, unit, type V3, type Triangle, type Model, type Material, type LightKind } from './model';

export interface Camera { width:number; height:number; origin:readonly[number,number]; scale:number; target:V3; direction:V3; }
export const CAMERA:Camera={width:960,height:640,origin:[478,289],scale:26.5,target:[0,0,0],direction:[19,24,30]};
export function cameraBasis(c:Camera){const back=unit(c.direction),right=unit(cross([0,1,0],back)),up=unit(cross(back,right));return {back,right,up};}
export function project(p:V3,c=CAMERA):V3{const b=cameraBasis(c),r=sub(p,c.target);return [c.origin[0]+dot(r,b.right)*c.scale,c.origin[1]-dot(r,b.up)*c.scale,dot(r,b.back)];}

interface RayTriangle { a:V3; e:V3; f:V3; lo:V3; hi:V3; center:V3; }
interface Node {lo:V3;hi:V3;left?:Node;right?:Node;indices?:number[];}
class BVH {
  private readonly triangles:RayTriangle[];
  private readonly root:Node;
  constructor(ts:readonly Triangle[]){
    this.triangles=ts.map(t=>({a:t.a,e:sub(t.b,t.a),f:sub(t.c,t.a),lo:[Math.min(t.a[0],t.b[0],t.c[0]),Math.min(t.a[1],t.b[1],t.c[1]),Math.min(t.a[2],t.b[2],t.c[2])],hi:[Math.max(t.a[0],t.b[0],t.c[0]),Math.max(t.a[1],t.b[1],t.c[1]),Math.max(t.a[2],t.b[2],t.c[2])],center:mul(add(add(t.a,t.b),t.c),1/3)}));
    const build=(ids:number[]):Node=>{
      const lo:[number,number,number]=[Infinity,Infinity,Infinity],hi:[number,number,number]=[-Infinity,-Infinity,-Infinity];
      for(const id of ids){const t=this.triangles[id]!;for(let a=0;a<3;a++){lo[a]=Math.min(lo[a]!,t.lo[a]!);hi[a]=Math.max(hi[a]!,t.hi[a]!);}}
      if(ids.length<=8)return {lo,hi,indices:ids};
      const span=hi.map((n,a)=>n-lo[a]!);let axis=0;if(span[1]!>span[axis]!)axis=1;if(span[2]!>span[axis]!)axis=2;
      ids.sort((a,b)=>this.triangles[a]!.center[axis]!-this.triangles[b]!.center[axis]!);
      const mid=Math.floor(ids.length/2);return {lo,hi,left:build(ids.slice(0,mid)),right:build(ids.slice(mid))};
    };this.root=build(ts.map((_,i)=>i));
  }
  blocked(o:V3,d:V3,max:number):boolean{
    const inv:V3=[1/(d[0]||1e-12),1/(d[1]||1e-12),1/(d[2]||1e-12)];
    const stack=[this.root];
    while(stack.length){const node=stack.pop()!;let enter=0,leave=max;
      for(let a=0;a<3;a++){let t0=(node.lo[a]!-o[a]!)*inv[a]!,t1=(node.hi[a]!-o[a]!)*inv[a]!;if(t0>t1){const t=t0;t0=t1;t1=t;}enter=Math.max(enter,t0);leave=Math.min(leave,t1);}
      if(leave<enter)continue;
      if(node.indices){for(const id of node.indices){const t=this.triangles[id]!;
        const px=d[1]*t.f[2]-d[2]*t.f[1],py=d[2]*t.f[0]-d[0]*t.f[2],pz=d[0]*t.f[1]-d[1]*t.f[0];
        const det=t.e[0]*px+t.e[1]*py+t.e[2]*pz;if(Math.abs(det)<1e-8)continue;
        const it=1/det,tx=o[0]-t.a[0],ty=o[1]-t.a[1],tz=o[2]-t.a[2],u=(tx*px+ty*py+tz*pz)*it;if(u<0||u>1)continue;
        const qx=ty*t.e[2]-tz*t.e[1],qy=tz*t.e[0]-tx*t.e[2],qz=tx*t.e[1]-ty*t.e[0];
        const v=(d[0]*qx+d[1]*qy+d[2]*qz)*it;if(v<0||u+v>1)continue;
        const distance=(t.f[0]*qx+t.f[1]*qy+t.f[2]*qz)*it;if(distance>.008&&distance<max)return true;
      }}else {if(node.left)stack.push(node.left);if(node.right)stack.push(node.right);}
    }return false;
  }
}

const BASE:Record<Material,V3>={stone:[69,73,75],cutstone:[83,86,86],iron:[83,86,84],steel:[116,121,119],bronze:[103,79,51],wood:[73,58,44],paper:[137,128,104],cloth:[70,57,42],glass:[73,90,88],liquid:[48,69,64],pollutant:[64,80,62],energy:[107,140,112],ember:[244,154,57],lamp:[237,209,158],black:[12,17,19]};
const transparent=(t:Triangle):boolean=>t.material==='glass'||t.material==='liquid';
function hash(x:number,y:number,z:number):number {let h=Math.imul(x|0,374761393)+Math.imul(y|0,668265263)+Math.imul(z|0,1442695041);h=Math.imul(h^h>>>13,1274126177);return ((h^h>>>16)>>>0)/4294967296;}
function noise(x:number,y:number,z:number):number {
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z);let fx=x-ix,fy=y-iy,fz=z-iz;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);fz=fz*fz*(3-2*fz);
  let value=0;for(let a=0;a<2;a++)for(let b=0;b<2;b++)for(let c=0;c<2;c++)value+=hash(ix+a,iy+b,iz+c)*(a?fx:1-fx)*(b?fy:1-fy)*(c?fz:1-fz);return value;
}
interface Surface {color:V3; normal:V3; roughness:number; specular:number; emission:number;}
/** Material detail has a world-space scale. Casting skin, stone aggregate,
 * machining and wood fibres do not share one screen noise overlay. */
function sampleSurface(t:Triangle,p:V3,n:V3):Surface {
  const [x,y,z]=p,base=BASE[t.material];
  const medium=noise(x*3.8,y*3.8,z*3.8),coarse=noise(x*.63,y*.63,z*.63);
  const grain=hash(Math.floor(x*22),Math.floor(y*22),Math.floor(z*22));
  let value=.84+medium*.23+grain*.12,roughness=.85,specular=.04,emission=0;
  let color:V3=base;
  if(t.material==='stone'||t.material==='cutstone'){
    const bed=noise(x*1.7,y*1.7,z*1.7),aggregate=hash(Math.floor(x*7),Math.floor(y*7),Math.floor(z*7));
    value=.75+coarse*.17+medium*.21+grain*.065;
    if(aggregate>.89&&medium>.55)value+=.09;
    if(grain<.14&&medium<.35)value*=.82;
    const bump=.17*(t.material==='stone'?1:.5);
    n=unit([n[0]+(noise(x*7+.7,y*7,z*7)-.5)*bump,n[1]+(bed-.5)*bump,n[2]+(noise(x*7,y*7,z*7+.4)-.5)*bump]);
    color=[base[0]*(.97+bed*.08),base[1],base[2]*(1.03-bed*.06)];
  } else if(t.material==='iron'||t.material==='steel'||t.material==='bronze'){
    const cast=noise(x*5.5,y*5.5,z*5.5),patina=clamp((coarse-.5)*2.4);
    value=.81+medium*.13+grain*.035;roughness=t.material==='steel'?.31:.51;specular=t.material==='steel'?.74:.48;
    n=unit([n[0]+(cast-.5)*.065,n[1]+(noise(x*4,y*8,z*4)-.5)*.09,n[2]+(medium-.5)*.075]);
    if(t.material==='iron')color=[base[0]+patina*11,base[1]-patina*6,base[2]-patina*12];
  } else if(t.material==='wood'){
    const fibre=.5+.5*Math.sin(x*43+z*13+Math.sin(y*3)*1.2+coarse*5);
    value=.58+medium*.23+fibre*.22+grain*.1;
  } else if(t.material==='paper')value=.78+coarse*.25+grain*.09;
  else if(t.material==='glass'){roughness=.2;specular=.8;value=.55+medium*.35;}
  else if(t.material==='pollutant'){value=.48+medium*.43+grain*.075;emission=.64+Math.max(0,t.tint-1)*1.9+Math.max(0,medium-.53)*.7;specular=.24;roughness=.47;}
  else if(t.material==='energy'){
    // Radiation has optical density and bright internal seams, no diffuse solid skin.
    const filament=Math.pow(clamp((medium-.35)*2.1),2);
    value=.43+filament*.71;emission=1.3+Math.max(0,t.tint-.7)*1.8;
    specular=0;roughness=1;
  }
  else if(t.material==='ember'){value=.83+medium*.17;emission=1.5;}
  else if(t.material==='lamp'){value=.9;emission=1.22;roughness=.22;specular=.6;}
  return {color:mul(color,value*t.tint),normal:n,roughness,specular,emission};
}

export interface Rendered {
  rgba:Uint8ClampedArray; depth:Float32Array; objects:Uint8Array; layers:Uint8Array;
  emission:Float32Array; triangleCount:number;
  lightFields:Record<LightKind,Uint8ClampedArray>;
  /** R = depth layer, G = object, B = source kind, A = local material phase. */
  motion:Uint8ClampedArray;
}
const LIGHT_KINDS:readonly LightKind[]=['pollution','furnace','shoulder'];
const LIGHT_COLORS:Record<LightKind,V3>={pollution:[.57,.76,.62],furnace:[1,.48,.15],shoulder:[1,.84,.6]};
const sourceKind=(material:Material):LightKind|undefined=>(material==='pollutant'||material==='energy')?'pollution':material==='ember'?'furnace':material==='lamp'?'shoulder':undefined;

/** Fixed camera geometry is lit once into additive source fields. The viewer
 * varies these physically occluded contributions, not a screen-wide colour wash. */
export function render(model:Model,camera:Camera=CAMERA,onProgress?:(message:string)=>void):Rendered {
  const {width:W,height:H}=camera,N=W*H,basis=cameraBasis(camera);
  const depth=new Float32Array(N).fill(-Infinity),indices=new Int32Array(N).fill(-1),positions=new Float32Array(N*3);
  const objects=new Uint8Array(N),layers=new Uint8Array(N),emission=new Float32Array(N),rgba=new Uint8ClampedArray(N*4),motion=new Uint8ClampedArray(N*4);
  const fields:Record<LightKind,Float32Array>={pollution:new Float32Array(N*3),furnace:new Float32Array(N*3),shoulder:new Float32Array(N*3)};
  const layerIndex={far:1,middle:2,near:3,haven:4};
  model.triangles.forEach((t,id)=>{
    if(transparent(t))return;
    const a=project(t.a,camera),b=project(t.b,camera),c=project(t.c,camera);
    const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-7)return;
    const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0])));
    const y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/det;
      const v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/det,w=1-u-v;
      if(u<-.000001||v<-.000001||w<-.000001)continue;
      const d=u*a[2]+v*b[2]+w*c[2],i=y*W+x;if(d<=depth[i]!)continue;
      depth[i]=d;indices[i]=id;objects[i]=t.object;layers[i]=layerIndex[t.layer];
      for(let k=0;k<3;k++)positions[i*3+k]=u*t.a[k]!+v*t.b[k]!+w*t.c[k]!;
    }
  });
  onProgress?.(`Rasterized ${model.triangles.length} triangles; building shadow acceleration.`);
  const bvh=new BVH(model.triangles.filter(t=>!transparent(t)&&t.material!=='energy'));
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=y*W+x,o=i*4,id=indices[i]!;
    // Empty-space scattering stays near charcoal; depth is carried by occluding
    // silhouettes, not a raised blue screen-wide veil.
    const cloud=Math.exp(-(((x-W*.38)/(W*.48))**2+((y-H*.46)/(H*.69))**2));
    const current=noise(x*.008,3,y*.006)*.7+noise(x*.017,1,y*.012)*.3;
    const veil=cloud*(.45+current*.8);
    rgba.set([3+veil*3,5+veil*4,6+veil*4.5,255],o);
    motion.set([layers[i]!,objects[i]!,0,Math.round(noise(x*.03,4,y*.03)*255)],o);
    if(id<0)continue;
    const t=model.triangles[id]!,p:V3=[positions[i*3]!,positions[i*3+1]!,positions[i*3+2]!];
    let n=t.normal;if(dot(n,basis.back)<0)n=mul(n,-1);
    const start=add(p,mul(n,.035));
    const surf=sampleSurface(t,p,n);n=surf.normal;
    let ao=1;
    if(t.layer==='haven'||t.layer==='near'){
      const tangent=unit(cross(n,Math.abs(n[1])>.93?[1,0,0]:[0,1,0])),bitangent=unit(cross(n,tangent));
      const angle=hash(x>>1,y>>1,41)*Math.PI*2;
      let block=0;
      for(let k=0;k<4;k++){const a=angle+k*Math.PI/2,ray=unit(add(mul(n,.65),add(mul(tangent,Math.cos(a)*.76),mul(bitangent,Math.sin(a)*.76))));if(bvh.blocked(start,ray,1.05))block++;}
      ao=1-block*.155;
    }
    // Low diffuse return preserves the objects' material identity in shadow.
    // All coloured/direct/specular light below has one of the three real sources.
    const ambient=(t.layer==='haven'
      ? .18+.12*Math.max(n[1],0)+.19*Math.max(0,dot(n,basis.back))
      : .32+.24*Math.max(n[1],0)+.21*Math.max(0,dot(n,basis.back)))*ao;
    const fog=t.layer==='far'?.55:t.layer==='middle'?.26:t.layer==='near'?.07:0;
    const farDim=t.layer==='far'?.69:t.layer==='middle'?.88:t.layer==='near'?.93:1;
    const distanceFactor=farDim*(1-fog);
    const floorMask=(t.material==='cutstone'||t.material==='stone')&&Math.abs(t.normal[1])>.65&&t.object===0
      ? .76+.16*Math.exp(-(((p[0]-3)/6)**2+((p[2]-3)/5)**2))+.06*noise(p[0]*.23,0,p[2]*.23):1;
    const rgb:[number,number,number]=[0,0,0];
    for(let k=0;k<3;k++)rgb[k]=surf.color[k]!*ambient*[.97,1,1.025][k]!*floorMask*distanceFactor+[8,12,13][k]!*fog;
    for(const light of model.lights){
      const diff=sub(light.position,p),distance=Math.hypot(...diff);if(distance>light.radius)continue;
      const ld=mul(diff,1/Math.max(.01,distance)),nd=Math.max(0,dot(n,ld));if(nd<.012)continue;
      const attenuation=light.power/(1+distance*distance*.27)*clamp(1-(distance/light.radius)**4);
      if(attenuation<.009)continue;
      const shadowDelta=sub(light.position,start),shadowDistance=Math.hypot(...shadowDelta);
      let visibility=bvh.blocked(start,mul(shadowDelta,1/shadowDistance),shadowDistance-.025)?0:1;
      // A finite emitting aperture creates a real penumbra on receiving geometry.
      // Every sample belongs to the same source and carries the same animation.
      const aperture=light.kind==='shoulder'?.085:light.kind==='furnace'?.19:light.id==='core-heart'?.14:0;
      if(aperture){
        visibility*=.5;
        for(const sign of [-1,1]){
          const offset:V3=[light.position[0]+sign*aperture,light.position[1]+.035,light.position[2]+sign*aperture*.55];
          const delta=sub(offset,start),length=Math.hypot(...delta);
          if(!bvh.blocked(start,mul(delta,1/length),length-.025))visibility+=.25;
        }
      }
      if(!visibility)continue;
      const half=unit(add(ld,basis.back));
      const spec=Math.pow(Math.max(0,dot(n,half)),10+(1-surf.roughness)*56)*surf.specular*attenuation*54;
      for(let k=0;k<3;k++){
        const selfResponse=t.material==='energy'?0:t.material==='pollutant'?.46:1;
        const value=(surf.color[k]!*nd*attenuation*selfResponse+spec)*light.color[k]!*distanceFactor*visibility;
        fields[light.kind][i*3+k]!+=value;rgb[k]!+=value;
      }
    }
    const kind=sourceKind(t.material);
    if(kind){
      const outsideGain=kind==='pollution'&&t.layer!=='haven'?1.45:1;
      for(let k=0;k<3;k++){
        const value=surf.color[k]!*surf.emission*outsideGain*distanceFactor;
        fields[kind][i*3+k]!+=value;rgb[k]!+=value;
      }
      emission[i]=kind==='pollution'?clamp((rgb[1]-17)/92,.025,.6):kind==='furnace'?1:.8;
      motion[o+2]=kind==='pollution'?1:kind==='furnace'?2:3;
      motion[o+3]=Math.round(clamp(noise(p[0]*1.5,p[1]*1.5,p[2]*1.5))*255);
    }
    for(let k=0;k<3;k++)rgba[o+k]=Math.round(clamp(rgb[k]!,0,250)/2)*2;
  }
  // Both sides of glass and its contents preserve depth and source-dependent
  // reflections. Light fields are transmitted through the same alpha layers.
  const translucent=model.triangles.filter(transparent).sort((a,b)=>dot(add(add(a.a,a.b),a.c),basis.back)-dot(add(add(b.a,b.b),b.c),basis.back));
  for(const t of translucent){
    const a=project(t.a,camera),b=project(t.b,camera),c=project(t.c,camera);
    const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(det)<1e-7)continue;
    const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(W-1,Math.ceil(Math.max(a[0],b[0],c[0])));
    const y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(H-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const u=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/det;
      const v=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/det,w=1-u-v;
      if(u<0||v<0||w<0)continue;
      const d=u*a[2]+v*b[2]+w*c[2],i=y*W+x;if(d<=depth[i]!)continue;
      let n=t.normal;if(dot(n,basis.back)<0)n=mul(n,-1);
      const p:V3=[u*t.a[0]+v*t.b[0]+w*t.c[0],u*t.a[1]+v*t.b[1]+w*t.c[1],u*t.a[2]+v*t.b[2]+w*t.c[2]];
      const fresnel=(1-Math.max(0,dot(n,basis.back)))**3,liquid=t.material==='liquid';
      const alpha=liquid?.32:.09+fresnel*.34;
      const body=(liquid?.38:.30)+.08*noise(p[0]*9,p[1]*8,p[2]*9);
      const glass:Record<LightKind,number[]>={pollution:[0,0,0],furnace:[0,0,0],shoulder:[0,0,0]};
      for(const light of model.lights){
        const diff=sub(light.position,p),dist=Math.hypot(...diff);if(dist>light.radius)continue;
        const ld=mul(diff,1/Math.max(.01,dist)),half=unit(add(ld,basis.back));
        const strength=light.power/(1+dist*dist*.27)*clamp(1-(dist/light.radius)**4);
        if(bvh.blocked(add(p,mul(n,.03)),ld,dist-.05))continue;
        const spec=Math.pow(Math.max(0,dot(n,half)),36)*(liquid?27:81)*strength;
        for(let k=0;k<3;k++)glass[light.kind][k]!+=(BASE[t.material][k]!*.12*strength+spec)*light.color[k]!;
      }
      for(let k=0;k<3;k++){
        let value=BASE[t.material][k]!*body*t.tint+fresnel*15;
        for(const kind of LIGHT_KINDS){fields[kind][i*3+k]=fields[kind][i*3+k]!*(1-alpha)+glass[kind][k]!*alpha;value+=glass[kind][k]!;}
        rgba[i*4+k]=Math.round(rgba[i*4+k]!*(1-alpha)+value*alpha);
      }
      objects[i]=t.object;layers[i]=layerIndex[t.layer];motion[i*4]=layers[i]!;motion[i*4+1]=t.object;
    }
  }
  onProgress?.('Three source families, contact occlusion, glass and cast shadows complete.');
  // Source-only scattering, with separate colours and source fields. Normal
  // object edges remain sharp; no blur is applied to the underlying artwork.
  const scatter=new Float32Array(N*3);
  for(let i=0;i<N;i++)if(emission[i]!>.035){
    const x=i%W,y=Math.floor(i/W),code=motion[i*4+2]!,kind:LightKind=code===1?'pollution':code===2?'furnace':'shoulder';
    const radius=kind==='pollution'?7:9,weight=kind==='pollution'?.023:.027;
    for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
      const xx=x+dx,yy=y+dy;if(xx<0||xx>=W||yy<0||yy>=H)continue;
      const j=yy*W+xx,g=Math.exp(-(dx*dx+dy*dy)/(kind==='pollution'?18:24))*weight*emission[i]!;
      if(indices[j]!>=0&&depth[j]!>depth[i]!+.6)continue;
      for(let k=0;k<3;k++){const value=LIGHT_COLORS[kind][k]!*g*66;fields[kind][j*3+k]!+=value;scatter[j*3+k]!+=value;}
    }
  }
  for(let i=0;i<N;i++)for(let k=0;k<3;k++)rgba[i*4+k]=clamp(rgba[i*4+k]!+scatter[i*3+k]!,0,255);
  const lightFields={} as Record<LightKind,Uint8ClampedArray>;
  for(const kind of LIGHT_KINDS){const out=new Uint8ClampedArray(N*4);for(let i=0;i<N;i++){for(let k=0;k<3;k++)out[i*4+k]=fields[kind][i*3+k]!;out[i*4+3]=255;}lightFields[kind]=out;}
  return {rgba,depth,objects,layers,emission,triangleCount:model.triangles.length,lightFields,motion};
}
