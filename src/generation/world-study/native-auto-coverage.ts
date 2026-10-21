/** Construction targets are concrete missing spatial functions, never an
 * integral score that can trade one long empty band against another region. */
import {NATIVE_SPATIAL_DIRECTIONS} from './native-spatial-geometry';
import {createNativeAutoRouteField} from './native-auto-route-field';
import type {NativeAutoBodyField} from './native-auto-traversal';
import type {NativeSpatialPolicy} from './native-spatial-types';
import type {NativeAutoCoverageScore} from './native-auto-refinement';
export interface NativeAutoCoverageMeasure {
  readonly score:NativeAutoCoverageScore;
  readonly accepted:boolean;
  readonly holeTarget:number;readonly solidTarget:number;readonly emptyTarget:number;readonly deepTarget:number;
}
export function createNativeAutoCoverage(body:NativeAutoBodyField,policy:NativeSpatialPolicy){
  const points=body.points,count=points.length,cols=Math.max(...points.map(p=>p.gx))+1,rows=Math.max(...points.map(p=>p.gy))+1;
  const lookup=new Int32Array(cols*rows).fill(-1);points.forEach((point,index)=>lookup[point.gy*cols+point.gx]=index);
  const neighbors=new Int32Array(count*8).fill(-1);
  points.forEach((point,index)=>NATIVE_SPATIAL_DIRECTIONS.forEach(([dx,dy],direction)=>{
    const x=point.gx+dx,y=point.gy+dy;if(x>=0&&x<cols&&y>=0&&y<rows)neighbors[index*8+direction]=lookup[y*cols+x]!;
  }));
  const deep=new Uint8Array(count),inner=new Uint8Array(count),wide=new Uint8Array(count),seen=new Uint8Array(count),queue=new Int32Array(count);
  const route=createNativeAutoRouteField(points,8),targetSources=new Float32Array(count).fill(Infinity);
  const components=(mask:Uint8Array,links:Uint8Array)=>{
    seen.fill(0);let maxSpan=0,largest=0,target=-1,total=0;
    for(let start=0;start<count;start++)if(mask[start]&&!seen[start]){
      let head=0,tail=1,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;queue[0]=start;seen[start]=1;
      while(head<tail){const index=queue[head++]!,point=points[index]!;
        minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
        for(let d=0;d<8;d++)if(links[index]!&(1<<d)){const next=neighbors[index*8+d]!;if(next>=0&&mask[next]&&!seen[next]){seen[next]=1;queue[tail++]=next;}}
      }
      total+=tail;largest=Math.max(largest,tail);const span=Math.max(maxX-minX+8,maxY-minY+8);
      if(span>maxSpan){maxSpan=span;let closest=Infinity;
        for(let i=0;i<tail;i++){const index=queue[i]!,point=points[index]!,distance=(point.x-(minX+maxX)/2)**2+(point.y-(minY+maxY)/2)**2;
          if(distance<closest){closest=distance;target=index;}}
      }
    }return{maxSpan,largest,target,total};
  };
  return{
    measure(available:Uint8Array,links:Uint8Array,structure:Float32Array,holes:Float32Array):NativeAutoCoverageMeasure {
      let bodyCount=0,maxEmptyPx=0,maxVoidDistancePx=0,emptyTarget=-1,structureTarget=-1,maxStructure=-1;
      deep.fill(0);inner.fill(0);wide.fill(0);
      for(let i=0;i<count;i++)if(available[i]){
        bodyCount++;const open=Math.min(structure[i]!,points[i]!.margin)+Math.SQRT2*4;
        if(open>maxEmptyPx){maxEmptyPx=open;emptyTarget=i;}
        if(structure[i]!>maxStructure){maxStructure=structure[i]!;structureTarget=i;}
        maxVoidDistancePx=Math.max(maxVoidDistancePx,holes[i]!);
        deep[i]=Number(structure[i]!+Math.SQRT2*4>policy.deepEmptyThresholdPx);
        wide[i]=Number(open-Math.SQRT2*4>=policy.wideRadiusPx);
      }
      for(let i=0;i<count;i++)if(deep[i]){let interior=true;
        for(let d=0;d<8&&interior;d++){const next=neighbors[i*8+d]!;interior=next>=0&&deep[next]===1;}inner[i]=Number(interior);
      }
      const deepGroups=components(inner,links),wideGroups=components(wide,links),approach=route(available,holes,policy.referenceSightPx/2,links);
      let maxApproachRoutePx=0,holeTarget=structureTarget;
      for(let i=0;i<count;i++)if(available[i]&&approach[i]!>maxApproachRoutePx){maxApproachRoutePx=approach[i]!;holeTarget=i;}
      if(!Number.isFinite(maxApproachRoutePx))holeTarget=structureTarget;
      const wideRatio=wideGroups.total/Math.max(1,bodyCount),largestWideRatio=wideGroups.largest/Math.max(1,wideGroups.total);
      const emptyFail=maxEmptyPx>policy.maxEmptyRadiusPx,deepFail=deepGroups.maxSpan>policy.maxDeepEmptySpanPx,coverFail=maxApproachRoutePx>policy.maxCoverRoutePx;
      const solidTarget=emptyFail?emptyTarget:deepGroups.target>=0?deepGroups.target:structureTarget;
      if(!coverFail)holeTarget=solidTarget;
      return{accepted:!emptyFail&&!deepFail&&!coverFail&&wideRatio>=policy.minWideRatio&&largestWideRatio>=policy.minLargestWideRatio,
        holeTarget,solidTarget,emptyTarget,deepTarget:deepGroups.target,score:{penalty:Number(emptyFail)+Number(deepFail)+Number(coverFail)+Number(wideRatio<policy.minWideRatio)+Number(largestWideRatio<policy.minLargestWideRatio),
          qualityPenalty:0,maxEmptyPx,maxDeepSpanPx:deepGroups.maxSpan,maxVoidDistancePx,maxApproachRoutePx,wideRatio,largestWideRatio}};
    },
    distanceFrom(target:number,available:Uint8Array,links:Uint8Array):Float64Array{
      targetSources.fill(Infinity);targetSources[target]=0;return route(available,targetSources,0,links);
    },
    cellAt(x:number,y:number):number{const gx=Math.floor(x/8),gy=Math.floor(y/8);return gx<0||gy<0||gx>=cols||gy>=rows?-1:lookup[gy*cols+gx]!;},
  };
}
