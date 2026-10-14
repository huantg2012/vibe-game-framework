/** Finite synthetic checks only: no saved map, generator, or terrain compile. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {createNativeSpatialJointTargetSelector,nativeSpatialJointAnalyticMove,refineNativeSpatialJointObjects} from '../../src/generation/world-study/native-spatial-joint-refinement.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a NEW report path');
const sources=['src/generation/world-study/native-spatial-joint-refinement.ts','src/generation/world-study/native-spatial-layout.ts','tools/native-spatial/check-joint-responsibility.mjs'];
const snapshot=()=>Object.fromEntries(sources.map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before=snapshot(),cases=[];
function check(id,run){try{cases.push({id,passed:true,...run()});}catch(error){cases.push({id,passed:false,error:String(error.stack??error)});}console.log(JSON.stringify(cases.at(-1)));}
const cover=160-8,deep=112-4*Math.SQRT2;
function rectangle(id){return[nativePrimitive([-20,-20,20,-20,20,20],id),nativePrimitive([-20,-20,20,20,-20,20],id)];}
function object(id,index,x,y){const blocking=rectangle(index);return{id,kind:'solid',site:{x,y},blocking,support:blocking,relief:[]};}
function target(kind,points,limit){const centre={x:(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,y:(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2},radius=Math.max(...points.map(p=>Math.hypot(p.x-centre.x,p.y-centre.y)));return{kind,points,centre,radius,limit,envelopeRadius:limit-radius};}

check('new-deep-excludes-old-loss-and-exact-assessment-points',()=>{
  const field=[4,20,36,52,68,84].map(x=>({x,y:4})),old=[120,120,100,120,120,80],next=[300,120,130,120,120,500];
  const result=createNativeSpatialJointTargetSelector(field,5,16,old,cover,deep)(next);
  assert.equal(result.newDeepPointCount,1);assert.equal(result.newDeepComponentCount,1);
  assert.deepEqual(result.deep.points,[field[2]]);assert.equal(result.deep.oldDeepLabelsTouched,2);
  assert.deepEqual(result.cover.points,[field[5]]);assert.equal(result.deep.limit,deep);assert.equal(result.cover.limit,cover);
  return{newDeepPointCount:1,oldLossExcluded:true,assessmentOnlyCover:true,touchedOldLabels:2};
});
check('two-old-label-priority-and-farthest-representative-tie',()=>{
  const field=[];for(let y=0;y<3;y++)for(let x=0;x<7;x++)field.push({x:x*16+4,y:y*16+4});
  const old=field.map(()=>80);for(const i of [7,8,10,11])old[i]=120;
  const next=[...old];next[9]=130;next[20]=400;
  const result=createNativeSpatialJointTargetSelector(field,field.length,16,old,cover,deep)(next);
  assert.equal(result.newDeepComponentCount,2);assert.deepEqual(result.deep.points,[field[9]]);assert.equal(result.deep.oldDeepLabelsTouched,2);
  const line=[4,20,36,52,68].map(x=>({x,y:4})),band=createNativeSpatialJointTargetSelector(line,5,16,[100,100,100,100,100],cover,deep)([110,115,200,110,130]);
  assert.deepEqual(band.deep.points,[line[2],line[0]]);
  return{bridgePriorityOverLargerGain:true,farthestTieUsesYX:true};
});
check('missing-cardinal-cells-do-not-create-diagonal-bridges',()=>{
  const field=[{x:4,y:4},{x:20,y:20}],result=createNativeSpatialJointTargetSelector(field,2,16,[100,100],cover,deep)([130,150]);
  assert.equal(result.newDeepComponentCount,2);assert.deepEqual(result.deep.points,[field[1]]);
  return{components:2,diagonalLeak:false};
});
check('cover-ranks-increment-of-violation-before-old-deepest',()=>{
  const field=[{x:4,y:4},{x:20,y:4},{x:36,y:4}],result=createNativeSpatialJointTargetSelector(field,3,16,[300,100,100],cover,deep)([301,170,170]);
  assert.deepEqual(result.cover.points,[field[1]]);return{oldDeepestNotAutomaticallyTarget:true,yxTieStable:true};
});
check('analytic-footprint-displacement-meets-each-planning-limit',()=>{
  const b=object('fixture',1,0,0),point={x:330,y:0},tree=nativePrimitiveTree(b.blocking),results=[];
  for(const [kind,limit]of [['cover',cover],['deep',deep]]){
    const goal=target(kind,[point],limit),move=nativeSpatialJointAnalyticMove(b,goal,8);assert(move);
    assert.equal(move.distance,310);assert.deepEqual(move.nearestPoint,{x:20,y:0});assert(Math.abs(move.requiredTranslation-(310-limit))<1e-10);
    for(const row of move.moves){assert(row.translation>96);assert.equal(row.site.x%8,0);assert.equal(row.site.y%8,0);assert(nativePrimitiveDistance(tree,point.x-row.site.x,point.y-row.site.y)<=limit);}
    results.push({kind,limit,required:move.requiredTranslation,sites:move.moves.map(m=>m.site)});
  }
  const goal=target('deep',[{x:300,y:290},{x:316,y:306}],deep),move=nativeSpatialJointAnalyticMove(b,goal,8);assert(move);
  for(const row of move.moves)for(const p of goal.points)assert(nativePrimitiveDistance(tree,p.x-row.site.x,p.y-row.site.y)<=deep);
  assert.equal(nativeSpatialJointAnalyticMove(b,target('deep',[{x:300,y:0},{x:600,y:0}],deep),8),undefined);
  assert.equal(nativeSpatialJointAnalyticMove(b,target('cover',[{x:50,y:0}],cover),8),undefined);
  return{results,twoRepresentativesCovered:true,nonpositiveEnvelopeSkipped:true,alreadyCoveredSkipped:true};
});

function context(objects,field,witness,ground,evaluate){return{objects,field,ground,gapPx:8,witness,witnessKind:'empty',baseFieldCount:0,baseFieldCellPx:16,snapStep:8,coverPlanningLimit:cover,deepPlanningLimit:deep,evaluate};}
const constantScore={maximum:1,sum:1,mean:1};
function fallbackFixture(reverse=false){
  const objects=[object('A',1,200,200),object('B1',2,600,200),object('B2',3,680,200)];if(reverse)objects.reverse();
  const ground={margin:()=>10000,supportsFootprint:(primitives,site)=>primitives[0].objectId!==2||site.x===600&&site.y===200};
  let evaluations=0;const result=refineNativeSpatialJointObjects(context(objects,[{x:384,y:200}],{x:100,y:200},ground,entries=>{if(entries.length)evaluations++;return constantScore;}));
  const canonical=result.trials.map(row=>row.entries.map(e=>`${objects[e.index].id}:${e.site.x},${e.site.y}`).sort().join('|'));
  return{objects,result,canonical,evaluations};
}
check('unavailable-nearest-partner-does-not-veto-next-of-three',()=>{
  const {result,evaluations}=fallbackFixture(),site=result.sites.find(row=>row.primaryId==='A'&&row.site.x===184);
  assert(site);assert.deepEqual(site.prechecks.slice(0,2).map(p=>p.partnerId),['B1','B2']);
  assert(site.prechecks[0].reasons.includes('B1:ground-support'));assert.deepEqual(site.prechecks[1].reasons,[]);
  assert(result.trials.some(t=>t.ids[0]==='A'&&t.ids[1]==='B2'));assert.equal(evaluations,result.evaluatedCount);
  assert(result.precheckCount<=144);assert(result.trialCount<=48);assert(result.sites.length<=12);
  return{firstRefusedThenNextAccepted:true,precheckCount:result.precheckCount,tupleCount:result.trialCount,evaluations};
});
check('object-order-permutation-preserves-stable-generated-states',()=>{
  const normal=fallbackFixture(),reversed=fallbackFixture(true);assert.deepEqual(normal.canonical,reversed.canonical);
  assert.deepEqual(normal.result.sites.map(s=>[s.primaryId,s.site,s.prechecks]),reversed.result.sites.map(s=>[s.primaryId,s.site,s.prechecks]));
  return{identicalGeneratedStates:true,states:normal.canonical.length};
});
check('single-blocker-keeps-same-vector-release-with-no-fake-target',()=>{
  const objects=[object('A',1,200,200),object('B',2,248,200),object('C',3,600,504)],ground={margin:()=>10000,supportsFootprint:()=>true};
  const result=refineNativeSpatialJointObjects(context(objects,[],{x:280,y:200},ground,()=>constantScore));
  const release=result.trials.find(row=>row.ids[0]==='A'&&row.ids[1]==='B'&&row.slot==='release');assert(release);assert.equal(release.target,undefined);assert.equal(release.lossPoint,null);
  const [a,b]=release.entries;assert.equal(a.site.x-objects[a.index].site.x,b.site.x-objects[b.index].site.x);assert.equal(a.site.y-objects[a.index].site.y,b.site.y-objects[b.index].site.y);
  for(const site of result.sites)if(site.blockerIds.length===1)for(const precheck of site.prechecks)assert.equal(precheck.partnerId,site.blockerIds[0]);
  return{sameVectorReleaseRetained:true,noMadeUpTarget:true,precheckCount:result.precheckCount,tupleCount:result.trialCount};
});
const after=snapshot(),sourcesStable=JSON.stringify(before)===JSON.stringify(after),report={status:cases.every(c=>c.passed)&&sourcesStable?'passed':'failed',createdAt:new Date().toISOString(),scope:'Only finite synthetic target, analytic displacement, partner feasibility, ordering and budget checks. No c39 operator execution or map generation.',sourceHashes:before,sourceHashesAfter:after,sourcesStable,cases};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
