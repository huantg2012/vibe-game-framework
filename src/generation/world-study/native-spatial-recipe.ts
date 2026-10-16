/** Authoring is read only at departure. Replaying consumes this complete snapshot. */
import {NATIVE_SPATIAL_POLICY,NATIVE_SPATIAL_WORLDS,NATIVE_SPATIAL_HOLE_PROFILES,NATIVE_SPATIAL_BAY_PROFILES,NATIVE_SPATIAL_ASSEMBLIES,NATIVE_SPATIAL_SUBORDINATE_PROFILES} from '@/generated/r100-native-spatial';
import {R100_SPATIAL_CONFIG as CONFIG} from '@/generated/r100-spatial-data';
import {getR100SpatialDeploymentPolicy,validateR100SpatialDeploymentPolicy} from './r100-spatial-deployment';
import {validNativeSpatialFrozenInput} from './native-spatial-validation';
import type {NativeSpatialRuntimeInput} from './native-spatial-types';
import type {MasterDefinition} from './r100-master-world';

export function createNativeSpatialRuntimeInput(worldId:string,native:MasterDefinition):NativeSpatialRuntimeInput|undefined {
  const world=NATIVE_SPATIAL_WORLDS.find(row=>row.worldId===worldId&&row.enabled&&row.annotationStatus==='reviewed');
  if(!world||!NATIVE_SPATIAL_POLICY.enabled)return undefined;
  const input:NativeSpatialRuntimeInput={policy:NATIVE_SPATIAL_POLICY,world,holeProfiles:NATIVE_SPATIAL_HOLE_PROFILES,
    bayProfiles:NATIVE_SPATIAL_BAY_PROFILES.filter(profile=>world.bayProfileIds.includes(profile.id)),
    assemblies:NATIVE_SPATIAL_ASSEMBLIES.filter(row=>row.worldId===worldId&&(row.grade==='all'||row.grade===native.grade)),
    subordinateProfiles:NATIVE_SPATIAL_SUBORDINATE_PROFILES.filter(row=>row.family===native.family),
    extraction:{minPathDistancePx:CONFIG.extraction_min_path_distance,minEuclideanDistancePx:CONFIG.extraction_min_euclidean_distance,
      minPathFraction:CONFIG.extraction_min_path_fraction,maxPathFraction:CONFIG.extraction_max_path_fraction,
      clearanceHalfSize:CONFIG.extraction_clearance_half_size,regionCols:CONFIG.extraction_region_cols,
      regionRows:CONFIG.extraction_region_rows,distanceBands:CONFIG.extraction_distance_bands},
    deployment:getR100SpatialDeploymentPolicy()};
  if(!validNativeSpatialRuntimeInput(input,native,worldId))throw new Error(`Invalid reviewed native spatial intent: ${worldId}/${native.grade}`);
  return structuredClone(input);
}

export function validNativeSpatialRuntimeInput(value:unknown,native:MasterDefinition,worldId:string,surfacePixelBudget:4194304|8388608=4194304):value is NativeSpatialRuntimeInput {
  try {
    if(!value||typeof value!=='object'||Array.isArray(value))return false;
    const {extraction,deployment,...intent}=value as NativeSpatialRuntimeInput;
    if(!validNativeSpatialFrozenInput(intent,native,surfacePixelBudget)||intent.world.worldId!==worldId||!intent.world.enabled||!intent.policy.enabled)return false;
    if(!extraction||typeof extraction!=='object'||Array.isArray(extraction))return false;
    const e=extraction,keys=['minPathDistancePx','minEuclideanDistancePx','minPathFraction','maxPathFraction','clearanceHalfSize','regionCols','regionRows','distanceBands'];
    if(Object.keys(e).length!==keys.length||!keys.every(key=>Object.prototype.hasOwnProperty.call(e,key)))return false;
    const range=(v:number,min:number,max:number)=>Number.isFinite(v)&&v>=min&&v<=max;
    if(!range(e.minPathDistancePx,700,8000)||!range(e.minEuclideanDistancePx,400,2000)||!range(e.minPathFraction,.1,.8)||!range(e.maxPathFraction,.5,1)||e.minPathFraction>=e.maxPathFraction
      ||!range(e.clearanceHalfSize,20,80)||![e.regionCols,e.regionRows,e.distanceBands].every(v=>Number.isInteger(v)&&range(v,2,8)))return false;
    validateR100SpatialDeploymentPolicy(deployment);
    return true;
  }catch{return false;}
}
