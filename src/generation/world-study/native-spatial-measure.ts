/** Final-shape object qualification and whole-domain G1/G3 gates. No old-map retention score. */
import type {NativeSpatialPolicy,NativeSpatialWorldIntent,NativeSpatialGateResult,NativeSpatialHoleProfile} from './native-spatial-types';
import type {NativeSpatialStructure,NativeSpatialAssemblyPlacement,NativeSpatialGroupResult,NativeSpatialHolePlacement} from './native-spatial-structures';
import {evaluateNativeSpatialFinalSupport} from './native-spatial-final-support';
import {identifyNativeSpatialVoid,identifyNativeSpatialHoles} from './native-spatial-void-identity';
import {evaluateNativeSpatialBays,type NativeSpatialBayAuthoring} from './native-spatial-bay-measure';
import {nativeCellPoint,nativeVoidCellBoundary,nativePrimitiveTree,nativePrimitiveDistance,NATIVE_SPATIAL_DIRECTIONS,
  type NativeSpatialGeometry,type NativeSpatialPrimitive} from './native-spatial-geometry';
const CELL=8,CORNER_ERROR=Math.SQRT2*4;
class Groups {
  readonly parent:number[];
  constructor(count:number){this.parent=Array.from({length:count},(_,i)=>i);}
  root(i:number):number {while(this.parent[i]!==i){this.parent[i]=this.parent[this.parent[i]!]!;i=this.parent[i]!;}return i;}
  join(a:number,b:number):void {a=this.root(a);b=this.root(b);if(a!==b)this.parent[Math.max(a,b)]=Math.min(a,b);}
}
function components(mask:Uint8Array,cols:number,rows:number,links?:Uint8Array):number[][] {
  const seen=new Uint8Array(mask.length),result:number[][]=[];
  for(let start=0;start<mask.length;start++)if(mask[start]&&!seen[start]){
    const group=[start];seen[start]=1;
    for(let at=0;at<group.length;at++){
      const cell=group[at]!,x=cell%cols,y=Math.floor(cell/cols);
      for(let d=0;d<(links?8:4);d++){
        if(links&&!(links[cell]!&(1<<d)))continue;
        const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[d]!,nx=x+dx,ny=y+dy,next=ny*cols+nx;
        if(nx<0||ny<0||nx>=cols||ny>=rows||!mask[next]||seen[next])continue;
        seen[next]=1;group.push(next);
      }
    }result.push(group);
  }return result;
}
function bounds(primitives:readonly NativeSpatialPrimitive[]){return{minX:Math.min(...primitives.map(p=>p.minX)),minY:Math.min(...primitives.map(p=>p.minY)),maxX:Math.max(...primitives.map(p=>p.maxX)),maxY:Math.max(...primitives.map(p=>p.maxY))};}
function nearbyReachable(cells:readonly number[],geometry:NativeSpatialGeometry):boolean {
  const {cols,rows}=geometry.terrain;
  return cells.some(cell=>{const x=cell%cols,y=Math.floor(cell/cols);for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
    const nx=x+dx,ny=y+dy;if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&geometry.reachable[ny*cols+nx])return true;
  }return false;});
}

/** A convex triangle containing all four cell corners contains the whole cell;
 * corners in different triangles do not prove union coverage. */
function cellInsideTriangle(x:number,y:number,triangle:NativeSpatialPrimitive,half=4):boolean {
  const p=triangle.points;if(p.length!==6)return false;
  if(x-half<triangle.minX||x+half>triangle.maxX||y-half<triangle.minY||y+half>triangle.maxY)return false;
  return [[-half,-half],[half,-half],[-half,half],[half,half]].every(([dx,dy])=>{
    const px=x+dx!,py=y+dy!,cross=(i:number,j:number)=>(p[j]!-p[i]!)*(py-p[i+1]!)-(p[j+1]!-p[i+1]!)*(px-p[i]!);
    const a=cross(0,2),b=cross(2,4),c=cross(4,0);return(a>=-1e-7&&b>=-1e-7&&c>=-1e-7)||(a<=1e-7&&b<=1e-7&&c<=1e-7);
  });
}

