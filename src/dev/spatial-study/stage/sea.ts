import * as THREE from 'three';
import type { RiftDevRuntimeContext } from '@/scenes/rift-scene';
import type { SeaColumn, SlicePoint, SpatialSliceWorld } from '../slice-world';
import { STAGE_HEIGHT, STAGE_WIDTH, noise } from './materials';
import { WaterFlowCycle, createFallingWaterFlow } from '../water-flow';
import { STAGE_PALETTE, pigmentGlsl } from './palette';

interface Vertex {
  x:number; z:number; field:number; top:number; bottom:number;
  topNormal:number[]; bottomNormal:number[]; outward:number[]; index:number;
}
const SEA_STEP=14, GRID_X=-112, GRID_Z=-140;
const MAX_VERTICES=230000;

class VolumeBuffer {
  readonly geometry=new THREE.BufferGeometry();
  readonly positions=new Float32Array(MAX_VERTICES*3);
  readonly normals=new Float32Array(MAX_VERTICES*3);
  count=0;
  constructor(){
    this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('normal',new THREE.BufferAttribute(this.normals,3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(500,100,400),1500);
  }
  reset():void{this.count=0;}
  triangle(a:readonly number[],b:readonly number[],c:readonly number[],normal?:readonly number[]):void{
    if(this.count+3>MAX_VERTICES)throw new Error('Stage water geometry budget exceeded');
    const ux=b[0]!-a[0]!,uy=b[1]!-a[1]!,uz=b[2]!-a[2]!;
    const vx=c[0]!-a[0]!,vy=c[1]!-a[1]!,vz=c[2]!-a[2]!;
    let nx=normal?.[0]??uy*vz-uz*vy,ny=normal?.[1]??uz*vx-ux*vz,nz=normal?.[2]??ux*vy-uy*vx;
    const area=Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx);
    if(area<1e-7)return;
    const length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;
    for(const p of [a,b,c]){const at=this.count++*3;
      this.positions[at]=p[0]!;this.positions[at+1]=p[1]!;this.positions[at+2]=p[2]!;
      this.normals[at]=nx;this.normals[at+1]=ny;this.normals[at+2]=nz;
    }
  }
  smoothTriangle(a:readonly number[],b:readonly number[],c:readonly number[],na:readonly number[],nb:readonly number[],nc:readonly number[]):void{
    if(this.count+3>MAX_VERTICES)throw new Error('Stage water geometry budget exceeded');
    const ux=b[0]!-a[0]!,uy=b[1]!-a[1]!,uz=b[2]!-a[2]!;
    const vx=c[0]!-a[0]!,vy=c[1]!-a[1]!,vz=c[2]!-a[2]!;
    const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    if(nx*nx+ny*ny+nz*nz<1e-14)return;
    // Shared vertices already own unit normals; do not recalculate a flat
    // face normal and then normalize the same vertex for every adjacent face.
    const points=[a,b,c],normals=[na,nb,nc];
    for(let i=0;i<3;i++){
      const p=points[i]!,n=normals[i]!,at=this.count++*3;
      this.positions[at]=p[0]!;this.positions[at+1]=p[1]!;this.positions[at+2]=p[2]!;
      this.normals[at]=n[0]!;this.normals[at+1]=n[1]!;this.normals[at+2]=n[2]!;
    }
  }
  commit():void{this.geometry.setDrawRange(0,this.count);
    this.geometry.getAttribute('position').needsUpdate=true;this.geometry.getAttribute('normal').needsUpdate=true;}
}

