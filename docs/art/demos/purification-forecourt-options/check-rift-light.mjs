import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {buildOption} from './option-a.ts';
import {CAMERA,render} from '../purification-last-light/render.ts';

// Compare the final saved render with exactly the same geometry and emissive
// surfaces, but no Rift lights. This isolates received light from a bright edge.
const assets=new URL('./assets/',import.meta.url);
const {model}=buildOption();
const sources=model.lights.filter(light=>light.id.startsWith('rift-'));
assert.equal(sources.length,3);
for(let i=model.lights.length-1;i>=0;i--)if(model.lights[i].id.startsWith('rift-'))model.lights.splice(i,1);
const off=render(model,CAMERA,console.log);
const imageFile=new URL('a.png',assets);
const on=await sharp(await fs.readFile(imageFile)).raw().toBuffer();
let receiverPixels=0,maxChannelIncrease=0,totalIncrease=0;
let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
for(let i=0;i<off.objects.length;i++){
  if(off.objects[i]!==0||off.layers[i]!==4)continue;
  const difference=[0,1,2].map(k=>on[i*4+k]-off.rgba[i*4+k]);
  const increase=Math.max(...difference);
  if(increase<2)continue;
  receiverPixels++;totalIncrease+=difference.reduce((n,value)=>n+Math.max(0,value),0);
  maxChannelIncrease=Math.max(maxChannelIncrease,increase);
  const x=i%CAMERA.width,y=Math.floor(i/CAMERA.width);
  minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
}
assert(receiverPixels>100,'Rift must illuminate actual surrounding architecture, not only its own outline');
assert(maxChannelIncrease>=6,'Rift light is not visibly received by surrounding architecture');
const report={scope:'same geometry/emission; only rift-* illumination removed',sources,
  receiverObject:0,receiverLayer:'haven',receiverPixels,maxChannelIncrease,totalIncrease,
  receiverPixelBounds:{minX,minY,maxX,maxY},
  renderSha256:createHash('sha256').update(await fs.readFile(imageFile)).digest('hex'),
  limitations:'Checks actual received light. Does not establish human art acceptance or animation.'};
await fs.writeFile(new URL('rift-light-check.json',assets),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
