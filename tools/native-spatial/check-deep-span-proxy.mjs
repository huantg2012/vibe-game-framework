/** Independent topology counterexamples for the proposal-only 16px objective. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createNativeDeepSpanProxy} from '../../src/generation/world-study/native-spatial-layout.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output),'fresh report required');
const rows=[];const check=(name,fn)=>{fn();rows.push({name,passed:true});};
const points=Array.from({length:64*8},(_,i)=>({x:(i%64)*16+4+8*(i%2),y:Math.floor(i/64)*16+4+8*(Math.floor(i/64)%2)}));
const span=createNativeDeepSpanProxy(points,112);
check('equal-distance-histograms-distinguish-long-band-from-separated-pockets',()=>{
 const band=points.map((_,i)=>Math.floor(i/64)<4?130:80),pockets=points.map((_,i)=>(i%64)%16<8?130:80);
 assert.equal(band.filter(d=>d===130).length,pockets.filter(d=>d===130).length);assert.equal(span(band),1024);assert.equal(span(pockets),128);
});
check('cutting-a-band-changes-connected-span-without-changing-global-bounds',()=>{
 const before=points.map(()=>130),after=points.map((_,i)=>[20,21,42,43].includes(i%64)?80:130);
 assert.equal(span(before),1024);assert.equal(span(after),320);
});
check('appended-exact-hotspot-cannot-bridge-field-components',()=>{
 const sparse=[{x:4,y:4},{x:36,y:4}],proxy=createNativeDeepSpanProxy(sparse,112);assert.equal(proxy([130,130,Infinity]),16);
});
check('missing-support-cells-do-not-create-diagonal-links',()=>{
 const proxy=createNativeDeepSpanProxy([{x:4,y:4},{x:20,y:20}],112);assert.equal(proxy([130,130]),16);
});
check('duplicate-field-cell-is-rejected',()=>assert.throws(()=>createNativeDeepSpanProxy([{x:4,y:4},{x:12,y:12}],112),/Duplicate/));
check('empty-domain-and-no-deep-cells-return-zero',()=>{assert.equal(createNativeDeepSpanProxy([],112)([]),0);assert.equal(span(points.map(()=>80)),0);});
const load=Array.from({length:96*72},(_,i)=>({x:i%96*16+4+(i%2)*8,y:Math.floor(i/96)*16+4+(Math.floor(i/96)%2)*8})),measure=createNativeDeepSpanProxy(load,112),distances=load.map((_,i)=>(i%96)%19<3?80:130);
for(let i=0;i<20;i++)measure(distances);const start=performance.now();for(let i=0;i<1000;i++)measure(distances);const elapsedMs=performance.now()-start;
const report={status:'passed',scope:'Proposal estimator only; does not admit final geometry or replace 8px body erosion.',cases:rows,benchmark:{points:load.length,evaluations:1000,totalMs:elapsedMs,msPerEvaluation:elapsedMs/1000,estimated12Finalists15ObjectsMs:elapsedMs/1000*12*15}};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
