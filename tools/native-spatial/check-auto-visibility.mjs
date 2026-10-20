/** Small physical G2 fixtures only: no world construction, deployment or runtime. */
import assert from 'node:assert/strict';
import {NATIVE_SPATIAL_POLICY} from '../../src/generated/r100-native-spatial.ts';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {
  buildNativeSpatialGeometry,
  nativeCellPoint,
  nativePrimitiveDistance,
  nativePrimitiveTree,
  nativeVoidCellBoundary,
} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {
  evaluateNativeSpatialVisibility,
  nativeSpatialShortestPaths,
} from '../../src/generation/world-study/native-spatial-visibility.ts';
import {certifyNativeAutoVisibility} from '../../src/generation/world-study/native-auto-visibility.ts';
import {hasLineOfSight} from '../../src/utils/grid-raycast.ts';

const rectangle=(x,y,width,height)=>[
  {x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height},
];
// Reuse definition metadata only. The fixture has one rectangular floor, one
// hole and no model instances; its body support and links use the real compiler.
const geometry=buildNativeSpatialGeometry({
  ...R100_NATIVE_WORLDS[0].definitions[0],
  cols:8,rows:5,instances:[],
  terrainOutline:rectangle(0,0,256,160),
  erosion:[rectangle(112,56,32,48)],
  fragmentShapeVersion:'rectilinear-fragment-v1',
  spawn_x:24,spawn_y:24,
},12345);
const {cols,rows}=geometry.terrain;
const cells=Array.from(geometry.terrain.erosion,(value,cell)=>value?cell:-1).filter(cell=>cell>=0);
const boundary=nativeVoidCellBoundary(cells,cols,rows,1);
const tree=nativePrimitiveTree(boundary);
const hole={
  id:'H-fixture',kind:'hole',cells,boundary,bounds:tree,
  assemblyIds:[],instanceIds:[],componentCount:1,thickRadiusLowerPx:16,
  areaLowerPx2:cells.length*64,areaUpperPx2:cells.length*64,
  distance:point=>nativePrimitiveDistance(tree,point.x,point.y),
};
const policy={...NATIVE_SPATIAL_POLICY,maxCoverRoutePx:64};
const strictPolicy={...policy,maxCoverRoutePx:40};
const coarse=evaluateNativeSpatialVisibility(geometry,[hole],policy);
const strictCoarse=evaluateNativeSpatialVisibility(geometry,[hole],strictPolicy);
const fullFine=evaluateNativeSpatialVisibility(geometry,[hole],{...strictPolicy,probeStepPx:8});
const budget={maxQ:512,maxLosChecks:131072,maxPathQueries:512,maxCoverageRecomputes:16};
const certificate=result=>result.metrics.visibilityCertificate;
const refine=(base=coarse,settings=policy,limits=budget,field=geometry,holes=[hole])=>
  certifyNativeAutoVisibility(field,holes,settings,base,()=>{},limits);
const savedGeometry={
  reachable:geometry.reachable.slice(),
  supported:geometry.supported.slice(),
  links8:geometry.links8.slice(),
  matter:geometry.terrain.matter.slice(),
};
const savedCoarse=structuredClone(coarse);
let cases=0;
function check(name,verify){
  try {verify();cases++;}
  catch(error){throw new Error(name,{cause:error});}
}

check('The coarse rejection is a genuine sampling gap on the same physical graph',()=>{
  assert.equal(geometry.reachableCount,492);
  assert.deepEqual(coarse.reasons,['body-route-to-cover-exceeds-limit']);
  assert.equal(coarse.metrics.coverage.maxRoutePx,65.942);
  assert(fullFine.accepted);
  assert.equal(fullFine.metrics.coverage.maxRoutePx,24);
});

