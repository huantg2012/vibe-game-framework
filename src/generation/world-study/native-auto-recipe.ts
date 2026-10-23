/** Automatic construction reads shared policies only. It never looks up a
 * world's hand-positioned spatial intent, assembly registration or layout CSV. */
import {NATIVE_AUTO_CONSTRUCTION_POLICIES} from '@/generated/r100-native-auto-construction';
import {NATIVE_SPATIAL_POLICY,NATIVE_SPATIAL_HOLE_PROFILES,NATIVE_SPATIAL_BAY_PROFILES,NATIVE_SPATIAL_SUBORDINATE_PROFILES} from '@/generated/r100-native-spatial';
import {R100_SPATIAL_CONFIG as CONFIG} from '@/generated/r100-spatial-data';
import {getR100SpatialDeploymentPolicy} from './r100-spatial-deployment';
import {nativeConstructionFootprints} from './native-spatial-construction-shore';
import {nativePrimitiveDistance,nativePrimitiveTree} from './native-spatial-geometry';
import {nativeRectUnionArea,describeNativeSpatialLand} from './native-spatial-land';
import {nativeAutoHole} from './native-auto-layout';
import {nativeAutoCounts} from './native-auto-counts';
import {nativeAutoBudgetSource,nativeAutoSourceProjection,nativeAutoPreparedSourceInstances} from './native-auto-source';
import {validNativeSpatialRuntimeInput} from './native-spatial-recipe';
import type {MasterDefinition} from './r100-master-world';
import type {PollutionGrade} from './pollution-grade';
import type {NativeAutoRuntimeInput} from './native-auto-types';

const ceil16=(value:number)=>Math.ceil(value/16)*16;
/** A bounded alternative varies the projection seed, never the captured policy
 * or source model. Rebind its prepared geometry to that same seed. */
export function nativeAutoInputForGeometrySeed(input:NativeAutoRuntimeInput,native:MasterDefinition,geometrySeed:number):NativeAutoRuntimeInput {
  if(geometrySeed===input.geometrySeed)return input;
  return {...input,geometrySeed,preparedSource:{algorithm:input.preparedSource.algorithm,
    instances:nativeAutoPreparedSourceInstances(native,geometrySeed,input.nativeSpatial.assemblies[0]!.sourceScale,input.policy.objectClearancePx)}};
}
/** Diagnostic binding to the entire model; the model itself is frozen by the recipe. */
export function nativeAutoSourceFingerprint(native:MasterDefinition):string {
  const source=JSON.stringify(native);let hash=2166136261;
  for(let index=0;index<source.length;index++)hash=Math.imul(hash^source.charCodeAt(index),16777619);
  return(hash>>>0).toString(16).padStart(8,'0');
}

