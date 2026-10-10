/** Each admission is a complete production map. The report never means all seeds. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {createR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {generatedRiftIdentity} from '../../src/generation/rift-generation-identity.ts';
import {executeRiftGeneration} from '../../src/generation/rift-generation-execute.ts';
import {hydrateRiftGeneration} from '../../src/generation/rift-generation-protocol.ts';
import {TileGrid} from '../../src/systems/tile-grid.ts';
import {bodyHasSupport,bodyDisplacementFraction} from '../../src/systems/ai/physical-grid.ts';
import {TileType} from '../../src/types/game-types.ts';
import {measureRouteObstructions} from './route-obstruction.mjs';
const allWorlds=process.env.QA_WORLDS?.split(',')??R100_NATIVE_WORLDS.filter(x=>x.enabled).map(x=>x.id);
const shardCount=Number(process.env.QA_SHARD_COUNT??1),shardIndex=Number(process.env.QA_SHARD_INDEX??0);
assert(Number.isInteger(shardCount)&&shardCount>=1&&Number.isInteger(shardIndex)&&shardIndex>=0&&shardIndex<shardCount);
const worlds=allWorlds.filter((_,i)=>i%shardCount===shardIndex);
const grades=(process.env.QA_GRADES??'low,medium,severe').split(',');
const seed=Number(process.env.QA_SEED??20261010),recovery=process.env.QA_RECOVERY==='1';
const output=process.env.QA_REPORT??'docs/qa/artifacts/r100-spatial-rollout-2026-10-10/production.json';
assert(!existsSync(output),`Refusing to replace evidence: ${output}`);
const paths=['src/generation/world-study/r100-spatial-world.ts','src/generated/r100-spatial-data.ts','src/generation/world-study/r100-package.ts','src/generation/world-study/r100-production-map.ts','src/generation/world-study/r100-master-world.ts','src/generation/world-study/r100-pollution.ts','src/generation/world-study/r100-expedition.ts','src/generation/world-study/spatial-extraction-selection.ts','src/generation/world-study/native-volume-ground-edge.ts','src/generation/world-study/r100-spatial-deployment.ts','src/generated/rift-spatial-deployment-data.ts','src/generation/world-study/r100-patrol-windows.ts','tools/spatial-rollout/route-obstruction.mjs','tools/spatial-rollout/check-production.mjs'];
paths.push('src/generated/r100-package-manifest.ts','src/generation/world-study/native-volume-erosion.ts','src/generation/world-study/r100-spatial-types.ts',...readdirSync('data').filter(p=>p.startsWith('rift-spatial-')&&p.endsWith('.csv')).map(p=>`data/${p}`));
const hashes=Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const report={status:'running',scope:'Complete production admissions at stated requested seed; quotas, real body support, patrol sweeps, geometry metrics and frozen recipe integrity. Optional independent worker-wire regeneration, not browser or human acceptance.',seed,recovery,sourceHashes:hashes,cases:[],failures:[]};
mkdirSync(dirname(output),{recursive:true});
const save=()=>writeFileSync(output,JSON.stringify(report,null,2)+'\n');
for(const id of worlds)for(const grade of grades){
 const start=performance.now();
 try{
 const recipe=createR100ProductionRecipe(id,seed,grade),frozen=JSON.stringify(recipe);
 assert.equal(recipe.package.algorithmRevision,7);assert(validR100ProductionRecipe(recipe));assert(recipe.spatialPolicy);
 const world=createR100ProductionMap(recipe),{layout,native}=world,grid=new TileGrid(layout.tileMap),budget=recipe.contentDefinition;
 assert(native&&native.algorithmRevision===7);assert.equal(grid.widthPx,2304);assert.equal(grid.heightPx,1792);
 assert.equal(grid.tileSize,8);assert.equal(world.hostTileMap.tileSize,32);
 assert.equal(layout.enemySpawns.length,budget.enemy_count);assert.equal(layout.enemySpawns.filter(x=>x.type==='rewriter').length,1);
 assert.equal(layout.kindlingNodes.reduce((n,x)=>n+x.value,0),({low:9,medium:13,severe:17})[grade]);
 assert.equal(layout.contaminantNodes.length,({low:2,medium:3,severe:4})[grade]);
 assert.equal(layout.contaminationPins.paintFloors.length,recipe.gradeDefinition.paintCount);
 assert.equal(layout.contaminationPins.corridorAabbs.length,recipe.gradeDefinition.volumeCount);
 const points=[layout.spawnPoint,layout.extractionPoint.position,...layout.kindlingNodes.map(x=>x.position),...layout.contaminantNodes.map(x=>x.position)];
 for(const point of points)assert(bodyHasSupport(grid,point,10,10));
 let patrolSegments=0;
 for(const e of layout.enemySpawns){assert.equal(e.patrol.mode,'pingpong');for(let i=1;i<e.patrol.waypoints.length;i++){
  const a=e.patrol.waypoints[i-1],b=e.patrol.waypoints[i];
  assert.equal(bodyDisplacementFraction(grid,{x:(a.col+.5)*8,y:(a.row+.5)*8},10,10,(b.col-a.col)*8,(b.row-a.row)*8),1);patrolSegments++;
 }}
 let matter=0,solid=0,supported=0;
 const seats=new Uint8Array(grid.cols*grid.rows);
 for(let row=0;row<grid.rows;row++)for(let col=0;col<grid.cols;col++){
  const tile=layout.tileMap.tiles[row][col];if(tile!==TileType.VOID)matter++;if(tile===TileType.WALL)solid++;
  if(tile===TileType.FLOOR&&bodyHasSupport(grid,{x:(col+.5)*8,y:(row+.5)*8},10,10)){supported++;seats[row*grid.cols+col]=1;}
 }
 const visited=new Uint8Array(seats.length),startCell=Math.floor(layout.spawnPoint.y/8)*grid.cols+Math.floor(layout.spawnPoint.x/8),queue=[startCell];visited[startCell]=1;
 for(let at=0;at<queue.length;at++){
  const cell=queue[at],x=cell%grid.cols,y=Math.floor(cell/grid.cols);
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const col=x+dx,row=y+dy,next=row*grid.cols+col;
   if(col<0||row<0||col>=grid.cols||row>=grid.rows||!seats[next]||visited[next]
    ||bodyDisplacementFraction(grid,{x:(x+.5)*8,y:(y+.5)*8},10,10,dx*8,dy*8)<1)continue;
   visited[next]=1;queue.push(next);
  }
 }
 assert.equal(world.metadata.reachableBodySeats,queue.length,'independent swept-body reachability');
 const fill=matter/(grid.cols*grid.rows),solidRatio=solid/matter,reach=world.metadata.reachableBodySeats/supported;
 if(recipe.spatialPolicy.organizationRules.sourceMode==='repeat')assert(fill<=.76&&fill>=.5,`terrain fill ${fill}`);
 // Source-once groups retain their authored negative space. Coast fill is
 // diagnostic: carving through that group to hit a ratio destroys its layout.
 // Hollow shells and a unique landmark must not become solid slabs to satisfy
 // a footprint percentage. Verify their actual two-sided detours instead.
 const obstruction=measureRouteObstructions(world,recipe);
 assert.equal(obstruction.status,'passed',`Only ${obstruction.groupsFound} meaningful two-sided obstruction groups`);
 assert(reach>=.97,`reachable supported fraction ${reach}`);
 const straight=Math.hypot(layout.spawnPoint.x-layout.extractionPoint.position.x,layout.spawnPoint.y-layout.extractionPoint.position.y);
 assert(straight>=560);assert(world.metadata.extractionRoutePx>=920);
 const selection=native.diagnostics.spatial.extraction;
 assert(selection.interactionPathDistancePx>=recipe.spatialPolicy.extraction.minPathDistancePx);
 assert.deepEqual(selection.point,layout.extractionPoint.position,'chosen extraction must survive final deployment');
 const expedition=native.diagnostics.expedition;assert(expedition);
 assert.equal(expedition.patrolWindows.length,layout.kindlingNodes.filter(x=>x.tier!=='safe').length+layout.contaminantNodes.filter(x=>x.tier!=='safe').length);
 for(const window of expedition.patrolWindows){assert(window.durationMs>=2400);assert(visited[Math.floor(window.seat.y/8)*grid.cols+Math.floor(window.seat.x/8)],'search window must be reachable from spawn');}
 for(const node of expedition.nodes)assert(node.minimumExtraTravelPx<=recipe.spatialPolicy.deployment.deep_max_extra_travel_px+1e-6);
 assert.equal(JSON.stringify(recipe),frozen,'mutable frozen recipe');
 const corrupt=structuredClone(recipe);corrupt.spatialPolicy.extraction.minPathDistancePx+=8;assert(!validR100ProductionRecipe(corrupt),'tampered frozen spatial policy must reject');
 const identity=generatedRiftIdentity(layout,recipe,world);
 if(recovery){const wire=executeRiftGeneration({kind:'departure',generation:JSON.parse(frozen)});const hydrated=hydrateRiftGeneration(structuredClone(wire));assert.equal(generatedRiftIdentity(hydrated.layout,recipe,hydrated.world).signature,identity.signature);}
 const row={world:id,grade,requestedSeed:seed,effectiveSeed:layout.seed,attempts:world.metadata.attempt+1,generationMs:performance.now()-start,signature:identity.signature,recipeBytes:frozen.length,spawn:layout.spawnPoint,extraction:layout.extractionPoint.position,extractionStraightPx:straight,extractionRoutePx:world.metadata.extractionRoutePx,terrainFill:fill,solidRatio,reachableFraction:reach,reachableSeats:world.metadata.reachableBodySeats,instances:native.definition.instances.length,patrolSegments,spatial:native.diagnostics.spatial??null,expedition,obstruction};
 report.cases.push(row);console.log(`PASS ${id}/${grade}: ${(row.generationMs/1000).toFixed(2)}s attempts=${row.attempts} solid=${solidRatio.toFixed(3)} reachable=${reach.toFixed(4)}`);
 }catch(error){const failure={world:id,grade,error:String(error.stack??error),elapsedMs:performance.now()-start};report.failures.push(failure);console.log(`FAIL ${id}/${grade}: ${error.message}`);}
 save();global.gc?.();
}
report.status=report.failures.length?'failed':'passed';report.finishedAt=new Date().toISOString();save();
if(report.failures.length)process.exitCode=1;
