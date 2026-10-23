/** Revision-12 G3 transverse openings and G4 complete expedition route family. */
import {GAME_CONSTANTS} from '@/config/constants';
import type {Vector2} from '@/types/game-types';
import {castRayDirection,createRayHit,hasLineOfSight} from '@/utils/grid-raycast';
import {nativeCellPoint,nativePrimitiveTree,type NativeSpatialBvh,type NativeSpatialGeometry,type NativeSpatialPrimitive} from './native-spatial-geometry';
import {nativeSpatialShortestPaths} from './native-spatial-visibility';
import type {NativeSpatialStructure} from './native-spatial-structures';
import type {NativeSpatialGateResult,NativeSpatialPolicy} from './native-spatial-types';

type Point=Readonly<Vector2>;
/** Only actual endpoint/node positions are consumed by the route gate. This
 * narrow view also lets attempt-local probes reuse the same evaluator. */
export interface NativeSpatialRouteLayout {
  readonly spawnPoint:Point;readonly extractionPoint:Readonly<{position:Point}>;
  readonly kindlingNodes:readonly Readonly<{id:string;position:Point}>[];
  readonly contaminantNodes:readonly Readonly<{id:string;position:Point}>[];
}
export interface NativeSpatialRouteOptions {
  /** Revision 14 opts in. Omission preserves revision 12/13 measurements exactly. */
  readonly transverseMode?:'legacy-complete'|'per-leg';
  /** Global object ratio and actual shelter coverage remain separate hard gates. */
  readonly encounterShareQualityOnly?:boolean;
}
export interface NativeRouteHoleShareClassification {
  readonly accepted:boolean;
  readonly continuousAccepted:boolean;
  readonly phaseAccepted:boolean;
  readonly basis:'continuous-band'|'periodic-phase'|'outside';
}
/** Count-only calibration for a complete, already eligible first-encounter
 * sequence. Preserve the continuous band and add integer phases of the frozen
 * H:S cycle; eligibility and six-encounter windows stay with the caller. */
export function classifyNativeRouteHoleShare(holes:number,total:number,policy:Pick<NativeSpatialPolicy,'minRouteHoleShare'|'maxRouteHoleShare'|'holeToSolidRatio'>):NativeRouteHoleShareClassification {
  const {minRouteHoleShare:min,maxRouteHoleShare:max,holeToSolidRatio:ratio}=policy;
  if(!Number.isSafeInteger(holes)||!Number.isSafeInteger(total)||total<=0||holes<0||holes>total
    ||!Number.isFinite(min)||!Number.isFinite(max)||min<0||min>max||max>1
    ||!Number.isSafeInteger(ratio)||ratio<=0||!Number.isSafeInteger(ratio+1)||!Number.isSafeInteger(ratio*total))
    throw new Error('Invalid native route hole-share count or frozen cycle');
  const share=holes/total,continuousAccepted=share>=min&&share<=max,ideal=ratio*total/(ratio+1);
  const phaseAccepted=holes>=Math.floor(ideal)&&holes<=Math.ceil(ideal);
  return{accepted:continuousAccepted||phaseAccepted,continuousAccepted,phaseAccepted,basis:continuousAccepted?'continuous-band':phaseAccepted?'periodic-phase':'outside'};
}
const distance=(a:Point,b:Point):number=>Math.hypot(a.x-b.x,a.y-b.y);
const cellAt=(p:Point,cols:number):number=>Math.floor(p.y/8)*cols+Math.floor(p.x/8);
function project(p:Point,ax:number,ay:number,bx:number,by:number):Vector2 {const dx=bx-ax,dy=by-ay,n=dx*dx+dy*dy,t=n?Math.max(0,Math.min(1,((p.x-ax)*dx+(p.y-ay)*dy)/n)):0;return{x:ax+t*dx,y:ay+t*dy};}
function edges(p:NativeSpatialPrimitive):readonly (readonly number[])[]{const a=p.points;return a.length===4?[a]:[[a[0]!,a[1]!,a[2]!,a[3]!],[a[2]!,a[3]!,a[4]!,a[5]!],[a[4]!,a[5]!,a[0]!,a[1]!]];}
/** Test an actual ground-side point facing this observer, not an object's centroid. */
function encounters(p:Point,structure:NativeSpatialStructure,geometry:NativeSpatialGeometry,radius:number):boolean {
  if(structure.distance(p)>radius)return false;
  for(const primitive of structure.boundary){if(Math.max(primitive.minX-p.x,0,p.x-primitive.maxX)**2+Math.max(primitive.minY-p.y,0,p.y-primitive.maxY)**2>radius*radius)continue;
    for(const [ax,ay,bx,by] of edges(primitive)){const near=project(p,ax!,ay!,bx!,by!),length=distance(p,near);if(length>radius||length<1e-7)continue;
      const facing={x:near.x+(p.x-near.x)/length*.5,y:near.y+(p.y-near.y)/length*.5};
      if(!geometry.sight.isOpaque(Math.floor(facing.x/8),Math.floor(facing.y/8))
        &&(structure.kind!=='solid'||geometry.solidDistance(facing)>1e-7)&&hasLineOfSight(geometry.sight,p,facing))return true;
    }
  }return false;
}
/** Smoothed geometry is the sole encounter detector. Its parent body's nearest
 * real graph edge supplies only a stable shared-trunk identity, never a second
 * observation position. Equal projections retain original path order. */
