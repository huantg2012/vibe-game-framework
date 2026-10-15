/** DEV-only coherent secondary land. Finite raw proposals precede the single
 * fragment compile; neither raster repair nor the r12 search runs here. */
import {mix32} from '@/generation/seed-fork';
import type {MasterDefinition} from './r100-master-world';
import type {NativeSpatialPolicy} from './native-spatial-types';
import type {NativeSpatialHolePlacement,NativeSpatialAssemblyPlacement} from './native-spatial-structures';
import {nativeRectUnionArea,nativeSpatialExposedShore,type NativeSpatialLandRect as Rect,type NativeSpatialLandShore} from './native-spatial-land';
import {createNativeSpatialPlanningGround} from './native-spatial-bay-layout';
import {nativeSpatialPlacementRejections,type NativeSpatialJointObject} from './native-spatial-joint-refinement';
import {nativeConstructionFootprints} from './native-spatial-construction-shore';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialPrimitive} from './native-spatial-geometry';

type Instance=MasterDefinition['instances'][number];
type Point=Readonly<{x:number;y:number}>;
export const NATIVE_CONSTRUCTION_EXTENSION_COLUMNS=['id','algorithm','slots','span_min_px','span_max_px','outward_min_px','outward_max_px','inset_px','offset_min_px','offset_max_px','min_gap_px','max_growth_ratio','candidate_budget','frame_margin_px','max_added_holes','max_added_solids','hole_profile_ids','solid_profile_mode'] as const;
export interface NativeConstructionExtensionProfile {
  readonly id:string;readonly slots:number;readonly spanMinPx:number;readonly spanMaxPx:number;readonly outwardMinPx:number;readonly outwardMaxPx:number;
  readonly insetPx:number;readonly offsetMinPx:number;readonly offsetMaxPx:number;
}
export interface NativeConstructionExtensionPolicy {
  readonly algorithm:'coherent-extension-v1';readonly sourceHash:string;readonly profiles:readonly NativeConstructionExtensionProfile[];
  readonly minGapPx:number;readonly maxGrowthRatio:number;readonly candidateBudget:number;readonly frameMarginPx:number;
  readonly maxAddedHoles:number;readonly maxAddedSolids:number;readonly holeProfileIds:readonly string[];readonly solidProfileMode:'existing-subordinate';
}
export interface NativeConstructionExtensionTrial {
  readonly slot:number;readonly profileId:string;readonly parentIndex:number;readonly direction:number;readonly rect:Rect;
  readonly spanPx:number;readonly outwardPx:number;readonly addedAreaPx2:number;readonly accepted:boolean;readonly reasons:readonly string[];
  readonly newHoleIds?:readonly string[];readonly newAssemblyId?:string;readonly maxAddedOpenRadiusUpperPx?:number;
}
export interface NativeConstructionExtensionResult {
  readonly algorithm:'coherent-extension-v1';readonly sourceHash:string;readonly trials:readonly NativeConstructionExtensionTrial[];
  readonly additions:readonly Readonly<{rect:Rect;parentIndex:number;profileId:string}>[];
  readonly holes:readonly NativeSpatialHolePlacement[];readonly solids:readonly Readonly<{site:Point;instances:readonly Instance[];assembly:NativeSpatialAssemblyPlacement}>[];
  readonly addedLandAreaPx2:number;readonly addedHoleAreaPx2:number;readonly addedSolidAreaLowerPx2:number;
  readonly translation:Point;readonly frameBefore:readonly [number,number];readonly frameAfter:readonly [number,number];
}
export interface NativeConstructionExtensionInput {
  readonly land:readonly Rect[];readonly holes:readonly NativeSpatialHolePlacement[];readonly instances:readonly Instance[];
  readonly solidTemplates:readonly Readonly<{id:string;instances:readonly Instance[]}>[];readonly family:MasterDefinition['family'];
  readonly spawn:Point;readonly protectedRects:readonly Rect[];readonly frame:readonly [number,number];readonly seed:number;readonly placementSeed?:number;readonly spatialPolicy:NativeSpatialPolicy;
}
export function parseNativeConstructionExtensionPolicy(csv:string,sourceHash:string):NativeConstructionExtensionPolicy {
  const lines=csv.replace(/^\uFEFF/,'').trim().split(/\r?\n/);if(lines.shift()!==NATIVE_CONSTRUCTION_EXTENSION_COLUMNS.join(',')||!lines.length||!/^[0-9a-f]{64}$/.test(sourceHash))throw new Error('Invalid extension policy header or source');
  const rows=lines.map(line=>line.split(',').map(value=>value.trim()));
  if(rows.some(row=>row.length!==18||row.some(value=>!value||value.includes('"'))||row[1]!=='coherent-extension-v1'||row[17]!=='existing-subordinate'))throw new Error('Invalid extension policy row');
  const first=rows[0]!,shared=[10,11,12,13,14,15,16,17];
  if(rows.some(row=>shared.some(column=>row[column]!==first[column])))throw new Error('Extension profiles must share one total budget');
  const number=(row:readonly string[],index:number)=>{const value=Number(row[index]);if(!Number.isFinite(value)||value<=0)throw new Error('Invalid extension policy number');return value;};
  const integer=(row:readonly string[],index:number)=>{const value=number(row,index);if(!Number.isSafeInteger(value))throw new Error('Invalid extension policy integer');return value;};
  const distance=(row:readonly string[],index:number)=>{const value=integer(row,index);if(value%8)throw new Error('Extension distances must be 8px multiples');return value;};
  const profiles=rows.map(row=>{if(!/^[a-z][a-z0-9-]*$/.test(row[0]!))throw new Error('Invalid extension profile id');return{id:row[0]!,slots:integer(row,2),spanMinPx:distance(row,3),spanMaxPx:distance(row,4),outwardMinPx:distance(row,5),outwardMaxPx:distance(row,6),insetPx:distance(row,7),offsetMinPx:distance(row,8),offsetMaxPx:distance(row,9)};});
  if(new Set(profiles.map(profile=>profile.id)).size!==profiles.length||profiles.some(profile=>profile.spanMinPx>profile.spanMaxPx||profile.outwardMinPx>profile.outwardMaxPx||profile.offsetMinPx>profile.offsetMaxPx||profile.insetPx<320||profile.spanMinPx<320))throw new Error('Invalid extension ranges or wide overlap');
  const policy:NativeConstructionExtensionPolicy={algorithm:'coherent-extension-v1',sourceHash,profiles,minGapPx:distance(first,10),maxGrowthRatio:number(first,11),candidateBudget:integer(first,12),frameMarginPx:distance(first,13),maxAddedHoles:integer(first,14),maxAddedSolids:integer(first,15),holeProfileIds:first[16]!.split('|'),solidProfileMode:'existing-subordinate'};
  if(policy.maxGrowthRatio>1||policy.candidateBudget>64||profiles.reduce((sum,profile)=>sum+profile.slots,0)>policy.maxAddedSolids||policy.maxAddedHoles!==2*policy.maxAddedSolids)throw new Error('Invalid extension total budget');
  return policy;
}
const snap=(value:number)=>Math.round(value/8)*8;
const rectPrimitives=(rects:readonly (readonly number[])[],id:number):NativeSpatialPrimitive[]=>rects.flatMap(([x=0,y=0,w=0,h=0])=>[nativePrimitive([x,y,x+w,y,x+w,y+h],id),nativePrimitive([x,y,x+w,y+h,x,y+h],id)]);
const overlap=(a:readonly number[],b:readonly number[])=>Math.max(0,Math.min(a[0]!+a[2]!,b[0]!+b[2]!)-Math.max(a[0]!,b[0]!))*Math.max(0,Math.min(a[1]!+a[3]!,b[1]!+b[3]!)-Math.max(a[1]!,b[1]!));
const expand=(r:readonly number[],gap:number):Rect=>[r[0]!-gap,r[1]!-gap,r[2]!+gap*2,r[3]!+gap*2];
const worldPrimitives=(object:NativeSpatialJointObject)=>object.blocking.map(p=>nativePrimitive(p.points.map((value,index)=>value+(index%2?object.site.y:object.site.x)),p.objectId));
function placedObject(id:string,kind:'hole'|'solid',primitives:readonly NativeSpatialPrimitive[]):NativeSpatialJointObject {
  const site={x:snap((Math.min(...primitives.map(p=>p.minX))+Math.max(...primitives.map(p=>p.maxX)))/2),y:snap((Math.min(...primitives.map(p=>p.minY))+Math.max(...primitives.map(p=>p.maxY)))/2)};
  const local=primitives.map(p=>nativePrimitive(p.points.map((value,index)=>value-(index%2?site.y:site.x)),p.objectId));return{id,kind,site,support:local,blocking:local,relief:[]};
}
function mergedShore(land:readonly Rect[]):NativeSpatialLandShore[]{
  const groups=new Map<string,NativeSpatialLandShore[]>();
  for(const edge of nativeSpatialExposedShore(land)){const key=`${edge.parent}:${edge.direction}:${edge.direction<2?edge.x1:edge.y1}`,list=groups.get(key)??[];list.push(edge);groups.set(key,list);}
  const result:NativeSpatialLandShore[]=[];
  for(const list of groups.values()){list.sort((a,b)=>a.y1-b.y1||a.x1-b.x1);let current=list[0]!;for(const next of list.slice(1)){if(current.x2===next.x1&&current.y2===next.y1)current={...current,x2:next.x2,y2:next.y2};else{result.push(current);current=next;}}result.push(current);}return result;
}
/** Conservative input prefilter, not final solid admission: each 2px square
 * must have all four corners inside a single projected triangle. */
