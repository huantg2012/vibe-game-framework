/** DEV reference macro shore authoring. One pass over the original union only;
 * no terrain compilation, candidate search, or retry occurs in this module. */
import {mix32} from '@/generation/seed-fork';
import {buildNativeVolume} from './native-volume-geometry';
import type {MasterDefinition} from './r100-master-world';
import {nativeRectUnionArea,nativeSpatialExposedShore,type NativeSpatialLandRect as Rect,type NativeSpatialLandShore as Shore} from './native-spatial-land';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialPrimitive,type NativeSpatialBvh} from './native-spatial-geometry';

/** Presentation-only frame inset; this is not a gameplay clearance gate. */
export const NATIVE_CONSTRUCTION_FRAME_INSET_PX=32;
const COVER_CELL_CORNER_ERROR=4*Math.SQRT2;

export const NATIVE_CONSTRUCTION_SHORE_COLUMNS=['reference_id','algorithm','segment_min_px','segment_max_px','depth_min_px','depth_max_px','protected_gap_px','max_clean_run_px'] as const;
export interface NativeConstructionShorePolicy {
  readonly referenceId:string;readonly algorithm:'macro-shore-step-v1';readonly sourceHash:string;
  readonly segmentMinPx:number;readonly segmentMaxPx:number;readonly depthMinPx:number;readonly depthMaxPx:number;readonly protectedGapPx:number;readonly maxCleanRunPx:number;
}
export interface NativeConstructionShoreTrial {
  readonly sourceEdge:number;readonly startPx:number;readonly lengthPx:number;readonly mode:'retain'|'cut'|'add';
  readonly requestedDepthPx:number;readonly actualDepthPx:number;readonly rect?:Rect;readonly reason?:string;
  readonly addedCoverage?:Readonly<{accepted:boolean;checkedCells:number;maxDistanceUpperPx:number;worstPoint:Readonly<{x:number;y:number}>|null}>;
}
export interface NativeConstructionShoreResult {
  readonly algorithm:'macro-shore-step-v1';readonly sourceHash:string;readonly originalShore:readonly Shore[];
  readonly additions:readonly Rect[];readonly cuts:readonly Rect[];readonly trials:readonly NativeConstructionShoreTrial[];
}
export interface NativeConstructionShoreInput {
  readonly land:readonly Rect[];readonly protectedRects:readonly (readonly [number,number,number,number])[];
  readonly supportBounds:readonly (readonly [number,number,number,number])[];
  readonly coverPrimitives:readonly NativeSpatialPrimitive[];readonly maxAddedCoverDistancePx:number;
  readonly frame:readonly [number,number];readonly seed:number;
  /** An extension must not reroll unchanged base banks when new banks alter
   * enumeration order. Coordinates use the same translated frame as land. */
  readonly seedLand?:readonly Rect[];
  readonly seedTranslation?:Readonly<{x:number;y:number}>;
}
export function parseNativeConstructionShore(csv:string,sourceHash:string):NativeConstructionShorePolicy {
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);
  if(lines.length!==2||lines[0]!==NATIVE_CONSTRUCTION_SHORE_COLUMNS.join(',')||lines[1]!.includes('"'))throw new Error('Invalid construction shore CSV; expected one policy row');
  const values=lines[1]!.split(',').map(s=>s.trim());
  if(values.length!==NATIVE_CONSTRUCTION_SHORE_COLUMNS.length||values[1]!=='macro-shore-step-v1'||!/^[a-z][a-z0-9-]{0,80}$/.test(values[0]!)||!/^[0-9a-f]{64}$/.test(sourceHash))throw new Error('Invalid construction shore identity');
  const numbers=values.slice(2).map(Number);
  if(values.slice(2).some(s=>!s)||numbers.some(n=>!Number.isSafeInteger(n)||n<=0||n%8))throw new Error('Construction shore distances must be positive 8px multiples');
  const [segmentMinPx,segmentMaxPx,depthMinPx,depthMaxPx,protectedGapPx,maxCleanRunPx]=numbers as [number,number,number,number,number,number];
  if(segmentMinPx>segmentMaxPx||depthMinPx>depthMaxPx)throw new Error('Construction shore ranges are reversed');
  return{referenceId:values[0]!,algorithm:'macro-shore-step-v1',sourceHash,segmentMinPx,segmentMaxPx,depthMinPx,depthMaxPx,protectedGapPx,maxCleanRunPx};
}

/** Measure the compiled exterior, merging collinear vertices so subdividing a
 * straight edge cannot make it pass. This is a visual regression guard, not a
 * substitute for judging the entire outline or for the spatial gameplay gates. */
