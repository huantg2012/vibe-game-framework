/** Native-pixel material receiver. GPU lighting does not own visibility, collision
 * or grades: the normal Rift fog is composited over this opaque scene texture. */
import type { MasterGroundSurface } from '@/generation/world-study/master-ground-field';
import type { NativeVolumeLighting, NativeVolumeLight } from '@/generation/world-study/native-volume-raster';
import type { MasterWorld } from '@/generation/world-study/r100-master-world';
import type { PaintedMaterial } from './painted-material';
import { bakeMasterSurface, type MasterSurfaceBake } from './surface-bake';
import type { SearchSiteMaterialPatch } from './search-site-bake';
import { SEARCH_SITE_CHANNELS } from './search-site-patches';
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
 private readonly searchSites=new Map<string,{patch:SearchSiteMaterialPatch;collected:boolean}>();
 private searchUploadCount=0;
 private searchBufferBytes=0;
 constructor(world:MasterWorld,ground:MasterGroundSurface|undefined,volume:NativeVolumeLighting|undefined,painting?:PaintedMaterial,prepared?:MasterSurfaceBake,searchPatches:readonly SearchSiteMaterialPatch[]=[]){
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
  const baked=prepared??bakeMasterSurface(world,ground!,volume!,painting);
  if(baked.width!==w||baked.height!==h)throw new Error('Prepared native surface dimensions do not match the world');
  const {albedo,normal,response,emission}=baked;
  this.surfaceDiagnostics=baked.diagnostics;
  for(const patch of searchPatches){
   if(this.searchSites.has(patch.nodeId))throw new Error('Duplicate native search patch');
   this.searchSites.set(patch.nodeId,{patch,collected:false});
   this.searchBufferBytes+=patch.width*patch.height*4*4*2;
  }
  const names=['albedoMap','normalMap','responseMap','emissionMap'];
  for(const [unit,data]of [albedo,normal,response,emission].entries()){
   const texture=gl.createTexture();if(!texture)throw new Error('Material texture allocation failed');this.textures.push(texture);
   gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,data);gl.uniform1i(gl.getUniformLocation(program,names[unit]!),unit);
  }
  for(const name of ['size','lights','lightColors','lightCount','mode','activity','seconds'])this.locations[name]=gl.getUniformLocation(program,name);
  gl.uniform2f(this.locations.size!,w,h);gl.viewport(0,0,w,h);this.gpuBytes=size*4*6; // Four inputs, GL target and Phaser copy; no extra search texture/context.
  } catch(error) { gl.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.width=1;this.canvas.height=1;throw error; }
 }
 /** Called before drawing from the search system's actual persisted state.
  * Unchanged phases cost no upload and restoring never replays reveal effects. */
 setSearchSiteCollected(nodeId:string,collected:boolean):void{
  if(this.destroyed||this.searchSites.size===0)return;
  const entry=this.searchSites.get(nodeId);
  if(!entry)throw new Error('Search state has no admitted material patch');
  if(entry.collected===collected)return;
  const gl=this.gl,patch=entry.patch,state=collected?patch.searched:patch.intact;
  for(const [unit,name] of SEARCH_SITE_CHANNELS.entries()){
   gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[unit]!);
   gl.texSubImage2D(gl.TEXTURE_2D,0,patch.x,patch.y,patch.width,patch.height,gl.RGBA,gl.UNSIGNED_BYTE,state[name]);
  }
  entry.collected=collected;this.searchUploadCount++;
 }
 searchDiagnostics():Readonly<Record<string,unknown>>{
  return {count:this.searchSites.size,cpuBytes:this.searchBufferBytes,stateUploads:this.searchUploadCount,
   collected:[...this.searchSites].filter(([,entry])=>entry.collected).map(([id])=>id)};
 }
 draw(lights:readonly NativeVolumeLight[],activity:number,seconds:number,mode:number):void{
  if(this.destroyed)return;const gl=this.gl;if(gl.isContextLost())throw new Error('R100 WebGL2 material context was lost');gl.useProgram(this.program);const count=Math.min(8,lights.length);
  for(let i=0;i<count;i++){const l=lights[i]!,q=i*4;this.positions[q]=l.x;this.positions[q+1]=l.y;this.positions[q+2]=l.z;this.positions[q+3]=l.radius;this.colors[q]=l.color[0];this.colors[q+1]=l.color[1];this.colors[q+2]=l.color[2];this.colors[q+3]=l.intensity;}
  gl.uniform4fv(this.locations.lights!,this.positions);gl.uniform4fv(this.locations.lightColors!,this.colors);gl.uniform1i(this.locations.lightCount!,count);gl.uniform1f(this.locations.activity!,activity);gl.uniform1f(this.locations.seconds!,seconds);gl.uniform1i(this.locations.mode!,mode);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
 }
 destroy():void{if(this.destroyed)return;this.destroyed=true;this.searchSites.clear();this.searchBufferBytes=0;const gl=this.gl;for(const texture of this.textures)gl.deleteTexture(texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);gl.getExtension('WEBGL_lose_context')?.loseContext();this.canvas.width=1;this.canvas.height=1;}
}
