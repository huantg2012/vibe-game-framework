import { createR100ProductionMap as createRevision11Map } from '../legacy-r100-v11/executor-recovery.js';
import { createR100ProductionMap as createRevision10Map } from '../legacy-r100-v10/executor-recovery.js';
import { createR100ProductionMap as createRevision9Map } from '../legacy-r100-v9/executor-recovery.js';
import { createR100ProductionMap as createRevision6Map } from '../legacy-r100-v6/executor-recovery.js';
import { createR100ProductionMap as createRevision7Map } from '../legacy-r100-v7/executor-recovery.js';
import { createR100ProductionMap as createRevision8Map } from '../legacy-r100-v8/executor-recovery.js';
import { createR100ProductionMap as createRevision5Map } from '../legacy-r100-v5/executor-recovery.js';
import { createR100ProductionMap as createRevision4Map } from '../legacy-r100-v4/executor.js';
import { createR100ProductionMap as createRevision3Map } from '../legacy-r100-v3/executor.js';
import { mix32 } from '@/generation/seed-fork';
/** V3 generation. A failed seed fails that exact frozen trip; it never changes grade. */
import { checkpointChecksum } from '@/types/rift-checkpoint';
import { createNativeSpatialGeometryCandidates, type NativeSpatialAttemptTrace, type NativeSpatialGeometryCandidate, type NativeSpatialGeometryWorkTrace } from './native-spatial-generation';
import { selectNativeSpatialExtraction } from './native-spatial-extraction';
import { evaluateNativeSpatialRoutes } from './native-spatial-routes';
import type {NativeSpatialRouteFeedback} from './native-spatial-route-feedback';
import { createMasterWorld } from './r100-master-world';
import type { NativeSpatialCandidateTrace, NativeSpatialGateResult } from './native-spatial-types';
import { deployR100Expedition } from './r100-expedition';
import { createR100ProductionMap as createFrozenR100ProductionMap } from '../legacy-r100-v2/executor.js';
import { serializeR100MasterWorld } from './r100-native-data';
import { validR100ProductionRecipe } from './r100-package';
import type { WorldProductionRecipeV3 } from './production-recipe';
import type { WorldProductionMap } from './production-map';
import {createNativeConstructionCandidate} from './native-construction-generation';
import {createNativeAutoCandidate} from './native-auto-generation';

