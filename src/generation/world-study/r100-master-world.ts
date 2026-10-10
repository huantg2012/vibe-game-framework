/** Shared native world geometry. Production deploys its complete contents separately. */
import { GAME_CONSTANTS } from '@/config/constants';
import { BUILD_LAB_PLACEMENTS } from '@/generated/build-lab-data';
import { POLLUTION_GRADE_DEFINITIONS } from '@/generated/rift-pollution-grade-data';
import type { PollutionGradeDefinition } from './pollution-grade';
import type { WorldProfile } from './types';
import { createMasterPollution, type MasterPollution } from './r100-pollution';
import { validateR100SpatialDeploymentPolicy, type R100SpatialDeploymentPolicy } from './r100-spatial-deployment';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { measureOutline } from '@/generation/outline-mask';
import type { GeneratedRiftLayout } from '@/generation/types';
import { buildNativeVolume, type NativeVolumeMesh, type NativeVolumeSpec, type NativeVolumeFamily } from '@/generation/world-study/native-volume-geometry';
import { validateNativeGroundEdgeOwnership } from './native-volume-erosion';
import { compileNativeVolumeRaster } from '@/generation/world-study/native-volume-raster';
import { worldProfileById } from '@/generation/world-study/profiles';
import type { WorldSample } from '@/generation/world-study/types';
import { bodyHasSupport, bodyDisplacementFraction } from '@/systems/ai/physical-grid';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type Vector2 } from '@/types/game-types';
import type { TileMapData, OccluderGrid } from '@/types/map-types';
import { MASTER_SCENES_SOURCE_HASH } from './r100-generated-scenes';

