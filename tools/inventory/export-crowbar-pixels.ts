import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { renderCrowbarPixels, type CrowbarQuality, type CrowbarVariant, type CrowbarPixels } from '../../src/art/crowbar-pixels';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const directory = path.join(root, 'public/assets/weapons/crowbars');
const source = 'data/weapons.csv';
const qualities: CrowbarQuality[] = ['ordinary','good','fine','excellent'];
const variants: CrowbarVariant[] = ['standard','light','resistant'];

function parseCsv(text: string): Record<string,string>[] {
  const rows: string[][] = []; let row: string[] = [], value = '', quoted = false;
  for (let i=0; i<text.length; i++) {
    const c=text[i]!;
    if (c==='"') { if (quoted && text[i+1]==='"') { value+='"'; i++; } else quoted=!quoted; }
    else if (!quoted && (c===',' || c==='\n')) { row.push(value.replace(/\r$/,'')); value=''; if(c==='\n'){rows.push(row);row=[];} }
    else value+=c;
  }
  assert.ok(!quoted,'Unclosed CSV quote');
  if(row.length || value){row.push(value.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift(); assert.ok(header);
  return rows.filter(r=>r.some(Boolean)).map(r=>{assert.equal(r.length,header.length);return Object.fromEntries(header.map((h,i)=>[h,r[i]!]));});
}
function inspect(pixels: CrowbarPixels) {
  let occupied=0,green=0, minX=pixels.width, minY=pixels.height, maxX=-1,maxY=-1;
  const mask: number[]=[];
  for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++){
    const i=(y*pixels.width+x)*4, alpha=pixels.data[i+3]!;
    assert.ok(alpha===0||alpha===255,'Soft alpha forbidden'); mask.push(alpha);
    if(!alpha)continue;
    assert.ok(x>0&&y>0&&x<pixels.width-1&&y<pixels.height-1,'Cropped edge');
    occupied++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);
    if(pixels.data[i+1]!>pixels.data[i]!+15)green++;
  }
  assert.ok(occupied>45);assert.equal(pixels.data[(pixels.pivot.y*pixels.width+pixels.pivot.x)*4+3],255,'Empty hand pivot');
  return {occupied,green,bounds:{minX,minY,maxX,maxY},mask:mask.join(',')};
}
async function png(pixels: CrowbarPixels) {
  return sharp(Buffer.from(pixels.data),{raw:{width:pixels.width,height:pixels.height,channels:4}}).png().toBuffer();
}
await mkdir(directory,{recursive:true});
const rows=parseCsv(await readFile(path.join(root,source),'utf8'));
assert.equal(rows.length,10);assert.equal(new Set(rows.map(r=>r.id)).size,10);
const entries=[];
const silhouette=new Map<string,string>();
const colors=new Map<string,number>();
const sheet: sharp.OverlayOptions[]=[];
const expected=new Set(['manifest.json','crowbar-pixels-sheet.png']);
for(const [index,row] of rows.entries()){
  assert.match(row.id!,/^crowbar_[a-z_]+$/);
  assert.ok(qualities.includes(row.quality_id as CrowbarQuality));assert.ok(variants.includes(row.variant_id as CrowbarVariant));
  const quality=row.quality_id as CrowbarQuality,variant=row.variant_id as CrowbarVariant;
  const assets:Record<string,unknown>={};
  for(const purpose of ['world','icon'] as const){
    const pixels=renderCrowbarPixels(quality,variant,purpose), audit=inspect(pixels), key=`${quality}/${purpose}`;
    assert.equal(pixels.width,purpose==='world'?32:48);
    if(quality==='ordinary')assert.equal(audit.green,0,'Plain iron carries no contamination color');
    else assert.ok(audit.green>0&&audit.green/audit.occupied<.25,'Contamination must be a local accent');
    if(silhouette.has(key)){assert.equal(audit.mask,silhouette.get(key),'Variant changed silhouette');assert.equal(audit.green,colors.get(key),'Variant changed pollution amount');}
    else{silhouette.set(key,audit.mask);colors.set(key,audit.green);}
    const filename=`${row.id}-${purpose}.png`,buffer=await png(pixels);expected.add(filename);
    await writeFile(path.join(directory,filename),buffer);
    assets[purpose]={file:filename,width:pixels.width,height:pixels.height,pivot:pixels.pivot,alpha:'binary',bounds:audit.bounds,opaquePixels:audit.occupied,pollutionPixels:audit.green};
    const scale=purpose==='world'?4:4;
    sheet.push({input:await sharp(buffer).resize(pixels.width*scale,pixels.height*scale,{kernel:'nearest'}).toBuffer(),left:index*208+(purpose==='world'?40:8),top:purpose==='world'?16:160});
  }
  entries.push({id:row.id,name:row.name,quality,variant,...assets});
}
for(const purpose of ['world','icon'])assert.equal(new Set(qualities.map(q=>silhouette.get(`${q}/${purpose}`))).size,4,`${purpose}: indistinct quality silhouette`);
await writeFile(path.join(directory,'manifest.json'),JSON.stringify({schemaVersion:1,source,authorship:'native-resolution hand-authored pixels',runtimeIntegration:'bound to production player rig, field loot and inventory',entries},null,2)+'\n');
await sharp({create:{width:rows.length*208,height:368,channels:4,background:{r:24,g:27,b:26,alpha:1}}}).composite(sheet).png().toFile(path.join(directory,'crowbar-pixels-sheet.png'));
const files=await readdir(directory);assert.deepEqual([...files].sort(),[...expected].sort(),'Unexpected or missing crowbar exports');
console.log(`PASS crowbar pixels: ${rows.length} CSV items, 20 binary-alpha PNGs, four distinct silhouettes at both scales, shared grip, variant silhouette/pollution parity.`);
