/** Revision-12 G2. VOID-only LOS witnesses never modify the body graph. */
import {hasLineOfSight} from '@/utils/grid-raycast';
import type {OccluderGrid} from '@/types/map-types';
import {NATIVE_SPATIAL_DIRECTIONS as directions,NATIVE_SPATIAL_EDGE_COSTS as costs,nativeCellPoint,type NativeSpatialGeometry} from './native-spatial-geometry';
import type {NativeSpatialStructure} from './native-spatial-structures';
import type {NativeSpatialGateResult,NativeSpatialPolicy} from './native-spatial-types';

/** Integer costs and (cost,y,x) heap order are part of native-spatial-v1. */
export function nativeSpatialShortestPaths(geometry:NativeSpatialGeometry,starts:readonly number[],limitPx=Infinity):{distance:Float64Array;parent:Int32Array;visited:readonly number[]} {
  const count=geometry.reachable.length,cols=geometry.terrain.cols,distance=new Float64Array(count),parent=new Int32Array(count);
  distance.fill(Infinity);parent.fill(-1);
  const heap:{cell:number;cost:number}[]=[],visited:number[]=[];
  const before=(a:{cell:number;cost:number},b:{cell:number;cost:number}):boolean=>a.cost<b.cost||(a.cost===b.cost&&a.cell<b.cell);
  function push(cell:number,cost:number):void {const value={cell,cost};let at=heap.length;heap.push(value);while(at>0){const up=(at-1)>>1;if(!before(value,heap[up]!))break;heap[at]=heap[up]!;at=up;}heap[at]=value;}
  function pop():{cell:number;cost:number} {const first=heap[0]!,last=heap.pop()!;if(heap.length){let at=0;while(at*2+1<heap.length){let next=at*2+1;if(next+1<heap.length&&before(heap[next+1]!,heap[next]!))next++;if(!before(heap[next]!,last))break;heap[at]=heap[next]!;at=next;}heap[at]=last;}return first;}
  for(const cell of [...new Set(starts)].sort((a,b)=>a-b))if(geometry.reachable[cell]){distance[cell]=0;push(cell,0);}
  while(heap.length){const item=pop(),cell=item.cell;if(item.cost!==distance[cell])continue;visited.push(cell);
    for(let direction=0;direction<8;direction++)if(geometry.links8[cell]!&(1<<direction)){
      const [dx,dy]=directions[direction]!,next=cell+dx+dy*cols,cost=item.cost+costs[direction]!;
      if(!geometry.reachable[next]||cost>limitPx*1000)continue;
      if(cost<distance[next]!){distance[next]=cost;parent[next]=cell;push(next,cost);}
      else if(cost===distance[next]&&(parent[next]===-1||cell<parent[next]!))parent[next]=cell;
    }
  }
  return{distance,parent,visited};
}
interface Witness {readonly q:number;readonly v:number;readonly t:number;readonly routePx:number;readonly sightPx:number}
export function evaluateNativeSpatialVisibility(geometry:NativeSpatialGeometry,structures:readonly NativeSpatialStructure[],policy:NativeSpatialPolicy):NativeSpatialGateResult {
  const {cols,rows}=geometry.terrain,stride=policy.probeStepPx/8;
  if(!Number.isInteger(stride)||stride<1)throw new Error('Native spatial probe step must align with support cells');
  const probes:number[]=[];
  for(let row=0;row<rows;row+=stride)for(let col=0;col<cols;col+=stride){const cell=row*cols+col;if(geometry.reachable[cell])probes.push(cell);}
  const qUnion=new Set<number>(),holeReports:Record<string,unknown>[]=[],reasons:string[]=[];
  // Both q and v must be within the same reference sight range of t.
  const maxQT=policy.referenceSightPx;
  for(const hole of structures.filter(item=>item.kind==='hole').sort((a,b)=>a.id.localeCompare(b.id))){
    const removed=new Set(hole.cells),ablated:OccluderGrid={...geometry.sight,isOpaque:(col,row)=>col<0||row<0||col>=cols||row>=rows||(!removed.has(row*cols+col)&&geometry.sight.isOpaque(col,row))};
    const witnesses:Witness[]=[],failureCounts={outsideWitnessBound:0,noAttributedTarget:0,noReachableReveal:0};let testedQ=0;
    for(const q of probes){const qp=nativeCellPoint(q,cols);if(hole.distance(qp)>maxQT){failureCounts.outsideWitnessBound++;continue;}testedQ++;
      const targets:number[]=[];
      // Stable direction then radius order. These are reference points, never spawned enemies.
      for(const [dx,dy] of directions)for(let radius=stride;Math.hypot(dx*radius,dy*radius)*8<=maxQT;radius+=stride){
        const col=q%cols+dx*radius,row=Math.floor(q/cols)+dy*radius,t=row*cols+col;
        if(col<0||row<0||col>=cols||row>=rows||!geometry.reachable[t])continue;
        const tp=nativeCellPoint(t,cols);
        if(!hasLineOfSight(geometry.sight,qp,tp)&&hasLineOfSight(ablated,qp,tp))targets.push(t);
      }
      if(!targets.length){failureCounts.noAttributedTarget++;continue;}
      const paths=nativeSpatialShortestPaths(geometry,[q],policy.revealRouteMaxPx);
      const reveals=paths.visited.filter(v=>paths.distance[v]!>=policy.revealRouteMinPx*1000&&v%cols%stride===0&&Math.floor(v/cols)%stride===0);
      let witness:Witness|undefined;
      for(const t of targets){const tp=nativeCellPoint(t,cols);for(const v of reveals){const vp=nativeCellPoint(v,cols),length=Math.hypot(vp.x-tp.x,vp.y-tp.y);
        if(length<=policy.referenceSightPx&&hasLineOfSight(geometry.sight,vp,tp)){witness={q,v,t,routePx:paths.distance[v]!/1000,sightPx:length};break;}
      }if(witness)break;}
      if(witness){witnesses.push(witness);qUnion.add(q);}else failureCounts.noReachableReveal++;
    }
    if(!witnesses.length)reasons.push(`hole:${hole.id}:no-witness-in-frozen-probes`);
    holeReports.push({id:hole.id,testedQ,witnesses,failureCounts});
  }
  const qCells=[...qUnion].sort((a,b)=>a-b),coverage=nativeSpatialShortestPaths(geometry,qCells);let maxPx=0,overLimit=0,unreachable=0,worstCell=-1;
  for(let cell=0;cell<geometry.reachable.length;cell++)if(geometry.reachable[cell]){const d=coverage.distance[cell]!/1000;if(!Number.isFinite(d))unreachable++;if(d>maxPx){maxPx=d;worstCell=cell;}if(d>policy.maxCoverRoutePx)overLimit++;}
  if(!qCells.length)reasons.push('no-attributed-cover-positions');
  if(overLimit)reasons.push('body-route-to-cover-exceeds-limit');
  return{accepted:reasons.length===0,reasons,metrics:{algorithm:'native-spatial-v1',probeStepPx:policy.probeStepPx,probeOriginPx:[4,4],targetEnumeration:'E,S,W,N,SE,SW,NW,NE; increasing 32px grid offsets; |qt| <= referenceSightPx',revealOrder:'shortest integer route then y,x',qProbeCount:probes.length,qCells,holes:holeReports,coverage:{maxRoutePx:Number.isFinite(maxPx)?maxPx:null,worstCell,overLimit,unreachable,checkedBodyCenters:geometry.reachableCount},scope:'All passing q in the frozen sampling domain; v/t do not contribute coverage. No-witness is a sampling failure, not proof that continuous space has no cover.'}};
}
