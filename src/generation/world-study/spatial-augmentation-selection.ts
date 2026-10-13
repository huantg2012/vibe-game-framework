/** Bounded, deterministic geometry planning before extraction/content deployment. */
import type { Vector2 } from '@/types/game-types';
import { hasLineOfSight } from '@/utils/grid-raycast';
import { buildNativeVolume } from './native-volume-geometry';
import { spatialCandidateAttempts, type SpatialTerrainPlan, type SpatialTerrainCandidate } from './spatial-augmentation-candidates';
import { buildSpatialGeometry, createSpatialBaseline, measureSpatialCandidate, spatialHotspots, spatialReachable, spatialSolidFootprint, spatialCellPoint,
  type SpatialBaseline, type SpatialMeasuredState, type SpatialGeometry } from './spatial-augmentation-measure';
import { validSpatialAugmentationPolicy, type SpatialAugmentationPolicy, type SpatialAugmentationTrace, type SpatialCandidateReceipt,
  type SpatialAugmentationAxis, type SpatialRevealWitness } from './spatial-augmentation-types';
import type { MasterDefinition } from './r100-master-world';
import type { R100FrozenFragmentShape } from './r100-fragment-shape';

const STEP=8,EPS=1e-9,HALF=10;
const directions=[[1,0],[0,1],[-1,0],[0,-1]] as const;
const errorMessage=(error:unknown):string=>error instanceof Error?error.message:String(error);
function boundarySamples(points:readonly Readonly<Vector2>[]):Vector2[] {
  const result:Vector2[]=[];for(let i=0;i<points.length;i++) {
    const a=points[i]!,b=points[(i+1)%points.length]!,steps=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/STEP));
    for(let j=0;j<steps;j++)result.push({x:a.x+(b.x-a.x)*j/steps,y:a.y+(b.y-a.y)*j/steps});
  }return result;
}
/** Runs before an entire candidate support graph. All tests use true projected
 * triangles / actual compiled hole edges, with conservative sampling margins. */
function preflight(current:SpatialMeasuredState,candidate:SpatialTerrainCandidate,p:SpatialAugmentationPolicy['parameters'],seed:number):readonly string[] {
  const reasons:string[]=[],definition=candidate.definition;
  const ids=definition.instances.map(row=>row.id);
  if(new Set(ids).size!==ids.length)reasons.push('duplicate-object-id');
  if(ids.length>48||definition.instances.filter(row=>row.role==='solid').length>32)reasons.push('object-capacity');
  if(candidate.addedSolidIds.length>p.maxAddedSolids||candidate.addedVoidCount>p.maxAddedVoids)reasons.push('addition-budget');
  const oldInstances=current.geometry.terrain.definition.instances;
  if(oldInstances.some(row=>JSON.stringify(row)!==JSON.stringify(definition.instances.find(item=>item.id===row.id))))reasons.push('source-instance-mutated');
  const meshes=definition.instances.filter(row=>candidate.newSolidIds.includes(row.id)).map(({role:_role,...row})=>buildNativeVolume({...row,family:row.family??definition.family,blocking:1,seed:seed^Math.imul(row.id,104729)}));
  const footprint=spatialSolidFootprint({...current.geometry.terrain,definition,meshes},new Set(candidate.newSolidIds));
  if(candidate.newSolidIds.length&&!footprint.length)reasons.push('empty-solid-footprint');
  for(const point of footprint) {
    if(current.geometry.solidDistance(point)<p.minSolidSeparationPx+Math.SQRT2*STEP/2){reasons.push('solid-separation');break;}
  }
  for(const point of footprint)if(!current.geometry.terrain.matterAt(point.x,point.y)){reasons.push('solid-outside-ground');break;}
  for(const point of boundarySamples(candidate.newVoidBoundary)) {
    if(current.geometry.voidDistance(point)<p.minVoidSeparationPx+STEP/2){reasons.push('void-separation');break;}
  }
  for(const point of boundarySamples(candidate.newVoidBoundary)) {
    if(current.geometry.solidDistance(point)<p.minSolidSeparationPx+STEP/2){reasons.push('void-cuts-or-crowds-existing-solid');break;}
  }
  return reasons;
}
/** A real hidden/reappearing target with a shortest supported 20px-body route.
 * Only VOID obscures the shared ray; scenery cannot satisfy this witness. */
