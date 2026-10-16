/** Contract checks for real candidate sprites. These do not decide art quality.
 * node --import tsx tools/rift-player-models/check.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { Model } from '../../docs/art/demos/purification-last-light/model.ts';
import { render } from '../../docs/art/demos/purification-last-light/render.ts';
import { buildCandidateActor } from './model.ts';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'docs/art/previews/rift-player-models/assets');
const manifest=JSON.parse(await fs.readFile(path.join(output,'manifest.json'),'utf8'));
const {width,height,foot}=manifest.frame;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=async file=>sharp(path.join(output,file)).raw().toBuffer();
const report={status:'mechanical-checks',validatorHash:digest(await fs.readFile(fileURLToPath(import.meta.url))),scope:manifest.status,frames:0,sourceHashes:manifest.sourceHashes,variants:[],silhouettes:[],limitations:['Human selection pending.','This does not validate battle animation, production weapon rig or gameplay reachability.','Scene-background contrast is measured by the comparison viewer QA, not this isolated asset check.']};
assert.deepEqual([width,height,foot],[64,80,[32,66]]);
for(const [file,hash]of Object.entries(manifest.sourceHashes))assert.equal(digest(await fs.readFile(path.join(root,file))),hash,`stale source: ${file}`);
for(const [file,hash]of Object.entries(manifest.imageHashes))assert.equal(digest(await fs.readFile(path.join(output,file))),hash,`stale export: ${file}`);
const camera={width,height,origin:foot,scale:26.5,target:[0,0,0],direction:[19,24,30]};
const geometry=(id,yaw=0,phase)=>{const m=new Model();buildCandidateActor(m,id,[0,0,0],yaw,0,phase);return m;};
const invariantParts=m=>{
  // Exact component material/tint groups from the unchanged production author:
  // neck 72, helmet shell 192, rim 64, visor 14, seam 12, ear housings 64+64.
  // Height slicing is invalid when the permitted tall pack bobs into this band.
  const head=m.triangles.filter(t=>(t.material==='iron'&&[1.18,1.02,1.07,.66,.69].includes(t.tint))||(t.material==='black'&&t.tint===.91)||(t.material==='cloth'&&t.tint===.63));
  assert.equal(head.length,482,'head component selection must retain every original piece');
  const boots=m.triangles.filter(t=>[t.a,t.b,t.c].every(p=>p[1]<=.3));
  assert(boots.length>0,'boot invariant selection is empty');
  return {head,boots};
};
const alphaImages={};
for(const variant of manifest.variants){
  const review=await raw(variant.atlas.review),rgba=await raw(variant.atlas.rgba),normal=await raw(variant.atlas.normal),albedo=await raw(variant.atlas.albedo),depth=await raw(variant.atlas.depth);
  const meta=await sharp(path.join(output,variant.atlas.rgba)).metadata();
  assert.equal(meta.width,width*13);assert.equal(meta.height,height*8);
  let minPixels=Infinity,maxPixels=0;
  for(const frame of variant.frames){
    assert.deepEqual(frame.foot,foot);
    assert(frame.bounds[0]>1&&frame.bounds[1]>1&&frame.bounds[2]<width-2&&frame.bounds[3]<height-2,`${variant.id}/${frame.key} clips the frame`);
    assert(frame.pixels>160,`${variant.id}/${frame.key} insufficient body coverage`);
    minPixels=Math.min(minPixels,frame.pixels);maxPixels=Math.max(maxPixels,frame.pixels);
    const [rx,ry]=frame.rect;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=((ry+y)*meta.width+rx+x)*4,a=rgba[i+3];
      assert(a===0||a===255,`nonbinary alpha ${variant.id}/${frame.key}`);
      assert.equal(a,review[i+3]);assert.equal(a,normal[i+3]);assert.equal(a,albedo[i+3]);assert.equal(a,depth[i+3]);
      if(!a)assert(rgba[i]===0&&rgba[i+1]===0&&rgba[i+2]===0,'transparent RGB carries glow');
    }
    report.frames++;
  }
  for(const view of manifest.views){
    const filename=variant.threeViews[view.id].rgba;
    const pixels=await raw(filename);alphaImages[variant.id+'-'+view.id]=pixels;
    const model=geometry(variant.id,view.yaw);
    const base=geometry('a',view.yaw);
    assert.equal(digest(JSON.stringify(invariantParts(model))),digest(JSON.stringify(invariantParts(base))),`${variant.id}/${view.id} changes head/boots`);
    assert.deepEqual(model.lights,base.lights,`${variant.id}/${view.id} changes shoulder lamp`);
    assert.equal(Math.max(...model.triangles.flatMap(t=>[t.a[1],t.b[1],t.c[1]])),1.665);
    // Same render run twice: deterministic source -> byte-identical native pixels.
    const second=geometry(variant.id,view.yaw);for(const light of second.lights){light.power=1;light.radius=2.6;}
    const rebaked=render(second,camera,undefined,{transparentBackground:true,skipEnergy:true});
    for(let i=0;i<width*height;i++)if(!rebaked.normal[i*4+3])rebaked.rgba.fill(0,i*4,i*4+4);
    assert.deepEqual(Buffer.from(rebaked.rgba),pixels,`${variant.id}/${view.id} nondeterministic`);
    if(view.id!=='lamp-side'){
      const bottom=variant.frames.find(f=>f.pose==='idle'&&f.yawIndex===view.yawIndex).bounds[3];
      let gapRows=0;
      for(let y=bottom-7;y<=bottom-2;y++){
        let first=-1,last=-1;for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]){if(first===-1)first=x;last=x;}
        if(first>=0&&last>first&&Array.from({length:last-first-1},(_,j)=>first+j+1).some(x=>!pixels[(y*width+x)*4+3]))gapRows++;
      }
      assert(gapRows>=1,`${variant.id}/${view.id} merges both boots`);
    }
  }
  if(manifest.status!=='idle-review'){
    for(let direction=0;direction<8;direction++)assert.equal(variant.frames.filter(f=>f.yawIndex===direction&&f.pose==='walk').length,12);
    for(const phase of [0,Math.PI*.5,Math.PI,Math.PI*1.5]){
      const model=geometry(variant.id,0,phase),base=geometry('a',0,phase);
      assert.equal(digest(JSON.stringify(invariantParts(model))),digest(JSON.stringify(invariantParts(base))),`${variant.id} walking alters rigid identity`);
      assert.deepEqual(model.lights,base.lights,`${variant.id} walking detaches lamp`);
    }
  }
  report.variants.push({id:variant.id,frameCount:variant.frames.length,pixelRange:[minPixels,maxPixels],height:1.665,headAndBoots:'identical-to-haven',lamp:'identical-to-haven'});
}
function difference(a,b){let union=0,xor=0;for(let i=0;i<a.length;i+=4){
  // The identical emissive lamp does not contribute to shape distinction.
  const lampA=a[i]>180&&a[i+1]>150,lampB=b[i]>180&&b[i+1]>150;
  if(lampA||lampB)continue;
  const aa=Boolean(a[i+3]),bb=Boolean(b[i+3]);if(aa||bb)union++;if(aa!==bb)xor++;
}return xor/Math.max(1,union);}
for(const [a,b]of [['a','b'],['a','c'],['b','c']]){
  const diffs=Object.fromEntries(manifest.views.map(v=>[v.id,difference(alphaImages[a+'-'+v.id],alphaImages[b+'-'+v.id])]));
  assert(Math.max(...Object.values(diffs))>=.08,`${a}/${b} silhouette collapse: ${JSON.stringify(diffs)}`);
  report.silhouettes.push({pair:[a,b],difference:diffs});
}
assert.equal(difference(alphaImages['a-front'],alphaImages['a-front']),0,'negative control must reject recoloring/duplicates');
assert.deepEqual(alphaImages['a-front'],alphaImages['haven-front'],'A no longer equals the actual mother model');
await fs.writeFile(path.join(output,'mechanical-check.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
