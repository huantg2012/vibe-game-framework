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

export function createNativeAutoCandidate(recipe:WorldProductionRecipeV3,input:NativeAutoRuntimeInput,
  attempt:NativeSpatialAttemptTrace,checkpoint:()=>void):NativeSpatialGeometryCandidate {
  if(!validNativeAutoRuntimeInput(input,recipe.nativeDefinition,recipe.profile.id))throw new Error('Invalid frozen automatic construction input');
  checkpoint();attempt.layoutProposals++;
  const plan=createNativeAutoPlan(recipe.nativeDefinition,input,checkpoint),p=input.policy,spatial=input.nativeSpatial;
  const layout=constructNativeSpatialReference({...recipe,requestedSeed:input.geometrySeed,nativeSpatial:spatial,
    package:{...recipe.package,algorithmRevision:12}},plan.reference,undefined,
  {combinedSourceHash:p.sourceHash,policy:{referenceId:plan.reference.id,algorithm:'macro-shore-step-v1',sourceHash:p.sourceHash,
    segmentMinPx:p.shoreSegmentMinPx,segmentMaxPx:p.shoreSegmentMaxPx,depthMinPx:p.shoreDepthMinPx,depthMaxPx:p.shoreDepthMaxPx,
    protectedGapPx:p.shoreProtectedGapPx,maxCleanRunPx:p.maxCleanRunPx}});
  checkpoint();attempt.geometryEvaluations++;attempt.finalGeometryEvaluations=(attempt.finalGeometryEvaluations??0)+1;
  const geometry=buildNativeSpatialGeometry(layout.definition,input.geometrySeed);
  checkpoint();
  const groups=identifyNativeSpatialStructures(geometry,layout.assemblies,spatial.policy);
  const ground=evaluateNativeSpatialGeometry(geometry,groups,spatial.policy,spatial.world,
    {placements:layout.holes,profiles:spatial.holeProfiles},
    {landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:spatial.bayProfiles,allowedCounts:spatial.world.bayCountOptions,minWideJoinPx:spatial.world.landRectMinOverlapPx});
  checkpoint();
  // Evaluate G2 even when G1/G3 rejects, so one candidate reports the complete
  // contradiction. A rejected map is never sent to deployment.
  const visibility=evaluateNativeSpatialVisibility(geometry,groups.structures,spatial.policy);
  checkpoint();
  const boundary=measureNativeConstructionBoundary(layout.definition.terrainOutline!,p.maxCleanRunPx);
  const reasons=[...ground.reasons,...visibility.reasons,...(boundary.accepted?[]:['shore-long-clean-run'])];
  const trace={candidate:0,geometrySeed:input.geometrySeed,layoutSeed:layout.layoutSeed,
    geometryHash:nativeSpatialGeometryFingerprint(geometry,layout).hash,requestedCounts:layout.requestedCounts,
    accepted:reasons.length===0,reasons,gates:{geometry:{...ground,metrics:{...ground.metrics,boundary,
      automaticPlanning:{siteEvaluations:plan.siteEvaluations,feasibleSites:plan.feasibleSites,placementStates:plan.placementStates,backtracks:plan.backtracks,policySourceHash:p.sourceHash}}},visibility}};
  attempt.candidates.push(trace);
  return{layout,geometry,groups,trace};
}