export function findSpatialRevealWitness(baseline:SpatialBaseline,geometry:SpatialGeometry,previous:SpatialGeometry=baseline.geometry,focus?:{readonly point:Readonly<Vector2>;readonly radius:number}):SpatialRevealWitness|undefined {
  const p=baseline.parameters,cols=geometry.terrain.cols,count=geometry.reachable.length,maxSteps=Math.floor(p.revealRouteMaxPx/STEP);
  for(const probe of baseline.probes) {
    if(focus&&Math.hypot(probe.point.x-focus.point.x,probe.point.y-focus.point.y)>focus.radius+EPS)continue;
    if(!spatialReachable(geometry,probe.point))continue;
    for(const pair of probe.pairs) {
      if(pair.originallyBlocked||Math.hypot(pair.endpoint.x-probe.point.x,pair.endpoint.y-probe.point.y)>p.occlusionRadiusPx+EPS||!hasLineOfSight(previous.sight,probe.point,pair.endpoint)||!spatialReachable(geometry,pair.endpoint)||hasLineOfSight(geometry.sight,probe.point,pair.endpoint))continue;
      const start=Math.floor(pair.endpoint.y/STEP)*cols+Math.floor(pair.endpoint.x/STEP),startPoint=spatialCellPoint(start,cols);
      if(!geometry.reachable[start]||hasLineOfSight(geometry.sight,probe.point,startPoint)
        ||geometry.collision.displacementFraction(pair.endpoint,HALF,HALF,startPoint.x-pair.endpoint.x,startPoint.y-pair.endpoint.y)<1-EPS)continue;
      const parents=new Int32Array(count).fill(-1),distance=new Int16Array(count),queue=new Int32Array(count);
      let head=0,tail=1;queue[0]=start;parents[start]=start;
      while(head<tail) {
        const cell=queue[head++]!,at=spatialCellPoint(cell,cols),length=distance[cell]!*STEP+Math.hypot(startPoint.x-pair.endpoint.x,startPoint.y-pair.endpoint.y);
        if(length>=p.revealRouteMinPx&&length<=p.revealRouteMaxPx&&Math.hypot(at.x-probe.point.x,at.y-probe.point.y)<=p.referenceSightPx+EPS&&hasLineOfSight(geometry.sight,probe.point,at)) {
          const route:Vector2[]=[];let cursor=cell;while(cursor!==start){route.push(spatialCellPoint(cursor,cols));cursor=parents[cursor]!;}
          route.push(startPoint);route.reverse();if(Math.hypot(startPoint.x-pair.endpoint.x,startPoint.y-pair.endpoint.y)>EPS)route.unshift({...pair.endpoint});
          return {observer:probe.point,hidden:pair.endpoint,revealed:at,route,routeLengthPx:length};
        }
        if(distance[cell]!>=maxSteps)continue;
        for(let d=0;d<4;d++)if(geometry.links[cell]!&(1<<d)) {
          const next=cell+directions[d]![0]+directions[d]![1]*cols;
          if(parents[next]===-1){parents[next]=cell;distance[next]=distance[cell]!+1;queue[tail++]=next;}
        }
      }
    }
  }return undefined;
}
export interface SpatialCandidateEvaluation {readonly receipt:SpatialCandidateReceipt;readonly state?:SpatialMeasuredState}
/** Public pure evaluation seam for small fixtures and negative-control tests. */
export function evaluateSpatialCandidate(baseline:SpatialBaseline,current:SpatialMeasuredState,candidate:SpatialTerrainCandidate,policy:SpatialAugmentationPolicy,seed:number):SpatialCandidateEvaluation {
  const p=policy.parameters,metadata={id:candidate.id,kind:candidate.kind,axis:candidate.axis,hotspot:candidate.hotspot,accepted:false};
  try {
    const reasons=[...preflight(current,candidate,p,seed)];if(reasons.length)return {receipt:{...metadata,reasons}};
    const geometry=buildSpatialGeometry(candidate.definition,seed),state=measureSpatialCandidate(baseline,geometry);
    if(geometry.reachableCount/geometry.supportedCount<p.minReachableRatio)reasons.push('body-reachability');
    const conservativeSeats=geometry.terrain.seats.reduce((a,b)=>a+b,0);
    if(geometry.terrain.reachableBodySeats/conservativeSeats<p.minReachableRatio)reasons.push('navigation-reachability');
    if(state.removedBaseRatio>p.maxRemovedBaseRatio+EPS)reasons.push('base-ground-loss');
    if(state.addedSolidRatio>p.maxSolidAddedRatio+EPS)reasons.push('solid-area-upper-bound');
    if(state.bodyCenterLossRatio>p.maxBodyCenterLossRatio+EPS)reasons.push('body-center-loss');
    if(state.wideCoreRetainedRatio!==null&&state.wideCoreRetainedRatio+EPS<p.minWideCoreRetainedRatio)reasons.push('wide-core-loss');
    if(state.largestOpenCoreRetainedRatio!==null&&state.largestOpenCoreRetainedRatio+EPS<p.minLargestOpenCoreRetainedRatio)reasons.push('largest-open-core-loss');
    if(!state.anchorsConnected)reasons.push('fixed-anchor-lost');
    // Whole-ring recompilation may move old shore detail, but must never cut
    // underneath pre-existing solid geometry that previously had support.
    for(let i=0;i<geometry.terrain.matter.length;i++)if(current.geometry.protectedSupport[i]&&current.geometry.terrain.matter[i]&&!geometry.terrain.matter[i]){reasons.push('ground-cut-under-existing-solid-or-relief');break;}
    const newFootprint=spatialSolidFootprint(geometry.terrain,new Set(candidate.newSolidIds));
    for(const point of newFootprint)if(!geometry.terrain.matterAt(point.x,point.y)||geometry.voidDistance(point)<p.minSolidSeparationPx+Math.SQRT2*STEP/2){reasons.push('solid-void-body-gap');break;}
    const target=candidate.axis,other:SpatialAugmentationAxis=target==='physical'?'occlusion':'physical';
    const before=target==='physical'?current.physicalCosts:current.occlusionCosts,after=target==='physical'?state.physicalCosts:state.occlusionCosts;
    let previous=0,next=0;
    for(let i=0;i<baseline.probes.length;i++)if(Math.hypot(baseline.probes[i]!.point.x-candidate.hotspot.x,baseline.probes[i]!.point.y-candidate.hotspot.y)<=p.hotspotRadiusPx){previous+=before[i]??0;next+=after[i]??0;}
    const improvement=previous>EPS?(previous-next)/previous:0;
    if(improvement+EPS<p.minimumImprovement)reasons.push('insufficient-hotspot-improvement');
    if(state.deficits[target]>=current.deficits[target]-EPS)reasons.push('no-target-axis-improvement');
    if(state.deficits[other]>current.deficits[other]+EPS)reasons.push('other-axis-regression');
    const opticalImprovement=state.deficits.occlusion<current.deficits.occlusion-EPS;
    const reveal=opticalImprovement&&!reasons.length?findSpatialRevealWitness(baseline,geometry,current.geometry,{point:candidate.hotspot,radius:p.hotspotRadiusPx}):undefined;
    if(opticalImprovement&&!reasons.length&&!reveal)reasons.push('no-void-reveal-witness');
    const receipt:SpatialCandidateReceipt={...metadata,reasons,deficits:state.deficits,targetImprovement:improvement,
      removedBaseRatio:state.removedBaseRatio,addedSolidRatio:state.addedSolidRatio,bodyCenterLossRatio:state.bodyCenterLossRatio,
      wideCoreRetainedRatio:state.wideCoreRetainedRatio,largestOpenCoreRetainedRatio:state.largestOpenCoreRetainedRatio,...(reveal?{reveal}:{})};
    return {receipt,...(!reasons.length?{state}:{})};
  }catch(error){return {receipt:{...metadata,reasons:[errorMessage(error)]}};}
}
export interface SpatialAugmentedTerrain extends SpatialTerrainPlan {readonly trace:SpatialAugmentationTrace}
export interface SpatialAugmentationRequest {readonly definition:MasterDefinition;readonly fragmentShape:R100FrozenFragmentShape;readonly policy:SpatialAugmentationPolicy;readonly seed:number;readonly candidateSeed?:number}
const limitations=['Physical clearance uses projected solid triangles and authoritative 8px VOID edges; ordinary solids do not block LOS.',
  'Solid area is a conservative union of 8px cells intersecting actual triangles, not a bounding-box area.',
  'Fixed probes and wide-core anchors are finite witnesses, not whole-world stealth or play-quality certification.',
  'A v1 fragment recompile can change earlier shore details; relative base-ground and body/core guards remain mandatory.',
  'Original solid and non-ground-owner relief footprints retain supporting ground; the ground-edge owner substrate uses ground-loss/core/connectivity guards.'] as const;