export type MasterFamily = NativeVolumeFamily;
export type MasterGrade = 'low' | 'medium' | 'severe';
export type MasterPhysicalRole = 'solid' | 'relief';
export interface MasterDefinition {
  readonly id:string; readonly family:MasterFamily; readonly grade:MasterGrade; readonly label:string; readonly profile:string;
  readonly cols:number; readonly rows:number; readonly seed:number;
  readonly spawn_x:number; readonly spawn_y:number; readonly exit_x:number; readonly exit_y:number;
  readonly search_x:number; readonly search_y:number; readonly enemy_x:number; readonly enemy_y:number;
  readonly axis:number; readonly light_radius:number; readonly emission:number; readonly motion_period:number;
  readonly ground_quietness:number; readonly ground_contrast:number; readonly ground_coverage:number; readonly ground_material_blend:number;
  readonly instances:readonly (Readonly<Omit<NativeVolumeSpec,'seed'|'family'|'blocking'>> & {readonly role:MasterPhysicalRole; readonly family?:NativeVolumeFamily})[];
  readonly erosion:readonly (readonly Readonly<Vector2>[])[];
  /** Present only when the author explicitly replaces the grade default. */
  readonly authoredErosion?: true;
}
export interface MasterWorld {
  /** New packages opt into current presentation; absence preserves frozen r4. */
  readonly algorithmRevision?: 5 | 6 | 7;
  readonly spatialDeployment?: R100SpatialDeploymentPolicy;
  readonly appearance?: import('./r100-world-appearance').R100WorldAppearance;
  /** Production-only frozen dependency identity; DEV masters omit it. */
  readonly packageHash?: string;
  readonly definition: MasterDefinition;
  readonly meshes: readonly NativeVolumeMesh[];
  readonly raster: ReturnType<typeof compileNativeVolumeRaster>;
  readonly sample: WorldSample;
  readonly layout: GeneratedRiftLayout;
  readonly hostTileMap: TileMapData;
  readonly pollution: MasterPollution;
  readonly sight: OccluderGrid;
  /** Melee obstruction is physical: ordinary solid scenery still stops a swing. */
  readonly combat: OccluderGrid;
  /** Authoritative 8px terrain presence; solid scenery does not remove its ground. */
  readonly matterAt: (x: number, y: number) => boolean;
  /** Visible material's explicit role, for foreground compositing only. */
  readonly roleAt: (x: number, y: number) => MasterPhysicalRole | null;
  readonly diagnostics: Readonly<Record<string, unknown>>;
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

export function createMasterWorld(definition: MasterDefinition, seed: number, frozen?: { readonly grade: PollutionGradeDefinition; readonly profile: WorldProfile; readonly spatialDeployment?: R100SpatialDeploymentPolicy }): MasterWorld {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子必须是 0–4294967295 的整数');
  if (frozen?.spatialDeployment) validateR100SpatialDeploymentPolicy(frozen.spatialDeployment);
  const width = definition.cols * TILE, height = definition.rows * TILE;
  const land = new Uint8Array(definition.cols * definition.rows), walls = new Uint8Array(land.length);
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  for (let row=0; row<definition.rows; row++) for (let col=0; col<definition.cols; col++) {
    const i=row*definition.cols+col;
    land[i]=col>=1 && row>=1 && col<definition.cols-1 && row<definition.rows-1 && !(col<3 && row<3) && !(col>definition.cols-4 && row>definition.rows-4) ? 1 : 0;
    flowAngle[i]=definition.axis + Math.sin(row*.34)*.06;
    deposition[i]=.48 + Math.sin(col*.23+row*.1)*.15;
  }
  const cols=width/SUPPORT, rows=height/SUPPORT;
  const matter = new Uint8Array(cols * rows), erosion = new Uint8Array(matter.length);
  for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
    const x = (col + .5) * SUPPORT, y = (row + .5) * SUPPORT, index = row * cols + col;
    const floor = land[Math.floor(y / TILE) * definition.cols + Math.floor(x / TILE)] === 1;
    erosion[index] = floor && definition.erosion.some(polygon => insidePolygon(polygon, x, y)) ? 1 : 0;
    matter[index] = floor && !erosion[index] ? 1 : 0;
  }
  const matterAt = (x:number,y:number): boolean => x>=0 && y>=0 && x<width && y<height && matter[Math.floor(y/SUPPORT)*cols+Math.floor(x/SUPPORT)]===1;
  validateNativeGroundEdgeOwnership(definition);
  const roles = new Map<number, MasterPhysicalRole>();
  const meshes = definition.instances.map(instance => {
    const { role, ...geometry } = instance; roles.set(instance.id, role);
    return buildNativeVolume({ ...geometry, blocking: role === 'solid' ? 1 : 0, family: instance.family ?? definition.family, seed: seed ^ Math.imul(instance.id, 104729) },
      instance.groundEdgeWidth === undefined ? undefined : { polygons: definition.erosion, width, height, matterAt });
  });
  const raster = compileNativeVolumeRaster(meshes, { x:0, y:0, width, height, pixelSize:1, supportCellSize:SUPPORT, opticalHeight:24 });
  const roleAt = (x:number,y:number): MasterPhysicalRole | null => {
    if (!matterAt(x,y)) return null;
    return roles.get(raster.objectId[Math.floor(y) * raster.width + Math.floor(x)]!) ?? null;
  };
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
  const source=BUILD_LAB_PLACEMENTS.find(row=>row.scene==='watched'&&row.kind==='enemy'&&row.sense==='sense_hear')!;
  const form:ContaminationForm={substrate:source.substrate,coverage:source.coverage as ContaminationForm['coverage'],continuity:'monolith',portfolio:'jia',occupancy:'floor',lexemes:{motion:source.motion,sense:source.sense,rhythm:source.rhythm,contact:source.contact}};
  const physicalLand=Uint8Array.from(tiles.flat(),v=>v===TileType.VOID?0:1), physicalWalls=Uint8Array.from(tiles.flat(),v=>v===TileType.WALL?1:0);
  const fragmentTypeId='frag-outdoor';
  const grade = frozen?.grade ?? POLLUTION_GRADE_DEFINITIONS.find(item => item.id === definition.grade)!;
  const pollution = createMasterPollution(grade, seed, grid, reachable, start, [exitPoint, searchPoint], frozen?.spatialDeployment);
  const outline={seed,attempt:0,cols,rows,tileSize:SUPPORT,land:physicalLand,tileMap,metrics:measureOutline(physicalLand,cols,rows)};
  const enemyCell={col:Math.floor(enemyPoint.x/SUPPORT),row:Math.floor(enemyPoint.y/SUPPORT)};
  const layout:GeneratedRiftLayout={seed,paintGeometryVersion:2,fragmentTypeId,recipeId:`r100-art-lab:${definition.id}`,contaminationAge:'new',ruinSeverity:'broken',tileMap,
    ruins:{seed,attempt:0,fragmentTypeId,outline,walls:physicalWalls,features:[],tileMap,metrics:{wallCount:physicalWalls.reduce((a,b)=>a+b,0),wallRatio:physicalWalls.reduce((a,b)=>a+b,0)/physicalLand.length,featureCount:meshes.length,leftoverConnected:true}},
    walkableMask:grid,spawnPoint,extractionPoint:{id:'master-exit',position:exitPoint,triggerRadius:GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS},
    kindlingNodes:[{id:'master-search',position:searchPoint,tier:'safe',allowWeapon:false}],contaminantNodes:[],
    enemySpawns:[{id:'master-listener',type:'rewriter',spawn:enemyCell,facing:source.facing,patrol:{mode:'static',waypoints:[enemyCell]},form}],
    landmarks:[],contaminationPins:pollution.pins,contaminationDraw:{forms:[form,...pollution.forms],warnings:[]}};
  const baseProfile=frozen?.profile ?? worldProfileById(definition.profile);
  const sample:WorldSample={profile:{...baseProfile,surface:{...baseProfile.surface,quietness:definition.ground_quietness,contrast:definition.ground_contrast,coverage:definition.ground_coverage}},topologyId:'loops',seed,cols:definition.cols,rows:definition.rows,tileSize:TILE,land,walls,spawn:spawnPoint,exit:exitPoint,formations:[],flowAngle,deposition};
  const sight:OccluderGrid={cols,rows,tileSize:SUPPORT,version:0,isOpaque:(col,row)=>col<0||row<0||col>=cols||row>=rows||!matter[row*cols+col]};
  let hash=2166136261;for(const mesh of meshes)for(const v of mesh.positions){hash=Math.imul(hash^Math.round(v*100),16777619);}for(const v of physicalWalls)hash=Math.imul(hash^v,16777619);for(const v of matter)hash=Math.imul(hash^v,16777619);
  return{...(frozen?.spatialDeployment ? { spatialDeployment: frozen.spatialDeployment } : {}),definition,meshes,raster,sample,layout,hostTileMap:pollution.hostTileMap,pollution,sight,combat:grid,matterAt,roleAt,diagnostics:{identity:definition.id,family:definition.family,grade:definition.grade,seed,
    sourceHash:MASTER_SCENES_SOURCE_HASH,geometryFingerprint:(hash>>>0).toString(16).padStart(8,'0'),qualification:'author-local-art-lab; not a production-world admission',projection:'native XY topdown; height projection 0',
    nativeCanvas:[960,640],cameraZoom:1.5,actorBody:HALF_BODY*2,movementPxPerSecond:80,supportCell:SUPPORT,
    triangles:meshes.reduce((n,m)=>n+m.triangleCount,0),reachableBodySeats:queue.length,spawnPoint,exitPoint,searchPoint,enemyPoint,
    sightPolicy:'only missing terrain and authored light erosion; ordinary relief/solid scenery is transparent',
    erosionCells:erosion.reduce((count,value)=>count+value,0),solidCells:physicalWalls.reduce((count,value)=>count+value,0),physicalRoles:definition.instances.map(({id,role})=>({id,role})),
    geometryBeforeDeployment:true,dynamicTopology:false,gradeMechanics:true,paintHosts:grade.paintCount,volumeHosts:grade.volumeCount,paintContactAreaPx:pollution.paintAreaPx,volumeBoundsAreaPx:pollution.volumeAreaPx,chaosRateStart:grade.chaosStartRate,chaosRateEnd:grade.chaosEndRate,materialSounds:'registered material sources consume the same visible pressure clock; two low-priority voices, distance falloff; perceptual review recorded separately'}};
}
