import {createNativeAutoPlan} from './native-auto-layout';
import {validNativeAutoRuntimeInput} from './native-auto-recipe';
import {constructNativeSpatialReference} from './native-spatial-construction-reference';
import {buildNativeSpatialGeometry} from './native-spatial-geometry';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from './native-spatial-measure';
import {evaluateNativeSpatialVisibility} from './native-spatial-visibility';
import {measureNativeConstructionBoundary} from './native-spatial-construction-shore';
import {nativeSpatialGeometryFingerprint,type NativeSpatialAttemptTrace,type NativeSpatialGeometryCandidate} from './native-spatial-generation';
import type {WorldProductionRecipeV3} from './production-recipe';
import type {NativeAutoRuntimeInput} from './native-auto-types';
import {certifyNativeAutoEmptyRadius} from './native-auto-empty-radius';
import {qualifyNativeAutoSolidAreas} from './native-auto-solid-area';
import {certifyNativeAutoVisibility} from './native-auto-visibility';

export function createNativeAutoCandidate(recipe:WorldProductionRecipeV3,input:NativeAutoRuntimeInput,
  attempt:NativeSpatialAttemptTrace,checkpoint:()=>void):NativeSpatialGeometryCandidate {
  if(!validNativeAutoRuntimeInput(input,recipe.nativeDefinition,recipe.profile.id))throw new Error('Invalid frozen automatic construction input');
  checkpoint();attempt.layoutProposals++;
  const plan=createNativeAutoPlan(recipe.nativeDefinition,input,checkpoint),p=input.policy,spatial=input.nativeSpatial;
  const layout=constructNativeSpatialReference({...recipe,requestedSeed:input.geometrySeed,nativeSpatial:spatial,
    package:{...recipe.package,algorithmRevision:12}},plan.reference,undefined,
  {combinedSourceHash:p.sourceHash,policy:{referenceId:plan.reference.id,algorithm:'macro-shore-step-v1',sourceHash:p.sourceHash,
    segmentMinPx:p.shoreSegmentMinPx,segmentMaxPx:p.shoreSegmentMaxPx,depthMinPx:p.shoreDepthMinPx,depthMaxPx:p.shoreDepthMaxPx,
    protectedGapPx:p.shoreProtectedGapPx,maxCleanRunPx:p.maxCleanRunPx}},undefined,
    {sourceInstances:input.preparedSource.instances,terrainOutline:plan.terrainOutline,erosion:plan.erosion,shore:plan.shore});
  checkpoint();attempt.geometryEvaluations++;attempt.finalGeometryEvaluations=(attempt.finalGeometryEvaluations??0)+1;
  const geometry=buildNativeSpatialGeometry(layout.definition,input.geometrySeed);
  checkpoint();
  const areaQualification=qualifyNativeAutoSolidAreas(
    identifyNativeSpatialStructures(geometry,layout.assemblies,{...spatial.policy,minSolidAreaPx2:0}),
    geometry.terrain.cols,spatial.policy.minSolidAreaPx2,checkpoint);
  const {groups}=areaQualification;
  const measuredGround=evaluateNativeSpatialGeometry(geometry,groups,spatial.policy,spatial.world,
    {placements:layout.holes,profiles:spatial.holeProfiles},
    {landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:spatial.bayProfiles,allowedCounts:spatial.world.bayCountOptions,minWideJoinPx:spatial.world.landRectMinOverlapPx});
  const emptyRadius=measuredGround.reasons.includes('G1-largest-empty-radius')?
    certifyNativeAutoEmptyRadius(geometry,spatial.policy.maxEmptyRadiusPx,checkpoint):undefined;
  const groundReasons=emptyRadius?.accepted?measuredGround.reasons.filter(reason=>reason!=='G1-largest-empty-radius'):measuredGround.reasons;
  const ground={...measuredGround,accepted:groundReasons.length===0,reasons:groundReasons,
    metrics:{...measuredGround.metrics,areaCertificate:areaQualification.areaCertificate,...(emptyRadius?{emptyRadiusCertificate:emptyRadius}:{}),
      wideQualityTargetRatio:p.targetWidePercent/100,wideQualityTargetMet:Number(measuredGround.metrics.wideRatio)>=p.targetWidePercent/100}};
  checkpoint();
  // Evaluate G2 even when G1/G3 rejects, so one candidate reports the complete
  // contradiction. A rejected map is never sent to deployment.
  const coarseVisibility=evaluateNativeSpatialVisibility(geometry,groups.structures,spatial.policy);
  const visibility=ground.accepted
    ?certifyNativeAutoVisibility(geometry,groups.structures,spatial.policy,coarseVisibility,checkpoint)
    :coarseVisibility;
  checkpoint();
  const boundary=measureNativeConstructionBoundary(layout.definition.terrainOutline!,p.maxCleanRunPx);
  const reasons=[...ground.reasons,...visibility.reasons,...(boundary.accepted?[]:['shore-long-clean-run'])];
  const trace={candidate:0,geometrySeed:input.geometrySeed,layoutSeed:layout.layoutSeed,
    geometryHash:nativeSpatialGeometryFingerprint(geometry,layout).hash,requestedCounts:layout.requestedCounts,
    accepted:reasons.length===0,reasons,gates:{geometry:{...ground,metrics:{...ground.metrics,boundary,
      automaticPlanning:{siteEvaluations:plan.siteEvaluations,feasibleSites:plan.feasibleSites,placementStates:plan.placementStates,backtracks:plan.backtracks,refinement:plan.refinement,policySourceHash:p.sourceHash}}},visibility}};
  attempt.candidates.push(trace);
  return{layout,geometry,groups,trace};
}
