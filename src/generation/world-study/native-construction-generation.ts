/** One complete L/H/S proposal and its real gates. No layout search, raster
 * repair, gate bypass or legacy-map fallback belongs to revision 13. */
import {constructNativeProductionLayout} from './native-construction-recipe';
import {buildNativeSpatialGeometry} from './native-spatial-geometry';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from './native-spatial-measure';
import {evaluateNativeSpatialVisibility} from './native-spatial-visibility';
import {measureNativeConstructionBoundary,parseNativeConstructionShore} from './native-spatial-construction-shore';
import {nativeSpatialGeometryFingerprint,type NativeSpatialAttemptTrace,type NativeSpatialGeometryCandidate} from './native-spatial-generation';
import type {WorldProductionRecipeV3} from './production-recipe';

export function createNativeConstructionCandidate(recipe:WorldProductionRecipeV3,attempt:NativeSpatialAttemptTrace,checkpoint:()=>void):NativeSpatialGeometryCandidate {
  const input=recipe.nativeSpatial,construction=recipe.nativeConstruction;
  if(!input||!construction||recipe.package.algorithmRevision!==13)throw new Error('Missing direct construction contract');
  checkpoint();attempt.layoutProposals++;
  const layout=constructNativeProductionLayout(recipe),assessment=layout.assessmentInput??input;
  checkpoint();attempt.geometryEvaluations++;attempt.finalGeometryEvaluations=(attempt.finalGeometryEvaluations??0)+1;
  const geometry=buildNativeSpatialGeometry(layout.definition,construction.geometrySeed);
  checkpoint();
  const groups=identifyNativeSpatialStructures(geometry,layout.assemblies,assessment.policy);
  const ground=evaluateNativeSpatialGeometry(geometry,groups,assessment.policy,assessment.world,
    {placements:layout.holes,profiles:input.holeProfiles},
    {landRects:layout.plan.land,placements:layout.bays,landJoins:layout.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
  checkpoint();
  const shore=parseNativeConstructionShore(construction.shore.csv,construction.shore.sourceHash);
  const boundary=measureNativeConstructionBoundary(layout.definition.terrainOutline!,shore.maxCleanRunPx);
  const visibility=ground.accepted?evaluateNativeSpatialVisibility(geometry,groups.structures,assessment.policy):undefined;
  checkpoint();
  const reasons=[...ground.reasons,...(visibility?.reasons??[]),...(boundary.accepted?[]:['shore-long-clean-run'])];
  const trace={candidate:0,geometrySeed:construction.geometrySeed,layoutSeed:layout.layoutSeed,
    geometryHash:nativeSpatialGeometryFingerprint(geometry,layout).hash,requestedCounts:layout.requestedCounts,
    accepted:ground.accepted&&visibility?.accepted===true&&boundary.accepted,reasons,
    gates:{geometry:{...ground,metrics:{...ground.metrics,boundary}},...(visibility?{visibility}:{})}};
  attempt.candidates.push(trace);
  return{layout,geometry,groups,trace};
}
