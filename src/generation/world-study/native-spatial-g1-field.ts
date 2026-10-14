/** Fine coverage probes only. Never placement sites, deep connectivity,
 * wide-area denominators, or the secondary mean score. */
import type {Vector2} from '@/types/game-types';
import {nativeVoidCellBoundary,nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialActualVoidFeedback,type NativeSpatialPrimitive,type NativeSpatialBvh} from './native-spatial-geometry';

export type NativeSpatialG1VoidContains=(x:number,y:number)=>boolean;
export interface NativeSpatialG1HoleShape {
  readonly boundary:readonly NativeSpatialPrimitive[];
  /** Local coordinates, translated with this hole rather than fixed in world. */
  readonly contains:NativeSpatialG1VoidContains;
}
/** Segments alone have positive distances inside a hole. Empty-space radius
 * must instead be zero anywhere occupied by the current filled VOID shape. */
export function nativeSpatialG1FilledDistance(tree:NativeSpatialBvh,contains:NativeSpatialG1VoidContains|undefined,x:number,y:number):number {
  return contains?.(x,y)?0:nativePrimitiveDistance(tree,x,y);
}
/** Fixed exterior/B only; old internal H cells must never enter this mask.
 * Explicit frame clipping also covers a full-frame land fixture. */
export function nativeSpatialG1ExteriorRadius(feedback:NativeSpatialActualVoidFeedback):(point:Readonly<Vector2>)=>number {
  const {cols,rows,exteriorMask}=feedback,count=cols*rows;
  if(!Number.isSafeInteger(cols)||!Number.isSafeInteger(rows)||cols<=0||rows<=0||exteriorMask.length!==count)throw new Error('G1 actual exterior dimensions mismatch');
  const cells:number[]=[];
  for(let cell=0;cell<count;cell++){if(exteriorMask[cell]!==0&&exteriorMask[cell]!==1)throw new Error('G1 actual exterior mask is not binary');if(exteriorMask[cell])cells.push(cell);}
  const tree=nativePrimitiveTree(nativeVoidCellBoundary(cells,cols,rows,-1)),width=cols*8,height=rows*8;
  return point=>{
    if(point.x<0||point.y<0||point.x>=width||point.y>=height||exteriorMask[Math.floor(point.y/8)*cols+Math.floor(point.x/8)])return 0;
    return Math.min(point.x,point.y,width-point.x,height-point.y,nativePrimitiveDistance(tree,point.x,point.y));
  };
}

export interface NativeSpatialG1FieldTrace {
  readonly gridPointCount:number;
  readonly assessmentPointsAdded:number;
  readonly assessmentPointsOutsideRawSupport:number;
  readonly maximumEvaluations:number;
  readonly maximumDistanceQueries:number;
  readonly cachedDistanceQueries:number;
  readonly lastEvaluatedMaximumPx:number|null;
}

export class NativeSpatialG1Field {
  readonly points:readonly Readonly<Vector2>[];
  private readonly gridPointCount:number;
  private readonly assessmentPointsAdded:number;
  private readonly assessmentPointsOutsideRawSupport:number;
  private maximumEvaluations=0;
  private maximumDistanceQueries=0;
  private cachedDistanceQueries=0;
  private lastEvaluatedMaximumPx:number|null=null;
  private readonly exteriorRadii:Float64Array;

  constructor(width:number,height:number,margin:(point:Readonly<Vector2>)=>number,assessmentPoints:readonly Readonly<Vector2>[],private readonly checkpoint:()=>void=()=>{},private readonly exteriorDistance?:(point:Readonly<Vector2>)=>number){
    const points:Readonly<Vector2>[]=[],keys=new Set<string>();let checked=0;
    for(let y=4;y<height;y+=8)for(let x=4;x<width;x+=8){
      if(checked++%1024===0)this.checkpoint();
      const point={x,y};if(margin(point)<12)continue;
      points.push(point);keys.add(`${x}:${y}`);
    }
    this.gridPointCount=points.length;let added=0,outside=0;
    for(const point of assessmentPoints){
      const key=`${point.x}:${point.y}`;if(keys.has(key))continue;
      // Actual final-shape witnesses survive the raw support filter.
      points.push({...point});keys.add(key);added++;
      if(margin(point)<12)outside++;
    }
    this.points=points;this.assessmentPointsAdded=added;this.assessmentPointsOutsideRawSupport=outside;
    this.exteriorRadii=new Float64Array(points.length);
    for(let i=0;i<points.length;i++){if(i%1024===0)this.checkpoint();this.exteriorRadii[i]=this.exteriorRadius(points[i]!);}
  }

  /** Runtime prediction, not a replacement for final supported-body gating. */
  exteriorRadius(point:Readonly<Vector2>):number {
    if(!this.exteriorDistance)return Infinity;
    const radius=this.exteriorDistance(point);if(Number.isNaN(radius))throw new Error('G1 exterior radius is NaN');
    return Math.max(0,radius);
  }

  /** Cache all other objects once per single-object scan. */
  distances(distance:(point:Readonly<Vector2>,index:number)=>number):Float64Array {
    const values=new Float64Array(this.points.length);
    for(let i=0;i<this.points.length;i++){
      if(i%1024===0)this.checkpoint();
      values[i]=Math.min(this.exteriorRadii[i]!,distance(this.points[i]!,i));this.cachedDistanceQueries++;
    }
    return values;
  }

