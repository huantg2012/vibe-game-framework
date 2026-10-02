import assert from 'node:assert/strict';
import { buildNativeVolume, type NativeVolumeMesh } from '../../src/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster, NativeVolumeLighting, nativeVolumeLightVisibility, type NativeVolumeLight, type NativeVolumeMaterialSet } from '../../src/generation/world-study/native-volume-raster';

const material = {base:[90,95,92], dark:[35,40,38], light:[160,166,158], roughness:.8, structure:.6} as const;
const palette:NativeVolumeMaterialSet={outer:material,cut:material,inner:material,joint:material};
const mesh=buildNativeVolume({id:1,family:'broken-shell',seed:743,x:128,y:128,rotation:.3,length:180,width:150,height:64,thickness:18,fold:.6,branches:3,opening:.3,distortion:.4});
const raster=compileNativeVolumeRaster([mesh],{x:0,y:0,width:256,height:256,opticalHeight:24});
const shader=new NativeVolumeLighting(raster,palette);
const light:NativeVolumeLight={x:32,y:40,z:28,radius:300,intensity:2,color:[1,.94,.83]};
const probes=Array.from(raster.occupiedPixels).filter((_v,i)=>i%19===0);
const original=probes.map(index=>shader.lightVisibilityAt(index,light));
let checked=0,changed=0;
for(const position of [[32,40,28],[220,200,28],[220,200,100],[120,30,10],[32,40,28]]){
 [light.x,light.y,light.z]=position as [number,number,number];
 for(let at=0;at<probes.length;at++){
  const index=probes[at]!, x=index%raster.width+.5,y=Math.floor(index/raster.width)+.5;
  const expected=nativeVolumeLightVisibility(raster,x,y,raster.heightField[index]!,light);
  const actual=shader.lightVisibilityAt(index,light);
  assert(Math.abs(actual-expected)<1e-6,'moving cached source must match the same geometry ray');
  assert.equal(shader.lightVisibilityAt(index,light),actual,'repeated read remains stable');
  if(Math.abs(actual-original[at]!)>.2)changed++;
  checked++;
 }
}
assert(changed>20,'probe covers actual changes in shadow, including source height');
const before=new Uint8ClampedArray(256*256*4),after=new Uint8ClampedArray(before.length);
shader.render([light],before,{ambient:.3});
light.intensity=.1;light.color=[.3,1,.5];
shader.render([light],after,{ambient:.3});
assert(!Buffer.from(before).equals(Buffer.from(after)),'colour/intensity change illumination even when geometry visibility is cached');
assert.equal(shader.lightVisibilityAt(0,light),0,'no surface cannot become a visible receiver');
light.castsShadow=false;
assert(probes.every(index=>shader.lightVisibilityAt(index,light)===1),'explicit unshadowed light bypasses old cache');
light.castsShadow=true;
assert(probes.some(index=>shader.lightVisibilityAt(index,light)<.5),'reenabling shadows restores real occlusion');

// Rotate a flat receiver, the material coordinate frame and the light together.
// The same material point must keep its colour/brightness and rotate its bump
// normal. This catches applying UV derivatives directly to world X/Y without
// copying the production derivative formula into the test.
function flatReceiver(x:number,y:number,slot=0){
  const plane:NativeVolumeMesh={spec:{...mesh.spec,id:1,family:'folded-slab'},
    positions:new Float32Array([x-1,y-1,5,x+2,y-1,5,x+2,y+2,5,x-1,y+2,5]),
    normals:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),uv:new Float32Array([0,0,3,0,3,3,0,3]),
    indices:new Uint32Array([0,1,2,0,2,3]),materials:new Uint8Array([slot,slot]),regions:new Uint8Array(2),
    vertexCount:4,triangleCount:2,bounds:{minX:x-1,minY:y-1,maxX:x+2,maxY:y+2,maxZ:5},joints:[]};
  return compileNativeVolumeRaster([plane],{x,y,width:1,height:1,opticalHeight:24});
}
let rotatedSamples=0,nonFlatSamples=0;
for(const angle of [-1.1,.43,Math.PI/2])for(let sample=0;sample<12;sample++){
  const u=13.25+sample*3.5,v=17.375+sample*5.25,c=Math.cos(angle),s=Math.sin(angle),x=u*c-v*s,y=u*s+v*c;
  const a=flatReceiver(u,v),b=flatReceiver(x,y);
  const first=new NativeVolumeLighting(a,palette,{seed:6017,axis:0}),rotated=new NativeVolumeLighting(b,palette,{seed:6017,axis:angle});
  const n=first.shadingNormals,m=rotated.shadingNormals;
  assert(Math.abs(m[0]!-(n[0]!*c-n[1]!*s))<1e-5 && Math.abs(m[1]!-(n[0]!*s+n[1]!*c))<1e-5 && Math.abs(m[2]!-n[2]!)<1e-5,'material bump normal follows the rotated coordinate frame');
  assert.deepEqual(Array.from(rotated.albedo),Array.from(first.albedo),'same material point keeps its albedo under world rotation');
  if(Math.hypot(n[0]!,n[1]!)>.0001)nonFlatSamples++;
  const before=new Uint8ClampedArray(4),after=new Uint8ClampedArray(4);
  first.render([{x:u+.5+25,y:v+.5-10,z:30,radius:100,intensity:2,color:[1,1,1],castsShadow:false}],before,{ambient:.3});
  rotated.render([{x:x+.5+25*c+10*s,y:y+.5+25*s-10*c,z:30,radius:100,intensity:2,color:[1,1,1],castsShadow:false}],after,{ambient:.3});
  assert(before.every((value,i)=>Math.abs(value-after[i]!)<=1),'rotating material and light together preserves the actual rendered response');
  const cut=new NativeVolumeLighting(flatReceiver(x,y,1),palette,{seed:6017,axis:angle});
  assert.deepEqual(Array.from(cut.shadingNormals),[0,0,1],'cut UV is not misused as a world-space normal basis');
  rotatedSamples++;
}
assert(nonFlatSamples>25,'rotation test includes actual microrelief, not only unchanged flat normals');
const invisible=new Uint8ClampedArray(256*256*4).fill(255);
shader.render([light],invisible,{ambient:1,visibility:new Float32Array(256*256)});
assert(invisible.every(value=>value===0),'zero authoritative visibility suppresses all output even with ambient light');
console.log(JSON.stringify({checked,changed,rotatedSamples,nonFlatSamples,passed:['all-axis invalidation','stationary reuse','colour/intensity independent','empty receivers','shadow mode changes','material-frame rotation','rotated lighting equivalence','cut-face normal isolation','zero authoritative visibility']}));
