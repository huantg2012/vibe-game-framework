/** Pure spatial measurements. Real solid triangles and real missing ground remain distinct. */
import { compileNativeTerrain, type NativeTerrain } from './native-terrain';
import { NativeBodyCollision } from './native-body-collision';
import type { MasterDefinition } from './r100-master-world';
import type { SpatialAugmentationParameters, SpatialAugmentationAxis, SpatialDeficits } from './spatial-augmentation-types';
import { TileType, type Vector2 } from '@/types/game-types';
import type { OccluderGrid } from '@/types/map-types';
import { hasLineOfSight } from '@/utils/grid-raycast';

interface Primitive {readonly points: readonly number[]; readonly objectId: number; readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number}
interface Bvh {readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly left?: Bvh; readonly right?: Bvh; readonly items?: readonly Primitive[]}
const step = 8, halfBody = 10;
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;
function primitive(points: readonly number[], objectId: number): Primitive {
  const xs = points.filter((_, index) => index % 2 === 0), ys = points.filter((_, index) => index % 2 === 1);
  return {points, objectId, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys)};
}
function tree(items: readonly Primitive[]): Bvh {
  const bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
  for (const item of items) {bounds.minX = Math.min(bounds.minX, item.minX); bounds.minY = Math.min(bounds.minY, item.minY); bounds.maxX = Math.max(bounds.maxX, item.maxX); bounds.maxY = Math.max(bounds.maxY, item.maxY);}
  if (items.length <= 8) return {...bounds, items};
  const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
  const sorted = [...items].sort((a, b) => horizontal ? a.minX + a.maxX - b.minX - b.maxX : a.minY + a.maxY - b.minY - b.maxY);
  const middle = Math.floor(sorted.length / 2);
  return {...bounds, left: tree(sorted.slice(0, middle)), right: tree(sorted.slice(middle))};
}
function segmentDistanceSq(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, size = dx * dx + dy * dy;
  const t = size === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / size));
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}
function distanceSq(x: number, y: number, p: Primitive): number {
  const a = p.points;
  if (a.length === 4) return segmentDistanceSq(x, y, a[0]!, a[1]!, a[2]!, a[3]!);
  const cross = (i: number, j: number): number => (a[j]! - a[i]!) * (y - a[i + 1]!) - (a[j + 1]! - a[i + 1]!) * (x - a[i]!);
  const e0 = cross(0, 2), e1 = cross(2, 4), e2 = cross(4, 0);
  if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) return 0;
  return Math.min(segmentDistanceSq(x, y, a[0]!, a[1]!, a[2]!, a[3]!), segmentDistanceSq(x, y, a[2]!, a[3]!, a[4]!, a[5]!), segmentDistanceSq(x, y, a[4]!, a[5]!, a[0]!, a[1]!));
}
function boundsDistanceSq(x: number, y: number, p: Bvh): number {return Math.max(p.minX - x, 0, x - p.maxX) ** 2 + Math.max(p.minY - y, 0, y - p.maxY) ** 2;}
function nearest(root: Bvh, x: number, y: number): number {
  let best = Infinity;
  function visit(node: Bvh): void {
    if (boundsDistanceSq(x, y, node) >= best) return;
    if (node.items) {for (const item of node.items) best = Math.min(best, distanceSq(x, y, item)); return;}
    const left = node.left!, right = node.right!;
    if (boundsDistanceSq(x, y, left) <= boundsDistanceSq(x, y, right)) {visit(left); visit(right);} else {visit(right); visit(left);}
  }
  visit(root); return Math.sqrt(best);
}
function solidPrimitives(terrain: NativeTerrain, includeRelief=false): Primitive[] {
  const ids = new Set(terrain.definition.instances.filter(item => includeRelief || item.role === 'solid').map(item => item.id)), result: Primitive[] = [];
  for (const mesh of terrain.meshes) {
    if (!ids.has(mesh.spec.id)) continue;
    for (let face = 0; face < (mesh.groundEdgeStart?.triangle ?? mesh.triangleCount); face++) {
      const points: number[] = [];
      for (let corner = 0; corner < 3; corner++) {const at = mesh.indices[face * 3 + corner]! * 3; points.push(mesh.positions[at]!, mesh.positions[at + 1]!);}
      const area = (points[2]! - points[0]!) * (points[5]! - points[1]!) - (points[3]! - points[1]!) * (points[4]! - points[0]!);
      if (Math.abs(area) > 1e-7) result.push(primitive(points, mesh.spec.id));
    }
  }
  return result;
}
function voidPrimitives(terrain: NativeTerrain): Primitive[] {
  const grid = terrain.tileMap, result: Primitive[] = [];
  const matter = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.tiles[y]![x] !== TileType.VOID;
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
    if (!matter(x, y)) continue;
    const left = x * step, top = y * step, right = left + step, bottom = top + step;
    if (!matter(x - 1, y)) result.push(primitive([left, top, left, bottom], -1));
    if (!matter(x + 1, y)) result.push(primitive([right, top, right, bottom], -1));
    if (!matter(x, y - 1)) result.push(primitive([left, top, right, top], -1));
    if (!matter(x, y + 1)) result.push(primitive([left, bottom, right, bottom], -1));
  }
  return result;
}