export function measureNativeConstructionBoundary(outline:readonly Readonly<{x:number;y:number}>[],limitPx:number){
  if(outline.length<3||!Number.isFinite(limitPx)||limitPx<=0)throw new Error('Invalid shore measurement input');
  const points=outline.filter((p,i)=>{const previous=outline[(i+outline.length-1)%outline.length]!;return Math.hypot(p.x-previous.x,p.y-previous.y)>1e-8;});
  const corners=points.filter((p,i)=>{const a=points[(i+points.length-1)%points.length]!,b=points[(i+1)%points.length]!;
    const ux=p.x-a.x,uy=p.y-a.y,vx=b.x-p.x,vy=b.y-p.y;
    return Math.abs(ux*vy-uy*vx)>1e-8||ux*vx+uy*vy<=0;});
  if(corners.length<3)throw new Error('Degenerate shore outline');
  const lengths=corners.map((p,i)=>{const next=corners[(i+1)%corners.length]!;return Math.hypot(next.x-p.x,next.y-p.y);});
  const maxCleanRunPx=Math.max(...lengths),perimeterPx=lengths.reduce((sum,n)=>sum+n,0),longRuns=lengths.filter(n=>n>limitPx);
  return{accepted:maxCleanRunPx<=limitPx,limitPx,maxCleanRunPx,perimeterPx,longRunCount:longRuns.length,longRunShare:longRuns.reduce((sum,n)=>sum+n,0)/perimeterPx};
}

/** Per-triangle projected bounds conservatively protect the complete source
 * footprint, including relief. Do not replace this with one assembly AABB. */
export function nativeConstructionFootprints(instances:MasterDefinition['instances'],family:MasterDefinition['family'],seed:number):{supportBounds:Rect[];solidPrimitives:NativeSpatialPrimitive[];supportPrimitives:NativeSpatialPrimitive[]} {
  const supportBounds:Rect[]=[],solidPrimitives:NativeSpatialPrimitive[]=[],supportPrimitives:NativeSpatialPrimitive[]=[];
  for(const instance of instances){
    const {role:_role,groundEdgeWidth:_groundEdgeWidth,...source}=instance;
    const mesh=buildNativeVolume({...source,family:instance.family??family,blocking:instance.role==='solid'?1:0,seed:seed^Math.imul(instance.id,104729)});
    for(let face=0;face<mesh.triangleCount;face++){
      const p:number[]=[];for(let corner=0;corner<3;corner++){const at=mesh.indices[face*3+corner]!*3;p.push(mesh.positions[at]!,mesh.positions[at+1]!);}
      if(Math.abs((p[2]!-p[0]!)*(p[5]!-p[1]!)-(p[3]!-p[1]!)*(p[4]!-p[0]!))<=1e-7)continue;
      const x=Math.min(p[0]!,p[2]!,p[4]!),y=Math.min(p[1]!,p[3]!,p[5]!);
      supportBounds.push([x,y,Math.max(p[0]!,p[2]!,p[4]!)-x,Math.max(p[1]!,p[3]!,p[5]!)-y]);
      const primitive=nativePrimitive(p,instance.id);supportPrimitives.push(primitive);
      if(instance.role==='solid')solidPrimitives.push(primitive);
    }
  }return{supportBounds,solidPrimitives,supportPrimitives};
}
const overlaps=(a:readonly number[],b:readonly number[]):boolean=>a[0]!<b[0]!+b[2]!&&a[0]!+a[2]!>b[0]!&&a[1]!<b[1]!+b[3]!&&a[1]!+a[3]!>b[1]!;
const normal=(shore:Shore):readonly [number,number]=>shore.direction===0?[-1,0]:shore.direction===1?[1,0]:shore.direction===2?[0,-1]:[0,1];

/** Only the new raw strip is sampled. Filled H rectangles and real S triangles
 * provide distance; shore, joins, relief and protection rectangles provide none.
 * The distance is 1-Lipschitz, so an 8px cell adds its half diagonal. Final free
 * edges still require the normal geometry gates after the single compilation. */
export function nativeConstructionAddedCoverage(strip:readonly [number,number,number,number],tree:NativeSpatialBvh,limit:number):NonNullable<NativeConstructionShoreTrial['addedCoverage']>{
  let maxDistanceUpperPx=0,checkedCells=0,worstPoint:{x:number;y:number}|null=null;
  for(let y=strip[1]+4;y<strip[1]+strip[3];y+=8)for(let x=strip[0]+4;x<strip[0]+strip[2];x+=8){
    const distance=nativePrimitiveDistance(tree,x,y)+COVER_CELL_CORNER_ERROR;checkedCells++;
    if(distance>maxDistanceUpperPx){maxDistanceUpperPx=distance;worstPoint={x,y};}
  }
  return{accepted:checkedCells>0&&maxDistanceUpperPx<=limit,checkedCells,maxDistanceUpperPx,worstPoint};
}

