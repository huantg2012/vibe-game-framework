/** Cross-layer regression: a locally valid v3 mesh is not authored-terrain compatible. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {SPATIAL_AUGMENTATION_POLICY as policy} from '../../src/generated/r100-spatial-augmentation.ts';
import {validSpatialAugmentationPolicy} from '../../src/generation/world-study/spatial-augmentation-types.ts';
import {buildNativeVolume,validateNativeVolumeSpec} from '../../src/generation/world-study/native-volume-geometry.ts';
import {validateNativeGroundEdgeOwnership} from '../../src/generation/world-study/native-volume-erosion.ts';
const output=process.argv[2]??'docs/qa/artifacts/spatial-augmentation-2026-10-13/algorithm/profile-capability-v4.json';
assert(!fs.existsSync(output),'Never overwrite prior evidence');
function spec(profile,maximum){return {id:1,family:profile.family,seed:20261012,x:384,y:384,rotation:profile.rotationOffsetRad,
  length:maximum?profile.maxLengthPx:profile.minLengthPx,width:maximum?profile.maxWidthPx:profile.minWidthPx,height:maximum?profile.maxHeightPx:profile.minHeightPx,
  thickness:profile.thicknessPx,fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion,
  blocking:1,constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile};}
function terrain(value){const {seed:_seed,blocking:_blocking,...instance}=value;return {instances:[{...instance,role:'solid'}],family:value.family,authoredErosion:true,erosion:[],cols:32,rows:24};}
assert(validSpatialAugmentationPolicy(policy));const cases=[];
for(const profile of policy.profiles)for(const maximum of [false,true]){
  const value=spec(profile,maximum);validateNativeVolumeSpec(value);const mesh=buildNativeVolume(value);assert(mesh.triangleCount>0);validateNativeGroundEdgeOwnership(terrain(value));
  cases.push({profile:profile.id,family:profile.family,endpoint:maximum?'maximum':'minimum',constructionVersion:profile.constructionVersion,triangles:mesh.triangleCount,status:'passed'});
}
const v3={...spec(policy.profiles.find(p=>p.family==='folded-slab'),false),constructionVersion:3,shapeProfile:'terrace-shelf'};
validateNativeVolumeSpec(v3);assert(buildNativeVolume(v3).triangleCount>0);
assert.throws(()=>validateNativeGroundEdgeOwnership(terrain(v3)),/Authored erosion requires construction 4/);
const stalePolicy=structuredClone(policy);stalePolicy.profiles[0].constructionVersion=3;stalePolicy.profiles[0].shapeProfile='terrace-shelf';
assert(!validSpatialAugmentationPolicy(stalePolicy),'A standalone-valid v3 mesh must be rejected at the frozen augmentation contract');
const report={status:'passed',sourceHash:policy.sourceHash,profiles:policy.profiles.length,endpointCases:cases,negativeControl:{standaloneV3MeshValid:true,authoredTerrainRejects:true,augmentationPolicyRejects:true},limits:['Capability/spec endpoint checks only; does not claim every proposal passes spatial or deployment guards.','No full world or image generation in this fixture.']};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,profiles:report.profiles,endpointCases:cases.length,negativeControl:report.negativeControl,output}));
