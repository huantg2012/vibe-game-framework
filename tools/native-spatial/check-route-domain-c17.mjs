/** Saved c17 whole-footprint legality only: no candidate/map compilation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {deserialize} from 'node:v8';
import {gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply NEW_DIRECTORY');fs.mkdirSync(output,{recursive:true});
const snapshot='docs/qa/artifacts/native-spatial-2026-10-14/extra-travel-c17-round1/complete-runtime.v8.gz',receipt='docs/qa/artifacts/native-spatial-2026-10-14/production-gel-extra-travel-round1.json';
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const files=[...walk('src'),...walk('data'),snapshot,receipt,'tools/native-spatial/check-route-domain-c17.mjs'];
const hashes=()=>Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report={status:'running',scope:'One saved actual c17 plan, restored exact local model footprints. Enumerate the new finite domain once under a shared 48 legality-check budget; no map compilation, actual gate, route search, deployment, or fresh sampling.',sourceHashes:hashes(),operations:{savedSnapshotReads:1,geometryCompiles:0,gateEvaluations:0,routeSearches:0,freshRequests:0}};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
try{
  const root=path.resolve('src/generation/world-study'),bundle=path.resolve(output,'check.mjs');
  await build({stdin:{contents:`export {planningObject} from '${root}/native-spatial-layout.ts'; export {createNativeSpatialPlanningGround} from '${root}/native-spatial-bay-layout.ts'; export {selectNativeSpatialRoutePlacement} from '${root}/native-spatial-route-layout.ts';`,resolveDir:process.cwd(),loader:'ts'},outfile:bundle,bundle:true,platform:'node',format:'esm',target:'node22',tsconfig:'tools/contam-preview/tsconfig.json',alias:{phaser:path.resolve('tools/contam-preview/phaser-stub.ts')},logLevel:'silent',plugins:[{name:'read-only-local-footprints',setup(b){b.onLoad({filter:/[\\/]native-spatial-layout\.ts$/},args=>({contents:fs.readFileSync(args.path,'utf8')+'\nexport {planningObject};',loader:'ts'}));}}]});
  const api=await import(pathToFileURL(bundle).href),saved=deserialize(gunzipSync(fs.readFileSync(snapshot))),formal=JSON.parse(fs.readFileSync(receipt));
  assert.equal(saved.candidate.trace.geometryHash,'a2d4a4c15a186ba9');assert(saved.feedback.comparable);assert(!saved.feedback.gate.accepted);
  const original=formal.failures[0].diagnostics.attempts[0],oldCandidate=original.candidates.find(c=>c.candidate===17);assert.equal(oldCandidate.geometryHash,saved.candidate.trace.geometryHash);
  report.original={geometryHash:oldCandidate.geometryHash,epoch:original.routeEpochs[0],g4Reasons:saved.gate.reasons};
  const layout=saved.candidate.layout,policy=saved.recipe.nativeSpatial.policy,ground=api.createNativeSpatialPlanningGround(layout.plan.land,layout.plan.bays.flatMap(b=>b.rects));let holeIndex=0;
  const objects=layout.plan.objects.map(source=>{const p=api.planningObject(source,layout.definition,saved.candidate.trace.geometrySeed),reliefIds=new Set(source.instances.filter(i=>i.role==='relief').map(i=>i.id));return{id:source.kind==='hole'?`hole-${holeIndex++}`:source.assembly.assemblyId,kind:source.kind,site:source.site,support:p.support,blocking:p.blocking,relief:p.support.filter(p=>reliefIds.has(p.objectId))};});
  const before=JSON.stringify(objects),started=performance.now(),checkpoint=()=>{if(performance.now()-started>60000)throw new Error('Saved-domain diagnostic deadline');};
  let cursor=0,remaining=48,seen=[];const steps=[];
  while(remaining>0){checkpoint();const trace=api.selectNativeSpatialRoutePlacement({objects,ground,policy,feedback:{...saved.feedback,refinementOrdinal:cursor,remainingTupleBudget:remaining,seenTupleKeys:seen},checkpoint});
    assert(trace.consumedTuples<=remaining);assert.deepEqual(trace.seenTupleKeys.slice(0,seen.length),seen);assert.equal(trace.consumedTuples,trace.seenTupleKeys.length-seen.length);
    steps.push(trace);remaining-=trace.consumedTuples;cursor=trace.nextOrdinal;seen=trace.seenTupleKeys;
    report.steps=steps;report.consumedTuples=48-remaining;save();if(trace.exhausted)break;
  }
  const trials=steps.flatMap(s=>s.trials),legal=trials.filter(t=>!t.reasons.length);assert.equal(JSON.stringify(objects),before);
  report.elapsedMs=performance.now()-started;report.candidateCount=steps[0]?.candidateCount??0;report.legalCount=legal.length;report.firstLegal=legal[0]??null;
  report.objectExposure=Object.fromEntries(objects.map(o=>[o.id,trials.filter(t=>t.objectIds.includes(o.id)).length]));
  report.selectionParameters={sourceCandidate:17,geometrySeed:saved.candidate.trace.geometrySeed,layoutSeed:saved.candidate.trace.layoutSeed,initialFeedback:{refinementOrdinal:0,remainingTupleBudget:48,seenTupleKeys:[]}};
  report.status=legal.length?'legal-tuples-found-not-admitted':'all-tuples-rejected';
}catch(error){report.status='failed';report.error=String(error.stack??error);if(error.routeRefinement)report.partial=error.routeRefinement;}
finally{report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();}
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,candidateCount:report.candidateCount,consumedTuples:report.consumedTuples,legalCount:report.legalCount,firstLegal:report.firstLegal,elapsedMs:report.elapsedMs,error:report.error},null,2));
if(report.status!=='legal-tuples-found-not-admitted')process.exitCode=1;
