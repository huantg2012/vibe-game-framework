/** Reproducible native catalog export and structural checks; never claims an aesthetic PASS. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { CATALOG_ART_ITEM_IDS, CATALOG_ART_APPEARANCE_IDS, CATALOG_GROUND_IDS, catalogArtCanvas, catalogIconPixels, catalogWorldPixels, catalogGroundPixels, catalogRemnantPixels, catalogIconSvg, type CatalogPixels, type CatalogIconRef } from '../../src/art/contaminant-catalog-icons';

import { CATALOG_OBJECTS } from '../../src/art/contaminant-catalog-icons-objects';
import { SECONDARY_OBJECTS } from '../../src/art/contaminant-catalog-icons-secondary';
import { CATALOG_SHELLS } from '../../src/art/contaminant-catalog-icons-shells';
import { PixelCanvas } from '../../src/art/contaminant-catalog-icons-pixels';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'public/assets/items/contaminant-catalog');
const sample=process.argv.includes('--sample');
const SAMPLE=['amber_beetle','stopped_pocket_watch','sealed_hourglass','brass_monocle','milky_fish_eye','doorless_lantern','wax_sealed_button','double_hole_token'];
async function csv(name:string):Promise<Record<string,string>[]> {
  let file=path.join(root,'data',name);try{await access(file);}catch{file=path.join(root,'data/drafts',name);}
  const text=(await readFile(file,'utf8')).trim().replace(/^\uFEFF/,'');
  const lines=text.split(/\r?\n/),heads=lines.shift()!.split(',');
  return lines.map(line=>{const values:string[]=[];let value='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i]!;if(c==='"'){if(quoted&&line[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){values.push(value);value='';}else value+=c;}values.push(value);return Object.fromEntries(heads.map((h,i)=>[h,values[i]??'']));});
}
// Production merges core/noise into one table; the proposal keeps them in separate tables.
const definitions=[...new Map([...await csv('contaminant-items.csv'),...await csv('contaminant-noise.csv')].map(row=>[row.item_id,row])).values()];
const appearances=await csv('contaminant-appearances.csv');
if(!sample){assert.equal(definitions.length,48);assert.deepEqual([...CATALOG_ART_ITEM_IDS].sort(),definitions.map(d=>d.item_id!).sort());}
assert.deepEqual([...CATALOG_ART_APPEARANCE_IDS].sort(),appearances.map(a=>a.appearance_id!).sort());
const ids=sample?SAMPLE:[...CATALOG_ART_ITEM_IDS];
await mkdir(out,{recursive:true});
const silhouettes=new Set<string>();
const records:unknown[]=[];
const contrastRecords:unknown[]=[];
function luminance(rgb:number):number {const v=[rgb>>16,(rgb>>8)&255,rgb&255].map(c=>{const n=c/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return v[0]!*.2126+v[1]!*.7152+v[2]!*.0722;}
function checkStaticContrast(p:CatalogPixels,id:string):void {
  for(const background of [0x151a17,0x181e22,0x2c2e33]){
    const readable=new Set<number>();
    for(let i=0;i<p.width*p.height;i++)if(p.data[i*4+3]){const color=(p.data[i*4]!<<16)|(p.data[i*4+1]!<<8)|p.data[i*4+2]!;if((luminance(color)+.05)/(luminance(background)+.05)>=3)readable.add(i);}
    let largest=0;const visited=new Set<number>();
    for(const i of readable){if(visited.has(i))continue;const queue=[i];visited.add(i);for(let n=0;n<queue.length;n++){const q=queue[n]!;for(const j of [q-1,q+1,q-p.width,q+p.width])if(readable.has(j)&&!visited.has(j)){visited.add(j);queue.push(j);}}largest=Math.max(largest,queue.length);}
    assert.ok(largest>=3,`${id}: no continuous material cluster at 3:1 against ${background.toString(16)}`);
    contrastRecords.push({id,background:background.toString(16),threshold:3,largestConnectedMaterialPixels:largest});
  }
}
function checkPixels(p:CatalogPixels,id:string,unique=false):void {
  assert.equal(p.data.length,p.width*p.height*4);let opaque=0;const mask:number[]=[];
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){
    const a=p.data[(y*p.width+x)*4+3]!;assert.ok(a===0||a===255,`${id}: nonbinary alpha`);mask.push(a?1:0);
    if(a){opaque++;assert.ok(x>0&&y>0&&x<p.width-1&&y<p.height-1,`${id}: missing transparent edge ${x},${y}`);}
  }
  assert.ok(opaque>10&&opaque<p.width*p.height*.85,`${id}: invalid material area ${opaque}`);
  if(unique){const signature=mask.join('');assert.ok(!silhouettes.has(signature),`${id}: exact reused silhouette`);silhouettes.add(signature);}
  records.push({id,width:p.width,height:p.height,opaquePixels:opaque});
}
async function png(p:CatalogPixels):Promise<Buffer>{return sharp(Buffer.from(p.data),{raw:{width:p.width,height:p.height,channels:4}}).png().toBuffer();}
type Entry={id:string;ref:CatalogIconRef};
const entries:Entry[]=[...ids.map(id=>({id,ref:{kind:'item',definitionId:id} as CatalogIconRef})),...(sample?CATALOG_ART_APPEARANCE_IDS.slice(0,2):CATALOG_ART_APPEARANCE_IDS).map(id=>({id:`shell-${id}`,ref:{kind:'shell',appearanceId:id} as CatalogIconRef}))];
const sheets:sharp.OverlayOptions[]=[];
const native:sharp.OverlayOptions[]=[];
for(const [index,entry] of entries.entries()){
  const icon=catalogIconPixels(entry.ref),world=catalogWorldPixels(entry.ref);
  checkPixels(icon,`${entry.id}/24`,entry.ref.kind==='item');checkPixels(world,`${entry.id}/32`);
  const painter=entry.ref.kind==='shell'?CATALOG_SHELLS[entry.ref.appearanceId]:({...CATALOG_OBJECTS,...SECONDARY_OBJECTS})[entry.ref.definitionId];
  assert.ok(painter);const raw24=new PixelCanvas(24),raw32=new PixelCanvas(32);painter(raw24);painter(raw32);
  assert.deepEqual(icon.data,raw24.pixels().data,`${entry.id}: world face work leaked into UI24`);
  const original32=raw32.pixels();for(let i=3;i<world.data.length;i+=4)assert.equal(world.data[i],original32.data[i],`${entry.id}: material planes changed silhouette/negative space`);
  checkStaticContrast(icon,entry.id);
  const ip=await png(icon),wp=await png(world);
  await writeFile(path.join(out,`${entry.id}-24.png`),ip);await writeFile(path.join(out,`${entry.id}-32.png`),wp);
  await writeFile(path.join(out,`${entry.id}.svg`),catalogIconSvg(entry.ref));
  const x=(index%4)*280,y=Math.floor(index/4)*156;
  sheets.push({input:ip,left:x+8,top:y+51},{input:await sharp(ip).resize(96,96,{kernel:'nearest'}).toBuffer(),left:x+42,top:y+16});
  sheets.push({input:wp,left:x+148,top:y+47},{input:await sharp(wp).resize(64,64,{kernel:'nearest'}).toBuffer(),left:x+193,top:y+32});
  const label=Buffer.from(`<svg width="276" height="34"><text x="7" y="13" font-size="10" font-family="monospace" fill="#cad0c2">${entry.id}</text><text x="7" y="29" font-size="9" font-family="monospace" fill="#849388">24 native / 4x ; 32 native / 2x</text></svg>`);
  sheets.push({input:label,left:x,top:y+118});
  const nx=index%6*184,ny=Math.floor(index/6)*70;
  native.push({input:ip,left:nx+8,top:ny+7},{input:wp,left:nx+48,top:ny+3});
  native.push({input:Buffer.from(`<svg width="184" height="20"><text x="5" y="12" font-size="8" font-family="monospace" fill="#cad0c2">${entry.id}</text></svg>`),left:nx,top:ny+44});
}
for(const id of CATALOG_ART_APPEARANCE_IDS){for(const size of [24,32] as const){const p=catalogRemnantPixels(id,size);checkPixels(p,`remnant-${id}/${size}`);await writeFile(path.join(out,`remnant-${id}-${size}.png`),await png(p));}}
let combinations=0;
let minRemnant=Infinity,maxRemnant=0;
const seamRecords:unknown[]=[];
for(const id of ids)for(const appearanceId of CATALOG_ART_APPEARANCE_IDS)for(const size of [24,32] as const){
  const base=catalogArtCanvas({kind:'item',definitionId:id},size),composed=catalogArtCanvas({kind:'item',definitionId:id,appearanceId},size);
  checkPixels(composed.pixels(),`${id}+${appearanceId}/${size}`);
  base.cells.forEach((c,i)=>{if(c!==undefined)assert.equal(composed.cells[i],c,'Remnant painted over object');if(base.protected[i])assert.equal(composed.cells[i],c,'Remnant covered identity feature');});
  const added=composed.cells.flatMap((c,i)=>c!==undefined&&base.cells[i]===undefined?[i]:[]);
  assert.ok(added.length>=5,`${id}/${appearanceId}/${size}: remnant disappeared`);
  const reachable=new Set<number>(),pending=[...added.filter(i=>[i-1,i+1,i-size,i+size].some(j=>base.cells[j]!==undefined))],addedSet=new Set(added);
  for(let n=0;n<pending.length;n++){const i=pending[n]!;if(reachable.has(i))continue;reachable.add(i);for(const j of [i-1,i+1,i-size,i+size])if(addedSet.has(j)&&!reachable.has(j))pending.push(j);}
  assert.equal(reachable.size,added.length,`${id}/${appearanceId}/${size}: floating fragment`);
  minRemnant=Math.min(minRemnant,added.length);maxRemnant=Math.max(maxRemnant,added.length);
  if(appearanceId===CATALOG_ART_APPEARANCE_IDS[0])seamRecords.push({id,size,anchor:composed.anchor});
  combinations++;
}
const groundSheet:sharp.OverlayOptions[]=[];
for(const [i,id] of CATALOG_GROUND_IDS.entries()){
  const p=catalogGroundPixels({kind:'item',definitionId:id})!;assert.equal(p.width,16);assert.equal(p.height,16);checkPixels(p,`${id}/ground16`);
  const buffer=await png(p);await writeFile(path.join(out,`${id}-ground-16.png`),buffer);
  const x=i%4*280,y=Math.floor(i/4)*118;groundSheet.push({input:buffer,left:x+8,top:y+34},{input:await sharp(buffer).resize(64,64,{kernel:'nearest'}).toBuffer(),left:x+44,top:y+10});
  groundSheet.push({input:Buffer.from(`<svg width="270" height="22"><text x="7" y="15" font-size="10" font-family="monospace" fill="#cad0c2">${id} / native16 + 4x</text></svg>`),left:x,top:y+83});
}
await sharp({create:{width:1120,height:Math.ceil(CATALOG_GROUND_IDS.length/4)*118,channels:4,background:'#181e22'}}).composite(groundSheet).png().toFile(path.join(out,'catalog-ground.png'));
// Complete shell-to-object correspondence: native24 and 2x for every shell and true object.
const seamSheet:sharp.OverlayOptions[]=[];
for(const [row,id] of ids.entries())for(const [column,appearanceId] of CATALOG_ART_APPEARANCE_IDS.entries()){
  const buffer=await png(catalogIconPixels({kind:'item',definitionId:id,appearanceId}));
  const x=column*106,y=row*66;seamSheet.push({input:buffer,left:x+5,top:y+16},{input:await sharp(buffer).resize(48,48,{kernel:'nearest'}).toBuffer(),left:x+40,top:y+4});
}
const seamBuffer=await sharp({create:{width:848,height:ids.length*66,channels:4,background:'#181e22'}}).composite(seamSheet).png().toBuffer();
await writeFile(path.join(out,`${sample?'sample':'catalog'}-seams.png`),seamBuffer);
if(!sample)for(let n=0;n<4;n++)await sharp(seamBuffer).extract({left:0,top:n*12*66,width:848,height:12*66}).png().toFile(path.join(out,`catalog-seams-${n+1}.png`));
const prefix=sample?'sample':'catalog';
const board=await sharp({create:{width:1120,height:Math.ceil(entries.length/4)*156,channels:4,background:'#181e22'}}).composite(sheets).png().toBuffer();
await writeFile(path.join(out,`${prefix}-review.png`),board);
await sharp({create:{width:1104,height:Math.ceil(entries.length/6)*70,channels:4,background:'#181e22'}}).composite(native).png().toFile(path.join(out,`${prefix}-native.png`));
if(!sample)for(let i=0;i<Math.ceil(entries.length/12);i++){const top=i*3*156,height=Math.min(3*156,Math.ceil(entries.length/4)*156-top);await sharp(board).extract({left:0,top,width:1120,height}).png().toFile(path.join(out,`catalog-review-${i+1}.png`));}
if(!sample){
  const atlases:Record<string,unknown>={};
  for(const size of [24,32,16] as const){
    const source=size===16?CATALOG_GROUND_IDS.map(id=>({id:`ground:${id}`,pixels:catalogGroundPixels({kind:'item',definitionId:id})!})):[...entries.map(entry=>({id:entry.ref.kind==='item'?`item:${entry.ref.definitionId}`:`shell:${entry.ref.appearanceId}`,pixels:size===24?catalogIconPixels(entry.ref):catalogWorldPixels(entry.ref)})),...CATALOG_ART_APPEARANCE_IDS.map(id=>({id:`remnant:${id}`,pixels:catalogRemnantPixels(id,size)}))];
    const columns=size===16?4:8,pitch=size+4,layers:sharp.OverlayOptions[]=[],frames:Record<string,unknown>={};
    for(const [i,entry] of source.entries()){const x=i%columns*pitch+2,y=Math.floor(i/columns)*pitch+2;layers.push({input:await png(entry.pixels),left:x,top:y});frames[entry.id]={x,y,width:size,height:size};}
    const file=`catalog-atlas-${size}.png`;await sharp({create:{width:columns*pitch,height:Math.ceil(source.length/columns)*pitch,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite(layers).png().toFile(path.join(out,file));
    atlases[size]={file,gutter:2,filter:'nearest',frames};
  }
  await writeFile(path.join(out,'catalog-atlas.json'),JSON.stringify(atlases,null,2)+'\n');
}
const sourceFiles=['src/art/contaminant-catalog-icons.ts','src/art/contaminant-catalog-icons-pixels.ts','src/art/contaminant-catalog-icons-objects.ts','src/art/contaminant-catalog-icons-secondary.ts','src/art/contaminant-catalog-icons-shells.ts','src/art/contaminant-catalog-icons-ground.ts','src/art/contaminant-catalog-icons-world-faces.ts','tools/inventory/export-contaminant-catalog-icons.ts'];
const sourceHashes=Object.fromEntries(await Promise.all(sourceFiles.map(async f=>[f,createHash('sha256').update(await readFile(path.join(root,f))).digest('hex')])));
await writeFile(path.join(out,`${prefix}-manifest.json`),JSON.stringify({status:'GENERATED / NOT-USER-APPROVED',source:'src/art/contaminant-catalog-icons.ts',sourceHashes,authors:'hand-authored native pixel objects; no image generation or bitmap downsample',sizes:[24,32],groundSizes:[16],quality:'shared object artwork; public state controls icon selection',items:ids,appearances:CATALOG_ART_APPEARANCE_IDS,groundIds:CATALOG_GROUND_IDS,combinationsChecked:combinations,remnantAddedPixels:{min:minRemnant,max:maxRemnant},seams:seamRecords,staticContrast:{scope:'unlit source pixels over three fixed UI/reference backgrounds; not final world lighting or whole-silhouette proof',records:contrastRecords},records},null,2)+'\n');
console.log(JSON.stringify({export:prefix,itemCount:ids.length,shellCount:CATALOG_ART_APPEARANCE_IDS.length,combinationsChecked:combinations,review:`${prefix}-review.png`,native:`${prefix}-native.png`}));
