/** Bounded joint packing from source material and shared policy. Every object
 * exists before packing begins; a failed fit never silently removes content. */
import {mix32} from '@/generation/seed-fork';
import {nativeConstructionFootprints,constructNativeMacroShore} from './native-spatial-construction-shore';
import {nativeAutoCounts} from './native-auto-counts';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance,type NativeSpatialPrimitive,type NativeSpatialBvh} from './native-spatial-geometry';
import {createNativeSpatialPlanningGround,nativeSpatialLandJoins} from './native-spatial-bay-layout';
import type {NativeSpatialHoleProfile} from './native-spatial-types';
import {NATIVE_CONSTRUCTION_REFERENCE_COLUMNS,type NativeSpatialConstructionReference} from './native-spatial-construction-reference';
import type {MasterDefinition} from './r100-master-world';
import type {NativeAutoRuntimeInput,NativeAutoRect as Rect} from './native-auto-types';
import {refineNativeAutoPlan,nativeAutoObjectDistance,type NativeAutoCoverageObject,type NativeAutoRefinementTrace} from './native-auto-refinement';
import {nativeAutoCompiledField} from './native-auto-shape';
type Row=NativeSpatialConstructionReference['rows'][number];
interface Site {readonly x:number;readonly y:number;readonly rank:number;readonly sourceDistance:number}
interface PlannedObject extends NativeAutoCoverageObject {readonly id:string;readonly row:Partial<Row>}
const snap=(value:number)=>Math.round(value/8)*8;
const overlaps=(a:Rect,b:Rect,gap=0)=>a[0]<b[0]+b[2]+gap&&a[0]+a[2]>b[0]-gap&&a[1]<b[1]+b[3]+gap&&a[1]+a[3]>b[1]-gap;
const shifted=(rect:Rect,site:Pick<Site,'x'|'y'>):Rect=>[rect[0]+site.x,rect[1]+site.y,rect[2],rect[3]];
function bounds(rectangles:readonly Rect[]):Rect {
  const x=Math.min(...rectangles.map(r=>r[0])),y=Math.min(...rectangles.map(r=>r[1]));
  return[x,y,Math.max(...rectangles.map(r=>r[0]+r[2]))-x,Math.max(...rectangles.map(r=>r[1]+r[3]))-y];
}
function insideLand(rect:Rect,land:readonly Rect[],gap:number):boolean {
  const left=Math.floor((rect[0]-gap)/8)*8,top=Math.floor((rect[1]-gap)/8)*8;
  const right=Math.ceil((rect[0]+rect[2]+gap)/8)*8,bottom=Math.ceil((rect[1]+rect[3]+gap)/8)*8;
  for(let y=top;y<=bottom;y+=8)for(let x=left;x<=right;x+=8)
    if(!land.some(r=>x>=r[0]&&x<=r[0]+r[2]&&y>=r[1]&&y<=r[1]+r[3]))return false;
  return true;
}

export interface NativeAutoPlan {
  readonly reference:NativeSpatialConstructionReference;
  readonly siteEvaluations:number;readonly feasibleSites:number;
  readonly placementStates:number;readonly backtracks:number;
  readonly refinement:NativeAutoRefinementTrace;
  readonly requestedCounts:Readonly<{holes:number;solids:number}>;
}

/** Sample an offset rectangle union before assigning its position. Thick
 * overlapping rectangles retain a useful core through the edge compiler. */
