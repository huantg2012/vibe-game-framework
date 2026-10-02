import assert from 'node:assert/strict';
import { buildNativeVolume } from '../../src/generation/world-study/native-volume-geometry';
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
console.log(JSON.stringify({checked,changed,passed:['all-axis invalidation','stationary reuse','colour/intensity independent','empty receivers','shadow mode changes']}));
