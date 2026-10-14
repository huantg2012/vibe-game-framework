/** Independent QA counterexamples for approved spatial identities and route encounters. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision.ts';
import {TileType} from '../../src/types/game-types.ts';
import {nativeCellPoint,nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,nativeVoidPrimitives,NATIVE_SPATIAL_DIRECTIONS} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures} from '../../src/generation/world-study/native-spatial-measure.ts';
import {evaluateNativeSpatialRoutes} from '../../src/generation/world-study/native-spatial-routes.ts';
import {NATIVE_SPATIAL_POLICY as policy} from '../../src/generated/r100-native-spatial.ts';

const output=process.argv[2];assert(output,'Usage: check-qa-measure.mjs NEW_REPORT.json');assert(!fs.existsSync(output),'Retain previous evidence');
const files=['tools/native-spatial/check-qa-measure.mjs','src/generation/world-study/native-spatial-geometry.ts','src/generation/world-study/native-spatial-measure.ts','src/generation/world-study/native-spatial-routes.ts','src/generation/world-study/native-spatial-visibility.ts','src/generated/r100-native-spatial.ts'];
const hashes=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=hashes(),cases=[];
function fixture(width,height,{holes=[],solids=[],spawn={x:36,y:36},exit={x:width-36,y:height-36}}={}) {
  const cols=width/8,rows=height/8,count=cols*rows;
  const tiles=Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>holes.some(([l,t,right,b])=>(c+.5)*8>=l&&(c+.5)*8<right&&(r+.5)*8>=t&&(r+.5)*8<b)?TileType.VOID:TileType.FLOOR));
  const tileMap={cols,rows,tileSize:8,tiles},definition={instances:solids.map((_,i)=>({id:i+1,role:'solid'}))};
  const meshes=solids.map(([l,t,r,b],i)=>({spec:{id:i+1},positions:Float32Array.from([l,t,0,r,t,0,r,b,0,l,b,0]),indices:Uint16Array.from([0,1,2,0,2,3]),triangleCount:2}));
  const solidPrimitives=solids.flatMap(([l,t,r,b],i)=>[nativePrimitive([l,t,r,t,r,b],i+1),nativePrimitive([l,t,r,b,l,b],i+1)]);
  const terrain={definition,meshes,cols,rows,width,height,tileMap,matter:Uint8Array.from(tiles.flat(),value=>Number(value!==TileType.VOID)),spawnPoint:spawn};
  const collision=new NativeBodyCollision({definition,meshes},tileMap),supported=new Uint8Array(count),reachable=new Uint8Array(count),links8=new Uint8Array(count);
  for(let cell=0;cell<count;cell++)supported[cell]=Number(collision.supports(nativeCellPoint(cell,cols),10,10));
  for(let cell=0;cell<count;cell++)if(supported[cell])for(let d=0;d<8;d++){
    const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[d],x=cell%cols+dx,y=Math.floor(cell/cols)+dy,next=y*cols+x;
    if(x>=0&&y>=0&&x<cols&&y<rows&&supported[next]&&collision.displacementFraction(nativeCellPoint(cell,cols),10,10,dx*8,dy*8)>=1-1e-9)links8[cell]|=1<<d;
  }
  const start=Math.floor(spawn.y/8)*cols+Math.floor(spawn.x/8),queue=[start];assert(supported[start]);reachable[start]=1;
  for(let at=0;at<queue.length;at++)for(let d=0;d<8;d++)if(links8[queue[at]]&(1<<d)){
    const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[d],next=queue[at]+dx+dy*cols;if(!reachable[next]){reachable[next]=1;queue.push(next);}
  }
  const solidTree=nativePrimitiveTree(solidPrimitives),voidTree=nativePrimitiveTree(nativeVoidPrimitives(terrain));
  const geometry={terrain,collision,supported,reachable,links8,supportedCount:supported.reduce((a,b)=>a+b,0),reachableCount:queue.length,solidPrimitives,
    solidDistance:p=>nativePrimitiveDistance(solidTree,p.x,p.y),voidDistance:p=>nativePrimitiveDistance(voidTree,p.x,p.y),
    sight:{cols,rows,tileSize:8,version:0,isOpaque:(c,r)=>c<0||r<0||c>=cols||r>=rows||tiles[r][c]===TileType.VOID}};
  const assemblies=solids.map((_,i)=>({assemblyId:`independent-${i+1}`,instanceIds:[i+1],maxSpanPx:1024}));
  return {geometry,assemblies,layout:{tileMap,spawnPoint:spawn,extractionPoint:{position:exit},kindlingNodes:[],contaminantNodes:[]}};
}
async function check(id,run){const began=performance.now();let evidence={};const record=value=>{evidence=value;};try{await run(record);cases.push({id,passed:true,...evidence,elapsedMs:performance.now()-began});}catch(error){cases.push({id,passed:false,...evidence,error:String(error.stack??error),elapsedMs:performance.now()-began});}console.log(JSON.stringify(cases.at(-1)));}

await check('independent-solids-across-real-24px-body-passage-remain-two',record=>{
  const {geometry,assemblies}=fixture(640,480,{solids:[[160,160,240,320],[264,160,344,320]]});
  const from={x:252,y:120},to={x:252,y:360},fraction=geometry.collision.displacementFraction(from,10,10,to.x-from.x,to.y-from.y);
  assert.equal(fraction,1,'Witness is a continuous 20px-body passage, not just two supported endpoints');
  const grouped=identifyNativeSpatialStructures(geometry,assemblies,policy),solids=grouped.structures.filter(s=>s.kind==='solid');
  record({gapPx:24,bodyWidthPx:20,bodySweepFraction:fraction,solidCount:solids.length,groups:solids.map(s=>({id:s.id,assemblies:s.assemblyIds}))});
  assert.equal(solids.length,2,'Two independent authored structures separated by a real body passage must not merge');
});

await check('separated-feet-preserve-one-frozen-mother-identity',record=>{
  const {geometry}=fixture(640,480,{solids:[[160,160,240,320],[320,160,400,320]]});
  const grouped=identifyNativeSpatialStructures(geometry,[{assemblyId:'one-two-foot-mother',instanceIds:[1,2],maxSpanPx:400}],policy);
  const solids=grouped.structures.filter(s=>s.kind==='solid');record({solidCount:solids.length,components:solids[0]?.componentCount});
  assert.equal(solids.length,1);assert.equal(solids[0].componentCount,2);
});

await check('regional-summary-uses-first-encounters-on-evaluated-routes',record=>{
  const {geometry,layout}=fixture(800,640,{holes:[[144,144,448,240]],spawn:{x:100,y:100},exit:{x:764,y:604}});
  const grouped=identifyNativeSpatialStructures(geometry,[],policy),hole=grouped.structures.find(s=>s.kind==='hole');assert(hole);
  const result=evaluateNativeSpatialRoutes(geometry,grouped.structures,policy,layout),routes=result.metrics.routes;
  // Every whole trip starts in sight of the same near-side hole. Its first
  // encounter is therefore at the common starting point, independent of route.
  const events=routes.flatMap(route=>route.events.filter(event=>event.id===hole.id));
  assert.equal(events.length,routes.length);assert(events.every(event=>event.at===0));
  const firstEncounterRegions=[...new Set(events.map(event=>event.region))].sort((a,b)=>a-b);
  const summaryRegions=result.metrics.regions.filter(region=>region.structures.includes(hole.id)).map(region=>region.id).sort((a,b)=>a-b);
  record({holeId:hole.id,wholeRoutes:routes.length,allFirstEncountersAtStart:true,firstEncounterRegions,summaryRegions,
    routeSmoothingChanges:routes.filter(route=>route.smoothedPoints.length<route.cells.length).length});
  assert.deepEqual(summaryRegions,firstEncounterRegions,'Revisiting an object elsewhere on raw paths cannot create a new first-encounter region');
});

const after=hashes(),stable=JSON.stringify(before)===JSON.stringify(after);
const report={status:cases.every(row=>row.passed)&&stable?'passed':'failed',createdAt:new Date().toISOString(),sourceHashes:before,sourceHashesAfter:after,sourcesStable:stable,cases,
  limitations:['Independent small physical fixtures use real NativeBodyCollision, full-body graph and production measures; they do not generate production worlds.','No final pipeline, old-save recovery, live gameplay, visual or performance acceptance is asserted.']};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
