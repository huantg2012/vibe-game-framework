/** B is an authored exterior cut in the unfinished L/B/H/S proposal, never a
 * failed H relabel or a cut made after deployment. */
import type {Vector2} from '@/types/game-types';
import type {NativeSpatialBayProfile} from './native-spatial-types';
import type {NativeSpatialBayPlacement,NativeSpatialLandJoin} from './native-spatial-structures';
import {nativePrimitive,nativePrimitiveDistance,nativePrimitiveTree,type NativeSpatialPrimitive} from './native-spatial-geometry';
import {nativeRectUnionArea,nativeSpatialExposedShore,type NativeSpatialLandRect,type NativeSpatialRandom,type NativeSpatialLandShore} from './native-spatial-land';
type Rect=NativeSpatialLandRect;
const snap=(value:number)=>Math.round(value/8)*8;
const inside=(rects:readonly (readonly number[])[],x:number,y:number)=>rects.some(r=>x>=r[0]!&&y>=r[1]!&&x<=r[0]!+r[2]!&&y<=r[1]!+r[3]!);
function intersect(a:readonly number[],b:readonly number[]):Rect|undefined {
  const x=Math.max(a[0]!,b[0]!),y=Math.max(a[1]!,b[1]!),w=Math.min(a[0]!+a[2]!,b[0]!+b[2]!)-x,h=Math.min(a[1]!+a[3]!,b[1]!+b[3]!)-y;
  return w>0&&h>0?[x,y,w,h]:undefined;
}
export function nativeSpatialRemovedLand(land:readonly Rect[],cuts:readonly (readonly number[])[]):Rect[]{return land.flatMap(l=>cuts.flatMap(c=>{const r=intersect(l,c);return r?[r]:[];}));}
/** The protected core lies in an actual two-dimensional plate overlap. */
export function nativeSpatialLandJoins(land:readonly Rect[],width:number,parents?:readonly (number|null)[]):NativeSpatialLandJoin[]{
  return land.slice(1).map((child,i)=>{
    const childIndex=i+1,options=land.slice(0,childIndex).flatMap((parent,parentIndex)=>{if(parents&&parents[childIndex]!==parentIndex)return[];const r=intersect(parent,child);return r&&r[2]>=width&&r[3]>=width?[{parentIndex,r}]:[];});
    options.sort((a,b)=>b.r[2]*b.r[3]-a.r[2]*a.r[3]||a.parentIndex-b.parentIndex);const selected=options[0];
    if(!selected)throw new Error('Native plate has no protected wide join');
    return{parentIndex:selected.parentIndex,childIndex,rect:[selected.r[0]+(selected.r[2]-width)/2,selected.r[1]+(selected.r[3]-width)/2,width,width] as Rect};
  });
}
export interface NativeSpatialPlanningGround {
  contains(point:Readonly<Vector2>):boolean;margin(point:Readonly<Vector2>):number;
  supportsFootprint(primitives:readonly NativeSpatialPrimitive[],offset:Readonly<Vector2>):boolean;
}
/** Exact raw L minus B support, including new shore distances, without treating
 * exterior cuts as H/S coverage primitives. */