const result=refine();
check('An added true witness certifies every body centre under the original limit',()=>{
  assert(result.accepted);
  assert.deepEqual(result.reasons,[]);
  assert.equal(certificate(result).status,'certified');
  assert.equal(certificate(result).reason,'all-body-centers-covered');
  assert(certificate(result).witnesses.length>0);
  assert.deepEqual(certificate(result).coarseCoverage,coarse.metrics.coverage);
  assert.deepEqual(certificate(result).coverage,result.metrics.coverage);
  assert.equal(result.metrics.coverage.checkedBodyCenters,geometry.reachableCount);
  assert.equal(result.metrics.coverage.overLimit,0);
  assert.equal(result.metrics.coverage.unreachable,0);
  assert(result.metrics.coverage.maxRoutePx<=policy.maxCoverRoutePx);
  for(const q of coarse.metrics.qCells)assert(result.metrics.qCells.includes(q));
  const paths=nativeSpatialShortestPaths(geometry,result.metrics.qCells);
  let maximum=0;
  for(let cell=0;cell<geometry.reachable.length;cell++)if(geometry.reachable[cell]){
    assert(paths.distance[cell]/1000<=policy.maxCoverRoutePx);
    maximum=Math.max(maximum,paths.distance[cell]/1000);
  }
  assert.equal(result.metrics.coverage.maxRoutePx,maximum);
});

function verifyWitnesses(result){
  const removed=new Set(hole.cells);
  const ablated={...geometry.sight,isOpaque:(col,row)=>
    col<0||row<0||col>=cols||row>=rows||
    (!removed.has(row*cols+col)&&geometry.sight.isOpaque(col,row))};
  for(const witness of certificate(result).witnesses){
    assert.equal(witness.holeId,hole.id);
    assert(!coarse.metrics.qCells.includes(witness.q));
    assert(result.metrics.qCells.includes(witness.q));
    for(const cell of [witness.q,witness.v,witness.t]){
      assert(geometry.reachable[cell]);
      assert(geometry.collision.supports(nativeCellPoint(cell,cols),10,10));
    }
    const q=nativeCellPoint(witness.q,cols);
    const v=nativeCellPoint(witness.v,cols);
    const t=nativeCellPoint(witness.t,cols);
    assert(!hasLineOfSight(geometry.sight,q,t));
    assert(hasLineOfSight(ablated,q,t));
    assert(hasLineOfSight(geometry.sight,v,t));
    assert.equal(witness.querySightPx,Math.hypot(q.x-t.x,q.y-t.y));
    assert.equal(witness.sightPx,Math.hypot(v.x-t.x,v.y-t.y));
    assert(witness.querySightPx<=policy.referenceSightPx);
    assert(witness.sightPx<=policy.referenceSightPx);
    const paths=nativeSpatialShortestPaths(geometry,[witness.q]);
    assert.equal(witness.routePx,paths.distance[witness.v]/1000);
    assert(witness.routePx>=policy.revealRouteMinPx);
    assert(witness.routePx<=policy.revealRouteMaxPx);
  }
}
check('Every recorded q/v/t independently satisfies attribution and exact route bounds',()=>verifyWitnesses(result));

check('Qualification does not rewrite geometry or the coarse evidence',()=>{
  assert.deepEqual(geometry.reachable,savedGeometry.reachable);
  assert.deepEqual(geometry.supported,savedGeometry.supported);
  assert.deepEqual(geometry.links8,savedGeometry.links8);
  assert.deepEqual(geometry.terrain.matter,savedGeometry.matter);
  assert.deepEqual(coarse,savedCoarse);
  assert.deepEqual(result.metrics.holes,coarse.metrics.holes);
});

check('Repeated qualification is deterministic',()=>assert.deepEqual(refine(),result));

for(const [name,key,reason,workKey] of [
  ['q','maxQ','q-budget','qAttempts'],
  ['LOS','maxLosChecks','los-budget','losChecks'],
  ['path','maxPathQueries','path-budget','pathQueries'],
  ['coverage','maxCoverageRecomputes','coverage-budget','coverageRecomputes'],
]){
  check(`${name} exhaustion retains the failed coverage gate`,()=>{
    const limited=refine(strictCoarse,strictPolicy,{...budget,[key]:1});
    assert(!limited.accepted);
    assert(limited.reasons.includes('body-route-to-cover-exceeds-limit'));
    assert.equal(certificate(limited).status,'unresolved');
    assert.equal(certificate(limited).reason,reason);
    assert.equal(certificate(limited).work[workKey],1);
    assert(limited.metrics.coverage.overLimit>0);
  });
}

