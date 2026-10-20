/** Bounded continuous coverage certificate for r14, using actual native
 * footprint distances. No terrain, placement or acceptance limit is changed. */
import {nativeCellPoint,type NativeSpatialGeometry} from './native-spatial-geometry';

interface Point {readonly x:number;readonly y:number}
export interface NativeAutoEmptyRadiusBudget {readonly maxDepth:number;readonly maxPoints:number}
export interface NativeAutoEmptyRadiusCertificate {
  readonly accepted:boolean;
  readonly status:'certified'|'violated'|'unresolved';
  readonly reason:'all-leaves-bounded'|'supported-counterexample'|'depth-budget'|'point-budget'|'invalid-distance';
  readonly limitPx:number;
  readonly certifiedUpperPx:number|null;
  readonly witness:Readonly<Point&{distancePx:number}>|null;
  readonly work:Readonly<{supportedCells:number;coarseCellsChecked:number;refinedCells:number;pointEvaluations:number;certifiedLeaves:number;maxDepthReached:number;maxDepth:number;maxPoints:number}>;
}
type Domain=Pick<NativeSpatialGeometry,'terrain'|'supported'|'collision'|'solidDistance'|'voidDistance'>;
const CELL_HALF=4,BODY_HALF=10,ROUNDING_ALLOWANCE=1e-7;
const DEFAULT_BUDGET:NativeAutoEmptyRadiusBudget={maxDepth:8,maxPoints:65536};
interface Box extends Point {readonly half:number;readonly depth:number}

/** d=min(distance to actual solid, distance to actual VOID) is 1-Lipschitz.
 * Every box is bounded by d(center)+halfDiagonal. We certify the entire box,
 * which is stronger than certifying just its legal body centers.
 *
 * Supported-cell coverage is complete for this limit: any legal point with
 * d > limit has its grid center within 4√2. When limit > (10+4)√2,
 * that center has clearance >10√2, lies on the same matter component and
 * supports the whole 20px square. Thus an unsampled cell cannot hide a
 * violating legal point. All actual counterexamples still query supports(). */
export function certifyNativeAutoEmptyRadius(geometry:Domain,limitPx:number,checkpoint:()=>void=()=>{},
  budget:NativeAutoEmptyRadiusBudget=DEFAULT_BUDGET):NativeAutoEmptyRadiusCertificate {
  if(!Number.isFinite(limitPx)||limitPx<=(BODY_HALF+CELL_HALF)*Math.SQRT2
    ||!Number.isInteger(budget.maxDepth)||budget.maxDepth<0||budget.maxDepth>8
    ||!Number.isInteger(budget.maxPoints)||budget.maxPoints<1||budget.maxPoints>65536)
    throw new Error('Invalid automatic empty-radius certificate bounds');
  const pending:Box[]=[];
  let supportedCells=0,coarseCellsChecked=0,refinedCells=0,pointEvaluations=0,certifiedLeaves=0,maxDepthReached=0;
  let certifiedUpperPx=(BODY_HALF+CELL_HALF)*Math.SQRT2;
  for(const supported of geometry.supported)supportedCells+=Number(supported!==0);
  const finish=(status:NativeAutoEmptyRadiusCertificate['status'],reason:NativeAutoEmptyRadiusCertificate['reason'],
    witness:NativeAutoEmptyRadiusCertificate['witness']=null):NativeAutoEmptyRadiusCertificate=>({
    accepted:status==='certified',status,reason,limitPx,certifiedUpperPx:status==='certified'?certifiedUpperPx:null,witness,
    work:{supportedCells,coarseCellsChecked,refinedCells,pointEvaluations,certifiedLeaves,maxDepthReached,...budget}});
  const inspect=(box:Box):NativeAutoEmptyRadiusCertificate|undefined=>{
    if(pointEvaluations>=budget.maxPoints)return finish('unresolved','point-budget');
    if(pointEvaluations%256===0)checkpoint();
    pointEvaluations++;if(box.depth===0)coarseCellsChecked++;
    maxDepthReached=Math.max(maxDepthReached,box.depth);
    const distance=Math.min(geometry.solidDistance(box),geometry.voidDistance(box));
    if(!Number.isFinite(distance)||distance<0)return finish('unresolved','invalid-distance');
    if(distance>limitPx&&geometry.collision.supports(box,BODY_HALF,BODY_HALF))
      return finish('violated','supported-counterexample',{x:box.x,y:box.y,distancePx:distance});
    const upper=distance+box.half*Math.SQRT2+ROUNDING_ALLOWANCE;
    if(upper<=limitPx){certifiedUpperPx=Math.max(certifiedUpperPx,upper);certifiedLeaves++;}
    else pending.push(box);
    return undefined;
  };
  for(let cell=0;cell<geometry.supported.length;cell++)if(geometry.supported[cell]){
    const result=inspect({...nativeCellPoint(cell,geometry.terrain.cols),half:CELL_HALF,depth:0});
    if(result)return result;
  }
  while(pending.length){
    const box=pending.pop()!;
    if(box.depth>=budget.maxDepth)return finish('unresolved','depth-budget');
    refinedCells++;const half=box.half/2;
    for(const dy of [-half,half])for(const dx of [-half,half]){
      const result=inspect({x:box.x+dx,y:box.y+dy,half,depth:box.depth+1});
      if(result)return result;
    }
  }
  return finish('certified','all-leaves-bounded');
}