export function createNativeSpatialPlanningGround(land:readonly Rect[],cuts:readonly (readonly number[])[]):NativeSpatialPlanningGround {
  const all=[...land,...cuts],xs=[...new Set(all.flatMap(r=>[r[0]!,r[0]!+r[2]!]))].sort((a,b)=>a-b),ys=[...new Set(all.flatMap(r=>[r[1]!,r[1]!+r[3]!]))].sort((a,b)=>a-b),segments:NativeSpatialPrimitive[]=[];
  const contains=(p:Readonly<Vector2>)=>inside(land,p.x,p.y)&&!inside(cuts,p.x,p.y);
  const present=(x:number,y:number)=>x>=0&&y>=0&&x<xs.length-1&&y<ys.length-1&&contains({x:(xs[x]!+xs[x+1]!)/2,y:(ys[y]!+ys[y+1]!)/2});
  for(let y=0;y<ys.length-1;y++)for(let x=0;x<xs.length-1;x++)if(present(x,y)){
    const l=xs[x]!,r=xs[x+1]!,t=ys[y]!,b=ys[y+1]!;
    if(!present(x-1,y))segments.push(nativePrimitive([l,t,l,b],-1));if(!present(x+1,y))segments.push(nativePrimitive([r,t,r,b],-1));
    if(!present(x,y-1))segments.push(nativePrimitive([l,t,r,t],-1));if(!present(x,y+1))segments.push(nativePrimitive([l,b,r,b],-1));
  }
  const tree=nativePrimitiveTree(segments);
  const supportsFootprint=(primitives:readonly NativeSpatialPrimitive[],offset:Readonly<Vector2>):boolean=>primitives.every(triangle=>{
    const p=triangle.points;if(p.length!==6)throw new Error('Planning support expects projected triangles');
    for(let i=0;i<6;i+=2)if(!contains({x:p[i]!+offset.x,y:p[i+1]!+offset.y}))return false;
    const orientation=Math.sign((p[2]!-p[0]!)*(p[5]!-p[1]!)-(p[3]!-p[1]!)*(p[4]!-p[0]!));if(!orientation)return true;
    // Clip each raw L-B boundary segment against the triangle's strict interior.
    // This catches a cut wholly inside a triangle as well as crossed edges;
    // three supported vertices are not a proof of footprint support.
    for(const edge of segments){
      if(edge.maxX<=triangle.minX+offset.x||edge.minX>=triangle.maxX+offset.x||edge.maxY<=triangle.minY+offset.y||edge.minY>=triangle.maxY+offset.y)continue;
      const ax=edge.points[0]!-offset.x,ay=edge.points[1]!-offset.y,bx=edge.points[2]!-offset.x,by=edge.points[3]!-offset.y;let lo=0,hi=1;
      for(let i=0;i<6&&lo<hi;i+=2){const j=(i+2)%6,dx=p[j]!-p[i]!,dy=p[j+1]!-p[i+1]!,start=orientation*(dx*(ay-p[i+1]!)-dy*(ax-p[i]!)),slope=orientation*(dx*(by-ay)-dy*(bx-ax));
        if(Math.abs(slope)<1e-9){if(start<=1e-7){lo=1;hi=0;}}else if(slope>0)lo=Math.max(lo,(1e-7-start)/slope);else hi=Math.min(hi,(1e-7-start)/slope);
      }
      if(lo<hi)return false;
    }
    return true;
  });
  return{contains,margin:p=>contains(p)?nativePrimitiveDistance(tree,p.x,p.y):-1,supportsFootprint};
}
function mergedShore(land:readonly Rect[]):NativeSpatialLandShore[]{
  const segments=nativeSpatialExposedShore(land),groups=new Map<string,NativeSpatialLandShore[]>();
  for(const s of segments){const key=`${s.direction}:${s.direction<2?s.x1:s.y1}`,list=groups.get(key)??[];list.push(s);groups.set(key,list);}
  const result:NativeSpatialLandShore[]=[];
  for(const list of groups.values()){
    list.sort((a,b)=>a.direction<2?a.y1-b.y1:a.x1-b.x1);let current=list[0]!;
    for(const next of list.slice(1))if(current.x2===next.x1&&current.y2===next.y1)current={...current,x2:next.x2,y2:next.y2};else{result.push(current);current=next;}
    result.push(current);
  }return result;
}
function backedByLand(land:readonly Rect[],allCuts:readonly Rect[],bay:NativeSpatialBayPlacement,profile:NativeSpatialBayProfile):boolean {
  const outward=bay.sourceShore.outward,normal={x:-outward.x,y:-outward.y},pieces=nativeSpatialRemovedLand(land,bay.rects);
  if(!pieces.length)return false;
  const tips=pieces.map(r=>normal.x?{x:normal.x>0?r[0]+r[2]:r[0],y:r[1]+r[3]/2}:{x:r[0]+r[2]/2,y:normal.y>0?r[1]+r[3]:r[1]});
  const depth=Math.max(...tips.map(p=>p.x*normal.x+p.y*normal.y)),terminal=tips.filter(p=>p.x*normal.x+p.y*normal.y===depth);
  return terminal.every(tip=>{
    // These axis intervals are exact for the raw rectangle difference. The
    // final body graph independently checks all shoulders and passages.
    const breaks=[0,profile.minBacklandPx,...[...land,...allCuts].flatMap(r=>normal.x?[(r[0]-tip.x)/normal.x,(r[0]+r[2]-tip.x)/normal.x]:[(r[1]-tip.y)/normal.y,(r[1]+r[3]-tip.y)/normal.y])].filter(v=>v>=0&&v<=profile.minBacklandPx).sort((a,b)=>a-b);
    return breaks.slice(1).every((stop,i)=>{if(stop<=breaks[i]!)return true;const d=(breaks[i]!+stop)/2,x=tip.x+normal.x*d,y=tip.y+normal.y*d;return inside(land,x,y)&&!inside(allCuts,x,y);});
  });
}
/** A bay must not author a sustained side lip narrower than the real 20px
 * body. This tests raw rectangle intervals, not the short chips produced by
 * the later free-edge pass, and adds no new bay size/profile parameter. */