/** Flood compressed empty cells once, excluding any enclosed positive-union
 * cavity. Merge collinear exterior pieces before dividing them into steps. */
function originalExterior(land:readonly Rect[],frame:readonly [number,number]):Shore[]{
  const xs=[...new Set([-8,frame[0]+8,...land.flatMap(r=>[r[0],r[0]+r[2]])])].sort((a,b)=>a-b),ys=[...new Set([-8,frame[1]+8,...land.flatMap(r=>[r[1],r[1]+r[3]])])].sort((a,b)=>a-b),cols=xs.length-1,rows=ys.length-1;
  const empty=new Uint8Array(cols*rows),exterior=new Uint8Array(cols*rows),queue:number[]=[0];
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){const px=(xs[x]!+xs[x+1]!)/2,py=(ys[y]!+ys[y+1]!)/2;empty[y*cols+x]=Number(!land.some(r=>px>r[0]&&px<r[0]+r[2]&&py>r[1]&&py<r[1]+r[3]));}
  exterior[0]=1;for(let at=0;at<queue.length;at++){const cell=queue[at]!,x=cell%cols,y=Math.floor(cell/cols);for(const [dx,dy]of [[-1,0],[1,0],[0,-1],[0,1]]){const nx=x+dx!,ny=y+dy!,next=ny*cols+nx;if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&empty[next]&&!exterior[next]){exterior[next]=1;queue.push(next);}}}
  const grouped=new Map<string,Shore[]>();
  for(const shore of nativeSpatialExposedShore(land)){
    const [nx,ny]=normal(shore),x=(shore.x1+shore.x2)/2+nx*.5,y=(shore.y1+shore.y2)/2+ny*.5;
    const col=xs.findIndex((v,i)=>x>v&&x<xs[i+1]!),row=ys.findIndex((v,i)=>y>v&&y<ys[i+1]!);
    if(col<0||row<0||!exterior[row*cols+col])continue;
    const key=`${shore.direction}:${shore.direction<2?shore.x1:shore.y1}`,list=grouped.get(key)??[];list.push(shore);grouped.set(key,list);
  }
  const result:Shore[]=[];
  for(const list of grouped.values()){
    list.sort((a,b)=>a.direction<2?a.y1-b.y1:a.x1-b.x1);let merged=list[0]!;
    for(const next of list.slice(1)){if(merged.x2===next.x1&&merged.y2===next.y1)merged={...merged,x2:next.x2,y2:next.y2};else{result.push(merged);merged=next;}}result.push(merged);
  }
  return result.sort((a,b)=>a.direction-b.direction||a.y1-b.y1||a.x1-b.x1);
}