function eventBodyEdge(point:Point,at:number,cells:readonly number[],cols:number):string {
  if(at===0||cells.length<2)return `vertex:${cells[0]}`;
  let best=Infinity,key='';
  for(let i=1;i<cells.length;i++){
    const a=cells[i-1]!,b=cells[i]!,pa=nativeCellPoint(a,cols),pb=nativeCellPoint(b,cols);
    const nearest=project(point,pa.x,pa.y,pb.x,pb.y),d=(nearest.x-point.x)**2+(nearest.y-point.y)**2;
    if(d<best){best=d;key=a<b?`${a}:${b}`:`${b}:${a}`;}
  }
  return key;
}
function rawPath(target:number,parent:Int32Array):number[]{const result:number[]=[];let cell=target;while(cell>=0){result.push(cell);cell=parent[cell]!;}return result.reverse();}
/** Farthest feasible point first, from each already accepted point; never alter ties for H:S. */
function smooth(cells:readonly number[],geometry:NativeSpatialGeometry):Vector2[]{if(!cells.length)return[];const points=cells.map(cell=>nativeCellPoint(cell,geometry.terrain.cols)),result=[points[0]!];let from=0;
  while(from<points.length-1){let to=points.length-1;for(;to>from+1;to--){const a=points[from]!,b=points[to]!;if(geometry.collision.displacementFraction(a,10,10,b.x-a.x,b.y-a.y)>=1-1e-9)break;}result.push(points[to]!);from=to;}return result;
}
interface Sample {readonly point:Vector2;readonly at:number;readonly span:number}
function samplePath(points:readonly Point[]):{samples:Sample[];length:number;at:(d:number)=>Vector2}{const offsets=[0];for(let i=1;i<points.length;i++)offsets.push(offsets[i-1]!+distance(points[i-1]!,points[i]!));const length=offsets[offsets.length-1]??0;
  const at=(d:number):Vector2=>{d=Math.max(0,Math.min(length,d));let i=1;while(i<offsets.length&&offsets[i]!<d)i++;if(i===offsets.length)return{...points[points.length-1]!};const a=points[i-1]!,b=points[i]!,span=offsets[i]!-offsets[i-1]!,t=span?(d-offsets[i-1]!)/span:0;return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};};
  const samples:Sample[]=[];for(let d=0;d<length;d+=8)samples.push({point:at(d),at:d,span:Math.min(8,length-d)});if(!samples.length&&points.length)samples.push({point:{...points[0]!},at:0,span:0});return{samples,length,at};
}
/** Exact segment intersections on final solid triangles, bounded by a ray/AABB traversal. */
function solidRay(root:NativeSpatialBvh,p:Point,dx:number,dy:number,limit:number):number {let best=limit;
  function visit(node:NativeSpatialBvh):void {let lo=0,hi=best;for(const [v,d,min,max] of [[p.x,dx,node.minX,node.maxX],[p.y,dy,node.minY,node.maxY]]){if(Math.abs(d!)<1e-10){if(v!<min!||v!>max!)return;}else{let a=(min!-v!)/d!,b=(max!-v!)/d!;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);if(lo>hi)return;}}
    if(node.items){for(const primitive of node.items)for(const [ax,ay,bx,by] of edges(primitive)){const ex=bx!-ax!,ey=by!-ay!,den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)continue;const rx=ax!-p.x,ry=ay!-p.y,t=(rx*ey-ry*ex)/den,u=(rx*dy-ry*dx)/den;if(t>=0&&t<best&&u>=0&&u<=1)best=t;}return;}
    visit(node.left!);visit(node.right!);
  }visit(root);return best;
}
interface TransverseMeasurement {
  readonly lengthPx:number;readonly narrowPx:number;readonly narrowRatio:number;
  readonly maxNarrowOrUncertainRunPx:number;readonly uncertainPx:number;
  readonly sections:readonly Record<string,unknown>[];readonly accepted:boolean;
}
interface LegTransverseMeasurement extends TransverseMeasurement {
  readonly legIndex:number;readonly startAtPx:number;
}
function crossSections(points:readonly Point[],geometry:NativeSpatialGeometry,solidTree:NativeSpatialBvh,policy:NativeSpatialPolicy):TransverseMeasurement {
  const path=samplePath(points),records:Record<string,unknown>[]=[],hit=createRayHit();let narrowPx=0,uncertainPx=0,run=0,maxRun=0;
  for(const sample of path.samples){const p=sample.point,a=path.at(sample.at-32),b=path.at(sample.at+32),inX=p.x-a.x,inY=p.y-a.y,outX=b.x-p.x,outY=b.y-p.y,inLength=Math.hypot(inX,inY),outLength=Math.hypot(outX,outY),axisX=b.x-a.x,axisY=b.y-a.y,axisLength=Math.hypot(axisX,axisY);
    const turn=inLength>1e-7&&outLength>1e-7?(inX*outX+inY*outY)/(inLength*outLength):1;
    if(axisLength<1e-7||turn<.5){uncertainPx+=sample.span;run+=sample.span;maxRun=Math.max(maxRun,run);records.push({at:sample.at,kind:'uncertain-turn',span:sample.span});continue;}
    const nx=-axisY/axisLength,ny=axisX/axisLength,sides:number[]=[];
    for(const sign of [-1,1]){castRayDirection(geometry.sight,p.x,p.y,nx*sign,ny*sign,policy.referenceSightPx,hit);sides.push(Math.min(hit.dist,solidRay(solidTree,p,nx*sign,ny*sign,policy.referenceSightPx)));}
    const width=sides[0]!+sides[1]!,clipped=sides.some(d=>d>=policy.referenceSightPx-1e-7),narrow=width<policy.narrowWidthPx;
    if(narrow){narrowPx+=sample.span;run+=sample.span;}else run=0;maxRun=Math.max(maxRun,run);
    records.push({at:sample.at,widthLowerPx:width,closed:!clipped,kind:narrow?'narrow':'wide',sides});
  }
  return{lengthPx:path.length,narrowPx,narrowRatio:path.length?narrowPx/path.length:0,maxNarrowOrUncertainRunPx:maxRun,uncertainPx,sections:records,accepted:(path.length?narrowPx/path.length:0)<=policy.maxNarrowRatio&&maxRun<=policy.maxNarrowRunPx};
}
/** A stop separates physical legs, not travelled distance. Keep uncertain turns
 * conservative within each leg, but never join its narrow run to the next leg. */