check('Rescheduling reaches remaining failed regions within the unchanged local budget',()=>{
  const refined=refine(strictCoarse,strictPolicy);
  assert(fullFine.accepted);
  assert(refined.accepted);
  assert.equal(certificate(refined).reason,'all-body-centers-covered');
  assert(certificate(refined).work.coverageRecomputes<=budget.maxCoverageRecomputes);
  const qs=certificate(refined).witnesses.map(witness=>witness.q);
  assert.equal(new Set(qs).size,qs.length,'A proved q is never retried across refinement rounds');
  verifyWitnesses(refined);
  const paths=nativeSpatialShortestPaths(geometry,refined.metrics.qCells);
  for(let cell=0;cell<geometry.reachable.length;cell++)if(geometry.reachable[cell])
    assert(paths.distance[cell]/1000<=strictPolicy.maxCoverRoutePx);
});

check('Body blocking without optical blocking cannot produce a new witness',()=>{
  // Deliberately remove all interior sight blocking while retaining the body
  // graph. This isolates LOS causality from mere proximity to a body obstacle.
  const field={...geometry,sight:{...geometry.sight,isOpaque:(col,row)=>
    col<0||row<0||col>=cols||row>=rows}};
  const failed=refine(coarse,policy,budget,field);
  assert(!failed.accepted);
  assert.equal(certificate(failed).witnesses.length,0);
  assert.equal(certificate(failed).work.pathQueries,0);
  assert.deepEqual(failed.metrics.qCells,coarse.metrics.qCells);
});

check('A hole cannot claim occlusion supplied by cells outside its own identity',()=>{
  const failed=refine(coarse,policy,budget,geometry,[{...hole,cells:[]}]);
  assert(!failed.accepted);
  assert.equal(certificate(failed).witnesses.length,0);
  assert.deepEqual(failed.metrics.qCells,coarse.metrics.qCells);
});

check('Coverage proof preserves unrelated and frozen-hole witness rejections',()=>{
  const reasons=['hole:H-other:no-witness-in-frozen-probes','another-coarse-rejection'];
  const failed=refine({...coarse,reasons:[...coarse.reasons,...reasons]});
  assert(!failed.accepted);
  assert.equal(certificate(failed).status,'certified');
  assert.deepEqual(failed.reasons,reasons);
});

check('A coarse pass is returned by identity without any new work',()=>{
  const passed={...coarse,accepted:true,reasons:[]};
  assert.equal(certifyNativeAutoVisibility(geometry,[hole],policy,passed,()=>{
    throw new Error('Passing coarse result must not call checkpoint');
  }),passed);
});

check('Other coarse failures are returned by identity',()=>{
  const failed={...coarse,reasons:['hole:H-fixture:no-witness-in-frozen-probes']};
  assert.equal(refine(failed),failed);
});

check('No existing q means no coverage refinement can be certified',()=>{
  const failed={...coarse,metrics:{...coarse.metrics,qCells:[]}};
  assert.equal(refine(failed),failed);
});

check('Work cannot silently exceed a frozen certificate budget',()=>{
  assert.throws(()=>refine(coarse,policy,{...budget,maxQ:513}),/budget/);
});

check('Request cancellation is propagated without disguising it as a geometry rejection',()=>{
  const cancellation=new Error('fixture cancelled');
  assert.throws(()=>certifyNativeAutoVisibility(geometry,[hole],policy,coarse,()=>{
    throw cancellation;
  }),error=>error===cancellation);
});

console.log(JSON.stringify({
  status:'passed',cases,
  fixture:{bodyCenters:geometry.reachableCount,coarseMaxRoutePx:coarse.metrics.coverage.maxRoutePx,
    certifiedMaxRoutePx:result.metrics.coverage.maxRoutePx,additionalWitnesses:certificate(result).witnesses.length},
  scope:'Small physical VOID/body graph; real single-hole LOS attribution, exact route/coverage, finite budgets, preserved failures and cancellation. No real world generation.',
}));
