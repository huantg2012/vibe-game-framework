/** Finite whole-layout search. Light evaluation and full deployment are separate budgets. */
import {createNativeSpatialLayout,nativeSpatialCountPairs,type NativeSpatialLayout} from './native-spatial-layout';
import {buildNativeSpatialGeometry,createNativeSpatialActualVoidFeedback,type NativeSpatialGeometry,type NativeSpatialActualVoidFeedback} from './native-spatial-geometry';
import {identifyNativeSpatialStructures,evaluateNativeSpatialGeometry} from './native-spatial-measure';
import {evaluateNativeSpatialVisibility} from './native-spatial-visibility';
import {evaluateNativeSpatialRouteProbe,type NativeSpatialRouteFeedback} from './native-spatial-route-feedback';
import {mix32} from '@/generation/seed-fork';
import type {NativeSpatialGroupResult} from './native-spatial-structures';
import type {MasterDefinition} from './r100-master-world';
import type {NativeSpatialCandidateTrace,NativeSpatialGateResult,NativeSpatialPolicy,NativeSpatialRuntimeInput,NativeSpatialGeometryWork,NativeSpatialGeometryWorkRequest} from './native-spatial-types';
import {NativeSpatialGeometryWorkBudgetError} from './native-spatial-types';

export interface NativeSpatialGeometryCandidate {
  readonly layout:NativeSpatialLayout; readonly geometry:NativeSpatialGeometry; readonly groups:NativeSpatialGroupResult;
  readonly trace:NativeSpatialCandidateTrace;
}
/** Offline diagnostics only. The observer receives a detached measured snapshot,
 * never live geometry or a feedback-selection handle. Its synchronous cost is
 * included in the current work/deadline; production omits this argument. */
export interface NativeSpatialMeasuredSnapshot {
  readonly layout:NativeSpatialLayout;readonly gate:NativeSpatialGateResult;readonly geometryHash:string;
}
export type NativeSpatialMeasurementObserver=(snapshot:NativeSpatialMeasuredSnapshot)=>void;
/** Failure context is already bounded by the initializer's finite domain and
 * twelve-state cap. Detach it before publishing the candidate receipt. */
export function nativeSpatialLayoutFailureContext(error:unknown):Pick<NativeSpatialCandidateTrace,'initialPlacement'|'qualification'> {
  if(!(error instanceof Error))return{};
  const context=error as Error&Pick<NativeSpatialCandidateTrace,'initialPlacement'|'qualification'>;
  return{...(context.initialPlacement?{initialPlacement:structuredClone(context.initialPlacement)}:{}),...(context.qualification?{qualification:structuredClone(context.qualification)}:{})};
}
export interface NativeSpatialAttemptTrace {
  readonly geometrySeed:number;
  readonly proposalBudget:number;
  layoutProposals:number;
  /** Total consumed work slots, including early failed final reservations. */
  geometryEvaluations:number;
  geometryWorkBudget?:number;
  finalGeometryEvaluations?:number;
  geometryWork?:NativeSpatialGeometryWorkTrace[];
  fullCandidates:number;
  routeEpochs?:NativeSpatialRouteEpochTrace[];
  feedbackBases:readonly NativeSpatialFeedbackBaseTrace[];
  readonly candidates:NativeSpatialCandidateTrace[];
  readonly deploymentRejections:{candidate:number;stage:'extraction'|'master'|'deployment'|'routes';reason:string;gate?:NativeSpatialGateResult;diagnostics?:unknown}[];
  stopReason:'searching'|'selected'|'proposal-budget'|'geometry-work-budget'|'full-candidate-budget'|'deadline';
}
export interface NativeSpatialRouteEpochTrace {readonly sourceCandidate:number;readonly sourceGeometryHash:string;readonly tupleLimit:48;consumedTuples:number;probeEvaluations:number;ended?:'tuple-budget'|'domain-exhausted'|'new-full-feedback'}
export interface NativeSpatialGeometryWorkTrace extends NativeSpatialGeometryWorkRequest {
  readonly ordinal:number;outcome:'running'|'accepted'|'rejected'|'exception';
  elapsedMs:number;reasons:readonly string[];invalidHoleIds?:readonly string[];error?:string;deadlineExceeded?:boolean;
  finalMeasurementStarted?:boolean;
}
/** Reserve before calling any geometry-producing work. The outer final work
 * includes layout/fragment compilation; nested initial-hole checks consume the
 * same budget. An early failed layout keeps that conservative reservation. */
