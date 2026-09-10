/** Exports the native pixel source; no concept-art sampling or automatic restyling. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';
import { CONTAMINANT_ICON_IDS, CONTAMINANT_SAMPLE_IDS, CONTAMINANT_ART_QUALITIES, contaminantIconPixels, contaminantIconSvg, contaminantWorldPixels } from '../../src/art/contaminant-icons';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'public/assets/items/contaminants');
const csv=(await readFile(path.join(root,'data/contaminants.csv'),'utf8')).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
const ids=csv.slice(1).map(row=>row.split(',')[0]!);
assert.deepEqual([...CONTAMINANT_ICON_IDS].sort(),ids.sort(),'Every CSV type needs an icon');
await mkdir(out,{recursive:true});
const colors=new Set<string>(), silhouettes=new Set<string>();
const sheet:sharp.OverlayOptions[]=[];
const entries=[];
for(const [n,id] of CONTAMINANT_ICON_IDS.entries()){
  const p=contaminantIconPixels(id);let count=0,bright=0;const mask=[];
  assert.equal(p.width,24);assert.equal(p.height,24);
  for(let y=0;y<24;y++)for(let x=0;x<24;x++){
    const i=(y*24+x)*4,a=p.data[i+3]!;assert.ok(a===0||a===255,'Icons require hard binary alpha');mask.push(a?1:0);if(!a)continue;
    assert.ok(x>0&&x<23&&y>0&&y<23,`${id}: clipped edge`);count++;
    const [r,g,b]=[p.data[i]!,p.data[i+1]!,p.data[i+2]!];colors.add(`${r},${g},${b}`);if(r>=104&&g>=115&&b>=102)bright++;
  }
  assert.ok(count>40&&count<310,`${id}: insufficient object or excessive solid fill`);
  assert.ok(bright>=2,`${id}: no readable material edge`);
  const signature=mask.join('');assert.ok(!silhouettes.has(signature),`${id}: reused silhouette`);silhouettes.add(signature);
  const png=await sharp(Buffer.from(p.data),{raw:{width:24,height:24,channels:4}}).png().toBuffer();
  await writeFile(path.join(out,`${id}.png`),png);
  await writeFile(path.join(out,`${id}.svg`),contaminantIconSvg(id));
  const left=(n%6)*168,top=Math.floor(n/6)*162;
  sheet.push({input:await sharp(png).resize(96,96,{kernel:'nearest'}).toBuffer(),left:left+6,top:top+6});
  sheet.push({input:png,left:left+120,top:top+10});
  sheet.push({input:await sharp(png).resize(40,40,{kernel:'nearest'}).toBuffer(),left:left+112,top:top+49});
  sheet.push({input:Buffer.from(`<svg width="160" height="36"><text x="6" y="21" font-family="sans-serif" font-size="12" fill="#b7beac">${id}</text><text x="107" y="21" font-family="sans-serif" font-size="9" fill="#748276">24 / 40</text></svg>`),left,top:top+109});
  entries.push({id,width:24,height:24,opaquePixels:count,png:`${id}.png`,svg:`${id}.svg`});
}
assert.equal(colors.size,8,'Unexpected palette drift');
await writeFile(path.join(out,'manifest.json'),JSON.stringify({source:'src/art/contaminant-icons.ts',dataSource:'data/contaminants.csv',authorship:'hand-authored native pixel objects',alpha:'binary',identity:'shared between defense residue and active/passive tool',entries},null,2)+'\n');
await sharp({create:{width:1008,height:486,channels:4,background:'#151a17'}}).composite(sheet).png().toFile(path.join(out,'contaminant-icons-sheet.png'));
console.log(`PASS ${entries.length} CSV identities: unique silhouettes, 24px native pixels, binary alpha, eight-color palette, transparent margin, readable edges; PNG/SVG and 24/40/96px review sheet exported.`);

// First eight objects: four qualities, native icon and world geometry side by side.
const qualitySheet:sharp.OverlayOptions[]=[];
const variants=[];
const luminance=(r:number,g:number,b:number)=>[r,g,b].map(v=>{const c=v/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[0.2126,0.7152,0.0722][i]!,0);
// Both report-dark and the brighter test ground need a material edge, not only teal.
const backgrounds=[luminance(21,26,23),luminance(41,42,43)];
const nativeSheet:sharp.OverlayOptions[]=[];
for(const [row,id] of CONTAMINANT_SAMPLE_IDS.entries()) {
  const hashes=new Set<string>();
  for(const [column,quality] of CONTAMINANT_ART_QUALITIES.entries()) {
    const icon=contaminantIconPixels(id,quality),world=contaminantWorldPixels(id,quality);
    const pngs:Buffer[]=[];
    for(const [kind,pixels] of [['icon',icon],['world',world]] as const) {
      let count=0,readableEdge=0;
      for(let y=0;y<pixels.height;y++)for(let x=0;x<pixels.width;x++) {
        const offset=(y*pixels.width+x)*4,a=pixels.data[offset+3]!;
        assert.ok(a===0||a===255,`${id}/${quality}/${kind}: soft alpha`);
        if(a){count++;assert.ok(x>0&&y>0&&x<pixels.width-1&&y<pixels.height-1,`${id}/${quality}/${kind}: clipped`);const L=luminance(pixels.data[offset]!,pixels.data[offset+1]!,pixels.data[offset+2]!);if(backgrounds.every(bg=>(Math.max(L,bg)+0.05)/(Math.min(L,bg)+0.05)>=3))readableEdge++;}
      }
      assert.ok(count>=45,`${id}/${quality}/${kind}: too sparse`);
      assert.ok(readableEdge>=4,`${id}/${quality}/${kind}: requires four material pixels at 3:1 on report/test ground`);
      const png=await sharp(Buffer.from(pixels.data),{raw:{width:pixels.width,height:pixels.height,channels:4}}).png().toBuffer();
      pngs.push(png);
      const file=`${id}-${quality}${kind==='world'?'-world':''}.png`;
      await writeFile(path.join(out,file),png);
      variants.push({id,quality,kind,width:pixels.width,height:pixels.height,file});
    }
    const hash=Buffer.from(icon.data).toString('hex');assert.ok(!hashes.has(hash),`${id}: qualities duplicate`);hashes.add(hash);
    await writeFile(path.join(out,`${id}-${quality}.svg`),contaminantIconSvg(id,quality));
    const x=column*300,y=row*178+38;
    qualitySheet.push({input:await sharp(pngs[0]).resize(96,96,{kernel:'nearest'}).toBuffer(),left:x+8,top:y+10});
    qualitySheet.push({input:await sharp(pngs[1]).resize(128,128,{kernel:'nearest'}).toBuffer(),left:x+112,top:y+4});
    qualitySheet.push({input:pngs[0],left:x+252,top:y+24},{input:pngs[1],left:x+248,top:y+64});
    qualitySheet.push({input:Buffer.from(`<svg width="300" height="28"><text x="8" y="19" font-family="sans-serif" font-size="12" fill="#aab4a5">${id} / ${quality}</text></svg>`),left:x,top:y+136});
    nativeSheet.push({input:pngs[0],left:column*100+6,top:row*45+24},{input:pngs[1],left:column*100+46,top:row*45+20});
  }
}
qualitySheet.push({input:Buffer.from('<svg width="1200" height="35"><text x="10" y="23" font-family="sans-serif" font-size="14" fill="#aab4a5">ICON 24px / WORLD 32px — 4x geometry review + native-size samples. Quality changes structure; not item family.</text></svg>'),left:0,top:0});
await sharp({create:{width:1200,height:1462,channels:4,background:'#151a17'}}).composite(qualitySheet).png().toFile(path.join(out,'iteration-20-quality-sheet.png'));
await sharp({create:{width:400,height:388,channels:4,background:'#151a17'}}).composite(nativeSheet).png().toFile(path.join(out,'iteration-20-native-sheet.png'));
await writeFile(path.join(out,'iteration-20-manifest.json'),JSON.stringify({source:'src/art/contaminant-icons.ts',authorship:'native geometric pixel rasterization at both resolutions',qualityOrder:CONTAMINANT_ART_QUALITIES,variants},null,2)+'\n');
console.log(`Exported ${variants.length} sample PNGs, 32 SVGs, 4x/native review sheets. All variants: binary alpha, transparent margin, distinct quality pixels.`);
