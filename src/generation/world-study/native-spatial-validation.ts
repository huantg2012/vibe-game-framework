/** Bounded validation of frozen native intent. Never consults today's authoring catalog. */
import {validateNativeVolumeSpec} from './native-volume-geometry';
import type {MasterDefinition} from './r100-master-world';
import type {NativeSpatialFrozenInput,NativeSpatialPolicy} from './native-spatial-types';
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:object,expected:readonly string[])=>Object.keys(v).length===expected.length&&expected.every(key=>Object.prototype.hasOwnProperty.call(v,key));
const finite=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
const integer=(v:unknown,lo:number,hi:number):v is number=>finite(v,lo,hi)&&Number.isInteger(v);
const name=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,95}$/.test(v);
export const NATIVE_POLICY_NUMBERS=['version','planningCellFactor','holeToSolidRatio','holeCountAbsTolerance','holeCountRelTolerance','minSolidCount','regionHoleShareMin','regionHoleShareMax','spacingPx','countToleranceRatio','areaToleranceRatio','maxEmptyRadiusPx','deepEmptyThresholdPx','maxDeepEmptySpanPx','minHoleCoreRadiusPx','minSolidAreaPx2','minSolidSpanPx','probeStepPx','referenceSightPx','revealRouteMinPx','revealRouteMaxPx','maxCoverRoutePx','wideRadiusPx','minWideRatio','minLargestWideRatio','narrowWidthPx','maxNarrowRatio','maxNarrowRunPx','encounterRadiusPx','minRouteLengthPx','minRouteEncounters','minRouteHoleShare','maxRouteHoleShare','windowSize','minWindowHoles','maxGeometryEvaluations','maxFullCandidates'] as const;
export function validNativeSpatialPolicy(v:unknown):v is NativeSpatialPolicy {
  if(!object(v)||!keys(v,['algorithm','sourceHash','enabled','requireMoreHoles','comparisonSpacingsPx',...NATIVE_POLICY_NUMBERS])||v.algorithm!=='native-joint-layout-v1'||v.version!==2
    ||typeof v.sourceHash!=='string'||!/^[0-9a-f]{64}$/.test(v.sourceHash)||typeof v.enabled!=='boolean'||typeof v.requireMoreHoles!=='boolean'
    ||NATIVE_POLICY_NUMBERS.some(key=>!finite(v[key],0,4194304))||!Array.isArray(v.comparisonSpacingsPx)||v.comparisonSpacingsPx.length>4||!v.comparisonSpacingsPx.every(x=>integer(x,128,640)))return false;
  const p=v as unknown as NativeSpatialPolicy;
  if(!integer(p.maxGeometryEvaluations,1,72)||!integer(p.maxFullCandidates,1,2)||!integer(p.probeStepPx,8,64)||p.probeStepPx%8||p.spacingPx<128||p.spacingPx>640
    ||p.planningCellFactor<=0||p.planningCellFactor>2||p.holeToSolidRatio<=1||p.holeToSolidRatio>4||p.minSolidCount<1
    ||p.revealRouteMaxPx<p.revealRouteMinPx||p.maxEmptyRadiusPx<p.deepEmptyThresholdPx||p.minRouteHoleShare>p.maxRouteHoleShare||p.regionHoleShareMin>p.regionHoleShareMax
    ||!integer(p.windowSize,1,32)||!integer(p.minWindowHoles,0,p.windowSize)||!integer(p.minRouteEncounters,1,64))return false;
  return ['countToleranceRatio','areaToleranceRatio','holeCountRelTolerance','minWideRatio','minLargestWideRatio','maxNarrowRatio','minRouteHoleShare','maxRouteHoleShare','regionHoleShareMin','regionHoleShareMax'].every(key=>finite(v[key],0,1));
}
export function validNativeSpatialFrozenInput(value:unknown,native:MasterDefinition,surfacePixelBudget:4194304|8388608=4194304):value is NativeSpatialFrozenInput {
  try {
    if(!object(value)||!keys(value,['policy','world','holeProfiles','bayProfiles','assemblies','subordinateProfiles'])||!validNativeSpatialPolicy(value.policy)||!object(value.world))return false;
    const w=value.world;
    if(!keys(w,['worldId','enabled','annotationStatus','targetWalkAreaPx2','frameWidthPx','frameHeightPx','materialAxisRad','landGrammar','landRectMinCount','landRectMaxCount','landRectMinSpanPx','landRectMaxSpanPx','landRectMinThicknessPx','landRectMaxThicknessPx','landRectMinOverlapPx','bayGrammar','bayProfileIds','bayCountOptions','landCoreMinCount','landCoreMaxCount','landShoulderMinCount','landShoulderMaxCount','landShoulderMinSpanPx','landShoulderMaxSpanPx','landShoulderMinThicknessPx','landShoulderMaxThicknessPx','landShoulderMinExtensionPx','landShoulderMaxExtensionPx','landShoulderAttachment'])
      ||!name(w.worldId)||typeof w.enabled!=='boolean'||w.annotationStatus!=='reviewed'||w.landGrammar!=='offset-overlap-v1'
      ||!integer(w.frameWidthPx,1024,3072)||!integer(w.frameHeightPx,1024,2304)||w.frameWidthPx%32||w.frameHeightPx%32||w.frameWidthPx*w.frameHeightPx>surfacePixelBudget
      ||!finite(w.targetWalkAreaPx2,100000,w.frameWidthPx*w.frameHeightPx)||!finite(w.materialAxisRad,-Math.PI*2,Math.PI*2)
      ||!integer(w.landRectMinCount,2,16)||!integer(w.landRectMaxCount,w.landRectMinCount,16))return false;
    for(const stem of ['Span','Thickness'])if(!finite(w[`landRectMin${stem}Px`],64,3072)||!finite(w[`landRectMax${stem}Px`],w[`landRectMin${stem}Px`] as number,3072))return false;
    if(!finite(w.landRectMinOverlapPx,32,1024)||w.landShoulderAttachment!=='core-outward-normal-v1')return false;
    for(const role of ['Core','Shoulder'])if(!integer(w[`land${role}MinCount`],1,16)||!integer(w[`land${role}MaxCount`],w[`land${role}MinCount`] as number,16))return false;
    if((w.landCoreMinCount as number)+(w.landShoulderMinCount as number)<w.landRectMinCount||(w.landCoreMaxCount as number)+(w.landShoulderMaxCount as number)>w.landRectMaxCount)return false;
    for(const stem of ['Span','Thickness','Extension'])if(!finite(w[`landShoulderMin${stem}Px`],64,3072)||!finite(w[`landShoulderMax${stem}Px`],w[`landShoulderMin${stem}Px`] as number,3072))return false;
    if((w.landShoulderMinThicknessPx as number)<w.landRectMinOverlapPx||(w.landShoulderMaxSpanPx as number)<w.landRectMinOverlapPx+(w.landShoulderMinExtensionPx as number))return false;
    if(w.bayGrammar!=='shore-rect-cut-v1'||!Array.isArray(w.bayProfileIds)||!w.bayProfileIds.length||w.bayProfileIds.length>12||!w.bayProfileIds.every(name)||new Set(w.bayProfileIds).size!==w.bayProfileIds.length
      ||!Array.isArray(w.bayCountOptions)||!w.bayCountOptions.length||w.bayCountOptions.length>3||!w.bayCountOptions.every(n=>integer(n,0,2))||new Set(w.bayCountOptions).size!==w.bayCountOptions.length)return false;
    if(!Array.isArray(value.bayProfiles)||value.bayProfiles.length!==w.bayProfileIds.length)return false;
    const bayIds=new Set<string>();
    for(const b of value.bayProfiles){
      if(!object(b)||!keys(b,['id','minRectCount','maxRectCount','minDepthPx','maxDepthPx','minMouthPx','maxMouthPx','minOffsetRatio','maxOffsetRatio','minOverlapRatio','maxOverlapRatio','maxUnionSpanPx','minRemovedLandAreaPx2','maxRemovedLandAreaPx2','minFinalThroatPx','minBacklandPx'])
        ||!name(b.id)||bayIds.has(b.id)||!w.bayProfileIds.includes(b.id)||!integer(b.minRectCount,1,3)||!integer(b.maxRectCount,b.minRectCount,3))return false;
      bayIds.add(b.id);
      for(const stem of ['Depth','Mouth'])if(!finite(b[`min${stem}Px`],32,1024)||!finite(b[`max${stem}Px`],b[`min${stem}Px`] as number,1024))return false;
      for(const stem of ['Offset','Overlap'])if(!finite(b[`min${stem}Ratio`],0,1)||!finite(b[`max${stem}Ratio`],b[`min${stem}Ratio`] as number,1))return false;
      if(!finite(b.maxUnionSpanPx,64,1536)||!finite(b.minRemovedLandAreaPx2,64,524288)||!finite(b.maxRemovedLandAreaPx2,b.minRemovedLandAreaPx2,524288)||!finite(b.minFinalThroatPx,8,256)||!finite(b.minBacklandPx,64,1024))return false;
    }
    if(!Array.isArray(value.holeProfiles)||value.holeProfiles.length<1||value.holeProfiles.length>12||!Array.isArray(value.assemblies)||value.assemblies.length<1||value.assemblies.length>16||!Array.isArray(value.subordinateProfiles)||value.subordinateProfiles.length<1||value.subordinateProfiles.length>24)return false;
    const ids=new Set<string>();
    for(const h of value.holeProfiles){
      if(!object(h)||!keys(h,['id','sizeClass','weight','minSpanPx','maxSpanPx','minThicknessPx','maxThicknessPx','minRectCount','maxRectCount','minOverlapRatio','maxOverlapRatio','minOffsetRatio','maxOffsetRatio','maxAreaPx2'])||!name(h.id)||ids.has(h.id)||!name(h.sizeClass)||!finite(h.weight,1,1000))return false;ids.add(h.id);
      if(!finite(h.minSpanPx,64,512)||!finite(h.maxSpanPx,h.minSpanPx,512)||!finite(h.minThicknessPx,32,512)||!finite(h.maxThicknessPx,h.minThicknessPx,512)||!integer(h.minRectCount,1,8)||!integer(h.maxRectCount,h.minRectCount,8)||!finite(h.minOverlapRatio,0,1)||!finite(h.maxOverlapRatio,h.minOverlapRatio,1)||!finite(h.minOffsetRatio,0,1)||!finite(h.maxOffsetRatio,h.minOffsetRatio,1)||!finite(h.maxAreaPx2,1024,262144))return false;
    }
    ids.clear();const used=new Set<number>();
    for(const a of value.assemblies){
      if(!object(a)||!keys(a,['worldId','grade','id','sourceInstanceIds','attachedReliefIds','sourceScale','minScale','maxScale','rotationOffsetsRad','maxSpanPx','mode'])||a.worldId!==w.worldId||!['all',native.grade].includes(a.grade as string)||!name(a.id)||ids.has(a.id)||a.mode!=='unique-once'
        ||!finite(a.sourceScale,.1,4)||!finite(a.minScale,.5,2)||!finite(a.maxScale,a.minScale,2)||!finite(a.maxSpanPx,80,2304)||!Array.isArray(a.rotationOffsetsRad)||a.rotationOffsetsRad.length<1||a.rotationOffsetsRad.length>12||!a.rotationOffsetsRad.every(x=>finite(x,-Math.PI*2,Math.PI*2)))return false;ids.add(a.id);
      for(const [field,role]of [['sourceInstanceIds','solid'],['attachedReliefIds','relief']] as const){const list=a[field];if(!Array.isArray(list)||list.length>32||field==='sourceInstanceIds'&&!list.length)return false;for(const id of list){if(!integer(id,1,10000)||used.has(id)||!native.instances.some(instance=>instance.id===id&&instance.role===role))return false;used.add(id);}}
    }
    ids.clear();
    for(const p of value.subordinateProfiles){
      if(!object(p)||!keys(p,['id','family','constructionVersion','shapeProfile','minLengthPx','maxLengthPx','minWidthPx','maxWidthPx','minHeightPx','maxHeightPx','thicknessPx','fold','branches','opening','distortion','rotationOffsetRad'])||!name(p.id)||ids.has(p.id)||p.family!==native.family||p.constructionVersion!==4||!finite(p.rotationOffsetRad,-Math.PI*2,Math.PI*2))return false;ids.add(p.id);
      for(const stem of ['Length','Width','Height'])if(!finite(p[`min${stem}Px`],1,512)||!finite(p[`max${stem}Px`],p[`min${stem}Px`] as number,512))return false;
      for(const maximum of [false,true])validateNativeVolumeSpec({id:1,family:p.family,constructionVersion:4,shapeProfile:p.shapeProfile,seed:0,x:0,y:0,rotation:p.rotationOffsetRad,length:maximum?p.maxLengthPx:p.minLengthPx,width:maximum?p.maxWidthPx:p.minWidthPx,height:maximum?p.maxHeightPx:p.minHeightPx,thickness:p.thicknessPx,fold:p.fold,branches:p.branches,opening:p.opening,distortion:p.distortion,blocking:1} as Parameters<typeof validateNativeVolumeSpec>[0]);
    }
    return true;
  }catch{return false;}
}
