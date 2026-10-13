/** Lightweight native geometry/support stage. No material raster or Host deployment. */
import { GAME_CONSTANTS } from '@/config/constants';
import { buildNativeVolume, type NativeVolumeMesh } from './native-volume-geometry';
import { validateNativeGroundEdgeOwnership, validateNativeTerrainOutline, FRAGMENT_TERRAIN_BUDGET } from './native-volume-erosion';
import { bodyHasSupport, bodyDisplacementFraction } from '@/systems/ai/physical-grid';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type Vector2 } from '@/types/game-types';
import type { TileMapData } from '@/types/map-types';
import type { MasterDefinition, MasterPhysicalRole } from './r100-master-world';

export interface NativeTerrain {
  readonly definition: MasterDefinition;
  readonly width: number; readonly height: number; readonly cols: number; readonly rows: number;
  readonly land: Uint8Array; readonly walls: Uint8Array; readonly flowAngle: Float32Array; readonly deposition: Float32Array;
  readonly matter: Uint8Array; readonly erosion: Uint8Array; readonly roles: ReadonlyMap<number, MasterPhysicalRole>;
  readonly meshes: readonly NativeVolumeMesh[]; readonly tileMap: TileMapData; readonly grid: TileGrid;
  readonly seats: Uint8Array; readonly reachable: Uint8Array; readonly start: number; readonly reachableBodySeats: number;
  readonly spawnPoint: Vector2; readonly exitPoint: Vector2; readonly searchPoint: Vector2; readonly enemyPoint: Vector2;
  readonly matterAt: (x: number, y: number) => boolean;
}
const TILE = 32, SUPPORT = 8, HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]] as const;