export function nativeAutoHole(index:number,seed:number,profiles:readonly NativeSpatialHoleProfile[]):PlannedObject {
  const random=mix32(seed,`automatic-hole-${index}`),small=(random%3)===0;
  const profile=profiles.find(p=>p.sizeClass===(small?'small':'medium'));
  if(!profile)throw new Error('Automatic construction needs shared small and medium hole profiles');
  const firstWidth=small?96:104+8*(random%2),secondWidth=small?96:104+8*((random>>>3)%2);
  const offsetX=small?32:48+8*((random>>>6)%2),offsetY=16+8*((random>>>7)%2);
  const thickness=80;
  let rects:Rect[]=[[0,0,firstWidth,thickness],[offsetX,offsetY,secondWidth,thickness]];
  let box=bounds(rects);
  rects=rects.map(([x,y,w,h]):Rect=>[x-snap(box[2]/2),y-snap(box[3]/2),w,h]);
  if(random&0x400)rects=rects.map(([x,y,w,h]):Rect=>[-x-w,y,w,h]);
  if(random&0x800)rects=rects.map(([x,y,w,h]):Rect=>[y,x,h,w]);
  box=bounds(rects);
  return{id:`void-${index}`,kind:'hole',row:{kind:'hole',id:`void-${index}`,profile_id:profile.id},rects,bounds:box};
}

