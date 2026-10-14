/** Proposal cache on the actual 8px VOID domain. A translated damaged contour
 * is a local estimate; every complete proposal is still compiled and gated. */
import type {Vector2} from '@/types/game-types';
import {NATIVE_SPATIAL_CELL,NATIVE_SPATIAL_BODY_HALF,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialActualVoidFeedback,type NativeSpatialPrimitive} from './native-spatial-geometry';

export interface NativeSpatialWideObject {
  readonly holeId?:string;
  readonly site:Readonly<Vector2>;
  readonly blocking:readonly NativeSpatialPrimitive[];
}
export interface NativeSpatialWidePlacement {readonly index:number;readonly site:Readonly<Vector2>}
interface NativeSpatialWideTrial extends NativeSpatialWidePlacement {readonly previous:Readonly<Vector2>}
export interface NativeSpatialWideMeasurement {readonly wideCount:number;readonly largestWideRatio:number}
export interface NativeSpatialConstraintScore {readonly maximum:number;readonly sum:number;readonly mean:number}
/** Normalized gate deficits precede the secondary exposure objective. */
export function nativeSpatialConstraintScore(violations:readonly number[],mean:number):NativeSpatialConstraintScore {
  return{maximum:Math.max(0,...violations),sum:violations.reduce((sum,value)=>sum+value,0),mean};
}
export function compareNativeSpatialConstraintScores(a:NativeSpatialConstraintScore,b:NativeSpatialConstraintScore):number {
  for(const key of ['maximum','sum','mean'] as const){if(a[key]<b[key])return-1;if(a[key]>b[key])return 1;}return 0;
}

export class NativeSpatialWideDomain {
  private readonly cols:number;
  private readonly rows:number;
  private readonly coast:Uint8Array;
  private readonly occupancy:Uint16Array;
  private readonly wide:Uint8Array;
  private readonly seen:Uint32Array;
  private readonly queue:Int32Array;
  private readonly masks:readonly Int32Array[];
  private readonly sites:{x:number;y:number}[];
  private version=0;

