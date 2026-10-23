/** Revision-14 local G2 certificate. Adds only actual attributed witnesses;
 * neither terrain, body links, sight range nor route limits are changed. */
import {hasLineOfSight} from '@/utils/grid-raycast';
import type {OccluderGrid} from '@/types/map-types';
import {nativeCellPoint,NATIVE_SPATIAL_DIRECTIONS as directions,type NativeSpatialGeometry} from './native-spatial-geometry';
import {nativeSpatialShortestPaths} from './native-spatial-visibility';
import type {NativeSpatialStructure} from './native-spatial-structures';
import type {NativeSpatialGateResult,NativeSpatialPolicy} from './native-spatial-types';

export interface NativeAutoVisibilityBudget {
  readonly maxQ:number;readonly maxLosChecks:number;readonly maxPathQueries:number;readonly maxCoverageRecomputes:number;
}
interface Coverage {
  readonly maxRoutePx:number|null;readonly worstCell:number;readonly overLimit:number;readonly unreachable:number;readonly checkedBodyCenters:number;
}
interface Witness {
  readonly holeId:string;readonly q:number;readonly v:number;readonly t:number;
  readonly routePx:number;readonly sightPx:number;readonly querySightPx:number;
}
type StopReason='q-budget'|'los-budget'|'path-budget'|'coverage-budget'|'local-domain-exhausted'|'all-body-centers-covered';
const DEFAULT_BUDGET:NativeAutoVisibilityBudget={maxQ:512,maxLosChecks:131072,maxPathQueries:512,maxCoverageRecomputes:16};
class CertificateBudgetStop extends Error {constructor(readonly reason:StopReason){super(reason);}}
type Paths=ReturnType<typeof nativeSpatialShortestPaths>;

function measureCoverage(geometry:NativeSpatialGeometry,paths:Paths,limitPx:number):Coverage {
  let maxPx=0,worstCell=-1,overLimit=0,unreachable=0;
  for(let cell=0;cell<geometry.reachable.length;cell++)if(geometry.reachable[cell]){
    const length=paths.distance[cell]!/1000;
    if(!Number.isFinite(length))unreachable++;
    if(length>limitPx)overLimit++;
    if(length>maxPx){maxPx=length;worstCell=cell;}
  }
  return{maxRoutePx:Number.isFinite(maxPx)?maxPx:null,worstCell,overLimit,unreachable,checkedBodyCenters:geometry.reachableCount};
}

/** Local q domain follows existing genuine body paths from failed cells to
 * already-proved q. Neighbours are only reachable 8px body seats. The preferred
 * part of each path advances just beyond the missing coverage distance. */
function localQueries(geometry:NativeSpatialGeometry,paths:Paths,existing:Set<number>,limitPx:number,maxQ:number):number[] {
  const {cols,rows}=geometry.terrain,result:number[]=[],seen=new Set(existing);
  const failed=paths.visited.filter(cell=>paths.distance[cell]!>limitPx*1000)
    .sort((a,b)=>paths.distance[b]!-paths.distance[a]!||a-b);
  const offsets=[[0,0],...directions] as const;
  for(const failedCell of failed){
    const path:number[]=[];let cell=failedCell;
    for(let steps=0;cell>=0&&steps<geometry.reachable.length;steps++){path.push(cell);cell=paths.parent[cell]!;}
    const advance=paths.distance[failedCell]!/1000-limitPx+8;
    path.sort((a,b)=>Math.abs(paths.distance[a]!/1000-advance)-Math.abs(paths.distance[b]!/1000-advance)||a-b);
    for(const center of path)for(const [dx,dy] of offsets){
      const x=center%cols+dx,y=Math.floor(center/cols)+dy,q=y*cols+x;
      if(x<0||y<0||x>=cols||y>=rows||!geometry.reachable[q]||seen.has(q))continue;
      seen.add(q);result.push(q);if(result.length===maxQ)return result;
    }
  }
  return result;
}

/** The coarse result is produced by the unchanged r12 evaluator. Passing
 * coarse results are returned verbatim. Missing-hole witness failures remain
 * failures; this narrowly certifies the body-to-proved-q coverage condition. */
