/** Render existing actual-geometry receipts; no construction or search occurs. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';

const directory=process.argv[2];
assert(directory,'Usage: check-integration-geometry.mjs EXISTING_RECEIPT_DIRECTORY');
const read=name=>deserialize(gunzipSync(fs.readFileSync(path.join(directory,name))));
const receipt=JSON.parse(fs.readFileSync(path.join(directory,'report.json'),'utf8'));
const {terrain,layout,solidPrimitives,supported}=read('geometry.v8.gz');
const diagnostic=read('geometry-diagnostic.v8.gz');
const {cols,rows}=terrain;
const translation=layout.constructionExtension?.translation??{x:0,y:0};
const sourcePoint=p=>p?{x:p.x-translation.x,y:p.y-translation.y}:null;
const point=cell=>({x:(cell%cols)*8+4,y:Math.floor(cell/cols)*8+4});
const components=diagnostic.deepComponents.map(cells=>{
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const cell of cells){const p=point(cell);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
  return{cells:cells.length,span:Math.max(maxX-minX+8,maxY-minY+8),sourceBounds:{minX:minX-4-translation.x,minY:minY-4-translation.y,maxX:maxX+4-translation.x,maxY:maxY+4-translation.y}};
}).sort((a,b)=>b.span-a.span);
const rgba=Buffer.alloc(cols*rows*4);
for(let cell=0;cell<cols*rows;cell++){
  const color=!terrain.matter[cell]?[12,20,26]:!supported[cell]?[79,82,83]:diagnostic.deepBody[cell]?[154,73,105]:diagnostic.wide[cell]?[69,144,132]:[160,166,153];
  color.forEach((v,i)=>rgba[cell*4+i]=v);rgba[cell*4+3]=255;
}
const base=await sharp(rgba,{raw:{width:cols,height:rows,channels:4}}).resize(terrain.width,terrain.height,{kernel:'nearest'}).png().toBuffer();
const escape=value=>String(value).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const text=(x,y,label,color='#ffffff')=>`<text x="${x}" y="${y}" fill="${color}" font-size="22" font-family="sans-serif" stroke="#10161b" stroke-width="4" paint-order="stroke">${escape(label)}</text>`;
const metric=receipt.gates.geometry.metrics;
let overlay='';
for(let x=translation.x;x<terrain.width;x+=160)overlay+=`<path d="M${x},0V${terrain.height}" stroke="#ffffff" opacity=".13"/>${text(x+3,28,x-translation.x)}`;
for(let y=translation.y;y<terrain.height;y+=160)overlay+=`<path d="M0,${y}H${terrain.width}" stroke="#ffffff" opacity=".13"/>${text(3,y+24,y-translation.y)}`;
overlay+=`<path fill="#d9ac65" d="${solidPrimitives.map(({points:p})=>`M${p[0]},${p[1]}L${p[2]},${p[3]}L${p[4]},${p[5]}z`).join('')}"/>`;
for(const s of metric.effectiveStructures){const x=(s.bounds.minX+s.bounds.maxX)/2,y=(s.bounds.minY+s.bounds.maxY)/2;overlay+=text(x,y,s.id,s.kind==='hole'?'#7fe8ff':'#fff0c5');}
const marks=[['G1',metric.worstEmptyPoint],['deep',metric.worstDeepPoint],['G2',point(receipt.gates.visibility.metrics.coverage.worstCell)]];
for(const [label,p]of marks)overlay+=`<circle cx="${p.x}" cy="${p.y}" r="10" fill="#ff544b"/>${text(p.x+16,p.y-14,label)}`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${terrain.width}" height="${terrain.height}">${overlay}</svg>`;
const annotated=await sharp(base).composite([{input:Buffer.from(svg)}]).png().toBuffer();
await sharp(annotated).resize({width:1344}).png().toFile(path.join(directory,'domain-diagnostic.png'));
const summary={worldId:receipt.reference.worldId,translation,metrics:{holes:metric.holes,solids:metric.solids,walkAreaPx2:metric.walkAreaPx2,targetWalkAreaPx2:metric.targetWalkAreaPx2,maxEmptyUpperPx:metric.maxEmptyUpperPx,maxDeepSpanPx:metric.maxDeepSpanPx,wideRatio:metric.wideRatio,largestWideRatio:metric.largestWideRatio},worstSource:{empty:sourcePoint(metric.worstEmptyPoint),deep:sourcePoint(metric.worstDeepPoint),cover:sourcePoint(point(receipt.gates.visibility.metrics.coverage.worstCell))},deepComponents:components.filter(c=>c.span>256),geometryReasons:receipt.gates.geometry.reasons,visibilityReasons:receipt.gates.visibility.reasons,cover:receipt.gates.visibility.metrics.coverage.maxRoutePx,boundary:receipt.boundary};
fs.writeFileSync(path.join(directory,'domain-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
