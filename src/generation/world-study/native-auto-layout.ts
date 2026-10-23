/** Construct source material and H/H/S units around concrete uncovered routes.
 * A selected object is committed only while the whole body graph stays connected. */
import {mix32} from '@/generation/seed-fork';
import {nativeConstructionFootprints,constructNativeMacroShore,type NativeConstructionShoreResult} from './native-spatial-construction-shore';
import {nativePrimitive,nativePrimitiveTree,nativePrimitiveDistance} from './native-spatial-geometry';
import {nativeSpatialLandJoins} from './native-spatial-bay-layout';
import type {NativeSpatialHoleProfile} from './native-spatial-types';
import {NATIVE_CONSTRUCTION_REFERENCE_COLUMNS,type NativeSpatialConstructionReference} from './native-spatial-construction-reference';
import type {MasterDefinition} from './r100-master-world';
import type {NativeAutoRuntimeInput,NativeAutoRect as Rect} from './native-auto-types';
import {nativeAutoObjectDistance,type NativeAutoCoverageObject,type NativeAutoCoverageScore} from './native-auto-refinement';
import {nativeAutoCompiledField,nativeAutoCompileHole,nativeAutoPolygonRects,type NativeAutoPoint} from './native-auto-shape';
import {createNativeAutoTraversalTemplate,createNativeAutoBodyField} from './native-auto-traversal';
import {createNativeBodyPrimitiveProbe} from './native-body-collision';
import {createNativeAutoCoverage} from './native-auto-coverage';
import {nativeAutoCoverageCells,nativeAutoSplitCoverageCell} from './native-auto-cells';
import {assignNativeAutoCoverage} from './native-auto-assignment';
type Row=NativeSpatialConstructionReference['rows'][number];
interface Site {readonly x:number;readonly y:number;readonly rank:number;readonly sourceDistance:number}
interface PlannedObject extends NativeAutoCoverageObject {readonly id:string;readonly row:Partial<Row>;readonly polygon?:readonly NativeAutoPoint[]}
const snap=(value:number)=>Math.round(value/8)*8;
const overlaps=(a:Rect,b:Rect,gap=0)=>a[0]<b[0]+b[2]+gap&&a[0]+a[2]>b[0]-gap&&a[1]<b[1]+b[3]+gap&&a[1]+a[3]>b[1]-gap;
const shifted=(rect:Rect,site:Pick<Site,'x'|'y'>):Rect=>[rect[0]+site.x,rect[1]+site.y,rect[2],rect[3]];
function bounds(rectangles:readonly Rect[]):Rect {
  const x=Math.min(...rectangles.map(r=>r[0])),y=Math.min(...rectangles.map(r=>r[1]));
  return[x,y,Math.max(...rectangles.map(r=>r[0]+r[2]))-x,Math.max(...rectangles.map(r=>r[1]+r[3]))-y];
}