/** At most maxRounds*maxCandidatesPerRound light candidates. Only final plan
 * definitions survive; callers lazily raster/deploy no more than two of them. */
export function augmentSpatialTerrain(request:SpatialAugmentationRequest):readonly SpatialAugmentedTerrain[] {
  const {definition,fragmentShape,policy,seed}=request;const candidateSeed=request.candidateSeed??seed;if(!Number.isSafeInteger(candidateSeed)||candidateSeed<0||candidateSeed>0xffffffff)throw new Error('Candidate seed must be uint32');if(!validSpatialAugmentationPolicy(policy))throw new Error('Invalid frozen spatial augmentation policy');
  const baseline=createSpatialBaseline(buildSpatialGeometry(definition,seed),policy.parameters),initial=measureSpatialCandidate(baseline,baseline.geometry);
  let plan:SpatialTerrainPlan={definition,fragmentShape,addedSolidIds:[],addedVoidCount:0},state=initial;
  let prior:{plan:SpatialTerrainPlan;state:SpatialMeasuredState;accepted:readonly string[]}|undefined;
  const receipts:SpatialCandidateReceipt[]=[],accepted:string[]=[];let rounds=0,status:SpatialAugmentationTrace['status']='disabled';
  const targetsMet=(value:SpatialMeasuredState):boolean=>value.deficits.physical<=baseline.deficits.physical*(1-policy.parameters.targetPhysicalReduction)+EPS
    &&value.deficits.occlusion<=baseline.deficits.occlusion*(1-policy.parameters.targetOcclusionReduction)+EPS;
  if(policy.enabled) {
    status=targetsMet(state)?'policy-targets-met':'budget-exhausted';
    for(let round=0;round<policy.parameters.maxRounds&&!targetsMet(state);round++) {
      rounds=round+1;
      const ratio=(axis:SpatialAugmentationAxis):number=>baseline.deficits[axis]>EPS?state.deficits[axis]/baseline.deficits[axis]:0;
      const pending=(['physical','occlusion'] as const).filter(axis=>state.deficits[axis]>baseline.deficits[axis]*(1-(axis==='physical'?policy.parameters.targetPhysicalReduction:policy.parameters.targetOcclusionReduction))+EPS)
        .sort((a,b)=>ratio(b)-ratio(a)||(a==='physical'?-1:1));
      const axis=pending[0]!,primary=spatialHotspots(baseline,state,axis),secondary=pending[1]?spatialHotspots(baseline,state,pending[1]):[];
      // An unsuccessful physical pass cannot stand in for a joint search. With
      // both axes pending, reserve one of the three hotspot slots for the other.
      const hotspots=secondary.length?[...primary.slice(0,2),...secondary.slice(0,Math.max(1,3-Math.min(primary.length,2)))]:primary.slice(0,3);
      let best:{candidate:SpatialTerrainCandidate;state:SpatialMeasuredState;index:number}|undefined;
      for(const attempt of spatialCandidateAttempts(plan,hotspots,policy,seed,round,candidateSeed)) {
        if(!attempt.candidate){receipts.push({id:attempt.id,kind:attempt.kind,axis:attempt.axis,hotspot:attempt.hotspot,accepted:false,reasons:[attempt.rejection??'candidate-unavailable']});continue;}
        const evaluation=evaluateSpatialCandidate(baseline,state,attempt.candidate,policy,seed),index=receipts.length;receipts.push(evaluation.receipt);
        if(evaluation.state) {
          const key=(value:SpatialMeasuredState,receipt:SpatialCandidateReceipt,candidate:SpatialTerrainCandidate):readonly number[]=>[
            pending.indexOf(candidate.axis),value.deficits[candidate.axis],value.deficits[candidate.axis==='physical'?'occlusion':'physical'],value.removedBaseRatio,value.bodyCenterLossRatio,
            receipt.reveal?.routeLengthPx??Infinity,candidate.definition.instances.length+candidate.addedVoidCount];
          const a=key(evaluation.state,evaluation.receipt,attempt.candidate),b=best?key(best.state,receipts[best.index]!,best.candidate):undefined;
          let better=!b;if(b)for(let k=0;k<a.length;k++){if(a[k]===b[k])continue;better=a[k]!<b[k]!;break;}
          if(better)best={candidate:attempt.candidate,state:evaluation.state,index};
        }
      }
      if(!best){status='no-feasible-improvement';break;}
      prior={plan,state,accepted:[...accepted]};plan=best.candidate;state=best.state;accepted.push(best.candidate.id);
      receipts[best.index]={...receipts[best.index]!,accepted:true};
      if(targetsMet(state))status='policy-targets-met';
    }
  }
  const trace=(value:SpatialMeasuredState,terrain:SpatialTerrainPlan,ids:readonly string[],fallback:boolean):SpatialAugmentationTrace=>({algorithm:policy.algorithm,geometrySeed:seed,candidateSeed,
    status:fallback?(targetsMet(value)?'policy-targets-met':'no-feasible-improvement'):status,rounds,evaluatedCandidates:receipts.length,
    baselineDeficits:baseline.deficits,remainingDeficits:value.deficits,acceptedCandidateIds:ids,addedSolidIds:terrain.addedSolidIds,addedVoidCount:terrain.addedVoidCount,
    candidates:receipts.map(row=>({...row,accepted:ids.includes(row.id)})),fallback,limitations:[...limitations,...(baseline.deficits.physical===0&&baseline.deficits.occlusion===0?['no-deficit']:[])]});
  const result:SpatialAugmentedTerrain[]=[{...plan,trace:trace(state,plan,accepted,false)}];
  if(prior)result.push({...prior.plan,trace:trace(prior.state,prior.plan,prior.accepted,true)});
  return result;
}
