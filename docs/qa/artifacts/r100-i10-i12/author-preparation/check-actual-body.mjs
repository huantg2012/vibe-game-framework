/** Actual author admission, deliberately separate from isolated XY checks and
 * from the later frozen production/play/normal-view qualification. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';

const area='docs/qa/artifacts/r100-i10-i12';
function parseArguments(args){
 const batches=args.filter(a=>a.startsWith('--batch='));assert.equal(batches.length,1,'exactly one explicit batch required');
 const batch=batches[0].slice(8);assert(['b11','b12','b13','b14'].includes(batch),'explicit owned batch required');
 const requested=args.filter(a=>a.startsWith('--world=')).map(a=>a.slice(8));assert.equal(new Set(requested).size,requested.length,'duplicate world request');
 const outputs=args.filter(a=>!a.startsWith('--'));assert(outputs.length<=1,'at most one output directory');
 const drafts=args.filter(a=>a.startsWith('--author-draft='));assert(drafts.length<=1,'at most one explicit author draft');
 return{batch,requested,out:path.resolve(outputs[0]??`${area}/${batch}-author-preflight/body12`),authorDraft:drafts.length?drafts[0].slice(15):`${area}/${batch}-isolated-author/native-draft.csv`};
}
function requireMatchingRows(formal,draft,id){
 const line=text=>text.split('\n').find(line=>line.startsWith(id+',')),a=line(formal),b=line(draft);
 assert(a&&b,`${id}: both formal and draft rows must exist`);assert.equal(a,b,'formal row must exactly match the current isolated author row');
}
function requireEndpointsInBounds(start,end,box){
 if(box)for(const p of[start,end])assert(p.x>=box[0]&&p.y>=box[1]&&p.x<=box[2]&&p.y<=box[3],'both actual route endpoints must remain inside original bounds');
}
if(process.argv.includes('--self-check')){
 const negative=[];const rejects=(name,fn)=>{assert.throws(fn,assert.AssertionError);negative.push(name);};
 assert.equal(parseArguments(['--batch=b11']).out,path.resolve(area+'/b11-author-preflight/body12'));
 assert.equal(parseArguments(['--world=crushed-seam','--batch=b11']).out,path.resolve(area+'/b11-author-preflight/body12'));
 assert.equal(parseArguments(['sample-output','--batch=b11']).out,path.resolve('sample-output'));
 requireMatchingRows('id,value\nw,ok\n','id,value\nw,ok\n','w');requireEndpointsInBounds({x:0,y:0},{x:10,y:10},[0,0,10,10]);
 rejects('duplicate batch',()=>parseArguments(['--batch=b11','--batch=b12']));
 rejects('both CSV rows absent',()=>requireMatchingRows('id,value\n','id,value\n','w'));
 rejects('one CSV row absent',()=>requireMatchingRows('w,ok\n','id,value\n','w'));
 rejects('CSV row differs',()=>requireMatchingRows('w,ok\n','w,changed\n','w'));
 rejects('bounded start outside',()=>requireEndpointsInBounds({x:-1,y:0},{x:2,y:2},[0,0,10,10]));
 rejects('bounded end outside',()=>requireEndpointsInBounds({x:2,y:2},{x:11,y:2},[0,0,10,10]));
 rejects('same start/end outside',()=>requireEndpointsInBounds({x:-1,y:0},{x:-1,y:0},[0,0,10,10]));
 console.log(JSON.stringify({status:'PASS-QA-helper-contract',positive:5,negative,scope:'Exercises actual CLI/row/bounds helpers only. No catalog generation, map, browser or game evidence.'},null,2));process.exit(0);
}
const root=process.cwd(),{batch,requested,out,authorDraft}=parseArguments(process.argv.slice(2));
const intentPath=`${area}/${batch}-isolated-author/intent.json`,intentBytes=fs.readFileSync(intentPath),intents=JSON.parse(intentBytes);
const expectedWorlds=Object.keys(intents);assert.equal(expectedWorlds.length,4);
const contractPath=`${area}/${batch}-author-preflight/actual-contract.json`,contractBytes=fs.existsSync(contractPath)?fs.readFileSync(contractPath):null;
const additions=contractBytes?JSON.parse(contractBytes):null;if(additions){assert.equal(additions.schemaVersion,1);assert.equal(additions.batch,batch);for(const[id,extra]of Object.entries(additions.worlds)){assert(expectedWorlds.includes(id),'unknown supplemental world');assert(Array.isArray(extra.contacts));for(const pair of extra.contacts)assert(pair.length===2&&pair.every(Number.isInteger),'contact pairs require two ids');intents[id].relations.contacts=[...(intents[id].relations.contacts??[]),...extra.contacts];intents[id].materialRelationshipReview=extra;}}
assert(requested.every(id=>expectedWorlds.includes(id)),'unknown requested world');
const catalogPath='src/generated/r100-native-worlds.ts',nativePath='data/rift-native-worlds.csv';
const catalogBytes=fs.readFileSync(catalogPath),nativeBytes=fs.readFileSync(nativePath);
const catalog=JSON.parse(catalogBytes.toString().split('export const R100_NATIVE_WORLDS: readonly R100NativeWorldEntry[] = ')[1].replace(/;\s*$/,''));
const rows=expectedWorlds.filter(id=>!requested.length||requested.includes(id)).map(id=>{
 const row=catalog.find(row=>row.id===id);assert(row,`${id} must already belong to the formal author catalog`);return row;
});
const authoredCsv=fs.readFileSync(authorDraft,'utf8');
for(const row of rows){requireMatchingRows(nativeBytes.toString(),authoredCsv,row.id);assert.deepEqual(row.definitions.map(d=>d.grade),['low','medium','severe']);}
assert(!fs.existsSync(out+'/source-snapshot.json')&&!fs.existsSync(out+'/report.json'),'executed artifacts must not be overwritten');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'/catalog-input.ts.txt',catalogBytes);fs.writeFileSync(out+'/native-input.csv',nativeBytes);fs.writeFileSync(out+'/intent-input.json',intentBytes);fs.writeFileSync(out+'/author-draft-input.csv',authoredCsv);if(contractBytes)fs.writeFileSync(out+'/actual-contract-input.json',contractBytes);
const require=createRequire(root+'/package.json'),{buildSync}=require('esbuild'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const bundle=buildSync({metafile:true,stdin:{contents:"export {createMasterWorld} from './r100-master-world';export {NativeBodyCollision} from './native-body-collision';export {buildNativeVolume} from './native-volume-geometry';export {POLLUTION_GRADE_DEFINITIONS} from '../../generated/rift-pollution-grade-data';export {TileType} from '../../types/game-types';",loader:'ts',resolveDir:root+'/src/generation/world-study'},outfile:out+'/executor.mjs',bundle:true,platform:'node',format:'esm',logLevel:'silent',tsconfig:root+'/tsconfig.json'});
const source={scope:'Actual Master author checker inputs; not an immutable production freeze',checker:{path:path.relative(root,new URL(import.meta.url).pathname),sha256:sha(fs.readFileSync(new URL(import.meta.url)))},executorSha256:sha(fs.readFileSync(out+'/executor.mjs')),catalogSha256:sha(catalogBytes),nativeCsvSha256:sha(nativeBytes),intent:{path:intentPath,sha256:sha(intentBytes)},supplementalContract:contractBytes?{path:contractPath,sha256:sha(contractBytes)}:null,inputs:Object.keys(bundle.metafile.inputs).filter(p=>p!=='<stdin>').map(p=>({path:path.relative(root,path.resolve(p)),sha256:sha(fs.readFileSync(path.resolve(p)))}))};
fs.writeFileSync(out+'/source-snapshot.json',JSON.stringify(source,null,2)+'\n');
const sourceSnapshotSha256=sha(fs.readFileSync(out+'/source-snapshot.json'));
const {createMasterWorld,NativeBodyCollision,buildNativeVolume,POLLUTION_GRADE_DEFINITIONS,TileType}=await import(out+'/executor.mjs');
const results=[],seed=20261005;
for(const row of rows)for(const definition of row.definitions){
 const started=performance.now(),evidence={stations:[],spawnRoutes:[],crossings:[],relations:{},fractureEvidence:[]};let stage='Master generation';
 try{
  const world=createMasterWorld(definition,seed,{profile:row.profile,grade:POLLUTION_GRADE_DEFINITIONS.find(g=>g.id===definition.grade)});
  const body=new NativeBodyCollision(world,world.layout.tileMap),cols=128,total=128*96;
  const point=i=>({x:(i%cols)*8+4,y:Math.floor(i/cols)*8+4}),support=new Uint8Array(total);
  for(let i=0;i<total;i++)support[i]=body.supports(point(i),10,10)?1:0;
  const seat=wanted=>{let cell=-1,distance=Infinity;for(let i=0;i<total;i++)if(support[i]){const p=point(i),d=Math.hypot(p.x-wanted.x,p.y-wanted.y);if(d<distance){distance=d;cell=i;}}const result={requested:wanted,actual:point(cell),cell,distance};evidence.stations.push(result);assert(distance<24,`station ${wanted.x},${wanted.y}: nearest ${distance} at ${result.actual.x},${result.actual.y}`);return result;};
  const pathTo=(start,end,box)=>{
   requireEndpointsInBounds(point(start),point(end),box);
   const previous=new Int32Array(total).fill(-1),queue=[start];previous[start]=start;
   for(let at=0;at<queue.length&&previous[end]<0;at++){const cell=queue[at],a=point(cell);for(const[dc,dr]of[[1,0],[-1,0],[0,1],[0,-1]]){
    const c=cell%cols+dc,r=Math.floor(cell/cols)+dr,q=r*cols+c,b=point(q);
    if(c<0||r<0||c>=128||r>=96||previous[q]>=0||!support[q]||box&&(b.x<box[0]||b.y<box[1]||b.x>box[2]||b.y>box[3]))continue;
    if(body.displacementFraction(a,10,10,dc*8,dr*8)<1||body.displacementFraction(b,10,10,-dc*8,-dr*8)<1)continue;
    previous[q]=cell;queue.push(q);
   }}
   assert(previous[end]>=0,'required complete-body route blocked inside its original bounds');const route=[];for(let q=end;;q=previous[q]){route.push(point(q));if(q===start)break;}return route.reverse();
  };
  const intent=intents[row.id];stage='full intent routes and spawn reachability';
  const origin=seat(world.layout.spawnPoint),seen=new Map();
  const plannedSeat=([x,y])=>{const key=x+','+y;let value=seen.get(key);if(!value){value=seat({x,y});seen.set(key,value);evidence.spawnRoutes.push({to:value.actual,route:pathTo(origin.cell,value.cell)});}return value;};
  for(const request of intent.routes){const steps=request.points.map(plannedSeat),entry={name:request.name,bounds:request.bounds,steps,segments:[],bothDirectionsSwept:true,bodySidePx:20};evidence.crossings.push(entry);for(let i=0;i<steps.length-1;i++)entry.segments.push(pathTo(steps[i].cell,steps[i+1].cell,request.bounds));entry.lengthPx=entry.segments.reduce((n,r)=>n+(r.length-1)*8,0);}
  if(intent.relations.routeLengthOrder){const [a,b]=intent.relations.routeLengthOrder,A=evidence.crossings.find(r=>r.name===a),B=evidence.crossings.find(r=>r.name===b);assert.deepEqual(A.steps[0].actual,B.steps[0].actual,'paired routes same start');assert.deepEqual(A.steps.at(-1).actual,B.steps.at(-1).actual,'paired routes same end');assert(A.lengthPx<B.lengthPx,'inside route must be strictly shorter');evidence.relations.routeLengthOrder={short:a,long:b,shortLengthPx:A.lengthPx,longLengthPx:B.lengthPx};}
  stage='declared material-footprint relations';
  const flatMap={...world.layout.tileMap,tiles:Array.from({length:96},()=>Array(128).fill(TileType.FLOOR))};
  // Derived shore faces share the owner's id, but cannot stand in for the
  // authored material body when proving a sheet contact or walkable interior.
  const relationMeshes=world.meshes.map(m=>{if(!m.spec.groundEdgeWidth)return m;const {groundEdgeWidth,...s}=m.spec;return buildNativeVolume(s);});
  const feet=new Map(relationMeshes.map(m=>[m.spec.id,new NativeBodyCollision({definition:{instances:[{id:m.spec.id,role:'solid'}]},meshes:[m]},flatMap)]));
  const meshById=new Map(relationMeshes.map(m=>[m.spec.id,m]));
  evidence.relations.derivedShoreExcludedFromMaterialFootprint=true;
  const overlap=(ia,ib)=>{const a=meshById.get(ia),b=meshById.get(ib);assert(a&&b);let samples=0;for(let y=Math.ceil(Math.max(a.bounds.minY,b.bounds.minY));y<Math.min(a.bounds.maxY,b.bounds.maxY);y+=4)for(let x=Math.ceil(Math.max(a.bounds.minX,b.bounds.minX));x<Math.min(a.bounds.maxX,b.bounds.maxX);x+=4)if(world.matterAt(x,y)&&!feet.get(ia).supports({x,y},.05,.05)&&!feet.get(ib).supports({x,y},.05,.05))samples++;return samples*16;};
  evidence.relations.contacts=[];for(const[a,b]of intent.relations.contacts??[]){const area=overlap(a,b);evidence.relations.contacts.push({a,b,footprintOverlapAreaEstimate:area,samplingStep:4});assert(area>=64,`declared contact ${a}/${b}: ${area}`);}
  const disjoint=intent.relations.disjointSolidObjects??[];evidence.relations.disjoint=[];evidence.relations.disjointMethod='4px projected overlap sampling; zero means no sampled intersection, not an exact mathematical disjointness claim';for(let i=0;i<disjoint.length;i++)for(let j=i+1;j<disjoint.length;j++){const area=overlap(disjoint[i],disjoint[j]);evidence.relations.disjoint.push({a:disjoint[i],b:disjoint[j],footprintOverlapAreaEstimate:area});assert.equal(area,0,'declared separated solids overlap');}
  evidence.relations.walkableSurfaces=[];for(const id of intent.relations.walkableSurfaceObjects??[]){const m=meshById.get(id);assert(m);let at;for(let y=Math.ceil(m.bounds.minY);y<m.bounds.maxY&&!at;y+=8)for(let x=Math.ceil(m.bounds.minX);x<m.bounds.maxX;x+=8)if(world.matterAt(x,y)&&!feet.get(id).supports({x,y},.05,.05)&&body.supports({x,y},10,10)){at={x,y};break;}evidence.relations.walkableSurfaces.push({id,supportedInteriorPoint:at});assert(at,`relief ${id} must have a full-body-supported interior point`);}
  if(intent.relations.barePoint){const[x,y]=intent.relations.barePoint;assert(body.supports({x,y},10,10),'bare point must support full20 body');assert.equal(world.raster.objectId[y*1024+x],0,'bare gap cannot be covered by mesh');evidence.relations.barePoint={x,y,objectId:0,fullBodySidePx:20};}
  stage='actual visible solid cut and fracture areas';
  const areas=new Map(world.meshes.filter(m=>m.spec.blocking).map(m=>[m.spec.id,{id:m.spec.id,cut:0,joint:0}]));
  for(const pixel of world.raster.occupiedPixels){const item=areas.get(world.raster.objectId[pixel]);if(!item||!world.matterAt(pixel%1024,Math.floor(pixel/1024)))continue;if(world.raster.material[pixel]===1)item.cut++;if(world.raster.material[pixel]===3)item.joint++;}
  evidence.fractureEvidence=[...areas.values()];for(const a of evidence.fractureEvidence){assert(a.cut>=16,`object ${a.id} cut area ${a.cut}`);assert(a.joint>=4,`object ${a.id} fracture area ${a.joint}`);}
  stage='diagnostic footprint output';const drawing=[];
  for(const m of world.meshes)for(let i=0;i<m.indices.length;i+=3){const p=[0,1,2].map(c=>{const at=m.indices[i+c]*3;return `${m.positions[at]},${m.positions[at+1]}`;}).join(' ');drawing.push(`<polygon points="${p}" fill="${m.spec.blocking?'#555':'#bbb'}"/>`);}
  for(const poly of definition.erosion)drawing.push(`<polygon points="${poly.map(p=>`${p.x},${p.y}`).join(' ')}" fill="#171717"/>`);
  for(const s of evidence.stations)drawing.push(`<rect x="${s.actual.x-10}" y="${s.actual.y-10}" width="20" height="20" fill="none" stroke="red"/>`);
  for(const c of evidence.crossings)for(const r of c.segments)drawing.push(`<polyline points="${r.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#c33"/>`);
  fs.writeFileSync(out+`/${row.id}-${definition.grade}.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768"><rect width="1024" height="768" fill="#eee"/>${drawing.join('')}</svg>`);
  results.push({id:row.id,grade:definition.grade,status:'PASS',definition,intent,...evidence,triangles:world.meshes.reduce((n,m)=>n+m.triangleCount,0),durationMs:performance.now()-started});
 }catch(e){results.push({id:row.id,grade:definition.grade,status:'FAIL',stage,message:e.message,definition,intent:intents[row.id],...evidence,durationMs:performance.now()-started});}
 fs.writeFileSync(out+'/report.json',JSON.stringify({scope:`Formal ${batch} author catalog; actual Master generation/raster and20px native body with declared intent routes. Not frozen production/play/normal-view admission. Footprint material overlap is not a visual proof of contact.`,seed,sourceSnapshotSha256,results},null,2)+'\n');console.log(row.id,definition.grade,results.at(-1).status,results.at(-1).message??'');
}
assert.equal(results.length,rows.length*3);assert.equal(new Set(results.map(r=>r.id+'/'+r.grade)).size,rows.length*3);assert(results.every(r=>r.status==='PASS'));console.log('PASS',results.length,'formal',batch,'author body cases');