const vertexShader=`
varying vec3 worldPoint; varying vec3 worldNormal; varying vec2 screenPoint;
void main(){
 vec4 world=modelMatrix*vec4(position,1.);worldPoint=world.xyz;
 worldNormal=normalize(mat3(modelMatrix)*normal);
 vec4 clip=projectionMatrix*viewMatrix*world;
 screenPoint=clip.xy/clip.w;gl_Position=clip;
}`;
const fragmentShader=`
uniform float clock; uniform float falling; uniform float waterActive; uniform float residue;
uniform vec2 playerScreen; uniform vec2 resolution;
uniform sampler2D terrainPerception; uniform sampler2D terrainHeight; uniform vec2 groundGrid;
uniform sampler2D sceneDepth; uniform float useSceneDepth; uniform mat4 inverseCamera;
uniform vec2 worldSize; varying vec3 worldPoint; varying vec3 worldNormal; varying vec2 screenPoint;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 f=fract(p),i=floor(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float groundAt(vec2 p){
 vec2 grid=clamp(p,vec2(0),worldSize)/8.;vec2 cell=min(floor(grid),groundGrid-2.);vec2 f=grid-cell;
 float a=texture2D(terrainHeight,(cell+.5)/groundGrid).r;
 float b=texture2D(terrainHeight,(cell+vec2(.5,1.5))/groundGrid).r;
 float c=texture2D(terrainHeight,(cell+vec2(1.5,.5))/groundGrid).r;
 float d=texture2D(terrainHeight,(cell+1.5)/groundGrid).r;
 return f.x+f.y<=1.?a+(c-a)*f.x+(b-a)*f.y:d+(b-d)*(1.-f.x)+(c-d)*(1.-f.y);
}
vec3 pigment(float value){
 ${STAGE_PALETTE.sea.slice(0,-1).map((color,i)=>`if(value<${i+.5})return ${pigmentGlsl(color)};`).join('\n ')}
 return ${pigmentGlsl(STAGE_PALETTE.sea[6])};
}
void main(){
 vec3 normal=normalize(worldNormal), pp=floor(worldPoint/2.)*2.;
 float side=1.-abs(normal.y);
 float light=dot(normal,normalize(vec3(-.38,.86,-.28)));
 // Water is the background mass: broad, connected ink and drifting light.
 // Pixel steps live at the shapes' edges, not as a blanket of surface speckle.
 vec2 weave=vec2(pp.x+sin(pp.z/163.-clock*.09)*39.,
   pp.z+sin(pp.x/152.+clock*.075)*28.);
 vec2 flow=weave/vec2(145.,32.)+vec2(-clock*.043,clock*.025);
 float current=n(flow);
 float broad=n(weave/vec2(243.,133.)+vec2(clock*.012,-clock*.009));
 float edgeGrain=(hash(floor(pp.xz/vec2(6.,2.)))-.5)*.025;
 float value=1.+step(.22,light);
 value+=step(.60+edgeGrain,current)*step(.31,broad);
 value+=step(.70+edgeGrain,current)*step(.43,broad);
 value+=step(.79,current)*step(.63,broad);
 // Small light tips follow only a few wide reflections; they never fill the dark mass.
 float crest=n(flow*vec2(.83,1.37)+vec2(3.4,clock*.025));
 value+=step(.84,current)*step(.66,crest)*step(.54,broad);
 if(side>.36){
   vec2 sideWeave=vec2(pp.x+pp.z*.43,pp.y+sin(pp.x/153.-clock*.07)*13.);
   float sheet=n(sideWeave/vec2(131.,37.)+vec2(-clock*.035,clock*.031));
   value=step(.08,light)+step(.57,sheet);
   value+=step(.73,sheet)*step(.24,light);
 }
 vec3 color=pigment(value);
 float alpha=.97;
 if(falling>.5){
   bool contact=normal.y>.72;
   if(contact){
     vec2 ripple=vec2(pp.x/9.+sin(pp.z/19.)*.8,pp.z/5.-clock*5.5);
     float foamPatch=n(ripple);
     color=pigment(waterActive>.5?2.+step(.45,foamPatch)+step(.69,foamPatch)*2.:1.);
     alpha=waterActive>.5?.72:residue*.18;
   }else{
     // Fine fast fragments ride on wider streams. Their texture moves down
     // while the source and trailing edge have independent physical travel.
     float streak=n(vec2(pp.x/8.+sin(pp.y/46.)*.5,pp.y/59.+clock*3.2));
     float filament=n(vec2(pp.x/2.,pp.y/26.+clock*6.7));
     if(streak<.18 && filament<.5)discard;
     value=2.+step(.42,streak)+step(.69,streak)*2.+step(.84,filament);
     color=pigment(value);alpha=.68+step(.68,streak)*.2;
   }
 }
 // Continue the local ground-height reference THROUGH the open chasm for
 // sight projection. This is a query plane, never a drawn floor or depth proxy:
 // a camera ray with no opaque surface must still open the overhead water.
 vec2 gp=vec2(worldPoint.x,worldPoint.z-worldPoint.y/0.7002075382);
 for(int i=0;i<3;i++)gp.y=worldPoint.z-(worldPoint.y-groundAt(gp))/0.7002075382;
 vec2 guv=gp/worldSize;
 float valid=step(0.,guv.x)*step(guv.x,1.)*step(0.,guv.y)*step(guv.y,1.);
 // The continuous reference is a sight query, not evidence that a surface
 // exists on this camera ray. Projecting terrain memory here stamps old tile
 // footprints onto water even where there is only empty space underneath.
 vec2 currentSight=texture2D(terrainPerception,guv).rb*valid;
 vec2 delta=(screenPoint-playerScreen)*resolution*.5;
 float nearPlayer=1.-smoothstep(35.,166.,length(delta/vec2(1.,.83)));
 if(falling<.5){
   float visibleAir=currentSight.x*(1.-currentSight.y);
   float transmission=currentSight.x*.79;
   transmission=max(transmission,visibleAir*.94);
   if(useSceneDepth>.5){
     vec2 pixelUv=gl_FragCoord.xy/resolution;
     float opaqueDepth=texture2D(sceneDepth,pixelUv).r;
     if(opaqueDepth<.999999){
       vec4 actual=inverseCamera*vec4(pixelUv*2.-1.,opaqueDepth*2.-1.,1.);
       vec3 actualPoint=actual.xyz/actual.w;
       vec2 actualUv=actualPoint.xz/worldSize;
       float actualValid=step(0.,actualUv.x)*step(actualUv.x,1.)*step(0.,actualUv.y)*step(actualUv.y,1.);
       float actualSight=texture2D(terrainPerception,actualUv).r*actualValid;
       // A depth sample exists only where the native opaque render has
       // already admitted a real surface. Terrain keeps its own dim memory,
       // but memory must not open an otherwise intact sea above an old shore.
       // Only current sight additionally exposes vertical thickness; natural
       // water openings still show remembered ground without a synthetic cutout.
       float section=smoothstep(2.,7.,groundAt(actualPoint.xz)-actualPoint.y);
       transmission=max(transmission,actualSight*.94*section);
     }
   }
   transmission=max(transmission,nearPlayer*.47);
   alpha-=transmission;
   // A few quiet surface strokes remain above the revealed ground, so its
   // local light cannot become an opaque gray tile pasted onto the sea.
   if(value>3.5)alpha=max(alpha,mix(.39,.08,visibleAir));
 }else if(normal.y<.72){alpha-=nearPlayer*.16;}
 gl_FragColor=vec4(pow(color,vec3(2.2)),clamp(alpha,0.,1.));
 #include <colorspace_fragment>
}`;