export function certifyNativeAutoVisibility(geometry:NativeSpatialGeometry,structures:readonly NativeSpatialStructure[],
  policy:NativeSpatialPolicy,coarse:NativeSpatialGateResult,checkpoint:()=>void=()=>{},
  budget:NativeAutoVisibilityBudget=DEFAULT_BUDGET):NativeSpatialGateResult {
  if(coarse.accepted||!coarse.reasons.includes('body-route-to-cover-exceeds-limit'))return coarse;
  for(const key of Object.keys(DEFAULT_BUDGET) as (keyof NativeAutoVisibilityBudget)[])
    if(!Number.isInteger(budget[key])||budget[key]<1||budget[key]>DEFAULT_BUDGET[key])throw new Error('Invalid automatic visibility certificate budget');
  const cells=coarse.metrics.qCells;
  if(!Array.isArray(cells)||!cells.length)return coarse;
  if(cells.some(cell=>!Number.isInteger(cell)||cell<0||cell>=geometry.reachable.length||!geometry.reachable[cell]))
    throw new Error('Invalid coarse visibility witness cells');
  const qUnion=new Set<number>(cells as number[]),witnesses:Witness[]=[];
  const work={qAttempts:0,losChecks:0,pathQueries:0,coverageRecomputes:1};
  checkpoint();
  let coveragePaths=nativeSpatialShortestPaths(geometry,[...qUnion]);
  const coarseCoverage=measureCoverage(geometry,coveragePaths,policy.maxCoverRoutePx);
  let coverage=coarseCoverage;
  const attemptedQ=new Set(qUnion);
  let queries=localQueries(geometry,coveragePaths,attemptedQ,policy.maxCoverRoutePx,budget.maxQ),nextQuery=0;
  const {cols,rows}=geometry.terrain;
  const holes=structures.filter(item=>item.kind==='hole').sort((a,b)=>a.id.localeCompare(b.id)).map(hole=>{
    const removed=new Set(hole.cells);
    const ablated:OccluderGrid={...geometry.sight,isOpaque:(x,y)=>
      x<0||y<0||x>=cols||y>=rows||(!removed.has(y*cols+x)&&geometry.sight.isOpaque(x,y))};
    return{hole,ablated};
  });
  const los=(grid:OccluderGrid,a:ReturnType<typeof nativeCellPoint>,b:ReturnType<typeof nativeCellPoint>):boolean=>{
    if(work.losChecks>=budget.maxLosChecks)throw new CertificateBudgetStop('los-budget');
    if(work.losChecks%256===0)checkpoint();
    work.losChecks++;return hasLineOfSight(grid,a,b);
  };
  const prove=(q:number):Witness|undefined=>{
    const qp=nativeCellPoint(q,cols);let paths:Paths|undefined;
    for(const {hole,ablated} of holes){
      if(hole.distance(qp)>policy.referenceSightPx)continue;
      const targets:number[]=[];
      // Same eight reference directions, now at genuine 8px body centres.
      for(const [dx,dy] of directions)for(let radius=1;Math.hypot(dx*radius,dy*radius)*8<=policy.referenceSightPx;radius++){
        const x=q%cols+dx*radius,y=Math.floor(q/cols)+dy*radius,t=y*cols+x;
        if(x<0||y<0||x>=cols||y>=rows)break;
        if(!geometry.reachable[t])continue;
        const tp=nativeCellPoint(t,cols);
        if(!los(geometry.sight,qp,tp)&&los(ablated,qp,tp))targets.push(t);
      }
      if(!targets.length)continue;
      if(!paths){
        if(work.pathQueries>=budget.maxPathQueries)throw new CertificateBudgetStop('path-budget');
        checkpoint();work.pathQueries++;paths=nativeSpatialShortestPaths(geometry,[q],policy.revealRouteMaxPx);
      }
      const reveals=paths.visited.filter(v=>paths!.distance[v]!>=policy.revealRouteMinPx*1000);
      for(const t of targets){
        const tp=nativeCellPoint(t,cols);
        for(const v of reveals){
          const vp=nativeCellPoint(v,cols),sightPx=Math.hypot(vp.x-tp.x,vp.y-tp.y);
          if(sightPx<=policy.referenceSightPx&&los(geometry.sight,vp,tp))
            return{holeId:hole.id,q,v,t,routePx:paths.distance[v]!/1000,sightPx,querySightPx:Math.hypot(qp.x-tp.x,qp.y-tp.y)};
        }
      }
    }
    return undefined;
  };
  let reason:StopReason='local-domain-exhausted';
  try{
    while(nextQuery<queries.length&&coverage.overLimit){
      if(work.qAttempts>=budget.maxQ)throw new CertificateBudgetStop('q-budget');
      if(work.coverageRecomputes>=budget.maxCoverageRecomputes)throw new CertificateBudgetStop('coverage-budget');
      const q=queries[nextQuery++]!;
      checkpoint();work.qAttempts++;attemptedQ.add(q);
      const witness=prove(q);if(!witness)continue;
      witnesses.push(witness);qUnion.add(q);
      checkpoint();work.coverageRecomputes++;
      coveragePaths=nativeSpatialShortestPaths(geometry,[...qUnion]);
      coverage=measureCoverage(geometry,coveragePaths,policy.maxCoverRoutePx);
      if(coverage.overLimit){
        if(work.qAttempts>=budget.maxQ)throw new CertificateBudgetStop('q-budget');
        // Spend the remaining fixed work on the current uncovered domain.
        // Earlier failed q are also excluded: the geometry has not changed.
        queries=localQueries(geometry,coveragePaths,attemptedQ,policy.maxCoverRoutePx,budget.maxQ-work.qAttempts);
        nextQuery=0;
      }
    }
    if(!coverage.overLimit)reason='all-body-centers-covered';
    else if(work.qAttempts>=budget.maxQ)reason='q-budget';
  }catch(error){
    if(!(error instanceof CertificateBudgetStop))throw error;
    reason=error.reason;
  }
  const certified=coverage.overLimit===0;
  const reasons=certified?coarse.reasons.filter(item=>item!=='body-route-to-cover-exceeds-limit'):coarse.reasons;
  return{accepted:reasons.length===0,reasons,metrics:{...coarse.metrics,qCells:[...qUnion].sort((a,b)=>a-b),coverage,
    visibilityCertificate:{algorithm:'native-auto-local-visibility-v1',status:certified?'certified':'unresolved',reason,
      additionalProbeStepPx:8,coarseCoverage,coverage,witnesses,work:{...work,...budget},
      scope:'Additional real q/v/t witnesses on unchanged geometry; every reachable 20px body centre is rechecked by exact body-graph distance. Other coarse gate failures are preserved.'}}};
}