export interface NativeAutoPlan {
  readonly reference:NativeSpatialConstructionReference;
  readonly terrainOutline:readonly NativeAutoPoint[];readonly erosion:readonly (readonly NativeAutoPoint[])[];
  readonly shore:NativeConstructionShoreResult;
  readonly siteEvaluations:number;readonly feasibleSites:number;
  readonly placementStates:number;readonly backtracks:number;
  readonly constructionCoverage:Readonly<{strategy:'joint-coverage-assignment-v1';units:number;before:NativeAutoCoverageScore;after:NativeAutoCoverageScore}>;
  readonly requestedCounts:Readonly<{holes:number;solids:number}>;
  readonly assignmentTrace:Readonly<{coveragePrunes:number;passagePrunes:number;completeChecks:number;backjumps:number}>;
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
  const sourceInstances=input.preparedSource.instances;
  const rawSource=nativeConstructionFootprints(sourceInstances,native.family,seed),sourceBox=bounds(rawSource.supportBounds);
  // A later bounded proposal may change geometrySeed while keeping the frozen
  // scale. Seed-dependent projection must still respect the same mother budget.
  if(sourceBox[2]*sourceBox[3]>world.targetWalkAreaPx2*p.maxSourceAreaPercent/100)
    throw new Error('Frozen automatic source exceeds projected area budget for proposal seed');
  const width=input.intent.coreWidthPx,height=input.intent.coreHeightPx;
  const cx=snap(world.frameWidthPx/2),cy=snap(world.frameHeightPx/2),core:Rect=[cx-width/2,cy-height/2,width,height];
  const side=(mix32(seed,'auto-arm-side')&1)?1:-1;
  const land:Rect[]=[core,
    [core[0]-p.armWidthPx+p.armOverlapPx,snap(cy-p.armHeightPx/2-side*p.armOffsetPx),p.armWidthPx,p.armHeightPx],
    [core[0]+width-p.armOverlapPx,snap(cy-p.armHeightPx/2+side*p.armOffsetPx),p.armWidthPx,p.armHeightPx]];
  const assemblyX=snap(cx-sourceBox[0]-sourceBox[2]/2),assemblyY=snap(cy-sourceBox[1]-sourceBox[3]/2);
  const source=nativeConstructionFootprints(sourceInstances.map(instance=>({...instance,x:instance.x+assemblyX,y:instance.y+assemblyY})),native.family,seed);
  const sourceTree=nativePrimitiveTree(source.solidPrimitives),referenceId='automatic-native-layout';
  const sourceProbe=createNativeBodyPrimitiveProbe(source.supportPrimitives.map(p=>[0,2,4].map(i=>({x:p.points[i]!,y:p.points[i+1]!}))));
  const rows:Row[]=[],row=(values:Partial<Row>):Row=>({...Object.fromEntries(NATIVE_CONSTRUCTION_REFERENCE_COLUMNS.map(key=>[key,''])),
    reference_id:referenceId,world_id:input.worldId,grade:input.grade,seed:String(seed),seed_salt:'0',...values}) as Row;
  land.forEach(([x,y,w,h],index)=>rows.push(row({kind:'land',id:`land-${index}`,profile_id:index?'shoulder':'core',
    x_px:String(x),y_px:String(y),width_px:String(w),height_px:String(h),parent_id:index?'land-0':''})));
  rows.push(row({kind:'assembly',id:'source-whole',profile_id:'source-whole',x_px:String(assemblyX),y_px:String(assemblyY),scale:'1',rotation_rad:'0'}));
  const left=land[1]!,spawn={x:left[0]+p.edgeClearancePx,y:snap(left[1]+left[3]/2)};
  const reserved:Rect[]=[[spawn.x-40,spawn.y-40,80,80]];
  rows.push(row({kind:'spawn',id:'arrival',x_px:String(spawn.x),y_px:String(spawn.y)}));
  // The complete exterior is compiled before any obstacle is accepted. It is
  // immutable throughout placement/refinement and consumed verbatim at output.
  const shore=constructNativeMacroShore({land,protectedRects:[...nativeSpatialLandJoins(land,world.landRectMinOverlapPx,[null,0,0]).map(join=>join.rect),[spawn.x-10,spawn.y-10,20,20]],
    supportBounds:source.supportBounds,coverPrimitives:source.solidPrimitives,maxAddedCoverDistancePx:spatial.policy.maxEmptyRadiusPx,
    frame:[world.frameWidthPx,world.frameHeightPx],seed},
    {referenceId,algorithm:'macro-shore-step-v1',sourceHash:p.sourceHash,segmentMinPx:p.shoreSegmentMinPx,segmentMaxPx:p.shoreSegmentMaxPx,
      depthMinPx:p.shoreDepthMinPx,depthMaxPx:p.shoreDepthMaxPx,protectedGapPx:p.shoreProtectedGapPx,maxCleanRunPx:p.maxCleanRunPx});
  const compiled=nativeAutoCompiledField([...land,...shore.additions],[],shore.cuts,[],[world.frameWidthPx,world.frameHeightPx],seed,p.sourceHash);
  const bodyField=createNativeAutoBodyField(compiled.ground,sourceTree,source.solidPrimitives,[world.frameWidthPx,world.frameHeightPx],spawn);
  const sourceClear=(box:Rect)=>sourceProbe.supports({x:box[0]+box[2]/2,y:box[1]+box[3]/2},box[2]/2+p.objectClearancePx,box[3]/2+p.objectClearancePx);
  const targetCount=Math.round(world.targetWalkAreaPx2/(spatial.policy.planningCellFactor*spatial.policy.spacingPx**2));
  const minUnits=Math.max(spatial.policy.minSolidCount,Math.ceil(Math.ceil(targetCount*(1-spatial.policy.countToleranceRatio))/3));
  const maxUnits=Math.floor(Math.floor(targetCount*(1+spatial.policy.countToleranceRatio))/3);
  if(minUnits>maxUnits)throw new Error('Automatic density has no complete unit inside the frozen count contract');
  const objects:PlannedObject[]=[],nextId=Math.max(...native.instances.map(i=>i.id))+1;
  for(let index=0;index<maxUnits-1;index++){
    const profile=spatial.subordinateProfiles[index%spatial.subordinateProfiles.length];
    if(!profile)throw new Error('Automatic source has no shared subordinate material profile');
    const instance:MasterDefinition['instances'][number]={id:nextId+index,role:'solid',family:profile.family,
      constructionVersion:profile.constructionVersion,shapeProfile:profile.shapeProfile,x:0,y:0,
      length:snap((profile.minLengthPx+profile.maxLengthPx)/2),width:snap((profile.minWidthPx+profile.maxWidthPx)/2),
      height:(profile.minHeightPx+profile.maxHeightPx)/2,rotation:world.materialAxisRad+profile.rotationOffsetRad,
      thickness:profile.thicknessPx,fold:profile.fold,branches:profile.branches,opening:profile.opening,distortion:profile.distortion};
    const footprint=nativeConstructionFootprints([instance],native.family,seed);
    objects.push({id:`subordinate-${index}`,kind:'solid',rects:[],bounds:bounds(footprint.supportBounds),tree:nativePrimitiveTree(footprint.solidPrimitives),traversal:createNativeAutoTraversalTemplate(footprint.solidPrimitives),row:{kind:'solid',id:`subordinate-${index}`,profile_id:profile.id,
      length_px:String(instance.length),width_px:String(instance.width),height_px:String(instance.height),rotation_rad:String(instance.rotation)}});
  }
  for(let index=0;index<maxUnits*2;index++){
    const hole=nativeAutoHole(index,seed,spatial.holeProfiles),polygon=nativeAutoCompileHole(hole.rects,mix32(seed,`auto-hole-edge:${index}`),p.sourceHash),coverageRects=nativeAutoPolygonRects(polygon);
    const primitives=coverageRects.map(([x,y,w,h])=>nativePrimitive([x,y,x+w,y,x+w,y+h,x,y+h],-1));
    objects.push({...hole,polygon,coverageRects,traversal:createNativeAutoTraversalTemplate(primitives)});
  }
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
    .filter(({box})=>compiled.ground.containsRect(box,p.objectClearancePx)&&sourceClear(box)&&!reserved.some(r=>overlaps(box,r,p.objectClearancePx))));
  const chosen=new Map<number,number>();
  const available=new Uint8Array(bodyField.points.length).fill(1),links=bodyField.baseLinks.slice();
  const structure=Float32Array.from(bodyField.points.map(point=>point.source)),holeDistances=new Float32Array(available.length).fill(Infinity);
  const coverage=createNativeAutoCoverage(bodyField,spatial.policy);
  let measured=coverage.measure(available,links,structure,holeDistances);const before=measured.score;

  const holes=objects.map((object,index)=>({object,index})).filter(({object})=>object.kind==='hole').map(({index})=>index);
  const solids=objects.map((object,index)=>({object,index})).filter(({object})=>object.kind==='solid').map(({index})=>index);
  const baseCells=nativeAutoCoverageCells(bodyField.points,spatial.policy.spacingPx,spatial.policy.maxEmptyRadiusPx,spatial.policy.deepEmptyThresholdPx,
    (x,y)=>compiled.ground.supportsBody({x,y}));
  const cells=baseCells.filter(cell=>!cell.sourceAssisted);
  const units=Math.max(minUnits,Math.ceil((cells.length+1)/3)),objectCount=units*3-1;
  if(units>maxUnits)throw new Error(`Automatic coverage lattice needs ${units} units outside the frozen maximum ${maxUnits}`);
  while(cells.length<objectCount){
    let largest=0;for(let i=1;i<cells.length;i++)if(cells[i]!.points.length>cells[largest]!.points.length)largest=i;
    cells.splice(largest,1,...nativeAutoSplitCoverageCell(cells[largest]!,bodyField.points));
  }
  cells.sort((a,b)=>a.row-b.row||a.x-b.x);
  // Source-assisted cells only assign the initial object budget. Their points
  // remain in the final full-field certificate; a low mean is not coverage.
  const color=(cell:typeof cells[number])=>((cell.column+(cell.row%2)*2)%3+3)%3;
  const solidCells=new Set<number>(),solidGroups=new Set<string>();
  const rankedCells=cells.map((cell,index)=>({cell,index})).sort((a,b)=>Number(color(a.cell)!==0)-Number(color(b.cell)!==0)||a.cell.sourceDistance-b.cell.sourceDistance);
  for(const {cell,index}of rankedCells){
    const group=`${cell.column}:${cell.row}`;if(solidCells.size>=units-1)break;if(solidGroups.has(group))continue;
    solidCells.add(index);solidGroups.add(group);
  }
  // The first exploration foothold provides real sight-breaking cover. A
  // solid on the shared departure trunk would be encountered on every trip
  // leg, despite a correct whole-map H:S count. Assign roles before building
  // any footprint; all coverage and route gates still judge the result.
  // Both H members of the first complete 2H/1S unit belong near departure;
  // merely reserving the nearest centroid can leave a larger adjacent S as
  // the first actual encounter on every outward route.
  const arrivalCells=new Set(cells.map((cell,index)=>({cell,index})).sort((a,b)=>
    Math.hypot(a.cell.x-spawn.x,a.cell.y-spawn.y)-Math.hypot(b.cell.x-spawn.x,b.cell.y-spawn.y)).slice(0,2).map(({index})=>index));
  for(const arrivalCell of arrivalCells)if(solidCells.has(arrivalCell)){
    const replacement=cells.map((cell,index)=>({cell,index})).filter(({cell,index})=>!arrivalCells.has(index)&&!solidCells.has(index)&&!solidGroups.has(`${cell.column}:${cell.row}`))
      .sort((a,b)=>Math.hypot(b.cell.x-spawn.x,b.cell.y-spawn.y)-Math.hypot(a.cell.x-spawn.x,a.cell.y-spawn.y))[0];
    if(replacement){solidCells.delete(arrivalCell);solidCells.add(replacement.index);
      solidGroups.delete(`${cells[arrivalCell]!.column}:${cells[arrivalCell]!.row}`);solidGroups.add(`${replacement.cell.column}:${replacement.cell.row}`);}
  }
  const objectByCell:number[]=[];let nextHole=0,nextSolid=0;
  cells.forEach((_,index)=>objectByCell.push(solidCells.has(index)?solids[nextSolid++]!:holes[nextHole++]!));
  const cellByObject=new Map(objectByCell.map((object,index)=>[object,index]));
  const cellCoverage=(object:PlannedObject,site:Pick<Site,'x'|'y'>,cellIndex:number)=>{
    let maximum=0,deepExcess=0;
    for(const index of cells[cellIndex]!.points){const point=bodyField.points[index]!;
      const structureDistance=Math.min(point.source,nativeAutoObjectDistance(object,site,point))+Math.SQRT2*4;
      maximum=Math.max(maximum,Math.min(structureDistance,point.margin+Math.SQRT2*4));deepExcess+=Math.max(0,structureDistance-spatial.policy.deepEmptyThresholdPx);
    }
    return{maximum,deepExcess};
  };
  const siteIndex=new Map(sites.map((site,index)=>[`${site.x}:${site.y}`,index]));
  const projectedDomains=new Map<number,{site:Site;index:number;box:Rect}[]>();
  for(const objectIndex of objectByCell){
    const object=objects[objectIndex]!,cell=cells[cellByObject.get(objectIndex)!]!;
    const domain=[...domains[objectIndex]!],nearest=domain.reduce<typeof domain[number]|undefined>((best,candidate)=>!best||
      Math.hypot(candidate.site.x-cell.x,candidate.site.y-cell.y)<Math.hypot(best.site.x-cell.x,best.site.y-cell.y)?candidate:best,undefined);
    if(!nearest)throw new Error(`Automatic coverage cell has no supported footprint for ${object.id}`);
    // Only this cell and its nearest legal projection receive an 8px local
    // solve. No distant whole-map move is considered or scored.
    const added=new Set(domain.map(candidate=>candidate.index));
    for(const origin of [cell,nearest.site])for(let dy=-16;dy<=16;dy+=8)for(let dx=-16;dx<=16;dx+=8){
      const x=snap(origin.x+dx),y=snap(origin.y+dy),key=`${x}:${y}`;let index=siteIndex.get(key);
      if(index===undefined){if(siteEvaluations>=p.maxSiteEvaluations)continue;siteEvaluations++;
        index=sites.length;sites.push({x,y,rank:mix32(seed,`auto-cell:${x}:${y}`),sourceDistance:nativePrimitiveDistance(sourceTree,x,y)});siteIndex.set(key,index);}
      if(added.has(index))continue;const site=sites[index]!,box=shifted(object.bounds,site);
      if(compiled.ground.containsRect(box,p.objectClearancePx)&&sourceClear(box)&&!reserved.some(r=>overlaps(box,r,p.objectClearancePx))){domain.push({site,index,box});added.add(index);}
    }
    projectedDomains.set(objectIndex,domain.filter(candidate=>Math.hypot(candidate.site.x-nearest.site.x,candidate.site.y-nearest.site.y)<=spatial.policy.spacingPx/2));
  }
  // Compile each actual footprint's cover once in object-local coordinates.
  // Every original body sample remains an obligation until fixed source/shore
  // or a chosen H/S proves it covered; clipped cell averages cannot drop it.
  const points=bodyField.points,words=Math.ceil(points.length/32),required=new Uint32Array(words);
  let cols=0,gridRows=0;for(const point of points){cols=Math.max(cols,point.gx+1);gridRows=Math.max(gridRows,point.gy+1);}
  const lookup=new Int32Array(cols*gridRows).fill(-1);
  const coverLimit=spatial.policy.maxEmptyRadiusPx-Math.SQRT2*4;
  points.forEach((point,index)=>{
    lookup[point.gy*cols+point.gx]=index;
    if(Math.min(point.source,point.margin)>coverLimit)required[index>>>5]=required[index>>>5]!|(1<<(index&31));
  });
  const assignmentDomains=objectByCell.map((objectIndex,variable)=>{
    checkpoint();const object=objects[objectIndex]!,cellIndex=cellByObject.get(objectIndex)!,cell=cells[cellIndex]!;
    const offsets:{x:number;y:number;wide:boolean}[]=[],box=object.bounds;
    for(let gy=Math.floor((box[1]-coverLimit-4)/8);gy<=Math.ceil((box[1]+box[3]+coverLimit-4)/8);gy++){
      for(let gx=Math.floor((box[0]-coverLimit-4)/8);gx<=Math.ceil((box[0]+box[2]+coverLimit-4)/8);gx++){
        const distance=nativeAutoObjectDistance(object,{x:0,y:0},{x:gx*8+4,y:gy*8+4});
        if(distance<=coverLimit)offsets.push({x:gx,y:gy,wide:distance<spatial.policy.wideRadiusPx});
      }
    }
    return projectedDomains.get(objectIndex)!.map(candidate=>{
      const covers=new Uint32Array(words),x=candidate.site.x/8,y=candidate.site.y/8;let wideLoss=0;
      for(const offset of offsets){
        const gx=offset.x+x,gy=offset.y+y;if(gx<0||gy<0||gx>=cols||gy>=gridRows)continue;
        const index=lookup[gy*cols+gx]!;if(index<0)continue;
        covers[index>>>5]=covers[index>>>5]!|(1<<(index&31));
        if(offset.wide&&Math.min(points[index]!.source,points[index]!.margin)>=spatial.policy.wideRadiusPx)wideLoss++;
      }
      return {...candidate,variable,object:objectIndex,covers,wideLoss,...cellCoverage(object,candidate.site,cellIndex),
        distance:Math.hypot(candidate.site.x-cell.x,candidate.site.y-cell.y)};
    }).sort((a,b)=>Math.max(0,a.maximum-spatial.policy.maxEmptyRadiusPx)-Math.max(0,b.maximum-spatial.policy.maxEmptyRadiusPx)
      ||a.deepExcess-b.deepExcess||a.wideLoss-b.wideLoss||a.distance-b.distance||a.site.rank-b.site.rank);
  });
  const bodyStates=Array.from({length:objectCount+1},()=>new Uint8Array(available.length));
  const linkStates=Array.from({length:objectCount+1},()=>new Uint8Array(links.length));
  bodyStates[0]!.set(available);linkStates[0]!.set(links);
  type AssignmentCandidate=typeof assignmentDomains[number][number];
  const distanceCache=new Map<AssignmentCandidate,Float32Array>();
  const maxCachedFields=Math.max(1,Math.floor(16*1024*1024/(Float32Array.BYTES_PER_ELEMENT*points.length)));
  const distanceField=(candidate:AssignmentCandidate)=>{
    let field=distanceCache.get(candidate);if(!field){
      field=Float32Array.from(points,point=>nativeAutoObjectDistance(objects[candidate.object]!,candidate.site,point));
      if(distanceCache.size>=maxCachedFields)distanceCache.delete(distanceCache.keys().next().value!);
      distanceCache.set(candidate,field);
    }return field;
  };
  const assignment=assignNativeAutoCoverage({domains:assignmentDomains,required,maxStates:p.maxPlacementStates,branchLimit:p.placementBranchLimit,checkpoint,
    compatible:(a,b)=>!overlaps(a.box,b.box,p.objectClearancePx),
    connected:(candidate,depth)=>{
      const trialBody=bodyStates[depth+1]!,trialLinks=linkStates[depth+1]!;
      trialBody.set(bodyStates[depth]!);trialLinks.set(linkStates[depth]!);
      const template=objects[candidate.object]!.traversal!,site=candidate.site;
      for(let i=0;i<points.length;i++)if(trialBody[i]){
        const point=points[i]!,x=point.x-site.x,y=point.y-site.y;
        if(!template.supported(x,y))trialBody[i]=0;else trialLinks[i]=trialLinks[i]!&template.links(x,y);
      }
      return bodyField.connected(trialBody,trialLinks);
    },
    complete:selection=>{
      structure.set(Float32Array.from(points,point=>point.source));holeDistances.fill(Infinity);
      for(const candidate of selection){const object=objects[candidate.object]!,field=distanceField(candidate);
        for(let i=0;i<points.length;i++){
          const distance=field[i]!;
          structure[i]=Math.min(structure[i]!,distance);
          if(object.kind==='hole')holeDistances[i]=Math.min(holeDistances[i]!,distance);
        }
      }
      measured=coverage.measure(bodyStates[objectCount]!,linkStates[objectCount]!,structure,holeDistances);
      if(measured.accepted)return true;
      const conflicts=new Set<number>(),score=measured.score,reasons:string[]=[];
      const near=(index:number,radius:number,opening=false,holesOnly=false)=>{
        if(index<0)return;const point=points[index]!;
        for(const candidate of selection){
          const object=objects[candidate.object]!;if(holesOnly&&object.kind!=='hole')continue;
          if(opening?distanceField(candidate)[index]!<radius:
            assignmentDomains[candidate.variable]!.some(option=>nativeAutoObjectDistance(object,option.site,point)<=radius))conflicts.add(candidate.variable);
        }
      };
      if(score.maxEmptyPx>spatial.policy.maxEmptyRadiusPx){reasons.push('empty');near(measured.emptyTarget,coverLimit);}
      if(score.maxDeepSpanPx>spatial.policy.maxDeepEmptySpanPx){reasons.push('deep-span');near(measured.deepTarget,spatial.policy.deepEmptyThresholdPx);}
      if(score.maxApproachRoutePx>spatial.policy.maxCoverRoutePx){reasons.push('hole-approach');near(measured.holeTarget,spatial.policy.referenceSightPx/2,false,true);}
      if(score.largestWideRatio<spatial.policy.minLargestWideRatio){reasons.push('wide-connection');near(measured.wideTarget,spatial.policy.wideRadiusPx,true);}
      // Area is global; no local conflict set can soundly stand in for it.
      if(score.wideRatio<spatial.policy.minWideRatio){reasons.push('wide-area');selection.forEach(candidate=>conflicts.add(candidate.variable));}
      return {conflicts:[...conflicts],reason:reasons.join(';')};
    },
  });
  if(!assignment.accepted){
    const point=points[assignment.uncoveredBit];
    throw new Error(`Automatic joint assignment rejected: ${JSON.stringify({states:assignment.states,coveragePrunes:assignment.coveragePrunes,
      passagePrunes:assignment.passagePrunes,completeChecks:assignment.completeChecks,backjumps:assignment.backjumps,exhausted:assignment.exhausted,reason:assignment.lastRejection,
      uncovered:point?{x:point.x,y:point.y}:undefined,lastComplete:assignment.completeChecks?measured.score:undefined})}`);
  }
  for(const candidate of assignment.assignment)chosen.set(candidate.object,candidate.index);
  available.set(bodyStates[objectCount]!);links.set(linkStates[objectCount]!);
  const requestedCounts={holes:units*2,solids:units};
  const constructionCoverage={strategy:'joint-coverage-assignment-v1' as const,units,before,after:measured.score};
  // Compiler assigns IDs in row order, so preserve the same order used for
  // each generated solid's seeded projected footprint.
  objects.forEach((object,index)=>{
    if(!chosen.has(index))return;
    const site=sites[chosen.get(index)!]!;
    rows.push(row({...object.row,x_px:String(site.x),y_px:String(site.y),
      ...(object.kind==='hole'?{rects:object.rects.map(rect=>shifted(rect,site).join(':')).join('|')}:{})}));
  });
  return{reference:{id:referenceId,worldId:input.worldId,grade:input.grade,seed,seedSalt:0,sourceHash:p.sourceHash,rows},
    terrainOutline:compiled.terrainOutline,erosion:objects.flatMap((object,index)=>object.polygon&&chosen.has(index)?[object.polygon.map(point=>({x:point.x+sites[chosen.get(index)!]!.x,y:point.y+sites[chosen.get(index)!]!.y}))]:[]),shore,
    siteEvaluations,feasibleSites:sites.length,placementStates:assignment.states,backtracks:assignment.backtracks,constructionCoverage,requestedCounts,
    assignmentTrace:{coveragePrunes:assignment.coveragePrunes,passagePrunes:assignment.passagePrunes,completeChecks:assignment.completeChecks,backjumps:assignment.backjumps}};
}
