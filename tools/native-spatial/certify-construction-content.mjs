/** Bounded offline certification. Actual complete deployment and G4 only;
 * no gate relaxation, fabricated map, or successful-seed inference. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {createR100DirectConstructionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {createNativeConstructionCandidate} from '../../src/generation/world-study/native-construction-generation.ts';
import {nativeConstructionContentIdentity} from '../../src/generation/world-study/native-construction-recipe.ts';
import {completeNativeSpatialCandidate} from '../../src/generation/world-study/r100-production-map.ts';
import {mix32} from '../../src/generation/seed-fork.ts';
import {NATIVE_CONSTRUCTION_REGISTRATIONS} from '../../src/generated/r100-native-construction.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Usage: certify-construction-content.mjs NEW_OUTPUT');fs.mkdirSync(output,{recursive:true});
const files=['src/generation/world-study/r100-package.ts','src/generation/world-study/r100-production-map.ts','src/generation/world-study/r100-master-world.ts','src/generation/world-study/r100-expedition.ts','src/generation/world-study/r100-pollution.ts','src/generation/world-study/native-construction-recipe.ts','src/generated/r100-native-construction.ts','src/generated/r100-enemy-deployment.ts'];
const hashes=()=>Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const report={status:'running',scope:'Actual geometry and complete content/G4 certification. Intermediate maps are not recoverable production recipes until the bank is compiled and final recipe/cold checks pass.',sourcesBefore:hashes(),cases:[]};
const resumeIndex=process.argv.indexOf('--resume');
if(resumeIndex>=0){const previousPath=path.join(process.argv[resumeIndex+1],'report.json'),previous=JSON.parse(fs.readFileSync(previousPath,'utf8'));assert.deepEqual(previous.sourcesBefore,report.sourcesBefore,'Cannot resume certification after source changes');report.cases=previous.cases.map((row,caseIndex)=>({...row,attempts:row.attempts.map(({trace,...attempt},attemptIndex)=>({...attempt,receipt:trace?{report:previousPath,caseIndex,attemptIndex}:attempt.receipt}))}));report.resumedFrom=process.argv[resumeIndex+1];}
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const bank=report.cases.flatMap(row=>row.accepted);
try{
  for(const {worldId}of NATIVE_CONSTRUCTION_REGISTRATIONS)for(const grade of ['low','medium','severe']){
    const previous=report.cases.find(row=>row.worldId===worldId&&row.grade===grade);if(previous?.accepted.length===2)continue;
    const start=performance.now(),recipe=createR100DirectConstructionRecipe(worldId,20261012,grade),identity=nativeConstructionContentIdentity(recipe);
    const checkpoint=()=>assert(performance.now()-start<60000,`Certification deadline ${worldId}/${grade}`);
    const trace={geometrySeed:recipe.nativeConstruction.geometrySeed,proposalBudget:1,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
    const candidate=createNativeConstructionCandidate(recipe,trace,checkpoint);assert(candidate.trace.accepted,`${worldId}: ${candidate.trace.reasons}`);
    const row=previous??{worldId,grade,identity,attempts:[],accepted:[]};assert.equal(row.identity,identity);if(!previous)report.cases.push(row);save();
    const seeds=[...new Set([20261012,42,...Array.from({length:7},(_,i)=>mix32(20261012,`r100-direct-content-v1-${i+1}`)),...Array.from({length:7},(_,i)=>mix32(42,`r100-direct-content-v1-${i+1}`))])].slice(0,16);
    for(const seed of seeds){
      if(row.attempts.some(attempt=>attempt.seed===seed))continue;
      checkpoint();const current={...trace,fullCandidates:0,candidates:[candidate.trace],deploymentRejections:[],stopReason:'searching'},rejected=[];
      const result=completeNativeSpatialCandidate(recipe,candidate,{attempt:0,trace:current,attempts:[current],rejected,checkpoint,contentSeed:seed,contentSeedSource:'certification'});
      // Keep each full receipt once. Rewriting all preceding route arrays on
      // every attempt would turn evidence collection into generation latency.
      const receipt=`${worldId}-${grade}-${seed}.attempt.json`;
      fs.writeFileSync(path.join(output,receipt),JSON.stringify({seed,accepted:result.accepted,rejected,trace:current},null,2)+'\n');
      row.attempts.push({seed,accepted:result.accepted,rejected,receipt});
      if(result.accepted){
        const map=result.map,exit=map.layout.extractionPoint.position;assert.equal(map.metadata.effectiveSeed,seed);
        if(!row.accepted.some(previous=>previous.x===exit.x&&previous.y===exit.y)){
          const entry={worldId,grade,seed,x:exit.x,y:exit.y,identity};row.accepted.push(entry);bank.push(entry);
          fs.writeFileSync(path.join(output,`${worldId}-${grade}-${seed}.map.v8.gz`),gzipSync(serialize(map)));
        }
      }
      save();if(row.accepted.length===2)break;
    }
    row.elapsedMs=performance.now()-start;assert.equal(row.accepted.length,2,`No two different complete exits after 16 content seeds: ${worldId}/${grade}`);
    console.log(JSON.stringify({worldId,grade,attempts:row.attempts.length,accepted:row.accepted,elapsedMs:row.elapsedMs}));save();
  }
  report.sourcesAfter=hashes();assert.deepEqual(report.sourcesAfter,report.sourcesBefore,'Source changed during certification');
  const csv='world_id,grade,content_seed,exit_x,exit_y,content_identity\n'+bank.map(r=>[r.worldId,r.grade,r.seed,r.x,r.y,r.identity].join(',')).join('\n')+'\n';
  fs.writeFileSync(path.join(output,'content-seeds.csv'),csv);fs.writeFileSync('data/rift-native-construction-content-seeds.csv',csv);report.status='passed';
}catch(error){report.status='failed';report.error=String(error.stack??error);process.exitCode=1;}
save();console.log(JSON.stringify({status:report.status,error:report.error,output}));
