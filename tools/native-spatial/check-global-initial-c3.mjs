/** One frozen c3 all-object reinitialization. No fresh sampling or retries. */
import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createR100NativeSpatialDevelopmentRecipe} from '../../src/generation/world-study/r100-package.ts';
import {reinitializeNativeSpatialLayout} from '../../src/generation/world-study/native-spatial-layout.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {nativeSpatialGeometryFingerprint,createNativeSpatialGeometryWorkBudget} from '../../src/generation/world-study/native-spatial-generation.ts';

const out=process.argv[2];assert(out&&!fs.existsSync(out),'Supply a NEW directory');fs.mkdirSync(out,{recursive:true});
const source='docs/qa/artifacts/native-spatial-2026-10-14/initial-c3-qualified-round1/proposal.json',prior='docs/qa/artifacts/native-spatial-2026-10-14/initial-c3-qualified-round1/report.json';
const saved=JSON.parse(fs.readFileSync(source,'utf8')),old=JSON.parse(fs.readFileSync(prior,'utf8')),input=saved.input,seed=20261012;
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(dir+'/'+e.name):[dir+'/'+e.name]);
const snapshot=()=>Object.fromEntries([...walk('src').filter(p=>/\.(ts|tsx|js|json)$/.test(p)),...walk('data').filter(p=>p.endsWith('.csv')),source,prior,'tools/native-spatial/check-global-initial-c3.mjs'].sort().map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceHashes=snapshot(),savedBefore=JSON.stringify(saved),native=createR100NativeSpatialDevelopmentRecipe('gel-rafts',seed,'medium').nativeDefinition;
const attempt={geometrySeed:seed,proposalBudget:72,layoutProposals:1,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
const start=performance.now(),checkpoint=()=>{if(performance.now()-start>60000){attempt.stopReason='deadline';throw new Error('Fixed initial assignment exceeded its 60 second deadline');}},budget=createNativeSpatialGeometryWorkBudget(attempt,input.policy.maxGeometryEvaluations,checkpoint);
const result={scope:'One frozen c3 complete L/B/15 objects/edge seed, new global initializer once; not a fresh request or production admission.',sourceHashes,before:{hash:old.geometryHash,gate:saved.gate},input,work:attempt};let proposal,gate;
const withoutSite=o=>{const {site,...shape}=o;return shape;};
try{budget.run({kind:'final-geometry',candidate:3},()=>{
  proposal=reinitializeNativeSpatialLayout(native,input,seed,seed,saved.proposal,budget);result.proposalMs=performance.now()-start;result.initialPlacement=proposal.plan.initialPlacement;
  assert.deepEqual(proposal.plan.land,saved.proposal.plan.land);assert.deepEqual(proposal.plan.landPlates,saved.proposal.plan.landPlates);assert.deepEqual(proposal.bays,saved.proposal.bays);assert.deepEqual(proposal.landJoins,saved.proposal.landJoins);
  assert.equal(proposal.layoutSeed,saved.proposal.layoutSeed);assert.equal(proposal.fragmentShape.seedSalt,saved.proposal.fragmentShape.seedSalt);assert.equal(proposal.fragmentShape.edgeSeed,saved.proposal.fragmentShape.edgeSeed);assert.deepEqual(proposal.requestedCounts,{holes:10,solids:5});assert.equal(proposal.plan.objects.length,15);
  assert.deepEqual(proposal.plan.objects.map(withoutSite),saved.proposal.plan.objects.map(withoutSite));assert.equal(JSON.stringify(saved),savedBefore);result.fixedInputsPreserved=true;
  result.moves=proposal.plan.objects.map((o,index)=>({index,kind:o.kind,before:saved.proposal.plan.objects[index].site,after:o.site}));
  attempt.finalGeometryEvaluations++;const measuredAt=performance.now(),geometry=buildNativeSpatialGeometry(proposal.definition,seed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);
  gate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
  result.geometryGateMs=performance.now()-measuredAt;result.after={hash:nativeSpatialGeometryFingerprint(geometry,proposal).hash,gate};
  fs.writeFileSync(out+'/proposal.json',JSON.stringify({input,proposal,gate},null,2)+'\n');return{accepted:gate.accepted,reasons:gate.reasons};
});}catch(error){result.error=String(error.stack??error);if(error.initialPlacement)result.initialPlacement=error.initialPlacement;if(error.qualification)result.qualification=error.qualification;}
result.totalMs=performance.now()-start;result.sourceHashesAfter=snapshot();result.sourcesStable=JSON.stringify(sourceHashes)===JSON.stringify(result.sourceHashesAfter);
fs.writeFileSync(out+'/report.json',JSON.stringify(result,null,2)+'\n');assert(result.sourcesStable);
console.log(JSON.stringify({sourcesStable:result.sourcesStable,totalMs:result.totalMs,error:result.error,initialStatus:result.initialPlacement?.status,counts:result.initialPlacement?.counts,timings:result.initialPlacement?.timings,domains:result.initialPlacement?.domains.map(d=>({id:d.id,count:d.count})),work:{total:attempt.geometryEvaluations,final:attempt.finalGeometryEvaluations,steps:attempt.geometryWork},after:gate?{hash:result.after.hash,reasons:gate.reasons,holes:gate.metrics.holes,solids:gate.metrics.solids,max:gate.metrics.maxEmptyUpperPx,deep:gate.metrics.maxDeepSpanPx,wide:gate.metrics.wideRatio,largest:gate.metrics.largestWideRatio,holeIdentityViolations:gate.metrics.holeProfileViolationCount,supportViolations:gate.metrics.finalSourceSupportViolationCount}:null},null,2));
