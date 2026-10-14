/** Revision-12 geometry primitives. No historical augmentation costs or base-map policy. */
import {compileNativeTerrain, type NativeTerrain} from './native-terrain';
import {NativeBodyCollision} from './native-body-collision';
import type {MasterDefinition} from './r100-master-world';
import {TileType, type Vector2} from '@/types/game-types';
import type {OccluderGrid} from '@/types/map-types';

export const NATIVE_SPATIAL_CELL = 8;
export const NATIVE_SPATIAL_BODY_HALF = 10;
/** Versioned ordering; integer costs are 1/1000 world px. */
export const NATIVE_SPATIAL_DIRECTIONS = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]] as const;
export const NATIVE_SPATIAL_EDGE_COSTS = [8000,8000,8000,8000,11314,11314,11314,11314] as const;
const step=NATIVE_SPATIAL_CELL;
export const nativeCellPoint=(cell:number,cols:number):Vector2=>({x:(cell%cols+.5)*step,y:(Math.floor(cell/cols)+.5)*step});
export interface NativeSpatialPrimitive {readonly points: readonly number[]; readonly objectId: number; readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number}
export interface NativeSpatialBvh {readonly minX: number; readonly minY: number; readonly maxX: number; readonly maxY: number; readonly left?: NativeSpatialBvh; readonly right?: NativeSpatialBvh; readonly items?: readonly NativeSpatialPrimitive[]}
export function nativePrimitive(points: readonly number[], objectId: number): NativeSpatialPrimitive {
  const xs = points.filter((_, index) => index % 2 === 0), ys = points.filter((_, index) => index % 2 === 1);
  return {points, objectId, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys)};
}
/** One boundary convention for actual structure gates and prediction caches.
 * The supplied cells are the entire recognized label, including merged parts. */
export function nativeVoidCellBoundary(cells:readonly number[],cols:number,rows:number,objectId:number):NativeSpatialPrimitive[]{
  const members=new Set(cells),result:NativeSpatialPrimitive[]=[];
  for(const cell of cells){const x=cell%cols,y=Math.floor(cell/cols),l=x*step,t=y*step,r=l+step,b=t+step;
    if(x===0||!members.has(cell-1))result.push(nativePrimitive([l,t,l,b],objectId));
    if(x===cols-1||!members.has(cell+1))result.push(nativePrimitive([r,t,r,b],objectId));
    if(y===0||!members.has(cell-cols))result.push(nativePrimitive([l,t,r,t],objectId));
    if(y===rows-1||!members.has(cell+cols))result.push(nativePrimitive([l,b,r,b],objectId));
  }return result;
}

export function nativePrimitiveTree(items: readonly NativeSpatialPrimitive[]): NativeSpatialBvh {
  const bounds = {minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity};
  for (const item of items) {bounds.minX = Math.min(bounds.minX, item.minX); bounds.minY = Math.min(bounds.minY, item.minY); bounds.maxX = Math.max(bounds.maxX, item.maxX); bounds.maxY = Math.max(bounds.maxY, item.maxY);}
  if (items.length <= 8) return {...bounds, items};
  const horizontal = bounds.maxX - bounds.minX >= bounds.maxY - bounds.minY;
  const sorted = [...items].sort((a, b) => horizontal ? a.minX + a.maxX - b.minX - b.maxX : a.minY + a.maxY - b.minY - b.maxY);
  const middle = Math.floor(sorted.length / 2);
  return {...bounds, left: nativePrimitiveTree(sorted.slice(0, middle)), right: nativePrimitiveTree(sorted.slice(middle))};
}
function segmentDistanceSq(x: number, y: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, size = dx * dx + dy * dy;
  const t = size === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / size));
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}
function distanceSq(x: number, y: number, p: NativeSpatialPrimitive): number {
  const a = p.points;
  if (a.length === 4) return segmentDistanceSq(x, y, a[0]!, a[1]!, a[2]!, a[3]!);
  const e0 = (a[2]! - a[0]!) * (y - a[1]!) - (a[3]! - a[1]!) * (x - a[0]!);
  const e1 = (a[4]! - a[2]!) * (y - a[3]!) - (a[5]! - a[3]!) * (x - a[2]!);
  const e2 = (a[0]! - a[4]!) * (y - a[5]!) - (a[1]! - a[5]!) * (x - a[4]!);
  if ((e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0)) return 0;
  return Math.min(segmentDistanceSq(x, y, a[0]!, a[1]!, a[2]!, a[3]!), segmentDistanceSq(x, y, a[2]!, a[3]!, a[4]!, a[5]!), segmentDistanceSq(x, y, a[4]!, a[5]!, a[0]!, a[1]!));
}
function boundsDistanceSq(x: number, y: number, p: NativeSpatialBvh): number {return Math.max(p.minX - x, 0, x - p.maxX) ** 2 + Math.max(p.minY - y, 0, y - p.maxY) ** 2;}
export function nativePrimitiveDistance(root: NativeSpatialBvh, x: number, y: number): number {
  return Math.sqrt(visitPrimitiveDistance(root, x, y, Infinity));
}
/** Pass the current bound through recursion rather than allocating a recursive
 * closure for every point query. The arithmetic and child order stay exact. */
