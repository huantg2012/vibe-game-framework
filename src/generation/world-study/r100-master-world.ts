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
import { type NativeVolumeMesh, type NativeVolumeSpec, type NativeVolumeFamily } from '@/generation/world-study/native-volume-geometry';
import { compileNativeTerrain } from './native-terrain';
import { compileNativeVolumeRaster } from '@/generation/world-study/native-volume-raster';
import { worldProfileById } from '@/generation/world-study/profiles';
import type { WorldSample } from '@/generation/world-study/types';
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
  /** Positive ground ring, before internal erosion; absent preserves old maps. */
  readonly terrainOutline?: readonly Readonly<Vector2>[];
  /** Only expanded revision-8 terrain may opt into the compiled fragment budget. */
  readonly fragmentShapeVersion?: 'rectilinear-fragment-v1';
  /** Present only when the author explicitly replaces the grade default. */
  readonly authoredErosion?: true;
}
export interface MasterWorld {
  /** New packages opt into current presentation; absence preserves frozen r4. */
  readonly algorithmRevision?: 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
  /** Present from revision 9 grounded-search packages; no reward identity. */
  readonly searchSites?: readonly import('./search-site-types').R100SearchSitePlacement[];
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

export function createMasterWorld(definition: MasterDefinition, seed: number, frozen?: { readonly grade: PollutionGradeDefinition; readonly profile: WorldProfile; readonly spatialDeployment?: R100SpatialDeploymentPolicy }): MasterWorld {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('种子必须是 0–4294967295 的整数');
  if (frozen?.spatialDeployment) validateR100SpatialDeploymentPolicy(frozen.spatialDeployment);
  const { width, height, cols, rows, land, walls, flowAngle, deposition, matter, erosion, roles, meshes,
    tileMap, grid, reachable, start, reachableBodySeats, spawnPoint, exitPoint, searchPoint, enemyPoint, matterAt } = compileNativeTerrain(definition, seed);
  const raster = compileNativeVolumeRaster(meshes, { x:0, y:0, width, height, pixelSize:1, supportCellSize:SUPPORT, opticalHeight:24 });
  const roleAt = (x:number,y:number): MasterPhysicalRole | null => {
    if (!matterAt(x,y)) return null;
    return roles.get(raster.objectId[Math.floor(y) * raster.width + Math.floor(x)]!) ?? null;
  };
  const source=BUILD_LAB_PLACEMENTS.find(row=>row.scene==='watched'&&row.kind==='enemy'&&row.sense==='sense_hear')!;
  const form:ContaminationForm={substrate:source.substrate,coverage:source.coverage as ContaminationForm['coverage'],continuity:'monolith',portfolio:'jia',occupancy:'floor',lexemes:{motion:source.motion,sense:source.sense,rhythm:source.rhythm,contact:source.contact}};
  const physicalLand=Uint8Array.from(tileMap.tiles.flat(),v=>v===TileType.VOID?0:1), physicalWalls=Uint8Array.from(tileMap.tiles.flat(),v=>v===TileType.WALL?1:0);
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
    triangles:meshes.reduce((n,m)=>n+m.triangleCount,0),reachableBodySeats,spawnPoint,exitPoint,searchPoint,enemyPoint,
    sightPolicy:'only missing terrain and authored light erosion; ordinary relief/solid scenery is transparent',
    erosionCells:erosion.reduce((count,value)=>count+value,0),solidCells:physicalWalls.reduce((count,value)=>count+value,0),physicalRoles:definition.instances.map(({id,role})=>({id,role})),
    geometryBeforeDeployment:true,dynamicTopology:false,gradeMechanics:true,paintHosts:grade.paintCount,volumeHosts:grade.volumeCount,paintContactAreaPx:pollution.paintAreaPx,volumeBoundsAreaPx:pollution.volumeAreaPx,chaosRateStart:grade.chaosStartRate,chaosRateEnd:grade.chaosEndRate,materialSounds:'registered material sources consume the same visible pressure clock; two low-priority voices, distance falloff; perceptual review recorded separately'}};
}
