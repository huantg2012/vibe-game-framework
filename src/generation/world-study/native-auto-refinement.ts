/** Finite coordinate descent over the complete, uncompiled L/H/S plan. */
import {nativePrimitiveDistance,type NativeSpatialBvh} from './native-spatial-geometry';
import {createNativeSpatialPlanningGround} from './native-spatial-bay-layout';
import type {NativeSpatialPolicy} from './native-spatial-types';
import type {NativeAutoConstructionPolicy,NativeAutoRect as Rect} from './native-auto-types';
import type {NativeAutoGroundField} from './native-auto-shape';
import {createNativeAutoRouteField} from './native-auto-route-field';

export interface NativeAutoCoverageObject {
  readonly kind:'hole'|'solid';readonly bounds:Rect;readonly rects:readonly Rect[];
  readonly tree?:NativeSpatialBvh;
  readonly coverageRects?:readonly Rect[];
}
interface Point {readonly x:number;readonly y:number}
export interface NativeAutoCoverageScore {
  readonly penalty:number;readonly qualityPenalty:number;readonly maxEmptyPx:number;readonly maxDeepSpanPx:number;
  readonly maxVoidDistancePx:number;readonly wideRatio:number;readonly largestWideRatio:number;
  readonly maxApproachRoutePx:number;
}
export interface NativeAutoRefinementTrace {
  readonly evaluations:number;readonly acceptedMoves:number;readonly acceptedSwaps:number;readonly acceptedJointMoves:number;readonly completedPasses:number;
  readonly before:NativeAutoCoverageScore;readonly after:NativeAutoCoverageScore;
}
/** Quality may break an exact hard-cost tie, never buy a worse hard result.
 * Keep the existing 1e-9 improvement precision at either level. */
export function nativeAutoScoreImproves(candidate:Pick<NativeAutoCoverageScore,'penalty'|'qualityPenalty'>,
  current:Pick<NativeAutoCoverageScore,'penalty'|'qualityPenalty'>):boolean {
  return candidate.penalty<current.penalty-1e-9
    ||candidate.penalty===current.penalty&&candidate.qualityPenalty<current.qualityPenalty-1e-9;
}
const shifted=(r:Rect,p:Point):Rect=>[r[0]+p.x,r[1]+p.y,r[2],r[3]];
const overlaps=(a:Rect,b:Rect,gap:number)=>a[0]<b[0]+b[2]+gap&&a[0]+a[2]>b[0]-gap&&a[1]<b[1]+b[3]+gap&&a[1]+a[3]>b[1]-gap;
const rectangleDistance=(r:Rect,x:number,y:number)=>Math.hypot(Math.max(r[0]-x,0,x-r[0]-r[2]),Math.max(r[1]-y,0,y-r[1]-r[3]));
export function nativeAutoObjectDistance(object:NativeAutoCoverageObject,position:Point,point:Point):number {
  const x=point.x-position.x,y=point.y-position.y;
  if(object.kind==='solid')return nativePrimitiveDistance(object.tree!,x,y);
  let distance=Infinity;
  for(const rect of object.coverageRects??object.rects)distance=Math.min(distance,rectangleDistance(rect,x,y));
  return distance;
}
/** Exact triangle vs 20×20 body SAT, matching the physical square convention. */
function bodyOverlaps(tree:NativeSpatialBvh,x:number,y:number):boolean {
  if(x+10<=tree.minX||x-10>=tree.maxX||y+10<=tree.minY||y-10>=tree.maxY)return false;
  if(!tree.items)return!!(tree.left&&bodyOverlaps(tree.left,x,y)||tree.right&&bodyOverlaps(tree.right,x,y));
  return tree.items.some(triangle=>{
    if(x+10<=triangle.minX||x-10>=triangle.maxX||y+10<=triangle.minY||y-10>=triangle.maxY)return false;
    const points=triangle.points;
    for(let index=0;index<6;index+=2){
      const next=(index+2)%6,nx=points[next+1]!-points[index+1]!,ny=points[index]!-points[next]!;
      const projection=[0,2,4].map(i=>points[i]!*nx+points[i+1]!*ny),center=x*nx+y*ny,radius=10*(Math.abs(nx)+Math.abs(ny));
      if(center+radius<=Math.min(...projection)+1e-7||center-radius>=Math.max(...projection)-1e-7)return false;
    }return true;
  });
}

