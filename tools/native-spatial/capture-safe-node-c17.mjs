/** Fixed historical chain only. Captures before assertions and preserves rejection. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {serialize} from 'node:v8';
import {gzipSync} from 'node:zlib';
import {build} from 'esbuild';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply NEW_DIRECTORY');fs.mkdirSync(output,{recursive:true});
const receipt='docs/qa/artifacts/native-spatial-2026-10-14/production-gel-qualified-front-round1.json';
const original=JSON.parse(fs.readFileSync(receipt)).failures[0],recipe=original.recipe,input=recipe.nativeSpatial,seed=recipe.requestedSeed;
const oldAttempt=original.diagnostics.attempts[0],chain=[9,16,17],prior=new Map(oldAttempt.candidates.map(c=>[c.candidate,c]));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const files=[...walk('src'),...walk('data'),receipt,'tools/native-spatial/capture-safe-node-c17.mjs','package.json','package-lock.json','tools/contam-preview/tsconfig.json','tools/contam-preview/phaser-stub.ts'];
const snapshot=()=>Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report={status:'preparing',scope:'One historical c9 → c16 → c17 chain, same frozen recipe and recorded hashes. No fresh search or alternate seed. One full candidate, shared 72-work / 60-second bounds. Failure evidence capture, not production admission.',sourceHashes:snapshot(),chain,stages:[],captures:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const normalize=value=>JSON.parse(JSON.stringify(value));
function persistRuntime(value,name){
  const seen=new WeakMap(),omittedFunctions=[];
  function copy(v,p='root'){
    if(typeof v==='function'){omittedFunctions.push(p);return undefined;}
    if(v===null||typeof v!=='object')return v;if(seen.has(v))return seen.get(v);
    if(ArrayBuffer.isView(v))return v.slice();
    if(v instanceof Map){const out=new Map();seen.set(v,out);for(const[k,item]of v)out.set(k,copy(item,`${p}.${k}`));return out;}
    if(v instanceof Set){const out=new Set();seen.set(v,out);for(const item of v)out.add(copy(item,p));return out;}
    const out=Array.isArray(v)?[]:{};seen.set(v,out);for(const[k,item]of Object.entries(v))if(typeof item!=='function')out[k]=copy(item,`${p}.${k}`);else omittedFunctions.push(`${p}.${k}`);return out;
  }
  fs.writeFileSync(path.join(output,name),gzipSync(serialize(copy(value))));
  report.captures.push({file:name,bytes:fs.statSync(path.join(output,name)).size,omittedFunctions});save();
}
let started;
try{
  const moduleRoot=path.resolve('src/generation/world-study'),entry=`
export {validR100ProductionRecipe} from '${moduleRoot}/r100-package.ts';
export {completeNativeSpatialCandidate} from '${moduleRoot}/r100-production-map.ts';
export {createNativeSpatialLayout} from '${moduleRoot}/native-spatial-layout.ts';
export {buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback} from '${moduleRoot}/native-spatial-geometry.ts';
export {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '${moduleRoot}/native-spatial-measure.ts';
export {evaluateNativeSpatialVisibility} from '${moduleRoot}/native-spatial-visibility.ts';
export {nativeSpatialGeometryFingerprint,createNativeSpatialGeometryWorkBudget} from '${moduleRoot}/native-spatial-generation.ts';`;
  const bundlePath=path.resolve(output,'capture.mjs');
  await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'ts'},outfile:bundlePath,bundle:true,platform:'node',format:'esm',target:'node22',tsconfig:'tools/contam-preview/tsconfig.json',alias:{phaser:path.resolve('tools/contam-preview/phaser-stub.ts')},logLevel:'silent',plugins:[{name:'capture-before-deployment',setup(b){b.onLoad({filter:/[\\/]r100-production-map\.ts$/},args=>{
    let contents=fs.readFileSync(args.path,'utf8');const needle='    const deployed=deployR100Expedition(master,recipe.contentDefinition,recipe.searchSitePolicy),layout=deployed.layout;';assert.equal(contents.split(needle).length,2);
    contents=contents.replace(needle,'    globalThis.__safeNodeCapture({candidate,master,extraction,summary,recipe});\n'+needle);return{contents,loader:'ts'};
  });}}]});
  const api=await import(pathToFileURL(bundlePath).href);assert(api.validR100ProductionRecipe(recipe));assert.equal(seed,20261012);assert.equal(input.policy.maxGeometryEvaluations,72);assert.equal(input.policy.maxFullCandidates,2);
  fs.writeFileSync(path.join(output,'recipe.json'),JSON.stringify(recipe)+'\n');
  const attempt={geometrySeed:seed,proposalBudget:72,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'},attempts=[attempt],rejected=[];
  report.attempts=attempts;report.rejected=rejected;started=performance.now();
  const checkpoint=()=>{if(performance.now()-started>=60000){attempt.stopReason='deadline';throw new Error('Fixed c17 capture exceeded shared 60 second deadline');}};
  const work=api.createNativeSpatialGeometryWorkBudget(attempt,72,checkpoint);let previous,last;
  for(const id of chain){
    const old=prior.get(id);attempt.layoutProposals++;
    const measured=work.run({kind:'final-geometry',candidate:id},()=>{
      const layout=api.createNativeSpatialLayout(recipe.nativeDefinition,input,seed,seed,id,previous?{...previous,allowJoint:old.jointAllowed}:undefined,old.countPairIndex,old.bayCountIndex,work);
      fs.writeFileSync(path.join(output,`proposal-${id}.json`),JSON.stringify({input,proposal:layout})+'\n');checkpoint();attempt.finalGeometryEvaluations++;
      const geometry=api.buildNativeSpatialGeometry(layout.definition,seed),groups=api.identifyNativeSpatialStructures(geometry,layout.assemblies,input.policy),fingerprint=api.nativeSpatialGeometryFingerprint(geometry,layout);
      const gate=api.evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:layout.holes,profiles:input.holeProfiles},{landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
      const actualVoid=api.createNativeSpatialActualVoidFeedback(geometry,groups,layout.holes);
      report.stages.push({candidate:id,hash:fingerprint.hash,gate,actualVoidAvailable:!!actualVoid.feedback});save();
      if(id===17)persistRuntime({layout,geometry,groups,gate,recipe},'geometry-c17.v8.gz');
      assert.equal(fingerprint.hash,old.geometryHash,`Candidate ${id} changed geometry`);assert.deepEqual(normalize(gate),old.gates.geometry,`Candidate ${id} changed actual gate`);assert(actualVoid.feedback,actualVoid.reason);
      return{accepted:gate.accepted,reasons:gate.reasons,layout,geometry,groups,gate,actualVoid:actualVoid.feedback,fingerprint};
    });
    previous={layout:measured.layout,gate:measured.gate,actualVoid:measured.actualVoid};last=measured;
  }
  const gates={geometry:last.gate,visibility:api.evaluateNativeSpatialVisibility(last.geometry,last.groups.structures,input.policy)};report.gates=gates;save();assert.deepEqual(normalize(gates),prior.get(17).gates);
  const trace={...prior.get(17),gates};attempt.candidates.push(trace);
  let captures=0;
  globalThis.__safeNodeCapture=value=>{captures++;persistRuntime(value,'pre-deployment-c17.v8.gz');assert.equal(captures,1);assert.deepEqual(normalize(value.master.diagnostics),oldAttempt.deploymentRejections[0].diagnostics.master);};
  const result=api.completeNativeSpatialCandidate(recipe,{layout:last.layout,geometry:last.geometry,groups:last.groups,trace},{attempt:0,trace:attempt,attempts,rejected,checkpoint});
  report.result=result;save();assert.equal(captures,1);assert.equal(result.accepted,false);assert.equal(attempt.fullCandidates,1);
  const rejection=attempt.deploymentRejections[0];assert.equal(rejection.stage,'deployment');assert.equal(rejection.reason,oldAttempt.deploymentRejections[0].reason);
  assert(rejection.diagnostics.error.nodePlacement);fs.writeFileSync(path.join(output,'node-placement-failure.json'),JSON.stringify(rejection.diagnostics.error.nodePlacement,null,2)+'\n');
  report.status='captured-original-deployment-rejection';checkpoint();
}catch(error){report.status='failed';report.error=String(error.stack??error);if(error.diagnostics)report.errorDiagnostics=error.diagnostics;}
finally{delete globalThis.__safeNodeCapture;}
report.elapsedMs=started===undefined?null:performance.now()-started;report.sourceHashesAfter=snapshot();report.sourcesStable=JSON.stringify(report.sourceHashes)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,elapsedMs:report.elapsedMs,work:report.attempts?.[0].geometryEvaluations,full:report.attempts?.[0].fullCandidates,stages:report.stages.map(s=>({candidate:s.candidate,hash:s.hash,reasons:s.gate.reasons})),error:report.error}));
if(report.status!=='captured-original-deployment-rejection')process.exitCode=1;
