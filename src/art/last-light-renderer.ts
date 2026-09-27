import { LastLightOcclusion, lastLightBasis, projectLastLight, unprojectLastLight,
  type LastLightCamera, type LightVector } from './last-light-spatial';

export interface LastLightFrame {
  x: number; y: number; width: number; height: number;
  anchor: readonly [number, number]; yaw: number; pose: 'idle' | 'walk' | 'sit';
  phase: number; lamp: LightVector;
}
export interface LastLightLight { position: LightVector; color: LightVector; power: number; radius: number; id: string }
export type LastLightImage = HTMLImageElement | ImageBitmap;
export interface LastLightRenderImages {
  scene: LastLightImage; background: LastLightImage; far: LastLightImage; middle: LastLightImage; near: LastLightImage;
  pollution: LastLightImage; coreLight: LastLightImage; storageLight: LastLightImage; purifierLight: LastLightImage; furnace: LastLightImage;
  motion: LastLightImage; depth: LastLightImage; energy: LastLightImage; volumeDepth: LastLightImage; exteriorDepth: LastLightImage;
  normal: LastLightImage; albedo: LastLightImage; rough: LastLightImage;
  actorColor: LastLightImage; actorNormal: LastLightImage; actorDepth: LastLightImage; actorRough: LastLightImage;
}
export interface LastLightRenderPack {
  camera: LastLightCamera; frames: readonly LastLightFrame[]; lights: readonly LastLightLight[];
  occluders: ArrayLike<number>; images: LastLightRenderImages;
  /** Already shaded, same-source portrait; never display a raw albedo map in UI. */
  actorPortrait: LastLightImage;
  actorDepthOffset: number; actorDepthScale: number;
  /** Full hidden exterior plates include a guard band on every side. */
  exteriorPadding: number; exteriorParallax: readonly [number, number, number];
}
export interface LastLightRenderState {
  seconds: number; world: LightVector; yaw: number; walking: boolean; resting: boolean;
  health: readonly [number, number, number]; charge: number; growth: number; thicken: number;
  pulses: Float32Array; reducedMotion: boolean;
}
const VERTEX = `#version 300 es
in vec2 aPosition; out vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const COMMON = `
precision highp float;
in vec2 vUv;layout(location=0) out vec4 fragColor;
uniform float uSeconds;
uniform vec2 uSize;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float coreExpansion(float t){float c=mod(t/4.8,1.);return c<.7?(1.-cos(3.14159265*c/.7))*.5:(1.+cos(3.14159265*(c-.7)/.3))*.5;}
float fire(float t){return .072*sin(t*4.31)+.035*sin(t*11.73)+.019*sin(t*19.19)+.043*(noise(vec2(t*2.9,18.6))-noise(vec2(0,18.6)));}
float pulse(float t){return .105*sin(t*.61)+.038*sin(t*.213);}
float decodeDepth(vec4 d){vec2 e=floor(d.rg*255.+.5);return(e.x*256.+e.y)/256.-80.;}
vec2 uvAt(vec2 px){return vec2(px.x/uSize.x,1.-px.y/uSize.y);}
`;
const ENVIRONMENT = `#version 300 es
${COMMON}
layout(location=1) out vec4 resolvedOpaqueDepth;
uniform sampler2D uScene,uBackground,uFar,uMiddle,uNear,uPollution,uCore,uFurnace,uMotion,uDepth,uEnergy,uExteriorDepth,uStorage,uPurifier;
uniform vec2 uObserver,uPlateSize;
uniform vec3 uParallax;
uniform float uPadding;
uniform vec3 uHealth;
uniform float uCharge,uGrowth,uThicken;
uniform float uPulses[6];
vec2 plateUv(vec2 pixel,vec2 offset){vec2 p=pixel+vec2(uPadding)-offset;return vec2(p.x/uPlateSize.x,1.-p.y/uPlateSize.y);}
vec4 plateDepth(vec2 uv,float layer){return texture(uExteriorDepth,vec2(uv.x,(3.-layer+uv.y)/4.));}
void orderLayers(inout vec4 a,inout float ad,inout vec4 b,inout float bd){if(ad>bd){vec4 c=a;a=b;b=c;float d=ad;ad=bd;bd=d;}}
vec4 energyFrame(vec2 uv,float frame){return texture(uEnergy,(vec2(mod(frame,4.),1.-floor(frame/4.))+uv)/vec2(4,2));}
void main(){
 vec2 pixel=floor(vec2(vUv.x,1.-vUv.y)*uSize)+.5,uv=uvAt(pixel);
 vec4 haven=texture(uScene,uv);
 vec3 color=texture(uBackground,uv).rgb;
 vec2 farUv=plateUv(pixel,clamp(-uObserver*uParallax.x,vec2(-24),vec2(24))),middleUv=plateUv(pixel,clamp(-uObserver*uParallax.y,vec2(-24),vec2(24)));
 vec4 far=texture(uFar,farUv),middle=texture(uMiddle,middleUv);
 // Near masonry remains bonded to the platform; only its remote tips move.
 float attachment=1.-smoothstep(220.,640.,pixel.x);
 vec2 nearUv=plateUv(pixel,clamp(-uObserver*uParallax.z*attachment,vec2(-24),vec2(24)));
 vec4 near=texture(uNear,nearUv);
 vec4 farDepth=plateDepth(farUv,0.),middleDepth=plateDepth(middleUv,1.),nearDepth=plateDepth(nearUv,2.);
 vec4 havenDepth=plateDepth(plateUv(pixel,vec2(0)),3.);
 float fd=decodeDepth(farDepth),md=decodeDepth(middleDepth),nd=decodeDepth(nearDepth),hd=decodeDepth(havenDepth);
 // Write the exact same shifted, winning opaque sample used for composition.
 // The next pass must never read the unmoved whole-scene depth for occlusion.
 vec4 resolved=farDepth;float closest=fd;
 if(md>closest){resolved=middleDepth;closest=md;}
 if(nd>closest){resolved=nearDepth;closest=nd;}
 if(hd>closest){resolved=havenDepth;closest=hd;}
 resolvedOpaqueDepth=resolved;
 orderLayers(far,fd,middle,md);orderLayers(near,nd,haven,hd);
 orderLayers(far,fd,near,nd);orderLayers(middle,md,haven,hd);orderLayers(middle,md,near,nd);
 color=far.rgb+color*(1.-far.a);color=middle.rgb+color*(1.-middle.a);color=near.rgb+color*(1.-near.a);
 color=haven.rgb+color*(1.-haven.a);
 vec4 data=texture(uMotion,uv);float layer=floor(data.r*255.+.5),id=floor(data.g*255.+.5),source=floor(data.b*255.+.5);
 vec3 core=texture(uCore,uv).rgb,storage=texture(uStorage,uv).rgb,purifier=texture(uPurifier,uv).rgb;
 vec3 other=max(texture(uPollution,uv).rgb-core-storage-purifier,vec3(0));
 float t=uSeconds,expansion=coreExpansion(t),coreChange=.22*expansion,coreGain=.25+.75*uHealth.x;
 color+=other*pulse(t)+core*(coreGain*(1.+coreChange)-1.)
   +storage*((.25+.75*uHealth.y)*(1.+pulse(t))-1.)
   +purifier*((.25+.75*uHealth.z)*(1.+pulse(t))-1.)
   +texture(uFurnace,uv).rgb*fire(t);
 if(source>.5&&source<1.5&&(id<.5||id>1.5)){
  float seed=data.a*19.+pixel.y*.009;
  color-=other*(smoothstep(.64,.93,sin(seed-t*.31))-smoothstep(.64,.93,sin(seed)))*.058;
 }
 if(layer<3.5&&id<.5){
  float presence=layer<.5?1.:layer<1.5?.45:layer<2.5?.14:.035;
  vec2 p=pixel*vec2(.0067,.0048);
  color+=vec3(.005,.006,.006)*(noise(p+vec2(t*.007,-t*.009))-noise(p))*presence;
  float clock=mod(t,23.),alternate=mod(floor(t/23.),2.);
  float life=smoothstep(5.4,6.5,clock)*(1.-smoothstep(8.85,10.1,clock));
  vec2 center=mix(vec2(239,142),vec2(609,200),alternate),q=pixel-center;
  float entityDepth=mix(-18.2,-16.7,alternate),depth=closest;
  float aperture=1.-smoothstep(.56,1.,length(q/mix(vec2(130,106),vec2(114,79),alternate)));
  float edge=q.y-(.0026*q.x*q.x+q.x*.19+sin(q.x*.024+t*.19)*8.5-22.+(clock-7.7)*27.);
  float mass=smoothstep(-1.6,2.1,edge)*(1.-smoothstep(48.,93.,edge));
  color*=1.-mass*aperture*life*(1.-smoothstep(entityDepth-.35,entityDepth+.1,depth))*.3;
 }
 if(id>=1.&&id<=6.){
  int index=int(id)-1;float response=uPulses[index];
  // Saved investments change the existing metal/source response, not geometry,
  // and cannot reveal next-cycle forecasts or imply extra module efficacy.
  float grain=step(.94,hash(floor(pixel*.5)));
  color+=color*response*.3+vec3(.018,.012,.005)*grain*min(uThicken,5.)*.12;
  if(id>3.5&&id<4.5)color+=other*uCharge*(.07+.025*sin(t*.7));
  if(id>4.5&&id<5.5)color+=other*min(uGrowth,12.)*.014;
 }
 fragColor=vec4(clamp(color,0.,1.),1.);
}`;
const COMPOSITE = `#version 300 es
${COMMON}
uniform sampler2D uEnvironment,uDepth,uNormal,uAlbedo,uRough,uVisibility,uActorColor,uActorNormal,uActorDepth,uActorRough,uCore,uFurnace,uVolumeDepth,uResolvedDepth,uEnergy;
uniform vec3 uRight,uUp,uBack,uTarget,uActorWorld,uLamp;
uniform vec2 uOrigin;
uniform float uScale,uActorDepthOffset,uActorDepthScale,uResting;
uniform vec4 uActorRect;
uniform vec2 uActorTop,uActorAtlasSize;
uniform int uLightCount;
uniform vec4 uLights[48];
uniform vec4 uLightColors[48];
uniform float uLightKinds[48],uLightGains[48],uActorVisibility[48];
uniform vec3 uShadowLights[2];
uniform float uCoreGain;
vec4 energyFrame(vec2 uv,float frame){return texture(uEnergy,(vec2(mod(frame,4.),1.-floor(frame/4.))+uv)/vec2(4,2));}
vec3 worldAt(vec2 pixel,float d){return uTarget+uRight*((pixel.x-uOrigin.x)/uScale)+uUp*((uOrigin.y-pixel.y)/uScale)+uBack*d;}
float atten(float distance,float radius,float power,bool core){return power/((core?2.2:1.)+distance*distance*(core?.13:.27))*clamp(1.-pow(distance/radius,4.),0.,1.);}
vec3 lightSurface(vec3 p,vec3 n,vec3 albedo,vec2 material,vec3 lamp,vec3 tint,float power,float radius,bool core){
 vec3 delta=lamp-p;float distance=length(delta);vec3 ld=delta/max(.01,distance);
 float strength=atten(distance,radius,power,core);
 float diffuse=max(0.,dot(n,ld));float spec=pow(max(0.,dot(n,normalize(ld+uBack))),10.+(1.-material.x)*56.)*material.y*strength*.212;
 return(albedo*diffuse*strength+spec)*tint;
}
float capsuleShadow(vec3 p,vec3 light){
 vec3 direction=normalize(light-p);float maximum=length(light-p);
 vec3 a=uActorWorld+vec3(0,.24,0),b=uActorWorld+vec3(0,uResting>.5?1.12:1.43,0);
 // A moving body casts onto the receiver's real XYZ, with correct direction
 // and height. Floor and wall receivers share the same finite ray test.
 vec3 ba=b-a,oa=p-a;float baba=dot(ba,ba),bard=dot(ba,direction),baoa=dot(ba,oa);
 float aa=baba-bard*bard,bb=baba*dot(direction,oa)-baoa*bard,cc=baba*dot(oa,oa)-baoa*baoa-.25*.25*baba;
 float h=bb*bb-aa*cc;if(h<0.||abs(aa)<.00001)return 0.;
 float hit=(-bb-sqrt(h))/aa;
 if(hit<.008)hit=(-bb+sqrt(h))/aa;
 float y=baoa+hit*bard;
 return hit>.035&&hit<maximum&&y>0.&&y<baba?1.:0.;
}
void main(){
 vec2 pixel=floor(vec2(vUv.x,1.-vUv.y)*uSize)+.5,uv=uvAt(pixel);
 vec3 color=texture(uEnvironment,uv).rgb;
 vec4 depthData=texture(uResolvedDepth,uv),stableDepthData=texture(uDepth,uv);
 float depth=decodeDepth(depthData),stableDepth=decodeDepth(stableDepthData);
 vec3 point=worldAt(pixel,depth);
 // Full-scene material maps are authoritative only where their haven surface
 // is still the visible haven surface. Shifted exterior plates receive neither
 // the old shoulder field nor old cast shadows. Newly revealed haven pixels
 // without a baked material sample remain unlit by the moving shoulder lamp.
 bool stableHaven=floor(depthData.b*255.+.5)==4.&&floor(stableDepthData.b*255.+.5)==4.&&abs(depth-stableDepth)<.02;
 vec4 normalData=texture(uNormal,uv);vec3 n=normalize(normalData.rgb*2.-1.);
 vec4 material=texture(uRough,uv);
 if(stableHaven&&normalData.a>.5&&depth>-79.9){
  float shadowCore=capsuleShadow(point,uShadowLights[0]),shadowFire=capsuleShadow(point,uShadowLights[1]);
  color-=texture(uCore,uv).rgb*shadowCore*.84*(1.+.22*coreExpansion(uSeconds))*uCoreGain;
  color-=texture(uFurnace,uv).rgb*shadowFire*.82*(1.+fire(uSeconds));
  float contact=exp(-dot(point.xz-uActorWorld.xz,point.xz-uActorWorld.xz)/.095)*clamp(1.-abs(point.y-uActorWorld.y)*8.,0.,1.);
  color*=1.-contact*.18;
  color+=lightSurface(point,n,texture(uAlbedo,uv).rgb,material.rg,uLamp,vec3(1,.83,.55),3.2,6.2,false)*texture(uVisibility,uv).r;
 }
 vec2 local=pixel-uActorTop;
 if(local.x>=0.&&local.y>=0.&&local.x<uActorRect.z&&local.y<uActorRect.w){
  vec2 auv=vec2((uActorRect.x+local.x)/uActorAtlasSize.x,1.-(uActorRect.y+local.y)/uActorAtlasSize.y);
  vec4 actor=texture(uActorColor,auv);
  vec4 encoded=texture(uActorDepth,auv);vec2 bytes=floor(encoded.rg*255.+.5);
  float relative=(bytes.x*256.+bytes.y)/uActorDepthScale-uActorDepthOffset;
  float actorDepth=dot(uActorWorld-uTarget,uBack)+relative;
  if(actor.a>.01&&actorDepth>depth+.006){
   vec3 ap=worldAt(pixel,actorDepth),an=normalize(texture(uActorNormal,auv).rgb*2.-1.);
   vec4 mat=texture(uActorRough,auv);
   vec3 lit=actor.rgb*(.18+.12*max(an.y,0.)+.19*max(0.,dot(an,uBack)))*mat.b*vec3(.97,1.,1.025);
   for(int i=0;i<48;i++){
    if(i>=uLightCount)break;
    bool core=uLightKinds[i]>.5&&uLightKinds[i]<1.5;
    float gain=core?1.+.22*coreExpansion(uSeconds):uLightKinds[i]>1.5?1.+fire(uSeconds):1.+pulse(uSeconds);
    lit+=lightSurface(ap,an,actor.rgb,mat.rg,uLights[i].xyz,uLightColors[i].rgb,uLights[i].w,uLightColors[i].a,core)*uActorVisibility[i]*gain*uLightGains[i];
   }
   float selfShade=1.-capsuleShadow(ap+an*.035,uLamp);
   lit+=lightSurface(ap,an,actor.rgb,mat.rg,uLamp,vec3(1,.83,.55),3.2,6.2,false)*selfShade;
   lit+=actor.rgb*mat.a*2.;
   color=mix(color,lit,actor.a);
   depth=actorDepth;
  }
 }
 // Density is transmissive. A body behind the core must survive low/zero
 // alpha frames; a body in front is not absorbed by the core behind it.
 vec4 vd=texture(uVolumeDepth,uv);
 float frame=mod(uSeconds/4.8*8.,8.);
 vec4 energy=mix(energyFrame(uv,floor(frame)),energyFrame(uv,mod(floor(frame)+1.,8.)),fract(frame));
 if(vd.a<.5||decodeDepth(vd)>depth+.006){
  color=color*(1.-energy.a)+energy.rgb*(1.+.22*coreExpansion(uSeconds))*uCoreGain;
 }
 fragColor=vec4(clamp(color,0.,1.),1.);
}`;

interface Program { program: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> }
export class LastLightRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly actorBounds = { x: 0, y: 0, width: 0, height: 0 };
  readonly lampPosition = { x: 0, y: 0 };
  private readonly gl: WebGL2RenderingContext;
  private readonly environment: Program;
  private readonly composite: Program;
  private readonly textures: WebGLTexture[] = [];
  private readonly shaders: WebGLShader[] = [];
  private readonly images = new Map<keyof LastLightRenderImages, WebGLTexture>();
  private readonly buffer: WebGLBuffer;
  private readonly frameBuffer: WebGLFramebuffer;
  private readonly environmentTexture: WebGLTexture;
  private readonly resolvedDepthTexture: WebGLTexture;
  private readonly visibilityTexture: WebGLTexture;
  private readonly visibility: Uint8Array;
  private readonly depthPixels: Uint8ClampedArray;
  private readonly normalPixels: Uint8ClampedArray;
  private readonly occlusion: LastLightOcclusion;
  private readonly basis;
  private readonly lights: readonly LastLightLight[];
  private readonly shadowWidth: number;
  private readonly shadowHeight: number;
  private lastShadowTime = -Infinity;
  private lastLamp: LightVector = [Infinity, Infinity, Infinity];
  private destroyed = false;
  private currentFrame?: LastLightFrame;
  private readonly frameBounds = new Map<LastLightFrame, { x: number; y: number; width: number; height: number }>();

  constructor(private readonly pack: LastLightRenderPack) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = pack.camera.width; this.canvas.height = pack.camera.height;
    const gl = this.canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Last Light requires WebGL 2 for its material/depth compositor.');
    this.gl = gl; this.basis = lastLightBasis(pack.camera);
    try {
    this.occlusion = new LastLightOcclusion(pack.occluders);
    if (pack.lights.length > 48 || !pack.lights.some(l => l.id === 'core-heart') || !pack.lights.some(l => l.id === 'haven-furnace')) throw new Error('Last Light light-source contract is incomplete.');
    this.lights = pack.lights;
    this.environment = this.program(ENVIRONMENT); this.composite = this.program(COMPOSITE);
    this.buffer = gl.createBuffer()!; gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    for (const [name, image] of Object.entries(pack.images)) this.images.set(name as keyof LastLightRenderImages, this.texture(image));
    this.environmentTexture = this.texture(null, this.canvas.width, this.canvas.height);
    this.resolvedDepthTexture = this.texture(null, this.canvas.width, this.canvas.height);
    this.frameBuffer = gl.createFramebuffer()!; gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.environmentTexture, 0);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, this.resolvedDepthTexture, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Last Light framebuffer is incomplete.');
    this.shadowWidth = Math.ceil(this.canvas.width / 4); this.shadowHeight = Math.ceil(this.canvas.height / 4);
    this.visibility = new Uint8Array(this.shadowWidth * this.shadowHeight * 4).fill(255);
    this.visibilityTexture = this.texture(null, this.shadowWidth, this.shadowHeight);
    this.depthPixels = this.pixels(pack.images.depth); this.normalPixels = this.pixels(pack.images.normal);
    const actorPixels = this.pixels(pack.images.actorColor);
    for (const frame of pack.frames) {
      let left = frame.width, top = frame.height, right = 0, bottom = 0;
      for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
        if (!actorPixels[((frame.y + y) * pack.images.actorColor.width + frame.x + x) * 4 + 3]) continue;
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      }
      this.frameBounds.set(frame, { x: left, y: top, width: right - left, height: bottom - top });
    }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.DITHER);
    } catch (error) {
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      throw error;
    }
  }
  private pixels(image: LastLightImage): Uint8ClampedArray {
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    if (image instanceof ImageBitmap) { ctx.translate(0, canvas.height); ctx.scale(1, -1); }
    ctx.drawImage(image, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  }
  private program(fragment: string): Program {
    const gl = this.gl, program = gl.createProgram()!;
    for (const [kind, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(kind)!; this.shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Last Light shader: ${gl.getShaderInfoLog(shader)}`);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Last Light shader link: ${gl.getProgramInfoLog(program)}`);
    return { program, uniforms: new Map() };
  }
  private texture(image: LastLightImage | null, width = 1, height = 1): WebGLTexture {
    const gl = this.gl, texture = gl.createTexture()!; this.textures.push(texture); gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (image) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    return texture;
  }
  private uniform(program: Program, name: string): WebGLUniformLocation | null {
    if (!program.uniforms.has(name)) program.uniforms.set(name, this.gl.getUniformLocation(program.program, name));
    return program.uniforms.get(name)!;
  }
  private begin(program: Program, images: readonly (readonly [string, WebGLTexture])[]): void {
    const gl = this.gl; gl.useProgram(program.program); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const a = gl.getAttribLocation(program.program, 'aPosition'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    images.forEach(([name, texture], i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture); gl.uniform1i(this.uniform(program, name), i); });
    gl.uniform2f(this.uniform(program, 'uSize'), this.canvas.width, this.canvas.height); gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  private updateVisibility(lamp: LightVector, seconds: number): void {
    const travel = Math.hypot(lamp[0] - this.lastLamp[0], lamp[1] - this.lastLamp[1], lamp[2] - this.lastLamp[2]);
    if (seconds - this.lastShadowTime < .075 || travel < .025) return;
    this.lastShadowTime = seconds; this.lastLamp = lamp;
    const depth = this.depthPixels, normals = this.normalPixels, width = this.canvas.width;
    this.visibility.fill(255);
    for (let y = 0; y < this.shadowHeight; y++) for (let x = 0; x < this.shadowWidth; x++) {
      const px = Math.min(width - 1, x * 4 + 2), py = Math.min(this.canvas.height - 1, y * 4 + 2), offset = (py * width + px) * 4;
      if (!normals[offset + 3] || depth[offset + 2] !== 4 || !(depth[offset]! + depth[offset + 1]!)) continue;
      const d = (depth[offset]! * 256 + depth[offset + 1]!) / 256 - 80;
      const p = unprojectLastLight(px + .5, py + .5, d, this.pack.camera, this.basis);
      if (Math.hypot(p[0] - lamp[0], p[1] - lamp[1], p[2] - lamp[2]) > 6.2) continue;
      for (let i = 0; i < 3; i++) p[i] = p[i]! + (normals[offset + i]! / 255 * 2 - 1) * .035;
      const value = this.occlusion.blocked(p, lamp) ? 0 : 255;
      const index = ((this.shadowHeight - 1 - y) * this.shadowWidth + x) * 4;
      this.visibility[index] = value; this.visibility[index + 1] = value; this.visibility[index + 2] = value;
    }
    const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.visibilityTexture);
    // Typed-array uploads are already stored bottom-to-top (UNPACK_FLIP has no effect).
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.shadowWidth, this.shadowHeight, gl.RGBA, gl.UNSIGNED_BYTE, this.visibility);
  }
  private frame(state: LastLightRenderState): LastLightFrame {
    const pose = state.resting ? 'sit' : state.walking ? 'walk' : 'idle';
    const phase = state.walking ? Math.floor(state.seconds * 8) : Math.floor(state.seconds * 2);
    let best = Infinity, selected: LastLightFrame | undefined;
    for (const frame of this.pack.frames) {
      if (frame.pose !== pose) continue;
      const angle = Math.abs(Math.atan2(Math.sin(frame.yaw - state.yaw), Math.cos(frame.yaw - state.yaw)));
      const count = this.pack.frames.filter(f => f.pose === pose && Math.abs(f.yaw - frame.yaw) < .01).length;
      const score = angle * 100 + Math.abs(frame.phase - phase % Math.max(1, count));
      if (score < best) { best = score; selected = frame; }
    }
    if (!selected) throw new Error(`Last Light actor is missing ${pose} frames.`);
    return selected;
  }
  draw(state: LastLightRenderState): void {
    if (this.destroyed) return;
    if (this.gl.isContextLost()) throw new Error('Last Light rendering context was lost.');
    const gl = this.gl, frame = this.frame(state); this.currentFrame = frame;
    const projected = projectLastLight(state.world, this.pack.camera, this.basis);
    const top = [Math.round(projected[0] - frame.anchor[0]), Math.round(projected[1] - frame.anchor[1])];
    const bounds = this.frameBounds.get(frame)!;
    this.actorBounds.x = top[0]! + bounds.x; this.actorBounds.y = top[1]! + bounds.y; this.actorBounds.width = bounds.width; this.actorBounds.height = bounds.height;
    const lamp: LightVector = [state.world[0] + frame.lamp[0], state.world[1] + frame.lamp[1], state.world[2] + frame.lamp[2]];
    const lampScreen = projectLastLight(lamp, this.pack.camera, this.basis); this.lampPosition.x = lampScreen[0]; this.lampPosition.y = lampScreen[1];
    this.updateVisibility(lamp, state.seconds);
    const image = (key: keyof LastLightRenderImages): WebGLTexture => this.images.get(key)!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.frameBuffer);
    const p = this.environment;
    this.begin(p, [['uScene', image('scene')], ['uBackground', image('background')], ['uFar', image('far')], ['uMiddle', image('middle')], ['uNear', image('near')], ['uPollution', image('pollution')], ['uCore', image('coreLight')], ['uFurnace', image('furnace')], ['uMotion', image('motion')], ['uDepth', image('depth')], ['uEnergy', image('energy')], ['uExteriorDepth', image('exteriorDepth')], ['uStorage', image('storageLight')], ['uPurifier', image('purifierLight')]]);
    gl.uniform1f(this.uniform(p, 'uSeconds'), state.reducedMotion ? 0 : state.seconds);
    gl.uniform2f(this.uniform(p, 'uObserver'), state.reducedMotion ? 0 : projected[0] - 509.193536, state.reducedMotion ? 0 : projected[1] - 366.808075);
    gl.uniform2f(this.uniform(p, 'uPlateSize'), this.pack.images.far.width, this.pack.images.far.height);
    gl.uniform1f(this.uniform(p, 'uPadding'), this.pack.exteriorPadding);
    gl.uniform3fv(this.uniform(p, 'uParallax'), this.pack.exteriorParallax);
    gl.uniform3fv(this.uniform(p, 'uHealth'), state.health);
    gl.uniform1f(this.uniform(p, 'uCharge'), state.charge); gl.uniform1f(this.uniform(p, 'uGrowth'), state.growth); gl.uniform1f(this.uniform(p, 'uThicken'), state.thicken);
    gl.uniform1fv(this.uniform(p, 'uPulses'), state.pulses);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const c = this.composite;
    this.begin(c, [['uEnvironment', this.environmentTexture], ['uDepth', image('depth')], ['uNormal', image('normal')], ['uAlbedo', image('albedo')], ['uRough', image('rough')], ['uVisibility', this.visibilityTexture], ['uActorColor', image('actorColor')], ['uActorNormal', image('actorNormal')], ['uActorDepth', image('actorDepth')], ['uActorRough', image('actorRough')], ['uCore', image('coreLight')], ['uFurnace', image('furnace')], ['uVolumeDepth', image('volumeDepth')], ['uResolvedDepth', this.resolvedDepthTexture], ['uEnergy', image('energy')]]);
    gl.uniform1f(this.uniform(c, 'uSeconds'), state.reducedMotion ? 0 : state.seconds);
    for (const [name, value] of [['uRight', this.basis.right], ['uUp', this.basis.up], ['uBack', this.basis.back], ['uTarget', this.pack.camera.target], ['uActorWorld', state.world], ['uLamp', lamp]] as const) gl.uniform3fv(this.uniform(c, name), value);
    gl.uniform2fv(this.uniform(c, 'uOrigin'), this.pack.camera.origin); gl.uniform1f(this.uniform(c, 'uScale'), this.pack.camera.scale);
    gl.uniform1f(this.uniform(c, 'uActorDepthOffset'), this.pack.actorDepthOffset); gl.uniform1f(this.uniform(c, 'uActorDepthScale'), this.pack.actorDepthScale);
    gl.uniform1f(this.uniform(c, 'uResting'), state.resting ? 1 : 0);
    gl.uniform4f(this.uniform(c, 'uActorRect'), frame.x, frame.y, frame.width, frame.height);
    gl.uniform2f(this.uniform(c, 'uActorTop'), top[0]!, top[1]!); gl.uniform2f(this.uniform(c, 'uActorAtlasSize'), this.pack.images.actorColor.width, this.pack.images.actorColor.height);
    const visibility = this.lights.map(light => {
      if (Math.hypot(light.position[0] - state.world[0], light.position[1] - state.world[1] - .9, light.position[2] - state.world[2]) > light.radius + 1) return 0;
      let visible = 0;
      for (const height of [.35, .9, 1.4]) if (!this.occlusion.blocked([state.world[0], state.world[1] + height, state.world[2]], light.position)) visible += 1 / 3;
      return visible;
    });
    gl.uniform1fv(this.uniform(c, 'uActorVisibility'), visibility);
    gl.uniform1i(this.uniform(c, 'uLightCount'), this.lights.length);
    gl.uniform1f(this.uniform(c, 'uCoreGain'), .25 + .75 * state.health[0]);
    gl.uniform3fv(this.uniform(c, 'uShadowLights[0]'), this.lights.find(l => l.id === 'core-heart')!.position);
    gl.uniform3fv(this.uniform(c, 'uShadowLights[1]'), this.lights.find(l => l.id === 'haven-furnace')!.position);
    this.lights.forEach((light, i) => {
      gl.uniform4f(this.uniform(c, `uLights[${i}]`), ...light.position, light.power);
      gl.uniform4f(this.uniform(c, `uLightColors[${i}]`), ...light.color, light.radius);
      const core = light.id.startsWith('core-');
      gl.uniform1f(this.uniform(c, `uLightKinds[${i}]`), core ? 1 : light.id === 'haven-furnace' ? 2 : 0);
      gl.uniform1f(this.uniform(c, `uLightGains[${i}]`), core ? .25 + .75 * state.health[0] : light.id.startsWith('storage-') ? .25 + .75 * state.health[1] : light.id.startsWith('purifier-') ? .25 + .75 * state.health[2] : 1);
    });
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  portrait(): string {
    const frame = this.currentFrame ?? this.pack.frames[0]!;
    const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 96;
    const ctx = canvas.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    const scale = Math.min(3, 84 / frame.height), w = frame.width * scale, h = frame.height * scale;
    const source = this.pack.actorPortrait;
    if (source instanceof ImageBitmap) {
      ctx.translate(0, 96); ctx.scale(1, -1);
      ctx.drawImage(source, frame.x, source.height - frame.y - frame.height, frame.width, frame.height, (96 - w) / 2, (96 - h) / 2, w, h);
    } else ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, (96 - w) / 2, (96 - h) / 2, w, h);
    return canvas.toDataURL('image/png');
  }
  destroy(): void {
    if (this.destroyed) return; this.destroyed = true;
    const gl = this.gl;
    for (const texture of this.textures) gl.deleteTexture(texture);
    for (const shader of this.shaders) gl.deleteShader(shader);
    gl.deleteProgram(this.environment.program); gl.deleteProgram(this.composite.program);
    gl.deleteBuffer(this.buffer); gl.deleteFramebuffer(this.frameBuffer);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