function bodyGapClosed(a:NativeSpatialPrimitive,b:NativeSpatialPrimitive):boolean {
  if(a.maxX+20<=b.minX||b.maxX+20<=a.minX||a.maxY+20<=b.minY||b.maxY+20<=a.minY)return false;
  const axes:number[][]=[[1,0],[0,1]];
  for(const triangle of [a,b])for(let i=0;i<6;i+=2){const j=(i+2)%6;axes.push([triangle.points[j+1]!-triangle.points[i+1]!,-(triangle.points[j]!-triangle.points[i]!)]);}
  for(const [nx,ny]of axes){
    if(Math.abs(nx!)+Math.abs(ny!)<1e-9)continue;
    const projection=(p:NativeSpatialPrimitive)=>[0,2,4].map(i=>p.points[i]!*nx!+p.points[i+1]!*ny!),pa=projection(a),pb=projection(b),padding=20*(Math.abs(nx!)+Math.abs(ny!));
    if(Math.max(...pa)+padding<=Math.min(...pb)+1e-7||Math.max(...pb)+padding<=Math.min(...pa)+1e-7)return false;
  }return true;
}

/** A hole's identity is its final VOID component, merging strips too thin for a 20px body. */
export function identifyNativeSpatialStructures(geometry:NativeSpatialGeometry,assemblies:readonly NativeSpatialAssemblyPlacement[],policy:NativeSpatialPolicy):NativeSpatialGroupResult {
  const {cols,rows,matter}=geometry.terrain,count=cols*rows,rejected:{id:string;reasons:string[]}[]=[];
  const identities=identifyNativeSpatialVoid(matter,cols,rows),voidLabels=identities.labels;
  const holeCells=identities.cellsByLabel,exterior=identities.exteriorLabels;
  const structures:NativeSpatialStructure[]=[];let exteriorVoidCells=0;
  for(const [label,cells]of holeCells){
    if(exterior.has(label)){exteriorVoidCells+=cells.length;continue;}
    const boundary=nativeVoidCellBoundary(cells,cols,rows,label),tree=nativePrimitiveTree(boundary),id=`H-${Math.min(...cells)}`;
    let core=0;for(const cell of cells){const p=nativeCellPoint(cell,cols);core=Math.max(core,nativePrimitiveDistance(tree,p.x,p.y));}
    const reasons:string[]=[];if(core<policy.minHoleCoreRadiusPx)reasons.push('hole-has-no-thick-core');if(!nearbyReachable(cells,geometry))reasons.push('hole-is-not-approachable');
    if(reasons.length){rejected.push({id,reasons});continue;}
    structures.push({id,kind:'hole',assemblyIds:[],instanceIds:[],cells,boundary,bounds:bounds(boundary),areaLowerPx2:cells.length*64,areaUpperPx2:cells.length*64,
      componentCount:identities.componentCountByLabel.get(label)!,thickRadiusLowerPx:core,distance:p=>nativePrimitiveDistance(tree,p.x,p.y)});
  }
  const ids=new Set<number>(),assemblyCells: number[][]=[],assemblyPrimitives:NativeSpatialPrimitive[][]=[];
  for(const assembly of assemblies){
    for(const id of assembly.instanceIds){if(ids.has(id))throw new Error(`Solid ${id} belongs to more than one authored assembly`);ids.add(id);}
    const idSet=new Set(assembly.instanceIds),primitives=geometry.solidPrimitives.filter(p=>idSet.has(p.objectId)),tree=nativePrimitiveTree(primitives),box=bounds(primitives),cells:number[]=[];
    if(!primitives.length)throw new Error(`Assembly ${assembly.assemblyId} contains no actual solid footprint`);
    if(Math.max(box.maxX-box.minX,box.maxY-box.minY)>assembly.maxSpanPx)throw new Error(`Assembly ${assembly.assemblyId} exceeds its authored span`);
    for(let y=Math.max(0,Math.floor(box.minY/8));y<Math.min(rows,Math.ceil(box.maxY/8));y++)for(let x=Math.max(0,Math.floor(box.minX/8));x<Math.min(cols,Math.ceil(box.maxX/8));x++){
      const p=nativeCellPoint(y*cols+x,cols);if(nativePrimitiveDistance(tree,p.x,p.y)<=CORNER_ERROR)cells.push(y*cols+x);
    }assemblyCells.push(cells);assemblyPrimitives.push(primitives);
  }
  for(const instance of geometry.terrain.definition.instances)if(instance.role==='solid'&&!ids.has(instance.id))throw new Error(`Solid ${instance.id} has no frozen assembly identity`);
  const solidGroups=new Groups(assemblies.length);
  // Exact projected triangle footprints expanded by the 10px half-body on
  // each side. Raster cell intersection cannot merge a real 24px passage.
  for(let a=0;a<assemblies.length;a++)for(let b=a+1;b<assemblies.length;b++){
    if(assemblyPrimitives[a]!.some(pa=>assemblyPrimitives[b]!.some(pb=>bodyGapClosed(pa,pb))))solidGroups.join(a,b);
  }
  const grouped=new Map<number,number[]>();assemblies.forEach((_,i)=>{const root=solidGroups.root(i),list=grouped.get(root)??[];list.push(i);grouped.set(root,list);});
  for(const indices of grouped.values()){
    const primitives=indices.flatMap(i=>assemblyPrimitives[i]!),tree=nativePrimitiveTree(primitives),box=bounds(primitives),cells=[...new Set(indices.flatMap(i=>assemblyCells[i]!))],mask=new Uint8Array(count);
    let lower=0;for(const cell of cells){mask[cell]=1;const p=nativeCellPoint(cell,cols);if(primitives.some(triangle=>cellInsideTriangle(p.x,p.y,triangle)))lower+=64;
      else for(let dy=-3;dy<=3;dy+=2)for(let dx=-3;dx<=3;dx+=2)if(primitives.some(triangle=>cellInsideTriangle(p.x+dx,p.y+dy,triangle,1)))lower+=4;}
    const id=`S-${indices.map(i=>assemblies[i]!.assemblyId).sort().join('+')}`,reasons:string[]=[];
    if(lower<policy.minSolidAreaPx2)reasons.push('solid-effective-area-too-small');if(Math.max(box.maxX-box.minX,box.maxY-box.minY)<policy.minSolidSpanPx)reasons.push('solid-effective-span-too-small');
    if(!nearbyReachable(cells,geometry))reasons.push('solid-is-not-approachable');
    if(reasons.length){rejected.push({id,reasons});continue;}
    structures.push({id,kind:'solid',assemblyIds:indices.map(i=>assemblies[i]!.assemblyId),instanceIds:indices.flatMap(i=>assemblies[i]!.instanceIds),cells,boundary:primitives,bounds:box,
      areaLowerPx2:lower,areaUpperPx2:cells.length*64,componentCount:components(mask,cols,rows).length,thickRadiusLowerPx:0,distance:p=>nativePrimitiveDistance(tree,p.x,p.y)});
  }
  structures.sort((a,b)=>a.id.localeCompare(b.id));return{structures,rejected,exteriorVoidCells,holeLabelByCell:voidLabels};
}

