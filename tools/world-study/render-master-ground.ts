import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
import {bakeMasterGround} from '../../src/generation/world-study/master-ground-field';
import {worldProfileById} from '../../src/generation/world-study/profiles';
const width=960,height=640,profile=worldProfileById(process.argv[2]??'ash-strata'),seed=17209;
const surface=bakeMasterGround({width,height,seed,axis:-.22,material:profile.material,palette:profile.palette,sources:[{x:680,y:220,rotation:-.22,length:260,width:140}]});
const rgba=new Uint8ClampedArray(surface.rgba.length),lamp={x:468,y:358,z:28};
for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=y*width+x,p=i*4,n=i*3,dx=lamp.x-x,dy=lamp.y-y,dz=lamp.z-surface.heightField[i]!,distance=Math.hypot(dx,dy,dz),atten=1/(1+(distance/170)**2);
  const dot=Math.max(0,(surface.normals[n]!*dx+surface.normals[n+1]!*dy+surface.normals[n+2]!*dz)/distance);
  const strength=.23+1.7*Math.min(dot,.65)*atten;
  for(let c=0;c<3;c++)rgba[p+c]=Math.min(255,Math.round(surface.albedo[p+c]!*surface.ambientOcclusion[i]!*strength*(c===2?.90:c===1?.98:1.06)));
  rgba[p+3]=255;
}
// A 28px topdown coat and pack give an honest native actor scale. This is only a
// diagnostic marker; the runtime keeps its existing player texture untouched.
function rect(x:number,y:number,w:number,h:number,r:number,g:number,b:number){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){const p=(yy*width+xx)*4;rgba[p]=r;rgba[p+1]=g;rgba[p+2]=b;rgba[p+3]=255;}}
rect(465,363,15,17,21,22,21);rect(464,380,6,8,14,15,14);rect(474,380,6,8,14,15,14);rect(460,367,7,10,47,44,36);rect(469,357,9,9,67,64,54);rect(468,365,3,11,74,67,46);rect(466,357,3,4,220,193,130);
await mkdir('/tmp/r100-ground',{recursive:true});
const revision=process.argv[3]??new Date().toISOString().replace(/[-:.]/g,'');
if(!/^[a-zA-Z0-9_-]+$/.test(revision))throw new Error('Invalid output revision');
const base=`/tmp/r100-ground/${profile.id}-${revision}`;
await sharp(rgba,{raw:{width,height,channels:4}}).png().toFile(`${base}-lamp.png`);
await sharp(surface.rgba,{raw:{width,height,channels:4}}).png().toFile(`${base}-material.png`);
console.log(`${base}-lamp.png\n${base}-material.png`);
