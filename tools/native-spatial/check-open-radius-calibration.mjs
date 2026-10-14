/** Fixed §14 offline maximum-radius calibration. Production measures stay unchanged. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {serialize,deserialize} from 'node:v8';
import {gzipSync,gunzipSync} from 'node:zlib';
import {NativeBodyCollision} from '../../src/generation/world-study/native-body-collision.ts';
import {TileType} from '../../src/types/game-types.ts';
import {buildNativeSpatialGeometry,nativeCellPoint,nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,nativeVoidPrimitives,NATIVE_SPATIAL_DIRECTIONS} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {createNativeSpatialGeometryWorkBudget,nativeSpatialGeometryFingerprint} from '../../src/generation/world-study/native-spatial-generation.ts';

const output=process.argv[2];assert(output&&!fs.existsSync(output),'Usage: check-open-radius-calibration.mjs NEW_DIRECTORY');
const root='docs/qa/artifacts/native-spatial-2026-10-14',captureFile=`${root}/complete-candidate-c27-capture-round2/rejected-runtime.v8.gz`;
const sources=[{id:'c25',file:`${root}/incumbent-c25-replay/candidate-25.json`,hash:'3c89a497613a16c7'},
  {id:'c27',file:`${root}/g1-incumbent-c27-round1/proposal.json`,hash:'9faebdbd40a92649',capture:captureFile},
  {id:'original-c3',file:`${root}/initial-c3-qualified-round1/proposal.json`,hash:'13e9302bc742f583'}];
// Every coordinate is fixed before any geometry is built. Rectangles are [l,t,r,b].
const endLand=[64,64,576,576],endHole=[280,280,360,360],endSolids=[[268,72,372,88],[72,268,88,372],[268,552,372,568]];
const fixtures=[
  {id:'large-open-ground',width:1088,height:1088,land:[[32,32,1056,1056]],holes:[],solids:[[64,64,144,144],[944,64,1024,144],[64,944,144,1024],[944,944,1024,1024]],spawn:{x:196,y:196}},
  {id:'short-shore-corner',width:704,height:640,land:[endLand,[576,96,644,168]],holes:[endHole],solids:[...endSolids,[552,268,568,372]],spawn:{x:132,y:132},probe:{x:628,y:116},cornerBounds:[576,96,644,168]},
  {id:'long-empty-shore-band',width:1536,height:640,land:[endLand,[576,216,1472,416]],holes:[endHole],solids:endSolids,spawn:{x:132,y:132},bandBounds:[576,216,1472,416]},
  {id:'same-long-band-with-structures',width:1536,height:640,land:[endLand,[576,216,1472,416]],holes:[endHole],solids:[...endSolids,...[624,800,976,1152,1328].map((x,i)=>[x,i%2?392:224,x+104,i%2?408:240])],spawn:{x:132,y:132},bandBounds:[576,216,1472,416]}
];
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(`${dir}/${e.name}`):[`${dir}/${e.name}`]);
const files=[...walk('src'),...walk('data'),...sources.map(s=>s.file),captureFile,'tools/native-spatial/check-open-radius-calibration.mjs',`${root}/global-generation-design-review.md`];
const hashes=()=>Object.fromEntries([...new Set(files)].sort().map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const before=hashes();fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'fixed-inputs.json'),JSON.stringify({sources,fixtures,limits:{geometryConstructions:7,geometryWork:72,sharedDeadlineMs:60000,full:0,fresh:0}},null,2)+'\n');
const report={status:'running',scope:'One fixed offline batch. Only proposed max formula changes; internal H/S deep and all existing production gates are measured unchanged. Not production admission.',sourceHashes:before,inputsFile:'fixed-inputs.json',geometryConstructions:0,snapshotRestorations:0,fullCandidates:0,freshLayouts:0,samples:[]};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');save();
const captured=deserialize(gunzipSync(fs.readFileSync(captureFile))),policy=captured.recipe.nativeSpatial.policy;
const attempt={geometrySeed:20261012,proposalBudget:72,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'},started=performance.now();report.attempt=attempt;
const checkpoint=()=>{if(performance.now()-started>=60000){attempt.stopReason='deadline';throw new Error('Offline calibration shared 60 second budget exhausted');}};
const budget=createNativeSpatialGeometryWorkBudget(attempt,72,checkpoint);
function withoutFunctions(value,seen=new WeakMap()){if(typeof value==='function')return undefined;if(!value||typeof value!=='object')return value;if(seen.has(value))return seen.get(value);if(ArrayBuffer.isView(value))return value.slice();if(value instanceof Map){const r=new Map();seen.set(value,r);for(const[k,v]of value)r.set(k,withoutFunctions(v,seen));return r;}const r=Array.isArray(value)?[]:{};seen.set(value,r);for(const[k,v]of Object.entries(value))if(typeof v!=='function')r[k]=withoutFunctions(v,seen);return r;}
function persist(id,value){const file=`${id}.v8.gz`;fs.writeFileSync(path.join(output,file),gzipSync(serialize(withoutFunctions(value))));return file;}
function queries(saved){const {terrain}=saved,{cols,rows,matter}=terrain,solidTree=nativePrimitiveTree(saved.solidPrimitives),voidTree=nativePrimitiveTree(nativeVoidPrimitives(terrain));return{...saved,
  collision:new NativeBodyCollision({definition:terrain.definition,meshes:terrain.meshes},terrain.tileMap),solidDistance:p=>nativePrimitiveDistance(solidTree,p.x,p.y),voidDistance:p=>nativePrimitiveDistance(voidTree,p.x,p.y),
  sight:{cols,rows,tileSize:8,version:0,isOpaque:(x,y)=>x<0||y<0||x>=cols||y>=rows||!matter[y*cols+x]}};}
function fixtureGeometry(f){const {width,height}=f,cols=width/8,rows=height/8,count=cols*rows,inside=(p,r)=>p.x>=r[0]&&p.x<r[2]&&p.y>=r[1]&&p.y<r[3];
  const tiles=Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>{const p={x:x*8+4,y:y*8+4};return f.land.some(r=>inside(p,r))&&!f.holes.some(r=>inside(p,r))?TileType.FLOOR:TileType.VOID;})),tileMap={cols,rows,tileSize:8,tiles};
  const definition={instances:f.solids.map((_,i)=>({id:i+1,role:'solid'})),erosion:f.holes.map(([l,t,r,b])=>[{x:l,y:t},{x:r,y:t},{x:r,y:b},{x:l,y:b}])};
  const meshes=f.solids.map(([l,t,r,b],i)=>({spec:{id:i+1},positions:Float32Array.from([l,t,0,r,t,0,r,b,0,l,b,0]),indices:Uint32Array.from([0,1,2,0,2,3]),triangleCount:2}));
  const solidPrimitives=f.solids.flatMap(([l,t,r,b],i)=>[nativePrimitive([l,t,r,t,r,b],i+1),nativePrimitive([l,t,r,b,l,b],i+1)]);
  const terrain={definition,meshes,roles:new Map(f.solids.map((_,i)=>[i+1,'solid'])),cols,rows,width,height,tileMap,matter:Uint8Array.from(tiles.flat(),v=>Number(v!==TileType.VOID)),spawnPoint:f.spawn};
  const collision=new NativeBodyCollision({definition,meshes},tileMap),supported=new Uint8Array(count),reachable=new Uint8Array(count),links8=new Uint8Array(count);
  for(let cell=0;cell<count;cell++)supported[cell]=Number(collision.supports(nativeCellPoint(cell,cols),10,10));
  for(let cell=0;cell<count;cell++)if(supported[cell])for(let d=0;d<8;d++){const[dx,dy]=NATIVE_SPATIAL_DIRECTIONS[d],x=cell%cols+dx,y=Math.floor(cell/cols)+dy,next=y*cols+x;if(x>=0&&y>=0&&x<cols&&y<rows&&supported[next]&&collision.displacementFraction(nativeCellPoint(cell,cols),10,10,dx*8,dy*8)>=1-1e-9)links8[cell]|=1<<d;}
  const start=Math.floor(f.spawn.y/8)*cols+Math.floor(f.spawn.x/8),queue=[start];assert(supported[start]);reachable[start]=1;
  for(let at=0;at<queue.length;at++)for(let d=0;d<8;d++)if(links8[queue[at]]&(1<<d)){const[dx,dy]=NATIVE_SPATIAL_DIRECTIONS[d],next=queue[at]+dx+dy*cols;if(!reachable[next]){reachable[next]=1;queue.push(next);}}
  const geometry=queries({terrain,supported,reachable,links8,supportedCount:supported.reduce((a,b)=>a+b,0),reachableCount:queue.length,solidPrimitives});
  return{geometry,assemblies:f.solids.map((_,i)=>({assemblyId:`fixture-${i+1}`,instanceIds:[i+1],maxSpanPx:2048}))};
}
function localLandIntersection(geometry,point,radius=160){const {cols,rows,matter}=geometry.terrain;let lowerCells=0,upperCells=0,centerCells=0;
  for(let y=Math.max(0,Math.floor((point.y-radius)/8));y<Math.min(rows,Math.ceil((point.y+radius)/8));y++)for(let x=Math.max(0,Math.floor((point.x-radius)/8));x<Math.min(cols,Math.ceil((point.x+radius)/8));x++)if(matter[y*cols+x]){
    const l=x*8,r=l+8,t=y*8,b=t+8,min=Math.hypot(Math.max(l-point.x,0,point.x-r),Math.max(t-point.y,0,point.y-b)),max=Math.hypot(Math.max(Math.abs(l-point.x),Math.abs(r-point.x)),Math.max(Math.abs(t-point.y),Math.abs(b-point.y)));
    if(min<radius)upperCells++;if(max<=radius)lowerCells++;if(Math.hypot(l+4-point.x,t+4-point.y)<=radius)centerCells++;
  }return{scope:'The radius-160 disk at this point intersected with actual 8px matter cells, including ground under solid scenery; exact conservative cell-area bounds, not a whole-world area claim.',radiusPx:radius,diskAreaPx2:Math.PI*radius*radius,groundAreaLowerPx2:lowerCells*64,groundAreaUpperPx2:Math.min(Math.PI*radius*radius,upperCells*64),centerSampleEstimatePx2:centerCells*64};
}
function boundaryEvidence(geometry,p){const values=[['void',nativeVoidPrimitives(geometry.terrain)],['solid',geometry.solidPrimitives]].map(([kind,primitives])=>{let distance=Infinity,primitive=null;for(const candidate of primitives){const d=nativePrimitiveDistance(nativePrimitiveTree([candidate]),p.x,p.y);if(d<distance){distance=d;primitive=candidate;}}return{kind,distancePx:distance,primitive};});return{point:p,sources:values,limitingKind:values[0].distancePx<=values[1].distancePx?'void':'solid'};}
function dualMeasure(id,geometry,groups,oldGate,diagnostic,extra={}){const tree=nativePrimitiveTree(groups.structures.flatMap(s=>s.boundary)),error=oldGate.metrics.distanceCellUpperErrorPx;let maximum=-Infinity,worst=-1,violations=0,checked=0;const values=new Float64Array(geometry.supported.length);values.fill(-1);
  for(let cell=0;cell<geometry.supported.length;cell++)if(geometry.supported[cell]){const p=nativeCellPoint(cell,geometry.terrain.cols),internal=nativePrimitiveDistance(tree,p.x,p.y),open=Math.min(geometry.solidDistance(p),geometry.voidDistance(p));values[cell]=open;checked++;if(open>internal+1e-8)violations++;if(open+error>maximum){maximum=open+error;worst=cell;}}
  const oldReasons=oldGate.reasons,newReasons=oldReasons.filter(r=>r!=='G1-largest-empty-radius');if(maximum>policy.maxEmptyRadiusPx){const oldIndex=oldReasons.indexOf('G1-largest-empty-radius');newReasons.splice(oldIndex>=0?oldIndex:newReasons.length,0,'G1-largest-empty-radius');}
  const oldPoint=oldGate.metrics.worstEmptyPoint,newPoint=nativeCellPoint(worst,geometry.terrain.cols);
  const proposed={...oldGate,accepted:newReasons.length===0,reasons:newReasons,metrics:{...oldGate.metrics,maxEmptyUpperPx:maximum,worstEmptyPoint:newPoint,internalMaxEmptyUpperPx:oldGate.metrics.maxEmptyUpperPx,internalWorstEmptyPoint:oldPoint}};
  const omitMax=m=>Object.fromEntries(Object.entries(m).filter(([k])=>!['maxEmptyUpperPx','worstEmptyPoint','internalMaxEmptyUpperPx','internalWorstEmptyPoint'].includes(k)));
  assert.deepEqual(omitMax(proposed.metrics),omitMax(oldGate.metrics));assert.equal(violations,0);assert(maximum<=oldGate.metrics.maxEmptyUpperPx+1e-8);
  const pointDiagnostic=p=>({point:p,internalDistancePx:nativePrimitiveDistance(tree,p.x,p.y),solidDistancePx:geometry.solidDistance(p),voidDistancePx:geometry.voidDistance(p),physicalOpenRadiusPx:Math.min(geometry.solidDistance(p),geometry.voidDistance(p)),landIntersection:localLandIntersection(geometry,p)});
  const row={id,...extra,oldGate,proposedGate:proposed,allNonMaxMetricsExactlyEqual:true,allNonMaxReasonsExactlyEqual:JSON.stringify(oldReasons.filter(r=>r!=='G1-largest-empty-radius'))===JSON.stringify(newReasons.filter(r=>r!=='G1-largest-empty-radius')),checkedSupportedCenters:checked,openGreaterThanInternalViolations:violations,oldWorst:pointDiagnostic(oldPoint),newWorst:pointDiagnostic(newPoint),oldWorstBoundary:boundaryEvidence(geometry,oldPoint),newWorstBoundary:boundaryEvidence(geometry,newPoint)};
  row.fieldSnapshot=persist(`${id}-fields`,{openDistances:values,oldDiagnostic:diagnostic});return row;
}
try{
  assert.equal(policy.maxEmptyRadiusPx,160);assert.equal(policy.deepEmptyThresholdPx,112);assert.equal(policy.maxDeepEmptySpanPx,448);
  const items=[...sources.map(s=>({kind:'saved',...s})),...fixtures.map(f=>({kind:'fixture',...f}))];
  for(const [index,item]of items.entries()){
    checkpoint();const row=budget.run({kind:'final-geometry',candidate:index},()=>{
      let geometry,groups,input,proposal,savedGate,world,holeArgs,bayArgs;
      if(item.kind==='saved'){
        const saved=JSON.parse(fs.readFileSync(item.file,'utf8'));({input,proposal,gate:savedGate}=saved);world=input.world;
        if(item.capture){report.snapshotRestorations++;geometry=queries(captured.candidate.geometry);groups={...captured.candidate.groups,structures:captured.candidate.groups.structures.map(s=>{const tree=nativePrimitiveTree(s.boundary);return{...s,distance:p=>nativePrimitiveDistance(tree,p.x,p.y)};})};}
        else{report.geometryConstructions++;attempt.finalGeometryEvaluations++;geometry=buildNativeSpatialGeometry(proposal.definition,20261012);groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);}
        persist(`${item.id}-geometry`,{geometry,groups,input,proposal});assert.equal(nativeSpatialGeometryFingerprint(geometry,proposal).hash,item.hash,'Frozen geometry identity drifted');
        holeArgs={placements:proposal.holes,profiles:input.holeProfiles};bayArgs={landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx};
      }else{report.geometryConstructions++;attempt.finalGeometryEvaluations++;const built=fixtureGeometry(item);geometry=built.geometry;groups=identifyNativeSpatialStructures(geometry,built.assemblies,policy);world={targetWalkAreaPx2:geometry.supportedCount*64};persist(`${item.id}-geometry`,{geometry,groups,fixture:item});}
      assert(report.geometryConstructions<=7);let diagnostic;const oldGate=evaluateNativeSpatialGeometry(geometry,groups,policy,world,holeArgs,bayArgs,d=>{diagnostic=d;});
      persist(`${item.id}-old-measure`,{oldGate,diagnostic});if(savedGate)assert.deepEqual(JSON.parse(JSON.stringify(oldGate)),savedGate,'Original production geometry gate changed before calibration');
      const measured=dualMeasure(item.id,geometry,groups,oldGate,diagnostic,{kind:item.kind,expectedGeometryHash:item.hash??null});
      if(item.probe){measured.cornerProbe={point:item.probe,internalDistancePx:nativePrimitiveDistance(nativePrimitiveTree(groups.structures.flatMap(s=>s.boundary)),item.probe.x,item.probe.y),openRadiusPx:Math.min(geometry.solidDistance(item.probe),geometry.voidDistance(item.probe)),supported:geometry.collision.supports(item.probe,10,10)};}
      if(item.bandBounds){const[l,t,r,b]=item.bandBounds;measured.band={bounds:item.bandBounds,geometricTransverseWidthPx:b-t,lengthPx:r-l,scope:'True axis-aligned land cross-section of the predeclared middle band; not a G4 route gate or G2 witness.',validHoles:groups.structures.filter(s=>s.kind==='hole').length,validSolids:groups.structures.filter(s=>s.kind==='solid').length};}
      measured.geometryQualifiedForFixture=groups.rejected.length===0&&geometry.reachableCount===geometry.supportedCount&&oldGate.metrics.finalSourceSupportViolationCount===0;
      report.samples.push(measured);save();return{accepted:oldGate.accepted,reasons:oldGate.reasons,row:measured};
    });assert(row.row);checkpoint();save();
  }
  const byId=Object.fromEntries(report.samples.map(s=>[s.id,s])),checks=[];const check=(id,fn)=>{try{fn();checks.push({id,passed:true});}catch(error){checks.push({id,passed:false,error:String(error.message)});}};
  check('all-nonmax-fields-and-reasons-identical',()=>assert(report.samples.every(s=>s.allNonMaxMetricsExactlyEqual&&s.allNonMaxReasonsExactlyEqual&&s.openGreaterThanInternalViolations===0)));
  check('real-large-ground-still-rejected-by-max',()=>assert(byId['large-open-ground'].proposedGate.reasons.includes('G1-largest-empty-radius')));
  check('short-corner-not-misreported-as-large-physical-circle',()=>{const s=byId['short-shore-corner'];assert(s.cornerProbe.supported);assert(s.cornerProbe.internalDistancePx>160);assert(s.cornerProbe.openRadiusPx<160);assert(!s.proposedGate.reasons.includes('G1-largest-empty-radius'));assert(s.oldGate.metrics.maxDeepSpanPx<=448);});
  check('empty-long-band-keeps-internal-deep-rejection',()=>{const s=byId['long-empty-shore-band'];assert(s.oldGate.reasons.includes('G1-long-deep-empty-region'));assert(s.proposedGate.reasons.includes('G1-long-deep-empty-region'));});
  check('structured-same-long-band-not-rejected-for-length-alone',()=>{const s=byId['same-long-band-with-structures'];assert(s.geometryQualifiedForFixture);assert.equal(s.oldGate.metrics.solids,fixtures[3].solids.length);assert(!s.oldGate.reasons.includes('G1-long-deep-empty-region'));assert(!s.oldGate.reasons.includes('G3-wide-domain-area'));assert(!s.oldGate.reasons.includes('G3-wide-domain-connectivity'));});
  check('c27-nonmax-and-original-c3-deep-failure-preserved',()=>{assert(!byId.c27.proposedGate.reasons.includes('G1-largest-empty-radius'));assert(byId['original-c3'].oldGate.reasons.includes('G1-long-deep-empty-region'));assert(byId['original-c3'].proposedGate.reasons.includes('G1-long-deep-empty-region'));assert.equal(byId['original-c3'].oldGate.metrics.maxDeepSpanPx,696);});
  report.checks=checks;report.status=checks.every(c=>c.passed)?'offline-calibration-supported':'offline-calibration-incomplete-or-counterexample';
}catch(error){report.status='failed';report.error=String(error.stack??error);}finally{report.elapsedMs=performance.now()-started;report.sourceHashesAfter=hashes();report.sourcesStable=JSON.stringify(before)===JSON.stringify(report.sourceHashesAfter);if(!report.sourcesStable)report.status='invalid-source-changed';save();}
console.log(JSON.stringify({status:report.status,sourcesStable:report.sourcesStable,elapsedMs:report.elapsedMs,geometryConstructions:report.geometryConstructions,snapshotRestorations:report.snapshotRestorations,work:attempt.geometryEvaluations,samples:report.samples.map(s=>({id:s.id,oldMax:s.oldGate.metrics.maxEmptyUpperPx,newMax:s.proposedGate.metrics.maxEmptyUpperPx,deep:s.oldGate.metrics.maxDeepSpanPx,wide:s.oldGate.metrics.wideRatio,largestWide:s.oldGate.metrics.largestWideRatio,qualified:s.geometryQualifiedForFixture,oldReasons:s.oldGate.reasons,newReasons:s.proposedGate.reasons})),checks:report.checks,error:report.error},null,2));
if(report.status!=='offline-calibration-supported')process.exitCode=1;
