/** Guard/budget/deadline fixtures only. Never creates native map geometry. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {createR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {completeNativeSpatialCandidate} from '../../src/generation/world-study/r100-production-map.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW receipt path');
const files=['src/generation/world-study/r100-production-map.ts','tools/native-spatial/check-complete-candidate-logic.mjs'];
const snapshot=()=>Object.fromEntries(files.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=snapshot(),cases=[],recipe=createR100ProductionRecipe('gel-rafts',20261012,'medium');
assert.equal(recipe.package.algorithmRevision,12);
const frozenRecipe=JSON.stringify(recipe);
function fixture(){
  const pass={accepted:true,reasons:[],metrics:{}},trace={geometrySeed:recipe.requestedSeed,proposalBudget:72,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
  // Lazy trap: no test is allowed to reach extraction or create real geometry.
  const candidate={layout:{candidate:28},trace:{candidate:28,geometrySeed:recipe.requestedSeed,accepted:true,gates:{geometry:pass,visibility:pass}},get geometry(){throw new Error('FIXTURE FORBIDS GEOMETRY');}};
  return{candidate,context:{attempt:0,trace,attempts:[trace],rejected:[],checkpoint:()=>{throw Object.assign(new Error('fixture-before-extraction'),{diagnostics:{fixture:true}});}}};
}
function check(id,run){try{cases.push({id,passed:true,...run()});}catch(error){cases.push({id,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify(cases.at(-1)));}
check('all-measured-admission-gates-required-before-full-slot',()=>{
  for(const field of ['accepted','geometry','visibility']){
    const {candidate,context}=fixture();
    if(field==='accepted')candidate.trace.accepted=false;else candidate.trace.gates[field]={accepted:false,reasons:['fixture-rejection'],metrics:{}};
    assert.throws(()=>completeNativeSpatialCandidate(recipe,candidate,context),/requires measured G1\/G2\/G3 admission/);
    assert.equal(context.trace.fullCandidates,0);assert.equal(context.trace.deploymentRejections.length,0);
  }
  return{rejectedMissingAdmission:3,actualGeometryCalls:0};
});
check('candidate-and-attempt-identities-cannot-be-mixed',()=>{
  for(const field of ['seed','candidate','attempt']){
    const {candidate,context}=fixture();
    if(field==='seed')candidate.trace.geometrySeed++;else if(field==='candidate')candidate.trace.candidate++;else context.attempt=1;
    assert.throws(()=>completeNativeSpatialCandidate(recipe,candidate,context),/does not belong/);assert.equal(context.trace.fullCandidates,0);
  }
  return{mismatchesRejected:3};
});
check('extraction-failure-spends-full-slot-and-keeps-diagnostics',()=>{
  const {candidate,context}=fixture(),result=completeNativeSpatialCandidate(recipe,candidate,context);
  assert.equal(result.accepted,false);assert.equal(context.trace.fullCandidates,1);
  assert.equal(context.trace.deploymentRejections[0].stage,'extraction');
  assert.deepEqual(context.trace.deploymentRejections[0].diagnostics.error,{fixture:true});
  assert.equal(context.rejected[0].seed,recipe.requestedSeed);
  assert.deepEqual(result.feedback,{accepted:false,reasons:['fixture-before-extraction'],metrics:{deploymentFailure:'fixture-before-extraction'}});
  return{spent:1,rejectionStage:'extraction',errorDiagnosticsRetained:true};
});
check('full-budget-stops-before-a-third-extraction',()=>{
  const {candidate,context}=fixture();
  for(let i=0;i<recipe.nativeSpatial.policy.maxFullCandidates;i++)assert.equal(completeNativeSpatialCandidate(recipe,candidate,context).accepted,false);
  let forbidden=0;context.checkpoint=()=>{forbidden++;};
  assert.throws(()=>completeNativeSpatialCandidate(recipe,candidate,context),/full candidate budget exhausted/);
  assert.equal(forbidden,0);assert.equal(context.trace.fullCandidates,2);assert.equal(context.trace.deploymentRejections.length,2);assert.equal(context.trace.stopReason,'full-candidate-budget');
  return{limit:2,spent:2,thirdStageCalls:0};
});
check('deadline-keeps-reservation-and-rethrows-the-original-error',()=>{
  const {candidate,context}=fixture(),deadline=new Error('shared deadline');
  context.checkpoint=()=>{context.trace.stopReason='deadline';throw deadline;};
  assert.throws(()=>completeNativeSpatialCandidate(recipe,candidate,context),error=>error===deadline);
  assert.equal(context.trace.fullCandidates,1);assert.equal(context.trace.deploymentRejections[0].reason,'shared deadline');
  return{spent:1,originalErrorRethrown:true};
});
check('one-production-stage-owner-and-frozen-context-forwarding',()=>{
  const file=ts.createSourceFile(files[0],fs.readFileSync(files[0],'utf8'),ts.ScriptTarget.Latest,true),calls=[];
  function visit(node,owner){
    if(ts.isFunctionDeclaration(node))owner=node.name?.text;
    if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression))calls.push({owner,name:node.expression.text,text:node.getText(file)});
    ts.forEachChild(node,child=>visit(child,owner));
  }
  visit(file);
  for(const name of ['selectNativeSpatialExtraction','createMasterWorld','deployR100Expedition','evaluateNativeSpatialRoutes','serializeR100MasterWorld']){
    const found=calls.filter(call=>call.name===name);assert.equal(found.length,1);assert.equal(found[0].owner,'completeNativeSpatialCandidate');
  }
  assert(calls.some(call=>call.owner==='createR100ProductionMap'&&call.name==='completeNativeSpatialCandidate'));
  assert(calls.find(call=>call.name==='createMasterWorld').text.includes('spatialDeployment:input.deployment'));
  assert(calls.find(call=>call.name==='deployR100Expedition').text.includes('recipe.contentDefinition,recipe.searchSitePolicy'));
  const code=fs.readFileSync(files[0],'utf8');assert(code.includes('Native full raster changed its admitted physical geometry'));assert(code.includes('Native final deployment moved a measured spawn/extraction endpoint'));
  return{scope:'Static wiring evidence; no positive full-map execution claimed.',singleOwner:true};
});
assert.equal(JSON.stringify(recipe),frozenRecipe);
const after=snapshot(),sourcesStable=JSON.stringify(before)===JSON.stringify(after);
const report={status:cases.every(row=>row.passed)&&sourcesStable?'passed':'failed',createdAt:new Date().toISOString(),scope:'Pure guard, budget, stage failure and deadline fixtures plus AST wiring; zero map geometry or full content deployment.',sourceHashes:before,sourceHashesAfter:after,sourcesStable,cases};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