function legCrossSections(paths:readonly (readonly Point[])[],geometry:NativeSpatialGeometry,solidTree:NativeSpatialBvh,policy:NativeSpatialPolicy):TransverseMeasurement&{scope:'per-leg';legs:readonly LegTransverseMeasurement[]} {
  const legs:LegTransverseMeasurement[]=[],sections:Record<string,unknown>[]=[];
  let lengthPx=0,narrowPx=0,uncertainPx=0,maxRun=0;
  for(const [legIndex,points] of paths.entries()){
    const measured=crossSections(points,geometry,solidTree,policy);
    legs.push({legIndex,startAtPx:lengthPx,...measured});
    for(const section of measured.sections)sections.push({...section,at:lengthPx+(section.at as number),legIndex,legAtPx:section.at});
    lengthPx+=measured.lengthPx;narrowPx+=measured.narrowPx;uncertainPx+=measured.uncertainPx;
    maxRun=Math.max(maxRun,measured.maxNarrowOrUncertainRunPx);
  }
  const narrowRatio=lengthPx?narrowPx/lengthPx:0;
  return{scope:'per-leg',lengthPx,narrowPx,narrowRatio,maxNarrowOrUncertainRunPx:maxRun,uncertainPx,sections,legs,accepted:narrowRatio<=policy.maxNarrowRatio&&maxRun<=policy.maxNarrowRunPx};
}
export function evaluateNativeSpatialRoutes(geometry:NativeSpatialGeometry,structures:readonly NativeSpatialStructure[],policy:NativeSpatialPolicy,layout:NativeSpatialRouteLayout,options:NativeSpatialRouteOptions={}):NativeSpatialGateResult {
  const perLeg=options.transverseMode==='per-leg';
  const {cols}=geometry.terrain,start=cellAt(layout.spawnPoint,cols),exit=cellAt(layout.extractionPoint.position,cols),reasons:string[]=[],qualityDiagnostics:string[]=[];
  if(!geometry.reachable[start]||!geometry.reachable[exit])return{accepted:false,reasons:['route-endpoint-outside-body-domain'],metrics:{start,exit}};
  const fromSpawn=nativeSpatialShortestPaths(geometry,[start]),fromExit=nativeSpatialShortestPaths(geometry,[exit]);
  const ordered=[...structures].sort((a,b)=>a.id.localeCompare(b.id)),solidTree=nativePrimitiveTree(geometry.solidPrimitives),reachable:number[]=[];
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(let cell=0;cell<geometry.reachable.length;cell++)if(geometry.reachable[cell]){reachable.push(cell);const p=nativeCellPoint(cell,cols);minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);}
  const regionOf=(p:Point):number=>Math.min(2,Math.floor((p.y-minY)/Math.max(1,maxY-minY+8)*3))*4+Math.min(3,Math.floor((p.x-minX)/Math.max(1,maxX-minX+8)*4));
  const regions=Array.from({length:12},()=>[] as number[]);for(const cell of reachable)regions[regionOf(nativeCellPoint(cell,cols))]!.push(cell);
  const routes:{id:string;target:number;kind:string;interactionSeats?:number;cells:number[];legs:number[][]}[]=[{id:'direct-exit',target:exit,kind:'exit',cells:rawPath(exit,fromSpawn.parent),legs:[rawPath(exit,fromSpawn.parent)]}];
  function add(id:string,target:number,kind:string,interactionSeats?:number):void {const outward=rawPath(target,fromSpawn.parent),homeward=rawPath(target,fromExit.parent).reverse();routes.push({id,target,kind,interactionSeats,cells:[...outward,...homeward.slice(1)],legs:[outward,homeward]});}
  for(const node of [...layout.kindlingNodes,...layout.contaminantNodes].sort((a,b)=>a.id.localeCompare(b.id))){let target=-1,cost=Infinity,seats=0;const radius=GAME_CONSTANTS.LOOT.SEARCH_RADIUS;
    for(const cell of reachable){const p=nativeCellPoint(cell,cols);if(distance(p,node.position)>radius||!hasLineOfSight(geometry.sight,p,node.position,radius+.001))continue;seats++;const value=fromSpawn.distance[cell]!+fromExit.distance[cell]!;if(value<cost||(value===cost&&cell<target)){cost=value;target=cell;}}
    if(target<0)reasons.push(`node:${node.id}:no-legal-interaction-seat`);else add(`node:${node.id}`,target,'search',seats);
  }
  regions.forEach((cells,index)=>{if(!cells.length)return;let x=0,y=0;for(const cell of cells){const p=nativeCellPoint(cell,cols);x+=p.x;y+=p.y;}const center={x:x/cells.length,y:y/cells.length};let best=cells[0]!,d=Infinity;for(const cell of cells){const candidate=distance(nativeCellPoint(cell,cols),center);if(candidate<d){d=candidate;best=cell;}}add(`explore:${index}`,best,'explore');});
  const results:Record<string,unknown>[]=[],uniqueEdges=new Map<string,readonly[number,number]>();
  const firstEvents:{id:string;kind:'hole'|'solid';region:number;bodyEdge:string;routeId:string;at:number}[]=[];let sufficient=0;
  for(const route of routes){
    for(let i=1;i<route.cells.length;i++){const a=route.cells[i-1]!,b=route.cells[i]!,key=a<b?`${a}:${b}`:`${b}:${a}`;if(!uniqueEdges.has(key))uniqueEdges.set(key,[a,b]);}
    // Smooth each leg independently so the real stop/turn at a searched node remains present.
    const legPaths=route.legs.map(leg=>smooth(leg,geometry)),points=legPaths.flatMap((leg,i)=>i?leg.slice(1):leg),path=samplePath(points),seen=new Set<string>(),events:{id:string;kind:'hole'|'solid';at:number;region:number;bodyEdge:string}[]=[];
    for(const sample of path.samples)for(const structure of ordered)if(!seen.has(structure.id)&&encounters(sample.point,structure,geometry,policy.encounterRadiusPx)){seen.add(structure.id);const event={id:structure.id,kind:structure.kind,at:sample.at,region:regionOf(sample.point),bodyEdge:eventBodyEdge(sample.point,sample.at,route.cells,cols)};events.push(event);firstEvents.push({...event,routeId:route.id});}
    const holes=events.filter(event=>event.kind==='hole').length,eligible=path.length>=policy.minRouteLengthPx&&events.length>=policy.minRouteEncounters,share=events.length?holes/events.length:null,windowFailures:number[]=[];
    const holeShareAdmission=eligible?classifyNativeRouteHoleShare(holes,events.length,policy):null;
    if(eligible){sufficient++;if(!holeShareAdmission!.accepted)qualityDiagnostics.push(`${route.id}:hole-share`);for(let i=0;i+policy.windowSize<=events.length;i++)if(events.slice(i,i+policy.windowSize).filter(e=>e.kind==='hole').length<policy.minWindowHoles)windowFailures.push(i);if(windowFailures.length)qualityDiagnostics.push(`${route.id}:six-encounter-window`);}
    const byLeg=perLeg?legCrossSections(legPaths,geometry,solidTree,policy):undefined;
    const sections=byLeg??crossSections(points,geometry,solidTree,policy);
    if(sections.narrowRatio>policy.maxNarrowRatio)qualityDiagnostics.push(`${route.id}:narrow-ratio`);
    if(byLeg){
      for(const leg of byLeg.legs)if(leg.maxNarrowOrUncertainRunPx>policy.maxNarrowRunPx)reasons.push(`${route.id}:leg:${leg.legIndex}:max-narrow-run`);
    }else if(sections.maxNarrowOrUncertainRunPx>policy.maxNarrowRunPx)reasons.push(`${route.id}:max-narrow-run`);
    const legs=legPaths.map(leg=>{const sampled=samplePath(leg),identities=new Set<string>();for(const point of sampled.samples)for(const structure of ordered)if(!identities.has(structure.id)&&encounters(point.point,structure,geometry,policy.encounterRadiusPx))identities.add(structure.id);return{lengthPx:sampled.length,encounters:[...identities],diagnosticOnly:true,short:sampled.length<policy.minRouteLengthPx};});
    results.push({id:route.id,kind:route.kind,target:route.target,interactionSeats:route.interactionSeats,cells:route.cells,smoothedPoints:points,lengthPx:path.length,events,holeShare:share,holeShareAdmission,eligible,windowFailures,legs,transverse:sections});
  }
  // Consume only the complete, smoothed route's FIRST encounter events.
  // A later raw-path proximity must never invent a new observation or region.
  const regional=Array.from({length:12},()=>new Map<string,'hole'|'solid'>()),sharedTrunkEvents=new Set<string>();
  const regionalEvents:typeof firstEvents=[];let repeatedTrunkEvents=0,repeatedRegionEvents=0;
  for(const event of firstEvents){
    const trunkKey=`${event.bodyEdge}|${event.id}`;
    if(sharedTrunkEvents.has(trunkKey)){repeatedTrunkEvents++;continue;}
    sharedTrunkEvents.add(trunkKey);
    if(regional[event.region]!.has(event.id)){repeatedRegionEvents++;continue;}
    regional[event.region]!.set(event.id,event.kind);regionalEvents.push(event);
  }
  const regionReports=regional.map((identities,id)=>{const holes=[...identities.values()].filter(k=>k==='hole').length;return{id,structures:[...identities.keys()],holes,solids:identities.size-holes,eligible:identities.size>=policy.minRouteEncounters,holeShare:identities.size?holes/identities.size:null};});
  const eligibleRegions=regionReports.filter(row=>row.eligible);if(!sufficient)reasons.push('insufficient-complete-route-encounter-evidence');
  // Each route contributes its actual first encounters, including short routes.
  // Shared structures/trunks count again on another route: this measures the
  // complete route family's exposure, not unique map-object population.
  const holeEncounters=firstEvents.filter(event=>event.kind==='hole').length,solidEncounters=firstEvents.length-holeEncounters;
  const overallHoleShare=firstEvents.length?holeEncounters/firstEvents.length:null;
  if(overallHoleShare===null)reasons.push('overall-route-hole-share');
  else if(overallHoleShare<policy.minRouteHoleShare||overallHoleShare>policy.maxRouteHoleShare)
    (options?.encounterShareQualityOnly?qualityDiagnostics:reasons).push('overall-route-hole-share');
  return{accepted:reasons.length===0,reasons,qualityDiagnostics,metrics:{algorithm:'native-spatial-v1',pathOrder:'direct exit; node ID; 4x3 region row/column',pathTie:'integer 8-neighbour cost then y,x; equal parent y,x',interactionChoice:'minimum complete spawn-seat-exit graph distance among every legal 48px LOS seat; y,x ties',smoothing:'per leg, greedy farthest feasible 20px swept-body segment',routes:results,qualifyingCompleteRoutes:sufficient,overallEncounters:{holes:holeEncounters,solids:solidEncounters,total:firstEvents.length,holeShare:overallHoleShare,minHoleShare:policy.minRouteHoleShare,maxHoleShare:policy.maxRouteHoleShare,basis:'All complete routes, including short samples; each structure once per route. Repeated structures and shared trunks across routes count again.'},uniqueUndirectedEdges:uniqueEdges.size,regionalEventBasis:'first encounters on the same smoothed complete routes; shared body-edge + identity, then original event region + identity',regionalEvents,repeatedTrunkEvents,repeatedRegionEvents,regions:regionReports,excludedRegions:12-eligibleRegions.length,regionalMeanHoleShare:eligibleRegions.length?eligibleRegions.reduce((sum,row)=>sum+row.holeShare!,0)/eligibleRegions.length:null,regionalCalibrationOnly:true,shoreBays:'Excluded from H/S; no bays promoted to internal holes',transverseScope:perLeg?'Per actual leg: 8px samples; +/-32px local axis clamped to that leg; first actual VOID or solid boundary each side within224px; clipped widths are lower bounds; uncertain turns cannot reset a run within a leg; runs never cross a stop; route narrowRatio uses summed travelled narrowPx / summed leg lengthPx':'8px samples; +/-32px local axis; first actual VOID or solid boundary each side within224px; clipped widths are lower bounds; uncertain turns cannot reset a narrow run',transverseAdmission:perLeg?'Each actual leg maxNarrowOrUncertainRunPx is hard; route maximum is the maximum of its legs. Aggregate mileage-weighted narrowRatio is quality-only; transverse.accepted retains the combined diagnostic.':'Only maxNarrowOrUncertainRunPx is hard; narrowRatio is quality-only. Per-route transverse.accepted retains the original combined diagnostic.'}};
}
