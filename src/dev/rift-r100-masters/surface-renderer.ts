/** Native-pixel material receiver. GPU lighting does not own visibility, collision
 * or grades: the normal Rift fog is composited over this opaque scene texture. */
import type { MasterGroundSurface } from '@/generation/world-study/master-ground-field';
import type { NativeVolumeLighting, NativeVolumeLight } from '@/generation/world-study/native-volume-raster';
import type { MasterWorld } from './world';
import type { PaintedMaterial } from './painted-material';
import { buildMasterSurfaceFields } from './surface-fields';
import { deriveFragmentContamRamp } from '@/entities/form-renderers/d/fragment-ramp';
const VERTEX=`#version 300 es
in vec2 position;out vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0,1);}`;
const FRAGMENT=`#version 300 es
precision highp float;
in vec2 uv;out vec4 color;
uniform sampler2D albedoMap,normalMap,responseMap,emissionMap;
uniform vec2 size;uniform vec4 lights[8];uniform vec4 lightColors[8];
uniform int lightCount,mode;uniform float activity,seconds;
bool darkCell(vec2 cell){
 vec2 at=(cell+.5)*8.;return any(lessThan(at,vec2(0)))||any(greaterThanEqual(at,size))||texture(albedoMap,at/size).a<.5;
}
float materialLightPath(vec2 from,vec2 to){
 vec2 cell=floor(from/8.),end=floor(to/8.),delta=to-from,stepDirection=sign(delta);
 vec2 tStep=vec2(abs(delta.x)>.00001?8./abs(delta.x):1e8,abs(delta.y)>.00001?8./abs(delta.y):1e8);
 vec2 edge=(cell+max(stepDirection,vec2(0)))*8.;
 vec2 next=vec2(abs(delta.x)>.00001?(edge.x-from.x)/delta.x:1e8,abs(delta.y)>.00001?(edge.y-from.y)/delta.y:1e8);
 for(int j=0;j<96;j++){
  if(all(equal(cell,end)))return 1.;
  if(abs(next.x-next.y)<.000001){
   if(darkCell(cell+vec2(stepDirection.x,0))||darkCell(cell+vec2(0,stepDirection.y)))return 0.;
   cell+=stepDirection;next+=tStep;
  }else if(next.x<next.y){cell.x+=stepDirection.x;next.x+=tStep.x;}
  else{cell.y+=stepDirection.y;next.y+=tStep.y;}
  if(darkCell(cell))return 0.;
 }
 return 0.;
}
float heightAt(vec2 xy){vec4 r=texture(responseMap,xy/size);return (floor(r.g*255.+.5)*256.+floor(r.b*255.+.5))/128.;}
float surfaceShade(vec3 p,vec3 lamp){
 float distance=length(lamp.xy-p.xy);int steps=int(clamp(ceil(distance/7.),2.,36.));
 for(int j=1;j<36;j++){
  if(j>=steps)break;float t=float(j)/float(steps);vec3 q=mix(p,lamp,t);
  if(heightAt(q.xy)>q.z+2.)return .22;
 }
 return 1.;
}
void main(){
 vec2 t=vec2(uv.x,1.-uv.y);vec4 a=texture(albedoMap,t);
 if(a.a<.5){color=vec4(0,0,0,1);return;}
 vec4 ns=texture(normalMap,t),rs=texture(responseMap,t);vec3 n=normalize(ns.rgb*2.-1.);
 float height=(floor(rs.g*255.+.5)*256.+floor(rs.b*255.+.5))/128.;
 vec3 p=vec3(t*size,height);float volume=rs.a;
 // Ambient has direction and remains nonzero on shaded structural faces.
 // A sloped face must retain a different value from the floor even when the
 // shoulder light is behind it; it is ordinary visible matter, not eaten light.
 float hemisphere=.48+.52*max(0.,dot(n,normalize(vec3(-.40,-.50,.76))));
 vec3 illumination=vec3(mix(.36,.46*hemisphere,volume)*ns.a),specular=vec3(0);
 for(int i=0;i<8;i++){
  if(i>=lightCount)break;vec3 delta=lights[i].xyz-p;float d=length(delta);
  vec3 ld=delta/max(.01,d);float fall=max(0.,1.-d/lights[i].w);
  float energy=fall*fall*lightColors[i].a;
  if(i>0&&energy>.001)energy*=materialLightPath(p.xy,lights[i].xy);
  // Ordinary mass shades only received light. Ambient material and the native
  // observation mask survive; this can never create tactical absolute black.
  if(energy>.001)energy*=surfaceShade(p,lights[i].xyz);
  float diffuse=max(0.,dot(n,ld));
  illumination+=lightColors[i].rgb*diffuse*energy*mix(1.25,1.,volume);
  // A dense skin returns a restrained moving reflection; rough fines do not.
  // Both still use the same actual light/shadow path and observation mask.
  float sheen=mix(.045,.16,volume*(1.-smoothstep(.55,.75,rs.r)));
  float spec=pow(max(0.,dot(n,normalize(ld+vec3(0,0,1)))),18.+(1.-rs.r)*25.)*(1.-rs.r)*energy*sheen;
  specular+=lightColors[i].rgb*spec;
 }
 vec3 emission=texture(emissionMap,t).rgb;
 // Bound to actual material joints; the signal travels through their existing
 // pixels, never across absent terrain or as a full-screen green filter.
 float travel=sin(seconds*2.2-p.x*.085-p.y*.049);
 float surge=smoothstep(.08,.94,travel);
 float flow=.58+.54*surge; // sustained readable body, bright sections migrate inside it
 illumination=illumination/(vec3(1.)+illumination*.28)*1.15;
 vec3 c=a.rgb*illumination+specular+emission*activity*flow;
 if(mode==1)c=a.rgb;else if(mode==2)c=illumination*.5;else if(mode==3)c=ns.rgb;
 color=vec4(c,1);
}`;
export class MasterSurfaceRenderer {
 readonly canvas:HTMLCanvasElement;
 readonly gpuBytes:number;
 readonly surfaceDiagnostics:Readonly<Record<string,number|string|boolean>>;
 private readonly gl:WebGL2RenderingContext;
 private readonly program:WebGLProgram;
 private readonly textures:WebGLTexture[]=[];
 private readonly buffer:WebGLBuffer;
 private readonly locations:Record<string,WebGLUniformLocation|null>={};
 private readonly positions=new Float32Array(32);
 private readonly colors=new Float32Array(32);
 private destroyed=false;
 constructor(world:MasterWorld,ground:MasterGroundSurface,volume:NativeVolumeLighting,painting?:PaintedMaterial){
  const r=world.raster,w=r.width,h=r.height,size=w*h;
  this.canvas=document.createElement('canvas');this.canvas.width=w;this.canvas.height=h;
  const gl=this.canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,premultipliedAlpha:false,preserveDrawingBuffer:true});
  if(!gl)throw new Error('R100 material renderer requires WebGL2');this.gl=gl;
  try {
  const shader=(type:number,source:string):WebGLShader=>{const value=gl.createShader(type);if(!value)throw new Error('Shader allocation failed');gl.shaderSource(value,source);gl.compileShader(value);if(!gl.getShaderParameter(value,gl.COMPILE_STATUS)){const log=gl.getShaderInfoLog(value);gl.deleteShader(value);throw new Error(log??'Shader compilation failed');}return value;};
  const vertex=shader(gl.VERTEX_SHADER,VERTEX),fragment=shader(gl.FRAGMENT_SHADER,FRAGMENT),program=gl.createProgram();if(!program)throw new Error('Program allocation failed');
  gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)??'Shader link failed');this.program=program;gl.useProgram(program);
  const buffer=gl.createBuffer();if(!buffer)throw new Error('Surface quad allocation failed');this.buffer=buffer;
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const fields=buildMasterSurfaceFields(world),ramp=deriveFragmentContamRamp('frag-outdoor');
  this.surfaceDiagnostics={structuralEmissionPixels:fields.infection.reduce((n,v)=>n+(v>.15?1:0),0),erosionEdgePixels:fields.erosion.reduce((n,v)=>n+(v>.1?1:0),0),blockingSurfaceMaterial:painting?.solid?'dedicated compact skin/fracture atlas and finish; geometric face normals':'object-local UV; no perimeter brightening',greenOwnership:'actual fractured object or authored light-eaten edge; never the whole floor'};
  const albedo=new Uint8Array(size*4),normal=new Uint8Array(size*4),response=new Uint8Array(size*4),emission=new Uint8Array(size*4);
  const axis=painting?world.definition.axis:0,ca=Math.cos(axis),sa=Math.sin(axis),seed=painting?world.sample.seed:0;
  const mirror=(v:number,extent:number):number=>{const period=extent*2,n=((Math.floor(v)%period)+period)%period;return n<extent?n:period-n-1;};
  for(let i=0;i<size;i++){
   const x=i%w,y=Math.floor(i/w),q=i*4,n=i*3;if(!world.matterAt(x,y))continue;
   const hasSurface=r.matter[i]===1,height=hasSurface?r.heightField[i]!:ground.heightField[i]!;
   const cut=hasSurface&&r.material[i]===1;
   const solidPaint=fields.solid[i]===1?painting?.solid:undefined;
   const receiverPaint=solidPaint??painting;
   let paintingIndex=0,worldPaintingIndex=0;
   let paintRegion:'skin'|'cleaved'|'loose'='skin';
   if(receiverPaint){
    // The selected photograph region follows the *construction event*. Lower
    // frequency alone cannot turn loose fracture products into intact skin.
    if(hasSurface){
     paintRegion=cut||r.region[i]===2||r.region[i]===3||r.region[i]===4?'cleaved':'skin';
     // A fibre surface is already exposed lengthwise material; its local UV
     // follows the swept strand instead of putting one world stripe across it.
     if(r.family[i]===2)paintRegion=r.material[i]===2?'loose':'cleaved';
     if(r.family[i]===3&&r.material[i]===2)paintRegion='cleaved';
    }else paintRegion=ground.materialEvents[i]===2?'loose':ground.materialEvents[i]===1?'cleaved':'skin';
    if(solidPaint)paintRegion=cut||r.material[i]===2||r.material[i]===3?'cleaved':'skin';
    // Blocking matter owns its material coordinates. Reusing the substrate's
    // world field makes a shallow, impassable face look like walkable ground.
    const local=fields.solid[i]===1||cut||(hasSurface&&r.family[i]===2);
    const u=local?r.uv[i*2]!:x*ca+y*sa,v=local?r.uv[i*2+1]!:-x*sa+y*ca;
    const scale=receiverPaint.width/receiverPaint.worldSize;
    const px=mirror(u*scale+(seed%83),receiverPaint.width),py=mirror(v*scale+((seed>>>8)%97),receiverPaint.height);
    worldPaintingIndex=(py*receiverPaint.width+px)*4;
    const patch=receiverPaint.regions?.[paintRegion];
    if(patch){
     const left=Math.round(patch.x*receiverPaint.width),top=Math.round(patch.y*receiverPaint.height);
     const pw=Math.min(receiverPaint.width-left,Math.max(1,Math.round(patch.width*receiverPaint.width)));
     const ph=Math.min(receiverPaint.height-top,Math.max(1,Math.round(patch.height*receiverPaint.height)));
     // Preserve the source's native cluster size. Mirroring is continuous at
     // patch limits; no independently randomized tile or artificial outline.
     const sx=left+mirror(u*scale+(seed%83),pw),sy=top+mirror(v*scale+((seed>>>8)%97),ph);
     paintingIndex=(sy*receiverPaint.width+sx)*4;
    }else paintingIndex=worldPaintingIndex;
   }
   let ao=hasSurface?r.ambientOcclusion[i]!:ground.ambientOcclusion[i]!;
   if(!hasSurface){
    let enclosure=0;
    for(const [dx,dy] of [[3,0],[-3,0],[0,3],[0,-3],[7,7],[-7,7],[7,-7],[-7,-7],[14,0],[-14,0],[0,14],[0,-14]]){
     const xx=x+dx!,yy=y+dy!;if(xx<0||yy<0||xx>=w||yy>=h)continue;
     const j=yy*w+xx;if(r.matter[j])enclosure+=Math.min(1,Math.max(0,r.heightField[j]!-height)/Math.hypot(dx!,dy!));
    }
    ao*=1-Math.min(.28,enclosure*.047);
   }
   for(let c=0;c<3;c++){
    // Shallow bedded matter inherits its substrate; only an exposed raised
    // section fully owns the new material. This is a buried foot, not a decal.
    const exposure=fields.solid[i]?1:Math.min(1,Math.max(0,height-ground.heightField[i]!)/10);
    albedo[q+c]=hasSurface?ground.albedo[q+c]!*(1-exposure)+volume.albedo[n+c]!*exposure:ground.albedo[q+c]!;
    if(receiverPaint){
     const pigment=solidPaint?receiverPaint.pixels[paintingIndex+c]!:receiverPaint.pixels[paintingIndex+c]!*.92+receiverPaint.pixels[worldPaintingIndex+c]!*.08;
     // Use the authored tonal range directly, not a second narrow palette ramp.
     // Native geometry, shallow relief and lights continue to own illumination.
     const gain=solidPaint?(paintRegion==='skin'?solidPaint.gain:solidPaint.cutGain):cut?1.12:fields.solid[i]?(r.material[i]===2?.64:.73):hasSurface?.87+.13*exposure:.87;
     albedo[q+c]=Math.min(255,pigment*gain*.94+albedo[q+c]!*.06);
    }
    // The old ground-grain normal field belongs to loose substrate. Compact
    // skins retain the true broad face (only a little of the old microrelief).
    // Image brightness never invents height, collision, visibility or normals.
    const faceNormal=solidPaint?r.normals[n+c]!*.94+volume.shadingNormals[n+c]!*.06:hasSurface?volume.shadingNormals[n+c]!:ground.normals[n+c]!;
    normal[q+c]=Math.round((faceNormal*.5+.5)*255);
    emission[q+c]=hasSurface?Math.min(255,volume.emission[n+c]!):0;
    const erosion=fields.erosion[i]!;
    const infection=Math.max(fields.infection[i]!,erosion*.82);
    if(infection>0){
     // Grey-green altered matter and light share one actual fracture mask.
     // Floor marks are restricted to authored eaten-light edges; their
     // absent interior is kept opaque black by the authoritative mask.
     const pigment=ramp.mid[c]!*.82+ramp.core[c]!*.18;
     albedo[q+c]=albedo[q+c]!*(1-infection*.68)+pigment*infection*.68;
     const glow=(ramp.core[c]!*.66+ramp.mid[c]!*.34)*infection*(erosion>0?.72:1);
     emission[q+c]=Math.max(emission[q+c]!,Math.min(255,glow));
    }
   }
   // A blocking boundary is drawn by its actual section geometry and material.
   // Do not brighten every outside pixel: that cancelled the solid/ground
   // material difference and erased the very edge it was meant to reveal.
   albedo[q+3]=255;normal[q+3]=Math.round(ao*255);
   const encoded=Math.max(0,Math.min(65535,Math.round(height*128)));
   const roughness=hasSurface?volume.roughness[i]!:ground.roughness[i]!;
   // Event-specific pigment and finish change together. This does not derive
   // geometric height or tactical visibility from a dark mark in the source.
   const finish=paintRegion==='loose'?.94:paintRegion==='cleaved'?.76:.86;
   const surfaceFinish=solidPaint?Math.min(.98,(paintRegion==='skin'?solidPaint.skinRoughness:solidPaint.cutRoughness)+(roughness-.7)*.04):painting?roughness*.35+finish*.65:roughness;
   response[q]=Math.round(surfaceFinish*255);response[q+1]=encoded>>>8;response[q+2]=encoded&255;response[q+3]=hasSurface?255:0;
  }
  const names=['albedoMap','normalMap','responseMap','emissionMap'];
  for(const [unit,data]of [albedo,normal,response,emission].entries()){
   const texture=gl.createTexture();if(!texture)throw new Error('Material texture allocation failed');this.textures.push(texture);
   gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.uniform1i(gl.getUniformLocation(program,names[unit]!),unit);
  }
  for(const name of ['size','lights','lightColors','lightCount','mode','activity','seconds'])this.locations[name]=gl.getUniformLocation(program,name);
  gl.uniform2f(this.locations.size!,w,h);gl.viewport(0,0,w,h);this.gpuBytes=size*4*6; // Four immutable inputs, GL target and Phaser copy; excludes driver overhead.
  } catch(error) { gl.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.width=1;this.canvas.height=1;throw error; }
 }
 draw(lights:readonly NativeVolumeLight[],activity:number,seconds:number,mode:number):void{
  if(this.destroyed)return;const gl=this.gl;if(gl.isContextLost())throw new Error('R100 WebGL2 material context was lost');gl.useProgram(this.program);const count=Math.min(8,lights.length);
  for(let i=0;i<count;i++){const l=lights[i]!,q=i*4;this.positions[q]=l.x;this.positions[q+1]=l.y;this.positions[q+2]=l.z;this.positions[q+3]=l.radius;this.colors[q]=l.color[0];this.colors[q+1]=l.color[1];this.colors[q+2]=l.color[2];this.colors[q+3]=l.intensity;}
  gl.uniform4fv(this.locations.lights!,this.positions);gl.uniform4fv(this.locations.lightColors!,this.colors);gl.uniform1i(this.locations.lightCount!,count);gl.uniform1f(this.locations.activity!,activity);gl.uniform1f(this.locations.seconds!,seconds);gl.uniform1i(this.locations.mode!,mode);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 destroy():void{if(this.destroyed)return;this.destroyed=true;const gl=this.gl;for(const texture of this.textures)gl.deleteTexture(texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.width=1;this.canvas.height=1;}
}