/** Runtime-only observation of the actual gate's masks. Every array is a
 * detached copy; no observer or diagnostic buffer enters production recipes. */
export interface NativeSpatialGeometryDiagnostic {
  readonly cols:number;readonly rows:number;readonly cellSizePx:number;
  readonly deepThresholdPx:number;readonly distanceCellUpperErrorPx:number;
  readonly deep:Readonly<Uint8Array>;readonly deepBody:Readonly<Uint8Array>;readonly wide:Readonly<Uint8Array>;
  readonly distances:Readonly<Float32Array>;readonly deepComponents:readonly (readonly number[])[];
}
export type NativeSpatialGeometryDiagnosticObserver=(diagnostic:NativeSpatialGeometryDiagnostic)=>void;
export function evaluateNativeSpatialGeometry(geometry:NativeSpatialGeometry,groups:NativeSpatialGroupResult,policy:NativeSpatialPolicy,world:NativeSpatialWorldIntent,
  holeAuthoring?:Readonly<{placements:readonly NativeSpatialHolePlacement[];profiles:readonly NativeSpatialHoleProfile[]}>,bayAuthoring?:NativeSpatialBayAuthoring,observe?:NativeSpatialGeometryDiagnosticObserver,deepSpanDiagnosticOnly=false):NativeSpatialGateResult {
  const {cols,rows}=geometry.terrain,structuralTree=nativePrimitiveTree(groups.structures.flatMap(s=>s.boundary)),count=cols*rows;
  const wide=new Uint8Array(count),deep=new Uint8Array(count),distances=new Float32Array(count);let maxEmptyUpperPx=0,internalMaxEmptyUpperPx=0,wideCount=0;let worstCell=-1,internalWorstCell=-1;
  for(let cell=0;cell<count;cell++)if(geometry.supported[cell]){
    const p=nativeCellPoint(cell,cols),distance=nativePrimitiveDistance(structuralTree,p.x,p.y);distances[cell]=distance;
    if(distance+CORNER_ERROR>internalMaxEmptyUpperPx){internalMaxEmptyUpperPx=distance+CORNER_ERROR;internalWorstCell=cell;}
    // A physical empty circle ends at any actual VOID or solid footprint.
    // Internal qualified H/S distance still measures long unstructured ground;
    // the shoreline must not erase that independent deep-region constraint.
    const openDistance=Math.min(geometry.solidDistance(p),geometry.voidDistance(p));
    if(openDistance+CORNER_ERROR>maxEmptyUpperPx){maxEmptyUpperPx=openDistance+CORNER_ERROR;worstCell=cell;}
    deep[cell]=Number(distance+CORNER_ERROR>policy.deepEmptyThresholdPx);
    // G3 is a fraction of these actual body centres, not whole 8px cells.
    // The conservative cell-radius error belongs to G1's continuous coverage.
    if(openDistance>=policy.wideRadiusPx){wide[cell]=1;wideCount++;}
  }
  const deepBody=new Uint8Array(count);
  for(let cell=0;cell<count;cell++)if(deep[cell]){
    const x=cell%cols,y=Math.floor(cell/cols);let all=true;
    for(let dy=-1;dy<=1&&all;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=cols||ny>=rows||!deep[ny*cols+nx]){all=false;break;}}
    deepBody[cell]=Number(all);
  }
  const deepGroups=components(deepBody,cols,rows,geometry.links8),wideGroups=components(wide,cols,rows,geometry.links8);
  let maxDeepSpanPx=0,worstDeepCell=-1,worstDeepBounds:Readonly<{minX:number;minY:number;maxX:number;maxY:number}>|null=null;
  for(const cells of deepGroups){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const cell of cells){const p=nativeCellPoint(cell,cols);minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
    const span=Math.max(maxX-minX+8,maxY-minY+8);
    if(span>maxDeepSpanPx){
      maxDeepSpanPx=span;worstDeepBounds={minX:minX-4,minY:minY-4,maxX:maxX+4,maxY:maxY+4};
      const cx=(minX+maxX)/2,cy=(minY+maxY)/2;let distance=Infinity;
      for(const cell of cells){const p=nativeCellPoint(cell,cols),d=(p.x-cx)**2+(p.y-cy)**2;if(d<distance||d===distance&&cell<worstDeepCell){distance=d;worstDeepCell=cell;}}
    }
  }
  const holes=groups.structures.filter(s=>s.kind==='hole').length,solids=groups.structures.filter(s=>s.kind==='solid').length,walkAreaPx2=geometry.supportedCount*64;
  const wideRatio=wideCount/geometry.supportedCount,largestWideRatio=wideCount?Math.max(0,...wideGroups.map(c=>c.length))/wideCount:0;
  if(observe)observe({cols,rows,cellSizePx:CELL,deepThresholdPx:policy.deepEmptyThresholdPx,distanceCellUpperErrorPx:CORNER_ERROR,
    deep:deep.slice(),deepBody:deepBody.slice(),wide:wide.slice(),distances:distances.slice(),deepComponents:deepGroups.map(cells=>[...cells])});
  const reasons:string[]=[];
  const targetCount=Math.round(world.targetWalkAreaPx2/(policy.planningCellFactor*policy.spacingPx*policy.spacingPx));
  const minCount=Math.ceil(targetCount*(1-policy.countToleranceRatio)),maxCount=Math.floor(targetCount*(1+policy.countToleranceRatio));
  if(holes+solids<minCount||holes+solids>maxCount)reasons.push('effective-structure-count-outside-intent');
  if(groups.rejected.length)reasons.push('ineffective-spatial-objects');
  if(geometry.reachableCount!==geometry.supportedCount)reasons.push('disconnected-body-domain');
  if(Math.abs(walkAreaPx2-world.targetWalkAreaPx2)>world.targetWalkAreaPx2*policy.areaToleranceRatio)reasons.push('walk-area-outside-intent');
  if(solids<policy.minSolidCount||policy.requireMoreHoles&&holes<=solids||Math.abs(holes-policy.holeToSolidRatio*solids)>Math.max(policy.holeCountAbsTolerance,policy.holeCountRelTolerance*solids))reasons.push('whole-world-hole-solid-ratio');
  if(maxEmptyUpperPx>policy.maxEmptyRadiusPx)reasons.push('G1-largest-empty-radius');
  if(!deepSpanDiagnosticOnly&&maxDeepSpanPx>policy.maxDeepEmptySpanPx)reasons.push('G1-long-deep-empty-region');
  if(wideRatio<policy.minWideRatio)reasons.push('G3-wide-domain-area');
  if(largestWideRatio<policy.minLargestWideRatio)reasons.push('G3-wide-domain-connectivity');
  const holeContract=holeAuthoring?evaluateNativeSpatialHoleProfiles(geometry,groups,holeAuthoring.placements,holeAuthoring.profiles):undefined;
  if(holeContract)reasons.push(...holeContract.reasons);
  const bayContract=bayAuthoring?evaluateNativeSpatialBays(geometry,groups,bayAuthoring):undefined;
  if(bayContract)reasons.push(...bayContract.reasons);
  const sourceSupport=evaluateNativeSpatialFinalSupport(geometry);reasons.push(...sourceSupport.reasons);
  return{accepted:!reasons.length,reasons,metrics:{holes,solids,targetCount,minCount,maxCount,walkAreaPx2,targetWalkAreaPx2:world.targetWalkAreaPx2,maxEmptyUpperPx,maxDeepSpanPx,
    ...(deepSpanDiagnosticOnly?{emptyRegionMetric:'radius-and-cover-route-v1',maxDeepAreaPx2:Math.max(0,...deepGroups.map(cells=>cells.length*64)),deepAreaRatio:deepGroups.reduce((sum,cells)=>sum+cells.length,0)/geometry.supportedCount,
      qualityWarnings:maxDeepSpanPx>policy.maxDeepEmptySpanPx?['long-deep-empty-region']:[]}:{}),
    worstEmptyPoint:worstCell<0?null:nativeCellPoint(worstCell,cols),internalMaxEmptyUpperPx,internalWorstEmptyPoint:internalWorstCell<0?null:nativeCellPoint(internalWorstCell,cols),worstDeepPoint:worstDeepCell<0?null:nativeCellPoint(worstDeepCell,cols),worstDeepBounds,wideRatio,largestWideRatio,reachableBodySeats:geometry.reachableCount,supportedBodySeats:geometry.supportedCount,
    effectiveStructures:groups.structures.map(({distance:_distance,boundary:_boundary,cells:_cells,...structure})=>structure),rejectedObjects:groups.rejected,
    ...(holeContract?.metrics??{}),...(bayContract?.metrics??{}),...sourceSupport.metrics,cellSizePx:8,distanceCellUpperErrorPx:CORNER_ERROR}};
}