export function nativeSpatialBayHasBodySideClearance(land:readonly Rect[],allCuts:readonly Rect[],bay:NativeSpatialBayPlacement):boolean {
  const bodySize=20,normalX=bay.sourceShore.outward.x!==0,rects=[...land,...allCuts];
  const normals=[...new Set(rects.flatMap(r=>normalX?[r[0],r[0]+r[2]]:[r[1],r[1]+r[3]]))].sort((a,b)=>a-b);
  const tangents=[...new Set(rects.flatMap(r=>normalX?[r[1],r[1]+r[3]]:[r[0],r[0]+r[2]]))].sort((a,b)=>a-b);
  const point=(n:number,t:number)=>normalX?{x:n,y:t}:{x:t,y:n};
  let previous=new Map<string,{start:number;end:number}>();
  for(let row=1;row<normals.length;row++){
    const start=normals[row-1]!,end=normals[row]!,normal=(start+end)/2,current=new Map<string,{start:number;end:number}>();
    let runStart:number|undefined;
    const visit=(left:number,right:number):boolean=>{
      if(right-left>=bodySize)return true;
      const a=point(normal,left-1e-4),b=point(normal,right+1e-4);
      if(!inside(bay.rects,a.x,a.y)&&!inside(bay.rects,b.x,b.y))return true;
      const key=`${left}:${right}`,old=previous.get(key),spanStart=old?.end===start?old.start:start;
      if(end-spanStart>=bodySize)return false;
      current.set(key,{start:spanStart,end});return true;
    };
    for(let col=1;col<tangents.length;col++){
      const left=tangents[col-1]!,right=tangents[col]!,p=point(normal,(left+right)/2),present=inside(land,p.x,p.y)&&!inside(allCuts,p.x,p.y);
      if(present){runStart??=left;}else if(runStart!==undefined){if(!visit(runStart,left))return false;runStart=undefined;}
    }
    if(runStart!==undefined&&!visit(runStart,tangents[tangents.length-1]!))return false;
    previous=current;
  }
  return true;
}
export function createNativeSpatialBays(land:readonly Rect[],joins:readonly NativeSpatialLandJoin[],profiles:readonly NativeSpatialBayProfile[],random:NativeSpatialRandom,frame:Readonly<{width:number;height:number}>):NativeSpatialBayPlacement[]{
  const shores=mergedShore(land),placed:NativeSpatialBayPlacement[]=[];
  for(const [index,profile]of profiles.entries()){
    const options:{bay:NativeSpatialBayPlacement;score:number}[]=[];
    for(let attempt=0;attempt<160;attempt++){
      const shore=random.choose(shores),vertical=shore.direction<2,shoreLength=vertical?shore.y2-shore.y1:shore.x2-shore.x1;
      const mouth=snap(random.range(profile.minMouthPx,profile.maxMouthPx));if(shoreLength<mouth)continue;
      const minimum=(vertical?shore.y1:shore.x1)+mouth/2,maximum=(vertical?shore.y2:shore.x2)-mouth/2;
      const center=Math.max(minimum,Math.min(maximum,snap(random.range(minimum,maximum)))),normalSign=shore.direction%2===0?1:-1;
      const outward:Vector2=vertical?{x:-normalSign,y:0}:{x:0,y:-normalSign},anchor:Vector2=vertical?{x:shore.x1,y:center}:{x:center,y:shore.y1};
      const points:Vector2[]=vertical?[{x:shore.x1,y:center-mouth/2},{x:shore.x1,y:center+mouth/2}]:[{x:center-mouth/2,y:shore.y1},{x:center+mouth/2,y:shore.y1}];
      const count=random.integer(profile.minRectCount,profile.maxRectCount),targetDepth=snap(random.range(profile.minDepthPx,profile.maxDepthPx));
      const outside=profile.minFinalThroatPx,partDepth=snap((targetDepth+outside)/(1+(count-1)*(1-(profile.minOverlapRatio+profile.maxOverlapRatio)/2)));
      const local:Rect[]=[[-outside,-mouth/2,partDepth,mouth]];
      for(let child=1;child<count;child++){
        const parent=local[child-1]!,length=snap(partDepth*random.range(.85,1.1)),width=snap(random.range(profile.minMouthPx,Math.min(profile.maxMouthPx,parent[3]))),shorterDepth=Math.min(parent[2],length),shorterWidth=Math.min(parent[3],width);
        const overlap=snap(shorterDepth*random.range(profile.minOverlapRatio,profile.maxOverlapRatio)),offset=snap(shorterWidth*random.range(profile.minOffsetRatio,profile.maxOffsetRatio));
        if(overlap/shorterDepth<profile.minOverlapRatio||overlap/shorterDepth>profile.maxOverlapRatio||offset/shorterWidth<profile.minOffsetRatio||offset/shorterWidth>profile.maxOffsetRatio)break;
        local.push([parent[0]+parent[2]-overlap,parent[1]+parent[3]/2-width/2+(random.next()<.5?-offset:offset),length,width]);
      }
      if(local.length!==count)continue;
      const rects:Rect[]=local.map(([depth,tangent,length,width])=>vertical?[anchor.x+(normalSign>0?depth:-depth-length),anchor.y+tangent,length,width]:[anchor.x+tangent,anchor.y+(normalSign>0?depth:-depth-length),width,length]);
      const minX=Math.min(...rects.map(r=>r[0])),minY=Math.min(...rects.map(r=>r[1])),maxX=Math.max(...rects.map(r=>r[0]+r[2])),maxY=Math.max(...rects.map(r=>r[1]+r[3]));
      if(minX<0||minY<0||maxX>frame.width||maxY>frame.height)continue;
      if(Math.max(maxX-minX,maxY-minY)>profile.maxUnionSpanPx)continue;
      const removed=nativeSpatialRemovedLand(land,rects),area=nativeRectUnionArea(removed);
      if(area<profile.minRemovedLandAreaPx2||area>profile.maxRemovedLandAreaPx2)continue;
      const actualDepth=Math.max(...removed.map(r=>vertical?(normalSign>0?r[0]+r[2]-anchor.x:anchor.x-r[0]):(normalSign>0?r[1]+r[3]-anchor.y:anchor.y-r[1])));
      if(actualDepth<profile.minDepthPx||actualDepth>profile.maxDepthPx)continue;
      if(joins.some(join=>rects.some(r=>intersect(join.rect,r))))continue;
      if(placed.some(old=>nativeSpatialRemovedLand(removed,old.rects).length))continue;
      const bay:NativeSpatialBayPlacement={bayId:`bay-${index}`,profileId:profile.id,sourceShore:{points,outward},rects};
      const allCuts=[...placed.flatMap(b=>b.rects.map(r=>[...r] as Rect)),...rects];if(!backedByLand(land,allCuts,bay,profile))continue;
      if(!nativeSpatialBayHasBodySideClearance(land,allCuts,bay))continue;
      // Prefer a local interruption near a step, without forcing one direction,
      // a bay on every plate, a repeated comb, or an art-acceptance threshold.
      const shoulderDistance=Math.min(center-mouth/2-(vertical?shore.y1:shore.x1),(vertical?shore.y2:shore.x2)-center-mouth/2);
      const repeated=placed.filter(b=>b.sourceShore.outward.x===outward.x&&b.sourceShore.outward.y===outward.y).length;
      const targetArea=(profile.minRemovedLandAreaPx2+profile.maxRemovedLandAreaPx2)/2;
      options.push({bay,score:Math.abs(area-targetArea)/targetArea+shoulderDistance/Math.max(1,shoreLength)+repeated*.2+random.range(0,.08)});
    }
    options.sort((a,b)=>a.score-b.score||a.bay.rects[0]![1]-b.bay.rects[0]![1]||a.bay.rects[0]![0]-b.bay.rects[0]![0]);
    if(!options.length)throw new Error(`bay-no-source-shore: ${profile.id} has no supported finite cut`);
    placed.push(options[0]!.bay);
  }
  return placed;
}
