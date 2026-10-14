/** Numerical regression plus one deployment/G4 on the saved actual Master. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {deserialize,serialize} from 'node:v8';
import {gunzipSync,gzipSync} from 'node:zlib';
import {build} from 'esbuild';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply NEW_DIRECTORY');fs.mkdirSync(output,{recursive:true});
const sourceDir='docs/qa/artifacts/native-spatial-2026-10-14/safe-node-c17-capture-round1';
const captured=deserialize(gunzipSync(fs.readFileSync(`${sourceDir}/pre-deployment-c17.v8.gz`))),old=JSON.parse(fs.readFileSync(`${sourceDir}/node-placement-failure.json`)),capture=JSON.parse(fs.readFileSync(`${sourceDir}/report.json`));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const files=[...walk('src'),...walk('data'),'tools/native-spatial/check-extra-travel-c17.mjs',`${sourceDir}/pre-deployment-c17.v8.gz`,`${sourceDir}/node-placement-failure.json`];
const hashes=()=>Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report={status:'running',scope:'One current deployment and official G4 using saved c17 Master and geometry. Zero geometry compilation, no fresh search, no alternative layout/extraction/Host. Prior capture consumed one full; this continuation consumes the second diagnostic full slot.',sourceHashes:hashes(),cases:[],geometryWork:capture.attempts[0].geometryEvaluations,fullCandidates:1,originalElapsedMs:capture.elapsedMs};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const normalize=value=>JSON.parse(JSON.stringify(value));
function persist(value,name){
  const seen=new WeakMap();function copy(v){if(v===null||typeof v!=='object')return typeof v==='function'?undefined:v;if(seen.has(v))return seen.get(v);if(ArrayBuffer.isView(v))return v.slice();if(v instanceof Map){const out=new Map();seen.set(v,out);for(const[k,item]of v)out.set(k,copy(item));return out;}if(v instanceof Set){const out=new Set();seen.set(v,out);for(const item of v)out.add(copy(item));return out;}const out=Array.isArray(v)?[]:{};seen.set(v,out);for(const[k,item]of Object.entries(v))if(typeof item!=='function')out[k]=copy(item);return out;}
  fs.writeFileSync(path.join(output,name),gzipSync(serialize(copy(value))));
}
let started;
try{
  const root=path.resolve('src/generation/world-study'),entry=`
export {deployR100Expedition,r100ExtraTravelPx} from '${root}/r100-expedition.ts';
export {NativeBodyCollision} from '${root}/native-body-collision.ts';
export {nativePrimitiveTree,nativePrimitiveDistance,nativeVoidPrimitives} from '${root}/native-spatial-geometry.ts';
export {evaluateNativeSpatialRoutes} from '${root}/native-spatial-routes.ts';
export {freezeNativeSpatialRouteProbe,assessNativeSpatialRouteFeedback} from '${root}/native-spatial-route-feedback.ts';
export {nativeSpatialGeometryFingerprint} from '${root}/native-spatial-generation.ts';
export {validateSearchSites} from '${root}/search-site-placement.ts';
export {TileGrid} from '${path.resolve('src/systems/tile-grid.ts')}';`;
  const bundle=path.resolve(output,'check.mjs');
  await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',target:'node22',tsconfig:'tools/contam-preview/tsconfig.json',alias:{phaser:path.resolve('tools/contam-preview/phaser-stub.ts')},logLevel:'silent',plugins:[{name:'capture-node-selection',setup(b){b.onLoad({filter:/[\\/]r100-expedition\.ts$/},args=>{let contents=fs.readFileSync(args.path,'utf8');const needle="  const threats = chosen.filter(item => item.tier !== 'safe').sort((a, b) => b.seat.distance - a.seat.distance);";assert.equal(contents.split(needle).length,2);contents=contents.replace(needle,'  globalThis.__extraTravelNodes({candidates,chosen,kindlingNodes,contaminantNodes,nodeDecisions});\n'+needle);return{contents,loader:'ts'};});}}]});
  const api=await import(pathToFileURL(bundle).href),extra=api.r100ExtraTravelPx;
  const unit=(id,run)=>{run();report.cases.push({id,passed:true});save();};
  unit('negative-roundoff-zero-positive-depth-and-unreachable',()=>{
    const outbound=.1,homebound=.2,direct=.3000000000000001;assert(outbound+homebound-direct<0);assert.equal(extra(outbound,homebound,direct),0);
    assert.equal(extra(100,200,300),0);assert.equal(extra(700,900,1000),600);assert.equal(extra(700,900,1600),0);
    assert.equal(extra(Infinity,100,300),Infinity);assert.equal(extra(100,Infinity,300),Infinity);assert.equal(extra(Infinity,Infinity,Infinity),Infinity);
  });
  const staticSafe=old.candidates.filter(c=>c.failedFilters.every(f=>f==='extra-travel'||f==='node-spacing')),negative=staticSafe.filter(c=>c.distance<0);
  report.oldFailure={staticSafeCount:staticSafe.length,negativeRoundoffCount:negative.length,minNegative:Math.min(...negative.map(c=>c.distance)),maxNegative:Math.max(...negative.map(c=>c.distance)),originalSafeCount:old.decisions[0].rankedCells.length,funnel:old.funnel};
  assert.equal(staticSafe.length,99);assert.equal(negative.length,96);assert(negative.every(c=>c.distance>-1e-9));
  const {candidate,recipe}=captured,saved=candidate.geometry,{cols,rows,matter,roles}=saved.terrain;
  const sight={cols,rows,tileSize:8,version:0,isOpaque:(x,y)=>x<0||y<0||x>=cols||y>=rows||!matter[y*cols+x]};
  const matterAt=(x,y)=>x>=0&&y>=0&&x<cols*8&&y<rows*8&&matter[Math.floor(y/8)*cols+Math.floor(x/8)]===1;
  const master={...captured.master,sight,combat:new api.TileGrid(captured.master.layout.tileMap),matterAt,roleAt:(x,y)=>matterAt(x,y)?roles.get(captured.master.raster.objectId[Math.floor(y)*captured.master.raster.width+Math.floor(x)])??null:null};
  master.layout={...master.layout,walkableMask:new api.TileGrid(master.layout.tileMap)};
  const solidTree=api.nativePrimitiveTree(saved.solidPrimitives),voidTree=api.nativePrimitiveTree(api.nativeVoidPrimitives(saved.terrain));
  const geometry={...saved,sight,collision:new api.NativeBodyCollision({definition:saved.terrain.definition,meshes:saved.terrain.meshes},saved.terrain.tileMap),solidDistance:p=>api.nativePrimitiveDistance(solidTree,p.x,p.y),voidDistance:p=>api.nativePrimitiveDistance(voidTree,p.x,p.y)};
  const groups={...candidate.groups,structures:candidate.groups.structures.map(s=>{const tree=api.nativePrimitiveTree(s.boundary);return{...s,distance:p=>api.nativePrimitiveDistance(tree,p.x,p.y)};})};
  assert.equal(api.nativeSpatialGeometryFingerprint(geometry,candidate.layout).hash,'a2d4a4c15a186ba9');
  assert.deepEqual(normalize(master.layout.spawnPoint),captured.master.layout.spawnPoint);assert.deepEqual(master.pollution,captured.master.pollution);
  started=performance.now();const checkpoint=()=>{if(capture.elapsedMs+performance.now()-started>=60000)throw new Error('Saved c17 continuation exceeded original shared deadline');};
  let selected;
  globalThis.__extraTravelNodes=value=>{selected=value;persist(value,'selected-nodes.v8.gz');report.selectedNodes={chosen:value.chosen,decisions:value.nodeDecisions};save();};
  checkpoint();report.fullCandidates++;assert.equal(report.fullCandidates,2);
  const deployed=api.deployR100Expedition(master,recipe.contentDefinition,recipe.searchSitePolicy);checkpoint();
  persist({recipe,candidate:{...candidate,geometry,groups},master,deployed,extraction:captured.extraction,summary:captured.summary},'deployed-runtime.v8.gz');
  assert(selected);const byCell=new Map(selected.candidates.map(c=>[c.cell,c]));
  unit('same-candidate-lattice-only-negative-extra-costs-normalized',()=>{
    assert.equal(byCell.size,old.candidates.length);for(const before of old.candidates){const after=byCell.get(before.cell);assert(after);assert.deepEqual({...after,distance:before.distance},Object.fromEntries(Object.entries(before).filter(([k])=>k!=='failedFilters'&&k!=='score')));assert.equal(after.distance,Math.max(0,before.distance));}
  });
  const nodes=[...deployed.layout.kindlingNodes,...deployed.layout.contaminantNodes],content=recipe.contentDefinition;
  unit('all-resource-quotas-values-spacing-patrols-and-grounding-remain',()=>{
    for(const tier of ['safe','contested','deep'])for(const kind of ['kindling','contaminant']){const items=deployed.layout[`${kind}Nodes`].filter(n=>n.tier===tier);assert.equal(items.length,content[`${kind}_${tier}_count`]);if(kind==='kindling')assert(items.every(n=>n.value===content[`kindling_${tier}_value`]));}
    for(let a=0;a<nodes.length;a++)for(let b=a+1;b<nodes.length;b++)assert(Math.hypot(nodes[a].position.x-nodes[b].position.x,nodes[a].position.y-nodes[b].position.y)>=recipe.nativeSpatial.deployment.node_spacing_px);
    assert.equal(deployed.layout.enemySpawns.length,content.enemy_count);assert(deployed.layout.enemySpawns.every(e=>e.patrol.mode!=='static'&&e.patrol.waypoints.length>1));
    assert.equal(deployed.diagnostics.patrolWindows.length,nodes.filter(n=>n.tier!=='safe').length);assert(deployed.diagnostics.patrolWindows.every(w=>w.durationMs>=2400));
    assert.deepEqual(deployed.layout.contaminationPins,master.layout.contaminationPins);api.validateSearchSites({...master,algorithmRevision:12,layout:deployed.layout,searchSites:deployed.searchSites});
  });
  const gate=api.evaluateNativeSpatialRoutes(geometry,groups.structures,recipe.nativeSpatial.policy,deployed.layout);checkpoint();
  const probe=api.freezeNativeSpatialRouteProbe(20261012,17,'a2d4a4c15a186ba9',deployed.layout,gate),feedback=api.assessNativeSpatialRouteFeedback(probe,gate,geometry,groups,candidate.trace.gates.geometry,recipe.nativeSpatial.policy);
  persist({recipe,candidate:{...candidate,geometry,groups},master,deployed,gate,probe,feedback},'complete-runtime.v8.gz');report.g4=gate;report.routeFeedback={comparable:feedback.comparable,comparabilityReasons:feedback.comparabilityReasons,maximum:feedback.maximum,sum:feedback.sum,witnessCount:feedback.witnesses.length};
  report.deployment=deployed.diagnostics;report.status=gate.accepted?'deployment-and-g4-passed':'deployment-passed-g4-rejected';save();
}catch(error){report.status='failed';report.error=String(error.stack??error);if(error.diagnostics)report.errorDiagnostics=error.diagnostics;}
finally{delete globalThis.__extraTravelNodes;}
report.elapsedMs=started===undefined?null:performance.now()-started;report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,elapsedMs:report.elapsedMs,cases:report.cases,g4Reasons:report.g4?.reasons,routeFeedback:report.routeFeedback,error:report.error}));
if(!report.status.startsWith('deployment-'))process.exitCode=1;
