/** Complete native-joint admissions. Preserve failed attempts and immutable source receipts. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {createR100NativeSpatialDevelopmentRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createR100ProductionMap} from '../../src/generation/world-study/r100-production-map.ts';
import {hydrateR100MasterWorld} from '../../src/generation/world-study/r100-native-data.ts';
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision.ts';
import {exactHash} from '../stealth-obstacles/baseline.mjs';

const worlds=(process.env.QA_WORLDS??'split-rib-causeway,gel-rafts,sloughed-court,ash-strata,black-lacuna').split(',');
assert(worlds.length<=5,'Review batches contain at most five worlds');
const seeds=(process.env.QA_SEEDS??'20261012').split(',').map(Number);
const grades=(process.env.QA_GRADES??'medium').split(',');
const output=process.argv[2];assert(output,'Usage: capture-production.mjs NEW_RECEIPT.json');
assert(!fs.existsSync(output),'Never overwrite a failed or completed receipt');
const cache=process.env.QA_CACHE??`/tmp/coh-native-spatial-${Date.now()}`;
assert(!fs.existsSync(cache),'Use a fresh cache directory');fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(path.dirname(output),{recursive:true});
// Include transitive generation dependencies, not only the newly edited solver:
// master-world, deployment, generated registries and frozen recovery all affect
// a complete result. Documentation/art review edits are deliberately outside it.
function sourceFiles(directory,accept){return fs.readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
  const file=path.join(directory,entry.name);return entry.isDirectory()?sourceFiles(file,accept):accept(file)?[file]:[];
});}
const sources=()=>['tools/native-spatial/capture-production.mjs',...sourceFiles('src',file=>/\.(?:[cm]?[jt]sx?|json)$/.test(file)),...sourceFiles('data',file=>file.endsWith('.csv'))].sort();
const hashes=()=>Object.fromEntries(sources().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report={status:'running',startedAt:new Date().toISOString(),node:process.version,scope:{worlds,seeds,grades,replay:process.env.QA_REPLAY==='1'},sourceHashes:hashes(),cases:[],failures:[],limits:['Stated worlds/seeds/grades only; not a gameplay or all-library approval.','Generation time is offline CPU time, not browser FPS.']};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');save();
for(const worldId of worlds)for(const requestedSeed of seeds)for(const grade of grades){
  const start=performance.now();let recipe,capturedMap;
  try{
    recipe=createR100NativeSpatialDevelopmentRecipe(worldId,requestedSeed,grade);
    assert.equal(recipe.package.algorithmRevision,12,'This test must exercise the new revision');assert(validR100ProductionRecipe(recipe));
    const frozen=JSON.stringify(recipe),map=createR100ProductionMap(recipe),elapsedMs=performance.now()-start;
    // Preserve the exact returned map before independent assertions/replay.
    // A later validation failure remains a failed row, never an accepted case.
    const cacheBase=path.join(cache,`${worldId}-${grade}-${requestedSeed}`),mapHash=exactHash(map);
    fs.writeFileSync(`${cacheBase}.recipe.json`,frozen+'\n');
    fs.writeFileSync(`${cacheBase}.map.v8.gz`,gzipSync(serialize(map)));
    capturedMap={cacheBase,mapHash,generationMs:elapsedMs};
    assert.equal(JSON.stringify(recipe),frozen,'Generation mutated frozen input');assert.equal(map.native.algorithmRevision,12);
    const {layout}=map, budget=recipe.contentDefinition;
    assert.equal(layout.enemySpawns.length,budget.enemy_count);
    assert.equal(layout.kindlingNodes.reduce((n,row)=>n+row.value,0),{low:9,medium:13,severe:17}[grade]);
    assert.equal(layout.contaminantNodes.length,{low:2,medium:3,severe:4}[grade]);
    const native=hydrateR100MasterWorld(map.native,layout),body=new NativeBodyCollision(native,layout.tileMap);
    for(const point of [layout.spawnPoint,layout.extractionPoint.position,...layout.kindlingNodes.map(n=>n.position),...layout.contaminantNodes.map(n=>n.position)])assert(body.supports(point,10,10),'Final landmark must support the real body');
    let patrolSegments=0;
    for(const enemy of layout.enemySpawns)for(let i=1;i<enemy.patrol.waypoints.length;i++){
      const a=enemy.patrol.waypoints[i-1],b=enemy.patrol.waypoints[i],q={x:(a.col+.5)*8,y:(a.row+.5)*8};
      assert.equal(body.displacementFraction(q,10,10,(b.col-a.col)*8,(b.row-a.row)*8),1,'Real patrol sweep');patrolSegments++;
    }
    assert(Math.hypot(layout.spawnPoint.x-layout.extractionPoint.position.x,layout.spawnPoint.y-layout.extractionPoint.position.y)>=560);
    let replayMs=null;
    if(report.scope.replay){const before=performance.now();assert.equal(exactHash(createR100ProductionMap(JSON.parse(frozen))),mapHash,'Frozen recipe must exactly reproduce the complete map');replayMs=performance.now()-before;}
    const row={worldId,grade,requestedSeed,effectiveSeed:map.metadata.effectiveSeed,generationMs:elapsedMs,replayMs,mapHash,cacheBase,recipeBytes:Buffer.byteLength(frozen),metadata:map.metadata,diagnostics:map.native.diagnostics,patrolSegments};
    report.cases.push(row);console.log(`PASS ${worldId}/${grade}/${requestedSeed}: ${(elapsedMs/1000).toFixed(2)}s`);
  }catch(error){const failure={worldId,grade,requestedSeed,elapsedMs:performance.now()-start,error:String(error.stack??error),diagnostics:error.diagnostics??null,recipe:recipe??null,...(capturedMap?{capturedMap}: {})};report.failures.push(failure);console.log(`FAIL ${worldId}/${grade}/${requestedSeed}: ${error.message}`);}
  save();global.gc?.();
}
report.sourceHashesAfter=hashes();
report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);
report.status=report.failures.length||!report.sourcesStable?'failed':'passed';report.finishedAt=new Date().toISOString();save();
if(report.status!=='passed')process.exitCode=1;
