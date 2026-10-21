import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {nativeConstructionFootprints} from '../../src/generation/world-study/native-spatial-construction-shore.ts';
import {createNativeBodyPrimitiveProbe} from '../../src/generation/world-study/native-body-collision.ts';

const saved=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../docs/qa/artifacts/automatic-world-generation-2026-10-21/connected-source-pocket-before.json.gz',import.meta.url))));
const native=saved.recipe.nativeDefinition,seed=saved.recipe.nativeAuto.geometrySeed;
const footprint=nativeConstructionFootprints(native.instances,native.family,seed);
const reliefIds=new Set(native.instances.filter(i=>i.role==='relief').map(i=>i.id));
assert(reliefIds.size>0);
assert(!footprint.solidPrimitives.some(p=>reliefIds.has(p.objectId)),'Relief never becomes a physical obstacle');
const relief=footprint.supportPrimitives.filter(p=>reliefIds.has(p.objectId));
assert(relief.length>0,'Every projected relief face receives ground-support protection');
const probe=createNativeBodyPrimitiveProbe(footprint.supportPrimitives.map(p=>[0,2,4].map(i=>({x:p.points[i],y:p.points[i+1]}))));
for(const p of relief){
  const center={x:(p.points[0]+p.points[2]+p.points[4])/3,y:(p.points[1]+p.points[3]+p.points[5])/3};
  assert(!probe.supports(center,1,1),'A candidate hole cannot claim an existing relief face');
}
assert.deepEqual(footprint.supportPrimitives.filter(p=>!reliefIds.has(p.objectId)),footprint.solidPrimitives,'Existing solid projection stays identical');
console.log(`Source support: ${relief.length} original relief faces protected without collision promotion`);
