/** Read-only structural drawing of the saved rejected c27 descendant.
 * No production imports, geometry compilation, sampling, admission or route search.
 * Diagnostic colors and symbols are not proposed game art/UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import sharp from 'sharp';

const source='docs/qa/artifacts/native-spatial-2026-10-14/complete-candidate-c27-capture-round2';
const output=process.argv[2]??'docs/qa/artifacts/native-spatial-2026-10-14/c27-spatial-art';
assert(!fs.existsSync(output),'Use a new evidence directory');
const inputs=['rejected-runtime.v8.gz','report.json'];
const hash=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const hashes=()=>Object.fromEntries(inputs.map(file=>[file,hash(path.join(source,file))]));
const before=hashes(),capture=JSON.parse(fs.readFileSync(`${source}/report.json`,'utf8'));
assert.equal(capture.actualGeometryHash,'9faebdbd40a92649');
assert.equal(capture.sourcesStable,true);
const saved=deserialize(gunzipSync(fs.readFileSync(`${source}/rejected-runtime.v8.gz`)));
const geometry=saved.candidate.geometry,terrain=geometry.terrain,layout=saved.deployed.layout;
const width=terrain.width,height=terrain.height,cellSize=8;
assert.equal(terrain.matter.length,terrain.cols*terrain.rows);
assert.equal(width,terrain.cols*cellSize);assert.equal(height,terrain.rows*cellSize);
assert.equal(saved.routes.accepted,false);
const structures=saved.candidate.groups.structures;
const route=saved.routes.metrics.routes.find(r=>r.id==='node:r100-contaminant-deep-1');
assert(route);assert.equal(route.transverse.maxNarrowOrUncertainRunPx,328);
const colors={void:'#070b0e',floor:'#83918d',solid:'#cc9f61',text:'#e7ece7',outward:'#ffd979',homeward:'#76dded',narrow:'#ff756e'};
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const svg=(w,h,content,view=`0 0 ${w} ${h}`)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${view}">${content}</svg>`);
const text=(x,y,value,size=23,color=colors.text)=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="sans-serif" stroke="#070b0e" stroke-width="4" paint-order="stroke">${esc(value)}</text>`;
const line=(a,b,color=colors.text,stroke=3,extra='')=>`<path d="M${a.x},${a.y}L${b.x},${b.y}" fill="none" stroke="${color}" stroke-width="${stroke}" ${extra}/>`;
const polyline=(points,color,extra='')=>`<polyline points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" ${extra}/>`;
let land='';
// Row runs preserve the exact saved 8px terrain/VOID boundary, including coast and H.
for(let y=0;y<terrain.rows;y++)for(let x=0;x<terrain.cols;){
 if(!terrain.matter[y*terrain.cols+x]){x++;continue;}
 const start=x;while(x<terrain.cols&&terrain.matter[y*terrain.cols+x])x++;
 land+=`M${start*8},${y*8}h${(x-start)*8}v8h-${(x-start)*8}z`;
}
const solids=geometry.solidPrimitives.map(p=>`M${p.points[0]},${p.points[1]}L${p.points[2]},${p.points[3]}L${p.points[4]},${p.points[5]}z`).join('');
const base=`<rect width="${width}" height="${height}" fill="${colors.void}"/><path d="${land}" fill="${colors.floor}" shape-rendering="crispEdges"/><path d="${solids}" fill="${colors.solid}" shape-rendering="crispEdges"/>`;
const spawn=layout.spawnPoint,exit=layout.extractionPoint.position;
const nodes=[...layout.kindlingNodes.map(n=>({...n,type:'K'})),...layout.contaminantNodes.map(n=>({...n,type:'C'}))];
const symbols=(labels=true)=>{
 let result=`<circle cx="${spawn.x}" cy="${spawn.y}" r="13" fill="#070b0e" stroke="white" stroke-width="4"/>`;
 result+=`<path d="M${exit.x},${exit.y-16}l14,16l-14,16l-14,-16z" fill="#070b0e" stroke="#ffd979" stroke-width="4"/>`;
 if(labels)result+=text(spawn.x+23,spawn.y-12,'SPAWN')+text(exit.x-19,exit.y+46,'EXIT');
 for(const n of nodes){
  const {x,y}=n.position,fill=n.tier==='deep'?'#e6a5df':n.tier==='contested'?'#dcc7ae':'#e5eae4';
  result+=n.type==='K'?`<rect x="${x-6}" y="${y-6}" width="12" height="12" fill="${fill}" stroke="#070b0e" stroke-width="2"/>`:`<circle cx="${x}" cy="${y}" r="7" fill="${fill}" stroke="#070b0e" stroke-width="2"/>`;
  if(labels)result+=text(x+11,y-9,`${n.type} ${n.tier}`,17);
 }
 return result;
};
const offsets=[0];for(let i=1;i<route.smoothedPoints.length;i++)offsets.push(offsets[i-1]+Math.hypot(route.smoothedPoints[i].x-route.smoothedPoints[i-1].x,route.smoothedPoints[i].y-route.smoothedPoints[i-1].y));
function pointAt(d){d=Math.max(0,Math.min(offsets.at(-1),d));let i=1;while(i<offsets.length&&offsets[i]<d)i++;if(i===offsets.length)return route.smoothedPoints.at(-1);const a=route.smoothedPoints[i-1],b=route.smoothedPoints[i],t=(d-offsets[i-1])/(offsets[i]-offsets[i-1]);return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
const seat={x:(route.target%terrain.cols+.5)*8,y:(Math.floor(route.target/terrain.cols)+.5)*8};
const seatIndex=route.smoothedPoints.findIndex(p=>p.x===seat.x&&p.y===seat.y);assert(seatIndex>0);
const outward=route.smoothedPoints.slice(0,seatIndex+1),homeward=route.smoothedPoints.slice(seatIndex);
const routeDrawing=polyline(outward,colors.outward)+polyline(homeward,colors.homeward,'stroke-dasharray="12 7"');
const sections=route.transverse.sections.filter(s=>s.sides&&s.widthLowerPx<=42).map(s=>{
 const p=pointAt(s.at),a=pointAt(s.at-32),b=pointAt(s.at+32),length=Math.hypot(b.x-a.x,b.y-a.y),nx=-(b.y-a.y)/length,ny=(b.x-a.x)/length;
 return{...s,point:p,from:{x:p.x-nx*s.sides[0],y:p.y-ny*s.sides[0]},to:{x:p.x+nx*s.sides[1],y:p.y+ny*s.sides[1]}};
});
assert(sections.length===8);
let narrowDrawing=sections.map(s=>line(s.from,s.to,colors.narrow,2)).join('');
for(const at of [272,616]){const s=sections.find(s=>s.at===at);narrowDrawing+=text(s.point.x+35,s.point.y-8,`${s.widthLowerPx.toFixed(1)} px`,21,colors.narrow);}
const seatDrawing=`<rect x="${seat.x-10}" y="${seat.y-10}" width="20" height="20" fill="none" stroke="white" stroke-width="2"/>`+text(seat.x+26,seat.y+7,'20px body',17);
const local={x:1320,y:780,width:520,height:710};
const cropRect=`<rect x="${local.x}" y="${local.y}" width="${local.width}" height="${local.height}" fill="none" stroke="white" stroke-width="2" stroke-dasharray="12 10"/>`;
fs.mkdirSync(output,{recursive:true});
async function savePng(file,buffer){await sharp(buffer).png().toFile(path.join(output,file));}
await savePng('c27-structure.png',svg(width,height,base+symbols()));
await savePng('c27-deep-resource-route.png',svg(width,height,base+routeDrawing+narrowDrawing+symbols()+seatDrawing+cropRect));
await savePng('c27-deep-resource-local.png',svg(local.width*2,local.height*2,base+routeDrawing+narrowDrawing+symbols()+seatDrawing,`${local.x} ${local.y} ${local.width} ${local.height}`));
const structureLabels=structures.map((s,index)=>{const b=s.bounds;return text((b.minX+b.maxX)/2-13,(b.minY+b.maxY)/2+7,s.kind==='hole'?`H${structures.slice(0,index+1).filter(t=>t.kind==='hole').length}`:`S${structures.slice(0,index+1).filter(t=>t.kind==='solid').length}`,20,s.kind==='hole'?'#bbc8ca':'#1a2428');}).join('');
const title=text(36,43,'c27 / 9faebdbd40a92649 / gel-rafts / medium / seed 20261012',26)+text(36,78,'SAVED REJECTED CANDIDATE — structural diagnostic; no fog, light, material or gameplay camera',20);
const footer=text(36,height+144,'Dark = actual VOID (H / exterior); gray = ground; ochre = actual S triangles. H=11, S=5.',22)+text(36,height+178,'White circle = spawn; gold diamond = exit; K = kindling; C = contaminant. Numbers label structural identity only.',20)+text(36,height+214,'World coordinates preserved; uniform 2/3 display scale. Geometry, resource seats and routes were not regenerated.',20);
await savePng('c27-overview.png',svg(width*2/3,(height+250)*2/3,`<rect width="${width}" height="${height+250}" fill="#070b0e"/>${title}<g transform="translate(0,100)">${base}${structureLabels}${symbols()}</g>${footer}`,`0 0 ${width} ${height+250}`));
const routeTitle=text(36,43,'c27 / deep contaminant complete route / original rejected G4',26)+text(36,78,'Gold: spawn to chosen seat. Cyan dashes: seat to exit. Red: saved cross sections <=42px.',22);
const routeFooter=text(36,height+144,`Length ${route.lengthPx.toFixed(1)}px; narrow ${(100*route.transverse.narrowRatio).toFixed(2)}%; longest narrow / uncertain run 328px.`,22)+text(36,height+178,'Route choice is one official shortest-route family. It does not prove all player alternatives are narrow.',20)+text(36,height+214,'Diagnostic symbols are not game assets. Final material identity and normal-view experience remain unreviewed.',20);
await savePng('c27-route-overview.png',svg(width*2/3,(height+250)*2/3,`<rect width="${width}" height="${height+250}" fill="#070b0e"/>${routeTitle}<g transform="translate(0,100)">${base}${routeDrawing}${narrowDrawing}${symbols()}${seatDrawing}${cropRect}</g>${routeFooter}`,`0 0 ${width} ${height+250}`));
assert.deepEqual(hashes(),before,'Saved evidence changed while rendering');
const manifest={featureId:'COH-F011',relatedFeatures:['COH-F012','COH-F013'],geometryHash:capture.actualGeometryHash,world:saved.recipe.profile.id,grade:saved.recipe.package.grade,seed:saved.recipe.requestedSeed,source,sourceHashes:before,sourcesStable:true,admittedMap:false,dimensions:{width,height,cellSize},solidTriangleCount:geometry.solidPrimitives.length,counts:{holes:structures.filter(s=>s.kind==='hole').length,solids:structures.filter(s=>s.kind==='solid').length},structures:structures.map(({id,kind,bounds,areaLowerPx2,areaUpperPx2})=>({id,kind,bounds,areaLowerPx2,areaUpperPx2})),spawn,exit,nodes,route:{id:route.id,lengthPx:route.lengthPx,seat,smoothedPoints:route.smoothedPoints,events:route.events,narrowRatio:route.transverse.narrowRatio,maxNarrowOrUncertainRunPx:route.transverse.maxNarrowOrUncertainRunPx,sectionsUnder42Px:sections},localView:local,operations:{deserializeSavedSnapshot:true,productionImports:0,generatorCalls:0,geometryRebuilds:0,routeSearches:0,gateEvaluations:0},limits:['Plain diagnostic palette, not game graphics or lighting.','VOID is saved 8px terrain mask; S is saved actual projected solid triangles.','Only saved route/cross-section values are illustrated; interpolation locates those saved measurements without querying geometry.','Original G4 result is preserved; later short-route proportion calibration is not applied here.','No material, player visibility, dynamic stealth, sound, normal camera or user acceptance conclusion.'],files:['c27-structure.png','c27-overview.png','c27-deep-resource-route.png','c27-route-overview.png','c27-deep-resource-local.png']};
fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({output,geometryHash:manifest.geometryHash,files:manifest.files,operations:manifest.operations},null,2));