function visitPrimitiveDistance(node: NativeSpatialBvh, x: number, y: number, best: number): number {
  if (boundsDistanceSq(x, y, node) >= best) return best;
  if (node.items) {for (const item of node.items) best = Math.min(best, distanceSq(x, y, item)); return best;}
  const left = node.left!, right = node.right!;
  if (boundsDistanceSq(x, y, left) <= boundsDistanceSq(x, y, right)) {
    best = visitPrimitiveDistance(left, x, y, best);
    return visitPrimitiveDistance(right, x, y, best);
  }
  best = visitPrimitiveDistance(right, x, y, best);
  return visitPrimitiveDistance(left, x, y, best);
}
export function nativeSolidPrimitives(terrain: NativeTerrain, includeRelief=false): NativeSpatialPrimitive[] {
  const ids = new Set(terrain.definition.instances.filter(item => includeRelief || item.role === 'solid').map(item => item.id)), result: NativeSpatialPrimitive[] = [];
  for (const mesh of terrain.meshes) {
    if (!ids.has(mesh.spec.id)) continue;
    for (let face = 0; face < (mesh.groundEdgeStart?.triangle ?? mesh.triangleCount); face++) {
      const points: number[] = [];
      for (let corner = 0; corner < 3; corner++) {const at = mesh.indices[face * 3 + corner]! * 3; points.push(mesh.positions[at]!, mesh.positions[at + 1]!);}
      const area = (points[2]! - points[0]!) * (points[5]! - points[1]!) - (points[3]! - points[1]!) * (points[4]! - points[0]!);
      if (Math.abs(area) > 1e-7) result.push(nativePrimitive(points, mesh.spec.id));
    }
  }
  return result;
}
export function nativeVoidPrimitives(terrain: NativeTerrain): NativeSpatialPrimitive[] {
  const grid = terrain.tileMap, result: NativeSpatialPrimitive[] = [];
  const matter = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.tiles[y]![x] !== TileType.VOID;
  for (let y = 0; y < grid.rows; y++) for (let x = 0; x < grid.cols; x++) {
    if (!matter(x, y)) continue;
    const left = x * step, top = y * step, right = left + step, bottom = top + step;
    if (!matter(x - 1, y)) result.push(nativePrimitive([left, top, left, bottom], -1));
    if (!matter(x + 1, y)) result.push(nativePrimitive([right, top, right, bottom], -1));
    if (!matter(x, y - 1)) result.push(nativePrimitive([left, top, right, top], -1));
    if (!matter(x, y + 1)) result.push(nativePrimitive([left, bottom, right, bottom], -1));
  }
  return result;
}

export interface NativeSpatialGeometry {
  readonly terrain:NativeTerrain; readonly collision:NativeBodyCollision;
  readonly supported:Uint8Array; readonly reachable:Uint8Array; readonly links8:Uint8Array;
  readonly supportedCount:number; readonly reachableCount:number;
  readonly solidPrimitives:readonly NativeSpatialPrimitive[];
  readonly solidDistance:(point:Readonly<Vector2>)=>number;
  readonly voidDistance:(point:Readonly<Vector2>)=>number;
  readonly sight:OccluderGrid;
}

