/** Bake the three exterior receivers and the fixed haven. Their light and material samples
 * must travel with the same texel as colour and opaque depth. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {buildOption} from '../../docs/art/demos/purification-forecourt-options/option-a.ts';
import {Model} from '../../docs/art/demos/purification-last-light/model.ts';
import {CAMERA,render} from '../../docs/art/demos/purification-last-light/render.ts';

const dir=path.resolve('public/assets/last-light');
const installedManifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8'));
if(installedManifest.promotion)throw new Error('The selected joint haven owns its matching exterior fields. Rebuild with export-joint.mjs; the historical option-A field exporter may not overwrite them.');
const padding=32,W=CAMERA.width+padding*2,H=CAMERA.height+padding*2;
const columns=['far','middle','near','haven'];
const rows=['otherPollution','core','storage','purifier','furnace','motion','normal'];
const atlas=new Uint8ClampedArray(W*columns.length*H*rows.length*4);
const author=buildOption(),world=new Model();
world.triangles.push(...author.model.triangles.filter(t=>t.object!==7));
world.lights.push(...author.model.lights.filter(l=>l.kind!=='shoulder'));
world.volumes.push(...author.model.volumes);
const camera={...CAMERA,width:W,height:H,origin:[CAMERA.origin[0]+padding,CAMERA.origin[1]+padding]};
const timing={};
for(let column=0;column<columns.length;column++){
 const layer=columns[column],plate=new Model();
 plate.triangles.push(...world.triangles.filter(t=>t.layer===layer));plate.lights.push(...world.lights);
 if(layer==='haven')plate.volumes.push(...world.volumes);
 const started=performance.now();
 console.log(`Exterior ${layer}: ${plate.triangles.length} triangles; full-world shadow casters.`);
 const result=render(plate,camera,message=>console.log(`${layer}: ${message}`),{shadowModel:world,transparentBackground:true,skipEnergy:true,sampleOffset:[padding,padding]});
 timing[layer]=Math.round(performance.now()-started);
 console.log(`${layer} bake ${timing[layer]}ms`);
 const other=new Uint8ClampedArray(result.lightFields.pollution.length);
 for(let i=0;i<other.length;i+=4){
  for(let k=0;k<3;k++)other[i+k]=Math.max(0,result.lightFields.pollution[i+k]-result.coreLight[i+k]-result.storageLight[i+k]-result.purifierLight[i+k]);
  other[i+3]=255;
 }
 const fields=[other,result.coreLight,result.storageLight,result.purifierLight,result.lightFields.furnace,result.motion,result.normal];
 for(let row=0;row<rows.length;row++)for(let y=0;y<H;y++){
  const offset=((row*H+y)*W*columns.length+column*W)*4;
  atlas.set(fields[row].subarray(y*W*4,(y+1)*W*4),offset);
 }
 // Geometry and the approved colour plate are unchanged by this auxiliary bake.
 const existing=await sharp(path.join(dir,layer==='haven'?'haven.png':`exterior-${layer}.png`)).ensureAlpha().raw().toBuffer();
 const comparison=layer==='haven'?await sharp(Buffer.from(result.energyBase),{raw:{width:W,height:H,channels:4}}).extract({left:padding,top:padding,width:CAMERA.width,height:CAMERA.height}).raw().toBuffer():Buffer.from(result.energyBase);
 if(!comparison.equals(existing))throw new Error(`${layer} source plate changed: coordinate a full scene export before using fields`);
 if(process.argv.includes('--first-only')){console.log(JSON.stringify({timing,firstLayerOnly:true}));process.exit(0);}
}
const file=path.join(dir,'exterior-fields.png');
await sharp(Buffer.from(atlas),{raw:{width:W*columns.length,height:H*rows.length,channels:4}}).png().toFile(file);
const sources=['tools/last-light/exterior-export.mjs','docs/art/demos/purification-forecourt-options/option-a.ts','docs/art/demos/purification-forecourt-options/rift-a.ts','docs/art/demos/purification-forecourt-options/shared.ts',...['model.ts','render.ts','environment.ts','devices.ts','rest.ts','scene.ts'].map(f=>`docs/art/demos/purification-last-light/${f}`)];
const hash=b=>createHash('sha256').update(b).digest('hex');
const metadata={version:1,texture:'exterior-fields.png',width:W*columns.length,height:H*rows.length,tile:{width:W,height:H,padding},columns,rows,timing,
 sourceHashes:Object.fromEntries(await Promise.all(sources.map(async f=>[f,hash(await fs.readFile(f))]))),textureHash:hash(await fs.readFile(file)),
 encoding:'4 columns far/middle/near/haven; 7 top-to-bottom rows otherPollution/core/storage/purifier/furnace/motion/normal. Same padded UV as colour and depth; no actor, no shoulder, same full-world shadow casters. Haven column includes source-scattered air at zero alpha.'};
await fs.writeFile(path.join(dir,'exterior-fields.json'),JSON.stringify(metadata,null,2)+'\n');
if(process.argv.includes('--install')){
 const manifestPath=path.join(dir,'manifest.json'),checksumPath=path.join(dir,'checksums.json');
 const manifest=JSON.parse(await fs.readFile(manifestPath,'utf8'));
 const checksums=JSON.parse(await fs.readFile(checksumPath,'utf8'));
 manifest.textures.exteriorFields=metadata.texture;
 manifest.exteriorFields={metadata:'exterior-fields.json',width:metadata.width,height:metadata.height,tile:metadata.tile,columns,rows,sourceHashes:metadata.sourceHashes,
  motion:'XZ-only observation; continuous radial saturation; far <=6px, middle <=3.5px, bonded near layer 0px. Colour, depth, light and material data use the same UV.'};
 await fs.writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 // Separate provenance: never claim that old static colour assets were rebaked.
 checksums.exteriorSources=metadata.sourceHashes;
 for(const filename of ['exterior-fields.png','exterior-fields.json','manifest.json'])checksums.outputs[filename]=hash(await fs.readFile(path.join(dir,filename)));
 await fs.writeFile(checksumPath,JSON.stringify(checksums,null,2)+'\n');
}
console.log(JSON.stringify(metadata,null,2));