export class StageSea {
  readonly group=new THREE.Group();
  private readonly body=new VolumeBuffer();
  private readonly grid:Vertex[]=[];
  private readonly gridColumns:number;
  private readonly gridRows:number;
  private readonly fall=new VolumeBuffer();
  private readonly material:THREE.ShaderMaterial;
  private readonly fallMaterial:THREE.ShaderMaterial;
  private readonly depthMaterial:THREE.ShaderMaterial;
  private readonly perception:THREE.Texture;
  private readonly ownsPerception:boolean;
  private readonly terrainHeight:THREE.Texture;
  private readonly ownsHeight:boolean;
  private readonly flowCycle:WaterFlowCycle;
  private readonly flow=createFallingWaterFlow();
  private readonly column:SeaColumn={field:0,top:0,bottom:0};
  private readonly sourceColumn:SeaColumn={field:0,top:0,bottom:0};
  private readonly projectedPlayer=new THREE.Vector3();
  private lastFrame=-1;
  private lastFallFrame=-1;
  private sourceVisible=false;
  private readonly ray=new THREE.Raycaster();
  private readonly bodyMesh:THREE.Mesh;

  constructor(_context:RiftDevRuntimeContext,private readonly world:SpatialSliceWorld,terrainPerception?:THREE.Texture,terrainHeight?:THREE.Texture,sceneDepth?:THREE.Texture){
    this.gridColumns=Math.ceil((world.width+112-GRID_X)/SEA_STEP)+1;
    this.gridRows=Math.ceil((world.height+28-GRID_Z)/SEA_STEP)+1;
    for(let row=0;row<this.gridRows;row++)for(let col=0;col<this.gridColumns;col++){
      this.grid.push({x:GRID_X+col*SEA_STEP,z:GRID_Z+row*SEA_STEP,field:0,top:0,bottom:0,
        topNormal:[0,1,0],bottomNormal:[0,-1,0],outward:[0,0],index:this.grid.length});
    }
    this.flowCycle=new WaterFlowCycle(world.waterDefinition);
    this.ownsPerception=!terrainPerception;
    this.perception=terrainPerception??new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);
    if(this.ownsPerception)this.perception.needsUpdate=true;
    this.ownsHeight=!terrainHeight;
    this.terrainHeight=terrainHeight??new THREE.DataTexture(new Float32Array([0,0,0,0]),2,2,THREE.RedFormat,THREE.FloatType);
    if(this.ownsHeight){this.terrainHeight.minFilter=this.terrainHeight.magFilter=THREE.NearestFilter;this.terrainHeight.needsUpdate=true;}
    const uniforms={clock:{value:0},falling:{value:0},waterActive:{value:0},residue:{value:0},
      sceneDepth:{value:sceneDepth??this.terrainHeight},useSceneDepth:{value:sceneDepth?1:0},inverseCamera:{value:new THREE.Matrix4()},
      terrainHeight:{value:this.terrainHeight},groundGrid:{value:new THREE.Vector2(terrainHeight?world.ground.columns:2,terrainHeight?world.ground.rows:2)},playerScreen:{value:new THREE.Vector2()},
      terrainPerception:{value:this.perception},worldSize:{value:new THREE.Vector2(world.width,world.height)},
      resolution:{value:new THREE.Vector2(STAGE_WIDTH,STAGE_HEIGHT)}};
    // First establish the nearest water depth AFTER opaque gameplay rendering.
    // Then transmit only that front skin. Far water faces cannot blend through it
    // or overwrite an actor in front, regardless of mesh/triangle insertion order.
    this.depthMaterial=new THREE.ShaderMaterial({vertexShader,fragmentShader:'void main(){gl_FragColor=vec4(0.);}',
      side:THREE.DoubleSide,transparent:true,colorWrite:false,depthWrite:true,depthTest:true});
    this.depthMaterial.forceSinglePass=true;
    this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,uniforms,side:THREE.DoubleSide,
      transparent:true,depthWrite:false,depthTest:true,depthFunc:THREE.EqualDepth});
    this.material.forceSinglePass=true;this.material.toneMapped=false;
    this.fallMaterial=this.material.clone();this.fallMaterial.uniforms.falling!.value=1;
    this.fallMaterial.uniforms.terrainPerception!.value=this.perception;
    this.fallMaterial.uniforms.terrainHeight!.value=this.terrainHeight;
    this.fallMaterial.uniforms.sceneDepth!.value=this.material.uniforms.sceneDepth!.value;
    this.bodyMesh=new THREE.Mesh(this.body.geometry,this.material);this.bodyMesh.frustumCulled=false;
    const fallMesh=new THREE.Mesh(this.fall.geometry,this.fallMaterial);fallMesh.frustumCulled=false;
    const bodyDepth=new THREE.Mesh(this.body.geometry,this.depthMaterial),fallDepth=new THREE.Mesh(this.fall.geometry,this.depthMaterial);
    bodyDepth.frustumCulled=fallDepth.frustumCulled=false;bodyDepth.renderOrder=fallDepth.renderOrder=3;
    this.bodyMesh.renderOrder=fallMesh.renderOrder=4;
    this.group.add(bodyDepth,fallDepth,this.bodyMesh,fallMesh);
  }

  private buildBody(time:number):void{
    this.body.reset();
    // One world sample per grid point. Heights and smooth normals are reused
    // by both caps and all neighbouring cells; they are not resampled per face.
    for(const v of this.grid){
      this.world.sampleSea(v.x,v.z,time,this.column);
      v.field=this.column.field;v.top=this.column.top;v.bottom=this.column.bottom;
    }
    const cols=this.gridColumns,rows=this.gridRows;
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
      const v=this.grid[row*cols+col]!,left=this.grid[row*cols+Math.max(0,col-1)]!,
        right=this.grid[row*cols+Math.min(cols-1,col+1)]!,
        back=this.grid[Math.max(0,row-1)*cols+col]!,front=this.grid[Math.min(rows-1,row+1)*cols+col]!;
      const dx=right.x-left.x,dz=front.z-back.z;
      v.topNormal[0]=-(right.top-left.top)/dx;v.topNormal[2]=-(front.top-back.top)/dz;
      v.topNormal[1]=1;
      v.bottomNormal[0]=(right.bottom-left.bottom)/dx;v.bottomNormal[2]=(front.bottom-back.bottom)/dz;
      v.bottomNormal[1]=-1;
      for(const n of [v.topNormal,v.bottomNormal]){const length=Math.hypot(...n);for(let i=0;i<3;i++)n[i]=n[i]!/length;}
      v.outward[0]=-(right.field-left.field)/dx;v.outward[1]=-(front.field-back.field)/dz;
    }
    const edges=new Map<number,Vertex>();
    const crossing=(a:Vertex,b:Vertex):Vertex=>{
      const key=Math.min(a.index,b.index)*this.grid.length+Math.max(a.index,b.index);
      const cached=edges.get(key);if(cached)return cached;
      let inside=a.field>=0?a:b,outside=a.field<0?a:b;
      let xi=inside.x,zi=inside.z,xo=outside.x,zo=outside.z;
      let x=xi,z=zi;
      // Six bracketed bisections stop below a rendered pixel without collapsing
      // near-zero slivers onto a grid corner. Adjacent faces reuse the vertex.
      for(let n=0;n<6;n++){
        x=(xi+xo)*.5;z=(zi+zo)*.5;
        const field=this.world.seaField(x,z,time);
        if(field>=0){xi=x;zi=z;}else{xo=x;zo=z;}
      }
      x=(xi+xo)*.5;z=(zi+zo)*.5;
      this.world.sampleSea(x,z,time,this.column);
      const t=Math.abs(b.x-a.x)>Math.abs(b.z-a.z)?(x-a.x)/(b.x-a.x):(z-a.z)/(b.z-a.z);
      const interpolate=(aa:readonly number[],bb:readonly number[]):number[]=>aa.map((v,i)=>mix(v,bb[i]!,t));
      const edge:Vertex={x,z,field:0,top:this.column.top,bottom:this.column.bottom,
        topNormal:interpolate(a.topNormal,b.topNormal),bottomNormal:interpolate(a.bottomNormal,b.bottomNormal),
        outward:interpolate(a.outward,b.outward),index:-1};
      for(const n of [edge.topNormal,edge.bottomNormal]){const length=Math.hypot(...n);for(let i=0;i<3;i++)n[i]=n[i]!/length;}
      edges.set(key,edge);return edge;
    };
    const submit=(triangle:readonly Vertex[]):void=>{
      const polygon:Vertex[]=[],crossings:Vertex[]=[];
      for(let i=0;i<3;i++){
        const a=triangle[i]!,b=triangle[(i+1)%3]!;
        if(a.field>=0)polygon.push(a);
        if((a.field>=0)!==(b.field>=0)){const edge=crossing(a,b);polygon.push(edge);crossings.push(edge);}
      }
      if(polygon.length<3)return;
      for(const top of [true,false]){
        const p=polygon.map(v=>[v.x,top?v.top:v.bottom,v.z]);
        const ns=polygon.map(v=>top?v.topNormal:v.bottomNormal);
        for(let i=1;i<p.length-1;i++){
          if(top)this.body.smoothTriangle(p[0]!,p[i+1]!,p[i]!,ns[0]!,ns[i+1]!,ns[i]!);
          else this.body.smoothTriangle(p[0]!,p[i]!,p[i+1]!,ns[0]!,ns[i]!,ns[i+1]!);
        }
      }
      if(crossings.length===2)this.side(crossings[0]!,crossings[1]!);
    };
    for(let row=0;row<rows-1;row++)for(let col=0;col<cols-1;col++){
      const a=this.grid[row*cols+col]!,b=this.grid[row*cols+col+1]!,
        c=this.grid[(row+1)*cols+col+1]!,d=this.grid[(row+1)*cols+col]!;
      if(Math.max(a.field,b.field,c.field,d.field)<0)continue;
      submit([a,b,c]);submit([a,c,d]);
    }
    this.body.commit();
  }

  private side(a:Vertex,b:Vertex):void{
    // A shared contour vertex MUST use its own field gradient. A segment normal
    // makes adjacent round-belly panels move their shared endpoint differently.
    const outward=(v:Vertex):number[]=>{
      const length=Math.hypot(v.outward[0]!,v.outward[1]!)||1;
      return [v.outward[0]!/length,v.outward[1]!/length];
    };
    const an=outward(a),bn=outward(b);
    const at=a.top,ab=a.bottom,bt=b.top,bb=b.bottom;
    for(let r=0;r<7;r++){
      const t=r/7,next=(r+1)/7;
      const p=(v:Vertex,normal:readonly number[],high:number,low:number,f:number):number[]=>{
        const bulge=Math.sin(f*Math.PI)*9;
        return [v.x+normal[0]!*bulge,mix(high,low,f),v.z+normal[1]!*bulge];
      };
      const aa=p(a,an,at,ab,t),ba=p(b,bn,bt,bb,t),ac=p(a,an,at,ab,next),bc=p(b,bn,bt,bb,next);
      const normal=(edge:readonly number[],f:number):number[]=>{
        const n=[edge[0]!*Math.sin(f*Math.PI),Math.cos(f*Math.PI)*.55,edge[1]!*Math.sin(f*Math.PI)];
        const length=Math.hypot(...n);return n.map(v=>v/length);
      };
      const na0=normal(an,t),nb0=normal(bn,t),na1=normal(an,next),nb1=normal(bn,next);
      this.body.smoothTriangle(aa,ba,ac,na0,nb0,na1);this.body.smoothTriangle(ba,bc,ac,nb0,nb1,na1);
    }
  }

  private buildFall(time:number):void{
    this.fall.reset();
    const def=this.world.waterDefinition,frame=this.world.water,outline=this.world.waterOutline;
    const flow=this.flowCycle.sample(time,this.flow),clock=time/1000;
    this.world.sampleSea(def.x,def.y,time,this.sourceColumn);
    const upper=this.sourceColumn.bottom+7;
    // Short asymmetric gathers hang from the source before any water is released.
    if(flow.swell>.01){
      for(let i=0;i<7;i++){
        const x=def.x-45+i*14+noise(i,3,this.world.seed)*5;
        const z=def.y-8+noise(i,4,this.world.seed)*14;
        const drop=flow.swell*(7+noise(i,5,this.world.seed)*15);
        const span=7+noise(i,6,this.world.seed)*8;
        this.fall.triangle([x-span,upper+4,z],[x+span,upper+2,z+3],[x+2,upper-drop,z+4]);
        this.fall.triangle([x+span,upper+2,z+3],[x+4,upper+4,z+10],[x+2,upper-drop,z+4]);
      }
    }
    // Six unequal water sheets have separate necks and bends. Their leading
    // and trailing edges both accelerate down; no part retracts like a hose.
    for(let stream=0;stream<6;stream++){
      const lateral=-56+stream*22+noise(stream,11,this.world.seed)*5;
      const width=7+noise(stream,12,this.world.seed)*7;
      const endZ=def.y+(noise(stream,13,this.world.seed)-.5)*23;
      const flight=def.fallTravelMs*(.86+noise(stream,14,this.world.seed)*.17);
      const front=Math.pow(Math.max(0,Math.min(1,(flow.cycleTime-(flow.contactStart-flight))/flight)),2);
      const tail=Math.pow(Math.max(0,Math.min(1,(flow.cycleTime-(flow.contactEnd-flight))/flight)),2);
      if(front<=tail+.0001)continue;
      const point=(u:number,edge:number):number[]=>{
        const travel=Math.sqrt(u)*flight/1000;
        const sway=Math.sin((clock-travel)*2.4+stream*1.8)*2.8*Math.sin(u*Math.PI);
        const spread=.66+.30*u+.17*u*u;
        const x=def.x+lateral*(.56+.44*u)+edge*width*spread+sway;
        const z=mix(def.y-11+(stream%2)*9,endZ,u)+edge*(stream%2?3:-3)
          +Math.sin((clock-travel)*1.8+stream)*2.5*Math.sin(u*Math.PI);
        const floor=this.world.groundHeightAt(x,z);
        return [x,mix(upper,floor+.65,u),z];
      };
      const slices=20;
      for(let row=0;row<slices;row++){
        const lo=Math.max(tail,row/slices),hi=Math.min(front,(row+1)/slices);
        if(hi<=lo)continue;
        const a=point(lo,-1),b=point(lo,1),c=point(hi,-1),d=point(hi,1);
        this.fall.triangle(a,b,c);this.fall.triangle(b,d,c);
      }
      // Narrow side folds keep sheets from reading as flat vertical cards.
      for(let row=0;row<12;row++){
        const lo=Math.max(tail,row/12),hi=Math.min(front,(row+1)/12);if(hi<=lo)continue;
        const a=point(lo,1),b=point(hi,1);
        this.fall.triangle(a,[a[0]!+2,a[1]!,a[2]!+4],b);
        this.fall.triangle(b,[a[0]!+2,a[1]!,a[2]!+4],[b[0]!+2,b[1]!,b[2]!+4]);
      }
    }
    if(frame.active || flow.residue>.01){
      // Triangulate the authored concave footprint; never fan across a notch.
      const contour=outline.map(p=>new THREE.Vector2(p.x,p.y));
      const triangles=THREE.ShapeUtils.triangulateShape(contour,[]);
      const add=(a:SlicePoint,b:SlicePoint,c:SlicePoint):void=>{
        const p=(v:SlicePoint):number[]=>[v.x,this.world.groundHeightAt(v.x,v.y)+.7,v.y];
        this.fall.triangle(p(a),p(b),p(c),[0,1,0]);
      };
      for(const ids of triangles){
        const a=outline[ids[0]!]!,b=outline[ids[1]!]!,c=outline[ids[2]!]!;
        const ab={x:(a.x+b.x)/2,y:(a.y+b.y)/2},bc={x:(b.x+c.x)/2,y:(b.y+c.y)/2},ca={x:(c.x+a.x)/2,y:(c.y+a.y)/2};
        add(a,ab,ca);add(ab,b,bc);add(ca,bc,c);add(ab,bc,ca);
      }
    }
    // Impact fragments continue their own short ballistic arcs after birth.
    for(let i=0;i<28;i++){
      const birth=flow.contactStart+i*109;
      const age=(flow.cycleTime-birth)/1000;
      if(birth>flow.contactEnd || age<0 || age>.43)continue;
      const baseX=def.x+(noise(i,19,this.world.seed)-.5)*115;
      const baseZ=def.y+(noise(i,23,this.world.seed)-.5)*31;
      const x=baseX+(noise(i,29,this.world.seed)-.35)*65*age;
      const z=baseZ+(noise(i,31,this.world.seed)-.2)*32*age;
      const lift=(22+noise(i,37,this.world.seed)*29)*age-110*age*age;
      if(lift<0)continue;
      const y=this.world.groundHeightAt(x,z)+lift+1,span=.6+noise(i,41,this.world.seed)*1.3;
      this.fall.triangle([x-span,y+2,z],[x+span,y+1,z+1],[x,y,z]);
    }
    this.fall.commit();
  }

  update(time:number,player:Readonly<{x:number;y:number}>,camera:THREE.Camera):void{
    this.projectedPlayer.set(player.x,this.world.groundHeightAt(player.x,player.y)+23,player.y).project(camera);
    for(const material of [this.material,this.fallMaterial]){
      (material.uniforms.inverseCamera!.value as THREE.Matrix4).multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);
      material.uniforms.clock!.value=time/1000;
      material.uniforms.waterActive!.value=this.world.water.active?1:0;
      material.uniforms.residue!.value=this.flowCycle.sample(time,this.flow).residue;
      (material.uniforms.playerScreen!.value as THREE.Vector2).set(this.projectedPlayer.x,this.projectedPlayer.y);
    }
    const frame=Math.floor(time/45);
    if(frame!==this.lastFrame){this.lastFrame=frame;this.buildBody(time);}
    const fallFrame=Math.floor(time/15);
    if(fallFrame!==this.lastFallFrame){this.lastFallFrame=fallFrame;this.buildFall(time);}
  }

  snapshot(camera:THREE.Camera):Record<string,unknown>{
    const def=this.world.waterDefinition;
    const source=new THREE.Vector3(def.x,this.sourceColumn.bottom-1,def.y);
    const direction=new THREE.Vector3();camera.getWorldDirection(direction);direction.negate();
    this.ray.set(source,direction);this.ray.far=2000;
    const hits=this.ray.intersectObject(this.bodyMesh,false);
    this.sourceVisible=hits.length===0;
    return {bodyTriangles:this.body.count/3,fallTriangles:this.fall.count/3,source:source.toArray(),
      sourceLineOfSight:this.sourceVisible,nearestOccluder:hits[0]?.distance??null,
      trueGeometryHoles:true,waterSource:'shared-world-column',contact:'shared-world-water-outline',
      flow:{...this.flow},motion:'feeding / accelerated fall / downward draining tail',pixelSurface:'broad ink masses and sparse drifting reflections; seven pigment values'};
  }

  /** Detached arrays for topology checks; never exposes a mutable live GPU buffer. */
  copyBodyGeometry():{positions:Float32Array;normals:Float32Array}{
    return {positions:this.body.positions.slice(0,this.body.count*3),normals:this.body.normals.slice(0,this.body.count*3)};
  }

  destroy():void{if(this.ownsPerception)this.perception.dispose();if(this.ownsHeight)this.terrainHeight.dispose();}
}

function mix(a:number,b:number,t:number):number{return a+(b-a)*t;}
