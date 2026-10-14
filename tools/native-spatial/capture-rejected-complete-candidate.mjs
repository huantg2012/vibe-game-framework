/** One authorized fixed-layout evidence recapture, preserving the prior G4 rejection.
 * esbuild adds a read-only observer/export surface in memory; production files stay untouched. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';

const [output]=process.argv.slice(2);
assert(output&&!fs.existsSync(output),'Usage: capture-rejected-complete-candidate.mjs NEW_DIRECTORY');
const root='docs/qa/artifacts/native-spatial-2026-10-14';
const oldPath=`${root}/complete-candidate-c27-round1/report.json`,recipePath=`${root}/complete-candidate-c27-round1/recipe.json`,proposalPath=`${root}/g1-incumbent-c27-round1/proposal.json`;
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const files=[...walk('src'),...walk('data'),oldPath,recipePath,proposalPath,'tools/native-spatial/capture-rejected-complete-candidate.mjs','package.json','package-lock.json','tsconfig.json','tools/contam-preview/tsconfig.json','tools/contam-preview/phaser-stub.ts'];
const snapshot=()=>Object.fromEntries([...new Set(files)].sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),old=read(oldPath),recipe=read(recipePath),saved=read(proposalPath),proposal=saved.proposal;
const sourceHashes=snapshot();fs.mkdirSync(output,{recursive:true});
const report={status:'preparing',scope:'Single evidence recapture of the same rejected saved candidate. No fresh search, admission retry or accepted map. Diagnostic route alternatives never replace G4.',sourceHashes,
  fingerprintScope:'All src/data; exact prior full report, recipe, proposal; this tool and dependency/compiler config. Other concurrent diagnostic tools are excluded.',
  startedAt:new Date().toISOString(),limits:{deadlineMs:60000,maxGeometryWork:72,maxFullCandidates:2,actualCandidateLimit:1,retries:0},observerCalls:0};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
let runtime,started,fullEnded;
function captureData(value,file){
  const omittedFunctions=[],copies=new WeakMap();
  function dataOnly(item,p=''){if(typeof item==='function'){omittedFunctions.push(p);return undefined;}if(!item||typeof item!=='object')return item;if(copies.has(item))return copies.get(item);if(ArrayBuffer.isView(item))return item.slice();if(item instanceof Map){const out=new Map();copies.set(item,out);for(const[k,v]of item)out.set(k,dataOnly(v,`${p}.${k}`));return out;}const out=Array.isArray(item)?[]:{};copies.set(item,out);for(const[k,v]of Object.entries(item)){const child=dataOnly(v,`${p}.${k}`);if(typeof v!=='function')out[k]=child;}return out;}
  const target=path.join(output,file);fs.writeFileSync(target,gzipSync(serialize(dataOnly(value))));return{file,bytes:fs.statSync(target).size,omittedFunctions,admittedMap:false};
}
try{
  const moduleRoot=path.resolve('src/generation/world-study');
  const entry=`export {validR100ProductionRecipe} from '${moduleRoot}/r100-package.ts';
export {completeNativeSpatialCandidate} from '${moduleRoot}/r100-production-map.ts';
export {buildNativeSpatialGeometry,nativePrimitiveTree,nativeCellPoint,NATIVE_SPATIAL_DIRECTIONS,NATIVE_SPATIAL_EDGE_COSTS} from '${moduleRoot}/native-spatial-geometry.ts';
export {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '${moduleRoot}/native-spatial-measure.ts';
export {evaluateNativeSpatialVisibility} from '${moduleRoot}/native-spatial-visibility.ts';
export {nativeSpatialGeometryFingerprint,createNativeSpatialGeometryWorkBudget} from '${moduleRoot}/native-spatial-generation.ts';
export {diagnosticSmooth,diagnosticCrossSections} from '${moduleRoot}/native-spatial-routes.ts';
export {diagnosticExpeditionRoutes} from '${moduleRoot}/r100-expedition.ts';
export {validateSearchSites} from '${moduleRoot}/search-site-placement.ts';
export {findR100PatrolWindows} from '${moduleRoot}/r100-patrol-windows.ts';
export {TileType} from '${path.resolve('src/types/game-types.ts')}';
export {TileGrid} from '${path.resolve('src/systems/tile-grid.ts')}';
export {mix32} from '${path.resolve('src/generation/seed-fork.ts')}';`;
  const injected=[];
  const bundled=await build({stdin:{contents:entry,resolveDir:process.cwd(),sourcefile:'fixed-candidate-diagnostic-entry.ts',loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,target:'node22',tsconfig:'tools/contam-preview/tsconfig.json',alias:{phaser:path.resolve('tools/contam-preview/phaser-stub.ts')},plugins:[{name:'read-only-capture-and-private-exports',setup(b){b.onLoad({filter:/[\\/]world-study[\\/](?:r100-production-map|native-spatial-routes|r100-expedition)\.ts$/},args=>{let contents=fs.readFileSync(args.path,'utf8');const name=path.basename(args.path);
    if(name==='r100-production-map.ts'){const needle='    const routes=evaluateNativeSpatialRoutes(candidate.geometry,candidate.groups.structures,input.policy,layout);';assert.equal(contents.split(needle).length,2,'Observer patch must match exactly one production call');contents=contents.replace(needle,'    globalThis.__nativeRejectedCapture({candidate,master,deployed,extraction,summary});\n'+needle);injected.push({file:name,operation:'one observer immediately before unchanged G4 call'});}
    if(name==='native-spatial-routes.ts'){contents+='\nexport {smooth as diagnosticSmooth,crossSections as diagnosticCrossSections};\n';injected.push({file:name,operation:'export existing private functions; no body changes'});}
    if(name==='r100-expedition.ts'){contents+='\nexport {routes as diagnosticExpeditionRoutes};\n';injected.push({file:name,operation:'export existing body-seat field; no body changes'});}
    return{contents,loader:'ts'};});}}]});
  assert.equal(injected.length,3);report.instrumentation=injected;
  const bundle=bundled.outputFiles[0].contents;report.bundleSha256=createHash('sha256').update(bundle).digest('hex');
  const bundlePath=path.resolve(output,'diagnostic-bundle.mjs');fs.writeFileSync(bundlePath,bundle);const api=await import(pathToFileURL(bundlePath).href);
  assert(api.validR100ProductionRecipe(recipe));assert.equal(recipe.package.algorithmRevision,12);
  const {extraction,deployment,...intent}=recipe.nativeSpatial;assert.deepEqual(saved.input,intent);assert(extraction&&deployment&&recipe.searchSitePolicy);
  const input=recipe.nativeSpatial,seed=recipe.requestedSeed;assert.equal(seed,20261012);assert.equal(proposal.candidate,28);
  assert.equal(proposal.layoutSeed,api.mix32(seed,`${input.policy.algorithm}:${input.policy.version}:${input.policy.sourceHash}:${input.world.worldId}:${seed}:${proposal.candidate}`));
  assert.equal(input.policy.maxGeometryEvaluations,72);assert.equal(input.policy.maxFullCandidates,2);
  const frozenRecipe=JSON.stringify(recipe),frozenProposal=JSON.stringify(proposal),oldStage=old.attempts[0].deploymentRejections[0].diagnostics;
  globalThis.__nativeRejectedCapture=value=>{report.observerCalls++;assert.equal(report.observerCalls,1);runtime=value;report.preGateCapture=captureData({recipe,proposal,...value},'rejected-runtime-pre-g4.v8.gz');save();assert.deepEqual(value.extraction,oldStage.extraction.extraction);assert.deepEqual(value.summary,oldStage.extraction.summary);assert.deepEqual(value.master.diagnostics,oldStage.master);assert.deepEqual(value.deployed.diagnostics,oldStage.deployment);};
  const attempt={geometrySeed:seed,proposalBudget:72,layoutProposals:1,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'},attempts=[attempt],rejected=[];
  report.attempts=attempts;report.rejected=rejected;started=performance.now();
  const checkpoint=()=>{if(performance.now()-started>=60000){attempt.stopReason='deadline';throw new Error('Fixed capture shared deadline exceeded');}};
  const budget=api.createNativeSpatialGeometryWorkBudget(attempt,72,checkpoint);
  const measured=budget.run({kind:'final-geometry',candidate:proposal.candidate},()=>{attempt.finalGeometryEvaluations++;const geometry=api.buildNativeSpatialGeometry(proposal.definition,seed),fingerprint=api.nativeSpatialGeometryFingerprint(geometry,proposal);assert.equal(fingerprint.hash,old.actualGeometryHash);assert.equal(fingerprint.hash,'9faebdbd40a92649');report.actualGeometryHash=fingerprint.hash;
    const groups=api.identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy),ground=api.evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});assert.deepEqual(ground,old.gates.geometry);assert(ground.accepted);return{accepted:ground.accepted,reasons:ground.reasons,geometry,groups,ground};});
  checkpoint();const visibility=api.evaluateNativeSpatialVisibility(measured.geometry,measured.groups.structures,input.policy);assert.deepEqual(visibility,old.gates.visibility);assert(visibility.accepted);checkpoint();
  const trace={candidate:proposal.candidate,geometrySeed:seed,layoutSeed:proposal.layoutSeed,geometryHash:report.actualGeometryHash,requestedCounts:proposal.requestedCounts,accepted:true,reasons:[],gates:{geometry:measured.ground,visibility}};attempt.candidates.push(trace);
  const result=api.completeNativeSpatialCandidate(recipe,{layout:proposal,geometry:measured.geometry,groups:measured.groups,trace},{attempt:0,trace:attempt,attempts,rejected,checkpoint});
  checkpoint();fullEnded=performance.now();report.fullChainElapsedMs=fullEnded-started;assert.equal(result.accepted,false);assert.deepEqual(JSON.parse(JSON.stringify(result.feedback)),old.feedback,'The entire old JSON G4 result must reproduce under the same JSON serialization');assert(runtime);assert.equal(attempt.geometryEvaluations,1);assert.equal(attempt.fullCandidates,1);
  report.status='original-rejection-reproduced';report.gates={geometry:measured.ground,visibility,routes:result.feedback};report.originalStagesExactlyMatched=true;save();

  // Serialize all data now, before post-deployment assertions can fail. Functions
  // are intentionally omitted; their unchanged implementations are fingerprinted.
  report.capture=captureData({recipe,proposal,...runtime,routes:result.feedback},'rejected-runtime.v8.gz');save();
  const {geometry}=runtime.candidate,{master,deployed}=runtime,layout=deployed.layout,content=recipe.contentDefinition,grade=recipe.gradeDefinition,body=geometry.collision;
  const checks=[];function check(id,fn){try{const detail=fn();checks.push({id,passed:true,detail});}catch(error){checks.push({id,passed:false,error:String(error.stack??error)});}}
  check('exact-resource-tier-count-value',()=>{const rows=[];for(const tier of ['safe','contested','deep'])for(const kind of ['kindling','contaminant']){const nodes=layout[`${kind}Nodes`].filter(n=>n.tier===tier);assert.equal(nodes.length,content[`${kind}_${tier}_count`]);if(kind==='kindling')assert(nodes.every(n=>n.value===content[`kindling_${tier}_value`]));rows.push({kind,tier,count:nodes.length,values:nodes.map(n=>n.value??null)});}return rows;});
  check('actual-host-pins-and-forms',()=>{const pins=layout.contaminationPins,forms=layout.contaminationDraw.forms;assert.equal(pins.paintFloors.length,grade.paintCount);assert.equal(pins.corridorAabbs.length,grade.volumeCount);assert.equal(forms.filter(f=>f.occupancy==='paint'&&f.substrate===grade.paintSubstrate&&f.coverage===grade.paintCoverage).length,grade.paintCount);assert.equal(forms.filter(f=>f.occupancy==='volume'&&f.substrate===grade.volumeSubstrate&&f.coverage===grade.volumeCoverage).length,grade.volumeCount);for(const p of pins.paintFloors)assert.equal(master.hostTileMap.tiles[p.floorRow]?.[p.floorCol],api.TileType.FLOOR);for(const p of pins.corridorAabbs)for(let y=p.minRow;y<=p.maxRow;y++)for(let x=p.minCol;x<=p.maxCol;x++)assert.equal(master.hostTileMap.tiles[y]?.[x],api.TileType.FLOOR);return{paintPins:pins.paintFloors.length,volumePins:pins.corridorAabbs.length};});
  const nodes=[...layout.kindlingNodes,...layout.contaminantNodes];
  check('full-body-supported-landmarks-and-patrols',()=>{for(const p of[layout.spawnPoint,layout.extractionPoint.position,...nodes.map(n=>n.position)])assert(body.supports(p,10,10));assert.equal(layout.enemySpawns.length,content.enemy_count);const rows=[];for(const enemy of layout.enemySpawns){assert.notEqual(enemy.patrol.mode,'static');assert(enemy.patrol.waypoints.length>1&&enemy.form);let length=0;for(let i=1;i<enemy.patrol.waypoints.length;i++){const a=enemy.patrol.waypoints[i-1],b=enemy.patrol.waypoints[i],p={x:(a.col+.5)*8,y:(a.row+.5)*8},dx=(b.col-a.col)*8,dy=(b.row-a.row)*8;assert(body.supports(p,10,10));assert(body.displacementFraction(p,10,10,dx,dy)>=1-1e-9);length+=Math.hypot(dx,dy);}assert(length>=88-1e-6&&length<=200+1e-6);rows.push({id:enemy.id,lengthPx:length,segments:enemy.patrol.waypoints.length-1});}return rows;});
  check('recomputed-real-patrol-search-windows',()=>{const grid=new api.TileGrid(master.layout.tileMap),field=api.diagnosticExpeditionRoutes(grid,Math.floor(layout.spawnPoint.y/8)*grid.cols+Math.floor(layout.spawnPoint.x/8));const windows=api.findR100PatrolWindows(master,layout.enemySpawns,nodes.filter(n=>n.tier!=='safe'),p=>Number.isFinite(field.distance[Math.floor(p.y/8)*grid.cols+Math.floor(p.x/8)]));assert.deepEqual(windows,deployed.diagnostics.patrolWindows);assert.equal(windows.length,nodes.filter(n=>n.tier!=='safe').length);assert(windows.every(w=>w.durationMs>=2400));return windows;});
  check('grounded-sites-full-production-validator',()=>{api.validateSearchSites({...master,algorithmRevision:12,layout,searchSites:deployed.searchSites});assert.deepEqual(deployed.searchSites.map(s=>s.nodeId).sort(),nodes.map(n=>n.id).sort());return{count:deployed.searchSites.length};});
  report.contentChecks=checks;report.contentChecksPassed=checks.every(c=>c.passed);save();

  const diagnosticStarted=performance.now(),{cols,rows}=geometry.terrain,count=cols*rows,clearance=new Float64Array(count);clearance.fill(-1);
  for(let cell=0;cell<count;cell++)if(geometry.reachable[cell]){const p=api.nativeCellPoint(cell,cols);clearance[cell]=Math.min(geometry.voidDistance(p),geometry.solidDistance(p));}
  fs.writeFileSync(path.join(output,'clearance-field.v8.gz'),gzipSync(serialize({cols,rows,cellSize:8,clearance,definition:'minimum exact point distance to actual VOID boundary and projected solid triangles; -1 outside reachable body domain',geometryHash:report.actualGeometryHash})));
  const tree=api.nativePrimitiveTree(geometry.solidPrimitives),dirs=api.NATIVE_SPATIAL_DIRECTIONS,costs=api.NATIVE_SPATIAL_EDGE_COSTS;
  function field(start,profile){const distances=new Float64Array(count);distances.fill(Infinity);const parents=new Int32Array(count);parents.fill(-1);const heap=[];const push=(cell,d)=>{let i=heap.length;heap.push([d,cell]);while(i){const j=(i-1)>>1;if(heap[j][0]<d||heap[j][0]===d&&heap[j][1]<=cell)break;heap[i]=heap[j];i=j;}heap[i]=[d,cell];};const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(true){let j=i*2+1;if(j>=heap.length)break;if(j+1<heap.length&&(heap[j+1][0]<heap[j][0]||heap[j+1][0]===heap[j][0]&&heap[j+1][1]<heap[j][1]))j++;if(last[0]<heap[j][0]||last[0]===heap[j][0]&&last[1]<=heap[j][1])break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};
    if(profile.strict&&clearance[start]<profile.radius)return{distances,parents,startBlocked:true};distances[start]=0;push(start,0);while(heap.length){const [d,c]=pop();if(d!==distances[c])continue;for(let i=0;i<8;i++)if(geometry.links8[c]&(1<<i)){const [dx,dy]=dirs[i],n=c+dx+dy*cols;if(!geometry.reachable[n]||profile.strict&&clearance[n]<profile.radius)continue;const deficit=Math.max(0,profile.radius-Math.min(clearance[c],clearance[n]))/profile.radius,candidate=d+costs[i]*(1+profile.weight*deficit);if(candidate<distances[n]){distances[n]=candidate;parents[n]=c;push(n,candidate);}}}return{distances,parents,startBlocked:false};}
  const rawPath=(target,parents)=>{const a=[];let c=target;while(c>=0){a.push(c);c=parents[c];}return a.reverse();};
  const rawLength=cells=>cells.slice(1).reduce((sum,c,i)=>sum+Math.hypot((c%cols-cells[i]%cols)*8,(Math.floor(c/cols)-Math.floor(cells[i]/cols))*8),0);
  const failed=result.feedback.metrics.routes.filter(r=>!r.transverse.accepted),profiles=[{id:'prefer48-weight4',radius:48,weight:4},{id:'prefer48-weight16',radius:48,weight:16},{id:'prefer48-weight64',radius:48,weight:64},{id:'prefer80-weight16',radius:80,weight:16},{id:'strict48-domain',radius:48,weight:0,strict:true}],alternativeRoutes=[];
  const startCell=failed[0].cells[0],exitCell=failed[0].cells.at(-1);
  for(const profile of profiles){const fromStart=field(startCell,profile),fromExit=field(exitCell,profile);for(const route of failed){assert.equal(route.cells[0],startCell);assert.equal(route.cells.at(-1),exitCell);if(!Number.isFinite(fromStart.distances[route.target])||!Number.isFinite(fromExit.distances[route.target])){alternativeRoutes.push({routeId:route.id,profile,status:'no-path-in-this-restricted-search',target:route.target,startClearancePx:clearance[startCell],exitClearancePx:clearance[exitCell],targetClearancePx:clearance[route.target],startBlocked:fromStart.startBlocked,exitBlocked:fromExit.startBlocked});continue;}
    const outward=rawPath(route.target,fromStart.parents),homeward=rawPath(route.target,fromExit.parents).reverse(),cells=[...outward,...homeward.slice(1)],legs=[api.diagnosticSmooth(outward,geometry),api.diagnosticSmooth(homeward,geometry)],points=[...legs[0],...legs[1].slice(1)],transverse=api.diagnosticCrossSections(points,geometry,tree,input.policy);let sweepSafe=true;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i];sweepSafe&&=body.displacementFraction(a,10,10,b.x-a.x,b.y-a.y)>=1-1e-9;}
    assert(sweepSafe);alternativeRoutes.push({routeId:route.id,profile,status:'diagnostic-path',target:route.target,start:startCell,exit:exitCell,rawLengthPx:rawLength(cells),rawLengthRatio:rawLength(cells)/rawLength(route.cells),lengthPx:transverse.lengthPx,smoothedLengthRatio:transverse.lengthPx/route.lengthPx,minimumRawClearancePx:Math.min(...cells.map(c=>clearance[c])),sweptBodySafe:sweepSafe,transverse,cells,smoothedPoints:points,original:{lengthPx:route.lengthPx,narrowRatio:route.transverse.narrowRatio,maxNarrowOrUncertainRunPx:route.transverse.maxNarrowOrUncertainRunPx}});
  }}
  report.detourDiagnostics={scope:'Only the two old transverse-failing routes; all spawn/target-seat/exit cells unchanged. Weighted graph candidates use actual links8 and exact geometry clearance. Official per-leg smooth and crossSections are reused without implementation changes.',rulesUnchanged:true,profiles,alternatives:alternativeRoutes,elapsedMs:performance.now()-diagnosticStarted,
    limits:['A candidate passing transverse is only sufficient evidence for that particular path, not a new G4 result. H:S encounters on alternatives are not evaluated.','Failure of this finite weighted/restricted family does not prove absence of a wide detour.','48px radial clearance is not the 160px transverse opening rule; official smoothing may shorten a wide raw path through a narrower section.','Concurrent diagnostic work means wall-time is evidence duration only, not a performance comparison.']};
  assert.equal(JSON.stringify(recipe),frozenRecipe);assert.equal(JSON.stringify(proposal),frozenProposal);report.status='captured-original-rejection-with-diagnostics';
}catch(error){report.status='failed';report.error=String(error.stack??error);}finally{delete globalThis.__nativeRejectedCapture;}
report.finishedAt=new Date().toISOString();report.sourceHashesAfter=snapshot();report.sourcesStable=JSON.stringify(sourceHashes)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,observerCalls:report.observerCalls,geometryHash:report.actualGeometryHash,fullChainElapsedMs:report.fullChainElapsedMs,contentChecks:report.contentChecks?.map(c=>({id:c.id,passed:c.passed,error:c.error})),alternatives:report.detourDiagnostics?.alternatives.map(a=>({id:a.routeId,profile:a.profile.id,status:a.status,lengthRatio:a.smoothedLengthRatio,narrowRatio:a.transverse?.narrowRatio,maxRun:a.transverse?.maxNarrowOrUncertainRunPx,accepted:a.transverse?.accepted})),error:report.error},null,2));
if(report.status!=='captured-original-rejection-with-diagnostics'||!report.contentChecksPassed)process.exitCode=1;
