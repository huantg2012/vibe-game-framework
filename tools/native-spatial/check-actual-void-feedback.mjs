/** Independent bounded QA: actual VOID guidance is not final geometry admission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback,nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {compileR100FragmentShape} from '../../src/generation/world-study/r100-fragment-shape.ts';
import {createR100ProductionRecipe,validR100ProductionRecipe} from '../../src/generation/world-study/r100-package.ts';
import {validNativeSpatialRuntimeInput} from '../../src/generation/world-study/native-spatial-recipe.ts';
import {NativeSpatialWideDomain,nativeSpatialConstraintScore,compareNativeSpatialConstraintScores} from '../../src/generation/world-study/native-spatial-wide-domain.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Supply a fresh report path; historical evidence is immutable');
const dir='docs/qa/artifacts/native-spatial-2026-10-14/site-pruning-c16';
const files=()=>['tools/native-spatial/check-actual-void-feedback.mjs',...walk('src').filter(f=>/\.(ts|js|json)$/.test(f)),...walk('data').filter(f=>f.endsWith('.csv'))].sort();
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const snapshot=()=>Object.fromEntries(files().map(f=>[f,createHash('sha256').update(fs.readFileSync(f)).digest('hex')]));
const before=snapshot(),cases=[];
async function check(id,run){const started=performance.now();try{cases.push({id,passed:true,...await run(),elapsedMs:performance.now()-started});}catch(error){cases.push({id,passed:false,error:String(error.stack??error),elapsedMs:performance.now()-started});}console.log(JSON.stringify(cases.at(-1)));}
function flood(mask,cols,diagonal=false){const labels=new Int32Array(mask.length).fill(-1),groups=[],rows=mask.length/cols;for(let c=0;c<mask.length;c++)if(mask[c]&&labels[c]<0){const group=[c],label=groups.length;labels[c]=label;for(let at=0;at<group.length;at++){const p=group[at],x=p%cols,y=Math.floor(p/cols);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if((!dx&&!dy)||(!diagonal&&dx&&dy))continue;const xx=x+dx,yy=y+dy,n=yy*cols+xx;if(xx<0||yy<0||xx>=cols||yy>=rows||!mask[n]||labels[n]>=0)continue;labels[n]=label;group.push(n);}}groups.push(group);}return{labels,groups};}
function synthetic(){
  const cols=96,rows=72,matter=new Uint8Array(cols*rows),holes=[[25,25,10,10],[58,25,10,10]];
  for(let y=6;y<rows-6;y++)for(let x=6;x<cols-6;x++)matter[y*cols+x]=1;
  // An asymmetric bay stays connected to the outside; both H remain closed.
  for(let y=36;y<46;y++)for(let x=0;x<16;x++)matter[y*cols+x]=0;
  for(const [x,y,w,h]of holes)for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)matter[yy*cols+xx]=0;
  const {labels,groups}=flood(Uint8Array.from(matter,v=>1-v),cols),closed=groups.filter(c=>c.every(p=>p>=cols&&p<cols*(rows-1)&&p%cols>0&&p%cols<cols-1));
  return{geometry:{terrain:{cols,rows,matter}},groups:{structures:closed.map((cells,i)=>({id:`H-${i}`,kind:'hole',componentCount:1,cells})),holeLabelByCell:labels,rejected:[],exteriorVoidCells:groups[0].length},placements:holes.map(([x,y,w,h],i)=>({holeId:`hole-${i}`,profileId:'fixture',rects:[[x*8,y*8,w*8,h*8]]}))};
}
function partition(feedback,matter){const seen=new Uint8Array(matter.length);for(let c=0;c<matter.length;c++)if(feedback.exteriorMask[c])seen[c]++;for(const h of feedback.holes)for(const c of h.cells)seen[c]++;for(let c=0;c<matter.length;c++)assert.equal(seen[c],1-matter[c],`VOID partition cell ${c}`);}

await check('actual-void-bijective-partition-keeps-exterior-and-bay',()=>{
  const f=synthetic(),result=createNativeSpatialActualVoidFeedback(f.geometry,f.groups,f.placements);assert(result.feedback,result.reason);partition(result.feedback,f.geometry.terrain.matter);assert.equal(result.feedback.holes.length,2);assert.equal(result.feedback.exteriorMask[40*96+12],1);assert.equal(result.feedback.exteriorMask[30*96+30],0);
  const copied=result.feedback.holes[0].cells[0];f.groups.structures[0].cells[0]=-999;assert.equal(result.feedback.holes[0].cells[0],copied);
  return{holes:2,bayIsExterior:true,completeDisjointPartition:true,cellsCopied:true};
});
await check('ambiguous-authored-and-final-identities-disable-cache',()=>{
  const mutations=[
    ['duplicate-hole-id',f=>{f.placements[1].holeId=f.placements[0].holeId;}],
    ['two-authored-holes-one-final-label',f=>{f.placements[1].rects=f.placements[0].rects;}],
    ['one-author-region-two-final-labels',f=>{f.placements[0].rects=[...f.placements[0].rects,...f.placements[1].rects];}],
    ['authored-hole-claims-bay',f=>{f.placements[0].rects=[[0,288,128,80]];}],
    ['mechanically-merged-disconnected-hole',f=>{f.groups.structures[0].componentCount=2;}],
    ['missing-qualified-hole',f=>{f.groups.structures.pop();}],
    ['unassigned-closed-void',f=>{f.groups.structures.pop();f.placements.pop();}],
    ['recognized-structure-claims-exterior',f=>{f.groups.structures[0].cells=[0];}],
  ];
  const rejected=[];for(const [id,mutate]of mutations){const f=synthetic();mutate(f);const result=createNativeSpatialActualVoidFeedback(f.geometry,f.groups,f.placements);assert.equal(result.feedback,undefined,id);assert(result.reason,id);rejected.push({id,reason:result.reason});}return{rejected};
});

function independentWideMask(feedback,shifts,radius){
  const {cols,rows}=feedback,occupied=feedback.exteriorMask.slice();
  for(const h of feedback.holes){const shift=shifts[h.holeId]??{x:0,y:0};for(const c of h.cells){const x=c%cols+shift.x/8,y=Math.floor(c/cols)+shift.y/8;if(x>=0&&y>=0&&x<cols&&y<rows)occupied[y*cols+x]=1;}}
  const wide=new Uint8Array(occupied.length),reach=Math.ceil(radius/8)+1;
  // Query each centre against reconstructed VOID cells, rather than using the
  // production cache's translated expanded masks or occupancy reference count.
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    let clear=true;
    for(let yy=Math.max(0,y-reach);yy<=Math.min(rows-1,y+reach)&&clear;yy++)for(let xx=Math.max(0,x-reach);xx<=Math.min(cols-1,x+reach);xx++)if(occupied[yy*cols+xx]){
      const dx=Math.max(0,Math.abs(xx-x)*8-4),dy=Math.max(0,Math.abs(yy-y)*8-4);if(dx*dx+dy*dy<radius*radius){clear=false;break;}
    }wide[y*cols+x]=Number(clear);
  }return wide;
}
function mismatch(a,b){assert.equal(a.length,b.length);let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;}
await check('move-commit-restore-fills-old-hole-keeps-exterior-and-overlaps',()=>{
  const f=synthetic(),{feedback}=createNativeSpatialActualVoidFeedback(f.geometry,f.groups,f.placements),objects=feedback.holes.map(h=>({holeId:h.holeId,site:{x:0,y:0},blocking:[]})),cache=new NativeSpatialWideDomain(feedback,objects,48),original=cache.wideMask();
  assert.equal(mismatch(original,independentWideMask(feedback,{},48)),0);
  const moved={x:0,y:160},trial=cache.evaluate(0,moved);assert.deepEqual(cache.wideMask(),original,'evaluate must roll back');cache.commit(0,moved);
  const shifted=cache.wideMask(),expected=independentWideMask(feedback,{'hole-0':moved},48);assert.equal(mismatch(shifted,expected),0);assert.equal(shifted[30*96+30],1,'old H must be filled');assert.equal(shifted[50*96+30],0,'new H must block');assert.equal(shifted[40*96+12],0,'bay remains exterior');
  cache.commit(0,{x:264,y:0});assert.equal(mismatch(cache.wideMask(),independentWideMask(feedback,{'hole-0':{x:264,y:0}},48)),0,'overlapping masks preserve both owners');cache.commit(0,{x:0,y:0});assert.deepEqual(cache.wideMask(),original);
  const leaked=cache.wideMask();leaked.fill(1);assert.deepEqual(cache.wideMask(),original,'mask snapshot cannot mutate cache');
  return{initialAndMovedCellMismatches:0,trial,oldHoleFilled:true,newHoleBlocks:true,bayKept:true,overlapAndRestoreExact:true};
});
await check('invalid-trials-leave-the-cache-unchanged',()=>{
  const f=synthetic(),{feedback}=createNativeSpatialActualVoidFeedback(f.geometry,f.groups,f.placements),objects=feedback.holes.map(h=>({holeId:h.holeId,site:{x:0,y:0},blocking:[]})),cache=new NativeSpatialWideDomain(feedback,objects,48),baseline=cache.wideMask();
  for(const method of ['evaluate','commit'])for(const site of [{x:1,y:0},{x:NaN,y:0},{x:0,y:Infinity}]){assert.throws(()=>cache[method](0,site));assert.deepEqual(cache.wideMask(),baseline,`${method} invalid trial corrupted occupancy`);}
  for(const method of ['evaluate','commit'])for(const index of [-1,2,NaN]){assert.throws(()=>cache[method](index,{x:0,y:0}));assert.deepEqual(cache.wideMask(),baseline,`${method} invalid index corrupted occupancy`);}
  return{invalidTrials:12,allRejectedWithoutMutation:true};
});
await check('hard-deficit-maximum-then-total-always-precede-mean',()=>{
  const score=nativeSpatialConstraintScore,compare=compareNativeSpatialConstraintScores;
  const rows=[
    {a:score([0,0,0,0],1e9),b:score([0,0,1e-12,0],0)},
    {a:score([.1,.1],1e9),b:score([.1000001,0],0)},
    {a:score([.2,0],1e9),b:score([.2,.000001],0)},
    {a:score([.2,.1],1),b:score([.2,.1],2)},
  ];for(const row of rows){assert(compare(row.a,row.b)<0);assert(compare(row.b,row.a)>0);}assert.equal(compare(score([0],2),score([0],2)),0);return{comparisons:9,nearThreshold:1e-12,meanCannotBuyViolation:true};
});
await check('saved-c19-16px-bridge-real-domain-not-raw-rectangles',()=>{
  const saved=JSON.parse(fs.readFileSync(dir+'/current.json')),proposal=saved.proposal,input=JSON.parse(fs.readFileSync(dir+'/candidate-16.json')).input,seed=20261012;
  const geometry=buildNativeSpatialGeometry(proposal.definition,seed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy),result=createNativeSpatialActualVoidFeedback(geometry,groups,proposal.holes);assert(result.feedback,result.reason);partition(result.feedback,geometry.terrain.matter);
  let holeIndex=0;const objects=proposal.plan.objects.map(o=>{
    const ids=new Set(o.instances.filter(i=>i.role==='solid').map(i=>i.id));return{site:o.site,...(o.kind==='hole'?{holeId:`hole-${holeIndex++}`}:{ }),blocking:geometry.solidPrimitives.filter(p=>ids.has(p.objectId)).map(p=>nativePrimitive(p.points.map((v,i)=>v-(i%2?o.site.y:o.site.x)),p.objectId))};
  });
  const cache=new NativeSpatialWideDomain(result.feedback,objects,input.policy.wideRadiusPx),baseline=cache.measure(),baseMask=cache.wideMask(),actual=Uint8Array.from(geometry.supported,(v,c)=>{const p={x:(c%geometry.terrain.cols+.5)*8,y:(Math.floor(c/geometry.terrain.cols)+.5)*8};return Number(v&&Math.min(geometry.solidDistance(p),geometry.voidDistance(p))>=48);});assert.equal(mismatch(baseMask,actual),0);
  assert(Math.abs(baseline.largestWideRatio-.6551588858375834)<1e-12);const at=2,site={x:objects[at].site.x,y:objects[at].site.y-16},predicted=cache.evaluate(at,site);assert.equal(predicted.largestWideRatio,1);assert.deepEqual(cache.wideMask(),baseMask);
  const next=structuredClone(proposal.plan.objects);next[at].site=site;
  const holes=next.filter(o=>o.kind==='hole').map((o,i)=>({holeId:`hole-${i}`,profileId:o.profileId,rects:o.rects.map(([x,y,w,h])=>[x+o.site.x,y+o.site.y,w,h])}));
  const fragment={...proposal.fragmentShape,layout:{...proposal.fragmentShape.layout,voidRects:[...proposal.bays.flatMap(b=>b.rects),...holes.flatMap(h=>h.rects)].map(r=>r.map(v=>v/2))}},compiled=compileR100FragmentShape(fragment,seed),definition={...proposal.definition,erosion:compiled.erosion,terrainOutline:compiled.terrainOutline};
  const movedGeometry=buildNativeSpatialGeometry(definition,seed),movedGroups=identifyNativeSpatialStructures(movedGeometry,proposal.assemblies,input.policy),gate=evaluateNativeSpatialGeometry(movedGeometry,movedGroups,input.policy,input.world,{placements:holes,profiles:input.holeProfiles},{landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
  assert.equal(gate.metrics.largestWideRatio,1);assert.equal(gate.accepted,false,'a topology repair must not fake full admission');assert(gate.reasons.includes('G1-largest-empty-radius'));
  cache.commit(at,site);assert.equal(cache.measure().largestWideRatio,1);cache.commit(at,objects[at].site);assert.deepEqual(cache.wideMask(),baseMask);
  const timings=[];for(const count of [12,192]){const started=performance.now();for(let i=0;i<count;i++)cache.evaluate(at,i%2?site:objects[at].site);timings.push({evaluations:count,totalMs:performance.now()-started});}assert.deepEqual(cache.wideMask(),baseMask);
  return{savedGeometryHash:saved.geometryHash,actualBaseCellMismatches:0,baseline,predicted,actualMovedLargestWideRatio:gate.metrics.largestWideRatio,actualMovedStillRejected:gate.reasons,actualMovedMaxEmpty:gate.metrics.maxEmptyUpperPx,sourceHole:at,translation:{x:0,y:-16},fixedTwoPositionTiming:timings};
});
await check('static-fresh-unknown-and-final-admission-remain-separate',()=>{
  const layout=fs.readFileSync('src/generation/world-study/native-spatial-layout.ts','utf8'),generation=fs.readFileSync('src/generation/world-study/native-spatial-generation.ts','utf8');
  assert(layout.includes('largestWideRatioProxy=wideDomain?.measure().largestWideRatio??null'));
  assert(layout.includes('if(previous!.actualVoid)'));
  assert(generation.indexOf('const geometry=buildNativeSpatialGeometry')<generation.indexOf('const ground=evaluateNativeSpatialGeometry'));
  assert(generation.includes('if(ground.accepted){checkpoint();gates.visibility=evaluateNativeSpatialVisibility'));
  assert(generation.includes('if(accepted){yield{layout,geometry,groups,trace};}'));
  return{evidenceType:'static source inspection, not new production execution',freshConnectivityUnknown:true,actualGeometryAlwaysRecompiled:true,actualGateStillControlsYield:true};
});

await check('runtime-feedback-is-not-frozen-recipe-input',()=>{
  const recipe=createR100ProductionRecipe('gel-rafts',20261012,'medium'),json=JSON.stringify(recipe);assert.equal(recipe.package.algorithmRevision,12);assert(validR100ProductionRecipe(recipe));assert(!json.includes('actualVoid'));assert(!json.includes('exteriorMask'));
  const invalid=structuredClone(recipe.nativeSpatial);invalid.actualVoid={cols:1,rows:1,exteriorMask:[1],holes:[]};assert.equal(validNativeSpatialRuntimeInput(invalid,recipe.nativeDefinition,'gel-rafts'),false);
  const legacy=createR100ProductionRecipe('cinder-ridge',20261012,'medium');assert.equal(legacy.package.algorithmRevision,11);assert(validR100ProductionRecipe(legacy));assert(!JSON.stringify(legacy).includes('actualVoid'));return{r12FactoryValid:true,extraRuntimeCacheRejectedByFrozenInputSchema:true,unregisteredWorldRevision:11,legacyFactoryValid:true};
});
const after=snapshot(),sourcesStable=JSON.stringify(before)===JSON.stringify(after),report={status:cases.every(c=>c.passed)&&sourcesStable?'passed':'failed',createdAt:new Date().toISOString(),features:['COH-F011','COH-F013','COH-F007'],method:'Finite synthetic identity checks and fixed saved geometry counterexamples; no random seed search.',sourceHashes:before,sourceHashesAfter:after,sourcesStable,cases,limitations:['No complete r12 map, G2/G4/full deployment, replay, AI, browser or visual approval.','Cache guidance cannot replace final 8px geometry gates.','Factory/schema isolation is not a fresh r11 replay test; existing frozen closure evidence remains separately scoped.','No build/test suite run in this bounded task; root coordinates final build and the repository has no npm test script.']};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