/** Every graph edge consumes the authoritative swept 20px body, including diagonals. */
export function buildNativeSpatialGeometry(definition:MasterDefinition,seed:number):NativeSpatialGeometry {
  const terrain=compileNativeTerrain(definition,seed,false),{cols,rows}=terrain,count=cols*rows;
  const collision=new NativeBodyCollision({definition,meshes:terrain.meshes},terrain.tileMap);
  const supported=new Uint8Array(count),reachable=new Uint8Array(count),links8=new Uint8Array(count);
  let supportedCount=0;
  for(let i=0;i<count;i++) {supported[i]=Number(collision.supports(nativeCellPoint(i,cols),10,10));supportedCount+=supported[i]!;}
  for(let cell=0;cell<count;cell++) if(supported[cell]) {
    const p=nativeCellPoint(cell,cols),col=cell%cols,row=Math.floor(cell/cols);
    for(let direction=0;direction<8;direction++) {
      const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[direction]!,x=col+dx,y=row+dy,next=y*cols+x;
      if(x<0||y<0||x>=cols||y>=rows||!supported[next])continue;
      if(collision.displacementFraction(p,10,10,dx*step,dy*step)>=1-1e-9)links8[cell]=links8[cell]!|(1<<direction);
    }
  }
  const start=Math.floor(terrain.spawnPoint.y/step)*cols+Math.floor(terrain.spawnPoint.x/step),queue=new Int32Array(count);
  if(!supported[start])throw new Error('Native spatial candidate has no supported initial probe');
  let head=0,tail=1;queue[0]=start;reachable[start]=1;
  while(head<tail) {
    const cell=queue[head++]!;
    for(let direction=0;direction<8;direction++) if(links8[cell]!&(1<<direction)) {
      const [dx,dy]=NATIVE_SPATIAL_DIRECTIONS[direction]!,next=cell+dx+dy*cols;
      if(!reachable[next]) {reachable[next]=1;queue[tail++]=next;}
    }
  }
  const solids=nativeSolidPrimitives(terrain),solidTree=nativePrimitiveTree(solids),voidTree=nativePrimitiveTree(nativeVoidPrimitives(terrain));
  return {terrain,collision,supported,reachable,links8,supportedCount,reachableCount:tail,solidPrimitives:solids,
    solidDistance:p=>nativePrimitiveDistance(solidTree,p.x,p.y),voidDistance:p=>nativePrimitiveDistance(voidTree,p.x,p.y),
    sight:{cols,rows,tileSize:step,version:0,isOpaque:(x,y)=>x<0||y<0||x>=cols||y>=rows||!terrain.matter[y*cols+x]}};
}


/** Runtime-only refinement evidence. This is never a recipe/source field. The
 * exterior mask includes B; only uniquely recognized closed H can be moved. */
export interface NativeSpatialActualVoidFeedback {
  readonly cols:number;readonly rows:number;
  readonly exteriorMask:Uint8Array;
  readonly holes:readonly Readonly<{holeId:string;cells:readonly number[]}>[];
}
export interface NativeSpatialActualVoidFeedbackResult {
  readonly feedback?:NativeSpatialActualVoidFeedback;
  readonly reason?:string;
}
/** Derive a complete disjoint partition of actual VOID. Uncertain identities
 * disable the proposal cache rather than mislabeling a bay or filling an H. */
export function createNativeSpatialActualVoidFeedback(geometry:NativeSpatialGeometry,
  groups:import('./native-spatial-structures').NativeSpatialGroupResult,
  placements:readonly import('./native-spatial-structures').NativeSpatialHolePlacement[]):NativeSpatialActualVoidFeedbackResult {
  const {cols,rows,matter}=geometry.terrain,count=cols*rows,labels=groups.holeLabelByCell;
  const exteriorLabels=new Set<number>(),byLabel=new Map<number,typeof groups.structures[number]>();
  for(let cell=0;cell<count;cell++)if(!matter[cell]&&(cell<cols||cell>=count-cols||cell%cols===0||cell%cols===cols-1))exteriorLabels.add(labels[cell]!);
  for(const structure of groups.structures)if(structure.kind==='hole'){
    const label=labels[structure.cells[0]!]!;
    if(structure.componentCount!==1||label<0||exteriorLabels.has(label)||byLabel.has(label))return{reason:'actual-void-hole-component-ambiguous'};
    byLabel.set(label,structure);
  }
  if(byLabel.size!==placements.length)return{reason:'actual-void-hole-count-mismatch'};
  const usedLabels=new Set<number>(),usedIds=new Set<string>(),holes:{holeId:string;cells:readonly number[]}[]=[];
  for(const placement of placements){
    const found=new Set<number>();
    for(const [x,y,w,h]of placement.rects)for(let row=Math.max(0,Math.floor(y/8));row<Math.min(rows,Math.ceil((y+h)/8));row++)for(let col=Math.max(0,Math.floor(x/8));col<Math.min(cols,Math.ceil((x+w)/8));col++){
      const px=col*8+4,py=row*8+4,cell=row*cols+col;if(px>=x&&px<x+w&&py>=y&&py<y+h&&!matter[cell])found.add(labels[cell]!);
    }
    const label=found.size===1?[...found][0]!:undefined,structure=label===undefined?undefined:byLabel.get(label);
    if(!structure||usedLabels.has(label!)||usedIds.has(placement.holeId))return{reason:'actual-void-hole-authoring-ambiguous'};
    usedLabels.add(label!);usedIds.add(placement.holeId);holes.push({holeId:placement.holeId,cells:[...structure.cells]});
  }
  const exteriorMask=new Uint8Array(count);
  for(let cell=0;cell<count;cell++)if(!matter[cell]){
    if(usedLabels.has(labels[cell]!))continue;
    if(!exteriorLabels.has(labels[cell]!))return{reason:'actual-void-unassigned-closed-component'};
    exteriorMask[cell]=1;
  }
  return{feedback:{cols,rows,exteriorMask,holes}};
}