export function createNativeSpatialGeometryWorkBudget(attempt:NativeSpatialAttemptTrace,limit:number,checkpoint:()=>void):NativeSpatialGeometryWork {
  if(!Number.isSafeInteger(limit)||limit<1)throw new Error('Invalid native geometry work budget');
  attempt.geometryWorkBudget=limit;attempt.finalGeometryEvaluations??=0;attempt.geometryWork??=[];
  return{checkpoint,run(request,work){
    checkpoint();
    if(attempt.geometryEvaluations>=limit){attempt.stopReason='geometry-work-budget';throw new NativeSpatialGeometryWorkBudgetError();}
    const started=performance.now(),measurementCount=attempt.finalGeometryEvaluations!;
    const trace:NativeSpatialGeometryWorkTrace={...request,...(request.site?{site:{...request.site}}:{}),ordinal:++attempt.geometryEvaluations,outcome:'running',elapsedMs:0,reasons:[]};
    attempt.geometryWork!.push(trace);
    try{
      const result=work();trace.outcome=result.accepted?'accepted':'rejected';trace.reasons=[...result.reasons];
      if(result.invalidHoleIds)trace.invalidHoleIds=[...result.invalidHoleIds];return result;
    }catch(error){trace.outcome='exception';trace.error=error instanceof Error?error.message:String(error);throw error;
    }finally{
      trace.elapsedMs=performance.now()-started;
      if(request.kind==='final-geometry')trace.finalMeasurementStarted=attempt.finalGeometryEvaluations!>measurementCount;
      try{checkpoint();}catch(error){trace.deadlineExceeded=true;throw error;}
    }
  }};
}

export interface NativeSpatialGeometryFingerprint {readonly hash:string;readonly canonical:string}
export interface NativeSpatialFeedbackBaseTrace {
  readonly firstCandidate:number;readonly geometryHash:string;readonly refinements:number;
  readonly stagnantRefinements:number;readonly exhausted:boolean;
  readonly singleScanStagnant:boolean;readonly jointAttempted:boolean;
  readonly lastResultCandidate?:number;readonly lastResultGeometryHash?:string;
  readonly refinable:boolean;readonly refinementRejectionReasons:readonly string[];
}
export interface NativeSpatialRefinementAdmission {readonly accepted:boolean;readonly reasons:readonly string[]}
/** Refinement moves already qualified whole objects. Broken final identities,
 * unsupported sources and fixed shoreline failures are not movable G1/G3
 * deficits. Keep their measurements, but never make them the next work base. */
export function nativeSpatialRefinementAdmission(gate:NativeSpatialGateResult,actualVoid:Readonly<{available:boolean;reason?:string}>):NativeSpatialRefinementAdmission {
  const reasons=gate.reasons.filter(reason=>reason.startsWith('hole-profile-')||reason.startsWith('bay-')||reason==='ineffective-spatial-objects'||reason==='final-source-footprint-unsupported');
  const metrics=gate.metrics;
  if(!actualVoid.available)reasons.push(actualVoid.reason??'actual-void-feedback-unavailable');
  if(typeof metrics.holeProfileViolationCount==='number'&&metrics.holeProfileViolationCount>0)reasons.push('invalid-final-hole-profile');
  if(Array.isArray(metrics.rejectedObjects)&&metrics.rejectedObjects.length)reasons.push('ineffective-spatial-objects');
  if(typeof metrics.finalSourceSupportViolationCount==='number'&&metrics.finalSourceSupportViolationCount>0)reasons.push('final-source-footprint-unsupported');
  if(typeof metrics.bayViolationCount==='number'&&metrics.bayViolationCount>0)reasons.push('invalid-fixed-bay');
  return{accepted:reasons.length===0,reasons:[...new Set(reasons)]};
}
interface NativeSpatialFeedback {readonly layout:NativeSpatialLayout;readonly gate:NativeSpatialGateResult;readonly fingerprint:NativeSpatialGeometryFingerprint;readonly actualVoid?:NativeSpatialActualVoidFeedback;readonly routeFeedback?:NativeSpatialRouteFeedback}
interface ArchivedFeedback extends NativeSpatialFeedback {readonly violations:readonly number[];readonly maximum:number;readonly sum:number}
interface FeedbackState {firstCandidate:number;geometryHash:string;refinements:number;stagnantRefinements:number;singleScanStagnant:boolean;jointAttempted:boolean;refinable:boolean;refinementRejectionReasons:readonly string[];lastResultCandidate?:number;lastResultGeometryHash?:string;routeStage?:boolean;domainExhausted?:boolean;routeTupleCursor?:number;routeSeenTupleKeys?:readonly string[]}
const MAX_STAGNANT_REFINEMENTS=4;
const routeOrGeometryViolations=(feedback:NativeSpatialFeedback,policy:NativeSpatialPolicy):readonly number[]=>feedback.routeFeedback?.violations??geometryViolationVector(feedback.gate,policy);
const exhausted=(state:FeedbackState):boolean=>!!state.domainExhausted||(state.routeStage?state.refinements>=48:state.stagnantRefinements>=MAX_STAGNANT_REFINEMENTS);
/** Actual compiled support, meshes, continuous contours and frozen object
 * identities, not gate values or a candidate ID. Hashes are diagnostic labels;
 * exact canonical equality guards the search against hash collisions. */