export function createNativeAutoRuntimeInput(native:MasterDefinition,grade:PollutionGrade,seed:number):NativeAutoRuntimeInput {
  if(native.grade!==grade||!Number.isSafeInteger(seed)||seed<0||seed>0xffffffff)throw new Error('Invalid automatic geometry source grade or seed');
  const policy=NATIVE_AUTO_CONSTRUCTION_POLICIES.find(row=>row.grade===grade);
  if(!policy)throw new Error(`Missing shared automatic policy: ${grade}`);
  const solids=native.instances.filter(instance=>instance.role==='solid');
  if(!solids.length)throw new Error('Automatic construction needs complete solid source material');
  const budgetedSource=nativeAutoBudgetSource(native,seed,policy.targetWalkAreaPx2*policy.maxSourceAreaPercent/100,policy.objectClearancePx);
  const source=budgetedSource.footprint,sourceWidth=budgetedSource.width,sourceHeight=budgetedSource.height;
  let coreWidth=Math.max(policy.coreWidthPx,ceil16(sourceWidth+policy.sourcePaddingPx*2));
  let coreHeight=Math.max(policy.coreHeightPx,ceil16(sourceHeight+policy.sourcePaddingPx*2));
  const {solids:solidCount,holes:holeCount}=nativeAutoCounts(policy.targetWalkAreaPx2,NATIVE_SPATIAL_POLICY);
  const projectedBodyArea=(primitives:typeof source.solidPrimitives):number=>{
    const tree=nativePrimitiveTree(primitives);
    const left=Math.floor(Math.min(...primitives.map(p=>p.minX))-10),right=Math.ceil(Math.max(...primitives.map(p=>p.maxX))+10);
    const top=Math.floor(Math.min(...primitives.map(p=>p.minY))-10),bottom=Math.ceil(Math.max(...primitives.map(p=>p.maxY))+10);
    let area=0;
    for(let y=top;y<=bottom;y+=16)for(let x=left;x<=right;x+=16)if(nativePrimitiveDistance(tree,x,y)<=10)area+=256;
    return area;
  };
  let estimatedBlockedAreaPx2=projectedBodyArea(source.solidPrimitives);
  for(let index=0;index<holeCount;index++){
    const hole=nativeAutoHole(index,seed,NATIVE_SPATIAL_HOLE_PROFILES);
    estimatedBlockedAreaPx2+=nativeRectUnionArea(hole.rects.map(([x,y,w,h])=>[x-10,y-10,w+20,h+20]));
  }
  const subordinates=NATIVE_SPATIAL_SUBORDINATE_PROFILES.filter(profile=>profile.family===native.family);
  for(let index=0;index<solidCount-1;index++){
    const profile=subordinates[index%subordinates.length];
    if(!profile)throw new Error('Missing automatic material profile');
    const instance:MasterDefinition['instances'][number]={id:Math.max(...native.instances.map(i=>i.id))+1+index,role:'solid',family:profile.family,
      constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile,x:0,y:0,
      length:Math.round((profile.minLengthPx+profile.maxLengthPx)/16)*8,width:Math.round((profile.minWidthPx+profile.maxWidthPx)/16)*8,
      height:(profile.minHeightPx+profile.maxHeightPx)/2,rotation:native.axis+profile.rotationOffsetRad,thickness:profile.thicknessPx,
      fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion};
    estimatedBlockedAreaPx2+=projectedBodyArea(nativeConstructionFootprints([instance],native.family,seed).solidPrimitives);
  }
  let estimatedBoundaryLossPx2=0,estimatedGrossAreaPx2=0;
  // Three arithmetic fixed-point steps reserve expected edge/body losses
  // before a layout exists. This never observes or fits a completed candidate.
  for(let step=0;step<3;step++){
    const land:import('./native-auto-types').NativeAutoRect[]=[[0,0,coreWidth,coreHeight],
      [-policy.armWidthPx+policy.armOverlapPx,(coreHeight-policy.armHeightPx)/2-policy.armOffsetPx,policy.armWidthPx,policy.armHeightPx],
      [coreWidth-policy.armOverlapPx,(coreHeight-policy.armHeightPx)/2+policy.armOffsetPx,policy.armWidthPx,policy.armHeightPx]];
    const measure=describeNativeSpatialLand(land);
    estimatedBoundaryLossPx2=Math.round(measure.perimeterPx*((policy.shoreDepthMinPx+policy.shoreDepthMaxPx)/4+10));
    estimatedGrossAreaPx2=measure.areaPx2;
    const shortage=policy.targetWalkAreaPx2+estimatedBlockedAreaPx2+estimatedBoundaryLossPx2-estimatedGrossAreaPx2;
    if(shortage<=0||step===2)break;
    const coreArea=coreWidth*coreHeight+shortage,ratio=policy.coreWidthPx/policy.coreHeightPx;
    coreWidth=Math.max(coreWidth,ceil16(Math.sqrt(coreArea*ratio)));coreHeight=Math.max(coreHeight,ceil16(coreArea/coreWidth));
  }
  const frameWidthPx=Math.max(1024,Math.ceil((coreWidth+2*(policy.armWidthPx-policy.armOverlapPx)+128)/32)*32);
  const frameHeightPx=Math.max(1024,Math.ceil((Math.max(coreHeight,policy.armHeightPx+2*policy.armOffsetPx)+128)/32)*32);
  const bayProfiles=NATIVE_SPATIAL_BAY_PROFILES;
  const input:NativeAutoRuntimeInput={algorithm:'native-auto-construction-v1',version:1,worldId:native.profile,grade,geometrySeed:seed,
    sourceFingerprint:nativeAutoSourceFingerprint(native),preparedSource:{algorithm:'native-source-clearance-v1',instances:budgetedSource.instances},policy,intent:{coreWidthPx:coreWidth,coreHeightPx:coreHeight,estimatedBlockedAreaPx2,estimatedBoundaryLossPx2,estimatedGrossAreaPx2},
    nativeSpatial:{
      policy:{...NATIVE_SPATIAL_POLICY,minWideRatio:policy.minWidePercent/100,maxGeometryEvaluations:1,maxFullCandidates:1},
      world:{worldId:native.profile,enabled:true,annotationStatus:'reviewed',targetWalkAreaPx2:policy.targetWalkAreaPx2,
        frameWidthPx,frameHeightPx,materialAxisRad:native.axis,landGrammar:'offset-overlap-v1',
        landRectMinCount:3,landRectMaxCount:3,landRectMinSpanPx:64,landRectMaxSpanPx:3072,
        landRectMinThicknessPx:64,landRectMaxThicknessPx:2304,landRectMinOverlapPx:policy.armOverlapPx,
        landCoreMinCount:1,landCoreMaxCount:1,landShoulderMinCount:2,landShoulderMaxCount:2,
        landShoulderMinSpanPx:policy.armWidthPx,landShoulderMaxSpanPx:policy.armWidthPx,
        landShoulderMinThicknessPx:policy.armHeightPx,landShoulderMaxThicknessPx:policy.armHeightPx,
        landShoulderMinExtensionPx:policy.armWidthPx-policy.armOverlapPx,landShoulderMaxExtensionPx:policy.armWidthPx-policy.armOverlapPx,
        landShoulderAttachment:'core-outward-normal-v1',bayGrammar:'shore-rect-cut-v1',
        bayProfileIds:bayProfiles.map(profile=>profile.id),bayCountOptions:[0]},
      holeProfiles:NATIVE_SPATIAL_HOLE_PROFILES,bayProfiles,
      assemblies:[{worldId:native.profile,grade:'all',id:'source-whole',sourceInstanceIds:solids.map(instance=>instance.id),
        attachedReliefIds:native.instances.filter(instance=>instance.role==='relief').map(instance=>instance.id),
        sourceScale:budgetedSource.scale,minScale:1,maxScale:1,rotationOffsetsRad:[0],maxSpanPx:ceil16(Math.max(sourceWidth,sourceHeight)+16),mode:'unique-once'}],
      subordinateProfiles:NATIVE_SPATIAL_SUBORDINATE_PROFILES.filter(profile=>profile.family===native.family),
      extraction:{minPathDistancePx:CONFIG.extraction_min_path_distance,minEuclideanDistancePx:CONFIG.extraction_min_euclidean_distance,
        minPathFraction:CONFIG.extraction_min_path_fraction,maxPathFraction:CONFIG.extraction_max_path_fraction,
        clearanceHalfSize:CONFIG.extraction_clearance_half_size,regionCols:CONFIG.extraction_region_cols,
        regionRows:CONFIG.extraction_region_rows,distanceBands:CONFIG.extraction_distance_bands},
      deployment:getR100SpatialDeploymentPolicy()}};
  if(!validNativeAutoRuntimeInput(input,native,native.profile))throw new Error(`Unsupported automatic source footprint: ${native.profile}/${grade} (${frameWidthPx}×${frameHeightPx})`);
  return structuredClone(input);
}

