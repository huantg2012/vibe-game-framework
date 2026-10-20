/** Strict triangle-union qualification counterexamples; no layout generation. */
import assert from 'node:assert/strict';
import {nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {certifyNativeAutoSolidArea,qualifyNativeAutoSolidAreas} from '../../src/generation/world-study/native-auto-solid-area.ts';

const rectangle=(x,y,w,h)=>[nativePrimitive([x,y,x+w,y,x+w,y+h],1),nativePrimitive([x,y,x+w,y+h,x,y+h],1)];
// Each strip is narrower than a legacy 2px subsquare, while the full union is
// a solid 80x80 square. Its lower bound must recover real, not sampled, area.
const dense=Array.from({length:80},(_,x)=>rectangle(x,0,1,80)).flat();
const proof=certifyNativeAutoSolidArea(dense,1600);
assert(proof.accepted&&proof.areaLowerPx2>=1600&&proof.areaLowerPx2<=6400);
const reversed=dense.map(p=>nativePrimitive([p.points[4],p.points[5],p.points[2],p.points[3],p.points[0],p.points[1]],p.objectId));
assert(certifyNativeAutoSolidArea(reversed,1600).accepted,'Both triangle winding directions must work');
const small=rectangle(0,0,30,30);
const undersized=certifyNativeAutoSolidArea(small,1600);
assert(!undersized.accepted&&undersized.areaLowerPx2<=900&&undersized.reason==='resolution-limit');
const overlap=certifyNativeAutoSolidArea(Array.from({length:4},()=>small).flat(),1600);
assert(!overlap.accepted&&overlap.areaLowerPx2===undersized.areaLowerPx2,'Overlaps cannot multiply projected union area');
const cells=certifyNativeAutoSolidArea(dense,1600,()=>{},{maxCells:1,maxPrimitiveTests:8388608});
assert(!cells.accepted&&cells.reason==='cell-budget'&&cells.work.visitedCells===1);
const primitives=certifyNativeAutoSolidArea(dense,1600,()=>{},{maxCells:262144,maxPrimitiveTests:1});
assert(!primitives.accepted&&primitives.reason==='primitive-budget'&&primitives.work.primitiveTests===1);
const clipped=certifyNativeAutoSolidArea(rectangle(0,0,80,80),1600,()=>{},undefined,{cells:[0,0],cols:10});
assert(!clipped.accepted&&clipped.areaLowerPx2<=64,'Map root cells are clipped and deduplicated');
const degenerate=certifyNativeAutoSolidArea([nativePrimitive([0,0,80,80,160,160],1)],1600);
assert(!degenerate.accepted&&degenerate.areaLowerPx2===0);
assert.throws(()=>certifyNativeAutoSolidArea(dense,1600,()=>{},{maxCells:262145,maxPrimitiveTests:1}),/bounds/);
let checkpoints=0;certifyNativeAutoSolidArea(dense,1600,()=>{checkpoints++;});
assert(checkpoints>1,'Bounded proof remains interruptible');
const base={kind:'solid',boundary:dense,areaLowerPx2:0,cells:Array.from({length:100},(_,i)=>i)};
const identity={structures:[{...base,id:'S-large'},{...base,id:'S-small',boundary:small}],rejected:[],exteriorVoidCells:0,holeLabelByCell:new Int32Array()};
const qualified=qualifyNativeAutoSolidAreas(identity,10,1600,()=>{});
assert.deepEqual(qualified.groups.structures.map(s=>s.id),['S-large']);
assert.deepEqual(qualified.groups.rejected,[{id:'S-small',reasons:['solid-effective-area-too-small']}]);
assert.equal(qualified.areaCertificate.length,2);
console.log(JSON.stringify({status:'passed',cases:11,scope:'strict union lower bounds, winding, overlap, undersized, clipping, budgets and r14 qualification'}));
