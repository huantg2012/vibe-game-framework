/** CPU integration of renderer uploads and lifecycle; fake GL does not execute GLSL. */
import assert from 'node:assert/strict';
import { MasterSurfaceRenderer } from '../../src/dev/rift-r100-masters/surface-renderer';
import { createMasterWorld, type MasterWorld } from '../../src/dev/rift-r100-masters/world';
import { MASTER_SCENES } from '../../src/dev/rift-r100-masters/generated-scenes';
import type { PaintedMaterial } from '../../src/dev/rift-r100-masters/painted-material';
import type { MasterGroundSurface } from '../../src/generation/world-study/master-ground-field';
import type { NativeVolumeMesh } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster, NativeVolumeLighting, type NativeVolumeLight, type NativeVolumeMaterialSet } from '../../src/generation/world-study/native-volume-raster';

type Failure = 'none'|'vertex'|'fragment'|'program'|'link'|'buffer'|'texture'|'upload';
function fakeContext(failure:Failure='none') {
  let serial=0,unit=0,lost=false,textureCalls=0;
  const textures=new Set<object>(),buffers=new Set<object>(),programs=new Set<object>(),shaders=new Set<object>();
  const uploads:Uint8Array[]=[],uniforms=new Map<string,number|number[]>();
  const counts={draws:0,losses:0,deletedTextures:0,deletedBuffers:0,deletedPrograms:0};
  const allocation=(set:Set<object>,kind:string)=>{const item={kind,id:++serial};set.add(item);return item;};
  const gl={
    VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,
    TEXTURE0:100,TEXTURE_2D:8,TEXTURE_MIN_FILTER:9,TEXTURE_MAG_FILTER:10,NEAREST:11,TEXTURE_WRAP_S:12,TEXTURE_WRAP_T:13,CLAMP_TO_EDGE:14,RGBA8:15,RGBA:16,UNSIGNED_BYTE:17,TRIANGLE_STRIP:18,
    createShader(type:number){return Object.assign(allocation(shaders,'shader'),{type});},shaderSource(){},compileShader(){},
    getShaderParameter(shader:{type:number}){return !(failure==='vertex'&&shader.type===1 || failure==='fragment'&&shader.type===2);},
    getShaderInfoLog(){return 'injected shader failure';},deleteShader(value:object){shaders.delete(value);},
    createProgram(){return failure==='program'?null:allocation(programs,'program');},attachShader(){},linkProgram(){},getProgramParameter(){return failure!=='link';},getProgramInfoLog(){return 'injected link failure';},
    useProgram(){},createBuffer(){return failure==='buffer'?null:allocation(buffers,'buffer');},bindBuffer(){},bufferData(){},getAttribLocation(){return 0;},enableVertexAttribArray(){},vertexAttribPointer(){},
    createTexture(){textureCalls++;return failure==='texture'&&textureCalls===3?null:allocation(textures,'texture');},
    activeTexture(value:number){unit=value-100;},bindTexture(){},texParameteri(){},
    texImage2D(_target:number,_level:number,_internal:number,_width:number,_height:number,_border:number,_format:number,_type:number,data:Uint8Array){if(failure==='upload'&&unit===2)throw new Error('injected upload failure');uploads[unit]=data.slice();},
    getUniformLocation(_program:unknown,name:string){return{name};},
    uniform1i(location:{name:string},value:number){uniforms.set(location.name,value);},uniform1f(location:{name:string},value:number){uniforms.set(location.name,value);},
    uniform2f(location:{name:string},x:number,y:number){uniforms.set(location.name,[x,y]);},uniform4fv(location:{name:string},values:Float32Array){uniforms.set(location.name,Array.from(values));},
    viewport(){},drawArrays(){counts.draws++;},isContextLost(){return lost;},
    deleteTexture(value:object){assert(textures.delete(value),'each GPU texture is released once');counts.deletedTextures++;},
    deleteBuffer(value:object){assert(buffers.delete(value),'each quad buffer is released once');counts.deletedBuffers++;},
    deleteProgram(value:object){assert(programs.delete(value),'each linked program is released once');counts.deletedPrograms++;},
    getExtension(name:string){assert.equal(name,'WEBGL_lose_context');return{loseContext(){counts.losses++;lost=true;textures.clear();buffers.clear();programs.clear();shaders.clear();}};},
  };
  return{gl,uploads,uniforms,counts,loseExternally(){lost=true;},liveResources:()=>textures.size+buffers.size+programs.size+shaders.size};
}
function fixture(){
  const mesh:NativeVolumeMesh={spec:{id:1,family:'folded-slab',seed:1,x:0,y:0,rotation:0,length:16,width:12,height:17.375,thickness:2,fold:.2,branches:2,opening:.3,distortion:.2},
    positions:new Float32Array([0,0,17.375,3,0,17.375,3,1,17.375,0,1,17.375]),normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),uv:new Float32Array(8),
    indices:new Uint32Array([0,1,2,0,2,3]),materials:new Uint8Array(2),regions:new Uint8Array(2),vertexCount:4,triangleCount:2,bounds:{minX:0,minY:0,maxX:3,maxY:1,maxZ:17.375},joints:[]};
  const raster=compileNativeVolumeRaster([mesh],{x:0,y:0,width:3,height:2,supportCellSize:8,opticalHeight:24});
  // Preserve the real authored definition/palette/seed contract, then replace
  // only receiver geometry with a tiny legible fixture. No unchecked fake World.
  const authored=createMasterWorld(MASTER_SCENES[0]!,1);
  const world:MasterWorld={...authored,raster,meshes:[mesh],matterAt:(x:number,y:number)=>x>=0&&x<2&&y>=0&&y<2};
  const ground:MasterGroundSurface={width:3,height:2,rgba:new Uint8ClampedArray(24),albedo:new Uint8ClampedArray(24),normals:new Float32Array(18),heightField:new Float32Array(6).fill(2.25),roughness:new Float32Array(6).fill(.75),ambientOcclusion:new Float32Array(6).fill(.8),depositId:new Uint16Array(6),materialEvents:new Uint8Array(6)};
  for(let i=0;i<6;i++){ground.albedo.set([60,90,120,255],i*4);ground.normals.set([0,.6,.8],i*3);}
  const material={base:[100,110,120],dark:[40,45,50],light:[160,170,180],roughness:.5,structure:0,emission:[8,9,10],emissionStrength:1} as const;
  const palette:NativeVolumeMaterialSet={outer:material,cut:material,inner:material,joint:material};
  return{world,ground,volume:new NativeVolumeLighting(raster,palette)};
}
const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
const value=fixture();let canvas:{width:number;height:number;getContext:()=>unknown};
const painting:PaintedMaterial={width:8,height:8,worldSize:8,source:'test:painted-material',pixels:new Uint8ClampedArray(8*8*4)};
for(let y=0;y<8;y++)for(let x=0;x<8;x++)painting.pixels.set([25+x*23,35+y*21,45+x*9+y*7,255],(y*8+x)*4);
function install(context:ReturnType<typeof fakeContext>){
  canvas={width:0,height:0,getContext:()=>context.gl};
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(name:string){assert.equal(name,'canvas');return canvas;}}});
}
try{
  for(const failure of ['vertex','fragment','program','link','buffer','texture','upload'] as const){
    const context=fakeContext(failure);install(context);
    assert.throws(()=>new MasterSurfaceRenderer(value.world,value.ground,value.volume,painting),/shader failure|link failure|allocation failed|upload failure/i);
    assert.equal(context.counts.losses,1,`${failure}: failed initialization releases its owned context`);
    assert.equal(context.liveResources(),0,`${failure}: no live GPU handles survive rollback`);
    assert.equal(canvas!.width,1);assert.equal(canvas!.height,1);
  }
  const context=fakeContext();install(context);
  const renderer=new MasterSurfaceRenderer(value.world,value.ground,value.volume);
  assert.equal(context.uploads.length,4);assert.deepEqual(context.uniforms.get('size'),[3,2]);
  const [albedo,normal,response,emission]=context.uploads as [Uint8Array,Uint8Array,Uint8Array,Uint8Array];
  assert.deepEqual(Array.from(albedo.filter((_v,i)=>i%4===3)),[255,255,0,255,255,0],'both ground and geometry obey the authoritative matter mask');
  for(const index of [2,5])for(const channel of [albedo,normal,response,emission])assert(channel.slice(index*4,index*4+4).every(value=>value===0),'absent terrain uploads no receiver data');
  const height=(index:number)=>(response[index*4+1]!*256+response[index*4+2]!)/128;
  assert.equal(height(0),17.375,'geometry height survives byte packing');assert.equal(height(3),2.25,'ground height survives byte packing');
  assert.deepEqual(Array.from(normal.slice(0,3)),[128,128,255]);assert.deepEqual(Array.from(normal.slice(12,15)),[128,204,230]);
  assert.deepEqual(Array.from(emission.slice(0,3)),[8,9,10]);assert(emission.slice(12,16).every(value=>value===0),'ground is not an invented emitter');
  assert.equal(renderer.gpuBytes,3*2*4*6,'budget includes four maps, local target and Phaser copy');
  const lights:NativeVolumeLight[]=Array.from({length:9},(_,i)=>({x:i+.25,y:i+2,z:i+28,radius:110,intensity:.5,color:[1,.8,.6]}));
  renderer.draw(lights,.4,12.5,2);assert.equal(context.counts.draws,1);assert.equal(context.uniforms.get('lightCount'),8);
  assert.deepEqual((context.uniforms.get('lights') as number[]).slice(0,4),[.25,2,28,110]);
  renderer.draw(lights.slice(0,1),.2,13,0);assert.equal(context.uniforms.get('lightCount'),1,'shorter light list cannot retain old active slots');
  context.loseExternally();assert.throws(()=>renderer.draw(lights,.2,13,0),/context was lost/);assert.equal(context.counts.draws,2,'lost context is reported before a render is submitted');
  renderer.destroy();renderer.destroy();
  assert.equal(context.counts.deletedTextures,4);assert.equal(context.counts.deletedBuffers,1);assert.equal(context.counts.deletedPrograms,1);assert.equal(context.counts.losses,1,'repeat destruction does not lose/release twice');
  renderer.draw(lights,.2,14,0);assert.equal(context.counts.draws,2,'destroyed receiver cannot submit more GPU work');
  assert.equal(context.liveResources(),0);assert.equal(canvas!.width,1);assert.equal(canvas!.height,1);

  // Real painted branch: geometry events may choose a material finish, but an
  // image never invents geometry, normals, emissions or missing terrain.
  value.world.raster.region[1]=2; // One real exposed receiver next to intact skin.
  value.ground.materialEvents[4]=2; // Fines are a separate authored ground event.
  const sourceBefore=painting.pixels.slice(),albedoBefore=value.volume.albedo.slice();
  const paintedContext=fakeContext();install(paintedContext);
  const paintedRenderer=new MasterSurfaceRenderer(value.world,value.ground,value.volume,painting);
  assert.notDeepEqual(paintedContext.uploads[0],albedo,'painted pixels reach the actual albedo upload');
  for(const channel of [1,3])assert.deepEqual(paintedContext.uploads[channel],context.uploads[channel],'painting cannot modify receiver normals or emission');
  const paintedResponse=paintedContext.uploads[2]!;
  for(let index=0;index<6;index++)assert.deepEqual(paintedResponse.slice(index*4+1,index*4+4),response.slice(index*4+1,index*4+4),'material finish cannot change encoded height or volume membership');
  assert(paintedResponse[0]!>paintedResponse[4]!,'exposed coherent layer has a different finish from adjacent intact skin');
  assert(paintedResponse[16]!>paintedResponse[12]!,'liberated fines are rougher than the continuous ground beside them');
  for(const index of [0,1,3,4])assert(paintedResponse[index*4]!>0&&paintedResponse[index*4]!<255,'event finish remains finite and bounded');
  for(const index of [2,5])for(const map of paintedContext.uploads)assert(map.slice(index*4,index*4+4).every(v=>v===0),'painting cannot fill erosion/void');
  assert.deepEqual(painting.pixels,sourceBefore,'cached material pixels remain read-only');
  assert.deepEqual(value.volume.albedo,albedoBefore,'painting never overwrites the reusable volume material');
  paintedRenderer.draw([],0,0,0);assert.equal(paintedContext.uniforms.get('lightCount'),0);
  paintedRenderer.destroy();paintedRenderer.destroy();assert.equal(paintedContext.liveResources(),0);

  // Cut surfaces use their own UV; intact skin and substrate use a common
  // world field. A direction/seed change must affect that field but not the cut.
  const raster=value.world.raster;
  raster.material[0]=1;raster.uv[0]=1.25;raster.uv[1]=2.25;
  raster.material[1]=0;
  // A tiny test receiver needs a magnified coordinate diagnostic: the real
  // authored axes differ by only .04–.10 radians and otherwise hit one texel.
  const coordinatePainting:PaintedMaterial={...painting,worldSize:.4};
  const renderPainting=(world:MasterWorld)=>{
    const context=fakeContext();install(context);
    const renderer=new MasterSurfaceRenderer(world,value.ground,value.volume,coordinatePainting);
    const result=context.uploads[0]!.slice();renderer.destroy();assert.equal(context.liveResources(),0);return result;
  };
  const original=renderPainting(value.world);
  const otherDefinition=MASTER_SCENES.find(definition=>definition.axis!==value.world.definition.axis)!;
  assert(otherDefinition,'authored families include different formation axes');
  const rotated=renderPainting({...value.world,definition:otherDefinition});
  assert.deepEqual(rotated.slice(0,3),original.slice(0,3),'world axis cannot rotate an exposed cut UV');
  assert.notDeepEqual(rotated.slice(12,19),original.slice(12,19),'the substrate follows the formation axis');
  const reseeded=renderPainting({...value.world,sample:{...value.world.sample,seed:41}});
  assert.notDeepEqual(reseeded,original,'authored seed controls material placement');
  raster.material[0]=2;const inner=renderPainting(value.world);
  raster.material[0]=3;const joint=renderPainting(value.world);
  assert.notDeepEqual(inner.slice(0,3),joint.slice(0,3),'inner material and joint do not collapse to one pigment response');

  const failedPaintContext=fakeContext();install(failedPaintContext);
  const failedPaint:PaintedMaterial={...painting,get pixels():Uint8ClampedArray{throw new Error('injected painted pixel read failure');}};
  assert.throws(()=>new MasterSurfaceRenderer(value.world,value.ground,value.volume,failedPaint),/painted pixel read failure/);
  assert.equal(failedPaintContext.counts.losses,1);assert.equal(failedPaintContext.liveResources(),0,'painting preparation failure releases allocated GL state');
  assert.equal(canvas!.width,1);assert.equal(canvas!.height,1);
}finally{
  if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else Reflect.deleteProperty(globalThis,'document');
}
console.log(JSON.stringify({status:'pass',checks:['real authored world metadata fixture','seven GL initialization failures rollback','painted preparation failure rollback','matter-clipped uploads including painting','ground/volume height byte roundtrip','normal encoding','emission ownership','six RGBA allocations','light-count bounds','context-lost rejection','idempotent resource release','painted albedo and explicit event finish without geometry mutation','shared cached pixels remain read-only','cut UV versus world-axis material coordinates','seed-dependent pigment placement','inner/joint material response'],scope:'CPU upload/lifecycle contract with fake GL; no GLSL execution, browser or visual approval'}));
