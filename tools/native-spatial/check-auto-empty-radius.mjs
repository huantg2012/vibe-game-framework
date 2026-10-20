/** Bound/witness counterexamples plus optional reuse of an existing definition. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {certifyNativeAutoEmptyRadius} from '../../src/generation/world-study/native-auto-empty-radius.ts';
import {buildNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
const domain=(distance,supports=()=>true)=>({terrain:{cols:1},supported:new Uint8Array([1]),
  solidDistance:distance,voidDistance:()=>Infinity,collision:{supports}});
const certified=certifyNativeAutoEmptyRadius(domain(()=>156),160);
assert(156+4*Math.SQRT2>160);
assert(certified.accepted&&certified.certifiedUpperPx<=160&&certified.work.refinedCells>0);
const actual=certifyNativeAutoEmptyRadius(domain(()=>161),160);
assert(!actual.accepted&&actual.status==='violated'&&actual.witness.distancePx===161);
const betweenCenters=certifyNativeAutoEmptyRadius(domain(p=>161-Math.hypot(p.x-6,p.y-6)),160);
assert(!betweenCenters.accepted&&betweenCenters.status==='violated'&&betweenCenters.witness.x===6&&betweenCenters.witness.y===6);
const depth=certifyNativeAutoEmptyRadius(domain(()=>156),160,()=>{},{maxDepth:0,maxPoints:65536});
assert(!depth.accepted&&depth.reason==='depth-budget'&&depth.certifiedUpperPx===null);
const points=certifyNativeAutoEmptyRadius(domain(()=>156),160,()=>{},{maxDepth:8,maxPoints:1});
assert(!points.accepted&&points.reason==='point-budget'&&points.work.pointEvaluations===1&&points.certifiedUpperPx===null);
const illegal=certifyNativeAutoEmptyRadius(domain(()=>161,()=>false),160,()=>{},{maxDepth:0,maxPoints:65536});
assert(!illegal.accepted&&illegal.witness===null,'An illegal 20px body is not a counterexample');
const invalid=certifyNativeAutoEmptyRadius(domain(()=>NaN),160);
assert(!invalid.accepted&&invalid.reason==='invalid-distance');
assert.throws(()=>certifyNativeAutoEmptyRadius(domain(()=>0),10),/bounds/);
const mixed={...domain(p=>156-Math.max(0,p.x-4)/4),terrain:{cols:2},supported:new Uint8Array([1,1])};
const retainedLeaf=certifyNativeAutoEmptyRadius(mixed,160);
assert(retainedLeaf.accepted&&retainedLeaf.certifiedUpperPx>=154+4*Math.SQRT2,
  'A coarse certified leaf must remain in the global upper bound after another cell is refined');
const native=R100_NATIVE_WORLDS[0].definitions[0];
const square=(span)=>buildNativeSpatialGeometry({...native,cols:Math.ceil(span/32),rows:Math.ceil(span/32),instances:[],
  terrainOutline:[{x:0,y:0},{x:span,y:0},{x:span,y:span},{x:0,y:span}],erosion:[],
  fragmentShapeVersion:'rectilinear-fragment-v1',spawn_x:span/2,spawn_y:span/2},12345);
const safeSquare=certifyNativeAutoEmptyRadius(square(312),160);
assert(safeSquare.accepted&&safeSquare.work.refinedCells>0&&safeSquare.certifiedUpperPx<=160);
const unsafeSquare=certifyNativeAutoEmptyRadius(square(328),160);
assert(!unsafeSquare.accepted&&unsafeSquare.witness?.distancePx>160);
const exactSquare=certifyNativeAutoEmptyRadius(square(320),160);
assert(!exactSquare.accepted&&exactSquare.status==='unresolved'&&exactSquare.witness===null,
  'An unresolved exact-limit ridge must not be admitted by subtracting corner error');
console.log(JSON.stringify({status:'passed',cases:12,scope:'Lipschitz bounds, physical square fixtures, legal witnesses, budgets and domain precondition'}));

const [input,output]=process.argv.slice(2);
if(input){
  assert(output&&!fs.existsSync(output),'Need a fresh certificate report path');
  const prior=JSON.parse(fs.readFileSync(input,'utf8')),started=performance.now();
  const geometry=buildNativeSpatialGeometry(prior.definition,prior.seed);
  const certificate=certifyNativeAutoEmptyRadius(geometry,160);
  const report={input,geometryHash:prior.trace.geometryHash,coarseUpperPx:prior.trace.gates.geometry.metrics.maxEmptyUpperPx,
    certificate,elapsedMs:performance.now()-started,scope:'existing definition only; no layout search or new candidate'};
  fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