/** Recovery validates the captured values, without reading the current policy catalog. */
export function validNativeAutoRuntimeInput(value:unknown,native:MasterDefinition,worldId:string):value is NativeAutoRuntimeInput {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const input=value as NativeAutoRuntimeInput,p=input.policy;
  if(Object.keys(input).sort().join(',')!==['algorithm','version','worldId','grade','geometrySeed','sourceFingerprint','preparedSource','policy','intent','nativeSpatial'].sort().join(',')
    ||input.algorithm!=='native-auto-construction-v1'||input.version!==1||input.worldId!==worldId||worldId!==native.profile
    ||input.grade!==native.grade||!Number.isSafeInteger(input.geometrySeed)||input.geometrySeed<0||input.geometrySeed>0xffffffff
    ||input.sourceFingerprint!==nativeAutoSourceFingerprint(native)||!p||p.grade!==input.grade||!/^[0-9a-f]{64}$/.test(p.sourceHash))return false;
  const numbers=['targetWalkAreaPx2','coreWidthPx','coreHeightPx','armWidthPx','armHeightPx','armOverlapPx','armOffsetPx','siteSpacingPx',
    'siteJitterPx','edgeClearancePx','objectClearancePx','sourcePaddingPx','maxSiteEvaluations','maxPlacementStates','placementBranchLimit','refinementPasses','maxRefinementEvaluations','minWidePercent','targetWidePercent','maxSourceAreaPercent','shoreSegmentMinPx','shoreSegmentMaxPx',
    'shoreDepthMinPx','shoreDepthMaxPx','shoreProtectedGapPx','maxCleanRunPx'] as const;
  if(Object.keys(p).length!==numbers.length+2||numbers.some(key=>!Number.isSafeInteger(p[key])||p[key]<=0||p[key]>8388608)
    ||p.maxSiteEvaluations>2048||p.maxPlacementStates>2048||p.placementBranchLimit>8||p.refinementPasses>3||p.maxRefinementEvaluations>8192||p.armOverlapPx>=p.armWidthPx||p.siteJitterPx>=p.siteSpacingPx/4
    ||p.coreWidthPx>3072||p.coreHeightPx>2304||p.armWidthPx>3072||p.armHeightPx>2304
    ||p.shoreSegmentMinPx>p.shoreSegmentMaxPx||p.shoreDepthMinPx>p.shoreDepthMaxPx
    ||p.minWidePercent<=0||p.minWidePercent>p.targetWidePercent||p.targetWidePercent>100||p.maxSourceAreaPercent>100
    ||numbers.some(key=>key.endsWith('Px')&&p[key]%8!==0))return false;
  const intent=input.intent;
  if(!intent||Object.keys(intent).sort().join(',')!==['coreWidthPx','coreHeightPx','estimatedBlockedAreaPx2','estimatedBoundaryLossPx2','estimatedGrossAreaPx2'].sort().join(',')
    ||Object.values(intent).some(n=>!Number.isFinite(n)||n<=0||n>8388608)||intent.coreWidthPx%16||intent.coreHeightPx%16
    ||intent.coreWidthPx<p.coreWidthPx||intent.coreHeightPx<p.coreHeightPx)return false;
  if(!validNativeSpatialRuntimeInput(input.nativeSpatial,native,worldId,8388608))return false;
  if(input.nativeSpatial.policy.minWideRatio!==p.minWidePercent/100)return false;
  const assemblies=input.nativeSpatial.assemblies;
  if(assemblies.length!==1||assemblies[0]!.id!=='source-whole')return false;
  const assembly=assemblies[0]!;
  if(!(assembly.sourceScale>0&&assembly.sourceScale<=1&&assembly.minScale===1&&assembly.maxScale===1
    &&assembly.rotationOffsetsRad.length===1&&assembly.rotationOffsetsRad[0]===0
    &&[...assembly.sourceInstanceIds,...assembly.attachedReliefIds].sort((a,b)=>a-b).join(',')===native.instances.map(i=>i.id).sort((a,b)=>a-b).join(',')))return false;
  const prepared=input.preparedSource;
  if(!prepared||Object.keys(prepared).sort().join(',')!=='algorithm,instances'||prepared.algorithm!=='native-source-clearance-v1'
    ||!Array.isArray(prepared.instances)||prepared.instances.length!==native.instances.length)return false;
  try{
    const expected=nativeAutoSourceProjection(native,input.geometrySeed,assembly.sourceScale,p.objectClearancePx);
    return expected.areaPx2<=p.targetWalkAreaPx2*p.maxSourceAreaPercent/100
      &&prepared.instances.every((instance,index)=>{
        const source=expected.instances[index]!;
        return instance&&typeof instance==='object'&&!Array.isArray(instance)
          &&Object.keys(instance).sort().join(',')===Object.keys(source).sort().join(',')
          &&Object.entries(source).every(([key,value])=>instance[key as keyof typeof instance]===value)
          &&Number.isFinite(instance.x)&&Number.isFinite(instance.y)&&Math.abs(instance.x)<=8192&&Math.abs(instance.y)<=8192;
      });
  }catch{return false;}
}