export function nativeSpatialGeometryFingerprint(geometry:NativeSpatialGeometry,layout:NativeSpatialLayout):NativeSpatialGeometryFingerprint {
  const {terrain}=geometry;
  const canonical=JSON.stringify({cols:terrain.cols,rows:terrain.rows,matter:Array.from(terrain.matter),reachable:Array.from(geometry.reachable),
    meshes:terrain.meshes.map(mesh=>({seed:mesh.spec.seed,role:terrain.roles.get(mesh.spec.id),positions:Array.from(mesh.positions),indices:Array.from(mesh.indices)})),
    outline:terrain.definition.terrainOutline,erosion:terrain.definition.erosion,assemblies:layout.assemblies,holes:layout.holes,bays:layout.bays,landJoins:layout.landJoins});
  let a=2166136261,b=0x9e3779b9;
  for(let i=0;i<canonical.length;i++){const code=canonical.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b^code,2246822519);}
  return{hash:(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0'),canonical};
}
/** Search ranking only. Every actual acceptance gate remains independent. */
function geometryViolationVector(gate:NativeSpatialGateResult,policy:NativeSpatialPolicy):readonly number[] {
  const m=gate.metrics,number=(key:string):number=>typeof m[key]==='number'?m[key] as number:Infinity;
  const excess=(value:number,limit:number):number=>Math.max(0,value-limit)/Math.max(1e-9,Math.abs(limit));
  const shortfall=(value:number,minimum:number):number=>Math.max(0,minimum-value)/Math.max(1e-9,Math.abs(minimum));
  const holes=number('holes'),solids=number('solids'),total=holes+solids;
  const ratioTolerance=Math.max(policy.holeCountAbsTolerance,policy.holeCountRelTolerance*solids);
  return [shortfall(total,number('minCount')),excess(total,number('maxCount')),
    Array.isArray(m.rejectedObjects)?m.rejectedObjects.length/Math.max(1,number('targetCount')):Infinity,
    shortfall(number('reachableBodySeats'),number('supportedBodySeats')),
    excess(Math.abs(number('walkAreaPx2')/number('targetWalkAreaPx2')-1),policy.areaToleranceRatio),
    shortfall(solids,policy.minSolidCount),policy.requireMoreHoles&&holes<=solids?1:0,
    excess(Math.abs(holes-policy.holeToSolidRatio*solids),ratioTolerance),
    typeof m.holeProfileViolationCount==='number'?m.holeProfileViolationCount/Math.max(1,holes):0,
    typeof m.bayViolationCount==='number'?m.bayViolationCount/Math.max(1,Number(m.bayCount)||0):0,
    typeof m.finalSourceSupportViolationCount==='number'?m.finalSourceSupportViolationCount/Math.max(1,solids):0,
    excess(number('maxEmptyUpperPx'),policy.maxEmptyRadiusPx),excess(number('maxDeepSpanPx'),policy.maxDeepEmptySpanPx),
    shortfall(number('wideRatio'),policy.minWideRatio),shortfall(number('largestWideRatio'),policy.minLargestWideRatio)];
}

const compareFeedback=(a:ArchivedFeedback,b:ArchivedFeedback):number=>a.maximum-b.maximum||a.sum-b.sum||a.layout.candidate-b.layout.candidate;
/** At most four unexhausted nondominated working proposals. The best measured
 * receipt is retained separately for evidence, never as an exhausted veto on
 * new exploration. Exact geometry history survives removal from the work front. */
export class NativeSpatialGeometryArchive {
  private candidates:ArchivedFeedback[]=[];
  private incumbent:ArchivedFeedback|undefined;
  private states=new Map<string,FeedbackState>();
  // Stage resets discard incomparable work fronts, not an already consumed
  // joint operation on exactly the same geometry in this generation attempt.
  private jointClaims=new Set<string>();
  private retired:NativeSpatialFeedbackBaseTrace[]=[];
  constructor(private readonly policy:NativeSpatialPolicy){}
  clear():void {this.retired.push(...this.currentHistory());this.candidates=[];this.incumbent=undefined;this.states.clear();}
  offer(layout:NativeSpatialLayout,gate:NativeSpatialGateResult,fingerprint:NativeSpatialGeometryFingerprint,actualVoid?:NativeSpatialActualVoidFeedback,routeFeedback?:NativeSpatialRouteFeedback,admission?:NativeSpatialRefinementAdmission):NativeSpatialFeedback {
    if(routeFeedback&&!routeFeedback.comparable)throw new Error('Incomparable route probe cannot enter native feedback archive');
    // Every previously measured geometry retains its usage even when it was
    // dominated or evicted. A new proposal ID cannot revive an exhausted plan.
    if(this.states.has(fingerprint.canonical))return this.incumbent!;
    this.states.set(fingerprint.canonical,{firstCandidate:layout.candidate,geometryHash:fingerprint.hash,refinements:0,stagnantRefinements:0,singleScanStagnant:false,jointAttempted:this.jointClaims.has(fingerprint.canonical),refinable:admission?.accepted??true,refinementRejectionReasons:admission?[...admission.reasons]:[],...(routeFeedback?{routeStage:true}:{})});
    const feedback={layout,gate,fingerprint,actualVoid,routeFeedback},violations=routeOrGeometryViolations(feedback,this.policy),entry:ArchivedFeedback={...feedback,violations,maximum:Math.max(...violations),sum:violations.reduce((a,b)=>a+b,0)};
    if(!this.incumbent||compareFeedback(entry,this.incumbent)<0)this.incumbent=entry;
    // Admission only controls the work front. A failed candidate still has its
    // original gate, diagnostic rank and canonical history, and cannot evict a
    // qualified base merely by reporting a smaller empty-space score.
    if(admission&&!admission.accepted)return this.incumbent;
    const dominates=(a:ArchivedFeedback,b:ArchivedFeedback):boolean=>a.violations.every((v,i)=>v<=b.violations[i]!)&&a.violations.some((v,i)=>v<b.violations[i]!);
    if(!this.candidates.some(existing=>dominates(existing,entry))){
      this.candidates=this.candidates.filter(existing=>!dominates(entry,existing));this.candidates.push(entry);
    }
    const compare=compareFeedback;
    this.candidates.sort(compare);
    if(this.candidates.length>4){
      const best=this.candidates[0]!,kept=new Set<ArchivedFeedback>([best]);
      // Keep the scalar incumbent first, then the strongest distinct gate
      // extremes. Four slots cannot preserve every possible Pareto direction.
      const extremes=best.violations.map((value,axis)=>{
        const extreme=[...this.candidates].sort((a,b)=>a.violations[axis]!-b.violations[axis]!||compare(a,b))[0]!;
        return{extreme,gain:value-extreme.violations[axis]!,axis};
      }).filter(row=>row.gain>0).sort((a,b)=>b.gain-a.gain||compare(a.extreme,b.extreme)||a.axis-b.axis);
      for(const row of extremes){if(kept.size===4)break;kept.add(row.extreme);}
      for(const entry of this.candidates){if(kept.size===4)break;kept.add(entry);}
      this.candidates=[...kept].sort(compare);
    }
    return this.incumbent;
  }
  recordRefinement(base:NativeSpatialFeedback,result?:NativeSpatialFeedback):void {
    const state=this.states.get(base.fingerprint.canonical);if(!state)throw new Error('Native refinement has no measured base history');
    const refinement=result?.layout.plan?.refinement;
    if(refinement?.kind==='single')state.singleScanStagnant=!refinement.constraintsImproved;
    const next=result?this.candidates.find(entry=>entry.layout.candidate===result.layout.candidate):undefined;
    const old=routeOrGeometryViolations(base,this.policy),maximum=Math.max(...old),sum=old.reduce((a,b)=>a+b,0);
    // Only a new retained nondominated plan with a strictly better real-gate
    // objective is progress. Repeated geometry/metrics cannot reset a budget.
    const improved=!!next&&next.fingerprint.canonical!==base.fingerprint.canonical&&(next.maximum<maximum||next.maximum===maximum&&next.sum<sum);
    state.refinements++;state.stagnantRefinements=improved?0:state.stagnantRefinements+1;
    if(result){state.lastResultCandidate=result.layout.candidate;state.lastResultGeometryHash=result.fingerprint.hash;}
    // An exhausted receipt remains in states/incumbent for evidence and exact
    // deduplication. It cannot dominate a fresh plan's chance to be refined.
    this.candidates=this.candidates.filter(entry=>!exhausted(this.states.get(entry.fingerprint.canonical)!));
  }
  retire(base:NativeSpatialFeedback):void {const state=this.states.get(base.fingerprint.canonical);if(!state)throw new Error('Native retirement has no measured base');state.domainExhausted=true;this.candidates=this.candidates.filter(entry=>entry.fingerprint.canonical!==base.fingerprint.canonical);}
  advanceRouteDomain(base:NativeSpatialFeedback,nextOrdinal:number,seenTupleKeys:readonly string[]):void {const state=this.states.get(base.fingerprint.canonical);if(!state||!state.routeStage||!Number.isSafeInteger(nextOrdinal)||nextOrdinal<(state.routeTupleCursor??0)||nextOrdinal>48)throw new Error('Invalid native route tuple cursor');state.routeTupleCursor=nextOrdinal;state.routeSeenTupleKeys=[...seenTupleKeys];}
  /** Claim before entering the sampler: failure or an exception still consumes
   * this immutable geometry's one joint candidate set. This does not alter the
   * existing refinement/progress budget or grant an exhausted base more work. */
  claimJoint(base:NativeSpatialFeedback):boolean {
    const state=this.states.get(base.fingerprint.canonical);if(!state)throw new Error('Native joint refinement has no measured base history');
    if(base.routeFeedback||!state.singleScanStagnant||state.jointAttempted||state.stagnantRefinements>=MAX_STAGNANT_REFINEMENTS||!base.actualVoid||
      !base.gate.reasons.some(reason=>reason.startsWith('G1-')||reason.startsWith('G3-')))return false;
    state.jointAttempted=true;
    this.jointClaims.add(base.fingerprint.canonical);
    return true;
  }
  firstCandidate(fingerprint:NativeSpatialGeometryFingerprint):number|undefined{return this.states.get(fingerprint.canonical)?.firstCandidate;}
  private currentHistory():NativeSpatialFeedbackBaseTrace[]{return[...this.states.values()].map(state=>({...state,exhausted:exhausted(state)}));}
  get baseHistory():readonly NativeSpatialFeedbackBaseTrace[]{return[...this.retired,...this.currentHistory()];}
  get candidateIds():readonly number[]{return this.candidates.map(entry=>entry.layout.candidate);}
  get best():NativeSpatialFeedback|undefined{return this.incumbent;}
  get nextBase():NativeSpatialFeedback|undefined {const entry=this.candidates.find(value=>!exhausted(this.states.get(value.fingerprint.canonical)!));if(!entry)return undefined;
    return entry.routeFeedback?{...entry,routeFeedback:{...entry.routeFeedback,refinementOrdinal:this.states.get(entry.fingerprint.canonical)!.routeTupleCursor??0,seenTupleKeys:this.states.get(entry.fingerprint.canonical)!.routeSeenTupleKeys??[]}}:entry;}
}

/** Failed ground measurements refine later whole plans; admitted geometry is immutable.
 * Visibility and full deployment rejection remain separate stage traces. */
export function* createNativeSpatialGeometryCandidates(native:MasterDefinition,input:NativeSpatialRuntimeInput,requestedSeed:number,geometrySeed:number,
  attempt:NativeSpatialAttemptTrace,checkpoint:()=>void,onMeasured?:NativeSpatialMeasurementObserver):Generator<NativeSpatialGeometryCandidate,void,NativeSpatialRouteFeedback|undefined> {
  const archive=new NativeSpatialGeometryArchive(input.policy);
  const geometryWork=createNativeSpatialGeometryWorkBudget(attempt,input.policy.maxGeometryEvaluations,checkpoint);
  const pairs=nativeSpatialCountPairs(input);
  if(!pairs.length)throw new Error('Native spatial intent has no legal whole-layout count pair');
  const domains=pairs.flatMap((_,countPairIndex)=>input.world.bayCountOptions.map((_,bayCountIndex)=>({countPairIndex,bayCountIndex})));
  if(domains.length>input.policy.maxGeometryEvaluations)throw new Error('Count-pair / bay probe domain exceeds the bounded proposal budget');
  let initialDomain=0,explorationDomain=0;
  let routeEpoch:NativeSpatialRouteEpochTrace|undefined;
  for(let candidate=0;candidate<input.policy.maxGeometryEvaluations;candidate++){
    checkpoint();
    if(attempt.geometryEvaluations>=input.policy.maxGeometryEvaluations){attempt.stopReason='geometry-work-budget';return;}
    // Give every frozen H/S × B branch one opportunity, with fewer H/S objects
    // first. An early B=0 incumbent cannot exclude B=1/2 from the finite search.
    if(routeEpoch&&routeEpoch.consumedTuples>=routeEpoch.tupleLimit){routeEpoch.ended='tuple-budget';archive.clear();routeEpoch=undefined;}
    const nextBase=archive.nextBase;
    // A new whole-plan branch has a new content context. Retain the exhausted
    // history, but never compare its geometry-only vector to an old route probe.
    if(!nextBase&&archive.best?.routeFeedback){if(routeEpoch)routeEpoch.ended='domain-exhausted';routeEpoch=undefined;archive.clear();}
    const fresh=!nextBase||(!nextBase.routeFeedback&&initialDomain<domains.length);
    const previous=fresh?undefined:nextBase?.routeFeedback?{...nextBase,routeFeedback:{...nextBase.routeFeedback,remainingTupleBudget:routeEpoch!.tupleLimit-routeEpoch!.consumedTuples}}:nextBase;
    const {countPairIndex,bayCountIndex}=fresh?domains[initialDomain<domains.length?initialDomain++:explorationDomain++%domains.length]!:
      {countPairIndex:previous!.layout.countPairIndex,bayCountIndex:previous!.layout.bayCountIndex};
    if(!pairs[countPairIndex]||input.world.bayCountOptions[bayCountIndex]===undefined)throw new Error('Archived native plan no longer belongs to its frozen count / bay domain');
    const requestedBayCount=input.world.bayCountOptions[bayCountIndex]!;
    const proposalKind=fresh?'fresh':'refinement';
    const feedbackBaseCandidate=previous?.layout.candidate;
    const feedbackBaseHash=previous?.fingerprint.hash;
    checkpoint();let layout:NativeSpatialLayout|undefined;
    attempt.layoutProposals++;
    const jointAllowed=previous?archive.claimJoint(previous):false;
    attempt.feedbackBases=archive.baseHistory;
    let routeTrialsCharged=false;
    const chargeRouteTrials=(value:unknown):void=>{
      if(!previous?.routeFeedback||routeTrialsCharged)return;
      if(!value||typeof value!=='object'||!('consumedTuples'in value)||!('nextOrdinal'in value)||!('seenTupleKeys'in value))throw new Error('Native route placement omitted its tuple ledger');
      const consumed=value.consumedTuples,next=value.nextOrdinal,seen=value.seenTupleKeys,old=previous.routeFeedback.seenTupleKeys;
      if(!routeEpoch||typeof consumed!=='number'||!Number.isSafeInteger(consumed)||consumed<0||consumed>routeEpoch.tupleLimit-routeEpoch.consumedTuples||typeof next!=='number'||!Array.isArray(seen)||seen.some(key=>typeof key!=='string')||new Set(seen).size!==seen.length||consumed!==seen.length-old.length||old.some((key,i)=>key!==seen[i]))
        throw new Error('Native route placement exceeded its shared tuple budget');
      routeEpoch.consumedTuples+=consumed;archive.advanceRouteDomain(previous,next,seen as string[]);routeTrialsCharged=true;
    };
    try {
      const measured=geometryWork.run({kind:'final-geometry',candidate},()=>{
        let proposal:NativeSpatialLayout;
        try{proposal=createNativeSpatialLayout(native,input,requestedSeed,geometrySeed,candidate,previous?{...previous,allowJoint:jointAllowed}:undefined,countPairIndex,bayCountIndex,geometryWork);}
        catch(error){
          // Charge before the work wrapper's final deadline checkpoint can
          // replace the thrown layout error with a newer deadline exception.
          if(error&&typeof error==='object'&&'routeRefinement'in error)chargeRouteTrials(error.routeRefinement);
          throw error;
        }
        if(previous?.routeFeedback)chargeRouteTrials(proposal.plan.refinement?.route);
        layout=proposal;checkpoint();attempt.finalGeometryEvaluations!++;
        const geometry=buildNativeSpatialGeometry(proposal.definition,geometrySeed),groups=identifyNativeSpatialStructures(geometry,proposal.assemblies,input.policy);
        const fingerprint=nativeSpatialGeometryFingerprint(geometry,proposal);
        const ground=evaluateNativeSpatialGeometry(geometry,groups,input.policy,input.world,{placements:proposal.holes,profiles:input.holeProfiles},
          {landRects:proposal.plan.land,placements:proposal.bays,landJoins:proposal.landJoins,profiles:input.bayProfiles,allowedCounts:input.world.bayCountOptions,minWideJoinPx:input.world.landRectMinOverlapPx});
        if(onMeasured)onMeasured(structuredClone({layout:proposal,gate:ground,geometryHash:fingerprint.hash}));
        const actualVoid=createNativeSpatialActualVoidFeedback(geometry,groups,proposal.holes);
        return{accepted:ground.accepted,reasons:ground.reasons,layout:proposal,geometry,groups,fingerprint,ground,actualVoid};
      });
      layout=measured.layout;
      const {geometry,groups,fingerprint,ground,actualVoid}=measured,duplicateOfCandidate=archive.firstCandidate(fingerprint);
      const actualVoidFeedback={available:!!actualVoid.feedback,...(actualVoid.reason?{reason:actualVoid.reason}:{}),holeCount:actualVoid.feedback?.holes.length??0};
      const refinementAdmission=nativeSpatialRefinementAdmission(ground,actualVoidFeedback);
      const gates:Record<string,NativeSpatialGateResult>={geometry:ground};
      // G1 and wide-domain failures are already decisive. Expensive visibility is evaluated only for survivors.
      if(ground.accepted){checkpoint();gates.visibility=evaluateNativeSpatialVisibility(geometry,groups.structures,input.policy);}
      let routeFeedback:NativeSpatialRouteFeedback|undefined;
      if(previous?.routeFeedback&&ground.accepted&&gates.visibility?.accepted){
        routeEpoch!.probeEvaluations++;
        routeFeedback=evaluateNativeSpatialRouteProbe(previous.routeFeedback.probe,geometry,groups,ground,input.policy,checkpoint);
        gates.routeProbe=routeFeedback.gate;
      }
      const reasons=[...Object.values(gates).flatMap(gate=>gate.reasons),...(routeFeedback?.comparabilityReasons.map(reason=>`route-probe:${reason}`)??[])],accepted=!reasons.length;
      if(previous?.routeFeedback){
        if(routeFeedback?.comparable)archive.offer(layout,ground,fingerprint,actualVoid.feedback,routeFeedback,refinementAdmission);
        archive.recordRefinement(previous,routeFeedback?.comparable?{layout,gate:ground,fingerprint,actualVoid:actualVoid.feedback,routeFeedback}:undefined);
      }else if(ground.accepted){
        // G2 / full deployment feedback is a separate stage, not comparable to
        // unfinished G1/G3 constraints. Its rejection stays in the stage trace;
        // the next attempt is a new complete plan, never a fake G1 hotspot.
        archive.clear();
      }else{
        archive.offer(layout,ground,fingerprint,actualVoid.feedback,undefined,refinementAdmission);
        if(previous)archive.recordRefinement(previous,{layout,gate:ground,fingerprint,actualVoid:actualVoid.feedback});
      }
      attempt.feedbackBases=archive.baseHistory;
      const trace:NativeSpatialCandidateTrace={candidate,geometrySeed,layoutSeed:layout.layoutSeed,geometryHash:fingerprint.hash,actualVoidFeedback,jointAllowed,
        ...(routeFeedback?{routeProbe:{sourceCandidate:routeFeedback.probe.sourceCandidate,sourceGeometryHash:routeFeedback.probe.sourceGeometryHash,refinementOrdinal:previous!.routeFeedback!.refinementOrdinal,
          comparable:routeFeedback.comparable,comparabilityReasons:routeFeedback.comparabilityReasons,violations:routeFeedback.violations,maximum:Number.isFinite(routeFeedback.maximum)?routeFeedback.maximum:null,sum:Number.isFinite(routeFeedback.sum)?routeFeedback.sum:null,witnessCount:routeFeedback.witnesses.length}}:{}),
        ...(duplicateOfCandidate===undefined?{}:{duplicateOfCandidate}),proposalKind,countPairIndex,bayCountIndex,requestedBayCount,...(feedbackBaseCandidate===undefined?{}:{feedbackBaseCandidate,feedbackBaseHash}),
        feedbackArchiveCandidates:archive.candidateIds,feedbackBestCandidate:archive.best?.layout.candidate,requestedCounts:layout.requestedCounts,accepted,reasons,gates};
      attempt.candidates.push(trace);
      checkpoint();
      if(accepted){
        const feedback=yield{layout,geometry,groups,trace};
        if(feedback){
          const probe=feedback.probe;
          if(probe.geometrySeed!==geometrySeed||probe.sourceCandidate!==candidate||probe.sourceGeometryHash!==fingerprint.hash)
            throw new Error('Native full route feedback does not belong to the yielded candidate');
          if(feedback.gate.accepted||!feedback.comparable)throw new Error('Native full route feedback requires a comparable failed family');
          if(routeEpoch)routeEpoch.ended='new-full-feedback';
          routeEpoch={sourceCandidate:probe.sourceCandidate,sourceGeometryHash:probe.sourceGeometryHash,tupleLimit:48,consumedTuples:0,probeEvaluations:0};
          (attempt.routeEpochs??=[]).push(routeEpoch);
          archive.clear();archive.offer(layout,ground,fingerprint,actualVoid.feedback,feedback,refinementAdmission);attempt.feedbackBases=archive.baseHistory;
        }
      }
    }catch(error){
      const reason=error instanceof Error?error.message:String(error);
      const routeRefinement=error&&typeof error==='object'&&'routeRefinement'in error?error.routeRefinement:undefined;
      if(routeRefinement)chargeRouteTrials(routeRefinement);
      if(attempt.stopReason==='deadline')throw error;
      if(previous){archive.recordRefinement(previous);if(previous.routeFeedback&&error&&typeof error==='object'&&'routeRefinement'in error&&error.routeRefinement&&typeof error.routeRefinement==='object'&&'exhausted'in error.routeRefinement&&error.routeRefinement.exhausted===true)archive.retire(previous);}
      attempt.feedbackBases=archive.baseHistory;
      const layoutSeed=layout?.layoutSeed??mix32(requestedSeed,`${input.policy.algorithm}:${input.policy.version}:${input.policy.sourceHash}:${input.world.worldId}:${geometrySeed}:${candidate}`);
      attempt.candidates.push({candidate,geometrySeed,layoutSeed,jointAllowed,proposalKind,countPairIndex,bayCountIndex,requestedBayCount,...nativeSpatialLayoutFailureContext(error),...(feedbackBaseCandidate===undefined?{}:{feedbackBaseCandidate,feedbackBaseHash}),feedbackArchiveCandidates:archive.candidateIds,feedbackBestCandidate:archive.best?.layout.candidate,requestedCounts:layout?.requestedCounts??pairs[countPairIndex]!,accepted:false,reasons:[reason],gates:routeRefinement?{routePlanning:{accepted:false,reasons:[reason],metrics:{refinement:routeRefinement}}}:{}});
      if(attempt.stopReason==='geometry-work-budget')return;
    }
  }
  attempt.stopReason=attempt.geometryEvaluations>=input.policy.maxGeometryEvaluations?'geometry-work-budget':'proposal-budget';
}