export function constructNativeMacroShore(input:NativeConstructionShoreInput,policy:NativeConstructionShorePolicy):NativeConstructionShoreResult {
  const {land,frame,seed}=input,originalShore=originalExterior(land,frame),additions:Rect[]=[],cuts:Rect[]=[],trials:NativeConstructionShoreTrial[]=[];
  const baseShore=input.seedLand?originalExterior(input.seedLand,frame):undefined;
  if(!Number.isFinite(input.maxAddedCoverDistancePx)||input.maxAddedCoverDistancePx<=0)throw new Error('Shore addition requires the frozen maximum open-distance limit');
  const coverTree=nativePrimitiveTree(input.coverPrimitives);
  const guards=[...input.protectedRects,...input.supportBounds].map(r=>[r[0]-policy.protectedGapPx,r[1]-policy.protectedGapPx,r[2]+2*policy.protectedGapPx,r[3]+2*policy.protectedGapPx] as Rect);
  const pick=(key:string,min:number,max:number)=>min+8*(mix32(seed,key)%((max-min)/8+1));
  for(const [sourceEdge,shore]of originalShore.entries()){
    const vertical=shore.direction<2,[nx,ny]=normal(shore),axis=vertical?shore.x1:shore.y1,begin=vertical?shore.y1:shore.x1,end=vertical?shore.y2:shore.x2;
    const baseIndex=baseShore?.findIndex(bank=>bank.direction===shore.direction&&bank.x1===shore.x1&&bank.y1===shore.y1&&bank.x2===shore.x2&&bank.y2===shore.y2)??-1;
    const shift=input.seedTranslation??{x:0,y:0};
    const randomKey=!baseShore?`shore-${sourceEdge}`:baseIndex>=0?`shore-${baseIndex}`:`extension-shore-${shore.direction}-${shore.x1-shift.x}-${shore.y1-shift.y}-${shore.x2-shift.x}-${shore.y2-shift.y}`;
    const phase=mix32(seed,`${randomKey}-phase`)%2;let segment=0;
    // Cover the entire source edge. An unconditional 8px end margin leaves
    // needle-like land fins where a step meets the neighbouring source edge.
    for(let start=begin;start<end;segment++){
      const sampledLength=Math.min(pick(`${randomKey}-${segment}-length`,policy.segmentMinPx,policy.segmentMaxPx),end-start);
      // Fold a short tail into this step rather than leaving a thin spur at
      // the corner. The merged final step may exceed segmentMaxPx.
      const remainder=end-start-sampledLength;
      const length=remainder>0&&remainder<policy.segmentMinPx?end-start:sampledLength,mode=(['cut','add'] as const)[(phase+segment)%2]!;
      const requestedDepth=pick(`${randomKey}-${segment}-depth`,policy.depthMinPx,policy.depthMaxPx),base={sourceEdge,startPx:start,lengthPx:length,mode,requestedDepthPx:requestedDepth};
      if(length<policy.segmentMinPx){trials.push({...base,actualDepthPx:0,reason:'short-remainder'});start+=length;continue;}
      const sign=(vertical?nx:ny)*(mode==='cut'?-1:1),tangentEnd=start+length;
      const inset=mode==='add'?NATIVE_CONSTRUCTION_FRAME_INSET_PX:0;
      let depth=Math.min(requestedDepth,sign>0?(vertical?frame[0]:frame[1])-axis-inset:axis-inset);
      const obstacles=mode==='cut'?guards:land;
      for(const r of obstacles){
        const low=vertical?r[1]:r[0],high=low+(vertical?r[3]:r[2]);if(high<=start||low>=tangentEnd)continue;
        const n0=(vertical?r[0]:r[1])-axis,n1=n0+(vertical?r[2]:r[3]),near=sign>0?n0:-n1,far=sign>0?n1:-n0;
        if(far<=0)continue;depth=Math.min(depth,Math.max(0,near-(mode==='add'?policy.protectedGapPx:0)));
      }
      depth=Math.floor(depth/8)*8;
      if(depth<policy.depthMinPx){trials.push({...base,actualDepthPx:0,reason:'protected-or-frame-depth'});start+=length;continue;}
      const strip:Rect=vertical?[sign>0?axis:axis-depth,start,depth,length]:[start,sign>0?axis:axis-depth,length,depth];
      if(mode==='add'&&(strip[0]<inset||strip[1]<inset||strip[0]+strip[2]>frame[0]-inset||strip[1]+strip[3]>frame[1]-inset)){trials.push({...base,actualDepthPx:0,reason:'frame-inset'});start+=length;continue;}
      const overlapArea=nativeRectUnionArea([...land,strip])-nativeRectUnionArea(land);
      if(Math.abs(overlapArea-(mode==='cut'?0:depth*length))>1e-7){trials.push({...base,actualDepthPx:0,reason:'crosses-original-shore'});start+=length;continue;}
      const addedCoverage=mode==='add'?nativeConstructionAddedCoverage(strip,coverTree,input.maxAddedCoverDistancePx):undefined;
      if(addedCoverage&&!addedCoverage.accepted){trials.push({...base,actualDepthPx:0,reason:'added-land-cover-distance',addedCoverage});start+=length;continue;}
      // Extend across the bank, clamping the overlap when the bank is on frame.
      const rect:Rect=vertical?[sign>0?axis-8:axis-depth,start,depth+8,length]:[start,sign>0?axis-8:axis-depth,length,depth+8];
      const x=Math.max(0,rect[0]),y=Math.max(0,rect[1]),right=Math.min(frame[0],rect[0]+rect[2]),bottom=Math.min(frame[1],rect[1]+rect[3]);rect[0]=x;rect[1]=y;rect[2]=right-x;rect[3]=bottom-y;
      if([...additions,...cuts].some(previous=>overlaps(previous,rect))){trials.push({...base,actualDepthPx:0,reason:'overlaps-earlier-step'});start+=length;continue;}
      (mode==='cut'?cuts:additions).push(rect);trials.push({...base,actualDepthPx:depth,rect,...(addedCoverage?{addedCoverage}:{})});start+=length;
    }
  }
  return{algorithm:policy.algorithm,sourceHash:policy.sourceHash,originalShore,additions,cuts,trials};
}
