/** Author-local native Rift fixture. Geometry is admitted before any actor/node. */
import { GAME_CONSTANTS } from '@/config/constants';
import { BUILD_LAB_PLACEMENTS } from '@/generated/build-lab-data';
import type { ContaminationForm } from '@/generation/contamination-draw';
import { measureOutline } from '@/generation/outline-mask';
import type { GeneratedRiftLayout } from '@/generation/types';
import { buildNativeVolume, type NativeVolumeMesh } from '@/generation/world-study/native-volume-geometry';
import { compileNativeVolumeRaster } from '@/generation/world-study/native-volume-raster';
import { worldProfileById } from '@/generation/world-study/profiles';
import type { WorldSample } from '@/generation/world-study/types';
import { bodyHasSupport, bodyDisplacementFraction } from '@/systems/ai/physical-grid';
import { TileGrid } from '@/systems/tile-grid';
import { TileType, type Vector2 } from '@/types/game-types';
import type { OccluderGrid } from '@/types/map-types';
import { MASTER_SCENES, MASTER_SCENES_SOURCE_HASH } from './generated-scenes';

export type MasterDefinition = typeof MASTER_SCENES[number];
export type MasterFamily = MasterDefinition['family'];
export type MasterGrade = MasterDefinition['grade'];
export interface MasterWorld {
  readonly definition: MasterDefinition;
  readonly meshes: readonly NativeVolumeMesh[];
  readonly raster: ReturnType<typeof compileNativeVolumeRaster>;
  readonly sample: WorldSample;
  readonly layout: GeneratedRiftLayout;
  readonly sight: OccluderGrid;
  readonly diagnostics: Readonly<Record<string, unknown>>;
}
const TILE = 32, SUPPORT = 8, HALF_BODY = GAME_CONSTANTS.PLAYER.BODY_SIZE / 2;
const DIRECTIONS = [[1,0],[-1,0],[0,1],[0,-1]] as const;

export function createMasterWorld(definition: MasterDefinition, seed: number): MasterWorld {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子必须是 0–4294967295 的整数');
  const width = definition.cols * TILE, height = definition.rows * TILE;
  const meshes = definition.instances.map(instance => buildNativeVolume({ ...instance, family: definition.family, seed: seed ^ Math.imul(instance.id, 104729) }));
  const raster = compileNativeVolumeRaster(meshes, { x:0, y:0, width, height, pixelSize:1, supportCellSize:SUPPORT, opticalHeight:24 });
  const land = new Uint8Array(definition.cols * definition.rows), walls = new Uint8Array(land.length);
  const flowAngle = new Float32Array(land.length), deposition = new Float32Array(land.length);
  for (let row=0; row<definition.rows; row++) for (let col=0; col<definition.cols; col++) {
    const i=row*definition.cols+col;
    land[i]=col>=1 && row>=1 && col<definition.cols-1 && row<definition.rows-1 && !(col<3 && row<3) && !(col>definition.cols-4 && row>definition.rows-4) ? 1 : 0;
    flowAngle[i]=definition.axis + Math.sin(row*.34)*.06;
    deposition[i]=.48 + Math.sin(col*.23+row*.1)*.15;
  }
  const cols=width/SUPPORT, rows=height/SUPPORT;
  const floorAt = (x:number,y:number): boolean => x>=0 && y>=0 && x<width && y<height && land[Math.floor(y/TILE)*definition.cols+Math.floor(x/TILE)]===1;
  const occupiedAt = (col:number,row:number): boolean => raster.occupancy[row*cols+col]===1;
  const tiles = Array.from({length:rows},(_,row)=>Array.from({length:cols},(_,col)=>!floorAt((col+.5)*SUPPORT,(row+.5)*SUPPORT) ? TileType.VOID : occupiedAt(col,row) ? TileType.WALL : TileType.FLOOR));
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
  const outline={seed,attempt:0,cols,rows,tileSize:SUPPORT,land:physicalLand,tileMap,metrics:measureOutline(physicalLand,cols,rows)};
  const enemyCell={col:Math.floor(enemyPoint.x/SUPPORT),row:Math.floor(enemyPoint.y/SUPPORT)};
  const layout:GeneratedRiftLayout={seed,paintGeometryVersion:2,fragmentTypeId,recipeId:`r100-art-lab:${definition.id}`,contaminationAge:'new',ruinSeverity:'broken',tileMap,
    ruins:{seed,attempt:0,fragmentTypeId,outline,walls:physicalWalls,features:[],tileMap,metrics:{wallCount:physicalWalls.reduce((a,b)=>a+b,0),wallRatio:physicalWalls.reduce((a,b)=>a+b,0)/physicalLand.length,featureCount:meshes.length,leftoverConnected:true}},
    walkableMask:grid,spawnPoint,extractionPoint:{id:'master-exit',position:exitPoint,triggerRadius:GAME_CONSTANTS.EXTRACTION.TRIGGER_RADIUS},
    kindlingNodes:[{id:'master-search',position:searchPoint,tier:'safe',allowWeapon:false}],contaminantNodes:[],
    enemySpawns:[{id:'master-listener',type:'rewriter',spawn:enemyCell,facing:source.facing,patrol:{mode:'static',waypoints:[enemyCell]},form}],
    landmarks:[],contaminationPins:{wallEdges:[],paintFloors:[],corridorAabbs:[]},contaminationDraw:{forms:[form],warnings:[]}};
  const baseProfile=worldProfileById(definition.profile);
  const sample:WorldSample={profile:{...baseProfile,surface:{...baseProfile.surface,quietness:definition.ground_quietness,contrast:definition.ground_contrast,coverage:definition.ground_coverage}},topologyId:'loops',seed,cols:definition.cols,rows:definition.rows,tileSize:TILE,land,walls,spawn:spawnPoint,exit:exitPoint,formations:[],flowAngle,deposition};
  const sight:OccluderGrid={cols,rows,tileSize:SUPPORT,version:0,isOpaque:(col,row)=>col<0||row<0||col>=cols||row>=rows||!floorAt((col+.5)*SUPPORT,(row+.5)*SUPPORT)||raster.optical[row*cols+col]===1};
  let hash=2166136261;for(const mesh of meshes)for(const v of mesh.positions){hash=Math.imul(hash^Math.round(v*100),16777619);}for(const v of physicalWalls)hash=Math.imul(hash^v,16777619);
  return{definition,meshes,raster,sample,layout,sight,diagnostics:{identity:definition.id,family:definition.family,grade:definition.grade,seed,
    sourceHash:MASTER_SCENES_SOURCE_HASH,geometryFingerprint:(hash>>>0).toString(16).padStart(8,'0'),qualification:'author-local-art-lab; not a production-world admission',projection:'native XY topdown; height projection 0',
    nativeCanvas:[960,640],cameraZoom:1.5,actorBody:HALF_BODY*2,movementPxPerSecond:80,supportCell:SUPPORT,
    triangles:meshes.reduce((n,m)=>n+m.triangleCount,0),reachableBodySeats:queue.length,spawnPoint,exitPoint,searchPoint,enemyPoint,
    geometryBeforeDeployment:true,dynamicTopology:false,gradeMechanics:false,materialSounds:'existing Rift ambience; new material-specific soundscape not yet authored'}};
}
