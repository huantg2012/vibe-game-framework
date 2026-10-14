/** Independent geometric counterexamples; production geometry/20px collision, no screenshot proxies. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {buildNativeSpatialGeometry,nativeCellPoint} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {hasLineOfSight} from '../../src/utils/grid-raycast.ts';

const output=process.argv[2];assert(output,'Usage: check-contracts.mjs NEW_REPORT.json');assert(!fs.existsSync(output),'Preserve failed evidence');
const [columns,values]=fs.readFileSync('data/rift-native-spatial-policy.csv','utf8').trim().split(/\r?\n/).map(line=>line.split(','));
const policy=Object.fromEntries(columns.map((key,i)=>[key.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),values[i]==='true'?true:values[i]==='false'?false:Number.isFinite(Number(values[i]))?Number(values[i]):values[i]]));
assert.equal(policy.maxEmptyRadiusPx,160,'Counterexample contract expects the approved G1 threshold');
const generated=await import('../../src/generated/r100-native-spatial.ts');
for(const [key,value]of Object.entries(policy))if(typeof value!=='string')assert.deepEqual(generated.NATIVE_SPATIAL_POLICY[key],value,`Generated policy drift: ${key}`);
const recipe=JSON.parse(fs.readFileSync('docs/qa/artifacts/native-generation-2026-10-14/recovery/split-rib-causeway-medium-20261012.recipe.json','utf8'));
const rect=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
const seed=20261014;
const base={...recipe.nativeDefinition,id:'independent-native-contract',cols:32,rows:24,instances:[],erosion:[],terrainOutline:rect(32,32,960,704),spawn_x:100,spawn_y:100,exit_x:920,exit_y:680,search_x:200,search_y:200,enemy_x:800,enemy_y:600};delete base.fragmentShapeVersion;
const rows=[],sources=['tools/native-spatial/check-contracts.mjs','src/generation/world-study/native-spatial-geometry.ts','src/generation/world-study/native-spatial-measure.ts','data/rift-native-spatial-policy.csv','src/generated/r100-native-spatial.ts'];
const hashes=()=>Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')]));
const sourceHashes=hashes();
async function test(id,fn){const start=performance.now();try{const evidence=await fn();rows.push({id,passed:true,elapsedMs:performance.now()-start,...evidence});}catch(e){rows.push({id,passed:false,error:String(e.stack??e)});}console.log(JSON.stringify(rows.at(-1)));}
const geometry=(erosion=[],extra={})=>buildNativeSpatialGeometry({...base,erosion,...extra},seed);
const groups=g=>identifyNativeSpatialStructures(g,[],policy);
const intent=g=>({targetWalkAreaPx2:g.supportedCount*64});
await test('outside-shore-cannot-pay-internal-coverage',()=>{
 const g=geometry(),s=groups(g),gate=evaluateNativeSpatialGeometry(g,s,policy,intent(g));
 assert.equal(s.structures.length,0);assert(gate.reasons.includes('G1-largest-empty-radius'));assert(gate.reasons.includes('whole-world-hole-solid-ratio'));
 return{counts:s.structures.length,reasons:gate.reasons};
});
await test('tiny-hole-does-not-pay-effective-count',()=>{
 const g=geometry([rect(400,300,32,32)]),s=groups(g);assert.equal(s.structures.length,0);assert(s.rejected.some(r=>r.reasons.includes('hole-has-no-thick-core')));
 return{rejected:s.rejected};
});
await test('sixteen-pixel-strip-cannot-split-one-spatial-hole',()=>{
 const g=geometry([rect(320,240,128,160),rect(464,240,128,160)]),s=groups(g);
 assert.equal(g.collision.supports({x:456,y:320},10,10),false);assert.equal(s.structures.filter(s=>s.kind==='hole').length,1,'A 16px land strip is not a 20px body passage');
 return{groups:s.structures.map(s=>({id:s.id,components:s.componentCount}))};
});
await test('forty-pixel-passage-keeps-two-independent-holes',()=>{
 const g=geometry([rect(320,240,128,160),rect(488,240,128,160)]),s=groups(g);
 assert.equal(g.collision.supports({x:468,y:320},10,10),true);assert.equal(s.structures.filter(s=>s.kind==='hole').length,2);
 return{holeCount:2};
});
await test('holes-in-one-corner-cannot-hide-a-large-empty-field',()=>{
 const g=geometry([rect(180,160,112,112),rect(180,350,112,112)]),s=groups(g),gate=evaluateNativeSpatialGeometry(g,s,policy,intent(g));
 assert.equal(s.structures.filter(s=>s.kind==='hole').length,2);assert(gate.reasons.includes('G1-largest-empty-radius'));
 return{maxEmptyUpperPx:gate.metrics.maxEmptyUpperPx,worst:gate.metrics.worstEmptyPoint,reasons:gate.reasons};
});
await test('real-void-blocks-sight-and-body-at-same-shape',()=>{
 const g=geometry([rect(400,280,128,160)]),a={x:364,y:360},b={x:564,y:360};
 assert(g.collision.supports(a,10,10)&&g.collision.supports(b,10,10));assert.equal(hasLineOfSight(g.sight,a,b),false);
 assert(g.collision.displacementFraction(a,10,10,b.x-a.x,b.y-a.y)<1);return{a,b};
});
await test('diagonal-graph-edges-consume-real-body-sweeps',()=>{
 const g=geometry([rect(400,280,128,160)]);let checked=0;
 for(let cell=0;cell<g.links8.length;cell++)for(const [bit,dx,dy]of[[4,1,1],[5,-1,1],[6,-1,-1],[7,1,-1]])if(g.links8[cell]&(1<<bit)){
  assert(g.collision.displacementFraction(nativeCellPoint(cell,g.terrain.cols),10,10,dx*8,dy*8)>=1-1e-9);checked++;
 }
 assert(checked>0);return{checked};
});
const sourceHashesAfter=hashes(),stable=JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter);
const report={status:rows.every(r=>r.passed)&&stable?'passed':'failed',createdAt:new Date().toISOString(),sourceHashes,sourceHashesAfter,sourcesStable:stable,cases:rows,limits:['Small real-geometry counterexamples only; no full world generation, material or dynamic AI qualification.']};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(report.status!=='passed')process.exitCode=1;