export function refineNativeAutoPlan(objects:readonly NativeAutoCoverageObject[],sites:readonly Point[],
  domains:readonly (readonly number[])[],chosen:Map<number,number>,land:readonly Rect[],source:NativeSpatialBvh,
  policy:NativeSpatialPolicy,planning:NativeAutoConstructionPolicy,checkpoint:()=>void,cuts:readonly Rect[]=[],spacing:8|16=16,
  compiledGround?:NativeAutoGroundField):NativeAutoRefinementTrace {
  // Independent fine phases avoid the 64px candidate grid aliasing 128/160px
  // holes and missing narrow connections between deep regions.
  const ground=compiledGround??createNativeSpatialPlanningGround(land,cuts),field:(Point&{margin:number;source:number;gx:number;gy:number})[]=[];
  const maximumX=Math.max(...land.map(r=>r[0]+r[2])),maximumY=Math.max(...land.map(r=>r[1]+r[3]));
  for(let gy=0;gy*spacing+spacing/2<maximumY;gy++)for(let gx=0;gx*spacing+spacing/2<maximumX;gx++){
    const point={x:gx*spacing+spacing/2,y:gy*spacing+spacing/2},margin=ground.margin(point),distance=nativePrimitiveDistance(source,point.x,point.y);
    if(margin>=10&&(!compiledGround||compiledGround.supportsBody(point))&&distance>=10&&!bodyOverlaps(source,point.x,point.y))field.push({...point,margin,source:distance,gx,gy});
  }
  const lookup=new Map(field.map((p,index)=>[`${p.gx}:${p.gy}`,index]));
  const neighbors=field.map(p=>[-1,0,1].flatMap(dx=>[-1,0,1].flatMap(dy=>{
    const index=lookup.get(`${p.gx+dx}:${p.gy+dy}`);return(dx||dy)&&index!==undefined?[index]:[];
  })));
  const distanceCaches=objects.map(()=>new Map<number,Float32Array>());
  const bodyCaches=objects.map(()=>new Map<number,Uint8Array>());
  // Sites are snap8 translations. A projected point at the same object-local
  // coordinate has identical distance and body occupancy, at every site.
  // Preserve the old Float32 rounding before deriving the occupancy mask.
  const localPhase=spacing===8?4:0;
  let minFieldX=Infinity,minFieldY=Infinity,maxFieldX=-Infinity,maxFieldY=-Infinity;
  for(const point of field){minFieldX=Math.min(minFieldX,point.x);minFieldY=Math.min(minFieldY,point.y);maxFieldX=Math.max(maxFieldX,point.x);maxFieldY=Math.max(maxFieldY,point.y);}
  if(!field.length)throw new Error('Automatic coverage field contains no supported body centers');
  const minLocalX=Math.floor((minFieldX-Math.max(...sites.map(p=>p.x))-localPhase)/8);
  const minLocalY=Math.floor((minFieldY-Math.max(...sites.map(p=>p.y))-localPhase)/8);
  const maxLocalX=Math.ceil((maxFieldX-Math.min(...sites.map(p=>p.x))-localPhase)/8);
  const maxLocalY=Math.ceil((maxFieldY-Math.min(...sites.map(p=>p.y))-localPhase)/8);
  const localCols=maxLocalX-minLocalX+1,localSize=localCols*(maxLocalY-minLocalY+1);
  const fieldOffsets=Int32Array.from(field.map(p=>(Math.round((p.y-localPhase)/8)-minLocalY)*localCols+Math.round((p.x-localPhase)/8)-minLocalX));
  const localDistances=objects.map(()=>new Float32Array(localSize));
  // 0 = not measured, 1 = clear, 2 = blocked.
  const localBodies=objects.map(()=>new Uint8Array(localSize));
  const distances=(objectIndex:number,siteIndex:number):Float32Array=>{
    const cache=distanceCaches[objectIndex]!,old=cache.get(siteIndex);if(old)return old;
    checkpoint();
    const values=new Float32Array(field.length),blocked=new Uint8Array(field.length);
    const object=objects[objectIndex]!,site=sites[siteIndex]!,offset=site.y/8*localCols+site.x/8;
    const localValues=localDistances[objectIndex]!,localBody=localBodies[objectIndex]!;
    for(let index=0;index<field.length;index++){
      const key=fieldOffsets[index]!-offset;
      if(!localBody[key]){
        const point=field[index]!,x=point.x-site.x,y=point.y-site.y;
        localValues[key]=nativeAutoObjectDistance(object,site,point);
        const distance=localValues[key]!;
        const occupied=distance>=Math.SQRT2*10?false:distance<10?true:
          object.kind==='solid'?bodyOverlaps(object.tree!,x,y):(object.coverageRects??object.rects).some(rect=>overlaps([x-10,y-10,20,20],rect,0));
        localBody[key]=occupied?2:1;
      }
      values[index]=localValues[key]!;blocked[index]=localBody[key]!-1;
    }
    cache.set(siteIndex,values);bodyCaches[objectIndex]!.set(siteIndex,blocked);return values;
  };
  const deep=new Uint8Array(field.length),deepBody=new Uint8Array(field.length),wide=new Uint8Array(field.length),seen=new Uint8Array(field.length),queue=new Int32Array(field.length);
  const routeField=createNativeAutoRouteField(field,spacing),available=new Uint8Array(field.length),holeDistance=new Float32Array(field.length);
  function components(mask:Uint8Array):{span:number;largest:number;count:number;spanPenalty:number} {
    seen.fill(0);let span=0,largest=0,count=0,spanPenalty=0;
    for(let start=0;start<field.length;start++)if(mask[start]&&!seen[start]){
      let read=0,write=1,minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      queue[0]=start;seen[start]=1;
      while(read<write){
        const at=queue[read++]!,point=field[at]!;
        minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
        for(const next of neighbors[at]!)if(mask[next]&&!seen[next]){seen[next]=1;queue[write++]=next;}
      }
      const extent=Math.max(maxX-minX+spacing,maxY-minY+spacing);
      largest=Math.max(largest,write);count+=write;span=Math.max(span,extent);
      spanPenalty+=Math.max(0,extent/policy.maxDeepEmptySpanPx-1)**2;
    }
    return{span,largest,count,spanPenalty};
  }
  interface FixedField {structure:Float32Array;holes:Float32Array;blocked:Uint8Array}
  // Every trial changes only one or two objects. Cache the other objects'
  // exact nearest distances and body mask once per coordinate operation.
  const fixedField=(moving:readonly number[]):FixedField=>{
    const structure=Float32Array.from(field.map(point=>point.source)),holes=new Float32Array(field.length).fill(Infinity),blocked=new Uint8Array(field.length);
    for(let object=0;object<objects.length;object++)if(!moving.includes(object)){
      const values=distances(object,chosen.get(object)!),body=bodyCaches[object]!.get(chosen.get(object)!)!;
      for(let cell=0;cell<field.length;cell++){
        structure[cell]=Math.min(structure[cell]!,values[cell]!);blocked[cell]=blocked[cell]!|body[cell]!;
        if(objects[object]!.kind==='hole')holes[cell]=Math.min(holes[cell]!,values[cell]!);
      }
    }
    return{structure,holes,blocked};
  };
  const score=(moving:readonly number[]=[],fixed:FixedField=fixedField(moving)):NativeAutoCoverageScore=>{
    const arrays=moving.map(index=>distances(index,chosen.get(index)!));
    const blocked=moving.map(index=>bodyCaches[index]!.get(chosen.get(index)!)!);
    let penalty=0,maxEmptyPx=0,maxVoidDistancePx=0,maxApproachRoutePx=0,bodyCount=0,soft=0;
    deep.fill(0);wide.fill(0);deepBody.fill(0);
    available.fill(0);holeDistance.fill(Infinity);
    const cellError=Math.SQRT2*4;
    for(let index=0;index<field.length;index++){
      const point=field[index]!;
      let occupied=fixed.blocked[index]!==0;
      for(let object=0;object<blocked.length&&!occupied;object++)occupied=blocked[object]![index]!==0;
      if(occupied)continue;
      // G2 needs attributed internal H. Exterior VOID cannot supply a witness.
      let structure=fixed.structure[index]!,voidDistance=fixed.holes[index]!;
      for(let object=0;object<moving.length;object++){
        const distance=arrays[object]![index]!;
        structure=Math.min(structure,distance);if(objects[moving[object]!]!.kind==='hole')voidDistance=Math.min(voidDistance,distance);
      }
      const open=Math.min(structure,point.margin);if(open<10)continue;
      available[index]=1;holeDistance[index]=voidDistance;
      bodyCount++;maxEmptyPx=Math.max(maxEmptyPx,open+cellError);maxVoidDistancePx=Math.max(maxVoidDistancePx,voidDistance);
      // Whole-map edge treatment can move a local template by one raster cell.
      deep[index]=Number(structure+cellError+(compiledGround?8:0)>policy.deepEmptyThresholdPx);
      wide[index]=Number(open>=policy.wideRadiusPx);
      penalty+=Math.max(0,(open+cellError)/policy.maxEmptyRadiusPx-1)**2;
      soft+=Math.max(0,structure/policy.deepEmptyThresholdPx-1)**2;
    }
    // Forecast approach to an internal hole through the actual body field.
    // Half the reference sight range is a planning neighbourhood, not an LOS
    // witness. Final G2 still measures attributed q/v/t and exact body routes.
    const approach=routeField(available,holeDistance,policy.referenceSightPx/2);
    for(let index=0;index<field.length;index++)if(available[index]){
      const length=Number.isFinite(approach[index])?approach[index]!:Math.hypot(maximumX,maximumY)*2;
      maxApproachRoutePx=Math.max(maxApproachRoutePx,length);
      penalty+=Math.max(0,length/policy.maxCoverRoutePx-1)**2;
    }
    // The final 8px field uses the same one-cell erosion as G1. Coarse
    // phases keep thin deep links so that they cannot hide a real ridge.
    for(let index=0;index<field.length;index++)if(deep[index]){
      const adjacent=neighbors[index]!;let interior=spacing!==8||adjacent.length===8;
      if(spacing===8)for(let next=0;next<adjacent.length&&interior;next++)interior=deep[adjacent[next]!]!==0;
      deepBody[index]=Number(interior);
    }
    const deepGroups=components(deepBody),wideGroups=components(wide);
    const wideRatio=wideGroups.count/Math.max(1,bodyCount),largestWideRatio=wideGroups.largest/Math.max(1,wideGroups.count);
    // Normalize field integrals so map size cannot drown a single failed
    // gate (especially a long connected deep strip) in wide-area samples.
    penalty/=Math.max(1,bodyCount);
    penalty+=Math.max(0,maxEmptyPx/policy.maxEmptyRadiusPx-1)**2+deepGroups.spanPenalty;
    penalty+=Math.max(0,maxApproachRoutePx/policy.maxCoverRoutePx-1)**2;
    penalty+=Math.max(0,1-wideRatio/policy.minWideRatio)**2+Math.max(0,1-largestWideRatio/policy.minLargestWideRatio)**2;
    const qualityPenalty=Math.max(0,1-wideRatio/(planning.targetWidePercent/100))**2+soft/Math.max(1,bodyCount)*.001;
    return{penalty,qualityPenalty,maxEmptyPx,maxDeepSpanPx:deepGroups.span,maxVoidDistancePx,maxApproachRoutePx,wideRatio,largestWideRatio};
  };
  const domainSets=domains.map(domain=>new Set(domain));
  const fits=(object:number,site:number,excluding:readonly number[]):boolean=>{
    if(!domainSets[object]!.has(site))return false;
    const box=shifted(objects[object]!.bounds,sites[site]!);
    return objects.every((other,index)=>index===object||excluding.includes(index)
      ||!overlaps(box,shifted(other.bounds,sites[chosen.get(index)!]!),planning.objectClearancePx));
  };
  let evaluations=0,acceptedMoves=0,acceptedSwaps=0,acceptedJointMoves=0,completedPasses=0,current=score();
  const before=current;
  const order=objects.map((_,index)=>index).sort((a,b)=>Number(objects[b]!.kind==='hole')-Number(objects[a]!.kind==='hole')||a-b);
  for(let pass=0;pass<planning.refinementPasses&&evaluations<planning.maxRefinementEvaluations;pass++){
    for(const object of order){
      const original=chosen.get(object)!,fixed=fixedField([object]);let best=original,bestScore=current;
      for(const site of domains[object]!){
        if(evaluations>=planning.maxRefinementEvaluations)break;
        if(site===original||!fits(object,site,[]))continue;
        checkpoint();chosen.set(object,site);evaluations++;
        const candidate=score([object],fixed);if(nativeAutoScoreImproves(candidate,bestScore)){best=site;bestScore=candidate;}
      }
      chosen.set(object,best);if(best!==original){current=bestScore;acceptedMoves++;}
    }
    for(let first=0;first<objects.length&&evaluations<planning.maxRefinementEvaluations;first++)for(let second=first+1;second<objects.length&&evaluations<planning.maxRefinementEvaluations;second++){
      const a=chosen.get(first)!,b=chosen.get(second)!;
      if(!fits(first,b,[second])||!fits(second,a,[first])
        ||overlaps(shifted(objects[first]!.bounds,sites[b]!),shifted(objects[second]!.bounds,sites[a]!),planning.objectClearancePx))continue;
      const fixed=fixedField([first,second]);
      checkpoint();chosen.set(first,b);chosen.set(second,a);evaluations++;
      const candidate=score([first,second],fixed);
      if(nativeAutoScoreImproves(candidate,current)){current=candidate;acceptedSwaps++;}else{chosen.set(first,a);chosen.set(second,b);}
    }
    // Coordinated neighboring moves can split a deep ridge without requiring
    // either object to improve the complete objective by itself.
    for(let first=0;first<objects.length&&evaluations<planning.maxRefinementEvaluations;first++){
      const near=objects.map((_,second)=>second).filter(second=>second>first)
        .sort((a,b)=>Math.hypot(sites[chosen.get(first)!]!.x-sites[chosen.get(a)!]!.x,sites[chosen.get(first)!]!.y-sites[chosen.get(a)!]!.y)
          -Math.hypot(sites[chosen.get(first)!]!.x-sites[chosen.get(b)!]!.x,sites[chosen.get(first)!]!.y-sites[chosen.get(b)!]!.y)).slice(0,2);
      for(const second of near){
        const a=chosen.get(first)!,b=chosen.get(second)!;
        const local=(object:number,origin:number)=>domains[object]!.filter(site=>Math.hypot(sites[site]!.x-sites[origin]!.x,sites[site]!.y-sites[origin]!.y)<=48)
          .sort((x,y)=>Math.hypot(sites[x]!.x-sites[origin]!.x,sites[x]!.y-sites[origin]!.y)-Math.hypot(sites[y]!.x-sites[origin]!.x,sites[y]!.y-sites[origin]!.y)).slice(0,9);
        const fixed=fixedField([first,second]);
        let bestA=a,bestB=b,bestScore=current;
        for(const toA of local(first,a))for(const toB of local(second,b)){
          if(evaluations>=planning.maxRefinementEvaluations)break;
          if(toA===a&&toB===b||!fits(first,toA,[second])||!fits(second,toB,[first])
            ||overlaps(shifted(objects[first]!.bounds,sites[toA]!),shifted(objects[second]!.bounds,sites[toB]!),planning.objectClearancePx))continue;
          checkpoint();chosen.set(first,toA);chosen.set(second,toB);evaluations++;
          const candidate=score([first,second],fixed);if(nativeAutoScoreImproves(candidate,bestScore)){bestA=toA;bestB=toB;bestScore=candidate;}
        }
        chosen.set(first,bestA);chosen.set(second,bestB);
        if(bestA!==a||bestB!==b){current=bestScore;acceptedJointMoves++;}
      }
    }
    completedPasses++;
  }
  return{evaluations,acceptedMoves,acceptedSwaps,acceptedJointMoves,completedPasses,before,after:current};
}