  constructor(feedback:NativeSpatialActualVoidFeedback,objects:readonly NativeSpatialWideObject[],radius:number){
    const step=NATIVE_SPATIAL_CELL;
    // This makes 8-neighbour links between wide centres safe for the real body
    // without rebuilding all movement links for every trial placement.
    if(!Number.isFinite(radius)||radius<Math.SQRT2*(NATIVE_SPATIAL_BODY_HALF+step))throw new Error('Wide-domain radius cannot prove safe body links');
    this.cols=feedback.cols;this.rows=feedback.rows;const count=this.cols*this.rows;
    if(feedback.exteriorMask.length!==count)throw new Error('Actual VOID feedback has inconsistent dimensions');
    this.coast=feedback.exteriorMask.slice();this.occupancy=new Uint16Array(count);this.wide=new Uint8Array(count);this.seen=new Uint32Array(count);this.queue=new Int32Array(count);
    const offsets:{x:number;y:number}[]=[],reach=Math.ceil(radius/step)+1;
    for(let y=-reach;y<=reach;y++)for(let x=-reach;x<=reach;x++)if(Math.hypot(Math.max(0,Math.abs(x)*step-step/2),Math.max(0,Math.abs(y)*step-step/2))<radius)offsets.push({x,y});
    const expand=(cells:readonly number[]):Set<number>=>{
      const set=new Set(cells),result=new Set(cells);
      for(const cell of cells){const x=cell%this.cols,y=Math.floor(cell/this.cols);
        if(x>0&&x<this.cols-1&&y>0&&y<this.rows-1&&set.has(cell-1)&&set.has(cell+1)&&set.has(cell-this.cols)&&set.has(cell+this.cols))continue;
        for(const d of offsets){const xx=x+d.x,yy=y+d.y;if(xx>=0&&yy>=0&&xx<this.cols&&yy<this.rows)result.add(yy*this.cols+xx);}
      }return result;
    };
    const exterior:number[]=[];for(let cell=0;cell<count;cell++)if(feedback.exteriorMask[cell])exterior.push(cell);
    for(const cell of expand(exterior))this.coast[cell]=1;
    // Out-of-frame space is also VOID, even for a full-frame test fixture.
    for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)if(Math.min((x+.5)*step,(y+.5)*step,(this.cols-x-.5)*step,(this.rows-y-.5)*step)<radius)this.coast[y*this.cols+x]=1;
    this.sites=objects.map(o=>({x:o.site.x,y:o.site.y}));
    this.masks=objects.map(object=>{
      if(!Number.isInteger(object.site.x/step)||!Number.isInteger(object.site.y/step))throw new Error('Wide-domain translation must preserve the real grid phase');
      const local:number[]=[];
      if(object.holeId){
        const hole=feedback.holes.find(h=>h.holeId===object.holeId);if(!hole)throw new Error(`Actual VOID feedback is missing ${object.holeId}`);
        // Keep the local expansion beyond the old frame as well: translating
        // an edge-near object inward must not expose a clipped mask corner.
        const stride=this.cols+2*reach,expanded=new Set<number>();
        for(const cell of hole.cells){const x=cell%this.cols,y=Math.floor(cell/this.cols);for(const d of offsets)expanded.add((y+d.y+reach)*stride+x+d.x+reach);}
        for(const cell of expanded)local.push(cell%stride-reach-object.site.x/step,Math.floor(cell/stride)-reach-object.site.y/step);
      }else{
        if(!object.blocking.length)throw new Error('Wide-domain solid has no projected footprint');
        const tree=nativePrimitiveTree(object.blocking),minX=Math.floor((Math.min(...object.blocking.map(p=>p.minX))-radius)/step),maxX=Math.ceil((Math.max(...object.blocking.map(p=>p.maxX))+radius)/step),minY=Math.floor((Math.min(...object.blocking.map(p=>p.minY))-radius)/step),maxY=Math.ceil((Math.max(...object.blocking.map(p=>p.maxY))+radius)/step);
        for(let y=minY;y<maxY;y++)for(let x=minX;x<maxX;x++)if(nativePrimitiveDistance(tree,(x+.5)*step,(y+.5)*step)<radius)local.push(x,y);
      }
      return Int32Array.from(local);
    });
    objects.forEach((_,index)=>this.apply(index,this.sites[index]!,1));
  }

  private apply(index:number,site:Readonly<Vector2>,delta:1|-1):void {
    const x=site.x/NATIVE_SPATIAL_CELL,y=site.y/NATIVE_SPATIAL_CELL,mask=this.masks[index]!;
    if(!Number.isInteger(x)||!Number.isInteger(y))throw new Error('Wide-domain trial is off the actual grid phase');
    for(let i=0;i<mask.length;i+=2){const xx=x+mask[i]!,yy=y+mask[i+1]!;if(xx>=0&&yy>=0&&xx<this.cols&&yy<this.rows){const cell=yy*this.cols+xx;this.occupancy[cell]=this.occupancy[cell]!+delta;}}
  }
  private validateTrial(index:number,site:Readonly<Vector2>):void {
    if(!Number.isInteger(index)||index<0||index>=this.sites.length)throw new Error('Unknown wide-domain object');
    if(!Number.isFinite(site.x)||!Number.isFinite(site.y)||!Number.isInteger(site.x/NATIVE_SPATIAL_CELL)||!Number.isInteger(site.y/NATIVE_SPATIAL_CELL))throw new Error('Wide-domain trial is off the actual grid phase');
  }
  /** Snapshot and validate the whole operation before touching any occupancy.
   * Two entries may overlap spatially, but cannot name the same object twice. */
  private prepareTrials(entries:readonly NativeSpatialWidePlacement[]):readonly NativeSpatialWideTrial[] {
    if(entries.length<1||entries.length>2)throw new Error('Wide-domain batch requires one or two objects');
    const indices=new Set<number>();
    return entries.map(entry=>{
      this.validateTrial(entry.index,entry.site);
      if(indices.has(entry.index))throw new Error('Duplicate wide-domain object in one batch');
      indices.add(entry.index);
      return{index:entry.index,site:{x:entry.site.x,y:entry.site.y},previous:this.sites[entry.index]!};
    });
  }
  evaluateMany(entries:readonly NativeSpatialWidePlacement[]):NativeSpatialWideMeasurement {
    const trials=this.prepareTrials(entries);let removed=0,added=0;
    try{
      for(const trial of trials){this.apply(trial.index,trial.previous,-1);removed++;}
      for(const trial of trials){this.apply(trial.index,trial.site,1);added++;}
      return this.measure();
    }finally{
      for(let i=0;i<added;i++){const trial=trials[i]!;this.apply(trial.index,trial.site,-1);}
      for(let i=0;i<removed;i++){const trial=trials[i]!;this.apply(trial.index,trial.previous,1);}
    }
  }
  commitMany(entries:readonly NativeSpatialWidePlacement[]):void {
    const trials=this.prepareTrials(entries);let removed=0,added=0;
    try{
      for(const trial of trials){this.apply(trial.index,trial.previous,-1);removed++;}
      for(const trial of trials){this.apply(trial.index,trial.site,1);added++;}
    }catch(error){
      for(let i=0;i<added;i++){const trial=trials[i]!;this.apply(trial.index,trial.site,-1);}
      for(let i=0;i<removed;i++){const trial=trials[i]!;this.apply(trial.index,trial.previous,1);}
      throw error;
    }
    for(const trial of trials)this.sites[trial.index]={x:trial.site.x,y:trial.site.y};
  }
  evaluate(index:number,site:Readonly<Vector2>):NativeSpatialWideMeasurement {return this.evaluateMany([{index,site}]);}
  commit(index:number,site:Readonly<Vector2>):void {this.commitMany([{index,site}]);}
  /** A copy for deterministic mask comparison; no caller can mutate the cache. */
  wideMask():Uint8Array {this.measure();return this.wide.slice();}
  measure():NativeSpatialWideMeasurement {
    if(++this.version===0xffffffff){this.seen.fill(0);this.version=1;}
    let wideCount=0,largest=0;
    for(let cell=0;cell<this.wide.length;cell++){const wide=Number(!this.coast[cell]&&!this.occupancy[cell]);this.wide[cell]=wide;wideCount+=wide;}
    for(let start=0;start<this.wide.length;start++)if(this.wide[start]&&this.seen[start]!==this.version){
      let head=0,tail=1;this.queue[0]=start;this.seen[start]=this.version;
      while(head<tail){const cell=this.queue[head++]!,x=cell%this.cols,y=Math.floor(cell/this.cols);
        for(let yy=Math.max(0,y-1);yy<=Math.min(this.rows-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(this.cols-1,x+1);xx++){
          const next=yy*this.cols+xx;if(this.wide[next]&&this.seen[next]!==this.version){this.seen[next]=this.version;this.queue[tail++]=next;}
        }
      }largest=Math.max(largest,tail);
    }
    return{wideCount,largestWideRatio:wideCount?largest/wideCount:0};
  }
}