export function createR100ProductionMap(recipe: WorldProductionRecipeV3): WorldProductionMap {
  if (recipe.package?.algorithmRevision === 1 || recipe.package?.algorithmRevision === 2) return createFrozenR100ProductionMap(recipe);
  if (recipe.package?.algorithmRevision === 3) return createRevision3Map(recipe);
  if (recipe.package?.algorithmRevision === 4) return createRevision4Map(recipe);
  if (recipe.package?.algorithmRevision === 5) return createRevision5Map(recipe);
  if (recipe.package?.algorithmRevision === 6) return createRevision6Map(recipe);
  if (recipe.package?.algorithmRevision === 7) return createRevision7Map(recipe);
  if (recipe.package?.algorithmRevision === 8) return createRevision8Map(recipe);
  if (recipe.package?.algorithmRevision === 9) return createRevision9Map(recipe);
  if (recipe.package?.algorithmRevision === 10) return createRevision10Map(recipe);
  if (recipe.package?.algorithmRevision === 11) return createRevision11Map(recipe);
  if (!validR100ProductionRecipe(recipe)) throw new Error('Invalid or unavailable native world package');
  if(recipe.package.algorithmRevision===14)return createAutomaticConstructionMap(recipe);
  if(recipe.package.algorithmRevision===13)return createDirectConstructionMap(recipe);
  const input=recipe.nativeSpatial!,rejected:{seed:number;reason:string}[]=[],attempts:NativeSpatialAttemptTrace[]=[];
  // Deadline only terminates a request. It never ranks/selects a different layout.
  const started=performance.now();
  const failure=(message:string):Error=>Object.assign(new Error(message),{diagnostics:{algorithm:'native-joint-layout-v1',attempts,rejected}});
  for(let attempt=0;attempt<8;attempt++){
    const seed=attempt===0?recipe.requestedSeed:mix32(recipe.requestedSeed,`r100-native-v3-attempt-${attempt}`);
    const trace:NativeSpatialAttemptTrace={geometrySeed:seed,proposalBudget:input.policy.maxGeometryEvaluations,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
    attempts.push(trace);
    const checkpoint=():void=>{if(performance.now()-started>=60000){trace.stopReason='deadline';throw failure('Native joint generation exceeded its 60 second deadline');}};
    const candidates=createNativeSpatialGeometryCandidates(recipe.nativeDefinition,input,recipe.requestedSeed,seed,trace,checkpoint);
    let feedback:NativeSpatialRouteFeedback|undefined;
    try {
      while(trace.fullCandidates<input.policy.maxFullCandidates){
        const next=candidates.next(feedback);feedback=undefined;
        if(next.done)break;
        const result=completeNativeSpatialCandidate(recipe,next.value,{attempt,trace,attempts,rejected,checkpoint});
        if(result.accepted)return result.map;
        feedback=result.routeFeedback;
      }
      if(trace.stopReason==='searching')trace.stopReason='full-candidate-budget';
      if(!trace.fullCandidates)rejected.push({seed,reason:'Native joint search exhausted its bounded whole-layout proposals without G1–G3 admission'});
    }finally{candidates.return(undefined);}
  }
  throw failure(`Native v3 world could not admit its complete ${recipe.nativeDefinition.grade} contents after 8 deterministic attempts`);
}

/** Small deterministic search over whole proposals; no reviewed seed bank,
 * per-world rescue layout or repair of a finished raster. */
function createAutomaticConstructionMap(recipe:WorldProductionRecipeV3):WorldProductionMap {
  const started=performance.now(),attempts:NativeSpatialAttemptTrace[]=[],rejected:{seed:number;reason:string}[]=[];
  const failure=(message:string)=>Object.assign(new Error(message),{diagnostics:{algorithm:'native-auto-construction-v1',attempts,rejected}});
  for(let geometryAttempt=0;geometryAttempt<2;geometryAttempt++){
    const geometrySeed=geometryAttempt===0?recipe.requestedSeed:mix32(recipe.requestedSeed,`native-auto-geometry-v1:${geometryAttempt}`);
    const trace:NativeSpatialAttemptTrace={geometrySeed,proposalBudget:1,layoutProposals:0,geometryEvaluations:0,
      fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
    attempts.push(trace);
    const checkpoint=()=>{if(performance.now()-started>=60000){trace.stopReason='deadline';throw failure('Automatic construction exceeded its 60 second deadline');}};
    let candidate:NativeSpatialGeometryCandidate;
    try{candidate=createNativeAutoCandidate(recipe,{...recipe.nativeAuto!,geometrySeed},trace,checkpoint);}
    catch(error){
      if(trace.stopReason==='deadline')throw error;
      rejected.push({seed:geometrySeed,reason:error instanceof Error?error.message:String(error)});continue;
    }
    if(!candidate.trace.accepted){trace.stopReason='geometry-work-budget';rejected.push({seed:geometrySeed,reason:candidate.trace.reasons.join('; ')});continue;}
    for(let contentAttempt=0;contentAttempt<4;contentAttempt++){
      const current=contentAttempt===0?trace:{...trace,layoutProposals:0,geometryEvaluations:0,finalGeometryEvaluations:0,
        fullCandidates:0,feedbackBases:[],candidates:[candidate.trace],deploymentRejections:[],stopReason:'searching' as const};
      if(contentAttempt>0)attempts.push(current);
      const attempt=attempts.length-1;
      const attemptCheckpoint=()=>{if(performance.now()-started>=60000){current.stopReason='deadline';throw failure('Automatic construction exceeded its 60 second deadline');}};
      const result=completeNativeSpatialCandidate(recipe,candidate,{attempt,trace:current,attempts,rejected,checkpoint:attemptCheckpoint,
        contentSeed:contentAttempt===0?recipe.requestedSeed:mix32(recipe.requestedSeed,`native-auto-content-v1:${geometryAttempt}:${contentAttempt}`)});
      if(result.accepted)return result.map;
      current.stopReason='full-candidate-budget';
    }
  }
  throw failure('Automatic construction rejected its bounded geometry/content proposals');
}

function createDirectConstructionMap(recipe:WorldProductionRecipeV3):WorldProductionMap {
  const started=performance.now(),seed=recipe.nativeConstruction!.geometrySeed;
  const trace:NativeSpatialAttemptTrace={geometrySeed:seed,proposalBudget:1,layoutProposals:0,geometryEvaluations:0,fullCandidates:0,feedbackBases:[],candidates:[],deploymentRejections:[],stopReason:'searching'};
  const attempts=[trace],rejected:{seed:number;reason:string}[]=[];
  const failure=(message:string)=>Object.assign(new Error(message),{diagnostics:{algorithm:'native-direct-construction-v1',attempts,rejected}});
  const checkpoint=()=>{if(performance.now()-started>=60000){trace.stopReason='deadline';throw failure('Direct construction exceeded its 60 second deadline');}};
  let candidate:NativeSpatialGeometryCandidate;
  try{candidate=createNativeConstructionCandidate(recipe,trace,checkpoint);}
  catch(error){
    if(trace.stopReason==='deadline')throw error;
    const reason=error instanceof Error?error.message:String(error);rejected.push({seed,reason});
    throw failure(`Direct construction failed before admission: ${reason}`);
  }
  if(!candidate.trace.accepted){trace.stopReason='geometry-work-budget';throw failure(`Direct construction rejected: ${candidate.trace.reasons.join('; ')}`);}
  // Only content changes between these fixed attempts. The physical meshes,
  // body graph and measured G1/G2/G3 candidate are reused without modification.
  const certified=recipe.nativeConstruction!.contentSeeds[recipe.nativeDefinition.grade];
  const certifiedSeed=certified[mix32(recipe.requestedSeed,`r100-certified-content-v1:${recipe.package.id}:${recipe.nativeDefinition.grade}`)%certified.length]!;
  for(let attempt=0;attempt<8;attempt++){
    const current=attempt===0?trace:{...trace,layoutProposals:0,geometryEvaluations:0,finalGeometryEvaluations:0,
      fullCandidates:0,feedbackBases:[],candidates:[candidate.trace],deploymentRejections:[],stopReason:'searching' as const};
    if(attempt>0)attempts.push(current);
    const attemptCheckpoint=()=>{if(performance.now()-started>=60000){current.stopReason='deadline';throw failure('Direct construction exceeded its 60 second deadline');}};
    const result=completeNativeSpatialCandidate(recipe,candidate,{attempt,trace:current,attempts,rejected,checkpoint:attemptCheckpoint,
      ...(attempt===7?{contentSeed:certifiedSeed,contentSeedSource:'certified' as const}:{})});
    if(result.accepted)return result.map;
    current.stopReason='full-candidate-budget';
  }
  throw failure(`Direct construction rejected complete ${recipe.nativeDefinition.grade} deployment after 8 deterministic content attempts`);
}


/** Internal execution context shared by normal search and fixed-layout diagnostics.
 * The caller owns the original request deadline and the same attempt ledger. */
export interface NativeSpatialCompleteCandidateContext {
  readonly attempt:number;
  readonly trace:NativeSpatialAttemptTrace;
  readonly attempts:NativeSpatialAttemptTrace[];
  readonly rejected:{seed:number;reason:string}[];
  readonly checkpoint:()=>void;
  /** Explicit content seed for r13/r14; geometry remains unchanged. */
  readonly contentSeed?:number;
  readonly contentSeedSource?:'certified'|'certification';
}
export type NativeSpatialCompleteCandidateResult =
  | Readonly<{accepted:true;map:WorldProductionMap}>
  | Readonly<{accepted:false;feedback:NativeSpatialGateResult;routeFeedback?:NativeSpatialRouteFeedback}>;

type NativeSpatialReplayCandidateTrace = Omit<NativeSpatialCandidateTrace,'initialPlacement'> & {
  readonly initialPlacement?:Omit<NonNullable<NativeSpatialCandidateTrace['initialPlacement']>,'timings'|'counts'>;
};
export type NativeSpatialReplayAttemptTrace = Omit<NativeSpatialAttemptTrace,'geometryWork'|'candidates'> & {
  readonly geometryWork?:readonly Omit<NativeSpatialGeometryWorkTrace,'elapsedMs'>[];
  readonly candidates:readonly NativeSpatialReplayCandidateTrace[];
};
/** A successful map freezes decisions, not measurements of CPU performance.
 * Keep the live attempt ledger intact for failures and offline diagnostics.
 * Explicit field projection preserves gameplay durations (such as patrol
 * windows); a recursive '*Ms' filter would silently erase real game rules. */
export function nativeSpatialReplayAttempts(attempts:readonly NativeSpatialAttemptTrace[]):readonly NativeSpatialReplayAttemptTrace[] {
  return structuredClone(attempts).map(({geometryWork,candidates,...attempt})=>({
    ...attempt,
    ...(geometryWork?{geometryWork:geometryWork.map(({elapsedMs,...work})=>work)}:{}),
    candidates:candidates.map(({initialPlacement,...candidate})=>{
      if(!initialPlacement)return candidate;
      const {timings,counts,...placement}=initialPlacement;
      return{...candidate,initialPlacement:placement};
    }),
  }));
}

/** Execute exactly one already measured G1/G2/G3 survivor. No alternate seed,
 * content fallback or second full candidate is started here. A failed exit
 * selection consumes its slot, as does every later stage failure. */
export function completeNativeSpatialCandidate(recipe:WorldProductionRecipeV3,candidate:NativeSpatialGeometryCandidate,
  context:NativeSpatialCompleteCandidateContext):NativeSpatialCompleteCandidateResult {
  const input=recipe.nativeSpatial,{attempt,trace,attempts,rejected,checkpoint}=context;
  if((recipe.package.algorithmRevision!==12&&recipe.package.algorithmRevision!==13&&recipe.package.algorithmRevision!==14)||!input)throw new Error('Complete native candidate requires a revision-12, revision-13 or revision-14 recipe');
  if(!candidate.trace.accepted||!candidate.trace.gates.geometry?.accepted||!candidate.trace.gates.visibility?.accepted)
    throw new Error('Complete native candidate requires measured G1/G2/G3 admission');
  if(context.contentSeed!==undefined&&(![13,14].includes(recipe.package.algorithmRevision)||!Number.isSafeInteger(context.contentSeed)||context.contentSeed<0||context.contentSeed>0xffffffff))throw new Error('Invalid explicit construction content seed');
  const geometrySeed=trace.geometrySeed,seed=recipe.package.algorithmRevision>=13
    ?context.contentSeed??(attempt===0?recipe.requestedSeed:mix32(recipe.requestedSeed,`r100-direct-content-v1-${attempt}`))
    :geometrySeed,selected=candidate.layout.candidate;
  if(candidate.trace.geometrySeed!==geometrySeed||candidate.trace.candidate!==selected||attempts[attempt]!==trace)
    throw new Error('Complete native candidate does not belong to the request attempt');
  if(trace.fullCandidates>=input.policy.maxFullCandidates){trace.stopReason='full-candidate-budget';throw new Error('Native full candidate budget exhausted before extraction');}
  trace.fullCandidates++;
  let stage:'extraction'|'master'|'deployment'|'routes'='extraction';
  const stageDiagnostics:Record<string,unknown>={geometry:candidate.trace.gates};
  try {
    checkpoint();
    const {extraction,summary}=selectNativeSpatialExtraction(candidate.geometry,input.extraction,seed);
    stageDiagnostics.extraction={extraction,summary};stage='master';
    const point=candidate.geometry.terrain.spawnPoint;
    const definition={...candidate.layout.definition,spawn_x:point.x,spawn_y:point.y,exit_x:extraction.point.x,exit_y:extraction.point.y};
    const master=createMasterWorld(definition,seed,{grade:recipe.gradeDefinition,profile:recipe.profile,spatialDeployment:input.deployment,
      ...(recipe.package.algorithmRevision>=13?{surfacePixelBudget:recipe.surfacePixelBudget!,geometrySeed}:{}),
      ...(recipe.enemyDeployment?{enemyDeployment:recipe.enemyDeployment}:{})});
    if(master.layout.spawnPoint.x!==point.x||master.layout.spawnPoint.y!==point.y||master.layout.extractionPoint.position.x!==extraction.point.x||master.layout.extractionPoint.position.y!==extraction.point.y)
      throw new Error('Native final deployment moved a measured spawn/extraction endpoint');
    // Ground-edge presentation cannot replace the support measured by G1–G4.
    if(master.layout.tileMap.tiles.some((row,y)=>row.some((tile,x)=>tile!==candidate.geometry.terrain.tileMap.tiles[y]![x])))
      throw new Error('Native full raster changed its admitted physical geometry');
    checkpoint();
    stageDiagnostics.master=master.diagnostics;stage='deployment';
    const deployed=deployR100Expedition(master,recipe.contentDefinition,recipe.searchSitePolicy,recipe.automaticSupplyPolicy),layout=deployed.layout;
    checkpoint();
    stageDiagnostics.deployment=deployed.diagnostics;stage='routes';
    const routes=evaluateNativeSpatialRoutes(candidate.geometry,candidate.groups.structures,input.policy,layout,
      recipe.package.algorithmRevision===14?{transverseMode:'per-leg'}:undefined);
    if(!routes.accepted){
      trace.deploymentRejections.push({candidate:selected,stage,reason:routes.reasons.join('; '),gate:routes,diagnostics:stageDiagnostics});rejected.push({seed,reason:`candidate ${selected}: ${routes.reasons.join('; ')}`});
      // Per-route quality diagnostics do not launch the old tuple/probe loop.
      // A genuine hard failure retains the full evidence and original budgets.
      checkpoint();return{accepted:false,feedback:routes};
    }
    checkpoint();trace.stopReason='selected';
    const diagnostics={...master.diagnostics,qualification:'v3-production-candidate',expedition:deployed.diagnostics,
      nativeSpatial:{algorithm:input.policy.algorithm,version:input.policy.version,sourceHash:input.policy.sourceHash,selectedCandidate:selected,
        ...(recipe.nativeConstruction?{construction:{algorithm:recipe.nativeConstruction.algorithm,version:recipe.nativeConstruction.version,sourceHash:recipe.nativeConstruction.sourceHash,geometrySeed,seedMode:recipe.nativeConstruction.seedMode,contentAttempt:attempt,contentSeed:seed,contentSeedSource:context.contentSeedSource??'requested'}}:{}),
        ...(recipe.nativeAuto?{automaticConstruction:{algorithm:recipe.nativeAuto.algorithm,version:recipe.nativeAuto.version,sourceHash:recipe.nativeAuto.policy.sourceHash,geometrySeed,contentSeed:seed}}:{}),
        attempts:nativeSpatialReplayAttempts(attempts),fragmentShape:candidate.layout.fragmentShape,assemblies:candidate.layout.assemblies,holes:candidate.layout.holes,bays:candidate.layout.bays,positiveLandRects:candidate.layout.plan.land,landJoins:candidate.layout.landJoins,gates:{...candidate.trace.gates,routes},extraction,extractionCandidateField:summary}};
    const native=serializeR100MasterWorld({...master,algorithmRevision:recipe.package.algorithmRevision,searchSites:deployed.searchSites,appearance:recipe.appearance,layout,diagnostics},recipe.gradeDefinition,recipe.package.dependencyHash);
    return{accepted:true,map:{sample:master.sample,layout,hostTileMap:master.hostTileMap,native,
      metadata:{world:recipe.package.id,space:recipe.nativeDefinition.id,contentFragmentTypeId:recipe.contentFragmentTypeId,
        requestedSeed:recipe.requestedSeed,effectiveSeed:layout.seed,attempt,rejected,
        signature:checkpointChecksum({recipe,geometry:master.diagnostics.geometryFingerprint,content:deployed.diagnostics,nativeSpatial:diagnostics.nativeSpatial}),
        bodySize:20,supportTileSize:8,hostTileSize:32,reachableBodySeats:Number(deployed.diagnostics.reachableBodySeats),extractionRoutePx:extraction.pathDistancePx}}};
  }catch(error){
    const reason=error instanceof Error?error.message:String(error);
    const errorDiagnostics=error&&typeof error==='object'&&'diagnostics'in error?error.diagnostics:undefined;
    trace.deploymentRejections.push({candidate:selected,stage,reason,diagnostics:{...stageDiagnostics,...(errorDiagnostics===undefined?{}:{error:errorDiagnostics})}});rejected.push({seed,reason:`candidate ${selected}: ${reason}`});
    if(trace.stopReason==='deadline')throw error;
    return{accepted:false,feedback:{accepted:false,reasons:[reason],metrics:{deploymentFailure:reason}}};
  }
}