/** Profile caps bind the whole authored union, continuous broken rim, and real
 * VOID cells. No input-rectangle proxy may admit an oversized final hole. */
export function evaluateNativeSpatialHoleProfiles(geometry:NativeSpatialGeometry,groups:NativeSpatialGroupResult,
  placements:readonly NativeSpatialHolePlacement[],profiles:readonly NativeSpatialHoleProfile[]):NativeSpatialGateResult {
  const {cols,rows,definition}=geometry.terrain,labels=groups.holeLabelByCell;
  const profileById=new Map(profiles.map(p=>[p.id,p]));
  const identity=identifyNativeSpatialHoles(cols,rows,labels,definition.erosion??[],placements);
  const unionArea=(rects:NativeSpatialHolePlacement['rects']):number=>{
    const xs=[...new Set(rects.flatMap(r=>[r[0],r[0]+r[2]]))].sort((a,b)=>a-b);let area=0;
    for(let i=1;i<xs.length;i++){
      const x=(xs[i-1]!+xs[i]!)/2,spans=rects.filter(r=>x>r[0]&&x<r[0]+r[2]).map(r=>[r[1],r[1]+r[3]] as const).sort((a,b)=>a[0]-b[0]);let end=-Infinity,length=0;
      for(const [a,b]of spans){length+=Math.max(0,b-Math.max(a,end));end=Math.max(end,b);}area+=(xs[i]!-xs[i-1]!)*length;
    }return area;
  };
  const records=placements.map((placement,index)=>{
    const profile=profileById.get(placement.profileId),reasons:string[]=[];
    const association=identity.records[index]!,{finalLabel,stat}=association;
    const loops=association.contourIndices.map(index=>({loop:definition.erosion[index]!,index}));
    if(!profile)reasons.push('hole-profile-missing');
    if(!association.valid)reasons.push('hole-profile-final-identity');
    const sourceSpanPx=placement.rects.length?Math.max(Math.max(...placement.rects.map(r=>r[0]+r[2]))-Math.min(...placement.rects.map(r=>r[0])),Math.max(...placement.rects.map(r=>r[1]+r[3]))-Math.min(...placement.rects.map(r=>r[1]))):Infinity;
    const sourceAreaPx2=unionArea(placement.rects),finalAreaPx2=stat?.area??Infinity,finalSpanPx=stat?Math.max(stat.maxX-stat.minX,stat.maxY-stat.minY):Infinity;
    const contourPoints=loops.flatMap(({loop})=>loop),contourSpanPx=contourPoints.length?Math.max(Math.max(...contourPoints.map(p=>p.x))-Math.min(...contourPoints.map(p=>p.x)),Math.max(...contourPoints.map(p=>p.y))-Math.min(...contourPoints.map(p=>p.y))):Infinity;
    const contourAreaPx2=loops.reduce((sum,{loop})=>sum+Math.abs(loop.reduce((a,p,i)=>{const q=loop[(i+1)%loop.length]!;return a+p.x*q.y-q.x*p.y;},0))/2,0);
    if(profile){
      if(sourceAreaPx2>profile.maxAreaPx2||finalAreaPx2>profile.maxAreaPx2||contourAreaPx2>profile.maxAreaPx2)reasons.push('hole-profile-area');
      if(sourceSpanPx>profile.maxSpanPx||finalSpanPx>profile.maxSpanPx||contourSpanPx>profile.maxSpanPx)reasons.push('hole-profile-span');
    }
    return{holeId:placement.holeId,profileId:placement.profileId,finalLabel,contourIndices:loops.map(row=>row.index),sourceAreaPx2,sourceSpanPx,finalAreaPx2,finalSpanPx,contourAreaPx2,contourSpanPx,reasons};
  });
  records.forEach((row,index)=>{if(identity.records[index]!.duplicate)row.reasons.push('hole-profile-merged-identity');});
  const {orphanLabels,orphanContours}=identity;
  const reasons=[...new Set(records.flatMap(row=>row.reasons))];if(orphanLabels.length||orphanContours.length)reasons.push('hole-profile-unassigned-final-hole');
  return{accepted:!reasons.length,reasons,metrics:{holeProfileMeasurements:records,holeProfileViolationCount:records.filter(row=>row.reasons.length).length+orphanLabels.length+orphanContours.length,orphanHoleLabels:orphanLabels,orphanHoleContours:orphanContours}};
}
