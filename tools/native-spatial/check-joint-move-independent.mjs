/** Bounded independent QA for atomic two-object proposals; never a seed search. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {NativeSpatialWideDomain,nativeSpatialConstraintScore,compareNativeSpatialConstraintScores} from '../../src/generation/world-study/native-spatial-wide-domain.ts';
import {nativePrimitive,buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {compileR100FragmentShape} from '../../src/generation/world-study/r100-fragment-shape.ts';
import {NativeSpatialGeometryArchive,nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';
import {createNativeSpatialPlanningGround} from '../../src/generation/world-study/native-spatial-bay-layout.ts';
import {nativeSpatialJointPlacementValid,nativeSpatialConstraintsImproved,refineNativeSpatialJointObjects,selectNativeSpatialJointCauses} from '../../src/generation/world-study/native-spatial-joint-refinement.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a fresh report path');
const receiptDirectory=process.argv[3]??'docs/qa/artifacts/native-spatial-2026-10-14/joint-c39-balanced-round1';
const selectionOnly=process.argv.includes('--selection-only'),selectionChecks=new Set(['directed-primary-slot-selection-on-existing-causes','strict-constraint-improvement-and-stable-bounded-pair-enumeration','complete-joint-targets-are-not-counted-twice-through-reverse-directions','saved-c39-balanced-receipt-honestly-retains-no-improvement','static-joint-replaces-single-and-retains-real-evaluation-budget']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const snapshot=()=>Object.fromEntries(['tools/native-spatial/check-joint-move-independent.mjs',...walk('src').filter(f=>/\.(ts|js|json)$/.test(f)),...walk('data').filter(f=>f.endsWith('.csv'))].sort().map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before=snapshot(),cases=[],skipped=[];
async function check(id,run){if(selectionOnly&&!selectionChecks.has(id)){skipped.push(id);return;}const started=performance.now();try{cases.push({id,passed:true,...await run(),elapsedMs:performance.now()-started});}catch(error){cases.push({id,passed:false,error:String(error.stack??error),elapsedMs:performance.now()-started});}console.log(JSON.stringify(cases.at(-1)));}
const rectangle=(x,y,w,h,id)=>[nativePrimitive([x,y,x+w,y,x+w,y+h],id),nativePrimitive([x,y,x+w,y+h,x,y+h],id)];
function fixture(){
  const cols=96,rows=72,exteriorMask=new Uint8Array(cols*rows),rects=[[25,25,10,10],[58,25,8,12]],holes=rects.map(([x,y,w,h],i)=>({holeId:`hole-${i}`,cells:Array.from({length:w*h},(_,c)=>(y+Math.floor(c/w))*cols+x+c%w)}));
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(x<6||y<6||x>=cols-6||y>=rows-6||(x<16&&y>=36&&y<46))exteriorMask[y*cols+x]=1;
  const objects=[...holes.map(h=>({holeId:h.holeId,site:{x:0,y:0},blocking:[]})),{site:{x:512,y:392},blocking:rectangle(0,0,32,40,7)}];
  const feedback={cols,rows,exteriorMask,holes};return{feedback,objects,cache:new NativeSpatialWideDomain(feedback,objects,48)};
}
function independentMask(feedback,sites){
  const {cols,rows}=feedback,voids=feedback.exteriorMask.slice();for(let i=0;i<feedback.holes.length;i++)for(const c of feedback.holes[i].cells){const x=c%cols+sites[i].x/8,y=Math.floor(c/cols)+sites[i].y/8;if(x>=0&&y>=0&&x<cols&&y<rows)voids[y*cols+x]=1;}
  const result=new Uint8Array(voids.length),solid=sites[2];for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const px=x*8+4,py=y*8+4;let clear=Math.min(px,py,cols*8-px,rows*8-py)>=48;
    if(Math.hypot(Math.max(0,solid.x-px,px-solid.x-32),Math.max(0,solid.y-py,py-solid.y-40))<48)clear=false;
    for(let yy=Math.max(0,y-7);yy<=Math.min(rows-1,y+7)&&clear;yy++)for(let xx=Math.max(0,x-7);xx<=Math.min(cols-1,x+7);xx++)if(voids[yy*cols+xx]){const dx=Math.max(0,Math.abs(xx-x)*8-4),dy=Math.max(0,Math.abs(yy-y)*8-4);if(dx*dx+dy*dy<48*48){clear=false;break;}}
    result[y*cols+x]=Number(clear);
  }return result;
}
await check('whole-batch-prevalidation-is-atomic',()=>{
  const {cache,objects}=fixture(),original=cache.wideMask(),valid={index:0,site:{x:32,y:16}},bad=[
    [],[valid,{index:1,site:{x:1,y:0}}],[valid,{index:1,site:{x:NaN,y:0}}],[valid,{index:1,site:{x:0,y:Infinity}}],
    [valid,{index:99,site:{x:0,y:0}}],[valid,{index:0,site:{x:16,y:0}}],[valid,{index:1,site:{x:0,y:0}},{index:2,site:{x:0,y:0}}],
  ];for(const method of ['evaluateMany','commitMany'])for(const entries of bad){assert.throws(()=>cache[method](entries));assert.deepEqual(cache.wideMask(),original);assert.deepEqual(cache.measure(),cache.evaluateMany([{index:0,site:objects[0].site},{index:1,site:objects[1].site}]),'sites also remain original');}
  return{rejectedOperations:bad.length*2,invalidSecondEntryDuplicateIndexAndOverBudgetCovered:true};
});
await check('joint-mask-removes-both-old-sites-preserves-overlap-and-third-object',()=>{
  const {cache,feedback,objects}=fixture(),original=cache.wideMask(),sites=objects.map(o=>o.site),entries=[{index:0,site:{x:80,y:128}},{index:1,site:{x:-80,y:128}}];
  assert.deepEqual(original,independentMask(feedback,sites));const forward=cache.evaluateMany(entries),reverse=cache.evaluateMany([...entries].reverse());assert.deepEqual(forward,reverse);assert.deepEqual(cache.wideMask(),original);
  cache.commitMany(entries);const committed=cache.wideMask();assert.deepEqual(committed,independentMask(feedback,entries.reduce((all,e)=>(all[e.index]=e.site,all),[...sites])));assert.equal(committed[30*96+30],1,'old first H filled');assert.equal(committed[40*96+12],0,'B remains VOID');assert.equal(committed[51*96+66],0,'unmoved S remains blocking');
  cache.commitMany([{index:0,site:{x:264,y:0}},{index:1,site:{x:0,y:0}}]);assert.deepEqual(cache.wideMask(),independentMask(feedback,[{x:264,y:0},sites[1],sites[2]]),'overlapping two H masks retain ownership counts');
  cache.commitMany([{index:1,site:sites[1]},{index:0,site:sites[0]}]);assert.deepEqual(cache.wideMask(),original);return{trialOrderIndependent:true,oldSitesFilled:true,overlappingMaskCountsExact:true,thirdObjectAndExteriorUnchanged:true};
});
await check('measurement-exception-restores-both-sites-and-occupancy',()=>{
  const {cache}=fixture(),original=cache.wideMask(),measure=cache.measure;cache.measure=()=>{throw new Error('independent injected measurement failure');};
  assert.throws(()=>cache.evaluateMany([{index:0,site:{x:64,y:0}},{index:1,site:{x:-64,y:32}}]),/independent injected/);cache.measure=measure;assert.deepEqual(cache.wideMask(),original);
  return{injectedMeasurementException:true,restoredExact:true};
});
await check('one-joint-claim-per-canonical-even-on-exception-clear-or-new-id',()=>{
  const saved=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-spatial-2026-10-14/hotspot-c39/candidate-39.json')),fingerprint={hash:'independent-fixture-hash',canonical:'independent-fixture-c39-geometry'},actualVoid=fixture().feedback;
  function setup(cache=actualVoid,gate=saved.gate){const archive=new NativeSpatialGeometryArchive(saved.input.policy),layout=structuredClone(saved.proposal);archive.offer(layout,gate,fingerprint,cache);return{archive,base:archive.nextBase};}
  const stalled=(archive,base)=>archive.recordRefinement(base,{...base,layout:{...base.layout,candidate:40,plan:{...base.layout.plan,refinement:{kind:'single',constraintsImproved:false}}}});
  const {archive,base}=setup();assert.equal(archive.claimJoint(base),false,'fresh base has no stagnant scan');stalled(archive,base);assert.equal(archive.claimJoint(base),true);assert.equal(archive.claimJoint(base),false,'claim is consumed before any successful result');
  archive.offer({...base.layout,candidate:999},base.gate,base.fingerprint,actualVoid);assert.equal(archive.claimJoint(base),false,'new ID cannot restore same canonical geometry');
  archive.clear();archive.offer({...base.layout,candidate:1000},base.gate,base.fingerprint,actualVoid);const cleared=archive.nextBase;stalled(archive,cleared);assert.equal(archive.claimJoint(cleared),false,'stage reset cannot restore joint opportunity');
  const other=setup();stalled(other.archive,other.base);assert.equal(other.archive.claimJoint(other.base),true,'independent request must not inherit a module-global claim');
  const noCache=setup(null);stalled(noCache.archive,noCache.base);assert.equal(noCache.archive.claimJoint(noCache.base),false);
  const wrongStage=setup(actualVoid,{...saved.gate,reasons:['G2-cover-route']});stalled(wrongStage.archive,wrongStage.base);assert.equal(wrongStage.archive.claimJoint(wrongStage.base),false);
  const exhausted=setup();for(let i=0;i<4;i++)stalled(exhausted.archive,exhausted.base);assert.equal(exhausted.archive.claimJoint(exhausted.base),false);
  const progressing=setup();progressing.archive.recordRefinement(progressing.base,{...progressing.base,layout:{...progressing.base.layout,plan:{...progressing.base.layout.plan,refinement:{kind:'single',constraintsImproved:true}}}});assert.equal(progressing.archive.claimJoint(progressing.base),false);
  return{claimConsumedBeforeSamplerReturn:true,newIdAndClearDoNotRevive:true,independentArchiveDoesNotShareClaims:true,noCacheWrongStageExhaustedAndProgressingReject:true,policyGeometryBudget:saved.input.policy.maxGeometryEvaluations};
});

const ground=createNativeSpatialPlanningGround([[0,0,1024,1024]],[]);
function jointObject(id,kind,x,y,relief=[]){const blocking=rectangle(0,0,32,32,id.length);return{id,kind,site:{x,y},blocking,support:[...blocking,...relief],relief};}
await check('directed-primary-slot-selection-on-existing-causes',()=>{
  const source=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-spatial-2026-10-14/joint-c39-round1/pair-source-classification.json')),normalize=rows=>rows.map(c=>`${source.objects[c.a].id}->${source.objects[c.b].id}`),selected=selectNativeSpatialJointCauses(source.objects,source.proposed);
  const expected=['hole-0->gel-rafts-upper-clamp','hole-1->subordinate-13','hole-4->hole-0'];assert.deepEqual(normalize(selected),expected);assert.deepEqual(normalize(selectNativeSpatialJointCauses(source.objects,[...source.proposed].reverse())),expected);assert.equal(new Set(selected.map(c=>c.a)).size,3);
  const only=source.proposed.filter(c=>c.a===2);assert.equal(selectNativeSpatialJointCauses(source.objects,only).length,1,'unfilled slots cannot be recycled to a second partner of the same primary');
  assert(!normalize(selected).includes('hole-0->hole-4'),'no generated reverse cause can be invented');
  const objects=[{id:'A'},{id:'B'},{id:'C'}],causes=[{a:0,b:1,kind:'coverage',loss:{x:0,y:0},distance:1},{a:1,b:0,kind:'coverage',loss:{x:8,y:0},distance:2},{a:2,b:0,kind:'coverage',loss:{x:16,y:0},distance:3}];
  assert.deepEqual(selectNativeSpatialJointCauses(objects,causes).map(c=>[c.a,c.b]),[[0,1],[1,0],[2,0]],'two generated directions can occupy their own primary slots');
  return{sourceCauseCount:source.proposed.length,selected:expected,threePrimariesCovered:true,noSecondSlotRecycling:true,noInventedReverse:true,generatedReverseRetained:true};
});
await check('joint-legality-releases-both-old-positions-and-checks-final-footprints',()=>{
  const objects=[jointObject('A','hole',200,200),jointObject('B','solid',304,200),jointObject('C','solid',800,800)],json=JSON.stringify(objects);
  const legal=[{index:0,site:{x:304,y:200}},{index:1,site:{x:408,y:200}}];
  assert.equal(nativeSpatialJointPlacementValid(objects,[legal[0],{index:1,site:objects[1].site}],ground,72),false,'moving A alone conflicts with old B');
  assert.equal(nativeSpatialJointPlacementValid(objects,legal,ground,72),true,'moving B simultaneously releases its old site');
  assert.equal(nativeSpatialJointPlacementValid(objects,[...legal].reverse(),ground,72),true);
  assert.equal(nativeSpatialJointPlacementValid(objects,[legal[0],{index:1,site:{x:336,y:200}}],ground,72),false,'new footprints too near');
  assert.equal(nativeSpatialJointPlacementValid(objects,[{index:0,site:{x:0,y:200}},legal[1]],ground,72),false,'shore support remains mandatory');
  const crossA={...objects[0],blocking:rectangle(-100,-8,200,16,1),support:rectangle(-100,-8,200,16,1)},crossB={...objects[1],blocking:rectangle(-8,-100,16,200,2),support:rectangle(-8,-100,16,200,2)};
  assert.equal(nativeSpatialJointPlacementValid([crossA,crossB],[{index:0,site:{x:512,y:512}},{index:1,site:{x:512,y:512}}],ground,1),false,'edge crossing must reject even without a vertex inside');
  assert.equal(JSON.stringify(objects),json,'legality query must not mutate objects');return{oldSiteReleasePasses:true,newOverlapAndShoreRejected:true,crossingTrianglesRejected:true,pureQuery:true};
});
await check('hole-cannot-erase-attached-relief-in-common-new-state',()=>{
  const relief=rectangle(40,0,120,32,9),objects=[jointObject('mother','solid',200,200,relief),jointObject('hole','hole',800,200)];
  const mother={index:0,site:{x:400,y:400}},hole={index:1,site:{x:520,y:400}};
  assert.equal(nativeSpatialJointPlacementValid(objects,[mother,hole],ground,72),false,'blocking gap is 88px but new relief contains the hole');
  assert.equal(nativeSpatialJointPlacementValid(objects,[mother,{index:1,site:{x:600,y:400}}],ground,72),true);
  return{reliefMovesWithMother:true,holeIntoNewReliefRejected:true,clearAlternativeAllowed:true};
});
await check('strict-constraint-improvement-and-stable-bounded-pair-enumeration',()=>{
  const score=nativeSpatialConstraintScore,old=score([1,.5],100);assert.equal(nativeSpatialConstraintsImproved(old,score([1,.5],0)),false);assert.equal(nativeSpatialConstraintsImproved(old,score([1,.6],0)),false);assert.equal(nativeSpatialConstraintsImproved(old,score([1,.4],1e9)),true);assert.equal(nativeSpatialConstraintsImproved(old,score([.9,.9],1e9)),true);
  const objects=[jointObject('A','hole',200,200),jointObject('B','solid',400,200),jointObject('C','hole',600,200)],field=[{x:216,y:216},{x:416,y:216},{x:616,y:216}],base={objects,ground,gapPx:72,field,witness:{x:200,y:400},witnessKind:'empty'};
  const meanOnly=refineNativeSpatialJointObjects({...base,evaluate:entries=>entries.length?score([1,.5],0):old});assert(meanOnly.evaluatedCount>0);assert.equal(meanOnly.entries.length,0);assert.deepEqual(meanOnly.after,old);
  const evaluate=entries=>entries.length?score([.5,.2],99):old,first=refineNativeSpatialJointObjects({...base,evaluate}),reversed=refineNativeSpatialJointObjects({...base,objects:[...objects].reverse(),evaluate});
  const normalize=(result,list)=>result.entries.map(e=>({id:list[e.index].id,site:e.site})).sort((a,b)=>a.id.localeCompare(b.id));assert.deepEqual(normalize(first,objects),normalize(reversed,[...objects].reverse()));assert(first.entries.length===2);
  for(const result of [meanOnly,first,reversed]){assert(result.pairCount<=3);assert(result.trialCount<=Math.min(48,12*objects.length));assert(result.evaluatedCount<=result.trialCount);const slots=new Map(),targets=new Set();for(const t of result.trials){const key=t.ids.join('->');slots.set(key,(slots.get(key)??0)+1);const target=t.entries.map((e,i)=>[t.ids[i],e.site.x,e.site.y]).sort((a,b)=>a[0].localeCompare(b[0])).flat().join(':');assert(!targets.has(target),'same complete two-object state must be evaluated once');targets.add(target);}assert(slots.size<=3);assert.equal(new Set([...slots.keys()].map(key=>key.split('->')[0])).size,slots.size);for(const count of slots.values())assert(count<=16,'each primary directed slot retains a 16-combination cap');}
  return{meanOnlyRejected:true,strictMaximumThenSum:true,enumerationOrderIndependent:true,counts:[meanOnly,first,reversed].map(r=>({pairs:r.pairCount,trials:r.trialCount,evaluated:r.evaluatedCount}))};
});
await check('complete-joint-targets-are-not-counted-twice-through-reverse-directions',()=>{
  const objects=[jointObject('A','hole',200,200),jointObject('B','solid',400,200)],score=nativeSpatialConstraintScore,evaluate=entries=>score([1,.5],entries.length?0:10),result=refineNativeSpatialJointObjects({objects,ground,gapPx:72,field:[{x:200,y:200},{x:432,y:200}],witness:{x:300,y:200},witnessKind:'empty',evaluate});
  assert.equal(result.pairCount,2);assert.equal(result.trialCount,16,'two directed slots produce the same 16 complete target states');const states=result.trials.map(t=>t.entries.map(e=>[objects[e.index].id,e.site.x,e.site.y]).sort((a,b)=>a[0].localeCompare(b[0])).flat().join(':'));assert.equal(new Set(states).size,16);assert.equal(result.entries.length,0);
  return{generatedDirectedSlots:2,uniqueCompleteStates:16,duplicateSecondDirectionNotCharged:true,meanOnlyStillNotSelected:true};
});

await check('saved-c39-balanced-receipt-honestly-retains-no-improvement',()=>{
  const base=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-spatial-2026-10-14/hotspot-c39/candidate-39.json')),receipt=JSON.parse(fs.readFileSync(receiptDirectory+'/report.json')),result=JSON.parse(fs.readFileSync(receiptDirectory+'/proposal.json')),joint=receipt.selected.joint;
  assert(receipt.sourcesStable);const sourceCompatibility=[];
  for(const [file,hash]of Object.entries(receipt.sourceHashes)){
    const source=fs.readFileSync(file,'utf8'),current=createHash('sha256').update(source).digest('hex');
    assert.equal(current,hash,'Balanced receipt must bind current production source exactly');sourceCompatibility.push({file,status:'exact'});
  }
  assert.equal(joint.pairCount,3);assert.equal(joint.trialCount,40);assert.equal(joint.evaluatedCount,14);assert.equal(joint.entries.length,0);assert.equal(receipt.selected.constraintsImproved,false);assert.deepEqual(joint.before,joint.after);const pairs=new Map();let evaluated=0;
  for(const trial of joint.trials){const key=trial.ids.join('->');pairs.set(key,(pairs.get(key)??0)+1);assert.equal(trial.entries.length,2);if(trial.legal){assert(trial.score);assert.equal(nativeSpatialConstraintsImproved(joint.before,trial.score),false);evaluated++;}else assert.equal(trial.score,undefined);}
  assert.deepEqual([...pairs.keys()],['hole-0->gel-rafts-upper-clamp','hole-1->subordinate-13','hole-4->hole-0']);assert.equal(pairs.size,3);assert.equal(evaluated,14);for(const n of pairs.values())assert(n<=16);assert(joint.trialCount<=Math.min(48,12*base.proposal.plan.objects.length));
  assert.deepEqual(result.proposal.plan.objects,base.proposal.plan.objects,'no improvement must keep every complete object at its original site');assert.deepEqual(result.proposal.plan.land,base.proposal.plan.land);assert.deepEqual(result.proposal.bays,base.proposal.bays);assert.deepEqual(result.proposal.requestedCounts,base.proposal.requestedCounts);
  const {proposal,input}=result,geometry=buildNativeSpatialGeometry(proposal.definition,20261012),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy),gate=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
  assert.equal(nativeSpatialGeometryFingerprint(geometry,proposal).hash,'dec8af0ac04c9412');assert.deepEqual(gate,receipt.gate);assert.equal(gate.accepted,false);assert.deepEqual(gate.reasons,['G1-largest-empty-radius','G1-long-deep-empty-region']);
  let opaqueSolidCells=0,solidCells=0;for(let c=0;c<geometry.terrain.matter.length;c++){if(!geometry.terrain.matter[c])continue;const x=c%geometry.terrain.cols,y=Math.floor(c/geometry.terrain.cols);if(geometry.solidDistance({x:x*8+4,y:y*8+4})===0){solidCells++;opaqueSolidCells+=Number(geometry.sight.isOpaque(x,y));}}assert(solidCells>0);assert.equal(opaqueSolidCells,0,'ordinary S remains visible across, not a VOID occluder');
  return{operatorExecutedBy:'Layout once; QA did not repeat the c39 operator',pairs:[...pairs],trials:40,evaluated:14,selected:0,actualRecompilationsByQA:1,actualHash:'dec8af0ac04c9412',actualMaxEmpty:gate.metrics.maxEmptyUpperPx,actualDeep:gate.metrics.maxDeepSpanPx,actualWide:gate.metrics.wideRatio,actualLargestWide:gate.metrics.largestWideRatio,actualRejected:gate.reasons,solidCells,opaqueSolidCells,sourceCompatibility,conclusion:'The bounded two-object operation did not improve this local failure.'};
});
await check('static-joint-replaces-single-and-retains-real-evaluation-budget',()=>{
  const layout=fs.readFileSync('src/generation/world-study/native-spatial-layout.ts','utf8'),controller=fs.readFileSync('src/generation/world-study/native-spatial-generation.ts','utf8');
  assert(layout.includes('if(previous!.allowJoint)'));assert(layout.includes("refinement={kind:'joint'"));assert(layout.includes("}else{\n      const before=evaluate([]);\n      // Joint refinement replaces this scan"));assert(layout.includes('largestWideRatioProxy=wideDomain?.measure().largestWideRatio??null'));
  assert(controller.includes('candidate<input.policy.maxGeometryEvaluations'));assert(controller.indexOf('const jointAllowed=previous?archive.claimJoint(previous):false')<controller.indexOf('layout=createNativeSpatialLayout'));assert(controller.includes('checkpoint();attempt.geometryEvaluations++;\n      const geometry=buildNativeSpatialGeometry'));assert(controller.includes('if(accepted){yield{layout,geometry,groups,trace};}'));
  const saved=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-spatial-2026-10-14/hotspot-c39/candidate-39.json'));assert.equal(saved.input.policy.maxGeometryEvaluations,72);assert.equal(saved.input.policy.maxFullCandidates,2);
  return{evidenceType:'static wiring plus frozen policy inspection, not fresh production execution',replacementBranch:true,actualCompileStillCounted:true,freshConnectivityStillUnknown:true,geometryBudget:72,fullCandidateBudget:2};
});

const after=snapshot(),sourcesStable=JSON.stringify(before)===JSON.stringify(after),report={status:cases.every(c=>c.passed)&&sourcesStable?'passed':'failed',createdAt:new Date().toISOString(),features:['COH-F011','COH-F013','COH-F007'],sourceHashes:before,sourceHashesAfter:after,sourcesStable,selectionOnly,receiptDirectory,cases,skipped,limitations:['Finite synthetic cases and one saved c39; no fresh seed, chain replay, full production request or holdout.','Proposal selection is not final geometry acceptance; actual geometry is recompiled and rejected independently.','No browser, rendering, AI, G2/G4 deployment or old-save replay result.','Final build is coordinated by the root agent; repository has no npm test script.']};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
