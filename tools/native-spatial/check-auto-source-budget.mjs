/** Mother budgets are measured before layout, then frozen for exact replay. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {createNativeAutoRuntimeInput,validNativeAutoRuntimeInput} from '../../src/generation/world-study/native-auto-recipe.ts';
import {nativeAutoBudgetSource,nativeAutoSourceProjection} from '../../src/generation/world-study/native-auto-source.ts';
import {nativeConstructionFootprints} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
const seed=12345,results=[];
for(const worldId of ['cinder-ridge','ruptured-film']){
  const native=R100_NATIVE_WORLDS.find(w=>w.id===worldId).definitions.find(n=>n.grade==='low');
  const input=createNativeAutoRuntimeInput(native,'low',seed),assembly=input.nativeSpatial.assemblies[0],scale=assembly.sourceScale;
  const source=nativeAutoSourceProjection(native,seed,scale),limit=input.policy.targetWalkAreaPx2*input.policy.maxSourceAreaPercent/100;
  assert(scale>0&&scale<=1&&source.areaPx2<=limit);
  assert.deepEqual(source.instances.map(i=>[i.id,i.role]),native.instances.map(i=>[i.id,i.role]),'All source and relief instances survive');
  assert(validNativeAutoRuntimeInput(JSON.parse(JSON.stringify(input)),native,worldId),'Frozen scale replays');
  const unbounded=nativeAutoBudgetSource(native,seed,1e9);
  assert.equal(unbounded.scale,1,'Small mothers are never enlarged to fill the budget');
  results.push({worldId,scale,sourceAreaPx2:source.areaPx2,limit});
}
// Optional existing compiled candidates: compare the authoritative compiler's
// source triangles with the same transform used by planning and estimation.
for(const file of process.argv.slice(2)){
  const report=JSON.parse(fs.readFileSync(file,'utf8')),input=report.input,sourceIds=new Set(input.nativeSpatial.assemblies.flatMap(a=>[...a.sourceInstanceIds,...a.attachedReliefIds]));
  const native=R100_NATIVE_WORLDS.find(w=>w.id===report.worldId).definitions.find(n=>n.grade===report.grade);
  const source=report.definition.instances.filter(i=>sourceIds.has(i.id));
  assert.equal(source.length,native.instances.length);
  const actual=nativeConstructionFootprints(source,native.family,seed),box=actual.supportBounds;
  const area=(Math.max(...box.map(r=>r[0]+r[2]))-Math.min(...box.map(r=>r[0])))*(Math.max(...box.map(r=>r[1]+r[3]))-Math.min(...box.map(r=>r[1])));
  const expected=nativeAutoSourceProjection(native,seed,input.nativeSpatial.assemblies[0].sourceScale);
  assert(Math.abs(area-expected.areaPx2)<.2,'Compiled and planned projected footprint agree within Float32 translation roundoff');
  assert(area<=input.policy.targetWalkAreaPx2*input.policy.maxSourceAreaPercent/100+1);
}
console.log(JSON.stringify({status:'passed',scope:'bounded original-source budget and frozen whole-source preservation',results,compiledReports:process.argv.length-2}));