export interface SpatialGeometry {
  readonly terrain: NativeTerrain; readonly collision: NativeBodyCollision; readonly supported: Uint8Array; readonly reachable: Uint8Array;
  readonly links: Uint8Array; readonly sight: OccluderGrid; readonly supportedCount: number; readonly reachableCount: number;
  readonly matterCount: number; readonly solidCells: Uint8Array; readonly protectedSupport: Uint8Array;
  readonly solidDistance: (point: Readonly<Vector2>) => number; readonly voidDistance: (point: Readonly<Vector2>) => number;
}
export interface SpatialProbe {
  readonly point: Readonly<Vector2>; readonly cell: number; readonly solidDistance: number; readonly voidDistance: number;
  readonly physicalCost: number; readonly occlusionCost: number | null;
  readonly pairs: readonly {readonly endpoint: Readonly<Vector2>; readonly originallyBlocked: boolean}[];
}
export interface SpatialBaseline {
  readonly geometry: SpatialGeometry; readonly probes: readonly SpatialProbe[]; readonly deficits: SpatialDeficits;
  readonly parameters: SpatialAugmentationParameters; readonly wideAnchors: readonly Readonly<Vector2>[];
  readonly wideCoreCount: number; readonly largestOpenCore: number; readonly wideAnchorGroups: readonly (readonly number[])[];
}
export interface SpatialMeasuredState {
  readonly geometry: SpatialGeometry; readonly deficits: SpatialDeficits;
  readonly physicalCosts: readonly number[]; readonly occlusionCosts: readonly (number | null)[];
  readonly clearRadii: readonly number[]; readonly survivingProbes: readonly boolean[];
  readonly removedBaseRatio: number; readonly addedSolidRatio: number; readonly bodyCenterLossRatio: number;
  readonly wideCoreRetainedRatio: number | null; readonly largestOpenCoreRetainedRatio: number | null; readonly anchorsConnected: boolean;
}
export interface SpatialHotspot {readonly point: Readonly<Vector2>; readonly axis: SpatialAugmentationAxis; readonly burden: number}
export const spatialCellPoint = (cell: number, cols: number): Vector2 => ({x:(cell%cols+.5)*step,y:(Math.floor(cell/cols)+.5)*step});
export function spatialReachable(geometry: SpatialGeometry, point: Readonly<Vector2>): boolean {
  const {cols,rows} = geometry.terrain, x=Math.floor(point.x/step), y=Math.floor(point.y/step);
  return x>=0 && y>=0 && x<cols && y<rows && geometry.reachable[y*cols+x]===1 && geometry.collision.supports(point,halfBody,halfBody);
}
export function buildSpatialGeometry(definition: MasterDefinition, seed: number): SpatialGeometry {
  // Candidate meshes omit appended shore walls. Their actual VOID mask provides
  // terrain support/LOS; the final world rebuilds the shared visible shore mesh.
  const terrain=compileNativeTerrain(definition,seed,false), {cols,rows}=terrain, count=cols*rows;
  const collision=new NativeBodyCollision({definition,meshes:terrain.meshes},terrain.tileMap);
  const supported=new Uint8Array(count), reachable=new Uint8Array(count), links=new Uint8Array(count), solidCells=new Uint8Array(count);
  let supportedCount=0, matterCount=0;
  for(let i=0;i<count;i++) {
    supported[i]=Number(collision.supports(spatialCellPoint(i,cols),halfBody,halfBody));supportedCount+=supported[i]!;
    matterCount+=terrain.matter[i]!;solidCells[i]=Number(terrain.tileMap.tiles[Math.floor(i/cols)]![i%cols]===TileType.WALL);
  }
  for(let i=0;i<count;i++) if(supported[i]) for(let d=0;d<2;d++) {
    const [dx,dy]=directions[d]!, x=i%cols+dx,y=Math.floor(i/cols)+dy,next=y*cols+x;
    if(x>=cols||y>=rows||!supported[next])continue;
    if(collision.displacementFraction(spatialCellPoint(i,cols),halfBody,halfBody,dx*step,dy*step)>=1-1e-9){links[i]=links[i]!|(1<<d);links[next]=links[next]!|(1<<(d+2));}
  }
  const start=Math.floor(terrain.spawnPoint.y/step)*cols+Math.floor(terrain.spawnPoint.x/step),queue=new Int32Array(count);
  if(!supported[start])throw new Error('Augmentation terrain has no supported spawn');
  let head=0,tail=1;queue[0]=start;reachable[start]=1;
  while(head<tail){const cell=queue[head++]!;for(let d=0;d<4;d++)if(links[cell]!&(1<<d)){
    const next=cell+directions[d]![0]+directions[d]![1]*cols;if(!reachable[next]){reachable[next]=1;queue[tail++]=next;}
  }}
  const solidTree=tree(solidPrimitives(terrain)),voidTree=tree(voidPrimitives(terrain));
  const protectedSupport=new Uint8Array(count),protectedIds=new Set(definition.instances.filter(row=>row.groundEdgeWidth===undefined).map(row=>row.id));
  for(const point of spatialSolidFootprint(terrain,protectedIds,true)) {
    const x=Math.floor(point.x/step),y=Math.floor(point.y/step),index=y*cols+x;
    if(x>=0&&y>=0&&x<cols&&y<rows&&terrain.matter[index])protectedSupport[index]=1;
  }
  return {terrain,collision,supported,reachable,links,supportedCount,reachableCount:tail,matterCount,solidCells,protectedSupport,
    sight:{cols,rows,tileSize:step,version:0,isOpaque:(x,y)=>x<0||y<0||x>=cols||y>=rows||!terrain.matter[y*cols+x]},
    solidDistance:point=>nearest(solidTree,point.x,point.y),voidDistance:point=>nearest(voidTree,point.x,point.y)};
}
const clamp01=(value:number):number=>Math.max(0,Math.min(1,value));
function physicalCost(clear:number,p:SpatialAugmentationParameters):number{return clamp01((clear-p.physicalRadiusPx)/p.referenceSightPx);}
function occlusionCost(blocked:number,pairs:number,p:SpatialAugmentationParameters):number|null{return pairs<p.minValidOcclusionPairs?null:clamp01((p.targetBlockedPairRatio-blocked/pairs)/p.targetBlockedPairRatio);}
function deficits(physical:readonly number[],occlusion:readonly(number|null)[]):SpatialDeficits {
  const eligible=occlusion.filter((value):value is number=>value!==null);
  return {physical:physical.length?physical.reduce((a,b)=>a+b,0)/physical.length:0,occlusion:eligible.length?eligible.reduce((a,b)=>a+b,0)/eligible.length:0};
}
/** Connected sampled open cores, with all intervening 8px centers checked. */
function coreComponents(probes:readonly SpatialProbe[],radii:readonly number[],geometry:SpatialGeometry,threshold:number,spacing:number):number[][] {
  const byPosition=new Map(probes.map((probe,i)=>[`${probe.point.x}:${probe.point.y}`,i])),seen=new Set<number>(),groups:number[][]=[];
  for(let index=0;index<probes.length;index++) {
    if(seen.has(index)||radii[index]!<threshold)continue;
    const group=[index];seen.add(index);
    for(let at=0;at<group.length;at++) for(const [dx,dy] of directions) {
      const p=probes[group[at]!]!.point,next=byPosition.get(`${p.x+dx*spacing}:${p.y+dy*spacing}`);
      if(next===undefined||seen.has(next)||radii[next]!<threshold)continue;
      let clear=true;
      for(let distance=step;distance<spacing;distance+=step){const q={x:p.x+dx*distance,y:p.y+dy*distance};
        if(!spatialReachable(geometry,q)||Math.min(geometry.solidDistance(q),geometry.voidDistance(q))<threshold){clear=false;break;}}
      if(clear){seen.add(next);group.push(next);}
    }
    groups.push(group);
  }
  return groups;
}
export function createSpatialBaseline(geometry:SpatialGeometry,parameters:SpatialAugmentationParameters):SpatialBaseline {
  const probes:SpatialProbe[]=[],spacing=parameters.probeStepPx;
  for(let y=step/2;y<geometry.terrain.height;y+=spacing)for(let x=step/2;x<geometry.terrain.width;x+=spacing) {
    const point={x,y};if(!spatialReachable(geometry,point))continue;
    const pairs:{endpoint:Vector2;originallyBlocked:boolean}[]=[];
    for(const radius of [parameters.physicalRadiusPx,parameters.occlusionRadiusPx])for(let direction=0;direction<8;direction++){
      const unit=[[1,0],[Math.SQRT1_2,Math.SQRT1_2],[0,1],[-Math.SQRT1_2,Math.SQRT1_2],[-1,0],[-Math.SQRT1_2,-Math.SQRT1_2],[0,-1],[Math.SQRT1_2,-Math.SQRT1_2]][direction]!;
      const endpoint={x:x+unit[0]!*radius,y:y+unit[1]!*radius};
      if(spatialReachable(geometry,endpoint))pairs.push({endpoint,originallyBlocked:!hasLineOfSight(geometry.sight,point,endpoint)});
    }
    const solidDistance=geometry.solidDistance(point),voidDistance=geometry.voidDistance(point);
    probes.push({point,cell:Math.floor(y/step)*geometry.terrain.cols+Math.floor(x/step),solidDistance,voidDistance,
      physicalCost:physicalCost(Math.min(solidDistance,voidDistance),parameters),
      occlusionCost:occlusionCost(pairs.filter(pair=>pair.originallyBlocked).length,pairs.length,parameters),pairs});
  }
  const radii=probes.map(probe=>Math.min(probe.solidDistance,probe.voidDistance)),wide=probes.filter((_,i)=>radii[i]!>=parameters.wideCoreRadiusPx);
  const wideGroups=coreComponents(probes,radii,geometry,parameters.wideCoreRadiusPx,spacing);
  const wideAnchorGroups=wideGroups.map(group=>{
    const anchors=new Map<string,number>();
    for(const index of group){const probe=probes[index]!,key=`${Math.floor(probe.point.x/(geometry.terrain.width/4))}:${Math.floor(probe.point.y/(geometry.terrain.height/3))}`;
      const previous=anchors.get(key);if(previous===undefined||radii[index]!>radii[previous]!)anchors.set(key,index);}
    return [...anchors.values()];
  });
  const largestOpenCore=Math.max(0,...coreComponents(probes,radii,geometry,parameters.physicalRadiusPx,spacing).map(group=>group.length));
  return {geometry,parameters,probes,deficits:deficits(probes.map(p=>p.physicalCost),probes.map(p=>p.occlusionCost)),
    wideAnchors:wideAnchorGroups.flat().map(index=>probes[index]!.point),wideAnchorGroups,wideCoreCount:wide.length,largestOpenCore};
}
export function measureSpatialCandidate(baseline:SpatialBaseline,geometry:SpatialGeometry):SpatialMeasuredState {
  const p=baseline.parameters,physicalCosts:number[]=[],occlusionCosts:(number|null)[]=[],clearRadii:number[]=[],survivingProbes:boolean[]=[];
  let wideRetained=0;
  for(const probe of baseline.probes){const supported=spatialReachable(geometry,probe.point);survivingProbes.push(supported);
    const clear=supported?Math.min(geometry.solidDistance(probe.point),geometry.voidDistance(probe.point)):0;clearRadii.push(clear);
    // Removing any endpoint cannot make its original visibility cost disappear.
    physicalCosts.push(supported?physicalCost(clear,p):probe.physicalCost);
    let blocked=0;for(const pair of probe.pairs)blocked+=Number(!supported||!spatialReachable(geometry,pair.endpoint)?pair.originallyBlocked:!hasLineOfSight(geometry.sight,probe.point,pair.endpoint));
    occlusionCosts.push(supported?occlusionCost(blocked,probe.pairs.length,p):probe.occlusionCost);
    if(Math.min(probe.solidDistance,probe.voidDistance)>=p.wideCoreRadiusPx&&clear>=p.wideCoreRadiusPx)wideRetained++;
  }
  let removed=0,added=0,lost=0;
  for(let i=0;i<geometry.supported.length;i++){
    if(baseline.geometry.terrain.matter[i]&&!geometry.terrain.matter[i])removed++;
    if(baseline.geometry.terrain.matter[i]&&geometry.solidCells[i]&&!baseline.geometry.solidCells[i])added++;
    if(baseline.geometry.reachable[i]&&!geometry.reachable[i])lost++;
  }
  const largest=Math.max(0,...coreComponents(baseline.probes,clearRadii,geometry,p.physicalRadiusPx,p.probeStepPx).map(group=>group.length));
  const wideGroups=coreComponents(baseline.probes,clearRadii,geometry,p.wideCoreRadiusPx,p.probeStepPx),componentByProbe=new Map<number,number>();
  wideGroups.forEach((group,index)=>group.forEach(probe=>componentByProbe.set(probe,index)));
  const anchorsConnected=baseline.wideAnchorGroups.every(group=>group.every(index=>componentByProbe.has(index)&&componentByProbe.get(index)===componentByProbe.get(group[0]!)));
  return {geometry,deficits:deficits(physicalCosts,occlusionCosts),physicalCosts,occlusionCosts,clearRadii,survivingProbes,
    removedBaseRatio:removed/baseline.geometry.matterCount,addedSolidRatio:added/baseline.geometry.matterCount,
    bodyCenterLossRatio:lost/baseline.geometry.reachableCount,wideCoreRetainedRatio:baseline.wideCoreCount?wideRetained/baseline.wideCoreCount:null,
    largestOpenCoreRetainedRatio:baseline.largestOpenCore?largest/baseline.largestOpenCore:null,
    anchorsConnected};
}
export function spatialHotspots(baseline:SpatialBaseline,current:SpatialMeasuredState,axis:SpatialAugmentationAxis):readonly SpatialHotspot[] {
  const p=baseline.parameters,eligible=new Set<number>();
  if(axis==='physical')for(const group of coreComponents(baseline.probes,current.clearRadii,current.geometry,p.physicalRadiusPx,p.probeStepPx)){
    const points=group.map(i=>baseline.probes[i]!.point),span=Math.max(Math.max(...points.map(q=>q.x))-Math.min(...points.map(q=>q.x)),Math.max(...points.map(q=>q.y))-Math.min(...points.map(q=>q.y)));
    if(span>=p.physicalComponentMinSpanPx||group.length*p.probeStepPx*p.probeStepPx>=p.physicalComponentMinAreaPx2)for(const i of group)eligible.add(i);
  }
  const costs=axis==='physical'?current.physicalCosts:current.occlusionCosts;
  const ranked=baseline.probes.map((probe,i)=>({probe,i,cost:costs[i]??0})).filter(row=>row.cost>0&&current.survivingProbes[row.i]&&(axis==='occlusion'||eligible.has(row.i)))
    .sort((a,b)=>b.cost-a.cost||current.clearRadii[b.i]!-current.clearRadii[a.i]!||a.probe.point.y-b.probe.point.y||a.probe.point.x-b.probe.point.x);
  const result:SpatialHotspot[]=[];
  for(const row of ranked){if(result.every(other=>Math.hypot(row.probe.point.x-other.point.x,row.probe.point.y-other.point.y)>=p.hotspotRadiusPx))result.push({point:row.probe.point,axis,burden:row.cost});if(result.length===3)break;}
  return result;
}

/** Conservative 8px footprint samples of selected projected triangles. Bboxes
 * only cull work; inclusion is a triangle distance test, never a bbox fill. */
export function spatialSolidFootprint(terrain:NativeTerrain,ids:ReadonlySet<number>,includeRelief=false):readonly Vector2[] {
  const primitives=solidPrimitives(terrain,includeRelief).filter(item=>ids.has(item.objectId));if(!primitives.length)return [];
  const root=tree(primitives),result:Vector2[]=[];
  for(let y=Math.floor(root.minY/step)*step+step/2;y<=root.maxY+step/2;y+=step)
    for(let x=Math.floor(root.minX/step)*step+step/2;x<=root.maxX+step/2;x+=step)
      if(nearest(root,x,y)<=Math.SQRT2*step/2)result.push({x,y});
  return result;
}