function insidePolygon(points: readonly Readonly<Vector2>[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]!, b = points[j]!;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Project solid triangles onto physical cells, independently of visible surfaces.
 * A low relief laid over a solid must not erase the underlying collision. */
function solidCoverage(meshes: readonly NativeVolumeMesh[], cols: number, rows: number): Uint8Array {
  const coverage = new Uint8Array(cols * rows), half = SUPPORT / 2;
  for (const mesh of meshes) for (let face = 0; face < mesh.triangleCount; face++) {
    const p = mesh.positions, a = mesh.indices[face * 3]! * 3, b = mesh.indices[face * 3 + 1]! * 3, c = mesh.indices[face * 3 + 2]! * 3;
    const xs = [p[a]!, p[b]!, p[c]!], ys = [p[a + 1]!, p[b + 1]!, p[c + 1]!];
    if (Math.abs((xs[1]! - xs[0]!) * (ys[2]! - ys[0]!) - (ys[1]! - ys[0]!) * (xs[2]! - xs[0]!)) < 1e-7) continue;
    const minCol = Math.max(0, Math.floor(Math.min(...xs) / SUPPORT)), maxCol = Math.min(cols - 1, Math.floor(Math.max(...xs) / SUPPORT));
    const minRow = Math.max(0, Math.floor(Math.min(...ys) / SUPPORT)), maxRow = Math.min(rows - 1, Math.floor(Math.max(...ys) / SUPPORT));
    for (let row = minRow; row <= maxRow; row++) for (let col = minCol; col <= maxCol; col++) {
      const index = row * cols + col;
      if (coverage[index]) continue;
      const x = (col + .5) * SUPPORT, y = (row + .5) * SUPPORT;
      let overlaps = true;
      for (let edge = 0; edge < 3; edge++) {
        const next = (edge + 1) % 3, nx = ys[next]! - ys[edge]!, ny = xs[edge]! - xs[next]!;
        const pa = xs[0]! * nx + ys[0]! * ny, pb = xs[1]! * nx + ys[1]! * ny, pc = xs[2]! * nx + ys[2]! * ny;
        const center = x * nx + y * ny, radius = half * (Math.abs(nx) + Math.abs(ny));
        if (Math.max(pa, pb, pc) <= center - radius + 1e-7 || Math.min(pa, pb, pc) >= center + radius - 1e-7) { overlaps = false; break; }
      }
      if (overlaps) coverage[index] = 1;
    }
  }
  return coverage;
}

export function compileNativeTerrain(definition: MasterDefinition, seed: number, includeGroundEdges = true): NativeTerrain {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('Seed must be a uint32');
  const width = definition.cols * TILE, height = definition.rows * TILE;
  const positiveTerrain = Object.prototype.hasOwnProperty.call(definition, 'terrainOutline');
  if (definition.fragmentShapeVersion !== undefined && (definition.fragmentShapeVersion !== 'rectilinear-fragment-v1' || !positiveTerrain)) throw new Error('Invalid compiled fragment terrain identity');
  const terrainBudget = definition.fragmentShapeVersion === 'rectilinear-fragment-v1' ? FRAGMENT_TERRAIN_BUDGET : undefined;
  if (positiveTerrain) validateNativeTerrainOutline(definition.terrainOutline, width, height, definition.erosion, terrainBudget);
  const land = new Uint8Array(definition.cols * definition.rows), walls = new Uint8Array(land.length);
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  for (let row=0; row<definition.rows; row++) for (let col=0; col<definition.cols; col++) {
    const i=row*definition.cols+col;
    if (!positiveTerrain) land[i]=col>=1 && row>=1 && col<definition.cols-1 && row<definition.rows-1 && !(col<3 && row<3) && !(col>definition.cols-4 && row>definition.rows-4) ? 1 : 0;
    flowAngle[i]=definition.axis + Math.sin(row*.34)*.06;
    deposition[i]=.48 + Math.sin(col*.23+row*.1)*.15;
  }
  const cols=width/SUPPORT, rows=height/SUPPORT;
  const matter = new Uint8Array(cols * rows), erosion = new Uint8Array(matter.length);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = (col + .5) * SUPPORT, y = (row + .5) * SUPPORT, index = row * cols + col;
    const floor = positiveTerrain ? insidePolygon(definition.terrainOutline!, x, y)
      : land[Math.floor(y / TILE) * definition.cols + Math.floor(x / TILE)] === 1;
    erosion[index] = floor && definition.erosion.some(polygon => insidePolygon(polygon, x, y)) ? 1 : 0;
    matter[index] = floor && !erosion[index] ? 1 : 0;
    // The coarse material sample follows physical support, never clips it.
    if (positiveTerrain && matter[index]) land[Math.floor(y / TILE) * definition.cols + Math.floor(x / TILE)] = 1;
  }
  const matterAt = (x:number,y:number): boolean => x>=0 && y>=0 && x<width && y<height && matter[Math.floor(y/SUPPORT)*cols+Math.floor(x/SUPPORT)]===1;
  validateNativeGroundEdgeOwnership(definition, terrainBudget);
  const terrainEdges = positiveTerrain ? [definition.terrainOutline!, ...definition.erosion] : definition.erosion;
  const roles = new Map<number, MasterPhysicalRole>();
  const meshes = definition.instances.map(instance => {
    const { role, ...geometry } = instance; roles.set(instance.id, role);
    const { groundEdgeWidth: _groundEdgeWidth, ...withoutEdge } = geometry;
    return buildNativeVolume({ ...(includeGroundEdges ? geometry : withoutEdge), blocking: role === 'solid' ? 1 : 0, family: instance.family ?? definition.family, seed: seed ^ Math.imul(instance.id, 104729) },
      !includeGroundEdges || instance.groundEdgeWidth === undefined ? undefined : { polygons: terrainEdges, width, height, matterAt });
  });
  const solids = solidCoverage(meshes.filter(mesh => roles.get(mesh.spec.id) === 'solid'), cols, rows);
  const tiles = Array.from({length:rows},(_,row)=>Array.from({length:cols},(_,col)=>!matter[row*cols+col] ? TileType.VOID : solids[row*cols+col] ? TileType.WALL : TileType.FLOOR));
  const tileMap={cols,rows,tileSize:SUPPORT,tiles}, grid=new TileGrid(tileMap);
  const center=(cell:number):Vector2=>({x:(cell%cols+.5)*SUPPORT,y:(Math.floor(cell/cols)+.5)*SUPPORT});
  const seats=new Uint8Array(cols*rows);
  for(let i=0;i<seats.length;i++) seats[i]=grid.isWalkable(i%cols,Math.floor(i/cols)) && bodyHasSupport(grid,center(i),HALF_BODY,HALF_BODY)?1:0;
  function nearest(target:Readonly<Vector2>, available:Uint8Array):number {
    let best=-1, distance=Infinity;
    for(let i=0;i<available.length;i++){if(!available[i])continue;const p=center(i),d=(p.x-target.x)**2+(p.y-target.y)**2;if(d<distance){best=i;distance=d;}}
    if(best<0)throw new Error('构造没有留下原生20px身体的安全站位');return best;
  }
  const start=nearest({x:definition.spawn_x,y:definition.spawn_y},seats), reachable=new Uint8Array(seats.length), queue=[start];reachable[start]=1;
  for(let at=0;at<queue.length;at++){
    const cell=queue[at]!,c=cell%cols,r=Math.floor(cell/cols),p=center(cell);
    for(const[dx,dy]of DIRECTIONS){const x=c+dx,y=r+dy,next=y*cols+x;if(x<0||y<0||x>=cols||y>=rows||!seats[next]||reachable[next])continue;
      if(bodyDisplacementFraction(grid,p,HALF_BODY,HALF_BODY,dx*SUPPORT,dy*SUPPORT)<1)continue;reachable[next]=1;queue.push(next);}
  }
  const spawnPoint=center(start), exitPoint=center(nearest({x:definition.exit_x,y:definition.exit_y},reachable));
  const searchPoint=center(nearest({x:definition.search_x,y:definition.search_y},reachable));
  const enemyPoint=center(nearest({x:definition.enemy_x,y:definition.enemy_y},reachable));
  if(Math.hypot(spawnPoint.x-definition.spawn_x,spawnPoint.y-definition.spawn_y)>64)throw new Error('母版入口被巨构挤出同一观察区');
  return {definition, width, height, cols, rows, land, walls, flowAngle, deposition, matter, erosion, roles,
    meshes, tileMap, grid, seats, reachable, start, reachableBodySeats: queue.length, spawnPoint, exitPoint, searchPoint, enemyPoint, matterAt};
}