/** A small, bounded tail is quality variance, not a missing shelter route.
 * Counts cover every reachable body centre and distances lead to proved q.
 * Preserve missing witnesses, unreachable cells and every unrelated failure. */
export function admitNativeAutoVisibility(measured:NativeSpatialGateResult,
  policy:Readonly<{coverTailPercent?:number;maxCoverTailPx?:number}>):NativeSpatialGateResult {
  if(policy.coverTailPercent===undefined||policy.maxCoverTailPx===undefined)return measured;
  const c=measured.metrics.coverage as Coverage|undefined;
  if(!c||!Number.isInteger(c.checkedBodyCenters)||c.checkedBodyCenters<=0||!Number.isInteger(c.overLimit)
    ||c.overLimit<0||c.overLimit>c.checkedBodyCenters||c.unreachable!==0||c.maxRoutePx===null||!Number.isFinite(c.maxRoutePx))return measured;
  const withinTail=c.overLimit*100<=c.checkedBodyCenters*policy.coverTailPercent&&c.maxRoutePx<=policy.maxCoverTailPx;
  const reasons=withinTail?measured.reasons.filter(reason=>reason!=='body-route-to-cover-exceeds-limit'):measured.reasons;
  return {...measured,accepted:reasons.length===0,reasons,metrics:{...measured.metrics,
    exposureAdmission:{tailPercent:c.overLimit/c.checkedBodyCenters*100,allowedTailPercent:policy.coverTailPercent,
      maxTailPx:policy.maxCoverTailPx,withinTail,qualityWarnings:withinTail&&c.overLimit?['small-cover-route-tail']:[]}}};
}
