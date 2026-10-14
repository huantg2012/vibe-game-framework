/** Final local B identity. Exterior water is never H/S coverage or a bay area proxy. */
import type {Vector2} from '@/types/game-types';
import type {WalkGrid} from '@/types/map-types';
import {bodyHasSupport,bodyDisplacementFraction} from '@/systems/ai/physical-grid';
import type {NativeSpatialGeometry} from './native-spatial-geometry';
import type {NativeSpatialBayProfile,NativeSpatialGateResult} from './native-spatial-types';
import type {NativeSpatialBayPlacement,NativeSpatialLandJoin,NativeSpatialGroupResult} from './native-spatial-structures';
type Rect=readonly [number,number,number,number];
export interface NativeSpatialBayAuthoring {
  readonly landRects:readonly Rect[];readonly placements:readonly NativeSpatialBayPlacement[];
  readonly landJoins:readonly NativeSpatialLandJoin[];readonly profiles:readonly NativeSpatialBayProfile[];
  readonly allowedCounts:readonly number[];readonly minWideJoinPx:number;
}
// Shared fragment-v1 maximum corner displacement: 68 * max scale(1.3*1.2)
// * max directional bias(1.44) * worldScale(2), plus one support cell.
// This bounds attribution only; it grants no width, area or coverage credit.
const EDGE_INFLUENCE_PX=Math.ceil(68*1.3*1.2*1.44*2)+8;
const inside=(rects:readonly Rect[],x:number,y:number):boolean=>rects.some(r=>x>=r[0]&&y>=r[1]&&x<r[0]+r[2]&&y<r[1]+r[3]);
function intersection(a:Rect,b:Rect):Rect|undefined {
  const x=Math.max(a[0],b[0]),y=Math.max(a[1],b[1]),w=Math.min(a[0]+a[2],b[0]+b[2])-x,h=Math.min(a[1]+a[3],b[1]+b[3])-y;
  return w>0&&h>0?[x,y,w,h]:undefined;
}
function area(rects:readonly Rect[]):number {
  const xs=[...new Set(rects.flatMap(r=>[r[0],r[0]+r[2]]))].sort((a,b)=>a-b);let result=0;
  for(let i=1;i<xs.length;i++){
    const x=(xs[i-1]!+xs[i]!)/2,spans=rects.filter(r=>x>r[0]&&x<r[0]+r[2]).map(r=>[r[1],r[1]+r[3]] as const).sort((a,b)=>a[0]-b[0]);let end=-Infinity,length=0;
    for(const [a,b]of spans){length+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}result+=(xs[i]!-xs[i-1]!)*length;
  }return result;
}
function bounds(rects:readonly Rect[]){return{minX:Math.min(...rects.map(r=>r[0])),minY:Math.min(...rects.map(r=>r[1])),maxX:Math.max(...rects.map(r=>r[0]+r[2])),maxY:Math.max(...rects.map(r=>r[1]+r[3]))};}
function validSource(land:readonly Rect[],bay:NativeSpatialBayPlacement):boolean {
  const {points,outward}=bay.sourceShore;
  if(points.length<2||Math.abs(outward.x)+Math.abs(outward.y)!==1||outward.x!==0&&outward.y!==0)return false;
  for(let i=1;i<points.length;i++){
    const a=points[i-1]!,b=points[i]!,dx=b.x-a.x,dy=b.y-a.y;if(dx===0&&dy===0||dx!==0&&dy!==0)return false;
    const length=Math.abs(dx)+Math.abs(dy);
    if(dx*outward.x+dy*outward.y!==0)return false;
    for(let at=0;at<length;at+=8){const t=(at+Math.min(8,length-at)/2)/length,x=a.x+dx*t,y=a.y+dy*t;
      if(inside(land,x+outward.x*.5,y+outward.y*.5)||!inside(land,x-outward.x*.5,y-outward.y*.5))return false;
      if(!inside(bay.rects,x-outward.x*.5,y-outward.y*.5))return false;
    }
  }
  return true;
}
/** Exact axis intervals behind every terminal strip of the raw removed area. */
function backland(land:readonly Rect[],allCuts:readonly Rect[],removed:readonly Rect[],normal:Readonly<Vector2>,required:number):number {
  if(!removed.length)return 0;
  const horizontal=normal.x!==0,sign=horizontal?normal.x:normal.y,tangents=[...new Set(removed.flatMap(r=>horizontal?[r[1],r[1]+r[3]]:[r[0],r[0]+r[2]]))].sort((a,b)=>a-b);
  let minimum=Infinity;
  for(let i=1;i<tangents.length;i++){
    const tangent=(tangents[i-1]!+tangents[i]!)/2,strips=removed.filter(r=>horizontal?tangent>r[1]&&tangent<r[1]+r[3]:tangent>r[0]&&tangent<r[0]+r[2]);if(!strips.length)continue;
    const tip=Math.max(...strips.map(r=>sign>0?(horizontal?r[0]+r[2]:r[1]+r[3]):-(horizontal?r[0]:r[1]))),point=horizontal?{x:tip*sign,y:tangent}:{x:tangent,y:tip*sign};
    const breaks=[...new Set([0,required,...[...land,...allCuts].flatMap(r=>horizontal?[(r[0]-point.x)/sign,(r[0]+r[2]-point.x)/sign]:[(r[1]-point.y)/sign,(r[1]+r[3]-point.y)/sign])])].filter(v=>v>=0&&v<=required).sort((a,b)=>a-b);let reached=0;
    for(let j=1;j<breaks.length;j++){const end=breaks[j]!,d=(breaks[j-1]!+end)/2,x=point.x+normal.x*d,y=point.y+normal.y*d;if(!inside(land,x,y)||inside(allCuts,x,y))break;reached=end;}
    minimum=Math.min(minimum,reached);
  }
  return Number.isFinite(minimum)?minimum:0;
}
export function evaluateNativeSpatialBays(geometry:NativeSpatialGeometry,groups:NativeSpatialGroupResult,input:NativeSpatialBayAuthoring):NativeSpatialGateResult {
  const {cols,rows,matter}=geometry.terrain,count=cols*rows,land=input.landRects,cuts=input.placements.flatMap(b=>b.rects),profileById=new Map(input.profiles.map(p=>[p.id,p]));
  const point=(cell:number)=>({x:(cell%cols+.5)*8,y:(Math.floor(cell/cols)+.5)*8}),landMask=new Uint8Array(count),externalLabels=new Set<number>();
  for(let cell=0;cell<count;cell++){const p=point(cell);landMask[cell]=Number(inside(land,p.x,p.y));if(cell<cols||cell>=count-cols||cell%cols===0||cell%cols===cols-1)externalLabels.add(groups.holeLabelByCell[cell]!);}
  const overallReasons:string[]=[];
  if(!input.allowedCounts.includes(input.placements.length))overallReasons.push('bay-count-outside-frozen-domain');
  for(const join of input.landJoins){
    const parent=land[join.parentIndex],child=land[join.childIndex],valid=parent&&child&&join.rect[2]>=input.minWideJoinPx&&join.rect[3]>=input.minWideJoinPx&&intersection(parent,join.rect)&&intersection(child,join.rect);
    if(!valid||area([intersection(parent!,join.rect)!].filter(Boolean))!==join.rect[2]*join.rect[3]||area([intersection(child!,join.rect)!].filter(Boolean))!==join.rect[2]*join.rect[3]){overallReasons.push('bay-invalid-wide-join');continue;}
    if(cuts.some(cut=>intersection(join.rect,cut)))overallReasons.push('bay-cut-wide-join');
  }
  const localCellsByBay:Set<number>[]=[];
  const records=input.placements.map(bay=>{
    const profile=profileById.get(bay.profileId),reasons:string[]=[],removed=land.flatMap(l=>bay.rects.flatMap(r=>{const v=intersection(l,r);return v?[v]:[]})),removedLandAreaPx2=area(removed),box=bounds(bay.rects);
    const source=bay.sourceShore.points[0]??{x:NaN,y:NaN},outward=bay.sourceShore.outward,normal={x:-outward.x,y:-outward.y},tangent={x:-normal.y,y:normal.x};
    const sourceProjection=bay.sourceShore.points.map(p=>p.x*tangent.x+p.y*tangent.y),mouthPx=Math.max(...sourceProjection)-Math.min(...sourceProjection),unionSpanPx=Math.max(box.maxX-box.minX,box.maxY-box.minY);
    const depthPx=removed.length?Math.max(...removed.flatMap(([x,y,w,h])=>[{x,y},{x:x+w,y:y+h}].map(p=>(p.x-source.x)*normal.x+(p.y-source.y)*normal.y))):0;
    if(!profile)reasons.push('bay-profile-missing');
    if(!validSource(land,bay))reasons.push('bay-no-source-shore');
    if(!removedLandAreaPx2)reasons.push('bay-no-real-land-loss');
    const backlandPx=profile?backland(land,cuts,removed,normal,profile.minBacklandPx):0;
    if(profile&&(bay.rects.length<profile.minRectCount||bay.rects.length>profile.maxRectCount||unionSpanPx>profile.maxUnionSpanPx||removedLandAreaPx2<profile.minRemovedLandAreaPx2||removedLandAreaPx2>profile.maxRemovedLandAreaPx2||mouthPx<profile.minMouthPx||mouthPx>profile.maxMouthPx||depthPx<profile.minDepthPx||depthPx>profile.maxDepthPx))reasons.push('bay-profile-size');
    if(profile&&backlandPx<profile.minBacklandPx)reasons.push('bay-insufficient-backland');
    const rawDeleted=new Set<number>(),rawMask=new Uint8Array(count),localMask=new Uint8Array(count);
    for(let cell=0;cell<count;cell++){
      const p=point(cell),inBay=inside(bay.rects,p.x,p.y),inEnvelope=p.x>=box.minX-EDGE_INFLUENCE_PX&&p.x<=box.maxX+EDGE_INFLUENCE_PX&&p.y>=box.minY-EDGE_INFLUENCE_PX&&p.y<=box.maxY+EDGE_INFLUENCE_PX;
      rawMask[cell]=Number(landMask[cell]&&inBay);localMask[cell]=Number(!matter[cell]&&inEnvelope);
      if(rawMask[cell]&&!matter[cell]){rawDeleted.add(cell);}
    }
    if(!rawDeleted.size)reasons.push('bay-no-final-land-loss');
    if([...rawDeleted].some(cell=>!externalLabels.has(groups.holeLabelByCell[cell]!)))reasons.push('bay-sealed');
    const grid=(mask:Uint8Array):WalkGrid=>({cols,rows,tileSize:8,version:0,isWalkable:(x,y)=>x>=0&&y>=0&&x<cols&&y<rows&&mask[y*cols+x]===1});
    const localGrid=grid(localMask),rawGrid=grid(rawMask),oceanGrid=grid(Uint8Array.from(landMask,v=>v?0:1)),half=(profile?.minFinalThroatPx??64)/2,centres=new Uint8Array(count),parent=new Int32Array(count).fill(-1),queue:number[]=[];
    for(let cell=0;cell<count;cell++)if(localMask[cell]){const p=point(cell);if(bodyHasSupport(localGrid,p,half,half)){centres[cell]=1;if(rawMask[cell]&&bodyHasSupport(rawGrid,p,half,half)){parent[cell]=cell;queue.push(cell);}}}
    let terminal=-1;
    for(let at=0;at<queue.length&&terminal<0;at++){
      const cell=queue[at]!,p=point(cell);if(!landMask[cell]&&bodyHasSupport(oceanGrid,p,half,half)&&(p.x-source.x)*outward.x+(p.y-source.y)*outward.y>=half){terminal=cell;break;}
      const x=cell%cols,y=Math.floor(cell/cols);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx!,ny=y+dy!,n=ny*cols+nx;if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&centres[n]&&parent[n]===-1&&bodyDisplacementFraction(localGrid,p,half,half,dx!*8,dy!*8)>=1){parent[n]=cell;queue.push(n);}}
    }
    if(terminal<0)reasons.push('bay-mouth-too-thin');
    let start=terminal,routeSteps=0;if(start>=0)while(parent[start]!==start){start=parent[start]!;routeSteps++;}
    const finalCells=[...rawDeleted],localVisited=new Set(finalCells);
    // Attribute only land loss reached inside this bay's known local influence.
    // A natural eroded rim elsewhere cannot connect two distant bay identities.
    for(let at=0;at<finalCells.length;at++){const cell=finalCells[at]!,x=cell%cols,y=Math.floor(cell/cols);for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx!,ny=y+dy!,next=ny*cols+nx;if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&localMask[next]&&landMask[next]&&!localVisited.has(next)){localVisited.add(next);finalCells.push(next);}}}
    localCellsByBay.push(localVisited);
    return{bayId:bay.bayId,profileId:bay.profileId,sourceShore:bay.sourceShore,sourceRects:bay.rects,removedLandAreaPx2,unionSpanPx,mouthPx,depthPx,backlandPx,
      finalRawCutVoidAreaPx2:rawDeleted.size*64,finalLocalVoidAreaPx2:finalCells.length*64,finalLocalVoidBounds:finalCells.length?bounds(finalCells.map(cell=>{const p=point(cell);return[p.x-4,p.y-4,8,8] as const;})):null,
      throatSquarePx:half*2,throatStart:start<0?null:point(start),throatEnd:terminal<0?null:point(terminal),throatRoutePx:routeSteps*8,edgeInfluenceBoundPx:EDGE_INFLUENCE_PX,reasons};
  });
  for(let a=0;a<records.length;a++)for(let b=a+1;b<records.length;b++)if(records[a]!.bayId===records[b]!.bayId||[...localCellsByBay[a]!].some(cell=>localCellsByBay[b]!.has(cell))){records[a]!.reasons.push('bay-merged-inside-positive-land');records[b]!.reasons.push('bay-merged-inside-positive-land');}
  const globalViolationCount=overallReasons.length;overallReasons.push(...records.flatMap(row=>row.reasons));
  const reasons=[...new Set(overallReasons)];
  return{accepted:!reasons.length,reasons,metrics:{bayCount:records.length,bayMeasurements:records,bayViolationCount:records.filter(row=>row.reasons.length).length+globalViolationCount,positiveLandAreaPx2:area(land)}};
}
