/** Detached diagnostic contracts only. No geometry build or layout sampling. */
import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {NATIVE_SPATIAL_POLICY as policy} from '../../src/generated/r100-native-spatial.ts';
import {nativePrimitive} from '../../src/generation/world-study/native-spatial-geometry.ts';
import {evaluateNativeSpatialGeometry} from '../../src/generation/world-study/native-spatial-measure.ts';
import {nativeSpatialLayoutFailureContext} from '../../src/generation/world-study/native-spatial-generation.ts';
const output=process.argv[2];assert(output&&!fs.existsSync(output));
const paths=['src/generation/world-study/native-spatial-measure.ts','src/generation/world-study/native-spatial-generation.ts','src/generation/world-study/native-spatial-types.ts','tools/native-spatial/check-runtime-diagnostics.mjs'];
const hashes=()=>Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),sourceHashes=hashes();
const cols=5,rows=5,count=cols*rows,supported=new Uint8Array(count).fill(1),links8=new Uint8Array(count).fill(255);
const geometry={terrain:{cols,rows,definition:{instances:[]},matter:new Uint8Array(count).fill(1),meshes:[],roles:new Map()},supported,supportedCount:count,reachableCount:count,links8,solidDistance:()=>100,voidDistance:()=>100};
const groups={structures:[{id:'fixture',kind:'hole',assemblyIds:[],instanceIds:[],cells:[],boundary:[nativePrimitive([-200,0,-200,40],1)],distance:()=>0}],rejected:[]};
const baseline=evaluateNativeSpatialGeometry(geometry,groups,policy,{targetWalkAreaPx2:count*64});
let copies=0;const slice=Uint8Array.prototype.slice;
Uint8Array.prototype.slice=function(...args){copies++;return slice.apply(this,args);};
let observed;
try{
  assert.deepEqual(evaluateNativeSpatialGeometry(geometry,groups,policy,{targetWalkAreaPx2:count*64}),baseline);assert.equal(copies,0,'No observer must allocate no diagnostic masks');
  const result=evaluateNativeSpatialGeometry(geometry,groups,policy,{targetWalkAreaPx2:count*64},undefined,undefined,diagnostic=>{
    observed=diagnostic;assert.equal(diagnostic.deep.reduce((a,b)=>a+b,0),25);assert.equal(diagnostic.deepBody.reduce((a,b)=>a+b,0),9);assert.equal(diagnostic.deepComponents.length,1);assert.equal(diagnostic.deepComponents[0].length,9);assert.equal(diagnostic.wide.reduce((a,b)=>a+b,0),25);
    assert.equal(diagnostic.distances[0],204);diagnostic.deep.fill(0);diagnostic.deepBody.fill(0);diagnostic.wide.fill(0);diagnostic.distances.fill(-1);diagnostic.deepComponents[0].splice(0);diagnostic.deepComponents.push([999]);
  });assert.deepEqual(result,baseline);assert.equal(copies,3);assert.equal(geometry.supported.reduce((a,b)=>a+b,0),25);
}finally{Uint8Array.prototype.slice=slice;}
assert(observed);assert.deepEqual(evaluateNativeSpatialGeometry(geometry,groups,policy,{targetWalkAreaPx2:count*64}),baseline);
const original={status:'state-budget',states:[{kind:'matching',legal:false}],domains:[{id:'a',count:3}],timings:{domainMs:1}},qualification={accepted:false,reasons:['hole-profile-final-identity'],invalidHoleIds:['hole-0']},error=Object.assign(new Error('fixture'),{initialPlacement:original,qualification}),context=nativeSpatialLayoutFailureContext(error);
assert.deepEqual(context,{initialPlacement:original,qualification});context.initialPlacement.states[0].legal=true;context.qualification.invalidHoleIds.push('mutated');assert.equal(original.states[0].legal,false);assert.deepEqual(qualification.invalidHoleIds,['hole-0']);assert.deepEqual(nativeSpatialLayoutFailureContext(new Error('plain')),{});
const source=fs.readFileSync(paths[1],'utf8');assert(source.includes('...nativeSpatialLayoutFailureContext(error)'));assert(source.includes('layout?.layoutSeed??mix32(requestedSeed,`${input.policy.algorithm}:${input.policy.version}:${input.policy.sourceHash}:${input.world.worldId}:${geometrySeed}:${candidate}`)'));
const sourceHashesAfter=hashes(),report={scope:'Manually supplied 5x5 gate arrays and failure objects; no geometry build, no map generation.',sourceHashes,sourceHashesAfter,sourcesStable:JSON.stringify(sourceHashes)===JSON.stringify(sourceHashesAfter),cases:[{id:'no-observer-equivalent-with-zero-copy',passed:true},{id:'observer-mutation-cannot-alter-gate-or-live-arrays',passed:true},{id:'bounded-failure-context-is-detached-and-wired-with-real-seed',passed:true}]};assert(report.sourcesStable);fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({sourcesStable:report.sourcesStable,cases:report.cases}));