export function createNativeAutoPlan(native:MasterDefinition,input:NativeAutoRuntimeInput,checkpoint:()=>void):NativeAutoPlan {
  const {policy:p,nativeSpatial:spatial,geometrySeed:seed}=input,world=spatial.world;
  const rawSource=nativeConstructionFootprints(native.instances,native.family,seed),sourceBox=bounds(rawSource.supportBounds);
  const width=input.intent.coreWidthPx,height=input.intent.coreHeightPx;
  const cx=snap(world.frameWidthPx/2),cy=snap(world.frameHeightPx/2),core:Rect=[cx-width/2,cy-height/2,width,height];
  const side=(mix32(seed,'auto-arm-side')&1)?1:-1;
  const land:Rect[]=[core,
    [core[0]-p.armWidthPx+p.armOverlapPx,snap(cy-p.armHeightPx/2-side*p.armOffsetPx),p.armWidthPx,p.armHeightPx],
    [core[0]+width-p.armOverlapPx,snap(cy-p.armHeightPx/2+side*p.armOffsetPx),p.armWidthPx,p.armHeightPx]];
  const solids=native.instances.filter(instance=>instance.role==='solid');
  const anchorX=solids.reduce((sum,i)=>sum+i.x,0)/solids.length,anchorY=solids.reduce((sum,i)=>sum+i.y,0)/solids.length;
  const assemblyX=snap(cx-sourceBox[0]-sourceBox[2]/2+anchorX),assemblyY=snap(cy-sourceBox[1]-sourceBox[3]/2+anchorY);
  const sourceDx=assemblyX-anchorX,sourceDy=assemblyY-anchorY;
  const source=nativeConstructionFootprints(native.instances.map(instance=>({...instance,x:instance.x+sourceDx,y:instance.y+sourceDy})),native.family,seed);
  const sourceTree=nativePrimitiveTree(source.solidPrimitives),referenceId='automatic-native-layout';
  const rows:Row[]=[],row=(values:Partial<Row>):Row=>({...Object.fromEntries(NATIVE_CONSTRUCTION_REFERENCE_COLUMNS.map(key=>[key,''])),
    reference_id:referenceId,world_id:input.worldId,grade:input.grade,seed:String(seed),seed_salt:'0',...values}) as Row;
  land.forEach(([x,y,w,h],index)=>rows.push(row({kind:'land',id:`land-${index}`,profile_id:index?'shoulder':'core',
    x_px:String(x),y_px:String(y),width_px:String(w),height_px:String(h),parent_id:index?'land-0':''})));
  rows.push(row({kind:'assembly',id:'source-whole',profile_id:'source-whole',x_px:String(assemblyX),y_px:String(assemblyY),scale:'1',rotation_rad:'0'}));
  const left=land[1]!,spawn={x:left[0]+p.edgeClearancePx,y:snap(left[1]+left[3]/2)};
  const reserved:Rect[]=[[spawn.x-40,spawn.y-40,80,80]];
  rows.push(row({kind:'spawn',id:'arrival',x_px:String(spawn.x),y_px:String(spawn.y)}));
  const requestedCounts=nativeAutoCounts(world.targetWalkAreaPx2,spatial.policy);
  const objects:PlannedObject[]=[],nextId=Math.max(...native.instances.map(i=>i.id))+1;
  for(let index=0;index<requestedCounts.solids-1;index++){
    const profile=spatial.subordinateProfiles[index%spatial.subordinateProfiles.length];
    if(!profile)throw new Error('Automatic source has no shared subordinate material profile');
    const instance:MasterDefinition['instances'][number]={id:nextId+index,role:'solid',family:profile.family,
      constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile,x:0,y:0,
      length:snap((profile.minLengthPx+profile.maxLengthPx)/2),width:snap((profile.minWidthPx+profile.maxWidthPx)/2),
      height:(profile.minHeightPx+profile.maxHeightPx)/2,rotation:world.materialAxisRad+profile.rotationOffsetRad,
      thickness:profile.thicknessPx,fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion};
    const footprint=nativeConstructionFootprints([instance],native.family,seed);
    objects.push({id:`subordinate-${index}`,kind:'solid',rects:[],bounds:bounds(footprint.supportBounds),tree:nativePrimitiveTree(footprint.solidPrimitives),row:{kind:'solid',id:`subordinate-${index}`,profile_id:profile.id,
      length_px:String(instance.length),width_px:String(instance.width),height_px:String(instance.height),rotation_rad:String(instance.rotation)}});
  }
  for(let index=0;index<requestedCounts.holes;index++)objects.push(nativeAutoHole(index,seed,spatial.holeProfiles));
  const order=objects.map((_,index)=>index).sort((a,b)=>{
    const first=objects[a]!,second=objects[b]!;
    return Number(first.kind==='hole')-Number(second.kind==='hole')||second.bounds[2]*second.bounds[3]-first.bounds[2]*first.bounds[3]||a-b;
  });
  const sites:Site[]=[];let siteEvaluations=0;
  for(let y=p.edgeClearancePx;y<world.frameHeightPx;y+=p.siteSpacingPx)for(let x=p.edgeClearancePx;x<world.frameWidthPx;x+=p.siteSpacingPx){
    if(++siteEvaluations>p.maxSiteEvaluations)throw new Error('Automatic site domain exceeds frozen work budget');
    checkpoint();
    const rank=mix32(seed,`auto-site:${x}:${y}`),jitter=(n:number)=>snap((n/65535*2-1)*p.siteJitterPx);
    const px=x+jitter(rank&65535),py=y+jitter(rank>>>16);
    if(land.some(r=>px>=r[0]&&px<=r[0]+r[2]&&py>=r[1]&&py<=r[1]+r[3]))
      sites.push({x:px,y:py,rank,sourceDistance:nativePrimitiveDistance(sourceTree,px,py)});
  }
  const domains=objects.map(object=>sites.map((site,index)=>({site,index,box:shifted(object.bounds,site)}))
    .filter(({box})=>insideLand(box,land,p.edgeClearancePx)&&!source.supportBounds.some(r=>overlaps(box,r,p.objectClearancePx))&&!reserved.some(r=>overlaps(box,r,p.objectClearancePx))));
  const ground=createNativeSpatialPlanningGround(land,[]);
  const field=sites.map(site=>({...site,margin:ground.margin(site)})).filter(site=>site.margin>=20&&site.sourceDistance>=20);
  const covered=nativeAutoObjectDistance;
  const chosen=new Map<number,number>(),occupied:Rect[]=[];
  let placementStates=0,backtracks=0,deepest=0;
  const place=(depth:number):boolean=>{
    checkpoint();deepest=Math.max(deepest,depth);
    if(depth===order.length)return true;
    if(placementStates>=p.maxPlacementStates)return false;
    const objectIndex=order[depth]!;
    const structural=field.map(point=>Math.min(point.sourceDistance,...[...chosen].map(([index,site])=>covered(objects[index]!,sites[site]!,point))));
    const optical=field.map(point=>Math.min(point.margin,...[...chosen].filter(([index])=>objects[index]!.kind==='hole').map(([index,site])=>covered(objects[index]!,sites[site]!,point))));
    const ranked=domains[objectIndex]!.filter(candidate=>!occupied.some(r=>overlaps(candidate.box,r,p.objectClearancePx)))
      .map(candidate=>{
        let maximum=0,sum=0;
        for(let index=0;index<field.length;index++){
          const point=field[index]!,distance=covered(objects[objectIndex]!,candidate.site,point);
          const structuralDistance=Math.min(structural[index]!,distance),voidDistance=objects[objectIndex]!.kind==='hole'?Math.min(optical[index]!,distance):optical[index]!;
          const open=Math.min(structuralDistance,point.margin),openCost=open/spatial.policy.maxEmptyRadiusPx;
          const opticalCost=voidDistance/spatial.policy.referenceSightPx;
          maximum=Math.max(maximum,openCost,opticalCost);
          sum+=Math.max(0,structuralDistance-spatial.policy.deepEmptyThresholdPx)**2+Math.max(0,voidDistance-spatial.policy.referenceSightPx)**2;
        }
        return{...candidate,maximum,sum};
      })
      .sort((a,b)=>a.maximum-b.maximum||a.sum-b.sum||a.site.rank-b.site.rank);
    for(const candidate of ranked.slice(0,p.placementBranchLimit)){
      if(placementStates>=p.maxPlacementStates)break;
      placementStates++;chosen.set(objectIndex,candidate.index);occupied.push(candidate.box);
      if(place(depth+1))return true;
      occupied.pop();chosen.delete(objectIndex);backtracks++;
    }
    return false;
  };
  if(!place(0))throw new Error(`Automatic packing rejected: ${deepest}/${objects.length} placed; ${placementStates}/${p.maxPlacementStates} states, ${siteEvaluations} sites`);
  // Each fixed phase receives local alternatives at its current positions.
  // All phases share one site budget; moving never loses local resolution.
  const siteKeys=new Set(sites.map(site=>`${site.x}:${site.y}`));
  const addLocalSites=(step:number)=>{
  const centers=[...chosen.values()].map(index=>sites[index]!);
  for(const center of centers)for(const dx of [-2*step,-step,0,step,2*step])for(const dy of [-2*step,-step,0,step,2*step]){
    if(!dx&&!dy)continue;
    const x=center.x+dx,y=center.y+dy,key=`${x}:${y}`;if(siteKeys.has(key))continue;
    if(siteEvaluations>=p.maxSiteEvaluations)break;
    siteEvaluations++;siteKeys.add(key);
    const site={x,y,rank:mix32(seed,`auto-local:${x}:${y}`),sourceDistance:nativePrimitiveDistance(sourceTree,x,y)},index=sites.length;
    sites.push(site);
    objects.forEach((object,objectIndex)=>{
      const box=shifted(object.bounds,site);
      if(insideLand(box,land,p.edgeClearancePx)&&!source.supportBounds.some(r=>overlaps(box,r,p.objectClearancePx))&&!reserved.some(r=>overlaps(box,r,p.objectClearancePx)))
        domains[objectIndex]!.push({site,index,box});
    });
  }
  };
  const flatten=(tree:NativeSpatialBvh):readonly NativeSpatialPrimitive[]=>tree.items??[...(tree.left?flatten(tree.left):[]),...(tree.right?flatten(tree.right):[])];
  const phases:NativeAutoRefinementTrace[]=[];
  for(let phase=0;phase<p.refinementPasses;phase++){
  addLocalSites(phase===p.refinementPasses-1?8:16);
  const holeRects=objects.flatMap((object,index)=>object.kind==='hole'?object.rects.map(rect=>shifted(rect,sites[chosen.get(index)!]!)):[]);
  const extraSolidPrimitives=objects.flatMap((object,index)=>{
    if(object.kind!=='solid')return[];
    const site=sites[chosen.get(index)!]!;
    return flatten(object.tree!).map(primitive=>nativePrimitive(primitive.points.map((v,at)=>v+(at%2?site.y:site.x)),primitive.objectId));
  });
  const shore=constructNativeMacroShore({land,protectedRects:[...holeRects,...nativeSpatialLandJoins(land,world.landRectMinOverlapPx,[null,0,0]).map(join=>join.rect),[spawn.x-10,spawn.y-10,20,20]],
    supportBounds:[...source.supportBounds,...extraSolidPrimitives.map((primitive):Rect=>[primitive.minX,primitive.minY,primitive.maxX-primitive.minX,primitive.maxY-primitive.minY])],
    coverPrimitives:[...source.solidPrimitives,...extraSolidPrimitives,...holeRects.flatMap(([x,y,w,h])=>[nativePrimitive([x,y,x+w,y,x+w,y+h],-1),nativePrimitive([x,y,x+w,y+h,x,y+h],-1)])],
    maxAddedCoverDistancePx:spatial.policy.maxEmptyRadiusPx,frame:[world.frameWidthPx,world.frameHeightPx],seed},
  {referenceId,algorithm:'macro-shore-step-v1',sourceHash:p.sourceHash,segmentMinPx:p.shoreSegmentMinPx,segmentMaxPx:p.shoreSegmentMaxPx,
    depthMinPx:p.shoreDepthMinPx,depthMaxPx:p.shoreDepthMaxPx,protectedGapPx:p.shoreProtectedGapPx,maxCleanRunPx:p.maxCleanRunPx});
  const finalPhase=phase===p.refinementPasses-1,holeObjects=objects.map((object,index)=>({object,index})).filter(({object})=>object.kind==='hole');
  const compiled=finalPhase?nativeAutoCompiledField([...land,...shore.additions],
    holeObjects.map(({object,index})=>object.rects.map(rect=>shifted(rect,sites[chosen.get(index)!]!))),shore.cuts,
    holeObjects.map(({index})=>sites[chosen.get(index)!]!),[world.frameWidthPx,world.frameHeightPx],seed,p.sourceHash):undefined;
  const measuredObjects=objects.map((object,index)=>object.kind==='hole'&&compiled?
    {...object,coverageRects:compiled.holeRects[holeObjects.findIndex(hole=>hole.index===index)]}:object);
  phases.push(refineNativeAutoPlan(measuredObjects,sites,domains.map(domain=>domain.map(candidate=>candidate.index)),chosen,
    [...land,...shore.additions],sourceTree,{...spatial.policy,minWideRatio:p.targetWidePercent/100},
    {...p,refinementPasses:1,maxRefinementEvaluations:Math.floor(p.maxRefinementEvaluations/p.refinementPasses)},checkpoint,shore.cuts,finalPhase?8:16,compiled?.ground));
  }
  const refinement:NativeAutoRefinementTrace={
    evaluations:phases.reduce((sum,phase)=>sum+phase.evaluations,0),acceptedMoves:phases.reduce((sum,phase)=>sum+phase.acceptedMoves,0),
    acceptedSwaps:phases.reduce((sum,phase)=>sum+phase.acceptedSwaps,0),acceptedJointMoves:phases.reduce((sum,phase)=>sum+phase.acceptedJointMoves,0),
    completedPasses:phases.length,before:phases[0]!.before,after:phases[phases.length-1]!.after};
  // Compiler assigns IDs in row order, so preserve the same order used for
  // each generated solid's seeded projected footprint.
  objects.forEach((object,index)=>{
    const site=sites[chosen.get(index)!]!;
    rows.push(row({...object.row,x_px:String(site.x),y_px:String(site.y),
      ...(object.kind==='hole'?{rects:object.rects.map(rect=>shifted(rect,site).join(':')).join('|')}:{})}));
  });
  return{reference:{id:referenceId,worldId:input.worldId,grade:input.grade,seed,seedSalt:0,sourceHash:p.sourceHash,rows},
    siteEvaluations,feasibleSites:sites.length,placementStates,backtracks,refinement,requestedCounts};
}