function solidAreaLower(primitives:readonly NativeSpatialPrimitive[]):number {
  if(!primitives.length)return 0;const minX=Math.min(...primitives.map(p=>p.minX)),minY=Math.min(...primitives.map(p=>p.minY)),maxX=Math.max(...primitives.map(p=>p.maxX)),maxY=Math.max(...primitives.map(p=>p.maxY));let area=0;
  for(let y=Math.floor(minY/2)*2+1;y<maxY;y+=2)for(let x=Math.floor(minX/2)*2+1;x<maxX;x+=2)if(primitives.some(triangle=>{
    const p=triangle.points;if(x-1<triangle.minX||x+1>triangle.maxX||y-1<triangle.minY||y+1>triangle.maxY)return false;
    return[-1,1].every(dy=>[-1,1].every(dx=>{const px=x+dx,py=y+dy,cross=(i:number,j:number)=>(p[j]!-p[i]!)*(py-p[i+1]!)-(p[j+1]!-p[i+1]!)*(px-p[i]!);const a=cross(0,2),b=cross(2,4),c=cross(4,0);return(a>=-1e-7&&b>=-1e-7&&c>=-1e-7)||(a<=1e-7&&b<=1e-7&&c<=1e-7);}));
  }))area+=4;return area;
}
export function constructNativeConstructionExtensions(input:NativeConstructionExtensionInput,policy:NativeConstructionExtensionPolicy):NativeConstructionExtensionResult {
  const baseArea=nativeRectUnionArea(input.land),additions:{rect:Rect;parentIndex:number;profileId:string}[]=[],holes:NativeSpatialHolePlacement[]=[],solids:{site:Point;instances:Instance[];assembly:NativeSpatialAssemblyPlacement}[]=[],trials:NativeConstructionExtensionTrial[]=[];
  const shore=mergedShore(input.land),usedDirections=new Set<number>(),slots=policy.profiles.flatMap(profile=>Array.from({length:profile.slots},()=>profile));
  const baseFootprints=nativeConstructionFootprints(input.instances,input.family,input.seed),fixed:NativeSpatialJointObject[]=[{id:'existing-complete-sources',kind:'solid',site:{x:0,y:0},support:rectPrimitives(baseFootprints.supportBounds,-1),blocking:baseFootprints.solidPrimitives,relief:[]}];
  for(const hole of input.holes){const p=rectPrimitives(hole.rects,-1);fixed.push({id:hole.holeId,kind:'hole',site:{x:0,y:0},support:p,blocking:p,relief:[]});}
  let nextInstanceId=Math.max(...input.instances.map(instance=>instance.id))+1,addedSolidAreaLowerPx2=0;
  const placementSeed=input.placementSeed??input.seed;
  const pick=(key:string,min:number,max:number)=>min+8*(mix32(placementSeed,key)%((max-min)/8+1));
  for(const [slot,profile]of slots.entries()){
    if(additions.length>=policy.maxAddedSolids||trials.length>=policy.candidateBudget)break;
    const key=`extension-${profile.id}-${slot}`,span=pick(`${key}-span`,profile.spanMinPx,profile.spanMaxPx),depth=pick(`${key}-depth`,profile.outwardMinPx,profile.outwardMaxPx),offset=pick(`${key}-offset`,profile.offsetMinPx,profile.offsetMaxPx)*(mix32(placementSeed,`${key}-side`)%2?1:-1);
    const templateHoles=input.holes.filter(h=>policy.holeProfileIds.includes(h.profileId));if(templateHoles.length<2||!input.solidTemplates.length)throw new Error('Extension requires existing H and subordinate S templates');
    const template=input.solidTemplates[mix32(placementSeed,`${key}-s`)%input.solidTemplates.length]!;
    // Width eligibility is structural, not a tested placement. Offset is the
    // distance from a seeded end of the legal start interval, clamped to it.
    const ranked=shore.filter(edge=>(edge.direction<2?edge.y2-edge.y1:edge.x2-edge.x1)>=span).sort((a,b)=>mix32(placementSeed,`${key}-${a.parent}-${a.direction}-${a.x1}-${a.y1}`)-mix32(placementSeed,`${key}-${b.parent}-${b.direction}-${b.x1}-${b.y1}`));
    const limit=Math.min(policy.candidateBudget,trials.length+Math.floor(policy.candidateBudget/slots.length));
    for(const edge of ranked){if(trials.length>=limit)break;
      const vertical=edge.direction<2,axis=vertical?edge.x1:edge.y1,low=vertical?edge.y1:edge.x1,high=vertical?edge.y2:edge.x2,sign=edge.direction%2?1:-1,offsetFromEnd=Math.min(Math.abs(offset),high-low-span),start=snap(offset<0?low+offsetFromEnd:high-span-offsetFromEnd),centre=start+span/2;
      const rect:Rect=vertical?[sign>0?axis-profile.insetPx:axis-depth,start,profile.insetPx+depth,span]:[start,sign>0?axis-profile.insetPx:axis-depth,span,profile.insetPx+depth];
      const strip:Rect=vertical?[sign>0?axis:axis-depth,start,depth,span]:[start,sign>0?axis:axis-depth,span,depth];
      const trial={slot,profileId:profile.id,parentIndex:edge.parent,direction:edge.direction,rect,spanPx:span,outwardPx:depth,addedAreaPx2:span*depth},reasons:string[]=[];
      if(usedDirections.has(edge.direction))reasons.push('direction-already-used');
      if(start<low||start+span>high)reasons.push('offset-span-outside-original-shore');
      if(overlap(rect,input.land[edge.parent]!)<span*profile.insetPx)reasons.push('wide-parent-overlap');
      const currentLand=[...input.land,...additions.map(a=>a.rect)],added=nativeRectUnionArea([...currentLand,rect])-nativeRectUnionArea(currentLand);
      if(Math.abs(added-span*depth)>1e-6)reasons.push('fills-or-crosses-another-bank');
      if(currentLand.some((r,i)=>i!==edge.parent&&overlap(expand(strip,policy.minGapPx),r)>0))reasons.push('negative-space-bank-gap');
      if(nativeRectUnionArea([...currentLand,rect])-baseArea>baseArea*policy.maxGrowthRatio)reasons.push('area-budget');
      if(reasons.length){trials.push({...trial,accepted:false,reasons});continue;}
      const at=(tangent:number,normal:number):Point=>vertical?{x:snap(axis+sign*normal),y:snap(centre+tangent)}:{x:snap(centre+tangent),y:snap(axis+sign*normal)};
      // Rotate only by a right angle: complete input shape/profile stays intact.
      // The long axis faces outward, leaving two real side lanes in a wide arm.
      const oriented=templateHoles.map(source=>{
        const width=Math.max(...source.rects.map(r=>r[0]+r[2]))-Math.min(...source.rects.map(r=>r[0])),height=Math.max(...source.rects.map(r=>r[1]+r[3]))-Math.min(...source.rects.map(r=>r[1]));
        const rects=(vertical?width<height:height<width)?source.rects.map(([x,y,w,h]):Rect=>[-y-h,x,h,w]):source.rects;
        const x=Math.min(...rects.map(r=>r[0])),y=Math.min(...rects.map(r=>r[1])),right=Math.max(...rects.map(r=>r[0]+r[2])),bottom=Math.max(...rects.map(r=>r[1]+r[3]));
        return{source,rects,cx:snap((x+right)/2),cy:snap((y+bottom)/2),tangent:vertical?bottom-y:right-x,normal:vertical?right-x:bottom-y};
      }).filter(hole=>hole.tangent*2+64+input.spatialPolicy.wideRadiusPx*1.5<=span);
      if(!oriented.length){trials.push({...trial,accepted:false,reasons:['complete-hole-pair-does-not-fit-span']});continue;}
      const chosenHoles=[oriented[mix32(placementSeed,`${key}-h0`)%oriented.length]!,oriented[mix32(placementSeed,`${key}-h1`)%oriented.length]!];
      const newHoles=chosenHoles.map((hole,index):NativeSpatialHolePlacement=>{
        const site=at((index?1:-1)*(span/2-32-hole.tangent/2),depth-hole.normal/2-32);
        return{holeId:`extension-${slot}-hole-${index}`,profileId:hole.source.profileId,rects:hole.rects.map(r=>[r[0]-hole.cx+site.x,r[1]-hole.cy+site.y,r[2],r[3]] as Rect)};
      });
      const site=at(0,depth*.25),instances=template.instances.map((instance,i)=>({...instance,id:nextInstanceId+i})),worldInstances=instances.map(instance=>({...instance,x:instance.x+site.x,y:instance.y+site.y}));
      const footprint=nativeConstructionFootprints(worldInstances,input.family,input.seed),area=solidAreaLower(footprint.solidPrimitives),assembly={assemblyId:`extension-${slot}-solid`,instanceIds:instances.map(instance=>instance.id),maxSpanPx:512};
      if(area<input.spatialPolicy.minSolidAreaPx2)reasons.push('new-solid-effective-area');
      const newObjects:NativeSpatialJointObject[]=newHoles.map(h=>placedObject(h.holeId,'hole',rectPrimitives(h.rects,-1)));
      newObjects.push(placedObject(assembly.assemblyId,'solid',footprint.solidPrimitives));
      const ground=createNativeSpatialPlanningGround([...currentLand,rect],[]),all=[...fixed,...newObjects];
      for(let index=fixed.length;index<all.length;index++)reasons.push(...nativeSpatialPlacementRejections(all,[{index,site:all[index]!.site}],ground,input.spatialPolicy.wideRadiusPx*1.5));
      if(newHoles.some(h=>h.rects.some(r=>input.protectedRects.some(p=>overlap(r,p)>0)||overlap(r,[input.spawn.x-32,input.spawn.y-32,64,64])>0)))reasons.push('protected-reference-region');
      let maxAddedOpenRadiusUpperPx=0;
      if(!reasons.length){const cover=nativePrimitiveTree(all.flatMap(worldPrimitives));for(let y=strip[1]+4;y<strip[1]+strip[3];y+=8)for(let x=strip[0]+4;x<strip[0]+strip[2];x+=8){const radius=Math.min(nativePrimitiveDistance(cover,x,y),ground.margin({x,y}))+4*Math.SQRT2;maxAddedOpenRadiusUpperPx=Math.max(maxAddedOpenRadiusUpperPx,radius);}if(maxAddedOpenRadiusUpperPx>input.spatialPolicy.maxEmptyRadiusPx)reasons.push('new-open-space-radius');}
      const accepted=!reasons.length;trials.push({...trial,accepted,reasons,maxAddedOpenRadiusUpperPx,...(accepted?{newHoleIds:newHoles.map(h=>h.holeId),newAssemblyId:assembly.assemblyId}:{})});
      if(!accepted)continue;
      additions.push({rect,parentIndex:edge.parent,profileId:profile.id});holes.push(...newHoles);solids.push({site,instances,assembly});fixed.push(...newObjects);usedDirections.add(edge.direction);nextInstanceId+=instances.length;addedSolidAreaLowerPx2+=area;break;
    }
  }
  const allLand=[...input.land,...additions.map(a=>a.rect)],minX=Math.min(...allLand.map(r=>r[0])),minY=Math.min(...allLand.map(r=>r[1])),maxX=Math.max(...allLand.map(r=>r[0]+r[2])),maxY=Math.max(...allLand.map(r=>r[1]+r[3]));
  const translation={x:Math.ceil(Math.max(0,policy.frameMarginPx-minX)/32)*32,y:Math.ceil(Math.max(0,policy.frameMarginPx-minY)/32)*32};
  const frameAfter:[number,number]=[Math.max(input.frame[0],Math.ceil((maxX+translation.x+policy.frameMarginPx)/32)*32),Math.max(input.frame[1],Math.ceil((maxY+translation.y+policy.frameMarginPx)/32)*32)];
  return{algorithm:policy.algorithm,sourceHash:policy.sourceHash,trials,additions,holes,solids,addedLandAreaPx2:nativeRectUnionArea(allLand)-baseArea,addedHoleAreaPx2:nativeRectUnionArea(holes.flatMap(h=>h.rects.map(r=>[...r] as Rect))),addedSolidAreaLowerPx2,translation,frameBefore:input.frame,frameAfter};
}
