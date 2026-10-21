/** Mother budgets are measured before layout, then frozen for exact replay. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {R100_NATIVE_WORLDS} from '../../src/generated/r100-native-worlds.ts';
import {createNativeAutoRuntimeInput,validNativeAutoRuntimeInput} from '../../src/generation/world-study/native-auto-recipe.ts';
import {nativeAutoBudgetSource,nativeAutoSourceProjection} from '../../src/generation/world-study/native-auto-source.ts';
import {nativeConstructionFootprints} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
const seed=12345,results=[];
const unchangedFastScales={'cinder-ridge':.8922878425281607,'ruptured-film':.7615776213380717};
for(const worldId of ['cinder-ridge','ruptured-film']){
  const native=R100_NATIVE_WORLDS.find(w=>w.id===worldId).definitions.find(n=>n.grade==='low');
  const input=createNativeAutoRuntimeInput(native,'low',seed),assembly=input.nativeSpatial.assemblies[0],scale=assembly.sourceScale;
  const source=nativeAutoSourceProjection(native,seed,scale,input.policy.objectClearancePx),limit=input.policy.targetWalkAreaPx2*input.policy.maxSourceAreaPercent/100;
  assert(scale>0&&scale<=1&&source.areaPx2<=limit);
  assert.deepEqual(source.instances.map(i=>[i.id,i.role]),native.instances.map(i=>[i.id,i.role]),'All source and relief instances survive');
  assert(validNativeAutoRuntimeInput(JSON.parse(JSON.stringify(input)),native,worldId),'Frozen scale replays');
  assert.equal(nativeAutoBudgetSource(native,seed,limit).scale,unchangedFastScales[worldId],'Legacy transform keeps its exact two-projection result');
  assert.deepEqual(source.instances,input.preparedSource.instances,'Frozen prepared instances include final spacing');
  const unbounded=nativeAutoBudgetSource(native,seed,1e9);
  assert.equal(unbounded.scale,1,'Small mothers are never enlarged to fill the budget');
  results.push({worldId,scale,sourceAreaPx2:source.areaPx2,limit});
}
// Each source-only fixture makes one distinct compiler bound become active at
// scale .5. A smaller area budget must fail conservatively, never by attempting
// an illegal volume. These fixtures do not construct or evaluate a map.
const template=R100_NATIVE_WORLDS.find(w=>w.id==='cinder-ridge').definitions.find(n=>n.grade==='low');
const solid={...template.instances.find(i=>i.role==='solid'),id:1,x:0,y:0,rotation:0,length:160,width:120,height:20,thickness:4};
const relief={...template.instances.find(i=>i.role==='relief'),id:2,x:0,y:0,rotation:0,length:160,width:120,height:6,thickness:2};
const boundaryCases=[
  ['length',{length:32},{}],
  ['width',{width:24},{}],
  ['solid-height',{height:4},{}],
  ['solid-thickness',{thickness:2},{}],
  ['fixed-relief-thickness',{}, {thickness:27}],
];
for(const [name,solidPatch,reliefPatch] of boundaryCases){
  const native={...template,instances:[{...solid,...solidPatch},{...relief,...reliefPatch}]};
  const legal=nativeAutoSourceProjection(native,seed,.6),minimum=nativeAutoSourceProjection(native,seed,.5);
  const result=nativeAutoBudgetSource(native,seed,legal.areaPx2);
  assert(result.scale>=.5&&result.scale<=1,`${name}: scale remains in the legal source domain`);
  assert(result.areaPx2<=legal.areaPx2,`${name}: returned projection is actually feasible`);
  assert.deepEqual(result.instances.map(i=>[i.id,i.role]),native.instances.map(i=>[i.id,i.role]));
  assert.deepEqual(result.instances.filter(i=>i.role==='relief').map(i=>[i.height,i.thickness]),native.instances.filter(i=>i.role==='relief').map(i=>[i.height,i.thickness]));
  for(const instance of result.instances){
    assert(instance.length>=16&&instance.width>=12&&instance.height>=2&&instance.thickness>=1,`${name}: compiler minimum dimensions`);
    assert(instance.thickness<=.45*Math.min(instance.length,instance.width),`${name}: compiler thickness ratio`);
  }
  assert.throws(()=>nativeAutoBudgetSource(native,seed,minimum.areaPx2*.99),/^Error: Complete automatic source cannot fit its area budget$/,`${name}: impossible budget preserves refusal`);
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
  const expected=nativeAutoSourceProjection(native,seed,input.nativeSpatial.assemblies[0].sourceScale,input.preparedSource?input.policy.objectClearancePx:0);
  assert(Math.abs(area-expected.areaPx2)<.2,'Compiled and planned projected footprint agree within Float32 translation roundoff');
  assert(area<=input.policy.targetWalkAreaPx2*input.policy.maxSourceAreaPercent/100+1);
}
console.log(JSON.stringify({status:'passed',scope:'bounded original-source budget and frozen whole-source preservation',results,boundaryCases:boundaryCases.length,compiledReports:process.argv.length-2}));
