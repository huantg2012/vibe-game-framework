import type { LightVector } from './last-light-spatial';

export interface LastLightShadowSource {
  readonly position: LightVector;
  readonly radius: number;
}
export const LAST_LIGHT_SHOULDER_SHADOW_SIZE = 512;
export const LAST_LIGHT_SOURCE_SHADOW_SIZE = 192;
const SHOULDER_RADIUS = 6.2;
const NEAR = .008;

/** OpenGL cube order and orientation. The array sampler below uses exactly
 * these same camera bases, including each face's vertical orientation. */
const FACES = [
  { forward: [1, 0, 0], right: [0, 0, -1], up: [0, -1, 0] },
  { forward: [-1, 0, 0], right: [0, 0, 1], up: [0, -1, 0] },
  { forward: [0, 1, 0], right: [1, 0, 0], up: [0, 0, 1] },
  { forward: [0, -1, 0], right: [1, 0, 0], up: [0, 0, -1] },
  { forward: [0, 0, 1], right: [1, 0, 0], up: [0, -1, 0] },
  { forward: [0, 0, -1], right: [-1, 0, 0], up: [0, -1, 0] },
] as const;

const VERTEX = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPosition;
uniform vec3 uLight,uRight,uUp,uForward;
uniform float uRadius;
out vec3 vRelative;
void main(){
 vRelative=aPosition-uLight;
 vec3 view=vec3(dot(vRelative,uRight),dot(vRelative,uUp),dot(vRelative,uForward));
 float nearPlane=.008;
 gl_Position=vec4(view.xy,((uRadius+nearPlane)*view.z-2.*uRadius*nearPlane)/(uRadius-nearPlane),view.z);
}`;
const FRAGMENT = `#version 300 es
precision highp float;
in vec3 vRelative;
uniform float uRadius;
layout(location=0) out vec4 outDepth;
void main(){
 float depth=floor(clamp(length(vRelative)/uRadius,0.,1.)*65535.+.5);
 outDepth=vec4(floor(depth/256.)/255.,mod(depth,256.)/255.,0.,1.);
}`;

/** Bind these two samplers in the receiver pass. RG bytes are decoded BEFORE
 * comparisons; all filtering is explicit comparison filtering in direction
 * space. Array taps choose their face independently, so kernels cross seams. */
export const LAST_LIGHT_SHADOW_GLSL = `
uniform highp samplerCube uShoulderShadow;
uniform highp sampler2DArray uSourceShadows;
float lastLightDecodeShadow(vec4 packedDepth,float radius){
 vec2 bytes=floor(packedDepth.rg*255.+.5);
 return(bytes.x*256.+bytes.y)*(radius/65535.);
}
vec3 lastLightShadowArrayCoordinate(vec3 direction,float sourceIndex){
 vec3 a=abs(direction);vec2 faceUv;float face,major;
 if(a.x>=a.y&&a.x>=a.z){
  major=a.x;
  if(direction.x>=0.){face=0.;faceUv=vec2(-direction.z,-direction.y);}
  else{face=1.;faceUv=vec2(direction.z,-direction.y);}
 }else if(a.y>=a.z){
  major=a.y;
  if(direction.y>=0.){face=2.;faceUv=vec2(direction.x,direction.z);}
  else{face=3.;faceUv=vec2(direction.x,-direction.z);}
 }else{
  major=a.z;
  if(direction.z>=0.){face=4.;faceUv=vec2(direction.x,-direction.y);}
  else{face=5.;faceUv=vec2(-direction.x,-direction.y);}
 }
 return vec3(faceUv/max(major,.000001)*.5+.5,sourceIndex*6.+face);
}
float lastLightShoulderDistance(vec3 direction,float radius){
 return lastLightDecodeShadow(texture(uShoulderShadow,direction),radius);
}
float lastLightSourceDistance(vec3 direction,float radius,float sourceIndex){
 return lastLightDecodeShadow(texture(uSourceShadows,lastLightShadowArrayCoordinate(direction,sourceIndex)),radius);
}
float lastLightShadowBias(vec3 geometricNormal,vec3 toLight,float distance){
 float grazing=1.-max(0.,dot(geometricNormal,toLight/max(distance,.0001)));
 return .004+.003*grazing+distance*.00015;
}
void lastLightShadowBasis(vec3 direction,out vec3 tangent,out vec3 bitangent){
 tangent=normalize(cross(direction,abs(direction.y)<.95?vec3(0,1,0):vec3(1,0,0)));
 bitangent=cross(direction,tangent);
}
vec2 lastLightShadowTap(int i){
 if(i==0)return vec2(0);
 if(i==1)return vec2(1,0);if(i==2)return vec2(-1,0);
 if(i==3)return vec2(0,1);if(i==4)return vec2(0,-1);
 if(i==5)return vec2(.707107,.707107);if(i==6)return vec2(-.707107,.707107);
 if(i==7)return vec2(.707107,-.707107);return vec2(-.707107,-.707107);
}
float lastLightShadowTapWeight(int i){return i==0?.25:i<5?.125:.0625;}
float lastLightShadowSpread(float receiverDistance,float blockerDistance,float emitterRadius,float resolution){
 float penumbra=emitterRadius*max(receiverDistance-blockerDistance,0.)/max(blockerDistance,.08);
 // A sub-texel comparison footprint removes sampling steps without a blurred
 // screen-space mask. The finite source controls the wider contact penumbra.
 return max(receiverDistance/resolution,min(penumbra,.24));
}
float lastLightShadowReceiverDistance(vec3 ray,vec3 sampleRay,vec3 geometricNormal,float receiver){
 // Every tap intersects the same locally planar receiver. Comparing all taps
 // with the centre ray length makes an unoccluded sloping floor shadow itself.
 float denominator=dot(normalize(sampleRay),geometricNormal);
 if(abs(denominator)<.0001)return receiver;
 float expected=dot(ray,geometricNormal)/denominator;
 return expected>.0&&expected<receiver*16.?expected:receiver;
}
float lastLightShoulderVisibility(vec3 point,vec3 geometricNormal,vec3 light,float radius){
 vec3 normal=normalize(geometricNormal),toLight=light-point;
 float distance=length(toLight);if(distance<.012||distance>=radius)return 1.;
 float bias=lastLightShadowBias(normal,toLight,distance);
 vec3 ray=point+normal*bias-light;float receiver=length(ray);
 vec3 direction=ray/max(receiver,.0001),tangent,bitangent;
 lastLightShadowBasis(direction,tangent,bitangent);
 float spread=lastLightShadowSpread(receiver,lastLightShoulderDistance(ray,radius),.085,512.);
 float visible=0.;
 for(int i=0;i<9;i++){
  vec2 tap=lastLightShadowTap(i);vec3 sampleRay=ray+(tangent*tap.x+bitangent*tap.y)*spread;
  float expected=lastLightShadowReceiverDistance(ray,sampleRay,normal,receiver);
  visible+=(expected>=radius?1.:step(expected-bias*.5,lastLightShoulderDistance(sampleRay,radius)))*lastLightShadowTapWeight(i);
 }
 return visible;
}
float lastLightSourceVisibility(vec3 point,vec3 geometricNormal,vec3 light,float radius,float sourceIndex,float emitterRadius){
 vec3 normal=normalize(geometricNormal),toLight=light-point;
 float distance=length(toLight);if(distance<.012||distance>=radius)return 1.;
 float bias=lastLightShadowBias(normal,toLight,distance);
 vec3 ray=point+normal*bias-light;float receiver=length(ray);
 vec3 direction=ray/max(receiver,.0001),tangent,bitangent;
 lastLightShadowBasis(direction,tangent,bitangent);
 float spread=lastLightShadowSpread(receiver,lastLightSourceDistance(ray,radius,sourceIndex),emitterRadius,192.);
 float visible=0.;
 for(int i=0;i<9;i++){
  vec2 tap=lastLightShadowTap(i);vec3 sampleRay=ray+(tangent*tap.x+bitangent*tap.y)*spread;
  float expected=lastLightShadowReceiverDistance(ray,sampleRay,normal,receiver);
  visible+=(expected>=radius?1.:step(expected-bias*.5,lastLightSourceDistance(sampleRay,radius,sourceIndex)))*lastLightShadowTapWeight(i);
 }
 return visible;
}
`;

interface SavedState {
  draw: WebGLFramebuffer | null; read: WebGLFramebuffer | null;
  viewport: Int32Array; program: WebGLProgram | null; vao: WebGLVertexArrayObject | null;
  buffer: WebGLBuffer | null; renderbuffer: WebGLRenderbuffer | null;
  depth: boolean; cull: boolean; blend: boolean; scissor: boolean; dither: boolean;
  polygonOffset: boolean; discard: boolean; depthFunc: number; depthMask: boolean;
  colorMask: boolean[]; clearColor: Float32Array; clearDepth: number; depthRange: Float32Array;
  activeTexture: number; cube: WebGLTexture | null; array: WebGLTexture | null;
}

/** Static opaque model only. Fixed-source maps are rendered once; the shoulder
 * cube updates on every actual socket movement, with no screen-grid throttle. */
export class LastLightShadowMaps {
  readonly shoulderTexture!: WebGLTexture;
  readonly sourceTexture!: WebGLTexture;
  private readonly textures: WebGLTexture[] = [];
  private readonly depthBuffers: WebGLRenderbuffer[] = [];
  private readonly shaders: WebGLShader[] = [];
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private vao: WebGLVertexArrayObject | null = null;
  private framebuffer: WebGLFramebuffer | null = null;
  private shoulderDepth!: WebGLRenderbuffer;
  private sourceDepth!: WebGLRenderbuffer;
  private readonly uniforms = new Map<string, WebGLUniformLocation | null>();
  private readonly vertexCount: number;
  private lastLamp: LightVector | null = null;
  private disposed = false;

  constructor(private readonly gl: WebGL2RenderingContext, triangles: ArrayLike<number>, lights: readonly LastLightShadowSource[]) {
    if (triangles.length % 9 !== 0) throw new Error('Last Light shadow geometry must contain complete XYZ triangles.');
    this.vertexCount = triangles.length / 3;
    const layers = Math.max(1, lights.length * 6);
    if (layers > Number(gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS))) throw new Error('Last Light fixed-source shadows exceed this GPU array-layer limit.');
    if (LAST_LIGHT_SHOULDER_SHADOW_SIZE > Number(gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE))) throw new Error('Last Light shoulder shadow exceeds this GPU cube limit.');
    const state = this.capture();
    try {
      this.program = this.createProgram();
      this.buffer = gl.createBuffer(); this.vao = gl.createVertexArray(); this.framebuffer = gl.createFramebuffer();
      if (!this.buffer || !this.vao || !this.framebuffer) throw new Error('Unable to allocate Last Light shadow geometry.');
      const positions = new Float32Array(triangles.length);
      for (let i = 0; i < positions.length; i++) {
        const coordinate = triangles[i]!;
        if (!Number.isFinite(coordinate)) throw new Error('Last Light shadow geometry contains a non-finite position.');
        positions[i] = coordinate;
      }
      gl.bindVertexArray(this.vao); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW); gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      this.shoulderTexture = this.createTexture(gl.TEXTURE_CUBE_MAP);
      for (let face = 0; face < 6; face++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, gl.RGBA8, LAST_LIGHT_SHOULDER_SHADOW_SIZE, LAST_LIGHT_SHOULDER_SHADOW_SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.sourceTexture = this.createTexture(gl.TEXTURE_2D_ARRAY);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, LAST_LIGHT_SOURCE_SHADOW_SIZE, LAST_LIGHT_SOURCE_SHADOW_SIZE, layers, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.shoulderDepth = this.createDepthBuffer(LAST_LIGHT_SHOULDER_SHADOW_SIZE);
      this.sourceDepth = this.createDepthBuffer(LAST_LIGHT_SOURCE_SHADOW_SIZE);
      this.prepare();
      lights.forEach((source, index) => {
        this.validateSource(source.position, source.radius);
        this.renderSource(source.position, source.radius, index);
      });
      // Initialize the six cube attachments and their completeness before the
      // renderer begins. The first real shoulder position still forces a draw.
      this.renderShoulder([0, 0, 0]);
    } catch (error) {
      this.destroy();
      throw error;
    } finally { this.restore(state); }
  }
  private createProgram(): WebGLProgram {
    const gl = this.gl, program = gl.createProgram();
    if (!program) throw new Error('Unable to allocate Last Light shadow program.');
    this.program = program;
    for (const [kind, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, FRAGMENT]] as const) {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Unable to allocate Last Light shadow shader.');
      this.shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Last Light shadow shader: ${gl.getShaderInfoLog(shader)}`);
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Last Light shadow program: ${gl.getProgramInfoLog(program)}`);
    return program;
  }
  private createTexture(target: number): WebGLTexture {
    const gl = this.gl, texture = gl.createTexture();
    if (!texture) throw new Error('Unable to allocate Last Light shadow texture.');
    this.textures.push(texture); gl.bindTexture(target, texture);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    return texture;
  }
  private createDepthBuffer(size: number): WebGLRenderbuffer {
    const gl = this.gl, depth = gl.createRenderbuffer();
    if (!depth) throw new Error('Unable to allocate Last Light shadow depth buffer.');
    this.depthBuffers.push(depth); gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, size, size);
    return depth;
  }
  private uniform(name: string): WebGLUniformLocation | null {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl.getUniformLocation(this.program!, name));
    return this.uniforms.get(name)!;
  }
  private validateSource(position: LightVector, radius: number): void {
    if (!position.every(Number.isFinite) || !Number.isFinite(radius) || radius <= NEAR) throw new Error('Invalid Last Light shadow source.');
  }
  private prepare(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.bindVertexArray(this.vao); gl.useProgram(this.program);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.depthMask(true); gl.depthRange(0, 1);
    gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.RASTERIZER_DISCARD); gl.disable(gl.DITHER);
    gl.colorMask(true, true, true, true); gl.clearColor(1, 1, 0, 1); gl.clearDepth(1);
  }
  private drawFace(position: LightVector, radius: number, face: number, size: number): void {
    const gl = this.gl, basis = FACES[face]!;
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Last Light shadow framebuffer is incomplete.');
    gl.viewport(0, 0, size, size); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform3fv(this.uniform('uLight'), position); gl.uniform1f(this.uniform('uRadius'), radius);
    gl.uniform3fv(this.uniform('uRight'), basis.right); gl.uniform3fv(this.uniform('uUp'), basis.up); gl.uniform3fv(this.uniform('uForward'), basis.forward);
    gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
  }
  private renderSource(position: LightVector, radius: number, index: number): void {
    const gl = this.gl;
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.sourceDepth);
    for (let face = 0; face < 6; face++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, this.sourceTexture, 0, index * 6 + face);
      this.drawFace(position, radius, face, LAST_LIGHT_SOURCE_SHADOW_SIZE);
    }
  }
  private renderShoulder(position: LightVector): void {
    const gl = this.gl;
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.shoulderDepth);
    for (let face = 0; face < 6; face++) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, this.shoulderTexture, 0);
      this.drawFace(position, SHOULDER_RADIUS, face, LAST_LIGHT_SHOULDER_SHADOW_SIZE);
    }
  }
  updateShoulder(lamp: LightVector): void {
    if (this.disposed) return;
    this.validateSource(lamp, SHOULDER_RADIUS);
    if (this.lastLamp && lamp.every((value, axis) => value === this.lastLamp![axis])) return;
    const state = this.capture();
    try {
      this.prepare(); this.renderShoulder(lamp);
      this.lastLamp = [lamp[0], lamp[1], lamp[2]];
    } finally { this.restore(state); }
  }
  private capture(): SavedState {
    const gl = this.gl;
    return {
      draw: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), read: gl.getParameter(gl.READ_FRAMEBUFFER_BINDING),
      viewport: gl.getParameter(gl.VIEWPORT), program: gl.getParameter(gl.CURRENT_PROGRAM), vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
      buffer: gl.getParameter(gl.ARRAY_BUFFER_BINDING), renderbuffer: gl.getParameter(gl.RENDERBUFFER_BINDING),
      depth: gl.isEnabled(gl.DEPTH_TEST), cull: gl.isEnabled(gl.CULL_FACE), blend: gl.isEnabled(gl.BLEND),
      scissor: gl.isEnabled(gl.SCISSOR_TEST), dither: gl.isEnabled(gl.DITHER), polygonOffset: gl.isEnabled(gl.POLYGON_OFFSET_FILL),
      discard: gl.isEnabled(gl.RASTERIZER_DISCARD), depthFunc: gl.getParameter(gl.DEPTH_FUNC), depthMask: gl.getParameter(gl.DEPTH_WRITEMASK),
      colorMask: gl.getParameter(gl.COLOR_WRITEMASK), clearColor: gl.getParameter(gl.COLOR_CLEAR_VALUE), clearDepth: gl.getParameter(gl.DEPTH_CLEAR_VALUE),
      depthRange: gl.getParameter(gl.DEPTH_RANGE), activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
      cube: gl.getParameter(gl.TEXTURE_BINDING_CUBE_MAP), array: gl.getParameter(gl.TEXTURE_BINDING_2D_ARRAY),
    };
  }
  private restore(state: SavedState): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, state.draw); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, state.read);
    gl.viewport(state.viewport[0]!, state.viewport[1]!, state.viewport[2]!, state.viewport[3]!);
    gl.useProgram(state.program); gl.bindVertexArray(state.vao); gl.bindBuffer(gl.ARRAY_BUFFER, state.buffer);
    gl.bindRenderbuffer(gl.RENDERBUFFER, state.renderbuffer);
    for (const [flag, enabled] of [[gl.DEPTH_TEST, state.depth], [gl.CULL_FACE, state.cull], [gl.BLEND, state.blend],
      [gl.SCISSOR_TEST, state.scissor], [gl.DITHER, state.dither], [gl.POLYGON_OFFSET_FILL, state.polygonOffset], [gl.RASTERIZER_DISCARD, state.discard]] as const) {
      if (enabled) gl.enable(flag); else gl.disable(flag);
    }
    gl.depthFunc(state.depthFunc); gl.depthMask(state.depthMask); gl.depthRange(state.depthRange[0]!, state.depthRange[1]!);
    gl.colorMask(state.colorMask[0]!, state.colorMask[1]!, state.colorMask[2]!, state.colorMask[3]!);
    gl.clearColor(state.clearColor[0]!, state.clearColor[1]!, state.clearColor[2]!, state.clearColor[3]!); gl.clearDepth(state.clearDepth);
    gl.activeTexture(state.activeTexture); gl.bindTexture(gl.TEXTURE_CUBE_MAP, state.cube); gl.bindTexture(gl.TEXTURE_2D_ARRAY, state.array);
  }
  destroy(): void {
    if (this.disposed) return; this.disposed = true;
    const gl = this.gl;
    for (const texture of this.textures) gl.deleteTexture(texture);
    for (const depth of this.depthBuffers) gl.deleteRenderbuffer(depth);
    for (const shader of this.shaders) gl.deleteShader(shader);
    if (this.program) gl.deleteProgram(this.program);
    if (this.buffer) gl.deleteBuffer(this.buffer);
    if (this.vao) gl.deleteVertexArray(this.vao);
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
  }
}