  /** Sort the unchanged-object upper bounds once for a complete site scan. */
  descendingIndices(remaining:Float64Array):Uint32Array {
    if(remaining.length!==this.points.length)throw new Error('G1 remaining field length mismatch');
    this.checkpoint();let comparisons=0;
    return Uint32Array.from(remaining,(_,index)=>index).sort((a,b)=>{
      if(comparisons++%1024===0)this.checkpoint();
      // Infinity ties retain the original index order as well.
      return remaining[b]!-remaining[a]!||a-b;
    });
  }

  /** Exact max(min(remaining, moved)): every unvisited term is bounded by
   * its descending remaining distance. No gate threshold enters this bound. */
  maximumWithRemaining(remaining:Float64Array,descending:Uint32Array,movedDistance:(point:Readonly<Vector2>,index:number)=>number):number {
    if(remaining.length!==this.points.length||descending.length!==this.points.length)throw new Error('G1 remaining field length mismatch');
    let maximum=0;this.maximumEvaluations++;
    for(let order=0;order<descending.length;order++){
      if(order%1024===0)this.checkpoint();
      const index=descending[order]!,upper=remaining[index]!;
      if(upper<=maximum)break;
      maximum=Math.max(maximum,Math.min(upper,this.exteriorRadii[index]!,movedDistance(this.points[index]!,index)));this.maximumDistanceQueries++;
    }
    this.lastEvaluatedMaximumPx=maximum;return maximum;
  }

  maximum(distance:(point:Readonly<Vector2>,index:number)=>number):number {
    let maximum=0;this.maximumEvaluations++;
    for(let i=0;i<this.points.length;i++){
      if(i%1024===0)this.checkpoint();
      maximum=Math.max(maximum,Math.min(this.exteriorRadii[i]!,distance(this.points[i]!,i)));this.maximumDistanceQueries++;
    }
    this.lastEvaluatedMaximumPx=maximum;return maximum;
  }

  trace():NativeSpatialG1FieldTrace {
    return{gridPointCount:this.gridPointCount,assessmentPointsAdded:this.assessmentPointsAdded,
      assessmentPointsOutsideRawSupport:this.assessmentPointsOutsideRawSupport,maximumEvaluations:this.maximumEvaluations,
      maximumDistanceQueries:this.maximumDistanceQueries,cachedDistanceQueries:this.cachedDistanceQueries,lastEvaluatedMaximumPx:this.lastEvaluatedMaximumPx};
  }
}

/** Original positions match the measured cell boundaries exactly. Translation
 * predicts a new placement; v1 free-edge regeneration is not translation invariant. */
export function nativeSpatialG1HoleShapes(feedback:NativeSpatialActualVoidFeedback,placements:readonly Readonly<{holeId:string;site:Readonly<Vector2>}>[]):ReadonlyMap<string,NativeSpatialG1HoleShape> {
  const {cols,rows,exteriorMask,holes}=feedback,count=cols*rows;
  if(!Number.isSafeInteger(cols)||!Number.isSafeInteger(rows)||cols<=0||rows<=0||exteriorMask.length!==count)throw new Error('G1 actual VOID dimensions mismatch');
  const ids=new Set(placements.map(p=>p.holeId));
  if(ids.size!==placements.length||holes.length!==placements.length||new Set(holes.map(h=>h.holeId)).size!==holes.length||holes.some(h=>!ids.has(h.holeId)))throw new Error('G1 actual VOID hole identity mismatch');
  const claimed=new Set<number>(),result=new Map<string,NativeSpatialG1HoleShape>();
  placements.forEach((placement,index)=>{
    if(!Number.isFinite(placement.site.x)||!Number.isFinite(placement.site.y)||!Number.isInteger(placement.site.x/8)||!Number.isInteger(placement.site.y/8))throw new Error('G1 actual VOID placement is off grid');
    const hole=holes.find(h=>h.holeId===placement.holeId)!;
    if(!hole.cells.length)throw new Error('G1 actual VOID hole has no cells');
    for(const cell of hole.cells){
      if(!Number.isSafeInteger(cell)||cell<0||cell>=count||claimed.has(cell)||exteriorMask[cell])throw new Error('G1 actual VOID cell identity mismatch');
      claimed.add(cell);
    }
    const members=new Set(hole.cells),originCol=placement.site.x/8,originRow=placement.site.y/8;
    result.set(placement.holeId,{
      boundary:nativeVoidCellBoundary(hole.cells,cols,rows,index).map(p=>nativePrimitive(p.points.map((v,i)=>v-(i%2?placement.site.y:placement.site.x)),p.objectId)),
      contains:(x,y)=>{const col=Math.floor(x/8)+originCol,row=Math.floor(y/8)+originRow;return col>=0&&row>=0&&col<cols&&row<rows&&members.has(row*cols+col);},
    });
  });return result;
}
/** Boundary-only compatibility for diagnostic consumers. Production max uses
 * the filled shape above; boundary data still preserves its original order. */
export function nativeSpatialG1HoleFootprints(feedback:NativeSpatialActualVoidFeedback,placements:readonly Readonly<{holeId:string;site:Readonly<Vector2>}>[]):ReadonlyMap<string,readonly NativeSpatialPrimitive[]> {
  return new Map([...nativeSpatialG1HoleShapes(feedback,placements)].map(([id,shape])=>[id,shape.boundary]));
}
