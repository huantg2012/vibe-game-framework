/** Static falsification check over unchanged, already rendered Rift floor evidence.
 * It intentionally does NOT claim to reproduce the later mask/ADD-light compositing.
 * Run: node --import tsx tools/inventory/check-catalog-context.ts
 */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { catalogWorldPixels, CATALOG_ART_ITEM_IDS, CATALOG_ART_APPEARANCE_IDS, type CatalogIconRef, type CatalogPixels } from '../../src/art/contaminant-catalog-icons';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const out=path.join(root,'public/assets/items/contaminant-catalog/context');
await mkdir(out,{recursive:true});
const contexts=[
 {id:'ridge-soil-current',file:'docs/qa/artifacts/iteration-28/browser/natural-current/02-first-shell.png',center:[724,563],screenPerWorld:2.25,seed:1799945020},
 ...['ivory-basin','crystal-fibre','ash-strata','carmine-lacquer','cobalt-gold'].map(id=>({id,file:`docs/qa/artifacts/iteration-26/play/final/restart-${id}.png`,center:[1021,533],screenPerWorld:1300/960*1.5,seed:id==='ivory-basin'?0:id==='crystal-fibre'?175150:70421})),
];
const entries=[...CATALOG_ART_ITEM_IDS.map(id=>({id,ref:{kind:'item',definitionId:id} as CatalogIconRef})),...CATALOG_ART_APPEARANCE_IDS.map(id=>({id:`shell-${id}`,ref:{kind:'shell',appearanceId:id} as CatalogIconRef}))];
const lum=(rgb:readonly number[])=>rgb.reduce((n,v,i)=>{const c=v/255;return n+(c<=.04045?c/12.92:((c+.055)/1.055)**2.4)*[.2126,.7152,.0722][i]!;},0);
const contrast=(a:readonly number[],b:readonly number[])=>{const aa=lum(a),bb=lum(b);return (Math.max(aa,bb)+.05)/(Math.min(aa,bb)+.05);};
type Point={x:number;y:number;ratio:number;rgb:number[];background:number[]};
type Edge={normal:string;points:Point[];minimum:number};
function mainComponent(p:CatalogPixels):Set<number>{
 const visited=new Set<number>();let largest:number[]=[];
 for(let i=0;i<p.width*p.height;i++)if(p.data[i*4+3]&&!visited.has(i)){
  const q=[i];visited.add(i);
  for(let j=0;j<q.length;j++){const k=q[j]!,x=k%p.width,y=Math.floor(k/p.width);for(const [xx,yy] of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]])if(xx!>=0&&yy!>=0&&xx!<p.width&&yy!<p.height){const n=yy!*p.width+xx!;if(p.data[n*4+3]&&!visited.has(n)){visited.add(n);q.push(n);}}}
  if(q.length>largest.length)largest=q;
 }
 return new Set(largest);
}
function scan(p:CatalogPixels,bg:Uint8Array):{horizontal:Edge|null;vertical:Edge|null;separationDegrees:number}{
 const main=mainComponent(p),candidates:{horizontal:Edge[];vertical:Edge[]}={horizontal:[],vertical:[]};
 for(const [normal,axis] of [['up','horizontal'],['down','horizontal'],['left','vertical'],['right','vertical']] as const){
  const line:(Point|null)[]=[];
  for(let i=0;i<32;i++){
   let found:Point|null=null;
   for(let j=0;j<32;j++){
    const rev=normal==='down'||normal==='right',v=rev?31-j:j,x=axis==='horizontal'?i:v,y=axis==='horizontal'?v:i;
    if(!main.has(y*32+x))continue;
    const nx=x+(normal==='left'?-1:normal==='right'?1:0),ny=y+(normal==='up'?-1:normal==='down'?1:0);
    // Exterior ground directly outside this silhouette edge, not the hole or item underneath.
    const bi=((ny+9)*50+nx+9)*4,pi=(y*32+x)*4;
    const rgb=[p.data[pi]!,p.data[pi+1]!,p.data[pi+2]!],background=[bg[bi]!,bg[bi+1]!,bg[bi+2]!];
    found={x,y,ratio:contrast(rgb,background),rgb,background};break;
   }line.push(found);
  }
  for(let i=0;i<=29;i++){
   const points=line.slice(i,i+3);if(points.some(p=>!p))continue;
   const run=points as Point[];
   if(run.slice(1).some((p,j)=>Math.max(Math.abs(p.x-run[j]!.x),Math.abs(p.y-run[j]!.y))!==1))continue;
   const minimum=Math.min(...run.map(p=>p.ratio));
   candidates[axis].push({normal,points:run,minimum});
  }
 }
 let best:{horizontal:Edge|null;vertical:Edge|null;separationDegrees:number}={horizontal:null,vertical:null,separationDegrees:0};let score=-Infinity;
 for(const h of candidates.horizontal)for(const v of candidates.vertical){
  if(h.points.some(a=>v.points.some(b=>a.x===b.x&&a.y===b.y)))continue;
  const hx=h.points[2]!.x-h.points[0]!.x,hy=h.points[2]!.y-h.points[0]!.y,vx=v.points[2]!.x-v.points[0]!.x,vy=v.points[2]!.y-v.points[0]!.y;
  const degrees=Math.acos(Math.min(1,Math.abs(hx*vx+hy*vy)/(Math.hypot(hx,hy)*Math.hypot(vx,vy))))*180/Math.PI;
  if(degrees<45-1e-8)continue;
  const minimum=Math.min(h.minimum,v.minimum);
  if(minimum>score){score=minimum;best={horizontal:h,vertical:v,separationDegrees:degrees};}
 }
 return best;
}
const result:unknown[]=[];const summaries:unknown[]=[];
for(const context of contexts){
 const file=path.join(root,context.file),source=await readFile(file),raw=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const bg=new Uint8Array(50*50*4);
 for(let y=0;y<50;y++)for(let x=0;x<50;x++){
  const sx=Math.floor(context.center[0]!+(x-24.5)*context.screenPerWorld),sy=Math.floor(context.center[1]!+(y-24.5)*context.screenPerWorld);
  assert.ok(sx>=0&&sy>=0&&sx<raw.info.width&&sy<raw.info.height);
  const i=(sy*raw.info.width+sx)*4;bg.set(raw.data.subarray(i,i+4),(y*50+x)*4);
 }
 const layers:sharp.OverlayOptions[]=[];let passed=0;const failures:string[]=[];
 for(const [i,entry] of entries.entries()){
  const p=catalogWorldPixels(entry.ref);assert.equal(p.width,32);assert.equal(p.height,32);
  const edges=scan(p,bg),pass=(edges.horizontal?.minimum??0)>=2&&(edges.vertical?.minimum??0)>=2;
  if(pass)passed++;else failures.push(entry.id);
  result.push({context:context.id,id:entry.id,pass,threshold:2,edges});
  const composed=Buffer.from(bg);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const s=(y*32+x)*4;if(p.data[s+3])for(let c=0;c<4;c++)composed[((y+9)*50+x+9)*4+c]=p.data[s+c]!;}
  const rawInput={raw:{width:50,height:50,channels:4 as const}},native=await sharp(composed,rawInput).png().toBuffer();
  const left=i%7*180,top=48+Math.floor(i/7)*130;
  layers.push({input:native,left:left+4,top:top+28},{input:await sharp(native).resize(100,100,{kernel:'nearest'}).toBuffer(),left:left+66,top:top+3});
  const label=Buffer.from(`<svg width="178" height="22"><text x="3" y="11" font-family="monospace" font-size="8" fill="${pass?'#cad0c2':'#ffb28e'}">${entry.id}</text><text x="3" y="21" font-family="monospace" font-size="8" fill="#cad0c2">H ${(edges.horizontal?.minimum??0).toFixed(2)} V ${(edges.vertical?.minimum??0).toFixed(2)}</text></svg>`);
  layers.push({input:label,left,top:top+103});
 }
 layers.push({input:Buffer.from(`<svg width="1260" height="42"><text x="8" y="16" font-family="monospace" font-size="13" fill="#cad0c2">${context.id}: STATIC COMPOSITE / source RGB over captured lit floor / NO mask or ADD-light replay</text><text x="8" y="34" font-family="monospace" font-size="11" fill="#cad0c2">native32 + 2x; fixed floor sample; ${passed}/56 two-axis edge diagnostics at 2:1. Not a gameplay screenshot.</text></svg>`),left:0,top:0});
 await sharp({create:{width:1260,height:1090,channels:4,background:'#141a19'}}).composite(layers).png().toFile(path.join(out,`${context.id}.png`));
 summaries.push({...context,sourceSha256:createHash('sha256').update(source).digest('hex'),passed,total:entries.length,failures});
}
// Optional paired production-render evidence: same paused scene, DOM hidden in both,
// only the ground Graphics hidden for the background. Never modifies the PNGs.
const captureDir=path.join(out,'browser/drop-current-final');
let renderedEvidence:unknown={status:'NOT-CAPTURED'};
try {
 const meta=JSON.parse(await readFile(path.join(captureDir,'drop-measurement.json'),'utf8'));
 const frontName='08-paused-world-only-diagnostic.png',backName='09-paused-background-only-diagnostic.png';
 const frontBytes=await readFile(path.join(captureDir,frontName)),backBytes=await readFile(path.join(captureDir,backName));
 const front=await sharp(frontBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),back=await sharp(backBytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(front.info.width,back.info.width);assert.equal(front.info.height,back.info.height);
 const placement=meta.ground[0],appearanceId=meta.nearby[0].catalog.appearanceId;
 const source=catalogWorldPixels({kind:'shell',appearanceId});
 const captureEvidence=JSON.parse(await readFile(path.join(captureDir,'evidence.json'),'utf8'));
 const currentPixelsSha256=createHash('sha256').update(Buffer.from(source.data)).digest('hex');
 assert.equal(captureEvidence.browserSource.rgbaSha256,currentPixelsSha256,'Rendered capture uses stale world pixels');
 assert.equal(captureEvidence.browserLocalPixelsMatch,true);
 assert.equal(captureEvidence.loadedAfterWorldFacesMtime,true);
 const actual={...source,data:new Uint8ClampedArray(source.data)},background=new Uint8Array(50*50*4);
 const sample=(buffer:Buffer,x:number,y:number)=>{const sx=Math.floor(placement.screen.x+(x-24.5)*meta.worldPixelScale),sy=Math.floor(placement.screen.y+(y-24.5)*meta.worldPixelScale);const n=(sy*front.info.width+sx)*4;return buffer.subarray(n,n+4);};
 for(let y=0;y<50;y++)for(let x=0;x<50;x++)background.set(sample(back.data,x,y),(y*50+x)*4);
 for(let y=0;y<32;y++)for(let x=0;x<32;x++){const n=(y*32+x)*4;if(source.data[n+3]){const rgb=sample(front.data,x+9,y+9);actual.data[n]=rgb[0]!;actual.data[n+1]=rgb[1]!;actual.data[n+2]=rgb[2]!;}}
 const edges=scan(actual,background),pass=(edges.horizontal?.minimum??0)>=2&&(edges.vertical?.minimum??0)>=2;
 let changed=0;const box={minX:Infinity,minY:Infinity,maxX:0,maxY:0};
 for(let y=0;y<front.info.height;y++)for(let x=0;x<front.info.width;x++){const n=(y*front.info.width+x)*4;if(front.data[n]!==back.data[n]||front.data[n+1]!==back.data[n+1]||front.data[n+2]!==back.data[n+2]){changed++;box.minX=Math.min(box.minX,x);box.minY=Math.min(box.minY,y);box.maxX=Math.max(box.maxX,x);box.maxY=Math.max(box.maxY,y);}}
 const {commandBuffer:_commands,...placementSummary}=placement;
 renderedEvidence={captureEvidenceFile:'browser/drop-current-final/evidence.json',currentPixelsSha256,status:'ONE-ISOLATED-PREPARED-STATE-PRODUCTION-RENDER',appearanceId,pass,threshold:2,edges,placement:placementSummary,changedScreenPixels:changed,changedBounds:box,foreground:frontName,background:backName,hashes:{foreground:createHash('sha256').update(frontBytes).digest('hex'),background:createHash('sha256').update(backBytes).digest('hex')},limits:'Prepared saved fixture, not natural acquisition. Production field-loot renderer, actual lamp/mask. Paused diagnostic pair removes DOM in both and only the ground graphics in background; not player-facing frames. Only this appearance/position/visibility. Page-source synchronization recorded separately by capture agent.'};
} catch(error) { if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error; }
const catalogSourceHashes=JSON.parse(await readFile(path.join(root,'public/assets/items/contaminant-catalog/catalog-manifest.json'),'utf8')).sourceHashes;
const report={catalogSourceHashes,renderedEvidence,status:'STATIC-DIAGNOSTIC / NOT-RENDERED-ITEM-ACCEPTANCE',method:'Native32 source pixels, full alpha, over unchanged sampled screen RGB from actual lit floor. Largest 4-connected component exterior: two disjoint 8-connected 3-pixel edge segments, one from a horizontal scan and one from a vertical scan, with tangent separation at least45degrees; every local source-to-adjacent-ground WCAG luminance ratio >=2. No palette/background tuning, no glow, no remnant contribution. Sampling locations fixed before checking objects.',limits:'Light and darkness layers were already applied to the captured ground but have NOT been replayed over inserted objects. Engine ADD lights and darkness above depth16 can change both RGB and final contrast. This diagnoses background collisions; it cannot certify final engine pixels, visibility at these image positions, motion reading, or all terrain instances. Old I26 frames retain their actual native light but are not I28 gameplay evidence. Screen-per-world factors include camera1.5 and viewport scaling.',summaries,results:result};
await writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,summaries},null,2));

// Opt-in gate preserves full evidence even when one or more diagnostic cases fail.
if(process.argv.includes('--strict')&&(summaries.some(s=>(s as {passed:number;total:number}).passed<(s as {total:number}).total)||(renderedEvidence as {pass?:boolean}).pass===false))process.exitCode=1;
